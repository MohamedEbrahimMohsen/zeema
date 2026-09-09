// Arkore canvas: the wiring. State is one document plus one position map; every change goes
// through a command that pushes a snapshot, re-derives findings and re-renders. There is no
// framework here on purpose, and no reactive graph to reason about: change the document, call
// commit, and the picture follows.

import { parse, serialize } from "../core/yaml.js";
import { layout } from "../core/layout.js";
import { check } from "../core/structure.js";
import { runRules } from "../core/rules.js";
import * as D from "../core/document.js";
import { edgeKeys } from "../core/geometry.js";
import { Scene, installArrowhead } from "./scene.js";
import { Palette } from "./palette.js";
import { Inspector } from "./inspector.js";
import { Findings } from "./findings.js";
import * as files from "./files.js";

const $ = (sel) => document.querySelector(sel);
const clone = (x) => JSON.parse(JSON.stringify(x));

const state = {
  catalogue: null, search: null, icons: {}, index: [],
  path: null, layoutPath: null, editable: true,
  doc: null, cst: null, positions: {}, sizes: {}, bows: {},
  undo: [], redo: [], dirty: false, lastDragAt: 0,
};

// ---------------------------------------------------------------- deriving

function relayout() {
  const result = layout(state.doc, state.catalogue);
  state.sizes = result.sizes;
  for (const n of state.doc.nodes) {
    if (!state.positions[n.id]) state.positions[n.id] = result.positions[n.id] || [40, 40];
  }
  for (const id of Object.keys(state.positions)) {
    if (!state.doc.nodes.some((n) => n.id === id)) delete state.positions[id];
  }
}

function autoLayout() {
  const result = layout(state.doc, state.catalogue);
  state.positions = result.positions;
  state.sizes = result.sizes;
}

function derive() {
  let structural = [], rules = [];
  try { structural = check(state.doc, state.catalogue, { file: state.doc.id }); }
  catch (e) { structural = [{ message: "structural check failed: " + e.message, subject: { type: "design", ref: null }, blocking: true }]; }
  try { rules = structural.length ? [] : runRules(state.doc, state.catalogue); }
  catch (e) { rules = []; }
  return { structural, rules };
}

let findingsCache = { structural: [], rules: [] };

// One bad frame used to end the session: an exception thrown while drawing left the canvas
// showing the last good picture and swallowed every command after it, so the editor looked
// frozen. A frame that throws now says so and the document is still there to undo.
function render() {
  try { renderNow(); }
  catch (e) {
    console.error(e);
    $("#save-state").textContent = "draw failed: " + e.message;
  }
}

function renderNow() {
  relayout();
  findingsCache = derive();
  scene.render({
    doc: state.doc, catalogue: state.catalogue, icons: state.icons,
    positions: state.positions, sizes: state.sizes, bows: state.bows,
    findings: [...findingsCache.structural, ...findingsCache.rules],
  });
  inspector.render(scene.selection, state);
  findings.render(findingsCache.structural, findingsCache.rules, state.catalogue);
  $("#save").disabled = !state.editable || findingsCache.structural.length > 0;
  $("#save-state").textContent = !state.editable ? "read only" : state.dirty ? "unsaved" : "saved";
  $("#empty-state").hidden = state.doc.nodes.length > 0;
  $("#undo").disabled = !state.undo.length;
  $("#redo").disabled = !state.redo.length;
}

// ---------------------------------------------------------------- commands

function commit(next, opts = {}) {
  const snapshot = { doc: clone(state.doc), positions: clone(state.positions), bows: clone(state.bows) };
  const coalesce = opts.coalesce && Date.now() - state.lastDragAt < 400;
  if (!coalesce) state.undo.push(snapshot);
  if (state.undo.length > 100) state.undo.shift();
  state.redo.length = 0;
  if (next) state.doc = next;
  state.dirty = true;
  if (opts.coalesce) state.lastDragAt = Date.now();
  scheduleDraft();
  render();
  scheduleDiskSave();
}

function undo() {
  if (!state.undo.length) return;
  state.redo.push({ doc: clone(state.doc), positions: clone(state.positions), bows: clone(state.bows) });
  const prev = state.undo.pop();
  state.doc = prev.doc; state.positions = prev.positions; state.bows = prev.bows || {};
  state.dirty = true;
  render();
}

function redo() {
  if (!state.redo.length) return;
  state.undo.push({ doc: clone(state.doc), positions: clone(state.positions), bows: clone(state.bows) });
  const next = state.redo.pop();
  state.doc = next.doc; state.positions = next.positions; state.bows = next.bows || {};
  state.dirty = true;
  render();
}


// ---------------------------------------------------------------- autosave
// Unsaved work survives a reload, but only on top of the same file: the base text is hashed at
// open, and a restore happens only when the file on disk still hashes the same. A design that
// changed underneath is never silently overwritten by stale edits.

const hash = (text) => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const draftKey = (path) => "arkore-canvas:" + path;

function saveDraft() {
  if (!state.path || !state.dirty) return;
  try {
    localStorage.setItem(draftKey(state.path), JSON.stringify({
      base: state.baseHash, doc: state.doc, positions: state.positions, bows: state.bows, at: Date.now(),
    }));
  } catch { /* a full or blocked store is not a reason to stop editing */ }
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(draftKey(state.path));
    if (!raw) return false;
    const draft = JSON.parse(raw);
    if (draft.base !== state.baseHash) { localStorage.removeItem(draftKey(state.path)); return false; }
    state.doc = draft.doc;
    state.positions = draft.positions || state.positions;
    state.bows = draft.bows || {};
    state.dirty = true;
    return true;
  } catch { return false; }
}

function clearDraft() { try { localStorage.removeItem(draftKey(state.path)); } catch {} }

let draftTimer = null;
function scheduleDraft() { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 500); }

// ---------------------------------------------------------------- files

async function openDesign(entry) {
  const text = await files.loadDesign(entry.path);
  const parsed = parse(text);
  const { doc, repaired } = D.normalize(parsed.doc);
  const cst = parsed.cst;
  state.baseHash = hash(text);
  state.path = entry.path;
  state.layoutPath = entry.layout;
  state.editable = entry.editable !== false;
  state.doc = doc; state.cst = cst;
  state.undo = []; state.redo = []; state.dirty = false;
  state.positions = {}; state.bows = {};
  const saved = await files.loadLayout(entry.layout);
  autoLayout();
  if (saved && saved.nodes) {
    for (const [id, xy] of Object.entries(saved.nodes)) {
      if (state.doc.nodes.some((n) => n.id === id)) state.positions[id] = xy;
    }
  }
  if (saved && saved.edges) {
    const live = new Set(edgeKeys(state.doc));
    for (const [key, bow] of Object.entries(saved.edges)) if (live.has(key)) state.bows[key] = bow;
  }
  const restored = restoreDraft();
  scene.selection = { type: null, ref: null };
  if (repaired.length) state.dirty = true;
  render();
  scene.fit();
  if (restored) $("#save-state").textContent = "unsaved work restored";
  else if (repaired.length) $("#save-state").textContent = "repaired on open: " + repaired.join("; ");
  document.title = `${doc.id} — Arkore canvas`;
}

async function save() {
  if (!state.editable) return;
  const text = serialize(state.cst, state.doc);
  await files.put(state.path, text);
  await files.put(state.layoutPath, JSON.stringify(
    { version: 2, nodes: state.positions, edges: state.bows }, null, 2) + "\n");
  const fresh = parse(text);                 // the file on disk is now the source of truth
  state.cst = fresh.cst; state.doc = D.normalize(fresh.doc).doc;
  state.baseHash = hash(text);
  state.dirty = false;
  clearDraft();
  if (!state.index.some((e) => e.path === state.path && e.onDisk)) {
    try { state.index = await files.loadIndex(); } catch { /* the picker keeps what it has */ }
  }
  render();
  $("#save-state").textContent = "saved";
}


// ---------------------------------------------------------------- new design
// A design made here has no external source and no broken twin, so it goes in designs/authored/.
// The file is written with the schema pointer the repository gate expects, and it stays unsaved
// until it has at least one node, because a design with an empty nodes list is not valid.

function newDesign() {
  const raw = prompt("Design id (kebab-case, becomes designs/authored/<id>/)", "untitled-design");
  if (raw === null) return;
  const id = raw.trim();
  if (!/^[a-z][a-z0-9-]*$/.test(id)) { alert("A design id is lower case letters, digits and hyphens, starting with a letter."); return; }
  if (state.index.some((e) => e.tier === "authored" && e.id === id)) { alert(`designs/authored/${id}/ already exists.`); return; }
  const parsed = parse(D.newDesignText(id));
  const doc = D.normalize(parsed.doc).doc, cst = parsed.cst;
  doc.nodes = []; doc.edges = [];
  state.path = `designs/authored/${id}/design.yaml`;
  state.layoutPath = `designs/authored/${id}/design.layout.json`;
  state.editable = true;
  state.doc = doc; state.cst = cst;
  state.baseHash = "";
  state.positions = {}; state.bows = {};
  state.undo = []; state.redo = []; state.dirty = true;
  const entry = { path: state.path, tier: "authored", id, editable: true, layout: state.layoutPath };
  state.index.push(entry);
  addPickerOption(entry, true);
  scene.selection = { type: null, ref: null };
  render();
  document.title = `${id} — Arkore canvas`;
  $("#save-state").textContent = "new, add a component to save";
}

function addPickerOption(entry, select) {
  const picker = $("#design-picker");
  const o = document.createElement("option");
  o.value = entry.path;
  o.textContent = `${entry.id}${entry.editable === false ? " (broken, read only)" : ""} · ${entry.tier}`;
  picker.append(o);
  if (select) picker.value = entry.path;
}

// ---------------------------------------------------------------- autosave to disk
// The draft in localStorage is the crash net; this is the real thing. It only ever runs when the
// design is editable and structurally valid, so autosave can never write a file CI would reject.

let diskTimer = null;
function scheduleDiskSave() {
  if (!$("#autosave").checked) return;
  clearTimeout(diskTimer);
  diskTimer = setTimeout(() => {
    if (!state.dirty || !state.editable || findingsCache.structural.length) return;
    save().catch((e) => { $("#save-state").textContent = "autosave failed: " + e.message; });
  }, 1500);
}

// ---------------------------------------------------------------- boot

const scene = new Scene($("#scene"), {
  onSelect: () => inspector.render(scene.selection, state),
  onMove: (id, x, y, group) => {
    state.positions[id] = [x, y];
    const node = state.doc.nodes.find((n) => n.id === id);
    const next = (node.group || null) !== (group || null) ? D.setNodeGroup(state.doc, id, group) : null;
    commit(next, { coalesce: true });
  },
  onConnect: (from, to) => commit(D.addEdge(state.doc, from, to)),
  onBowPreview: (key, value) => scene.repaintEdges({ ...state.bows, [key]: value }),
  onBow: (key, value, reset) => {
    if (value) state.bows[key] = value; else delete state.bows[key];
    commit(null, { coalesce: !reset });
  },
  onRename: (id) => {
    const node = state.doc.nodes.find((n) => n.id === id);
    const value = prompt("Label", node.label || node.id);
    if (value !== null) commit(D.setNodeField(state.doc, id, "label", value.trim()));
  },
});

const inspector = new Inspector($("#inspector"), {
  setField: (id, f, v) => commit(D.setNodeField(state.doc, id, f, v)),
  setProp: (id, p, v) => commit(D.setNodeProp(state.doc, id, p, v)),
  setNfr: (id, f, v) => commit(D.setNfr(state.doc, id, f, v)),
  setGroup: (id, g) => commit(D.setNodeGroup(state.doc, id, g)),
  rename: (oldId, newId) => {
    if (!newId || !/^[a-z][a-z0-9-]*$/.test(newId) || state.doc.nodes.some((n) => n.id === newId)) return render();
    const p = state.positions[oldId];
    delete state.positions[oldId];
    state.positions[newId] = p;
    scene.selection = { type: "node", ref: newId };
    commit(D.renameNode(state.doc, oldId, newId, state.catalogue));
  },
  swap: (id, componentId) => {
    const { doc, dropped } = D.swapComponent(state.doc, id, componentId, state.catalogue);
    if (dropped.length) alert(`Dropped on swap: ${dropped.join(", ")}`);
    commit(doc);
  },
  setEdge: (i, f, v) => commit(D.setEdgeField(state.doc, i, f, v)),
  setGroupField: (id, f, v) => commit(D.setGroupField(state.doc, id, f, v)),
  renameGroup: (oldId, newId) => {
    if (!newId || !/^[a-z][a-z0-9-]*$/.test(newId)) return render();
    scene.selection = { type: "group", ref: newId };
    commit(D.renameGroup(state.doc, oldId, newId));
  },
  setParent: (id, p) => commit(D.setGroupParent(state.doc, id, p)),
  setDesignId: (v) => { const d = clone(state.doc); d.id = v; commit(d); },
  setRequirement: (path, v) => commit(D.setRequirement(state.doc, path, v)),
  remove: (type, ref) => {
    scene.selection = { type: null, ref: null };
    if (type === "node") commit(D.deleteNodes(state.doc, [ref]));
    if (type === "edge") commit(D.deleteEdge(state.doc, ref));
    if (type === "group") commit(D.deleteGroup(state.doc, ref));
  },
});

const findings = new Findings($("#findings"), {
  summary: $("#lint-summary"),
  onSelect: (subject) => {
    if (!subject || subject.ref === null) return;
    scene.select(subject.type, subject.ref);
    const box = scene.boxes[subject.ref];
    if (box) {
      const r = $("#scene").getBoundingClientRect();
      scene.view.x = r.width / 2 - (box[0] + box[2] / 2) * scene.view.k;
      scene.view.y = r.height / 2 - (box[1] + box[3] / 2) * scene.view.k;
      scene.applyView();
    }
  },
});

let palette = null;

function createNode(componentId, at) {
  const { doc, id, needsDecision } = D.addNode(state.doc, componentId, state.catalogue);
  if (at) state.positions[id] = [Math.round(at[0]), Math.round(at[1])];
  scene.selection = { type: "node", ref: id };
  commit(doc);
  if (needsDecision.length) $("#save-state").textContent = `${id}: choose ${needsDecision.join(", ")}`;
}

async function boot() {
  installArrowhead($("#scene"));
  const [{ catalogue, search }, index] = await Promise.all([files.loadCatalogue(), files.loadIndex()]);
  state.catalogue = catalogue; state.search = search; state.index = index;

  const picker = $("#design-picker");
  for (const entry of index) addPickerOption(entry, false);
  picker.addEventListener("change", () => openDesign(index.find((e) => e.path === picker.value)));

  palette = new Palette($("#palette"), {
    search, catalogue, icons: state.icons,
    onCreate: (id) => createNode(id, null),
  });

  try { $("#autosave").checked = localStorage.getItem("arkore-canvas:autosave") === "1"; } catch {}
  const first = index.find((e) => e.path.includes("chat-system")) || index[0];
  picker.value = first.path;
  await openDesign(first);

  files.loadIcons().then((icons) => {
    state.icons = icons;
    palette.setIcons(icons);
    render();
  });
}

// ---------------------------------------------------------------- events

$("#save").addEventListener("click", () => save().catch((e) => alert("Save failed: " + e.message)));
$("#new-design").addEventListener("click", newDesign);
$("#autosave").addEventListener("change", (ev) => {
  try { localStorage.setItem("arkore-canvas:autosave", ev.target.checked ? "1" : "0"); } catch {}
  if (ev.target.checked) scheduleDiskSave();
});
$("#undo").addEventListener("click", undo);
$("#redo").addEventListener("click", redo);
$("#zoom-fit").addEventListener("click", () => scene.fit());
$("#zoom-100").addEventListener("click", () => { scene.view.k = 1; scene.applyView(); });
$("#tidy").addEventListener("click", () => { autoLayout(); commit(null); scene.fit(); });
$("#export-svg").addEventListener("click", () => files.download(`${state.doc.id}.svg`, scene.toSVG(), "image/svg+xml"));

const canvas = $("#canvas-wrap");
canvas.addEventListener("dragover", (ev) => ev.preventDefault());
canvas.addEventListener("drop", (ev) => {
  const id = ev.dataTransfer.getData("text/arkore-component");
  if (!id) return;
  ev.preventDefault();
  createNode(id, scene.toWorld(ev.clientX, ev.clientY));
});

window.addEventListener("keydown", (ev) => {
  const typing = /input|select|textarea/i.test(ev.target.tagName);
  const mod = ev.metaKey || ev.ctrlKey;
  if (mod && ev.key.toLowerCase() === "s") { ev.preventDefault(); save().catch((e) => alert("Save failed: " + e.message)); return; }
  if (mod && ev.key.toLowerCase() === "z") { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
  if (mod && ev.key.toLowerCase() === "n") { ev.preventDefault(); newDesign(); return; }
  if (typing) return;
  if (mod && ev.key === "0") { ev.preventDefault(); scene.fit(); return; }
  if (mod && ev.key === "1") { ev.preventDefault(); scene.view.k = 1; scene.applyView(); return; }
  if (ev.key === "Escape") { scene.select(null, null); return; }
  if (ev.key === "Backspace" || ev.key === "Delete") {
    const s = scene.selection;
    if (!s.type) return;
    ev.preventDefault();
    scene.selection = { type: null, ref: null };
    if (s.type === "node") commit(D.deleteNodes(state.doc, [s.ref]));
    if (s.type === "edge") commit(D.deleteEdge(state.doc, s.ref));
    if (s.type === "group") commit(D.deleteGroup(state.doc, s.ref));
    return;
  }
  if (ev.key === "g" || ev.key === "G") {
    const s = scene.selection;
    if (s.type !== "node") return;
    const { doc, id } = D.addGroup(state.doc, [s.ref], "system");
    scene.selection = { type: "group", ref: id };
    commit(doc);
  }
});

window.addEventListener("beforeunload", (ev) => { if (state.dirty) { ev.preventDefault(); ev.returnValue = ""; } });

boot().catch((e) => {
  document.body.innerHTML = `<pre style="padding:24px;white-space:pre-wrap">Arkore canvas could not start.\n\n${e.stack || e.message}\n\nRun: node .claude/tools/build_editor_data.mjs, then node editor/serve.mjs</pre>`;
});
