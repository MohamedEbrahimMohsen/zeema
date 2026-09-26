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

describe("publishing a draft address", () => {
  const draft = async (username: string, title: string) => {
    const { createDesign } = await lib();
    const { newDraftSlug } = await import("./slug");
    const user = await makeUser(username);
    const d = await createDesign(user as never, { title, slug: newDraftSlug(), yaml: YAML });
    return { user, slug: d.design.slug };
  };

  it("grows a draft address into its title and keeps the old one resolving", async () => {
    const { publishDesign, resolveAlias, getDesign } = await lib();
    const { user, slug } = await draft("hana", "YouTube copy");
    expect(slug).toMatch(/^draft-[0-9a-f]{6}$/);

    const out = await publishDesign("hana", slug, user as never);
    expect(out.design.slug).toBe("youtube-copy");
    // Both addresses are reserved: the new one is public property, the old one still points home.
    expect(await resolveAlias("hana", slug)).toBe("youtube-copy");
    expect((await getDesign("hana", "youtube-copy", user as never)).design.id).toBe(out.design.id);
  });

  it("numbers the second draft that wants the same title", async () => {
    const { publishDesign } = await lib();
    const { createDesign } = await lib();
    const { newDraftSlug } = await import("./slug");
    const ian = await makeUser("ian");
    const first = await createDesign(ian as never, {
      title: "YouTube copy",
      slug: newDraftSlug(),
      yaml: YAML,
    });
    const second = await createDesign(ian as never, {
      title: "YouTube copy",
      slug: newDraftSlug(),
      yaml: YAML,
    });
    expect((await publishDesign("ian", first.design.slug, ian as never)).design.slug).toBe(
      "youtube-copy",
    );
    expect((await publishDesign("ian", second.design.slug, ian as never)).design.slug).toBe(
      "youtube-copy-2",
    );
  });

  it("leaves an address the owner chose alone", async () => {
    const { createDesign, patchDesign, publishDesign } = await lib();
    const jo = await makeUser("jo");
    const { newDraftSlug } = await import("./slug");
    const d = await createDesign(jo as never, {
      title: "YouTube copy",
      slug: newDraftSlug(),
      yaml: YAML,
    });
    await patchDesign("jo", d.design.slug, jo as never, { slug: "my-thing" });
    expect((await publishDesign("jo", "my-thing", jo as never)).design.slug).toBe("my-thing");
  });

  it("keeps the draft address when the title slugifies to nothing", async () => {
    const { publishDesign } = await lib();
    const { user, slug } = await draft("kim", "!!! ???");
    expect((await publishDesign("kim", slug, user as never)).design.slug).toBe(slug);
  });
});

describe("discarding a draft", () => {
  const YAML2 = YAML.replace('"svc"', '"svc2"');

  // A published design whose head has since moved on: the shape every discard test needs.
  const withDraft = async (username: string) => {
    const { createDesign, publishDesign, saveVersion, getDesign } = await lib();
    const user = await makeUser(username);
    const made = await createDesign(user as never, { title: "Thing", yaml: YAML });
    const released = await publishDesign(username, made.design.slug, user as never);
    await saveVersion(username, made.design.slug, user as never, {
      yaml: YAML2,
      message: "a draft",
      ifMatch: made.version.contentHash,
    });
    const view = await getDesign(username, made.design.slug, user as never);
    return { user, slug: made.design.slug, release: released.version.id, view };
  };

  it("puts the head back on the release and deletes the versions saved since it", async () => {
    const { discardDraft, listVersions, getDesign } = await lib();
    const { user, slug, release, view } = await withDraft("nina");
    expect(view.design.currentVersionId).not.toBe(release);
    const before = (await listVersions(view)).length;

    const after = await discardDraft("nina", slug, user as never);
    expect(after.design.currentVersionId).toBe(release);
    expect(after.design.publishedVersionId).toBe(release);
    expect(after.unpublished).toBe(false);
    expect(after.deletedVersionCount).toBe(1);
    // The draft row is gone; the release is still the whole history.
    const left = await listVersions(after);
    expect(left.length).toBe(before - 1);
    expect(left.map((v) => v.id)).toEqual([release]);
    expect((await getDesign("nina", slug, user as never)).version?.id).toBe(release);
  });

  it("keeps everything up to the release and takes everything after it", async () => {
    const { createDesign, publishDesign, saveVersion, discardDraft, listVersions } = await lib();
    const user = await makeUser("sami");
    const made = await createDesign(user as never, { title: "Layers", yaml: YAML });
    const first = made.version;
    // A second save, released: now there are two versions and the release is the later one.
    const second = await saveVersion("sami", made.design.slug, user as never, {
      yaml: YAML2,
      message: "second",
      ifMatch: first.contentHash,
    });
    const released = await publishDesign("sami", made.design.slug, user as never);
    expect(released.version.id).toBe(second.version.id);
    // Two more drafts on top, each with its own message so neither folds into the head.
    const third = await saveVersion("sami", made.design.slug, user as never, {
      yaml: YAML.replace('"svc"', '"svc3"'),
      message: "third",
      ifMatch: second.version.contentHash,
    });
    const fourth = await saveVersion("sami", made.design.slug, user as never, {
      yaml: YAML.replace('"svc"', '"svc4"'),
      message: "fourth",
      ifMatch: third.version.contentHash,
    });
    expect(fourth.version.id).not.toBe(third.version.id);

    const after = await discardDraft("sami", made.design.slug, user as never);
    expect(after.deletedVersionCount).toBe(2);
    expect(after.design.currentVersionId).toBe(released.version.id);
    const ids = (await listVersions(after)).map((v) => v.id).sort();
    expect(ids).toEqual([first.id, second.version.id].sort());
  });

  it("counts in the view exactly what the discard deletes", async () => {
    const { createDesign, publishDesign, saveVersion, discardDraft, getDesign } = await lib();
    const user = await makeUser("tess");
    const made = await createDesign(user as never, { title: "Counted", yaml: YAML });
    const released = await publishDesign("tess", made.design.slug, user as never);
    // Before any draft, there is nothing to discard and nothing to warn about.
    expect((await getDesign("tess", made.design.slug, user as never)).draftVersionCount).toBe(0);
    let hash = released.version.contentHash;
    for (const [i, id] of ["a", "b", "c"].entries()) {
      const saved = await saveVersion("tess", made.design.slug, user as never, {
        yaml: YAML.replace('"svc"', `"svc-${id}"`),
        message: `draft ${i}`,
        ifMatch: hash,
      });
      hash = saved.version.contentHash;
    }
    const view = await getDesign("tess", made.design.slug, user as never);
    expect(view.draftVersionCount).toBe(3);
    const after = await discardDraft("tess", made.design.slug, user as never);
    expect(after.deletedVersionCount).toBe(view.draftVersionCount);
    expect(after.draftVersionCount).toBe(0);
  });

  it("clears versions left behind when the head already is the release", async () => {
    // The shape a design discarded under the older behaviour is in: the head is back on the
    // release, and the versions saved after it were never deleted.
    const { createDesign, publishDesign, saveVersion, discardDraft, getDesign, listVersions } =
      await lib();
    const { getDb, schema } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    const user = await makeUser("umar");
    const made = await createDesign(user as never, { title: "Left behind", yaml: YAML });
    const released = await publishDesign("umar", made.design.slug, user as never);
    let hash = released.version.contentHash;
    for (const id of ["a", "b"]) {
      const saved = await saveVersion("umar", made.design.slug, user as never, {
        yaml: YAML.replace('"svc"', `"svc-${id}"`),
        message: `draft ${id}`,
        ifMatch: hash,
      });
      hash = saved.version.contentHash;
    }
    await db
      .update(schema.designs)
      .set({ currentVersionId: released.version.id })
      .where(eq(schema.designs.id, made.design.id));

    const stale = await getDesign("umar", made.design.slug, user as never);
    expect(stale.unpublished).toBe(false);
    expect(stale.draftVersionCount).toBe(2);

    const after = await discardDraft("umar", made.design.slug, user as never);
    expect(after.deletedVersionCount).toBe(2);
    expect(after.design.currentVersionId).toBe(released.version.id);
    expect(after.draftVersionCount).toBe(0);
    expect((await listVersions(after)).map((v) => v.id)).toEqual([released.version.id]);
  });

  it("refuses when the head is the release and nothing was left behind", async () => {
    const { createDesign, publishDesign, discardDraft, getDesign } = await lib();
    const user = await makeUser("vera");
    const made = await createDesign(user as never, { title: "Nothing to do", yaml: YAML });
    await publishDesign("vera", made.design.slug, user as never);
    expect((await getDesign("vera", made.design.slug, user as never)).draftVersionCount).toBe(0);
    await expect(discardDraft("vera", made.design.slug, user as never)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("refuses a design that was never published", async () => {
    const { createDesign, discardDraft } = await lib();
    const user = await makeUser("omar");
    const made = await createDesign(user as never, { title: "Unreleased", yaml: YAML });
    await expect(discardDraft("omar", made.design.slug, user as never)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("refuses when the head already is the release", async () => {
    const { discardDraft } = await lib();
    const { user, slug } = await withDraft("pia");
    await discardDraft("pia", slug, user as never);
    await expect(discardDraft("pia", slug, user as never)).rejects.toMatchObject({ status: 409 });
  });

  it("is the owner's alone: 403 on a public design, 404 on a private one", async () => {
    const { discardDraft, patchDesign } = await lib();
    const stranger = await makeUser("quinn");
    const priv = await withDraft("rosa");
    // Private by default: a stranger is told nothing at all.
    await expect(discardDraft("rosa", priv.slug, stranger as never)).rejects.toMatchObject({
      status: 404,
    });
    await patchDesign("rosa", priv.slug, priv.user as never, { visibility: "public" });
    await expect(discardDraft("rosa", priv.slug, stranger as never)).rejects.toMatchObject({
      status: 403,
    });
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

  it("tags a design with a provider id that carries digits whole: k8s, not k", async () => {
    const { createDesign, patchDesign, listDesigns } = await lib();
    const kube = await makeUser("kube");
    const yaml = `schemaVersion: "1"
type: "design"
id: "k"
nodes:
  - { id: "dep", component: "k8s-deployment" }
edges: []
`;
    const d = await createDesign(kube as never, { title: "Cluster", yaml });
    await patchDesign("kube", d.design.slug, kube as never, { visibility: "public" });
    const [row] = (await listDesigns(null, { q: "Cluster" })).items;
    expect(row.providers).toEqual(["k8s"]);
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

// Every query this service builds is bound by the driver, and a real Postgres hashes those
// parameters before it runs anything: a Date reaching the driver unmapped throws there while
// PGlite shrugs and accepts it. So the shape of the parameters is asserted here, not the
// behaviour of the embedded database.
describe("query parameters", () => {
  const bindable = (v: unknown) =>
    v === null || ["string", "number", "boolean"].includes(typeof v) || Buffer.isBuffer(v);

  it("binds timestamps as strings, never as Date objects", async () => {
    const { abandonedSince } = await lib();
    const { getDb, schema } = await import("@/db");
    const db = await getDb();
    const at = new Date("2024-05-01T10:00:00.000Z");
    const { params } = db
      .select({ id: schema.designVersions.id })
      .from(schema.designVersions)
      .where(abandonedSince("11111111-1111-1111-1111-111111111111", { id: "abc", createdAt: at }))
      .toSQL();
    for (const p of params) expect(p, `${String(p)} is not bindable`).toSatisfy(bindable);
    expect(params).toContain(at.toISOString());
  });
});

describe("security review fixes", () => {
  it("treats % and _ in the search box as text, not wildcards (F-13)", async () => {
    const { createDesign, listDesigns, patchDesign } = await lib();
    const uma = await makeUser("uma");
    const d = await createDesign(uma as never, { title: "Discount 100% off", yaml: YAML });
    await patchDesign("uma", d.design.slug, uma as never, { visibility: "public" });
    const pct = await listDesigns(null, { q: "100%" });
    expect(pct.items.map((i) => i.id)).toContain(d.design.id);
    const wild = await listDesigns(null, { q: "%_%_%" });
    expect(wild.total).toBe(0);
    const under = await listDesigns(null, { q: "Discount_100" });
    expect(under.total).toBe(0);
  });

  it("reads NaN pagination as the defaults (F-17)", async () => {
    const { listDesigns } = await lib();
    const r = await listDesigns(null, { page: Number.NaN, pageSize: Number.NaN });
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(24);
  });

  it("stores the layout sidecar normalised and bounded (F-10)", async () => {
    const { createDesign, normaliseLayout } = await lib();
    const vic = await makeUser("vic");
    const d = await createDesign(vic as never, {
      title: "Layout",
      yaml: YAML,
      layout: {
        version: 2,
        nodes: { svc: [1, 2] },
        edges: {},
        notes: [{ id: "n1", x: 0, y: 0, w: 100, h: 60, text: "x".repeat(5000) }],
        junk: { deep: "dropped" },
      },
    });
    const stored = d.version.layout as Record<string, unknown>;
    expect(stored.junk).toBeUndefined();
    expect((stored.notes as { text: string }[])[0].text.length).toBe(2000);
    const huge: Record<string, [number, number]> = {};
    for (let i = 0; i < 3000; i++) huge[`n${i}`] = [i, i];
    expect(() => normaliseLayout({ nodes: huge })).toThrow(/layout too large/);
    expect(() => normaliseLayout("x")).toThrow(/layout must be an object/);
    expect(normaliseLayout(undefined)).toBeNull();
  });

  it("round-trips boundary styles through the stored layout and drops bad ones", async () => {
    const { normaliseLayout } = await lib();
    const s = normaliseLayout({
      nodes: {},
      frames: {
        vpc: { tint: "blue", icon: "kind:api-gateway" },
        edge: { tint: "#f00", icon: "component:../../x" },
        cell: { icon: "component:aws/aws-lambda", junk: 1 },
        zone: { tint: "#FF0000" },
        dmz: { tint: "rgb(255,0,0)" },
      },
    }) as { frames: Record<string, unknown> };
    expect(s.frames).toEqual({
      vpc: { tint: "blue", icon: "kind:api-gateway" },
      cell: { icon: "component:aws/aws-lambda" },
      zone: { tint: "#ff0000" },
    });
  });

  it("keeps a chosen badge in the stored layout and drops a bad one", async () => {
    const { normaliseLayout } = await lib();
    expect(normaliseLayout({ nodes: {}, badge: "boundary:google" })?.badge).toBe("boundary:google");
    expect(normaliseLayout({ nodes: {}, badge: "kind:cache" })?.badge).toBeUndefined();
  });

  it("counts a view once per visitor and hour (F-08)", async () => {
    const { createDesign, getDesign, patchDesign, recordEvent } = await lib();
    const wes = await makeUser("wes");
    const d = await createDesign(wes as never, { title: "Counted", yaml: YAML });
    await patchDesign("wes", d.design.slug, wes as never, { visibility: "public" });
    expect(await recordEvent(d.design.id, null, "view", { ip: "198.51.100.1" })).toBe(true);
    expect(await recordEvent(d.design.id, null, "view", { ip: "198.51.100.1" })).toBe(false);
    expect(await recordEvent(d.design.id, null, "view", { ip: "198.51.100.2" })).toBe(true);
    expect(await recordEvent(d.design.id, wes as never, "export", { format: "svg" })).toBe(true);
    expect(await recordEvent(d.design.id, wes as never, "export", { format: "png" })).toBe(false);
    const view = await getDesign("wes", d.design.slug, null);
    expect(view.stats.viewCount).toBe(2);
    expect(view.stats.exportCount).toBe(1);
  });
});

describe("sessions (F-18)", () => {
  it("revoking a role ends every session of that account", async () => {
    const { getDb, schema } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const { createSession } = await import("./auth");
    const { grantRole, revokeRole } = await import("./iam");
    const root = await makeUser("root-admin");
    const target = await makeUser("xena");
    const db = await getDb();
    await db.insert(schema.roleGrants).values({ userId: root.id, role: "admin" });
    const acting = { ...root, sessionId: "x", roles: ["admin"], actingAdmin: true } as never;
    await grantRole(acting, { username: "xena", role: "admin" });
    await createSession(target.id);
    await createSession(target.id);
    await revokeRole(acting, { username: "xena", role: "admin" });
    const rows = await db
      .select({ revoked: schema.sessions.revoked })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, target.id));
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.revoked)).toBe(true);
  });

  it("sign out everywhere revokes every session of the account", async () => {
    const { getDb, schema } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const { createSession, revokeAllSessions } = await import("./auth");
    const yan = await makeUser("yan");
    await createSession(yan.id);
    await createSession(yan.id);
    await revokeAllSessions(yan.id);
    const db = await getDb();
    const rows = await db
      .select({ revoked: schema.sessions.revoked })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, yan.id));
    expect(rows.every((r) => r.revoked)).toBe(true);
  });
});

describe("grafana views (F-05)", () => {
  it("exposes only the columns the dashboards need", async () => {
    const { getDb } = await import("@/db");
    const db = await getDb();
    const res = (await db.execute(
      "select table_name, column_name from information_schema.columns where table_schema = 'grafana' order by 1, 2",
    )) as unknown as { rows?: { table_name: string; column_name: string }[] };
    const rows = res.rows ?? (res as unknown as { table_name: string; column_name: string }[]);
    const cols = rows.map((r) => `${r.table_name}.${r.column_name}`);
    expect(cols).toContain("design_stats.view_count");
    expect(cols).toContain("users.username");
    expect(cols).not.toContain("design_events.ip_hash");
    expect(cols).not.toContain("design_events.actor_id");
    expect(cols.some((c) => c.startsWith("sessions."))).toBe(false);
    expect(cols.some((c) => c.startsWith("design_versions."))).toBe(false);
    expect(cols.filter((c) => c.startsWith("users.")).sort()).toEqual([
      "users.created_at",
      "users.id",
      "users.username",
    ]);
  });
});

describe("the list badge", () => {
  it("is chosen by the owner through a layout-only save, and shows on their listing", async () => {
    const { createDesign, getDesign, listDesigns, setBadge } = await lib();
    const user = await makeUser("bea");
    const made = await createDesign(user as never, {
      title: "Badged",
      yaml: YAML,
      layout: { nodes: { svc: [4, 5] } },
    });
    const slug = made.design.slug;
    const out = await setBadge("bea", slug, user as never, "provider:gcp");
    expect(out.version.contentHash).toBe(made.version.contentHash);
    const view = await getDesign("bea", slug, user as never);
    const layout = view.version?.layout as { badge?: string; nodes: unknown };
    expect(layout.badge).toBe("provider:gcp");
    expect(layout.nodes).toEqual({ svc: [4, 5] });
    const mine = await listDesigns(user as never, { scope: "mine" });
    expect(mine.items.find((d) => d.slug === slug)?.badge?.name).toBe("GCP");
    await setBadge("bea", slug, user as never, "boundary:google");
    expect(
      (await listDesigns(user as never, { scope: "mine" })).items.find((d) => d.slug === slug)
        ?.badge?.markup,
    ).toBeTruthy();
    await setBadge("bea", slug, user as never, null);
    const back = (await getDesign("bea", slug, user as never)).version?.layout as {
      badge?: string;
      nodes: unknown;
    };
    expect(back.badge).toBeUndefined();
    expect(back.nodes).toEqual({ svc: [4, 5] });
  });

  it("refuses refs that are not badges, and anyone but the owner", async () => {
    const { createDesign, patchDesign, setBadge } = await lib();
    const user = await makeUser("cal");
    const stranger = await makeUser("dee");
    const priv = await createDesign(user as never, { title: "Mine", yaml: YAML });
    for (const bad of ["kind:cache", "component:aws/s3", "provider:nope", "provider:default", 7])
      await expect(setBadge("cal", priv.design.slug, user as never, bad)).rejects.toMatchObject({
        status: 400,
      });
    await expect(
      setBadge("cal", priv.design.slug, stranger as never, "provider:gcp"),
    ).rejects.toMatchObject({ status: 404 });
    await patchDesign("cal", priv.design.slug, user as never, { visibility: "public" });
    await expect(
      setBadge("cal", priv.design.slug, stranger as never, "provider:gcp"),
    ).rejects.toMatchObject({ status: 403 });
    await expect(setBadge("cal", priv.design.slug, null, "provider:gcp")).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("an empty design", () => {
  // What /new creates: no components and no connections yet.
  const EMPTY = `schemaVersion: "1"
type: "design"
id: "new-design"
nodes: []
edges: []
`;

  it("is created, read back byte for byte, and listed with no badge and no thumbnail", async () => {
    const { createDesign, getDesign, listDesigns } = await lib();
    const gil = await makeUser("gil");
    const d = await createDesign(gil as never, {
      title: "Untitled design",
      slug: "draft-empty",
      visibility: "private",
      yaml: EMPTY,
      message: "created",
    });
    const view = await getDesign("gil", d.design.slug, gil as never);
    expect(view.version?.yaml).toBe(EMPTY);
    const { items } = await listDesigns(gil as never, { scope: "mine" });
    const row = items.find((i) => i.slug === d.design.slug);
    expect(row).toBeDefined();
    expect(row?.badge).toBeNull();
    expect(row?.thumb).toBeNull();
    expect(row?.nodeCount).toBe(0);
    expect(row?.edgeCount).toBe(0);
    expect(row?.findingCount).toBe(0);
  });
});
