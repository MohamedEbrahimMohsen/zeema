---
title: Command line
description: Every zeema command, its flags, its output formats and its exit codes.
order: 4
---

`zeema` runs the same engine this site runs. It needs no account, no network and no database.

```bash
npx @zeema/cli <command>
```

```text
zeema <command>

  lint [paths...]        structure and rules on design files (default: config "designs" or cwd)
                         --format human|json|sarif  --fail-on error|warning|info|never  --out <file>
  validate               the whole catalogue repository gate            --root <repo>
  render <design>        --format svg|mermaid  --out <file>  --theme auto|light|dark
  catalogue <sub>        find <words...> | component <id> | kind <id> | kinds | providers <kind>
  init [dir]             starter design, config, editor schema mapping, CI workflow
  version
```

## Exit codes

| Code | Means |
|---|---|
| `0` | Clean, or findings below the failing severity |
| `1` | A structural problem, or findings at or above the failing severity |
| `2` | A usage error, an unreadable file, or an unknown format |

A structural problem always fails, whatever `--fail-on` says. It is not an opinion you can turn
down.

## zeema lint

Runs structure first, then rules, over every design file it is given.

```bash
zeema lint
zeema lint architecture/checkout.zeema.yaml
zeema lint architecture --fail-on warning
zeema lint --format sarif --out zeema.sarif
```

| Flag | Values | Default |
|---|---|---|
| `--format` | `human`, `json`, `sarif` | `human` |
| `--fail-on` | `error`, `warning`, `info`, `never` | `error`, or `failOn` from the config |
| `--out` | A file path; `-o` is the short form | standard output |

With no paths it uses `designs` from `zeema.config.json`, and the working directory if there is
no config. A directory is walked for files named `design.yaml`, `design.broken.yaml` or anything
matching `*.zeema.yaml`; `node_modules` and dot-directories are skipped.

### The config file

```json
{
  "designs": ["architecture"],
  "failOn": "error",
  "disable": {}
}
```

`disable` is a map of rule id to anything truthy. A disabled rule is skipped — except where the
finding is blocking, which nothing can disable.

### Output: human

```text
architecture/checkout.zeema.yaml
  error  queue-missing-dlq                         Queue 'orders-queue' receives async traffic but has no dead-letter queue.  (line 14)
  warn   sync-chain-too-deep                       Entry point 'api' starts a synchronous call chain deeper than 3 hops.  (line 9)
1 file: 1 error, 1 warning, 0 info
```

A file with nothing to say prints `ok    <file>`.

### Output: json

```json
{
  "version": 1,
  "files": [
    {
      "file": "architecture/checkout.zeema.yaml",
      "findings": [
        {
          "file": "architecture/checkout.zeema.yaml",
          "line": 14,
          "id": "queue-missing-dlq",
          "severity": "error",
          "message": "Queue 'orders-queue' receives async traffic but has no dead-letter queue.",
          "blocking": false,
          "subject": { "type": "node", "ref": "orders-queue" }
        }
      ]
    }
  ],
  "counts": { "files": 1, "error": 1, "warning": 0, "info": 0, "blocking": 0 }
}
```

### Output: sarif

Static Analysis Results Interchange Format, for GitHub code scanning. `zeema init` writes a
workflow that uploads it, so findings appear as annotations on the pull request.

## zeema validate

The whole-repository gate over a **catalogue**: every kind, component, rule, locale entry, icon
and reference design. This is what you run when contributing to the vocabulary, not when
describing a system.

```bash
zeema validate
zeema validate --root ../zeema
```

The catalogue root is resolved in this order: `--root`, then `ZEEMA_ROOT`, then the nearest
ancestor of the working directory holding both `kinds/` and `components/`, then the repository the
package itself lives in.

It prints its checks as it goes, then either `all checks passed` or a `PROBLEMS` list and exit
code `1`.

## zeema render

```bash
zeema render architecture/checkout.zeema.yaml --format svg --out checkout.svg
zeema render architecture/checkout.zeema.yaml --format mermaid
```

| Flag | Values | Default |
|---|---|---|
| `--format` | `svg`, `mermaid` | `svg` |
| `--theme` | `auto`, `light`, `dark` | `auto` |
| `--direction` | `TD`, `LR`, … (Mermaid only) | `TD` |
| `--out` | A file path | standard output |

No positions are read or written: the layout is computed from groups, nodes and edges by the same
implementation the canvas uses, so the picture is never out of date with the document.

## zeema catalogue

```bash
zeema catalogue find message queue
zeema catalogue component sqs
zeema catalogue kind queue
zeema catalogue kinds
zeema catalogue providers queue
```

| Subcommand | Prints |
|---|---|
| `find <words...>` | Components whose id, name, description, kind or provider contain **every** word |
| `component <id>` | The product, its kind and provider, and its effective properties with the source of each value |
| `kind <id>` | The kind's properties, then its components grouped by provider |
| `kinds` | Every kind with its category and a component count |
| `providers <kind>` | How many components each provider has for that kind |

`component` marks where each value came from — `component`, `kind`, `REQUIRED` or `unset` — which
is the fastest way to see what a node will resolve to before you write it.

A search that matches nothing exits `1`; an unknown subcommand exits `2`.

## zeema init

```bash
zeema init
zeema init ./my-service
```

Writes four files and never overwrites an existing one:

| File | What it is |
|---|---|
| `architecture/checkout.zeema.yaml` | A starter design |
| `zeema.config.json` | Paths, failing severity, disabled rules |
| `.github/workflows/zeema.yml` | A pull-request check that also uploads SARIF |
| `.vscode/settings.json` | Maps `*.zeema.yaml` and `design.yaml` to the design schema |

`.vscode/settings.json` is the one exception to "never overwrites": an existing file is read,
the `yaml.schemas` entry is merged in, and the rest is left alone.

## zeema version

```bash
zeema version
```

Prints `zeema <version>` and exits `0`.

## In continuous integration

The workflow `init` writes runs the linter twice on purpose: once to produce SARIF for the code
scanning tab, and once to actually fail the check.

```yaml fragment
- run: npx --yes @zeema/cli lint --format sarif --out zeema.sarif || true
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: zeema.sarif
- run: npx --yes @zeema/cli lint
```

The `|| true` is on the SARIF run alone: a failing lint must still upload its findings before the
second run reports the failure.
