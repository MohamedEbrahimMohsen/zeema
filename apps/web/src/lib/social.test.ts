// Profiles, follows and notifications, against an embedded Postgres with the real migrations —
// the same harness as designs.test.ts. The rules under test are who gets told what, and what a
// profile counts, so they run on real rows rather than on mocked queries.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeema-social-test-"));
  process.env.PGLITE_DIR = dir;
  process.env.DATABASE_URL = "";
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const YAML = `schemaVersion: "1"
type: "design"
id: "t"
nodes:
  - { id: "svc", component: "container-service" }
edges: []
`;
const yamlWith = (id: string) => YAML.replace('"svc"', `"${id}"`);

const designs = () => import("./designs");
const social = () => import("./social");

let nextGithubId = 1000;

async function makeUser(username: string) {
  const { getDb, schema } = await import("@/db");
  const db = await getDb();
  const [u] = await db
    .insert(schema.users)
    .values({ githubId: nextGithubId++, username, displayName: username })
    .returning();
  return u as never as { id: string; username: string } & Record<string, unknown>;
}

async function closeAccount(id: string) {
  const { getDb, schema } = await import("@/db");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  await db.update(schema.users).set({ deletedAt: new Date() }).where(eq(schema.users.id, id));
}

/** A public, released design owned by `user`. */
async function publicDesign(user: { username: string }, title: string) {
  const { createDesign, patchDesign } = await designs();
  const made = await createDesign(user as never, { title, yaml: YAML });
  await patchDesign(user.username, made.design.slug, user as never, { visibility: "public" });
  return made;
}

async function rowsFor(userId: string) {
  const { getDb, schema } = await import("@/db");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  return db.select().from(schema.notifications).where(eq(schema.notifications.userId, userId));
}

const statusOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return 0;
  } catch (e) {
    return (e as { status?: number }).status ?? -1;
  }
};

describe("profile stats", () => {
  it("counts only public released designs and sums their clones", async () => {
    const { createDesign, cloneDesign, getProfileStats, deleteDesign } = await designs();
    const owner = await makeUser("pat");
    const reader = await makeUser("quinn");
    const a = await publicDesign(owner, "Alpha");
    const b = await publicDesign(owner, "Beta");
    await createDesign(owner as never, { title: "Secret", yaml: YAML });
    const gone = await publicDesign(owner, "Gone");
    await cloneDesign("pat", a.design.slug, reader as never);
    await cloneDesign("pat", a.design.slug, reader as never);
    await cloneDesign("pat", b.design.slug, reader as never);
    await cloneDesign("pat", gone.design.slug, reader as never);
    await deleteDesign("pat", gone.design.slug, owner as never);

    const seen = await getProfileStats("pat", reader as never);
    expect(seen?.stats).toMatchObject({ designs: 2, clones: 3, drafts: null });
    // The owner also sees the drafts count: the private design.
    const mine = await getProfileStats("pat", owner as never);
    expect(mine?.stats.drafts).toBe(1);
    expect(mine?.own).toBe(true);
    expect(await getProfileStats("nobody-here", null)).toBeNull();
  });

  it("shows readers the release with no draft marker; the writer still sees it", async () => {
    const { listDesigns, saveVersion } = await designs();
    const ula = await makeUser("ula");
    const d = await publicDesign(ula, "Evolving");
    await saveVersion("ula", d.design.slug, ula as never, {
      yaml: yamlWith("next"),
      ifMatch: d.version.contentHash,
    });
    const asReader = await listDesigns(null, { owner: "ula", released: true, sort: "published" });
    expect(asReader.items.map((i) => i.unpublished)).toEqual([false]);
    const asOwner = await listDesigns(ula as never, { scope: "mine" });
    expect(asOwner.items.map((i) => i.unpublished)).toEqual([true]);
  });

  it("answers null for a closed account", async () => {
    const { getProfileStats } = await designs();
    const gone = await makeUser("rowan");
    await closeAccount(gone.id);
    expect(await getProfileStats("rowan", null)).toBeNull();
  });
});

describe("follows", () => {
  it("follows and unfollows idempotently and counts both sides", async () => {
    const { follow, unfollow, isFollowing, followerCount, followingCount } = await social();
    const { getProfileStats } = await designs();
    const sam = await makeUser("sam");
    const tia = await makeUser("tia");
    await follow(sam as never, "tia");
    await follow(sam as never, "TIA");
    expect(await isFollowing(sam as never, tia.id)).toBe(true);
    expect(await followerCount(tia.id)).toBe(1);
    expect(await followingCount(sam.id)).toBe(1);
    const stats = await getProfileStats("tia", sam as never);
    expect(stats?.stats).toMatchObject({ followers: 1, following: 0 });
    expect(stats?.viewerFollows).toBe(true);

    await unfollow(sam as never, "tia");
    await unfollow(sam as never, "tia");
    expect(await isFollowing(sam as never, tia.id)).toBe(false);
    expect(await followerCount(tia.id)).toBe(0);
  });

  it("refuses to follow yourself (422), and the database refuses it too", async () => {
    const { follow } = await social();
    const uma = await makeUser("uma");
    expect(await statusOf(follow(uma as never, "uma"))).toBe(422);
    const { getDb, schema } = await import("@/db");
    const db = await getDb();
    await expect(
      db.insert(schema.follows).values({ followerId: uma.id, followeeId: uma.id }),
    ).rejects.toThrow();
  });

  it("needs a session (401) and an account that exists (404)", async () => {
    const { follow } = await social();
    const vic = await makeUser("vic");
    expect(await statusOf(follow(null, "vic"))).toBe(401);
    expect(await statusOf(follow(vic as never, "no-such-person"))).toBe(404);
    const closed = await makeUser("wes");
    await closeAccount(closed.id);
    expect(await statusOf(follow(vic as never, "wes"))).toBe(404);
  });

  it("lists followers and following publicly, leaving closed accounts out", async () => {
    const { follow, listFollowers, listFollowing } = await social();
    const star = await makeUser("xena");
    const f1 = await makeUser("yuri");
    const f2 = await makeUser("zoe");
    await follow(f1 as never, "xena");
    await follow(f2 as never, "xena");
    await closeAccount(f2.id);
    const followers = await listFollowers("xena");
    expect(followers.total).toBe(1);
    expect(followers.users.map((u) => u.username)).toEqual(["yuri"]);
    expect(Object.keys(followers.users[0]).sort()).toEqual([
      "avatarUrl",
      "displayName",
      "username",
    ]);
    const following = await listFollowing("yuri");
    expect(following.users.map((u) => u.username)).toEqual([star.username]);
  });
});

describe("notifications: clones", () => {
  it("tells the owner when someone else clones their public design", async () => {
    const { cloneDesign } = await designs();
    const { listNotifications } = await social();
    const ada = await makeUser("ada2");
    const bea = await makeUser("bea2");
    const d = await publicDesign(ada, "Order pipeline");
    await cloneDesign("ada2", d.design.slug, bea as never);
    const { items } = await listNotifications(ada as never);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: "design_cloned",
      read: false,
      actor: { username: "bea2" },
      design: { title: "Order pipeline", address: `/d/ada2/${d.design.slug}` },
    });
  });

  it("stays silent when you clone your own design", async () => {
    const { cloneDesign } = await designs();
    const cal = await makeUser("cal2");
    const d = await publicDesign(cal, "Mine");
    await cloneDesign("cal2", d.design.slug, cal as never);
    expect(await rowsFor(cal.id)).toHaveLength(0);
  });

  it("never notifies a closed account", async () => {
    const { cloneDesign } = await designs();
    const dee = await makeUser("dee2");
    const eli = await makeUser("eli2");
    const d = await publicDesign(dee, "Left behind");
    await closeAccount(dee.id);
    await cloneDesign("dee2", d.design.slug, eli as never);
    expect(await rowsFor(dee.id)).toHaveLength(0);
  });
});

describe("notifications: publishing", () => {
  it("fans out to followers only, never the author, at most once a day per design", async () => {
    const { saveVersion, publishDesign, getDesign } = await designs();
    const { follow } = await social();
    const author = await makeUser("fay");
    const fan = await makeUser("gus");
    const other = await makeUser("hal");
    const closed = await makeUser("ivy");
    await follow(fan as never, "fay");
    await follow(closed as never, "fay");
    await closeAccount(closed.id);

    // Made public with its release: the first publish, as a follower sees it.
    const d = await publicDesign(author, "Queue");
    expect(await rowsFor(fan.id)).toHaveLength(1);
    expect((await rowsFor(fan.id))[0]).toMatchObject({
      kind: "design_published_by_followed",
      actorId: author.id,
      designId: d.design.id,
    });
    expect(await rowsFor(author.id)).toHaveLength(0);
    expect(await rowsFor(other.id)).toHaveLength(0);
    expect(await rowsFor(closed.id)).toHaveLength(0);

    // A new release within the day: nothing new.
    const release = async (id: string) => {
      const view = await getDesign("fay", d.design.slug, author as never);
      await saveVersion("fay", d.design.slug, author as never, {
        yaml: yamlWith(id),
        ifMatch: view.version?.contentHash,
      });
      await publishDesign("fay", d.design.slug, author as never);
    };
    await release("svc2");
    expect(await rowsFor(fan.id)).toHaveLength(1);

    // A day later, a new release is news again.
    const { getDb } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    const db = await getDb();
    await db.execute(
      sql`update notifications set created_at = now() - interval '25 hours' where user_id = ${fan.id}`,
    );
    await release("svc3");
    expect(await rowsFor(fan.id)).toHaveLength(2);
  });

  it("says nothing about a private design's release", async () => {
    const { createDesign, publishDesign } = await designs();
    const { follow } = await social();
    const jay = await makeUser("jay");
    const kim = await makeUser("kim");
    await follow(kim as never, "jay");
    const d = await createDesign(jay as never, { title: "Hidden", yaml: YAML });
    await publishDesign("jay", d.design.slug, jay as never);
    expect(await rowsFor(kim.id)).toHaveLength(0);
  });
});

describe("notifications: reading", () => {
  async function inbox(name: string, n: number) {
    const { cloneDesign } = await designs();
    const owner = await makeUser(name);
    const cloner = await makeUser(`${name}-cloner`);
    const d = await publicDesign(owner, "Popular");
    for (let i = 0; i < n; i++)
      await cloneDesign(name, d.design.slug, cloner as never, { slug: `copy-${i}` });
    return owner;
  }

  it("counts unread, marks some read by id and ignores other people's ids", async () => {
    const { listNotifications, unreadCount, markRead } = await social();
    const lee = await inbox("lee", 3);
    const max = await inbox("max", 1);
    expect(await unreadCount(lee as never)).toBe(3);
    const { items } = await listNotifications(lee as never);
    const theirs = (await listNotifications(max as never)).items[0].id;
    await markRead(lee as never, [items[0].id, theirs]);
    expect(await unreadCount(lee as never)).toBe(2);
    expect(await unreadCount(max as never)).toBe(1);
    const unread = await listNotifications(lee as never, { unreadOnly: true });
    expect(unread.total).toBe(2);
    expect(unread.items.every((n) => !n.read)).toBe(true);
  });

  it("marks everything read at once", async () => {
    const { unreadCount, markRead } = await social();
    const ned = await inbox("ned", 2);
    await markRead(ned as never, "all");
    expect(await unreadCount(ned as never)).toBe(0);
  });

  it("refuses ids that are not ids, and a caller without a session", async () => {
    const { markRead, unreadCount, listNotifications } = await social();
    const ola = await makeUser("ola");
    expect(await statusOf(markRead(ola as never, ["1; drop table users"]))).toBe(400);
    expect(await statusOf(unreadCount(null))).toBe(401);
    expect(await statusOf(listNotifications(null))).toBe(401);
  });

  it("paginates newest first", async () => {
    const { listNotifications } = await social();
    const pia = await inbox("pia", 5);
    const first = await listNotifications(pia as never, { pageSize: 2 });
    const third = await listNotifications(pia as never, { pageSize: 2, page: 3 });
    expect(first.total).toBe(5);
    expect(first.items).toHaveLength(2);
    expect(third.items).toHaveLength(1);
    expect(new Date(first.items[0].createdAt) >= new Date(first.items[1].createdAt)).toBe(true);
  });

  it("deletes notifications past 90 days when their recipient lists them", async () => {
    const { listNotifications, unreadCount } = await social();
    const rex = await inbox("rex", 2);
    const { getDb } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    const db = await getDb();
    const [old] = await rowsFor(rex.id);
    await db.execute(
      sql`update notifications set created_at = now() - interval '91 days' where id = ${old.id}`,
    );
    expect(await unreadCount(rex as never)).toBe(1);
    expect(await rowsFor(rex.id)).toHaveLength(2);
    const listed = await listNotifications(rex as never);
    expect(listed.total).toBe(1);
    expect(await rowsFor(rex.id)).toHaveLength(1);
  });

  it("drops the link once the design is no longer the recipient's to read", async () => {
    const { cloneDesign, patchDesign } = await designs();
    const { follow, listNotifications } = await social();
    const sia = await makeUser("sia");
    const tom = await makeUser("tom");
    await follow(tom as never, "sia");
    const d = await publicDesign(sia, "Brief");
    await cloneDesign("sia", d.design.slug, tom as never);
    await patchDesign("sia", d.design.slug, sia as never, { visibility: "private" });
    const [n] = (await listNotifications(tom as never)).items;
    expect(n.kind).toBe("design_published_by_followed");
    expect(n.design).toBeNull();
    // The owner still reaches their own design from the clone notice.
    const [mine] = (await listNotifications(sia as never)).items;
    expect(mine.design?.title).toBe("Brief");
  });
});
