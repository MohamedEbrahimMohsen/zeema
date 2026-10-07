// Alignment guides while dragging, as draw.io draws them: the dragged box's left, centre and
// right are compared with every other box's left, centre and right, and its top, middle and
// bottom likewise. Per axis the nearest match within the threshold wins; it is returned as the
// nudge that lines the two up and a guide line spanning both boxes. An edge beats a centre at the
// same distance. Pure: no DOM; one pass over `others` and no allocation but the result.

export type Box = [number, number, number, number];

export interface GuideLine {
  /** "x": a vertical line at x = `at`; "y": a horizontal line at y = `at`. */
  axis: "x" | "y";
  at: number;
  /** Where the line starts and ends along the other axis, covering both boxes. */
  from: number;
  to: number;
}

export interface Guides {
  dx: number;
  dy: number;
  lines: GuideLine[];
}

/** The snap that lines `dragged` up with the nearest of `others`, per axis, within `threshold`. */
export function findGuides(dragged: Box, others: readonly Box[], threshold = 6): Guides {
  const [x, y, w, h] = dragged;
  let bestX = Number.POSITIVE_INFINITY;
  let edgeX = false;
  let dx = 0;
  let atX = 0;
  let otherX = -1;
  let bestY = Number.POSITIVE_INFINITY;
  let edgeY = false;
  let dy = 0;
  let atY = 0;
  let otherY = -1;
  for (let k = 0; k < others.length; k++) {
    const o = others[k];
    // Three anchors on each side: 0 the start edge, 1 the centre, 2 the end edge.
    for (let i = 0; i < 3; i++) {
      const mine = x + (w * i) / 2;
      const mineY = y + (h * i) / 2;
      for (let j = 0; j < 3; j++) {
        const theirs = o[0] + (o[2] * j) / 2;
        const d = Math.abs(theirs - mine);
        // A centre-to-centre match, or a centre against an edge, is weaker than edge to edge.
        const edge = i !== 1 && j !== 1;
        if (d <= threshold && (d < bestX || (d === bestX && edge && !edgeX))) {
          bestX = d;
          edgeX = edge;
          dx = theirs - mine;
          atX = theirs;
          otherX = k;
        }
        const theirsY = o[1] + (o[3] * j) / 2;
        const dY = Math.abs(theirsY - mineY);
        if (dY <= threshold && (dY < bestY || (dY === bestY && edge && !edgeY))) {
          bestY = dY;
          edgeY = edge;
          dy = theirsY - mineY;
          atY = theirsY;
          otherY = k;
        }
      }
    }
  }
  const lines: GuideLine[] = [];
  // The lines span the dragged box where it lands and the box it lines up with.
  if (otherX >= 0) {
    const o = others[otherX];
    lines.push({
      axis: "x",
      at: atX,
      from: Math.min(y + dy, o[1]),
      to: Math.max(y + dy + h, o[1] + o[3]),
    });
  }
  if (otherY >= 0) {
    const o = others[otherY];
    lines.push({
      axis: "y",
      at: atY,
      from: Math.min(x + dx, o[0]),
      to: Math.max(x + dx + w, o[0] + o[2]),
    });
  }
  return { dx, dy, lines };
}
