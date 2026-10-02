// Fit a vendor's own product icon into the repository's 24-unit icon contract and install it as
// icons/components/<provider>/<id>.svg. This is the k8s converter generalised to every vendor
// pack: it reuses the rewriter in ../k8s-icons/lib.mjs (viewBox fitting, gradient href inlining,
// id namespacing, path-precision reduction) and only adds the pre-cleaning each pack needs.
//
//   node .claude/tools/vendor-icons/fit.mjs <map.json> [--src <dir>] [--dry]
//
// map.json is { "<provider>": { "<component-id>": "<path to the source .svg>" } }. Paths are
// absolute, or relative to --src when given and to the map file otherwise. Keys that start with
// "_" are notes, not providers, except "_colour": a hex that monochrome artwork is painted in
// instead of currentColor, for a vendor whose single colour is the brand (Cloudflare orange). Nothing is written for a component that is absent from
// the map, and no marker comment is written, so `icons.mjs --force` leaves these files alone.
//
// A source is refused rather than degraded when it carries a raster, a script, an event handler
// or an external reference, or when it is still over 4 KB at the loosest precision the drawing
// survives. Refusals are listed in the report so the component can keep its badge.
import fs from "node:fs";
import path from "node:path";
import { build, LIMIT } from "../k8s-icons/lib.mjs";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const ROOT = path.resolve(here, "../../..");
const BANNED = /<script|\son[a-z]+\s*=|<image\b|href\s*=|<foreignObject/i;
const RASTER = /<image\b|data:image\//i;

// A pack may put its colours in a stylesheet (`<style>.cls-1{fill:#4285f4}</style>` plus
// class="cls-1", which every Google and many AWS files do) rather than on the element. Those
// class names are as global as ids once the icon is inlined into a page next to 1,800 others, so
// the rules are resolved onto the elements and the stylesheet dropped rather than renamed.
const PROPS = ["fill", "fill-opacity", "fill-rule", "opacity", "stroke", "stroke-width",
  "stroke-opacity", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit"];

const inlineStyleRules = (raw) => {
  const rules = new Map();
  const body = raw.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => {
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const decls = {};
      for (const d of m[2].split(";")) {
        const i = d.indexOf(":");
        if (i < 0) continue;
        const k = d.slice(0, i).trim().toLowerCase();
        const v = d.slice(i + 1).trim();
        if (PROPS.includes(k) && v) decls[k] = v;
      }
      if (!Object.keys(decls).length) continue;
      for (const sel of m[1].split(",")) {
        const s = sel.trim();
        if (/^\.[\w-]+$/.test(s)) {
          const name = s.slice(1);
          rules.set(name, { ...(rules.get(name) || {}), ...decls });
        }
      }
    }
    return "";
  });
  if (!rules.size) return body.replace(/<defs[^>]*>\s*<\/defs>/gi, "");
  return body
    .replace(/<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g, (whole, tag, attrs, slash) => {
      const cls = /\sclass\s*=\s*"([^"]*)"/i.exec(attrs);
      if (!cls) return whole;
      let kept = attrs.replace(/\sclass\s*=\s*"[^"]*"/i, "");
      const decls = {};
      for (const name of cls[1].split(/\s+/)) Object.assign(decls, rules.get(name) || {});
      for (const [k, v] of Object.entries(decls))
        if (!new RegExp(`\\s${k}\\s*=`, "i").test(kept)) kept += ` ${k}="${v}"`;
      return `<${tag}${kept}${slash}>`;
    })
    .replace(/<defs[^>]*>\s*<\/defs>/gi, "");
};

// Editor leftovers: Inkscape/Illustrator namespaces, named views, and colours parked in a style
// attribute where the rewriter cannot see them.
const pre = (raw) =>
  inlineStyleRules(
    raw
      .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
      .replace(/<sodipodi:namedview[\s\S]*?(\/>|<\/sodipodi:namedview>)/gi, "")
      .replace(/\s(?:inkscape|sodipodi|xmlns:(?:inkscape|sodipodi|dc|cc|rdf|svg|serif)):?[\w-]*="[^"]*"/g, "")
      .replace(/\s(?:id|data-name)\s*=\s*"(?:Layer|layer|Artwork|Capa|Calque)[^"]*"/g, ""),
  )
    .replace(/\sstyle="([^"]*)"/g, (_, css) => {
      const out = [];
      for (const k of PROPS) {
        const m = new RegExp(`(?:^|;)\\s*${k}\\s*:\\s*([^;]+)`, "i").exec(css);
        if (m) out.push(` ${k}="${m[1].trim()}"`);
      }
      return out.join("");
    })
    .replace(/<defs[^>]*\/>/gi, "")
    .replace(/<defs[^>]*>\s*<\/defs>/gi, "");

// ---------- transform flattening
//
// Oracle's diagram SVGs wrap every shape in its own <g transform="translate(...) scale(sx sy)">
// and keep the coordinates in a 0..100 tracing space. The rewriter in lib.mjs only unwraps a
// group whose children are plain paths, so those files arrive at the budget check still carrying
// seven wrappers and five-character numbers. Baking the transform into the coordinates removes
// the wrappers and shortens every number, which is what brings the heaviest of them under 4 KB.

const ARITY = { M: 2, L: 2, T: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, A: 7, Z: 0 };

const scan = (d) => {
  const segs = [];
  let i = 0;
  const ws = () => {
    while (i < d.length && " ,\n\r\t".includes(d[i])) i++;
  };
  const num = () => {
    ws();
    const s = i;
    if (d[i] === "+" || d[i] === "-") i++;
    while (d[i] >= "0" && d[i] <= "9") i++;
    if (d[i] === ".") {
      i++;
      while (d[i] >= "0" && d[i] <= "9") i++;
    }
    if (d[i] === "e" || d[i] === "E") {
      i++;
      if (d[i] === "+" || d[i] === "-") i++;
      while (d[i] >= "0" && d[i] <= "9") i++;
    }
    if (i === s) return null;
    const v = Number(d.slice(s, i));
    return Number.isFinite(v) ? v : null;
  };
  const flag = () => {
    ws();
    return d[i] === "0" || d[i] === "1" ? Number(d[i++]) : null;
  };
  let cmd = null;
  ws();
  while (i < d.length) {
    if (/[A-Za-z]/.test(d[i])) {
      cmd = d[i++];
      if (ARITY[cmd.toUpperCase()] === undefined) return null;
      if (cmd.toUpperCase() === "Z") {
        segs.push({ cmd, args: [] });
        cmd = null;
        ws();
        continue;
      }
    } else if (cmd === null) return null;
    const up = cmd.toUpperCase();
    const args = [];
    for (let k = 0; k < ARITY[up]; k++) {
      const v = up === "A" && (k === 3 || k === 4) ? flag() : num();
      if (v === null) return null;
      args.push(v);
    }
    segs.push({ cmd, args });
    if (up === "M") cmd = cmd === "M" ? "L" : "l";
    ws();
  }
  return segs.length ? segs : null;
};

// Absolute-ise, apply x' = sx*x + tx, y' = sy*y + ty, and emit absolute commands. A rotation or a
// skew is refused, and so is an arc under a non-uniform scale, because its radii would need an
// ellipse rotation this does not compute.
const affinePath = (d, tx, ty, sx, sy) => {
  const segs = scan(d);
  if (!segs) return null;
  const f = (v) => String(Number(v.toFixed(5)));
  let cx = 0;
  let cy = 0;
  let sxp = 0;
  let syp = 0;
  const out = [];
  for (const seg of segs) {
    const up = seg.cmd.toUpperCase();
    const rel = seg.cmd !== up;
    if (up === "Z") {
      out.push("Z");
      cx = sxp;
      cy = syp;
      continue;
    }
    if (up === "A" && sx !== sy) return null;
    const a = seg.args.slice();
    if (rel) {
      if (up === "H") a[0] += cx;
      else if (up === "V") a[0] += cy;
      else if (up === "A") {
        a[5] += cx;
        a[6] += cy;
      } else for (let k = 0; k < a.length; k++) a[k] += k % 2 === 0 ? cx : cy;
    }
    if (up === "H") {
      out.push("H" + f(a[0] * sx + tx));
      cx = a[0];
    } else if (up === "V") {
      out.push("V" + f(a[0] * sy + ty));
      cy = a[0];
    } else if (up === "A") {
      out.push(
        "A" + [f(a[0] * sx), f(a[1] * sx), f(a[2]), a[3], a[4], f(a[5] * sx + tx), f(a[6] * sy + ty)].join(" "),
      );
      cx = a[5];
      cy = a[6];
    } else {
      const n = [];
      for (let k = 0; k < a.length; k += 2) n.push(f(a[k] * sx + tx), f(a[k + 1] * sy + ty));
      out.push(up + n.join(" "));
      cx = a[a.length - 2];
      cy = a[a.length - 1];
    }
    if (up === "M") {
      sxp = cx;
      syp = cy;
    }
  }
  return out.join("");
};

const parseTransform = (t) => {
  let tx = 0;
  let ty = 0;
  let sx = 1;
  let sy = 1;
  const re = /(translate|scale|matrix)\s*\(([^)]*)\)/gi;
  let m;
  let seen = 0;
  while ((m = re.exec(t))) {
    seen++;
    const n = m[2].trim().split(/[\s,]+/).map(Number);
    if (n.some((v) => !Number.isFinite(v))) return null;
    if (m[1].toLowerCase() === "translate") {
      tx += sx * n[0];
      ty += sy * (n[1] ?? 0);
    } else if (m[1].toLowerCase() === "scale") {
      sx *= n[0];
      sy *= n[1] ?? n[0];
    } else {
      if (n.length !== 6 || n[1] !== 0 || n[2] !== 0) return null;
      tx += sx * n[4];
      ty += sy * n[5];
      sx *= n[0];
      sy *= n[3];
    }
  }
  if (!seen) return null;
  if (t.replace(re, "").trim()) return null; // rotate/skew left over
  return { tx, ty, sx, sy };
};

// Innermost first, so a nest of wrappers collapses one layer per pass.
const flattenNested = (body) => {
  const re = /<g\s+transform="([^"]*)"\s*>((?:(?!<g\b)[\s\S])*?)<\/g>/gi;
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    body = body.replace(re, (whole, t, inner) => {
      const a = parseTransform(t);
      if (!a) return whole;
      if (/<(rect|circle|ellipse|line|polygon|polyline|text|use|image)\b/i.test(inner)) return whole;
      if (!/<path\b/i.test(inner.trim()) && inner.trim()) return whole;
      let failed = false;
      const next = inner.replace(/\sd="([^"]*)"/gi, (w, d) => {
        const moved = affinePath(d, a.tx, a.ty, a.sx, a.sy);
        if (moved === null) {
          failed = true;
          return w;
        }
        return ` d="${moved}"`;
      });
      if (failed) return whole;
      changed = true;
      return next;
    });
    if (!changed) break;
  }
  return body;
};

// A few of Oracle's icons are traced on a 100x100 grid and spend hundreds of curve segments on
// detail that is a fraction of a pixel once the drawing is 24 px wide. Dropping a segment whose
// endpoint lands within `eps` of the point the pen is already at removes that detail and nothing
// else; it is only reached when the icon is over the 4 KB budget at every precision.
const decimatePath = (d, eps) => {
  const segs = scan(d);
  if (!segs) return null;
  const f = (v) => String(Number(v.toFixed(4)));
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let px = 0; // last point actually emitted
  let py = 0;
  let pending = false;
  const out = [];
  const emit = (up, abs) => {
    if (up === "H") out.push("H" + f(abs[0]));
    else if (up === "V") out.push("V" + f(abs[0]));
    else if (up === "A")
      out.push("A" + [f(abs[0]), f(abs[1]), f(abs[2]), abs[3], abs[4], f(abs[5]), f(abs[6])].join(" "));
    else out.push(up + abs.map(f).join(" "));
  };
  for (const seg of segs) {
    const up = seg.cmd.toUpperCase();
    const rel = seg.cmd !== up;
    if (up === "Z") {
      if (pending && Math.hypot(cx - px, cy - py) > 1e-6) {
        emit("L", [cx, cy]);
        px = cx;
        py = cy;
      }
      pending = false;
      out.push("Z");
      cx = sx;
      cy = sy;
      px = cx;
      py = cy;
      continue;
    }
    const a = seg.args.slice();
    if (rel) {
      if (up === "H") a[0] += cx;
      else if (up === "V") a[0] += cy;
      else if (up === "A") {
        a[5] += cx;
        a[6] += cy;
      } else for (let k = 0; k < a.length; k++) a[k] += k % 2 === 0 ? cx : cy;
    }
    const ex = up === "H" ? a[0] : up === "V" ? cx : up === "A" ? a[5] : a[a.length - 2];
    const ey = up === "V" ? a[0] : up === "H" ? cy : up === "A" ? a[6] : a[a.length - 1];
    cx = up === "H" ? a[0] : up === "V" ? cx : ex;
    cy = up === "V" ? a[0] : up === "H" ? cy : ey;
    if (up === "M") {
      emit("M", [cx, cy]);
      px = sx = cx;
      py = sy = cy;
      pending = false;
      continue;
    }
    if (Math.hypot(cx - px, cy - py) < eps) {
      pending = true;
      continue;
    }
    emit(up, a);
    px = cx;
    py = cy;
    pending = false;
  }
  return out.join("");
};

const decimate = (raw, eps) =>
  raw.replace(/\sd="([^"]*)"/gi, (w, d) => {
    const out = decimatePath(d, eps);
    return out === null ? w : ` d="${out}"`;
  });

const preFlatten = (raw) => {
  const open = /<svg\b[^>]*>/i.exec(raw);
  if (!open) return raw;
  const end = raw.lastIndexOf("</svg>");
  if (end < 0) return raw;
  const head = raw.slice(0, open.index + open[0].length);
  const body = raw.slice(open.index + open[0].length, end);
  return head + flattenNested(body) + raw.slice(end);
};

// Monochrome artwork is drawn in currentColor, in black, or in no colour at all, and leaves the
// rest to the page. The root's presentation attributes move onto a group of their own (the
// rewriter keeps only what is inside the root, so a root fill="none" or stroke-width would be
// lost), and every one of those colours becomes the brand colour.
const paint = (raw, colour) => {
  const open = /<svg\b[^>]*>/i.exec(raw);
  if (!open) return raw;
  const end = raw.lastIndexOf("</svg>");
  const keep = [];
  let root = open[0];
  for (const k of PROPS) {
    const re = new RegExp(`\\s${k}\\s*=\\s*"([^"]*)"`, "i");
    const m = re.exec(root);
    if (m) {
      keep.push(` ${k}="${m[1]}"`);
      root = root.replace(re, "");
    }
  }
  root = root.replace(/<svg\b/i, `<svg fill="${colour}"`);
  const inner = raw.slice(open.index + open[0].length, end);
  const body = keep.length ? `<g${keep.join("")}>${inner}</g>` : inner;
  return (root + body + "</svg>").replace(
    /\s(fill|stroke)\s*=\s*"\s*(?:currentColor|#000|#000000|black)\s*"/gi,
    ` $1="${colour}"`,
  );
};

const argv = process.argv.slice(2);
const mapPath = argv[0];
if (!mapPath) {
  console.error("usage: node .claude/tools/vendor-icons/fit.mjs <map.json> [--src <dir>] [--dry]");
  process.exit(2);
}
const DRY = argv.includes("--dry");
const srcAt = argv.indexOf("--src");
const mapDir = srcAt > 0 ? path.resolve(argv[srcAt + 1]) : path.dirname(path.resolve(mapPath));
const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const COLOUR = map._colour;

const report = { installed: [], refused: [] };
for (const [provider, entries] of Object.entries(map)) {
  if (provider.startsWith("_")) continue;
  const dir = path.join(ROOT, "icons/components", provider);
  if (!fs.existsSync(dir)) {
    report.refused.push({ id: provider, why: `no icons/components/${provider}` });
    continue;
  }
  for (const [id, rel] of Object.entries(entries)) {
    const src = path.isAbsolute(rel) ? rel : path.resolve(mapDir, rel);
    if (!fs.existsSync(src)) {
      report.refused.push({ provider, id, src: rel, why: "source missing" });
      continue;
    }
    const raw = fs.readFileSync(src, "utf8");
    if (RASTER.test(raw)) {
      report.refused.push({ provider, id, src: rel, why: "source embeds a raster" });
      continue;
    }
    const cleaned = preFlatten(pre(COLOUR ? paint(raw, COLOUR) : raw));
    const vb = /viewBox\s*=\s*"([^"]+)"/i.exec(cleaned)?.[1]?.trim().split(/[\s,]+/).map(Number);
    const span = vb && vb.length === 4 ? Math.max(vb[2], vb[3]) : 24;
    let best = null;
    let why = "";
    let smallest = Infinity;
    // Precision first; only when the drawing is still over budget at the loosest precision does
    // it get decimated, and then by a fraction of a pixel at a time.
    outer: for (const epsPx of [0, 0.1, 0.2, 0.35]) {
      const body = epsPx ? decimate(cleaned, (epsPx * span) / 24) : cleaned;
      for (let p = 3; p >= 0; p--) {
        let svg;
        try {
          svg = build(body, id, p);
        } catch (e) {
          why = e.message;
          break outer;
        }
        if (BANNED.test(svg)) {
          why = "banned construct survived cleaning";
          break outer;
        }
        if (!svg.includes('viewBox="0 0 24 24"')) {
          why = "not fitted to 24x24";
          break outer;
        }
        const n = Buffer.byteLength(svg);
        smallest = Math.min(smallest, n);
        if (n <= LIMIT) {
          best = { svg, precision: p, eps: epsPx };
          break outer;
        }
      }
    }
    if (!best && !why) why = `over 4 KB however it is minified (smallest ${smallest} bytes)`;
    if (!best) {
      report.refused.push({ provider, id, src: rel, why });
      continue;
    }
    const target = path.join(dir, `${id}.svg`);
    if (!DRY) fs.writeFileSync(target, best.svg);
    report.installed.push({
      provider, id, src: rel, bytes: Buffer.byteLength(best.svg), precision: best.precision, eps: best.eps,
    });
  }
}
console.log(JSON.stringify(report, null, 1));
console.error(`installed ${report.installed.length}, refused ${report.refused.length}`);
