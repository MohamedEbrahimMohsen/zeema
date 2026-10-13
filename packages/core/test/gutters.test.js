// An edge from a module tile of an expanded node to something outside it keeps to the gutters
// between the tiles (geometry.js, "Gutters"): it never crosses a tile, it leaves the node on the
// side that faces the other end, and runs that share a gutter are set apart.
import { describe, expect, it } from "vitest";
import { edgeGeometry, GUTTER_LANE, MODULE_GAP, moduleTiles } from "../src/geometry.js";

const backend = { id: "backend", modules: ["a", "b", "c", "d", "e", "f"].map((id) => ({ id })) };
const laid = moduleTiles(backend, 0);
const node = [0, 0, laid.w, laid.h];
const tiles = Object.fromEntries(
  laid.tiles.map((t) => [`backend/${t.id}`, [node[0] + t.x, node[1] + t.y, t.w, t.h]]),
);
const docOf = (edges) => ({
  nodes: [backend, { id: "out" }],
  edges: edges.map(([from, to]) => ({ from, to, protocol: "https", mode: "sync" })),
});
const draw = (edges, out, routing = "orthogonal", extra = {}) =>
  edgeGeometry(
    docOf(edges),
    { backend: node, out },
    {},
    {},
    {},
    {
      routing,
      moduleBoxes: tiles,
      ...extra,
    },
  );

const E = 0.5;
// Whether the axis-aligned run p→q passes through the inside of box b.
function cuts(p, q, b) {
  const lo = (u) => Math.min(p[u], q[u]);
  const hi = (u) => Math.max(p[u], q[u]);
  return hi(0) > b[0] + E && lo(0) < b[0] + b[2] - E && hi(1) > b[1] + E && lo(1) < b[1] + b[3] - E;
}
const runs = (points) => points.slice(1).map((q, k) => [points[k], q]);
const within = (p, b) =>
  p[0] >= b[0] - E && p[0] <= b[0] + b[2] + E && p[1] >= b[1] - E && p[1] <= b[1] + b[3] + E;
// The side of the node the path leaves it through: the border its first run out of the box
// crosses (a corner on the border is merged into its straight run, so it is worked out).
function exitSide(points) {
  for (let k = 0; k < points.length - 1; k++) {
    const [p, q] = [points[k], points[k + 1]];
    if (!within(p, node) || within(q, node)) continue;
    if (Math.abs(p[1] - q[1]) < 0.01) return q[0] > p[0] ? "right" : "left";
    return q[1] > p[1] ? "bottom" : "top";
  }
  return null;
}

describe("module edges in the gutters", () => {
  it("is laid out on a grid wide enough for two lines in a gutter", () => {
    expect(MODULE_GAP).toBeGreaterThanOrEqual(4 * GUTTER_LANE);
    expect(laid.tiles).toHaveLength(6);
  });

  const outs = {
    right: [laid.w + 240, 40, 140, 78],
    left: [-400, 40, 140, 78],
    bottom: [100, laid.h + 240, 140, 78],
    top: [100, -400, 140, 78],
  };

  for (const [side, out] of Object.entries(outs))
    for (const from of Object.keys(tiles))
      it(`${from} to a node on the ${side} never crosses a tile and leaves on the ${side}`, () => {
        for (const [edge, flip] of [
          [[from, "out"], false],
          [["out", from], true],
        ]) {
          const [d] = draw([edge], out);
          const points = flip ? [...d.points].reverse() : d.points;
          // it starts on its own tile
          expect(within(points[0], tiles[from])).toBe(true);
          // orthogonal all the way
          for (const [p, q] of runs(points))
            expect(Math.abs(p[0] - q[0]) < 0.01 || Math.abs(p[1] - q[1]) < 0.01).toBe(true);
          // no run goes through any tile of the node, its own included
          for (const [p, q] of runs(points))
            for (const b of Object.values(tiles)) expect(cuts(p, q, b)).toBe(false);
          expect(exitSide(points)).toBe(side);
        }
      });

  it("leaves a middle-column tile through the gutters, not across the next column", () => {
    const [d] = draw([["backend/b", "out"]], outs.right);
    expect(d.points.length).toBeGreaterThan(3);
    for (const [p, q] of runs(d.points)) expect(cuts(p, q, tiles["backend/c"])).toBe(false);
  });

  it("sets two edges from neighbouring tiles apart where they share a gutter", () => {
    // b and e are one above the other in the middle column; the other node sits level with the
    // gap between their rows, so both take that gap out to the right.
    const t = tiles["backend/b"];
    const gapY = t[1] + t[3] + MODULE_GAP / 2;
    const out = [laid.w + 240, gapY - 39, 140, 78];
    const [b, e] = draw(
      [
        ["backend/b", "out"],
        ["backend/e", "out"],
      ],
      out,
    );
    const inGap = (d) =>
      runs(d.points).find(
        ([p, q]) =>
          Math.abs(p[1] - q[1]) < 0.01 &&
          Math.abs(p[1] - gapY) <= MODULE_GAP / 2 &&
          Math.min(p[0], q[0]) < node[2] &&
          Math.max(p[0], q[0]) > t[0] + t[2],
      );
    const rb = inGap(b);
    const re = inGap(e);
    expect(rb).toBeTruthy();
    expect(re).toBeTruthy();
    expect(Math.abs(rb[0][1] - re[0][1])).toBeCloseTo(GUTTER_LANE, 5);
    // and neither run touches a tile for being moved
    for (const d of [b, e])
      for (const [p, q] of runs(d.points))
        for (const box of Object.values(tiles)) expect(cuts(p, q, box)).toBe(false);
  });

  it("starts at the tile's port when the end has one", () => {
    const doc = docOf([["backend/b", "out"]]);
    const [d] = edgeGeometry(
      doc,
      { backend: node, out: outs.right },
      {},
      { "backend/b>out": { from: { side: "bottom", t: 0.5 } } },
      {},
      { moduleBoxes: tiles },
    );
    const b = tiles["backend/b"];
    expect(d.points[0]).toEqual([b[0] + b[2] / 2, b[1] + b[3]]);
    expect(exitSide(d.points)).toBe("right");
    for (const [p, q] of runs(d.points))
      for (const box of Object.values(tiles)) expect(cuts(p, q, box)).toBe(false);
  });

  it("keeps stored waypoints for the part outside the node only", () => {
    const doc = docOf([["backend/b", "out"]]);
    const bows = {
      "backend/b>out": {
        via: [
          [150, 70],
          [laid.w + 120, 70],
          [laid.w + 120, 79],
        ],
      },
    };
    const [d] = edgeGeometry(
      doc,
      { backend: node, out: outs.right },
      bows,
      {},
      {},
      {
        moduleBoxes: tiles,
      },
    );
    for (const [p, q] of runs(d.points))
      for (const box of Object.values(tiles)) expect(cuts(p, q, box)).toBe(false);
    // the waypoint outside is kept: the path passes through x = laid.w + 120
    expect(d.points.some((p) => Math.abs(p[0] - (laid.w + 120)) < 0.5)).toBe(true);
  });

  it("leaves a plain edge and a collapsed node as they were", () => {
    const doc = docOf([["backend/b", "out"]]);
    const boxes = { backend: [0, 0, 176, 78], out: outs.right };
    expect(edgeGeometry(doc, boxes, {}, {}, {}, {})).toEqual(
      edgeGeometry(doc, boxes, {}, {}, {}, { moduleBoxes: {} }),
    );
  });
});
