import { MODULE_GAP, MODULE_HEADER, MODULE_TILE_H, moduleTiles } from "@zeema/core/geometry";
import { describe, expect, it } from "vitest";
import {
  type Box,
  drawnPaths,
  EXPANDED_MIN_W,
  expandBoxes,
  expandedKey,
  findingTiles,
  ghostBoxes,
  ghostSlot,
  inProcessLines,
  openNodes,
  readExpanded,
  resetPaths,
  shiftPath,
  tileAt,
  tileBoxes,
  writeExpanded,
} from "./modules";

const backend = { id: "backend", modules: [{ id: "api" }, { id: "otp" }, { id: "iam" }] };
const nodes = [backend, { id: "sms" }, { id: "solo", modules: [] }];
const boxes: Record<string, Box> = {
  backend: [100, 50, 176, 78],
  sms: [600, 50, 176, 78],
  solo: [0, 400, 140, 78],
};

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    m,
  };
};

describe("expanded state", () => {
  it("is stored per design and read back as a set", () => {
    const s = memory();
    writeExpanded("zeema/a", ["b", "a"], s);
    expect(s.m.get(expandedKey("zeema/a"))).toBe('["a","b"]');
    expect([...readExpanded("zeema/a", s)]).toEqual(["a", "b"]);
    expect(readExpanded("zeema/other", s).size).toBe(0);
  });
  it("survives a store that throws or holds junk", () => {
    const bad = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readExpanded("x", bad).size).toBe(0);
    expect(() => writeExpanded("x", ["a"], bad)).not.toThrow();
    const s = memory();
    s.setItem(expandedKey("x"), "{not json");
    expect(readExpanded("x", s).size).toBe(0);
    s.setItem(expandedKey("x"), '[1, "a"]');
    expect([...readExpanded("x", s)]).toEqual(["a"]);
  });
});

describe("expanded boxes", () => {
  it("grows only an expanded node with modules, from its top-left corner", () => {
    const t = moduleTiles(backend, 176)!;
    const out = expandBoxes(nodes, boxes, new Set(["backend", "solo"]));
    expect(out.backend).toEqual([100, 50, t.w, t.h]);
    expect(out.sms).toEqual(boxes.sms);
    expect(out.solo).toEqual(boxes.solo);
    // collapsed: as laid out
    expect(expandBoxes(nodes, boxes, new Set())).toEqual(boxes);
    // one module in a narrow box: the header still has room
    const one = [{ id: "n", modules: [{ id: "a" }] }];
    const narrow = expandBoxes(one, { n: [0, 0, 126, 78] }, new Set(["n"]));
    expect(narrow.n[2]).toBe(EXPANDED_MIN_W);
    const tile = tileBoxes(one, narrow, new Set(["n"]))["n/a"];
    expect(tile[0] + tile[2] / 2).toBe(EXPANDED_MIN_W / 2);
  });

  it("gives every tile a world box keyed by its end", () => {
    const drawn = expandBoxes(nodes, boxes, new Set(["backend"]));
    const tiles = tileBoxes(nodes, drawn, new Set(["backend"]));
    const t = moduleTiles(backend, drawn.backend[2])!;
    expect(Object.keys(tiles)).toEqual(["backend/api", "backend/otp", "backend/iam"]);
    expect(tiles["backend/otp"]).toEqual([
      100 + t.tiles[1].x,
      50 + t.tiles[1].y,
      t.tiles[1].w,
      t.tiles[1].h,
    ]);
    // the same tiles as moduleTiles laid out at the collapsed width
    const first = moduleTiles(backend, 176)!.tiles[0];
    expect(tiles["backend/api"].slice(0, 2)).toEqual([100 + first.x, 50 + first.y]);
    expect(tileBoxes(nodes, boxes, new Set())).toEqual({});
    const [x, y, w, h] = tiles["backend/iam"];
    expect(tileAt(tiles, x + w / 2, y + h / 2)).toBe("backend/iam");
    expect(tileAt(tiles, 0, 0)).toBeNull();
  });
});

describe("in-process lines", () => {
  const doc = {
    nodes,
    edges: [
      { from: "backend/api", to: "backend/otp" },
      { from: "backend/otp", to: "sms", protocol: "https", mode: "sync" },
      { from: "backend/iam", to: "backend" },
    ],
  };
  it("draws tile to tile, and to the header for the node itself, only when expanded", () => {
    const drawn = expandBoxes(nodes, boxes, new Set(["backend"]));
    const tiles = tileBoxes(nodes, drawn, new Set(["backend"]));
    const lines = inProcessLines(doc, drawn, tiles, MODULE_HEADER);
    expect(lines.map((l) => l.i)).toEqual([0, 2]);
    const [a, b] = lines[0].points;
    const api = tiles["backend/api"];
    const otp = tiles["backend/otp"];
    expect(a).toEqual([api[0] + api[2], api[1] + api[3] / 2]); // right side of api
    expect(b).toEqual([otp[0], otp[1] + otp[3] / 2]); // left side of otp
    // to the header: ends on the header strip's bottom
    expect(lines[1].points[1][1]).toBeCloseTo(drawn.backend[1] + MODULE_HEADER);
    expect(inProcessLines(doc, boxes, {}, MODULE_HEADER)).toEqual([]);
  });

  it("lists the module ends a finding names", () => {
    const tiles = findingTiles([
      { subject: { type: "edge", ref: 1, from: "backend/otp", to: "sms" } },
      { subject: { type: "node", ref: "backend" } },
    ]);
    expect([...tiles]).toEqual(["backend/otp"]);
  });
});

describe("the + module slot", () => {
  const two = { id: "web", modules: [{ id: "api" }, { id: "jobs" }] };
  const three = { id: "web", modules: [{ id: "api" }, { id: "jobs" }, { id: "files" }] };

  it("is one more cell after the last tile, the same size, in the same row while it fits", () => {
    const t = ghostSlot(two, 176)!;
    const plain = moduleTiles(two, 176)!;
    expect(t.tiles.map((x) => x.id)).toEqual(["api", "jobs"]);
    const [a, b] = t.tiles;
    expect(t.ghost).toEqual([b.x + (b.x - a.x), b.y, b.w, b.h]);
    expect(b.w).toBe(plain.tiles[1].w);
    // the grid of three cells is centred, and the box holds it
    expect(t.ghost![0] + t.ghost![2] + a.x).toBe(t.w);
    expect(t.h).toBe(plain.h);
  });

  it("starts a new row under a full one, and the box grows by that row", () => {
    const t = ghostSlot(three, 176)!;
    const plain = moduleTiles(three, 176)!;
    expect(t.tiles).toEqual(plain.tiles);
    expect(t.ghost).toEqual([t.tiles[0].x, t.tiles[0].y + MODULE_TILE_H + MODULE_GAP, 84, 40]);
    expect(t.h).toBe(plain.h + MODULE_TILE_H + MODULE_GAP);
    expect(t.w).toBe(plain.w);
  });

  it("is never laid out without being asked for, nor for a node with no modules", () => {
    expect(ghostSlot(three, 176, false)).toEqual({ ...moduleTiles(three, 176), ghost: null });
    expect(ghostSlot({ id: "x" }, 176)).toBeNull();
    expect(ghostSlot({ id: "x", modules: [] }, 176)).toBeNull();
  });

  it("sizes the box, the tiles and the slot's world box together", () => {
    const all = () => true;
    const list = [three, { id: "sms" }];
    const laid: Record<string, Box> = { web: [10, 20, 176, 78], sms: [600, 0, 140, 78] };
    const open = new Set(["web", "sms"]);
    const drawn = expandBoxes(list, laid, open, all);
    const t = ghostSlot(three, EXPANDED_MIN_W)!;
    expect(drawn.web).toEqual([10, 20, t.w, t.h]);
    expect(drawn.sms).toEqual(laid.sms);
    const tiles = tileBoxes(list, drawn, open, all);
    expect(Object.keys(tiles)).toEqual(["web/api", "web/jobs", "web/files"]);
    const g = ghostBoxes(list, drawn, open, all);
    expect(Object.keys(g)).toEqual(["web"]);
    expect(g.web).toEqual([10 + t.ghost![0], 20 + t.ghost![1], t.ghost![2], t.ghost![3]]);
    // the slot is no tile: nothing lands on it
    expect(tileAt(tiles, g.web[0] + 4, g.web[1] + 4)).toBeNull();
    // without the slot, the box is moduleTiles' as before
    expect(expandBoxes(list, laid, open)).toEqual(expandBoxes(list, laid, open, () => false));
    expect(ghostBoxes(list, drawn, new Set(), all)).toEqual({});
    expect(ghostBoxes(list, drawn, open, () => false)).toEqual({});
  });
});

describe("edge waypoints per expand state", () => {
  const nodes = [{ id: "web", modules: [{ id: "auth" }] }, { id: "db" }];
  const bows = {
    "web>db": { via: [[1, 1]], viaExpanded: { web: [[2, 2]] } },
    "web/auth>db#1": { via: [[3, 3]] },
    "db>web": 9,
  } as Record<string, any>;

  it("opens only the expanded nodes that have modules", () => {
    expect([...openNodes(nodes, ["web", "db", "gone"])]).toEqual(["web"]);
  });

  it("draws `via` collapsed and the state's slot expanded (none: automatic)", () => {
    expect(drawnPaths(bows, nodes, [])).toEqual({
      "web>db": { via: [[1, 1]] },
      "web/auth>db#1": { via: [[3, 3]] },
      "db>web": 9,
    });
    // `db` has no modules, so it never counts as expanded.
    expect(drawnPaths(bows, nodes, ["web", "db"])).toEqual({
      "web>db": { via: [[2, 2]] },
      "db>web": 9,
    });
  });

  it("resets a bow, or only the waypoints of the state drawn now", () => {
    const state = () => "web";
    expect(resetPaths(bows, ["web>db", "db>web", "nope"], state)).toEqual({
      "web>db": { via: [[1, 1]] },
      "web/auth>db#1": { via: [[3, 3]] },
    });
    expect(resetPaths(bows, ["web/auth>db#1"], () => "")).not.toHaveProperty("web/auth>db#1");
    expect(bows["web>db"].viaExpanded).toEqual({ web: [[2, 2]] });
  });

  it("moves every state's waypoints with a paste", () => {
    expect(shiftPath(bows["web>db"], 10)).toEqual({
      via: [[11, 11]],
      viaExpanded: { web: [[12, 12]] },
    });
    expect(shiftPath(5, 10)).toBe(5);
  });
});
