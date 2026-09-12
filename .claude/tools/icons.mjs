// Incremental icon generation: run after adding kinds or components (node icons.mjs [--force]).
// - writes icons/kinds/<kind>.svg for kinds that have a glyph but no icon
// - writes icons/components/<provider>/<id>.svg for components that have no icon
// Badge: badges-extra.json (id -> provider key) > providers.mjs COMPONENT_PROVIDER > provider-folder default.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as si from "simple-icons";
import { KIND_GLYPHS } from "./kindglyphs.mjs";
import { KIND_GLYPHS_EXTRA } from "./kindglyphs-extra.mjs";
import { pathIsValid } from "./pathcheck.mjs";
import { COMPONENT_PROVIDER, ORIGINAL_BADGES, PROVIDER_SLUG } from "./providers.mjs";
import { roundPath } from "./roundpath.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."),
  ICONS = path.join(REPO, "icons");
const GLYPHS = { ...KIND_GLYPHS, ...KIND_GLYPHS_EXTRA };
const EXTRA = JSON.parse(fs.readFileSync(new URL("./badges-extra.json", import.meta.url), "utf8"));
const FORCE = process.argv.includes("--force");
const bySlug = {};
for (const k of Object.keys(si)) {
  const i = si[k];
  if (i && i.slug) bySlug[i.slug] = i;
}
const OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">';
// The glyph repeats its presentation attributes on an inner <g> as well as on the root, so a
// consumer that inlines the body (a renderer, a sprite sheet) keeps the stroke.
const INNER =
  '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">';
const kindSvg = (b) => `${OPEN}${INNER}${b}</g></svg>
`;
// Round every number in a path. A number that shortens must not merge with the one before it:
// the source relies on '.' or '-' as an implicit separator, and a value that rounds to "0"
// loses that separator, which turns two coordinates into one and makes the path invalid.
// Shorten a mark to fit the budget, but never at the cost of correctness: a rounding that
// merges two coordinates into one is discarded, and the unrounded path is used instead.
const fitPath = (d) => {
  for (const n of [3, 2, 1, 0]) {
    const r = roundPath(d, n);
    if (r && r.length <= 2996 && pathIsValid(r)) return r;
  }
  return d.length <= 2996 && pathIsValid(d) ? d : null;
};
const ORIG = {
  ...ORIGINAL_BADGES,
  oci: {
    hex: "C74634",
    title: "OCI (original neutral mark)",
    path: "M7 5h10a7 7 0 0 1 0 14H7A7 7 0 0 1 7 5zm0 3a4 4 0 0 0 0 8h10a4 4 0 0 0 0-8z",
  },
};
const SLUGS = { ...PROVIDER_SLUG, oci: null };
const providerInfo = {};
for (const [key, slug] of Object.entries(SLUGS)) {
  if (slug === null) {
    const o = ORIG[key];
    if (o) providerInfo[key] = { ...o, source: "original" };
    continue;
  }
  const icon = bySlug[slug];
  if (!icon) continue;
  const d = fitPath(icon.path);
  if (!d) continue;
  providerInfo[key] = { hex: icon.hex, path: d, title: icon.title, source: "simple-icons" };
}
// any badge key named in badges-extra.json that is a simple-icons slug not yet in providers.mjs
for (const key of new Set(Object.values(EXTRA)))
  if (!providerInfo[key] && bySlug[key]) {
    const d = fitPath(bySlug[key].path);
    if (d)
      providerInfo[key] = {
        hex: bySlug[key].hex,
        path: d,
        title: bySlug[key].title,
        source: "simple-icons",
      };
  }
for (const [key, p] of Object.entries(providerInfo)) {
  const f = path.join(ICONS, "providers", `${key}.svg`);
  if (fs.existsSync(f) && !FORCE) continue;
  fs.writeFileSync(
    f,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" role="img" fill="#${p.hex}"><title>${p.title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</title><g fill="#${p.hex}"><path${p.source === "original" ? ' fill-rule="evenodd"' : ""} d="${p.path}"/></g></svg>\n`,
  );
}
const CX = 18.5,
  CY = 18.5,
  R = 4.5,
  HALO = 5.3,
  MARK = 5.4,
  S = (MARK / 24).toFixed(4),
  TX = (CX - MARK / 2).toFixed(2),
  TY = (CY - MARK / 2).toFixed(2);
const markColour = (hex) => {
  const c = (n) => {
    const v = parseInt(hex.substr(n, 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c(0) + 0.7152 * c(2) + 0.0722 * c(4) > 0.45 ? "#111" : "#fff";
};
const badge = (p) =>
  `<g stroke="none"><circle cx="${CX}" cy="${CY}" r="${HALO}" fill="var(--arkore-icon-bg, #fff)"/><circle cx="${CX}" cy="${CY}" r="${R}" fill="#${p.hex}"/><path transform="translate(${TX} ${TY}) scale(${S})" fill="${markColour(p.hex)}"${p.source === "original" ? ' fill-rule="evenodd"' : ""} d="${p.path}"/></g>`;
const DEFAULT_BADGE = {
  aws: "aws",
  azure: "azure",
  gcp: "googlecloud",
  cloudflare: "cloudflare",
  oci: "oci",
  ibm: "ibm",
  alibabacloud: "alibabacloud",
  digitalocean: "digitalocean",
  openstack: "openstack",
  outscale: "outscale",
  k8s: "kubernetes",
  default: null,
};
let kn = 0,
  cn = 0;
const missingGlyph = [],
  noBadge = [];
for (const f of fs.readdirSync(path.join(REPO, "kinds")).filter((f) => f.endsWith(".yaml"))) {
  const k = f.slice(0, -5),
    out = path.join(ICONS, "kinds", `${k}.svg`);
  if (!GLYPHS[k]) {
    missingGlyph.push(k);
    continue;
  }
  if (fs.existsSync(out) && !FORCE) continue;
  fs.writeFileSync(out, kindSvg(GLYPHS[k]));
  kn++;
}
for (const prov of fs.readdirSync(path.join(REPO, "components"))) {
  const dir = path.join(REPO, "components", prov);
  if (!fs.statSync(dir).isDirectory()) continue;
  fs.mkdirSync(path.join(ICONS, "components", prov), { recursive: true });
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"))) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    const id = /^id:\s*"?([^"\n]+)"?/m.exec(src)[1].trim(),
      kind = /^kind:\s*"?([^"\n]+)"?/m.exec(src)[1].trim();
    const out = path.join(ICONS, "components", prov, `${id}.svg`);
    if (fs.existsSync(out) && !FORCE) continue;
    const glyph = GLYPHS[kind];
    if (!glyph) {
      missingGlyph.push(`${kind} (for ${id})`);
      continue;
    }
    const key = EXTRA[id] ?? COMPONENT_PROVIDER[id] ?? DEFAULT_BADGE[prov];
    const p = key ? providerInfo[key] : null;
    if (!p) noBadge.push(id);
    fs.writeFileSync(out, kindSvg(p ? glyph + badge(p) : glyph));
    cn++;
  }
}
console.log(`kind icons written: ${kn}, component icons written: ${cn}`);
if (missingGlyph.length) {
  console.log("MISSING GLYPH:", [...new Set(missingGlyph)].join(", "));
  process.exitCode = 1;
}
if (noBadge.length) console.log("written without badge:", noBadge.join(" "));
