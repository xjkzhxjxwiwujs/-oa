#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
RUNTIME="$ROOT/runtime"
export PATH="$RUNTIME/jdk/bin:$RUNTIME/maven/bin:$PATH"

if ! javac -version >/dev/null 2>&1; then
  echo "==> JDK 21 (compiler)"
  curl -fL --connect-timeout 20 --retry 3 --progress-bar -o "$RUNTIME/jdk.tgz" \
    https://mirrors.tuna.tsinghua.edu.cn/Adoptium/21/jdk/x64/linux/OpenJDK21U-jdk_x64_linux_hotspot_21.0.12.1_1.tar.gz
  rm -rf "$RUNTIME/jdk"
  mkdir -p "$RUNTIME/jdk-unpack"
  tar -xzf "$RUNTIME/jdk.tgz" -C "$RUNTIME/jdk-unpack"
  inner="$(find "$RUNTIME/jdk-unpack" -maxdepth 1 -mindepth 1 -type d | head -n 1)"
  mv "$inner" "$RUNTIME/jdk"
  rmdir "$RUNTIME/jdk-unpack" 2>/dev/null || true
fi
export JAVA_HOME="$RUNTIME/jdk"
export PATH="$JAVA_HOME/bin:$RUNTIME/maven/bin:$PATH"
java -version
javac -version

echo "==> Build backend"
"$RUNTIME/maven/bin/mvn" -f "$ROOT/backed/pom.xml" -s "$ROOT/backed/maven-settings.xml" -B -DskipTests package
cp -f "$ROOT/backed/target/reimburse-api-1.0.0.jar" "$RUNTIME/app.jar"

echo "==> Build frontend"
(cd "$ROOT/fronted" && npm install && npm run build)

echo "Build done. Run ./start.sh"
