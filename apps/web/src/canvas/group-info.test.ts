import { describe, expect, it } from "vitest";
import {
  edgeCrossings,
  edgesText,
  groupAndDescendants,
  memberCounts,
  membersText,
  parentPath,
  regroupTarget,
} from "./group-info";

const doc = {
  groups: [
    { id: "platform", kind: "system", label: "Platform" },
    { id: "vnet", kind: "vpc", label: "VNet", parent: "platform" },
    { id: "spoke", kind: "cell", parent: "vnet" },
    { id: "other", kind: "system" },
  ],
  nodes: [
    { id: "gw", group: "vnet" },
    { id: "app", group: "spoke" },
    { id: "db", group: "spoke" },
    { id: "dns", group: "platform" },
    { id: "user" },
    { id: "ext", group: "other" },
  ],
  edges: [
    { from: "user", to: "gw" }, // in
    { from: "gw", to: "app" }, // inside
    { from: "app", to: "dns" }, // out
    { from: "db", to: "ext" }, // out
    { from: "other", to: "vnet" }, // in, to the group itself
    { from: "spoke", to: "user" }, // out, from a group inside
  ],
};

describe("group-info", () => {
  it("walks the parents from the root, by name", () => {
    expect(parentPath(doc, "spoke")).toEqual(["Platform", "VNet"]);
    expect(parentPath(doc, "vnet")).toEqual(["Platform"]);
    expect(parentPath(doc, "platform")).toEqual([]);
  });
  it("stops on a cycle rather than looping", () => {
    const cyc = {
      nodes: [],
      groups: [
        { id: "a", parent: "b" },
        { id: "b", parent: "a" },
      ],
    };
    expect(parentPath(cyc, "a")).toEqual(["b"]);
  });
  it("collects a group's descendants", () => {
    expect([...groupAndDescendants(doc, "platform")].sort()).toEqual(["platform", "spoke", "vnet"]);
  });
  it("counts direct members and the nested total", () => {
    expect(memberCounts(doc, "vnet")).toEqual({ components: 1, groups: 1, nested: 3 });
    expect(memberCounts(doc, "spoke")).toEqual({ components: 2, groups: 0, nested: 2 });
    expect(membersText(memberCounts(doc, "vnet"))).toBe("1 component · 1 group · 3 nested");
    expect(membersText(memberCounts(doc, "spoke"))).toBe("2 components · 0 groups");
  });
  it("counts only the edges that cross the border", () => {
    expect(edgeCrossings(doc, "vnet")).toEqual({ in: 2, out: 3 });
    expect(edgeCrossings(doc, "spoke")).toEqual({ in: 1, out: 3 });
    expect(edgeCrossings(doc, "platform")).toEqual({ in: 2, out: 2 });
    expect(edgesText({ in: 0, out: 0 })).toBeNull();
    expect(edgesText({ in: 3, out: 2 })).toBe("3 in · 2 out");
  });
});

describe("regroupTarget", () => {
  type Box = [number, number, number, number];
  const frames: Record<string, Box> = {
    platform: [0, 0, 1000, 800],
    vnet: [50, 50, 600, 500],
    spoke: [100, 100, 200, 200],
    hub: [350, 100, 200, 200],
  };
  it("takes the innermost frame under the point", () => {
    expect(regroupTarget(frames, 450, 200, new Set(), "spoke")).toBe("hub");
    expect(regroupTarget(frames, 500, 450, new Set(), "spoke")).toBe("vnet");
  });
  it("reads landing back in the current group as no move", () => {
    expect(regroupTarget(frames, 150, 150, new Set(), "spoke")).toBeNull();
  });
  it("never offers what is being dragged, or anything inside it", () => {
    expect(regroupTarget(frames, 150, 150, new Set(["spoke"]), "vnet")).toBeNull();
    expect(
      regroupTarget(frames, 150, 150, new Set(["vnet", "spoke", "hub"]), "platform"),
    ).toBeNull();
    expect(regroupTarget(frames, 150, 150, new Set(["spoke"]), "platform")).toBe("vnet");
  });
  it("finds nothing on empty canvas", () => {
    expect(regroupTarget(frames, 1500, 1500, new Set(), null)).toBeNull();
    expect(regroupTarget(frames, 900, 700, new Set(), null)).toBe("platform");
  });
});
