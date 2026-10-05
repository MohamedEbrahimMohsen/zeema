// A node that stands for N identical copies (instances, replicas or shards of two or more) is
// drawn as a stack: two cards behind its box and a ×N chip. One reading (nodeCount), one drawing
// (stackDecor), every renderer. A design with no count renders exactly as before.
import { describe, expect, it } from "vitest";
import { nodeCount, nodeCountOf } from "../src/document.js";
import { layout } from "../src/layout.js";
import { STACK_STEP, stackDecor, toMermaid, toSvg } from "../src/render.js";

// A small catalogue of its own, so nothing here depends on what the real one holds.
const catalogue = {
  kinds: {
    vm: { id: "vm", category: "compute", properties: { instances: { type: "integer" } } },
    index: { id: "index", category: "data", properties: { replicas: { type: "integer" } } },
    cache: { id: "cache", category: "data", properties: { shards: { type: "integer" } } },
    all: {
      id: "all",
      category: "data",
      properties: {
        shards: { type: "integer" },
        replicas: { type: "integer" },
        instances: { type: "integer" },
      },
    },
    plain: { id: "plain", category: "compute", properties: { size: { type: "integer" } } },
  },
  components: {
    vm: { id: "vm", kind: "vm", provider: "default" },
    index: { id: "index", kind: "index", provider: "default" },
    cache: { id: "cache", kind: "cache", provider: "default" },
    all: { id: "all", kind: "all", provider: "default" },
    plain: { id: "plain", kind: "plain", provider: "default" },
    pool: { id: "pool", kind: "vm", provider: "default", defaults: { instances: 4 } },
  },
  locale: { kinds: {}, components: {} },
};
const node = (component, props) => ({ id: `n-${component}`, component, props });
const count = (component, props) => nodeCount(null, node(component, props), catalogue);

describe("nodeCount", () => {
  it("is null for a kind that does not define the property", () => {
    expect(count("plain", { instances: 3 })).toBeNull();
  });
  it("is null below two", () => {
    expect(count("vm", { instances: 1 })).toBeNull();
    expect(count("vm", { instances: 0 })).toBeNull();
    expect(count("vm", {})).toBeNull();
    expect(count("vm")).toBeNull();
  });
  it("reads instances, replicas and shards", () => {
    expect(count("vm", { instances: 3 })).toBe(3);
    expect(count("index", { replicas: 3 })).toBe(3);
    expect(count("cache", { shards: 8 })).toBe(8);
  });
  it("resolves through the component's defaults", () => {
    expect(count("pool")).toBe(4);
    expect(count("pool", { instances: 1 })).toBeNull();
  });
  it("reads instances before replicas before shards, and the first present decides", () => {
    expect(count("all", { shards: 8, replicas: 3, instances: 2 })).toBe(2);
    expect(count("all", { shards: 8, replicas: 3 })).toBe(3);
    expect(count("all", { shards: 8 })).toBe(8);
    expect(count("all", { instances: 1, replicas: 5 })).toBeNull();
    expect(nodeCountOf(null, node("all", { shards: 8, replicas: 3 }), catalogue)).toEqual({
      count: 3,
      prop: "replicas",
    });
  });
  it("is null for anything but an integer (a string is refused, not guessed at)", () => {
    expect(count("vm", { instances: "3" })).toBeNull();
    expect(count("vm", { instances: 2.5 })).toBeNull();
    expect(count("vm", { instances: true })).toBeNull();
  });
  it("is null without a catalogue or for an unknown component", () => {
    expect(nodeCount(null, node("vm", { instances: 3 }), null)).toBeNull();
    expect(count("nope", { instances: 3 })).toBeNull();
  });
});

describe("stackDecor", () => {
  it("is null under two", () => {
    expect(stackDecor(160, 80, 1)).toBeNull();
    expect(stackDecor(160, 80, null)).toBeNull();
  });
  it("draws two cards, farthest first, each a step further right and up", () => {
    const s = stackDecor(160, 80, 3);
    expect(s.cards.map((c) => [c.x, c.y])).toEqual([
      [2 * STACK_STEP, -2 * STACK_STEP],
      [STACK_STEP, -STACK_STEP],
    ]);
    expect(s.cards.every((c) => c.w === 160 && c.h === 80)).toBe(true);
    expect(s.cards[0].opacity).toBeLessThan(s.cards[1].opacity);
  });
  it("sizes the chip to its text and keeps it on the box's right", () => {
    const small = stackDecor(160, 80, 3).chip;
    const big = stackDecor(160, 80, 1200).chip;
    expect(small.text).toBe("×3");
    expect(big.text).toBe("×1200");
    expect(big.w).toBeGreaterThan(small.w);
    expect(small.x + small.w).toBeLessThanOrEqual(160);
    expect(big.x + big.w).toBe(small.x + small.w);
  });
});

const doc = (props) => ({
  id: "stack",
  nodes: [
    { id: "web", component: "vm", props },
    { id: "db", component: "plain" },
  ],
  edges: [{ from: "web", to: "db", protocol: "https", mode: "sync" }],
  groups: [],
});

describe("toSvg", () => {
  it("draws the stack and the chip only for a counted node", () => {
    const svg = toSvg(doc({ instances: 3 }), catalogue, { theme: "light" });
    expect(svg.match(/<g class="stack"/g)).toHaveLength(2);
    expect(svg.match(/class="chip"/g)).toHaveLength(1);
    expect(svg).toContain(">×3</text>");
    const plain = toSvg(doc({ instances: 1 }), catalogue, { theme: "light" });
    expect(plain).not.toContain('class="stack"');
    expect(plain).not.toContain('class="chip"');
    expect(plain).toBe(toSvg(doc(undefined), catalogue, { theme: "light" }));
  });
  it("draws the cards behind the box, offset from it, and leaves the layout alone", () => {
    const d = doc({ instances: 3 });
    const lay = layout(d, catalogue);
    expect(lay.sizes).toEqual(layout(doc(undefined), catalogue).sizes);
    expect(lay.positions).toEqual(layout(doc(undefined), catalogue).positions);
    const [x, y] = lay.positions.web;
    const svg = toSvg(d, catalogue, { theme: "light" });
    const near = `<rect class="body" x="${x + STACK_STEP}" y="${y - STACK_STEP}"`;
    const front = `<rect class="body" x="${x}" y="${y}"`;
    expect(svg).toContain(near);
    expect(svg.indexOf(near)).toBeLessThan(svg.indexOf(front));
  });
  it("tints the cards with the box", () => {
    const svg = toSvg(doc({ instances: 2 }), catalogue, {
      theme: "light",
      tints: { web: { tint: "blue" } },
    });
    expect(
      svg.match(/<g class="stack"[^>]*><rect class="body"[^>]*\/><rect data-tint="blue"/g),
    ).toHaveLength(2);
  });
});

describe("toMermaid", () => {
  it("appends ×N to a counted node's label", () => {
    expect(toMermaid(doc({ instances: 3 }), "TD", catalogue)).toContain('n_web["vm ×3');
    expect(toMermaid(doc({ instances: 1 }), "TD", catalogue)).not.toContain("×");
    expect(toMermaid(doc({ instances: 3 }))).not.toContain("×");
  });
});
