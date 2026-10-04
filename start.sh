#!/bin/sh
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null || { echo "Install Node.js 22+ first: https://nodejs.org"; exit 1; }
node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)' || exit 1
nohup node scripts/codex-connector.mjs > connector.log 2>&1 &
sleep 1
if command -v open >/dev/null; then open http://127.0.0.1:4379/; elif command -v xdg-open >/dev/null; then xdg-open http://127.0.0.1:4379/; else echo "Open http://127.0.0.1:4379/"; fi
