// A component tint and a tint's strength: presentation carried by the layout sidecar (`tints`
// for components, `strength` on a frame or a tint), drawn by the one renderer. A design with
// neither renders exactly as before (golden.json and frame-style.test.js hold that).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readStrength, readTint, TINT_FILL_ALPHA, tintPaint, toSvg } from "../src/render.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogue = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));

const doc = {
  id: "tinted",
  nodes: [
    { id: "web", component: "container-service", group: "vpc" },
    { id: "db", component: "container-service" },
  ],
  edges: [{ from: "web", to: "db", protocol: "https", mode: "sync" }],
  groups: [{ id: "vpc", kind: "vpc", label: "Main" }],
};
const nodes = { web: [0, 0], db: [400, 0] };
const overlays = (svg) => svg.match(/<rect data-tint[^>]*rx="12"[^>]*\/>/g) ?? [];

describe("tintPaint", () => {
  it("leaves a named tint at normal strength to the [data-tint] rules", () => {
    expect(tintPaint("blue")).toEqual({ data: "blue", style: null });
    expect(tintPaint("blue", "normal")).toEqual({ data: "blue", style: null });
  });
  it("writes a hex tint inline, at the frames' alpha", () => {
    expect(tintPaint("#AABBCC")).toEqual({
      data: "hex",
      style: `stroke:#aabbcc;fill:#aabbcc${TINT_FILL_ALPHA}`,
    });
  });
  it("halves the fill for light and doubles it for bold", () => {
    expect(tintPaint("blue", "light").style).toBe(
      "stroke:var(--tint-blue);fill:var(--tint-blue);fill-opacity:0.04",
    );
    expect(tintPaint("#112233", "bold").style).toBe(
      "stroke:#112233;fill:#112233;fill-opacity:0.16",
    );
  });
  it("refuses what is not a tint or a strength", () => {
    expect(tintPaint("chartreuse")).toBeNull();
    expect(tintPaint("#abc")).toBeNull();
    expect(readTint("constructor")).toBeNull();
    expect(readStrength("heavy")).toBeNull();
    expect(readStrength("normal")).toBeNull();
    expect(tintPaint("blue", "heavy")).toEqual({ data: "blue", style: null });
  });
});

describe("component tint", () => {
  it("draws nothing extra without one", () => {
    const svg = toSvg(doc, catalogue, { layout: { nodes, edges: {} }, theme: "light" });
    expect(overlays(svg)).toHaveLength(0);
    expect(svg).not.toContain("--tint-");
  });

  it("lays a tinted rect over the card, before the words, and carries the tokens", () => {
    const svg = toSvg(doc, catalogue, {
      layout: { nodes, edges: {}, tints: { web: { tint: "green" } } },
      theme: "dark",
    });
    const [rect] = overlays(svg);
    expect(rect).toContain('data-tint="green"');
    expect(rect).toContain('x="0" y="0"');
    expect(svg).toContain("--tint-green:#4ade80");
    expect(svg).toContain('[data-tint="green"]{stroke:var(--tint-green)');
    // the card underneath stays the neutral, opaque one
    const body = svg.indexOf('<rect class="body" x="0" y="0"');
    expect(body).toBeGreaterThan(-1);
    expect(svg.indexOf(rect)).toBeGreaterThan(body);
    expect(svg.indexOf('<text class="n"', body)).toBeGreaterThan(svg.indexOf(rect));
  });

  it("applies a strength to a component and to a frame, and ignores unknown ids", () => {
    const svg = toSvg(doc, catalogue, {
      layout: {
        nodes,
        edges: {},
        tints: { db: { tint: "#336699", strength: "bold" }, ghost: { tint: "blue" } },
        frames: { vpc: { tint: "amber", strength: "light" } },
      },
      theme: "light",
    });
    expect(svg).toContain('data-tint="hex" style="stroke:#336699;fill:#336699;fill-opacity:0.16"');
    expect(svg).toContain(
      'data-tint="amber" style="stroke:var(--tint-amber);fill:var(--tint-amber);fill-opacity:0.04"',
    );
    expect(overlays(svg)).toHaveLength(1);
  });
});
