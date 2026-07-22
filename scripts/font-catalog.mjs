#!/usr/bin/env node
import { createRegisteredFontCatalog } from "./lib/font-catalog.mjs";

if (process.argv.length !== 2) {
  console.error("Usage: node scripts/font-catalog.mjs");
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify(createRegisteredFontCatalog())}\n`);
}
