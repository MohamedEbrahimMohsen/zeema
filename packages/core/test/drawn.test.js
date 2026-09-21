// Rendering a design as it was drawn: the layout sidecar decides where the boxes are, and the
// automatic layout is what happens when there is no sidecar to read.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { drawnLayout } from "../src/drawn.js";
import { layout } from "../src/layout.js";
import { toSvg } from "../src/render.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogue = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));

const doc = {
  id: "drawn",
  nodes: [
    { id: "web", component: "container-service" },
    { id: "db", component: "container-service" },
  ],
  edges: [{ from: "web", to: "db", protocol: "https", mode: "sync" }],
  groups: [],
};

const overlap = (a, b) =>
  a[0] + a[2] > b[0] && b[0] + b[2] > a[0] && a[1] + a[3] > b[1] && b[1] + b[3] > a[1];

describe("as drawn", () => {
  it("puts every box exactly where the sidecar says", () => {
    const sidecar = { nodes: { web: [-40, 250], db: [600, -120] }, edges: {} };
    const lay = drawnLayout(doc, catalogue, sidecar);
    expect(lay.positions.web).toEqual([-40, 250]);
    expect(lay.positions.db).toEqual([600, -120]);
    const svg = toSvg(doc, catalogue, { layout: sidecar, theme: "light" });
    expect(svg).toContain('x="-40" y="250"');
    expect(svg).toContain('x="600" y="-120"');
    // The coordinates are kept as they were drawn; the viewBox moves to them.
    expect(svg).toMatch(/viewBox="-100 -166 \d+ \d+"/);
  });

  it("honours a group frame computed from where the members were left", () => {
    const grouped = {
      ...doc,
      nodes: [
        { id: "web", component: "container-service", group: "vpc" },
        { id: "db", component: "container-service", group: "vpc" },
      ],
      groups: [{ id: "vpc", kind: "network", label: "VPC" }],
    };
    const lay = drawnLayout(grouped, catalogue, {
      nodes: { web: [0, 0], db: [400, 0] },
      edges: {},
    });
    const f = lay.frames.vpc;
    expect(f[0]).toBe(-16);
    expect(f[1]).toBe(-32);
    expect(f[0] + f[2]).toBe(400 + lay.sizes.db[0] + 16);
  });

  it("places a node the sidecar never saw clear of the ones it did", () => {
    const grown = {
      ...doc,
      nodes: [...doc.nodes, { id: "cache", component: "container-service" }],
      edges: [...doc.edges, { from: "web", to: "cache", protocol: "tcp", mode: "sync" }],
    };
    const lay = drawnLayout(grown, catalogue, {
      nodes: { web: [0, 0], db: [0, 200] },
      edges: {},
    });
    const box = (id) => [...lay.positions[id], ...lay.sizes[id]];
    expect(lay.positions.cache).toBeDefined();
    expect(overlap(box("cache"), box("web"))).toBe(false);
    expect(overlap(box("cache"), box("db"))).toBe(false);
  });

  it("stacks several newcomers rather than piling them on one spot", () => {
    const grown = {
      ...doc,
      nodes: [...doc.nodes, { id: "a", component: "container-service" }],
      edges: doc.edges,
    };
    const lay = drawnLayout(grown, catalogue, { nodes: { web: [0, 0] }, edges: {} });
    const box = (id) => [...lay.positions[id], ...lay.sizes[id]];
    expect(overlap(box("a"), box("db"))).toBe(false);
    expect(overlap(box("a"), box("web"))).toBe(false);
    expect(overlap(box("db"), box("web"))).toBe(false);
  });

  it("falls back to the automatic layout, byte for byte, when there is no sidecar", () => {
    const auto = toSvg(doc, catalogue, { theme: "light" });
    expect(toSvg(doc, catalogue, { theme: "light", layout: null })).toBe(auto);
    expect(toSvg(doc, catalogue, { theme: "light", layout: { nodes: {}, edges: {} } })).toBe(auto);
    const want = layout(doc, catalogue);
    expect(auto).toContain(`viewBox="0 0 ${want.canvas[0]} ${want.canvas[1]}"`);
    expect(auto).toContain(`<rect width="${want.canvas[0]}"`);
    expect(auto).toContain(`x="${want.positions.web[0]}" y="${want.positions.web[1]}"`);
  });
});
