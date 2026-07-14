import { deflateSync } from "node:zlib";
import { writeFile } from "node:fs/promises";

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

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBytes.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return output;
}

export function pngBytes({ width = 1800, height = 1800, rgb = [32, 76, 146] } = {}) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.alloc(1 + width * 3);
  for (let offset = 1; offset < row.length; offset += 3) {
    row[offset] = rgb[0];
    row[offset + 1] = rgb[1];
    row[offset + 2] = rgb[2];
  }
  const raw = Buffer.alloc(row.length * height);
  for (let index = 0; index < height; index += 1) row.copy(raw, index * row.length);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

export async function writeTestPng(path, options) {
  await writeFile(path, pngBytes(options));
  return path;
}

export function coverDecision(overrides = {}) {
  return {
    sourceBlockIds: ["source-fixture-grounding"],
    subject: "A child arranging layered paper paths into one clear writing route",
    rationale: "The layered path turns the manuscript's cognitive-load thesis into a calm editorial metaphor.",
    altText: "A child organizes layered blue paper paths into a single clear route across a warm desk.",
    focalPoint: { x: 50, y: 44 },
    generationId: "fixture-cover-00000001",
    ...overrides
  };
}

export function diagramDecision(sourceBlockIds, overrides = {}) {
  return {
    sourceBlockIds,
    grammar: "sequence",
    title: "A bounded sequence",
    nodes: [
      { id: "notice", label: "Notice the load" },
      { id: "reduce", label: "Reduce one demand" },
      { id: "practice", label: "Practice the next move" }
    ],
    edges: [
      { from: "notice", to: "reduce" },
      { from: "reduce", to: "practice" }
    ],
    caption: "A concise sequence grounded in the source paragraph.",
    takeaway: "Reduce one demand before adding another.",
    rationale: "The source describes an ordered relationship that benefits from a compact visual.",
    ...overrides
  };
}

export function bookPlan({ manuscriptHash, sourceBlockId, theme = "technical", coverRoute = "photo", bodyColumns = "text-single", chapterOpeners = false, aestheticRequired = false, diagrams = [], images = [], classifications } = {}) {
  return {
    version: 2,
    manuscriptHash,
    editorial: { audience: "readers", genre: "manual", purpose: "teach", tone: "clear" },
    theme: { id: theme, rationale: "The theme matches the manuscript's editorial purpose." },
    layout: {
      bodyColumns,
      chapterOpeners,
      coverRoute,
      rationale: "The resolved layout supports the manuscript's reading rhythm."
    },
    visuals: {
      policy: "selective",
      cover: coverDecision(sourceBlockId ? { sourceBlockIds: [sourceBlockId] } : {}),
      diagrams,
      images
    },
    classifications: classifications ?? (sourceBlockId ? [{ sourceBlockId, role: "narrative", treatment: "prose", rationale: "Preserve ordinary source prose." }] : []),
    exceptions: [{ rule: "waive-diagrams", scope: "book", rationale: "The fixture has no relationship that needs another diagram." }],
    aestheticReview: { required: aestheticRequired, criteria: ["clear hierarchy", "balanced page rhythm"] }
  };
}
