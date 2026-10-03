import { describe, expect, it } from "vitest";
import { dropPort, FRAME_BAND, frameTargetAt, onFrameTarget } from "./frame-target";

type Box = [number, number, number, number];
const frames: Record<string, Box> = { outer: [0, 0, 800, 600], inner: [100, 100, 300, 200] };

describe("frameTargetAt", () => {
  it("leaves the interior alone: a drop there is about a new member, not the group", () => {
    expect(frameTargetAt(frames, 250, 220)).toBeNull();
    expect(frameTargetAt(frames, 600, 400)).toBeNull();
  });
  it("takes the dashed border, inside or outside the line", () => {
    expect(frameTargetAt(frames, 100 - FRAME_BAND + 1, 200)).toBe("inner");
    expect(frameTargetAt(frames, 100 + FRAME_BAND - 1, 200)).toBe("inner");
    expect(frameTargetAt(frames, 790, 300)).toBe("outer");
    expect(frameTargetAt(frames, 100 - FRAME_BAND - 2, 200)).toBeNull();
  });
  it("takes the label strip along the top", () => {
    expect(frameTargetAt(frames, 250, 125)).toBe("inner");
  });
  it("scales the band with the zoom, and skips the excepted frame", () => {
    expect(onFrameTarget(frames.inner, 100 - 20, 200, 1)).toBe(false);
    expect(onFrameTarget(frames.inner, 100 - 20, 200, 0.5)).toBe(true);
    expect(frameTargetAt(frames, 100, 200, 1, "inner")).toBeNull();
  });
});

describe("dropPort", () => {
  const f = frames.inner; // x 100..400, y 100..300
  it("attaches a drop on a frame's border band to the nearest point of that border", () => {
    expect(dropPort(f, 100 - 5, 200, true)).toEqual({ side: "left", t: 0.5 });
    expect(dropPort(f, 100 + 5, 200, true)).toEqual({ side: "left", t: 0.5 });
    expect(dropPort(f, 340, 100 + 3, true)).toEqual({ side: "top", t: 0.8 });
    expect(dropPort(f, 404, 150, true)).toEqual({ side: "right", t: 0.25 });
  });
  it("attaches a drop on the label strip to the top side, straight above it", () => {
    expect(dropPort(f, 100 + FRAME_BAND + 6, 125, true)).toEqual({ side: "top", t: 0.067 });
    expect(dropPort(f, 250, 125, true)).toEqual({ side: "top", t: 0.5 });
  });
  it("attaches a drop anywhere on a component to its nearest side", () => {
    expect(dropPort(f, 120, 125)).toEqual({ side: "left", t: 0.125 });
    expect(dropPort(f, 160, 290)).toEqual({ side: "bottom", t: 0.2 });
  });
});
