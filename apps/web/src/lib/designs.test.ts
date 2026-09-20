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

describe("deleting", () => {
  it("removes an unpublished design outright and frees its name", async () => {
    const { createDesign, deleteDesign, getTombstone } = await lib();
    const hugo = await makeUser("hugo");
    await createDesign(hugo as never, { title: "Draft", yaml: YAML });
    const res = await deleteDesign("hugo", "draft", hugo as never);
    expect(res.tombstoned).toBe(false);
    expect(await getTombstone("hugo", "draft")).toBeNull();
    const again = await createDesign(hugo as never, { title: "Draft", yaml: YAML });
    expect(again.design.slug).toBe("draft");
  });

  it("leaves a tombstone at a published address and keeps the name reserved", async () => {
    const { createDesign, deleteDesign, getTombstone } = await lib();
    const iris = await makeUser("iris");
    await createDesign(iris as never, { title: "Shipped", yaml: YAML });
    await (await lib()).patchDesign("iris", "shipped", iris as never, { visibility: "public" });
    const res = await deleteDesign("iris", "shipped", iris as never);
    expect(res.tombstoned).toBe(true);
    expect((await getTombstone("iris", "shipped"))?.title).toBe("Shipped");
    const again = await createDesign(iris as never, { title: "Shipped", yaml: YAML });
    expect(again.design.slug).toBe("shipped-2");
  });
});

describe("about and tags", () => {
  it("refuses a README past the limit and keeps the one already stored", async () => {
    const { createDesign, patchDesign, getDesign, MAX_README } = await lib();
    const jane = await makeUser("jane");
    await createDesign(jane as never, { title: "Readme", yaml: YAML });
    const kept = "# Title\n\nA paragraph.";
    await patchDesign("jane", "readme", jane as never, { readme: kept });
    await expect(
      patchDesign("jane", "readme", jane as never, { readme: "x".repeat(MAX_README + 1) }),
    ).rejects.toMatchObject({ status: 422 });
    const view = await getDesign("jane", "readme", jane as never);
    expect(view.design.readme).toBe(kept);
    // Exactly at the limit is accepted, and blank clears the field rather than storing "".
    const edge = "y".repeat(MAX_README);
    expect((await patchDesign("jane", "readme", jane as never, { readme: edge })).readme).toBe(
      edge,
    );
    expect(
      (await patchDesign("jane", "readme", jane as never, { readme: "   " })).readme,
    ).toBeNull();
  });

  it("normalises tags, drops the duplicates and stops at ten", async () => {
    const { createDesign, patchDesign, listTags, MAX_TAGS } = await lib();
    const karl = await makeUser("karl");
    await createDesign(karl as never, { title: "Tagged", yaml: YAML });
    const d = await patchDesign("karl", "tagged", karl as never, {
      tags: ["Event Driven", "  AWS  ", "aws", "!!!", "kafka"],
    });
    expect(d.tags).toEqual(["event-driven", "aws", "kafka"]);

    const many = await patchDesign("karl", "tagged", karl as never, {
      tags: Array.from({ length: 15 }, (_, i) => `tag-${i}`),
    });
    expect(many.tags).toHaveLength(MAX_TAGS);

    // A private design's words are not offered to a stranger.
    expect(await listTags(null)).toEqual([]);
    expect(await listTags(karl as never)).toContain("tag-0");
  });
});

describe("browsing by tag", () => {
  it("returns the designs carrying that exact word and no others", async () => {
    const { createDesign, patchDesign, listDesigns } = await lib();
    const lena = await makeUser("lena");
    const paid = await createDesign(lena as never, { title: "Paid", yaml: YAML });
    const free = await createDesign(lena as never, { title: "Free", yaml: YAML });
    await patchDesign("lena", paid.design.slug, lena as never, {
      visibility: "public",
      tags: ["billing", "billing-portal"],
    });
    await patchDesign("lena", free.design.slug, lena as never, { visibility: "public" });

    const hit = await listDesigns(null, { tag: "billing" });
    expect(hit.items.map((d) => d.title)).toEqual(["Paid"]);
    // Containment, not a substring: "billing" must not be answered by "billing-portal" alone.
    expect((await listDesigns(null, { tag: "billing-portal" })).items).toHaveLength(1);
    expect((await listDesigns(null, { tag: "bill" })).items).toEqual([]);
  });

  it("reads an unknown #word in the search box as a tag rather than as text", async () => {
    const { getCatalogue } = await import("./catalogue");
    const { parseQuery } = await import("./search-query");
    const q = parseQuery("#billing #aws stripe", getCatalogue());
    expect(q.tag).toBe("billing");
    expect(q.provider).toBe("aws");
    expect(q.text).toBe("stripe");
  });
});
