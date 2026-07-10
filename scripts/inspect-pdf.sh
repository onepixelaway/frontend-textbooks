#!/usr/bin/env bash
# inspect-pdf.sh - Validate and render every page of a generated PDF.
#
# Usage:
#   bash scripts/inspect-pdf.sh <path-to-pdf> [output-dir]
#
# Validates every page's size and renders every page to PNG for visual inspection.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/inspect-pdf.sh <path-to-pdf> [output-dir]" >&2
  exit 1
fi

PDF_PATH="$1"
if [[ ! -f "$PDF_PATH" ]]; then
  echo "File not found: $PDF_PATH" >&2
  exit 1
fi

PDF_PATH=$(cd "$(dirname "$PDF_PATH")" && pwd)/$(basename "$PDF_PATH")
OUTPUT_DIR="${2:-$(dirname "$PDF_PATH")/.verification/pdf-pages}"
mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR=$(cd "$OUTPUT_DIR" && pwd)

if [[ "$(head -c 5 "$PDF_PATH")" != "%PDF-" ]]; then
  echo "Invalid PDF: missing %PDF header." >&2
  exit 2
fi

echo "PDF: $PDF_PATH"
echo "Size: $(du -h "$PDF_PATH" | awk '{print $1}')"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to validate every PDF page." >&2
  exit 2
fi
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PAGE_COUNT=$(node "$SCRIPT_DIR/lib/pdf-structure.mjs" "$PDF_PATH")

find "$OUTPUT_DIR" -maxdepth 1 -type f -name 'pdf-page-*.png' -delete
node "$SCRIPT_DIR/lib/pdf-structure.mjs" "$PDF_PATH" --render "$OUTPUT_DIR/pdf-page" >/dev/null
RENDERED_COUNT=$(find "$OUTPUT_DIR" -maxdepth 1 -type f -name 'pdf-page-*.png' | wc -l | tr -d ' ')
if [[ "$RENDERED_COUNT" != "$PAGE_COUNT" ]]; then
  echo "Rendered $RENDERED_COUNT PDF page(s), expected $PAGE_COUNT." >&2
  exit 2
fi

echo "Pages: $PAGE_COUNT"
echo "Page size: Letter"
echo "Rendered every page under: $OUTPUT_DIR"
