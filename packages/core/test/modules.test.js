// A node that runs code may list the modules of that code (a modular monolith: API, IAM, OTP), and
// an edge end may name one as `node/module`. Rules read a module end as its node, an edge between
// two parts of one node is in-process (no mode, no protocol, invisible to rules, not drawn), and
// the collapsed box carries an "N modules" chip. moduleTiles is the expanded box's geometry.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { describeNode } from "../src/describe.js";
import {
  addEdge,
  addModule,
  canHostModules,
  copyFragment,
  deleteNodes,
  endNode,
  isInProcess,
  MODULE_HOST_KINDS,
  moduleOf,
  moveModule,
  pasteFragment,
  reconnectEdge,
  removeModule,
  renameNode,
  setEdgeField,
  setModuleLabel,
  splitEnd,
} from "../src/document.js";
import {
  edgeGeometry,
  edgeKeys,
  MODULE_GAP,
  MODULE_HEADER,
  MODULE_TILE_H,
  MODULE_TILE_MAX_W,
  MODULE_TILE_PAD,
  MODULE_TILE_W,
  moduleTiles,
} from "../src/geometry.js";
import { layout } from "../src/layout.js";
import { nodeDecor, toMermaid, toSvg } from "../src/render.js";
import { runRules } from "../src/rules.js";
import { check } from "../src/structure.js";
import { fitModuleLabel, moduleLabelWidth } from "../src/text.js";
import { parse, serialize } from "../src/yaml.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..", "..");
const fixture = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "schema", "design.schema.json"), "utf8"));
const catalogue = { ...fixture, schema };

// Derived from the fixture, never hard-coded: a host (app-server), a non-host and an SMS provider.
const byKind = (kind) =>
  Object.values(fixture.components).find((c) => c.kind === kind && c.provider === "default")?.id;
const APP = byKind("app-server");
const SMS = byKind("third-party-api");
const DB = byKind("sql-database");

const TEXT = [
  'schemaVersion: "1"',
  'type: "design"',
  'id: "monolith"',
  "nodes:",
  "  - id: backend",
  `    component: ${APP}`,
  "    # the code inside the box",
  "    modules:",
  '      - { id: api, label: "API" }',
  '      - { id: otp, label: "OTP" }',
  `  - { id: sms, component: ${SMS} }`,
  "edges:",
  "  - { from: backend/otp, to: sms, mode: sync, protocol: https }",
  "  - { from: backend/api, to: backend/otp }",
  "",
].join("\n");

const findings = (doc, cat = catalogue) => check(doc, cat).map((f) => f.message);

describe("modules: parse and serialise", () => {
  it("parses modules on a node and module edge ends as plain strings", () => {
    const { doc } = parse(TEXT);
    expect(doc.nodes[0].modules).toEqual([
      { id: "api", label: "API" },
      { id: "otp", label: "OTP" },
    ]);
    expect(doc.edges[0].from).toBe("backend/otp");
    expect(doc.edges[1]).toEqual({ from: "backend/api", to: "backend/otp" });
  });

  it("round-trips byte for byte, block style and CRLF included", () => {
    const { doc, cst } = parse(TEXT);
    expect(serialize(cst, doc)).toBe(TEXT);
    const block = TEXT.replace(
      '      - { id: api, label: "API" }',
      '      - id: api\n        label: "API" # the front door',
    );
    const b = parse(block);
    expect(serialize(b.cst, b.doc)).toBe(block);
    const crlf = TEXT.replace(/\n/g, "\r\n");
    const c = parse(crlf);
    expect(serialize(c.cst, c.doc)).toBe(crlf);
  });

  it("refuses unsupported YAML inside modules with a line number", () => {
    expect(() => parse(TEXT.replace("- { id: api", "- &a { id: api"))).toThrow(/line 9/);
  });

  it("passes the structure gate", () => {
    expect(findings(parse(TEXT).doc)).toEqual([]);
  });
});

describe("modules: helpers", () => {
  it("splitEnd, endNode, moduleOf", () => {
    const { doc } = parse(TEXT);
    expect(splitEnd("backend/otp")).toEqual({ node: "backend", module: "otp" });
    expect(splitEnd("sms")).toEqual({ node: "sms", module: null });
    expect(endNode("backend/otp")).toBe("backend");
    expect(endNode("sms")).toBe("sms");
    expect(moduleOf(doc, "backend/otp")).toEqual({ id: "otp", label: "OTP" });
    expect(moduleOf(doc, "backend")).toBeNull();
    expect(moduleOf(doc, "backend/nope")).toBeNull();
    expect(moduleOf(doc, "nope/otp")).toBeNull();
  });

  it("isInProcess: both ends in one node, one of them a module", () => {
    expect(isInProcess({ from: "backend/api", to: "backend/otp" })).toBe(true);
    expect(isInProcess({ from: "backend/api", to: "backend" })).toBe(true);
    expect(isInProcess({ from: "backend/otp", to: "sms" })).toBe(false);
    expect(isInProcess({ from: "a/x", to: "b/y" })).toBe(false);
    expect(isInProcess({ from: "a", to: "b" })).toBe(false);
  });

  it("canHostModules reads the node's component's kind", () => {
    expect(MODULE_HOST_KINDS).toEqual(["app-server", "worker", "client"]);
    expect(canHostModules(catalogue, { component: APP })).toBe(true);
    expect(canHostModules(catalogue, { component: byKind("worker") })).toBe(true);
    expect(canHostModules(catalogue, { component: byKind("client") })).toBe(true);
    expect(canHostModules(catalogue, { component: DB })).toBe(false);
    expect(canHostModules(catalogue, { component: "nope" })).toBe(false);
  });
});

describe("modules: structure gate", () => {
  it("refuses modules on a kind that does not host code", () => {
    const { doc } = parse(TEXT.replace(`component: ${APP}`, `component: ${DB}`));
    expect(findings(doc).some((m) => /node backend lists modules, but kind/.test(m))).toBe(true);
  });

  it("refuses a duplicate module id", () => {
    const { doc } = parse(
      TEXT.replace("id: otp", "id: api").replace(/backend\/otp/g, "backend/api"),
    );
    expect(findings(doc)).toContain("monolith: node backend duplicate module ids");
  });

  it("refuses an end naming a missing node or a missing module", () => {
    const { doc } = parse(TEXT.replace("from: backend/otp", "from: backend/sms"));
    expect(findings(doc)).toContain(
      "monolith: edge from backend/sms missing: node backend has no module sms",
    );
    const other = parse(TEXT.replace("from: backend/otp", "from: front/otp")).doc;
    expect(findings(other)).toContain("monolith: edge from front/otp missing: no node front");
  });

  it("refuses an in-process edge with a mode or protocol", () => {
    const { doc } = parse(
      TEXT.replace(
        "{ from: backend/api, to: backend/otp }",
        "{ from: backend/api, to: backend/otp, protocol: grpc }",
      ),
    );
    expect(findings(doc)).toEqual([
      "monolith: edge backend/api -> backend/otp is in-process (inside node backend) and takes no protocol",
    ]);
  });

  it("allows a label on an in-process edge: parses, round-trips, no finding", () => {
    const text = TEXT.replace(
      "{ from: backend/api, to: backend/otp }",
      '{ from: backend/api, to: backend/otp, label: "verify code" }',
    );
    const { doc, cst } = parse(text);
    expect(doc.edges[1]).toEqual({ from: "backend/api", to: "backend/otp", label: "verify code" });
    expect(serialize(cst, doc)).toBe(text);
    expect(findings(doc)).toEqual([]);
    expect(serialize(cst, setEdgeField(doc, 1, "label", "events"))).toBe(
      text.replace('label: "verify code"', 'label: "events"'),
    );
  });

  it("still requires mode and protocol on every other edge, a module edge included", () => {
    const { doc } = parse(TEXT.replace(", mode: sync, protocol: https", ""));
    expect(findings(doc)).toEqual([
      '/edges/0: missing required property "protocol"',
      '/edges/0: missing required property "mode"',
    ]);
  });

  it("refuses a badly shaped module through the schema", () => {
    const { doc } = parse(TEXT.replace('label: "API" }', 'label: "API", port: 8 }'));
    expect(findings(doc)).toContain('/nodes/0/modules/0: unknown property "port"');
    const empty = parse(TEXT).doc;
    empty.nodes[0].modules = [];
    empty.edges = [];
    expect(findings(empty)).toContain("/nodes/0/modules: needs at least 1 item, has 0");
  });

  it("allows an edge between modules of two different nodes as a network edge", () => {
    const text = TEXT.replace(
      `  - { id: sms, component: ${SMS} }`,
      `  - { id: sms, component: ${SMS} }\n  - id: worker\n    component: ${APP}\n    modules: [{ id: jobs }]`,
    ).replace("to: sms, mode", "to: worker/jobs, mode");
    expect(findings(parse(text).doc)).toEqual([]);
  });
});

describe("modules: setters", () => {
  it("addModule appends one line in the list's own style; refuses a duplicate", () => {
    const { doc, cst } = parse(TEXT);
    const next = addModule(doc, "backend", { id: "iam", label: "IAM" });
    expect(serialize(cst, next)).toBe(
      TEXT.replace(
        '      - { id: otp, label: "OTP" }\n',
        '      - { id: otp, label: "OTP" }\n      - { id: "iam", label: "IAM" }\n',
      ),
    );
    expect(doc.nodes[0].modules).toHaveLength(2); // the original is untouched
    expect(addModule(doc, "backend", { id: "api" })).toBe(doc);
    expect(addModule(doc, "nope", { id: "x" })).toBe(doc);
    expect(addModule(doc, "backend", { label: "Cache" }).nodes[0].modules[2]).toEqual({
      id: "cache",
      label: "Cache",
    });
  });

  it("addModule on a node with none writes a modules block", () => {
    const { doc, cst } = parse(TEXT);
    const out = serialize(cst, addModule(doc, "sms", { id: "a" }));
    expect(parse(out).doc.nodes[1].modules).toEqual([{ id: "a" }]);
  });

  it("setModuleLabel changes one line and removes with null", () => {
    const { doc, cst } = parse(TEXT);
    expect(serialize(cst, setModuleLabel(doc, "backend", "otp", "One-time"))).toBe(
      TEXT.replace('label: "OTP"', 'label: "One-time"'),
    );
    expect(serialize(cst, setModuleLabel(doc, "backend", "otp", null))).toBe(
      TEXT.replace('{ id: otp, label: "OTP" }', "{ id: otp }"),
    );
  });

  it("removeModule re-points its edge ends to the node and drops a resulting self loop", () => {
    const { doc, cst } = parse(TEXT);
    const next = removeModule(doc, "backend", "otp");
    expect(next.nodes[0].modules).toEqual([{ id: "api", label: "API" }]);
    expect(next.edges).toEqual([
      { from: "backend", to: "sms", mode: "sync", protocol: "https" },
      { from: "backend/api", to: "backend" },
    ]);
    const out = serialize(cst, next);
    expect(out).toContain("  - { from: backend, to: sms, mode: sync, protocol: https }");
    expect(out).not.toContain("OTP");
    const bare = removeModule(next, "backend", "api");
    expect(bare.nodes[0].modules).toBeUndefined();
    expect(bare.edges).toEqual([{ from: "backend", to: "sms", mode: "sync", protocol: "https" }]);
    expect(removeModule(doc, "backend", "nope")).toBe(doc);
  });

  it("moveModule reorders the list, one entry moving, edges untouched", () => {
    const { doc, cst } = parse(TEXT);
    const next = moveModule(doc, "backend", "otp", 0);
    expect(next.nodes[0].modules.map((m) => m.id)).toEqual(["otp", "api"]);
    expect(next.edges).toEqual(doc.edges);
    const api = '      - { id: api, label: "API" }\n';
    const otp = '      - { id: otp, label: "OTP" }\n';
    expect(serialize(cst, next)).toBe(TEXT.replace(api + otp, otp + api));
    expect(doc.nodes[0].modules[0].id).toBe("api"); // the original is untouched
    // clamped to the list; refused where nothing would change or nothing is there
    expect(moveModule(doc, "backend", "api", 9).nodes[0].modules.map((m) => m.id)).toEqual([
      "otp",
      "api",
    ]);
    expect(moveModule(doc, "backend", "api", 0)).toBe(doc);
    expect(moveModule(doc, "backend", "nope", 0)).toBe(doc);
    expect(moveModule(doc, "nope", "api", 1)).toBe(doc);
    // a block-style entry moves whole, its comment with it
    const apiBlock = '      - id: api\n        label: "API" # the front door\n';
    const block = TEXT.replace(api, apiBlock);
    const b = parse(block);
    expect(serialize(b.cst, moveModule(b.doc, "backend", "api", 1))).toBe(
      block.replace(apiBlock + otp, otp + apiBlock),
    );
  });

  it("renameNode, deleteNodes and copy/paste follow module ends", () => {
    const { doc } = parse(TEXT);
    const renamed = renameNode(doc, "backend", "core", catalogue);
    expect(renamed.edges.map((e) => [e.from, e.to])).toEqual([
      ["core/otp", "sms"],
      ["core/api", "core/otp"],
    ]);
    expect(deleteNodes(doc, ["backend"], catalogue).edges).toEqual([]);
    const frag = copyFragment(doc, ["backend", "sms"]);
    expect(frag.edgeIndexes).toEqual([0, 1]);
    const pasted = pasteFragment(doc, frag, catalogue);
    expect(pasted.doc.edges.slice(2).map((e) => [e.from, e.to])).toEqual([
      ["backend-2/otp", "sms-2"],
      ["backend-2/api", "backend-2/otp"],
    ]);
  });

  it("addEdge, setEdgeField and reconnectEdge keep an in-process edge free of mode and protocol", () => {
    const { doc } = parse(TEXT);
    const added = addEdge(doc, "backend/otp", "backend/api");
    expect(added.edges[2]).toEqual({ from: "backend/otp", to: "backend/api" });
    expect(setEdgeField(doc, 1, "label", "verify").edges[1]).toEqual({
      from: "backend/api",
      to: "backend/otp",
      label: "verify",
    });
    const inward = reconnectEdge(doc, 0, "to", "backend/api");
    expect(inward.refused).toBeNull();
    expect(inward.doc.edges[0]).toEqual({ from: "backend/otp", to: "backend/api" });
    const outward = reconnectEdge(doc, 1, "to", "sms");
    expect(outward.doc.edges[1]).toEqual({
      from: "backend/api",
      to: "sms",
      protocol: "http",
      mode: "sync",
    });
    expect(reconnectEdge(doc, 0, "to", "backend/nope").refused).toBe("missing");
    expect(reconnectEdge(doc, 0, "to", "sms/otp").refused).toBe("missing");
    // an end set onto a module of the same node drops mode and protocol
    expect(setEdgeField(doc, 0, "to", "backend/api").edges[0]).toEqual({
      from: "backend/otp",
      to: "backend/api",
    });
  });
});

describe("modules: rules", () => {
  const hasEdgeRule = {
    id: "t-called-by-app",
    severity: "warning",
    select: { node: { kind: "third-party-api" } },
    when: { hasEdge: { direction: "in", peerKind: "app-server" } },
    message: "{{node.id}} is called by an app",
  };
  const edgeRule = {
    id: "t-from-app",
    severity: "info",
    select: { edge: {} },
    when: { from: { kind: "app-server" } },
    message: "{{edge.from}} -> {{edge.to}}",
  };
  const anyEdge = {
    id: "t-any-edge",
    severity: "info",
    select: { node: { kind: "app-server" } },
    when: { hasEdge: { direction: "any" } },
    message: "{{node.id}} has an edge",
  };
  const noProtocol = {
    id: "t-no-protocol",
    severity: "info",
    select: { edge: {} },
    when: { field: "protocol", exists: false },
    message: "no protocol",
  };
  const cat = { ...fixture, rules: [hasEdgeRule, edgeRule, anyEdge, noProtocol] };

  it("reads a module end as its node, for hasEdge and for from/to", () => {
    const hits = runRules(parse(TEXT).doc, cat);
    expect(hits.find((h) => h.id === "t-called-by-app")?.subject).toEqual({
      type: "node",
      ref: "sms",
    });
    const edge = hits.filter((h) => h.id === "t-from-app");
    expect(edge).toHaveLength(1);
    // the finding keeps the ends as written, so the canvas can point at the module
    expect(edge[0].subject).toEqual({ type: "edge", ref: 0, from: "backend/otp", to: "sms" });
    expect(edge[0].message).toBe("backend/otp -> sms");
  });

  it("matches exactly as the same edge drawn to the node does", () => {
    const plain = parse(TEXT).doc;
    plain.edges = [{ from: "backend", to: "sms", mode: "sync", protocol: "https" }];
    const ids = (d) => runRules(d, cat).map((h) => `${h.id}:${h.subject.ref}`);
    expect(ids(parse(TEXT).doc)).toEqual(ids(plain));
  });

  it("never sees an in-process edge", () => {
    const { doc } = parse(TEXT);
    doc.edges = [doc.edges[1]];
    expect(runRules(doc, cat)).toEqual([]);
  });
});

describe("modules: drawing", () => {
  it("nodeDecor puts an N modules chip leftmost in the chip row", () => {
    const d = nodeDecor(176, 78, { count: 3, dlq: true, modules: 2 });
    expect(d.chips.map((c) => c.id)).toEqual(["dlq", "count", "modules"]);
    expect(d.chips[2].text).toBe("2 modules");
    expect(d.chips[2].x).toBeLessThan(d.chips[1].x);
    expect(nodeDecor(176, 78, { modules: 1 }).chips[0].text).toBe("1 module");
    expect(nodeDecor(176, 78, { modules: 1 }).cards).toEqual([]);
    expect(nodeDecor(176, 78, { modules: 0 })).toBeNull();
  });

  it("moduleTiles lays rows of up to three tiles under the header", () => {
    expect(moduleTiles({ id: "x" }, 176)).toBeNull();
    const node = { modules: ["a", "b", "c", "d"].map((id) => ({ id })) };
    const t = moduleTiles(node, 176);
    const gridW = 3 * MODULE_TILE_W + 2 * MODULE_GAP;
    expect(t.w).toBe(gridW + 2 * MODULE_GAP);
    expect(t.h).toBe(MODULE_HEADER + 2 * MODULE_TILE_H + MODULE_GAP + MODULE_GAP);
    expect(t.tiles.map((x) => [x.id, x.x, x.y, x.w, x.h])).toEqual([
      ["a", MODULE_GAP, MODULE_HEADER, MODULE_TILE_W, MODULE_TILE_H],
      ["b", MODULE_GAP + (MODULE_TILE_W + MODULE_GAP), MODULE_HEADER, MODULE_TILE_W, MODULE_TILE_H],
      [
        "c",
        MODULE_GAP + 2 * (MODULE_TILE_W + MODULE_GAP),
        MODULE_HEADER,
        MODULE_TILE_W,
        MODULE_TILE_H,
      ],
      ["d", MODULE_GAP, MODULE_HEADER + MODULE_TILE_H + MODULE_GAP, MODULE_TILE_W, MODULE_TILE_H],
    ]);
    const wide = moduleTiles({ modules: [{ id: "a" }] }, 400);
    expect(wide.w).toBe(400);
    expect(wide.tiles[0].x).toBe((400 - MODULE_TILE_W) / 2);
    expect(wide.h).toBe(MODULE_HEADER + MODULE_TILE_H + MODULE_GAP);
  });

  it("moduleTiles sizes every tile of a node to its widest label, and the box to the tiles", () => {
    const node = {
      modules: [
        { id: "iam", label: "IAM" },
        { id: "notifications", label: "Notifications" },
        { id: "audit", label: "Audit Logs" },
      ],
    };
    const t = moduleTiles(node, 176);
    const tileW = Math.ceil(moduleLabelWidth("Notifications") + MODULE_TILE_PAD);
    expect(tileW).toBeGreaterThan(MODULE_TILE_W);
    expect(new Set(t.tiles.map((x) => x.w))).toEqual(new Set([tileW]));
    // the label fits its tile with the padding to spare, uncut
    expect(fitModuleLabel("Notifications", tileW - MODULE_TILE_PAD)).toBe("Notifications");
    expect(t.w).toBe(3 * tileW + 4 * MODULE_GAP);
    expect(t.tiles.map((x) => x.x)).toEqual(
      [0, 1, 2].map((k) => MODULE_GAP + k * (tileW + MODULE_GAP)),
    );
    // the label, else the id, is what is measured; a module of a short name keeps the floor
    expect(moduleTiles({ modules: [{ id: "notifications" }] }, 0).tiles[0].w).toBe(tileW);
    expect(moduleTiles({ modules: [{ id: "a", label: "OTP" }] }, 0).tiles[0].w).toBe(MODULE_TILE_W);
    // a label too long for any tile is held to the widest tile, and cut to fit it
    const long = "A very long module label that would never fit a tile";
    const capped = moduleTiles({ modules: [{ id: "x", label: long }] }, 0);
    expect(capped.tiles[0].w).toBe(MODULE_TILE_MAX_W);
    const cut = fitModuleLabel(long, MODULE_TILE_MAX_W - MODULE_TILE_PAD);
    expect(cut.endsWith("…")).toBe(true);
    expect(moduleLabelWidth(cut)).toBeLessThanOrEqual(MODULE_TILE_MAX_W - MODULE_TILE_PAD);
    // a measure of the caller's own
    expect(moduleTiles(node, 0, () => 100).tiles[0].w).toBe(100 + MODULE_TILE_PAD);
  });

  it("layout draws a module edge to the node box and leaves the in-process edge out", () => {
    const { doc } = parse(TEXT);
    const lay = layout(doc, catalogue);
    expect(lay.edges).toHaveLength(1);
    const e = lay.edges[0];
    expect([e.from, e.to, e.fromModule, e.toModule]).toEqual(["backend", "sms", "otp", undefined]);
    expect(e.key).toBe(edgeKeys(doc)[0]);
    // the ends sit on the boxes of backend and sms
    const [bx, by] = lay.positions.backend;
    const [bw, bh] = lay.sizes.backend;
    const [sx, sy] = e.points[0];
    expect(sx >= bx - 0.5 && sx <= bx + bw + 0.5 && sy >= by - 0.5 && sy <= by + bh + 0.5).toBe(
      true,
    );
  });

  it("edgeGeometry draws a module end to its tile when moduleBoxes gives one", () => {
    const { doc } = parse(TEXT);
    const boxes = { backend: [0, 0, 300, 160], sms: [600, 40, 176, 64] };
    const tiles = moduleTiles(doc.nodes[0], 300);
    const otp = tiles.tiles.find((t) => t.id === "otp");
    const tile = [otp.x, otp.y, otp.w, otp.h];
    for (const routing of ["orthogonal", "bundled", "curved"]) {
      const plain = edgeGeometry(doc, boxes, {}, {}, {}, { routing });
      const out = edgeGeometry(
        doc,
        boxes,
        {},
        {},
        {},
        {
          routing,
          moduleBoxes: { "backend/otp": tile, "backend/api": [12, 44, 84, 40] },
        },
      );
      // still one drawn edge, the in-process one left out, ends as node ids
      expect(out).toHaveLength(1);
      expect([out[0].from, out[0].to, out[0].fromModule]).toEqual(["backend", "sms", "otp"]);
      // it leaves the tile, not the node box
      const [x, y] = out[0].points[0];
      const on = (b) =>
        x >= b[0] - 0.5 && x <= b[0] + b[2] + 0.5 && y >= b[1] - 0.5 && y <= b[1] + b[3] + 0.5;
      expect(on(tile)).toBe(true);
      expect(plain[0].points[0]).not.toEqual(out[0].points[0]);
    }
  });

  it("the collapsed SVG carries the chip, lists the modules in hover text, draws one arrow", () => {
    const svg = toSvg(parse(TEXT).doc, catalogue);
    expect(svg).toContain(">2 modules</text>");
    expect(svg).toContain("modules: API, OTP</title>");
    expect(svg.match(/marker-end="url\(#a\)"/g)).toHaveLength(1);
  });

  it("Mermaid draws the module edge from the node and skips the in-process one", () => {
    const m = toMermaid(parse(TEXT).doc);
    expect(m).toContain('n_backend -->|"https"| n_sms');
    expect(m).not.toContain("backend_otp");
    expect(m.split("\n").filter((l) => l.includes("-->"))).toHaveLength(1);
  });

  it("describeNode lists the modules", () => {
    expect(describeNode(parse(TEXT).doc.nodes[0], catalogue)).toBe(
      `Node "backend" is ${APP}. It runs 2 modules: API (api), OTP (otp).`,
    );
  });
});
