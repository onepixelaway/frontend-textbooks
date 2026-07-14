# Intake and Planning

## Intake defaults

- Infer book type from the source: textbook for instructional material, manual for procedural material, field guide for compact reference, coffee-table/editorial for evocative or image-led work.
- Use the supplied author. Ask only when no reliable author is available before final export. Never invent an imprint.
- Use diagrams freely. Use generated images when available and useful unless the user requests supplied images only, diagrams only, or a plain reader edition.
- Match a user-named theme or alias from `themes/index.mjs`; otherwise use `colbalt`.

## Content architecture

Preserve existing headings and paragraph order. Typical structure: cover, title, optional copyright/colophon, contents, source front matter, chapters/parts, figures/tools, and supported back matter.

The scaffold treats H1 as book metadata, H2 as chapters (or parts when the heading begins with `Part`), and H3/H4 as interior section headings. To intentionally promote one H3, append the explicit directive `{chapter}`. Empty chapter containers fail validation instead of producing hollow pages.

For missing headings, infer natural boundaries without summarizing prose away. Keep rough notes or duplicate boilerplate unless the user authorized editorial cleanup.

## Visual inventory

Identify processes, comparisons, hierarchies, systems, timelines, taxonomies, decisions, anatomy, exercises, tables, and strong image subjects. Classify only salient blocks in `book-plan.json`; ordinary prose needs no classification.

For each proposed visual, state its job, grammar, source IDs, placement, and rationale. Generated art is atmosphere or explanation, never fabricated evidence.

## Covers and section art

For editorial, business, HBR-like, coffee-table, or visually led books, explore 4–5 materially different cover routes. Ensure title readability at thumbnail size, one dominant idea, clear author placement, and no generic title-page treatment.

Set `selectedCoverRoute` to `type`, `symbol`, `photo`, `minimal`, or `press`; the cover-options page and final cover use the same renderer. Use `themeOverrides` only for known palette keys and hex colors when adapting a preset without creating a new theme, for example `{"heading":"#003F88","accent":"#009C3B"}`.

Use distinct assets for the cover and every illustrated part divider. Keep a coherent visual series while varying the manuscript-grounded subject. Obtain prompt templates and target crop guidance from the active theme module; do not duplicate prompt prose elsewhere.
