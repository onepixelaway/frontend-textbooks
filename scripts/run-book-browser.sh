#!/usr/bin/env bash
# run-book-browser.sh - Internal launcher for the pinned local browser toolchain.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: scripts/run-book-browser.sh <book-browser args...>" >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SKILL_DIR=$(cd "$SCRIPT_DIR/.." && pwd)

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but not installed." >&2
  exit 1
fi

NODE_MAJOR=$(node -p 'Number(process.versions.node.split(".")[0])')
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "Node.js 20 or newer is required (found $(node --version))." >&2
  exit 1
fi

if [[ ! -d "$SKILL_DIR/node_modules/playwright" ]]; then
  echo "Pinned dependencies are not installed in $SKILL_DIR." >&2
  echo "Run: cd \"$SKILL_DIR\" && npm ci && npm run setup:browsers" >&2
  exit 1
fi

exec node "$SCRIPT_DIR/book-browser.mjs" "$@"
