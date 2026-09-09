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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, "editor/data/catalogue.json"), "utf8"));
let failed = 0;
const check1 = (name, fn) => {
  try { fn(); console.log("ok   " + name); }
  catch (e) { failed++; console.log("FAIL " + name + "\n     " + String(e.message).split("\n").slice(0, 6).join("\n     ")); }
};

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

console.log(`\n${failed ? failed + " FAILING" : "editing checks passed"}`);
process.exit(failed ? 1 : 0);
