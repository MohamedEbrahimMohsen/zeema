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
import { showMenu, closeMenu } from "./menu.js";
import { exportScene } from "./export.js";
import { matchRoute, shortRouteOf } from "./router.js";

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

// Moving a node's position from one id to another, which an id rename is.
function movePosition(from, to) {
  if (!state.positions[from]) return;
  state.positions[to] = state.positions[from];
  delete state.positions[from];
}

// Place every component again from scratch, by the same layout the repository's renderer uses:
// sources at the top, each node a layer below whatever reaches it. It replaces the positions of
// the whole design, which is why it is one undo away.
function arrange() {
  commit(null, { apply: autoLayout });
  scene.fit();
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
  inspector.render(scene.selection, state, scene.multi);
  findings.render(findingsCache.structural, findingsCache.rules, state.catalogue);
  $("#save").disabled = !state.editable || findingsCache.structural.length > 0;
  $("#clone").disabled = !state.doc.nodes.length;
  $("#autosave").disabled = !state.editable;
  $("#autosave-wrap").classList.toggle("off", !state.editable);
  $("#autosave-wrap").title = state.editable
    ? "Save to disk a moment after each change"
    : "This design is read only. Clone it and autosave applies to the copy.";
  $("#save-state").textContent = !state.editable
    ? (state.dirty ? "read only — Clone to keep these edits" : "read only — Clone to edit")
    : state.dirty ? "unsaved" : "saved";
  $("#empty-state").hidden = state.doc.nodes.length > 0;
  $("#undo").disabled = !state.undo.length;
  $("#redo").disabled = !state.redo.length;
}

// ---------------------------------------------------------------- commands

// Positions and bows are not in the document, so a command that moves something has to hand its
// mutation to commit rather than run it first: a snapshot taken after the move is a snapshot of
// the move, and undo then puts back what is already there. `apply` runs after the snapshot.
function commit(next, opts = {}) {
  const snapshot = { doc: clone(state.doc), positions: clone(state.positions), bows: clone(state.bows) };
  const coalesce = opts.coalesce && Date.now() - state.lastDragAt < 400;
  if (!coalesce) state.undo.push(snapshot);
  if (state.undo.length > 100) state.undo.shift();
  state.redo.length = 0;
  if (opts.apply) opts.apply();
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
  // Whether a design can be written is decided here, from the tier, and not taken on trust from
  // whatever answered /api/designs. A server started before this rule existed still reports the
  // repository's own designs as editable, and the answer to that must not be to write to them.
  state.editable = entry.tier === "authored" && entry.editable !== false;
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
  scene.multi = new Set();
  if (repaired.length) state.dirty = true;
  render();
  scene.fit();
  showInAddressBar(entry);
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
  scene.multi = new Set();
  render();
  document.title = `${id} — Arkore canvas`;
  $("#save-state").textContent = "new, add a component to save";
}

// ---------------------------------------------------------------- clone
// The reference designs are curated and the imported ones are faithful to a source document, so
// the canvas cannot save over either. Editing one is still the point: change it, then clone, and
// what you have on screen, unsaved edits and layout included, becomes a design of your own in
// designs/authored/. The copy records where it came from in its header, because a design with no
// mapping.yaml and no source folder otherwise has nothing to say about its own origin.

function cloneHeader(text, from) {
  const note = `# Cloned from ${from} in the Arkore canvas.`;
  const lines = text.split("\n");
  const at = lines[0].startsWith("# yaml-language-server") ? 1 : 0;
  lines.splice(at, 0, note);
  return lines.join("\n");
}

async function cloneInto(newId) {
  const from = state.path;
  const text = cloneHeader(serialize(state.cst, { ...state.doc, id: newId }), from);
  const target = `designs/authored/${newId}/design.yaml`;
  const layoutPath = `designs/authored/${newId}/design.layout.json`;
  await files.put(target, text);
  await files.put(layoutPath, JSON.stringify({ version: 2, nodes: state.positions, edges: state.bows }, null, 2) + "\n");
  const entry = { path: target, tier: "authored", id: newId, editable: true, layout: layoutPath };
  if (!state.index.some((e) => e.path === target)) { state.index.push(entry); addPickerOption(entry, true); }
  $("#design-picker").value = target;
  clearDraft();                       // the edits are in the clone now, not pending on the original
  await openDesign(entry);
  notify(`cloned ${state.doc.id} from ${from.split("/")[2]}`);
}

function cloneDesign() {
  if (!state.doc) return;
  if (!state.doc.nodes.length) return notify("a design with no components cannot be cloned");
  const taken = new Set(state.index.filter((e) => e.tier === "authored").map((e) => e.id));
  const numbered = D.cloneId(state.doc.id, taken);
  const random = D.cloneId(state.doc.id, taken, true);
  const run = (id) => cloneInto(id).catch((e) => notify("clone failed: " + e.message));
  const r = $("#clone").getBoundingClientRect();
  showMenu(r.left, r.bottom + 4, [
    { label: numbered, hint: "next copy", run: () => run(numbered) },
    { label: random, hint: "unique", run: () => run(random) },
    "-",
    { label: "Name it myself", run: () => {
      const typed = prompt("Id for the copy (kebab-case, becomes designs/authored/<id>/)", numbered);
      if (typed === null) return;
      const id = D.toId(typed);
      if (!typed.trim()) return notify("a design id cannot be empty");
      if (taken.has(id)) return notify(`designs/authored/${id}/ already exists`);
      run(id);
    } },
  ]);
}

// The address bar follows the design, so the link in it is always the link to what is on
// screen. replaceState rather than pushState while switching designs: the picker is not
// navigation, and filling someone's back button with every design they glanced at is rude.
// A real navigation, the back button included, comes back through popstate.
function showInAddressBar(entry, push = false) {
  try {
    const route = shortRouteOf(entry, state.index);
    if (route === location.pathname) return;
    history[push ? "pushState" : "replaceState"]({ path: entry.path }, "", route);
  } catch { /* a page opened from a file:// URL has no history to write */ }
}

function addPickerOption(entry, select) {
  const picker = $("#design-picker");
  const o = document.createElement("option");
  o.value = entry.path;
  const why = entry.path.endsWith("design.broken.yaml") ? "broken, read only"
    : entry.tier !== "authored" ? "read only" : null;
  o.textContent = `${entry.id}${why ? ` (${why})` : ""} · ${entry.tier}`;
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
  onSelect: () => inspector.render(scene.selection, state, scene.multi),
  // A drag reports every node it moved, so moving five is one entry in the history, not five.
  onMove: (moves) => {
    let next = null;
    for (const m of moves) {
      const node = (next || state.doc).nodes.find((n) => n.id === m.id);
      if (node && (node.group || null) !== (m.group || null)) next = D.setNodeGroup(next || state.doc, m.id, m.group);
    }
    commit(next, { coalesce: true, apply: () => { for (const m of moves) state.positions[m.id] = [m.x, m.y]; } });
  },
  onConnect: (from, to) => commit(D.addEdge(state.doc, from, to)),
  onBowPreview: (key, value) => scene.repaintEdges({ ...state.bows, [key]: value }),
  onBow: (key, value, reset) => {
    commit(null, { coalesce: !reset, apply: () => { if (value) state.bows[key] = value; else delete state.bows[key]; } });
  },
  labelOf: (kind, ref) => {
    // The box opens on what the node is called, which for an unnamed one is its component's
    // name, so double clicking Azure Function offers "Azure Function" to edit.
    if (kind === "node") { const n = state.doc.nodes.find((x) => x.id === ref); return n ? D.displayName(state.catalogue, n) : null; }
    if (kind === "edge") { const e = state.doc.edges[ref]; return e ? e.label || "" : null; }
    const g = (state.doc.groups || []).find((x) => x.id === ref);
    return g ? g.label || "" : null;
  },
  onLabel: (kind, ref, value) => {
    if (kind === "node") { renameToLabel(ref, value); return; }
    if (kind === "edge") commit(D.setEdgeField(state.doc, ref, "label", value));
    if (kind === "group") commit(D.setGroupField(state.doc, ref, "label", value));
  },
  onContext: (target, x, y) => showMenu(x, y, menuFor(target)),
});

const inspector = new Inspector($("#inspector"), {
  setField: (id, f, v) => (f === "label" ? renameToLabel(id, v) : commit(D.setNodeField(state.doc, id, f, v))),
  setProp: (id, p, v) => commit(D.setNodeProp(state.doc, id, p, v)),
  setNfr: (id, f, v) => commit(D.setNfr(state.doc, id, f, v)),
  setGroup: (id, g) => commit(D.setNodeGroup(state.doc, id, g)),
  // An id is kebab-case, so what is typed is turned into one rather than refused for its shape.
  // The one thing that cannot be done is take an id another node already has, and that says so
  // instead of quietly putting the old value back, which reads as a field that does not work.
  rename: (oldId, typed) => {
    const newId = D.toId(typed);
    if (newId === oldId) return render();
    if (!typed.trim()) return notify("an id cannot be empty");
    if (state.doc.nodes.some((n) => n.id === newId)) return notify(`${newId} is the id of another component`);
    scene.selection = { type: "node", ref: newId };
    scene.multi = new Set([...scene.multi].map((x) => (x === oldId ? newId : x)));
    scene.multi.add(newId);
    commit(D.renameNode(state.doc, oldId, newId, state.catalogue), { apply: () => movePosition(oldId, newId) });
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

// ---------------------------------------------------------------- commands on the selection
// One implementation each, shared by the keyboard and the right click menu, and every one of
// them goes through commit, which is what puts it in the undo history.

function selectionIds() { return [...scene.multi]; }

// Say something in the status line and have it survive the redraw that follows, which is what
// puts "unsaved" there. Anything the person needs to read goes through here.
function notify(message) { render(); $("#save-state").textContent = message; }

// Naming a node renames it: while the id is the one the editor generated, it follows the name,
// so azure-functions-2 becomes orders-worker and the counter is gone. The selection follows the
// new id, because it is the same node.
function renameToLabel(id, value) {
  const { doc, id: now } = D.setNodeLabel(state.doc, id, value, state.catalogue);
  if (now !== id) {
    if (scene.selection.type === "node" && scene.selection.ref === id) scene.selection = { type: "node", ref: now };
    scene.multi = new Set([...scene.multi].map((x) => (x === id ? now : x)));
    if (scene.selection.type === "node") scene.multi.add(scene.selection.ref);
  }
  commit(doc, { apply: () => { if (now !== id) movePosition(id, now); } });
}

function deleteSelection() {
  const s = scene.selection;
  const ids = selectionIds();
  scene.selection = { type: null, ref: null };
  if (ids.length) { scene.multi = new Set(); return commit(D.deleteNodes(state.doc, ids)); }
  scene.multi = new Set();
  if (s.type === "edge") return commit(D.deleteEdge(state.doc, s.ref));
  if (s.type === "group") return commit(D.deleteGroup(state.doc, s.ref));   // the boundary only
  render();
}

function groupSelection() {
  const ids = selectionIds();
  if (!ids.length) return;
  const { doc, id } = D.addGroup(state.doc, ids, "system");
  scene.multi = new Set();
  scene.selection = { type: "group", ref: id };
  commit(doc);
}

function ungroup(id) {
  scene.selection = { type: null, ref: null };
  commit(D.deleteGroup(state.doc, id));
}

function deleteGroupAndNodes(id) {
  scene.selection = { type: null, ref: null };
  scene.multi = new Set();
  commit(D.deleteGroupDeep(state.doc, id));
}

function duplicateSelection() {
  const ids = selectionIds();
  if (!ids.length) return;
  const { doc, map } = D.duplicateNodes(state.doc, ids, state.catalogue);
  const copies = Object.values(map);
  scene.multi = new Set(copies);
  scene.selection = { type: "node", ref: copies[copies.length - 1] };
  commit(doc, { apply: () => {
    for (const [from, to] of Object.entries(map)) {
      const p = state.positions[from] || [40, 40];
      state.positions[to] = [p[0] + 28, p[1] + 28];
    }
  } });
}

function nudge(dx, dy) {
  const ids = selectionIds();
  if (!ids.length) return;
  commit(null, { coalesce: true, apply: () => {
    for (const id of ids) {
      const p = state.positions[id];
      if (p) state.positions[id] = [p[0] + dx, p[1] + dy];
    }
  } });
}

function selectAll() { scene.selectNodes(state.doc.nodes.map((n) => n.id)); }

function releaseFromGroup() {
  const ids = selectionIds();
  if (!ids.length) return;
  let doc = state.doc;
  for (const id of ids) doc = D.setNodeGroup(doc, id, null);
  commit(doc);
}

// What the right button offers, by what it was pressed on.
function menuFor(target) {
  const count = scene.multi.size;
  if (target.type === "node") {
    const grouped = state.doc.nodes.some((n) => scene.multi.has(n.id) && n.group);
    return [
      { label: "Rename label", hint: "double click", run: () => scene.editLabel("node", target.ref) },
      { label: count > 1 ? `Group these ${count}` : "Group", hint: "G", run: groupSelection },
      grouped ? { label: "Remove from group", run: releaseFromGroup } : null,
      { label: count > 1 ? `Duplicate these ${count}` : "Duplicate", hint: "Ctrl D", run: duplicateSelection },
      "-",
      { label: count > 1 ? `Delete these ${count}` : "Delete", hint: "Del", danger: true, run: deleteSelection },
    ];
  }
  if (target.type === "edge") {
    const edge = state.doc.edges[target.ref];
    return [
      { label: "Edit label", hint: "double click", run: () => scene.editLabel("edge", target.ref) },
      { label: "Reverse direction", run: () => commit(D.reverseEdge(state.doc, target.ref)) },
      { label: edge && edge.mode === "async" ? "Make synchronous" : "Make asynchronous",
        run: () => commit(D.setEdgeField(state.doc, target.ref, "mode", edge && edge.mode === "async" ? "sync" : "async")) },
      { label: "Straighten", disabled: !state.bows[edgeKeys(state.doc)[target.ref]],
        run: () => { delete state.bows[edgeKeys(state.doc)[target.ref]]; commit(null); } },
      "-",
      { label: "Delete", hint: "Del", danger: true, run: () => { scene.select(null, null); commit(D.deleteEdge(state.doc, target.ref)); } },
    ];
  }
  if (target.type === "group") {
    const members = D.groupMembers(state.doc, target.ref).length;
    return [
      { label: "Rename label", hint: "double click", run: () => scene.editLabel("group", target.ref) },
      { label: "Select what is inside", run: () => scene.selectNodes(D.groupMembers(state.doc, target.ref)) },
      "-",
      { label: "Ungroup", hint: "Del", run: () => ungroup(target.ref) },
      { label: `Delete the group and its ${members} component${members === 1 ? "" : "s"}`, danger: true,
        run: () => deleteGroupAndNodes(target.ref) },
    ];
  }
  return [
    { label: "Select all", hint: "Ctrl A", disabled: !state.doc.nodes.length, run: selectAll },
    { label: "Fit to the window", hint: "Ctrl 0", run: () => scene.fit() },
    { label: "Arrange every component", hint: "by layer", disabled: !state.doc.nodes.length, run: arrange },
  ];
}

let palette = null;

function createNode(componentId, at) {
  const { doc, id, needsDecision } = D.addNode(state.doc, componentId, state.catalogue);
  scene.selection = { type: "node", ref: id };
  scene.multi = new Set([id]);
  commit(doc, { apply: () => { if (at) state.positions[id] = [Math.round(at[0]), Math.round(at[1])]; } });
  if (needsDecision.length) $("#save-state").textContent = `${id}: choose ${needsDecision.join(", ")}`;
}

async function boot() {
  installArrowhead($("#scene"));
  const [{ catalogue, search }, index] = await Promise.all([files.loadCatalogue(), files.loadIndex()]);
  state.catalogue = catalogue; state.search = search; state.index = index;

  const picker = $("#design-picker");
  for (const entry of index) addPickerOption(entry, false);
  // state.index, not the boot snapshot: a design created in this session is in one and not the
  // other, and switching to it has to work.
  picker.addEventListener("change", () => {
    const entry = state.index.find((e) => e.path === picker.value);
    if (!entry) { notify("no such design: " + picker.value); return; }
    openDesign(entry).catch((e) => { $("#save-state").textContent = "could not open: " + e.message; });
  });

  palette = new Palette($("#palette"), {
    search, catalogue, icons: state.icons,
    onCreate: (id) => createNode(id, null),
  });

  window.addEventListener("popstate", () => {
    const entry = matchRoute(location.pathname, state.index) || state.index[0];
    if (!entry || entry.path === state.path) return;
    picker.value = entry.path;
    openDesign(entry).catch((e) => notify("could not open: " + e.message));
  });

  try { $("#autosave").checked = localStorage.getItem("arkore-canvas:autosave") === "1"; } catch {}
  try { setTheme(localStorage.getItem("arkore-canvas:theme") || "system"); } catch { setTheme("system"); }
  // What the address bar asks for wins; a link to a design that no longer exists opens the
  // editor on something rather than on an error.
  const asked = matchRoute(location.pathname, index);
  const first = asked || index.find((e) => e.path.includes("chat-system")) || index[0];
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
$("#clone").addEventListener("click", cloneDesign);
$("#autosave").addEventListener("change", (ev) => {
  try { localStorage.setItem("arkore-canvas:autosave", ev.target.checked ? "1" : "0"); } catch {}
  if (ev.target.checked) scheduleDiskSave();
});
$("#undo").addEventListener("click", undo);
$("#redo").addEventListener("click", redo);
$("#zoom-fit").addEventListener("click", () => scene.fit());
$("#zoom-100").addEventListener("click", () => { scene.view.k = 1; scene.applyView(); });
$("#arrange").addEventListener("click", arrange);
$("#help-toggle").addEventListener("click", () => toggleHelp());
function toggleHelp(force) {
  const panel = $("#help");
  const show = force === undefined ? panel.hidden : force;
  panel.hidden = !show;
  $("#help-toggle").setAttribute("aria-expanded", String(show));
}

// Export is three formats off one drawing: the SVG is the source, and PNG and JPEG are that SVG
// painted onto a canvas, so a raster can never show something the vector does not.
const EXPORTS = [
  { format: "png", label: "PNG", hint: "2x, for slides" },
  { format: "jpg", label: "JPEG", hint: "2x, no transparency" },
  { format: "svg", label: "SVG", hint: "vector, editable" },
];

async function runExport(format) {
  if (!state.doc || !state.doc.nodes.length) return notify("there is nothing to export yet");
  try {
    const { bytes } = await exportScene(scene, state.doc.id, format);
    notify(`${state.doc.id}.${format} saved, ${Math.max(1, Math.round(bytes / 1024))} KB`);
  } catch (e) {
    notify("export failed: " + e.message);
  }
}

// The palette is also an export setting, so it is a control rather than whatever the operating
// system happens to say this evening. Three states, and the choice is remembered.
const THEMES = ["system", "light", "dark"];
function setTheme(name) {
  if (name === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", name);
  $("#theme").textContent = name === "system" ? "Theme" : name === "light" ? "Light" : "Dark";
  try { localStorage.setItem("arkore-canvas:theme", name); } catch { /* private window */ }
}
$("#theme").addEventListener("click", () => {
  const now = document.documentElement.getAttribute("data-theme") || "system";
  setTheme(THEMES[(THEMES.indexOf(now) + 1) % THEMES.length]);
});

$("#export").addEventListener("click", (ev) => {
  const r = ev.currentTarget.getBoundingClientRect();
  showMenu(r.left, r.bottom + 4, EXPORTS.map((e) => ({ label: e.label, hint: e.hint, run: () => runExport(e.format) })));
});

const canvas = $("#canvas-wrap");
canvas.addEventListener("dragover", (ev) => ev.preventDefault());
canvas.addEventListener("drop", (ev) => {
  const id = ev.dataTransfer.getData("text/arkore-component");
  if (!id) return;
  ev.preventDefault();
  createNode(id, scene.toWorld(ev.clientX, ev.clientY));
});

const NUDGE = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

window.addEventListener("keydown", (ev) => {
  const typing = /input|select|textarea/i.test(ev.target.tagName);
  const mod = ev.metaKey || ev.ctrlKey;
  if (mod && ev.key.toLowerCase() === "s") { ev.preventDefault(); save().catch((e) => alert("Save failed: " + e.message)); return; }
  // Ctrl Z undoes; both of the two things people press to redo do redo.
  if (mod && ev.key.toLowerCase() === "z") { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
  if (mod && ev.key.toLowerCase() === "y") { ev.preventDefault(); redo(); return; }
  if (mod && ev.key.toLowerCase() === "n") { ev.preventDefault(); newDesign(); return; }
  if (typing) return;
  if (mod && ev.key === "0") { ev.preventDefault(); scene.fit(); return; }
  if (mod && ev.key === "1") { ev.preventDefault(); scene.view.k = 1; scene.applyView(); return; }
  if (mod && ev.key.toLowerCase() === "a") { ev.preventDefault(); selectAll(); return; }
  if (mod && ev.key.toLowerCase() === "d") { ev.preventDefault(); duplicateSelection(); return; }
  if (mod && ev.shiftKey && ev.key.toLowerCase() === "g") {
    ev.preventDefault();
    if (scene.selection.type === "group") ungroup(scene.selection.ref);
    return;
  }
  if (ev.key === "?" || ev.key === "F1") { ev.preventDefault(); toggleHelp(); return; }
  if (ev.key === "Escape") { closeMenu(); scene.closeEditor(); scene.cancel(); toggleHelp(false); scene.select(null, null); return; }
  if (ev.key === "Enter" && scene.selection.type) { ev.preventDefault(); scene.editLabel(scene.selection.type, scene.selection.ref); return; }
  if (NUDGE[ev.key]) {
    if (!scene.multi.size) return;
    ev.preventDefault();
    const [dx, dy] = NUDGE[ev.key];
    const step = ev.shiftKey ? 10 : 1;
    nudge(dx * step, dy * step);
    return;
  }
  if (ev.key === "Backspace" || ev.key === "Delete") {
    if (!scene.selection.type && !scene.multi.size) return;
    ev.preventDefault();
    deleteSelection();
    return;
  }
  if (ev.key === "g" || ev.key === "G") { if (scene.multi.size) groupSelection(); }
});

window.addEventListener("beforeunload", (ev) => { if (state.dirty) { ev.preventDefault(); ev.returnValue = ""; } });

boot().catch((e) => {
  document.body.innerHTML = `<pre style="padding:24px;white-space:pre-wrap">Arkore canvas could not start.\n\n${e.stack || e.message}\n\nRun: node .claude/tools/build_editor_data.mjs, then node editor/serve.mjs</pre>`;
});
