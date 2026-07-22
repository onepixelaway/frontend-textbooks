import {
  constants,
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync
} from "node:fs";
import { dirname, extname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalProspectivePath, isWithinPath } from "../scripts/lib/book-paths.mjs";
import { sha256 } from "../scripts/lib/content-hash.mjs";
import {
  normalizeFontFallback,
  normalizeFontFamily,
  normalizeFontStyle,
  normalizeFontWeight
} from "../scripts/lib/font-contract.mjs";
import { publishGeneratedTargets } from "../scripts/lib/generated-publication.mjs";
import { getFontTheme, themeFontStack } from "./index.mjs";

const themesDir = dirname(fileURLToPath(import.meta.url));
export const FONT_OUTPUT_ROOT = "assets/fonts";
const FONT_FORMATS = new Map([
  [".otf", "opentype"],
  [".ttf", "truetype"],
  [".woff", "woff"],
  [".woff2", "woff2"]
]);
const CSS_CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const SUPPORTED_LICENSE_TEXTS = [
  /SIL OPEN FONT LICENSE\s+Version 1\.1/iu,
  /Apache License\s*,?\s*Version 2\.0/iu,
  /UBUNTU FONT LICEN[CS]E\s+Version 1\.0/iu
];
const preparedFontSets = new WeakMap();

function pathStat(path) {
  return lstatSync(path, { throwIfNoEntry: false });
}

export function assertNotFontOutputPath(outputDir, candidate, label) {
  const fontRoot = resolve(outputDir, FONT_OUTPUT_ROOT);
  const requestedPath = resolve(candidate);
  const canonicalFontRoot = canonicalProspectivePath(fontRoot);
  const canonicalCandidate = canonicalProspectivePath(requestedPath);
  if (isWithinPath(fontRoot, requestedPath) || isWithinPath(canonicalFontRoot, canonicalCandidate)) {
    throw new Error(`${label} must not target the reserved generated font namespace ${FONT_OUTPUT_ROOT}: ${requestedPath}`);
  }
}

function safeSegment(value, label) {
  const raw = String(value ?? "");
  const text = raw.trim();
  if (!text || CSS_CONTROL_CHARACTERS.test(raw) || text === "." || text === ".." || text.includes("/") || text.includes("\\")) {
    throw new Error(`${label} must be a safe filename segment`);
  }
  return text;
}

function customFontRole(role, label) {
  const family = normalizeFontFamily(role.family, `${label}.family`);
  const fallback = normalizeFontFallback(role.fallback, `${label}.fallback`);
  return {
    family,
    stack: `${JSON.stringify(family)}, ${fallback}`
  };
}

export function resolveCustomFontTheme(fontOverrides, { projectRoot, outputDir }) {
  if (isAbsolute(fontOverrides.sourceDirectory)) {
    throw new Error("fontOverrides.sourceDirectory must be relative to book.json");
  }

  const canonicalProjectRoot = realpathSync(projectRoot);
  const requestedDirectory = resolve(canonicalProjectRoot, fontOverrides.sourceDirectory);
  const requestedStat = pathStat(requestedDirectory);
  if (!requestedStat || requestedStat.isSymbolicLink() || !requestedStat.isDirectory()) {
    throw new Error("fontOverrides.sourceDirectory must be a real directory inside the book project");
  }
  const sourceDirectory = realpathSync(requestedDirectory);
  if (!isWithinPath(canonicalProjectRoot, sourceDirectory)) {
    throw new Error("fontOverrides.sourceDirectory must be a real directory inside the book project");
  }
  if (outputDir && isWithinPath(resolve(canonicalProspectivePath(outputDir), FONT_OUTPUT_ROOT), sourceDirectory)) {
    throw new Error("fontOverrides.sourceDirectory must remain outside the generated assets/fonts directory");
  }

  const customTheme = {
    id: "custom",
    fontSourceDirectory: sourceDirectory,
    fonts: {
      display: customFontRole(fontOverrides.display, "fontOverrides.display"),
      body: customFontRole(fontOverrides.body, "fontOverrides.body"),
      ui: customFontRole(fontOverrides.ui, "fontOverrides.ui"),
      faces: fontOverrides.faces,
      licenses: fontOverrides.licenses
    }
  };
  const validatedAssets = fontAssets(customTheme).assets;
  customTheme.fonts.faces = validatedAssets.filter(({ kind }) => kind === "face").map(({ metadata }) => metadata);
  customTheme.fonts.licenses = validatedAssets.filter(({ kind }) => kind === "license").map(({ metadata }) => metadata);

  const roleFamilies = new Set([customTheme.fonts.display.family, customTheme.fonts.body.family, customTheme.fonts.ui.family]);
  const faceFamilies = new Set(customTheme.fonts.faces.map(({ family }) => family));
  const licenseFamilies = new Set(customTheme.fonts.licenses.map(({ family }) => family));
  const missingFaces = [...roleFamilies].filter((family) => !faceFamilies.has(family));
  const missingLicenses = [...faceFamilies].filter((family) => !licenseFamilies.has(family));
  if (missingFaces.length) throw new Error(`fontOverrides has no face for selected family: ${missingFaces.join(", ")}`);
  if (missingLicenses.length) throw new Error(`fontOverrides has no license for face family: ${missingLicenses.join(", ")}`);

  return customTheme;
}

function fontAssets(theme) {
  const themeId = safeSegment(theme?.id, "theme id");
  const faces = theme?.fonts?.faces ?? [];
  const licenses = theme?.fonts?.licenses ?? [];
  if (!Array.isArray(faces) || !Array.isArray(licenses)) {
    throw new Error(`Theme ${themeId} font faces and licenses must be arrays`);
  }

  const assets = [
    ...faces.map((face, index) => ({ kind: "face", metadata: face, file: face?.file, label: `font face ${index + 1}` })),
    ...licenses.map((license, index) => ({ kind: "license", metadata: license, file: license?.file, label: `font license ${index + 1}` }))
  ];
  const seen = new Set();
  const sourceDirectory = theme.fontSourceDirectory ?? resolve(themesDir, themeId, "fonts");

  const resolvedAssets = assets.map((asset) => {
    const file = safeSegment(asset.file, `Theme ${themeId} ${asset.label}`);
    if (seen.has(file)) throw new Error(`Theme ${themeId} declares duplicate font asset ${file}`);
    seen.add(file);
    if (asset.kind === "face" && !FONT_FORMATS.has(extname(file).toLowerCase())) {
      throw new Error(`Theme ${themeId} ${asset.label} uses an unsupported format: ${file}`);
    }
    if (asset.kind === "license" && extname(file).toLowerCase() !== ".txt") {
      throw new Error(`Theme ${themeId} ${asset.label} must use a safe .txt file: ${file}`);
    }
    const sourcePath = resolve(sourceDirectory, file);
    const sourceStat = pathStat(sourcePath);
    if (!sourceStat) throw new Error(`Theme ${themeId} font asset does not exist: ${sourcePath}`);
    if (sourceStat.isSymbolicLink() || !sourceStat.isFile()) {
      throw new Error(`Theme ${themeId} font asset must be a regular file: ${sourcePath}`);
    }
    let metadata;
    if (asset.kind === "face") {
      metadata = {
        ...asset.metadata,
        family: normalizeFontFamily(asset.metadata?.family, `Theme ${themeId} ${asset.label} family`),
        weight: normalizeFontWeight(asset.metadata?.weight, `Theme ${themeId} ${asset.label} weight`),
        style: normalizeFontStyle(asset.metadata?.style, `Theme ${themeId} ${asset.label} style`)
      };
    } else {
      const contents = readFileSync(sourcePath, "utf8");
      if (!SUPPORTED_LICENSE_TEXTS.some((pattern) => pattern.test(contents))) {
        throw new Error(`Theme ${themeId} ${asset.label} must identify an OFL 1.1, Apache 2.0, or Ubuntu Font License 1.0 text`);
      }
      metadata = {
        ...asset.metadata,
        family: normalizeFontFamily(asset.metadata?.family, `Theme ${themeId} ${asset.label} family`)
      };
    }
    return {
      ...asset,
      metadata,
      file,
      sourcePath,
      outputPath: `${FONT_OUTPUT_ROOT}/${themeId}/${file}`
    };
  });

  return { themeId, assets: resolvedAssets };
}

function ensureAssetsDirectory(outputRoot) {
  const assetsDirectory = resolve(outputRoot, "assets");
  const stat = pathStat(assetsDirectory);
  if (!stat) mkdirSync(assetsDirectory);
  else if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`Theme font destination must not traverse a symbolic link or file: ${assetsDirectory}`);
  }
}

export function normalizeThemeFontMode(mode) {
  return mode === "system" ? "system" : "bundled";
}

export function resolveBookFontTheme({ theme, fontTheme, fontOverrides, projectRoot, outputDir, fontMode = "bundled" }) {
  if (fontTheme !== undefined && fontOverrides !== undefined) {
    throw new Error("fontTheme and fontOverrides may not both be set");
  }
  if (fontMode === "system" && (fontTheme !== undefined || fontOverrides !== undefined)) {
    throw new Error("fontTheme and fontOverrides require bundled fontMode");
  }
  if (fontTheme !== undefined) return getFontTheme(fontTheme);
  if (fontOverrides === undefined) return theme;
  return resolveCustomFontTheme(fontOverrides, { projectRoot, outputDir });
}

function renderFontCss(themeId, assets) {
  return assets
    .filter(({ kind }) => kind === "face")
    .map(({ metadata: face, file, outputPath }) => {
      const format = FONT_FORMATS.get(extname(file).toLowerCase());
      return `@font-face {
  font-family: ${JSON.stringify(face.family)};
  src: url(${JSON.stringify(outputPath)}) format(${JSON.stringify(format)});
  font-style: ${face.style};
  font-weight: ${face.weight};
  font-display: block;
}`;
    })
    .join("\n");
}

function copyStagedFontSet(stageRoot, publication) {
  mkdirSync(stageRoot);
  if (!publication.themeId || !publication.assets.length) return;
  const themeDirectory = resolve(stageRoot, publication.themeId);
  mkdirSync(themeDirectory);

  for (const asset of publication.assets) {
    const sourceStat = pathStat(asset.sourcePath);
    if (!sourceStat || sourceStat.isSymbolicLink() || !sourceStat.isFile()) {
      throw new Error(`Theme ${publication.themeId} font asset must remain a regular file: ${asset.sourcePath}`);
    }
    copyFileSync(asset.sourcePath, resolve(themeDirectory, asset.file), constants.COPYFILE_EXCL);
  }
}

export function prepareThemeFonts(theme) {
  const publication = theme === null ? { themeId: null, assets: [] } : fontAssets(theme);
  const files = Object.freeze(publication.assets.map(({ outputPath }) => outputPath));
  const prepared = Object.freeze({
    css: publication.themeId ? renderFontCss(publication.themeId, publication.assets) : "",
    files
  });
  preparedFontSets.set(prepared, publication);
  return prepared;
}

function preparedPublication(prepared) {
  const publication = preparedFontSets.get(prepared);
  if (!publication) throw new Error("Theme font output requires a value returned by prepareThemeFonts");
  return publication;
}

function fontOutputRoot(outputDir) {
  const outputRoot = resolve(outputDir);
  const outputStat = pathStat(outputRoot);
  if (!outputStat || outputStat.isSymbolicLink() || !outputStat.isDirectory()) {
    throw new Error(`Theme font outputDir must be a real directory: ${outputRoot}`);
  }
  return outputRoot;
}

export function stageThemeFonts(prepared, outputDir) {
  const publication = preparedPublication(prepared);
  const outputRoot = fontOutputRoot(outputDir);
  ensureAssetsDirectory(outputRoot);
  copyStagedFontSet(resolve(outputRoot, FONT_OUTPUT_ROOT), publication);
  return prepared.files;
}

export function publishThemeFonts(prepared, outputDir) {
  preparedPublication(prepared);
  const outputRoot = fontOutputRoot(outputDir);
  const stageContainer = mkdtempSync(resolve(outputRoot, ".theme-fonts-stage-"));
  const stageRoot = resolve(stageContainer, "next");

  try {
    mkdirSync(stageRoot);
    stageThemeFonts(prepared, stageRoot);
    publishGeneratedTargets({ outputDir: outputRoot, stageRoot, targets: [FONT_OUTPUT_ROOT] });
    return prepared.files;
  } finally {
    try {
      rmSync(stageContainer, { recursive: true, force: true });
    } catch (error) {
      reportCleanupFailure(stageContainer, error);
    }
  }
}

function reportCleanupFailure(path, error) {
  try {
    process.emitWarning(`Theme font cleanup could not remove ${path}: ${error.message}`, {
      code: "THEME_FONT_CLEANUP_FAILED"
    });
  } catch {
    // Warning delivery must never replace the publication result.
  }
}

export function themeFontFingerprint(theme) {
  const { assets } = fontAssets(theme);
  return assets.map(({ file, sourcePath }) => ({
    path: `fonts/${file}`,
    sha256: sha256(readFileSync(sourcePath))
  }));
}

export function createThemeCacheIdentity({ theme, fontTheme, fontMode }) {
  const { fonts: _visualFonts, ...visualTheme } = theme;
  return {
    theme: visualTheme,
    fontTheme: {
      id: fontTheme.id,
      fonts: fontMode === "system"
        ? {
            display: themeFontStack(fontTheme, "display"),
            body: themeFontStack(fontTheme, "body"),
            ui: themeFontStack(fontTheme, "ui")
          }
        : fontTheme.fonts
    },
    fontAssets: fontMode === "bundled" ? themeFontFingerprint(fontTheme) : []
  };
}
