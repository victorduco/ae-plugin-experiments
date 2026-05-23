#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PORT=3131

# Kill any existing instance
kill $(lsof -ti:$PORT) 2>/dev/null || true
sleep 0.3

# Start server in background
node "$ROOT_DIR/src/web-ui/server.js" &
SERVER_PID=$!

sleep 0.8

echo "UI running at http://localhost:$PORT (pid $SERVER_PID)"

# Keep alive
wait $SERVER_PID
