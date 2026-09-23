import type { NextRequest } from "next/server";
import { handle, rateLimit, readJson, viewerOf } from "@/lib/api";
import { ServiceError } from "@/lib/designs";
import { markRead } from "@/lib/social";

/** Mark notifications read. Body: `{ ids: [...] }` or `{ all: true }`. 204. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const viewer = await viewerOf();
    if (!viewer) throw new ServiceError(401, "sign in to see notifications");
    rateLimit(`notifications-read:${viewer.id}`, 120);
    const body = await readJson<{ ids?: unknown; all?: unknown }>(req, 16 * 1024);
    if (body.all === true) await markRead(viewer, "all");
    else if (Array.isArray(body.ids)) await markRead(viewer, body.ids as string[]);
    else throw new ServiceError(400, "send { ids: [...] } or { all: true }");
    return new Response(null, { status: 204 });
  });
}
