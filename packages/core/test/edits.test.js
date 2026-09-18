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

    it(`${rel}: an unchanged document is byte identical`, () => {
      const { out, diff } = roundTrip(text, (doc) => doc);
      expect(out).toBe(text);
      expect(diff).toEqual({ removed: 0, added: 0 });
    });
  }
});

describe("document operations", () => {
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
