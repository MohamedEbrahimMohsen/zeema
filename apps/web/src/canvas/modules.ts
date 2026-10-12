// Modules inside a node, as the canvas draws them (docs/format.md, "Modules inside a node").
// A node with modules is collapsed by default: its usual box and an "N modules" chip. The reader
// may expand it, which is a look, not an edit: which nodes are expanded lives in this browser,
// per design, and never reaches the YAML or the sidecar. Expanded, the node's box grows to
// `moduleTiles` (@zeema/core/geometry) and each module is a tile inside it; an edge end naming a
// module is drawn to its tile, and an in-process edge (two ends in one node) is a light line
// between tiles. Pure: no DOM; storage is passed in.
import { endNode, isInProcess, nodeModules, splitEnd } from "@zeema/core/document";
import { moduleTiles } from "@zeema/core/geometry";

export type Box = [number, number, number, number];
type Store = Pick<Storage, "getItem" | "setItem">;

/** Where one design's expanded nodes are remembered in this browser. */
export const expandedKey = (design: string) => `zeema.canvas.expanded:${design}`;

const local = (): Store | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

/** The node ids stored as expanded for a design; empty when nothing (readable) is stored. */
export function readExpanded(design: string, store = local()): Set<string> {
  try {
    const v = JSON.parse(store?.getItem(expandedKey(design)) ?? "[]");
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function writeExpanded(design: string, ids: Iterable<string>, store = local()) {
  try {
    store?.setItem(expandedKey(design), JSON.stringify([...ids].sort()));
  } catch {
    /* a browser that will not remember still draws */
  }
}

/**
 * The least width of an expanded box: its header sets the icon beside the name and component
 * line, which a one-module box of a short name would otherwise squeeze.
 */
export const EXPANDED_MIN_W = 180;

/**
 * Each node's box as the canvas draws it: `boxes` (its laid-out box) for every node, except an
 * expanded node with modules, whose box keeps its top-left corner and takes the size
 * `moduleTiles` gives it (at least EXPANDED_MIN_W wide). A node listed as expanded that has no modules is drawn as it was.
 */
export function expandBoxes(
  nodes: any[],
  boxes: Record<string, Box>,
  expanded: ReadonlySet<string>,
): Record<string, Box> {
  const out: Record<string, Box> = { ...boxes };
  for (const n of nodes ?? []) {
    const b = boxes[n?.id];
    if (!b || !expanded.has(n.id)) continue;
    const t = moduleTiles(n, Math.max(b[2], EXPANDED_MIN_W));
    if (t) out[n.id] = [b[0], b[1], t.w, t.h];
  }
  return out;
}

/**
 * The world box of every module tile of every expanded node, keyed by the end that names it
 * (`node/module`): what `edgeGeometry` takes as `moduleBoxes`. `boxes` are the drawn boxes
 * (`expandBoxes`): laid out again for the expanded width, the tiles land where they did.
 */
export function tileBoxes(
  nodes: any[],
  boxes: Record<string, Box>,
  expanded: ReadonlySet<string>,
): Record<string, Box> {
  const out: Record<string, Box> = {};
  for (const n of nodes ?? []) {
    const b = boxes[n?.id];
    if (!b || !expanded.has(n.id)) continue;
    const t = moduleTiles(n, b[2]);
    if (!t) continue;
    for (const tile of t.tiles)
      out[`${n.id}/${tile.id}`] = [b[0] + tile.x, b[1] + tile.y, tile.w, tile.h];
  }
  return out;
}

// Where the segment from a box's centre toward (tx, ty) leaves the box.
function clipTo(b: Box, tx: number, ty: number): [number, number] {
  const cx = b[0] + b[2] / 2;
  const cy = b[1] + b[3] / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (!dx && !dy) return [cx, cy];
  const sx = dx ? b[2] / 2 / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const sy = dy ? b[3] / 2 / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const s = Math.min(sx, sy, 1);
  return [cx + dx * s, cy + dy * s];
}

/**
 * The in-process edges drawn inside expanded nodes: each as `[start, end]`, a straight line from
 * one end's box to the other's, clipped to both. A module end is its tile; an end naming the node
 * itself is the node's header (the strip above the tiles, `header` px tall). Edges whose node is
 * collapsed are not drawn, so they are not here.
 */
export function inProcessLines(
  doc: any,
  boxes: Record<string, Box>,
  tiles: Record<string, Box>,
  header: number,
): Array<{ i: number; points: [[number, number], [number, number]] }> {
  const out: Array<{ i: number; points: [[number, number], [number, number]] }> = [];
  (doc?.edges ?? []).forEach((e: any, i: number) => {
    if (!isInProcess(e)) return;
    const node = boxes[endNode(e.from)];
    if (!node) return;
    const boxFor = (ref: string): Box | null =>
      splitEnd(ref).module === null
        ? [node[0], node[1], node[2], header]
        : Object.hasOwn(tiles, ref)
          ? tiles[ref]
          : null;
    const a = boxFor(e.from);
    const b = boxFor(e.to);
    if (!a || !b) return;
    const ca: [number, number] = [a[0] + a[2] / 2, a[1] + a[3] / 2];
    const cb: [number, number] = [b[0] + b[2] / 2, b[1] + b[3] / 2];
    out.push({ i, points: [clipTo(a, cb[0], cb[1]), clipTo(b, ca[0], ca[1])] });
  });
  return out;
}

/** The module tile under a world point, as its end (`node/module`), or null. */
export function tileAt(tiles: Record<string, Box>, wx: number, wy: number): string | null {
  for (const [ref, b] of Object.entries(tiles))
    if (wx >= b[0] && wx <= b[0] + b[2] && wy >= b[1] && wy <= b[1] + b[3]) return ref;
  return null;
}

/** Whether a node has anything to expand. */
export const hasModules = (node: any) => nodeModules(node).length > 0;

/**
 * The module ends a finding's subject names (`from`/`to` as written on a module edge), so the
 * tiles they name can be marked while their node is expanded.
 */
export function findingTiles(findings: Array<{ subject?: any }>): Set<string> {
  const out = new Set<string>();
  for (const f of findings ?? []) {
    const s = f?.subject;
    if (s?.type !== "edge") continue;
    for (const end of [s.from, s.to])
      if (typeof end === "string" && splitEnd(end).module !== null) out.add(end);
  }
  return out;
}
