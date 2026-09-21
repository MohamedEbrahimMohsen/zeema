// The sidecar is the one thing the canvas reads that nobody validates on the way in: it is
// jsonb, stored opaquely, and a design must open whatever it says. So the reader's tolerance
// and its ceilings are the contract, and the anchor helpers are pure enough to pin down here.
import { describe, expect, it } from "vitest";
import {
  NOTE_DEFAULT_H,
  NOTE_DEFAULT_W,
  NOTE_MAX_H,
  NOTE_MAX_NOTES,
  NOTE_MAX_TEXT,
  NOTE_MAX_W,
  NOTE_MIN_H,
  NOTE_MIN_W,
  type Note,
  nextNoteId,
  pruneAnchored,
  readSidecar,
  retargetAnchors,
  SIDECAR_VERSION,
} from "./layout-sidecar";

const note = (over: Partial<Note> = {}): Note => ({
  id: "note-1",
  x: 0,
  y: 0,
  w: NOTE_DEFAULT_W,
  h: NOTE_DEFAULT_H,
  text: "",
  ...over,
});

describe("readSidecar tolerance", () => {
  it("returns an empty sidecar for anything that is not an object", () => {
    for (const bad of [null, undefined, 3, "x", [], true]) {
      const s = readSidecar(bad);
      expect(s).toEqual({ version: SIDECAR_VERSION, nodes: {}, edges: {}, notes: [] });
    }
  });

  it("keeps the good entries and drops the malformed ones", () => {
    const s = readSidecar({
      version: 2,
      nodes: { a: [1, 2], b: ["x", 2], c: [3], d: [4, 5, 6] },
      edges: { "a>b": 12, "b>c": "nope", "c>d": Number.NaN },
      notes: [null, 7, { x: 1 }, { id: "", text: "" }, { id: "n1", text: "hi" }],
    });
    expect(s.nodes).toEqual({ a: [1, 2], d: [4, 5] });
    expect(s.edges).toEqual({ "a>b": 12 });
    expect(s.notes.map((n) => n.id)).toEqual(["n1"]);
  });

  it("drops an anchor whose target is gone and keeps one that is still there", () => {
    const s = readSidecar(
      {
        notes: [
          { id: "n1", anchor: { node: "svc" } },
          { id: "n2", anchor: { node: "ghost" } },
          { id: "n3", anchor: { group: "vpc" } },
          { id: "n4", anchor: { group: "gone" } },
        ],
      },
      { nodes: ["svc"], groups: ["vpc"] },
    );
    expect(s.notes.map((n) => [n.id, n.anchor])).toEqual([
      ["n1", { node: "svc" }],
      ["n2", undefined],
      ["n3", { group: "vpc" }],
      ["n4", undefined],
    ]);
  });

  it("without targets it trusts every anchor, because nothing has been said about the design", () => {
    const s = readSidecar({ notes: [{ id: "n1", anchor: { node: "whatever" } }] });
    expect(s.notes[0].anchor).toEqual({ node: "whatever" });
  });
});

describe("readSidecar ceilings", () => {
  it("clamps a note box into the range the canvas can draw", () => {
    const s = readSidecar({
      notes: [
        { id: "tiny", w: 1, h: 1 },
        { id: "huge", w: 10 ** 9, h: 10 ** 9 },
        { id: "nonsense", w: Number.NaN, h: Number.POSITIVE_INFINITY },
      ],
    });
    expect([s.notes[0].w, s.notes[0].h]).toEqual([NOTE_MIN_W, NOTE_MIN_H]);
    expect([s.notes[1].w, s.notes[1].h]).toEqual([NOTE_MAX_W, NOTE_MAX_H]);
    expect([s.notes[2].w, s.notes[2].h]).toEqual([NOTE_DEFAULT_W, NOTE_DEFAULT_H]);
  });

  it("truncates a runaway note text", () => {
    const s = readSidecar({ notes: [{ id: "n1", text: "x".repeat(NOTE_MAX_TEXT + 500) }] });
    expect(s.notes[0].text).toHaveLength(NOTE_MAX_TEXT);
  });

  it("keeps at most NOTE_MAX_NOTES notes", () => {
    const raw = Array.from({ length: NOTE_MAX_NOTES + 40 }, (_, i) => ({ id: `n${i}` }));
    const s = readSidecar({ notes: raw });
    expect(s.notes).toHaveLength(NOTE_MAX_NOTES);
    expect(s.notes[s.notes.length - 1].id).toBe(`n${NOTE_MAX_NOTES - 1}`);
  });
});

describe("pruneAnchored", () => {
  it("keeps free-floating notes whatever the design holds", () => {
    const notes = [note({ id: "free" })];
    expect(pruneAnchored(notes, { nodes: [], groups: [] })).toEqual(notes);
  });

  it("drops a note whose node or boundary has gone, and keeps the rest", () => {
    const notes = [
      note({ id: "on-svc", anchor: { node: "svc" } }),
      note({ id: "on-ghost", anchor: { node: "ghost" } }),
      note({ id: "on-vpc", anchor: { group: "vpc" } }),
      note({ id: "on-gone", anchor: { group: "gone" } }),
      note({ id: "free" }),
    ];
    const kept = pruneAnchored(notes, { nodes: ["svc"], groups: ["vpc"] });
    expect(kept.map((n) => n.id)).toEqual(["on-svc", "on-vpc", "free"]);
  });

  it("does not touch the array it was given", () => {
    const notes = [note({ id: "on-ghost", anchor: { node: "ghost" } })];
    pruneAnchored(notes, { nodes: [], groups: [] });
    expect(notes).toHaveLength(1);
  });
});

describe("retargetAnchors", () => {
  it("follows a node rename and leaves boundary anchors alone", () => {
    const notes = [
      note({ id: "a", anchor: { node: "old" } }),
      note({ id: "b", anchor: { group: "old" } }),
      note({ id: "c", anchor: { node: "other" } }),
      note({ id: "d" }),
    ];
    retargetAnchors(notes, "node", "old", "new");
    expect(notes.map((n) => n.anchor)).toEqual([
      { node: "new" },
      { group: "old" },
      { node: "other" },
      undefined,
    ]);
  });

  it("follows a boundary rename and leaves node anchors alone", () => {
    const notes = [
      note({ id: "a", anchor: { group: "old" } }),
      note({ id: "b", anchor: { node: "old" } }),
    ];
    retargetAnchors(notes, "group", "old", "new");
    expect(notes.map((n) => n.anchor)).toEqual([{ group: "new" }, { node: "old" }]);
  });
});

describe("nextNoteId", () => {
  it("fills the first free slot rather than counting up from the end", () => {
    expect(nextNoteId([])).toBe("note-1");
    expect(nextNoteId(["note-1", "note-3"])).toBe("note-2");
    expect(nextNoteId(["note-1", "note-2"])).toBe("note-3");
  });
});
