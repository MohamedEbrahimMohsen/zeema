// Rewrites harvested vendor icons into the shape D:\Personal\_arkore expects and installs them
// over icons/components/<provider>/<id>.svg.
//
//   node tools/install-into-arkore.mjs [--dry] [--repo <path>] [providers...]
//
// The repository's contract (packages/catalogue/src/validate.js) is non-negotiable: the file is
// an SVG, at most 4096 bytes, carries viewBox="0 0 24 24", and contains no <script>, no on*
// handler, no <image>, no href= and no <foreignObject>. iconMap() then inlines everything
// between the root <svg ...> and </svg> into a 24x24 slot, so the artwork has to be scaled into
// that box here and every id has to be unique across the whole set.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.join(import.meta.dirname, ".."));
const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const repoAt = argv.indexOf("--repo");
const REPO = repoAt >= 0 ? argv[repoAt + 1] : "D:/Personal/_arkore";
const PRIOR = "D:/Personal/_arkore-icons/out";
const providers = argv.filter((a) => !a.startsWith("--") && a !== REPO);
const PROVIDERS = providers.length ? providers : ["aws", "azure", "oci"];
const LIMIT = 4096;

// ---------- helpers

const clean = (raw) =>
  raw
    .replace(/^\uFEFF/, "")
    .replace(/<\?xml[^>]*\?>\s*/gi, "")
    .replace(/<!DOCTYPE[^>]*>\s*/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(metadata|title|desc)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(metadata|title|desc)\b[^>]*\/>/gi, "");

const rootTag = (svg) => /<svg\b[^>]*>/i.exec(svg);

const viewBoxOf = (open) => {
  const vb = /viewBox\s*=\s*"([^"]+)"/i
    .exec(open)?.[1]
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (vb && vb.length === 4 && vb.every(Number.isFinite)) return vb;
  const w = Number(/\swidth\s*=\s*"([\d.]+)(px)?"/i.exec(open)?.[1]);
  const h = Number(/\sheight\s*=\s*"([\d.]+)(px)?"/i.exec(open)?.[1]);
  return Number.isFinite(w) && Number.isFinite(h) ? [0, 0, w, h] : null;
};

// A gradient can inherit its stops from another through href; the repository bans href, so the
// stops are copied in and the attribute dropped.
const resolveGradientHref = (body) => {
  const grads = new Map();
  // The opening tag must not be self-closing, or the scan swallows the gradient that follows and
  // that one never makes it into the map.
  for (const m of body.matchAll(
    /<(linearGradient|radialGradient)\b((?:[^>]*[^/>])?)>([\s\S]*?)<\/\1>/gi,
  )) {
    const id = /\sid\s*=\s*"([^"]+)"/i.exec(m[2])?.[1];
    if (id) grads.set(id, m[3]);
  }
  return body.replace(/<(linearGradient|radialGradient)\b([^>]*?)\s*\/>/gi, (whole, tag, attrs) => {
    const ref = /\s(?:xlink:)?href\s*=\s*"#([^"]+)"/i.exec(attrs)?.[1];
    if (!ref || !grads.has(ref)) return whole;
    const kept = attrs.replace(/\s(?:xlink:)?href\s*=\s*"[^"]*"/gi, "");
    return `<${tag}${kept}>${grads.get(ref)}</${tag}>`;
  });
};

// Everything is inlined into one document, so ids must not collide between icons.
const namespaceIds = (body, slug) => {
  const ids = [...new Set([...body.matchAll(/\sid\s*=\s*"([^"]+)"/gi)].map((m) => m[1]))];
  let n = 0;
  for (const old of ids) {
    const fresh = `${slug}-${(n++).toString(36)}`;
    const esc = old.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    body = body
      .replace(new RegExp(`(\\sid\\s*=\\s*)"${esc}"`, "g"), `$1"${fresh}"`)
      .replace(new RegExp(`url\\(\\s*#${esc}\\s*\\)`, "g"), `url(#${fresh})`)
      .replace(new RegExp(`((?:xlink:)?href\\s*=\\s*)"#${esc}"`, "g"), `$1"#${fresh}"`);
  }
  return body;
};

const round = (v, p) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  const r = Number(n.toFixed(p));
  return String(r);
};

// Bakes a group's translate+scale into its children's coordinates so the wrapper can go. The
// first-run OCI reconstructions wrap every one of their ~60 paths in its own <g transform>,
// which is several hundred wasted bytes per icon. Only absolute commands are handled; anything
// relative, rotated or elliptical is left alone.
const PAIRED = { M: 1, L: 1, T: 1, C: 3, S: 2, Q: 2 };
const applyAffine = (d, tx, ty, sx, sy) => {
  const tokens = d.match(/[A-Za-z]|-?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return null;
  const out = [];
  let cmd = "";
  let i = 0;
  const num = () => {
    const v = Number(tokens[i++]);
    if (!Number.isFinite(v)) throw new Error("bad number");
    return v;
  };
  const fmt = (v) => String(Number(v.toFixed(4)));
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[A-Za-z]$/.test(t)) {
      cmd = t;
      i++;
      if (cmd === "Z" || cmd === "z") {
        out.push("Z");
        continue;
      }
      if (!PAIRED[cmd] && cmd !== "H" && cmd !== "V") return null;
      out.push(cmd);
      continue;
    }
    if (!cmd) return null;
    try {
      if (cmd === "H") out.push(fmt(num() * sx + tx));
      else if (cmd === "V") out.push(fmt(num() * sy + ty));
      else
        for (let k = 0; k < PAIRED[cmd]; k++) {
          const x = num();
          const y = num();
          out.push(fmt(x * sx + tx), fmt(y * sy + ty));
        }
    } catch {
      return null;
    }
  }
  return out.join(" ");
};

const flattenTransforms = (body) => {
  const re =
    /<g\s+transform="translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)\s*scale\(\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+))?\s*\)"\s*>([\s\S]*?)<\/g>/gi;
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 6) {
    changed = false;
    body = body.replace(re, (whole, tx, ty, sx, sy, inner) => {
      if (/<g\b/i.test(inner)) return whole;
      const TX = Number(tx);
      const TY = Number(ty);
      const SX = Number(sx);
      const SY = sy === undefined ? SX : Number(sy);
      let failed = false;
      const next = inner.replace(/\sd="([^"]*)"/gi, (w, d) => {
        const moved = applyAffine(d, TX, TY, SX, SY);
        if (moved === null) {
          failed = true;
          return w;
        }
        return ` d="${moved}"`;
      });
      if (failed || /<(rect|circle|ellipse|line|polygon|polyline|text|use)\b/i.test(inner))
        return whole;
      changed = true;
      return next;
    });
  }
  return body;
};

// ---------- path data
//
// Path data cannot be rounded with a regex over its numbers. "a.505.505 0 00-.197.048" packs two
// arc flags against the next coordinate, and rewriting ".505" as "0.505" fuses the flags into
// the number that follows. So the data is parsed properly, rounded, and re-emitted.

const short = (n) => {
  let s = String(n);
  if (s.startsWith("-0.")) s = `-.${s.slice(3)}`;
  else if (s.startsWith("0.")) s = `.${s.slice(2)}`;
  return s;
};

const ARITY = { M: 2, L: 2, T: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, A: 7, Z: 0 };
// In an arc, arguments 3 and 4 are single-character flags, never a full number.
const isFlag = (cmd, k) => cmd === "A" && (k === 3 || k === 4);

const scanPath = (d) => {
  const segs = [];
  let i = 0;
  const skip = () => {
    while (
      i < d.length &&
      (d[i] === " " || d[i] === "," || d[i] === "\n" || d[i] === "\r" || d[i] === "\t")
    )
      i++;
  };
  const number = () => {
    skip();
    const start = i;
    if (d[i] === "+" || d[i] === "-") i++;
    while (i < d.length && d[i] >= "0" && d[i] <= "9") i++;
    if (d[i] === ".") {
      i++;
      while (i < d.length && d[i] >= "0" && d[i] <= "9") i++;
    }
    if (d[i] === "e" || d[i] === "E") {
      i++;
      if (d[i] === "+" || d[i] === "-") i++;
      while (i < d.length && d[i] >= "0" && d[i] <= "9") i++;
    }
    if (i === start) return null;
    const v = Number(d.slice(start, i));
    return Number.isFinite(v) ? v : null;
  };
  const flag = () => {
    skip();
    if (d[i] === "0" || d[i] === "1") return Number(d[i++]);
    return null;
  };

  let cmd = null;
  skip();
  while (i < d.length) {
    const c = d[i];
    if (/[A-Za-z]/.test(c)) {
      cmd = c;
      i++;
      if (ARITY[cmd.toUpperCase()] === undefined) return null;
      if (cmd.toUpperCase() === "Z") {
        segs.push({ cmd, args: [] });
        cmd = null;
        skip();
        continue;
      }
    } else if (cmd === null) return null;
    const upper = cmd.toUpperCase();
    const n = ARITY[upper];
    const args = [];
    for (let k = 0; k < n; k++) {
      const v = isFlag(upper, k) ? flag() : number();
      if (v === null) return null;
      args.push(v);
    }
    segs.push({ cmd, args });
    // Repeated coordinate sets continue the command; after a moveto they are linetos.
    if (upper === "M") cmd = cmd === "M" ? "L" : "l";
    skip();
  }
  return segs.length ? segs : null;
};

// A cubic whose control points sit on the line between its endpoints is a straight line drawn
// the expensive way — six numbers where two would do. Tracing software emits a great many of
// them, and the first-run OCI reconstructions are mostly this.
const isFlatCubic = (x0, y0, x1, y1, x2, y2, x3, y3, tol) => {
  const dx = x3 - x0;
  const dy = y3 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return false;
  for (const [px, py] of [
    [x1, y1],
    [x2, y2],
  ]) {
    const t = ((px - x0) * dx + (py - y0) * dy) / (len * len);
    if (t < -0.05 || t > 1.05) return false; // control point doubles back: a real curve
    if (Math.abs((px - x0) * dy - (py - y0) * dx) / len > tol) return false;
  }
  return true;
};

const emitPath = (segs, p, tol = 0) => {
  const r = (v) => Number(v.toFixed(p));
  let out = "";
  let last = "";
  let prevChar = "";
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;

  const push = (letter, args, flags) => {
    if (letter !== last) {
      out += letter;
      last = letter;
      prevChar = letter;
    }
    args.forEach((a, k) => {
      const s = flags?.includes(k) ? String(a) : short(a);
      const needsSpace =
        prevChar !== "" &&
        !/[A-Za-z]/.test(prevChar) &&
        !s.startsWith("-") &&
        !(s.startsWith(".") && prevChar === ".");
      out += (needsSpace ? " " : "") + s;
      prevChar = /\./.test(s) ? "." : s[s.length - 1];
    });
  };

  for (const seg of segs) {
    const upper = seg.cmd.toUpperCase();
    const rel = seg.cmd !== upper;
    if (upper === "Z") {
      push("Z", []);
      last = "Z";
      cx = sx;
      cy = sy;
      continue;
    }
    // Work in absolute coordinates, then offer both spellings and keep the shorter.
    const abs = seg.args.slice();
    if (rel) {
      if (upper === "H") abs[0] = seg.args[0] + cx;
      else if (upper === "V") abs[0] = seg.args[0] + cy;
      else
        for (let k = 0; k < abs.length; k++) {
          if (isFlag(upper, k) || (upper === "A" && k < 3)) continue;
          abs[k] = seg.args[k] + (k % 2 === (upper === "A" ? 1 : 0) ? cx : cy);
        }
    }
    if (upper === "A") {
      // Arcs keep their own spelling; only the radii and endpoint are rounded.
      const args = seg.args.map((v, k) => (isFlag(upper, k) ? v : r(v)));
      push(seg.cmd, args, [3, 4]);
      const ex = rel ? cx + args[5] : args[5];
      const ey = rel ? cy + args[6] : args[6];
      cx = r(ex);
      cy = r(ey);
      continue;
    }

    let effective = upper;
    let absGeom = abs;
    if (upper === "C" && tol > 0 && isFlatCubic(cx, cy, ...abs, tol)) {
      effective = "L";
      absGeom = [abs[4], abs[5]];
    }

    const absArgs = absGeom.map(r);
    const relArgs =
      effective === "H"
        ? [r(absGeom[0] - cx)]
        : effective === "V"
          ? [r(absGeom[0] - cy)]
          : absGeom.map((v, k) => r(v - (k % 2 === 0 ? cx : cy)));
    const width = (letter, args) => {
      const head = letter === last ? 0 : 1;
      return head + args.map(short).join(" ").length;
    };
    const useRel = width(effective.toLowerCase(), relArgs) < width(effective, absArgs);
    push(useRel ? effective.toLowerCase() : effective, useRel ? relArgs : absArgs);

    if (effective === "H") cx = useRel ? r(cx + relArgs[0]) : absArgs[0];
    else if (effective === "V") cy = useRel ? r(cy + relArgs[0]) : absArgs[0];
    else {
      const i2 = absArgs.length - 2;
      cx = useRel ? r(cx + relArgs[i2]) : absArgs[i2];
      cy = useRel ? r(cy + relArgs[i2 + 1]) : absArgs[i2 + 1];
    }
    if (effective === "M") {
      sx = cx;
      sy = cy;
    }
  }
  return out;
};

const rewritePath = (d, p, tol) => {
  const segs = scanPath(d);
  if (!segs) return d;
  try {
    const out = emitPath(segs, p, tol);
    return out || d;
  } catch {
    return d;
  }
};

// points= is a plain list of coordinates, but it allows the same compact spelling, so it goes
// through a tokeniser too rather than an in-place replace.
const rewritePoints = (v, p) => {
  const nums = v.match(/-?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g);
  if (!nums) return v;
  return nums.map((n) => short(Number(Number(n).toFixed(p)))).join(" ");
};

const NUMERIC_ATTRS =
  /\s(x|y|x1|y1|x2|y2|cx|cy|r|rx|ry|fx|fy|width|height|offset|stroke-width|stroke-dasharray|stroke-dashoffset)\s*=\s*"([^"]*)"/gi;

const reducePrecision = (body, p, tol) => {
  body = body.replace(/\s(d|points)\s*=\s*"([^"]*)"/gi, (_, name, val) => {
    const out = name.toLowerCase() === "d" ? rewritePath(val, p, tol) : rewritePoints(val, p);
    return ` ${name}="${out}"`;
  });
  body = body.replace(NUMERIC_ATTRS, (whole, name, val) => {
    if (/%/.test(val) || /[a-df-zA-DF-Z]/.test(val)) return whole;
    const out = val.replace(/-?\d*\.\d+(?:e[-+]?\d+)?/gi, (num) => round(num, p));
    return ` ${name}="${out}"`;
  });
  return body;
};

const squeeze = (body) =>
  body
    .replace(
      /\s(data-name|xml:space|enable-background|xmlns:xlink|xmlns:svgjs|version)\s*=\s*"[^"]*"/gi,
      "",
    )
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\/>/g, "/>")
    .replace(/<g\s*>(<\/g>)/g, "")
    .trim();

// Vendor art is coloured, but a monochrome reconstruction should still follow the theme, so it
// is handed currentColor instead of a fixed black.
const hasOwnColour = (body) =>
  /\s(fill|stroke)\s*=\s*"(?!\s*none\s*")[^"]+"/i.test(body) || /url\(#/.test(body);

// Decimals needed so that rounding a coordinate moves it by at most `err` pixels once the
// artwork is scaled into the 24px box. Dropping below the loose bound visibly mangles the
// drawing — an 18 unit Azure icon rounded to whole units loses its shape entirely — so the
// budget loop stops there and the icon is skipped instead.
const decimalsFor = (w, err) => {
  const d = Math.ceil(Math.log10(24 / (err * Math.max(w, 1))));
  return Math.max(0, Math.min(3, Number.isFinite(d) ? d : 2));
};

const build = (raw, slug, p) => {
  const svg = clean(raw);
  const open = rootTag(svg);
  if (!open) throw new Error("not an svg");
  const vb = viewBoxOf(open[0]);
  if (!vb) throw new Error("no viewBox and no size");
  const [minX, minY, w, h] = vb;
  if (!(w > 0 && h > 0)) throw new Error(`degenerate viewBox ${vb.join(" ")}`);

  let body = svg.slice(open.index + open[0].length, svg.lastIndexOf("</svg>"));
  body = resolveGradientHref(body);
  body = flattenTransforms(body);
  body = namespaceIds(body, slug);
  // A straight cubic may be flattened as long as it stays within about a twentieth of a pixel
  // of where it was, measured after the drawing is scaled into the 24 unit box.
  body = reducePrecision(body, p, (0.05 * Math.max(w, h)) / 24);
  body = squeeze(body);
  body = body.replace(/\s(?:xlink:)?href\s*=\s*"[^"]*"/gi, "");

  const s = 24 / Math.max(w, h);
  const tx = (24 - w * s) / 2 - minX * s;
  const ty = (24 - h * s) / 2 - minY * s;
  const f = (v) => String(Number(v.toFixed(4)));

  const rootFill = /\sfill\s*=\s*"([^"]*)"/i.exec(open[0])?.[1];
  const fill =
    rootFill && rootFill !== "none" ? rootFill : hasOwnColour(body) ? "#000" : "currentColor";
  const g =
    `<g transform="translate(${f(tx)} ${f(ty)}) scale(${f(s)})" ` +
    `fill="${fill}" stroke="none" stroke-width="1">`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">` +
    `${g}${body}</g></svg>\n`
  );
};

const BANNED = /<script|\son[a-z]+\s*=|<image\b|href\s*=|<foreignObject/i;

// ---------- run

export { build, clean, LIMIT };
