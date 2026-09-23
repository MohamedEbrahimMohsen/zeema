// Boundary tint and icon: presentation carried by the layout sidecar, drawn by the one renderer.
// A design without them must render exactly as it did before they existed (golden.json holds
// that); these cases pin what a styled boundary looks like.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { drawnLayout } from "../src/drawn.js";
import { FRAME_ICON_SHIFT, frameIconKey, TINT, toSvg } from "../src/render.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogue = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));

const doc = {
  id: "styled",
  nodes: [
    { id: "web", component: "container-service", group: "vpc" },
    { id: "db", component: "container-service", group: "vpc" },
  ],
  edges: [{ from: "web", to: "db", protocol: "https", mode: "sync" }],
  groups: [{ id: "vpc", kind: "vpc", label: "Main" }],
};
const nodes = { web: [0, 0], db: [400, 0] };
const GLYPH = '<path d="M4 4h16"/>';

const frameOf = (lay) => lay.frames.vpc;
const labelX = (svg) => Number(/<text class="g" x="([-\d.]+)"/.exec(svg)?.[1]);
const tagX = (svg) => Number(/<text class="gk" x="([-\d.]+)"/.exec(svg)?.[1]);

describe("boundary tint and icon", () => {
  it("draws a tinted, iconed boundary with the label moved past the icon", () => {
    const sidecar = { nodes, edges: {}, frames: { vpc: { tint: "blue", icon: "kind:queue" } } };
    const f = frameOf(drawnLayout(doc, catalogue, sidecar));
    const svg = toSvg(doc, catalogue, {
      layout: sidecar,
      theme: "light",
      frameIcons: { "kind:queue": GLYPH },
    });
    expect(svg).toContain('<rect data-tint="blue"');
    expect(svg).toContain(`--tint-blue:${TINT.blue[0]}`);
    expect(svg).toContain('[data-tint="blue"]{stroke:var(--tint-blue);fill:var(--tint-blue-fill)}');
    expect(svg).toContain(`<svg class="gi" x="${(f[0] + 12).toFixed(1)}"`);
    expect(svg).toContain(GLYPH);
    expect(labelX(svg)).toBeCloseTo(f[0] + 12 + FRAME_ICON_SHIFT, 1);
    expect(tagX(svg)).toBeGreaterThan(labelX(svg));
  });

  it("carries both themes' tint tokens when the theme is automatic", () => {
    const svg = toSvg(doc, catalogue, {
      layout: { nodes, edges: {} },
      frames: { vpc: { tint: "rose" } },
    });
    expect(svg).toContain(`--tint-rose:${TINT.rose[0]}`);
    expect(svg).toMatch(
      new RegExp(`prefers-color-scheme: dark\\)\\{:root\\{[^}]*--tint-rose:${TINT.rose[1]}`),
    );
  });

  it("finds an icon body in the component icon map when frameIcons does not have it", () => {
    const svg = toSvg(doc, catalogue, {
      layout: {
        nodes,
        edges: {},
        frames: { vpc: { icon: "component:default/container-service" } },
      },
      theme: "light",
      icons: { "container-service": GLYPH },
    });
    expect(svg).toContain('<svg class="gi"');
    expect(svg).not.toContain("data-tint");
  });

  it("draws no icon and leaves the label where it was when the icon body is missing", () => {
    const plain = toSvg(doc, catalogue, { layout: { nodes, edges: {} }, theme: "light" });
    const missing = toSvg(doc, catalogue, {
      layout: { nodes, edges: {}, frames: { vpc: { icon: "kind:nope" } } },
      theme: "light",
    });
    expect(missing).not.toContain('class="gi"');
    expect(labelX(missing)).toBe(labelX(plain));
    expect(missing).toBe(plain);
  });

  it("ignores a tint outside the set and a malformed icon reference", () => {
    const plain = toSvg(doc, catalogue, { layout: { nodes, edges: {} }, theme: "light" });
    const hostile = toSvg(doc, catalogue, {
      layout: {
        nodes,
        edges: {},
        frames: { vpc: { tint: "#ff0000", icon: "component:../../x" } },
      },
      theme: "light",
      frameIcons: { "component:../../x": "<script/>" },
      icons: { x: "<script/>" },
    });
    expect(hostile).toBe(plain);
    expect(frameIconKey("component:../../x")).toBeNull();
    expect(frameIconKey("component:aws/aws-lambda")).toBe("aws-lambda");
  });

  it("passes the sidecar's styles through the as-drawn layout", () => {
    const lay = drawnLayout(doc, catalogue, {
      nodes,
      edges: {},
      frames: { vpc: { tint: "teal" } },
    });
    expect(lay.frameStyles).toEqual({ vpc: { tint: "teal" } });
    expect(drawnLayout(doc, catalogue, { nodes, edges: {}, frames: [1] }).frameStyles).toEqual({});
  });
});
