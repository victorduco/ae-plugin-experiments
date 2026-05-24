#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PORT=3131
LOG="$ROOT_DIR/output/ui-server.log"

mkdir -p "$ROOT_DIR/output"

# Kill anything already on the port
kill $(lsof -ti:$PORT) 2>/dev/null || true
sleep 0.3

echo "Web UI → http://localhost:$PORT"
exec node "$ROOT_DIR/src/web-ui/server.js"
