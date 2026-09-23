// The canvas scene: one SVG with two render paths. Structural rebuilds when the document changes
// shape; the transform path runs during a drag and creates no DOM at all. This class is
// deliberately imperative and framework-free: React mounts the SVG skeleton once and hands it
// here, and nothing React owns changes during a pointer move.
//
// Pointer conventions follow draw.io and Excalidraw: left drag on empty space sweeps a selection
// box, the middle button pans, space turns the left button into the hand, shift adds to the
// selection, double click edits a label in place, the right button opens a menu about whatever is
// under it.

import { displayName } from "@zeema/core/document";
import { bowAt, edgeGeometry, groupFrames, innermostFrameAt, pathOf } from "@zeema/core/geometry";
import {
  anchorKey,
  anchorTarget,
  NOTE_MAX_TEXT,
  NOTE_MIN_H,
  NOTE_MIN_W,
  type Note,
} from "@/lib/layout-sidecar";
import { own } from "@/lib/own";

const NS = "http://www.w3.org/2000/svg";
const el = (name: string, attrs: Record<string, unknown> = {}) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs))
    if (v !== null && v !== undefined) n.setAttribute(k, String(v));
  return n;
};
const CATEGORY_HUE: Record<string, string> = {
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
  notes: Note[];
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
export type Handlers = {
  onSelect?: (selection: Subject, multi: Set<string>) => void;
  onMove?: (moves: Array<{ id: string; x: number; y: number; group: string | null }>) => void;
  onConnect?: (from: string, to: string) => void;
  onBowPreview?: (key: string, value: number) => void;
  onBow?: (key: string, value: number) => void;
  labelOf?: (kind: string, ref: string | number) => string | null;
  onLabel?: (kind: string, ref: string | number, value: string) => void;
  onContext?: (target: Subject, x: number, y: number) => void;
  onDrop?: (componentId: string, x: number, y: number) => void;
  onNoteGeometry?: (id: string, box: { x: number; y: number; w: number; h: number }) => void;
  onNotePin?: (key: string) => void;
  /** A drag that began on a boundary ended on a component: someone tried to wire the frame. */
  onFrameWire?: (clientX: number, clientY: number) => void;
};

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
  marquee: any = null;
  pan: any = null;
  editor: any = null;
  space = false;
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
    this.bind();
  }

  dispose() {
    this.disposed = true;
    if (this.peekTimer) clearTimeout(this.peekTimer);
    this.closeEditor();
    for (const c of this.cleanups) c();
    this.cleanups = [];
    // The marker layer and the arrowhead are the two things this scene added to a DOM it does
    // not own. They go with it, or the next Scene on the same <svg> inherits a stale layer and
    // a second element with the same id.
    this.layers.markers.remove();
    this.defs.querySelector("#arrowhead")?.remove();
  }

  installArrowhead() {
    this.defs.querySelector("#arrowhead")?.remove();
    const m = el("marker", {
      id: "arrowhead",
      viewBox: "0 0 10 10",
      refX: 9,
      refY: 5,
      markerWidth: 6,
      markerHeight: 6,
      orient: "auto",
    });
    m.innerHTML =
      '<path d="M1 1L9 5L1 9" fill="none" stroke="var(--line)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
    this.defs.append(m);
  }

  // ---------------------------------------------------------------- view

  applyView() {
    const { x, y, k } = this.view;
    this.viewport.setAttribute("transform", `translate(${x} ${y}) scale(${k})`);
  }

  fit(padding = 48) {
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
    // or a boundary that grew because something inside it moved.
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

  /** The box an anchor names: a node's box, or a boundary's computed frame. */
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
    return [Math.round(x - (t[0] + t[2])), Math.round(y - t[1])];
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
          rx: 3,
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
   * With notes hidden, each node or boundary that carries one shows a dot on the corner the
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
      this.noteEls.get(d.id)?.setAttribute("transform", `translate(${b[0]} ${b[1]})`);
      this.redrawLeader(d.id);
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

  endNote() {
    const { id, moved } = this.noteDrag;
    this.noteDrag = null;
    const b = this.noteBoxes[id];
    const note = (this.model.notes || []).find((n) => n.id === id);
    if (!moved || !b || !note) return;
    // Dragging an anchored note changes its OFFSET, never its anchor: it stays pinned to the
    // same thing, just further from it.
    const [x, y] = this.noteStored(note, b[0], b[1]);
    this.h.onNoteGeometry?.(id, { x, y, w: b[2], h: b[3] });
  }

  renderFrames() {
    const g = this.layers.frames;
    g.textContent = "";
    this.frameEls.clear();
    for (const group of this.model.doc.groups || []) {
      const f = this.frames[group.id];
      if (!f) continue;
      const rect = el("rect", {
        class: "frame",
        x: f[0],
        y: f[1],
        width: f[2],
        height: f[3],
        rx: 10,
      });
      const hit = el("rect", {
        class: "frame-hit",
        x: f[0],
        y: f[1],
        width: f[2],
        height: f[3],
        rx: 10,
      });
      // A boundary reads as a name with its kind beside it, never "name (kind)". The label is
      // what the author typed; the kind is a tag. With no label the id stands in, so a hand
      // -written design keeps reading as cell-a / cell-b. When that caption would only repeat
      // the kind, the tag alone says it — a fresh group whose auto-id is its kind shows one word.
      const label = el("text", { class: "frame-label", x: f[0] + 12, y: f[1] + 19 });
      const caption = group.label ? String(group.label) : String(group.id);
      const name = caption === group.kind ? "" : caption;
      label.textContent = name;
      const tag = el("text", { class: "frame-kind", x: f[0] + 12, y: f[1] + 19 });
      tag.textContent = group.kind;
      for (const target of [hit, label, tag]) {
        target.addEventListener("pointerdown", (ev: any) => this.startGroupDrag(group.id, ev));
      }
      g.append(rect, hit, label, tag);
      // The tag sits just past the name. Measured once here, because the name does not change
      // while the frame is being dragged — only where the frame is.
      const tagDx = 12 + (name ? textWidth(label, name.length * 6.2) + 8 : 0);
      tag.setAttribute("x", String(f[0] + tagDx));
      this.frameEls.set(group.id, { rect, hit, label, tag, tagDx });
    }
  }

  renderEdges() {
    const g = this.layers.edges;
    g.textContent = "";
    this.edgeEls.clear();
    this.geom = edgeGeometry(this.model.doc, this.boxes, this.model.bows || {});
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

  hueOf(componentId: string) {
    const c = own(this.model.catalogue.components, componentId);
    const k = c ? own(this.model.catalogue.kinds, c.kind) : null;
    return k ? CATEGORY_HUE[k.category] || "grey" : "grey";
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
      const hue = this.hueOf(n.component);
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
          rx: 8,
          fill: `var(--f-${hue}-fill)`,
          stroke: `var(--f-${hue}-line)`,
          // Set on the element, not in a stylesheet, so the exported SVG carries it too.
          "stroke-dasharray": untyped ? "6 4" : null,
          "fill-opacity": untyped ? 0.45 : null,
        }),
      );
      if (this.symbolFor(n.component))
        box.append(
          el("use", {
            href: `#ic-${n.component}`,
            x: b[2] / 2 - 12,
            y: 11,
            width: 24,
            height: 24,
            class: "glyph",
          }),
        );
      const name = el("text", { class: "name", x: b[2] / 2, y: 52, "text-anchor": "middle" });
      name.textContent = displayName(this.model.catalogue, n);
      const comp = el("text", { class: "comp", x: b[2] / 2, y: 68, "text-anchor": "middle" });
      comp.textContent = n.component;
      box.append(name, comp);
      const bad = (this.model.findings || []).filter(
        (f) => f.subject && f.subject.type === "node" && f.subject.ref === n.id,
      );
      if (bad.length) {
        const worst = bad.some((f) => f.blocking || f.severity === "error")
          ? "badge-error"
          : "badge-warn";
        box.append(el("circle", { class: worst, cx: b[2] - 10, cy: 10, r: 4 }));
      }
      for (const [hx, hy] of [
        [b[2] / 2, 0],
        [b[2], b[3] / 2],
        [b[2] / 2, b[3]],
        [0, b[3] / 2],
      ]) {
        const handle = el("circle", { class: "handle", cx: hx, cy: hy, r: 4.5, opacity: 0 });
        handle.addEventListener("pointerdown", (ev: any) => {
          if (ev.button !== 0 || this.space) return;
          ev.stopPropagation();
          this.startWire(n.id, ev);
        });
        box.append(handle);
      }
      box.addEventListener("pointerenter", () => {
        for (const h of box.querySelectorAll(".handle")) h.setAttribute("opacity", "1");
      });
      box.addEventListener("pointerleave", () => {
        for (const h of box.querySelectorAll(".handle")) h.setAttribute("opacity", "0");
      });
      box.addEventListener("pointerdown", (ev) => this.startDrag(n.id, ev));
      g.append(box);
      this.nodeEls.set(n.id, box);
    }
  }

  repaintEdges(bows: Record<string, number>) {
    this.model.bows = bows;
    const geom = edgeGeometry(this.model.doc, this.boxes, bows);
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
      if (ev.code !== "Space" || this.space || typing(ev)) return;
      this.space = true;
      svg.classList.add("hand");
      ev.preventDefault();
    });
    this.on(window, "keyup", (ev) => {
      if (ev.code !== "Space") return;
      this.space = false;
      svg.classList.remove("hand");
    });
    this.on(window, "blur", () => {
      this.space = false;
      svg.classList.remove("hand");
    });

    this.on(
      svg,
      "wheel",
      (ev) => {
        ev.preventDefault();
        const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
        const k = Math.min(3, Math.max(0.15, this.view.k * (ev.deltaY < 0 ? 1.1 : 1 / 1.1)));
        const r = svg.getBoundingClientRect();
        this.view.k = k;
        this.view.x = ev.clientX - r.left - wx * k;
        this.view.y = ev.clientY - r.top - wy * k;
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
      if (f.hit === node || f.label === node || f.tag === node || f.rect === node)
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
    if (this.noteDrag) {
      this.noteDrag = null;
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
    for (const e of edgeGeometry(this.model.doc, this.boxes, this.model.bows || {})) {
      if (!moving.has(e.from) && !moving.has(e.to)) continue;
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
    // Kept, not just drawn: a note anchored to a boundary reads its frame back from here while
    // the drag is still running.
    this.frames = frames;
    for (const [id, els] of this.frameEls) {
      const f = frames[id];
      if (!f) continue;
      for (const r of [els.rect, els.hit]) {
        r.setAttribute("x", f[0]);
        r.setAttribute("y", f[1]);
        r.setAttribute("width", f[2]);
        r.setAttribute("height", f[3]);
      }
      els.label.setAttribute("x", f[0] + 12);
      els.label.setAttribute("y", f[1] + 19);
      els.tag.setAttribute("x", f[0] + els.tagDx);
      els.tag.setAttribute("y", f[1] + 19);
    }
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
    // A boundary is not an endpoint: `from` and `to` are node ids. Someone who drags off a
    // frame and lets go on a component was trying to wire it, and the canvas used to answer
    // with silence. It has moved the boundary instead — which is the right thing to do with
    // that gesture — and now it also says why no edge appeared.
    if (kind === "group" && at) {
      // Only a component the boundary does not contain counts: its own members travel with the
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
    const value = bowAt(this.boxes, this.bowDrag.from, this.bowDrag.to, wx, wy);
    this.bowDrag.moved = true;
    this.bowDrag.value = value;
    this.h.onBowPreview?.(this.bowDrag.key, value);
  }

  endBow() {
    const { key, moved, value } = this.bowDrag;
    this.bowDrag = null;
    if (moved) this.h.onBow?.(key, value);
  }

  startWire(from: string, ev: PointerEvent) {
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    const line = el("path", { class: "wire", d: `M${wx} ${wy} L${wx} ${wy}` });
    this.layers.overlay.append(line);
    this.wire = { from, line, x: wx, y: wy, target: null };
    this.nodeEls.get(from)?.classList.add("wire-source");
    this.capture(ev);
  }

  moveWire(ev: PointerEvent) {
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    const b = this.boxes[this.wire.from];
    this.wire.line.setAttribute("d", `M${b[0] + b[2] / 2} ${b[1] + b[3] / 2} L${wx} ${wy}`);
    this.wire.x = wx;
    this.wire.y = wy;
    const target = this.nodeAt(wx, wy, this.wire.from);
    if (target === this.wire.target) return;
    this.clearWireTarget();
    this.wire.target = target;
    if (target) this.nodeEls.get(target)?.classList.add("wire-target");
    this.wire.line.classList.toggle("live", !!target);
  }

  clearWireTarget() {
    for (const box of this.nodeEls.values()) box.classList.remove("wire-target");
  }

  endWire() {
    const { from, line, target } = this.wire;
    this.wire = null;
    line.remove();
    this.clearWireTarget();
    this.nodeEls.get(from)?.classList.remove("wire-source");
    if (target && target !== from) this.h.onConnect?.(from, target);
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
      ".handle, .edge-hit, .frame-hit, .marquee, .wire, .note-grip, .note-grip-hit, .note-text.empty, .frame-label:empty, .layer-note-markers",
    ))
      n.remove();
    for (const n of clone.querySelectorAll(".selected, .primary"))
      n.classList.remove("selected", "primary");
    const defs = this.defs.cloneNode(true) as SVGDefsElement;
    const style = `<style>${[
      ".frame{fill:none;stroke:var(--frame);stroke-width:1;stroke-dasharray:5 4}",
      ".frame-label{font-size:11px;font-family:var(--mono);fill:var(--muted)}",
      ".frame-kind{font-size:10px;font-family:var(--mono);fill:var(--muted);opacity:0.75}",
      ".edge{stroke:var(--line);stroke-width:1.2;fill:none}",
      ".edge.async{stroke-dasharray:6 4}",
      ".edge-label{font-size:12px;fill:var(--muted);paint-order:stroke;stroke:var(--bg);stroke-width:3px}",
      ".node-box text.name{font-size:14px;font-weight:500;fill:var(--ink)}",
      ".node-box text.comp{font-size:12px;fill:var(--muted)}",
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
