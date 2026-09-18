import type { NextRequest } from "next/server";
import { handle, json, viewerOf } from "@/lib/api";
import { getUserProfile, listDesigns, ServiceError } from "@/lib/designs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  return handle(async () => {
    const { username } = await params;
    const user = await getUserProfile(username);
    if (!user) throw new ServiceError(404, "user not found");
    const designs = await listDesigns(await viewerOf(), { owner: user.username, pageSize: 100 });
    return json({
      user: {
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        createdAt: user.createdAt,
      },
      designs: designs.items,
    });
  });
}
