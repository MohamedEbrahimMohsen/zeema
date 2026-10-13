// Hand-placed waypoints per expand state of an edge's ends (sidecar `via` / `viaExpanded`).
import { describe, expect, it } from "vitest";
import { drawnLayout } from "../src/drawn.js";
import {
  EXPAND_STATE_RE,
  expandState,
  pathFor,
  pathsFor,
  rekeyBows,
  withPath,
} from "../src/geometry.js";

describe("expandState", () => {
  it("names the expanded end nodes, sorted and comma-joined", () => {
    expect(expandState("web>db", [])).toBe("");
    expect(expandState("web>db", ["web"])).toBe("web");
    expect(expandState("web>db", new Set(["db", "web"]))).toBe("db,web");
    expect(expandState("web>db#2", ["db", "other"])).toBe("db");
  });
  it("counts a module end by its node, once for both ends of one node", () => {
    expect(expandState("web/auth>db", ["web"])).toBe("web");
    expect(expandState("web/auth>web/cart", ["web"])).toBe("web");
  });
  it("makes keys the sidecar accepts", () => {
    expect(EXPAND_STATE_RE.test(expandState("b-2>a", ["a", "b-2"]))).toBe(true);
    expect(EXPAND_STATE_RE.test("a,b,c")).toBe(false);
  });
});

describe("pathFor / pathsFor", () => {
  const entry = { via: [[1, 2]], viaExpanded: { web: [[3, 4]], "db,web": [[5, 6]] } };
  it("picks `via` collapsed and the state's slot otherwise", () => {
    expect(pathFor(entry, "")).toEqual({ via: [[1, 2]] });
    expect(pathFor(entry, "web")).toEqual({ via: [[3, 4]] });
    expect(pathFor(entry, "db,web")).toEqual({ via: [[5, 6]] });
    expect(pathFor(entry, "db")).toBeNull();
    expect(pathFor({ viaExpanded: { web: [[3, 4]] } }, "")).toBeNull();
  });
  it("keeps a bow in every state", () => {
    expect(pathFor(12, "")).toBe(12);
    expect(pathFor(12, "web")).toBe(12);
  });
  it("maps a whole edges map for an expanded set", () => {
    const bows = { "web>db": entry, "a>b": 7, "x>y": { viaExpanded: { x: [[0, 0]] } } };
    expect(pathsFor(bows)).toEqual({ "web>db": { via: [[1, 2]] }, "a>b": 7 });
    expect(pathsFor(bows, ["web", "x"])).toEqual({
      "web>db": { via: [[3, 4]] },
      "a>b": 7,
      "x>y": { via: [[0, 0]] },
    });
  });
});

describe("withPath", () => {
  it("writes only the given state's slot", () => {
    const a = withPath({ via: [[1, 2]] }, "web", [[9, 9]]);
    expect(a).toEqual({ via: [[1, 2]], viaExpanded: { web: [[9, 9]] } });
    expect(withPath(a, "", [[0, 0]])).toEqual({ via: [[0, 0]], viaExpanded: { web: [[9, 9]] } });
  });
  it("clears only the given state's slot, and null when nothing is left", () => {
    const a = { via: [[1, 2]], viaExpanded: { web: [[9, 9]] } };
    expect(withPath(a, "web", null)).toEqual({ via: [[1, 2]] });
    expect(withPath(a, "", [])).toEqual({ viaExpanded: { web: [[9, 9]] } });
    expect(withPath({ via: [[1, 2]] }, "", null)).toBeNull();
  });
  it("replaces a bow", () => {
    expect(withPath(5, "web", [[1, 1]])).toEqual({ viaExpanded: { web: [[1, 1]] } });
  });
});

describe("rekeyBows with expand states", () => {
  it("renames a state's ids with the node and reverses its points with the edge", () => {
    const before = { edges: [{ from: "web/auth", to: "db" }] };
    const after = { edges: [{ from: "api/auth", to: "db" }] };
    const bows = { "web/auth>db": { via: [[1, 1]], viaExpanded: { web: [[2, 2]] } } };
    expect(rekeyBows(before, after, bows)).toEqual({
      "api/auth>db": { via: [[1, 1]], viaExpanded: { api: [[2, 2]] } },
    });
    const flipped = { edges: [{ from: "db", to: "web/auth" }] };
    const two = {
      "web/auth>db": {
        viaExpanded: {
          "db,web": [
            [1, 1],
            [2, 2],
          ],
        },
      },
    };
    expect(rekeyBows(before, flipped, two, [0])).toEqual({
      "db>web/auth": {
        viaExpanded: {
          "db,web": [
            [2, 2],
            [1, 1],
          ],
        },
      },
    });
  });
});

describe("drawnLayout", () => {
  it("draws `via`, never an expand state's waypoints", () => {
    const doc = {
      nodes: [
        { id: "a", kind: "compute" },
        { id: "b", kind: "compute" },
      ],
      edges: [{ from: "a", to: "b" }],
    };
    const plain = drawnLayout(doc, { nodes: {}, edges: {} });
    const only = drawnLayout(doc, {
      nodes: {},
      edges: { "a>b": { viaExpanded: { a: [[999, 999]] } } },
    });
    expect(only.edges[0].points).toEqual(plain.edges[0].points);
  });
});
