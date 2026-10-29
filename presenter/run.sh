#!/usr/bin/env bash
# Start the deck with the live terminal docked under the demo slides.
#   presenter/run.sh          # http://localhost:4173
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -d node_modules ]]; then
  echo "Installing npm dependencies (one-time, needs network)..."
  npm ci
fi

# node-pty's spawn-helper needs the exec bit, or spawns fail with "posix_spawnp failed"
for h in node_modules/node-pty/prebuilds/*/spawn-helper; do
  [[ -f "$h" ]] && chmod +x "$h"
done

PORT="${PORT:-4173}"
node server.js &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT

sleep 1
if command -v open >/dev/null 2>&1; then
  open "http://localhost:${PORT}"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:${PORT}" >/dev/null 2>&1 || true
fi

wait $SERVER_PID
