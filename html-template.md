# HTML Textbook Template

Reference architecture for Frontend Textbooks outputs. The final artifact is an HTML book designed for US Letter PDF export.

Use this template as a starting point, not a literal requirement. The important invariants are:

- Letter page print rules
- Preserved manuscript prose
- Measured `.page.text-page` body pagination for designed prose books
- Semantic figures, diagrams, tables, and captions
- HTML and PDF produced from the same source file

## Recommended File Structure

```text
book-title/
  index.html
  book-title.pdf
  assets/
    chapter-01-opener.png
    figure-03-system-map.svg
```

For a single-file book with no external images, `[book-title].html` next to `[book-title].pdf` is fine.

## Base HTML

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Book Title</title>

  <!-- Default colbalt theme: Poppins Bold headings/UI and Halant body from Google Fonts. -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Halant:wght@400;500;600&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">

  <style>
    /* === THEME TOKENS: scaffold defaults live in themes/colbalt/index.mjs === */
    :root {
      --browser-bg: #d8d4cb;
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
      --cover-band-height: 3.55in;
      --cover-art-height: calc(11in - var(--cover-band-height));
      --cover-art-aspect: 1.141;
      --rule: #9BB2EA;
      --callout-bg: #f1f5ff;

      --font-display: "Poppins", "Avenir Next", Helvetica, Arial, sans-serif;
      --font-body: "Halant", Georgia, serif;
      --font-ui: "Poppins", "Avenir Next", Helvetica, Arial, sans-serif;

      --page-margin-top: 0.72in;
      --page-margin-bottom: 0.72in;
      --page-margin-inner: 0.74in;
      --page-margin-outer: 0.74in;
    }

    /* === PASTE page-base.css CONTENTS HERE === */

    /* === BOOK-SPECIFIC DESIGN === */
    /* Default split-cover art slot: 8.5in x 7.45in, aspect ~1.14:1. */
    .cover {
      background: var(--cover-band);
    }

    .cover .page-inner {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      display: grid;
      align-content: center;
      min-height: var(--cover-band-height);
      height: var(--cover-band-height);
      padding: 0.48in 0.62in 0.56in;
      background: var(--cover-band);
      color: white;
    }

    .cover-image-field {
      position: absolute;
      inset: 0 0 var(--cover-band-height);
      background: var(--page-bg);
    }

    .cover-title {
      max-width: 6.6in;
      font-size: 44pt;
      letter-spacing: 0;
      color: white;
    }

    .cover-subtitle {
      max-width: 6.2in;
      margin-top: 0.18in;
      font-family: var(--font-ui);
      font-size: 12pt;
      font-weight: 700;
      line-height: 1.35;
      color: white;
      text-indent: 0;
    }

    .toc-list {
      list-style: none;
      margin: 0.35in 0 0;
      padding: 0;
    }

    .toc-list li {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0.12in;
      align-items: baseline;
      margin-bottom: 0.16in;
    }

    .toc-list li::after {
      content: "";
      border-bottom: 1px dotted var(--rule);
      transform: translateY(-0.08em);
    }

    .chapter-kicker,
    .eyebrow {
      font-family: var(--font-ui);
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.11em;
      text-transform: uppercase;
      color: var(--accent);
    }

    .diagram-card {
      padding: 0.18in 0;
      border: 0;
      background: transparent;
    }

    .part-image-page .page-inner {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.35in;
      align-items: stretch;
    }

    .part-image-page img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .part-image-copy {
      align-self: center;
    }
  </style>
</head>

<body>
  <div class="book-controls screen-only" aria-label="Book controls">
    <button type="button" onclick="window.print()">Print / Save PDF</button>
  </div>

  <main class="book-shell">
    <article class="book" id="book">
      <section class="page cover" aria-label="Cover">
        <div class="cover-image-field" aria-hidden="true"></div>
        <div class="page-inner">
          <p class="eyebrow no-indent">Textbook</p>
          <h1 class="cover-title">Book Title From Manuscript</h1>
          <p class="cover-subtitle">Subtitle or short manuscript-derived promise.</p>
        </div>
      </section>

      <section class="page title-page" aria-label="Title page">
        <div class="page-inner">
          <h1>Book Title</h1>
          <p class="lede no-indent">Author or source attribution.</p>
        </div>
      </section>

      <section class="page" aria-label="Table of contents">
        <div class="page-inner">
          <h2>Contents</h2>
          <ol class="toc-list">
            <li><span>Chapter 1</span><span></span><span>3</span></li>
            <li><span>Chapter 2</span><span></span><span>17</span></li>
          </ol>
        </div>
      </section>

      <section class="page text-page text-two" aria-label="Chapter 1">
        <div class="page-inner">
          <header class="text-page-header">
            <p class="chapter-kicker no-indent">Chapter 1</p>
            <h1 class="text-page-title">Chapter Title</h1>
          </header>
          <div class="text-frame">
            <p>The opening manuscript prose starts on the same page as the chapter title.</p>
          </div>
          <div class="page-number">3</div>
        </div>
      </section>

      <section class="page part-image-page" aria-label="Part opener with generated image">
        <div class="page-inner">
          <figure class="image-plate">
            <img src="assets/part-01-foundations.png" alt="Editorial image grounded in the chapter theme">
            <figcaption><span class="figure-number">Plate 1</span> Caption grounded in manuscript language.</figcaption>
          </figure>
          <div class="part-image-copy">
            <p class="chapter-kicker no-indent">Part I</p>
            <h1>Foundations</h1>
            <p class="lede no-indent">Use a short source-faithful excerpt. Keep the full text in the following chapters.</p>
          </div>
        </div>
      </section>

      <section class="page" aria-label="Designed figure page">
        <div class="page-inner">
          <p class="running-head">Chapter 1</p>
          <h2>Conceptual Map</h2>
          <figure class="diagram-card">
            <svg viewBox="0 0 640 360" role="img" aria-label="Diagram title">
              <rect x="30" y="130" width="160" height="80" rx="10" fill="none" stroke="currentColor"/>
              <rect x="240" y="80" width="160" height="80" rx="10" fill="none" stroke="currentColor"/>
              <rect x="450" y="170" width="160" height="80" rx="10" fill="none" stroke="currentColor"/>
              <path d="M190 170 C220 150 220 130 240 120" fill="none" stroke="currentColor"/>
              <path d="M400 130 C430 145 430 190 450 205" fill="none" stroke="currentColor"/>
              <text x="110" y="176" text-anchor="middle" font-size="18">Source term</text>
              <text x="320" y="126" text-anchor="middle" font-size="18">Core idea</text>
              <text x="530" y="216" text-anchor="middle" font-size="18">Outcome</text>
            </svg>
            <figcaption><span class="figure-number">Figure 1.1</span> Caption grounded in manuscript language.</figcaption>
          </figure>
          <div class="page-number">4</div>
        </div>
      </section>

      <section class="page text-page text-two" aria-label="Two-column analytical body page">
        <div class="page-inner">
          <header class="text-page-header">
            <p class="chapter-kicker no-indent">Chapter 1</p>
            <h1 class="text-page-title">Two-Column Body Treatment</h1>
          </header>
          <div class="text-frame">
            <figure class="diagram-card">
              <svg viewBox="0 0 720 240" role="img" aria-label="Full-width analytical figure">
                <rect x="40" y="64" width="150" height="86" fill="#0A3695"/>
                <rect x="285" y="64" width="150" height="86" fill="#19419A"/>
                <rect x="530" y="64" width="150" height="86" fill="#10131A"/>
                <path d="M190 107 H285 M435 107 H530" stroke="#9BB2EA" stroke-width="4"/>
                <text x="115" y="113" text-anchor="middle" fill="#fff" font-size="18" font-weight="700">Model</text>
                <text x="360" y="113" text-anchor="middle" fill="#fff" font-size="18" font-weight="700">Branch</text>
                <text x="605" y="113" text-anchor="middle" fill="#fff" font-size="18" font-weight="700">Decide</text>
              </svg>
              <figcaption><span class="figure-number">Figure 1.2</span> Important diagrams span the full text frame before prose returns to columns.</figcaption>
            </figure>
            <p>Use two-column atomic text pages for dense analytical passages, field examples, and business-book sections where the rhythm benefits from scanning and comparison.</p>
            <p>Fill each text frame only until it fits. If the content overflows, create another `.page.text-page.text-two` and continue there. Do not let a fixed-format page split across browser/PDF pages.</p>
          </div>
        </div>
      </section>

      <section class="page text-page text-three" aria-label="Three-column compact field-guide page">
        <div class="page-inner">
          <header class="text-page-header">
            <p class="chapter-kicker no-indent">Field guide</p>
            <h1 class="text-page-title">Three-Column Compact Treatment</h1>
          </header>
          <div class="text-frame">
            <p>Use three columns sparingly for compact taxonomies, checklists, glossaries, meeting-type guides, and short procedural material.</p>
            <p>Do not use three columns for long narrative passages that need slower reading.</p>
          </div>
        </div>
      </section>
    </article>
  </main>

  <script>
    /* === PRINT HELPER === */
    window.addEventListener("beforeprint", () => {
      document.documentElement.classList.add("is-printing");
    });

    window.addEventListener("afterprint", () => {
      document.documentElement.classList.remove("is-printing");
    });
  </script>
</body>
</html>
```

## Explicit Pages vs Flowing Text

Use explicit `.page` sections for:

- Cover and title page
- Table of contents
- Chapter body text pages
- Full-page image plates
- Full-page diagrams
- Designed tables and workbook pages
- Section dividers

Use `.page.text-page` sections for normal preserved manuscript prose in designed books. Create as many continuation pages as needed, fill each `.text-frame` only until it fits, and continue the chapter on another `.page.text-page`.

Use `.chapter-flow` only when the output is intentionally a plain reader, or for appendices, notes, bibliography, and other back matter where designed body pages are not the goal. Mark intentional long flow prose with `data-allow-flowing-prose="true"` on the `.book` root or on the specific `.chapter-flow` section:

```html
<article class="book" id="book" data-allow-flowing-prose="true">
  <section class="chapter-flow" aria-label="Plain reader chapter">
    <h1>Chapter Title</h1>
    <p>Long preserved manuscript prose may flow here only for a deliberate plain-reader edition.</p>
  </section>
</article>
```

Do not use `<section class="chapter-flow flow-single">` as the default chapter body in an editorial, HBR-like, field-guide, business, or coffee-table book. A designed book with substantial body prose but no `.text-frame` pages is a failed layout.

## Atomic Page Integrity

Every explicit `.page` is a fixed Letter sheet and must start on a fresh PDF page. Do not let fixed-height pages enter the middle of a flowing text page.

Required CSS behavior:

```css
.page {
  height: 11in;
  break-before: page;
  break-after: page;
  break-inside: avoid;
  page-break-before: always;
  page-break-after: always;
  page-break-inside: avoid;
}

.page:first-child {
  break-before: auto;
  page-break-before: auto;
}
```

If a part divider, plate, figure page, or other fixed-format page appears partly on one page and leaves a blank remainder on the next page, the export is not acceptable. Fix the structure or CSS and re-export.

## Editorial Rhythm

For editorial and coffee-table books, choose a deliberate mix:

- `.page.text-page.text-single` for quiet, spacious narrative pages.
- `.page.text-page.text-two` for dense analytical chapters and business essay sections.
- `.page.text-page.text-three` for compact taxonomies, checklists, and field-guide material.
- `.page.text-page.text-short-single` for short final prose pages, roughly under 1,300 characters, where two columns would leave stranded text and blank space.
- `.page.text-page.text-stack` for medium-short continuation pages or compact tool pages where two stacked bands of small columns feel more intentional than a normal half-empty two-column page.
- `.sparse-item-rows` inside an atomic tool/canvas page for 4-6 short items where equal columns would create tall empty lanes.
- `.page.image-plate` or image-backed part pages for visual pacing.

Do not use multi-column text as decoration. Use it where the manuscript's structure supports scanning, comparison, or short modular ideas.

For field tools, canvases, or frameworks with 4-6 items and only a sentence or two per item, do not use equal-width vertical columns. Use rows with larger item headers and short explanatory copy so the white space reads as a designed list rather than empty column height.

Do not add visible continuation labels such as `continued`, `text`, or `<span class="continuation-mark">...</span>` to repeated text-page titles. Use the same title, a quieter running header, or an `aria-label` for continuation semantics; the visible page should never show a stray continuation word beside the title.

Cover art is not an interior plate by default. Do not add a standalone frontispiece/opening plate that simply repeats the cover image after the table of contents. If the book needs an opening plate, generate or place a distinct manuscript-grounded asset for that page.

Every major part or section divider should have its own generated or supplied image asset unless the user explicitly requested a plain/no-image edition or image generation is unavailable. Use the same split format as the default cover when using the default style: upper artwork field, solid cobalt text band, matching aspect ratio, and a distinct section-grounded subject.

For executive, HBR-like, or coffee-table pages, two columns should still feel spacious. Favor 0.82in+ side margins, a 0.5in+ gutter, no center rule by default, and short accent rules over full-width decorative lines. Important figures, diagrams, and tables should span the text frame (`column-span: all`) unless explicitly marked as `.inline-figure` or `.inline-table`.

Important PDF caveat: do not apply CSS multi-column layout to long flowing chapters unless you render and inspect continuation pages. Browser PDF engines can fragment long multi-column flows with clipped top text or large blank lower halves. For editorial book rhythm, bounded atomic feature pages are usually safer than multi-column chapter flows.

## Chapter Starts

For editorial, HBR-like, coffee-table, business, and visually led instructional books, the chapter start should begin the reading rather than delay it. Do not create two-page opening spreads or standalone title/deck opener pages by default. The next page after a part/section divider should usually be a `.text-page` that contains chapter metadata, the chapter title, and the opening manuscript prose.

Pattern:

```html
<section class="page text-page text-two" aria-label="Chapter 6">
  <div class="page-inner">
    <header class="text-page-header">
      <p class="chapter-kicker no-indent">Chapter 6 <span>Part III</span></p>
      <h1 class="text-page-title">Before: Building the Model and Setting the Table</h1>
      <p class="chapter-deck no-indent">A short source-faithful deck may sit here when it helps orient the page.</p>
    </header>
    <div class="text-frame">
      <p>The first manuscript paragraph starts here, on the same page as the title.</p>
      <p>Continue the chapter prose normally. Do not insert a separate opener page before this body page.</p>
    </div>
  </div>
</section>
```

If a chapter needs an opening figure, place it in the body flow:

```html
<section class="page text-page text-two" aria-label="Chapter 6">
  <div class="page-inner">
    <header class="text-page-header">
      <p class="chapter-kicker no-indent">Chapter 6 <span>Part III</span></p>
      <h1 class="text-page-title">Before: Building the Model and Setting the Table</h1>
    </header>
    <div class="text-frame">
      <figure class="span-all">
        <svg viewBox="0 0 620 240" role="img" aria-label="Diagram title"></svg>
        <figcaption><span class="figure-number">Figure 6.1</span> Caption grounded in the manuscript.</figcaption>
      </figure>
      <p>The first manuscript paragraph follows the figure on the same prose page.</p>
    </div>
  </div>
</section>
```

Design rules:

- Use title hierarchy, a small deck, a source-faithful pull quote, or an in-flow figure to make the first body page feel composed.
- Do not use `.chapter-opener`, `.editorial-spread`, `.spread-left`, or `.spread-right` unless the user explicitly requests chapter-opening spreads.
- If the user explicitly requests chapter-opening spreads, mark the spread pages with `data-allow-opening-spread="true"` so verification can distinguish intentional spreads from accidental filler.
- The default cobalt editorial palette fits intellectual business and field-guide prompts; adapt the palette only when the brief calls for a different aesthetic.

## Signature Interior Tool Pages

For business, strategy, instructional, field-guide, workbook, HBR-like, or analytical books, add a small system of designed interior tools when the manuscript supports it. These pages should feel reusable and ownable, not like generic sidebars.

Recommended page types:

- `.canvas-page`: a framework/canvas spread with labeled zones, short prompts, and generous whitespace.
- `.model-card-page`: chapter-ending or part-ending cards that translate source ideas into compact reusable models.
- `.anatomy-page`: an annotated failure/case/object/process page that labels visible action, hidden dynamic, failure point, and prepared move.

Pattern:

```html
<section class="page canvas-page" aria-label="Framework canvas">
  <div class="page-inner">
    <p class="chapter-kicker no-indent">Field tool</p>
    <h1>Reusable Canvas Title</h1>
    <p class="tool-intro no-indent">One source-faithful sentence explaining when to use the canvas.</p>
    <div class="canvas-grid">
      <section><span>01</span><h2>Zone label</h2><p>Short prompt grounded in the manuscript.</p></section>
      <section><span>02</span><h2>Zone label</h2><p>Short prompt grounded in the manuscript.</p></section>
      <section><span>03</span><h2>Zone label</h2><p>Short prompt grounded in the manuscript.</p></section>
      <section><span>04</span><h2>Zone label</h2><p>Short prompt grounded in the manuscript.</p></section>
    </div>
  </div>
</section>

<section class="page model-card-page" aria-label="Chapter model cards">
  <div class="page-inner">
    <p class="chapter-kicker no-indent">Chapter models</p>
    <h1>Models To Reuse</h1>
    <div class="model-card-grid">
      <article><p class="model-label no-indent">Core model</p><h2>Model name</h2><p>Concise source-faithful description.</p></article>
      <article><p class="model-label no-indent">Failure mode</p><h2>What goes wrong</h2><p>Concise source-faithful description.</p></article>
      <article><p class="model-label no-indent">Prepared move</p><h2>What to do</h2><p>Concise source-faithful description.</p></article>
    </div>
  </div>
</section>

<section class="page anatomy-page" aria-label="Annotated failure anatomy">
  <div class="page-inner">
    <p class="chapter-kicker no-indent">Failure anatomy</p>
    <h1>Scenario Or Object Being Annotated</h1>
    <div class="anatomy-layout">
      <figure class="anatomy-figure" aria-label="Annotated diagram or scenario">
        <!-- SVG, image, or structured diagram here. -->
      </figure>
      <aside class="anatomy-notes">
        <p><strong>Visible:</strong> What everyone sees.</p>
        <p><strong>Hidden:</strong> The underlying dynamic.</p>
        <p><strong>Failure:</strong> Where the unprepared version breaks.</p>
        <p><strong>Move:</strong> The prepared response.</p>
      </aside>
    </div>
  </div>
</section>
```

Design guidance:

- Use these pages to duplicate and clarify ideas, never to replace manuscript paragraphs.
- Keep labels short, concrete, and transferable. The same class names should work for a business canvas, recipe workflow, architecture anatomy, or study guide.
- Use whitespace, rules, numbers, and arrows before adding boxes inside boxes.
- Render the final PDF pages and inspect them visually; these tool pages are art-directed and must not clip.

## Diagram Grammar

Choose the diagram type from the manuscript relationship, not from a page you liked earlier.

| Manuscript relationship | Use this visual grammar | Avoid |
| --- | --- | --- |
| Contrast, tradeoff, before/after | Comparison grid, paired columns, or matrix | Decorative split screens with no row mapping |
| Ordered steps or causality | Numbered timeline or process flow | Loops unless the process repeats |
| Recurring cycle | Circular or racetrack loop with numbered stages | Arrows that imply recurrence when none exists |
| Hierarchy or decomposition | Tree, layered stack, pyramid, or nested zones | Network maps for parent-child relationships |
| System of interacting parts | Node-link map, hub/spoke, or layered system map | Too many crossing edges; split into layers instead |
| Two criteria or strategic choices | 2x2 matrix or axis chart | Arbitrary quadrants without meaningful axes |
| Object, scenario, page, or failure anatomy | Annotated callouts tied to visible parts | Floating labels that do not point to anything |
| Reusable planning tool | Canvas/grid with labeled zones and prompts | Generic cards that do not form a tool |

Rules:

- Write a one-sentence diagram premise before drawing.
- Keep the number of visual relationships lower than the number of facts in the source. The caption can carry nuance; the diagram should carry structure.
- Use icons only when they improve scanning. Labels, numbers, arrows, and spacing often explain more than icons.
- If no relationship type is clear, use a table, pull quote, or prose callout instead of inventing a diagram.

## Generated Complex Diagram Images

Use a generated diagram image when the visual needs realistic objects, spatial depth, rich editorial illustration, many interacting parts, or a scene/anatomy that would become brittle as hand-coded SVG. Generate only after writing a clear spec. For exact text, prefer HTML/SVG overlays on top of the generated base image.

Spec checklist:

- **Purpose:** what the reader should understand in one sentence.
- **Grammar:** comparison, process, cycle, hierarchy, system map, matrix, anatomy, or canvas.
- **Entities:** the objects, actors, zones, stages, or nodes that must appear.
- **Relationships:** what connects to what, in what direction, and why.
- **Reading order:** where the eye starts, how it moves, and where it lands.
- **Text plan:** which labels must be exact and should be overlaid outside the generated image.
- **Style:** book-specific palette, line quality, paper/background, icon or illustration style.
- **Constraints:** no extra labels, no fake data, no decorative clutter, no illegible microtext.
- **Output:** target size, aspect ratio, filename, and whether it needs transparent or paper-colored background.

Pattern:

```html
<figure class="diagram-card generated-diagram">
  <!-- Spec summary: purpose, grammar, entities, relationships, reading order, text overlay plan. -->
  <div class="generated-diagram-frame">
    <img src="assets/figure-04-complex-system.png" alt="Concise description of the generated diagram">
    <div class="diagram-overlay label-one">Exact label</div>
    <div class="diagram-overlay label-two">Exact callout</div>
  </div>
  <figcaption><span class="figure-number">Figure 4.2</span> Caption grounded in manuscript language.</figcaption>
</figure>
```

Rules:

- Generate at print-safe size: at least 1600px wide for in-page figures, 2400px+ on the long side for full-page plates.
- If generated text is inaccurate or tiny, remove it from the image prompt and overlay exact labels in HTML/SVG.
- Verify the image in the exported PDF, not just in the browser.
- Do not use image generation to hide unclear thinking. If the relationship can be explained with a simple vector diagram, use SVG/HTML instead.

## Clear Comparison Diagrams

Use `.comparison-diagram` when the manuscript contrasts two tracks, states, behaviors, roles, causes, or outcomes. The diagram should read before the caption: one internal title, two equal columns, directly paired rows, straight connectors, and one bottom checkpoint or takeaway. If icons help scanning, use one known icon pack, preferably Lucide for clean editorial outline diagrams. Do not hand-draw one-off icons.

Pattern:

```html
<figure class="diagram-card comparison-diagram">
  <h3 class="comparison-title">Preparation splits into two tracks</h3>
  <div class="comparison-map">
    <div class="comparison-head is-dark">Visible Prep</div>
    <div aria-hidden="true"></div>
    <div class="comparison-head">Room Model</div>

    <div class="comparison-cell is-dark">
      <svg class="comparison-icon" aria-hidden="true"><use href="#lucide-presentation"></use></svg>
      <span>Deck polished</span>
    </div>
    <div class="comparison-connector" aria-hidden="true"></div>
    <div class="comparison-cell">
      <svg class="comparison-icon" aria-hidden="true"><use href="#lucide-crosshair"></use></svg>
      <span>Decision located</span>
    </div>

    <div class="comparison-cell is-dark">Open rehearsed</div>
    <div class="comparison-connector" aria-hidden="true"></div>
    <div class="comparison-cell">Objections named</div>

    <div class="comparison-cell is-dark">Notes reread</div>
    <div class="comparison-connector" aria-hidden="true"></div>
    <div class="comparison-cell">Floor set</div>

    <div class="comparison-cell is-dark">Agenda complete</div>
    <div class="comparison-connector" aria-hidden="true"></div>
    <div class="comparison-cell">Branches mapped</div>
  </div>
  <div class="comparison-checkpoint">Room Test<br>Not Ritual</div>
  <figcaption><span class="figure-number">Figure 1.1</span> Caption grounded in manuscript language.</figcaption>
</figure>
```

Rules:

- Use the paired-row pattern only when each row has a meaningful counterpart. If the relationship is sequential, use a timeline or process flow instead.
- Keep columns equal in width and row baselines aligned. Never offset items merely to make the diagram feel dynamic.
- Use straight connectors for direct mappings. Avoid squiggles, crossing arrows, ornamental curves, and overlapping marks unless they encode a specific concept.
- Use one cobalt checkpoint, badge, result, or warning at the end. Multiple competing badges make the diagram harder to read.
- Source icons from one real icon pack, not hand-drawn paths. For PDF reliability, inline the pack's SVG symbols in the document or copy the exported SVG assets into `assets/` and reference them locally.

## Measured Text-Page Pagination

For editorial/coffee-table body prose, use measured `.text-page` pagination instead of long `.chapter-flow`. Reserve `.chapter-flow` for intentional plain-reader or appendix material marked with `data-allow-flowing-prose="true"`.

Required behavior:

1. Create a new `.page.text-page.text-two` for dense analytical prose.
2. Append manuscript blocks into `.text-frame` until it fits.
3. If `textFrame.scrollHeight > textFrame.clientHeight`, remove the last block, start a new `.text-page`, and append the block there.
4. Repeat until the chapter is fully preserved.
5. If the final text page has simple prose under roughly 1,300 characters, add `.text-short-single` so the frame becomes one left-aligned column about 1.3x the usual single-column measure.
6. Before export, assert that every `.text-frame` fits vertically and horizontally. Hidden column overflow can appear as `scrollWidth > clientWidth`, not just excess height.
7. Treat headings plus their following paragraph/list as a keep-with-next unit before measuring, so a page never ends with a stranded heading.

Minimal browser-side paginator pattern:

```html
<template id="text-page-template">
  <section class="page text-page text-two">
    <div class="page-inner">
      <header class="text-page-header"></header>
      <div class="text-frame"></div>
    </div>
  </section>
</template>

<script>
  function paginationUnits(blocks) {
    const units = [];
    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      const isHeading = block.matches?.("h2, h3");
      const next = blocks[index + 1];
      if (isHeading && next) {
        const wrapper = document.createElement("div");
        wrapper.className = "keep-with-next";
        wrapper.appendChild(block);
        wrapper.appendChild(next);
        units.push(wrapper);
        index += 1;
      } else {
        units.push(block);
      }
    }
    return units;
  }

  function paginateBlocks({ blocks, mount, title, kicker, columns = "text-two" }) {
    const template = document.getElementById("text-page-template");
    let page = null;
    let frame = null;

    function newPage() {
      page = template.content.firstElementChild.cloneNode(true);
      page.classList.remove("text-two", "text-three", "text-single");
      page.classList.add(columns);
      page.querySelector(".text-page-header").innerHTML = `
        <p class="chapter-kicker no-indent">${kicker}</p>
        <h1 class="text-page-title">${title}</h1>
      `;
      frame = page.querySelector(".text-frame");
      mount.appendChild(page);
    }

    newPage();
    for (const block of paginationUnits(blocks)) {
      frame.appendChild(block);
      if (frame.scrollHeight > frame.clientHeight || frame.scrollWidth > frame.clientWidth) {
        frame.removeChild(block);
        newPage();
        frame.appendChild(block);
        if (frame.scrollHeight > frame.clientHeight || frame.scrollWidth > frame.clientWidth) {
          throw new Error("A single manuscript block is too large for one text page; split it or restyle it.");
        }
      }
    }

    for (const textFrame of mount.querySelectorAll(".text-frame")) {
      if (textFrame.scrollHeight > textFrame.clientHeight || textFrame.scrollWidth > textFrame.clientWidth) {
        throw new Error("Text page overflow detected before export.");
      }
    }
  }
</script>
```

Mobile rule: the base CSS collapses `.text-two` and `.text-three` to one column under 920px, removes internal text-frame overflow, and collapses consecutive `.text-page` sheets into a continuous reader. Do not override that with fixed desktop scaling; mobile HTML must read as a continuous article, not as shrunken Letter pages with gutters cutting through prose.

## Sparse Item Rows

Use `.sparse-item-rows` for compact canvas/tool pages with 4-6 short items. This is the default fix for pages where five equal columns would create tall empty lanes. Each row should have a larger header and a concise explanation, with any closing note or field prompt placed in a bottom anchor that reserves real layout space.

Pattern:

```html
<section class="page sparse-feature" aria-label="Meeting canvas">
  <div class="page-inner">
    <header>
      <p class="chapter-kicker no-indent">Reusable field tool</p>
      <h1>The Meeting Canvas</h1>
      <p class="lede no-indent">Before any meeting that matters, sketch the five parts.</p>
    </header>
    <div class="sparse-item-rows" role="list">
      <section role="listitem">
        <h3>People</h3>
        <p>Who is really in the room, what each wants, and who quietly holds the pen?</p>
      </section>
      <section role="listitem">
        <h3>Current State</h3>
        <p>What does the room already know, believe, feel, or avoid saying out loud?</p>
      </section>
      <section role="listitem">
        <h3>Movement</h3>
        <p>Where will the conversation speed up, stall, fork, or defer?</p>
      </section>
      <section role="listitem">
        <h3>Outcome</h3>
        <p>What must be true when you leave, and what is the floor if it does not all go your way?</p>
      </section>
      <section role="listitem">
        <h3>Setting</h3>
        <p>What about time, sequence, mood, pressure, or audience will shape the room?</p>
      </section>
    </div>
    <aside class="feature-anchor" aria-hidden="true">
      <div class="feature-anchor-number">05</div>
      <p class="feature-anchor-note no-indent">A short source-faithful field note that claims the lower page.</p>
    </aside>
  </div>
</section>
```

Use rows when the item count is small and the copy is brief. Use columns only when each column has enough text or substructure to occupy its height intentionally.

## Short Single-Column Pages

Use `.text-short-single` when the final continuation page has simple prose under roughly 1,300 characters. Keep the page left aligned, not centered, and let the text frame use `--short-single-width` (about 1.3x the normal single-column measure, capped by the page frame). This is the default fix for pages where two columns would leave a few short lines and a large empty lower half.

Pattern:

```html
<section class="page text-page text-two text-short-single continuation" aria-label="Chapter continued">
  <div class="page-inner">
    <header class="text-page-header">
      <p class="chapter-kicker no-indent">Chapter 4 <span>Part II</span></p>
      <h1 class="text-page-title">What Being Ready Means</h1>
    </header>
    <div class="text-frame">
      <p>Short final source paragraph, set as one wider left-aligned measure.</p>
      <p>Use this instead of leaving the text split into two sparse columns.</p>
    </div>
  </div>
</section>
```

## Stacked Mini-Column Pages

Use `.text-stack` when a continuation or tool page has enough material to deserve structure, but not enough to fill a normal two-column reading page. The page should read in bands: top-left to top-right, then second row. Keep the row count small, and use the bottom anchor to make the empty space feel chosen.

Pattern:

```html
<section class="page text-page text-stack continuation" aria-label="Chapter continued">
  <div class="page-inner">
    <header class="text-page-header">
      <p class="chapter-kicker no-indent">Chapter 2 <span>Part I</span></p>
      <h1 class="text-page-title">A Meeting Is a System</h1>
    </header>
    <div class="text-frame">
      <div class="text-stack-row">
        <section class="text-stack-cell">
          <p>Source paragraph or short grouped passage.</p>
        </section>
        <section class="text-stack-cell">
          <p>Next source paragraph or short grouped passage.</p>
        </section>
      </div>
      <div class="text-stack-row">
        <section class="text-stack-cell">
          <p>Optional second-row passage when the page needs another band.</p>
        </section>
        <section class="text-stack-cell">
          <p>Optional paired passage, model note, or short source-faithful list.</p>
        </section>
      </div>
    </div>
    <aside class="text-stack-anchor" aria-hidden="true">
      <p class="stack-anchor-label no-indent">Chapter close</p>
      <p class="stack-anchor-note no-indent">A source-faithful sentence, chapter number, or field note that anchors the lower page.</p>
    </aside>
  </div>
</section>
```

Use `.text-stack` for medium-short pages, not tiny tails. If the page has only one paragraph or two, use `.text-tail` instead. If it has a full page of prose, keep normal `.text-two` pagination.

## Short Tail Pages

If the final continuation page of a chapter has very little text, convert it into a designed closer rather than leaving two short columns at the top of a mostly blank page.

Pattern:

```html
<section class="page text-page text-tail continuation" aria-label="Chapter continued">
  <div class="page-inner">
    <header class="text-page-header">
      <p class="chapter-kicker no-indent">Chapter 8 <span>Part III</span></p>
      <h1 class="text-page-title">After: Closing the Loop</h1>
    </header>
    <div class="text-frame">
      <p>Short final source paragraph or two, set as a composed single column.</p>
    </div>
    <aside class="tail-furniture" aria-hidden="true">
      <p class="tail-label no-indent">Chapter close</p>
      <p class="tail-quote no-indent">A short source-faithful line that gives the page an editorial anchor.</p>
    </aside>
  </div>
</section>
```

Use `.text-tail` only for genuinely short final pages. It is not a way to make normal body text decorative; it keeps a short tail from looking accidentally empty. Tail furniture must be part of the page grid or otherwise reserve real space; after adding it, rerun the text-frame overflow and tail-overlap checks before export.

Do not force a 30,000-word manuscript into manually designed fixed pages unless there is time to verify every page. Hybrid layout is the reliable default.

## Cover Options Pattern

For every completed book, create a lightweight `cover-options.html` (or equivalent section) as the pre-final cover review step. Use actual title, subtitle, author, and optional publisher/imprint. For editorial, HBR-like, coffee-table, business, brand, or visually led books, render 4-5 distinct routes, not minor variations; for deliberately plain conversions, still render at least 3 routes unless the user explicitly opts out.

Recommended routes:

- `cover-route-type`: oversized title typography as the primary image.
- `cover-route-symbol`: conceptual mark or abstract system/threshold/fork as the primary image.
- `cover-route-photo`: editorial image with type integrated into the composition.
- `cover-route-minimal`: high-contrast 2-3 color cover with generous negative space.
- `cover-route-press`: disciplined imprint/series-style cover with one memorable focal hook.

Thumbnail test:

```js
async function captureCoverThumbnail(page, selector, path) {
  const node = page.locator(selector).first();
  await node.screenshot({ path });
  // Also render visually around 100px wide in the options sheet.
}
```

Final-cover rule: choose the route with the clearest hierarchy and strongest market signal. Then make the final cover match that selected route's composition, scale, image crop, author placement, and negative space. If the final cover gains extra marks or moves elements, update the selected route too; the option is a contract, not a disposable sketch. A beautiful interior does not rescue a timid cover.

## Figure Pattern

```html
<figure class="figure">
  <img src="assets/chapter-02-plate.png" alt="Concise description">
  <figcaption>
    <span class="figure-number">Figure 2.3</span>
    Caption grounded in the manuscript.
  </figcaption>
</figure>
```

For diagrams, prefer inline SVG:

```html
<figure class="diagram-card">
  <svg viewBox="0 0 720 420" role="img" aria-labelledby="fig-ecosystem-title">
    <title id="fig-ecosystem-title">Ecosystem loop from the manuscript</title>
    <!-- diagram shapes and labels -->
  </svg>
  <figcaption><span class="figure-number">Figure 3.1</span> Caption.</figcaption>
</figure>
```

## Preservation Checks

After generating HTML, estimate included text:

```bash
python3 - <<'PY'
from pathlib import Path
from bs4 import BeautifulSoup
html = Path("index.html").read_text()
soup = BeautifulSoup(html, "html.parser")
for tag in soup(["script", "style"]):
    tag.decompose()
words = soup.get_text(" ").split()
print(len(words))
PY
```

If `bs4` is unavailable, use a simpler local script or browser text extraction. The exact count can be approximate; the purpose is to catch accidental over-summarization.

## Accessibility

- Every image needs useful `alt` text unless purely decorative.
- Every diagram needs a `<title>` or `aria-label`.
- Captions should explain why the visual is present.
- Use sufficient contrast in print and on screen.
- Avoid tiny table text. Split wide tables or rotate only when necessary.

## PDF Export

Use:

```bash
bash scripts/export-pdf.sh index.html book-title.pdf
```

The exporter starts a local server for relative assets and fonts, then calls Playwright `page.pdf()` using Letter format and CSS page size.
