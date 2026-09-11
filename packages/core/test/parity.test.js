// Parity with the previous engine, frozen as golden.json at the moment of the transplant:
// structural messages, rule findings (id, severity, message) and every node placement for all
// 28 committed designs. A behaviour change here is either a bug fix that must update the golden
// on purpose, or a regression.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalize } from "../src/document.js";
import { layout } from "../src/layout.js";
import { runRules } from "../src/rules.js";
import { check } from "../src/structure.js";
import { parse } from "../src/yaml.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..", "..");
const golden = JSON.parse(fs.readFileSync(path.join(here, "golden.json"), "utf8"));
const catalogue = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));

const files = Object.keys(golden).filter((rel) => fs.existsSync(path.join(ROOT, rel)));

describe("golden parity", () => {
  it("covers the committed designs", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const rel of files) {
    const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    const doc = normalize(parse(text).doc).doc;
    const want = golden[rel];

    it(`${rel}: structural messages`, () => {
      expect(check(doc, catalogue).map((f) => f.message)).toEqual(want.structural);
    });

    it(`${rel}: rule findings`, () => {
      const got = runRules(doc, catalogue)
        .map((f) => ({ id: f.id, severity: f.severity, message: f.message }))
        .sort((a, b) => (a.id + a.message).localeCompare(b.id + b.message));
      expect(got).toEqual(want.rules);
    });

    it(`${rel}: layout positions and sizes`, () => {
      const lay = layout(doc, catalogue);
      expect(lay.positions).toEqual(want.positions);
      expect(lay.sizes).toEqual(want.sizes);
    });
  }
});
