// A node's two lines fitted to its box: the one measure the canvas and the server render both
// draw from. Line 1 is the label, else the component's proper name; line 2 is the proper name
// under a label, else the kind's name. The id is hover text only.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { nodeLines } from "../src/document.js";
import { layout } from "../src/layout.js";
import { nodeText, nodeWidth, textWidth, toMermaid, toSvg } from "../src/render.js";
import { MAX_BOX_W, MIN_BOX_W } from "../src/text.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogue = JSON.parse(fs.readFileSync(path.join(here, "catalogue.json"), "utf8"));
const loc = catalogue.locale;

// The inner width nodeText fits to: the box less 12px a side.
const inner = (w) => w - 24;
const sub = (t) => textWidth(t, 11);
const words = (s) => s.split(/\s+/).filter(Boolean).join(" ");
// Whether anything was cut to fit: a name line or the second line.
const cut = (t, name, second) =>
  t.name.map((l) => l.text).join(" ") !== words(name) || t.comp.text !== second;

// A component with a kind whose name differs from its own, from the catalogue on disk.
const [compId, comp] = Object.entries(catalogue.components).find(
  ([id, c]) => loc.components[id]?.name && loc.kinds[c.kind]?.name !== loc.components[id].name,
);
const compName = loc.components[compId].name;
const kindName = loc.kinds[comp.kind].name;

describe("nodeLines", () => {
  it("puts a label over the component's proper name", () => {
    expect(nodeLines(catalogue, { id: "n", component: compId, label: "Edge filter" })).toEqual({
      name: "Edge filter",
      sub: compName,
      id: compId,
    });
  });

  it("puts the proper name over the kind's name when there is no label", () => {
    expect(nodeLines(catalogue, { id: "n", component: compId })).toEqual({
      name: compName,
      sub: kindName,
      id: compId,
    });
  });
});

describe("nodeText", () => {
  it("keeps a short name on one line, with the second line under it", () => {
    const t = nodeText("Web", "Container service", nodeWidth("Web", "Container service"), "web");
    expect(t.name).toEqual([{ text: "Web", y: 52 }]);
    expect(t.comp).toEqual({ text: "Container service", y: 68 });
    expect(t.icon).toEqual({ y: 11, size: 24 });
    expect(t.title).toBe("Web · Container service · web");
  });

  it("wraps a long name onto two lines that each fit, and moves the block up to make room", () => {
    const t = nodeText("Amazon WorkSpaces Thin Client", "Virtual desktop", 229, "x");
    expect(t.name.map((l) => l.text)).toEqual(["Amazon WorkSpaces", "Thin Client"]);
    for (const l of t.name) expect(textWidth(l.text)).toBeLessThanOrEqual(inner(229));
    expect(t.name.map((l) => l.y)).toEqual([44, 59]);
    expect(t.comp.y).toBe(73);
    expect(t.comp.y).toBeLessThan(78);
    expect(t.icon.y + t.icon.size).toBeLessThan(t.name[0].y - 10);
  });

  it("ellipsizes the name's second line when two are not enough; the title keeps it whole", () => {
    const t = nodeText("OUTSCALE Kubernetes as a Service", "Kubernetes", 126, "outscale-oks");
    expect(t.name).toHaveLength(2);
    expect(t.name[1].text.endsWith("…")).toBe(true);
    for (const l of t.name) expect(textWidth(l.text)).toBeLessThanOrEqual(inner(126));
    expect(t.title).toBe("OUTSCALE Kubernetes as a Service · Kubernetes · outscale-oks");
  });

  it("sets the second line on exactly one line, ellipsized to the box, in the sans face", () => {
    const long = "A second line far too long for any box that a sensible canvas would draw";
    const t = nodeText("Supercalifragilisticexpialidocious", long, 126, "id");
    for (const l of t.name) expect(textWidth(l.text)).toBeLessThanOrEqual(inner(126));
    expect(t.comp.text.endsWith("…")).toBe(true);
    expect(sub(t.comp.text)).toBeLessThanOrEqual(inner(126));
    expect(t.title).toContain(long);
  });

  it("says a repeated line once in the title", () => {
    expect(nodeText("Queue", "Queue", 126, "queue").title).toBe("Queue · queue");
  });
});

describe("toSvg node text", () => {
  it("draws both lines and no id, with all three in the node's <title>", () => {
    const design = {
      id: "t",
      nodes: [
        { id: "a", component: compId, label: "Edge filter" },
        { id: "b", component: compId },
      ],
      edges: [],
      groups: [],
    };
    const svg = toSvg(design, catalogue, { theme: "light" });
    expect(svg).toContain(`<title>Edge filter · ${compName} · ${compId}</title>`);
    expect(svg).toContain(`<title>${compName} · ${kindName} · ${compId}</title>`);
    const drawn = [...svg.matchAll(/<text class="[nc]"[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    expect(drawn).not.toContain(compId);
    expect(drawn).toContain(kindName);
    expect(svg).not.toMatch(/\.c\{[^}]*monospace/);
  });

  it("names a node in Mermaid as its box does, given the catalogue", () => {
    const mm = toMermaid({ nodes: [{ id: "b", component: compId }], edges: [] }, "TD", catalogue);
    expect(mm).toContain(`n_b["${compName}<br/><i>${kindName}</i>"]`);
  });
});

describe("nodeWidth", () => {
  const fits = (name, second) => {
    const w = nodeWidth(name, second);
    return { w, t: nodeText(name, second, w, "id") };
  };

  it("sizes a long proper name onto two whole lines, with no ellipsis", () => {
    const { w, t } = fits("OUTSCALE Kubernetes as a Service", "Kubernetes");
    expect(t.name).toHaveLength(2);
    expect(cut(t, "OUTSCALE Kubernetes as a Service", "Kubernetes")).toBe(false);
    expect(w).toBeLessThanOrEqual(MAX_BOX_W);
  });

  it("keeps a short name on one line in the narrowest box", () => {
    expect(nodeWidth("Web", "Web")).toBe(MIN_BOX_W);
    expect(fits("API Gateway", "API gateway").t.name).toHaveLength(1);
  });

  it("leaves at least 12px either side of the second line", () => {
    const second = "Virtual desktop infrastructure client";
    const w = nodeWidth("Thin", second);
    expect(w - sub(second)).toBeGreaterThanOrEqual(24);
    expect(cut(fits("Thin", second).t, "Thin", second)).toBe(false);
  });

  it("stops at the widest box and cuts an absurd name there", () => {
    const name =
      "An absurdly long component name that no box on any canvas should ever grow to hold";
    const { w, t } = fits(name, "x");
    expect(w).toBe(MAX_BOX_W);
    expect(t.name[1].text.endsWith("…")).toBe(true);
    expect(t.title.startsWith(name)).toBe(true);
  });

  it("fits every catalogue node, with and without a label, that the widest box can hold", () => {
    for (const id of Object.keys(catalogue.components)) {
      for (const node of [
        { id: "n", component: id },
        { id: "n", component: id, label: "Label" },
      ]) {
        const l = nodeLines(catalogue, node);
        const w = nodeWidth(l.name, l.sub);
        const t = nodeText(l.name, l.sub, w, l.id);
        if (w < MAX_BOX_W) expect(cut(t, l.name, l.sub), `${id}: ${l.name}`).toBe(false);
      }
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
    for (const n of design.nodes) {
      const l = nodeLines(catalogue, n);
      expect(lay.sizes[n.id][0]).toBe(nodeWidth(l.name, l.sub));
    }
  });
});
