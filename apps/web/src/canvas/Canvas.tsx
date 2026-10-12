"use client";

// The canvas shell. React renders the frame once and re-renders the side panels only at commit
// boundaries; positions live in refs and go straight to the SVG during a drag. Every change goes
// through `commit`, which snapshots first, so undo and redo are uniform.
import { ruleReads } from "@zeema/core/describe";
import * as D from "@zeema/core/document";
import {
  edgeKeys,
  innermostFrameAt,
  readRouting,
  rekeyBows,
  rekeyLabels,
  rekeyPorts,
} from "@zeema/core/geometry";
import { layout } from "@zeema/core/layout";
import { toMermaid } from "@zeema/core/render";
import { runRules } from "@zeema/core/rules";
import { check } from "@zeema/core/structure";
import { parse, serialize } from "@zeema/core/yaml";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BadgeMenuData } from "@/components/BadgePicker";
import { useConfirm } from "@/components/ConfirmDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { badgeOf, brandOf } from "@/lib/badge";
import {
  type ImportMode,
  importNotice,
  LayoutImportError,
  mergeImportedLayout,
  pendingLayoutKey,
  readLayoutText,
} from "@/lib/layout-import";
import {
  type EdgePath,
  type EdgePorts,
  type FrameStyle,
  type LabelOffset,
  NOTE_ANCHOR_DX,
  NOTE_ANCHOR_DY,
  NOTE_ANCHOR_H,
  NOTE_ANCHOR_W,
  NOTE_DEFAULT_H,
  NOTE_DEFAULT_W,
  type NodeTint,
  type Note,
  type NoteAnchor,
  nextNoteId,
  type Port,
  type PortSide,
  pruneAnchored,
  pruneFrames,
  prunePorts,
  pruneTints,
  type Routing,
  readEdgePath,
  readLabelOffset,
  readPort,
  readRoutingField,
  readSidecar,
  retargetAnchors,
  retargetFrame,
  retargetTint,
  writeSidecar,
} from "@/lib/layout-sidecar";
import { confirmThenPublish } from "@/lib/publish";
import { publishSlugFor } from "@/lib/slug";
import { BadgeRow } from "./BadgeRow";
import { ContextMenu } from "./ContextMenu";
import { exportScene, saveFile } from "./exportScene";
import { type CanvasFinding, FindingRow, FindingsPanel, findingRows } from "./FindingsPanel";
import { GroupPicker } from "./GroupPicker";
import { type HoverAt, HoverCard, type RefInfo } from "./HoverCard";
import { historyKey } from "./history-key";
import { EdgeStyleField, type Highlight, Inspector, type InspectorApi } from "./Inspector";
import { designMenu, type MenuEntry, SEP } from "./menu-model";
import { readExpanded, writeExpanded } from "./modules";
import { Palette, ProviderSprite } from "./Palette";
import { dimmed, readDim, readHoverCards, writeDim, writeHoverCards } from "./prefs";
import { QuickActions } from "./QuickActions";
import type { QuickAction, QuickTarget } from "./quick-actions";
import { RefPreview, type RefTarget } from "./RefPreview";
import {
  fetchRefSummary,
  RefStore,
  refColor,
  refHref,
  refNameFor,
  wantsRefPicker,
} from "./ref-state";
import { Switch } from "./Switch";
import {
  DIM_EDGES_OVER,
  type DimEdges,
  facingSide,
  type Picked,
  Scene,
  type Subject,
  ZOOM_MAX,
  ZOOM_MIN,
} from "./scene";
import "./canvas.css";

type Props = {
  owner: string;
  slug: string;
  title: string;
  yaml: string;
  /** The jsonb stored beside the version; see lib/layout-sidecar.ts for its shape. */
  layoutSidecar: unknown;
  contentHash: string;
  canWrite: boolean;
  canClone: boolean;
  signedIn: boolean;
  /** The head is ahead of the release. */
  unpublished: boolean;
  /** The number the next release takes (designs.ts `releaseNumbers`), said in the publish question. */
  nextRelease?: number;
  /** Said in the publish question: a public release reaches readers, a private one does not. */
  visibility: "public" | "private";
  /** The owner may delete it: an authored design they can write. */
  canDelete?: boolean;
  /** Who is looking, for the avatar menu in the top-right pill; null when signed out. */
  user?: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    isAdmin: boolean;
    actingAdmin: boolean;
  } | null;
  /**
   * The list badge chooser's marks, for the owner only (brand.ts reads them from disk, so the
   * server sends them). `current` is ignored here: the canvas reads the choice from the sidecar
   * it holds. `auto` is what automatic picks for a design with a brand; otherwise the canvas
   * works it out from the live document.
   */
  badgeMenu?: BadgeMenuData;
};

type Bundle = { catalogue: any; search: any[]; icons: Record<string, string> };

type Engine = {
  doc: any;
  cst: any;
  positions: Record<string, [number, number]>;
  sizes: Record<string, [number, number]>;
  /** Hand-adjusted edge paths by edge key (a bow, or waypoints): sidecar, never YAML. */
  bows: Record<string, EdgePath>;
  /** Where each edge's ends meet their boxes, by edge key: sidecar, never YAML. */
  ports: Record<string, EdgePorts>;
  /** Where each edge's label was dragged, as an offset from its automatic place: sidecar. */
  labels: Record<string, LabelOffset>;
  notes: Note[];
  /** Group tint and icon by group id: sidecar, never YAML. */
  frames: Record<string, FrameStyle>;
  /** Component tints by node id: sidecar, never YAML. */
  tints: Record<string, NodeTint>;
  /** The list badge the owner chose (Design settings here, or the design page): sidecar, never
   *  YAML. It rides the canvas's own save, so a save never drops it. */
  badge?: string;
  /** How edges are drawn (Design settings): sidecar, never YAML. Absent: the engine's default. */
  routing?: Routing;
  undo: any[];
  redo: any[];
  dirty: boolean;
  lastDragAt: number;
  baseHash: string;
  saveSeq: number;
  structural: CanvasFinding[];
  rules: CanvasFinding[];
};

const clone = (x: unknown) => JSON.parse(JSON.stringify(x));

/** Where a component chosen in the picker lands, and the port dot it is wired from, if any. */
type Wiring = { id: string; side: PortSide; start: [number, number] };
type Place = { at: [number, number]; from?: Wiring };

/**
 * What Ctrl+C copies (core's `copyFragment`) with the layout it had: positions, group styles and
 * component tints by id, each copied edge's ports and shaped path in edge order, and the notes
 * pinned to anything copied. It goes on the system clipboard as JSON in this envelope.
 */
type Clip = {
  zeema: "clipboard";
  version: 1;
  nodes: any[];
  groups: any[];
  edges: any[];
  layout: {
    positions: Record<string, [number, number]>;
    frames: Record<string, FrameStyle>;
    tints: Record<string, NodeTint>;
    ports: Array<EdgePorts | null>;
    paths: Array<EdgePath | null>;
    labels: Array<LabelOffset | null>;
    notes: Note[];
  };
};

const isRecord = (v: unknown): v is Record<string, any> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

/** A clip read back from clipboard text, or null when the text is not one. */
function readClip(text: string): Clip | null {
  let v: any;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(v) || v.zeema !== "clipboard" || v.version !== 1) return null;
  const list = (x: unknown) => (Array.isArray(x) ? x : []);
  const nodes = list(v.nodes).filter((n) => isRecord(n) && typeof n.id === "string");
  const groups = list(v.groups).filter((g) => isRecord(g) && typeof g.id === "string");
  if (!nodes.length && !groups.length) return null;
  const edges = list(v.edges).filter(
    (e) => isRecord(e) && typeof e.from === "string" && typeof e.to === "string",
  );
  const L = isRecord(v.layout) ? v.layout : {};
  // The layout is read the way a stored sidecar is, so a clip can carry nothing a save would not.
  const side = readSidecar({
    nodes: L.positions,
    frames: L.frames,
    tints: L.tints,
    notes: list(L.notes).filter((n) => isRecord(n) && isRecord(n.anchor)),
  });
  // Edge-ordered lists only line up when nothing was dropped above.
  const aligned = edges.length === list(v.edges).length;
  const port = (x: any): EdgePorts | null => {
    if (!isRecord(x)) return null;
    const out: EdgePorts = {};
    const from = readPort(x.from);
    const to = readPort(x.to);
    if (from) out.from = from;
    if (to) out.to = to;
    return from || to ? out : null;
  };
  return {
    zeema: "clipboard",
    version: 1,
    nodes,
    groups,
    edges,
    layout: {
      positions: side.nodes,
      frames: side.frames,
      tints: side.tints ?? {},
      ports: aligned ? list(L.ports).map(port) : [],
      paths: aligned ? list(L.paths).map(readEdgePath) : [],
      labels: aligned ? list(L.labels).map(readLabelOffset) : [],
      notes: side.notes.filter((n) => n.anchor),
    },
  };
}

/** The ports with one end of one edge set, or cleared with null. Copies; an empty entry goes. */
const withPort = (
  ports: Record<string, EdgePorts>,
  key: string,
  end: "from" | "to",
  port: Port | null,
) => {
  const next = { ...ports };
  const entry: EdgePorts = { ...(next[key] ?? {}) };
  if (port) entry[end] = port;
  else delete entry[end];
  if (entry.from || entry.to) next[key] = entry;
  else delete next[key];
  return next;
};

// Whether notes are shown is a habit, not a property of the design: it lives in this browser
// and applies to every canvas the person opens. One key, and a storage that may refuse to
// answer at all (private windows, blocked site data) never stops the canvas loading.
const NOTES_KEY = "zeema.canvas.notes";
const readNotesPref = () => {
  try {
    return window.localStorage.getItem(NOTES_KEY) !== "hidden";
  } catch {
    return true;
  }
};

// The side panels are the same kind of habit, under one key. `left` is the component picker
// pinned open as a docked panel (off by default: it is a popover over the dock); `right` is
// whether the inspector card may show when something is selected (on by default); `design` is
// the Design settings card pinned, so it stays while things are selected (off by default).
const PANES_KEY = "zeema.canvas.panes";
type Panes = { left: boolean; right: boolean; design: boolean };
const PANES_DEFAULT: Panes = { left: false, right: true, design: false };
const readPanes = (): Panes => {
  try {
    const v = JSON.parse(window.localStorage.getItem(PANES_KEY) ?? "{}");
    return { left: v?.left === true, right: v?.right !== false, design: v?.design === true };
  } catch {
    return PANES_DEFAULT;
  }
};

// Dim edges on a dense canvas and hover cards are the same kind of habit (prefs.ts). Dimming
// follows DIM_EDGES_OVER until the first click stores an explicit choice; the picture that
// leaves the page is never dimmed.

// "Most used" in the picker: the last components this browser placed, newest first.
const RECENT_KEY = "zeema.palette.recent";
const RECENT_MAX = 8;
const readRecent = (): string[] => {
  try {
    const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
};

// The zoom menu's fixed steps, and the factor Zoom in and Zoom out move by.
/** Group styles with a patch applied to each id given. Tint, strength and icon are layout only. */
function styleFrames(
  frames: Record<string, FrameStyle>,
  ids: string[],
  patch: { tint?: FrameStyle["tint"]; icon?: string; strength?: string },
): Record<string, FrameStyle> {
  const out = { ...frames };
  for (const id of ids) {
    const { strength, ...rest } = { ...(out[id] ?? {}), ...patch };
    const next: FrameStyle = rest;
    if (!next.tint) delete next.tint;
    if (!next.icon) delete next.icon;
    // A strength only says how a tint fills: normal is the default and never stored.
    if (next.tint && (strength === "light" || strength === "bold")) next.strength = strength;
    if (next.tint || next.icon) out[id] = next;
    else delete out[id];
  }
  return out;
}

/** Component tints with a patch applied to each id given; no tint left clears the entry. */
function tintNodes(
  tints: Record<string, NodeTint>,
  ids: string[],
  patch: { tint?: NodeTint["tint"]; strength?: string },
): Record<string, NodeTint> {
  const out = { ...tints };
  for (const id of ids) {
    const merged = { ...(out[id] ?? {}), ...patch } as Partial<NodeTint> & { strength?: string };
    if (!merged.tint) {
      delete out[id];
      continue;
    }
    const entry: NodeTint = { tint: merged.tint };
    if (merged.strength === "light" || merged.strength === "bold") entry.strength = merged.strength;
    out[id] = entry;
  }
  return out;
}

const ZOOM_STEP = 1.25;
// How long the pointer rests on a component or a group label before its hover card shows.
const HOVER_DELAY = 350;
// How long a hovered finding-dot list waits after the pointer leaves, in ms.
const DOT_POP_GRACE = 300;
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** Everything a note is allowed to be anchored to, as the document currently stands. */
const anchorables = (doc: any) => ({
  nodes: doc.nodes.map((n: any) => n.id as string),
  groups: ((doc.groups ?? []) as any[]).map((g) => g.id as string),
});
// The canvas writes its shortcuts the way the platform does: ⌘ on a Mac, the caret elsewhere.
// One helper, so the toolbar hints and the help dialog can never drift apart.
const onMac = () =>
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad|ipod/i.test((navigator as any).platform || navigator.userAgent);
const useModKey = () => {
  // Resolved after mount: the server has no navigator, and a guess would break hydration.
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(onMac()), []);
  return { short: mac ? "⌘" : "⌃", long: mac ? "⌘" : "Ctrl" };
};

/**
 * Every key and gesture the canvas binds, grouped the way someone looks for them. Each row is
 * [what you press or do, what it does]. Nothing is listed here that the handlers below and in
 * scene.ts do not actually bind.
 */
const helpSections = (mod: string): Array<[string, Array<[string[], string]>]> => [
  [
    "Place and wire",
    [
      [["+", "/"], "Open the component picker."],
      [[mod, "K"], "Quick actions: every command, component and box, by name."],
      [
        ["Click", "Drag"],
        "Add a component: click it in the picker to drop it in the middle, or drag it where you want it.",
      ],
      [["Drag a dot"], "Wire an edge: drag a component's dot onto another component."],
      [
        ["Drag a dot", "to empty space"],
        "Pick a component to add there, already wired from where you started.",
      ],
      [
        ["Drag a group"],
        "Groups don't connect. Wire the components inside one — or add an External system node for something outside your control.",
      ],
    ],
  ],
  [
    "Select and move",
    [
      [["V"], "The select tool: click to select, drag to move or sweep."],
      [["H"], "The hand tool: drag anywhere to pan, until V."],
      [
        ["Shift", "H"],
        "Hover cards on or off. Off, resting on a component or an edge shows no card; the highlight stays.",
      ],
      [["Click"], "Select what you click; empty space clears the selection."],
      [
        ["Shift", "Click"],
        `Add a component, a group or an edge to the selection, or take it out. ${mod} Click too.`,
      ],
      [
        ["Drag"],
        "Sweep a box over empty space: the components it touches, the edges wholly inside it and the edges between what it picks. Shift keeps what you had.",
      ],
      [[mod, "A"], "Select everything: components, groups and edges."],
      [["Drag"], "Move the selection."],
      [
        ["Alt", "Drag"],
        "Move without snapping. A plain drag lines edges and centres up with nearby boxes and shows the guide.",
      ],
      [
        ["Drag"],
        "Drag a component into another group to move it there. Shift-drag to take it out of its group: into any group, or to the top level.",
      ],
      [
        ["Drag a group"],
        "Move a group with everything inside it; let go over another group to nest it there.",
      ],
      [["←", "→", "↑", "↓"], "Nudge the selection by a pixel; a group takes its members with it."],
      [["Shift", "←"], "Nudge by ten pixels."],
      [
        ["Hover"],
        "Light a component, its edges and its neighbours, and fade the rest; on an edge, the edge and its two ends.",
      ],
      [
        ["Click"],
        "Pin that highlight: it stays until Esc, a click on empty space or another click. Panning and zooming keep it.",
      ],
      [
        ["Alt", "Click"],
        "Trace a component's flow: light everything upstream of it, or downstream for a source nothing points at. T does it for the selected component.",
      ],
      [
        ["Esc"],
        "Drop a pinned highlight, then clear the selection, or abandon what you are dragging.",
      ],
    ],
  ],
  [
    "Edit",
    [
      [["Double-click"], "Rename what you clicked: a component, an edge or a group."],
      [["Enter"], "Rename the selection."],
      [["G"], "Put the selection in a new group."],
      [[mod, "Shift", "G"], "Ungroup the selected group; its components stay."],
      [[mod, "D"], "Duplicate the selection; a group comes with everything inside it."],
      [[mod, "C"], "Copy the selection, to paste here or in another design."],
      [[mod, "X"], "Cut the selection."],
      [[mod, "V"], "Paste what was copied."],
      [["Del", "Backspace"], "Delete the selection."],
      [["Drag an edge"], "Bow it away from the straight line."],
      [
        ["Drag an arrow's end"],
        "Along its box: choose where it attaches. Onto another component: reconnect it.",
      ],
      [
        ["Right-click an edge"],
        "Reverse it, switch synchronous and asynchronous, straighten it or reset its ends.",
      ],
      [[mod, "Z"], "Undo."],
      [[mod, "Shift", "Z"], "Redo."],
      [[mod, "Y"], "Redo."],
    ],
  ],
  [
    "Notes",
    [
      [
        ["Right-click empty space"],
        "Add a component or a note right there; a note is an annotation, never a node.",
      ],
      [
        ["Right-click a component", "or a group"],
        "Pin a note to it; the note then follows what it is pinned to.",
      ],
      [
        ["Drag a note", "onto a component or group"],
        "Pin it there, where you let go; the ring shows what it will follow.",
      ],
      [["N"], "Show or hide every note; a hidden one leaves a dot on its target."],
      [[mod, "Enter"], "Keep what you typed in a note; Esc throws the edit away."],
    ],
  ],
  [
    "View and file",
    [
      [["Wheel"], "Pan the canvas; a two-finger swipe pans in any direction."],
      [["Shift", "Wheel"], "Pan sideways."],
      [[mod, "Wheel"], "Zoom around the pointer; so does a pinch."],
      [["Middle-drag", "Space", "Drag"], "Pan the canvas."],
      [
        ["Design menu", "View"],
        `Pin the picker, Keep the inspector away, Pin design settings, Dim edges and Hover cards, as switches. Dim edges follows the design (past ${DIM_EDGES_OVER} edges) until you click it once. Dimmed edges light up on hover, on a pin and while an edge is selected.`,
      ],
      [[mod, "0"], "Fit the whole design on screen."],
      [[mod, "1"], "Back to actual size."],
      [[mod, "Shift", "K"], "Pin the component picker as a side panel, or unpin it."],
      [["\\", "or D"], "Show Design settings, pinned beside any selection, or put it away."],
      [[mod, "Shift", "P"], "Let the card for a selection show, or keep it away."],
      [[mod, "S"], "Save."],
      [["Esc"], "Close the picker, a menu or the findings."],
      [["?"], "Open and close this dialog."],
    ],
  ],
];

/** The theme the page is drawn in (app/layout.tsx puts it on <html>). */
const pageTheme = () =>
  typeof document !== "undefined" && document.documentElement.dataset.theme === "dark"
    ? "dark"
    : "light";

const typing = (ev: KeyboardEvent) => {
  const t = ev.target as HTMLElement | null;
  return Boolean(t && (/input|select|textarea/i.test(t.tagName) || t.isContentEditable));
};

// A key pressed on a focused control of the chrome (a dock button, a menu item) that the
// control itself answers: Enter and Space press it, the arrows move inside a menu. The canvas
// leaves those alone there; every other key still reaches the canvas.
const onControl = (ev: KeyboardEvent) => {
  const t = ev.target as HTMLElement | null;
  if (!t?.closest?.("button, a, [role='button'], [role='menuitem']")) return false;
  return ["Enter", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(ev.key);
};

// Line glyphs for the floating chrome: 20px, stroke only, currentColor, so both themes hold.
const Glyph = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);
const G = {
  select: "M5 3.5 18.5 10l-6 1.8-2.3 6.2z",
  hand: "M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-5.5v-1a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v6m0-3.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6.5 6.5 0 0 1-5.2-2.6L4 15.3a1.6 1.6 0 0 1 2.5-2L8 15",
  plus: "M12 5v14M5 12h14",
  group:
    "M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M9 9h6v6H9z",
  note: "M5 4h14v10l-6 6H5zM13 20v-6h6",
  arrange: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 17h6",
  back: "M15 5l-7 7 7 7",
  chevron: "M7 10l5 5 5-5",
  pin: "M9 4h6M10 4v6l-3 4h10l-3-4V4M12 14v6",
};

export function Canvas(props: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const svgRef = useRef<SVGSVGElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const eng = useRef<Engine | null>(null);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped by every draw, so the chrome re-renders on a change the scene made.
  const [, setTick] = useState(0);
  const [status, setStatus] = useState<string>(props.canWrite ? "saved" : "read only");
  const [autosave, setAutosave] = useState(props.canWrite);
  // One menu at a time: a right-click menu, or a dropdown under a button of the chrome. A
  // dropdown hands focus back to the button that opened it (`from`) when it closes.
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    items: MenuEntry[];
    label?: string;
    from?: HTMLElement | null;
  } | null>(null);
  const [help, setHelp] = useState(false);
  // The summaries behind nodes that reference other designs: one fetch per owner/slug for as
  // long as this canvas is up. The preview of one of them, when its disc was clicked.
  const [refStore] = useState(() => new RefStore(fetchRefSummary));
  const [refPreview, setRefPreview] = useState<RefTarget | null>(null);
  // A subsystem box that was just placed (or whose unset disc was clicked) and names no design:
  // the Inspector opens its Reference picker for it, once, and hands this back to null.
  const [refPickFor, setRefPickFor] = useState<string | null>(null);
  // "Move to group…": the searchable group list, at the point the menu was opened, for these.
  const [moveTo, setMoveTo] = useState<{ x: number; y: number; ids: string[] } | null>(null);
  // The hover card: what the pointer has rested on (after HOVER_DELAY), and where.
  const [hoverCard, setHoverCard] = useState<HoverAt | null>(null);
  const hoverPending = useRef<HoverAt | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A node's finding dot, hovered or clicked: the node, the dot's bottom centre on screen, and
  // whether a click pinned the list (a pinned one stays when the pointer leaves).
  const [dotPop, setDotPop] = useState<{
    node: string;
    x: number;
    y: number;
    pinned: boolean;
  } | null>(null);
  const dotPopRef = useRef<HTMLDivElement>(null);
  const dotGrace = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdDotPop = useCallback(() => {
    if (dotGrace.current) clearTimeout(dotGrace.current);
    dotGrace.current = null;
  }, []);
  // Off the dot (or the list), the list waits a moment so the pointer can cross the gap.
  const leaveDotPop = useCallback(() => {
    holdDotPop();
    dotGrace.current = setTimeout(() => {
      dotGrace.current = null;
      setDotPop((p) => (p?.pinned ? p : null));
    }, DOT_POP_GRACE);
  }, [holdDotPop]);
  // True while something else holds the pointer's attention (a menu, a popover, a dialog).
  const hoverQuiet = useRef(false);
  // Hover cards at all (View in the design menu, Shift H, quick actions). Off: the highlight still follows
  // the pointer, a pin and the lens still work; only the card never opens.
  const [hoverCards, setHoverCardsState] = useState(true);
  const hoverCardsRef = useRef(true);
  hoverCardsRef.current = hoverCards;
  // The dialog owns Escape while it is open, and the other Escape handlers stand down; a ref,
  // because those handlers are bound once and must read the current answer, not a stale one.
  const helpOpen = useRef(false);
  helpOpen.current = help;
  // Where focus was when the dialog opened, so closing it puts the keyboard back there.
  const helpReturn = useRef<HTMLElement | null>(null);
  const helpDialog = useRef<HTMLDivElement>(null);
  const helpClose = useRef<HTMLButtonElement>(null);
  const mod = useModKey();
  // The group-wiring hint: where it sits, and nothing else. It is a remark, not a mode.
  const [hint, setHint] = useState<{ x: number; y: number } | null>(null);
  const hintEl = useRef<HTMLDivElement>(null);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteFocus, setPaletteFocus] = useState(0);
  // The defaults until the stored preference is read after mount (server and client agree).
  const [panes, setPanesState] = useState<Panes>(PANES_DEFAULT);
  useEffect(() => setPanesState(readPanes()), []);
  const pinnedRef = useRef(false);
  pinnedRef.current = panes.left;
  // The component picker as a popover over the dock. Pinned (panes.left), it is a docked panel
  // instead and this flag does not matter.
  const [picker, setPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const plusBtn = useRef<HTMLButtonElement>(null);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(readRecent()), []);
  // The select tool, or the hand tool that pans with the left button until V.
  const [tool, setTool] = useState<"select" | "hand">("select");
  // The live zoom, as the percentage the top-right pill shows.
  const [zoomPct, setZoomPct] = useState(100);
  const [findingsOpen, setFindingsOpen] = useState(false);
  const findingsRef = useRef<HTMLDivElement>(null);
  // The inspector on the design itself (id, requirements): asked for from the menu or by a
  // finding about the whole design. Any selection change puts it away again, unless it is
  // pinned (panes.design): then it stays, and the selection shows in a second card under it.
  const [designPanel, setDesignPanel] = useState(false);
  const updatePanes = useCallback((change: (prev: Panes) => Partial<Panes>) => {
    setPanesState((prev) => {
      const next = { ...prev, ...change(prev) };
      try {
        window.localStorage.setItem(PANES_KEY, JSON.stringify(next));
      } catch {
        /* a browser that will not remember still toggles for this visit */
      }
      return next;
    });
  }, []);
  const setPane = useCallback(
    (side: keyof Panes, open?: boolean) => updatePanes((prev) => ({ [side]: open ?? !prev[side] })),
    [updatePanes],
  );
  // Open the Inspector on a subsystem box's Reference picker (refPickFor), showing the panel.
  const askRefPick = useCallback(
    (id: string) => {
      setRefPickFor(id);
      setPane("right", true);
    },
    [setPane],
  );
  // Pinning Design settings shows it; unpinning puts it away, the way unpinning the picker closes
  // it. It is its own card: whether the selection's card may show (panes.right) does not touch it.
  const pinDesign = useCallback(
    (on?: boolean) => {
      updatePanes((prev) => ({ design: on ?? !prev.design }));
      setDesignPanel(false);
    },
    [updatePanes],
  );
  // Where the next component chosen in the picker lands: a right-clicked point, or the end of a
  // wire let go on empty canvas (then it is wired from the dot the wire started on). Null: the
  // middle of the view, as always.
  const placeRef = useRef<Place | null>(null);
  // The picker as a popover at a point (a wire let go on empty canvas), not over the dock.
  const [pickAnchor, setPickAnchor] = useState<{ x: number; y: number } | null>(null);
  const pickAnchorRef = useRef<{ x: number; y: number } | null>(null);
  pickAnchorRef.current = pickAnchor;
  // Open the picker (as a popover unless it is pinned) with the search box focused. The search
  // starts empty when it opens as a popover; a pinned picker keeps what was typed in it. A
  // query or a place, when given, is what the opener asked for.
  const openPicker = useCallback(
    (opts: { query?: string; place?: Place; anchor?: { x: number; y: number } } = {}) => {
      if (opts.query !== undefined) setPaletteQuery(opts.query);
      else if (!pinnedRef.current || opts.anchor) setPaletteQuery("");
      placeRef.current = opts.place ?? null;
      setPickAnchor(opts.anchor ?? null);
      setPicker(true);
      setPaletteFocus((n) => n + 1);
    },
    [],
  );
  const pickerOpen = useRef(false);
  pickerOpen.current = picker;
  const closePicker = useCallback((returnFocus = true) => {
    const anchored = Boolean(pickAnchorRef.current);
    if (pickerOpen.current && returnFocus && !pinnedRef.current && !anchored)
      plusBtn.current?.focus();
    placeRef.current = null;
    setPickAnchor(null);
    setPicker(false);
  }, []);
  // Asking for the palette (find in palette, "Add external node") opens the picker on a query.
  const askPalette = useCallback((query: string) => openPicker({ query }), [openPicker]);
  // Quick actions (⌘K): open or not. A ref too, for the key handler bound once.
  const [quick, setQuick] = useState(false);
  const quickOpen = useRef(false);
  quickOpen.current = quick;
  const closeQuick = useCallback(() => setQuick(false), []);
  const closeMoveTo = useCallback(() => setMoveTo(null), []);
  // A menu, a popover or a dialog holds the pointer's attention: no hover card meanwhile.
  hoverQuiet.current = !!(
    menu ||
    moveTo ||
    quick ||
    help ||
    picker ||
    pickAnchor ||
    refPreview ||
    dotPop
  );
  // The same, for the bare-key shortcuts — except the picker pinned as a panel, which is no popover.
  const popoverOpen = useRef(false);
  popoverOpen.current = !!(
    menu ||
    moveTo ||
    help ||
    pickAnchor ||
    refPreview ||
    (picker && !panes.left)
  );
  useEffect(() => {
    if (!hoverQuiet.current) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    hoverPending.current = null;
    setHoverCard(null);
  }, [menu, moveTo, quick, help, picker, pickAnchor, refPreview]);
  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    },
    [],
  );
  const [title, setTitle] = useState(props.title);
  const [unpublished, setUnpublished] = useState(props.unpublished);
  const [nextRelease, setNextRelease] = useState(props.nextRelease);
  const [editingTitle, setEditingTitle] = useState(false);
  // Default shown; the stored preference is read after mount so the server and the first
  // client render agree.
  const [showNotes, setShowNotes] = useState(true);
  const [dimEdges, setDimEdgesState] = useState<DimEdges>("auto");
  const showNotesRef = useRef(true);
  showNotesRef.current = showNotes;
  // Targets whose notes are held open although the toggle is off. A look, not a setting: it
  // lives here and nowhere else, so it dies with the page and never reaches the sidecar.
  const [pinnedNotes, setPinnedNotes] = useState<string[]>([]);
  const pinnedNotesRef = useRef<string[]>([]);
  pinnedNotesRef.current = pinnedNotes;
  const rootRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<Subject>({ type: null, ref: null });
  // A finding was clicked: which row it was, and what its rule reads. It survives until another
  // finding is clicked, the selection changes any other way, or Escape.
  const [finding, setFinding] = useState<{ key: string; highlight: Highlight } | null>(null);
  // True for exactly as long as a finding click is choosing its subject, so the scene's own
  // selection callback does not read that selection as "the reader moved on".
  const picking = useRef(false);
  // The whole selection: components, groups and edges (the scene's `picked()`).
  const [multi, setMulti] = useState<Picked>(() => ({
    nodes: new Set(),
    groups: new Set(),
    edges: new Set(),
  }));
  const saving = useRef<{ inFlight: boolean; again: boolean }>({ inFlight: false, again: false });
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveRef = useRef(autosave);
  autosaveRef.current = autosave;

  // ---------------------------------------------------------------- load the bundle
  useEffect(() => {
    let alive = true;
    Promise.all(
      ["catalogue", "search", "icons"].map((n) =>
        fetch(`/catalogue/${n}.json`).then((r) =>
          r.ok ? r.json() : Promise.reject(new Error(`could not load ${n}.json`)),
        ),
      ),
    )
      .then(([catalogue, search, icons]) => alive && setBundle({ catalogue, search, icons }))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  // ---------------------------------------------------------------- engine helpers (refs only)
  const relayout = useCallback(() => {
    const e = eng.current!;
    const result = layout(e.doc, bundle!.catalogue) as any;
    e.sizes = result.sizes;
    for (const n of e.doc.nodes)
      if (!e.positions[n.id]) e.positions[n.id] = result.positions[n.id] || [40, 40];
    for (const id of Object.keys(e.positions))
      if (!e.doc.nodes.some((n: any) => n.id === id)) delete e.positions[id];
    const keys = new Set(edgeKeys(e.doc));
    for (const k of Object.keys(e.bows)) if (!keys.has(k)) delete e.bows[k];
    e.ports = prunePorts(e.ports, keys as Set<string>);
    for (const k of Object.keys(e.labels)) if (!keys.has(k)) delete e.labels[k];
  }, [bundle]);

  const derive = useCallback(() => {
    const e = eng.current!;
    try {
      e.structural = check(e.doc, bundle!.catalogue, { file: e.doc.id }) as CanvasFinding[];
    } catch (err) {
      e.structural = [
        {
          message: `structural check failed: ${(err as Error).message}`,
          subject: { type: null, ref: null },
          blocking: true,
        },
      ];
    }
    try {
      e.rules = e.structural.length ? [] : (runRules(e.doc, bundle!.catalogue) as CanvasFinding[]);
    } catch {
      e.rules = [];
    }
  }, [bundle]);

  const render = useCallback(() => {
    const e = eng.current;
    const scene = sceneRef.current;
    if (!e || !scene || !bundle) return;
    try {
      relayout();
      derive();
      scene.render({
        doc: e.doc,
        catalogue: bundle.catalogue,
        icons: bundle.icons,
        positions: e.positions,
        sizes: e.sizes,
        bows: e.bows,
        ports: e.ports,
        labels: e.labels,
        notes: e.notes,
        frameStyles: e.frames,
        nodeTints: e.tints,
        routing: e.routing,
        showNotes: showNotesRef.current,
        pinnedNotes: pinnedNotesRef.current,
        findings: [...e.structural, ...e.rules],
      });
      // Each design a node references is asked about once; the discs repaint when it answers.
      for (const n of e.doc.nodes) {
        const r = D.nodeRef(n);
        if (r) void refStore.ensure(r.owner, r.slug);
      }
      setSelection({ ...scene.selection });
      setMulti(scene.picked());
      setTick((t) => t + 1);
    } catch (err) {
      console.error(err);
      setStatus(`draw failed: ${(err as Error).message}`);
    }
  }, [bundle, relayout, derive, refStore]);
  useEffect(
    () =>
      refStore.subscribe(() => {
        sceneRef.current?.paintRefs();
        setTick((t) => t + 1);
      }),
    [refStore],
  );

  // Notes ride along with the positions: one save request, one sidecar, and never a byte of
  // the YAML, because a note is not a node.
  const sidecar = useCallback(() => {
    const e = eng.current!;
    return writeSidecar({
      nodes: e.positions,
      edges: e.bows,
      ports: e.ports,
      labels: e.labels,
      notes: e.notes,
      frames: e.frames,
      tints: e.tints,
      badge: e.badge,
      routing: e.routing,
    });
  }, []);

  const save = useCallback(async () => {
    const e = eng.current;
    if (!e || !props.canWrite) return;
    if (e.structural.length) {
      setStatus("fix structural errors before saving");
      return;
    }
    if (saving.current.inFlight) {
      saving.current.again = true;
      return;
    }
    saving.current.inFlight = true;
    const seq = e.saveSeq;
    const text = serialize(e.cst, e.doc);
    setStatus("saving…");
    try {
      const res = await fetch(`/api/v1/designs/${props.owner}/${props.slug}/version`, {
        method: "PUT",
        headers: { "content-type": "application/json", "if-match": `"${e.baseHash}"` },
        body: JSON.stringify({ yaml: text, layout: sidecar() }),
      });
      if (res.status === 409) {
        setStatus("conflict: this design changed elsewhere. Reload, or clone to keep your work.");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setStatus(`save failed: ${body?.error?.message ?? res.status}`);
        return;
      }
      const body = await res.json();
      e.baseHash = body.version.contentHash;
      e.cst = parse(text).cst; // the saved text is the new base for minimal diffs; the doc stays what it is
      setUnpublished(true);
      if (e.saveSeq === seq) {
        e.dirty = false;
        setStatus("saved");
      } else setStatus("unsaved");
    } catch (err) {
      setStatus(`save failed: ${(err as Error).message}`);
    } finally {
      saving.current.inFlight = false;
      if (saving.current.again) {
        saving.current.again = false;
        void save();
      }
    }
  }, [props.canWrite, props.owner, props.slug, sidecar]);

  const scheduleAutosave = useCallback(() => {
    if (!autosaveRef.current || !props.canWrite) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      const e = eng.current;
      if (e?.dirty && !e.structural.length) void save();
    }, 1500);
  }, [props.canWrite, save]);

  const commit = useCallback(
    // `coalesce`: fold into the previous step when it too was coalescing and came within the
    // window (true: 400ms, a number: that many ms).
    // `view`: the view before a step that moves it (Arrange refits), so undo brings the view
    // back with the positions instead of leaving the restored boxes off-screen.
    (
      next: any,
      opts: {
        coalesce?: boolean | number;
        apply?: () => void;
        view?: { x: number; y: number; k: number };
      } = {},
    ) => {
      const e = eng.current!;
      const snapshot = {
        view: opts.view,
        doc: clone(e.doc),
        positions: clone(e.positions),
        bows: clone(e.bows),
        ports: clone(e.ports),
        labels: clone(e.labels),
        notes: clone(e.notes),
        frames: clone(e.frames),
        tints: clone(e.tints),
        badge: e.badge,
        routing: e.routing,
      };
      const now = Date.now();
      const within = typeof opts.coalesce === "number" ? opts.coalesce : 400;
      const coalesce = Boolean(opts.coalesce) && now - e.lastDragAt < within;
      if (!coalesce) {
        e.undo.push(snapshot);
        if (e.undo.length > 200) e.undo.shift();
        e.redo = [];
      }
      e.lastDragAt = opts.coalesce ? now : 0;
      if (opts.apply) opts.apply();
      if (next) e.doc = next;
      // A note anchored to something that has just gone goes with it. Doing it here, after the
      // snapshot above, means deleting a node and losing its notes is one undo away — and every
      // delete path gets it, without each one remembering to.
      e.notes = pruneAnchored(e.notes, anchorables(e.doc));
      // The same for a deleted group's colour and icon: they go in the same undo step.
      e.frames = pruneFrames(e.frames, anchorables(e.doc).groups);
      // And a deleted component's tint.
      e.tints = pruneTints(e.tints, anchorables(e.doc).nodes);
      e.dirty = true;
      e.saveSeq++;
      setStatus(props.canWrite ? "unsaved" : "read only — Clone to keep these edits");
      render();
      scheduleAutosave();
    },
    [render, scheduleAutosave, props.canWrite],
  );

  const undo = useCallback(() => {
    const e = eng.current!;
    const prev = e.undo.pop();
    if (!prev) return;
    const scene = sceneRef.current;
    e.redo.push({
      view: prev.view && scene ? { ...scene.view } : undefined,
      doc: clone(e.doc),
      positions: clone(e.positions),
      bows: clone(e.bows),
      ports: clone(e.ports),
      labels: clone(e.labels),
      notes: clone(e.notes),
      frames: clone(e.frames),
      tints: clone(e.tints),
      badge: e.badge,
      routing: e.routing,
    });
    const { view: back, ...state } = prev;
    Object.assign(e, state);
    if (back && scene) {
      scene.view = back;
      scene.applyView();
    }
    e.lastDragAt = 0;
    e.dirty = true;
    e.saveSeq++;
    setStatus(props.canWrite ? "unsaved" : "read only");
    render();
    scheduleAutosave();
  }, [render, scheduleAutosave, props.canWrite]);

  const redo = useCallback(() => {
    const e = eng.current!;
    const next = e.redo.pop();
    if (!next) return;
    const scene = sceneRef.current;
    e.undo.push({
      view: next.view && scene ? { ...scene.view } : undefined,
      doc: clone(e.doc),
      positions: clone(e.positions),
      bows: clone(e.bows),
      ports: clone(e.ports),
      labels: clone(e.labels),
      notes: clone(e.notes),
      frames: clone(e.frames),
      tints: clone(e.tints),
      badge: e.badge,
      routing: e.routing,
    });
    const { view: forward, ...state } = next;
    Object.assign(e, state);
    if (forward && scene) {
      scene.view = forward;
      scene.applyView();
    }
    e.lastDragAt = 0;
    e.dirty = true;
    e.saveSeq++;
    setStatus(props.canWrite ? "unsaved" : "read only");
    render();
    scheduleAutosave();
  }, [render, scheduleAutosave, props.canWrite]);

  const notify = useCallback((message: string) => setStatus(message), []);

  const movePosition = (from: string, to: string) => {
    const e = eng.current!;
    if (!e.positions[from]) return;
    e.positions[to] = e.positions[from];
    delete e.positions[from];
  };

  const renameToLabel = useCallback(
    (id: string, value: string) => {
      const e = eng.current!;
      const scene = sceneRef.current!;
      const { doc, id: now } = D.setNodeLabel(e.doc, id, value, bundle!.catalogue);
      if (now !== id) {
        if (scene.selection.type === "node" && scene.selection.ref === id)
          scene.selection = { type: "node", ref: now };
        scene.multi = new Set([...scene.multi].map((x) => (x === id ? now : x)));
      }
      commit(doc, {
        apply: () => {
          if (now === id) return;
          movePosition(id, now);
          retargetAnchors(e.notes, "node", id, now);
          // Edge keys name the ids at their ends: the bows and ports follow the rename.
          e.bows = rekeyBows(e.doc, doc, e.bows);
          e.ports = rekeyPorts(e.doc, doc, e.ports);
          e.labels = rekeyLabels(e.doc, doc, e.labels);
        },
      });
    },
    [bundle, commit],
  );

  // A module edit: removing one re-points the edges that named it (their keys change with their
  // ends), so the hand-made paths, ports and label offsets follow by index, as for a rename.
  const commitModules = useCallback(
    (next: any) => {
      const e = eng.current!;
      if (next === e.doc) return render();
      commit(next, {
        apply: () => {
          e.bows = rekeyBows(e.doc, next, e.bows);
          e.ports = rekeyPorts(e.doc, next, e.ports);
          e.labels = rekeyLabels(e.doc, next, e.labels);
        },
      });
    },
    [commit, render],
  );

  // ---------------------------------------------------------------- selection commands
  const ids = () => [...(sceneRef.current?.multi ?? [])];

  const deleteSelection = useCallback(() => {
    const scene = sceneRef.current!;
    const e = eng.current!;
    const s = scene.selection;
    const picked = scene.picked();
    const sel = [...picked.nodes];
    scene.select(null, null);
    if (s.type === "note") {
      const id = s.ref as string;
      return commit(null, { apply: () => (e.notes = e.notes.filter((n) => n.id !== id)) });
    }
    if (s.type === "module") {
      const { node, module } = D.splitEnd(s.ref as string);
      return commitModules(D.removeModule(e.doc, node, module));
    }
    if (!sel.length && !picked.groups.size && !picked.edges.size) return render();
    // A mixed selection goes in one step, so one undo brings all of it back. Edges first, by
    // index from the end, while the indexes still name them; then components; then groups,
    // which keep their members (as Delete on a lone group does).
    let doc = e.doc;
    for (const i of [...picked.edges].sort((a, b) => b - a)) doc = D.deleteEdge(doc, i);
    if (sel.length) doc = D.deleteNodes(doc, sel, bundle!.catalogue);
    for (const g of picked.groups) doc = D.deleteGroup(doc, g);
    commit(doc);
  }, [bundle, commit, commitModules, render]);

  // Cut takes what the copy took, as one undo step: a group goes with everything inside it
  // (Delete keeps a group's members, which a cut would leave behind and then paste twice).
  const cutSelection = useCallback(() => {
    const scene = sceneRef.current!;
    const picked = scene.picked();
    let doc = eng.current!.doc;
    for (const i of [...picked.edges].sort((a, b) => b - a)) doc = D.deleteEdge(doc, i);
    if (picked.nodes.size) doc = D.deleteNodes(doc, [...picked.nodes], bundle!.catalogue);
    for (const g of picked.groups)
      if ((doc.groups || []).some((x: any) => x.id === g)) doc = D.deleteGroupDeep(doc, g);
    scene.select(null, null);
    commit(doc);
  }, [bundle, commit]);

  const groupSelection = useCallback(() => {
    const scene = sceneRef.current!;
    // Selected groups nest whole inside the new one, keeping their members and edges.
    const picked = scene.picked();
    if (!picked.nodes.size && !picked.groups.size) return;
    const nodes = [...picked.nodes];
    const groups = [...picked.groups];
    const { doc, id } = D.addGroup(eng.current!.doc, nodes, "system", undefined, groups);
    scene.multi = new Set();
    scene.multiGroups = new Set();
    scene.multiEdges = new Set();
    scene.selection = { type: "group", ref: id };
    commit(doc);
  }, [commit]);

  // The selection as a clip: its components and groups (a group with everything inside it), the
  // edges inside that set, the notes pinned to any of it, and the layout all of that had. Null
  // when nothing that can be copied is selected (an edge alone is not: it needs its ends).
  const clipSelection = useCallback((): Clip | null => {
    const e = eng.current!;
    const picked = sceneRef.current!.picked();
    const frag = D.copyFragment(e.doc, [...picked.nodes], [...picked.groups]);
    if (!frag.nodes.length && !frag.groups.length) return null;
    const nodes = new Set<string>(frag.nodes.map((n: any) => n.id));
    const groups = new Set<string>(frag.groups.map((g: any) => g.id));
    const keys = edgeKeys(e.doc);
    const pick = <T,>(from: Record<string, T>, ids: Set<string>) =>
      Object.fromEntries(Object.entries(from).filter(([id]) => ids.has(id))) as Record<string, T>;
    return clone({
      zeema: "clipboard",
      version: 1,
      nodes: frag.nodes,
      groups: frag.groups,
      edges: frag.edges,
      layout: {
        positions: pick(e.positions, nodes),
        frames: pick(e.frames, groups),
        tints: pick(e.tints, nodes),
        ports: frag.edgeIndexes.map((i: number) => e.ports[keys[i]] ?? null),
        paths: frag.edgeIndexes.map((i: number) =>
          Object.hasOwn(e.bows, keys[i]) ? e.bows[keys[i]] : null,
        ),
        labels: frag.edgeIndexes.map((i: number) =>
          Object.hasOwn(e.labels, keys[i]) ? e.labels[keys[i]] : null,
        ),
        notes: e.notes.filter(
          (n) =>
            n.anchor &&
            ("node" in n.anchor ? nodes.has(n.anchor.node) : groups.has(n.anchor.group)),
        ),
      },
    });
  }, []);

  // Put a clip into this design as one undo step, (d, d) px from where it was copied, with
  // fresh ids, and select what came in: Ctrl+D, Ctrl+V and the menus all land here.
  const pasteClip = useCallback(
    (clip: Clip, d: number) => {
      const scene = sceneRef.current!;
      const e = eng.current!;
      const { doc, map, edgeAt } = D.pasteFragment(e.doc, clip, bundle!.catalogue) as {
        doc: any;
        map: Record<string, string>;
        edgeAt: Array<number | null>;
      };
      if (!Object.keys(map).length) return;
      const inClip = new Set(clip.groups.map((g: any) => g.id));
      const topGroups = clip.groups
        .filter((g: any) => !(g.parent && inClip.has(g.parent)))
        .map((g: any) => map[g.id] as string);
      const topNodes = clip.nodes
        .filter((n: any) => !(n.group && inClip.has(n.group)))
        .map((n: any) => map[n.id] as string);
      scene.multi = new Set(topNodes);
      scene.multiGroups = new Set(topGroups);
      scene.multiEdges = new Set();
      scene.selection = topNodes.length
        ? { type: "node", ref: topNodes[topNodes.length - 1] }
        : { type: "group", ref: topGroups[topGroups.length - 1] };
      const keys = edgeKeys(doc);
      const { layout: L } = clip;
      // One Zeema design box pasted with no design chosen asks for one, as a placed one does.
      const only = topNodes.length === 1 && !topGroups.length ? topNodes[0] : null;
      if (
        only &&
        wantsRefPicker(
          bundle!.catalogue,
          doc.nodes.find((x: any) => x.id === only),
        )
      )
        askRefPick(only);
      commit(doc, {
        apply: () => {
          for (const n of clip.nodes) {
            const p = L.positions[n.id] || e.positions[n.id] || [40, 40];
            e.positions[map[n.id]] = [p[0] + d, p[1] + d];
          }
          for (const g of clip.groups)
            if (L.frames[g.id]) e.frames[map[g.id]] = clone(L.frames[g.id]);
          for (const n of clip.nodes) if (L.tints[n.id]) e.tints[map[n.id]] = clone(L.tints[n.id]);
          clip.edges.forEach((_: unknown, k: number) => {
            const at = edgeAt[k];
            if (at === null || at === undefined) return;
            const key = keys[at];
            const ports = L.ports[k];
            if (ports) e.ports[key] = clone(ports);
            const offset = L.labels[k];
            if (offset) e.labels[key] = [offset[0], offset[1]];
            const path = L.paths[k];
            if (typeof path === "number") e.bows[key] = path;
            else if (path && Array.isArray(path.via))
              e.bows[key] = { via: path.via.map(([x, y]) => [x + d, y + d] as [number, number]) };
          });
          for (const n of L.notes) {
            if (!n.anchor) continue;
            const anchor: NoteAnchor =
              "node" in n.anchor ? { node: map[n.anchor.node] } : { group: map[n.anchor.group] };
            if (!Object.values(anchor)[0]) continue;
            const id = nextNoteId(e.notes.map((x) => x.id));
            e.notes.push({ ...clone(n), id, anchor });
          }
        },
      });
    },
    [bundle, commit, askRefPick],
  );

  const duplicateSelection = useCallback(() => {
    const clip = clipSelection();
    if (clip) pasteClip(clip, 28);
  }, [clipSelection, pasteClip]);

  // The copy buffer. The system clipboard gets the same clip as JSON, so a paste in another
  // design's tab finds it there; this one is the fallback when the page may not read that.
  const clipRef = useRef<Clip | null>(null);
  // How many times running the clip on the system clipboard (by its text) has been pasted, so
  // each paste lands a step further on rather than on the one before.
  const pasteRun = useRef<{ text: string; n: number }>({ text: "", n: 0 });
  // Ctrl+V was pressed and its paste event has not arrived yet.
  const pastePending = useRef(false);

  const copySelection = useCallback(() => {
    const clip = clipSelection();
    if (!clip) return false;
    clipRef.current = clip;
    const text = JSON.stringify(clip);
    pasteRun.current = { text, n: 0 };
    try {
      void navigator.clipboard?.writeText(text).catch(() => {});
    } catch {
      // No clipboard here (an insecure origin, an old browser): the in-page copy still pastes.
    }
    return true;
  }, [clipSelection]);

  // Paste from the system clipboard's text when it holds a Zeema clip, else the in-page copy.
  const pasteText = useCallback(
    (text: string | null) => {
      const clip = (text && readClip(text)) || clipRef.current;
      if (!clip) return;
      const sig = text && readClip(text) ? text : JSON.stringify(clip);
      const run = pasteRun.current;
      run.n = run.text === sig ? run.n + 1 : 1;
      run.text = sig;
      pasteClip(clip, 28 * run.n);
    },
    [pasteClip],
  );

  // The selected components and every member of a selected group, by (dx, dy). Presses within
  // half a second of each other are one undo step. False when nothing movable is selected.
  const nudge = useCallback(
    (dx: number, dy: number) => {
      const sel = sceneRef.current?.dragSet().ids ?? [];
      if (!sel.length) return false;
      commit(null, {
        coalesce: 500,
        apply: () => {
          const e = eng.current!;
          for (const id of sel) {
            const p = e.positions[id];
            if (p) e.positions[id] = [p[0] + dx, p[1] + dy];
          }
        },
      });
      return true;
    },
    [commit],
  );

  const releaseFromGroup = useCallback(() => {
    const sel = ids();
    if (!sel.length) return;
    let doc = eng.current!.doc;
    for (const id of sel) doc = D.setNodeGroup(doc, id, null);
    commit(doc);
  }, [commit]);

  // Put these components in a group (null: top level), as one undo step. Positions stay; the
  // group's frame is computed from its members, so it reaches out to them on the redraw.
  const moveToGroup = useCallback(
    (sel: string[], groupId: string | null) => {
      if (!sel.length) return;
      let doc = eng.current!.doc;
      for (const id of sel) doc = D.setNodeGroup(doc, id, groupId);
      commit(doc);
    },
    [commit],
  );
  const openMoveTo = useCallback((x: number, y: number) => {
    const sel = ids();
    if (sel.length) setMoveTo({ x, y, ids: sel });
  }, []);

  const arrange = useCallback(() => {
    const scene = sceneRef.current;
    commit(null, {
      view: scene ? { ...scene.view } : undefined,
      apply: () => {
        const e = eng.current!;
        const result = layout(e.doc, bundle!.catalogue) as any;
        e.positions = result.positions;
        e.sizes = result.sizes;
        e.bows = {};
      },
    });
    scene?.fit();
  }, [bundle, commit]);

  // Place a component, in the middle of the view or at a point. With `from`, it is also wired
  // from that node's port dot: node and edge in one commit, so one undo takes both away.
  const addComponent = useCallback(
    (componentId: string, at?: [number, number], from?: Wiring) => {
      const e = eng.current!;
      const scene = sceneRef.current!;
      // Wired out into a frame's open interior: the new component is a member of that group.
      const into =
        from && at ? (innermostFrameAt(scene.frames, at[0], at[1]) as string | null) : null;
      const added = D.addNode(
        e.doc,
        componentId,
        bundle!.catalogue,
        into ? { group: into } : undefined,
      );
      const id = added.id;
      const doc = from ? D.addEdge(added.doc, from.id, id) : added.doc;
      const sizes = (layout(doc, bundle!.catalogue) as any).sizes;
      const size = sizes[id] || [140, 78];
      const center = at ?? scene.viewCenterWorld();
      const pos: [number, number] = [
        Math.round(center[0] - size[0] / 2),
        Math.round(center[1] - size[1] / 2),
      ];
      const key = from && doc.edges.length ? edgeKeys(doc)[doc.edges.length - 1] : null;
      scene.selection = { type: "node", ref: id };
      scene.multi = new Set([id]);
      scene.multiGroups = new Set();
      scene.multiEdges = new Set();
      setRecent((prev) => {
        const next = [componentId, ...prev.filter((x) => x !== componentId)].slice(0, RECENT_MAX);
        try {
          window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        } catch {
          /* a browser that will not remember still places the component */
        }
        return next;
      });
      // A Zeema design box arrives asking which design it is: the Inspector opens on its picker.
      if (
        wantsRefPicker(
          bundle!.catalogue,
          doc.nodes.find((x: any) => x.id === id),
        )
      )
        askRefPick(id);
      commit(doc, {
        apply: () => {
          e.positions[id] = pos;
          if (!from || !key) return;
          // The wire's own dot on the source, and the new box's side that faces it.
          const box: [number, number, number, number] = [pos[0], pos[1], size[0], size[1]];
          e.ports = withPort(e.ports, key, "from", { side: from.side, t: 0.5 });
          e.ports = withPort(e.ports, key, "to", { side: facingSide(box, from.start), t: 0.5 });
        },
      });
    },
    [bundle, commit, askRefPick],
  );

  // The picker chose a component: it lands where the picker was asked for (a point, a wire's
  // end) or in the middle of the view. A pointed placement is used once; the popover goes.
  const placeFromPicker = useCallback(
    (componentId: string) => {
      const place = placeRef.current;
      if (!place) return addComponent(componentId);
      addComponent(componentId, place.at, place.from);
      closePicker(false);
    },
    [addComponent, closePicker],
  );

  // ---------------------------------------------------------------- notes
  // A note is layout, never document: it is added, moved, retyped and deleted entirely inside
  // the sidecar, so `commit(null, ...)` is the whole story and the YAML never changes.
  const setNotesShown = useCallback((next: boolean) => {
    showNotesRef.current = next;
    setShowNotes(next);
    // Showing everything makes a pin meaningless, so it stops being one.
    if (next) {
      pinnedNotesRef.current = [];
      setPinnedNotes([]);
    }
    try {
      window.localStorage.setItem(NOTES_KEY, next ? "shown" : "hidden");
    } catch {
      /* a browser that will not remember is still a browser that works */
    }
  }, []);

  useEffect(() => setShowNotes(readNotesPref()), []);
  useEffect(() => setDimEdgesState(readDim()), []);
  useEffect(() => {
    sceneRef.current?.setDimEdges(dimEdges);
  }, [dimEdges]);
  // The checkbox stores only what was clicked: until then the design's edge count decides.
  const setDimEdges = useCallback((on: boolean) => {
    setDimEdgesState(on ? "on" : "off");
    writeDim(on);
  }, []);
  useEffect(() => setHoverCardsState(readHoverCards()), []);
  const setHoverCards = useCallback((on: boolean) => {
    setHoverCardsState(on);
    writeHoverCards(on);
    if (on) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setHoverCard(null);
  }, []);
  // The flow lens on the one selected component (T, the menu, quick actions).
  const traceSelected = useCallback(() => {
    const scene = sceneRef.current;
    if (scene?.selection.type === "node") scene.trace(scene.selection.ref as string);
  }, []);
  // The toggle changes what the scene draws, nothing it stores, so a plain redraw is the whole
  // of it. Notes are never touched, so nothing here makes the design dirty.
  useEffect(() => {
    render();
  }, [showNotes, pinnedNotes, render]);

  const toggleNotePin = useCallback((key: string) => {
    const now = pinnedNotesRef.current;
    const next = now.includes(key) ? now.filter((k) => k !== key) : [...now, key];
    pinnedNotesRef.current = next;
    setPinnedNotes(next);
  }, []);

  const newNote = useCallback(
    (note: Omit<Note, "id">) => {
      const e = eng.current!;
      const scene = sceneRef.current!;
      const id = nextNoteId(e.notes.map((n) => n.id));
      // Making something invisible would be a trick, not a feature: adding a note while they
      // are hidden turns them back on so the person sees what they just made.
      if (!showNotesRef.current) setNotesShown(true);
      scene.selection = { type: "note", ref: id };
      scene.multi = new Set();
      scene.multiGroups = new Set();
      scene.multiEdges = new Set();
      commit(null, { apply: () => e.notes.push({ ...note, id }) });
      scene.editLabel("note", id);
    },
    [commit, setNotesShown],
  );

  /** A free-floating note, at a place on the canvas. */
  const addNote = useCallback(
    (at?: [number, number]) => {
      const center = at ?? sceneRef.current!.viewCenterWorld();
      newNote({
        x: Math.round(center[0]),
        y: Math.round(center[1]),
        w: NOTE_DEFAULT_W,
        h: NOTE_DEFAULT_H,
        text: "",
      });
    },
    [newNote],
  );

  /** A note pinned to a node or a group: x and y become an offset from its top-right corner. */
  const addNoteOn = useCallback(
    (anchor: NoteAnchor) =>
      newNote({
        x: NOTE_ANCHOR_DX,
        y: NOTE_ANCHOR_DY,
        w: NOTE_ANCHOR_W,
        h: NOTE_ANCHOR_H,
        text: "",
        anchor,
      }),
    [newNote],
  );

  /** Cut a note loose. It keeps the place it is already drawn in, now as world coordinates. */
  const detachNote = useCallback(
    (id: string) => {
      const e = eng.current!;
      const box = sceneRef.current?.noteBoxes[id];
      commit(null, {
        apply: () => {
          const note = e.notes.find((n) => n.id === id);
          if (!note) return;
          if (box) {
            note.x = Math.round(box[0]);
            note.y = Math.round(box[1]);
          }
          delete note.anchor;
        },
      });
    },
    [commit],
  );

  const setNoteText = useCallback(
    (id: string, text: string) => {
      const e = eng.current!;
      commit(null, {
        apply: () => {
          const note = e.notes.find((n) => n.id === id);
          if (note) note.text = text;
        },
      });
    },
    [commit],
  );

  const deleteNote = useCallback(
    (id: string) => {
      const e = eng.current!;
      sceneRef.current?.select(null, null);
      commit(null, { apply: () => (e.notes = e.notes.filter((n) => n.id !== id)) });
    },
    [commit],
  );

  const menuFor = useCallback(
    (target: Subject, at: [number, number], client: [number, number] = [0, 0]): MenuEntry[] => {
      const scene = sceneRef.current!;
      const e = eng.current!;
      const count = scene.multi.size;
      const picked = scene.picked();
      const total = picked.nodes.size + picked.groups.size + picked.edges.size;
      // A right click on a selection that holds more than components: what applies to all of it.
      if (total > 1 && (picked.groups.size || picked.edges.size) && target.type !== "note") {
        // Components and groups duplicate as one set; an edge comes along when both its ends do.
        const n = picked.nodes.size + picked.groups.size;
        return [
          n
            ? {
                kind: "item",
                label: n > 1 ? `Group these ${n}` : "Group",
                shortcut: "G",
                run: groupSelection,
              }
            : null,
          n
            ? {
                kind: "item",
                label: n > 1 ? `Duplicate these ${n}` : "Duplicate",
                shortcut: "Ctrl D",
                run: duplicateSelection,
              }
            : null,
          n ? SEP : null,
          {
            kind: "item",
            label: `Delete these ${total}`,
            shortcut: "Del",
            danger: true,
            run: deleteSelection,
          },
        ];
      }
      if (target.type === "node") {
        const grouped = e.doc.nodes.some((n: any) => scene.multi.has(n.id) && n.group);
        return [
          {
            kind: "item",
            label: "Rename",
            shortcut: "double click",
            run: () => scene.editLabel("node", target.ref as string),
          },
          {
            kind: "item",
            label: count > 1 ? `Group these ${count}` : "Group",
            shortcut: "G",
            run: groupSelection,
          },
          {
            kind: "item",
            label: "Move to group…",
            hint: (e.doc.groups || []).length ? undefined : "no groups yet",
            disabled: !(e.doc.groups || []).length,
            run: () => openMoveTo(client[0], client[1]),
          },
          grouped ? { kind: "item", label: "Remove from group", run: releaseFromGroup } : null,
          {
            kind: "item",
            label: count > 1 ? `Duplicate these ${count}` : "Duplicate",
            shortcut: "Ctrl D",
            run: duplicateSelection,
          },
          {
            kind: "item",
            label: "Add note",
            hint: "pinned here",
            run: () => addNoteOn({ node: target.ref as string }),
          },
          {
            kind: "item",
            label: "Trace flow",
            shortcut: "Alt click or T",
            run: () => scene.trace(target.ref as string),
          },
          {
            kind: "item",
            label: "Open in catalogue",
            hint: "new tab",
            run: () => {
              const n = e.doc.nodes.find((x: any) => x.id === target.ref);
              if (n)
                window.open(
                  `/catalogue/components/${encodeURIComponent(n.component)}`,
                  "_blank",
                  "noopener",
                );
            },
          },
          SEP,
          {
            kind: "item",
            label: count > 1 ? `Delete these ${count}` : "Delete",
            shortcut: "Del",
            danger: true,
            run: deleteSelection,
          },
        ];
      }
      if (target.type === "edge") {
        const i = target.ref as number;
        const edge = e.doc.edges[i];
        const key = edgeKeys(e.doc)[i];
        return [
          {
            kind: "item",
            label: "Edit label",
            shortcut: "double click",
            run: () => scene.editLabel("edge", i),
          },
          {
            kind: "item",
            label: "Reverse direction",
            // Bows are keyed by pair and order, so without re-keying, reversing one of a
            // reciprocal pair would hand its bow to the other lane.
            run: () => {
              const next = D.reverseEdge(e.doc, i);
              commit(next, {
                apply: () => {
                  e.bows = rekeyBows(e.doc, next, e.bows, [i]);
                  e.ports = rekeyPorts(e.doc, next, e.ports, [i]);
                  e.labels = rekeyLabels(e.doc, next, e.labels);
                },
              });
            },
          },
          {
            kind: "item",
            label: edge?.mode === "async" ? "Make synchronous" : "Make asynchronous",
            run: () =>
              commit(D.setEdgeField(e.doc, i, "mode", edge?.mode === "async" ? "sync" : "async")),
          },
          {
            kind: "item",
            // Back to the automatic path: a curve's bow or an orthogonal path's waypoints.
            label: (e.routing ?? "orthogonal") !== "curved" ? "Reset path" : "Straighten",
            disabled: !Object.hasOwn(e.bows, key),
            run: () =>
              commit(null, {
                apply: () => {
                  const { [key]: _gone, ...rest } = e.bows;
                  e.bows = rest;
                },
              }),
          },
          {
            kind: "item",
            label: "Reset label position",
            disabled: !Object.hasOwn(e.labels, key),
            run: () =>
              commit(null, {
                apply: () => {
                  const { [key]: _gone, ...rest } = e.labels;
                  e.labels = rest;
                },
              }),
          },
          {
            kind: "item",
            label: "Reset ends",
            hint: "attach automatically",
            disabled: !e.ports[key],
            run: () =>
              commit(null, {
                apply: () => {
                  const { [key]: _gone, ...rest } = e.ports;
                  e.ports = rest;
                },
              }),
          },
          SEP,
          {
            kind: "item",
            label: "Delete",
            shortcut: "Del",
            danger: true,
            run: () => {
              scene.select(null, null);
              commit(D.deleteEdge(e.doc, i));
            },
          },
        ];
      }
      if (target.type === "note") {
        const id = target.ref as string;
        const note = e.notes.find((n) => n.id === id);
        return [
          {
            kind: "item",
            label: "Edit text",
            shortcut: "double click",
            run: () => scene.editLabel("note", id),
          },
          note?.anchor
            ? {
                kind: "item",
                label: "Detach note",
                hint: "keep it where it is",
                run: () => detachNote(id),
              }
            : null,
          SEP,
          {
            kind: "item",
            label: "Delete note",
            shortcut: "Del",
            danger: true,
            run: () => deleteNote(id),
          },
        ];
      }
      if (target.type === "group") {
        const id = target.ref as string;
        const members = D.groupMembers(e.doc, id).length;
        return [
          {
            kind: "item",
            label: "Rename",
            shortcut: "double click",
            run: () => scene.editLabel("group", id),
          },
          {
            kind: "item",
            label: "Select members",
            disabled: !members,
            run: () => scene.selectNodes(D.groupMembers(e.doc, id)),
          },
          {
            kind: "item",
            label: "Duplicate",
            shortcut: "Ctrl D",
            run: () => {
              scene.select("group", id);
              duplicateSelection();
            },
          },
          {
            kind: "item",
            label: "Add note",
            hint: "pinned here",
            run: () => addNoteOn({ group: id }),
          },
          SEP,
          {
            kind: "item",
            label: "Remove group, keep members",
            shortcut: "Del",
            run: () => {
              scene.select(null, null);
              commit(D.deleteGroup(e.doc, id));
            },
          },
          {
            kind: "item",
            label: `Delete group and ${members} member${members === 1 ? "" : "s"}`,
            danger: true,
            disabled: !members,
            run: () => {
              scene.select(null, null);
              scene.multi = new Set();
              scene.multiGroups = new Set();
              scene.multiEdges = new Set();
              commit(D.deleteGroupDeep(e.doc, id));
            },
          },
        ];
      }
      // Empty canvas. Paste offers what this page copied; Ctrl+V also reads the system clipboard.
      return [
        {
          kind: "item",
          label: "Add component…",
          hint: "lands here",
          run: () => openPicker({ place: { at } }),
        },
        {
          kind: "item",
          label: "Add note here",
          hint: "annotation, not a node",
          run: () => addNote(at),
        },
        {
          kind: "item",
          label: "Paste",
          shortcut: "Ctrl V",
          disabled: !clipRef.current,
          run: () => pasteText(null),
        },
        SEP,
        { kind: "item", label: "Fit", shortcut: "Ctrl 0", run: () => scene.fit() },
        { kind: "item", label: "Arrange", run: arrange },
      ];
    },
    [
      openPicker,
      addNote,
      addNoteOn,
      arrange,
      commit,
      deleteNote,
      detachNote,
      deleteSelection,
      duplicateSelection,
      pasteText,
      groupSelection,
      releaseFromGroup,
      openMoveTo,
    ],
  );

  // ---------------------------------------------------------------- mount the scene
  useEffect(() => {
    if (!bundle || !svgRef.current) return;
    let doc: any;
    let cst: any;
    try {
      const parsed = parse(props.yaml);
      cst = parsed.cst;
      doc = D.normalize(parsed.doc).doc;
    } catch (err) {
      setError(`This design cannot be opened on the canvas: ${(err as Error).message}`);
      return;
    }
    const sidecarIn = readSidecar(props.layoutSidecar, anchorables(doc));
    eng.current = {
      doc,
      cst,
      positions: sidecarIn.nodes,
      sizes: {},
      bows: sidecarIn.edges,
      ports: sidecarIn.ports ?? {},
      labels: sidecarIn.labels ?? {},
      notes: sidecarIn.notes,
      frames: sidecarIn.frames,
      tints: sidecarIn.tints ?? {},
      badge: sidecarIn.badge,
      routing: sidecarIn.routing,
      undo: [],
      redo: [],
      dirty: false,
      lastDragAt: 0,
      baseHash: props.contentHash,
      saveSeq: 0,
      structural: [],
      rules: [],
    };
    // A design with nothing in it yet opens with the picker pinned, so the first thing in reach
    // is what to add, and the Design settings card pinned beside it (but not on a phone, where
    // the two cards would cover each other: there the picker wins). Stored like pressing the
    // pins, so unpinning either is remembered as usual.
    if (props.canWrite && doc.nodes.length === 0) {
      const roomy = window.matchMedia("(min-width: 768px)").matches;
      updatePanes(() => (roomy ? { left: true, design: true, right: true } : { left: true }));
    }
    const scene = new Scene(svgRef.current, {
      onSelect: (sel, m) => {
        setSelection({ ...sel });
        setMulti(m);
        if (!picking.current) {
          setFinding(null);
          setDesignPanel(false);
        }
      },
      onMove: (moves, into) => {
        const e = eng.current!;
        // Let go where it regroups: the selection moves into that group (null: the top level), in
        // the same undo step as the positions. A group is never put inside itself
        // (setGroupParent refuses the cycle).
        let next: any = null;
        if (into) {
          for (const id of into.nodes) {
            const node = (next || e.doc).nodes.find((n: any) => n.id === id);
            if (node && (node.group ?? null) !== into.group)
              next = D.setNodeGroup(next || e.doc, id, into.group);
          }
          for (const id of into.groups) {
            const g = ((next || e.doc).groups || []).find((x: any) => x.id === id);
            if (!g || id === into.group || (g.parent ?? null) === into.group) continue;
            const after = D.setGroupParent(next || e.doc, id, into.group);
            if (after !== (next || e.doc)) next = after;
          }
        }
        commit(next, {
          coalesce: !next,
          apply: () => {
            for (const m of moves) e.positions[m.id] = [m.x, m.y];
          },
        });
      },
      onConnect: (from, to, ends) => {
        const next = D.addEdge(eng.current!.doc, from, to);
        // Drawn from a port dot: both ends attach where the wire said, in the same undo step.
        // The new edge is the last one, and its key is whatever edgeKeys calls it in `next`.
        const key = ends && next.edges.length ? edgeKeys(next)[next.edges.length - 1] : null;
        commit(next, {
          apply: key
            ? () => {
                const e = eng.current!;
                e.ports = withPort(e.ports, key, "from", ends?.from ?? null);
                e.ports = withPort(e.ports, key, "to", ends?.to ?? null);
              }
            : undefined,
        });
      },
      onPathPreview: (key, value, ends) => {
        const e = eng.current!;
        const { [key]: _was, ...rest } = e.bows;
        let ports = e.ports;
        if (ends?.from) ports = withPort(ports, key, "from", ends.from);
        if (ends?.to) ports = withPort(ports, key, "to", ends.to);
        scene.repaintEdges(value ? { ...rest, [key]: value } : rest, ports);
      },
      // A bow or waypoints from a drag, or null (back to the automatic path). Waypoints replace a
      // bow the edge had: the first drag of an orthogonal Z turns its bow into its corners. An
      // end the drag brought round to another side of its box is re-pinned in the same step.
      onPath: (key, value, ends) =>
        commit(null, {
          coalesce: true,
          apply: () => {
            const e = eng.current!;
            if (value) e.bows[key] = value;
            else delete e.bows[key];
            if (ends?.from) e.ports = withPort(e.ports, key, "from", ends.from);
            if (ends?.to) e.ports = withPort(e.ports, key, "to", ends.to);
          },
        }),
      // A label dragged off its automatic place: keep the offset (null: back to automatic).
      onLabelMove: (key, offset) =>
        commit(null, {
          apply: () => {
            const e = eng.current!;
            const { [key]: _was, ...rest } = e.labels;
            e.labels = offset ? { ...rest, [key]: offset } : rest;
          },
        }),
      onPortPreview: (key, end, port) =>
        scene.repaintEdges(scene.model.bows, withPort(eng.current!.ports, key, end, port)),
      onPort: (key, end, port) =>
        commit(null, {
          apply: () => {
            const e = eng.current!;
            e.ports = withPort(e.ports, key, end, port);
          },
        }),
      onReconnect: (i, end, nodeId, port) => {
        const e = eng.current!;
        const { doc: next, refused } = D.reconnectEdge(e.doc, i, end, nodeId);
        if (refused === "self-loop") return notify("an edge cannot connect a component to itself");
        if (refused === "duplicate") return notify("that edge already exists");
        if (refused || next === e.doc) return;
        commit(next, {
          apply: () => {
            // Every edge keeps its index, so bows and ports follow by index; the moved end's
            // port named a point on the box it has left, so it is replaced by where it was let
            // go on the new one.
            e.bows = rekeyBows(e.doc, next, e.bows);
            e.ports = withPort(rekeyPorts(e.doc, next, e.ports), edgeKeys(next)[i], end, port);
            e.labels = rekeyLabels(e.doc, next, e.labels);
          },
        });
      },
      onNotePin: (key) => toggleNotePin(key),
      onNoteAnchor: (id, anchor, box) => {
        const e = eng.current!;
        commit(null, {
          apply: () => {
            const note = e.notes.find((n) => n.id === id);
            if (!note) return;
            note.anchor = anchor;
            Object.assign(note, box);
          },
        });
      },
      onNoteGeometry: (id, box) => {
        const e = eng.current!;
        commit(null, {
          coalesce: true,
          apply: () => {
            const note = e.notes.find((n) => n.id === id);
            if (note) Object.assign(note, box);
          },
        });
      },
      labelOf: (kind, ref) => {
        const e = eng.current!;
        if (kind === "note") return e.notes.find((n) => n.id === ref)?.text ?? null;
        if (kind === "node") {
          const n = e.doc.nodes.find((x: any) => x.id === ref);
          return n ? D.displayName(bundle.catalogue, n) : null;
        }
        if (kind === "edge") {
          const ed = e.doc.edges[ref as number];
          return ed ? ed.label || "" : null;
        }
        if (kind === "module") {
          const m = D.moduleOf(e.doc, ref as string);
          return m ? D.moduleName(m) : null;
        }
        const g = (e.doc.groups || []).find((x: any) => x.id === ref);
        return g ? g.label || "" : null;
      },
      onLabel: (kind, ref, value) => {
        const e = eng.current!;
        if (kind === "note") return setNoteText(ref as string, value);
        if (kind === "node") return renameToLabel(ref as string, value);
        if (kind === "edge")
          commit(D.setEdgeField(e.doc, ref as number, "label", value || undefined));
        if (kind === "module") {
          const { node, module } = D.splitEnd(ref as string);
          commit(D.setModuleLabel(e.doc, node, module, value || null));
        }
        if (kind === "group")
          commit(D.setGroupField(e.doc, ref as string, "label", value || undefined));
      },
      onContext: (target, x, y) =>
        setMenu({ x, y, items: menuFor(target, scene.toWorld(x, y), [x, y]) }),
      onHover: (at) => {
        const clear = () => {
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
          hoverTimer.current = null;
        };
        if (!at || hoverQuiet.current || !hoverCardsRef.current) {
          clear();
          hoverPending.current = null;
          setHoverCard(null);
          return;
        }
        const prev = hoverPending.current;
        const next = { type: at.type, id: at.id, x: at.clientX, y: at.clientY };
        hoverPending.current = next;
        // Moving within the same thing only updates where the card will appear.
        if (prev && prev.type === next.type && prev.id === next.id) return;
        clear();
        setHoverCard(null);
        hoverTimer.current = setTimeout(() => {
          hoverTimer.current = null;
          const p = hoverPending.current;
          if (p && !hoverQuiet.current && !sceneRef.current?.busy()) setHoverCard({ ...p });
        }, HOVER_DELAY);
      },
      onDrop: (componentId, x, y) => {
        // A drag from the picker opened at a wire's end still wires it, wherever it is dropped.
        addComponent(componentId, [x, y], placeRef.current?.from);
        // A drag out of the popover ends it; a pinned picker stays where it is.
        if (!pinnedRef.current || pickAnchorRef.current) closePicker(false);
      },
      onFrameWire: (x, y) => setHint({ x, y }),
      onWireOut: (from, side, start, at, client) => {
        const root = rootRef.current?.getBoundingClientRect();
        openPicker({
          place: { at, from: { id: from, side, start } },
          anchor: { x: client[0] - (root?.left ?? 0), y: client[1] - (root?.top ?? 0) },
        });
      },
      onView: (k) => setZoomPct(Math.round(k * 100)),
      refColor: (design, version) => {
        const [owner, slug] = (design ?? "").split("/");
        return refColor(design ? refStore.get(owner, slug) : undefined, design, version);
      },
      refName: (n) => refNameFor(refStore, bundle!.catalogue, n),
      onRefClick: (nodeId, shift) => {
        const n = eng.current?.doc.nodes.find((x: any) => x.id === nodeId);
        const r = n ? D.nodeRef(n) : null;
        // An unset disc (a Zeema design box with no design yet) asks for the pick.
        if (!r && n && wantsRefPicker(bundle!.catalogue, n)) {
          sceneRef.current?.select("node", nodeId);
          askRefPick(nodeId);
          return;
        }
        if (!r) return;
        if (shift) {
          const href = refHref(r.owner, r.slug, refStore.get(r.owner, r.slug), r.version);
          window.open(href, "_blank", "noopener,noreferrer");
          return;
        }
        setRefPreview({ owner: r.owner, slug: r.slug, version: r.version });
      },
      onFindingDot: (node, at, pinned) => {
        if (!node || !at) return leaveDotPop();
        holdDotPop();
        setDotPop((p) => ({
          node,
          x: at[0],
          y: at[1],
          pinned: !!pinned || (p?.node === node && p.pinned),
        }));
      },
      // Which nodes show their modules is this viewer's, per design, in this browser only.
      onExpand: (ids) => writeExpanded(`${props.owner}/${props.slug}`, ids),
      // A module tile dragged to another place in its node: the order in the YAML is the order
      // the tiles are drawn in. One undo step; an edge names a module by id, so none changes.
      onModuleMove: (nodeId, moduleId, index) => {
        const e = eng.current!;
        const next = D.moveModule(e.doc, nodeId, moduleId, index);
        if (next === e.doc) return render();
        commit(next);
      },
    });
    scene.expanded = readExpanded(`${props.owner}/${props.slug}`);
    sceneRef.current = scene;
    scene.setDimEdges(readDim());
    render();
    scene.fit();
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // The scene mounts once per bundle/design; handlers read refs so they stay current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle]);

  // A layout file checked on the design page ("Import layout") waits in this tab's session
  // storage; it is applied once the canvas is up, as the same one undo step as from the menu.
  useEffect(() => {
    if (!bundle || !eng.current) return;
    const key = pendingLayoutKey(props.owner, props.slug);
    let text: string | null = null;
    try {
      text = sessionStorage.getItem(key);
      sessionStorage.removeItem(key);
    } catch {
      return;
    }
    if (text) void applyLayoutText(text);
    // Once per mount; applyLayoutText reads the engine through its ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle]);

  // ---------------------------------------------------------------- keyboard
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const cmd = ev.metaKey || ev.ctrlKey;
      if (cmd && !ev.shiftKey && !ev.altKey && ev.key.toLowerCase() === "k") {
        ev.preventDefault();
        setMenu(null);
        setHelp(false);
        setQuick((q) => !q);
        return;
      }
      // The palette owns the keyboard while it is open; it handles its own keys.
      if (quickOpen.current) return;
      if (ev.key === "Escape" && helpOpen.current) {
        // The dialog is modal: Escape belongs to it and to nothing else while it is open.
        ev.preventDefault();
        ev.stopPropagation();
        setHelp(false);
        return;
      }
      const scene = sceneRef.current;
      if (!scene || !eng.current) return;
      if (ev.key === "Escape") {
        setHint(null);
        setMenu(null);
        setDotPop(null);
        setFinding(null);
        setFindingsOpen(false);
        if (pickerOpen.current && (!pinnedRef.current || pickAnchorRef.current)) closePicker();
        // A pinned highlight goes first; the selection stays for the next Esc.
        if (!scene.busy() && scene.unpin()) return;
        scene.cancel();
        scene.closeEditor();
        if (!typing(ev)) scene.select(null, null);
        return;
      }
      const mod = ev.metaKey || ev.ctrlKey;
      const k = ev.key.toLowerCase();
      // The panel shortcuts mean nothing to a text field, so they work from inside one too —
      // the picker's own search box above all.
      if (mod && ev.shiftKey && k === "k") {
        ev.preventDefault();
        setPane("left");
        return;
      }
      if (mod && ev.shiftKey && k === "p") {
        ev.preventDefault();
        setPane("right");
        return;
      }
      if (typing(ev) || onControl(ev)) return;
      // Design settings: \ (whatever modifiers a layout needs to type it: AltGr is Ctrl+Alt on
      // Windows) or a bare D. Not while a menu, a popover or a dialog has the keyboard.
      if (ev.key === "\\" || (!mod && !ev.altKey && k === "d")) {
        if (popoverOpen.current) return;
        ev.preventDefault();
        pinDesign();
        return;
      }
      if (mod && k === "s") {
        ev.preventDefault();
        void save();
        return;
      }
      // Shift held over from a Shift drag makes Ctrl+Z an undo still (history-key.ts).
      const history = historyKey(ev, scene.shiftCarried && ev.shiftKey);
      if (history) {
        ev.preventDefault();
        history === "undo" ? undo() : redo();
        return;
      }
      if (mod && k === "a") {
        ev.preventDefault();
        const d = eng.current.doc;
        scene.selectMany({
          nodes: d.nodes.map((n: any) => n.id),
          groups: (d.groups ?? []).map((g: any) => g.id),
          edges: d.edges.map((_: any, i: number) => i),
        });
        return;
      }
      if (mod && k === "d") {
        // Ctrl+D duplicates; Ctrl+Shift+D means nothing here (Design settings is \ or D).
        ev.preventDefault();
        if (ev.shiftKey) return;
        duplicateSelection();
        return;
      }
      // Copy and cut leave text someone has selected on the page to the browser.
      const textPicked = () => Boolean(window.getSelection()?.toString());
      if (mod && !ev.shiftKey && !ev.altKey && (k === "c" || k === "x") && !textPicked()) {
        if (!copySelection()) return;
        ev.preventDefault();
        if (k === "x") cutSelection();
        return;
      }
      if (mod && !ev.shiftKey && !ev.altKey && k === "v") {
        // The browser follows this key with a paste event, which carries the system clipboard
        // without asking for permission (onPaste below). Should none come, the in-page copy is
        // pasted instead.
        pastePending.current = true;
        window.setTimeout(() => {
          if (!pastePending.current) return;
          pastePending.current = false;
          pasteText(null);
        }, 50);
        return;
      }
      if (!mod && ev.key === "/") {
        ev.preventDefault();
        openPicker();
        return;
      }
      if (!mod && !ev.altKey && k === "v") {
        ev.preventDefault();
        setTool("select");
        return;
      }
      if (!mod && !ev.altKey && ev.shiftKey && k === "h") {
        ev.preventDefault();
        setHoverCards(!hoverCardsRef.current);
        return;
      }
      if (!mod && !ev.altKey && k === "h") {
        ev.preventDefault();
        setTool("hand");
        return;
      }
      if (mod && ev.key === "0") {
        ev.preventDefault();
        scene.fit();
        return;
      }
      if (mod && ev.key === "1") {
        ev.preventDefault();
        scene.setZoom(1);
        return;
      }
      if (mod && ev.shiftKey && k === "g") {
        ev.preventDefault();
        if (scene.selection.type === "group") {
          const id = scene.selection.ref as string;
          scene.select(null, null);
          commit(D.deleteGroup(eng.current.doc, id));
        }
        return;
      }
      if (!mod && k === "g") {
        ev.preventDefault();
        groupSelection();
        return;
      }
      if (ev.key === "Delete" || ev.key === "Backspace") {
        ev.preventDefault();
        deleteSelection();
        return;
      }
      if (ev.key === "Enter" && scene.selection.type) {
        ev.preventDefault();
        scene.editLabel(scene.selection.type, scene.selection.ref as string | number);
        return;
      }
      if (!mod && k === "n") {
        ev.preventDefault();
        setNotesShown(!showNotesRef.current);
        return;
      }
      if (!mod && !ev.altKey && k === "t" && scene.selection.type === "node") {
        ev.preventDefault();
        traceSelected();
        return;
      }
      if (ev.key === "?") {
        setHelp((h) => !h);
        return;
      }
      const step = ev.shiftKey ? 10 : 1;
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const by = !mod && !ev.altKey ? arrows[ev.key] : undefined;
      // Only when something moved: otherwise the arrows are the page's to scroll with.
      if (by && nudge(by[0], by[1])) ev.preventDefault();
    };
    const onPaste = (ev: ClipboardEvent) => {
      if (!sceneRef.current || !eng.current) return;
      pastePending.current = false;
      const t = ev.target as HTMLElement | null;
      if (t && (/input|select|textarea/i.test(t.tagName) || t.isContentEditable)) return;
      ev.preventDefault();
      pasteText(ev.clipboardData?.getData("text/plain") ?? null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, [
    save,
    undo,
    redo,
    duplicateSelection,
    copySelection,
    cutSelection,
    pasteText,
    groupSelection,
    deleteSelection,
    nudge,
    commit,
    setNotesShown,
    setPane,
    pinDesign,
    openPicker,
    closePicker,
  ]);

  // The tool lives in React (the dock shows it); the scene only needs to know whether the left
  // button pans.
  useEffect(() => {
    sceneRef.current?.setHand(tool === "hand");
  }, [tool, bundle]);

  // The popover closes on a press anywhere outside it — except the + that toggles it. A drag
  // out of it never presses outside, so it stays open until the drop.
  useEffect(() => {
    if (!picker || (panes.left && !pickAnchor)) return;
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as Node | null;
      if (!t || pickerRef.current?.contains(t) || plusBtn.current?.contains(t)) return;
      closePicker(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [picker, panes.left, pickAnchor, closePicker]);

  // A finding dot's list closes on a press anywhere but on it (or on a dot, which reopens it),
  // and on a wheel, which moves the dot out from under it.
  useEffect(() => {
    if (!dotPop) return;
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as Element | null;
      if (dotPopRef.current?.contains(t) || t?.closest?.(".finding-badge")) return;
      setDotPop(null);
    };
    const onWheel = () => setDotPop(null);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("wheel", onWheel, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("wheel", onWheel, true);
    };
  }, [dotPop]);
  useEffect(() => () => holdDotPop(), [holdDotPop]);

  // The expanded findings card closes the same way; its pill toggles it.
  useEffect(() => {
    if (!findingsOpen) return;
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as Node | null;
      if (!t || findingsRef.current?.contains(t)) return;
      // A press on the canvas is often the reader looking at what a finding pointed to.
      if ((t as Element).closest?.("svg.scene, .float-inspector")) return;
      setFindingsOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [findingsOpen]);

  // The dialog opens on the close button and hands focus back to wherever it was when it goes,
  // so the keyboard never lands somewhere the reader cannot see.
  const hadHelp = useRef(false);
  useEffect(() => {
    if (help) {
      const active = document.activeElement as HTMLElement | null;
      helpReturn.current = active && active !== document.body ? active : null;
      helpClose.current?.focus();
    } else if (hadHelp.current) helpReturn.current?.focus?.();
    hadHelp.current = help;
  }, [help]);

  // Any press outside the dialog closes it — the backdrop, a toolbar button, the canvas itself.
  // Nothing is swallowed: the press it closed on still does whatever it was going to do. The
  // ? button is the exception, because its own click is what toggles the dialog shut.
  useEffect(() => {
    if (!help) return;
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as Node | null;
      if (!t) return;
      if (helpDialog.current?.contains(t)) return;
      setHelp(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [help]);

  // The group hint is a remark that gets out of the way: six seconds, a click, or Escape.
  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(null), 6000);
    const onDown = (ev: PointerEvent) => {
      if (hintEl.current?.contains(ev.target as Node)) return;
      setHint(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [hint]);

  useEffect(() => {
    const warn = (ev: BeforeUnloadEvent) => {
      if (eng.current?.dirty && props.canWrite) {
        ev.preventDefault();
        ev.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [props.canWrite]);

  // ---------------------------------------------------------------- inspector api
  const api: InspectorApi = useMemo(
    () => ({
      setField: (id, f, v) =>
        f === "label"
          ? renameToLabel(id, v)
          : commit(D.setNodeField(eng.current!.doc, id, f, v || undefined)),
      // One component, or the Inspector's card for several: every one of them in one undo step.
      setProp: (id, p, v) => {
        let doc = eng.current!.doc;
        for (const at of Array.isArray(id) ? id : [id]) doc = D.setNodeProp(doc, at, p, v);
        commit(doc);
      },
      setNfr: (id, f, v) => commit(D.setNfr(eng.current!.doc, id, f, v)),
      setRef: (id, r) => commit(D.setNodeRef(eng.current!.doc, id, r)),
      setGroup: (id, g) => commit(D.setNodeGroup(eng.current!.doc, id, g)),
      rename: (oldId, typed) => {
        const e = eng.current!;
        const scene = sceneRef.current!;
        const newId = D.toId(typed);
        if (newId === oldId) return render();
        if (!typed.trim()) return notify("an id cannot be empty");
        if (e.doc.nodes.some((n: any) => n.id === newId))
          return notify(`${newId} is the id of another component`);
        if ((e.doc.groups ?? []).some((g: any) => g.id === newId))
          return notify(`${newId} is the id of a group`);
        scene.selection = { type: "node", ref: newId };
        scene.multi = new Set([...scene.multi].map((x) => (x === oldId ? newId : x)));
        const renamed = D.renameNode(e.doc, oldId, newId, bundle!.catalogue);
        commit(renamed, {
          apply: () => {
            movePosition(oldId, newId);
            retargetAnchors(e.notes, "node", oldId, newId);
            retargetTint(e.tints, oldId, newId);
            e.bows = rekeyBows(e.doc, renamed, e.bows);
            e.ports = rekeyPorts(e.doc, renamed, e.ports);
            e.labels = rekeyLabels(e.doc, renamed, e.labels);
          },
        });
      },
      swap: (id, componentId) => {
        const { doc, dropped } = D.swapComponent(
          eng.current!.doc,
          id,
          componentId,
          bundle!.catalogue,
        );
        if (dropped.length) notify(`dropped on swap: ${dropped.join(", ")}`);
        commit(doc);
      },
      // One edge, or the Inspector's card for several: every one of them in one undo step.
      setEdge: (i, f, v) => {
        let doc = eng.current!.doc;
        for (const at of Array.isArray(i) ? i : [i]) doc = D.setEdgeField(doc, at, f, v);
        commit(doc);
      },
      setGroupField: (id, f, v) => commit(D.setGroupField(eng.current!.doc, id, f, v)),
      // One copy is no count, so anything under 2 is refused rather than written as a finding.
      setGroupCount: (id, n) => {
        if (n !== null && !(Number.isInteger(n) && n >= 2)) {
          notify("instances is 2 or more; leave it blank for one");
          return render();
        }
        commit(D.setGroupCount(eng.current!.doc, id, n));
      },
      renameGroup: (oldId, newId) => {
        const e = eng.current!;
        if (!newId || !/^[a-z][a-z0-9-]*$/.test(newId)) return notify("a group id is kebab-case");
        if ((e.doc.groups ?? []).some((g: any) => g.id === newId))
          return notify(`${newId} is the id of another group`);
        if (e.doc.nodes.some((n: any) => n.id === newId))
          return notify(`${newId} is the id of a component`);
        sceneRef.current!.selection = { type: "group", ref: newId };
        const renamed = D.renameGroup(e.doc, oldId, newId);
        commit(renamed, {
          apply: () => {
            retargetAnchors(e.notes, "group", oldId, newId);
            retargetFrame(e.frames, oldId, newId);
            // an edge to the group is keyed by the group's id, like an edge to a node
            e.bows = rekeyBows(e.doc, renamed, e.bows);
            e.ports = rekeyPorts(e.doc, renamed, e.ports);
            e.labels = rekeyLabels(e.doc, renamed, e.labels);
          },
        });
      },
      setParent: (id, p) => commit(D.setGroupParent(eng.current!.doc, id, p)),
      // Tint and icon are layout, like a note: the sidecar changes, the YAML never does.
      setFrameStyle: (id, patch) => {
        const e = eng.current!;
        commit(null, { apply: () => (e.frames = styleFrames(e.frames, [id], patch)) });
      },
      // A component tint is layout too. Applied to every id given: the whole multi-selection.
      setNodeTint: (ids, patch) => {
        const e = eng.current!;
        commit(null, { apply: () => (e.tints = tintNodes(e.tints, ids, patch)) });
      },
      // The multi-selection's tint row: every component and every group in it, one undo step.
      // A strength alone changes only what already has a tint.
      tintSelection: (nodes, groups, patch) => {
        const e = eng.current!;
        commit(null, {
          apply: () => {
            e.tints = tintNodes(e.tints, nodes, patch);
            e.frames = styleFrames(e.frames, groups, patch);
          },
        });
      },
      // The list badge is layout too: the sidecar's `badge`, saved with the canvas's own save.
      setBadge: (ref) => {
        const e = eng.current!;
        if ((e.badge ?? null) === ref) return;
        commit(null, {
          apply: () => {
            e.badge = ref ?? undefined;
          },
        });
      },
      // An edge's hand-made path (bow or waypoints) goes, and the automatic one comes back.
      resetPath: (index) => {
        const e = eng.current!;
        const all = edgeKeys(e.doc);
        const keys = (Array.isArray(index) ? index : [index])
          .map((i) => all[i])
          .filter((k) => k && Object.hasOwn(e.bows, k));
        if (!keys.length) return;
        commit(null, {
          apply: () => {
            e.bows = Object.fromEntries(Object.entries(e.bows).filter(([k]) => !keys.includes(k)));
          },
        });
      },
      // An edge's dragged label goes back to its automatic place. The path is left alone.
      resetLabel: (index) => {
        const e = eng.current!;
        const all = edgeKeys(e.doc);
        const keys = (Array.isArray(index) ? index : [index])
          .map((i) => all[i])
          .filter((k) => k && Object.hasOwn(e.labels, k));
        if (!keys.length) return;
        commit(null, {
          apply: () => {
            e.labels = Object.fromEntries(
              Object.entries(e.labels).filter(([k]) => !keys.includes(k)),
            );
          },
        });
      },
      // The edge style is layout too: the sidecar's `routing`, saved with the canvas's own save.
      setRouting: (v) => {
        const e = eng.current!;
        const next = readRoutingField(v);
        if (e.routing === next) return;
        commit(null, {
          apply: () => {
            e.routing = next;
          },
        });
      },
      setDesignId: (v) => {
        const d = clone(eng.current!.doc);
        d.id = D.toId(v) || d.id;
        commit(d);
      },
      setRequirement: (path, v) => {
        try {
          commit(D.setRequirement(eng.current!.doc, path, v));
        } catch (err) {
          notify((err as Error).message);
        }
      },
      setNoteText,
      detachNote,
      findInPalette: (query: string) => {
        askPalette(query);
      },
      // Modules inside a node: each change one undo step through the same commit.
      addModule: (nodeId, label) => {
        const e = eng.current!;
        const next = D.addModule(e.doc, nodeId, { label: label.trim() || undefined });
        if (next === e.doc) return notify("could not add that module");
        commitModules(next);
      },
      setModuleLabel: (nodeId, moduleId, label) =>
        commitModules(D.setModuleLabel(eng.current!.doc, nodeId, moduleId, label.trim() || null)),
      removeModule: (nodeId, moduleId) => {
        const scene = sceneRef.current!;
        if (scene.selection.type === "module" && scene.selection.ref === `${nodeId}/${moduleId}`)
          scene.selection = { type: "node", ref: nodeId };
        commitModules(D.removeModule(eng.current!.doc, nodeId, moduleId));
      },
      remove: (type, ref) => {
        const scene = sceneRef.current!;
        scene.selection = { type: null, ref: null };
        scene.multi = new Set();
        scene.multiGroups = new Set();
        scene.multiEdges = new Set();
        const e = eng.current!;
        if (type === "note") return deleteNote(ref as string);
        if (type === "node") commit(D.deleteNodes(e.doc, [ref as string], bundle!.catalogue));
        if (type === "edge") {
          // Several go from the highest index down, while the indexes still name them.
          let doc = e.doc;
          const at = Array.isArray(ref) ? [...ref].sort((a, b) => b - a) : [ref as number];
          for (const i of at) doc = D.deleteEdge(doc, i);
          commit(doc);
        }
        if (type === "group") commit(D.deleteGroup(e.doc, ref as string));
      },
    }),
    [
      bundle,
      commit,
      commitModules,
      deleteNote,
      detachNote,
      notify,
      render,
      renameToLabel,
      setNoteText,
      askPalette,
    ],
  );

  // The palette's Provider and Category selects, and its row tooltips, name them the way the
  // locale does.
  const [providerNames, categoryNames, kindNames] = useMemo(() => {
    const names = (section: Record<string, unknown> | undefined) => {
      const out: Record<string, string> = {};
      for (const [id, v] of Object.entries(section ?? {}))
        if ((v as any)?.name) out[id] = (v as any).name;
      return out;
    };
    const locale = bundle?.catalogue?.locale;
    return [names(locale?.providers), names(locale?.categories), names(locale?.kinds)];
  }, [bundle]);

  const rename = useCallback(
    async (next: string) => {
      const value = next.trim().slice(0, 120);
      setEditingTitle(false);
      if (!value || value === title) return;
      const prev = title;
      setTitle(value);
      const res = await fetch(`/api/v1/designs/${props.owner}/${props.slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: value }),
      });
      if (!res.ok) {
        setTitle(prev);
        const body = await res.json().catch(() => ({}));
        setStatus(`rename failed: ${body?.error?.message ?? res.status}`);
      }
    },
    [props.owner, props.slug, title],
  );

  // ---------------------------------------------------------------- toolbar actions
  // Release what is on screen, after the same question the design page asks (lib/publish.ts):
  // unsaved edits are saved first, then the head becomes the release.
  const doPublish = async () => {
    const e = eng.current;
    if (!e) return;
    if (e.structural.length) {
      setStatus("fix structural errors before publishing");
      return;
    }
    const ctx = {
      owner: props.owner,
      slug: props.slug,
      plannedSlug: publishSlugFor({ slug: props.slug, title }),
      visibility: props.visibility,
      nextRelease,
    };
    const res = await confirmThenPublish(confirm, ctx, async () => {
      if (e.dirty || saving.current.inFlight) {
        await save();
        if (eng.current?.dirty) return null; // the save reported its own failure
      }
      setStatus("publishing…");
      return fetch(`/api/v1/designs/${props.owner}/${props.slug}/publish`, { method: "POST" });
    });
    if (!res) return;
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStatus(`publish failed: ${body?.error?.message ?? res.status}`);
      return;
    }
    setUnpublished(false);
    setNextRelease((n) => (n === undefined ? n : n + 1));
    setStatus(nextRelease ? `published v${nextRelease}` : "published");
  };

  const doClone = async () => {
    const e = eng.current!;
    setStatus("cloning…");
    const res = await fetch(`/api/v1/designs/${props.owner}/${props.slug}/clone`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ yaml: serialize(e.cst, e.doc), layout: sidecar() }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(`clone failed: ${body?.error?.message ?? res.status}`);
      return;
    }
    e.dirty = false;
    router.push(`${body.design.address}/canvas`);
  };

  // The same delete the design page offers, behind the same question.
  const doDelete = async () => {
    if (
      !(await confirm({
        title: "Delete this design?",
        body: "It disappears from every listing immediately.",
        confirmLabel: "Delete",
        danger: true,
      }))
    )
      return;
    setStatus("deleting…");
    const res = await fetch(`/api/v1/designs/${props.owner}/${props.slug}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStatus(`delete failed: ${body?.error?.message ?? res.status}`);
      return;
    }
    if (eng.current) eng.current.dirty = false;
    router.push("/?owner=me");
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/d/${props.owner}/${props.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setStatus("link copied");
    } catch {
      setStatus(url);
    }
  };

  const doExport = async (format: "svg" | "png" | "mermaid") => {
    const scene = sceneRef.current;
    if (!scene) return;
    try {
      // Mermaid is text the engine writes from the document: nothing to draw, nothing to count.
      if (format === "mermaid") {
        const doc = eng.current!.doc;
        saveFile(`${doc.id}.mmd`, toMermaid(doc, "TD", bundle?.catalogue), "text/plain");
        return;
      }
      await exportScene(scene, eng.current!.doc.id, format);
      // Counted by the server where it renders the design's export (render?download=).
      fetch(`/api/v1/designs/${props.owner}/${props.slug}/render?download=${format}`).catch(
        () => {},
      );
    } catch (err) {
      setStatus(`export failed: ${(err as Error).message}`);
    }
  };

  // The design as files, from the server so the bytes are the stored ones: the YAML, its layout
  // (design.layout.json) or both in a zip. Unsaved edits are saved first, as for publishing, so
  // what downloads is what is on screen.
  const doDownload = async (what: "yaml" | "layout" | "zip") => {
    const e = eng.current;
    if (!e) return;
    if (props.canWrite && (e.dirty || saving.current.inFlight)) {
      if (e.structural.length) {
        setStatus("fix structural errors first: the download is the saved design");
        return;
      }
      await save();
      if (eng.current?.dirty) return; // the save reported its own failure
    }
    const base = `/api/v1/designs/${props.owner}/${props.slug}`;
    const a = document.createElement("a");
    a.href = what === "zip" ? `${base}/zip` : `${base}/${what}?download=1`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // A layout file (design.layout.json) back onto this design, as one undo step. It merges by
  // default: whatever the file names wins, and anything it leaves out keeps its place
  // (`mergeImportedLayout`). A file that cannot be read is refused in the app's dialog, whole.
  // A read-only canvas takes it like any other local edit.
  const applyLayoutText = async (text: string, mode: ImportMode = "merge") => {
    const e = eng.current;
    if (!e) return;
    let result: ReturnType<typeof mergeImportedLayout>;
    try {
      result = mergeImportedLayout(e, readLayoutText(text), e.doc, mode);
    } catch (err) {
      if (!(err instanceof LayoutImportError)) throw err;
      await confirm({
        title: "Layout not imported",
        body: err.message,
        confirmLabel: "OK",
        alert: true,
      });
      return;
    }
    const { next } = result;
    commit(null, {
      apply: () => {
        e.positions = next.positions;
        e.bows = next.bows;
        e.ports = next.ports;
        e.labels = next.labels;
        e.notes = next.notes;
        e.frames = next.frames;
        e.tints = next.tints;
        e.badge = next.badge;
        e.routing = next.routing;
      },
    });
    setStatus(importNotice(result, mode));
  };

  const importLayout = (mode: ImportMode = "merge") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) void file.text().then((text) => applyLayoutText(text, mode));
    });
    input.click();
  };

  const centerOn = (subject: Subject) => {
    const scene = sceneRef.current;
    if (!scene || subject.ref === null || subject.ref === undefined) return;
    scene.select(subject.type, subject.ref);
    const box =
      subject.type === "node"
        ? scene.boxes[subject.ref as string]
        : subject.type === "group"
          ? scene.frames[subject.ref as string]
          : subject.type === "note"
            ? scene.noteBoxes[subject.ref as string]
            : subject.type === "module"
              ? scene.tiles[subject.ref as string]
              : null;
    if (box) scene.center(box);
  };

  // A finding is a question about the document: it says what is wrong, and clicking it says
  // where. The subject is selected, and the fields the rule actually reads are lit in the
  // inspector — the requirement it asked for, the property it compared, the edge field it read.
  const pickFinding = (f: CanvasFinding, key: string) => {
    const scene = sceneRef.current;
    const rule = f.id ? bundle?.catalogue?.rules?.find((r: any) => r.id === f.id) : null;
    let reads: ReturnType<typeof ruleReads> | null = null;
    try {
      reads = rule ? ruleReads(rule) : null;
    } catch {
      // A rule using a predicate this build cannot read still selects its subject.
      reads = null;
    }
    picking.current = true;
    try {
      if (f.subject?.type && f.subject.ref !== null && f.subject.ref !== undefined) {
        centerOn(f.subject);
        setDesignPanel(false);
      } else {
        // A design finding is about the design: its panel is the inspector with nothing selected.
        scene?.select(null, null);
        setDesignPanel(true);
      }
    } finally {
      picking.current = false;
    }
    setFinding({
      key,
      highlight: {
        fields: [...(reads?.props ?? []), ...(reads?.edge?.fields ?? [])],
        requirements: reads?.requirements ?? [],
        nodeKinds: reads?.nodeKinds ?? [],
        nodeCategories: reads?.nodeCategories ?? [],
      },
    });
  };

  // The highlighted field is brought into view once per click, after the inspector has drawn it.
  useEffect(() => {
    if (!finding) return;
    const id = requestAnimationFrame(() => {
      rootRef.current
        ?.querySelector(".float-inspector .field.hl")
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [finding]);

  // What the inspector card last drew, and a way to redraw once it has slid away.
  const lastInspector = useRef<React.ReactNode>(null);
  const [, redrawInspector] = useState(0);

  // ---------------------------------------------------------------- render
  const e = eng.current;
  const noteCount = e?.notes.length ?? 0;
  const structural = e?.structural ?? [];
  const rules = e?.rules ?? [];
  const blocking = structural.length > 0;
  const errors = rules.filter((r) => r.severity === "error").length;
  const warnings = rules.filter((r) => r.severity === "warning").length;
  const infos = rules.length - errors - warnings;
  const summary =
    [
      structural.length ? `${structural.length} blocking` : null,
      errors ? plural(errors, "error") : null,
      warnings ? plural(warnings, "warning") : null,
      infos ? plural(infos, "note") : null,
    ]
      .filter(Boolean)
      .join(" · ") || "No findings";
  const signInHref = `/signin?next=/d/${props.owner}/${props.slug}/canvas`;
  const ready = Boolean(bundle && e);
  const selected = Boolean(
    selection.type || multi.nodes.size || multi.groups.size || multi.edges.size,
  );
  // Pinned, Design settings is a card of its own that stays whatever is selected; the selection
  // then gets the second card. Unpinned, the one card shows the selection, or the design when it
  // was asked for and nothing is selected. panes.right governs that one card only: keeping it
  // away never hides a pinned Design settings.
  const designShown = ready && panes.design;
  const selectionShown = ready && panes.right && (selected || (!panes.design && designPanel));
  const inspectorShown = designShown || selectionShown;
  const pickerShown = Boolean(bundle) && (panes.left || picker);
  // The owner's list badge row: the choice from the sidecar the canvas holds, and what automatic
  // would pick for the document as it is now (a design with a brand keeps the server's answer).
  const badgeData: BadgeMenuData | null =
    props.badgeMenu && props.canWrite && bundle && e
      ? {
          ...props.badgeMenu,
          current: e.badge ?? null,
          auto: brandOf(props.slug)
            ? props.badgeMenu.auto
            : (() => {
                const b = badgeOf(e.doc, bundle.catalogue);
                const ref = b ? `${b.kind}:${b.id}` : null;
                const c = ref ? props.badgeMenu.providers.find((p) => p.ref === ref) : undefined;
                return c ? { markup: c.markup, name: c.name } : null;
              })(),
        }
      : null;
  const designHead = (
    <button
      type="button"
      className={`pill-btn${panes.design ? " is-on" : ""}`}
      aria-pressed={panes.design}
      aria-label={panes.design ? "Unpin Design settings" : "Pin Design settings"}
      title={`${panes.design ? "Unpin" : "Pin, to keep it beside a selection"} (\\ or D)`}
      onClick={() => pinDesign()}
    >
      <Glyph d={G.pin} size={16} />
    </button>
  );
  // The owner's edge style and list badge: both layout, both saved with the canvas's own save.
  const routing = readRouting(e?.routing);
  const designExtra =
    props.canWrite && e ? (
      <>
        <EdgeStyleField value={routing} onPick={(r) => api.setRouting(r)} />
        {badgeData ? <BadgeRow data={badgeData} onChoose={(ref) => api.setBadge(ref)} /> : null}
      </>
    ) : null;
  // The reference card under a node's disc: its ref, and what the summary route said.
  const refInfo = (nodeId: string): RefInfo | null => {
    const n = e?.doc.nodes.find((x: any) => x.id === nodeId);
    const r = n ? D.nodeRef(n) : null;
    if (!r && n && bundle && wantsRefPicker(bundle.catalogue, n)) return { unset: true };
    return r
      ? { owner: r.owner, slug: r.slug, version: r.version, entry: refStore.get(r.owner, r.slug) }
      : null;
  };
  const inspectorProps =
    bundle && e
      ? {
          selection,
          multi,
          doc: e.doc,
          notes: e.notes,
          frameStyles: e.frames,
          nodeTints: e.tints,
          edgePaths: e.bows,
          edgeLabels: e.labels,
          catalogue: bundle.catalogue,
          icons: bundle.icons,
          searchRows: bundle.search,
          api,
          highlight: finding?.highlight ?? null,
          designHead,
          designExtra,
          refs: {
            store: refStore,
            canWrite: props.canWrite,
            pickFor: refPickFor,
            onPickOpened: () => setRefPickFor(null),
            preview: (owner: string, slug: string, version: number | "head") =>
              setRefPreview({ owner, slug, version }),
          },
        }
      : null;
  // Each card is keyed by what it shows, never by the undo tick: an edit re-renders the card in
  // place, so its scroll position and the focused field survive the change. A new selection is a
  // new card, which starts at the top.
  const inspectorCard =
    inspectorShown && inspectorProps ? (
      <>
        {designShown ? (
          <section className="card inspector" aria-label="Design settings" key="design">
            <Inspector {...inspectorProps} mode="design" />
          </section>
        ) : null}
        {selectionShown ? (
          <div className="card inspector" key={`${selection.type}:${String(selection.ref)}`}>
            <Inspector {...inspectorProps} />
          </div>
        ) : null}
      </>
    ) : null;
  // The card slides out showing what it showed, not an empty box: the last one drawn stays for
  // the length of the exit transition (--dur), then goes.
  if (inspectorCard) lastInspector.current = inspectorCard;
  useEffect(() => {
    if (inspectorShown) return;
    const timer = setTimeout(() => {
      lastInspector.current = null;
      redrawInspector((n) => n + 1);
    }, 160);
    return () => clearTimeout(timer);
  }, [inspectorShown]);
  const statusClass =
    status.includes("fail") || status.includes("conflict")
      ? "status-err"
      : status === "saved" || status.startsWith("published") || status === "link copied"
        ? "status-ok"
        : status === "unsaved"
          ? "status-warn"
          : "";

  // A dropdown under the button that opened it, handing focus back to that button on close.
  const dropdown = (ev: React.MouseEvent<HTMLElement>, label: string, items: MenuEntry[]) => {
    const from = ev.currentTarget;
    const r = from.getBoundingClientRect();
    setMenu({ x: r.left, y: r.bottom + 6, items, label, from });
  };

  // The commands the menus and the quick actions share, so neither has its own copy.
  const zoomTo = (k: number) => sceneRef.current?.setZoom(k);
  const zoomIn = () => zoomTo((zoomPct / 100) * ZOOM_STEP);
  const zoomOut = () => zoomTo(zoomPct / 100 / ZOOM_STEP);
  const fitView = () => sceneRef.current?.fit();
  const openDesignSettings = () => {
    sceneRef.current?.select(null, null);
    setDesignPanel(true);
    setPane("right", true);
  };
  const cloneCommand = props.canWrite
    ? { label: "Duplicate", hint: "a private copy", run: () => void doClone() }
    : props.canClone
      ? { label: "Clone to edit", run: () => void doClone() }
      : { label: "Sign in to clone", run: () => window.location.assign(signInHref) };

  const selectAll = () => {
    const d = eng.current?.doc;
    if (!d) return;
    sceneRef.current?.selectMany({
      nodes: d.nodes.map((n: any) => n.id),
      groups: (d.groups ?? []).map((g: any) => g.id),
      edges: d.edges.map((_: any, i: number) => i),
    });
  };
  // Paste from the menu: the system clipboard when the page may read it, else the in-page copy.
  const pasteFromMenu = async () => {
    let text: string | null = null;
    try {
      text = (await navigator.clipboard?.readText?.()) ?? null;
    } catch {
      // Refused or unavailable: the in-page copy still pastes.
    }
    pasteText(text);
  };

  // The design menu (the chevron by the title), built as a tree by menu-model.ts from the same
  // commands quick actions run.
  const fileMenu = (): MenuEntry[] =>
    designMenu({
      canWrite: Boolean(props.canWrite),
      canDelete: Boolean(props.canDelete),
      unpublished: Boolean(unpublished),
      blocking,
      canUndo: Boolean(e?.undo.length),
      canRedo: Boolean(e?.redo.length),
      hasSelection: selected,
      hasContent: Boolean(e && (e.doc.nodes.length || e.doc.edges.length || e.doc.groups?.length)),
      canPaste: Boolean(clipRef.current) || Boolean(navigator.clipboard?.readText),
      mod: mod.long,
      clone: {
        label: cloneCommand.label,
        hint: "hint" in cloneCommand ? cloneCommand.hint : undefined,
      },
      view: {
        pinPicker: panes.left,
        inspectorAway: !panes.right,
        pinDesign: panes.design,
        dimEdges: edgesDimmed,
        dimEdgesHint: dimEdges === "auto" ? `past ${DIM_EDGES_OVER} edges` : undefined,
        hoverCards,
      },
      run: {
        quick: () => setQuick(true),
        rename: () => setEditingTitle(true),
        settings: openDesignSettings,
        save: () => void save(),
        publish: () => void doPublish(),
        releases: () => window.location.assign(`/d/${props.owner}/${props.slug}#section-history`),
        copyLink: () => void copyLink(),
        clone: cloneCommand.run,
        export: (what) => void doExport(what),
        download: (what) => void doDownload(what),
        importLayout,
        undo,
        redo,
        selectAll,
        copy: () => void copySelection(),
        paste: () => void pasteFromMenu(),
        duplicate: duplicateSelection,
        help: () => setHelp(true),
        delete: () => void doDelete(),
        pinPicker: (on) => setPane("left", on),
        inspectorAway: (on) => setPane("right", !on),
        pinDesign: (on) => pinDesign(on),
        dimEdges: setDimEdges,
        hoverCards: setHoverCards,
      },
    });

  // What the Dim edges box shows: the stored choice, or the auto rule on this design.
  const edgesDimmed = dimmed(dimEdges, e?.doc.edges.length ?? 0);
  const zoomMenu = (): MenuEntry[] => [
    { kind: "item", label: "Zoom in", disabled: zoomPct >= ZOOM_MAX * 100, run: zoomIn },
    { kind: "item", label: "Zoom out", disabled: zoomPct <= ZOOM_MIN * 100, run: zoomOut },
    SEP,
    { kind: "item", label: "50%", run: () => zoomTo(0.5) },
    { kind: "item", label: "100%", shortcut: `${mod.long} 1`, run: () => zoomTo(1) },
    { kind: "item", label: "200%", run: () => zoomTo(2) },
    SEP,
    { kind: "item", label: "Fit", shortcut: `${mod.long} 0`, run: fitView },
  ];

  // Quick actions (⌘K): the same commands as the menus, the dock and the keys, by name. What
  // cannot run right now (nothing to undo, nothing selected to group) is left out.
  const quickActions = (): QuickAction[] => {
    const k = mod.long;
    const list: Array<QuickAction | null> = [
      {
        id: "add-component",
        group: "Add",
        label: "Add component…",
        hint: "/",
        keywords: "picker insert new",
        always: true,
        run: (q) => (q.trim() ? askPalette(q.trim()) : openPicker()),
      },
      multi.nodes.size || multi.groups.size
        ? {
            id: "add-group",
            group: "Add",
            label: "Add group",
            hint: "G",
            keywords: "group selection",
            run: groupSelection,
          }
        : null,
      {
        id: "add-note",
        group: "Add",
        label: "Add note",
        keywords: "annotation comment",
        run: () => addNote(),
      },
      {
        id: "fit",
        group: "View",
        label: "Fit",
        hint: `${k} 0`,
        keywords: "zoom whole view",
        run: fitView,
      },
      zoomPct < ZOOM_MAX * 100
        ? { id: "zoom-in", group: "View", label: "Zoom in", keywords: "bigger", run: zoomIn }
        : null,
      zoomPct > ZOOM_MIN * 100
        ? { id: "zoom-out", group: "View", label: "Zoom out", keywords: "smaller", run: zoomOut }
        : null,
      {
        id: "zoom-100",
        group: "View",
        label: "100%",
        hint: `${k} 1`,
        keywords: "zoom actual size reset",
        run: () => zoomTo(1),
      },
      {
        id: "toggle-notes",
        group: "View",
        label: "Toggle notes",
        hint: "N",
        keywords: showNotes ? "hide notes" : "show notes",
        run: () => setNotesShown(!showNotesRef.current),
      },
      {
        id: "dim-edges",
        group: "View",
        label: `Dim edges: ${edgesDimmed ? "off" : "on"}`,
        keywords: "dense fade quiet edges lines ink",
        run: () => setDimEdges(!edgesDimmed),
      },
      {
        id: "hover-cards",
        group: "View",
        label: `Hover cards: ${hoverCards ? "off" : "on"}`,
        hint: "Shift H",
        keywords: "tooltip card hover details popup",
        run: () => setHoverCards(!hoverCards),
      },
      selection.type === "node"
        ? {
            id: "trace-flow",
            group: "View",
            label: "Trace flow",
            hint: "T",
            keywords: "lens path upstream downstream highlight reach",
            run: traceSelected,
          }
        : null,
      {
        id: "toggle-inspector",
        group: "View",
        label: "Toggle inspector",
        hint: `${k} Shift P`,
        keywords: panes.right ? "hide panel" : "show panel",
        run: () => setPane("right"),
      },
      {
        id: "pin-picker",
        group: "View",
        label: panes.left ? "Unpin picker" : "Pin picker",
        hint: `${k} Shift K`,
        keywords: "component panel side",
        run: () => setPane("left"),
      },
      {
        id: "pin-design",
        group: "View",
        label: panes.design ? "Unpin design settings" : "Pin design settings",
        hint: "\\ or D",
        keywords: "design panel requirements badge side",
        run: () => pinDesign(),
      },
      {
        id: "help",
        group: "View",
        label: "Keys & gestures",
        hint: "?",
        keywords: "help shortcuts keyboard",
        run: () => setHelp(true),
      },
      multi.nodes.size && e?.doc.groups?.length
        ? {
            id: "move-to-group",
            group: "Design",
            label: "Move to group…",
            keywords: "group parent put into frame",
            run: () => openMoveTo(window.innerWidth / 2 - 140, window.innerHeight * 0.22),
          }
        : null,
      { id: "arrange", group: "Design", label: "Arrange", keywords: "layout tidy", run: arrange },
      ...(props.canWrite && e
        ? (["orthogonal", "bundled", "curved"] as const)
            .filter((r) => r !== routing)
            .map(
              (r): QuickAction => ({
                id: `edge-style-${r}`,
                group: "Design",
                label: `Edge style: ${r}`,
                keywords: "edges routing orthogonal bundled trunk curved lines connectors elbow",
                run: () => api.setRouting(r),
              }),
            )
        : []),
      e?.undo.length
        ? { id: "undo", group: "Design", label: "Undo", hint: `${k} Z`, run: undo }
        : null,
      e?.redo.length
        ? { id: "redo", group: "Design", label: "Redo", hint: `${k} Y`, run: redo }
        : null,
      props.canWrite && !blocking
        ? { id: "save", group: "Design", label: "Save", hint: `${k} S`, run: () => void save() }
        : null,
      props.canWrite && unpublished && !blocking
        ? {
            id: "publish",
            group: "Design",
            label: "Publish",
            keywords: "release",
            run: () => void doPublish(),
          }
        : null,
      {
        id: "export-svg",
        group: "Design",
        label: "Export SVG",
        keywords: "download image",
        run: () => void doExport("svg"),
      },
      {
        id: "export-png",
        group: "Design",
        label: "Export PNG",
        keywords: "download image",
        run: () => void doExport("png"),
      },
      {
        id: "export-mermaid",
        group: "Design",
        label: "Export Mermaid",
        keywords: "download flowchart text mmd",
        run: () => void doExport("mermaid"),
      },
      {
        id: "download-yaml",
        group: "Design",
        label: "Download YAML",
        keywords: "export source file",
        run: () => void doDownload("yaml"),
      },
      {
        id: "download-layout",
        group: "Design",
        label: "Download layout (JSON)",
        keywords: "export sidecar positions notes",
        run: () => void doDownload("layout"),
      },
      {
        id: "download-zip",
        group: "Design",
        label: "Download both (.zip)",
        keywords: "export yaml layout archive",
        run: () => void doDownload("zip"),
      },
      {
        id: "import-layout",
        group: "Design",
        label: "Import layout (JSON)",
        keywords: "upload restore sidecar positions merge",
        run: () => importLayout(),
      },
      {
        id: "import-layout-replace",
        group: "Design",
        label: "Import layout (replace)",
        keywords: "upload restore sidecar positions overwrite",
        run: () => importLayout("replace"),
      },
      props.canWrite
        ? {
            id: "rename",
            group: "Design",
            label: "Rename",
            keywords: "title",
            run: () => setEditingTitle(true),
          }
        : null,
      {
        id: "design-settings",
        group: "Design",
        label: "Design settings",
        keywords: "id requirements",
        run: openDesignSettings,
      },
      {
        id: "clone",
        group: "Design",
        label: cloneCommand.label,
        keywords: "clone copy duplicate fork",
        run: cloneCommand.run,
      },
    ];
    return list.filter((a): a is QuickAction => Boolean(a));
  };

  // Go to: every component and group of the design, by the name it shows.
  const quickTargets = (): QuickTarget[] => {
    if (!e || !bundle) return [];
    return [
      ...e.doc.nodes.map(
        (n: any): QuickTarget => ({
          type: "node",
          id: n.id,
          label: D.displayName(bundle.catalogue, n),
        }),
      ),
      ...((e.doc.groups ?? []) as any[]).map(
        (g): QuickTarget => ({ type: "group", id: g.id, label: g.label || g.id }),
      ),
    ];
  };

  // "Suggested" when a wire is let go on empty canvas: what this design already uses most.
  const suggested = (): string[] => {
    if (!e) return [];
    const counts = new Map<string, number>();
    for (const n of e.doc.nodes as any[])
      if (n.component) counts.set(n.component, (counts.get(n.component) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([id]) => id);
  };

  // The picker opened at a wire's end sits by that point, kept on screen.
  const anchorStyle = (() => {
    if (!pickAnchor) return undefined;
    const W = rootRef.current?.clientWidth ?? window.innerWidth;
    const H = rootRef.current?.clientHeight ?? window.innerHeight;
    const h = Math.min(420, H * 0.6);
    return {
      left: Math.max(12, Math.min(pickAnchor.x + 8, W - 372)),
      top: Math.max(12, Math.min(pickAnchor.y + 8, H - h - 12)),
    };
  })();

  const dockButton = (
    label: string,
    key: string,
    glyph: string,
    onClick: () => void,
    opts: {
      pressed?: boolean;
      disabled?: boolean;
      ref?: React.Ref<HTMLButtonElement>;
      className?: string;
    } = {},
  ) => (
    <button
      type="button"
      ref={opts.ref}
      className={`dock-btn${opts.pressed ? " is-on" : ""}${opts.className ? ` ${opts.className}` : ""}`}
      aria-label={label}
      aria-pressed={opts.pressed}
      disabled={opts.disabled}
      title={key ? `${label} (${key})` : label}
      onClick={onClick}
    >
      <Glyph d={glyph} />
    </button>
  );

  return (
    <div className="zeema-canvas" ref={rootRef}>
      {bundle ? <ProviderSprite icons={bundle.icons} /> : null}
      <div className="scene-wrap">
        <svg ref={svgRef} className="scene" role="img" aria-label="Design canvas">
          <defs />
          <g className="viewport">
            <g className="layer-frames" />
            {/* Notes sit under the components; a note being dragged is lifted over them. */}
            <g className="layer-notes" />
            <g className="layer-edges" />
            <g className="layer-nodes" />
            <g className="layer-overlay" />
          </g>
        </svg>
        {error ? <div className="empty-state sev-error">{error}</div> : null}
        {!error && e && e.doc.nodes.length === 0 ? (
          <div className="empty-state">
            {pickerShown
              ? "Click a component in the picker, or drag it here."
              : "Press + or / to open the picker, then click a component or drag it here."}
          </div>
        ) : null}
      </div>

      {/* top left: back, title, the design menu */}
      <div className="float float-tl">
        <div className="pill">
          <Link
            href={`/d/${props.owner}/${props.slug}`}
            className="pill-btn no-underline"
            title="Back to the design page"
            aria-label="Back to the design page"
          >
            <Glyph d={G.back} size={18} />
          </Link>
          {editingTitle ? (
            <input
              className="input canvas-title-input"
              defaultValue={title}
              maxLength={120}
              // biome-ignore lint/a11y/noAutofocus: the field appears on the user's own click
              autoFocus
              onFocus={(ev) => ev.currentTarget.select()}
              onBlur={(ev) => void rename(ev.currentTarget.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") ev.currentTarget.blur();
                if (ev.key === "Escape") setEditingTitle(false);
              }}
            />
          ) : props.canWrite ? (
            <button
              type="button"
              className="canvas-title canvas-title-btn"
              title="Rename"
              onClick={() => setEditingTitle(true)}
            >
              {title}
            </button>
          ) : (
            <span className="canvas-title" title={title}>
              {title}
            </span>
          )}
          <button
            type="button"
            className="pill-btn"
            aria-haspopup="menu"
            aria-expanded={menu?.label === "Design menu"}
            aria-label="Design menu"
            title="Design menu"
            onClick={(ev) =>
              menu?.label === "Design menu"
                ? setMenu(null)
                : dropdown(ev, "Design menu", fileMenu())
            }
          >
            <Glyph d={G.chevron} size={16} />
          </button>
        </div>
      </div>

      {/* top right: save state, zoom, notes, theme, account */}
      <div className="float float-tr">
        <div className="pill">
          {props.canWrite && status === "unsaved" ? (
            <button
              type="button"
              className={`status status-btn ${statusClass}`}
              onClick={() => void save()}
              disabled={blocking}
              title={blocking ? "Fix structural errors first" : `Save (${mod.long} S)`}
            >
              {status}
            </button>
          ) : (
            <span className={`status ${statusClass}`} role="status" title={status}>
              {status}
            </span>
          )}
          {props.canWrite ? (
            <Switch
              className="auto"
              label="auto"
              title="Save a moment after every change"
              checked={autosave}
              onChange={setAutosave}
            />
          ) : null}
          <span className="pill-sep" />
          <button
            type="button"
            className="pill-btn zoom-btn"
            aria-haspopup="menu"
            aria-expanded={menu?.label === "Zoom"}
            aria-label={`Zoom ${zoomPct}%`}
            title="Zoom"
            onClick={(ev) =>
              menu?.label === "Zoom" ? setMenu(null) : dropdown(ev, "Zoom", zoomMenu())
            }
          >
            <span className="mono">{zoomPct}%</span>
            <Glyph d={G.chevron} size={14} />
          </button>
          <button
            type="button"
            className={`pill-btn notes-toggle${showNotes ? " is-on" : ""}`}
            aria-pressed={showNotes}
            onClick={() => setNotesShown(!showNotes)}
            title={showNotes ? "Hide the notes (N)" : "Show the notes (N)"}
            aria-label={showNotes ? "Hide the notes" : "Show the notes"}
          >
            <Glyph d={G.note} size={18} />
            {noteCount ? <span className="mono count">{noteCount}</span> : null}
          </button>
          <ThemeToggle />
          <span className="pill-sep" />
          {props.user ? (
            <UserMenu
              username={props.user.username}
              displayName={props.user.displayName}
              avatarUrl={props.user.avatarUrl}
              isAdmin={props.user.isAdmin}
              actingAdmin={props.user.actingAdmin}
            />
          ) : (
            <a className="btn btn-primary btn-sm no-underline" href={signInHref}>
              Sign in
            </a>
          )}
        </div>
      </div>

      {/* the picker: a popover over the dock, or pinned as a side panel */}
      {pickerShown && bundle ? (
        <div
          className={`float ${
            pickAnchor
              ? "float-picker float-picker-at"
              : panes.left
                ? "float-picker-pinned"
                : "float-picker"
          }`}
          style={anchorStyle}
          ref={pickerRef}
        >
          <section
            className="card picker"
            aria-label={pickAnchor ? "Add a component and connect it" : "Add a component"}
          >
            <div className="picker-head">
              <span className="picker-title">
                {pickAnchor ? "Add and connect" : "Add a component"}
              </span>
              {pickAnchor ? null : (
                <button
                  type="button"
                  className={`pill-btn${panes.left ? " is-on" : ""}`}
                  aria-pressed={panes.left}
                  aria-label={panes.left ? "Unpin the picker" : "Pin the picker as a side panel"}
                  title={`${panes.left ? "Unpin" : "Pin as a side panel"} (${mod.long} Shift K)`}
                  onClick={() => {
                    if (panes.left) setPicker(false);
                    setPane("left");
                  }}
                >
                  <Glyph d={G.pin} size={16} />
                </button>
              )}
            </div>
            <Palette
              rows={bundle.search}
              icons={bundle.icons}
              providerNames={providerNames}
              categoryNames={categoryNames}
              kindNames={kindNames}
              query={paletteQuery}
              onQuery={setPaletteQuery}
              focusSeq={paletteFocus}
              onCreate={placeFromPicker}
              recent={recent}
              suggested={pickAnchor ? suggested() : undefined}
            />
          </section>
        </div>
      ) : null}

      {/* bottom centre: the dock */}
      <div className="float float-dock">
        <div className="pill dock" role="toolbar" aria-label="Canvas tools">
          {dockButton("Select", "V", G.select, () => setTool("select"), {
            pressed: tool === "select",
          })}
          {dockButton("Hand", "H", G.hand, () => setTool("hand"), { pressed: tool === "hand" })}
          <span className="pill-sep" />
          {dockButton(
            "Add a component",
            "/",
            G.plus,
            () => (picker && !panes.left ? closePicker(false) : openPicker()),
            { pressed: pickerShown, ref: plusBtn, className: "dock-add" },
          )}
          {dockButton("Group the selection", "G", G.group, groupSelection, {
            disabled: multi.nodes.size === 0 && multi.groups.size === 0,
          })}
          {dockButton("Add a note", "", G.note, () => addNote())}
          {dockButton("Arrange", "", G.arrange, arrange)}
          {!props.canWrite ? (
            <>
              <span className="pill-sep" />
              {props.canClone ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={doClone}>
                  Clone to edit
                </button>
              ) : (
                <a className="btn btn-primary btn-sm no-underline" href={signInHref}>
                  Sign in to clone
                </a>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* right: the inspector card, only while there is something to inspect */}
      <aside
        className={`float float-inspector${inspectorShown ? " is-shown" : ""}${
          designShown ? " has-pinned" : ""
        }${designShown && selectionShown ? " has-two" : ""}`}
        aria-hidden={!inspectorShown}
        aria-label="Inspector"
      >
        {inspectorCard ?? lastInspector.current}
      </aside>

      {/* bottom right: findings */}
      {bundle && e ? (
        <div
          className={`float float-findings${findingsOpen && inspectorShown ? " beside-inspector" : ""}`}
          ref={findingsRef}
        >
          {findingsOpen ? (
            <div className="card findings-card" id="canvas-findings">
              <FindingsPanel
                structural={structural}
                rules={rules}
                catalogue={bundle.catalogue}
                onPick={pickFinding}
                active={finding?.key ?? null}
              />
            </div>
          ) : null}
          <button
            type="button"
            className={`pill findings-pill${blocking ? " is-blocking" : ""}`}
            aria-expanded={findingsOpen}
            aria-controls="canvas-findings"
            onClick={() => setFindingsOpen((o) => !o)}
            title={findingsOpen ? "Hide the findings" : "Show the findings"}
          >
            {structural.length || errors ? <span className="sev-dot error" /> : null}
            {warnings ? <span className="sev-dot warning" /> : null}
            {infos ? <span className="sev-dot info" /> : null}
            {!structural.length && !rules.length ? <span className="sev-dot ok" /> : null}
            <span>{summary}</span>
          </button>
        </div>
      ) : null}

      {help ? (
        <div className="help-overlay">
          <div className="help-backdrop" />
          <div
            className="panel help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="canvas-help-title"
            ref={helpDialog}
          >
            <div className="help-head">
              <h2 className="help-title" id="canvas-help-title">
                Keys and gestures
              </h2>
              <button
                type="button"
                className="help-close"
                aria-label="Close"
                ref={helpClose}
                onClick={() => setHelp(false)}
              >
                ×
              </button>
            </div>
            <div className="help-body">
              {helpSections(mod.long).map(([section, rows]) => (
                <section key={section}>
                  <div className="label">{section}</div>
                  <dl className="help-rows">
                    {rows.map(([keys, action]) => (
                      <div className="help-row" key={`${keys.join("+")} ${action}`}>
                        <dt>
                          {keys.map((key) => (
                            <kbd key={key}>{key}</kbd>
                          ))}
                        </dt>
                        <dd>{action}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {hint ? (
        <div
          className="panel canvas-hint"
          ref={hintEl}
          role="status"
          style={{
            left: Math.max(8, Math.min(hint.x + 12, window.innerWidth - 320)),
            top: Math.max(8, hint.y + 12),
          }}
        >
          <p>
            Dragging a group moves it. To connect a group as a whole, drop a wire on its dashed
            border or its name, or select it and drag from a dot on its border. Dropping inside a
            group adds a new member there. For something outside your control, add an External
            system node.
          </p>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => {
              askPalette("category:external");
              setHint(null);
            }}
          >
            Add external node
          </button>
        </div>
      ) : null}
      {quick && bundle && e ? (
        <QuickActions
          actions={quickActions()}
          rows={bundle.search}
          icons={bundle.icons}
          providerNames={providerNames}
          kindNames={kindNames}
          targets={quickTargets()}
          onComponent={(id) => addComponent(id)}
          onGoto={(t) => centerOn({ type: t.type, ref: t.id })}
          onClose={closeQuick}
        />
      ) : null}
      {hoverCard && bundle && e ? (
        <HoverCard
          at={hoverCard}
          doc={e.doc}
          catalogue={bundle.catalogue}
          refInfo={refInfo}
          refName={(n: any) => refNameFor(refStore, bundle.catalogue, n)}
          theme={pageTheme()}
        />
      ) : null}
      {dotPop && bundle && e
        ? (() => {
            const rows = findingRows(structural, rules, bundle.catalogue).filter(
              (r) => r.f.subject?.type === "node" && D.endNode(r.f.subject.ref) === dotPop.node,
            );
            if (!rows.length) return null;
            return (
              <div
                className="finding-pop"
                ref={dotPopRef}
                role="dialog"
                aria-label="Findings on this component"
                style={{
                  left: Math.max(8, Math.min(dotPop.x - 20, window.innerWidth - 328)),
                  // Under the dot, or over it when the dot is low on the screen.
                  ...(dotPop.y > window.innerHeight * 0.6
                    ? { bottom: window.innerHeight - dotPop.y + 12 }
                    : { top: dotPop.y + 4 }),
                }}
                // Over and move, not enter: the pointer arrives from the scene's own SVG, which
                // React's enter, built from the pair of out/over events, can miss.
                onPointerOver={holdDotPop}
                onPointerMove={holdDotPop}
                onPointerLeave={leaveDotPop}
              >
                {rows.map((row) => (
                  <FindingRow
                    key={row.key}
                    row={row}
                    active={finding?.key === row.key}
                    onPick={(f, key) => {
                      setDotPop(null);
                      pickFinding(f, key);
                    }}
                  />
                ))}
              </div>
            );
          })()
        : null}
      {refPreview ? (
        <RefPreview
          key={`${refPreview.owner}/${refPreview.slug}@${refPreview.version}`}
          target={refPreview}
          store={refStore}
          theme={pageTheme()}
          onClose={() => setRefPreview(null)}
        />
      ) : null}
      {moveTo && e ? (
        <GroupPicker
          x={moveTo.x}
          y={moveTo.y}
          groups={e.doc.groups || []}
          current={(() => {
            const now = new Set(
              e.doc.nodes
                .filter((n: any) => moveTo.ids.includes(n.id))
                .map((n: any) => n.group ?? null),
            );
            return now.size === 1 ? ([...now][0] as string | null) : undefined;
          })()}
          onPick={(g) => moveToGroup(moveTo.ids, g)}
          onClose={closeMoveTo}
        />
      ) : null}
      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.items}
          label={menu.label}
          onClose={() => {
            setMenu(null);
            menu.from?.focus();
          }}
        />
      ) : null}
    </div>
  );
}
