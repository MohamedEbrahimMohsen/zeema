// A new design starts with no nodes and no edges (the web app's /new). Every stage of the engine
// takes it: it parses and round-trips, the structure gate lets it through, the rules have nothing
// to say, the layout is empty and the drawing is a small blank page with a finite viewBox.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalize } from "../src/document.js";
import { layout } from "../src/layout.js";
import { toSvg } from "../src/render.js";
import { runRules } from "../src/rules.js";
import { check } from "../src/structure.js";
import { parse, serialize } from "../src/yaml.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogue = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));
// The repository's own design schema, not only the fixture's copy of it.
const schema = JSON.parse(
  fs.readFileSync(path.join(here, "..", "..", "..", "schema", "design.schema.json"), "utf8"),
);

const TEXT = `schemaVersion: "1"
type: "design"
id: "new-design"
nodes: []
edges: []
`;

describe("an empty design", () => {
  const parsed = parse(TEXT);
  const doc = normalize(parsed.doc).doc;

  it("parses to empty lists and serialises back byte for byte", () => {
    expect(parsed.doc.nodes).toEqual([]);
    expect(parsed.doc.edges).toEqual([]);
    expect(serialize(parsed.cst, parsed.doc)).toBe(TEXT);
  });

  it("is not a structural error, under the fixture or the repository schema", () => {
    expect(check(doc, catalogue, { file: "new-design" })).toEqual([]);
    expect(check(doc, { ...catalogue, schema }, { file: "new-design" })).toEqual([]);
  });

  it("gives the rules nothing blocking to report", () => {
    const findings = runRules(doc, catalogue);
    expect(findings.every((f) => f.severity !== "error")).toBe(true);
  });

  it("lays out to nothing", () => {
    const result = layout(doc, catalogue);
    expect(result.positions).toEqual({});
    expect(result.sizes).toEqual({});
    expect(result.edges).toEqual([]);
    expect(result.canvas.every((n) => Number.isFinite(n) && n > 0)).toBe(true);
  });

  it("draws a blank page with a finite, positive viewBox", () => {
    for (const theme of ["light", "dark"]) {
      const svg = toSvg(doc, catalogue, { theme });
      const box = /viewBox="([^"]+)"/.exec(svg)?.[1].split(" ").map(Number);
      expect(box).toHaveLength(4);
      expect(box.every(Number.isFinite)).toBe(true);
      expect(box[2]).toBeGreaterThan(0);
      expect(box[3]).toBeGreaterThan(0);
      expect(svg).not.toMatch(/NaN|Infinity/);
    }
  });

  it("draws the same with an empty layout sidecar", () => {
    const svg = toSvg(doc, catalogue, {
      theme: "light",
      layout: { nodes: {}, edges: {}, notes: [], frames: {} },
    });
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
});
