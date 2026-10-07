// Importing a layout file: refused with a reason when it is broken, cut down to the design, and
// merged over the current layout so whatever the file leaves out stays as it was.
import { describe, expect, it } from "vitest";
import {
  importNotice,
  LayoutImportError,
  type LayoutState,
  layoutFileProblems,
  mergeImportedLayout,
  readLayoutText,
} from "./layout-import";
import { NOTE_DEFAULT_H, NOTE_DEFAULT_W, SIDECAR_VERSION, sidecarFile } from "./layout-sidecar";

const doc = {
  nodes: [{ id: "api" }, { id: "db" }, { id: "queue" }],
  groups: [{ id: "core" }],
  edges: [
    { from: "api", to: "db" },
    { from: "api", to: "queue" },
  ],
};

const current = (): LayoutState => ({
  positions: { api: [0, 0], db: [100, 0], queue: [200, 0] },
  bows: { "api>queue": 12 },
  ports: { "api>db": { from: { side: "right", t: 0.5 } } },
  labels: { "api>queue": [5, 5] },
  notes: [{ id: "note-1", x: 1, y: 1, w: NOTE_DEFAULT_W, h: NOTE_DEFAULT_H, text: "keep" }],
  frames: { core: { tint: "blue" } },
  tints: { db: { tint: "green" } },
  routing: "curved",
});

describe("mergeImportedLayout", () => {
  it("merges: the file's entries win, everything it leaves out keeps its value", () => {
    const before = current();
    const r = mergeImportedLayout(
      before,
      { version: SIDECAR_VERSION, nodes: { api: [40, 50] } },
      doc,
    );
    expect(r.next.positions).toEqual({ api: [40, 50], db: [100, 0], queue: [200, 0] });
    expect(r.next.bows).toEqual(before.bows);
    expect(r.next.ports).toEqual(before.ports);
    expect(r.next.labels).toEqual(before.labels);
    expect(r.next.notes).toEqual(before.notes);
    expect(r.next.frames).toEqual(before.frames);
    expect(r.next.tints).toEqual(before.tints);
    expect(r.next.routing).toBe("curved");
    expect(r.positions).toBe(1);
    expect(r.paths).toBe(0);
    expect(r.dropped).toBe(0);
    // It copies: the current layout is untouched.
    expect(before.positions.api).toEqual([0, 0]);
  });

  it("drops what the design does not hold and counts each missing id once", () => {
    const r = mergeImportedLayout(
      current(),
      {
        version: 2,
        nodes: { api: [1, 2], ghost: [3, 4] },
        tints: { ghost: { tint: "rose" } },
        edges: { "api>db": 7, "ghost>db": 3 },
        labels: { "ghost>db": [4, 4] },
        frames: { gone: { tint: "amber" } },
      },
      doc,
    );
    expect(r.next.positions.ghost).toBeUndefined();
    expect(r.next.bows["ghost>db"]).toBeUndefined();
    expect(r.next.frames.gone).toBeUndefined();
    expect(r.positions).toBe(1);
    expect(r.paths).toBe(1);
    // ghost (node), ghost>db (edge), gone (group)
    expect(r.dropped).toBe(3);
  });

  it("keeps via waypoints and label offsets from the file", () => {
    const r = mergeImportedLayout(
      current(),
      {
        version: 2,
        edges: {
          "api>db": {
            via: [
              [10, 20],
              [10, 80],
            ],
          },
        },
        labels: { "api>db": [12, -8] },
      },
      doc,
    );
    expect(r.next.bows["api>db"]).toEqual({
      via: [
        [10, 20],
        [10, 80],
      ],
    });
    expect(r.next.bows["api>queue"]).toBe(12);
    expect(r.next.labels).toEqual({ "api>queue": [5, 5], "api>db": [12, -8] });
    expect(r.paths).toBe(1);
  });

  it("round-trips a downloaded file over a moved layout", () => {
    const saved = current();
    const file = JSON.parse(
      sidecarFile({
        version: 2,
        nodes: saved.positions,
        edges: saved.bows,
        ports: saved.ports,
        labels: saved.labels,
        notes: saved.notes,
        frames: saved.frames,
        tints: saved.tints,
        routing: saved.routing,
      }),
    );
    const moved = current();
    moved.positions = { api: [999, 999], db: [5, 5], queue: [6, 6] };
    const r = mergeImportedLayout(moved, file, doc);
    expect(r.next).toEqual(saved);
    expect(r.positions).toBe(3);
  });

  it("merges notes by id", () => {
    const r = mergeImportedLayout(
      current(),
      { notes: [{ id: "note-2", x: 0, y: 0, w: 100, h: 60, text: "new" }] },
      doc,
    );
    expect(r.next.notes.map((n) => n.id)).toEqual(["note-1", "note-2"]);
  });

  it("replace swaps the whole layout for the file's", () => {
    const r = mergeImportedLayout(current(), { nodes: { db: [1, 1] } }, doc, "replace");
    expect(r.next.positions).toEqual({ db: [1, 1] });
    expect(r.next.bows).toEqual({});
    expect(r.next.notes).toEqual([]);
    expect(r.next.routing).toBeUndefined();
  });

  it("refuses a version it does not read", () => {
    for (const version of [SIDECAR_VERSION + 1, 0, "2", 1.5])
      expect(() => mergeImportedLayout(current(), { version, nodes: {} }, doc)).toThrow(
        LayoutImportError,
      );
    expect(() => mergeImportedLayout(current(), { version: 99 }, doc)).toThrow(/version 99/);
  });

  it("refuses non-finite numbers and malformed waypoints", () => {
    const bad = [
      { nodes: { api: [Number.POSITIVE_INFINITY, 0] } },
      { nodes: { api: [1] } },
      { nodes: { api: "here" } },
      { edges: { "api>db": { via: [[1, "x"]] } } },
      { edges: { "api>db": { via: [] } } },
      { edges: { "api>db": "bend" } },
      { labels: { "api>db": [Number.NaN, 0] } },
      { nodes: [] },
      { notes: {} },
      [],
      null,
    ];
    for (const raw of bad) {
      expect(layoutFileProblems(raw).length, JSON.stringify(raw)).toBeGreaterThan(0);
      expect(() => mergeImportedLayout(current(), raw, doc)).toThrow(LayoutImportError);
    }
    // JSON itself reads an out-of-range literal as Infinity.
    expect(() =>
      mergeImportedLayout(current(), readLayoutText('{"nodes":{"api":[1e999,0]}}'), doc),
    ).toThrow(/finite/);
  });

  it("refuses text that is not JSON", () => {
    expect(() => readLayoutText("{nodes:")).toThrow(LayoutImportError);
  });
});

describe("importNotice", () => {
  it("says what was taken and what was dropped", () => {
    expect(importNotice({ next: current(), positions: 3, paths: 1, dropped: 2 })).toBe(
      "Layout imported: 3 positions, 1 edge path, 2 dropped (not in this design); the rest kept",
    );
    expect(importNotice({ next: current(), positions: 1, paths: 0, dropped: 0 }, "replace")).toBe(
      "Layout imported: 1 position, 0 edge paths, 0 dropped (not in this design)",
    );
  });
});
