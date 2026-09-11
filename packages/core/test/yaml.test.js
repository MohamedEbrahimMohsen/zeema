// The parser contract (plan A7): byte-identical round trips on every committed design, parsed
// values equal to a reference YAML implementation, and a growing conformance corpus in which
// every construct is either parsed exactly like the reference or refused with a line number.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { normalize } from "../src/document.js";
import { parse, serialize } from "../src/yaml.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..", "..");

const walk = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
        const p = path.join(dir, d.name);
        return d.isDirectory() ? walk(p) : /^design(\.broken)?\.yaml$/.test(d.name) ? [p] : [];
      })
    : [];
const designs = walk(path.join(ROOT, "designs"));

describe("committed designs", () => {
  it("exist", () => expect(designs.length).toBeGreaterThan(20));
  for (const file of designs) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    const text = fs.readFileSync(file, "utf8");
    it(`${rel}: round-trips byte for byte`, () => {
      const { doc, cst } = parse(text);
      expect(serialize(cst, doc)).toBe(text);
    });
    it(`${rel}: parses like the reference implementation`, () => {
      expect(normalize(parse(text).doc).doc).toEqual(normalize(YAML.parse(text)).doc);
    });
  }
});

// Each corpus entry is either { text, same: true } (must parse identically to the reference) or
// { text, refuse: /message/ } (must throw, naming a line). Silent divergence is the one
// forbidden outcome.
const corpus = [
  {
    name: "sequence at the parent key's indent",
    text: 'schemaVersion: "1"\ntype: "design"\nid: "x"\nnodes:\n- { id: "a", component: "kafka" }\nedges: []\n',
  },
  {
    name: "comment line inside a block entry",
    text: 'schemaVersion: "1"\ntype: "design"\nid: "x"\nnodes:\n  - id: "a"\n    component: "kafka"\n    # note\n    label: "A"\n  - id: "b"\n    component: "kafka"\nedges: []\n',
  },
  {
    name: "blank line after a nested map key",
    text: 'schemaVersion: "1"\ntype: "design"\nid: "x"\nrequirements:\n\n  availability:\n    sla: "99.9"\nnodes:\n  - { id: "a", component: "kafka" }\nedges: []\n',
  },
  {
    name: "four-space indentation",
    text: 'schemaVersion: "1"\ntype: "design"\nid: "x"\nrequirements:\n    availability:\n        sla: "99.9"\nnodes:\n    - id: "a"\n      component: "kafka"\nedges: []\n',
  },
  {
    name: "nested block map inside a sequence entry",
    text: 'schemaVersion: "1"\ntype: "design"\nid: "x"\nnodes:\n  - id: "a"\n    component: "kafka"\n    props:\n      tier: "p"\nedges: []\n',
  },
  {
    name: "block map value on the next line at deeper indent",
    text: 'schemaVersion: "1"\ntype: "design"\nid: "x"\nrequirements:\n  availability:\n    multiRegion: true\n    sla: "99.95"\nnodes:\n  - { id: "a", component: "kafka" }\nedges: []\n',
  },
  {
    name: "empty block map and empty flow map",
    text: 'schemaVersion: "1"\ntype: "design"\nid: "x"\nrequirements: {}\nnodes:\n  - { id: "a", component: "kafka", props: {} }\nedges: []\n',
  },
  {
    name: "single-quoted and bare scalars with special characters",
    text: "schemaVersion: '1'\ntype: design\nid: x\nnodes:\n  - { id: a, component: kafka, label: 'A, B: C #1' }\nedges: []\n",
  },
  {
    name: "comment after a scalar and after a flow entry",
    text: 'schemaVersion: "1" # version\ntype: "design"\nid: "x"\nnodes:\n  - { id: "a", component: "kafka" } # first\nedges: [] # none yet\n',
  },
  {
    name: "block sequence of flow maps with trailing blank lines",
    text: 'schemaVersion: "1"\ntype: "design"\nid: "x"\nnodes:\n  - { id: "a", component: "kafka" }\n\n  - { id: "b", component: "kafka" }\n\nedges: []\n',
  },
  {
    name: "multi-line flow map",
    text: 'schemaVersion: "1"\ntype: "design"\nid: "x"\nnodes:\n  - { id: "a",\n      component: "kafka" }\nedges: []\n',
  },
  {
    name: "block map with quoted keys",
    text: 'schemaVersion: "1"\ntype: "design"\nid: "x"\nnodes:\n  - "id": "a"\n    "component": "kafka"\nedges: []\n',
  },
  {
    name: "document start marker",
    text: '---\nschemaVersion: "1"\ntype: "design"\nid: "x"\nnodes:\n  - { id: "a", component: "kafka" }\nedges: []\n',
  },
  {
    name: "anchors and aliases",
    text: 'schemaVersion: "1"\ntype: "design"\nid: "x"\nnodes:\n  - &a { id: "a", component: "kafka" }\n  - *a\nedges: []\n',
    refuse: /anchor|alias/i,
  },
  {
    name: "block scalar",
    text: 'schemaVersion: "1"\ntype: "design"\nid: "x"\nnodes:\n  - id: "a"\n    component: "kafka"\n    label: |\n      two\n      lines\nedges: []\n',
    refuse: /block scalar/i,
  },
  {
    name: "tab indentation",
    text: 'schemaVersion: "1"\ntype: "design"\nid: "x"\nnodes:\n\t- { id: "a", component: "kafka" }\nedges: []\n',
    refuse: /tab/i,
  },
  {
    name: "multiple documents",
    text: 'schemaVersion: "1"\ntype: "design"\nid: "x"\nnodes:\n  - { id: "a", component: "kafka" }\nedges: []\n---\nid: "y"\n',
    refuse: /document/i,
  },
];

describe("conformance corpus", () => {
  for (const c of corpus) {
    if (c.refuse) {
      it(`${c.name}: refused with a line number`, () => {
        let err;
        try {
          parse(c.text);
        } catch (e) {
          err = e;
        }
        expect(err, "must throw").toBeTruthy();
        expect(err.message).toMatch(c.refuse);
        expect(err.message).toMatch(/line \d+/);
      });
    } else {
      it(`${c.name}: parses like the reference and round-trips`, () => {
        const ref = YAML.parse(c.text);
        const { doc, cst } = parse(c.text);
        expect(doc).toEqual(ref);
        expect(serialize(cst, doc)).toBe(c.text);
      });
    }
  }
});

describe("emission", () => {
  it("writes an empty list as key: [] never a bare key", () => {
    const text =
      'schemaVersion: "1"\ntype: "design"\nid: "x"\nnodes:\n  - { id: "a", component: "kafka" }\nedges:\n  - { from: "a", to: "a", protocol: "x", mode: "sync" }\n';
    const { doc, cst } = parse(text);
    doc.edges = [];
    const out = serialize(cst, doc);
    expect(out).toContain("edges: []");
    expect(YAML.parse(out).edges).toEqual([]);
  });

  it("quotes a bare scalar whose new value would change meaning", () => {
    const text =
      "schemaVersion: '1'\ntype: design\nid: x\nnodes:\n  - { id: a, component: kafka, label: foo }\nedges: []\n";
    const { doc, cst } = parse(text);
    doc.nodes[0].label = "a, b";
    const out = serialize(cst, doc);
    expect(YAML.parse(out).nodes[0]).toEqual({ id: "a", component: "kafka", label: "a, b" });
    doc.nodes[0].label = "true";
    expect(YAML.parse(serialize(cst, doc)).nodes[0].label).toBe("true");
    doc.nodes[0].label = "x # y";
    expect(YAML.parse(serialize(cst, doc)).nodes[0].label).toBe("x # y");
  });

  it("removes a key whose value went away, leaving no empty section", () => {
    const text =
      'schemaVersion: "1"\ntype: "design"\nid: "x"\ngroups:\n  - { id: "g", kind: "system" }\nnodes:\n  - { id: "a", component: "kafka", group: "g" }\nedges: []\n';
    const { doc, cst } = parse(text);
    doc.groups = undefined;
    doc.nodes[0].group = undefined;
    const out = serialize(cst, doc);
    expect(out).not.toMatch(/groups/);
    expect(YAML.parse(out)).toEqual({
      schemaVersion: "1",
      type: "design",
      id: "x",
      nodes: [{ id: "a", component: "kafka" }],
      edges: [],
    });
  });
});
