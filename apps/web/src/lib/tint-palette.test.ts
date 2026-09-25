// The boundary colour palette is data the popover renders as buttons, and the recent list is
// kept in localStorage, which can be missing, full of junk or throwing.
import { describe, expect, it } from "vitest";
import {
  PALETTE,
  PALETTE_COLUMNS,
  PALETTE_HUES,
  PALETTE_ROWS,
  pushRecent,
  RECENT_KEY,
  RECENT_MAX,
  readRecent,
} from "./tint-palette";

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

const throwing = {
  getItem: () => {
    throw new Error("denied");
  },
  setItem: () => {
    throw new Error("denied");
  },
};

describe("palette", () => {
  it("is lowercase #rrggbb, unique, a full grid of hues by shades plus a grey row", () => {
    for (const c of PALETTE) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(PALETTE).size).toBe(PALETTE.length);
    expect(PALETTE_COLUMNS).toBe(PALETTE_HUES.length);
    for (const row of PALETTE_ROWS) expect(row).toHaveLength(PALETTE_COLUMNS);
    expect(PALETTE.length).toBe(PALETTE_ROWS.length * PALETTE_COLUMNS);
    expect(PALETTE_ROWS.length).toBeGreaterThan(1);
  });
});

describe("recent colours", () => {
  it("puts the newest first, de-dupes and caps", () => {
    const s = memory();
    pushRecent("#111111", s);
    pushRecent("#222222", s);
    expect(pushRecent("#111111", s)).toEqual(["#111111", "#222222"]);
    for (let i = 0; i < RECENT_MAX + 3; i++) pushRecent(`#00000${i.toString(16)}`, s);
    const list = readRecent(s);
    expect(list).toHaveLength(RECENT_MAX);
    expect(list[0]).toBe(`#00000${(RECENT_MAX + 2).toString(16)}`);
    expect(new Set(list).size).toBe(list.length);
  });

  it("lowercases what it stores", () => {
    const s = memory();
    expect(pushRecent("#ABCDEF", s)).toEqual(["#abcdef"]);
    expect(pushRecent("#abcdef", s)).toEqual(["#abcdef"]);
  });

  it("ignores junk in storage", () => {
    const s = memory();
    s.setItem(RECENT_KEY, "not json");
    expect(readRecent(s)).toEqual([]);
    s.setItem(RECENT_KEY, JSON.stringify(["#123456", "red", 7, "#12345", "#123456"]));
    expect(readRecent(s)).toEqual(["#123456"]);
  });

  it("survives a storage that throws, and no storage at all", () => {
    expect(readRecent(throwing)).toEqual([]);
    expect(pushRecent("#123456", throwing)).toEqual(["#123456"]);
    expect(readRecent(null)).toEqual([]);
    expect(pushRecent("#123456", null)).toEqual(["#123456"]);
  });
});
