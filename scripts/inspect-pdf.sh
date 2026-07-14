#!/usr/bin/env bash
# inspect-pdf.sh - Validate and render every page of a generated PDF.
#
# Usage:
#   bash scripts/inspect-pdf.sh <path-to-pdf> [output-dir] [companion-html]
#
# Validates every page's size and renders every page to PNG for visual inspection.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/inspect-pdf.sh <path-to-pdf> [output-dir] [companion-html]" >&2
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
STRUCTURE_REPORT="$OUTPUT_DIR/pdf-structure.json"
STRUCTURE_ARGS=("$PDF_PATH" --report "$STRUCTURE_REPORT")
PDF_DIR=$(dirname "$PDF_PATH")
if [[ ${3:-} != "" ]]; then
  STRUCTURE_ARGS+=(--html "$3")
elif [[ -f "$PDF_DIR/book-build-manifest.json" ]]; then
  STRUCTURE_ARGS+=(--manifest "$PDF_DIR/book-build-manifest.json")
elif [[ -f "$PDF_DIR/index.html" ]]; then
  STRUCTURE_ARGS+=(--html "$PDF_DIR/index.html")
fi

PAGE_COUNT=$(node "$SCRIPT_DIR/lib/pdf-structure.mjs" "${STRUCTURE_ARGS[@]}" --render "$OUTPUT_DIR/pdf-page")
# pdf-structure.mjs owns canonical page discovery, stale cleanup, Poppler
# padding normalization, and completeness validation. Do not repeat those
# rules here with a broader filename glob.

bash "$SCRIPT_DIR/run-book-browser.sh" contact-sheet --input-dir "$OUTPUT_DIR" --output "$OUTPUT_DIR/contact-sheet.png" >/dev/null
RENDER_REPORT=""
for candidate in "$PDF_DIR/.verification/render-report.json" "$PDF_DIR/verification/render-report.json"; do
  if [[ -f "$candidate" ]]; then
    RENDER_REPORT="$candidate"
    break
  fi
done
INSPECTION_ARGS=(--pdf "$PDF_PATH" --pages-dir "$OUTPUT_DIR" --structure "$STRUCTURE_REPORT")
if [[ -n "$RENDER_REPORT" ]]; then
  INSPECTION_ARGS+=(--render-report "$RENDER_REPORT")
fi
node "$SCRIPT_DIR/pdf-inspection.mjs" "${INSPECTION_ARGS[@]}" >/dev/null

echo "Pages: $PAGE_COUNT"
echo "Page size: Letter"
echo "Rendered every page and contact sheet under: $OUTPUT_DIR"
