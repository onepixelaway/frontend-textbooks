import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const execFile = promisify(execFileCallback);

async function text(path) {
  return readFile(new URL(path, root), "utf8");
}

async function runAndCapture(command, args, options = {}) {
  try {
    const result = await execFile(command, args, { maxBuffer: 2 * 1024 * 1024, ...options });
    return { code: 0, ...result };
  } catch (error) {
    return {
      code: typeof error.code === "number" ? error.code : 1,
      signal: error.signal,
      stdout: error.stdout || "",
      stderr: error.stderr || ""
    };
  }
}

async function executable(path, contents = "#!/bin/sh\nexit 0\n") {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
  await chmod(path, 0o755);
}

async function fakePlaywright(directory, { browserPath, label, version = "1.61.1", launchable = false }) {
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "package.json"), JSON.stringify({ name: "playwright", version, type: "module" }));
  const launchBody = launchable
    ? `
      if (process.env.FAKE_LAUNCH_LOG) appendFileSync(process.env.FAKE_LAUNCH_LOG, JSON.stringify(options) + "\\n");
      if (process.env.FAKE_LAUNCH_FAIL_PATH === options.executablePath) throw new Error("synthetic launch failure");
      return { executablePath: options.executablePath };`
    : "return {};";
  await writeFile(join(directory, "index.mjs"), `
    import { appendFileSync } from "node:fs";
    if (process.env.FAKE_PROBE_LOG) appendFileSync(process.env.FAKE_PROBE_LOG, ${JSON.stringify(label)} + "\\n");
    export const chromium = {
      executablePath() {
        if (process.env.FAKE_EXECUTABLE_PATH_THROWS === "1") throw new Error("must not inspect known-missing Chromium");
        return ${JSON.stringify(browserPath)};
      },
      async launch(options) { ${launchBody} }
    };
  `);
}

async function fakeNpm(directory, version) {
  const npmPath = join(directory, "npm");
  await writeFile(npmPath, `#!/usr/bin/env node
    import { appendFileSync, chmodSync, mkdirSync, writeFileSync } from "node:fs";
    import { dirname, join } from "node:path";
    const args = process.argv.slice(2);
    if (process.env.FAKE_NPM_LOG) appendFileSync(process.env.FAKE_NPM_LOG, args.join(" ") + "\\n");
    if (args[0] === "root") {
      process.stdout.write(process.env.FAKE_GLOBAL_NODE_MODULES + "\\n");
      process.exit(0);
    }
    if (process.env.FAKE_NPM_MODE === "fail") {
      console.error("synthetic installer detail");
      process.exit(42);
    }
    if (process.env.FAKE_NPM_MODE === "timeout") {
      console.error("synthetic installer started and is hanging");
      setInterval(() => {}, 1000);
    } else {
      const prefix = args[args.indexOf("--prefix") + 1];
      const packageDirectory = join(prefix, "node_modules", "playwright");
      const defaultBrowsers = join(prefix, "browsers");
      mkdirSync(packageDirectory, { recursive: true });
      writeFileSync(join(packageDirectory, "package.json"), JSON.stringify({ name: "playwright", version: ${JSON.stringify(version)}, type: "module" }));
      writeFileSync(join(packageDirectory, "index.mjs"), \`
        import { join } from "node:path";
        const executable = join(process.env.PLAYWRIGHT_BROWSERS_PATH || \${JSON.stringify(defaultBrowsers)}, "chromium");
        export const chromium = { executablePath: () => executable, launch: async () => ({}) };
      \`);
      writeFileSync(join(packageDirectory, "cli.js"), \`
        import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
        import { join } from "node:path";
        const executable = join(process.env.PLAYWRIGHT_BROWSERS_PATH, "chromium");
        mkdirSync(process.env.PLAYWRIGHT_BROWSERS_PATH, { recursive: true });
        writeFileSync(executable, "#!/bin/sh\\\\nexit 0\\\\n");
        chmodSync(executable, 0o755);
      \`);
    }
  `);
  await chmod(npmPath, 0o755);
  return npmPath;
}

async function temporaryDirectory(prefix) {
  return mkdtemp(join(tmpdir(), prefix));
}

async function withEnvironment(values, callback) {
  const prior = new Map();
  for (const [key, value] of Object.entries(values)) {
    prior.set(key, Object.hasOwn(process.env, key) ? process.env[key] : undefined);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await callback();
  } finally {
    for (const [key, value] of prior) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("browser runner reuses local or persistent dependencies before installing", async () => {
  const runner = await text("scripts/run-book-browser.sh");
  assert.match(runner, /node_modules\/playwright/);
  assert.match(runner, /FRONTEND_TEXTBOOKS_CACHE_DIR/);
  assert.match(runner, /Google Chrome|google-chrome/);
  assert.match(runner, /npm install/);
  assert.match(runner, /tail -n/);
  assert.match(runner, /run-with-timeout\.mjs/);
  assert.doesNotMatch(runner, /npm install[^\n]*\/dev\/null/);
});

test("browser runner accepts the first exact, runnable Playwright candidate", async (context) => {
  const directory = await temporaryDirectory("frontend-textbooks-precedence-");
  context.after(() => rm(directory, { recursive: true, force: true }));
  const version = JSON.parse(await text("package.json")).dependencies.playwright;
  const localBrowser = join(directory, "local-browser");
  const envBrowser = join(directory, "env-browser");
  const localPackage = join(directory, "local-playwright");
  const envPackage = join(directory, "env-playwright");
  const probeLog = join(directory, "probes.log");
  await executable(localBrowser);
  await executable(envBrowser);
  await fakePlaywright(localPackage, { browserPath: localBrowser, label: "local", version });
  await fakePlaywright(envPackage, { browserPath: envBrowser, label: "environment", version });

  const result = await runAndCapture("bash", [join(rootPath, "scripts/run-book-browser.sh"), "contact-sheet", "--input-dir", join(directory, "missing"), "--output", join(directory, "out.png")], {
    cwd: rootPath,
    env: {
      ...process.env,
      FRONTEND_TEXTBOOKS_DISABLE_SYSTEM_CHROME: "1",
      FRONTEND_TEXTBOOKS_LOCAL_PLAYWRIGHT_PACKAGE: localPackage,
      FRONTEND_TEXTBOOKS_PLAYWRIGHT_PACKAGE: envPackage,
      FRONTEND_TEXTBOOKS_CACHE_DIR: join(directory, "cache"),
      FAKE_PROBE_LOG: probeLog
    }
  });

  assert.notEqual(result.code, 0);
  assert.deepEqual((await readFile(probeLog, "utf8")).trim().split("\n"), ["local"]);
});

test("package-only candidates fall through to a bootstrapped persistent browser cache", async (context) => {
  const directory = await temporaryDirectory("frontend-textbooks-cache-fallback-");
  context.after(() => rm(directory, { recursive: true, force: true }));
  const version = JSON.parse(await text("package.json")).dependencies.playwright;
  const localPackage = join(directory, "package-without-browser");
  const cacheRoot = join(directory, "cache");
  const fakeBin = join(directory, "bin");
  const npmLog = join(directory, "npm.log");
  const probeLog = join(directory, "probes.log");
  const globalModules = join(directory, "global-node-modules");
  await mkdir(fakeBin, { recursive: true });
  await mkdir(globalModules, { recursive: true });
  await fakePlaywright(localPackage, { browserPath: join(directory, "missing-browser"), label: "local", version });
  await fakeNpm(fakeBin, version);

  const result = await runAndCapture("bash", [join(rootPath, "scripts/run-book-browser.sh"), "contact-sheet", "--input-dir", join(directory, "missing"), "--output", join(directory, "out.png")], {
    cwd: rootPath,
    env: {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH}`,
      FRONTEND_TEXTBOOKS_DISABLE_SYSTEM_CHROME: "1",
      FRONTEND_TEXTBOOKS_LOCAL_PLAYWRIGHT_PACKAGE: localPackage,
      FRONTEND_TEXTBOOKS_PLAYWRIGHT_PACKAGE: "",
      FRONTEND_TEXTBOOKS_CACHE_DIR: cacheRoot,
      FAKE_GLOBAL_NODE_MODULES: globalModules,
      FAKE_NPM_LOG: npmLog,
      FAKE_PROBE_LOG: probeLog
    }
  });

  assert.notEqual(result.code, 0);
  const cacheDirectory = join(cacheRoot, `playwright-${version}`);
  await access(join(cacheDirectory, "browsers", "chromium"), constants.X_OK).catch(() => {
    assert.fail(`cache bootstrap did not create Chromium:\n${result.stderr}`);
  });
  assert.match(await readFile(npmLog, "utf8"), new RegExp(`playwright@${version.replaceAll(".", "\\.")}`));
  const probes = (await readFile(probeLog, "utf8")).trim().split("\n");
  assert.equal(probes.filter((value) => value === "local").length, 1);
});

test("browser launch ordering uses only executable candidates", async (context) => {
  const directory = await temporaryDirectory("frontend-textbooks-launch-order-");
  context.after(() => rm(directory, { recursive: true, force: true }));
  const packageDirectory = join(directory, "playwright");
  const bundled = join(directory, "bundled-browser");
  const system = join(directory, "system-browser");
  const launchLog = join(directory, "launch.log");
  await executable(bundled);
  await executable(system);
  await fakePlaywright(packageDirectory, { browserPath: bundled, label: "runtime", launchable: true });

  await withEnvironment({
    FRONTEND_TEXTBOOKS_PLAYWRIGHT_PACKAGE: packageDirectory,
    FRONTEND_TEXTBOOKS_PLAYWRIGHT_BUNDLED_EXECUTABLE: bundled,
    FRONTEND_TEXTBOOKS_CHROME_EXECUTABLE: system,
    FRONTEND_TEXTBOOKS_PREFER_SYSTEM_CHROME: "0",
    FAKE_LAUNCH_LOG: launchLog,
    FAKE_LAUNCH_FAIL_PATH: bundled,
    FAKE_EXECUTABLE_PATH_THROWS: "0"
  }, async () => {
    const { launchChromium } = await import(`../scripts/lib/playwright-runtime.mjs?ordering=${Date.now()}`);
    await launchChromium({ headless: true });
  });
  assert.deepEqual((await readFile(launchLog, "utf8")).trim().split("\n").map(JSON.parse).map((item) => item.executablePath), [bundled, system]);

  await writeFile(launchLog, "");
  await withEnvironment({
    FRONTEND_TEXTBOOKS_PLAYWRIGHT_PACKAGE: packageDirectory,
    FRONTEND_TEXTBOOKS_PLAYWRIGHT_BUNDLED_EXECUTABLE: "",
    FRONTEND_TEXTBOOKS_CHROME_EXECUTABLE: system,
    FRONTEND_TEXTBOOKS_PREFER_SYSTEM_CHROME: "0",
    FAKE_LAUNCH_LOG: launchLog,
    FAKE_LAUNCH_FAIL_PATH: "",
    FAKE_EXECUTABLE_PATH_THROWS: "1"
  }, async () => {
    const { launchChromium } = await import(`../scripts/lib/playwright-runtime.mjs?missing=${Date.now()}`);
    await launchChromium();
  });
  const attempts = (await readFile(launchLog, "utf8")).trim().split("\n").map(JSON.parse);
  assert.deepEqual(attempts.map((item) => item.executablePath), [system]);
});

test("timeout helper forwards success and terminates a hung process", async () => {
  const helper = join(rootPath, "scripts/lib/run-with-timeout.mjs");
  const success = await runAndCapture(process.execPath, [helper, "--timeout-seconds", "1", "--", process.execPath, "-e", "console.log('ready')"]);
  assert.equal(success.code, 0);
  assert.equal(success.stdout.trim(), "ready");

  const timedOut = await runAndCapture(process.execPath, [helper, "--timeout-seconds", "0.2", "--", "/bin/sh", "-c", "echo started >&2; sleep 10"]);
  assert.equal(timedOut.code, 124);
  assert.match(timedOut.stderr, /started/);
  assert.match(timedOut.stderr, /timed out after 0\.2 seconds/);
});

test("browser installer reports captured failure and timeout diagnostics", async (context) => {
  const directory = await temporaryDirectory("frontend-textbooks-install-diagnostics-");
  context.after(() => rm(directory, { recursive: true, force: true }));
  const version = JSON.parse(await text("package.json")).dependencies.playwright;
  const fakeBin = join(directory, "bin");
  const globalModules = join(directory, "global-node-modules");
  await mkdir(fakeBin, { recursive: true });
  await mkdir(globalModules, { recursive: true });
  await fakeNpm(fakeBin, version);
  const baseEnvironment = {
    ...process.env,
    PATH: `${fakeBin}:${process.env.PATH}`,
    FRONTEND_TEXTBOOKS_DISABLE_SYSTEM_CHROME: "1",
    FRONTEND_TEXTBOOKS_LOCAL_PLAYWRIGHT_PACKAGE: "",
    FRONTEND_TEXTBOOKS_PLAYWRIGHT_PACKAGE: "",
    FAKE_GLOBAL_NODE_MODULES: globalModules
  };
  const args = [join(rootPath, "scripts/run-book-browser.sh"), "contact-sheet", "--input-dir", join(directory, "missing"), "--output", join(directory, "out.png")];

  const failed = await runAndCapture("bash", args, {
    cwd: rootPath,
    env: { ...baseEnvironment, FRONTEND_TEXTBOOKS_CACHE_DIR: join(directory, "failure-cache"), FAKE_NPM_MODE: "fail" }
  });
  assert.notEqual(failed.code, 0);
  assert.match(failed.stderr, /Persistent Playwright package installation failed/);
  assert.match(failed.stderr, /synthetic installer detail/);

  const startedAt = Date.now();
  const timedOut = await runAndCapture("bash", args, {
    cwd: rootPath,
    timeout: 4000,
    env: {
      ...baseEnvironment,
      FRONTEND_TEXTBOOKS_CACHE_DIR: join(directory, "timeout-cache"),
      FRONTEND_TEXTBOOKS_INSTALL_TIMEOUT_SECONDS: "0.25",
      FAKE_NPM_MODE: "timeout"
    }
  });
  assert.notEqual(timedOut.code, 0);
  assert.ok(Date.now() - startedAt < 3000);
  assert.match(timedOut.stderr, /Persistent Playwright package installation timed out after 0\.25s/);
  assert.match(timedOut.stderr, /synthetic installer started and is hanging/);
  assert.match(timedOut.stderr, /Command timed out after 0\.25 seconds/);
});

test("shell entry points stay executable and invoke the internal runner defensively", async () => {
  const scripts = [
    "scripts/book-browser-shell.sh",
    "scripts/run-book-browser.sh",
    "scripts/export-pdf.sh",
    "scripts/export-ready-pdf.sh",
    "scripts/export-local-chrome.sh",
    "scripts/inspect-pdf.sh",
    "scripts/verify-html-book.sh",
    "scripts/verify-rendered-book.sh"
  ];
  await Promise.all(scripts.map((path) => access(new URL(path, root), constants.X_OK)));
  const helpers = await text("scripts/book-browser-shell.sh");
  assert.match(helpers, /bash\s+"\$BOOK_BROWSER_SCRIPT_DIR\/run-book-browser\.sh"\s+export/);
  assert.match(helpers, /bash\s+"\$BOOK_BROWSER_SCRIPT_DIR\/run-book-browser\.sh"\s+verify/);
});

test("local Chrome fallback routes through the guarded exporter", async () => {
  const fallback = await text("scripts/export-local-chrome.sh");
  assert.match(fallback, /FRONTEND_TEXTBOOKS_PREFER_SYSTEM_CHROME=1/);
  assert.match(fallback, /run_export_wrapper/);
});

test("runtime dependencies are exact and lockfile-backed", async () => {
  const pkg = JSON.parse(await text("package.json"));
  const lock = JSON.parse(await text("package-lock.json"));

  for (const name of ["markdown-it", "playwright"]) {
    assert.match(pkg.dependencies[name], /^\d+\.\d+\.\d+$/);
    assert.equal(lock.packages[`node_modules/${name}`].version, pkg.dependencies[name]);
  }
});

test("skill shell commands resolve through SKILL_DIR", async () => {
  const skill = await text("SKILL.md");
  assert.match(skill, /SKILL_DIR="<absolute path to the directory containing this SKILL\.md>"/);
  assert.doesNotMatch(skill, /(?:node|bash) scripts\//);
});
