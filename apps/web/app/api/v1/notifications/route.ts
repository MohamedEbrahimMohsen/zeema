import type { NextRequest } from "next/server";
import { handle, json, viewerOf } from "@/lib/api";
import { intParam } from "@/lib/http-guards";
import { listNotifications } from "@/lib/social";

/** The caller's notifications, newest first. `?page=`, `?pageSize=` (at most 50), `?unread=1`. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const sp = req.nextUrl.searchParams;
    const result = await listNotifications(await viewerOf(), {
      page: intParam(sp.get("page"), { fallback: 1, min: 1, max: 10_000 }),
      pageSize: intParam(sp.get("pageSize"), { fallback: 20, min: 1, max: 50 }),
      unreadOnly: sp.get("unread") === "1",
    });
    return json(result);
  });
}
