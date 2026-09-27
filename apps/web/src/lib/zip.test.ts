import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { crc32, looksLikeZip, UnsupportedZip, unzipStore, zipStore } from "./zip";

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

describe("crc32", () => {
  it("matches the standard check value", () => {
    expect(crc32(enc("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("agrees with Node's zlib.crc32 where Node has one", () => {
    const z = zlib as unknown as { crc32?: (b: Uint8Array) => number };
    if (typeof z.crc32 !== "function") return;
    for (const s of ["", "a", "design.yaml", "é ✓ 漢字\n".repeat(50)])
      expect(crc32(enc(s))).toBe(z.crc32(enc(s)));
  });
});

describe("zipStore / unzipStore", () => {
  const files = [
    { name: "design.yaml", data: 'schemaVersion: "1"\ntype: "design"\nid: "x"\n' },
    { name: "design.layout.json", data: '{\n  "version": 2\n}\n' },
  ];

  it("round-trips the files byte for byte, in order", () => {
    const zip = zipStore(files, new Date(Date.UTC(2026, 8, 27, 12, 30, 10)));
    expect(looksLikeZip(zip)).toBe(true);
    const back = unzipStore(zip);
    expect(back.map((e) => e.name)).toEqual(["design.yaml", "design.layout.json"]);
    expect(back.map((e) => dec(e.data))).toEqual(files.map((f) => f.data));
  });

  it("writes the headers a zip tool reads: signatures, stored, sizes and CRC", () => {
    const zip = zipStore(files);
    const v = new DataView(zip.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint16(8, true)).toBe(0); // stored
    const data = enc(files[0].data);
    expect(v.getUint32(14, true)).toBe(crc32(data));
    expect(v.getUint32(18, true)).toBe(data.length);
    // The end record points at a central directory that holds both entries.
    const end = zip.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(2);
    const cd = v.getUint32(end + 16, true);
    expect(v.getUint32(cd, true)).toBe(0x02014b50);
  });

  it("is deterministic for the same inputs and date", () => {
    const d = new Date(Date.UTC(2025, 0, 1));
    expect(zipStore(files, d)).toEqual(zipStore(files, d));
  });

  it("refuses what it never writes: a compressed entry", () => {
    const zip = zipStore(files);
    new DataView(zip.buffer).setUint16(8, 8, true); // deflate
    expect(() => unzipStore(zip)).toThrow(UnsupportedZip);
  });

  it("refuses a damaged entry and a file that is not a zip", () => {
    const zip = zipStore(files);
    zip[45] ^= 0xff; // a byte of design.yaml's data
    expect(() => unzipStore(zip)).toThrow(/checksum/);
    expect(() => unzipStore(enc("not a zip"))).toThrow(UnsupportedZip);
  });
});
