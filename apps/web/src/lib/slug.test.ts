import { describe, expect, it } from "vitest";
import { isDraftSlug, newDraftSlug, publishSlugFor } from "./slug";

describe("draft names", () => {
  it("knows a minted draft name, with or without its uniqueness counter", () => {
    expect(isDraftSlug(newDraftSlug())).toBe(true);
    expect(isDraftSlug("draft-4b88e2")).toBe(true);
    expect(isDraftSlug("draft-4b88e2-2")).toBe(true);
    expect(isDraftSlug("draft-4b88e2-x")).toBe(false);
    expect(isDraftSlug("draft-4b88e2-")).toBe(false);
    expect(isDraftSlug("reports-lld")).toBe(false);
  });

  it("grows a numbered draft name into its title", () => {
    expect(publishSlugFor({ slug: "draft-4b88e2-2", title: "Reports LLD" })).toBe("reports-lld");
    expect(publishSlugFor({ slug: "draft-4b88e2", title: "Reports LLD" })).toBe("reports-lld");
  });

  it("leaves a name the owner chose alone", () => {
    expect(publishSlugFor({ slug: "orders-v2", title: "Reports LLD" })).toBe("orders-v2");
  });
});
