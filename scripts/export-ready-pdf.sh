#!/usr/bin/env bash
# export-ready-pdf.sh - Export a Letter PDF after browser-side book readiness.
#
# Usage:
#   bash scripts/export-ready-pdf.sh <path-to-html> [output.pdf] [--no-open]
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/book-browser-shell.sh"

run_export_wrapper ready "PDF exported after readiness checks" "$@"
