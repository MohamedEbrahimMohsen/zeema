// A design's thumbnail is a real mini-diagram: the engine's own layout, drawn as taxonomy-tinted
// boxes and quiet edges. No labels, no icons — at card size the shape is the information.
import { normalize } from "@zeema/core/document";
import { layout } from "@zeema/core/layout";
import { parse } from "@zeema/core/yaml";
import type { Catalogue } from "./catalogue";

export type Sketch = {
  w: number;
  h: number;
  nodes: Array<[number, number, number, number, string]>;
  edges: Array<[number, number, number, number, boolean]>;
  frames: Array<[number, number, number, number]>;
};

const HUE: Record<string, string> = {
  compute: "blue",
  edge: "teal",
  data: "amber",
  ops: "violet",
  security: "purple",
  messaging: "green",
  client: "rose",
  external: "red",
  // Untyped, so uncoloured: a custom node is a hole, and it should look like one.
  custom: "grey",
};

export function sketchOf(yaml: string, cat: Catalogue): Sketch | null {
  try {
    const doc = normalize(parse(yaml).doc).doc as any;
    if (!doc?.nodes?.length) return null;
    const l = layout(doc, cat) as any;
    const nodes: Sketch["nodes"] = [];
    for (const n of doc.nodes) {
      const p = l.positions[n.id];
      const s = l.sizes[n.id];
      if (!p || !s) continue;
      const c = cat.components[n.component];
      const hue = c ? (HUE[cat.kinds[c.kind]?.category ?? ""] ?? "grey") : "grey";
      nodes.push([p[0], p[1], s[0], s[1], hue]);
    }
    const edges: Sketch["edges"] = [];
    for (const e of l.edges ?? []) {
      const pts = e.points as Array<[number, number]>;
      if (!pts?.length) continue;
      const a = pts[0];
      const b = pts[pts.length - 1];
      const edge = doc.edges[e.i];
      edges.push([a[0], a[1], b[0], b[1], edge?.mode === "async"]);
    }
    const frames: Sketch["frames"] = Object.values(l.frames ?? {}) as Sketch["frames"];
    return { w: l.canvas[0], h: l.canvas[1], nodes, edges, frames };
  } catch {
    return null;
  }
}
