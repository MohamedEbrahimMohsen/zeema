// Import a layout file (design.layout.json, as "Download layout (JSON)" writes it) back onto a
// design. The stored sidecar is read leniently (`readSidecar` drops what is malformed so a design
// always opens); a file someone hands in is checked first, so a broken one is refused with a
// reason instead of half-applying. What passes is read through `readSidecar`, cut down to the
// design with `pruneSidecar`, and merged over the layout the canvas holds.
//
// Merge, not replace: an entry in the file wins, and anything the file does not mention keeps its
// current value. A file holding only `nodes` moves those boxes and leaves every other box, edge
// path, port, label, tint and note alone. Notes merge by id. `replace` swaps the whole layout for
// the file's instead (what the file lacks falls back to the automatic layout).

import { edgeKeys, readVia } from "@zeema/core/geometry";
import {
  type EdgePath,
  type EdgePorts,
  type FrameStyle,
  type LabelOffset,
  type NodeTint,
  type Note,
  pruneSidecar,
  type Routing,
  readSidecar,
  SIDECAR_VERSION,
} from "./layout-sidecar";

/** The layout half of the canvas engine: exactly what `commit` snapshots besides the doc. */
export type LayoutState = {
  positions: Record<string, [number, number]>;
  bows: Record<string, EdgePath>;
  ports: Record<string, EdgePorts>;
  labels: Record<string, LabelOffset>;
  notes: Note[];
  frames: Record<string, FrameStyle>;
  tints: Record<string, NodeTint>;
  badge?: string;
  routing?: Routing;
};

export type ImportMode = "merge" | "replace";

export type LayoutImport = {
  next: LayoutState;
  /** Node positions taken from the file. */
  positions: number;
  /** Edge paths (bows and waypoints) taken from the file. */
  paths: number;
  /** Distinct nodes, edges and groups the file names that this design does not have. */
  dropped: number;
};

/** A file that cannot be imported, with the reason in words for the person importing it. */
export class LayoutImportError extends Error {}

const isObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const MAX_PROBLEMS = 3;

/** Every number anywhere in the file that is not finite (JSON reads 1e999 as Infinity). */
function nonFinite(v: unknown, path: string, out: string[]) {
  if (out.length >= MAX_PROBLEMS) return;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) out.push(`${path} is not a finite number`);
  } else if (Array.isArray(v)) {
    for (const [i, x] of v.entries()) nonFinite(x, `${path}[${i}]`, out);
  } else if (isObject(v)) for (const [k, x] of Object.entries(v)) nonFinite(x, `${path}.${k}`, out);
}

/**
 * The reasons a parsed layout file cannot be imported; empty when it can. Checked: the version
 * (absent is read as the current one), the shape of each section, node positions as two finite
 * numbers, edge paths as a finite bow or a well-formed `{ via }`, and no non-finite number anywhere.
 */
export function layoutFileProblems(raw: unknown): string[] {
  if (!isObject(raw)) return ["the file must hold a JSON object, as design.layout.json does"];
  const out: string[] = [];
  if ("version" in raw) {
    const v = raw.version;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > SIDECAR_VERSION)
      out.push(`version ${JSON.stringify(v)} is not one this site reads (1 to ${SIDECAR_VERSION})`);
  }
  for (const key of ["nodes", "edges", "ports", "labels", "frames", "tints"])
    if (key in raw && !isObject(raw[key])) out.push(`"${key}" must be an object`);
  if ("notes" in raw && !Array.isArray(raw.notes)) out.push(`"notes" must be a list`);
  if (isObject(raw.nodes))
    for (const [id, p] of Object.entries(raw.nodes)) {
      if (out.length >= MAX_PROBLEMS) break;
      const ok =
        Array.isArray(p) &&
        p.length === 2 &&
        typeof p[0] === "number" &&
        typeof p[1] === "number" &&
        Number.isFinite(p[0]) &&
        Number.isFinite(p[1]);
      if (!ok) out.push(`nodes.${id} must be [x, y], two finite numbers`);
    }
  if (isObject(raw.edges))
    for (const [key, v] of Object.entries(raw.edges)) {
      if (out.length >= MAX_PROBLEMS) break;
      if (typeof v === "number") {
        if (!Number.isFinite(v)) out.push(`edges.${key} is not a finite number`);
      } else if (!readVia(v))
        out.push(`edges.${key} must be a bow (a number) or { via: [[x, y], …] }`);
    }
  if (out.length < MAX_PROBLEMS) nonFinite(raw, "layout", out);
  return [...new Set(out)].slice(0, MAX_PROBLEMS);
}

/** The text of a layout file as JSON, or a LayoutImportError saying why it is not. */
export function readLayoutText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new LayoutImportError(`The file is not valid JSON: ${(err as Error).message}`);
  }
}

/**
 * The layout after importing `raw` (a parsed layout file) into a design whose document is `doc`.
 * Throws LayoutImportError when the file is refused (see `layoutFileProblems`). Copies: neither
 * `current` nor `raw` is changed.
 */
export function mergeImportedLayout(
  current: LayoutState,
  raw: unknown,
  doc: { nodes?: Array<{ id: string }>; groups?: Array<{ id: string }>; edges?: unknown[] },
  mode: ImportMode = "merge",
): LayoutImport {
  const problems = layoutFileProblems(raw);
  if (problems.length)
    throw new LayoutImportError(`This layout cannot be imported: ${problems.join("; ")}.`);
  const file = raw as Record<string, unknown>;
  const read = readSidecar(file);
  const nodes = (doc.nodes ?? []).map((n) => n.id);
  const groups = (doc.groups ?? []).map((g) => g.id);
  const edges = edgeKeys(doc) as string[];
  const pruned = pruneSidecar(read, { nodes, groups, edges });

  const dropped = new Set<string>();
  const gone = (o: Record<string, unknown> | undefined, prefix: string, kept: Set<string>) => {
    for (const k of Object.keys(o ?? {})) if (!kept.has(k)) dropped.add(`${prefix}:${k}`);
  };
  const nodeSet = new Set(nodes);
  const edgeSet = new Set(edges);
  gone(read.nodes, "node", nodeSet);
  gone(read.tints, "node", nodeSet);
  gone(read.edges, "edge", edgeSet);
  gone(read.ports, "edge", edgeSet);
  gone(read.labels, "edge", edgeSet);
  gone(read.frames, "group", new Set(groups));

  const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  const imported: LayoutState = {
    positions: pruned.nodes,
    bows: pruned.edges,
    ports: pruned.ports ?? {},
    labels: pruned.labels ?? {},
    notes: pruned.notes,
    frames: pruned.frames,
    tints: pruned.tints ?? {},
  };
  if (pruned.badge) imported.badge = pruned.badge;
  if (pruned.routing) imported.routing = pruned.routing;

  let next: LayoutState;
  if (mode === "replace") next = copy(imported);
  else {
    const base = copy(current);
    const byId = new Map(base.notes.map((n) => [n.id, n]));
    for (const n of imported.notes) byId.set(n.id, n);
    next = {
      positions: { ...base.positions, ...imported.positions },
      bows: { ...base.bows, ...imported.bows },
      ports: { ...base.ports, ...imported.ports },
      labels: { ...base.labels, ...imported.labels },
      notes: [...byId.values()],
      frames: { ...base.frames, ...imported.frames },
      tints: { ...base.tints, ...imported.tints },
    };
    // The badge and the routing are taken only when the file says; otherwise they stay.
    const badge = "badge" in file ? imported.badge : base.badge;
    const routing = "routing" in file ? imported.routing : base.routing;
    if (badge) next.badge = badge;
    if (routing) next.routing = routing;
  }
  return {
    next: copy(next),
    positions: Object.keys(imported.positions).length,
    paths: Object.keys(imported.bows).length,
    dropped: dropped.size,
  };
}

/** The notice the canvas shows once an import has been applied. */
export function importNotice(r: LayoutImport, mode: ImportMode = "merge") {
  const n = (k: number, one: string) => `${k} ${one}${k === 1 ? "" : "s"}`;
  const kept = mode === "merge" ? "; the rest kept" : "";
  return `Layout imported: ${n(r.positions, "position")}, ${n(r.paths, "edge path")}, ${r.dropped} dropped (not in this design)${kept}`;
}

/** Where the design page leaves a checked layout file for the canvas to apply on open. */
export const pendingLayoutKey = (owner: string, slug: string) =>
  `zeema:import-layout:${owner}/${slug}`;
