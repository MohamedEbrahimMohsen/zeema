"use client";

// The canvas shell. React renders the frame once and re-renders the side panels only at commit
// boundaries; positions live in refs and go straight to the SVG during a drag. Every change goes
// through `commit`, which snapshots first, so undo and redo are uniform.
import { ruleReads } from "@zeema/core/describe";
import * as D from "@zeema/core/document";
import { edgeKeys, rekeyBows, rekeyPorts } from "@zeema/core/geometry";
import { layout } from "@zeema/core/layout";
import { runRules } from "@zeema/core/rules";
import { check } from "@zeema/core/structure";
import { parse, serialize } from "@zeema/core/yaml";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type EdgePorts,
  type FrameStyle,
  NOTE_ANCHOR_DX,
  NOTE_ANCHOR_DY,
  NOTE_ANCHOR_H,
  NOTE_ANCHOR_W,
  NOTE_DEFAULT_H,
  NOTE_DEFAULT_W,
  type Note,
  type NoteAnchor,
  nextNoteId,
  type Port,
  pruneAnchored,
  pruneFrames,
  prunePorts,
  readSidecar,
  retargetAnchors,
  retargetFrame,
  writeSidecar,
} from "@/lib/layout-sidecar";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { exportScene } from "./exportScene";
import { type CanvasFinding, FindingsPanel } from "./FindingsPanel";
import { type Highlight, Inspector, type InspectorApi } from "./Inspector";
import { Palette } from "./Palette";
import { Scene, type Subject } from "./scene";
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

// Which side panes are out is the same kind of habit: one key for both, both out by default.
const PANES_KEY = "zeema.canvas.panes";
type Panes = { left: boolean; right: boolean };
const readPanes = (): Panes => {
  try {
    const v = JSON.parse(window.localStorage.getItem(PANES_KEY) ?? "{}");
    return { left: v?.left !== false, right: v?.right !== false };
  } catch {
    return { left: true, right: true };
  }
};

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
      [
        ["Drag", "Double-click"],
        "Add a component: drag it in from the palette, or double-click it there.",
      ],
      [["Drag a dot"], "Wire an edge: drag a component's dot onto another component."],
      [
        ["Drag a group"],
        "Groups don't connect. Wire the components inside one — or add an External system node for something outside your control.",
      ],
    ],
  ],
  [
    "Select and move",
    [
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
      [["Right-click empty space"], "Add a note: an annotation, never a node."],
      [
        ["Right-click a component", "or a group"],
        "Pin a note to it; the note then follows what it is pinned to.",
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
      [[mod, "Shift", "K"], "Show or hide the palette."],
      [[mod, "Shift", "P"], "Show or hide the inspector."],
      [[mod, "S"], "Save."],
      [["?"], "Open and close this dialog."],
    ],
  ],
];

const typing = (ev: KeyboardEvent) => {
  const t = ev.target as HTMLElement | null;
  return Boolean(t && (/input|select|textarea/i.test(t.tagName) || t.isContentEditable));
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
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [help, setHelp] = useState(false);
  // The dialog owns Escape while it is open, and the other Escape handlers stand down; a ref,
  // because those handlers are bound once and must read the current answer, not a stale one.
  const helpOpen = useRef(false);
  helpOpen.current = help;
  const helpBtn = useRef<HTMLButtonElement>(null);
  const helpDialog = useRef<HTMLDivElement>(null);
  const helpClose = useRef<HTMLButtonElement>(null);
  const mod = useModKey();
  // The group-wiring hint: where it sits, and nothing else. It is a remark, not a mode.
  const [hint, setHint] = useState<{ x: number; y: number } | null>(null);
  const hintEl = useRef<HTMLDivElement>(null);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteFocus, setPaletteFocus] = useState(0);
  // Both panes out until the stored preference is read after mount (server and client agree).
  const [panes, setPanesState] = useState<Panes>({ left: true, right: true });
  useEffect(() => setPanesState(readPanes()), []);
  const setPane = useCallback((side: keyof Panes, open?: boolean) => {
    setPanesState((prev) => {
      const next = { ...prev, [side]: open ?? !prev[side] };
      try {
        window.localStorage.setItem(PANES_KEY, JSON.stringify(next));
      } catch {
        /* a browser that will not remember still toggles for this visit */
      }
      return next;
    });
  }, []);
  // Asking for the palette (find in palette, "Add external node") brings it out if it is away.
  const askPalette = useCallback(
    (query: string) => {
      setPane("left", true);
      setPaletteQuery(query);
      setPaletteFocus((n) => n + 1);
    },
    [setPane],
  );
  const [title, setTitle] = useState(props.title);
  const [unpublished, setUnpublished] = useState(props.unpublished);
  const [editingTitle, setEditingTitle] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
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

  const addComponent = useCallback(
    (componentId: string, at?: [number, number]) => {
      const e = eng.current!;
      const scene = sceneRef.current!;
      const { doc, id } = D.addNode(e.doc, componentId, bundle!.catalogue);
      const sizes = (layout(doc, bundle!.catalogue) as any).sizes;
      const size = sizes[id] || [140, 78];
      const center = at ?? scene.viewCenterWorld();
      scene.selection = { type: "node", ref: id };
      scene.multi = new Set([id]);
      commit(doc, {
        apply: () =>
          (e.positions[id] = [
            Math.round(center[0] - size[0] / 2),
            Math.round(center[1] - size[1] / 2),
          ]),
      });
    },
    [bundle, commit],
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
      return [
        { label: "Add note", hint: "annotation, not a node", run: () => addNote(at) },
        "-",
        {
          label: "Select all",
          hint: "Ctrl A",
          run: () => scene.selectNodes(e.doc.nodes.map((n: any) => n.id)),
        },
        { label: "Arrange", run: arrange },
        { label: "Fit to view", hint: "Ctrl 0", run: () => scene.fit() },
      ];
    },
    [
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
      undo: [],
      redo: [],
      dirty: false,
      lastDragAt: 0,
      baseHash: props.contentHash,
      saveSeq: 0,
      structural: [],
      rules: [],
    };
    const scene = new Scene(svgRef.current, {
      onSelect: (sel, m) => {
        setSelection({ ...sel });
        setMulti(new Set(m));
        if (!picking.current) setFinding(null);
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
      onConnect: (from, to) => commit(D.addEdge(eng.current!.doc, from, to)),
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
      onDrop: (componentId, x, y) => addComponent(componentId, [x, y]),
      onFrameWire: (x, y) => setHint({ x, y }),
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
        scene.cancel();
        scene.closeEditor();
        if (!typing(ev)) scene.select(null, null);
        return;
      }
      if (typing(ev)) return;
      const mod = ev.metaKey || ev.ctrlKey;
      const k = ev.key.toLowerCase();
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
      if (mod && ev.key === "0") {
        ev.preventDefault();
        scene.fit();
        return;
      }
      if (mod && ev.key === "1") {
        ev.preventDefault();
        scene.view.k = 1;
        scene.applyView();
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
  ]);

  // The dialog opens on the close button and hands focus back to the ? button when it goes, so
  // the keyboard never lands somewhere the reader cannot see.
  const hadHelp = useRef(false);
  useEffect(() => {
    if (help) helpClose.current?.focus();
    else if (hadHelp.current) helpBtn.current?.focus();
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
      if (helpDialog.current?.contains(t) || helpBtn.current?.contains(t)) return;
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
        scene.selection = { type: "node", ref: newId };
        scene.multi = new Set([...scene.multi].map((x) => (x === oldId ? newId : x)));
        const renamed = D.renameNode(e.doc, oldId, newId, bundle!.catalogue);
        commit(renamed, {
          apply: () => {
            movePosition(oldId, newId);
            retargetAnchors(e.notes, "node", oldId, newId);
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
        sceneRef.current!.selection = { type: "group", ref: newId };
        commit(D.renameGroup(e.doc, oldId, newId), {
          apply: () => {
            retargetAnchors(e.notes, "group", oldId, newId);
            retargetFrame(e.frames, oldId, newId);
          },
        });
      },
      setParent: (id, p) => commit(D.setGroupParent(eng.current!.doc, id, p)),
      // Tint and icon are layout, like a note: the sidecar changes, the YAML never does.
      setFrameStyle: (id, patch) => {
        const e = eng.current!;
        commit(null, {
          apply: () => {
            const next: FrameStyle = { ...(e.frames[id] ?? {}), ...patch };
            if (!next.tint) delete next.tint;
            if (!next.icon) delete next.icon;
            const frames = { ...e.frames };
            if (next.tint || next.icon) frames[id] = next;
            else delete frames[id];
            e.frames = frames;
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

  // Native fullscreen when the browser grants it; otherwise the canvas pins itself over the
  // page (same look, Escape leaves it), so the button works in embedded and restricted contexts.
  const pseudoFs = useRef(false);
  useEffect(() => {
    const onChange = () => {
      if (!pseudoFs.current) setFullscreen(Boolean(document.fullscreenElement));
    };
    const onKey = (ev: KeyboardEvent) => {
      // The help dialog is modal, so it takes Escape first and full screen keeps waiting.
      if (ev.key === "Escape" && !helpOpen.current && pseudoFs.current) {
        pseudoFs.current = false;
        setFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  const toggleFullscreen = useCallback(async () => {
    if (pseudoFs.current) {
      pseudoFs.current = false;
      setFullscreen(false);
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    try {
      const req = rootRef.current?.requestFullscreen?.();
      await Promise.race([req, new Promise((r) => setTimeout(r, 400))]);
      if (document.fullscreenElement) return;
    } catch {}
    pseudoFs.current = true;
    setFullscreen(true);
  }, []);

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
      if (f.subject?.type && f.subject.ref !== null && f.subject.ref !== undefined)
        centerOn(f.subject);
      // A design finding is about the design: clearing the selection is what shows its panel.
      else scene?.select(null, null);
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
        ?.querySelector(".pane-right .field.hl")
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [finding]);

  // ---------------------------------------------------------------- render
  const e = eng.current;
  const noteCount = e?.notes.length ?? 0;
  const structural = e?.structural ?? [];
  const rules = e?.rules ?? [];
  const blocking = structural.length > 0;
  const summary =
    [
      structural.length ? `${structural.length} blocking` : null,
      rules.filter((r) => r.severity === "error").length
        ? `${rules.filter((r) => r.severity === "error").length} errors`
        : null,
      rules.filter((r) => r.severity === "warning").length
        ? `${rules.filter((r) => r.severity === "warning").length} warnings`
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || "no findings";

  return (
    <div className={`zeema-canvas${fullscreen ? " is-fullscreen" : ""}`} ref={rootRef}>
      <div className="toolbar">
        <Link
          href={`/d/${props.owner}/${props.slug}`}
          className="btn btn-ghost no-underline"
          title="Back to the design page"
        >
          ←
        </Link>
        {editingTitle ? (
          <input
            className="input doc-title-input"
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
            className="doc-title doc-title-btn"
            title="Rename"
            onClick={() => setEditingTitle(true)}
          >
            {title}
          </button>
        ) : (
          <span className="doc-title" title={title}>
            {title}
          </span>
        )}
        <span
          className={`status ${status.includes("fail") || status.includes("conflict") ? "status-err" : status === "saved" || status === "published" ? "status-ok" : status === "unsaved" ? "status-warn" : ""}`}
        >
          {status}
        </span>
        <span className="sep" />
        <div className="group">
          {props.canWrite ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void save()}
                disabled={blocking}
                title={blocking ? "Fix structural errors first" : "Ctrl S"}
              >
                Save <kbd>{mod.short}S</kbd>
              </button>
              <label className="auto">
                <input
                  type="checkbox"
                  checked={autosave}
                  onChange={(ev) => setAutosave(ev.target.checked)}
                />
                auto
              </label>
              <button
                type="button"
                className={`btn${unpublished ? " btn-primary" : ""}`}
                onClick={() => void doPublish()}
                disabled={blocking || !unpublished}
                title={
                  unpublished
                    ? "Release the draft: readers see the previous release until you do"
                    : "Readers already see this version"
                }
              >
                {unpublished ? "Publish" : "Published"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={doClone}
                title="A private copy in your account"
              >
                Clone
              </button>
            </>
          ) : props.canClone ? (
            <button type="button" className="btn btn-primary" onClick={doClone}>
              Clone to edit
            </button>
          ) : (
            <a
              className="btn btn-primary no-underline"
              href={`/signin?next=/d/${props.owner}/${props.slug}/canvas`}
            >
              Sign in to clone
            </a>
          )}
        </div>
        <span className="sep" />
        <div className="group">
          <button
            type="button"
            className="btn"
            onClick={undo}
            disabled={!e?.undo.length}
            title="Ctrl Z"
          >
            Undo <kbd>{mod.short}Z</kbd>
          </button>
          <button
            type="button"
            className="btn"
            onClick={redo}
            disabled={!e?.redo.length}
            title="Ctrl Y"
          >
            Redo <kbd>{mod.short}Y</kbd>
          </button>
        </div>
        <span className="sep" />
        <div className="group">
          <button
            type="button"
            className="btn"
            onClick={() => sceneRef.current?.fit()}
            title="Ctrl 0"
          >
            Fit <kbd>{mod.short}0</kbd>
          </button>
          <button
            type="button"
            className="btn"
            onClick={arrange}
            title="Lay every component out again"
          >
            Arrange
          </button>
          <button
            type="button"
            className={`btn notes-toggle${showNotes ? " active" : ""}`}
            aria-pressed={showNotes}
            onClick={() => setNotesShown(!showNotes)}
            title={showNotes ? "Hide the notes (N)" : "Show the notes (N)"}
          >
            Notes{noteCount ? ` · ${noteCount}` : ""} <kbd>N</kbd>
          </button>
        </div>
        <span className="sep" />
        <div className="group">
          <button type="button" className="btn" onClick={() => doExport("svg")}>
            SVG
          </button>
          <button type="button" className="btn" onClick={() => doExport("png")}>
            PNG
          </button>
        </div>
        <span className="sep" />
        <div className="group">
          <button
            type="button"
            className={`btn pane-toggle${panes.left ? " active" : ""}`}
            aria-pressed={panes.left}
            onClick={() => setPane("left")}
            title={`${panes.left ? "Hide" : "Show"} the palette (${mod.long} Shift K)`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
              <path d="M9.5 4.5v15" />
            </svg>
            Palette
          </button>
          <button
            type="button"
            className={`btn pane-toggle${panes.right ? " active" : ""}`}
            aria-pressed={panes.right}
            onClick={() => setPane("right")}
            title={`${panes.right ? "Hide" : "Show"} the inspector (${mod.long} Shift P)`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
              <path d="M14.5 4.5v15" />
            </svg>
            Inspector
          </button>
        </div>
        <span className={`ml-auto status ${blocking ? "status-err" : ""}`}>{summary}</span>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void toggleFullscreen()}
          title={fullscreen ? "Exit full screen" : "Full screen"}
          aria-label={fullscreen ? "Exit full screen" : "Full screen"}
        >
          {fullscreen ? (
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          ref={helpBtn}
          aria-pressed={help}
          aria-label="Keys and gestures"
          onClick={() => setHelp((h) => !h)}
          title="Keys and gestures"
        >
          ?
        </button>
      </div>
      <div className={`body${panes.left ? "" : " no-left"}${panes.right ? "" : " no-right"}`}>
        {panes.left ? null : (
          <button
            type="button"
            className="pane-edge left"
            aria-label="Show the palette"
            title={`Show the palette (${mod.long} Shift K)`}
            onClick={() => setPane("left", true)}
          >
            <svg viewBox="0 0 8 12" aria-hidden="true">
              <path d="M2.5 2 6 6l-3.5 4" />
            </svg>
          </button>
        )}
        {panes.right ? null : (
          <button
            type="button"
            className="pane-edge right"
            aria-label="Show the inspector"
            title={`Show the inspector (${mod.long} Shift P)`}
            onClick={() => setPane("right", true)}
          >
            <svg viewBox="0 0 8 12" aria-hidden="true">
              <path d="M5.5 2 2 6l3.5 4" />
            </svg>
          </button>
        )}
        <aside
          className={`pane pane-left${panes.left ? "" : " is-away"}`}
          aria-hidden={!panes.left}
        >
          {bundle ? (
            <Palette
              rows={bundle.search}
              icons={bundle.icons}
              providerNames={providerNames}
              categoryNames={categoryNames}
              query={paletteQuery}
              onQuery={setPaletteQuery}
              focusSeq={paletteFocus}
              onCreate={(id) => addComponent(id)}
            />
          ) : (
            <div className="muted p-3 small">Loading the catalogue…</div>
          )}
        </aside>
        <div className="scene-wrap">
          <svg ref={svgRef} className="scene" role="img" aria-label="Design canvas">
            <title>Design canvas</title>
            <defs />
            <g className="viewport">
              <g className="layer-frames" />
              <g className="layer-notes" />
              <g className="layer-edges" />
              <g className="layer-nodes" />
              <g className="layer-overlay" />
            </g>
          </svg>
          {error ? <div className="empty-state sev-error">{error}</div> : null}
          {!error && e && e.doc.nodes.length === 0 ? (
            <div className="empty-state">
              Drag a component from the palette, or double-click one to place it.
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
                Groups don't connect. Wire the components inside it — or add an External system node
                for something outside your control.
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
        </div>
        <aside
          className={`pane pane-right${panes.right ? "" : " is-away"}`}
          aria-hidden={!panes.right}
        >
          {bundle && e ? (
            <div key={`${selection.type}:${String(selection.ref)}:${tick}`}>
              <Inspector
                selection={selection}
                multi={multi}
                doc={e.doc}
                notes={e.notes}
                frameStyles={e.frames}
                catalogue={bundle.catalogue}
                icons={bundle.icons}
                searchRows={bundle.search}
                api={api}
                highlight={finding?.highlight ?? null}
              />
              <h2 className="mt-4">Findings</h2>
              <FindingsPanel
                structural={structural}
                rules={rules}
                catalogue={bundle.catalogue}
                onPick={pickFinding}
                active={finding?.key ?? null}
              />
            </div>
          ) : null}
        </aside>
      </div>
      {menu ? (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      ) : null}
    </div>
  );
}
