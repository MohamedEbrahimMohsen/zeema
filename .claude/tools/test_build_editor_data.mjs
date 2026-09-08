// Acceptance test for .claude/tools/build_editor_data.mjs
//   node .claude/tools/test_build_editor_data.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOLS, "..", "..");
const DATA = path.join(ROOT, "editor", "data");
const GEN = path.join(TOOLS, "build_editor_data.mjs");
const FILES = ["catalogue.json", "search.json", "designs.json", "icons.json"];

let passed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}\n     ${e.message}`);
    process.exitCode = 1;
  }
};

// The bundle under test is whatever is committed; generate it first so the test is self-contained.
execFileSync(process.execPath, [GEN], { cwd: ROOT, stdio: "pipe" });

const bytes = {};
const json = {};
check("the four files exist and parse", () => {
  for (const f of FILES) {
    const p = path.join(DATA, f);
    assert.ok(fs.existsSync(p), `${f} is missing`);
    bytes[f] = fs.readFileSync(p);
    json[f] = JSON.parse(bytes[f].toString("utf8"));
  }
});

check("catalogue: 71 kinds, 1623 components, 36 rules, locale, schema", () => {
  const c = json["catalogue.json"];
  assert.equal(Object.keys(c.kinds).length, 71);
  assert.equal(Object.keys(c.components).length, 1623);
  assert.equal(c.rules.length, 36);
  for (const k of Object.values(c.kinds)) assert.ok(k.id && k.category && k.properties);
  for (const comp of Object.values(c.components)) assert.ok(comp.id && comp.kind && comp.provider);
  for (const r of c.rules) assert.ok(r.id && r.severity && r.select && r.when && r.message);
  for (const s of ["categories", "kinds", "components", "rules"]) assert.ok(c.locale[s], `locale.${s}`);
  assert.equal(typeof c.schema, "object");
  assert.ok(c.schema.properties, "schema.properties");
  assert.ok(c.schema.properties.nodes, "schema.properties.nodes");
});

check("catalogue: every component kind resolves", () => {
  const c = json["catalogue.json"];
  for (const comp of Object.values(c.components)) assert.ok(c.kinds[comp.kind], `unknown kind ${comp.kind}`);
});

check("search: 1623 rows, six columns, haystack lowercased and contains the id", () => {
  const s = json["search.json"];
  assert.equal(s.length, 1623);
  const c = json["catalogue.json"];
  for (const row of s) {
    assert.equal(row.length, 6);
    const [id, name, kind, category, provider, haystack] = row;
    assert.ok(c.components[id], `unknown component ${id}`);
    assert.equal(kind, c.components[id].kind);
    assert.equal(provider, c.components[id].provider);
    assert.equal(category, c.kinds[kind].category);
    assert.equal(haystack, haystack.toLowerCase());
    assert.ok(haystack.includes(id.toLowerCase()));
    assert.ok(name.length > 0, `${id} has no name`);
  }
});

check("designs: 26 rows, 7 not editable, paths and layouts exist", () => {
  const d = json["designs.json"];
  assert.equal(d.length, 26);
  assert.equal(d.filter((x) => x.editable === false).length, 7);
  assert.equal(d.filter((x) => x.editable === true).length, 19);
  for (const row of d) {
    assert.ok(fs.existsSync(path.join(ROOT, row.path)), `${row.path} missing`);
    assert.ok(["reference", "imported"].includes(row.tier));
    assert.equal(row.layout, row.path.replace(/\.yaml$/, ".layout.json"));
    assert.equal(row.editable, path.basename(row.path) === "design.yaml");
    assert.equal(row.path, `designs/${row.tier}/${row.id}/${path.basename(row.path)}`);
  }
});

check("icons: 1694 keys, none empty, one per component and kind", () => {
  const i = json["icons.json"];
  const c = json["catalogue.json"];
  assert.equal(Object.keys(i).length, 1694);
  for (const [k, v] of Object.entries(i)) {
    assert.equal(typeof v, "string");
    assert.ok(v.trim().length > 0, `icon ${k} is empty`);
    assert.ok(!v.includes("<svg"), `icon ${k} still has its <svg> wrapper`);
  }
  for (const id of Object.keys(c.components)) assert.ok(id in i, `no icon for component ${id}`);
  for (const id of Object.keys(c.kinds)) assert.ok(`kind:${id}` in i, `no icon for kind ${id}`);
});

check("regeneration is byte identical", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "arkore-editor-data-"));
  try {
    execFileSync(process.execPath, [GEN, "--out", tmp], { cwd: ROOT, stdio: "pipe" });
    for (const f of FILES) {
      const again = fs.readFileSync(path.join(tmp, f));
      assert.ok(again.equals(bytes[f]), `${f} differs on regeneration (${bytes[f].length} vs ${again.length} bytes)`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

console.log(
  `\n${passed}/7 checks passed  ` +
    FILES.map((f) => `${f} ${(bytes[f]?.length ?? 0) / 1024 > 0 ? ((bytes[f].length / 1024).toFixed(1) + " KB") : "?"}`).join("  "),
);
if (process.exitCode) console.error("FAILED");
