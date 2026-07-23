import { lstat, mkdir, mkdtemp, realpath, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";

import { isWithinPath } from "./book-paths.mjs";
import { sha256 } from "./content-hash.mjs";
import { normalizeFontFallback, normalizeFontFamily } from "./font-contract.mjs";

export const GOOGLE_FONTS_RAW_ROOT = "https://raw.githubusercontent.com/google/fonts";

const MAX_FAMILIES = 3;
const MAX_FACES = 24;
const MAX_METADATA_BYTES = 1024 * 1024;
const MAX_LICENSE_BYTES = 1024 * 1024;
const MAX_FONT_BYTES = 12 * 1024 * 1024;
const MAX_TOTAL_BYTES = 48 * 1024 * 1024;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 30_000;
const LICENSE_FILES = new Map([
  ["OFL", "OFL.txt"],
  ["APACHE2", "LICENSE.txt"],
  ["UFL", "UFL.txt"]
]);

function compareText(left, right) {
  return String(left).localeCompare(String(right), "en");
}

function objectValue(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function exactKeys(value, expected, label) {
  const keys = Object.keys(value).sort(compareText);
  const wanted = [...expected].sort(compareText);
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} must contain exactly: ${wanted.join(", ")}`);
  }
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function safeFileSegment(value, label) {
  const file = nonEmptyString(value, label);
  if (file === "." || file === ".." || file.includes("/") || file.includes("\\") || file.includes("\0")) {
    throw new Error(`${label} must be a safe filename`);
  }
  return file;
}

function repositoryPath(value, label) {
  const path = nonEmptyString(value, label);
  if (!/^(?:ofl|apache|ufl)\/[a-z0-9]+$/u.test(path)) {
    throw new Error(`${label} must be an official google/fonts family path such as ofl/sourceserif4`);
  }
  return path;
}

function sourceDirectory(value) {
  const path = nonEmptyString(value, "sourceDirectory");
  if (isAbsolute(path) || path.includes("\\") || path.includes("\0")) {
    throw new Error("sourceDirectory must be a portable project-relative path");
  }
  const segments = path.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("sourceDirectory must be a portable project-relative path without empty, . or .. segments");
  }
  return segments.join("/");
}

function roleValue(value, label) {
  const role = objectValue(value, label);
  exactKeys(role, ["family", "fallback"], label);
  return {
    family: normalizeFontFamily(role.family, `${label}.family`),
    fallback: normalizeFontFallback(role.fallback, `${label}.fallback`)
  };
}

export function validateGoogleFontsRequest(input) {
  const request = objectValue(input, "Google Fonts acquisition request");
  exactKeys(request, ["schemaVersion", "ref", "sourceDirectory", "roles", "families"], "Google Fonts acquisition request");
  if (request.schemaVersion !== 1) throw new Error("Google Fonts acquisition request schemaVersion must be 1");
  if (typeof request.ref !== "string" || !/^[0-9a-f]{40}$/iu.test(request.ref)) {
    throw new Error("ref must be an immutable 40-character google/fonts commit SHA");
  }

  if (!Array.isArray(request.families) || request.families.length < 1 || request.families.length > MAX_FAMILIES) {
    throw new Error(`families must contain between 1 and at most ${MAX_FAMILIES} entries`);
  }

  const roles = objectValue(request.roles, "roles");
  exactKeys(roles, ["display", "body", "ui"], "roles");
  const normalizedRoles = {
    display: roleValue(roles.display, "roles.display"),
    body: roleValue(roles.body, "roles.body"),
    ui: roleValue(roles.ui, "roles.ui")
  };
  const normalizedFamilies = request.families.map((value, index) => {
    const family = objectValue(value, `families[${index}]`);
    exactKeys(family, ["family", "repositoryPath"], `families[${index}]`);
    return {
      family: normalizeFontFamily(family.family, `families[${index}].family`),
      repositoryPath: repositoryPath(family.repositoryPath, `families[${index}].repositoryPath`)
    };
  });
  const familyNames = new Set(normalizedFamilies.map(({ family }) => family));
  const familyPaths = new Set(normalizedFamilies.map(({ repositoryPath: path }) => path));
  if (familyNames.size !== normalizedFamilies.length) throw new Error("families must not repeat a family name");
  if (familyPaths.size !== normalizedFamilies.length) throw new Error("families must not repeat a repositoryPath");
  const roleFamilyNames = new Set(Object.values(normalizedRoles).map(({ family }) => family));
  if (familyNames.size !== roleFamilyNames.size) {
    throw new Error("families must contain exactly the unique display, body, and UI role families");
  }
  for (const [role, { family }] of Object.entries(normalizedRoles)) {
    if (!familyNames.has(family)) throw new Error(`roles.${role}.family must have a matching families entry: ${family}`);
  }

  return {
    schemaVersion: 1,
    ref: request.ref.toLowerCase(),
    sourceDirectory: sourceDirectory(request.sourceDirectory),
    roles: normalizedRoles,
    families: normalizedFamilies.sort((left, right) => compareText(left.family, right.family))
  };
}

function stringField(source, name, label) {
  const expression = new RegExp(`(?:^|\\n)\\s*${name}:\\s*(\"(?:\\\\.|[^\"\\\\])*\")`, "u");
  const match = expression.exec(source);
  if (!match) throw new Error(`METADATA.pb is missing ${label}`);
  return JSON.parse(match[1]);
}

function numberField(source, name, label) {
  const expression = new RegExp(`(?:^|\\n)\\s*${name}:\\s*(-?\\d+(?:\\.\\d+)?)`, "u");
  const match = expression.exec(source);
  if (!match) throw new Error(`METADATA.pb is missing ${label}`);
  return Number(match[1]);
}

function blocks(source, name) {
  const expression = new RegExp(`(?:^|\\n)\\s*${name}\\s*\\{`, "gu");
  const output = [];
  let match;
  while ((match = expression.exec(source)) !== null) {
    const opening = source.indexOf("{", match.index);
    let depth = 1;
    let quoted = false;
    let escaped = false;
    let cursor = opening + 1;
    for (; cursor < source.length && depth > 0; cursor += 1) {
      const character = source[cursor];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === "\"") quoted = false;
      } else if (character === "\"") quoted = true;
      else if (character === "{") depth += 1;
      else if (character === "}") depth -= 1;
    }
    if (depth !== 0) throw new Error(`METADATA.pb has an unterminated ${name} block`);
    output.push(source.slice(opening + 1, cursor - 1));
    expression.lastIndex = cursor;
  }
  return output;
}

function weightValue(weight, weightAxis) {
  if (!weightAxis || weightAxis.min === weightAxis.max) return weight;
  return `${weightAxis.min} ${weightAxis.max}`;
}

export function parseGoogleFontsMetadata(source) {
  const text = nonEmptyString(source, "METADATA.pb");
  const family = normalizeFontFamily(stringField(text, "name", "family name"), "METADATA.pb family name");
  const license = stringField(text, "license", "license").toUpperCase();
  if (!LICENSE_FILES.has(license)) throw new Error(`METADATA.pb uses unsupported license ${license}`);
  const weightAxisBlock = blocks(text, "axes").find((block) => stringField(block, "tag", "axis tag") === "wght");
  const weightAxis = weightAxisBlock ? {
    min: numberField(weightAxisBlock, "min_value", "wght min_value"),
    max: numberField(weightAxisBlock, "max_value", "wght max_value")
  } : null;
  if (weightAxis && (!Number.isInteger(weightAxis.min) || !Number.isInteger(weightAxis.max)
    || weightAxis.min < 1 || weightAxis.max > 1000 || weightAxis.min > weightAxis.max)) {
    throw new Error("METADATA.pb has an invalid wght axis range");
  }

  const faces = blocks(text, "fonts").map((block, index) => {
    const faceFamily = stringField(block, "name", `fonts[${index}].name`);
    if (faceFamily !== family) throw new Error(`METADATA.pb font family ${faceFamily} does not match ${family}`);
    const style = stringField(block, "style", `fonts[${index}].style`);
    if (!/^(?:normal|italic|oblique)$/u.test(style)) throw new Error(`METADATA.pb has unsupported font style ${style}`);
    const weight = numberField(block, "weight", `fonts[${index}].weight`);
    if (!Number.isInteger(weight) || weight < 1 || weight > 1000) throw new Error(`METADATA.pb has invalid font weight ${weight}`);
    const file = safeFileSegment(stringField(block, "filename", `fonts[${index}].filename`), `fonts[${index}].filename`);
    if (!file.toLowerCase().endsWith(".ttf")) throw new Error(`METADATA.pb font files must use .ttf: ${file}`);
    return { family, style, weight: weightValue(weight, weightAxis), file };
  });
  if (!faces.length) throw new Error("METADATA.pb must declare at least one font face");
  if (faces.length > MAX_FACES) throw new Error(`METADATA.pb declares more than ${MAX_FACES} font faces`);
  if (new Set(faces.map(({ file }) => file)).size !== faces.length) throw new Error("METADATA.pb declares duplicate font filenames");
  return { family, license, licenseFile: LICENSE_FILES.get(license), faces };
}

async function responseBytes(response, label, maximumBytes) {
  if (!response?.ok) throw new Error(`${label} download failed with HTTP ${response?.status ?? "unknown"}`);
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) throw new Error(`${label} exceeds the ${maximumBytes}-byte limit`);
  if (!response.body?.getReader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maximumBytes) throw new Error(`${label} exceeds the ${maximumBytes}-byte limit`);
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBytes) {
      await reader.cancel();
      throw new Error(`${label} exceeds the ${maximumBytes}-byte limit`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, size);
}

async function fetchAsset(fetchImpl, url, label, maximumBytes, budget, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      redirect: "error",
      headers: { accept: "application/octet-stream" },
      signal: controller.signal
    });
    const bytes = await responseBytes(response, label, maximumBytes);
    budget.bytes += bytes.length;
    if (budget.bytes > MAX_TOTAL_BYTES) throw new Error(`Google Fonts acquisition exceeds the ${MAX_TOTAL_BYTES}-byte total limit`);
    return bytes;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${label} download timed out after ${timeoutMs}ms`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function pathStat(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function ensureLocalDirectory(root, directory) {
  if (!isWithinPath(root, directory)) throw new Error("font source parent must remain inside projectRoot");
  let current = root;
  for (const segment of relative(root, directory).split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    let stat = await pathStat(current);
    if (!stat) {
      try {
        await mkdir(current);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
      stat = await pathStat(current);
    }
    if (!stat?.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`font source parent must not traverse a symbolic link or file: ${current}`);
    }
  }
}

function prefixedFilename(repositoryPathValue, filename) {
  return `${basename(repositoryPathValue)}-${safeFileSegment(filename, "Google Fonts filename")}`;
}

async function downloadBundle(request, fetchImpl, timeoutMs) {
  const budget = { bytes: 0 };
  const assets = [];
  const faces = [];
  const licenses = [];
  for (const familyRequest of request.families) {
    const root = `${GOOGLE_FONTS_RAW_ROOT}/${request.ref}/${familyRequest.repositoryPath}`;
    const metadataBytes = await fetchAsset(fetchImpl, `${root}/METADATA.pb`, `${familyRequest.family} metadata`, MAX_METADATA_BYTES, budget, timeoutMs);
    const metadata = parseGoogleFontsMetadata(metadataBytes.toString("utf8"));
    if (metadata.family !== familyRequest.family) {
      throw new Error(`Requested family ${familyRequest.family} does not match google/fonts metadata family ${metadata.family}`);
    }
    if (faces.length + metadata.faces.length > MAX_FACES) throw new Error(`Acquisition may contain at most ${MAX_FACES} font faces`);

    for (const face of metadata.faces) {
      const outputFile = prefixedFilename(familyRequest.repositoryPath, face.file);
      const bytes = await fetchAsset(fetchImpl, `${root}/${face.file}`, `${familyRequest.family} font ${face.file}`, MAX_FONT_BYTES, budget, timeoutMs);
      assets.push({ file: outputFile, bytes, source: `${familyRequest.repositoryPath}/${face.file}` });
      faces.push({ family: face.family, weight: face.weight, style: face.style, file: outputFile });
    }
    const licenseOutput = prefixedFilename(familyRequest.repositoryPath, metadata.licenseFile);
    const licenseBytes = await fetchAsset(fetchImpl, `${root}/${metadata.licenseFile}`, `${familyRequest.family} license`, MAX_LICENSE_BYTES, budget, timeoutMs);
    assets.push({ file: licenseOutput, bytes: licenseBytes, source: `${familyRequest.repositoryPath}/${metadata.licenseFile}` });
    licenses.push({ family: familyRequest.family, file: licenseOutput });
  }
  if (new Set(assets.map(({ file }) => file)).size !== assets.length) throw new Error("Acquisition produced duplicate output filenames");
  return {
    assets: assets.sort((left, right) => compareText(left.file, right.file)),
    faces: faces.sort((left, right) => compareText(left.family, right.family)
      || compareText(left.style, right.style)
      || compareText(left.weight, right.weight)
      || compareText(left.file, right.file)),
    licenses: licenses.sort((left, right) => compareText(left.family, right.family))
  };
}

export async function acquireGoogleFontBundle({
  projectRoot,
  request: input,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_DOWNLOAD_TIMEOUT_MS
}) {
  if (typeof fetchImpl !== "function") throw new Error("Google Fonts acquisition requires fetch support");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error("Google Fonts acquisition timeoutMs must be a positive integer");
  }
  const request = validateGoogleFontsRequest(input);
  const canonicalProjectRoot = await realpath(resolve(projectRoot));
  const destination = resolve(canonicalProjectRoot, ...request.sourceDirectory.split("/"));
  if (!isWithinPath(canonicalProjectRoot, destination) || destination === canonicalProjectRoot) {
    throw new Error("sourceDirectory must remain inside projectRoot");
  }
  if (await pathStat(destination)) throw new Error(`font source directory already exists: ${destination}`);
  const parent = dirname(destination);
  await ensureLocalDirectory(canonicalProjectRoot, parent);

  const bundle = await downloadBundle(request, fetchImpl, timeoutMs);
  const stage = await mkdtemp(resolve(parent, ".google-fonts-stage-"));
  try {
    for (const asset of bundle.assets) await writeFile(resolve(stage, asset.file), asset.bytes, { flag: "wx" });
    if (await pathStat(destination)) throw new Error(`font source directory already exists: ${destination}`);
    await rename(stage, destination);
  } finally {
    try {
      await rm(stage, { recursive: true, force: true });
    } catch (error) {
      try {
        process.emitWarning(`Google Fonts cleanup could not remove ${stage}: ${error.message}`, {
          code: "GOOGLE_FONTS_CLEANUP_FAILED"
        });
      } catch {
        // Cleanup reporting must not replace the acquisition result.
      }
    }
  }

  return {
    schemaVersion: 1,
    source: {
      provider: "google/fonts",
      repository: "https://github.com/google/fonts",
      ref: request.ref
    },
    fontOverrides: {
      sourceDirectory: request.sourceDirectory,
      display: request.roles.display,
      body: request.roles.body,
      ui: request.roles.ui,
      faces: bundle.faces,
      licenses: bundle.licenses
    },
    files: bundle.assets.map(({ file, bytes, source }) => ({ file, source, sha256: sha256(bytes) }))
  };
}

export function googleFontsRequestExample() {
  return {
    schemaVersion: 1,
    ref: "<40-character google/fonts commit SHA>",
    sourceDirectory: "book-fonts/custom",
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
}
