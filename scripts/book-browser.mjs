#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { installPageGuards, loadBook, withServer } from "./lib/browser-runtime.mjs";
import { createStaticAssetContext } from "./lib/static-assets.mjs";
import { validatePdfStructure } from "./lib/pdf-structure.mjs";
import { VERIFICATION_PROFILES, verificationProfile } from "./lib/verification-profiles.mjs";
import { cleanVerificationOutput, createContactSheet, screenshotEveryPage, screenshotIfPresent, screenshotSourcePages, writeVerificationArtifacts } from "./lib/verification-artifacts.mjs";
import { GUARD_CHECKS, REPORT_CHECKS } from "./lib/verification-checks.mjs";
import { acquirePipelineLock } from "./lib/pipeline-lock.mjs";

const SHORT_SINGLE_CHAR_LIMIT = 1300;
const LONG_FLOW_WORD_LIMIT = 1400;
const NARROW_FLOW_WORD_LIMIT = 250;
const NARROW_FLOW_MEASURE_IN = 3.75;
function usage() {
  console.error(`Usage:
  node book-browser.mjs export --html <index.html> --pdf <output.pdf> [--wait networkidle|ready]
  node book-browser.mjs verify --html <index.html> --output-dir <dir> [--wait networkidle|ready]
  node book-browser.mjs finalize --html <index.html> --pdf <output.pdf> --output-dir <dir> [--format summary|json]`);
  process.exit(1);
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  if (!mode || !["export", "verify", "finalize"].includes(mode)) usage();
  const args = { mode, wait: "ready", format: "summary", profile: "full" };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) usage();
    const key = token.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) usage();
    args[key] = value;
    index += 1;
  }
  if (!args.html) usage();
  if (["export", "finalize"].includes(mode) && !args.pdf) usage();
  if (["verify", "finalize"].includes(mode) && !args["output-dir"]) usage();
  if (!["ready", "networkidle"].includes(args.wait)) usage();
  if (!["summary", "json"].includes(args.format)) usage();
  if (!Object.hasOwn(VERIFICATION_PROFILES, args.profile)) usage();
  if (mode === "finalize" && args.profile !== "full") usage();
  return args;
}

function htmlContext(htmlPath) {
  const context = createStaticAssetContext(htmlPath);
  return { ...context, htmlPath: context.entryReal };
}

async function renderedReport(page, diagnostics = {}) {
  return await page.evaluate(async ({ limits, diagnostics }) => {
    const {
      shortSingleCharLimit,
      longFlowWordLimit,
      narrowFlowWordLimit,
      narrowFlowMeasureIn
    } = limits;
    const bookDataNode = document.getElementById("book-data");
    let parsedBookData = {};
    let bookDataError = null;
    if (bookDataNode) {
      try {
        parsedBookData = JSON.parse(bookDataNode.textContent || "{}");
      } catch (error) {
        bookDataError = `Invalid #book-data JSON: ${error.message}`;
      }
    }

    function intersects(a, b) {
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }

    function tailFurnitureOverlaps(tail) {
      const page = tail.closest(".text-page");
      const frame = page?.querySelector(".text-frame");
      if (!frame) return false;
      const tailRect = tail.getBoundingClientRect();
      return [...frame.children].some((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && intersects(rect, tailRect);
      });
    }

    function normalizeAssetUrl(value) {
      const text = String(value || "").trim();
      if (!text || text === "none") return "";
      try {
        return new URL(text, document.baseURI).href;
      } catch {
        return text;
      }
    }

    function cssUrls(value) {
      const urls = [];
      const pattern = /url\(\s*(['"]?)(.*?)\1\s*\)/g;
      let match;
      while ((match = pattern.exec(String(value || "")))) {
        const url = normalizeAssetUrl(match[2]);
        if (url) urls.push(url);
      }
      return urls;
    }

    function assetUrlsFor(root) {
      if (!root) return [];
      const urls = [];
      const nodes = [root, ...root.querySelectorAll("*")];
      for (const node of nodes) {
        if (node instanceof HTMLImageElement) {
          const url = normalizeAssetUrl(node.currentSrc || node.getAttribute("src"));
          if (url) urls.push(url);
        }
        urls.push(...cssUrls(getComputedStyle(node).backgroundImage));
      }
      return [...new Set(urls)];
    }

    function pageLabel(page, index) {
      if (!page) return "unknown page";
      return page.id || page.getAttribute("aria-label") || `page ${index + 1}`;
    }

    function explicitBoolean(value) {
      if (value === true || value === "true") return true;
      if (value === false || value === "false") return false;
      return null;
    }

    function embeddedBookData() {
      return parsedBookData;
    }

    function requiresPartDividerImages(coverAssetUrls) {
      const policyNode = document.querySelector("[data-require-part-images]");
      const attrPolicy = explicitBoolean(policyNode?.dataset.requirePartImages);
      if (attrPolicy !== null) return attrPolicy;

      const dataPolicy = explicitBoolean(embeddedBookData().requirePartImages);
      if (dataPolicy !== null) return dataPolicy;

      return coverAssetUrls.size > 0;
    }

    function requiresDiagrams() {
      const policyNode = document.querySelector("[data-require-diagrams]");
      const attrPolicy = explicitBoolean(policyNode?.dataset.requireDiagrams);
      if (attrPolicy !== null) return attrPolicy;

      const dataPolicy = explicitBoolean(embeddedBookData().requireDiagrams);
      if (dataPolicy !== null) return dataPolicy;

      return false;
    }

    function normalizeText(value) {
      return String(value || "")
        .replace(/\s+/g, " ")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .trim();
    }

    function wordCountText(value) {
      const text = normalizeText(value);
      return text ? text.split(/\s+/).length : 0;
    }

    function sourceTextForNode(node) {
      if (!node) return "";
      const extras = [...node.querySelectorAll("img[alt]")].map((image) => image.getAttribute("alt") || "");
      return normalizeText([node.innerText || node.textContent || "", ...extras].join(" "));
    }

    function orderedCoveredTokenCount(expected, actual) {
      const expectedTokens = normalizeText(expected).toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const actualTokens = normalizeText(actual).toLocaleLowerCase().split(/\s+/).filter(Boolean);
      let actualIndex = 0;
      let covered = 0;
      for (const token of expectedTokens) {
        while (actualIndex < actualTokens.length && actualTokens[actualIndex] !== token) actualIndex += 1;
        if (actualIndex >= actualTokens.length) break;
        covered += 1;
        actualIndex += 1;
      }
      return covered;
    }

    async function sha256Text(value) {
      const bytes = new TextEncoder().encode(value);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    async function sourcePreservationFor() {
      const source = embeddedBookData().sourceManifest;
      const manifestSource = diagnostics.manifestSource;
      const manifestRequiresSource = Number.isFinite(Number(manifestSource?.wordCount));
      if (!source) {
        return manifestRequiresSource
          ? { required: true, ratio: 0, threshold: Number(manifestSource.threshold) || 0.9, errors: ["Build manifest declares source text but #book-data has no sourceManifest"] }
          : { required: false, errors: [] };
      }
      const errors = [];
      const threshold = Number(source.threshold);
      const blocks = Array.isArray(source.blocks) ? source.blocks : [];
      if (!(threshold > 0 && threshold <= 1)) errors.push("sourceManifest.threshold must be greater than 0 and at most 1");
      if (!blocks.length) errors.push("sourceManifest.blocks must contain at least one source block");
      const manifestBlocks = Array.isArray(manifestSource?.blocks) ? manifestSource.blocks : null;
      const manifestBlocksById = new Map((manifestBlocks || []).map((block) => [String(block?.id || ""), block]));
      if (manifestBlocks && manifestBlocksById.size !== manifestBlocks.length) {
        errors.push("Build manifest source.blocks contains duplicate IDs");
      }
      const nodes = [...document.querySelectorAll("[data-source-block-id]")];
      const nodesBySourceId = new Map();
      for (const node of nodes) {
        const id = node.dataset.sourceBlockId;
        if (!id) continue;
        const matching = nodesBySourceId.get(id) || [];
        matching.push(node);
        nodesBySourceId.set(id, matching);
      }
      const missingBlocks = [];
      const partialBlocks = [];
      let declaredWords = 0;
      let coveredWords = 0;
      const embeddedIds = new Set();
      for (const block of blocks) {
        const id = String(block?.id || "").trim();
        const manifestNormalizedText = String(block?.text ?? block?.expectedText ?? "").normalize("NFC").replace(/\s+/gu, " ").trim();
        const expected = normalizeText(manifestNormalizedText);
        const words = Number(block?.words ?? block?.wordCount ?? wordCountText(expected));
        if (!id || !expected || !Number.isFinite(words) || words <= 0) {
          errors.push(`Invalid source manifest block: ${id || "missing id"}`);
          continue;
        }
        if (embeddedIds.has(id)) errors.push(`Duplicate embedded source block ID: ${id}`);
        embeddedIds.add(id);
        const computedWords = wordCountText(expected);
        if (words !== computedWords) {
          errors.push(`Source block ${id} wordCount (${words}) does not match its text (${computedWords})`);
        }
        const computedHash = await sha256Text(manifestNormalizedText);
        if (block.sha256 && block.sha256 !== computedHash) {
          errors.push(`Source block ${id} sha256 does not match its expected text`);
        }
        if (manifestBlocks) {
          const external = manifestBlocksById.get(id);
          if (!external) {
            errors.push(`Source block ${id} is missing from the build manifest inventory`);
          } else if (external.sha256 !== computedHash || Number(external.wordCount) !== computedWords) {
            errors.push(`Source block ${id} does not match the build manifest inventory`);
          }
        }
        declaredWords += words;
        const matching = nodesBySourceId.get(id) || [];
        if (!matching.length) missingBlocks.push(id);
        const actual = matching.map(sourceTextForNode).join(" ");
        const expectedTokens = Math.max(1, wordCountText(expected));
        const tokenRatio = Math.min(1, orderedCoveredTokenCount(expected, actual) / expectedTokens);
        const blockCovered = Math.min(words, Math.round(words * tokenRatio));
        coveredWords += blockCovered;
        if (tokenRatio < 1) partialBlocks.push({ id, ratio: Number(tokenRatio.toFixed(4)) });
      }
      if (manifestBlocks && manifestBlocks.length !== embeddedIds.size) {
        errors.push(`Embedded source block count (${embeddedIds.size}) does not match the build manifest (${manifestBlocks.length})`);
      }
      const totalWords = Number(source.totalWords);
      if (!Number.isFinite(totalWords) || totalWords <= 0) {
        errors.push("sourceManifest.totalWords must be a positive number");
      } else if (declaredWords !== totalWords) {
        errors.push(`sourceManifest.totalWords (${totalWords}) does not match block words (${declaredWords})`);
      }
      if (manifestRequiresSource && Number(manifestSource.wordCount) !== totalWords) {
        errors.push(`Build manifest source.wordCount (${manifestSource.wordCount}) does not match embedded totalWords (${totalWords})`);
      }
      if (manifestRequiresSource && Number(manifestSource.threshold) !== threshold) {
        errors.push(`Build manifest source.threshold (${manifestSource.threshold}) does not match embedded threshold (${threshold})`);
      }
      if (manifestRequiresSource && manifestSource.sha256 && manifestSource.sha256 !== source.sha256) {
        errors.push("Build manifest source.sha256 does not match the embedded source manifest");
      }
      const denominator = totalWords > 0 ? totalWords : declaredWords;
      const failedBlockIds = [...new Set([...missingBlocks, ...partialBlocks.map((block) => block.id)])].slice(0, 100);
      const blocksById = new Map(blocks.map((block) => [String(block.id), block]));
      return {
        required: true,
        threshold,
        totalWords: denominator,
        coveredWords,
        ratio: denominator > 0 ? Number((coveredWords / denominator).toFixed(4)) : 0,
        failedBlockIds,
        failedBlocks: failedBlockIds.map((id) => ({
          id,
          text: String(blocksById.get(id)?.text ?? blocksById.get(id)?.expectedText ?? "").slice(0, 360)
        })),
        partialBlocks: partialBlocks.slice(0, 100),
        errors
      };
    }

    function isImageOnlyBook() {
      const root = document.querySelector("[data-image-only]");
      const meta = document.querySelector('meta[name="book-image-only"]');
      return explicitBoolean(root?.dataset.imageOnly) === true || explicitBoolean(meta?.content) === true;
    }

    function fixedPageOverflowsFor(pages) {
      return pages.flatMap((page, index) => {
        const reasons = [];
        const pageRect = page.getBoundingClientRect();
        if (matchMedia("print").matches && pageRect.height > 1057) {
          reasons.push(`fixed page is ${Math.round(pageRect.width)} x ${Math.round(pageRect.height)}px, larger than Letter`);
        }
        if (page.scrollHeight > page.clientHeight + 1) reasons.push(`vertical ${page.scrollHeight - page.clientHeight}px`);
        if (page.scrollWidth > page.clientWidth + 1) reasons.push(`horizontal ${page.scrollWidth - page.clientWidth}px`);
        const inner = page.querySelector(":scope > .page-inner");
        if (inner && inner.scrollHeight > inner.clientHeight + 1) reasons.push(`inner vertical ${inner.scrollHeight - inner.clientHeight}px`);
        if (inner && inner.scrollWidth > inner.clientWidth + 1) reasons.push(`inner horizontal ${inner.scrollWidth - inner.clientWidth}px`);
        const clipped = [...page.querySelectorAll("*")].filter((node) => {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (
            rect.left < pageRect.left - 1 || rect.right > pageRect.right + 1 ||
            rect.top < pageRect.top - 1 || rect.bottom > pageRect.bottom + 1
          );
        });
        if (clipped.length) {
          reasons.push(`clipped descendants: ${clipped.slice(0, 3).map((node) => node.id || node.className || node.tagName.toLowerCase()).join(", ")}`);
        }
        return reasons.length ? [{ page: pageLabel(page, index), reasons }] : [];
      });
    }

    function mobileLayoutFor(pages) {
      if (!diagnostics.expectedMobile) return { horizontalOverflows: [], columnFailures: [] };
      const horizontalOverflows = [];
      if (window.innerWidth >= 600) {
        horizontalOverflows.push({ page: "viewport metadata", width: window.innerWidth, viewport: 390 });
      }
      if (document.documentElement.scrollWidth > window.innerWidth + 1) {
        horizontalOverflows.push({ page: "document", width: document.documentElement.scrollWidth, viewport: window.innerWidth });
      }
      pages.forEach((page, index) => {
        const rect = page.getBoundingClientRect();
        if (page.scrollWidth > page.clientWidth + 1 || rect.left < -1 || rect.right > window.innerWidth + 1) {
          horizontalOverflows.push({ page: pageLabel(page, index), width: Math.max(page.scrollWidth, Math.ceil(rect.width)), viewport: window.innerWidth });
        }
      });
      const columnFailures = [...document.querySelectorAll(".text-frame")]
        .map((frame, index) => ({
          frame: frame.closest(".page")?.id || `text frame ${index + 1}`,
          columns: getComputedStyle(frame).columnCount
        }))
        .filter((item) => Number.parseInt(item.columns, 10) > 1);
      return { horizontalOverflows, columnFailures };
    }

    function allowsFlowingProse(node) {
      return Boolean(node?.closest?.("[data-allow-flowing-prose='true'], [data-plain-reader='true']"));
    }

    function measurePxPerIn() {
      const probe = document.createElement("div");
      probe.style.position = "absolute";
      probe.style.left = "-1000px";
      probe.style.top = "0";
      probe.style.width = "1in";
      probe.style.height = "1px";
      document.body.appendChild(probe);
      const width = probe.getBoundingClientRect().width || 96;
      probe.remove();
      return width;
    }

    function chapterFlowSectionsFor() {
      const pxPerIn = measurePxPerIn();
      return [...document.querySelectorAll(".chapter-flow")].map((flow, index) => {
        const rect = flow.getBoundingClientRect();
        const styles = getComputedStyle(flow);
        const paddingX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
        const contentWidthPx = Math.max(0, rect.width - paddingX);
        return {
          section: flow.id || flow.getAttribute("aria-label") || `chapter-flow ${index + 1}`,
          className: flow.className,
          words: wordCountText(flow.innerText || flow.textContent),
          contentWidthIn: Number((contentWidthPx / pxPerIn).toFixed(2)),
          allowFlowingProse: allowsFlowingProse(flow)
        };
      });
    }

    function frameText(frame) {
      return normalizeText(frame?.textContent || "");
    }

    function hasRichFrameContent(frame) {
      return Boolean(frame?.querySelector("figure, table, .diagram-card, .comparison-diagram, .callout, .span-all"));
    }

    function repeatedOpeningExcerptsFor(pages) {
      const repeats = [];
      pages.forEach((page, index) => {
        if (!page.classList.contains("spread-right")) return;
        const nextTextPage = pages.slice(index + 1).find((candidate) => candidate.classList.contains("text-page"));
        if (!nextTextPage) return;
        const nextText = normalizeText(nextTextPage.innerText);
        const paragraphs = [...page.querySelectorAll(".spread-columns p, .opening-excerpt p")]
          .filter((node) => !node.closest("blockquote"))
          .map((node) => normalizeText(node.innerText))
          .filter((text) => text.length >= 120);
        for (const paragraph of paragraphs) {
          if (nextText.includes(paragraph)) {
            repeats.push({
              spread: pageLabel(page, index),
              body: pageLabel(nextTextPage, pages.indexOf(nextTextPage)),
              text: paragraph.slice(0, 160)
            });
          }
        }
      });
      return repeats;
    }

    function isAllowedOpeningPage(page) {
      return page.dataset.allowOpeningSpread === "true" ||
        page.dataset.allowOpeningPage === "true" ||
        page.classList.contains("allow-opening-spread") ||
        page.classList.contains("allow-opening-page");
    }

    function unrequestedOpeningPagesFor(pages) {
      return [...document.querySelectorAll(".editorial-spread, .spread-left, .spread-right, .chapter-opener")]
        .filter((page) => !isAllowedOpeningPage(page))
        .map((page) => ({
          page: pageLabel(page, pages.indexOf(page)),
          className: page.className
        }));
    }

    function shortTwoColumnPagesFor(pages) {
      return pages
        .filter((page) => page.classList.contains("text-page") && page.classList.contains("text-two") && !page.classList.contains("text-short-single"))
        .map((page, index) => {
          const frame = page.querySelector(".text-frame");
          return {
            page: pageLabel(page, index),
            chars: frameText(frame).length,
            className: page.className,
            hasRichContent: hasRichFrameContent(frame)
          };
        })
        .filter((item) => item.chars > 0 && item.chars <= shortSingleCharLimit && !item.hasRichContent);
    }

    function gridTrackCount(trackList) {
      const text = String(trackList || "").trim();
      if (!text || text === "none") return 0;
      return text.split(/\s+/).filter(Boolean).length;
    }

    function isSparseRowLayout(grid) {
      return grid.classList.contains("sparse-item-rows") ||
        grid.classList.contains("sparse-rows") ||
        grid.classList.contains("tool-rows") ||
        grid.classList.contains("canvas-rows");
    }

    function sparseItemColumnGridsFor(pages) {
      return [...document.querySelectorAll(".canvas-grid, .tool-grid, .feature-grid, .feature-columns, .taxonomy-grid")]
        .map((grid) => {
          const items = [...grid.children]
            .filter((child) => child instanceof HTMLElement && normalizeText(child.innerText).length);
          const itemChars = items.map((item) => normalizeText(item.innerText).length);
          const totalChars = itemChars.reduce((sum, chars) => sum + chars, 0);
          const page = grid.closest(".page");
          return {
            page: pageLabel(page, pages.indexOf(page)),
            className: grid.className,
            items: items.length,
            columns: gridTrackCount(getComputedStyle(grid).gridTemplateColumns),
            totalChars,
            averageChars: items.length ? Math.round(totalChars / items.length) : 0,
            isSparseRows: isSparseRowLayout(grid)
          };
        })
        .filter((item) => item.items >= 4 &&
          item.items <= 6 &&
          item.columns >= 4 &&
          item.totalChars > 0 &&
          item.totalChars <= 1400 &&
          item.averageChars <= 260 &&
          !item.isSparseRows);
    }

    function diagramElementsFor(pages) {
      const diagramTerms = /\b(diagram|map|matrix|taxonomy|anatomy|system|process|workflow|framework|canvas|loop|timeline|flow|comparison|decision)\b/i;
      const candidates = [
        ...document.querySelectorAll(".diagram-page, .anatomy-page, .taxonomy-page, .loop-page, .canvas-page, .process-page, .system-map, .matrix, .comparison-diagram, .diagram-card, .generated-diagram, .canvas-grid, .framework-grid, .process-map"),
        ...document.querySelectorAll("figure")
      ];
      const unique = [...new Set(candidates)].filter((node) => {
        if (!(node instanceof HTMLElement)) return false;
        const page = node.closest(".page");
        if (!page || page.classList.contains("cover") || page.classList.contains("part-divider") || page.classList.contains("option-cover")) return false;
        const descriptor = [
          node.className,
          node.getAttribute("aria-label"),
          node.querySelector("figcaption")?.textContent,
          node.querySelector("title")?.textContent
        ].join(" ");
        const structuredCard = !node.classList.contains("diagram-card") ||
          (node.querySelectorAll(".diagram-node").length >= 2 && Boolean(node.querySelector(".diagram-connector"))) ||
          Boolean(node.querySelector("svg, canvas"));
        return structuredCard && (diagramTerms.test(descriptor) || Boolean(node.querySelector("svg, canvas")));
      });
      return unique.map((node) => {
        const page = node.closest(".page");
        return {
          page: pageLabel(page, pages.indexOf(page)),
          className: node.className || node.tagName.toLowerCase(),
          label: normalizeText(node.getAttribute("aria-label") || node.querySelector("figcaption")?.textContent || node.querySelector("title")?.textContent || pageLabel(page, pages.indexOf(page))).slice(0, 160)
        };
      });
    }

    const pages = [...document.querySelectorAll(".page")];
    const frames = [...document.querySelectorAll(".text-frame")];
    const overflowFrames = frames
      .filter((frame) => frame.scrollHeight > frame.clientHeight + 1 || frame.scrollWidth > frame.clientWidth + 1)
      .map((frame) => {
        const page = frame.closest(".page");
        const pageIndex = pages.indexOf(page);
        const sourceNodes = [...frame.querySelectorAll("[data-source-block-id]")].slice(0, 12);
        return {
          page: pageLabel(page, pageIndex),
          sourceBlockIds: [...new Set(sourceNodes.map((node) => node.dataset.sourceBlockId).filter(Boolean))],
          sourceContext: sourceNodes.map((node) => ({ id: node.dataset.sourceBlockId, text: normalizeText(node.innerText).slice(0, 360) })),
          evidencePaths: window.innerWidth < 600
            ? ["mobile-viewport.png"]
            : (pageIndex >= 0 ? [`desktop-page-${String(pageIndex + 1).padStart(4, "0")}.png`] : ["desktop-viewport.png"]),
          scrollHeight: frame.scrollHeight,
          clientHeight: frame.clientHeight,
          scrollWidth: frame.scrollWidth,
          clientWidth: frame.clientWidth
        };
      });
    const tailOverlaps = [...document.querySelectorAll(".text-page .tail-furniture")].filter(tailFurnitureOverlaps);
    const missingTocTargets = [...document.querySelectorAll("[data-toc-page-for]")]
      .map((node) => {
        const target = node.dataset.tocPageFor || "";
        return {
          target,
          text: node.textContent.trim(),
          label: normalizeText(node.closest("li")?.innerText || target)
        };
      })
      .filter((item) => !item.text || !document.getElementById(item.target));
    const continuationMarks = [...document.querySelectorAll(".continuation-mark")].map((node) => ({
      text: node.textContent.trim(),
      page: pageLabel(node.closest(".page"), pages.indexOf(node.closest(".page")))
    }));
    const cover = document.querySelector(".page.cover, .cover");
    const coverAssetUrls = new Set(assetUrlsFor(cover));
    const coverAssetReuses = [];
    pages.forEach((page, index) => {
      if (page.classList.contains("cover") || page.classList.contains("option-cover")) return;
      for (const asset of assetUrlsFor(page)) {
        if (coverAssetUrls.has(asset)) {
          coverAssetReuses.push({ page: pageLabel(page, index), asset });
        }
      }
    });
    const partDividers = [...document.querySelectorAll(".part-divider")];
    const textOnlyPartDividers = [];
    const duplicatePartDividerAssets = [];
    const partAssetOwners = new Map();
    const requirePartImages = requiresPartDividerImages(coverAssetUrls);
    partDividers.forEach((part, index) => {
      const assets = assetUrlsFor(part);
      if (requirePartImages && !assets.length) textOnlyPartDividers.push(pageLabel(part, pages.indexOf(part)));
      for (const asset of assets) {
        const owner = partAssetOwners.get(asset);
        const label = pageLabel(part, pages.indexOf(part));
        if (owner && owner !== label) {
          duplicatePartDividerAssets.push({ asset, first: owner, second: label });
        } else {
          partAssetOwners.set(asset, label);
        }
      }
    });
    const repeatedOpeningExcerpts = repeatedOpeningExcerptsFor(pages);
    const unrequestedOpeningPages = unrequestedOpeningPagesFor(pages);
    const shortTwoColumnPages = shortTwoColumnPagesFor(pages);
    const sparseItemColumnGrids = sparseItemColumnGridsFor(pages);
    const chapterFlowSections = chapterFlowSectionsFor();
    const unallowedChapterFlows = chapterFlowSections.filter((section) => !section.allowFlowingProse);
    const unallowedChapterFlowWords = unallowedChapterFlows.reduce((sum, section) => sum + section.words, 0);
    const missingMeasuredTextPages = !frames.length && unallowedChapterFlowWords >= longFlowWordLimit
      ? [{ sections: unallowedChapterFlows.length, words: unallowedChapterFlowWords }]
      : [];
    const unmeasuredChapterFlows = chapterFlowSections.filter((section) =>
      !section.allowFlowingProse && section.words >= longFlowWordLimit);
    const narrowChapterFlows = chapterFlowSections.filter((section) =>
      !section.allowFlowingProse &&
      section.words >= narrowFlowWordLimit &&
      section.contentWidthIn > 0 &&
      section.contentWidthIn < narrowFlowMeasureIn);
    const diagramElements = diagramElementsFor(pages);
    const requireDiagrams = requiresDiagrams();
    const text = document.body.innerText.replace(/\s+/g, " ").trim();
    const pageText = normalizeText(pages.map((page) => page.innerText || page.textContent).join(" "));
    const imageOnly = isImageOnlyBook();
    const customBookFailures = [];
    if (!pages.length && !chapterFlowSections.some((section) => section.allowFlowingProse)) {
      customBookFailures.push("Book must contain at least one .page or an explicitly allowed flowing-prose section");
    }
    const customText = pages.length ? pageText : normalizeText(document.body.innerText || document.body.textContent);
    if (!bookDataNode && !imageOnly && wordCountText(customText) === 0) {
      customBookFailures.push("Custom books must contain nonzero text unless data-image-only is explicitly true");
    }
    if (imageOnly && !document.querySelector("img, svg, canvas, video, [style*='background']")) {
      customBookFailures.push("Image-only books must contain at least one visual asset");
    }
    const sourcePreservation = await sourcePreservationFor();
    const fixedPageOverflows = fixedPageOverflowsFor(pages);
    const mobileLayout = mobileLayoutFor(pages);
    return {
      ready: bookDataNode ? window.__BOOK_READY === true : true,
      error: window.__BOOK_ERROR || null,
      bookDataError,
      diagnostics: Object.fromEntries(Object.entries(diagnostics).filter(([key]) => key !== "manifestSource")),
      media: matchMedia("print").matches ? "print" : (window.innerWidth < 600 ? "mobile" : "screen"),
      pages: pages.length,
      printSheets: matchMedia("print").matches
        ? Math.max(1, Math.ceil((document.querySelector(".book")?.scrollHeight || document.body.scrollHeight) / (11 * 96) - 0.001))
        : pages.length,
      frames: frames.length,
      overflowFrames,
      fixedPageOverflows,
      mobileHorizontalOverflows: mobileLayout.horizontalOverflows,
      mobileColumnFailures: mobileLayout.columnFailures,
      tailOverlaps: tailOverlaps.length,
      missingTocTargets,
      continuationMarks,
      coverAssetReuses,
      textOnlyPartDividers,
      duplicatePartDividerAssets,
      requirePartImages,
      requireDiagrams,
      diagramElements,
      diagramCount: diagramElements.length,
      repeatedOpeningExcerpts,
      unrequestedOpeningPages,
      shortTwoColumnPages,
      sparseItemColumnGrids,
      chapterFlows: chapterFlowSections.length,
      chapterFlowWords: chapterFlowSections.reduce((sum, section) => sum + section.words, 0),
      missingMeasuredTextPages,
      unmeasuredChapterFlows,
      narrowChapterFlows,
      imageOnly,
      customBookFailures,
      sourcePreservation,
      words: text ? text.split(/\s+/).length : 0,
      customPages: [...document.querySelectorAll(".custom-feature")].map((node) => node.id || node.getAttribute("aria-label") || "custom-feature")
    };
  }, {
    limits: {
      shortSingleCharLimit: SHORT_SINGLE_CHAR_LIMIT,
      longFlowWordLimit: LONG_FLOW_WORD_LIMIT,
      narrowFlowWordLimit: NARROW_FLOW_WORD_LIMIT,
      narrowFlowMeasureIn: NARROW_FLOW_MEASURE_IN
    },
    diagnostics
  });
}

function reportCount(report, field) {
  const value = report[field];
  if (Array.isArray(value)) return value.length;
  return Number(value) || 0;
}

function countFailure(field, message) {
  return {
    failed: (report) => reportCount(report, field) > 0,
    message: (report) => `${reportCount(report, field)} ${message}`
  };
}

const reportFailureRules = [
  {
    failed: (report) => !report.ready,
    message: (report) => `Book did not become ready: ${report.error || "unknown error"}`
  },
  {
    failed: (report) => Boolean(report.bookDataError),
    message: (report) => report.bookDataError
  },
  ...GUARD_CHECKS.map(({ field }) => ({
    failed: (report) => (report.diagnostics?.[field]?.length || 0) > 0,
    message: (report) => report.diagnostics[field][0]
  })),
  {
    failed: (report) => (report.customBookFailures?.length || 0) > 0,
    message: (report) => report.customBookFailures[0]
  },
  {
    failed: (report) => (report.sourcePreservation?.errors?.length || 0) > 0,
    message: (report) => `Invalid source preservation contract: ${report.sourcePreservation.errors[0]}`
  },
  {
    failed: (report) => report.sourcePreservation?.required && report.sourcePreservation.ratio < report.sourcePreservation.threshold,
    message: (report) => `Source preservation coverage ${(report.sourcePreservation.ratio * 100).toFixed(1)}% is below the ${(report.sourcePreservation.threshold * 100).toFixed(1)}% threshold`
  },
  ...REPORT_CHECKS.slice(0, 10).map(({ field, message }) => countFailure(field, message)),
  {
    failed: (report) => report.requireDiagrams && reportCount(report, "diagramElements") === 0,
    message: () => "required diagram policy is enabled, but no diagrams or diagram-like tools were found"
  },
  ...REPORT_CHECKS.slice(10).map(({ field, message }) => countFailure(field, message))
];

function reportFailures(report) {
  return reportFailureRules
    .filter((rule) => rule.failed(report))
    .map((rule) => rule.message(report));
}

async function assertReady(page, diagnostics) {
  const report = await renderedReport(page, diagnostics);
  const failures = reportFailures(report);
  if (failures.length) throw new Error(failures[0]);
  return report;
}

function pdfOutputContext(args, context) {
  const outputPdf = resolve(args.pdf);
  if (extname(outputPdf).toLowerCase() !== ".pdf") throw new Error("PDF output path must use a .pdf extension");
  const protectedPaths = new Set([...context.allowedFiles].map((file) => resolve(context.rootReal, file)));
  if (protectedPaths.has(outputPdf)) throw new Error("PDF output path must not overwrite the HTML entry or a declared book asset");
  mkdirSync(dirname(outputPdf), { recursive: true });
  return { outputPdf, temporaryPdf: join(dirname(outputPdf), `.${basename(outputPdf)}.${randomUUID()}.tmp.pdf`) };
}

async function exportPdfInBrowser(browser, context, url, origin, args, readySession = null) {
  const { outputPdf, temporaryPdf } = pdfOutputContext(args, context);
  const page = readySession?.page ?? await browser.newPage({ viewport: { width: 1200, height: 1600 }, deviceScaleFactor: 1 });
  try {
    const diagnostics = readySession?.diagnostics ?? await installPageGuards(page, context, origin);
    let readiness = readySession?.report;
    if (!readySession) {
      await loadBook(page, url, args.wait, diagnostics);
      diagnostics.manifestSource = context.manifest?.source ?? null;
      await page.emulateMedia({ media: "print" });
      readiness = await assertReady(page, diagnostics);
    }
    const sourceManifest = await page.evaluate(() => {
      const node = document.getElementById("book-data");
      if (!node) return null;
      try {
        return JSON.parse(node.textContent || "{}").sourceManifest || null;
      } catch {
        return null;
      }
    });
    await page.pdf({
      path: temporaryPdf,
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      displayHeaderFooter: false
    });
    await assertReady(page, diagnostics);
    const pdf = validatePdfStructure(temporaryPdf, readiness.printSheets, {
      requireText: readiness.words > 0 && !readiness.imageOnly,
      sourceManifest
    });
    renameSync(temporaryPdf, outputPdf);
    return { outputPdf, bytes: statSync(outputPdf).size, readiness, pdf };
  } finally {
    rmSync(temporaryPdf, { force: true });
    await page.close();
  }
}

async function exportPdf(args) {
  const context = htmlContext(args.html);
  return await withServer(context, async (url, origin) => {
    const browser = await chromium.launch();
    try {
      return await exportPdfInBrowser(browser, context, url, origin, args);
    } finally {
      await browser.close();
    }
  });
}

async function inspectViewport(browser, context, url, origin, {
  name,
  viewport,
  outputDir,
  waitMode,
  media = "screen",
  captureAllPages = true,
  sourceIds = [],
  retain = false
}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 600 });
  let keepPage = false;
  try {
    await page.emulateMedia({ media });
    const diagnostics = await installPageGuards(page, context, origin);
    await loadBook(page, url, waitMode, diagnostics);
    diagnostics.manifestSource = context.manifest?.source ?? null;
    diagnostics.expectedMobile = viewport.width < 600;
    if (media === "screen") {
      await page.screenshot({ path: join(outputDir, `${name}-viewport.png`), fullPage: false });
      if (name === "desktop" && captureAllPages) {
        await screenshotEveryPage(page, outputDir, "desktop");
      } else if (name === "desktop") {
        await screenshotSourcePages(page, outputDir, sourceIds);
      } else {
        await screenshotIfPresent(page, outputDir, `${name}-cover`, ".cover, .page");
        const textPages = page.locator(".text-page");
        const textPageCount = await textPages.count();
        if (textPageCount > 0) {
          await textPages.first().screenshot({ path: join(outputDir, `${name}-text-first.png`), timeout: 10000 });
          await textPages.last().screenshot({ path: join(outputDir, `${name}-text-last.png`), timeout: 10000 });
        }
        const dividerCount = await page.locator(".part-divider").count();
        for (let index = 0; index < dividerCount; index += 1) {
          const divider = page.locator(".part-divider").nth(index);
          if (await divider.isVisible()) {
            await divider.screenshot({ path: join(outputDir, `mobile-part-${String(index + 1).padStart(3, "0")}.png`), timeout: 10000 });
          }
        }
      }
    }

    const featureSelectors = media === "screen" ? await page.evaluate(() => {
      return [...document.querySelectorAll(".custom-feature, .canvas-page, .model-card-page, .anatomy-page, .taxonomy-page, .loop-page")]
        .slice(0, 8)
        .map((node, index) => {
          if (!node.id) node.id = `verified-feature-${index + 1}`;
          return `#${CSS.escape(node.id)}`;
        });
    }) : [];
    for (let index = 0; index < featureSelectors.length; index += 1) {
      await screenshotIfPresent(page, outputDir, `${name}-feature-${String(index + 1).padStart(2, "0")}`, featureSelectors[index]);
    }
    const report = await renderedReport(page, diagnostics);
    if (retain) {
      keepPage = true;
      return { report, page, diagnostics };
    }
    return report;
  } finally {
    if (!keepPage) await page.close();
  }
}

async function verifyInBrowser(browser, context, url, origin, args, { retainPrint = false } = {}) {
  const outputDir = resolve(args["output-dir"]);
  cleanVerificationOutput(outputDir);

  const profile = verificationProfile(args.profile);
  const includePrint = profile.includePrint;
  const sourceIds = String(args["source-ids"] ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  const views = await Promise.all([
    inspectViewport(browser, context, url, origin, {
      name: "desktop",
      viewport: { width: 1200, height: 1600 },
      outputDir,
      waitMode: args.wait,
      captureAllPages: profile.captureAllPages,
      sourceIds
    }),
    inspectViewport(browser, context, url, origin, {
      name: "mobile",
      viewport: { width: 390, height: 844 },
      outputDir,
      waitMode: args.wait
    }),
    ...(includePrint ? [inspectViewport(browser, context, url, origin, {
      name: "print",
      viewport: { width: 1200, height: 1600 },
      outputDir,
      waitMode: args.wait,
      media: "print",
      retain: retainPrint
    })] : [])
  ]);
  const [desktop, mobile, printView] = views;
  const printSession = retainPrint ? printView : null;
  const print = retainPrint ? printView.report : printView ?? null;
  const contactSheet = await createContactSheet(browser, outputDir);
  const result = {
    schemaVersion: 2,
    html: context.htmlPath,
    htmlBytes: statSync(context.htmlPath).size,
    screenshots: outputDir,
    contactSheet: contactSheet.primary,
    contactSheets: contactSheet.sheets,
    contactSheetPages: contactSheet.pageCount,
    desktop,
    print,
    mobile,
    failures: {
      desktop: reportFailures(desktop),
      print: print ? reportFailures(print) : [],
      mobile: reportFailures(mobile)
    }
  };
  if (result.failures.desktop.length || result.failures.print.length || result.failures.mobile.length) result.failed = true;
  const artifacts = writeVerificationArtifacts(outputDir, result);
  result.diagnosticSummary = artifacts.diagnostics.counts;
  writeFileSync(join(outputDir, "render-report.json"), JSON.stringify(result, null, 2));
  if (printSession) Object.defineProperty(result, "printSession", { value: printSession, enumerable: false });
  return result;
}

async function verifyBook(args) {
  const context = htmlContext(args.html);
  return await withServer(context, async (url, origin) => {
    const browser = await chromium.launch();
    try {
      return await verifyInBrowser(browser, context, url, origin, args);
    } finally {
      await browser.close();
    }
  });
}

async function finalizeBook(args) {
  const context = htmlContext(args.html);
  return await withServer(context, async (url, origin) => {
    const browser = await chromium.launch();
    try {
      const verification = await verifyInBrowser(browser, context, url, origin, args, { retainPrint: true });
      if (verification.failed) {
        await verification.printSession?.page.close();
        return { mode: "finalize", failed: true, verification };
      }
      const pdf = await exportPdfInBrowser(browser, context, url, origin, args, verification.printSession);
      writeFileSync(join(resolve(args["output-dir"]), "pdf-report.json"), JSON.stringify(pdf, null, 2));
      return { mode: "finalize", verification, pdf };
    } finally {
      await browser.close();
    }
  });
}

function conciseResult(args, result) {
  const verification = args.mode === "finalize" ? result.verification : (args.mode === "verify" ? result : null);
  const pdf = args.mode === "finalize" ? result.pdf : (args.mode === "export" ? result : null);
  const failed = Boolean(result.failed || verification?.failed);
  return {
    status: failed ? "fail" : "pass",
    mode: args.mode,
    pages: verification?.print?.pages ?? verification?.desktop?.pages ?? pdf?.pdf?.pageCount ?? 0,
    sourceCoverage: verification?.print?.sourcePreservation?.ratio ?? verification?.desktop?.sourcePreservation?.ratio ?? pdf?.readiness?.sourcePreservation?.ratio ?? null,
    errors: verification?.diagnosticSummary?.error ?? (failed ? 1 : 0),
    ...(verification ? { report: join(resolve(args["output-dir"]), "render-report.json") } : {}),
    ...(pdf ? { pdf: pdf.outputPdf } : {})
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const handlers = { export: exportPdf, finalize: finalizeBook, verify: verifyBook };
  const releaseLock = acquirePipelineLock(dirname(resolve(args.html)));
  try {
    const result = await handlers[args.mode](args);
    console.log(args.format === "json" ? JSON.stringify(result, null, 2) : JSON.stringify(conciseResult(args, result)));
    if (result.failed || result.verification?.failed) process.exitCode = 2;
  } finally {
    releaseLock();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    await main();
  } catch (error) {
    console.error(`Book verification failed: ${error.message}`);
    process.exitCode = 2;
  }
}
