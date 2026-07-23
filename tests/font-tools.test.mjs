import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { promisify } from "node:util";

import { createRegisteredFontCatalog } from "../scripts/lib/font-catalog.mjs";
import { validateContract } from "../scripts/lib/json-contracts.mjs";
import {
  GOOGLE_FONTS_RAW_ROOT,
  acquireGoogleFontBundle,
  googleFontsRequestExample,
  parseGoogleFontsMetadata,
  validateGoogleFontsRequest
} from "../scripts/lib/google-fonts-acquisition.mjs";
import { getTheme } from "../themes/index.mjs";
import { resolveBookFontTheme } from "../themes/font-assets.mjs";

const execFileAsync = promisify(execFile);
const catalogCommand = new URL("../scripts/font-catalog.mjs", import.meta.url);
const acquisitionCommand = new URL("../scripts/acquire-google-fonts.mjs", import.meta.url);
const stylePresets = new URL("../STYLE_PRESETS.md", import.meta.url);
const temporaryDirectories = [];
const pinnedRef = "0123456789abcdef0123456789abcdef01234567";

after(async () => Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true }))));

async function temporaryDirectory(prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function metadataFixture({ family, filename, min = 200, max = 800, italic = false }) {
  return `name: ${JSON.stringify(family)}
designer: "Fixture Designer"
license: "OFL"
category: "SANS_SERIF"
fonts {
  name: ${JSON.stringify(family)}
  style: "normal"
  weight: 400
  filename: ${JSON.stringify(filename)}
}
${italic ? `fonts {
  name: ${JSON.stringify(family)}
  style: "italic"
  weight: 400
  filename: ${JSON.stringify(filename.replace(".ttf", "-Italic.ttf"))}
}
` : ""}axes {
  tag: "wght"
  min_value: ${min}.0
  max_value: ${max}.0
}
`;
}

function response(body, { status = 200, headers = {} } = {}) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
  return new Response(bytes, { status, headers: { "content-length": String(bytes.length), ...headers } });
}

test("font catalog reports registered packs, role metadata, and aliases as JSON", async () => {
  const catalog = createRegisteredFontCatalog();
  assert.equal(catalog.schemaVersion, 1);
  assert.deepEqual(catalog.packs.map(({ id }) => id), [
    "alumni",
    "colbalt",
    "mazius-libre",
    "millimetre-mondwest",
    "monument-space",
    "regina-poppins",
    "sporting-agrandir"
  ]);

  const colbalt = catalog.packs.find(({ id }) => id === "colbalt");
  assert.deepEqual(colbalt.aliases, ["cobalt", "default", "executive"]);
  assert.equal(colbalt.roles.display.family, "Poppins");
  assert.equal(colbalt.roles.body.family, "Halant");
  assert.deepEqual(colbalt.roles.ui.weights, [600, 700, 800]);
  assert.equal(colbalt.faces.length, 6);
  assert.equal(colbalt.licenses.length, 2);

  const brutalElegance = catalog.packs.find(({ id }) => id === "mazius-libre");
  assert.equal(brutalElegance.roles.display.family, "Mazius Display");
  assert.equal(brutalElegance.roles.accent.family, "Mazius Display");

  const result = await execFileAsync(process.execPath, [catalogCommand.pathname]);
  assert.deepEqual(JSON.parse(result.stdout), catalog);
  assert.equal(result.stderr, "");
});

test("Google Fonts METADATA.pb parsing preserves faces and variable weight ranges", () => {
  const parsed = parseGoogleFontsMetadata(metadataFixture({
    family: "Example Sans",
    filename: "ExampleSans[wght].ttf",
    italic: true
  }));

  assert.equal(parsed.family, "Example Sans");
  assert.equal(parsed.license, "OFL");
  assert.deepEqual(parsed.faces, [
    { family: "Example Sans", style: "normal", weight: "200 800", file: "ExampleSans[wght].ttf" },
    { family: "Example Sans", style: "italic", weight: "200 800", file: "ExampleSans[wght]-Italic.ttf" }
  ]);
});

test("Google Fonts acquisition is pinned, bounded, licensed, and emits usable fontOverrides", async () => {
  const projectRoot = await temporaryDirectory("frontend-textbooks-google-fonts-");
  const request = {
    schemaVersion: 1,
    ref: pinnedRef,
    sourceDirectory: "book-fonts/scholarly",
    roles: {
      display: { family: "Example Sans", fallback: "sans-serif" },
      body: { family: "Example Serif", fallback: "serif" },
      ui: { family: "Example Sans", fallback: "sans-serif" }
    },
    families: [
      { family: "Example Sans", repositoryPath: "ofl/examplesans" },
      { family: "Example Serif", repositoryPath: "ofl/exampleserif" }
    ]
  };
  const fixtures = new Map([
    [`${GOOGLE_FONTS_RAW_ROOT}/${pinnedRef}/ofl/examplesans/METADATA.pb`, response(metadataFixture({ family: "Example Sans", filename: "ExampleSans[wght].ttf" }))],
    [`${GOOGLE_FONTS_RAW_ROOT}/${pinnedRef}/ofl/examplesans/ExampleSans[wght].ttf`, response("sans-font-bytes")],
    [`${GOOGLE_FONTS_RAW_ROOT}/${pinnedRef}/ofl/examplesans/OFL.txt`, response("Example Sans\nSIL OPEN FONT LICENSE Version 1.1 - 26 February 2007")],
    [`${GOOGLE_FONTS_RAW_ROOT}/${pinnedRef}/ofl/exampleserif/METADATA.pb`, response(metadataFixture({ family: "Example Serif", filename: "ExampleSerif[wght].ttf", min: 100, max: 900 }))],
    [`${GOOGLE_FONTS_RAW_ROOT}/${pinnedRef}/ofl/exampleserif/ExampleSerif[wght].ttf`, response("serif-font-bytes")],
    [`${GOOGLE_FONTS_RAW_ROOT}/${pinnedRef}/ofl/exampleserif/OFL.txt`, response("Example Serif\nSIL OPEN FONT LICENSE Version 1.1 - 26 February 2007")]
  ]);
  const requestedUrls = [];
  const fetchFixture = async (url) => {
    requestedUrls.push(String(url));
    return fixtures.get(String(url)) ?? response("not found", { status: 404 });
  };

  const result = await acquireGoogleFontBundle({ projectRoot, request, fetchImpl: fetchFixture });

  assert.equal(result.schemaVersion, 1);
  assert.equal(result.source.provider, "google/fonts");
  assert.equal(result.source.ref, pinnedRef);
  assert.deepEqual(result.fontOverrides.display, request.roles.display);
  assert.deepEqual(result.fontOverrides.body, request.roles.body);
  assert.deepEqual(result.fontOverrides.ui, request.roles.ui);
  assert.equal(result.fontOverrides.sourceDirectory, "book-fonts/scholarly");
  assert.deepEqual(result.fontOverrides.faces.map(({ file }) => file), [
    "examplesans-ExampleSans[wght].ttf",
    "exampleserif-ExampleSerif[wght].ttf"
  ]);
  assert.deepEqual(result.fontOverrides.licenses, [
    { family: "Example Sans", file: "examplesans-OFL.txt" },
    { family: "Example Serif", file: "exampleserif-OFL.txt" }
  ]);
  assert.equal(await readFile(join(projectRoot, "book-fonts/scholarly/examplesans-OFL.txt"), "utf8"), "Example Sans\nSIL OPEN FONT LICENSE Version 1.1 - 26 February 2007");
  assert.equal(await readFile(join(projectRoot, "book-fonts/scholarly/exampleserif-ExampleSerif[wght].ttf"), "utf8"), "serif-font-bytes");
  assert.equal(requestedUrls.length, 6);
  assert.ok(requestedUrls.every((url) => url.startsWith(`${GOOGLE_FONTS_RAW_ROOT}/${pinnedRef}/`)));
  assert.ok(result.files.every(({ sha256 }) => /^[0-9a-f]{64}$/u.test(sha256)));
  assert.equal(validateContract("book-config", {
    title: "Book",
    author: "Author",
    coverImage: "assets/cover.png",
    fontOverrides: result.fontOverrides
  }).valid, true);
  const resolved = resolveBookFontTheme({
    theme: getTheme("colbalt"),
    fontOverrides: result.fontOverrides,
    projectRoot
  });
  assert.equal(resolved.fonts.display.stack, '"Example Sans", sans-serif');
  assert.equal(resolved.fonts.body.stack, '"Example Serif", serif');

  await assert.rejects(
    acquireGoogleFontBundle({ projectRoot, request, fetchImpl: fetchFixture }),
    /already exists/u
  );
});

test("Google Fonts acquisition rejects mutable refs and unbounded family requests", () => {
  const example = googleFontsRequestExample();
  assert.equal(example.schemaVersion, 1);
  assert.match(example.ref, /40-character google\/fonts commit SHA/u);
  assert.throws(() => validateGoogleFontsRequest({ ...example, ref: "main" }), /40-character.*commit SHA/u);
  assert.throws(() => validateGoogleFontsRequest({
    ...example,
    ref: pinnedRef,
    families: [
      { family: "One", repositoryPath: "ofl/one" },
      { family: "Two", repositoryPath: "ofl/two" },
      { family: "Three", repositoryPath: "ofl/three" },
      { family: "Four", repositoryPath: "ofl/four" }
    ]
  }), /at most 3/u);
});

test("Google Fonts acquisition command exposes its versioned request shape without network access", async () => {
  const result = await execFileAsync(process.execPath, [acquisitionCommand.pathname, "--example"]);
  assert.deepEqual(JSON.parse(result.stdout), googleFontsRequestExample());
  assert.equal(result.stderr, "");
});

test("every typography preset names an executable bundled or custom font route", async () => {
  const source = await readFile(stylePresets, "utf8");
  const sections = source.split(/^## /gmu).slice(1);
  const presetSections = sections.filter((section) => /^(?:Colbalt Editorial Theme|Alumni Theme|\d)/u.test(section));

  assert.equal(presetSections.length, 11);
  for (const section of presetSections) {
    const title = section.split("\n", 1)[0];
    assert.match(section, /\*\*Executable font route:\*\*/u, `${title} must name its font route`);
  }
  assert.match(source, /scripts\/font-catalog\.mjs/u);
  assert.match(source, /scripts\/acquire-google-fonts\.mjs/u);
  assert.doesNotMatch(source, /^\s*- Mono:/gmu);
});
