import { describe, expect, it } from "vitest";
import { FRAME_BAND, frameTargetAt, onFrameTarget } from "./frame-target";

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
