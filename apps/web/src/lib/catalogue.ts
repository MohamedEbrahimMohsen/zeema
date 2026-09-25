// The catalogue for the server: loaded once per process from the repository files (or the
// built bundle), same shape the browser gets from /catalogue/*.json.
import fs from "node:fs";
import path from "node:path";
import { designIndex, iconMap, loadCatalogue, loadSources, resolveRoot } from "@zeema/catalogue";
import { own } from "./own";

export type Catalogue = {
  kinds: Record<string, { id: string; category: string; properties: Record<string, PropertyDef> }>;
  components: Record<
    string,
    {
      id: string;
      kind: string;
      provider: string;
      /** Official documentation page for the product; absent when none is recorded. */
      docs?: string;
      /** Other names the vendor's own docs use: abbreviations (DCR) and nicknames (S3). */
      aliases?: string[];
      defaults: Record<string, unknown>;
      properties: Record<string, PropertyDef>;
    }
  >;
  rules: Array<{ id: string; severity: string; select: unknown; when: unknown; message: string }>;
  locale: {
    categories: Record<string, LocaleEntry>;
    kinds: Record<string, LocaleEntry>;
    components: Record<string, LocaleEntry>;
    rules: Record<string, LocaleEntry>;
    /** Names of the group icons in icons/boundaries/, keyed by file name. The user-facing word
     *  is group; boundary stays in the stored format. */
    boundaryIcons?: Record<string, LocaleEntry>;
  };
  schema: unknown;
};
export type PropertyDef = {
  type: string;
  values?: string[];
  default?: unknown;
  required?: boolean;
  refKind?: string;
};
export type LocaleEntry = { name?: string; description?: string; rationale?: string };

type Holder = {
  cat?: Catalogue & { root: string };
  icons?: Record<string, string>;
  sources?: Sources;
};
const g = globalThis as unknown as { __zeemaCat?: Holder };
if (!g.__zeemaCat) g.__zeemaCat = {};
const holder: Holder = g.__zeemaCat;

export function repoRoot() {
  return resolveRoot(process.env.ZEEMA_ROOT);
}

export function getCatalogue(): Catalogue & { root: string } {
  if (!holder.cat) {
    const built = path.join(process.cwd(), "public", "catalogue", "catalogue.json");
    const root = repoRoot();
    if (fs.existsSync(built))
      holder.cat = { ...(JSON.parse(fs.readFileSync(built, "utf8")) as Catalogue), root };
    else {
      const loaded = loadCatalogue(root) as unknown as Catalogue & { root: string; files: unknown };
      const { files: _files, ...rest } = loaded;
      holder.cat = rest;
    }
  }
  return holder.cat;
}

/**
 * The icon map (icons.json): component ids, `kind:<id>` and `boundary:<id>`, each the inner markup
 * of its SVG. The render route and the design page pass it whole to the engine renderer, which
 * looks up a group's icon reference in it, so a new namespace needs nothing here.
 */
export function getIcons(): Record<string, string> {
  if (!holder.icons) {
    const built = path.join(process.cwd(), "public", "catalogue", "icons.json");
    if (fs.existsSync(built)) holder.icons = JSON.parse(fs.readFileSync(built, "utf8"));
    else
      holder.icons = (
        iconMap(loadCatalogue(repoRoot())) as { icons: Record<string, string> }
      ).icons;
  }
  return holder.icons ?? {};
}

export type Sources = {
  kinds: Record<string, string>;
  components: Record<string, string>;
  rules: Record<string, string>;
};

/**
 * The verbatim YAML of every kind, component and rule, loaded once per process from the
 * server-only `sources.json` the bundle build writes (or straight from the repository in
 * development). It is deliberately not part of catalogue.json: it is about as large again as the
 * whole bundle and no browser needs it. The catalogue reference pages show it, and hand it to
 * agents in the markdown rendering, so a reader can copy the exact bytes on disk.
 */
export function getSources(): Sources {
  if (!holder.sources) {
    const built = path.join(process.cwd(), "public", "catalogue", "sources.json");
    if (fs.existsSync(built)) holder.sources = JSON.parse(fs.readFileSync(built, "utf8"));
    else holder.sources = loadSources(repoRoot()) as Sources;
  }
  return holder.sources ?? { kinds: {}, components: {}, rules: {} };
}

export function componentName(cat: Catalogue, id: string) {
  return own(cat.locale.components, id)?.name ?? id;
}

export function repoDesigns() {
  const root = repoRoot();
  return (
    designIndex(root) as Array<{
      path: string;
      tier: string;
      id: string;
      broken: boolean;
      layout: string;
    }>
  ).map((e) => ({
    ...e,
    yaml: fs.readFileSync(path.join(root, e.path), "utf8"),
    layout: fs.existsSync(path.join(root, e.layout))
      ? JSON.parse(fs.readFileSync(path.join(root, e.layout), "utf8"))
      : null,
    notes: fs.existsSync(path.join(root, path.dirname(e.path), "notes.md"))
      ? fs.readFileSync(path.join(root, path.dirname(e.path), "notes.md"), "utf8")
      : null,
  }));
}
