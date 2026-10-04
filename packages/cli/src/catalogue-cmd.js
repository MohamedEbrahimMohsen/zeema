// zeema catalogue find|component|kind|kinds|providers
// The queries return data (the MCP server hands it to agents as JSON); the command prints it.
import { PROVIDERS } from "@zeema/catalogue";

const name = (cat, id) => cat.locale.components[id]?.name ?? id;
const own = (o, k) => (o && typeof k === "string" && Object.hasOwn(o, k) ? o[k] : undefined);

/** Every kind with its category and how many components it has. */
export function listKinds(cat) {
  const counts = {};
  for (const c of Object.values(cat.components)) counts[c.kind] = (counts[c.kind] ?? 0) + 1;
  return Object.values(cat.kinds).map((k) => ({
    id: k.id,
    name: cat.locale.kinds?.[k.id]?.name ?? k.id,
    category: k.category,
    components: counts[k.id] ?? 0,
  }));
}

/** Components whose id, name, description, kind or provider contain every word. */
export function findComponents(cat, words) {
  const ws = words.map((w) => String(w).toLowerCase());
  return Object.values(cat.components)
    .filter((c) => {
      const hay =
        `${c.id} ${name(cat, c.id)} ${cat.locale.components[c.id]?.description ?? ""} ${c.kind} ${c.provider}`.toLowerCase();
      return ws.every((w) => hay.includes(w));
    })
    .map((c) => ({ id: c.id, provider: c.provider, kind: c.kind, name: name(cat, c.id) }));
}

/** A component, its kind, and its effective properties with where each value comes from. */
export function componentInfo(cat, id) {
  const c = own(cat.components, id);
  if (!c) return null;
  const k = own(cat.kinds, c.kind);
  const defs = { ...(k?.properties ?? {}), ...(c.properties ?? {}) };
  const properties = Object.entries(defs).map(([p, d]) => {
    const fromComponent = c.defaults?.[p] !== undefined;
    return {
      name: p,
      type: d.type,
      value: fromComponent ? c.defaults[p] : d.default,
      source: fromComponent
        ? "component"
        : d.default !== undefined
          ? "kind"
          : d.required
            ? "REQUIRED"
            : "unset",
      ...(d.values ? { values: d.values } : {}),
    };
  });
  return {
    id: c.id,
    name: name(cat, c.id),
    kind: c.kind,
    category: k?.category,
    provider: c.provider,
    description: cat.locale.components[c.id]?.description,
    ...(c.docs ? { docs: c.docs } : {}),
    ...(c.aliases ? { aliases: c.aliases } : {}),
    properties,
  };
}

/** A kind, its properties, and its components by provider. */
export function kindInfo(cat, id) {
  const k = own(cat.kinds, id);
  if (!k) return null;
  const components = {};
  for (const prov of PROVIDERS) {
    const ids = Object.values(cat.components)
      .filter((c) => c.kind === k.id && c.provider === prov)
      .map((c) => c.id);
    if (ids.length) components[prov] = ids;
  }
  return {
    id: k.id,
    name: cat.locale.kinds?.[k.id]?.name ?? k.id,
    category: k.category,
    description: cat.locale.kinds?.[k.id]?.description,
    properties: Object.entries(k.properties).map(([p, d]) => ({ name: p, ...d })),
    components,
  };
}

/** How many components each provider has, for one kind or for the whole catalogue. */
export function providerCounts(cat, kind) {
  return PROVIDERS.map((prov) => ({
    provider: prov,
    name: cat.locale.providers?.[prov]?.name ?? prov,
    components: Object.values(cat.components).filter(
      (c) => c.provider === prov && (kind === undefined || c.kind === kind),
    ).length,
  }));
}

export function catalogueCommand(cat, sub, args) {
  const out = [];
  const ok = { lines: out, code: 0 };
  if (sub === "kinds") {
    for (const k of listKinds(cat))
      out.push(
        `${k.id.padEnd(28)} ${k.category.padEnd(10)} ${String(k.components).padStart(4)} components`,
      );
    return ok;
  }
  if (sub === "find") {
    if (!args.length) return { lines: ["usage: zeema catalogue find <words...>"], code: 2 };
    const rows = findComponents(cat, args);
    for (const c of rows)
      out.push(`${c.id.padEnd(40)} ${c.provider.padEnd(11)} ${c.kind.padEnd(24)} ${c.name}`);
    if (!rows.length) return { lines: ["no component matched"], code: 1 };
    return ok;
  }
  if (sub === "component") {
    const c = componentInfo(cat, args[0]);
    if (!c) return { lines: [`unknown component ${args[0] ?? ""}`], code: 1 };
    out.push(
      `${c.id}  (${c.name})`,
      `kind: ${c.kind}  category: ${c.category}  provider: ${c.provider}`,
    );
    if (c.description) out.push(c.description);
    out.push("effective properties:");
    for (const p of c.properties)
      out.push(
        `  ${p.name.padEnd(28)} ${p.type.padEnd(8)} ${String(p.value ?? "").padEnd(16)} ${p.source}${p.values ? `  [${p.values.join(", ")}]` : ""}`,
      );
    return ok;
  }
  if (sub === "kind") {
    const k = kindInfo(cat, args[0]);
    if (!k) return { lines: [`unknown kind ${args[0] ?? ""}`], code: 1 };
    out.push(`${k.id}  category: ${k.category}`, "properties:");
    for (const d of k.properties)
      out.push(
        `  ${d.name.padEnd(28)} ${d.type.padEnd(8)} ${d.required ? "required" : d.default !== undefined ? `default ${d.default}` : "optional"}${d.values ? `  [${d.values.join(", ")}]` : ""}`,
      );
    out.push("components:");
    for (const [prov, ids] of Object.entries(k.components))
      out.push(`  ${prov.padEnd(11)} ${ids.join(", ")}`);
    return ok;
  }
  if (sub === "providers") {
    if (!own(cat.kinds, args[0])) return { lines: [`unknown kind ${args[0] ?? ""}`], code: 1 };
    for (const { provider, components: n } of providerCounts(cat, args[0]))
      out.push(`${provider.padEnd(11)} ${n ? `${n} component${n === 1 ? "" : "s"}` : "none"}`);
    return ok;
  }
  return {
    lines: [
      "usage: zeema catalogue find <words...> | component <id> | kind <id> | kinds | providers <kind>",
    ],
    code: 2,
  };
}
