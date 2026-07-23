import assert from "node:assert/strict";
import { copyFile, mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";

import { assertCoverAssetNotReused, coverFrameForConfig, inspectCoverBitmap, resolveRequiredCoverAsset } from "../scripts/lib/cover-assets.mjs";
import { assertCoverGenerationReceiptFile, assertCoverImageRequestFile, createCoverGenerationReceipt, createCoverImageRequest } from "../scripts/lib/cover-image-request.mjs";
import { coverDecision, pngBytes, writeTestPng } from "./helpers/fixture-assets.mjs";

const temporaryDirectories = [];
after(async () => Promise.all(temporaryDirectories.map((path) => rm(path, { recursive: true, force: true }))));

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "frontend-textbooks-cover-"));
  temporaryDirectories.push(root);
  const outputDir = join(root, "build");
  await mkdir(join(outputDir, "assets"), { recursive: true });
  return { root, outputDir, asset: join(outputDir, "assets", "cover.png") };
}

test("a generated cover request uses the active theme's canonical template", async () => {
  const paths = await fixture();
  const manuscriptHash = "a".repeat(64);
  const request = createCoverImageRequest({
    config: { title: "A Book", author: "Author", style: "colbalt", coverImage: "assets/cover.png", selectedCoverRoute: "photo" },
    plan: {
      manuscriptHash,
      theme: { id: "colbalt" },
      layout: { coverRoute: "photo" },
      visuals: { cover: coverDecision() }
    },
    outputDir: paths.outputDir
  });
  assert.equal(request.schemaVersion, 2);
  assert.equal(request.manuscriptHash, manuscriptHash);
  assert.equal(request.targetAsset, "assets/cover.png");
  assert.match(request.prompt, /child arranging layered paper paths/i);
  assert.match(request.prompt, /no text, no logo/i);
  assert.match(request.prompt, /landscape crop 8\.5in × 7\.45in.*1275 × 1118 pixels/is);
  assert.doesNotMatch(request.prompt, /\[SUBJECT/);
  assert.doesNotMatch(request.prompt, /\[COLOR PALETTE\]/);
  assert.doesNotMatch(request.prompt, /\[COVER ART CONSTRAINTS\]/);
  assert.equal(request.palette.roles.page, "#FBFAF6");
  assert.equal(request.palette.roles.heading, "#0A3695");
  assert.match(request.prompt, /#FBFAF6/);
  assert.match(request.prompt, /#0A3695/);
  assert.match(request.requestHash, /^[a-f0-9]{64}$/);
});

test("a theme awaiting its user-supplied image prompt fails with an actionable error", async () => {
  const paths = await fixture();
  assert.throws(() => createCoverImageRequest({
    config: { title: "A Book", author: "Author", style: "mazius-libre", coverImage: "assets/cover.png", selectedCoverRoute: "photo" },
    plan: {
      manuscriptHash: "d".repeat(64),
      theme: { id: "mazius-libre" },
      layout: { coverRoute: "photo" },
      visuals: { cover: coverDecision() }
    },
    outputDir: paths.outputDir
  }), /Theme mazius-libre has no canonical image-prompt template/u);
});

test("theme overrides replace the illustration palette and invalidate stale artwork requests", async () => {
  const paths = await fixture();
  const plan = {
    manuscriptHash: "b".repeat(64),
    theme: { id: "colbalt" },
    layout: { coverRoute: "photo" },
    visuals: { cover: coverDecision() }
  };
  const baseConfig = {
    title: "A Book",
    author: "Author",
    style: "colbalt",
    coverImage: "assets/cover.png",
    selectedCoverRoute: "photo"
  };
  const base = createCoverImageRequest({ config: baseConfig, plan, outputDir: paths.outputDir });
  const config = {
    ...baseConfig,
    themeOverrides: {
      page: "#F6F0DE",
      ink: "#17251E",
      heading: "#245C3A",
      accent: "#D68A2F",
      soft: "#BFD8C6",
      coverBand: "#183D2A"
    }
  };
  const overridden = createCoverImageRequest({ config, plan, outputDir: paths.outputDir });

  assert.deepEqual(overridden.palette.roles, config.themeOverrides);
  for (const color of Object.values(config.themeOverrides)) assert.match(overridden.prompt, new RegExp(color, "i"));
  assert.doesNotMatch(overridden.prompt, /monochrome cobalt blue|warm white palette|blue ink on paper/i);
  assert.notEqual(overridden.requestHash, base.requestHash);

  const requestPath = join(paths.outputDir, "cover-image-request.json");
  await writeFile(requestPath, JSON.stringify(base));
  assert.throws(
    () => assertCoverImageRequestFile(requestPath, { config, plan, outputDir: paths.outputDir }),
    /COVER_REQUEST_STALE/
  );
});

test("required cover assets reject missing, remote, empty, corrupt, and low-resolution files", async () => {
  const paths = await fixture();
  assert.throws(() => resolveRequiredCoverAsset("", paths.outputDir), /COVER_ASSET_REQUIRED/);
  assert.throws(() => resolveRequiredCoverAsset("https://example.com/cover.png", paths.outputDir), /COVER_ASSET_LOCAL_REQUIRED/);
  assert.throws(() => resolveRequiredCoverAsset("assets/cover.png", paths.outputDir), /COVER_ASSET_MISSING/);
  await writeFile(paths.asset, "");
  assert.throws(() => inspectCoverBitmap(paths.asset), /COVER_ASSET_EMPTY/);
  await writeFile(paths.asset, "not an image");
  assert.throws(() => inspectCoverBitmap(paths.asset), /COVER_ASSET_INVALID/);
  const corruptPng = pngBytes();
  const idat = corruptPng.indexOf(Buffer.from("IDAT"));
  corruptPng[idat + 4] ^= 0xff;
  await writeFile(paths.asset, corruptPng);
  assert.throws(() => inspectCoverBitmap(paths.asset), /COVER_ASSET_INVALID.*checksum/i);
  await writeTestPng(paths.asset, { width: 600, height: 600 });
  assert.throws(() => inspectCoverBitmap(paths.asset), /COVER_ASSET_RESOLUTION_LOW/);
});

test("effective DPI uses the configured cover crop rather than the default frame", async () => {
  const paths = await fixture();
  await writeTestPng(paths.asset, { width: 1275, height: 1150 });
  assert.doesNotThrow(() => inspectCoverBitmap(paths.asset));
  const frame = coverFrameForConfig({ coverBandHeight: 2.8 });
  assert.deepEqual(frame, { widthIn: 8.5, heightIn: 8.2 });
  assert.throws(() => inspectCoverBitmap(paths.asset, { frame }), /COVER_ASSET_RESOLUTION_LOW.*140\.2 effective DPI/i);
});

test("ordinary lossy and lossless WebP containers expose their real dimensions", async () => {
  const paths = await fixture();
  const lossless = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64");
  await writeFile(paths.asset, lossless);
  assert.deepEqual(
    (({ format, width, height }) => ({ format, width, height }))(inspectCoverBitmap(paths.asset, { frame: { widthIn: 0.5, heightIn: 0.5 }, minimumDpi: 1 })),
    { format: "webp", width: 1, height: 1 }
  );

  const lossy = Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEALmk0mk0iIiIiIgBoSygABc6zbAAA", "base64").subarray(0, 42);
  await writeFile(paths.asset, lossy);
  assert.deepEqual(
    (({ format, width, height }) => ({ format, width, height }))(inspectCoverBitmap(paths.asset, { frame: { widthIn: 0.5, heightIn: 0.5 }, minimumDpi: 1 })),
    { format: "webp", width: 1, height: 1 }
  );
});

test("an ordinary JPEG with a real image scan exposes its dimensions", async () => {
  const paths = await fixture();
  const jpeg = Buffer.from("/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAAaADAAQAAAABAAAAAQAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAAQABAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8A+G6KKK/qg/Dz/9k=", "base64");
  await writeFile(paths.asset, jpeg);
  assert.deepEqual(
    (({ format, width, height }) => ({ format, width, height }))(inspectCoverBitmap(paths.asset, { frame: { widthIn: 0.1, heightIn: 0.1 }, minimumDpi: 1 })),
    { format: "jpeg", width: 1, height: 1 }
  );
});

test("a WebP extended header without image frame data is rejected", async () => {
  const paths = await fixture();
  const vp8x = Buffer.alloc(30);
  vp8x.write("RIFF", 0, "ascii");
  vp8x.writeUInt32LE(22, 4);
  vp8x.write("WEBP", 8, "ascii");
  vp8x.write("VP8X", 12, "ascii");
  vp8x.writeUInt32LE(10, 16);
  await writeFile(paths.asset, vp8x);
  assert.throws(
    () => inspectCoverBitmap(paths.asset, { frame: { widthIn: 0.5, heightIn: 0.5 }, minimumDpi: 1 }),
    /COVER_ASSET_INVALID.*no image frame data/i
  );

  const fakeFrame = Buffer.alloc(48);
  fakeFrame.write("RIFF", 0, "ascii");
  fakeFrame.writeUInt32LE(40, 4);
  fakeFrame.write("WEBP", 8, "ascii");
  fakeFrame.write("VP8X", 12, "ascii");
  fakeFrame.writeUInt32LE(10, 16);
  fakeFrame.write("VP8 ", 30, "ascii");
  fakeFrame.writeUInt32LE(10, 34);
  await writeFile(paths.asset, fakeFrame);
  assert.throws(
    () => inspectCoverBitmap(paths.asset, { frame: { widthIn: 0.5, heightIn: 0.5 }, minimumDpi: 1 }),
    /COVER_ASSET_INVALID.*VP8 frame header is invalid/i
  );
});

test("cover diagnostics report measured pixels and effective print DPI", async () => {
  const paths = await fixture();
  await writeTestPng(paths.asset, { width: 1800, height: 1800 });
  const report = inspectCoverBitmap(paths.asset);
  assert.equal(report.format, "png");
  assert.equal(report.width, 1800);
  assert.equal(report.height, 1800);
  assert.match(report.sha256, /^[a-f0-9]{64}$/u);
  assert.equal(report.frame.widthIn, 8.5);
  assert.equal(report.frame.heightIn, 7.45);
  assert.equal(report.minimumDpi, 150);
  assert.ok(report.effectiveDpi >= 150);
});

test("escaping and symlinked cover assets are rejected", async (context) => {
  const paths = await fixture();
  const outside = join(paths.root, "outside.png");
  await writeTestPng(outside);
  assert.throws(() => resolveRequiredCoverAsset("../outside.png", paths.outputDir), /outside outputDir/i);
  try {
    await rm(paths.asset, { force: true });
    await symlink(outside, paths.asset);
  } catch (error) {
    if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) return context.skip("symlinks unavailable");
    throw error;
  }
  assert.throws(() => resolveRequiredCoverAsset("assets/cover.png", paths.outputDir), /symbolic link|outside outputDir/i);
});

test("cover reuse is detected by content hash even under another filename", async () => {
  const paths = await fixture();
  await writeTestPng(paths.asset, { rgb: [18, 74, 129] });
  const duplicate = join(paths.outputDir, "assets", "divider.png");
  await copyFile(paths.asset, duplicate);
  const coverReport = inspectCoverBitmap(paths.asset);
  assert.throws(
    () => assertCoverAssetNotReused({
      coverPath: paths.asset,
      coverReport,
      outputDir: paths.outputDir,
      assets: [{ label: "partImages.Part I", value: "assets/divider.png" }]
    }),
    /COVER_ASSET_REUSED.*exact cover bitmap/i
  );
});

test("a bitmap receipt is bound to the current manuscript request and exact asset", async () => {
  const paths = await fixture();
  await writeTestPng(paths.asset, { rgb: [42, 87, 123] });
  const options = {
    config: { title: "Book A", author: "Author", style: "technical", coverImage: "assets/cover.png" },
    plan: {
      manuscriptHash: "a".repeat(64),
      theme: { id: "technical" },
      layout: { coverRoute: "photo" },
      visuals: { cover: coverDecision() }
    },
    outputDir: paths.outputDir
  };
  const receiptPath = join(paths.outputDir, "cover-generation-receipt.json");
  await writeFile(receiptPath, JSON.stringify(createCoverGenerationReceipt(options)));
  assert.equal(assertCoverGenerationReceiptFile(receiptPath, options).assetHash.length, 64);

  const reusedForAnotherBook = structuredClone(options);
  reusedForAnotherBook.plan.manuscriptHash = "b".repeat(64);
  assert.throws(
    () => assertCoverGenerationReceiptFile(receiptPath, reusedForAnotherBook),
    /COVER_GENERATION_RECEIPT_STALE.*fresh manuscript-grounded artwork/i
  );
});
