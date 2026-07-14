# Intake and Planning

## Intake defaults

- Infer book type from the source: textbook for instructional material, manual for procedural material, field guide for compact reference, coffee-table/editorial for evocative or image-led work.
- Use the supplied author. Ask only when no reliable author is available before final export. Never invent an imprint.
- Use diagrams freely. A newly generated cover bitmap is mandatory for every edition, including plain readers and user-supplied-image projects. Additional generated interior images remain optional when useful.
- Match a user-named theme or alias from `themes/index.mjs`; otherwise use `colbalt`.

## Content architecture

Preserve existing headings and paragraph order. Typical structure: cover, title, optional copyright/colophon, contents, source front matter, chapters/parts, figures/tools, and supported back matter.

The scaffold treats H1 as book metadata, H2 as chapters (or parts when the heading begins with `Part`), and H3/H4 as interior section headings. To intentionally promote one H3, append the explicit directive `{chapter}`. Empty chapter containers fail validation instead of producing hollow pages.

For missing headings, infer natural boundaries without summarizing prose away. Keep rough notes or duplicate boilerplate unless the user authorized editorial cleanup.

## Visual inventory

Identify processes, comparisons, hierarchies, systems, timelines, taxonomies, decisions, anatomy, exercises, tables, and strong image subjects. Classify only salient blocks in `book-plan.json`; ordinary prose needs no classification.

For each proposed visual, state its job, grammar, source IDs, placement, and rationale. Generated art is atmosphere or explanation, never fabricated evidence. A diagram decision also supplies bounded model-authored nodes, relationships, caption, and takeaway; grounding prose is not copied into display labels.

## Covers and section art

Every plan includes one manuscript-grounded `visuals.cover` subject, rationale, source IDs, focal point, unique `generationId`, and meaningful alt text. The bitmap must be generated specifically for the current manuscript, stored at the config-relative `coverImage` target, and contain no title, author, logo, or other typography. A CSS field, SVG, stock image, remote asset, interior image, or image from another book is not a valid cover.

Explore all five materially different cover routes as useful, but require artwork in every route. Ensure title readability at thumbnail size, one dominant idea, clear author placement, intentional crop/safe area, and no generic title-page treatment. The final selected cover—not only the options board—is the release gate.

Set `selectedCoverRoute` to `type`, `symbol`, `photo`, `minimal`, or `press`; the cover-options page and final cover use the same renderer. Use `themeOverrides` only for known palette keys and hex colors when adapting a preset without creating a new theme, for example `{"heading":"#003F88","accent":"#009C3B"}`.

Use distinct assets for the cover and every illustrated part divider. Keep a coherent visual series while varying the manuscript-grounded subject. Obtain the executable prompt and target crop guidance from `cover-image-request.json`; its prose comes only from the active theme module. Stop if the image-generation tool is unavailable—there is no cover waiver or typographic fallback.

Relative `outputDir` values resolve from the directory containing `book.json`. `outputHtml`, PDF, verification output, and local assets resolve within that normalized output directory; traversal and symlink escapes are rejected.
