import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { isWithinPath } from "./book-paths.mjs";
import { sha256 } from "./content-hash.mjs";
import { resolveLocalAsset } from "./local-assets.mjs";

export const COVER_FRAME = Object.freeze({ widthIn: 8.5, heightIn: 7.45 });
export const MINIMUM_COVER_DPI = 150;
const LETTER_HEIGHT_IN = 11;
const DEFAULT_COVER_BAND_HEIGHT_IN = 3.55;
const MAX_BITMAP_FILE_BYTES = 128 * 1024 * 1024;
const MAX_BITMAP_DIMENSION = 30_000;
const MAX_BITMAP_PIXELS = 120_000_000;
const MAX_PNG_DECODE_BYTES = 512 * 1024 * 1024;

export function coverFrameForConfig(config = {}) {
  const bandHeight = Number(config.coverBandHeight ?? DEFAULT_COVER_BAND_HEIGHT_IN);
  if (!Number.isFinite(bandHeight) || bandHeight <= 0 || bandHeight >= LETTER_HEIGHT_IN) {
    throw new Error(`coverBandHeight must leave a positive Letter-size artwork frame; received ${config.coverBandHeight}`);
  }
  return Object.freeze({ widthIn: 8.5, heightIn: Number((LETTER_HEIGHT_IN - bandHeight).toFixed(2)) });
}

export function resolveCoverAssetTarget(value, outputDir, { mustExist = false } = {}) {
  const asset = String(value ?? "").trim();
  if (!asset) throw new Error("COVER_ASSET_REQUIRED: book.json coverImage must name the generated local bitmap asset.");
  if (/^(?:https?:)?\/\//iu.test(asset) || /^data:/iu.test(asset) || /^[a-z][a-z\d+.-]*:/iu.test(asset)) {
    throw new Error("COVER_ASSET_LOCAL_REQUIRED: coverImage must be a local bitmap inside outputDir; remote URLs and data URLs are invalid.");
  }
  const candidate = resolveLocalAsset(asset, outputDir, "coverImage", outputDir);
  if (!candidate) throw new Error("COVER_ASSET_LOCAL_REQUIRED: coverImage must be a local bitmap inside outputDir.");
  if (!mustExist) return candidate;
  if (!existsSync(candidate)) {
    throw new Error(`COVER_ASSET_MISSING: generated cover bitmap does not exist at ${candidate}. Generate it from cover-image-request.json and retry.`);
  }
  if (lstatSync(candidate).isSymbolicLink()) {
    throw new Error(`COVER_ASSET_SYMLINK: coverImage must not be a symbolic link: ${candidate}`);
  }
  if (!lstatSync(candidate).isFile()) throw new Error(`COVER_ASSET_NOT_FILE: coverImage must name a regular file: ${candidate}`);
  if (!isWithinPath(realpathSync(outputDir), realpathSync(candidate))) {
    throw new Error(`COVER_ASSET_OUTSIDE: coverImage resolves outside outputDir: ${candidate}`);
  }
  return candidate;
}

export function resolveRequiredCoverAsset(value, outputDir) {
  return resolveCoverAssetTarget(value, outputDir, { mustExist: true });
}

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function pngDimensions(bytes) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!bytes.subarray(0, 8).equals(signature)) return null;
  let offset = 8;
  let dimensions = null;
  let pngHeader = null;
  const compressed = [];
  let hasPalette = false;
  let ended = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error("PNG contains a truncated chunk");
    const length = bytes.readUInt32BE(offset);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (dataEnd < dataStart || chunkEnd > bytes.length) throw new Error("PNG chunk length exceeds the file size");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const expectedCrc = bytes.readUInt32BE(dataEnd);
    const actualCrc = crc32(bytes.subarray(offset + 4, dataEnd));
    if (actualCrc !== expectedCrc) throw new Error(`PNG ${type || "unknown"} chunk has an invalid checksum`);
    const data = bytes.subarray(dataStart, dataEnd);
    if (type === "IHDR") {
      if (offset !== 8 || length !== 13 || dimensions) throw new Error("PNG has an invalid IHDR chunk");
      dimensions = { format: "png", width: data.readUInt32BE(0), height: data.readUInt32BE(4) };
      pngHeader = {
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12]
      };
    } else if (type === "PLTE") {
      hasPalette = true;
    } else if (type === "IDAT") {
      compressed.push(data);
    } else if (type === "IEND") {
      if (length !== 0) throw new Error("PNG has an invalid IEND chunk");
      ended = true;
      offset = chunkEnd;
      break;
    }
    offset = chunkEnd;
  }
  if (!dimensions) throw new Error("PNG has no readable IHDR chunk");
  if (!compressed.length) throw new Error("PNG has no image data");
  if (!ended || offset !== bytes.length) throw new Error("PNG has no valid terminal IEND chunk");
  const channelsByColorType = new Map([[0, 1], [2, 3], [3, 1], [4, 2], [6, 4]]);
  const allowedDepths = new Map([[0, [1, 2, 4, 8, 16]], [2, [8, 16]], [3, [1, 2, 4, 8]], [4, [8, 16]], [6, [8, 16]]]);
  if (!allowedDepths.get(pngHeader.colorType)?.includes(pngHeader.bitDepth)) throw new Error("PNG uses an invalid bit-depth/color-type combination");
  if (pngHeader.compression !== 0 || pngHeader.filter !== 0 || ![0, 1].includes(pngHeader.interlace)) {
    throw new Error("PNG uses an unsupported compression, filter, or interlace method");
  }
  if (pngHeader.colorType === 3 && !hasPalette) throw new Error("indexed PNG has no palette");
  try {
    const decoded = inflateSync(Buffer.concat(compressed), { maxOutputLength: MAX_PNG_DECODE_BYTES });
    if (!decoded.length) {
      throw new Error("decompressed image data is empty");
    }
    const bitsPerPixel = channelsByColorType.get(pngHeader.colorType) * pngHeader.bitDepth;
    const passes = pngHeader.interlace === 0
      ? [[0, 0, 1, 1]]
      : [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];
    let decodedOffset = 0;
    for (const [startX, startY, stepX, stepY] of passes) {
      const passWidth = dimensions.width <= startX ? 0 : Math.ceil((dimensions.width - startX) / stepX);
      const passHeight = dimensions.height <= startY ? 0 : Math.ceil((dimensions.height - startY) / stepY);
      if (!passWidth || !passHeight) continue;
      const rowBytes = Math.ceil(passWidth * bitsPerPixel / 8);
      for (let row = 0; row < passHeight; row += 1) {
        if (decodedOffset + rowBytes + 1 > decoded.length) throw new Error("decoded scanline data is truncated");
        if (decoded[decodedOffset] > 4) throw new Error("decoded scanline uses an invalid filter byte");
        decodedOffset += rowBytes + 1;
      }
    }
    if (decodedOffset !== decoded.length) throw new Error("decoded scanline length does not match the image header");
  } catch (error) {
    throw new Error(`PNG image data cannot be decoded: ${error.message}`);
  }
  return dimensions;
}

function jpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  if (bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) throw new Error("JPEG has no terminal end marker");
  let offset = 2;
  let dimensions = null;
  let hasScan = false;
  let ended = false;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error("JPEG contains data outside a declared segment");
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9) {
      ended = true;
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) throw new Error("JPEG contains a truncated segment");
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) throw new Error("JPEG segment length exceeds the file size");
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 8) throw new Error("JPEG frame header is truncated");
      dimensions = { format: "jpeg", height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    if (marker === 0xda) {
      hasScan = true;
      offset += length;
      let scanBytes = 0;
      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) {
          scanBytes += 1;
          offset += 1;
          continue;
        }
        const markerStart = offset;
        while (bytes[offset] === 0xff) offset += 1;
        const scanMarker = bytes[offset];
        if (scanMarker === 0x00 || (scanMarker >= 0xd0 && scanMarker <= 0xd7)) {
          scanBytes += 1;
          offset += 1;
          continue;
        }
        offset = markerStart;
        break;
      }
      if (!scanBytes) throw new Error("JPEG scan contains no compressed image data");
    } else {
      offset += length;
    }
  }
  if (!dimensions) throw new Error("JPEG has no readable frame dimensions");
  if (!hasScan) throw new Error("JPEG has no image scan");
  if (!ended || offset !== bytes.length) throw new Error("JPEG has no valid terminal end marker");
  return dimensions;
}

function webpDimensions(bytes) {
  if (bytes.length < 20 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") return null;
  if (bytes.readUInt32LE(4) + 8 !== bytes.length) throw new Error("WebP RIFF size does not match the file size");
  let offset = 12;
  let dimensions = null;
  let hasImageData = false;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error("WebP contains a truncated chunk header");
    const kind = bytes.toString("ascii", offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd < dataStart || dataEnd > bytes.length) throw new Error(`WebP ${kind} chunk exceeds the file size`);
    if (kind === "VP8X") {
      if (length < 10) throw new Error("WebP VP8X header is truncated");
      if (bytes[dataStart] & 0x02) throw new Error("animated WebP covers are not supported");
      dimensions = { format: "webp", width: 1 + bytes.readUIntLE(dataStart + 4, 3), height: 1 + bytes.readUIntLE(dataStart + 7, 3) };
    } else if (kind === "VP8 ") {
      if (length < 10 || !bytes.subarray(dataStart + 3, dataStart + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
        throw new Error("WebP VP8 frame header is invalid");
      }
      const frame = {
        format: "webp",
        width: bytes.readUInt16LE(dataStart + 6) & 0x3fff,
        height: bytes.readUInt16LE(dataStart + 8) & 0x3fff
      };
      dimensions ??= frame;
      hasImageData = true;
    } else if (kind === "VP8L") {
      if (length < 5 || bytes[dataStart] !== 0x2f) throw new Error("WebP VP8L frame header is invalid");
      const packed = bytes.readUInt32LE(dataStart + 1);
      dimensions ??= { format: "webp", width: (packed & 0x3fff) + 1, height: ((packed >>> 14) & 0x3fff) + 1 };
      hasImageData = true;
    } else if (kind === "ANMF") {
      throw new Error("animated WebP covers are not supported");
    }
    offset = dataEnd + (length % 2);
  }
  if (offset !== bytes.length) throw new Error("WebP chunk padding exceeds the file size");
  if (!dimensions) throw new Error("WebP has no readable VP8, VP8L, or VP8X frame dimensions");
  if (!hasImageData) throw new Error("WebP declares dimensions but contains no image frame data");
  return dimensions;
}

function assertSaneBitmap({ width, height }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`bitmap dimensions must be positive integers; received ${width}x${height}`);
  }
  if (width > MAX_BITMAP_DIMENSION || height > MAX_BITMAP_DIMENSION || width * height > MAX_BITMAP_PIXELS) {
    throw new Error(`bitmap dimensions ${width}x${height}px exceed the safe decoding limit`);
  }
}

export function inspectCoverBitmap(path, { frame = COVER_FRAME, minimumDpi = MINIMUM_COVER_DPI } = {}) {
  const bytes = readFileSync(path);
  if (!bytes.length) throw new Error(`COVER_ASSET_EMPTY: generated cover bitmap is empty: ${path}`);
  if (bytes.length > MAX_BITMAP_FILE_BYTES) {
    throw new Error(`COVER_ASSET_INVALID: cover bitmap exceeds the ${MAX_BITMAP_FILE_BYTES / 1024 / 1024} MiB safety limit: ${path}`);
  }
  let dimensions;
  try {
    dimensions = pngDimensions(bytes) ?? jpegDimensions(bytes) ?? webpDimensions(bytes);
    if (dimensions) assertSaneBitmap(dimensions);
  } catch (error) {
    throw new Error(`COVER_ASSET_INVALID: ${error.message}`);
  }
  if (!dimensions || !dimensions.width || !dimensions.height) {
    throw new Error(`COVER_ASSET_INVALID: coverImage must be a readable PNG, JPEG, or WebP bitmap: ${path}`);
  }
  const effectiveDpi = Number(Math.min(dimensions.width / frame.widthIn, dimensions.height / frame.heightIn).toFixed(1));
  const report = { ...dimensions, bytes: bytes.length, sha256: sha256(bytes), frame, effectiveDpi, minimumDpi };
  if (effectiveDpi < minimumDpi) {
    throw new Error(`COVER_ASSET_RESOLUTION_LOW: ${dimensions.width}x${dimensions.height}px yields ${effectiveDpi} effective DPI in the ${frame.widthIn}x${frame.heightIn}in cover-art frame; at least ${minimumDpi} DPI is required.`);
  }
  return report;
}

export function assertCoverAssetNotReused({ coverPath, coverReport, assets, outputDir }) {
  const canonicalCover = realpathSync(coverPath);
  for (const [index, entry] of assets.entries()) {
    const value = typeof entry === "string" ? entry : entry.value;
    const label = typeof entry === "string" ? `interior asset ${index + 1}` : entry.label;
    const candidate = resolveLocalAsset(value, outputDir, label, outputDir);
    if (!candidate || !existsSync(candidate) || !lstatSync(candidate).isFile()) continue;
    const sameFile = realpathSync(candidate) === canonicalCover;
    const sameBitmap = sha256(readFileSync(candidate)) === coverReport.sha256;
    if (sameFile || sameBitmap) {
      throw new Error(`COVER_ASSET_REUSED: ${label} reuses the exact cover bitmap. Generate a distinct manuscript-grounded image for every interior or part-divider use.`);
    }
  }
}
