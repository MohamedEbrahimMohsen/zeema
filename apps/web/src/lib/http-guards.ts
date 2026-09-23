// Small, pure request guards shared by the proxy, the route handlers and the pages. Nothing here
// touches the database or Next's request context, so every rule is unit-tested on its own
// (http-guards.test.ts): where a redirect may go, which address a request comes from, whether a
// write came from our own pages, how a page number is read, how a search term enters a LIKE.

/** The configured public origin (`APP_ORIGIN`), normalised, or null when unset or unparseable. */
export function appOrigin(env: Record<string, string | undefined> = process.env): string | null {
  const raw = env.APP_ORIGIN;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * Where a `next` parameter may send someone after sign-in: a path on this site and nothing else.
 * Accepted: one leading `/` followed by anything that is not a second `/` or a `\`, with no
 * scheme, no backslash and no control character, that still resolves to `origin`. Everything
 * else becomes `/`. `//evil.example`, `/\evil.example`, `https://evil.example` and
 * `javascript:...` are the shapes this exists to refuse.
 */
export function safeNext(raw: unknown, origin: string): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return "/";
  if (raw[0] !== "/" || raw[1] === "/" || raw[1] === "\\") return "/";
  // A backslash is a slash to a browser, and a control character is never part of a real path.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: refusing control characters is the point
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return "/";
  try {
    const base = new URL(origin);
    const url = new URL(raw, base);
    if (url.origin !== base.origin) return "/";
    const out = `${url.pathname}${url.search}${url.hash}`;
    // Dot segments can collapse into a protocol-relative path (`/..//evil` -> `//evil`), which
    // is a fresh open redirect once handed to a Location header. The result is checked again.
    if (out[1] === "/" || out[1] === "\\") return "/";
    return out;
  } catch {
    return "/";
  }
}

/** `safeNext` against APP_ORIGIN (or a stand-in when unset: only the path matters then). */
export const nextPath = (raw: unknown) => safeNext(raw, appOrigin() ?? "http://localhost");

const IP_SHAPE = /^[0-9A-Fa-f:.]{2,45}$/;

/** How many reverse proxies in front of the app append to `X-Forwarded-For`. 0 = trust none. */
export function trustedHops(env: Record<string, string | undefined> = process.env): number {
  const n = Number.parseInt(env.TRUSTED_PROXY ?? "0", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 0;
}

/**
 * The address a request comes from, for rate limits and the hashed event log.
 *
 * `X-Forwarded-For` is a header anyone can send, so it is read only when `TRUSTED_PROXY` says
 * how many proxies we run in front of the app. Each proxy appends the address it received the
 * connection from, so with N trusted proxies the Nth entry from the right is the first one no
 * trusted proxy wrote: the client as our outermost proxy saw it. Entries to its left are
 * whatever the client claimed and are ignored.
 *
 * Without a trusted proxy, a route handler cannot see the socket address, so every anonymous
 * caller shares one bucket ("anon"). That is deliberate: a shared limit is a real limit, and a
 * per-header one is not.
 */
export function clientIp(
  headers: Pick<Headers, "get">,
  env: Record<string, string | undefined> = process.env,
): string {
  const hops = trustedHops(env);
  if (!hops) return "anon";
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const pick = chain.length ? chain[Math.max(0, chain.length - hops)] : null;
  const ip = pick ?? headers.get("x-real-ip")?.trim() ?? null;
  return ip && IP_SHAPE.test(ip) ? ip.toLowerCase() : "anon";
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cross-site request forgery check for a state-changing request. SameSite=Lax cookies already
 * stop most of it; this closes the rest (same-site siblings, form posts, older browsers).
 * Returns null when the request may proceed, or the reason it may not.
 *
 * - An `Origin` header must be one of `allowed` (APP_ORIGIN and the origin the request was
 *   addressed to). `Origin: null` is refused.
 * - Without `Origin`, `Sec-Fetch-Site: cross-site` is refused. A request with neither header is
 *   not from a browser that could carry someone else's cookie, and is let through.
 */
export function crossSiteRefusal(
  method: string,
  headers: Pick<Headers, "get">,
  allowed: Iterable<string | null | undefined>,
): string | null {
  if (SAFE_METHODS.has(method.toUpperCase())) return null;
  const origin = headers.get("origin");
  if (origin !== null) {
    for (const a of allowed) if (a && origin === a) return null;
    return "cross-origin request refused";
  }
  if (headers.get("sec-fetch-site") === "cross-site") return "cross-site request refused";
  return null;
}

/** An integer query parameter: the default on anything unreadable, clamped to [min, max]. */
export function intParam(
  raw: string | null | undefined,
  { fallback, min, max }: { fallback: number; min: number; max: number },
): number {
  if (raw === null || raw === undefined || raw.trim() === "") return fallback;
  if (!/^[-+]?\d+$/.test(raw.trim())) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Page and page size for a listing: page >= 1, size 1..100, 24 by default. */
export function pagination(p: Pick<URLSearchParams, "get">) {
  return {
    page: intParam(p.get("page"), { fallback: 1, min: 1, max: 10_000 }),
    pageSize: intParam(p.get("pageSize"), { fallback: 24, min: 1, max: 100 }),
  };
}

/** Escape LIKE/ILIKE wildcards so user text matches itself. Postgres' default escape is `\`. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

/**
 * `Content-Disposition` for a download named after a design. The plain `filename` keeps only
 * characters that are safe in a quoted header parameter; `filename*` carries the exact name,
 * percent-encoded, for clients that read RFC 6266.
 */
export function attachment(base: string, ext: string): string {
  const name = `${base}.${ext}`;
  const ascii = name.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "_") || `download.${ext}`;
  const exact = encodeURIComponent(name).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${exact}`;
}

/**
 * A bounded map whose entries expire. Least recently used entries are evicted first when it is
 * full, and an entry older than `ttlMs` since it was last written reads as absent. This is what
 * the rate limiter keeps its buckets in: flooding it with fresh keys evicts the oldest ones,
 * never everybody's.
 */
export class LruTtl<V> {
  private map = new Map<string, { v: V; at: number }>();
  constructor(
    private max: number,
    private ttlMs: number,
    private now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (this.now() - hit.at > this.ttlMs) {
      this.map.delete(key);
      return undefined;
    }
    // Re-insert so iteration order is least recently used first.
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.v;
  }

  set(key: string, v: V) {
    this.map.delete(key);
    this.map.set(key, { v, at: this.now() });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value as string;
      this.map.delete(oldest);
    }
  }

  has(key: string) {
    return this.get(key) !== undefined;
  }

  get size() {
    return this.map.size;
  }
}
