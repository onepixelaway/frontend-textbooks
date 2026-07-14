# PDF Optimization Reference

Use this reference when a book uses browser-side pagination, generated feature pages, web fonts, or any export path where `networkidle` is unreliable.

## Scaffold-Plus-Enhancement

For long prose books that still need designed interiors:

1. Keep `manuscript.md` and `book.json` as the source baseline.
2. Run `scripts/build-html-book.mjs` for parsing, cover/title/TOC, page numbers, mobile collapse behavior, browser pagination, and overflow assertions.
3. Add a deterministic enhancement script that reruns after the scaffold and injects manuscript-specific CSS/pages: image plates, canvases, model cards, anatomy pages, taxonomy maps, cover-option boards, and route-specific cover refinements.
4. Place feature pages after natural chapter mounts or part boundaries so the browser paginator can still create body pages safely.
5. After any HTML/CSS/asset change, rerun the scaffold, rerun the enhancement, rerun verification, and re-export the PDF. Do not deliver a stale PDF from an earlier HTML build.

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
