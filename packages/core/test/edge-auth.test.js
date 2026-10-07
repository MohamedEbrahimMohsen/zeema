// An edge's `auth`: how the hop authenticates. The structure check takes the nine values and
// refuses anything else, the two rules read it (and the `kind` and `provider` predicates they
// need), the drawing puts a glyph on the line beside the source end, and Mermaid carries it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { authAt, edgeGeometry } from "../src/geometry.js";
import { authGlyph, toMermaid, toSvg } from "../src/render.js";
import { runRules } from "../src/rules.js";
import { check } from "../src/structure.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..", "..");
const fixture = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "schema", "design.schema.json"), "utf8"));
const rule = (id) => YAML.parse(fs.readFileSync(path.join(ROOT, "rules", `${id}.yaml`), "utf8"));
const AUTH = schema.properties.edges.items.properties.auth.enum;

// A component of a kind from a provider, found in the fixture rather than named here.
const pick = (kind, provider) =>
  Object.values(fixture.components).find(
    (c) => c.kind === kind && (provider ? c.provider === provider : c.provider === "default"),
  )?.id;
const app = pick("app-server");
const awsDb = pick("sql-database", "aws");
const db = pick("sql-database");
const lb = pick("load-balancer");

const catalogue = {
  ...fixture,
  schema,
  rules: [rule("edge-auth-unset"), rule("edge-auth-key-where-identity")],
};
const design = (edges, requirements) => ({
  schemaVersion: "1",
  type: "design",
  id: "auth",
  ...(requirements ? { requirements } : {}),
  nodes: [
    { id: "api", component: app },
    { id: "db", component: db },
    { id: "rds", component: awsDb },
    { id: "lb", component: lb },
  ],
  edges,
});
const edge = (to, auth) => ({
  from: "api",
  to,
  protocol: "postgres",
  mode: "sync",
  ...(auth ? { auth } : {}),
});
const fired = (doc) => runRules(doc, catalogue).map((f) => [f.id, f.subject.ref]);

describe("edge auth", () => {
  it("finds the components it needs in the fixture", () => {
    expect([app, awsDb, db, lb].every(Boolean)).toBe(true);
  });

  it("accepts every value the schema lists and refuses any other", () => {
    for (const a of AUTH) expect(check(design([edge("db", a)]), catalogue)).toEqual([]);
    const bad = check(design([edge("db", "password")]), catalogue);
    expect(bad).toHaveLength(1);
    expect(bad[0].subject).toEqual({ type: "edge", ref: 0 });
    expect(bad[0].message).toMatch(/auth/);
  });

  it("edge-auth-unset fires only when the design asks, and only into data, secrets or AI", () => {
    const edges = [edge("db"), edge("lb"), edge("rds", "iam-role")];
    expect(fired(design(edges))).toEqual([]);
    expect(fired(design(edges, { security: { edgeAuthDeclared: true } }))).toEqual([
      ["edge-auth-unset", 0],
    ]);
  });

  it("edge-auth-key-where-identity fires on a key or password into a cloud service", () => {
    const doc = design([
      edge("rds", "basic"),
      edge("rds", "api-key"),
      edge("rds", "iam-role"),
      edge("db", "basic"),
    ]);
    expect(fired(doc)).toEqual([
      ["edge-auth-key-where-identity", 0],
      ["edge-auth-key-where-identity", 1],
    ]);
  });

  it("reads an edge to a group as reaching every member, for both auth rules", () => {
    const doc = {
      ...design([edge("stores", "api-key"), edge("plain", "basic"), edge("stores")], {
        security: { edgeAuthDeclared: true },
      }),
      groups: [
        { id: "stores", kind: "system" },
        { id: "plain", kind: "system" },
      ],
    };
    doc.nodes = doc.nodes.map((n) =>
      n.id === "rds" || n.id === "db" ? { ...n, group: n.id === "rds" ? "stores" : "plain" } : n,
    );
    // stores holds the AWS database: a key into it fires; plain holds the default one: it does not.
    // The unset edge into the group of data stores fires edge-auth-unset, once.
    expect(fired(doc)).toEqual([
      ["edge-auth-unset", 2],
      ["edge-auth-key-where-identity", 0],
    ]);
  });

  it("draws a glyph for every value but none, on the line near the source end", () => {
    for (const a of AUTH) expect(Boolean(authGlyph(a))).toBe(a !== "none");
    expect(authGlyph(undefined)).toBeNull();
    expect(authGlyph("constructor")).toBeNull();
    const doc = design([edge("db", "managed-identity"), edge("lb", "none"), edge("rds")]);
    const svg = toSvg(doc, fixture);
    expect(svg.match(/<title>auth: /g)).toHaveLength(1);
    expect(svg).toContain("<title>auth: managed-identity</title>");
  });

  it("draws a cloud's identity as its catalogue icon, and an outline elsewhere", () => {
    const icons = {
      "azure-managed-identity": '<path id="mi-mark" d="M0 0h24v24z"/>',
      "aws-iam": '<path id="iam-mark" d="M0 0h24v24z"/>',
    };
    const doc = design([edge("db", "managed-identity"), edge("lb", "api-key")]);
    const svg = toSvg(doc, fixture, { icons });
    expect(svg).toContain('<path id="mi-mark"');
    expect(svg).not.toContain('<path id="iam-mark"');
    expect(svg).toContain(`d="${authGlyph("api-key").path}"`);
    expect(authGlyph("iam-role").icon).toBe("aws-iam");
    expect(authGlyph("service-account").icon).toBe("google-cloud-iam");
    // Each mark is a component the catalogue has, with an icon on disk.
    for (const [provider, id] of [
      ["azure", "azure-managed-identity"],
      ["aws", "aws-iam"],
      ["gcp", "google-cloud-iam"],
    ]) {
      expect(fs.existsSync(path.join(ROOT, "components", provider, `${id}.yaml`))).toBe(true);
      expect(fs.existsSync(path.join(ROOT, "icons", "components", provider, `${id}.svg`))).toBe(
        true,
      );
    }
    // Without the icon, the identity falls back to the shield.
    expect(toSvg(doc, fixture)).toContain(`d="${authGlyph("managed-identity").path}"`);
  });

  it("puts the glyph a short step from the source, off the corners and the arrowhead", () => {
    const straight = {
      points: [
        [0, 0],
        [300, 0],
      ],
    };
    expect(authAt(straight)).toEqual([20, 0]);
    // Too short for the step clear of the arrowhead: the middle.
    expect(
      authAt({
        points: [
          [0, 0],
          [30, 0],
        ],
      }),
    ).toEqual([15, 0]);
    // A first segment too short for the step: the step along the next one, clear of the corner.
    expect(
      authAt({
        ortho: true,
        points: [
          [0, 0],
          [0, 10],
          [100, 10],
        ],
      }),
    ).toEqual([20, 10]);
    // A long first segment keeps the step.
    expect(
      authAt({
        ortho: true,
        points: [
          [75, 56],
          [75, 128],
          [475, 128],
          [475, 200],
        ],
      }),
    ).toEqual([75, 76]);
    const curve = {
      points: [
        [0, 0],
        [150, 120],
        [300, 0],
      ],
    };
    const [x, y] = authAt(curve);
    expect(Math.hypot(x, y)).toBeGreaterThan(18);
    expect(Math.hypot(x, y)).toBeLessThan(21);
  });

  // Every corner of a drawn orthogonal edge, and the distance from (x, y) to the nearest.
  const nearestCorner = (d, [x, y]) =>
    Math.min(...d.points.slice(1, -1).map(([cx, cy]) => Math.hypot(cx - x, cy - y)));
  const W = 150,
    H = 56;

  it("keeps the glyph off the corner a short first stub makes", () => {
    // The route leaves `a`'s bottom, turns after a stub shorter than the step, runs across, and
    // drops into `b`; a second edge from `a` runs beside it.
    const boxes = { a: [0, 0, W, H], b: [300, 120, W, H], c: [50, 120, W, H] };
    const doc = {
      edges: [
        { from: "a", to: "b", protocol: "https", mode: "sync", auth: "api-key" },
        { from: "a", to: "c", protocol: "https", mode: "sync" },
      ],
    };
    const d = edgeGeometry(doc, boxes)[0];
    const [p, q] = d.points;
    expect(Math.hypot(q[0] - p[0], q[1] - p[1])).toBeLessThan(30);
    const at = authAt(d);
    expect(nearestCorner(d, at)).toBeGreaterThanOrEqual(10);
    expect(Math.hypot(at[0] - p[0], at[1] - p[1])).toBeGreaterThanOrEqual(10);
  });

  it("puts each bundled member's glyph on its own branch, never on the shared trunk", () => {
    const fan = (out) => {
      const boxes = { hub: [out ? 0 : 420, 250, W, H] };
      const edges = [];
      for (let k = 0; k < 4; k++) {
        boxes[`n${k}`] = [out ? 420 : 0, 40 + k * 140, W, H];
        const [from, to] = out ? ["hub", `n${k}`] : [`n${k}`, "hub"];
        edges.push({ from, to, protocol: "https", mode: "sync", auth: "mtls" });
      }
      return edgeGeometry({ edges }, boxes, {}, {}, {}, { routing: "bundled" });
    };
    for (const out of [true, false]) {
      const drawn = fan(out);
      const at = drawn.map(authAt);
      // Distinct places, each on a run no other member shares.
      expect(new Set(at.map((p) => p.join(","))).size).toBe(drawn.length);
      // ...and no two discs overlap.
      for (const p of at)
        for (const q of at)
          if (p !== q) expect(Math.hypot(p[0] - q[0], p[1] - q[1])).toBeGreaterThanOrEqual(14);
      drawn.forEach((d, k) => {
        const [x, y] = at[k];
        const run = d.points
          .slice(1)
          .map((q, j) => [d.points[j], q])
          .find(
            ([p, q]) =>
              x >= Math.min(p[0], q[0]) - 0.1 &&
              x <= Math.max(p[0], q[0]) + 0.1 &&
              y >= Math.min(p[1], q[1]) - 0.1 &&
              y <= Math.max(p[1], q[1]) + 0.1,
          );
        expect(run).toBeTruthy();
        for (const other of drawn.filter((o) => o !== d))
          for (let j = 1; j < other.points.length; j++) {
            const [p, q] = [other.points[j - 1], other.points[j]];
            const near =
              x >= Math.min(p[0], q[0]) - 9 &&
              x <= Math.max(p[0], q[0]) + 9 &&
              y >= Math.min(p[1], q[1]) - 9 &&
              y <= Math.max(p[1], q[1]) + 9;
            expect(near).toBe(false);
          }
        expect(nearestCorner(d, at[k])).toBeGreaterThanOrEqual(10);
      });
    }
  });

  it("keeps the glyph off a label", () => {
    const d = {
      ortho: true,
      points: [
        [0, 0],
        [200, 0],
      ],
      authKeep: [[4, 40]],
    };
    expect(authAt(d)).toEqual([40, 0]);
  });

  it("does not move anything: geometry is the same with and without auth", () => {
    const boxes = {
      api: [0, 0, 140, 78],
      db: [0, 300, 140, 78],
      lb: [300, 0, 140, 78],
      rds: [300, 300, 140, 78],
    };
    const plain = design([edge("db"), edge("rds")]);
    const authed = design([edge("db", "mtls"), edge("rds", "iam-role")]);
    // `authKeep` says only where the glyph may not sit.
    const placed = edgeGeometry(authed, boxes).map(({ authKeep, ...d }) => d);
    expect(placed).toEqual(edgeGeometry(plain, boxes));
  });

  it("carries auth into Mermaid after the edge's text", () => {
    const m = toMermaid(design([edge("db", "mtls")]));
    expect(m).toContain('|"postgres [mtls]"|');
  });
});
