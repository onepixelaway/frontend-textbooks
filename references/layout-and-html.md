# Layout and HTML

Use semantic HTML and the bundled scaffold for ordinary Markdown prose. Customize manuscript-specific diagrams, figures, tools, and page pacing after the deterministic build.

## Print structure

- Use `@page { size: letter; }`, print backgrounds, and one `.page-inner` per explicit `.page`.
- Keep covers, dividers, plates, figures, tables, tools, and callouts atomic.
- Use measured `.page.text-page` pagination for designed body prose. Overflow creates a new page; it never clips.
- Keep headings with their first paragraph/list. Avoid orphaned captions and short stranded columns.
- Let the paginator measure chapter tails: very short tails become `.text-tail`, medium-short tails with natural block boundaries become `.text-stack`, and nearly full pages retain their configured columns. It may rebalance one or two complete blocks from the preceding page.
- Reserve layout space for bottom furniture; never position it over prose.
- Mark custom feature pages with `data-verify-feature`; legacy `.feature-page`, `.scorecard-page`, and `.numbers-page` classes remain discoverable.

## Mobile

Collapse multi-column frames to one readable flow. Remove internal fixed-height overflow. Hide repeated pagination-only headers. The screen version must not show desktop Letter sheets slicing continuous prose.

## Exceptions

Use flowing `.chapter-flow` only for a deliberate plain reader, appendix, notes, or bibliography and record the matching plan exception. Mark intentional opener spreads explicitly and record their rationale. Preservation, path safety, page integrity, Letter size, and nonempty PDF text are never waivable.

Read `html-template.md` when changing architecture and `page-base.css` when changing page CSS. Read browser implementation only when modifying verification or export behavior.
