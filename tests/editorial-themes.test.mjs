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
    heading: "#F9F9F9",
    promptReady: true
  },
  {
    id: "regina-poppins",
    original: ["Regina Black", "Poppins"],
    bundled: ["Shrikhand", "Poppins"],
    page: "#FFDB60",
    heading: "#F74735",
    promptReady: true
  },
  {
    id: "monument-space",
    original: ["Monument Extended", "Space Mono"],
    bundled: ["Archivo Black", "Space Mono"],
    page: "#F4F4EA",
    heading: "#FF213A",
    promptReady: true
  },
  {
    id: "sporting-agrandir",
    original: ["Sporting Grotesque", "Agrandir"],
    bundled: ["Sporting Grotesque", "Barlow Semi Condensed"],
    page: "#0000FE",
    heading: "#FBFBEF",
    promptReady: true
  },
  {
    id: "millimetre-mondwest",
    original: ["Millimetre", "Mondwest"],
    bundled: ["Millimetre", "Departure Mono"],
    page: "#AEB1A0",
    heading: "#0A0A09",
    promptReady: true
  }
];

test("every selected editorial theme is registered and self-contained", () => {
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
    if (expected.promptReady) {
      assert.ok(theme.imagePrompt?.template.includes(theme.imagePrompt.subjectPlaceholder));
      assert.equal(theme.imagePromptStatus, undefined);
      assert.equal(theme.imagePrompt.examples.length, 3);
      assert.match(theme.imagePrompt.template, /ordinary|normal scale|physically plausible/u);
      assert.doesNotMatch(theme.imagePrompt.template, /dreamlike|everyday surrealism|slightly absurd|editorial metaphor/u);
      if (expected.id === "mazius-libre") {
        assert.match(theme.imagePrompt.template, /moody, quietly cinematic/u);
        assert.match(theme.imagePrompt.template, /underexposed graphite blacks/u);
        assert.match(theme.imagePrompt.template, /mystery must come only from photographic choices/u);
      }
      if (expected.id === "millimetre-mondwest") {
        assert.match(theme.imagePrompt.template, /hand-pulled screenprint poster/u);
        assert.match(theme.imagePrompt.template, /broad pools of velvety black/u);
        assert.match(theme.imagePrompt.template, /vivid vermilion and signal-orange/u);
        assert.match(theme.imagePrompt.template, /normal scale/u);
        assert.doesNotMatch(theme.imagePrompt.template, /surreal editorial|dreamlike editorial/u);
      }
    } else {
      assert.equal(theme.imagePrompt, null);
      assert.equal(theme.imagePromptStatus, "pending-user-supplied");
    }
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
