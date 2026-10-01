// The list thumbnail: getDesign's authorization, and caching that is only ever as long as the
// picture is fixed. Runs against an embedded Postgres, like designs.test.ts.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeema-thumb-"));
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

async function setup(username: string, visibility: "public" | "private") {
  const { createDesign, publishDesign } = await import("./designs");
  const user = await makeUser(username);
  const made = await createDesign(user, { title: "Shop", slug: "shop", visibility, yaml: YAML });
  const out = await publishDesign(username, made.design.slug, user);
  const { thumbKey } = await import("./thumb-key");
  const v = out.version;
  return { user, slug: out.design.slug, key: thumbKey(v.contentHash, v.layout) };
}

describe("the list thumbnail", () => {
  it("serves a released public design as a shared, immutable SVG", async () => {
    const { thumbResponse } = await import("./thumb");
    const { slug, key } = await setup("tara", "public");
    const res = await thumbResponse("tara", slug, null, { v: key, theme: "dark" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^image\/svg\+xml/);
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("etag")).toBe(`"${key}-dark"`);
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
    const svg = await res.text();
    expect(svg).toContain("<svg");
    // On the card's own colour, not the engine's page colour.
    expect(svg).toContain(":root{--bg:#1b1b1f}");
  });

  it("answers a matching If-None-Match with 304 and no body", async () => {
    const { thumbResponse } = await import("./thumb");
    const { key } = await setup("uma", "public");
    const res = await thumbResponse("uma", "shop", null, {
      v: key,
      ifNoneMatch: `"${key}-light"`,
    });
    expect(res.status).toBe(304);
    expect(await res.text()).toBe("");
    expect(res.headers.get("cache-control")).toContain("immutable");
  });

  it("does not cache a stale or missing key, and still draws", async () => {
    const { thumbResponse } = await import("./thumb");
    await setup("vic", "public");
    for (const v of [undefined, "stale"]) {
      const res = await thumbResponse("vic", "shop", null, { v });
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-cache");
    }
  });

  it("keeps a private design private: 404 to a stranger, private cache to the owner", async () => {
    const { thumbResponse } = await import("./thumb");
    const { user, key } = await setup("wes", "private");
    const stranger = await makeUser("xan");
    for (const viewer of [null, stranger])
      await expect(thumbResponse("wes", "shop", viewer, { v: key })).rejects.toMatchObject({
        status: 404,
      });
    const res = await thumbResponse("wes", "shop", user, { v: key });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
  });

  it("changes its key when only the layout moves", async () => {
    const { thumbKey } = await import("./thumb-key");
    const a = thumbKey("h", { nodes: { svc: [0, 0] } });
    expect(thumbKey("h", { nodes: { svc: [0, 0] } })).toBe(a);
    expect(thumbKey("h", { nodes: { svc: [10, 0] } })).not.toBe(a);
    expect(thumbKey("h2", { nodes: { svc: [0, 0] } })).not.toBe(a);
  });

  it("changes its key when a component tint or a tint's strength changes", async () => {
    const { thumbKey } = await import("./thumb-key");
    const base = { nodes: { svc: [0, 0] }, frames: { g: { tint: "blue" } } };
    const a = thumbKey("h", base);
    const tinted = { ...base, tints: { svc: { tint: "rose" } } };
    expect(thumbKey("h", tinted)).not.toBe(a);
    expect(
      thumbKey("h", { ...tinted, tints: { svc: { tint: "rose", strength: "bold" } } }),
    ).not.toBe(thumbKey("h", tinted));
    expect(thumbKey("h", { ...base, frames: { g: { tint: "blue", strength: "light" } } })).not.toBe(
      a,
    );
  });

  it("keeps its key when only the list badge changes: the badge is not in the picture", async () => {
    const { thumbKey } = await import("./thumb-key");
    const a = thumbKey("h", { nodes: { svc: [0, 0] } });
    expect(thumbKey("h", { nodes: { svc: [0, 0] }, badge: "provider:gcp" })).toBe(a);
    expect(thumbKey("h", null)).toBe(thumbKey("h", undefined));
    // A sidecar that exists only to carry the badge keys like no sidecar at all.
    const blank = { version: 2, nodes: {}, edges: {}, notes: [], frames: {} };
    expect(thumbKey("h", { ...blank, badge: "boundary:google" })).toBe(thumbKey("h", null));
  });

  it("names the listed version and its key on every drawable row", async () => {
    const { listDesigns } = await import("./designs");
    const { key } = await setup("yul", "public");
    const { items } = await listDesigns(null, { owner: "yul" });
    expect(items[0].thumb?.key).toBe(key);
  });
});
