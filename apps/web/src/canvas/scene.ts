// The canvas scene: one SVG with two render paths. Structural rebuilds when the document changes
// shape; the transform path runs during a drag and creates no DOM at all. This class is
// deliberately imperative and framework-free: React mounts the SVG skeleton once and hands it
// here, and nothing React owns changes during a pointer move.
//
// Pointer conventions follow draw.io and Excalidraw: left drag on empty space sweeps a selection
// box, the middle button pans, space turns the left button into the hand, shift adds to the
// selection, double click edits a label in place, the right button opens a menu about whatever is
// under it.

import { displayName } from "@arkore/core/document";
import { bowAt, edgeGeometry, groupFrames, innermostFrameAt, pathOf } from "@arkore/core/geometry";

const NS = "http://www.w3.org/2000/svg";
const el = (name: string, attrs: Record<string, unknown> = {}) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs))
    if (v !== null && v !== undefined) n.setAttribute(k, String(v));
  return n;
};
const CATEGORY_HUE: Record<string, string> = {
  messaging: "violet",
  compute: "blue",
  data: "amber",
  edge: "teal",
  external: "rose",
  client: "purple",
  ops: "green",
  security: "red",
};

export type Box = [number, number, number, number];
export type Subject = { type: "node" | "edge" | "group" | null; ref: string | number | null };
export type Model = {
  doc: any;
  catalogue: any;
  icons: Record<string, string>;
  positions: Record<string, [number, number]>;
  sizes: Record<string, [number, number]>;
  bows: Record<string, number>;
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
  layers: { frames: SVGGElement; edges: SVGGElement; nodes: SVGGElement; overlay: SVGGElement };
  view = { x: 0, y: 0, k: 1 };
  symbols = new Set<string>();
  nodeEls = new Map<string, SVGGElement>();
  edgeEls = new Map<number, any>();
  frameEls = new Map<string, any>();
  selection: Subject = { type: null, ref: null };
  multi = new Set<string>();
  model!: Model;
  boxes: Record<string, Box> = {};
  frames: Record<string, Box> = {};
  geom: any[] = [];
  drag: any = null;
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
      edges: svg.querySelector(".layer-edges") as SVGGElement,
      nodes: svg.querySelector(".layer-nodes") as SVGGElement,
      overlay: svg.querySelector(".layer-overlay") as SVGGElement,
    };
    this.installArrowhead();
    this.bind();
  }

  dispose() {
    this.disposed = true;
    this.closeEditor();
    for (const c of this.cleanups) c();
    this.cleanups = [];
  }

  installArrowhead() {
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
    const boxes = Object.values(this.boxes || {});
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
    this.renderFrames();
    this.renderEdges();
    this.renderNodes();
    this.renderSelection();
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
      const label = el("text", { class: "frame-label", x: f[0] + 12, y: f[1] + 19 });
      const name = group.label || group.id;
      label.textContent = name === group.kind ? name : `${name} (${group.kind})`;
      for (const target of [hit, label]) {
        target.addEventListener("pointerdown", (ev: any) => this.startGroupDrag(group.id, ev));
      }
      g.append(rect, hit, label);
      this.frameEls.set(group.id, { rect, hit, label });
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
        const t = el("text", {
          class: "edge-label",
          x: e.mid[0],
          y: e.mid[1] - 5,
          "text-anchor": "middle",
        });
        t.textContent = e.label;
        g.append(t);
        els.label = t;
      }
      this.edgeEls.set(e.i, els);
    }
  }

  symbolFor(componentId: string) {
    if (this.symbols.has(componentId)) return true;
    const body = this.model.icons ? this.model.icons[componentId] : null;
    if (!body) return false;
    const sym = el("symbol", { id: `ic-${componentId}`, viewBox: "0 0 24 24" });
    sym.innerHTML = body;
    this.defs.append(sym);
    this.symbols.add(componentId);
    return true;
  }

  hueOf(componentId: string) {
    const c = this.model.catalogue.components[componentId];
    const k = c ? this.model.catalogue.kinds[c.kind] : null;
    return k ? CATEGORY_HUE[k.category] || "grey" : "grey";
  }

  renderNodes() {
    const g = this.layers.nodes;
    g.textContent = "";
    this.nodeEls.clear();
    for (const n of this.model.doc.nodes) {
      const b = this.boxes[n.id];
      const hue = this.hueOf(n.component);
      const box = el("g", {
        class: "node-box",
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
        els.label.setAttribute("x", e.mid[0]);
        els.label.setAttribute("y", e.mid[1] - 5);
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

  private on<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    fn: (ev: WindowEventMap[K]) => void,
    opts?: AddEventListenerOptions,
  ) {
    target.addEventListener(type, fn as any, opts);
    this.cleanups.push(() => target.removeEventListener(type, fn as any, opts));
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

    svg.addEventListener(
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

    svg.addEventListener("dblclick", (ev) => {
      const target = this.targetOf(ev);
      if (!target.type) return;
      ev.preventDefault();
      this.editLabel(target.type, target.ref as string | number);
    });

    svg.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      const target = this.targetOf(ev);
      if (target.type === "node" && !this.multi.has(target.ref as string))
        this.select("node", target.ref);
      else if (target.type === "edge" || target.type === "group")
        this.select(target.type, target.ref);
      else if (target.type === null && this.selection.type) this.select(null, null);
      this.h.onContext?.(target, ev.clientX, ev.clientY);
    });

    svg.addEventListener("dragover", (ev) => {
      if (ev.dataTransfer?.types.includes("text/arkore-component")) ev.preventDefault();
    });
    svg.addEventListener("drop", (ev) => {
      const id = ev.dataTransfer?.getData("text/arkore-component");
      if (!id) return;
      ev.preventDefault();
      const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
      this.h.onDrop?.(id, wx, wy);
    });

    svg.addEventListener("pointerdown", (ev) => {
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
        moved: false,
        rect: el("rect", { class: "marquee", x: wx, y: wy, width: 0, height: 0 }),
      };
      this.layers.overlay.append(this.marquee.rect);
      this.capture(ev);
    });

    svg.addEventListener("pointermove", (ev) => {
      if (this.pan) {
        this.view.x = this.pan.vx + (ev.clientX - this.pan.x);
        this.view.y = this.pan.vy + (ev.clientY - this.pan.y);
        this.applyView();
        return;
      }
      if (this.marquee) return this.moveMarquee(ev);
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
      if (this.drag) this.endDrag();
      if (this.wire) this.endWire();
      if (this.bowDrag) this.endBow();
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
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
    for (const [i, els] of this.edgeEls)
      if (els.hit === node || els.line === node || els.label === node)
        return { type: "edge", ref: i };
    for (const [id, f] of this.frameEls)
      if (f.hit === node || f.label === node || f.rect === node) return { type: "group", ref: id };
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
        els.label.setAttribute("x", e.mid[0]);
        els.label.setAttribute("y", e.mid[1] - 5);
      }
    }
    this.repaintFrames();
  }

  repaintFrames() {
    const frames = groupFrames(this.model.doc, this.boxes) as Record<string, Box>;
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
    }
  }

  endDrag() {
    const { ids, moved, kind } = this.drag;
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
      anchor = this.toScreen(e.mid[0], e.mid[1] - 12);
      width = 150;
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
    let done = false;
    const finish = (commit: boolean) => {
      if (done) return;
      done = true;
      input.remove();
      this.editor = null;
      if (commit && input.value !== current) this.h.onLabel?.(kind, ref, input.value.trim());
    };
    input.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Enter") finish(true);
      if (ev.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
    wrap.append(input);
    input.focus();
    input.select();
    this.editor = { input, finish };
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
    for (const n of clone.querySelectorAll(".handle, .edge-hit, .frame-hit, .marquee, .wire"))
      n.remove();
    for (const n of clone.querySelectorAll(".selected, .primary"))
      n.classList.remove("selected", "primary");
    const defs = this.defs.cloneNode(true) as SVGDefsElement;
    const style = `<style>${[
      ".frame{fill:none;stroke:var(--frame);stroke-width:1;stroke-dasharray:5 4}",
      ".frame-label{font-size:12px;fill:var(--muted)}",
      ".edge{stroke:var(--line);stroke-width:1.2;fill:none}",
      ".edge.async{stroke-dasharray:6 4}",
      ".edge-label{font-size:12px;fill:var(--muted);paint-order:stroke;stroke:var(--bg);stroke-width:3px}",
      ".node-box text.name{font-size:14px;font-weight:500;fill:var(--ink)}",
      ".node-box text.comp{font-size:12px;fill:var(--muted)}",
      ".glyph{color:var(--ink)}",
      ".badge-error{fill:var(--err)}.badge-warn{fill:var(--warn)}",
    ].join("")}</style>`;
    const ground = background
      ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--bg)"/>`
      : "";
    return this.resolveVars(
      `<svg xmlns="${NS}" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}" font-family="ui-sans-serif, system-ui, sans-serif">${style}${defs.outerHTML}${ground}${clone.outerHTML}</svg>\n`,
    );
  }
}
