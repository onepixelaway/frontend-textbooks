import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("skill core stays compact and routes optional detail progressively", async () => {
  const skill = await readFile(new URL("SKILL.md", root), "utf8");
  assert.ok(skill.split("\n").length <= 180, `SKILL.md has ${skill.split("\n").length} lines`);
  assert.ok(skill.split(/\s+/u).filter(Boolean).length <= 3000);
  assert.match(skill, /book-pipeline\.mjs/);
  assert.match(skill, /Scripts own deterministic work/);
  assert.match(skill, /model owns judgment/i);
  assert.doesNotMatch(skill, /Use expressive blue ink brushwork|Before generating the final HTML, read/);

  const references = [
    "intake-and-planning.md",
    "visual-system.md",
    "layout-and-html.md",
    "verification-gates.md",
    "reasoning-contracts.md",
    "iteration.md"
  ];
  await Promise.all(references.map(async (name) => {
    assert.match(skill, new RegExp(`references/${name.replace(".", "\\.")}`));
    const body = await readFile(new URL(`references/${name}`, root), "utf8");
    assert.ok(body.length > 100);
  }));
});

test("theme prompt prose has one executable source of truth", async () => {
  const files = [
    await readFile(new URL("SKILL.md", root), "utf8"),
    await readFile(new URL("STYLE_PRESETS.md", root), "utf8"),
    await readFile(new URL("themes/colbalt/index.mjs", root), "utf8")
  ];
  const signature = "Use expressive blue ink brushwork";
  assert.equal(files.filter((file) => file.includes(signature)).length, 1);
});
