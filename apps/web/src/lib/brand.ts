// A design that models a well-known product shows that product's mark on its card. The mark is a
// provider icon from icons/providers (Simple Icons, CC0), chosen by the design's slug. There is no
// column for this: the curated designs are the only ones with a brand, and their slugs are stable.
import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./catalogue";

const BRAND: Record<string, string> = {
  youtube: "youtube",
  "slack-messaging": "slack",
  "twitter-timeline": "x",
  "doordash-delivery": "doordash",
  "google-drive": "googledrive",
  github: "github",
  "stripe-webhooks": "stripe",
};

const cache = new Map<string, string | null>();

/** Inner SVG markup of the brand mark for a design slug, or null when it has none. */
export function brandMarkFor(slug: string): string | null {
  const name = BRAND[slug.replace(/-copy(-\d+)?$/, "")];
  if (!name) return null;
  if (!cache.has(name)) {
    const file = path.join(repoRoot(), "icons", "providers", `${name}.svg`);
    if (!fs.existsSync(file)) cache.set(name, null);
    else {
      const raw = fs.readFileSync(file, "utf8");
      const open = raw.indexOf("<svg");
      const gt = open < 0 ? -1 : raw.indexOf(">", open);
      const close = raw.lastIndexOf("</svg>");
      const fill = /\sfill="(#[0-9a-fA-F]{3,8})"/.exec(raw.slice(open, gt))?.[1] ?? null;
      const body =
        gt < 0 || close < 0 ? null : raw.slice(gt + 1, close).replace(/<title>.*?<\/title>/s, "");
      cache.set(name, body ? (fill ? `<g fill="${fill}">${body}</g>` : body) : null);
    }
  }
  return cache.get(name) ?? null;
}
