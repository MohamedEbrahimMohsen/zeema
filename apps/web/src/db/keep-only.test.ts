// The beta reset deletes for real, so the tests pin what it leaves: a dry run writes nothing,
// a real run keeps exactly the owner's designs and leaves no design_slugs row behind, --public
// goes through the service's own "make public", and an owner with nothing is refused before the
// table could be emptied (an empty table reseeds itself at boot). Runs against an embedded
// Postgres in a temporary directory, never apps/web/.pglite.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeema-keep-only-test-"));
  process.env.PGLITE_DIR = dir;
  process.env.DATABASE_URL = "";
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

// Two curated designs stand for all of them, as in seed.test.ts.
vi.mock("../lib/catalogue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/catalogue")>();
  let picked: ReturnType<typeof actual.repoDesigns> | undefined;
  return {
    ...actual,
    repoDesigns: () => {
      if (!picked) {
        const all = actual.repoDesigns();
        const withTwin = all.find((e) => e.tier === "reference" && e.broken);
        const imported = all.find((e) => e.tier === "imported" && !e.broken);
        const keep = new Set([withTwin, imported].map((e) => (e ? `${e.tier}/${e.id}` : "")));
        picked = all.filter((e) => keep.has(`${e.tier}/${e.id}`));
      }
      return picked;
    },
  };
});

const YAML = `schemaVersion: "1"
type: "design"
id: "t"
nodes:
  - { id: "svc", component: "container-service" }
edges: []
`;

let nextGithubId = 1;

async function setup() {
  const { seedCurated } = await import("./seed");
  const { getDb, schema } = await import("./index");
  const { createDesign, patchDesign } = await import("../lib/designs");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  await seedCurated(() => {});
  const user = async (username: string) => {
    const [u] = await db
      .insert(schema.users)
      .values({ githubId: nextGithubId++, username, displayName: username })
      .returning();
    return { ...u, sessionId: "t", roles: [], actingAdmin: false };
  };
  const alice = await user("alice");
  const bob = await user("bob");
  await user("dave");
  // alice: one public (through make-public, so it holds a design_slugs row), two private, one of
  // which the owner cannot edit (an imported origin is read-only to its owner).
  await createDesign(alice, { title: "Shop", yaml: YAML });
  await patchDesign("alice", "shop", alice, { visibility: "public" });
  await createDesign(alice, { title: "Notes", yaml: YAML });
  const locked = await createDesign(alice, { title: "Locked", yaml: YAML });
  await db
    .update(schema.designs)
    .set({ origin: "imported" })
    .where(eq(schema.designs.id, locked.design.id));
  // bob: one public, one private.
  await createDesign(bob, { title: "Blog", yaml: YAML });
  await patchDesign("bob", "blog", bob, { visibility: "public" });
  await createDesign(bob, { title: "Draft", yaml: YAML });
}

async function snapshot() {
  const { getDb, schema } = await import("./index");
  const db = await getDb();
  const designs = await db.select().from(schema.designs);
  const slugs = await db.select().from(schema.designSlugs);
  const versions = await db.select().from(schema.designVersions);
  const stats = await db.select().from(schema.designStats);
  return { designs, slugs, versions, stats };
}

describe("keepOnly", () => {
  beforeAll(setup);

  it("is a dry run unless --yes is given", async () => {
    const { parseArgs } = await import("./keep-only");
    expect(parseArgs(["--owner", "alice"]).yes).toBeFalsy();
    expect(parseArgs(["--owner", "alice", "--yes", "--dry-run"]).yes).toBe(false);
    expect(parseArgs(["--owner=alice", "--yes", "--public"])).toMatchObject({
      owner: "alice",
      yes: true,
      makePublic: true,
    });
    expect(() => parseArgs(["--yes"])).toThrow(/--owner/);
    expect(() => parseArgs(["--owner", "a", "--force"])).toThrow(/unknown/);
  });

  it("refuses an owner with no designs, before writing anything", async () => {
    const { keepOnly } = await import("./keep-only");
    const before = await snapshot();
    await expect(keepOnly({ owner: "dave", yes: true })).rejects.toThrow(/no designs/);
    await expect(keepOnly({ owner: "nobody", yes: true })).rejects.toThrow(/no account/);
    expect((await snapshot()).designs.length).toBe(before.designs.length);
  });

  it("reports without writing on a dry run", async () => {
    const { keepOnly, formatReport } = await import("./keep-only");
    const before = await snapshot();
    const curatedCount = before.designs.filter((d) => d.ownerId === null).length;
    expect(curatedCount).toBeGreaterThan(0);

    const report = await keepOnly({ owner: "Alice", makePublic: true });
    expect(report.dryRun).toBe(true);
    expect(report.kept.map((r) => r.slug).sort()).toEqual(["locked", "notes", "shop"]);
    expect(report.deleted.length).toBe(curatedCount + 2);
    expect(
      report.deleted
        .filter((r) => r.owner === "bob")
        .map((r) => r.slug)
        .sort(),
    ).toEqual(["blog", "draft"]);
    expect(report.madePublic.map((r) => r.slug)).toEqual(["notes"]);
    expect(report.notPublic.map((n) => n.row.slug)).toEqual(["locked"]);
    const text = formatReport(report);
    expect(text).toMatch(/DRY RUN/);
    expect(text).toMatch(/AUTO_SEED=0/);

    // Keeping members' designs deletes the curated ones only.
    const curatedOnly = await keepOnly({ owner: "alice", curatedOnly: true });
    expect(curatedOnly.deleted.every((r) => r.owner === "zeema")).toBe(true);
    expect(curatedOnly.deleted.length).toBe(curatedCount);

    const after = await snapshot();
    expect(after).toEqual(before);
  });

  it("with --yes keeps only the owner's designs and leaves no stray rows", async () => {
    const { keepOnly } = await import("./keep-only");
    const before = await snapshot();
    const report = await keepOnly({ owner: "alice", yes: true });
    expect(report.dryRun).toBe(false);
    expect(report.madePublic).toEqual([]);

    const after = await snapshot();
    const alice = after.designs[0].ownerId;
    expect(after.designs.map((d) => d.slug).sort()).toEqual(["locked", "notes", "shop"]);
    expect(after.designs.every((d) => d.ownerId === alice)).toBe(true);
    const live = new Set(after.designs.map((d) => d.id));
    // design_slugs has no foreign key: these would be left behind without the explicit delete.
    expect(before.slugs.some((s) => !live.has(s.designId))).toBe(true);
    expect(after.slugs.every((s) => live.has(s.designId))).toBe(true);
    expect(after.slugs.map((s) => s.slug)).toEqual(["shop"]);
    expect(after.versions.every((v) => live.has(v.designId))).toBe(true);
    expect(after.stats.every((s) => live.has(s.designId))).toBe(true);
    // Accounts stay.
    const { getDb, schema } = await import("./index");
    const users = await (await getDb()).select().from(schema.users);
    expect(users.map((u) => u.username).sort()).toEqual(["alice", "bob", "dave"]);
  });

  it("with --public makes the kept designs public through the service, and says which cannot be", async () => {
    const { keepOnly, formatReport } = await import("./keep-only");
    const report = await keepOnly({ owner: "alice", yes: true, makePublic: true });
    expect(report.deleted).toEqual([]);
    expect(report.madePublic.map((r) => r.slug)).toEqual(["notes"]);
    expect(report.notPublic).toEqual([
      { row: expect.objectContaining({ slug: "locked" }), reason: "the owner cannot edit it" },
    ]);
    expect(formatReport(report)).not.toMatch(/AUTO_SEED/);

    const after = await snapshot();
    const by = (slug: string) => after.designs.find((d) => d.slug === slug)!;
    // Going public released the head and reserved the address, as the button does.
    expect(by("notes").visibility).toBe("public");
    expect(by("notes").publishedVersionId).toBe(by("notes").currentVersionId);
    expect(after.slugs.map((s) => s.slug).sort()).toEqual(["notes", "shop"]);
    expect(by("locked").visibility).toBe("private");
  });
});
