// Fit the official Kubernetes resource icons (kubernetes/community, Apache-2.0) into the
// repository's 24-unit icon contract, using the same rewriter that installed the aws/azure/oci
// vendor icons. Usage: node .claude/tools/k8s-icons/convert.mjs <map.json> (source SVGs from github.com/kubernetes/community icons/svg/resources/unlabeled next to this file) — map is {componentId: iconName}.
import fs from "node:fs";
import path from "node:path";
import { build, LIMIT } from "./lib.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const ROOT = "D:/Personal/_arkore";
const BANNED = /<script|\son[a-z]+\s*=|<image\b|href\s*=|<foreignObject/i;
// Inkscape leaves editor metadata and namespaced attributes behind; none of it draws, and
// style="fill:#hex" has to become a fill attribute for the rewriter to see the colour.
const pre = (raw) =>
  raw
    .replace(/<metadata[\s\S]*?<\/metadata>/g, "")
    .replace(/<sodipodi:namedview[\s\S]*?(\/>|<\/sodipodi:namedview>)/g, "")
    .replace(
      /\s(?:inkscape|sodipodi|xmlns:(?:inkscape|sodipodi|dc|cc|rdf|svg)):?[\w-]*="[^"]*"/g,
      "",
    )
    .replace(/\sstyle="([^"]*)"/g, (_, css) => {
      const out = [];
      const fill = /(?:^|;)\s*fill:\s*(#[0-9a-fA-F]{3,8}|none)/.exec(css);
      const rule = /fill-rule:\s*(evenodd|nonzero)/.exec(css);
      const op = /fill-opacity:\s*([\d.]+)/.exec(css);
      if (fill) out.push(` fill="${fill[1]}"`);
      if (rule) out.push(` fill-rule="${rule[1]}"`);
      if (op && op[1] !== "1") out.push(` fill-opacity="${op[1]}"`);
      return out.join("");
    })
    .replace(/<defs[^>]*\/>/g, "")
    .replace(/<defs[^>]*>\s*<\/defs>/g, "");
const map = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const out = { installed: [], skipped: [] };
for (const [id, icon] of Object.entries(map)) {
  const src = path.join(HERE, `${icon}.svg`);
  if (!fs.existsSync(src)) {
    out.skipped.push({ id, why: `no source ${icon}.svg` });
    continue;
  }
  const raw = pre(fs.readFileSync(src, "utf8"));
  let best = null;
  for (let p = 3; p >= 0; p--) {
    let svg;
    try {
      svg = build(raw, id, p);
    } catch (e) {
      out.skipped.push({ id, why: e.message });
      break;
    }
    if (
      Buffer.byteLength(svg) <= LIMIT &&
      !BANNED.test(svg) &&
      svg.includes('viewBox="0 0 24 24"')
    ) {
      best = svg;
      break;
    }
  }
  if (!best) {
    if (!out.skipped.find((s) => s.id === id))
      out.skipped.push({ id, why: "over budget at every precision" });
    continue;
  }
  const target = path.join(ROOT, "icons/components/k8s", `${id}.svg`);
  fs.writeFileSync(target, best);
  out.installed.push({ id, icon, bytes: Buffer.byteLength(best) });
}
console.log(JSON.stringify(out, null, 1));
