#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
sed -i 's/\r$//' "$ROOT"/*.sh "$ROOT"/nginx.conf 2>/dev/null || true
chmod +x "$ROOT"/*.sh

RUNTIME="$ROOT/runtime"
LOGS="$ROOT/logs"
mkdir -p "$RUNTIME" "$LOGS" "$ROOT/tmp/client_body" "$ROOT/tmp/proxy" "$ROOT/tmp/fastcgi" "$ROOT/tmp/uwsgi" "$ROOT/tmp/scgi"

download() {
  local url="$1" dest="$2"
  if [[ -f "$dest" ]]; then
    return 0
  fi
  echo "Downloading $url"
  curl -fL --connect-timeout 20 --retry 3 --retry-delay 2 --progress-bar -o "$dest.part" "$url"
  mv "$dest.part" "$dest"
}

echo "==> JDK 21"
if [[ ! -x "$RUNTIME/jdk/bin/javac" ]]; then
  download "https://mirrors.tuna.tsinghua.edu.cn/Adoptium/21/jdk/x64/linux/OpenJDK21U-jdk_x64_linux_hotspot_21.0.12.1_1.tar.gz" "$RUNTIME/jdk.tgz"
  rm -rf "$RUNTIME/jdk"
  mkdir -p "$RUNTIME/jdk-unpack"
  tar -xzf "$RUNTIME/jdk.tgz" -C "$RUNTIME/jdk-unpack"
  inner="$(find "$RUNTIME/jdk-unpack" -maxdepth 1 -mindepth 1 -type d | head -n 1)"
  mv "$inner" "$RUNTIME/jdk"
  rmdir "$RUNTIME/jdk-unpack" 2>/dev/null || true
fi
export JAVA_HOME="$RUNTIME/jdk"
export PATH="$JAVA_HOME/bin:$PATH"
java -version

echo "==> Maven"
if [[ ! -d "$RUNTIME/maven" ]]; then
  download "https://repo.huaweicloud.com/apache/maven/maven-3/3.9.9/binaries/apache-maven-3.9.9-bin.tar.gz" "$RUNTIME/maven.tgz"
  tar -xzf "$RUNTIME/maven.tgz" -C "$RUNTIME"
  mv "$RUNTIME"/apache-maven-* "$RUNTIME/maven"
fi
export PATH="$RUNTIME/maven/bin:$PATH"

echo "==> MySQL 8.4"
if [[ ! -d "$RUNTIME/mysql" ]]; then
  download "https://cdn.mysql.com/archives/mysql-8.4/mysql-8.4.5-linux-glibc2.28-x86_64.tar.xz" "$RUNTIME/mysql.tar.xz"
  tar -xJf "$RUNTIME/mysql.tar.xz" -C "$RUNTIME"
  mv "$RUNTIME"/mysql-8.* "$RUNTIME/mysql"
fi
MYSQL_BASE="$RUNTIME/mysql"
MYSQL_DATA="$RUNTIME/mysql-data"
MYSQL_SOCK="$RUNTIME/mysql.sock"
export LD_LIBRARY_PATH="$MYSQL_BASE/lib:$RUNTIME/libaio/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}"
if [[ ! -d "$MYSQL_DATA/mysql" ]]; then
  mkdir -p "$MYSQL_DATA"
  cat > "$RUNTIME/my.cnf" <<EOF
[mysqld]
basedir=$MYSQL_BASE
datadir=$MYSQL_DATA
socket=$MYSQL_SOCK
pid-file=$RUNTIME/mysql.pid
log-error=$LOGS/mysql.err
port=13306
bind-address=127.0.0.1
mysqlx=0
skip-log-bin
character-set-server=utf8mb4
collation-server=utf8mb4_0900_ai_ci
max_connections=50
innodb_buffer_pool_size=128M
performance_schema=OFF
EOF
  "$MYSQL_BASE/bin/mysqld" --defaults-file="$RUNTIME/my.cnf" --initialize-insecure
fi

echo "==> Redis"
if [[ ! -x "$RUNTIME/redis/src/redis-server" ]]; then
  download "https://mirrors.huaweicloud.com/redis/redis-7.4.2.tar.gz" "$RUNTIME/redis.tgz"
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
