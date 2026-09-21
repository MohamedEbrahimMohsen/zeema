// The documentation as data, checked the way the catalogue is checked.
//
// Prose can be wrong and nobody notices for a year. These are the parts of a docs page that can
// be wrong *mechanically*: a link to a page that does not exist, an anchor nobody defines, a
// catalogue id that has been renamed, a generated block with no implementation, and — the one
// that costs a reader the most — a YAML sample that does not parse or does not validate.
import fs from "node:fs";
import path from "node:path";
import { normalize } from "@zeema/core/document";
import { check } from "@zeema/core/structure";
import { parse } from "@zeema/core/yaml";
import { describe, expect, it } from "vitest";
import { getCatalogue } from "./catalogue";
import {
  allDocs,
  collectHeadings,
  docNeighbours,
  docPage,
  docSearchIndex,
  docsNav,
  GENERATED_BLOCK_NAMES,
  headingId,
  parseFrontMatter,
  splitBlocks,
} from "./docs";

const CONTENT = path.join(process.cwd(), "content", "docs");

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith(".md")) yield full;
  }
}

const files = [...walk(CONTENT)];

describe("front matter", () => {
  it("gives every page a title and a description", () => {
    for (const file of files) {
      const { data } = parseFrontMatter(fs.readFileSync(file, "utf8"));
      expect(data.title, file).toBeTruthy();
      expect(data.description, file).toBeTruthy();
      expect(data.order, file).toBeTruthy();
    }
  });

  it("keeps the front matter out of the body", () => {
    const { data, body } = parseFrontMatter('---\ntitle: "A"\norder: 2\n---\n# B\n');
    expect(data).toEqual({ title: "A", order: "2" });
    expect(body).toBe("# B\n");
  });
});

describe("the tree", () => {
  it("has every page in exactly one section, in order", () => {
    const nav = docsNav();
    expect(nav.length).toBeGreaterThan(1);
    const hrefs = nav.flatMap((s) => s.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.length).toBe(allDocs().length);
  });

  it("serves the introduction at /docs", () => {
    expect(docPage("/docs")?.title).toBe("Introduction");
    expect(allDocs()[0].href).toBe("/docs");
  });

  it("chains every page to its neighbours", () => {
    const pages = allDocs();
    expect(docNeighbours("/docs").prev).toBeNull();
    expect(docNeighbours(pages[pages.length - 1].href).next).toBeNull();
    for (let i = 1; i < pages.length; i++)
      expect(docNeighbours(pages[i].href).prev?.href).toBe(pages[i - 1].href);
  });

  it("answers nothing for an address it does not have", () => {
    expect(docPage("/docs/not-a-page")).toBeNull();
  });
});

describe("headings", () => {
  it("skips headings inside a fenced block", () => {
    const h = collectHeadings("## Real\n\n```md\n## Not real\n```\n\n### Also real\n");
    expect(h.map((x) => x.text)).toEqual(["Real", "Also real"]);
  });

  it("strips inline markup out of the anchor", () => {
    expect(headingId("The `custom` kind")).toBe("the-custom-kind");
  });

  it("gives every page at least one heading, and unique anchors within it", () => {
    for (const page of allDocs()) {
      const ids = page.headings.map((h) => h.id);
      expect(ids.length, page.href).toBeGreaterThan(0);
      expect(new Set(ids).size, page.href).toBe(ids.length);
    }
  });

  it("indexes pages and headings for the filter", () => {
    const index = docSearchIndex();
    expect(index.some((r) => r.href === "/docs")).toBe(true);
    expect(index.some((r) => r.href.includes("#"))).toBe(true);
  });
});

describe("blocks", () => {
  it("cuts callouts and generated markers out of the prose", () => {
    const blocks = splitBlocks("a\n\n> [!NOTE]\n> careful\n\nb\n\n{{rules-table}}\n\nc\n");
    expect(blocks.map((b) => b.kind)).toEqual([
      "markdown",
      "callout",
      "markdown",
      "generated",
      "markdown",
    ]);
    expect(blocks[1]).toEqual({ kind: "callout", tone: "note", text: "careful" });
  });

  it("leaves a fenced sample alone", () => {
    const blocks = splitBlocks("```text\n> [!NOTE]\n{{rules-table}}\n```\n");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("markdown");
  });

  it("asks only for generated blocks that exist", () => {
    for (const page of allDocs())
      for (const block of splitBlocks(page.body))
        if (block.kind === "generated")
          expect(GENERATED_BLOCK_NAMES, `${page.href}: {{${block.name}}}`).toContain(block.name);
  });
});

describe("links", () => {
  const linksOf = (body: string) => [...body.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]);

  it("has no orphan link to another documentation page", () => {
    for (const page of allDocs())
      for (const href of linksOf(page.body)) {
        if (!href.startsWith("/docs")) continue;
        const [target, hash] = href.split("#");
        const found = docPage(target);
        expect(found, `${page.href} -> ${href}`).not.toBeNull();
        if (hash)
          expect(
            found?.headings.some((h) => h.id === hash),
            `${page.href} -> ${href}`,
          ).toBe(true);
      }
  });

  it("has no link to a catalogue entity that does not exist", () => {
    const cat = getCatalogue();
    const ids = {
      kinds: new Set(Object.keys(cat.kinds)),
      components: new Set(Object.keys(cat.components)),
      rules: new Set(cat.rules.map((r) => r.id)),
    };
    for (const page of allDocs())
      for (const href of linksOf(page.body)) {
        const m = /^\/catalogue\/(kinds|components|rules)\/([^/#?]+)/.exec(href);
        if (!m) continue;
        const [, type, id] = m as unknown as [string, keyof typeof ids, string];
        expect(ids[type].has(id), `${page.href} -> ${href}`).toBe(true);
      }
  });
});

describe("yaml samples", () => {
  /** Every fenced yaml block in the content, with the rest of its info string. */
  const blocks: Array<{ file: string; info: string; body: string }> = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    for (const m of text.matchAll(/^```(yaml|yml)([^\n]*)\n([\s\S]*?)^```$/gm))
      blocks.push({ file: path.basename(file), info: m[2].trim(), body: m[3] });
  }

  it("has some to check", () => {
    expect(blocks.length).toBeGreaterThan(10);
  });

  // A block marked `fragment` is a piece of someone else's file — a CI workflow step, say — and
  // the engine's parser only accepts whole documents. Everything else must parse.
  it("parses with the engine's own parser", () => {
    for (const b of blocks.filter((x) => x.info !== "fragment"))
      expect(() => parse(b.body), `${b.file}: ${b.body.split("\n")[0]}`).not.toThrow();
  });

  it("is structurally valid wherever a block claims to be a whole design", () => {
    const cat = getCatalogue();
    const complete = blocks.filter((b) => b.info === "complete");
    expect(complete.length).toBeGreaterThan(2);
    for (const b of complete) {
      const doc = normalize(parse(b.body).doc).doc;
      const findings = check(doc, cat) as Array<{ message: string }>;
      expect(
        findings.map((f) => f.message),
        b.file,
      ).toEqual([]);
    }
  });
});
