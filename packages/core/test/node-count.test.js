// A node that stands for N identical copies (instances, replicas or shards of two or more) is
// drawn as a stack: two cards behind its box and a ×N chip. A queue with a dead-letter queue
// carries a DLQ chip in the same row. One reading each (nodeCount, nodeDeadLetter), one drawing
// (nodeDecor), every renderer. A design with neither renders exactly as before.
import { describe, expect, it } from "vitest";
import { nodeCount, nodeCountOf, nodeDeadLetter } from "../src/document.js";
import { layout } from "../src/layout.js";
import { nodeDecor, STACK_STEP, toMermaid, toSvg } from "../src/render.js";

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
    queue: {
      id: "queue",
      category: "messaging",
      properties: {
        deadLetterQueue: { type: "boolean", default: false },
        role: { type: "enum", values: ["work", "dlq"], default: "work" },
        instances: { type: "integer" },
      },
    },
    topic: {
      id: "topic",
      category: "messaging",
      properties: { deadLetterQueue: { type: "boolean" } },
    },
  },
  components: {
    vm: { id: "vm", kind: "vm", provider: "default" },
    index: { id: "index", kind: "index", provider: "default" },
    cache: { id: "cache", kind: "cache", provider: "default" },
    all: { id: "all", kind: "all", provider: "default" },
    plain: { id: "plain", kind: "plain", provider: "default" },
    pool: { id: "pool", kind: "vm", provider: "default", defaults: { instances: 4 } },
    queue: { id: "queue", kind: "queue", provider: "default" },
    topic: { id: "topic", kind: "topic", provider: "default" },
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

describe("nodeDeadLetter", () => {
  const dlq = (component, props) => nodeDeadLetter(null, node(component, props), catalogue);
  it("is true for a queue that declares a dead-letter queue", () => {
    expect(dlq("queue", { deadLetterQueue: true })).toBe(true);
    expect(dlq("queue", { deadLetterQueue: true, role: "work" })).toBe(true);
  });
  it("is false without it, or for anything but a real true", () => {
    expect(dlq("queue", {})).toBe(false);
    expect(dlq("queue", { deadLetterQueue: false })).toBe(false);
    expect(dlq("queue", { deadLetterQueue: "true" })).toBe(false);
  });
  it("is false for the dead-letter queue itself", () => {
    expect(dlq("queue", { deadLetterQueue: true, role: "dlq" })).toBe(false);
  });
  it("is false for a kind other than queue, even with the prop", () => {
    expect(dlq("topic", { deadLetterQueue: true })).toBe(false);
    expect(nodeDeadLetter(null, node("queue", { deadLetterQueue: true }), null)).toBe(false);
  });
});

describe("nodeDecor", () => {
  it("is null with neither a count of two nor a DLQ", () => {
    expect(nodeDecor(160, 80, { count: 1 })).toBeNull();
    expect(nodeDecor(160, 80, { count: null, dlq: false })).toBeNull();
    expect(nodeDecor(160, 80)).toBeNull();
  });
  it("draws two cards, farthest first, each a step further right and up", () => {
    const s = nodeDecor(160, 80, { count: 3 });
    expect(s.cards.map((c) => [c.x, c.y])).toEqual([
      [2 * STACK_STEP, -2 * STACK_STEP],
      [STACK_STEP, -STACK_STEP],
    ]);
    expect(s.cards.every((c) => c.w === 160 && c.h === 80)).toBe(true);
    expect(s.cards[0].opacity).toBeLessThan(s.cards[1].opacity);
  });
  it("sizes the count chip to its text and keeps it on the box's right", () => {
    const [small] = nodeDecor(160, 80, { count: 3 }).chips;
    const [big] = nodeDecor(160, 80, { count: 1200 }).chips;
    expect(small.text).toBe("×3");
    expect(big.text).toBe("×1200");
    expect(big.w).toBeGreaterThan(small.w);
    expect(small.x + small.w).toBeLessThanOrEqual(160);
    expect(big.x + big.w).toBe(small.x + small.w);
  });
  it("puts a lone DLQ chip where the count chip sits, with no cards", () => {
    const [count] = nodeDecor(160, 80, { count: 3 }).chips;
    const only = nodeDecor(160, 80, { dlq: true });
    expect(only.cards).toEqual([]);
    expect(only.chips).toHaveLength(1);
    const [d] = only.chips;
    expect(d).toMatchObject({ id: "dlq", text: "DLQ", y: count.y, h: count.h, rx: count.rx });
    expect(d.x + d.w).toBe(count.x + count.w);
  });
  it("lays both right to left: DLQ rightmost, ×N 4px to its left", () => {
    const [count] = nodeDecor(160, 80, { count: 3 }).chips;
    const both = nodeDecor(160, 80, { count: 3, dlq: true });
    expect(both.cards).toHaveLength(2);
    expect(both.chips.map((c) => c.text)).toEqual(["DLQ", "×3"]);
    const [d, n] = both.chips;
    expect(d.x + d.w).toBe(count.x + count.w);
    expect(n.x + n.w).toBe(d.x - 4);
    expect(n.w).toBe(count.w);
    expect(n.y).toBe(d.y);
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

const queueDoc = (props) => ({
  id: "dlq",
  nodes: [{ id: "q", component: "queue", props }],
  edges: [],
  groups: [],
});

describe("toSvg DLQ chip", () => {
  const svg = (props) => toSvg(queueDoc(props), catalogue, { theme: "light" });
  it("draws a DLQ chip for a queue with a dead-letter queue, and no stack", () => {
    const out = svg({ deadLetterQueue: true });
    expect(out.match(/class="chip"/g)).toHaveLength(1);
    expect(out).toContain(">DLQ</text>");
    expect(out).not.toContain('class="stack"');
  });
  it("draws both chips, DLQ rightmost, with the stack", () => {
    const out = svg({ deadLetterQueue: true, instances: 3 });
    expect(out.match(/class="chip"/g)).toHaveLength(2);
    expect(out.match(/<g class="stack"/g)).toHaveLength(2);
    const xs = Object.fromEntries(
      [...out.matchAll(/class="chip-t" x="([\d.]+)"[^>]*>([^<]+)</g)].map((m) => [m[2], +m[1]]),
    );
    expect(xs["×3"]).toBeLessThan(xs.DLQ);
  });
  it("draws nothing for the dead-letter queue itself or without the prop", () => {
    expect(svg({ deadLetterQueue: true, role: "dlq" })).toBe(svg({}));
    expect(svg({ deadLetterQueue: false })).toBe(svg({}));
    expect(svg({})).not.toContain("DLQ");
  });
});

describe("toMermaid", () => {
  it("appends ×N to a counted node's label", () => {
    expect(toMermaid(doc({ instances: 3 }), "TD", catalogue)).toContain('n_web["vm ×3');
    expect(toMermaid(doc({ instances: 1 }), "TD", catalogue)).not.toContain("×");
    expect(toMermaid(doc({ instances: 3 }))).not.toContain("×");
  });
});
