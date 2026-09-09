// The operations behind the canvas gestures: what group, ungroup, duplicate, reverse and the
// label editors actually do to the document, and where an edge's label belongs on a bowed line.
// The gestures themselves are pointer events and live in the browser; everything they call is
// here, so a change to the meaning of "ungroup" fails under node rather than in someone's hands.
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import * as D from "../../editor/core/document.js";
import { parse, serialize } from "../../editor/core/yaml.js";
import { check } from "../../editor/core/structure.js";
import { midpointOf, edgeGeometry, pathOf } from "../../editor/core/geometry.js";
import { FORMATS, exportScene } from "../../editor/ui/export.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, "editor/data/catalogue.json"), "utf8"));
let failed = 0;
// Checks are queued and run in order at the end, so an asynchronous one is awaited rather than
// left running after the summary has already been printed.
const queue = [];
const check1 = (name, fn) => queue.push([name, fn]);

const base = () => ({
  schemaVersion: "1", type: "design", id: "t",
  nodes: [
    { id: "a", component: "redis" },
    { id: "b", component: "postgres" },
    { id: "c", component: "nginx" },
  ],
  edges: [
    { from: "a", to: "b", protocol: "http", mode: "sync" },
    { from: "b", to: "c", protocol: "http", mode: "async" },
  ],
});

// ---------------------------------------------------------------- labels on bowed edges

check1("an edge label sits on the line, not on the control point", () => {
  // The control point of a quadratic is twice as far from the chord as the curve it pulls, so a
  // label placed there drifts away from its own edge as the edge is bowed.
  assert.deepEqual(midpointOf([[0, 0], [200, 0]]), [100, 0]);
  assert.deepEqual(midpointOf([[0, 0], [100, 200], [200, 0]]), [100, 100]);
  const boxes = { a: [0, 0, 100, 60], b: [400, 0, 100, 60] };
  const doc = { nodes: [{ id: "a" }, { id: "b" }], edges: [{ from: "a", to: "b", label: "x" }] };
  const straight = edgeGeometry(doc, boxes)[0];
  const bowed = edgeGeometry(doc, boxes, { "a>b": 300 })[0];
  const drift = Math.abs(bowed.mid[1] - straight.mid[1]);
  assert.ok(drift > 100 && drift < 160, `the label moved ${drift}px for a 300px bow`);
  // and it stays on the drawn curve: the path's own halfway point
  const [, cx, cy] = /Q([-\d.]+) ([-\d.]+)/.exec(pathOf(bowed.points)).map(Number);
  const onCurve = [0.25 * bowed.points[0][0] + 0.5 * cx + 0.25 * bowed.points[2][0],
                   0.25 * bowed.points[0][1] + 0.5 * cy + 0.25 * bowed.points[2][1]];
  assert.ok(Math.hypot(onCurve[0] - bowed.mid[0], onCurve[1] - bowed.mid[1]) < 0.6);
});

// ---------------------------------------------------------------- grouping

check1("grouping a selection puts exactly those nodes in one group", () => {
  const { doc, id } = D.addGroup(base(), ["a", "b"], "system");
  assert.equal(doc.groups.length, 1);
  assert.deepEqual(doc.nodes.map((n) => n.group || null), [id, id, null]);
  assert.deepEqual(check(doc, catalogue, { file: "t" }), []);
});

check1("grouping inside a group nests rather than overlaps", () => {
  const outer = D.addGroup(base(), ["a", "b", "c"], "region");
  const inner = D.addGroup(outer.doc, ["a", "b"], "system");
  const g = inner.doc.groups.find((x) => x.id === inner.id);
  assert.equal(g.parent, outer.id, "the new boundary is inside the one its members were in");
  assert.equal(inner.doc.nodes.find((n) => n.id === "c").group, outer.id);
  assert.deepEqual(check(inner.doc, catalogue, { file: "t" }), []);
});

check1("ungrouping removes the boundary and keeps what was inside", () => {
  const { doc, id } = D.addGroup(base(), ["a", "b"], "system");
  const after = D.deleteGroup(doc, id);
  assert.equal(after.groups, undefined);
  assert.equal(after.nodes.length, 3, "the components survive their boundary");
  assert.deepEqual(after.nodes.map((n) => n.group), [undefined, undefined, undefined]);
});

check1("ungrouping an inner boundary hands its members to the outer one", () => {
  const outer = D.addGroup(base(), ["a", "b", "c"], "region");
  const inner = D.addGroup(outer.doc, ["a", "b"], "system");
  const after = D.deleteGroup(inner.doc, inner.id);
  assert.equal(after.groups.length, 1);
  assert.deepEqual(after.nodes.map((n) => n.group), [outer.id, outer.id, outer.id]);
});

check1("deleting a group with its contents takes the nested groups too", () => {
  const outer = D.addGroup(base(), ["a", "b", "c"], "region");
  const inner = D.addGroup(outer.doc, ["a", "b"], "system");
  assert.deepEqual(D.groupMembers(inner.doc, outer.id).sort(), ["a", "b", "c"]);
  assert.deepEqual(D.groupMembers(inner.doc, inner.id).sort(), ["a", "b"]);
  const after = D.deleteGroupDeep(inner.doc, outer.id);
  assert.equal(after.nodes.length, 0);
  assert.equal(after.groups, undefined);
  assert.equal(after.edges.length, 0, "edges go with the nodes they connected");
});

// ---------------------------------------------------------------- duplicate and reverse

check1("duplicating a selection copies the nodes and the edges inside it", () => {
  const { doc, map } = D.duplicateNodes(base(), ["a", "b"], catalogue);
  assert.equal(doc.nodes.length, 5);
  assert.equal(Object.keys(map).length, 2);
  assert.ok(!Object.values(map).includes("a"), "a copy gets its own id");
  assert.equal(doc.edges.length, 3, "a>b is copied, b>c has one end outside and is not");
  assert.deepEqual(doc.edges[2], { from: map.a, to: map.b, protocol: "http", mode: "sync" });
  assert.deepEqual(check(doc, catalogue, { file: "t" }), []);
});

check1("a duplicate keeps properties, labels and group", () => {
  const doc0 = D.addGroup(base(), ["a"], "system").doc;
  const withProps = D.setNodeProp(D.setNodeField(doc0, "a", "label", "Cache"), "a", "evictionPolicy", "lru");
  const { doc, map } = D.duplicateNodes(withProps, ["a"], catalogue);
  const copy = doc.nodes.find((n) => n.id === map.a);
  assert.equal(copy.label, "Cache");
  assert.equal(copy.props.evictionPolicy, "lru");
  assert.equal(copy.group, doc.groups[0].id);
});

check1("reversing an edge swaps its ends and keeps everything else", () => {
  const doc = D.reverseEdge(D.setEdgeField(base(), 0, "label", "writes"), 0);
  assert.deepEqual(doc.edges[0], { from: "b", to: "a", protocol: "http", mode: "sync", label: "writes" });
  assert.deepEqual(doc.edges[1], base().edges[1], "the other edges are untouched");
});

// ---------------------------------------------------------------- labels reach the file

check1("a label typed on the canvas is what lands in the file", () => {
  const text = D.newDesignText("t");
  const parsed = parse(text);
  let doc = D.normalize(parsed.doc).doc;
  doc.nodes = []; doc.edges = [];
  doc = D.addNode(doc, "redis", catalogue).doc;
  doc = D.addNode(doc, "postgres", catalogue).doc;
  doc = D.addEdge(doc, "redis", "postgres");
  doc = D.setNodeField(doc, "redis", "label", "Session cache");
  doc = D.setEdgeField(doc, 0, "label", "reads, writes");        // a comma, which flow style must survive
  doc = D.addGroup(doc, ["redis"], "system").doc;
  doc = D.setGroupField(doc, doc.groups[0].id, "label", "Edge: EU");
  const out = serialize(parsed.cst, doc);
  const back = YAML.parse(out);
  assert.equal(back.nodes[0].label, "Session cache");
  assert.equal(back.edges[0].label, "reads, writes");
  assert.equal(back.groups[0].label, "Edge: EU");
  assert.deepEqual(check(parse(out).doc, catalogue, { file: "t" }), []);
  assert.match(out, /^edges:$/m, "a list with entries is written as a block, not one flow line");
});

check1("clearing a label removes the key rather than writing an empty one", () => {
  const doc = D.setNodeField(D.setNodeField(base(), "a", "label", "x"), "a", "label", "");
  assert.equal("label" in doc.nodes[0], false);
  const edges = D.setEdgeField(D.setEdgeField(base(), 0, "label", "x"), 0, "label", "");
  assert.equal("label" in edges.edges[0], false);
});

// ---------------------------------------------------------------- names and ids

check1("a component is called by its name, and two of it are both called that", () => {
  const doc = base();
  assert.equal(D.displayName(catalogue, doc.nodes[0]), catalogue.locale.components.redis.name);
  assert.equal(D.displayName(catalogue, { id: "x-2", component: "redis", label: "Session cache" }), "Session cache");
  const twice = D.addNode(D.addNode(doc, "azure-functions", catalogue).doc, "azure-functions", catalogue).doc;
  const both = twice.nodes.slice(-2).map((n) => D.displayName(catalogue, n));
  assert.deepEqual(both, [both[0], both[0]], "both instances carry the component's one name");
  assert.match(both[0], /Function/);
});

check1("what a person types becomes a legal id", () => {
  assert.equal(D.toId("Azure Function"), "azure-function");
  assert.equal(D.toId("Orders / worker #2"), "orders-worker-2");
  assert.equal(D.toId("3rd party"), "n-3rd-party");
  assert.equal(D.toId("   "), "node");
});

check1("the counter in a generated id is recognised, a typed id is not", () => {
  assert.equal(D.isGeneratedId({ id: "azure-functions", component: "azure-functions" }), true);
  assert.equal(D.isGeneratedId({ id: "azure-functions-6", component: "azure-functions" }), true);
  assert.equal(D.isGeneratedId({ id: "orders-worker", component: "azure-functions" }), false);
});

check1("naming a node takes the counter out of its id, everywhere at once", () => {
  let doc = D.addNode(base(), "azure-functions", catalogue).doc;
  doc = D.addNode(doc, "azure-functions", catalogue).doc;
  assert.equal(doc.nodes[4].id, "azure-functions-2", "the second one starts with a counter");
  doc = D.addEdge(doc, "a", "azure-functions-2");
  const named = D.setNodeLabel(doc, "azure-functions-2", "Orders worker", catalogue);
  assert.equal(named.id, "orders-worker");
  assert.equal(named.doc.nodes[4].label, "Orders worker");
  assert.equal(named.doc.edges[2].to, "orders-worker", "the edge follows the rename");
  assert.deepEqual(check(named.doc, catalogue, { file: "t" }), []);
});

check1("an id someone typed is never renamed by naming the node", () => {
  const doc = D.renameNode(base(), "a", "session-cache", catalogue);
  const named = D.setNodeLabel(doc, "session-cache", "Something else", catalogue);
  assert.equal(named.id, "session-cache");
  assert.equal(named.doc.nodes[0].label, "Something else");
});

check1("two nodes named the same still get ids of their own", () => {
  let doc = D.addNode(base(), "azure-functions", catalogue).doc;
  doc = D.addNode(doc, "azure-functions", catalogue).doc;
  const first = D.setNodeLabel(doc, "azure-functions", "Worker", catalogue);
  const second = D.setNodeLabel(first.doc, "azure-functions-2", "Worker", catalogue);
  assert.equal(first.id, "worker");
  assert.equal(second.id, "worker-2");
  assert.deepEqual(check(second.doc, catalogue, { file: "t" }), []);
});

check1("ungrouping the last boundary takes the key out of the file", () => {
  const text = 'schemaVersion: "1"\ntype: "design"\nid: "x"\nnodes:\n  - { id: "a", component: "redis", group: "g" }\nedges: []\ngroups:\n  - { id: "g", kind: "system" }\n';
  const { doc, cst } = parse(text);
  const after = D.deleteGroup(doc, "g");
  const out = serialize(cst, after);
  assert.equal(/groups/.test(out), false, "no empty groups list is left behind");
  assert.equal(YAML.parse(out).groups, undefined);
  assert.deepEqual(check(parse(out).doc, catalogue, { file: "x" }), []);
});

// ---------------------------------------------------------------- export

check1("the three export formats are what their extensions say", async () => {
  assert.deepEqual(Object.keys(FORMATS).sort(), ["jpg", "png", "svg"]);
  assert.equal(FORMATS.png.mime, "image/png");
  assert.equal(FORMATS.jpg.mime, "image/jpeg");
  assert.equal(FORMATS.svg.mime, "image/svg+xml");
  assert.equal(FORMATS.jpg.ext, "jpg");
});

// A colour in the drawing is a CSS variable, and the export writes the value each one currently
// has. A name with no declaration resolves to nothing, which is a black box in someone's slide
// deck and nothing on screen to warn about it, so every name the scene can emit is checked.
check1("every colour the export can emit is a colour that exists", () => {
  const css = fs.readFileSync(path.join(ROOT, "editor/ui/style.css"), "utf8");
  const scene = fs.readFileSync(path.join(ROOT, "editor/ui/scene.js"), "utf8");
  const declared = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...scene.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]));
  // A node's fill is built from its category's hue, so those names are assembled here the way
  // the scene assembles them, from the same table.
  const table = /const CATEGORY_HUE = \{([\s\S]*?)\};/.exec(scene);
  assert.ok(table, "the category table could not be found in scene.js");
  const hues = [...table[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(hues.length >= 8, `only ${hues.length} categories have a colour`);
  for (const hue of hues.concat("grey")) {
    used.add(`--f-${hue}-fill`);
    used.add(`--f-${hue}-line`);
  }
  const missing = [...used].filter((name) => !declared.has(name));
  assert.deepEqual(missing, [], `the stylesheet declares no ${missing.join(", ")}`);
  assert.ok(used.has("--bg") && used.has("--ink"), "the export names the ground and the ink");
});

check1("an unknown export format is refused rather than written", async () => {
  await assert.rejects(() => exportScene({}, "x", "bmp"), /unknown format/);
});

for (const [name, fn] of queue) {
  try { await fn(); console.log("ok   " + name); }
  catch (e) { failed++; console.log("FAIL " + name + "\n     " + String(e.message).split("\n").slice(0, 6).join("\n     ")); }
}

console.log(`\n${failed ? failed + " FAILING" : "editing checks passed"}`);
process.exit(failed ? 1 : 0);
