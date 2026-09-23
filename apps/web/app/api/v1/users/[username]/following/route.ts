import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/api";
import { intParam } from "@/lib/http-guards";
import { listFollowing } from "@/lib/social";

/** Public, like GitHub's: `{ users: [{username, displayName, avatarUrl}], page, total }`. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  return handle(async () => {
    const { username } = await params;
    const page = intParam(req.nextUrl.searchParams.get("page"), {
      fallback: 1,
      min: 1,
      max: 10_000,
    });
    const { users, page: at, pageSize, total } = await listFollowing(username, page);
    return json({ users, page: at, pageSize, total });
  });
}
