---
title: Designs
description: Nodes, edges, groups and requirements — the four parts of a design and what each one is for.
order: 2
---

A design describes one deployable system: the components it uses, how they talk, the boundaries
they sit in, and what the system promises about itself. It lives in the repository that owns the
system, conventionally at `architecture/<system-id>.yaml`, or on this site.

A design never redefines what Kafka is. It says which Kafka instances exist and how they are
configured.

## The four parts

```yaml complete
schemaVersion: "1"
type: "design"
id: "order-processing"
requirements:
  availability: { multiRegion: true, sla: "99.95" }
  messaging:    { replay: true }
groups:
  - { id: "eu-west-1", kind: "region" }
  - { id: "core-vpc",  kind: "vpc", parent: "eu-west-1" }
nodes:
  - { id: "api", component: "aws-api-gateway", group: "core-vpc" }
  - id: "orders-queue"
    component: "sqs"
    group: "core-vpc"
    props: { deadLetterQueue: true }
    nfr:   { rps: 500 }
edges:
  - { from: "api", to: "orders-queue", protocol: "https", mode: "async", delivery: "at-least-once" }
```

**Requirements** are promises. **Groups** are boundaries. **Nodes** are component instances.
**Edges** are directed calls. Every field of every one of them is written out in
[Writing a design](/docs/writing-a-design); this page is what each part is *for*.

## Nodes

A node is one instance of a component. Its id is unique within the design and is what edges,
`ref` properties and findings name.

`label` is the display name as it appeared in the source — a picture, a draw.io file, a
Terraform module — and importers keep it verbatim. Renderers read it. **Rules never do**, which
is the point: a rule that read labels would be reasoning about English, not about architecture.

`props` set property values; `nfr` carries the three per-node numbers rules ask about: `rps`,
`latencyP95Ms` and `consistency`.

## Edges

An edge is a directed call from one node to another. `protocol` and `mode` are required;
`mode` is `sync` (the caller waits) or `async` (the caller continues).

The six optional fields — `timeoutMs`, `retryPolicy`, `idempotent`, `circuitBreaker`, `fallback`,
`batched` — exist because real rules read them: retries without shedding, money calls without
idempotency, fan-out without timeouts. Anything else about an edge goes in `label`.

> [!NOTE]
> A cross-region call is not a field. It is an edge between two nodes whose region ancestry
> differs, and rules derive it with `crossesGroup`. The same is true of a call that leaves a trust
> zone or a cell.

## Groups

Groups are nested boundaries. A node belongs to at most one group; a group may have one `parent`.
A node's **ancestry** is its group, that group's parent, and so on up.

```yaml
groups:
  - { id: "eu-west-1", kind: "region" }
  - { id: "prod-vpc", kind: "vpc", parent: "eu-west-1" }
  - { id: "dmz", kind: "trust-zone", parent: "prod-vpc" }
nodes:
  - { id: "api", component: "aws-api-gateway", group: "dmz" }
```

`api` names only `dmz`, and is therefore in `dmz`, `prod-vpc` and `eu-west-1`. A rule asking
"how many `region` groups are in this node's ancestry" gets the answer one.

The group kinds in v1 are `region`, `availability-zone`, `vpc`, `trust-zone`, `system`, `cell` (a
failure-isolated slice serving a subset of tenants), `point-of-presence` (an edge site) and
`namespace` (a logical partition inside a cluster or platform, such as a Kubernetes namespace; it
scopes names and policy and does not imply a network or failure boundary).
Groups carry no properties apart from an optional `label`.

## Requirements

Requirements are what the whole design promises. They are the other half of every interesting
rule: without them, a design gets *fewer* findings, not a cleaner bill of health.

```yaml
requirements:
  availability: { multiRegion: true }
  messaging:    { replay: true }
  latency:      { p95Ms: 300 }
```

The paths are governed — you cannot invent one — and each is backed by an intake card recording
the real design that needed it. A rule reads them with the `requirement` predicate, and an absent
requirement never equals anything, so a design that says nothing is never judged against a promise
it did not make.

The full table of paths is in [Writing a design](/docs/writing-a-design#requirements).

## What goes in, and in what order

Start with the smallest true statement and grow it. Each step unlocks rules the previous one
could not answer:

1. **Nodes and edges.** The shape of the system.
2. **Requirements.** Multi-region, replay, a latency target.
3. **Groups.** Which region, VPC and trust zone each node sits in.
4. **Props.** Dead-letter queues, eviction policies, backup retention. Set them explicitly: a
   property left unset resolves to the product's real default, which is often the wrong one.
5. **NFRs.** Per-node throughput, latency and consistency where they are known.

## What is never in a design

Positions, sizes, colours and routing. A renderer derives the whole picture from groups, nodes and
edges. Where a human arrangement matters, it goes in a [layout sidecar](/docs/notes-and-layout)
beside the file — never in the document.
