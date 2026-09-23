import type { NextRequest } from "next/server";
import { handle, json, viewerOf } from "@/lib/api";
import { getProfileStats, listDesigns, ServiceError } from "@/lib/designs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  return handle(async () => {
    const { username } = await params;
    const viewer = await viewerOf();
    const profile = await getProfileStats(username, viewer);
    if (!profile) throw new ServiceError(404, "user not found");
    const { user, stats } = profile;
    const designs = await listDesigns(viewer, { owner: user.username, pageSize: 100 });
    return json({
      user: {
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        createdAt: user.createdAt,
      },
      stats,
      designs: designs.items,
    });
  });
}
