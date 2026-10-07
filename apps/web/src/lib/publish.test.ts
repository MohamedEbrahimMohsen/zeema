import { describe, expect, it, vi } from "vitest";
import { createConfirmer } from "./confirm";
import { confirmThenPublish, type PublishContext, publishQuestion } from "./publish";

const ctx: PublishContext = {
  owner: "ada",
  slug: "orders",
  plannedSlug: "orders",
  visibility: "public",
};

describe("confirmThenPublish", () => {
  it("asks first and sends the request only after the user confirms", async () => {
    const shown: unknown[] = [];
    const c = createConfirmer((o) => shown.push(o));
    const send = vi.fn(async () => "sent");
    const result = confirmThenPublish(c.ask, ctx, send);
    await Promise.resolve();
    expect(shown).toEqual([publishQuestion(ctx)]);
    expect(send).not.toHaveBeenCalled();
    c.settle(true);
    await expect(result).resolves.toBe("sent");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("never sends the request when the user cancels", async () => {
    const c = createConfirmer(() => {});
    const send = vi.fn(async () => "sent");
    const result = confirmThenPublish(c.ask, ctx, send);
    c.settle(false);
    await expect(result).resolves.toBeNull();
    expect(send).not.toHaveBeenCalled();
  });
});

describe("publishQuestion", () => {
  it("says who will see the release and what cannot be undone", () => {
    const q = publishQuestion(ctx);
    expect(q).toMatchObject({ title: "Publish a new version?", confirmLabel: "Publish" });
    expect(q.danger).toBeFalsy();
    expect(q.body).toContain("everyone reads");
    expect(q.body).toContain("cannot be unpublished");
    expect(publishQuestion({ ...ctx, visibility: "private" }).body).toContain("nobody else");
  });

  it("names the new address when publishing moves an unnamed draft", () => {
    const q = publishQuestion({ ...ctx, slug: "draft-a1b2c3", plannedSlug: "orders" });
    expect(q.body).toContain("/d/ada/orders");
    expect(publishQuestion(ctx).body).not.toContain("moves to");
  });
});
