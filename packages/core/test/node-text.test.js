// A node's name and component id fitted to its box: the one measure the canvas and the server
// render both draw from.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { displayName } from "../src/document.js";
import { layout } from "../src/layout.js";
import { monoWidth, nodeText, nodeWidth, textWidth, toSvg } from "../src/render.js";
import { MAX_BOX_W, MIN_BOX_W } from "../src/text.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogue = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));

// The inner width nodeText fits to: the box less 12px a side.
const inner = (w) => w - 24;

describe("nodeText", () => {
  it("keeps a short name on one line, where it always was", () => {
    const t = nodeText("Web", "container-service", nodeWidth("Web", "container-service"));
    expect(t.name).toEqual([{ text: "Web", y: 52 }]);
    expect(t.comp).toEqual({ text: "container-service", y: 68 });
    expect(t.icon).toEqual({ y: 11, size: 24 });
    expect(t.full).toBeNull();
  });

  it("wraps a long name onto two lines that each fit, and moves the block up to make room", () => {
    const t = nodeText("Amazon WorkSpaces Thin Client", "aws-workspaces-thin-client", 229);
    expect(t.name.map((l) => l.text)).toEqual(["Amazon WorkSpaces", "Thin Client"]);
    for (const l of t.name) expect(textWidth(l.text)).toBeLessThanOrEqual(inner(229));
    expect(t.name.map((l) => l.y)).toEqual([44, 59]);
    expect(t.comp.y).toBe(73);
    expect(t.comp.y).toBeLessThan(78);
    expect(t.icon.y + t.icon.size).toBeLessThan(t.name[0].y - 10);
    expect(t.full).toBeNull();
  });

  it("ellipsizes the second line when two are not enough, and keeps the whole text", () => {
    const t = nodeText("OUTSCALE Kubernetes as a Service", "outscale-oks", 126);
    expect(t.name).toHaveLength(2);
    expect(t.name[1].text.endsWith("…")).toBe(true);
    for (const l of t.name) expect(textWidth(l.text)).toBeLessThanOrEqual(inner(126));
    expect(t.full).toBe("OUTSCALE Kubernetes as a Service\noutscale-oks");
  });

  it("breaks a single word longer than a line, and ellipsizes the id on one line", () => {
    const t = nodeText(
      "Supercalifragilisticexpialidocious",
      "a-very-long-component-identifier-indeed",
      126,
    );
    for (const l of t.name) expect(textWidth(l.text)).toBeLessThanOrEqual(inner(126));
    expect(t.comp.text.endsWith("…")).toBe(true);
    expect(monoWidth(t.comp.text, 11)).toBeLessThanOrEqual(inner(126));
    expect(t.full).not.toBeNull();
  });
});

describe("toSvg node text", () => {
  it("draws the proper name, fitted, with the whole of a cut name in a <title>", () => {
    // The box is sized from the id, the name shown is the component's proper name: the longest
    // one in the catalogue cannot fit a box sized for a one-letter id.
    const [id, name] = Object.entries(catalogue.locale.components)
      .map(([k, v]) => [k, v.name])
      .sort((a, b) => b[1].length - a[1].length)[0];
    const design = { id: "long", nodes: [{ id: "n", component: id }], edges: [], groups: [] };
    const svg = toSvg(design, catalogue, { theme: "light" });
    expect(svg).toContain(`<title>${name}\n${id}</title>`);
    expect(svg.match(/<text class="n"/g)).toHaveLength(2);
  });
});

describe("nodeWidth", () => {
  const fits = (name, component) => {
    const w = nodeWidth(name, component);
    const t = nodeText(name, component, w);
    return { w, t };
  };

  it("sizes a long proper name onto two whole lines, with no ellipsis", () => {
    const { w, t } = fits("OUTSCALE Kubernetes as a Service", "outscale-oks");
    expect(t.name).toHaveLength(2);
    expect(t.full).toBeNull();
    expect(t.name.map((l) => l.text).join(" ")).toBe("OUTSCALE Kubernetes as a Service");
    expect(w).toBeLessThanOrEqual(MAX_BOX_W);
  });

  it("keeps a short name on one line in the narrowest box", () => {
    expect(nodeWidth("Web", "web")).toBe(MIN_BOX_W);
    expect(fits("API Gateway", "api-gateway").t.name).toHaveLength(1);
  });

  it("leaves at least 12px either side of the id line", () => {
    const id = "aws-workspaces-thin-client";
    const w = nodeWidth("Amazon WorkSpaces Thin Client", id);
    expect(w - monoWidth(id, 11)).toBeGreaterThanOrEqual(24);
    expect(fits("Amazon WorkSpaces Thin Client", id).t.full).toBeNull();
  });

  it("stops at the widest box and cuts an absurd name there", () => {
    const name =
      "An absurdly long component name that no box on any canvas should ever grow to hold";
    const { w, t } = fits(name, "x");
    expect(w).toBe(MAX_BOX_W);
    expect(t.name[1].text.endsWith("…")).toBe(true);
    expect(t.full).not.toBeNull();
  });

  it("fits every proper name in the catalogue that two lines at the widest box can hold", () => {
    for (const [id, loc] of Object.entries(catalogue.locale.components)) {
      const w = nodeWidth(loc.name, id);
      const t = nodeText(loc.name, id, w);
      if (w < MAX_BOX_W) expect(t.full, `${id}: ${loc.name}`).toBeNull();
    }
  });

  it("is what the layout sizes every box with", () => {
    const ids = Object.keys(catalogue.locale.components).slice(0, 12);
    const design = {
      id: "sizes",
      nodes: ids.map((c, i) => ({
        id: `n${i}`,
        component: c,
        ...(i % 3 ? {} : { label: `Label ${c}` }),
      })),
      edges: [],
      groups: [],
    };
    const lay = layout(design, catalogue);
    for (const n of design.nodes)
      expect(lay.sizes[n.id][0]).toBe(nodeWidth(displayName(catalogue, n), n.component));
  });
});
