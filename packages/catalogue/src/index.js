// The catalogue as data: read kinds/, components/, rules/, locales/, schema/ and designs/ from a
// repository root and hand back the same shape the compiled bundle has, so every consumer sees one
// catalogue whether it loaded the files or the bundle.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

export const DEFAULT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
export const TIERS = ["reference", "imported", "authored"];
export const PROVIDERS = [
  "aws",
  "azure",
  "gcp",
  "oci",
  "cloudflare",
  "ibm",
  "alibabacloud",
  "digitalocean",
  "openstack",
  "outscale",
  "k8s",
  "default",
];

export const resolveRoot = (root) => path.resolve(root ?? process.env.ZEEMA_ROOT ?? DEFAULT_ROOT);

/** Recursive walk returning root-relative POSIX paths with the extension, sorted. */
export function walk(root, dir, ext) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .flatMap((d) =>
      d.isDirectory()
        ? walk(root, `${dir}/${d.name}`, ext)
        : d.name.endsWith(ext)
          ? [`${dir}/${d.name}`]
          : [],
    )
    .sort();
}

/** Deep key sort; arrays keep their order (enum value order is load-bearing). */
export function sorted(v) {
  if (Array.isArray(v)) return v.map(sorted);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sorted(v[k]);
    return out;
  }
  return v;
}

export function readYaml(root, rel) {
  return YAML.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

/** Every design file on disk, as the index the canvas and the platform seed from. */
export function designIndex(root) {
  const out = [];
  for (const tier of TIERS) {
    const dir = path.join(root, "designs", tier);
    if (!fs.existsSync(dir)) continue;
    for (const id of fs.readdirSync(dir).sort()) {
      if (!fs.statSync(path.join(dir, id)).isDirectory()) continue;
      for (const file of ["design.yaml", "design.broken.yaml"]) {
        const rel = `designs/${tier}/${id}/${file}`;
        if (!fs.existsSync(path.join(root, rel))) continue;
        out.push({
          path: rel,
          tier,
          id,
          broken: file.includes(".broken."),
          editable: tier === "authored" && file === "design.yaml",
          layout: rel.replace(/\.yaml$/, ".layout.json"),
        });
      }
    }
  }
  return out;
}

/**
 * Load the catalogue from source files. Returns the bundle shape plus `files` (the raw documents
 * with their relative paths) for the validator's file-level checks, and `root`.
 */
export function loadCatalogue(rootArg) {
  const root = resolveRoot(rootArg);
  const files = { kinds: [], components: [], rules: [] };
  const kinds = {};
  for (const rel of walk(root, "kinds", ".yaml")) {
    const doc = readYaml(root, rel);
    files.kinds.push({ rel, doc });
    kinds[doc.id] = {
      id: doc.id,
      category: doc.category,
      properties: sorted(doc.properties ?? {}),
    };
  }
  const components = {};
  for (const rel of walk(root, "components", ".yaml")) {
    const doc = readYaml(root, rel);
    files.components.push({ rel, doc });
    components[doc.id] = {
      id: doc.id,
      kind: doc.kind,
      provider: doc.provider,
      ...(doc.docs ? { docs: doc.docs } : {}),
      // Kept in file order: an alias list reads as the vendor writes it (DCR before "rule"),
      // and `sorted` leaves arrays alone on purpose.
      ...(doc.aliases?.length ? { aliases: doc.aliases } : {}),
      defaults: sorted(doc.defaults ?? {}),
      properties: sorted(doc.properties ?? {}),
    };
  }
  const rules = [];
  for (const rel of walk(root, "rules", ".yaml")) {
    const doc = readYaml(root, rel);
    files.rules.push({ rel, doc });
    rules.push({
      id: doc.id,
      severity: doc.severity,
      select: sorted(doc.select),
      when: sorted(doc.when),
      message: doc.message,
    });
  }
  rules.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const en = readYaml(root, "locales/en.yaml");
  const locale = sorted({
    categories: en.categories ?? {},
    kinds: en.kinds ?? {},
    components: en.components ?? {},
    rules: en.rules ?? {},
    boundaryIcons: en.boundaryIcons ?? {},
    providers: en.providers ?? {},
    groupKinds: en.groupKinds ?? {},
  });
  const schema = sorted(
    JSON.parse(fs.readFileSync(path.join(root, "schema", "design.schema.json"), "utf8")),
  );
  return {
    root,
    kinds: sorted(kinds),
    components: sorted(components),
    rules,
    locale,
    schema,
    files,
  };
}

/**
 * The verbatim source text of every kind, component and rule, keyed by id inside its type.
 * Kept out of `toBundle` on purpose: it is roughly the size of the whole bundle again and no
 * browser needs it. `build.js` writes it beside catalogue.json as the server-only `sources.json`,
 * which the reference pages read to show (and hand to agents) the exact bytes on disk.
 */
export function loadSources(rootArg) {
  const root = resolveRoot(rootArg);
  const out = { kinds: {}, components: {}, rules: {} };
  for (const [dir, bucket] of [
    ["kinds", "kinds"],
    ["components", "components"],
    ["rules", "rules"],
  ])
    for (const rel of walk(root, dir, ".yaml")) {
      const id = path.basename(rel, ".yaml");
      out[bucket][id] = fs.readFileSync(path.join(root, rel), "utf8");
    }
  return out;
}

/** The bundle a client loads: the catalogue without `files` and `root`. */
export function toBundle(cat) {
  const { kinds, components, rules, locale, schema } = cat;
  return { kinds, components, rules, locale, schema };
}

/**
 * One search row per component: [id, name, kind, category, provider, haystack].
 * The haystack carries the kind name and the aliases too, so "dcr" finds the data collection rule.
 * Match it with `scoreRow` from @zeema/core/search, which also knows the synonyms.
 */
export function searchRows(cat) {
  return Object.keys(cat.components)
    .sort()
    .map((id) => {
      const c = cat.components[id];
      const text = cat.locale.components[id] ?? {};
      const name = text.name ?? "";
      const description = text.description ?? "";
      const category = cat.kinds[c.kind] ? cat.kinds[c.kind].category : "";
      // The kind name rides too, so "database" (and "db" through its synonym) finds every
      // database whatever its description says.
      const kindName = cat.locale.kinds?.[c.kind]?.name ?? "";
      // Aliases ride in the haystack (so they match) and again in their own field (so the
      // palette can score a "dcr" prefix as heavily as it scores a name).
      const aliases = (c.aliases ?? []).join(" ").toLowerCase();
      return [
        id,
        name,
        c.kind,
        category,
        c.provider,
        `${id} ${name} ${description} ${kindName} ${aliases}`.trim().toLowerCase(),
        aliases,
      ];
    });
}

const inner = (raw, rel) => {
  const open = raw.indexOf("<svg");
  const gt = open < 0 ? -1 : raw.indexOf(">", open);
  const close = raw.lastIndexOf("</svg>");
  if (gt < 0 || close < 0 || close < gt) throw new Error(`${rel}: not an svg`);
  return raw.slice(gt + 1, close);
};

/**
 * The ids of the group icon set, from the file names under icons/boundaries/, sorted. There is
 * no manifest: the folder is the set, and locales/en.yaml `boundaryIcons` names each one.
 * The user-facing word is group; boundary stays in the stored format.
 */
export function boundaryIconIds(rootArg) {
  const root = resolveRoot(rootArg);
  return walk(root, "icons/boundaries", ".svg").map((rel) => path.basename(rel, ".svg"));
}

/**
 * The provider ids, from the folder names under components/, sorted. The folder is the set, and
 * locales/en.yaml `providers` names each one.
 */
export function providerFolderIds(rootArg) {
  const root = resolveRoot(rootArg);
  return fs
    .readdirSync(path.join(root, "components"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** Provider ids whose mark has another file name under icons/providers. */
export const PROVIDER_MARK_FILE = { gcp: "googlecloud", k8s: "kubernetes" };

/**
 * Each provider mark's drawing bounds inside its 24-unit box, [x, y, width, height], measured
 * with getBBox. The neutral cloud marks fill only the upper middle of the box, so drawn as-is
 * they look small and high; the picker crops every mark to its drawing so all sit level and
 * read the same size. Re-measure when a file under icons/providers changes.
 */
export const PROVIDER_MARK_BOX = {
  alibabacloud: [0, 4.52, 24, 14.97],
  aws: [4.66, 4.8, 16.2, 10.6],
  azure: [4.66, 4.8, 16.2, 10.6],
  cloudflare: [0, 6.58, 24, 10.85],
  digitalocean: [0, 0, 24, 24],
  gcp: [0, 2.38, 24, 19.25],
  ibm: [4.66, 4.8, 16.2, 10.6],
  k8s: [0, 0.35, 24, 23.28],
  oci: [0, 5, 24, 14],
  openstack: [0, 0.26, 24, 23.48],
  outscale: [4.66, 4.8, 16.2, 10.6],
};

// A viewBox cropped to a mark's drawing with 4% of its longer side as margin.
const markViewBox = ([x, y, w, h]) => {
  const pad = Math.max(w, h) * 0.04;
  const r = (v) => Math.round(v * 100) / 100;
  return [x - pad, y - pad, w + 2 * pad, h + 2 * pad].map(r).join(" ");
};

/**
 * Icon inner markup keyed by component id, `kind:<id>`, `boundary:<id>` and `provider:<id>`
 * (every provider folder but `default`); `missing` lists
 * absent files. Group icons are not tied to any catalogue entry, so the folder decides which
 * exist and none can be missing.
 */
export function iconMap(cat) {
  const icons = {};
  const missing = [];
  for (const id of Object.keys(cat.components).sort()) {
    const rel = `icons/components/${cat.components[id].provider}/${id}.svg`;
    const abs = path.join(cat.root, rel);
    if (!fs.existsSync(abs)) {
      missing.push(rel);
      continue;
    }
    icons[id] = inner(fs.readFileSync(abs, "utf8"), rel);
  }
  for (const id of Object.keys(cat.kinds).sort()) {
    const rel = `icons/kinds/${id}.svg`;
    const abs = path.join(cat.root, rel);
    if (!fs.existsSync(abs)) {
      missing.push(rel);
      continue;
    }
    icons[`kind:${id}`] = inner(fs.readFileSync(abs, "utf8"), rel);
  }
  for (const id of boundaryIconIds(cat.root)) {
    const rel = `icons/boundaries/${id}.svg`;
    icons[`boundary:${id}`] = inner(fs.readFileSync(path.join(cat.root, rel), "utf8"), rel);
  }
  // The brand mark of every provider but `default`, which has none: the picker shows it on each
  // row. The root fill moves onto a group so the mark keeps its colour inside another <svg>, the
  // title goes, so a row's own tooltip is the only one, and the box is cropped to the drawing.
  for (const id of providerFolderIds(cat.root)) {
    if (id === "default") continue;
    const rel = `icons/providers/${PROVIDER_MARK_FILE[id] ?? id}.svg`;
    const abs = path.join(cat.root, rel);
    if (!fs.existsSync(abs)) {
      missing.push(rel);
      continue;
    }
    const raw = fs.readFileSync(abs, "utf8");
    const open = raw.indexOf("<svg");
    const fill = /\sfill="(#[0-9a-fA-F]{3,8})"/.exec(raw.slice(open, raw.indexOf(">", open)))?.[1];
    const body = inner(raw, rel).replace(/<title>[\s\S]*?<\/title>/g, "");
    const mark = fill ? `<g fill="${fill}">${body}</g>` : body;
    // Cropped by a nested <svg>, which centres the drawing in whatever box the page gives it.
    const box = PROVIDER_MARK_BOX[id];
    icons[`provider:${id}`] = box
      ? `<svg viewBox="${markViewBox(box)}" width="24" height="24">${mark}</svg>`
      : mark;
  }
  return { icons: sorted(icons), missing };
}
