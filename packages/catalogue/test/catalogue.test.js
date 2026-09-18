// The catalogue gate as a test, plus the bundle's two properties: deterministic and complete.
import { describe, expect, it } from "vitest";
import { renderBundle } from "../src/build.js";
import { designIndex, loadCatalogue } from "../src/index.js";
import { validateRepository } from "../src/validate.js";

describe("repository gate", () => {
  it("passes on the committed repository", () => {
    const lines = [];
    const { ok, problems } = validateRepository(undefined, { log: (l) => lines.push(l) });
    expect(problems).toEqual([]);
    expect(ok).toBe(true);
    expect(lines.some((l) => l.includes("kinds="))).toBe(true);
  }, 120_000);
});

describe("bundle", () => {
  it("is deterministic and complete", () => {
    const a = renderBundle();
    const b = renderBundle();
    expect(a.missing).toEqual([]);
    for (const name of Object.keys(a.texts)) expect(b.texts[name]).toBe(a.texts[name]);
    const cat = JSON.parse(a.texts["catalogue.json"]);
    const live = loadCatalogue();
    expect(Object.keys(cat.kinds).length).toBe(Object.keys(live.kinds).length);
    expect(Object.keys(cat.components).length).toBe(Object.keys(live.components).length);
    expect(cat.rules.length).toBe(live.rules.length);
    const icons = JSON.parse(a.texts["icons.json"]);
    for (const id of Object.keys(cat.components)) expect(icons[id], id).toBeTypeOf("string");
    for (const id of Object.keys(cat.kinds)) expect(icons[`kind:${id}`], id).toBeTypeOf("string");
  }, 120_000);

  it("indexes every design on disk with its tier and writability", () => {
    const index = designIndex(loadCatalogue().root);
    expect(index.length).toBeGreaterThan(20);
    for (const e of index) {
      expect(e.path).toMatch(
        /^designs\/(reference|imported|authored)\/[a-z0-9-]+\/design(\.broken)?\.yaml$/,
      );
      expect(e.editable).toBe(e.tier === "authored" && !e.broken);
    }
  });
});
