// Edge geometry, derived from node positions alone. The layout engine places boxes; this places
// the lines between them, and it has to run again on every drag, so it is separate from ranking.
// This is the one implementation: the editor, the automatic layout and the server renderer all
// draw edges from here, so the canvas, the design page and every export show the same picture.
// Centre to centre, clipped at the box border, a quadratic bend around the first box the
// straight line would cut through, and parallel and reciprocal edges spread into lanes.
//
// Lanes. Every edge between the same two boxes, in either direction, shares one bucket. A lone
// edge is straight. With n in a bucket, edge k (in document order) bows out to
// (k - (n - 1) / 2) * LANE_STEP px off the centre line at its midpoint, measured along the
// perpendicular of the pair taken in a fixed order, never the edge's own direction. Measured
// along the edge's own direction, A→B and B→A flip both the lane index and the perpendicular,
// and the two land on exactly the same line: one line with an arrowhead at each end. A lane is
// a curve, and its ends are clipped toward the curve's control point, so each lane leaves and
// meets the boxes at its own point and carries its own arrowhead.
//
// Edges carry no id in the format, so nothing here goes into the design file. The one thing a
// person can adjust by hand, an edge's bow, lives in the layout sidecar under a key derived from
// the pair; everything else is recomputed from the boxes on every frame.

// Distance between neighbouring lanes at their midpoints, in px.
export const LANE_STEP = 24;
export const BEND_REACH = 46;
// How far a label on a lane stands off its own curve.
export const LABEL_GAP = 6;

function clip(box, towardX, towardY) {
  const [x, y, w, h] = box;
  const cx = x + w / 2,
    cy = y + h / 2;
  const dx = towardX - cx,
    dy = towardY - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const sx = dx ? w / 2 / Math.abs(dx) : 1e9;
  const sy = dy ? h / 2 / Math.abs(dy) : 1e9;
  const s = Math.min(sx, sy);
  return [cx + dx * s, cy + dy * s];
}

// Segment against rectangle, with the renderer's 6px slack, by the slab method.
function hits(x1, y1, x2, y2, box) {
  const [bx, by, bw, bh] = box;
  const rx0 = bx - 6,
    ry0 = by - 6,
    rx1 = bx + bw + 6,
    ry1 = by + bh + 6;
  let t0 = 0,
    t1 = 1;
  const dx = x2 - x1,
    dy = y2 - y1;
  const edges = [
    [-dx, x1 - rx0],
    [dx, rx1 - x1],
    [-dy, y1 - ry0],
    [dy, ry1 - y1],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      t0 = Math.max(t0, t);
    } else {
      if (t < t0) return false;
      t1 = Math.min(t1, t);
    }
  }
  return t0 <= t1;
}

// An edge has no id in the format and two edges between the same pair are indistinguishable, so
// a manual adjustment is keyed by the pair plus its position among that pair's own edges. The key
// survives edits elsewhere in the document and is dropped on load when it no longer resolves.
export function edgeKeys(doc) {
  const seen = new Map();
  return (doc.edges || []).map((e) => {
    const pair = `${e.from}>${e.to}`;
    const n = seen.get(pair) || 0;
    seen.set(pair, n + 1);
    return n ? `${pair}#${n}` : pair;
  });
}

/**
 * Carry the bows across an edit that keeps every edge at its index, such as reversing one.
 * Keys come from the pair and the order within it, so reversing one of two reciprocal edges
 * would otherwise hand one edge's bow to the other. A bow is measured along the edge's own
 * perpendicular, so a reversed edge's bow changes sign and its curve stays where it was.
 */
export function rekeyBows(before, after, bows, reversed = []) {
  const was = edgeKeys(before);
  const now = edgeKeys(after);
  if (was.length !== now.length) return { ...bows };
  const flip = new Set(reversed);
  const out = {};
  was.forEach((k, i) => {
    const v = Number(bows[k]) || 0;
    if (v) out[now[i]] = flip.has(i) ? -v : v;
  });
  return out;
}

// Where an edge's label goes. A lone edge's sits centred just above its midpoint. An edge that
// shares its pair has its label on the outer side of its own curve, so two lanes' labels sit on
// opposite sides and cross neither lane. `at` is the baseline point and `anchor` the SVG
// text-anchor; the 9 is a label's cap height, so a label hung below its curve clears it.
function labelPlacement(mid, points, shared) {
  const above = { at: [mid[0], mid[1] - 5], anchor: "middle" };
  if (!shared || points.length !== 3) return above;
  const [[x1, y1], , [x2, y2]] = points;
  let nx = mid[0] - (x1 + x2) / 2,
    ny = mid[1] - (y1 + y2) / 2;
  const l = Math.hypot(nx, ny);
  if (l < 0.5) return above;
  nx /= l;
  ny /= l;
  const anchor = nx > 0.38 ? "start" : nx < -0.38 ? "end" : "middle";
  const x = mid[0] + nx * LABEL_GAP;
  const y =
    ny < -0.38 ? mid[1] + ny * LABEL_GAP : ny > 0.38 ? mid[1] + ny * LABEL_GAP + 9 : mid[1] + 4;
  return { at: [x, y], anchor };
}

// `bows` maps an edge key to a perpendicular offset in pixels for the curve's control point,
// measured along the edge's own from→to perpendicular. A bow of zero means the edge is drawn
// automatically: its lane, and the bend it takes around any box the straight line would cut
// through. A manual bow replaces both.
export function edgeGeometry(doc, boxes, bows = {}) {
  const keys = edgeKeys(doc);
  const edges = doc.edges || [];
  const buckets = new Map();
  edges.forEach((e, i) => {
    const key = [e.from, e.to].sort().join("\u0000");
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(i);
  });
  const out = [];
  for (const indices of buckets.values()) {
    const n = indices.length;
    indices.forEach((i, k) => {
      const e = edges[i];
      const a = boxes[e.from],
        b = boxes[e.to];
      if (!a || !b) return;
      const ax = a[0] + a[2] / 2,
        ay = a[1] + a[3] / 2;
      const bx = b[0] + b[2] / 2,
        by = b[1] + b[3] / 2;
      // The pair's own perpendicular, one for both directions: lesser id to greater, turned a
      // quarter. The same order the bucket key sorts by.
      const forward = String(e.from) <= String(e.to);
      const pdx = forward ? bx - ax : ax - bx,
        pdy = forward ? by - ay : ay - by;
      const plen = Math.hypot(pdx, pdy) || 1;
      const qx = -pdy / plen,
        qy = pdx / plen;
      const lane = n === 1 ? 0 : (k - (n - 1) / 2) * LANE_STEP;
      const bow = Number(bows[keys[i]]) || 0;
      let x1, y1, x2, y2;
      let bend = null;
      if (bow) {
        // Drawn by hand: the control point off the chord's midpoint along the edge's own
        // perpendicular, which is the value `bowAt` wrote.
        [x1, y1] = clip(a, bx, by);
        [x2, y2] = clip(b, ax, ay);
        const ddx = x2 - x1,
          ddy = y2 - y1;
        const l = Math.hypot(ddx, ddy) || 1;
        bend = [(x1 + x2) / 2 + (-ddy / l) * bow, (y1 + y2) / 2 + (ddx / l) * bow];
      } else {
        // A lane's control point sits twice the lane out, so the curve's midpoint is on the lane.
        const control = lane
          ? [(ax + bx) / 2 + qx * lane * 2, (ay + by) / 2 + qy * lane * 2]
          : null;
        if (control) {
          [x1, y1] = clip(a, control[0], control[1]);
          [x2, y2] = clip(b, control[0], control[1]);
        } else {
          [x1, y1] = clip(a, bx, by);
          [x2, y2] = clip(b, ax, ay);
        }
        const ox = qx * lane,
          oy = qy * lane;
        for (const [id, box] of Object.entries(boxes)) {
          if (id === e.from || id === e.to) continue;
          if (!hits(x1 + ox, y1 + oy, x2 + ox, y2 + oy, box)) continue;
          const mx = (x1 + x2) / 2 + ox,
            my = (y1 + y2) / 2 + oy;
          const ocx = box[0] + box[2] / 2,
            ocy = box[1] + box[3] / 2;
          const ddx = x2 - x1,
            ddy = y2 - y1;
          const l = Math.hypot(ddx, ddy) || 1;
          const px = -ddy / l,
            py = ddx / l;
          const side = px * (mx - ocx) + py * (my - ocy) >= 0 ? 1 : -1;
          const reach = (box[2] / 2 + BEND_REACH) * side;
          // Around the obstacle, and still a lane apart from the pair's other edges.
          bend = [mx + px * reach + ox, my + py * reach + oy];
          break;
        }
        if (!bend) bend = control;
      }
      const points = bend
        ? [[x1, y1], bend, [x2, y2]]
        : [
            [x1, y1],
            [x2, y2],
          ];
      const mid = midpointOf(points);
      const place = labelPlacement(mid, points, n > 1);
      const label = e.label || e.protocol || null;
      out.push({
        i,
        key: keys[i],
        from: e.from,
        to: e.to,
        points,
        bow,
        lane,
        mid,
        labelAt: place.at,
        labelAnchor: place.anchor,
        dashed: e.mode === "async",
        label: label === null ? null : String(label),
      });
    });
  }
  return out.sort((p, q) => p.i - q.i);
}

// Where the line actually is, halfway along. For a curve that is not the control point: the
// control point sits twice as far out as the curve it pulls, so a label placed there drifts away
// from its own edge as the edge is bowed. This is the quadratic at t = 0.5.
export function midpointOf(points) {
  if (points.length === 3) {
    const [[x1, y1], [cx, cy], [x2, y2]] = points;
    return [x1 * 0.25 + cx * 0.5 + x2 * 0.25, y1 * 0.25 + cy * 0.5 + y2 * 0.25];
  }
  const [[x1, y1], [x2, y2]] = points;
  return [(x1 + x2) / 2, (y1 + y2) / 2];
}

export function pathOf(points) {
  if (points.length === 3) {
    const [[x1, y1], [cx, cy], [x2, y2]] = points;
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  const [[x1, y1], [x2, y2]] = points;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

// Group frames are the bounding box of members and child groups, exactly as the renderer draws
// them, so a frame never has to be stored and can never drift from the membership.
export function groupFrames(doc, boxes) {
  const groups = doc.groups || [];
  const frames = {};
  const members = {},
    children = {};
  for (const g of groups) {
    members[g.id] = [];
    children[g.id] = [];
  }
  for (const n of doc.nodes) if (n.group && members[n.group]) members[n.group].push(n.id);
  for (const g of groups) if (g.parent && children[g.parent]) children[g.parent].push(g.id);
  const done = new Set();
  const frameOf = (gid) => {
    if (done.has(gid)) return frames[gid] || null;
    done.add(gid);
    const rects = [];
    for (const c of children[gid] || []) {
      const f = frameOf(c);
      if (f) rects.push(f);
    }
    for (const id of members[gid] || []) if (boxes[id]) rects.push(boxes[id]);
    if (!rects.length) return null;
    const x0 = Math.min(...rects.map((r) => r[0])) - 16;
    const y0 = Math.min(...rects.map((r) => r[1])) - 32;
    const x1 = Math.max(...rects.map((r) => r[0] + r[2])) + 16;
    const y1 = Math.max(...rects.map((r) => r[1] + r[3])) + 16;
    frames[gid] = [x0, y0, x1 - x0, y1 - y0];
    return frames[gid];
  };
  for (const g of groups) frameOf(g.id);
  return frames;
}

// The order boundaries are painted in: the document's order, except that a parent always comes
// before its children, so a nested boundary is drawn over the one that contains it. A document
// that already lists parents first comes back unchanged. A parent chain that loops or names a
// missing group simply stops there.
export function framesOuterFirst(groups) {
  const list = groups || [];
  const byId = new Map(list.map((g) => [g.id, g]));
  const out = [];
  const placed = new Set();
  const place = (g, path) => {
    if (placed.has(g.id) || path.has(g.id)) return;
    path.add(g.id);
    const parent = g.parent != null ? byId.get(g.parent) : undefined;
    if (parent) place(parent, path);
    placed.add(g.id);
    out.push(g);
  };
  for (const g of list) place(g, new Set());
  return out;
}

// The boundaries that sit inside a tinted one. A tint fills only its own boundary's area, so each
// of these paints the page background behind itself first: an untinted child reads as plain
// page, a tinted child shows its own tint over the page rather than over its parent's.
export function framesUnderTint(groups, isTinted) {
  const list = groups || [];
  const byId = new Map(list.map((g) => [g.id, g]));
  const out = new Set();
  for (const g of list) {
    const seen = new Set([g.id]);
    let p = g.parent != null ? byId.get(g.parent) : undefined;
    while (p && !seen.has(p.id)) {
      if (isTinted(p.id)) {
        out.add(g.id);
        break;
      }
      seen.add(p.id);
      p = p.parent != null ? byId.get(p.parent) : undefined;
    }
  }
  return out;
}

// Which group frame contains a point, innermost first. Membership changes on drop use this, and
// only this, so a drag can never re-parent a node by accident mid-move.
export function innermostFrameAt(frames, x, y) {
  let best = null,
    bestArea = Infinity;
  for (const [gid, f] of Object.entries(frames)) {
    if (x < f[0] || y < f[1] || x > f[0] + f[2] || y > f[1] + f[3]) continue;
    const area = f[2] * f[3];
    if (area < bestArea) {
      best = gid;
      bestArea = area;
    }
  }
  return best;
}

// How far a pointer sits from the straight line between two boxes, measured along the
// perpendicular at the midpoint. This is the value a drag writes, so dragging an edge away from
// its twin separates them and dragging it back returns it to the automatic path.
export function bowAt(boxes, from, to, x, y) {
  const a = boxes[from],
    b = boxes[to];
  if (!a || !b) return 0;
  const ax = a[0] + a[2] / 2,
    ay = a[1] + a[3] / 2;
  const bx = b[0] + b[2] / 2,
    by = b[1] + b[3] / 2;
  const dx = bx - ax,
    dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const mx = (ax + bx) / 2,
    my = (ay + by) / 2;
  const value = ((-dy / len) * (x - mx) + (dx / len) * (y - my)) * 2;
  return Math.max(-1200, Math.min(1200, Math.round(value)));
}
