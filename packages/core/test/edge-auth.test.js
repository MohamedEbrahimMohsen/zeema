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

  it("draws a glyph for every value but none, on the line near the source end", () => {
    for (const a of AUTH) expect(Boolean(authGlyph(a))).toBe(a !== "none");
    expect(authGlyph(undefined)).toBeNull();
    expect(authGlyph("constructor")).toBeNull();
    const doc = design([edge("db", "managed-identity"), edge("lb", "none"), edge("rds")]);
    const svg = toSvg(doc, fixture);
    expect(svg.match(/<title>auth: /g)).toHaveLength(1);
    expect(svg).toContain("<title>auth: managed-identity</title>");
  });

  it("puts the glyph a short step from the source, never past a third of the line", () => {
    const straight = {
      points: [
        [0, 0],
        [300, 0],
      ],
    };
    expect(authAt(straight)).toEqual([20, 0]);
    expect(
      authAt({
        points: [
          [0, 0],
          [30, 0],
        ],
      }),
    ).toEqual([10, 0]);
    expect(
      authAt({
        ortho: true,
        points: [
          [0, 0],
          [0, 10],
          [100, 10],
        ],
      }),
    ).toEqual([10, 10]);
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

  it("does not move anything: geometry is the same with and without auth", () => {
    const boxes = {
      api: [0, 0, 140, 78],
      db: [0, 300, 140, 78],
      lb: [300, 0, 140, 78],
      rds: [300, 300, 140, 78],
    };
    const plain = design([edge("db"), edge("rds")]);
    const authed = design([edge("db", "mtls"), edge("rds", "iam-role")]);
    expect(edgeGeometry(authed, boxes)).toEqual(edgeGeometry(plain, boxes));
  });

  it("carries auth into Mermaid after the edge's text", () => {
    const m = toMermaid(design([edge("db", "mtls")]));
    expect(m).toContain('|"postgres [mtls]"|');
  });
});
