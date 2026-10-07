// Renderers that need no browser: a standalone SVG using the shared layout, and a Mermaid
// flowchart. Everything in the picture comes from the data: nodes are boxes carrying their
// component's icon on one neutral surface, groups are dashed containers,
// edges are arrows, solid for sync and dashed for async.

import { groupCaption, groupTitle, nodeCount, nodeLines } from "./document.js";
import { drawnLayout } from "./drawn.js";
import {
  AUTH_GLYPH_R,
  authAt,
  edgePath,
  frameCaptions,
  framesOuterFirst,
  framesUnderTint,
  readRouting,
} from "./geometry.js";
import { layout } from "./layout.js";
import { CAPTION_LINE, FRAME_ICON_SHIFT, nodeText } from "./text.js";

// The disc under an auth glyph lives in geometry.js, which places it; re-exported for the same
// callers.
export { AUTH_GLYPH_R } from "./geometry.js";
// The node-text measure lives in text.js, with the box sizing that uses it; re-exported here
// because the canvas and older callers import it from the renderer.
export { CAPTION_LINE, nodeText, nodeWidth, textWidth } from "./text.js";

// A node card is one neutral surface in both themes: colour on a drawing comes only from the
// component's icon, from a group tint the author chose, and from finding badges. These are the
// same values as --node-fill / --node-line in apps/web globals.css.
// fill, stroke (light) | fill, stroke (dark)
const NODE = ["#ffffff", "#d4d4d0", "#1f1f23", "#3a3a40"];

const ICON = 24;

// An edge's `auth` as a glyph on its line, beside the source end (geometry.js `authAt`). The three
// identities a cloud issues carry that cloud's own mark, the catalogue icon of its identity
// component: Azure managed identity, AWS IAM, Google Cloud IAM. Otherwise a shield for an
// identity the platform issues (workload identity), a key for a secret the caller holds, a lock
// for a handshake (certificates, tokens). `none` and no auth draw nothing. Every glyph is a disc
// of the page colour ringed in the edge's colour, so the line breaks under it; inside sits a 10px
// mark: the icon, or a filled shape centred on the origin in its own colour (amber key, slate lock,
// teal shield), one colour for both themes, at least 3:1 on either page colour. A cloud identity
// falls back to the shield where the icon map does not have its icon.
const SHIELD = "M0 -5L4.3 -3.4V0C4.3 2.6 2.5 4.2 0 5.2C-2.5 4.2 -4.3 2.6 -4.3 0V-3.4Z";
// Filled: a ring head (the hole wound the other way), the shaft and two teeth.
const KEY =
  "M-5 0A2.6 2.6 0 1 1 0.2 0A2.6 2.6 0 1 1 -5 0ZM-1.4 0A1 1 0 1 0 -3.4 0A1 1 0 1 0 -1.4 0Z" +
  "M0 -0.8H5V0.8H0ZM3.4 0.8H4.6V2.8H3.4ZM1.6 0.8H2.6V2.2H1.6Z";
// Filled: the body with a keyhole (wound the other way) and a solid shackle.
const LOCK =
  "M-3.8 -0.8H3.8V4.6H-3.8ZM-0.6 1V3H0.6V1Z" +
  "M-3 -0.8V-2A3 3 0 0 1 3 -2V-0.8H1.6V-2A1.6 1.6 0 0 0 -1.6 -2V-0.8Z";
const AMBER = "#c7861a";
const SLATE = "#5b7db1";
const TEAL = "#1a9488";
const AUTH_GLYPHS = {
  "managed-identity": { path: SHIELD, color: TEAL, icon: "azure-managed-identity" },
  "iam-role": { path: SHIELD, color: TEAL, icon: "aws-iam" },
  "service-account": { path: SHIELD, color: TEAL, icon: "google-cloud-iam" },
  "workload-identity": { path: SHIELD, color: TEAL },
  "api-key": { path: KEY, color: AMBER },
  basic: { path: KEY, color: AMBER },
  mtls: { path: LOCK, color: SLATE },
  oauth: { path: LOCK, color: SLATE },
};
// A mark's size in px: the disc less a 2px inset on each side.
const AUTH_MARK = 10;

/**
 * How an edge's `auth` is drawn — `{ path, color, icon? }`: the filled mark and its colour, and the
 * component id whose catalogue icon replaces it where the icon map has one — or null where nothing is drawn (`none`,
 * unset, unknown).
 */
export function authGlyph(auth) {
  return typeof auth === "string" && Object.hasOwn(AUTH_GLYPHS, auth) ? AUTH_GLYPHS[auth] : null;
}

/**
 * The inside of an auth glyph's group, centred on the origin, for the server render and the
 * canvas alike. `mark` is the markup of the glyph's icon in its 24-unit box (the icon body
 * itself, or a `<use>` of a symbol holding it), or null to draw the glyph's own filled mark.
 */
export function authGlyphMarkup(glyph, mark) {
  const disc = `<circle r="${AUTH_GLYPH_R - 0.5}" fill="var(--bg)" stroke="var(--edge)" stroke-width="1"/>`;
  if (!mark) return `${disc}<path d="${glyph.path}" fill="${glyph.color}"/>`;
  const h = AUTH_MARK / 2;
  return (
    disc +
    `<g transform="translate(-${h} -${h}) scale(${+(AUTH_MARK / ICON).toFixed(4)})" color="var(--ink)" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${mark}</g>`
  );
}

// Group tints: a named set, each one stroke colour per theme, or a free `#rrggbb` colour that
// is used as it is in both themes (the trade-off of a free colour). Either way the fill is the
// stroke colour at about 8% so nested groups stay readable. The canvas stylesheet (apps/web
// canvas.css) holds the same named values; the sidecar names one or carries the hex.
// stroke (light) | stroke (dark)
export const TINT = {
  slate: ["#64748b", "#94a3b8"],
  blue: ["#3b82f6", "#60a5fa"],
  green: ["#16a34a", "#4ade80"],
  amber: ["#d97706", "#fbbf24"],
  rose: ["#e11d48", "#fb7185"],
  violet: ["#7c3aed", "#a78bfa"],
  teal: ["#0d9488", "#2dd4bf"],
};
// The fill's alpha byte, appended to a tint's `#rrggbb`. The canvas imports it for hex tints.
export const TINT_FILL_ALPHA = "14";
// A free tint: exactly six hex digits. `#rgb`, an alpha byte, `rgb()` and colour names are refused.
export const HEX_TINT_RE = /^#[0-9a-fA-F]{6}$/;

// How strongly a tint fills what it colours. `normal` is TINT_FILL_ALPHA (about 8%), drawn by the
// [data-tint] rules as it always was. `light` halves it and `bold` doubles it; bold stops there so
// a node's text and a group's members stay readable on the dark page. The stroke never changes.
export const TINT_STRENGTHS = ["light", "normal", "bold"];
const STRENGTH_OPACITY = { light: 0.04, bold: 0.16 };

/** A stored tint as drawn: a known name, or `#rrggbb` lowercased; anything else is null. */
export function readTint(v) {
  if (typeof v !== "string") return null;
  if (Object.hasOwn(TINT, v)) return v;
  return HEX_TINT_RE.test(v) ? v.toLowerCase() : null;
}

/** A stored strength: `light` or `bold`; `normal`, absent and anything else are null. */
export function readStrength(v) {
  return v === "light" || v === "bold" ? v : null;
}

/**
 * A tint's colour and fill opacity at a strength, as `{ color, opacity }`: the colour is the
 * hex itself or the named tint's token (`var(--tint-<name>)`), the opacity is normal's
 * TINT_FILL_ALPHA as a number unless light or bold say otherwise. Null for no tint. The canvas
 * draws a tinted component and a tint's strength from this.
 */
export function tintFill(tint, strength) {
  const t = readTint(tint);
  if (!t) return null;
  const color = t.startsWith("#") ? t : `var(--tint-${t})`;
  const a = STRENGTH_OPACITY[readStrength(strength)];
  return {
    color,
    opacity: a ?? Math.round((Number.parseInt(TINT_FILL_ALPHA, 16) / 255) * 1000) / 1000,
    strength: a === undefined ? null : readStrength(strength),
  };
}

/**
 * How a tint paints a shape, as `{ data, style }`: the `data-tint` value ("hex" for a free
 * colour) and an inline style or null. A named tint at normal strength needs no inline style,
 * the [data-tint] rules draw it in either theme; a hex tint carries its colour inline, and a
 * light or bold strength sets the fill to the stroke colour at its own opacity.
 */
export function tintPaint(tint, strength) {
  const t = readTint(tint);
  if (!t) return null;
  const a = STRENGTH_OPACITY[readStrength(strength)];
  const hex = t.startsWith("#");
  const color = hex ? t : `var(--tint-${t})`;
  if (a !== undefined)
    return { data: hex ? "hex" : t, style: `stroke:${color};fill:${color};fill-opacity:${a}` };
  return hex
    ? { data: "hex", style: `stroke:${t};fill:${t}${TINT_FILL_ALPHA}` }
    : { data: t, style: null };
}

const paintAttrs = (p) =>
  !p ? "" : ` data-tint="${p.data}"${p.style ? ` style="${p.style}"` : ""}`;

/**
 * An icon drawn before a group label is a reference: `kind:<id>`, `component:<p>/<id>` or
 * `boundary:<id>` (icons/boundaries/<id>.svg, a brand or concept mark kept apart from the rest).
 * The user-facing word is group; boundary stays in the stored format.
 */
export const FRAME_ICON_RE =
  /^(kind:[a-z0-9-]+|boundary:[a-z0-9]+(?:-[a-z0-9]+)*|component:[a-z0-9-]+\/[a-z0-9-]+)$/;
const FRAME_ICON = 16;

// How far a group's words move right to make room for its icon (the icon and a 6px gap) lives in
// text.js with the caption measure that uses it; re-exported here for the canvas.
export { FRAME_ICON_SHIFT };

/** The key an icon reference has in an icon map keyed like icons.json, or null. */
export function frameIconKey(ref) {
  if (typeof ref !== "string" || ref.length > 120 || !FRAME_ICON_RE.test(ref)) return null;
  return ref.startsWith("component:") ? ref.slice(ref.indexOf("/") + 1) : ref;
}

// A node that stands for N identical copies (nodeCount in document.js) is drawn as a stack: two
// cards behind its box, each STACK_STEP px further right and up, and a chip at the box's
// top-right corner reading ×N. The stack is decoration only: the layout box, the edges' ends,
// the frames and the canvas's hit areas are the front card alone. The server render and the
// canvas both draw it from stackDecor, so the two cannot disagree.
export const STACK_STEP = 6;
// The cards' opacity, farthest first.
export const STACK_OPACITY = [0.45, 0.7];
const CHIP_FONT = 11;
const CHIP_H = 16;
// The monospace face's advance, about 0.62em a character (as frameCaption measures the canvas's).
const MONO_EM = 0.62;
export const MONO_FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/**
 * The stack drawn behind a box `w` x `h` standing for `count` copies, in the box's own
 * coordinates (its top-left corner is 0,0), or null when `count` is not an integer of 2 or more.
 * `cards` is farthest first: draw them in order, then the box. `chip` is the ×N label's pill and
 * where its text sits (centred on `tx`, baseline `ty`); it is as wide as its text, so ×1000 is
 * written out rather than cut.
 */
export function stackDecor(w, h, count) {
  if (!Number.isInteger(count) || count < 2) return null;
  const cards = STACK_OPACITY.map((opacity, k) => {
    const step = (STACK_OPACITY.length - k) * STACK_STEP;
    return { x: step, y: -step, w, h, opacity };
  });
  const text = `×${count}`;
  const cw = Math.ceil([...text].length * CHIP_FONT * MONO_EM) + 12;
  // Above the box's top edge, clear of the findings dot (centred 10px in from the corner).
  const x = w - cw - 8;
  const y = -10;
  return {
    cards,
    chip: {
      x,
      y,
      w: cw,
      h: CHIP_H,
      rx: CHIP_H / 2,
      text,
      tx: x + cw / 2,
      ty: y + 12,
      size: CHIP_FONT,
    },
  };
}

const tintTokens = (i) =>
  `:root{${Object.entries(TINT)
    .map(([k, v]) => `--tint-${k}:${v[i]};--tint-${k}-fill:${v[i]}${TINT_FILL_ALPHA}`)
    .join(";")}}`;

export const escapeXml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const f1 = (n) => Number(n).toFixed(1);

/**
 * Render a design as SVG text.
 * @param {object} doc          the design
 * @param {object} catalogue    { kinds, components }
 * @param {object} [options]    { icons: { [componentId]: innerSvg }, positions, sizes, bows,
 *                                theme: "auto" | "light" | "dark",
 *                                layout: a saved layout sidecar — { nodes, edges, ports, labels } — which makes
 *                                the picture the one that was drawn rather than an arrangement
 *                                of it. Notes are canvas furniture and are never drawn here.
 *                                frames: { [groupId]: { tint?, icon? } } — how each group is
 *                                drawn; defaults to the sidecar's own `frames`.
 *                                frameIcons: { [iconRef]: innerSvg } — the bodies of the icons
 *                                those styles reference; a reference missing here is looked up
 *                                in `icons` by its icon-map key, and not drawn if absent there.
 *                                background: what the picture sits on. `false` leaves out the page
 *                                rectangle; a `#rrggbb` colour replaces --bg everywhere it is used
 *                                (the page, the label halos, the cut under a tinted group), so a
 *                                thumbnail blends into the card it is drawn on. }
 */
// Catalogue maps are plain objects keyed by ids that come from documents, so a lookup reads own
// keys only: a component called `constructor` or `toString` is unknown, not Object's method.
const own = (o, k) =>
  o != null && typeof k === "string" && Object.hasOwn(o, k) ? o[k] : undefined;

export function toSvg(doc, catalogue, options = {}) {
  const icons = options.icons ?? {};
  const frameIcons = options.frameIcons ?? {};
  // A sidecar with no positions in it says nothing, so it falls back to the automatic layout
  // rather than pinning a whole design at the origin.
  const drawn =
    options.layout &&
    typeof options.layout === "object" &&
    options.layout.nodes &&
    Object.keys(options.layout.nodes).length > 0;
  // How edges are routed: the option, else the sidecar's `routing`, which counts even when the
  // sidecar places nothing.
  const sidecarRouting =
    options.layout && typeof options.layout === "object" ? options.layout.routing : undefined;
  const routing = readRouting(options.routing ?? sidecarRouting);
  const lay = drawn
    ? drawnLayout(doc, catalogue, {
        ...options.layout,
        frames: options.frames ?? options.layout.frames,
        routing,
      })
    : layout(doc, catalogue, { routing, styles: options.frames ?? options.layout?.frames ?? null });
  const [w, h] = lay.canvas;
  const [ox, oy] = lay.origin ?? [0, 0];
  // The drawing keeps its own coordinates: the viewBox moves to them instead of the boxes moving
  // to the viewBox, so what the sidecar holds is what the file says.
  const at = ox || oy ? `x="${ox}" y="${oy}" ` : "";
  const comps = catalogue?.components ?? {};
  const theme = options.theme ?? "auto";
  // Group styles are presentation, so they come from the sidecar and never from the document.
  // Anything that is not an own key naming a known tint, a `#rrggbb` colour or a well-formed icon
  // is ignored. A hex tint comes back lowercased, so the same colour always writes the same bytes.
  const rawStyles =
    options.frames ??
    lay.frameStyles ??
    (options.layout && typeof options.layout === "object" ? options.layout.frames : null);
  const styles = rawStyles && typeof rawStyles === "object" ? rawStyles : {};
  const styleOf = (id) => {
    const st = own(styles, id);
    if (!st || typeof st !== "object") return { tint: null, body: null, paint: null };
    const tint = readTint(st.tint);
    const key = frameIconKey(st.icon);
    const body = key ? (own(frameIcons, st.icon) ?? own(icons, key) ?? null) : null;
    return {
      tint,
      body: typeof body === "string" && body ? body : null,
      paint: tintPaint(tint, st.strength),
    };
  };
  // A component's tint, from the sidecar's `tints` (presentation, never the document).
  const rawTints =
    options.tints ??
    lay.nodeStyles ??
    (options.layout && typeof options.layout === "object" ? options.layout.tints : null);
  const nodeTints = rawTints && typeof rawTints === "object" ? rawTints : {};
  const nodePaint = (id) => {
    const st = own(nodeTints, id);
    return st && typeof st === "object" ? tintPaint(st.tint, st.strength) : null;
  };
  const drawnGroups = (doc.groups ?? []).filter((g) => lay.frames[g.id]);
  const tintedFrames = drawnGroups.some((g) => styleOf(g.id).tint);
  const tinted = tintedFrames || (doc.nodes ?? []).some((n) => nodePaint(n.id));
  const iconed = drawnGroups.some((g) => styleOf(g.id).body);
  const vars = {
    light: `:root{--ink:#1b1b19;--muted:#6b6b66;--edge:#6b6b72;--frame:#b4b4ae;--bg:#ffffff;--node-fill:${NODE[0]};--node-line:${NODE[1]}}`,
    dark: `:root{--ink:#ececea;--muted:#a1a19c;--edge:#a0a0a8;--frame:#55555c;--bg:#17171a;--node-fill:${NODE[2]};--node-line:${NODE[3]}}`,
  };
  let style = "";
  if (theme === "dark") style = vars.dark;
  else if (theme === "light") style = vars.light;
  else style = `${vars.light}@media (prefers-color-scheme: dark){${vars.dark}}`;
  style +=
    ".body{fill:var(--node-fill);stroke:var(--node-line)}" +
    ".n{font-size:14px;font-weight:500;fill:var(--ink)}.c{font-size:11px;fill:var(--muted)}" +
    ".g{font-size:12px;fill:var(--muted)}" +
    ".e{font-size:12px;fill:var(--muted);paint-order:stroke;" +
    "stroke:var(--bg);stroke-width:3px}.ic{color:var(--ink)}";
  // Only a drawing that uses a tint or a group icon carries their styles, so every other
  // picture is byte-for-byte what it was before either existed.
  if (tinted) {
    if (theme === "dark") style += tintTokens(1);
    else if (theme === "light") style += tintTokens(0);
    else style += `${tintTokens(0)}@media (prefers-color-scheme: dark){${tintTokens(1)}}`;
    style += Object.keys(TINT)
      .map((k) => `[data-tint="${k}"]{stroke:var(--tint-${k});fill:var(--tint-${k}-fill)}`)
      .join("");
  }
  if (iconed) style += ".gi{color:var(--muted)}";
  // Only a well-formed colour is written into the style block; anything else is ignored.
  if (typeof options.background === "string" && HEX_TINT_RE.test(options.background))
    style += `:root{--bg:${options.background.toLowerCase()}}`;

  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ox} ${oy} ${w} ${h}" width="${w}" height="${h}" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif">`,
    `<title>${escapeXml(doc.id ?? "design")}</title>`,
    `<style>${style}</style>`,
    // A filled head whose tip lands on the end of the path (refX is the tip), in the edge colour.
    '<defs><marker id="a" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto">' +
      '<path d="M0 0L10 5L0 10z" fill="var(--edge)"/></marker></defs>',
  ];
  if (options.background !== false)
    out.push(`<rect ${at}width="${w}" height="${h}" fill="var(--bg)"/>`);
  // Outer groups first, so a nested one paints over its parent. A tint fills only its own
  // group: every group inside a tinted one lays the page background down first. Without a
  // tint there is nothing to cut, and the picture is what it always was.
  // Each caption as its frame was sized for it, with an icon only where one is drawn.
  const captions = frameCaptions(
    doc,
    catalogue,
    Object.fromEntries(drawnGroups.map((g) => [g.id, { icon: styleOf(g.id).body ? "y" : null }])),
  );
  const cut = tintedFrames
    ? framesUnderTint(drawnGroups, (id) => styleOf(id).tint !== null)
    : new Set();
  for (const g of framesOuterFirst(doc.groups ?? [])) {
    const f = lay.frames[g.id];
    if (!f) continue;
    const { body, paint } = styleOf(g.id);
    // A named tint is a token the style block resolves per theme. A hex tint is its own colour,
    // written inline so the picture needs no rule for it (the design page strips the <style>).
    const dataTint = paintAttrs(paint);
    if (cut.has(g.id))
      out.push(
        `<rect x="${f1(f[0])}" y="${f1(f[1])}" width="${f1(f[2])}" height="${f1(f[3])}" rx="14" fill="var(--bg)"/>`,
      );
    // The frame, its icon and its words in one group whose <title> names it whole: label,
    // kind and id, since the frame itself shows one of them.
    out.push(`<g><title>${escapeXml(groupTitle(catalogue, g))}</title>`);
    out.push(
      `<rect${dataTint} x="${f1(f[0])}" y="${f1(f[1])}" width="${f1(f[2])}" height="${f1(f[3])}" rx="14" fill="none" stroke="var(--frame)" stroke-width="1" stroke-dasharray="6 4"/>`,
    );
    // The icon, when there is one, comes first and pushes the words right.
    const lx = f[0] + 12 + (body ? FRAME_ICON_SHIFT : 0);
    if (body)
      out.push(
        `<svg class="gi" x="${f1(f[0] + 12)}" y="${f1(f[1] + 7)}" width="${FRAME_ICON}" height="${FRAME_ICON}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`,
      );
    // The label, else the kind's name in the same style; the kind id is never drawn. A caption
    // too long for the widest frame is set on two lines (frameCaption in text.js).
    const lines = captions[g.id]?.lines ?? [groupCaption(catalogue, g)];
    const words =
      lines.length === 1
        ? escapeXml(lines[0])
        : lines
            .map(
              (line, k) =>
                `<tspan x="${f1(lx)}" y="${f1(f[1] + 19 + k * CAPTION_LINE)}">${escapeXml(line)}</tspan>`,
            )
            .join("");
    out.push(`<text class="g" x="${f1(lx)}" y="${f1(f[1] + 19)}">${words}</text>`);
    out.push("</g>");
  }
  // Edge shape and label placement come from geometry.js, as on the canvas: a reciprocal or
  // parallel pair is two curves in two lanes, each with its own arrowhead and its label on the
  // outer side of its own curve.
  for (const e of lay.edges) {
    const dash = e.dashed ? ' stroke-dasharray="6 4"' : "";
    if (e.ortho) {
      // Orthogonal: straight runs with rounded corners, as geometry.js spells it.
      out.push(
        `<path d="${edgePath(e)}" fill="none" stroke="var(--edge)" stroke-width="1.4"${dash} marker-end="url(#a)"/>`,
      );
    } else if (e.points.length === 7) {
      // A ported end: two smooth cubics, as geometry.js spells it.
      out.push(
        `<path d="${edgePath(e)}" fill="none" stroke="var(--edge)" stroke-width="1.4"${dash} marker-end="url(#a)"/>`,
      );
    } else if (e.points.length === 3) {
      const [[x1, y1], [cx, cy], [x2, y2]] = e.points;
      out.push(
        `<path d="M${f1(x1)} ${f1(y1)} Q${f1(cx)} ${f1(cy)} ${f1(x2)} ${f1(y2)}" fill="none" stroke="var(--edge)" stroke-width="1.4"${dash} marker-end="url(#a)"/>`,
      );
    } else {
      const [[x1, y1], [x2, y2]] = e.points;
      out.push(
        `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="var(--edge)" stroke-width="1.4"${dash} marker-end="url(#a)"/>`,
      );
    }
    if (e.label)
      out.push(
        `<text class="e" x="${f1(e.labelAt[0])}" y="${f1(e.labelAt[1])}" text-anchor="${e.labelAnchor}">${escapeXml(e.label)}</text>`,
      );
  }
  // Auth glyphs after every edge and label: edges leaving one box run side by side, and a
  // neighbour's label must not paint over the glyph by the source end.
  for (const e of lay.edges) {
    const auth = doc.edges?.[e.i]?.auth;
    const glyph = authGlyph(auth);
    if (!glyph) continue;
    const [gx, gy] = authAt(e);
    // The mark is inlined the way a node's icon is, from the same icon map.
    const mark = glyph.icon ? (own(icons, glyph.icon) ?? null) : null;
    out.push(
      `<g transform="translate(${f1(gx)} ${f1(gy)})"><title>auth: ${escapeXml(auth)}</title>${authGlyphMarkup(glyph, mark)}</g>`,
    );
  }
  for (const n of doc.nodes ?? []) {
    const [x, y] = lay.positions[n.id];
    const [bw, bh] = lay.sizes[n.id];
    const c = own(comps, n.component) ?? {};
    // A custom node is a hole in the model and is drawn as one: dashed border, washed-out fill,
    // as on the canvas. Written on the element so a page that strips the <style> keeps it.
    const hole = c.kind === "custom" ? ' stroke-dasharray="6 4" fill-opacity="0.45"' : "";
    const cx = x + bw / 2;
    // The same two lines the canvas shows (nodeLines), fitted to the box by the same measure,
    // in a group whose <title> carries them whole with the id, which is not drawn.
    const l = nodeLines(catalogue ?? {}, n);
    const t = nodeText(l.name, l.sub, bw, l.id);
    out.push(`<g><title>${escapeXml(t.title)}</title>`);
    // A tinted component: the card stays opaque, and a second rect over it carries the tint's
    // border and faint fill, so the icon and the words above it are drawn exactly as before.
    const paint = nodePaint(n.id);
    const card = (cx0, cy0) => {
      const r = [
        `<rect class="body" x="${cx0}" y="${cy0}" width="${bw}" height="${bh}" rx="12" stroke-width="1"${hole}/>`,
      ];
      if (paint)
        r.push(
          `<rect${paintAttrs(paint)} x="${cx0}" y="${cy0}" width="${bw}" height="${bh}" rx="12" stroke-width="1"${c.kind === "custom" ? ' stroke-dasharray="6 4"' : ""}/>`,
        );
      return r;
    };
    // N identical copies: the stack's cards behind the box, painted like it, a little fainter.
    const stack = stackDecor(bw, bh, nodeCount(doc, n, catalogue));
    if (stack)
      for (const s of stack.cards)
        out.push(`<g class="stack" opacity="${s.opacity}">${card(x + s.x, y + s.y).join("")}</g>`);
    out.push(...card(x, y));
    const body = own(icons, n.component);
    if (body) {
      const scale = t.icon.size === ICON ? "" : ` scale(${t.icon.size / ICON})`;
      out.push(
        `<g class="ic" transform="translate(${f1(cx - t.icon.size / 2)} ${y + t.icon.y})${scale}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</g>`,
      );
    }
    for (const line of t.name)
      out.push(
        `<text class="n" x="${f1(cx)}" y="${y + line.y}" text-anchor="middle">${escapeXml(line.text)}</text>`,
      );
    out.push(
      `<text class="c" x="${f1(cx)}" y="${y + t.comp.y}" text-anchor="middle">${escapeXml(t.comp.text)}</text>`,
    );
    if (stack) {
      const p = stack.chip;
      out.push(
        `<rect class="chip" x="${f1(x + p.x)}" y="${y + p.y}" width="${p.w}" height="${p.h}" rx="${p.rx}" fill="var(--bg)" stroke="var(--node-line)" stroke-width="1"/>`,
        `<text class="chip-t" x="${f1(x + p.tx)}" y="${y + p.ty}" text-anchor="middle" font-family="${MONO_FONT}" font-size="${p.size}" fill="var(--muted)">${escapeXml(p.text)}</text>`,
      );
    }
    out.push("</g>");
  }
  out.push("</svg>");
  return `${out.join("\n")}\n`;
}

const mid = (s) => `n_${String(s).replace(/[^A-Za-z0-9]/g, "_")}`;
const mesc = (s) => String(s).replace(/"/g, "'").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Render a design as a Mermaid flowchart. Groups are subgraphs, sync solid, async dotted. Given
 * the catalogue, a node reads as its box does: the name over the proper name or the kind.
 * @param {any} doc
 * @param {string} [direction]
 * @param {any} [catalogue]
 */
export function toMermaid(doc, direction = "TD", catalogue = null) {
  const groups = doc.groups ?? [];
  const children = new Map();
  for (const g of groups) {
    const k = g.parent ?? null;
    if (!children.has(k)) children.set(k, []);
    children.get(k).push(g);
  }
  const members = new Map();
  for (const n of doc.nodes ?? []) {
    const k = n.group ?? null;
    if (!members.has(k)) members.set(k, []);
    members.get(k).push(n);
  }
  const out = [`flowchart ${direction}`];
  // The two lines the drawing shows; without a catalogue, the label or id over the component.
  const nodeLine = (n, ind) => {
    const l = catalogue
      ? nodeLines(catalogue, n)
      : { name: n.label || n.id, sub: n.component ?? "" };
    const sub = l.sub ? `<br/><i>${mesc(l.sub)}</i>` : "";
    // N identical copies read as the drawing's chip does: the name, then ×N.
    const count = catalogue ? nodeCount(doc, n, catalogue) : null;
    const name = count ? `${l.name} ×${count}` : l.name;
    out.push(`${ind}${mid(n.id)}["${mesc(name)}${sub}"]`);
  };
  const emitGroup = (g, depth) => {
    const ind = "  ".repeat(depth);
    out.push(`${ind}subgraph ${mid(`g_${g.id}`)}["${mesc(groupCaption(catalogue, g))}"]`);
    for (const n of members.get(g.id) ?? []) nodeLine(n, `${ind}  `);
    for (const c of children.get(g.id) ?? []) emitGroup(c, depth + 1);
    out.push(`${ind}end`);
  };
  for (const n of members.get(null) ?? []) nodeLine(n, "  ");
  for (const g of children.get(null) ?? []) emitGroup(g, 1);
  // An end naming a group (and no node) is the group's subgraph.
  const nodeIds = new Set((doc.nodes ?? []).map((n) => n.id));
  const groupIds = new Set(groups.map((g) => g.id));
  const end = (id) => mid(!nodeIds.has(id) && groupIds.has(id) ? `g_${id}` : id);
  for (const e of doc.edges ?? []) {
    const meta = e.protocol + (e.delivery ? `, ${e.delivery}` : "");
    const text = e.label ? `${e.label} [${meta}]` : meta;
    const lab = mesc(e.auth ? `${text} [${e.auth}]` : text);
    const arrow = e.mode === "sync" ? "-->" : "-.->";
    out.push(`  ${end(e.from)} ${arrow}|"${lab}"| ${end(e.to)}`);
  }
  return out.join("\n");
}
