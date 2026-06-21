#!/usr/bin/env bash
# export-pdf.sh - Export a Frontend Textbooks HTML book to Letter-size PDF.
#
# Usage:
#   bash scripts/export-pdf.sh <path-to-html> [output.pdf] [--no-open]
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/book-browser-shell.sh"

run_export_wrapper networkidle "PDF exported" "$@"
