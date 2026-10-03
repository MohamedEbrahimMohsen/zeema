// The landing page must never show a design the engine would refuse. Every YAML fragment on
// it is marked `data-yaml`; this test lifts each one out of the HTML exactly as a visitor
// would read it, parses it with the engine and runs the structural check against the
// catalogue on disk. Attributes that refine a block:
//
//   data-yaml-base="<id>"    a fragment: merged into the design of the block with that id
//                            (edges matched by from/to, nodes by id) before it is checked
//   data-yaml-edge="a>b"     the fragment is properties of that edge of the base design
//   data-rules="id id"       the exact set of rules the (merged) design trips, because the
//                            page says so next to it ("" means none)
//
// A line starting "+ " is a proposed addition; the "+" stands in for two spaces of indent.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalogue } from "@zeema/catalogue";
import { normalize } from "@zeema/core/document";
import { runRules } from "@zeema/core/rules";
import { check } from "@zeema/core/structure";
import { parse } from "@zeema/core/yaml";
import { describe, expect, it } from "vitest";
import { render } from "../server.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "public", "index.html"), "utf8");
const cat = loadCatalogue();

const decode = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");

const toYaml = (inner) =>
  decode(inner.replace(/<[^>]+>/g, ""))
    .replace(/^\+ /gm, "  ")
    .replace(/^\s*\n/, "")
    .trimEnd();

const dedent = (text) => {
  const lines = text.split("\n");
  const pad = Math.min(...lines.filter((l) => l.trim()).map((l) => /^ */.exec(l)[0].length));
  return lines.map((l) => l.slice(pad)).join("\n");
};

/** Every element with a `data-yaml` attribute: its attributes and its text as YAML. */
function yamlBlocks(src) {
  const out = [];
  const open = /<([a-z]+)\b([^>]*\sdata-yaml(?![-\w])[^>]*)>/g;
  for (let m = open.exec(src); m; m = open.exec(src)) {
    const tag = m[1];
    const start = m.index + m[0].length;
    let end;
    if (tag === "script") end = src.indexOf("</script>", start);
    else {
      // the matching close tag, counting nested elements of the same name
      const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, "g");
      re.lastIndex = start;
      let depth = 1;
      for (let t = re.exec(src); t; t = re.exec(src)) {
        depth += t[0][1] === "/" ? -1 : 1;
        if (depth === 0) {
          end = t.index;
          break;
        }
      }
    }
    const attrs = Object.fromEntries(
      [...m[2].matchAll(/([a-z-]+)(?:="([^"]*)")?/g)].map((a) => [a[1], decode(a[2] ?? "")]),
    );
    out.push({ tag, attrs, text: toYaml(src.slice(start, end)) });
  }
  return out;
}

const blocks = yamlBlocks(html);
const byId = new Map(blocks.filter((b) => b.attrs.id).map((b) => [b.attrs.id, b]));
const label = (b) => b.attrs.id ?? `${b.tag} merged into ${b.attrs["data-yaml-base"]}`;

/** The design a block stands for: itself, or its fragment applied to its base. */
function designOf(b) {
  const own = parse(b.attrs["data-yaml-edge"] ? dedent(b.text) : b.text).doc;
  const baseId = b.attrs["data-yaml-base"];
  if (!baseId) return own;
  const base = byId.get(baseId);
  if (!base) throw new Error(`data-yaml-base="${baseId}" names no data-yaml block`);
  const doc = structuredClone(designOf(base));
  const edgeOf = (from, to) => doc.edges.find((e) => e.from === from && e.to === to);
  if (b.attrs["data-yaml-edge"]) {
    const [from, to] = b.attrs["data-yaml-edge"].split(">");
    const edge = edgeOf(from, to);
    if (!edge) throw new Error(`base ${baseId} has no edge ${from}>${to}`);
    Object.assign(edge, own);
    return doc;
  }
  for (const e of own.edges ?? []) {
    const edge = edgeOf(e.from, e.to);
    if (edge) Object.assign(edge, e);
    else doc.edges.push(e);
  }
  for (const n of own.nodes ?? []) {
    const node = doc.nodes.find((x) => x.id === n.id);
    if (node) Object.assign(node, n);
    else doc.nodes.push(n);
  }
  return doc;
}

describe("YAML on the landing page", () => {
  it("finds the blocks the page shows", () => {
    // The commit story's design, review diff and suggestion; the developers snippet; the
    // agent panel and both directions it types.
    for (const id of ["cmSchemaYaml", "snippet", "archCode", "yamlA2G", "yamlG2A"])
      expect(byId.has(id), id).toBe(true);
    expect(blocks.length).toBeGreaterThanOrEqual(7);
  });

  for (const b of blocks) {
    describe(label(b), () => {
      it("parses and passes the structural check", () => {
        const doc = normalize(designOf(b)).doc;
        expect(check(doc, cat).map((f) => f.message)).toEqual([]);
      });

      it("never gives a node a kind (the component brings it)", () => {
        expect(b.text).not.toMatch(/^\s*(- )?kind:/m);
        for (const n of designOf(b).nodes ?? []) expect(n).not.toHaveProperty("kind");
      });

      if ("data-rules" in b.attrs)
        it("trips exactly the rules the page says it does", () => {
          const doc = normalize(designOf(b)).doc;
          const hit = [...new Set(runRules(doc, cat).map((h) => h.id))].sort();
          const claimed = b.attrs["data-rules"].split(/\s+/).filter(Boolean).sort();
          expect(hit).toEqual(claimed);
        });
    });
  }

  it("the static agent panel shows the design the script types first", () => {
    expect(byId.get("archCode").text).toBe(byId.get("yamlA2G").text);
  });
});

describe("claims on the landing page", () => {
  it("names no retired field, command or private design", () => {
    const lower = html.toLowerCase();
    for (const word of [
      "timeout_ms",
      "retry_policy",
      "arkore",
      "talmaza",
      "flowsaga",
      "zeema-mcp",
      "zeema validate:",
      "components:",
    ])
      expect(lower, word).not.toContain(word);
  });

  it("has no dead links", () => {
    expect(html).not.toMatch(/href="#"/);
  });

  it("bakes in the catalogue counts that are on disk", () => {
    const components = Object.values(cat.components);
    const want = {
      components: components.length,
      kinds: Object.keys(cat.kinds).length,
      rules: cat.rules.length,
      providers: new Set(components.map((c) => c.provider)).size,
    };
    const shown = [...html.matchAll(/data-stat="(\w+)">([^<]*)</g)];
    expect(shown.length).toBeGreaterThan(0);
    for (const [, key, text] of shown) expect(text, key).toBe(want[key].toLocaleString("en-US"));
  });

  it("names only curated designs that exist in the repository", () => {
    const slugs = [...html.matchAll(/\/d\/([a-z0-9-]+)\/([a-z0-9-]+)/g)];
    expect(slugs.length).toBeGreaterThan(0);
    const tiers = ["reference", "imported"].map((t) => join(cat.root, "designs", t));
    for (const [, owner, slug] of slugs) {
      expect(owner).toBe("zeema");
      const exists = tiers.some((dir) => {
        try {
          readFileSync(join(dir, slug, "design.yaml"));
          return true;
        } catch {
          return false;
        }
      });
      expect(exists, slug).toBe(true);
    }
  });
});

describe("server render", () => {
  const empty = { catalogue: null, designs: new Map() };

  it("leaves a card without numbers when it has none to show", () => {
    const out = render(html, empty);
    expect(out).toMatch(/<span class="dz-meta" data-counts="youtube"><\/span>/);
    expect(out).toBe(html);
  });

  it("fills in the counts it fetched", () => {
    const out = render(html, {
      catalogue: { components: 3000, kinds: 80, rules: 40, providers: 12 },
      designs: new Map([["youtube", { nodeCount: 17, edgeCount: 1, findingCount: 0 }]]),
    });
    expect(out).toContain(
      '<span class="dz-meta" data-counts="youtube">17 components · 1 edge · <span class="dz-ok">✓ 0 findings</span></span>',
    );
    expect(out).toContain('<b data-stat="components">3,000</b>');
    expect(out).toMatch(/<span class="dz-meta" data-counts="uber-dispatch"><\/span>/);
  });
});
