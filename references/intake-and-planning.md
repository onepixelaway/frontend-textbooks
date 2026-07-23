# Intake and Planning

## Intake defaults

- Infer book type from the source: textbook for instructional material, manual for procedural material, field guide for compact reference, coffee-table/editorial for evocative or image-led work.
- Use an author only when it appears in an explicit manuscript byline, user-supplied metadata, or a direct user statement. Workspace paths, local account names, Git identity, filesystem ownership, and unrelated prior projects are not reliable evidence. When none of the reliable sources supplies a byline, ask the user before creating `book.json`; never infer the author or invent an imprint.
- Use diagrams freely. A newly generated cover bitmap is mandatory for every edition, including plain readers and user-supplied-image projects. Additional generated interior images remain optional when useful.
- Treat `colbalt` as the runtime fallback for legacy or direct configs, not the interactive workflow's silent choice. Every new book pauses for the color-and-typography decision below.

## Color and typography decision

Make this decision after manuscript analysis and source inventory, before writing `book-plan.json`. Consider the manuscript's subject, tone, audience, and cultural context. Prefer an editorial relationship to the material over a literal flag palette, genre cliché, or trendy gradient.

Ask one blocking question with three numbered visual-system choices:

1. Put the strongest manuscript-grounded recommendation first and label it **Recommended**.
2. Offer a restrained alternative with a meaningfully different temperature or contrast.
3. Offer an expressive alternative that remains credible for long-form reading.

For each choice, provide a short memorable name, one sentence connecting it to the content, five or six representative role-based hex swatches, and a display/body typography pairing identified by its registered `fontTheme`. Do not ask the user to choose individual tokens. Include a palette or bundled typeface the user supplied earlier, allow them to mix one listed palette with another listed typography pack, and always allow a different direction. Ask which visual system they want and wait; do not silently choose a default or continue to plan, generate cover art, or build.

After the answer, choose the closest registered base from `themes/index.mjs` for color and image-prompt behavior. Write that ID to `book.json.style`, express the color system with known `themeOverrides` keys, and write the selected bundled typography ID to `fontTheme` when it differs from `style`. The active theme's fonts remain the default when `fontTheme` is omitted. `book.json` remains the visual-system source of truth; `book-plan.json.theme.rationale` records why the user-selected color and typography suit the manuscript. Runtime prompt compilation uses only resolved colors, while the builder uses the independently resolved bundled typography.

Inspect registered packs with `node "$SKILL_DIR/scripts/font-catalog.mjs"`. If the user requests a Google Fonts family that no registered pack provides, do not silently substitute it or hand-author guessed metadata. Use `node "$SKILL_DIR/scripts/acquire-google-fonts.mjs" --example`, pin the request to an immutable official `google/fonts` commit, and run the helper with `--project-root` and `--request`. Copy its returned `fontOverrides` into `book.json`; do not also set `fontTheme`. Keep `fontMode` bundled so the pipeline copies, fingerprints, manifests, and verifies the custom local bundle without network access.

## Content architecture

Preserve existing headings and paragraph order. Typical structure: cover, title, optional copyright/colophon, contents, source front matter, chapters/parts, figures/tools, and supported back matter.

The scaffold treats H1 as book metadata, H2 as chapters (or parts when the heading begins with `Part`), and H3/H4 as interior section headings. To intentionally promote one H3, append the explicit directive `{chapter}`. Empty chapter containers fail validation instead of producing hollow pages.

For missing headings, infer natural boundaries without summarizing prose away. Keep rough notes or duplicate boilerplate unless the user authorized editorial cleanup.

## Visual inventory

Identify processes, comparisons, hierarchies, systems, timelines, taxonomies, decisions, anatomy, exercises, tables, quantitative exhibits, reusable frameworks, two-sided cases, and strong image subjects. Classify only salient blocks in `book-plan.json`; ordinary prose needs no classification.

For each proposed visual, state its job, grammar, source IDs, anchor, and rationale. Generated art is atmosphere or explanation, never fabricated evidence. A diagram decision also supplies bounded model-authored nodes, relationships, caption, and takeaway; grounding prose is not copied into display labels.

For substantial designed nonfiction, choose 2–4 full-page skim exhibits when supported and encode them in `visuals.featurePages`: `framework` for 3–6 portable lenses or steps, `scorecard` for exactly two entities with 2–4 matched metrics each, and `numbers` for 2–4 comparative panels with exactly two entries apiece and a qualified highlight. These are additive summaries placed after the grounded chapter; the original prose remains intact. At least one structured feature page is required by default. Use `waive-feature-pages` only when the source genuinely contains no defensible framework, comparison, or quantitative exhibit.

## Covers and section art

Every plan includes one manuscript-grounded `visuals.cover` subject, rationale, source IDs, focal point, unique `generationId`, and meaningful alt text. The bitmap must be generated specifically for the current manuscript, stored at the config-relative `coverImage` target, and contain no title, author, logo, or other typography. A CSS field, SVG, stock image, remote asset, interior image, or image from another book is not a valid cover.

Explore both supported cover routes: Photo lets the artwork lead with HTML typography integrated into the composition; Minimal uses a restrained crop, stronger negative space, and high-contrast typography. Require the same original artwork in both. Ensure title readability at thumbnail size, one dominant idea, clear author placement, and an intentional crop/safe area. The final selected cover—not only the options board—is the release gate.

Set `selectedCoverRoute` to `photo` or `minimal`; the cover-options page and final cover use the same renderer. Use `themeOverrides` only for known palette keys and hex colors when adapting a preset without creating a new theme, for example `{"heading":"#003F88","accent":"#009C3B"}`. These values must reflect the user's color-scheme choice above.

Use distinct assets for the cover and every illustrated part divider. Keep a coherent visual series while varying the manuscript-grounded subject. Obtain the executable prompt, compiled `palette.instruction`, and target crop guidance from `cover-image-request.json`; its non-palette prose comes only from the active theme module. Reuse the compiled palette instruction for every additional illustration while changing the grounded subject. Stop if the image-generation tool is unavailable—there is no cover waiver or typographic fallback.

Relative `outputDir` values resolve from the directory containing `book.json`. `outputHtml`, PDF, verification output, and local assets resolve within that normalized output directory; traversal and symlink escapes are rejected.
