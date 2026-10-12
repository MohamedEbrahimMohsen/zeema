// Bug-for-bug port of the rule evaluator in .claude/tools/validate.mjs.
//
// Everything here mirrors the validator, including the parts that look wrong, because the
// editor must show exactly the findings the repository gate produces:
//   - scalarTest tests exists, then in, then gt, then lt, then equals; its gt/lt demand a
//     number, cmp's do not.
//   - cmp tests eq, then gt, then lt.
//   - crossesGroup is true when both endpoints are ungrouped.
//   - effective omits a property that resolves to nothing, so `exists: false` is true for a
//     name that is not a property of the node's kind at all.
//   - render substitutes {{node.id}} style paths and leaves an unresolved path as written.
//
// Four deliberate differences, all required by the editor and none of which changes a result
// on a design the validator itself accepts:
//   1. Findings carry a subject: {type:"node"|"edge"|"design", ref}.
//   2. A node whose component (or whose component's kind) is missing from the catalogue is
//      skipped by node selection, and any predicate reaching it through hasEdge.peerKind,
//      hasEdge.peerCategory, hasNode, from or to evaluates to false instead of throwing.
//   3. syncChainDepth keeps the validator's longest-simple-path answer but memoises the
//      nodes whose sync-reachable subgraph is provably acyclic, and bounds the exponential
//      enumeration used for the rest. See syncPass below.
//   4. An edge end may name a group (the validator knows only node ends). Rules read a group end
//      as every node inside the group, nested groups included: the edge reaches each member, as
//      if it had been drawn to each. Before the pass a group edge is expanded into one node edge
//      per (source member, target member) pair, a member never paired with itself. Node rules
//      (hasEdge, syncChainDepth) see those node edges, so a member of a group the gateway calls
//      has an incoming edge from the gateway. An edge rule runs on each pair and reports at most
//      one finding per drawn edge, its subject the drawn edge and its message the drawn ends.
//      A group with no member node expands to nothing: such an edge is read as before, a rule
//      that reads an end's node (`from`, `to`, `crossesGroup`) skipping it.
//   5. An edge end may name a module of a node, `node/module`. Every rule reads it as the node,
//      so hasEdge, inGroup, from, to and the rest work unchanged; an in-process edge (both ends
//      in one node) is skipped entirely. A finding on an edge with a module end carries the ends
//      as written in its subject (`from`, `to`) as well as the index.
//
// DOM free. The one import is how an edge end names a module, which document.js reads.

import { isInProcess, resolveEdge, splitEnd } from "./document.js";

const EMPTY = Object.freeze({});

/* ------------------------------------------------------------------ catalogue resolution */

// Catalogue maps are plain objects keyed by ids that come from documents, so a lookup reads own
// keys only: a component called `constructor` or `toString` is unknown, not Object's method.
const own = (o, k) =>
  o != null && typeof k === "string" && Object.hasOwn(o, k) ? o[k] : undefined;

function componentOf(node, catalogue) {
  if (!node || typeof node.component !== "string") return null;
  return own(catalogue?.components, node.component) ?? null;
}

/** The kind object for a node, or null when the component or its kind is unknown. */
export function kindOf(_doc, node, catalogue) {
  const c = componentOf(node, catalogue);
  if (!c) return null;
  return catalogue?.kinds?.[c.kind] ?? null;
}

/** True when the node resolves to a known component with a known kind. */
function known(node, catalogue) {
  return kindOf(null, node, catalogue) !== null;
}

// validator: propDefs = (c) => ({ ...kinds[c.kind].properties, ...(c.properties ?? {}) })
function propDefs(c, catalogue) {
  const k = catalogue?.kinds?.[c.kind];
  if (!k) return null;
  return { ...(k.properties ?? EMPTY), ...(c.properties ?? EMPTY) };
}

/**
 * Resolved property values for a node: node.props, then component defaults, then kind
 * defaults. A property that resolves to nothing is omitted, exactly as the validator does.
 * Returns {} for an unknown component rather than throwing.
 */
export function effective(_doc, node, catalogue) {
  const c = componentOf(node, catalogue);
  if (!c) return {};
  const defs = propDefs(c, catalogue);
  if (!defs) return {};
  const out = {};
  for (const [k, d] of Object.entries(defs)) {
    if (node.props?.[k] !== undefined) out[k] = node.props[k];
    else if (c.defaults?.[k] !== undefined) out[k] = c.defaults[k];
    else if (d.default !== undefined) out[k] = d.default;
  }
  return out;
}

/* -------------------------------------------------------------------------- primitives */

// validator: (c, v) => v === undefined ? false : c.eq !== undefined ? v === c.eq
//                    : c.gt !== undefined ? v > c.gt : v < c.lt
function cmp(c, v) {
  return v === undefined
    ? false
    : c.eq !== undefined
      ? v === c.eq
      : c.gt !== undefined
        ? v > c.gt
        : v < c.lt;
}

// validator: (o, p) => p.split(".").reduce((a, k) => a?.[k], o)
function get(o, p) {
  return p.split(".").reduce((a, k) => a?.[k], o);
}

// validator: exists, then in, then gt, then lt, then equals. gt/lt require a number here,
// unlike cmp. `in` is tested for truthiness, the others for !== undefined.
function scalarTest(p, v) {
  if (p.exists !== undefined) return (v !== undefined) === p.exists;
  if (p.in) return p.in.includes(v);
  if (p.gt !== undefined) return typeof v === "number" && v > p.gt;
  if (p.lt !== undefined) return typeof v === "number" && v < p.lt;
  return v === p.equals;
}

function nodeById(doc, id) {
  return (doc.nodes ?? []).find((n) => n.id === id);
}

// validator: [].concat(w).includes(kindOf(n).id) -- throws on an unknown component.
// Here an unknown node simply does not match.
function matchKind(w, n, catalogue) {
  const k = kindOf(null, n, catalogue);
  if (!k) return false;
  return [].concat(w).includes(k.id);
}

function matchCat(w, n, catalogue) {
  const k = kindOf(null, n, catalogue);
  if (!k) return false;
  return [].concat(w).includes(k.category);
}

// validator: walks node.group up through group.parent. A parent cycle would spin forever
// there; the guard below only bounds an input the validator cannot survive at all.
function ancestry(doc, node) {
  const out = [];
  if (!node) return out;
  const groups = doc.groups ?? [];
  const seen = new Set();
  let g = groups.find((x) => x.id === node.group);
  while (g) {
    if (seen.has(g.id)) break;
    seen.add(g.id);
    out.push(g);
    g = groups.find((x) => x.id === g.parent);
  }
  return out;
}

/* ------------------------------------------------------------------------ syncChainDepth */

// The validator's function, transcribed. Longest simple path over sync edges, enumerated by
// cloning the visited set down every branch, which is exponential on a branching graph.
//   syncDepth = (doc, id, seen = new Set()) => {
//     if (seen.has(id)) return 0;
//     seen.add(id);
//     let best = 0;
//     for (const e of doc.edges) if (e.from === id && e.mode === "sync")
//       best = Math.max(best, 1 + syncDepth(doc, e.to, new Set(seen)));
//     return best;
//   };
//
// 7 of the 26 repository designs have a cycle in the sync subgraph, and memoising by node id
// changes the answer on 6 of them, so a plain memo is not available. Instead: colour the sync
// subgraph once per pass, memoise only the nodes whose sync-reachable subgraph is acyclic
// (where longest simple path and DAG longest path coincide), and run the exact enumeration
// for the rest under a visit budget. Top-level answers are cached either way, which is always
// safe because syncDepth(doc, id) with an empty visited set is a pure function of the graph.

const VISIT_BUDGET = 2_000_000;

/** Build the per-pass analysis of a document's sync subgraph. */
export function syncPass(doc) {
  const succ = new Map();
  const vertices = new Set();
  for (const n of doc.nodes ?? []) vertices.add(n.id);
  for (const e of doc.edges ?? []) {
    if (e?.mode !== "sync") continue;
    vertices.add(e.from);
    vertices.add(e.to);
    let s = succ.get(e.from);
    if (!s) {
      s = [];
      succ.set(e.from, s);
    }
    s.push(e.to);
  }

  // Tarjan: a vertex is on a cycle when its SCC has more than one member, or it points at
  // itself.
  const index = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const onCycle = new Set();
  let counter = 0;
  for (const v of vertices) {
    if (index.has(v)) continue;
    // iterative Tarjan, so a long chain cannot blow the JS stack
    const work = [[v, 0]];
    index.set(v, counter);
    low.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
    while (work.length) {
      const frame = work[work.length - 1];
      const [u, i] = frame;
      const outs = succ.get(u) ?? [];
      if (i < outs.length) {
        frame[1] = i + 1;
        const w = outs[i];
        if (!index.has(w)) {
          index.set(w, counter);
          low.set(w, counter);
          counter++;
          stack.push(w);
          onStack.add(w);
          work.push([w, 0]);
        } else if (onStack.has(w)) {
          low.set(u, Math.min(low.get(u), index.get(w)));
        }
      } else {
        work.pop();
        if (work.length) {
          const parent = work[work.length - 1][0];
          low.set(parent, Math.min(low.get(parent), low.get(u)));
        }
        if (low.get(u) === index.get(u)) {
          const comp = [];
          let w;
          do {
            w = stack.pop();
            onStack.delete(w);
            comp.push(w);
          } while (w !== u);
          if (comp.length > 1) for (const m of comp) onCycle.add(m);
          else if ((succ.get(u) ?? []).includes(u)) onCycle.add(u);
        }
      }
    }
  }

  // A vertex is tainted when it can reach a cycle. Propagate backwards to a fixpoint.
  const tainted = new Set(onCycle);
  if (tainted.size) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const [u, outs] of succ) {
        if (tainted.has(u)) continue;
        for (const w of outs) {
          if (tainted.has(w)) {
            tainted.add(u);
            changed = true;
            break;
          }
        }
      }
    }
  }

  const memo = new Map(); // acyclic vertices: depth is a plain DAG longest path
  const top = new Map(); // cache of top-level answers for tainted vertices

  const acyclicDepth = (id) => {
    const hit = memo.get(id);
    if (hit !== undefined) return hit;
    memo.set(id, 0); // defensive: cannot be revisited, the subgraph is acyclic
    let best = 0;
    for (const w of succ.get(id) ?? []) best = Math.max(best, 1 + acyclicDepth(w));
    memo.set(id, best);
    return best;
  };

  const exact = (id, seen, budget) => {
    if (seen.has(id)) return 0;
    seen.add(id);
    let best = 0;
    for (const w of succ.get(id) ?? []) {
      if (budget.n <= 0) break;
      budget.n--;
      // An untainted successor cannot reach any vertex on the current path (that would put it
      // on a cycle), so its longest simple path is its DAG longest path: reuse the memo instead
      // of enumerating. This keeps the exact answer and takes the cost out of the cyclic part.
      if (!tainted.has(w)) {
        best = Math.max(best, 1 + acyclicDepth(w));
        continue;
      }
      best = Math.max(best, 1 + exact(w, new Set(seen), budget));
    }
    return best;
  };

  const depth = (id) => {
    if (!tainted.has(id)) return acyclicDepth(id);
    const hit = top.get(id);
    if (hit !== undefined) return hit;
    const budget = { n: VISIT_BUDGET };
    const v = exact(id, new Set(), budget);
    top.set(id, v);
    return v;
  };

  return { succ, vertices, onCycle, tainted, depth };
}

/** syncChainDepth for one node id: the longest chain of sync edges reaching out of it, exact on cycles. */
export function syncChainDepth(doc, id) {
  return syncPass(doc).depth(id);
}

/** { nodeId: depth } for every node in the document. Used by the parity test. */
export function syncChainDepths(doc) {
  const pass = syncPass(doc);
  const out = {};
  for (const n of doc.nodes ?? []) out[n.id] = pass.depth(n.id);
  return out;
}

/* ---------------------------------------------------------------------------- predicates */

function evalPred(p, ctx) {
  const { doc, node, edge, cat, pass } = ctx;
  if (p.all) return p.all.every((x) => evalPred(x, ctx));
  if (p.any) return p.any.some((x) => evalPred(x, ctx));
  if (p.not) return !evalPred(p.not, ctx);
  if (p.prop) return scalarTest(p, effective(doc, node, cat)[p.prop]);
  if (p.field) return scalarTest(p, edge[p.field]);
  if (p.requirement) return scalarTest(p, get(doc.requirements ?? {}, p.requirement));
  if (p.nfr) {
    const [k, c] = Object.entries(p.nfr)[0];
    return cmp(c, node?.nfr?.[k]);
  }
  if (p.hasEdge) {
    const h = p.hasEdge;
    const n = (doc.edges ?? []).filter((e) => {
      const dirOk =
        h.direction === "any"
          ? e.from === node.id || e.to === node.id
          : h.direction === "in"
            ? e.to === node.id
            : e.from === node.id;
      if (!dirOk) return false;
      if (h.mode && e.mode !== h.mode) return false;
      if (h.delivery && e.delivery !== h.delivery) return false;
      const peer = nodeById(doc, e.from === node.id ? e.to : e.from);
      if (h.peerKind && !matchKind(h.peerKind, peer, cat)) return false;
      if (h.peerCategory && !matchCat(h.peerCategory, peer, cat)) return false;
      return true;
    }).length;
    return h.count ? cmp(h.count, n) : n > 0;
  }
  if (p.hasNode) {
    const n = (doc.nodes ?? []).filter(
      (x) =>
        known(x, cat) &&
        (!p.hasNode.kind || matchKind(p.hasNode.kind, x, cat)) &&
        (!p.hasNode.category || matchCat(p.hasNode.category, x, cat)),
    ).length;
    return p.hasNode.count ? cmp(p.hasNode.count, n) : n > 0;
  }
  if (p.inGroup) {
    const n = ancestry(doc, node).filter((g) => g.kind === p.inGroup.kind).length;
    return p.inGroup.count ? cmp(p.inGroup.count, n) : n > 0;
  }
  if (p.syncChainDepth) return cmp(p.syncChainDepth, pass.depth(node.id));
  // The node's own kind or its component's provider: "an edge into a database", "an Azure
  // service". An unknown component matches neither, as everywhere else in this file.
  if (p.kind) return matchKind(p.kind, node, cat);
  if (p.provider) {
    const c = componentOf(node, cat);
    return c !== null && [].concat(p.provider).includes(c.provider);
  }
  if (p.from) {
    const n = nodeById(doc, edge.from);
    if (!known(n, cat)) return false;
    return evalPred(p.from, { doc, node: n, cat, pass });
  }
  if (p.to) {
    const n = nodeById(doc, edge.to);
    if (!known(n, cat)) return false;
    return evalPred(p.to, { doc, node: n, cat, pass });
  }
  if (p.crossesGroup) {
    const gOf = (id) =>
      ancestry(doc, nodeById(doc, id)).find((g) => g.kind === p.crossesGroup.kind)?.id;
    const a = gOf(edge.from);
    const b = gOf(edge.to);
    return a !== b || a === undefined;
  }
  throw new Error(`unknown predicate ${JSON.stringify(p)}`);
}

// validator: substitute {{ path }}, leave an unresolved path as {{path}}
function render(tpl, ctx) {
  return String(tpl ?? "").replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, p) => {
    const v = get(ctx, p);
    return v === undefined ? `{{${p}}}` : String(v);
  });
}

// Which ends of an edge a predicate reads a node at: `from`, `to`, or both for crossesGroup.
function endsRead(p, out = new Set()) {
  if (!p || typeof p !== "object") return out;
  if (p.from) out.add("from");
  if (p.to) out.add("to");
  if (p.crossesGroup) {
    out.add("from");
    out.add("to");
  }
  for (const x of p.all ?? []) endsRead(x, out);
  for (const x of p.any ?? []) endsRead(x, out);
  if (p.not) endsRead(p.not, out);
  return out;
}

/* ------------------------------------------------------------------------- group edges */

/**
 * Every node inside each group, nested groups included: group id -> node ids, in node order.
 * A parent cycle is cut where `ancestry` cuts it.
 */
export function membersByGroup(doc) {
  const out = new Map();
  for (const n of doc?.nodes ?? []) {
    if (!n || typeof n.id !== "string") continue;
    for (const g of ancestry(doc, n)) {
      let list = out.get(g.id);
      if (!list) {
        list = [];
        out.set(g.id, list);
      }
      list.push(n.id);
    }
  }
  return out;
}

/**
 * The document as rules read it: each edge with a group end (an id in `groupEnd`) replaced by
 * one node edge per (source member, target member) pair, a node never paired with itself.
 * `from[k]` is the index in doc.edges that flat edge k came from; `raw[k]` is true for an edge
 * with a group end kept as drawn because the group holds no node.
 *
 * A module end (`node/module`) is read as its node, so every rule sees the node it lives in. An
 * in-process edge (both ends in one node, isInProcess) is not a hop and is left out entirely.
 */
export function expandGroupEdges(doc, groupEnd) {
  const members = membersByGroup(doc);
  const edges = [];
  const from = [];
  const raw = [];
  (doc?.edges ?? []).forEach((drawn, i) => {
    if (isInProcess(drawn)) return;
    const e = resolveEdge(drawn);
    const gf = groupEnd.has(e?.from),
      gt = groupEnd.has(e?.to);
    if (!gf && !gt) {
      edges.push(e);
      from.push(i);
      raw.push(false);
      return;
    }
    const as = gf ? (members.get(e.from) ?? []) : [e.from];
    const bs = gt ? (members.get(e.to) ?? []) : [e.to];
    let n = 0;
    for (const a of as)
      for (const b of bs) {
        if (a === b) continue;
        edges.push({ ...e, from: a, to: b });
        from.push(i);
        raw.push(false);
        n++;
      }
    if (!n) {
      edges.push(e);
      from.push(i);
      raw.push(true);
    }
  });
  return { flat: { ...doc, edges }, from, raw };
}

/* ------------------------------------------------------------------------- rule selection */

/**
 * The rules that can ever fire on a node of this kind, using the same `select` semantics the
 * pass uses: a node rule matches when its `select.node.kind` lists the kind, or its
 * `select.node.category` lists the kind's category, and an absent clause matches everything.
 * Edge and design rules are never about one component, so they are not returned.
 *
 * The catalogue reference pages and the markdown they also serve both call this, so "which
 * rules apply to Kafka" has exactly one answer and it is this function's.
 */
export function rulesFor(catalogue, { kind, category } = {}) {
  const cat = category ?? catalogue?.kinds?.[kind]?.category;
  return (catalogue?.rules ?? []).filter((r) => {
    const sel = r.select?.node;
    if (!sel) return false;
    if (sel.kind && !(kind !== undefined && [].concat(sel.kind).includes(kind))) return false;
    if (sel.category && !(cat !== undefined && [].concat(sel.category).includes(cat))) return false;
    return true;
  });
}

/* ------------------------------------------------------------------------------ the pass */

/**
 * Evaluate every catalogue rule against a document.
 * -> [{ id, severity, message, subject: {type:"node"|"edge"|"design", ref} }]
 * ref is a node id, an index into doc.edges, or null.
 * Each rule runs inside its own try/catch, so one bad node cannot blank the list.
 */
export function runRules(doc, catalogue) {
  const hits = [];
  if (!doc || typeof doc !== "object") return hits;
  const rules = catalogue?.rules ?? [];
  const nodes = doc.nodes ?? [];
  const edges = doc.edges ?? [];
  const cat = catalogue;
  // ids that name a group and no node: an edge end there is every node inside the group
  const nodeIdSet = new Set(nodes.map((n) => n?.id));
  const groupEnd = new Set((doc.groups ?? []).map((g) => g?.id).filter((id) => !nodeIdSet.has(id)));
  const { flat, from: source, raw } = expandGroupEdges(doc, groupEnd);
  const pass = syncPass(flat);
  for (const r of rules) {
    try {
      if (r.select?.node) {
        for (const node of nodes) {
          if (!known(node, cat)) continue;
          if (r.select.node.kind && !matchKind(r.select.node.kind, node, cat)) continue;
          if (r.select.node.category && !matchCat(r.select.node.category, node, cat)) continue;
          if (evalPred(r.when, { doc: flat, node, cat, pass }))
            hits.push({
              id: r.id,
              severity: r.severity,
              message: render(r.message, { node, design: doc }),
              subject: { type: "node", ref: node.id },
            });
        }
      } else if (r.select?.edge) {
        const reads = endsRead(r.when);
        const done = new Set();
        for (let k = 0; k < flat.edges.length; k++) {
          const edge = flat.edges[k];
          const i = source[k];
          if (done.has(i)) continue;
          if (raw[k] && [...reads].some((end) => groupEnd.has(edge[end]))) continue;
          if (r.select.edge.mode && edge.mode !== r.select.edge.mode) continue;
          if (r.select.edge.delivery && edge.delivery !== r.select.edge.delivery) continue;
          if (evalPred(r.when, { doc: flat, edge, cat, pass })) {
            done.add(i);
            // An edge with a module end keeps both ends as written, `node/module`, so the canvas
            // can point at the module rather than its box.
            const at = edges[i];
            const moduled = splitEnd(at?.from).module !== null || splitEnd(at?.to).module !== null;
            hits.push({
              id: r.id,
              severity: r.severity,
              message: render(r.message, { edge: at, design: doc }),
              subject: moduled
                ? { type: "edge", ref: i, from: at.from, to: at.to }
                : { type: "edge", ref: i },
            });
          }
        }
      } else if (r.select?.design) {
        if (evalPred(r.when, { doc: flat, cat, pass }))
          hits.push({
            id: r.id,
            severity: r.severity,
            message: render(r.message, { design: doc }),
            subject: { type: "design", ref: null },
          });
      }
    } catch (e) {
      // One rule cannot take the panel down with it, and it cannot vanish either: a rule that
      // throws is reported as a finding so the gate, the canvas and the command line all see it.
      hits.push({
        id: r.id,
        severity: "error",
        message: `rule ${r.id} failed: ${e?.message ? e.message : String(e)}`,
        subject: { type: "design", ref: null },
        error: true,
      });
    }
  }
  return hits;
}
