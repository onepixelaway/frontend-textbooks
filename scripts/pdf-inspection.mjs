#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs as parseNodeArgs } from "node:util";
import { canonicalPdfPagePath } from "./lib/pdf-page-images.mjs";

function usage() {
  console.error("Usage: node scripts/pdf-inspection.mjs --pdf <book.pdf> --pages-dir <rendered-pages> --structure <pdf-structure.json> [--render-report render-report.json]");
  process.exit(1);
}

function parseArgs(argv) {
  let args;
  try {
    args = parseNodeArgs({
      args: argv,
      options: {
        pdf: { type: "string" },
        "pages-dir": { type: "string" },
        structure: { type: "string" },
        "render-report": { type: "string" }
      },
      strict: true
    }).values;
  } catch {
    usage();
  }
  if (!args.pdf || !args["pages-dir"] || !args.structure) usage();
  return args;
}

function safeName(value) {
  return String(value || "chapter").normalize("NFKD").replace(/[^a-zA-Z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").toLowerCase() || "chapter";
}

const args = parseArgs(process.argv.slice(2));
const pagesDir = resolve(args["pages-dir"]);
const structure = JSON.parse(readFileSync(resolve(args.structure), "utf8"));
if (!Number.isInteger(structure.pageCount) || structure.pageCount < 1) {
  throw new Error(`PDF structure report has an invalid page count: ${structure.pageCount}`);
}
const selectedDir = join(pagesDir, "selected");
rmSync(selectedDir, { recursive: true, force: true });
mkdirSync(selectedDir, { recursive: true });
const renderReport = args["render-report"]
  ? JSON.parse(readFileSync(resolve(args["render-report"]), "utf8"))
  : null;

function renderReportPageCount(report) {
  const candidates = [
    ["print.printSheets", report?.print?.printSheets],
    ["print.pages", report?.print?.pages],
    ["desktop.pages", report?.desktop?.pages]
  ];
  const candidate = candidates.find(([, value]) => value !== undefined && value !== null);
  if (!candidate) throw new Error("Render report has no expected PDF page count");
  const [field, value] = candidate;
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Render report ${field} must be a positive integer; received ${JSON.stringify(value)}`);
  }
  return value;
}

if (renderReport) {
  const expectedPages = renderReportPageCount(renderReport);
  if (structure.pageCount !== expectedPages) {
    throw new Error(`PDF page count ${structure.pageCount} does not match render report page count ${expectedPages}`);
  }
}

const reportedSemantics = renderReport?.print?.inspectionPages ?? renderReport?.desktop?.inspectionPages;
if (reportedSemantics !== undefined && reportedSemantics !== null &&
    (typeof reportedSemantics !== "object" || Array.isArray(reportedSemantics))) {
  throw new Error("Render report inspectionPages must be an object");
}
const semantics = reportedSemantics ?? {};
const selections = [];

function select(label, page, { fallback = null, required = false } = {}) {
  if (required && (page === undefined || page === null)) {
    throw new Error(`Render report semantic "${label}" must declare a page`);
  }
  const number = page === undefined || page === null ? fallback : page;
  if (number === undefined || number === null) return;
  if (!Number.isInteger(number) || number < 1 || number > structure.pageCount) {
    throw new Error(`Render report semantic "${label}" must be an integer page between 1 and ${structure.pageCount}; received ${JSON.stringify(number)}`);
  }
  const source = canonicalPdfPagePath(join(pagesDir, "pdf-page"), number);
  if (!existsSync(source)) throw new Error(`Rendered PDF page is missing: ${source}`);
  const output = join(selectedDir, `${safeName(label)}.png`);
  copyFileSync(source, output);
  selections.push({ label, page: number, path: output });
}

function semanticArray(name) {
  const value = semantics[name];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`Render report semantic "${name}" must be an array`);
  return value;
}

select("cover", semantics.cover, { fallback: 1 });
select("toc", semantics.toc);
select("first-body-page", semantics.firstBody);
semanticArray("featurePages").forEach((page, index) => select(`feature-${String(index + 1).padStart(2, "0")}`, page, { required: true }));
semanticArray("chapterFinalPages").forEach((item, index) => {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new Error(`Render report semantic "chapterFinalPages[${index}]" must be an object`);
  }
  select(`chapter-${safeName(item.chapterId || index + 1)}-final`, item.page, { required: true });
});
select("final-page", semantics.finalPage, { fallback: structure.pageCount });

const contactSheets = readdirSync(pagesDir)
  .filter((name) => /^contact-sheet(?:-\d+)?\.png$/u.test(name))
  .sort()
  .map((name) => join(pagesDir, name));
const report = {
  schemaVersion: 1,
  pdf: resolve(args.pdf),
  pages: structure.pageCount,
  pageSize: "Letter",
  textPreservation: structure.textPreservation ?? null,
  contactSheets,
  selections
};
writeFileSync(join(pagesDir, "pdf-inspection.json"), JSON.stringify(report, null, 2));
process.stdout.write(`${JSON.stringify(report)}\n`);
