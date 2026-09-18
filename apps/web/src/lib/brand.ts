// A design that models a well-known product shows that product's mark on its card. The mark is a
// provider icon from icons/providers (Simple Icons, CC0), chosen by the design's slug. There is no
// column for this: the curated designs are the only ones with a brand, and their slugs are stable.
import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./catalogue";

const BRAND: Record<string, string> = {
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
