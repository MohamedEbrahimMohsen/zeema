// An edge end may name a group: the edge runs to the group as a unit, drawn to its frame. The
// structure check accepts it, refuses an id that is both a node and a group, rules read a group
// end as every node inside it, and layout and geometry draw it to the frame border.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as D from "../src/document.js";
import { drawnLayout } from "../src/drawn.js";
import { edgeGeometry, groupFrames } from "../src/geometry.js";
import { layout } from "../src/layout.js";
import { toMermaid, toSvg } from "../src/render.js";
import { runRules } from "../src/rules.js";
import { check } from "../src/structure.js";
import { parse, serialize } from "../src/yaml.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogue = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));
const text = fs.readFileSync(path.join(here, "group-edges.yaml"), "utf8");
const load = () => parse(text).doc;
const groupIds = (doc) => new Set(doc.groups.map((g) => g.id));

const onBorder = ([x, y], [fx, fy, fw, fh]) => {
  const near = (a, b) => Math.abs(a - b) < 0.01;
  const inX = x >= fx - 0.01 && x <= fx + fw + 0.01;
  const inY = y >= fy - 0.01 && y <= fy + fh + 0.01;
  return ((near(x, fx) || near(x, fx + fw)) && inY) || ((near(y, fy) || near(y, fy + fh)) && inX);
};
const inside = (a, b) =>
  a[0] >= b[0] && a[1] >= b[1] && a[0] + a[2] <= b[0] + b[2] && a[1] + a[3] <= b[1] + b[3];

describe("edges to groups", () => {
  it("passes the structure check", () => {
    expect(check(load(), catalogue)).toEqual([]);
  });

  it("refuses an unknown end", () => {
    const doc = load();
    doc.edges.push({ from: "edge-lb", to: "nowhere", protocol: "http", mode: "sync" });
    const messages = check(doc, catalogue).map((f) => f.message);
    expect(messages).toEqual(["group-edges: edge to nowhere missing: no node or group"]);
  });

  it("reads an id that is both a node and a group as the node, everywhere", () => {
    const doc = load();
    doc.groups.push({ id: "db", kind: "system" });
    doc.nodes.find((n) => n.id === "edge-lb").group = "db";
    doc.edges.push({ from: "api-2", to: "db", protocol: "http", mode: "sync" });
    expect(check(doc, catalogue)).toEqual([]);
    const lay = layout(doc, catalogue);
    const e = lay.edges.at(-1);
    const end = e.points[e.points.length - 1];
    const box = [...lay.positions.db, ...lay.sizes.db];
    expect(onBorder(end, box)).toBe(true);
    expect(toMermaid(doc)).toContain('n_api_2 -->|"http"| n_db');
  });

  it("reads a group end as every member: a rule on a member trips the group edge", () => {
    const hits = runRules(load(), catalogue).filter(
      (h) => h.id === "retry-without-adaptive-shedding",
    );
    // edge 0 (to the cluster) reaches api-1 and api-2 and trips once; edge 4 (to a node) as ever
    expect(hits.map((h) => h.subject.ref)).toEqual([0, 4]);
    // the message names the edge as drawn, its group end included
    expect(hits[0].message).toContain("'cluster'");
  });

  it("still runs a rule that reads only the edge, once per drawn edge", () => {
    const rule = {
      id: "t-http",
      severity: "warning",
      select: { edge: {} },
      when: { field: "protocol", equals: "http" },
      message: "{{edge.from}} -> {{edge.to}}",
    };
    const hits = runRules(load(), { ...catalogue, rules: [rule] });
    expect(hits.map((h) => h.subject.ref)).toEqual([0, 3, 4]);
    expect(hits[0].message).toBe("edge-lb -> cluster");
  });

  it("reads crossesGroup on each member pair", () => {
    const rule = {
      id: "t-cross",
      severity: "warning",
      select: { edge: {} },
      when: { not: { crossesGroup: { kind: "system" } } },
      message: "x",
    };
    const hits = runRules(load(), { ...catalogue, rules: [rule] });
    // platform -> cluster pairs api-1 with api-2, both in the cluster: never crosses.
    // api-1 -> its own cluster pairs it with api-2 alone. The rest cross a system boundary.
    expect(hits.map((h) => h.subject.ref)).toEqual([2, 3]);
  });

  it("counts a group edge at every member for hasEdge, the same as drawn edges", () => {
    const rule = (direction, extra = {}) => ({
      id: `t-${direction}`,
      severity: "info",
      select: { node: {} },
      when: { hasEdge: { direction, ...extra } },
      message: "{{node.id}}",
    });
    const ids = (r, doc = load()) =>
      runRules(doc, { ...catalogue, rules: [r] }).map((h) => h.subject.ref);
    // into api-1: edge-lb -> cluster, platform -> cluster (from api-2 and db); into db: cluster -> data
    expect(ids(rule("in"))).toEqual(["api-1", "api-2", "db"]);
    // the drawn edge gives edge-lb a peer of a known kind at last
    const tomcat = catalogue.components.tomcat.kind;
    expect(ids(rule("out", { peerKind: tomcat }))).toEqual(["edge-lb", "api-1", "api-2", "db"]);
    // a count sees one edge per member pair: edge-lb reaches api-1, api-2 (edge 0) and api-2
    // (edge 4); api-1 reaches db (edge 1) and api-2 (edges 2 and 3)
    expect(ids(rule("out", { count: { eq: 3 } }))).toEqual(["edge-lb", "api-1"]);
  });

  it("follows a group edge in syncChainDepth", () => {
    const rule = {
      id: "t-depth",
      severity: "info",
      select: { node: {} },
      when: { syncChainDepth: { gt: 1 } },
      message: "{{node.id}}",
    };
    // edge-lb -> cluster (sync) -> data (sync): two hops through the groups' members
    const hits = runRules(load(), { ...catalogue, rules: [rule] }).map((h) => h.subject.ref);
    expect(hits).toContain("edge-lb");
  });

  it("reads an edge to a group with no member as drawn, skipping rules that read its end", () => {
    const doc = load();
    doc.groups.push({ id: "empty", kind: "system" });
    doc.edges.push({
      from: "edge-lb",
      to: "empty",
      protocol: "http",
      mode: "sync",
      retryPolicy: "fixed",
    });
    const i = doc.edges.length - 1;
    const refs = (rules) => runRules(doc, { ...catalogue, rules }).map((h) => h.subject.ref);
    const field = {
      id: "f",
      severity: "info",
      select: { edge: {} },
      when: { field: "protocol", equals: "http" },
      message: "x",
    };
    expect(refs([field])).toContain(i);
    const shed = catalogue.rules.find((r) => r.id === "retry-without-adaptive-shedding");
    expect(refs([shed])).not.toContain(i);
  });

  it("lays out with frames nested and draws every group edge to a frame border", () => {
    const doc = load();
    const lay = layout(doc, catalogue);
    expect(inside(lay.frames.cluster, lay.frames.platform)).toBe(true);
    expect(inside(lay.frames.data, lay.frames.platform)).toBe(true);
    for (const n of doc.nodes)
      if (n.group)
        expect(inside([...lay.positions[n.id], ...lay.sizes[n.id]], lay.frames[n.group])).toBe(
          true,
        );
    expect(lay.edges).toHaveLength(doc.edges.length);
    const groups = groupIds(doc);
    for (const e of lay.edges) {
      const first = e.points[0];
      const last = e.points[e.points.length - 1];
      if (groups.has(e.from)) expect(onBorder(first, lay.frames[e.from])).toBe(true);
      if (groups.has(e.to)) expect(onBorder(last, lay.frames[e.to])).toBe(true);
    }
    // a member to its own group ends on the frame side nearest the member
    const own = lay.edges[3];
    const end = own.points[own.points.length - 1];
    const b = [...lay.positions["api-1"], ...lay.sizes["api-1"]];
    const f = lay.frames.cluster;
    const gaps = [b[1] - f[1], f[0] + f[2] - b[0] - b[2], f[1] + f[3] - b[1] - b[3], b[0] - f[0]];
    const k = gaps.indexOf(Math.min(...gaps));
    const want = [end[1] === f[1], end[0] === f[0] + f[2], end[1] === f[1] + f[3], end[0] === f[0]];
    expect(want[k]).toBe(true);
  });

  it("puts a port on a frame exactly as on a node", () => {
    const lay = drawnLayout(load(), catalogue, {
      ports: { "edge-lb>cluster": { to: { side: "left", t: 0.5 } } },
      routing: "curved",
    });
    const f = lay.frames.cluster;
    const e = lay.edges[0];
    expect(e.points).toHaveLength(7);
    expect(e.points[6]).toEqual([f[0], f[1] + f[3] * 0.5]);
  });

  it("draws nothing to a group with no frame and never throws", () => {
    const doc = load();
    doc.groups.push({ id: "empty", kind: "system" });
    doc.edges.push({ from: "edge-lb", to: "empty", protocol: "http", mode: "sync" });
    const lay = layout(doc, catalogue);
    const boxes = {};
    for (const [id, p] of Object.entries(lay.positions)) boxes[id] = [...p, ...lay.sizes[id]];
    const drawn = edgeGeometry(doc, boxes, {}, {}, groupFrames(doc, boxes));
    expect(drawn.some((e) => e.to === "empty")).toBe(false);
    expect(drawn).toHaveLength(doc.edges.length - 1);
  });

  it("renders to SVG and Mermaid", () => {
    const doc = load();
    expect(toSvg(doc, catalogue).match(/marker-end/g)).toHaveLength(doc.edges.length);
    const mm = toMermaid(doc);
    expect(mm).toContain('n_edge_lb -->|"http"| n_g_cluster');
    expect(mm).toContain('n_g_platform -.->|"grpc"| n_g_cluster');
  });

  it("connects and reconnects to a group through the document operations", () => {
    const doc = load();
    expect(D.addEdge(doc, "db", "cluster").edges.at(-1)).toMatchObject({
      from: "db",
      to: "cluster",
    });
    const moved = D.reconnectEdge(doc, 4, "to", "data");
    expect(moved.refused).toBe(null);
    expect(moved.doc.edges[4].to).toBe("data");
    expect(D.reconnectEdge(doc, 1, "to", "cluster").refused).toBe("self-loop");
    expect(D.reconnectEdge(doc, 4, "to", "nope").refused).toBe("missing");
    // the reconnect writes only the one changed line
    const out = serialize(parse(text).cst, moved.doc);
    const before = text.split("\n");
    const after = out.split("\n");
    expect(after).toHaveLength(before.length);
    expect(after.filter((l, i) => l !== before[i])).toHaveLength(1);
  });

  it("renames a group's edges with it, and drops them with it", () => {
    const doc = load();
    const renamed = D.renameGroup(doc, "cluster", "pool");
    expect(renamed.edges.filter((e) => e.from === "pool" || e.to === "pool")).toHaveLength(4);
    expect(check(renamed, catalogue)).toEqual([]);
    expect(() => D.renameGroup(doc, "cluster", "db")).toThrow();
    expect(() => D.renameNode(doc, "db", "data", catalogue)).toThrow();
    const ungrouped = D.deleteGroup(doc, "cluster");
    expect(ungrouped.edges.some((e) => e.from === "cluster" || e.to === "cluster")).toBe(false);
    expect(check(ungrouped, catalogue)).toEqual([]);
    expect(check(D.deleteGroupDeep(doc, "platform"), catalogue)).toEqual([]);
  });
});
