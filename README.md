# Arkore

Architecture as typed, queryable data.

## The problem

Architecture diagrams are pictures. A PNG, a draw.io file, even a Structurizr model knows
that a box is labelled "Kafka". Nothing knows what Kafka *is*: that it can replay, that
SNS cannot, that a queue without a dead-letter queue drops poison messages. So no tool can
tell you that your design promises replay and uses a topic that cannot deliver it.

Arkore replaces the picture with a model. A node is not a box named Kafka. It is a
`kafka` component, which is a `queue`, which has a delivery guarantee, an ordering, a
dead-letter queue flag and a replay flag. Rules read those properties. Renderers draw them.
Agents reason over them instead of guessing from a screenshot.

## Ten lines

```yaml
schemaVersion: "1"
type: "design"
id: "checkout"
requirements: { messaging: { replay: true } }
nodes:
  - { id: "api", component: "aws-api-gateway" }
  - { id: "events", component: "sns" }
edges:
  - { from: "api", to: "events", protocol: "sns", mode: "async", delivery: "at-least-once" }
```

The rule `pubsub-replay-required` fires: the design requires replay, and SNS cannot replay.
A diagram of the same system says nothing.

## What is here

This repository is the **format**, not yet the tool.

| Folder | Contents |
|---|---|
| `schema/` | JSON Schema for each document type; drives editor validation and autocomplete |
| `kinds/` | Abstract vocabulary: 41 kinds across messaging, compute, data, edge, external, client, ops and security (see `docs/catalogue-v1.md`) |
| `components/<provider>/` | Concrete products implementing a kind, grouped by owning vendor: `aws/`, `azure/`, `gcp/`, `oci/`, `cloudflare/`, `default/` |
| `rules/` | Deterministic lint rules written as declarative YAML predicates |
| `designs/` | Reference architectures, each in a clean and a deliberately broken variant |
| `locales/` | Display names and descriptions, keyed by id |
| `icons/` | One 24x24 SVG glyph per kind and per component, plus the provider marks used as badges |
| `docs/` | The specification, governance, usage guide, and the gap log |

Start with [docs/format.md](docs/format.md) for the specification and
[docs/governance.md](docs/governance.md) for how the vocabulary is curated.

## The thesis being tested

A typed architecture model can catch design problems that a picture cannot. If the rules
in `rules/` find real issues in real designs, the thesis holds. If they turn out trivial
or unenforceable, that is worth knowing early.

## Status

Pre-implementation. The format is being shaped against real architectures before any
code is written. The linter, the `npx arkore lint` command and the GitHub Action come
after the format stops changing.

## License

MIT.
