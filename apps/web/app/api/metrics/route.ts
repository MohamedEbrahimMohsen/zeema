// The Prometheus scrape target. Never published to the internet: in compose it is reachable
// on the internal network only, and METRICS_TOKEN gates it whenever the port is exposed.
//
// The token travels in a header only (`Authorization: Bearer <token>` or `X-Metrics-Token`),
// never in the query string, where it would end up in access logs and shell history. The
// comparison is constant-time over SHA-256 digests, so neither the bytes nor the length of the
// token leak through timing. Anything but a match is a 404: the endpoint does not admit to
// existing. In production an unset token closes the endpoint rather than opening it.
import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { metrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

function tokenMatches(sent: string | null | undefined, token: string) {
  if (!sent) return false;
  return timingSafeEqual(digest(sent), digest(token));
}

export async function GET(req: NextRequest) {
  const token = process.env.METRICS_TOKEN;
  const notFound = () => new Response("not found", { status: 404 });
  if (token) {
    const auth = req.headers.get("authorization");
    const sent = auth
      ? /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim()
      : req.headers.get("x-metrics-token")?.trim();
    if (!tokenMatches(sent, token)) return notFound();
  } else if (process.env.NODE_ENV === "production") return notFound();
  const { registry } = metrics();
  const body = await registry.metrics();
  return new Response(body, {
    headers: { "content-type": registry.contentType, "cache-control": "no-store" },
  });
}
