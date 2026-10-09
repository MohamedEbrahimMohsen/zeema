// A node may reference another Zeema design: `ref: { design: "owner/slug", version }`. The node
// stays an ordinary typed node; the reference is an annotation. It parses and serialises like any
// other nested map, keeps its bytes through an unrelated edit, is checked for shape (never for
// existence), and draws a link disc at the box's bottom-right corner.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { describeNode } from "../src/describe.js";
import { nodeRef, setNodeField, setNodeRef } from "../src/document.js";
import { AUTH_GLYPH_R, REF_INSET, refAt } from "../src/geometry.js";
import { layout } from "../src/layout.js";
import { refGlyphMarkup, toSvg } from "../src/render.js";
import { check } from "../src/structure.js";
import { nodeText, nodeWidth, REF_CLEAR, textWidth } from "../src/text.js";
import { parse, serialize } from "../src/yaml.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..", "..");
const fixture = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "schema", "design.schema.json"), "utf8"));
const catalogue = { ...fixture, schema };

// Two components found in the fixture rather than named here.
const pick = (kind) =>
  Object.values(fixture.components).find((c) => c.kind === kind && c.provider === "default")?.id;
const app = pick("app-server");
const db = pick("sql-database");

const TEXT = [
  'schemaVersion: "1"',
  'type: "design"',
  'id: "news-feed"',
  "nodes:",
  `  - id: notifications`,
  `    component: ${app}`,
  '    label: "Notification Service"',
  "    # the published notification design",
  "    ref:",
  '      design: "mohamedebrahimmohsen/notification-system"',
  "      version: 3",
  `  - id: db`,
  `    component: ${db}`,
  "edges: []",
  "",
].join("\n");

const lines = (s) => s.split("\n");
const refLines = (s) => lines(s).filter((l) => /ref:|design: "moh|version: /.test(l));

describe("node ref: parse and serialise", () => {
  it("parses into node.ref = { design, version }", () => {
    const { doc } = parse(TEXT);
    expect(doc.nodes[0].ref).toEqual({
      design: "mohamedebrahimmohsen/notification-system",
      version: 3,
    });
    expect(doc.nodes[1].ref).toBeUndefined();
  });

  it("round-trips byte for byte", () => {
    const { doc, cst } = parse(TEXT);
    expect(serialize(cst, doc)).toBe(TEXT);
    const head = TEXT.replace("version: 3", 'version: "head"');
    const p = parse(head);
    expect(p.doc.nodes[0].ref.version).toBe("head");
    expect(serialize(p.cst, p.doc)).toBe(head);
  });

  it("an edit to another field of the node leaves the ref lines untouched", () => {
    const { doc, cst } = parse(TEXT);
    const out = serialize(cst, setNodeField(doc, "notifications", "label", "Notifier"));
    expect(out).toContain('label: "Notifier"');
    expect(refLines(out)).toEqual(refLines(TEXT));
    const before = lines(TEXT);
    const after = lines(out);
    expect(after.length).toBe(before.length);
    expect(after.filter((l, i) => l !== before[i])).toEqual(['    label: "Notifier"']);
  });
});

describe("setNodeRef", () => {
  it("adds a ref to a node that has none", () => {
    const { doc, cst } = parse(TEXT);
    const next = setNodeRef(doc, "db", { design: "acme/orders-db", version: "head" });
    expect(next.nodes[1].ref).toEqual({ design: "acme/orders-db", version: "head" });
    expect(doc.nodes[1].ref).toBeUndefined(); // the argument is not mutated
    const out = serialize(cst, next);
    expect(out).toContain(
      [
        `    component: ${db}`,
        "    ref:",
        '      design: "acme/orders-db"',
        '      version: "head"',
      ].join("\n"),
    );
    expect(parse(out).doc).toEqual(next);
  });

  it("replaces a ref, changing only the lines that differ", () => {
    const { doc, cst } = parse(TEXT);
    const out = serialize(
      cst,
      setNodeRef(doc, "notifications", {
        design: "mohamedebrahimmohsen/notification-system",
        version: 4,
      }),
    );
    const before = lines(TEXT);
    expect(lines(out).filter((l, i) => l !== before[i])).toEqual(["      version: 4"]);
  });

  it("removes the key and the comment that leads it with null", () => {
    const { doc, cst } = parse(TEXT);
    const next = setNodeRef(doc, "notifications", null);
    expect("ref" in next.nodes[0]).toBe(false);
    const out = serialize(cst, next);
    expect(out).not.toMatch(/ref:|notification-system|version:|published/);
    expect(parse(out).doc).toEqual(next);
  });

  it("an unknown node id returns the document unchanged", () => {
    const { doc } = parse(TEXT);
    expect(setNodeRef(doc, "nope", { design: "a/b", version: 1 })).toEqual(doc);
  });
});

describe("nodeRef", () => {
  it("splits owner and slug and keeps the version", () => {
    expect(nodeRef(parse(TEXT).doc.nodes[0])).toEqual({
      design: "mohamedebrahimmohsen/notification-system",
      owner: "mohamedebrahimmohsen",
      slug: "notification-system",
      version: 3,
    });
    expect(nodeRef({ id: "a", ref: { design: "Some-Login/x", version: "head" } })).toEqual({
      design: "Some-Login/x",
      owner: "Some-Login",
      slug: "x",
      version: "head",
    });
  });

  it("is null with no ref or a malformed one", () => {
    expect(nodeRef({ id: "a" })).toBeNull();
    expect(nodeRef(null)).toBeNull();
    for (const ref of [
      "a/b",
      { design: "a/b" },
      { design: "a/b", version: 0 },
      { design: "a/b", version: 1.5 },
      { design: "a/b", version: "latest" },
      { design: "ab", version: 1 },
      { design: "a/B", version: 1 },
      { design: "a/b/c", version: 1 },
    ])
      expect(nodeRef({ id: "a", ref })).toBeNull();
  });
});

describe("structure", () => {
  const withRef = (ref) => {
    const { doc } = parse(TEXT);
    doc.nodes[0].ref = ref;
    return doc;
  };
  const messages = (doc) => check(doc, catalogue, { file: "f" }).map((f) => f.message);

  it("a well-formed ref is clean, at a release or at head", () => {
    expect(messages(parse(TEXT).doc)).toEqual([]);
    expect(messages(withRef({ design: "Owner-1/notification-system", version: "head" }))).toEqual(
      [],
    );
  });

  it("a design that is not owner/slug is one blocking finding on the node", () => {
    for (const design of ["notification-system", "a/Bad", "a/b/c", "/b", "a b/c"]) {
      const f = check(withRef({ design, version: 1 }), catalogue, { file: "f" });
      expect(f).toEqual([
        {
          message: `f: node notifications ref design ${JSON.stringify(design)} is not owner/slug`,
          subject: { type: "node", ref: "notifications" },
          blocking: true,
        },
      ]);
    }
  });

  it("a version that is neither a release number nor head is one blocking finding", () => {
    for (const version of [0, -2, 1.5, "latest", "3", true]) {
      const f = check(withRef({ design: "a/b", version }), catalogue, { file: "f" });
      expect(f).toEqual([
        {
          message: `f: node notifications ref version ${JSON.stringify(version)} is not a release number (1 or more) or "head"`,
          subject: { type: "node", ref: "notifications" },
          blocking: true,
        },
      ]);
    }
  });

  it("a missing field, an extra key or a ref that is not a map is a schema finding", () => {
    expect(messages(withRef({ design: "a/b" }))).toEqual([
      '/nodes/0/ref: missing required property "version"',
    ]);
    expect(messages(withRef({ design: "a/b", version: 1, url: "https://x" }))).toEqual([
      '/nodes/0/ref: unknown property "url"',
    ]);
    expect(messages(withRef("a/b@3"))).toEqual([
      "/nodes/0/ref: expected an object, found a string",
    ]);
  });

  it("the target is never looked up: any well-formed owner/slug passes", () => {
    expect(messages(withRef({ design: "nobody/does-not-exist", version: 999 }))).toEqual([]);
  });
});

describe("render", () => {
  it("draws the link disc at the bottom-right corner of a referencing node only", () => {
    const { doc } = parse(TEXT);
    const svg = toSvg(doc, catalogue);
    const glyph = refGlyphMarkup();
    expect(svg.split(glyph).length - 1).toBe(1);
    expect(svg).toMatch(
      /<g><title>Notification Service · [^<\n]+\nref: mohamedebrahimmohsen\/notification-system@v3<\/title>/,
    );
    const plain = toSvg(setNodeRef(doc, "notifications", null), catalogue);
    expect(plain).not.toContain(glyph);
    expect(plain).not.toContain("ref:");
    // The layout is the same picture: the reference adds the disc and a line of hover text only.
    const strip = (s) =>
      s.replace(/<g class="ref"[^>]*>.*?<\/g><\/g>\n/, "").replace(/\nref: [^<]*/, "");
    expect(strip(svg)).toBe(plain);
  });

  it("places the disc REF_INSET in from the right and bottom edges", () => {
    expect(refAt(150, 78)).toEqual([150 - REF_INSET, 78 - REF_INSET]);
    expect(REF_INSET).toBe(14);
    const { doc } = parse(TEXT);
    const svg = toSvg(doc, catalogue, {
      layout: { nodes: { notifications: [100, 40], db: [400, 40] } },
    });
    const m = /<g class="ref" transform="translate\(([\d.]+) ([\d.]+)\)">/.exec(svg);
    expect(m).not.toBeNull();
    const box = /<rect class="body" x="100" y="40" width="(\d+)" height="(\d+)"/.exec(svg);
    expect([Number(m[1]), Number(m[2])]).toEqual(
      refAt(Number(box[1]), Number(box[2])).map((v, i) => v + [100, 40][i]),
    );
  });

  it("the glyph is the auth disc in --muted by default, or the colour it is given", () => {
    expect(refGlyphMarkup()).toContain(
      `<circle r="${AUTH_GLYPH_R - 0.5}" fill="var(--bg)" stroke="var(--muted)"`,
    );
    expect(refGlyphMarkup()).toContain('stroke-width="2" stroke-linecap="round"');
    expect(refGlyphMarkup("#c00")).not.toContain("--muted");
  });

  it("head is written @head in the hover text", () => {
    const { doc } = parse(TEXT.replace("version: 3", 'version: "head"'));
    expect(toSvg(doc, catalogue)).toContain(
      "\nref: mohamedebrahimmohsen/notification-system@head</title>",
    );
  });
});

describe("describeNode", () => {
  it("mentions the reference in one sentence", () => {
    const { doc } = parse(TEXT);
    expect(describeNode(doc.nodes[0])).toBe(
      `Node "notifications" is ${app}, labelled "Notification Service", and references mohamedebrahimmohsen/notification-system at release 3.`,
    );
    expect(describeNode({ id: "x", component: app, ref: { design: "a/b", version: "head" } })).toBe(
      `Node "x" is ${app} and references a/b at head.`,
    );
    expect(describeNode(doc.nodes[1])).toBe(`Node "db" is ${db}.`);
  });
});

describe("the second line keeps clear of the link disc", () => {
  // aws-ecs, named as the catalogue names it: a long second line under any label.
  const SUB = "Amazon Elastic Container Service";
  const cat = {
    ...catalogue,
    locale: {
      ...catalogue.locale,
      components: { ...catalogue.locale?.components, "aws-ecs": { name: SUB } },
    },
  };
  const labels = ["Feed", "Notification Service", "A fairly long component name here"];
  const refDoc = (withRef) => ({
    schemaVersion: "1",
    id: "ref-demo",
    nodes: labels.map((label, i) => ({
      id: `n${i}`,
      component: "aws-ecs",
      label,
      ...(withRef ? { ref: { design: "zeema/notification-system", version: 1 } } : {}),
    })),
    edges: [],
  });

  it("REF_CLEAR is the disc's reach from the side, and 2px, on both sides", () => {
    expect(REF_CLEAR).toBe(2 * (REF_INSET + AUTH_GLYPH_R + 2));
  });

  it("no subtitle runs under the disc, on the server render", () => {
    const doc = refDoc(true);
    const lay = layout(doc, cat);
    const svg = toSvg(doc, cat);
    const subs = [...svg.matchAll(/<text class="c" x="([\d.]+)" y="[\d.]+"[^>]*>([^<]*)<\/text>/g)];
    expect(subs).toHaveLength(labels.length);
    for (const [, cx, text] of subs) {
      const n = doc.nodes.find((x) => {
        const [x0] = lay.positions[x.id];
        return Math.abs(x0 + lay.sizes[x.id][0] / 2 - Number(cx)) < 0.5;
      });
      const [x0] = lay.positions[n.id];
      const [w] = lay.sizes[n.id];
      const right = Number(cx) + textWidth(text, 11) / 2 - x0;
      // The disc's left side is refAt(w)[0] - AUTH_GLYPH_R; the line ends 2px short of it at most.
      expect(right).toBeLessThanOrEqual(refAt(w, 78)[0] - AUTH_GLYPH_R - 2);
      expect(right).toBeLessThanOrEqual(w - REF_CLEAR / 2);
    }
  });

  it("the box steps up rather than cutting the line, where a step is left", () => {
    expect(nodeWidth("Feed", SUB)).toBe(240);
    expect(nodeWidth("Feed", SUB, true)).toBe(256);
    expect(nodeText("Feed", SUB, 256, "aws-ecs", true).comp.text).toBe(SUB);
    // At the widest box a line too long for it is cut short of the disc, not drawn under it.
    const long = `${SUB} with a regional suffix`;
    const cut = nodeText("Feed", long, nodeWidth("Feed", long, true), "aws-ecs", true).comp.text;
    expect(cut.endsWith("…")).toBe(true);
    expect(textWidth(cut, 11)).toBeLessThanOrEqual(256 - 24 - REF_CLEAR);
  });

  it("a node without a reference measures exactly as before", () => {
    const plain = layout(refDoc(false), cat);
    for (const [i, label] of labels.entries()) {
      expect(plain.sizes[`n${i}`][0]).toBe(nodeWidth(label, SUB));
      expect(nodeWidth(label, SUB, false)).toBe(nodeWidth(label, SUB));
      for (const w of [126, 176, 240, 256])
        expect(nodeText(label, SUB, w, "aws-ecs", false)).toEqual(
          nodeText(label, SUB, w, "aws-ecs"),
        );
    }
  });
});
