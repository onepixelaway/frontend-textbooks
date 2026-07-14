import { readdirSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

function escapedPattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function escapedHtml(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

export async function createImageContactSheets(browser, {
  inputDir,
  imageNames,
  outputPath,
  chunkSize = 80
}) {
  const directory = resolve(inputDir);
  const output = resolve(outputPath);
  const outputDirectory = dirname(output);
  const outputStem = basename(output, ".png");
  const ownedOutput = new RegExp(`^${escapedPattern(outputStem)}(?:-\\d+)?\\.png$`, "u");
  for (const name of readdirSync(outputDirectory)) {
    if (ownedOutput.test(name)) rmSync(join(outputDirectory, name), { force: true });
  }

  const chunks = Array.from(
    { length: Math.ceil(imageNames.length / chunkSize) },
    (_, index) => imageNames.slice(index * chunkSize, (index + 1) * chunkSize)
  );
  if (!chunks.length) return { primary: undefined, sheets: [], pageCount: 0 };

  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
  const outputs = [];
  let activeImages = new Map();
  await page.route("http://frontend-textbooks.local/image/**", async (route) => {
    const imagePath = activeImages.get(new URL(route.request().url()).pathname);
    if (!imagePath) {
      await route.abort("failed");
      return;
    }
    await route.fulfill({ path: imagePath, contentType: "image/png" });
  });
  try {
    for (let index = 0; index < chunks.length; index += 1) {
      activeImages = new Map();
      const cards = chunks[index].map((name, imageIndex) => {
        const pathname = `/image/${index}/${imageIndex}`;
        activeImages.set(pathname, join(directory, name));
        return `<figure><img src="http://frontend-textbooks.local${pathname}"><figcaption>${escapedHtml(name)}</figcaption></figure>`;
      }).join("");
      const target = index === 0
        ? output
        : join(outputDirectory, `${outputStem}-${String(index + 1).padStart(3, "0")}.png`);
      await page.setContent(`<!doctype html><style>body{margin:0;padding:24px;background:#232323;color:#fff;font:14px system-ui}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}figure{margin:0;background:#343434;padding:8px;border-radius:6px}img{display:block;width:100%;height:280px;object-fit:contain;background:#ddd}figcaption{padding-top:6px;overflow-wrap:anywhere}</style><main class="grid">${cards}</main>`, { waitUntil: "load" });
      await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
      await page.screenshot({ path: target, fullPage: true });
      outputs.push(target);
    }
    return { primary: outputs[0], sheets: outputs, pageCount: imageNames.length };
  } finally {
    await page.close();
  }
}
