export function bookClientProgram() {
  const bookData = JSON.parse(document.getElementById("book-data").textContent);

  function blockNode(block) {
    const template = document.createElement("template");
    template.innerHTML = block.html;
    let node;
    const significantText = [...template.content.childNodes]
      .filter((child) => child.nodeType === Node.TEXT_NODE)
      .some((child) => child.textContent.trim());
    if (template.content.children.length === 1 && !significantText) {
      node = template.content.firstElementChild;
    } else {
      node = document.createElement("div");
      node.appendChild(template.content);
    }
    node.dataset.sourceBlockId = block.sourceBlockId;
    if (block.plan) {
      node.dataset.semanticRole = block.plan.role;
      node.dataset.plannedTreatment = block.plan.treatment;
      node.classList.add("planned-" + block.plan.treatment);
      if (block.plan.treatment === "callout") node.classList.add("callout");
      if (block.plan.diagramConcepts?.length) node.dataset.diagramConcept = block.plan.diagramConcepts.join(" | ");
      if (block.plan.treatment === "diagram") {
        const figure = document.createElement("figure");
        figure.className = "diagram-card planned-diagram";
        figure.dataset.sourceBlockId = block.sourceBlockId;
        figure.dataset.semanticRole = block.plan.role;
        figure.dataset.plannedTreatment = "diagram";
        const caption = document.createElement("figcaption");
        caption.className = "model-label";
        caption.textContent = block.plan.diagramConcepts?.[0] || ("Structured " + block.plan.role);
        const content = document.createElement("div");
        content.className = "diagram-flow";
        const sourceText = (node.textContent || "").replace(/\s+/g, " ").trim();
        let segments = sourceText.match(/[^.!?]+[.!?]?/g)?.map((value) => value.trim()).filter(Boolean) || [];
        if (segments.length < 2) {
          const words = sourceText.split(/\s+/).filter(Boolean);
          const midpoint = Math.max(1, Math.ceil(words.length / 2));
          segments = [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")].filter(Boolean);
        }
        if (segments.length < 2) segments.push(block.plan.diagramConcepts?.[0] || block.plan.role);
        segments.forEach((segment, index) => {
          const diagramNode = document.createElement("div");
          diagramNode.className = "diagram-node";
          diagramNode.textContent = segment;
          content.appendChild(diagramNode);
          if (index < segments.length - 1) {
            const connector = document.createElement("span");
            connector.className = "diagram-connector";
            connector.setAttribute("aria-hidden", "true");
            connector.textContent = "→";
            content.appendChild(connector);
          }
        });
        figure.append(caption, content);
        return figure;
      }
    }
    return node;
  }

  function appendText(parent, tagName, className, text) {
    const node = document.createElement(tagName);
    if (className) node.className = className;
    node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  function paginationUnits(nodes) {
    const units = [];
    for (let index = 0; index < nodes.length; index += 1) {
      const block = nodes[index];
      if (block.matches("h3, h4") && nodes[index + 1]) {
        const wrapper = document.createElement("div");
        wrapper.className = "keep-with-next";
        wrapper.appendChild(block);
        wrapper.appendChild(nodes[index + 1]);
        units.push(wrapper);
        index += 1;
      } else {
        units.push(block);
      }
    }
    return units;
  }

  function overflows(frame) {
    return frame.scrollHeight > frame.clientHeight + 1 || frame.scrollWidth > frame.clientWidth + 1;
  }

  function hasRichFrameContent(frame) {
    return Boolean(frame?.querySelector("figure, table, .diagram-card, .comparison-diagram, .callout, .span-all"));
  }

  function frameOccupancy(frame) {
    if (!frame) return 0;
    const bounds = frame.getBoundingClientRect();
    if (bounds.height <= 0 || bounds.width <= 0) return 0;
    const styles = getComputedStyle(frame);
    const columns = Math.max(1, Number.parseInt(styles.columnCount, 10) || 1);
    const gap = Number.parseFloat(styles.columnGap) || 0;
    const columnWidth = Math.max(1, (bounds.width - gap * (columns - 1)) / columns);
    const stride = columnWidth + gap;
    let finalColumn = 0;
    let finalBottom = bounds.top;
    for (const node of frame.children) {
      for (const rect of node.getClientRects()) {
        if (rect.width <= 0 || rect.height <= 0) continue;
        const column = Math.max(0, Math.min(columns - 1, Math.round((rect.left - bounds.left) / stride)));
        if (column > finalColumn) {
          finalColumn = column;
          finalBottom = rect.bottom;
        } else if (column === finalColumn) {
          finalBottom = Math.max(finalBottom, rect.bottom);
        }
      }
    }
    const finalColumnRatio = Math.max(0, Math.min(1, (finalBottom - bounds.top) / bounds.height));
    return Math.max(0, Math.min(1, (finalColumn + finalColumnRatio) / columns));
  }

  function rebalanceTailPages(pages) {
    if (pages.length < 2) return { moved: 0, tailRatio: 0 };
    const previousFrame = pages.at(-2).querySelector(".text-frame");
    const tailFrame = pages.at(-1).querySelector(".text-frame");
    if (!previousFrame || !tailFrame) return { moved: 0, tailRatio: 0 };
    let previousRatio = frameOccupancy(previousFrame);
    let tailRatio = frameOccupancy(tailFrame);
    if (tailRatio >= 0.36 || hasRichFrameContent(tailFrame)) return { moved: 0, tailRatio };
    let moved = 0;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const candidate = previousFrame.lastElementChild;
      if (!candidate || previousFrame.children.length <= 1) break;
      const beforeGap = Math.abs(previousRatio - tailRatio);
      tailFrame.insertBefore(candidate, tailFrame.firstChild);
      const nextPreviousRatio = frameOccupancy(previousFrame);
      const nextTailRatio = frameOccupancy(tailFrame);
      const afterGap = Math.abs(nextPreviousRatio - nextTailRatio);
      if (overflows(tailFrame) || nextPreviousRatio < 0.42 || afterGap >= beforeGap - 0.02) {
        previousFrame.appendChild(candidate);
        break;
      }
      previousRatio = nextPreviousRatio;
      tailRatio = nextTailRatio;
      moved += 1;
    }
    return { moved, tailRatio };
  }

  function applyTailLayout(page, frame, layout) {
    page.classList.add(layout);
    if (overflows(frame)) {
      page.classList.remove(layout);
      return false;
    }
    return true;
  }

  function applyStackLayout(page, frame) {
    const original = [...frame.children];
    if (original.length < 2 || hasRichFrameContent(frame)) return false;
    const groups = [];
    for (const node of original) {
      if (node.matches(".keep-with-next") || groups.length === 0) groups.push([]);
      groups.at(-1).push(node);
    }
    if (groups.length < 2) {
      groups.length = 0;
      original.forEach((node) => groups.push([node]));
    }
    if (groups.length < 2 || groups.length > 8) return false;

    const rows = [];
    for (let index = 0; index < groups.length; index += 2) {
      const row = document.createElement("div");
      row.className = "text-stack-row";
      for (const group of groups.slice(index, index + 2)) {
        const cell = document.createElement("div");
        cell.className = "text-stack-cell";
        cell.append(...group);
        row.appendChild(cell);
      }
      rows.push(row);
    }
    frame.replaceChildren(...rows);
    page.classList.add("text-stack");
    if (overflows(frame)) {
      page.classList.remove("text-stack");
      frame.replaceChildren(...original);
      return false;
    }
    return true;
  }

  function composeTailPage(chapter, pages) {
    const { moved, tailRatio } = rebalanceTailPages(pages);
    const page = pages.at(-1);
    const frame = page?.querySelector(".text-frame");
    if (!page || !frame) return;
    const occupied = tailRatio || frameOccupancy(frame);
    const blocks = frame.children.length;
    const hasRichContent = hasRichFrameContent(frame);
    page.dataset.occupiedRatio = occupied.toFixed(4);
    page.dataset.tailBlocks = String(blocks);
    page.dataset.rebalancedBlocks = String(moved);

    let composed = false;
    if (!hasRichContent && (occupied <= 0.3 || blocks <= 2)) {
      composed = applyTailLayout(page, frame, "text-tail");
    } else if (!hasRichContent && occupied < 0.82 && blocks >= 2) {
      composed = applyStackLayout(page, frame);
    }
    if (composed) addTailFurniture(chapter, page, frame);
  }

  function intersects(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function tailFurnitureOverlaps(page) {
    const frame = page?.querySelector(".text-frame");
    const tail = page?.querySelector(".tail-furniture");
    if (!frame || !tail) return false;
    const tailRect = tail.getBoundingClientRect();
    return [...frame.children].some((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && intersects(rect, tailRect);
    });
  }

  function removeTailFurniture(page) {
    page.querySelector(".tail-furniture")?.remove();
    page.classList.remove("has-tail-furniture");
  }

  function addTailFurniture(chapter, page, frame) {
    if (!chapter.tailText) return false;
    page.classList.add("has-tail-furniture");
    const aside = document.createElement("aside");
    aside.className = "tail-furniture";
    aside.setAttribute("aria-hidden", "true");
    const wrapper = document.createElement("div");
    const label = document.createElement("p");
    label.className = "tail-label no-indent";
    label.textContent = "Chapter close";
    const quote = document.createElement("p");
    quote.className = "tail-quote no-indent";
    quote.textContent = chapter.tailText;
    wrapper.appendChild(label);
    wrapper.appendChild(quote);
    aside.appendChild(wrapper);
    page.querySelector(".page-inner").appendChild(aside);
    if (overflows(frame) || tailFurnitureOverlaps(page)) {
      removeTailFurniture(page);
      return false;
    }
    return true;
  }

  function paginateChapter(chapter, mount) {
    const units = paginationUnits(chapter.blocks.map(blockNode));
    let page;
    let frame;
    let count = 0;
    const pages = [];
    function newPage() {
      count += 1;
      page = document.createElement("section");
      page.className = "page text-page " + (bookData.bodyColumns || "text-two");
      if (count === 1) {
        page.id = chapter.id;
        page.dataset.firstTextPageFor = chapter.id;
      }
      page.setAttribute("aria-label", chapter.title + (count > 1 ? " continued" : ""));
      const partLabel = chapter.part ? chapter.part.label : "Opening";
      const inner = document.createElement("div");
      inner.className = "page-inner";
      const header = document.createElement("header");
      header.className = "text-page-header";
      const kicker = appendText(header, "p", "chapter-kicker no-indent", chapter.number === "Introduction" ? "Introduction" : "Chapter " + chapter.number);
      kicker.append(" ");
      appendText(kicker, "span", "", partLabel);
      appendText(header, "h1", "text-page-title", chapter.title);
      frame = document.createElement("div");
      frame.className = "text-frame";
      inner.appendChild(header);
      inner.appendChild(frame);
      page.appendChild(inner);
      mount.appendChild(page);
      pages.push(page);
    }

    newPage();
    for (const unit of units) {
      frame.appendChild(unit);
      if (overflows(frame)) {
        frame.removeChild(unit);
        newPage();
        frame.appendChild(unit);
        if (overflows(frame)) throw new Error("A manuscript block is too large for a text page in " + chapter.title);
      }
    }

    const lastPage = pages[pages.length - 1];
    const lastFrame = lastPage?.querySelector(".text-frame");
    if (lastPage && lastFrame) {
      composeTailPage(chapter, pages);
    }
  }

  function addPageNumbers() {
    document.querySelectorAll(".page-number").forEach((node) => node.remove());
    const pages = [...document.querySelectorAll(".page")];
    pages.forEach((page, index) => {
      if (page.classList.contains("cover")) return;
      const number = document.createElement("div");
      number.className = "page-number";
      number.textContent = String(index + 1);
      page.querySelector(".page-inner")?.appendChild(number);
    });
    document.querySelectorAll("[data-toc-page-for]").forEach((node) => {
      const target = document.getElementById(node.dataset.tocPageFor);
      const pageNumber = pages.indexOf(target) + 1;
      node.textContent = pageNumber > 0 ? String(pageNumber) : "";
    });
  }

  function checkOverflow() {
    const offenders = [...document.querySelectorAll(".text-frame")].filter(overflows);
    if (offenders.length) {
      document.documentElement.dataset.overflow = String(offenders.length);
      throw new Error(offenders.length + " text frames overflow");
    }
    const tailOffenders = [...document.querySelectorAll(".text-page")].filter(tailFurnitureOverlaps);
    if (tailOffenders.length) {
      document.documentElement.dataset.tailOverlap = String(tailOffenders.length);
      throw new Error(tailOffenders.length + " tail furniture block(s) overlap text");
    }
  }

  try {
    for (const chapter of bookData.chapters) {
      const mount = document.querySelector('[data-chapter-id="' + chapter.id + '"]');
      if (mount) paginateChapter(chapter, mount);
    }
    addPageNumbers();
    checkOverflow();
    window.__BOOK_READY = true;
  } catch (error) {
    window.__BOOK_READY = false;
    window.__BOOK_ERROR = error.message;
    console.error(error);
  }
}

export function serializeBookClientProgram() {
  return "(" + bookClientProgram.toString() + ")();";
}
