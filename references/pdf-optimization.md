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
bash scripts/export-ready-pdf.sh <path-to-html> [output.pdf] --no-open
```

The shared browser runner serves relative assets, waits for fonts/images and `window.__BOOK_READY`, checks `.text-frame` overflow, then exports with Letter sizing, printed backgrounds, CSS page size, and zero margins.

## Rendered-State Verification

Use rendered text, not static HTML stripping, when JavaScript paginates the book:

```bash
bash scripts/verify-rendered-book.sh index.html
bash scripts/inspect-pdf.sh book.pdf
```

`verify-rendered-book.sh` records `document.body.innerText` after readiness, checks overflow, and captures desktop/mobile screenshots plus feature pages. `inspect-pdf.sh` uses `pdfinfo` when available, macOS metadata when available, a PDF byte fallback for page count/MediaBox, and `pdftoppm` or `sips` for cover rendering.
