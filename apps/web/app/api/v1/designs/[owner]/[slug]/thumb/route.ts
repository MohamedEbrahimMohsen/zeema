// The list thumbnail: see src/lib/thumb.ts. Not an export, so nothing is counted here.
import type { NextRequest } from "next/server";
import { handle, viewerOf } from "@/lib/api";
import { thumbResponse } from "@/lib/thumb";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; slug: string }> },
) {
  return handle(async () => {
    const { owner, slug } = await params;
    const p = req.nextUrl.searchParams;
    return thumbResponse(owner, slug, await viewerOf(), {
      version: p.get("version") ?? undefined,
      v: p.get("v") ?? undefined,
      theme: p.get("theme") ?? undefined,
      ifNoneMatch: req.headers.get("if-none-match"),
    });
  });
}
