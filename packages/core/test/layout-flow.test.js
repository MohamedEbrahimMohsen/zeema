// Reciprocal pairs are oriented by the catalogue's flow order (client, edge, security, compute,
// ...), not by which edge happens to be listed first; without a catalogue, document order wins.
import { describe, expect, it } from "vitest";
import { layout } from "../src/layout.js";

const catalogue = {
  kinds: {
    client: { id: "client", category: "client" },
    cdn: { id: "cdn", category: "edge" },
    "app-server": { id: "app-server", category: "compute" },
    database: { id: "database", category: "data" },
  },
  components: {
    browser: { id: "browser", kind: "client" },
    "edge-cache": { id: "edge-cache", kind: "cdn" },
    server: { id: "server", kind: "app-server" },
    db: { id: "db", kind: "database" },
  },
};

// A client, an edge group and a compute group; the client talks to the edge, and the two groups
// have a reciprocal pair listed compute -> edge first.
const doc = {
  groups: [
    { id: "front", label: "Front" },
    { id: "back", label: "Back" },
  ],
  nodes: [
    { id: "user", component: "browser" },
    { id: "app", component: "server", group: "back" },
    { id: "cache", component: "edge-cache", group: "front" },
  ],
  edges: [
    { from: "user", to: "cache" },
    { from: "app", to: "cache" },
    { from: "cache", to: "app" },
  ],
};

describe("reciprocal pairs follow the flow", () => {
  it("puts the edge group above the compute group when the catalogue is passed", () => {
    const { frames, positions } = layout(doc, catalogue);
    expect(positions.user[1]).toBeLessThan(frames.front[1]);
    expect(frames.front[1]).toBeLessThan(frames.back[1]);
  });

  it("keeps the edge listed first when no catalogue is passed", () => {
    const { frames } = layout(doc);
    expect(frames.back[1]).toBeLessThan(frames.front[1]);
  });

  it("breaks a tie on the minimum by the mean", () => {
    // both groups start at the edge; the back group also holds data, so it comes second
    const tied = {
      ...doc,
      nodes: [
        ...doc.nodes,
        { id: "tunnel", component: "edge-cache", group: "back" },
        { id: "store", component: "db", group: "back" },
      ],
    };
    const { frames } = layout(tied, catalogue);
    expect(frames.front[1]).toBeLessThan(frames.back[1]);
  });
});
