// zeema: the command line, wired to a catalogue repository's source files.
//   zeema lint [paths...] [--format human|json|sarif] [--fail-on error|warning|info|never] [--out file]
//   zeema validate [--root <repo>]
//   zeema render <design> [--format svg|mermaid] [--out file] [--theme auto|light|dark]
//                         [--layout <file>|none]  (default: <design>.layout.json beside it)
//   zeema catalogue find|component|kind|kinds|providers ...
//   zeema init [dir]
//   zeema version
// The commands themselves live in main.js; the published `zeema` package wires the same commands
// to its bundled catalogue instead (packages/zeema), without `validate`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_ROOT, iconMap, loadCatalogue } from "@zeema/catalogue";
import { validateRepository } from "@zeema/catalogue/validate";
import { createMain } from "./main.js";

export { parseArgs, readLayout, resolveInside, resolveOut } from "./main.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(fs.readFileSync(path.join(here, "..", "package.json"), "utf8")).version;

// The catalogue root: --root, ZEEMA_ROOT, the nearest ancestor of cwd holding kinds/ and
// components/, or the repository this package lives in.
export function findRoot(flags, cwd = process.cwd()) {
  if (flags.root) return path.resolve(cwd, flags.root);
  if (process.env.ZEEMA_ROOT) return path.resolve(process.env.ZEEMA_ROOT);
  let dir = cwd;
  for (;;) {
    if (fs.existsSync(path.join(dir, "kinds")) && fs.existsSync(path.join(dir, "components")))
      return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return DEFAULT_ROOT;
}

// One catalogue load per root per process: a command that runs many times in one process (the
// tests, an editor integration) should not re-read 1,700 files each time.
const catalogues = new Map();
export function catalogueAt(root) {
  if (!catalogues.has(root)) catalogues.set(root, loadCatalogue(root));
  return catalogues.get(root);
}
const icons = new WeakMap();
export function iconsOf(cat) {
  if (!icons.has(cat)) icons.set(cat, iconMap(cat).icons);
  return icons.get(cat);
}

export const main = createMain({
  version: VERSION,
  catalogue: (flags, cwd) => catalogueAt(findRoot(flags, cwd)),
  icons: iconsOf,
  validate({ flags, cwd, stdout }) {
    const { ok, problems } = validateRepository(findRoot(flags, cwd), {
      log: (l) => stdout(`${l}\n`),
    });
    if (!ok) {
      stdout(`\nPROBLEMS (${problems.length}):\n${problems.map((p) => ` - ${p}`).join("\n")}\n`);
      return 1;
    }
    stdout("all checks passed\n");
    return 0;
  },
});
