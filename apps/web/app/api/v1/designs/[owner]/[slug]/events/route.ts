import type { NextRequest } from "next/server";
import { clientIp, firstInHour, handle, json, rateLimit, readJson, viewerOf } from "@/lib/api";
import { getDesign, recordEvent, ServiceError } from "@/lib/designs";

/**
 * Record a view: `{kind: "view"}`. Exports and clones are not accepted here: the server counts
 * those itself where it performs them (the render download, the clone), so a client cannot
 * claim one it never made. A view counts once per visitor, design and hour; repeats answer
 * `{counted: false}` without touching the database.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; slug: string }> },
) {
  return handle(async () => {
    const { owner, slug } = await params;
    const viewer = await viewerOf();
    const ip = clientIp(req);
    rateLimit(`events:${viewer?.id ?? ip}`, 60);
    const body = await readJson<{ kind?: unknown }>(req, 1024);
    if (body.kind !== "view") throw new ServiceError(400, "only view events are accepted here");
    const view = await getDesign(owner, slug, viewer);
    if (!firstInHour(`view:${viewer?.id ?? ip}:${view.design.id}`)) return json({ counted: false });
    const counted = await recordEvent(view.design.id, viewer, "view", { ip });
    return json({ counted });
  });
}
