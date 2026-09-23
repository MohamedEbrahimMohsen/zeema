// The parser's ceilings (F-11): a hostile document is refused quickly and with a line number,
// never parsed for seconds or allowed to overflow the stack. Each input here is about a MiB.
import { describe, expect, it } from "vitest";
import { MAX_DEPTH, MAX_NODES, parse } from "../src/yaml.js";

const MiB = 1024 * 1024;

/** Runs `fn`, expects it to throw matching `re`, and answers how long it took in ms. */
function refusedWithin(fn, re) {
  const t0 = performance.now();
  expect(fn).toThrow(re);
  return performance.now() - t0;
}

describe("parser limits", () => {
  it("keeps the ceilings far above any real design", () => {
    expect(MAX_DEPTH).toBeGreaterThanOrEqual(64);
    expect(MAX_NODES).toBeGreaterThanOrEqual(50_000);
  });

  it("refuses a 1 MiB single-line flow nesting fast", () => {
    const text = `a: ${"[".repeat(MiB)}`;
    expect(
      refusedWithin(() => parse(text), /nesting deeper than \d+ levels at line 1/),
    ).toBeLessThan(1000);
  });

  it("refuses a 1 MiB multi-line flow nesting fast (no quadratic rescans)", () => {
    const text = `a: ${"[\n".repeat(MiB / 2)}`;
    expect(refusedWithin(() => parse(text), /nesting deeper than/)).toBeLessThan(1000);
  });

  it("scans an unterminated 1 MiB multi-line flow collection in linear time", () => {
    const text = `a: [\n${"x,\n".repeat(MiB / 3)}`;
    expect(refusedWithin(() => parse(text), /unterminated flow collection/)).toBeLessThan(2000);
  });

  it("refuses deep block nesting", () => {
    let text = "";
    for (let i = 0; i < 200; i++) text += `${" ".repeat(i)}k${i}:\n`;
    expect(() => parse(text)).toThrow(/nesting deeper than \d+ levels/);
  });

  it("refuses a 1 MiB compact block sequence nesting fast", () => {
    const text = `a:\n  ${"- ".repeat(MiB / 2)}x\n`;
    expect(refusedWithin(() => parse(text), /nesting deeper than/)).toBeLessThan(1000);
  });

  it("refuses a document with too many values", () => {
    const text = `a: [${"1,".repeat(MAX_NODES + 10)}1]\n`;
    expect(refusedWithin(() => parse(text), /more than \d+ values at line 1/)).toBeLessThan(2000);
  });

  it("accepts nesting right up to the ceiling", () => {
    const depth = MAX_DEPTH - 2;
    const text = `a: ${"[".repeat(depth)}1${"]".repeat(depth)}\n`;
    expect(() => parse(text)).not.toThrow();
  });

  it("treats keys named after Object.prototype members as plain keys", () => {
    const { doc } = parse("constructor: 1\ntoString: 2\nm: {hasOwnProperty: 3, valueOf: 4}\n");
    expect(doc).toEqual({ constructor: 1, toString: 2, m: { hasOwnProperty: 3, valueOf: 4 } });
  });

  it("keeps a __proto__ key as data, never as the prototype", () => {
    const { doc } = parse("a: {__proto__: {polluted: 1}}\n");
    expect(Object.getPrototypeOf(doc.a)).toBe(Object.prototype);
    expect({}.polluted).toBeUndefined();
  });
});
