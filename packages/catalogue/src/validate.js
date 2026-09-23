// The repository gate.
//   node src/validate.js                    whole repository
//   node src/validate.js --design <file>    one design: structure, then the rules that fire
//   node src/validate.js --root <repo>
// Design structure and rules come from @zeema/core; this file adds only what the core cannot
// know: schemas, file naming, provider folders, locale both ways, icons, reference twins and
// import mappings. Exit 1 on any problem, with every problem listed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runRules } from "@zeema/core/rules";
import { check } from "@zeema/core/structure";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import YAML from "yaml";
import { loadCatalogue, PROVIDERS, resolveRoot, walk } from "./index.js";

/** Icons are inlined into pages; one icon larger than this is a vendor file nobody trimmed. */
const ICON_MAX_BYTES = 4096;
/**
 * Markup no icon may carry: script, event handlers, links of any kind (`href`, `xlink:href`),
 * embedded images or documents, and `data:` URLs. An icon is paths and shapes.
 */
export const UNSAFE_SVG =
  /<script|\son[a-z]+\s*=|<image|href\s*=|<foreignObject|data:|javascript:/i;

/**
 * The alias checks, over the component documents as loaded.
 *
 * Aliases are the other names the vendor's own docs use for a product ("DCR", "S3"). The schema
 * has the shape (one to eight unique strings of one to forty characters); what JSON Schema cannot
 * see is case, and two aliases differing only in case are the same alias — a problem. An alias
 * that collides with another component's id or alias inside the same provider is a warning, not a
 * problem: where a vendor is ambiguous, search is allowed to be ambiguous too.
 */
export function aliasFindings(components) {
  const problems = [];
  const warnings = [];
  const list = Object.values(components);
  const aliasesOf = new Map();
  for (const c of list) {
    const seen = new Set();
    for (const a of c.aliases ?? []) {
      const key = String(a).toLowerCase();
      if (seen.has(key)) problems.push(`component ${c.id}: duplicate alias ${a}`);
      seen.add(key);
    }
    aliasesOf.set(c.id, seen);
  }
  // key -> the component ids that answer to it inside one provider, ids and aliases together.
  const claims = new Map();
  const claim = (provider, key, id) => {
    const k = `${provider}|${key}`;
    claims.set(k, [...(claims.get(k) ?? []), id]);
  };
  for (const c of list) {
    claim(c.provider, c.id.toLowerCase(), c.id);
    for (const key of aliasesOf.get(c.id)) claim(c.provider, key, c.id);
  }
  for (const c of list)
    for (const key of aliasesOf.get(c.id)) {
      const others = (claims.get(`${c.provider}|${key}`) ?? []).filter((x) => x !== c.id);
      if (others.length)
        warnings.push(
          `component ${c.id}: alias "${key}" is also ${others.join(", ")} in provider ${c.provider}`,
        );
    }
  return { problems, warnings };
}

export function validateRepository(rootArg, options = {}) {
  const root = resolveRoot(rootArg);
  const only = options.design ? path.resolve(options.design) : null;
  const log = options.log ?? console.log;
  const problems = [];
  const fail = (m) => problems.push(m);
  // A warning is a thing worth knowing that is not a reason to refuse the repository: it is
  // printed and returned, and the exit code ignores it.
  const warnings = [];
  const warn = (m) => {
    warnings.push(m);
    log(`WARN ${m}`);
  };

  const ajv = new Ajv({ allErrors: true, strict: false });
  // `format` keywords (component `docs` is `uri`) are otherwise ignored with a warning.
  addFormats(ajv);
  const loadSchema = (n) => JSON.parse(fs.readFileSync(path.join(root, "schema", n), "utf8"));
  const kindSchema = loadSchema("kind.schema.json");
  ajv.addSchema(kindSchema, "kind.schema.json");
  const validators = {
    kind: ajv.compile(kindSchema),
    component: ajv.compile(loadSchema("component.schema.json")),
    design: ajv.compile(loadSchema("design.schema.json")),
    rule: ajv.compile(loadSchema("rule.schema.json")),
  };

  const readOne = (rel, type, abs) => {
    const file = abs ?? path.join(root, rel);
    const raw = fs.readFileSync(file, "utf8");
    let doc;
    try {
      doc = YAML.parse(raw);
    } catch (e) {
      fail(`${rel}: YAML ${e.message}`);
      return null;
    }
    if (!doc || typeof doc !== "object") {
      fail(`${rel}: not a YAML mapping`);
      return null;
    }
    const depth = rel.split("/").length - 1;
    const expect = `# yaml-language-server: $schema=${"../".repeat(depth)}schema/${type}.schema.json`;
    if (!abs && !raw.startsWith(expect)) fail(`${rel}: first line should be ${expect}`);
    if (!validators[type](doc)) fail(`${rel}: ${ajv.errorsText(validators[type].errors)}`);
    if (doc.type !== type) fail(`${rel}: type ${doc.type}`);
    if (type !== "design" && doc.id !== path.basename(rel, ".yaml"))
      fail(`${rel}: id ${doc.id} != filename`);
    if (type === "component" && rel.split("/")[1] !== doc.provider)
      fail(`${rel}: provider ${doc.provider} does not match folder`);
    return { file: rel, doc, raw };
  };

  const cat = loadCatalogue(root);
  for (const list of ["kinds", "components", "rules"])
    for (const { rel } of cat.files[list]) readOne(rel, list.slice(0, -1));
  const kinds = Object.fromEntries(cat.files.kinds.map((x) => [x.doc.id, x.doc]));
  const components = Object.fromEntries(cat.files.components.map((x) => [x.doc.id, x.doc]));
  if (cat.files.components.length !== Object.keys(components).length)
    fail("duplicate component ids across provider folders");
  const rules = cat.files.rules.map((x) => x.doc);
  const locale = YAML.parse(fs.readFileSync(path.join(root, "locales/en.yaml"), "utf8"));

  for (const k of Object.values(kinds))
    for (const [p, d] of Object.entries(k.properties ?? {})) {
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
    if (!PROVIDERS.includes(c.provider)) fail(`component ${c.id}: unknown provider ${c.provider}`);
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
  const alias = aliasFindings(components);
  for (const m of alias.problems) fail(m);
  for (const m of alias.warnings) warn(m);

  // `docs` is an absolute http(s) URL or it is absent. No network call: a link that 404s is a
  // content problem for the inventory pass, not something the gate can decide offline.
  for (const c of Object.values(components)) {
    if (c.docs === undefined) continue;
    if (typeof c.docs !== "string" || !/^https?:\/\/\S+$/.test(c.docs))
      fail(`component ${c.id}: docs is not an absolute http(s) URL`);
  }

  for (const id of Object.keys(kinds)) if (!locale.kinds?.[id]) fail(`locale missing kind ${id}`);
  for (const id of Object.keys(components))
    if (!locale.components?.[id]) fail(`locale missing component ${id}`);
  // A rule's "why" is display text, so it lives here and not in the YAML header comment. The
  // reference pages and the markdown rendering both print it, so an absent one is a gate failure.
  for (const r of rules) {
    const t = locale.rules?.[r.id];
    if (!t) {
      fail(`locale missing rule ${r.id}`);
      continue;
    }
    if (!t.name) fail(`locale rule ${r.id}: name missing`);
    if (!t.rationale) fail(`locale rule ${r.id}: rationale missing`);
  }
  for (const id of Object.keys(locale.components ?? {}))
    if (!components[id]) fail(`locale unknown component ${id}`);
  for (const id of Object.keys(locale.rules ?? {}))
    if (!rules.find((r) => r.id === id)) fail(`locale unknown rule ${id}`);
  for (const id of Object.keys(locale.kinds ?? {}))
    if (!kinds[id]) fail(`locale unknown kind ${id}`);
  for (const k of Object.values(kinds))
    if (!locale.categories?.[k.category]) fail(`locale missing category ${k.category}`);

  const iconExists = (p) => fs.existsSync(path.join(root, p));
  for (const id of Object.keys(kinds))
    if (!iconExists(`icons/kinds/${id}.svg`)) fail(`icon missing for kind ${id}`);
  for (const c of Object.values(components))
    if (!iconExists(`icons/components/${c.provider}/${c.id}.svg`))
      fail(`icon missing for component ${c.id} in icons/components/${c.provider}/`);
  if (!only)
    for (const rel of walk(root, "icons/components", ".svg")) {
      const [, , prov, file] = rel.split("/");
      const id = file.replace(".svg", "");
      if (!components[id]) fail(`${rel}: no component with id ${id}`);
      else if (components[id].provider !== prov)
        fail(`${rel}: component provider is ${components[id].provider}`);
      const s = fs.statSync(path.join(root, rel)).size;
      if (s > ICON_MAX_BYTES) fail(`${rel}: ${s} bytes`);
      const raw = fs.readFileSync(path.join(root, rel), "utf8");
      if (!raw.includes('viewBox="0 0 24 24"') || UNSAFE_SVG.test(raw)) fail(`${rel}: bad svg`);
    }
  // Kind glyphs and provider marks are inlined into pages and served SVG exactly like component
  // icons (Icon.tsx, DesignCard, the render route), so they pass the same markup gate.
  if (!only)
    for (const rel of [
      ...walk(root, "icons/kinds", ".svg"),
      ...walk(root, "icons/providers", ".svg"),
    ]) {
      const s = fs.statSync(path.join(root, rel)).size;
      if (s > ICON_MAX_BYTES) fail(`${rel}: ${s} bytes`);
      if (UNSAFE_SVG.test(fs.readFileSync(path.join(root, rel), "utf8"))) fail(`${rel}: bad svg`);
    }

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

  // Designs: structure and rules through the one engine, with the file as message prefix.
  const checkDesign = ({ file, doc }) => {
    const findings = check(doc, cat, { file });
    for (const f of findings) fail(f.message);
    return findings.length === 0;
  };
  const fired = (doc) => {
    const hits = runRules(doc, cat);
    for (const h of hits) if (h.error) fail(`rule ${h.id} on ${doc.id}: ${h.message}`);
    return hits.filter((h) => !h.error);
  };
  const firedIds = (doc) => [...new Set(fired(doc).map((h) => h.id))].sort();

  if (only) {
    const rel = path.relative(root, only).split(path.sep).join("/");
    const d = readOne(rel, "design", only);
    if (d && checkDesign(d)) {
      const hits = fired(d.doc);
      log(
        `${rel}: nodes=${d.doc.nodes.length} edges=${d.doc.edges.length} groups=${(d.doc.groups ?? []).length}`,
      );
      log(hits.length ? `rules fired (${hits.length}):` : "rules fired: none");
      for (const h of hits) log(` - [${h.severity}] ${h.id}: ${h.message}`);
    }
  } else {
    const folders = (tier) => {
      const dir = path.join(root, "designs", tier);
      return fs.existsSync(dir)
        ? fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name)
            .sort()
        : [];
    };
    const loadDesign = (tier, id, file) => {
      const rel = `designs/${tier}/${id}/${file}`;
      if (!fs.existsSync(path.join(root, rel))) {
        fail(`${rel}: missing`);
        return null;
      }
      const d = readOne(rel, "design");
      if (d && d.doc.id !== id) fail(`${rel}: id ${d.doc.id} != folder name ${id}`);
      return d;
    };
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
    const reference = folders("reference")
      .flatMap((id) => [
        loadDesign("reference", id, "design.yaml"),
        loadDesign("reference", id, "design.broken.yaml"),
      ])
      .filter(Boolean);
    for (const d of reference) {
      if (!checkDesign(d)) continue;
      const got = firedIds(d.doc);
      const exp = expectedFor(d.file, d.raw).sort();
      const ok = JSON.stringify(got) === JSON.stringify(exp);
      log(`${ok ? "OK  " : "FAIL"} ${d.file}: [${got.join(", ")}]`);
      if (!ok) fail(`${d.file}: expected [${exp.join(", ")}]`);
    }
    const allFired = new Set(reference.flatMap(({ doc }) => firedIds(doc)));
    for (const r of rules) if (!allFired.has(r.id)) fail(`rule ${r.id} tripped by no design`);
    const imported = folders("imported")
      .map((id) => loadDesign("imported", id, "design.yaml"))
      .filter(Boolean);
    const authored = folders("authored")
      .map((id) => loadDesign("authored", id, "design.yaml"))
      .filter(Boolean);
    for (const d of imported) {
      if (!fs.existsSync(path.join(root, path.dirname(d.file), "mapping.yaml")))
        fail(`${d.file}: mapping.yaml missing`);
      if (checkDesign(d)) log(`IMP  ${d.file}: [${firedIds(d.doc).join(", ")}]`);
    }
    for (const d of authored)
      if (checkDesign(d)) log(`AUT  ${d.file}: [${firedIds(d.doc).join(", ")}]`);
    const byProv = {};
    for (const c of Object.values(components)) byProv[c.provider] = (byProv[c.provider] ?? 0) + 1;
    log(
      `\nkinds=${Object.keys(kinds).length} components=${Object.keys(components).length} ${JSON.stringify(byProv)} rules=${rules.length} reference=${reference.length / 2} imported=${imported.length} authored=${authored.length}`,
    );
  }
  return { ok: problems.length === 0, problems, warnings };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const arg = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  if (args.includes("--design") && !arg("--design")) {
    console.error("usage: validate [--root <repo>] [--design <file>]");
    process.exit(2);
  }
  const { ok, problems, warnings } = validateRepository(arg("--root"), {
    design: arg("--design"),
  });
  if (warnings.length) console.log(`\nWARNINGS (${warnings.length}) — listed above, not fatal.`);
  if (!ok) {
    console.log(`\nPROBLEMS (${problems.length}):`);
    for (const p of problems) console.log(` - ${p}`);
    process.exit(1);
  }
  console.log("all checks passed");
}
