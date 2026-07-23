#!/usr/bin/env node

import { copyFile, lstat, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import editorialThemes, { PAIRING_ARTICLE_CREDIT } from "../themes/editorial-themes.mjs";
import { prepareThemeFonts } from "../themes/font-assets.mjs";
import { publishGeneratedTargets } from "./lib/generated-publication.mjs";
import { themeColors, themeFontStack } from "../themes/index.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
export const DEFAULT_THEME_SAMPLE_OUTPUT_DIRECTORY = join(repositoryRoot, "examples", "theme-gallery");
export const THEME_SAMPLE_PAGE_NAMES = Object.freeze(["cover", "control-audit", "agency-plan"]);
const report = Object.freeze({
  title: "The Deliberate Life",
  subtitle: "A practical report on reclaiming time, attention, and agency",
  author: "Tareq Ismail"
});

const themeDetails = Object.freeze({
  "mazius-libre": { variant: "editorial", folio: "I", signal: "Radical clarity" },
  "regina-poppins": { variant: "playful", folio: "02", signal: "Joyful agency" },
  "monument-space": { variant: "machine", folio: "03", signal: "Decisive systems" },
  "sporting-agrandir": { variant: "raw", folio: "05", signal: "Brave movement" },
  "millimetre-mondwest": { variant: "technical", folio: "06", signal: "Measured progress" }
});

function sampleDetail(theme) {
  return themeDetails[theme.id] ?? {
    variant: "editorial",
    folio: String(theme.sampleIndex).padStart(2, "0"),
    signal: "Deliberate agency"
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function webPath(path) {
  return path.split(sep).join("/");
}

function relativeLuminance(color) {
  const channels = color.slice(1).match(/.{2}/gu).map((channel) => Number.parseInt(channel, 16) / 255);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(first, second) {
  const light = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (light + 0.05) / (dark + 0.05);
}

function strongestContrast(background, candidates) {
  return candidates.reduce((best, candidate) => (
    contrastRatio(background, candidate) > contrastRatio(background, best) ? candidate : best
  ));
}

function fontFaceCss(theme, sampleDirectory) {
  const fontDirectory = join(repositoryRoot, "themes", theme.id, "fonts");
  const sourcePrefix = JSON.stringify(`${webPath(relative(sampleDirectory, fontDirectory))}/`).slice(1, -1);
  return prepareThemeFonts(theme).css.replaceAll(`assets/fonts/${theme.id}/`, sourcePrefix);
}

async function preserveScreenshot(source, destination) {
  let stat;
  try {
    stat = await lstat(source);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`Existing theme screenshot must be a regular file: ${source}`);
  }
  await copyFile(source, destination);
}

async function resolvePromptExamples(theme, sampleDirectory) {
  const examples = theme.imagePrompt?.examples ?? [];
  if (!examples.length) return [];
  const seen = new Set();
  const resolvedExamples = [];
  for (const example of examples) {
    if (!example.file || basename(example.file) !== example.file || seen.has(example.file)) {
      throw new Error(`Theme ${theme.id} has an invalid or duplicate prompt example filename: ${example.file}`);
    }
    seen.add(example.file);
    const source = join(repositoryRoot, "themes", theme.id, "samples", example.file);
    const stat = await lstat(source);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error(`Theme prompt example must be a regular file: ${source}`);
    }
    resolvedExamples.push({ ...example, path: webPath(relative(sampleDirectory, source)) });
  }
  return resolvedExamples;
}

function themeCss(theme, sampleDirectory) {
  const colors = themeColors(theme);
  const onSteel = strongestContrast(colors.steel, [colors.ink, colors.page, colors.soft, colors.callout, colors.accent]);
  return `${fontFaceCss(theme, sampleDirectory)}

:root {
  --browser: ${colors.browser};
  --page: ${colors.page};
  --ink: ${colors.ink};
  --heading: ${colors.heading};
  --deck: ${colors.deck};
  --muted: ${colors.muted};
  --meta: ${colors.meta};
  --accent: ${colors.accent};
  --soft: ${colors.soft};
  --rule: ${colors.rule};
  --steel: ${colors.steel};
  --cover-band: ${colors.coverBand};
  --callout: ${colors.callout};
  --on-steel: ${onSteel};
  --font-display: ${themeFontStack(theme, "display")};
  --font-body: ${themeFontStack(theme, "body")};
  --font-ui: ${themeFontStack(theme, "ui")};
  --font-accent: ${themeFontStack(theme, "accent")};
  --shape-radius: 0;
  --title-size: 68pt;
  --motif-rotate: -7deg;
}

* { box-sizing: border-box; }
html { background: var(--browser); }
body {
  margin: 0;
  padding: 56px 20px 96px;
  background: var(--browser);
  color: var(--ink);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}
.sample-nav {
  position: sticky;
  z-index: 20;
  top: 12px;
  display: flex;
  width: min(8.5in, calc(100vw - 24px));
  margin: 0 auto 24px;
  padding: 10px 14px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--page) 88%, transparent);
  box-shadow: 0 10px 30px color-mix(in srgb, #000 18%, transparent);
  color: var(--ink);
  font: 600 11px/1.2 var(--font-ui);
  backdrop-filter: blur(14px);
}
.sample-nav a { color: inherit; text-decoration: none; }
.sample-nav span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.report-page {
  position: relative;
  width: 8.5in;
  height: 11in;
  margin: 0 auto 36px;
  overflow: hidden;
  background: var(--page);
  color: var(--ink);
  box-shadow: 0 22px 64px color-mix(in srgb, #000 28%, transparent);
}
.eyebrow,
.page-kicker,
.metric-label,
.phase-label,
.running-head,
.folio {
  font-family: var(--font-ui);
  font-size: 8.5pt;
  font-weight: 600;
  letter-spacing: .14em;
  line-height: 1.2;
  text-transform: uppercase;
}
.cover-page { padding: .62in; background: var(--page); }
.cover-page::before {
  position: absolute;
  inset: 0 0 auto;
  height: .13in;
  background: var(--accent);
  content: "";
}
.cover-grid {
  position: relative;
  z-index: 2;
  display: grid;
  height: 100%;
  grid-template-rows: auto 1fr auto;
}
.cover-topline { display: flex; justify-content: space-between; align-items: baseline; color: var(--meta); }
.cover-number { font: 400 12pt/1 var(--font-accent); }
.cover-content { align-self: center; max-width: 7.1in; }
.cover-title {
  max-width: 7.2in;
  margin: 0;
  color: var(--heading);
  font-family: var(--font-display);
  font-size: var(--title-size);
  font-weight: 700;
  letter-spacing: -.045em;
  line-height: .86;
}
.cover-title .accent-word {
  display: block;
  color: var(--accent);
  font-family: var(--font-accent);
  font-weight: 400;
  letter-spacing: -.025em;
}
.cover-subtitle {
  max-width: 4.9in;
  margin: .3in 0 0;
  color: var(--deck);
  font: 500 13pt/1.45 var(--font-body);
}
.cover-motif {
  position: absolute;
  z-index: 1;
  right: -.35in;
  bottom: 1.25in;
  width: 3.2in;
  height: 3.2in;
  transform: rotate(var(--motif-rotate));
  border: .28in solid var(--accent);
  border-radius: var(--shape-radius);
  background:
    linear-gradient(90deg, transparent 47%, var(--rule) 48% 52%, transparent 53%),
    linear-gradient(0deg, transparent 47%, var(--rule) 48% 52%, transparent 53%),
    var(--soft);
  opacity: .9;
}
.cover-motif::after {
  position: absolute;
  inset: .38in;
  border: 2px solid var(--heading);
  border-radius: inherit;
  content: "";
}
.cover-footer {
  display: grid;
  padding-top: .22in;
  align-items: end;
  border-top: 1px solid var(--rule);
  grid-template-columns: 1fr auto;
}
.cover-author { font: 700 14pt/1.2 var(--font-ui); }
.cover-note { max-width: 2.7in; color: var(--muted); font: 400 7.5pt/1.35 var(--font-ui); text-align: right; }
.cover-art { display: none; }
.cover-minimal-mark { display: none; }
.cover-page.route-minimal { padding: 0; background: var(--cover-band); }
.cover-page.route-minimal::before { display: none; }
.cover-page.route-minimal .cover-art {
  position: absolute;
  inset: 0 0 auto;
  display: block;
  width: 100%;
  height: 7.45in;
  margin: 0;
  overflow: hidden;
  background: var(--steel);
}
.cover-art img { display: block; width: 100%; height: 100%; object-fit: cover; }
.cover-page.route-minimal .cover-grid {
  position: absolute;
  inset: auto 0 0;
  height: 3.55in;
  padding: .38in 1.55in .42in .62in;
  background: var(--page);
  grid-template-rows: auto 1fr auto;
}
.cover-page.route-minimal .cover-content { align-self: center; }
.cover-page.route-minimal .cover-title { max-width: 5.9in; font-size: 44pt; line-height: .9; }
.cover-page.route-minimal .cover-title .accent-word { display: inline; }
.cover-page.route-minimal .cover-subtitle { max-width: 5.4in; margin-top: .12in; font-size: 9.5pt; line-height: 1.35; }
.cover-page.route-minimal .cover-footer { padding-top: .14in; }
.cover-page.route-minimal .cover-author { font-size: 11pt; }
.cover-page.route-minimal .cover-note { display: none; }
.cover-page.route-minimal .cover-minimal-mark {
  position: absolute;
  z-index: 3;
  right: .62in;
  bottom: .58in;
  display: block;
  width: .72in;
  height: 2.39in;
  background: var(--accent);
}

.inside-page { padding: .55in .58in .5in; }
.page-header { display: flex; padding-bottom: .16in; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--rule); }
.running-head { color: var(--meta); }
.folio { color: var(--muted); }
.inside-title { margin: .36in 0 .12in; color: var(--heading); font: 700 32pt/.98 var(--font-display); letter-spacing: -.035em; }
.inside-deck { max-width: 6.1in; margin: 0; color: var(--deck); font: 400 11.5pt/1.5 var(--font-body); }

.audit-layout { display: grid; margin-top: .34in; gap: .25in; grid-template-columns: 2.2in 1fr; }
.agency-ring {
  position: relative;
  display: grid;
  width: 2.15in;
  height: 2.15in;
  place-items: center;
  border-radius: 50%;
  background: conic-gradient(var(--accent) 0 68%, var(--soft) 68% 100%);
}
.agency-ring::after { position: absolute; inset: .27in; border-radius: 50%; background: var(--page); content: ""; }
.agency-score { position: relative; z-index: 1; color: var(--heading); font: 700 34pt/1 var(--font-display); }
.agency-score small { display: block; margin-top: 5px; color: var(--muted); font: 600 6.5pt/1.2 var(--font-ui); letter-spacing: .12em; text-align: center; text-transform: uppercase; }
.audit-copy { align-self: center; }
.audit-copy h3 { margin: 0 0 .1in; color: var(--heading); font: 700 15pt/1.1 var(--font-display); }
.audit-copy p { margin: 0; color: var(--deck); font-size: 9.5pt; line-height: 1.55; }
.metrics { display: grid; margin-top: .28in; gap: .12in; grid-template-columns: repeat(3, 1fr); }
.metric { min-height: 1.18in; padding: .17in; border: 1px solid var(--rule); border-radius: calc(var(--shape-radius) * .25); background: var(--soft); }
.metric-value { display: block; margin: .13in 0 .08in; color: var(--heading); font: 700 22pt/1 var(--font-display); }
.metric-label { color: var(--meta); font-size: 6.8pt; }
.metric p { margin: 0; color: var(--muted); font: 400 7.5pt/1.4 var(--font-body); }
.control-list { margin-top: .28in; border-top: 1px solid var(--rule); }
.control-row { display: grid; min-height: .7in; padding: .14in 0; align-items: center; border-bottom: 1px solid var(--rule); gap: .18in; grid-template-columns: .35in 1.45in 1fr auto; }
.control-index { color: var(--accent); font: 400 16pt/1 var(--font-accent); }
.control-row strong { color: var(--heading); font: 700 9pt/1.2 var(--font-ui); }
.control-row span { color: var(--muted); font-size: 8pt; line-height: 1.35; }
.status { padding: 5px 7px; border-radius: 999px; background: var(--accent); color: var(--steel); font: 700 6.5pt/1 var(--font-ui); letter-spacing: .08em; text-transform: uppercase; }

.agency-plan-page { padding-top: .55in; }
.agency-plan-page .plan-art {
  width: calc(100% + 1.16in);
  height: 2.9in;
  min-height: 0;
  margin: -.55in -.58in .28in;
  border: 0;
  border-bottom: .12in solid var(--accent);
  border-radius: 0;
}
.plan-hero {
  display: grid;
  margin: .25in 0 .2in;
  align-items: end;
  gap: .3in;
  grid-template-columns: 1.15fr .85fr;
}
.plan-hero-copy { min-width: 0; }
.plan-hero .page-kicker { margin: 0 0 .14in; }
.plan-hero .inside-title { margin: 0; font-size: 27pt; }
.plan-intro { display: grid; gap: .11in; }
.plan-promise { margin: 0; color: var(--heading); font: 400 13.5pt/1.16 var(--font-accent); }
.plan-note { margin: 0; color: var(--muted); font: 400 7.3pt/1.4 var(--font-body); }
.plan-art {
  position: relative;
  margin: 0;
  overflow: hidden;
  border-bottom: .11in solid var(--accent);
  border-radius: calc(var(--shape-radius) * .25);
  background: var(--steel);
}
.plan-art::after {
  position: absolute;
  inset: 0;
  border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
  content: "";
  pointer-events: none;
}
.plan-art img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center; }
.roadmap { border-top: 2px solid var(--heading); }
.phase { display: grid; min-height: .98in; padding: .12in 0; align-items: start; border-bottom: 1px solid var(--rule); gap: .18in; grid-template-columns: .68in 1.28in 1fr 1.45in; }
.phase-number { color: var(--accent); font: 400 24pt/1 var(--font-accent); }
.phase-label { padding-top: 4px; color: var(--meta); font-size: 7pt; }
.phase h3 { margin: 0 0 .07in; color: var(--heading); font: 700 12pt/1.15 var(--font-display); }
.phase p { margin: 0; color: var(--muted); font-size: 7.5pt; line-height: 1.38; }
.phase-practice { padding: .1in; border-left: 3px solid var(--accent); background: var(--callout); color: var(--deck); font: 600 7.4pt/1.4 var(--font-ui); }
.closing-quote { display: grid; margin-top: .18in; padding: .14in .2in; align-items: center; background: var(--steel); color: var(--on-steel); gap: .2in; grid-template-columns: auto 1fr; }
.closing-quote-mark { color: var(--accent); font: 400 30pt/1 var(--font-accent); }
.closing-quote p { margin: 0; color: var(--on-steel); font: 400 9pt/1.45 var(--font-body); }

body[data-variant="playful"] { --shape-radius: 50%; --title-size: 63pt; --motif-rotate: 8deg; }
body[data-variant="playful"] .cover-title { letter-spacing: -.02em; }
body[data-variant="playful"] .metric { border-radius: .22in; }
body[data-variant="machine"] { --title-size: 58pt; --motif-rotate: 0deg; }
body[data-variant="machine"] .report-page { background-image: linear-gradient(color-mix(in srgb, var(--rule) 22%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--rule) 22%, transparent) 1px, transparent 1px); background-size: .25in .25in; }
body[data-variant="machine"] .cover-title { text-transform: uppercase; }
body[data-variant="raw"] { --title-size: 69pt; --motif-rotate: 12deg; }
body[data-variant="raw"] .cover-title { text-transform: lowercase; }
body[data-variant="raw"] .metric:nth-child(2) { transform: translateY(.1in) rotate(-1deg); }
body[data-variant="technical"] { --title-size: 61pt; --motif-rotate: 0deg; }
body[data-variant="technical"] .report-page::after { position: absolute; right: .13in; bottom: .13in; width: .18in; height: .18in; border-right: 1px solid var(--ink); border-bottom: 1px solid var(--ink); content: ""; }

@media (max-width: 860px) {
  body { padding: 48px 0 80px; }
  .report-page { width: 100vw; height: calc(100vw * 1.2941176); margin-bottom: 18px; transform-origin: top left; }
}
@media print {
  @page { size: Letter; margin: 0; }
  html, body { background: none; }
  body { padding: 0; }
  .sample-nav { display: none; }
  .report-page { margin: 0; box-shadow: none; break-after: page; }
}
`;
}

function sampleHtml(theme, sampleDirectory, promptExamples) {
  const detail = sampleDetail(theme);
  const originalPairing = theme.inspiration.originalPairing.join(" + ");
  const bundledPairing = theme.inspiration.bundledPairing.join(" + ");
  const coverArtwork = promptExamples[0];
  const agencyArtwork = promptExamples[1];
  const coverArtworkHtml = coverArtwork
    ? `      <figure class="cover-art"><img src="${escapeHtml(coverArtwork.path)}" alt="${escapeHtml(coverArtwork.alt)}"></figure>`
    : "";
  const agencyArtworkHtml = agencyArtwork
    ? `      <figure class="plan-art"><img src="${escapeHtml(agencyArtwork.path)}" alt="${escapeHtml(agencyArtwork.alt)}"></figure>`
    : "";
  const coverMotifHtml = coverArtwork ? "" : `    <div class="cover-motif" aria-hidden="true"></div>`;
  const coverNote = coverArtwork
    ? `Theme pairing: ${escapeHtml(bundledPairing)}<br>Editorial image direction: active.`
    : `Theme pairing: ${escapeHtml(bundledPairing)}<br>Image prompt intentionally awaiting direction.`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(theme.name)} · ${report.title}</title>
  <style>${themeCss(theme, sampleDirectory)}</style>
</head>
<body data-theme="${escapeHtml(theme.id)}" data-variant="${escapeHtml(detail.variant)}">
  <nav class="sample-nav"><a href="../index.html">← All themes</a><span>${escapeHtml(originalPairing)}</span><a href="#control-audit">Next page ↓</a></nav>

  <section class="report-page cover-page${coverArtwork ? " has-cover-art route-minimal" : ""}" data-page="cover"${coverArtwork ? ' data-cover-route="minimal"' : ""} aria-label="Report cover">
${coverMotifHtml}
${coverArtworkHtml}
${coverArtwork ? '    <div class="cover-minimal-mark" aria-hidden="true"></div>' : ""}
    <div class="cover-grid">
      <header class="cover-topline"><span class="eyebrow">Field Report · 2026</span><span class="cover-number">${escapeHtml(detail.folio)}</span></header>
      <main class="cover-content">
        <p class="eyebrow">${escapeHtml(detail.signal)}</p>
        <h1 class="cover-title">The Deliberate <span class="accent-word">Life</span></h1>
        <p class="cover-subtitle">${report.subtitle}</p>
      </main>
      <footer class="cover-footer">
        <div><div class="eyebrow">Prepared by</div><div class="cover-author">${report.author}</div></div>
        <div class="cover-note">${coverNote}</div>
      </footer>
    </div>
  </section>

  <section class="report-page inside-page" id="control-audit" data-page="control-audit" aria-label="Control audit page">
    <header class="page-header"><span class="running-head">${report.title} / Baseline</span><span class="folio">01</span></header>
    <p class="page-kicker">Start where control is leaking</p>
    <h2 class="inside-title">The Control Audit</h2>
    <p class="inside-deck">Agency rarely disappears in one dramatic moment. It erodes through small defaults: a calendar filled by other people, attention scattered by alerts, and promises made without room to keep them.</p>

    <div class="audit-layout">
      <div class="agency-ring"><div class="agency-score">68<small>Agency index</small></div></div>
      <div class="audit-copy"><h3>Good intentions, weak boundaries</h3><p>The baseline shows strong purpose but inconsistent protection. The fastest gains will come from reclaiming mornings, reducing reactive inputs, and naming one priority before opening the inbox.</p></div>
    </div>

    <div class="metrics">
      <article class="metric"><span class="metric-label">Attention</span><strong class="metric-value">11h</strong><p>Lost each week to unplanned digital switching.</p></article>
      <article class="metric"><span class="metric-label">Commitments</span><strong class="metric-value">37%</strong><p>Accepted before checking time or energy.</p></article>
      <article class="metric"><span class="metric-label">Recovery</span><strong class="metric-value">2.4×</strong><p>More follow-through after a protected reset.</p></article>
    </div>

    <div class="control-list">
      <div class="control-row"><strong class="control-index">1</strong><strong>Time</strong><span>Reserve the first useful hour for work that changes your trajectory.</span><span class="status">Protect</span></div>
      <div class="control-row"><strong class="control-index">2</strong><strong>Attention</strong><span>Batch messages into two windows and remove visual prompts between them.</span><span class="status">Reduce</span></div>
      <div class="control-row"><strong class="control-index">3</strong><strong>Standards</strong><span>Choose the minimum action that keeps a promise alive on difficult days.</span><span class="status">Define</span></div>
    </div>
  </section>

  <section class="report-page inside-page agency-plan-page" data-page="agency-plan" aria-label="Thirty-day agency plan page">
${agencyArtworkHtml}
    <header class="page-header"><span class="running-head">${report.title} / Action</span><span class="folio">02</span></header>
    <div class="plan-hero${agencyArtwork ? " has-plan-art" : ""}">
      <div class="plan-hero-copy">
        <p class="page-kicker">A four-week operating rhythm</p>
        <h2 class="inside-title">The 30-Day Agency Plan</h2>
      </div>
      <div class="plan-intro">
        <p class="plan-promise">Control grows when your environment remembers what matters before your mood has to.</p>
        <p class="plan-note">Each week adds one durable layer. Keep the practices small enough to repeat and visible enough to review.</p>
      </div>
    </div>

    <div class="roadmap">
      <article class="phase"><strong class="phase-number">01</strong><span class="phase-label">Week one</span><div><h3>Clear the field</h3><p>Audit obligations, pause low-value inputs, and write a one-sentence definition of “enough” for this month.</p></div><div class="phase-practice">Daily practice<br>10-minute shutdown</div></article>
      <article class="phase"><strong class="phase-number">02</strong><span class="phase-label">Week two</span><div><h3>Protect the vital hour</h3><p>Place one high-agency block before communication. Give it a location, start cue, and visible finish line.</p></div><div class="phase-practice">Daily practice<br>60-minute focus block</div></article>
      <article class="phase"><strong class="phase-number">03</strong><span class="phase-label">Week three</span><div><h3>Practice clean decisions</h3><p>Replace automatic yeses with a pause. Compare every new request against the month’s declared priority.</p></div><div class="phase-practice">Decision rule<br>Trade, defer, or decline</div></article>
      <article class="phase"><strong class="phase-number">04</strong><span class="phase-label">Week four</span><div><h3>Lock in the system</h3><p>Review what worked, remove friction from the winning habits, and schedule the next monthly reset.</p></div><div class="phase-practice">Weekly practice<br>Friday agency review</div></article>
    </div>

    <aside class="closing-quote"><span class="closing-quote-mark">“</span><p>A deliberate life is not a perfectly controlled life. It is one in which your best intentions have somewhere concrete to live.</p></aside>
  </section>
</body>
</html>
`;
}

function galleryHtml(themes) {
  const cards = themes.map((theme) => {
    const original = theme.inspiration.originalPairing.join(" + ");
    const bundled = theme.inspiration.bundledPairing.join(" + ");
    const colors = themeColors(theme);
    return `<article class="theme-card" style="--card-page:${colors.page};--card-heading:${colors.heading};--card-accent:${colors.accent}">
      <a class="preview" href="${theme.id}/index.html"><img src="${theme.id}/cover.png" alt="${escapeHtml(theme.name)} sample cover" width="408" height="528"></a>
      <div class="card-copy"><span class="card-index">${String(theme.sampleIndex).padStart(2, "0")}</span><h2><a href="${theme.id}/index.html">${escapeHtml(theme.name.split(" — ")[0])}</a></h2><p>${escapeHtml(original)}</p>${original === bundled ? "" : `<small>Bundled as ${escapeHtml(bundled)}</small>`}</div>
    </article>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Editorial Theme Gallery</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #101114; color: #f7f4ea; font-family: Inter, system-ui, sans-serif; }
    header { max-width: 1240px; margin: 0 auto; padding: 80px 28px 54px; }
    .kicker { color: #ff674d; font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
    h1 { max-width: 820px; margin: 16px 0 22px; font-size: clamp(48px, 8vw, 96px); letter-spacing: -.06em; line-height: .88; }
    header p { max-width: 720px; color: #b6b7bd; font-size: 17px; line-height: 1.6; }
    header a, footer a { color: #f7f4ea; }
    .gallery { display: grid; max-width: 1240px; margin: 0 auto; padding: 0 28px 100px; gap: 44px 24px; grid-template-columns: repeat(4, 1fr); }
    .theme-card { min-width: 0; }
    .preview { display: block; overflow: hidden; aspect-ratio: 8.5 / 11; background: linear-gradient(145deg, var(--card-page), var(--card-heading)); box-shadow: 0 18px 45px #0007; }
    .preview img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform .25s ease; }
    .preview:hover img { transform: scale(1.018); }
    .card-copy { position: relative; padding: 20px 38px 0 0; }
    .card-index { position: absolute; right: 0; color: var(--card-accent); font: 800 11px/1 system-ui; }
    h2 { margin: 0 0 7px; font-size: 20px; }
    h2 a { color: inherit; text-decoration: none; }
    .card-copy p { margin: 0; color: #b6b7bd; font-size: 13px; line-height: 1.45; }
    .card-copy small { display: block; margin-top: 5px; color: #74767f; font-size: 11px; line-height: 1.4; }
    footer { padding: 32px 28px 60px; border-top: 1px solid #2a2b30; color: #8e9098; font-size: 13px; line-height: 1.6; text-align: center; }
    @media (max-width: 960px) { .gallery { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 520px) { header { padding-top: 54px; } .gallery { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header><span class="kicker">${themes.length} themes · ${themes.length * THEME_SAMPLE_PAGE_NAMES.length} report pages</span><h1>Expressive type, built into the theme system.</h1><p>Every theme applies one pairing to the same fictional report, <em>${report.title}</em> by ${report.author}. Approved image directions and cover artwork are being added one theme at a time.</p></header>
  <main class="gallery">${cards}</main>
  <footer>Original pairing inspiration credited to <a href="${PAIRING_ARTICLE_CREDIT.url}">“${PAIRING_ARTICLE_CREDIT.title}”</a>, written by ${PAIRING_ARTICLE_CREDIT.writer} and curated by ${PAIRING_ARTICLE_CREDIT.curator}. Restricted source fonts use documented redistributable alternatives.</footer>
</body>
</html>
`;
}

export function resolveThemeSampleOutputDirectory(arguments_) {
  const flagIndex = arguments_.indexOf("--output-dir");
  if (flagIndex === -1) return DEFAULT_THEME_SAMPLE_OUTPUT_DIRECTORY;
  const value = arguments_[flagIndex + 1];
  if (!value || value.startsWith("--")) throw new Error("--output-dir requires a directory");
  return resolve(value);
}

export async function buildThemeSamples({ outputDirectory = DEFAULT_THEME_SAMPLE_OUTPUT_DIRECTORY } = {}) {
  const absoluteOutput = resolve(outputDirectory);
  const outputParent = dirname(absoluteOutput);
  const outputTarget = basename(absoluteOutput);
  await mkdir(outputParent, { recursive: true });
  const stageContainer = await mkdtemp(join(outputParent, ".theme-gallery-stage-"));
  const stageRoot = join(stageContainer, "next");
  const stagedOutput = join(stageRoot, outputTarget);
  const sampleThemes = editorialThemes.map((theme, index) => ({ ...theme, sampleIndex: index + 1 }));
  try {
    await mkdir(stagedOutput, { recursive: true });
    const manifestThemes = [];
    for (const theme of sampleThemes) {
      const stagedSampleDirectory = join(stagedOutput, theme.id);
      const publishedSampleDirectory = join(absoluteOutput, theme.id);
      await mkdir(stagedSampleDirectory, { recursive: true });
      const promptExamples = await resolvePromptExamples(theme, publishedSampleDirectory);
      await writeFile(join(stagedSampleDirectory, "index.html"), sampleHtml(theme, publishedSampleDirectory, promptExamples));
      await Promise.all(THEME_SAMPLE_PAGE_NAMES.map((name) => preserveScreenshot(
        join(publishedSampleDirectory, `${name}.png`),
        join(stagedSampleDirectory, `${name}.png`)
      )));
      manifestThemes.push({
        id: theme.id,
        name: theme.name,
        sampleIndex: theme.sampleIndex,
        pageCount: THEME_SAMPLE_PAGE_NAMES.length,
        pages: [...THEME_SAMPLE_PAGE_NAMES],
        originalPairing: theme.inspiration.originalPairing,
        bundledPairing: theme.inspiration.bundledPairing,
        substitutions: theme.inspiration.substitutions,
        colors: themeColors(theme),
        imagePrompt: theme.imagePrompt,
        imagePromptStatus: theme.imagePromptStatus,
        promptExamples,
        screenshots: THEME_SAMPLE_PAGE_NAMES.map((name) => `${name}.png`)
      });
    }

    await writeFile(join(stagedOutput, "index.html"), galleryHtml(sampleThemes));
    await writeFile(join(stagedOutput, "manifest.json"), `${JSON.stringify({
      schemaVersion: 1,
      article: {
        url: PAIRING_ARTICLE_CREDIT.url,
        writer: PAIRING_ARTICLE_CREDIT.writer,
        curator: PAIRING_ARTICLE_CREDIT.curator
      },
      report,
      themes: manifestThemes
    }, null, 2)}\n`);
    publishGeneratedTargets({ outputDir: outputParent, stageRoot, targets: [outputTarget] });
  } finally {
    try {
      await rm(stageContainer, { recursive: true, force: true });
    } catch (error) {
      process.emitWarning(`Theme gallery cleanup could not remove ${stageContainer}: ${error.message}`, {
        code: "THEME_GALLERY_CLEANUP_FAILED"
      });
    }
  }

  return {
    outputDirectory: absoluteOutput,
    themeCount: sampleThemes.length,
    pageCount: sampleThemes.length * THEME_SAMPLE_PAGE_NAMES.length
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  const result = await buildThemeSamples({ outputDirectory: resolveThemeSampleOutputDirectory(process.argv.slice(2)) });
  process.stdout.write(`Built ${result.themeCount} themes, ${result.pageCount} pages in ${result.outputDirectory}\n`);
}
