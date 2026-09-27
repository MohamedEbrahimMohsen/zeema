// Edge geometry: one implementation for the canvas, the automatic layout and the server renderer.
// The case that matters most is two edges between the same pair. Request and response are two
// arrows, and they must read as two: two curves in two lanes, each with one arrowhead at its own
// target and its own label, never one line with an arrowhead at each end.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  bowAt,
  edgeGeometry,
  edgeKeys,
  LANE_STEP,
  midpointOf,
  pathOf,
  portAt,
  portNormal,
  portPoint,
  rekeyBows,
  rekeyPorts,
  STUB,
} from "../src/geometry.js";
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
  points.length === 7
    ? midpointOf(points)
    : points.length === 3
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

describe("ports", () => {
  it("names a point on each side, and portAt finds it again", () => {
    expect(portPoint(A, { side: "top", t: 0.25 })).toEqual([31.5, 0]);
    expect(portPoint(A, { side: "right", t: 0.5 })).toEqual([126, 39]);
    expect(portPoint(A, { side: "bottom", t: 1 })).toEqual([126, 78]);
    expect(portPoint(A, { side: "left", t: 0 })).toEqual([0, 0]);
    for (const side of ["top", "right", "bottom", "left"])
      for (const t of [0.1, 0.333, 0.5, 0.9]) {
        const [x, y] = portPoint(B, { side, t });
        expect(portAt(B, x, y)).toEqual({ side, t });
      }
  });

  it("clamps a point off the box onto the nearest side, rounded to 3 decimals", () => {
    expect(portAt(A, 200, 10)).toEqual({ side: "right", t: 0.128 });
    expect(portAt(A, -50, -50)).toEqual({ side: "top", t: 0 });
    expect(portAt(A, 60, 70)).toEqual({ side: "bottom", t: 0.476 });
    expect(portAt(A, 5, 40)).toEqual({ side: "left", t: 0.513 });
  });

  it("puts both ends exactly on their ports", () => {
    const doc = edgesOf([["a", "b"]]);
    const from = { side: "bottom", t: 0.2 };
    const to = { side: "top", t: 0.8 };
    const [e] = edgeGeometry(doc, { a: A, b: B }, {}, { "a>b": { from, to } });
    expect(e.points[0]).toEqual(portPoint(A, from));
    expect(e.points[e.points.length - 1]).toEqual(portPoint(B, to));
  });

  it("clips the unported end toward the ported one's stub tip", () => {
    const from = { side: "bottom", t: 0.5 };
    const [e] = edgeGeometry(edgesOf([["a", "c"]]), { a: A, c: C }, {}, { "a>c": { from } });
    expect(e.points[0]).toEqual([63, 78]);
    // It leaves straight down, along the bottom side's normal, with no straight stub drawn.
    expect(e.points[1][0]).toBe(63);
    expect(e.points[1][1]).toBeGreaterThan(78);
    expect(pathOf(e.points)).not.toMatch(/ L/);
    const end = e.points[e.points.length - 1];
    expect(onBorder(end, C)).toBe(true);
    // On the line from the port's aim point, STUB out along its normal, to C's centre.
    const [px, py] = [63, 78 + STUB];
    const [cx, cy] = centre(C);
    expect((end[0] - px) * (cy - py) - (end[1] - py) * (cx - px)).toBeCloseTo(0, 6);
  });

  it("draws an edge with no ports exactly as before", () => {
    const doc = edgesOf([
      ["a", "b"],
      ["b", "a"],
      ["a", "c"],
    ]);
    const boxes = { a: A, b: B, c: C };
    expect(edgeGeometry(doc, boxes, { "a>c": 40 }, {})).toEqual(
      edgeGeometry(doc, boxes, { "a>c": 40 }),
    );
    expect(edgeGeometry(doc, boxes, {}, { "x>y": { from: { side: "top", t: 0 } } })).toEqual(
      edgeGeometry(doc, boxes),
    );
  });

  it("keeps ported ends in place on a lane and under a bow; only the control point moves", () => {
    const doc = edgesOf([
      ["a", "b"],
      ["b", "a"],
    ]);
    const from = { side: "right", t: 0.2 };
    const to = { side: "left", t: 0.9 };
    const ports = { "a>b": { from, to } };
    const [lane] = edgeGeometry(doc, { a: A, b: B }, {}, ports);
    expect(lane.points).toHaveLength(7);
    expect(lane.points[0]).toEqual(portPoint(A, from));
    expect(lane.points[6]).toEqual(portPoint(B, to));
    const [bowed] = edgeGeometry(doc, { a: A, b: B }, { "a>b": 60 }, ports);
    expect(bowed.points[0]).toEqual(portPoint(A, from));
    expect(bowed.points[6]).toEqual(portPoint(B, to));
    expect(bowed.points.slice(1, 6)).not.toEqual(lane.points.slice(1, 6));
    // bowAt measured from the ports writes back the bow that put the curve there.
    const mid = halfway(bowed.points);
    expect(bowAt({ a: A, b: B }, "a", "b", mid[0], mid[1], { from, to })).toBe(60);
  });

  // Both cubics sampled along their length, for "never enters its box".
  const sampled = (points) => {
    const out = [];
    for (const [p0, p1, p2, p3] of [points.slice(0, 4), points.slice(3, 7)])
      for (let i = 0; i <= 32; i++) {
        const t = i / 32,
          u = 1 - t;
        out.push(
          [0, 1].map(
            (k) => u ** 3 * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t ** 3 * p3[k],
          ),
        );
      }
    return out;
  };
  const strictlyInside = ([x, y], [bx, by, bw, bh]) =>
    x > bx + 1e-6 && x < bx + bw - 1e-6 && y > by + 1e-6 && y < by + bh - 1e-6;

  it("leaves a port on the side facing away outward, and never runs back under its box", () => {
    // C is below-left of B; B's port is on its right side, facing away from C.
    const from = { side: "right", t: 0.5 };
    const [e] = edgeGeometry(edgesOf([["b", "c"]]), { b: B, c: C }, {}, { "b>c": { from } });
    expect(e.points).toHaveLength(7);
    const [[x0, y0], [x1, y1]] = e.points;
    const [nx, ny] = portNormal(from);
    // Its tangent at the port is the outward normal, and only that.
    const l = Math.hypot(x1 - x0, y1 - y0);
    expect(((x1 - x0) * nx + (y1 - y0) * ny) / l).toBeCloseTo(1, 9);
    for (const p of e.points) expect(strictlyInside(p, B)).toBe(false);
    for (const p of sampled(e.points)) expect(strictlyInside(p, B)).toBe(false);
    const d = pathOf(e.points);
    // Two curves, and no straight segment anywhere.
    expect(d).toMatch(/^M\S+ \S+ C[^L]+ C[^L]+$/);
    expect(onBorder(e.points[6], C)).toBe(true);
    // The label sits on the drawn curve.
    expect(e.mid).toEqual(midpointOf(e.points));
  });

  it("routes around its own box when both ports make the middle cut back across it", () => {
    // A's right side, C's top: C is below and to the left of A's stub, and the chord between
    // the two stub tips crosses A.
    const from = { side: "right", t: 0.4 };
    const to = { side: "top", t: 0.3 };
    const [e] = edgeGeometry(edgesOf([["a", "c"]]), { a: A, c: C }, {}, { "a>c": { from, to } });
    for (const p of sampled(e.points)) {
      expect(strictlyInside(p, A)).toBe(false);
      expect(strictlyInside(p, C)).toBe(false);
    }
    expect(e.points[0]).toEqual(portPoint(A, from));
    expect(e.points[6]).toEqual(portPoint(C, to));
  });

  it("arrives at a port along the normal, so the head points squarely in", () => {
    const to = { side: "top", t: 0.5 };
    for (const bows of [{}, { "a>c": 80 }, { "a>c": -140 }]) {
      const [e] = edgeGeometry(edgesOf([["a", "c"]]), { a: A, c: C }, bows, { "a>c": { to } });
      const [, , , , , [x5, y5], [x6, y6]] = e.points;
      const [nx, ny] = portNormal(to);
      const l = Math.hypot(x6 - x5, y6 - y5);
      expect(l).toBeGreaterThan(0);
      // Into the box: against the outward normal, and only along it.
      expect(((x6 - x5) * nx + (y6 - y5) * ny) / l).toBeCloseTo(-1, 9);
      expect(pathOf(e.points)).not.toMatch(/ L/);
    }
  });

  it("is one smooth curve under a bow: no stub, no corner where its two halves meet", () => {
    const from = { side: "bottom", t: 0.5 };
    const to = { side: "top", t: 0.5 };
    const [e] = edgeGeometry(
      edgesOf([["a", "c"]]),
      { a: A, c: C },
      { "a>c": 90 },
      { "a>c": { from, to } },
    );
    const [s, c1, d1, m, d2, c2, end] = e.points;
    const along = (p, q, port) => {
      const [nx, ny] = portNormal(port);
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      return ((q[0] - p[0]) * nx + (q[1] - p[1]) * ny) / l;
    };
    expect(along(s, c1, from)).toBeCloseTo(1, 9);
    expect(along(end, c2, to)).toBeCloseTo(1, 9);
    // d1, m, d2 on one line, m between: the tangent is continuous at the join.
    const cross = (d1[0] - m[0]) * (d2[1] - m[1]) - (d1[1] - m[1]) * (d2[0] - m[0]);
    expect(cross).toBeCloseTo(0, 6);
    expect((d1[0] - m[0]) * (d2[0] - m[0]) + (d1[1] - m[1]) * (d2[1] - m[1])).toBeLessThan(0);
  });

  it("leaves a port on the facing side squarely, and close facing ports never loop back", () => {
    const from = { side: "right", t: 0.5 };
    const to = { side: "left", t: 0.5 };
    const [e] = edgeGeometry(edgesOf([["a", "b"]]), { a: A, b: B }, {}, { "a>b": { from, to } });
    const [[x0, y0], [x1, y1]] = e.points;
    expect(x1 - x0).toBeGreaterThan(0);
    expect(y1).toBe(y0);
    const near = [150, 0, 126, 78];
    const [f] = edgeGeometry(edgesOf([["a", "b"]]), { a: A, b: near }, {}, { "a>b": { from, to } });
    // Facing ports on one line: the curve is that line, left to right.
    for (let i = 1; i < 7; i++) expect(f.points[i][0]).toBeGreaterThanOrEqual(f.points[i - 1][0]);
    expect(f.points[1][0] - f.points[0][0]).toBeGreaterThan(0);
  });

  it("bends a ported edge around an obstacle on its middle part", () => {
    const from = { side: "right", t: 0.5 };
    const to = { side: "left", t: 0.5 };
    const M = [170, 10, 60, 60];
    const [free] = edgeGeometry(edgesOf([["a", "b"]]), { a: A, b: B }, {}, { "a>b": { from, to } });
    const [bent] = edgeGeometry(
      edgesOf([["a", "b"]]),
      { a: A, b: B, m: M },
      {},
      { "a>b": { from, to } },
    );
    expect(bent.points[0]).toEqual(free.points[0]);
    expect(bent.points[6]).toEqual(free.points[6]);
    // Its middle, where the label sits, clears the obstacle as an unported bend would.
    expect(free.mid[1]).toBe(39);
    expect(bent.mid[1]).toBeLessThan(M[1]);
    const [plain] = edgeGeometry(edgesOf([["a", "b"]]), { a: A, b: B, m: M });
    expect(bent.mid[0]).toBeCloseTo(plain.mid[0], 6);
    expect(bent.mid[1]).toBeCloseTo(plain.mid[1], 6);
  });

  it("re-keys ports by index and swaps the ends of a reversed edge", () => {
    const before = edgesOf([
      ["a", "b"],
      ["b", "a"],
    ]);
    const reversedFirst = edgesOf([
      ["b", "a"],
      ["b", "a"],
    ]);
    const top = { side: "top", t: 0.5 };
    const left = { side: "left", t: 0.25 };
    const ports = { "a>b": { from: top }, "b>a": { to: left } };
    expect(rekeyPorts(before, reversedFirst, ports, [0])).toEqual({
      "b>a": { to: top },
      "b>a#1": { to: left },
    });
    const was = edgeGeometry(before, { a: A, b: B }, {}, ports)[0].points;
    const now = edgeGeometry(
      reversedFirst,
      { a: A, b: B },
      {},
      rekeyPorts(before, reversedFirst, ports, [0]),
    )[0].points;
    expect(now[now.length - 1]).toEqual(was[0]);
  });

  it("draws the server render from the same ports", () => {
    const design = {
      id: "ported",
      nodes: [
        { id: "web", component: "container-service" },
        { id: "db", component: "container-service" },
      ],
      edges: [{ from: "web", to: "db", protocol: "https", mode: "sync" }],
      groups: [],
    };
    const from = { side: "bottom", t: 0.25 };
    const sidecar = {
      nodes: { web: [0, 0], db: [400, 0] },
      edges: {},
      ports: { "web>db": { from } },
    };
    const [w, h] = layout(design, catalogue).sizes.web;
    const [x, y] = portPoint([0, 0, w, h], from);
    const svg = toSvg(design, catalogue, { layout: sidecar, theme: "light" });
    // A ported edge is a <path>: a curve straight out of the port, with no stub.
    const start = `d="M${x.toFixed(1)} ${y.toFixed(1)} C${x.toFixed(1)} `;
    expect(svg).toContain(start);
    const plain = toSvg(design, catalogue, {
      layout: { nodes: sidecar.nodes, edges: {} },
      theme: "light",
    });
    expect(plain).not.toContain(start);
  });
});
