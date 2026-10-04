# zeema

Software architecture as typed, queryable data. A Zeema design is one YAML file: every node names
a catalogue component (which brings its kind), every edge carries its contract, and rules check
the whole. This package is the command line and a local MCP server for coding agents, running the
same engine as [zeema.dev](https://zeema.dev). No account, no network, no database.

## Install

```bash
npm i -g zeema          # then: zeema lint
npx zeema lint          # or run it without installing
```

Node.js 20 or later.

## Commands

```text
zeema lint [paths...]     structure and rules on design files
                          --format human|json|sarif  --fail-on error|warning|info|never  --out <file>
zeema render <design>     --format svg|mermaid  --theme auto|light|dark  --layout <file>|none  --out <file>
zeema catalogue <sub>     find <words...> | component <id> | kind <id> | kinds | providers <kind>
zeema init [dir]          starter design, config, editor schema mapping, CI workflow
zeema mcp                 MCP server on stdio, for coding agents
zeema version             this package's version and the catalogue it carries
zeema help
```

Exit codes: `0` clean, `1` a structural problem or findings at or above `--fail-on`, `2` a usage
or input error.

```bash
zeema init                                   # architecture/checkout.zeema.yaml and friends
zeema lint                                   # every design under the configured paths
zeema render architecture/checkout.zeema.yaml --out checkout.svg
zeema catalogue find message queue
```

The catalogue (kinds, components, rules, icons) is bundled into the package; `zeema version`
names the commit it was built from.

## MCP server for coding agents

`zeema mcp` speaks the Model Context Protocol on stdio. An agent can lint, read and render the
designs in the project it is working on, and look things up in the catalogue. It only reads, and
only files inside the directory it was started in.

Claude Code:

```bash
claude mcp add zeema -- npx -y zeema mcp
```

Cursor (`.cursor/mcp.json`) or VS Code (`.vscode/mcp.json`, where the key is `servers`):

```json
{
  "mcpServers": {
    "zeema": { "command": "npx", "args": ["-y", "zeema", "mcp"] }
  }
}
```

| Tool | Does |
|---|---|
| `lint_design` | Structure and rules on a design file, a directory, or YAML text; the JSON of `zeema lint --format json` |
| `read_design` | The YAML, plus a summary of groups, nodes (component and kind) and edges |
| `render_design` | SVG or Mermaid text |
| `catalogue_find` | Components matching every word |
| `catalogue_component` | One component and its effective properties |
| `catalogue_kind` | One kind, its properties and its components by provider |
| `list_kinds` | Every kind with its category and component count |
| `list_providers` | Component counts per provider, for a kind or overall |
| `explain_rule` | What a rule checks and why |
| `design_schema` | The JSON Schema of a design file |

Resources: `zeema://schema` and `zeema://kinds`.

## Learn more

- Documentation: <https://zeema.dev/docs>
- Command line reference: <https://zeema.dev/docs/cli>
- MCP reference: <https://zeema.dev/docs/mcp>
- Source: <https://github.com/MohamedEbrahimMohsen/zeema>

MIT licensed.
