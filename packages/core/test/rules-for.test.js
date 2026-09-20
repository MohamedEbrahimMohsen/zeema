// rulesFor is the one answer to "which rules can fire on a component of this kind". The
// catalogue reference pages and the markdown both call it, so it is tested against the real
// rules on disk rather than a fixture with a made-up shape.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { rulesFor } from "../src/rules.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..", "..");
const read = (dir) =>
  fs
    .readdirSync(path.join(ROOT, dir))
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => YAML.parse(fs.readFileSync(path.join(ROOT, dir, f), "utf8")));

const rules = read("rules");
const kinds = Object.fromEntries(read("kinds").map((k) => [k.id, k]));
const catalogue = { rules, kinds };

describe("rulesFor", () => {
  it("returns only node rules, and only ones that name the kind or its category", () => {
    for (const id of Object.keys(kinds)) {
      const got = rulesFor(catalogue, { kind: id });
      for (const r of got) {
        expect(r.select.node).toBeTruthy();
        const sel = r.select.node;
        if (sel.kind) expect([].concat(sel.kind)).toContain(id);
        if (sel.category) expect([].concat(sel.category)).toContain(kinds[id].category);
      }
    }
  });

  it("never returns an edge or design rule", () => {
    const nodeRuleIds = new Set(rules.filter((r) => r.select?.node).map((r) => r.id));
    const all = new Set(
      Object.keys(kinds).flatMap((id) => rulesFor(catalogue, { kind: id }).map((r) => r.id)),
    );
    for (const id of all) expect(nodeRuleIds.has(id)).toBe(true);
  });

  it("covers every node rule across the whole catalogue of kinds", () => {
    const reached = new Set(
      Object.keys(kinds).flatMap((id) => rulesFor(catalogue, { kind: id }).map((r) => r.id)),
    );
    for (const r of rules.filter((x) => x.select?.node)) expect(reached.has(r.id)).toBe(true);
  });

  it("takes an explicit category when the kind is not in the catalogue", () => {
    const byCategory = rules.filter((r) => r.select?.node?.category);
    if (!byCategory.length) return;
    const cat = [].concat(byCategory[0].select.node.category)[0];
    const got = rulesFor(catalogue, { kind: "not-a-kind", category: cat });
    expect(got.map((r) => r.id)).toContain(byCategory[0].id);
  });
});
