import { describe, expect, it } from "vitest";
import { themeFrom } from "./theme";

describe("themeFrom", () => {
  it("reads dark", () => expect(themeFrom("dark")).toBe("dark"));
  it("falls back to light for light, missing and anything else", () => {
    expect(themeFrom("light")).toBe("light");
    expect(themeFrom(undefined)).toBe("light");
    expect(themeFrom("")).toBe("light");
    expect(themeFrom("DARK")).toBe("light");
    expect(themeFrom('dark" onload="x')).toBe("light");
  });
});
