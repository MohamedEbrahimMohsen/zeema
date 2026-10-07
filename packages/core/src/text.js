// A node's words and the box they sit in. The layout sizes a box from the words it will show,
// and the renderers (the server SVG and the canvas) fit those words into it, by one measure, so
// a name that the box was sized for is never cut, and one too long for any sensible box is cut
// the same way everywhere.
//
// Text is measured by estimate, with no DOM, so the picture is the same wherever it is drawn:
// an average advance per class of character, in ems of the sans face (a little generous, so an
// estimate that errs, errs toward fitting). Both lines of a box are set in the sans face.
//
// Pure: no DOM, no fs, no imports.

const NAME_FONT = 14;
const SUB_FONT = 11;
// Room between the words and the box's sides, each side.
const TEXT_PAD = 12;
// The narrowest box, and the widest: past that a name wraps, and past two lines it is cut.
export const MIN_BOX_W = 126;
export const MAX_BOX_W = 256;
// A name that fits one line in a box up to this wide stays on one line; a longer one is set on
// two. Wide enough that a three-word title ("Android Notifications Worker") stays on one line.
const ONE_LINE_BOX_W = 240;
// The widths a box can be: the least that holds its words, rounded up to the next step, so a
// column of similar names comes out one width rather than ragged. Calibrated on the reference
// designs: nearly every box lands on one of the first three steps; the last is MAX_BOX_W.
export const BOX_W_STEPS = [MIN_BOX_W, 176, 240, MAX_BOX_W];
const ELLIPSIS = "…";
const NARROW = new Set([..."iIljl.,:;|!'`"]);
const SLIM = new Set([..."ftr()[]{}-/ "]);
const WIDE = new Set([..."mwMW@%"]);

function emOf(ch) {
  if (NARROW.has(ch)) return 0.28;
  if (SLIM.has(ch)) return 0.36;
  if (WIDE.has(ch)) return 0.86;
  if (/[A-Z]/.test(ch)) return 0.68;
  if (/[0-9]/.test(ch)) return 0.58;
  if (/[a-z]/.test(ch)) return 0.56;
  return 0.64;
}

/** The estimated width, in px, of `text` in the sans face at `px`. */
export function textWidth(text, px = NAME_FONT) {
  let em = 0;
  for (const ch of String(text)) em += emOf(ch);
  // 4% over: against the browser's own measure of every component name in the catalogue the
  // table alone comes out between 7% under and 11% over, so this keeps short names from spilling.
  return em * px * 1.04;
}

const words = (text) => String(text).split(/\s+/).filter(Boolean);
const nameWidth = (t) => textWidth(t, NAME_FONT);
const subWidth = (t) => textWidth(t, SUB_FONT);

// Cut `text` to fit `max` px, with an ellipsis, by whichever measure it is given.
function ellipsize(text, max, measure) {
  if (measure(text) <= max) return text;
  const chars = [...String(text)];
  while (chars.length && measure(`${chars.join("").trimEnd()}${ELLIPSIS}`) > max) chars.pop();
  return `${chars.join("").trimEnd()}${ELLIPSIS}`;
}

// Greedy word wrap into at most `lines` lines of `max` px; a word longer than a line is broken
// where it has to be; whatever is left over is ellipsized onto the last line.
function wrap(text, max, lines, measure) {
  const ws = words(text);
  const out = [];
  let line = "";
  let i = 0;
  while (i < ws.length && out.length < lines - 1) {
    const next = line ? `${line} ${ws[i]}` : ws[i];
    if (measure(next) <= max) {
      line = next;
      i++;
      continue;
    }
    if (line) {
      out.push(line);
      line = "";
      continue;
    }
    // One word wider than a whole line: break it at the last character that fits.
    const chars = [...ws[i]];
    let cut = chars.length;
    while (cut > 1 && measure(chars.slice(0, cut).join("")) > max) cut--;
    out.push(chars.slice(0, cut).join(""));
    ws[i] = chars.slice(cut).join("");
  }
  const rest = [line, ...ws.slice(i)].filter(Boolean).join(" ");
  if (rest) out.push(ellipsize(rest, max, measure));
  return out.length ? out : [""];
}

// The two-line split whose longer line is shortest: "Amazon WorkSpaces / Thin Client" rather
// than "Amazon WorkSpaces Thin / Client". Null for a single word. `widest` is that longer line.
function bestSplit(text, measure) {
  const ws = words(text);
  let best = null;
  for (let k = 1; k < ws.length; k++) {
    const lines = [ws.slice(0, k).join(" "), ws.slice(k).join(" ")];
    const widest = Math.max(measure(lines[0]), measure(lines[1]));
    if (!best || widest < best.widest) best = { lines, widest };
  }
  return best;
}

/**
 * How wide a node's box is, from the two lines it shows (nodeLines in document.js): wide enough
 * for the second line on one line and the name on one line when that makes a box no wider than
 * 240px, else on the two lines that need the least width; then rounded up to the next of
 * BOX_W_STEPS (126, 176, 240, 256px), so it is never narrower than 126px nor wider than 256px.
 * The layout sizes every box with this and nothing else.
 */
export function nodeWidth(name, sub) {
  const pad = 2 * TEXT_PAD;
  const one = nameWidth(name) + pad;
  const split = bestSplit(name, nameWidth);
  const needName = one <= ONE_LINE_BOX_W || !split ? one : Math.min(one, split.widest + pad);
  const need = Math.max(needName, subWidth(String(sub ?? "")) + pad);
  return BOX_W_STEPS.find((step) => step >= need) ?? MAX_BOX_W;
}

// A group's caption: 12px, 12px in from the frame's left side, pushed FRAME_ICON_SHIFT further
// right by an icon (the icon and a 6px gap). A frame is at least as wide as its caption plus
// 12px either side, up to CAPTION_MAX; a caption that needs more is set on two lines, each
// CAPTION_LINE apart, and the second is ellipsized if even two are not enough.
export const CAPTION_FONT = 12;
export const CAPTION_PAD = 24;
export const CAPTION_MAX = 360;
export const CAPTION_LINE = 15;
export const FRAME_ICON_SHIFT = 22;

/**
 * A group caption laid out for its frame: the lines it is set on, the least frame width that
 * holds them (a whole number), and how many px taller the label strip is than one line.
 * @returns {{ lines: string[], width: number, extra: number }}
 */
export function frameCaption(text, icon = false) {
  // The export sets a caption in 12px sans; the canvas in 11px mono (canvas.css .frame-label),
  // about 0.62em a character. The frame is sized for whichever is wider.
  const measure = (t) => Math.max(textWidth(t, CAPTION_FONT), [...String(t)].length * 11 * 0.62);
  const room = CAPTION_PAD + (icon ? FRAME_ICON_SHIFT : 0);
  const s = String(text ?? "");
  const one = measure(s) + room;
  if (one <= CAPTION_MAX) return { lines: [s], width: Math.ceil(one), extra: 0 };
  const lines = wrap(s, CAPTION_MAX - room, 2, measure);
  const widest = Math.max(...lines.map(measure));
  return {
    lines,
    width: Math.min(CAPTION_MAX, Math.ceil(widest + room)),
    extra: (lines.length - 1) * CAPTION_LINE,
  };
}

/**
 * Where a node's icon and words go in a box `w` px wide (78 high): the name on one line, or on
 * two when it does not fit one, the second ellipsized if even two are not enough; the second
 * line (the proper name under a label, else the kind) on one line, smaller, ellipsized. With a
 * two-line name the icon is a little smaller and the block sits higher, so it still fits the
 * same box. The canvas and the server render both draw from this, so a node looks the same in
 * both. `title` is the hover text: both lines whole, and the id that is no longer drawn.
 * @returns {{ icon: { y: number, size: number }, name: Array<{ text: string, y: number }>,
 *   comp: { text: string, y: number }, title: string }}
 */
export function nodeText(name, sub, w, id) {
  const inner = Math.max(24, w - 2 * TEXT_PAD);
  let lines = wrap(name, inner, 2, nameWidth);
  if (lines.length === 2) {
    const split = bestSplit(name, nameWidth);
    if (split && split.widest <= inner) lines = split.lines;
  }
  const comp = ellipsize(String(sub ?? ""), inner, subWidth);
  const title = [...new Set([name, sub, id].filter(Boolean))].join(" · ");
  if (lines.length === 1)
    return {
      icon: { y: 11, size: 24 },
      name: [{ text: lines[0], y: 52 }],
      comp: { text: comp, y: 68 },
      title,
    };
  return {
    icon: { y: 6, size: 22 },
    name: [
      { text: lines[0], y: 44 },
      { text: lines[1], y: 59 },
    ],
    comp: { text: comp, y: 73 },
    title,
  };
}
