---
title: The custom kind
description: The escape hatch for a box the catalogue has no word for, and why it warns every time.
order: 6
---

Sometimes a real system contains a box the catalogue does not name. An importer meets it, or you
are drawing something the vocabulary has not caught up with yet. Refusing to record it would make
the design a lie by omission, so Zeema ships an escape hatch.

## What it is

The `custom` kind is the only member of the `custom` category, and it defines **no properties at
all**.

```yaml
schemaVersion: "1"
type: "kind"
id: "custom"
category: "custom"
properties: {}
```

A custom node is still a node. It has an id, it takes edges, it sits in a group, it is drawn, and
it appears in the diff. What it does not have is anything a rule can read.

```yaml
nodes:
  - id: "quota-broker"
    component: "custom"
    label: "Quota broker"
    group: "core"
```

The `label` is the whole point. It is the real name from the real system, kept verbatim, and it
is what turns a hole in the model into evidence.

## Why it warns

Two rules fire on custom nodes, and neither of them is a style opinion.

| Rule | Severity | Fires on |
|---|---|---|
| `custom-node` | warning | Every custom node, unconditionally |
| `custom-nodes-present` | warning | The design, when it contains any |

`custom-node` is written as `prop: "anyProperty", exists: false`. Since the kind defines no
properties, nothing ever resolves on one of these nodes, so that predicate is how the fixed
predicate vocabulary spells "always". The message says what is actually wrong:

> Node 'quota-broker' is custom: no rule can judge it. Replace it with a catalogue component or
> contribute one.

A custom node is meant to be temporary. Warning on every one of them is what makes staying
temporary the path of least resistance.

> [!WARNING]
> A custom node is not a free-form box with properties you invent. It has none. If you find
> yourself wanting `props` on a custom node, what you want is a kind — see
> [Governance](/docs/governance#adding-a-kind).

## The labels are the intake queue

This is the part that makes the escape hatch a feature rather than a leak.

Every custom node carries a real label from a real design. A word that keeps appearing in custom
nodes across published designs is a kind or a component asking to exist, and the designs that used
it are exactly the evidence a governance pull request has to cite.

So the flow is:

1. An import meets a box with no component. It becomes a custom node with the source label.
2. The rules warn, and keep warning, so it stays visible.
3. When the same label has appeared enough times, someone proposes the kind or the component,
   citing those designs.
4. The designs are updated to use it, and the warnings go away on their own.

Nothing in that loop requires a registry, a plugin mechanism or a private extension. The stated
path for a missing component is a pull request, and the custom kind is what keeps the design
honest in the meantime.
