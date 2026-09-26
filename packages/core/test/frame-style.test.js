// Boundary tint and icon: presentation carried by the layout sidecar, drawn by the one renderer.
// A design without them must render exactly as it did before they existed (golden.json holds
// that); these cases pin what a styled boundary looks like.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { drawnLayout } from "../src/drawn.js";
import { framesOuterFirst, framesUnderTint } from "../src/geometry.js";
import { FRAME_ICON_SHIFT, frameIconKey, TINT, TINT_FILL_ALPHA, toSvg } from "../src/render.js";

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

  it("draws a boundary mark from the icon map under its own boundary: key", () => {
    const svg = toSvg(doc, catalogue, {
      layout: { nodes, edges: {}, frames: { vpc: { icon: "boundary:on-premises" } } },
      theme: "light",
      // A kind or component of the same name is a different drawing and is never used for it.
      icons: {
        "boundary:on-premises": GLYPH,
        "on-premises": "<path/>",
        "kind:on-premises": "<g/>",
      },
    });
    expect(svg).toContain(`<svg class="gi"`);
    expect(svg).toContain(GLYPH);
    expect(frameIconKey("boundary:on-premises")).toBe("boundary:on-premises");
    expect(frameIconKey("boundary:On-Premises")).toBeNull();
    expect(frameIconKey("boundary:a/b")).toBeNull();
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

  it("ignores a tint that is neither named nor #rrggbb, and a malformed icon reference", () => {
    const plain = toSvg(doc, catalogue, { layout: { nodes, edges: {} }, theme: "light" });
    const hostile = toSvg(doc, catalogue, {
      layout: {
        nodes,
        edges: {},
        frames: { vpc: { tint: "#f00", icon: "component:../../x" } },
      },
      theme: "light",
      frameIcons: { "component:../../x": "<script/>" },
      icons: { x: "<script/>" },
    });
    expect(hostile).toBe(plain);
    for (const tint of ["#ff000080", "red", "rgb(255,0,0)", '#ff0000"/><script/>', "Blue"])
      expect(
        toSvg(doc, catalogue, {
          layout: { nodes, edges: {}, frames: { vpc: { tint } } },
          theme: "light",
        }),
      ).toBe(plain);
    expect(frameIconKey("component:../../x")).toBeNull();
    expect(frameIconKey("component:aws/aws-lambda")).toBe("aws-lambda");
  });

  it("draws a #rrggbb tint inline, lowercased, with the named tints' fill alpha", () => {
    const svg = toSvg(doc, catalogue, {
      layout: { nodes, edges: {}, frames: { vpc: { tint: "#FF6600" } } },
      theme: "light",
    });
    expect(svg).toContain(
      `<rect data-tint="hex" style="stroke:#ff6600;fill:#ff6600${TINT_FILL_ALPHA}" x=`,
    );
    expect(TINT_FILL_ALPHA).toBe("14");
    // the same bytes in both themes: a free colour is not re-picked for the dark one
    const dark = toSvg(doc, catalogue, {
      layout: { nodes, edges: {}, frames: { vpc: { tint: "#ff6600" } } },
      theme: "dark",
    });
    expect(dark).toContain('style="stroke:#ff6600;fill:#ff660014"');
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

// A tint fills its own boundary and nothing nested in it (draw.io's reading): a boundary inside a
// tinted one lays the page background down first, so its inside is page again, and a tinted
// child shows its own tint over the page rather than over its parent's.
describe("a tint inside a nested boundary", () => {
  const nested = {
    id: "nested",
    nodes: [
      { id: "web", component: "container-service", group: "aks" },
      { id: "db", component: "container-service", group: "cloud" },
    ],
    edges: [{ from: "web", to: "db", protocol: "https", mode: "sync" }],
    groups: [
      { id: "cloud", kind: "vpc", label: "Cloud" },
      { id: "aks", kind: "vpc", label: "AKS", parent: "cloud" },
    ],
  };
  const at = { web: [0, 0], db: [400, 0] };
  const rectOf = (f) =>
    `x="${f[0].toFixed(1)}" y="${f[1].toFixed(1)}" width="${f[2].toFixed(1)}" height="${f[3].toFixed(1)}" rx="14"`;
  const cutAt = (f) => `<rect ${rectOf(f)} fill="var(--bg)"/>`;
  const render = (frames) =>
    toSvg(nested, catalogue, { layout: { nodes: at, edges: {}, frames }, theme: "light" });
  const framesOf = (frames) =>
    drawnLayout(nested, catalogue, { nodes: at, edges: {}, frames }).frames;

  it("gives an untinted child of a tinted parent the page background behind it", () => {
    const f = framesOf({ cloud: { tint: "blue" } });
    const svg = render({ cloud: { tint: "blue" } });
    expect(svg).toContain(cutAt(f.aks));
    expect(svg).not.toContain(cutAt(f.cloud));
    // parent's tint, then the child's background, then the child's own dashed frame
    const parent = svg.indexOf(`<rect data-tint="blue" ${rectOf(f.cloud)}`);
    const cut = svg.indexOf(cutAt(f.aks));
    const child = svg.indexOf(`<rect ${rectOf(f.aks)} fill="none"`);
    expect(parent).toBeGreaterThan(-1);
    expect(cut).toBeGreaterThan(parent);
    expect(child).toBeGreaterThan(cut);
  });

  it("gives a tinted child of a tinted parent the page background under its own tint", () => {
    const f = framesOf({ cloud: { tint: "blue" }, aks: { tint: "green" } });
    const svg = render({ cloud: { tint: "blue" }, aks: { tint: "green" } });
    const cut = svg.indexOf(cutAt(f.aks));
    expect(cut).toBeGreaterThan(svg.indexOf(`<rect data-tint="blue" ${rectOf(f.cloud)}`));
    expect(svg.indexOf(`<rect data-tint="green" ${rectOf(f.aks)}`)).toBeGreaterThan(cut);
  });

  it("leaves an untinted parent of a tinted child unfilled", () => {
    const f = framesOf({ aks: { tint: "rose" } });
    const svg = render({ aks: { tint: "rose" } });
    expect(svg).toContain(`<rect ${rectOf(f.cloud)} fill="none"`);
    expect(svg).not.toContain('rx="14" fill="var(--bg)"');
    expect(svg).toContain(`<rect data-tint="rose" ${rectOf(f.aks)}`);
  });

  it("cuts under a hex-tinted parent exactly as under a named one", () => {
    const f = framesOf({ cloud: { tint: "#ff6600" } });
    const svg = render({ cloud: { tint: "#ff6600" } });
    const parent = svg.indexOf(
      `<rect data-tint="hex" style="stroke:#ff6600;fill:#ff660014" ${rectOf(f.cloud)}`,
    );
    const cut = svg.indexOf(cutAt(f.aks));
    expect(parent).toBeGreaterThan(-1);
    expect(cut).toBeGreaterThan(parent);
    expect(svg).not.toContain(cutAt(f.cloud));
  });

  it("cuts nothing when nothing is tinted", () => {
    expect(render(undefined)).not.toContain('rx="14" fill="var(--bg)"');
  });

  it("paints a parent before its child even when the document lists the child first", () => {
    const flipped = { ...nested, groups: [...nested.groups].reverse() };
    expect(framesOuterFirst(flipped.groups).map((g) => g.id)).toEqual(["cloud", "aks"]);
    expect(framesOuterFirst(nested.groups)).toEqual(nested.groups);
    const svg = toSvg(flipped, catalogue, {
      layout: { nodes: at, edges: {}, frames: { cloud: { tint: "blue" } } },
      theme: "light",
    });
    const f = framesOf({ cloud: { tint: "blue" } });
    expect(svg.indexOf(cutAt(f.aks))).toBeGreaterThan(
      svg.indexOf(`<rect data-tint="blue" ${rectOf(f.cloud)}`),
    );
  });

  it("finds every boundary below a tint, at any depth, and survives a parent loop", () => {
    const groups = [
      { id: "a" },
      { id: "b", parent: "a" },
      { id: "c", parent: "b" },
      { id: "x", parent: "y" },
      { id: "y", parent: "x" },
    ];
    expect([...framesUnderTint(groups, (id) => id === "a")].sort()).toEqual(["b", "c"]);
    expect([...framesUnderTint(groups, () => false)]).toEqual([]);
    expect(framesOuterFirst(groups).map((g) => g.id)).toEqual(["a", "b", "c", "y", "x"]);
  });
});

describe("arrowheads", () => {
  it("are a filled triangle in the edge colour, tip on the end of the path", () => {
    const svg = toSvg(doc, catalogue, { layout: { nodes, edges: {} }, theme: "light" });
    expect(svg).toContain(
      '<marker id="a" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--edge)"/></marker>',
    );
    expect(svg).toMatch(/stroke="var\(--edge\)" stroke-width="1.4"[^>]*marker-end="url\(#a\)"/);
    expect(svg).toContain("--edge:#6b6b72");
    expect(toSvg(doc, catalogue, { layout: { nodes, edges: {} }, theme: "dark" })).toContain(
      "--edge:#a0a0a8",
    );
  });
});
