// A database seeded before a notes.md edit kept the old summary forever, because the seed skipped
// every slug it had already inserted. It now refreshes the summary of an existing curated design,
// and nothing else of it, and never touches a member's design of the same name. Runs against an
// embedded Postgres in a temporary directory, never apps/web/.pglite.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeema-seed-test-"));
  process.env.PGLITE_DIR = dir;
  process.env.DATABASE_URL = "";
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

// Two curated designs are enough to exercise the seed; all of them would only make it slow. The
// first curated entry with a broken twin and the first imported one are taken from disk.
vi.mock("../lib/catalogue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/catalogue")>();
  let picked: ReturnType<typeof actual.repoDesigns> | undefined;
  return {
    ...actual,
    repoDesigns: () => {
      if (!picked) {
        const all = actual.repoDesigns();
        const withTwin = all.find((e) => e.tier === "reference" && e.broken);
        const imported = all.find((e) => e.tier === "imported" && !e.broken && e.notes);
        const keep = new Set([withTwin, imported].map((e) => (e ? `${e.tier}/${e.id}` : "")));
        picked = all.filter((e) => keep.has(`${e.tier}/${e.id}`));
      }
      return picked;
    },
  };
});

describe("seedCurated", () => {
  it("refreshes a stale summary of a curated design and changes nothing else", async () => {
    const { seedCurated } = await import("./seed");
    const { getDb, schema } = await import("./index");
    const { repoDesigns } = await import("../lib/catalogue");
    const { firstParagraph } = await import("../lib/notes-summary");
    const { createDesign } = await import("../lib/designs");
    const { and, eq, isNull, isNotNull } = await import("drizzle-orm");
    const db = await getDb();

    const entries = repoDesigns().filter((e) => !e.broken);
    expect(entries.length).toBe(2);
    const target = entries.find((e) => e.tier === "imported")!;
    const expected = firstParagraph(target.notes);
    expect(expected).toBeTruthy();

    const firstLog: string[] = [];
    expect(await seedCurated((s) => firstLog.push(s))).toBe(2);
    expect(firstLog.filter((l) => l.startsWith("seeded"))).toHaveLength(2);

    const curated = () =>
      db
        .select()
        .from(schema.designs)
        .where(and(isNull(schema.designs.ownerId), eq(schema.designs.slug, target.id)));
    const [before] = await curated();
    expect(before.summary).toBe(expected);

    // A member's design of the same name, with a summary the seed would call stale.
    const [u] = await db
      .insert(schema.users)
      .values({ githubId: 1, username: "carol", displayName: "carol" })
      .returning();
    await createDesign(
      { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: null } as never,
      { title: target.id, slug: target.id, summary: "Groups: mine", yaml: target.yaml },
    );

    // What an earlier seed left behind.
    await db
      .update(schema.designs)
      .set({ summary: "Groups: junk" })
      .where(eq(schema.designs.id, before.id));
    const versionsBefore = await db
      .select({ id: schema.designVersions.id })
      .from(schema.designVersions)
      .where(eq(schema.designVersions.designId, before.id));

    const secondLog: string[] = [];
    expect(await seedCurated((s) => secondLog.push(s))).toBe(0);
    expect(secondLog).toEqual([`refreshed summary imported/${target.id}`]);

    const [after] = await curated();
    expect(after.summary).toBe(expected);
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    expect(after.currentVersionId).toBe(before.currentVersionId);
    expect(after.publishedVersionId).toBe(before.publishedVersionId);
    const versionsAfter = await db
      .select({ id: schema.designVersions.id })
      .from(schema.designVersions)
      .where(eq(schema.designVersions.designId, before.id));
    expect(versionsAfter.length).toBe(versionsBefore.length);

    const [mine] = await db
      .select()
      .from(schema.designs)
      .where(and(isNotNull(schema.designs.ownerId), eq(schema.designs.slug, target.id)));
    expect(mine.summary).toBe("Groups: mine");

    // Nothing stale left: a third run writes nothing.
    const thirdLog: string[] = [];
    expect(await seedCurated((s) => thirdLog.push(s))).toBe(0);
    expect(thirdLog).toEqual([]);
  });
});
