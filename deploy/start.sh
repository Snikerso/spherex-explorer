#!/usr/bin/env bash
set -euo pipefail
node apps/api/dist/scripts/init-db.js
node apps/api/dist/main.js &
api_pid=$!
nginx -g 'daemon off;' &
web_pid=$!
trap 'kill "$api_pid" "$web_pid" 2>/dev/null || true; wait || true' EXIT
trap 'exit 143' TERM INT
wait -n "$api_pid" "$web_pid"
exit 1
