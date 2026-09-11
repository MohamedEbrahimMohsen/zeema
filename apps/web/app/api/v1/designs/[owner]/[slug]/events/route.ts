import type { NextRequest } from "next/server";
import { clientIp, handle, json, rateLimit, readJson, viewerOf } from "@/lib/api";
import { getDesign, recordEvent, ServiceError } from "@/lib/designs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; slug: string }> },
) {
  return handle(async () => {
    const { owner, slug } = await params;
    const viewer = await viewerOf();
    const ip = clientIp(req);
    rateLimit(`events:${viewer?.id ?? ip}`, 60);
    const body = await readJson<{ kind: "export"; format?: string }>(req);
    if (body.kind !== "export") throw new ServiceError(400, "only export events are accepted here");
    const view = await getDesign(owner, slug, viewer);
    await recordEvent(view.design.id, viewer, "export", { format: body.format, ip });
    return json({ ok: true });
  });
}
