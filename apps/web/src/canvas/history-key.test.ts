import { describe, expect, it } from "vitest";
import { historyKey, letterOf } from "./history-key";

const press = (key: string, mods: Partial<Record<string, boolean>> = {}, code?: string) => ({
  key,
  code,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...mods,
});

describe("historyKey", () => {
  it("undoes on Ctrl/Cmd+Z and redoes on Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y", () => {
    expect(historyKey(press("z", { ctrlKey: true }))).toBe("undo");
    expect(historyKey(press("z", { metaKey: true }))).toBe("undo");
    expect(historyKey(press("Z", { ctrlKey: true, shiftKey: true }))).toBe("redo");
    expect(historyKey(press("y", { ctrlKey: true }))).toBe("redo");
    expect(historyKey(press("Y", { ctrlKey: true, shiftKey: true }))).toBe("redo");
  });
  it("is nothing without Ctrl/Cmd, or on another letter", () => {
    expect(historyKey(press("z"))).toBeNull();
    expect(historyKey(press("x", { ctrlKey: true }))).toBeNull();
  });
  it("undoes when Shift is still down from a Shift drag", () => {
    expect(historyKey(press("Z", { ctrlKey: true, shiftKey: true }), true)).toBe("undo");
    expect(historyKey(press("y", { ctrlKey: true }), true)).toBe("redo");
  });
  it("reads the physical key on a non-Latin layout", () => {
    expect(letterOf({ key: "ئ", code: "KeyZ" })).toBe("z");
    expect(letterOf({ key: "z", code: "KeyY" })).toBe("z"); // a QWERTZ z stays a z
    expect(historyKey(press("ئ", { ctrlKey: true }, "KeyZ"))).toBe("undo");
    expect(historyKey(press("غ", { ctrlKey: true }, "KeyY"))).toBe("redo");
  });
});
