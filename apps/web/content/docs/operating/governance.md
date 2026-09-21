---
title: Governance
description: How the vocabulary is curated — adding a component, a kind, a property or a rule, and the evidence each one needs.
order: 1
---

Curation is the product. A registry where anyone adds a component produces three incompatible
Kafkas and a linter that can reason over none of them.

Everything lives in one repository. Kinds, components, rules and locale text arrive as pull
requests and are reviewed against the criteria below. There is no runtime registry and no private
extension mechanism in v1; the stated path for a missing component is a pull request.

## Adding a component

A component is a concrete product implementing exactly one kind. It is the cheapest change, and
the most common.

- Maps to exactly one **existing** kind. If none fits, propose the kind first.
- Declares `provider` and lives in `components/<provider>/`. Provider is the vendor that **owns**
  the product, never where it happens to be hosted.
- Is not a duplicate. One file per product. The self-hosted product lives in `default`
  (`postgres`); a cloud provider's managed offering of it is a separate component in the
  provider's folder (`aws-rds`, `azure-database-for-postgresql`), because that is the resource a
  designer places and it carries its own defaults. Two components for the same product under the
  same provider are a duplicate.
- Every `defaults` key exists on the kind and reflects the product's **actual** default
  behaviour, not a recommended configuration.
- Every component-specific property is justified by a rule that will read it or a renderer that
  will show it. "Might be useful later" is not a justification.
- `locales/en.yaml` has a `name` and a `description` for it.
- It ships an icon under `icons/components/<provider>/`, or deliberately relies on its kind's
  glyph.

Mechanically, that is: the component file, the locale entry, the icon, an inventory row, then
`pnpm validate`.

> [!TIP]
> `zeema catalogue find <words>` before you write anything. Most "missing" components are there
> under the vendor's own name.

## Adding a kind

A kind is a new abstract word, and it is the most expensive change, because every rule and every
renderer has to understand it. Add one only when **all** of these hold:

1. At least two real components would implement it.
2. A rule exists, or is proposed in the same pull request, that reads a property of it.
3. No existing kind covers it. The test: if two vendors share the properties a rule needs, they
   are components of one kind, not two kinds. Kafka and SQS share delivery, ordering and
   dead-lettering. SNS cannot be consumed point-to-point, so `pubsub-topic` is separate.
4. It fits one of the nine categories. Adding a category is a schema change.

The pull request must include the kind file, at least one component, the `en` locale entries, a
glyph under `icons/kinds/`, and an update to at least one reference design that uses it.

## Where the evidence comes from

The catalogue ships a [`custom` kind](/docs/the-custom-kind) for the box it has no word for: a
real node with a real label that no rule can judge. **Those labels are the intake queue.**

A word that keeps appearing in custom nodes across public designs is a kind or a component asking
to exist, and the designs that used it are the evidence the pull request cites. `custom-node`
warns on every custom node, so staying temporary is the path of least resistance.

## Adding or changing a property

- Names are camelCase; enum values and ids are kebab-case.
- Prefer `enum` to a free `string` whenever the set of values is known.
- A property is `required` only when a design that omits it is **meaningless**, not merely wrong.
  `delivery` is required on `queue` because a queue with no delivery guarantee cannot be reasoned
  about at all. `evictionPolicy` on `cache` is not, because omitting it is a design mistake the
  linter should report — and a required property turns that finding into a schema error the
  linter never sees.
- A default belongs on the **kind** when it is true of the abstraction and on the **component**
  when it is true of the product. `replay: false` is true of queues in general; `replay: true` is
  true of Kafka.
- Object and list types do not exist in v1. Flatten: `backupEnabled` and `backupRetentionDays`,
  never `backup: { enabled, retentionDays }`.

## Adding a rule

- One rule per file. The id is kebab-case and reads as the problem, not the fix.
- Rules select by kind or category, **never** by component.
- The rule must be expressible with the [fixed predicate set](/docs/rules). If it is not, the
  pull request proposes a new predicate with the rule as evidence. Expression languages are out
  of scope.
- Every rule ships with a reference design that trips it and one that does not. The broken design
  lists the rule id in its header comment, and `pnpm validate` fails on a rule no design trips.
- Severity: `error` for data loss, availability or correctness; `warning` for performance and
  cost; `info` for style.
- The message is a sentence a reviewer would write on a pull request. It names the subject and
  says what is wrong — not what to do, unless the fix is unambiguous.

## Designs

`designs/` has two curated tiers, one folder per design, and the folder name is the design id.

| Tier | Holds | Acceptance criterion |
|---|---|---|
| `designs/reference/<id>/` | `design.yaml` (trips no rule), `design.broken.yaml` (trips exactly the rules in its header), the origin note, `diagram.md`, `notes.md` | Realistic: real products, real edge modes, real requirements |
| `designs/imported/<id>/` | The original under `source/`, `design.yaml`, `mapping.yaml`, `diagram.md`, `notes.md` | Fidelity: same nodes, edges and groups; labels verbatim |

An imported design becomes a reference design only through a separate decision that adds the
broken twin.

## Locale policy

Kinds, components and rules never carry display text; only `id` identifies them. `locales/en.yaml`
is complete and mandatory, and a pull request adding an id without an `en` entry is not merged.
Other languages are optional, may be partial, and never block a component or a rule. Translators
touch `locales/` and nothing else.

## Versioning

`schemaVersion` is a single integer string carried by every document.

**Breaking** — bump the version, with a migration note:

- Renaming or removing a field, property, kind, component, group kind or predicate
- Changing a property type
- Removing an enum value
- Making an optional field required
- Changing property resolution order

**Additive** — keep the version:

- New kinds, components, rules, properties, enum values, predicates, requirement paths
- New optional fields
- Relaxing a constraint

A field to be removed is marked deprecated and kept for one full version. Nothing is deleted from
a version that tools already read.

> [!WARNING]
> The v1 format is frozen the day the first external tool reads it. Until then it may change
> freely — and that freedom expires at public ship.

## Recording gaps

When encoding a real design reveals something the format cannot express, the gap is recorded in
`docs/schema-gaps.md` with the design, the missing capability and the workaround used. Gaps drive
the v2 agenda. The format is not extended speculatively.

## The gates

Run these before any commit; continuous integration runs the same three.

```bash
pnpm validate        # catalogue and designs
pnpm test            # parser conformance, golden parity, edits, CLI, the gate
pnpm lint            # formatting and static analysis
```

A test is never weakened to make it pass, and a golden fixture changes only when a behaviour
change is intended and the commit says why.
