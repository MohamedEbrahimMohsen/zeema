// Follows and in-app notifications: the reads and the viewer's own writes. Notifications are
// written by notify.ts, called from the design service when the action they report succeeds.
//
// The rules are deliberately few. Following needs a session, a target account that exists and is
// not closed, and a target that is not yourself. Follower and following lists are public, as they
// are on GitHub. A notification is only ever read or marked by its recipient.
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/db";
import type { NotificationKind } from "@/db/schema";
import { getUserProfile, ownerSegment, ServiceError, type Viewer } from "./designs";

export const FOLLOW_PAGE_SIZE = 30;
export const NOTIFICATION_PAGE_SIZE = 20;
/** Notifications older than this are deleted the next time their recipient lists them. */
export const NOTIFICATION_RETENTION_DAYS = 90;

export type PublicUser = { username: string; displayName: string | null; avatarUrl: string | null };

async function targetOf(username: string) {
  const user = await getUserProfile(username);
  if (!user) throw new ServiceError(404, "user not found");
  return user;
}

function signedIn(viewer: Viewer, what: string): asserts viewer is NonNullable<Viewer> {
  if (!viewer) throw new ServiceError(401, `sign in to ${what}`);
}

const whole = (v: number | undefined, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(1, Math.trunc(v)) : fallback;

// ------------------------------------------------------------------------------------ follows

/** Follow an account. Idempotent: following twice is following once. */
export async function follow(viewer: Viewer, username: string) {
  signedIn(viewer, "follow people");
  const target = await targetOf(username);
  if (target.id === viewer.id) throw new ServiceError(422, "you cannot follow yourself");
  const db = await getDb();
  await db
    .insert(schema.follows)
    .values({ followerId: viewer.id, followeeId: target.id })
    .onConflictDoNothing();
  return target;
}

/** Stop following. Idempotent: unfollowing someone you do not follow changes nothing. */
export async function unfollow(viewer: Viewer, username: string) {
  signedIn(viewer, "follow people");
  const target = await targetOf(username);
  if (target.id === viewer.id) throw new ServiceError(422, "you cannot follow yourself");
  const db = await getDb();
  await db
    .delete(schema.follows)
    .where(and(eq(schema.follows.followerId, viewer.id), eq(schema.follows.followeeId, target.id)));
  return target;
}

export async function isFollowing(viewer: Viewer, userId: string) {
  if (!viewer) return false;
  const db = await getDb();
  const rows = await db
    .select({ one: sql<number>`1` })
    .from(schema.follows)
    .where(and(eq(schema.follows.followerId, viewer.id), eq(schema.follows.followeeId, userId)))
    .limit(1);
  return rows.length > 0;
}

async function countFollows(side: "followers" | "following", userId: string) {
  const db = await getDb();
  const [mine, theirs] =
    side === "followers"
      ? [schema.follows.followeeId, schema.follows.followerId]
      : [schema.follows.followerId, schema.follows.followeeId];
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.follows)
    .innerJoin(schema.users, and(eq(schema.users.id, theirs), isNull(schema.users.deletedAt)))
    .where(eq(mine, userId));
  return Number(n);
}

/** People following this account. Closed accounts are not counted. */
export const followerCount = (userId: string) => countFollows("followers", userId);
/** People this account follows. Closed accounts are not counted. */
export const followingCount = (userId: string) => countFollows("following", userId);

async function listFollows(side: "followers" | "following", username: string, page = 1) {
  const target = await targetOf(username);
  const db = await getDb();
  const p = whole(page, 1);
  const [mine, theirs] =
    side === "followers"
      ? [schema.follows.followeeId, schema.follows.followerId]
      : [schema.follows.followerId, schema.follows.followeeId];
  const rows = await db
    .select({
      username: schema.users.username,
      displayName: schema.users.displayName,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.follows)
    .innerJoin(schema.users, and(eq(schema.users.id, theirs), isNull(schema.users.deletedAt)))
    .where(eq(mine, target.id))
    .orderBy(desc(schema.follows.createdAt), schema.users.username)
    .limit(FOLLOW_PAGE_SIZE)
    .offset((p - 1) * FOLLOW_PAGE_SIZE);
  const total = await countFollows(side, target.id);
  return {
    user: target,
    users: rows as PublicUser[],
    page: p,
    pageSize: FOLLOW_PAGE_SIZE,
    total,
  };
}

/** Who follows `username`, newest first. Public. */
export const listFollowers = (username: string, page?: number) =>
  listFollows("followers", username, page);
/** Whom `username` follows, newest first. Public. */
export const listFollowing = (username: string, page?: number) =>
  listFollows("following", username, page);

// ------------------------------------------------------------------------------ notifications

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  createdAt: Date;
  read: boolean;
  /** Null when the actor's account has been closed. */
  actor: PublicUser | null;
  /** Null when the design is gone or no longer readable by the recipient. */
  design: { title: string; address: string } | null;
};

const retention = sql`now() - ${`${NOTIFICATION_RETENTION_DAYS} days`}::interval`;

/** Delete the viewer's notifications past retention. Cheap: one indexed range per user. */
async function prune(userId: string) {
  const db = await getDb();
  await db
    .delete(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, userId),
        sql`${schema.notifications.createdAt} < ${retention}`,
      ),
    );
}

export async function listNotifications(
  viewer: Viewer,
  opts: { page?: number; pageSize?: number; unreadOnly?: boolean } = {},
) {
  signedIn(viewer, "see notifications");
  await prune(viewer.id);
  const db = await getDb();
  const page = whole(opts.page, 1);
  const pageSize = Math.min(50, whole(opts.pageSize, NOTIFICATION_PAGE_SIZE));
  const actor = alias(schema.users, "actor");
  const owner = alias(schema.users, "design_owner");
  const where = and(
    eq(schema.notifications.userId, viewer.id),
    opts.unreadOnly ? isNull(schema.notifications.readAt) : undefined,
  );
  const rows = await db
    .select({
      n: schema.notifications,
      actor: {
        username: actor.username,
        displayName: actor.displayName,
        avatarUrl: actor.avatarUrl,
        deletedAt: actor.deletedAt,
      },
      design: {
        id: schema.designs.id,
        title: schema.designs.title,
        slug: schema.designs.slug,
        ownerId: schema.designs.ownerId,
        visibility: schema.designs.visibility,
        deletedAt: schema.designs.deletedAt,
      },
      ownerName: owner.username,
    })
    .from(schema.notifications)
    .leftJoin(actor, eq(actor.id, schema.notifications.actorId))
    .leftJoin(schema.designs, eq(schema.designs.id, schema.notifications.designId))
    .leftJoin(owner, eq(owner.id, schema.designs.ownerId))
    .where(where)
    .orderBy(desc(schema.notifications.createdAt), desc(schema.notifications.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.notifications)
    .where(where);
  const items: NotificationItem[] = rows.map(({ n, actor: a, design: d, ownerName }) => ({
    id: n.id,
    kind: n.kind,
    createdAt: n.createdAt,
    read: n.readAt !== null,
    actor:
      a?.username && !a.deletedAt
        ? { username: a.username, displayName: a.displayName, avatarUrl: a.avatarUrl }
        : null,
    // The recipient sees the design as they would anywhere else: public, or their own.
    design:
      d?.id && !d.deletedAt && (d.visibility === "public" || d.ownerId === viewer.id)
        ? {
            title: d.title,
            address: `/d/${ownerSegment(ownerName ? { username: ownerName } : null)}/${d.slug}`,
          }
        : null,
  }));
  return { items, page, pageSize, total: Number(total), unread: await unreadCount(viewer) };
}

/** Unread notifications within retention. One indexed count; the bell polls it. */
export async function unreadCount(viewer: Viewer) {
  signedIn(viewer, "see notifications");
  const db = await getDb();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, viewer.id),
        isNull(schema.notifications.readAt),
        sql`${schema.notifications.createdAt} >= ${retention}`,
      ),
    );
  return Number(n);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_MARK_IDS = 100;

/** Mark some of the viewer's notifications read, or all of them. Other people's ids are ignored. */
export async function markRead(viewer: Viewer, which: string[] | "all") {
  signedIn(viewer, "see notifications");
  if (which !== "all") {
    if (!Array.isArray(which) || which.length > MAX_MARK_IDS)
      throw new ServiceError(400, `ids must be a list of at most ${MAX_MARK_IDS} ids`);
    if (!which.every((id) => typeof id === "string" && UUID.test(id)))
      throw new ServiceError(400, "ids must be notification ids");
    if (which.length === 0) return;
  }
  const db = await getDb();
  await db
    .update(schema.notifications)
    .set({ readAt: sql`now()` })
    .where(
      and(
        eq(schema.notifications.userId, viewer.id),
        isNull(schema.notifications.readAt),
        which === "all" ? undefined : inArray(schema.notifications.id, which),
      ),
    );
}
