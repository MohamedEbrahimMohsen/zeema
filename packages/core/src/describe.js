// Plain English for a rule: one description, used by the catalogue reference pages and by the
// markdown those pages also serve. There is one renderer of the predicate vocabulary and it lives
// here, beside the evaluator that defines it.
//
// The phrasing follows `evalPred` and `scalarTest` in rules.js exactly, including their order of
// precedence (exists, then in, then gt, then lt, then equals), so the sentence says what the
// engine actually tests and not what the field names suggest.
//
// A predicate this file does not know throws. Callers that must not fail (a page) catch it and
// fall back to the raw YAML; the test suite lets it throw, which is how an added predicate is
// found the day it is added rather than the day someone reads a wrong sentence.
//
// DOM free, fs free, no imports.

const list = (v) => (Array.isArray(v) ? v : [v]);

/** "a, b or c" / "a and b" */
function join(items, conj) {
  const a = items.map(String);
  if (a.length <= 1) return a[0] ?? "";
  return `${a.slice(0, -1).join(", ")} ${conj} ${a[a.length - 1]}`;
}

/** "a queue" / "an app-server": the list is read aloud, so the article follows the first sound. */
function an(word) {
  return /^[aeiou]/i.test(String(word)) ? `an ${word}` : `a ${word}`;
}

function scalar(v) {
  if (typeof v === "string") return `"${v}"`;
  return String(v);
}

/** The comparison objects ({eq}|{gt}|{lt}) shared by hasEdge.count, inGroup.count, nfr and syncChainDepth. */
function comparison(c) {
  if (c.eq !== undefined) return `exactly ${c.eq}`;
  if (c.gt !== undefined) return `more than ${c.gt}`;
  if (c.lt !== undefined) return `fewer than ${c.lt}`;
  throw new Error(`describeRule: empty comparison ${JSON.stringify(c)}`);
}

/**
 * The scalar half of a predicate, phrased as a verb clause about `subject`.
 * Mirrors scalarTest: exists, then in, then gt, then lt, then equals.
 */
function scalarClause(p, subject) {
  if (p.exists !== undefined)
    return p.exists ? `${subject} has a value` : `${subject} has no value`;
  if (p.in) return `${subject} is one of ${join(p.in.map(scalar), "or")}`;
  if (p.gt !== undefined) return `${subject} is a number greater than ${p.gt}`;
  if (p.lt !== undefined) return `${subject} is a number less than ${p.lt}`;
  if (p.equals !== undefined) return `${subject} is ${scalar(p.equals)}`;
  return `${subject} is undefined`; // scalarTest's fall-through: `equals` absent means equals undefined
}

function leaf(text) {
  return { op: "leaf", text };
}

function describePredicate(p) {
  if (!p || typeof p !== "object")
    throw new Error(`describeRule: not a predicate: ${JSON.stringify(p)}`);
  if (p.all)
    return { op: "all", text: "all of these hold", children: p.all.map(describePredicate) };
  if (p.any)
    return { op: "any", text: "any of these hold", children: p.any.map(describePredicate) };
  if (p.not) return { op: "not", text: "this does not hold", children: [describePredicate(p.not)] };
  if (p.prop) return leaf(scalarClause(p, `the node's \`${p.prop}\``));
  if (p.field) return leaf(scalarClause(p, `the edge's \`${p.field}\``));
  if (p.requirement) return leaf(scalarClause(p, `the design requirement \`${p.requirement}\``));
  if (p.nfr) {
    const [k, c] = Object.entries(p.nfr)[0];
    const name =
      k === "rps"
        ? "declared requests per second"
        : k === "latencyP95Ms"
          ? "declared p95 latency in milliseconds"
          : `declared ${k}`;
    return leaf(`the node's ${name} is ${comparison(c)}`);
  }
  if (p.hasEdge) {
    const h = p.hasEdge;
    const dir =
      h.direction === "in" ? "incoming" : h.direction === "out" ? "outgoing" : "connected";
    const mode = h.mode ? (h.mode === "sync" ? " synchronous" : " asynchronous") : "";
    const tail = [];
    if (h.delivery) tail.push(`delivering ${h.delivery}`);
    if (h.peerKind) {
      const l = list(h.peerKind);
      const peers = join([an(l[0]), ...l.slice(1)], "or");
      tail.push(
        h.direction === "in"
          ? `from ${peers}`
          : h.direction === "out"
            ? `to ${peers}`
            : `joining ${peers}`,
      );
    }
    if (h.peerCategory)
      tail.push(`whose other end is in category ${join(list(h.peerCategory), "or")}`);
    const suffix = tail.length ? ` ${tail.join(", ")}` : "";
    const count = h.count ? comparison(h.count) : "at least one";
    return leaf(`the node has ${count}${mode} ${dir} edge${suffix}`);
  }
  if (p.hasNode) {
    const bits = [];
    if (p.hasNode.kind) bits.push(`of kind ${join(list(p.hasNode.kind), "or")}`);
    if (p.hasNode.category) bits.push(`in category ${join(list(p.hasNode.category), "or")}`);
    return leaf(`the design contains a node ${bits.join(" ")}`.trim());
  }
  if (p.inGroup) {
    const n = p.inGroup.count ? comparison(p.inGroup.count) : "at least one";
    return leaf(`the node sits inside ${n} ${p.inGroup.kind} boundary`);
  }
  if (p.syncChainDepth)
    return leaf(
      `the longest chain of synchronous calls starting at the node is ${comparison(p.syncChainDepth)} hops long`,
    );
  if (p.from)
    return { op: "from", text: "the edge's source node", children: [describePredicate(p.from)] };
  if (p.to)
    return { op: "to", text: "the edge's target node", children: [describePredicate(p.to)] };
  if (p.crossesGroup)
    return leaf(
      `the edge crosses a ${p.crossesGroup.kind} boundary, or at least one end is in no ${p.crossesGroup.kind} at all`,
    );
  throw new Error(`describeRule: unknown predicate ${JSON.stringify(p)}`);
}

/** The subject a rule selects, in plain English, with the kinds and categories it names. */
export function describeSelect(select) {
  const s = select ?? {};
  if (s.design) return { subject: "design", kinds: [], categories: [], text: "every design" };
  if (s.edge) {
    const bits = [];
    if (s.edge.mode) bits.push(s.edge.mode === "sync" ? "synchronous" : "asynchronous");
    const tail = s.edge.delivery ? ` declaring ${s.edge.delivery} delivery` : "";
    return {
      subject: "edge",
      kinds: [],
      categories: [],
      text: `every ${bits.join(" ")}${bits.length ? " " : ""}edge${tail}`,
    };
  }
  if (s.node) {
    const kinds = s.node.kind ? list(s.node.kind) : [];
    const categories = s.node.category ? list(s.node.category) : [];
    const bits = [];
    if (kinds.length) bits.push(`of kind ${join(kinds, "or")}`);
    if (categories.length) bits.push(`in category ${join(categories, "or")}`);
    return { subject: "node", kinds, categories, text: `every node ${bits.join(" ")}`.trim() };
  }
  return { subject: "design", kinds: [], categories: [], text: "every design" };
}

/**
 * A rule as prose. `locale` is the catalogue locale (the whole object, or just its `rules` map).
 * -> { id, severity, name, description, rationale, message, select, when }
 * `when` is a tree of { op, text, children? }, leaves carrying the finished sentence.
 * Throws on a predicate it cannot phrase.
 */
export function describeRule(rule, locale) {
  const rules = locale?.rules ?? locale ?? {};
  const t = rules[rule.id] ?? {};
  return {
    id: rule.id,
    severity: rule.severity,
    name: t.name ?? rule.id,
    description: t.description,
    rationale: t.rationale,
    message: rule.message,
    select: describeSelect(rule.select),
    when: describePredicate(rule.when),
  };
}

/** The `when` tree flattened to indented lines, for markdown and for plain text. */
export function describeLines(node, depth = 0) {
  const pad = "  ".repeat(depth);
  if (node.op === "leaf") return [`${pad}- ${node.text}`];
  return [
    `${pad}- ${node.text}:`,
    ...(node.children ?? []).flatMap((c) => describeLines(c, depth + 1)),
  ];
}

/* ------------------------------------------------------------------------ what a rule reads */

const add = (arr, v) => {
  for (const x of list(v)) if (x !== undefined && x !== null && !arr.includes(x)) arr.push(x);
};

/**
 * @typedef {{
 *   fields: string[], directions: string[], modes: string[], deliveries: string[],
 *   peerKinds: string[], peerCategories: string[], crossesGroupKinds: string[],
 * }} RuleEdgeReads
 * @typedef {{
 *   requirements: string[], props: string[], nodeKinds: string[], nodeCategories: string[],
 *   edge: RuleEdgeReads | null,
 * }} RuleReads
 */

/**
 * Everything a rule's `when` tree reads, so an editor can point at it.
 * -> {
 *      requirements: string[],      // every `requirement: "<path>"`
 *      props: string[],             // every `prop: "<name>"`, including under from/to
 *      nodeKinds: string[],         // every `hasNode.kind`
 *      nodeCategories: string[],    // every `hasNode.category`
 *      edge: null | {               // null when the rule reads nothing about an edge
 *        fields, directions, modes, deliveries, peerKinds, peerCategories, crossesGroupKinds
 *      },
 *    }
 * Every list is deduplicated and sorted, so the answer is a function of the rule and not of the
 * order the tree happens to be written in.
 *
 * The vocabulary is the one `evalPred` in rules.js evaluates and `describePredicate` above
 * phrases; an unknown predicate throws here too, so a predicate added to the schema is found the
 * day it is added rather than the day a field silently stops being highlighted.
 *
 * @param {any} rule
 * @returns {RuleReads}
 */
export function ruleReads(rule) {
  /** @type {RuleReads} */
  const out = { requirements: [], props: [], nodeKinds: [], nodeCategories: [], edge: null };
  const onEdge = () => {
    if (!out.edge)
      out.edge = {
        fields: [],
        directions: [],
        modes: [],
        deliveries: [],
        peerKinds: [],
        peerCategories: [],
        crossesGroupKinds: [],
      };
    return out.edge;
  };
  const walk = (p) => {
    if (!p || typeof p !== "object")
      throw new Error(`ruleReads: not a predicate: ${JSON.stringify(p)}`);
    if (p.all) return void p.all.forEach(walk);
    if (p.any) return void p.any.forEach(walk);
    if (p.not) return void walk(p.not);
    if (p.prop) return void add(out.props, p.prop);
    if (p.field) return void add(onEdge().fields, p.field);
    if (p.requirement) return void add(out.requirements, p.requirement);
    if (p.nfr) return; // a declared number on the node, not a field of the design or a property
    if (p.hasEdge) {
      const e = onEdge();
      add(e.directions, p.hasEdge.direction ?? "out");
      if (p.hasEdge.mode) add(e.modes, p.hasEdge.mode);
      if (p.hasEdge.delivery) add(e.deliveries, p.hasEdge.delivery);
      if (p.hasEdge.peerKind) add(e.peerKinds, p.hasEdge.peerKind);
      if (p.hasEdge.peerCategory) add(e.peerCategories, p.hasEdge.peerCategory);
      return;
    }
    if (p.hasNode) {
      if (p.hasNode.kind) add(out.nodeKinds, p.hasNode.kind);
      if (p.hasNode.category) add(out.nodeCategories, p.hasNode.category);
      return;
    }
    if (p.inGroup) return; // a boundary, which the inspector offers as the node's group
    if (p.syncChainDepth) return; // a property of the graph, not of any one field
    if (p.from) return void walk(p.from);
    if (p.to) return void walk(p.to);
    if (p.crossesGroup) return void add(onEdge().crossesGroupKinds, p.crossesGroup.kind);
    throw new Error(`ruleReads: unknown predicate ${JSON.stringify(p)}`);
  };
  walk(rule?.when);
  out.requirements.sort();
  out.props.sort();
  out.nodeKinds.sort();
  out.nodeCategories.sort();
  if (out.edge) for (const k of Object.keys(out.edge)) out.edge[k].sort();
  return out;
}
