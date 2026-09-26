// A design's thumbnail is a real mini-diagram: the engine's own layout, drawn as neutral boxes
// (as on the canvas) and quiet edges. No labels, no icons — at card size the shape is the information.
import { normalize } from "@zeema/core/document";
import { layout } from "@zeema/core/layout";
import { parse } from "@zeema/core/yaml";
import type { Catalogue } from "./catalogue";
import { type HexTint, readFrames, type Tint } from "./layout-sidecar";
import { own } from "./own";

export type Sketch = {
  w: number;
  h: number;
  /** x, y, w, h, and whether the node is custom: a hole in the model, drawn dashed. */
  nodes: Array<[number, number, number, number, boolean]>;
  edges: Array<[number, number, number, number, boolean]>;
  /** x, y, w, h, and the group's tint from the stored sidecar (named or `#rrggbb`), if it has one. */
  frames: Array<[number, number, number, number, (Tint | HexTint)?]>;
};

/** `layout` is the version's stored sidecar; only its group tints are read, through
 *  `readFrames`, so a malformed or hostile value never reaches the drawing. */
export function sketchOf(yaml: string, cat: Catalogue, layoutRaw?: unknown): Sketch | null {
  try {
    const doc = normalize(parse(yaml).doc).doc as any;
    if (!doc?.nodes?.length) return null;
    const l = layout(doc, cat) as any;
    const nodes: Sketch["nodes"] = [];
    for (const n of doc.nodes) {
      const p = l.positions[n.id];
      const s = l.sizes[n.id];
      if (!p || !s) continue;
      const c = own(cat.components, n.component);
      nodes.push([p[0], p[1], s[0], s[1], c?.kind === "custom"]);
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
    const styles = readFrames((layoutRaw as { frames?: unknown } | null)?.frames);
    const frames: Sketch["frames"] = [];
    for (const [gid, f] of Object.entries((l.frames ?? {}) as Record<string, number[]>)) {
      const tint = styles[gid]?.tint;
      frames.push(tint ? [f[0], f[1], f[2], f[3], tint] : [f[0], f[1], f[2], f[3]]);
    }
    return { w: l.canvas[0], h: l.canvas[1], nodes, edges, frames };
  } catch {
    return null;
  }
}
