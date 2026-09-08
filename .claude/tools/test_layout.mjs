// Golden test for editor/core/layout.js against the Python renderer.
//
//   node .claude/tools/test_layout.mjs
//
// For every design under designs/ it dumps the geometry from a copy of the real renderer
// (.claude/tools/dump_layout.py --dump), runs the JavaScript port over the same file, and
// asserts exact equality of every number: node boxes, group frames, edge polylines and the
// canvas size. It then asserts the port's own invariants: determinism, no overlapping node
// boxes, every member box inside its group's frame, and no NaN anywhere.
//
// `yaml` resolves from .claude/tools/node_modules, which is why this file lives here.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import YAML from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const PYTHON = process.env.PYTHON || "python";

const { layout } = await import(pathToFileURL(resolve(ROOT, "editor/core/layout.js")).href);

// --- the 26 designs ---------------------------------------------------------

function designFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = resolve(dir, name);
    if (statSync(p).isDirectory()) designFiles(p, acc);
    else if (name === "design.yaml" || name === "design.broken.yaml") acc.push(p);
  }
  return acc;
}
const files = designFiles(resolve(ROOT, "designs"))
  .map(p => p.slice(ROOT.length + 1).split("\\").join("/"))
  .sort();

// --- failures ---------------------------------------------------------------

let checks = 0, nodesCompared = 0, framesCompared = 0, edgesCompared = 0, pointsCompared = 0;
const failures = [];
function fail(design, what, expected, actual) {
  failures.push(`${design}: ${what}\n    python: ${expected}\n    js:     ${actual}`);
}
function num(design, what, expected, actual) {
  checks++;
  if (expected === actual) return true;
  fail(design, what, JSON.stringify(expected), JSON.stringify(actual));
  return false;
}

// --- golden dump ------------------------------------------------------------

process.stdout.write(`dumping ${files.length} designs from ${PYTHON} ...\n`);
let golden;
try {
  const raw = execFileSync(PYTHON, [resolve(HERE, "dump_layout.py"), "--dump", ...files],
    { cwd: ROOT, encoding: "utf-8", maxBuffer: 1 << 28 });
  golden = JSON.parse(raw);
} catch (err) {
  console.error("could not run the python dump:", err.stderr || err.message);
  process.exit(2);
}

// --- compare ----------------------------------------------------------------

function hasNaN(v) {
  if (typeof v === "number") return Number.isNaN(v);
  if (Array.isArray(v)) return v.some(hasNaN);
  if (v && typeof v === "object") return Object.values(v).some(hasNaN);
  return false;
}

for (const f of files) {
  const g = golden[f];
  if (!g) { failures.push(`${f}: missing from the python dump`); continue; }
  const doc = YAML.parse(readFileSync(resolve(ROOT, f), "utf-8"));
  const L = layout(doc, null);

  // canvas
  num(f, "canvas width", g.canvas[0], L.canvas[0]);
  num(f, "canvas height", g.canvas[1], L.canvas[1]);

  // nodes, in document order
  const nodes = doc.nodes || [];
  if (!num(f, "node count", g.nodes.length, nodes.length)) continue;
  for (let k = 0; k < nodes.length; k++) {
    const [id, x, y, w, h] = g.nodes[k];
    num(f, `node order at ${k}`, id, nodes[k].id);
    const p = L.positions[id], s = L.sizes[id];
    if (!p || !s) { fail(f, `node ${id} missing`, `[${x},${y},${w},${h}]`, "undefined"); continue; }
    num(f, `node ${id} x`, x, p[0]);
    num(f, `node ${id} y`, y, p[1]);
    num(f, `node ${id} w`, w, s[0]);
    num(f, `node ${id} h`, h, s[1]);
    nodesCompared++;
  }

  // group frames, in document order, only those the python actually emits
  const jsFrames = Object.keys(L.frames);
  num(f, "frame count", g.frames.length, jsFrames.length);
  for (const [id, x, y, w, h] of g.frames) {
    const fr = L.frames[id];
    if (!fr) { fail(f, `frame ${id} missing`, `[${x},${y},${w},${h}]`, "undefined"); continue; }
    num(f, `frame ${id} x`, x, fr[0]);
    num(f, `frame ${id} y`, y, fr[1]);
    num(f, `frame ${id} w`, w, fr[2]);
    num(f, `frame ${id} h`, h, fr[3]);
    framesCompared++;
  }
  for (const id of jsFrames)
    if (!g.frames.some(r => r[0] === id)) fail(f, `frame ${id} extra`, "absent", JSON.stringify(L.frames[id]));

  // edges, in the python's draw order
  if (num(f, "edge count", g.edges.length, L.edges.length)) {
    for (let k = 0; k < g.edges.length; k++) {
      const ge = g.edges[k], je = L.edges[k];
      const tag = `edge ${k} (${ge.from} -> ${ge.to})`;
      num(f, `${tag} from`, ge.from, je.from);
      num(f, `${tag} to`, ge.to, je.to);
      num(f, `${tag} index`, ge.i, je.i);
      num(f, `${tag} dashed`, ge.dashed, je.dashed);
      num(f, `${tag} label`, ge.label === null ? null : String(ge.label), je.label);
      if (num(f, `${tag} point count`, ge.points.length, je.points.length)) {
        for (let q = 0; q < ge.points.length; q++) {
          num(f, `${tag} point ${q} x`, ge.points[q][0], je.points[q][0]);
          num(f, `${tag} point ${q} y`, ge.points[q][1], je.points[q][1]);
          pointsCompared++;
        }
      }
      edgesCompared++;
    }
  }

  // determinism
  checks++;
  if (JSON.stringify(layout(doc, null)) !== JSON.stringify(L))
    failures.push(`${f}: two runs of layout() disagree`);

  // no NaN
  checks++;
  if (hasNaN(L)) failures.push(`${f}: NaN in the layout output`);

  // no two node boxes overlap
  const ids = nodes.map(n => n.id).filter(id => L.positions[id]);
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    checks++;
    const [ax, ay] = L.positions[ids[a]], [aw, ah] = L.sizes[ids[a]];
    const [bx, by] = L.positions[ids[b]], [bw, bh] = L.sizes[ids[b]];
    if (ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah)
      failures.push(`${f}: boxes ${ids[a]} [${ax},${ay},${aw},${ah}] and ${ids[b]} [${bx},${by},${bw},${bh}] overlap`);
  }

  // every member box lies inside its group frame
  for (const n of nodes) {
    if (n.group == null) continue;
    const fr = L.frames[n.group];
    if (!fr) continue;                       // a group with no frame draws nothing
    checks++;
    const [x, y] = L.positions[n.id], [w, h] = L.sizes[n.id];
    if (!(x >= fr[0] && y >= fr[1] && x + w <= fr[0] + fr[2] && y + h <= fr[1] + fr[3]))
      failures.push(`${f}: node ${n.id} [${x},${y},${w},${h}] is outside frame ${n.group} [${fr}]`);
  }
}

// --- report -----------------------------------------------------------------

console.log(`designs:  ${files.length}`);
console.log(`nodes:    ${nodesCompared}`);
console.log(`frames:   ${framesCompared}`);
console.log(`edges:    ${edgesCompared} (${pointsCompared} points)`);
console.log(`checks:   ${checks}`);
if (failures.length) {
  console.error(`\nFAIL (${failures.length}), first 20:\n`);
  for (const m of failures.slice(0, 20)) console.error("  " + m);
  process.exit(1);
}
console.log("\nOK: every number matches design_to_svg.py");
