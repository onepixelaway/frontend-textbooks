# Layout and HTML

Use semantic HTML and the bundled scaffold for ordinary Markdown prose. Express supported manuscript-specific diagrams and full-page exhibits in `book-plan.json`; do not patch generated HTML after the deterministic build.

## Print structure

- Use `@page { size: letter; }`, print backgrounds, and one `.page-inner` per explicit `.page`.
- Keep covers, dividers, plates, figures, tables, tools, and callouts atomic.
- Use measured `.page.text-page` pagination for designed body prose. Overflow creates a new page; it never clips.
- Keep headings with their first paragraph/list. Avoid orphaned captions and short stranded columns.
- Let the paginator measure chapter tails: very short tails become `.text-tail`, medium-short tails with natural block boundaries become `.text-stack`, and nearly full pages retain their configured columns. It may rebalance one or two complete blocks from the preceding page.
- Reserve layout space for bottom furniture; never position it over prose.
- Planned `framework`, `scorecard`, and `numbers` exhibits render as atomic `.feature-page` sheets with `data-verify-feature`, explicit grounding IDs, semantic reading order, and responsive mobile collapse. Legacy custom feature classes remain discoverable, but supported feature content belongs in `visuals.featurePages`.

## Mobile

Collapse multi-column frames to one readable flow. Remove internal fixed-height overflow. Hide repeated pagination-only headers. Browser-only controls use normal document flow on mobile and may never occlude manuscript text at any scroll position. The screen version must not show desktop Letter sheets slicing continuous prose.

## Exceptions

Use flowing `.chapter-flow` only for a deliberate plain reader, appendix, notes, or bibliography and record the matching plan exception. Mark intentional opener spreads explicitly and record their rationale. Preservation, path safety, page integrity, Letter size, and nonempty PDF text are never waivable.

Read `html-template.md` when changing architecture and `page-base.css` when changing page CSS. Read browser implementation only when modifying verification or export behavior.
