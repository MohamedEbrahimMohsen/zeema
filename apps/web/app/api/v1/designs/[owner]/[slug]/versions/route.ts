import type { NextRequest } from "next/server";
import { handle, json, viewerOf } from "@/lib/api";
import { getDesign, listVersions } from "@/lib/designs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ owner: string; slug: string }> },
) {
  return handle(async () => {
    const { owner, slug } = await params;
    const view = await getDesign(owner, slug, await viewerOf());
    const versions = await listVersions(view);
    return json({
      versions: versions.map((v) => ({
        id: v.id,
        contentHash: v.contentHash,
        message: v.message,
        createdAt: v.createdAt,
        authorId: v.authorId,
      })),
    });
  });
}
