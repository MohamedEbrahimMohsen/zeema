"use client";

// The canvas shell. React renders the frame once and re-renders the side panels only at commit
// boundaries; positions live in refs and go straight to the SVG during a drag. Every change goes
// through `commit`, which snapshots first, so undo and redo are uniform.
import { ruleReads } from "@zeema/core/describe";
import * as D from "@zeema/core/document";
import { edgeKeys, innermostFrameAt, rekeyBows, rekeyPorts } from "@zeema/core/geometry";
import { layout } from "@zeema/core/layout";
import { runRules } from "@zeema/core/rules";
import { check } from "@zeema/core/structure";
import { parse, serialize } from "@zeema/core/yaml";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BadgeMenuData } from "@/components/BadgePicker";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { badgeOf, brandOf } from "@/lib/badge";
import {
  type EdgePorts,
  type FrameStyle,
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
  readSidecar,
  retargetAnchors,
  retargetFrame,
  retargetTint,
  writeSidecar,
} from "@/lib/layout-sidecar";
import { BadgeRow } from "./BadgeRow";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { exportScene } from "./exportScene";
import { type CanvasFinding, FindingsPanel } from "./FindingsPanel";
import { type Highlight, Inspector, type InspectorApi } from "./Inspector";
import { Palette } from "./Palette";
import { QuickActions } from "./QuickActions";
import type { QuickAction, QuickTarget } from "./quick-actions";
import { facingSide, Scene, type Subject, ZOOM_MAX, ZOOM_MIN } from "./scene";
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
  bows: Record<string, number>;
  /** Where each edge's ends meet their boxes, by edge key: sidecar, never YAML. */
  ports: Record<string, EdgePorts>;
  notes: Note[];
  /** Group tint and icon by group id: sidecar, never YAML. */
  frames: Record<string, FrameStyle>;
  /** Component tints by node id: sidecar, never YAML. */
  tints: Record<string, NodeTint>;
  /** The list badge the owner chose (Design settings here, or the design page): sidecar, never
   *  YAML. It rides the canvas's own save, so a save never drops it. */
  badge?: string;
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
const ZOOM_STEP = 1.25;
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
      [["Click"], "Select what you click; empty space clears the selection."],
      [["Shift", "Click"], "Add a component to the selection, or take it out."],
      [["Drag"], "Sweep a box over empty space to select several; Shift keeps what you had."],
      [[mod, "A"], "Select every component."],
      [["Drag"], "Move the selection. A component dropped inside a group joins it."],
      [["Drag a group"], "Move a group with everything inside it; the grouping does not change."],
      [["←", "→", "↑", "↓"], "Nudge the selection by one."],
      [["Shift", "←"], "Nudge by ten."],
      [["Esc"], "Clear the selection, or abandon what you are dragging."],
    ],
  ],
  [
    "Edit",
    [
      [["Double-click"], "Rename what you clicked: a component, an edge or a group."],
      [["Enter"], "Rename the selection."],
      [["G"], "Put the selection in a new group."],
      [[mod, "Shift", "G"], "Ungroup the selected group; its components stay."],
      [[mod, "D"], "Duplicate the selection."],
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
      [[mod, "0"], "Fit the whole design on screen."],
      [[mod, "1"], "Back to actual size."],
      [[mod, "Shift", "K"], "Pin the component picker as a side panel, or unpin it."],
      [[mod, "Shift", "D"], "Pin Design settings so it stays beside a selection, or unpin it."],
      [[mod, "Shift", "P"], "Let the inspector show for a selection, or keep it away."],
      [[mod, "S"], "Save."],
      [["Esc"], "Close the picker, a menu or the findings."],
      [["?"], "Open and close this dialog."],
    ],
  ],
];

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
  const svgRef = useRef<SVGSVGElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const eng = useRef<Engine | null>(null);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState<string>(props.canWrite ? "saved" : "read only");
  const [autosave, setAutosave] = useState(props.canWrite);
  // One menu at a time: a right-click menu, or a dropdown under a button of the chrome. A
  // dropdown hands focus back to the button that opened it (`from`) when it closes.
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    items: MenuItem[];
    label?: string;
    from?: HTMLElement | null;
  } | null>(null);
  const [help, setHelp] = useState(false);
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
  // Pinning Design settings shows it (and lets the right-hand cards show at all); unpinning puts
  // it away, the way unpinning the picker closes it.
  const pinDesign = useCallback(
    (on?: boolean) => {
      updatePanes((prev) => {
        const next = on ?? !prev.design;
        return next ? { design: true, right: true } : { design: false };
      });
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
  const [title, setTitle] = useState(props.title);
  const [unpublished, setUnpublished] = useState(props.unpublished);
  const [editingTitle, setEditingTitle] = useState(false);
  // Default shown; the stored preference is read after mount so the server and the first
  // client render agree.
  const [showNotes, setShowNotes] = useState(true);
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
  const [multi, setMulti] = useState<Set<string>>(new Set());
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
        notes: e.notes,
        frameStyles: e.frames,
        nodeTints: e.tints,
        showNotes: showNotesRef.current,
        pinnedNotes: pinnedNotesRef.current,
        findings: [...e.structural, ...e.rules],
      });
      setSelection({ ...scene.selection });
      setMulti(new Set(scene.multi));
      setTick((t) => t + 1);
    } catch (err) {
      console.error(err);
      setStatus(`draw failed: ${(err as Error).message}`);
    }
  }, [bundle, relayout, derive]);

  // Notes ride along with the positions: one save request, one sidecar, and never a byte of
  // the YAML, because a note is not a node.
  const sidecar = useCallback(() => {
    const e = eng.current!;
    return writeSidecar({
      nodes: e.positions,
      edges: e.bows,
      ports: e.ports,
      notes: e.notes,
      frames: e.frames,
      tints: e.tints,
      badge: e.badge,
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
    (next: any, opts: { coalesce?: boolean; apply?: () => void } = {}) => {
      const e = eng.current!;
      const snapshot = {
        doc: clone(e.doc),
        positions: clone(e.positions),
        bows: clone(e.bows),
        ports: clone(e.ports),
        notes: clone(e.notes),
        frames: clone(e.frames),
        tints: clone(e.tints),
        badge: e.badge,
      };
      const now = Date.now();
      const coalesce = Boolean(opts.coalesce) && now - e.lastDragAt < 400;
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
    e.redo.push({
      doc: clone(e.doc),
      positions: clone(e.positions),
      bows: clone(e.bows),
      ports: clone(e.ports),
      notes: clone(e.notes),
      frames: clone(e.frames),
      tints: clone(e.tints),
      badge: e.badge,
    });
    Object.assign(e, prev);
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
    e.undo.push({
      doc: clone(e.doc),
      positions: clone(e.positions),
      bows: clone(e.bows),
      ports: clone(e.ports),
      notes: clone(e.notes),
      frames: clone(e.frames),
      tints: clone(e.tints),
      badge: e.badge,
    });
    Object.assign(e, next);
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
        },
      });
    },
    [bundle, commit],
  );

  // ---------------------------------------------------------------- selection commands
  const ids = () => [...(sceneRef.current?.multi ?? [])];

  const deleteSelection = useCallback(() => {
    const scene = sceneRef.current!;
    const e = eng.current!;
    const s = scene.selection;
    const sel = ids();
    scene.selection = { type: null, ref: null };
    scene.multi = new Set();
    if (s.type === "note") {
      const id = s.ref as string;
      return commit(null, { apply: () => (e.notes = e.notes.filter((n) => n.id !== id)) });
    }
    if (sel.length) return commit(D.deleteNodes(e.doc, sel, bundle!.catalogue));
    if (s.type === "edge") return commit(D.deleteEdge(e.doc, s.ref as number));
    if (s.type === "group") return commit(D.deleteGroup(e.doc, s.ref as string));
    render();
  }, [bundle, commit, render]);

  const groupSelection = useCallback(() => {
    const scene = sceneRef.current!;
    const sel = ids();
    if (!sel.length) return;
    const { doc, id } = D.addGroup(eng.current!.doc, sel, "system");
    scene.multi = new Set();
    scene.selection = { type: "group", ref: id };
    commit(doc);
  }, [commit]);

  const duplicateSelection = useCallback(() => {
    const scene = sceneRef.current!;
    const e = eng.current!;
    const sel = ids();
    if (!sel.length) return;
    const { doc, map } = D.duplicateNodes(e.doc, sel, bundle!.catalogue);
    const copies = Object.values(map) as string[];
    scene.multi = new Set(copies);
    scene.selection = { type: "node", ref: copies[copies.length - 1] };
    commit(doc, {
      apply: () => {
        for (const [from, to] of Object.entries(map) as [string, string][]) {
          const p = e.positions[from] || [40, 40];
          e.positions[to] = [p[0] + 28, p[1] + 28];
        }
      },
    });
  }, [bundle, commit]);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      const sel = ids();
      if (!sel.length) return;
      commit(null, {
        coalesce: true,
        apply: () => {
          const e = eng.current!;
          for (const id of sel) {
            const p = e.positions[id];
            if (p) e.positions[id] = [p[0] + dx, p[1] + dy];
          }
        },
      });
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

  const arrange = useCallback(() => {
    commit(null, {
      apply: () => {
        const e = eng.current!;
        const result = layout(e.doc, bundle!.catalogue) as any;
        e.positions = result.positions;
        e.sizes = result.sizes;
        e.bows = {};
      },
    });
    sceneRef.current?.fit();
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
      setRecent((prev) => {
        const next = [componentId, ...prev.filter((x) => x !== componentId)].slice(0, RECENT_MAX);
        try {
          window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        } catch {
          /* a browser that will not remember still places the component */
        }
        return next;
      });
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
    [bundle, commit],
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
    (target: Subject, at: [number, number]): MenuItem[] => {
      const scene = sceneRef.current!;
      const e = eng.current!;
      const count = scene.multi.size;
      if (target.type === "node") {
        const grouped = e.doc.nodes.some((n: any) => scene.multi.has(n.id) && n.group);
        return [
          {
            label: "Rename",
            hint: "double click",
            run: () => scene.editLabel("node", target.ref as string),
          },
          { label: count > 1 ? `Group these ${count}` : "Group", hint: "G", run: groupSelection },
          grouped ? { label: "Remove from group", run: releaseFromGroup } : null,
          {
            label: count > 1 ? `Duplicate these ${count}` : "Duplicate",
            hint: "Ctrl D",
            run: duplicateSelection,
          },
          {
            label: "Add note",
            hint: "pinned here",
            run: () => addNoteOn({ node: target.ref as string }),
          },
          "-",
          {
            label: count > 1 ? `Delete these ${count}` : "Delete",
            hint: "Del",
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
          { label: "Edit label", hint: "double click", run: () => scene.editLabel("edge", i) },
          {
            label: "Reverse direction",
            // Bows are keyed by pair and order, so without re-keying, reversing one of a
            // reciprocal pair would hand its bow to the other lane.
            run: () => {
              const next = D.reverseEdge(e.doc, i);
              commit(next, {
                apply: () => {
                  e.bows = rekeyBows(e.doc, next, e.bows, [i]);
                  e.ports = rekeyPorts(e.doc, next, e.ports, [i]);
                },
              });
            },
          },
          {
            label: edge?.mode === "async" ? "Make synchronous" : "Make asynchronous",
            run: () =>
              commit(D.setEdgeField(e.doc, i, "mode", edge?.mode === "async" ? "sync" : "async")),
          },
          {
            label: "Straighten",
            disabled: !e.bows[key],
            run: () => commit(null, { apply: () => delete e.bows[key] }),
          },
          {
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
          "-",
          {
            label: "Delete",
            hint: "Del",
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
          { label: "Edit text", hint: "double click", run: () => scene.editLabel("note", id) },
          note?.anchor
            ? { label: "Detach note", hint: "keep it where it is", run: () => detachNote(id) }
            : null,
          "-",
          { label: "Delete note", hint: "Del", danger: true, run: () => deleteNote(id) },
        ];
      }
      if (target.type === "group") {
        const id = target.ref as string;
        const members = D.groupMembers(e.doc, id).length;
        return [
          { label: "Rename", hint: "double click", run: () => scene.editLabel("group", id) },
          {
            label: "Select members",
            disabled: !members,
            run: () => scene.selectNodes(D.groupMembers(e.doc, id)),
          },
          { label: "Add note", hint: "pinned here", run: () => addNoteOn({ group: id }) },
          "-",
          {
            label: "Remove group, keep members",
            hint: "Del",
            run: () => {
              scene.select(null, null);
              commit(D.deleteGroup(e.doc, id));
            },
          },
          {
            label: `Delete group and ${members} member${members === 1 ? "" : "s"}`,
            danger: true,
            disabled: !members,
            run: () => {
              scene.select(null, null);
              scene.multi = new Set();
              commit(D.deleteGroupDeep(e.doc, id));
            },
          },
        ];
      }
      // Empty canvas. The canvas keeps no copy buffer yet, so there is no Paste to offer.
      return [
        { label: "Add component…", hint: "lands here", run: () => openPicker({ place: { at } }) },
        { label: "Add note here", hint: "annotation, not a node", run: () => addNote(at) },
        "-",
        { label: "Fit", hint: "Ctrl 0", run: () => scene.fit() },
        { label: "Arrange", run: arrange },
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
      groupSelection,
      releaseFromGroup,
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
      notes: sidecarIn.notes,
      frames: sidecarIn.frames,
      tints: sidecarIn.tints ?? {},
      badge: sidecarIn.badge,
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
        setMulti(new Set(m));
        if (!picking.current) {
          setFinding(null);
          setDesignPanel(false);
        }
      },
      onMove: (moves) => {
        const e = eng.current!;
        let next: any = null;
        for (const m of moves) {
          const node = (next || e.doc).nodes.find((n: any) => n.id === m.id);
          if (node && (node.group || null) !== (m.group || null))
            next = D.setNodeGroup(next || e.doc, m.id, m.group);
        }
        commit(next, {
          coalesce: true,
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
      onBowPreview: (key, value) => scene.repaintEdges({ ...eng.current!.bows, [key]: value }),
      onBow: (key, value) =>
        commit(null, {
          coalesce: true,
          apply: () => {
            if (value) eng.current!.bows[key] = value;
            else delete eng.current!.bows[key];
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
      onReconnect: (i, end, nodeId) => {
        const e = eng.current!;
        const { doc: next, refused } = D.reconnectEdge(e.doc, i, end, nodeId);
        if (refused === "self-loop") return notify("an edge cannot connect a component to itself");
        if (refused === "duplicate") return notify("that edge already exists");
        if (refused || next === e.doc) return;
        commit(next, {
          apply: () => {
            // Every edge keeps its index, so bows and ports follow by index; the moved end's
            // port named a point on the box it has left, so it goes.
            e.bows = rekeyBows(e.doc, next, e.bows);
            e.ports = withPort(rekeyPorts(e.doc, next, e.ports), edgeKeys(next)[i], end, null);
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
        const g = (e.doc.groups || []).find((x: any) => x.id === ref);
        return g ? g.label || "" : null;
      },
      onLabel: (kind, ref, value) => {
        const e = eng.current!;
        if (kind === "note") return setNoteText(ref as string, value);
        if (kind === "node") return renameToLabel(ref as string, value);
        if (kind === "edge")
          commit(D.setEdgeField(e.doc, ref as number, "label", value || undefined));
        if (kind === "group")
          commit(D.setGroupField(e.doc, ref as string, "label", value || undefined));
      },
      onContext: (target, x, y) => setMenu({ x, y, items: menuFor(target, scene.toWorld(x, y)) }),
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
    });
    sceneRef.current = scene;
    render();
    scene.fit();
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // The scene mounts once per bundle/design; handlers read refs so they stay current.
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
        setFinding(null);
        setFindingsOpen(false);
        if (pickerOpen.current && (!pinnedRef.current || pickAnchorRef.current)) closePicker();
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
      if (mod && ev.shiftKey && k === "d") {
        ev.preventDefault();
        pinDesign();
        return;
      }
      if (typing(ev) || onControl(ev)) return;
      if (mod && k === "s") {
        ev.preventDefault();
        void save();
        return;
      }
      if (mod && k === "z") {
        ev.preventDefault();
        ev.shiftKey ? redo() : undo();
        return;
      }
      if (mod && k === "y") {
        ev.preventDefault();
        redo();
        return;
      }
      if (mod && k === "a") {
        ev.preventDefault();
        scene.selectNodes(eng.current.doc.nodes.map((n: any) => n.id));
        return;
      }
      if (mod && k === "d") {
        ev.preventDefault();
        duplicateSelection();
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
      if (ev.key === "?") {
        setHelp((h) => !h);
        return;
      }
      const step = ev.shiftKey ? 10 : 1;
      if (ev.key === "ArrowLeft") nudge(-step, 0);
      else if (ev.key === "ArrowRight") nudge(step, 0);
      else if (ev.key === "ArrowUp") nudge(0, -step);
      else if (ev.key === "ArrowDown") nudge(0, step);
      else return;
      ev.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    save,
    undo,
    redo,
    duplicateSelection,
    groupSelection,
    deleteSelection,
    nudge,
    commit,
    setNotesShown,
    setPane,
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
      setProp: (id, p, v) => commit(D.setNodeProp(eng.current!.doc, id, p, v)),
      setNfr: (id, f, v) => commit(D.setNfr(eng.current!.doc, id, f, v)),
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
      setEdge: (i, f, v) => commit(D.setEdgeField(eng.current!.doc, i, f, v)),
      setGroupField: (id, f, v) => commit(D.setGroupField(eng.current!.doc, id, f, v)),
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
          },
        });
      },
      setParent: (id, p) => commit(D.setGroupParent(eng.current!.doc, id, p)),
      // Tint and icon are layout, like a note: the sidecar changes, the YAML never does.
      setFrameStyle: (id, patch) => {
        const e = eng.current!;
        commit(null, {
          apply: () => {
            const { strength, ...rest } = { ...(e.frames[id] ?? {}), ...patch };
            const next: FrameStyle = rest;
            if (!next.tint) delete next.tint;
            if (!next.icon) delete next.icon;
            // A strength only says how a tint fills: normal is the default and never stored.
            if (next.tint && (strength === "light" || strength === "bold"))
              next.strength = strength;
            const frames = { ...e.frames };
            if (next.tint || next.icon) frames[id] = next;
            else delete frames[id];
            e.frames = frames;
          },
        });
      },
      // A component tint is layout too. Applied to every id given: the whole multi-selection.
      setNodeTint: (ids, patch) => {
        const e = eng.current!;
        commit(null, {
          apply: () => {
            const tints = { ...e.tints };
            for (const id of ids) {
              const merged = { ...(tints[id] ?? {}), ...patch } as Partial<NodeTint> & {
                strength?: string;
              };
              if (!merged.tint) {
                delete tints[id];
                continue;
              }
              const entry: NodeTint = { tint: merged.tint };
              if (merged.strength === "light" || merged.strength === "bold")
                entry.strength = merged.strength;
              tints[id] = entry;
            }
            e.tints = tints;
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
      remove: (type, ref) => {
        const scene = sceneRef.current!;
        scene.selection = { type: null, ref: null };
        scene.multi = new Set();
        const e = eng.current!;
        if (type === "note") return deleteNote(ref as string);
        if (type === "node") commit(D.deleteNodes(e.doc, [ref as string], bundle!.catalogue));
        if (type === "edge") commit(D.deleteEdge(e.doc, ref as number));
        if (type === "group") commit(D.deleteGroup(e.doc, ref as string));
      },
    }),
    [
      bundle,
      commit,
      deleteNote,
      detachNote,
      notify,
      render,
      renameToLabel,
      setNoteText,
      askPalette,
    ],
  );

  // The palette's Provider and Category selects name them the way the locale does.
  const [providerNames, categoryNames] = useMemo(() => {
    const names = (section: Record<string, unknown> | undefined) => {
      const out: Record<string, string> = {};
      for (const [id, v] of Object.entries(section ?? {}))
        if ((v as any)?.name) out[id] = (v as any).name;
      return out;
    };
    const locale = bundle?.catalogue?.locale;
    return [names(locale?.providers), names(locale?.categories)];
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
  // Release what is on screen: unsaved edits are saved first, then the head becomes the release.
  const doPublish = async () => {
    const e = eng.current;
    if (!e) return;
    if (e.structural.length) {
      setStatus("fix structural errors before publishing");
      return;
    }
    if (e.dirty || saving.current.inFlight) {
      await save();
      if (eng.current?.dirty) return; // the save reported its own failure
    }
    setStatus("publishing…");
    const res = await fetch(`/api/v1/designs/${props.owner}/${props.slug}/publish`, {
      method: "POST",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStatus(`publish failed: ${body?.error?.message ?? res.status}`);
      return;
    }
    setUnpublished(false);
    setStatus("published");
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
    if (!confirm("Delete this design? It disappears from every listing immediately.")) return;
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

  const doExport = async (format: "svg" | "png") => {
    const scene = sceneRef.current;
    if (!scene) return;
    try {
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
  const ready = panes.right && Boolean(bundle && e);
  const selected = Boolean(selection.type || multi.size);
  // Pinned, Design settings is a card of its own that stays whatever is selected; the selection
  // then gets the second card. Unpinned, the one card shows the selection, or the design when it
  // was asked for and nothing is selected.
  const designShown = ready && panes.design;
  const selectionShown = ready && (selected || (!panes.design && designPanel));
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
      title={`${panes.design ? "Unpin" : "Pin, to keep it beside a selection"} (${mod.long} Shift D)`}
      onClick={() => pinDesign()}
    >
      <Glyph d={G.pin} size={16} />
    </button>
  );
  const designExtra = badgeData ? (
    <BadgeRow data={badgeData} onChoose={(ref) => api.setBadge(ref)} />
  ) : null;
  const inspectorProps =
    bundle && e
      ? {
          selection,
          multi,
          doc: e.doc,
          notes: e.notes,
          frameStyles: e.frames,
          nodeTints: e.tints,
          catalogue: bundle.catalogue,
          icons: bundle.icons,
          searchRows: bundle.search,
          api,
          highlight: finding?.highlight ?? null,
          designHead,
          designExtra,
        }
      : null;
  const inspectorCard =
    inspectorShown && inspectorProps ? (
      <>
        {designShown ? (
          <section className="card inspector" aria-label="Design settings" key={`design:${tick}`}>
            <Inspector {...inspectorProps} mode="design" />
          </section>
        ) : null}
        {selectionShown ? (
          <div
            className="card inspector"
            key={`${selection.type}:${String(selection.ref)}:${tick}`}
          >
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
      : status === "saved" || status === "published" || status === "link copied"
        ? "status-ok"
        : status === "unsaved"
          ? "status-warn"
          : "";

  // A dropdown under the button that opened it, handing focus back to that button on close.
  const dropdown = (ev: React.MouseEvent<HTMLElement>, label: string, items: MenuItem[]) => {
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

  const fileMenu = (): MenuItem[] => [
    { label: "Quick actions", hint: `${mod.long} K`, run: () => setQuick(true) },
    "-",
    props.canWrite ? { label: "Rename", hint: "title", run: () => setEditingTitle(true) } : null,
    { label: "Design settings", hint: "id, requirements", run: openDesignSettings },
    props.canWrite
      ? { label: "Save", hint: `${mod.long} S`, disabled: blocking, run: () => void save() }
      : null,
    "-",
    props.canWrite
      ? {
          label: unpublished ? "Publish" : "Published",
          hint: unpublished ? "release the draft" : "readers see this",
          disabled: blocking || !unpublished,
          run: () => void doPublish(),
        }
      : null,
    { label: "Copy link", run: () => void copyLink() },
    {
      label: "Releases",
      hint: "design page",
      run: () => window.location.assign(`/d/${props.owner}/${props.slug}#section-history`),
    },
    cloneCommand,
    "-",
    { label: "Export SVG", run: () => void doExport("svg") },
    { label: "Export PNG", run: () => void doExport("png") },
    { label: "Download YAML", hint: "design.yaml", run: () => void doDownload("yaml") },
    {
      label: "Download layout (JSON)",
      hint: "positions, notes",
      run: () => void doDownload("layout"),
    },
    { label: "Download both (.zip)", hint: "re-importable", run: () => void doDownload("zip") },
    "-",
    { label: "Undo", hint: `${mod.long} Z`, disabled: !e?.undo.length, run: undo },
    { label: "Redo", hint: `${mod.long} Y`, disabled: !e?.redo.length, run: redo },
    "-",
    {
      label: panes.left ? "Unpin the picker" : "Pin the picker",
      hint: `${mod.long} Shift K`,
      run: () => setPane("left"),
    },
    {
      label: panes.right ? "Keep the inspector away" : "Let the inspector show",
      hint: `${mod.long} Shift P`,
      run: () => setPane("right"),
    },
    {
      label: panes.design ? "Unpin design settings" : "Pin design settings",
      hint: `${mod.long} Shift D`,
      run: () => pinDesign(),
    },
    { label: "Keys & gestures", hint: "?", run: () => setHelp(true) },
    props.canDelete ? "-" : null,
    props.canDelete ? { label: "Delete design", danger: true, run: () => void doDelete() } : null,
  ];

  const zoomMenu = (): MenuItem[] => [
    { label: "Zoom in", disabled: zoomPct >= ZOOM_MAX * 100, run: zoomIn },
    { label: "Zoom out", disabled: zoomPct <= ZOOM_MIN * 100, run: zoomOut },
    "-",
    { label: "50%", run: () => zoomTo(0.5) },
    { label: "100%", hint: `${mod.long} 1`, run: () => zoomTo(1) },
    { label: "200%", run: () => zoomTo(2) },
    "-",
    { label: "Fit", hint: `${mod.long} 0`, run: fitView },
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
      multi.size
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
        hint: `${k} Shift D`,
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
      { id: "arrange", group: "Design", label: "Arrange", keywords: "layout tidy", run: arrange },
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
      <div className="scene-wrap">
        <svg ref={svgRef} className="scene" role="img" aria-label="Design canvas">
          <title>Design canvas</title>
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
            <span className={`status ${statusClass}`} role="status">
              {status}
            </span>
          )}
          {props.canWrite ? (
            <label className="auto" title="Save a moment after every change">
              <input
                type="checkbox"
                checked={autosave}
                onChange={(ev) => setAutosave(ev.target.checked)}
              />
              auto
            </label>
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
            disabled: multi.size === 0,
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
          targets={quickTargets()}
          onComponent={(id) => addComponent(id)}
          onGoto={(t) => centerOn({ type: t.type, ref: t.id })}
          onClose={closeQuick}
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
