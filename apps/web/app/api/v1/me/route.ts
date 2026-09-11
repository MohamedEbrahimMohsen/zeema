import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb, schema } from "@/db";
import { handle, json, readJson, viewerOf } from "@/lib/api";
import { ServiceError } from "@/lib/designs";

const publicUser = (u: schema.User) => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  avatarUrl: u.avatarUrl,
  bio: u.bio,
  createdAt: u.createdAt,
});

export async function GET() {
  return handle(async () => {
    const viewer = await viewerOf();
    if (!viewer) throw new ServiceError(401, "not signed in");
    return json({ user: publicUser(viewer) });
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const viewer = await viewerOf();
    if (!viewer) throw new ServiceError(401, "not signed in");
    const body = await readJson<{ displayName?: string; bio?: string }>(req);
    const set: Partial<schema.User> = { updatedAt: new Date() };
    if (body.displayName !== undefined)
      set.displayName = String(body.displayName).slice(0, 80) || null;
    if (body.bio !== undefined) set.bio = String(body.bio).slice(0, 500) || null;
    const db = await getDb();
    const [u] = await db
      .update(schema.users)
      .set(set)
      .where(eq(schema.users.id, viewer.id))
      .returning();
    return json({ user: publicUser(u) });
  });
}
