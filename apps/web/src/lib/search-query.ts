// One search box instead of a wall of filter chips. The box takes three kinds of word:
//
//   @owner   the designs of one person, or @zeema for the curated ones
//   #tag     a provider (#aws), a tier (#reference), a catalogue kind (#sql-database), or a
//            word an author put on their own design (#billing)
//   text     matched against the title, summary and component names
//
// The catalogue words win where a name is both: `#aws` is the provider, never somebody's tag.
// Anything else after a `#` is read as an author's tag, which is the only reading left once the
// catalogue has been asked. Parsing happens on the server, so the filters work with JavaScript
// off and a pasted URL is the whole state.

import type { Catalogue } from "./catalogue";
import { toTag } from "./slug";

export type ParsedQuery = {
  text: string;
  owner?: string;
  provider?: string;
  kind?: string;
  origin?: "authored" | "imported" | "reference";
  /** A word an author put on their design, which the catalogue knows nothing about. */
  tag?: string;
  /** Every recognised token, in the order typed, for rendering the removable pills. */
  tokens: Array<{ raw: string; type: "owner" | "provider" | "kind" | "tier" | "tag" }>;
};

export const TIERS = ["reference", "imported", "authored"] as const;
export type Tier = (typeof TIERS)[number];
export const isTier = (v: string | undefined): v is Tier => TIERS.includes(v as Tier);

export function parseQuery(q: string | undefined, cat: Catalogue): ParsedQuery {
  const out: ParsedQuery = { text: "", tokens: [] };
  const words: string[] = [];
  for (const w of (q ?? "").split(/\s+/)) {
    if (!w) continue;
    const value = w.slice(1).toLowerCase();
    if (w.startsWith("@") && value) {
      if (!out.owner) {
        out.owner = value;
        out.tokens.push({ raw: w.toLowerCase(), type: "owner" });
        continue;
      }
    } else if (w.startsWith("#") && value) {
      if (isTier(value) && !out.origin) {
        out.origin = value;
        out.tokens.push({ raw: w.toLowerCase(), type: "tier" });
        continue;
      }
      if (cat.kinds[value] && !out.kind) {
        out.kind = value;
        out.tokens.push({ raw: w.toLowerCase(), type: "kind" });
        continue;
      }
      // Providers are not listed anywhere as a set, so they are read off the components.
      if (!out.provider && providersOf(cat).has(value)) {
        out.provider = value;
        out.tokens.push({ raw: w.toLowerCase(), type: "provider" });
        continue;
      }
      // Whatever is left is an author's own word. It is not checked against anything: a tag
      // nobody has used simply matches no design, which is the honest answer to asking for it.
      if (!out.tag) {
        out.tag = toTag(value);
        if (out.tag) {
          out.tokens.push({ raw: w.toLowerCase(), type: "tag" });
          continue;
        }
      }
    }
    words.push(w);
  }
  out.text = words.join(" ");
  return out;
}

let providerCache: { cat: Catalogue; set: Set<string> } | null = null;

/** The providers that actually appear in the catalogue, cached against the catalogue object. */
export function providersOf(cat: Catalogue): Set<string> {
  if (providerCache?.cat === cat) return providerCache.set;
  const set = new Set<string>();
  for (const c of Object.values(cat.components)) if (c.provider !== "default") set.add(c.provider);
  providerCache = { cat, set };
  return set;
}

/** Drops one token from a query string, for the pill's remove link. */
export function withoutToken(q: string | undefined, raw: string): string {
  return (q ?? "")
    .split(/\s+/)
    .filter((w) => w.toLowerCase() !== raw)
    .join(" ")
    .trim();
}
