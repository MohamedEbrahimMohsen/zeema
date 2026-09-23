// Renderers that need no browser: a standalone SVG using the shared layout, and a Mermaid
// flowchart. Everything in the picture comes from the data: nodes are boxes carrying their
// component's icon and coloured by the category of their kind, groups are dashed containers,
// edges are arrows, solid for sync and dashed for async.

import { drawnLayout } from "./drawn.js";
import { layout } from "./layout.js";

const CATEGORY_HUE = {
  compute: "blue",
  edge: "teal",
  data: "amber",
  ops: "violet",
  security: "purple",
  messaging: "green",
  client: "rose",
  external: "red",
  // Untyped, so uncoloured: a custom node is a hole, and it should look like one.
  custom: "grey",
};

// fill, stroke (light) | fill, stroke (dark)
export const PALETTE = {
  blue: ["#eaf1fd", "#9cc0f0", "#1b2a3f", "#3f6698"],
  teal: ["#e6f5f2", "#8fcfc2", "#152e2b", "#3c7d72"],
  amber: ["#fbf1e0", "#dcb473", "#33280f", "#8a6a2b"],
  violet: ["#f0edfc", "#b6a8ee", "#241f3d", "#5b4f9c"],
  purple: ["#f6ecf9", "#cda3dc", "#2d1c34", "#7a4d8c"],
  green: ["#e9f5ea", "#96c99b", "#162b18", "#417a47"],
  rose: ["#fceceb", "#e5a7a1", "#33191a", "#8f4c48"],
  red: ["#fbe9e9", "#e09b98", "#341a1a", "#8d4340"],
  grey: ["#f0f0ef", "#c2c2bf", "#26262a", "#5a5a60"],
};

const ICON = 24;

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
 *                                layout: a saved layout sidecar — { nodes, edges } — which makes
 *                                the picture the one that was drawn rather than an arrangement
 *                                of it. Notes are canvas furniture and are never drawn here. }
 */
// Catalogue maps are plain objects keyed by ids that come from documents, so a lookup reads own
// keys only: a component called `constructor` or `toString` is unknown, not Object's method.
const own = (o, k) =>
  o != null && typeof k === "string" && Object.hasOwn(o, k) ? o[k] : undefined;

export function toSvg(doc, catalogue, options = {}) {
  const icons = options.icons ?? {};
  // A sidecar with no positions in it says nothing, so it falls back to the automatic layout
  // rather than pinning a whole design at the origin.
  const drawn =
    options.layout &&
    typeof options.layout === "object" &&
    options.layout.nodes &&
    Object.keys(options.layout.nodes).length > 0;
  const lay = drawn ? drawnLayout(doc, catalogue, options.layout) : layout(doc, catalogue);
  const [w, h] = lay.canvas;
  const [ox, oy] = lay.origin ?? [0, 0];
  // The drawing keeps its own coordinates: the viewBox moves to them instead of the boxes moving
  // to the viewBox, so what the sidecar holds is what the file says.
  const at = ox || oy ? `x="${ox}" y="${oy}" ` : "";
  const kinds = catalogue?.kinds ?? {};
  const comps = catalogue?.components ?? {};
  const theme = options.theme ?? "auto";
  const light = Object.entries(PALETTE)
    .map(([k, v]) => `.f-${k}{fill:${v[0]};stroke:${v[1]}}`)
    .join("");
  const dark = Object.entries(PALETTE)
    .map(([k, v]) => `.f-${k}{fill:${v[2]};stroke:${v[3]}}`)
    .join("");
  const vars = {
    light: ":root{--ink:#1b1b19;--muted:#6b6b66;--line:#8a8a85;--frame:#b4b4ae;--bg:#ffffff}",
    dark: ":root{--ink:#ececea;--muted:#a1a19c;--line:#7e7e88;--frame:#55555c;--bg:#17171a}",
  };
  let style = "";
  if (theme === "dark") style = vars.dark + dark;
  else if (theme === "light") style = vars.light + light;
  else style = `${vars.light}@media (prefers-color-scheme: dark){${vars.dark}${dark}}${light}`;
  style +=
    ".n{font-size:14px;font-weight:500;fill:var(--ink)}.c{font-size:12px;fill:var(--muted)}" +
    ".g{font-size:12px;fill:var(--muted)}" +
    ".gk{font-size:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;fill:var(--muted);opacity:0.75}" +
    ".e{font-size:12px;fill:var(--muted);paint-order:stroke;" +
    "stroke:var(--bg);stroke-width:3px}.ic{color:var(--ink)}";

  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ox} ${oy} ${w} ${h}" width="${w}" height="${h}" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif">`,
    `<title>${escapeXml(doc.id ?? "design")}</title>`,
    `<style>${style}</style>`,
    '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">' +
      '<path d="M1 1L9 5L1 9" fill="none" stroke="var(--line)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>',
    `<rect ${at}width="${w}" height="${h}" fill="var(--bg)"/>`,
  ];
  for (const g of doc.groups ?? []) {
    const f = lay.frames[g.id];
    if (!f) continue;
    out.push(
      `<rect x="${f1(f[0])}" y="${f1(f[1])}" width="${f1(f[2])}" height="${f1(f[3])}" rx="10" fill="none" stroke="var(--frame)" stroke-width="1" stroke-dasharray="5 4"/>`,
    );
    // The name, then the kind as a tag beside it — never "name (kind)". With no label the id
    // stands in; when that caption would only repeat the kind, the tag alone carries it.
    const caption = g.label ? String(g.label) : String(g.id);
    const name = caption === g.kind ? "" : caption;
    if (name)
      out.push(
        `<text class="g" x="${f1(f[0] + 12)}" y="${f1(f[1] + 19)}">${escapeXml(name)}</text>`,
      );
    out.push(
      `<text class="gk" x="${f1(f[0] + 12 + (name ? name.length * 6.4 + 8 : 0))}" y="${f1(f[1] + 19)}">${escapeXml(g.kind)}</text>`,
    );
  }
  // Edge shape and label placement come from geometry.js, as on the canvas: a reciprocal or
  // parallel pair is two curves in two lanes, each with its own arrowhead and its label on the
  // outer side of its own curve.
  for (const e of lay.edges) {
    const dash = e.dashed ? ' stroke-dasharray="6 4"' : "";
    if (e.points.length === 3) {
      const [[x1, y1], [cx, cy], [x2, y2]] = e.points;
      out.push(
        `<path d="M${f1(x1)} ${f1(y1)} Q${f1(cx)} ${f1(cy)} ${f1(x2)} ${f1(y2)}" fill="none" stroke="var(--line)" stroke-width="1.2"${dash} marker-end="url(#a)"/>`,
      );
    } else {
      const [[x1, y1], [x2, y2]] = e.points;
      out.push(
        `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="var(--line)" stroke-width="1.2"${dash} marker-end="url(#a)"/>`,
      );
    }
    if (e.label)
      out.push(
        `<text class="e" x="${f1(e.labelAt[0])}" y="${f1(e.labelAt[1])}" text-anchor="${e.labelAnchor}">${escapeXml(e.label)}</text>`,
      );
  }
  for (const n of doc.nodes ?? []) {
    const [x, y] = lay.positions[n.id];
    const [bw, bh] = lay.sizes[n.id];
    const c = own(comps, n.component) ?? {};
    const hue = own(CATEGORY_HUE, own(kinds, c.kind)?.category) ?? "grey";
    const cx = x + bw / 2;
    out.push(
      `<rect class="f-${hue}" x="${x}" y="${y}" width="${bw}" height="${bh}" rx="8" stroke-width="1"/>`,
    );
    const body = own(icons, n.component);
    if (body)
      out.push(
        `<g class="ic" transform="translate(${f1(cx - ICON / 2)} ${y + 11})" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</g>`,
      );
    const text = n.label ? String(n.label) : n.id;
    out.push(
      `<text class="n" x="${f1(cx)}" y="${y + 52}" text-anchor="middle">${escapeXml(text)}</text>`,
    );
    out.push(
      `<text class="c" x="${f1(cx)}" y="${y + 68}" text-anchor="middle">${escapeXml(n.component)}</text>`,
    );
  }
  out.push("</svg>");
  return `${out.join("\n")}\n`;
}

const mid = (s) => `n_${String(s).replace(/[^A-Za-z0-9]/g, "_")}`;
const mesc = (s) => String(s).replace(/"/g, "'").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Render a design as a Mermaid flowchart. Groups are subgraphs, sync solid, async dotted. */
export function toMermaid(doc, direction = "TD") {
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
  const nodeLine = (n, ind) =>
    out.push(`${ind}${mid(n.id)}["${mesc(n.label || n.id)}<br/><i>${mesc(n.component)}</i>"]`);
  const emitGroup = (g, depth) => {
    const ind = "  ".repeat(depth);
    out.push(`${ind}subgraph ${mid(`g_${g.id}`)}["${mesc(g.label || g.id)} (${mesc(g.kind)})"]`);
    for (const n of members.get(g.id) ?? []) nodeLine(n, `${ind}  `);
    for (const c of children.get(g.id) ?? []) emitGroup(c, depth + 1);
    out.push(`${ind}end`);
  };
  for (const n of members.get(null) ?? []) nodeLine(n, "  ");
  for (const g of children.get(null) ?? []) emitGroup(g, 1);
  for (const e of doc.edges ?? []) {
    const meta = e.protocol + (e.delivery ? `, ${e.delivery}` : "");
    const lab = mesc(e.label ? `${e.label} [${meta}]` : meta);
    const arrow = e.mode === "sync" ? "-->" : "-.->";
    out.push(`  ${mid(e.from)} ${arrow}|"${lab}"| ${mid(e.to)}`);
  }
  return out.join("\n");
}
