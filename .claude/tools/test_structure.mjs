// Test for editor/core/structure.js.  node .claude/tools/test_structure.mjs
//
//  1. all 26 repository designs produce zero findings
//  2. 14 broken fixtures, one per checkDesign message template, each message compared byte for
//     byte against what `node validate.mjs --design <fixture>` actually prints
//  3. the hand-written schema layer catches eight defects, by pointer and keyword
//  4. the catalogue sweep: a one-node design for each of the 1,623 components
//
// Lives here because `yaml` resolves only in .claude/tools/node_modules.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import YAML from "yaml";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const VALIDATOR = path.join(ROOT, ".claude", "tools", "validate.mjs");
const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join("/");

let failures = 0;
const ok = (cond, what, detail) => {
  if (cond) return true;
  failures++;
  console.log(`FAIL ${what}${detail === undefined ? "" : `\n      ${detail}`}`);
  return false;
};
const eq = (actual, expected, what) =>
  ok(actual === expected, what, `expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);

/* ------------------------------------------------------------------ loading */

// editor/package.json ({"type":"module"}) is another agent's file and may not exist yet, so fall
// back to loading the module's source through a data: URL, which is always ESM.
async function loadModule() {
  const p = path.join(ROOT, "editor", "core", "structure.js");
  try {
    return await import(pathToFileURL(p).href);
  } catch {
    const src = fs.readFileSync(p, "utf8");
    return await import("data:text/javascript;charset=utf-8," + encodeURIComponent(src));
  }
}

const walkYaml = (dir) =>
  fs.existsSync(path.join(ROOT, dir))
    ? fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) =>
        d.isDirectory() ? walkYaml(`${dir}/${d.name}`) : d.name.endsWith(".yaml") ? [`${dir}/${d.name}`] : []
      )
    : [];

function loadCatalogue() {
  const bundle = path.join(ROOT, "editor", "data", "catalogue.json");
  if (fs.existsSync(bundle) && !process.env.ARKORE_NO_BUNDLE) {
    const c = JSON.parse(fs.readFileSync(bundle, "utf8"));
    if (c && c.kinds && c.components && c.schema) return { catalogue: c, source: "editor/data/catalogue.json" };
  }
  const kinds = {};
  for (const f of walkYaml("kinds")) {
    const d = YAML.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
    kinds[d.id] = d;
  }
  const components = {};
  for (const f of walkYaml("components")) {
    const d = YAML.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
    components[d.id] = d;
  }
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "schema", "design.schema.json"), "utf8"));
  return { catalogue: { kinds, components, schema }, source: "kinds/ + components/ + schema/ (yaml)" };
}

/* ------------------------------------------------------------------ helpers */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "arkore-structure-"));
const messages = (fs_) => fs_.map((f) => f.message);
const layer1 = (fs_) => fs_.filter((f) => f.keyword === undefined);
const layer2 = (fs_) => fs_.filter((f) => f.keyword !== undefined);

// Runs the repository validator on one design file and returns its PROBLEMS lines verbatim.
function validatorProblems(absFile) {
  let out;
  try {
    out = execFileSync(process.execPath, [VALIDATOR, "--design", absFile], { encoding: "utf8" });
  } catch (e) {
    out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
  const lines = out.split(/\r?\n/);
  const i = lines.findIndex((l) => l.startsWith("PROBLEMS ("));
  return i < 0 ? [] : lines.slice(i + 1).filter((l) => l.startsWith(" - ")).map((l) => l.slice(3));
}

function writeFixture(name, doc) {
  const abs = path.join(TMP, `${name}.yaml`);
  fs.writeFileSync(abs, YAML.stringify(doc), "utf8");
  return abs;
}

/* --------------------------------------------------------------------- main */

const { check } = await loadModule();
const { catalogue, source } = loadCatalogue();
const comps = Object.values(catalogue.components);
console.log(
  `catalogue: ${source} — ${Object.keys(catalogue.kinds).length} kinds, ${comps.length} components`
);

// ---- 1. the 26 repository designs -----------------------------------------

const designFiles = [];
for (const tier of ["reference", "imported"]) {
  const dir = path.join(ROOT, "designs", tier);
  if (!fs.existsSync(dir)) continue;
  for (const d of fs.readdirSync(dir, { withFileTypes: true }).filter((x) => x.isDirectory()))
    for (const f of ["design.yaml", "design.broken.yaml"]) {
      const abs = path.join(dir, d.name, f);
      if (fs.existsSync(abs)) designFiles.push(abs);
    }
}
eq(designFiles.length, 26, "26 design files found");
for (const abs of designFiles) {
  const doc = YAML.parse(fs.readFileSync(abs, "utf8"));
  const found = check(doc, catalogue, { file: rel(abs) });
  ok(found.length === 0, `clean: ${rel(abs)}`, messages(found).join("\n      "));
}
console.log(`designs: ${designFiles.length} checked`);

// ---- 2. the 14 checkDesign message templates -------------------------------

// Pick real components out of the catalogue so the fixtures stay valid as it grows.
const clean = (doc) => check(doc, catalogue, { file: "x" }).length === 0;
const one = (comp, extra = {}) => ({
  schemaVersion: "1",
  type: "design",
  id: "fixture",
  nodes: [{ id: comp, component: comp, ...extra }],
  edges: [],
});
const SQL = comps.find(
  (c) => c.kind === "sql-database" && clean(one(c.id)) && !(c.defaults ?? {}).shardKey
);
const OTHER = comps.find((c) => c.kind !== "sql-database" && clean(one(c.id)));
if (!SQL || !OTHER) {
  console.log("FAIL could not pick fixture components from the catalogue");
  process.exit(1);
}
const sql = SQL.id;
const other = OTHER.id;
const base = () => ({
  schemaVersion: "1",
  type: "design",
  id: "fixture",
  nodes: [{ id: "a", component: sql }],
  edges: [],
});
const withProps = (props) => {
  const d = base();
  d.nodes[0].props = props;
  return d;
};

// `msg` is a function of the file prefix the validator will use for that fixture.
const fixtures = [
  ["duplicate-node-ids", { ...base(), nodes: [{ id: "a", component: sql }, { id: "a", component: sql }] },
    (f) => `${f}: duplicate node ids`],
  ["duplicate-group-ids", { ...base(), groups: [{ id: "g", kind: "system" }, { id: "g", kind: "vpc" }] },
    (f) => `${f}: duplicate group ids`],
  ["group-parent-missing", { ...base(), groups: [{ id: "g", kind: "system", parent: "nowhere" }] },
    (f) => `${f}: group g parent missing`],
  ["unknown-component", { ...base(), nodes: [{ id: "a", component: "no-such-component" }] },
    (f) => `${f}: node a unknown component no-such-component`],
  ["unknown-group", { ...base(), nodes: [{ id: "a", component: sql, group: "ghost" }] },
    (f) => `${f}: node a unknown group`],
  ["unknown-prop", withProps({ nosuchprop: 1 }), (f) => `${f}: node a unknown prop nosuchprop`],
  ["enum", withProps({ replication: "sideways" }), (f) => `${f}: node a prop replication=sideways not in enum`],
  ["boolean", withProps({ backupEnabled: "yes" }), (f) => `${f}: node a prop backupEnabled not boolean`],
  ["integer", withProps({ backupRetentionDays: "many" }), (f) => `${f}: node a prop backupRetentionDays not integer`],
  ["string", withProps({ shardKey: 5 }), (f) => `${f}: node a prop shardKey not string`],
  ["ref-missing", withProps({ replicaOf: "ghost" }), (f) => `${f}: ref replicaOf missing`],
  ["ref-wrong-kind",
    { ...base(), nodes: [{ id: "a", component: sql, props: { replicaOf: "b" } }, { id: "b", component: other }] },
    (f) => `${f}: ref replicaOf wrong kind`],
  ["missing-required", one("odyssey"), (f) => `${f}: node odyssey missing required poolMode`],
  ["edge-endpoint",
    { ...base(), edges: [{ from: "a", to: "ghost", protocol: "http", mode: "sync" }] },
    (f) => `${f}: edge to ghost missing`],
];

for (const [name, doc, msg] of fixtures) {
  const abs = writeFixture(name, doc);
  const file = rel(abs);
  const expected = msg(file);
  const found = check(doc, catalogue, { file });
  const mine = layer1(found);
  const problems = validatorProblems(abs);
  eq(mine.length, 1, `fixture ${name}: exactly one layer-1 finding`);
  eq(mine[0] && mine[0].message, expected, `fixture ${name}: message`);
  ok(mine[0] && mine[0].blocking === true, `fixture ${name}: blocking`);
  ok(
    problems.includes(expected),
    `fixture ${name}: validate.mjs prints the same string`,
    `validator said:\n      ${problems.join("\n      ")}`
  );
  ok(layer2(found).length === 0, `fixture ${name}: schema layer quiet`, messages(layer2(found)).join("; "));
}
console.log(`layer 1: ${fixtures.length} message templates matched against validate.mjs`);

// subjects
{
  const g = check(fixtures[2][1], catalogue, { file: "x" })[0].subject;
  eq(JSON.stringify(g), JSON.stringify({ type: "group", ref: "g" }), "subject: group");
  const n = check(fixtures[5][1], catalogue, { file: "x" })[0].subject;
  eq(JSON.stringify(n), JSON.stringify({ type: "node", ref: "a" }), "subject: node");
  const e = check(fixtures[13][1], catalogue, { file: "x" })[0].subject;
  eq(JSON.stringify(e), JSON.stringify({ type: "edge", ref: 0 }), "subject: edge");
  const d = check(fixtures[0][1], catalogue, { file: "x" })[0].subject;
  eq(JSON.stringify(d), JSON.stringify({ type: "design", ref: null }), "subject: design");
}

// ---- 3. the schema layer ---------------------------------------------------

const edged = (edge) => ({ ...base(), edges: [{ from: "a", to: "a", ...edge }] });
const schemaCases = [
  ["unknown top-level key", { ...base(), colour: "red" }, "/colour", "additionalProperties"],
  ["bad schemaVersion", { ...base(), schemaVersion: "2" }, "/schemaVersion", "const"],
  ["id breaks the id pattern", { ...base(), id: "Fixture_1" }, "/id", "pattern"],
  ["empty nodes array", { ...base(), nodes: [] }, "/nodes", "minItems"],
  ["edge missing protocol", edged({ mode: "sync" }), "/edges/0", "required"],
  ["mode outside its enum", edged({ protocol: "http", mode: "half" }), "/edges/0/mode", "enum"],
  ["availability.sla breaks its regex",
    { ...base(), requirements: { availability: { sla: "five nines" } } },
    "/requirements/availability/sla", "pattern"],
  ["negative nfr.rps",
    { ...base(), nodes: [{ id: "a", component: sql, nfr: { rps: -1 } }] },
    "/nodes/0/nfr/rps", "minimum"],
];
for (const [what, doc, pointer, keyword] of schemaCases) {
  const found = layer2(check(doc, catalogue, { file: "x" }));
  const hit = found.find((f) => f.pointer === pointer && f.keyword === keyword);
  ok(hit !== undefined, `schema: ${what}`,
    `wanted ${keyword} at ${pointer}, got ${JSON.stringify(found.map((f) => [f.keyword, f.pointer]))}`);
  if (hit) ok(hit.blocking === true && typeof hit.message === "string" && hit.message.length > 0,
    `schema: ${what} has a blocking message`);
}
{
  const found = layer2(check(schemaCases[5][1], catalogue, { file: "x" }));
  eq(JSON.stringify(found[0].subject), JSON.stringify({ type: "edge", ref: 0 }), "schema subject: edge");
  const nf = layer2(check(schemaCases[7][1], catalogue, { file: "x" }));
  eq(JSON.stringify(nf[0].subject), JSON.stringify({ type: "node", ref: "a" }), "schema subject: node");
}
console.log(`layer 2: ${schemaCases.length} schema defects caught`);

// ---- 4. the catalogue sweep ------------------------------------------------

const sweepBad = [];
for (const c of comps) {
  const found = check(one(c.id), catalogue, { file: "sweep" });
  if (found.length) sweepBad.push([c.id, messages(found)]);
}
const expectedBad = ["oci-events", "odyssey"];
eq(
  JSON.stringify(sweepBad.map(([id]) => id).sort()),
  JSON.stringify(expectedBad),
  `sweep: ${comps.length} components, only the two known components unclean`
);
for (const [id, msgs] of sweepBad)
  ok(msgs.length === 1 && /missing required/.test(msgs[0]), `sweep: ${id} is only 'missing required'`, msgs.join("; "));

// supplying the first enum value clears them
for (const [id] of sweepBad) {
  const c = catalogue.components[id];
  const defs = { ...(catalogue.kinds[c.kind].properties ?? {}), ...(c.properties ?? {}) };
  const missing = Object.entries(defs).find(
    ([k, d]) => d.required && (c.defaults ?? {})[k] === undefined && d.default === undefined
  );
  const [prop, def] = missing;
  const fixed = one(id, { props: { [prop]: def.values[0] } });
  const found = check(fixed, catalogue, { file: "sweep" });
  ok(found.length === 0, `sweep: ${id}.${prop} = ${JSON.stringify(def.values[0])} clears it`, messages(found).join("; "));
}
console.log(`sweep: ${comps.length} one-node designs, unclean = [${sweepBad.map(([id]) => id).join(", ")}]`);

// ---- robustness -------------------------------------------------------------

for (const [what, doc] of [
  ["null", null],
  ["empty object", {}],
  ["nodes not an array", { schemaVersion: "1", type: "design", id: "x", nodes: "no", edges: [] }],
  ["null node", { schemaVersion: "1", type: "design", id: "x", nodes: [null], edges: [] }],
]) {
  let threw = null;
  try {
    check(doc, catalogue, { file: "x" });
  } catch (e) {
    threw = e;
  }
  ok(threw === null, `robust: ${what} does not throw`, threw && threw.message);
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log(failures ? `\n${failures} FAILURE(S)` : "\nall structure tests passed");
process.exit(failures ? 1 : 0);
