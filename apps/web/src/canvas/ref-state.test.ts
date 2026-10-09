import { describe, expect, it } from "vitest";
import {
  type RefEntry,
  RefStore,
  type RefSummary,
  refHref,
  refState,
  refStatusText,
  renderHref,
} from "./ref-state";

const summary = (latest: number | null): RefSummary => {
  const releases = Array.from({ length: latest ?? 0 }, (_, i) => ({
    version: i + 1,
    id: `id-${i + 1}`,
    publishedAt: "2026-10-01T00:00:00.000Z",
  }));
  return {
    name: "Notification System",
    owner: "ada",
    slug: "notification-system",
    release: releases.at(-1) ?? null,
    latest,
    releases,
    counts: { nodes: 4, edges: 3, groups: 1 },
    thumb: latest ? "/api/v1/designs/ada/notification-system/thumb?version=id-1&v=k" : null,
  };
};
const ok = (latest: number | null): RefEntry => ({ status: "ok", summary: summary(latest) });

describe("the state of a reference", () => {
  it("is pending until the summary answers", () => {
    expect(refState(undefined, 3)).toBe("pending");
    expect(refState({ status: "pending" }, "head")).toBe("pending");
  });

  it("is current when pinned at the latest release, newer when below it", () => {
    expect(refState(ok(3), 3)).toBe("current");
    expect(refState(ok(5), 3)).toBe("newer");
  });

  it("follows head: current once the design has a release", () => {
    expect(refState(ok(2), "head")).toBe("current");
    expect(refState(ok(null), "head")).toBe("unreleased");
  });

  it("is unreleased with no release, or pinned past the latest one", () => {
    expect(refState(ok(null), 1)).toBe("unreleased");
    expect(refState(ok(2), 7)).toBe("unreleased");
  });

  it("is unreachable on a 404", () => {
    expect(refState({ status: "unreachable" }, 1)).toBe("unreachable");
  });

  it("says where it stands in one line", () => {
    expect(refStatusText(ok(5), 3)).toBe("Pinned at v3 · v5 available");
    expect(refStatusText(ok(3), 3)).toBe("Pinned at v3 · latest");
    expect(refStatusText(ok(3), "head")).toBe("Follows latest · v3");
    expect(refStatusText({ status: "unreachable" }, 3)).toBe("Not available");
  });
});

describe("addresses", () => {
  it("opens the design page plain at the latest release, by version id otherwise", () => {
    expect(refHref("ada", "notification-system", ok(3), 3)).toBe("/d/ada/notification-system");
    expect(refHref("ada", "notification-system", ok(3), "head")).toBe("/d/ada/notification-system");
    expect(refHref("ada", "notification-system", ok(5), 2)).toBe(
      "/d/ada/notification-system?v=id-2",
    );
    expect(refHref("ada", "x", { status: "unreachable" }, 2)).toBe("/d/ada/x");
  });

  it("renders a release in the theme asked for", () => {
    expect(renderHref("ada", "x", "id-2", "dark")).toBe(
      "/api/v1/designs/ada/x/render?theme=dark&version=id-2",
    );
    expect(renderHref("ada", "x", null, "light")).toBe("/api/v1/designs/ada/x/render?theme=light");
  });
});

describe("the store", () => {
  it("asks once per owner/slug, whatever the case, and tells its listeners", async () => {
    const calls: string[] = [];
    const store = new RefStore(async (owner, slug) => {
      calls.push(`${owner}/${slug}`);
      return summary(2);
    });
    let heard = 0;
    store.subscribe(() => heard++);
    const a = store.ensure("ada", "notification-system");
    const b = store.ensure("Ada", "Notification-System");
    expect(store.get("ada", "notification-system")).toEqual({ status: "pending" });
    await Promise.all([a, b]);
    await store.ensure("ada", "notification-system");
    expect(calls).toEqual(["ada/notification-system"]);
    expect(heard).toBe(1);
    expect(refState(store.get("ada", "notification-system"), 2)).toBe("current");
  });

  it("keeps two designs apart", async () => {
    const store = new RefStore(async (_o, slug) => (slug === "gone" ? null : summary(1)));
    await Promise.all([store.ensure("ada", "gone"), store.ensure("ada", "here")]);
    expect(store.get("ada", "gone")).toEqual({ status: "unreachable" });
    expect(store.get("ada", "here")?.status).toBe("ok");
  });

  it("reads a fetch that rejects as unreachable", async () => {
    const store = new RefStore(async () => {
      throw new Error("offline");
    });
    const entry = await store.ensure("ada", "x");
    expect(entry).toEqual({ status: "unreachable" });
    expect(refState(entry, "head")).toBe("unreachable");
  });
});
