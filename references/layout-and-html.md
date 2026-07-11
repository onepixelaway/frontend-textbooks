# Layout and HTML

Use semantic HTML and the bundled scaffold for ordinary Markdown prose. Customize manuscript-specific diagrams, figures, tools, and page pacing after the deterministic build.

## Print structure

- Use `@page { size: letter; }`, print backgrounds, and one `.page-inner` per explicit `.page`.
- Keep covers, dividers, plates, figures, tables, tools, and callouts atomic.
- Use measured `.page.text-page` pagination for designed body prose. Overflow creates a new page; it never clips.
- Keep headings with their first paragraph/list. Avoid orphaned captions and short stranded columns.
- Use `.text-short-single`, a stacked layout, or a deliberate closer for short chapter tails.
- Reserve layout space for bottom furniture; never position it over prose.

## Mobile

Collapse multi-column frames to one readable flow. Remove internal fixed-height overflow. Hide repeated pagination-only headers. The screen version must not show desktop Letter sheets slicing continuous prose.

## Exceptions

Use flowing `.chapter-flow` only for a deliberate plain reader, appendix, notes, or bibliography and record the matching plan exception. Mark intentional opener spreads explicitly and record their rationale. Preservation, path safety, page integrity, Letter size, and nonempty PDF text are never waivable.

Read `html-template.md` when changing architecture and `page-base.css` when changing page CSS. Read browser implementation only when modifying verification or export behavior.
