// Authoring a design from nothing, the way a person does it in the canvas: New, drop a
// component, save, drop another, save again. This is the path that broke — an empty list was
// written as a bare "edges:", which reads back as null, and from that moment the design could
// not be saved, drawn or validated — so it is tested end to end, through the real server, with
// the same modules the page loads and the same template the New button uses.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { parse, serialize } from "../../editor/core/yaml.js";
import * as D from "../../editor/core/document.js";
import { check } from "../../editor/core/structure.js";
import { layout } from "../../editor/core/layout.js";
import { edgeGeometry } from "../../editor/core/geometry.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, "editor/data/catalogue.json"), "utf8"));
const PORT = 8736;
const base = `http://localhost:${PORT}`;
const ID = "gate-authoring-scratch";
const REL = `designs/authored/${ID}/design.yaml`;
const scratch = path.join(ROOT, "designs", "authored", ID);

let failed = 0;
const check1 = (name, fn) => {
  try { fn(); console.log("ok   " + name); }
  catch (e) { failed++; console.log("FAIL " + name + "\n     " + String(e.message).split("\n").slice(0, 6).join("\n     ")); }
};

// ---------------------------------------------------------------- the empty list itself

check1("an empty list is written in flow style, never as a bare key", () => {
  const { doc, cst } = parse(D.newDesignText("x"));
  doc.nodes = []; doc.edges = [];
  const text = serialize(cst, doc);
  assert.match(text, /^nodes: \[\]$/m);
  assert.match(text, /^edges: \[\]$/m);
  assert.deepEqual(YAML.parse(text).edges, []);
  assert.deepEqual(parse(text).doc.edges, []);
});

check1("emptying a list that had entries leaves a list behind", () => {
  const { doc, cst } = parse('id: "x"\nnodes:\n  - { id: "a" }\nedges: []\n');
  doc.nodes = [];
  const back = parse(serialize(cst, doc));
  assert.deepEqual(back.doc.nodes, []);
  assert.deepEqual(YAML.parse(serialize(cst, doc)).nodes, []);
});

check1("a key with nothing under it parses as null, as YAML says", () => {
  const text = 'id: "x"\nedges:\n';
  const { doc, cst } = parse(text);
  assert.deepEqual(doc, YAML.parse(text));
  assert.equal(serialize(cst, doc), text);          // and it still round trips byte for byte
});

check1("a document whose list arrived as null is repaired, and the repair is reported", () => {
  const { doc, cst } = parse('id: "x"\nnodes:\n  - { id: "a", component: "redis" }\nedges:\n');
  const fixed = D.normalize(doc);
  assert.deepEqual(fixed.doc.edges, []);
  assert.equal(fixed.repaired.length, 1);
  assert.deepEqual(parse(serialize(cst, fixed.doc)).doc.edges, []);
  assert.deepEqual(D.normalize(parse('id: "x"\nnodes: []\nedges: []\n').doc).repaired, []);
});

check1("nothing that draws a design trips over a list that is not one", () => {
  const doc = { schemaVersion: "1", type: "design", id: "x", nodes: [{ id: "a", component: "redis" }], edges: null };
  const { positions, sizes } = layout(D.normalize(doc).doc, catalogue);
  const boxes = { a: [positions.a[0], positions.a[1], sizes.a[0], sizes.a[1]] };
  assert.deepEqual(edgeGeometry(D.normalize(doc).doc, boxes), []);
  assert.deepEqual(check(D.normalize(doc).doc, catalogue, { file: "x" }), []);
});

// ---------------------------------------------------------------- the whole cycle

const server = spawn(process.execPath, [path.join(ROOT, "editor/serve.mjs"), String(PORT)], { stdio: "ignore" });
const stop = () => { try { server.kill(); } catch {} };
process.on("exit", stop);

const ready = async () => {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(base + "/api/designs")).ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
};

// What the page does on save: serialise, PUT, then re-read the file as the source of truth.
const saveCycle = async (cst, doc) => {
  const text = serialize(cst, doc);
  const put = await fetch(base + "/" + REL, { method: "PUT", body: text });
  assert.equal(put.status, 200, `PUT returned ${put.status}: ${await put.text()}`);
  const onDisk = await (await fetch(base + "/" + REL, { cache: "no-cache" })).text();
  assert.equal(onDisk, text, "the file on disk is not what was sent");
  const fresh = parse(onDisk);
  const normalised = D.normalize(fresh.doc);
  assert.deepEqual(normalised.repaired, [], "a file this editor just wrote needed repair");
  assert.deepEqual(check(normalised.doc, catalogue, { file: ID }), [], "a file this editor just wrote is not valid");
  assert.deepEqual(YAML.parse(onDisk).edges, normalised.doc.edges);
  return { cst: fresh.cst, doc: normalised.doc };
};

try {
  fs.rmSync(scratch, { recursive: true, force: true });
  assert.ok(await ready(), "the server did not start");

  // New: the template, with the two lists the format requires.
  let { doc, cst } = parse(D.newDesignText(ID));
  doc = D.normalize(doc).doc;
  doc.nodes = []; doc.edges = [];

  // Drop the first component and save, which is exactly where it used to break.
  doc = D.addNode(doc, "redis", catalogue).doc;
  let saved = await saveCycle(cst, doc);
  check1("a design with one component saves", () => assert.equal(saved.doc.nodes.length, 1));

  // Keep going on top of what came back off disk: four more components and two edges.
  ({ cst, doc } = saved);
  for (const component of ["postgres", "kafka", "nginx", "s3"]) {
    const added = D.addNode(doc, component, catalogue);
    doc = added.doc;
    saved = await saveCycle(cst, doc);
    ({ cst, doc } = saved);
  }
  check1("components keep going in after the first save", () => assert.equal(doc.nodes.length, 5));

  doc = D.addEdge(doc, doc.nodes[0].id, doc.nodes[1].id);
  doc = D.addEdge(doc, doc.nodes[1].id, doc.nodes[2].id);
  ({ cst, doc } = await saveCycle(cst, doc));
  check1("edges go in and come back as edges", () => {
    assert.equal(doc.edges.length, 2);
    assert.equal(YAML.parse(fs.readFileSync(path.join(scratch, "design.yaml"), "utf8")).edges.length, 2);
  });

  // And back to empty: deleting the last edge must not write a bare key either.
  doc = D.deleteEdge(doc, 1);
  doc = D.deleteEdge(doc, 0);
  ({ cst, doc } = await saveCycle(cst, doc));
  check1("deleting every edge leaves an empty list, not a null", () => {
    assert.deepEqual(doc.edges, []);
    assert.match(fs.readFileSync(path.join(scratch, "design.yaml"), "utf8"), /^edges: \[\]$/m);
  });

  check1("the repository validator accepts what the canvas wrote", () => {
    const r = spawnValidate();
    assert.equal(r.status, 0, r.output);
  });
} catch (e) {
  failed++;
  console.log("FAIL the authoring cycle\n     " + (e.stack || e.message));
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
  stop();
}

function spawnValidate() {
  const r = spawnSync(process.execPath, [path.join(ROOT, ".claude/tools/validate.mjs")], { encoding: "utf8" });
  return { status: r.status, output: (r.stdout || "") + (r.stderr || "") };
}

console.log(`\n${failed ? failed + " FAILING" : "authoring checks passed"}`);
process.exit(failed ? 1 : 0);
