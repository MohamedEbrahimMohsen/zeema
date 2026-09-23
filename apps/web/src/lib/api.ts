// Helpers for route handlers: JSON responses, the error mapping, the viewer, a rate limit.
import { type NextRequest, NextResponse } from "next/server";
import { currentUser } from "./auth";
import { ServiceError } from "./designs";
import { clientIp as guardClientIp, LruTtl } from "./http-guards";

export const json = (body: unknown, init: ResponseInit = {}) => NextResponse.json(body, init);

export function errorResponse(e: unknown) {
  if (e instanceof ServiceError)
    return json(
      { error: { code: e.status, message: e.message, findings: e.findings ?? undefined } },
      { status: e.status },
    );
  console.error(e);
  return json({ error: { code: 500, message: "internal error" } }, { status: 500 });
}

export async function readJson<T>(req: NextRequest, maxBytes = 1024 * 1024): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new ServiceError(413, "request body too large");
  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes)
    throw new ServiceError(413, "request body too large");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ServiceError(400, "body must be JSON");
  }
}

export const viewerOf = () => currentUser();

/** The caller's address as far as we can trust it. See `clientIp` in http-guards.ts. */
export const clientIp = (req: Pick<NextRequest, "headers">) => guardClientIp(req.headers);

// Token buckets per key, in process memory: one process, one set of limits. With several
// replicas each keeps its own, so the effective limit is the per-process one times the replica
// count (docs/deploy.md). The map is bounded and least-recently-used keys go first, so a flood
// of fresh keys cannot wipe the buckets of everyone else; an idle bucket expires after ten
// minutes, by which time it would have refilled anyway.
const buckets = new LruTtl<{ tokens: number; at: number }>(10_000, 10 * 60_000);
export function rateLimit(key: string, perMinute: number) {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: perMinute, at: now };
  b.tokens = Math.min(perMinute, b.tokens + ((now - b.at) / 60_000) * perMinute);
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    throw new ServiceError(429, "too many requests");
  }
  b.tokens -= 1;
  buckets.set(key, b);
}

// "At most once per window" keys: the first call in a window answers true, the rest false.
const seen = new LruTtl<true>(50_000, 60 * 60_000);
/** True the first time `key` is seen in the last hour (per process). */
export function firstInHour(key: string) {
  if (seen.has(key)) return false;
  seen.set(key, true);
  return true;
}

export async function handle(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (e) {
    return errorResponse(e);
  }
}
