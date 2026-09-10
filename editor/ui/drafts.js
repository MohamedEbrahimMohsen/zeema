// The crash net. Unsaved work is mirrored into the browser's own store so that closing the tab,
// or a reload nobody meant, does not lose it.
//
// Three rules, and they are here rather than inline in the wiring because each of them has been
// got wrong once:
//
//   1. A draft is only kept for a design that can be saved. Work on a reference design is not on
//      its way to that file, so restoring it would show a curated design as something other than
//      what is on disk, which reads as an edit that was saved and is the whole complaint.
//   2. A draft is only restored onto the same file it was taken from. The base text is hashed at
//      open; a file that changed underneath gets its stale draft dropped, not applied.
//   3. A store that throws is not a reason to stop editing. A private window, a blocked store or
//      a full one all end up here, and all of them mean "no crash net", not "no editor".
//
// The store is an argument so all of this runs under node with a plain object behind it.

const PREFIX = "arkore-canvas:";

export const draftKey = (path) => PREFIX + path;

export function memoryStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    keys: () => [...map.keys()],
  };
}

export function browserStore() {
  return {
    getItem: (k) => localStorage.getItem(k),
    setItem: (k, v) => localStorage.setItem(k, v),
    removeItem: (k) => localStorage.removeItem(k),
    keys: () => Object.keys(localStorage),
  };
}

// Returns whether a draft was written, which is false whenever there is nothing to keep or
// nowhere it could ever go.
export function keepDraft(store, state) {
  if (!store || !state.path || !state.dirty || !state.editable) return false;
  try {
    store.setItem(draftKey(state.path), JSON.stringify({
      base: state.baseHash, doc: state.doc, positions: state.positions, bows: state.bows, at: Date.now(),
    }));
    return true;
  } catch { return false; }
}

// Returns the draft to apply, or null. A draft that will not be used is deleted on the way out,
// so a design opened once is not carrying a stale copy of itself around afterwards.
export function takeDraft(store, { path, editable, baseHash }) {
  if (!store || !path) return null;
  const key = draftKey(path);
  try {
    if (!editable) { store.removeItem(key); return null; }
    const raw = store.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (draft.base !== baseHash) { store.removeItem(key); return null; }
    return draft;
  } catch { return null; }
}

export function dropDraft(store, path) {
  try { if (store && path) store.removeItem(draftKey(path)); } catch { /* nothing to drop */ }
}

// Drafts for designs that can no longer be saved, or no longer exist, are cleared without
// waiting for someone to open one and be surprised by it. Returns the keys removed.
export function sweepDrafts(store, index) {
  const removed = [];
  try {
    for (const key of store.keys()) {
      if (!key.startsWith(PREFIX + "designs/")) continue;
      const entry = index.find((e) => draftKey(e.path) === key);
      if (entry && entry.editable !== false && entry.tier === "authored") continue;
      store.removeItem(key);
      removed.push(key);
    }
  } catch { /* a blocked store has nothing to sweep */ }
  return removed;
}
