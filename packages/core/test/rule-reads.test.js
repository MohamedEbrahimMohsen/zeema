// ruleReads answers "what does this rule look at", so the canvas can highlight the very fields a
// finding is about. The rules come from rules/ on disk: no count is written down here, and a rule
// added tomorrow is tested the moment it lands.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { ruleReads } from "../src/describe.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..", "..");

const rules = fs
  .readdirSync(path.join(ROOT, "rules"))
  .filter((f) => f.endsWith(".yaml"))
  .sort()
  .map((f) => YAML.parse(fs.readFileSync(path.join(ROOT, "rules", f), "utf8")));

const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "schema", "rule.schema.json"), "utf8"));

/** Every predicate the schema allows, with the reading ruleReads must take from it. */
const SAMPLES = {
  all: [{ all: [{ prop: "replay", equals: false }] }, { props: ["replay"] }],
  any: [
    { any: [{ requirement: "security.encryptionAtRest" }] },
    { requirements: ["security.encryptionAtRest"] },
  ],
  not: [{ not: { hasNode: { kind: "key-management" } } }, { nodeKinds: ["key-management"] }],
  prop: [{ prop: "deadLetterQueue", equals: false }, { props: ["deadLetterQueue"] }],
  requirement: [
    { requirement: "availability.multiRegion", equals: true },
    { requirements: ["availability.multiRegion"] },
  ],
  equals: [{ prop: "role", equals: "retry" }, { props: ["role"] }],
  in: [{ field: "retryPolicy", in: ["fixed"] }, { edge: { fields: ["retryPolicy"] } }],
  exists: [{ prop: "zones", exists: false }, { props: ["zones"] }],
  gt: [
    { requirement: "traffic.readWriteRatio", gt: 10 },
    { requirements: ["traffic.readWriteRatio"] },
  ],
  lt: [{ prop: "zones", lt: 3 }, { props: ["zones"] }],
  field: [{ field: "idempotent", exists: false }, { edge: { fields: ["idempotent"] } }],
  hasEdge: [
    { hasEdge: { direction: "in", mode: "async", peerKind: ["stream", "worker"] } },
    { edge: { directions: ["in"], modes: ["async"], peerKinds: ["stream", "worker"] } },
  ],
  hasNode: [
    { hasNode: { kind: "ledger", category: "data" } },
    { nodeKinds: ["ledger"], nodeCategories: ["data"] },
  ],
  // A declared number, a boundary and a shape of the graph: real predicates with no field to
  // point at, so they read nothing and the walker must still accept them.
  nfr: [{ nfr: { rps: { gt: 5000 } } }, {}],
  inGroup: [{ inGroup: { kind: "availability-zone" } }, {}],
  syncChainDepth: [{ syncChainDepth: { gt: 3 } }, {}],
  // The node's component, not a field: the inspector already names it.
  kind: [{ kind: "sql-database" }, {}],
  provider: [{ provider: "azure" }, {}],
  from: [{ from: { prop: "handlesMoney", equals: true } }, { props: ["handlesMoney"] }],
  to: [{ to: { prop: "handlesMoney", equals: true } }, { props: ["handlesMoney"] }],
  crossesGroup: [{ crossesGroup: { kind: "cell" } }, { edge: { crossesGroupKinds: ["cell"] } }],
};

const EMPTY_EDGE = {
  fields: [],
  directions: [],
  modes: [],
  deliveries: [],
  peerKinds: [],
  peerCategories: [],
  crossesGroupKinds: [],
};

describe("ruleReads", () => {
  it("reads every predicate the schema allows", () => {
    const vocabulary = Object.keys(schema.definitions.predicate.properties).sort();
    expect(Object.keys(SAMPLES).sort()).toEqual(vocabulary);
  });

  for (const [key, [when, expected]] of Object.entries(SAMPLES)) {
    it(`reads ${key}`, () => {
      const got = ruleReads({ id: "x", when });
      expect(got).toMatchObject({
        requirements: expected.requirements ?? [],
        props: expected.props ?? [],
        nodeKinds: expected.nodeKinds ?? [],
        nodeCategories: expected.nodeCategories ?? [],
      });
      if (expected.edge) expect(got.edge).toMatchObject(expected.edge);
      else if (!("edge" in expected)) expect(got.edge).toBeNull();
    });
  }

  it("throws on a predicate it cannot read", () => {
    expect(() => ruleReads({ id: "x", when: { wat: 1 } })).toThrow(/unknown predicate/);
  });

  it("names something for every rule in rules/", () => {
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) {
      const got = ruleReads(r);
      const named =
        got.requirements.length +
        got.props.length +
        got.nodeKinds.length +
        got.nodeCategories.length +
        (got.edge ? Object.values(got.edge).reduce((n, v) => n + v.length, 0) : 0);
      expect(named, `${r.id} reads nothing`).toBeGreaterThan(0);
    }
  });

  it("deduplicates and sorts, so the answer does not depend on the order in the file", () => {
    const got = ruleReads({
      when: {
        all: [
          { prop: "zones", lt: 3 },
          { prop: "backoff", exists: false },
          { prop: "zones", exists: true },
        ],
      },
    });
    expect(got.props).toEqual(["backoff", "zones"]);
  });

  it("reads credentials-without-rotation", () => {
    const rule = rules.find((r) => r.id === "credentials-without-rotation");
    expect(ruleReads(rule)).toEqual({
      requirements: ["security.credentialRotationDays"],
      props: [],
      nodeKinds: ["key-management"],
      nodeCategories: ["data"],
      edge: null,
    });
  });

  it("reads queue-missing-dlq", () => {
    const rule = rules.find((r) => r.id === "queue-missing-dlq");
    expect(ruleReads(rule)).toEqual({
      requirements: [],
      props: ["deadLetterQueue"],
      nodeKinds: [],
      nodeCategories: [],
      edge: { ...EMPTY_EDGE, directions: ["in"], modes: ["async"] },
    });
  });
});
