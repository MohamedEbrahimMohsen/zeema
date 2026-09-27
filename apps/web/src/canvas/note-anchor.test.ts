import { describe, expect, it } from "vitest";
import { anchorOffset, coversTarget, noteDropTarget, sameAnchor } from "./note-anchor";

type Box = [number, number, number, number];
const boxes: Record<string, Box> = { a: [100, 100, 140, 78], b: [400, 100, 140, 78] };
const frames: Record<string, Box> = { outer: [0, 0, 800, 600], inner: [80, 80, 200, 140] };

describe("noteDropTarget", () => {
  it("prefers a node over the group around it", () => {
    expect(noteDropTarget(["a", "b"], boxes, frames, 120, 120)).toEqual({ node: "a" });
  });
  it("takes the innermost group when no node is under the point", () => {
    expect(noteDropTarget(["a", "b"], boxes, frames, 90, 90)).toEqual({ group: "inner" });
    expect(noteDropTarget(["a", "b"], boxes, frames, 700, 500)).toEqual({ group: "outer" });
  });
  it("finds nothing on empty canvas", () => {
    expect(noteDropTarget(["a", "b"], boxes, frames, 900, 900)).toBeNull();
    expect(noteDropTarget([], {}, {}, 0, 0)).toBeNull();
  });
  it("never re-pins a note to a group around what it already follows", () => {
    // pinned to "a", which sits inside "inner": empty space in "inner" and "outer" is no target
    expect(noteDropTarget(["a", "b"], boxes, frames, 90, 90, boxes.a)).toBeNull();
    expect(noteDropTarget(["a", "b"], boxes, frames, 700, 500, boxes.a)).toBeNull();
    // but another component still is
    expect(noteDropTarget(["a", "b"], boxes, frames, 420, 120, boxes.a)).toEqual({ node: "b" });
    // and so is a group that does not hold it
    const side: Record<string, Box> = { ...frames, side: [600, 300, 150, 150] };
    expect(noteDropTarget(["a"], boxes, side, 650, 350, boxes.a)).toEqual({ group: "side" });
  });
  it("takes the topmost of two overlapping nodes", () => {
    const overlap: Record<string, Box> = { a: [0, 0, 100, 100], b: [50, 50, 100, 100] };
    expect(noteDropTarget(["a", "b"], overlap, {}, 75, 75)).toEqual({ node: "b" });
  });
  it("takes the node the note's box mostly covers when the pointer is off it", () => {
    // pointer at (90, 90), inside "inner" but on no node; the note covers most of "a"
    const note: Box = [95, 95, 140, 70];
    expect(noteDropTarget(["a", "b"], boxes, frames, 90, 90, null, note)).toEqual({ node: "a" });
    // a note bigger than the node counts by the node's share
    const big: Box = [80, 80, 300, 200];
    expect(noteDropTarget(["a", "b"], boxes, frames, 90, 90, null, big)).toEqual({ node: "a" });
  });
  it("does not pin a note that only grazes a node", () => {
    const graze: Box = [200, 150, 140, 70]; // a sliver of "a"'s bottom-right corner
    expect(noteDropTarget(["a", "b"], boxes, frames, 90, 90, null, graze)).toEqual({
      group: "inner",
    });
  });
  it("prefers the node under the pointer over the one the box covers most", () => {
    const note: Box = [95, 95, 140, 70];
    expect(noteDropTarget(["a", "b"], boxes, frames, 420, 120, null, note)).toEqual({ node: "b" });
  });
});

describe("coversTarget", () => {
  it("is true only when the two boxes overlap", () => {
    expect(coversTarget([0, 0, 100, 50], [90, 40, 20, 20])).toBe(true);
    expect(coversTarget([0, 0, 100, 50], [124, -8, 20, 20])).toBe(false);
  });
});

describe("anchorOffset", () => {
  it("measures from the target's top-right corner, so the note does not jump", () => {
    const t: Box = [100, 100, 140, 78];
    const [dx, dy] = anchorOffset(t, 260, 90);
    expect([dx, dy]).toEqual([20, -10]);
    // and back: the world top-left an anchored note is drawn at
    expect([t[0] + t[2] + dx, t[1] + dy]).toEqual([260, 90]);
  });
  it("rounds to whole units", () => {
    expect(anchorOffset([0, 0, 10, 10], 12.6, -3.4)).toEqual([3, -3]);
  });
});

describe("sameAnchor", () => {
  it("compares kind and id", () => {
    expect(sameAnchor({ node: "a" }, { node: "a" })).toBe(true);
    expect(sameAnchor({ node: "a" }, { group: "a" })).toBe(false);
    expect(sameAnchor({ node: "a" }, null)).toBe(false);
    expect(sameAnchor(undefined, undefined)).toBe(false);
  });
});
