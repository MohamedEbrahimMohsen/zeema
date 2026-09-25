// The palette's filters are tokens in its query, so a typed `provider:aws` and the Provider
// select are one piece of state, and the canvas can point the palette somewhere by writing a
// query. These helpers rewrite that query and name what the selects offer.

export type FilterKey = "provider" | "kind" | "category";

/**
 * The query with every `key:` token removed and, when `value` is given, one `key:value` token
 * appended. Everything else the person typed stays, in order; runs of spaces collapse.
 */
export function setToken(query: string, key: FilterKey, value: string | null): string {
  const drop = new RegExp(`^${key}:`, "i");
  const words = query.split(/\s+/).filter((w) => w && !drop.test(w));
  if (value) words.push(`${key}:${value}`);
  return words.join(" ");
}

// Providers and categories are named in locales/en.yaml; the caller passes those names in. An id
// the locale does not name shows capitalised.
const capitalise = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const providerLabel = (id: string, names?: Record<string, string>) =>
  names?.[id] ?? capitalise(id);

export const categoryLabel = (id: string, names?: Record<string, string>) =>
  names?.[id] ?? capitalise(id);
