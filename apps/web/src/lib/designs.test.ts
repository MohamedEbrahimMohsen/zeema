// The naming rules decide what a public address means, so a regression here silently points
// somebody's link at a different design. These run against an embedded Postgres, migrations and
// all, rather than mocking the queries the rules are made of.

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

const YAML = `schemaVersion: "1"
type: "design"
id: "t"
nodes:
  - { id: "svc", component: "container-service" }
edges: []
`;

async function lib() {
  return await import("./designs");
}

let nextGithubId = 1;

async function makeUser(username: string) {
  const { getDb, schema } = await import("@/db");
  const db = await getDb();
  const [u] = await db
    .insert(schema.users)
    .values({ githubId: nextGithubId++, username, displayName: username })
    .returning();
  return { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: null };
}

describe("names", () => {
  it("gives a design the name asked for, and numbers the next one", async () => {
    const { createDesign } = await lib();
    const alice = await makeUser("alice");
    const a = await createDesign(alice as never, { title: "Youtube", yaml: YAML });
    const b = await createDesign(alice as never, { title: "Youtube", yaml: YAML });
    expect(a.design.slug).toBe("youtube");
    expect(b.design.slug).toBe("youtube-2");
  });

  it("keeps names per owner, so two people can both have youtube", async () => {
    const { createDesign } = await lib();
    const bob = await makeUser("bob");
    const mine = await createDesign(bob as never, { title: "Youtube", yaml: YAML });
    expect(mine.design.slug).toBe("youtube");
  });

  it("clones under the source's own name, not a -copy suffix", async () => {
    const { createDesign, cloneDesign, patchDesign } = await lib();
    const carol = await makeUser("carol");
    const dave = await makeUser("dave");
    const src = await createDesign(carol as never, { title: "Stripe Payments", yaml: YAML });
    await patchDesign("carol", src.design.slug, carol as never, { visibility: "public" });
    const cloned = await cloneDesign("carol", src.design.slug, dave as never);
    expect(cloned.design.slug).toBe("stripe-payments");
    expect(cloned.design.title).toBe("Stripe Payments");
  });
});

describe("renaming", () => {
  it("redirects the old address and refuses to hand the name to anything else", async () => {
    const { createDesign, patchDesign, resolveAlias, getDesign } = await lib();
    const erin = await makeUser("erin");
    const d = await createDesign(erin as never, { title: "Notes", yaml: YAML });
    await patchDesign("erin", "notes", erin as never, { visibility: "public" });
    await patchDesign("erin", "notes", erin as never, { slug: "notebook" });

    expect(await resolveAlias("erin", "notes")).toBe("notebook");
    expect((await getDesign("erin", "notebook", erin as never)).design.id).toBe(d.design.id);

    // The owner's own later design cannot take the released name back.
    const other = await createDesign(erin as never, { title: "Notes", yaml: YAML });
    expect(other.design.slug).toBe("notes-2");
    await expect(
      patchDesign("erin", other.design.slug, erin as never, { slug: "notes" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("answers in one hop however many times it was renamed", async () => {
    const { createDesign, patchDesign, resolveAlias } = await lib();
    const frank = await makeUser("frank");
    await createDesign(frank as never, { title: "One", yaml: YAML });
    await patchDesign("frank", "one", frank as never, { visibility: "public" });
    const names = ["two", "three", "four", "five"];
    let from = "one";
    for (const to of names) {
      await patchDesign("frank", from, frank as never, { slug: to });
      from = to;
    }
    for (const old of ["one", "two", "three", "four"]) {
      expect(await resolveAlias("frank", old)).toBe("five");
    }
  });

  it("lets a design take back a name it used to hold", async () => {
    const { createDesign, patchDesign } = await lib();
    const gina = await makeUser("gina");
    await createDesign(gina as never, { title: "Loop", yaml: YAML });
    await patchDesign("gina", "loop", gina as never, { visibility: "public" });
    await patchDesign("gina", "loop", gina as never, { slug: "circle" });
    const back = await patchDesign("gina", "circle", gina as never, { slug: "loop" });
    expect(back.slug).toBe("loop");
  });
});
