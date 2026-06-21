# Browser Effects and Visual Pacing

Frontend Textbooks are print-first. Effects may enrich the browser version, but the PDF must remain complete, readable, and static.

Use this file only when the HTML version benefits from subtle interaction or when choosing visual pacing patterns.

## Rules

- Never hide manuscript text behind animation that may not run.
- Never depend on scroll-triggered animation for PDF content.
- Keep effects subtle: opacity, small translate, gentle image reveals, table-of-contents highlighting.
- Respect `prefers-reduced-motion`.
- Disable browser-only controls and effects in `@media print`.

## Useful Effects

### Gentle Page Reveal

```css
@media screen {
  .page {
    opacity: 0;
    transform: translateY(18px);
    transition: opacity 420ms ease, transform 420ms ease;
  }

  .page.visible {
    opacity: 1;
    transform: translateY(0);
  }
}

@media print {
  .page {
    opacity: 1 !important;
    transform: none !important;
  }
}
```

```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("visible");
  });
}, { threshold: 0.12 });

document.querySelectorAll(".page").forEach((page) => observer.observe(page));
```

### Active Chapter Marker

```javascript
const chapters = [...document.querySelectorAll("[data-chapter]")];
const tocLinks = new Map(
  [...document.querySelectorAll("[data-toc-target]")]
    .map((link) => [link.dataset.tocTarget, link])
);

const chapterObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    const link = tocLinks.get(entry.target.id);
    if (link) link.classList.toggle("is-current", entry.isIntersecting);
  });
}, { rootMargin: "-35% 0px -55% 0px" });

chapters.forEach((chapter) => chapterObserver.observe(chapter));
```

### Image Plate Fade

Use for browser ambience only. The image must already be present and visible in print.

```css
@media screen {
  .plate img {
    opacity: 0;
    transform: scale(1.015);
    transition: opacity 700ms ease, transform 900ms ease;
  }

  .plate.visible img {
    opacity: 1;
    transform: scale(1);
  }
}

@media print {
  .plate img {
    opacity: 1 !important;
    transform: none !important;
  }
}
```

## Visual Pacing Patterns

### Dense Learning Chapter

Use this sequence:

1. Chapter opener with source-faithful orientation excerpt
2. Preserved prose section
3. Diagram or table
4. Preserved prose section
5. Recap callout only if the manuscript contains or implies a recap

### Coffee-Table Chapter

Use this sequence:

1. Full-bleed or near-full-page plate
2. Short chapter opener
3. Two to four pages of preserved prose
4. Image spread or object-detail page
5. Return to prose

### Technical Section

Use this sequence:

1. Section heading
2. Preserved explanation
3. Process diagram or architecture figure
4. Procedure/table/specification
5. Preserved caveats and examples

### Workbook Section

Use this sequence:

1. Preserved lesson text
2. Exercise box
3. Answer lines or worksheet grid
4. Optional source-faithful example

## Diagram Patterns

### Process Flow

Use when the manuscript describes a sequence.

```html
<figure class="diagram process-flow">
  <svg viewBox="0 0 720 220" role="img" aria-labelledby="process-title">
    <title id="process-title">Process from manuscript</title>
    <g class="step"><rect x="20" y="70" width="150" height="70" rx="8"/><text x="95" y="112">Step 1</text></g>
    <path d="M180 105 H260" />
    <g class="step"><rect x="270" y="70" width="150" height="70" rx="8"/><text x="345" y="112">Step 2</text></g>
    <path d="M430 105 H510" />
    <g class="step"><rect x="520" y="70" width="150" height="70" rx="8"/><text x="595" y="112">Step 3</text></g>
  </svg>
  <figcaption><span class="figure-number">Figure 2.1</span> Caption.</figcaption>
</figure>
```

### Concept Map

Use when the manuscript explains relationships among ideas.

### Timeline

Use for chronology, lifecycle, program phases, historical development, or project plans.

### Matrix

Use for comparisons, taxonomies, decision rules, pros/cons, or learning objectives.

## Troubleshooting

| Problem | Fix |
| ------- | --- |
| PDF misses animated content | Make final visible state the default and use animation only to enhance it on screen |
| Figure splits across pages | Add `break-inside: avoid`; move figure into explicit `.page` when needed |
| Browser preview looks tiny on mobile | Use the responsive screen rules from `page-base.css`; do not change print sizing |
| Heavy images slow export | Resize large images, prefer JPEG/WebP for photos, keep SVG for diagrams |
| Captions orphan from images | Wrap image and caption in one `figure` with `break-inside: avoid` |
