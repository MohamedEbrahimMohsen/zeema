// Orthogonal edge routing: every edge is a run of horizontal and vertical segments with rounded
// corners, the way draw.io's orthogonal connector draws. geometry.js calls this for
// `routing: "orthogonal"` and keeps its curves for "curved"; nothing else imports it.
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
// that runs going the same way do not cross each other's legs. A bow (the sidecar's `edges`)
// moves a Z's cross run by that many px; on any other shape it does nothing. Labels stay off
// boxes, captions, earlier labels and whatever else they are told to avoid (the canvas's notes).
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
      sa = pf?.side ?? da;
      sb = pt?.side ?? db;
    }
    return { ...it, pf, pt, nest, sa, sb, ta: pf ? pf.t : null, tb: pt ? pt.t : null };
  });

  // 2. Spread the unported ends along each side, ordered by the other end.
  const sides = new Map();
  const join = (id, box, side, item, end, other) => {
    const k = `${id}\u0000${side}`;
    if (!sides.has(k)) sides.set(k, { box, side, list: [] });
    sides.get(k).list.push({ item, end, at: across(side) ? cx(other) : cy(other) });
  };
  for (const it of ends) {
    // The outer end of a nested edge is wherever the inner end projects to; it is not spread.
    if (it.ta === null && it.nest !== "from") join(it.e.from, it.a, it.sa, it, "a", it.b);
    if (it.tb === null && it.nest !== "to") join(it.e.to, it.b, it.sb, it, "b", it.a);
  }
  for (const { list } of sides.values()) {
    list.sort((p, q) => p.at - q.at || p.item.i - q.item.i || (p.end < q.end ? -1 : 1));
    const n = list.length;
    list.forEach((s, k) => {
      const t = n === 1 ? 0.5 : (1 - SPREAD) / 2 + (SPREAD * (k + 1)) / (n + 1);
      if (s.end === "a") s.item.ta = t;
      else s.item.tb = t;
    });
  }
  // An end alone on its side, on an edge whose other end faces it, lines up with that end when
  // the other end's point lies over this side's spread range: a lone edge is then straight.
  const alone = new Set();
  for (const { list } of sides.values())
    if (list.length === 1) alone.add(`${list[0].item.i}:${list[0].end}`);
  for (const it of ends) {
    if (it.nest || it.a === it.b) continue;
    const facing = NORMAL[it.sa][0] === -NORMAL[it.sb][0] && NORMAL[it.sa][1] === -NORMAL[it.sb][1];
    if (!facing) continue;
    const loneA = alone.has(`${it.i}:a`),
      loneB = alone.has(`${it.i}:b`);
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

  // 3. Route.
  const routes = ends.map((it) => route(it, obstacles, captions));

  // 4. Lanes: inner runs of different edges that lie on one line are moved a lane apart. A run
  // going along +axis with its legs going the same way: the one whose legs sit further along goes
  // nearer the start of the channel, so neither crosses the other's legs.
  const boxList = obstacles.map(([, bx]) => bx);
  const lines = new Map();
  for (const r of routes) {
    r.shift = new Map();
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
      const id = `${axis}:${at}`;
      if (!lines.has(id)) lines.set(id, { axis, at, list: [] });
      lines.get(id).list.push(seg);
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

  // 5. Points, bows, labels.
  const taken = [];
  return routes.map((r) => {
    const { it } = r;
    const bow = Number(bows[it.key]) || 0;
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
    const text = it.e.label || it.e.protocol || "";
    const place = labelOn(points, String(text), [...boxList, ...captions, ...labelAvoid, ...taken]);
    if (place.box) taken.push(place.box);
    return {
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
  });
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
  const own = [it.e.from, it.e.to];
  const others = obstacles.filter(([id]) => id !== own[0] && id !== own[1]).map(([, bx]) => bx);
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

// A label sits on a run, centred: above a horizontal one, beside a vertical one. The longest run
// it fits on clear of every box (and of the labels placed before it) wins; failing that, the
// longest run. `box` is the rectangle the words cover.
function labelOn(points, text, clear) {
  const w = text ? textWidth(text, 12) : 0;
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
