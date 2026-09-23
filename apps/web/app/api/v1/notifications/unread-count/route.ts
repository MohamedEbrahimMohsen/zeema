import { handle, json, viewerOf } from "@/lib/api";
import { unreadCount } from "@/lib/social";

/** `{ count }` of unread notifications. Polled by the bell, so it is one indexed count. */
export async function GET() {
  return handle(async () => {
    const count = await unreadCount(await viewerOf());
    return json({ count }, { headers: { "cache-control": "no-store" } });
  });
}
