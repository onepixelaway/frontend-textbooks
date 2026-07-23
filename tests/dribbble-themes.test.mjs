import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { FONT_THEME_NAMES, getFontTheme, themeColors, themeFontStack } from "../themes/index.mjs";
import { prepareThemeFonts, themeFontFingerprint } from "../themes/font-assets.mjs";

const ARTICLE_URL = "https://dribbble.com/stories/2020/06/10/free-font-combinations";
const PAIRINGS = [
  {
    id: "mazius-libre",
    original: ["Mazius Display", "Libre Baskerville"],
    bundled: ["Mazius Display", "Libre Baskerville"],
    page: "#232323",
    heading: "#F9F9F9"
  },
  {
    id: "regina-poppins",
    original: ["Regina Black", "Poppins"],
    bundled: ["Shrikhand", "Poppins"],
    page: "#FFDB60",
    heading: "#F74735"
  },
  {
    id: "monument-space",
    original: ["Monument Extended", "Space Mono"],
    bundled: ["Archivo Black", "Space Mono"],
    page: "#F4F4EA",
    heading: "#FF213A"
  },
  {
    id: "sporting-agrandir",
    original: ["Sporting Grotesque", "Agrandir"],
    bundled: ["Sporting Grotesque", "Barlow Semi Condensed"],
    page: "#0000FE",
    heading: "#FBFBEF"
  },
  {
    id: "millimetre-mondwest",
    original: ["Millimetre", "Mondwest"],
    bundled: ["Millimetre", "Departure Mono"],
    page: "#AEB1A0",
    heading: "#232323"
  }
];

test("every selected Dribbble pairing is a registered, self-contained font theme", () => {
  for (const expected of PAIRINGS) {
    assert.ok(FONT_THEME_NAMES.includes(expected.id), `${expected.id} is not registered`);
    const theme = getFontTheme(expected.id);
    assert.deepEqual(theme.inspiration.originalPairing, expected.original);
    assert.deepEqual(theme.inspiration.bundledPairing, expected.bundled);
    assert.equal(theme.inspiration.articleUrl, ARTICLE_URL);
    assert.equal(theme.inspiration.curator, "Davide Baratta");
    assert.equal(theme.inspiration.writer, "Renee Fleck");
    assert.deepEqual(
      { page: themeColors(theme).page, heading: themeColors(theme).heading },
      { page: expected.page, heading: expected.heading }
    );
    assert.equal(theme.imagePrompt, null);
    assert.equal(theme.imagePromptStatus, "pending-user-supplied");
    assert.ok(themeFontStack(theme, "display"));
    assert.ok(themeFontStack(theme, "body"));
    assert.ok(themeFontStack(theme, "ui"));

    const prepared = prepareThemeFonts(theme);
    assert.match(prepared.css, /@font-face/u);
    assert.ok(prepared.files.every((file) => file.startsWith(`assets/fonts/${expected.id}/`)));
    assert.equal(themeFontFingerprint(theme).length, theme.fonts.faces.length + theme.fonts.licenses.length);
  }
});

test("restricted originals are replaced explicitly instead of redistributed", () => {
  const substitutions = PAIRINGS
    .map(({ id }) => getFontTheme(id))
    .flatMap(({ inspiration }) => inspiration.substitutions);
  assert.deepEqual(
    substitutions.map(({ original, bundled }) => [original, bundled]),
    [
      ["Regina Black", "Shrikhand"],
      ["Monument Extended", "Archivo Black"],
      ["Agrandir", "Barlow Semi Condensed"],
      ["Mondwest", "Departure Mono"]
    ]
  );
  assert.ok(substitutions.every(({ reason, sourceUrl }) => reason && sourceUrl));
});

test("README credits the article writer and pairing curator", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /Renee Fleck/u);
  assert.match(readme, /Davide Baratta/u);
  assert.match(readme, new RegExp(ARTICLE_URL.replaceAll("/", "\\/"), "u"));
});
