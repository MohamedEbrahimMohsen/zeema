// describeRule turns the fixed predicate set into English. Three things are tested:
//   1. every predicate the schema allows has a phrasing (the schema is the list, not this file);
//   2. each phrasing, one case per predicate;
//   3. a snapshot of every rule on disk, so a wording change is a deliberate diff.
// Counts are never hard-coded: the rules come from rules/ and the vocabulary from the schema.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { describeLines, describeRule, describeSelect } from "../src/describe.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..", "..");

const ruleFiles = fs
  .readdirSync(path.join(ROOT, "rules"))
  .filter((f) => f.endsWith(".yaml"))
  .sort();
const rules = ruleFiles.map((f) =>
  YAML.parse(fs.readFileSync(path.join(ROOT, "rules", f), "utf8")),
);
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "schema", "rule.schema.json"), "utf8"));
const snapshot = JSON.parse(fs.readFileSync(path.join(here, "describe.json"), "utf8"));

/** One sample per predicate key in the schema. The keys are the vocabulary; these are the cases. */
const SAMPLES = {
  all: [
    { all: [{ prop: "replay", equals: false }] },
    ["- all of these hold:", "  - the node's `replay` is false"],
  ],
  any: [
    { any: [{ prop: "backoff", exists: false }] },
    ["- any of these hold:", "  - the node's `backoff` has no value"],
  ],
  not: [
    { not: { prop: "sharded", equals: true } },
    ["- this does not hold:", "  - the node's `sharded` is true"],
  ],
  prop: [{ prop: "deadLetterQueue", equals: false }, ["- the node's `deadLetterQueue` is false"]],
  requirement: [
    { requirement: "availability.multiRegion", equals: true },
    ["- the design requirement `availability.multiRegion` is true"],
  ],
  equals: [{ prop: "role", equals: "retry" }, ['- the node\'s `role` is "retry"']],
  in: [
    { field: "retryPolicy", in: ["fixed", "exponential"] },
    ['- the edge\'s `retryPolicy` is one of "fixed" or "exponential"'],
  ],
  exists: [{ prop: "zones", exists: false }, ["- the node's `zones` has no value"]],
  hasEdge: [
    { hasEdge: { direction: "in", mode: "async", peerKind: ["stream", "worker"] } },
    ["- the node has at least one asynchronous incoming edge from a stream or worker"],
  ],
  inGroup: [
    { inGroup: { kind: "availability-zone", count: { eq: 1 } } },
    ["- the node sits inside exactly 1 availability-zone group"],
  ],
  syncChainDepth: [
    { syncChainDepth: { gt: 3 } },
    ["- the longest chain of synchronous calls starting at the node is more than 3 hops long"],
  ],
  gt: [
    { requirement: "traffic.readWriteRatio", gt: 10 },
    ["- the design requirement `traffic.readWriteRatio` is a number greater than 10"],
  ],
  lt: [{ prop: "zones", lt: 3 }, ["- the node's `zones` is a number less than 3"]],
  field: [{ field: "idempotent", exists: false }, ["- the edge's `idempotent` has no value"]],
  nfr: [
    { nfr: { rps: { gt: 5000 } } },
    ["- the node's declared requests per second is more than 5000"],
  ],
  hasNode: [{ hasNode: { kind: "ledger" } }, ["- the design contains a node of kind ledger"]],
  from: [
    { from: { prop: "handlesMoney", equals: true } },
    ["- the edge's source node:", "  - the node's `handlesMoney` is true"],
  ],
  to: [
    { to: { prop: "handlesMoney", equals: true } },
    ["- the edge's target node:", "  - the node's `handlesMoney` is true"],
  ],
  crossesGroup: [
    { crossesGroup: { kind: "cell" } },
    ["- the edge crosses a cell boundary, or at least one end is in no cell at all"],
  ],
};

const render = (rule) => {
  const d = describeRule(rule, { rules: {} });
  return { select: d.select.text, when: describeLines(d.when) };
};

describe("describeRule", () => {
  it("has a phrasing for every predicate the schema allows", () => {
    const vocabulary = Object.keys(schema.definitions.predicate.properties).sort();
    expect(Object.keys(SAMPLES).sort()).toEqual(vocabulary);
  });

  for (const [key, [when, lines]] of Object.entries(SAMPLES)) {
    it(`phrases ${key}`, () => {
      const d = describeRule(
        { id: "x", severity: "error", select: { node: { kind: "queue" } }, when, message: "m" },
        {},
      );
      expect(describeLines(d.when)).toEqual(lines);
    });
  }

  it("throws on a predicate it cannot phrase", () => {
    expect(() =>
      describeRule(
        { id: "x", severity: "error", select: { design: true }, when: { wat: 1 }, message: "m" },
        {},
      ),
    ).toThrow(/unknown predicate/);
  });

  it("names the kinds and categories a rule selects", () => {
    expect(describeSelect({ node: { kind: ["sql-database", "nosql-database"] } })).toMatchObject({
      subject: "node",
      kinds: ["sql-database", "nosql-database"],
      text: "every node of kind sql-database or nosql-database",
    });
    expect(describeSelect({ edge: { delivery: "exactly-once" } }).text).toBe(
      "every edge declaring exactly-once delivery",
    );
    expect(describeSelect({ design: true }).text).toBe("every design");
  });

  it("carries the locale's name and rationale", () => {
    const d = describeRule(rules[0], {
      rules: { [rules[0].id]: { name: "N", rationale: "R" } },
    });
    expect(d.name).toBe("N");
    expect(d.rationale).toBe("R");
  });

  it("matches the snapshot for every rule in rules/", () => {
    expect(rules.length).toBeGreaterThan(0);
    const got = Object.fromEntries(rules.map((r) => [r.id, render(r)]));
    expect(got).toEqual(snapshot);
  });
});
