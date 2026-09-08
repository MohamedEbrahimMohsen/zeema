// Pure operations on a design document. Every function takes a document and returns a new one;
// nothing here mutates its argument and nothing here touches the DOM. Cascades live here rather
// than in the UI, so deleting a node from a palette drag and deleting it from a keystroke can
// never disagree: an id rewrite fixes edges, ref properties, group membership and parentage in
// one step, and a delete takes its edges with it.

const clone = (x) => JSON.parse(JSON.stringify(x));

export function createDoc(id = "untitled") {
  return { schemaVersion: "1", type: "design", id, nodes: [], edges: [] };
}

export function uniqueId(taken, base) {
  const slug = String(base).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "node";
  const start = /^[a-z]/.test(slug) ? slug : "n-" + slug;
  if (!taken.has(start)) return start;
  for (let n = 2; ; n++) if (!taken.has(`${start}-${n}`)) return `${start}-${n}`;
}

const nodeIds = (doc) => new Set(doc.nodes.map((n) => n.id));
const groupIds = (doc) => new Set((doc.groups || []).map((g) => g.id));

export function propDefs(catalogue, componentId) {
  const c = catalogue.components[componentId];
  if (!c) return {};
  const k = catalogue.kinds[c.kind];
  return { ...(k ? k.properties : {}), ...(c.properties || {}) };
}

// The value a design resolves to: the node's own prop, then the component default, then the
// kind default. A property that resolves to nothing is absent, which is what the rules read.
export function effective(catalogue, node) {
  const c = catalogue.components[node.component];
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

// A component whose kind declares a required property that resolves to nothing cannot be placed
// without writing something, or the design is invalid the moment it exists. Two components in
// the catalogue are in that position, so the first enum value is written and flagged.
export function requiredGaps(catalogue, componentId) {
  const defs = propDefs(catalogue, componentId);
  const c = catalogue.components[componentId];
  const gaps = [];
  for (const [name, def] of Object.entries(defs)) {
    if (!def.required) continue;
    const resolved = (c.defaults && c.defaults[name] !== undefined) ? c.defaults[name] : def.default;
    if (resolved === undefined) gaps.push({ name, def });
  }
  return gaps;
}

export function addNode(doc, componentId, catalogue, opts = {}) {
  const d = clone(doc);
  const id = opts.id || uniqueId(nodeIds(d), componentId);
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
    if (n.props) { delete n.props[prop]; if (!Object.keys(n.props).length) delete n.props; }
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
    if (n.nfr) { delete n.nfr[field]; if (!Object.keys(n.nfr).length) delete n.nfr; }
  } else { n.nfr = n.nfr || {}; n.nfr[field] = value; }
  return d;
}

// Renaming an id rewrites every reference in one step: edge endpoints, ref-typed properties,
// group membership and group parentage. A rename that misses one of those produces a design
// that fails the structural check, which is why this is not left to the caller.
export function renameNode(doc, oldId, newId, catalogue) {
  const d = clone(doc);
  const n = d.nodes.find((x) => x.id === oldId);
  if (!n || oldId === newId) return d;
  n.id = newId;
  for (const e of d.edges) { if (e.from === oldId) e.from = newId; if (e.to === oldId) e.to = newId; }
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
  g.id = newId;
  for (const n of d.nodes) if (n.group === oldId) n.group = newId;
  for (const other of d.groups) if (other.parent === oldId) other.parent = newId;
  return d;
}

export function deleteNodes(doc, ids) {
  const d = clone(doc);
  const gone = new Set(ids);
  d.nodes = d.nodes.filter((n) => !gone.has(n.id));
  d.edges = d.edges.filter((e) => !gone.has(e.from) && !gone.has(e.to));
  return d;
}

export function addEdge(doc, from, to) {
  if (from === to) return doc;                       // self loops are refused
  const d = clone(doc);
  d.edges.push({ from, to, protocol: "http", mode: "sync" });
  return d;
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

export function addGroup(doc, memberIds, kind = "system", label) {
  const d = clone(doc);
  d.groups = d.groups || [];
  const id = uniqueId(groupIds(d), label || kind);
  const g = { id, kind };
  if (label) g.label = label;
  d.groups.push(g);
  for (const n of d.nodes) if (memberIds.includes(n.id)) n.group = id;
  return { doc: d, id };
}

export function setNodeGroup(doc, nodeId, groupId) {
  const d = clone(doc);
  const n = d.nodes.find((x) => x.id === nodeId);
  if (!n) return d;
  if (!groupId) delete n.group; else n.group = groupId;
  return d;
}

// Parentage is only ever set here, never inferred from geometry, and a cycle is refused rather
// than written, because the rules walk ancestry and a cycle would not terminate.
export function setGroupParent(doc, groupId, parentId) {
  const d = clone(doc);
  const groups = d.groups || [];
  const g = groups.find((x) => x.id === groupId);
  if (!g) return d;
  if (!parentId) { delete g.parent; return d; }
  let walk = groups.find((x) => x.id === parentId);
  const seen = new Set([groupId]);
  while (walk) {
    if (seen.has(walk.id)) return doc;               // refused
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
  for (const child of d.groups) if (child.parent === groupId) { if (g.parent) child.parent = g.parent; else delete child.parent; }
  for (const n of d.nodes) if (n.group === groupId) { if (g.parent) n.group = g.parent; else delete n.group; }
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
      const ok = def && (
        (def.type === "boolean" && typeof value === "boolean") ||
        (def.type === "integer" && Number.isInteger(value)) ||
        (def.type === "string" && typeof value === "string") ||
        (def.type === "ref" && typeof value === "string") ||
        (def.type === "enum" && Array.isArray(def.values) && def.values.includes(value)));
      if (!ok) { dropped.push(name); delete n.props[name]; }
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
    for (const p of parts.slice(0, -1)) { if (!node) return d; stack.push([node, p]); node = node[p]; }
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
  for (const p of parts.slice(0, -1)) { node[p] = node[p] || {}; node = node[p]; }
  node[parts[parts.length - 1]] = value;
  return d;
}
