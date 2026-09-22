// Edge geometry: one implementation for the canvas, the automatic layout and the server renderer.
// The case that matters most is two edges between the same pair. Request and response are two
// arrows, and they must read as two: two curves in two lanes, each with one arrowhead at its own
// target and its own label, never one line with an arrowhead at each end.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { edgeGeometry, edgeKeys, LANE_STEP, pathOf, rekeyBows } from "../src/geometry.js";
import { layout } from "../src/layout.js";
import { toMermaid, toSvg } from "../src/render.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogue = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));

const A = [0, 0, 126, 78];
const B = [300, 0, 126, 78];
const C = [40, 240, 140, 78];
const centre = (b) => [b[0] + b[2] / 2, b[1] + b[3] / 2];

// Where the drawn curve is halfway along: the quadratic at t = 0.5, or the chord's midpoint.
const halfway = (points) =>
  points.length === 3
    ? [
        points[0][0] / 4 + points[1][0] / 2 + points[2][0] / 4,
        points[0][1] / 4 + points[1][1] / 2 + points[2][1] / 4,
      ]
    : [(points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2];

// On the border of a box, within float noise.
const onBorder = ([x, y], [bx, by, bw, bh]) => {
  const inside = x >= bx - 1e-6 && x <= bx + bw + 1e-6 && y >= by - 1e-6 && y <= by + bh + 1e-6;
  const edge =
    Math.abs(x - bx) < 1e-6 ||
    Math.abs(x - bx - bw) < 1e-6 ||
    Math.abs(y - by) < 1e-6 ||
    Math.abs(y - by - bh) < 1e-6;
  return inside && edge;
};

const edgesOf = (list) => ({ edges: list.map(([from, to, label]) => ({ from, to, label })) });

describe("a reciprocal pair", () => {
  const doc = edgesOf([
    ["a", "b", "request"],
    ["b", "a", "response"],
  ]);
  const [ab, ba] = edgeGeometry(doc, { a: A, b: B });

  it("is two curves with distinct control points", () => {
    expect(ab.points).toHaveLength(3);
    expect(ba.points).toHaveLength(3);
    expect(pathOf(ab.points)).not.toBe(pathOf(ba.points));
    expect(ab.points[1]).not.toEqual(ba.points[1]);
  });

  it("is spread to opposite sides of the axis by mirrored offsets", () => {
    const [, my] = centre(A); // the axis between these two boxes is horizontal
    const dAB = ab.points[1][1] - my;
    const dBA = ba.points[1][1] - my;
    expect(Math.sign(dAB)).toBe(-Math.sign(dBA));
    expect(dAB).toBeCloseTo(-dBA, 6);
    expect(ab.points[1][0]).toBeCloseTo(ba.points[1][0], 6);
  });

  it("puts the two lanes at least 14px apart where they are furthest from the boxes", () => {
    const gap = Math.hypot(
      halfway(ab.points)[0] - halfway(ba.points)[0],
      halfway(ab.points)[1] - halfway(ba.points)[1],
    );
    expect(gap).toBeGreaterThanOrEqual(14);
    expect(gap).toBeGreaterThanOrEqual(LANE_STEP);
  });

  it("starts each curve on its own source and ends it on its own target", () => {
    expect(onBorder(ab.points[0], A)).toBe(true);
    expect(onBorder(ab.points[2], B)).toBe(true);
    expect(onBorder(ba.points[0], B)).toBe(true);
    expect(onBorder(ba.points[2], A)).toBe(true);
    // and the two meet each box at different points, so the arrowheads are two
    expect(ab.points[2]).not.toEqual(ba.points[0]);
    expect(ab.points[0]).not.toEqual(ba.points[2]);
  });

  it("gives each its own label, outside its own curve, on opposite sides", () => {
    expect(ab.label).toBe("request");
    expect(ba.label).toBe("response");
    const [, abMid] = halfway(ab.points);
    const [, baMid] = halfway(ba.points);
    const upper = abMid < baMid ? ab : ba;
    const lower = upper === ab ? ba : ab;
    // The upper lane's label baseline sits above its curve; the lower lane's text (12px, cap
    // height 9) hangs entirely below its curve.
    expect(upper.labelAt[1]).toBeLessThan(halfway(upper.points)[1]);
    expect(lower.labelAt[1] - 9).toBeGreaterThan(halfway(lower.points)[1]);
    expect(lower.labelAt[1] - upper.labelAt[1]).toBeGreaterThan(24);
  });

  it("keeps its keys: one per edge, so each lane has its own bow", () => {
    expect(edgeKeys(doc)).toEqual(["a>b", "b>a"]);
    expect([ab.key, ba.key]).toEqual(["a>b", "b>a"]);
  });

  it("renders as two arrows, each with one arrowhead at its own target, and two labels", () => {
    const design = {
      id: "rr",
      nodes: [
        { id: "a", component: "container-service" },
        { id: "b", component: "container-service" },
      ],
      edges: [
        { from: "a", to: "b", protocol: "https", mode: "sync", label: "request" },
        { from: "b", to: "a", protocol: "https", mode: "sync", label: "response" },
      ],
      groups: [],
    };
    const svg = toSvg(design, catalogue, {
      theme: "light",
      layout: { nodes: { a: [0, 0], b: [300, 0] }, edges: {} },
    });
    const paths = [...svg.matchAll(/<path d="(M[^"]+)"[^>]*marker-end="url\(#a\)"/g)].map(
      (m) => m[1],
    );
    expect(paths).toHaveLength(2);
    expect(paths[0]).not.toBe(paths[1]);
    // The marker sits at the path's end, and each path ends on its own target.
    const end = (d) => d.trim().split(/\s+/).slice(-2).map(Number);
    const sizes = layout(design, catalogue).sizes;
    expect(onBorder(end(paths[0]), [300, 0, ...sizes.b])).toBe(true);
    expect(onBorder(end(paths[1]), [0, 0, ...sizes.a])).toBe(true);
    expect(svg).not.toMatch(/marker-start/);
    expect(svg).toContain(">request</text>");
    expect(svg).toContain(">response</text>");
    // The server draws the same curves the canvas does.
    const geom = edgeGeometry(design, { a: [0, 0, ...sizes.a], b: [300, 0, ...sizes.b] });
    expect(paths).toEqual(geom.map((e) => pathOf(e.points)));
  });

  it("stays two edges in Mermaid", () => {
    const text = toMermaid({
      nodes: [
        { id: "a", component: "x" },
        { id: "b", component: "x" },
      ],
      edges: [
        { from: "a", to: "b", protocol: "https", mode: "sync", label: "request" },
        { from: "b", to: "a", protocol: "https", mode: "sync", label: "response" },
      ],
    });
    expect(text).toContain('n_a -->|"request [https]"| n_b');
    expect(text).toContain('n_b -->|"response [https]"| n_a');
  });
});

describe("parallel edges", () => {
  it("spread a same-direction pair exactly as a reciprocal one", () => {
    const same = edgeGeometry(
      edgesOf([
        ["a", "b"],
        ["a", "b"],
      ]),
      { a: A, b: B },
    );
    const both = edgeGeometry(
      edgesOf([
        ["a", "b"],
        ["b", "a"],
      ]),
      { a: A, b: B },
    );
    expect(same[0].points).toEqual(both[0].points);
    // The second lane is the same curve, only drawn the other way.
    expect(same[1].points).toEqual([...both[1].points].reverse());
  });

  it("puts three edges in three distinct lanes, symmetric about the axis", () => {
    const three = edgeGeometry(
      edgesOf([
        ["a", "b"],
        ["b", "a"],
        ["a", "b"],
      ]),
      { a: A, b: B },
    );
    const mids = three.map((e) => halfway(e.points)[1]);
    expect(new Set(mids.map((y) => y.toFixed(3))).size).toBe(3);
    const sorted = [...mids].sort((p, q) => p - q);
    expect(sorted[1] - sorted[0]).toBeGreaterThanOrEqual(LANE_STEP);
    expect(sorted[2] - sorted[1]).toBeGreaterThanOrEqual(LANE_STEP);
    const axis = centre(A)[1];
    expect(sorted[0] - axis).toBeCloseTo(-(sorted[2] - axis), 6);
    expect(three.map((e) => e.lane)).toEqual([-LANE_STEP, 0, LANE_STEP]);
  });

  it("keeps a reversed lane where it was and still spreads the pair", () => {
    const before = edgesOf([
      ["a", "b"],
      ["b", "a"],
    ]);
    const after = edgesOf([
      ["a", "b"],
      ["a", "b"],
    ]);
    const g0 = edgeGeometry(before, { a: A, b: B });
    const g1 = edgeGeometry(after, { a: A, b: B });
    expect(g1[0].points).toEqual(g0[0].points);
    expect(g1[1].points).toEqual([...g0[1].points].reverse());
  });

  it("re-keys bows by index when an edge is reversed, so the other lane keeps its own", () => {
    const before = edgesOf([
      ["a", "b"],
      ["b", "a"],
    ]);
    const reversedFirst = edgesOf([
      ["b", "a"],
      ["b", "a"],
    ]);
    const bows = { "a>b": 30, "b>a": -50 };
    // Without re-keying, "b>a" would now name the first edge and hand it the second's bow.
    expect(rekeyBows(before, reversedFirst, bows, [0])).toEqual({ "b>a": -30, "b>a#1": -50 });
    // A reversed edge's bow flips sign, so its curve stays exactly where it was.
    const was = edgeGeometry(before, { a: A, b: B }, bows)[0].points;
    const now = edgeGeometry(
      reversedFirst,
      { a: A, b: B },
      rekeyBows(before, reversedFirst, bows, [0]),
    )[0].points;
    expect(now[1][0]).toBeCloseTo(was[1][0], 6);
    expect(now[1][1]).toBeCloseTo(was[1][1], 6);
  });
});

describe("a single edge", () => {
  // The values the geometry produced before lanes existed. A lone edge must not move.
  it("stays straight, centre to centre, clipped at the borders", () => {
    const [e] = edgeGeometry(edgesOf([["a", "b", "x"]]), { a: A, b: B });
    expect(e.points).toEqual([
      [126, 39],
      [300, 39],
    ]);
    expect(e.lane).toBe(0);
    expect(e.labelAt).toEqual([213, 34]);
    expect(e.labelAnchor).toBe("middle");
    const [d] = edgeGeometry(edgesOf([["a", "c"]]), { a: A, c: C });
    expect(d.points).toEqual([
      [70.6375, 78],
      [102.3625, 240],
    ]);
  });

  it("still bends around a box in its way", () => {
    const [e] = edgeGeometry(edgesOf([["a", "b"]]), { a: A, b: B, m: [150, 0, 60, 40] });
    expect(e.points).toEqual([
      [126, 39],
      [213, 115],
      [300, 39],
    ]);
  });

  it("keeps a hand-drawn bow exactly as before", () => {
    const [e] = edgeGeometry(edgesOf([["a", "c"]]), { a: A, c: C }, { "a>c": 80 });
    expect(e.points[0]).toEqual([70.6375, 78]);
    expect(e.points[1][0]).toBeCloseTo(7.991268894874963, 9);
    expect(e.points[1][1]).toBeCloseTo(174.37462650808698, 9);
    expect(e.points[2]).toEqual([102.3625, 240]);
  });
});

describe("one implementation", () => {
  it("routes the automatic layout's edges through edgeGeometry", () => {
    const design = {
      id: "one",
      nodes: [
        { id: "a", component: "container-service" },
        { id: "b", component: "container-service" },
        { id: "c", component: "container-service" },
      ],
      edges: [
        { from: "a", to: "b", protocol: "https", mode: "sync" },
        { from: "b", to: "a", protocol: "https", mode: "async" },
        { from: "b", to: "c", protocol: "https", mode: "sync" },
      ],
      groups: [],
    };
    const lay = layout(design, catalogue);
    const boxes = {};
    for (const n of design.nodes) boxes[n.id] = [...lay.positions[n.id], ...lay.sizes[n.id]];
    expect(lay.edges).toEqual(edgeGeometry(design, boxes));
    expect(lay.edges[0].points).not.toEqual(lay.edges[1].points);
  });
});
