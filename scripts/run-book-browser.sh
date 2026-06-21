#!/usr/bin/env bash
# run-book-browser.sh - Internal launcher for book-browser.mjs with temp Playwright.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: scripts/run-book-browser.sh <book-browser args...>" >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but not installed." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but not installed." >&2
  exit 1
fi

TEMP_DIR=$(mktemp -d)
cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

cp "$SCRIPT_DIR/book-browser.mjs" "$TEMP_DIR/book-browser.mjs"
cat > "$TEMP_DIR/package.json" <<'PKG'
{ "name": "frontend-textbooks-book-browser", "private": true, "type": "module" }
PKG

(
  cd "$TEMP_DIR"
  npm install playwright >/dev/null 2>&1
  npx playwright install chromium >/dev/null 2>&1
  node "$TEMP_DIR/book-browser.mjs" "$@"
)
