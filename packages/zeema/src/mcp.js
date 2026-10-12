// `zeema mcp`: a Model Context Protocol server on stdio, so a coding agent can lint, read and
// render the designs in the project it is working on and query the catalogue they are written
// against. Local files only: every path resolves inside the directory the server was started in,
// and the server never writes a file. Each tool calls the same code the commands call.
import fs from "node:fs";
import path from "node:path";
import {
  componentInfo,
  findComponents,
  kindInfo,
  listKinds,
  providerCounts,
} from "@zeema/cli/catalogue";
import { collectDesigns, formatJson, lintFiles, lintResult, lintText } from "@zeema/cli/lint";
import { readConfig, readDesign, renderDesign, resolveInside } from "@zeema/cli/main";
import { describeNode, describeRule } from "@zeema/core/describe";
import { isSubsystem, nodeModules } from "@zeema/core/document";

const json = (value) => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
const text = (value) => ({ content: [{ type: "text", text: value }] });
const own = (o, k) => (o && Object.hasOwn(o, k) ? o[k] : undefined);

/** The tools, as plain functions over a working directory and a catalogue; `serve` registers them. */
export function tools({ cwd, catalogue, icons }) {
  const base = fs.realpathSync(cwd);
  const rel = (abs) => path.relative(base, abs).split(path.sep).join("/") || ".";

  return {
    lint_design({ path: p, yaml }) {
      const cat = catalogue();
      const config = readConfig(base);
      const options = { cwd: base, disable: config.disable ?? {} };
      if (yaml !== undefined) {
        if (p !== undefined) throw new Error("give either path or yaml, not both");
        return formatJson(lintResult([lintText(yaml, "<input>", cat, options)]));
      }
      const roots = (p !== undefined ? [p] : (config.designs ?? ["."])).map((q) =>
        resolveInside(base, q),
      );
      // A directory may hold a link out of the working directory; drop what resolves outside.
      const files = collectDesigns(roots, base).filter((f) => {
        try {
          resolveInside(base, f);
          return true;
        } catch {
          return false;
        }
      });
      if (!files.length) throw new Error("no design files found");
      return formatJson(lintFiles(files, cat, options));
    },

    read_design({ path: p }) {
      const file = resolveInside(base, p);
      const cat = catalogue();
      const { text: yaml, doc } = readDesign(file);
      const kindOf = (component) => own(cat.components, component)?.kind ?? null;
      return {
        path: rel(file),
        yaml,
        summary: {
          id: doc.id,
          ...(doc.requirements ? { requirements: doc.requirements } : {}),
          groups: (doc.groups ?? []).map((g) => ({
            id: g.id,
            kind: g.kind,
            ...(g.label ? { label: g.label } : {}),
            ...(g.parent ? { parent: g.parent } : {}),
            ...(g.count !== undefined ? { count: g.count } : {}),
          })),
          nodes: doc.nodes.map((n) => ({
            id: n.id,
            component: n.component,
            kind: kindOf(n.component),
            ...(n.label ? { label: n.label } : {}),
            ...(n.group ? { group: n.group } : {}),
            ...(n.ref ? { ref: n.ref } : {}),
            // The modules of the code it runs; an edge end names one as `node/module`.
            ...(nodeModules(n).length ? { modules: nodeModules(n) } : {}),
            // A reference, a subsystem box that has none yet, or a node with modules reads as one
            // sentence.
            ...(n.ref || isSubsystem(cat, n) || nodeModules(n).length
              ? { description: describeNode(n, cat) }
              : {}),
          })),
          edges: doc.edges,
        },
      };
    },

    render_design({ path: p, format, theme }) {
      const file = resolveInside(base, p);
      // The layout sidecar beside the design is read too; it must not lead out either.
      const sidecar = `${file.replace(/\.ya?ml$/i, "")}.layout.json`;
      if (fs.existsSync(sidecar)) resolveInside(base, sidecar);
      const cat = catalogue();
      return renderDesign(file, cat, icons(cat), { format, theme, cwd: base });
    },

    catalogue_find({ words, limit = 50 }) {
      const rows = findComponents(catalogue(), words);
      return { total: rows.length, components: rows.slice(0, limit) };
    },

    catalogue_component({ id }) {
      const c = componentInfo(catalogue(), id);
      if (!c) throw new Error(`unknown component ${id}; catalogue_find searches by words`);
      return c;
    },

    catalogue_kind({ id }) {
      const k = kindInfo(catalogue(), id);
      if (!k) throw new Error(`unknown kind ${id}; list_kinds lists them`);
      return k;
    },

    list_kinds() {
      return listKinds(catalogue());
    },

    list_providers({ kind }) {
      const cat = catalogue();
      if (kind !== undefined && !own(cat.kinds, kind))
        throw new Error(`unknown kind ${kind}; list_kinds lists them`);
      return providerCounts(cat, kind);
    },

    explain_rule({ id }) {
      const cat = catalogue();
      const rule = cat.rules.find((r) => r.id === id);
      if (!rule) throw new Error(`unknown rule ${id}; a lint finding's id names its rule`);
      try {
        return describeRule(rule, cat.locale);
      } catch {
        const t = own(cat.locale.rules, id) ?? {};
        return { id, severity: rule.severity, name: t.name ?? id, ...t, message: rule.message };
      }
    },

    design_schema() {
      return JSON.stringify(catalogue().schema, null, 2);
    },
  };
}

/** Start the server on stdio; resolves when the client goes away. */
export async function serve({ cwd, version, catalogue, icons }) {
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const { z } = await import("zod");
  const t = tools({ cwd, catalogue, icons });
  const server = new McpServer({ name: "zeema", version });
  const tool = (name, description, inputSchema, run, asText = false) =>
    server.registerTool(
      name,
      { description, inputSchema, annotations: { readOnlyHint: true, openWorldHint: false } },
      async (args) => (asText ? text(run(args ?? {})) : json(run(args ?? {}))),
    );

  const designPath = z
    .string()
    .describe("A design file, relative to the directory the server runs in (it must stay inside)");

  tool(
    "lint_design",
    "Check a Zeema design: structural problems (always errors, they block saving) then the " +
      "catalogue's rules. Give `path` (a design file or a directory of them) or `yaml` (the text " +
      "of a design); neither lints the project as `zeema lint` would. Returns the same JSON as " +
      "`zeema lint --format json`: files with findings { line, id, severity, message, blocking, " +
      "subject } and counts.",
    {
      path: z
        .string()
        .optional()
        .describe("A design file or directory, inside the working directory"),
      yaml: z.string().optional().describe("The text of a design, to lint without a file"),
    },
    t.lint_design,
    true,
  );
  tool(
    "read_design",
    "Read a Zeema design file: its YAML text exactly as on disk, and a summary of its groups, its " +
      "nodes (each with its component and that component's kind, the design it references " +
      "when it references one, and the modules of its code when it lists any) and its edges. An " +
      "edge end written node/module is a module of that node.",
    { path: designPath },
    t.read_design,
  );
  tool(
    "render_design",
    "Draw a Zeema design as SVG or Mermaid text. An SVG uses the `<name>.layout.json` beside the " +
      "design when there is one, as `zeema render` does.",
    {
      path: designPath,
      format: z.enum(["svg", "mermaid"]).describe("svg or mermaid"),
      theme: z.enum(["auto", "light", "dark"]).optional().describe("SVG colours; default auto"),
    },
    t.render_design,
    true,
  );
  tool(
    "catalogue_find",
    "Search the catalogue for components whose id, name, description, kind or provider contain " +
      "every one of the words. Returns { total, components: [{ id, provider, kind, name }] }; " +
      "use a component id as a node's `component` in a design.",
    {
      words: z
        .array(z.string())
        .min(1)
        .describe('Words that must all match, e.g. ["message", "queue"]'),
      limit: z.number().int().positive().optional().describe("Most rows to return; default 50"),
    },
    t.catalogue_find,
  );
  tool(
    "catalogue_component",
    "Describe one catalogue component: its name, kind, provider, and every property it resolves " +
      "to, with where each value comes from (component, kind, REQUIRED or unset).",
    { id: z.string().describe("A component id, e.g. sqs or kafka") },
    t.catalogue_component,
  );
  tool(
    "catalogue_kind",
    "Describe one kind: its category, its properties, and its components grouped by provider.",
    { id: z.string().describe("A kind id, e.g. queue or object-store") },
    t.catalogue_kind,
  );
  tool(
    "list_kinds",
    "List every kind with its name, category and number of components.",
    {},
    t.list_kinds,
  );
  tool(
    "list_providers",
    "List the providers (aws, azure, gcp, ... default) with how many components each has, for " +
      "one kind or for the whole catalogue.",
    { kind: z.string().optional().describe("A kind id; omit for the whole catalogue") },
    t.list_providers,
  );
  tool(
    "explain_rule",
    "Explain a rule by the id a lint finding carries: its name, why it matters, what it selects " +
      "and the condition it tests.",
    { id: z.string().describe("A rule id, e.g. queue-missing-dlq") },
    t.explain_rule,
  );
  tool(
    "design_schema",
    "The JSON Schema a Zeema design file is written against.",
    {},
    t.design_schema,
    true,
  );

  server.registerResource(
    "schema",
    "zeema://schema",
    { description: "The JSON Schema of a Zeema design file", mimeType: "application/json" },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: t.design_schema() }],
    }),
  );
  server.registerResource(
    "kinds",
    "zeema://kinds",
    { description: "Every kind in the catalogue", mimeType: "application/json" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(t.list_kinds(), null, 2),
        },
      ],
    }),
  );

  const closed = new Promise((resolve) => {
    server.server.onclose = resolve;
    process.stdin.once("end", resolve);
  });
  await server.connect(new StdioServerTransport());
  await closed;
}
