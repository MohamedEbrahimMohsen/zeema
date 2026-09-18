import type { NextRequest } from "next/server";
import { handle, json, readJson, viewerOf } from "@/lib/api";
import { deleteDesign, getDesign, type PatchInput, patchDesign } from "@/lib/designs";

type Ctx = { params: Promise<{ owner: string; slug: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { owner, slug } = await params;
    const view = await getDesign(owner, slug, await viewerOf());
    return json({
      design: view.design,
      owner: view.owner,
      stats: view.stats,
      can: view.can,
      currentVersion: view.version
        ? {
            id: view.version.id,
            contentHash: view.version.contentHash,
            createdAt: view.version.createdAt,
            message: view.version.message,
          }
        : null,
    });
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { owner, slug } = await params;
    const body = await readJson<PatchInput>(req);
    const design = await patchDesign(owner, slug, await viewerOf(), body);
    return json({ design });
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { owner, slug } = await params;
    await deleteDesign(owner, slug, await viewerOf());
    return new Response(null, { status: 204 });
  });
}
