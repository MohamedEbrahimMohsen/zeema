// The sidecar is the one thing the canvas reads that nobody validates on the way in: it is
// jsonb, stored opaquely, and a design must open whatever it says. So the reader's tolerance
// and its ceilings are the contract, and the anchor helpers are pure enough to pin down here.
import { describe, expect, it } from "vitest";
import {
  BADGE_RE,
  FRAME_MAX_STYLES,
  frameIconKey,
  isAnyTint,
  isBadgeRef,
  isBlankSidecar,
  isFrameIcon,
  isHexTint,
  isTint,
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
  normaliseTint,
  pruneAnchored,
  pruneFrames,
  prunePorts,
  pruneSidecar,
  pruneTints,
  readEdgePath,
  readLabels,
  readPorts,
  readRoutingField,
  readSidecar,
  readTints,
  retargetAnchors,
  retargetFrame,
  retargetTint,
  SIDECAR_VERSION,
  sidecarFile,
  TINTS,
  writeSidecar,
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
      expect(s).toEqual({
        version: SIDECAR_VERSION,
        nodes: {},
        edges: {},
        notes: [],
        frames: {},
      });
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

describe("boundary styles", () => {
  it("keeps a named tint and a well-formed icon reference", () => {
    const s = readSidecar({
      frames: {
        vpc: { tint: "blue", icon: "kind:network" },
        cell: { icon: "component:aws/aws-lambda" },
        zone: { tint: "teal" },
        dc: { icon: "boundary:on-premises" },
      },
    });
    expect(s.frames).toEqual({
      vpc: { tint: "blue", icon: "kind:network" },
      cell: { icon: "component:aws/aws-lambda" },
      zone: { tint: "teal" },
      dc: { icon: "boundary:on-premises" },
    });
  });

  it("keeps a #rrggbb tint, lowercased, beside the named ones", () => {
    const s = readSidecar({
      frames: {
        vpc: { tint: "#FF6600", icon: "kind:network" },
        zone: { tint: "#0d9488" },
        cell: { tint: "violet" },
      },
    });
    expect(s.frames).toEqual({
      vpc: { tint: "#ff6600", icon: "kind:network" },
      zone: { tint: "#0d9488" },
      cell: { tint: "violet" },
    });
  });

  it("drops what is not a tint or not an icon reference, and an entry left empty", () => {
    const s = readSidecar({
      frames: {
        a: { tint: 3, icon: "kind:queue" },
        b: { tint: "#F60" },
        c: { tint: "Blue" },
        p: { tint: "#ff660080" },
        q: { tint: "red" },
        r: { tint: "javascript:alert(1)" },
        s: { tint: "rgb(255, 102, 0)" },
        t: { tint: "#ff660" },
        u: { tint: " #ff6600" },
        v: { tint: "#gg6600" },
        d: { icon: "component:../../x" },
        e: { icon: "component:aws" },
        f: { icon: `kind:${"x".repeat(200)}` },
        g: { icon: "https://evil.example/x.svg" },
        h: { icon: '<svg onload="x">' },
        k: { icon: "boundary:AWS" },
        l: { icon: "boundary:aws/x" },
        m: { icon: "boundary:-aws" },
        n: { icon: "boundary:on--premises" },
        o: { icon: "boundary:" },
        i: "blue",
        j: null,
        "Not-Kebab": { tint: "blue" },
      },
    });
    expect(s.frames).toEqual({ a: { icon: "kind:queue" } });
  });

  it("never lets a stored key reach the prototype", () => {
    const s = readSidecar(
      JSON.parse('{"frames":{"__proto__":{"tint":"blue"},"constructor":{"tint":"rose"}}}'),
    );
    expect(Object.getPrototypeOf(s.frames)).toBe(Object.prototype);
    expect((s.frames as Record<string, unknown>).tint).toBeUndefined();
    expect(Object.hasOwn(s.frames, "__proto__")).toBe(false);
  });

  it("ignores a frames value that is not an object", () => {
    for (const bad of [null, 3, "x", [{ tint: "blue" }], true])
      expect(readSidecar({ frames: bad }).frames).toEqual({});
  });

  it("keeps at most FRAME_MAX_STYLES boundary styles", () => {
    const raw: Record<string, unknown> = {};
    for (let i = 0; i < 10_000; i++) raw[`g${i}`] = { tint: "blue" };
    const s = readSidecar({ frames: raw });
    expect(Object.keys(s.frames)).toHaveLength(FRAME_MAX_STYLES);
  });

  it("drops the style of a boundary the design no longer has, when told what it has", () => {
    const raw = { frames: { vpc: { tint: "blue" }, gone: { tint: "rose" } } };
    expect(readSidecar(raw, { nodes: [], groups: ["vpc"] }).frames).toEqual({
      vpc: { tint: "blue" },
    });
    expect(Object.keys(readSidecar(raw).frames)).toEqual(["vpc", "gone"]);
  });

  it("writes the styles back and an empty map when there are none", () => {
    const base = { nodes: {}, edges: {}, notes: [] };
    expect(writeSidecar(base).frames).toEqual({});
    expect(writeSidecar({ ...base, frames: { vpc: { tint: "green" } } }).frames).toEqual({
      vpc: { tint: "green" },
    });
  });

  it("prunes styles of deleted boundaries without touching the input", () => {
    const frames = { vpc: { tint: "blue" as const }, gone: { icon: "kind:queue" } };
    expect(pruneFrames(frames, ["vpc"])).toEqual({ vpc: { tint: "blue" } });
    expect(Object.keys(frames)).toEqual(["vpc", "gone"]);
  });

  it("follows a boundary rename", () => {
    const frames: Record<string, { tint?: (typeof TINTS)[number] }> = {
      old: { tint: "amber" },
      other: { tint: "rose" },
    };
    retargetFrame(frames, "old", "new");
    expect(frames).toEqual({ new: { tint: "amber" }, other: { tint: "rose" } });
    retargetFrame(frames, "missing", "x");
    expect(Object.keys(frames)).toEqual(["other", "new"]);
  });

  it("resolves an icon reference to its key in the icon map", () => {
    expect(frameIconKey("kind:queue")).toBe("kind:queue");
    expect(frameIconKey("component:aws/aws-lambda")).toBe("aws-lambda");
    expect(frameIconKey("component:../x")).toBeNull();
    expect(frameIconKey("boundary:aws")).toBe("boundary:aws");
    expect(frameIconKey("boundary:environment-prod")).toBe("boundary:environment-prod");
    expect(frameIconKey("boundary:../aws")).toBeNull();
    expect(frameIconKey("boundary:aws-")).toBeNull();
    expect(frameIconKey(undefined)).toBeNull();
    expect(isFrameIcon("kind:")).toBe(false);
    expect(TINTS.every(isTint)).toBe(true);
    expect(isTint("red")).toBe(false);
    expect(isTint("#ff6600")).toBe(false);
  });

  it("tells a hex tint from a named one and refuses every other colour syntax", () => {
    expect(isHexTint("#ff6600")).toBe(true);
    expect(isHexTint("#FF6600")).toBe(true);
    for (const bad of ["#f60", "#ff660080", "ff6600", "red", "rgb(1,2,3)", "javascript:x", 3])
      expect(isHexTint(bad)).toBe(false);
    expect(isHexTint("blue")).toBe(false);
    expect(isAnyTint("blue")).toBe(true);
    expect(isAnyTint("#0d9488")).toBe(true);
    expect(isAnyTint("#0d948814")).toBe(false);
    expect(normaliseTint("#ABCDEF")).toBe("#abcdef");
    expect(normaliseTint("teal")).toBe("teal");
    expect(normaliseTint("#abc")).toBeNull();
  });
});

describe("edge ports", () => {
  it("keeps a well-formed port, clamps and rounds t, and drops the rest", () => {
    const s = readSidecar({
      ports: {
        "a>b": { from: { side: "right", t: 0.12345 }, to: { side: "top", t: 2 } },
        "a>b#1": { to: { side: "left", t: -1 }, junk: 1 },
        "b>c": { from: { side: "middle", t: 0.5 }, to: { side: "top", t: "x" } },
        "c>d": { from: { side: "top", t: Number.NaN } },
        nokey: { from: { side: "top", t: 0.5 } },
        "d>e": 7,
      },
    });
    expect(s.ports).toEqual({
      "a>b": { from: { side: "right", t: 0.123 }, to: { side: "top", t: 1 } },
      "a>b#1": { to: { side: "left", t: 0 } },
    });
    // As JSON arrives: `__proto__` is an own key there, and it never becomes a prototype here.
    const hostile = readSidecar(
      JSON.parse('{"ports":{"__proto__":{"from":{"side":"top","t":0.5}}}}'),
    );
    expect(hostile.ports).toBeUndefined();
    expect(
      Object.getPrototypeOf(readPorts(JSON.parse('{"__proto__":{"to":{"side":"top","t":0}}}'))),
    ).toBe(Object.prototype);
  });

  it("leaves the section out when there is nothing in it, reading and writing", () => {
    expect("ports" in readSidecar({ ports: {} })).toBe(false);
    expect("ports" in readSidecar({ ports: [{ from: { side: "top", t: 0 } }] })).toBe(false);
    const base = { nodes: {}, edges: {}, notes: [] };
    expect("ports" in writeSidecar(base)).toBe(false);
    expect("ports" in writeSidecar({ ...base, ports: {} })).toBe(false);
    const ports = { "a>b": { to: { side: "bottom" as const, t: 0.5 } } };
    expect(writeSidecar({ ...base, ports }).ports).toEqual(ports);
    expect(readSidecar(writeSidecar({ ...base, ports })).ports).toEqual(ports);
  });

  it("prunes the ports of edges that have gone without touching the input", () => {
    const ports = { "a>b": { from: { side: "top" as const, t: 0 } }, "b>c": {} };
    expect(prunePorts(ports, ["a>b"])).toEqual({ "a>b": { from: { side: "top", t: 0 } } });
    expect(Object.keys(ports)).toEqual(["a>b", "b>c"]);
    expect(readPorts(null)).toEqual({});
  });
});

describe("edge label offsets", () => {
  it("keeps finite pairs, rounded and clamped, and drops the rest", () => {
    const s = readSidecar({
      labels: {
        "a>b": [12.4, -80.6],
        "a>b#1": [5000, -9000],
        "b>c": [0, 0],
        "c>d": [1, Number.NaN],
        "d>e": ["1", 2],
        "e>f": [1, 2, 3],
        nokey: [1, 1],
      },
    });
    expect(s.labels).toEqual({ "a>b": [12, -81], "a>b#1": [2000, -2000] });
    const hostile = readSidecar(JSON.parse('{"labels":{"__proto__":[1,2]}}'));
    expect(hostile.labels).toBeUndefined();
    expect(Object.getPrototypeOf(readLabels(JSON.parse('{"__proto__":[1,2]}')))).toBe(
      Object.prototype,
    );
  });

  it("is written only when it holds something, and counts as drawn", () => {
    const base = { nodes: {}, edges: {}, notes: [] };
    expect("labels" in writeSidecar(base)).toBe(false);
    expect("labels" in writeSidecar({ ...base, labels: {} })).toBe(false);
    const labels: Record<string, [number, number]> = { "a>b": [3, 4] };
    expect(readSidecar(writeSidecar({ ...base, labels })).labels).toEqual(labels);
    expect(isBlankSidecar({ labels: {} })).toBe(true);
    expect(isBlankSidecar({ labels })).toBe(false);
  });

  it("is pruned with its edge and filed after the ports", () => {
    const s = readSidecar({
      nodes: { a: [0, 0], b: [1, 1] },
      ports: { "a>b": { to: { side: "top", t: 0.5 } } },
      labels: { "x>a": [1, 1], "a>b": [9, 8] },
    });
    expect(pruneSidecar(s, { nodes: ["a", "b"], groups: [], edges: ["a>b"] }).labels).toEqual({
      "a>b": [9, 8],
    });
    expect(pruneSidecar(s, { nodes: ["a", "b"], groups: [], edges: [] }).labels).toBeUndefined();
    const file = sidecarFile({ ...s, labels: { "b>a": [1, 2], "a>b": [3, 4] } });
    const keys = Object.keys(JSON.parse(file));
    expect(keys.indexOf("labels")).toBe(keys.indexOf("ports") + 1);
    expect(Object.keys(JSON.parse(file).labels)).toEqual(["a>b", "b>a"]);
  });
});

describe("the chosen list badge", () => {
  const base = { nodes: {}, edges: {}, notes: [] };

  it("keeps a provider or boundary ref and nothing else", () => {
    expect(readSidecar({ badge: "provider:gcp" }).badge).toBe("provider:gcp");
    expect(readSidecar({ badge: "boundary:on-premises" }).badge).toBe("boundary:on-premises");
    for (const bad of [
      "kind:database",
      "component:aws/s3",
      "provider:",
      "provider:GCP",
      "boundary:-x",
      "boundary:a--b",
      "provider:gcp ",
      "gcp",
      `provider:${"a".repeat(200)}`,
      7,
      null,
      { provider: "gcp" },
    ])
      expect("badge" in readSidecar({ badge: bad })).toBe(false);
    expect(isBadgeRef("boundary:google")).toBe(true);
    expect(BADGE_RE.test("kind:cache")).toBe(false);
  });

  it("is written only when set, and survives a round trip", () => {
    expect("badge" in writeSidecar(base)).toBe(false);
    expect("badge" in writeSidecar({ ...base, badge: undefined })).toBe(false);
    expect("badge" in writeSidecar({ ...base, badge: "kind:cache" })).toBe(false);
    const out = writeSidecar({ ...base, badge: "boundary:google" });
    expect(out.badge).toBe("boundary:google");
    expect(readSidecar(JSON.parse(JSON.stringify(out))).badge).toBe("boundary:google");
  });
});

describe("sidecarFile", () => {
  it("writes the same bytes whatever order the keys arrive in", () => {
    const a = {
      version: 2,
      nodes: { b: [1, 2], a: [3, 4] },
      edges: { "a>b": 5 },
      notes: [],
      frames: {},
    };
    const b = {
      frames: {},
      notes: [],
      edges: { "a>b": 5 },
      nodes: { a: [3, 4], b: [1, 2] },
      version: 2,
    };
    expect(sidecarFile(a)).toBe(sidecarFile(b));
    expect(sidecarFile(a).startsWith('{\n  "version": 2,\n  "nodes": {\n    "a"')).toBe(true);
    expect(sidecarFile(null).endsWith("}\n")).toBe(true);
  });
});

describe("pruneSidecar", () => {
  it("keeps what the design names and unanchors a note whose target is gone", () => {
    const s = readSidecar({
      nodes: { a: [0, 0], x: [1, 1] },
      edges: { "a>b": 3, "x>a": 4 },
      ports: { "x>a": { to: { side: "top", t: 0.5 } } },
      frames: { g: { tint: "blue" }, h: { tint: "rose" } },
      notes: [{ id: "n", x: 1, y: 2, w: 100, h: 60, text: "t", anchor: { node: "x" } }],
      badge: "provider:aws",
    });
    const p = pruneSidecar(s, { nodes: ["a", "b"], groups: ["g"], edges: ["a>b"] });
    expect(p.nodes).toEqual({ a: [0, 0] });
    expect(p.edges).toEqual({ "a>b": 3 });
    expect(p.ports).toBeUndefined();
    expect(p.frames).toEqual({ g: { tint: "blue" } });
    expect(p.notes[0].anchor).toBeUndefined();
    expect(p.badge).toBe("provider:aws");
    expect(s.notes[0].anchor).toEqual({ node: "x" }); // it copies
  });
});

describe("component tints and tint strength", () => {
  it("reads a tint per node, lowercasing hex, and drops what is not one", () => {
    const t = readTints({
      api: { tint: "teal" },
      db: { tint: "#AABBCC", strength: "bold" },
      web: { tint: "chartreuse" },
      q: { tint: "rose", strength: "heavy" },
      n: { tint: "rose", strength: "normal" },
      Bad_Id: { tint: "blue" },
      x: "blue",
    });
    expect(t).toEqual({
      api: { tint: "teal" },
      db: { tint: "#aabbcc", strength: "bold" },
      q: { tint: "rose" },
      n: { tint: "rose" },
    });
  });

  it("keeps a frame's strength only beside its tint", () => {
    const s = readSidecar({
      frames: {
        a: { tint: "blue", strength: "light" },
        b: { icon: "kind:queue", strength: "bold" },
        c: { tint: "blue", strength: "loud" },
      },
    });
    expect(s.frames).toEqual({
      a: { tint: "blue", strength: "light" },
      b: { icon: "kind:queue" },
      c: { tint: "blue" },
    });
  });

  it("is absent when no component has a tint, so an old sidecar keeps its bytes", () => {
    expect(readSidecar({ nodes: {} }).tints).toBeUndefined();
    const base = { nodes: {}, edges: {}, notes: [], frames: {} };
    expect("tints" in writeSidecar(base)).toBe(false);
    expect(writeSidecar({ ...base, tints: { a: { tint: "blue" } } }).tints).toEqual({
      a: { tint: "blue" },
    });
  });

  it("drops a tint whose node is gone, follows a rename, and rides the file and an import", () => {
    expect(
      readSidecar({ tints: { a: { tint: "blue" }, b: { tint: "rose" } } }, { nodes: ["a"] }).tints,
    ).toEqual({
      a: { tint: "blue" },
    });
    expect(pruneTints({ a: { tint: "blue" }, b: { tint: "rose" } }, ["b"])).toEqual({
      b: { tint: "rose" },
    });
    const m = { a: { tint: "blue" as const } };
    retargetTint(m, "a", "z");
    expect(m).toEqual({ z: { tint: "blue" } });
    const raw = {
      nodes: { a: [0, 0] },
      tints: {
        b: { tint: "rose", strength: "light" },
        a: { tint: "#112233" },
        gone: { tint: "teal" },
      },
      frames: { g: { tint: "amber", strength: "bold" } },
    };
    const file = JSON.parse(
      sidecarFile(pruneSidecar(readSidecar(raw), { nodes: ["a", "b"], groups: ["g"], edges: [] })),
    );
    expect(file.tints).toEqual({ a: { tint: "#112233" }, b: { tint: "rose", strength: "light" } });
    expect(file.frames).toEqual({ g: { tint: "amber", strength: "bold" } });
    expect(Object.keys(file)).toEqual(["version", "nodes", "edges", "frames", "tints", "notes"]);
    expect(readSidecar(file).tints).toEqual(file.tints);
  });
});

describe("edge style", () => {
  it("keeps curved and bundled, and drops the default and anything unknown", () => {
    expect(readRoutingField("bundled")).toBe("bundled");
    expect(readSidecar({ routing: "bundled" }).routing).toBe("bundled");
    expect(readRoutingField("curved")).toBe("curved");
    expect(readRoutingField("orthogonal")).toBeUndefined();
    expect(readRoutingField("zigzag")).toBeUndefined();
    expect(readRoutingField(1)).toBeUndefined();
    expect(readSidecar({ routing: "curved" }).routing).toBe("curved");
    expect(readSidecar({ routing: "orthogonal" })).not.toHaveProperty("routing");
    expect(readSidecar({ routing: { evil: true } })).not.toHaveProperty("routing");
  });

  it("is something drawn, survives the writer and pruning, and takes its place in the file", () => {
    expect(isBlankSidecar({ routing: "curved" })).toBe(false);
    expect(isBlankSidecar({ routing: "orthogonal" })).toBe(true);
    const s = writeSidecar({ nodes: {}, edges: {}, notes: [], routing: "curved" });
    expect(s.routing).toBe("curved");
    expect(writeSidecar({ nodes: {}, edges: {}, notes: [] })).not.toHaveProperty("routing");
    expect(pruneSidecar(s, { nodes: [], groups: [], edges: [] }).routing).toBe("curved");
    const file = JSON.parse(sidecarFile({ ...s, tints: { a: { tint: "blue" } } }));
    expect(Object.keys(file)).toEqual([
      "version",
      "nodes",
      "edges",
      "frames",
      "tints",
      "routing",
      "notes",
    ]);
    // a design nobody switched keeps the bytes it had
    expect(sidecarFile({ nodes: { a: [0, 0] } })).not.toContain("routing");
  });
});

describe("edge paths: bows and waypoints", () => {
  it("reads a number bow as it always did, and waypoints validated, rounded and capped", () => {
    const many = Array.from({ length: 40 }, (_, k) => [k, k]);
    const s = readSidecar({
      edges: {
        "a>b": 12,
        "b>c": {
          via: [
            [10.4, 20.6],
            [100, 20],
          ],
        },
        "c>d": { via: [] },
        "d>e": { via: [[1, Number.NaN]] },
        "e>f": { via: "x" },
        "f>g": { via: many },
        __proto__: { via: [[1, 1]] },
        "no-arrow": { via: [[1, 1]] },
      },
    });
    expect(s.edges["a>b"]).toBe(12);
    expect(s.edges["b>c"]).toEqual({
      via: [
        [10, 21],
        [100, 20],
      ],
    });
    expect(Object.keys(s.edges).sort()).toEqual(["a>b", "b>c", "f>g"]);
    expect((s.edges["f>g"] as { via: unknown[] }).via).toHaveLength(32);
    expect(readEdgePath(0)).toBeNull();
    expect(readEdgePath({ via: [[1, 2]] })).toEqual({ via: [[1, 2]] });
  });

  it("writes waypoints only when there are some, and counts them as drawn", () => {
    const s = writeSidecar({
      nodes: {},
      edges: { "a>b": { via: [[1, 2]] }, "b>c": { via: [] }, "c>d": -4 },
      notes: [],
    });
    expect(s.edges).toEqual({ "a>b": { via: [[1, 2]] }, "c>d": -4 });
    expect(isBlankSidecar({ edges: { "a>b": { via: [[1, 2]] } } })).toBe(false);
    expect(isBlankSidecar({ edges: { "a>b": { via: [] } } })).toBe(true);
  });

  it("prunes waypoints with their edge and writes them in the file in a fixed order", () => {
    const raw = {
      nodes: {},
      edges: {
        "x>y": { via: [[5, 6]] },
        "a>b": {
          via: [
            [1, 2],
            [3, 2],
          ],
        },
        "a>c": 7,
      },
      notes: [],
    };
    const pruned = pruneSidecar(readSidecar(raw), { nodes: [], groups: [], edges: ["a>b", "a>c"] });
    expect(pruned.edges).toEqual({
      "a>b": {
        via: [
          [1, 2],
          [3, 2],
        ],
      },
      "a>c": 7,
    });
    const file = sidecarFile(pruned);
    expect(Object.keys(JSON.parse(file).edges)).toEqual(["a>b", "a>c"]);
    expect(sidecarFile(JSON.parse(file))).toBe(file);
    expect(readSidecar(JSON.parse(file)).edges).toEqual(pruned.edges);
  });
});
