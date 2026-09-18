// zeema catalogue find|component|kind|kinds|providers
import { PROVIDERS } from "@zeema/catalogue";

const name = (cat, id) => cat.locale.components[id]?.name ?? id;

export function catalogueCommand(cat, sub, args) {
  const out = [];
  const ok = { lines: out, code: 0 };
  if (sub === "kinds") {
    const counts = {};
    for (const c of Object.values(cat.components)) counts[c.kind] = (counts[c.kind] ?? 0) + 1;
    for (const k of Object.values(cat.kinds))
      out.push(
        `${k.id.padEnd(28)} ${k.category.padEnd(10)} ${String(counts[k.id] ?? 0).padStart(4)} components`,
      );
    return ok;
  }
  if (sub === "find") {
    if (!args.length) return { lines: ["usage: zeema catalogue find <words...>"], code: 2 };
    const words = args.map((w) => w.toLowerCase());
    const rows = Object.values(cat.components).filter((c) => {
      const hay =
        `${c.id} ${name(cat, c.id)} ${cat.locale.components[c.id]?.description ?? ""} ${c.kind} ${c.provider}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    for (const c of rows)
      out.push(
        `${c.id.padEnd(40)} ${c.provider.padEnd(11)} ${c.kind.padEnd(24)} ${name(cat, c.id)}`,
      );
    if (!rows.length) return { lines: ["no component matched"], code: 1 };
    return ok;
  }
  if (sub === "component") {
    const c = cat.components[args[0]];
    if (!c) return { lines: [`unknown component ${args[0] ?? ""}`], code: 1 };
    const k = cat.kinds[c.kind];
    out.push(
      `${c.id}  (${name(cat, c.id)})`,
      `kind: ${c.kind}  category: ${k?.category}  provider: ${c.provider}`,
    );
    const desc = cat.locale.components[c.id]?.description;
    if (desc) out.push(desc);
    out.push("effective properties:");
    const defs = { ...(k?.properties ?? {}), ...(c.properties ?? {}) };
    for (const [p, d] of Object.entries(defs)) {
      const v = c.defaults?.[p] !== undefined ? c.defaults[p] : d.default;
      const src =
        c.defaults?.[p] !== undefined
          ? "component"
          : d.default !== undefined
            ? "kind"
            : d.required
              ? "REQUIRED"
              : "unset";
      out.push(
        `  ${p.padEnd(28)} ${d.type.padEnd(8)} ${String(v ?? "").padEnd(16)} ${src}${d.values ? `  [${d.values.join(", ")}]` : ""}`,
      );
    }
    return ok;
  }
  if (sub === "kind") {
    const k = cat.kinds[args[0]];
    if (!k) return { lines: [`unknown kind ${args[0] ?? ""}`], code: 1 };
    out.push(`${k.id}  category: ${k.category}`, "properties:");
    for (const [p, d] of Object.entries(k.properties))
      out.push(
        `  ${p.padEnd(28)} ${d.type.padEnd(8)} ${d.required ? "required" : d.default !== undefined ? `default ${d.default}` : "optional"}${d.values ? `  [${d.values.join(", ")}]` : ""}`,
      );
    out.push("components:");
    for (const prov of PROVIDERS) {
      const ids = Object.values(cat.components)
        .filter((c) => c.kind === k.id && c.provider === prov)
        .map((c) => c.id);
      if (ids.length) out.push(`  ${prov.padEnd(11)} ${ids.join(", ")}`);
    }
    return ok;
  }
  if (sub === "providers") {
    const k = cat.kinds[args[0]];
    if (!k) return { lines: [`unknown kind ${args[0] ?? ""}`], code: 1 };
    for (const prov of PROVIDERS) {
      const n = Object.values(cat.components).filter(
        (c) => c.kind === k.id && c.provider === prov,
      ).length;
      out.push(`${prov.padEnd(11)} ${n ? `${n} component${n === 1 ? "" : "s"}` : "none"}`);
    }
    return ok;
  }
  return {
    lines: [
      "usage: zeema catalogue find <words...> | component <id> | kind <id> | kinds | providers <kind>",
    ],
    code: 2,
  };
}
