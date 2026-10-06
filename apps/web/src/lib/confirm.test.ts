import { describe, expect, it } from "vitest";
import { type ConfirmOptions, createConfirmer } from "./confirm";

const opts: ConfirmOptions = { title: "Delete this design?", confirmLabel: "Delete", danger: true };

describe("createConfirmer", () => {
  it("shows the request and resolves true when confirmed", async () => {
    const shown: (ConfirmOptions | null)[] = [];
    const c = createConfirmer((o) => shown.push(o));
    const answer = c.ask(opts);
    expect(shown).toEqual([opts]);
    c.settle(true);
    await expect(answer).resolves.toBe(true);
    expect(shown.at(-1)).toBeNull();
  });

  it("resolves false when cancelled", async () => {
    const c = createConfirmer(() => {});
    const answer = c.ask(opts);
    c.settle(false);
    await expect(answer).resolves.toBe(false);
  });

  it("answers only once; a late settle is ignored", async () => {
    const c = createConfirmer(() => {});
    const answer = c.ask(opts);
    c.settle(false);
    c.settle(true);
    await expect(answer).resolves.toBe(false);
  });

  it("a second question answers the first one no", async () => {
    const shown: (ConfirmOptions | null)[] = [];
    const c = createConfirmer((o) => shown.push(o));
    const first = c.ask(opts);
    const second = c.ask({ ...opts, title: "Make this design public?" });
    await expect(first).resolves.toBe(false);
    expect(shown.at(-1)?.title).toBe("Make this design public?");
    c.settle(true);
    await expect(second).resolves.toBe(true);
  });
});
