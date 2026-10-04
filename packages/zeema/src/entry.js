// The published `zeema` command: the repository's commands (packages/cli/src/main.js) wired to the
// catalogue bundled into this package at build time (dist/catalogue), plus `mcp`. There is no
// `validate` here: that is the catalogue repository's own gate, not a user command.
//
// This file is bundled by build.js into dist/zeema.js, so `here` is dist/ at run time.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { iconMap, loadCatalogue } from "@zeema/catalogue";
import { createMain } from "@zeema/cli/main";

const here = path.dirname(fileURLToPath(import.meta.url));
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const BUNDLE = path.join(here, "catalogue");
export const VERSION = readJson(path.join(here, "..", "package.json")).version;

let bundled = null;
let bundledIcons = null;
const fromSource = new Map();

/**
 * The bundled catalogue, unless `--root <repo>` or ZEEMA_ROOT names a catalogue repository
 * checkout to read from source instead (someone working on the vocabulary itself).
 */
export function catalogue(flags = {}, cwd = process.cwd()) {
  const root = flags.root
    ? path.resolve(cwd, flags.root)
    : process.env.ZEEMA_ROOT
      ? path.resolve(process.env.ZEEMA_ROOT)
      : null;
  if (root) {
    if (!fromSource.has(root)) fromSource.set(root, loadCatalogue(root));
    return fromSource.get(root);
  }
  bundled ??= readJson(path.join(BUNDLE, "catalogue.json"));
  return bundled;
}

export function icons(cat) {
  if (cat.root) return iconMap(cat).icons;
  bundledIcons ??= readJson(path.join(BUNDLE, "icons.json"));
  return bundledIcons;
}

/** Which catalogue this build carries: written by build.js from git and the bundle itself. */
export function about() {
  const m = readJson(path.join(BUNDLE, "meta.json"));
  return [
    `catalogue ${m.commit.slice(0, 12)} ${m.date} (${m.counts.kinds} kinds, ${m.counts.components} components, ${m.counts.rules} rules)`,
  ];
}

export const run = createMain({
  version: VERSION,
  about,
  catalogue,
  icons,
  commands: {
    async mcp({ cwd }) {
      const { serve } = await import("./mcp.js");
      await serve({ cwd, version: VERSION, catalogue: () => catalogue({}, cwd), icons });
      return 0;
    },
  },
});
