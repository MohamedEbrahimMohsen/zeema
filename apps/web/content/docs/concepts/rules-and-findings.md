---
title: Rules and findings
description: Structural findings block a save; rule findings never do. How the linter reaches each one.
order: 3
---

Two kinds of thing can be wrong with a design, and Zeema keeps them apart everywhere: in the
engine, in the API, in the command line and in the editor.

| | Structural finding | Rule finding |
|---|---|---|
| Means | The document is invalid | The design may be wrong |
| Examples | Unknown component, edge to a missing node, enum value that is not in the enum | No dead-letter queue, retry without backoff, single-region datastore |
| Severity | Always an error | `error`, `warning` or `info` |
| Blocks a save | **Yes**, always | **No**, never |
| Fails `zeema lint` | Yes | At or above `--fail-on`, default `error` |
| Produced by | `packages/core/structure.js` | `packages/core/rules.js` |

> [!WARNING]
> There is no setting that lets a structurally invalid design be stored. The web API answers
> `422` with the findings attached, the command line exits `1`, and the canvas refuses to save.
> A document nothing can parse is not a design.

## How the linter reaches a finding

For every rule, in order:

1. **Select subjects.** Nodes of a kind or category, edges, or the design itself — once each.
2. **Resolve effective properties** for each node: the node's `props`, then the component's
   `defaults`, then the property definition's `default`. A property that resolves to nothing is
   omitted rather than set to null.
3. **Evaluate the predicate** against the subject, the design's requirements, the node's group
   ancestry and the edges touching it.
4. **Emit the message** with the rule's severity, for every subject where the predicate is true.

Everything is deterministic. The same design and the same catalogue always produce the same
findings, in the same order.

## Severities

- `error` — data loss, availability or correctness. Fails a CI gate.
- `warning` — performance and cost. Comments without failing.
- `info` — style. Listed and nothing more.

The severity is a property of the rule, not of the design, and it is chosen when the rule is
written. [Governance](/docs/governance) has the criteria.

## What a finding looks like

From the command line:

```bash
zeema lint architecture/checkout.yaml
```

```text
  error    queue-missing-dlq         Queue 'orders-queue' receives async traffic but has no dead-letter queue.
  error    datastore-missing-backup  Datastore 'orders-db' has no backup or no retention policy declared.
  warning  sync-chain-too-deep       Entry point 'api' starts a synchronous call chain deeper than 3 hops while the design states a p95 latency target.

2 errors, 1 warning
```

From the API, and from the editor that calls it:

```json
{
  "valid": true,
  "findings": [
    {
      "id": "queue-missing-dlq",
      "severity": "error",
      "message": "Queue 'orders-queue' receives async traffic but has no dead-letter queue.",
      "blocking": false,
      "subject": { "type": "node", "ref": "orders-queue" }
    }
  ],
  "counts": { "nodes": 3, "edges": 2, "groups": 0 }
}
```

`valid` is about structure alone. `blocking` is `true` only on a structural finding, and it is
the single flag storage consults. `subject` is what the canvas highlights: `node`, `edge` (by
index) or `design`.

> [!NOTE]
> Structural findings come first and stop the run: when a document does not parse, or names a
> component that does not exist, the rules are not evaluated at all. There is no point asking
> whether a queue has a dead-letter queue when nothing knows it is a queue.

## Turning a rule off

In your own repository, `zeema.config.json` disables rules per path:

```json
{
  "designs": ["architecture"],
  "failOn": "error",
  "disable": {}
}
```

`failOn` sets the severity at which the command exits non-zero; `never` reports without failing.
Disabling is per repository and never travels with the design, so a published design always shows
every finding it has.

## Where to look next

- [Rules reference](/docs/rules) — the predicate vocabulary and every rule that ships.
- [Command line](/docs/cli) — formats, exit codes and the CI workflow.
- Every rule also has its own page, with the condition in plain English and the reference designs
  whose broken twin trips it.
