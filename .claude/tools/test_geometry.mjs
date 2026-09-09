// Edge geometry: keys stay stable, a manual bow overrides the automatic bend, and dragging an
// edge writes the offset a drag would produce.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "../../editor/core/yaml.js";
import { layout } from "../../editor/core/layout.js";
import { edgeGeometry, edgeKeys, bowAt, groupFrames } from "../../editor/core/geometry.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, "editor/data/catalogue.json"), "utf8"));
let failed = 0;
const ok = (name, pass, detail = "") => { console.log(`${pass ? "ok  " : "FAIL"} ${name}${detail ? "  " + detail : ""}`); if (!pass) failed++; };

const boxesOf = (doc) => {
  const l = layout(doc, cat);
  const boxes = {};
  for (const n of doc.nodes) boxes[n.id] = [l.positions[n.id][0], l.positions[n.id][1], l.sizes[n.id][0], l.sizes[n.id][1]];
  return boxes;
};

// A design with two edges between the same pair, which is the case a bow exists for.
const doc = {
  schemaVersion: "1", type: "design", id: "t",
  nodes: [{ id: "a", component: "container-service" }, { id: "b", component: "relational-database" }],
  edges: [
    { from: "a", to: "b", protocol: "http", mode: "sync" },
    { from: "a", to: "b", protocol: "http", mode: "sync" },
    { from: "b", to: "a", protocol: "http", mode: "sync" },
  ],
};
const keys = edgeKeys(doc);
ok("keys distinguish parallel edges", keys[0] === "a>b" && keys[1] === "a>b#1" && keys[2] === "b>a", keys.join(" "));
ok("keys are stable across calls", JSON.stringify(edgeKeys(doc)) === JSON.stringify(keys));

const boxes = boxesOf(doc);
const plain = edgeGeometry(doc, boxes);
const bowed = edgeGeometry(doc, boxes, { "a>b#1": 120 });
ok("without a bow every edge is straight or auto-bent", plain.every((e) => e.bow === 0));
ok("a bow turns its own edge into a curve", bowed[1].points.length === 3 && bowed[1].bow === 120);
ok("a bow leaves the other edges alone", JSON.stringify(bowed[0].points) === JSON.stringify(plain[0].points)
  && JSON.stringify(bowed[2].points) === JSON.stringify(plain[2].points));
const control = bowed[1].points[1];
const mirrored = edgeGeometry(doc, boxes, { "a>b#1": -120 })[1].points[1];
ok("the sign of a bow flips the side", Math.abs(control[1] - mirrored[1]) > 100 || Math.abs(control[0] - mirrored[0]) > 100);

// bowAt is what a drag writes: a pointer on the straight line gives zero, one off it does not.
const a = boxes.a, b = boxes.b;
const mid = [(a[0] + a[2] / 2 + b[0] + b[2] / 2) / 2, (a[1] + a[3] / 2 + b[1] + b[3] / 2) / 2];
ok("a pointer on the line means no bow", bowAt(boxes, "a", "b", mid[0], mid[1]) === 0);
// Offset along the perpendicular, since a pointer moved along the line itself is still on it.
const dir = [(b[0] + b[2] / 2) - (a[0] + a[2] / 2), (b[1] + b[3] / 2) - (a[1] + a[3] / 2)];
const len = Math.hypot(dir[0], dir[1]) || 1;
const perp = [-dir[1] / len, dir[0] / len];
const off = bowAt(boxes, "a", "b", mid[0] + perp[0] * 50, mid[1] + perp[1] * 50);
ok("a pointer off the line means a bow", Math.abs(off) > 0, String(off));
ok("a pointer along the line means none", bowAt(boxes, "a", "b", mid[0] + dir[0] / len * 50, mid[1] + dir[1] / len * 50) === 0);
ok("a bow is clamped", Math.abs(bowAt(boxes, "a", "b", mid[0] + perp[0] * 99999, mid[1] + perp[1] * 99999)) <= 1200);
ok("an unknown edge key is ignored", JSON.stringify(edgeGeometry(doc, boxes, { "x>y": 300 })) === JSON.stringify(plain));

// Every repository design survives a bow on its first edge, and frames do not move.
let designs = 0;
for (const tier of ["reference", "imported", "authored"]) {
  const dir = path.join(ROOT, "designs", tier);
  if (!fs.existsSync(dir)) continue;
  for (const id of fs.readdirSync(dir)) {
    const file = path.join(dir, id, "design.yaml");
    if (!fs.existsSync(file)) continue;
    designs++;
    const d = parse(fs.readFileSync(file, "utf8")).doc;
    const bx = boxesOf(d);
    const k = edgeKeys(d);
    const before = groupFrames(d, bx);
    const g = edgeGeometry(d, bx, k.length ? { [k[0]]: 80 } : {});
    if (g.length !== d.edges.length) { ok(`${id}: every edge is drawn`, false, `${g.length} of ${d.edges.length}`); }
    const after = groupFrames(d, bx);
    if (JSON.stringify(before) !== JSON.stringify(after)) ok(`${id}: a bow does not move a frame`, false);
    if (g.some((e) => e.points.some((p) => p.some((n) => !Number.isFinite(n))))) ok(`${id}: no NaN`, false);
  }
}
ok("every design draws with a bow applied", true, `${designs} designs`);

console.log(`\n${failed ? failed + " FAILING" : "geometry checks passed"}`);
process.exit(failed ? 1 : 0);
