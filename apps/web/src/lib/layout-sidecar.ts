// The layout sidecar: the jsonb stored beside a design version, holding everything the picture
// needs and the document must never carry. Node positions, edge bows and free-text notes live
// here, so a note is not a node: it has no component, it takes no edges, no rule ever sees it,
// and adding one does not touch a byte of the YAML.
//
// This is the one place that says what the sidecar looks like. The API stores it opaquely, so
// the canvas reads through `readSidecar` (which drops anything malformed rather than throwing)
// and writes through the same shape.

export const SIDECAR_VERSION = 2;

/**
 * What a note is pinned to. A note carries at most one anchor, and it names either a node or a
 * boundary by the id the design document uses. Nothing else in the sidecar refers to the
 * document, so this is the only place an id can go stale.
 */
export type NoteAnchor = { node: string } | { group: string };

/** The id an anchor names, whichever kind it is. */
export const anchorTarget = (a: NoteAnchor) => ("node" in a ? a.node : a.group);

/** One string that names a target across both kinds, for grouping and for pinning. */
export const anchorKey = (a: NoteAnchor) => ("node" in a ? `node:${a.node}` : `group:${a.group}`);

/**
 * A free-text annotation on the canvas. Not a node; not part of the design document.
 *
 * `x`/`y` mean one of two things, and `anchor` says which:
 *  - no anchor: world coordinates, the note's own top-left corner on the canvas.
 *  - anchored: an OFFSET from the TOP-RIGHT corner of the target's box (a node's box, or a
 *    boundary's computed frame). World top-left = (targetX + targetW + x, targetY + y). The
 *    default offset puts the note just outside that corner, and the target's corner is where
 *    the "hidden notes here" marker appears, so one corner explains both.
 * `w`/`h` are always a size in world units.
 */
export type Note = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  anchor?: NoteAnchor;
};

/** Where a new anchored note sits: just outside the target's top-right corner. */
export const NOTE_ANCHOR_DX = 24;
export const NOTE_ANCHOR_DY = -8;
export const NOTE_ANCHOR_W = 148;
export const NOTE_ANCHOR_H = 66;

export type LayoutSidecar = {
  version: number;
  nodes: Record<string, [number, number]>;
  edges: Record<string, number>;
  notes: Note[];
};

export const NOTE_MIN_W = 80;
export const NOTE_MIN_H = 48;
// Sized for the note font (see NOTE_FONT in canvas/scene.ts): the text got a step smaller, so
// the boxes came down with it and the same sentence still fills about the same space.
export const NOTE_DEFAULT_W = 184;
export const NOTE_DEFAULT_H = 88;

const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** What the design currently holds, so a stale anchor can be spotted. */
export type AnchorTargets = { nodes?: Iterable<string>; groups?: Iterable<string> };

function readAnchor(raw: unknown, present: { nodes: Set<string>; groups: Set<string> } | null) {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.node === "string" && r.node)
    return !present || present.nodes.has(r.node) ? ({ node: r.node } as NoteAnchor) : undefined;
  if (typeof r.group === "string" && r.group)
    return !present || present.groups.has(r.group) ? ({ group: r.group } as NoteAnchor) : undefined;
  return undefined;
}

function readNote(
  raw: unknown,
  present: { nodes: Set<string>; groups: Set<string> } | null,
): Note | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  const anchor = readAnchor(r.anchor, present);
  const note: Note = {
    id: r.id,
    x: Math.round(num(r.x, 0)),
    y: Math.round(num(r.y, 0)),
    w: Math.round(Math.max(NOTE_MIN_W, num(r.w, NOTE_DEFAULT_W))),
    h: Math.round(Math.max(NOTE_MIN_H, num(r.h, NOTE_DEFAULT_H))),
    text: typeof r.text === "string" ? r.text : "",
  };
  // An anchor whose target has gone is dropped, not an error: the note stays where it was
  // drawn last, as a free-floating one. A design must open whatever the sidecar says.
  if (anchor) note.anchor = anchor;
  return note;
}

/**
 * Read whatever the database holds into the shape the canvas works with. Unknown keys are
 * dropped and a malformed entry is skipped: a sidecar is a convenience, and a bad one must
 * never stop a design from opening.
 */
export function readSidecar(raw: unknown, targets?: AnchorTargets): LayoutSidecar {
  const present = targets
    ? { nodes: new Set(targets.nodes ?? []), groups: new Set(targets.groups ?? []) }
    : null;
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const nodes: Record<string, [number, number]> = {};
  if (r.nodes && typeof r.nodes === "object")
    for (const [id, p] of Object.entries(r.nodes as Record<string, unknown>))
      if (Array.isArray(p) && p.length >= 2 && typeof p[0] === "number" && typeof p[1] === "number")
        nodes[id] = [p[0], p[1]];
  const edges: Record<string, number> = {};
  if (r.edges && typeof r.edges === "object")
    for (const [key, v] of Object.entries(r.edges as Record<string, unknown>))
      if (typeof v === "number" && Number.isFinite(v)) edges[key] = v;
  const notes = Array.isArray(r.notes)
    ? (r.notes.map((n) => readNote(n, present)).filter(Boolean) as Note[])
    : ([] as Note[]);
  return { version: num(r.version, SIDECAR_VERSION), nodes, edges, notes };
}

/** What the canvas sends back. Notes travel with the positions, in the same save request. */
export function writeSidecar(s: Omit<LayoutSidecar, "version">): LayoutSidecar {
  return { version: SIDECAR_VERSION, nodes: s.nodes, edges: s.edges, notes: s.notes };
}

/**
 * The notes that still have something to hang on. A note anchored to a node or boundary that
 * has just been deleted goes with it, which is why the caller runs this inside the same undo
 * step as the deletion.
 */
export function pruneAnchored(notes: Note[], targets: AnchorTargets): Note[] {
  const nodes = new Set(targets.nodes ?? []);
  const groups = new Set(targets.groups ?? []);
  return notes.filter((n) =>
    !n.anchor ? true : "node" in n.anchor ? nodes.has(n.anchor.node) : groups.has(n.anchor.group),
  );
}

/** Follow a rename: an id that changes must take the anchors that name it with it. */
export function retargetAnchors(notes: Note[], kind: "node" | "group", from: string, to: string) {
  for (const n of notes) {
    if (!n.anchor) continue;
    if (kind === "node" && "node" in n.anchor && n.anchor.node === from) n.anchor = { node: to };
    else if (kind === "group" && "group" in n.anchor && n.anchor.group === from)
      n.anchor = { group: to };
  }
}

/** A note id nothing else on this canvas is using. */
export function nextNoteId(taken: Iterable<string>) {
  const used = new Set(taken);
  for (let i = 1; ; i++) if (!used.has(`note-${i}`)) return `note-${i}`;
}
