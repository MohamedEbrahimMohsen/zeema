---
title: MCP server
description: zeema mcp, the local Model Context Protocol server that lets coding agents lint, read and render designs and query the catalogue.
order: 5
---

`zeema mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server built into the
`zeema` package. A coding agent (Claude Code, Cursor, GitHub Copilot in VS Code, or any other MCP
client) starts it on your machine and talks to it over standard input and output. Through it the
agent can check a design it has just edited, read one as structured data, draw it, and look up
components, kinds and rules, all with the same engine as the [command line](/docs/cli) and this
site.

It is local and read-only:

- It reads files only inside the directory it was started in, which for an agent is the project
  it has open. A path that climbs out, or a link that leads out, is refused.
- It never writes a file.
- It needs no account and makes no network calls. The catalogue is the one bundled in the
  package.

## Set it up

You need Node.js 20 or later. `npx -y zeema mcp` fetches the package on first use; with
`npm i -g zeema` installed, `zeema mcp` works as the command too.

### Claude Code

```bash
claude mcp add zeema -- npx -y zeema mcp
```

On Windows, wrap it in `cmd /c`: `claude mcp add zeema -- cmd /c npx -y zeema mcp`.

### Cursor

`.cursor/mcp.json` in the project, or `~/.cursor/mcp.json` for every project:

```json
{
  "mcpServers": {
    "zeema": { "command": "npx", "args": ["-y", "zeema", "mcp"] }
  }
}
```

### VS Code and GitHub Copilot

`.vscode/mcp.json` in the project:

```json
{
  "servers": {
    "zeema": { "type": "stdio", "command": "npx", "args": ["-y", "zeema", "mcp"] }
  }
}
```

### Any other client

The command is `npx -y zeema mcp` (or `zeema mcp`), the transport is stdio, and the working
directory should be the project root, since paths are resolved against it.

## Tools

| Tool | Input | Returns |
|---|---|---|
| `lint_design` | `path` (a design file or a directory) or `yaml` (design text); neither lints the project | The JSON of `zeema lint --format json`: findings with line, rule id, severity and whether they block, and counts |
| `read_design` | `path` | The YAML exactly as on disk, and a summary: groups, nodes with their component and kind, edges |
| `render_design` | `path`, `format` (`svg` or `mermaid`), optional `theme` | The drawing as text; an SVG uses the `.layout.json` beside the design when there is one |
| `catalogue_find` | `words`, optional `limit` (default 50) | Components matching every word: id, provider, kind, name |
| `catalogue_component` | `id` | The component, its kind and provider, and every effective property with where its value comes from |
| `catalogue_kind` | `id` | The kind, its properties, and its components by provider |
| `list_kinds` | none | Every kind with its name, category and component count |
| `list_providers` | optional `kind` | Component counts per provider, for that kind or overall |
| `explain_rule` | `id`, as a lint finding names it | The rule's name, rationale, description, what it selects and the condition it tests |
| `design_schema` | none | The JSON Schema of a design file |

With no `path`, `lint_design` lints what `zeema lint` would: the `designs` paths of
`zeema.config.json`, or the whole directory. The config's `disable` map applies as it does on the
command line.

Structural findings always come back as errors with `blocking: true`. An agent should fix those
first: a design with a structural problem is not checked against the rules at all.

## Resources

| URI | Content |
|---|---|
| `zeema://schema` | The JSON Schema of a design file |
| `zeema://kinds` | Every kind, as `list_kinds` returns it |

## A typical loop

1. The agent calls `catalogue_find` to pick components for the boxes it needs.
2. It writes or edits the design file.
3. It calls `lint_design` on the file and fixes what is blocking, then what the rules report,
   using `explain_rule` for the reasoning behind a finding.
4. It calls `render_design` with `mermaid` to show you the result in the conversation.
