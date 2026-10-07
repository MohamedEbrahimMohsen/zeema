import { describe, expect, it } from "vitest";
import { type Box, findGuides } from "./guides";

const other: Box = [100, 100, 120, 80]; // left 100, centre 160, right 220; top 100, mid 140, bottom 180

describe("findGuides", () => {
  it("returns no nudge and no line when the boxes already line up exactly", () => {
    const g = findGuides([100, 400, 120, 80], [other]);
    expect(g.dx).toBe(0);
    expect(g.lines).toEqual([{ axis: "x", at: 100, from: 100, to: 480 }]);
    expect(g.dy).toBe(0);
  });

  it("snaps an edge within the threshold and draws the line across both boxes", () => {
    const g = findGuides([104, 400, 60, 80], [other]);
    expect(g.dx).toBe(-4);
    expect(g.lines).toEqual([{ axis: "x", at: 100, from: 100, to: 480 }]);
  });

  it("snaps the vertical axis the same way", () => {
    const g = findGuides([400, 95, 60, 80], [other]);
    expect(g.dy).toBe(5);
    expect(g.dx).toBe(0);
    expect(g.lines).toEqual([{ axis: "y", at: 100, from: 100, to: 460 }]);
  });

  it("leaves a box outside the threshold where it is", () => {
    const g = findGuides([107, 400, 61, 80], [other]);
    expect(g).toEqual({ dx: 0, dy: 0, lines: [] });
    expect(findGuides([107, 400, 61, 80], [other], 8).dx).toBe(-7);
  });

  it("prefers an edge to a centre at the same distance", () => {
    // Same width: left-left and centre-centre are both 3 away; the edge wins.
    const g = findGuides([103, 400, 120, 80], [other]);
    expect(g.dx).toBe(-3);
    expect(g.lines[0]).toMatchObject({ axis: "x", at: 100 });
    // A centre wins when it is strictly nearer.
    const c = findGuides([128, 400, 60, 80], [other]); // centre 158 vs 160; left 128 vs 100
    expect(c.dx).toBe(2);
    expect(c.lines[0]).toMatchObject({ axis: "x", at: 160 });
  });

  it("picks the nearest of several candidates on each axis", () => {
    const others: Box[] = [
      [0, 0, 50, 50], // right 50
      [300, 600, 50, 50], // left 300
      [500, 203, 50, 50], // top 203
    ];
    const g = findGuides([296, 198, 40, 40], others, 6); // left 296: 4 from 300; right 336
    expect(g.dx).toBe(4);
    expect(g.dy).toBe(5); // top 198 -> 203
    expect(g.lines).toEqual([
      { axis: "x", at: 300, from: 203, to: 650 },
      { axis: "y", at: 203, from: 300, to: 550 },
    ]);
  });
});
