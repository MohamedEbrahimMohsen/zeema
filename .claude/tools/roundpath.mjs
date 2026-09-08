// Round the coordinates of an SVG path without touching its structure.
//
// A number-level rounder cannot do this safely. In "a2.25 2.25 0 00-.5.5" the "00" is two arc
// flags, not the number zero, so a rounder that reads it as one number loses a flag and makes
// the arc invalid; and a coordinate that shortens to "0" can merge with the number before it,
// which turns two coordinates into one. Both faults were present in the icon set and both make
// a browser refuse to draw the mark.
//
// So the path is walked command by command with the real argument shapes, flags are copied
// through untouched, and every token is separated explicitly. The output is a little longer
// than the tightest possible packing and it is always legal, which is the right trade for a
// file that has to render everywhere.

const ARGS = {
  a: ["n", "n", "n", "f", "f", "n", "n"],
  c: ["n", "n", "n", "n", "n", "n"],
  s: ["n", "n", "n", "n"],
  q: ["n", "n", "n", "n"],
  h: ["n"],
  v: ["n"],
  z: [],
  m: ["n", "n"],
  l: ["n", "n"],
  t: ["n", "n"],
};

const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/;

export function roundPath(d, digits) {
  const round = (raw) => {
    let r = Number(raw).toFixed(digits);
    if (digits > 0 && r.includes(".")) r = r.replace(/\.?0+$/, "");
    if (r === "" || r === "-" || r === "-0" || r === "0") return "0";
    return r.replace(/^(-?)0\./, "$1.");
  };

  const out = [];
  let i = 0, cmd = null;
  while (i < d.length) {
    const ch = d[i];
    if (ch === " " || ch === "," || ch === "\n" || ch === "\t" || ch === "\r") { i++; continue; }
    if (/[A-Za-z]/.test(ch)) { cmd = ch; out.push(ch); i++; continue; }
    if (!cmd) return null;
    const shape = ARGS[cmd.toLowerCase()];
    if (!shape) return null;
    for (const kind of shape) {
      while (i < d.length && /[\s,]/.test(d[i])) i++;
      if (kind === "f") {
        if (d[i] !== "0" && d[i] !== "1") return null;
        out.push(d[i]); i++;
        continue;
      }
      const m = NUMBER.exec(d.slice(i));
      if (!m) return null;
      i += m[0].length;
      out.push(round(m[0]));
    }
  }

  // Join. A letter needs no separator and a leading "-" is one by itself. A leading "." is a
  // separator only when the token before it already has a decimal point: "1.5" then ".5" reads
  // as two numbers, but "0" then ".244" would merge into the single number "0.244".
  let text = "", prevTok = "";
  for (const tok of out) {
    if (!text) { text = tok; prevTok = tok; continue; }
    const prevChar = text[text.length - 1];
    const numeric = /[0-9.]/.test(prevChar);
    const needsSpace = numeric && (/^[0-9]/.test(tok) || (tok[0] === "." && !prevTok.includes(".")));
    text += (needsSpace ? " " : "") + tok;
    prevTok = tok;
  }
  return text;
}
