# PDF Optimization Reference

Use this reference when a book uses browser-side pagination, generated feature pages, web fonts, or any export path where `networkidle` is unreliable.

## Deterministic Scaffold and Planned Features

For long prose books that still need designed interiors:

1. Keep `manuscript.md`, `book.json`, and `book-plan.json` as the source baseline.
2. Encode supported full-page framework, scorecard, and numbers exhibits in `visuals.featurePages`; do not inject them into generated HTML afterward.
3. Run `scripts/build-html-book.mjs` for parsing, cover/title/TOC, feature placement, page numbers, mobile collapse behavior, browser pagination, and overflow assertions.
4. The renderer places planned exhibits after the chapter containing their anchor source block, preserving every original source block in order.
5. After any plan, CSS, or asset change, rerun the deterministic build, verification, and PDF export. Do not deliver a stale PDF from an earlier plan or HTML build.

## Readiness-Gated Export

Use the readiness-gated exporter when the normal exporter times out, when the book embeds manuscript text in JSON, or when `window.__BOOK_READY` controls pagination:

```bash
bash "$SKILL_DIR/scripts/export-ready-pdf.sh" <path-to-html> [output.pdf] --no-open
```

The shared browser runner serves relative assets, waits for fonts/images and `window.__BOOK_READY`, checks `.text-frame` overflow, then exports with Letter sizing, printed backgrounds, CSS page size, and zero margins.

The runner reuses a local or global Playwright installation, then a versioned persistent cache. It drives an installed Chrome/Chromium when the bundled browser is unavailable and installs into the persistent cache only as the final fallback. Installer output stays quiet on success and prints the useful log tail on failure. To force the installed-browser route while retaining every guard:

```bash
bash "$SKILL_DIR/scripts/export-local-chrome.sh" index.html book.pdf --no-open
```

## Rendered-State Verification

Use rendered text, not static HTML stripping, when JavaScript paginates the book:

```bash
bash "$SKILL_DIR/scripts/verify-rendered-book.sh" index.html
bash "$SKILL_DIR/scripts/inspect-pdf.sh" book.pdf
```

`verify-rendered-book.sh` enables print media before print pagination, waits for explicit readiness, validates allowlisted assets and exact source-block coverage, checks desktop/mobile/print overflow, and captures every fixed page plus every declared feature page. `inspect-pdf.sh` validates every Letter MediaBox, rechecks PDF text parity when companion HTML is available, renders every page, creates contact sheets, and copies the cover, TOC, first body page, feature pages, chapter finals, and final page into a semantic inspection set.
