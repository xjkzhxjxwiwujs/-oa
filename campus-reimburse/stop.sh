#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
RUNTIME="$ROOT/runtime"
LOGS="$ROOT/logs"

stop_pidfile() {
  local f="$1"
  if [[ -f "$f" ]]; then
    local pid
    pid="$(cat "$f" || true)"
    if [[ -n "${pid}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$f"
  fi
}

if [[ -f "$LOGS/nginx.pid" ]]; then
  nginx -p "$ROOT" -c "$ROOT/nginx.conf" -s stop 2>/dev/null || true
fi
stop_pidfile "$RUNTIME/api.pid"
stop_pidfile "$RUNTIME/minio.pid"
stop_pidfile "$RUNTIME/redis.pid"
if [[ -f "$RUNTIME/mysql.pid" ]]; then
  mysqladmin="$(ls "$RUNTIME/mysql/bin/mysqladmin" 2>/dev/null || true)"
  if [[ -n "$mysqladmin" ]]; then
    "$mysqladmin" --defaults-file="$RUNTIME/my.cnf" -u root shutdown 2>/dev/null || true
  fi
  stop_pidfile "$RUNTIME/mysql.pid"
fi
echo "Stopped"
