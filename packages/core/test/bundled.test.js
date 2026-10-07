// Bundled routing (`routing: "bundled"`): orthogonal routing in which the edges that fan out of
// one side of a box share one trunk before they split, and the edges that fan into one side of a
// box merge onto one trunk before they meet it. Members overlap exactly; anything with a port, a
// bow or waypoints routes on its own, as does a member whose runs would cut a box.
import { describe, expect, it } from "vitest";
import { edgeGeometry, ROUTINGS, readRouting } from "../src/geometry.js";

const W = 150,
  H = 56;
const BUNDLED = { routing: "bundled" };
const ORTHO = { routing: "orthogonal" };

// One box on the left, a column of four on the right, like the mock's workers and their sinks.
const fanOut = () => {
  const boxes = { src: [0, 250, W, H] };
  const edges = [];
  for (let k = 0; k < 4; k++) {
    boxes[`t${k}`] = [420, 40 + k * 140, W, H];
    edges.push({ from: "src", to: `t${k}`, protocol: "https", mode: "sync" });
  }
  return { boxes, doc: { edges } };
};
// The mirror: four sources on the left into one box on the right.
const fanIn = () => {
  const boxes = { dst: [420, 250, W, H] };
  const edges = [];
  for (let k = 0; k < 4; k++) {
    boxes[`s${k}`] = [0, 40 + k * 140, W, H];
    edges.push({ from: `s${k}`, to: "dst", protocol: "https", mode: "sync" });
  }
  return { boxes, doc: { edges } };
};

const segments = (points) => points.slice(1).map((p, k) => [points[k], p]);
const through = ([p, q], b) =>
  Math.max(p[0], q[0]) > b[0] + 0.5 &&
  Math.min(p[0], q[0]) < b[0] + b[2] - 0.5 &&
  Math.max(p[1], q[1]) > b[1] + 0.5 &&
  Math.min(p[1], q[1]) < b[1] + b[3] - 0.5;
// The x of each vertical run that is not the first or the last.
const trunkXs = (drawn) =>
  drawn.flatMap((d) =>
    segments(d.points)
      .slice(1, -1)
      .filter(([p, q]) => p[0] === q[0])
      .map(([p]) => p[0]),
  );

describe("bundled routing", () => {
  it("is a routing a sidecar may ask for, never the default", () => {
    expect(ROUTINGS).toContain("bundled");
    expect(readRouting("bundled")).toBe("bundled");
    expect(readRouting(undefined)).toBe("orthogonal");
  });

  it("draws a fan-out from one point along one trunk", () => {
    const { boxes, doc } = fanOut();
    const drawn = edgeGeometry(doc, boxes, {}, {}, {}, BUNDLED);
    expect(drawn.every((d) => d.ortho)).toBe(true);
    const starts = new Set(drawn.map((d) => d.points[0].join(",")));
    expect(starts.size).toBe(1);
    const xs = new Set(trunkXs(drawn));
    expect(xs.size).toBe(1);
    // the trunk is between the two columns, clear of both
    const [x] = [...xs];
    expect(x).toBeGreaterThan(W + 16);
    expect(x).toBeLessThan(420 - 16);
    // the plain orthogonal style spreads the same edges over four starts
    const plain = edgeGeometry(doc, boxes, {}, {}, {}, ORTHO);
    expect(new Set(plain.map((d) => d.points[0].join(","))).size).toBe(4);
  });

  it("overlaps exactly: the same corner, the same run, to the pixel", () => {
    const { boxes, doc } = fanOut();
    const drawn = edgeGeometry(doc, boxes, {}, {}, {}, BUNDLED);
    // the two edges heading up share their step out and the trunk up to the nearer target
    const up = drawn.filter((d) => d.points.at(-1)[1] < 250);
    expect(up).toHaveLength(2);
    expect(up[0].points[1]).toEqual(up[1].points[1]);
    expect(up[0].points[0]).toEqual(up[1].points[0]);
  });

  it("merges a fan-in onto one trunk that meets its box at one point", () => {
    const { boxes, doc } = fanIn();
    const drawn = edgeGeometry(doc, boxes, {}, {}, {}, BUNDLED);
    expect(new Set(drawn.map((d) => d.points.at(-1).join(","))).size).toBe(1);
    expect(new Set(trunkXs(drawn)).size).toBe(1);
  });

  it("never cuts a box", () => {
    for (const make of [fanOut, fanIn]) {
      const { boxes, doc } = make();
      // a box in the channel at the trunk's middle: the trunk moves to a free band
      boxes.wall = [250, 0, 40, 60];
      const drawn = edgeGeometry(doc, boxes, {}, {}, {}, BUNDLED);
      for (const d of drawn)
        for (const s of segments(d.points))
          for (const [id, b] of Object.entries(boxes))
            if (id !== d.from && id !== d.to) expect(through(s, b)).toBe(false);
    }
  });

  it("leaves a ported or bowed edge out of the bundle", () => {
    const { boxes, doc } = fanOut();
    const ports = { "src>t0": { from: { side: "right", t: 0.2 } } };
    const bows = { "src>t3": 30 };
    const drawn = edgeGeometry(doc, boxes, bows, ports, {}, BUNDLED);
    const shared = drawn.filter((d) => d.to === "t1" || d.to === "t2");
    expect(shared[0].points[0]).toEqual(shared[1].points[0]);
    expect(drawn[0].points[0]).toEqual([W, 250 + H * 0.2]);
    expect(drawn[0].points[0]).not.toEqual(shared[0].points[0]);
    expect(drawn[3].points[0]).not.toEqual(shared[0].points[0]);
  });

  it("bundles ends pinned to one port, as wires drawn from one port dot are", () => {
    const { boxes, doc } = fanOut();
    const ports = {};
    for (const e of doc.edges)
      ports[`${e.from}>${e.to}`] = {
        from: { side: "right", t: 0.5 },
        to: { side: "left", t: 0.5 },
      };
    const drawn = edgeGeometry(doc, boxes, {}, ports, {}, BUNDLED);
    expect(new Set(drawn.map((d) => d.points[0].join(","))).size).toBe(1);
    expect(new Set(trunkXs(drawn)).size).toBe(1);
    // a port on a side that does not face the shared one keeps that edge out
    ports["src>t1"] = { from: { side: "right", t: 0.5 }, to: { side: "top", t: 0.5 } };
    const mixed = edgeGeometry(doc, boxes, {}, ports, {}, BUNDLED);
    expect(mixed[1].points.at(-1)).toEqual([420 + W / 2, 180]);
    expect(new Set(trunkXs(mixed.filter((d) => d.to !== "t1"))).size).toBe(1);
  });

  it("does not bundle boxes too close to have a channel between them", () => {
    const boxes = { src: [0, 0, W, H], a: [W + 20, -100, W, H], b: [W + 20, 100, W, H] };
    const doc = {
      edges: [
        { from: "src", to: "a", protocol: "x", mode: "sync" },
        { from: "src", to: "b", protocol: "x", mode: "sync" },
      ],
    };
    const bundled = edgeGeometry(doc, boxes, {}, {}, {}, BUNDLED);
    const plain = edgeGeometry(doc, boxes, {}, {}, {}, ORTHO);
    expect(bundled.map((d) => d.points)).toEqual(plain.map((d) => d.points));
  });

  it("bundles a group's frame like a box: a group edge fans out from its border", () => {
    const boxes = { a: [40, 40, W, H], b: [40, 140, W, H] };
    const frames = { pool: [20, 10, W + 40, 210] };
    const targets = { x: [500, 0, W, H], y: [500, 120, W, H], z: [500, 240, W, H] };
    Object.assign(boxes, targets);
    const doc = {
      edges: Object.keys(targets).map((to) => ({ from: "pool", to, protocol: "x", mode: "sync" })),
    };
    const drawn = edgeGeometry(doc, boxes, {}, {}, frames, BUNDLED);
    expect(drawn).toHaveLength(3);
    expect(new Set(drawn.map((d) => d.points[0].join(","))).size).toBe(1);
    expect(drawn[0].points[0][0]).toBe(20 + W + 40);
  });

  it("keeps a trunk on one lane when another edge shares its line", () => {
    const { boxes, doc } = fanOut();
    // a second source below, whose edge to t0 would take the same channel
    boxes.other = [0, 560, W, H];
    doc.edges.push({ from: "other", to: "t0", protocol: "x", mode: "sync" });
    const drawn = edgeGeometry(doc, boxes, {}, {}, {}, BUNDLED);
    const members = drawn.filter((d) => d.from === "src");
    const xs = new Set(trunkXs(members));
    expect(xs.size).toBe(1);
  });
});
