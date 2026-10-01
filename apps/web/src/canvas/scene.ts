// The canvas scene: one SVG with two render paths. Structural rebuilds when the document changes
// shape; the transform path runs during a drag and creates no DOM at all. This class is
// deliberately imperative and framework-free: React mounts the SVG skeleton once and hands it
// here, and nothing React owns changes during a pointer move.
//
// Pointer conventions follow draw.io and Excalidraw: left drag on empty space sweeps a selection
// box, the middle button pans, space turns the left button into the hand, shift adds to the
// selection, double click edits a label in place, the right button opens a menu about whatever is
// under it. The wheel scrolls (shift scrolls sideways); ctrl, meta, alt or a pinch zooms around the
// pointer.

import { displayName } from "@zeema/core/document";
import {
  bowAt,
  edgeGeometry,
  framesOuterFirst,
  framesUnderTint,
  groupFrames,
  innermostFrameAt,
  pathOf,
  portAt,
} from "@zeema/core/geometry";
import {
  FRAME_ICON_SHIFT,
  nodeText,
  TINT,
  TINT_FILL_ALPHA,
  tintFill,
  tintPaint,
} from "@zeema/core/render";
import {
  anchorKey,
  anchorTarget,
  type EdgePorts,
  type FrameStyle,
  frameIconKey,
  NOTE_ANCHOR_DX,
  NOTE_ANCHOR_DY,
  NOTE_MAX_TEXT,
  NOTE_MIN_H,
  NOTE_MIN_W,
  type NodeTint,
  type Note,
  type NoteAnchor,
  normaliseTint,
  type Port,
  type PortSide,
} from "@/lib/layout-sidecar";
import { own } from "@/lib/own";
import { frameTargetAt } from "./frame-target";
import { anchorOffset, coversTarget, noteDropTarget, sameAnchor } from "./note-anchor";

const NS = "http://www.w3.org/2000/svg";
const el = (name: string, attrs: Record<string, unknown> = {}) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs))
    if (v !== null && v !== undefined) n.setAttribute(k, String(v));
  return n;
};
// A group icon is 16px, top-aligned with the label, which it pushes FRAME_ICON_SHIFT right.
// The same numbers as the exported SVG (@zeema/core/render), so the two cannot disagree.
const FRAME_ICON = 16;
// The markers this scene installs in the <defs>: the edge head, and the accent one a selected edge uses.
const ARROWHEADS = ["arrowhead", "arrowhead-sel"];
const FRAME_ICON_DY = 7;
// The canvas-only drop shadow under node cards and notes (a <filter> in the <defs>).
const NODE_SHADOW = "node-shadow";
// A port dot sits this far outside the border, at the middle of its side.
const PORT_DOT_GAP = 6;
const PORT_SIDES: PortSide[] = ["top", "right", "bottom", "left"];

/** Where a side's port dot sits for a box, in that box's coordinates. */
function portDotAt(b: Box, side: PortSide): [number, number] {
  const [x, y, w, h] = b;
  if (side === "top") return [x + w / 2, y - PORT_DOT_GAP];
  if (side === "bottom") return [x + w / 2, y + h + PORT_DOT_GAP];
  if (side === "left") return [x - PORT_DOT_GAP, y + h / 2];
  return [x + w + PORT_DOT_GAP, y + h / 2];
}

/** The side of a box whose middle is nearest a point: the side that faces it. */
export function facingSide(b: Box, [px, py]: [number, number]): PortSide {
  let best: PortSide = "top";
  let bestD = Number.POSITIVE_INFINITY;
  for (const side of PORT_SIDES) {
    const [mx, my] = portDotAt(b, side);
    const d = Math.hypot(px - mx, py - my);
    if (d < bestD) [best, bestD] = [side, d];
  }
  return best;
}

export type Box = [number, number, number, number];
export type Subject = {
  type: "node" | "edge" | "group" | "note" | null;
  ref: string | number | null;
};
export type Model = {
  doc: any;
  catalogue: any;
  icons: Record<string, string>;
  positions: Record<string, [number, number]>;
  sizes: Record<string, [number, number]>;
  bows: Record<string, number>;
  /** Where an edge's ends meet their boxes, by edge key, from the sidecar. */
  ports?: Record<string, EdgePorts>;
  notes: Note[];
  /** Group tint and icon by group id, from the sidecar. Absent means the default frame. */
  frameStyles?: Record<string, FrameStyle>;
  /** Component tints by node id, from the sidecar. Absent means the neutral card. */
  nodeTints?: Record<string, NodeTint>;
  /** The Notes toggle. Hidden means not drawn, not hit-testable and not exported. */
  showNotes: boolean;
  /**
   * Anchor keys (`node:id`, `group:id`) whose notes are held open although the toggle is off.
   * A pin is a look at one thing, not a change of mind about all of them, so it never touches
   * the toggle, never reaches the sidecar and never survives a reload.
   */
  pinnedNotes: string[];
  findings: Array<{ subject?: Subject; blocking?: boolean; severity?: string }>;
};
export type EdgeEnd = "from" | "to";
// How close to its own box's border, in screen pixels, an end handle has to be let go to be read
// as "attach here" rather than "somewhere else".
const PORT_REACH = 12;

export type Handlers = {
  onSelect?: (selection: Subject, multi: Set<string>) => void;
  onMove?: (moves: Array<{ id: string; x: number; y: number; group: string | null }>) => void;
  /**
   * A wire was let go on another component, or on a group's frame (`to` is then the group id: an
   * edge to the group as a unit). `ends` is set when it was drawn from a port dot.
   */
  onConnect?: (from: string, to: string, ends?: EdgePorts) => void;
  onBowPreview?: (key: string, value: number) => void;
  onBow?: (key: string, value: number) => void;
  /** An end handle is being dragged along its own box: draw the edge with this port (null: none). */
  onPortPreview?: (key: string, end: EdgeEnd, port: Port | null) => void;
  /** An end handle was let go on its own box's border: attach that end there. */
  onPort?: (key: string, end: EdgeEnd, port: Port) => void;
  /** An end handle was let go on another component or a group's frame: move that end there. */
  onReconnect?: (index: number, end: EdgeEnd, nodeId: string) => void;
  labelOf?: (kind: string, ref: string | number) => string | null;
  onLabel?: (kind: string, ref: string | number, value: string) => void;
  onContext?: (target: Subject, x: number, y: number) => void;
  onDrop?: (componentId: string, x: number, y: number) => void;
  onNoteGeometry?: (id: string, box: { x: number; y: number; w: number; h: number }) => void;
  /** A note was dropped onto a component or a group: pin it there, at this offset. */
  onNoteAnchor?: (
    id: string,
    anchor: NoteAnchor,
    box: { x: number; y: number; w: number; h: number },
  ) => void;
  onNotePin?: (key: string) => void;
  /**
   * A wire drawn from a port dot was let go on empty canvas, away from its dot: the page may
   * offer to add a component there and wire it. `start` is the dot, `at` the release point
   * (both world), `client` the release point on screen.
   */
  onWireOut?: (
    from: string,
    side: PortSide,
    start: [number, number],
    at: [number, number],
    client: [number, number],
  ) => void;
  /** A drag that began on a group ended on a component: someone tried to wire the frame. */
  onFrameWire?: (clientX: number, clientY: number) => void;
  /** The zoom changed (every applyView reports it; the page shows it as a percentage). */
  onView?: (k: number) => void;
};

// The zoom range every path shares: the wheel, the zoom menu and fit's lower bound all stay in it.
export const ZOOM_MIN = 0.15;
export const ZOOM_MAX = 3;

// A note is drawn, not laid out: its text is wrapped here at roughly the width one character
// takes at the note font size, which is all an annotation needs. One step under the node label
// and level with its component line, so a note reads as a margin remark rather than a caption.
// These four move together — the CSS, the export stylesheet and the inline editor all read them.
export const NOTE_FONT = 11;
const NOTE_PAD = 10;
const NOTE_LINE = 15;
const NOTE_CHAR = 5.9;
export const NOTE_PLACEHOLDER = "Double-click to write";

export function wrapNote(text: string, width: number) {
  const max = Math.max(6, Math.floor((width - NOTE_PAD * 2) / NOTE_CHAR));
  const out: string[] = [];
  for (const paragraph of String(text ?? "").split("\n")) {
    if (!paragraph.trim()) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (next.length <= max) {
        line = next;
        continue;
      }
      if (line) out.push(line);
      line = word.length > max ? word.slice(0, max) : word;
    }
    if (line) out.push(line);
  }
  return out.length ? out : [""];
}

/**
 * How wide a piece of SVG text actually is. The browser knows; it only refuses when the node
 * is not being rendered (a hidden tab, a detached tree), and then an estimate from the character
 * count is close enough to keep a tag from landing on the word before it.
 */
const textWidth = (node: Element, estimate: number) => {
  try {
    return (node as SVGTextContentElement).getComputedTextLength() || estimate;
  } catch {
    return estimate;
  }
};

const overlaps = (b: Box, r: number[]) =>
  b[0] < r[2] && b[0] + b[2] > r[0] && b[1] < r[3] && b[1] + b[3] > r[1];

function distanceToSegment(ax: number, ay: number, bx: number, by: number, x: number, y: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
  return Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
}

function distanceToPath(points: number[][], x: number, y: number) {
  if (points.length === 2)
    return distanceToSegment(points[0][0], points[0][1], points[1][0], points[1][1], x, y);
  if (points.length === 7) {
    // A ported edge: two cubics meeting at the middle (geometry.js), each sampled.
    let best = Number.POSITIVE_INFINITY;
    for (const [p0, p1, p2, p3] of [points.slice(0, 4), points.slice(3, 7)]) {
      let px = p0[0];
      let py = p0[1];
      for (let i = 1; i <= 16; i++) {
        const t = i / 16;
        const u = 1 - t;
        const qx =
          u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
        const qy =
          u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
        best = Math.min(best, distanceToSegment(px, py, qx, qy, x, y));
        px = qx;
        py = qy;
      }
    }
    return best;
  }
  const [[x1, y1], [cx, cy], [x2, y2]] = points;
  let best = Number.POSITIVE_INFINITY;
  let px = x1;
  let py = y1;
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    const u = 1 - t;
    const qx = u * u * x1 + 2 * u * t * cx + t * t * x2;
    const qy = u * u * y1 + 2 * u * t * cy + t * t * y2;
    best = Math.min(best, distanceToSegment(px, py, qx, qy, x, y));
    px = qx;
    py = qy;
  }
  return best;
}

export class Scene {
  svg: SVGSVGElement;
  h: Handlers;
  defs: SVGDefsElement;
  viewport: SVGGElement;
  layers: {
    frames: SVGGElement;
    notes: SVGGElement;
    edges: SVGGElement;
    nodes: SVGGElement;
    markers: SVGGElement;
    overlay: SVGGElement;
  };
  view = { x: 0, y: 0, k: 1 };
  symbols = new Set<string>();
  nodeEls = new Map<string, SVGGElement>();
  noteEls = new Map<string, SVGGElement>();
  noteBoxes: Record<string, Box> = {};
  edgeEls = new Map<number, any>();
  frameEls = new Map<string, any>();
  selection: Subject = { type: null, ref: null };
  multi = new Set<string>();
  model!: Model;
  boxes: Record<string, Box> = {};
  frames: Record<string, Box> = {};
  geom: any[] = [];
  drag: any = null;
  noteDrag: any = null;
  /** The marker the pointer is resting on, once it has rested long enough to mean it. */
  peek: string | null = null;
  private peekTimer: ReturnType<typeof setTimeout> | null = null;
  wire: any = null;
  bowDrag: any = null;
  /** An edge's end handle being dragged: to a port on its own box, or onto another component. */
  tip: any = null;
  /** The selected edge's two end handles, [from, to], and which edge they belong to. */
  endHandles: SVGCircleElement[] = [];
  endHandlesFor: number | null = null;
  /** The selected group's four port dots, and which group they belong to. */
  frameDots: SVGCircleElement[] = [];
  frameDotsFor: string | null = null;
  marquee: any = null;
  pan: any = null;
  editor: any = null;
  /** The left button pans: Space is held, or the hand tool is on. Every drag handler checks it. */
  space = false;
  /** Space itself is down. Only this makes the plain wheel zoom; the hand tool leaves it a scroll. */
  spaceHeld = false;
  /** The hand tool (H): a pan mode that stays until the select tool (V) takes over again. */
  hand = false;
  disposed = false;
  private cleanups: Array<() => void> = [];

  constructor(svg: SVGSVGElement, handlers: Handlers) {
    this.svg = svg;
    this.h = handlers;
    this.defs = svg.querySelector("defs") as SVGDefsElement;
    this.viewport = svg.querySelector(".viewport") as SVGGElement;
    this.layers = {
      frames: svg.querySelector(".layer-frames") as SVGGElement,
      notes: svg.querySelector(".layer-notes") as SVGGElement,
      edges: svg.querySelector(".layer-edges") as SVGGElement,
      nodes: svg.querySelector(".layer-nodes") as SVGGElement,
      // The hidden-note markers sit above the nodes so a marker on a node's corner is never
      // painted over. The layer is made here rather than in the page's skeleton because it is
      // chrome the export strips, and nothing outside this file knows about it.
      markers: el("g", { class: "layer-note-markers" }) as SVGGElement,
      overlay: svg.querySelector(".layer-overlay") as SVGGElement,
    };
    this.layers.overlay.before(this.layers.markers);
    this.installArrowhead();
    this.installShadow();
    this.bind();
  }

  dispose() {
    this.disposed = true;
    if (this.peekTimer) clearTimeout(this.peekTimer);
    this.closeEditor();
    for (const c of this.cleanups) c();
    this.cleanups = [];
    // The marker layer and the arrowheads are the things this scene added to a DOM it does
    // not own. They go with it, or the next Scene on the same <svg> inherits a stale layer and
    // a second element with the same id.
    this.layers.markers.remove();
    for (const id of ARROWHEADS) this.defs.querySelector(`#${id}`)?.remove();
    this.defs.querySelector(`#${NODE_SHADOW}`)?.remove();
  }

  // A filled head whose tip lands on the end of the path (refX is the tip), as render.js draws
  // it. A marker cannot take the stroke of the path it sits on, so the selected edge's accent
  // head is a marker of its own; at the selected stroke width it is drawn a little smaller so
  // the head grows less than the line does.
  installArrowhead() {
    for (const [id, size, colour] of [
      ["arrowhead", 8, "var(--edge)"],
      ["arrowhead-sel", 6, "var(--accent)"],
    ] as const) {
      this.defs.querySelector(`#${id}`)?.remove();
      const m = el("marker", {
        id,
        viewBox: "0 0 10 10",
        refX: 10,
        refY: 5,
        markerWidth: size,
        markerHeight: size,
        orient: "auto",
      });
      m.innerHTML = `<path d="M0 0L10 5L0 10z" fill="${colour}"/>`;
      this.defs.append(m);
    }
  }

  // The soft lift under node cards and notes. Canvas only: canvas.css applies it (and turns it
  // off in the dark theme), the export's stylesheet never names it and toSVG drops it from the
  // cloned <defs>, and the server render has no such thing.
  installShadow() {
    this.defs.querySelector(`#${NODE_SHADOW}`)?.remove();
    const f = el("filter", {
      id: NODE_SHADOW,
      x: "-10%",
      y: "-10%",
      width: "120%",
      height: "140%",
      "color-interpolation-filters": "sRGB",
    });
    f.innerHTML =
      '<feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000" flood-opacity="0.08"/>';
    this.defs.append(f);
  }

  // ---------------------------------------------------------------- view

  applyView() {
    const { x, y, k } = this.view;
    this.viewport.setAttribute("transform", `translate(${x} ${y}) scale(${k})`);
    this.h.onView?.(k);
  }

  /** Zoom to `k` around the middle of the view, so what is in the centre stays there. */
  setZoom(k: number) {
    const r = this.svg.getBoundingClientRect();
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k));
    const [wx, wy] = this.toWorld(r.left + r.width / 2, r.top + r.height / 2);
    this.view = { k: next, x: r.width / 2 - wx * next, y: r.height / 2 - wy * next };
    this.applyView();
  }

  /** The hand tool on or off. Held Space still pans on top of the select tool, as before. */
  setHand(on: boolean) {
    this.hand = on;
    this.space = on || this.spaceHeld;
    this.svg.classList.toggle("hand", this.space);
  }

  // The padding clears the floating chrome: the pills at the top and the dock at the bottom.
  fit(padding = 72) {
    const boxes = [
      ...Object.values(this.boxes || {}),
      ...(this.notesVisible() ? Object.values(this.noteBoxes || {}) : []),
    ];
    if (!boxes.length) {
      this.view = { x: 0, y: 0, k: 1 };
      this.applyView();
      return;
    }
    const r = this.svg.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) {
      requestAnimationFrame(() => !this.disposed && this.fit(padding));
      return;
    }
    const x0 = Math.min(...boxes.map((b) => b[0]));
    const y0 = Math.min(...boxes.map((b) => b[1]));
    const x1 = Math.max(...boxes.map((b) => b[0] + b[2]));
    const y1 = Math.max(...boxes.map((b) => b[1] + b[3]));
    const raw = Math.min(
      (r.width - padding * 2) / Math.max(1, x1 - x0),
      (r.height - padding * 2) / Math.max(1, y1 - y0),
      1.6,
    );
    const k = Math.max(0.35, raw);
    this.view = {
      k,
      x: (r.width - (x1 - x0) * k) / 2 - x0 * k,
      y: (r.height - (y1 - y0) * k) / 2 - y0 * k,
    };
    this.applyView();
  }

  center(box: Box) {
    const r = this.svg.getBoundingClientRect();
    this.view.x = r.width / 2 - (box[0] + box[2] / 2) * this.view.k;
    this.view.y = r.height / 2 - (box[1] + box[3] / 2) * this.view.k;
    this.applyView();
  }

  capture(ev: PointerEvent) {
    try {
      this.svg.setPointerCapture(ev.pointerId);
    } catch {
      /* not a live pointer */
    }
  }

  toWorld(clientX: number, clientY: number): [number, number] {
    const r = this.svg.getBoundingClientRect();
    return [
      (clientX - r.left - this.view.x) / this.view.k,
      (clientY - r.top - this.view.y) / this.view.k,
    ];
  }

  toScreen(wx: number, wy: number): [number, number] {
    const r = this.svg.getBoundingClientRect();
    return [r.left + this.view.x + wx * this.view.k, r.top + this.view.y + wy * this.view.k];
  }

  viewCenterWorld(): [number, number] {
    const r = this.svg.getBoundingClientRect();
    return this.toWorld(r.left + r.width / 2, r.top + r.height / 2);
  }

  nodeAt(wx: number, wy: number, except: string | null = null) {
    for (const n of [...this.model.doc.nodes].reverse()) {
      if (n.id === except) continue;
      const b = this.boxes[n.id];
      if (b && wx >= b[0] && wx <= b[0] + b[2] && wy >= b[1] && wy <= b[1] + b[3])
        return n.id as string;
    }
    return null;
  }

  /**
   * What an edge end would attach to under a point: a component, else a group as a unit, but
   * only when the point is on that frame's border band or label strip (see frame-target.ts). A
   * point in a frame's open interior attaches to nothing: a wire let go there adds a member.
   */
  endAt(wx: number, wy: number, except: string | null = null) {
    const node = this.nodeAt(wx, wy, except);
    if (node) return node;
    return frameTargetAt(this.frames, wx, wy, this.view.k, except);
  }

  /** The box an edge end names: a component's box, else a group's frame. */
  boxOf(id: string): Box | undefined {
    return this.boxes[id] ?? (Object.hasOwn(this.frames, id) ? this.frames[id] : undefined);
  }

  /** The element a wire highlights for an end: a component's card, or a group's frame. */
  endEl(id: string | null): Element | null {
    if (!id) return null;
    return this.nodeEls.get(id) ?? this.frameEls.get(id)?.rect ?? null;
  }

  // ---------------------------------------------------------------- render

  render(model: Model) {
    this.model = model;
    this.boxes = {};
    for (const n of model.doc.nodes) {
      const p = model.positions[n.id] || [0, 0];
      const s = model.sizes[n.id] || [140, 78];
      this.boxes[n.id] = [p[0], p[1], s[0], s[1]];
    }
    for (const id of [...this.multi]) if (!this.boxes[id]) this.multi.delete(id);
    if (this.selection.type === "node" && !this.boxes[this.selection.ref as string])
      this.selection = { type: null, ref: null };
    this.frames = groupFrames(model.doc, this.boxes) as Record<string, Box>;
    // An anchored note carries an offset, not a position, so every render works out afresh
    // where it lands. That is what makes it follow its target through a node drag, an Arrange,
    // or a group that grew because something inside it moved.
    this.noteBoxes = {};
    for (const n of model.notes || []) {
      const [x, y] = this.noteOrigin(n);
      this.noteBoxes[n.id] = [x, y, n.w, n.h];
    }
    if (
      this.selection.type === "note" &&
      !this.liveNotes().some((n) => n.id === this.selection.ref)
    )
      this.selection = { type: null, ref: null };
    this.renderFrames();
    this.renderNotes();
    this.renderEdges();
    this.renderNodes();
    this.renderSelection();
  }

  // ---------------------------------------------------------------- notes
  // Notes are annotations, not nodes: they carry no glyph and no ports, nothing can be wired
  // to them, and they live in the layout sidecar rather than in the design document.

  /** The toggle, read defensively: a scene can be asked things before its first render. */
  notesVisible() {
    return this.model?.showNotes !== false;
  }

  /** The box an anchor names: a node's box, or a group's computed frame. */
  anchorBox(note: Note): Box | null {
    if (!note.anchor) return null;
    const id = anchorTarget(note.anchor);
    return ("node" in note.anchor ? this.boxes[id] : this.frames[id]) || null;
  }

  /**
   * Where a note's top-left corner sits in the world. Free notes store that directly; an
   * anchored one stores an offset from its target's TOP-RIGHT corner, so the note moves with
   * the target and nothing has to be written when the target moves.
   */
  noteOrigin(note: Note): [number, number] {
    const t = this.anchorBox(note);
    if (!t) return [note.x, note.y];
    return [t[0] + t[2] + note.x, t[1] + note.y];
  }

  /** The reverse: a world top-left back into whatever this note stores. */
  noteStored(note: Note, x: number, y: number): [number, number] {
    const t = this.anchorBox(note);
    if (!t) return [x, y];
    return anchorOffset(t, x, y);
  }

  /** The nearest point on a rectangle to a point outside it. */
  private nearestOn(b: Box, x: number, y: number): [number, number] {
    return [Math.max(b[0], Math.min(x, b[0] + b[2])), Math.max(b[1], Math.min(y, b[1] + b[3]))];
  }

  /** A short segment between the two nearest edges of the note and of what it is pinned to. */
  leaderFor(note: Note, box: Box): string | null {
    const t = this.anchorBox(note);
    if (!t) return null;
    const [ax, ay] = this.nearestOn(box, t[0] + t[2] / 2, t[1] + t[3] / 2);
    const [bx, by] = this.nearestOn(t, box[0] + box[2] / 2, box[1] + box[3] / 2);
    return `M${ax} ${ay} L${bx} ${by}`;
  }

  /**
   * What is on screen right now, and whether it is live. With the toggle on, every note is
   * live. With it off, a pinned target's notes are live too, and the one being peeked at is
   * drawn but inert: you can read it without being able to grab it.
   */
  notesToDraw(): Array<{ note: Note; peek: boolean }> {
    const notes = this.model.notes || [];
    if (this.notesVisible()) return notes.map((note) => ({ note, peek: false }));
    const pinned = new Set(this.model.pinnedNotes || []);
    const out: Array<{ note: Note; peek: boolean }> = [];
    for (const note of notes) {
      if (!note.anchor) continue;
      const key = anchorKey(note.anchor);
      if (pinned.has(key)) out.push({ note, peek: false });
      else if (this.peek === key) out.push({ note, peek: true });
    }
    return out;
  }

  /** The notes a pointer is allowed to find: drawn, and not a peek. */
  private liveNotes() {
    return this.notesToDraw()
      .filter((d) => !d.peek)
      .map((d) => d.note);
  }

  renderNotes() {
    this.renderNoteMarkers();
    this.renderNoteBodies();
  }

  /** Only the notes, leaving the markers alone: what a peek changing needs, and no more. */
  renderNoteBodies() {
    const g = this.layers.notes;
    g.textContent = "";
    this.noteEls.clear();
    for (const { note: n, peek } of this.notesToDraw()) {
      const b = this.noteBoxes[n.id] || [n.x, n.y, n.w, n.h];
      const [bw, bh] = [b[2], b[3]];
      const leader = this.leaderFor(n, b);
      if (leader)
        g.append(
          el("path", {
            class: `note-leader${peek ? " peek" : ""}`,
            "data-leader-for": n.id,
            d: leader,
          }),
        );
      const box = el("g", {
        class: `note-box${n.anchor ? " anchored" : ""}${peek ? " peek" : ""}`,
        "data-note-id": n.id,
        transform: `translate(${b[0]} ${b[1]})`,
      }) as SVGGElement;
      box.append(
        el("rect", {
          class: "note-body",
          x: 0,
          y: 0,
          width: bw,
          height: bh,
          rx: 10,
          fill: "var(--f-note-fill)",
          stroke: "var(--f-note-line)",
        }),
      );
      const empty = !n.text.trim();
      const text = el("text", { class: `note-text${empty ? " empty" : ""}` });
      const lines = wrapNote(empty ? NOTE_PLACEHOLDER : n.text, bw);
      const room = Math.max(1, Math.floor((bh - NOTE_PAD) / NOTE_LINE));
      lines.slice(0, room).forEach((line, i) => {
        const span = el("tspan", { x: NOTE_PAD, y: NOTE_PAD + NOTE_FONT + i * NOTE_LINE });
        span.textContent = i === room - 1 && lines.length > room ? `${line} …` : line;
        text.append(span);
      });
      box.append(text);
      const grip = el("path", {
        class: "note-grip",
        d: `M${bw - 13} ${bh - 3} L${bw - 3} ${bh - 13} M${bw - 7} ${bh - 3} L${bw - 3} ${bh - 7}`,
      });
      grip.addEventListener("pointerdown", (ev: any) => this.startNoteResize(n.id, ev));
      const gripHit = el("rect", {
        class: "note-grip-hit",
        x: bw - 16,
        y: bh - 16,
        width: 16,
        height: 16,
      });
      gripHit.addEventListener("pointerdown", (ev: any) => this.startNoteResize(n.id, ev));
      box.append(grip, gripHit);
      if (!peek) box.addEventListener("pointerdown", (ev) => this.startNoteDrag(n.id, ev));
      g.append(box);
      this.noteEls.set(n.id, box);
    }
  }

  /**
   * With notes hidden, each node or group that carries one shows a dot on the corner the
   * notes hang off, so nothing is silently lost. Free-floating notes get no marker: there is
   * nothing for one to sit on. These are chrome, and the export strips them.
   */
  renderNoteMarkers() {
    const g = this.layers.markers;
    g.textContent = "";
    if (this.notesVisible()) return;
    const pinned = new Set(this.model.pinnedNotes || []);
    const counts = new Map<string, { box: Box; n: number }>();
    for (const note of this.model.notes || []) {
      const t = this.anchorBox(note);
      if (!t || !note.anchor) continue;
      const key = anchorKey(note.anchor);
      const seen = counts.get(key);
      if (seen) seen.n++;
      else counts.set(key, { box: t, n: 1 });
    }
    for (const [key, { box, n }] of counts) {
      const held = pinned.has(key);
      const mark = el("g", { class: "note-marker-g", "data-for": key }) as SVGGElement;
      // A 4.5px dot is a hard thing to aim at, so the thing you aim at is bigger than the
      // thing you see.
      mark.append(
        el("circle", {
          class: "note-marker-hit",
          cx: box[0] + box[2] + 5,
          cy: box[1] - 5,
          r: 11,
        }),
      );
      const dot = el("circle", {
        class: `note-marker${held ? " pinned" : ""}`,
        cx: box[0] + box[2] + 5,
        cy: box[1] - 5,
        r: 4.5,
      });
      const tip = el("title");
      tip.textContent = held
        ? `${n} note${n === 1 ? "" : "s"} held open`
        : `${n} hidden note${n === 1 ? "" : "s"}`;
      dot.append(tip);
      mark.append(dot);
      mark.addEventListener("pointerenter", () => this.startPeek(key));
      mark.addEventListener("pointerleave", () => this.endPeek(key));
      mark.addEventListener("pointerdown", (ev: any) => {
        if (ev.button !== 0 || this.space) return;
        ev.stopPropagation();
      });
      mark.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.setPeek(null);
        this.h.onNotePin?.(key);
      });
      g.append(mark);
    }
  }

  /** Resting on a marker for a moment means "let me see"; passing over it means nothing. */
  startPeek(key: string) {
    if (this.peekTimer) clearTimeout(this.peekTimer);
    this.peekTimer = setTimeout(() => {
      this.peekTimer = null;
      if (!this.disposed) this.setPeek(key);
    }, 150);
  }

  endPeek(key: string) {
    if (this.peekTimer) {
      clearTimeout(this.peekTimer);
      this.peekTimer = null;
    }
    if (this.peek === key) this.setPeek(null);
  }

  /** Redraws the notes and nothing else, so the marker under the pointer survives. */
  setPeek(key: string | null) {
    if (this.peek === key) return;
    this.peek = key;
    this.renderNoteBodies();
    this.renderSelection();
  }

  noteAt(wx: number, wy: number) {
    for (const n of this.liveNotes().reverse()) {
      const b = this.noteBoxes[n.id];
      if (b && wx >= b[0] && wx <= b[0] + b[2] && wy >= b[1] && wy <= b[1] + b[3]) return n.id;
    }
    return null;
  }

  startNoteDrag(id: string, ev: PointerEvent) {
    if (ev.button !== 0 || this.space) return;
    ev.stopPropagation();
    this.select("note", id);
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    const b = this.noteBoxes[id];
    this.noteDrag = { id, mode: "move", moved: false, dx: wx - b[0], dy: wy - b[1], box: [...b] };
    this.capture(ev);
  }

  startNoteResize(id: string, ev: PointerEvent) {
    if (ev.button !== 0 || this.space) return;
    ev.stopPropagation();
    this.select("note", id);
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    const b = this.noteBoxes[id];
    this.noteDrag = {
      id,
      mode: "resize",
      moved: false,
      dx: wx - (b[0] + b[2]),
      dy: wy - (b[1] + b[3]),
      box: [...b],
    };
    this.capture(ev);
  }

  moveNote(ev: PointerEvent) {
    const d = this.noteDrag;
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    const b = this.noteBoxes[d.id];
    if (!b) return;
    d.moved = true;
    if (d.mode === "move") {
      b[0] = Math.round(wx - d.dx);
      b[1] = Math.round(wy - d.dy);
    } else {
      b[2] = Math.round(Math.max(NOTE_MIN_W, wx - d.dx - b[0]));
      b[3] = Math.round(Math.max(NOTE_MIN_H, wy - d.dy - b[1]));
    }
    // The model is left alone until the drag ends: `noteBoxes` is the world truth while the
    // pointer is down, and an anchored note's stored offset is worked out from it at the end.
    if (d.mode === "move") {
      const el = this.noteEls.get(d.id);
      el?.setAttribute("transform", `translate(${b[0]} ${b[1]})`);
      // Lifted over the components while it moves, so it stays in sight when it is dragged
      // onto one, and see-through, so the ring on what it would be pinned to shows under it.
      // Notes otherwise sit under the components, where a pinned note never hides one.
      if (!el?.classList.contains("dragging")) {
        this.layers.nodes.after(this.layers.notes);
        el?.classList.add("dragging");
      }
      this.redrawLeader(d.id);
      this.setNoteDropTarget(this.noteDropAt(d.id, wx, wy, b));
    } else this.renderNotes();
    this.renderSelection();
  }

  /** Keep the leader attached while its note is dragged around. */
  redrawLeader(id: string) {
    const note = (this.model.notes || []).find((n) => n.id === id);
    const b = this.noteBoxes[id];
    if (!note || !b) return;
    const d = this.leaderFor(note, b);
    const path = this.layers.notes.querySelector(`[data-leader-for="${CSS.escape(id)}"]`);
    if (!d) {
      path?.remove();
      return;
    }
    if (path) path.setAttribute("d", d);
    else this.layers.notes.prepend(el("path", { class: "note-leader", "data-leader-for": id, d }));
  }

  /**
   * What a note let go at this world point would be pinned to: the component under the pointer,
   * else the innermost group around it. Its own current target is not a new one, and nor is a
   * group around it, so they are left out: letting go there is an ordinary move.
   */
  noteDropAt(id: string, wx: number, wy: number, box: Box | null = null): NoteAnchor | null {
    const note = (this.model.notes || []).find((n) => n.id === id);
    const order = this.model.doc.nodes.map((n: any) => n.id as string);
    const current = note ? this.anchorBox(note) : null;
    const target = noteDropTarget(order, this.boxes, this.frames || {}, wx, wy, current, box);
    return target && !sameAnchor(target, note?.anchor) ? target : null;
  }

  /** The drop highlight: an accent ring on the component or group a note would be pinned to. */
  setNoteDropTarget(target: NoteAnchor | null) {
    const d = this.noteDrag;
    const prev: NoteAnchor | null = d?.target ?? null;
    if (d) d.target = target;
    if (prev === target || sameAnchor(prev, target)) return;
    const elOf = (a: NoteAnchor) =>
      "node" in a ? this.nodeEls.get(a.node) : this.frameEls.get(a.group)?.rect;
    if (prev) elOf(prev)?.classList.remove("drop-target");
    if (target) elOf(target)?.classList.add("drop-target");
  }

  private clearNoteDropTarget() {
    for (const box of this.nodeEls.values()) box.classList.remove("drop-target");
    for (const f of this.frameEls.values()) f.rect.classList.remove("drop-target");
  }

  endNote() {
    const { id, moved, target } = this.noteDrag;
    this.noteDrag = null;
    this.clearNoteDropTarget();
    this.noteEls.get(id)?.classList.remove("dragging");
    this.layers.edges.before(this.layers.notes);
    const b = this.noteBoxes[id];
    const note = (this.model.notes || []).find((n) => n.id === id);
    if (!moved || !b || !note) return;
    // Let go on a component or a group: pin it there, the offset worked out from where it was
    // dropped so it does not jump.
    const to = target
      ? "node" in target
        ? this.boxes[target.node]
        : this.frames[target.group]
      : null;
    if (target && to) {
      // Left where it was let go, unless that covers the component it now describes: then it
      // goes to the usual pinned place, just off the component's top-right corner.
      const [x, y] =
        "node" in target && coversTarget(to, b)
          ? [NOTE_ANCHOR_DX, NOTE_ANCHOR_DY]
          : anchorOffset(to, b[0], b[1]);
      this.h.onNoteAnchor?.(id, target, { x, y, w: b[2], h: b[3] });
      return;
    }
    // Let go anywhere else, an anchored note changes its OFFSET, never its anchor: it stays
    // pinned to the same thing, just further from it.
    const [x, y] = this.noteStored(note, b[0], b[1]);
    this.h.onNoteGeometry?.(id, { x, y, w: b[2], h: b[3] });
  }

  renderFrames() {
    const g = this.layers.frames;
    g.textContent = "";
    this.frameEls.clear();
    const styles = this.model.frameStyles ?? {};
    const tintOf = (id: string) => normaliseTint((own(styles, id) as FrameStyle | undefined)?.tint);
    // Outer groups first, so a nested one paints over its parent; every group inside a
    // tinted one lays the page background down first, so a tint fills its own area only. The
    // server render (render.js) does the same with the same two helpers.
    const groups = this.model.doc.groups || [];
    const cut = framesUnderTint(groups, (id: string) => tintOf(id) !== null);
    for (const group of framesOuterFirst(groups)) {
      const f = this.frames[group.id];
      if (!f) continue;
      const style = own(styles, group.id) as FrameStyle | undefined;
      const under = cut.has(group.id)
        ? el("rect", {
            class: "frame-under",
            x: f[0],
            y: f[1],
            width: f[2],
            height: f[3],
            rx: 14,
          })
        : null;
      // A named tint is a token canvas.css resolves per theme. A hex tint says "hex" and hands
      // its colour over as two custom properties, so the same rules (selection, pointer, the
      // cut) apply to it and the fill carries the named tints' alpha (TINT_FILL_ALPHA).
      const tint = tintOf(group.id);
      const hex = tint?.startsWith("#") ? tint : null;
      // A light or bold strength fills with the tint itself at its own opacity, inline.
      const fill = tintFill(tint, style?.strength);
      const strong = fill?.strength ? `fill:${fill.color};fill-opacity:${fill.opacity}` : null;
      const rect = el("rect", {
        class: "frame",
        x: f[0],
        y: f[1],
        width: f[2],
        height: f[3],
        rx: 14,
        "data-tint": hex ? "hex" : tint,
        "data-strength": fill?.strength ?? null,
        style:
          [hex ? `--tint-hex:${hex};--tint-hex-fill:${hex}${TINT_FILL_ALPHA}` : null, strong]
            .filter(Boolean)
            .join(";") || null,
      });
      const hit = el("rect", {
        class: "frame-hit",
        x: f[0],
        y: f[1],
        width: f[2],
        height: f[3],
        rx: 14,
      });
      // A group reads as a name with its kind beside it, never "name (kind)". The label is
      // what the author typed; the kind is a tag. With no label the id stands in, so a hand
      // -written design keeps reading as cell-a / cell-b. When that caption would only repeat
      // the kind, the tag alone says it — a fresh group whose auto-id is its kind shows one word.
      // The icon, when the group has one and the catalogue can draw it, comes first and
      // pushes the words right. A reference to an icon that is not there draws nothing.
      const symbol = this.frameSymbol(style?.icon);
      const icon = symbol
        ? el("use", {
            href: `#${symbol}`,
            class: "frame-icon",
            x: f[0] + 12,
            y: f[1] + FRAME_ICON_DY,
            width: FRAME_ICON,
            height: FRAME_ICON,
          })
        : null;
      const labelDx = 12 + (icon ? FRAME_ICON_SHIFT : 0);
      const label = el("text", { class: "frame-label", x: f[0] + labelDx, y: f[1] + 19 });
      const caption = group.label ? String(group.label) : String(group.id);
      const name = caption === group.kind ? "" : caption;
      label.textContent = name;
      const tag = el("text", { class: "frame-kind", x: f[0] + labelDx, y: f[1] + 19 });
      tag.textContent = group.kind;
      for (const target of [hit, label, tag, icon]) {
        target?.addEventListener("pointerdown", (ev: any) => this.startGroupDrag(group.id, ev));
      }
      g.append(...(under ? [under] : []), rect, hit, ...(icon ? [icon] : []), label, tag);
      // The tag sits just past the name. Measured once here, because the name does not change
      // while the frame is being dragged — only where the frame is.
      const tagDx = labelDx + (name ? textWidth(label, name.length * 6.2) + 8 : 0);
      tag.setAttribute("x", String(f[0] + tagDx));
      this.frameEls.set(group.id, { under, rect, hit, icon, label, tag, labelDx, tagDx });
    }
  }

  renderEdges() {
    const g = this.layers.edges;
    g.textContent = "";
    this.edgeEls.clear();
    this.geom = edgeGeometry(
      this.model.doc,
      this.boxes,
      this.model.bows || {},
      this.model.ports || {},
      this.frames,
    );
    for (const e of this.geom) {
      const d = pathOf(e.points);
      const hit = el("path", { class: "edge-hit", d });
      const line = el("path", {
        class: `edge${e.dashed ? " async" : ""}`,
        d,
        "marker-end": "url(#arrowhead)",
      });
      hit.addEventListener("pointerdown", (ev: any) => {
        if (ev.button !== 0 || this.space) return;
        ev.stopPropagation();
        this.select("edge", e.i);
        this.startBow(e, ev);
      });
      g.append(hit, line);
      const els: any = { hit, line, key: e.key, from: e.from, to: e.to, label: null };
      if (e.label) {
        // Where geometry.js says: above a lone edge, on the outer side of a lane's own curve.
        const t = el("text", {
          class: "edge-label",
          x: e.labelAt[0],
          y: e.labelAt[1],
          "text-anchor": e.labelAnchor,
        });
        t.textContent = e.label;
        // A label picks its own edge: with two lanes, the label is the easiest thing to aim at.
        t.addEventListener("pointerdown", (ev: any) => {
          if (ev.button !== 0 || this.space) return;
          ev.stopPropagation();
          this.select("edge", e.i);
        });
        g.append(t);
        els.label = t;
      }
      this.edgeEls.set(e.i, els);
    }
  }

  symbolFor(componentId: string) {
    if (this.symbols.has(componentId)) return true;
    const body = own(this.model.icons, componentId);
    if (!body) return false;
    const sym = el("symbol", { id: `ic-${componentId}`, viewBox: "0 0 24 24" });
    sym.innerHTML = body;
    this.defs.append(sym);
    this.symbols.add(componentId);
    return true;
  }

  /**
   * The symbol id for a group icon reference, defining it on first use, or null when the
   * reference is malformed or names an icon the catalogue does not have. Kind glyphs (`ick-`)
   * and group marks (`icb-`) get their own prefixes so they can never collide with a component
   * id, nor with each other: `kind:network` and `boundary:network` are different drawings.
   */
  frameSymbol(ref: string | undefined) {
    const key = frameIconKey(ref);
    if (!key) return null;
    const colon = key.indexOf(":");
    if (colon < 0) return this.symbolFor(key) ? `ic-${key}` : null;
    // The user-facing word is group; boundary stays in the stored format.
    const prefix = key.startsWith("boundary:") ? "icb-" : "ick-";
    const id = `${prefix}${key.slice(colon + 1)}`;
    if (this.symbols.has(id)) return id;
    const body = own(this.model.icons, key);
    if (!body) return null;
    const sym = el("symbol", { id, viewBox: "0 0 24 24" });
    sym.innerHTML = body;
    this.defs.append(sym);
    this.symbols.add(id);
    return id;
  }

  // A custom node is a hole in the model, and it is drawn as one: dashed border, washed-out
  // fill. A reader should be able to see where the rules stop applying without reading a panel.
  isCustom(componentId: string) {
    return own(this.model.catalogue.components, componentId)?.kind === "custom";
  }

  renderNodes() {
    const g = this.layers.nodes;
    g.textContent = "";
    this.nodeEls.clear();
    for (const n of this.model.doc.nodes) {
      const b = this.boxes[n.id];
      const untyped = this.isCustom(n.component);
      const box = el("g", {
        class: `node-box${untyped ? " untyped" : ""}`,
        "data-id": n.id,
        transform: `translate(${b[0]} ${b[1]})`,
      }) as SVGGElement;
      box.append(
        el("rect", {
          class: "body",
          x: 0,
          y: 0,
          width: b[2],
          height: b[3],
          rx: 12,
          // One neutral surface for every node: colour comes from the icon, a group tint and
          // the finding badges, never from the kind's category.
          fill: "var(--node-fill)",
          stroke: "var(--node-line)",
          // Set on the element, not in a stylesheet, so the exported SVG carries it too.
          "stroke-dasharray": untyped ? "6 4" : null,
          "fill-opacity": untyped ? 0.45 : null,
        }),
      );
      // A tinted component: the card stays opaque and a second rect over it carries the tint's
      // border and faint fill, as the server render draws it. The border is an attribute, so a
      // selection or wiring state (canvas.css) can take it over.
      const tinted = own(this.model.nodeTints ?? {}, n.id) as NodeTint | undefined;
      const fill = tinted ? tintFill(tinted.tint, tinted.strength) : null;
      if (fill)
        box.append(
          el("rect", {
            class: "node-tint",
            x: 0,
            y: 0,
            width: b[2],
            height: b[3],
            rx: 12,
            stroke: fill.color,
            "stroke-width": 1,
            "stroke-dasharray": untyped ? "6 4" : null,
            style: `fill:${fill.color};fill-opacity:${fill.opacity}`,
          }),
        );
      // The name and id fitted to the box exactly as the server render fits them (nodeText in
      // @zeema/core/render): two lines at most, then an ellipsis, the whole text in a <title>.
      const text = nodeText(displayName(this.model.catalogue, n), n.component, b[2]);
      if (text.full) {
        const title = el("title", {});
        title.textContent = text.full;
        box.prepend(title);
      }
      if (this.symbolFor(n.component))
        box.append(
          el("use", {
            href: `#ic-${n.component}`,
            x: b[2] / 2 - text.icon.size / 2,
            y: text.icon.y,
            width: text.icon.size,
            height: text.icon.size,
            class: "glyph",
          }),
        );
      for (const line of text.name) {
        const name = el("text", {
          class: "name",
          x: b[2] / 2,
          y: line.y,
          "text-anchor": "middle",
        });
        name.textContent = line.text;
        box.append(name);
      }
      const comp = el("text", {
        class: "comp",
        x: b[2] / 2,
        y: text.comp.y,
        "text-anchor": "middle",
      });
      comp.textContent = text.comp.text;
      box.append(comp);
      const bad = (this.model.findings || []).filter(
        (f) => f.subject && f.subject.type === "node" && f.subject.ref === n.id,
      );
      if (bad.length) {
        const worst = bad.some((f) => f.blocking || f.severity === "error")
          ? "badge-error"
          : "badge-warn";
        box.append(el("circle", { class: worst, cx: b[2] - 10, cy: 10, r: 4 }));
      }
      // A port dot at the middle of each side, just outside the border. canvas.css shows them
      // on hover and on the selected node; dragging one draws a wire from that side.
      for (const side of PORT_SIDES) {
        const [hx, hy] = portDotAt([0, 0, b[2], b[3]], side);
        const dot = el("circle", { class: "port-dot", cx: hx, cy: hy, r: 4, "data-side": side });
        dot.addEventListener("pointerdown", (ev: any) => {
          if (ev.button !== 0 || this.space) return;
          ev.stopPropagation();
          this.startWire(n.id, ev, side);
        });
        box.append(dot);
      }
      box.addEventListener("pointerdown", (ev) => this.startDrag(n.id, ev));
      g.append(box);
      this.nodeEls.set(n.id, box);
    }
  }

  repaintEdges(bows: Record<string, number>, ports = this.model.ports || {}) {
    this.model.bows = bows;
    const geom = edgeGeometry(this.model.doc, this.boxes, bows, ports, this.frames);
    this.geom = geom;
    for (const e of geom) {
      const els = this.edgeEls.get(e.i);
      if (!els) continue;
      const d = pathOf(e.points);
      els.line.setAttribute("d", d);
      els.hit.setAttribute("d", d);
      if (els.label) {
        els.label.setAttribute("x", e.labelAt[0]);
        els.label.setAttribute("y", e.labelAt[1]);
        els.label.setAttribute("text-anchor", e.labelAnchor);
      }
    }
    this.placeEndHandles();
  }

  /**
   * A selected edge shows a handle at each end, where the arrow meets its box. Dragging one
   * along its own box moves where that end attaches; dragging it onto another component moves
   * the end there. They live in the overlay, above the nodes, so a handle on a border is never
   * under the box it sits on.
   */
  placeEndHandles() {
    const sel = this.selection.type === "edge" ? (this.selection.ref as number) : null;
    const e = sel === null ? null : (this.geom || []).find((g) => g.i === sel);
    if (sel === null || !e) {
      for (const h of this.endHandles) h.remove();
      this.endHandles = [];
      this.endHandlesFor = null;
      return;
    }
    if (this.endHandlesFor !== sel || !this.endHandles.length) {
      for (const h of this.endHandles) h.remove();
      this.endHandles = (["from", "to"] as const).map((end) => {
        const h = el("circle", {
          class: "end-handle",
          r: 4.5,
          "data-end": end,
        }) as SVGCircleElement;
        h.addEventListener("pointerdown", (ev: any) => {
          if (ev.button !== 0 || this.space) return;
          ev.stopPropagation();
          this.startTip(sel, end, ev);
        });
        this.layers.overlay.append(h);
        return h;
      });
      this.endHandlesFor = sel;
    }
    const ends: Array<[number, number]> = [e.points[0], e.points[e.points.length - 1]];
    this.endHandles.forEach((h, k) => {
      const dragged = Boolean(
        this.tip && this.tip.i === sel && this.tip.end === (k ? "to" : "from"),
      );
      const [x, y] = dragged && !this.tip.port && this.tip.at ? this.tip.at : ends[k];
      h.setAttribute("cx", String(x));
      h.setAttribute("cy", String(y));
      h.classList.toggle("dragging", dragged);
    });
  }

  renderSelection() {
    for (const [id, node] of this.nodeEls) {
      node.classList.toggle("selected", this.multi.has(id));
      node.classList.toggle("primary", this.selection.type === "node" && this.selection.ref === id);
    }
    for (const [i, e] of this.edgeEls)
      e.line.classList.toggle(
        "selected",
        this.selection.type === "edge" && this.selection.ref === i,
      );
    for (const [id, f] of this.frameEls)
      f.rect.classList.toggle(
        "selected",
        this.selection.type === "group" && this.selection.ref === id,
      );
    for (const [id, note] of this.noteEls)
      note.classList.toggle(
        "selected",
        this.selection.type === "note" && this.selection.ref === id,
      );
    this.placeEndHandles();
    this.placeFrameDots();
  }

  /**
   * A selected group shows a port dot at the middle of each side of its frame, as a component
   * does, so a wire can start from the group as a unit. They live in the overlay: the frame's
   * own hit area is its outline, and a dot just outside it must not start a move of the group.
   */
  placeFrameDots() {
    const gid = this.selection.type === "group" ? (this.selection.ref as string) : null;
    const f = gid ? this.frames[gid] : null;
    if (!gid || !f) {
      for (const d of this.frameDots) d.remove();
      this.frameDots = [];
      this.frameDotsFor = null;
      return;
    }
    if (this.frameDotsFor !== gid || !this.frameDots.length) {
      for (const d of this.frameDots) d.remove();
      this.frameDots = PORT_SIDES.map((side) => {
        const dot = el("circle", {
          class: "port-dot frame-port-dot",
          r: 4,
          "data-side": side,
        }) as SVGCircleElement;
        dot.addEventListener("pointerdown", (ev: any) => {
          if (ev.button !== 0 || this.space) return;
          ev.stopPropagation();
          this.startWire(gid, ev, side);
        });
        this.layers.overlay.append(dot);
        return dot;
      });
      this.frameDotsFor = gid;
    }
    this.frameDots.forEach((dot, k) => {
      const [x, y] = portDotAt(f, PORT_SIDES[k]);
      dot.setAttribute("cx", String(x));
      dot.setAttribute("cy", String(y));
    });
  }

  // ---------------------------------------------------------------- selection

  select(type: Subject["type"], ref: Subject["ref"]) {
    this.selection = { type, ref };
    this.multi = type === "node" ? new Set([ref as string]) : new Set();
    this.emitSelection();
  }

  selectNodes(ids: string[], primary: string | null = null) {
    this.multi = new Set(ids);
    const head =
      primary && this.multi.has(primary) ? primary : ids.length ? ids[ids.length - 1] : null;
    this.selection = head ? { type: "node", ref: head } : { type: null, ref: null };
    this.emitSelection();
  }

  toggleNode(id: string) {
    if (this.multi.has(id)) {
      this.multi.delete(id);
      const next = [...this.multi];
      this.selection = next.length
        ? { type: "node", ref: next[next.length - 1] }
        : { type: null, ref: null };
    } else {
      this.multi.add(id);
      this.selection = { type: "node", ref: id };
    }
    this.emitSelection();
  }

  emitSelection() {
    this.renderSelection();
    this.h.onSelect?.(this.selection, this.multi);
  }

  // ---------------------------------------------------------------- interaction

  // Every listener this scene puts on something it does not own goes through here, so
  // `dispose` takes all of them off again. The SVG element outlives the Scene (React owns it),
  // so a listener left on it would be bound twice the next time a Scene mounts on the same
  // node — which is exactly what happens under React's development double-mount.
  private on<K extends keyof GlobalEventHandlersEventMap>(
    target: Window | SVGSVGElement,
    type: K,
    fn: (ev: GlobalEventHandlersEventMap[K]) => void,
    opts?: AddEventListenerOptions,
  ) {
    target.addEventListener(type, fn as EventListener, opts);
    this.cleanups.push(() => target.removeEventListener(type, fn as EventListener, opts));
  }

  bind() {
    const svg = this.svg;
    const typing = (ev: KeyboardEvent) =>
      /input|select|textarea/i.test((ev.target as HTMLElement)?.tagName ?? "");

    this.on(window, "keydown", (ev) => {
      if (ev.code !== "Space" || this.spaceHeld || typing(ev)) return;
      this.spaceHeld = true;
      this.space = true;
      svg.classList.add("hand");
      ev.preventDefault();
    });
    this.on(window, "keyup", (ev) => {
      if (ev.code !== "Space") return;
      this.spaceHeld = false;
      this.space = this.hand;
      svg.classList.toggle("hand", this.hand);
    });
    this.on(window, "blur", () => {
      this.spaceHeld = false;
      this.space = this.hand;
      svg.classList.toggle("hand", this.hand);
    });

    // The wheel follows draw.io: a plain wheel or a two-finger swipe scrolls the view, shift turns
    // a vertical wheel sideways, and only a zoom modifier (ctrl, meta, alt, or space held) zooms.
    // A touchpad pinch arrives as a wheel event with ctrlKey set, so it zooms through the same
    // rule. The page itself never scrolls or zooms under the canvas.
    this.on(
      svg,
      "wheel",
      (ev) => {
        ev.preventDefault();
        const r = svg.getBoundingClientRect();
        // deltaMode: 0 pixels, 1 lines, 2 pages.
        const unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? r.height : 1;
        let dx = ev.deltaX * unit;
        let dy = ev.deltaY * unit;
        if (ev.ctrlKey || ev.metaKey || ev.altKey || this.spaceHeld) {
          // Exponential zoom so a pinch is continuous. A mouse notch (|deltaY| about 100 px)
          // at 0.002 gives exp(0.2) ≈ 1.22, draw.io's 1.2 step. A pinch sends small pixel
          // deltas with ctrlKey, so those get 0.01 per pixel to feel as quick as the gesture.
          const pinch = ev.ctrlKey && ev.deltaMode === 0 && Math.abs(dy) < 50;
          const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
          const k = Math.min(
            ZOOM_MAX,
            Math.max(ZOOM_MIN, this.view.k * Math.exp(-dy * (pinch ? 0.01 : 0.002))),
          );
          this.view.k = k;
          this.view.x = ev.clientX - r.left - wx * k;
          this.view.y = ev.clientY - r.top - wy * k;
        } else {
          if (ev.shiftKey && dx === 0) [dx, dy] = [dy, 0];
          this.view.x -= dx;
          this.view.y -= dy;
        }
        this.applyView();
      },
      { passive: false },
    );

    this.on(svg, "dblclick", (ev) => {
      const target = this.targetOf(ev);
      if (!target.type) return;
      ev.preventDefault();
      this.editLabel(target.type, target.ref as string | number);
    });

    this.on(svg, "contextmenu", (ev) => {
      ev.preventDefault();
      const target = this.targetOf(ev);
      if (target.type === "node" && !this.multi.has(target.ref as string))
        this.select("node", target.ref);
      else if (target.type === "edge" || target.type === "group" || target.type === "note")
        this.select(target.type, target.ref);
      else if (target.type === null && this.selection.type) this.select(null, null);
      this.h.onContext?.(target, ev.clientX, ev.clientY);
    });

    this.on(svg, "dragover", (ev) => {
      if (ev.dataTransfer?.types.includes("text/zeema-component")) ev.preventDefault();
    });
    this.on(svg, "drop", (ev) => {
      const id = ev.dataTransfer?.getData("text/zeema-component");
      if (!id) return;
      ev.preventDefault();
      const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
      this.h.onDrop?.(id, wx, wy);
    });

    this.on(svg, "pointerdown", (ev) => {
      if (ev.button === 1 || (ev.button === 0 && this.space)) {
        ev.preventDefault();
        this.pan = { x: ev.clientX, y: ev.clientY, vx: this.view.x, vy: this.view.y };
        svg.classList.add("panning");
        this.capture(ev);
        return;
      }
      if (ev.button !== 0) return;
      const t = ev.target as Element;
      if (
        t.closest(".node-box") ||
        t.closest(".note-box") ||
        t.closest(".edge-hit") ||
        t.closest(".frame-hit") ||
        t.closest(".frame-label") ||
        t.closest(".frame-kind")
      )
        return;
      if (!ev.shiftKey) this.select(null, null);
      const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
      this.marquee = {
        x0: wx,
        y0: wy,
        x1: wx,
        y1: wy,
        add: ev.shiftKey,
        base: new Set(this.multi),
        moved: false,
        rect: el("rect", { class: "marquee", x: wx, y: wy, width: 0, height: 0 }),
      };
      this.layers.overlay.append(this.marquee.rect);
      this.capture(ev);
    });

    this.on(svg, "pointermove", (ev) => {
      if (this.pan) {
        this.view.x = this.pan.vx + (ev.clientX - this.pan.x);
        this.view.y = this.pan.vy + (ev.clientY - this.pan.y);
        this.applyView();
        return;
      }
      if (this.marquee) return this.moveMarquee(ev);
      if (this.noteDrag) return this.moveNote(ev);
      if (this.drag) this.moveDrag(ev);
      if (this.wire) this.moveWire(ev);
      if (this.bowDrag) this.moveBow(ev);
      if (this.tip) this.moveTip(ev);
    });

    const end = () => {
      if (this.pan) {
        this.pan = null;
        svg.classList.remove("panning");
      }
      if (this.marquee) this.endMarquee();
      if (this.noteDrag) this.endNote();
      if (this.drag) this.endDrag();
      if (this.wire) this.endWire();
      if (this.bowDrag) this.endBow();
      if (this.tip) this.finishTip();
    };
    this.on(svg, "pointerup", end);
    this.on(svg, "pointercancel", end);
  }

  targetOf(ev: MouseEvent): Subject {
    const direct = this.subjectOf(ev.target as Element);
    if (direct.type) return direct;
    const painted = this.subjectOf(document.elementFromPoint(ev.clientX, ev.clientY));
    if (painted.type) return painted;
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    return this.subjectAt(wx, wy);
  }

  subjectAt(wx: number, wy: number): Subject {
    const node = this.nodeAt(wx, wy);
    if (node) return { type: "node", ref: node };
    const note = this.noteAt(wx, wy);
    if (note) return { type: "note", ref: note };
    let best: number | null = null;
    let bestDistance = 9;
    for (const e of this.geom || []) {
      const d = distanceToPath(e.points, wx, wy);
      if (d < bestDistance) {
        best = e.i;
        bestDistance = d;
      }
    }
    if (best !== null) return { type: "edge", ref: best };
    const group = innermostFrameAt(this.frames || {}, wx, wy);
    return group ? { type: "group", ref: group } : { type: null, ref: null };
  }

  subjectOf(node: Element | null): Subject {
    if (!node?.closest) return { type: null, ref: null };
    const box = node.closest(".node-box") as HTMLElement | null;
    if (box) return { type: "node", ref: box.dataset.id ?? null };
    const sticky = node.closest(".note-box:not(.peek)") as HTMLElement | null;
    if (sticky) return { type: "note", ref: sticky.dataset.noteId ?? null };
    for (const [i, els] of this.edgeEls)
      if (els.hit === node || els.line === node || els.label === node)
        return { type: "edge", ref: i };
    for (const [id, f] of this.frameEls)
      if (
        f.hit === node ||
        f.label === node ||
        f.tag === node ||
        f.rect === node ||
        (f.icon && f.icon === node)
      )
        return { type: "group", ref: id };
    return { type: null, ref: null };
  }

  cancel() {
    if (this.marquee) {
      this.marquee.rect.remove();
      this.marquee = null;
    }
    if (this.wire) {
      this.wire.line.remove();
      this.clearWireTarget();
      this.wire = null;
    }
    if (this.bowDrag) {
      this.h.onBowPreview?.(this.bowDrag.key, this.bowDrag.original || 0);
      this.bowDrag = null;
    }
    if (this.tip) {
      const t = this.tip;
      this.tip = null;
      this.clearTip(t);
      this.h.onPortPreview?.(t.key, t.end, t.original);
      this.placeEndHandles();
    }
    if (this.noteDrag) {
      this.noteDrag = null;
      this.clearNoteDropTarget();
      this.layers.edges.before(this.layers.notes);
      this.render(this.model);
    }
    if (this.drag) {
      this.drag = null;
      this.render(this.model);
    }
  }

  // ---------------------------------------------------------------- marquee

  moveMarquee(ev: PointerEvent) {
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    const m = this.marquee;
    m.x1 = wx;
    m.y1 = wy;
    m.moved = true;
    const r = [
      Math.min(m.x0, m.x1),
      Math.min(m.y0, m.y1),
      Math.max(m.x0, m.x1),
      Math.max(m.y0, m.y1),
    ];
    m.rect.setAttribute("x", r[0]);
    m.rect.setAttribute("y", r[1]);
    m.rect.setAttribute("width", r[2] - r[0]);
    m.rect.setAttribute("height", r[3] - r[1]);
    const hit = Object.entries(this.boxes)
      .filter(([, b]) => overlaps(b, r))
      .map(([id]) => id);
    this.multi = m.add ? new Set([...m.base, ...hit]) : new Set(hit);
    this.renderSelection();
  }

  endMarquee() {
    const m = this.marquee;
    this.marquee = null;
    m.rect.remove();
    if (!m.moved) return;
    this.selectNodes([...this.multi]);
  }

  // ---------------------------------------------------------------- moving nodes

  // Every node a group draws around, its nested groups included. A group has no position of its
  // own — its frame is computed from what it contains — so moving one means moving these.
  nodesInGroup(gid: string): string[] {
    const wanted = new Set([gid]);
    const groups = this.model.doc.groups || [];
    for (let added = true; added; ) {
      added = false;
      for (const g of groups)
        if (g.parent && wanted.has(g.parent) && !wanted.has(g.id)) {
          wanted.add(g.id);
          added = true;
        }
    }
    return this.model.doc.nodes
      .filter((n: any) => n.group && wanted.has(n.group) && this.boxes[n.id])
      .map((n: any) => n.id as string);
  }

  startGroupDrag(gid: string, ev: PointerEvent) {
    if (ev.button !== 0 || this.space) return;
    ev.stopPropagation();
    this.select("group", gid);
    const ids = this.nodesInGroup(gid);
    if (!ids.length) return;
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    this.drag = {
      id: gid,
      ids,
      kind: "group",
      moved: false,
      offsets: Object.fromEntries(
        ids.map((n) => [n, [wx - this.boxes[n][0], wy - this.boxes[n][1]]]),
      ),
    };
    this.capture(ev);
  }

  startDrag(id: string, ev: PointerEvent) {
    if (ev.button !== 0 || this.space) return;
    ev.stopPropagation();
    if (ev.shiftKey || ev.ctrlKey || ev.metaKey) {
      this.toggleNode(id);
      return;
    }
    if (!this.multi.has(id)) this.select("node", id);
    else if (this.selection.ref !== id) {
      this.selection = { type: "node", ref: id };
      this.emitSelection();
    }
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    const ids = [...this.multi];
    this.drag = {
      id,
      ids,
      moved: false,
      offsets: Object.fromEntries(
        ids.map((n) => [n, [wx - this.boxes[n][0], wy - this.boxes[n][1]]]),
      ),
    };
    this.capture(ev);
  }

  moveDrag(ev: PointerEvent) {
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    this.drag.moved = true;
    this.drag.at = [wx, wy];
    this.drag.client = [ev.clientX, ev.clientY];
    for (const id of this.drag.ids) {
      const b = this.boxes[id];
      const off = this.drag.offsets[id];
      b[0] = Math.round(wx - off[0]);
      b[1] = Math.round(wy - off[1]);
      this.nodeEls.get(id)?.setAttribute("transform", `translate(${b[0]} ${b[1]})`);
    }
    const moving = new Set(this.drag.ids);
    // Frames follow their members, so an edge to a group moves with any drag.
    this.frames = groupFrames(this.model.doc, this.boxes) as Record<string, Box>;
    this.geom = edgeGeometry(
      this.model.doc,
      this.boxes,
      this.model.bows || {},
      this.model.ports || {},
      this.frames,
    );
    for (const e of this.geom) {
      const toGroup = !this.boxes[e.from] || !this.boxes[e.to];
      if (!toGroup && !moving.has(e.from) && !moving.has(e.to)) continue;
      const els = this.edgeEls.get(e.i);
      if (!els) continue;
      const d = pathOf(e.points);
      els.line.setAttribute("d", d);
      els.hit.setAttribute("d", d);
      if (els.label) {
        els.label.setAttribute("x", e.labelAt[0]);
        els.label.setAttribute("y", e.labelAt[1]);
        els.label.setAttribute("text-anchor", e.labelAnchor);
      }
    }
    this.placeEndHandles();
    this.repaintFrames();
    this.repaintAnchored();
  }

  /**
   * An anchored note follows its target while the pointer is still down. Nothing is written:
   * the offset has not changed, only where the target is.
   */
  repaintAnchored() {
    if (!this.notesVisible()) this.renderNoteMarkers();
    for (const { note: n } of this.notesToDraw()) {
      if (!n.anchor) continue;
      const b = this.noteBoxes[n.id];
      if (!b) continue;
      const [x, y] = this.noteOrigin(n);
      b[0] = x;
      b[1] = y;
      this.noteEls.get(n.id)?.setAttribute("transform", `translate(${x} ${y})`);
      this.redrawLeader(n.id);
    }
  }

  repaintFrames() {
    const frames = groupFrames(this.model.doc, this.boxes) as Record<string, Box>;
    // Kept, not just drawn: a note anchored to a group reads its frame back from here while
    // the drag is still running.
    this.frames = frames;
    for (const [id, els] of this.frameEls) {
      const f = frames[id];
      if (!f) continue;
      for (const r of [els.under, els.rect, els.hit]) {
        if (!r) continue;
        r.setAttribute("x", f[0]);
        r.setAttribute("y", f[1]);
        r.setAttribute("width", f[2]);
        r.setAttribute("height", f[3]);
      }
      if (els.icon) {
        els.icon.setAttribute("x", f[0] + 12);
        els.icon.setAttribute("y", f[1] + FRAME_ICON_DY);
      }
      els.label.setAttribute("x", f[0] + els.labelDx);
      els.label.setAttribute("y", f[1] + 19);
      els.tag.setAttribute("x", f[0] + els.tagDx);
      els.tag.setAttribute("y", f[1] + 19);
    }
    this.placeFrameDots();
  }

  endDrag() {
    const { ids, moved, kind, at, client } = this.drag;
    this.drag = null;
    if (!moved) return;
    // Dragging a node drops it into whatever frame it lands in. Dragging a group carries its
    // members with it, so they keep the group they already had — the whole point of the gesture
    // is that the grouping does not change.
    const held = new Map(this.model.doc.nodes.map((n: any) => [n.id, n.group ?? null]));
    const frames = groupFrames(this.model.doc, this.boxes) as Record<string, Box>;
    const moves = ids.map((id: string) => {
      const b = this.boxes[id];
      return {
        id,
        x: b[0],
        y: b[1],
        group:
          kind === "group"
            ? (held.get(id) ?? null)
            : innermostFrameAt(frames, b[0] + b[2] / 2, b[1] + b[3] / 2),
      };
    });
    this.h.onMove?.(moves);
    // Dragging a frame moves the group; a group is wired from the port dots its frame shows
    // when selected. Someone who drags off a frame and lets go on a component was trying to
    // wire it, so the canvas moves the group (the right thing for that gesture) and says how.
    if (kind === "group" && at) {
      // Only a component the group does not contain counts: its own members travel with the
      // pointer, so ending on one of those is an ordinary move and says nothing.
      const inside = new Set(ids);
      const over = this.model.doc.nodes.some((n: any) => {
        if (inside.has(n.id)) return false;
        const b = this.boxes[n.id];
        return b && at[0] >= b[0] && at[0] <= b[0] + b[2] && at[1] >= b[1] && at[1] <= b[1] + b[3];
      });
      if (over) this.h.onFrameWire?.(client?.[0] ?? 0, client?.[1] ?? 0);
    }
  }

  // ---------------------------------------------------------------- edges

  startBow(edge: any, ev: PointerEvent) {
    this.bowDrag = {
      key: edge.key,
      from: edge.from,
      to: edge.to,
      moved: false,
      original: this.model.bows?.[edge.key] || 0,
    };
    this.capture(ev);
  }

  moveBow(ev: PointerEvent) {
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    const ends = this.model.ports?.[this.bowDrag.key] ?? null;
    const value = bowAt(this.boxes, this.bowDrag.from, this.bowDrag.to, wx, wy, ends, this.frames);
    this.bowDrag.moved = true;
    this.bowDrag.value = value;
    this.h.onBowPreview?.(this.bowDrag.key, value);
  }

  endBow() {
    const { key, moved, value } = this.bowDrag;
    this.bowDrag = null;
    if (moved) this.h.onBow?.(key, value);
  }

  startTip(i: number, end: EdgeEnd, ev: PointerEvent) {
    const e = (this.geom || []).find((g) => g.i === i);
    if (!e) return;
    const line = el("path", { class: "wire", d: "" });
    this.layers.overlay.append(line);
    this.tip = {
      i,
      end,
      key: e.key,
      own: end === "from" ? e.from : e.to,
      other: end === "from" ? e.to : e.from,
      // The end that stays put, as it is drawn now: the preview line starts there.
      fixed: end === "from" ? e.points[e.points.length - 1] : e.points[0],
      original: this.model.ports?.[e.key]?.[end] ?? null,
      line,
      port: null,
      target: null,
      at: null,
      moved: false,
    };
    this.capture(ev);
  }

  moveTip(ev: PointerEvent) {
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    const t = this.tip;
    const b = this.boxOf(t.own);
    if (!b) return;
    t.moved = true;
    t.at = [wx, wy];
    // Inside its own box, or within reach of the border: the end is being placed on that box.
    const dx = Math.max(b[0] - wx, 0, wx - (b[0] + b[2]));
    const dy = Math.max(b[1] - wy, 0, wy - (b[1] + b[3]));
    const near = Math.hypot(dx, dy) <= PORT_REACH / this.view.k;
    // A frame end is placed only near its outline: well inside the frame is a drop on what the
    // group holds, or on the group itself, which leaves the end where it is.
    const rim = Math.min(wx - b[0], b[0] + b[2] - wx, wy - b[1], b[1] + b[3] - wy);
    const onOwn = near && (Boolean(this.boxes[t.own]) || rim <= PORT_REACH / this.view.k);
    const port: Port | null = onOwn ? (portAt(b, wx, wy) as Port) : null;
    const target = onOwn ? null : this.endAt(wx, wy, t.other);
    const samePort =
      (port === null && t.port === null) ||
      (port !== null && t.port !== null && port.side === t.port.side && port.t === t.port.t);
    t.port = port;
    if (!samePort) this.h.onPortPreview?.(t.key, t.end, port ?? t.original);
    this.endEl(t.own)?.classList.toggle("port-target", Boolean(port));
    if (target !== t.target) {
      this.endEl(t.target)?.classList.remove("wire-target");
      this.endEl(target)?.classList.add("wire-target");
      t.target = target;
    }
    if (port) t.line.setAttribute("d", "");
    else t.line.setAttribute("d", `M${t.fixed[0]} ${t.fixed[1]} L${wx} ${wy}`);
    t.line.classList.toggle("live", Boolean(target));
    this.placeEndHandles();
  }

  clearTip(t: any) {
    t.line.remove();
    this.endEl(t.own)?.classList.remove("port-target");
    this.endEl(t.target)?.classList.remove("wire-target");
  }

  finishTip() {
    const t = this.tip;
    this.tip = null;
    this.clearTip(t);
    const unchanged =
      t.port && t.original && t.port.side === t.original.side && t.port.t === t.original.t;
    if (t.moved && t.port && !unchanged) this.h.onPort?.(t.key, t.end, t.port);
    else {
      if (t.moved) this.h.onPortPreview?.(t.key, t.end, t.original);
      if (t.moved && t.target) this.h.onReconnect?.(t.i, t.end, t.target);
    }
    this.placeEndHandles();
  }

  startWire(from: string, ev: PointerEvent, side: PortSide | null = null) {
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    const b = this.boxOf(from);
    // From a port dot the wire starts on that dot; otherwise from the middle of the box.
    const start = side && b ? portDotAt(b, side) : null;
    const [sx, sy] = start ?? [wx, wy];
    const line = el("path", { class: "wire", d: `M${sx} ${sy} L${wx} ${wy}` });
    this.layers.overlay.append(line);
    this.wire = { from, line, x: wx, y: wy, target: null, side, start };
    this.endEl(from)?.classList.add("wire-source");
    this.capture(ev);
  }

  moveWire(ev: PointerEvent) {
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    const b = this.boxOf(this.wire.from) ?? [wx, wy, 0, 0];
    const [sx, sy] = this.wire.start ?? [b[0] + b[2] / 2, b[1] + b[3] / 2];
    this.wire.line.setAttribute("d", `M${sx} ${sy} L${wx} ${wy}`);
    this.wire.x = wx;
    this.wire.y = wy;
    const target = this.endAt(wx, wy, this.wire.from);
    if (target === this.wire.target) return;
    this.clearWireTarget();
    this.wire.target = target;
    this.endEl(target)?.classList.add("wire-target");
    this.wire.line.classList.toggle("live", !!target);
  }

  clearWireTarget() {
    for (const box of this.nodeEls.values()) box.classList.remove("wire-target");
    for (const f of this.frameEls.values()) f.rect.classList.remove("wire-target");
  }

  endWire() {
    const wire = this.wire;
    const { from, line, target, side, start } = wire;
    this.wire = null;
    line.remove();
    this.clearWireTarget();
    this.endEl(from)?.classList.remove("wire-source");
    if (!target && side && start) {
      // Let go on nothing, far enough from the dot to be a gesture rather than a slip.
      const { x, y } = wire;
      const moved = Math.hypot(x - start[0], y - start[1]) * this.view.k;
      if (moved > 16 && !this.endAt(x, y)) {
        this.h.onWireOut?.(from, side, start, [x, y], this.toScreen(x, y));
      }
      return;
    }
    if (!target || target === from) return;
    // Drawn from a dot: that side on the source, and the target's side that faces the dot.
    const tb = this.boxOf(target);
    const ends: EdgePorts | undefined =
      side && start && tb
        ? { from: { side, t: 0.5 }, to: { side: facingSide(tb, start), t: 0.5 } }
        : undefined;
    this.h.onConnect?.(from, target, ends);
  }

  // ---------------------------------------------------------------- editing a label in place

  editLabel(kind: string, ref: string | number) {
    this.closeEditor();
    if (kind !== "node" || !this.multi.has(ref as string))
      this.select(kind as Subject["type"], ref);
    const current = this.h.labelOf ? this.h.labelOf(kind, ref) : "";
    if (current === null || current === undefined) return;
    // A note holds a paragraph, so it gets a text area laid exactly over the note body in the
    // same type at the same zoom: what is typed sits where it will be drawn. Everything else on
    // the canvas is a one-line name and keeps the one-line field.
    if (kind === "note") return this.editNote(ref as string, current);
    let anchor: [number, number];
    let width: number;
    if (kind === "node") {
      const b = this.boxes[ref as string];
      if (!b) return;
      anchor = this.toScreen(b[0] + b[2] / 2, b[1] + 44);
      width = Math.max(120, b[2] * this.view.k);
    } else if (kind === "edge") {
      const e = (this.geom || []).find((x) => x.i === ref);
      if (!e) return;
      // Over the edge's own label, so of two lanes the editor opens on the one clicked.
      width = 150;
      const at = this.toScreen(e.labelAt[0], e.labelAt[1] - 7);
      const shift =
        e.labelAnchor === "start" ? width / 2 : e.labelAnchor === "end" ? -width / 2 : 0;
      anchor = [at[0] + shift, at[1]];
    } else {
      const f = this.frames[ref as string];
      if (!f) return;
      anchor = this.toScreen(f[0] + 12, f[1] + 10);
      width = 170;
    }
    const wrap = this.svg.parentElement as HTMLElement;
    const r = wrap.getBoundingClientRect();
    const input = document.createElement("input");
    input.className = "inline-edit";
    input.type = "text";
    input.value = current;
    input.style.left = `${Math.round(anchor[0] - r.left - (kind === "group" ? 0 : width / 2))}px`;
    input.style.top = `${Math.round(anchor[1] - r.top)}px`;
    input.style.width = `${Math.round(width)}px`;
    const finish = this.attachEditor(input, kind, ref, current);
    input.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Enter") finish(true);
      if (ev.key === "Escape") finish(false);
    });
    wrap.append(input);
    input.focus();
    input.select();
  }

  /** Shared ending for both editors: remove, forget, and report the value if it changed. */
  private attachEditor(
    field: HTMLInputElement | HTMLTextAreaElement,
    kind: string,
    ref: string | number,
    current: string,
  ) {
    let done = false;
    const finish = (commit: boolean) => {
      if (done) return;
      done = true;
      field.remove();
      this.editor = null;
      // A note keeps its line breaks and its leading spaces; only trailing blank space goes.
      const value = kind === "note" ? field.value.replace(/\s+$/, "") : field.value.trim();
      if (commit && value !== current) this.h.onLabel?.(kind, ref, value);
    };
    field.addEventListener("blur", () => finish(true));
    this.editor = { input: field, finish };
    return finish;
  }

  /**
   * The note editor: a text area sitting exactly on the note body, in the note's own type and
   * padding at the current zoom, so writing and reading look the same. Enter makes a new line,
   * Ctrl/Cmd Enter or clicking away keeps it, Escape throws the edit away.
   */
  editNote(id: string, current: string) {
    const b = this.noteBoxes[id];
    if (!b) return;
    const k = this.view.k;
    const [sx, sy] = this.toScreen(b[0], b[1]);
    const wrap = this.svg.parentElement as HTMLElement;
    const r = wrap.getBoundingClientRect();
    const area = document.createElement("textarea");
    area.className = "inline-edit note-edit";
    area.value = current;
    area.spellcheck = false;
    // The reader caps a note at the same length (layout-sidecar.ts), so stopping here is what
    // keeps what you typed and what comes back the same text.
    area.maxLength = NOTE_MAX_TEXT;
    area.style.left = `${Math.round(sx - r.left)}px`;
    area.style.top = `${Math.round(sy - r.top)}px`;
    area.style.width = `${Math.round(b[2] * k)}px`;
    area.style.height = `${Math.round(b[3] * k)}px`;
    area.style.fontSize = `${(NOTE_FONT * k).toFixed(2)}px`;
    area.style.lineHeight = `${(NOTE_LINE * k).toFixed(2)}px`;
    area.style.padding = `${((NOTE_PAD - 2) * k).toFixed(2)}px ${(NOTE_PAD * k).toFixed(2)}px`;
    const finish = this.attachEditor(area, "note", id, current);
    area.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Escape") return finish(false);
      // Enter is a newline here, which is the whole point; the modifier is how you get out.
      if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
        ev.preventDefault();
        finish(true);
      }
    });
    wrap.append(area);
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  }

  closeEditor() {
    if (this.editor) this.editor.finish(false);
  }

  // ---------------------------------------------------------------- export

  cssVar(name: string) {
    return getComputedStyle(this.svg).getPropertyValue(name).trim();
  }

  resolveVars(text: string) {
    return text.replace(/var\((--[a-z0-9-]+)\)/gi, (whole, name) => this.cssVar(name) || whole);
  }

  bounds(pad = 28): Box {
    let bb: { x: number; y: number; width: number; height: number } | null;
    try {
      bb = this.viewport.getBBox();
    } catch {
      bb = null;
    }
    if (!bb?.width || !bb.height) {
      const boxes = Object.values(this.boxes || {});
      if (!boxes.length) return [0, 0, 320, 200];
      const x0 = Math.min(...boxes.map((b) => b[0]));
      const y0 = Math.min(...boxes.map((b) => b[1]));
      const x1 = Math.max(...boxes.map((b) => b[0] + b[2]));
      const y1 = Math.max(...boxes.map((b) => b[1] + b[3]));
      bb = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    }
    return [
      Math.round(bb.x - pad),
      Math.round(bb.y - pad),
      Math.round(bb.width + pad * 2),
      Math.round(bb.height + pad * 2),
    ];
  }

  toSVG({ background = true } = {}) {
    const [x, y, w, h] = this.bounds();
    const clone = this.viewport.cloneNode(true) as SVGGElement;
    clone.removeAttribute("transform");
    // With the toggle off, nothing about a note leaves the canvas — not a peek, not a note
    // someone pinned open to read. The toggle is what the picture says, and it says no.
    if (!this.notesVisible()) {
      const layer = clone.querySelector(".layer-notes");
      if (layer) layer.textContent = "";
    }
    for (const n of clone.querySelectorAll(
      ".port-dot, .end-handle, .edge-hit, .frame-hit, .marquee, .wire, .note-grip, .note-grip-hit, .note-text.empty, .frame-label:empty, .layer-note-markers",
    ))
      n.remove();
    for (const n of clone.querySelectorAll(".selected, .primary"))
      n.classList.remove("selected", "primary");
    // A hex tint leaves as plain colours, the way the server render writes it: a file that
    // leaves the page must not depend on a custom property only the canvas sets.
    for (const n of clone.querySelectorAll<SVGElement>('.frame[data-tint="hex"]')) {
      const c = n.style.getPropertyValue("--tint-hex").trim();
      n.setAttribute("style", tintPaint(c, n.getAttribute("data-strength"))?.style ?? "");
    }
    const defs = this.defs.cloneNode(true) as SVGDefsElement;
    defs.querySelector(`#${NODE_SHADOW}`)?.remove();
    const style = `<style>${[
      ".frame{fill:none;stroke:var(--frame);stroke-width:1;stroke-dasharray:6 4}",
      ".frame-label{font-size:11px;font-family:var(--mono);fill:var(--muted)}",
      ".frame-kind{font-size:10px;font-family:var(--mono);fill:var(--muted);opacity:0.75}",
      ".frame-icon{color:var(--muted)}",
      ".frame-under{fill:var(--bg);stroke:none}",
      // Named tints are tokens that resolve to this page's theme below; a hex tint is inline.
      ...Object.keys(TINT).map(
        (k) => `.frame[data-tint="${k}"]{stroke:var(--tint-${k});fill:var(--tint-${k}-fill)}`,
      ),
      ".edge{stroke:var(--edge);stroke-width:1.4;fill:none}",
      ".edge.async{stroke-dasharray:6 4}",
      ".edge-label{font-size:12px;fill:var(--muted);paint-order:stroke;stroke:var(--bg);stroke-width:3px}",
      ".node-box text.name{font-size:14px;font-weight:500;fill:var(--ink)}",
      ".node-box text.comp{font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;fill:var(--muted)}",
      ".glyph{color:var(--ink)}",
      ".badge-error{fill:var(--err)}.badge-warn{fill:var(--warn)}",
      `.note-text{font-size:${NOTE_FONT}px;fill:var(--ink)}`,
      ".note-leader{stroke:var(--f-note-line);stroke-width:1;stroke-dasharray:2 3;fill:none;opacity:0.55}",
    ].join("")}</style>`;
    const ground = background
      ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--bg)"/>`
      : "";
    return this.resolveVars(
      `<svg xmlns="${NS}" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}" font-family="ui-sans-serif, system-ui, sans-serif">${style}${defs.outerHTML}${ground}${clone.outerHTML}</svg>\n`,
    );
  }
}
