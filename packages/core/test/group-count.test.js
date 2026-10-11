// A group may stand for N identical copies of everything inside it: `count: 3` on the group, a
// cluster drawn once behind a load balancer. It parses and serialises like any other scalar, keeps
// its bytes through an unrelated edit, is checked for shape, and draws as a node's count does: two
// cards behind the frame and a ×N chip at its top-right (frameDecor, the same maths as nodeDecor).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { groupCount, groupTitle, setGroupCount, setGroupField } from "../src/document.js";
import { edgeGeometry, STACK_REACH, stackInset } from "../src/geometry.js";
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
    const box = `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="14"`;
    const bg = `${box} fill="var(--bg)"/>`;
    const frame = `${box} fill="none"`;
    expect(svg.indexOf(far)).toBeGreaterThan(-1);
    expect(svg.indexOf(near)).toBeGreaterThan(svg.indexOf(far));
    // the page background over the cards, so only their top and right edges show in the frame
    expect(svg.indexOf(bg)).toBeGreaterThan(svg.indexOf(near));
    expect(svg.indexOf(frame)).toBeGreaterThan(svg.indexOf(bg));
    expect(svg).toContain(">×3</text>");
    expect(svg).toMatch(/<title>[^<]*web ×3<\/title>/);
  });

  it("draws nothing extra for a group without a count", () => {
    const plain = parse(TEXT.replace("    count: 3\n", "")).doc;
    const out = toSvg(plain, catalogue, { theme: "light" });
    expect(out).not.toContain('class="stack"');
    // no tint, so nothing is cut: no frame lays the page background down
    for (const [x, y, w, h] of Object.values(layout(plain, catalogue).frames))
      expect(out).not.toContain(
        `<rect x="${Number(x).toFixed(1)}" y="${Number(y).toFixed(1)}" width="${Number(w).toFixed(1)}" height="${Number(h).toFixed(1)}" rx="14" fill="var(--bg)"/>`,
      );
    expect(out).not.toContain("×");
    // the layout is the same either way: decoration only
    expect(layout(plain, catalogue).frames).toEqual(lay.frames);
  });

  it("Mermaid names the subgraph with ×N", () => {
    expect(toMermaid(doc, "TD", catalogue)).toMatch(/subgraph n_g_web\["Web ×3"\]/);
  });
});

// An edge end on the top or right of a stack stops on the outermost card, 2 * STACK_STEP out
// along the side's normal, so the line does not cross the cards; left and bottom are unchanged.
describe("group count: edges stop at the stack's outer card", () => {
  const edgesOf = (pairs, boxes, frames, stacked, routing) =>
    edgeGeometry({ edges: pairs.map(([from, to]) => ({ from, to })) }, boxes, {}, {}, frames, {
      stacked: new Set(stacked),
      routing,
    });
  const first = (e) => e.points[0];
  const last = (e) => e.points[e.points.length - 1];

  it("the reach is two steps, on top and right only", () => {
    expect(STACK_REACH).toBe(2 * STACK_STEP);
    expect(stackInset("top")).toEqual([0, -STACK_REACH]);
    expect(stackInset("right")).toEqual([STACK_REACH, 0]);
    expect(stackInset("bottom")).toEqual([0, 0]);
    expect(stackInset("left")).toEqual([0, 0]);
  });

  it("an edge into a counted group from above ends 12px above the frame's top", () => {
    const boxes = { lb: [160, 0, 100, 60], api: [160, 260, 100, 60] };
    const frames = { web: [100, 200, 300, 160] };
    const [e] = edgesOf([["lb", "web"]], boxes, frames, ["web"]);
    expect(last(e)[1]).toBe(200 - 2 * STACK_STEP);
    // the last run is still square to the side: straight down into it
    const prev = e.points[e.points.length - 2];
    expect(prev[0]).toBe(last(e)[0]);
    expect(prev[1]).toBeLessThan(last(e)[1]);
    // without the count it ends on the frame
    const [plain] = edgesOf([["lb", "web"]], boxes, frames, []);
    expect(last(plain)[1]).toBe(200);
    expect(last(plain)[0]).toBe(last(e)[0]);
  });

  it("an edge into a counted group's member is not moved", () => {
    const boxes = { lb: [160, 0, 100, 60], api: [160, 260, 100, 60] };
    const frames = { web: [100, 200, 300, 160] };
    const [e] = edgesOf([["lb", "api"]], boxes, frames, ["web"]);
    expect(last(e)[1]).toBe(260);
  });

  it("a member's edge to its own counted group stays inside the frame", () => {
    const boxes = { api: [160, 260, 100, 60] };
    const frames = { web: [100, 200, 300, 160] };
    const [plain] = edgesOf([["api", "web"]], boxes, frames, []);
    const [e] = edgesOf([["api", "web"]], boxes, frames, ["web"]);
    expect(e.points).toEqual(plain.points);
  });

  const node = { s: [300, 300, 100, 60] };
  it("an edge into a stacked node from the right ends 12px right of the box", () => {
    const boxes = { ...node, r: [600, 300, 100, 60] };
    const [e] = edgesOf([["r", "s"]], boxes, {}, ["s"]);
    expect(last(e)).toEqual([400 + 2 * STACK_STEP, 330]);
    const [plain] = edgesOf([["r", "s"]], boxes, {}, []);
    expect(last(plain)).toEqual([400, 330]);
  });

  it("an edge into a stacked node from the left or below is unchanged", () => {
    for (const other of [
      [0, 300, 100, 60],
      [300, 600, 100, 60],
    ]) {
      const boxes = { ...node, o: other };
      const [e] = edgesOf([["o", "s"]], boxes, {}, ["s"]);
      const [plain] = edgesOf([["o", "s"]], boxes, {}, []);
      expect(e.points).toEqual(plain.points);
    }
  });

  it("an uncounted box is unchanged", () => {
    const boxes = { ...node, r: [600, 300, 100, 60], t: [300, 0, 100, 60] };
    const pairs = [
      ["r", "s"],
      ["t", "s"],
    ];
    expect(edgesOf(pairs, boxes, {}, ["x"])).toEqual(edgesOf(pairs, boxes, {}, []));
  });

  it("an edge leaving a stacked box from the top starts 12px above it", () => {
    const boxes = { ...node, t: [300, 0, 100, 60] };
    const [e] = edgesOf([["s", "t"]], boxes, {}, ["s"]);
    expect(first(e)).toEqual([350, 300 - 2 * STACK_STEP]);
    expect(e.points[1][0]).toBe(350);
    for (const routing of ["bundled", "curved"]) {
      const [c] = edgesOf([["s", "t"]], boxes, {}, ["s"], routing);
      const [plain] = edgesOf([["s", "t"]], boxes, {}, [], routing);
      expect(first(c)).toEqual([first(plain)[0], first(plain)[1] - 2 * STACK_STEP]);
    }
  });

  it("a ported end on the right moves out too", () => {
    const boxes = { ...node, t: [300, 0, 100, 60] };
    const doc = { edges: [{ from: "s", to: "t" }] };
    const ports = { "s>t": { from: { side: "right", t: 0.5 } } };
    const [plain] = edgeGeometry(doc, boxes, {}, ports, {}, {});
    expect(first(plain)).toEqual([400, 330]);
    const [e] = edgeGeometry(doc, boxes, {}, ports, {}, { stacked: new Set(["s"]) });
    expect(first(e)).toEqual([400 + 2 * STACK_STEP, 330]);
    expect(e.points[1][1]).toBe(330);
  });

  it("layout and the SVG stop an edge into a counted group on its outer card", () => {
    const text = TEXT.replace("edges: []", 'edges:\n  - { from: "lb", to: "web" }');
    const d = parse(text).doc;
    const counted = layout(d, catalogue);
    const plain = layout(parse(text.replace("    count: 3\n", "")).doc, catalogue);
    const [a] = counted.edges;
    const [b] = plain.edges;
    const f = counted.frames.web;
    const end = last(b);
    const side =
      end[1] === f[1]
        ? "top"
        : end[0] === f[0] + f[2]
          ? "right"
          : end[0] === f[0]
            ? "left"
            : "bottom";
    const [dx, dy] = stackInset(side);
    expect(last(a)).toEqual([end[0] + dx, end[1] + dy]);
  });
});
