// Sessions: an opaque random token in an HTTP-only cookie, its hash in the database, idle and
// absolute expiry, revocation on sign-out. No password is ever handled (plan, section 13).
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, schema } from "@/db";
import type { User } from "@/db/schema";

export const SESSION_COOKIE = "arkore_session";
const IDLE_DAYS = 14;
const ABSOLUTE_DAYS = 90;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + IDLE_DAYS * 86400_000);
  await db.insert(schema.sessions).values({ tokenHash: hash(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Touches last-seen and slides the idle expiry at most once a day. */
export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const now = new Date();
  const rows = await db
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.tokenHash, hash(token)),
        eq(schema.sessions.revoked, false),
        gt(schema.sessions.expiresAt, now),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row || row.user.deletedAt) return null;
  const absoluteEnd = new Date(row.session.createdAt.getTime() + ABSOLUTE_DAYS * 86400_000);
  if (now > absoluteEnd) return null;
  if (now.getTime() - row.session.lastSeenAt.getTime() > 86400_000) {
    const expiresAt = new Date(
      Math.min(now.getTime() + IDLE_DAYS * 86400_000, absoluteEnd.getTime()),
    );
    await db
      .update(schema.sessions)
      .set({ lastSeenAt: now, expiresAt })
      .where(eq(schema.sessions.id, row.session.id));
  }
  return row.user;
}

export async function revokeCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return;
  const db = await getDb();
  await db
    .update(schema.sessions)
    .set({ revoked: true })
    .where(eq(schema.sessions.tokenHash, hash(token)));
}

/** Upsert a user from an identity provider profile. The numeric id is the key; the login may change. */
export async function upsertGithubUser(profile: {
  id: number;
  login: string;
  name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
}) {
  const db = await getDb();
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.githubId, profile.id))
    .limit(1);
  if (existing[0]) {
    const [u] = await db
      .update(schema.users)
      .set({
        displayName: profile.name ?? existing[0].displayName,
        avatarUrl: profile.avatar_url ?? existing[0].avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, existing[0].id))
      .returning();
    return u;
  }
  const username = await freeUsername(profile.login);
  const [u] = await db
    .insert(schema.users)
    .values({
      githubId: profile.id,
      username,
      displayName: profile.name ?? profile.login,
      avatarUrl: profile.avatar_url ?? null,
      bio: profile.bio ?? null,
    })
    .returning();
  return u;
}

async function freeUsername(login: string) {
  const db = await getDb();
  const base =
    login
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^-+|-+$/g, "") || "user";
  for (let n = 0; n < 50; n++) {
    const candidate = n ? `${base}-${n + 1}` : base;
    const taken = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, candidate))
      .limit(1);
    const reserved = await db
      .select({ u: schema.reservedUsernames.username })
      .from(schema.reservedUsernames)
      .where(eq(schema.reservedUsernames.username, candidate))
      .limit(1);
    if (!taken[0] && !reserved[0]) return candidate;
  }
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export const githubConfigured = () =>
  Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
