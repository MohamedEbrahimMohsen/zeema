import type { NextRequest } from "next/server";
import { handle, rateLimitHourly, viewerOf } from "@/lib/api";
import { follow, unfollow } from "@/lib/social";

type Ctx = { params: Promise<{ username: string }> };

// Follow spam is the abuse to blunt: an account that follows everyone to be noticed. Sixty
// changes an hour is far more than a person clicking, and far less than a script.
const FOLLOWS_PER_HOUR = 60;

/** Follow. Idempotent: 204 whether or not the caller already followed. */
export async function PUT(_req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { username } = await params;
    const viewer = await viewerOf();
    if (viewer) rateLimitHourly(`follow:${viewer.id}`, FOLLOWS_PER_HOUR);
    await follow(viewer, username);
    return new Response(null, { status: 204 });
  });
}

/** Unfollow. Idempotent: 204 whether or not the caller followed. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { username } = await params;
    const viewer = await viewerOf();
    if (viewer) rateLimitHourly(`follow:${viewer.id}`, FOLLOWS_PER_HOUR);
    await unfollow(viewer, username);
    return new Response(null, { status: 204 });
  });
}
