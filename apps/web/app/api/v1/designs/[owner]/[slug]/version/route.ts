import type { NextRequest } from "next/server";
import { clientIp, handle, json, rateLimit, readJson, viewerOf } from "@/lib/api";
import { type SaveInput, saveVersion } from "@/lib/designs";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; slug: string }> },
) {
  return handle(async () => {
    const { owner, slug } = await params;
    const viewer = await viewerOf();
    rateLimit(`save:${viewer?.id ?? clientIp(req)}`, 120);
    const body = await readJson<SaveInput>(req);
    const ifMatch = req.headers.get("if-match")?.replace(/"/g, "") ?? body.ifMatch;
    const { design, version, unchanged } = await saveVersion(owner, slug, viewer, {
      ...body,
      ifMatch,
    });
    return json({
      design: { id: design.id, updatedAt: design.updatedAt },
      version: { id: version.id, contentHash: version.contentHash, createdAt: version.createdAt },
      unchanged,
    });
  });
}
