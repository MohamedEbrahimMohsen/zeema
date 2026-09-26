// The corner badge choice: brand first, then a clearly dominant provider, else none.
import { describe, expect, it } from "vitest";
import { BRAND, badgeOf, brandOf } from "./badge";

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
