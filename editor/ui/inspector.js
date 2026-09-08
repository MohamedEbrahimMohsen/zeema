// The inspector. Every control here is generated from the catalogue: a kind's property
// definitions and a component's own, plus the design schema for the requirements tree. Nothing
// about a product is hard coded, which is the whole point of a typed model.
//
// A control shows the value the design would resolve to (node prop, then component default, then
// kind default) in grey, and writes only when the user sets something. Setting a control back to
// the resolved value deletes the key rather than writing a redundant one.

import { propDefs, effective } from "../core/document.js";

const h = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined) n.append(kid);
  return n;
};

const label = (name) => name.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

function field(name, control, note, isSet) {
  return h("div", { class: `field${isSet ? " set" : ""}` },
    h("label", {}, label(name)), control, note ? h("div", { class: "resolved" }, note) : null);
}

function controlFor(def, value, resolved, onChange) {
  if (def.type === "boolean") {
    const sel = h("select", { onchange: (e) => onChange(e.target.value === "" ? undefined : e.target.value === "true") },
      h("option", { value: "" }, `unset (${resolved === undefined ? "absent" : resolved})`),
      h("option", { value: "true" }, "true"), h("option", { value: "false" }, "false"));
    sel.value = value === undefined ? "" : String(value);
    return sel;
  }
  if (def.type === "enum") {
    const sel = h("select", { onchange: (e) => onChange(e.target.value === "" ? undefined : e.target.value) },
      h("option", { value: "" }, `unset (${resolved === undefined ? "absent" : resolved})`),
      ...def.values.map((v) => h("option", { value: v }, v)));
    sel.value = value === undefined ? "" : String(value);
    return sel;
  }
  if (def.type === "integer") {
    const inp = h("input", { type: "number", step: "1", placeholder: resolved === undefined ? "absent" : String(resolved),
      onchange: (e) => onChange(e.target.value === "" ? undefined : parseInt(e.target.value, 10)) });
    if (value !== undefined) inp.value = value;
    return inp;
  }
  const inp = h("input", { type: "text", placeholder: resolved === undefined ? "absent" : String(resolved),
    onchange: (e) => onChange(e.target.value === "" ? undefined : e.target.value) });
  if (value !== undefined) inp.value = value;
  return inp;
}

export class Inspector {
  constructor(root, api) { this.root = root; this.api = api; }

  render(selection, state) {
    const { doc, catalogue } = state;
    this.root.textContent = "";
    if (!selection || !selection.type) return this.design(doc, catalogue);
    if (selection.type === "node") {
      const node = doc.nodes.find((n) => n.id === selection.ref);
      return node ? this.node(node, doc, catalogue) : this.design(doc, catalogue);
    }
    if (selection.type === "edge") {
      const edge = doc.edges[selection.ref];
      return edge ? this.edge(edge, selection.ref, doc) : this.design(doc, catalogue);
    }
    if (selection.type === "group") {
      const group = (doc.groups || []).find((g) => g.id === selection.ref);
      return group ? this.group(group, doc) : this.design(doc, catalogue);
    }
  }

  node(node, doc, catalogue) {
    const c = catalogue.components[node.component];
    const defs = propDefs(catalogue, node.component);
    const resolved = effective(catalogue, node);
    const loc = catalogue.locale.components[node.component];
    const kindId = c ? c.kind : null;
    const siblings = Object.values(catalogue.components).filter((x) => kindId && x.kind === kindId).map((x) => x.id).sort();

    this.root.append(
      h("h2", {}, "Node"),
      field("label", h("input", { type: "text", value: node.label || "",
        onchange: (e) => this.api.setField(node.id, "label", e.target.value) }), null, !!node.label),
      field("id", h("input", { type: "text", value: node.id,
        onchange: (e) => this.api.rename(node.id, e.target.value.trim()) }), "kebab-case, unique", false),
      field("component", (() => {
        const sel = h("select", { onchange: (e) => this.api.swap(node.id, e.target.value) },
          ...(c ? siblings.map((id) => h("option", { value: id }, id)) : [h("option", { value: node.component }, node.component + " (unknown)")]));
        sel.value = node.component;
        return sel;
      })(), c ? `${loc ? loc.name : node.component} · ${c.kind} · ${c.provider}` : "not in the catalogue", false),
      h("div", { class: "pill" }, c ? (catalogue.kinds[c.kind] || {}).category || "" : "unknown component"),
    );
    if (loc && loc.description) this.root.append(h("div", { class: "resolved", style: "margin:6px 0 10px" }, loc.description));

    if (Object.keys(defs).length) this.root.append(h("h2", { style: "margin-top:14px" }, "Properties"));
    for (const [name, def] of Object.entries(defs)) {
      const value = node.props ? node.props[name] : undefined;
      const note = [def.type, def.required ? "required" : null].filter(Boolean).join(" · ");
      this.root.append(field(name,
        controlFor(def, value, resolved[name], (v) => this.api.setProp(node.id, name, v)),
        note, value !== undefined));
    }

    this.root.append(h("h2", { style: "margin-top:14px" }, "Non functional"));
    for (const [name, def] of Object.entries({ rps: { type: "integer" }, latencyP95Ms: { type: "integer" },
      consistency: { type: "enum", values: ["strong", "eventual"] } })) {
      const value = node.nfr ? node.nfr[name] : undefined;
      this.root.append(field(name, controlFor(def, value, undefined, (v) => this.api.setNfr(node.id, name, v)), null, value !== undefined));
    }

    this.root.append(h("h2", { style: "margin-top:14px" }, "Group"),
      field("group", (() => {
        const sel = h("select", { onchange: (e) => this.api.setGroup(node.id, e.target.value || null) },
          h("option", { value: "" }, "none"),
          ...(doc.groups || []).map((g) => h("option", { value: g.id }, g.label || g.id)));
        sel.value = node.group || "";
        return sel;
      })(), null, !!node.group),
      h("button", { onclick: () => this.api.remove("node", node.id) }, "Delete node"));
  }

  edge(edge, index, doc) {
    const ids = doc.nodes.map((n) => n.id);
    const pick = (name, value) => {
      const sel = h("select", { onchange: (e) => this.api.setEdge(index, name, e.target.value) },
        ...ids.map((id) => h("option", { value: id }, id)));
      sel.value = value;
      return sel;
    };
    this.root.append(
      h("h2", {}, "Edge"),
      field("from", pick("from", edge.from), null, true),
      field("to", pick("to", edge.to), null, true),
      field("protocol", h("input", { type: "text", value: edge.protocol || "",
        onchange: (e) => this.api.setEdge(index, "protocol", e.target.value) }), "required", true),
      field("mode", controlFor({ type: "enum", values: ["sync", "async"] }, edge.mode, "sync",
        (v) => this.api.setEdge(index, "mode", v)), "required", true),
      field("delivery", controlFor({ type: "enum", values: ["at-most-once", "at-least-once", "exactly-once"] },
        edge.delivery, undefined, (v) => this.api.setEdge(index, "delivery", v)), "async edges", edge.delivery !== undefined),
      field("label", h("input", { type: "text", value: edge.label || "",
        onchange: (e) => this.api.setEdge(index, "label", e.target.value) }), null, !!edge.label),
      field("timeoutMs", controlFor({ type: "integer" }, edge.timeoutMs, undefined, (v) => this.api.setEdge(index, "timeoutMs", v)), null, edge.timeoutMs !== undefined),
      field("retryPolicy", controlFor({ type: "enum", values: ["none", "fixed", "exponential", "exponential-jitter"] },
        edge.retryPolicy, undefined, (v) => this.api.setEdge(index, "retryPolicy", v)), null, edge.retryPolicy !== undefined),
      field("idempotent", controlFor({ type: "boolean" }, edge.idempotent, undefined, (v) => this.api.setEdge(index, "idempotent", v)), null, edge.idempotent !== undefined),
      field("circuitBreaker", controlFor({ type: "boolean" }, edge.circuitBreaker, undefined, (v) => this.api.setEdge(index, "circuitBreaker", v)), null, edge.circuitBreaker !== undefined),
      field("fallback", controlFor({ type: "enum", values: ["none", "static", "cached", "degraded"] },
        edge.fallback, undefined, (v) => this.api.setEdge(index, "fallback", v)), null, edge.fallback !== undefined),
      field("batched", controlFor({ type: "boolean" }, edge.batched, undefined, (v) => this.api.setEdge(index, "batched", v)), null, edge.batched !== undefined),
      h("button", { onclick: () => this.api.remove("edge", index) }, "Delete edge"));
  }

  group(group, doc) {
    const kinds = ["region", "availability-zone", "vpc", "trust-zone", "system", "cell", "point-of-presence"];
    const members = doc.nodes.filter((n) => n.group === group.id).length;
    this.root.append(
      h("h2", {}, "Group"),
      field("label", h("input", { type: "text", value: group.label || "",
        onchange: (e) => this.api.setGroupField(group.id, "label", e.target.value) }), null, !!group.label),
      field("id", h("input", { type: "text", value: group.id,
        onchange: (e) => this.api.renameGroup(group.id, e.target.value.trim()) }), null, false),
      field("kind", controlFor({ type: "enum", values: kinds }, group.kind, "system",
        (v) => this.api.setGroupField(group.id, "kind", v || "system")), "required", true),
      field("parent", (() => {
        const sel = h("select", { onchange: (e) => this.api.setParent(group.id, e.target.value || null) },
          h("option", { value: "" }, "none"),
          ...(doc.groups || []).filter((g) => g.id !== group.id).map((g) => h("option", { value: g.id }, g.label || g.id)));
        sel.value = group.parent || "";
        return sel;
      })(), "a cycle is refused", !!group.parent),
      h("div", { class: "resolved" }, `${members} member${members === 1 ? "" : "s"}`),
      h("button", { onclick: () => this.api.remove("group", group.id) }, "Delete group"));
  }

  // The requirements tree is generated from the bundled JSON Schema, so every path the format
  // documents is editable and nothing else is.
  design(doc, catalogue) {
    const schema = catalogue.schema.properties.requirements;
    this.root.append(
      h("h2", {}, "Design"),
      field("id", h("input", { type: "text", value: doc.id || "",
        onchange: (e) => this.api.setDesignId(e.target.value.trim()) }), "must equal the folder name", true),
      h("div", { class: "resolved" }, `${doc.nodes.length} nodes · ${doc.edges.length} edges · ${(doc.groups || []).length} groups`),
      h("h2", { style: "margin-top:14px" }, "Requirements"));
    for (const [groupName, groupSchema] of Object.entries(schema.properties || {})) {
      const current = (doc.requirements || {})[groupName] || {};
      const box = h("details", {});
      const set = Object.keys(current).length;
      box.append(h("summary", { style: "cursor:pointer;margin:6px 0;color:var(--muted)" },
        `${label(groupName)}${set ? ` · ${set} set` : ""}`));
      if (set) box.open = true;
      for (const [name, def] of Object.entries(groupSchema.properties || {})) {
        const path = `${groupName}.${name}`;
        const value = current[name];
        const kind = def.enum ? { type: "enum", values: def.enum }
          : def.type === "boolean" ? { type: "boolean" }
          : def.type === "integer" ? { type: "integer" } : { type: "string" };
        const note = [def.type === "string" && def.pattern ? `pattern ${def.pattern}` : null,
          def.minimum !== undefined ? `min ${def.minimum}` : null].filter(Boolean).join(" · ");
        box.append(field(name, controlFor(kind, value, undefined, (v) => this.api.setRequirement(path, v)), note, value !== undefined));
      }
      this.root.append(box);
    }
  }
}
