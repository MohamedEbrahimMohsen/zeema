// Build the bundle: catalogue.json, search.json, designs.json, icons.json.
//   node src/build.js [--out <dir>] [--root <repo>]
// Deterministic: sorted keys, sorted walks, no timestamps. Regenerating over an unchanged
// repository is byte identical, and a test asserts it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { designIndex, iconMap, loadCatalogue, resolveRoot, searchRows, toBundle } from "./index.js";

export const BUNDLE_FILES = ["catalogue.json", "search.json", "designs.json", "icons.json"];

export function buildBundle(rootArg) {
  const cat = loadCatalogue(rootArg);
  const { icons, missing } = iconMap(cat);
  return {
    "catalogue.json": { value: toBundle(cat), indent: 0 },
    "search.json": { value: searchRows(cat), indent: 0 },
    "designs.json": { value: designIndex(cat.root), indent: 2 },
    "icons.json": { value: icons, indent: 0 },
    missing,
    counts: {
      kinds: Object.keys(cat.kinds).length,
      components: Object.keys(cat.components).length,
      rules: cat.rules.length,
    },
  };
}

export function renderBundle(rootArg) {
  const b = buildBundle(rootArg);
  const texts = {};
  for (const name of BUNDLE_FILES)
    texts[name] = `${JSON.stringify(b[name].value, null, b[name].indent)}\n`;
  return { texts, missing: b.missing, counts: b.counts };
}

export function writeBundle(outDir, rootArg) {
  const { texts, missing, counts } = renderBundle(rootArg);
  fs.mkdirSync(outDir, { recursive: true });
  const sizes = {};
  for (const name of BUNDLE_FILES) {
    fs.writeFileSync(path.join(outDir, name), texts[name], "utf8");
    sizes[name] = Buffer.byteLength(texts[name], "utf8");
  }
  return { sizes, missing, counts };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const arg = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const root = resolveRoot(arg("--root"));
  const out = path.resolve(
    arg("--out") ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist"),
  );
  const { sizes, missing, counts } = writeBundle(out, root);
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  console.log(
    `${path.relative(root, out) || "."}: ${Object.entries(sizes)
      .map(([k, v]) => `${k} ${kb(v)}`)
      .join(", ")} (${counts.kinds} kinds, ${counts.components} components, ${counts.rules} rules)`,
  );
  if (missing.length) {
    console.error(`missing ${missing.length} icon file(s), first: ${missing[0]}`);
    process.exit(1);
  }
}
