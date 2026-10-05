// Pure operations on a design document. Every function takes a document and returns a new one;
// nothing here mutates its argument and nothing here touches the DOM. Cascades live here rather
// than in the UI, so deleting a node from a palette drag and deleting it from a keystroke can
// never disagree: an id rewrite fixes edges, ref properties, group membership and parentage in
// one step, and a delete takes its edges with it.

const clone = (x) => JSON.parse(JSON.stringify(x));

export function createDoc(id = "untitled") {
  return { schemaVersion: "1", type: "design", id, nodes: [], edges: [] };
}

// The text a design starts life as, with the schema pointer the repository gate expects. It
// lives here rather than in the UI so the tests author a design through the same door a person
// does, and a change to the template cannot pass a test that used a copy of the old one.
export function newDesignText(id) {
  return [
    "# yaml-language-server: $schema=../../../schema/design.schema.json",
    "# Authored in the Zeema canvas.",
    `schemaVersion: ${JSON.stringify("1")}`,
    `type: ${JSON.stringify("design")}`,
    `id: ${JSON.stringify(id)}`,
    "",
  ].join("\n");
}

// A design read off disk can be wrong in ways the editor cannot draw: a list that parsed as null
// or as a map takes down layout, geometry and every command that iterates it. Coerce those three
// keys to lists before anything touches them, and report what was coerced so the person is told
// rather than left wondering why the file changed under them. Nothing else is repaired here:
// the structural check is what reports the rest, and it can only run on a document it can walk.
export function normalize(doc) {
  const out = clone(doc);
  const repaired = [];
  for (const key of ["nodes", "edges", "groups"]) {
    const v = out[key];
    if (Array.isArray(v)) continue;
    if (v === undefined) {
      if (key === "groups") continue; // groups is genuinely optional
      out[key] = [];
      repaired.push(`${key} was missing and is now an empty list`);
      continue;
    }
    const empty = v === null || (typeof v === "object" && !Object.keys(v).length);
    out[key] = [];
    repaired.push(
      empty ? `${key} was empty and is now an empty list` : `${key} was not a list and was emptied`,
    );
  }
  return { doc: out, repaired };
}

// What a person types, as an id this format accepts. "Azure Function" becomes azure-function,
// so a name typed on the canvas is a legal id rather than a rejection.
export function toId(text) {
  const slug =
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "node";
  return /^[a-z]/.test(slug) ? slug : `n-${slug}`;
}

export function uniqueId(taken, base) {
  const start = toId(base);
  if (!taken.has(start)) return start;
  for (let n = 2; ; n++) if (!taken.has(`${start}-${n}`)) return `${start}-${n}`;
}

// The name a copy of a design gets. Cloning chat-system gives chat-system-copy, then
// chat-system-copy-2, and cloning a copy counts on from the original rather than stacking
// another "copy" on the end. The random form is for when a name does not matter and a
// collision would be annoying: eight characters is enough that two clones never meet.
export function cloneId(id, taken = new Set(), random = false) {
  const base = toId(String(id).replace(/-copy(-\d+)?$/, ""));
  if (random) {
    let suffix;
    do {
      suffix = randomSuffix();
    } while (taken.has(`${base}-${suffix}`));
    return `${base}-${suffix}`;
  }
  if (!taken.has(`${base}-copy`)) return `${base}-copy`;
  for (let n = 2; ; n++) if (!taken.has(`${base}-copy-${n}`)) return `${base}-copy-${n}`;
}

export function randomSuffix(length = 8) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint8Array(length))
    : Array.from({ length }, () => Math.floor(Math.random() * 256));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// What a node is called on the canvas: its own label, else the component's proper name. Never
// the id, which is a key and reads like one. Two instances of Azure Function both say Azure
// Function, because there is one Azure Function and these are two of it.
// Catalogue maps are plain objects keyed by ids that come from documents, so a lookup reads own
// keys only: a component called `constructor` or `toString` is unknown, not Object's method.
const own = (o, k) =>
  o != null && typeof k === "string" && Object.hasOwn(o, k) ? o[k] : undefined;

export function displayName(catalogue, node) {
  if (node.label) return node.label;
  const loc = own(catalogue.locale?.components, node.component);
  return loc?.name || node.component || node.id;
}

// The two lines a node's box shows, and the id behind them: the label over the component's
// proper name when it has a label, else the proper name over its kind's ("Network security
// group" over "Firewall"). The id is never drawn; it is hover text, the Inspector and the YAML.
export function nodeLines(catalogue, node) {
  const kind = own(catalogue.components, node.component)?.kind;
  const sub = node.label
    ? own(catalogue.locale?.components, node.component)?.name || node.component || ""
    : own(catalogue.locale?.kinds, kind)?.name || kind || "";
  return { name: displayName(catalogue, node), sub, id: node.component ?? node.id };
}

// The words a group's frame shows: its label, else its kind's name ("VPC", "Point of presence"),
// never the kind id beside a label. The kind and the id stay in hover text and the Inspector.
export function groupCaption(catalogue, group) {
  if (group.label) return String(group.label);
  return own(catalogue?.locale?.groupKinds, group.kind)?.name || group.kind || group.id;
}

// The frame's hover text: label · kind's name · id, each once (a group with no label is already
// called by its kind).
export function groupTitle(catalogue, group) {
  const kind = own(catalogue?.locale?.groupKinds, group.kind)?.name || group.kind;
  return [...new Set([group.label, kind, group.id].filter(Boolean).map(String))].join(" · ");
}

// The catalogue carries one vendor-neutral component per kind, and the convention that names it
// is that its id is the kind id: `queue` is the generic queue, `kafka` is a product. Readers that
// want to put the generic first ask here rather than re-deriving the convention.
// `custom` fits the id convention but is never generic: generic promises that every rule for the
// kind still applies, and for a custom node no rule applies at all.
export function isGeneric(componentId, kind) {
  return Boolean(componentId) && componentId === kind && kind !== "custom";
}

// An id nobody chose: the component's own id, or that with the counter the editor adds when a
// second one is placed. Those are the only ids the editor is free to rewrite when a name is
// typed, so an id a person set is never renamed behind their back.
export function isGeneratedId(node) {
  if (!node.component) return false;
  const base = toId(node.component);
  return node.id === base || new RegExp(`^${base}-\\d+$`).test(node.id);
}

// Naming a node names it everywhere. While its id is still the generated one, the id follows
// the name, so the file says orders-worker rather than azure-functions-2 and the counter
// disappears as soon as the thing has a name. An id someone typed is left alone.
export function setNodeLabel(doc, id, label, catalogue) {
  const node = doc.nodes.find((n) => n.id === id);
  const next = setNodeField(doc, id, "label", label);
  if (!node || !label || !isGeneratedId(node)) return { doc: next, id };
  const taken = new Set(next.nodes.filter((n) => n.id !== id).map((n) => n.id));
  for (const g of next.groups || []) taken.add(g.id);
  const wanted = uniqueId(taken, label);
  return wanted === id
    ? { doc: next, id }
    : { doc: renameNode(next, id, wanted, catalogue), id: wanted };
}

const nodeIds = (doc) => new Set(doc.nodes.map((n) => n.id));
const groupIds = (doc) => new Set((doc.groups || []).map((g) => g.id));
// An edge end names a node or a group, so the two share one id space: a fresh id of either is
// unique across both.
const allIds = (doc) => new Set([...nodeIds(doc), ...groupIds(doc)]);

export function propDefs(catalogue, componentId) {
  const c = own(catalogue.components, componentId);
  if (!c) return {};
  const k = own(catalogue.kinds, c.kind);
  return { ...(k ? k.properties : {}), ...(c.properties || {}) };
}

// The value a design resolves to: the node's own prop, then the component default, then the
// kind default. A property that resolves to nothing is absent, which is what the rules read.
export function effective(catalogue, node) {
  const c = own(catalogue.components, node.component);
  if (!c) return {};
  const defs = propDefs(catalogue, node.component);
  const out = {};
  for (const [name, def] of Object.entries(defs)) {
    if (node.props && node.props[name] !== undefined) out[name] = node.props[name];
    else if (c.defaults && c.defaults[name] !== undefined) out[name] = c.defaults[name];
    else if (def.default !== undefined) out[name] = def.default;
  }
  return out;
}

// The properties that say "this box is N identical copies", in the order one is read when a node
// somehow carries several: the first one present decides, whatever its value.
export const COUNT_PROPS = ["instances", "replicas", "shards"];

/**
 * How many identical copies a node stands for, when that is two or more: the resolved value of
 * the first of COUNT_PROPS its kind or component defines and the node resolves (effective), else
 * null. Only a real integer counts: a string "3" is not an integer property's value (the
 * structure gate refuses it), so it is null here rather than guessed at. `doc` is unused today;
 * it is in the signature so a later reading can look at the design without every caller changing.
 * @returns {{ count: number, prop: string } | null}
 */
export function nodeCountOf(_doc, node, catalogue) {
  if (!node || !catalogue) return null;
  const props = effective(catalogue, node);
  for (const name of COUNT_PROPS) {
    if (props[name] === undefined) continue;
    const v = props[name];
    return Number.isInteger(v) && v >= 2 ? { count: v, prop: name } : null;
  }
  return null;
}

/** The count alone (nodeCountOf), or null. */
export function nodeCount(doc, node, catalogue) {
  return nodeCountOf(doc, node, catalogue)?.count ?? null;
}

// A component whose kind declares a required property that resolves to nothing cannot be placed
// without writing something, or the design is invalid the moment it exists. Two components in
// the catalogue are in that position, so the first enum value is written and flagged.
export function requiredGaps(catalogue, componentId) {
  const defs = propDefs(catalogue, componentId);
  const c = own(catalogue.components, componentId);
  const gaps = [];
  for (const [name, def] of Object.entries(defs)) {
    if (!def.required) continue;
    const resolved = c.defaults && c.defaults[name] !== undefined ? c.defaults[name] : def.default;
    if (resolved === undefined) gaps.push({ name, def });
  }
  return gaps;
}

export function addNode(doc, componentId, catalogue, opts = {}) {
  const d = clone(doc);
  const id = opts.id || uniqueId(allIds(d), componentId);
  const node = { id, component: componentId };
  if (opts.label) node.label = opts.label;
  if (opts.group) node.group = opts.group;
  const gaps = requiredGaps(catalogue, componentId);
  if (gaps.length) {
    node.props = {};
    for (const g of gaps) node.props[g.name] = g.def.values ? g.def.values[0] : null;
  }
  d.nodes.push(node);
  return { doc: d, id, needsDecision: gaps.map((g) => g.name) };
}

export function setNodeProp(doc, id, prop, value) {
  const d = clone(doc);
  const n = d.nodes.find((x) => x.id === id);
  if (!n) return d;
  if (value === undefined) {
    if (n.props) {
      delete n.props[prop];
      if (!Object.keys(n.props).length) delete n.props;
    }
  } else {
    n.props = n.props || {};
    n.props[prop] = value;
  }
  return d;
}

export function setNodeField(doc, id, field, value) {
  const d = clone(doc);
  const n = d.nodes.find((x) => x.id === id);
  if (!n) return d;
  if (value === undefined || value === null || value === "") delete n[field];
  else n[field] = value;
  return d;
}

export function setNfr(doc, id, field, value) {
  const d = clone(doc);
  const n = d.nodes.find((x) => x.id === id);
  if (!n) return d;
  if (value === undefined || value === null || value === "") {
    if (n.nfr) {
      delete n.nfr[field];
      if (!Object.keys(n.nfr).length) delete n.nfr;
    }
  } else {
    n.nfr = n.nfr || {};
    n.nfr[field] = value;
  }
  return d;
}

// Renaming an id rewrites every reference in one step: edge endpoints, ref-typed properties,
// group membership and group parentage. A rename that misses one of those produces a design
// that fails the structural check, which is why this is not left to the caller.
export function renameNode(doc, oldId, newId, catalogue) {
  const d = clone(doc);
  const n = d.nodes.find((x) => x.id === oldId);
  if (!n || oldId === newId) return d;
  if (allIds(d).has(newId)) throw new Error(`node id ${newId} already exists`);
  n.id = newId;
  for (const e of d.edges) {
    if (e.from === oldId) e.from = newId;
    if (e.to === oldId) e.to = newId;
  }
  for (const other of d.nodes) {
    if (!other.props) continue;
    const defs = propDefs(catalogue, other.component);
    for (const [name, def] of Object.entries(defs)) {
      if (def.type === "ref" && other.props[name] === oldId) other.props[name] = newId;
    }
  }
  return d;
}

export function renameGroup(doc, oldId, newId) {
  const d = clone(doc);
  const g = (d.groups || []).find((x) => x.id === oldId);
  if (!g || oldId === newId) return d;
  if (allIds(d).has(newId)) throw new Error(`group id ${newId} already exists`);
  g.id = newId;
  for (const n of d.nodes) if (n.group === oldId) n.group = newId;
  for (const e of d.edges) {
    if (e.from === oldId) e.from = newId;
    if (e.to === oldId) e.to = newId;
  }
  for (const other of d.groups) if (other.parent === oldId) other.parent = newId;
  return d;
}

// Deleting a node takes its edges with it and clears every ref-typed property on other nodes
// that pointed at it (the catalogue says which props are refs). Leaving either behind produces
// a design that fails the structural check.
export function deleteNodes(doc, ids, catalogue) {
  const d = clone(doc);
  const gone = new Set(ids);
  d.nodes = d.nodes.filter((n) => !gone.has(n.id));
  d.edges = d.edges.filter((e) => !gone.has(e.from) && !gone.has(e.to));
  if (catalogue) {
    for (const n of d.nodes) {
      if (!n.props) continue;
      const defs = propDefs(catalogue, n.component);
      for (const [name, def] of Object.entries(defs)) {
        if (def.type === "ref" && gone.has(n.props[name])) delete n.props[name];
      }
      if (!Object.keys(n.props).length) delete n.props;
    }
  }
  return d;
}

export function addEdge(doc, from, to) {
  if (from === to) return doc; // self loops are refused
  const d = clone(doc);
  d.edges.push({ from, to, protocol: "http", mode: "sync" });
  return d;
}

// An edge drawn the wrong way round is the commonest mistake on a canvas, and redrawing it
// loses every field on it. Swapping the ends keeps the rest.
export function reverseEdge(doc, index) {
  const d = clone(doc);
  const e = d.edges[index];
  if (!e) return d;
  const from = e.from;
  e.from = e.to;
  e.to = from;
  return d;
}

// Dragging an arrow's end onto another component, or onto a group's frame, moves that end and
// keeps every other field. Refused, with the document returned as it was, when the end would land
// on the other end's own node or group (a self loop), on an id the document does not have, or
// when the result would be an exact twin of another edge: the same ends, label and protocol.
export function reconnectEdge(doc, index, end, nodeId) {
  const e = doc.edges?.[index];
  if (!e || (end !== "from" && end !== "to")) return { doc, refused: "missing" };
  if (!allIds(doc).has(nodeId)) return { doc, refused: "missing" };
  if (e[end] === nodeId) return { doc, refused: null };
  const from = end === "from" ? nodeId : e.from;
  const to = end === "to" ? nodeId : e.to;
  if (from === to) return { doc, refused: "self-loop" };
  const twin = doc.edges.some(
    (o, i) =>
      i !== index &&
      o.from === from &&
      o.to === to &&
      (o.label ?? null) === (e.label ?? null) &&
      (o.protocol ?? null) === (e.protocol ?? null),
  );
  if (twin) return { doc, refused: "duplicate" };
  const d = clone(doc);
  d.edges[index][end] = nodeId;
  return { doc: d, refused: null };
}

export function setEdgeField(doc, index, field, value) {
  const d = clone(doc);
  const e = d.edges[index];
  if (!e) return d;
  if (value === undefined || value === null || value === "") delete e[field];
  else e[field] = value;
  if (!e.protocol) e.protocol = "http";
  if (!e.mode) e.mode = "sync";
  return d;
}

export function deleteEdge(doc, index) {
  const d = clone(doc);
  d.edges.splice(index, 1);
  return d;
}

// Copying a selection copies what is inside it: the nodes with fresh ids, and the edges whose
// two ends are both in the copy. An edge with one end outside would have to guess which end the
// copy owns, so it is left behind. The id map is returned because the caller has to move the
// copy somewhere, and positions live outside the document.
export function duplicateNodes(doc, ids, catalogue) {
  return pasteFragment(doc, copyFragment(doc, ids, []), catalogue);
}

// The groups inside these, at any depth, with them.
function withDescendants(doc, groupIds) {
  const groups = doc.groups || [];
  const out = new Set(groupIds.filter((id) => groups.some((g) => g.id === id)));
  for (let grew = true; grew; ) {
    grew = false;
    for (const g of groups)
      if (g.parent && out.has(g.parent) && !out.has(g.id)) {
        out.add(g.id);
        grew = true;
      }
  }
  return out;
}

/**
 * The part of a design a copy takes: the components and groups named, every group and component
 * inside a named group at any depth, and the edges whose two ends are both in it (an end may be a
 * group). `edgeIndexes` are the copied edges' indexes in `doc`, so the caller can carry what it
 * keys by edge (paths, ports). Everything is a deep copy.
 */
export function copyFragment(doc, nodeIds, groupIds = []) {
  const groups = withDescendants(doc, groupIds);
  const nodes = new Set(nodeIds);
  for (const n of doc.nodes) if (n.group && groups.has(n.group)) nodes.add(n.id);
  const ends = new Set([...nodes, ...groups]);
  const edgeIndexes = [];
  (doc.edges || []).forEach((e, i) => {
    if (ends.has(e.from) && ends.has(e.to)) edgeIndexes.push(i);
  });
  return {
    nodes: clone(doc.nodes.filter((n) => nodes.has(n.id))),
    groups: clone((doc.groups || []).filter((g) => groups.has(g.id))),
    edges: clone(edgeIndexes.map((i) => doc.edges[i])),
    edgeIndexes,
  };
}

/**
 * Put a copied fragment (`copyFragment`, possibly from another design) into `doc` with fresh ids:
 * an id already taken gets the same counter Ctrl+D gives (api-2, api-3). References inside the
 * fragment follow the copy. One pointing outside it is kept when `doc` has what it names — a
 * copy lands in the same group as its original, a ref property keeps its target — and dropped
 * when it does not (pasted into another design). Returns the document, the id map (old to new)
 * and `edgeAt`, the index in the result of each fragment edge.
 */
export function pasteFragment(doc, fragment, catalogue) {
  const d = clone(doc);
  const groupsBefore = groupIds(doc);
  const nodesBefore = nodeIds(doc);
  const taken = allIds(d);
  const map = {};
  const fresh = (id) => {
    const copy = uniqueId(taken, String(id).replace(/-\d+$/, ""));
    taken.add(copy);
    map[id] = copy;
  };
  const groups = Array.isArray(fragment?.groups) ? fragment.groups : [];
  const nodes = Array.isArray(fragment?.nodes) ? fragment.nodes : [];
  const edges = Array.isArray(fragment?.edges) ? fragment.edges : [];
  for (const g of groups) fresh(g.id);
  for (const n of nodes) fresh(n.id);
  if (groups.length) d.groups = d.groups || [];
  for (const g of groups) {
    const copy = clone(g);
    copy.id = map[g.id];
    if (g.parent && map[g.parent]) copy.parent = map[g.parent];
    else if (!g.parent || !groupsBefore.has(g.parent)) delete copy.parent;
    d.groups.push(copy);
  }
  for (const n of nodes) {
    const copy = clone(n);
    copy.id = map[n.id];
    if (n.group && map[n.group]) copy.group = map[n.group];
    else if (!n.group || !groupsBefore.has(n.group)) delete copy.group;
    // A ref property pointing inside the copy follows the copy; one pointing outside is kept
    // when this design has it.
    if (copy.props) {
      for (const [name, def] of Object.entries(propDefs(catalogue, copy.component))) {
        if (def.type !== "ref" || copy.props[name] == null) continue;
        if (map[copy.props[name]]) copy.props[name] = map[copy.props[name]];
        else if (!nodesBefore.has(copy.props[name])) delete copy.props[name];
      }
      if (!Object.keys(copy.props).length) delete copy.props;
    }
    d.nodes.push(copy);
  }
  // Where each fragment edge landed in the result (null: an end was not in the fragment).
  const edgeAt = edges.map((e) => {
    if (!map[e.from] || !map[e.to]) return null;
    const copy = clone(e);
    copy.from = map[e.from];
    copy.to = map[e.to];
    d.edges.push(copy);
    return d.edges.length - 1;
  });
  return { doc: d, map, edgeAt };
}

export function addGroup(doc, memberIds, kind = "system", label) {
  const d = clone(doc);
  d.groups = d.groups || [];
  const id = uniqueId(allIds(d), label || kind);
  const g = { id, kind };
  if (label) g.label = label;
  // Grouping things that already share a group nests inside it rather than beside it, which is
  // what the frames then draw: a group inside a region, not two groups crossing.
  const parents = new Set(
    d.nodes.filter((n) => memberIds.includes(n.id)).map((n) => n.group || null),
  );
  if (parents.size === 1) {
    const only = [...parents][0];
    if (only) g.parent = only;
  }
  d.groups.push(g);
  for (const n of d.nodes) if (memberIds.includes(n.id)) n.group = id;
  return { doc: d, id };
}

// Every node inside a group, including the ones inside its child groups.
export function groupMembers(doc, groupId) {
  const groups = doc.groups || [];
  const wanted = new Set([groupId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const g of groups)
      if (g.parent && wanted.has(g.parent) && !wanted.has(g.id)) {
        wanted.add(g.id);
        grew = true;
      }
  }
  return doc.nodes.filter((n) => wanted.has(n.group)).map((n) => n.id);
}

// The other reading of deleting a group: take what is inside it with it. Offered next to
// ungrouping rather than instead of it, because one of them cannot be guessed from a keystroke.
export function deleteGroupDeep(doc, groupId) {
  const members = groupMembers(doc, groupId);
  const groups = doc.groups || [];
  const doomed = new Set([groupId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const g of groups)
      if (g.parent && doomed.has(g.parent) && !doomed.has(g.id)) {
        doomed.add(g.id);
        grew = true;
      }
  }
  const d = deleteNodes(doc, members);
  d.groups = (d.groups || []).filter((g) => !doomed.has(g.id));
  d.edges = d.edges.filter((e) => !doomed.has(e.from) && !doomed.has(e.to));
  if (!d.groups.length) delete d.groups;
  return d;
}

export function setNodeGroup(doc, nodeId, groupId) {
  const d = clone(doc);
  const n = d.nodes.find((x) => x.id === nodeId);
  if (!n) return d;
  if (!groupId) delete n.group;
  else n.group = groupId;
  return d;
}

// Parentage is only ever set here, never inferred from geometry, and a cycle is refused rather
// than written, because the rules walk ancestry and a cycle would not terminate.
export function setGroupParent(doc, groupId, parentId) {
  const d = clone(doc);
  const groups = d.groups || [];
  const g = groups.find((x) => x.id === groupId);
  if (!g) return d;
  if (!parentId) {
    delete g.parent;
    return d;
  }
  let walk = groups.find((x) => x.id === parentId);
  const seen = new Set([groupId]);
  while (walk) {
    if (seen.has(walk.id)) return doc; // refused
    seen.add(walk.id);
    walk = groups.find((x) => x.id === walk.parent);
  }
  g.parent = parentId;
  return d;
}

export function deleteGroup(doc, groupId) {
  const d = clone(doc);
  const groups = d.groups || [];
  const g = groups.find((x) => x.id === groupId);
  if (!g) return d;
  d.groups = groups.filter((x) => x.id !== groupId);
  for (const child of d.groups)
    if (child.parent === groupId) {
      if (g.parent) child.parent = g.parent;
      else delete child.parent;
    }
  for (const n of d.nodes)
    if (n.group === groupId) {
      if (g.parent) n.group = g.parent;
      else delete n.group;
    }
  // An edge to the group as a unit has nothing left to point at.
  d.edges = d.edges.filter((e) => e.from !== groupId && e.to !== groupId);
  if (!d.groups.length) delete d.groups;
  return d;
}

export function setGroupField(doc, groupId, field, value) {
  const d = clone(doc);
  const g = (d.groups || []).find((x) => x.id === groupId);
  if (!g) return d;
  if (value === undefined || value === null || value === "") delete g[field];
  else g[field] = value;
  return d;
}

// Swapping a component keeps a property only when the new component still has it and the value
// still fits its definition; everything else is reported so the change is visible rather than
// silent. The swap is restricted to the same kind, so no rule selection changes underneath.
export function swapComponent(doc, nodeId, newComponent, catalogue) {
  const d = clone(doc);
  const n = d.nodes.find((x) => x.id === nodeId);
  if (!n) return { doc: d, dropped: [] };
  const defs = propDefs(catalogue, newComponent);
  const dropped = [];
  if (n.props) {
    for (const [name, value] of Object.entries(n.props)) {
      const def = defs[name];
      const ok =
        def &&
        ((def.type === "boolean" && typeof value === "boolean") ||
          (def.type === "integer" && Number.isInteger(value)) ||
          (def.type === "string" && typeof value === "string") ||
          (def.type === "ref" && typeof value === "string") ||
          (def.type === "enum" && Array.isArray(def.values) && def.values.includes(value)));
      if (!ok) {
        dropped.push(name);
        delete n.props[name];
      }
    }
    if (!Object.keys(n.props).length) delete n.props;
  }
  n.component = newComponent;
  return { doc: d, dropped };
}

export function setRequirement(doc, path, value) {
  const d = clone(doc);
  const parts = path.split(".");
  if (value === undefined || value === null || value === "") {
    let node = d.requirements;
    const stack = [];
    for (const p of parts.slice(0, -1)) {
      if (!node) return d;
      stack.push([node, p]);
      node = node[p];
    }
    if (!node) return d;
    delete node[parts[parts.length - 1]];
    for (let i = stack.length - 1; i >= 0; i--) {
      const [parent, key] = stack[i];
      if (parent[key] && Object.keys(parent[key]).length === 0) delete parent[key];
    }
    if (d.requirements && Object.keys(d.requirements).length === 0) delete d.requirements;
    return d;
  }
  d.requirements = d.requirements || {};
  let node = d.requirements;
  for (const p of parts.slice(0, -1)) {
    if (node[p] === undefined) node[p] = {};
    if (node[p] === null || typeof node[p] !== "object" || Array.isArray(node[p]))
      throw new Error(`requirements.${path}: ${p} is not an object`);
    node = node[p];
  }
  node[parts[parts.length - 1]] = value;
  return d;
}
