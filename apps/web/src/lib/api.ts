// Helpers for route handlers: JSON responses, the error mapping, the viewer, a rate limit.
import { type NextRequest, NextResponse } from "next/server";
import { currentUser } from "./auth";
import { ServiceError } from "./designs";

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

export const clientIp = (req: NextRequest) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
  req.headers.get("x-real-ip") ||
  "local";

// A small in-memory token bucket per key. Enough for one process; a shared store replaces it
// when the platform runs more than one.
const buckets = new Map<string, { tokens: number; at: number }>();
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
  if (buckets.size > 10_000) buckets.clear();
}

export async function handle(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (e) {
    return errorResponse(e);
  }
}
