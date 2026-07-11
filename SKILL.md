---
name: frontend-textbooks
description: Create designed US Letter HTML textbooks, manuals, field guides, business books, and coffee-table books from supplied manuscripts, then verify and export matching PDFs. Use for new manuscript-to-book work, existing HTML book enhancement, print/mobile layout repair, manuscript-preserving diagrams or editorial imagery, and final book production.
---

# Frontend Textbooks

Turn a manuscript into a real book: editable HTML, a Letter PDF, cover options, verified assets, and evidence of manuscript preservation.

## Resolve the Skill

Set the path once; keep project inputs and outputs in the user's workspace:

```bash
SKILL_DIR="<absolute path to the directory containing this SKILL.md>"
```

Run bundled commands through `node "$SKILL_DIR/scripts/book-pipeline.mjs"`.

## Ownership Boundary

Scripts own deterministic work: parsing, stable source IDs, schemas, path safety, hashes, pagination measurements, diagnostics, screenshots, PDF export/inspection, caching, and manifests.

The model owns judgment: audience and genre, semantic classifications, theme/layout rationale, diagram and image choices, exception rationales, targeted repair decisions, and aesthetic approval. Express those decisions only through the JSON contracts; do not encode them in prose for a script to interpret.

## Non-Negotiables

- Preserve at least 90% of the manuscript unless the user explicitly requests abridgment. Preserve order, examples, tone, and vocabulary; additive tools never replace source prose.
- Produce HTML and PDF from the same source. Use US Letter, atomic designed pages, readable mobile flow, and no clipped content.
- Make the result feel like a book, not a printed article or slide deck. Include appropriate front matter, page hierarchy, captions, running furniture, diagrams, and visual rhythm.
- Keep production language out of reader-facing pages. Do not mention HTML, PDF export, Codex, AI, the skill, or a supplied manuscript inside the book unless requested.
- Use distinct cover and part-divider assets. Never reuse cover art as an interior plate. Do not fabricate visual evidence.
- Keep remote fonts off by default. Set `fontMode: "remote"` only with a recorded `allow-remote-fonts` plan exception.

## Default Workflow

### 1. Prepare inputs

Create `book.json` and retain the source manuscript as Markdown. Author and title are required. Use the default `colbalt` theme unless the user names a registered theme or gives a clear visual direction.

Generate the stable source inventory:

```bash
node "$SKILL_DIR/scripts/book-pipeline.mjs" inventory \
  --config book.json --manuscript manuscript.md
```

### 2. Make the model plan

Read the manuscript and `planning-inventory.json`. Emit only schema-valid `book-plan.json` using `schemas/book-plan.schema.json`. Classify only salient blocks; unlisted blocks remain ordinary prose. Ground every classification and diagram in stable source IDs. Record every policy waiver in `exceptions` with a concrete rationale.

Read [references/reasoning-contracts.md](references/reasoning-contracts.md) when creating a plan, responding to repair tasks, or issuing an aesthetic verdict.

### 3. Build and verify at the right tier

Use one public command surface:

```bash
# Contract, source, asset, and deterministic build checks; no browser.
node "$SKILL_DIR/scripts/book-pipeline.mjs" build \
  --config book.json --manuscript manuscript.md --plan book-plan.json --tier fast

# Desktop/print/mobile verification and one contact sheet; no PDF.
node "$SKILL_DIR/scripts/book-pipeline.mjs" verify \
  --config book.json --manuscript manuscript.md --plan book-plan.json --tier affected

# Normal completion: verify, contact sheet, PDF, inspection, final manifest.
node "$SKILL_DIR/scripts/book-pipeline.mjs" finalize \
  --config book.json --manuscript manuscript.md --plan book-plan.json --tier full
```

Unchanged inputs reuse content-hashed results. Use `--force true` only when testing toolchain changes or invalidating a suspected cache error.

### 4. Handle targeted repairs

On failure, read `.verification/repair-tasks.json`, its bounded source context, referenced screenshots, and only the named plan selections. Return `repair-actions.json` matching `schemas/repair-actions.schema.json`, validate it with `node "$SKILL_DIR/scripts/book-contract.mjs" validate-repairs .verification/repair-tasks.json repair-actions.json`, then make only the validated scoped change. Do not reload the full manuscript or full render report unless the repair packet is insufficient.

Use `.verification/diagnostics.json` for exact codes and measurements. Full evidence stays on disk; keep chat and command output compact.

### 5. Perform the visual judgment

When finalization returns `review-required`, read `.verification/aesthetic-review-request.json`, inspect every listed contact-sheet chunk and every listed mobile evidence image, and then inspect only the weakest full-size screenshots. Emit only `aesthetic-review.json` matching `schemas/aesthetic-review.schema.json`; copy the exact request and aggregate contact-sheet hashes. A `revise` verdict requires repairs. A `pass` verdict must reflect actual cover hierarchy, page rhythm, typography, diagram clarity, whitespace, cohesion, and mobile reading.

Resume without rerendering unchanged work:

```bash
node "$SKILL_DIR/scripts/book-pipeline.mjs" finalize \
  --config book.json --manuscript manuscript.md --plan book-plan.json \
  --tier full --aesthetic-review aesthetic-review.json
```

### 6. Deliver

Deliver the HTML, PDF, approximate page count, preservation percentage, and any material caveats. A complete run must have `artifact-manifest.json` with passing full verification and, when required, a passing aesthetic review.

## Design Decisions

- Start chapters with actual prose, not unrequested opener spreads.
- Use measured `.page.text-page` layouts for designed prose. Two columns suit analytical reading; one column suits slow emphasis; three columns suit short modular material.
- Add 2–4 manuscript-grounded diagrams or tools for designed nonfiction when relationships exist. Use comparison, sequence, hierarchy, anatomy, taxonomy, matrix, or system grammar that matches the idea.
- Use generated images for manuscript-grounded atmosphere or editorial art when useful and available. The active theme module is the sole source of its image prompt template.
- Treat short tail pages, sparse tools, and 4–6 item grids as deliberate compositions, not leftover blank space.
- Create distinct cover routes for visually led work and keep the selected route aligned with the final cover.

Read only the reference needed for the current decision:

- [references/intake-and-planning.md](references/intake-and-planning.md): intake defaults, content architecture, image policy, cover planning.
- [references/visual-system.md](references/visual-system.md): diagram grammar, signature tools, imagery, page rhythm, cover quality.
- [references/layout-and-html.md](references/layout-and-html.md): HTML architecture, measured pagination, atomic print CSS, mobile behavior.
- [references/verification-gates.md](references/verification-gates.md): diagnostics, preservation, visual/PDF gates, delivery requirements.
- [references/reasoning-contracts.md](references/reasoning-contracts.md): strict plan, repair, exception, and aesthetic JSON contracts.
- [references/iteration.md](references/iteration.md): incremental tiers, delta context, cache invalidation, and compact reporting.

Do not read `STYLE_PRESETS.md`, `html-template.md`, `page-base.css`, browser internals, or all references by default. Read them only when changing the corresponding style, architecture, CSS, or tool implementation.
