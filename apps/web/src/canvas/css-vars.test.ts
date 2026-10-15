import { describe, expect, it } from "vitest";
import { resolveCssVars, xmlSafeCssValue } from "./css-vars";

const MONO = '"JetBrains Mono", ui-monospace, "Cascadia Code", monospace';
const tokens: Record<string, string> = { "--mono": MONO, "--muted": "#6b7280" };
const lookup = (name: string) => tokens[name] ?? "";

// Every attribute in a tag reads name="value" with no stray quote after it.
const brokenAttribute = /="[^"]*"[^\s/>]/;

describe("resolving custom properties for an exported SVG", () => {
  it("turns double quotes in a value into single ones", () => {
    expect(xmlSafeCssValue(MONO)).toBe(
      "'JetBrains Mono', ui-monospace, 'Cascadia Code', monospace",
    );
  });

  it("escapes markup characters", () => {
    expect(xmlSafeCssValue("a<b>&c")).toBe("a&lt;b&gt;&amp;c");
  });

  it("keeps a style attribute well formed when the font stack is quoted", () => {
    const svg = resolveCssVars(
      '<text style="font-family:var(--mono);font-size:11px;fill:var(--muted)">×3</text>',
      lookup,
    );
    expect(svg).toBe(
      "<text style=\"font-family:'JetBrains Mono', ui-monospace, 'Cascadia Code', monospace;font-size:11px;fill:#6b7280\">×3</text>",
    );
    expect(svg).not.toMatch(brokenAttribute);
  });

  it("leaves an unknown property alone", () => {
    expect(resolveCssVars("fill:var(--nope)", lookup)).toBe("fill:var(--nope)");
  });
});
