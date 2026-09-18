// The Prometheus scrape target. Never published to the internet: in compose it is reachable
// on the internal network only, and METRICS_TOKEN gates it whenever the port is exposed.
import type { NextRequest } from "next/server";
import { metrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = process.env.METRICS_TOKEN;
  if (token) {
    const sent =
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      req.nextUrl.searchParams.get("token");
    if (sent !== token) return new Response("not found", { status: 404 });
  }
  const { registry } = metrics();
  const body = await registry.metrics();
  return new Response(body, {
    headers: { "content-type": registry.contentType, "cache-control": "no-store" },
  });
}
