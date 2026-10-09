// What a node referencing this design shows: name, releases, counts and thumbnail (designs.ts,
// `refSummary`). Public designs only; private, deleted and missing are the same 404. Nothing in
// the answer depends on who asks, so it may be cached publicly, briefly: a new release changes it.
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/api";
import { refSummary, ServiceError } from "@/lib/designs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; slug: string }> },
) {
  return handle(async () => {
    const { owner, slug } = await params;
    const raw = req.nextUrl.searchParams.get("version");
    let version: number | undefined;
    if (raw !== null) {
      if (!/^[1-9][0-9]{0,8}$/.test(raw)) throw new ServiceError(404, "version not found");
      version = Number(raw);
    }
    const summary = await refSummary(owner, slug, { version });
    const body = JSON.stringify(summary);
    const etag = `"${createHash("sha256").update(body).digest("hex").slice(0, 32)}"`;
    const headers = {
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      etag,
    };
    const inm = req.headers.get("if-none-match");
    if (inm?.split(",").some((t) => t.trim().replace(/^W\//, "") === etag))
      return new Response(null, { status: 304, headers });
    return json(summary, { headers });
  });
}
