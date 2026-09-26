// The corner badge choice: brand first, then a clearly dominant provider, else none.
import { describe, expect, it } from "vitest";
import { BRAND, badgeOf, brandOf, chosenBadge } from "./badge";

const cat = {
  components: {
    "az-vm": { provider: "azure" },
    "az-sql": { provider: "azure" },
    "az-kv": { provider: "azure" },
    "aws-s3": { provider: "aws" },
    "aws-sqs": { provider: "aws" },
    "gcp-run": { provider: "gcp" },
    "oci-fn": { provider: "oci" },
    box: { provider: "default" },
    queue: { provider: "default" },
  },
  locale: {
    providers: { azure: {}, aws: {}, gcp: {}, default: {} },
    boundaryIcons: { google: {}, "on-premises": {} },
  },
} as unknown as Parameters<typeof badgeOf>[1];

const doc = (...components: string[]) => ({
  nodes: components.map((component, i) => ({ id: `n${i}`, component })),
});

describe("badgeOf", () => {
  it("names the dominant provider", () => {
    expect(badgeOf(doc("az-vm", "az-sql", "az-kv", "aws-s3", "box", "queue"), cat)).toEqual({
      kind: "provider",
      id: "azure",
    });
  });

  it("ignores generic components when taking the share", () => {
    // 2 of 3 non-default (67%), though only 2 of 8 overall.
    expect(
      badgeOf(doc("az-vm", "az-sql", "aws-s3", "box", "box", "box", "queue", "queue"), cat),
    ).toEqual({ kind: "provider", id: "azure" });
  });

  it("returns null below the share threshold", () => {
    // azure 3 of 8 non-default (37.5%) is the single largest, but under 40%.
    const d = doc("az-vm", "az-sql", "az-kv", "aws-s3", "aws-sqs", "gcp-run", "gcp-run", "oci-fn");
    expect(badgeOf(d, cat)).toBeNull();
  });

  it("returns null with a single provider component", () => {
    expect(badgeOf(doc("az-vm", "box", "queue"), cat)).toBeNull();
  });

  it("returns null on a tie at the top", () => {
    expect(badgeOf(doc("az-vm", "az-sql", "aws-s3", "aws-sqs"), cat)).toBeNull();
  });

  it("returns null for a design drawn only in generic components", () => {
    expect(badgeOf(doc("box", "queue", "box"), cat)).toBeNull();
  });

  it("skips component ids the catalogue does not know", () => {
    expect(badgeOf(doc("az-vm", "az-sql", "nope", "constructor"), cat)).toEqual({
      kind: "provider",
      id: "azure",
    });
  });

  it("gives a brand priority over the dominant provider", () => {
    const d = doc("az-vm", "az-sql", "az-kv");
    expect(badgeOf(d, cat, "youtube")).toEqual({ kind: "brand", id: BRAND.youtube });
    expect(badgeOf(null, cat, "youtube")).toEqual({ kind: "brand", id: "youtube" });
    expect(badgeOf(d, cat, "not-a-brand")).toEqual({ kind: "provider", id: "azure" });
  });

  it("keeps the brand on a clone", () => {
    expect(brandOf("youtube-copy")).toBe("youtube");
    expect(brandOf("youtube-copy-3")).toBe("youtube");
    expect(brandOf("constructor")).toBeNull();
  });
});

describe("the owner's chosen badge", () => {
  const d = doc("az-vm", "az-sql", "az-kv");

  it("wins over the brand and the dominant provider", () => {
    expect(badgeOf(d, cat, "youtube", "provider:gcp")).toEqual({ kind: "provider", id: "gcp" });
    expect(badgeOf(d, cat, null, "boundary:on-premises")).toEqual({
      kind: "boundary",
      id: "on-premises",
    });
    expect(badgeOf(null, cat, null, "boundary:google")).toEqual({ kind: "boundary", id: "google" });
  });

  it("falls back to the automatic choice when it is absent, malformed or unknown", () => {
    const auto = { kind: "provider", id: "azure" };
    for (const chosen of [
      undefined,
      null,
      "",
      "kind:cache",
      "component:aws/s3",
      "provider:nope",
      "provider:default",
      "provider:constructor",
      "boundary:nope",
      "boundary:__proto__",
    ])
      expect(badgeOf(d, cat, null, chosen)).toEqual(auto);
    expect(badgeOf(d, cat, "youtube", "provider:nope")).toEqual({ kind: "brand", id: "youtube" });
  });

  it("reads nothing without a locale", () => {
    expect(chosenBadge("provider:gcp", { components: {} })).toBeNull();
  });
});
