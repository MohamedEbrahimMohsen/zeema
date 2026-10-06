// A dragged edge label: the sidecar's `labels` holds an offset from the label's automatic place.
// The label follows its edge, is drawn centred where it was put, dodges nothing, and the
// automatic labels after it still stay off it. Curved and orthogonal both, and the server render
// draws the same.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { drawnLayout } from "../src/drawn.js";
import { edgeGeometry, labelOffset, rekeyLabels } from "../src/geometry.js";
import { toSvg } from "../src/render.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogue = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));

const doc = {
  edges: [
    { from: "a", to: "b", label: "calls" },
    { from: "b", to: "c", label: "reads" },
  ],
};
const boxes = { a: [0, 0, 126, 78], b: [400, 0, 126, 78], c: [400, 300, 126, 78] };

for (const routing of ["curved", "orthogonal"]) {
  describe(`a dragged label (${routing})`, () => {
    const auto = edgeGeometry(doc, boxes, {}, {}, {}, { routing });

    it("gives every labelled edge the centre its offset is measured from", () => {
      for (const e of auto) expect(e.labelBase).toHaveLength(2);
    });

    it("sits at the automatic centre plus the offset, centred", () => {
      const moved = edgeGeometry(doc, boxes, {}, {}, {}, { routing, labels: { "a>b": [30, -80] } });
      const e = moved.find((m) => m.key === "a>b");
      expect(e.labelBase).toEqual(auto.find((m) => m.key === "a>b").labelBase);
      expect(e.labelAt).toEqual([e.labelBase[0] + 30, e.labelBase[1] - 80]);
      expect(e.labelAnchor).toBe("middle");
      // The other edge's label is untouched.
      const other = moved.find((m) => m.key === "b>c");
      const was = auto.find((m) => m.key === "b>c");
      expect([other.labelAt, other.labelAnchor]).toEqual([was.labelAt, was.labelAnchor]);
    });

    it("follows its edge when a box moves", () => {
      const labels = { "a>b": [10, 40] };
      const shifted = { ...boxes, a: [0, 120, 126, 78] };
      const e = edgeGeometry(doc, shifted, {}, {}, {}, { routing, labels })[0];
      const base = edgeGeometry(doc, shifted, {}, {}, {}, { routing })[0].labelBase;
      expect(e.labelAt).toEqual([base[0] + 10, base[1] + 40]);
    });

    it("ignores a malformed or zero offset", () => {
      for (const bad of [[0, 0], ["1", 2], [Number.NaN, 1], [1], null, { x: 1 }]) {
        const e = edgeGeometry(doc, boxes, {}, {}, {}, { routing, labels: { "a>b": bad } })[0];
        expect([e.labelAt, e.labelAnchor]).toEqual([auto[0].labelAt, auto[0].labelAnchor]);
      }
    });
  });
}

describe("label offsets", () => {
  it("are rounded and clamped", () => {
    expect(labelOffset({ k: [1.4, -2.6] }, "k")).toEqual([1, -3]);
    expect(labelOffset({ k: [5000, -9000] }, "k")).toEqual([2000, -2000]);
    expect(labelOffset({ k: [0.2, -0.3] }, "k")).toBeNull();
    expect(labelOffset({}, "k")).toBeNull();
  });

  it("are skipped by label dodging but still dodged by later automatic labels", () => {
    // Two edges whose labels would sit on the same horizontal run: one placed on top of the
    // other's spot. The placed one stays put; the automatic one moves off it.
    const d = {
      edges: [
        { from: "a", to: "b", label: "first" },
        { from: "c", to: "d", label: "second" },
      ],
    };
    const bx = {
      a: [0, 0, 126, 78],
      b: [400, 0, 126, 78],
      c: [0, 200, 126, 78],
      d: [400, 420, 126, 78],
    };
    const auto = edgeGeometry(d, bx, {}, {}, {}, { routing: "orthogonal" });
    const target = auto[1].labelBase;
    const dx = target[0] - auto[0].labelBase[0];
    const dy = target[1] - auto[0].labelBase[1];
    const moved = edgeGeometry(
      d,
      bx,
      {},
      {},
      {},
      {
        routing: "orthogonal",
        labels: { "a>b": [dx, dy] },
      },
    );
    expect(moved[0].labelAt).toEqual(target);
    expect(moved[1].labelAt).not.toEqual(auto[1].labelAt);
  });

  it("follow their edge through a rename or reverse", () => {
    const before = { edges: [{ from: "a", to: "b" }] };
    const after = { edges: [{ from: "b", to: "a" }] };
    expect(rekeyLabels(before, after, { "a>b": [5, 6] })).toEqual({ "b>a": [5, 6] });
  });
});

describe("the server render", () => {
  const design = {
    id: "labelled",
    nodes: [
      { id: "web", component: "container-service" },
      { id: "db", component: "container-service" },
    ],
    edges: [{ from: "web", to: "db", protocol: "https", mode: "sync", label: "queries" }],
    groups: [],
  };
  const nodes = { web: [0, 0], db: [400, 0] };

  it("draws a dragged label where the canvas does, and grows the picture to hold it", () => {
    const plain = drawnLayout(design, catalogue, { nodes, edges: {} });
    const lay = drawnLayout(design, catalogue, {
      nodes,
      edges: {},
      labels: { "web>db": [0, 300] },
    });
    const e = lay.edges[0];
    expect(e.labelAt).toEqual([e.labelBase[0], e.labelBase[1] + 300]);
    expect(lay.canvas[1]).toBeGreaterThan(plain.canvas[1]);
    const svg = toSvg(design, catalogue, {
      layout: { nodes, edges: {}, labels: { "web>db": [0, 300] } },
      theme: "light",
    });
    expect(svg).toContain(
      `<text class="e" x="${e.labelAt[0].toFixed(1)}" y="${e.labelAt[1].toFixed(1)}" text-anchor="middle">queries</text>`,
    );
  });
});
