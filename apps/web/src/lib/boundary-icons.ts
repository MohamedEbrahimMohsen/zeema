// The boundary icon set: icons/boundaries/<id>.svg, keyed `boundary:<id>` in icons.json and named
// in locales/en.yaml under `boundaryIcons`. A boundary may show one of these before its label: a
// platform it stands for (an AWS account, a Kubernetes cluster) or a concept (on-premises, the
// internet, users). The folder is the set; nothing here lists what exists, only what to show
// first.

/** Shown, in this order, before the reader has typed anything; the rest follow by name. */
export const BOUNDARY_FEATURED = [
  "aws",
  "azure",
  "gcp",
  "kubernetes",
  "on-premises",
  "cloud",
  "internet",
  "users",
  "security",
  "region",
  "network",
  "ai",
] as const;

/** How many boundary icons the picker shows before any search. */
export const BOUNDARY_PREVIEW = BOUNDARY_FEATURED.length;

type LocaleEntry = { name?: string; description?: string };

/**
 * The boundary icons in `icons` as picker rows, in the palette's row shape
 * ([id, name, kind, category, provider, haystack, aliases]) so the palette's scoring applies
 * unchanged. Featured ids come first in their own order, then the rest by display name.
 */
export function boundaryRows(
  icons: Record<string, string>,
  names: Record<string, LocaleEntry> | undefined,
): Array<[string, string, string, string, string, string, string]> {
  const ids = Object.keys(icons)
    .filter((k) => k.startsWith("boundary:"))
    .map((k) => k.slice("boundary:".length));
  const nameOf = (id: string) =>
    String((names && Object.hasOwn(names, id) ? names[id]?.name : undefined) ?? id);
  const rank = (id: string) => {
    const i = (BOUNDARY_FEATURED as readonly string[]).indexOf(id);
    return i < 0 ? BOUNDARY_FEATURED.length : i;
  };
  return ids
    .sort((a, b) => rank(a) - rank(b) || nameOf(a).localeCompare(nameOf(b)))
    .map((id) => {
      const name = nameOf(id);
      const description =
        (names && Object.hasOwn(names, id) ? names[id]?.description : undefined) ?? "";
      const hay = `${id} ${name} ${description}`.toLowerCase();
      return [id, name, "", "", "", hay, ""];
    });
}
