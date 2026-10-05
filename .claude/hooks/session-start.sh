#!/bin/bash
# SessionStart hook for Claude Code cloud sessions: installs dependencies and prepares the testing
# Home Assistant instance (Docker daemon + image) so `npm run ha-test -- start` is fast.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo '{"async": true, "asyncTimeout": 900000}'

cd "$CLAUDE_PROJECT_DIR"
npm install --no-audit --no-fund

if command -v dockerd >/dev/null 2>&1; then
  if ! docker info >/dev/null 2>&1; then
    nohup dockerd --storage-driver=vfs >/tmp/dockerd.log 2>&1 &
    for _ in $(seq 1 30); do
      docker info >/dev/null 2>&1 && break
      sleep 1
    done
  fi
  version=$(node -p "require('./src/ha/ha-sync.json').homeAssistantVersion")
  docker pull "ghcr.io/home-assistant/home-assistant:${version}" || echo "ha-test: image pull failed (network access to ghcr.io / pkg-containers.githubusercontent.com?)"
fi
