import { existsSync, readFileSync } from "node:fs";
import { getTheme, themeColors } from "../../themes/index.mjs";
import { portableRelativePath } from "./book-paths.mjs";
import { sha256 } from "./content-hash.mjs";
import { MINIMUM_COVER_DPI, coverFrameForConfig, inspectCoverBitmap, resolveCoverAssetTarget, resolveRequiredCoverAsset } from "./cover-assets.mjs";

const PRIMARY_IMAGE_COLOR_ROLES = Object.freeze([
  ["page", "background or light ground"],
  ["ink", "darkest detail and shadow"],
  ["heading", "dominant hue"],
  ["accent", "supporting accent"],
  ["soft", "soft secondary tone"],
  ["coverBand", "deep anchor tone"]
]);

const IMAGE_COLOR_ROLE_LABELS = Object.freeze(Object.fromEntries([
  ...PRIMARY_IMAGE_COLOR_ROLES,
  ["browser", "surrounding neutral"],
  ["deck", "secondary hue"],
  ["muted", "muted detail"],
  ["meta", "small-detail accent"],
  ["rule", "linework tone"],
  ["steel", "structural tone"],
  ["callout", "light supporting field"]
]));

function normalizedPromptColor(value) {
  const color = String(value).trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/iu.test(color)) return color.toUpperCase();
  const rgba = color.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*\)$/iu);
  if (!rgba) return color;
  const hex = rgba.slice(1, 4).map((channel) => Number(channel).toString(16).padStart(2, "0")).join("").toUpperCase();
  return `#${hex} at ${Math.round(Number(rgba[4]) * 100)}% intensity`;
}

export function themeImagePalette(theme, overrides = {}) {
  const resolved = themeColors(theme, overrides);
  const keys = [...new Set([
    ...PRIMARY_IMAGE_COLOR_ROLES.map(([key]) => key),
    ...Object.keys(overrides)
  ])];
  const roles = Object.fromEntries(keys
    .filter((key) => resolved[key] !== undefined)
    .map((key) => [key, normalizedPromptColor(resolved[key])]));
  if (!Object.keys(roles).length) throw new Error(`Theme ${theme?.id ?? "unknown"} has no colors for its image-prompt palette`);
  const values = Object.entries(roles)
    .map(([key, color]) => `${IMAGE_COLOR_ROLE_LABELS[key] ?? key}: ${color}`)
    .join("; ");
  return {
    roles,
    instruction: `Authoritative color palette: ${values}. Use these colors as the illustration palette, with natural tonal variation only. Do not render color names, role labels, hex codes, or swatches as text.`
  };
}

export function themeImagePrompt(theme, subject, constraints, palette = themeImagePalette(theme)) {
  const contract = theme?.imagePrompt;
  if (!contract?.template || !contract?.subjectPlaceholder || !contract?.palettePlaceholder || !contract?.constraintPlaceholder) {
    throw new Error(`Theme ${theme?.id ?? "unknown"} has no canonical image-prompt template`);
  }
  if (!contract.template.includes(contract.subjectPlaceholder)) {
    throw new Error(`Theme ${theme.id} image-prompt template is missing its subject placeholder`);
  }
  if (!contract.template.includes(contract.palettePlaceholder)) {
    throw new Error(`Theme ${theme.id} image-prompt template is missing its palette placeholder`);
  }
  if (!contract.template.includes(contract.constraintPlaceholder)) {
    throw new Error(`Theme ${theme.id} image-prompt template is missing its cover-constraint placeholder`);
  }
  const { frame, minimumPixels, safeArea } = constraints;
  const aspect = Number((frame.widthIn / frame.heightIn).toFixed(3));
  const productionConstraints = `Cover-art production constraints: landscape crop ${frame.widthIn}in × ${frame.heightIn}in (aspect ${aspect}:1); generate at least ${minimumPixels.width} × ${minimumPixels.height} pixels. ${safeArea}`;
  return contract.template
    .replaceAll(contract.subjectPlaceholder, subject)
    .replaceAll(contract.palettePlaceholder, palette.instruction)
    .replaceAll(contract.constraintPlaceholder, productionConstraints);
}

export function createCoverImageRequest({ config, plan, outputDir }) {
  const cover = plan?.visuals?.cover;
  if (!cover) throw new Error("COVER_DECISION_REQUIRED: book-plan visuals.cover is required before image generation.");
  const theme = getTheme(plan.theme.id ?? config.style);
  const palette = themeImagePalette(theme, config.themeOverrides);
  const assetPath = resolveCoverAssetTarget(config.coverImage, outputDir);
  const frame = coverFrameForConfig(config);
  const constraints = {
    bitmapOnly: true,
    localOnly: true,
    noTypography: true,
    frame,
    minimumDpi: MINIMUM_COVER_DPI,
    minimumPixels: {
      width: Math.ceil(frame.widthIn * MINIMUM_COVER_DPI),
      height: Math.ceil(frame.heightIn * MINIMUM_COVER_DPI)
    },
    safeArea: theme.imagePrompt.coverArt?.safeArea ?? "Keep the focal subject clear of the outer 10% of the frame."
  };
  const value = {
    schemaVersion: 2,
    manuscriptHash: plan.manuscriptHash,
    generationId: cover.generationId,
    theme: theme.id,
    coverRoute: plan.layout.coverRoute,
    sourceBlockIds: cover.sourceBlockIds,
    subject: cover.subject,
    rationale: cover.rationale,
    altText: cover.altText,
    focalPoint: cover.focalPoint,
    palette,
    targetAsset: portableRelativePath(outputDir, assetPath),
    prompt: themeImagePrompt(theme, cover.subject, constraints, palette),
    constraints
  };
  return { ...value, requestHash: sha256(value) };
}

export function assertCoverImageRequestFile(path, options) {
  const expected = createCoverImageRequest(options);
  if (!existsSync(path)) {
    throw new Error(`COVER_REQUEST_MISSING: ${path} does not exist. Run prepare-cover-image.mjs, generate the requested bitmap, and retry.`);
  }
  let recorded;
  try {
    recorded = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`COVER_REQUEST_INVALID: cannot read ${path}: ${error.message}`);
  }
  if (sha256(recorded) !== sha256(expected)) {
    throw new Error("COVER_REQUEST_STALE: cover-image-request.json does not match the current manuscript, plan, theme, route, or target asset. Regenerate the request and artwork.");
  }
  return expected;
}

export function createCoverGenerationReceipt(options, assetEvidence = {}) {
  const request = createCoverImageRequest(options);
  const assetPath = assetEvidence.assetPath ?? resolveRequiredCoverAsset(options.config.coverImage, options.outputDir);
  const report = assetEvidence.report ?? inspectCoverBitmap(assetPath, {
    frame: request.constraints.frame,
    minimumDpi: request.constraints.minimumDpi
  });
  return {
    schemaVersion: 1,
    generator: "image-generation-tool",
    requestHash: request.requestHash,
    manuscriptHash: request.manuscriptHash,
    generationId: request.generationId,
    targetAsset: request.targetAsset,
    assetHash: report.sha256,
    format: report.format,
    width: report.width,
    height: report.height,
    frame: report.frame,
    effectiveDpi: report.effectiveDpi,
    minimumDpi: report.minimumDpi
  };
}

export function assertCoverGenerationReceiptFile(path, options, assetEvidence) {
  const expected = createCoverGenerationReceipt(options, assetEvidence);
  if (!existsSync(path)) {
    throw new Error(`COVER_GENERATION_RECEIPT_MISSING: ${path} does not exist. Generate the bitmap for cover-image-request.json, then run record-cover-image.mjs before building.`);
  }
  let recorded;
  try {
    recorded = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`COVER_GENERATION_RECEIPT_INVALID: cannot read ${path}: ${error.message}`);
  }
  if (sha256(recorded) !== sha256(expected)) {
    throw new Error("COVER_GENERATION_RECEIPT_STALE: cover-generation-receipt.json does not match the current manuscript request and exact bitmap. Generate fresh manuscript-grounded artwork and record it again.");
  }
  return expected;
}
