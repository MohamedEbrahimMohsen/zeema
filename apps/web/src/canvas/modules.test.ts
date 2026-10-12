import { MODULE_HEADER, moduleTiles } from "@zeema/core/geometry";
import { describe, expect, it } from "vitest";
import {
  type Box,
  EXPANDED_MIN_W,
  expandBoxes,
  expandedKey,
  findingTiles,
  inProcessLines,
  readExpanded,
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
