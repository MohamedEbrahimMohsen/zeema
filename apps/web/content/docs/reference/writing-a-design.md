---
title: Writing a design
description: Every field of the design document — the envelope, requirements, groups, nodes, edges, and what makes a document structurally valid.
order: 1
---

This is the complete reference for the design document. The JSON Schemas in `schema/` are its
machine-readable form; where the two disagree, one of them is a bug and neither is changed
silently.

## Conventions

These hold in every Zeema document, not just designs.

- **Quote every string value**, including enum values and `schemaVersion`. Unquoted `NO`, `yes`,
  `on` and `1.0` parse as booleans or numbers in YAML, and will not mean what you typed.
- Property names are **camelCase**. Ids and enum values are **kebab-case**.
- No display text in any document except `locales/`. Names are looked up by id.
- The first line points at the schema, so an editor validates the file with no other setup.

## The envelope

Every design starts with the same three fields.

```yaml
# yaml-language-server: $schema=https://zeema.dev/schema/design.schema.json
schemaVersion: "1"
type: "design"
id: "order-processing"
```

| Field | Required | Meaning |
|---|---|---|
| `schemaVersion` | yes | Always the quoted string `"1"` |
| `type` | yes | `"design"` |
| `id` | yes | Matches `^[a-z][a-z0-9-]*$` and is unique among designs |

Then, in this order and all optional except `nodes` and `edges`: `requirements`, `groups`,
`nodes`, `edges`.

## requirements

What the whole design promises about itself. Rules compare nodes against these. Every path is
optional, and **an absent requirement never equals anything** — a design that promises nothing is
never judged against a promise it did not make.

```yaml
requirements:
  availability: { multiRegion: true, sla: "99.95" }
  messaging:    { replay: true }
  latency:      { p95Ms: 300 }
```

| Path | Type | Meaning |
|---|---|---|
| `availability.multiRegion` | boolean | Must survive the loss of one region |
| `availability.sla` | string | Availability target, e.g. `"99.95"`. Quoted |
| `availability.zones` | integer | Zones every stateful node is expected to span |
| `availability.regions` | integer | Regions the system runs in |
| `availability.discoveryRedundant` | boolean | DNS and coordination must have no single instance |
| `availability.degradedModeAllowed` | boolean | Fallback paths are acceptable |
| `messaging.replay` | boolean | Consumers must be able to re-read past messages |
| `messaging.exactlyOnce` | boolean | Message delivery must be exactly-once |
| `messaging.orderingScope` | `partition`, `global` | Ordering guarantee consumers rely on |
| `latency.p95Ms` | integer | p95 target for the primary request path |
| `latency.p99Us` | integer | p99 target in microseconds (exchanges, matching) |
| `latency.geoDistributed` | boolean | Users on several continents with a latency target |
| `durability.annualNines` | integer | Designed durability of stored objects, e.g. 11 |
| `durability.minReplicasAcked` | integer | Replicas that must acknowledge a write |
| `consistency.model` | `ap`, `cp` | Which side of the partition trade the design takes |
| `consistency.readAfterWrite` | boolean | A write must be visible to the next read |
| `consistency.quorumScope` | `region`, `global` | Where quorums are formed |
| `correctness.exactlyOnceEffect` | boolean | Side effects (charges, sends) must happen once |
| `correctness.reproducible` | boolean | Any past state must be rebuildable from a log |
| `correctness.tamperEvident` | boolean | Unauthorised change must be detectable |
| `correctness.billingGrade` | boolean | Counts are billed on |
| `money.zeroSum` | boolean | Every debit has a matching credit |
| `money.pci` | boolean | Card data is in scope |
| `data.reconciliation` | boolean | A batch job compares derived data to the source |
| `data.lossDetection` | boolean | Pipelines must detect dropped records |
| `data.ownershipExclusive` | boolean | One service owns each datastore |
| `data.immutableAudit` | boolean | An append-only audit log is required |
| `traffic.readWriteRatio` | integer | Reads per write on the main path |
| `traffic.skew` | `uniform`, `heavy-tail` | Whether a few keys carry most traffic |
| `traffic.peakMultiplier` | integer | Peak over average |
| `isolation.perQueue` | boolean | Each queue needs its own worker pool |
| `isolation.perEventType` | boolean | Event types must not share a pipeline |
| `isolation.tenancy` | `shared`, `cell`, `dedicated` | Blast-radius model |
| `freshness.maxSeconds` | integer | Oldest acceptable derived data |
| `security.certificateRotationAutomated` | boolean | Internal certificates rotate without humans |
| `security.credentialRotationDays` | integer | Datastore credentials rotate at least this often |
| `security.edgeAuthDeclared` | boolean | Every edge into data, secrets, queues, streams or an AI service states its `auth` |
| `observability.alertingIndependent` | boolean | Alerting must not depend on the systems it watches |

> [!NOTE]
> New requirement paths arrive through [governance](/docs/governance), not ad hoc. Each path above
> is backed by at least one intake card recording the real design that needed it.

## groups

Nested boundaries. A node belongs to at most one group; a group may have one `parent`.

```yaml
groups:
  - { id: "eu-west-1", kind: "region" }
  - { id: "prod-vpc", kind: "vpc", parent: "eu-west-1" }
  - { id: "dmz", kind: "trust-zone", parent: "prod-vpc" }
```

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique within the design |
| `kind` | yes | One of the group kinds below |
| `parent` | no | The id of another group in this design |
| `label` | no | The group's name as drawn in the source. Read by renderers, never by rules |

| Group kind | What it is |
|---|---|
| `region` | A cloud region or a data centre |
| `availability-zone` | A failure domain inside a region |
| `vpc` | A private network |
| `trust-zone` | A security boundary |
| `system` | A logical system or service boundary |
| `cell` | A failure-isolated slice serving a subset of tenants |
| `point-of-presence` | An edge site |
| `namespace` | A logical partition inside a cluster or platform (a Kubernetes namespace, an OpenShift project). It scopes names and policy, not the network or failures |

Groups carry no properties in v1 beyond `label`. They exist for rules — `inGroup`, `crossesGroup`
— and for renderers, which draw them as nested boxes.

## nodes

```yaml
nodes:
  - { id: "api", component: "aws-api-gateway" }
  - id: "orders-queue"
    component: "sqs"
    label: "Orders queue"
    group: "prod-vpc"
    props: { deadLetterQueue: true, retentionDays: 14 }
    nfr:   { rps: 500, latencyP95Ms: 40, consistency: "strong" }
```

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique within the design |
| `component` | yes | The id of a component in the catalogue |
| `label` | no | Display name from the source, kept verbatim by importers. Never read by rules |
| `group` | no | The id of a group in this design |
| `props` | no | Property values; see the resolution order below |
| `nfr` | no | `rps` (integer), `latencyP95Ms` (integer), `consistency` (`strong` or `eventual`) |
| `ref` | no | Another public design this node stands for: `{ design: "owner/slug", version }`, where `version` is a release number (1 or more) or `"head"`. An annotation: rules never read it |

### Property resolution order

The effective value of a property on a node is the first of these that exists:

1. The node's `props`
2. The component's `defaults`
3. The property definition's `default` — on the kind, or on the component for a
   component-specific property
4. Absent

A node may only set properties that exist on its component's kind or on the component itself.
Anything else is a structural error, not a warning.

> [!TIP]
> Set properties explicitly even when the default already says what you want. A property left
> unset resolves to the product's *real* default, and the product's real default is often the one
> the rules exist to complain about.

## edges

Directed. `from` and `to` are node ids in this design, or a group id for an edge to the group as
a unit, drawn once to its frame. Rules read a group end as every node inside the group, nested
groups included, as if the edge had been drawn to each: `hasEdge` on a member counts it, and an
edge rule fires on the group edge (once) when any member pair would trip it.

```yaml
edges:
  - { from: "api", to: "orders-queue", protocol: "https", mode: "async", delivery: "at-least-once" }
  - from: "checkout-service"
    to: "psp"
    protocol: "https"
    mode: "sync"
    timeoutMs: 2000
    retryPolicy: "exponential-jitter"
    idempotent: true
    circuitBreaker: true
    fallback: "degraded"
```

| Field | Required | Values |
|---|---|---|
| `from`, `to` | yes | Node or group ids in this design |
| `protocol` | yes | Free string in v1: `http`, `https`, `grpc`, `kafka`, `postgres`, `redis`, … |
| `mode` | yes | `sync` (the caller waits) or `async` (the caller continues) |
| `delivery` | no | `at-most-once`, `at-least-once`, `exactly-once`. Meaningful on async edges |
| `label` | no | Free text for renderers. Never read by rules |
| `timeoutMs` | no | Caller timeout. Rules read it on sync edges |
| `retryPolicy` | no | `none`, `fixed`, `exponential`, `exponential-jitter` |
| `idempotent` | no | The call can safely be repeated |
| `circuitBreaker` | no | The caller stops calling after repeated failures |
| `fallback` | no | `none`, `static`, `cached`, `degraded` |
| `batched` | no | Calls are coalesced |
| `auth` | no | `managed-identity`, `iam-role`, `service-account`, `workload-identity`, `api-key`, `oauth`, `mtls`, `basic`, `none` |

Those seven optional fields are the only edge properties in v1, and each exists because a real rule
reads it. Anything else about an edge goes in `label`.

`auth` says how the caller authenticates on that hop. A managed identity, an IAM role or a service
account is not a box between every caller and callee; it is how the edge authenticates:

```yaml
edges:
  - { from: "orders-api", to: "orders-db", protocol: "tds", mode: "sync", auth: "managed-identity" }
```

The canvas and the SVG export draw it as a small glyph on the line by the source end: the cloud's
own mark for `managed-identity` (Azure managed identity), `iam-role` (AWS IAM) and
`service-account` (Google Cloud IAM), a shield for `workload-identity`, a key for `api-key` and
`basic`, a lock for `mtls` and `oauth`, nothing for `none`. Any other value is a structural error.

## What makes a document structurally valid

These are checked before any rule runs, and every one of them blocks a save. The wording below is
the wording the linter uses.

| Check | Message |
|---|---|
| Node ids are unique | `duplicate node ids` |
| Group ids are unique | `duplicate group ids` |
| A group's `parent` exists | `group <id> parent missing` |
| A node's `component` is in the catalogue | `node <id> unknown component <component>` |
| A node's `group` exists | `node <id> unknown group` |
| A node only sets known properties | `node <id> unknown prop <name>` |
| An enum property's value is in the enum | `node <id> prop <name>=<value> not in enum` |
| A boolean property gets a boolean | `node <id> prop <name> not boolean` |
| An integer property gets an integer | `node <id> prop <name> not integer` |
| A string property gets a string | `node <id> prop <name> not string` |
| A `ref` property names an existing node | `ref <name> missing` |
| …of the right kind | `ref <name> wrong kind` |
| Every required property resolves | `node <id> missing required <name>` |
| Both ends of every edge exist | `edge from <id> missing: no node or group`, `edge to <id> missing: no node or group` |

On top of that, the document is checked against `schema/design.schema.json`: unknown fields,
missing required fields and wrong types are reported with the path that carried them.

> [!WARNING]
> The parser refuses YAML it does not fully support, with the line number, rather than guessing.
> It accepts block maps and sequences, flow maps and sequences, quoted and bare scalars, comments,
> blank lines and one optional `---`. Anchors, aliases, multiple documents and block scalars are
> not part of the supported subset.

## A complete design

Everything above, in one file.

```yaml complete
schemaVersion: "1"
type: "design"
id: "checkout"

requirements:
  availability: { multiRegion: false }
  messaging: { replay: false }
  correctness: { exactlyOnceEffect: true }

groups:
  - { id: "eu-west-1", kind: "region" }
  - { id: "prod-vpc", kind: "vpc", parent: "eu-west-1" }
  - { id: "dmz", kind: "trust-zone", parent: "prod-vpc" }

nodes:
  - id: "web-client"
    component: "web-browser"
    props: { platform: "web" }

  - id: "api"
    component: "aws-api-gateway"
    group: "dmz"
    props: { idempotencyKeys: true }
    nfr: { rps: 300 }

  - id: "checkout-service"
    component: "container-service"
    group: "prod-vpc"

  - id: "orders-queue"
    component: "sqs"
    group: "prod-vpc"
    props: { deadLetterQueue: true, retentionDays: 14 }

  - id: "orders-db"
    component: "postgres"
    group: "prod-vpc"
    props: { backupEnabled: true, backupRetentionDays: 30, encryptionAtRest: true }

edges:
  - { from: "web-client", to: "api", protocol: "https", mode: "sync", timeoutMs: 3000 }
  - { from: "api", to: "checkout-service", protocol: "http", mode: "sync", timeoutMs: 2000 }
  - { from: "checkout-service", to: "orders-db", protocol: "postgres", mode: "sync" }
  - { from: "checkout-service", to: "orders-queue", protocol: "https", mode: "async", delivery: "at-least-once" }
```

## What v1 deliberately does not have

- Kind-to-kind inheritance
- Object or list property types
- Properties on groups, or on edges beyond the six optional fields above
- Expressions in rules
- Layout hints of any sort
- Any reference to a file outside the repository

Each is a candidate for v2 once a real design proves it necessary, and the evidence is recorded
rather than argued.
