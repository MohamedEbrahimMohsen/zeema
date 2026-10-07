import { describe, expect, it } from "vitest";
import { adjacencyOf, flowFrom, nodesAt } from "./flow-lens";

// The mock's shape: an orchestrator feeds a group of queues, the queues feed a group of workers,
// the workers call two push services, and the push services reach the clients.
const doc = {
  groups: [
    { id: "queues", kind: "system" },
    { id: "workers", kind: "system" },
  ],
  nodes: [
    { id: "orch" },
    { id: "q1", group: "queues" },
    { id: "q2", group: "queues" },
    { id: "w1", group: "workers" },
    { id: "w2", group: "workers" },
    { id: "apn" },
    { id: "fcm" },
    { id: "db" },
    { id: "mobile" },
    { id: "lonely" },
  ],
  edges: [
    { from: "orch", to: "queues" }, // 0
    { from: "queues", to: "workers" }, // 1
    { from: "workers", to: "apn" }, // 2
    { from: "workers", to: "fcm" }, // 3
    { from: "w1", to: "db" }, // 4
    { from: "apn", to: "mobile" }, // 5
    { from: "fcm", to: "mobile" }, // 6
  ],
};

describe("flow lens", () => {
  it("walks upstream from a client, through group edges, to the source", () => {
    const lit = flowFrom(doc, "mobile");
    expect(lit.direction).toBe("up");
    expect([...lit.nodes].sort()).toEqual(
      ["apn", "fcm", "mobile", "orch", "q1", "q2", "w1", "w2"].sort(),
    );
    expect([...lit.edges].sort()).toEqual([0, 1, 2, 3, 5, 6]);
  });

  it("walks downstream from a source nothing points at", () => {
    const lit = flowFrom(doc, "orch");
    expect(lit.direction).toBe("down");
    expect(lit.nodes.has("mobile")).toBe(true);
    expect(lit.nodes.has("db")).toBe(true);
    expect(lit.edges.size).toBe(doc.edges.length);
  });

  it("lights a component with no edges alone", () => {
    expect(flowFrom(doc, "lonely")).toEqual({
      nodes: new Set(["lonely"]),
      edges: new Set(),
      direction: null,
    });
  });

  it("stops at a cycle", () => {
    const loop = {
      nodes: [{ id: "a" }, { id: "b" }],
      edges: [
        { from: "a", to: "b" },
        { from: "b", to: "a" },
      ],
    };
    const lit = flowFrom(loop, "a");
    expect([...lit.nodes].sort()).toEqual(["a", "b"]);
    expect([...lit.edges].sort()).toEqual([0, 1]);
  });

  it("counts an edge to a group in each member's neighbourhood", () => {
    const adj = adjacencyOf(doc);
    expect(adj.get("w2")).toEqual([1, 2, 3]);
    expect(adj.get("w1")).toEqual([1, 2, 3, 4]);
    expect(adj.get("orch")).toEqual([0]);
    expect(adj.has("workers")).toBe(false);
    expect(nodesAt(doc, "workers")).toEqual(["w1", "w2"]);
    expect(nodesAt(doc, "apn")).toEqual(["apn"]);
  });
});
