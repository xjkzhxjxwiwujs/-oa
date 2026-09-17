#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
RUNTIME="$ROOT/runtime"
LOGS="$ROOT/logs"
MYSQL_BASE="$RUNTIME/mysql"
MYSQL_DATA="$RUNTIME/mysql-data"
MYSQL_SOCK="$RUNTIME/mysql.sock"
export LD_LIBRARY_PATH="$MYSQL_BASE/lib:$RUNTIME/libaio/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}"
export JAVA_HOME="$RUNTIME/jdk"
export PATH="$JAVA_HOME/bin:$RUNTIME/maven/bin:$PATH"

if [[ ! -d "$MYSQL_DATA/mysql" ]]; then
  mkdir -p "$MYSQL_DATA"
  "$MYSQL_BASE/bin/mysqld" --defaults-file="$RUNTIME/my.cnf" --initialize-insecure
fi

echo "==> Redis"
if [[ ! -x "$RUNTIME/redis/src/redis-server" ]]; then
  if [[ ! -f "$RUNTIME/redis.tgz" ]]; then
    curl -fL --connect-timeout 20 --retry 3 --progress-bar -o "$RUNTIME/redis.tgz" https://mirrors.huaweicloud.com/redis/redis-7.4.2.tar.gz
  fi
  mkdir -p "$RUNTIME/redis-src"
  tar -xzf "$RUNTIME/redis.tgz" -C "$RUNTIME/redis-src" --strip-components=1
  make -C "$RUNTIME/redis-src" -j"$(nproc)"
  mkdir -p "$RUNTIME/redis/src"
  cp "$RUNTIME/redis-src/src/redis-server" "$RUNTIME/redis-src/src/redis-cli" "$RUNTIME/redis/src/"
fi
mkdir -p "$RUNTIME/redis-data"

echo "==> Build backend"
"$RUNTIME/maven/bin/mvn" -f "$ROOT/backed/pom.xml" -s "$ROOT/backed/maven-settings.xml" -B -DskipTests package
cp -f "$ROOT/backed/target/reimburse-api-1.0.0.jar" "$RUNTIME/app.jar"

echo "==> Build frontend"
(cd "$ROOT/fronted" && npm install && npm run build)

echo "Bootstrap done. Run ./start.sh"
