// Arkore repository validator. Tooling only; v1 ships no code.
//   node validate.mjs                  whole repository (kinds, components, locale, icons, rules, designs)
//   node validate.mjs --design <file>  one design: schema + references + fired rules with messages (exit 1 only on structural problems)
// designs/reference/<id>/design.yaml must trip no rule and design.broken.yaml exactly the rules named in its header;
// designs/imported/<id>/design.yaml is checked structurally and its fired rules are reported.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import YAML from "yaml";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const only = args.includes("--design") ? path.resolve(args[args.indexOf("--design") + 1]) : null;
const ajv = new Ajv({ allErrors: true, strict: false });
const problems = [];
const fail = (m) => problems.push(m);
const loadSchema = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, "schema", n), "utf8"));
const kindSchema = loadSchema("kind.schema.json");
ajv.addSchema(kindSchema, "kind.schema.json");
const validators = {
  kind: ajv.compile(kindSchema),
  component: ajv.compile(loadSchema("component.schema.json")),
  design: ajv.compile(loadSchema("design.schema.json")),
  rule: ajv.compile(loadSchema("rule.schema.json")),
};

const walk = (dir) =>
  fs.existsSync(path.join(ROOT, dir))
    ? fs
        .readdirSync(path.join(ROOT, dir), { withFileTypes: true })
        .flatMap((d) =>
          d.isDirectory()
            ? walk(`${dir}/${d.name}`)
            : d.name.endsWith(".yaml")
              ? [`${dir}/${d.name}`]
              : [],
        )
    : [];
const loadOne = (rel, type, abs) => {
  const file = abs ?? path.join(ROOT, rel);
  const raw = fs.readFileSync(file, "utf8");
  let doc;
  try {
    doc = YAML.parse(raw);
  } catch (e) {
    fail(`${rel}: YAML ${e.message}`);
    return null;
  }
  const depth = rel.split("/").length - 1;
  const expect = `# yaml-language-server: $schema=${"../".repeat(depth)}schema/${type}.schema.json`;
  if (!abs && !raw.startsWith(expect)) fail(`${rel}: first line should be ${expect}`);
  if (!validators[type](doc)) fail(`${rel}: ${ajv.errorsText(validators[type].errors)}`);
  if (doc?.type !== type) fail(`${rel}: type ${doc?.type}`);
  if (type !== "design" && doc.id !== path.basename(rel, ".yaml"))
    fail(`${rel}: id ${doc.id} != filename`);
  if (type === "component" && rel.split("/")[1] !== doc.provider)
    fail(`${rel}: provider ${doc.provider} does not match folder`);
  return { file: rel, doc, raw };
};
const loadDir = (dir, type) =>
  walk(dir)
    .map((rel) => loadOne(rel, type))
    .filter(Boolean);

const kinds = Object.fromEntries(loadDir("kinds", "kind").map((x) => [x.doc.id, x.doc]));
const compList = loadDir("components", "component");
const components = Object.fromEntries(compList.map((x) => [x.doc.id, x.doc]));
if (compList.length !== Object.keys(components).length)
  fail("duplicate component ids across provider folders");
const rules = loadDir("rules", "rule").map((x) => x.doc);
const locale = YAML.parse(fs.readFileSync(path.join(ROOT, "locales/en.yaml"), "utf8"));

for (const k of Object.values(kinds))
  for (const [p, d] of Object.entries(k.properties)) {
    if (d.type === "enum" && d.default !== undefined && !d.values.includes(d.default))
      fail(`kind ${k.id}: default ${p} not in enum`);
    if (d.type === "ref" && !kinds[d.refKind]) fail(`kind ${k.id}: refKind ${d.refKind} unknown`);
  }
for (const c of Object.values(components)) {
  const k = kinds[c.kind];
  if (!k) {
    fail(`component ${c.id}: unknown kind ${c.kind}`);
    continue;
  }
  for (const key of Object.keys(c.defaults ?? {}))
    if (!k.properties[key]) fail(`component ${c.id}: default ${key} not on kind`);
  for (const key of Object.keys(c.properties ?? {}))
    if (k.properties[key]) fail(`component ${c.id}: redefines kind property ${key}`);
  for (const [key, v] of Object.entries(c.defaults ?? {})) {
    const def = k.properties[key];
    if (!def) continue;
    if (def.type === "enum" && !def.values.includes(v))
      fail(`component ${c.id}: default ${key}=${v} not in enum`);
    if (def.type === "boolean" && typeof v !== "boolean")
      fail(`component ${c.id}: default ${key} not boolean`);
    if (def.type === "integer" && !Number.isInteger(v))
      fail(`component ${c.id}: default ${key} not integer`);
    if (def.type === "string" && typeof v !== "string")
      fail(`component ${c.id}: default ${key} not string`);
  }
}
for (const id of Object.keys(kinds)) if (!locale.kinds?.[id]) fail(`locale missing kind ${id}`);
for (const id of Object.keys(components))
  if (!locale.components?.[id]) fail(`locale missing component ${id}`);
for (const r of rules) if (!locale.rules?.[r.id]) fail(`locale missing rule ${r.id}`);
for (const id of Object.keys(locale.components ?? {}))
  if (!components[id]) fail(`locale unknown component ${id}`);
for (const id of Object.keys(locale.rules ?? {}))
  if (!rules.find((r) => r.id === id)) fail(`locale unknown rule ${id}`);
for (const k of Object.values(kinds))
  if (!locale.categories?.[k.category]) fail(`locale missing category ${k.category}`);
// icons
const iconExists = (p) => fs.existsSync(path.join(ROOT, p));
for (const id of Object.keys(kinds))
  if (!iconExists(`icons/kinds/${id}.svg`)) fail(`icon missing for kind ${id}`);
for (const c of Object.values(components))
  if (!iconExists(`icons/components/${c.provider}/${c.id}.svg`))
    fail(`icon missing for component ${c.id} in icons/components/${c.provider}/`);
const iconWalk = (dir) =>
  fs
    .readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .flatMap((d) =>
      d.isDirectory()
        ? iconWalk(`${dir}/${d.name}`)
        : d.name.endsWith(".svg")
          ? [`${dir}/${d.name}`]
          : [],
    );
if (!only)
  for (const rel of iconWalk("icons/components")) {
    const [, , prov, file] = rel.split("/");
    const id = file.replace(".svg", "");
    if (!components[id]) fail(`${rel}: no component with id ${id}`);
    else if (components[id].provider !== prov)
      fail(`${rel}: component provider is ${components[id].provider}`);
    const s = fs.statSync(path.join(ROOT, rel)).size;
    if (s > 4096) fail(`${rel}: ${s} bytes`);
    const raw = fs.readFileSync(path.join(ROOT, rel), "utf8");
    if (!raw.includes('viewBox="0 0 24 24"') || /<script|onload=|<image|href=/i.test(raw))
      fail(`${rel}: bad svg`);
  }

// designs
const propDefs = (c) => ({ ...kinds[c.kind].properties, ...(c.properties ?? {}) });
const effective = (node) => {
  const c = components[node.component];
  const defs = propDefs(c);
  const out = {};
  for (const [k, d] of Object.entries(defs)) {
    if (node.props?.[k] !== undefined) out[k] = node.props[k];
    else if (c.defaults?.[k] !== undefined) out[k] = c.defaults[k];
    else if (d.default !== undefined) out[k] = d.default;
  }
  return out;
};
const kindOf = (node) => kinds[components[node.component].kind];
const checkDesign = ({ file, doc }) => {
  // A malformed list is reported, never thrown on: "edges:" with nothing under it parses as
  // null, and a validator that crashes on it tells nobody which file is wrong.
  for (const key of ["nodes", "edges"]) {
    if (!Array.isArray(doc[key])) {
      fail(`${file}: ${key} is not a list`);
      return false;
    }
  }
  if (doc.groups !== undefined && !Array.isArray(doc.groups)) {
    fail(`${file}: groups is not a list`);
    return false;
  }
  const nodeIds = new Set(doc.nodes.map((n) => n.id));
  const groupIds = new Set((doc.groups ?? []).map((g) => g.id));
  if (nodeIds.size !== doc.nodes.length) fail(`${file}: duplicate node ids`);
  if (groupIds.size !== (doc.groups ?? []).length) fail(`${file}: duplicate group ids`);
  for (const g of doc.groups ?? [])
    if (g.parent && !groupIds.has(g.parent)) fail(`${file}: group ${g.id} parent missing`);
  let ok = true;
  for (const n of doc.nodes) {
    const c = components[n.component];
    if (!c) {
      fail(`${file}: node ${n.id} unknown component ${n.component}`);
      ok = false;
      continue;
    }
    if (n.group && !groupIds.has(n.group)) fail(`${file}: node ${n.id} unknown group`);
    const defs = propDefs(c);
    for (const [k, v] of Object.entries(n.props ?? {})) {
      const d = defs[k];
      if (!d) {
        fail(`${file}: node ${n.id} unknown prop ${k}`);
        continue;
      }
      if (d.type === "enum" && !d.values.includes(v))
        fail(`${file}: node ${n.id} prop ${k}=${v} not in enum`);
      if (d.type === "boolean" && typeof v !== "boolean")
        fail(`${file}: node ${n.id} prop ${k} not boolean`);
      if (d.type === "integer" && !Number.isInteger(v))
        fail(`${file}: node ${n.id} prop ${k} not integer`);
      if (d.type === "string" && typeof v !== "string")
        fail(`${file}: node ${n.id} prop ${k} not string`);
      if (d.type === "ref") {
        const t = doc.nodes.find((x) => x.id === v);
        if (!t) fail(`${file}: ref ${k} missing`);
        else if (components[t.component]?.kind !== d.refKind) fail(`${file}: ref ${k} wrong kind`);
      }
    }
    const eff = effective(n);
    for (const [k, d] of Object.entries(defs))
      if (d.required && eff[k] === undefined) fail(`${file}: node ${n.id} missing required ${k}`);
  }
  for (const e of doc.edges)
    for (const end of ["from", "to"])
      if (!nodeIds.has(e[end])) {
        fail(`${file}: edge ${end} ${e[end]} missing`);
        ok = false;
      }
  return ok;
};
const ancestry = (doc, node) => {
  const out = [];
  let g = (doc.groups ?? []).find((x) => x.id === node.group);
  while (g) {
    out.push(g);
    g = (doc.groups ?? []).find((x) => x.id === g.parent);
  }
  return out;
};
const syncDepth = (doc, id, seen = new Set()) => {
  if (seen.has(id)) return 0;
  seen.add(id);
  let best = 0;
  for (const e of doc.edges)
    if (e.from === id && e.mode === "sync")
      best = Math.max(best, 1 + syncDepth(doc, e.to, new Set(seen)));
  return best;
};
const cmp = (c, v) =>
  v === undefined
    ? false
    : c.eq !== undefined
      ? v === c.eq
      : c.gt !== undefined
        ? v > c.gt
        : v < c.lt;
const get = (o, p) => p.split(".").reduce((a, k) => a?.[k], o);
const scalarTest = (p, v) => {
  if (p.exists !== undefined) return (v !== undefined) === p.exists;
  if (p.in) return p.in.includes(v);
  if (p.gt !== undefined) return typeof v === "number" && v > p.gt;
  if (p.lt !== undefined) return typeof v === "number" && v < p.lt;
  return v === p.equals;
};
const nodeById = (doc, id) => doc.nodes.find((n) => n.id === id);
const matchKind = (w, n) => [].concat(w).includes(kindOf(n).id);
const matchCat = (w, n) => [].concat(w).includes(kindOf(n).category);
const evalPred = (p, ctx) => {
  const { doc, node, edge } = ctx;
  if (p.all) return p.all.every((x) => evalPred(x, ctx));
  if (p.any) return p.any.some((x) => evalPred(x, ctx));
  if (p.not) return !evalPred(p.not, ctx);
  if (p.prop) return scalarTest(p, effective(node)[p.prop]);
  if (p.field) return scalarTest(p, edge[p.field]);
  if (p.requirement) return scalarTest(p, get(doc.requirements ?? {}, p.requirement));
  if (p.nfr) {
    const [k, c] = Object.entries(p.nfr)[0];
    return cmp(c, node?.nfr?.[k]);
  }
  if (p.hasEdge) {
    const h = p.hasEdge;
    const n = doc.edges.filter((e) => {
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
      if (h.peerKind && !matchKind(h.peerKind, peer)) return false;
      if (h.peerCategory && !matchCat(h.peerCategory, peer)) return false;
      return true;
    }).length;
    return h.count ? cmp(h.count, n) : n > 0;
  }
  if (p.hasNode)
    return doc.nodes.some(
      (n) =>
        (!p.hasNode.kind || matchKind(p.hasNode.kind, n)) &&
        (!p.hasNode.category || matchCat(p.hasNode.category, n)),
    );
  if (p.inGroup) {
    const n = ancestry(doc, node).filter((g) => g.kind === p.inGroup.kind).length;
    return p.inGroup.count ? cmp(p.inGroup.count, n) : n > 0;
  }
  if (p.syncChainDepth) return cmp(p.syncChainDepth, syncDepth(doc, node.id));
  if (p.from) return evalPred(p.from, { doc, node: nodeById(doc, edge.from) });
  if (p.to) return evalPred(p.to, { doc, node: nodeById(doc, edge.to) });
  if (p.crossesGroup) {
    const gOf = (id) =>
      ancestry(doc, nodeById(doc, id)).find((g) => g.kind === p.crossesGroup.kind)?.id;
    const a = gOf(edge.from),
      b = gOf(edge.to);
    return a !== b || a === undefined;
  }
  throw new Error("unknown predicate " + JSON.stringify(p));
};
const render = (tpl, ctx) =>
  String(tpl ?? "").replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, p) => {
    const v = get(ctx, p);
    return v === undefined ? `{{${p}}}` : String(v);
  });
// returns [{ id, severity, message }], one entry per hit
const runRules = (doc) => {
  const hits = [];
  for (const r of rules) {
    try {
      if (r.select.node) {
        for (const node of doc.nodes) {
          if (r.select.node.kind && !matchKind(r.select.node.kind, node)) continue;
          if (r.select.node.category && !matchCat(r.select.node.category, node)) continue;
          if (evalPred(r.when, { doc, node }))
            hits.push({
              id: r.id,
              severity: r.severity,
              message: render(r.message, { node, design: doc }),
            });
        }
      } else if (r.select.edge) {
        for (const edge of doc.edges) {
          if (r.select.edge.mode && edge.mode !== r.select.edge.mode) continue;
          if (r.select.edge.delivery && edge.delivery !== r.select.edge.delivery) continue;
          if (evalPred(r.when, { doc, edge }))
            hits.push({
              id: r.id,
              severity: r.severity,
              message: render(r.message, { edge, design: doc }),
            });
        }
      } else if (r.select.design) {
        if (evalPred(r.when, { doc }))
          hits.push({
            id: r.id,
            severity: r.severity,
            message: render(r.message, { design: doc }),
          });
      }
    } catch (e) {
      fail(`rule ${r.id} on ${doc.id}: ${e.message}`);
    }
  }
  return hits;
};
const ruleIds = new Set(rules.map((r) => r.id));
for (const r of rules) {
  for (const k of [].concat(r.select.node?.kind ?? []))
    if (!kinds[k]) fail(`rule ${r.id}: unknown kind ${k}`);
  const w = (p) => {
    if (!p || typeof p !== "object") return;
    for (const k of [].concat(p.hasEdge?.peerKind ?? [], p.hasNode?.kind ?? []))
      if (!kinds[k]) fail(`rule ${r.id}: unknown kind ${k}`);
    for (const v of Object.values(p)) Array.isArray(v) ? v.forEach(w) : w(v);
  };
  w(r.when);
}

if (only) {
  const rel = path.relative(ROOT, only).split(path.sep).join("/");
  const d = loadOne(rel, "design", only);
  if (d && checkDesign(d)) {
    const hits = runRules(d.doc);
    console.log(
      `${rel}: nodes=${d.doc.nodes.length} edges=${d.doc.edges.length} groups=${(d.doc.groups ?? []).length}`,
    );
    console.log(hits.length ? `rules fired (${hits.length}):` : "rules fired: none");
    for (const h of hits) console.log(` - [${h.severity}] ${h.id}: ${h.message}`);
  }
} else {
  const folders = (tier) => {
    const dir = path.join(ROOT, "designs", tier);
    return fs.existsSync(dir)
      ? fs
          .readdirSync(dir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
      : [];
  };
  const loadDesign = (tier, id, file) => {
    const rel = `designs/${tier}/${id}/${file}`;
    if (!fs.existsSync(path.join(ROOT, rel))) {
      fail(`${rel}: missing`);
      return null;
    }
    const d = loadOne(rel, "design");
    if (d && d.doc.id !== id) fail(`${rel}: id ${d.doc.id} != folder name ${id}`);
    return d;
  };
  const designs = folders("reference")
    .flatMap((id) => [
      loadDesign("reference", id, "design.yaml"),
      loadDesign("reference", id, "design.broken.yaml"),
    ])
    .filter(Boolean);
  const expectedFor = (file, raw) => {
    if (!file.endsWith(".broken.yaml")) return [];
    const header = raw
      .split("\n")
      .filter((l) => l.startsWith("#"))
      .join("\n");
    const [tripPart] = header.split(/MUST NOT/i);
    const idx = tripPart.search(/MUST trip/i);
    const seg = idx >= 0 ? tripPart.slice(idx) : "";
    return [
      ...new Set(
        [...seg.matchAll(/([a-z][a-z0-9-]+)/g)].map((m) => m[1]).filter((x) => ruleIds.has(x)),
      ),
    ];
  };
  for (const d of designs) {
    if (!checkDesign(d)) continue;
    const fired = [...new Set(runRules(d.doc).map((h) => h.id))].sort();
    const exp = expectedFor(d.file, d.raw).sort();
    const ok = JSON.stringify(fired) === JSON.stringify(exp);
    console.log(`${ok ? "OK  " : "FAIL"} ${d.file}: [${fired.join(", ")}]`);
    if (!ok) fail(`${d.file}: expected [${exp.join(", ")}]`);
  }
  const allFired = new Set(designs.flatMap(({ doc }) => runRules(doc).map((h) => h.id)));
  for (const r of rules) if (!allFired.has(r.id)) fail(`rule ${r.id} tripped by no design`);
  const imported = folders("imported")
    .map((id) => loadDesign("imported", id, "design.yaml"))
    .filter(Boolean);
  // designs/authored/<id>/ holds designs made in the canvas: no external source, so no
  // mapping.yaml, and no broken twin, so no rule expectations. Structure still has to hold.
  const authored = folders("authored")
    .map((id) => loadDesign("authored", id, "design.yaml"))
    .filter(Boolean);
  for (const d of imported) {
    if (!fs.existsSync(path.join(ROOT, path.dirname(d.file), "mapping.yaml")))
      fail(`${d.file}: mapping.yaml missing`);
    if (checkDesign(d)) {
      const fired = [...new Set(runRules(d.doc).map((h) => h.id))].sort();
      console.log(`IMP  ${d.file}: [${fired.join(", ")}]`);
    }
  }
  for (const d of authored) {
    if (!checkDesign(d)) continue;
    const fired = [...new Set(runRules(d.doc).map((h) => h.id))].sort();
    console.log(`AUT  ${d.file}: [${fired.join(", ")}]`);
  }
  const byProv = {};
  for (const c of Object.values(components)) byProv[c.provider] = (byProv[c.provider] ?? 0) + 1;
  console.log(
    `\nkinds=${Object.keys(kinds).length} components=${Object.keys(components).length} ${JSON.stringify(byProv)} rules=${rules.length} reference=${designs.length / 2} imported=${imported.length} authored=${authored.length}`,
  );
}
if (problems.length) {
  console.log(`\nPROBLEMS (${problems.length}):`);
  problems.forEach((p) => console.log(" - " + p));
  process.exit(1);
}
console.log("all checks passed");
