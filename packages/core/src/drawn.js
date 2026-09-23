// The picture as it was drawn, rather than as the engine would arrange it.
//
// The canvas stores what a person moved in the layout sidecar: a position per node and a bow per
// edge. `drawnLayout` turns that sidecar into the same shape `layout()` returns, so the renderer
// draws from one or the other without knowing which. The rules it follows are the canvas's own
// (apps/web/src/canvas/scene.ts):
//
//   * box sizes always come from the engine — a size is derived from the text, never stored;
//   * positions come from the sidecar;
//   * group frames are computed from the members with `groupFrames`, never stored;
//   * edges are recomputed with `edgeGeometry`, taking the sidecar's bows.
//
// A node the sidecar has never seen — added to the YAML after the last canvas save — is placed
// here rather than left at the origin: beside a neighbour it is connected to when there is room,
// otherwise on a fresh row below everything. It never lands on top of a node somebody placed.
//
// No DOM, no fs, no network.

import { edgeGeometry, groupFrames } from "./geometry.js";
import { layout } from "./layout.js";

// The gaps the automatic layout leaves between boxes; a newcomer keeps the same spacing.
const GAP_X = 34;
const GAP_Y = 86;
// Clearance required between a newcomer and anything already on the canvas.
const MARGIN = 16;
// Breathing room around the drawing, matching what the automatic canvas leaves.
const PAD_X = 60;
const PAD_Y = 46;

const overlaps = (a, b) =>
  a[0] + a[2] + MARGIN > b[0] &&
  b[0] + b[2] + MARGIN > a[0] &&
  a[1] + a[3] + MARGIN > b[1] &&
  b[1] + b[3] + MARGIN > a[1];

const clear = (box, boxes) => !boxes.some((b) => overlaps(box, b));

/** The positions a sidecar holds, keeping only the pairs of finite numbers. */
function readPositions(sidecar) {
  const out = {};
  const raw = sidecar && typeof sidecar === "object" ? sidecar.nodes : null;
  if (!raw || typeof raw !== "object") return out;
  for (const [id, p] of Object.entries(raw))
    if (
      Array.isArray(p) &&
      typeof p[0] === "number" &&
      Number.isFinite(p[0]) &&
      typeof p[1] === "number" &&
      Number.isFinite(p[1])
    )
      out[id] = [p[0], p[1]];
  return out;
}

/** Where a node nobody has placed should go. Beside a neighbour, or on a row of its own below. */
function placeNewcomer(id, size, doc, boxes) {
  const taken = Object.values(boxes);
  const [w, h] = size;
  const neighbours = [];
  for (const e of doc.edges || []) {
    if (e.from === id && boxes[e.to]) neighbours.push(boxes[e.to]);
    else if (e.to === id && boxes[e.from]) neighbours.push(boxes[e.from]);
  }
  for (const nb of neighbours) {
    const candidates = [
      [nb[0] + nb[2] + GAP_X, nb[1]],
      [nb[0], nb[1] + nb[3] + GAP_Y],
      [nb[0] - w - GAP_X, nb[1]],
      [nb[0], nb[1] - h - GAP_Y],
      [nb[0] + nb[2] + GAP_X, nb[1] + nb[3] + GAP_Y],
      [nb[0] - w - GAP_X, nb[1] + nb[3] + GAP_Y],
      [nb[0] + nb[2] + GAP_X, nb[1] - h - GAP_Y],
      [nb[0] - w - GAP_X, nb[1] - h - GAP_Y],
    ];
    for (const [x, y] of candidates) if (clear([x, y, w, h], taken)) return [x, y];
  }
  if (!taken.length) return [0, 0];
  const x0 = Math.min(...taken.map((b) => b[0]));
  const y1 = Math.max(...taken.map((b) => b[1] + b[3]));
  let x = x0;
  const y = y1 + GAP_Y;
  // A row of newcomers fills to the right rather than stacking on the same spot.
  for (let guard = 0; guard < 500 && !clear([x, y, w, h], taken); guard++) x += w + GAP_X;
  return [x, y];
}

/**
 * Lay a design out from a saved sidecar. Same return shape as `layout()`, plus `origin`: the
 * drawing keeps the coordinates it was drawn in, which may be negative, and the renderer offsets
 * its viewBox by the origin instead of moving the boxes.
 *
 * @param {object} doc        a Zeema design document
 * @param {object} catalogue  passed through to `layout()` for the box sizes
 * @param {object} sidecar    { nodes: { id: [x, y] }, edges: { key: bow },
 *                            frames: { groupId: { tint, icon } } }; notes are not drawn
 * @returns {{positions: Object, sizes: Object, frames: Object, edges: Array,
 *            canvas: [number, number], origin: [number, number], frameStyles: Object}}
 *            `frameStyles` is the sidecar's boundary styles as stored; the renderer vets them.
 */
export function drawnLayout(doc, catalogue, sidecar) {
  const auto = layout(doc, catalogue);
  const nodes = doc && Array.isArray(doc.nodes) ? doc.nodes : [];
  const saved = readPositions(sidecar);
  const sizes = auto.sizes;
  const boxes = {};
  // Everything the sidecar knows first, so a newcomer is placed around a settled picture.
  for (const n of nodes) {
    const p = saved[n.id];
    const s = sizes[n.id] || [126, 78];
    if (p) boxes[n.id] = [p[0], p[1], s[0], s[1]];
  }
  for (const n of nodes) {
    if (boxes[n.id]) continue;
    const s = sizes[n.id] || [126, 78];
    const [x, y] = placeNewcomer(n.id, s, doc, boxes);
    boxes[n.id] = [x, y, s[0], s[1]];
  }
  const frames = groupFrames({ nodes, groups: doc.groups || [], edges: doc.edges || [] }, boxes);
  const bows = sidecar && typeof sidecar === "object" && sidecar.edges ? sidecar.edges : {};
  const edges = edgeGeometry(doc, boxes, bows);
  // Boundary tint and icon ride along untouched: they change how a frame looks, never where.
  const styles = sidecar && typeof sidecar === "object" ? sidecar.frames : null;
  const frameStyles = styles && typeof styles === "object" && !Array.isArray(styles) ? styles : {};

  const xs = [];
  const ys = [];
  for (const b of Object.values(boxes)) {
    xs.push(b[0], b[0] + b[2]);
    ys.push(b[1], b[1] + b[3]);
  }
  for (const f of Object.values(frames)) {
    xs.push(f[0], f[0] + f[2]);
    ys.push(f[1], f[1] + f[3]);
  }
  for (const e of edges)
    for (const [px, py] of e.points) {
      xs.push(px);
      ys.push(py);
    }
  const x0 = xs.length ? Math.floor(Math.min(...xs)) - PAD_X : 0;
  const y0 = ys.length ? Math.floor(Math.min(...ys)) - PAD_Y : 0;
  const x1 = xs.length ? Math.ceil(Math.max(...xs)) + PAD_X : 320;
  const y1 = ys.length ? Math.ceil(Math.max(...ys)) + PAD_Y : 200;

  const positions = {};
  for (const [id, b] of Object.entries(boxes)) positions[id] = [b[0], b[1]];
  return {
    positions,
    sizes,
    frames,
    edges,
    canvas: [x1 - x0, y1 - y0],
    origin: [x0, y0],
    frameStyles,
  };
}

export default drawnLayout;
