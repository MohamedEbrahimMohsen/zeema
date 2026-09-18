// Layout for Zeema designs: a faithful port of .claude/tools/design_to_svg.py.
//
// Layered layout. Rank by longest path over the edges (with a fallback for nodes a
// topological sort never reaches), collapse every group's members onto one rank,
// order each rank by six barycentre sweeps followed by a group-contiguity block pass,
// wrap ranks wider than MAX_W onto further rows, centre every row, derive group frames
// as padded bounding boxes, then draw edges centre to centre, clipped at the box border,
// with reciprocal pairs offset and a single quadratic bend around the first obstacle.
//
// The port is bug for bug. Two things in particular are load bearing:
//
//   * Python's round() is half to even; JavaScript's Math.round() is half up. 107 of the
//     324 node placements in this repository land on exactly .5, so pyRound() below
//     reproduces CPython's float.__round__ and is used exactly where the Python uses
//     round(), and nowhere else.
//   * Several passes depend on dict insertion order: the group rank collapse walks groups
//     in document order, the edge `pairs` buckets are keyed by an unordered pair so
//     parallel and reciprocal edges share one bucket in edge-array order, the obstacle
//     scan takes the first hit in node declaration order, and frameOf() uses a `done` set
//     so a cycle among groups yields nothing rather than recursing.
//
// No DOM, no imports.

const NAME_PX = 7.6,
  ID_PX = 6.2;
const BOX_H = 78,
  PAD_X = 16,
  GAP_X = 34,
  GAP_Y = 86;
const MIN_W = 126;
const MAX_W = 1180; // a rank wider than this wraps onto further rows
const CANVAS_PAD_X = 120,
  CANVAS_PAD_Y = 46;
const FRAME_PAD_X = 16,
  FRAME_PAD_TOP = 32,
  FRAME_PAD_BOTTOM = 16;
const OBSTACLE_INFLATE = 6; // hits() grows each box by this before testing
const BEND_REACH = 46;
const OFFSET = 16; // lateral separation between parallel / reciprocal edges
const SWEEPS = 6;

// C99 round(): half away from zero. Math.round() is half up, which differs on negatives.
function cRound(x) {
  return x < 0 ? -Math.round(-x) : Math.round(x);
}

// CPython float.__round__(None): round half away from zero, then correct the exact
// halfway case to even. Ties are only ties when the double is exactly .5.
export function pyRound(x) {
  const r = cRound(x);
  if (Math.abs(x - r) === 0.5) return 2 * cRound(x / 2);
  return r;
}

// Python's len() counts code points; String.length counts UTF-16 code units.
function charLen(s) {
  let n = 0;
  for (const _ of String(s)) n++;
  return n;
}

function truthy(v) {
  return v !== undefined && v !== null && v !== "" && v !== false && v !== 0;
}

// --- ranking ----------------------------------------------------------------

function rankNodes(nodes, edges) {
  const ids = nodes.map((n) => n.id);
  const known = new Set(ids);
  const out = new Map(),
    indeg = new Map();
  for (const i of ids) {
    out.set(i, []);
    indeg.set(i, 0);
  }
  const seen = new Set();
  for (const e of edges) {
    // drop duplicate and reciprocal edges for ranking
    if (!known.has(e.from) || !known.has(e.to)) continue; // invalid designs only
    const k = JSON.stringify([e.from, e.to]),
      rk = JSON.stringify([e.to, e.from]);
    if (seen.has(k) || seen.has(rk) || e.from === e.to) continue;
    seen.add(k);
    out.get(e.from).push(e.to);
    indeg.set(e.to, indeg.get(e.to) + 1);
  }
  const rank = new Map();
  for (const i of ids) rank.set(i, 0);
  let queue = ids.filter((i) => indeg.get(i) === 0);
  if (queue.length === 0 && ids.length) queue = [ids[0]];
  const order = [],
    orderSet = new Set();
  const deg = new Map(indeg);
  while (queue.length) {
    const n = queue.shift();
    order.push(n);
    orderSet.add(n);
    for (const m of out.get(n)) {
      deg.set(m, deg.get(m) - 1);
      if (deg.get(m) === 0) queue.push(m);
    }
  }
  for (const n of order)
    for (const m of out.get(n)) rank.set(m, Math.max(rank.get(m), rank.get(n) + 1));
  for (const i of ids) {
    // nodes inside a cycle the sort never reached
    if (!orderSet.has(i)) {
      let mx = 0,
        first = true;
      for (const v of rank.values()) {
        if (first || v > mx) {
          mx = v;
          first = false;
        }
      }
      rank.set(i, first ? 0 : mx);
    }
  }
  return rank;
}

// --- ordering within ranks ---------------------------------------------------

function orderRanks(nodes, edges, rank) {
  const byRank = new Map(); // insertion order = node document order
  for (const n of nodes) {
    const r = rank.get(n.id);
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r).push(n.id);
  }
  const nbr = new Map();
  for (const n of nodes) nbr.set(n.id, []);
  for (const e of edges) {
    if (!nbr.has(e.from) || !nbr.has(e.to)) continue; // invalid designs only
    nbr.get(e.from).push(e.to);
    nbr.get(e.to).push(e.from);
  }
  const pos = new Map();
  for (const list of byRank.values())
    list.forEach((i, k) => {
      pos.set(i, k);
    });
  const ranksSorted = [...byRank.keys()].sort((a, b) => a - b);
  for (let s = 0; s < SWEEPS; s++) {
    for (const r of ranksSorted) {
      const list = byRank.get(r);
      const bary = (i) => {
        const ns = nbr
          .get(i)
          .filter((x) => pos.has(x) && rank.get(x) !== r)
          .map((x) => pos.get(x));
        return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : pos.get(i);
      };
      // Decorate-sort-undecorate: Python computes each key once, then sorts stably.
      const dec = list.map((i, k) => [bary(i), k, i]);
      dec.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const sorted = dec.map((d) => d[2]);
      byRank.set(r, sorted);
      sorted.forEach((i, k) => {
        pos.set(i, k);
      });
    }
  }
  const gof = new Map();
  for (const n of nodes) gof.set(n.id, n.group === undefined ? null : n.group);
  for (const r of ranksSorted) {
    // keep group members side by side
    const blocks = [],
      seen = new Map();
    for (const i of byRank.get(r)) {
      const g = gof.get(i);
      if (g !== null && g !== undefined && seen.has(g)) {
        blocks[seen.get(g)].push(i);
        continue;
      }
      if (g !== null && g !== undefined) seen.set(g, blocks.length);
      blocks.push([i]);
    }
    byRank.set(r, blocks.flat());
  }
  return { byRank, ranksSorted };
}

// --- edge geometry helpers ---------------------------------------------------

function clip(b, x, y, cx, cy) {
  const dx = x - cx,
    dy = y - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const sx = dx ? b[2] / 2 / Math.abs(dx) : 1e9;
  const sy = dy ? b[3] / 2 / Math.abs(dy) : 1e9;
  const s = Math.min(sx, sy);
  return [cx + dx * s, cy + dy * s];
}

// Liang-Barsky clip test of a segment against an inflated box.
function hits(x1, y1, x2, y2, r) {
  const rx0 = r[0] - OBSTACLE_INFLATE,
    ry0 = r[1] - OBSTACLE_INFLATE;
  const rx1 = r[0] + r[2] + OBSTACLE_INFLATE,
    ry1 = r[1] + r[3] + OBSTACLE_INFLATE;
  let t0 = 0.0,
    t1 = 1.0;
  const dx = x2 - x1,
    dy = y2 - y1;
  const tests = [
    [-dx, x1 - rx0],
    [dx, rx1 - x1],
    [-dy, y1 - ry0],
    [dy, ry1 - y1],
  ];
  for (const [p, q] of tests) {
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

// --- the layout --------------------------------------------------------------

/**
 * @param {object} doc      a Zeema design document
 * @param {object} [catalogue]  unused: geometry reads nothing outside the document,
 *                              exactly as the Python renderer does
 * @returns {{positions: Object, sizes: Object, frames: Object,
 *            edges: Array, canvas: [number, number]}}
 */
export function layout(doc, _catalogue) {
  const nodes = doc && Array.isArray(doc.nodes) ? doc.nodes : [];
  const edges = doc && Array.isArray(doc.edges) ? doc.edges : [];
  const groups = doc && Array.isArray(doc.groups) ? doc.groups : [];

  const rank = rankNodes(nodes, edges);
  for (const g of groups) {
    // a group is drawn as one frame, so its
    const members = []; // members share a rank
    for (const n of nodes) if (n.group === g.id) members.push(n.id);
    if (members.length) {
      let r = rank.get(members[0]);
      for (const i of members) r = Math.max(r, rank.get(i));
      for (const i of members) rank.set(i, r);
    }
  }
  const { byRank, ranksSorted } = orderRanks(nodes, edges, rank);

  const text = new Map();
  for (const n of nodes) text.set(n.id, truthy(n.label) ? String(n.label) : n.id);

  const box = new Map(); // insertion order = node document order
  for (const n of nodes) {
    const w = Math.max(charLen(text.get(n.id)) * NAME_PX, charLen(n.component) * ID_PX) + 2 * PAD_X;
    box.set(n.id, [0, 0, Math.max(MIN_W, pyRound(w)), BOX_H]);
  }

  const gmembers = new Map(),
    gchild = new Map();
  for (const g of groups) {
    gmembers.set(
      g.id,
      nodes.filter((n) => n.group === g.id).map((n) => n.id),
    );
    gchild.set(
      g.id,
      groups.filter((h) => h.parent === g.id).map((h) => h.id),
    );
  }

  // place: ranks stack along the flow axis, nodes spread across it
  const rows = [];
  for (const r of ranksSorted) {
    let chunk = [],
      w = 0;
    for (const i of byRank.get(r)) {
      // wrap a rank that would run off the page
      let add = box.get(i)[2] + (chunk.length ? GAP_X : 0);
      if (chunk.length && w + add > MAX_W) {
        rows.push(chunk);
        chunk = [];
        w = 0;
        add = box.get(i)[2];
      }
      chunk.push(i);
      w += add;
    }
    if (chunk.length) rows.push(chunk);
  }
  const widths = rows.map(
    (ids) => ids.reduce((a, i) => a + box.get(i)[2], 0) + GAP_X * (ids.length - 1),
  );
  const canvasW = (widths.length ? Math.max(...widths) : 0) + CANVAS_PAD_X;
  let y = CANVAS_PAD_Y;
  for (let k = 0; k < rows.length; k++) {
    let x = (canvasW - widths[k]) / 2;
    for (const i of rows[k]) {
      const b = box.get(i);
      b[0] = pyRound(x);
      b[1] = y;
      x += b[2] + GAP_X;
    }
    y += BOX_H + GAP_Y;
  }
  const canvasH = y - GAP_Y + CANVAS_PAD_Y;

  // group frames: bounding box of members and of child groups
  const frame = new Map(),
    done = new Set();
  const frameOf = (gid) => {
    if (done.has(gid)) return frame.has(gid) ? frame.get(gid) : null;
    done.add(gid);
    const xs = (gmembers.get(gid) || []).map((i) => box.get(i));
    const rs = (gchild.get(gid) || [])
      .map((c) => frameOf(c))
      .filter((r) => r)
      .concat(xs.map((b) => [b[0], b[1], b[2], b[3]]));
    if (!rs.length) return null;
    const x0 = Math.min(...rs.map((r) => r[0])) - FRAME_PAD_X;
    const y0 = Math.min(...rs.map((r) => r[1])) - FRAME_PAD_TOP;
    const x1 = Math.max(...rs.map((r) => r[0] + r[2])) + FRAME_PAD_X;
    const y1 = Math.max(...rs.map((r) => r[1] + r[3])) + FRAME_PAD_BOTTOM;
    frame.set(gid, [x0, y0, x1 - x0, y1 - y0]);
    return frame.get(gid);
  };
  for (const g of groups) frameOf(g.id);

  // edges: centre to centre, clipped at the border, reciprocal pairs offset
  const pairs = new Map(); // keyed by the unordered pair, in edge order
  edges.forEach((e, i) => {
    if (!box.has(e.from) || !box.has(e.to)) return; // invalid designs only
    const key = JSON.stringify(e.from <= e.to ? [e.from, e.to] : [e.to, e.from]);
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push([i, e]);
  });
  const boxEntries = [...box.entries()]; // node declaration order
  const outEdges = [];
  for (const group of pairs.values()) {
    group.forEach(([idx, e], k) => {
      const a = box.get(e.from),
        b = box.get(e.to);
      let ax = a[0] + a[2] / 2,
        ay = a[1] + a[3] / 2;
      let bx = b[0] + b[2] / 2,
        by = b[1] + b[3] / 2;
      const off = group.length === 1 ? 0 : (k - (group.length - 1) / 2) * OFFSET;
      const dx = bx - ax,
        dy = by - ay;
      const ln = Math.sqrt(dx * dx + dy * dy) || 1;
      const ox = (-dy / ln) * off,
        oy = (dx / ln) * off;
      ax += ox;
      ay += oy;
      bx += ox;
      by += oy;
      const [x1, y1] = clip(a, bx, by, ax, ay);
      const [x2, y2] = clip(b, ax, ay, bx, by);
      let bend = null;
      for (const [other, ob] of boxEntries) {
        if (other === e.from || other === e.to || !hits(x1, y1, x2, y2, ob)) continue;
        const mx = (x1 + x2) / 2,
          my = (y1 + y2) / 2;
        const ocx = ob[0] + ob[2] / 2,
          ocy = ob[1] + ob[3] / 2;
        const ddx = x2 - x1,
          ddy = y2 - y1;
        const dln = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
        const px = -ddy / dln,
          py = ddx / dln;
        const side = px * (mx - ocx) + py * (my - ocy) >= 0 ? 1 : -1;
        const reach = (ob[2] / 2 + BEND_REACH) * side;
        bend = [mx + px * reach, my + py * reach];
        break;
      }
      const lab = truthy(e.label) ? e.label : truthy(e.protocol) ? e.protocol : null;
      outEdges.push({
        from: e.from,
        to: e.to,
        i: idx,
        points: bend
          ? [[x1, y1], bend, [x2, y2]]
          : [
              [x1, y1],
              [x2, y2],
            ],
        dashed: e.mode === "async",
        label: lab === null ? null : String(lab),
      });
    });
  }

  const positions = {},
    sizes = {},
    frames = {};
  for (const n of nodes) {
    const b = box.get(n.id);
    positions[n.id] = [b[0], b[1]];
    sizes[n.id] = [b[2], b[3]];
  }
  for (const [gid, f] of frame) frames[gid] = [f[0], f[1], f[2], f[3]];
  return { positions, sizes, frames, edges: outEdges, canvas: [canvasW, canvasH] };
}

export default layout;
