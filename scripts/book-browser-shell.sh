#!/usr/bin/env bash
# Shared shell helpers for Frontend Textbooks browser wrapper scripts.

BOOK_BROWSER_SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

absolute_existing_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "File not found: $path" >&2
    exit 1
  fi
  printf '%s/%s\n' "$(cd "$(dirname "$path")" && pwd)" "$(basename "$path")"
}

absolute_output_path() {
  local path="$1"
  local output_dir
  output_dir=$(dirname "$path")
  mkdir -p "$output_dir"
  printf '%s/%s\n' "$(cd "$output_dir" && pwd)" "$(basename "$path")"
}

open_if_requested() {
  local open_after="$1"
  local path="$2"
  if [[ "$open_after" != "true" ]]; then
    return
  fi
  if command -v open >/dev/null 2>&1; then
    open "$path"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$path"
  fi
}

run_export_wrapper() {
  local wait_mode="$1"
  local success_message="$2"
  shift 2

  local open_after=true
  local positional=()
  local arg
  for arg in "$@"; do
    case "$arg" in
      --no-open) open_after=false ;;
      *) positional+=("$arg") ;;
    esac
  done

  if [[ ${#positional[@]} -lt 1 ]]; then
    echo "Usage: bash scripts/$(basename "$0") <path-to-html> [output.pdf] [--no-open]" >&2
    exit 1
  fi

  local input_html output_pdf
  input_html=$(absolute_existing_file "${positional[0]}")
  if [[ ${#positional[@]} -ge 2 ]]; then
    output_pdf="${positional[1]}"
  else
    output_pdf="$(dirname "$input_html")/$(basename "$input_html" .html).pdf"
  fi
  output_pdf=$(absolute_output_path "$output_pdf")

  "$BOOK_BROWSER_SCRIPT_DIR/run-book-browser.sh" export --html "$input_html" --pdf "$output_pdf" --wait "$wait_mode"

  echo ""
  echo "$success_message: $output_pdf"
  echo "Size: $(du -h "$output_pdf" | awk '{print $1}')"

  open_if_requested "$open_after" "$output_pdf"
}

run_verify_wrapper() {
  local wait_mode="$1"
  shift

  if [[ $# -lt 1 ]]; then
    echo "Usage: bash scripts/$(basename "$0") <path-to-html> [output-dir]" >&2
    exit 1
  fi

  local input_html output_dir
  input_html=$(absolute_existing_file "$1")
  output_dir="${2:-$(dirname "$input_html")/.verification}"
  mkdir -p "$output_dir"
  output_dir=$(cd "$output_dir" && pwd)

  "$BOOK_BROWSER_SCRIPT_DIR/run-book-browser.sh" verify --html "$input_html" --output-dir "$output_dir" --wait "$wait_mode"
}
