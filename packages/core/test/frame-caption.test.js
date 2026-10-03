// A group's frame is at least as wide as its caption: a long label on a group holding one narrow
// node no longer runs out of its frame. Past CAPTION_MAX the caption wraps onto two lines and the
// label strip grows by a line, pushing the members down. The automatic layout and the drawn
// frames size it the same way, through one function (frameAround in geometry.js).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { drawnLayout } from "../src/drawn.js";
import {
  FRAME_PAD_TOP,
  FRAME_PAD_X,
  frameAround,
  frameCaptions,
  groupFrames,
} from "../src/geometry.js";
import { layout } from "../src/layout.js";
import { toSvg } from "../src/render.js";
import {
  CAPTION_LINE,
  CAPTION_MAX,
  CAPTION_PAD,
  FRAME_ICON_SHIFT,
  frameCaption,
  textWidth,
} from "../src/text.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogue = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));

const design = (label) => ({
  id: "cap",
  nodes: [{ id: "job", component: "container-service", group: "jobs" }],
  edges: [],
  groups: [{ id: "jobs", kind: "system", label }],
});

describe("group caption width", () => {
  it("widens a narrow frame to hold its caption and its padding", () => {
    const label = "Background Jobs & Triggers";
    const lay = layout(design(label), catalogue);
    const f = lay.frames.jobs;
    expect(f[2]).toBeGreaterThanOrEqual(textWidth(label, 12) + CAPTION_PAD);
    // the one member sits in the middle of the wider frame
    const [x] = lay.positions.job;
    const [w] = lay.sizes.job;
    expect(Math.abs(x - f[0] - (f[0] + f[2] - x - w))).toBeLessThanOrEqual(1);
  });

  it("leaves a frame its members already make wide enough exactly as it was", () => {
    const lay = layout(design("Jobs"), catalogue);
    const [x, y] = lay.positions.job;
    const [w, h] = lay.sizes.job;
    expect(lay.frames.jobs).toEqual([x - 16, y - 32, w + 32, h + 48]);
  });

  it("makes room for an icon", () => {
    const one = frameCaption("Background Jobs & Triggers");
    const iconed = frameCaption("Background Jobs & Triggers", true);
    expect(iconed.width - one.width).toBeGreaterThanOrEqual(FRAME_ICON_SHIFT - 1);
  });

  it("wraps a caption past the cap onto two lines and grows the strip by one line", () => {
    const label =
      "Background Jobs, Scheduled Triggers, Event Grid Subscriptions and Durable Orchestrations";
    const cap = frameCaption(label);
    expect(cap.lines).toHaveLength(2);
    expect(cap.width).toBeLessThanOrEqual(CAPTION_MAX);
    expect(cap.extra).toBe(CAPTION_LINE);
    const lay = layout(design(label), catalogue);
    const f = lay.frames.jobs;
    expect(f[2]).toBeLessThanOrEqual(CAPTION_MAX);
    expect(lay.positions.job[1] - f[1]).toBe(FRAME_PAD_TOP + CAPTION_LINE);
    expect(frameCaptions(design(label)).jobs.strip).toBe(FRAME_PAD_TOP - 2 + CAPTION_LINE);
    const svg = toSvg(design(label), catalogue, { theme: "light" });
    expect(svg.match(/<tspan /g)).toHaveLength(2);
  });

  it("draws the frame the layout made, from the members alone", () => {
    for (const label of ["Jobs", "Background Jobs & Triggers", "x ".repeat(80)]) {
      const doc = design(label);
      const lay = layout(doc, catalogue);
      const boxes = { job: [...lay.positions.job, ...lay.sizes.job] };
      expect(groupFrames(doc, boxes, frameCaptions(doc, catalogue))).toEqual(lay.frames);
      const drawn = drawnLayout(doc, catalogue, { nodes: { job: lay.positions.job } });
      expect(drawn.frames).toEqual(lay.frames);
    }
  });

  it("shares the extra width either side of the content", () => {
    expect(frameAround(100, 100, 200, 178, { width: 200, extra: 0 })).toEqual([
      100 - FRAME_PAD_X - 34,
      68,
      200,
      126,
    ]);
    expect(frameAround(100, 100, 200, 178, null)).toEqual([84, 68, 132, 126]);
  });
});
