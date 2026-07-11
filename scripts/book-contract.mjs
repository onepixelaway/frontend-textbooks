#!/usr/bin/env node
import { resolve } from "node:path";
import { contractNames, readContractFile } from "./lib/json-contracts.mjs";
import { validateRepairActions } from "./lib/diagnostics.mjs";

const [command, name, filename] = process.argv.slice(2);
if (command === "validate-repairs" && name && filename) {
  try {
    const tasks = readContractFile("repair-tasks", resolve(name));
    const actions = readContractFile("repair-actions", resolve(filename));
    console.log(JSON.stringify(validateRepairActions(tasks, actions)));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
} else if (command === "validate" && name && filename) {
  try {
    readContractFile(name, resolve(filename));
    console.log(JSON.stringify({ ok: true, contract: name, file: resolve(filename) }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
} else {
  console.error(`Usage:\n  node scripts/book-contract.mjs validate <${contractNames().join("|")}> <file.json>\n  node scripts/book-contract.mjs validate-repairs <repair-tasks.json> <repair-actions.json>`);
  process.exit(1);
}
