// Orthogonal routing (routing.js through geometry.js): every edge is horizontal and vertical runs,
// no run cuts through a box that is not one of its ends, the edges leaving one side of a box are
// spread along it in the order of their targets, parallel cross runs sit in lanes of their own,
// and a port a person placed is where the edge starts. The curved style is untouched.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { drawnLayout } from "../src/drawn.js";
import {
  DEFAULT_ROUTING,
  edgeGeometry,
  edgePath,
  frameCaptions,
  groupFrames,
  orthoBowAt,
  portPoint,
  readRouting,
} from "../src/geometry.js";
import { layout } from "../src/layout.js";
import { toSvg } from "../src/render.js";
import { ORTHO_RADIUS } from "../src/routing.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogue = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));
const ORTHO = { routing: "orthogonal" };

// A fan-out through a middle row, like Managed Identity in Talmaza: one box on top, a row of
// boxes in between, and five targets on a row below them.
const W = 126,
  H = 78;
const fan = () => {
  const boxes = { src: [430, 0, W, H] };
  const mids = [];
  for (let k = 0; k < 4; k++) {
    boxes[`m${k}`] = [120 + k * 230, 170, W, H];
    mids.push(`m${k}`);
  }
  const targets = [];
  for (let k = 0; k < 5; k++) {
    boxes[`t${k}`] = [k * 230, 340, W, H];
    targets.push(`t${k}`);
  }
  // Listed out of order on purpose: the spread follows where the targets are, not the file.
  const order = ["t3", "t0", "t4", "t1", "t2"];
  const doc = {
    nodes: Object.keys(boxes).map((id) => ({ id, component: "container-service" })),
    edges: order.map((to) => ({ from: "src", to, protocol: "https", mode: "sync" })),
    groups: [],
  };
  return { boxes, doc, mids, targets };
};

const segments = (points) => points.slice(1).map((p, k) => [points[k], p]);
// Strictly through the inside of a box, not along or touching its border.
const through = ([p, q], b) =>
  Math.max(p[0], q[0]) > b[0] + 0.5 &&
  Math.min(p[0], q[0]) < b[0] + b[2] - 0.5 &&
  Math.max(p[1], q[1]) > b[1] + 0.5 &&
  Math.min(p[1], q[1]) < b[1] + b[3] - 0.5;

describe("orthogonal routing", () => {
  it("is the default, and a sidecar can ask for curves", () => {
    expect(DEFAULT_ROUTING).toBe("orthogonal");
    expect(readRouting(undefined)).toBe("orthogonal");
    expect(readRouting("curved")).toBe("curved");
    expect(readRouting("wiggly")).toBe("orthogonal");
    const { boxes, doc } = fan();
    expect(edgeGeometry(doc, boxes).every((e) => e.ortho)).toBe(true);
  });

  it("draws only horizontal and vertical runs", () => {
    const { boxes, doc } = fan();
    for (const e of edgeGeometry(doc, boxes, {}, {}, {}, ORTHO))
      for (const [p, q] of segments(e.points))
        expect(Math.abs(p[0] - q[0]) < 1e-6 || Math.abs(p[1] - q[1]) < 1e-6).toBe(true);
  });

  it("never cuts through a box that is not one of the edge's ends", () => {
    const { boxes, doc } = fan();
    for (const e of edgeGeometry(doc, boxes, {}, {}, {}, ORTHO))
      for (const [id, b] of Object.entries(boxes)) {
        if (id === e.from || id === e.to) continue;
        for (const s of segments(e.points))
          expect(through(s, b), `${e.to} through ${id}`).toBe(false);
      }
  });

  it("never runs back through its own boxes", () => {
    const { boxes, doc } = fan();
    for (const e of edgeGeometry(doc, boxes, {}, {}, {}, ORTHO))
      for (const s of segments(e.points)) {
        expect(through(s, boxes[e.from])).toBe(false);
        expect(through(s, boxes[e.to])).toBe(false);
      }
  });

  it("spreads the edges leaving one side in the order of their targets, so none cross there", () => {
    const { boxes, doc } = fan();
    const geom = edgeGeometry(doc, boxes, {}, {}, {}, ORTHO);
    const src = boxes.src;
    const starts = geom.map((e) => e.points[0]);
    // all on the bottom side, inside its middle 70%, all different
    for (const [x, y] of starts) {
      expect(y).toBe(src[1] + src[3]);
      expect(x).toBeGreaterThanOrEqual(src[0] + src[2] * 0.15 - 1e-6);
      expect(x).toBeLessThanOrEqual(src[0] + src[2] * 0.85 + 1e-6);
    }
    expect(new Set(starts.map((p) => p[0])).size).toBe(starts.length);
    const byStart = [...geom].sort((p, q) => p.points[0][0] - q.points[0][0]).map((e) => e.to);
    const byTarget = [...geom].sort((p, q) => boxes[p.to][0] - boxes[q.to][0]).map((e) => e.to);
    expect(byStart).toEqual(byTarget);
  });

  it("gives parallel runs lanes of their own: no two edges share a stretch of line", () => {
    const { boxes, doc } = fan();
    const geom = edgeGeometry(doc, boxes, {}, {}, {}, ORTHO);
    const runs = geom.map((e) => segments(e.points));
    for (let i = 0; i < runs.length; i++)
      for (let j = i + 1; j < runs.length; j++)
        for (const [p, q] of runs[i])
          for (const [r, s] of runs[j]) {
            const flat = (a, b) => Math.abs(a[1] - b[1]) < 1e-6;
            if (flat(p, q) && flat(r, s) && Math.abs(p[1] - r[1]) < 1e-6) {
              const lo = Math.max(Math.min(p[0], q[0]), Math.min(r[0], s[0]));
              const hi = Math.min(Math.max(p[0], q[0]), Math.max(r[0], s[0]));
              expect(hi - lo, `${geom[i].to} and ${geom[j].to} share y=${p[1]}`).toBeLessThan(1);
            }
            const tall = (a, b) => Math.abs(a[0] - b[0]) < 1e-6;
            if (tall(p, q) && tall(r, s) && Math.abs(p[0] - r[0]) < 1e-6) {
              const lo = Math.max(Math.min(p[1], q[1]), Math.min(r[1], s[1]));
              const hi = Math.min(Math.max(p[1], q[1]), Math.max(r[1], s[1]));
              expect(hi - lo, `${geom[i].to} and ${geom[j].to} share x=${p[0]}`).toBeLessThan(1);
            }
          }
  });

  it("arrives square to the target's side, so the arrowhead points straight in", () => {
    const { boxes, doc } = fan();
    for (const e of edgeGeometry(doc, boxes, {}, {}, {}, ORTHO)) {
      const [p, q] = e.points.slice(-2);
      const b = boxes[e.to];
      expect(q[1]).toBe(b[1]);
      expect(p[0]).toBeCloseTo(q[0], 6);
      expect(p[1]).toBeLessThan(q[1]);
    }
  });

  it("draws a lone edge between stacked boxes as one straight line", () => {
    const doc = {
      nodes: [
        { id: "a", component: "x" },
        { id: "b", component: "x" },
      ],
      edges: [{ from: "a", to: "b", protocol: "https", mode: "sync" }],
    };
    const [e] = edgeGeometry(doc, { a: [0, 0, W, H], b: [20, 200, W, H] }, {}, {}, {}, ORTHO);
    expect(e.points).toHaveLength(2);
    expect(e.points[0][0]).toBe(e.points[1][0]);
  });

  it("joins boxes side by side right to left", () => {
    const doc = {
      nodes: [
        { id: "a", component: "x" },
        { id: "b", component: "x" },
      ],
      edges: [{ from: "a", to: "b", protocol: "https", mode: "sync" }],
    };
    const [e] = edgeGeometry(doc, { a: [0, 0, W, H], b: [400, 60, W, H] }, {}, {}, {}, ORTHO);
    expect(e.points[0][0]).toBe(W);
    expect(e.points.at(-1)[0]).toBe(400);
    expect(e.run?.axis).toBe("x");
  });

  it("starts exactly at a port someone placed, leaving along its side", () => {
    const { boxes, doc } = fan();
    const port = { side: "right", t: 0.3 };
    const ports = { "src>t4": { from: port } };
    const geom = edgeGeometry(doc, boxes, {}, ports, {}, ORTHO);
    const e = geom.find((g) => g.to === "t4");
    expect(e.points[0]).toEqual(portPoint(boxes.src, port));
    expect(e.points[1][1]).toBe(e.points[0][1]);
    expect(e.points[1][0]).toBeGreaterThan(e.points[0][0]);
    for (const [id, b] of Object.entries(boxes)) {
      if (id === "src" || id === "t4") continue;
      for (const s of segments(e.points)) expect(through(s, b)).toBe(false);
    }
  });

  it("moves the cross run under the pointer with a bow, and nowhere else", () => {
    const doc = {
      nodes: [
        { id: "a", component: "x" },
        { id: "b", component: "x" },
      ],
      edges: [{ from: "a", to: "b", protocol: "https", mode: "sync" }],
    };
    const boxes = { a: [0, 0, W, H], b: [400, 300, W, H] };
    const [plain] = edgeGeometry(doc, boxes, {}, {}, {}, ORTHO);
    expect(plain.run?.axis).toBe("y");
    const bow = orthoBowAt(plain, 999, plain.run.base + 30);
    expect(bow).toBe(30);
    const [bowed] = edgeGeometry(doc, boxes, { "a>b": bow }, {}, {}, ORTHO);
    expect(bowed.points[1][1]).toBe(plain.points[1][1] + 30);
    expect(bowed.points[0]).toEqual(plain.points[0]);
    expect(bowed.points.at(-1)).toEqual(plain.points.at(-1));
  });

  it("puts the label on the longest run, clear of its corners", () => {
    const { boxes, doc } = fan();
    doc.edges[0].label = "token";
    const e = edgeGeometry(doc, boxes, {}, {}, {}, ORTHO)[0];
    const longest = Math.max(
      ...segments(e.points).map(([p, q]) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1])),
    );
    const on = segments(e.points).find(
      ([p, q]) =>
        Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) === longest &&
        Math.abs((p[0] + q[0]) / 2 - e.mid[0]) < 1e-6 &&
        Math.abs((p[1] + q[1]) / 2 - e.mid[1]) < 1e-6,
    );
    expect(on).toBeTruthy();
    expect(e.label).toBe("token");
  });

  it("rounds its corners, and draws the last run straight into the target", () => {
    const { boxes, doc } = fan();
    const e = edgeGeometry(doc, boxes, {}, {}, {}, ORTHO).find((g) => g.points.length > 2);
    const d = edgePath(e);
    expect(d).toMatch(/^M[\d.-]+ [\d.-]+ L/);
    expect(d).toMatch(/ Q/);
    const [x, y] = e.points.at(-1);
    expect(d.endsWith(`L${x.toFixed(1)} ${y.toFixed(1)}`)).toBe(true);
    expect(ORTHO_RADIUS).toBe(8);
  });

  it("runs a member straight out to its own group's border, on the nearest side", () => {
    const doc = {
      nodes: [{ id: "api", component: "x", group: "g" }],
      edges: [{ from: "api", to: "g", protocol: "https", mode: "sync" }],
      groups: [{ id: "g", kind: "system" }],
    };
    const boxes = { api: [100, 100, W, H] };
    // The frame's border is nearest on the left: the line runs straight out to it.
    const frames = { g: [50, 40, 300, 250] };
    const [e] = edgeGeometry(doc, boxes, {}, {}, frames, ORTHO);
    expect(e.points).toEqual([
      [100, 139],
      [50, 139],
    ]);
    // and the frame groupFrames draws around it holds it, ends and all
    const [own] = edgeGeometry(doc, boxes, {}, {}, groupFrames(doc, boxes), ORTHO);
    expect(own.points).toHaveLength(2);
  });

  it("puts a port on a frame exactly as on a node", () => {
    const doc = {
      nodes: [
        { id: "lb", component: "x" },
        { id: "api", component: "x", group: "g" },
      ],
      edges: [{ from: "lb", to: "g", protocol: "https", mode: "sync" }],
      groups: [{ id: "g", kind: "system" }],
    };
    const lay = drawnLayout(doc, catalogue, {
      nodes: { lb: [0, 0], api: [300, 200] },
      ports: { "lb>g": { to: { side: "left", t: 0.5 } } },
    });
    const f = lay.frames.g;
    const e = lay.edges[0];
    expect(e.ortho).toBe(true);
    expect(e.points.at(-1)).toEqual([f[0], f[1] + f[3] * 0.5]);
  });

  it("is what the automatic layout, the drawn layout and the SVG draw unless told otherwise", () => {
    const { doc } = fan();
    const lay = layout(doc, catalogue);
    expect(lay.edges.every((e) => e.ortho)).toBe(true);
    const nodes = {};
    for (const [id, p] of Object.entries(lay.positions)) nodes[id] = p;
    expect(drawnLayout(doc, catalogue, { nodes }).edges.every((e) => e.ortho)).toBe(true);
    const svg = toSvg(doc, catalogue, { layout: { nodes, edges: {} }, theme: "light" });
    expect(svg).not.toMatch(/<path d="M[^"]* C/);
    expect(svg).not.toMatch(/<line /);
  });

  it("draws curves, unchanged, when the sidecar says curved", () => {
    const doc = {
      nodes: [
        { id: "a", component: "x" },
        { id: "c", component: "x" },
      ],
      edges: [{ from: "a", to: "c", protocol: "https", mode: "sync" }],
    };
    const [e] = edgeGeometry(
      doc,
      { a: [0, 0, 126, 78], c: [40, 240, 140, 78] },
      {},
      {},
      {},
      { routing: "curved" },
    );
    expect(e.ortho).toBeUndefined();
    expect(e.points).toEqual([
      [70.6375, 78],
      [102.3625, 240],
    ]);
    const { doc: big } = fan();
    const nodes = layout(big, catalogue).positions;
    const curved = drawnLayout(big, catalogue, { nodes, routing: "curved" });
    expect(curved.edges.some((g) => g.ortho)).toBe(false);
    const svg = toSvg(big, catalogue, { layout: { nodes, edges: {}, routing: "curved" } });
    expect(svg).not.toMatch(/ L[\d.]+ [\d.]+ Q/);
    // a sidecar that only says curved still draws curves on the automatic layout
    const auto = toSvg(big, catalogue, { layout: { routing: "curved" } });
    expect(auto).toBe(toSvg(big, catalogue, { routing: "curved" }));
  });

  // A group whose caption is wider than its one member, with an edge from above to the member
  // and one to the group itself: neither may run through the caption's words.
  const captioned = () => {
    const doc = {
      nodes: [
        { id: "api", component: "x" },
        { id: "worker", component: "x", group: "jobs" },
      ],
      edges: [
        { from: "api", to: "worker", protocol: "https", mode: "async" },
        { from: "api", to: "jobs", protocol: "https", mode: "sync" },
      ],
      groups: [{ id: "jobs", kind: "system", label: "Background Jobs & Triggers" }],
    };
    const boxes = { api: [200, 0, W, H], worker: [60, 240, W, H] };
    const captions = frameCaptions(doc);
    const frames = groupFrames(doc, boxes, captions);
    const f = frames.jobs;
    const c = captions.jobs;
    const words = [f[0] + 12, f[1] + 6, c.width - 24, 14 + c.extra];
    return { doc, boxes, frames, captions, words };
  };

  it("never runs through a group's caption, to a member or to the group", () => {
    const { doc, boxes, frames, captions, words } = captioned();
    const geom = edgeGeometry(doc, boxes, {}, {}, frames, { ...ORTHO, captions });
    expect(geom).toHaveLength(2);
    for (const e of geom)
      for (const s of segments(e.points))
        expect(through(s, words), `${e.key} cuts the caption`).toBe(false);
    // the group is entered clear of the words: on its top side beside them, or on another side
    const toGroup = geom.find((e) => e.to === "jobs");
    const [x, y] = toGroup.points.at(-1);
    const f = frames.jobs;
    if (y === f[1]) expect(x < words[0] || x > words[0] + words[2]).toBe(true);
    else expect(x === f[0] || x === f[0] + f[2] || y === f[1] + f[3]).toBe(true);
    // a frame with room beside its caption is entered from the top, right of the words
    const wide = { ...boxes, other: [300, 240, W, H] };
    const wdoc = { ...doc, nodes: [...doc.nodes, { id: "other", component: "x", group: "jobs" }] };
    const wcaps = frameCaptions(wdoc);
    const wframes = groupFrames(wdoc, wide, wcaps);
    const top = edgeGeometry(wdoc, wide, {}, {}, wframes, { ...ORTHO, captions: wcaps }).find(
      (e) => e.to === "jobs",
    );
    const [tx, ty] = top.points.at(-1);
    expect(ty).toBe(wframes.jobs[1]);
    expect(tx).toBeGreaterThan(wframes.jobs[0] + 12 + wcaps.jobs.width - 24);
    // without the captions the member's edge would have dropped through them
    const blind = edgeGeometry(doc, boxes, {}, {}, frames, ORTHO).find((e) => e.to === "worker");
    expect(segments(blind.points).some((s) => through(s, words))).toBe(true);
  });

  it("keeps a label off the boxes it is told to avoid, such as a note", () => {
    const doc = {
      nodes: [
        { id: "a", component: "x" },
        { id: "b", component: "x" },
      ],
      edges: [{ from: "a", to: "b", protocol: "https", mode: "sync" }],
    };
    const boxes = { a: [0, 0, W, H], b: [400, 300, W, H] };
    const [plain] = edgeGeometry(doc, boxes, {}, {}, {}, ORTHO);
    const [lx, ly] = plain.labelAt;
    const note = [lx - 40, ly - 20, 80, 30];
    const [moved] = edgeGeometry(doc, boxes, {}, {}, {}, { ...ORTHO, labelAvoid: [note] });
    const [mx, my] = moved.labelAt;
    const inside = mx > note[0] && mx < note[0] + note[2] && my > note[1] && my < note[1] + note[3];
    expect(inside).toBe(false);
    expect(moved.points).toEqual(plain.points);
  });
});
