// Download the Cloudflare product icons that .claude/tools/vendor-icons/cloudflare.json names, into
// a working directory outside the repository, as plain .svg files fit.mjs can read.
//
//   node .claude/tools/vendor-icons/cloudflare-fetch.mjs <dir>
//   node .claude/tools/vendor-icons/fit.mjs .claude/tools/vendor-icons/cloudflare.json --src <dir>
//
// Two sources, both published by Cloudflare (cloudflare.json `_sources` pins the versions):
//   docs/<name>.svg  the product icons of the Cloudflare docs, cloudflare/cloudflare-docs
//                    src/icons/, CC BY 4.0, fetched from raw.githubusercontent.com at a commit.
//   npm/<Name>.svg   @cloudflare/component-icon, BSD-3-Clause. The package ships React
//                    components, not SVG files, so each one is called against a stand-in
//                    React.createElement that prints markup instead of building elements.
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const out = process.argv[2];
if (!out) {
  console.error("usage: node .claude/tools/vendor-icons/cloudflare-fetch.mjs <dir>");
  process.exit(2);
}
const map = JSON.parse(fs.readFileSync(path.join(here, "cloudflare.json"), "utf8"));
const { docs, npm } = map._sources;
const wanted = Object.values(map.cloudflare);

fs.mkdirSync(path.join(out, "docs"), { recursive: true });
for (const rel of wanted.filter((r) => r.startsWith("docs/"))) {
  const url = `https://raw.githubusercontent.com/cloudflare/cloudflare-docs/${docs.commit}/src/icons/${rel.slice(5)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  fs.writeFileSync(path.join(out, rel), await res.text());
}

const npmWanted = wanted.filter((r) => r.startsWith("npm/"));
if (npmWanted.length) {
  const pkgDir = path.join(out, "npm-package");
  fs.mkdirSync(pkgDir, { recursive: true });
  // npm is npm.cmd on Windows, which only a shell can start.
  const tgz = execSync(`npm pack ${npm.package}@${npm.version} --silent`, { cwd: pkgDir, encoding: "utf8" })
    .trim()
    .split(/\r?\n/)
    .pop();
  execFileSync("tar", ["xzf", tgz], { cwd: pkgDir });
  const kebab = (k) => (k === "viewBox" ? k : k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));
  const React = {
    createElement: (tag, props, ...children) => {
      const attrs = Object.entries(props || {})
        .filter(([k, v]) => !["aria-hidden", "focusable"].includes(k) && v !== undefined && v !== false)
        .map(([k, v]) => ` ${kebab(k)}="${v}"`)
        .join("");
      return `<${tag}${attrs}>${children.join("")}</${tag}>`;
    },
  };
  fs.mkdirSync(path.join(out, "npm"), { recursive: true });
  for (const rel of npmWanted) {
    const name = path.basename(rel, ".svg");
    const js = fs.readFileSync(path.join(pkgDir, "package/es/reactsvgs", `${name}.js`), "utf8");
    const body = js
      .replace(/^import .*$/m, "")
      .replace(/export default (\w+);/, "return $1;");
    const component = new Function("React", body)(React);
    fs.writeFileSync(path.join(out, rel), component({}));
  }
}
console.error(`fetched ${wanted.length} sources into ${out}`);
