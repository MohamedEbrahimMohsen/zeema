// Where a wire, or a dragged edge end, attaches to a group as a unit. The inside of a frame is
// where its members live, so a wire let go there is about a new member (the picker's "Add and
// connect"), never about the group. The group itself is aimed at explicitly: its dashed border,
// within BAND screen pixels either side of the line, or its label strip along the top.

import { portAt } from "@zeema/core/geometry";
import type { Port } from "@/lib/layout-sidecar";

type Box = [number, number, number, number];

/** How far either side of a frame's dashed line still counts as "on the border", in screen px. */
export const FRAME_BAND = 14;
/** The label strip: the top of a frame, above its first row of members (FRAME_PAD_TOP is 32). */
export const FRAME_LABEL_STRIP = 30;

/** Is the world point on this frame's border band or its label strip? `k` is the zoom. */
export function onFrameTarget(f: Box, x: number, y: number, k = 1) {
  const band = FRAME_BAND / k;
  const [fx, fy, fw, fh] = f;
  const dx = Math.max(fx - x, 0, x - (fx + fw));
  const dy = Math.max(fy - y, 0, y - (fy + fh));
  if (dx || dy) return Math.hypot(dx, dy) <= band;
  const rim = Math.min(x - fx, fx + fw - x, y - fy, fy + fh - y);
  return rim <= band || y - fy <= FRAME_LABEL_STRIP;
}

/**
 * Where on a target's border an edge end let go at (x, y) attaches: the nearest border point, as
 * a port. A frame aimed at through its label strip (not its border band) attaches on its top
 * side, straight above the point. `frame` says the box is a group's frame; `k` is the zoom.
 */
export function dropPort(box: Box, x: number, y: number, frame = false, k = 1): Port {
  const [fx, fy, fw, fh] = box;
  const inside = x >= fx && x <= fx + fw && y >= fy && y <= fy + fh;
  const rim = Math.min(x - fx, fx + fw - x, y - fy, fy + fh - y);
  if (frame && inside && rim > FRAME_BAND / k) {
    const t = fw ? Math.min(Math.max((x - fx) / fw, 0), 1) : 0.5;
    return { side: "top", t: Math.round(t * 1000) / 1000 };
  }
  return portAt(box, x, y) as Port;
}

/**
 * The group a point aims at: of the frames whose band or label strip holds it, the innermost
 * (the smallest). `except` is never returned. Null when the point is on no frame's target.
 */
export function frameTargetAt(
  frames: Record<string, Box>,
  x: number,
  y: number,
  k = 1,
  except: string | null = null,
): string | null {
  let best: string | null = null;
  let area = Number.POSITIVE_INFINITY;
  for (const [id, f] of Object.entries(frames)) {
    if (id === except || !onFrameTarget(f, x, y, k)) continue;
    const a = f[2] * f[3];
    if (a < area) {
      best = id;
      area = a;
    }
  }
  return best;
}
