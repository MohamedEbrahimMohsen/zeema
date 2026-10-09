# Zeema format specification, v1

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
| Component | `components/<provider>/` | What is Kafka, concretely? Which kind is it, what does it add, what does it default? |
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
| `category` | yes | One of `messaging`, `compute`, `data`, `edge`, `external`, `client`, `ops`, `security`, `custom`. Rules may select by category. `external` is for services outside your control (`third-party-api`); `custom` holds only the `custom` kind, the untyped escape hatch. |
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
| `provider` | yes | Vendor that owns the product: `aws`, `azure`, `gcp`, `oci`, `cloudflare`, `ibm`, `alibabacloud`, `digitalocean`, `openstack`, `outscale`, `k8s` or `default`. The file lives in `components/<provider>/`. `default` is open source, in-house generic, or SaaS (Stripe, Datadog). Hosting is not ownership: `postgres` is `default` even on RDS, `aurora` is `aws`. |
| `aliases` | no | One to eight other names the vendor's own documentation uses for this product — abbreviations (`DCR`, `S3`) and nicknames (`Kusto`) — searched alongside the id and the name, never invented here. |
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

Promises the whole design makes. Rules compare nodes against them. Every path below is
optional; an absent requirement never equals anything.

| Path | Type | Meaning |
|---|---|---|
| `availability.multiRegion` | boolean | Must survive the loss of one region |
| `availability.sla` | string | Availability target, e.g. `"99.95"`. Quoted. |
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

New requirement paths are added through governance, not ad hoc. Each path above is
backed by at least one intake card in `docs/intake/`.

### groups

Nested boundaries. A node belongs to at most one group; a group may have one `parent`.
Group kinds in v1: `region`, `availability-zone`, `vpc`, `trust-zone`, `system`, `cell` (a
failure-isolated slice of the system serving a subset of tenants), `point-of-presence`
(an edge site) and `namespace` (a logical partition inside a cluster or platform, such as a
Kubernetes namespace, an OpenShift project or a Nomad namespace). A namespace scopes names and
policy; it does not imply a network or failure boundary. Nest it under the `system`, `cell` or
`vpc` the source draws it in.

A node's **ancestry** is its group, that group's parent, and so on. Rules ask questions
like "how many `region` groups are in this node's ancestry".

Groups carry no properties in v1 apart from an optional `label` (the group's name as
drawn in the source). They exist for rules and for renderers, which draw them as nested boxes.
A frame shows the label alone, or with no label its kind's name (`locales/en.yaml`
`groupKinds`: "VPC", "Point of presence"); the kind and the id are hover text.

### nodes

A design may have no nodes yet (`nodes: []`): a new design starts that way on the canvas.

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique within the design |
| `component` | yes | Id of a component in `components/` |
| `label` | no | Display name as it appears in the source design, kept verbatim by importers. Read by renderers, never by rules. A box draws the label over the component's name, or with no label the component's name over its kind's; the component id is hover text only. |
| `group` | no | Id of a group in this design |
| `props` | no | Property values; see resolution order above |
| `nfr` | no | `rps` (integer), `latencyP95Ms` (integer), `consistency` (`strong` or `eventual`) |
| `ref` | no | Another Zeema design this node stands for: `design` (`owner/slug`) and `version` (a release number, or `"head"`). See below. |

Renderers decorate a box from its resolved props: a node whose `instances`, `replicas` or `shards` is 2 or more is drawn as a stack with a `×N` chip, and a queue with `deadLetterQueue: true` (whose `role` is not `dlq`) shows a `DLQ` chip at the right of that chip row.

#### Referencing another design

A box in one design can be a whole design of its own: the "Notification Service" in a News Feed
design is the published Notification System design. The normal way to say so is the
`zeema-design` component (kind `subsystem`, category `external`), with `ref` naming the design:

```yaml
- id: notifications
  component: zeema-design
  ref:
    design: "mohamedebrahimmohsen/notification-system"
    version: 3
```

The box is the other design and nothing else: the kind has no properties and no rule reads it,
because rules never cross designs. With no `label` it is named by the design (the canvas shows
the design's name, the server render and describe its `owner/slug`), over "Zeema design · v3"
("· latest" when it follows head). A `zeema-design` node with no `ref` is valid: it is a box
still waiting for its design, drawn "Choose a design…" with the link disc.

The exception is a typed component that also stands for a design, when its component, props
and edges still matter to the rules. `ref` then annotates it:

```yaml
- id: notifications
  component: azure-notification-hubs
  label: "Notification Service"
  ref:
    design: "mohamedebrahimmohsen/notification-system"
    version: 3
```

- `design` is required: `owner/slug`, the owner's GitHub login (`[A-Za-z0-9-]+`) and the design's
  slug (kebab-case, as a design id).
- `version` is required: a release number (an integer, 1 or more), pinning the reference to that
  release, or the string `"head"`, following the latest saved version.
- Nothing else goes under `ref`. A URL is never stored: the app builds it from its own
  `CANVAS_URL`, so a design does not break when the platform moves.
- The node stays an ordinary node. Its component, props and edges are what rules read; the
  reference is an annotation, and rules never cross into the referenced design.
- Only a public design can be referenced for now.
- A malformed `design` or `version` is a structural error, reported on the node. Whether the
  target exists is not structure (it is the platform's state, and can change after the design is
  saved), so it is never checked here; the canvas shows it instead.

A referencing node, and every `zeema-design` node, is drawn with a link disc at its bottom-right
corner, and a referencing node's hover text ends with `ref: owner/slug@v3` (or `@head`).

### edges

Directed. `from` and `to` are node ids in this design.

An end may instead name a group: the edge then runs to the group as a unit ("the API talks to
the whole cluster"), drawn once, to the group's dashed frame, not fanned out to its members. A node
may connect to its own group, and a group to another group, nested or not. An id that names both a
node and a group means the node; the editor never makes such a pair.

Rules read a group end as **every node inside the group**, nested groups included: the edge reaches
each member, exactly as if it had been drawn to each. Before rules run, a group edge is expanded
into one node edge per (source member, target member) pair, a node never paired with itself. So a
member of a group the gateway calls has an incoming edge from the gateway for `hasEdge` (and
`count` counts one per pair), `syncChainDepth` walks through it, and an edge rule (`from`, `to`,
`crossesGroup`, the auth rules) is evaluated on each pair. An edge rule reports at most one finding
per drawn edge, about the edge as drawn, so its message names the group. A group that holds no
node expands to nothing: its edges are read as drawn, and a rule that needs the component at an
end skips them.

| Field | Required | Meaning |
|---|---|---|
| `protocol` | yes | Free string in v1: `http`, `grpc`, `kafka`, `postgres`, `redis`. Will become an enum once real designs show the real set. |
| `mode` | yes | `sync` (caller waits) or `async` (caller continues) |
| `delivery` | no | `at-most-once`, `at-least-once`, `exactly-once`. Meaningful for async edges. |
| `label` | no | Free text for renderers. Never read by rules. |
| `timeoutMs` | no | Caller timeout. Rules read it on sync edges. |
| `retryPolicy` | no | `none`, `fixed`, `exponential`, `exponential-jitter` |
| `idempotent` | no | The call can be safely repeated (idempotency key or natural idempotency) |
| `circuitBreaker` | no | Caller stops calling after repeated failures |
| `fallback` | no | `none`, `static`, `cached`, `degraded`: what the caller does when the callee fails |
| `batched` | no | Calls are coalesced |
| `auth` | no | How the caller authenticates on this hop: `managed-identity`, `iam-role`, `service-account`, `workload-identity`, `api-key`, `oauth`, `mtls`, `basic`, `none`. Any other value is a structural error. Drawn as a small glyph on the line by its source end (the cloud's own mark for `managed-identity`, `iam-role` and `service-account` — the catalogue icons of `azure-managed-identity`, `aws-iam` and `google-cloud-iam` in a ringed disc — a shield for `workload-identity`, a key for `api-key` and `basic`, a lock for `mtls` and `oauth`, nothing for `none`). |

These seven optional fields are the only edge properties in v1. They exist because the
intake cards showed rules that read them (retries without shedding, money calls without
idempotency, fan-out without timeouts, a key where the cloud offers an identity). Anything else
on an edge goes in `label`.

`auth` is how the edge authenticates, not a hop. An Azure managed identity, an AWS IAM role or a
Google Cloud service account is not a box between every caller and callee:

```yaml
edges:
  - { from: "orders-api", to: "orders-db", protocol: "tds", mode: "sync", auth: "managed-identity" }
  - { from: "orders-api", to: "openai", protocol: "https", mode: "sync", auth: "api-key" }
```

Layout, coordinates and colours are **not** part of the design. A renderer derives a
diagram from groups, nodes and edges alone. What a person arranged by hand goes in the layout
sidecar beside the design: how edges are routed (`routing`: `orthogonal`, the default and never
stored; `bundled`, orthogonal with shared trunks, below; or `curved`), node positions, an edge's
bow (`edges`), where each end of an edge
meets its box (`ports`: per edge key, `{ from?, to? }`, each `{ side, t }` with `side` one of
`top`, `right`, `bottom`, `left` and `t` in [0, 1] along it), group colours and icons
(`frames`), component tints (`tints`: per node id, `{ tint, strength? }`, the same tint values
as a group's), how strongly a tint fills (`strength`, on a frame or a component tint: `light`,
`normal` or `bold`; absent is normal), notes, and the list badge its owner chose (`badge`: `provider:<id>` or
`boundary:<id>`, absent for the automatic one). Moving an edge's end to another component is not
layout: it changes `from` or `to` in the design.

`routing: "bundled"` draws edges orthogonally, and edges that fan out of one side of one box (or a
group's frame) toward boxes facing that side share one trunk: they leave from one point, run
together along one line square to the side, and split off to their targets one by one. Edges from
several boxes into one side of one box merge onto one trunk the same way and meet the box at one
point. A member overlaps its siblings exactly, and one whose own runs would cut a box is routed on
its own. Edges with a bow or waypoints never bundle; a ported end bundles only with ends ported to
the same point. Like every routing value it is layout only: rules and the design never see it.

### Export and import

A design leaves the site, and comes back, as two files with the repository's names:

| File | Required | Holds |
|---|---|---|
| `design.yaml` | yes | The design, byte for byte as stored |
| `design.layout.json` | no | The sidecar above: `version`, `nodes`, `edges`, `ports`, `frames`, `tints`, `notes`, `badge`; keys in that order, map keys sorted, two-space indent |

The design page and the canvas download either, or both as a zip that unzips to a design folder
(`zeema render design.yaml` draws with the sidecar beside it). **New design ▾ Import YAML…**
takes them back as a private draft, under the same structural gate as any save. Without a
sidecar the design is laid out automatically.

The sidecar follows the design by id: node ids, group ids and edge keys (`from>to`, `from>to#n`).
Edit only `design.yaml`. An entry whose id the YAML no longer holds is dropped on import; a node
with no position is placed around the others. Rename an id in both files, or accept that its
position, bow or colour goes.

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
| `edge: { mode: "sync" }` | Every edge, optionally filtered by `mode` and `delivery`. |
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
| `prop: p, gt: n` / `lt: n` | node | Integer comparison on the effective value; absent is never greater or less |
| `field: f, equals / in / exists` | edge | Reads an edge field (`mode`, `delivery`, `protocol`, `timeoutMs`, `retryPolicy`, `idempotent`, `circuitBreaker`, `fallback`, `batched`, `auth`) |
| `nfr: { rps: {gt/lt/eq} }` | node | Compares a node `nfr` value; `latencyP95Ms` also allowed |
| `requirement: path, equals: v` | any | The design requirement at `path` equals `v`. Absent requirements never equal anything. |
| `requirement: path, exists: bool` | any | Whether the requirement is set |
| `requirement: path, gt / lt: n` | any | Integer comparison on a requirement |
| `hasEdge: { direction, mode?, delivery?, peerKind?, peerCategory?, count? }` | node | At least one edge in that direction (`in`, `out`, `any`), optionally filtered; `count` compares the number of matching edges |
| `hasNode: { kind?, category?, count? }` | any | The design contains at least one node of that kind or category; `count` compares the number of matching nodes |
| `inGroup: { kind, count? }` | node | Number of groups of that kind in the node's ancestry. Without `count`, means at least one. |
| `syncChainDepth: { gt / lt / eq }` | node | Longest path of consecutive `sync` edges starting at this node. Cycles are cut at first revisit. |
| `kind: k` | node | The node's component is of kind `k`. May be a list. Mostly used under `to` or `from`. |
| `provider: p` | node | The node's component comes from provider `p` (`azure`, `aws`, `gcp`, …). May be a list. |
| `from: <predicate>` / `to: <predicate>` | edge | Evaluates a node predicate on the edge's source or target node |
| `crossesGroup: { kind }` | edge | Source and target are in different groups of that kind, or one of them is in none |

Comparison objects accept exactly one of `eq`, `gt`, `lt`.

### severity and message

`error` fails a CI gate, `warning` comments without failing, `info` is advisory. The
message may interpolate `{{node.id}}`, `{{edge.from}}`, `{{edge.to}}` and `{{design.id}}`.

## 7. Locales

`locales/<lang>.yaml` holds display text keyed by id under `categories`, `kinds`,
`components` and `rules`. `en.yaml` is mandatory and complete. Other languages are
optional and may be partial; consumers fall back to `en`.

## 8. Icons

`icons/` holds the visual vocabulary. It is a lookup table, not part of any document: no
kind, component or design refers to an icon, and a renderer that ignores the folder is
still correct.

**Naming.** The file name is the id. `icons/kinds/<kind-id>.svg` and
`icons/components/<provider>/<component-id>.svg`, mirroring `components/<provider>/`.
`icons/providers/<slug>.svg` holds the brand marks that component icons badge themselves with.

**Fallback chain.** A renderer resolves an icon in this order and stops at the first hit:

1. `icons/components/<provider>/<component-id>.svg`, provider read from the component file
2. `icons/kinds/<kind-id>.svg`, using the kind the component declares
3. the renderer's own glyph for the kind's `category`

So a component may ship without an icon and still draw correctly, but a kind may not.

**SVG constraints.** Every file is `viewBox="0 0 24 24"` and draws its glyph in
`stroke="currentColor"` with `fill="none"`, so it takes the surrounding text colour in
both themes. No text, no raster, no script, no external reference; under 4 KB. The one
exception to `currentColor` is the provider badge in the bottom-right corner, which may
carry the brand colour as a fixed fill.

`icons/README.md` documents the badge geometry and the licence position on the marks.

## 9. What v1 deliberately does not have

- Kind-to-kind inheritance
- Object or list property types
- Properties on groups; properties on edges beyond the six optional fields in section 5
- Expressions in rules
- Layout hints
- Any reference to files outside the repository

Each is a candidate for v2 once a real design proves it necessary. Record the evidence in
`docs/schema-gaps.md`.
