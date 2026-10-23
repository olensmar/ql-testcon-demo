#!/usr/bin/env bash
# One-time setup: install the agents package, apply the Testkube workflows via MCP,
# pre-pull test images and build a green baseline on main.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

[[ -f "$ROOT/agents/.env" ]] || { echo "create agents/.env from agents/.env.example (Testkube MCP URL + API token, or the CLI backend)"; exit 1; }
command -v gh >/dev/null || { echo "gh CLI not found"; exit 1; }

(cd "$ROOT/agents" && npm ci)
"$ROOT/scripts/prewarm.sh" || echo "prewarm skipped (not on minikube?)"
(cd "$ROOT/agents" && npm run setup -- --run)
