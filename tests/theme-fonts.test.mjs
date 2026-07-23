import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { sha256 } from "../scripts/lib/content-hash.mjs";
import {
  FONT_THEME_NAMES,
  getTheme
} from "../themes/index.mjs";
import {
  createThemeCacheIdentity,
  prepareThemeFonts,
  publishThemeFonts,
  resolveBookFontTheme,
  themeFontFingerprint
} from "../themes/font-assets.mjs";
import { writeBookProject } from "./helpers/book-project.mjs";

const execFileAsync = promisify(execFile);
const builder = new URL("../scripts/build-html-book.mjs", import.meta.url);
const repository = fileURLToPath(new URL("..", import.meta.url));
const temporaryDirectories = [];
const supportedLicenseTexts = {
  ofl: "SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007",
  apache: "Apache License, Version 2.0, January 2004",
  ubuntu: "UBUNTU FONT LICENCE Version 1.0"
};

after(async () => {
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryDirectory(prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function cloneTheme(name = "colbalt") {
  return structuredClone(getTheme(name));
}

function customFontOverrides(sourceDirectory = "book-fonts") {
  return {
    sourceDirectory,
    display: { family: "Example Sans", fallback: "sans-serif" },
    body: { family: "Example Serif", fallback: "serif" },
    ui: { family: "Example Sans", fallback: "sans-serif" },
    faces: [
      { family: "Example Sans", weight: 700, file: "Example-Sans.ttf" },
      { family: "Example Serif", weight: 400, file: "Example-Serif.ttf" }
    ],
    licenses: [
      { family: "Example Sans", file: "Example-Sans-OFL.txt" },
      { family: "Example Serif", file: "Example-Serif-OFL.txt" }
    ]
  };
}

async function writeCustomFontSources(projectRoot, sourceDirectory = "book-fonts") {
  const directory = join(projectRoot, sourceDirectory);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(join(directory, "Example-Sans.ttf"), "example sans font"),
    writeFile(join(directory, "Example-Serif.ttf"), "example serif font"),
    writeFile(join(directory, "Example-Sans-OFL.txt"), supportedLicenseTexts.ofl),
    writeFile(join(directory, "Example-Serif-OFL.txt"), supportedLicenseTexts.ofl)
  ]);
  return directory;
}

test("theme font metadata renders local font faces", () => {
  const theme = getTheme("colbalt");
  const css = prepareThemeFonts(theme).css;

  assert.equal(theme.fonts.faces.length, 6);
  assert.equal(theme.fonts.licenses.length, 2);
  assert.equal((css.match(/@font-face/gu) ?? []).length, 6);
  assert.match(css, /assets\/fonts\/colbalt\/Poppins-SemiBold\.ttf/);
  assert.match(css, /font-family:\s*"Halant"/);
  assert.match(css, /font-display:\s*block/);
  assert.doesNotMatch(css, /https?:\/\//);
});

test("registered font themes can be selected independently from color themes", () => {
  assert.ok(FONT_THEME_NAMES.includes("alumni"));
  assert.ok(FONT_THEME_NAMES.includes("colbalt"));
  assert.ok(!FONT_THEME_NAMES.includes("technical"));

  const resolved = resolveBookFontTheme({
    theme: getTheme("colbalt"),
    fontTheme: "alumni",
    projectRoot: repository
  });

  assert.equal(resolved.id, "alumni");
  assert.equal(resolved.fonts.header.family, "Bricolage Grotesque");
});

test("theme cache identity follows the rendered font mode", () => {
  const theme = getTheme("colbalt");
  const bundled = createThemeCacheIdentity({ theme, fontTheme: theme, fontMode: "bundled" });
  const system = createThemeCacheIdentity({ theme, fontTheme: theme, fontMode: "system" });

  assert.equal("fonts" in bundled.theme, false);
  assert.equal(bundled.fontAssets.length, theme.fonts.faces.length + theme.fonts.licenses.length);
  assert.deepEqual(system.fontAssets, []);
  assert.deepEqual(system.fontTheme.fonts, {
    display: theme.fonts.header.stack,
    body: theme.fonts.body.stack,
    ui: theme.fonts.ui.stack,
    accent: theme.fonts.ui.stack
  });
});

test("custom font overrides require complete, project-local licensed sources", async (t) => {
  const projectRoot = await temporaryDirectory("frontend-textbooks-custom-font-source-");
  const outputDir = join(projectRoot, "output");
  const sourceDirectory = await writeCustomFontSources(projectRoot);

  await t.test("resolves declared roles before outputDir exists", async () => {
    const resolved = resolveBookFontTheme({
      theme: getTheme("colbalt"),
      fontOverrides: customFontOverrides(),
      projectRoot,
      outputDir
    });
    assert.equal(resolved.id, "custom");
    assert.equal(resolved.fonts.display.stack, '"Example Sans", sans-serif');
    assert.equal(resolved.fonts.body.stack, '"Example Serif", serif');
    await assert.rejects(access(outputDir), /ENOENT/u);
  });

  await t.test("rejects a selected family without a face", () => {
    const overrides = customFontOverrides();
    overrides.body.family = "Missing Serif";
    assert.throws(() => resolveBookFontTheme({
      theme: getTheme("colbalt"),
      fontOverrides: overrides,
      projectRoot,
      outputDir
    }), /no face.*Missing Serif/u);
  });

  await t.test("rejects a face family without a license", () => {
    const overrides = customFontOverrides();
    overrides.licenses.pop();
    assert.throws(() => resolveBookFontTheme({
      theme: getTheme("colbalt"),
      fontOverrides: overrides,
      projectRoot,
      outputDir
    }), /no license.*Example Serif/u);
  });

  await t.test("rejects sources under the generated font tree", async () => {
    const generatedSource = join(outputDir, "assets", "fonts", "source");
    await mkdir(generatedSource, { recursive: true });
    assert.throws(() => resolveBookFontTheme({
      theme: getTheme("colbalt"),
      fontOverrides: customFontOverrides("output/assets/fonts/source"),
      projectRoot,
      outputDir
    }), /outside the generated assets\/fonts directory/u);
  });

  await t.test("rejects an absolute source", () => {
    assert.throws(() => resolveBookFontTheme({
      theme: getTheme("colbalt"),
      fontOverrides: customFontOverrides(sourceDirectory),
      projectRoot,
      outputDir
    }), /sourceDirectory.*relative/u);
  });

  await t.test("rejects traversal to an existing outside directory", async () => {
    const outsideRoot = await temporaryDirectory("frontend-textbooks-custom-font-outside-");
    const outsideSource = await writeCustomFontSources(outsideRoot, "outside-fonts");
    assert.throws(() => resolveBookFontTheme({
      theme: getTheme("colbalt"),
      fontOverrides: customFontOverrides(relative(projectRoot, outsideSource)),
      projectRoot,
      outputDir
    }), /inside the book project/u);
  });

  await t.test("rejects a source directory symlink", async () => {
    await symlink(sourceDirectory, join(projectRoot, "linked-fonts"));
    assert.throws(() => resolveBookFontTheme({
      theme: getTheme("colbalt"),
      fontOverrides: customFontOverrides("linked-fonts"),
      projectRoot,
      outputDir
    }), /real directory inside the book project/u);
  });

  await t.test("rejects a missing source directory", () => {
    assert.throws(() => resolveBookFontTheme({
      theme: getTheme("colbalt"),
      fontOverrides: customFontOverrides("missing-fonts"),
      projectRoot,
      outputDir
    }), /real directory inside the book project/u);
  });

  await t.test("rejects a source path that is a file", async () => {
    await writeFile(join(projectRoot, "font-file"), "not a directory");
    assert.throws(() => resolveBookFontTheme({
      theme: getTheme("colbalt"),
      fontOverrides: customFontOverrides("font-file"),
      projectRoot,
      outputDir
    }), /real directory inside the book project/u);
  });

  await t.test("rejects explicit selections in system mode", () => {
    assert.throws(() => resolveBookFontTheme({
      theme: getTheme("colbalt"),
      fontTheme: "alumni",
      projectRoot,
      outputDir,
      fontMode: "system"
    }), /require bundled fontMode/u);
  });
});

test("custom font metadata rejects CSS and HTML-breaking values", async (t) => {
  const projectRoot = await temporaryDirectory("frontend-textbooks-custom-font-metadata-");
  await writeCustomFontSources(projectRoot);

  const resolveOverrides = (fontOverrides) => resolveBookFontTheme({
    theme: getTheme("colbalt"),
    fontOverrides,
    projectRoot,
    outputDir: join(projectRoot, "missing-output")
  });

  for (const [name, value] of [
    ["style terminator", "Example </style><script>alert(1)</script>"],
    ["control character", "Example\nSans"]
  ]) {
    await t.test(name, () => {
      const overrides = customFontOverrides();
      overrides.display.family = value;
      assert.throws(() => resolveOverrides(overrides), /fontOverrides\.display\.family/u);
    });
  }

  for (const weight of [0, 1001, "800 200", "700; color: red"]) {
    await t.test(`invalid weight ${weight}`, () => {
      const overrides = customFontOverrides();
      overrides.faces[0].weight = weight;
      assert.throws(() => resolveOverrides(overrides), /font face 1 weight/u);
    });
  }

  for (const style of ["sideways", "italic\n", "</style>"]) {
    await t.test(`invalid style ${JSON.stringify(style)}`, () => {
      const overrides = customFontOverrides();
      overrides.faces[0].style = style;
      assert.throws(() => resolveOverrides(overrides), /font face 1 style/u);
    });
  }
});

test("font licenses require safe text files with supported license identities", async (t) => {
  const projectRoot = await temporaryDirectory("frontend-textbooks-custom-font-license-");
  const sourceDirectory = await writeCustomFontSources(projectRoot);
  const resolveOverrides = (fontOverrides) => resolveBookFontTheme({
    theme: getTheme("colbalt"),
    fontOverrides,
    projectRoot,
    outputDir: join(projectRoot, "missing-output")
  });

  for (const [name, contents] of Object.entries(supportedLicenseTexts)) {
    await t.test(`accepts ${name}`, async () => {
      await writeFile(join(sourceDirectory, "Example-Sans-OFL.txt"), contents);
      assert.equal(resolveOverrides(customFontOverrides()).id, "custom");
    });
  }

  await t.test("rejects a non-text license file", async () => {
    await writeFile(join(sourceDirectory, "Example-Sans-OFL.md"), supportedLicenseTexts.ofl);
    const overrides = customFontOverrides();
    overrides.licenses[0].file = "Example-Sans-OFL.md";
    assert.throws(() => resolveOverrides(overrides), /font license 1.*\.txt/u);
  });

  await t.test("rejects unsupported license contents", async () => {
    await writeFile(join(sourceDirectory, "Example-Sans-OFL.txt"), "Copyright only; no supported font license text.");
    assert.throws(() => resolveOverrides(customFontOverrides()), /font license 1.*OFL|Apache|Ubuntu/u);
  });
});

test("theme font fingerprints equal every declared face and license byte hash", async (t) => {
  for (const themeName of ["colbalt", "alumni"]) {
    await t.test(themeName, async () => {
      const theme = getTheme(themeName);
      const declarations = [...theme.fonts.faces, ...theme.fonts.licenses];
      const expected = await Promise.all(declarations.map(async ({ file }) => ({
        path: `fonts/${file}`,
        sha256: sha256(await readFile(join(repository, "themes", theme.id, "fonts", file)))
      })));

      assert.deepEqual(themeFontFingerprint(theme), expected);
    });
  }
});

test("font assets install into the active book and are included in its static manifest", async () => {
  const root = await mkdtemp(join(tmpdir(), "frontend-textbooks-fonts-"));
  temporaryDirectories.push(root);
  const paths = await writeBookProject(root, {
    configOverrides: { style: "colbalt" }
  });

  await execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath, paths.planPath]);

  const html = await readFile(join(paths.outputDir, "index.html"), "utf8");
  const manifest = JSON.parse(await readFile(join(paths.outputDir, "book-build-manifest.json"), "utf8"));
  assert.match(html, /@font-face/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.ok(manifest.files.includes("assets/fonts/colbalt/Poppins-SemiBold.ttf"));
  assert.ok(manifest.files.includes("assets/fonts/colbalt/Poppins-OFL.txt"));
  assert.ok((await readFile(join(paths.outputDir, "assets/fonts/colbalt/Poppins-SemiBold.ttf"))).length > 100_000);
});

test("system font mode skips theme font installation", async () => {
  const root = await mkdtemp(join(tmpdir(), "frontend-textbooks-system-fonts-"));
  temporaryDirectories.push(root);
  const paths = await writeBookProject(root, {
    configOverrides: { style: "colbalt", fontMode: "system" }
  });

  await execFileAsync(process.execPath, [builder.pathname, paths.configPath, paths.manuscriptPath, paths.planPath]);

  const html = await readFile(join(paths.outputDir, "index.html"), "utf8");
  const manifest = JSON.parse(await readFile(join(paths.outputDir, "book-build-manifest.json"), "utf8"));
  assert.doesNotMatch(html, /@font-face/);
  assert.ok(!manifest.files.some((path) => path.startsWith("assets/fonts/")));
});

test("font publication returns portable asset paths", async () => {
  const root = await temporaryDirectory("frontend-textbooks-font-install-");
  const prepared = prepareThemeFonts(getTheme("alumni"));
  const installed = publishThemeFonts(prepared, root);

  assert.deepEqual(installed, [
    "assets/fonts/alumni/BricolageGrotesque-Variable.ttf",
    "assets/fonts/alumni/Fraunces-Variable.ttf",
    "assets/fonts/alumni/BricolageGrotesque-OFL.txt",
    "assets/fonts/alumni/Fraunces-OFL.txt"
  ]);
  await Promise.all(installed.map((path) => access(join(root, path))));
});

test("font publication canonicalizes whitespace-padded theme ids", async () => {
  const root = await temporaryDirectory("frontend-textbooks-font-id-");
  const theme = cloneTheme();
  theme.id = "  colbalt  ";

  const prepared = prepareThemeFonts(theme);
  const installed = publishThemeFonts(prepared, root);

  assert.ok(installed.length > 0);
  assert.ok(installed.every((path) => path.startsWith("assets/fonts/colbalt/")));
  await Promise.all(installed.map((path) => access(join(root, path))));
  await assert.rejects(access(join(root, "assets", "fonts", "  colbalt  ", "Poppins-SemiBold.ttf")), /ENOENT/u);
});

test("font publication reconciles a known-good tree and clears system-mode assets", async () => {
  const root = await temporaryDirectory("frontend-textbooks-font-reconcile-");
  const colbalt = prepareThemeFonts(getTheme("colbalt"));
  assert.deepEqual(publishThemeFonts(colbalt, root), colbalt.files);
  await Promise.all(colbalt.files.map((path) => access(join(root, path))));

  const stale = join(root, "assets", "fonts", "stale-theme", "Stale.ttf");
  await mkdir(join(root, "assets", "fonts", "stale-theme"));
  await writeFile(stale, "stale");

  const alumni = prepareThemeFonts(getTheme("alumni"));
  assert.deepEqual(publishThemeFonts(alumni, root), alumni.files);
  await Promise.all(alumni.files.map((path) => access(join(root, path))));
  await assert.rejects(access(join(root, colbalt.files[0])), /ENOENT/u);
  await assert.rejects(access(stale), /ENOENT/u);

  const system = prepareThemeFonts(null);
  assert.deepEqual(publishThemeFonts(system, root), []);
  await assert.rejects(access(join(root, alumni.files[0])), /ENOENT/u);
});

test("theme font metadata rejects unsafe and invalid declarations", async (t) => {
  for (const [name, file] of [
    ["empty filename", ""],
    ["traversal filename", "../Poppins-SemiBold.ttf"]
  ]) {
    await t.test(name, () => {
      const theme = cloneTheme();
      theme.fonts.faces[0].file = file;
      assert.throws(() => prepareThemeFonts(theme), /safe filename segment/u);
    });
  }

  await t.test("duplicate asset", () => {
    const theme = cloneTheme();
    theme.fonts.licenses.push({ family: "Poppins", file: theme.fonts.faces[0].file });
    assert.throws(() => prepareThemeFonts(theme), /duplicate font asset/u);
  });

  await t.test("missing source", () => {
    const theme = cloneTheme();
    theme.fonts.faces[0].file = "Missing-Font.ttf";
    assert.throws(() => prepareThemeFonts(theme), /font asset does not exist/u);
  });

  await t.test("unsupported face extension", () => {
    const theme = cloneTheme();
    theme.fonts.faces[0].file = "Poppins-OFL.txt";
    theme.fonts.licenses = theme.fonts.licenses.filter(({ file }) => file !== "Poppins-OFL.txt");
    assert.throws(() => prepareThemeFonts(theme), /unsupported format/u);
  });

  await t.test("invalid CSS descriptor", () => {
    const theme = cloneTheme();
    theme.fonts.faces[0].family = "Poppins; color: red";
    assert.throws(() => prepareThemeFonts(theme), /font face 1 family/u);
  });
});

test("font installer rejects a dangling destination symlink without writing outside outputDir", async () => {
  const root = await temporaryDirectory("frontend-textbooks-font-leaf-link-");
  const outside = await temporaryDirectory("frontend-textbooks-font-leaf-outside-");
  const destinationDirectory = join(root, "assets", "fonts", "colbalt");
  const externalTarget = join(outside, "created-by-font-install.ttf");
  const sentinel = join(outside, "sentinel.txt");
  await mkdir(destinationDirectory, { recursive: true });
  await writeFile(sentinel, "untouched");
  await symlink(externalTarget, join(destinationDirectory, "Poppins-SemiBold.ttf"));

  assert.throws(() => publishThemeFonts(prepareThemeFonts(getTheme("colbalt")), root), /symbolic link|regular file/u);
  await assert.rejects(readFile(externalTarget), /ENOENT/u);
  assert.equal(await readFile(sentinel, "utf8"), "untouched");
});

test("font installer rejects an intermediate symlink without writing outside outputDir", async () => {
  const root = await temporaryDirectory("frontend-textbooks-font-directory-link-");
  const outside = await temporaryDirectory("frontend-textbooks-font-directory-outside-");
  const sentinel = join(outside, "sentinel.txt");
  await writeFile(sentinel, "untouched");
  await symlink(outside, join(root, "assets"));

  assert.throws(() => publishThemeFonts(prepareThemeFonts(getTheme("colbalt")), root), /symbolic link|traverse/u);
  await assert.rejects(readFile(join(outside, "fonts", "colbalt", "Poppins-SemiBold.ttf")), /ENOENT/u);
  assert.equal(await readFile(sentinel, "utf8"), "untouched");
});
