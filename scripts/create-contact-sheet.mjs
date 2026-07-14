#!/usr/bin/env node
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { createImageContactSheets } from "./lib/contact-sheet.mjs";
import { launchChromium } from "./lib/playwright-runtime.mjs";

function usage() {
  console.error("Usage: node scripts/create-contact-sheet.mjs --input-dir <rendered-pages> --output <contact-sheet.png>");
  process.exit(1);
}

function argsFor(argv) {
  let args;
  try {
    args = parseArgs({
      args: argv,
      options: { "input-dir": { type: "string" }, output: { type: "string" } },
      strict: true
    }).values;
  } catch {
    usage();
  }
  if (!args["input-dir"] || !args.output) usage();
  return args;
}

function pageNumber(name) {
  return Number(name.match(/(\d+)(?=\.png$)/u)?.[1] ?? 0);
}

const args = argsFor(process.argv.slice(2));
const inputDir = resolve(args["input-dir"]);
const output = resolve(args.output);
const images = readdirSync(inputDir)
  .filter((name) => /^pdf-page-\d+\.png$/u.test(name))
  .sort((left, right) => pageNumber(left) - pageNumber(right));
if (!images.length) throw new Error(`No rendered PDF pages found in ${inputDir}`);

const browser = await launchChromium();
try {
  const result = await createImageContactSheets(browser, {
    inputDir,
    imageNames: images,
    outputPath: output,
    chunkSize: 60
  });
  process.stdout.write(`${JSON.stringify({ pages: result.pageCount, contactSheets: result.sheets })}\n`);
} finally {
  await browser.close();
}
