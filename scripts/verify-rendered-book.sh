#!/usr/bin/env bash
# verify-rendered-book.sh - Verify rendered book state and screenshots.
#
# Usage:
#   bash scripts/verify-rendered-book.sh <path-to-html> [output-dir]
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/book-browser-shell.sh"

run_verify_wrapper ready "$@"
