export async function collectRenderedReport({ limits, diagnostics, featureSelector }) {
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

    function coverLayoutFor(cover, manifestCover) {
      if (!cover) return { failures: [], metrics: null };
      const failures = [];
      const bounds = cover.getBoundingClientRect();
      const art = cover.querySelector(".cover-art-frame");
      const image = cover.querySelector("img.cover-art");
      const copy = cover.querySelector(".page-inner");
      const title = cover.querySelector("h1");
      const artBounds = art?.getBoundingClientRect();
      const copyBounds = copy?.getBoundingClientRect();
      const titleBounds = title?.getBoundingClientRect();
      const titleStyle = title ? getComputedStyle(title) : null;
      let titleTextBounds = null;
      if (title) {
        const range = document.createRange();
        range.selectNodeContents(title);
        titleTextBounds = range.getBoundingClientRect();
      }
      const tolerance = 2;
      const outside = (inner, outer) => inner && outer && (
        inner.left < outer.left - tolerance || inner.right > outer.right + tolerance ||
        inner.top < outer.top - tolerance || inner.bottom > outer.bottom + tolerance
      );
      if (copyBounds && outside(copyBounds, bounds)) failures.push({ reason: "Cover typography band escapes the selected cover" });
      const titleClipsHorizontally = title && title.scrollWidth > title.clientWidth + tolerance && ["hidden", "clip"].includes(titleStyle.overflowX);
      const titleClipsVertically = title && title.scrollHeight > title.clientHeight + tolerance && ["hidden", "clip"].includes(titleStyle.overflowY);
      if (title && (titleClipsHorizontally || titleClipsVertically || outside(titleBounds, copyBounds) || outside(titleTextBounds, copyBounds))) {
        failures.push({
          reason: "Cover title is clipped or overflows its typography band",
          title: normalizeText(title.textContent).slice(0, 160),
          clipped: { horizontal: Boolean(titleClipsHorizontally), vertical: Boolean(titleClipsVertically) }
        });
      }
      if (title && !cover.classList.contains("has-unbreakable-title")) {
        if (titleStyle.overflowWrap === "anywhere" || ["break-all", "break-word"].includes(titleStyle.wordBreak)) {
          failures.push({ reason: "Ordinary cover title allows mid-word breaking" });
        }
      }
      if (artBounds && copyBounds && intersects(artBounds, copyBounds) && Math.min(artBounds.bottom, copyBounds.bottom) - Math.max(artBounds.top, copyBounds.top) > tolerance) {
        failures.push({ reason: "Cover artwork collides with the typography band" });
      }
      const decoration = cover.querySelector(".route-symbol-mark, .route-minimal-mark, .route-press-series");
      if (decoration && titleBounds && intersects(decoration.getBoundingClientRect(), titleBounds)) {
        failures.push({ reason: "Cover route decoration collides with the title" });
      }
      const expectedFocal = manifestCover?.focalPoint;
      const imageStyle = image ? getComputedStyle(image) : null;
      const objectPosition = imageStyle?.objectPosition || "";
      if (expectedFocal && !objectPosition.includes(`${expectedFocal.x}%`) || expectedFocal && !objectPosition.includes(`${expectedFocal.y}%`)) {
        failures.push({ reason: "Rendered cover crop does not use the planned focal point", expected: expectedFocal, actual: objectPosition });
      }
      return {
        failures,
        metrics: {
          route: cover.dataset.coverRoute || "",
          viewportWidth: window.innerWidth,
          cover: { width: Math.round(bounds.width), height: Math.round(bounds.height) },
          artwork: artBounds ? { width: Math.round(artBounds.width), height: Math.round(artBounds.height) } : null,
          title: titleBounds ? {
            width: Math.round(titleBounds.width),
            height: Math.round(titleBounds.height),
            textWidth: Math.round(titleTextBounds?.width ?? 0),
            textHeight: Math.round(titleTextBounds?.height ?? 0),
            clientWidth: title.clientWidth,
            clientHeight: title.clientHeight,
            scrollWidth: title.scrollWidth,
            scrollHeight: title.scrollHeight,
            overflowX: titleStyle.overflowX,
            overflowY: titleStyle.overflowY,
            overflowWrap: titleStyle.overflowWrap,
            wordBreak: titleStyle.wordBreak
          } : null,
          objectPosition
        }
      };
    }

    function controlOcclusionsFor() {
      const controls = [...document.querySelectorAll(".book-controls")];
      const failures = [];
      for (const control of controls) {
        const style = getComputedStyle(control);
        const bounds = control.getBoundingClientRect();
        const visible = style.display !== "none" && style.visibility !== "hidden" && bounds.width > 0 && bounds.height > 0;
        if (matchMedia("print").matches && visible) {
          failures.push({ reason: "Browser controls remain visible in print" });
          continue;
        }
        if (!visible) continue;
        if (diagnostics.expectedMobile && ["fixed", "sticky"].includes(style.position)) {
          failures.push({ reason: "Mobile browser controls retain an overlay position", position: style.position });
        }
        const content = [...document.querySelectorAll(".text-page [data-source-block-id], .text-page p, .text-page li")];
        const overlap = content.find((node) => {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && intersects(bounds, rect);
        });
        if (overlap) failures.push({ reason: "Browser controls overlap manuscript text", sourceBlockId: overlap.dataset.sourceBlockId || "" });
      }
      return failures;
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

    function comparisonTokens(value) {
      return String(value || "")
        .normalize("NFKC")
        .toLocaleLowerCase()
        .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    }

    function sourceTextForNode(node) {
      if (!node) return "";
      const extras = [...node.querySelectorAll("img[alt]")].map((image) => image.getAttribute("alt") || "");
      return normalizeText([node.innerText || node.textContent || "", ...extras].join(" "));
    }

    function orderedCoveredTokenCount(expected, actual) {
      const expectedTokens = comparisonTokens(expected);
      const actualTokens = comparisonTokens(actual);
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

    async function sha256Bytes(bytes) {
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    const assetHashCache = new Map();
    async function localAssetHash(url) {
      const normalized = normalizeAssetUrl(url);
      if (!normalized || new URL(normalized, document.baseURI).origin !== location.origin) return null;
      if (!assetHashCache.has(normalized)) {
        assetHashCache.set(normalized, (async () => {
          const response = await fetch(normalized, { cache: "no-store" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return sha256Bytes(await response.arrayBuffer());
        })());
      }
      return assetHashCache.get(normalized);
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
      let declaredBlocks = 0;
      let coveredBlocks = 0;
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
        declaredBlocks += 1;
        const matching = nodesBySourceId.get(id) || [];
        if (!matching.length) missingBlocks.push(id);
        const actual = matching.map(sourceTextForNode).join(" ");
        const expectedTokens = Math.max(1, wordCountText(expected));
        const tokenRatio = Math.min(1, orderedCoveredTokenCount(expected, actual) / expectedTokens);
        const blockCovered = Math.min(words, Math.round(words * tokenRatio));
        coveredWords += blockCovered;
        if (tokenRatio === 1) coveredBlocks += 1;
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
        totalBlocks: declaredBlocks,
        coveredBlocks,
        blockRatio: declaredBlocks > 0 ? Number((coveredBlocks / declaredBlocks).toFixed(4)) : 0,
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
              body: pageLabel(nextTextPage, pageIndexes.get(nextTextPage) ?? -1),
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
          page: pageLabel(page, pageIndexes.get(page) ?? -1),
          className: page.className
        }));
    }

    function shortTwoColumnPagesFor(pages) {
      return pages
        .filter((page) => page.classList.contains("text-page") &&
          page.classList.contains("text-two") &&
          !page.classList.contains("text-short-single") &&
          !page.classList.contains("text-tail") &&
          !page.classList.contains("text-stack"))
        .map((page) => {
          const frame = page.querySelector(".text-frame");
          return {
            page: pageLabel(page, pageIndexes.get(page) ?? -1),
            chars: frameText(frame).length,
            className: page.className,
            hasRichContent: hasRichFrameContent(frame),
            occupiedRatio: Number(page.dataset.occupiedRatio || 0)
          };
        })
        .filter((item) => item.chars > 0 && item.chars <= shortSingleCharLimit && item.occupiedRatio < 0.82 && !item.hasRichContent);
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
            page: pageLabel(page, pageIndexes.get(page) ?? -1),
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
          (node.querySelectorAll(".diagram-node").length >= 2 && Boolean(node.querySelector(".diagram-relationships, [data-diagram-grammar]"))) ||
          Boolean(node.querySelector("svg, canvas"));
        return structuredCard && (diagramTerms.test(descriptor) || Boolean(node.querySelector("svg, canvas")));
      });
      return unique.map((node) => {
        const page = node.closest(".page");
        const layout = node.querySelector(".diagram-flow");
        const diagramNodes = [...node.querySelectorAll(".diagram-node")];
        const bounds = node.getBoundingClientRect();
        const nodeBounds = diagramNodes.map((item) => item.getBoundingClientRect());
        const overlappingNodes = nodeBounds.some((left, leftIndex) => nodeBounds.some((right, rightIndex) => rightIndex > leftIndex && intersects(left, right)));
        const nodesOutside = nodeBounds.some((rect) => rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1);
        return {
          page: pageLabel(page, pageIndexes.get(page) ?? -1),
          className: node.className || node.tagName.toLowerCase(),
          label: normalizeText(node.getAttribute("aria-label") || node.querySelector("figcaption")?.textContent || node.querySelector("title")?.textContent || pageLabel(page, pageIndexes.get(page) ?? -1)).slice(0, 160),
          grammar: node.dataset.diagramGrammar || "",
          sourceBlockIds: String(node.dataset.groundingSourceBlockIds || "").split(",").filter(Boolean),
          nodeCount: diagramNodes.length,
          nodeLabels: diagramNodes.map((item) => normalizeText(item.textContent).slice(0, 160)),
          columns: layout ? gridTrackCount(getComputedStyle(layout).gridTemplateColumns) : 0,
          overflow: node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1 || nodesOutside,
          overlappingNodes
        };
      });
    }

    function inspectionPagesFor(pages) {
      const pageNumber = (node) => {
        const page = node?.closest?.(".page") ?? node;
        const index = pageIndexes.get(page) ?? -1;
        return index >= 0 ? index + 1 : null;
      };
      const featurePages = [...new Set([...document.querySelectorAll(featureSelector)].map(pageNumber).filter(Boolean))];
      const chapterFinalPages = [...document.querySelectorAll(".chapter-mount")]
        .map((mount) => {
          const textPages = [...mount.querySelectorAll(".text-page")];
          const page = textPages.at(-1);
          return page ? {
            chapterId: mount.dataset.chapterId || page.id || "chapter",
            page: pageNumber(page)
          } : null;
        })
        .filter(Boolean);
      return {
        cover: pageNumber(document.querySelector(".page.cover, .cover")) ?? 1,
        toc: pageNumber(document.querySelector(".toc-page-section, #contents")),
        firstBody: pageNumber(document.querySelector(".text-page")),
        featurePages,
        chapterFinalPages,
        finalPage: pages.length || null
      };
    }

    function sourceBlockPagesFor(pages) {
      const pagesByNode = new Map(pages.map((page, index) => [page, index + 1]));
      const ids = Array.isArray(embeddedBookData().sourceManifest?.blocks)
        ? embeddedBookData().sourceManifest.blocks.map((block) => String(block.id || "")).filter(Boolean)
        : [];
      const placements = new Map();
      for (const node of document.querySelectorAll("[data-source-block-id]")) {
        const id = node.dataset.sourceBlockId;
        const page = pagesByNode.get(node.closest(".page"));
        if (!id || !page) continue;
        const values = placements.get(id) ?? new Set();
        values.add(page);
        placements.set(id, values);
      }
      return ids.map((id) => ({ id, pages: [...(placements.get(id) ?? [])].sort((a, b) => a - b) }));
    }

    function chapterSemanticsFor() {
      return [...document.querySelectorAll(".chapter-mount")].map((mount) => {
        const page = mount.querySelector(".text-page");
        const kicker = page?.querySelector(".chapter-kicker");
        const part = kicker?.querySelector("span");
        return {
          chapterId: mount.dataset.chapterId || "",
          kicker: normalizeText(kicker?.childNodes?.[0]?.textContent || kicker?.textContent || ""),
          partLabel: normalizeText(part?.textContent || ""),
          heading: normalizeText(page?.querySelector(".text-page-title")?.textContent || ""),
          ariaLabel: page?.getAttribute("aria-label") || ""
        };
      });
    }

    const pages = [...document.querySelectorAll(".page")];
    const pageIndexes = new Map(pages.map((page, index) => [page, index]));
    const frames = [...document.querySelectorAll(".text-frame")];
    const overflowFrames = frames
      .filter((frame) => frame.scrollHeight > frame.clientHeight + 1 || frame.scrollWidth > frame.clientWidth + 1)
      .map((frame) => {
        const page = frame.closest(".page");
        const pageIndex = pageIndexes.get(page) ?? -1;
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
      page: pageLabel(node.closest(".page"), pageIndexes.get(node.closest(".page")) ?? -1)
    }));
    const cover = document.querySelector(".page.cover, .cover");
    const coverAssetUrls = new Set(assetUrlsFor(cover));
    const manifestCover = diagnostics.manifestCover;
    const coverContractFailures = [];
    let renderedCoverAssetHash = null;
    if (manifestCover) {
      const expectedCoverAsset = normalizeAssetUrl(manifestCover.asset);
      const coverImage = cover?.querySelector("img.cover-art");
      const coverBounds = cover?.getBoundingClientRect();
      const artBounds = coverImage?.getBoundingClientRect();
      if (!cover) coverContractFailures.push({ reason: "Final selected cover is missing" });
      if (!coverImage) coverContractFailures.push({ reason: "Final selected cover has no bitmap artwork" });
      if (expectedCoverAsset && !coverAssetUrls.has(expectedCoverAsset)) {
        coverContractFailures.push({ reason: "Final selected cover does not display manifest cover.asset", expectedCoverAsset, actualAssets: [...coverAssetUrls] });
      }
      if (cover?.dataset.coverRoute !== manifestCover.route) {
        coverContractFailures.push({ reason: "Final selected cover route does not match the build manifest", expected: manifestCover.route, actual: cover?.dataset.coverRoute || "" });
      }
      if (cover?.dataset.coverRequestHash !== manifestCover.requestHash) {
        coverContractFailures.push({ reason: "Final selected cover request hash does not match the reviewed manifest asset" });
      }
      if (coverImage && (coverImage.naturalWidth !== manifestCover.width || coverImage.naturalHeight !== manifestCover.height)) {
        coverContractFailures.push({ reason: "Rendered cover pixel dimensions do not match the build manifest", expected: `${manifestCover.width}x${manifestCover.height}`, actual: `${coverImage.naturalWidth}x${coverImage.naturalHeight}` });
      }
      if (coverImage && manifestCover.sha256) {
        try {
          renderedCoverAssetHash = await localAssetHash(coverImage.currentSrc || coverImage.getAttribute("src"));
          if (renderedCoverAssetHash !== manifestCover.sha256) {
            coverContractFailures.push({ reason: "Rendered cover bytes do not match the build manifest hash", expected: manifestCover.sha256, actual: renderedCoverAssetHash });
          }
        } catch (error) {
          coverContractFailures.push({ reason: "Rendered cover bytes could not be hashed", error: error.message });
        }
      }
      if (coverBounds && artBounds && (artBounds.width < coverBounds.width * 0.85 || artBounds.height < coverBounds.height * 0.4)) {
        coverContractFailures.push({ reason: "Required cover artwork is reduced to an incidental sliver", coverWidth: coverBounds.width, coverHeight: coverBounds.height, artWidth: artBounds.width, artHeight: artBounds.height });
      }
    }
    const coverLayout = coverLayoutFor(cover, manifestCover);
    const controlOcclusions = controlOcclusionsFor();
    const coverAssetReuses = [];
    const interiorAssets = [];
    pages.forEach((page, index) => {
      if (page.classList.contains("cover") || page.classList.contains("option-cover")) return;
      for (const asset of assetUrlsFor(page)) {
        if (coverAssetUrls.has(asset)) {
          coverAssetReuses.push({ page: pageLabel(page, index), asset });
        } else {
          interiorAssets.push({ page: pageLabel(page, index), asset });
        }
      }
    });
    if (manifestCover?.sha256) {
      for (const entry of interiorAssets) {
        try {
          const hash = await localAssetHash(entry.asset);
          if (hash && hash === manifestCover.sha256) coverAssetReuses.push({ ...entry, hash });
        } catch {
          // Asset loading diagnostics report unreadable local files separately.
        }
      }
    }
    const partDividers = [...document.querySelectorAll(".part-divider")];
    const textOnlyPartDividers = [];
    const duplicatePartDividerAssets = [];
    const partAssetOwners = new Map();
    const requirePartImages = requiresPartDividerImages(coverAssetUrls);
    partDividers.forEach((part, index) => {
      const assets = assetUrlsFor(part);
      if (requirePartImages && !assets.length) textOnlyPartDividers.push(pageLabel(part, pageIndexes.get(part) ?? -1));
      for (const asset of assets) {
        const owner = partAssetOwners.get(asset);
        const label = pageLabel(part, pageIndexes.get(part) ?? -1);
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
    const inspectionPages = inspectionPagesFor(pages);
    const sourceBlockPages = sourceBlockPagesFor(pages);
    const chapterSemantics = chapterSemanticsFor();
    const tailLayouts = [];
    const textPageMetrics = [];
    pages.forEach((page, index) => {
      if (!page.classList.contains("text-page")) return;
      const metrics = {
        page: pageLabel(page, index),
        className: page.className,
        occupiedRatio: Number(page.dataset.occupiedRatio || 0),
        blocks: Number(page.dataset.tailBlocks || page.querySelector(".text-frame")?.children.length || 0),
        rebalancedBlocks: Number(page.dataset.rebalancedBlocks || 0)
      };
      textPageMetrics.push(metrics);
      if (page.classList.contains("text-tail") || page.classList.contains("text-stack")) {
        tailLayouts.push({
          ...metrics,
          layout: page.classList.contains("text-tail") ? "text-tail" : "text-stack",
          ordinal: tailLayouts.length + 1
        });
      }
    });
    const requireDiagrams = requiresDiagrams();
    const preflightOverflows = Array.isArray(window.__BOOK_PREFLIGHT_OVERFLOWS) ? window.__BOOK_PREFLIGHT_OVERFLOWS : [];
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
      diagnostics: Object.fromEntries(Object.entries(diagnostics).filter(([key]) => !["manifestSource", "manifestCover"].includes(key))),
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
      coverContractFailures,
      renderedCoverAssetHash,
      coverLayoutFailures: coverLayout.failures,
      coverLayout: coverLayout.metrics,
      controlOcclusions,
      textOnlyPartDividers,
      duplicatePartDividerAssets,
      requirePartImages,
      requireDiagrams,
      preflightOverflows,
      diagramElements,
      diagramCount: diagramElements.length,
      inspectionPages,
      sourceBlockPages,
      chapterSemantics,
      tailLayouts,
      textPageMetrics,
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
      customPages: [...document.querySelectorAll(featureSelector)].map((node) => node.id || node.getAttribute("aria-label") || "custom-feature")
    };
}
