---
title: Kinds and components
description: The vocabulary: abstract kinds, concrete products, and the order a property value is resolved in.
order: 1
---

A **kind** is an abstract category with typed properties. A **component** is a concrete product
implementing exactly one kind. Nothing in either of them is display text: names and descriptions
live in `locales/`, keyed by id, so the documents stay language-neutral.

## Kind

A kind answers "what is a queue?" — not "which queue".

```yaml
schemaVersion: "1"
type: "kind"
id: "queue"
category: "messaging"
properties:
  delivery:
    type: "enum"
    values: ["at-most-once", "at-least-once", "exactly-once"]
    required: true
  ordering:
    type: "enum"
    values: ["none", "per-key", "global"]
    default: "none"
  deadLetterQueue:
    type: "boolean"
    default: false
```

| Field | Required | Meaning |
|---|---|---|
| `category` | yes | One of `messaging`, `compute`, `data`, `edge`, `external`, `client`, `ops`, `security`, `custom`. Rules may select by category. |
| `properties` | yes | Property name to property definition. May be empty. |

`external` is for services outside your control, such as a payment provider. `custom` holds only
the [custom kind](/docs/the-custom-kind), the untyped escape hatch.

### Property definitions

| Field | Required | Meaning |
|---|---|---|
| `type` | yes | `boolean`, `integer`, `string`, `enum` or `ref` |
| `values` | for `enum` | The allowed string values |
| `default` | no | The value assumed when neither the component nor the node sets one |
| `required` | no | A node must resolve a value from somewhere. Default `false` |
| `refKind` | for `ref` | The kind the referenced node must have; the value is another node's id |

A property with neither `default` nor `required` is optional and may be absent. That absence is
usually deliberate: it is what lets a rule catch it.

> [!TIP]
> `evictionPolicy` on `cache` has no default on purpose. Redis really does ship with no eviction,
> so defaulting the property would hide the problem that `cache-missing-eviction-policy` exists to
> report. A required property turns a design mistake into a schema error the linter never sees.

## Component

A component answers "what is SQS?" — one file per product.

```yaml
schemaVersion: "1"
type: "component"
id: "sqs"
kind: "queue"
provider: "aws"
docs: "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html"
defaults:
  managed: true
  delivery: "at-least-once"
  ordering: "none"
  replay: false
  retentionDays: 4
properties:
  fifo:
    type: "boolean"
    default: false
  visibilityTimeoutSeconds:
    type: "integer"
    default: 30
```

| Field | Required | Meaning |
|---|---|---|
| `kind` | yes | The id of exactly one kind |
| `provider` | yes | The vendor that owns the product; the file lives in `components/<provider>/` |
| `defaults` | no | Values for kind properties that this product really changes. Every key must exist on the kind |
| `properties` | no | Properties specific to this product. Must not redefine a kind property |
| `docs` | no | The official documentation page for the product |

A `defaults` entry states the product's **actual default behaviour**, not a recommended
configuration. SQS really does retain for four days; that is why the number is there.

## Providers

Provider is ownership, not hosting. `postgres` is `default` even when it runs on RDS; `aurora` is
`aws` because Amazon owns it. `default` covers open source, in-house generic components, and
independent SaaS such as Stripe or Datadog.

{{provider-index}}

A cloud provider's managed offering of an open-source product is its own component, not a flag on
the original, because it is the resource a designer actually places and it carries its own
defaults: backup retention, zone redundancy, encryption.

## Property resolution order

For a node in a design, the effective value of a property is the first of these that exists:

1. The node's own `props`
2. The component's `defaults`
3. The property definition's `default` — on the kind, or on the component for a
   component-specific property
4. Absent

Absent is a real answer, not an error. Rules test for it with `exists: false`.

```yaml
nodes:
  - id: "orders-queue"
    component: "sqs"
    props: { deadLetterQueue: true }
```

`deadLetterQueue` resolves to `true` from the node. `delivery` resolves to `"at-least-once"` from
the component's defaults. `ordering` resolves to `"none"`, which the component happens to pin to
the same value the kind defaults to. `retentionDays` is `4`, from the component. `backoff` has no
default anywhere and no node value, so it is absent, and
`retry-without-backoff` can say so.

A node may only set properties that exist on its component's kind or on the component itself.
Setting an unknown property is a structural error.

## Which kinds exist

Every kind has a reference page listing its properties, the rules that read them, and every
component that implements it, grouped by provider.

{{kind-index}}
