// The commands, independent of where the catalogue comes from. `index.js` wires them to the
// catalogue source files of a repository (and adds the repository gate, `validate`); the
// published `zeema` package wires them to the bundled catalogue and adds `mcp`. Both run this
// code, so the command line in the repository and the one on npm cannot drift apart.
//
// Exit codes: 0 clean, 1 findings at or above the failing severity (or any structural problem),
// 2 usage or input error.
import fs from "node:fs";
import path from "node:path";
import { normalize } from "@zeema/core/document";
import { toMermaid, toSvg } from "@zeema/core/render";
import { parse } from "@zeema/core/yaml";
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

/**
 * Where `--out` may write. A relative path must stay inside the working directory once resolved
 * (no `..` escape) and once symbolic links are followed (no link inside cwd pointing out of it).
 * An absolute path is the caller's explicit choice of directory and is taken as given. In both
 * cases the target itself must not be a symbolic link, so a planted link cannot redirect the
 * write. Throws with a plain message; the command reports it and exits 2.
 */
export function resolveOut(cwd, out) {
  if (typeof out !== "string" || out === "") throw new Error("--out needs a file name");
  const target = path.resolve(cwd, out);
  if (!path.isAbsolute(out)) {
    const base = fs.realpathSync(cwd);
    const inside = (p) => p === base || p.startsWith(base + path.sep);
    if (!inside(path.resolve(base, out)))
      throw new Error(`--out ${out} is outside the working directory; give an absolute path`);
    // Follow the deepest part of the path that exists: a link on the way must not lead out.
    let probe = path.dirname(target);
    while (!fs.existsSync(probe)) probe = path.dirname(probe);
    if (!inside(fs.realpathSync(probe)))
      throw new Error(`--out ${out} leads outside the working directory through a link`);
  }
  let st = null;
  try {
    st = fs.lstatSync(target);
  } catch {}
  if (st?.isSymbolicLink())
    throw new Error(`--out ${out} is a symbolic link; refusing to follow it`);
  if (st?.isDirectory()) throw new Error(`--out ${out} is a directory`);
  return target;
}

/**
 * A file an untrusted caller (an agent talking to `zeema mcp`) may read: relative or absolute, it
 * must resolve inside `cwd`, both as written and once every symbolic link on the way (and the
 * file itself) is followed. Stricter than `resolveOut`, which trusts an absolute path because a
 * person typed it.
 */
export function resolveInside(cwd, p) {
  if (typeof p !== "string" || p === "") throw new Error("a path is required");
  const base = fs.realpathSync(cwd);
  const inside = (q) => q === base || q.startsWith(base + path.sep);
  const target = path.resolve(base, p);
  if (!inside(target)) throw new Error(`${p} is outside the working directory`);
  if (!fs.existsSync(target)) throw new Error(`no such file: ${p}`);
  if (!inside(fs.realpathSync(target)))
    throw new Error(`${p} leads outside the working directory through a link`);
  return target;
}

/**
 * The layout sidecar a render draws with (docs/final-plan.md §D5, §D6): `--layout <file>`, or
 * `--layout none` for the engine's own arrangement, or else the file beside the design with the
 * same name and `.layout.json` in place of `.yaml` (design.yaml -> design.layout.json). A missing
 * sidecar is no sidecar; one that is not JSON is an input error, never silently ignored.
 */
export function readLayout(designFile, flag, cwd = process.cwd()) {
  if (flag === "none") return null;
  const explicit = typeof flag === "string";
  const p = explicit
    ? path.resolve(cwd, flag)
    : `${designFile.replace(/\.ya?ml$/i, "")}.layout.json`;
  if (!explicit && !fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`${path.relative(cwd, p) || p}: not JSON (${e.message})`);
  }
}

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

export function readConfig(cwd) {
  const p = path.join(cwd, "zeema.config.json");
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    throw new Error(`zeema.config.json: ${e.message}`);
  }
}

/** A design file as the engine sees it: parsed and normalised. Throws on refused YAML. */
export function readDesign(file) {
  const text = fs.readFileSync(file, "utf8");
  return { text, doc: normalize(parse(text).doc).doc };
}

/** SVG or Mermaid text of a design file; the one render path the command and the MCP share. */
export function renderDesign(file, cat, icons, options = {}) {
  const { doc } = readDesign(file);
  const format = options.format ?? "svg";
  if (format === "mermaid") return `${toMermaid(doc, options.direction ?? "TD", cat)}\n`;
  if (format === "svg")
    return toSvg(doc, cat, {
      icons,
      theme: options.theme ?? "auto",
      layout: readLayout(file, options.layout, options.cwd),
    });
  throw Object.assign(new Error(`unknown format ${format}`), { usage: true });
}

/** The usage text for the commands a wiring offers. */
export function usage({ validate = false, mcp = false } = {}) {
  return [
    "zeema <command>",
    "",
    '  lint [paths...]        structure and rules on design files (default: config "designs" or cwd)',
    "                         --format human|json|sarif  --fail-on error|warning|info|never  --out <file>",
    ...(validate
      ? ["  validate               the whole catalogue repository gate            --root <repo>"]
      : []),
    "  render <design>        --format svg|mermaid  --out <file>  --theme auto|light|dark",
    "                         --layout <file>|none (default: the .layout.json beside the design)",
    "  catalogue <sub>        find <words...> | component <id> | kind <id> | kinds | providers <kind>",
    "  init [dir]             starter design, config, editor schema mapping, CI workflow",
    ...(mcp
      ? ["  mcp                    a Model Context Protocol server on stdio, for coding agents"]
      : []),
    "  version",
    "  help",
    "",
    "  --out <file>: a relative path must stay inside the current directory; give an absolute path",
    "  to write anywhere else. Symbolic links at or on the way to the target are refused.",
    "",
  ].join("\n");
}

/**
 * The command line over a catalogue source.
 *   version     the version `zeema version` prints
 *   about       optional: more lines for `zeema version` (the bundled catalogue's identity)
 *   catalogue   (flags, cwd) => catalogue
 *   icons       (catalogue) => icon markup by id, for SVG
 *   validate    optional: ({ flags, cwd, stdout }) => exit code; the repository gate
 *   commands    optional: extra commands, name => ({ rest, flags, cwd, stdout, stderr }) => code
 */
export function createMain(env) {
  const extra = env.commands ?? {};
  const USAGE = usage({ validate: Boolean(env.validate), mcp: "mcp" in extra });

  return async function main(argv, io = {}) {
    const stdout = io.stdout ?? ((s) => process.stdout.write(s));
    const stderr = io.stderr ?? ((s) => process.stderr.write(s));
    const cwd = io.cwd ?? process.cwd();
    const { positional, flags } = parseArgs(argv);
    const [cmd, ...rest] = positional;
    const writeOut = (text) => {
      if (flags.out) {
        const target = resolveOut(cwd, flags.out);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, text, { encoding: "utf8", flag: "w" });
      } else stdout(text);
    };

    try {
      if (!cmd || cmd === "help" || flags.help) {
        stdout(USAGE);
        return cmd ? 0 : 2;
      }
      if (cmd === "version") {
        stdout(`zeema ${env.version}\n`);
        for (const line of env.about?.() ?? []) stdout(`${line}\n`);
        return 0;
      }
      if (cmd === "init") {
        const dir = path.resolve(cwd, rest[0] ?? ".");
        const written = initProject(dir);
        stdout(`${written.map((w) => `wrote ${w}`).join("\n")}\n`);
        return 0;
      }
      if (cmd === "validate" && env.validate) return env.validate({ flags, cwd, stdout });
      if (Object.hasOwn(extra, cmd)) return await extra[cmd]({ rest, flags, cwd, stdout, stderr });
      if (cmd === "catalogue") {
        const r = catalogueCommand(env.catalogue(flags, cwd), rest[0], rest.slice(1));
        (r.code === 2 ? stderr : stdout)(`${r.lines.join("\n")}\n`);
        return r.code;
      }
      if (cmd === "render") {
        if (!rest[0]) {
          stderr("usage: zeema render <design> [--format svg|mermaid] [--out file]\n");
          return 2;
        }
        const cat = env.catalogue(flags, cwd);
        const file = path.resolve(cwd, rest[0]);
        let text;
        try {
          text = renderDesign(file, cat, env.icons(cat), {
            format: flags.format,
            direction: flags.direction,
            theme: flags.theme,
            layout: flags.layout,
            cwd,
          });
        } catch (e) {
          if (!e.usage) throw e;
          stderr(`${e.message}\n`);
          return 2;
        }
        writeOut(text);
        return 0;
      }
      if (cmd === "lint") {
        const cat = env.catalogue(flags, cwd);
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
        else if (format === "sarif") writeOut(formatSarif(result, cat, env.version));
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
  };
}
