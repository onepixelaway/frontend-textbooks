import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inspector = join(repository, "scripts/pdf-inspection.mjs");

async function fixture(t, { pageCount = 8, renderedPages = pageCount, renderReport = null } = {}) {
  const root = await mkdtemp(join(tmpdir(), "frontend-textbooks-pdf-inspection-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pagesDir = join(root, "pages");
  const structurePath = join(root, "pdf-structure.json");
  const pdfPath = join(root, "book.pdf");
  await mkdir(pagesDir, { recursive: true });
  await writeFile(structurePath, JSON.stringify({ pageCount }));
  await writeFile(pdfPath, "%PDF-fixture");
  await writeFile(join(pagesDir, "contact-sheet.png"), "contact sheet");
  for (let page = 1; page <= renderedPages; page += 1) {
    await writeFile(join(pagesDir, `pdf-page-${page}.png`), `page ${page}`);
  }

  const args = [inspector, "--pdf", pdfPath, "--pages-dir", pagesDir, "--structure", structurePath];
  if (renderReport) {
    const renderReportPath = join(root, "render-report.json");
    await writeFile(renderReportPath, JSON.stringify(renderReport));
    args.push("--render-report", renderReportPath);
  }
  return { args, pagesDir };
}

async function inspect(t, options) {
  const paths = await fixture(t, options);
  const result = await execFileAsync(process.execPath, paths.args, { cwd: repository });
  return {
    ...paths,
    output: JSON.parse(result.stdout),
    persisted: JSON.parse(await readFile(join(paths.pagesDir, "pdf-inspection.json"), "utf8"))
  };
}

test("PDF inspection selects every declared semantic page", async (t) => {
  const semantics = {
    cover: 1,
    toc: 2,
    firstBody: 3,
    featurePages: [4, 5],
    chapterFinalPages: [
      { chapterId: "Introduction", page: 6 },
      { chapterId: "Details", page: 7 }
    ],
    finalPage: 8
  };
  const { output, persisted } = await inspect(t, {
    renderReport: { print: { pages: 8, inspectionPages: semantics } }
  });

  const expectedSelections = [
    ["cover", 1],
    ["toc", 2],
    ["first-body-page", 3],
    ["feature-01", 4],
    ["feature-02", 5],
    ["chapter-introduction-final", 6],
    ["chapter-details-final", 7],
    ["final-page", 8]
  ];
  assert.deepEqual(output.selections.map(({ label, page }) => [label, page]), expectedSelections);
  assert.deepEqual(persisted.selections.map(({ label, page }) => [label, page]), expectedSelections);
  await Promise.all(output.selections.map(({ path }) => readFile(path)));
});

test("PDF inspection remains standalone when no render report is available", async (t) => {
  const { output } = await inspect(t, { pageCount: 3 });
  assert.deepEqual(output.selections.map(({ label, page }) => [label, page]), [
    ["cover", 1],
    ["final-page", 3]
  ]);
});

test("PDF inspection rejects a truncated PDF against its render report", async (t) => {
  const { args } = await fixture(t, {
    pageCount: 5,
    renderReport: { print: { pages: 6, inspectionPages: { cover: 1, finalPage: 6 } } }
  });
  await assert.rejects(
    execFileAsync(process.execPath, args, { cwd: repository }),
    /PDF page count 5 does not match render report page count 6/u
  );
});

test("PDF inspection rejects missing rendered pages instead of producing a partial selection", async (t) => {
  const { args } = await fixture(t, {
    pageCount: 4,
    renderedPages: 3,
    renderReport: { print: { pages: 4, inspectionPages: { cover: 1, finalPage: 4 } } }
  });
  await assert.rejects(
    execFileAsync(process.execPath, args, { cwd: repository }),
    /Rendered PDF page is missing:.*pdf-page-4\.png/u
  );
});

test("PDF inspection rejects invalid and out-of-range semantic pages", async (t) => {
  const cases = [
    ["cover", { cover: 0 }, /semantic "cover".*between 1 and 8/u],
    ["TOC", { toc: 9 }, /semantic "toc".*between 1 and 8/u],
    ["first body", { firstBody: "3" }, /semantic "first-body-page".*between 1 and 8/u],
    ["feature", { featurePages: [4, null] }, /semantic "feature-02" must declare a page/u],
    ["chapter final", { chapterFinalPages: [{ chapterId: "details", page: 9 }] }, /semantic "chapter-details-final".*between 1 and 8/u],
    ["final page", { finalPage: 9 }, /semantic "final-page".*between 1 and 8/u]
  ];

  for (const [name, inspectionPages, expected] of cases) {
    await t.test(name, async (subtest) => {
      const { args } = await fixture(subtest, {
        renderReport: { print: { pages: 8, inspectionPages } }
      });
      await assert.rejects(execFileAsync(process.execPath, args, { cwd: repository }), expected);
    });
  }
});
