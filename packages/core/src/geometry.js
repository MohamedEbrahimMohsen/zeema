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
// Edges carry no id in the format, so nothing here goes into the design file. The two things a
// person can adjust by hand, an edge's bow and where each of its ends meets its box (a port),
// live in the layout sidecar under a key derived from the pair; everything else is recomputed
// from the boxes on every frame.

// Distance between neighbouring lanes at their midpoints, in px.
export const LANE_STEP = 24;
export const BEND_REACH = 46;
// How far a label on a lane stands off its own curve.
export const LABEL_GAP = 6;
// How far a ported end runs straight out of its box, along the side's outward normal, before the
// curve takes over. Shorter when the two ends are close, so facing ports never cross stubs.
export const STUB = 28;

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

/**
 * Carry the ports across the same kind of edit as `rekeyBows`: every edge keeps its index. A
 * reversed edge's ends trade places, so its `from` port becomes its `to` port and the arrow
 * still leaves and meets its boxes where it did.
 */
export function rekeyPorts(before, after, ports, reversed = []) {
  const was = edgeKeys(before);
  const now = edgeKeys(after);
  if (was.length !== now.length) return { ...ports };
  const flip = new Set(reversed);
  const out = {};
  was.forEach((k, i) => {
    const v = ports && Object.hasOwn(ports, k) ? ports[k] : null;
    if (!v || (!v.from && !v.to)) return;
    const next = {};
    const from = flip.has(i) ? v.to : v.from;
    const to = flip.has(i) ? v.from : v.to;
    if (from) next.from = from;
    if (to) next.to = to;
    out[now[i]] = next;
  });
  return out;
}

// A port is where one end of an edge meets its box: a side, and how far along it (0 to 1, left
// to right on top and bottom, top to bottom on left and right). It is relative to the box, so
// it survives the box moving, and nothing about it is in the design document.
export const PORT_SIDES = ["top", "right", "bottom", "left"];

export function isPort(p) {
  return (
    p != null &&
    typeof p === "object" &&
    PORT_SIDES.includes(p.side) &&
    typeof p.t === "number" &&
    Number.isFinite(p.t)
  );
}

const unit = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

const NORMALS = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };

/** The outward unit normal of the side a port sits on. */
export function portNormal(port) {
  return NORMALS[port.side] ?? [0, 0];
}

// Where each end of an edge is anchored and what the curve between them aims at. A ported end
// is anchored on its port and aims at the tip of its stub, the port pushed out along the side's
// normal; an unported end has neither (null) and is clipped later. The stub is STUB long, or a
// third of the distance between the two anchors (ports or centres) when that is shorter.
function endsOf(a, b, from, to) {
  const pa = isPort(from) ? portPoint(a, from) : null;
  const pb = isPort(to) ? portPoint(b, to) : null;
  if (!pa && !pb) return { pa, pb, sa: null, sb: null };
  const [ax, ay] = pa ?? [a[0] + a[2] / 2, a[1] + a[3] / 2];
  const [bx, by] = pb ?? [b[0] + b[2] / 2, b[1] + b[3] / 2];
  const reach = Math.min(STUB, Math.hypot(bx - ax, by - ay) / 3);
  const tip = (p, port) => {
    const [nx, ny] = portNormal(port);
    return [p[0] + nx * reach, p[1] + ny * reach];
  };
  return { pa, pb, sa: pa && tip(pa, from), sb: pb && tip(pb, to) };
}

/** The world point a port names on a box. */
export function portPoint(box, port) {
  const [x, y, w, h] = box;
  const t = unit(port.t);
  if (port.side === "top") return [x + w * t, y];
  if (port.side === "bottom") return [x + w * t, y + h];
  if (port.side === "left") return [x, y + h * t];
  return [x + w, y + h * t];
}

/**
 * The port nearest a world point: the side the point is closest to, and the fraction along it
 * the point projects to, clamped to the side and rounded to 3 decimals. `portPoint` undoes it
 * for any point on the border.
 */
export function portAt(box, px, py) {
  const [x, y, w, h] = box;
  const u = unit(w ? (px - x) / w : 0.5);
  const v = unit(h ? (py - y) / h : 0.5);
  const cx = x + w * u,
    cy = y + h * v;
  const sides = [
    ["top", Math.hypot(px - cx, py - y), u],
    ["right", Math.hypot(px - (x + w), py - cy), v],
    ["bottom", Math.hypot(px - cx, py - (y + h)), u],
    ["left", Math.hypot(px - x, py - cy), v],
  ];
  let best = sides[0];
  for (const side of sides) if (side[1] < best[1]) best = side;
  return { side: best[0], t: Math.round(best[2] * 1000) / 1000 };
}

// Where an edge's label goes. A lone edge's sits centred just above its midpoint. An edge that
// shares its pair has its label on the outer side of its own curve, so two lanes' labels sit on
// opposite sides and cross neither lane. `at` is the baseline point and `anchor` the SVG
// text-anchor; the 9 is a label's cap height, so a label hung below its curve clears it.
function labelPlacement(mid, points, shared) {
  const above = { at: [mid[0], mid[1] - 5], anchor: "middle" };
  if (!shared || points.length === 2) return above;
  const [[x1, y1], [x2, y2]] =
    points.length === 6 ? [points[1], points[4]] : [points[0], points[2]];
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
//
// `ports` maps an edge key to `{ from?, to? }`, each a port (see `portPoint`). A ported end sits
// exactly on its port and is never clipped, and it leaves its box squarely: a straight stub along
// the side's outward normal (see `endsOf`), so a port on the side facing away from the other end
// does not send the line back under its own box. The other end, if it has no port, is clipped
// toward the ported end's stub tip (or toward the curve's control point, as without ports). The
// lane, the bow and the bend around an obstacle all work on the middle part, between the two aim
// points (a stub tip, or an unported end), and never move a ported end.
//
// `points` is [from, to] for a straight edge and [from, control, to] for a quadratic one, exactly
// as before, whenever neither end is ported. With a port it is six points,
// [from, aimFrom, c1, c2, aimTo, to]: a stub, a cubic from aim to aim, a stub. An unported end's
// aim is the end itself, so its stub has no length and `pathOf` leaves it out. At a ported end
// the cubic's control runs along the normal, so the stub and the curve meet without a corner.
export function edgeGeometry(doc, boxes, bows = {}, ports = {}) {
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
      const own = ports && Object.hasOwn(ports, keys[i]) ? ports[keys[i]] : null;
      const { pa, pb, sa, sb } = endsOf(a, b, own?.from, own?.to);
      // What each unported end is clipped toward: the other end's stub tip if it is ported,
      // else the other box's centre.
      const [tax, tay] = sb ?? [bx, by];
      const [tbx, tby] = sa ?? [ax, ay];
      let x1, y1, x2, y2;
      // The middle part's two ends: a ported end's stub tip, else the (clipped) end itself.
      let u1, v1, u2, v2;
      let bend = null;
      if (bow) {
        // Drawn by hand: the control point off the chord's midpoint along the edge's own
        // perpendicular, which is the value `bowAt` wrote.
        [x1, y1] = pa ?? clip(a, tax, tay);
        [x2, y2] = pb ?? clip(b, tbx, tby);
        [u1, v1] = sa ?? [x1, y1];
        [u2, v2] = sb ?? [x2, y2];
        const ddx = u2 - u1,
          ddy = v2 - v1;
        const l = Math.hypot(ddx, ddy) || 1;
        bend = [(u1 + u2) / 2 + (-ddy / l) * bow, (v1 + v2) / 2 + (ddx / l) * bow];
      } else {
        // A lane's control point sits twice the lane out, so the curve's midpoint is on the lane.
        // It is measured from the middle of what the two ends aim at, which is the centres'
        // midpoint when neither end is ported.
        const [sax, say] = sa ?? [ax, ay];
        const [sbx, sby] = sb ?? [bx, by];
        const control = lane
          ? [(sax + sbx) / 2 + qx * lane * 2, (say + sby) / 2 + qy * lane * 2]
          : null;
        if (control) {
          [x1, y1] = pa ?? clip(a, control[0], control[1]);
          [x2, y2] = pb ?? clip(b, control[0], control[1]);
        } else {
          [x1, y1] = pa ?? clip(a, tax, tay);
          [x2, y2] = pb ?? clip(b, tbx, tby);
        }
        [u1, v1] = sa ?? [x1, y1];
        [u2, v2] = sb ?? [x2, y2];
        const ox = qx * lane,
          oy = qy * lane;
        // A ported end whose side faces away from the other end has its own box behind its
        // stub, so the middle may cut back across it: that box is an obstacle too, tried first.
        const away = (p, s, tx, ty) =>
          p && (tx - s[0]) * (s[0] - p[0]) + (ty - s[1]) * (s[1] - p[1]) < 0;
        const obstacles = [
          ...(away(pa, sa, u2, v2) ? [a] : []),
          ...(away(pb, sb, u1, v1) ? [b] : []),
          ...Object.entries(boxes)
            .filter(([id]) => id !== e.from && id !== e.to)
            .map(([, box]) => box),
        ];
        for (const box of obstacles) {
          if (!hits(u1 + ox, v1 + oy, u2 + ox, v2 + oy, box)) continue;
          const mx = (u1 + u2) / 2 + ox,
            my = (v1 + v2) / 2 + oy;
          const ocx = box[0] + box[2] / 2,
            ocy = box[1] + box[3] / 2;
          const ddx = u2 - u1,
            ddy = v2 - v1;
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
      const points =
        pa || pb
          ? stubbed([x1, y1], [u1, v1], [u2, v2], [x2, y2], bend, own)
          : bend
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

// The six points of an edge with a ported end: [start, aimStart, c1, c2, aimEnd, end]. The
// middle is the quadratic the edge would have been between the two aims (through `bend`, or
// straight), raised to a cubic. At a ported end its control is replaced by one along the side's
// normal, a third of the chord out (at least a stub), carrying the same bow offset, so the curve
// leaves the stub without a corner and a bow or a lane still pulls it the same way.
function stubbed(start, aimStart, aimEnd, end, bend, own) {
  const [u1, v1] = aimStart,
    [u2, v2] = aimEnd;
  const mx = (u1 + u2) / 2,
    my = (v1 + v2) / 2;
  const [qx, qy] = bend ?? [mx, my];
  const offx = ((qx - mx) * 2) / 3,
    offy = ((qy - my) * 2) / 3;
  const reach = Math.max(STUB, Math.hypot(u2 - u1, v2 - v1) / 3);
  const control = (u, v, port) => {
    if (!isPort(port)) return [u + ((qx - u) * 2) / 3, v + ((qy - v) * 2) / 3];
    const [nx, ny] = portNormal(port);
    return [u + nx * reach + offx, v + ny * reach + offy];
  };
  return [start, aimStart, control(u1, v1, own?.from), control(u2, v2, own?.to), aimEnd, end];
}

// Where the line actually is, halfway along. For a curve that is not the control point: the
// control point sits twice as far out as the curve it pulls, so a label placed there drifts away
// from its own edge as the edge is bowed. This is the quadratic at t = 0.5, or, for an edge with
// a ported end, the middle cubic at t = 0.5: the stubs are short and straight, and the middle is
// the part that carries the shape.
export function midpointOf(points) {
  if (points.length === 6) {
    const [, [x1, y1], [c1x, c1y], [c2x, c2y], [x2, y2]] = points;
    return [(x1 + 3 * c1x + 3 * c2x + x2) / 8, (y1 + 3 * c1y + 3 * c2y + y2) / 8];
  }
  if (points.length === 3) {
    const [[x1, y1], [cx, cy], [x2, y2]] = points;
    return [x1 * 0.25 + cx * 0.5 + x2 * 0.25, y1 * 0.25 + cy * 0.5 + y2 * 0.25];
  }
  const [[x1, y1], [x2, y2]] = points;
  return [(x1 + x2) / 2, (y1 + y2) / 2];
}

export function pathOf(points) {
  if (points.length === 6) {
    const f = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;
    const [start, aimStart, c1, c2, aimEnd, end] = points.map(f);
    // A stub of no length (an unported end) is left out, so the path has no degenerate segment
    // for the arrowhead to take its direction from.
    const lead = aimStart === start ? "" : ` L${aimStart}`;
    const tail = aimEnd === end ? "" : ` L${end}`;
    return `M${start}${lead} C${c1} ${c2} ${aimEnd}${tail}`;
  }
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

// The order groups are painted in: the document's order, except that a parent always comes
// before its children, so a nested group is drawn over the one that contains it. A document
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

// The groups that sit inside a tinted one. A tint fills only its own group's area, so each
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
//
// With `ends` (the edge's `{ from?, to? }` ports) a ported end is measured from its stub's tip
// (where the middle of the edge starts) rather than its box's centre, so the curve follows the pointer on an edge whose ends were placed.
/** @param {{ from?: object, to?: object } | null} [ends] */
export function bowAt(boxes, from, to, x, y, ends = null) {
  const a = boxes[from],
    b = boxes[to];
  if (!a || !b) return 0;
  const { sa, sb } = endsOf(a, b, ends?.from, ends?.to);
  const [ax, ay] = sa ?? [a[0] + a[2] / 2, a[1] + a[3] / 2];
  const [bx, by] = sb ?? [b[0] + b[2] / 2, b[1] + b[3] / 2];
  const dx = bx - ax,
    dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const mx = (ax + bx) / 2,
    my = (ay + by) / 2;
  const value = ((-dy / len) * (x - mx) + (dx / len) * (y - my)) * 2;
  return Math.max(-1200, Math.min(1200, Math.round(value)));
}
