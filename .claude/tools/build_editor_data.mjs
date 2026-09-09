// Arkore editor data generator.
//   node .claude/tools/build_editor_data.mjs
// Reads kinds/, components/, rules/, locales/en.yaml, schema/design.schema.json, icons/ and
// designs/, and writes editor/data/{catalogue,search,designs,icons}.json.
// Output is deterministic: every object key is sorted, no timestamps, no readdir-order leakage,
// so a regeneration over an unchanged repository is byte identical.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = process.argv.includes("--out")
  ? path.resolve(process.argv[process.argv.indexOf("--out") + 1])
  : path.join(ROOT, "editor", "data");

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const parseYaml = (rel) => YAML.parse(read(rel));

// Recursive directory walk returning repository-relative POSIX paths, sorted, so the result
// never depends on the order the filesystem hands entries back.
const walk = (dir, ext) => {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .flatMap((d) =>
      d.isDirectory() ? walk(`${dir}/${d.name}`, ext) : d.name.endsWith(ext) ? [`${dir}/${d.name}`] : [],
    )
    .sort();
};

// Deep key sort. Arrays keep their order: enum `values` order is load-bearing (the editor picks
// the first value for a required property that resolves to nothing) and `required` is a list.
const sorted = (v) => {
  if (Array.isArray(v)) return v.map(sorted);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sorted(v[k]);
    return out;
  }
  return v;
};

const write = (name, value, indent) => {
  const text = JSON.stringify(value, null, indent) + "\n";
  fs.writeFileSync(path.join(OUT, name), text, "utf8");
  return Buffer.byteLength(text, "utf8");
};

fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- catalogue

const kinds = {};
for (const rel of walk("kinds", ".yaml")) {
  const k = parseYaml(rel);
  kinds[k.id] = { id: k.id, category: k.category, properties: sorted(k.properties ?? {}) };
}

const components = {};
for (const rel of walk("components", ".yaml")) {
  const c = parseYaml(rel);
  components[c.id] = {
    id: c.id,
    kind: c.kind,
    provider: c.provider,
    defaults: sorted(c.defaults ?? {}),
    properties: sorted(c.properties ?? {}),
  };
}

const rules = walk("rules", ".yaml")
  .map((rel) => parseYaml(rel))
  .map((r) => ({ id: r.id, severity: r.severity, select: sorted(r.select), when: sorted(r.when), message: r.message }))
  .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

const en = parseYaml("locales/en.yaml");
const locale = sorted({
  categories: en.categories ?? {},
  kinds: en.kinds ?? {},
  components: en.components ?? {},
  rules: en.rules ?? {},
});

const schema = sorted(JSON.parse(read("schema/design.schema.json")));

const catalogue = {
  kinds: sorted(kinds),
  components: sorted(components),
  rules,
  locale,
  schema,
};

// ------------------------------------------------------------------- search

const search = Object.keys(components)
  .sort()
  .map((id) => {
    const c = components[id];
    const text = locale.components[id] ?? {};
    const name = text.name ?? "";
    const description = text.description ?? "";
    const category = kinds[c.kind] ? kinds[c.kind].category : "";
    return [id, name, c.kind, category, c.provider, `${id} ${name} ${description}`.toLowerCase()];
  });

// ------------------------------------------------------------------ designs

const tierFolders = (tier) => {
  const abs = path.join(ROOT, "designs", tier);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
};

const designs = [];
for (const tier of ["imported", "reference", "authored"]) {
  for (const id of tierFolders(tier)) {
    for (const file of ["design.yaml", "design.broken.yaml"]) {
      const rel = `designs/${tier}/${id}/${file}`;
      if (!fs.existsSync(path.join(ROOT, rel))) continue;
      designs.push({
        path: rel,
        tier,
        id,
        editable: file === "design.yaml",
        layout: rel.replace(/\.yaml$/, ".layout.json"),
      });
    }
  }
}

// --------------------------------------------------------------------- icons

const inner = (rel) => {
  const raw = read(rel);
  const open = raw.indexOf("<svg");
  const gt = open < 0 ? -1 : raw.indexOf(">", open);
  const close = raw.lastIndexOf("</svg>");
  if (gt < 0 || close < 0 || close < gt) throw new Error(`${rel}: not an svg`);
  return raw.slice(gt + 1, close);
};

const icons = {};
const missing = [];
for (const id of Object.keys(components).sort()) {
  const rel = `icons/components/${components[id].provider}/${id}.svg`;
  if (!fs.existsSync(path.join(ROOT, rel))) { missing.push(rel); continue; }
  icons[id] = inner(rel);
}
for (const id of Object.keys(kinds).sort()) {
  const rel = `icons/kinds/${id}.svg`;
  if (!fs.existsSync(path.join(ROOT, rel))) { missing.push(rel); continue; }
  icons[`kind:${id}`] = inner(rel);
}
if (missing.length) {
  console.error(`missing ${missing.length} icon file(s), first: ${missing[0]}`);
  process.exitCode = 1;
}

// -------------------------------------------------------------------- output

const sizes = {
  "catalogue.json": write("catalogue.json", catalogue, 0),
  "search.json": write("search.json", search, 0),
  "designs.json": write("designs.json", designs, 2),
  "icons.json": write("icons.json", sorted(icons), 0),
};
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(
  `editor/data: catalogue.json ${kb(sizes["catalogue.json"])} (${Object.keys(kinds).length} kinds, ` +
    `${Object.keys(components).length} components, ${rules.length} rules), ` +
    `search.json ${kb(sizes["search.json"])} (${search.length} rows), ` +
    `designs.json ${kb(sizes["designs.json"])} (${designs.length} rows), ` +
    `icons.json ${kb(sizes["icons.json"])} (${Object.keys(icons).length} icons)`,
);
