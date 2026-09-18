#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
sed -i 's/\r$//' "$ROOT"/*.sh "$ROOT"/nginx.conf "$ROOT"/.env 2>/dev/null || true
python3 - <<'PY'
from pathlib import Path
p = Path("/home/wei/campus-reimburse/.env") if Path("/home/wei/campus-reimburse/.env").exists() else Path(".env")
text = p.read_text(encoding="utf-8").replace("\r", "")
out = []
for line in text.splitlines():
    raw = line
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        if v and v[0] not in ("'", '"') and ("#" in v or " " in v):
            raw = f"{k}='{v}'"
    out.append(raw)
p.write_text("\n".join(out) + "\n", encoding="utf-8")
PY

RUNTIME="$ROOT/runtime"
LOGS="$ROOT/logs"
mkdir -p "$LOGS" "$ROOT/tmp/client_body" "$ROOT/tmp/proxy" "$ROOT/tmp/fastcgi" "$ROOT/tmp/uwsgi" "$ROOT/tmp/scgi"
set -a
# shellcheck disable=SC1091
source "$ROOT/.env"
set +a

export JAVA_HOME="$RUNTIME/jdk"
export PATH="$JAVA_HOME/bin:$PATH"
MYSQL_BASE="$RUNTIME/mysql"
MYSQL_SOCK="$RUNTIME/mysql.sock"
export LD_LIBRARY_PATH="$MYSQL_BASE/lib:$RUNTIME/libaio/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}"

wait_port() {
  local port="$1" n=0
  while ! bash -c "echo >/dev/tcp/127.0.0.1/$port" 2>/dev/null; do
    n=$((n+1))
    if [[ "$n" -gt 60 ]]; then
      echo "timeout waiting for port $port"
      return 1
    fi
    sleep 1
  done
}

if [[ ! -f "$RUNTIME/mysql.pid" ]] || ! kill -0 "$(cat "$RUNTIME/mysql.pid")" 2>/dev/null; then
  "$MYSQL_BASE/bin/mysqld" --defaults-file="$RUNTIME/my.cnf" --daemonize
fi
wait_port 13306
"$MYSQL_BASE/bin/mysql" --socket="$MYSQL_SOCK" -u root -e "CREATE DATABASE IF NOT EXISTS ${MYSQL_DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'127.0.0.1' IDENTIFIED BY '${MYSQL_PASSWORD}'; CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'localhost' IDENTIFIED BY '${MYSQL_PASSWORD}'; ALTER USER '${MYSQL_USER}'@'127.0.0.1' IDENTIFIED BY '${MYSQL_PASSWORD}'; ALTER USER '${MYSQL_USER}'@'localhost' IDENTIFIED BY '${MYSQL_PASSWORD}'; GRANT ALL ON ${MYSQL_DB}.* TO '${MYSQL_USER}'@'127.0.0.1'; GRANT ALL ON ${MYSQL_DB}.* TO '${MYSQL_USER}'@'localhost'; FLUSH PRIVILEGES;"

if ! bash -c "echo >/dev/tcp/127.0.0.1/16379" 2>/dev/null; then
  "$RUNTIME/redis/src/redis-server" --port 16379 --bind 127.0.0.1 --daemonize yes --dir "$RUNTIME/redis-data" --pidfile "$RUNTIME/redis.pid" --logfile "$LOGS/redis.log" --dbfilename dump.rdb
fi
wait_port 16379

mkdir -p "$RUNTIME/files"

if [[ -f "$RUNTIME/api.pid" ]]; then
  kill "$(cat "$RUNTIME/api.pid")" 2>/dev/null || true
  rm -f "$RUNTIME/api.pid"
  sleep 1
fi
if [[ -f "$RUNTIME/worker.pid" ]]; then
  kill "$(cat "$RUNTIME/worker.pid")" 2>/dev/null || true
  rm -f "$RUNTIME/worker.pid"
fi
pkill -f "/home/wei/campus-reimburse/runtime/app.jar" 2>/dev/null || true
sleep 1

nohup env \
  SERVER_PORT=18081 \
  MYSQL_HOST=127.0.0.1 \
  MYSQL_PORT=13306 \
  MYSQL_DB="${MYSQL_DB}" \
  MYSQL_USER="${MYSQL_USER}" \
  MYSQL_PASSWORD="${MYSQL_PASSWORD}" \
  SPRING_DATASOURCE_USERNAME="${MYSQL_USER}" \
  SPRING_DATASOURCE_PASSWORD="${MYSQL_PASSWORD}" \
  REDIS_HOST=127.0.0.1 \
  REDIS_PORT=16379 \
  SPRING_DATA_REDIS_HOST=127.0.0.1 \
  SPRING_DATA_REDIS_PORT=16379 \
  CAMPUS_STORAGE_TYPE=local \
  CAMPUS_STORAGE_DIR="$RUNTIME/files" \
  CAMPUS_AES_KEY="${CAMPUS_AES_KEY}" \
  SPRING_DATASOURCE_URL="jdbc:mysql://127.0.0.1:13306/${MYSQL_DB}?useUnicode=true&characterEncoding=utf8&connectionTimeZone=UTC&allowPublicKeyRetrieval=true&useSSL=false" \
  "$JAVA_HOME/bin/java" -jar "$RUNTIME/app.jar" > "$LOGS/api.log" 2>&1 &
echo $! > "$RUNTIME/api.pid"
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:18081/actuator/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
  if [[ "$i" -eq 60 ]]; then
    echo "API failed to start, see logs/api.log"
    tail -n 80 "$LOGS/api.log" || true
    exit 1
  fi
done

nohup env \
  SERVER_PORT=18082 \
  SPRING_PROFILES_ACTIVE=worker \
  OCR_WORKER_ENABLED=true \
  MYSQL_HOST=127.0.0.1 MYSQL_PORT=13306 MYSQL_DB="${MYSQL_DB}" MYSQL_USER="${MYSQL_USER}" MYSQL_PASSWORD="${MYSQL_PASSWORD}" \
  SPRING_DATASOURCE_USERNAME="${MYSQL_USER}" SPRING_DATASOURCE_PASSWORD="${MYSQL_PASSWORD}" \
  REDIS_HOST=127.0.0.1 REDIS_PORT=16379 SPRING_DATA_REDIS_HOST=127.0.0.1 SPRING_DATA_REDIS_PORT=16379 \
  CAMPUS_STORAGE_TYPE=local CAMPUS_STORAGE_DIR="$RUNTIME/files" CAMPUS_AES_KEY="${CAMPUS_AES_KEY}" \
  SPRING_DATASOURCE_URL="jdbc:mysql://127.0.0.1:13306/${MYSQL_DB}?useUnicode=true&characterEncoding=utf8&connectionTimeZone=UTC&allowPublicKeyRetrieval=true&useSSL=false" \
  "$JAVA_HOME/bin/java" -jar "$RUNTIME/app.jar" > "$LOGS/worker.log" 2>&1 &
echo $! > "$RUNTIME/worker.pid"

if [[ -f "$LOGS/nginx.pid" ]] && kill -0 "$(cat "$LOGS/nginx.pid")" 2>/dev/null; then
  nginx -p "$ROOT" -e "$LOGS/nginx-error.log" -c "$ROOT/nginx.conf" -s reload || true
else
  nginx -p "$ROOT" -e "$LOGS/nginx-error.log" -c "$ROOT/nginx.conf"
fi

echo "Started. API health UP on 127.0.0.1:18081, OCR worker and nginx on 0.0.0.0:18080"
echo "If metabb.cn:18080 is not reachable from campus network, open a tunnel on Windows:"
echo "  ssh -p 10002 -i %USERPROFILE%\\.ssh\\id_wei_metabb_cn -L 18080:127.0.0.1:18080 wei@metabb.cn"
echo "then browse http://127.0.0.1:18080"
echo "Demo: zhang/wang/li/zhou/chen/admin  password Campus@2026"
curl -fsS "http://127.0.0.1:18080/" >/dev/null && echo "web ok" || echo "web not ready"
curl -fsS "http://127.0.0.1:18081/actuator/health" && echo
