#!/usr/bin/env bash
# export-local-chrome.sh - Export through an installed Chrome/Chromium with all normal guards.
#
# Usage:
#   bash scripts/export-local-chrome.sh <path-to-html> [output.pdf] [--no-open]
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/book-browser-shell.sh"

export FRONTEND_TEXTBOOKS_PREFER_SYSTEM_CHROME=1
run_export_wrapper ready "PDF exported with local Chrome" "$@"
