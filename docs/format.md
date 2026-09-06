# Arkore format specification, v1

This is the authoritative description of every document type. The JSON Schemas in
`schema/` are the machine-readable form of this page; if they disagree, this page is wrong
and the schema is fixed to match it, or the reverse, but never silently.

## 1. Document envelope

Every file in `kinds/`, `components/`, `rules/` and `designs/` is one YAML document with
the same three leading fields:

```yaml
schemaVersion: "1"       # always quoted; see governance.md for versioning
type: "kind"             # kind | component | design | rule
id: "queue"              # ^[a-z][a-z0-9-]*$ ; unique within its type
```

Conventions that apply everywhere:

- **Quote every string value**, including enum values and `schemaVersion`. Unquoted
  `NO`, `yes`, `1.0` and similar parse as booleans or numbers in YAML.
- Property names are **camelCase**. Ids and enum values are **kebab-case**.
- No display text in any document except `locales/`. Names and descriptions are looked
  up by id.
- The first line of every file is a `yaml-language-server` comment pointing at its
  schema so editors validate it without extra configuration.

## 2. The three layers

| Layer | Folder | Answers |
|---|---|---|
| Kind | `kinds/` | What is a queue, abstractly? Which properties does any queue have? |
| Component | `components/` | What is Kafka, concretely? Which kind is it, what does it add, what does it default? |
| Design | `designs/` | Which components does this system use, how are they connected, what does it promise? |

Rules (`rules/`) sit beside the layers and read from all three.

Inheritance is exactly **one hop**: a component extends one kind. A kind never extends
another kind. If two kinds share properties, that is accepted duplication in v1.

## 3. Kind

```yaml
schemaVersion: "1"
type: "kind"
id: "queue"
category: "messaging"
properties:
  delivery:        { type: "enum", values: ["at-most-once", "at-least-once", "exactly-once"], required: true }
  ordering:        { type: "enum", values: ["none", "per-key", "global"], default: "none" }
  deadLetterQueue: { type: "boolean", default: false }
```

| Field | Required | Meaning |
|---|---|---|
| `category` | yes | One of `messaging`, `compute`, `data`, `edge`, `client`, `ops`, `security`. Rules may select by category. |
| `properties` | yes | Map of property name to property definition. May be empty. |

### Property definition

| Field | Required | Meaning |
|---|---|---|
| `type` | yes | `boolean`, `integer`, `string`, `enum`, `ref` |
| `values` | for `enum` | Allowed string values |
| `default` | no | Value assumed when neither component nor node sets one |
| `required` | no | If `true`, a node must resolve a value from its own `props`, the component `defaults`, or this `default`. Default `false`. |
| `refKind` | for `ref` | The kind the referenced node must have. A `ref` value in a design is another node id. |

A property with neither `default` nor `required` is optional and may be absent. Rules
test absence with `exists: false`.

## 4. Component

```yaml
schemaVersion: "1"
type: "component"
id: "kafka"
kind: "queue"
defaults: { replay: true, ordering: "per-key" }
properties:
  partitions: { type: "integer" }
```

| Field | Required | Meaning |
|---|---|---|
| `kind` | yes | Id of exactly one kind. |
| `defaults` | no | Values for kind properties that this implementation changes. Every key must exist on the kind. |
| `properties` | no | Additional properties specific to this implementation. Same definition shape as a kind property. Must not redefine a kind property. |

### Property resolution order

For a node in a design, the effective value of a property is the first found in:

1. The node's `props`
2. The component's `defaults`
3. The property definition's `default` (on the kind, or on the component for component-specific properties)
4. Absent

A node may only set properties that exist on its component's kind or on the component
itself. Setting an unknown property is an error.

## 5. Design

```yaml
schemaVersion: "1"
type: "design"
id: "order-processing"
requirements:
  availability: { multiRegion: true, sla: "99.95" }
  messaging:    { replay: true }
  latency:      { p95Ms: 300 }
groups:
  - { id: "eu-west-1", kind: "region" }
  - { id: "core-vpc",  kind: "vpc", parent: "eu-west-1" }
nodes:
  - id: "orders-queue"
    component: "kafka"
    group: "core-vpc"
    props: { deadLetterQueue: false, partitions: 12 }
    nfr:   { rps: 500 }
edges:
  - { from: "api", to: "orders-queue", protocol: "kafka", mode: "async", delivery: "at-least-once" }
```

### requirements

Promises the whole design makes. Rules compare nodes against them.

| Path | Type | Meaning |
|---|---|---|
| `availability.multiRegion` | boolean | The system must survive the loss of one region |
| `availability.sla` | string | Availability target, e.g. `"99.95"`. Quoted. |
| `messaging.replay` | boolean | Consumers must be able to re-read past messages |
| `latency.p95Ms` | integer | End-to-end p95 latency target for the primary request path |

New requirement paths are added through governance, not ad hoc.

### groups

Nested boundaries. A node belongs to at most one group; a group may have one `parent`.
Group kinds in v1: `region`, `availability-zone`, `vpc`, `trust-zone`, `system`.

A node's **ancestry** is its group, that group's parent, and so on. Rules ask questions
like "how many `region` groups are in this node's ancestry".

Groups carry no properties in v1. They exist for rules and for renderers, which draw them
as nested boxes.

### nodes

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique within the design |
| `component` | yes | Id of a component in `components/` |
| `group` | no | Id of a group in this design |
| `props` | no | Property values; see resolution order above |
| `nfr` | no | `rps` (integer), `latencyP95Ms` (integer), `consistency` (`strong` or `eventual`) |

### edges

Directed. `from` and `to` are node ids in this design.

| Field | Required | Meaning |
|---|---|---|
| `protocol` | yes | Free string in v1: `http`, `grpc`, `kafka`, `postgres`, `redis`. Will become an enum once real designs show the real set. |
| `mode` | yes | `sync` (caller waits) or `async` (caller continues) |
| `delivery` | no | `at-most-once`, `at-least-once`, `exactly-once`. Meaningful for async edges. |
| `label` | no | Free text for renderers. Never read by rules. |

Layout, coordinates and colours are **not** part of the design. A renderer derives a
diagram from groups, nodes and edges alone.

## 6. Rule

```yaml
schemaVersion: "1"
type: "rule"
id: "queue-missing-dlq"
severity: "error"
select: { node: { kind: "queue" } }
when:
  all:
    - { prop: "deadLetterQueue", equals: false }
    - { hasEdge: { direction: "in", mode: "async" } }
message: "Queue '{{node.id}}' receives async traffic but has no dead-letter queue."
```

### select

Chooses the subject the rule is evaluated against, once per match.

| Form | Subject |
|---|---|
| `node: { kind: "queue" }` | Every node whose component's kind is `queue`. `kind` may be a list. |
| `node: { category: "data" }` | Every node whose kind's category matches. May be a list. |
| `edge: { mode: "sync" }` | Every edge, optionally filtered by mode. |
| `design: true` | The design itself, once. |

### when

A predicate. The rule fires when `when` is true for the subject. Predicates compose with
`all`, `any` and `not`. Only the following leaf predicates exist in v1; a rule that cannot
be written with them is a request to extend this list, not to add an expression language.

| Predicate | Subject | Meaning |
|---|---|---|
| `prop: p, equals: v` | node | Effective value of `p` equals `v` |
| `prop: p, in: [v1, v2]` | node | Effective value is one of the list |
| `prop: p, exists: bool` | node | Whether `p` resolves to any value |
| `requirement: path, equals: v` | any | The design requirement at `path` equals `v`. Absent requirements never equal anything. |
| `requirement: path, exists: bool` | any | Whether the requirement is set |
| `hasEdge: { direction, mode?, peerKind? }` | node | At least one edge in that direction (`in`, `out`, `any`), optionally with that mode and a peer node of that kind |
| `inGroup: { kind, count? }` | node | Number of groups of that kind in the node's ancestry. Without `count`, means at least one. |
| `syncChainDepth: { gt / lt / eq }` | node | Longest path of consecutive `sync` edges starting at this node. Cycles are cut at first revisit. |

Comparison objects accept exactly one of `eq`, `gt`, `lt`.

### severity and message

`error` fails a CI gate, `warning` comments without failing, `info` is advisory. The
message may interpolate `{{node.id}}`, `{{edge.from}}`, `{{edge.to}}` and `{{design.id}}`.

## 7. Locales

`locales/<lang>.yaml` holds display text keyed by id under `categories`, `kinds`,
`components` and `rules`. `en.yaml` is mandatory and complete. Other languages are
optional and may be partial; consumers fall back to `en`.

## 8. What v1 deliberately does not have

- Kind-to-kind inheritance
- Object or list property types
- Properties on groups or edges beyond the fixed fields
- Expressions in rules
- Layout hints
- Any reference to files outside the repository

Each is a candidate for v2 once a real design proves it necessary. Record the evidence in
`docs/schema-gaps.md`.
