import { describe, expect, it } from "vitest";
import {
  parseDesignRef,
  pinFromSummary,
  REF_COLOR,
  type RefEntry,
  RefStore,
  type RefSummary,
  refColor,
  refHref,
  refName,
  refNameFor,
  refState,
  refStatusText,
  renderHref,
  wantsRefPicker,
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

// A Zeema design box (kind `subsystem`) carries the disc before it names a design. Two components
// are enough for the pure part: the kind is all these helpers read.
const catalogue = {
  components: {
    "zeema-design": { kind: "subsystem" },
    postgres: { kind: "sql-database" },
  },
};
const pinned = { design: "ada/notification-system", version: 3 };

describe("a Zeema design box", () => {
  it("with no design chosen is unset: amber, whatever the store holds", () => {
    expect(REF_COLOR.unset).toBe("var(--warn)");
    expect(refColor(undefined, null, "head")).toBe(REF_COLOR.unset);
    expect(refColor(ok(3), null, 3)).toBe(REF_COLOR.unset);
    expect(refColor(ok(3), "ada/notification-system", 3)).toBe(REF_COLOR.current);
    expect(refColor(undefined, "ada/notification-system", 3)).toBe(REF_COLOR.pending);
  });

  it("asks for its pick when placed with no reference, and only then", () => {
    expect(wantsRefPicker(catalogue, { id: "a", component: "zeema-design" })).toBe(true);
    expect(wantsRefPicker(catalogue, { id: "a", component: "zeema-design", ref: pinned })).toBe(
      false,
    );
    expect(wantsRefPicker(catalogue, { id: "a", component: "postgres" })).toBe(false);
  });

  it("is named by its design once the summary answers; never before, never for another node", async () => {
    expect(refName(undefined)).toBeNull();
    expect(refName({ status: "pending" })).toBeNull();
    expect(refName({ status: "unreachable" })).toBeNull();
    expect(refName(ok(1))).toBe("Notification System");
    const store = new RefStore(async () => summary(1));
    const box = { id: "a", component: "zeema-design", ref: pinned };
    expect(refNameFor(store, catalogue, box)).toBeNull();
    await store.ensure("ada", "notification-system");
    expect(refNameFor(store, catalogue, box)).toBe("Notification System");
    expect(refNameFor(store, catalogue, { ...box, component: "postgres" })).toBeNull();
    expect(refNameFor(store, catalogue, { id: "a", component: "zeema-design" })).toBeNull();
  });
});

describe("a pasted design link", () => {
  const os = { owner: "o", slug: "s" };
  const v = "0b7c3a52-5d0e-4c1f-9a51-2f3c0e6b8d11";

  it("reads a full URL on any host, page or canvas, with or without a trailing slash", () => {
    expect(parseDesignRef("https://canvas.zeema.dev/d/o/s")).toEqual(os);
    expect(parseDesignRef("http://localhost:3000/d/o/s/canvas")).toEqual(os);
    expect(parseDesignRef("https://example.com/d/o/s/")).toEqual(os);
    expect(parseDesignRef("https://example.com/d/o/s/canvas/")).toEqual(os);
  });

  it("ignores a hash and other query, and takes ?v= as the version id", () => {
    expect(parseDesignRef("https://example.com/d/o/s#nodes")).toEqual(os);
    expect(parseDesignRef("https://example.com/d/o/s?tab=yaml&x=1")).toEqual(os);
    expect(parseDesignRef(`https://example.com/d/o/s?v=${v}#top`)).toEqual({ ...os, versionId: v });
    expect(parseDesignRef(`http://localhost:3100/d/o/s/canvas?x=1&v=${v}`)).toEqual({
      ...os,
      versionId: v,
    });
  });

  it("reads a path and a bare owner/slug, trimmed", () => {
    expect(parseDesignRef("/d/o/s")).toEqual(os);
    expect(parseDesignRef(`/d/o/s/canvas?v=${v}`)).toEqual({ ...os, versionId: v });
    expect(parseDesignRef("o/s")).toEqual(os);
    expect(parseDesignRef("  zeema/url-shortener 	")).toEqual({
      owner: "zeema",
      slug: "url-shortener",
    });
  });

  it("keeps an uppercase owner as written", () => {
    expect(parseDesignRef("MohamedEbrahimMohsen/notification-system")).toEqual({
      owner: "MohamedEbrahimMohsen",
      slug: "notification-system",
    });
    expect(parseDesignRef("https://x.dev/d/Ada/s")).toEqual({ owner: "Ada", slug: "s" });
  });

  it("refuses an invalid slug, random text and any other path", () => {
    expect(parseDesignRef("o/Bad_Slug")).toBeNull();
    expect(parseDesignRef("https://x.dev/d/o/1abc")).toBeNull();
    expect(parseDesignRef("notification system")).toBeNull();
    expect(parseDesignRef("notification")).toBeNull();
    expect(parseDesignRef("")).toBeNull();
    expect(parseDesignRef("https://x.dev/u/o")).toBeNull();
    expect(parseDesignRef("/u/o")).toBeNull();
    expect(parseDesignRef("https://x.dev/d/o/s/yaml")).toBeNull();
    expect(parseDesignRef("o/s/canvas")).toBeNull();
    expect(parseDesignRef("https://x.dev/")).toBeNull();
  });
});

describe("the version a pick pins", () => {
  it("is the link's release when the link names one", () => {
    expect(pinFromSummary(summary(3), "id-2")).toEqual({
      version: 2,
      note: "Pinned to v2, the link's release.",
    });
  });

  it("is the latest when the link pointed at a draft, saying so; head with no release", () => {
    expect(pinFromSummary(summary(3), "draft-id")).toEqual({
      version: 3,
      note: "That link pointed at a draft, pinned to latest (v3).",
    });
    expect(pinFromSummary(summary(null), "draft-id").version).toBe("head");
  });

  it("is the latest, or head when nothing is released, on a first pick", () => {
    expect(pinFromSummary(summary(3))).toEqual({ version: 3, note: null });
    expect(pinFromSummary(summary(null))).toEqual({
      version: "head",
      note: "Not released yet: the reference follows head.",
    });
  });

  it("keeps the version on a change of design when the new design has it, else the latest", () => {
    expect(pinFromSummary(summary(3), undefined, 2)).toEqual({ version: 2, note: "Kept v2." });
    expect(pinFromSummary(summary(3), undefined, "head").version).toBe("head");
    expect(pinFromSummary(summary(1), undefined, 4)).toEqual({
      version: 1,
      note: "No v4 there: pinned to latest (v1).",
    });
    expect(pinFromSummary(summary(null), undefined, 4).version).toBe("head");
  });

  it("lets the link's release win over the kept version", () => {
    expect(pinFromSummary(summary(3), "id-1", 2).version).toBe(1);
  });
});
