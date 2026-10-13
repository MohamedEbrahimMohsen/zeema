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

import {
  endNode,
  groupCaption,
  isInProcess,
  moduleName,
  nodeModules,
  resolveEdge,
  splitEnd,
} from "./document.js";
import {
  LABEL_FONT,
  labelCentre,
  labelOffset,
  orthoPath,
  readVia,
  routeOrthogonal,
} from "./routing.js";

// A shaped orthogonal path (sidecar `edges` entries `{ via }`): see routing.js.
export {
  dropWaypoint,
  EXPAND_STATE_RE,
  expandState,
  LABEL_OFFSET_MAX,
  labelOffset,
  moveSegment,
  pathFor,
  pathsFor,
  readVia,
  refitEnds,
  VIA_MAX,
  viaOf,
  withPath,
} from "./routing.js";

import { frameCaption, moduleLabelWidth, textWidth } from "./text.js";

// How edges are drawn: "orthogonal" (axis-aligned segments with rounded corners, routing.js),
// "bundled" (orthogonal, with the edges that fan out of one side of a box, or into one, sharing a
// trunk: see "Trunks" in routing.js) or "curved" (the curves described above). A design says
// which in its layout sidecar's `routing`; one that says nothing is drawn the default way.
export const ROUTINGS = ["orthogonal", "bundled", "curved"];
export const DEFAULT_ROUTING = "orthogonal";

/** A stored routing as drawn: one of ROUTINGS, anything else the default. */
export function readRouting(v) {
  return ROUTINGS.includes(v) ? v : DEFAULT_ROUTING;
}

// Distance between neighbouring lanes at their midpoints, in px.
export const LANE_STEP = 24;
export const BEND_REACH = 46;
// How far a label on a lane stands off its own curve.
export const LABEL_GAP = 6;
// How far out along a port's outward normal the curve aims its routing (the "aim point" the lane,
// the bow and the bend around an obstacle are measured from), and the least reach of the control
// that makes a ported end leave its box squarely. Nothing is drawn straight along it.
export const STUB = 28;

// A box that stands for N identical copies (a node's nodeCount, a group's groupCount) is drawn as a
// stack: cards behind it, each STACK_STEP px further right and up, at STACK_OPACITY (farthest
// first). render.js draws them; they live here because an edge end on a stacked box stops on the
// outermost card (`stackInset`), and render.js imports geometry.js, not the other way round.
export const STACK_STEP = 6;
export const STACK_OPACITY = [0.45, 0.7];
// How far the outermost card stands out past the box's top and right sides.
export const STACK_REACH = STACK_OPACITY.length * STACK_STEP;

/**
 * How far an edge end on `side` of a stacked box moves out so it stops on the stack's outermost
 * card instead of crossing the cards to the box: STACK_REACH along the side's outward normal on
 * the top and right, where the cards show, and nothing on the left and bottom, where they do not.
 * @param {string} side
 * @returns {[number, number]}
 */
export function stackInset(side) {
  if (side === "top") return [0, -STACK_REACH];
  if (side === "right") return [STACK_REACH, 0];
  return [0, 0];
}

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

// True when box `inner` lies wholly inside box `outer`: a member and its own group's frame, or a
// child group's frame and its parent's.
function inside(inner, outer) {
  return (
    inner[0] >= outer[0] &&
    inner[1] >= outer[1] &&
    inner[0] + inner[2] <= outer[0] + outer[2] &&
    inner[1] + inner[3] <= outer[1] + outer[3]
  );
}

// The point on a box's border nearest a point inside it.
function nearestBorder(box, px, py) {
  return portPoint(box, portAt(box, px, py));
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
  const nodeOf = (end) => String(end).split("/")[0];
  was.forEach((k, i) => {
    const entry = bows && Object.hasOwn(bows, k) ? bows[k] : undefined;
    // Waypoints are absolute, so they stay where they are; a reversed edge meets them in the
    // other order. Each expand state's set goes with it, its ids following the ends' ids.
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const order = (pts) => (flip.has(i) ? pts.reverse() : pts);
      const path = {};
      const via = readVia(entry);
      if (via) path.via = order(via);
      const states = entry.viaExpanded;
      if (states && typeof states === "object") {
        const a = before.edges[i];
        const b = after.edges[i];
        const [bf, bt] = flip.has(i) ? [b.to, b.from] : [b.from, b.to];
        const rename = new Map([
          [nodeOf(a.from), nodeOf(bf)],
          [nodeOf(a.to), nodeOf(bt)],
        ]);
        for (const [state, slot] of Object.entries(states)) {
          const pts = readVia({ via: slot });
          if (!pts) continue;
          const ids = [...new Set(state.split(",").map((id) => rename.get(id) ?? id))];
          path.viaExpanded ??= {};
          path.viaExpanded[ids.sort().join(",")] = order(pts);
        }
      }
      if (path.via || path.viaExpanded) out[now[i]] = path;
      return;
    }
    const v = Number(entry) || 0;
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

/**
 * Carry the label offsets (sidecar `labels`) across the same kind of edit as `rekeyBows`: every
 * edge keeps its index. An offset is in world px, not along the edge, so a reversed edge's label
 * stays where it was.
 */
export function rekeyLabels(before, after, labels) {
  const was = edgeKeys(before);
  const now = edgeKeys(after);
  if (was.length !== now.length) return { ...labels };
  const out = {};
  was.forEach((k, i) => {
    const v = labelOffset(labels, k);
    if (v) out[now[i]] = v;
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

// Where each end of an edge is anchored and what the routing between them aims at. A ported end
// is anchored on its port and aims at a point pushed out along the side's normal; an unported
// end has neither (null) and is clipped later. The aim is STUB out, or a third of the distance
// between the two anchors (ports or centres) when that is shorter. Only the routing uses it; the
// drawn curve is one smooth piece from port to port (see `smooth`).
//
// `frameA` / `frameB` say an end is a group's frame. An unported frame end whose frame holds the
// other end's box is anchored on its border at the side nearest the other end, and that point is
// its own aim; `ca` / `cb` return that point for the end anchored so (null otherwise).
function endsOf(a, b, from, to, frameA = false, frameB = false) {
  let pa = isPort(from) ? portPoint(a, from) : null;
  let pb = isPort(to) ? portPoint(b, to) : null;
  let ca = null,
    cb = null;
  if (!pb && frameB && a !== b && inside(a, b)) {
    const [px, py] = pa ?? [a[0] + a[2] / 2, a[1] + a[3] / 2];
    cb = nearestBorder(b, px, py);
  } else if (!pa && frameA && a !== b && inside(b, a)) {
    const [px, py] = pb ?? [b[0] + b[2] / 2, b[1] + b[3] / 2];
    ca = nearestBorder(a, px, py);
  }
  if (!pa && !pb) return { pa: ca, pb: cb, sa: ca, sb: cb, ca, cb };
  const [ax, ay] = pa ?? ca ?? [a[0] + a[2] / 2, a[1] + a[3] / 2];
  const [bx, by] = pb ?? cb ?? [b[0] + b[2] / 2, b[1] + b[3] / 2];
  const reach = Math.min(STUB, Math.hypot(bx - ax, by - ay) / 3);
  const tip = (p, port) => {
    const [nx, ny] = portNormal(port);
    return [p[0] + nx * reach, p[1] + ny * reach];
  };
  const sa = pa ? tip(pa, from) : ca;
  const sb = pb ? tip(pb, to) : cb;
  pa = pa ?? ca;
  pb = pb ?? cb;
  return { pa, pb, sa, sb, ca, cb };
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
    points.length === 7 ? [points[0], points[6]] : [points[0], points[2]];
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
// exactly on its port and is never clipped, and it leaves its box squarely: the curve's tangent
// there is the side's outward normal, so a port on the side facing away from the other end does
// not send the line back under its own box. The other end, if it has no port, is clipped toward
// the ported end's aim point (see `endsOf`), or toward the curve's control point, as without
// ports. The lane, the bow and the bend around an obstacle are all measured between the two aim
// points (a ported end's, or an unported end itself), and never move a ported end.
//
// `frames` maps a group id to its frame box. An edge end that names no node but a group is drawn
// to the group's frame, ports and all, exactly as to a node's box; a frame is never an obstacle.
// When one end's box lies inside the other's (a member and its own group, a child group and its
// parent) the line runs from the inner box out to the nearest side of the outer one, unless that
// end is ported.
//
// `points` is [from, to] for a straight edge and [from, control, to] for a quadratic one, exactly
// as before, whenever neither end is ported. With a port it is seven points,
// [from, c1, d1, middle, d2, c2, to]: two cubics meeting smoothly at the curve's middle, with no
// straight segment and no corner anywhere (see `smooth`).
//
// `options.captions` (`frameCaptions`) keeps orthogonal edges and their labels off the group
// captions; `options.labelAvoid` is more boxes labels stay off (the canvas's notes).
// `options.labels` maps an edge key to `[dx, dy]`, where someone dragged its label: an offset in
// world px from the label's automatic place taken as its centre (`labelBase`, on every labelled
// edge). A dragged label is drawn centred at `labelBase + offset`, follows its edge as the
// automatic place moves, and is never moved to dodge anything; automatic labels still dodge it.
// `options.stacked` is the ids of the nodes and groups drawn as stacks (`stackedIds` in
// document.js, a Set): an edge end on the top or right side of one stops on its outermost card
// (`stackInset`), whatever the routing, so the line does not cross the cards behind the box.
// `options.routing` picks the style (default DEFAULT_ROUTING). Orthogonal edges carry
// `ortho: true`, and their `points` are the corners of a polyline from one end to the other,
// drawn by `edgePath`; `run` is `{ axis, base }` when the edge has a cross run a bow moves (see
// routing.js), else null. Everything said above about ports, frames and keys holds for both.
//
// An end naming a module of a node (`node/module`) is drawn to and from the node's box, which is
// collapsed here: the drawn edge's `from`/`to` are the node ids, and `fromModule`/`toModule` the
// module ids, present only on an end that names one. The key stays the pair as written. An
// in-process edge (both ends in one node, isInProcess) is not drawn: its ends are the same box.
// `options.moduleBoxes` maps a module end as written (`node/module`) to a box of its own, the
// module's tile in a node the canvas has expanded (`moduleTiles`): such an end is drawn to its
// tile instead of the node's box, spread and routed as a box of its own, and its own node's box
// is not an obstacle to it. The drawn edge's `from`/`to` are still the node ids.
export function edgeGeometry(doc, boxes, bows = {}, ports = {}, frames = {}, options = {}) {
  const tiles = options?.moduleBoxes || null;
  const tiled = (ref) =>
    tiles !== null && splitEnd(ref).module !== null && Object.hasOwn(tiles, ref);
  const isFrame = (id) => !tiled(id) && !boxes[id] && frames != null && Object.hasOwn(frames, id);
  const boxOf = (id) => (tiled(id) ? tiles[id] : isFrame(id) ? frames[id] : boxes[id]);
  const keys = edgeKeys(doc);
  const written = doc.edges || [];
  // Each drawn end is its node, or the module as written when the module has a tile.
  const drawnEnds = (e) => {
    if (!tiles || (!tiled(e?.from) && !tiled(e?.to))) return resolveEdge(e);
    return {
      ...e,
      from: tiled(e.from) ? e.from : endNode(e.from),
      to: tiled(e.to) ? e.to : endNode(e.to),
    };
  };
  const edges = written.map((e) => (isInProcess(e) ? null : drawnEnds(e)));
  // Back to node ids once routed (a tiled end is routed under its module ref).
  const asNodes = (drawn) => {
    if (tiles) for (const d of drawn) [d.from, d.to] = [endNode(d.from), endNode(d.to)];
    return drawn;
  };
  const moduleEnds = (r) => {
    const a = splitEnd(written[r.i]?.from).module;
    const b = splitEnd(written[r.i]?.to).module;
    if (a !== null) r.fromModule = a;
    if (b !== null) r.toModule = b;
    return r;
  };
  const routing = readRouting(options?.routing);
  if (routing !== "curved") {
    const items = [];
    edges.forEach((e, i) => {
      if (!e) return;
      const a = boxOf(e.from),
        b = boxOf(e.to);
      if (!a || !b) return;
      const own = ports && Object.hasOwn(ports, keys[i]) ? ports[keys[i]] : null;
      items.push({ i, key: keys[i], e, a, b, fa: isFrame(e.from), fb: isFrame(e.to), own });
    });
    // Where each frame's caption is drawn (its words and icon), from `options.captions`
    // (`frameCaptions`): the router keeps edges and labels off them.
    const caps = options?.captions || {};
    const captionBoxes = [];
    for (const [gid, f] of Object.entries(frames || {})) {
      const c = Object.hasOwn(caps, gid) ? caps[gid] : null;
      if (c) captionBoxes.push([f[0] + 10, f[1] + 5, Math.max(0, c.width - 20), 16 + c.extra]);
    }
    const routed = routeOrthogonal(items, boxes, bows || {}, isPort, {
      captions: captionBoxes,
      labelAvoid: options?.labelAvoid || [],
      labels: options?.labels || {},
      bundle: routing === "bundled",
    }).map((r) => {
      const e = edges[r.i];
      const label = e.label || null;
      return moduleEnds({
        ...r,
        from: e.from,
        to: e.to,
        dashed: e.mode === "async",
        label: label === null ? null : String(label),
      });
    });
    return asNodes(
      keepAuthOff(stackEnds(routed, boxOf, options?.stacked, ports, keys), edges, boxes),
    );
  }
  const buckets = new Map();
  edges.forEach((e, i) => {
    if (!e) return;
    const key = [e.from, e.to].sort().join("\u0000");
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(i);
  });
  const out = [];
  for (const indices of buckets.values()) {
    const n = indices.length;
    indices.forEach((i, k) => {
      const e = edges[i];
      const a = boxOf(e.from),
        b = boxOf(e.to);
      if (!a || !b) return;
      let ax = a[0] + a[2] / 2,
        ay = a[1] + a[3] / 2;
      let bx = b[0] + b[2] / 2,
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
      const { pa, pb, sa, sb, ca, cb } = endsOf(
        a,
        b,
        own?.from,
        own?.to,
        isFrame(e.from),
        isFrame(e.to),
      );
      // One box inside the other: the frame's end is its border point, so everything measured
      // from that end's centre is measured from there instead.
      if (cb) [bx, by] = cb;
      if (ca) [ax, ay] = ca;
      // What each unported end is clipped toward: the other end's aim point if it is ported,
      // else the other box's centre.
      const [tax, tay] = sb ?? [bx, by];
      const [tbx, tby] = sa ?? [ax, ay];
      let x1, y1, x2, y2;
      // What the routing is measured between: a ported end's aim point, else the end itself.
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
        // aim point, so the middle may cut back across it: that box is an obstacle too, tried
        // first.
        const away = (p, s, tx, ty) =>
          p && (tx - s[0]) * (s[0] - p[0]) + (ty - s[1]) * (s[1] - p[1]) < 0;
        const obstacles = [
          ...(away(pa, sa, u2, v2) ? [a] : []),
          ...(away(pb, sb, u1, v1) ? [b] : []),
          ...Object.entries(boxes)
            .filter(([id]) => id !== endNode(e.from) && id !== endNode(e.to))
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
          ? smooth([x1, y1], [u1, v1], [u2, v2], [x2, y2], bend, own)
          : bend
            ? [[x1, y1], bend, [x2, y2]]
            : [
                [x1, y1],
                [x2, y2],
              ];
      const mid = midpointOf(points);
      let place = labelPlacement(mid, points, n > 1);
      const label = e.label || null;
      const base = label === null ? null : labelCentre(place.at, place.anchor, String(label));
      const offset = base ? labelOffset(options?.labels, keys[i]) : null;
      if (offset) place = { at: [base[0] + offset[0], base[1] + offset[1]], anchor: "middle" };
      const drawn = {
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
      };
      if (base) drawn.labelBase = base;
      out.push(moduleEnds(drawn));
    });
  }
  return asNodes(
    keepAuthOff(
      stackEnds(
        out.sort((p, q) => p.i - q.i),
        boxOf,
        options?.stacked,
        ports,
        keys,
      ),
      edges,
      boxes,
    ),
  );
}

// Each end of a drawn edge that meets a stacked box (`stacked`, ids of nodes and groups; see
// `stackedIds` in document.js) on its top or right side, moved out by `stackInset` so the line
// stops on the stack's outermost card. The side is the end's port's, else the side the end lies
// on (the one facing the next point, at a corner). An end on a frame reached from inside (a member
// and its own group) is not moved: the cards are outside. An orthogonal end moves no further than
// the corner before it, so its last run keeps its direction.
function stackEnds(drawn, boxOf, stacked, ports, keys) {
  if (!stacked || !(stacked.size ?? stacked.length)) return drawn;
  const has = (id) => (typeof stacked.has === "function" ? stacked.has(id) : stacked.includes(id));
  for (const d of drawn) {
    const own = ports && Object.hasOwn(ports, keys[d.i]) ? ports[keys[d.i]] : null;
    const n = d.points.length;
    if (n < 2) continue;
    const ends = [
      [d.from, d.to, 0, 1, own?.from],
      [d.to, d.from, n - 1, n - 2, own?.to],
    ];
    let points = null;
    for (const [id, otherId, k, j, port] of ends) {
      if (!has(id)) continue;
      const box = boxOf(id),
        other = boxOf(otherId);
      if (!box || (other && other !== box && inside(other, box))) continue;
      const p = (points ?? d.points)[k],
        q = (points ?? d.points)[j];
      const side = isPort(port) ? port.side : sideOf(box, p, q);
      let [dx, dy] = stackInset(side);
      if (!dx && !dy) continue;
      if (d.ortho) {
        // Never past the corner before it: the last run keeps its direction.
        const room = Math.max(
          0,
          dx ? (q[0] - p[0]) * Math.sign(dx) : (q[1] - p[1]) * Math.sign(dy),
        );
        dx = Math.sign(dx) * Math.min(Math.abs(dx), room);
        dy = Math.sign(dy) * Math.min(Math.abs(dy), room);
      }
      points = points ?? d.points.map((c) => [c[0], c[1]]);
      points[k] = [p[0] + dx, p[1] + dy];
    }
    if (points) d.points = points;
  }
  return drawn;
}

// The side of `box` the border point `p` lies on, or null; at a corner, the one whose outward
// normal points most toward `q`, the next point along the edge.
function sideOf(box, p, q) {
  const [x, y, w, h] = box;
  const E = 0.5;
  const within = (v, lo, hi) => v >= lo - E && v <= hi + E;
  const on = [];
  if (Math.abs(p[1] - y) < E && within(p[0], x, x + w)) on.push("top");
  if (Math.abs(p[0] - (x + w)) < E && within(p[1], y, y + h)) on.push("right");
  if (Math.abs(p[1] - (y + h)) < E && within(p[0], x, x + w)) on.push("bottom");
  if (Math.abs(p[0] - x) < E && within(p[1], y, y + h)) on.push("left");
  if (on.length < 2) return on[0] ?? null;
  const toward = (s) => NORMALS[s][0] * (q[0] - p[0]) + NORMALS[s][1] * (q[1] - p[1]);
  return on.reduce((best, s) => (toward(s) > toward(best) ? s : best));
}

// The seven points of an edge with a ported end: two cubics joined smoothly at the curve's
// middle, [start, c1, d1, middle, d2, c2, end]. There are no straight stubs: at a ported end the
// first control runs along the side's outward normal, so the curve leaves its box squarely and
// arrives squarely, and the arrowhead (which takes its direction from the last control) points
// straight into the box. The middle is where the quadratic through `bend` would put its own
// midpoint, so a bow drag still puts the curve under the pointer; with no bend, the one cubic
// between the ports is split in half, so every ported edge has the same seven-point shape. An
// unported end aims its control at the middle; it is clipped as without ports.
function smooth(start, aimStart, aimEnd, end, bend, own) {
  const [u1, v1] = aimStart,
    [u2, v2] = aimEnd;
  const toward = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
  const along = (p, port, reach) => {
    const [nx, ny] = portNormal(port);
    return [p[0] + nx * reach, p[1] + ny * reach];
  };
  if (!bend) {
    const d = Math.hypot(end[0] - start[0], end[1] - start[1]);
    // Far enough out to read as square, never so far that two close facing ports loop back.
    const reach = Math.max(Math.min(STUB, d / 3), d * 0.4);
    const c1 = isPort(own?.from) ? along(start, own.from, reach) : toward(start, end, 1 / 3);
    const c2 = isPort(own?.to) ? along(end, own.to, reach) : toward(end, start, 1 / 3);
    // de Casteljau at t = 0.5.
    const ab = toward(start, c1, 0.5),
      bc = toward(c1, c2, 0.5),
      cd = toward(c2, end, 0.5);
    const abc = toward(ab, bc, 0.5),
      bcd = toward(bc, cd, 0.5);
    return [start, ab, abc, toward(abc, bcd, 0.5), bcd, cd, end];
  }
  const mx = (u1 + u2) / 2,
    my = (v1 + v2) / 2;
  const middle = [mx + (bend[0] - mx) / 2, my + (bend[1] - my) / 2];
  let tx = u2 - u1,
    ty = v2 - v1;
  let tl = Math.hypot(tx, ty);
  if (tl < 1e-9) {
    tx = end[0] - start[0];
    ty = end[1] - start[1];
    tl = Math.hypot(tx, ty) || 1;
  }
  tx /= tl;
  ty /= tl;
  const la = Math.hypot(middle[0] - start[0], middle[1] - start[1]);
  const lb = Math.hypot(end[0] - middle[0], end[1] - middle[1]);
  const reach = (l) => Math.max(Math.min(STUB, l / 2), l * 0.55);
  const c1 = isPort(own?.from) ? along(start, own.from, reach(la)) : toward(start, middle, 0.4);
  const c2 = isPort(own?.to) ? along(end, own.to, reach(lb)) : toward(end, middle, 0.4);
  const d1 = [middle[0] - tx * la * 0.4, middle[1] - ty * la * 0.4];
  const d2 = [middle[0] + tx * lb * 0.4, middle[1] + ty * lb * 0.4];
  return [start, c1, d1, middle, d2, c2, end];
}

// Where the line actually is, halfway along. For a curve that is not the control point: the
// control point sits twice as far out as the curve it pulls, so a label placed there drifts away
// from its own edge as the edge is bowed. This is the quadratic at t = 0.5, or, for an edge with
// a ported end, the point where its two cubics join.
export function midpointOf(points) {
  if (points.length === 7) return [points[3][0], points[3][1]];
  if (points.length === 3) {
    const [[x1, y1], [cx, cy], [x2, y2]] = points;
    return [x1 * 0.25 + cx * 0.5 + x2 * 0.25, y1 * 0.25 + cy * 0.5 + y2 * 0.25];
  }
  const [[x1, y1], [x2, y2]] = points;
  return [(x1 + x2) / 2, (y1 + y2) / 2];
}

/** The SVG path of a drawn edge, whichever way it is routed. */
export function edgePath(edge) {
  return edge.ortho ? orthoPath(edge.points) : pathOf(edge.points);
}

// Where an edge's `auth` glyph sits (`authAt`). It starts AUTH_GLYPH_STEP along the line from the
// source end, which has no arrowhead and is far from the label at the middle. The glyph's centre
// keeps AUTH_SOURCE_CLEAR from the source end (its port), AUTH_CLEAR from every corner of the
// edge's own path (so the disc, AUTH_GLYPH_R, never sits on a bend, nor on the junction a short
// stub makes with a run beside it), AUTH_ARROW_CLEAR from the target end (the arrowhead), and off
// the stretches `keepAuthOff` marks: another edge's line (a bundle's shared stub and trunk, a run
// it meets), every label, and every node box, so no box ever covers any of the disc.
// On each run in turn, from the source: the step if it fits there, else the earliest of the run's
// middle (on a run at least AUTH_ROOM long) and the places just past a marked stretch that fits;
// failing every run, the middle of the whole line. A curve is one run with no corners.
export const AUTH_GLYPH_STEP = 20;
/** The disc under an auth glyph, in px. */
export const AUTH_GLYPH_R = 7;
export const AUTH_CLEAR = 10;

/** How far in from a node's right and bottom edges the centre of its reference disc sits, in px. */
export const REF_INSET = 14;

/**
 * The centre of a referencing node's link disc (radius AUTH_GLYPH_R) in the box's own
 * coordinates (its top-left corner is 0,0), for a box `w` x `h`: the bottom-right corner, in.
 * The server render and the canvas both place it here.
 * @returns {[number, number]}
 */
export function refAt(w, h) {
  return [w - REF_INSET, h - REF_INSET];
}
const AUTH_SOURCE_CLEAR = 14;
const AUTH_ARROW_CLEAR = 20;
const AUTH_ROOM = 34;
// How far off a marked line, label box or node box the glyph's centre stays: the disc and 2px.
const AUTH_OFF = 9;

const authed = (e) => typeof e?.auth === "string" && e.auth !== "none";

// The parameters [t0, t1] along a→b inside the rectangle r, or null (Liang-Barsky).
function clipSegment(a, b, r) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  let t0 = 0,
    t1 = 1;
  const sides = [
    [-dx, a[0] - r[0]],
    [dx, r[0] + r[2] - a[0]],
    [-dy, a[1] - r[1]],
    [dy, r[1] + r[3] - a[1]],
  ];
  for (const [p, q] of sides) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [t0, t1];
}

// The rectangle a drawn label's words cover, from where it is drawn (as routing.js boxes it).
function labelBoxOf(d) {
  const w = textWidth(d.label, LABEL_FONT);
  const [x, y] = d.labelAt;
  const x0 = d.labelAnchor === "start" ? x : d.labelAnchor === "end" ? x - w : x - w / 2;
  return [x0, y - 10, w, 12];
}

const grow = (r, m) => [r[0] - m, r[1] - m, r[2] + 2 * m, r[3] + 2 * m];

/**
 * Marks, on every drawn edge that has an `auth`, the stretches of its own line its glyph keeps
 * off, as `authKeep`: [[from, to], ...] in px along the line from the source end (`polylineOf`).
 * They are where the line passes within AUTH_OFF of a label (any edge's, its own too) or of a
 * node box (`nodeBoxes`, its own ends' too; a group frame is drawn under the edges, so it is not
 * one), where its glyph would overlap one placed before it (edges in order), or, for an
 * orthogonal edge, within AUTH_OFF of another orthogonal edge's line: a run it meets or crosses;
 * a run it shares with another edge even in part (a bundle's stub and trunk, stubs off one point)
 * is kept off whole. An edge with no auth carries no `authKeep`, so the geometry of a design
 * without auth is what it always was.
 */
function keepAuthOff(drawn, docEdges, nodeBoxes) {
  if (!drawn.some((d) => authed(docEdges[d.i]))) return drawn;
  const labels = drawn
    .filter((d) => d.label && d.labelAt)
    .map((d) => grow(labelBoxOf(d), AUTH_OFF));
  for (const b of Object.values(nodeBoxes || {})) labels.push(grow(b, AUTH_OFF));
  const runs = [];
  for (const d of drawn) {
    if (!d.ortho) continue;
    for (let k = 1; k < d.points.length; k++) {
      const [a, b] = [d.points[k - 1], d.points[k]];
      const x = Math.min(a[0], b[0]),
        y = Math.min(a[1], b[1]);
      const raw = [x, y, Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])];
      runs.push({ i: d.i, raw, r: grow(raw, AUTH_OFF) });
    }
  }
  // Two runs on one line that overlap: a stretch two edges share.
  const overlap = (p, q, u) => Math.min(p[u] + p[u + 2], q[u] + q[u + 2]) - Math.max(p[u], q[u]);
  const along = (p, q) =>
    (p[2] < 0.5 && q[2] < 0.5 && Math.abs(p[0] - q[0]) < 1 && overlap(p, q, 1) > 0.5) ||
    (p[3] < 0.5 && q[3] < 0.5 && Math.abs(p[1] - q[1]) < 1 && overlap(p, q, 0) > 0.5);
  // The glyphs placed so far, each as the square the next glyph's centre keeps out of.
  const placed = [];
  for (const d of drawn) {
    if (!authed(docEdges[d.i])) continue;
    const others = d.ortho ? runs.filter((x) => x.i !== d.i) : [];
    const boxes = [...labels, ...others.map((x) => x.r), ...placed];
    const line = polylineOf(d);
    const keep = [];
    let s0 = 0;
    for (let k = 1; k < line.length; k++) {
      const [a, b] = [line[k - 1], line[k]];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      // A run shared with another edge, even in part (a bundle's stub and trunk), is kept off
      // whole: the glyph goes on the edge's own branch.
      if (d.ortho) {
        const mine = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0])];
        mine.push(Math.abs(b[1] - a[1]));
        if (others.some((x) => along(mine, x.raw))) keep.push([s0, s0 + l]);
      }
      for (const box of boxes) {
        const t = clipSegment(a, b, box);
        if (t) keep.push([s0 + t[0] * l, s0 + t[1] * l]);
      }
      s0 += l;
    }
    if (keep.length) {
      keep.sort((p, q) => p[0] - q[0]);
      const merged = [keep[0].slice()];
      for (const [lo, hi] of keep.slice(1)) {
        const last = merged[merged.length - 1];
        if (lo <= last[1]) last[1] = Math.max(last[1], hi);
        else merged.push([lo, hi]);
      }
      d.authKeep = merged.map(([lo, hi]) => [Math.round(lo * 10) / 10, Math.round(hi * 10) / 10]);
    }
    const [gx, gy] = authAt(d);
    placed.push(grow([gx, gy, 0, 0], AUTH_GLYPH_R * 2 + 2));
  }
  return drawn;
}

/** The drawn edge as a polyline: its corners when orthogonal, else its curves sampled. */
function polylineOf(edge) {
  const p = edge.points;
  if (edge.ortho || p.length === 2) return p;
  const N = 16;
  const out = [p[0]];
  const quad = (a, c, b, t) => {
    const u = 1 - t;
    return [
      u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
    ];
  };
  const cubic = (a, c1, c2, b, t) => {
    const u = 1 - t;
    const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return [
      k[0] * a[0] + k[1] * c1[0] + k[2] * c2[0] + k[3] * b[0],
      k[0] * a[1] + k[1] * c1[1] + k[2] * c2[1] + k[3] * b[1],
    ];
  };
  if (p.length === 3) for (let i = 1; i <= N; i++) out.push(quad(p[0], p[1], p[2], i / N));
  else {
    for (let i = 1; i <= N; i++) out.push(cubic(p[0], p[1], p[2], p[3], i / N));
    for (let i = 1; i <= N; i++) out.push(cubic(p[3], p[4], p[5], p[6], i / N));
  }
  return out;
}

/**
 * Where a drawn edge's `auth` glyph is centred, on the line itself, whichever way it is routed
 * (the rule is at AUTH_GLYPH_STEP). One place for the server render and the canvas.
 * @param {any} edge a drawn edge from `edgeGeometry`
 * @returns {[number, number]}
 */
export function authAt(edge) {
  const line = polylineOf(edge);
  const starts = [0];
  for (let k = 1; k < line.length; k++)
    starts.push(
      starts[k - 1] + Math.hypot(line[k][0] - line[k - 1][0], line[k][1] - line[k - 1][1]),
    );
  const total = starts[starts.length - 1];
  const pointAt = (s) => {
    for (let k = 1; k < line.length; k++) {
      if (s > starts[k] + 1e-9 && k < line.length - 1) continue;
      const l = starts[k] - starts[k - 1];
      const t = l > 0 ? Math.min(1, Math.max(0, (s - starts[k - 1]) / l)) : 0;
      const [a, b] = [line[k - 1], line[k]];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    return [line[0][0], line[0][1]];
  };
  const round = ([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  const keep = Array.isArray(edge.authKeep) ? edge.authKeep : [];
  const src = line[0],
    dst = line[line.length - 1];
  const corners = edge.ortho ? line.slice(1, -1) : [];
  const far = (p, q, d) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= d - 1e-6;
  const fits = (s, p) =>
    far(p, src, AUTH_SOURCE_CLEAR) &&
    far(p, dst, AUTH_ARROW_CLEAR) &&
    corners.every((c) => far(p, c, AUTH_CLEAR)) &&
    !keep.some(([lo, hi]) => s > lo + 1e-6 && s < hi - 1e-6);
  // The runs walked from the source, as [start, length]: each segment of an orthogonal path; a
  // curve (or a straight line) is one.
  const runs = edge.ortho
    ? starts.slice(1).map((end, k) => [starts[k], end - starts[k]])
    : [[0, total]];
  for (const [s0, l] of runs) {
    // After the step, the earliest of: the run's middle, and the places just past (or short of)
    // a marked stretch, so a glyph pushed off a label or a shared run lands right beside it.
    const others = keep
      .flat()
      .map((s) => s - s0)
      .filter((c) => c > 0 && c < l);
    if (l >= AUTH_ROOM) others.push(l / 2);
    const tries = [AUTH_GLYPH_STEP, ...others.sort((p, q) => p - q)];
    for (const c of tries) {
      if (c > l) continue;
      const p = pointAt(s0 + c);
      if (fits(s0 + c, p)) return round(p);
    }
  }
  return round(pointAt(total / 2));
}

/**
 * The bow a pointer at (x, y) asks of an orthogonal edge (one `edgeGeometry` drew): how far its
 * cross run would move to sit under the pointer. Zero for an edge with no cross run.
 */
export function orthoBowAt(edge, x, y) {
  if (!edge?.run) return 0;
  const v = (edge.run.axis === "y" ? y : x) - edge.run.base;
  return Math.max(-1200, Math.min(1200, Math.round(v)));
}

export function pathOf(points) {
  if (points.length === 7) {
    const f = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;
    const [start, c1, d1, middle, d2, c2, end] = points.map(f);
    return `M${start} C${c1} ${d1} ${middle} C${d2} ${c2} ${end}`;
  }
  if (points.length === 3) {
    const [[x1, y1], [cx, cy], [x2, y2]] = points;
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  const [[x1, y1], [x2, y2]] = points;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

// A frame's padding around what it holds: its members and child frames. The label strip is the
// top padding, and grows by a line for a caption set on two (see `frameCaption`).
export const FRAME_PAD_X = 16;
export const FRAME_PAD_TOP = 32;
export const FRAME_PAD_BOTTOM = 16;

/**
 * Every group's caption as its frame sets it: `{ [groupId]: { lines, width, extra, strip } }`.
 * `strip` is the height of the label strip a pointer aims at the group through. A group style
 * (`styles`, the sidecar's `frames`) with an icon pushes the words right, so it needs more room.
 * @param {any} doc
 * @param {any} [catalogue]
 * @param {Record<string, any> | null} [styles]
 * @returns {Record<string, { lines: string[], width: number, extra: number, strip: number }>}
 */
export function frameCaptions(doc, catalogue = null, styles = null) {
  const out = {};
  for (const g of doc?.groups || []) {
    const st = styles && Object.hasOwn(styles, g.id) ? styles[g.id] : null;
    const icon = Boolean(st && typeof st === "object" && typeof st.icon === "string" && st.icon);
    const cap = frameCaption(groupCaption(catalogue, g), icon);
    out[g.id] = { ...cap, strip: FRAME_PAD_TOP - 2 + cap.extra };
  }
  return out;
}

/**
 * The frame around content spanning (x0, y0)–(x1, y1): padded, at least as wide as its caption
 * (`cap`, one entry of `frameCaptions`), the extra width shared either side, and with its label
 * strip as tall as the caption needs. The automatic layout sizes a group's block with this and
 * `groupFrames` draws a frame with it, so the two can never disagree.
 */
export function frameAround(x0, y0, x1, y1, cap) {
  const inner = x1 - x0 + 2 * FRAME_PAD_X;
  const width = Math.max(inner, cap ? cap.width : 0);
  const dx = Math.floor((width - inner) / 2);
  const top = FRAME_PAD_TOP + (cap ? cap.extra : 0);
  return [x0 - FRAME_PAD_X - dx, y0 - top, width, y1 - y0 + top + FRAME_PAD_BOTTOM];
}

// Group frames are the bounding box of members and child groups, exactly as the renderer draws
// them, so a frame never has to be stored and can never drift from the membership. `captions`
// (from `frameCaptions`) widen a frame to its caption; without them the caption is the group's
// label, else its kind, measured with no icon.
/**
 * @param {any} doc
 * @param {Record<string, number[]>} boxes
 * @param {Record<string, { width: number, extra: number }> | null} [captions]
 * @returns {Record<string, number[]>}
 */
export function groupFrames(doc, boxes, captions = frameCaptions(doc)) {
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
    const x0 = Math.min(...rects.map((r) => r[0]));
    const y0 = Math.min(...rects.map((r) => r[1]));
    const x1 = Math.max(...rects.map((r) => r[0] + r[2]));
    const y1 = Math.max(...rects.map((r) => r[1] + r[3]));
    const cap = captions && Object.hasOwn(captions, gid) ? captions[gid] : null;
    frames[gid] = frameAround(x0, y0, x1, y1, cap);
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
// With `ends` (the edge's `{ from?, to? }` ports) a ported end is measured from its aim point
// (see `endsOf`) rather than its box's centre, so the curve's middle sits under the pointer on an
// edge whose ends were placed.
/** @param {{ from?: object, to?: object } | null} [ends] */
export function bowAt(boxes, from, to, x, y, ends = null, frames = {}) {
  const isFrame = (id) => !boxes[id] && frames != null && Object.hasOwn(frames, id);
  const a = isFrame(from) ? frames[from] : boxes[from],
    b = isFrame(to) ? frames[to] : boxes[to];
  if (!a || !b) return 0;
  const { sa, sb } = endsOf(a, b, ends?.from, ends?.to, isFrame(from), isFrame(to));
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

// A node with modules is drawn collapsed by default (a box with an "N modules" chip). Expanded,
// it is a taller box: a MODULE_HEADER px strip with its usual name, then the modules as tiles
// MODULE_TILE_H tall, up to MODULE_COLUMNS to a row, MODULE_GAP apart and MODULE_GAP from the
// box's sides and bottom. Every tile of a node is one width: the widest label (moduleLabelWidth,
// the 11px mono the canvas sets it in) plus MODULE_TILE_PAD, at least MODULE_TILE_W and at most
// MODULE_TILE_MAX_W (a longer label is cut to fit). One geometry for the canvas and any server
// render of it.
export const MODULE_TILE_W = 84;
export const MODULE_TILE_MAX_W = 220;
export const MODULE_TILE_PAD = 24;
export const MODULE_TILE_H = 40;
export const MODULE_GAP = 12;
export const MODULE_HEADER = 44;
export const MODULE_COLUMNS = 3;

/**
 * The expanded box of a node with modules, in the box's own coordinates (top-left 0,0): its
 * width (`w`, or wider when a full row of tiles needs more), its height, and one tile per module
 * in document order, `{ id, x, y, w, h }`, laid in rows left to right, the grid centred in the
 * box. Tiles are sized to the widest label by `measure` (px of a label; moduleLabelWidth when
 * not given). Null for a node with no modules: it has no expanded form.
 * @param {any} node
 * @param {number} w
 * @param {(text: string) => number} [measure]
 * @returns {{ w: number, h: number, tiles: Array<{ id: string, x: number, y: number, w: number, h: number }> } | null}
 */
export function moduleTiles(node, w, measure = moduleLabelWidth) {
  const list = nodeModules(node);
  if (!list.length) return null;
  const widest = Math.max(...list.map((m) => measure(moduleName(m))));
  const tileW = Math.min(
    MODULE_TILE_MAX_W,
    Math.max(MODULE_TILE_W, Math.ceil(widest + MODULE_TILE_PAD)),
  );
  const cols = Math.min(MODULE_COLUMNS, list.length);
  const rows = Math.ceil(list.length / MODULE_COLUMNS);
  const gridW = cols * tileW + (cols - 1) * MODULE_GAP;
  const width = Math.max(w, gridW + 2 * MODULE_GAP);
  const x0 = Math.round((width - gridW) / 2);
  const tiles = list.map((m, k) => ({
    id: String(m.id),
    x: x0 + (k % MODULE_COLUMNS) * (tileW + MODULE_GAP),
    y: MODULE_HEADER + Math.floor(k / MODULE_COLUMNS) * (MODULE_TILE_H + MODULE_GAP),
    w: tileW,
    h: MODULE_TILE_H,
  }));
  const h = MODULE_HEADER + rows * MODULE_TILE_H + (rows - 1) * MODULE_GAP + MODULE_GAP;
  return { w: width, h, tiles };
}
