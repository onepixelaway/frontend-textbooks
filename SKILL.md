---
name: frontend-textbooks
description: Create designed, letter-size HTML textbooks, manuals, field guides, and coffee-table books from supplied manuscript text, then export a PDF. Use when the user wants long-form text turned into a print-ready or shareable book-like artifact while preserving roughly 90% or more of the source manuscript, adding diagrams where useful, and generating or placing images when they improve comprehension or visual richness.
---

# Frontend Textbooks

Create letter-size, book-quality HTML documents and matching PDFs from user-supplied manuscript text.

## Core Principles

1. **Preserve the Manuscript** - Keep at least 90% of the supplied manuscript unless the user explicitly asks for abridgment, condensation, or summarization.
2. **HTML First, PDF Always** - Produce the final book as HTML and export a PDF from that same HTML. The HTML is the editable source of truth.
3. **No Toolchain Copy Inside the Artifact** - Never include reader-facing text that reveals the book was generated, exported, built from HTML, created by an AI/agent/skill, or converted from a supplied manuscript. Phrases like "generated from the supplied manuscript", "HTML is the editable source of truth", "PDF exported from this file", or "created with Codex" belong only in delivery notes or repository docs, never in covers, title pages, colophons, captions, footers, or printable pages unless the user explicitly asks for production notes.
4. **Letter-Size Pages** - Design for US Letter, 8.5in x 11in. Use CSS print rules and page-safe layout instead of slide stages.
5. **Book, Not Deck** - Use chapters, front matter, page numbers, running heads, figures, captions, diagrams, indexes, and visual plates where appropriate.
6. **Default Style First** - If the user does not mention style, aesthetic, visual direction, or a named design reference, use the default editorial style. Generate style previews only when the user asks to explore style or gives an aesthetic direction that needs interpretation.
7. **Visuals Serve the Text** - Add diagrams for structure, flow, comparison, timelines, anatomy, systems, and relationships. Generate images for illustrative or atmospheric book art when useful, but do not fabricate factual evidence.
8. **Pages Must Be Atomic** - Designed pages, covers, part dividers, image plates, figures, and callouts must never split across two PDF pages. A partially printed designed page followed by its blank remainder is a blocking defect, not a cosmetic issue.
9. **Coffee-Table Means Visual Rhythm** - Editorial and coffee-table books need a mix of spacious single-column pages, two-column reading spreads, three-column short-form sections, pull quotes, plates, and diagrams. Do not pour the entire manuscript into one uninterrupted text column unless the user explicitly asks for a plain reader edition.
10. **Body Pages Need Designed Measures** - In editorial, HBR-like, and coffee-table books, body prose must not appear as one wide text slab. Dense analytical prose should default to measured two-column reading pages or a narrow single-column measure with generous margins. Two columns are not enough by themselves: preserve generous side margins, use a clear gutter, and avoid center rules unless the style explicitly needs them. Three columns are for compact taxonomies, checklists, and field-guide material only.
11. **The Cover Must Sell the Book** - Every completed book needs a cover-options artifact before final export. For editorial, HBR-like, business, or coffee-table books, the cover is a concept and hierarchy problem, not a title page: create 4-5 distinct cover routes as the final creative checkpoint before export. The winning route should be legible at thumbnail size, have one dominant idea, use confident typography, and feel commercially publishable. The final cover must match the selected route's composition; do not add unrelated elements or resize the hierarchy after selection.
12. **Screen HTML Must Not Expose Print Failures** - The browser/mobile HTML is also a deliverable. It must not show page seams slicing through a fixed-format page or scaled PDF-like pages that cut prose awkwardly. On small screens, collapse columns and use a continuous readable flow, or explicitly direct mobile users to the PDF.
13. **Covers Need Book Metadata** - Include an author on the cover and title page. Use the author supplied by the user; if none is supplied and the user's name is available from the session or environment, use that. If no reliable name is available, ask before final export. Support an optional publisher/imprint name when supplied, but do not invent one.
14. **Designed Interiors Need Signature Tools** - For business, strategy, instructional, HBR-like, field-guide, workbook, or coffee-table books, add reusable designed interior pages that make the ideas usable and collectible: a canvas/framework spread, chapter-ending model cards, and at least one annotated failure/anatomy page when the manuscript supports them. These pages must preserve the manuscript rather than replacing it.
15. **Chapter Starts Should Begin the Reading** - Do not generate standalone chapter-opening spreads or title/deck opener pages by default. After front matter or a part/section divider, start the chapter on the next prose page with the chapter metadata, title, and actual body text. Use pull quotes, diagrams, or chapter labels inside that prose page when they help, but do not insert extra opener pages that delay the manuscript.
16. **Whitespace Must Be Owned** - Designed books can be spacious, but they cannot look accidentally empty. Short tail pages, sparse tool pages, and feature pages with only a few blocks must be designed as intentional compositions: stacked mini-column pages, single-column closers, row-based short-item tools, bottom-anchored notes, large numerals, rules, pull quotes, or other source-faithful editorial furniture. For 4-6 short canvas/tool items, use rows with larger item headers instead of equal skinny columns.
17. **Diagrams Must Explain First** - A diagram is successful when its visual structure makes the idea easier to understand before the caption is read. Prefer clear grids, paired rows, direct connectors, internal titles, and one visible takeaway over decorative curves, ambiguous arrows, overlapping shapes, or visual noise.
18. **Complex Diagrams Need Written Specs** - When a diagram is too complex for a clean SVG/HTML construction, write a precise visual specification and generate a high-resolution diagram image. Do not improvise dense manual SVGs. Keep exact labels, callouts, and captions under HTML/SVG control when text fidelity matters.
19. **Designed Nonfiction Needs Diagrams** - For textbooks, manuals, field guides, business books, strategy books, HBR-like books, and analytical editorial nonfiction, diagrams are part of the minimum interior system, not optional decoration. Include at least 2-4 manuscript-grounded diagrams or diagram-like tools unless the user explicitly requests a plain/literary reader edition or the manuscript truly contains no structural, process, comparison, sequence, taxonomy, or system relationship to visualize.

## Non-Negotiable Manuscript Preservation

- Preserve the author's argument order, vocabulary, examples, and tone.
- Do not summarize chapters into short sections unless the user asks for a summary edition.
- Do not replace paragraphs with bullet summaries.
- Do not remove detail just to make page count smaller.
- Light editing is allowed for typography and book flow: heading normalization, paragraph breaks, captions, pull quotes, callouts, footnotes/endnotes, and typo fixes when obvious.
- If the source contains duplicated boilerplate, notes-to-self, prompts, transcripts, or rough outlines, ask before removing them unless the user already requested editorial cleanup.
- Track preservation with a rough word-count check: source manuscript words vs. included book text. The target is >= 90% included text.

## Output Contract

Every completed run must deliver:

- `index.html` or `[book-name].html`
- `[book-name].pdf`
- `cover-options.html` or an equivalent cover-options section/artifact
- An `assets/` folder if external images are used
- A short note with file paths, approximate page count, and text preservation percentage

The HTML should be readable in a browser and print cleanly to Letter PDF. The PDF should be generated before final delivery, not left as an optional next step.

## Phase 0: Detect Mode

Determine the work type:

- **Mode A: New Book** - User supplies manuscript text, Markdown, notes, or files. Build the HTML book and PDF.
- **Mode B: Existing HTML Book Enhancement** - User provides an HTML book and wants design, layout, images, diagrams, or PDF export improved.
- **Mode C: Manuscript Packaging** - User has text but no design brief. Infer a suitable book structure and use the default editorial style, then ask only for genuinely blocking details.

Do not use the slide workflow. There is no fixed 16:9 stage, slide navigation, or `.slide` export.

## Phase 1: Manuscript Intake

Collect or locate the manuscript.

If the user has not supplied text or a file, ask for it. If the user supplied enough to proceed, do not pause for extra preferences unless a choice materially changes the result.

When useful, ask these together in one concise message:

1. **Book Type** - Textbook / Coffee-table book / Manual / Field guide / Essay collection / Workbook
2. **Audience** - Beginner / Practitioner / Executive / General reader / Student
3. **Visual Policy** - Generate images freely / Use diagrams only / Use supplied images only
4. **Author / Publisher** - Author name for the cover and title page; optional publisher or imprint name if the user wants one

If the user does not answer optional preferences, choose defaults:

- Book type: textbook for instructional material, coffee-table book for evocative narrative or visual subject matter, manual for procedural content.
- Audience: general reader unless the text clearly targets a specialist.
- Visual policy: diagrams freely, and generated images are required when the system provides an image-generation tool, unless the user explicitly asks for diagrams only, supplied images only, a deliberately plain reader edition, or no generated images. Do not silently choose diagrams-only in the default case.
- Visual direction: use the default cobalt editorial style unless the user mentions style, aesthetic, visual direction, or a named design reference. The default style uses Poppins Bold for headings, Halant for body text, cobalt hierarchy, and a lighter cobalt-blue accent from Google Fonts when network use is available, with strong local fallbacks when it is not.
- Author: use the supplied author; otherwise use the current user's name when it is reliable from context. If not reliable, ask before final export.
- Publisher/imprint: omit unless supplied. Do not fabricate an imprint just to fill space.

## Phase 2: Content Architecture

Analyze the manuscript without summarizing it away.

Create a book structure that preserves the manuscript:

- Front cover
- Title page
- Copyright or colophon page if useful
- Keep title, copyright, and colophon pages reader-facing. Do not use them for production or toolchain notes about HTML, PDF export, source manuscripts, Codex, image models, or the skill unless the user explicitly requests a process colophon.
- Table of contents
- Foreword/preface/introduction when present in the source
- Chapters or sections based on the manuscript's existing structure
- Visual plates, diagrams, tables, exercises, glossaries, footnotes, or appendices where useful
- Signature interior tools for applicable manuscripts: framework/canvas spreads, chapter-ending model cards, annotated failure/anatomy pages, decision matrices, checklists, or worksheets
- Back matter if the manuscript supports it

Use the manuscript's headings when they exist. If headings are missing, infer chapter boundaries from natural topic shifts while keeping paragraph order.

For long manuscripts:

- Prefer flowing chapter text with print CSS so browser pagination does the heavy lifting.
- Use explicit designed pages for covers, part/section dividers, diagrams, image plates, tables, exercises, and interludes.
- Avoid hand-chunking every paragraph into fixed-height pages unless the manuscript is short enough to verify manually.
- For editorial or coffee-table output, do not leave all long prose in a single wide `.chapter-flow`. Use measured text pages (`.page.text-page.text-two`) for dense body sections when page-level art direction matters. If a chapter is too long to hand-chunk safely, use a measured pagination script or keep a narrow single-column measure; do not use a wide full-page column.

For short manuscripts or coffee-table layouts:

- Use explicit `.page` sections for a stronger art-directed result.
- Preserve the text by spreading it across more pages instead of compressing it.
- Vary the reading rhythm: alternate generous one-column narrative pages, two-column analytical pages, and three-column compact field-guide/checklist pages where the source text naturally supports it.
- Keep all explicit pages page-sized and atomic: each `.page` must begin on a fresh PDF sheet and contain content that fits within that sheet.
- Use `.page.text-page.text-two` for normal analytical body spreads; use `.page.text-page.text-single` for slow literary emphasis; use `.page.text-page.text-three` only for short modular material. A screenshot showing body copy as one broad column in an editorial chapter is a failed layout check.
- On designed two-column pages, diagrams, large figures, tables, and conceptual maps should usually span the full text frame (`column-span: all`) above or between prose columns. Do not trap an important diagram inside a single narrow column unless it is intentionally a small marginal note.
- Start each chapter with a real body-text page, not a standalone opening spread. If the opening needs emphasis, make the first prose page more elegant: a quiet kicker, the chapter title, a short deck or pull quote, and then the manuscript text in the same page flow. If a major figure belongs at the start, place it as a figure within or just before the first body page without adding a separate two-page opener.
- When pagination leaves a short final continuation page, do not leave two small columns stranded at the top of a mostly blank sheet. If the remaining prose is simple and roughly under 1,300 characters, use `.text-short-single`: one left-aligned column about 1.3x the normal single-column measure. If the remaining content is medium-short and has natural paragraph or section breaks, use a `.text-stack` page: two small-column bands stacked vertically with a clear reading path and a bottom anchor. If the remaining content is very short, use a designed `.text-tail` single-column closer with a closing rule, chapter marker, pull quote, note, or other source-faithful editorial furniture. If it can fit naturally on the prior page without crowding, repaginate instead.

## Phase 3: Visual Planning

Identify where visuals are useful:

- **Diagram** - process, hierarchy, system, concept map, timeline, comparison, anatomy, flow, lifecycle, architecture, taxonomy.
- **Generated image** - section divider, metaphorical scene, historical/fictional atmosphere, product-like object, editorial art, texture, background, visual plate.
- **Supplied image** - preserve exact visual evidence, screenshots, product photos, portraits, charts, or artwork the user provided.
- **Table or figure** - structured information already present in the text.

Before building pages, create a diagram plan for every non-plain designed book:

- Identify 2-4 places where the manuscript has an actual visual relationship: a process, loop, hierarchy, comparison, taxonomy, decision map, anatomy, system, timeline, or reusable canvas.
- Give each planned diagram a job in one sentence, a visual grammar, the source section it belongs to, and the exact labels or concepts it must preserve.
- Place diagrams at natural reader moments: after a framework is introduced, beside a comparison, at the end of a process chapter, or as an anatomy/failure page after a vivid example.
- If fewer than two diagrams are included in a textbook, manual, field guide, business book, strategy book, HBR-like book, or analytical editorial nonfiction, record the reason in delivery notes and set `requireDiagrams: false` only when the user requested a plain/literary edition or the manuscript genuinely has no diagrammable relationships.
- Do not count generated part-divider art, cover art, decorative plates, pull quotes, or generic model cards as diagrams. A page counts only when it exposes structure, relationship, movement, comparison, or anatomy that helps the reader understand the argument.

Use diagrams before generated images for explanatory material. When image generation is available and the user has not opted out, generate or place at least one manuscript-grounded image in every completed new book. Use additional generated images when they add clarity, pacing, atmosphere, or book-like richness.

For coffee-table books, brand books, visually rich business books, default editorial/field-guide books, and books where the user asks for an image-led aesthetic, generated image use is required when the system supports it unless the user asks for diagrams only, supplied images only, a deliberately plain reader edition, or no generated images:

- Generate or place at least one cover/hero image or visual plate.
- Generate or place images for major part/section dividers when they improve pacing and tone.
- Generate a distinct image for each major part/section divider. Do not reuse one generated image across multiple part/section headers unless the user explicitly requests a repeated motif; even then, create distinct variants, crops, or compositions for each section.
- Do not reuse the cover image as a standalone interior image plate, frontispiece, opening plate, or section image. The cover image is a cover asset. If the book needs an opening plate or divider art, generate a distinct manuscript-grounded image for that page.
- For default split-cover and scaffolded part-divider art, use the same image format: an upper artwork field over a solid cobalt text band. Request the same approximate `1.14:1` wide artwork slot used for default cover art, and use the same default prompt template/style for every divider image. Keep the template, palette, material language, and "no text" constraints consistent; change only the concrete manuscript-grounded subject/scene for each section.
- Use manuscript-grounded prompts and avoid text inside generated images unless exact typographic fidelity is required and can be verified.
- Treat generated images as editorial plates: crop deliberately, caption when useful, and verify they render in both HTML and PDF.
- In scaffolded books, pass generated section/part divider images through `partImages` in `book.json`, keyed by part id, title, label, or number. Do not patch generated part-divider markup by hand when the scaffold field can express the asset directly.
- In scaffolded books with a generated/supplied `coverImage` and parsed parts, leave `requirePartImages` enabled and provide `partImages` for every parsed part. Disable `requirePartImages` only when the user explicitly requested no section images or image generation is unavailable, and note that caveat in delivery.
- In scaffolded books, if `partImages` is used at all, it must cover every parsed part divider. Partial coverage is a blocking configuration error because it means some section pages did not receive generated art.
- In scaffolded books, every non-empty `partImages` value must point to a unique asset. Repeated image paths across section/part dividers are a blocking configuration error, not a harmless shortcut.
- If image generation is unavailable, state that limitation in the final delivery and compensate with strong diagrams and typographic plates.

When generating images:

- Use available image generation tools when the environment provides them.
- Save image files under `assets/`.
- Write concise prompts grounded in the manuscript's subject and visual direction.
- Generate the cover image and part/section divider images as a coherent series. For the default style, each prompt should use the same format and prompt template as the cover image: same aspect target, same cobalt/warm-white editorial illustration language, same no-text/no-logo constraints, and a different concrete subject/scene per section.
- Before generating default split-cover art, match the final image slot instead of requesting generic portrait art. The default top artwork field is `8.5in x 7.45in` after the `3.55in` bottom cover band, aspect ratio about `1.14:1`; if the band height changes, recompute it as `8.5 / (11 - bandHeight)`. If the image tool supports dimensions, request `2400x2096` or `2048x1792` pixels; otherwise put "compose for a 1.14:1 wide cover-top frame" in the prompt. Keep the focal subject inside the central safe area with roughly 10-15% padding on all sides so cover cropping does not cut off faces, hands, objects, or important marks.
- Build `[SUBJECT / SCENE]` as one short, concrete subject phrase, usually 4-12 words and no more than about 16. Use one visible primary object, person, or place plus, if needed, one simple action or setting: "a marked notebook on a conference table", "three calendar pages pinned above a desk". Do not pack the slot with themes, lists, chapter theses, symbolic clauses, or abstract nouns. Translate abstractions like "decision paths", "system dynamics", "alignment", "follow-through loops", or "stakeholder pressure" into a tangible prop or scene before substituting the slot.
- For cover and divider image series, vary only that short subject phrase. Do not add extra style words, composition notes, mood terms, prompt-engineering modifiers, or "X as Y" metaphors inside `[SUBJECT / SCENE]`; the fixed template supplies style, mood, composition, and metaphor. If the concept needs a long explanation, choose a simpler visual substitute instead of lengthening the slot.
- When using the default image style, preserve the template prose exactly. Replace only `[SUBJECT / SCENE]` with the concrete manuscript-grounded subject phrase. Do not rewrite the template into a full structured image-generation schema. If useful for the tool call, you may prepend only `Use case`, `Asset type`, and `Constraints` lines; the style, composition, material, and mood language should remain the template text below.
- If the user has not specified an image style, use this default prompt template, replacing `[SUBJECT / SCENE]` with the concrete subject:

```text
[SUBJECT / SCENE] in a minimal conceptual editorial illustration style, monochrome cobalt blue and warm white palette, quiet intellectual atmosphere, spacious composition with large areas of negative space.

Use expressive blue ink brushwork, dry-brush streaks, layered screenprint texture, fine contour-line patterns, fingerprint-like wave forms, and soft painterly gradients. Blend a lightly realistic human figure or object with abstract flowing visual metaphors of thought, knowledge, writing, data, memory, or creative process.

Composition should feel calm, sparse, and magazine-editorial: one clear focal subject, surrounded by oversized abstract marks, paper-like forms, flowing ribbons, circular brush loops, or stacked document shapes. Warm off-white paper background, visible canvas/paper grain, subtle ink bleed, imperfect handmade edges, high contrast but soft overall mood.

Elegant, poetic, restrained, modern, contemplative, tactile, printmaking-inspired, riso poster aesthetic, blue ink on paper, no text, no logo, no bright colors, no photorealism, no busy background, no multi-panel grid, no collage of separate images.
```

- Avoid photorealistic depictions of real private people or undocumented events unless the user supplied the image or explicitly requested an illustration.
- Use captions and alt text.
- For the default cover when a generated or supplied illustration is strong, let the artwork occupy the upper field and place the title, subtitle, and author in a solid cobalt bottom band. Use an asset generated for the upper field's approximate `1.14:1` aspect ratio when possible. Do not bury good artwork under a dark full-cover overlay unless the selected cover route explicitly calls for that treatment.
- Keep print quality in mind: prefer at least 1600px on the long side for large figures, 2400px+ for full-page plates when practical.
- For generated diagram images, write a diagram spec before generating: purpose, relationship type, entities, required labels, reading order, composition, style, color palette, prohibited clutter, and output size. Save that spec in a comment near the figure or in the working notes when useful.
- Avoid relying on image generation for small exact text. If the diagram requires exact words, generate the image as the visual base and overlay labels/callouts in HTML or SVG, or use SVG/HTML instead.

When drawing diagrams:

- Prefer inline SVG for crisp PDF output.
- Keep labels short, legible, and pulled from the manuscript's vocabulary.
- Add figure numbers and captions.
- Use the book's visual system rather than default chart colors.
- Crop SVG `viewBox` values tightly to the actual drawing bounds. Do not leave large internal SVG whitespace and then rely on page margins to compensate; white space should be controlled by the page layout, not accidental canvas padding.
- Before drawing, name the diagram's job and the relationship it must reveal. Extract the entities, relationship type, reading order, grouping, and single takeaway before choosing shapes.
- Match the visual grammar to the relationship. Use comparison grids for contrasts, timelines/process flows for sequences, loops for cycles, trees or layered stacks for hierarchies, node-link maps only for real networks, matrices/axes for two-criterion tradeoffs, annotated callouts for anatomy, and canvas grids for reusable tools.
- Do not force every concept into the same two-track comparison pattern. A repeated pattern is good only when the underlying relationship repeats.
- For comparisons, use a simple two-track or matrix structure: equal columns, directly paired rows, straight horizontal connectors, and consistent spacing. Add a small internal diagram title so the exhibit is understandable without surrounding prose.
- For flows and timelines, number the steps, keep directionality obvious, and use one arrow style. Avoid circular loops unless the manuscript describes recurrence.
- For systems and network maps, limit nodes to the minimum set that explains the system. If the links become spaghetti, split the map into stages, layers, or a table.
- For anatomy diagrams, label the object, scenario, or page directly. Pair each callout with what it reveals; do not scatter unlabeled marks around an illustration.
- Switch from hand-built SVG/HTML to a generated diagram image when the visual needs spatial richness, perspective, texture, many interacting parts, a realistic object/process, or an editorial illustration that would become brittle or noisy as code. Use a generated image only after the diagram grammar and spec are clear.
- Remove decorative complexity unless it encodes meaning. Avoid squiggles, extra curves, overlaps, random badges, and multiple accent colors when a straight rule, row, or label would explain more clearly.
- Limit the emphasis system. One cobalt checkpoint, badge, result, or warning is usually stronger than several competing highlights.
- When a diagram needs icons, use one recognized icon pack instead of hand-drawing ad hoc marks. Prefer Lucide for clean editorial outline diagrams; Heroicons, Phosphor, Material Symbols, or a domain-specific open icon set are also acceptable when they fit the style. Embed exported SVG symbols or self-hosted assets so the PDF does not depend on a runtime icon script, and note the source/license when copied into the artifact.
- Do not mix icon packs inside one diagram unless there is a deliberate reason. Keep stroke widths, caps, joins, scale, and visual weight consistent across all icons.

## Phase 3B: Signature Interior Tool System

For analytical, business, strategy, instructional, HBR-like, field-guide, workbook, and coffee-table books, identify 2-4 recurring interior tools that make the book more than prose on pages. Choose tools from the manuscript's actual structure; do not invent exercises that contradict the source.

Default top-priority tools:

1. **Canvas or Framework Spread** - A full-page or two-page-feeling atomic page that gives the reader one reusable operating model. Use for processes, systems, audits, playbooks, canvases, decision maps, checklists, or planning templates. It should have labeled zones, short prompts, and enough whitespace to feel like a designed artifact.
2. **Chapter-Ending Model Cards** - At the end of major chapters or parts, add compact cards that translate the chapter into reusable ideas: core model, common failure mode, prepared move, questions to ask, or one-line takeaway. Keep them short and source-faithful.
3. **Annotated Failure / Anatomy Page** - Use one representative scenario, object, page, meeting, workflow, or case from the manuscript and annotate what goes wrong, what is hidden, and what the prepared move is. This is an explanatory diagram, not a new anecdote; ground labels in the manuscript.

Selection rules:

- Use at least one signature interior tool for any non-plain designed book. Use all three top-priority tools for business, field-guide, and HBR-like books when the manuscript supports them.
- Place tools at natural moments: a canvas near the first complete framework, model cards after chapters or parts, failure anatomy after a vivid cautionary example.
- Preserve the original prose nearby or elsewhere. A model card or canvas can duplicate and condense an idea, but it must not replace the source paragraph.
- Design tools as atomic `.page` sections with generous margins, strong hierarchy, and no overflow. Avoid boxed-card clutter; use rules, grids, labels, numbers, arrows, and whitespace deliberately.
- Sparse tool or feature pages must still use the full page compositionally. If a working-model page has only a few cards or short notes, use stacked mini-column bands, row-based short-item tools, a large numeral, field note, quote, or rule system to claim the page. Do not leave the bottom half unclaimed.
- For canvas/tool pages with 4-6 items and only a sentence or two per item, do not make equal-width vertical columns. Use `.sparse-item-rows`: one item per horizontal row, a larger left-side item header, and a short right-side explanation. Five skinny columns with mostly empty lower space are a failed layout.
- Keep labels portable. A future book about product strategy, finance, cooking, or architecture should be able to use the same page types with different content.

## Phase 3C: Chapter Starts

For editorial, HBR-like, coffee-table, business, and visually led instructional books, make chapter starts feel deliberate without delaying the prose:

- Do not create `.chapter-opener`, `.editorial-spread`, `.spread-left`, `.spread-right`, standalone title/deck pages, or other opening spreads unless the user explicitly requests them. The next page after a part/section divider should usually be a `.text-page` with the chapter kicker, title, optional short deck, and opening manuscript text.
- Place opening figures in that prose page or as source-faithful figure pages at the natural point in the text. Use pull quotes only as small duplicated furniture from the source; do not use them as a reason to add opener pages.
- If the user explicitly requests chapter-opening spreads, mark those pages with `data-allow-opening-spread="true"` and still ensure they preserve manuscript order, do not repeat full paragraphs, and are useful enough to justify the extra pages.

## Phase 5A: Pre-Final Cover Direction Sprint

For every completed book, create a cover-options artifact after the interior style, assets, and metadata are stable, and before final PDF export. Treat this as the last creative checkpoint before delivery, not an early mood board. For editorial, coffee-table, HBR-like, business, brand, or visually led books, this must be a full cover sprint.

Required behavior:

1. Produce 4-5 cover routes using the actual title, subtitle, author, and optional publisher/imprint. Do not make five small variations of the same layout. For a deliberately plain conversion, still provide at least 3 cover routes unless the user explicitly opts out.
2. Vary the dominant mechanism across routes:
   - **Type as image**: oversized title, mixed weights, extreme scale, or stacked/condensed type.
   - **Conceptual symbol**: threshold, system map, decision fork, object, or abstract shape that expresses the book's argument.
   - **Editorial photo/art**: full-bleed or deliberately cropped image with type integrated into the composition.
   - **High-contrast minimal**: 2-3 colors, strong negative space, one memorable mark.
   - **Series/press system**: disciplined imprint-like cover that still has a focal hook.
3. Limit each route to one primary idea. If the cover has a photo, the type still needs a clear hierarchy. If the cover is mostly type, the typography must become the visual event.
4. Test the routes at thumbnail scale. The title must remain readable around 100px wide; if not, redesign.
5. Render the cover options at a useful review size and as thumbnails. If the user is actively reviewing the work, share or deploy the options before the final export so they can choose.
6. Choose the strongest route for the final book unless the user explicitly wants to choose. Keep the cover-options artifact when useful so the user can compare.
7. Use the selected route as the source of truth for the final cover. Copy its composition, scale relationships, image crop, metadata placement, and negative space into the real cover. If the final cover needs changes, update the selected option to match. A final PDF cover that differs materially from the selected route is a failed cover pass.

Cover quality gates:

- The title must be the largest and highest-contrast element unless a single visual symbol is deliberately dominant.
- The subtitle should support the promise, not compete with the title.
- Use at most two type families on the cover; vary width, weight, case, size, or tracking to create hierarchy.
- Avoid generic stock-photo layouts, polite centered title pages, weak split-image compositions, and low-contrast serif titles that disappear at thumbnail size.
- For business/nonfiction covers, favor bold typography, high contrast, restrained palettes, and a clear transformation or promise.
- Include the author in a deliberate position; it may be quiet, but it must not be missing.
- Include publisher/imprint only when supplied. If included, keep it subordinate to title and author.

## Phase 4: Style Defaults and Style Discovery

If the user does not mention style, aesthetic, visual direction, or a named design reference, use the default cobalt editorial style and keep moving. Do not stop to ask for style preferences, and do not generate style previews by default.

Default style:

- Headings/display: Poppins Bold from Google Fonts.
- Body text: Halant from Google Fonts.
- UI/captions: Poppins, using bold or semibold weights for labels.
- Large headline: deep cobalt ink `#0A3695`.
- Subheadline/deck: editorial blue `#19419A`.
- Body text: near-black ink navy `#10131A`.
- Secondary body/captions: dark blue-gray `#2C3342`.
- Small labels/metadata: muted blue-gray `#69738F`.
- Accent marks and numerals: lighter cobalt blue `#4F76D9`.
- Rules/soft accents: softened cobalt blue `#B7C8F3` and `#9BB2EA`.
- If Google Fonts cannot load, use local sans-serif fallbacks for headings/UI and Georgia or a local serif for body text.

Generate 3 one-page or two-page-spread HTML previews only when the user asks to explore style, explicitly mentions style/aesthetic, provides a named visual reference that can go several ways, or requests multiple directions.

Preview rules:

- Use actual manuscript excerpts, not placeholder lorem ipsum.
- Show at least one body-text page, not only a cover.
- Include one likely diagram or figure treatment if the manuscript needs diagrams.
- Keep each preview as a compact self-contained HTML file in `.frontend-textbooks/book-previews/`.
- Open previews for the user when possible.
- Ask which direction they prefer: Style A / Style B / Style C / Mix elements.

Read [STYLE_PRESETS.md](STYLE_PRESETS.md) only when style/aesthetic is in scope or a non-default visual direction is useful. Use it as a starting point, not a cage. A custom style is allowed when it fits the manuscript better.

Skip preview generation when:

- The user did not mention style/aesthetic; use the default cobalt editorial style.
- The user explicitly gives a precise design direction; execute it directly.
- The task is a fast conversion where style choice is less important than delivery.
- The manuscript is tiny and a polished single-pass design is clearly sufficient.

Do not skip the pre-final cover sprint for editorial, HBR-like, coffee-table, business, or visually led books merely because the interior style is known. A cover can fail independently of a good interior.

## Phase 5: Generate The HTML Book

Before generating the final HTML, read:

- [html-template.md](html-template.md) for the book architecture
- [page-base.css](page-base.css) for mandatory print/page CSS
- [STYLE_PRESETS.md](STYLE_PRESETS.md) for style systems
- [animation-patterns.md](animation-patterns.md) only when the browser version benefits from subtle interactive or scroll effects

### Reusable Scaffold vs. Custom Build Scripts

This skill includes a reusable scaffold for the repetitive plumbing of HTML book production:

```bash
node scripts/build-html-book.mjs book.json manuscript.md
```

Use `scripts/build-html-book.mjs` when the manuscript is mostly Markdown prose and you want a reliable starting book shell: cover, title page, table of contents, part dividers, measured body text pages, mobile collapse behavior, cover-options artifact, page numbers, and overflow assertions. The script expects `book.json` with at least `title` and `author`; optional fields include `subtitle`, `outputDir`, `outputHtml`, `coverImage`, `coverBandHeight`, `requirePartImages`, `requireDiagrams`, `chapterOpeners`, `style`, `bookType`, `coverKicker`, `bodyColumns`, `chapterClosers`, and `partImages`.

Treat the scaffold as the first draft of the production artifact, not the art director. After it runs, customize the generated HTML/CSS or write book-specific page code for the manuscript's actual visual ideas: signature tools, diagrams, plates, workbooks, tables, annotations, and editorial pacing. The scaffold should save time on structure and pagination, not replace the thinking that makes the book specific.

For non-plain designed books, the scaffold's `requireDiagrams` policy should remain enabled until the enhancement pass has added at least one real diagram or diagram-like tool. The scaffold does not invent diagrams by itself; use a scaffold-plus-enhancement workflow or a custom build script so diagrams actually enter the HTML before export. Disable `requireDiagrams` only for a deliberately plain/literary reader edition or when you can explain why no structural relationship in the manuscript should be visualized.

Write a custom build script instead of using the scaffold when any of these are true:

- The book needs manuscript-specific diagrams, model cards, canvases, annotations, or recurring interior tools.
- The content is not clean Markdown prose, such as spreadsheets, transcripts, source files, citations, multi-source research, or generated data.
- The design depends on precise page-level composition, image crops, workbook forms, indexes, glossaries, or unusual front/back matter.
- The manuscript is highly visual, coffee-table, brand, portfolio, or catalog-like, where page sequencing and image rhythm are the main product.
- The generated HTML will be rebuilt repeatedly and needs deterministic custom data transforms or asset placement.

When using the scaffold, still run the normal visual planning, cover sprint, export, and verification phases. Do not deliver a scaffold output that has not been inspected and improved where the manuscript asks for more than a clean reader edition.

For long prose books that still need strong designed interiors, prefer a scaffold-plus-enhancement workflow. Read [references/pdf-optimization.md](references/pdf-optimization.md) when using browser-side pagination, deterministic enhancement scripts, or readiness-gated PDF export.

HTML requirements:

- Use semantic HTML: `main`, `article`, `section`, `figure`, `figcaption`, `aside`, `nav`.
- Keep CSS and lightweight JS inline unless assets are external images.
- Include the full contents of `page-base.css` in the final HTML.
- Use `@page { size: letter; }` and `print-color-adjust: exact`.
- Use named CSS variables for color, typography, spacing, and figure styles.
- Use real web fonts from Google Fonts or Fontshare when network use is acceptable; by default load Poppins Bold for headings/UI and Halant for body text. Otherwise define strong fallbacks.
- Include a print button or export note only if it does not pollute the PDF.
- Keep export buttons, development notes, and production workflow reminders screen-only. Never put generated/exported/source-of-truth/toolchain language in print-visible book pages.
- Ensure page breaks do not split covers, figures, tables, callouts, or headings from their following paragraph.
- Use `orphans`, `widows`, `break-inside`, and explicit page-break classes.
- Do not use fixed pixel-only layouts for long body text. Use inches, points, rems, and responsive browser sizing while preserving Letter print behavior.
- For every explicit `.page`, enforce `break-before: page`, `break-after: page`, `break-inside: avoid`, and a fixed Letter-height layout that cannot spill. Do not place fixed-height `.page` elements inside a container or flow that allows them to begin mid-sheet.
- Use named layout classes for manuscript prose rhythm, such as spacious single-column pages, two-column narrative pages, and three-column compact pages. Choose the layout from the content, not randomly.
- When using CSS columns, prevent bad breaks with `break-inside: avoid` on headings, figures, callouts, list blocks, and short sections. Never allow headings or figure captions to be orphaned at a column or page edge.
- Do not apply CSS multi-column layout to long flowing chapters unless you have rendered and inspected continuation pages. Browser PDF engines can fragment multi-column flows with clipped top text or bad blank lower halves. For reliable coffee-table rhythm, prefer bounded atomic feature pages, explicit two-column designed pages, and compact three-column field-guide pages that fully fit on one Letter sheet.
- For editorial body copy, prefer the base `.text-page` pattern from `page-base.css`: `.page.text-page.text-two` for two-column reading pages and `.page.text-page.text-three` for compact modular pages. Each `.text-frame` must be filled only until it fits; overflow must create another `.text-page`, never clip.
- Do not add visible continuation markers to repeated text-page titles. Never emit `<span class="continuation-mark">...</span>`, and never add stray words such as `text` or `continued` beside the real title. Use `aria-label`, running heads, or quiet page metadata for continuation semantics.
- For editorial pages, use the base wide-air defaults: roughly 0.82in to 0.92in side padding, a 0.5in+ two-column gutter, no default column rule, and unboxed figures unless a border is serving a real information-design purpose.
- For chapter starts, do not create standalone opener pages by default. Let the first body page carry the chapter title and opening prose. If a chapter-start figure is necessary, keep it in the body flow or make it a source-faithful figure page at the natural point in the text.
- Treat unrequested `.chapter-opener`, `.editorial-spread`, `.spread-left`, and `.spread-right` pages as failed layout. They add pages without enough reader value and delay the prose.
- If using JavaScript to paginate body blocks into `.text-page` elements, the export must wait until pagination is complete and must assert that no `.text-frame` has `scrollHeight > clientHeight` or `scrollWidth > clientWidth`.
- When using JavaScript pagination, measure headings with their following paragraph/list as one keep-with-next unit. A page ending with only a section heading and no body text is a failed page, even when nothing technically overflows.
- When JavaScript pagination creates the final page of a chapter, measure its approximate content weight. If a continuation page has simple prose under roughly 1,300 characters, switch it from normal two columns to `.text-short-single`: one left-aligned column with a measure about 1.3x the usual single-column width. If a continuation page has medium-short text with natural breaks, switch it to a `.text-stack` stacked mini-column page. If it has very little text, switch it to a `.text-tail` single-column closer or rebalance content. Bottom anchors, pull quotes, and `.tail-furniture` must reserve real layout space and must be rechecked after insertion; never absolutely position bottom furniture over a prose frame unless a collision check proves it cannot overlap. Short text at the top of two columns with an empty lower half is a failed editorial layout.
- On mobile/small screens, the HTML must collapse `.text-two` and `.text-three` to one column and remove internal overflow so the browser view does not show a page cut through prose.
- Do not override the base mobile behavior that collapses consecutive `.text-page` pages into a continuous reader. Repeated text-page headers after the first page should be hidden on mobile unless they are real semantic section breaks.

Page integrity requirements:

- Designed pages and plates must be atomic. If a part divider, cover, visual plate, full-page diagram, or fixed-format page creates a trailing blank fragment in the PDF, fix the CSS or layout before delivery.
- Every `.page` should have a single `.page-inner` with `height` or `min-height` tied to 11in and `overflow: hidden` only after confirming no meaningful content is clipped.
- Flowing text sections may paginate naturally, but fixed-format pages may not be split.
- Add a verification pass that renders representative pages around every transition from flowing text to `.page`, especially part dividers after long chapters.
- Render the deployed/browser HTML at a phone viewport (for example 390x844). The mobile view must not show a black page gap slicing a prose section in half, and it must not show a scaled Letter page where body copy is one wide desktop column.
- If phone HTML shows a black gutter between two fragments of the same prose section, treat that as a failed screen artifact even if the PDF is technically valid.

Text handling requirements:

- Preserve paragraphs as prose.
- Use pull quotes only by duplicating short excerpts already present in the manuscript; do not remove the original paragraph.
- Chapter-close furniture may use generated summary copy when it is clearly additive, short, and source-faithful. Prefer generated chapter closers over arbitrary manuscript excerpts when the close is meant to summarize or land the chapter emotionally; provide them through `chapterClosers` in scaffolded books so the HTML remains deterministic.
- Do not add meta or provenance copy to the reader-facing artifact. The finished book should read like a book, not a build report: no notes about supplied manuscripts, HTML source files, PDF export, Codex, agents, AI generation, or this skill unless the user explicitly asks for that disclosure inside the book.
- Use sidebars to expand or clarify, not to replace source content.
- If adding captions or labels, distinguish them from manuscript text.
- For workbooks, preserve source text and add answer lines, exercises, or reflection prompts only when the manuscript supports that use.

Before exporting, run the selected-route parity check: place the chosen cover option and final cover side by side or render both, then verify that the final cover did not gain extra marks, different scale, different metadata placement, or a different image crop unless the selected route was updated too.

## Phase 6: Export PDF

Run the bundled exporter:

```bash
bash scripts/export-pdf.sh <path-to-html> [output.pdf]
```

The exporter uses Playwright's browser PDF pipeline with Letter sizing and printed backgrounds. It does not screenshot slides.

If Playwright or Chromium is missing, the script installs it in a temporary directory. If network installation fails, use an existing local browser PDF method and report that fallback clearly.

If the normal exporter times out while waiting for `networkidle`, or if the book uses browser-side pagination, read [references/pdf-optimization.md](references/pdf-optimization.md) and export with the readiness-gated exporter:

```bash
bash scripts/export-ready-pdf.sh <path-to-html> [output.pdf] --no-open
```

This path waits for fonts, images, browser pagination readiness, and text-frame overflow checks before writing the PDF.

## Phase 7: Verification

Verify before delivery:

1. **HTML opens** - Open or serve the HTML and inspect at desktop width.
2. **PDF exists** - Export the PDF and confirm the file was written.
3. **Letter size** - Confirm pages are Letter size when tooling is available (`pdfinfo`, Preview, or browser print settings).
4. **No obvious clipping** - Inspect the first pages, figure-heavy pages, and final pages.
5. **Text preservation** - Estimate source word count and included HTML/PDF text word count. Target >= 90%.
6. **Visual integrity** - Confirm diagrams, generated images, and supplied images render in both HTML and PDF.
7. **Diagram follow-through** - For textbooks, manuals, field guides, business books, strategy books, HBR-like books, and analytical editorial nonfiction, confirm the finished HTML contains at least one real diagram or diagram-like tool (`figure` with diagram class/ARIA, SVG diagram, comparison map, matrix, anatomy page, loop/process page, taxonomy page, or canvas/framework page) and preferably 2-4. If the verifier reports `requireDiagrams: true` and zero diagrams, the book is incomplete. Do not count cover art, part-divider art, or decorative plates.
8. **Print polish** - Look for bad page breaks, orphaned headings, split captions, unreadable table text, cramped gutters, trapped figures, or decorative elements covering prose.
9. **Atomic pages** - Inspect the PDF for split designed pages, blank spillover pages, clipped plates, or part dividers that start halfway down a sheet. This is mandatory for every book.
10. **Layout rhythm** - Confirm the book includes a deliberate mix of prose layouts appropriate to the genre. For coffee-table/editorial work, verify single-column, two-column, and compact multi-column treatments appear where useful.
11. **Image follow-through** - If the system supports image generation and the user has not opted out, confirm at least one generated image is actually present in the book, saved under `assets/`, and rendered in both HTML and PDF. For coffee-table, editorial, brand, field-guide, or visual books, confirm generated/supplied images are present in the cover and every major section/part divider, not merely planned. Do not create a standalone page that repeats the cover image as an interior plate. For section/part divider images, confirm every divider has an image, no divider is text-only, each divider uses a distinct asset or an intentionally varied motif, no divider reuses the cover image, and the series follows the same format and prompt style as the cover art unless the layout intentionally changed. Duplicated image paths, cover-image reuse, text-only dividers, or partial divider coverage are incomplete. For split covers, compare the asset aspect ratio with the actual upper artwork slot; if the mismatch is more than roughly 10% and important content is cropped, regenerate the image for the slot dimensions or change the cover route. If no generated image is present, the book is incomplete unless image generation was unavailable or the user explicitly requested no generated images.
12. **Continuation marker check** - Confirm no `.continuation-mark` elements exist and no visible words like `text` or `continued` sit beside repeated text-page titles. Continuation belongs in `aria-label` or running metadata, never as reader-facing title text.
13. **Body measure check** - For editorial/coffee-table chapters, inspect representative body pages. Dense body text should be two-column or narrow single-column; it must not be a full-width slab.
14. **Mobile/browser check** - Inspect the HTML at mobile width. Columns should collapse, text should be readable without desktop-scale shrinking, and page seams should not cut through prose.
15. **Editorial air check** - Inspect at least one dense page with a figure. Two-column pages should have generous side margins and a visible gutter, figures should span the frame when they carry the concept, and the page should not be boxed up by unnecessary borders, center rules, or decorative hairlines.
16. **Chapter-start check** - Confirm chapters begin with prose on the first body page after any relevant part/section divider. There should be no `.chapter-opener`, `.editorial-spread`, `.spread-left`, `.spread-right`, or standalone opener pages unless the user explicitly requested them and they are marked `data-allow-opening-spread="true"`.
17. **Signature tool check** - For business/strategy/instructional/HBR-like books, inspect the canvas/framework page, chapter model cards, and annotated failure/anatomy page when present. They should feel like designed interior artifacts, not generic callout boxes, and must not replace source prose.
18. **Hollow page check** - Inspect pages with unusually little content: final chapter continuation pages, two-card feature pages, short tool pages, and 4-6 item canvas pages. Sparse is acceptable only when the page has a deliberate composition: `.text-short-single` for simple short prose, `.sparse-item-rows` for short canvas/tool items, stacked mini-columns, a single-column closer, a bottom anchor, a large numeral, or another source-faithful page device. If the content simply stops near the top or sits in skinny columns with the rest of the page blank, keep working.
19. **Bottom furniture collision check** - Inspect every page with `.tail-furniture`, bottom pull quotes, or bottom-anchored notes. The anchor must not intersect body prose, list items, captions, or page numbers in desktop, mobile, or exported PDF renderings. If a bottom anchor overlaps text, remove it, move it into a grid row that reserves space, or repaginate.
20. **Diagram logic check** - Inspect every important diagram as if it were isolated from the page. It should have a visible title or premise, a clear reading order, legible labels, aligned elements, and visual relationships that match the manuscript's logic. If the diagram needs surrounding prose to explain what the lines mean, redraw it.
21. **Diagram grammar check** - Confirm the diagram type matches the relationship in the manuscript. Do not reuse a two-column comparison, loop, network, or matrix simply because it looked good elsewhere; the grammar has to fit the idea.
22. **Complex diagram check** - If a diagram has many nodes, layers, callouts, realistic objects, or overlapping relationships, confirm it was either simplified into a clear grammar or generated from a written visual spec. Do not ship brittle hand-built SVG complexity that only the creator can parse.
23. **Icon system check** - If a diagram uses icons, verify that they come from a coherent icon pack or supplied brand set, render in the PDF, and match the diagram's stroke weight and scale. Hand-drawn one-off icons are a defect unless the diagram is explicitly illustrative and the drawing style is intentional.
24. **Cover option check** - Verify that the required cover routes were created or explicitly considered as the pre-final checkpoint, and that the final cover has stronger hierarchy than a title page. Render the selected option, the final cover, and at least one thumbnail. If the final cover differs materially from the selected option, or if the title is not readable at thumbnail size, keep working.

If preservation drops below 90%, do not deliver as complete. Restore text, add pages, or explain exactly why the source included non-manuscript material that was excluded.

For scaffold-generated books, run the bundled HTML verifier before or after PDF export:

```bash
bash scripts/verify-html-book.sh index.html
```

The verifier serves the HTML, waits for browser-side pagination, checks text-frame overflow, and captures representative desktop and mobile screenshots under `.verification/`. Passing this verifier is not enough by itself; still inspect the screenshots and exported PDF for art direction, hollow pages, split atomic pages, cover parity, diagram logic, and mobile reading quality.

For PDF-optimized verification, prefer the rendered-state verifier and PDF inspector. See [references/pdf-optimization.md](references/pdf-optimization.md) for the full rendered-state workflow.

```bash
bash scripts/verify-rendered-book.sh index.html
bash scripts/inspect-pdf.sh book.pdf
```

Use the rendered browser word count, not static HTML stripping, when the manuscript is embedded in JSON or paginated by JavaScript.

## Self-Judgment Loop

Before final delivery, judge the artifact as if you were the art director and production editor:

- **Would this pass as a real book?** If it looks like a web article printed to PDF, keep working.
- **Are the best pages good enough to justify the style brief?** A coffee-table/HBR-like request needs confident art direction, not just rules and type.
- **Would the cover stop someone?** If the cover lacks a dominant focal point, strong title hierarchy, distinctive type, or a clear conceptual hook, keep working.
- **Are the worst pages acceptable?** Fix the weakest visible pages, especially blank fragments, cramped blocks, bland part dividers, and unreadable figure labels.
- **Is whitespace intentional?** If a page has only a few paragraphs, two cards, or five short tool items, the emptiness needs a composition: sparse item rows with larger headers, stacked mini-columns, a single-column closer, field note, large numeral, quote, plate, or bottom anchor. Unclaimed blank lower halves are failed pages.
- **Would the screenshot embarrass you?** Check at least one phone viewport and one representative dense chapter page. If text appears as a single broad column, if a key diagram is trapped in one column, if gutters/margins feel cramped, or if the view shows two page fragments separated by a gutter, keep working.
- **Can the diagram teach by itself?** If a diagram's logic is not obvious from its title, labels, rows, arrows, and connectors, simplify it. Turn decorative motion into explicit relationships; turn vague clusters into grids, sequences, or paired comparisons.
- **Is the diagram type earned?** A beautiful pattern from another page is still wrong when the relationship is different. Check that comparisons look like comparisons, sequences look like sequences, hierarchies look like hierarchies, and systems do not become decorative networks.
- **Is this too complex to draw by hand?** If a complex diagram would need many fragile SVG paths, overlapping layers, or realistic visual detail, generate a diagram image from a clear spec and overlay exact labels separately.
- **Do the icons belong together?** If icons look improvised, inconsistent, or clip-art-like, replace them with a single known icon pack and recheck the PDF render. Icons should support labels, not become a second confusing illustration layer.
- **Does the chapter start cleanly?** For editorial chapters, the first body page should feel composed while still beginning the reading. Use title hierarchy, measured columns, a small deck, pull quote, or an in-flow figure; do not add unrequested opener pages before the prose.
- **Do the inner pages have signature value?** For analytical books, at least a few pages should feel ownable: a canvas, model cards, anatomy spread, matrix, or field tool that a reader would photograph, revisit, or use.
- **Did the diagrams make it into the artifact?** For designed nonfiction, at least one real diagram or diagram-like tool should be present and verified, with 2-4 preferred. If the rendered report says diagrams are required but `diagramCount` is zero, keep working.
- **Did the visuals make it into the artifact?** Generated images must be saved in `assets/`, referenced by the HTML, and verified in the PDF.
- **Is the manuscript preserved?** Visual ambition is never a reason to silently drop or summarize source prose.

## Phase 8: Delivery

Clean up preview files only after the final book is accepted or when they are clearly temporary.

Tell the user:

- HTML file path
- PDF file path
- Approximate page count
- Preservation percentage
- Any generated or supplied assets used
- Any caveats, such as missing fonts, fallback export, or images that could not be generated

## Optional Sharing

If the user wants a public URL, use:

```bash
bash scripts/deploy.sh <path-to-book-folder-or-html>
```

For single HTML files with assets, prefer deploying the containing folder so image paths remain intact.

## Supporting Files

| File | Purpose | When to Read |
| ---- | ------- | ------------ |
| [STYLE_PRESETS.md](STYLE_PRESETS.md) | Book-specific visual systems and font/color guidance | Style discovery and final design |
| [page-base.css](page-base.css) | Mandatory Letter page and print CSS | Final HTML generation |
| [html-template.md](html-template.md) | HTML architecture for book pages, flowing chapters, figures, and controls | Final HTML generation |
| [animation-patterns.md](animation-patterns.md) | Subtle browser-only effects and visual pacing patterns | Only when interactive HTML polish helps |
| [references/pdf-optimization.md](references/pdf-optimization.md) | Scaffold-plus-enhancement, readiness-gated export, and rendered-state PDF verification guidance | JS-paginated, enhanced scaffold, or networkidle-sensitive books |
| [scripts/build-html-book.mjs](scripts/build-html-book.mjs) | Generic scaffold for Markdown manuscript parsing, book shell generation, cover options, and browser-side text pagination | Use for straightforward prose books or as a starting point before manuscript-specific customization |
| [scripts/book-browser.mjs](scripts/book-browser.mjs) | Shared Playwright server/export/verification implementation | Internal helper; inspect before changing exporter or verifier behavior |
| [scripts/book-browser-shell.sh](scripts/book-browser-shell.sh) | Shared shell parsing/path/opening helpers for browser wrapper scripts | Internal helper; inspect before changing shell wrapper behavior |
| [scripts/run-book-browser.sh](scripts/run-book-browser.sh) | Internal temp Playwright launcher for the shared browser runner | Internal helper used by export and verification scripts |
| [scripts/export-pdf.sh](scripts/export-pdf.sh) | Export Letter PDF from HTML | PDF delivery |
| [scripts/export-ready-pdf.sh](scripts/export-ready-pdf.sh) | Export Letter PDF after fonts/images/browser pagination are ready and text frames are checked | PDF delivery for JS-paginated or networkidle-sensitive books |
| [scripts/verify-html-book.sh](scripts/verify-html-book.sh) | Serve generated HTML, wait for pagination, check overflow, and capture desktop/mobile screenshots | Verification, especially after using the scaffold |
| [scripts/verify-rendered-book.sh](scripts/verify-rendered-book.sh) | Read rendered browser text, check overflow, and capture desktop/mobile feature screenshots | Verification for PDF-optimized, JS-paginated, or enhanced scaffold books |
| [scripts/inspect-pdf.sh](scripts/inspect-pdf.sh) | Inspect PDF page count/size and render a cover PNG with Poppler/macOS/PDF-byte fallbacks | Final PDF metadata and visual sanity check |
| [scripts/deploy.sh](scripts/deploy.sh) | Deploy HTML book to Vercel | Optional sharing |
