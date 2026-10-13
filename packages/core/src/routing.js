// Orthogonal edge routing: every edge is a run of horizontal and vertical segments with rounded
// corners, the way draw.io's orthogonal connector draws. geometry.js calls this for
// `routing: "orthogonal"` and "bundled" and keeps its curves for "curved"; nothing else imports it.
//
// Sides. An end with a port (the layout sidecar's `ports`) leaves from its port's side, at its
// t. Otherwise the two boxes decide: one mostly above the other joins bottom to top, one mostly
// beside the other joins right to left (or the reverse). A box and a frame that holds it (a
// member and its own group, a child group and its parent) join through the side of the inner box
// nearest the outer one's border, straight out to that border.
//
// Spread. Every unported end on one side of one box is spaced evenly along the middle 70% of the
// side, ordered by where the other end's box is, so the edges leave and arrive without crossing
// each other at the box. An end alone on its side moves to line up with the other end when that
// end lies over it, so a lone edge between two stacked boxes is one straight line. A group's
// caption is never crossed: ends on a top side under a caption move to the stretch it leaves
// clear, or, when there is none, to the side facing the other end.
//
// Route. Each end steps out ORTHO_STUB px square to its side. Between the two steps the router
// tries a straight line, an L, and a Z whose cross run sits in a free channel between rows (or
// columns) of boxes, then, if every one of those cuts through a box, a detour with two cross runs
// and a jog between them. A candidate is scored by length, corners and every box or caption it
// cuts through (an end's own box counts, frames never do); the cheapest wins, deterministically.
//
// Lanes. Inner runs of different edges on one line are spread ORTHO_LANE px apart, ordered so
// that runs going the same way do not cross each other's legs. A bow (the sidecar's `edges`, a
// number) moves a Z's cross run by that many px; on any other shape it does nothing. Labels stay
// off boxes, captions, earlier labels and whatever else they are told to avoid (the canvas's
// notes). A label someone dragged (`extra.labels`, an offset per edge key) sits at its automatic
// place as if nothing were in the way, plus the offset, centred; it dodges nothing, and the
// automatic labels placed after it stay off it.
//
// Trunks (`extra.bundle`, the sidecar's `routing: "bundled"`). Edges that leave one side of one
// box toward boxes facing it share one trunk: they leave from one point, step out to a run square
// to that side, run along it together, and split off to their targets one by one. The same holds
// the other way round: edges from boxes facing one side of one box merge onto one trunk and meet
// it at one point. Fan-out bundles are formed first; the edges left over may form fan-in bundles.
// An edge with a bow or waypoints never bundles; a ported end bundles only with ends ported to the
// same point. An edge bundles only when its target lies beyond its source by more than two steps
// out, through a side the two face each other across. The trunk sits in a free channel between the two, at its
// middle when it can; a member whose own runs would cut a box routes on its own instead, and so
// does the member with the nearest far end when its channel would cost the others theirs. The
// trunk takes one lane among the other runs on its line and every member moves with it, so the
// members overlap exactly: one line, not several a pixel apart.
//
// Waypoints. An entry `{ via: [[x, y], ...] }` in the sidecar's `edges` is a path someone shaped
// by dragging its segments: absolute world points the edge passes through in order. The edge
// still leaves and meets its boxes as above (sides, spread, ports, steps out), then runs from its
// step out through every waypoint to the other step, each hop straight or an L whose corner keeps
// the run it is on going when it can and stays off boxes. An unported end leaves through the side
// facing its nearest waypoint. It takes no lane and no bow. A nested edge (a member to its own
// group) ignores waypoints. After a drag, `refitEnds` moves an end whose run was dragged onto
// another side of its box to that side.
//
// Pure: no DOM, no fs. It imports text.js for the label measure; geometry.js hands it the rest.

import { textWidth } from "./text.js";

export const ORTHO_STUB = 16;
export const ORTHO_LANE = 10;
export const ORTHO_RADIUS = 8;
// Clearance kept from a box that is not an end, in px.
const CLEAR = 6;
// The share of a side that spread ends use, centred.
const SPREAD = 0.7;
const BEND_COST = 14;
const HIT_COST = 4000;
// Passing a box closer than CLEAR, without cutting it.
const NEAR_COST = 200;
// How far beside the two ends a detour may go looking for a free column (or row).
const DETOUR_REACH = 480;

const NORMAL = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };
const across = (side) => side === "top" || side === "bottom"; // the side runs along x
const cx = (b) => b[0] + b[2] / 2;
const cy = (b) => b[1] + b[3] / 2;

function contains(outer, inner) {
  return (
    inner[0] >= outer[0] &&
    inner[1] >= outer[1] &&
    inner[0] + inner[2] <= outer[0] + outer[2] &&
    inner[1] + inner[3] <= outer[1] + outer[3]
  );
}

function sidePoint(box, side, t) {
  const [x, y, w, h] = box;
  if (side === "top") return [x + w * t, y];
  if (side === "bottom") return [x + w * t, y + h];
  if (side === "left") return [x, y + h * t];
  return [x + w, y + h * t];
}

// The sides two separate boxes join through.
function chooseSides(a, b) {
  const gy = Math.max(b[1] - (a[1] + a[3]), a[1] - (b[1] + b[3]));
  const gx = Math.max(b[0] - (a[0] + a[2]), a[0] - (b[0] + b[2]));
  const dx = cx(b) - cx(a),
    dy = cy(b) - cy(a);
  let vertical;
  if (gy > 0 && gx > 0) vertical = gy * 3 >= gx;
  else if (gy > 0) vertical = true;
  else if (gx > 0) vertical = false;
  else vertical = Math.abs(dy) >= Math.abs(dx);
  if (vertical) return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
  return dx >= 0 ? ["right", "left"] : ["left", "right"];
}

// The side of `inner` nearest the border of `outer`, which holds it.
function nearestSide(inner, outer) {
  const gaps = [
    ["top", inner[1] - outer[1]],
    ["right", outer[0] + outer[2] - inner[0] - inner[2]],
    ["bottom", outer[1] + outer[3] - inner[1] - inner[3]],
    ["left", inner[0] - outer[0]],
  ];
  let best = gaps[0];
  for (const g of gaps) if (g[1] < best[1]) best = g;
  return best[0];
}

// How far a point lies out past each side of a box (negative: on the inner side of it).
function outside(box, p) {
  return {
    top: box[1] - p[1],
    right: p[0] - (box[0] + box[2]),
    bottom: p[1] - (box[1] + box[3]),
    left: box[0] - p[0],
  };
}

// The side an end leaves through toward point p: `side` while p lies out past it, else the side
// p lies furthest out past. A point inside the box leaves `side` as it is.
function facing(box, p, side) {
  const gap = outside(box, p);
  if (gap[side] > 0) return side;
  let best = side;
  for (const s of ["top", "right", "bottom", "left"])
    if (gap[s] > 0 && gap[s] > gap[best]) best = s;
  return gap[best] > 0 ? best : side;
}

// Does the axis-aligned segment cut the box grown by `pad` (negative: shrunk)?
function cuts(p, q, box, pad) {
  const x0 = box[0] - pad,
    y0 = box[1] - pad,
    x1 = box[0] + box[2] + pad,
    y1 = box[1] + box[3] + pad;
  if (x1 <= x0 || y1 <= y0) return false;
  const sx0 = Math.min(p[0], q[0]),
    sx1 = Math.max(p[0], q[0]),
    sy0 = Math.min(p[1], q[1]),
    sy1 = Math.max(p[1], q[1]);
  return sx1 > x0 && sx0 < x1 && sy1 > y0 && sy0 < y1;
}

// Drop repeated points and merge straight runs. Null when a segment doubles back on the one
// before it, which no route may do.
function simplify(points) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last[0] - p[0]) < 0.01 && Math.abs(last[1] - p[1]) < 0.01) continue;
    out.push([p[0], p[1]]);
  }
  for (let k = 1; k < out.length - 1; ) {
    const [ax, ay] = out[k - 1],
      [bx, by] = out[k],
      [qx, qy] = out[k + 1];
    const d1 = [Math.sign(bx - ax), Math.sign(by - ay)];
    const d2 = [Math.sign(qx - bx), Math.sign(qy - by)];
    if (d1[0] === d2[0] && d1[1] === d2[1]) {
      out.splice(k, 1);
      continue;
    }
    if (d1[0] === -d2[0] && d1[1] === -d2[1]) return null;
    k++;
  }
  return out;
}

// The free stretches along one axis, inside [lo, hi], between the boxes whose span on the other
// axis overlaps [olo, ohi]. Each is { at: its middle, lo, hi }.
function freeBands(boxes, axis, lo, hi, olo, ohi) {
  const spans = [];
  for (const b of boxes) {
    const o0 = axis === "y" ? b[0] : b[1];
    const o1 = o0 + (axis === "y" ? b[2] : b[3]);
    if (o1 + CLEAR < olo || o0 - CLEAR > ohi) continue;
    const s0 = (axis === "y" ? b[1] : b[0]) - CLEAR;
    const s1 = (axis === "y" ? b[1] + b[3] : b[0] + b[2]) + CLEAR;
    spans.push([s0, s1]);
  }
  spans.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const out = [];
  let at = lo;
  for (const [s0, s1] of spans) {
    if (s1 <= at) continue;
    if (s0 > at && s0 > lo) out.push([at, Math.min(s0, hi)]);
    at = Math.max(at, s1);
    if (at >= hi) break;
  }
  if (at < hi) out.push([at, hi]);
  return out
    .filter(([a, b]) => b - a >= 2)
    .map(([a, b]) => ({ at: Math.round((a + b) / 2), lo: a, hi: b }));
}

function lengthOf(points) {
  let l = 0;
  for (let k = 1; k < points.length; k++)
    l += Math.abs(points[k][0] - points[k - 1][0]) + Math.abs(points[k][1] - points[k - 1][1]);
  return l;
}

// The ids whose boxes an edge's route may cross: its two ends, and for an end routed as a module
// (`node/module`, drawn to its tile) the node around that tile. Ids hold no "/" otherwise.
function ownIds(it) {
  const out = [];
  for (const id of [it.e.from, it.e.to]) {
    out.push(id);
    if (typeof id === "string" && id.includes("/")) out.push(id.slice(0, id.indexOf("/")));
  }
  return out;
}

/**
 * Route every edge orthogonally.
 * @param {Array<{ i: number, key: string, e: object, a: number[], b: number[], fa: boolean,
 *   fb: boolean, own: object|null }>} items  each edge with its two boxes (a frame for a group
 *   end, `fa`/`fb`), and its ports
 * @param {Object<string, number[]>} nodeBoxes  every node's box: the obstacles
 * @param {Object<string, number>} bows
 * @param {(p: any) => boolean} isPort
 * @returns {Array<object>} one drawn edge per item, in item order
 */
export function routeOrthogonal(items, nodeBoxes, bows, isPort, extra = {}) {
  const obstacles = Object.entries(nodeBoxes);
  const captions = Array.isArray(extra.captions) ? extra.captions : [];
  const labelAvoid = Array.isArray(extra.labelAvoid) ? extra.labelAvoid : [];
  const labels = extra.labels && typeof extra.labels === "object" ? extra.labels : {};
  // 1. Sides.
  const ends = items.map((it) => {
    const { a, b, fa, fb, own } = it;
    const pf = isPort(own?.from) ? own.from : null;
    const pt = isPort(own?.to) ? own.to : null;
    let nest = null;
    if (a !== b && fb && contains(b, a) && !pt) nest = "to";
    else if (a !== b && fa && contains(a, b) && !pf) nest = "from";
    let sa, sb;
    if (nest === "to") {
      sa = pf?.side ?? nearestSide(a, b);
      sb = sa;
    } else if (nest === "from") {
      sb = pt?.side ?? nearestSide(b, a);
      sa = sb;
    } else {
      const [da, db] = chooseSides(a, b);
      // A shaped path: an unported end leaves through a side that faces its nearest waypoint,
      // so a run dragged over a box's top comes in from the top, not round from the side.
      const via = a === b ? null : readVia(bows[it.key]);
      sa = pf?.side ?? (via ? facing(a, via[0], da) : da);
      sb = pt?.side ?? (via ? facing(b, via[via.length - 1], db) : db);
    }
    return { ...it, pf, pt, nest, sa, sb, ta: pf ? pf.t : null, tb: pt ? pt.t : null };
  });

  // 1b. Trunks: which edges share one end and a run (see "Trunks" above).
  const bundles = extra.bundle ? findBundles(ends, bows) : [];

  // 2. Spread the unported ends along each side, ordered by the other end. A bundle's shared end
  // is one end on its side, ordered by where its members' other ends are on average.
  const sides = new Map();
  const join = (id, box, side, item, end, other) => {
    const k = `${id}\u0000${side}`;
    if (!sides.has(k)) sides.set(k, { box, side, list: [] });
    sides.get(k).list.push({ item, end, at: across(side) ? cx(other) : cy(other) });
  };
  for (const it of ends) {
    // The outer end of a nested edge is wherever the inner end projects to; it is not spread.
    const shared = it.bundle?.end;
    if (it.ta === null && it.nest !== "from" && shared !== "a")
      join(it.e.from, it.a, it.sa, it, "a", it.b);
    if (it.tb === null && it.nest !== "to" && shared !== "b")
      join(it.e.to, it.b, it.sb, it, "b", it.a);
  }
  for (const B of bundles) {
    const lead = B.members[0];
    // A shared end pinned to a port is where the port says: it is not spread.
    if ((B.end === "a" ? B.proxy.ta : B.proxy.tb) !== null) continue;
    const others = B.members.map((m) => (B.end === "a" ? m.b : m.a));
    const avg = [
      others.reduce((t, o) => t + cx(o), 0) / others.length,
      others.reduce((t, o) => t + cy(o), 0) / others.length,
      0,
      0,
    ];
    if (B.end === "a") join(lead.e.from, lead.a, lead.sa, B.proxy, "a", avg);
    else join(lead.e.to, lead.b, lead.sb, B.proxy, "b", avg);
  }
  const share = () => {
    for (const B of bundles)
      for (const m of B.members)
        if (B.end === "a") m.ta = B.proxy.ta;
        else m.tb = B.proxy.tb;
  };
  for (const { list } of sides.values()) {
    list.sort((p, q) => p.at - q.at || p.item.i - q.item.i || (p.end < q.end ? -1 : 1));
    const n = list.length;
    list.forEach((s, k) => {
      const t = n === 1 ? 0.5 : (1 - SPREAD) / 2 + (SPREAD * (k + 1)) / (n + 1);
      if (s.end === "a") s.item.ta = t;
      else s.item.tb = t;
    });
  }
  share();
  // An end alone on its side, on an edge whose other end faces it, lines up with that end when
  // the other end's point lies over this side's spread range: a lone edge is then straight.
  // A bundle's shared end never moves for one member.
  const alone = new Set();
  for (const { list } of sides.values())
    if (list.length === 1) alone.add(`${list[0].item.i}:${list[0].end}`);
  for (const it of ends) {
    if (it.nest || it.a === it.b) continue;
    const facing = NORMAL[it.sa][0] === -NORMAL[it.sb][0] && NORMAL[it.sa][1] === -NORMAL[it.sb][1];
    if (!facing) continue;
    const loneA = alone.has(`${it.i}:a`) && it.bundle?.end !== "a",
      loneB = alone.has(`${it.i}:b`) && it.bundle?.end !== "b";
    if (!loneA && !loneB) continue;
    const range = (box, side) =>
      across(side)
        ? [box[0] + box[2] * ((1 - SPREAD) / 2), box[0] + box[2] * ((1 + SPREAD) / 2)]
        : [box[1] + box[3] * ((1 - SPREAD) / 2), box[1] + box[3] * ((1 + SPREAD) / 2)];
    const coord = (box, side, t) => sidePoint(box, side, t)[across(side) ? 0 : 1];
    const tOf = (box, side, v) =>
      across(side) ? (v - box[0]) / (box[2] || 1) : (v - box[1]) / (box[3] || 1);
    const [alo, ahi] = range(it.a, it.sa);
    const [blo, bhi] = range(it.b, it.sb);
    if (loneA && loneB) {
      const lo = Math.max(alo, blo),
        hi = Math.min(ahi, bhi);
      if (lo > hi) continue;
      const mid = across(it.sa) ? (cx(it.a) + cx(it.b)) / 2 : (cy(it.a) + cy(it.b)) / 2;
      const v = Math.round(Math.min(hi, Math.max(lo, mid)));
      it.ta = tOf(it.a, it.sa, v);
      it.tb = tOf(it.b, it.sb, v);
    } else if (loneA) {
      const v = coord(it.b, it.sb, it.tb);
      if (v >= alo && v <= ahi) it.ta = tOf(it.a, it.sa, v);
    } else {
      const v = coord(it.a, it.sa, it.ta);
      if (v >= blo && v <= bhi) it.tb = tOf(it.b, it.sb, v);
    }
  }

  // A group's caption is not crossed: the ends on a top side whose step up would run through a
  // caption just above it (a member under its group's words, or a group entered from above) are
  // spread over the stretch of the side the caption leaves clear instead.
  if (captions.length)
    for (const { box, side, list } of sides.values()) {
      if (side !== "top") continue;
      const blocked = captions
        .filter(
          (r) =>
            r[1] + r[3] > box[1] - 90 &&
            r[1] < box[1] + 40 &&
            r[0] < box[0] + box[2] &&
            r[0] + r[2] > box[0],
        )
        .map((r) => [r[0] - CLEAR, r[0] + r[2] + CLEAR]);
      if (!blocked.length) continue;
      const tOf = (s) => (s.end === "a" ? s.item.ta : s.item.tb);
      const xs = list.map((s) => box[0] + box[2] * tOf(s));
      if (!xs.some((x) => blocked.some(([l, h]) => x > l && x < h))) continue;
      let best = null;
      for (const [r0, r1] of [
        [(1 - SPREAD) / 2, (1 + SPREAD) / 2],
        [0.04, 0.96],
      ]) {
        let free = [[box[0] + box[2] * r0, box[0] + box[2] * r1]];
        for (const [l, h] of blocked)
          free = free.flatMap(([a, b]) =>
            [
              [a, Math.min(b, l)],
              [Math.max(a, h), b],
            ].filter(([u, v]) => v - u > 0),
          );
        for (const f of free) if (!best || f[1] - f[0] > best[1] - best[0]) best = f;
        if (best && best[1] - best[0] >= 4 * list.length) break;
      }
      if (!best || best[1] - best[0] < 4) {
        // No stretch of the top is clear of the words: come in from the side that faces the
        // other end instead.
        for (const sd of list) {
          const other = sd.end === "a" ? sd.item.b : sd.item.a;
          const turn = cx(other) < cx(box) ? "left" : "right";
          if (sd.end === "a") [sd.item.sa, sd.item.ta] = [turn, 0.5];
          else [sd.item.sb, sd.item.tb] = [turn, 0.5];
        }
        continue;
      }
      const n = list.length;
      list.forEach((s, k) => {
        const x = best[0] + ((best[1] - best[0]) * (k + 1)) / (n + 1);
        const t = (x - box[0]) / (box[2] || 1);
        if (s.end === "a") s.item.ta = t;
        else s.item.tb = t;
      });
    }

  share();

  // 3. Route: a bundle member along its trunk, else through its waypoints when it has them,
  // else the cheapest clean way.
  const trunked = new Map();
  for (const B of bundles)
    for (const [it, r] of trunkRoutes(B, obstacles, captions)) trunked.set(it, r);
  const routes = ends.map((it) => {
    const t = trunked.get(it);
    if (t) return t;
    const via = it.nest || it.a === it.b ? null : readVia(bows[it.key]);
    return via ? viaRoute(it, via, obstacles, captions) : route(it, obstacles, captions);
  });

  // 4. Lanes: inner runs of different edges that lie on one line are moved a lane apart. A run
  // going along +axis with its legs going the same way: the one whose legs sit further along goes
  // nearer the start of the channel, so neither crosses the other's legs.
  const boxList = obstacles.map(([, bx]) => bx);
  const lines = new Map();
  const addSeg = (seg, axis) => {
    const id = `${axis}:${seg.at}`;
    if (!lines.has(id)) lines.set(id, { axis, at: seg.at, list: [] });
    lines.get(id).list.push(seg);
  };
  // A bundle's trunk is one run on its line, spanning every member's piece of it; whatever lane
  // it gets, each member's piece moves by it.
  const trunks = new Map();
  for (const r of routes) {
    r.shift = new Map();
    if (r.trunk === undefined) continue;
    let T = trunks.get(r.bundle);
    if (!T) {
      T = { r: { shift: new Map(), it: r.it }, members: [], lo: Infinity, hi: -Infinity, len: -1 };
      trunks.set(r.bundle, T);
    }
    T.members.push(r);
    if (r.trunk === null) continue;
    const pts = r.points,
      k = r.trunk;
    const p = pts[k],
      q = pts[k + 1];
    const axis = Math.abs(p[1] - q[1]) < 0.01 ? "y" : "x";
    const [u, v] = axis === "y" ? [0, 1] : [1, 0];
    T.axis = axis;
    T.u = u;
    T.at = Math.round(p[v]);
    T.lo = Math.min(T.lo, p[u], q[u]);
    T.hi = Math.max(T.hi, p[u], q[u]);
    if (Math.abs(q[u] - p[u]) > T.len) {
      const h = Math.sign(q[u] - p[u]) || 1;
      const w = Math.sign(pts[k + 2][v] - q[v]) || Math.sign(p[v] - pts[k - 1][v]) || 1;
      T.key = [-h * w * p[u], -h * w * q[u]];
      T.len = Math.abs(q[u] - p[u]);
    }
  }
  for (const T of trunks.values())
    if (T.key)
      addSeg({ r: T.r, k: "trunk", at: T.at, u: T.u, lo: T.lo, hi: T.hi, key: T.key }, T.axis);
  for (const r of routes) {
    // A shaped path is where someone put it: it takes no lane. A trunk's lane is its bundle's.
    if (r.via || r.trunk !== undefined) continue;
    const pts = r.points;
    for (let k = 1; k < pts.length - 2; k++) {
      const p = pts[k],
        q = pts[k + 1];
      const axis = Math.abs(p[1] - q[1]) < 0.01 ? "y" : "x";
      const [u, v] = axis === "y" ? [0, 1] : [1, 0];
      const at = Math.round(p[v]);
      const h = Math.sign(q[u] - p[u]) || 1;
      const w = Math.sign(pts[k + 2][v] - q[v]) || Math.sign(p[v] - pts[k - 1][v]) || 1;
      const seg = { r, k, at, u, lo: Math.min(p[u], q[u]), hi: Math.max(p[u], q[u]) };
      seg.key = [-h * w * p[u], -h * w * q[u]];
      addSeg(seg, axis);
    }
  }
  for (const { axis, at, list } of lines.values()) {
    const shared = list.some((a, x) =>
      list.some((b, y) => y > x && a.r !== b.r && a.lo < b.hi - 1 && b.lo < a.hi - 1),
    );
    if (!shared) continue;
    const n = list.length;
    const lo = Math.min(...list.map((g) => g.lo)),
      hi = Math.max(...list.map((g) => g.hi));
    const band = freeBands(boxList, axis, at - 120, at + 120, lo, hi).find(
      (b) => b.lo <= at && at <= b.hi,
    );
    // Off every free band (a route that had to cut a box anyway): the lanes stay tight.
    const half = band ? Math.min(at - band.lo, band.hi - at) - 2 : n;
    const step = Math.max(2, Math.min(ORTHO_LANE, (2 * half) / (n - 1)));
    list.sort((p, q) => p.key[0] - q.key[0] || p.key[1] - q.key[1] || p.r.it.i - q.r.it.i);
    list.forEach((g, k) => {
      g.r.shift.set(g.k, Math.round((k - (n - 1) / 2) * step * 10) / 10);
    });
  }
  for (const T of trunks.values()) {
    const d = T.r.shift.get("trunk");
    if (d) for (const r of T.members) if (r.trunk !== null) r.shift.set(r.trunk, d);
  }

  // 5. Points, bows, labels.
  const taken = [];
  return routes.map((r) => {
    const { it } = r;
    const bow = r.via ? 0 : Number(bows[it.key]) || 0;
    let points = r.points.map((p) => [p[0], p[1]]);
    for (const [k, d] of r.shift) {
      const v = Math.abs(points[k][1] - points[k + 1][1]) < 0.01 ? 1 : 0;
      points[k][v] += d;
      points[k + 1][v] += d;
    }
    const lane = r.run ? (r.shift.get(1) ?? 0) : 0;
    let run = null;
    if (r.run) {
      const base = r.run.at + lane;
      run = { axis: r.run.axis, base };
      if (bow) points = r.run.make(base + bow);
    }
    const text = String(it.e.label || "");
    const offset = text ? labelOffset(labels, it.key) : null;
    let place;
    // Where the label would sit with nothing in the way, as its centre: what an offset is from.
    const free = text ? labelOn(points, text, []) : null;
    const base = free ? labelCentre(free.at, free.anchor, text) : null;
    if (offset && free && base) {
      const at = [base[0] + offset[0], base[1] + offset[1]];
      const w = textWidth(text, LABEL_FONT);
      place = { mid: free.mid, at, anchor: "middle" };
      taken.push([at[0] - w / 2, at[1] - 10, w, 12]);
    } else {
      place = labelOn(points, text, [...boxList, ...captions, ...labelAvoid, ...taken]);
      if (place.box) taken.push(place.box);
    }
    const drawn = {
      i: it.i,
      key: it.key,
      points,
      ortho: true,
      bow,
      lane,
      run,
      mid: place.mid,
      labelAt: place.at,
      labelAnchor: place.anchor,
    };
    if (base) drawn.labelBase = base;
    // Only a shaped path says so, so every other drawn edge is what it always was.
    if (r.via) drawn.via = r.via;
    // A nested edge runs straight out to its group's border: there is nothing to shape.
    if (it.nest) drawn.fixed = true;
    return drawn;
  });
}

// The bundles among the routed ends: fan-outs (one source box and side, `end: "a"`) first, then
// fan-ins (one target box and side, `end: "b"`) among the edges left over. An edge may join
// through any side of its box that faces the other box across a channel (a gap of more than two
// steps out); of those, it takes the side most of its siblings share, so a fan-out whose targets
// lie up, level and down still leaves through one side. A ported end keeps its side, and shares
// its point only with ends ported to the same place (a wire drawn from a port dot pins its end at
// the dot, so siblings drawn from one dot bundle); a ported far end must face the shared side.
// Each member gets `bundle` (and its sides set); each bundle a `proxy` that stands for its shared
// end while the unported ends are spread.
function findBundles(ends, bows) {
  const MIN = 2 * ORTHO_STUB + 4;
  // The sides an edge may leave its source through: they face the target across a channel, and
  // agree with the ports it has.
  const sidesOf = (it) => {
    const { a, b, pf, pt } = it;
    const out = [];
    if (b[0] - (a[0] + a[2]) > MIN) out.push("right");
    if (a[0] - (b[0] + b[2]) > MIN) out.push("left");
    if (b[1] - (a[1] + a[3]) > MIN) out.push("bottom");
    if (a[1] - (b[1] + b[3]) > MIN) out.push("top");
    return out.filter((sd) => (!pf || pf.side === sd) && (!pt || pt.side === OPPOSITE[sd]));
  };
  const options = new Map();
  for (const it of ends) {
    if (it.nest || it.a === it.b) continue;
    if (bows && Object.hasOwn(bows, it.key) && bows[it.key]) continue;
    const sides = sidesOf(it);
    if (sides.length) options.set(it, sides);
  }
  const out = [];
  const gather = (end) => {
    const byBox = new Map();
    for (const it of options.keys()) {
      if (it.bundle) continue;
      const id = end === "a" ? it.e.from : it.e.to;
      if (!byBox.has(id)) byBox.set(id, []);
      byBox.get(id).push(it);
    }
    for (const list of byBox.values()) {
      if (list.length < 2) continue;
      const count = new Map();
      for (const it of list)
        for (const sd of options.get(it)) count.set(sd, (count.get(sd) ?? 0) + 1);
      const groups = new Map();
      for (const it of list) {
        let best = null;
        for (const sd of options.get(it)) {
          const c = count.get(sd);
          const b = best === null ? -1 : count.get(best);
          if (c > b || (c === b && sd === it.sa)) best = sd;
        }
        if (count.get(best) < 2) continue;
        // Ends pinned to a port share a point only with ends pinned to the same one.
        const port = end === "a" ? it.pf : it.pt;
        const k = port ? `${best}@${port.t}` : best;
        if (!groups.has(k)) groups.set(k, { side: best, port, members: [] });
        groups.get(k).members.push(it);
      }
      for (const { side, port, members } of groups.values()) {
        if (members.length < 2) continue;
        const proxy = {
          i: members[0].i,
          ta: end === "a" && port ? port.t : null,
          tb: end === "b" && port ? port.t : null,
        };
        const B = { end, members, proxy };
        for (const m of members) {
          m.bundle = B;
          m.sa = side;
          m.sb = OPPOSITE[side];
        }
        out.push(B);
      }
    }
  };
  gather("a");
  gather("b");
  return out;
}

// One bundle's members along a shared trunk, as [item, route] pairs. A member whose runs would
// cut a box is left out and routes on its own; so does a bundle left with one member. A route
// carries `bundle` and `trunk`: the index of its run along the trunk, or null when it has none
// (a member level with the shared end is one straight run).
//
// The trunk's channel is set by every member: the nearest far end bounds it. So one member whose
// box sits much nearer than the others' (a new edge to a box just below the source) can squeeze
// the trunk to where the other members' runs cut a box, or leave it no free band at all. When the
// whole bundle does not route, the member with the nearest far end is left out and the rest try
// again, so adding an edge never takes a working bundle apart: the larger trunk wins, and of two
// as large, the one that routes every member it was given.
function trunkRoutes(B, obstacles, captions) {
  const u = across(B.members[0].sa) ? 1 : 0;
  const n = NORMAL[B.members[0].sa][u];
  const far = (it) => n * sidePoint(it.b, it.sb, it.tb ?? 0.5)[u];
  let members = B.members;
  let best = [];
  while (members.length >= 2) {
    const out = trunkOf(B, members, obstacles, captions);
    if (out.length === members.length && out.length >= best.length) return out;
    if (out.length > best.length) best = out;
    const nearest = members.reduce((p, q) => (far(q) < far(p) ? q : p));
    members = members.filter((m) => m !== nearest);
  }
  return best;
}

function trunkOf(B, members, obstacles, captions) {
  const side = members[0].sa;
  const u = across(side) ? 1 : 0; // the axis a step out runs along; the trunk is square to it
  const v = 1 - u;
  const n = NORMAL[side][u];
  const ends = members.map((it) => ({
    it,
    P: sidePoint(it.a, it.sa, it.ta ?? 0.5),
    Q: sidePoint(it.b, it.sb, it.tb ?? 0.5),
  }));
  // The channel the trunk may sit in, along u: past every source's step out, short of every
  // target's step in.
  const s0 = Math.max(...ends.map((x) => n * x.P[u])) + ORTHO_STUB;
  const s1 = Math.min(...ends.map((x) => n * x.Q[u])) - ORTHO_STUB;
  if (s1 <= s0) return [];
  const lo = Math.min(n * s0, n * s1),
    hi = Math.max(n * s0, n * s1);
  const olo = Math.min(...ends.flatMap((x) => [x.P[v], x.Q[v]]));
  const ohi = Math.max(...ends.flatMap((x) => [x.P[v], x.Q[v]]));
  const boxes = [...obstacles.map(([, bx]) => bx), ...captions];
  const bands = freeBands(boxes, u === 0 ? "x" : "y", lo, hi, olo, ohi);
  if (!bands.length) return [];
  const mid = (lo + hi) / 2;
  const holds = (b) => b.lo <= mid && mid <= b.hi;
  const band =
    bands.find(holds) ??
    bands.reduce((p, q) => (Math.abs(q.at - mid) < Math.abs(p.at - mid) ? q : p));
  const m = holds(band) ? Math.round(mid) : band.at;
  const at = (a, b) => (u === 0 ? [a, b] : [b, a]);
  const out = [];
  for (const { it, P, Q } of ends) {
    const path = simplify([P, at(m, P[v]), at(m, Q[v]), Q]);
    if (!path) continue;
    const own = ownIds(it);
    const blockers = [
      ...obstacles.filter(([id]) => !own.includes(id)).map(([, bx]) => bx),
      ...captions,
    ];
    const mine = [it.fa ? null : it.a, it.fb ? null : it.b].filter(Boolean);
    let clean = true;
    for (let k = 1; k < path.length && clean; k++)
      for (const box of blockers) if (cuts(path[k - 1], path[k], box, 0)) clean = false;
    for (let k = 1; k < path.length && clean; k++)
      for (const box of mine) if (cuts(path[k - 1], path[k], box, -1)) clean = false;
    if (!clean) continue;
    let trunk = null;
    for (let k = 1; k < path.length - 2; k++)
      if (Math.abs(path[k][u] - m) < 0.01 && Math.abs(path[k + 1][u] - m) < 0.01) trunk = k;
    out.push([it, { it, points: path, run: null, bundle: B, trunk }]);
  }
  return out.length >= 2 ? out : [];
}

/** The most waypoints one edge keeps. */
export const VIA_MAX = 32;
const VIA_LIMIT = 1e6;

/**
 * The waypoints a sidecar `edges` entry names, or null when it names none: `{ via: [[x, y], ...] }`
 * with finite coordinates, at most VIA_MAX of them, each rounded to a whole px. A number (a bow)
 * or anything malformed is null.
 */
export function readVia(v) {
  if (!v || typeof v !== "object" || Array.isArray(v) || !Array.isArray(v.via)) return null;
  const out = [];
  for (const p of v.via.slice(0, VIA_MAX)) {
    if (!Array.isArray(p) || p.length < 2) return null;
    const [x, y] = p;
    if (typeof x !== "number" || typeof y !== "number") return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (Math.abs(x) > VIA_LIMIT || Math.abs(y) > VIA_LIMIT) return null;
    out.push([Math.round(x), Math.round(y)]);
  }
  return out.length ? out : null;
}

// Drop repeated points, merge straight runs and fold away a run that doubles straight back on
// the one before it. Unlike `simplify`, it never refuses: a waypoint someone placed is followed
// even where it turns the path back on itself.
function tidy(points) {
  let out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last[0] - p[0]) < 0.01 && Math.abs(last[1] - p[1]) < 0.01) continue;
    out.push([p[0], p[1]]);
  }
  for (let changed = true; changed; ) {
    changed = false;
    for (let k = 1; k < out.length - 1; k++) {
      const [ax, ay] = out[k - 1],
        [bx, by] = out[k],
        [qx, qy] = out[k + 1];
      const d1 = [Math.sign(bx - ax), Math.sign(by - ay)];
      const d2 = [Math.sign(qx - bx), Math.sign(qy - by)];
      const same = d1[0] === d2[0] && d1[1] === d2[1];
      const back = d1[0] === -d2[0] && d1[1] === -d2[1];
      if (same || back) {
        out.splice(k, 1);
        changed = true;
        break;
      }
    }
    // Removing a fold can leave two equal points side by side.
    out = out.filter(
      (p, k) =>
        k === 0 || Math.abs(p[0] - out[k - 1][0]) > 0.01 || Math.abs(p[1] - out[k - 1][1]) > 0.01,
    );
  }
  return out;
}

// One edge through its waypoints: out of its box as `route` would leave it, through every
// waypoint in order, into the other box square to its side.
function viaRoute(it, via, obstacles, captions) {
  const { a, b, sa, sb, ta, tb } = it;
  const P = sidePoint(a, sa, ta ?? 0.5);
  const Q = sidePoint(b, sb, tb ?? 0.5);
  const nA = NORMAL[sa],
    nB = NORMAL[sb];
  const S = [P[0] + nA[0] * ORTHO_STUB, P[1] + nA[1] * ORTHO_STUB];
  const T = [Q[0] + nB[0] * ORTHO_STUB, Q[1] + nB[1] * ORTHO_STUB];
  const own = ownIds(it);
  const blockers = [
    ...obstacles.filter(([id]) => !own.includes(id)).map(([, bx]) => bx),
    ...captions,
  ];
  const mine = [it.fa ? null : a, it.fb ? null : b].filter(Boolean);

  // Waypoints are whole px and the ends are not: a waypoint within a px of the point before it
  // (or after it, at the far end) on one axis is lined up with it, so no hairline jog is drawn.
  const L = [S, ...via.map((p) => [p[0], p[1]]), T];
  for (let j = 1; j < L.length - 1; j++)
    for (const ax of [0, 1]) if (Math.abs(L[j][ax] - L[j - 1][ax]) < 1) L[j][ax] = L[j - 1][ax];
  for (let j = L.length - 2; j > 0; j--)
    for (const ax of [0, 1]) if (Math.abs(L[j][ax] - L[j + 1][ax]) < 1) L[j][ax] = L[j + 1][ax];

  const dirOf = (p, q) => [Math.sign(q[0] - p[0]), Math.sign(q[1] - p[1])];
  const hitsOf = (p, q) => {
    let n = 0;
    for (const box of blockers) if (cuts(p, q, box, 0)) n++;
    for (const box of mine) if (cuts(p, q, box, -1)) n++;
    return n;
  };
  // What a leg costs against the run before it: a turn is a bend, a turn straight back is worse.
  const turn = (d, prev) => {
    if (!prev || (!prev[0] && !prev[1])) return 0;
    if (d[0] === prev[0] && d[1] === prev[1]) return 0;
    if (d[0] === -prev[0] && d[1] === -prev[1]) return 1000;
    return BEND_COST;
  };
  const pts = [P, S];
  let dir = [nA[0], nA[1]];
  const into = [-nB[0], -nB[1]];
  for (let j = 1; j < L.length; j++) {
    const A = pts[pts.length - 1],
      B = L[j];
    if (Math.abs(A[0] - B[0]) < 0.01 || Math.abs(A[1] - B[1]) < 0.01) {
      const d = dirOf(A, B);
      pts.push(B);
      if (d[0] || d[1]) dir = d;
      continue;
    }
    const last = j === L.length - 1;
    let best = null;
    // Along x first, then along y first: the one that keeps the run going is tried first.
    const corners = [
      [B[0], A[1]],
      [A[0], B[1]],
    ];
    if (dir[0] === 0) corners.reverse();
    for (const c of corners) {
      const d1 = dirOf(A, c),
        d2 = dirOf(c, B);
      let cost = HIT_COST * (hitsOf(A, c) + hitsOf(c, B)) + turn(d1, dir) + turn(d2, d1);
      if (last) cost += turn(into, d2);
      else {
        // Look one hop on: a run that would have to fold straight back costs now.
        const C = L[j + 1];
        if (Math.abs(B[0] - C[0]) < 0.01 || Math.abs(B[1] - C[1]) < 0.01)
          cost += turn(dirOf(B, C), d2);
      }
      if (!best || cost < best.cost) best = { cost, c, d2 };
    }
    pts.push(best.c, B);
    dir = best.d2;
  }
  pts.push(Q);
  const points = tidy(pts);
  return { it, points: points.length >= 2 ? points : [P, Q], run: null, via };
}

/**
 * Drag one run of an orthogonal edge (`points`, as `edgeGeometry` drew it) square to itself, so
 * it lies through (x, y). The runs on either side stretch to meet it. A run that starts or ends
 * at the edge's box cannot leave the box, so it keeps a short step out of it and jogs: a straight
 * edge dragged by its middle becomes a U. Returns the new points.
 */
export function moveSegment(points, k, x, y) {
  const n = points.length;
  if (!Array.isArray(points) || k < 0 || k >= n - 1) return points;
  const p = points[k],
    q = points[k + 1];
  const v = Math.abs(p[1] - q[1]) < 0.5 ? 1 : 0; // the coordinate the drag changes
  const at = Math.round(v === 1 ? y : x);
  const len = Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]);
  if (len < 0.5) return points;
  const dir = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
  const stub = Math.min(ORTHO_STUB, len / 3);
  const set = (pt) => {
    const out = [pt[0], pt[1]];
    out[v] = at;
    return out;
  };
  const copy = points.map((c) => [c[0], c[1]]);
  let head, tail;
  if (k === 0) {
    const s = [p[0] + dir[0] * stub, p[1] + dir[1] * stub];
    head = [copy[0], s, set(s)];
  } else head = [...copy.slice(0, k), set(p)];
  if (k + 1 === n - 1) {
    const t = [q[0] - dir[0] * stub, q[1] - dir[1] * stub];
    tail = [set(t), t, copy[n - 1]];
  } else tail = [set(q), ...copy.slice(k + 2)];
  return tidy([...head, ...tail]);
}

const isSide = (p) =>
  p != null && typeof p === "object" && Object.hasOwn(NORMAL, p.side) && Number.isFinite(p.t);

// How close to a corner, in px, a re-pinned end may sit: the corner's own rounding.
const PORT_INSET = ORTHO_RADIUS;

// The end of `points` at `box` (the last point), fitted after a drag. Null while the last run
// still comes in from outside the side it ends on. Otherwise the run before it has been dragged
// onto or past the box: when that run crosses one of the box's two other sides, the path is cut
// where it enters, and the end moves to that side at the run's coordinate; when it has gone past
// the far side, a ported end moves to the far side at the t it had.
function fitEnd(points, box, port) {
  const n = points.length;
  if (!box || n < 3) return null;
  const [Q, R, F] = [points[n - 1], points[n - 2], points[n - 3]];
  const gaps = outside(box, Q);
  const side = isSide(port)
    ? port.side
    : Object.keys(gaps).reduce((s, k) => (Math.abs(gaps[k]) < Math.abs(gaps[s]) ? k : s));
  const v = across(side) ? 1 : 0; // the axis the last run (and the side's normal) runs along
  const u = 1 - v;
  const sideAt = (s) =>
    s === "top"
      ? box[1]
      : s === "bottom"
        ? box[1] + box[3]
        : s === "left"
          ? box[0]
          : box[0] + box[2];
  if ((R[v] - sideAt(side)) * NORMAL[side][v] > 0.5) return null;
  // The run before the last runs along u, at coordinate c on v.
  if (Math.abs(F[v] - R[v]) > 0.5) return null;
  const c = R[v];
  const lo = box[v],
    len = box[v + 2];
  if (c > lo && c < lo + len) {
    let best = null;
    for (const s of PORT_SIDE_PAIRS[u]) {
      const at = sideAt(s),
        nu = NORMAL[s][u];
      if ((F[u] - at) * nu <= 0 || (R[u] - at) * nu > 0) continue;
      const d = Math.abs(F[u] - at);
      if (!best || d < best.d) best = { s, at, d };
    }
    if (!best) return null;
    const m = Math.min(PORT_INSET, len / 2);
    const t =
      Math.round(((Math.min(lo + len - m, Math.max(lo + m, c)) - lo) / (len || 1)) * 1000) / 1000;
    const P = [0, 0];
    P[v] = lo + len * t;
    P[u] = best.at;
    return {
      points: [...points.slice(0, n - 2).map((p) => [p[0], p[1]]), P],
      port: { side: best.s, t },
    };
  }
  const far = OPPOSITE[side];
  if (!isSide(port) || (c - sideAt(far)) * NORMAL[far][v] <= 0) return null;
  const P = [0, 0];
  P[v] = sideAt(far);
  P[u] = Q[u];
  return {
    points: [...points.slice(0, n - 1).map((p) => [p[0], p[1]]), P],
    port: { side: far, t: port.t },
  };
}
const PORT_SIDE_PAIRS = [
  ["left", "right"],
  ["top", "bottom"],
];
const OPPOSITE = { top: "bottom", bottom: "top", left: "right", right: "left" };

/**
 * Fit a shaped path's two ends back onto their boxes after one of its runs was dragged
 * (`points`, from `moveSegment`). A run dragged so far that it no longer meets the side its end
 * is on, but crosses another side of that box, now ends there: the path is cut where it enters
 * the box, and a ported end is re-pinned to that side at the run's coordinate (clamped clear of
 * the corners, rounded to 3 places). A ported end whose run went past the far side moves to the
 * far side. An end whose run still meets its side is left alone. `a` and `b` are the two boxes,
 * `ports` the edge's ports as they stand. Returns the points, and `from` / `to` for each ported
 * end that moved.
 */
export function refitEnds(points, a, b, ports = {}) {
  /** @type {{ points: number[][], from?: { side: string, t: number }, to?: { side: string, t: number } }} */
  const res = { points };
  const to = fitEnd(points, b, ports?.to);
  if (to) {
    res.points = to.points;
    if (isSide(ports?.to)) res.to = to.port;
  }
  const from = fitEnd([...res.points].reverse(), a, ports?.from);
  if (from) {
    res.points = from.points.reverse();
    if (isSide(ports?.from)) res.from = from.port;
  }
  return res;
}

/** The waypoints that hold a drawn path in its shape: its corners, whole px. */
export function viaOf(points) {
  return points.slice(1, -1).map((p) => [Math.round(p[0]), Math.round(p[1])]);
}

/** The waypoints without the one nearest (x, y). */
export function dropWaypoint(via, x, y) {
  if (!Array.isArray(via) || !via.length) return [];
  let best = 0;
  via.forEach((p, k) => {
    if (Math.hypot(p[0] - x, p[1] - y) < Math.hypot(via[best][0] - x, via[best][1] - y)) best = k;
  });
  return via.filter((_, k) => k !== best);
}

// Waypoints are absolute points, and an expanded node's box is bigger than its collapsed one, so
// one set of waypoints cannot fit both. A sidecar `edges` entry keeps one set per expand state of
// the edge's two ends: `via` while neither end node is expanded (what the server, the thumbnails
// and an export draw), and `viaExpanded[state]` otherwise, where `state` names the expanded end
// nodes, sorted and comma-joined (a module end `node/module` counts as its node). A state with no
// entry is the automatic path. A bow (a number) is measured from the edge itself, so it is one.

/** A sidecar `viaExpanded` key: one or two node ids, sorted, comma-joined. */
export const EXPAND_STATE_RE = /^[a-z][a-z0-9-]*(,[a-z][a-z0-9-]*)?$/;

/**
 * The expand state of the edge `key` (`from>to`, `from>to#n`): its end nodes that are in `open`
 * (the nodes drawn expanded), sorted and comma-joined; "" when neither is.
 * @param {string} key
 * @param {Iterable<string>} open
 */
export function expandState(key, open) {
  const set = open instanceof Set ? open : new Set(open);
  const pair = String(key).replace(/#\d+$/, "").split(">");
  const ids = [...new Set(pair.map((end) => end.split("/")[0]))].filter((id) => set.has(id));
  return ids.sort().join(",");
}

/**
 * The path one stored entry draws in expand state `state`: a bow as it is; the waypoints of the
 * state's slot (`via` for "", `viaExpanded[state]` otherwise) as `{ via }`; else null.
 */
export function pathFor(entry, state) {
  if (typeof entry === "number") return entry;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const slot = state ? entry.viaExpanded?.[state] : entry.via;
  const via = readVia({ via: slot });
  return via ? { via } : null;
}

/**
 * Every stored entry as `pathFor` draws it with the nodes in `open` expanded. Copies.
 * @param {Object<string, any>} bows  a sidecar `edges` map
 * @param {Iterable<string>} [open]  the node ids drawn expanded
 */
export function pathsFor(bows, open = []) {
  const set = open instanceof Set ? open : new Set(open);
  const out = {};
  for (const [key, entry] of Object.entries(bows || {})) {
    const path = pathFor(entry, expandState(key, set));
    if (path !== null) out[key] = path;
  }
  return out;
}

/**
 * A stored entry with the waypoints of expand state `state` set to `via` (or cleared, for null or
 * none), the other states' kept. A bow is replaced. Null when nothing is left.
 */
export function withPath(entry, state, via) {
  const out = {};
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    if (Array.isArray(entry.via) && entry.via.length) out.via = entry.via;
    if (entry.viaExpanded && typeof entry.viaExpanded === "object")
      out.viaExpanded = { ...entry.viaExpanded };
  }
  const pts = Array.isArray(via) && via.length ? via : null;
  if (!state) {
    if (pts) out.via = pts;
    else delete out.via;
  } else {
    out.viaExpanded = { ...(out.viaExpanded || {}) };
    if (pts) out.viaExpanded[state] = pts;
    else delete out.viaExpanded[state];
  }
  if (out.viaExpanded && !Object.keys(out.viaExpanded).length) delete out.viaExpanded;
  return out.via || out.viaExpanded ? out : null;
}

// One edge: its end points, its steps out, and the cheapest clean way between them.
function route(it, obstacles, captions = []) {
  const { a, b, sa, sb, ta, tb, nest } = it;
  const P = sidePoint(a, sa, ta ?? 0.5);
  let Q = sidePoint(b, sb, tb ?? 0.5);
  if (nest) {
    // Straight out of the inner box to the border of the frame that holds it.
    if (nest === "to") {
      const [x, y, w, h] = b;
      Q = across(sa) ? [P[0], sa === "top" ? y : y + h] : [sa === "left" ? x : x + w, P[1]];
      return { it, points: [P, Q], run: null };
    }
    const [x, y, w, h] = a;
    const start = across(sb) ? [Q[0], sb === "top" ? y : y + h] : [sb === "left" ? x : x + w, Q[1]];
    return { it, points: [start, Q], run: null };
  }
  const nA = NORMAL[sa],
    nB = NORMAL[sb];
  // Facing ends closer than two steps meet halfway.
  let stub = ORTHO_STUB;
  if (nA[0] === -nB[0] && nA[1] === -nB[1]) {
    const d = (Q[0] - P[0]) * nA[0] + (Q[1] - P[1]) * nA[1];
    if (d > 0 && d < 2 * ORTHO_STUB) stub = d / 2;
  }
  const S = [P[0] + nA[0] * stub, P[1] + nA[1] * stub];
  const T = [Q[0] + nB[0] * stub, Q[1] + nB[1] * stub];
  const own = ownIds(it);
  const others = obstacles.filter(([id]) => !own.includes(id)).map(([, bx]) => bx);
  const mine = [it.fa ? null : a, it.fb ? null : b].filter(Boolean);
  // Captions are in the way like boxes, never ends.
  const blockers = [...others, ...captions];

  const score = (pts) => {
    const path = simplify([P, ...pts, Q]);
    if (!path) return null;
    let hits = 0,
      near = 0;
    for (let k = 1; k < path.length; k++) {
      for (const box of blockers)
        if (cuts(path[k - 1], path[k], box, 0)) hits++;
        else if (cuts(path[k - 1], path[k], box, CLEAR)) near++;
      for (const box of mine) if (cuts(path[k - 1], path[k], box, -1)) hits++;
    }
    const cost =
      lengthOf(path) + BEND_COST * (path.length - 2) + HIT_COST * hits + NEAR_COST * near;
    return { path, cost, hits: hits + near };
  };

  let best = null;
  const offer = (pts, run = null, bias = 0) => {
    const s = score(pts);
    if (!s) return;
    const cost = s.cost + bias;
    if (!best || cost < best.cost - 1e-9) best = { ...s, cost, run };
  };

  const xlo = Math.min(S[0], T[0]),
    xhi = Math.max(S[0], T[0]);
  const ylo = Math.min(S[1], T[1]),
    yhi = Math.max(S[1], T[1]);
  const all = [...blockers, ...mine];
  const reach = 160;

  // Straight, when the two steps line up, and an L, when the two sides are square to each other.
  if (Math.abs(S[0] - T[0]) < 0.01 || Math.abs(S[1] - T[1]) < 0.01) offer([S, T]);
  if (nA[0] * nB[0] + nA[1] * nB[1] === 0) {
    offer([S, [T[0], S[1]], T]);
    offer([S, [S[0], T[1]], T]);
  }
  // Z through a horizontal channel (a run along x at y = m) and through a vertical one.
  const zv = (m) => [S, [S[0], m], [T[0], m], T];
  const zh = (m) => [S, [m, S[1]], [m, T[1]], T];
  const mids = { y: (S[1] + T[1]) / 2, x: (S[0] + T[0]) / 2 };
  for (const band of freeBands(all, "y", ylo - reach, yhi + reach, xlo, xhi))
    offer(zv(band.at), { axis: "y", ...band, make: zv }, Math.abs(band.at - mids.y) * 0.02);
  for (const band of freeBands(all, "x", xlo - reach, xhi + reach, ylo, yhi))
    offer(zh(band.at), { axis: "x", ...band, make: zh }, Math.abs(band.at - mids.x) * 0.02);

  // Every short way cuts a box: detour, with two cross runs and a jog between them.
  if (!best || best.hits) {
    const far = DETOUR_REACH;
    const ys = freeBands(all, "y", ylo - reach, yhi + reach, xlo - far, xhi + far);
    const xs = freeBands(all, "x", xlo - reach, xhi + reach, ylo - far, yhi + far);
    for (const m1 of ys)
      for (const m2 of ys)
        for (const c of freeBands(
          all,
          "x",
          xlo - far,
          xhi + far,
          Math.min(m1.at, m2.at),
          Math.max(m1.at, m2.at),
        ))
          offer([S, [S[0], m1.at], [c.at, m1.at], [c.at, m2.at], [T[0], m2.at], T]);
    for (const m1 of xs)
      for (const m2 of xs)
        for (const c of freeBands(
          all,
          "y",
          ylo - far,
          yhi + far,
          Math.min(m1.at, m2.at),
          Math.max(m1.at, m2.at),
        ))
          offer([S, [m1.at, S[1]], [m1.at, c.at], [m2.at, c.at], [m2.at, T[1]], T]);
  }
  if (!best) return { it, points: [P, Q], run: null };
  // Only a Z whose two legs both survive is a run a lane or a bow can move.
  const run =
    best.run && best.path.length === 4
      ? {
          axis: best.run.axis,
          at: best.run.at,
          lo: best.run.lo,
          hi: best.run.hi,
          s: S,
          t: T,
          make: (m) => simplify([P, ...best.run.make(m), Q]) ?? best.path,
        }
      : null;
  return { it, points: best.path, run };
}

/** The font size an edge label is drawn at (render.js `.e`, the canvas's `.edge-label`). */
export const LABEL_FONT = 12;

/** The most a dragged label may sit from its automatic place, on either axis. */
export const LABEL_OFFSET_MAX = 2000;

/**
 * The offset an edge's label was dragged by, from a map keyed by edge key: two finite numbers,
 * rounded and clamped to LABEL_OFFSET_MAX, or null for none (a zero offset is none).
 */
export function labelOffset(labels, key) {
  if (!labels || typeof labels !== "object" || !Object.hasOwn(labels, key)) return null;
  const v = labels[key];
  if (!Array.isArray(v) || v.length !== 2) return null;
  const c = (n) =>
    Math.round(Math.max(-LABEL_OFFSET_MAX, Math.min(LABEL_OFFSET_MAX, Number(n)))) || 0;
  if (!Number.isFinite(v[0]) || !Number.isFinite(v[1])) return null;
  const o = [c(v[0]), c(v[1])];
  return o[0] || o[1] ? o : null;
}

/** A label's baseline point as if it were centred (`text-anchor: middle`) where it is drawn. */
export function labelCentre(at, anchor, text) {
  const w = textWidth(text, LABEL_FONT);
  const dx = anchor === "start" ? w / 2 : anchor === "end" ? -w / 2 : 0;
  return [at[0] + dx, at[1]];
}

// A label sits on a run, centred: above a horizontal one, beside a vertical one. The longest run
// it fits on clear of every box (and of the labels placed before it) wins; failing that, the
// longest run. `box` is the rectangle the words cover.
function labelOn(points, text, clear) {
  const w = text ? textWidth(text, LABEL_FONT) : 0;
  const runs = [];
  for (let j = 1; j < points.length; j++) {
    const [x1, y1] = points[j - 1],
      [x2, y2] = points[j];
    runs.push({ j, len: Math.abs(x2 - x1) + Math.abs(y2 - y1), x1, y1, x2, y2 });
  }
  // A horizontal run that only just holds the words ranks below a vertical run of any length.
  const rank = (r) => (Math.abs(r.y2 - r.y1) < 0.5 && r.len < w + 40 ? r.len * 0.25 : r.len);
  runs.sort((p, q) => rank(q) - rank(p) || p.j - q.j);
  const spots = (r) => {
    const mid = [(r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2];
    if (Math.abs(r.y2 - r.y1) < 0.5)
      return [
        {
          mid,
          at: [mid[0], mid[1] - 5],
          anchor: "middle",
          box: [mid[0] - w / 2, mid[1] - 15, w, 12],
          fits: r.len >= w + 2 * ORTHO_RADIUS,
        },
      ];
    const fits = r.len >= 12 + 2 * ORTHO_RADIUS;
    return [
      {
        mid,
        at: [mid[0] + 6, mid[1] + 4],
        anchor: "start",
        box: [mid[0] + 6, mid[1] - 6, w, 12],
        fits,
      },
      {
        mid,
        at: [mid[0] - 6, mid[1] + 4],
        anchor: "end",
        box: [mid[0] - 6 - w, mid[1] - 6, w, 12],
        fits,
      },
    ];
  };
  const free = (b) =>
    !clear.some(
      (c) =>
        b[0] < c[0] + c[2] + 2 &&
        c[0] < b[0] + b[2] + 2 &&
        b[1] < c[1] + c[3] + 2 &&
        c[1] < b[1] + b[3] + 2,
    );
  if (text) for (const r of runs) for (const s of spots(r)) if (s.fits && free(s.box)) return s;
  const s = spots(runs[0])[0];
  return text ? s : { ...s, box: null };
}

/** The SVG path of an orthogonal edge: its segments, each corner rounded. */
export function orthoPath(points) {
  const f = (n) => n.toFixed(1);
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let k = 1; k < points.length - 1; k++) {
    const [px, py] = points[k - 1],
      [x, y] = points[k],
      [nx, ny] = points[k + 1];
    const lin = Math.hypot(x - px, y - py),
      lout = Math.hypot(nx - x, ny - y);
    const r = Math.min(ORTHO_RADIUS, lin / 2, lout / 2);
    if (r < 0.5) {
      d += ` L${f(x)} ${f(y)}`;
      continue;
    }
    const ax = x - ((x - px) / lin) * r,
      ay = y - ((y - py) / lin) * r;
    const bx = x + ((nx - x) / lout) * r,
      by = y + ((ny - y) / lout) * r;
    d += ` L${f(ax)} ${f(ay)} Q${f(x)} ${f(y)} ${f(bx)} ${f(by)}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d} L${f(lx)} ${f(ly)}`;
}
