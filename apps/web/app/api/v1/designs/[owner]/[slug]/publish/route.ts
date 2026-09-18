import type { NextRequest } from "next/server";
import { clientIp, handle, json, rateLimit, readJson, viewerOf } from "@/lib/api";
import { publishDesign } from "@/lib/designs";

/** Release the head as what readers see. Body: optional {note}. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; slug: string }> },
) {
  return handle(async () => {
    const { owner, slug } = await params;
    const viewer = await viewerOf();
    rateLimit(`publish:${viewer?.id ?? clientIp(req)}`, 60);
    const body =
      (req.headers.get("content-length") ?? "0") === "0"
        ? {}
        : await readJson<{ note?: string }>(req);
    const { design, version, unchanged } = await publishDesign(owner, slug, viewer, body);
    return json({
      design: { id: design.id, publishedVersionId: design.publishedVersionId },
      version: {
        id: version.id,
        contentHash: version.contentHash,
        publishedAt: version.publishedAt,
      },
      unchanged,
    });
  });
}
