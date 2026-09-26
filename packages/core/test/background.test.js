// A thumbnail sits on its card, so the page rectangle can be left out; nothing else changes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { toSvg } from "../src/render.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogue = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));

const doc = {
  id: "bg",
  nodes: [
    { id: "web", component: "container-service" },
    { id: "db", component: "container-service" },
  ],
  edges: [{ from: "web", to: "db", protocol: "https", mode: "sync" }],
  groups: [],
};
const PAGE = /<rect (?:x="[^"]*" y="[^"]*" )?width="[^"]*" height="[^"]*" fill="var\(--bg\)"\/>/;

describe("background", () => {
  it("draws the page rectangle by default", () => {
    expect(toSvg(doc, catalogue, { theme: "light" })).toMatch(PAGE);
    expect(toSvg(doc, catalogue, { theme: "light", background: true })).toBe(
      toSvg(doc, catalogue, { theme: "light" }),
    );
  });

  it("leaves only the page rectangle out when background is false", () => {
    const full = toSvg(doc, catalogue, { theme: "dark" });
    const bare = toSvg(doc, catalogue, { theme: "dark", background: false });
    expect(bare).not.toMatch(PAGE);
    expect(bare).toBe(full.replace(new RegExp(`${PAGE.source}\n`), ""));
  });
});

describe("background colour", () => {
  it("sets --bg to a #rrggbb colour after the theme's own, and keeps the page", () => {
    const svg = toSvg(doc, catalogue, { theme: "dark", background: "#1B1B1F" });
    expect(svg).toMatch(PAGE);
    expect(svg).toMatch(/--bg:#17171a[^<]*:root\{--bg:#1b1b1f\}<\/style>/);
  });

  it("ignores anything that is not a colour", () => {
    const plain = toSvg(doc, catalogue, { theme: "dark" });
    for (const background of ["red", "#fff", "#123456;}x{", true])
      expect(toSvg(doc, catalogue, { theme: "dark", background })).toBe(plain);
  });
});
