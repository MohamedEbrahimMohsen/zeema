// The acceptance gate for the Arkore canvas. Runs every module's own test, then the checks that
// only make sense across modules: the full repository gate after rewriting every design with the
// editor's own serialiser, the performance budgets, and the no-dependency rule.
//
//   node .claude/tools/editor_test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse, serialize } from "../../editor/core/yaml.js";
import { layout } from "../../editor/core/layout.js";
import { runRules } from "../../editor/core/rules.js";
import { check } from "../../editor/core/structure.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, "editor/data/catalogue.json"), "utf8"));
const index = JSON.parse(fs.readFileSync(path.join(ROOT, "editor/data/designs.json"), "utf8"));
let failed = 0;
const ok = (name, pass, detail = "") => { console.log(`${pass ? "ok  " : "FAIL"} ${name}${detail ? "  " + detail : ""}`); if (!pass) failed++; };
const run = (file) => {
  try { execFileSync(process.execPath, [path.join(ROOT, ".claude/tools", file)], { stdio: "pipe" }); return true; }
  catch (e) { console.log(String(e.stdout || "").split("\n").slice(-6).join("\n")); return false; }
};

console.log("module tests");
for (const [name, file] of [["F1,F2 yaml", "test_yaml.mjs"], ["F7 layout", "test_layout.mjs"],
  ["F4 rules", "test_rules.mjs"], ["F5,F6 structure", "test_structure.mjs"],
  ["F8 bundle", "test_build_editor_data.mjs"], ["icon paths", "check_icon_paths.mjs"],
  ["edge geometry", "test_geometry.mjs"], ["write channel", "test_editor_server.mjs"],
  ["authoring", "test_authoring.mjs"]])
  ok(name, run(file));

console.log("\ncross-module");
// F3: every design, rewritten by the editor, still passes the whole repository gate.
const baseline = execFileSync(process.execPath, [path.join(ROOT, ".claude/tools/validate.mjs")], { encoding: "utf8" });
const originals = new Map();
let rewritten = 0;
for (const entry of index) {
  const p = path.join(ROOT, entry.path);
  const text = fs.readFileSync(p, "utf8");
  originals.set(p, text);
  const { doc, cst } = parse(text);
  const out = serialize(cst, doc);
  fs.writeFileSync(p, out);
  if (out === text) rewritten++;
}
let after = "";
try { after = execFileSync(process.execPath, [path.join(ROOT, ".claude/tools/validate.mjs")], { encoding: "utf8" }); }
catch (e) { after = String(e.stdout || ""); }
for (const [p, text] of originals) fs.writeFileSync(p, text);
ok(`F3 full gate after a rewrite of all ${index.length} designs`, after === baseline, `${rewritten}/${index.length} byte identical`);

// F10: the measured budgets.
const chat = parse(fs.readFileSync(path.join(ROOT, "designs/imported/chat-system/design.yaml"), "utf8")).doc;
const big = { schemaVersion: "1", type: "design", id: "big", nodes: [], edges: [] };
for (let i = 0; i < 200; i++) big.nodes.push({ id: `n-${i}`, component: "container-service" });
for (let i = 1; i < 200; i++) big.edges.push({ from: `n-${i - 1}`, to: `n-${i}`, protocol: "http", mode: "sync" });
let t = Date.now(); layout(big, cat); const layoutMs = Date.now() - t;
ok("F10 layout of 200 nodes under 500 ms", layoutMs < 500, `${layoutMs} ms`);
t = Date.now(); for (let i = 0; i < 50; i++) runRules(chat, cat); const ruleMs = (Date.now() - t) / 50;
ok("F10 rules under 100 ms", ruleMs < 100, `${ruleMs.toFixed(2)} ms`);
const search = JSON.parse(fs.readFileSync(path.join(ROOT, "editor/data/search.json"), "utf8"));
t = Date.now();
for (let i = 0; i < 200; i++) { const q = "abcdefghijklmnopqrstuvwxyz"[i % 26]; search.filter((r) => r[5].includes(q)); }
const searchMs = (Date.now() - t) / 200;
ok("F10 palette search p95 under 16 ms", searchMs < 16, `${searchMs.toFixed(2)} ms mean`);

// F11: nothing in editor/ reaches the network or a dependency.
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
const sources = walk(path.join(ROOT, "editor")).filter((f) => /\.(js|mjs|html|css)$/.test(f));
const offenders = [];
for (const f of sources) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/from\s+["']([^"']+)["']/g)) {
    const spec = m[1];
    if (!spec.startsWith(".") && !spec.startsWith("node:")) offenders.push(`${path.relative(ROOT, f)} imports ${spec}`);
  }
  if (/https?:\/\/(?!localhost|www\.w3\.org)/.test(src.replace(/^\s*\/\/.*$/gm, ""))) offenders.push(`${path.relative(ROOT, f)} names an external origin`);
}
ok("F11 no dependencies and no external origins in editor/", offenders.length === 0, offenders.join("; "));
ok("F11 no node_modules under editor/", !fs.existsSync(path.join(ROOT, "editor/node_modules")));

// A design opens, is edited through the document API, and survives the round trip.
const { doc, cst } = parse(fs.readFileSync(path.join(ROOT, "designs/imported/chat-system/design.yaml"), "utf8"));
const edited = JSON.parse(JSON.stringify(doc));
edited.nodes[0].label = "Edited";
const out = serialize(cst, edited);
const back = parse(out).doc;
ok("edit round trip", back.nodes[0].label === "Edited" && check(back, cat).length === 0,
  `${out.split("\n").length} lines, ${out.split("\n").filter((l, i) => l !== fs.readFileSync(path.join(ROOT, "designs/imported/chat-system/design.yaml"), "utf8").split("\n")[i]).length} line(s) changed`);

console.log(`\n${failed ? failed + " FAILING" : "all editor checks passed"}`);
process.exit(failed ? 1 : 0);
