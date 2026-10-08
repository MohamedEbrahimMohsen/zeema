// Moving an account's designs between deployments: export from one database, import into another
// whose account has a different id, and nothing about the designs may change on the way --
// versions in order with their YAML byte for byte, layouts, head and release, visibility,
// reserved addresses, stats, tombstones and timestamps. Both databases are embedded Postgres in
// temporary directories, never apps/web/.pglite.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Bundle } from "./export-owner";
import type { Db } from "./index";

let dir: string;
let target: Db;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeema-owner-transfer-test-"));
  process.env.PGLITE_DIR = path.join(dir, "source");
  process.env.DATABASE_URL = "";
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const { schema } = await import("./index");
  const db = drizzle(new PGlite(path.join(dir, "target")), { schema });
  await migrate(db, { migrationsFolder: path.join(import.meta.dirname, "..", "..", "drizzle") });
  target = db;
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const YAML = (id: string, extra = "") => `schemaVersion: "1"
type: "design"
id: "${id}"
nodes:
  - { id: "svc", component: "container-service" }${extra}
edges: []
`;
const LAYOUT = { nodes: { svc: { x: 120, y: 40 } }, note: "kept as stored" };

async function seedSource() {
  const { getDb, schema } = await import("./index");
  const { createDesign, deleteDesign, patchDesign } = await import("../lib/designs");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  const user = async (username: string, githubId: number) => {
    const [u] = await db
      .insert(schema.users)
      .values({ githubId, username, displayName: username })
      .returning();
    return { ...u, sessionId: "t", roles: [], actingAdmin: false };
  };
  const alice = await user("alice", 101);
  const bob = await user("bob", 202);

  // shop: public, three versions (one by bob), a layout, the release behind the head, stats.
  const shop = await createDesign(alice, { title: "Shop", yaml: YAML("shop") });
  await patchDesign("alice", "shop", alice, { visibility: "public" });
  const later = async (designId: string, yaml: string, authorId: string, minutes: number) => {
    const [v] = await db
      .insert(schema.designVersions)
      .values({
        designId,
        yaml,
        layout: LAYOUT,
        contentHash: `h-${minutes}`,
        authorId,
        message: `save ${minutes}`,
        createdAt: new Date(Date.now() + minutes * 60_000),
      })
      .returning();
    await db
      .update(schema.designs)
      .set({ currentVersionId: v.id })
      .where(eq(schema.designs.id, designId));
    return v;
  };
  await later(shop.design.id, YAML("shop", "\n  # bob was here  "), bob.id, 1);
  await later(shop.design.id, YAML("shop", '\r\n  - { id: "db", component: "x" }'), alice.id, 2);
  await db
    .update(schema.designStats)
    .set({ viewCount: 42, cloneCount: 3, exportCount: 7 })
    .where(eq(schema.designStats.designId, shop.design.id));

  // notes: private, never released. blog-post: public, then renamed to blog (the old address
  // stays reserved).
  await createDesign(alice, { title: "Notes", yaml: YAML("notes"), summary: "s" });
  await createDesign(alice, { title: "Blog Post", yaml: YAML("blog") });
  await patchDesign("alice", "blog-post", alice, { visibility: "public", tags: ["web", "edge"] });
  await patchDesign("alice", "blog-post", alice, { slug: "blog", readme: "# Blog\n" });
  // gone: published, then deleted -- a tombstone holding its address.
  await createDesign(alice, { title: "Gone", yaml: YAML("gone") });
  await patchDesign("alice", "gone", alice, { visibility: "public" });
  await deleteDesign("alice", "gone", alice);
  // bob's design is not alice's and must not travel.
  await createDesign(bob, { title: "Bob Only", yaml: YAML("bob") });
}

/** The bundle with every id replaced by its position, so two deployments compare equal. */
function normalise(b: Bundle) {
  const dIdx = new Map(b.designs.map((d, i) => [d.id, `d${i}`]));
  const vIdx = new Map(b.designs.flatMap((d, i) => d.versions.map((v, j) => [v.id, `d${i}v${j}`])));
  const m = (map: Map<string, string>, id: string | null) => (id ? (map.get(id) ?? "?") : null);
  return {
    ...b,
    designs: b.designs.map((d) => ({
      ...d,
      id: m(dIdx, d.id),
      sourceDesignId: m(dIdx, d.sourceDesignId),
      currentVersionId: m(vIdx, d.currentVersionId),
      publishedVersionId: m(vIdx, d.publishedVersionId),
      versions: d.versions.map((v) => ({ ...v, id: m(vIdx, v.id) })),
    })),
  };
}

async function counts(db: Db) {
  const { schema } = await import("./index");
  return {
    designs: (await db.select().from(schema.designs)).length,
    versions: (await db.select().from(schema.designVersions)).length,
    slugs: (await db.select().from(schema.designSlugs)).length,
    stats: (await db.select().from(schema.designStats)).length,
  };
}

describe("export-owner / import-owner", () => {
  let bundle: Bundle;

  beforeAll(async () => {
    await seedSource();
    const { exportOwner, serializeBundle } = await import("./export-owner");
    const { readBundle } = await import("./import-owner");
    // Through the file format, as the real move goes.
    bundle = readBundle(serializeBundle(await exportOwner({ owner: "Alice" })));
    const { schema } = await import("./index");
    // The target: alice signed in once (a different id), plus a curated design and reservation
    // sharing one of her addresses, which must neither collide nor be touched.
    await target.insert(schema.users).values({ githubId: 101, username: "Alice" });
    const [cur] = await target
      .insert(schema.designs)
      .values({ slug: "shop", title: "Curated shop", visibility: "public" })
      .returning();
    await target.insert(schema.designSlugs).values({ slug: "shop", designId: cur.id });
  });

  it("parses arguments as a dry run by default", async () => {
    const ex = await import("./export-owner");
    const im = await import("./import-owner");
    expect(ex.parseArgs(["--owner", "a", "--out", "f"]).tombstones).toBe(true);
    expect(ex.parseArgs(["--owner=a", "--out=f", "--no-tombstones"]).tombstones).toBe(false);
    expect(() => ex.parseArgs(["--owner", "a"])).toThrow(/--out/);
    expect(im.parseArgs(["--in", "f", "--owner", "a"]).yes).toBeFalsy();
    expect(im.parseArgs(["--in", "f", "--owner", "a", "--yes", "--dry-run"]).yes).toBe(false);
    expect(() => im.parseArgs(["--in", "f", "--owner", "a", "--force"])).toThrow(/unknown/);
    expect(() => im.readBundle("{}")).toThrow(/bundle/);
  });

  it("exports only the owner's designs, tombstone flagged, deterministically", async () => {
    const { exportOwner, serializeBundle, formatExport } = await import("./export-owner");
    expect(bundle.owner).toEqual({ username: "alice", githubId: 101 });
    expect(bundle.designs.map((d) => d.slug)).toEqual(["blog", "gone", "notes", "shop"]);
    expect(bundle.designs.filter((d) => d.tombstone).map((d) => d.slug)).toEqual(["gone"]);
    const blog = bundle.designs.find((d) => d.slug === "blog")!;
    expect(blog.slugs.map((s) => s.slug).sort()).toEqual(["blog-post"]);
    const shop = bundle.designs.find((d) => d.slug === "shop")!;
    expect(shop.versions.map((v) => v.authorIsOwner)).toEqual([true, false, true]);
    expect(shop.createdAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/);
    const again = serializeBundle(await exportOwner({ owner: "alice" }));
    expect(again).toBe(serializeBundle(bundle));
    expect(again).not.toMatch(/\r\n(?!.*component)/);
    expect(
      (await exportOwner({ owner: "alice", tombstones: false })).designs.map((d) => d.slug),
    ).toEqual(["blog", "notes", "shop"]);
    expect(formatExport(bundle, "x.json")).toMatch(/gone\s+private \(tombstone\)/);
    await expect(exportOwner({ owner: "nobody" })).rejects.toThrow(/no account/);
  });

  it("refuses an account that does not exist on the target", async () => {
    const { importOwner } = await import("./import-owner");
    await expect(importOwner(bundle, { owner: "carol", yes: true }, target)).rejects.toThrow(
      /sign in once on the target first/,
    );
  });

  it("writes nothing on a dry run", async () => {
    const { importOwner, formatImport } = await import("./import-owner");
    const before = await counts(target);
    const report = await importOwner(bundle, { owner: "alice" }, target);
    expect(report.dryRun).toBe(true);
    expect(report.actions).toEqual(["insert", "insert", "insert", "insert"]);
    expect(report.notes.join("\n")).toMatch(/curated design is also named shop/);
    expect(report.notes.join("\n")).toMatch(/curated reservation also holds shop/);
    expect(formatImport(report)).toMatch(/DRY RUN/);
    expect(await counts(target)).toEqual(before);
  });

  it("imports faithfully under the target's own account", async () => {
    const { importOwner } = await import("./import-owner");
    const { exportOwner } = await import("./export-owner");
    const { getDb, schema } = await import("./index");
    const { eq } = await import("drizzle-orm");
    const before = await counts(target);
    await importOwner(bundle, { owner: "alice", yes: true }, target);
    const after = await counts(target);
    const versions = bundle.designs.reduce((n, d) => n + d.versions.length, 0);
    const slugs = bundle.designs.reduce((n, d) => n + d.slugs.length, 0);
    expect(after).toEqual({
      designs: before.designs + 4,
      versions: before.versions + versions,
      slugs: before.slugs + slugs,
      stats: before.stats + 4,
    });

    const [alice] = await target.select().from(schema.users).where(eq(schema.users.githubId, 101));
    const [srcAlice] = await (await getDb())
      .select()
      .from(schema.users)
      .where(eq(schema.users.githubId, 101));
    expect(alice.id).not.toBe(srcAlice.id);

    // The whole bundle, re-exported from the target, matches the original but for ids: YAML
    // byte for byte, layouts, order, timestamps, head and release, visibility, slugs, stats.
    const back = await exportOwner({ owner: "alice" }, target);
    expect(back.owner.username).toBe("Alice");
    expect({ ...normalise(back), owner: null }).toEqual({ ...normalise(bundle), owner: null });
    for (const [i, d] of bundle.designs.entries())
      for (const [j, v] of d.versions.entries())
        expect(Buffer.from(back.designs[i].versions[j].yaml)).toEqual(Buffer.from(v.yaml));

    const shop = await target
      .select()
      .from(schema.designs)
      .where(eq(schema.designs.ownerId, alice.id));
    const byslug = (s: string) => shop.find((d) => d.slug === s)!;
    const [release] = await target
      .select()
      .from(schema.designVersions)
      .where(eq(schema.designVersions.id, byslug("shop").publishedVersionId!));
    expect(release.designId).toBe(byslug("shop").id);
    expect(release.yaml).toBe(bundle.designs[3].versions[0].yaml);
    expect(byslug("shop").currentVersionId).not.toBe(byslug("shop").publishedVersionId);
    const head = await target
      .select()
      .from(schema.designVersions)
      .where(eq(schema.designVersions.id, byslug("shop").currentVersionId!));
    expect(head[0].layout).toEqual(LAYOUT);
    expect(head[0].authorId).toBe(alice.id);
    expect(byslug("notes").visibility).toBe("private");
    expect(byslug("gone").deletedAt).not.toBeNull();
    // bob's version on alice's design keeps no author on a deployment bob may not be on.
    const authors = await target
      .select({ a: schema.designVersions.authorId })
      .from(schema.designVersions)
      .where(eq(schema.designVersions.designId, byslug("shop").id));
    expect(authors.filter((x) => x.a === null)).toHaveLength(1);
  });

  it("refuses a second import over the same addresses, and --replace purges and re-inserts", async () => {
    const { importOwner, formatImport } = await import("./import-owner");
    const before = await counts(target);
    await expect(importOwner(bundle, { owner: "alice", yes: true }, target)).rejects.toThrow(
      /--replace/,
    );
    expect(await counts(target)).toEqual(before);

    const dry = await importOwner(bundle, { owner: "alice", replace: true }, target);
    expect(dry.replaced.map((r) => r.slug)).toEqual(["blog", "gone", "notes", "shop"]);
    expect(await counts(target)).toEqual(before);

    const report = await importOwner(bundle, { owner: "alice", replace: true, yes: true }, target);
    expect(report.actions.every((a) => a === "replace")).toBe(true);
    expect(formatImport(report)).toMatch(/APPLIED/);
    expect(await counts(target)).toEqual(before);
    // The curated design and its reservation were not touched.
    const { schema } = await import("./index");
    const { isNull } = await import("drizzle-orm");
    expect(
      await target.select().from(schema.designs).where(isNull(schema.designs.ownerId)),
    ).toHaveLength(1);
    expect(
      await target.select().from(schema.designSlugs).where(isNull(schema.designSlugs.ownerId)),
    ).toHaveLength(1);
  });
});
