import type { NextRequest } from "next/server";
import { clientIp, handle, json, rateLimit, readJson, viewerOf } from "@/lib/api";
import { type CloneInput, cloneDesign, ownerSegment } from "@/lib/designs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; slug: string }> },
) {
  return handle(async () => {
    const { owner, slug } = await params;
    const viewer = await viewerOf();
    rateLimit(`clone:${viewer?.id ?? clientIp(req)}`, 30);
    const body =
      req.headers.get("content-length") && req.headers.get("content-length") !== "0"
        ? await readJson<CloneInput>(req)
        : {};
    const { design, version } = await cloneDesign(owner, slug, viewer, body);
    return json(
      {
        design: { ...design, address: `/d/${ownerSegment(viewer)}/${design.slug}` },
        version: { id: version.id, contentHash: version.contentHash },
      },
      { status: 201 },
    );
  });
}
