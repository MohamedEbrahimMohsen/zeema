# Using the format

How a team describes a system in Zeema and what happens to that description.

## 1. One design per system

A design file describes one deployable system: its components, how they talk, and what
it promises. It lives in the repository that owns the system, conventionally at
`architecture/<system-id>.yaml`. A repository with several independently deployed systems
has several files.

The design references components by id (`kafka`, `postgres`) from the shared catalogue in
this repository. It never redefines what Kafka is; it says which Kafka instances exist and
how they are configured.

## 2. Authoring a design

Start from the smallest true statement and grow it:

```yaml
schemaVersion: "1"
type: "design"
id: "checkout"
nodes:
  - { id: "api", component: "aws-api-gateway" }
  - { id: "checkout-service", component: "container-service" }
  - { id: "orders-db", component: "postgres" }
edges:
  - { from: "api", to: "checkout-service", protocol: "http", mode: "sync" }
  - { from: "checkout-service", to: "orders-db", protocol: "postgres", mode: "sync" }
```

Then add, in this order, because each step unlocks rules:

1. **Requirements.** What does the system promise? Multi-region, replay, a latency
   target. Rules compare nodes against these, so a design with no requirements gets
   fewer findings, not a cleaner bill of health.
2. **Groups.** Which region, VPC and trust zone does each node sit in? Regions matter for
   availability rules; trust zones will matter for security rules.
3. **Props.** Dead-letter queues, eviction policies, backup retention. Set them
   explicitly. A property left unset resolves to the component default, and the
   component default is the product's real default, which is often the wrong one.
4. **NFRs.** Per-node throughput, latency and consistency where they are known.

Use the editor. With the YAML extension installed, opening a design in this repository
validates it against `schema/design.schema.json` and autocompletes enum values. A
consumer repository gets the same by adding the first-line comment:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/<org>/zeema/main/schema/design.schema.json
```

## 3. Groups

Groups nest through `parent`. A node names only its innermost group.

```yaml
groups:
  - { id: "eu-west-1", kind: "region" }
  - { id: "prod-vpc", kind: "vpc", parent: "eu-west-1" }
  - { id: "dmz", kind: "trust-zone", parent: "prod-vpc" }
nodes:
  - { id: "api", component: "aws-api-gateway", group: "dmz" }
```

The node `api` is therefore in `dmz`, `prod-vpc` and `eu-west-1`. A rule asking whether
`api` is in exactly one region gets the answer yes.

A cross-region call is nothing more than an edge between nodes whose region ancestry
differs. The `label` field can say so for human readers; rules derive it.

## 4. How rules read a design

For every rule, the linter:

1. Selects subjects: nodes of a kind or category, edges, or the design.
2. Resolves each node's effective properties: node props, then component defaults, then
   kind defaults.
3. Evaluates the rule's predicate against the subject, the design's requirements, the
   node's group ancestry and the edges touching it.
4. Emits the message with the given severity for every subject where the predicate is
   true.

Everything is deterministic. The same design and the same catalogue always produce the
same findings.

## 5. What a CI comment will look like

The GitHub Action is a later deliverable. Its output shape is fixed now so that designs
and rules are written towards it:

```
zeema lint architecture/checkout.yaml

  error    queue-missing-dlq         Queue 'orders-queue' receives async traffic but has no dead-letter queue.
  error    datastore-missing-backup  Datastore 'orders-db' has no backup or no retention policy declared.
  warning  sync-chain-too-deep       Entry point 'api' starts a synchronous call chain deeper than 3 hops while the design states a p95 latency target.

2 errors, 1 warning
```

An `error` fails the check. A `warning` comments. `info` is listed and nothing more.

## 6. What a design is for beyond linting

Because the design is data, the same file can feed:

- **Rendering.** Groups become nested boxes, nodes become typed shapes, edges become
  arrows styled by mode. No layout is stored, so the diagram is always current.
- **Agents and tooling.** A model reading the design knows a node is a queue with
  at-least-once delivery and no replay. It does not have to guess from a box labelled
  "Kafka".
- **Review.** A pull request that changes `replication: "none"` to `"async"` is a
  one-line diff a reviewer can read.

None of these consumers exist yet. The format is written so that they can.

## 7. Choosing between a kind and a component in a design

A node always references a **component**, never a kind. When the product is not yet
decided, use the generic component for the kind (`container-service` for `app-server`).
When no generic component exists for a kind, that is a gap; record it in
`docs/schema-gaps.md`.

## 8. Importing an existing design

A design that already exists as a picture, a draw.io or Mermaid file, or infrastructure code
does not have to be retyped. The `zeema-design-import` skill in `.claude/skills/` converts
it into `designs/imported/<name>/`: the original under `source/`, `design.yaml` with every box,
arrow and boundary preserved (`label` keeps the source text), a `mapping.yaml` that records
where each item went, a Mermaid rendering and notes. A box with no matching component is
added to the catalogue first, through the `zeema-catalogue-add` skill, in every provider
where the product exists. The result is checked mechanically: counts and labels must match
the source, and the rules that fire are reported rather than silenced.
