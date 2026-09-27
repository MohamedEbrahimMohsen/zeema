// A zip writer and reader for the one archive the site makes: a design and its layout, two small
// text files, stored without compression. No dependency, no Node API, so the same code builds the
// download on the server and opens it again in the browser on the import page.
//
// The reader reads only what the writer writes: stored entries (method 0) with their sizes in the
// local header. A compressed entry, a streamed one (sizes in a trailing data descriptor), zip64 or
// an encrypted entry is refused with `UnsupportedZip`, never guessed at.

export class UnsupportedZip extends Error {
  constructor(message = "unsupported zip: unzip it and pick the files") {
    super(message);
    this.name = "UnsupportedZip";
  }
}

export type ZipEntry = { name: string; data: Uint8Array };

let table: Uint32Array | null = null;

/** CRC-32 (IEEE 802.3, the one zip uses) of some bytes. */
export function crc32(bytes: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const utf8 = (s: string) => new TextEncoder().encode(s);

/** A date as MS-DOS packs it: two 16-bit words, local fields read in UTC so the bytes are stable. */
function dosTime(d: Date) {
  const year = Math.min(Math.max(d.getUTCFullYear(), 1980), 2107);
  return {
    time: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
  };
}

/**
 * A stored (uncompressed) zip of `files`, in the order given. Names are UTF-8 (flag bit 11).
 * `date` stamps every entry; the same inputs and date always give the same bytes.
 */
export function zipStore(
  files: { name: string; data: Uint8Array | string }[],
  date: Date = new Date(0),
): Uint8Array {
  const { time, date: day } = dosTime(date);
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = utf8(f.name);
    const data = typeof f.data === "string" ? utf8(f.data) : f.data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed: 2.0
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, time, true);
    lv.setUint16(12, day, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // made by: 2.0, MS-DOS attributes
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, day, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    // extra, comment, disk number, internal and external attributes: all zero
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const cdSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cdSize + end.length);
  let at = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Whether these bytes start like a zip (a local file header). */
export const looksLikeZip = (bytes: Uint8Array) =>
  bytes.length >= 4 &&
  bytes[0] === 0x50 &&
  bytes[1] === 0x4b &&
  bytes[2] === 0x03 &&
  bytes[3] === 0x04;

/**
 * The entries of a zip `zipStore` wrote, walked through the local headers. Directories are
 * skipped. Anything the writer never produces throws `UnsupportedZip`; a CRC that does not match
 * throws too, so a damaged file is never imported as if it were whole.
 */
export function unzipStore(bytes: Uint8Array, maxEntries = 64): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: ZipEntry[] = [];
  let at = 0;
  while (at + 4 <= bytes.length && view.getUint32(at, true) === 0x04034b50) {
    if (at + 30 > bytes.length) throw new UnsupportedZip("damaged zip");
    const flags = view.getUint16(at + 6, true);
    const method = view.getUint16(at + 8, true);
    const crc = view.getUint32(at + 14, true);
    const size = view.getUint32(at + 18, true);
    const rawSize = view.getUint32(at + 22, true);
    const nameLen = view.getUint16(at + 26, true);
    const extraLen = view.getUint16(at + 28, true);
    // Encrypted (bit 0) or streamed (bit 3) entries, compression, zip64 sizes: not ours.
    if (flags & 0x0009 || method !== 0 || size !== rawSize || size === 0xffffffff)
      throw new UnsupportedZip();
    const start = at + 30 + nameLen + extraLen;
    if (start + size > bytes.length) throw new UnsupportedZip("damaged zip");
    const name = new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLen));
    const data = bytes.slice(start, start + size);
    if (crc32(data) !== crc) throw new UnsupportedZip(`damaged zip: ${name} fails its checksum`);
    if (!name.endsWith("/")) out.push({ name, data });
    if (out.length > maxEntries) throw new UnsupportedZip("zip has too many files");
    at = start + size;
  }
  if (!out.length) throw new UnsupportedZip();
  return out;
}
