# Zeema: the complete product plan

**Status:** target specification. This document describes the whole product as it must exist to be
called production-ready and released to the developer community. It does not describe the current
implementation and does not assume any of it; existing assets may be reused wherever they already
satisfy a requirement, and must be replaced wherever they do not.

**Stack neutrality:** this plan names formats, protocols and behaviours. It does not name languages,
frameworks, databases, hosting providers or package registries. Any stack that meets every
requirement and every acceptance criterion is acceptable.

**How to read it:** every requirement has an identifier, a statement, the details that make it
unambiguous, and acceptance criteria that a test or a reviewer can check. "Must" is binding.
"Should" is the default unless a documented reason overrides it. "May" is optional.

---

## Table of contents

1. Vision and thesis
2. Audiences and use cases
3. Principles
4. Glossary
5. Product scope and pillars
6. Pillar A: the format
7. Pillar B: the catalogue
8. Pillar C: the rules
9. Pillar D: designs and the import contract
10. Pillar E: the linter, the command line and continuous integration
11. Pillar F: the canvas editor
12. Pillar G: the community platform
13. Identity, authentication and authorization
14. Conceptual data model
15. Service interface
16. Security requirements
17. Privacy, legal and licensing
18. Quality, testing and engineering discipline
19. Performance and capacity budgets
20. Operations, reliability and observability
21. Documentation
22. Governance and community process
23. Release plan and milestones
24. Definition of production-ready
25. Risks
26. Out of scope

---

## 1. Vision and thesis

Zeema describes software architecture as **typed, queryable data** rather than as pictures.

A design is a text document that names components drawn from a curated catalogue, the directed
edges between them, the boundaries that contain them, and the promises the system makes about
itself. Because the design is data:

- a linter finds structural and design mistakes deterministically;
- a diff in a code review is readable, because it shows a changed component or property, not a
  moved rectangle;
- a renderer can draw the design, and several renderers can draw it differently;
- an automated agent can reason over the design instead of guessing from a screenshot.

**The thesis under test:** a typed architecture model catches design problems that a picture
cannot. The product is successful when its rules find real problems in real designs that were not
written to trip them. Every pillar below exists to make that test possible and repeatable.

## 2. Audiences and use cases

| Audience | What they do with Zeema |
|---|---|
| Software architect | Authors a design, states its promises, runs the rules, publishes it |
| Development team | Keeps the design in the repository beside the code, lints it in every pull request |
| Reviewer | Reads a design diff; reads rule findings instead of squinting at a diagram |
| Learner | Browses published architectures, clones one, changes it, sees which rules fire |
| Catalogue contributor | Adds a product, a kind, a rule or a locale entry through the governed process |
| Automated agent | Reads a design, proposes changes, validates them, renders them |
| Platform operator | Runs the hosted community site |

Primary use cases, each of which must be possible end to end:

1. Write a design by hand in a text editor with schema-driven validation and completion.
2. Draw a design on the canvas, save it as the same text format, and open it again unchanged.
3. Run the linter locally and in continuous integration on every change, with a machine-readable
   result and a non-zero exit on structural errors.
4. Import an existing diagram or infrastructure definition into a faithful Zeema design, with a
   mapping that proves fidelity.
5. Publish a design to the community site, choose whether it is public, and let others read,
   clone and export it while only the owner edits it.
6. Search and browse published designs by text, provider, kind and tag.
7. Extend the catalogue with a new product or kind through a documented, validated process.

## 3. Principles

1. **Data, not pictures.** Positions and drawing details are never part of the design document.
2. **Specification first.** The format is the product. Tools are proofs that the format works.
3. **Determinism.** Same input, same output: for rules, layout, serialisation, rendering, search.
4. **Byte preservation.** A tool that writes a design file it did not change writes it back
   identically. A tool that changes a file changes only the lines it had to.
5. **One implementation of each core behaviour.** Parsing, structural validation, rule
   evaluation, property resolution and layout each exist exactly once and are shared by every
   consumer, including tests. Duplicates that must be kept in step are defects.
6. **Refuse loudly, never corrupt silently.** A tool that cannot fully understand an input must
   reject it with a message that names the line. It must never guess, drop content, or write
   back a lossy version.
7. **The gate is on the server, the convenience is on the client.** Every check a client runs
   for feedback is repeated at the point of storage.
8. **Tiers and ownership decide writability.** Curated content is never overwritten by an editing
   session. A public design is read-only to everyone but its owner.
9. **Display text lives in one place**, keyed by identifier, so the vocabulary is translatable
   and the documents stay language-neutral.
10. **Governed vocabulary.** New kinds, properties, requirement paths and rules go through a
    documented process backed by evidence.
11. **Free to read, free to run, accountable to write.** Reading and linting need no account.
    Creating on the hosted platform needs an identity.
12. **No dependency the format does not need.** The core engine has no runtime dependencies. The
    browser editor has no build step and no external dependencies.

## 4. Glossary

| Term | Meaning |
|---|---|
| Kind | An abstract category of component (a queue, a cache, a load balancer) with typed properties |
| Component | A concrete product or generic implementation of exactly one kind (Kafka, SQS, an in-house worker) |
| Provider | The owner of a component: a cloud vendor, or `default` for open source, in-house and independent SaaS |
| Design | A document naming nodes, edges, groups and requirements |
| Node | One instance of a component inside a design |
| Edge | A directed connection between two nodes with a protocol and a mode |
| Group | A nested boundary (region, zone, network, trust zone, system, cell, point of presence) |
| Requirement | A promise the design makes about itself, under a governed dotted path |
| Property | A typed value defined on a kind or a component and resolvable on a node |
| Rule | A declarative predicate over a design that yields findings |
| Finding | One rule or structural result, with severity, message and subject |
| Structural finding | A finding that means the document is invalid; blocks saving and fails the linter |
| Rule finding | A finding that means the design may be wrong; never blocks saving |
| Tier | Where a repository design lives: reference, imported or authored; decides writability |
| Locale | The document holding every display name and description, keyed by identifier |
| Catalogue | Kinds, components, rules, locale and icons together |
| Bundle | The catalogue compiled into the artefacts a client loads |
| Layout sidecar | A file beside a design holding node positions and edge bows |
| Fidelity mapping | The document proving an imported design matches its source item for item |
| Broken twin | A deliberately incorrect copy of a reference design that must trip named rules |
| Canvas | The drag-and-drop editor |
| Platform | The hosted community site |
| Owner | The account that created a platform design or cloned one into its own space |
| Visibility | Public or private, chosen by the owner |
| Origin | Whether a platform design is authored, imported or reference; curated origins are owner-less |

## 5. Product scope and pillars

| Pillar | Delivers | Needed for production |
|---|---|---|
| A. Format | The document types, their schemas and their semantics | Yes |
| B. Catalogue | Kinds, components, locale, icons, inventories | Yes |
| C. Rules | The rule language and the shipped rule set | Yes |
| D. Designs and import | Reference designs, broken twins, imported designs, the import contract | Yes |
| E. Linter, command line, continuous integration | Runnable validation anywhere, including pull requests | Yes |
| F. Canvas editor | Visual authoring that reads and writes the format faithfully | Yes |
| G. Community platform | Hosted browse, own, publish, clone, export | Yes, in the final release |
| Cross-cutting | Identity, security, privacy, legal, quality, performance, operations, documentation, governance | Yes |

Production means all pillars meet their acceptance criteria and the definition in section 24 holds.

---

## 6. Pillar A: the format

### A1. Document types and envelope

**A1.1** There are exactly four document types: `kind`, `component`, `design`, `rule`. Each is a
single YAML file. Every document opens with the same three fields:

```yaml
schemaVersion: "1"
type: "kind"
id: "queue"
```

- `schemaVersion` is a quoted string and is required.
- `type` is one of the four document types.
- `id` matches `^[a-z][a-z0-9-]*$` and is unique within its type.

**A1.2** A JSON Schema exists for each document type and is the final word on structure. Every
schema is published so any editor that understands JSON Schema validates on type. Every document
file carries, on its first line, a comment that points at its schema.

**A1.3** Conventions, enforced by validation, not by convention:

- Every string value is quoted, including enum values and `schemaVersion`.
- Property names are camelCase. Identifiers and enum values are kebab-case.
- No display text appears in any document except the locale.
- Object definitions for nodes, edges and groups reject unknown fields.

**A1.4** Schema versioning. `schemaVersion` is a major version. A change that any existing valid
document would fail under, or that changes the meaning of any existing field, increments it. Any
other change does not. Every tool states which schema versions it reads. A tool reading an older
version than it writes must upgrade losslessly and must say so.

**Acceptance:** the schemas validate every shipped document; a document with an unquoted string,
an unknown node field, a camelCase id or a kebab-case property name is rejected with a message
naming the file and path.

### A2. Kind

**A2.1** File shape:

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

**A2.2** `category` is required and is one of `messaging`, `compute`, `data`, `edge`, `external`,
`client`, `ops`, `security`, `custom`. `external` means outside the design owner's control.
`custom` holds only the `custom` kind, the escape hatch for a box the catalogue does not name;
it is untyped by design and the rules say so rather than staying silent. Rules may select by
category.

**A2.3** `properties` is required and may be empty. A property definition has:

| Field | Required | Meaning |
|---|---|---|
| `type` | yes | `boolean`, `integer`, `string`, `enum`, `ref` |
| `values` | if `enum` | Allowed string values, at least one |
| `default` | no | Value assumed when neither component nor node sets one |
| `required` | no | If true, a node must resolve a value from its props, the component defaults, or this default |
| `refKind` | if `ref` | The kind the referenced node must have; the value on a node is another node's id |

**A2.4** A property with neither `default` nor `required` is optional and may be absent. Rules test
absence explicitly.

**A2.5** Inheritance is exactly one hop: a component extends one kind; a kind never extends a kind.
Shared properties between kinds are accepted duplication.

**Acceptance:** a kind with an unknown category, an enum without values, a `ref` without
`refKind`, or a default outside the enum's values is rejected.

### A3. Component

**A3.1** File shape:

```yaml
schemaVersion: "1"
type: "component"
id: "kafka"
kind: "queue"
provider: "default"
defaults: { replay: true, ordering: "per-key" }
properties:
  partitions: { type: "integer" }
```

**A3.2** `kind` names exactly one existing kind. `provider` is one of `aws`, `azure`, `gcp`,
`oci`, `cloudflare`, `default` and must match the folder the file lives in. Adding a provider is a
governance change.

**A3.3** Provider means ownership, not hosting. An open-source database stays `default` even when
run on a cloud vendor's managed service; the vendor's own product is under the vendor.

**A3.4** `defaults` sets values for kind properties this implementation changes. Every key must
exist on the kind and every value must satisfy the property's type.

**A3.5** `properties` defines implementation-specific properties with the same definition shape
as on a kind. A component property must not redefine a kind property.

**A3.6** Property resolution order on a node. The effective value is the first found:

1. the node's `props`
2. the component's `defaults`
3. the property definition's `default` (on the kind, or on the component for component-specific
   properties)
4. absent

Setting a property that exists on neither the kind nor the component is a structural error.

**Acceptance:** a component in the wrong provider folder, with a default for a property its kind
does not have, or redefining a kind property, is rejected with a message naming the property.

### A4. Design

**A4.1** File shape:

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

**A4.2** Required: `schemaVersion`, `type`, `id`, `nodes`, `edges`. `nodes` has at least one
entry. `edges` may be empty and is then written as an explicit empty list, never as a bare key.

**A4.3 Requirements.** Promises the whole design makes; rules compare nodes against them. All paths
are optional; an absent requirement never equals anything. The governed path set at launch:

| Group | Paths |
|---|---|
| `availability` | `multiRegion` bool · `sla` string matching `^[0-9]{2}(\.[0-9]+)?$` · `zones` int · `regions` int · `discoveryRedundant` bool · `degradedModeAllowed` bool |
| `messaging` | `replay` bool · `exactlyOnce` bool · `orderingScope` `partition\|global` |
| `latency` | `p95Ms` int · `p99Us` int · `geoDistributed` bool |
| `durability` | `annualNines` int · `minReplicasAcked` int |
| `consistency` | `model` `ap\|cp` · `readAfterWrite` bool · `quorumScope` `region\|global` |
| `correctness` | `exactlyOnceEffect` · `reproducible` · `tamperEvident` · `billingGrade`, all bool |
| `money` | `zeroSum` bool · `pci` bool |
| `data` | `reconciliation` · `lossDetection` · `ownershipExclusive` · `immutableAudit`, all bool |
| `traffic` | `readWriteRatio` int · `skew` `uniform\|heavy-tail` · `peakMultiplier` int |
| `isolation` | `perQueue` bool · `perEventType` bool · `tenancy` `shared\|cell\|dedicated` |
| `freshness` | `maxSeconds` int |
| `security` | `certificateRotationAutomated` bool · `credentialRotationDays` int |
| `observability` | `alertingIndependent` bool |

Every path is backed by at least one intake card (section 22). New paths go through governance.
Unknown paths are structural errors.

**A4.4 Groups.** Nested boundaries. Fields: `id`, `kind`, optional `label`, optional `parent`.
Kinds: `region`, `availability-zone`, `vpc`, `trust-zone`, `system`, `cell`, `point-of-presence`.
A node belongs to at most one group; a group has at most one parent; parent chains must not cycle.
A node's ancestry is its group, that group's parent, and so on. Rules ask how many groups of a
kind are in a node's ancestry.

**A4.5 Nodes.**

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique within the design |
| `component` | yes | Id of a component in the catalogue |
| `label` | no | Display name kept verbatim by importers; read by renderers, never by rules |
| `group` | no | Id of a group in this design |
| `props` | no | Property values, per the resolution order |
| `nfr` | no | `rps` int · `latencyP95Ms` int · `consistency` `strong\|eventual` |

**A4.6 Edges.** Directed. Required: `from`, `to`, `protocol` (free string), `mode` (`sync\|async`).
Optional: `delivery` (`at-most-once\|at-least-once\|exactly-once`), `label`, `timeoutMs` int,
`retryPolicy` (`none\|fixed\|exponential\|exponential-jitter`), `idempotent` bool,
`circuitBreaker` bool, `fallback` (`none\|static\|cached\|degraded`), `batched` bool. Parallel
edges between the same pair are allowed and are distinguished by order.

**A4.7 Structural validity.** A design is structurally valid when: it satisfies the schema; every
node's component exists; every node's group exists; every edge endpoint exists; every prop is
defined on the kind or the component and satisfies its type; every required property resolves;
every `ref` property points at a node of the required kind; node ids, edge identities and group
ids are unique; group parent chains do not cycle.

**Acceptance:** each violation above produces one structural finding whose message names the
offending id and path; a valid design produces none.

### A5. Rule

**A5.1** File shape:

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

**A5.2** `severity` is `error`, `warning` or `info`. `select` takes exactly one of `node` (by
`kind` and/or `category`), `edge` (by `mode` and/or `delivery`), or `design: true`.

**A5.3** The fixed predicate set. Nothing else parses; extending it is a governance change.

| Predicate | Shape |
|---|---|
| `all` / `any` | array of predicates |
| `not` | one predicate |
| `prop` | property name with `equals`, `in`, or `exists` |
| `requirement` | dotted path with `equals`, `in`, or `exists` |
| `hasEdge` | `{direction: in\|out\|any, mode?, peerKind?, peerCategory?, count?}` |
| `inGroup` | `{kind: <group kind>, count?}` |
| `crossesGroup` | `{kind: <group kind>}`, for edge selectors |
| `from` / `to` | a predicate applied to an edge's endpoint node |
| `syncChainDepth` | integer comparison |
| `nfr` | `{rps?\|latencyP95Ms?}` with a comparison |
| `hasNode` | `{kind?, category?}`, for design selectors |
| `field` | edge field name with `equals`, `in`, or `exists` |
| `gt` / `lt` / `eq` | integer comparison |

**A5.4** `message` is a template with `{{node.id}}`, `{{edge.from}}`, `{{edge.to}}` and
`{{design.id}}` substitutions. Messages are part of the rule's contract and are compared verbatim
in tests.

**A5.5 Semantics that must be identical in every implementation:** property resolution uses A3.6;
`syncChainDepth` is the longest chain of synchronous edges reaching the node, computed exactly on
acyclic subgraphs and with a defined, documented, bounded treatment of cycles that yields the same
number on every implementation and never exceeds the performance budget in section 19; a rule that
throws during evaluation produces a finding of severity `error` naming the rule, never a silent
omission.

**Acceptance:** the shipped rule set parses; each rule fires on its broken twin and not on its
clean reference; two independent evaluators, if two ever exist, produce identical findings and
identical message strings on every shipped design.

### A6. Locale

**A6.1** One document per language, keyed by identifier, with sections for `categories`, `kinds`,
`components`, `rules`, `groupKinds`, `requirements` and `properties`. Entries have a `name` and
may have a `description`.

**A6.2** Every identifier in the catalogue has an entry in the base language, and every entry
refers to an identifier that exists. Both directions are checked.

**A6.3** Additional languages fall back to the base language per entry. Translations are
contributed through the same governance process.

### A7. Parsing and serialisation contract

**A7.1** The engine parses YAML into a document plus a source map that records the span of every
section, entry and scalar.

**A7.2** Round trip guarantee: serialising an unmodified parse produces bytes identical to the
input, including comments, blank lines, quoting style, flow versus block style and indentation.

**A7.3** Minimal diff guarantee: after a change, serialising produces output that differs from the
input only on the lines needed to express that change. Comments attached to untouched entries
survive. A comment attached to a deleted entry is deleted with it.

**A7.4** Conformance: for every document the engine accepts, its parsed value equals the value a
reference YAML implementation produces for the same text. This is tested on every shipped
document and on a corpus of generated documents covering: sequences at the parent key's indent;
comments between entries and inside entries; blank lines inside blocks; two-space and four-space
indentation; nested block maps inside sequence entries; flow and block forms of every collection;
empty collections in both forms; quoted, single-quoted and bare scalars; scalars containing
commas, colons, hashes and quotes.

**A7.5** Unsupported input is rejected. If the engine does not support a YAML construct, it must
refuse the whole document with a message that names the line and the construct. It must never
parse such input into a partial or altered document.

**A7.6** Emission rules: an empty list is written `key: []`, never a bare key; a scalar that gains
entries becomes a block sequence; a bare scalar whose new value would change meaning when written
bare (it contains `, `, ` #`, `: `, a leading special character, or reads as a number, boolean or
null) is quoted; a key whose value is removed is removed entirely, leaving neither an empty
section nor a dangling key.

**Acceptance:** a round-trip test over every shipped document and the generated corpus shows
byte identity; a mutation test shows diffs confined to changed lines; every corpus item that the
engine does not support is refused with a line number and the original file is untouched.

---

## 7. Pillar B: the catalogue

### B1. Coverage

**B1.1** At launch the catalogue holds at least the kinds and components already curated
(seventy-one kinds; roughly sixteen hundred components across six providers). A per-provider
inventory lists the products of each provider and, for each, the component that represents it or
a recorded reason it is excluded.

**B1.2** Every component sets `defaults` for the kind properties that its real product decides,
so that a rule reading that property gets the product's real answer rather than the kind's
generic one. A component with no defaults is acceptable only for a generic in-house component
and is flagged in the inventory.

**B1.3** Every kind used by at least one shipped design is covered by at least one rule
(section 8, C2).

### B2. Icons

**B2.1** One 24×24 stroke glyph per kind, original work under the project licence. One mark per
provider; vendor logos used only where their licence permits, otherwise an original neutral
glyph. One icon per component, composed from the kind glyph and the provider badge, or a brand
mark whose licence permits it.

**B2.2** Every icon is inline-safe: no scripts, no event handler attributes, no external
references, no foreign content; every path is drawable by a browser. This is checked by a tool,
and every icon added later passes the same check before it is merged.

**B2.3** A provenance record lists the source and licence of every icon family.

### B3. Bundle

**B3.1** The catalogue compiles into a bundle any client can load: the sorted kinds, components,
rules and locale; the design schema (which generates the requirements editor); a search index
with one row per component; the design index; and the icons keyed by identifier.

**B3.2** Bundle generation is deterministic. Generating twice from the same inputs produces
identical bytes.

**B3.3** The committed bundle is always fresh. A test derives the expected bundle from the source
files and fails if the committed one differs.

**B3.4** The bundle is versioned with the catalogue, served as a static, cacheable artefact, and is
identical for every consumer: the linter, the canvas and the platform.

### B4. Catalogue tooling

Tools exist, documented and tested, to: query the catalogue by id, kind, provider and text; list
kinds and providers; add a kind from a proposal document (file, locale entry, glyph, inventory
row); merge, verify and prune locale entries; write missing icons; check every icon path; and
regenerate the bundle.

**Acceptance:** each tool has a usage message on wrong arguments and a non-zero exit on failure,
never a stack trace.

---

## 8. Pillar C: the rules

### C1. Shipped rule set

**C1.1** The launch set includes at least the thirty-six rules already written (listed in the
format specification) plus the additions in C2.

**C1.2** Every rule has: an identifier; a severity; a one-paragraph rationale in the
documentation naming the failure it prevents; at least one intake card as evidence; a positive
fixture (a design it must fire on) and a negative fixture (a design it must not fire on).

### C2. Coverage expansion

**C2.1** Before release, rules exist for every kind that appears in any shipped design and for
every kind whose category is `messaging`, `data`, `compute`, `edge` or `security`. A coverage
report lists, per kind, the rules that select it; kinds with none are listed as gaps with a
recorded reason.

**C2.2** At least one rule reads each requirement path, or the path is removed from the governed
set with a note in the gap log.

### C3. External validation

**C3.1** Before release, the rule set is run over at least ten designs imported from sources
outside the project (published architectures, open-source infrastructure definitions,
contributed designs), and the findings are recorded: which rules fired, whether each finding was
judged real, noise or a catalogue gap. This record is published with the release. It is the
evidence for the thesis and is a release blocker.

### C4. Rule authoring

**C4.1** Documentation explains the predicate set with one example per predicate.

**C4.2** A rule proposal follows the governance process and must ship with its fixtures.

---

## 9. Pillar D: designs and the import contract

### D1. Tiers

| Tier | Meaning | Writable by an editing session |
|---|---|---|
| reference | Curated by the project; each has a broken twin | No |
| imported | Faithful to a source document; carries a fidelity mapping | No |
| authored | Created in the canvas or by hand by a user | Yes |

The tier decides writability. This is the most important invariant of the repository form of the
product, and it is enforced at every layer that can write (section 11, F6).

### D2. Folder contents

```
designs/reference/<id>/
  design.yaml           the clean design
  design.broken.yaml    deliberately broken; header lists the rule ids it must trip
  design.layout.json    optional layout sidecar
  diagram.svg           rendered
  diagram.broken.svg
  diagram.md            text diagram
  notes.md              decisions, assumptions, gaps, rules fired
  source/               original material where redistribution is permitted

designs/imported/<id>/
  source/               the user's material, or a factual transcription when it cannot be redistributed
  design.yaml
  mapping.yaml          source inventory and where every item went; machine-checked
  diagram.md
  diagram.svg
  notes.md

designs/authored/<id>/
  design.yaml
  design.layout.json
```

### D3. Reference designs

**D3.1** At least the seven existing reference designs ship. Each broken twin's header lists the
rule ids it must trip, and the validator checks that it trips exactly those.

**D3.2** Every kind added after the original set appears in at least one reference design or is
listed as a gap with a reason.

### D4. The import contract

**D4.1** Input formats: raster and vector images, draw.io, Mermaid, PlantUML, Excalidraw,
Markdown descriptions, and infrastructure definitions (Terraform, Bicep, ARM, CloudFormation,
Pulumi). A resource-type map from each infrastructure format to component ids is maintained; a
type may map to a component, to "not a node", or to "a node whose component is still to be
added".

**D4.2** The output is the same design the user supplied: same boxes, same names, same arrows,
same boundaries. Nothing is added, dropped, renamed or improved. Only the type behind each box
changes, and every node keeps the source name verbatim in `label`.

**D4.3** The fidelity mapping records every source item and where it went, in both directions,
and a tool proves it: counts match, every item is mapped, every label is verbatim, nothing is
unmapped.

**D4.4** When a box has no component, the importer stops and the catalogue is extended through
the governed process before the import completes. The importer never invents a component.

**D4.5** Copyrighted sources are never stored. A factual transcription of box labels, arrows and
boundaries, with a citation, is stored instead.

### D5. Layout sidecar

**D5.1** Positions and edge bows are not part of the format and never enter the design document.
They live beside it:

```json
{ "version": 2, "nodes": { "<node id>": [x, y] }, "edges": { "<edge key>": bow } }
```

**D5.2** An edge key is `from>to`, or `from>to#n` for the n-th parallel edge. A design without a
sidecar is laid out by the deterministic layout (F5).

### D6. Renderers

**D6.1** A standalone vector renderer and a text-diagram renderer exist as tools. They read the
design and, if present, the sidecar. They use the single layout implementation (principle 5).

---

## 10. Pillar E: the linter, the command line and continuous integration

This pillar is what a development team adopts. It is the first deliverable of the release plan.

### E1. Command line tool

**E1.1** Installable from a public package registry with one command; runnable without
installation through the registry's ad-hoc runner.

**E1.2** Commands:

| Command | Does |
|---|---|
| `zeema lint <paths...>` | Structural check and rules on one or more designs, or on every design under a folder |
| `zeema validate` | The full repository gate: schemas, catalogue, locale, icons, rules, reference twins, imported fidelity |
| `zeema render <design> --format svg\|mermaid` | Render using the shared layout |
| `zeema catalogue find\|component\|kind\|kinds\|providers` | Query the bundle |
| `zeema import <source> --into <folder>` | Run the import contract as far as it can be automated and report what a person must decide |
| `zeema init` | Create a starter design, the editor schema mapping and a continuous-integration workflow |
| `zeema version` | Tool, schema and catalogue versions |

**E1.3** `lint` output formats: human-readable (default), JSON, and a static-analysis interchange
format that code hosting platforms render inline on pull requests. Each finding carries rule id,
severity, message, file, and the path or line of the subject.

**E1.4** Exit codes: 0 when no structural finding and no rule finding at or above the configured
failing severity; 1 when any such finding exists; 2 on usage or input error. The failing severity
defaults to `error` and is configurable.

**E1.5** A configuration file at the repository root may set: design paths, failing severity,
rules to disable with a required reason, and a catalogue version pin. An inline suppression on a
node or edge may silence one rule for that subject with a required reason, and suppressions are
counted in the output.

**E1.6** The tool bundles the catalogue it was released with and can be pointed at a newer bundle.

**E1.7** No network access is required to lint.

### E2. Continuous integration

**E2.1** A published, reusable workflow for the major code hosting platform runs `zeema lint`
on changed designs, annotates the pull request with findings, and fails the check by the same
exit rules as E1.4.

**E2.2** The project's own repository runs the full gate (E1.2 `validate` plus the engine and
editor test suites) on every pull request and on the default branch. Merging is blocked on a
failing gate.

### E3. Editor integration

**E3.1** The schemas are published at stable addresses so any editor with JSON Schema support
validates and completes designs on type. `zeema init` writes the mapping for the common editors.

**Acceptance:** a fresh repository with one design and the published workflow gets a failing
check with inline annotations when a rule of severity `error` fires, and a passing check after
the fix; linting works offline; the JSON output validates against a published output schema.

---

## 11. Pillar F: the canvas editor

The canvas is a visual authoring surface for the same format. It reads and writes the design and
its sidecar and never a private representation. It exists in two hostings with one code base:
the local repository editor (served beside the files) and the platform editor (section 12).

### F1. Architecture requirements

**F1.1** The engine (parse, serialise, document operations, structural checks, rules, layout,
edge geometry) is a single, dependency-free, environment-independent library shared by the
canvas, the command line tool and the platform's storage gate. It has no reference to a browser
or a file system.

**F1.2** The browser layer has no build step and no external runtime dependencies. This is
enforced by a test.

**F1.3** State is one document plus one position map plus one bow map. Every change goes through
a single commit path that snapshots the previous state before applying the change, so undo and
redo are uniform. An interaction that changes state without going through the commit path is a
defect.

**F1.4** Rendering during a drag writes directly to the drawing surface and creates no new
elements; the number of framework-level renders during a drag is constant. This is enforced by a
test.

### F2. Palette

**F2.1** Every component is listed, searchable by id, name, kind, category and provider, with
`provider:` and `kind:` filters. A row is dragged onto the canvas to place a node. Search over the
full catalogue stays inside the budget in section 19.

### F3. Scene and gestures

**F3.1** Gestures: marquee on empty drag; pan with middle button or a held key; zoom with the
wheel; drag a node's port to wire an edge, with the candidate target highlighted; drag an edge
to bow it; drag a node or a selection to move it as one history entry; drop inside a boundary to
change group membership; context menu on whatever is under the pointer; double-click a label to
edit it in place.

**F3.2** Hit testing resolves the subject from the model, not only from the element under the
pointer, so a pointer-captured drag still targets correctly. Group boundaries have a wide
invisible stroke so they are grabbable.

**F3.3** Selection has a primary subject (drives the inspector) and a multi-selection set.

**F3.4** Edge labels sit on the curve's true midpoint. Parallel edges are offset so they do not
overlap. Boundaries follow their members during a drag.

### F4. Inspector

**F4.1** Generated from the catalogue and the schema, never hand-coded: kind properties,
component properties, edge fields, group kind and parent, node `nfr`, and the whole requirements
tree from the design schema. A control shows the value the design would resolve to and writes
only when the user sets a value. Unset required properties are called out.

**F4.2** Keyboard shortcuts for undo, redo and save do not fire while a text control in the
inspector has focus; the control's pending value is committed first.

### F5. Layout and arrange

**F5.1** The deterministic layout places nodes in layers from sources down with stable ordering;
group members share a rank; the same design lays out identically in every implementation and on
every run. "Arrange" replaces every position with the computed layout as one undoable step.

### F6. Names, boundaries, edges

**F6.1** A placed node is named what the catalogue calls its component. Two instances of one
component are two of the same component. While a node's id is still the generated one, renaming
the label renames the id to match; an id the user typed is never rewritten. The id field
kebab-cases input and reports collisions.

**F6.2** Grouping a selection creates a boundary; grouping nodes that already share a boundary
nests inside it. Deleting a boundary keeps its members by default and offers deleting both.
Renaming a group to an existing id is refused.

**F6.3** Deleting nodes removes their edges and clears every `ref` property that pointed at them.
Renaming a node updates every edge and every `ref` property.

**F6.4** An edge can be bowed, straightened, reversed and switched between sync and async from
its menu. Reversing keeps the edge's other fields.

### F7. Saving, drafts and read-only

**F7.1** Save is byte-preserving (A7). Autosave writes shortly after each change but only while the
design is structurally valid. The keyboard shortcut and the button share one save path and the
same gate: a structurally invalid design is never written by either.

**F7.2** Saves are serialised: a save in flight blocks another; a change made during a save marks
the state dirty again and is not lost; the document after a save is the document that was saved
plus the changes made since, never a re-parse that discards them.

**F7.3** Unsaved work is mirrored to a local crash net keyed by design, with these rules: a draft
is kept only for a design that can be saved, including a new design not yet saved; a draft is
restored only onto the same base content it was taken from, by hash; undo and redo update the
draft; a failing local store never prevents editing.

**F7.4** Read-only designs (reference, imported, another owner's public design) disable save and
autosave with a stated reason, keep no draft, and the storage layer refuses the write. Every
layer is independent, and removing any one is a regression.

**F7.5** New starts an unsaved authored design and stays unsaved until it has one node. Clone
writes what is on screen, including unsaved edits and layout, to a new authored design with a
suggested id, and records the source in the header.

### F8. Export

**F8.1** Formats: SVG, PNG, JPEG. The vector is the source for all three. Colour variables are
resolved to literal colours before export. The exported palette is the one the user chose, and
light when none was chosen. Export counts are reported to the platform when the design lives
there.

### F9. Address bar

**F9.1** A design has a stable address: by id when unambiguous, by tier and id when two tiers
share an id, and a `broken` suffix for a broken twin. An unknown address opens the editor's
picker, never an error page.

### F10. Keyboard

New, save, undo, redo, select all, duplicate, fit, actual size, group, ungroup, nudge (with a
larger step modifier), edit label, delete, deselect, and a help sheet listing every gesture and
key.

### F11. Local repository server

**F11.1** Serves the repository files and accepts writes only to `designs/authored/<id>/design.yaml`
and its layout sidecar, with an id in kebab-case. Refusals are exact, documented messages.

**F11.2** Binds to the loopback interface only; rejects requests whose host header is not
loopback; caps request body size; validates the design structurally before writing and refuses
an invalid one; creates no folder until a valid write is accepted; never leaves a partial file
(writes to a temporary file and renames).

**F11.3** Resolves every path inside the repository root with a separator-safe check, does not
follow symbolic links outside it, and returns 404 with the right content type for a missing
asset rather than the application page.

**F11.4** A malformed request never terminates the process.

**F11.5** Serves the live design index read from the folders.

**Acceptance:** the editing test suite, run against the engine and the server without a browser,
covers every behaviour above, and a browser-driven suite covers the gestures.

---

## 12. Pillar G: the community platform

### G1. Product requirements

1. Free and open to read: anyone can browse public designs and open them on the canvas.
2. Creating requires an account, and the account is a GitHub identity. No passwords are handled.
3. Every design a user creates belongs to that user, under their username.
4. A design is public or private; the owner chooses. A public design is readable by all and
   editable only by its owner; to everyone else it behaves as a reference design does.
5. A user lists, searches and filters their own designs.
6. A user has a profile with display name, avatar, bio, and their public designs.
7. The community sees, per design, the number of clones and exports.
8. The curated designs (reference and imported) are seeded as owner-less, public, read-only
   designs, and their broken twins remain addressable.
9. The catalogue stays global, public and static. Only designs live in the platform store.

### G2. Surfaces

**G2.1 Browse.** Paginated list of public designs with search over title, summary, tags and
component ids; filters by provider, kind, tag and owner; sort by updated, created, clones,
exports. A card shows title, owner, summary, provider marks, counts and updated time.

**G2.2 Design page.** Title, owner, summary, tags, visibility, counts, the canvas (read-only for
non-owners), a YAML view, download of YAML and sidecar, export, clone.

**G2.3 Editor.** The canvas (section 11) with save to the platform, visibility toggle, title and
summary editing, version history with messages, and restore of an earlier version as a new
version.

**G2.4 Profile.** Public: display name, avatar, bio, public designs. Own: also private designs,
settings, and account actions (export all data, delete account).

**G2.5 Auth.** Sign in with GitHub, sign out, session expiry with re-authentication.

**G2.6 Search.** Full-text over public designs and, when signed in, over the caller's private
designs with an explicit scope switch.

### G3. Versions and concurrency

**G3.1** A save creates an immutable version holding the YAML text verbatim, the layout sidecar,
a content hash, the author, an optional message and a timestamp. The design points at its
current version.

**G3.2** Byte preservation is retained through storage: reading a version and writing it back
unchanged yields the same content hash.

**G3.3** A write must carry the content hash the client last saw; a mismatch is refused with a
conflict response, and the client offers reload, overwrite, or clone.

**G3.4** Storage validates structurally with the shared engine before accepting a version.

### G4. Counters and events

**G4.1** Views, clones and exports are recorded as append-only events with actor (nullable for
anonymous), kind, format for exports, timestamp and a hashed network address, and are rolled
into per-design counters. Clone increments exactly once per clone. Anonymous events are
rate-limited and deduplicated per address per day.

### G5. Lifecycle

**G5.1** Soft delete with a restore window; hard delete after the window by a scheduled job.
Deleting a design removes it from every listing immediately. Deleting an account soft-deletes
every design and anonymises events.

**G5.2** Usernames are the GitHub login at sign-up, renameable; an old username is reserved for
the account for a period so links do not change hands.

### G6. Git export

**G6.1** A user's design can be exported as a folder in the repository layout (design, sidecar,
rendered diagrams, notes) and, where the user authorises it, opened as a pull request against a
repository they name. Export then import yields identical bytes.

**Acceptance:** an end-to-end browser test signs in against a mocked identity provider, creates,
saves, toggles visibility, clones from a second account, exports, and verifies counts; the
authorization matrix in section 13 is tested at the service interface independently of the
interface.

---

## 13. Identity, authentication and authorization

### I1. Authentication

**I1.1** OAuth 2.0 authorization-code flow with PKCE against GitHub. The stable numeric GitHub id
is the identity key, not the login. The scope requested is the minimum needed to read the public
profile; no repository scopes unless the user opts into git export, and then only for that
action.

**I1.2** The access token is used for the profile fetch during sign-in and is not persisted
unless a feature the user enabled needs it; then it is encrypted at rest, scoped, and revocable
from settings.

**I1.3** Sessions are server-side, referenced by an opaque, HTTP-only, secure, same-site cookie,
with idle and absolute expiry, rotation on privilege change, and revocation on sign-out from
every device.

**I1.4** State and nonce are validated on the callback; the redirect target is an allow-listed
path.

### I2. Authorization matrix

| Actor | Public design | Private design | Curated (owner-less) |
|---|---|---|---|
| Anonymous | Read, clone-preview, export | Not found (never "forbidden", to avoid leaking existence) | Read, export |
| Signed in, not owner | Read, clone, export | Not found | Read, clone, export |
| Owner | Read, write, delete, change visibility, version history | Same | Not applicable |

**I2.1** The matrix is implemented once, at the service boundary, and every interface derives its
own state (editable or not) from the service's answer. The reverse is a defect.

**I2.2** Visibility is applied inside every listing and search query, never as a filter after the
fact. Every list endpoint is tested with a private fixture.

**I2.3** Rate limits apply per user and per address on create, clone, events, sign-in and search.

---

## 14. Conceptual data model

Entities and their fields, independent of storage technology. Identifiers are opaque and
non-sequential.

**User:** id; external identity provider id (unique); username (unique, case-insensitive);
display name; avatar address; bio; created and updated timestamps; deleted timestamp.

**Reserved username:** username; user id; released-at timestamp.

**Design:** id; owner id (null for curated); slug (kebab-case, unique per owner); title; summary;
visibility (`public` or `private`, default private); origin (`authored`, `imported`,
`reference`); source design id (set on clone); current version id; created, updated, published
and deleted timestamps.

**Design version:** id; design id; YAML text verbatim; layout sidecar; content hash; author id;
message; created timestamp; a flag marking a broken twin.

**Design stats:** design id; view, clone and export counts; updated timestamp.

**Design event:** id; design id; actor id (nullable); kind (`view`, `clone`, `export`); export
format; created timestamp; hashed network address.

**Tag** and **design tag:** name; design id.

**Session:** id; user id; created, last-seen and expiry timestamps; revoked flag.

**Indexes required by behaviour:** designs by owner and updated time; public designs by updated
time, clone count and export count; a text index over title, summary, tags and component ids;
versions by design and time; events by design and time; sessions by user.

---

## 15. Service interface

Versioned under a path prefix. JSON bodies. Errors are a structured object with a stable code, a
message and, for validation, a list of findings in the same shape the linter emits.

| Operation | Auth | Behaviour |
|---|---|---|
| Start sign-in | none | Begin the OAuth flow |
| Sign-in callback | none | Exchange the code, upsert the user, create a session |
| Sign out | session | Revoke the session |
| Get current user | session | Profile and settings |
| Update current user | session | Display name, bio |
| Export my data | session | Every design, version and profile field as an archive |
| Delete my account | session | Soft delete, scheduled hard delete |
| List designs | optional | Browse with search, filters, sort, pagination; includes the caller's private designs only with an explicit own-scope |
| Create design | session | Title, optional slug, visibility, initial YAML; validated |
| Get design | optional | Metadata and current version summary, per the matrix |
| Get design YAML | optional | The verbatim text |
| Get design layout | optional | The sidecar |
| List versions | per matrix | History with messages and hashes |
| Get version | per matrix | One version's text and sidecar |
| Save version | owner | Requires the last-seen content hash; validated; creates a version |
| Update design | owner | Title, summary, visibility, tags |
| Delete design | owner | Soft delete |
| Clone design | session | Into the caller's account; body may carry what is on screen, unsaved edits included; increments the clone count exactly once |
| Record event | optional | Export counter ping; rate-limited |
| Get user profile | optional | Public profile and public designs |
| Get catalogue bundle | none | Static, versioned, cacheable |
| Health | none | Liveness and readiness |

**Acceptance:** every operation has a contract test; every owner-only operation returns not-found
for a non-owner on a private design and forbidden on a public one; the interface schema is
published.

---

## 16. Security requirements

**S1** No password is ever handled. Identity is delegated (section 13).

**S2** All traffic is over TLS. Cookies are secure, HTTP-only and same-site. Security headers
(content security policy without inline script, frame denial, referrer policy, content type
sniffing denial) are set on every response.

**S3** Every input is validated at the boundary: designs by the shared engine; identifiers by
pattern; sizes by limit (design text, sidecar, title, summary, bio, tag count). Oversized bodies
are refused before they are read into memory.

**S4** No design text, label, id, finding, or user-supplied string is ever inserted as markup.
Icons and any other trusted markup are sanitised at build time and again at load time by an
allow-list (no scripts, handlers, external references or foreign content).

**S5** Path handling in every file-serving component uses a separator-safe root check and does
not follow links outside the root.

**S6** A malformed request never terminates a process. Errors are caught at the top of every
handler and logged with a correlation id.

**S7** Secrets are held in a secrets manager, never in the repository, and rotated. Access tokens
that must be stored are encrypted at rest.

**S8** Rate limiting and abuse controls per user and address on every write and on sign-in, with
a report mechanism for abusive content and an operator takedown path.

**S9** Dependency and container scanning run in the gate; a known critical vulnerability blocks
release.

**S10** A security policy document states how to report a vulnerability and the response
commitment.

**S11** Audit log for owner actions on designs and for operator actions.

---

## 17. Privacy, legal and licensing

**L1** The project is released under a permissive open-source licence, with a licence file at the
root of the repository and in every published package.

**L2** No copyrighted third-party material is stored in the repository or its history. Any such
material present today is removed from the entire history before the repository is made public,
and the removal is verified by a search of every commit. Imported designs keep only factual
transcriptions with citations (D4.5).

**L3** Icon provenance and licences are recorded and compatible with the project licence.
Vendor marks are used only under their published guidelines or replaced by original glyphs.

**L4** A privacy notice states what is collected (profile fields from the identity provider,
designs, events with hashed addresses), why, for how long, and how to export or delete it. Data
export and account deletion are self-service (section 15).

**L5** Event data stores a hashed network address with a rotating salt, never the raw address.

**L6** Terms of use cover ownership (users own their designs), licence to display public designs,
prohibited content and takedown.

**L7** A contributor licence statement or developer certificate is required for catalogue and
rule contributions.

---

## 18. Quality, testing and engineering discipline

**Q1 One engine.** Parsing, serialisation, structural validation, rule evaluation, property
resolution, layout and edge geometry each have one implementation used by the command line tool,
the canvas, the platform gate and every test. A test may spawn the tool as an oracle but must not
carry its own copy of an algorithm.

**Q2 Gates.** The repository gate (catalogue, locale, icons, rules, reference twins, imported
fidelity, bundle freshness), the engine gate (parser conformance and round trips, structure,
rules, layout, geometry, document operations), the editor gate (authoring and editing cycles
against a real local server, browser-driven gestures), and the platform gate (contract tests,
authorization matrix, end-to-end flows) all run on every pull request and block merge.

**Q3 Tests do not mutate the source tree.** Every test that needs files works in a temporary
directory and cleans up in all exit paths, including interruption. The committed bundle is
compared against a freshly generated one, never overwritten by a test.

**Q4 No hard-coded catalogue counts.** Expected counts and fixture components are derived from the
source files or selected by property, so a legitimate catalogue addition does not break tests.

**Q5 One test runner** with consistent assertion style, per-test reporting, timing, and correct
exit codes. Failure output includes the diagnostic, not only a name.

**Q6 Parser conformance corpus** (A7.4) is part of the engine gate, and every construct the
engine refuses is present in the corpus as a refusal case.

**Q7 Performance budgets** (section 19) are asserted in the gate on a dedicated runner with
generous margins, or reported and compared against a baseline when the runner is shared.

**Q8 Regression tests.** Every defect fixed after release ships with a test that reproduces it.

**Q9 Static checks.** Formatting, linting, dead-code detection and type checking (where the
stack offers it) run in the gate. The engine has no environment-specific references, enforced by
a test. The browser layer has no external imports and no build step, enforced by a test.

**Q10 Definition of a defect.** Any of: a silent data alteration; a crash on input; a policy
enforced in one interface and not another; a behaviour implemented twice; a test that can pass
vacuously; a message that differs between the tool and the canvas for the same problem.

---

## 19. Performance and capacity budgets

| Measure | Budget |
|---|---|
| Layout of a two-hundred-node design | under 500 ms |
| Rule evaluation on the largest shipped design | under 100 ms mean, under 250 ms worst, on any design a user can draw, including cycles |
| Palette search over the full catalogue | under 16 ms mean |
| Framework renders during a hundred-step drag | constant |
| Time to interactive canvas, warm cache | under 2 s |
| Browse list, ten thousand designs, 95th percentile | under 200 ms |
| Save round trip, 95th percentile | under 300 ms, with optimistic state so it is never read as data loss |
| Catalogue bundle | cached at the edge; version-addressed |
| Design size limit | one thousand nodes, five thousand edges; larger is refused with a message |

---

## 20. Operations, reliability and observability

**O1** Environments: local, staging, production, with identical configuration shape.

**O2** Deployments are reproducible from a tagged commit, and rollback to the previous release is
one action.

**O3** Backups of the platform store at least daily with point-in-time recovery, restore tested
quarterly, retention documented.

**O4** Structured logs with correlation ids; metrics for request rate, latency, errors, save
conflicts, sign-in failures, rate-limit hits; alerts on error rate, latency and backup failure;
dashboards for the operator.

**O5** Availability target for the hosted platform stated publicly, with a status page.

**O6** Incident process: severity levels, on-call contact, post-incident write-up for
user-affecting incidents.

**O7** Scheduled jobs: hard delete after the retention window, counter reconciliation from
events, session expiry, salt rotation.

---

## 21. Documentation

| Document | Content |
|---|---|
| Argument | What Zeema is, the ten-line example, the thesis |
| Format specification | Every field, every rule of A1 to A7, with examples |
| Rule reference | Every shipped rule: rationale, evidence, positive and negative examples |
| Catalogue reference | Every kind with its properties; component search; provider inventories |
| Authoring guide | Writing a design by hand; using the canvas; import contract; sidecar |
| Linter and continuous integration guide | Install, run, configure, suppress, workflow, output formats |
| Canvas guide | Every gesture and key; saving, drafts, read-only, clone, export |
| Platform guide | Accounts, visibility, clone, versions, export, profile, data export and deletion |
| Governance | How to propose a kind, property, requirement path, rule, provider, or locale |
| Contributing | Repository layout, gates, style, licence statement |
| Security policy | Reporting and response |
| Privacy notice and terms | Sections 17 |
| Changelog and versioning policy | Tool, schema and catalogue versions |
| Evidence report | The external validation record (C3) |
| Gap log | What the format could not express, with status |

Every code sample in the documentation is executed in the gate so it cannot rot.

---

## 22. Governance and community process

**G1** Proposals for a kind, a property, a requirement path, a rule, a provider or a group kind
are written as an intake card: the system studied, the failure observed, the smallest change to
the vocabulary that lets a rule catch it, and the evidence. Cards are stored with the project.

**G2** A change is accepted when it passes the gate, ships with fixtures and locale entries, and
is reviewed by a maintainer who is not the author.

**G3** The vocabulary is versioned with the catalogue; removals go through deprecation with a
migration note and a minimum notice period.

**G4** Contribution channels: issue templates for a missing product, a false positive, a false
negative and a format gap; a discussion space; a code of conduct; a maintainer list with response
expectations.

**G5** Releases are tagged; the changelog lists every vocabulary change, every rule change and
every tool behaviour change.

---

## 23. Release plan and milestones

Each milestone ends in something machine-checkable and is shippable on its own. Do them in order.

| # | Milestone | Done when |
|---|---|---|
| M0 | Legal and hygiene | Licence file present; copyrighted material purged from history and verified; provenance record complete; stale documentation counts corrected; working tree clean |
| M1 | Continuous integration for the project | Every gate runs on pull requests and the default branch; merge is blocked on failure; tests do not mutate the tree; counts derived from disk; one runner |
| M2 | One engine | Parser conformance corpus passes with refusals for unsupported forms; every duplicated algorithm removed; the command line validator, the canvas and the tests import the same engine; message strings identical everywhere |
| M3 | Command line tool and workflow | Installable; `lint`, `validate`, `render`, `catalogue`, `init`; three output formats; exit codes; configuration and suppressions; published reusable workflow annotates a pull request end to end |
| M4 | Rule coverage and evidence | Every kind in a shipped design has a rule; coverage report published; ten external designs linted with a published findings record |
| M5 | Canvas hardening | Serialised saves with no lost commit; one save path with one gate; keyboard shortcuts respect text focus; undo updates drafts; new-design drafts survive reload; ref cascade on delete; loopback-only server with validation, body cap, safe paths, no crash on malformed input; browser-driven gesture suite |
| M6 | Public repository release | M0 to M5 complete; documentation set complete; governance and contribution documents live; first tagged release of the format, catalogue and tool |
| M7 | Platform service core | Data model, migrations, service interface, authorization matrix tested independently with a private fixture on every list; validation at storage; content-hash concurrency; byte preservation through storage |
| M8 | Identity | GitHub OAuth with PKCE, sessions, profile; sign-in test against a mocked provider; no token persisted by default |
| M9 | Seeding | Curated designs loaded as owner-less public read-only; broken twins addressable; catalogue bundle served static and versioned |
| M10 | Platform surfaces | Browse, search, filters, design page, profile, auth flow; end-to-end browser test for sign in, list, filter, open |
| M11 | Canvas on the platform | Same engine; render-count-constant drag test; the full editing suite passes against the platform build; save with conflict handling; version history |
| M12 | Visibility, clone, counters, export | Visibility toggle; clone increments once; non-owner write refused at the service; export counter ping; git export round trip identical |
| M13 | Operations and launch | Backups and restore test; monitoring and alerts; status page; rate limits; abuse report and takedown; data export and account deletion; privacy notice and terms published; load test meets section 19; security review of section 16 complete |

---

## 24. Definition of production-ready

The product is production-ready when all of the following are true and verified:

1. Every requirement in sections 6 to 22 has passing acceptance criteria.
2. Every milestone in section 23 is done.
3. The repository is public under its licence with no encumbered material in its history.
4. The command line tool is installable from a public registry, lints offline, and its workflow
   annotates pull requests.
5. The engine exists once and its parser is conformant on the corpus, refusing what it does not
   support.
6. The rule set covers every kind in a shipped design, and the external validation record is
   published.
7. The canvas passes its editing suite against both the local server and the platform.
8. The platform passes its contract, authorization and end-to-end suites; backups restore;
   monitoring alerts; the privacy and terms documents are published; sign-in uses GitHub OAuth
   with no password ever handled.
9. Performance budgets in section 19 hold on the release build.
10. A person who has never seen the project can, from the documentation alone, write a design,
    lint it in a pull request, open it on the canvas, publish it, and have someone else clone it.

---

## 25. Risks

| Risk | Guard |
|---|---|
| The parser silently alters legal input | Conformance corpus with refusal cases in the gate; refuse-never-guess rule (A7.5) |
| Duplicated algorithms drift | Single engine (Q1); a duplication is a defect by definition (Q10) |
| A policy enforced in one interface and not another | One authorization implementation; interfaces derive state from it; matrix tested at the service |
| Save latency read as data loss | Optimistic state, explicit save status, crash net, serialised saves |
| Private designs leak through listing or search | Visibility inside every query; private fixture on every list test |
| Byte preservation lost in storage | YAML stored as text; round trip through the service is a release blocker |
| Rules judged trivial by the community | External validation record published before launch; coverage report; governance for new rules |
| Catalogue breadth outpaces rule depth | Coverage report as a gate; defaults required on components |
| Copyright exposure | History purge verified; transcription-only sources; provenance record |
| Canvas performance regresses under a framework | Constant-render drag test written before the port |
| Abuse of anonymous endpoints | Rate limits, hashed addresses, deduplication, takedown path |

---

## 26. Out of scope

Named so nobody builds them by accident before the above is done:

- Real-time collaborative editing.
- Organisations, teams, and private catalogue components; the catalogue stays global and public.
- Comments, stars, follows.
- Paid tiers or quotas beyond rate limiting.
- Identity providers other than GitHub.
- Generating infrastructure code from a design.
- Cost estimation.
- Automatic architecture suggestions.

These are candidates for a later phase once the community is producing designs worth hosting.
