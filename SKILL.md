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

The model owns judgment: audience and genre, user-facing color-scheme recommendations, semantic classifications, theme/layout rationale, diagram, feature-page, and image choices, exception rationales, targeted repair decisions, and aesthetic approval. Express production decisions through the JSON contracts; do not encode them in prose for a script to interpret.

## Non-Negotiables

- Preserve at least 90% of the manuscript unless the user explicitly requests abridgment. Preserve order, examples, tone, and vocabulary; additive tools never replace source prose.
- Generate one original, manuscript-grounded local bitmap for every cover. It is mandatory, has no waiver, contains no baked-in typography, and may not be reused inside the book. A gradient, generic shape, SVG, stock placeholder, remote URL, or prior book's image is not cover artwork.
- Produce HTML and PDF from the same source. Use US Letter, atomic designed pages, readable mobile flow, and no clipped content.
- Make the result feel like a book, not a printed article or slide deck. Include appropriate front matter, page hierarchy, captions, running furniture, diagrams, and visual rhythm.
- Keep production language out of reader-facing pages. Do not mention HTML, PDF export, Codex, AI, the skill, or a supplied manuscript inside the book unless requested.
- Use distinct cover and part-divider assets. Never reuse cover art as an interior plate. Do not fabricate visual evidence.
- Keep remote fonts off by default. Set `fontMode: "remote"` only with a recorded `allow-remote-fonts` plan exception.

## Default Workflow

### 1. Prepare inputs

Create `book.json` and retain the source manuscript as Markdown. Author, title, and a config-relative `coverImage` target inside `outputDir` are required. Relative paths always resolve from the directory containing `book.json`. Leave `style` and `themeOverrides` unresolved until the color-scheme decision in step 2.

Treat H1 as book metadata, H2 as chapters, and H3/H4 as interior sections. Use `### Chapter title {chapter}` only when an H3 must explicitly start a chapter; empty chapters are invalid. Use `themeOverrides` for validated palette adaptations. Set `selectedCoverRoute` to `photo` or `minimal`; the same route drives the option and final cover.

Generate the stable source inventory:

```bash
node "$SKILL_DIR/scripts/book-pipeline.mjs" inventory \
  --config book.json --manuscript manuscript.md
```

### 2. Choose the color scheme with the user

After reading the manuscript and `planning-inventory.json`, present three numbered color-scheme choices grounded in its subject, tone, audience, and cultural context. Mark one as Recommended and explain the content connection in one sentence. Give each option a short name and representative role-based hex swatches; include any palette the user already requested as a choice. Ask which scheme they want, allow a different direction, and wait for the user's answer. Do not plan, generate artwork, or build while this decision is unresolved.

Record the answer in `book.json`: a registered base theme in `style` and validated semantic colors in `themeOverrides`. Keep the recommendation rationale in `book-plan.json` under `theme.rationale`; do not create a second palette source of truth. Read [references/intake-and-planning.md](references/intake-and-planning.md) for the compact question format and palette rules.

### 3. Make the model plan

Read the manuscript and `planning-inventory.json`. Emit only schema-valid `book-plan.json` using `schemas/book-plan.schema.json`. Classify only salient blocks; unlisted blocks remain ordinary prose. Ground every classification, diagram, and feature page in stable source IDs. For designed nonfiction, plan 2–4 skim-worthy `visuals.featurePages` when the source supports them; at least one is required unless `waive-feature-pages` explains why the manuscript cannot support one. Record every policy waiver in `exceptions` with a concrete rationale.

Read [references/reasoning-contracts.md](references/reasoning-contracts.md) when creating a plan, responding to repair tasks, or issuing an aesthetic verdict.

### 4. Generate the required cover artwork

The plan must contain a grounded `visuals.cover` decision. Prepare the canonical request before generating anything:

```bash
node "$SKILL_DIR/scripts/prepare-cover-image.mjs" \
  book.json manuscript.md book-plan.json
```

When preparation returns `cover-generation-required`, read `cover-image-request.json`, call the available image-generation tool with its exact `prompt`, and save the result at its exact `targetAsset`. Do not rewrite the theme prompt or substitute supplied, stock, generic, or previously generated art. An occupied target without current matching provenance fails closed; `cover-ready` means the exact current request, receipt, and bytes were already revalidated. Then bind a newly generated bitmap to this manuscript and request:

```bash
node "$SKILL_DIR/scripts/record-cover-image.mjs" \
  book.json manuscript.md book-plan.json
```

If image generation is unavailable or fails, stop and report that cover generation is required. Never continue with an artwork-free or decorative-only fallback. The scripts reject missing, remote, escaping, corrupt, generic-alt, low-resolution, stale, and reused assets; the minimum effective cover resolution is 150 DPI in the actual configured crop (8.5 × 7.45 inches with the default cover band).

### 5. Build and verify at the right tier

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

### 6. Handle targeted repairs

On failure, read `.verification/repair-tasks.json`, its bounded source context, referenced screenshots, and only the named plan selections. Return `repair-actions.json` matching `schemas/repair-actions.schema.json`, validate it with `node "$SKILL_DIR/scripts/book-contract.mjs" validate-repairs .verification/repair-tasks.json repair-actions.json`, then make only the validated scoped change. Do not reload the full manuscript or full render report unless the repair packet is insufficient.

Use `.verification/diagnostics.json` for exact codes and measurements. Full evidence stays on disk; keep chat and command output compact.

### 7. Perform the visual judgment

When finalization returns `review-required`, read `.verification/aesthetic-review-request.json`, inspect its full-page final cover, cover thumbnail/contact sheet, mobile cover, every planned feature-page screenshot at desktop and mobile sizes, every listed contact-sheet chunk, and every listed mobile evidence image, then inspect only the weakest full-size screenshots. Emit only `aesthetic-review.json` matching `schemas/aesthetic-review.schema.json`; copy the exact request and aggregate contact-sheet hashes. A `revise` verdict requires repairs. A `pass` verdict must reflect the actual hashed cover asset and route, cover hierarchy and crop, page rhythm, typography, feature-page and diagram clarity, whitespace, cohesion, and mobile reading.

Resume without rerendering unchanged work:

```bash
node "$SKILL_DIR/scripts/book-pipeline.mjs" finalize \
  --config book.json --manuscript manuscript.md --plan book-plan.json \
  --tier full --aesthetic-review aesthetic-review.json
```

### 8. Deliver

Deliver the HTML, PDF, approximate page count, word and exact-block preservation percentages, and any material caveats. A complete run must have `artifact-manifest.json` with passing full verification, the exact cover asset hash and generation receipt, and, when required, a passing aesthetic review. Never report success when the selected final cover does not visibly use that asset.

## Design Decisions

- Start chapters with actual prose, not unrequested opener spreads.
- Use measured `.page.text-page` layouts for designed prose. Two columns suit analytical reading; one column suits slow emphasis; three columns suit short modular material.
- Recommend color from the manuscript's meaning, not a generic genre preset, and let the user make the final choice before planning.
- Add 2–4 manuscript-grounded full-page exhibits for designed nonfiction when the source supports them. Use `framework` for reusable lenses, `scorecard` for two-sided cases, and `numbers` for bounded comparative statistics; keep inline diagrams for sequence, hierarchy, anatomy, taxonomy, matrix, or system relationships.
- Always generate manuscript-grounded cover artwork. Generate additional editorial images only when useful. The active theme module is the sole source of all image-prompt prose.
- Treat short tail pages, sparse tools, and 4–6 item grids as deliberate compositions, not leftover blank space.
- Use only the Photo and Minimal cover routes. Both must visibly integrate the required artwork; keep the selected route aligned with the final cover and evidence.

Read only the reference needed for the current decision:

- [references/intake-and-planning.md](references/intake-and-planning.md): intake defaults, content architecture, image policy, cover planning.
- [references/visual-system.md](references/visual-system.md): diagram grammar, signature tools, imagery, page rhythm, cover quality.
- [references/layout-and-html.md](references/layout-and-html.md): HTML architecture, measured pagination, atomic print CSS, mobile behavior.
- [references/verification-gates.md](references/verification-gates.md): diagnostics, preservation, visual/PDF gates, delivery requirements.
- [references/pdf-optimization.md](references/pdf-optimization.md): guarded direct export, installed-Chrome recovery, and standalone PDF inspection.
- [references/reasoning-contracts.md](references/reasoning-contracts.md): strict plan, repair, exception, and aesthetic JSON contracts.
- [references/iteration.md](references/iteration.md): incremental tiers, delta context, cache invalidation, and compact reporting.

Do not read `STYLE_PRESETS.md`, `html-template.md`, `page-base.css`, browser internals, or all references by default. Read them only when changing the corresponding style, architecture, CSS, or tool implementation.
