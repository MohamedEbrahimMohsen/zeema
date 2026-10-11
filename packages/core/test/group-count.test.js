// A group may stand for N identical copies of everything inside it: `count: 3` on the group, a
// cluster drawn once behind a load balancer. It parses and serialises like any other scalar, keeps
// its bytes through an unrelated edit, is checked for shape, and draws as a node's count does: two
// cards behind the frame and a ×N chip at its top-right (frameDecor, the same maths as nodeDecor).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { groupCount, groupTitle, setGroupCount, setGroupField } from "../src/document.js";
import { layout } from "../src/layout.js";
import { frameDecor, nodeDecor, STACK_STEP, toMermaid, toSvg } from "../src/render.js";
import { check } from "../src/structure.js";
import { parse, serialize } from "../src/yaml.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..", "..");
const fixture = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "schema", "design.schema.json"), "utf8"));
const catalogue = { ...fixture, schema };

const app = Object.values(fixture.components).find(
  (c) => c.kind === "app-server" && c.provider === "default",
)?.id;

const TEXT = [
  'schemaVersion: "1"',
  'type: "design"',
  'id: "web-tier"',
  "groups:",
  "  - id: web",
  "    kind: cell",
  '    label: "Web"',
  "    # three identical copies behind the balancer",
  "    count: 3",
  '  - { id: "edge", kind: "system" }',
  "nodes:",
  `  - { id: "api", component: "${app}", group: "web" }`,
  `  - { id: "lb", component: "${app}", group: "edge" }`,
  "edges: []",
  "",
].join("\n");

describe("group count: parse and serialise", () => {
  it("parses into group.count, an integer", () => {
    const { doc } = parse(TEXT);
    expect(doc.groups[0].count).toBe(3);
    expect(doc.groups[1].count).toBeUndefined();
  });

  it("round-trips byte for byte, and through an unrelated edit", () => {
    const { doc, cst } = parse(TEXT);
    expect(serialize(cst, doc)).toBe(TEXT);
    const out = serialize(cst, setGroupField(doc, "web", "label", "Front"));
    expect(out).toBe(TEXT.replace('label: "Web"', 'label: "Front"'));
  });

  it("setGroupCount changes, adds and removes only its own line", () => {
    const { doc, cst } = parse(TEXT);
    expect(serialize(cst, setGroupCount(doc, "web", 5))).toBe(TEXT.replace("count: 3", "count: 5"));
    const removed = serialize(cst, setGroupCount(doc, "web", null));
    // the comment above the line belongs to it, and goes with it
    expect(removed).toBe(
      TEXT.replace("    # three identical copies behind the balancer\n    count: 3\n", ""),
    );
    const added = serialize(cst, setGroupCount(doc, "edge", 2));
    expect(parse(added).doc.groups[1].count).toBe(2);
    expect(added.split("\n").filter((l) => !TEXT.split("\n").includes(l))).toHaveLength(1);
  });

  it("setGroupCount leaves the document it was given alone, and an unknown id is a no-op", () => {
    const { doc } = parse(TEXT);
    setGroupCount(doc, "web", 9);
    expect(doc.groups[0].count).toBe(3);
    expect(setGroupCount(doc, "nope", 4)).toEqual(doc);
  });
});

describe("groupCount", () => {
  it("is the count when it is an integer of 2 or more, else null", () => {
    expect(groupCount({ id: "g", kind: "cell", count: 3 })).toBe(3);
    for (const count of [undefined, 1, 0, -2, 2.5, "3", null, true])
      expect(groupCount({ id: "g", kind: "cell", count })).toBeNull();
  });

  it("the frame's title says ×N after its name", () => {
    expect(groupTitle(catalogue, { id: "web", kind: "cell", label: "Web", count: 3 })).toMatch(
      / ×3$/,
    );
    expect(groupTitle(catalogue, { id: "web", kind: "cell", label: "Web" })).not.toMatch(/×/);
  });
});

describe("structure", () => {
  const withCount = (count) => {
    const { doc } = parse(TEXT);
    doc.groups[0].count = count;
    return doc;
  };
  const messages = (doc) => check(doc, catalogue, { file: "f" }).map((f) => f.message);

  it("a whole count of 2 or more is clean", () => {
    expect(messages(parse(TEXT).doc)).toEqual([]);
    expect(messages(withCount(2))).toEqual([]);
  });

  it("anything else is one blocking finding on the group", () => {
    for (const count of ["3", 1, 0, -1, 2.5, true, null]) {
      expect(check(withCount(count), catalogue, { file: "f" })).toEqual([
        {
          message: `f: group web count ${JSON.stringify(count)} is not a whole number of 2 or more`,
          subject: { type: "group", ref: "web" },
          blocking: true,
        },
      ]);
    }
  });

  it('refuses the YAML count: "3" and count: 1 as written', () => {
    for (const bad of ['count: "3"', "count: 1"]) {
      const { doc } = parse(TEXT.replace("count: 3", bad));
      expect(messages(doc)).toHaveLength(1);
    }
  });
});

describe("frameDecor", () => {
  it("is null without a count of 2 or more", () => {
    expect(frameDecor(300, 200)).toBeNull();
    expect(frameDecor(300, 200, { count: 1 })).toBeNull();
    expect(frameDecor(300, 200, { count: null })).toBeNull();
  });

  it("is a node's stack and ×N chip, by the same maths", () => {
    expect(frameDecor(300, 200, { count: 4 })).toEqual(nodeDecor(300, 200, { count: 4 }));
    const d = frameDecor(300, 200, { count: 4 });
    expect(d.cards.map((c) => [c.x, c.y])).toEqual([
      [2 * STACK_STEP, -2 * STACK_STEP],
      [STACK_STEP, -STACK_STEP],
    ]);
    expect(d.chips.map((c) => c.text)).toEqual(["×4"]);
  });
});

describe("render", () => {
  const doc = parse(TEXT).doc;
  const svg = toSvg(doc, catalogue, { theme: "light" });
  const lay = layout(doc, catalogue);

  it("draws two cards behind a counted frame, then the frame, and a ×N chip", () => {
    const [x, y, w, h] = lay.frames.web;
    const f1 = (v) => Number(v).toFixed(1);
    const far = `<rect class="stack" opacity="0.45" x="${f1(x + 2 * STACK_STEP)}" y="${f1(y - 2 * STACK_STEP)}" width="${f1(w)}" height="${f1(h)}" rx="14"`;
    const near = `<rect class="stack" opacity="0.7" x="${f1(x + STACK_STEP)}" y="${f1(y - STACK_STEP)}"`;
    const frame = `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="14"`;
    expect(svg.indexOf(far)).toBeGreaterThan(-1);
    expect(svg.indexOf(near)).toBeGreaterThan(svg.indexOf(far));
    expect(svg.indexOf(frame)).toBeGreaterThan(svg.indexOf(near));
    expect(svg).toContain(">×3</text>");
    expect(svg).toMatch(/<title>[^<]*web ×3<\/title>/);
  });

  it("draws nothing extra for a group without a count", () => {
    const plain = parse(TEXT.replace("    count: 3\n", "")).doc;
    const out = toSvg(plain, catalogue, { theme: "light" });
    expect(out).not.toContain('class="stack"');
    expect(out).not.toContain("×");
    // the layout is the same either way: decoration only
    expect(layout(plain, catalogue).frames).toEqual(lay.frames);
  });

  it("Mermaid names the subgraph with ×N", () => {
    expect(toMermaid(doc, "TD", catalogue)).toMatch(/subgraph n_g_web\["Web ×3"\]/);
  });
});
