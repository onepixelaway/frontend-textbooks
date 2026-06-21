#!/usr/bin/env bash
# inspect-pdf.sh - Inspect a generated PDF with Poppler or platform fallbacks.
#
# Usage:
#   bash scripts/inspect-pdf.sh <path-to-pdf> [output-dir]
#
# Reports page count/size when tooling is available and renders a cover PNG
# for quick visual inspection.
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

run_pdf_byte_fallback() {
  python3 - "$PDF_PATH" <<'PY'
import re
import sys
from pathlib import Path

data = Path(sys.argv[1]).read_bytes()
page_count = len(re.findall(rb"/Type\s*/Page\b", data))
media_box = re.search(rb"/MediaBox\s*\[\s*([-0-9.]+)\s+([-0-9.]+)\s+([-0-9.]+)\s+([-0-9.]+)\s*\]", data)

print(f"Estimated pages = {page_count if page_count else 'unknown'}")
if media_box:
    x0, y0, x1, y1 = [float(value) for value in media_box.groups()]
    print(f"First MediaBox = {x0:g} {y0:g} {x1:g} {y1:g}")
    print(f"Estimated page size = {x1 - x0:g} x {y1 - y0:g} pt")
else:
    print("First MediaBox = unknown")
PY
}

echo "PDF: $PDF_PATH"
echo "Size: $(du -h "$PDF_PATH" | awk '{print $1}')"
file "$PDF_PATH" || true

if command -v pdfinfo >/dev/null 2>&1; then
  echo ""
  echo "pdfinfo:"
  pdfinfo "$PDF_PATH" | sed -n '1,40p'
elif command -v mdls >/dev/null 2>&1; then
  echo ""
  echo "macOS metadata:"
  MDLS_OUTPUT=$(mdls -name kMDItemNumberOfPages -name kMDItemPageHeight -name kMDItemPageWidth "$PDF_PATH" 2>/dev/null || true)
  echo "$MDLS_OUTPUT"
  if echo "$MDLS_OUTPUT" | grep -q "(null)"; then
    echo ""
    echo "PDF byte fallback:"
    run_pdf_byte_fallback || true
  fi
else
  echo ""
  echo "PDF byte fallback:"
  run_pdf_byte_fallback || {
    echo "No pdfinfo, mdls, or python3 available for page count/size metadata." >&2
  }
fi

if command -v pdftoppm >/dev/null 2>&1; then
  pdftoppm -f 1 -l 1 -png "$PDF_PATH" "$OUTPUT_DIR/pdf-cover" >/dev/null
  echo ""
  echo "Rendered cover: $OUTPUT_DIR/pdf-cover-1.png"
elif command -v sips >/dev/null 2>&1; then
  sips -s format png "$PDF_PATH" --out "$OUTPUT_DIR/pdf-cover.png" >/dev/null
  echo ""
  echo "Rendered cover: $OUTPUT_DIR/pdf-cover.png"
else
  echo ""
  echo "No pdftoppm or sips available for cover rendering." >&2
fi
