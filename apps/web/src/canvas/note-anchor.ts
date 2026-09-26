// Dropping a note onto a component or a group pins it there. The two questions that gesture
// asks, what is under the pointer and what offset keeps the note where it was let go, are pure
// geometry, so they live here and not in the scene.

import { innermostFrameAt } from "@zeema/core/geometry";
import { anchorKey, type NoteAnchor } from "@/lib/layout-sidecar";

type Box = [number, number, number, number];

const inside = (b: Box, x: number, y: number) =>
  x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3];

/**
 * What a note dropped at (x, y) would be pinned to: the topmost node box under the point, else
 * the innermost group frame around it, else nothing. A node inside a group wins over the group.
 * `order` is the node ids in drawing order (last drawn is on top).
 *
 * `current` is the box of what the note already follows, if anything. A group around that box
 * is not a new target: a pinned note sits just outside its component, usually still inside
 * that component's group, and nudging it there must not quietly re-pin it to the group.
 */
export function noteDropTarget(
  order: readonly string[],
  boxes: Record<string, Box>,
  frames: Record<string, Box>,
  x: number,
  y: number,
  current: Box | null = null,
): NoteAnchor | null {
  for (let i = order.length - 1; i >= 0; i--) {
    const b = boxes[order[i]];
    if (b && inside(b, x, y)) return { node: order[i] };
  }
  const group = innermostFrameAt(frames, x, y) as string | null;
  if (!group) return null;
  const f = frames[group];
  const around =
    current &&
    current[0] >= f[0] &&
    current[1] >= f[1] &&
    current[0] + current[2] <= f[0] + f[2] &&
    current[1] + current[3] <= f[1] + f[3];
  return around ? null : { group };
}

/** Whether two anchors name the same target. */
export const sameAnchor = (a?: NoteAnchor | null, b?: NoteAnchor | null) =>
  Boolean(a && b && anchorKey(a) === anchorKey(b));

/**
 * A note's world top-left as the offset an anchored note stores: from the TOP-RIGHT corner of
 * its target's box, so re-anchoring leaves the note exactly where it is drawn.
 */
export function anchorOffset(target: Box, x: number, y: number): [number, number] {
  return [Math.round(x - (target[0] + target[2])), Math.round(y - target[1])];
}
