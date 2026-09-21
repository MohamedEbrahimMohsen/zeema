---
title: Rules reference
description: How a rule file is shaped, every predicate in the vocabulary, and the full list of rules that ship.
order: 2
---

A rule is one file, one check, and a sentence a reviewer would have written. The vocabulary below
is fixed on purpose: a rule that cannot be written with it is a request to extend the list, with
the rule as the evidence — not a request for an expression language.

## The shape of a rule file

```yaml
schemaVersion: "1"
type: "rule"
id: "queue-missing-dlq"
severity: "error"
select:
  node:
    kind: "queue"
when:
  all:
    - prop: "deadLetterQueue"
      equals: false
    - hasEdge:
        direction: "in"
        mode: "async"
message: "Queue '{{node.id}}' receives async traffic but has no dead-letter queue."
```

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | kebab-case, and it reads as the *problem*, not the fix: `queue-missing-dlq`, never `add-dlq` |
| `severity` | yes | `error`, `warning` or `info` |
| `select` | yes | What the rule is evaluated against, once per match |
| `when` | yes | The predicate. The rule fires where it is true |
| `message` | yes | One sentence. May interpolate `{{node.id}}`, `{{edge.from}}`, `{{edge.to}}`, `{{design.id}}` |

The display name, the rationale and the description live in `locales/en.yaml`, keyed by the rule
id, like everything else people read.

## select

`select` chooses the subject, and the subject decides which predicates make sense.

| Form | Subject |
|---|---|
| `node: { kind: "queue" }` | Every node whose component's kind is `queue`. `kind` may be a list |
| `node: { category: "data" }` | Every node whose kind's category matches. May be a list |
| `edge: { mode: "sync" }` | Every edge, optionally filtered by `mode` and `delivery` |
| `design: true` | The design itself, once |

> [!WARNING]
> Rules select by **kind or category, never by component**. A rule about Kafka is really a rule
> about streams with a property Kafka happens to set. Selecting a product would make the rule
> useless the moment someone swapped the product, which is exactly the swap the rule should
> survive.

## The predicate vocabulary

Predicates compose with `all`, `any` and `not`. Everything else is a leaf.

### Composition

```yaml
when:
  all:
    - prop: "replication"
      equals: "none"
    - not:
        requirement: "availability.multiRegion"
        equals: true
```

| Form | True when |
|---|---|
| `all: [...]` | Every listed predicate is true |
| `any: [...]` | At least one is true |
| `not: <predicate>` | The predicate is false |

### Node properties

```yaml
when:
  prop: "evictionPolicy"
  exists: false
```

| Predicate | True when |
|---|---|
| `prop: p, equals: v` | The effective value of `p` is `v` |
| `prop: p, in: [v1, v2]` | The effective value is one of the list |
| `prop: p, exists: bool` | Whether `p` resolves to any value at all |
| `prop: p, gt: n` / `lt: n` | Integer comparison. An absent value is never greater or less |

The value tested is the **effective** value: the node's `props`, then the component's `defaults`,
then the property definition's `default`. A property that resolves to nothing is omitted, so
`exists: false` is true both for a property nobody set and for a name that is not a property of
this node's kind at all.

Exactly one comparison applies per predicate, and they are tested in this order: `exists`, `in`,
`gt`, `lt`, `equals`.

### Edge fields

```yaml
select:
  edge:
    mode: "sync"
when:
  field: "timeoutMs"
  exists: false
```

`field` reads one of `mode`, `delivery`, `protocol`, `timeoutMs`, `retryPolicy`, `idempotent`,
`circuitBreaker`, `fallback`, `batched`, and takes the same comparisons as `prop`.

### Node NFRs

```yaml
when:
  nfr: { rps: { gt: 10000 } }
```

Compares a node's `nfr` value. `rps` and `latencyP95Ms` are allowed. The comparison object takes
exactly one of `eq`, `gt` or `lt`.

### Design requirements

```yaml
when:
  requirement: "availability.multiRegion"
  equals: true
```

| Predicate | True when |
|---|---|
| `requirement: path, equals: v` | The requirement at `path` equals `v` |
| `requirement: path, exists: bool` | Whether the requirement is set |
| `requirement: path, gt / lt: n` | Integer comparison on the requirement |

Available on every subject, because the requirement belongs to the design, not to the node.
An absent requirement never equals anything.

### Edges around a node

```yaml
when:
  hasEdge:
    direction: "in"
    mode: "async"
```

`hasEdge` is true when at least one edge in that direction matches the filter.

| Key | Values |
|---|---|
| `direction` | `in`, `out`, `any` |
| `mode` | `sync`, `async` |
| `delivery` | `at-most-once`, `at-least-once`, `exactly-once` |
| `peerKind` | The kind of the node at the other end |
| `peerCategory` | The category of the node at the other end |
| `count` | A comparison — `{ gt: 3 }` — over the number of matching edges |

```yaml
when:
  hasEdge:
    direction: "out"
    mode: "sync"
    peerCategory: "external"
    count: { gt: 2 }
```

### Nodes in the design

```yaml
when:
  hasNode:
    kind: "custom"
```

True when the design contains at least one node of that `kind` or `category`. Available on every
subject.

### Boundaries

```yaml
when:
  inGroup:
    kind: "region"
    count: { lt: 2 }
```

`inGroup` counts the groups of that kind in the node's ancestry — its group, that group's parent,
and so on. Without `count`, it means "at least one".

```yaml
select:
  edge: {}
when:
  crossesGroup:
    kind: "cell"
```

`crossesGroup` is an edge predicate: true when the two ends sit in different groups of that kind,
or when one of them is in none.

### Call depth

```yaml
when:
  syncChainDepth: { gt: 3 }
```

The longest path of consecutive `sync` edges starting at this node. Cycles are cut at the first
revisit, so the answer is always finite.

### Reaching across an edge

```yaml
select:
  edge:
    mode: "sync"
when:
  all:
    - to:
        prop: "usedAsPrimaryStore"
        equals: true
    - field: "timeoutMs"
      exists: false
```

`from:` and `to:` evaluate a node predicate against the edge's source or target. They are how an
edge rule asks a question about the thing at the other end.

## How "tripped by" works

Every rule ships with a reference design that trips it and one that does not.

`designs/reference/<id>/design.yaml` is the clean variant and **must trip no rule**.
`design.broken.yaml` beside it is a deliberately incorrect copy whose header comment lists the
rule ids it is expected to trip. The repository gate checks both directions: the clean design
must stay clean, the broken one must trip exactly what it claims, and a rule that no design trips
fails the gate.

That is why every rule's page lists the designs that trip it — the list is read out of those
headers, not maintained by hand.

## Severity

| Severity | For | Effect |
|---|---|---|
| `error` | Data loss, availability, correctness | Fails a CI gate |
| `warning` | Performance and cost | Comments without failing |
| `info` | Style | Listed and nothing more |

No rule finding ever blocks a save, whatever its severity. Only
[structural findings](/docs/rules-and-findings) do that.

## Every rule that ships

Generated from the catalogue this site is serving. Each id links to its own page, with the
condition in plain English, the kinds and components it covers, and the designs that trip it.

{{rules-table}}
