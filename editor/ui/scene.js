// The canvas. One SVG scene with two render paths: structural, which rebuilds when the document
// changes shape, and transform, which runs during a drag and creates no DOM at all. Icons are
// emitted once into <defs> as symbols and instanced with <use>, so a hundred nodes of the same
// component cost one glyph.

import { edgeGeometry, pathOf, groupFrames, innermostFrameAt } from "../core/geometry.js";

const NS = "http://www.w3.org/2000/svg";
const el = (name, attrs = {}) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) n.setAttribute(k, v);
  return n;
};
const CATEGORY_HUE = { messaging: "violet", compute: "blue", data: "amber", edge: "teal",
  external: "rose", client: "purple", ops: "green", security: "red" };

export class Scene {
  constructor(svg, handlers) {
    this.svg = svg;
    this.h = handlers;
    this.defs = svg.querySelector("#symbols");
    this.viewport = svg.querySelector("#viewport");
    this.layers = {
      frames: svg.querySelector("#layer-frames"),
      edges: svg.querySelector("#layer-edges"),
      nodes: svg.querySelector("#layer-nodes"),
      overlay: svg.querySelector("#layer-overlay"),
    };
    this.view = { x: 0, y: 0, k: 1 };
    this.symbols = new Set();
    this.nodeEls = new Map();
    this.edgeEls = new Map();
    this.selection = { type: null, ref: null };
    this.drag = null;
    this.wire = null;
    this._bind();
  }

  // ---------------------------------------------------------------- view

  applyView() {
    const { x, y, k } = this.view;
    this.viewport.setAttribute("transform", `translate(${x} ${y}) scale(${k})`);
  }

  fit(padding = 60) {
    const boxes = Object.values(this.boxes || {});
    if (!boxes.length) { this.view = { x: 0, y: 0, k: 1 }; this.applyView(); return; }
    const x0 = Math.min(...boxes.map((b) => b[0])), y0 = Math.min(...boxes.map((b) => b[1]));
    const x1 = Math.max(...boxes.map((b) => b[0] + b[2])), y1 = Math.max(...boxes.map((b) => b[1] + b[3]));
    const r = this.svg.getBoundingClientRect();
    const k = Math.min((r.width - padding * 2) / Math.max(1, x1 - x0), (r.height - padding * 2) / Math.max(1, y1 - y0), 1.6);
    this.view = { k, x: (r.width - (x1 - x0) * k) / 2 - x0 * k, y: (r.height - (y1 - y0) * k) / 2 - y0 * k };
    this.applyView();
  }

  toWorld(clientX, clientY) {
    const r = this.svg.getBoundingClientRect();
    return [(clientX - r.left - this.view.x) / this.view.k, (clientY - r.top - this.view.y) / this.view.k];
  }

  // ---------------------------------------------------------------- render

  render(model) {
    this.model = model;                      // { doc, catalogue, icons, positions, sizes, findings }
    this.boxes = {};
    for (const n of model.doc.nodes) {
      const p = model.positions[n.id] || [0, 0];
      const s = model.sizes[n.id] || [140, 78];
      this.boxes[n.id] = [p[0], p[1], s[0], s[1]];
    }
    this.frames = groupFrames(model.doc, this.boxes);
    this.renderFrames();
    this.renderEdges();
    this.renderNodes();
    this.renderSelection();
  }

  renderFrames() {
    const g = this.layers.frames;
    g.textContent = "";
    for (const group of this.model.doc.groups || []) {
      const f = this.frames[group.id];
      if (!f) continue;
      g.append(el("rect", { class: "frame", x: f[0], y: f[1], width: f[2], height: f[3], rx: 10 }));
      const label = el("text", { class: "frame-label", x: f[0] + 12, y: f[1] + 19 });
      label.textContent = group.label || `${group.id} (${group.kind})`;
      label.style.cursor = "pointer";
      label.addEventListener("pointerdown", (ev) => { ev.stopPropagation(); this.select("group", group.id); });
      g.append(label);
    }
  }

  renderEdges() {
    const g = this.layers.edges;
    g.textContent = "";
    this.edgeEls.clear();
    this.geom = edgeGeometry(this.model.doc, this.boxes);
    for (const e of this.geom) {
      const d = pathOf(e.points);
      const hit = el("path", { class: "edge-hit", d });
      const line = el("path", { class: `edge${e.dashed ? " async" : ""}`, d, "marker-end": "url(#arrowhead)" });
      hit.addEventListener("pointerdown", (ev) => { ev.stopPropagation(); this.select("edge", e.i); });
      g.append(hit, line);
      this.edgeEls.set(e.i, { hit, line });
      if (e.label) {
        const mid = e.points.length === 3 ? e.points[1] : [(e.points[0][0] + e.points[1][0]) / 2, (e.points[0][1] + e.points[1][1]) / 2];
        const t = el("text", { class: "edge-label", x: mid[0], y: mid[1] - 4, "text-anchor": "middle" });
        t.textContent = e.label;
        g.append(t);
      }
    }
  }

  symbolFor(componentId) {
    if (this.symbols.has(componentId)) return true;
    const body = this.model.icons ? this.model.icons[componentId] : null;
    if (!body) return false;
    const sym = el("symbol", { id: `ic-${componentId}`, viewBox: "0 0 24 24" });
    sym.innerHTML = body;
    this.defs.append(sym);
    this.symbols.add(componentId);
    return true;
  }

  hueOf(componentId) {
    const c = this.model.catalogue.components[componentId];
    const k = c ? this.model.catalogue.kinds[c.kind] : null;
    return k ? (CATEGORY_HUE[k.category] || "grey") : "grey";
  }

  renderNodes() {
    const g = this.layers.nodes;
    g.textContent = "";
    this.nodeEls.clear();
    for (const n of this.model.doc.nodes) {
      const b = this.boxes[n.id];
      const hue = this.hueOf(n.component);
      const box = el("g", { class: "node-box", "data-id": n.id, transform: `translate(${b[0]} ${b[1]})` });
      box.append(el("rect", {
        class: "body", x: 0, y: 0, width: b[2], height: b[3], rx: 8,
        fill: `var(--f-${hue}-fill)`, stroke: `var(--f-${hue}-line)`,
      }));
      if (this.symbolFor(n.component)) {
        const use = el("use", { href: `#ic-${n.component}`, x: b[2] / 2 - 12, y: 11, width: 24, height: 24, class: "glyph" });
        box.append(use);
      }
      const name = el("text", { class: "name", x: b[2] / 2, y: 52, "text-anchor": "middle" });
      name.textContent = n.label || n.id;
      const comp = el("text", { class: "comp", x: b[2] / 2, y: 68, "text-anchor": "middle" });
      comp.textContent = n.component;
      box.append(name, comp);
      const bad = (this.model.findings || []).filter((f) => f.subject && f.subject.type === "node" && f.subject.ref === n.id);
      if (bad.length) {
        const worst = bad.some((f) => f.blocking || f.severity === "error") ? "badge-error" : "badge-warn";
        box.append(el("circle", { class: worst, cx: b[2] - 10, cy: 10, r: 4 }));
      }
      for (const [hx, hy] of [[b[2] / 2, 0], [b[2], b[3] / 2], [b[2] / 2, b[3]], [0, b[3] / 2]]) {
        const handle = el("circle", { class: "handle", cx: hx, cy: hy, r: 4.5, opacity: 0 });
        handle.addEventListener("pointerdown", (ev) => { ev.stopPropagation(); this.startWire(n.id, ev); });
        box.append(handle);
      }
      box.addEventListener("pointerenter", () => box.querySelectorAll(".handle").forEach((h) => h.setAttribute("opacity", 1)));
      box.addEventListener("pointerleave", () => box.querySelectorAll(".handle").forEach((h) => h.setAttribute("opacity", 0)));
      box.addEventListener("pointerdown", (ev) => this.startDrag(n.id, ev));
      box.addEventListener("dblclick", (ev) => { ev.stopPropagation(); this.h.onRename && this.h.onRename(n.id); });
      g.append(box);
      this.nodeEls.set(n.id, box);
    }
  }

  renderSelection() {
    for (const [id, node] of this.nodeEls) node.classList.toggle("selected", this.selection.type === "node" && this.selection.ref === id);
    for (const [i, e] of this.edgeEls) e.line.classList.toggle("selected", this.selection.type === "edge" && this.selection.ref === i);
  }

  select(type, ref) {
    this.selection = { type, ref };
    this.renderSelection();
    this.h.onSelect && this.h.onSelect(this.selection);
  }

  // ---------------------------------------------------------------- interaction

  _bind() {
    const svg = this.svg;
    svg.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
      const k = Math.min(3, Math.max(0.15, this.view.k * (ev.deltaY < 0 ? 1.1 : 1 / 1.1)));
      const r = svg.getBoundingClientRect();
      this.view.k = k;
      this.view.x = ev.clientX - r.left - wx * k;
      this.view.y = ev.clientY - r.top - wy * k;
      this.applyView();
    }, { passive: false });

    svg.addEventListener("pointerdown", (ev) => {
      if (ev.target.closest(".node-box") || ev.target.closest(".edge-hit")) return;
      this.select(null, null);
      this.pan = { x: ev.clientX, y: ev.clientY, vx: this.view.x, vy: this.view.y };
      svg.classList.add("panning");
      svg.setPointerCapture(ev.pointerId);
    });

    svg.addEventListener("pointermove", (ev) => {
      if (this.pan) {
        this.view.x = this.pan.vx + (ev.clientX - this.pan.x);
        this.view.y = this.pan.vy + (ev.clientY - this.pan.y);
        this.applyView();
        return;
      }
      if (this.drag) this.moveDrag(ev);
      if (this.wire) this.moveWire(ev);
    });

    const end = (ev) => {
      if (this.pan) { this.pan = null; svg.classList.remove("panning"); }
      if (this.drag) this.endDrag(ev);
      if (this.wire) this.endWire(ev);
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
  }

  startDrag(id, ev) {
    ev.stopPropagation();
    this.select("node", id);
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    const b = this.boxes[id];
    this.drag = { id, dx: wx - b[0], dy: wy - b[1], moved: false };
    this.svg.setPointerCapture(ev.pointerId);
  }

  // Transform path: move the group and redraw only the edges that touch it. No element is
  // created here, which is what keeps a drag smooth on a large design.
  moveDrag(ev) {
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    const b = this.boxes[this.drag.id];
    b[0] = Math.round(wx - this.drag.dx);
    b[1] = Math.round(wy - this.drag.dy);
    this.drag.moved = true;
    this.nodeEls.get(this.drag.id).setAttribute("transform", `translate(${b[0]} ${b[1]})`);
    const geom = edgeGeometry(this.model.doc, this.boxes);
    for (const e of geom) {
      if (e.from !== this.drag.id && e.to !== this.drag.id) continue;
      const els = this.edgeEls.get(e.i);
      if (!els) continue;
      const d = pathOf(e.points);
      els.line.setAttribute("d", d);
      els.hit.setAttribute("d", d);
    }
  }

  endDrag(ev) {
    const { id, moved } = this.drag;
    this.drag = null;
    if (!moved) return;
    const b = this.boxes[id];
    const centre = [b[0] + b[2] / 2, b[1] + b[3] / 2];
    const frames = groupFrames(this.model.doc, this.boxes);
    const group = innermostFrameAt(frames, centre[0], centre[1]);
    this.h.onMove && this.h.onMove(id, b[0], b[1], group);
  }

  startWire(from, ev) {
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    const line = el("path", { class: "edge", d: `M${wx} ${wy} L${wx} ${wy}`, "stroke-dasharray": "4 4" });
    this.layers.overlay.append(line);
    this.wire = { from, line, x: wx, y: wy };
    this.svg.setPointerCapture(ev.pointerId);
  }

  moveWire(ev) {
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    const b = this.boxes[this.wire.from];
    this.wire.line.setAttribute("d", `M${b[0] + b[2] / 2} ${b[1] + b[3] / 2} L${wx} ${wy}`);
    this.wire.x = wx; this.wire.y = wy;
  }

  endWire(ev) {
    const { from, line, x, y } = this.wire;
    this.wire = null;
    line.remove();
    let target = null;
    for (const [id, b] of Object.entries(this.boxes)) {
      if (x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3]) { target = id; break; }
    }
    if (target && target !== from) this.h.onConnect && this.h.onConnect(from, target);
  }

  // ---------------------------------------------------------------- export

  toSVG() {
    const boxes = Object.values(this.boxes);
    const x0 = Math.min(...boxes.map((b) => b[0])) - 40, y0 = Math.min(...boxes.map((b) => b[1])) - 60;
    const x1 = Math.max(...boxes.map((b) => b[0] + b[2])) + 40, y1 = Math.max(...boxes.map((b) => b[1] + b[3])) + 40;
    const clone = this.viewport.cloneNode(true);
    clone.removeAttribute("transform");
    clone.querySelectorAll(".handle, .edge-hit").forEach((n) => n.remove());
    const defs = this.defs.cloneNode(true);
    const style = `<style>.frame{fill:none;stroke:#b4b4ae;stroke-width:1;stroke-dasharray:5 4}.frame-label{font-size:12px;fill:#6b6b66}` +
      `.edge{stroke:#8a8a85;stroke-width:1.2;fill:none}.edge.async{stroke-dasharray:6 4}.edge-label{font-size:12px;fill:#6b6b66}` +
      `.node-box text.name{font-size:14px;font-weight:500;fill:#1b1b19}.node-box text.comp{font-size:12px;fill:#6b6b66}` +
      `.glyph{color:#1b1b19}</style>`;
    return `<svg xmlns="${NS}" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" width="${x1 - x0}" height="${y1 - y0}" ` +
      `font-family="ui-sans-serif, system-ui, sans-serif">${style}${defs.outerHTML}${clone.outerHTML}</svg>\n`;
  }
}

export function installArrowhead(svg) {
  const defs = svg.querySelector("#symbols");
  const m = document.createElementNS(NS, "marker");
  m.setAttribute("id", "arrowhead");
  m.setAttribute("viewBox", "0 0 10 10");
  m.setAttribute("refX", "9"); m.setAttribute("refY", "5");
  m.setAttribute("markerWidth", "6"); m.setAttribute("markerHeight", "6");
  m.setAttribute("orient", "auto");
  m.innerHTML = '<path d="M1 1L9 5L1 9" fill="none" stroke="var(--line)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
  defs.append(m);
}
