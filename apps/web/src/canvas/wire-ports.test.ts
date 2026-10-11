import { edgeGeometry } from "@zeema/core/geometry";
import { describe, expect, it } from "vitest";
import { sideAt, wirePorts } from "./wire-ports";

type Box = [number, number, number, number];
const W = 150,
  H = 56;
// Backend over three stores and a fourth, bundled: the user's drawing.
const boxes: Record<string, Box> = {
  be: [300, 0, W, H],
  r: [0, 300, W, H],
  q: [200, 300, W, H],
  w: [400, 300, W, H],
  s: [620, 300, W, H],
};
const edges = ["r", "q", "w", "s"].map((to) => ({
  from: "be",
  to,
  protocol: "http",
  mode: "sync",
}));
const auto = () => {
  const d = edgeGeometry({ edges }, boxes, {}, {}, {}, { routing: "bundled" })[3];
  return { a: boxes.be, b: boxes.s, start: d.points[0], end: d.points.at(-1) };
};

describe("wirePorts", () => {
  it("reads the side an end point lies on", () => {
    expect(sideAt(boxes.be, [375, 56])).toBe("bottom");
    expect(sideAt(boxes.be, [300, 20])).toBe("left");
    expect(sideAt(boxes.be, [375, -4])).toBe("top");
  });

  it("stores nothing for a wire from the dot the edge leaves by anyway", () => {
    const ends = { from: { side: "bottom", t: 0.5 }, to: { side: "top", t: 0.3 } } as const;
    expect(wirePorts(ends, auto(), false)).toBeUndefined();
    // unported, the fourth edge leaves from the bundle's point along its trunk
    const drawn = edgeGeometry({ edges }, boxes, {}, {}, {}, { routing: "bundled" });
    expect(new Set(drawn.map((d: any) => d.points[0].join(","))).size).toBe(1);
  });

  it("keeps where the wire was let go when that is another side of the target", () => {
    const ends = { from: { side: "bottom", t: 0.5 }, to: { side: "left", t: 0.5 } } as const;
    expect(wirePorts(ends, auto(), false)).toEqual({ to: ends.to });
  });

  it("keeps both ports for a dot on another side, a dot already pinned, or a curve", () => {
    const right = { from: { side: "right", t: 0.5 }, to: { side: "top", t: 0.5 } } as const;
    expect(wirePorts(right, auto(), false)).toBe(right);
    const down = { from: { side: "bottom", t: 0.5 }, to: { side: "top", t: 0.5 } } as const;
    expect(wirePorts(down, auto(), true)).toBe(down);
    expect(wirePorts(down, null, false)).toBe(down);
  });
});
