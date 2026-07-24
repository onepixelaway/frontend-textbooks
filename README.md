# Frontend Textbooks

A coding-agent skill for turning manuscripts, field guides, manuals, and long-form notes into designed HTML books and print-ready PDFs. It is packaged as a standalone skill: agents can start from `SKILL.md`, load the referenced support files, generate the HTML book, verify the rendered pages, and export a Letter-size PDF.

## What This Does

**Frontend Textbooks** helps coding agents create book-like artifacts instead of dumping prose into a web page. It uses an HTML-first workflow: the editable source of truth is a browser-readable `index.html`, and the final PDF is exported from that same HTML after layout verification.

The skill is built for textbook, manual, field-guide, executive briefing, and coffee-table-style books where typography, pacing, page rhythm, diagrams, covers, and print integrity matter.

### Key Features

- **Print-Ready PDF Output** - Exports US Letter PDFs with page-safe CSS, printed backgrounds, and fixed-format designed pages.
- **HTML First** - Produces a browser-readable HTML book before exporting the PDF, so the artifact stays inspectable and editable.
- **Bundled Theme Typography** - Ships each font-bearing theme with redistributable licensed font files, copies the active faces and licenses into the book, and renders without font-network access.
- **Enforced Manuscript Preservation** - Tracks stable source blocks and fails verification below 90% coverage instead of merely estimating preservation.
- **Original Cover Artwork on Every Run** - Requires a unique manuscript-grounded local bitmap, binds it to the active theme prompt and manuscript hash, and fails closed instead of falling back to a typographic cover.
- **Designed Book Rhythm** - Supports covers, title pages, tables of contents, part dividers, two-column reading pages, manuscript-grounded framework, scorecard, and numbers exhibits, diagrams, and chapter closers.
- **Coffee-Table Feel When Appropriate** - Encourages image-led section dividers, spacious editorial pages, generated artwork, and strong cover routes when the manuscript calls for a more collectible book.
- **Reusable Scaffold** - Includes a Markdown-to-book scaffold with focused Photo and Minimal cover options, browser-side pagination, chapter-close furniture, generated part images, mobile collapse behavior, and overflow assertions.
- **Verification Scripts** - Provides Playwright-backed checks for readiness, allowlisted assets, source coverage, desktop/mobile overflow, every rendered page, and final PDF structure.
- **Deterministic Pipeline** - One versioned command surface validates strict JSON contracts, caches content-addressed work, emits machine-readable diagnostics, and writes a final hash manifest.
- **Model/Script Boundary** - Scripts own parsing and production mechanics; the model supplies compact plans, targeted repair decisions, exceptions, and aesthetic approval through schemas.
- **Tiered Verification** - Fast builds avoid a browser, affected checks render changed source pages plus mobile, and full finalization verifies desktop/print/mobile and exports the PDF in one browser session.
- **Compact Evidence** - Successful commands print a one-line summary while full reports, source accounting, screenshots, and ordered contact sheets remain on disk.

## Example Output

These pages were rendered from an example PDF generated with the skill. The same workflow can produce textbook-style manuals, editorial field guides, and coffee-table-style books with image-led section pacing.

<p>
  <img src="examples/walking-in-cover.png" width="220" alt="Example generated book cover">
  <img src="examples/walking-in-part-divider.png" width="220" alt="Example image-led part divider page">
  <img src="examples/walking-in-canvas.png" width="220" alt="Example framework canvas page">
  <img src="examples/walking-in-checklist.png" width="220" alt="Example two-column textbook page with a checklist">
</p>

### Preview Every Theme

The same fictional report, *Living with Dinosaurs*, is rendered below in every registered theme so typography, palette, composition, and image direction are easy to compare. Each row contains the cover and an image-led detail page. Click either large thumbnail to open the full-resolution JPEG.

| Theme | Cover | Image-led detail |
| --- | --- | --- |
| `colbalt` | <a href="examples/theme-previews/living-with-dinosaurs/colbalt/cover.jpg"><img src="examples/theme-previews/living-with-dinosaurs/colbalt/cover.jpg" width="164" alt="Colbalt cover preview"></a> | <a href="examples/theme-previews/living-with-dinosaurs/colbalt/shared-morning.jpg"><img src="examples/theme-previews/living-with-dinosaurs/colbalt/shared-morning.jpg" width="164" alt="Colbalt image-led detail preview"></a> |
| `alumni` | <a href="examples/theme-previews/living-with-dinosaurs/alumni/cover.jpg"><img src="examples/theme-previews/living-with-dinosaurs/alumni/cover.jpg" width="164" alt="Alumni cover preview"></a> | <a href="examples/theme-previews/living-with-dinosaurs/alumni/shared-morning.jpg"><img src="examples/theme-previews/living-with-dinosaurs/alumni/shared-morning.jpg" width="164" alt="Alumni image-led detail preview"></a> |
| `mazius-libre` | <a href="examples/theme-previews/living-with-dinosaurs/mazius-libre/cover.jpg"><img src="examples/theme-previews/living-with-dinosaurs/mazius-libre/cover.jpg" width="164" alt="Mazius Libre cover preview"></a> | <a href="examples/theme-previews/living-with-dinosaurs/mazius-libre/shared-morning.jpg"><img src="examples/theme-previews/living-with-dinosaurs/mazius-libre/shared-morning.jpg" width="164" alt="Mazius Libre image-led detail preview"></a> |
| `regina-poppins` | <a href="examples/theme-previews/living-with-dinosaurs/regina-poppins/cover.jpg"><img src="examples/theme-previews/living-with-dinosaurs/regina-poppins/cover.jpg" width="164" alt="Regina Poppins cover preview"></a> | <a href="examples/theme-previews/living-with-dinosaurs/regina-poppins/shared-morning.jpg"><img src="examples/theme-previews/living-with-dinosaurs/regina-poppins/shared-morning.jpg" width="164" alt="Regina Poppins image-led detail preview"></a> |
| `monument-space` | <a href="examples/theme-previews/living-with-dinosaurs/monument-space/cover.jpg"><img src="examples/theme-previews/living-with-dinosaurs/monument-space/cover.jpg" width="164" alt="Monument Space cover preview"></a> | <a href="examples/theme-previews/living-with-dinosaurs/monument-space/shared-morning.jpg"><img src="examples/theme-previews/living-with-dinosaurs/monument-space/shared-morning.jpg" width="164" alt="Monument Space image-led detail preview"></a> |
| `sporting-agrandir` | <a href="examples/theme-previews/living-with-dinosaurs/sporting-agrandir/cover.jpg"><img src="examples/theme-previews/living-with-dinosaurs/sporting-agrandir/cover.jpg" width="164" alt="Sporting Agrandir cover preview"></a> | <a href="examples/theme-previews/living-with-dinosaurs/sporting-agrandir/shared-morning.jpg"><img src="examples/theme-previews/living-with-dinosaurs/sporting-agrandir/shared-morning.jpg" width="164" alt="Sporting Agrandir image-led detail preview"></a> |
| `millimetre-mondwest` | <a href="examples/theme-previews/living-with-dinosaurs/millimetre-mondwest/cover.jpg"><img src="examples/theme-previews/living-with-dinosaurs/millimetre-mondwest/cover.jpg" width="164" alt="Millimetre Mondwest cover preview"></a> | <a href="examples/theme-previews/living-with-dinosaurs/millimetre-mondwest/shared-morning.jpg"><img src="examples/theme-previews/living-with-dinosaurs/millimetre-mondwest/shared-morning.jpg" width="164" alt="Millimetre Mondwest image-led detail preview"></a> |
| `field-guide` | <a href="examples/theme-previews/living-with-dinosaurs/field-guide/cover.jpg"><img src="examples/theme-previews/living-with-dinosaurs/field-guide/cover.jpg" width="164" alt="Field Guide cover preview"></a> | <a href="examples/theme-previews/living-with-dinosaurs/field-guide/shared-morning.jpg"><img src="examples/theme-previews/living-with-dinosaurs/field-guide/shared-morning.jpg" width="164" alt="Field Guide image-led detail preview"></a> |
| `scholarly` | <a href="examples/theme-previews/living-with-dinosaurs/scholarly/cover.jpg"><img src="examples/theme-previews/living-with-dinosaurs/scholarly/cover.jpg" width="164" alt="Scholarly cover preview"></a> | <a href="examples/theme-previews/living-with-dinosaurs/scholarly/shared-morning.jpg"><img src="examples/theme-previews/living-with-dinosaurs/scholarly/shared-morning.jpg" width="164" alt="Scholarly image-led detail preview"></a> |
| `technical` | <a href="examples/theme-previews/living-with-dinosaurs/technical/cover.jpg"><img src="examples/theme-previews/living-with-dinosaurs/technical/cover.jpg" width="164" alt="Technical cover preview"></a> | <a href="examples/theme-previews/living-with-dinosaurs/technical/shared-morning.jpg"><img src="examples/theme-previews/living-with-dinosaurs/technical/shared-morning.jpg" width="164" alt="Technical image-led detail preview"></a> |
| `literary` | <a href="examples/theme-previews/living-with-dinosaurs/literary/cover.jpg"><img src="examples/theme-previews/living-with-dinosaurs/literary/cover.jpg" width="164" alt="Literary cover preview"></a> | <a href="examples/theme-previews/living-with-dinosaurs/literary/shared-morning.jpg"><img src="examples/theme-previews/living-with-dinosaurs/literary/shared-morning.jpg" width="164" alt="Literary image-led detail preview"></a> |

The repository also includes a buildable [five-theme type-pairing fixture](examples/theme-gallery/index.html), using a separate fictional report for focused regression comparisons. Rebuild its HTML with `npm run build:theme-samples` or render all 15 fixture PNGs with `npm run render:theme-samples`.

## Why Codex Is Recommended

Codex is highly recommended for this skill because it can combine file editing, shell scripts, browser/PDF verification, and image generation in one workflow. That matters for book production: the best results often need generated cover art, section-divider images, visual plates, and manuscript-grounded editorial illustrations, then a rendered PDF pass to confirm those assets actually print cleanly.

## Installation

### Codex Manual Installation

Clone this repository into your Codex skills directory:

```bash
git clone https://github.com/onepixelaway/frontend-textbooks.git ~/.codex/skills/frontend-textbooks
cd ~/.codex/skills/frontend-textbooks
npm ci
npm run setup:browsers
```

Then ask Codex to use the `frontend-textbooks` skill when you want to turn manuscript text into a designed book and PDF.

### Claude Code Manual Installation

Copy or clone the skill into Claude Code's skills directory:

```bash
git clone https://github.com/onepixelaway/frontend-textbooks.git ~/.claude/skills/frontend-textbooks
cd ~/.claude/skills/frontend-textbooks
npm ci
npm run setup:browsers
```

Then use it as a standalone skill by asking Claude Code to use `frontend-textbooks`.

### Other Coding Agents

Other local coding assistants can use the same core skill if they can read files and run shell commands. Point the agent at this repository and ask it to start from:

```text
SKILL.md
```

The skill file routes the agent to optional references only when needed:

- `references/intake-and-planning.md`
- `references/visual-system.md`
- `references/layout-and-html.md`
- `references/verification-gates.md`
- `references/reasoning-contracts.md`
- `references/iteration.md`

`STYLE_PRESETS.md`, `page-base.css`, `html-template.md`, and browser internals are not default reads; agents open them only when changing the corresponding implementation.

Bundled commands resolve from the installed skill directory, so book inputs and outputs can remain in any workspace. Relative config paths resolve from `book.json`, not the shell working directory. Runtime packages are pinned in `package-lock.json`; the browser runner reuses installed or cached browsers first and installs into a persistent cache only as a logged final fallback.

## Usage

### Create a New Textbook or Field Guide

```text
Use the frontend-textbooks skill to turn this manuscript into a print-ready PDF book.
```

The skill will:

1. Locate or ingest the manuscript.
2. Analyze its subject, tone, audience, and cultural context.
3. Recommend a topic-aware color and typography system alongside two alternatives, honor any requested palette or typeface, and pause until the user chooses.
4. Infer a book structure that preserves the source text.
5. Plan the cover subject, chapter rhythm, structured diagrams, generated images, and 2–4 skim-worthy full-page exhibits when the manuscript supports them.
6. Generate and record a unique manuscript-grounded cover bitmap using the active theme's canonical prompt.
7. Generate a designed HTML book and matching PDF.
8. Verify page integrity, overflow, ordered text preservation, generated assets, cover evidence, and mobile readability.

The public command surface is `scripts/book-pipeline.mjs`:

```bash
# Generate stable source IDs for the model-authored plan.
node scripts/book-pipeline.mjs inventory --config book.json --manuscript manuscript.md

# Compile the canonical cover request, generate its target with an image tool,
# then bind that exact bitmap to this manuscript and plan.
node scripts/prepare-cover-image.mjs book.json manuscript.md book-plan.json
node scripts/record-cover-image.mjs book.json manuscript.md book-plan.json

# Deterministic build checks, without Chromium.
node scripts/book-pipeline.mjs build --config book.json --manuscript manuscript.md --plan book-plan.json --tier fast

# Changed-page desktop/mobile verification, without PDF export.
node scripts/book-pipeline.mjs verify --config book.json --manuscript manuscript.md --plan book-plan.json --tier affected

# Full rendered verification, ordered contact sheets, PDF export, and artifact manifest.
node scripts/book-pipeline.mjs finalize --config book.json --manuscript manuscript.md --plan book-plan.json --tier full
```

If the plan requires aesthetic review, the first full run returns `review-required`. Inspect every contact sheet plus every desktop/mobile feature-page image, write schema-valid `aesthetic-review.json`, and rerun with `--aesthetic-review aesthetic-review.json`; unchanged rendering and PDF work are reused.

Pipeline stdout is always one compact JSON object, including failures. Full evidence remains on disk; `render-report.json` uses `schemaVersion: 2` and reports only failed or partial source blocks instead of a successful per-block inventory.

## Included Styles

Interactive runs recommend three manuscript-grounded visual systems and wait for the user's color and typography choice. `book.json.style` plus `themeOverrides` control color and image-prompt behavior; `fontTheme` may independently select another registered bundled typography pack. A requested Google Fonts family that is not registered can be downloaded with its OFL license into the book workspace and declared through `fontOverrides`; the build still renders offline. Palette-only legacy styles must pair with `fontTheme`/`fontOverrides` or explicitly use `fontMode: "system"`—bundled mode never silently falls back to machine fonts. For direct or legacy configs without a style, the runtime fallback is `colbalt`, a cobalt editorial system defined in `themes/colbalt`:

- Poppins-compatible local fallbacks for headings and labels by default
- Halant-compatible local serif fallbacks for body copy by default
- Deep cobalt hierarchy with lighter cobalt-blue accents
- Warm paper background
- Two-column editorial reading pages
- Solid-band split cover support for generated or supplied artwork

The scaffold also includes an `alumni` theme inspired by a warm single-ink editorial system: Bricolage Grotesque display type, Fraunces body copy, rust terracotta ink, and cream paper.

Five additional themes adapt selected pairings from [“8 expressive free font combos for your next design”](https://dribbble.com/stories/2020/06/10/free-font-combinations) into executable, offline packs:

| Theme | Rendered preview | Bundled typography | Palette and image direction |
| --- | --- | --- | --- |
| [`mazius-libre`](examples/theme-gallery/mazius-libre/index.html) | <a href="examples/theme-gallery/mazius-libre/index.html"><img src="examples/theme-gallery/mazius-libre/cover.png" width="112" alt="Mazius Libre theme cover"></a> | Mazius Display + Libre Baskerville | Graphite `#232323`, paper `#F9F9F9`, chartreuse `#E4FF5E`; moody hard-daylight photography with deep shadow and disciplined negative space. |
| [`regina-poppins`](examples/theme-gallery/regina-poppins/index.html) | <a href="examples/theme-gallery/regina-poppins/index.html"><img src="examples/theme-gallery/regina-poppins/cover.png" width="112" alt="Regina Poppins theme cover"></a> | Shrikhand + Poppins | Golden `#FFDB60`, coral `#F74735`, plum `#3A2031`; grainy airbrushed illustration with rounded poster forms and natural shadows. |
| [`monument-space`](examples/theme-gallery/monument-space/index.html) | <a href="examples/theme-gallery/monument-space/index.html"><img src="examples/theme-gallery/monument-space/cover.png" width="112" alt="Monument Space theme cover"></a> | Archivo Black + Space Mono | Paper `#F4F4EA`, signal red `#FF213A`, navy `#11182E`; limited-ink risograph illustration with exposed paper and coarse halftones. |
| [`sporting-agrandir`](examples/theme-gallery/sporting-agrandir/index.html) | <a href="examples/theme-gallery/sporting-agrandir/index.html"><img src="examples/theme-gallery/sporting-agrandir/cover.png" width="112" alt="Sporting Agrandir theme cover"></a> | Sporting Grotesque + Barlow Semi Condensed | Electric blue `#0000FE`, off-white `#FBFBEF`, acid lime `#C9FF68`; naïve hand-drawn illustration with flat fields and scratchy fills. |
| [`millimetre-mondwest`](examples/theme-gallery/millimetre-mondwest/index.html) | <a href="examples/theme-gallery/millimetre-mondwest/index.html"><img src="examples/theme-gallery/millimetre-mondwest/cover.png" width="112" alt="Millimetre Mondwest theme cover"></a> | Millimetre + Departure Mono | Sage `#AEB1A0`, ink black `#0A0A09`, signal orange `#FF7417`; bold screenprint-like illustration with heavy contours and matte graphic fields. |

Set any ID as `book.json.style` to apply its complete palette, typography, and canonical image prompt:

```json
{
  "style": "millimetre-mondwest"
}
```

Use the same ID as `fontTheme` when you only want its typography. Every complete theme binds generated artwork to its active semantic colors and keeps subjects ordinary, physically coherent, and at normal scale so the medium supplies the personality without making future book imagery surreal.

The redistributable replacements preserve each original pairing’s direction without bundling personal-use, trial, or non-commercial files. Every source, immutable revision, license, and substitution rationale is recorded in [`themes/FONT_SOURCES.md`](themes/FONT_SOURCES.md).

For example, `{"style":"colbalt","fontTheme":"alumni"}` keeps the cobalt palette and cover-art language while using Alumni's Bricolage Grotesque/Fraunces typography. Custom `fontOverrides` use the same display/body/UI roles and must declare every local face and license.

Agents can inspect the executable packs with `node scripts/font-catalog.mjs`. For an unregistered Google Fonts request, `node scripts/acquire-google-fonts.mjs --example` prints the pinned request format; the completed command downloads faces and licenses from the official `google/fonts` repository and returns a ready-to-use `fontOverrides` object.

Additional presets in `STYLE_PRESETS.md` include scholarly, field-guide, technical, literary, editorial journal, and product-manual directions. To make a preset available to the scaffold, add it as a module under `themes/` and register it in `themes/index.mjs`.

## Repository Contents

```text
frontend-textbooks/
  SKILL.md
  STYLE_PRESETS.md
  page-base.css
  html-template.md
  animation-patterns.md
  package.json
  package-lock.json
  .github/workflows/ci.yml
  references/
    intake-and-planning.md
    iteration.md
    layout-and-html.md
    pdf-optimization.md
    reasoning-contracts.md
    verification-gates.md
    visual-system.md
  schemas/
    book-config.schema.json
    book-plan.schema.json
    diagnostics.schema.json
    repair-actions.schema.json
    repair-tasks.schema.json
    aesthetic-review.schema.json
    artifact-manifest.schema.json
  themes/
    alumni/
      index.mjs
    colbalt/
      index.mjs
    index.mjs
  scripts/
    book-pipeline.mjs
    book-contract.mjs
    build-html-book.mjs
    prepare-cover-image.mjs
    record-cover-image.mjs
    book-browser.mjs
    export-pdf.sh
    export-ready-pdf.sh
    export-local-chrome.sh
    verify-html-book.sh
    verify-rendered-book.sh
    inspect-pdf.sh
    run-book-browser.sh
    create-contact-sheet.mjs
    pdf-inspection.mjs
  tests/
```

## Design Philosophy

Frontend Textbooks treats books as designed systems:

- Preserve the manuscript.
- Let HTML be the editable source.
- Verify the PDF, not just the browser.
- Keep publishing and hosting provider choices outside the book-production toolchain.
- Make covers sell the book.
- Make diagrams explain before they decorate.
- Own whitespace.
- Avoid generic AI visual habits.
- Generate a unique manuscript-grounded cover image every time; use additional generated images when they add clarity, pacing, atmosphere, or book-like richness.

## Migration to Plan v3

Plan v3 adds required `visuals.featurePages`. Designed nonfiction should provide 2–4 grounded `framework`, `scorecard`, or `numbers` decisions; a manuscript that cannot support one uses an empty array plus a justified `waive-feature-pages` exception. Version 2 plans fail with `book-plan.version must be one of: 3` until migrated. Existing projects without original cover art still fail closed: add a local `coverImage` target and complete `visuals.cover`, then run `prepare-cover-image.mjs`, generate the exact requested bitmap, and run `record-cover-image.mjs`. There is no artwork-free waiver. The only supported cover routes are `photo` and `minimal`.

## Credits

Inspired by [Zara Zhang's `frontend-slides`](https://github.com/zarazhangrui/frontend-slides), especially the skill-first packaging idea, HTML-first artifact workflow, installation structure, and README organization. Thank you, Zara.

The expressive pairing themes and their specimen palettes are based on selected pairings from [Renee Fleck’s Dribbble article “8 expressive free font combos for your next design”](https://dribbble.com/stories/2020/06/10/free-font-combinations), with the pairings curated and visually demonstrated by Davide Baratta. Thank you, Renee and Davide.

## License

This project is available under the MIT License.
