// The parser contract (plan A7): byte-identical round trips on every committed design, parsed
// values equal to a reference YAML implementation, and a growing conformance corpus in which
// every construct is either parsed exactly like the reference or refused with a line number.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { normalize } from "../src/document.js";
import { lineAt, parse, serialize } from "../src/yaml.js";

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

// An edit to one edge rewrites that edge's lines and nothing else: comments above the first
// item, between items and after the last one stay where they were.
const splitLines = (t) => t.replace(/\r?\n$/, "").split(/\r?\n/);

describe("editing the first edge of every committed design", () => {
  const files = designs.filter((f) => path.basename(f) === "design.yaml");
  it("finds designs with edges", () => {
    expect(files.some((f) => parse(fs.readFileSync(f, "utf8")).doc.edges?.length)).toBe(true);
  });
  for (const file of files) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    const text = fs.readFileSync(file, "utf8");
    const { doc, cst } = parse(text);
    const entry = cst.root.entries.find((e) => e.key === "edges");
    const item = entry?.node.kind === "blockseq" ? entry.node.items[0] : null;
    if (!item) continue;
    it(`${rel}: changes only the first edge's line`, () => {
      const edited = JSON.parse(JSON.stringify(doc));
      edited.edges[0].label = `${edited.edges[0].label ?? ""} edited`.trim();
      const out = serialize(cst, edited);
      expect(parse(out).doc).toEqual(edited);
      const src = splitLines(text);
      const got = splitLines(out);
      // Everything outside the edge's own lines is untouched.
      expect(got.slice(0, item.lineStart)).toEqual(src.slice(0, item.lineStart));
      expect(got.slice(got.length - (src.length - item.lineEnd))).toEqual(src.slice(item.lineEnd));
      // A one-line edge, or one that already had a label, changes in place: one line differs.
      if (item.lineEnd - item.lineStart === 1 || doc.edges[0].label !== undefined) {
        expect(got.length).toBe(src.length);
        const changed = src.map((l, i) => (l === got[i] ? -1 : i)).filter((i) => i >= 0);
        expect(changed).toHaveLength(1);
        expect(changed[0]).toBeGreaterThanOrEqual(item.lineStart);
        expect(changed[0]).toBeLessThan(item.lineEnd);
      }
    });
  }
});

describe("trivia around a changed block", () => {
  const edit = (text, fn) => {
    const { doc, cst } = parse(text);
    fn(doc);
    return serialize(cst, doc);
  };

  it("keeps a comment between a key and the first item of its sequence", () => {
    const text =
      'edges:\n  # first\n\n  - { from: "a", to: "b" }\n  # second\n  - { from: "b", to: "c" }\n  # tail\nnext: 1\n';
    expect(edit(text, (d) => (d.edges[0].label = "x"))).toBe(
      text.replace('to: "b" }', 'to: "b", label: "x" }'),
    );
    expect(edit(text, (d) => (d.edges[1].label = "x"))).toBe(
      text.replace('to: "c" }', 'to: "c", label: "x" }'),
    );
  });

  it("keeps a comment between a key and the first key of its map", () => {
    const text = "meta:\n  # about\n  a: 1\n  # b next\n  b: 2\n  # tail\nnext: 1\n";
    expect(edit(text, (d) => (d.meta.a = 3))).toBe(text.replace("a: 1", "a: 3"));
    expect(edit(text, (d) => (d.meta.b = 3))).toBe(text.replace("b: 2", "b: 3"));
  });

  it("keeps comments inside and after a changed block item", () => {
    const text =
      'edges:\n  # first\n  - from: "a"\n    # to\n    to: "b"\n  # between\n  - from: "b"\n    to: "c"\n# end\n';
    expect(edit(text, (d) => (d.edges[0].to = "c"))).toBe(text.replace('to: "b"', 'to: "c"'));
    expect(edit(text, (d) => (d.edges[1].to = "a"))).toBe(text.replace('to: "c"', 'to: "a"'));
  });

  it("keeps an edge in place when it is reconnected onto another edge's endpoints", () => {
    const text =
      'edges:\n  # first\n  - { from: "a", to: "b", protocol: "x" }\n  - { from: "a", to: "c", protocol: "y" }\n';
    expect(edit(text, (d) => (d.edges[0].to = "c"))).toBe(
      text.replace('to: "b", protocol: "x"', 'to: "c", protocol: "x"'),
    );
  });
});

describe("lineAt", () => {
  const text = `# a comment
schemaVersion: "1"
id: "x"
nodes:
  - id: "a"
    component: "c"
  - id: "b"
    component: "d"
edges: [{ from: "a", to: "b" }]
`;
  const { cst } = parse(text);

  it("names the line of a key, an item and a field inside it", () => {
    expect(lineAt(cst, ["id"])).toBe(3);
    expect(lineAt(cst, ["nodes"])).toBe(4);
    expect(lineAt(cst, ["nodes", 1])).toBe(7);
    expect(lineAt(cst, ["nodes", 1, "component"])).toBe(8);
  });

  it("stops at the closest line it can follow, and says null when it cannot start", () => {
    expect(lineAt(cst, ["nodes", 1, "props", "tier"])).toBe(7);
    expect(lineAt(cst, ["edges", 0, "from"])).toBe(9);
    expect(lineAt(cst, ["nodes", 9])).toBe(4);
    expect(lineAt(cst, ["groups"])).toBeNull();
    expect(lineAt(cst, [])).toBeNull();
  });
});
