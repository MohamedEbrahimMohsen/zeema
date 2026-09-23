import type { NextRequest } from "next/server";
import { clientIp, handle, json, rateLimit, readJson, viewerOf } from "@/lib/api";
import { type CreateInput, createDesign, listDesigns, ownerSegment } from "@/lib/designs";
import { pagination } from "@/lib/http-guards";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const viewer = await viewerOf();
    const p = req.nextUrl.searchParams;
    const result = await listDesigns(viewer, {
      q: p.get("q") ?? undefined,
      provider: p.get("provider") ?? undefined,
      kind: p.get("kind") ?? undefined,
      owner: p.get("owner") === "me" ? viewer?.username : (p.get("owner") ?? undefined),
      sort: (p.get("sort") as "updated" | "created" | "clones" | "exports" | null) ?? undefined,
      ...pagination(p),
      scope: p.get("owner") === "me" ? "mine" : "public",
    });
    return json(result);
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const viewer = await viewerOf();
    rateLimit(`create:${viewer?.id ?? clientIp(req)}`, 30);
    const body = await readJson<CreateInput>(req);
    const { design, version } = await createDesign(viewer, body);
    return json(
      {
        design: {
          ...design,
          owner: viewer ? { username: viewer.username } : null,
          address: `/d/${ownerSegment(viewer)}/${design.slug}`,
        },
        version: { id: version.id, contentHash: version.contentHash },
      },
      { status: 201 },
    );
  });
}
