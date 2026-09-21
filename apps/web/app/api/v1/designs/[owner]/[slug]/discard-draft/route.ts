import type { NextRequest } from "next/server";
import { clientIp, handle, json, rateLimit, viewerOf } from "@/lib/api";
import { discardDraft } from "@/lib/designs";

/**
 * Throw the draft away: the release becomes the head again, and the unreleased versions saved
 * since it are deleted. 409 when there is no release, or when the head already is it. The
 * response says how many versions went, because nothing brings them back.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; slug: string }> },
) {
  return handle(async () => {
    const { owner, slug } = await params;
    const viewer = await viewerOf();
    rateLimit(`discard:${viewer?.id ?? clientIp(req)}`, 60);
    const view = await discardDraft(owner, slug, viewer);
    return json({
      design: {
        id: view.design.id,
        slug: view.design.slug,
        address: `/d/${owner}/${view.design.slug}`,
        currentVersionId: view.design.currentVersionId,
        publishedVersionId: view.design.publishedVersionId,
      },
      version: view.version ? { id: view.version.id, contentHash: view.version.contentHash } : null,
      unpublished: view.unpublished,
      deletedVersionCount: view.deletedVersionCount,
    });
  });
}
