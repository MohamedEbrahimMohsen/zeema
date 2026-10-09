// The summary a referencing node reads (`refSummary`, GET .../summary): public designs only, the
// same 404 for private, deleted and missing, releases numbered in the order they were published.
// Against an embedded Postgres, as designs.test.ts.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeema-test-"));
  process.env.PGLITE_DIR = dir;
  process.env.DATABASE_URL = "";
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const ONE = `schemaVersion: "1"
type: "design"
id: "t"
nodes:
  - { id: "svc", component: "container-service" }
edges: []
`;

const TWO = `schemaVersion: "1"
type: "design"
id: "t"
nodes:
  - { id: "svc", component: "container-service" }
  - { id: "api", component: "container-service" }
edges: []
`;

const lib = () => import("./designs");

let nextGithubId = 1;
async function makeUser(username: string) {
  const { getDb, schema } = await import("@/db");
  const db = await getDb();
  const [u] = await db
    .insert(schema.users)
    .values({ githubId: nextGithubId++, username, displayName: username })
    .returning();
  return { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: null } as never;
}

async function status(p: Promise<unknown>) {
  try {
    await p;
    return 200;
  } catch (e) {
    return (e as { status?: number }).status ?? 500;
  }
}

describe("the summary of a referenced design", () => {
  it("numbers the releases of a public design and answers the current one", async () => {
    const { createDesign, saveVersion, publishDesign, refSummary } = await lib();
    const ada = await makeUser("ada");
    const d = await createDesign(ada, { title: "Notify", yaml: ONE, visibility: "public" });
    const head = await saveVersion("ada", d.design.slug, ada, {
      yaml: TWO,
      ifMatch: d.version.contentHash,
    });
    expect(head).toBeTruthy();
    await publishDesign("ada", d.design.slug, ada);
    const s = await refSummary("ada", d.design.slug);
    expect(s.name).toBe("Notify");
    expect(s.owner).toBe("ada");
    expect(s.latest).toBe(2);
    expect(s.release?.version).toBe(2);
    expect(s.releases.map((r) => r.version)).toEqual([1, 2]);
    expect(s.counts).toEqual({ nodes: 2, edges: 0, groups: 0 });
    expect(s.thumb?.startsWith(`/api/v1/designs/ada/${d.design.slug}/thumb?version=`)).toBe(true);
    expect(s.thumb).toMatch(/&v=[0-9a-f]{32}$/);
    // ?version: that release's counts, the latest unchanged.
    const first = await refSummary("ada", d.design.slug, { version: 1 });
    expect(first.release?.version).toBe(1);
    expect(first.latest).toBe(2);
    expect(first.counts.nodes).toBe(1);
    expect(await status(refSummary("ada", d.design.slug, { version: 3 }))).toBe(404);
  });

  it("answers a design never released with release null", async () => {
    const { createDesign, refSummary } = await lib();
    const { getDb, schema } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const bob = await makeUser("bob");
    const d = await createDesign(bob, { title: "Draft", yaml: ONE, visibility: "public" });
    // Public with nothing released: the release pointer and the version's stamp cleared.
    const db = await getDb();
    await db
      .update(schema.designs)
      .set({ publishedVersionId: null })
      .where(eq(schema.designs.id, d.design.id));
    await db
      .update(schema.designVersions)
      .set({ publishedAt: null })
      .where(eq(schema.designVersions.id, d.version.id));
    const s = await refSummary("bob", d.design.slug);
    expect(s.release).toBeNull();
    expect(s.latest).toBeNull();
    expect(s.releases).toEqual([]);
    expect(s.thumb).toBeNull();
  });

  it("is the same 404 for private, deleted and missing designs, owner included", async () => {
    const { createDesign, deleteDesign, patchDesign, refSummary } = await lib();
    const carol = await makeUser("carol");
    const secret = await createDesign(carol, { title: "Secret", yaml: ONE });
    expect(await status(refSummary("carol", secret.design.slug))).toBe(404);
    const gone = await createDesign(carol, { title: "Gone", yaml: ONE, visibility: "public" });
    await deleteDesign("carol", gone.design.slug, carol);
    expect(await status(refSummary("carol", gone.design.slug))).toBe(404);
    expect(await status(refSummary("carol", "never-was"))).toBe(404);
    expect(await status(refSummary("nobody", "never-was"))).toBe(404);
    // Made private after the reference was drawn: unreachable, like the rest.
    const later = await createDesign(carol, { title: "Later", yaml: ONE, visibility: "public" });
    expect(await status(refSummary("carol", later.design.slug))).toBe(200);
    await patchDesign("carol", later.design.slug, carol, { visibility: "private" });
    expect(await status(refSummary("carol", later.design.slug))).toBe(404);
  });

  it("follows a rename", async () => {
    const { createDesign, patchDesign, refSummary } = await lib();
    const dan = await makeUser("dan");
    const d = await createDesign(dan, { title: "Old", yaml: ONE, visibility: "public" });
    await patchDesign("dan", d.design.slug, dan, { slug: "new-name" });
    const s = await refSummary("dan", d.design.slug);
    expect(s.slug).toBe("new-name");
  });
});

describe("release numbers", () => {
  const at = (s: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, s));
  const row = (id: string, publishedAt: number | null, createdAt: number, broken = false) => ({
    id,
    broken,
    publishedAt: publishedAt === null ? null : at(publishedAt),
    createdAt: at(createdAt),
  });

  it("numbers releases by when they were released, from 1, skipping drafts and broken twins", async () => {
    const { releaseNumbers } = await lib();
    const rows = [
      row("draft", null, 50),
      row("third", 40, 30),
      row("broken", 5, 5, true),
      row("first", 10, 1),
      row("second", 20, 25),
    ];
    expect([...releaseNumbers(rows)]).toEqual([
      ["first", 1],
      ["second", 2],
      ["third", 3],
    ]);
    // Stable: the order the rows come in does not matter.
    expect(releaseNumbers([...rows].reverse())).toEqual(releaseNumbers(rows));
  });

  it("breaks a tie in release time by when the version was saved", async () => {
    const { releaseNumbers } = await lib();
    const n = releaseNumbers([row("later", 10, 9), row("earlier", 10, 2)]);
    expect(n.get("earlier")).toBe(1);
    expect(n.get("later")).toBe(2);
  });

  it("is the numbering the summary of a reference answers", async () => {
    const {
      addBrokenVersion,
      createDesign,
      designReleaseNumbers,
      publishDesign,
      refSummary,
      saveVersion,
    } = await lib();

    const eve = await makeUser("eve");
    const d = await createDesign(eve, { title: "Feed", yaml: ONE, visibility: "public" });
    await addBrokenVersion(d.design.id, TWO);
    await saveVersion("eve", d.design.slug, eve, { yaml: TWO, ifMatch: d.version.contentHash });
    await publishDesign("eve", d.design.slug, eve);
    const numbers = await designReleaseNumbers(d.design.id);
    expect(numbers.size).toBe(2);
    expect(numbers.get(d.version.id)).toBe(1);
    const s = await refSummary("eve", d.design.slug);
    expect(new Map(s.releases.map((r) => [r.id, r.version]))).toEqual(numbers);
    expect(s.latest).toBe(2);
  });
});
