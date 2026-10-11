// structure.js — the blocking layer of the editor's validation.
//
// Two layers, in this order:
//   1. a port of checkDesign() in .claude/tools/validate.mjs. Its message templates are
//      reproduced verbatim, interpolation included, except that an edge end may also name a
//      group here (so the "missing" message says so). The repository gate runs this file, not
//      validate.mjs.
//   2. a hand-written JSON Schema check against catalogue.schema (the parsed
//      schema/design.schema.json). Ajv cannot be a dependency here, so the nine keywords the
//      schema actually uses are implemented directly and the wording is our own.
//
// Every finding is blocking. DOM free, dependency free; the one import is the format of a node's
// `ref`, which document.js reads.
//
//   check(doc, catalogue)                  -> [{ message, subject, blocking }]
//   check(doc, catalogue, { file })        -> same, with `file` as the message prefix
//
// `file` defaults to doc.id so the checker is usable before a path is known; pass the design's
// repository-relative path to get byte-identical parity with the validator.

import { isRefDesign, isRefVersion } from "./document.js";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const arr = (v) => (Array.isArray(v) ? v : []);

const design = () => ({ type: "design", ref: null });
const node = (id) => ({ type: "node", ref: id === undefined ? null : id });
const group = (id) => ({ type: "group", ref: id === undefined ? null : id });
const edge = (i) => ({ type: "edge", ref: i });

/**
 * @param {object} doc        a design document
 * @param {object} catalogue  { kinds, components, schema }
 * @param {{file?: string}} [options]
 * @returns {Array<{message: string, subject: {type: string, ref: any}, blocking: true}>}
 */
// Catalogue maps are plain objects keyed by ids that come from documents, so a lookup reads own
// keys only: a component called `constructor` or `toString` is unknown, not Object's method.
const own = (o, k) =>
  o != null && typeof k === "string" && Object.hasOwn(o, k) ? o[k] : undefined;

export function check(doc, catalogue, options = {}) {
  const cat = catalogue ?? {};
  const file =
    typeof options.file === "string"
      ? options.file
      : doc && typeof doc.id === "string"
        ? doc.id
        : "design";
  const out = [];
  checkDesign(doc, cat, file, out);
  // A malformed ref.design or ref.version, or a group count that is not 2 or more, is reported
  // once, in the words above; the schema's pattern and minimum say the same thing less plainly.
  if (cat.schema)
    for (const f of checkSchema(doc, cat.schema))
      if (!REF_FIELD.test(f.pointer) && !COUNT_FIELD.test(f.pointer)) out.push(f);
  return out;
}

/* ------------------------------------------------------------------ layer 1 */

const REF_FIELD = /^\/nodes\/\d+\/ref\/(design|version)$/;
const COUNT_FIELD = /^\/groups\/\d+\/count$/;

const propDefs = (c, kinds) => ({
  ...(own(kinds, c.kind)?.properties ?? {}),
  ...(c.properties ?? {}),
});

const effective = (n, c, defs) => {
  const out = {};
  for (const [k, d] of Object.entries(defs)) {
    if (isObj(n.props) && n.props[k] !== undefined) out[k] = n.props[k];
    else if (c.defaults && c.defaults[k] !== undefined) out[k] = c.defaults[k];
    else if (d && d.default !== undefined) out[k] = d.default;
  }
  return out;
};

// Port of checkDesign(). The strings below are copied from validate.mjs and must stay identical.
function checkDesign(doc, catalogue, file, out) {
  const kinds = catalogue.kinds ?? {};
  const components = catalogue.components ?? {};
  const nodes = arr(doc?.nodes);
  const groups = arr(doc?.groups);
  const edges = arr(doc?.edges);
  const add = (message, subject) => out.push({ message, subject, blocking: true });

  const nodeIds = new Set(nodes.map((n) => (isObj(n) ? n.id : undefined)));
  const groupIds = new Set(groups.map((g) => (isObj(g) ? g.id : undefined)));
  if (nodeIds.size !== nodes.length) add(`${file}: duplicate node ids`, design());
  if (groupIds.size !== groups.length) add(`${file}: duplicate group ids`, design());
  for (const g of groups) {
    if (!isObj(g)) continue;
    if (g.parent && !groupIds.has(g.parent))
      add(`${file}: group ${g.id} parent missing`, group(g.id));
    // N identical copies of the group: a whole number, and at least two (one copy is no count).
    if (g.count !== undefined && !(Number.isInteger(g.count) && g.count >= 2))
      add(
        `${file}: group ${g.id} count ${show(g.count)} is not a whole number of 2 or more`,
        group(g.id),
      );
  }
  for (const n of nodes) {
    if (!isObj(n)) continue;
    // A reference to another design: its shape only. Whether the target exists is remote state,
    // not structure, and is never checked here. Nor is a reference to the design's own self:
    // the document does not know its owner, so it cannot know its own owner/slug.
    if (isObj(n.ref)) {
      if (n.ref.design !== undefined && !isRefDesign(n.ref.design))
        add(`${file}: node ${n.id} ref design ${show(n.ref.design)} is not owner/slug`, node(n.id));
      if (n.ref.version !== undefined && !isRefVersion(n.ref.version))
        add(
          `${file}: node ${n.id} ref version ${show(n.ref.version)} is not a release number (1 or more) or "head"`,
          node(n.id),
        );
    }
    const c = own(components, n.component);
    if (!c) {
      add(`${file}: node ${n.id} unknown component ${n.component}`, node(n.id));
      continue;
    }
    if (n.group && !groupIds.has(n.group)) add(`${file}: node ${n.id} unknown group`, node(n.id));
    const defs = propDefs(c, kinds);
    for (const [k, v] of Object.entries(isObj(n.props) ? n.props : {})) {
      const d = defs[k];
      if (!d) {
        add(`${file}: node ${n.id} unknown prop ${k}`, node(n.id));
        continue;
      }
      if (d.type === "enum" && !arr(d.values).includes(v))
        add(`${file}: node ${n.id} prop ${k}=${v} not in enum`, node(n.id));
      if (d.type === "boolean" && typeof v !== "boolean")
        add(`${file}: node ${n.id} prop ${k} not boolean`, node(n.id));
      if (d.type === "integer" && !Number.isInteger(v))
        add(`${file}: node ${n.id} prop ${k} not integer`, node(n.id));
      if (d.type === "string" && typeof v !== "string")
        add(`${file}: node ${n.id} prop ${k} not string`, node(n.id));
      if (d.type === "ref") {
        const t = nodes.find((x) => isObj(x) && x.id === v);
        if (!t) add(`${file}: ref ${k} missing`, node(n.id));
        else if (own(components, t.component)?.kind !== d.refKind)
          add(`${file}: ref ${k} wrong kind`, node(n.id));
      }
    }
    const eff = effective(n, c, defs);
    for (const [k, d] of Object.entries(defs))
      if (d?.required && eff[k] === undefined)
        add(`${file}: node ${n.id} missing required ${k}`, node(n.id));
  }
  // An edge end names a node or a group (an edge to the group as a unit, drawn to its frame).
  // An id that is both is not refused: committed designs already name a group after the node
  // that fronts it, and their edges have always meant the node. Such an end is the node, here
  // and in rules, layout and geometry; the editor never creates a new collision.
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    if (!isObj(e)) continue;
    for (const end of ["from", "to"])
      if (!nodeIds.has(e[end]) && !groupIds.has(e[end]))
        add(`${file}: edge ${end} ${e[end]} missing: no node or group`, edge(i));
  }
}

/* ------------------------------------------------------------------ layer 2 */

const escapeToken = (k) => String(k).replace(/~/g, "~0").replace(/\//g, "~1");
const where = (pointer) => (pointer === "" ? "the design" : pointer);

const found = (v) => {
  if (v === undefined) return "nothing";
  if (v === null) return "null";
  if (Array.isArray(v)) return "an array";
  if (typeof v === "object") return "an object";
  if (typeof v === "number") return Number.isInteger(v) ? "an integer" : "a number";
  if (typeof v === "string") return "a string";
  if (typeof v === "boolean") return "a boolean";
  return typeof v;
};

const article = (t) =>
  ({
    object: "an object",
    array: "an array",
    string: "a string",
    integer: "an integer",
    number: "a number",
    boolean: "a boolean",
    null: "null",
  })[t] ?? t;

const typeOk = (v, t) => {
  switch (t) {
    case "object":
      return isObj(v);
    case "array":
      return Array.isArray(v);
    case "string":
      return typeof v === "string";
    case "integer":
      return typeof v === "number" && Number.isInteger(v);
    case "number":
      return typeof v === "number" && Number.isFinite(v);
    case "boolean":
      return typeof v === "boolean";
    case "null":
      return v === null;
    default:
      return true;
  }
};

const show = (v) => {
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
};

// Resolve an in-document "#/a/b" reference against the root schema.
function resolveRef(ref, root) {
  if (typeof ref !== "string" || !ref.startsWith("#")) return null;
  const path = ref.slice(1).replace(/^\//, "");
  if (path === "") return root;
  let cur = root;
  for (const raw of path.split("/")) {
    const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (!isObj(cur) && !Array.isArray(cur)) return null;
    cur = cur[key];
  }
  return cur ?? null;
}

// Maps a JSON pointer into the subject the editor attaches the finding to.
function subjectFor(doc, pointer) {
  const seg = pointer.split("/").filter((s) => s !== "");
  if (seg.length < 2) return design();
  const i = Number(seg[1]);
  if (!Number.isInteger(i)) return design();
  if (seg[0] === "nodes") {
    const n = arr(doc?.nodes)[i];
    return node(isObj(n) ? n.id : null);
  }
  if (seg[0] === "groups") {
    const g = arr(doc?.groups)[i];
    return group(isObj(g) ? g.id : null);
  }
  if (seg[0] === "edges") return edge(i);
  return design();
}

/**
 * The nine keywords design.schema.json actually uses — type, enum, const, pattern, minimum,
 * minItems, minLength, required, additionalProperties — plus the structural applicators it
 * needs (properties, items, propertyNames, $ref). Wording is ours, not Ajv's.
 */
export function checkSchema(doc, schema, out = [], docRoot) {
  const root = docRoot === undefined ? doc : docRoot;
  const raw = [];
  walk(doc, schema, schema, "", raw);
  for (const f of raw)
    out.push({
      message: f.message,
      subject: subjectFor(root, f.pointer),
      pointer: f.pointer,
      keyword: f.keyword,
      blocking: true,
    });
  return out;
}

function walk(value, schema, root, pointer, out) {
  if (schema === true || schema === undefined || schema === null) return;
  if (schema === false) {
    out.push({ message: `${where(pointer)}: not allowed here`, pointer, keyword: "false" });
    return;
  }
  if (!isObj(schema)) return;

  if (schema.$ref) {
    const target = resolveRef(schema.$ref, root);
    if (target) walk(value, target, root, pointer, out);
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeOk(value, t))) {
      out.push({
        message: `${where(pointer)}: expected ${types.map(article).join(" or ")}, found ${found(value)}`,
        pointer,
        keyword: "type",
      });
      return; // a wrong type makes every other keyword here noise
    }
  }

  if (schema.const !== undefined && value !== schema.const)
    out.push({
      message: `${where(pointer)}: expected ${show(schema.const)}, found ${show(value)}`,
      pointer,
      keyword: "const",
    });

  if (Array.isArray(schema.enum) && !schema.enum.some((e) => e === value))
    out.push({
      message: `${where(pointer)}: ${show(value)} is not one of ${schema.enum.map(show).join(", ")}`,
      pointer,
      keyword: "enum",
    });

  if (typeof value === "string") {
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value))
      out.push({
        message: `${where(pointer)}: ${show(value)} does not match ${schema.pattern}`,
        pointer,
        keyword: "pattern",
      });
    if (schema.minLength !== undefined && value.length < schema.minLength)
      out.push({
        message: `${where(pointer)}: needs at least ${schema.minLength} character${schema.minLength === 1 ? "" : "s"}, has ${value.length}`,
        pointer,
        keyword: "minLength",
      });
  }

  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum)
    out.push({
      message: `${where(pointer)}: ${value} is below the minimum ${schema.minimum}`,
      pointer,
      keyword: "minimum",
    });

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      out.push({
        message: `${where(pointer)}: needs at least ${schema.minItems} item${schema.minItems === 1 ? "" : "s"}, has ${value.length}`,
        pointer,
        keyword: "minItems",
      });
    if (schema.items !== undefined)
      for (let i = 0; i < value.length; i++)
        walk(value[i], schema.items, root, `${pointer}/${i}`, out);
  }

  if (isObj(value)) {
    for (const key of arr(schema.required))
      if (value[key] === undefined)
        out.push({
          message: `${where(pointer)}: missing required property "${key}"`,
          pointer,
          keyword: "required",
        });

    const known = isObj(schema.properties) ? schema.properties : {};
    for (const [key, v] of Object.entries(value)) {
      const child = `${pointer}/${escapeToken(key)}`;
      if (isObj(schema.propertyNames) && typeof schema.propertyNames.pattern === "string") {
        if (!new RegExp(schema.propertyNames.pattern).test(key))
          out.push({
            message: `${where(pointer)}: property name "${key}" does not match ${schema.propertyNames.pattern}`,
            pointer: child,
            keyword: "propertyNames",
          });
      }
      if (Object.hasOwn(known, key)) {
        walk(v, known[key], root, child, out);
        continue;
      }
      if (schema.additionalProperties === false) {
        out.push({
          message: `${where(pointer)}: unknown property "${key}"`,
          pointer: child,
          keyword: "additionalProperties",
        });
      } else if (isObj(schema.additionalProperties)) {
        walk(v, schema.additionalProperties, root, child, out);
      }
    }
  }
}
