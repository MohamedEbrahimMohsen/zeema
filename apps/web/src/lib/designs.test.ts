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
