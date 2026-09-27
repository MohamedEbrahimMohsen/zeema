import type { NextRequest } from "next/server";
import { clientIp, handle, json, rateLimit, readJson, viewerOf } from "@/lib/api";
import { layoutFile } from "@/lib/design-files";
import { getDesign, ServiceError, setBadge } from "@/lib/designs";
import { attachment } from "@/lib/http-guards";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; slug: string }> },
) {
  return handle(async () => {
    const { owner, slug } = await params;
    const version = req.nextUrl.searchParams.get("version") ?? undefined;
    const view = await getDesign(owner, slug, await viewerOf(), { version });
    // `download=1` is the file that goes beside design.yaml: normalised, cut down to the ids the
    // version's YAML holds, keys in a fixed order. A version with no sidecar downloads the empty
    // one, which draws exactly what no sidecar does. Without it, the stored value as it is.
    if (req.nextUrl.searchParams.get("download") === "1")
      return new Response(layoutFile(view.version?.yaml ?? "", view.version?.layout ?? null), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": attachment(view.design.slug, "layout.json"),
          etag: `"${view.version?.contentHash ?? ""}"`,
          "cache-control": "no-cache",
        },
      });
    return json(view.version?.layout ?? null);
  });
}

// The one layout field the design page writes on its own: the list badge. Body
// `{ badge: "provider:<id>" | "boundary:<id>" | null }`, null meaning automatic. It is a
// layout-only save of the head, the way the canvas saves (see setBadge).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; slug: string }> },
) {
  return handle(async () => {
    const { owner, slug } = await params;
    const viewer = await viewerOf();
    rateLimit(`save:${viewer?.id ?? clientIp(req)}`, 120);
    const body = await readJson<{ badge?: unknown }>(req);
    if (!body || typeof body !== "object" || !("badge" in body))
      throw new ServiceError(400, "badge is required (null for automatic)");
    const { version, unchanged } = await setBadge(owner, slug, viewer, body.badge);
    return json({
      version: { id: version.id, contentHash: version.contentHash, createdAt: version.createdAt },
      badge: (version.layout as { badge?: string } | null)?.badge ?? null,
      unchanged,
    });
  });
}
