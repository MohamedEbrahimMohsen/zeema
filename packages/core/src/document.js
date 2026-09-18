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
export function displayName(catalogue, node) {
  if (node.label) return node.label;
  const loc = catalogue.locale?.components[node.component];
  return loc?.name || node.component || node.id;
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
  const wanted = uniqueId(taken, label);
  return wanted === id
    ? { doc: next, id }
    : { doc: renameNode(next, id, wanted, catalogue), id: wanted };
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
    const resolved = c.defaults && c.defaults[name] !== undefined ? c.defaults[name] : def.default;
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
  if (d.nodes.some((x) => x.id === newId)) throw new Error(`node id ${newId} already exists`);
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
  if (d.groups.some((x) => x.id === newId)) throw new Error(`group id ${newId} already exists`);
  g.id = newId;
  for (const n of d.nodes) if (n.group === oldId) n.group = newId;
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
  const d = clone(doc);
  const wanted = doc.nodes.filter((n) => ids.includes(n.id));
  const taken = nodeIds(d);
  const map = {};
  for (const n of wanted) {
    const copy = clone(n);
    copy.id = uniqueId(taken, n.id.replace(/-\d+$/, ""));
    taken.add(copy.id);
    map[n.id] = copy.id;
    d.nodes.push(copy);
  }
  // A ref property pointing inside the copy follows the copy; one pointing outside is kept.
  for (const original of wanted) {
    const copy = d.nodes.find((x) => x.id === map[original.id]);
    if (!copy?.props) continue;
    for (const [name, def] of Object.entries(propDefs(catalogue, copy.component))) {
      if (def.type === "ref" && map[copy.props[name]]) copy.props[name] = map[copy.props[name]];
    }
  }
  for (const e of doc.edges) {
    if (!map[e.from] || !map[e.to]) continue;
    const copy = clone(e);
    copy.from = map[e.from];
    copy.to = map[e.to];
    d.edges.push(copy);
  }
  return { doc: d, map };
}

export function addGroup(doc, memberIds, kind = "system", label) {
  const d = clone(doc);
  d.groups = d.groups || [];
  const id = uniqueId(groupIds(d), label || kind);
  const g = { id, kind };
  if (label) g.label = label;
  // Grouping things that already share a group nests inside it rather than beside it, which is
  // what the frames then draw: a boundary inside a region, not two boundaries crossing.
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

// The other reading of deleting a boundary: take what is inside it with it. Offered next to
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
