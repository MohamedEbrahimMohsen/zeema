// Layout for Zeema designs: a compound (hierarchical) layered layout.
//
// A group is laid out as a block, and the block is placed like a node one level up. The root
// level holds the ungrouped nodes and the top-level groups; a group's level holds its member
// nodes and its child groups. Every level runs the same layered pipeline over its items: rank
// by longest path over the edges contracted to that level (with a fallback for items a
// topological sort never reaches), order each rank by six barycentre sweeps, wrap ranks wider
// than MAX_W onto further rows, centre every row. A group's frame is exactly its block, so two
// frames overlap only when one group contains the other, and a node lies inside the frames of
// its own groups and of no other.
//
// This began as a port of .claude/tools/design_to_svg.py, whose flat layout let a parent frame
// swallow unrelated groups; the Python tool is no longer the reference. pyRound() survives
// from the port (half to even, as the Python rounded) for row offsets that
// land on .5.
//
// Reciprocal pairs. Two edges between the same two items in opposite directions (after
// contraction to the level: a tunnel dialled out from inside one block to a node inside another
// and answered back) would make the ranking keep whichever is listed first, which can put an
// edge block below the blocks it fronts. Such a pair is oriented by flow instead. The flow
// order is the catalogue categories client, edge, security, compute, messaging, data, ops,
// external, custom (an unknown category counts as custom); a node's flow index is its
// component's kind's category's place in that list, and an item's flow is taken over the nodes
// it contains: first the minimum, then (on a tie) the mean. The edge running from the item that
// comes first in the flow to the other is kept for ranking; if the two are level, the edge
// listed first in the document is kept, as before. Both edges are still ordered and drawn.
// Without a catalogue every node has the same flow index, so every pair falls to document order.
//
// An edge end may name a group: the group as a unit. At a level above the group it counts as an
// edge from or to the block that holds the group (the group's own block, or an ancestor's), so
// it ranks and orders like any other contracted edge, and its flow is that block's flow. At the
// group's own level and below it is inside one item and ranks nothing, so an edge from a member
// to its own group, or from a group to a child group, never pulls a block out of its frame.
//
// The edges come from edgeGeometry, the same code the canvas and the as-drawn renderer use, so
// an automatic arrangement and a drawing route edges identically.
//
// Pure: no DOM, no fs. It imports geometry.js for the edges, text.js for the box widths and
// document.js for the name a box shows; none of them imports anything.

import { endNode, hasRefDisc, nodeLines, stackedIds } from "./document.js";
import { DEFAULT_ROUTING, edgeGeometry, frameAround, frameCaptions } from "./geometry.js";
import { nodeWidth } from "./text.js";

const BOX_H = 78,
  GAP_X = 34,
  GAP_Y = 86;
// A rank wider than this wraps onto further rows. Sized for the stepped box widths (text.js
// BOX_W_STEPS): five 240px boxes fit one row, and no reference design wraps into more rows than
// it did when boxes were sized to their exact text under 1180.
const MAX_W = 1490;
const CANVAS_PAD_X = 120,
  CANVAS_PAD_Y = 46;
const SWEEPS = 6;
const FLOW = [
  "client",
  "edge",
  "security",
  "compute",
  "messaging",
  "data",
  "ops",
  "external",
  "custom",
];
const FLOW_CUSTOM = FLOW.indexOf("custom");

// A node's place in the flow order, from its component's kind's category.
function flowIndex(catalogue, componentId) {
  if (!catalogue?.components || !catalogue.kinds) return FLOW_CUSTOM;
  const own = (o, k) => (o && Object.hasOwn(o, k) ? o[k] : undefined);
  const comp = own(catalogue.components, componentId);
  const kind = comp ? own(catalogue.kinds, comp.kind) : undefined;
  const k = kind ? FLOW.indexOf(kind.category) : -1;
  return k < 0 ? FLOW_CUSTOM : k;
}

// Negative when flow `a` ({min, sum, n}) comes before `b`: the smaller minimum, then the smaller
// mean (compared exactly, as integer cross products).
function flowCompare(a, b) {
  if (a.min !== b.min) return a.min - b.min;
  return a.sum * b.n - b.sum * a.n;
}

// The edges ranking uses: of a reciprocal pair, only the direction that runs with the flow;
// a level pair is left alone, and rankNodes keeps the edge listed first.
function orientReciprocal(edges, flowOf) {
  const dirs = new Set(edges.map((e) => JSON.stringify([e.from, e.to])));
  return edges.filter((e) => {
    if (e.from === e.to || !dirs.has(JSON.stringify([e.to, e.from]))) return true;
    return flowCompare(flowOf(e.from), flowOf(e.to)) <= 0;
  });
}

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

function orderRanks(items, edges, rank) {
  const byRank = new Map(); // insertion order = item order
  for (const n of items) {
    const r = rank.get(n.id);
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r).push(n.id);
  }
  const nbr = new Map();
  for (const n of items) nbr.set(n.id, []);
  for (const e of edges) {
    if (!nbr.has(e.from) || !nbr.has(e.to)) continue;
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
      // Decorate-sort-undecorate: compute each key once, then sort stably.
      const dec = list.map((i, k) => [bary(i), k, i]);
      dec.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const sorted = dec.map((d) => d[2]);
      byRank.set(r, sorted);
      sorted.forEach((i, k) => {
        pos.set(i, k);
      });
    }
  }
  return { byRank, ranksSorted };
}

// --- one level ---------------------------------------------------------------

// Place `items` ({id, w, h}) in a box whose top-left corner is (0, 0). `edges` run between
// item ids. Returns every item's position and the content size.
// `rankEdges` (default: `edges`) are the edges the ranking follows.
function placeLevel(items, edges, rankEdges = edges) {
  const rank = rankNodes(items, rankEdges);
  const { byRank, ranksSorted } = orderRanks(items, edges, rank);
  const size = new Map(items.map((it) => [it.id, [it.w, it.h]]));

  const rows = [];
  for (const r of ranksSorted) {
    let chunk = [],
      w = 0;
    for (const i of byRank.get(r)) {
      // wrap a rank that would run off the page
      let add = size.get(i)[0] + (chunk.length ? GAP_X : 0);
      if (chunk.length && w + add > MAX_W) {
        rows.push(chunk);
        chunk = [];
        w = 0;
        add = size.get(i)[0];
      }
      chunk.push(i);
      w += add;
    }
    if (chunk.length) rows.push(chunk);
  }
  const widths = rows.map(
    (ids) => ids.reduce((a, i) => a + size.get(i)[0], 0) + GAP_X * (ids.length - 1),
  );
  const width = widths.length ? Math.max(...widths) : 0;
  const pos = new Map();
  let y = 0;
  for (let k = 0; k < rows.length; k++) {
    let x = (width - widths[k]) / 2;
    let tallest = 0;
    for (const i of rows[k]) {
      const [w, h] = size.get(i);
      pos.set(i, [pyRound(x), y]); // a row aligns its items on their top edge
      x += w + GAP_X;
      tallest = Math.max(tallest, h);
    }
    y += tallest + GAP_Y;
  }
  return { pos, width, height: rows.length ? y - GAP_Y : 0 };
}

// --- the layout --------------------------------------------------------------

const present = (v) => v !== undefined && v !== null;

/**
 * @param {object} doc      a Zeema design document
 * @param {object} [catalogue]  the bundle ({kinds, components}); read to orient reciprocal
 *                              edge pairs by flow (see the header) and for group captions. Optional.
 * @param {object} [options]    { routing: "orthogonal" | "bundled" | "curved" (default DEFAULT_ROUTING),
 *                                styles: the sidecar's group styles, for which captions carry an icon }
 * @returns {{positions: Object, sizes: Object, frames: Object,
 *            edges: Array, canvas: [number, number]}}
 */
export function layout(doc, catalogue, options = {}) {
  const nodes = doc && Array.isArray(doc.nodes) ? doc.nodes : [];
  const edges = doc && Array.isArray(doc.edges) ? doc.edges : [];
  const groups = doc && Array.isArray(doc.groups) ? doc.groups : [];
  // A frame is as wide as its caption needs, and its label strip as tall (geometry.js).
  const captions = frameCaptions({ groups }, catalogue ?? null, options?.styles ?? null);

  const box = new Map(); // insertion order = node document order
  for (const n of nodes) {
    // Sized for the two lines the box shows (nodeLines: the label or proper name, over the
    // proper name or the kind), by the one measure the canvas and the renderer fit them with.
    const l = nodeLines(catalogue ?? {}, n);
    // A referencing node's second line keeps clear of its link disc (REF_CLEAR), and so does a
    // subsystem box's, which carries the disc before it references anything.
    box.set(n.id, [0, 0, nodeWidth(l.name, l.sub, hasRefDisc(catalogue ?? {}, n)), BOX_H]);
  }

  // The group tree. A parent that is missing, or that would close a cycle, leaves the group
  // top-level; a member of a missing group is ungrouped (invalid designs only).
  const declared = new Map();
  for (const g of groups) if (!declared.has(g.id)) declared.set(g.id, g);
  const declaredParent = (gid) => {
    const p = declared.get(gid)?.parent;
    return present(p) && declared.has(p) ? p : null;
  };
  const parentOf = new Map();
  for (const gid of declared.keys()) {
    let p = declaredParent(gid);
    const seen = new Set([gid]);
    for (let q = p; q !== null; q = declaredParent(q)) {
      if (seen.has(q)) {
        p = null;
        break;
      }
      seen.add(q);
    }
    parentOf.set(gid, p);
  }
  // every node's enclosing groups, innermost first
  const chainOf = new Map();
  for (const n of nodes) {
    const chain = [];
    for (let g = present(n.group) && declared.has(n.group) ? n.group : null; g !== null; ) {
      chain.push(g);
      g = parentOf.get(g);
    }
    chainOf.set(n.id, chain);
  }
  // A group as an edge end: the group itself, then its ancestors, outermost last.
  const groupChain = (gid) => {
    const chain = [];
    for (let g = gid; g !== null; g = parentOf.get(g)) chain.push(g);
    return chain;
  };
  // the item a node (or, for an edge end naming a group, that group) falls in at the level of
  // group `gid` (null: the root level), or null
  const itemAt = (nid, gid) => {
    const chain = chainOf.get(nid);
    if (!chain) {
      if (!declared.has(nid)) return null; // an edge to a node that does not exist
      const own = groupChain(nid);
      const k = gid === null ? own.length : own.indexOf(gid);
      // k === 0: the level is the group itself, so the end is not one of its items
      return k <= 0 ? null : `g:${own[k - 1]}`;
    }
    const k = gid === null ? chain.length : chain.indexOf(gid);
    if (k < 0) return null;
    return k === 0 ? `n:${nid}` : `g:${chain[k - 1]}`;
  };
  const docIndex = new Map(nodes.map((n, k) => [n.id, k]));

  // every item's flow over the nodes it contains: {min, sum, n}
  const flow = new Map();
  const addFlow = (key, f) => {
    const cur = flow.get(key);
    if (!cur) flow.set(key, { min: f, sum: f, n: 1 });
    else {
      cur.min = Math.min(cur.min, f);
      cur.sum += f;
      cur.n++;
    }
  };
  for (const n of nodes) {
    if (flow.has(`n:${n.id}`)) continue; // a duplicate id: the first declaration counts
    const f = flowIndex(catalogue, n.component);
    addFlow(`n:${n.id}`, f);
    for (const g of chainOf.get(n.id)) addFlow(`g:${g}`, f);
  }
  const flowOf = (key) => flow.get(key) ?? { min: FLOW_CUSTOM, sum: FLOW_CUSTOM, n: 1 };

  // Lay a level out: every item's position relative to the level's top-left corner, and the
  // level's content size. Child groups are laid out first, so each is a block of known size.
  const rel = new Map(); // "n:<id>" | "g:<id>" -> [x, y] inside the enclosing level
  const block = new Map(); // gid -> {w, h, items}
  const layLevel = (gid) => {
    const items = [],
      first = new Map(); // item -> the smallest document index of a node inside it
    for (const n of nodes) {
      if (chainOf.get(n.id)[0] !== (gid === null ? undefined : gid) || first.has(`n:${n.id}`))
        continue;
      const b = box.get(n.id);
      items.push({ id: `n:${n.id}`, w: b[2], h: b[3] });
      first.set(`n:${n.id}`, docIndex.get(n.id));
    }
    for (const [g, p] of parentOf) {
      if (p !== gid) continue;
      const inner = layLevel(g);
      if (!inner) continue; // an empty group gets no block and no frame
      // The block is the frame around the level's content, which sits at (0, 0) inside it.
      const [fx, fy, w, h] = frameAround(0, 0, inner.width, inner.height, captions[g] ?? null);
      block.set(g, { w, h, dx: -fx, dy: -fy, items: inner.items });
      items.push({ id: `g:${g}`, w, h });
      first.set(`g:${g}`, inner.first);
    }
    if (!items.length) return null;
    items.sort((a, b) => first.get(a.id) - first.get(b.id)); // stable
    const here = new Set(items.map((it) => it.id));
    const contracted = [];
    for (const e of edges) {
      // A module end ranks as its node; an in-process edge then falls inside one item.
      const a = itemAt(endNode(e?.from), gid),
        b = itemAt(endNode(e?.to), gid);
      if (!here.has(a) || !here.has(b) || a === b) continue; // elsewhere, or inside one item
      contracted.push({ from: a, to: b });
    }
    const placed = placeLevel(items, contracted, orientReciprocal(contracted, flowOf));
    for (const it of items) rel.set(it.id, placed.pos.get(it.id));
    return {
      width: placed.width,
      height: placed.height,
      first: Math.min(...items.map((it) => first.get(it.id))),
      items: items.map((it) => it.id),
    };
  };
  const root = layLevel(null);

  // Absolute placement, top down: a block's items sit inside its padding.
  const frame = new Map();
  const place = (keys, ox, oy) => {
    for (const k of keys) {
      const [x, y] = rel.get(k);
      if (k.startsWith("n:")) {
        const b = box.get(k.slice(2));
        b[0] = ox + x;
        b[1] = oy + y;
      } else {
        const g = block.get(k.slice(2));
        frame.set(k.slice(2), [ox + x, oy + y, g.w, g.h]);
        place(g.items, ox + x + g.dx, oy + y + g.dy);
      }
    }
  };
  if (root) place(root.items, CANVAS_PAD_X / 2, CANVAS_PAD_Y);
  const canvasW = (root ? root.width : 0) + CANVAS_PAD_X;
  const canvasH = (root ? root.height : 0) + 2 * CANVAS_PAD_Y;

  // edges: drawn by geometry.js, the one implementation the canvas and the drawn layout share,
  // so an arrangement and a drawing route their edges, lanes and bends identically
  const boxes = {};
  for (const [id, b] of box) boxes[id] = b; // node declaration order: the first obstacle wins
  const frameBoxes = {};
  for (const [gid, f] of frame) frameBoxes[gid] = f;
  const outEdges = edgeGeometry({ edges }, boxes, {}, {}, frameBoxes, {
    routing: options?.routing ?? DEFAULT_ROUTING,
    captions,
    stacked: stackedIds(doc, catalogue),
  });

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
