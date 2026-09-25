// The automatic layout nests group frames the way the design nests groups: two frames overlap
// only when one group contains the other, a child frame lies inside its parent's, and a node
// lies inside its own group's frame and outside every frame it does not belong to.
// Run over every committed design and broken twin, found on disk.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalize } from "../src/document.js";
import { layout } from "../src/layout.js";
import { parse } from "../src/yaml.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..", "..");
const DESIGNS = path.join(ROOT, "designs");

const files = [];
for (const tier of fs.readdirSync(DESIGNS)) {
  const dir = path.join(DESIGNS, tier);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const id of fs.readdirSync(dir)) {
    for (const name of ["design.yaml", "design.broken.yaml"]) {
      const file = path.join(dir, id, name);
      if (fs.existsSync(file)) files.push(file);
    }
  }
}

const overlap = (a, b) =>
  a[0] + a[2] > b[0] && b[0] + b[2] > a[0] && a[1] + a[3] > b[1] && b[1] + b[3] > a[1];
const inside = (a, b) =>
  a[0] >= b[0] && a[1] >= b[1] && a[0] + a[2] <= b[0] + b[2] && a[1] + a[3] <= b[1] + b[3];

// a group's ancestors, by the design's parent links (a missing parent or a cycle ends the walk)
function ancestors(groups, gid) {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const out = new Set();
  for (let p = byId.get(gid)?.parent; p != null && byId.has(p) && !out.has(p) && p !== gid; ) {
    out.add(p);
    p = byId.get(p).parent;
  }
  return out;
}

describe("layout frames nest like the groups", () => {
  it("finds the committed designs", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    it(rel, () => {
      const doc = normalize(parse(fs.readFileSync(file, "utf8")).doc).doc;
      const groups = doc.groups ?? [];
      const lay = layout(doc);
      const frames = lay.frames;
      const up = new Map(groups.map((g) => [g.id, ancestors(groups, g.id)]));
      const related = (a, b) => a === b || up.get(a)?.has(b) || up.get(b)?.has(a);

      const ids = Object.keys(frames);
      for (const a of ids)
        for (const b of ids) {
          if (a >= b || related(a, b)) continue;
          expect(overlap(frames[a], frames[b]), `${a} overlaps ${b}`).toBe(false);
        }

      for (const g of groups) {
        if (g.parent == null || !frames[g.id] || !frames[g.parent]) continue;
        if (!up.get(g.id).has(g.parent)) continue; // a cycle
        expect(inside(frames[g.id], frames[g.parent]), `${g.id} inside ${g.parent}`).toBe(true);
      }

      for (const n of doc.nodes ?? []) {
        const b = [...lay.positions[n.id], ...lay.sizes[n.id]];
        const mine = new Set();
        if (n.group != null && frames[n.group]) {
          mine.add(n.group);
          for (const a of up.get(n.group) ?? []) mine.add(a);
          expect(inside(b, frames[n.group]), `${n.id} inside ${n.group}`).toBe(true);
        }
        for (const gid of ids) {
          if (mine.has(gid)) continue;
          expect(overlap(b, frames[gid]), `${n.id} overlaps ${gid}`).toBe(false);
        }
      }
    });
  }
});
