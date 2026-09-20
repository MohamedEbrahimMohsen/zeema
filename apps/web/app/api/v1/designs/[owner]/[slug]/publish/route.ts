import type { NextRequest } from "next/server";
import { clientIp, handle, json, rateLimit, readJson, viewerOf } from "@/lib/api";
import { publishDesign } from "@/lib/designs";

/**
 * Release the head as what readers see. Body: optional {note}.
 *
 * The reply carries the slug because publishing an unnamed draft also moves it to an address
 * made from its title, and the page has to follow it there.
 */
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
      design: {
        id: design.id,
        slug: design.slug,
        address: `/d/${owner}/${design.slug}`,
        publishedVersionId: design.publishedVersionId,
      },
      version: {
        id: version.id,
        contentHash: version.contentHash,
        publishedAt: version.publishedAt,
      },
      unchanged,
    });
  });
}
