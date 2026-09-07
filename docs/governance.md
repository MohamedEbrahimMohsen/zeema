# Governance

How the vocabulary is curated, changed and versioned. Curation is the product: a
registry where anyone adds a component produces three incompatible Kafkas and a linter
that can reason over none of them.

## 1. Where things live

Everything is in this repository. Kinds, components, rules and locale text arrive as pull
requests and are reviewed against the criteria below. There is no runtime registry and
no private extension mechanism in v1. The stated path for a missing component is a pull
request. An extension mechanism is reconsidered once the repository has received a
sustained stream of component requests, not before.

## 2. Adding a kind

A kind is a new abstract vocabulary word. It is the most expensive kind of change,
because every rule and every renderer must understand it.

Add a kind only when **all** of these hold:

1. At least two real components would implement it.
2. A rule exists, or is proposed in the same pull request, that reads a property of it.
3. No existing kind covers it. Test: if two vendors share the properties a rule needs,
   they are components of one kind, not two kinds. Kafka and SQS share delivery,
   ordering and dead-lettering, so both are `queue`. SNS cannot be consumed
   point-to-point, so `pubsub-topic` is a separate kind.
4. It fits one of the eight categories. Adding a category is a schema change (`external` was added from the intake cards for services outside your control).

The pull request must include the kind file, at least one component, the `en` locale
entries, and an update to at least one reference design that uses it.

## 3. Adding a component

A component is a concrete product implementing exactly one kind.

Acceptance criteria:

- Maps to exactly one existing kind. If none fits, propose the kind first.
- Declares `provider` and lives in `components/<provider>/`. The provider is the vendor that
  owns the product, never where it happens to be hosted. Adding a provider folder is a
  schema change (the enum in `component.schema.json`) and needs at least three components.
- Not a duplicate. One file per product, not per hosting variant. `postgres` covers RDS
  PostgreSQL, Cloud SQL and self-hosted; a managed flag is a property, not a component.
- Every `defaults` key exists on the kind and reflects the product's actual default
  behaviour, not a recommended configuration. Redis defaults to no eviction, so the
  `redis` component does not default `evictionPolicy`.
- Every component-specific property is justified in the pull request by either a rule
  that will read it or a renderer that will show it. "Might be useful later" is not a
  justification.
- `locales/en.yaml` has `name` and `description` entries for it.
- The pull request either ships `icons/components/<provider>/<id>.svg` or relies deliberately on the
  component's kind glyph, which is the right picture for a generic component. A component
  that is a cloud service or a branded product should carry the provider badge; see
  `icons/README.md`.

## 4. Adding or changing a property

- Names are camelCase. Enum values and ids are kebab-case.
- Prefer `enum` to free `string` whenever the set of values is known.
- A property is `required` only when a design that omits it is meaningless, not merely
  wrong. `delivery` is required on `queue` because a queue with no delivery guarantee
  cannot be reasoned about at all. `evictionPolicy` on `cache` is **not** required,
  because omitting it is a design mistake the linter should report, and a required
  property turns that finding into a schema error the linter never sees. Rule of thumb:
  if a rule wants to catch the absence, leave the property optional with no default.
- A default belongs on the **kind** when it is true of the abstraction, and on the
  **component** when it is true of the product. `replay: false` is true of queues in
  general; `replay: true` is true of Kafka.
- Object and list types are not available in v1. Flatten: `backupEnabled` and
  `backupRetentionDays`, not `backup: { enabled, retentionDays }`.

## 5. Adding a rule

- One rule per file. Id is kebab-case and reads as the problem, not the fix:
  `queue-missing-dlq`, not `add-dlq`.
- Rules select by **kind or category, never by component**. A rule about Kafka is a
  rule about queues with a property Kafka happens to set.
- A rule must be expressible with the fixed predicate set in `docs/format.md`. If it is
  not, the pull request proposes a new predicate with the rule as evidence. Expression
  languages are out of scope.
- Every rule ships with a reference design that trips it and one that does not. The
  broken design lists the rule id in its header comment.
- Severity: `error` for data loss, availability or correctness problems; `warning` for
  performance and cost; `info` for style.
- The message is a sentence a reviewer would write on a pull request. It names the
  subject and says what is wrong, not what to do, unless the fix is unambiguous.

## 6. Versioning

`schemaVersion` is a single integer string carried by every document.

**Breaking changes** bump the version and require a migration note in `docs/format.md`:

- Renaming or removing a field, property, kind, component, group kind or predicate
- Changing a property type
- Removing an enum value
- Making an optional field required
- Changing property resolution order

**Additive changes** keep the version:

- New kinds, components, rules, properties, enum values, predicates, requirement paths
- New optional fields
- Relaxing a constraint

**Deprecation before removal.** A field to be removed is marked deprecated in
`docs/format.md` and kept for one full version. Nothing is deleted from a version that
tools already read.

The v1 format is frozen the day the first external tool reads it. Until then it may
change freely, and this file records that freedom expires at public ship.

## 7. Locale policy

- Kinds, components and rules never carry display text. Only `id` identifies them.
- `locales/en.yaml` is complete and mandatory. A pull request adding an id without an
  `en` entry is not merged.
- Other languages are optional, may be partial, and never block a component or rule.
- Translators only touch `locales/`. A translation pull request never changes a kind,
  component or rule file.

## 8. Reference designs

`designs/` holds architectures encoded in the format. Each has a clean file and a
`.broken.yaml` file. Together they are the format's evidence and, later, the linter's test
fixtures. A reference design may be anonymised from a real system but must be realistic:
real products, real edge modes, real requirements.

## 9. Recording gaps

When encoding a real design reveals something the format cannot express, the gap is
recorded in `docs/schema-gaps.md` with the design, the missing capability, and the
workaround used. Gaps drive the v2 agenda. The format is not extended speculatively.
