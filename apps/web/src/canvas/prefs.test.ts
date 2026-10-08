import { describe, expect, it } from "vitest";
import {
  DIM_EDGES_OVER,
  DIM_KEY,
  dimmed,
  HOVER_CARDS_KEY,
  readDim,
  readFlag,
  readHoverCards,
  writeDim,
  writeHoverCards,
} from "./prefs";

const memory = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    raw: m,
  };
};
const broken = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("hover cards preference", () => {
  it("is on when nothing is stored", () => {
    expect(readHoverCards(memory())).toBe(true);
  });
  it("reads back what was written", () => {
    const s = memory();
    writeHoverCards(false, s);
    expect(s.raw.get(HOVER_CARDS_KEY)).toBe("off");
    expect(readHoverCards(s)).toBe(false);
    writeHoverCards(true, s);
    expect(readHoverCards(s)).toBe(true);
  });
  it("falls back to on for junk, a refusing storage or none", () => {
    expect(readHoverCards(memory({ [HOVER_CARDS_KEY]: "maybe" }))).toBe(true);
    expect(readHoverCards(broken)).toBe(true);
    expect(readHoverCards(null)).toBe(true);
    expect(() => writeHoverCards(false, broken)).not.toThrow();
  });
  it("honours the fallback it is given", () => {
    expect(readFlag("x", false, memory())).toBe(false);
  });
});

describe("dim edges preference", () => {
  it("is auto when nothing is stored, and follows the edge count", () => {
    const mode = readDim(memory());
    expect(mode).toBe("auto");
    expect(dimmed(mode, DIM_EDGES_OVER)).toBe(false);
    expect(dimmed(mode, DIM_EDGES_OVER + 1)).toBe(true);
  });
  it("stores only explicit values, which then override the count", () => {
    const s = memory();
    writeDim(false, s);
    expect(s.raw.get(DIM_KEY)).toBe("off");
    expect(readDim(s)).toBe("off");
    expect(dimmed(readDim(s), DIM_EDGES_OVER + 100)).toBe(false);
    writeDim(true, s);
    expect(readDim(s)).toBe("on");
    expect(dimmed(readDim(s), 0)).toBe(true);
  });
  it("treats an old stored 'auto', junk or a refusing storage as auto", () => {
    expect(readDim(memory({ [DIM_KEY]: "auto" }))).toBe("auto");
    expect(readDim(memory({ [DIM_KEY]: "loud" }))).toBe("auto");
    expect(readDim(broken)).toBe("auto");
  });
});
