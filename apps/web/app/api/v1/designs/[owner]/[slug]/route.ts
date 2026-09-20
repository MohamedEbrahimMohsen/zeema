import type { NextRequest } from "next/server";
import { handle, json, readJson, viewerOf } from "@/lib/api";
import {
  deleteDesign,
  getDesign,
  MAX_README,
  MAX_TAGS,
  type PatchInput,
  patchDesign,
  ServiceError,
} from "@/lib/designs";

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
    const design = await patchDesign(owner, slug, await viewerOf(), checked(body));
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

// Shapes and sizes are the route's business; who may write is the service's. Anything the body
// carries that is not a field of the patch is ignored rather than refused, so an older client
// sending an extra key still works.
function checked(body: PatchInput): PatchInput {
  const out: PatchInput = {};
  const text = (name: string, v: unknown) => {
    if (typeof v !== "string") throw new ServiceError(400, `${name} must be text`);
    return v;
  };
  if (body.title !== undefined) out.title = text("title", body.title);
  if (body.slug !== undefined) out.slug = text("slug", body.slug);
  if (body.summary !== undefined) out.summary = text("summary", body.summary);
  if (body.visibility !== undefined) out.visibility = body.visibility;
  if (body.readme !== undefined) {
    const v = body.readme === null ? "" : text("readme", body.readme);
    if (v.length > MAX_README)
      throw new ServiceError(422, `readme is ${v.length} characters; the limit is ${MAX_README}`);
    out.readme = v;
  }
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) throw new ServiceError(400, "tags must be a list of words");
    if (body.tags.length > MAX_TAGS)
      throw new ServiceError(400, `a design carries at most ${MAX_TAGS} tags`);
    out.tags = body.tags.map((t, i) => text(`tags[${i}]`, t));
  }
  return out;
}
