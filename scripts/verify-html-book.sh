#!/usr/bin/env bash
# verify-html-book.sh - Verify a Frontend Textbooks HTML artifact.
#
# Usage:
#   bash scripts/verify-html-book.sh <path-to-html> [output-dir]
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/book-browser-shell.sh"

run_verify_wrapper networkidle "$@"
