import type { NextRequest } from "next/server";
import { handle, json, viewerOf } from "@/lib/api";
import { getDesign } from "@/lib/designs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; slug: string }> },
) {
  return handle(async () => {
    const { owner, slug } = await params;
    const version = req.nextUrl.searchParams.get("version") ?? undefined;
    const view = await getDesign(owner, slug, await viewerOf(), { version });
    return json(view.version?.layout ?? null);
  });
}
