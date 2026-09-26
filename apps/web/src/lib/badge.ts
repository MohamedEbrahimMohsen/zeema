// Which mark a list thumbnail wears in its corner. Pure: the caller hands in the parsed design
// and the catalogue, and brand.ts turns the answer into markup.
//
// An owner may choose the mark (the layout sidecar's `badge`, a provider or a group mark), and a
// choice the catalogue knows wins over everything below.
//
// A design that models a well-known product keeps that product's mark (chosen by its slug:
// the curated designs are the only ones with a brand, and their slugs are stable, so there is no
// column for it). Otherwise the corner names the provider most of the design is built on, when
// one clearly dominates: at least two components and at least 40% of the non-generic ones, with
// no tie at the top. A design spread across clouds, or drawn only in generic boxes, wears none.
import type { Catalogue } from "./catalogue";
import { isBadgeRef } from "./layout-sidecar";
import type { Design } from "./lint";
import { own } from "./own";

/**
 * `provider`: a provider's mark (icons/providers); `brand`: a curated design's product mark
 * (icons/providers, by file name); `boundary`: a group mark (icons/boundaries).
 */
export type Badge = { kind: "provider" | "brand" | "boundary"; id: string } | null;

type BadgeCatalogue = Pick<Catalogue, "components"> & {
  locale?: Partial<Pick<Catalogue["locale"], "providers" | "boundaryIcons">>;
};

/**
 * The badge a stored choice names, or null when it is not a badge ref or names something the
 * catalogue does not have (a provider folder, a group mark), so a stale choice falls back to
 * the automatic one rather than drawing nothing. `default` is a provider with no mark.
 */
export function chosenBadge(ref: unknown, cat: BadgeCatalogue): Badge {
  if (!isBadgeRef(ref)) return null;
  const at = ref.indexOf(":");
  const kind = ref.slice(0, at);
  const id = ref.slice(at + 1);
  if (kind === "provider")
    return id !== "default" && own(cat.locale?.providers, id) !== undefined ? { kind, id } : null;
  return own(cat.locale?.boundaryIcons, id) !== undefined ? { kind: "boundary", id } : null;
}

/** Design slug to its brand mark, a file name under icons/providers (Simple Icons, CC0). */
export const BRAND: Record<string, string> = {
  "airbnb-search": "airbnb",
  "booking-search": "bookingdotcom",
  "cloudflare-edge": "cloudflare",
  "coinbase-exchange": "coinbase",
  "datadog-husky": "datadog",
  "discord-messages": "discord",
  "distributed-message-queue": "apachekafka",
  "doordash-delivery": "doordash",
  "dropbox-sync": "dropbox",
  "duolingo-backend": "duolingo",
  "etsy-search": "etsy",
  "facebook-messenger": "messenger",
  "facebook-tao": "meta",
  "figma-multiplayer": "figma",
  github: "github",
  "github-mysql": "github",
  "gitlab-architecture": "gitlab",
  "gojek-platform": "gojek",
  "google-drive": "googledrive",
  "google-maps": "googlemaps",
  "grab-geo": "grab",
  "instagram-feed": "instagram",
  "khan-academy-goliath": "khanacademy",
  "linear-sync": "linear",
  "lyft-envoy": "lyft",
  "meta-threads": "threads",
  "metrics-monitoring": "prometheus",
  "monzo-platform": "monzo",
  "netflix-streaming": "netflix",
  "notion-sharding": "notion",
  "nubank-core": "nubank",
  "paypal-payments": "paypal",
  "pinterest-feed": "pinterest",
  "reddit-feed": "reddit",
  "robinhood-trading": "robinhood",
  "shopify-flash-sale": "shopify",
  "slack-messaging": "slack",
  "snapchat-platform": "snapchat",
  "spotify-playback": "spotify",
  "stack-overflow": "stackoverflow",
  "stripe-payments": "stripe",
  "stripe-webhooks": "stripe",
  "tiktok-recommendation": "tiktok",
  "tinder-geo": "tinder",
  "twitch-live": "twitch",
  "twitter-timeline": "x",
  "uber-dispatch": "uber",
  "whatsapp-messaging": "whatsapp",
  wikipedia: "wikipedia",
  "x-recommendation": "x",
  youtube: "youtube",
  "youtube-upload-playback": "youtube",
  "zerodha-kite": "zerodha",
  "zoom-video": "zoom",
};

/** The brand for a slug; a clone (`<slug>-copy`, `<slug>-copy-2`) keeps its original's. */
export function brandOf(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return own(BRAND, slug.replace(/-copy(-\d+)?$/, "")) ?? null;
}

export const DOMINANT_SHARE = 0.4;
export const DOMINANT_MIN = 2;

export function badgeOf(
  doc: Pick<Design, "nodes"> | null | undefined,
  cat: BadgeCatalogue,
  slug?: string | null,
  chosen?: string | null,
): Badge {
  const picked = chosenBadge(chosen, cat);
  if (picked) return picked;
  const brand = brandOf(slug);
  if (brand) return { kind: "brand", id: brand };
  if (!doc) return null;
  const counts = new Map<string, number>();
  let total = 0;
  for (const n of doc.nodes) {
    const provider = own(cat.components, n.component)?.provider;
    if (!provider || provider === "default") continue;
    counts.set(provider, (counts.get(provider) ?? 0) + 1);
    total++;
  }
  let top: string | null = null;
  let best = 0;
  let tied = false;
  for (const [p, c] of counts) {
    if (c > best) {
      top = p;
      best = c;
      tied = false;
    } else if (c === best) tied = true;
  }
  if (!top || tied || best < DOMINANT_MIN || best < total * DOMINANT_SHARE) return null;
  return { kind: "provider", id: top };
}
