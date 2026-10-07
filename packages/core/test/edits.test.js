// Minimal-diff guarantee (plan A7.3) and document-operation cascades, over every committed
// design: each operation reparses to the same document the operation produced, a reference
// YAML implementation reads the output identically, and the diff is confined to the lines the
// edit needed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import * as D from "../src/document.js";
import { parse, serialize } from "../src/yaml.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..", "..");
const catalogue = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : d.name === "design.yaml" ? [p] : [];
  });
const designs = walk(path.join(ROOT, "designs"));

const changedLines = (a, b) => {
  const al = a.split("\n");
  const bl = b.split("\n");
  let head = 0;
  while (head < al.length && head < bl.length && al[head] === bl[head]) head++;
  let tail = 0;
  while (
    tail < al.length - head &&
    tail < bl.length - head &&
    al[al.length - 1 - tail] === bl[bl.length - 1 - tail]
  )
    tail++;
  return { removed: al.length - head - tail, added: bl.length - head - tail };
};

const roundTrip = (text, edit) => {
  const { doc, cst } = parse(text);
  const next = edit(doc);
  const out = serialize(cst, next);
  expect(YAML.parse(out)).toEqual(D.normalize(next).doc);
  expect(D.normalize(parse(out).doc).doc).toEqual(D.normalize(next).doc);
  return { out, diff: changedLines(text, out) };
};

describe("edits over committed designs", () => {
  for (const file of designs) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    const text = fs.readFileSync(file, "utf8");
    const base = D.normalize(parse(text).doc).doc;
    const firstNode = base.nodes[0];

    it(`${rel}: setting one prop changes one or two lines`, () => {
      const { diff } = roundTrip(text, (doc) =>
        D.setNodeField(doc, firstNode.id, "label", "Renamed for the test"),
      );
      expect(diff.removed).toBeLessThanOrEqual(1);
      expect(diff.added).toBeLessThanOrEqual(2);
    });

    it(`${rel}: adding a node adds lines only`, () => {
      const { diff } = roundTrip(text, (doc) => D.addNode(doc, "kafka", catalogue).doc);
      expect(diff.removed).toBe(0);
      expect(diff.added).toBeGreaterThanOrEqual(1);
    });

    it(`${rel}: deleting a node removes it and every edge that touched it`, () => {
      const { out } = roundTrip(text, (doc) => D.deleteNodes(doc, [firstNode.id], catalogue));
      const got = YAML.parse(out);
      expect(got.nodes.some((n) => n.id === firstNode.id)).toBe(false);
      expect(got.edges.some((e) => e.from === firstNode.id || e.to === firstNode.id)).toBe(false);
      for (const n of got.nodes)
        for (const v of Object.values(n.props ?? {})) expect(v).not.toBe(firstNode.id);
    });

    it(`${rel}: renaming a node updates every reference`, () => {
      const { out } = roundTrip(text, (doc) =>
        D.renameNode(doc, firstNode.id, "renamed-node", catalogue),
      );
      const got = YAML.parse(out);
      expect(got.nodes.some((n) => n.id === "renamed-node")).toBe(true);
      expect(got.nodes.some((n) => n.id === firstNode.id)).toBe(false);
      expect(got.edges.some((e) => e.from === firstNode.id || e.to === firstNode.id)).toBe(false);
      const refs = got.nodes.flatMap((n) =>
        Object.entries(n.props ?? {})
          .filter(([k]) => D.propDefs(catalogue, n.component)[k]?.type === "ref")
          .map(([, v]) => v),
      );
      expect(refs).not.toContain(firstNode.id);
    });

    if (base.edges.length) {
      it(`${rel}: reversing an edge keeps its other fields`, () => {
        const before = base.edges[0];
        const { out } = roundTrip(text, (doc) => D.reverseEdge(doc, 0));
        const after = YAML.parse(out).edges.find(
          (e) => e.from === before.to && e.to === before.from,
        );
        expect(after).toBeTruthy();
        for (const k of Object.keys(before))
          if (k !== "from" && k !== "to") expect(after[k]).toEqual(before[k]);
      });
    }

    if (base.edges.length) {
      it(`${rel}: setting an edge's auth touches one line, and clearing it restores the bytes`, () => {
        const was = base.edges[0].auth;
        const value = was === "mtls" ? "managed-identity" : "mtls";
        const { out, diff } = roundTrip(text, (doc) => D.setEdgeField(doc, 0, "auth", value));
        expect(diff.removed).toBeLessThanOrEqual(1);
        expect(diff.added).toBe(1);
        expect(YAML.parse(out).edges[0].auth).toBe(value);
        if (was === undefined) {
          const { cst, doc } = parse(out);
          expect(serialize(cst, D.setEdgeField(doc, 0, "auth", undefined))).toBe(text);
        }
      });
    }

    const moveTo = base.edges.length
      ? base.nodes.find(
          (n) =>
            n.id !== base.edges[0].from &&
            n.id !== base.edges[0].to &&
            !base.edges.some((o) => o.from === base.edges[0].from && o.to === n.id),
        )
      : null;
    if (moveTo) {
      it(`${rel}: reconnecting an edge's end is a one-field edit and keeps its other fields`, () => {
        const before = base.edges[0];
        const { out, diff } = roundTrip(
          text,
          (doc) => D.reconnectEdge(doc, 0, "to", moveTo.id).doc,
        );
        // Exactly the diff of setting that one field, and at most one line each way.
        expect(diff).toEqual(
          roundTrip(text, (doc) => D.setEdgeField(doc, 0, "to", moveTo.id)).diff,
        );
        expect(diff.added).toBe(1);
        const after = YAML.parse(out).edges[0];
        expect(after.to).toBe(moveTo.id);
        for (const k of Object.keys(before)) if (k !== "to") expect(after[k]).toEqual(before[k]);
      });
    }

    it(`${rel}: an unchanged document is byte identical`, () => {
      const { out, diff } = roundTrip(text, (doc) => doc);
      expect(out).toBe(text);
      expect(diff).toEqual({ removed: 0, added: 0 });
    });
  }
});

describe("document operations", () => {
  it("reconnectEdge refuses a self loop, an exact twin and a missing node", () => {
    const doc = {
      nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
      edges: [
        { from: "a", to: "b", protocol: "http", mode: "sync" },
        { from: "a", to: "c", protocol: "http", mode: "sync" },
        { from: "c", to: "b", protocol: "grpc", mode: "sync" },
      ],
    };
    expect(D.reconnectEdge(doc, 0, "to", "a")).toEqual({ doc, refused: "self-loop" });
    expect(D.reconnectEdge(doc, 0, "to", "c")).toEqual({ doc, refused: "duplicate" });
    expect(D.reconnectEdge(doc, 0, "to", "zz")).toEqual({ doc, refused: "missing" });
    expect(D.reconnectEdge(doc, 9, "to", "c").refused).toBe("missing");
    // Same ends as edge 2 but another protocol: a different edge, so allowed.
    const moved = D.reconnectEdge(doc, 0, "from", "c");
    expect(moved.refused).toBeNull();
    expect(moved.doc.edges[0]).toEqual({ from: "c", to: "b", protocol: "http", mode: "sync" });
    expect(doc.edges[0].from).toBe("a");
  });

  const text =
    'schemaVersion: "1"\ntype: "design"\nid: "x"\ngroups:\n  - { id: "g", kind: "system" }\n  - { id: "h", kind: "system" }\nnodes:\n  - { id: "a", component: "kafka", group: "g" }\n  - { id: "b", component: "postgres", group: "h" }\nedges: []\n';

  it("renaming a group onto an existing id is refused", () => {
    const { doc } = parse(text);
    expect(() => D.renameGroup(doc, "g", "h")).toThrow(/exists|taken|duplicate/i);
  });

  it("setRequirement refuses to walk through a scalar", () => {
    const { doc } = parse(
      'schemaVersion: "1"\ntype: "design"\nid: "x"\nrequirements:\n  availability: 99\nnodes:\n  - { id: "a", component: "kafka" }\nedges: []\n',
    );
    expect(() => D.setRequirement(doc, "availability.sla", "99.9")).toThrow(
      /not an object|scalar/i,
    );
    const ok = D.setRequirement(doc, "latency.p95Ms", 300);
    expect(ok.requirements.latency).toEqual({ p95Ms: 300 });
  });

  it("deleting a node clears ref props that pointed at it", () => {
    const cat = {
      kinds: {
        k: { id: "k", category: "data", properties: { peer: { type: "ref", refKind: "k" } } },
      },
      components: { c: { id: "c", kind: "k", provider: "default", defaults: {}, properties: {} } },
      rules: [],
    };
    const { doc } = parse(
      'schemaVersion: "1"\ntype: "design"\nid: "x"\nnodes:\n  - { id: "a", component: "c", props: { peer: "b" } }\n  - { id: "b", component: "c" }\nedges: []\n',
    );
    const next = D.deleteNodes(doc, ["b"], cat);
    expect(next.nodes).toEqual([{ id: "a", component: "c" }]);
  });
});

describe("copy and paste", () => {
  const cat = {
    kinds: {
      k: { id: "k", category: "data", properties: { peer: { type: "ref", refKind: "k" } } },
    },
    components: { c: { id: "c", kind: "k", provider: "default", defaults: {}, properties: {} } },
    rules: [],
  };
  // outer holds inner and z; inner holds x and y; w is outside every group.
  const doc = {
    groups: [
      { id: "outer", kind: "system" },
      { id: "inner", kind: "system", parent: "outer" },
    ],
    nodes: [
      { id: "x", component: "c", group: "inner", props: { peer: "y" } },
      { id: "y", component: "c", group: "inner", props: { peer: "w" } },
      { id: "z", component: "c", group: "outer" },
      { id: "w", component: "c" },
    ],
    edges: [
      { from: "x", to: "y", protocol: "http", mode: "sync" },
      { from: "y", to: "w", protocol: "http", mode: "sync" },
      { from: "w", to: "inner", protocol: "http", mode: "sync" },
      { from: "z", to: "inner", protocol: "http", mode: "sync" },
    ],
  };

  it("copies a group with everything inside it and the edges within", () => {
    const f = D.copyFragment(doc, [], ["outer"]);
    expect(f.groups.map((g) => g.id)).toEqual(["outer", "inner"]);
    expect(f.nodes.map((n) => n.id)).toEqual(["x", "y", "z"]);
    expect(f.edgeIndexes).toEqual([0, 3]);
    f.nodes[0].id = "changed";
    expect(doc.nodes[0].id).toBe("x");
  });

  it("duplicates a group in its own parent with fresh ids, the way Ctrl+D numbers them", () => {
    const {
      doc: next,
      map,
      edgeAt,
    } = D.pasteFragment(doc, D.copyFragment(doc, [], ["inner"]), cat);
    expect(map).toEqual({ inner: "inner-2", x: "x-2", y: "y-2" });
    expect(next.groups.at(-1)).toEqual({ id: "inner-2", kind: "system", parent: "outer" });
    // Inside the copy the references follow it; outside, they are kept.
    expect(next.nodes.find((n) => n.id === "x-2")).toMatchObject({
      group: "inner-2",
      props: { peer: "y-2" },
    });
    expect(next.nodes.find((n) => n.id === "y-2")).toMatchObject({
      group: "inner-2",
      props: { peer: "w" },
    });
    expect(next.edges.slice(doc.edges.length)).toEqual([
      { from: "x-2", to: "y-2", protocol: "http", mode: "sync" },
    ]);
    expect(edgeAt).toEqual([doc.edges.length]);
    expect(doc.edges).toHaveLength(4);
  });

  it("duplicates a mixed selection as one set", () => {
    const { doc: next, map } = D.pasteFragment(doc, D.copyFragment(doc, ["w"], ["inner"]), cat);
    expect(Object.keys(map).sort()).toEqual(["inner", "w", "x", "y"]);
    const added = next.edges.slice(doc.edges.length);
    expect(added).toContainEqual({ from: "y-2", to: "w-2", protocol: "http", mode: "sync" });
    expect(added).toContainEqual({ from: "w-2", to: "inner-2", protocol: "http", mode: "sync" });
  });

  it("drops what the other design does not have when pasted there", () => {
    const other = { nodes: [{ id: "x", component: "c" }], edges: [] };
    const { doc: next, map } = D.pasteFragment(other, D.copyFragment(doc, ["y"], ["inner"]), cat);
    expect(map.x).toBe("x-2");
    const inner = next.groups.find((g) => g.id === map.inner);
    expect(inner.parent).toBeUndefined();
    const y = next.nodes.find((n) => n.id === map.y);
    expect(y.props).toBeUndefined(); // its peer w is not in this design
    expect(next.nodes.find((n) => n.id === map.x).props).toEqual({ peer: map.y });
  });

  it("keeps duplicateNodes as it was for components", () => {
    const { doc: next, map } = D.duplicateNodes(doc, ["x", "y"], cat);
    expect(map).toEqual({ x: "x-2", y: "y-2" });
    expect(next.nodes.find((n) => n.id === "x-2").group).toBe("inner");
    expect(next.edges.slice(doc.edges.length)).toEqual([
      { from: "x-2", to: "y-2", protocol: "http", mode: "sync" },
    ]);
  });
});
