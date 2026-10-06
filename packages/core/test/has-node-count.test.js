// hasNode with `count` compares the number of matching nodes, the way hasEdge and inGroup already
// do; without `count` it keeps meaning "at least one". The catalogue is built inline so the test
// does not depend on what rules/ or components/ hold today.
import { describe, expect, it } from "vitest";
import { runRules } from "../src/rules.js";

const rule = (when) => ({
  id: "r",
  severity: "info",
  select: { design: true },
  when,
  message: "m",
});
const catalogue = (when) => ({
  kinds: {
    "ai-service": { id: "ai-service", category: "compute", properties: {} },
    "api-gateway": { id: "api-gateway", category: "edge", properties: {} },
  },
  components: {
    a: { id: "a", kind: "ai-service" },
    g: { id: "g", kind: "api-gateway" },
  },
  rules: [rule(when)],
});
const design = (n) => ({
  id: "d",
  nodes: Array.from({ length: n }, (_, i) => ({ id: `n${i}`, component: "a" })),
  edges: [],
});
const fires = (when, doc) => runRules(doc, catalogue(when)).some((h) => h.id === "r");

describe("hasNode count", () => {
  const three = { hasNode: { kind: "ai-service", count: { gt: 2 } } };

  it("fires once the number of matching nodes passes the comparison", () => {
    expect(fires(three, design(2))).toBe(false);
    expect(fires(three, design(3))).toBe(true);
  });

  it("supports eq and lt", () => {
    expect(fires({ hasNode: { kind: "ai-service", count: { eq: 2 } } }, design(2))).toBe(true);
    expect(fires({ hasNode: { kind: "ai-service", count: { lt: 1 } } }, design(0))).toBe(true);
  });

  it("counts known nodes only, so an unknown component never adds to the count", () => {
    const doc = design(2);
    doc.nodes.push({ id: "x", component: "nope" });
    expect(fires(three, doc)).toBe(false);
  });

  it("keeps meaning at least one without count", () => {
    expect(fires({ hasNode: { kind: "ai-service" } }, design(1))).toBe(true);
    expect(fires({ hasNode: { kind: "api-gateway" } }, design(3))).toBe(false);
  });
});
