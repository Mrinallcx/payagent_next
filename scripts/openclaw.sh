#!/usr/bin/env bash
# Run OpenClaw with Node 22 on PATH (OpenClaw requires Node >= 22; nvm may have 20).
# Usage: ./scripts/openclaw.sh status | ./scripts/openclaw.sh gateway probe
NODE22="/opt/homebrew/opt/node@22/bin"
if [[ -d "$NODE22" ]]; then
  export PATH="$NODE22:$PATH"
fi
exec openclaw "$@"
