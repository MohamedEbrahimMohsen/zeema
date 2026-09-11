"use client";

// The canvas shell. React renders the frame once and re-renders the side panels only at commit
// boundaries; positions live in refs and go straight to the SVG during a drag. Every change goes
// through `commit`, which snapshots first, so undo and redo are uniform.
import * as D from "@arkore/core/document";
import { edgeKeys } from "@arkore/core/geometry";
import { layout } from "@arkore/core/layout";
import { runRules } from "@arkore/core/rules";
import { check } from "@arkore/core/structure";
import { parse, serialize } from "@arkore/core/yaml";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { exportScene } from "./exportScene";
import { type CanvasFinding, FindingsPanel } from "./FindingsPanel";
import { Inspector, type InspectorApi } from "./Inspector";
import { Palette } from "./Palette";
import { Scene, type Subject } from "./scene";
import "./canvas.css";

type Props = {
  owner: string;
  slug: string;
  title: string;
  yaml: string;
  layoutSidecar: {
    version: number;
    nodes?: Record<string, [number, number]>;
    edges?: Record<string, number>;
  } | null;
  contentHash: string;
  canWrite: boolean;
  canClone: boolean;
  signedIn: boolean;
};

type Bundle = { catalogue: any; search: any[]; icons: Record<string, string> };

type Engine = {
  doc: any;
  cst: any;
  positions: Record<string, [number, number]>;
  sizes: Record<string, [number, number]>;
  bows: Record<string, number>;
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
  const [selection, setSelection] = useState<Subject>({ type: null, ref: null });
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

  const sidecar = useCallback(() => {
    const e = eng.current!;
    return { version: 2, nodes: e.positions, edges: e.bows };
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
      const snapshot = { doc: clone(e.doc), positions: clone(e.positions), bows: clone(e.bows) };
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
    e.redo.push({ doc: clone(e.doc), positions: clone(e.positions), bows: clone(e.bows) });
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
    e.undo.push({ doc: clone(e.doc), positions: clone(e.positions), bows: clone(e.bows) });
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
      commit(doc, { apply: () => now !== id && movePosition(id, now) });
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

  const menuFor = useCallback(
    (target: Subject): MenuItem[] => {
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
          grouped ? { label: "Remove from boundary", run: releaseFromGroup } : null,
          {
            label: count > 1 ? `Duplicate these ${count}` : "Duplicate",
            hint: "Ctrl D",
            run: duplicateSelection,
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
          { label: "Reverse direction", run: () => commit(D.reverseEdge(e.doc, i)) },
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
          "-",
          {
            label: "Remove boundary, keep members",
            hint: "Del",
            run: () => {
              scene.select(null, null);
              commit(D.deleteGroup(e.doc, id));
            },
          },
          {
            label: `Delete boundary and ${members} member${members === 1 ? "" : "s"}`,
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
        {
          label: "Select all",
          hint: "Ctrl A",
          run: () => scene.selectNodes(e.doc.nodes.map((n: any) => n.id)),
        },
        { label: "Arrange", run: arrange },
        { label: "Fit to view", hint: "Ctrl 0", run: () => scene.fit() },
      ];
    },
    [arrange, commit, deleteSelection, duplicateSelection, groupSelection, releaseFromGroup],
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
    eng.current = {
      doc,
      cst,
      positions: clone(props.layoutSidecar?.nodes ?? {}),
      sizes: {},
      bows: clone(props.layoutSidecar?.edges ?? {}),
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
      labelOf: (kind, ref) => {
        const e = eng.current!;
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
        if (kind === "node") return renameToLabel(ref as string, value);
        if (kind === "edge")
          commit(D.setEdgeField(e.doc, ref as number, "label", value || undefined));
        if (kind === "group")
          commit(D.setGroupField(e.doc, ref as string, "label", value || undefined));
      },
      onContext: (target, x, y) => setMenu({ x, y, items: menuFor(target) }),
      onDrop: (componentId, x, y) => addComponent(componentId, [x, y]),
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
      const scene = sceneRef.current;
      if (!scene || !eng.current) return;
      if (ev.key === "Escape") {
        setMenu(null);
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
  }, [save, undo, redo, duplicateSelection, groupSelection, deleteSelection, nudge, commit]);

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
        commit(D.renameNode(e.doc, oldId, newId, bundle!.catalogue), {
          apply: () => movePosition(oldId, newId),
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
        if (!newId || !/^[a-z][a-z0-9-]*$/.test(newId))
          return notify("a boundary id is kebab-case");
        if ((e.doc.groups ?? []).some((g: any) => g.id === newId))
          return notify(`${newId} is the id of another boundary`);
        sceneRef.current!.selection = { type: "group", ref: newId };
        commit(D.renameGroup(e.doc, oldId, newId));
      },
      setParent: (id, p) => commit(D.setGroupParent(eng.current!.doc, id, p)),
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
      remove: (type, ref) => {
        const scene = sceneRef.current!;
        scene.selection = { type: null, ref: null };
        scene.multi = new Set();
        const e = eng.current!;
        if (type === "node") commit(D.deleteNodes(e.doc, [ref as string], bundle!.catalogue));
        if (type === "edge") commit(D.deleteEdge(e.doc, ref as number));
        if (type === "group") commit(D.deleteGroup(e.doc, ref as string));
      },
    }),
    [bundle, commit, notify, render, renameToLabel],
  );

  // ---------------------------------------------------------------- toolbar actions
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
      fetch(`/api/v1/designs/${props.owner}/${props.slug}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "export", format }),
      }).catch(() => {});
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
          : null;
    if (box) scene.center(box);
  };

  // ---------------------------------------------------------------- render
  const e = eng.current;
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
    <div className="arkore-canvas">
      <div className="toolbar">
        <Link
          href={`/d/${props.owner}/${props.slug}`}
          className="btn no-underline"
          title="Back to the design page"
        >
          ← {props.title}
        </Link>
        {props.canWrite ? (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void save()}
              disabled={blocking}
              title={blocking ? "Fix structural errors first" : "Ctrl S"}
            >
              Save
            </button>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={autosave}
                onChange={(ev) => setAutosave(ev.target.checked)}
              />{" "}
              auto
            </label>
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
        <span
          className={`status text-xs ${status.includes("fail") || status.includes("conflict") ? "sev-error" : "muted"}`}
        >
          {status}
        </span>
        <span className="mx-1 muted">|</span>
        <button
          type="button"
          className="btn"
          onClick={undo}
          disabled={!e?.undo.length}
          title="Ctrl Z"
        >
          Undo
        </button>
        <button
          type="button"
          className="btn"
          onClick={redo}
          disabled={!e?.redo.length}
          title="Ctrl Y"
        >
          Redo
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => sceneRef.current?.fit()}
          title="Ctrl 0"
        >
          Fit
        </button>
        <button
          type="button"
          className="btn"
          onClick={arrange}
          title="Lay every component out again"
        >
          Arrange
        </button>
        <button type="button" className="btn" onClick={() => doExport("svg")}>
          SVG
        </button>
        <button type="button" className="btn" onClick={() => doExport("png")}>
          PNG
        </button>
        {props.canWrite ? (
          <button
            type="button"
            className="btn"
            onClick={doClone}
            title="A private copy in your account"
          >
            Clone
          </button>
        ) : null}
        <span className={`ml-auto text-xs ${blocking ? "sev-error" : "muted"}`}>{summary}</span>
        <button
          type="button"
          className="btn"
          onClick={() => setHelp((h) => !h)}
          title="Keys and gestures"
        >
          ?
        </button>
      </div>
      <div className="body">
        <aside className="pane pane-left">
          {bundle ? (
            <Palette
              rows={bundle.search}
              icons={bundle.icons}
              onCreate={(id) => addComponent(id)}
            />
          ) : (
            <div className="muted p-3 text-xs">Loading the catalogue…</div>
          )}
        </aside>
        <div className="scene-wrap">
          <svg ref={svgRef} className="scene" role="img" aria-label="Design canvas">
            <title>Design canvas</title>
            <defs />
            <g className="viewport">
              <g className="layer-frames" />
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
            <div className="panel absolute right-3 top-3 z-10 p-3 text-xs" style={{ width: 300 }}>
              <div className="mb-1 font-medium">Keys and gestures</div>
              <ul className="space-y-1">
                <li>Drag a component from the palette, or double-click it.</li>
                <li>Drag a node's dot to another node to wire an edge.</li>
                <li>Drag an edge to bow it; right-click to reverse or switch sync/async.</li>
                <li>Drag on empty space to select several; Shift-click adds.</li>
                <li>Middle button or Space+drag pans; wheel zooms.</li>
                <li>Double-click a label to rename; Enter edits the selection.</li>
                <li>G groups the selection; Ctrl Shift G ungroups.</li>
                <li>Ctrl D duplicates; Delete removes; arrows nudge (Shift ×10).</li>
                <li>Ctrl Z / Ctrl Y undo and redo; Ctrl S saves; Ctrl 0 fits.</li>
              </ul>
            </div>
          ) : null}
        </div>
        <aside className="pane pane-right">
          {bundle && e ? (
            <div key={`${selection.type}:${String(selection.ref)}:${tick}`}>
              <Inspector
                selection={selection}
                multi={multi}
                doc={e.doc}
                catalogue={bundle.catalogue}
                api={api}
              />
              <h2 className="mt-4">Findings</h2>
              <FindingsPanel
                structural={structural}
                rules={rules}
                catalogue={bundle.catalogue}
                onSelect={centerOn}
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
