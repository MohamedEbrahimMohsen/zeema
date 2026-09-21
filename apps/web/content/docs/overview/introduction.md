---
title: Introduction
description: What Zeema is, the three layers it is built from, and where to go next.
order: 1
path: /docs
---

Zeema describes software architecture as typed data instead of pictures. A design names
components from a curated catalogue, the directed edges between them, the boundaries that
contain them, and the promises the system makes about itself. Because all of that is data, a
linter can check it, a diff can show it, and any renderer can draw it.

{{catalogue-counts}}

## The three layers

Everything in Zeema is one of three things, and each one answers a different question.

| Layer | Answers | Lives in | Example |
|---|---|---|---|
| **Kind** | What is a queue, abstractly? Which properties does any queue have? | `kinds/` | `queue` has `delivery`, `ordering`, `deadLetterQueue` |
| **Component** | What is SQS, concretely? Which kind is it, what does it default? | `components/<provider>/` | `sqs` is a `queue` that defaults `delivery: "at-least-once"` |
| **Design** | Which components does *this* system use, and what does it promise? | your repository, or this site | a node `orders-queue` using `sqs`, with an edge into it |

Inheritance is one hop and one hop only: a component extends exactly one kind, and a kind never
extends another kind. That is what keeps property resolution simple enough to be obvious.

A node in a design always names a **component**, never a kind. When the product is not decided
yet, use the generic component for the kind — `container-service` for an `app-server`, `postgres`
for a `sql-database`.

## What rules do

A rule is a declarative predicate over a design. It picks its subjects (nodes of a kind, edges,
or the design itself), resolves each node's effective properties, and fires a finding where the
predicate is true.

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

That is the whole rule. It reads a property the `queue` kind defines, and an edge the design
draws, and it says one sentence a reviewer would have written by hand. Nothing about it is
specific to SQS or to Kafka, because [rules select by kind or category, never by
product](/docs/rules).

Findings come in two flavours and the difference matters:

- A **structural finding** means the document is invalid — an unknown component, an edge to a
  node that does not exist, a property value outside its enum. It blocks saving, everywhere.
- A **rule finding** means the design may be wrong. It never blocks anything. It is an opinion
  with a severity, and you are allowed to disagree with it.

> [!NOTE]
> The same engine produces both, in `packages/core`. The command line, this website and the
> canvas editor all import it, so a finding you see in one place is the finding you get in the
> others.

## Architecture as data

Once the design is data rather than a drawing, four things follow that a diagram cannot give you.

- **Review.** A pull request that changes `replication: "none"` to `"async"` is a one-line diff.
  A pull request that moves a rectangle is noise.
- **Determinism.** The same design and the same catalogue always produce the same findings, the
  same layout and the same rendering. There is nothing to disagree about.
- **Renderers.** No positions are stored in the document, so a picture can never go stale. The
  canvas keeps positions in a [layout sidecar](/docs/notes-and-layout) beside the design.
- **Agents.** A model reading a design knows a node is a queue with at-least-once delivery and no
  replay. It does not have to guess from a box labelled "Kafka".

## Where to go next

- [Getting started](/docs/getting-started) — run the site locally, draw your first design, or
  lint one from the command line.
- [Kinds and components](/docs/kinds-and-components) — the vocabulary, and how a property gets
  its value.
- [Writing a design](/docs/writing-a-design) — every field of the design document.
- [Rules reference](/docs/rules) — the predicate vocabulary and every rule that ships.
- [Catalogue reference](/docs/catalogue) — the entity pages, and the machine-readable ones.
