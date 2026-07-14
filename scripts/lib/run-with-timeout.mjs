#!/usr/bin/env node
import { spawn } from "node:child_process";

function usage(message) {
  if (message) console.error(message);
  console.error("Usage: node run-with-timeout.mjs --timeout-seconds <seconds> -- <command> [args...]");
  process.exit(2);
}

const separator = process.argv.indexOf("--");
if (separator < 0) usage();
const options = process.argv.slice(2, separator);
const command = process.argv[separator + 1];
const args = process.argv.slice(separator + 2);
if (options.length !== 2 || options[0] !== "--timeout-seconds" || !command) usage();

const timeoutSeconds = Number(options[1]);
if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) usage("Timeout must be a positive number of seconds.");

const child = spawn(command, args, {
  detached: true,
  stdio: "inherit"
});

const exit = new Promise((resolve) => {
  child.once("error", (error) => resolve({ error }));
  child.once("exit", (code, signal) => resolve({ code, signal }));
});
const timeout = new Promise((resolve) => {
  setTimeout(() => resolve({ timedOut: true }), timeoutSeconds * 1000).unref();
});

const result = await Promise.race([exit, timeout]);
if (!result.timedOut) {
  if (result.error) {
    console.error(`Could not start ${command}: ${result.error.message}`);
    process.exit(127);
  }
  if (result.signal) {
    console.error(`${command} terminated by ${result.signal}.`);
    process.exit(1);
  }
  process.exit(result.code ?? 1);
}

console.error(`Command timed out after ${timeoutSeconds} seconds: ${command}`);
try {
  process.kill(-child.pid, "SIGTERM");
} catch {
  child.kill("SIGTERM");
}
await new Promise((resolve) => setTimeout(resolve, 250));
try {
  process.kill(-child.pid, "SIGKILL");
} catch {
  child.kill("SIGKILL");
}
await Promise.race([exit, new Promise((resolve) => setTimeout(resolve, 250))]);
process.exit(124);
