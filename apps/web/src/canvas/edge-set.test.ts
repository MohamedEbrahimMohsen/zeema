import { describe, expect, it } from "vitest";
import { type EdgeShape, edgesInsideRect, mixedValue, pathPoints, sweptEdges } from "./edge-set";

const straight: EdgeShape = {
  i: 0,
  from: "a",
  to: "b",
  points: [
    [10, 10],
    [90, 10],
  ],
};
// A quadratic bow whose control point sits at y = 80, but whose line only reaches y = 45.
const bowed: EdgeShape = {
  i: 1,
  from: "a",
  to: "c",
  points: [
    [10, 10],
    [50, 80],
    [90, 10],
  ],
};
const ortho: EdgeShape = {
  i: 2,
  from: "b",
  to: "c",
  ortho: true,
  points: [
    [10, 10],
    [10, 60],
    [90, 60],
  ],
};

describe("edgesInsideRect", () => {
  it("picks an edge only when every point of its drawn path is inside", () => {
    expect(edgesInsideRect([straight, ortho], [0, 0, 100, 100])).toEqual([0, 2]);
    expect(edgesInsideRect([straight, ortho], [0, 0, 100, 40])).toEqual([0]);
    expect(edgesInsideRect([straight], [20, 0, 100, 40])).toEqual([]);
  });

  it("tests a curve's line, not its control point", () => {
    expect(edgesInsideRect([bowed], [0, 0, 100, 50])).toEqual([1]);
    expect(edgesInsideRect([bowed], [0, 0, 100, 40])).toEqual([]);
  });

  it("samples both halves of a seven-point ported curve", () => {
    const e: EdgeShape = {
      i: 3,
      from: "a",
      to: "b",
      points: [
        [0, 0],
        [0, 20],
        [20, 40],
        [40, 40],
        [60, 40],
        [80, 20],
        [80, 0],
      ],
    };
    const pts = pathPoints(e);
    expect(pts.length).toBeGreaterThan(7);
    expect(edgesInsideRect([e], [-1, -1, 81, 41])).toEqual([3]);
    expect(edgesInsideRect([e], [-1, -1, 70, 41])).toEqual([]);
  });
});

describe("sweptEdges", () => {
  it("adds every edge whose both ends were swept, wherever its path runs", () => {
    const rect: [number, number, number, number] = [0, 0, 5, 5];
    expect(sweptEdges([straight, bowed, ortho], rect, new Set(["a", "b"]))).toEqual([0]);
    expect(sweptEdges([straight, bowed, ortho], rect, new Set(["a", "b", "c"]))).toEqual([0, 1, 2]);
    expect(sweptEdges([straight, bowed, ortho], [0, 0, 100, 100], new Set())).toEqual([0, 1, 2]);
  });
});

describe("mixedValue", () => {
  it("returns the shared value, unset included", () => {
    expect(mixedValue(["mtls", "mtls"])).toEqual({ value: "mtls", mixed: false });
    expect(mixedValue([undefined, undefined])).toEqual({ value: undefined, mixed: false });
  });

  it("says mixed when any value differs, an unset one included", () => {
    expect(mixedValue(["mtls", "oauth"])).toEqual({ value: undefined, mixed: true });
    expect(mixedValue(["mtls", undefined])).toEqual({ value: undefined, mixed: true });
  });

  it("is not mixed for an empty set", () => {
    expect(mixedValue([])).toEqual({ value: undefined, mixed: false });
  });
});
