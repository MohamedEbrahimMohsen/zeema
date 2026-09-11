// arkore: the command line.
//   arkore lint [paths...] [--format human|json|sarif] [--fail-on error|warning|info|never] [--out file]
//   arkore validate [--root <repo>]
//   arkore render <design> [--format svg|mermaid] [--out file] [--theme auto|light|dark]
//   arkore catalogue find|component|kind|kinds|providers ...
//   arkore init [dir]
//   arkore version
// Exit codes: 0 clean, 1 findings at or above the failing severity (or any structural problem),
// 2 usage or input error.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_ROOT, iconMap, loadCatalogue } from "@arkore/catalogue";
import { validateRepository } from "@arkore/catalogue/validate";
import { normalize } from "@arkore/core/document";
import { toMermaid, toSvg } from "@arkore/core/render";
import { parse } from "@arkore/core/yaml";
import { catalogueCommand } from "./catalogue-cmd.js";
import { initProject } from "./init.js";
import {
  collectDesigns,
  formatHuman,
  formatJson,
  formatSarif,
  lintFiles,
  shouldFail,
} from "./lint.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(fs.readFileSync(path.join(here, "..", "package.json"), "utf8")).version;

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
      else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) flags[a.slice(2)] = argv[++i];
      else flags[a.slice(2)] = true;
    } else if (a === "-o") flags.out = argv[++i];
    else positional.push(a);
  }
  return { positional, flags };
}

// The catalogue root: --root, ARKORE_ROOT, the nearest ancestor of cwd holding kinds/ and
// components/, or the repository this package lives in.
export function findRoot(flags, cwd = process.cwd()) {
  if (flags.root) return path.resolve(cwd, flags.root);
  if (process.env.ARKORE_ROOT) return path.resolve(process.env.ARKORE_ROOT);
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
function catalogueFor(root) {
  if (!catalogues.has(root)) catalogues.set(root, loadCatalogue(root));
  return catalogues.get(root);
}

function readConfig(cwd) {
  const p = path.join(cwd, "arkore.config.json");
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    throw new Error(`arkore.config.json: ${e.message}`);
  }
}

const USAGE = `arkore <command>

  lint [paths...]        structure and rules on design files (default: config "designs" or cwd)
                         --format human|json|sarif  --fail-on error|warning|info|never  --out <file>
  validate               the whole catalogue repository gate            --root <repo>
  render <design>        --format svg|mermaid  --out <file>  --theme auto|light|dark
  catalogue <sub>        find <words...> | component <id> | kind <id> | kinds | providers <kind>
  init [dir]             starter design, config, editor schema mapping, CI workflow
  version
`;

export async function main(argv, io = {}) {
  const stdout = io.stdout ?? ((s) => process.stdout.write(s));
  const stderr = io.stderr ?? ((s) => process.stderr.write(s));
  const cwd = io.cwd ?? process.cwd();
  const { positional, flags } = parseArgs(argv);
  const [cmd, ...rest] = positional;
  const writeOut = (text) => {
    if (flags.out) {
      fs.mkdirSync(path.dirname(path.resolve(cwd, flags.out)), { recursive: true });
      fs.writeFileSync(path.resolve(cwd, flags.out), text, "utf8");
    } else stdout(text);
  };

  try {
    if (!cmd || cmd === "help" || flags.help) {
      stdout(USAGE);
      return cmd ? 0 : 2;
    }
    if (cmd === "version") {
      stdout(`arkore ${VERSION}\n`);
      return 0;
    }
    if (cmd === "init") {
      const dir = path.resolve(cwd, rest[0] ?? ".");
      const written = initProject(dir);
      stdout(`${written.map((w) => `wrote ${w}`).join("\n")}\n`);
      return 0;
    }
    if (cmd === "validate") {
      const { ok, problems } = validateRepository(findRoot(flags, cwd), {
        log: (l) => stdout(`${l}\n`),
      });
      if (!ok) {
        stdout(`\nPROBLEMS (${problems.length}):\n${problems.map((p) => ` - ${p}`).join("\n")}\n`);
        return 1;
      }
      stdout("all checks passed\n");
      return 0;
    }
    const cat = catalogueFor(findRoot(flags, cwd));
    if (cmd === "catalogue") {
      const r = catalogueCommand(cat, rest[0], rest.slice(1));
      (r.code === 2 ? stderr : stdout)(`${r.lines.join("\n")}\n`);
      return r.code;
    }
    if (cmd === "render") {
      if (!rest[0]) {
        stderr("usage: arkore render <design> [--format svg|mermaid] [--out file]\n");
        return 2;
      }
      const text = fs.readFileSync(path.resolve(cwd, rest[0]), "utf8");
      const doc = normalize(parse(text).doc).doc;
      const format = flags.format ?? "svg";
      if (format === "mermaid") writeOut(`${toMermaid(doc, flags.direction ?? "TD")}\n`);
      else if (format === "svg")
        writeOut(toSvg(doc, cat, { icons: iconMap(cat).icons, theme: flags.theme ?? "auto" }));
      else {
        stderr(`unknown format ${format}\n`);
        return 2;
      }
      return 0;
    }
    if (cmd === "lint") {
      const config = readConfig(cwd);
      const paths = rest.length ? rest : (config.designs ?? ["."]);
      const files = collectDesigns(paths, cwd);
      if (!files.length) {
        stderr("no design files found\n");
        return 2;
      }
      const result = lintFiles(files, cat, { cwd, disable: config.disable ?? {} });
      const format = flags.format ?? "human";
      if (format === "json") writeOut(formatJson(result));
      else if (format === "sarif") writeOut(formatSarif(result, cat, VERSION));
      else if (format === "human") writeOut(formatHuman(result));
      else {
        stderr(`unknown format ${format}\n`);
        return 2;
      }
      return shouldFail(result, flags["fail-on"] ?? config.failOn ?? "error") ? 1 : 0;
    }
    stderr(`unknown command ${cmd}\n${USAGE}`);
    return 2;
  } catch (e) {
    stderr(`error: ${e.message}\n`);
    return 2;
  }
}
