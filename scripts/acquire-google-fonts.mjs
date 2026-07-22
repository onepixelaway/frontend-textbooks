#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { acquireGoogleFontBundle, googleFontsRequestExample } from "./lib/google-fonts-acquisition.mjs";

function usage() {
  console.error("Usage:\n  node scripts/acquire-google-fonts.mjs --example\n  node scripts/acquire-google-fonts.mjs --project-root <book-directory> --request <request.json>");
  process.exitCode = 1;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!["--project-root", "--request"].includes(name) || value === undefined || options[name]) return null;
    options[name] = value;
  }
  if (!options["--project-root"] || !options["--request"] || Object.keys(options).length !== 2) return null;
  return { projectRoot: resolve(options["--project-root"]), requestPath: resolve(options["--request"]) };
}

if (process.argv.length === 3 && process.argv[2] === "--example") {
  process.stdout.write(`${JSON.stringify(googleFontsRequestExample(), null, 2)}\n`);
} else {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    usage();
  } else {
    try {
      const request = JSON.parse(await readFile(args.requestPath, "utf8"));
      const result = await acquireGoogleFontBundle({ projectRoot: args.projectRoot, request });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } catch (error) {
      console.error(`Google Fonts acquisition failed: ${error.message}`);
      process.exitCode = 2;
    }
  }
}
