# Book Style Presets

Use these as starting points only when the user mentions style/aesthetic, asks for visual directions, or the manuscript clearly needs a non-default treatment. Otherwise use the default editorial style below. The goal is not a theme pasted on top of text; it is a coherent book system.

Avoid generic AI aesthetics: purple gradients, identical cards, centered everything, system-font blandness, and decoration that fights the prose.

## Default Colbalt Editorial Theme

The scaffold source of truth for this default is [themes/colbalt/index.mjs](themes/colbalt/index.mjs). Keep font stacks, color tokens, and the generated-image prompt synchronized there first; this section documents the design language for agents and manual builds.

**Use by default when:** the user supplies a manuscript without mentioning style, aesthetic, or a named visual reference.

**Typography**

- Display/headings: `Poppins` 700
- Body: `Halant` 400
- UI/captions: `Poppins` 600-700

**Google Fonts**

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Halant:wght@400;500;600&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">
```

**Palette**

```css
:root {
  --browser-bg: #d7d7d3;
  --page-bg: #fbfaf6;
  --ink: #10131A;
  --heading-ink: #0A3695;
  --deck-ink: #19419A;
  --muted-ink: #2C3342;
  --label-ink: #69738F;
  --running-ink: #69738F;
  --accent: #4F76D9;
  --soft-accent: #B7C8F3;
  --steel: #19419A;
  --cover-band: #0A3695;
  --rule: #9BB2EA;
  --callout-bg: #f1f5ff;
  --font-display: "Poppins", "Avenir Next", Helvetica, Arial, sans-serif;
  --font-body: "Halant", Georgia, serif;
  --font-ui: "Poppins", "Avenir Next", Helvetica, Arial, sans-serif;
}
```

Palette roles:

- Large headline: deep cobalt ink `#0A3695`
- Subheadline/deck: editorial blue `#19419A`
- Body text: near-black ink navy `#10131A`
- Secondary body/captions: dark blue-gray `#2C3342`
- Small labels/metadata: muted blue-gray `#69738F`
- Accent marks, numerals, and selected rules: lighter cobalt blue `#4F76D9`
- Rules/soft accents: softened cobalt blue `#B7C8F3` and `#9BB2EA`

**Default generated image prompt**

Use `themes/colbalt/index.mjs` as the sole source for `imagePrompt.template`, crop guidance, and subject-placeholder rules. Replace only the concrete subject slot; do not duplicate or rewrite the template here.

**Signature elements**

- Poppins Bold headlines with generous leading and no negative letter spacing
- Halant body text in measured columns or a narrow single-column measure
- Warm paper, cobalt editorial hierarchy, muted metadata, and lighter cobalt-blue accents that keep pages from becoming monochrome
- Default cover composition: the required newly generated manuscript-grounded bitmap in the upper field, with title, subtitle, and author in a solid cobalt bottom band; target the upper field's roughly `1.14:1` aspect ratio and avoid dark overlays that obscure the artwork
- Cover-options sprint for all finished books, with the selected route matched in the final cover
- Designed body pages, chapter openers, diagrams, and tool pages when the manuscript supports them

## Alumni Theme

The scaffold source of truth is [themes/alumni/index.mjs](themes/alumni/index.mjs). It adapts a warm single-ink editorial system from the Long Table design reference: Bricolage Grotesque display type, Fraunces body and metadata, rust terracotta ink, and cream paper. Its generated-image prompt uses sunlit pastel Mediterranean editorial photography with a restrained focal composition.

## 1. Scholarly Marginalia

**Best for:** textbooks, histories, philosophy, research explainers, annotated essays.

**Typography**

- Display: `Cormorant Garamond` or `Fraunces`
- Body: `Source Serif 4`
- UI/captions: `IBM Plex Sans`

**Palette**

```css
:root {
  --browser-bg: #d9d2c4;
  --page-bg: #fbf7ed;
  --ink: #191714;
  --heading-ink: #15130f;
  --muted-ink: #6f6659;
  --accent: #8d2f24;
  --rule: #d8c9b7;
  --callout-bg: #f1e7d6;
}
```

**Signature elements**

- Wide margin notes and footnotes
- Small caps running heads
- Red-brown figure numbers
- Hairline rules and restrained diagrams
- Occasional source-faithful pull quotes

## 2. Field Guide Plates

**Best for:** nature, product guides, visual taxonomies, practical learning, food, craft, travel.

**Typography**

- Display: `Bricolage Grotesque`
- Body: `Literata`
- UI/captions: `DM Sans`

**Palette**

```css
:root {
  --browser-bg: #c7c0ad;
  --page-bg: #f7f1e5;
  --ink: #202018;
  --heading-ink: #1f2d22;
  --muted-ink: #657060;
  --accent: #3f6f46;
  --rule: #c8bda8;
  --callout-bg: #e8efdd;
}
```

**Signature elements**

- Numbered specimen plates
- Labeled diagram callouts
- Grid-based image pages
- Green rules and caption bands
- Useful legends, keys, and scales

## 3. Museum Monograph

**Best for:** coffee-table books, artist statements, design, architecture, photography, brand books.

**Typography**

- Display: `Bodoni Moda`
- Body: `Libre Baskerville`
- UI/captions: `Manrope`

**Palette**

```css
:root {
  --browser-bg: #1d1c19;
  --page-bg: #f4f0e7;
  --ink: #161512;
  --heading-ink: #11100e;
  --muted-ink: #5f5951;
  --accent: #b08a3c;
  --rule: #d4c7ae;
  --callout-bg: #eee3cf;
}
```

**Signature elements**

- Full-page plates with minimal captions
- Dramatic chapter openers
- Large serif titles
- Generous whitespace
- Gold or ochre accent rules

## 4. Technical Manual

**Best for:** engineering books, operations manuals, developer education, process documentation.

**Typography**

- Display: `Archivo`
- Body: `Source Sans 3`
- Mono: `JetBrains Mono`

**Palette**

```css
:root {
  --browser-bg: #c9d0d2;
  --page-bg: #ffffff;
  --ink: #15191d;
  --heading-ink: #0e2638;
  --muted-ink: #5b6770;
  --accent: #0b6fa4;
  --rule: #cdd8de;
  --callout-bg: #eaf4f8;
}
```

**Signature elements**

- Precise grids and numbered procedures
- Blue figure labels
- Code blocks and specs
- Flow diagrams, state machines, architecture maps
- Clear warning/note/tip callouts

## 5. Editorial Workbook

**Best for:** courses, self-study guides, workshops, reflective exercises, coaching material.

**Typography**

- Display: `Fraunces`
- Body: `Work Sans`
- UI/captions: `Work Sans`

**Palette**

```css
:root {
  --browser-bg: #d8d0c4;
  --page-bg: #fffaf2;
  --ink: #1f1b16;
  --heading-ink: #222018;
  --muted-ink: #6a6158;
  --accent: #d05d37;
  --rule: #decdbb;
  --callout-bg: #f5e3d7;
}
```

**Signature elements**

- Exercise boxes and answer lines
- Warm chapter dividers
- Friendly but not childish typography
- Progress markers and recap pages
- Diagrams that become fill-in worksheets when useful

## 6. Civic Report Book

**Best for:** policy, public-interest explainers, annual reports, organizational strategy, social research.

**Typography**

- Display: `Newsreader`
- Body: `Source Serif 4`
- UI/captions: `Public Sans`

**Palette**

```css
:root {
  --browser-bg: #cfd6d8;
  --page-bg: #fafafa;
  --ink: #141414;
  --heading-ink: #102432;
  --muted-ink: #596870;
  --accent: #b03a2e;
  --rule: #d0d8dc;
  --callout-bg: #eef3f4;
}
```

**Signature elements**

- Newspaper-like hierarchy
- Data tables with clear notes
- Timeline and stakeholder diagrams
- Pull stats in the margins
- Conservative color with strong red accents

## 6A. Executive Coffee-Table Review

**Best for:** intellectual business books, leadership essays, strategy field guides, founder/operator manuals, HBR-like editorial books that should feel serious but highly designed.

**Typography**

- Display: `Poppins` 700 by default; use `Newsreader`, `Tiempos Headline`, or `Libre Baskerville` only when the user asks for that aesthetic
- Body: `Halant` by default; use `Source Serif 4` or `Lyon Text` only when the user asks for that aesthetic
- UI/captions: `Poppins`, `Avenir Next`, `Inter`, or `IBM Plex Sans`

**Palette**

```css
:root {
  --browser-bg: #d7d7d3;
  --page-bg: #fbfaf6;
  --ink: #10131A;
  --heading-ink: #0A3695;
  --deck-ink: #19419A;
  --muted-ink: #2C3342;
  --label-ink: #69738F;
  --running-ink: #69738F;
  --accent: #4F76D9;
  --soft-accent: #B7C8F3;
  --steel: #19419A;
  --cover-band: #0A3695;
  --rule: #9BB2EA;
  --callout-bg: #f1f5ff;
}
```

**Signature elements**

- Generated editorial plates for major part dividers. Every cover route must visibly integrate the required bitmap; type-led and concept-led routes still use the art as a meaningful compositional field rather than an incidental sliver.
- Cover sprint required: create all five routes, varying the relationship between the same required art, typography, concept marks, full-bleed treatment, and restrained press/imprint system.
- Cover typography should feel like a designed object: extreme scale, condensed sans, expressive serif, mixed weight, or deliberate tracking. Avoid default Georgia/Times cover titles unless heavily customized.
- The title must read at thumbnail size. Test the chosen cover at around 100px wide before finalizing.
- Treat the selected route as the final-cover blueprint. The exported PDF cover should not gain unrelated middle marks, altered scale, or a different image crop after route selection.
- Include the author on the cover and title page. Include a publisher/imprint only when supplied.
- Cobalt headline hierarchy, editorial-blue decks, muted metadata, and faded-blue analytical rules
- Mix of spacious single-column essays, measured two-column analysis pages, and compact three-column field-guide/checklist pages
- Add signature interior tools where the manuscript supports them: a reusable canvas/framework spread, chapter-ending model cards, and one annotated failure/anatomy page. These should feel like designed editorial artifacts a reader would photograph or reuse, not generic callout boxes.
- Important chapter openings should often become two-page editorial spreads: large lowered serif title and either a spacious diagram or a text-led deck on the left; reduced two-column excerpt, airy line spacing, wide gutter, and large pull quote on the right. Continue the remaining manuscript afterward rather than dropping text, and resume with a quiet continuation header rather than repeating the full title immediately.
- Dense analytical chapters should use `.page.text-page.text-two` body pages by default with generous side margins and a visible 0.5in+ gutter; a full-width single column is only acceptable when deliberately narrowed with generous margins
- Medium-short final continuation pages should become `.text-stack` pages: two stacked bands of small columns with a clear reading path and a bottom anchor. Very short finals should become `.text-tail` single-column closers with a restrained rule, quote, or note. Do not leave two small columns stranded at the top of an otherwise empty sheet.
- Sparse working-model/tool pages should use the whole sheet compositionally: stacked mini-column bands, bottom-anchored notes, large numerals, or rule systems are preferable to a top-heavy grid with an empty lower half.
- Inline SVG or structured HTML/CSS diagrams for systems, loops, axes, and taxonomies, usually spanning the full text frame rather than being trapped in one prose column
- Choose the diagram grammar from the idea: comparison grids for contrasts, process flows for sequences, loops for recurrence, matrices for tradeoffs, anatomy callouts for failures or objects, and system maps only when relationships among parts are the point.
- For complex systems, realistic process anatomy, or multi-layer editorial diagrams, write a precise visual spec and generate a high-resolution diagram image rather than hand-coding fragile SVG. Keep exact labels and callouts as HTML/SVG overlays when fidelity matters.
- For two-track business concepts, use clear `.comparison-diagram` treatments: internal title, equal columns, paired rows, straight connectors, and one cobalt checkpoint or takeaway. Avoid squiggles, crossing curves, overlapping circles, and decorative complexity that obscures the business logic.
- Use one known outline icon pack, preferably Lucide, when icons improve scanning inside diagrams. Do not draw one-off icons by hand; mismatched icon quality cheapens an otherwise designed page.
- Generous whitespace and strong section pacing; avoid uninterrupted walls of prose
- Use short accent rules and quiet white space instead of boxed diagrams, center column rules, or full-width decorative hairlines unless the content genuinely needs those boundaries
- Atomic part dividers and visual plates that never split across PDF pages
- Mobile/browser view must collapse columns and avoid visible page gutters cutting through prose

## 7. Studio Zine Textbook

**Best for:** creative education, design classes, pop-culture analysis, independent publishing.

**Typography**

- Display: `Syne`
- Body: `IBM Plex Sans`
- Mono: `Space Mono`

**Palette**

```css
:root {
  --browser-bg: #202020;
  --page-bg: #f9f2de;
  --ink: #151515;
  --heading-ink: #151515;
  --muted-ink: #5f5a4f;
  --accent: #ee4e2e;
  --rule: #151515;
  --callout-bg: #f3d95f;
}
```

**Signature elements**

- Bold section labels
- Risograph-like accent blocks
- Rough rules and annotation arrows
- Collage-like image plates
- High-energy chapter openers

## 8. Quiet Literary Edition

**Best for:** essays, memoir, narrative nonfiction, philosophy, fiction-adjacent manuscripts.

**Typography**

- Display: `Cormorant Garamond`
- Body: `Crimson Text`
- UI/captions: `Alegreya Sans`

**Palette**

```css
:root {
  --browser-bg: #d3ccc0;
  --page-bg: #fcfaf5;
  --ink: #1b1814;
  --heading-ink: #1b1814;
  --muted-ink: #6e675f;
  --accent: #6c2d2a;
  --rule: #ddd2c3;
  --callout-bg: #f4eee4;
}
```

**Signature elements**

- Elegant title pages
- Drop caps at chapter starts
- Minimal figure use
- Fine running heads
- Text-first pages with careful rhythm

## Selection Guidance

- Use **Scholarly Marginalia** when the manuscript contains dense ideas and benefits from notes, citations, or conceptual diagrams.
- Use **Field Guide Plates** when the content classifies objects, techniques, places, organisms, recipes, tools, or examples.
- Use **Museum Monograph** when images and atmosphere should feel gallery-like and spacious.
- Use **Technical Manual** when precision, procedures, code, systems, or operational clarity matter.
- Use **Editorial Workbook** when the reader should write, practice, reflect, or complete exercises.
- Use **Civic Report Book** when credibility, evidence, and public-facing clarity matter.
- Use **Studio Zine Textbook** when the subject can support expressive creative energy.
- Use **Quiet Literary Edition** when prose should dominate and visuals should be restrained.

## CSS Gotchas

### Browser PDF Margins

Use `@page { size: letter; margin: 0; }` and put page margins inside `.page-inner` or `.chapter-flow`. Browser default margins will otherwise shrink and shift the design.

### Page Breaks

Apply `break-inside: avoid` to figures, tables, callouts, captions, and chapter openers. For long tables, split them manually instead of shrinking text below readable size.

### Full-Bleed Pages

Browser PDFs do not add real print bleed. For digital PDFs, full-bleed color can extend to page edges. For commercial print, ask the user if they need bleed/crop marks and create a separate print-shop version.

### Negating CSS Functions

Wrong:

```css
margin-left: -min(10vw, 100px);
```

Correct:

```css
margin-left: calc(-1 * min(10vw, 100px));
```
