#!/usr/bin/env bash
# run-book-browser.sh - Resolve a reusable Playwright/browser toolchain and run it.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: scripts/run-book-browser.sh <book-browser args...>" >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SKILL_DIR=$(cd "$SCRIPT_DIR/.." && pwd)

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but not installed." >&2
  exit 1
fi

NODE_MAJOR=$(node -p 'Number(process.versions.node.split(".")[0])')
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "Node.js 20 or newer is required (found $(node --version))." >&2
  exit 1
fi

PLAYWRIGHT_VERSION=$(node -e 'const fs=require("fs"); const pkg=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(pkg.dependencies.playwright)' "$SKILL_DIR/package.json")
CACHE_ROOT=${FRONTEND_TEXTBOOKS_CACHE_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/frontend-textbooks}
CACHE_DIR="$CACHE_ROOT/playwright-$PLAYWRIGHT_VERSION"
CACHE_PACKAGE="$CACHE_DIR/node_modules/playwright"
LOCAL_PLAYWRIGHT_PACKAGE=${FRONTEND_TEXTBOOKS_LOCAL_PLAYWRIGHT_PACKAGE-"$SKILL_DIR/node_modules/playwright"}
REQUESTED_PLAYWRIGHT_PACKAGE=${FRONTEND_TEXTBOOKS_PLAYWRIGHT_PACKAGE:-}

find_system_chrome() {
  local candidate
  if [[ "${FRONTEND_TEXTBOOKS_DISABLE_SYSTEM_CHROME:-0}" == "1" ]]; then
    return 1
  fi
  for candidate in \
    "${FRONTEND_TEXTBOOKS_CHROME_EXECUTABLE:-}" \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "/usr/bin/google-chrome" \
    "/usr/bin/google-chrome-stable" \
    "/usr/bin/chromium" \
    "/usr/bin/chromium-browser"; do
    if [[ -n "$candidate" && -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "$candidate" >/dev/null 2>&1; then
      command -v "$candidate"
      return 0
    fi
  done
  return 1
}

install_with_log() {
  local label="$1"
  shift
  local log_file status timeout_seconds
  timeout_seconds=${FRONTEND_TEXTBOOKS_INSTALL_TIMEOUT_SECONDS:-600}
  log_file=$(mktemp "${TMPDIR:-/tmp}/frontend-textbooks-install.XXXXXX")
  if node "$SCRIPT_DIR/lib/run-with-timeout.mjs" --timeout-seconds "$timeout_seconds" -- "$@" >"$log_file" 2>&1; then
    rm -f "$log_file"
    return 0
  else
    status=$?
  fi
  if [[ "$status" -eq 124 ]]; then
    echo "$label timed out after ${timeout_seconds}s. Last installer output:" >&2
  else
    echo "$label failed. Last installer output:" >&2
  fi
  tail -n 80 "$log_file" >&2
  rm -f "$log_file"
  return 1
}

probe_playwright_package() {
  local candidate="$1"
  local browsers_path="${2:-}"
  local probe
  if [[ ! -d "$candidate" ]]; then
    return 1
  fi
  if [[ -n "$browsers_path" ]]; then
    probe=$(PLAYWRIGHT_BROWSERS_PATH="$browsers_path" node --input-type=module -e '
      import { readFileSync } from "node:fs";
      import { join, resolve } from "node:path";
      import { pathToFileURL } from "node:url";
      const directory = resolve(process.argv[1]);
      const metadata = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
      const playwright = await import(pathToFileURL(join(directory, "index.mjs")).href);
      if (!playwright.chromium || typeof playwright.chromium.executablePath !== "function") process.exit(2);
      let executable = "";
      try { executable = playwright.chromium.executablePath() || ""; } catch {}
      process.stdout.write(`${metadata.version || ""}\t${executable}`);
    ' "$candidate" 2>/dev/null) || return 1
  else
    probe=$(node --input-type=module -e '
      import { readFileSync } from "node:fs";
      import { join, resolve } from "node:path";
      import { pathToFileURL } from "node:url";
      const directory = resolve(process.argv[1]);
      const metadata = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
      const playwright = await import(pathToFileURL(join(directory, "index.mjs")).href);
      if (!playwright.chromium || typeof playwright.chromium.executablePath !== "function") process.exit(2);
      let executable = "";
      try { executable = playwright.chromium.executablePath() || ""; } catch {}
      process.stdout.write(`${metadata.version || ""}\t${executable}`);
    ' "$candidate" 2>/dev/null) || return 1
  fi
  IFS=$'\t' read -r PROBED_VERSION PROBED_BROWSER <<< "$probe"
  [[ "$PROBED_VERSION" == "$PLAYWRIGHT_VERSION" ]]
}

select_runnable_package() {
  local candidate="$1"
  local browsers_path="${2:-}"
  if ! probe_playwright_package "$candidate" "$browsers_path"; then
    return 1
  fi
  if [[ -z "$CHROME_EXECUTABLE" && ( -z "$PROBED_BROWSER" || ! -x "$PROBED_BROWSER" ) ]]; then
    return 1
  fi
  PLAYWRIGHT_PACKAGE="$candidate"
  BUNDLED_BROWSER=""
  if [[ -n "$PROBED_BROWSER" && -x "$PROBED_BROWSER" ]]; then
    BUNDLED_BROWSER="$PROBED_BROWSER"
  fi
  return 0
}

CHROME_EXECUTABLE=$(find_system_chrome || true)
PLAYWRIGHT_PACKAGE=""
BUNDLED_BROWSER=""
PROBED_VERSION=""
PROBED_BROWSER=""

select_runnable_package "$LOCAL_PLAYWRIGHT_PACKAGE" || true
if [[ -z "$PLAYWRIGHT_PACKAGE" && -n "$REQUESTED_PLAYWRIGHT_PACKAGE" ]]; then
  select_runnable_package "$REQUESTED_PLAYWRIGHT_PACKAGE" || true
fi
if [[ -z "$PLAYWRIGHT_PACKAGE" ]]; then
  GLOBAL_NODE_MODULES=$(npm root -g || true)
  if [[ -n "$GLOBAL_NODE_MODULES" && -d "$GLOBAL_NODE_MODULES/playwright" ]]; then
    select_runnable_package "$GLOBAL_NODE_MODULES/playwright" || true
  fi
fi
if [[ -z "$PLAYWRIGHT_PACKAGE" ]] && probe_playwright_package "$CACHE_PACKAGE" "$CACHE_DIR/browsers"; then
  PLAYWRIGHT_PACKAGE="$CACHE_PACKAGE"
  if [[ -n "$PROBED_BROWSER" && -x "$PROBED_BROWSER" ]]; then
    BUNDLED_BROWSER="$PROBED_BROWSER"
  fi
fi

if [[ -z "$PLAYWRIGHT_PACKAGE" ]]; then
  mkdir -p "$CACHE_DIR"
  install_with_log "Persistent Playwright package installation" \
    env PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --prefix "$CACHE_DIR" --no-save --no-package-lock "playwright@$PLAYWRIGHT_VERSION"
  if ! probe_playwright_package "$CACHE_PACKAGE" "$CACHE_DIR/browsers"; then
    echo "Persistent Playwright package installation did not produce Playwright $PLAYWRIGHT_VERSION." >&2
    exit 1
  fi
  PLAYWRIGHT_PACKAGE="$CACHE_PACKAGE"
fi

if [[ "$PLAYWRIGHT_PACKAGE" == "$CACHE_PACKAGE" ]]; then
  export PLAYWRIGHT_BROWSERS_PATH="$CACHE_DIR/browsers"
  if [[ -z "$CHROME_EXECUTABLE" && ( -z "$PROBED_BROWSER" || ! -x "$PROBED_BROWSER" ) ]]; then
    mkdir -p "$PLAYWRIGHT_BROWSERS_PATH"
    install_with_log "Persistent Chromium installation" \
      node "$PLAYWRIGHT_PACKAGE/cli.js" install chromium
    if ! probe_playwright_package "$PLAYWRIGHT_PACKAGE" "$PLAYWRIGHT_BROWSERS_PATH" || [[ -z "$PROBED_BROWSER" || ! -x "$PROBED_BROWSER" ]]; then
      echo "Persistent Chromium installation completed without a runnable Chromium executable." >&2
      exit 1
    fi
  fi
  if [[ -n "$PROBED_BROWSER" && -x "$PROBED_BROWSER" ]]; then
    BUNDLED_BROWSER="$PROBED_BROWSER"
  fi
fi

export FRONTEND_TEXTBOOKS_PLAYWRIGHT_PACKAGE="$PLAYWRIGHT_PACKAGE"
export FRONTEND_TEXTBOOKS_PLAYWRIGHT_BUNDLED_EXECUTABLE="$BUNDLED_BROWSER"
if [[ -n "$CHROME_EXECUTABLE" ]]; then
  export FRONTEND_TEXTBOOKS_CHROME_EXECUTABLE="$CHROME_EXECUTABLE"
fi

if [[ "$1" == "contact-sheet" ]]; then
  shift
  exec node "$SCRIPT_DIR/create-contact-sheet.mjs" "$@"
fi
exec node "$SCRIPT_DIR/book-browser.mjs" "$@"
