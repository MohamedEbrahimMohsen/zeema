// The layout sidecar: the jsonb stored beside a design version, holding everything the picture
// needs and the document must never carry. Node positions, edge bows and ports, and free-text
// notes live here, so a note is not a node: it has no component, it takes no edges, no rule ever sees it,
// and adding one does not touch a byte of the YAML.
//
// This is the one place that says what the sidecar looks like. The API stores it opaquely, so
// the canvas reads through `readSidecar` (which drops anything malformed rather than throwing)
// and writes through the same shape.

export const SIDECAR_VERSION = 2;

/**
 * What a note is pinned to. A note carries at most one anchor, and it names either a node or a
 * group by the id the design document uses. Nothing else in the sidecar refers to the
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
 *    group's computed frame). World top-left = (targetX + targetW + x, targetY + y). The
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

/**
 * The named tints a group may carry. The canvas and the exported SVG each hold one token per
 * named tint (light and dark), so a named tint always reads in both themes.
 */
export const TINTS = ["slate", "blue", "green", "amber", "rose", "violet", "teal"] as const;
export type Tint = (typeof TINTS)[number];
export const isTint = (v: unknown): v is Tint =>
  typeof v === "string" && (TINTS as readonly string[]).includes(v);

/**
 * A free tint: `#rrggbb`, six hex digits and nothing else, so a hand-edited sidecar can carry a
 * colour and never CSS (`#rgb`, an alpha byte, `rgb()`, names and anything longer are refused).
 * It is used as it is in both themes: that is the trade-off of a free colour. HEX_TINT_RE in
 * packages/core/src/render.js says the same.
 */
export type HexTint = `#${string}`;
const HEX_TINT_RE = /^#[0-9a-fA-F]{6}$/;
export const isHexTint = (v: unknown): v is HexTint => typeof v === "string" && HEX_TINT_RE.test(v);
/** Either kind of tint. A hex one should go through `normaliseTint` before it is stored. */
export const isAnyTint = (v: unknown): v is Tint | HexTint => isTint(v) || isHexTint(v);
/** A tint as it is stored: a named one as it is, a hex one lowercased; anything else is null. */
export const normaliseTint = (v: unknown): Tint | HexTint | null =>
  isTint(v) ? v : isHexTint(v) ? (v.toLowerCase() as HexTint) : null;

/**
 * How strongly a tint fills: `light` (half), `normal` (the default, never stored) or `bold`
 * (double). Only `light` and `bold` are kept; anything else reads as normal. TINT_STRENGTHS in
 * packages/core/src/render.js draws them.
 */
export const STRENGTHS = ["light", "normal", "bold"] as const;
export type Strength = (typeof STRENGTHS)[number];
export type StoredStrength = Exclude<Strength, "normal">;
export const readStrength = (v: unknown): StoredStrength | null =>
  v === "light" || v === "bold" ? v : null;

/** A component's tint: presentation only, so it lives here and never in the YAML. */
export type NodeTint = { tint: Tint | HexTint; strength?: StoredStrength };

/**
 * An icon drawn before a group's label, by reference and never by bytes:
 * `kind:<kindId>` is a kind glyph (icons/kinds/<kindId>.svg),
 * `component:<provider>/<componentId>` is a catalogue component's icon and
 * `boundary:<id>` is one of the group marks (icons/boundaries/<id>.svg): a platform or brand
 * (AWS, Kubernetes, GitHub) or a concept (on-premises, internet, users). `<id>` is kebab-case.
 * The user-facing word is group; boundary stays in the stored format.
 */
export const FRAME_ICON_RE =
  /^(kind:[a-z0-9-]+|boundary:[a-z0-9]+(?:-[a-z0-9]+)*|component:[a-z0-9-]+\/[a-z0-9-]+)$/;
export const FRAME_ICON_MAX = 120;
export const isFrameIcon = (v: unknown): v is string =>
  typeof v === "string" && v.length <= FRAME_ICON_MAX && FRAME_ICON_RE.test(v);

/** The key an icon reference has in the catalogue icon map (icons.json), or null. */
export function frameIconKey(ref: string | undefined | null) {
  if (!ref || !isFrameIcon(ref)) return null;
  return ref.startsWith("component:") ? ref.slice(ref.indexOf("/") + 1) : ref;
}

/**
 * The mark a design's list row wears, when its owner chose one: `provider:<id>` is a provider
 * (a folder under components/, its mark under icons/providers) and `boundary:<id>` is one of
 * the group marks (icons/boundaries/<id>.svg). Kind and component refs are not badges. Absent,
 * the list picks one itself (badge.ts). The shape is checked here; whether the id exists is
 * the catalogue's business, and a ref it does not know falls back to the automatic choice.
 */
export const BADGE_RE = /^(provider:[a-z0-9]+(?:-[a-z0-9]+)*|boundary:[a-z0-9]+(?:-[a-z0-9]+)*)$/;
export const isBadgeRef = (v: unknown): v is string =>
  typeof v === "string" && v.length <= FRAME_ICON_MAX && BADGE_RE.test(v);

/** How a group is drawn: presentation only, so it lives here and never in the YAML. */
export type FrameStyle = { tint?: Tint | HexTint; icon?: string; strength?: StoredStrength };
export const FRAME_MAX_STYLES = 500;
const GROUP_ID_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Where one end of an edge meets its box: a side, and how far along it, 0 to 1 (left to right on
 * top and bottom, top to bottom on left and right). Relative to the box, so it follows the box.
 * `portPoint`/`portAt` in @zeema/core/geometry are the one place it is turned into a point.
 */
export type PortSide = "top" | "right" | "bottom" | "left";
export type Port = { side: PortSide; t: number };
/** The ports an edge's ends were dragged to. An end with no port is clipped automatically. */
export type EdgePorts = { from?: Port; to?: Port };
const PORT_SIDES: readonly PortSide[] = ["top", "right", "bottom", "left"];

export type LayoutSidecar = {
  version: number;
  nodes: Record<string, [number, number]>;
  edges: Record<string, number>;
  /** Keyed like `edges` (see `edgeKeys`). Absent when no edge has a port. */
  ports?: Record<string, EdgePorts>;
  notes: Note[];
  /** Keyed by group id. A group with no entry is drawn in the default frame colour. */
  frames: Record<string, FrameStyle>;
  /** Component tints, keyed by node id. Absent when no component has one. */
  tints?: Record<string, NodeTint>;
  /** The list badge its owner chose (see `BADGE_RE`). Absent: chosen automatically. */
  badge?: string;
};

export const NOTE_MIN_W = 80;
export const NOTE_MIN_H = 48;
// A sidecar is stored opaquely, so a corrupt or hand-edited one can say anything. These are the
// ceilings the reader clamps to: a note box no larger than a very large board, a text no longer
// than a long paragraph, and a list no longer than a canvas anyone would draw. Past them the
// picture would not be readable anyway, and the renderer would be laying out megabytes of text.
export const NOTE_MAX_W = 4000;
export const NOTE_MAX_H = 4000;
export const NOTE_MAX_TEXT = 2000;
export const NOTE_MAX_NOTES = 200;
// Sized for the note font (see NOTE_FONT in canvas/scene.ts): the text got a step smaller, so
// the boxes came down with it and the same sentence still fills about the same space.
export const NOTE_DEFAULT_W = 184;
export const NOTE_DEFAULT_H = 88;

const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

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
    w: Math.round(clamp(num(r.w, NOTE_DEFAULT_W), NOTE_MIN_W, NOTE_MAX_W)),
    h: Math.round(clamp(num(r.h, NOTE_DEFAULT_H), NOTE_MIN_H, NOTE_MAX_H)),
    text: typeof r.text === "string" ? r.text.slice(0, NOTE_MAX_TEXT) : "",
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
  // The count is capped the same way the text is: the first NOTE_MAX_NOTES readable notes are
  // kept and the rest are dropped, so a runaway or hostile sidecar cannot stall a render.
  const notes = Array.isArray(r.notes)
    ? (r.notes
        .slice(0, NOTE_MAX_NOTES)
        .map((n) => readNote(n, present))
        .filter(Boolean) as Note[])
    : ([] as Note[]);
  const frames = readFrames(r.frames, present);
  const out: LayoutSidecar = {
    version: num(r.version, SIDECAR_VERSION),
    nodes,
    edges,
    notes,
    frames,
  };
  const ports = readPorts(r.ports);
  if (Object.keys(ports).length) out.ports = ports;
  const tints = readTints(r.tints, present);
  if (Object.keys(tints).length) out.tints = tints;
  if (isBadgeRef(r.badge)) out.badge = r.badge;
  return out;
}

/**
 * The component tints a sidecar holds: a tint that is neither named nor `#rrggbb` drops the
 * entry, a strength other than light or bold is dropped (normal is the default). With targets,
 * a tint for a node the design no longer has is dropped, as a stale group style is.
 */
export function readTints(
  raw: unknown,
  present?: { nodes: Set<string> } | null,
): Record<string, NodeTint> {
  const out: Record<string, NodeTint> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  let kept = 0;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (kept >= FRAME_MAX_STYLES) break;
    // A node id is kebab-case too, which keeps `__proto__` out of the map.
    if (!GROUP_ID_RE.test(id) || (present && !present.nodes.has(id))) continue;
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    const tint = normaliseTint(r.tint);
    if (!tint) continue;
    const entry: NodeTint = { tint };
    const strength = readStrength(r.strength);
    if (strength) entry.strength = strength;
    out[id] = entry;
    kept++;
  }
  return out;
}

/** The component tints whose node still exists. Like `pruneFrames`, it copies. */
export function pruneTints(tints: Record<string, NodeTint>, nodes: Iterable<string>) {
  const keep = new Set(nodes);
  const out: Record<string, NodeTint> = {};
  for (const [id, t] of Object.entries(tints)) if (keep.has(id)) out[id] = t;
  return out;
}

/** Follow a node rename: its tint goes with it. Mutates, like `retargetFrame`. */
export function retargetTint(tints: Record<string, NodeTint>, from: string, to: string) {
  if (from === to || !Object.hasOwn(tints, from)) return;
  tints[to] = tints[from];
  delete tints[from];
}

/** A port as stored: a known side and a finite `t`, clamped to [0, 1] and rounded to 3 places. */
export function readPort(raw: unknown): Port | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!PORT_SIDES.includes(r.side as PortSide)) return null;
  if (typeof r.t !== "number" || !Number.isFinite(r.t)) return null;
  return { side: r.side as PortSide, t: Math.round(clamp(r.t, 0, 1) * 1000) / 1000 };
}

// An edge key is `from>to` or `from>to#n`, so a key without `>` is not one, and that also keeps
// `__proto__` and its friends from ever becoming a key here.
const EDGE_KEY_MAX = 400;
const isEdgeKey = (k: string) => k.length <= EDGE_KEY_MAX && /^[^>]+>[^>]+$/.test(k);

/** The edge ports a sidecar holds. A malformed end is dropped, and an entry left empty with it. */
export function readPorts(raw: unknown): Record<string, EdgePorts> {
  const out: Record<string, EdgePorts> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isEdgeKey(key) || !v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    const entry: EdgePorts = {};
    const from = readPort(r.from);
    const to = readPort(r.to);
    if (from) entry.from = from;
    if (to) entry.to = to;
    if (entry.from || entry.to) out[key] = entry;
  }
  return out;
}

/** The ports whose edge still exists. Like `pruneFrames`, it copies. */
export function prunePorts(ports: Record<string, EdgePorts>, keys: Iterable<string>) {
  const keep = new Set(keys);
  const out: Record<string, EdgePorts> = {};
  for (const [k, v] of Object.entries(ports)) if (keep.has(k)) out[k] = v;
  return out;
}

/**
 * The group styles a sidecar holds. A tint that is neither a named one nor `#rrggbb` (kept,
 * lowercased), or an icon reference of the wrong shape, is dropped, and an entry left with
 * nothing in it goes with it. With targets, a style for a group the design no longer has is
 * dropped too, the way a stale anchor is.
 */
export function readFrames(
  raw: unknown,
  present?: { groups: Set<string> } | null,
): Record<string, FrameStyle> {
  const out: Record<string, FrameStyle> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  let kept = 0;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (kept >= FRAME_MAX_STYLES) break;
    // A group id is kebab-case (the schema says so), which also keeps `__proto__` and its
    // friends from ever becoming a key here.
    if (!GROUP_ID_RE.test(id) || (present && !present.groups.has(id))) continue;
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    const style: FrameStyle = {};
    const tint = normaliseTint(r.tint);
    if (tint) style.tint = tint;
    // A strength says how a tint fills, so it means nothing without one.
    const strength = readStrength(r.strength);
    if (tint && strength) style.strength = strength;
    if (isFrameIcon(r.icon)) style.icon = r.icon;
    if (!style.tint && !style.icon) continue;
    out[id] = style;
    kept++;
  }
  return out;
}

/** What the canvas sends back. Notes travel with the positions, in the same save request. */
export function writeSidecar(
  s: Omit<LayoutSidecar, "version" | "frames"> & { frames?: Record<string, FrameStyle> },
): LayoutSidecar {
  const out: LayoutSidecar = {
    version: SIDECAR_VERSION,
    nodes: s.nodes,
    edges: s.edges,
    notes: s.notes,
    frames: s.frames ?? {},
  };
  // Absent rather than empty, so a design nobody has ported stores the bytes it always did.
  if (s.ports && Object.keys(s.ports).length) out.ports = s.ports;
  if (s.tints && Object.keys(s.tints).length) out.tints = s.tints;
  if (isBadgeRef(s.badge)) out.badge = s.badge;
  return out;
}

/**
 * Whether a sidecar holds nothing that is drawn: no position, bow, port, note or group style.
 * Such a sidecar draws exactly what no sidecar does (the engine lays the design out itself),
 * whatever its `badge` says.
 */
export function isBlankSidecar(raw: unknown) {
  if (raw == null) return true;
  const s = readSidecar(raw);
  return (
    !Object.keys(s.nodes).length &&
    !Object.keys(s.edges).length &&
    !s.notes.length &&
    !Object.keys(s.frames).length &&
    !s.ports &&
    !s.tints
  );
}

/** The group styles whose group still exists. Like `pruneAnchored`, it copies. */
export function pruneFrames(frames: Record<string, FrameStyle>, groups: Iterable<string>) {
  const keep = new Set(groups);
  const out: Record<string, FrameStyle> = {};
  for (const [id, style] of Object.entries(frames)) if (keep.has(id)) out[id] = style;
  return out;
}

/** Follow a group rename: its colour and icon go with it. Mutates, like `retargetAnchors`. */
export function retargetFrame(frames: Record<string, FrameStyle>, from: string, to: string) {
  if (from === to || !Object.hasOwn(frames, from)) return;
  frames[to] = frames[from];
  delete frames[from];
}

/**
 * The notes that still have something to hang on. A note anchored to a node or group that
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

/** What a design holds, by the ids a sidecar keys on: node ids, group ids and edge keys. */
export type SidecarTargets = {
  nodes: Iterable<string>;
  groups: Iterable<string>;
  /** Edge keys as `edgeKeys` in @zeema/core/geometry makes them. */
  edges: Iterable<string>;
};

/**
 * The sidecar cut down to what the design holds: positions, bows, ports and group styles whose
 * node, edge or group is gone are dropped, and a note whose anchor is gone is kept, unanchored,
 * the way the canvas opens it. The canvas prunes as it edits; this is for a sidecar that arrives
 * from outside with its design (an import) or leaves beside it (an export). It copies.
 */
export function pruneSidecar(s: LayoutSidecar, targets: SidecarTargets): LayoutSidecar {
  const nodes = new Set(targets.nodes);
  const groups = new Set(targets.groups);
  const edges = new Set(targets.edges);
  const keep = <T>(o: Record<string, T>, ids: Set<string>) =>
    Object.fromEntries(Object.entries(o).filter(([k]) => ids.has(k)));
  const out: LayoutSidecar = {
    version: s.version,
    nodes: keep(s.nodes, nodes),
    edges: keep(s.edges, edges),
    notes: s.notes.map((n) => {
      if (!n.anchor) return { ...n };
      const live = "node" in n.anchor ? nodes.has(n.anchor.node) : groups.has(n.anchor.group);
      if (live) return { ...n, anchor: { ...n.anchor } };
      const { anchor: _gone, ...free } = n;
      return free;
    }),
    frames: keep(s.frames, groups),
  };
  const ports = s.ports ? keep(s.ports, edges) : {};
  if (Object.keys(ports).length) out.ports = ports;
  const tints = s.tints ? keep(s.tints, nodes) : {};
  if (Object.keys(tints).length) out.tints = tints;
  if (s.badge) out.badge = s.badge;
  return out;
}

const sortedEntries = <T>(o: Record<string, T>) =>
  Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

/**
 * A sidecar as the file `design.layout.json`: read through `readSidecar`, then written with a
 * fixed key order (version, nodes, edges, ports, frames, tints, notes, badge; map keys sorted; a note's
 * fields in declaration order), two-space indent and a trailing newline. The same sidecar always
 * gives the same bytes, whatever order the database handed its keys back in.
 */
export function sidecarFile(raw: unknown): string {
  const s = readSidecar(raw);
  const file: Record<string, unknown> = {
    version: s.version,
    nodes: Object.fromEntries(sortedEntries(s.nodes)),
    edges: Object.fromEntries(sortedEntries(s.edges)),
  };
  if (s.ports)
    file.ports = Object.fromEntries(
      sortedEntries(s.ports).map(([k, p]) => {
        const e: EdgePorts = {};
        if (p.from) e.from = { side: p.from.side, t: p.from.t };
        if (p.to) e.to = { side: p.to.side, t: p.to.t };
        return [k, e];
      }),
    );
  file.frames = Object.fromEntries(
    sortedEntries(s.frames).map(([k, f]) => {
      const st: FrameStyle = {};
      if (f.tint) st.tint = f.tint;
      if (f.icon) st.icon = f.icon;
      if (f.strength) st.strength = f.strength;
      return [k, st];
    }),
  );
  if (s.tints)
    file.tints = Object.fromEntries(
      sortedEntries(s.tints).map(([k, t]) => {
        const e: NodeTint = { tint: t.tint };
        if (t.strength) e.strength = t.strength;
        return [k, e];
      }),
    );
  file.notes = s.notes.map((n) => {
    const note: Note = { id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, text: n.text };
    if (n.anchor)
      note.anchor = "node" in n.anchor ? { node: n.anchor.node } : { group: n.anchor.group };
    return note;
  });
  if (s.badge) file.badge = s.badge;
  return `${JSON.stringify(file, null, 2)}\n`;
}
