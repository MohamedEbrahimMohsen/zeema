// Build the published package into dist/:
//   dist/zeema.js            the engine, the commands and the MCP tools in one ESM file
//                            (@modelcontextprotocol/sdk and zod stay outside: the only runtime
//                            dependencies, loaded by `zeema mcp` alone)
//   dist/bin.js              the `zeema` executable
//   dist/catalogue/*.json    the catalogue and its icons, built from this repository's files,
//                            and meta.json saying which commit they came from
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { iconMap, loadCatalogue, toBundle } from "@zeema/catalogue";
import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "..");
const DIST = path.join(here, "dist");

const git = (...args) => {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
};

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, "catalogue"), { recursive: true });

await build({
  entryPoints: [path.join(here, "src", "entry.js")],
  outfile: path.join(DIST, "zeema.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: ["@modelcontextprotocol/sdk", "@modelcontextprotocol/sdk/*", "zod"],
  // `yaml` resolves to its CommonJS build under the node condition, and that build requires
  // node built-ins; give the ESM bundle a real `require` for them.
  banner: {
    js: 'import { createRequire as __zeemaCreateRequire } from "node:module";\nconst require = __zeemaCreateRequire(import.meta.url);',
  },
  legalComments: "inline",
  logLevel: "warning",
});

fs.writeFileSync(
  path.join(DIST, "bin.js"),
  `#!/usr/bin/env node
import { run } from "./zeema.js";

run(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
`,
);
fs.chmodSync(path.join(DIST, "bin.js"), 0o755);

// Only what the commands read: the catalogue (lint, catalogue, MCP) and the icons (render).
// designs.json, search.json and sources.json serve the web app and stay out of the package.
const cat = loadCatalogue(ROOT);
const { icons, missing } = iconMap(cat);
if (missing.length) throw new Error(`missing ${missing.length} icon file(s), first: ${missing[0]}`);
const write = (name, value) =>
  fs.writeFileSync(path.join(DIST, "catalogue", name), `${JSON.stringify(value)}\n`);
write("catalogue.json", toBundle(cat));
write("icons.json", icons);
const meta = {
  commit: git("rev-parse", "HEAD"),
  date: git("log", "-1", "--format=%cs"),
  counts: {
    kinds: Object.keys(cat.kinds).length,
    components: Object.keys(cat.components).length,
    rules: cat.rules.length,
  },
};
fs.writeFileSync(path.join(DIST, "catalogue", "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);

console.log(
  `zeema: dist/zeema.js, dist/bin.js, dist/catalogue (${meta.counts.kinds} kinds, ${meta.counts.components} components, ${meta.counts.rules} rules) at ${meta.commit.slice(0, 12)} ${meta.date}`,
);
