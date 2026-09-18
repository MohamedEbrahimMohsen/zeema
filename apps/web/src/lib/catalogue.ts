// The catalogue for the server: loaded once per process from the repository files (or the
// built bundle), same shape the browser gets from /catalogue/*.json.
import fs from "node:fs";
import path from "node:path";
import { designIndex, iconMap, loadCatalogue, resolveRoot } from "@zeema/catalogue";

export type Catalogue = {
  kinds: Record<string, { id: string; category: string; properties: Record<string, PropertyDef> }>;
  components: Record<
    string,
    {
      id: string;
      kind: string;
      provider: string;
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
export type LocaleEntry = { name?: string; description?: string };

type Holder = { cat?: Catalogue & { root: string }; icons?: Record<string, string> };
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

export function componentName(cat: Catalogue, id: string) {
  return cat.locale.components[id]?.name ?? id;
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
