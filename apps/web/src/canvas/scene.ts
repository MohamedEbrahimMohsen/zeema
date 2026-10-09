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

import {
  groupCaption,
  groupsCoveredBy,
  groupTitle,
  nodeCount,
  nodeDeadLetter,
  nodeLines,
  nodeRef,
  refLabel,
} from "@zeema/core/document";
import {
  authAt,
  bowAt,
  dropWaypoint,
  edgeGeometry,
  edgePath,
  frameCaptions,
  framesOuterFirst,
  framesUnderTint,
  groupFrames,
  innermostFrameAt,
  moveSegment,
  portAt,
  refAt,
  refitEnds,
  viaOf,
} from "@zeema/core/geometry";
import {
  authGlyph,
  authGlyphMarkup,
  CAPTION_LINE,
  FRAME_ICON_SHIFT,
  nodeDecor,
  nodeText,
  refGlyphMarkup,
  TINT,
  TINT_FILL_ALPHA,
  tintFill,
  tintPaint,
} from "@zeema/core/render";
import {
  anchorKey,
  anchorTarget,
  type EdgePath,
  type EdgePorts,
  type FrameStyle,
  frameIconKey,
  LABEL_MAX_OFFSET,
  type LabelOffset,
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
  type Routing,
} from "@/lib/layout-sidecar";
import { own } from "@/lib/own";
import { type Rect, sweptEdges } from "./edge-set";
import { adjacencyOf, flowFrom, nodesAt } from "./flow-lens";
import { dropPort, frameTargetAt } from "./frame-target";
import {
  ancestorsOf,
  groupAndDescendants,
  regroupTarget,
  SHIFT_GRACE,
  shiftHeld,
} from "./group-info";
import { findGuides, type GuideLine } from "./guides";
import { anchorOffset, coversTarget, noteDropTarget, sameAnchor } from "./note-anchor";
import { type DimEdges, dimmed } from "./prefs";

// The dim rule and its threshold live with the other canvas habits (prefs.ts).
export { DIM_EDGES_OVER, type DimEdges } from "./prefs";

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
/**
 * Everything selected, as one selection: components, groups and edges together. A plain click
 * replaces it; Ctrl/Cmd or Shift with a click toggles one item in or out, as in draw.io.
 */
export type Picked = { nodes: Set<string>; groups: Set<string>; edges: Set<number> };

export type Model = {
  doc: any;
  catalogue: any;
  icons: Record<string, string>;
  positions: Record<string, [number, number]>;
  sizes: Record<string, [number, number]>;
  /** Hand-adjusted edge paths by edge key, from the sidecar: a bow, or waypoints. */
  bows: Record<string, EdgePath>;
  /** Where an edge's ends meet their boxes, by edge key, from the sidecar. */
  ports?: Record<string, EdgePorts>;
  /** Where edge labels were dragged, by edge key: offsets from the automatic place. */
  labels?: Record<string, LabelOffset>;
  notes: Note[];
  /** Group tint and icon by group id, from the sidecar. Absent means the default frame. */
  frameStyles?: Record<string, FrameStyle>;
  /** Component tints by node id, from the sidecar. Absent means the neutral card. */
  nodeTints?: Record<string, NodeTint>;
  /** How edges are drawn, from the sidecar. Absent means the engine's default. */
  routing?: Routing;
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
// How far, in screen pixels, the pointer travels before a press on a component is a drag.
const DRAG_THRESHOLD = 3;
// How close, in screen pixels, a dragged selection has to come to lining up with another box
// before it snaps into line and the guide shows (draw.io's). Alt held turns it off.
const GUIDE_SNAP = 6;

export type Handlers = {
  onSelect?: (selection: Subject, picked: Picked) => void;
  /**
   * A drag of the selection ended. `into` is set when it was let go somewhere that regroups it
   * (see `regroupTarget`): the selected components and groups move into `group` (null: the top
   * level), in the same step.
   */
  onMove?: (
    moves: Array<{ id: string; x: number; y: number }>,
    into: { group: string | null; nodes: string[]; groups: string[] } | null,
  ) => void;
  /**
   * A wire was let go on another component, or on a group's frame (`to` is then the group id: an
   * edge to the group as a unit). `ends` is set when it was drawn from a port dot.
   */
  onConnect?: (from: string, to: string, ends?: EdgePorts) => void;
  /**
   * An edge's path is being dragged: draw it with this entry (null: the automatic path). A curve
   * takes a bow; an orthogonal edge takes waypoints, the corners of the path being dragged.
   */
  onPathPreview?: (key: string, value: EdgePath | null, ends?: EdgePorts) => void;
  /**
   * An edge's path was let go: keep this entry (null: drop it, back to the automatic path).
   * `ends` holds each end the drag moved to another side of its box (`refitEnds`): its new port,
   * written in the same step.
   */
  onPath?: (key: string, value: EdgePath | null, ends?: EdgePorts) => void;
  /**
   * An edge's label was dragged and let go: keep it this far from its automatic place (world px,
   * whole), or null to put it back there.
   */
  onLabelMove?: (key: string, offset: LabelOffset | null) => void;
  /** An end handle is being dragged along its own box: draw the edge with this port (null: none). */
  onPortPreview?: (key: string, end: EdgeEnd, port: Port | null) => void;
  /** An end handle was let go on its own box's border: attach that end there. */
  onPort?: (key: string, end: EdgeEnd, port: Port) => void;
  /**
   * An end handle was let go on another component or a group's frame: move that end there,
   * attached at `port`, the point on the new box's border nearest where it was let go.
   */
  onReconnect?: (index: number, end: EdgeEnd, nodeId: string, port: Port | null) => void;
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
  /**
   * The pointer is over a component's box, or a group's label strip or border band (null: over
   * none of them, or a gesture began). Sent again as it moves, so the page knows where it is.
   */
  onHover?: (
    at: {
      type: "node" | "group" | "edge" | "ref";
      id: string;
      clientX: number;
      clientY: number;
    } | null,
  ) => void;
  /**
   * The colour of a node's reference disc (`ref`, another design): the page knows the state of
   * the reference, the scene does not. Absent: muted, as the server render draws it.
   */
  refColor?: (design: string, version: number | "head") => string;
  /** A node's reference disc was clicked (shift: open the design in a new tab). */
  onRefClick?: (nodeId: string, shift: boolean) => void;
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

const overlaps = (b: Box, r: number[]) =>
  b[0] < r[2] && b[0] + b[2] > r[0] && b[1] < r[3] && b[1] + b[3] > r[1];

function distanceToSegment(ax: number, ay: number, bx: number, by: number, x: number, y: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
  return Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
}

function distanceToPath(points: number[][], x: number, y: number, ortho = false) {
  if (ortho) {
    // An orthogonal edge: straight runs between its corners (the rounding is too small to matter).
    let best = Number.POSITIVE_INFINITY;
    for (let k = 1; k < points.length; k++)
      best = Math.min(
        best,
        distanceToSegment(points[k - 1][0], points[k - 1][1], points[k][0], points[k][1], x, y),
      );
    return best;
  }
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
  /** The selected components. Groups and edges selected beside them are the two sets below. */
  multi = new Set<string>();
  multiGroups = new Set<string>();
  multiEdges = new Set<number>();
  model!: Model;
  boxes: Record<string, Box> = {};
  frames: Record<string, Box> = {};
  /** Each group's caption as its frame is sized for it (lines, label strip), from the engine. */
  captions: Record<string, { lines: string[]; width: number; extra: number; strip: number }> = {};
  geom: any[] = [];
  drag: any = null;
  noteDrag: any = null;
  /** The marker the pointer is resting on, once it has rested long enough to mean it. */
  peek: string | null = null;
  private peekTimer: ReturnType<typeof setTimeout> | null = null;
  wire: any = null;
  bowDrag: any = null;
  /** An edge label being dragged off its automatic place (see `startLabelDrag`). */
  labelDrag: any = null;
  /** An edge's end handle being dragged: to a port on its own box, or onto another component. */
  tip: any = null;
  /** The selected edge's two end handles, [from, to], and which edge they belong to. */
  endHandles: SVGCircleElement[] = [];
  endHandlesFor: number | null = null;
  /** The alignment guides a drag shows: a vertical and a horizontal line, in the overlay. */
  guideEls: { g: SVGGElement; x: SVGLineElement; y: SVGLineElement } | null = null;
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
  /** The group whose card the pointer is on, from its label strip or border band. */
  frameHover: string | null = null;
  /**
   * The neighbourhood highlight. `adjacency` (node id -> the indices of its edges, both ways) is
   * rebuilt with the edges, so lighting a node costs its degree. `lightHover` is what the pointer
   * is on, from the same events as the hover card; `lightPin` is what a click pinned, which holds
   * until Esc, a click on empty canvas, or a click on something else.
   */
  adjacency = new Map<string, number[]>();
  lightHover: Subject | null = null;
  lightPin: Subject | null = null;
  /** The pin is the flow lens (`trace`): the pinned component's whole path, not its neighbours. */
  lightTrace = false;
  /** Whether the edges draw at reduced ink (see DIM_EDGES_OVER), as the page last said. */
  dimEdges: DimEdges = "auto";
  private litEls: Element[] = [];
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
    return frameTargetAt(this.frames, wx, wy, this.view.k, except, this.strips());
  }

  /**
   * How edges are routed: the design's style, the group captions to keep clear, and the notes
   * on screen, which edge labels stay off.
   */
  routeOptions() {
    const notes = this.notesVisible() ? Object.values(this.noteBoxes || {}) : [];
    // While a label is being dragged, the offset it would get is drawn, so the others dodge it.
    const labels = this.labelDrag?.labels ?? this.model.labels ?? {};
    return { routing: this.model.routing, captions: this.captions, labelAvoid: notes, labels };
  }

  /** Each group's label strip height, for the frame targets. */
  strips() {
    const out: Record<string, number> = {};
    for (const [id, c] of Object.entries(this.captions)) out[id] = c.strip;
    return out;
  }

  /** The box an edge end names: a component's box, else a group's frame. */
  boxOf(id: string): Box | undefined {
    return this.boxes[id] ?? (Object.hasOwn(this.frames, id) ? this.frames[id] : undefined);
  }

  /** The port on `id`'s box (component or frame) nearest the world point an end was let go at. */
  dropPortOn(id: string, at: [number, number] | null): Port | null {
    const b = this.boxOf(id);
    if (!b || !at) return null;
    return dropPort(b, at[0], at[1], !this.boxes[id], this.view.k);
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
    const groupIds = new Set((model.doc.groups ?? []).map((g: any) => g.id as string));
    for (const id of [...this.multiGroups]) if (!groupIds.has(id)) this.multiGroups.delete(id);
    for (const i of [...this.multiEdges])
      if (i >= (model.doc.edges ?? []).length) this.multiEdges.delete(i);
    if (this.selection.type === "node" && !this.boxes[this.selection.ref as string])
      this.selection = { type: null, ref: null };
    this.captions = frameCaptions(model.doc, model.catalogue, model.frameStyles ?? {});
    this.frames = groupFrames(model.doc, this.boxes, this.captions) as Record<string, Box>;
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
    // The highlight survives a rebuild, unless what it is about went away with it.
    const gone = (sub: Subject | null) =>
      !sub ||
      (sub.type === "node" && !this.boxes[sub.ref as string]) ||
      (sub.type === "edge" && !this.edgeEls.has(sub.ref as number));
    if (gone(this.lightHover)) this.lightHover = null;
    if (gone(this.lightPin)) this.lightPin = null;
    this.applyLight();
  }

  // ---------------------------------------------------------------- neighbourhood highlight
  // Hovering a component lights it, its edges both ways (line, label, auth glyph, arrowhead) and
  // the components at their other ends; hovering an edge lights it and its two ends. An edge to a
  // group counts for every component inside it, and lights them all as its end. The svg carries
  // `lighting` and canvas.css fades every node, edge and note that is not `lit`, so only the lit
  // few are touched here. Group frames are never faded. A gesture that moves something (a drag, a
  // wire, a sweep) puts the highlight away until it ends; panning and zooming leave it be.
  //
  // The flow lens (`trace`) is a pin that lights a component's whole path instead: everything
  // upstream of it, or for a component nothing points at, everything downstream (flow-lens.ts).

  /** The pointer came onto (or left, with null) a component or an edge. */
  hoverLight(sub: Subject | null) {
    const same = sub?.type === this.lightHover?.type && sub?.ref === this.lightHover?.ref;
    this.lightHover = sub;
    if (!same && !this.lightPin) this.applyLight();
  }

  /** Pin the highlight on a component or an edge: it stays when the pointer leaves. */
  pin(sub: Subject) {
    this.lightPin = sub;
    this.lightTrace = false;
    this.applyLight();
  }

  /** Pin the flow lens on a component: its whole path lit, the rest faded. */
  trace(id: string) {
    if (!this.boxes[id]) return;
    this.lightPin = { type: "node", ref: id };
    this.lightTrace = true;
    this.applyLight();
  }

  /** Drop a pinned highlight. True when there was one, so Esc can stop there. */
  unpin() {
    if (!this.lightPin) return false;
    this.lightPin = null;
    this.lightTrace = false;
    this.applyLight();
    return true;
  }

  /** A gesture that moves or makes something: the highlight steps aside while it runs. */
  moving() {
    return !!(
      this.drag ||
      this.wire ||
      this.marquee ||
      this.noteDrag ||
      this.bowDrag ||
      this.labelDrag ||
      this.tip ||
      this.editor
    );
  }

  applyLight() {
    for (const n of this.litEls) n.classList.remove("lit");
    this.litEls = [];
    const sub = this.moving() ? null : (this.lightPin ?? this.lightHover);
    const on = Boolean(sub?.type);
    this.svg.classList.toggle("lighting", on);
    this.svg.classList.toggle("pinned", on && Boolean(this.lightPin));
    this.svg.classList.toggle("tracing", on && sub === this.lightPin && this.lightTrace);
    this.applyDim();
    if (!sub || !on) return;
    const doc = this.model?.doc;
    const edges = doc?.edges ?? [];
    let nodes = new Set<string>();
    let lines = new Set<number>();
    if (sub.type === "node" && sub === this.lightPin && this.lightTrace) {
      ({ nodes, edges: lines } = flowFrom(doc, sub.ref as string));
    } else {
      if (sub.type === "node") {
        nodes.add(sub.ref as string);
        for (const i of this.adjacency.get(sub.ref as string) ?? []) lines.add(i);
      } else if (sub.type === "edge") lines.add(sub.ref as number);
      for (const i of lines) {
        const e = edges[i];
        if (!e) continue;
        for (const id of nodesAt(doc, e.from)) nodes.add(id);
        for (const id of nodesAt(doc, e.to)) nodes.add(id);
      }
    }
    const lit = (n: Element | null | undefined) => {
      if (!n) return;
      n.classList.add("lit");
      this.litEls.push(n);
    };
    for (const id of nodes) lit(this.nodeEls.get(id));
    for (const i of lines) {
      const els = this.edgeEls.get(i);
      if (!els) continue;
      lit(els.line);
      lit(els.label);
      lit(els.auth);
    }
  }

  /** How the page wants the edges dimmed (the toolbar's toggle). */
  setDimEdges(mode: DimEdges) {
    this.dimEdges = mode;
    this.applyDim();
  }

  /**
   * Dim the edges and their labels (canvas.css, `dim-edges` on the svg; auth glyphs stay) when the
   * toggle says on, or says auto and the design has more than DIM_EDGES_OVER edges. While an edge
   * is selected, or one is being drawn or reconnected, every edge is at full ink.
   */
  applyDim() {
    const count = this.model?.doc?.edges?.length ?? 0;
    const want = dimmed(this.dimEdges, count);
    const working =
      Boolean(this.wire || this.tip) || this.selection.type === "edge" || this.multiEdges.size > 0;
    this.svg.classList.toggle("dim-edges", want && !working);
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
        // The frame's whole name (label · kind · id) for an exported picture's <title>; on the
        // canvas the hover card says it.
        "aria-label": groupTitle(this.model.catalogue, group),
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
      // A group reads as its label, else its kind's name ("VPC") in the same style; the kind id
      // and the group id are the hover card's (render.js draws the same words). The icon, when
      // the group has one and the catalogue can draw it, comes first and pushes the words right. A reference to an icon that is not there draws nothing.
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
      // A caption too long for the widest frame is set on two lines (frameCaption in core).
      const lines = this.captions[group.id]?.lines ?? [groupCaption(this.model.catalogue, group)];
      if (lines.length === 1) label.textContent = lines[0];
      else
        lines.forEach((line, k) => {
          const span = el("tspan", {
            x: f[0] + labelDx,
            y: f[1] + 19 + k * CAPTION_LINE,
          });
          span.textContent = line;
          label.append(span);
        });
      for (const target of [hit, label, icon]) {
        target?.addEventListener("pointerdown", (ev: any) => this.startGroupDrag(group.id, ev));
      }
      g.append(...(under ? [under] : []), rect, hit, ...(icon ? [icon] : []), label);
      this.frameEls.set(group.id, { under, rect, hit, icon, label, labelDx });
    }
  }

  renderEdges() {
    const g = this.layers.edges;
    g.textContent = "";
    this.edgeEls.clear();
    this.adjacency = adjacencyOf(this.model.doc);
    this.geom = edgeGeometry(
      this.model.doc,
      this.boxes,
      this.model.bows || {},
      this.model.ports || {},
      this.frames,
      this.routeOptions(),
    );
    const glyphs: Element[] = [];
    for (const e of this.geom) {
      const d = edgePath(e);
      // The hit paths sit in one group just before the line, so hovering any of them lifts it.
      const hits = el("g", { class: "edge-hits" });
      const line = el("path", {
        class: `edge${e.dashed ? " async" : ""}`,
        d,
        "marker-end": "url(#arrowhead)",
      });
      g.append(hits, line);
      const els: any = {
        hits,
        hitEls: [],
        line,
        key: e.key,
        from: e.from,
        to: e.to,
        label: null,
        auth: null,
      };
      this.setHits(els, e);
      this.hoverable(hits, "edge", String(e.i));
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
        // Dragged, it moves (see `startLabelDrag`); a click still only selects.
        t.addEventListener("pointerdown", (ev: any) => {
          if (ev.button !== 0 || this.space) return;
          ev.stopPropagation();
          if (ev.shiftKey || ev.ctrlKey || ev.metaKey) return this.toggle("edge", e.i);
          this.select("edge", e.i);
          this.startLabelDrag(e.i, ev);
        });
        g.append(t);
        els.label = t;
        this.hoverable(t, "edge", String(e.i));
      }
      // How the hop authenticates, as a glyph on the line beside the source end (the same
      // glyph and place as the server render). Appended after every edge (below), so a
      // neighbour's label, which can run past this end, never paints over it.
      const glyph = authGlyph(this.model.doc.edges?.[e.i]?.auth);
      if (glyph) {
        const [ax, ay] = authAt(e);
        const a = el("g", { class: "edge-auth", transform: `translate(${ax} ${ay})` });
        // A cloud's identity carries its mark: the component's icon symbol, defined once in
        // <defs> as a node's is. The markup itself is the server render's (authGlyphMarkup).
        const mark =
          glyph.icon && this.symbolFor(glyph.icon)
            ? `<use href="#ic-${glyph.icon}" width="24" height="24"/>`
            : null;
        a.innerHTML = authGlyphMarkup(glyph, mark);
        glyphs.push(a);
        els.auth = a;
      }
      this.edgeEls.set(e.i, els);
    }
    g.append(...glyphs);
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

  /** Whether a gesture is under way, during which no hover card should show. */
  busy() {
    return !!(
      this.drag ||
      this.wire ||
      this.marquee ||
      this.pan ||
      this.noteDrag ||
      this.bowDrag ||
      this.labelDrag ||
      this.tip ||
      this.editor
    );
  }

  /**
   * Report the pointer resting on (or leaving) a component's box, an edge or a group's label
   * strip: to the page, for the hover card, and to the neighbourhood highlight, so the two agree.
   */
  hoverable(target: Element, type: "node" | "group" | "edge" | "ref", id: string) {
    const subject = (): Subject | null =>
      type === "node" || type === "ref"
        ? { type: "node", ref: id }
        : type === "edge"
          ? { type: "edge", ref: Number(id) }
          : null;
    const report = (ev: PointerEvent) => {
      // A reference disc sits inside its box: the box must not take the report back.
      if (type === "ref") ev.stopPropagation();
      if (ev.buttons || this.busy()) {
        this.hoverLight(null);
        return this.h.onHover?.(null);
      }
      this.hoverLight(subject());
      this.h.onHover?.({ type, id, clientX: ev.clientX, clientY: ev.clientY });
    };
    target.addEventListener("pointerenter", report as EventListener);
    target.addEventListener("pointermove", report as EventListener);
    target.addEventListener("pointerleave", () => {
      this.hoverLight(null);
      this.h.onHover?.(null);
    });
  }

  /** Repaint every reference disc from `refColor`, without a rebuild (a summary came back). */
  paintRefs() {
    for (const disc of this.layers.nodes.querySelectorAll(".ref-glyph")) {
      const design = disc.getAttribute("data-ref") ?? "";
      const raw = disc.getAttribute("data-version") ?? "head";
      const version = raw === "head" ? "head" : Number(raw);
      disc.innerHTML = refGlyphMarkup(this.h.refColor?.(design, version));
    }
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
      const tinted = own(this.model.nodeTints ?? {}, n.id) as NodeTint | undefined;
      const fill = tinted ? tintFill(tinted.tint, tinted.strength) : null;
      // One card: the body and, when tinted, the tint over it. The front card is the box; a
      // stack's cards behind it are the same card, drawn fainter and never hit.
      const card = (into: Element, cls: string, x: number, y: number) => {
        into.append(
          el("rect", {
            class: cls,
            x,
            y,
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
        if (fill)
          into.append(
            el("rect", {
              class: "node-tint",
              x,
              y,
              width: b[2],
              height: b[3],
              rx: 12,
              stroke: fill.color,
              "stroke-width": 1,
              "stroke-dasharray": untyped ? "6 4" : null,
              style: `fill:${fill.color};fill-opacity:${fill.opacity}`,
            }),
          );
      };
      // N identical copies (nodeCount): the stack's cards behind the box, and the chip row (×N,
      // DLQ for a queue with a dead-letter queue), as the server render draws them (nodeDecor).
      // Decoration only: the box, its ports and its hit area are unchanged.
      const { doc, catalogue } = this.model;
      const stack = nodeDecor(b[2], b[3], {
        count: nodeCount(doc, n, catalogue),
        dlq: nodeDeadLetter(doc, n, catalogue),
      });
      if (stack)
        for (const s of stack.cards) {
          const layer = el("g", { class: "stack", opacity: s.opacity });
          card(layer, "stack-card", s.x, s.y);
          box.append(layer);
        }
      card(box, "body", 0, 0);
      // The two lines fitted to the box exactly as the server render fits them (nodeText in
      // @zeema/core/render). The whole text and the undrawn id are the box's accessible name;
      // hover is the page's card (onHover), not a native <title>, which is slow and plain.
      // An exported picture gets the <title> back (toSVG).
      const lines = nodeLines(this.model.catalogue, n);
      const text = nodeText(lines.name, lines.sub, b[2], lines.id, nodeRef(n) !== null);
      box.setAttribute("aria-label", text.title);
      this.hoverable(box, "node", n.id);
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
      for (const p of stack ? stack.chips : []) {
        const pill = el("rect", {
          class: "stack-chip",
          x: p.x,
          y: p.y,
          width: p.w,
          height: p.h,
          rx: p.rx,
          style: "fill:var(--panel);stroke:var(--node-line);stroke-width:1",
        });
        box.append(pill);
        const chip = el("text", {
          class: "stack-chip-t",
          x: p.tx,
          y: p.ty,
          "text-anchor": "middle",
          style: `font-family:var(--mono);font-size:${p.size}px;fill:var(--muted)`,
        });
        chip.textContent = p.text;
        box.append(chip);
      }
      // Another design this node stands for: a link disc in the bottom-right corner, where the
      // server render draws it (refAt), tinted by the reference's state (refColor). A click
      // target of its own, inside the box, so the box's hit area is what it was.
      const ref = nodeRef(n);
      if (ref) {
        const [rx, ry] = refAt(b[2], b[3]);
        const disc = el("g", {
          class: "ref-glyph",
          transform: `translate(${rx} ${ry})`,
          "data-ref": ref.design,
          "data-version": String(ref.version),
          role: "button",
          "aria-label": `References ${refLabel(ref)}`,
        });
        disc.innerHTML = refGlyphMarkup(this.h.refColor?.(ref.design, ref.version));
        disc.addEventListener("pointerdown", (ev: any) => {
          if (ev.button !== 0 || this.space) return;
          ev.stopPropagation();
        });
        disc.addEventListener("click", (ev: any) => {
          if (ev.button !== 0 || this.space) return;
          ev.stopPropagation();
          this.h.onRefClick?.(n.id, Boolean(ev.shiftKey));
        });
        disc.addEventListener("dblclick", (ev) => ev.stopPropagation());
        this.hoverable(disc, "ref", n.id);
        box.append(disc);
      }
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

  /**
   * The hit paths of one drawn edge. A curve (or an orthogonal edge with nothing to shape) has one,
   * along the whole line: dragging it bends the curve. An orthogonal edge has one per run, each
   * with the cursor that says which way it moves: up and down for a horizontal run, sideways for
   * a vertical one. Rebuilt whenever the edge is redrawn, because a drag can add runs.
   */
  setHits(els: any, e: any) {
    const ortho = e.ortho && !e.fixed;
    const shapes: Array<{ d: string; k: number | null; cursor: string }> = [];
    if (ortho)
      for (let k = 0; k < e.points.length - 1; k++) {
        const [p, q] = [e.points[k], e.points[k + 1]];
        const flat = Math.abs(p[1] - q[1]) < 0.5;
        shapes.push({
          d: `M${p[0]} ${p[1]} L${q[0]} ${q[1]}`,
          k,
          cursor: flat ? "ns-resize" : "ew-resize",
        });
      }
    else shapes.push({ d: edgePath(e), k: null, cursor: "" });
    // The same runs as last time: only the paths move, so a pointer over one keeps its hover.
    const same =
      els.hitEls.length === shapes.length &&
      els.hitEls.every((h: SVGElement, k: number) => h.dataset.cursor === shapes[k].cursor);
    if (same) {
      shapes.forEach((sh, k) => {
        els.hitEls[k].setAttribute("d", sh.d);
      });
      return;
    }
    els.hits.textContent = "";
    els.hitEls = shapes.map((sh) => {
      const hit = el("path", {
        class: "edge-hit",
        d: sh.d,
        style: sh.cursor ? `cursor:${sh.cursor}` : null,
      }) as SVGPathElement;
      hit.dataset.cursor = sh.cursor;
      hit.addEventListener("pointerdown", (ev: any) => {
        if (ev.button !== 0 || this.space) return;
        ev.stopPropagation();
        if (ev.shiftKey || ev.ctrlKey || ev.metaKey) return this.toggle("edge", e.i);
        this.select("edge", e.i);
        // Whatever the edge is drawn as now, not when this path was made.
        const drawn = (this.geom || []).find((g) => g.key === e.key) ?? e;
        this.startBow(drawn, ev, sh.k);
      });
      els.hits.append(hit);
      return hit;
    });
  }

  repaintEdges(bows: Record<string, EdgePath>, ports = this.model.ports || {}) {
    this.model.bows = bows;
    const geom = edgeGeometry(
      this.model.doc,
      this.boxes,
      bows,
      ports,
      this.frames,
      this.routeOptions(),
    );
    this.geom = geom;
    for (const e of geom) {
      const els = this.edgeEls.get(e.i);
      if (!els) continue;
      els.line.setAttribute("d", edgePath(e));
      this.setHits(els, e);
      if (els.label) {
        els.label.setAttribute("x", e.labelAt[0]);
        els.label.setAttribute("y", e.labelAt[1]);
        els.label.setAttribute("text-anchor", e.labelAnchor);
      }
      if (els.auth) {
        const [ax, ay] = authAt(e);
        els.auth.setAttribute("transform", `translate(${ax} ${ay})`);
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
    const sel =
      this.selection.type === "edge" && this.pickedCount() === 1
        ? (this.selection.ref as number)
        : null;
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
    // A selected edge puts every edge back at full ink.
    this.applyDim();
    for (const [id, node] of this.nodeEls) {
      node.classList.toggle("selected", this.multi.has(id));
      node.classList.toggle("primary", this.selection.type === "node" && this.selection.ref === id);
    }
    const picked = this.picked();
    for (const [i, e] of this.edgeEls) e.line.classList.toggle("selected", picked.edges.has(i));
    for (const [id, f] of this.frameEls) f.rect.classList.toggle("selected", picked.groups.has(id));
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
    const gid =
      this.selection.type === "group" && this.pickedCount() === 1
        ? (this.selection.ref as string)
        : null;
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
    this.multiGroups = type === "group" ? new Set([ref as string]) : new Set();
    this.multiEdges = type === "edge" ? new Set([ref as number]) : new Set();
    this.emitSelection();
  }

  selectNodes(ids: string[], primary: string | null = null) {
    this.selectMany({ nodes: ids }, primary);
  }

  /** A whole selection at once (Ctrl+A, a marquee). The last component is the one the fields edit. */
  selectMany(
    {
      nodes = [],
      groups = [],
      edges = [],
    }: { nodes?: string[]; groups?: string[]; edges?: number[] },
    primary: string | null = null,
  ) {
    this.multi = new Set(nodes);
    this.multiGroups = new Set(groups);
    this.multiEdges = new Set(edges);
    const head =
      primary && this.multi.has(primary) ? primary : nodes.length ? nodes[nodes.length - 1] : null;
    this.selection = head
      ? { type: "node", ref: head }
      : groups.length
        ? { type: "group", ref: groups[groups.length - 1] }
        : edges.length
          ? { type: "edge", ref: edges[edges.length - 1] }
          : { type: null, ref: null };
    this.emitSelection();
  }

  /**
   * The selection as sets, with the primary subject folded in: some commands set `selection`
   * alone (a new group, a rename), and that still counts as selected.
   */
  picked(): Picked {
    const p: Picked = {
      nodes: new Set(this.multi),
      groups: new Set(this.multiGroups),
      edges: new Set(this.multiEdges),
    };
    const { type, ref } = this.selection;
    if (type === "node" && ref !== null) p.nodes.add(ref as string);
    if (type === "group" && ref !== null) p.groups.add(ref as string);
    if (type === "edge" && ref !== null) p.edges.add(ref as number);
    return p;
  }

  pickedCount() {
    const p = this.picked();
    return p.nodes.size + p.groups.size + p.edges.size;
  }

  /** Ctrl/Cmd or Shift with a click: one component, group or edge in or out of the selection. */
  toggle(type: Subject["type"], ref: Subject["ref"]) {
    if (type !== "node" && type !== "group" && type !== "edge") return this.select(type, ref);
    // A note is never part of a multi-selection: toggling anything else lets it go.
    if (this.selection.type === "note") this.selection = { type: null, ref: null };
    // A primary set on its own joins the sets first, so it toggles out like everything else.
    const now = this.picked();
    this.multi = now.nodes;
    this.multiGroups = now.groups;
    this.multiEdges = now.edges;
    const set = (
      type === "node" ? this.multi : type === "group" ? this.multiGroups : this.multiEdges
    ) as Set<string | number>;
    const key = ref as string | number;
    if (set.has(key)) {
      set.delete(key);
      if (this.selection.type === type && this.selection.ref === ref) {
        const nodes = [...this.multi];
        const groups = [...this.multiGroups];
        const edges = [...this.multiEdges];
        this.selection = nodes.length
          ? { type: "node", ref: nodes[nodes.length - 1] }
          : groups.length
            ? { type: "group", ref: groups[groups.length - 1] }
            : edges.length
              ? { type: "edge", ref: edges[edges.length - 1] }
              : { type: null, ref: null };
      }
    } else {
      set.add(key);
      this.selection = { type, ref };
    }
    this.emitSelection();
  }

  toggleNode(id: string) {
    this.toggle("node", id);
  }

  emitSelection() {
    this.renderSelection();
    this.h.onSelect?.(this.selection, this.picked());
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
    // Space presses a focused switch or an item of an open menu; it is not a pan there.
    const pressing = (ev: KeyboardEvent) =>
      Boolean((ev.target as HTMLElement)?.closest?.(".zeema-menu, [role='switch']"));

    this.on(window, "keydown", (ev) => {
      if (ev.code !== "Space" || this.spaceHeld || typing(ev) || pressing(ev)) return;
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
    // Shift pressed or let go mid-drag switches between the two regroup rules. A release counts
    // only once SHIFT_GRACE has passed without the button coming up (see `shiftHeld`).
    const shift = (ev: KeyboardEvent) => {
      const d = this.drag;
      if (ev.key !== "Shift" || !d) return;
      d.shiftUp = ev.type === "keyup" ? performance.now() : null;
      if (!d.moved) return;
      if (d.shiftUp !== null)
        window.setTimeout(() => {
          if (this.drag !== d || d.shiftUp === null) return;
          d.shift = this.dragShift(false);
          this.setRegroupTarget(this.regroupAt(d.shift));
        }, SHIFT_GRACE + 10);
      d.shift = this.dragShift(ev.shiftKey);
      this.setRegroupTarget(this.regroupAt(d.shift));
    };
    this.on(window, "keydown", shift);
    this.on(window, "keyup", shift);
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
      if (target.type === "edge" && this.dropCorner(ev, target.ref as number)) return;
      this.editLabel(target.type, target.ref as string | number);
    });

    this.on(svg, "contextmenu", (ev) => {
      ev.preventDefault();
      const target = this.targetOf(ev);
      const picked = this.picked();
      // A right click on something already in a multi-selection keeps it: the menu is about all.
      const inSelection =
        this.pickedCount() > 1 &&
        ((target.type === "node" && picked.nodes.has(target.ref as string)) ||
          (target.type === "group" && picked.groups.has(target.ref as string)) ||
          (target.type === "edge" && picked.edges.has(target.ref as number)));
      if (inSelection) {
        /* keep the selection */
      } else if (target.type === "node" && !this.multi.has(target.ref as string))
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

    // Any press, wheel or lost pointer puts the hover card away; capture, because a press on a
    // box stops its own propagation.
    this.on(svg, "pointerdown", () => this.h.onHover?.(null), { capture: true });
    this.on(svg, "wheel", () => this.h.onHover?.(null), { capture: true, passive: true });
    this.on(svg, "pointerleave", () => {
      this.hoverLight(null);
      this.h.onHover?.(null);
    });
    // A group's card comes from its label strip or its border band (frame-target.ts), the
    // same places a wire aims at the group. Its open interior belongs to its members: no card.
    this.on(svg, "pointermove", (ev) => {
      const t = ev.target as Element;
      if (t.closest?.(".node-box")) {
        this.frameHover = null; // the node reports itself
        return;
      }
      const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
      const over =
        ev.buttons || this.busy() || t.closest?.(".note-box, .edge-hit, .end-handle, .port-dot")
          ? null
          : (this.frameOfLabel(t) ??
            frameTargetAt(this.frames || {}, wx, wy, this.view.k, null, this.strips()));
      if (over)
        this.h.onHover?.({ type: "group", id: over, clientX: ev.clientX, clientY: ev.clientY });
      else if (this.frameHover) this.h.onHover?.(null);
      this.frameHover = over;
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
        t.closest(".frame-label")
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
        baseEdges: new Set(this.picked().edges),
        baseGroups: new Set(this.picked().groups),
        moved: false,
        rect: el("rect", { class: "marquee", x: wx, y: wy, width: 0, height: 0 }),
      };
      this.layers.overlay.append(this.marquee.rect);
      this.capture(ev);
    });

    this.on(svg, "pointermove", (ev) => {
      // A gesture that moves something puts the highlight away, a pinned one included, until it
      // ends. Panning moves nothing, so the highlight stays through it.
      if (this.litEls.length && this.moving()) this.applyLight();
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
      if (this.labelDrag) this.moveLabel(ev);
      if (this.tip) this.moveTip(ev);
    });

    const end = (ev: PointerEvent) => {
      if (this.pan) {
        this.pan = null;
        svg.classList.remove("panning");
      }
      if (this.marquee) this.endMarquee();
      if (this.noteDrag) this.endNote();
      if (this.drag) this.endDrag(ev);
      if (this.wire) this.endWire();
      if (this.bowDrag) this.endBow();
      if (this.labelDrag) this.endLabel();
      if (this.tip) this.finishTip();
      this.applyLight();
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
      const d = distanceToPath(e.points, wx, wy, e.ortho);
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
      if (els.hitEls.includes(node) || els.line === node || els.label === node)
        return { type: "edge", ref: i };
    for (const [id, f] of this.frameEls)
      if (f.hit === node || f.label === node || f.rect === node || (f.icon && f.icon === node))
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
      this.h.onPathPreview?.(this.bowDrag.key, this.bowDrag.original ?? null);
      this.bowDrag = null;
    }
    if (this.labelDrag) {
      const moved = this.labelDrag.moved;
      this.labelDrag = null;
      this.svg.classList.remove("label-dragging");
      if (moved) this.repaintEdges(this.model.bows);
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
      this.setRegroupTarget(null);
      this.drawGuides(null);
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
    // Groups too: every one whose members the selection now holds, all of them — the same rule
    // the engine applies when the selection is grouped, so a swept group nests whole.
    const covered = groupsCoveredBy(this.model.doc, [...this.multi]);
    this.multiGroups = m.add ? new Set([...m.baseGroups, ...covered]) : new Set(covered);
    // Edges too: every one drawn wholly inside the sweep, and every one between two components
    // it picked. Read off this run's geometry, never measured off the page.
    const edges = sweptEdges(this.geom || [], r as Rect, new Set(hit));
    this.multiEdges = m.add ? new Set([...m.baseEdges, ...edges]) : new Set(edges);
    this.renderSelection();
  }

  endMarquee() {
    const m = this.marquee;
    this.marquee = null;
    m.rect.remove();
    // A click on empty canvas drops a pinned highlight; so does a sweep, which is a new selection
    // the old pin would only fade.
    this.unpin();
    if (!m.moved) return;
    // With Shift held the sweep adds to what was selected, groups and edges included.
    this.selectMany(
      { nodes: [...this.multi], groups: [...this.multiGroups], edges: [...this.multiEdges] },
      m.add && this.selection.type === "node" ? (this.selection.ref as string) : null,
    );
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

  /**
   * What a drag of the selection moves: the selected components, and every member of every
   * selected group. `held` are those that came with a group: they keep the group they have.
   */
  dragSet(): { ids: string[]; held: Set<string> } {
    const held = new Set<string>();
    for (const g of this.picked().groups) for (const n of this.nodesInGroup(g)) held.add(n);
    const ids = [...new Set([...this.multi, ...held])].filter((n) => this.boxes[n]);
    return { ids, held };
  }

  startGroupDrag(gid: string, ev: PointerEvent) {
    if (ev.button !== 0 || this.space) return;
    ev.stopPropagation();
    // Shift/Ctrl/Cmd: a click toggles, a drag moves. Pressed on something outside the
    // selection, it joins now (both gestures want that); pressed on something already in it, a
    // click without moving takes it out on release.
    const mod = ev.shiftKey || ev.ctrlKey || ev.metaKey;
    const untoggle = mod && this.picked().groups.has(gid);
    if (mod && !untoggle) this.toggle("group", gid);
    const inMulti = this.pickedCount() > 1 && this.picked().groups.has(gid);
    if (!mod) {
      if (!inMulti) this.select("group", gid);
      else if (this.selection.type !== "group" || this.selection.ref !== gid) {
        this.selection = { type: "group", ref: gid };
        this.emitSelection();
      }
    }
    const own = this.nodesInGroup(gid);
    const { ids, held } = inMulti ? this.dragSet() : { ids: own, held: new Set(own) };
    if (!ids.length) {
      if (untoggle) this.toggle("group", gid);
      return;
    }
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    this.drag = {
      id: gid,
      ids,
      held,
      kind: "group",
      moved: false,
      down: [ev.clientX, ev.clientY],
      untoggle: untoggle ? ["group", gid] : null,
      ...this.regroupScope(),
      ...this.guideScope(ids),
      offsets: Object.fromEntries(
        ids.map((n) => [n, [wx - this.boxes[n][0], wy - this.boxes[n][1]]]),
      ),
    };
    this.capture(ev);
  }

  startDrag(id: string, ev: PointerEvent) {
    if (ev.button !== 0 || this.space) return;
    ev.stopPropagation();
    // As for a group: with a modifier a click toggles and a drag moves the selection.
    const mod = ev.shiftKey || ev.ctrlKey || ev.metaKey;
    const untoggle = mod && this.picked().nodes.has(id);
    if (mod && !untoggle) this.toggle("node", id);
    if (!mod) {
      if (!this.multi.has(id)) this.select("node", id);
      else if (this.selection.type !== "node" || this.selection.ref !== id) {
        this.selection = { type: "node", ref: id };
        this.emitSelection();
      }
    }
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    const { ids, held } = this.dragSet();
    this.drag = {
      id,
      ids,
      held,
      plain: !mod,
      alt: ev.altKey,
      moved: false,
      down: [ev.clientX, ev.clientY],
      untoggle: untoggle ? ["node", id] : null,
      ...this.regroupScope(),
      ...this.guideScope(ids),
      offsets: Object.fromEntries(
        ids.map((n) => [n, [wx - this.boxes[n][0], wy - this.boxes[n][1]]]),
      ),
    };
    this.capture(ev);
  }

  /**
   * What a drag needs to tell which group it is over: the frames as they stand now (they stretch
   * after their members while the drag runs) and the groups it can never move into — every
   * selected group and everything inside one.
   */
  regroupScope() {
    const skip = new Set<string>();
    for (const g of this.picked().groups)
      for (const id of groupAndDescendants(this.model.doc, g)) skip.add(id);
    return { frames0: this.frames || {}, skip, into: null as { group: string | null } | null };
  }

  /**
   * What a drag of `ids` lines up against: every other component's box, and every group frame
   * the drag does not stretch (a frame holding a dragged component follows it, so it cannot be a
   * guide). Fixed for the drag. `guideInset` grows the dragged components' bounding box to what
   * is seen moving: the frames of the selected groups, which keep their shape while they move.
   */
  guideScope(ids: string[]) {
    const doc = this.model.doc;
    const moving = new Set(ids);
    const stretched = new Set<string>();
    for (const n of doc.nodes)
      if (moving.has(n.id) && n.group) for (const g of ancestorsOf(doc, n.group)) stretched.add(g);
    const others: Box[] = [];
    for (const [id, b] of Object.entries(this.boxes)) if (!moving.has(id)) others.push(b);
    for (const [id, f] of Object.entries(this.frames || {})) if (!stretched.has(id)) others.push(f);
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const id of ids) {
      const b = this.boxes[id];
      x0 = Math.min(x0, b[0]);
      y0 = Math.min(y0, b[1]);
      x1 = Math.max(x1, b[0] + b[2]);
      y1 = Math.max(y1, b[1] + b[3]);
    }
    let [ox0, oy0, ox1, oy1] = [x0, y0, x1, y1];
    for (const g of this.picked().groups) {
      const f = this.frames?.[g];
      if (!f) continue;
      ox0 = Math.min(ox0, f[0]);
      oy0 = Math.min(oy0, f[1]);
      ox1 = Math.max(ox1, f[0] + f[2]);
      oy1 = Math.max(oy1, f[1] + f[3]);
    }
    return {
      guideOthers: others,
      guideInset: [x0 - ox0, y0 - oy0, ox1 - x1, oy1 - y1] as Box,
      // Reused on every move, so the pointer path allocates nothing for it.
      guideBox: [0, 0, 0, 0] as Box,
    };
  }

  /** Shows the guides a drag lines up on, or hides them (`null`). Two lines, made once, reused. */
  drawGuides(lines: GuideLine[] | null) {
    if (!lines?.length) {
      if (this.guideEls) this.guideEls.g.style.display = "none";
      return;
    }
    if (!this.guideEls) {
      const g = el("g", { class: "guides" }) as SVGGElement;
      const x = el("line", { class: "guide" }) as SVGLineElement;
      const y = el("line", { class: "guide" }) as SVGLineElement;
      g.append(x, y);
      this.guideEls = { g, x, y };
    }
    const { g, x, y } = this.guideEls;
    if (!g.isConnected) this.layers.overlay.append(g);
    g.style.display = "";
    x.style.display = "none";
    y.style.display = "none";
    for (const l of lines) {
      const line = l.axis === "x" ? x : y;
      line.style.display = "";
      const [a, b] = l.axis === "x" ? ["x", "y"] : ["y", "x"];
      line.setAttribute(`${a}1`, String(l.at));
      line.setAttribute(`${a}2`, String(l.at));
      line.setAttribute(`${b}1`, String(l.from));
      line.setAttribute(`${b}2`, String(l.to));
    }
  }

  /** Where the dragged item's centre would move it on release, by the rule Shift picks. */
  regroupAt(shift: boolean): { group: string | null } | null {
    const d = this.drag;
    if (!d || !this.h.onMove) return null;
    const box = d.kind === "group" ? this.frames[d.id] : this.boxes[d.id];
    if (!box) return null;
    const current =
      d.kind === "group"
        ? ((this.model.doc.groups || []).find((g: any) => g.id === d.id)?.parent ?? null)
        : (this.model.doc.nodes.find((n: any) => n.id === d.id)?.group ?? null);
    const ancestors = ancestorsOf(this.model.doc, current);
    const [cx, cy] = [box[0] + box[2] / 2, box[1] + box[3] / 2];
    return regroupTarget(d.frames0, cx, cy, d.skip, ancestors, shift);
  }

  /**
   * The group whose name or icon this is. Its own words win over the band test: a
   * child frame's band can reach up over its parent's label, and the label names the parent.
   */
  frameOfLabel(t: Element): string | null {
    for (const [id, f] of this.frameEls) if (f.label === t || f.icon === t) return id;
    return null;
  }

  /**
   * The drop highlight on the frame a drag would move its selection into; for the top level, an
   * edge round the whole canvas and a hint by the pointer.
   */
  setRegroupTarget(target: { group: string | null } | null) {
    const d = this.drag;
    if (!d) return;
    const top = target?.group === null;
    if (top) this.placeTopHint(d.client);
    else this.dropHint?.remove();
    this.svg.classList.toggle("drop-top", top);
    const was = d.into?.group ?? null;
    const now = target?.group ?? null;
    if (was !== now) {
      if (was) this.frameEls.get(was)?.rect.classList.remove("drop-target");
      if (now) this.frameEls.get(now)?.rect.classList.add("drop-target");
    }
    d.into = target;
  }

  dropHint: HTMLDivElement | null = null;

  /** "Drop: top level", just below and right of the pointer. */
  placeTopHint(client?: [number, number]) {
    const wrap = this.svg.parentElement;
    if (!wrap || !client) return;
    if (!this.dropHint) {
      this.dropHint = document.createElement("div");
      this.dropHint.className = "drop-hint";
      this.dropHint.textContent = "Drop: top level";
    }
    if (!this.dropHint.isConnected) wrap.append(this.dropHint);
    // Kept inside the canvas: near the right or bottom edge it goes to the pointer's other side.
    const r = wrap.getBoundingClientRect();
    const { offsetWidth: w, offsetHeight: h } = this.dropHint;
    let x = client[0] - r.left + 14;
    let y = client[1] - r.top + 18;
    if (x + w > r.width - 8) x = client[0] - r.left - 14 - w;
    if (y + h > r.height - 8) y = client[1] - r.top - 18 - h;
    this.dropHint.style.left = `${x}px`;
    this.dropHint.style.top = `${y}px`;
  }

  moveDrag(ev: PointerEvent) {
    // A few pixels of wobble is still a click (a Shift-click toggles on release).
    const [x0, y0] = this.drag.down ?? [ev.clientX, ev.clientY];
    if (!this.drag.moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < DRAG_THRESHOLD) return;
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    this.drag.moved = true;
    this.drag.at = [wx, wy];
    this.drag.client = [ev.clientX, ev.clientY];
    const d = this.drag;
    let gx0 = Infinity;
    let gy0 = Infinity;
    let gx1 = -Infinity;
    let gy1 = -Infinity;
    for (const id of d.ids) {
      const b = this.boxes[id];
      const off = d.offsets[id];
      b[0] = Math.round(wx - off[0]);
      b[1] = Math.round(wy - off[1]);
      if (b[0] < gx0) gx0 = b[0];
      if (b[1] < gy0) gy0 = b[1];
      if (b[0] + b[2] > gx1) gx1 = b[0] + b[2];
      if (b[1] + b[3] > gy1) gy1 = b[1] + b[3];
    }
    // Lined up on the nearest other box within GUIDE_SNAP screen pixels, unless Alt is held: the
    // selection (with the frames of the groups it carries) is the box that snaps, as one.
    let sx = 0;
    let sy = 0;
    if (!ev.altKey && d.guideOthers?.length) {
      const inset = d.guideInset;
      const box = d.guideBox;
      box[0] = gx0 - inset[0];
      box[1] = gy0 - inset[1];
      box[2] = gx1 - gx0 + inset[0] + inset[2];
      box[3] = gy1 - gy0 + inset[1] + inset[3];
      const guides = findGuides(box, d.guideOthers, GUIDE_SNAP / this.view.k);
      sx = Math.round(guides.dx);
      sy = Math.round(guides.dy);
      this.drawGuides(guides.lines);
    } else this.drawGuides(null);
    for (const id of d.ids) {
      const b = this.boxes[id];
      b[0] += sx;
      b[1] += sy;
      this.nodeEls.get(id)?.setAttribute("transform", `translate(${b[0]} ${b[1]})`);
    }
    const moving = new Set(this.drag.ids);
    // Frames follow their members, so an edge to a group moves with any drag.
    this.frames = groupFrames(this.model.doc, this.boxes, this.captions) as Record<string, Box>;
    this.geom = edgeGeometry(
      this.model.doc,
      this.boxes,
      this.model.bows || {},
      this.model.ports || {},
      this.frames,
      this.routeOptions(),
    );
    for (const e of this.geom) {
      const toGroup = !this.boxes[e.from] || !this.boxes[e.to];
      if (!toGroup && !moving.has(e.from) && !moving.has(e.to)) continue;
      const els = this.edgeEls.get(e.i);
      if (!els) continue;
      els.line.setAttribute("d", edgePath(e));
      this.setHits(els, e);
      if (els.label) {
        els.label.setAttribute("x", e.labelAt[0]);
        els.label.setAttribute("y", e.labelAt[1]);
        els.label.setAttribute("text-anchor", e.labelAnchor);
      }
      if (els.auth) {
        const [ax, ay] = authAt(e);
        els.auth.setAttribute("transform", `translate(${ax} ${ay})`);
      }
    }
    this.placeEndHandles();
    this.repaintFrames();
    this.repaintAnchored();
    if (ev.shiftKey) this.drag.shiftUp = null;
    this.drag.shift = this.dragShift(ev.shiftKey);
    this.setRegroupTarget(this.regroupAt(this.drag.shift));
  }

  /** Whether the running drag is a Shift drag, given whether the key is down now. */
  dragShift(down: boolean): boolean {
    return shiftHeld(down, this.drag?.shiftUp ?? null, performance.now());
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
    const frames = groupFrames(this.model.doc, this.boxes, this.captions) as Record<string, Box>;
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
      els.label.querySelectorAll("tspan").forEach((span: Element, k: number) => {
        span.setAttribute("x", String(f[0] + els.labelDx));
        span.setAttribute("y", String(f[1] + 19 + k * CAPTION_LINE));
      });
    }
    this.placeFrameDots();
  }

  endDrag(ev?: PointerEvent) {
    const shift = ev ? this.dragShift(ev.shiftKey) : Boolean(this.drag.shift);
    const into = this.drag.moved ? this.regroupAt(shift) : null;
    this.setRegroupTarget(null);
    const { id, ids, moved, kind, at, client, held, untoggle, plain, alt } = this.drag;
    this.drag = null;
    this.drawGuides(null);
    if (!moved) {
      if (untoggle) this.toggle(untoggle[0], untoggle[1]);
      // A plain click on a component pins its highlight (or moves the pin to it); Alt with the
      // click pins the flow lens on it instead.
      if (!kind && plain) {
        if (alt) this.trace(id);
        else this.pin({ type: "node", ref: id });
      }
      return;
    }
    // Let go where `regroupTarget` says: the selected components and groups move there. A plain
    // drag out of its group's frame (into an ancestor, or onto empty canvas) keeps the grouping —
    // the frame stretches after its members. Shift takes them out.
    const picked = this.picked();
    const moves = ids.map((id: string) => ({ id, x: this.boxes[id][0], y: this.boxes[id][1] }));
    this.h.onMove?.(
      moves,
      into
        ? {
            group: into.group,
            nodes: [...picked.nodes].filter((n) => !held?.has(n)),
            groups: [...picked.groups],
          }
        : null,
    );
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

  /**
   * A press on an edge's body. On a curve it bends the curve; on an orthogonal edge it takes run
   * `seg` and moves it square to itself, the runs on either side stretching to meet it, and the
   * path's corners become its waypoints (draw.io's segment drag). Nothing changes until the
   * pointer has moved DRAG_THRESHOLD px, so a click only selects.
   */
  startBow(edge: any, ev: PointerEvent, seg: number | null = null) {
    this.bowDrag = {
      i: edge.i,
      key: edge.key,
      from: edge.from,
      to: edge.to,
      seg: edge.ortho && !edge.fixed ? seg : null,
      ortho: Boolean(edge.ortho),
      points: edge.points.map((p: number[]) => [p[0], p[1]]),
      down: [ev.clientX, ev.clientY],
      moved: false,
      original: own(this.model.bows ?? {}, edge.key) ?? null,
    };
    this.capture(ev);
  }

  moveBow(ev: PointerEvent) {
    const drag = this.bowDrag;
    const [x0, y0] = drag.down;
    if (!drag.moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < DRAG_THRESHOLD) return;
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    let value: EdgePath | null;
    if (drag.ortho) {
      // An orthogonal edge has nothing a bow moves: only a run can be dragged.
      if (drag.seg === null) return;
      // A run dragged onto another side of an end's box brings that end round to it.
      const fit = refitEnds(
        moveSegment(drag.points, drag.seg, wx, wy),
        this.boxOf(drag.from),
        this.boxOf(drag.to),
        this.model.ports?.[drag.key] ?? {},
      );
      const via = viaOf(fit.points) as [number, number][];
      value = via.length ? { via } : null;
      const ends: EdgePorts = {};
      if (fit.from) ends.from = fit.from as Port;
      if (fit.to) ends.to = fit.to as Port;
      drag.ends = ends.from || ends.to ? ends : undefined;
    } else {
      const ends = this.model.ports?.[drag.key] ?? null;
      value = bowAt(this.boxes, drag.from, drag.to, wx, wy, ends, this.frames) || null;
    }
    drag.moved = true;
    drag.value = value;
    this.h.onPathPreview?.(drag.key, value, drag.ends);
  }

  endBow() {
    const { i, key, moved, value, ends } = this.bowDrag;
    this.bowDrag = null;
    if (moved) this.h.onPath?.(key, value ?? null, ends);
    else this.pin({ type: "edge", ref: i }); // a click on an edge pins its highlight
  }

  /**
   * A press on an edge's label. Once the pointer has moved DRAG_THRESHOLD px the label follows
   * it, centred, and the other labels dodge it as they will once it is let go; until then
   * nothing changes, so a click only selects and a double click still edits the words. What is
   * kept is the offset from the label's automatic place (`labelBase`), so it follows its edge.
   */
  startLabelDrag(i: number, ev: PointerEvent) {
    const e = (this.geom || []).find((g) => g.i === i);
    const els = this.edgeEls.get(i);
    if (!e?.labelBase || !els?.label) return;
    // Where the label's centre is drawn now: a label hung off a vertical run is anchored at its
    // start or end, so its centre is measured from what is on screen.
    let cx = e.labelAt[0];
    if (e.labelAnchor !== "middle") {
      try {
        const b = (els.label as SVGTextElement).getBBox();
        cx = b.x + b.width / 2;
      } catch {
        /* not laid out: the anchor point will do */
      }
    }
    this.labelDrag = {
      i,
      key: e.key,
      base: [e.labelBase[0], e.labelBase[1]],
      start: [cx, e.labelAt[1]],
      down: [ev.clientX, ev.clientY],
      moved: false,
      offset: null as LabelOffset | null,
      labels: null as Record<string, LabelOffset> | null,
    };
    this.capture(ev);
  }

  moveLabel(ev: PointerEvent) {
    const drag = this.labelDrag;
    const [x0, y0] = drag.down;
    if (!drag.moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < DRAG_THRESHOLD) return;
    const k = this.view.k || 1;
    const lim = (v: number) => Math.max(-LABEL_MAX_OFFSET, Math.min(LABEL_MAX_OFFSET, v));
    const offset: LabelOffset = [
      Math.round(lim(drag.start[0] + (ev.clientX - x0) / k - drag.base[0])) || 0,
      Math.round(lim(drag.start[1] + (ev.clientY - y0) / k - drag.base[1])) || 0,
    ];
    drag.moved = true;
    drag.offset = offset;
    drag.labels = { ...(this.model.labels ?? {}), [drag.key]: offset };
    this.svg.classList.add("label-dragging");
    this.repaintEdges(this.model.bows);
  }

  endLabel() {
    const { key, moved, offset } = this.labelDrag;
    this.labelDrag = null;
    this.svg.classList.remove("label-dragging");
    if (!moved) return;
    this.h.onLabelMove?.(key, offset && (offset[0] || offset[1]) ? offset : null);
  }

  /**
   * A double click on a corner of a shaped orthogonal path takes that waypoint out (the path
   * re-routes through the rest). True when it did; anything else is the label's double click.
   */
  dropCorner(ev: MouseEvent, i: number) {
    const e = (this.geom || []).find((g) => g.i === i);
    if (!e?.ortho || !Array.isArray(e.via) || !e.via.length) return false;
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    const reach = 10 / (this.view.k || 1);
    const corners = e.points.slice(1, -1);
    if (!corners.some((p: number[]) => Math.hypot(p[0] - wx, p[1] - wy) <= reach)) return false;
    const via = dropWaypoint(viaOf(e.points), wx, wy) as [number, number][];
    this.h.onPath?.(e.key, via.length ? { via } : null);
    return true;
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
      if (t.moved && t.target)
        this.h.onReconnect?.(t.i, t.end, t.target, this.dropPortOn(t.target, t.at));
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
    // A wire being drawn wants to see every edge it might join.
    this.applyDim();
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
    // Drawn from a dot: that side on the source, and the target's border where it was let go.
    const to = side && start ? this.dropPortOn(target, [wire.x, wire.y]) : null;
    const ends: EdgePorts | undefined = side && to ? { from: { side, t: 0.5 }, to } : undefined;
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
      ".port-dot, .end-handle, .edge-hits, .edge-hit, .frame-hit, .marquee, .wire, .note-grip, .note-grip-hit, .note-text.empty, .frame-label:empty, .layer-note-markers",
    ))
      n.remove();
    // A picture that leaves the page has no hover card: each box's name goes back into a
    // <title>, as the server render writes it.
    for (const box of clone.querySelectorAll(".node-box[aria-label]")) {
      const title = el("title", {});
      title.textContent = box.getAttribute("aria-label");
      box.prepend(title);
      box.removeAttribute("aria-label");
    }
    for (const frame of clone.querySelectorAll(".frame[aria-label]")) {
      const title = el("title", {});
      title.textContent = frame.getAttribute("aria-label");
      frame.append(title);
      frame.removeAttribute("aria-label");
    }
    for (const n of clone.querySelectorAll(".selected, .primary, .lit"))
      n.classList.remove("selected", "primary", "lit");
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
      ".node-box text.comp{font-size:11px;fill:var(--muted)}",
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
