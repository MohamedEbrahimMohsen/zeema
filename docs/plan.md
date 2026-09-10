# Arkore: the whole system, and where it goes next

**Audience: coding agents.** This file is the single description of what Arkore is today and
what Phase 2 adds. It is written to be read cold, without the repository open, and without the
conversation that produced it. Nothing here is implied; if a rule matters it is stated, and if a
number matters it is given.

- **Part I — Phase 1** describes what exists and is committed. Every statement about Phase 1 is
  a fact verifiable on disk. Treat it as a specification of current behaviour: if the code and
  this file disagree, one of them is a bug, and which one is a judgement call to raise, not to
  make silently.
- **Part II — Phase 2** describes the multi-tenant platform that is planned and **not built**.
  Nothing in Part II exists. Every table, endpoint and file named there is a proposal.

Companion documents, all authoritative in their own scope:

| File | Scope |
|---|---|
| `docs/format.md` | The format specification. The final word on every field. |
| `docs/governance.md` | How the vocabulary is curated and changed. |
| `docs/usage.md` | How a team authors a design. |
| `docs/schema-gaps.md` | Running log of what the format could not express. |
| `editor/README.md` | The canvas, written for a person. |
| `.claude/tools/README.md` | Every maintenance script. |
| `plan.md` (repository root) | The build journal: sections 1–19, one per pass, in the order the work happened. Historical record, not a specification. |

Root `plan.md` is kept for history. **This file supersedes it as the description of the
system.**

---

# Part I — Phase 1: what exists

## 1. What Arkore is

Arkore describes software architecture as **typed, queryable data** instead of pictures. A
design is a YAML file naming components from a curated catalogue, the edges between them, the
boundaries around them, and the promises the system makes. Because it is data:

- a linter can find structural mistakes deterministically (36 rules ship today);
- a diff in a pull request is readable — a changed component id, not a moved rectangle;
- a renderer can draw it, and several do.

The repository is **specification-first**. There is no linter engine, no CLI and no build step.
What ships is: the format, the catalogue, the rules, the designs, and a browser editor that
reads and writes that format in place.

### The three-layer model

| Layer | Folder | Answers | Count |
|---|---|---|---|
| Kind | `kinds/` | What is a queue, abstractly? What properties does any queue have? | 71 |
| Component | `components/<provider>/` | What is Kafka, concretely? Which kind is it? What does it default? | 1,623 |
| Design | `designs/<tier>/<id>/` | Which components does this system use, wired how, promising what? | 21 (+7 broken twins) |

Rules (`rules/`, 36) sit beside the layers and read from all three.

**Inheritance is exactly one hop.** A component extends one kind. A kind never extends another
kind. Two kinds sharing properties is accepted duplication.

## 2. Repository map

```
arkore/
  README.md                    the argument, with a 10-line example
  package.json                 name/version only. NO dependencies, no node_modules
  plan.md                      build journal, sections 1-19
  .vscode/settings.json        yaml.schemas mapping, so the editor validates on type

  schema/                      4 JSON Schemas: kind, component, design, rule
  kinds/                       71 YAML files, one per kind
  components/
    aws/        285            provider = who owns the product, not who hosts it
    azure/      174
    cloudflare/  98
    default/    671            open source, in-house generic, or SaaS (Stripe, Datadog)
    gcp/        227
    oci/        168
  rules/                       36 YAML files, one per rule
  locales/en.yaml              5,210 lines. ALL display text lives here, keyed by id
  icons/
    kinds/       71            one stroke glyph per kind
    providers/                 provider marks
    components/<provider>/     per-component icons
                               1,912 SVG files total
  designs/
    reference/    7 folders    curated, each with a design.broken.yaml twin
    imported/    12 folders    faithful to a source document, each with mapping.yaml
    authored/     2 folders    made in the canvas
  docs/
    format.md governance.md usage.md schema-gaps.md
    architecture-as-data-mvp.md catalogue-v1.md coverage-loop.md research-loop.md
    kind-candidates.md sources.md intake-template.md
    intake/      44 cards + SUMMARY.md    one system studied per card
    inventory/    6 files                 per-provider product inventories
    plan.md                               this file
  editor/                      the canvas (see section 7)
  references/                  source material
  .claude/
    skills/      2             arkore-design-import, arkore-catalogue-add
    tools/                     maintenance scripts and the test suite
```

## 3. The format

### 3.1 Envelope

Every file in `kinds/`, `components/`, `rules/` and `designs/` opens with the same three fields:

```yaml
schemaVersion: "1"       # always quoted
type: "kind"             # kind | component | design | rule
id: "queue"              # ^[a-z][a-z0-9-]*$ , unique within its type
```

Conventions that apply everywhere, and are enforced by `validate.mjs`:

- **Quote every string value**, including enum values and `schemaVersion`. Unquoted `NO`, `yes`
  and `1.0` parse as booleans or numbers in YAML.
- Property names are **camelCase**. Ids and enum values are **kebab-case**.
- **No display text in any document except `locales/en.yaml`.** Names and descriptions are
  looked up by id.
- The first line of every file is a `yaml-language-server` comment pointing at its schema, so an
  editor validates it with no extra configuration.

### 3.2 Kind — `kinds/<id>.yaml`

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
| `category` | yes | One of `messaging`, `compute`, `data`, `edge`, `external`, `client`, `ops`, `security`. Rules may select by category. `external` = outside your control. |
| `properties` | yes | Map of property name to definition. May be empty. |

**Property definition:**

| Field | Required | Meaning |
|---|---|---|
| `type` | yes | `boolean`, `integer`, `string`, `enum`, `ref` |
| `values` | if `enum` | Allowed string values |
| `default` | no | Value assumed when neither component nor node sets one |
| `required` | no | If `true`, a node must resolve a value from `props`, component `defaults`, or this `default`. Default `false`. |
| `refKind` | if `ref` | The kind the referenced node must have; a `ref` value in a design is another node id |

A property with neither `default` nor `required` is optional and may be absent. Rules test
absence with `exists: false`.

**The 71 kinds:** ai-service, api-gateway, app-server, artifact-repository, backup-service,
bastion-host, bi-service, big-data-cluster, block-storage, bot-management, cache, cdn,
change-data-capture, ci-pipeline, client, contact-center, container-orchestrator,
container-registry, content-repository, coordination-service, data-catalog, data-warehouse,
database-proxy, ddos-protection, dns, edge-appliance, email-security-gateway, event-store,
feature-flag-service, file-storage, firewall, graph-database, id-generator, identity-provider,
iot-hub, key-management, ledger, load-balancer, matching-engine, media-router, media-transcoder,
ml-inference, ml-platform, monitoring, nat-gateway, network-fabric, nosql-database,
notification-service, object-store, policy-engine, private-link, pubsub-topic, queue,
rate-limiter, realtime-gateway, schema-registry, search-index, service-mesh, sql-database,
stream, stream-processor, third-party-api, timeseries-database, vector-database,
virtual-desktop, virtual-machine, vpn-gateway, waf, webhook-endpoint, worker, workflow-engine.

### 3.3 Component — `components/<provider>/<id>.yaml`

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

| Field | Required | Meaning |
|---|---|---|
| `kind` | yes | Id of exactly one kind |
| `provider` | yes | `aws`, `azure`, `gcp`, `oci`, `cloudflare` or `default`. Must match the folder. |
| `defaults` | no | Values for kind properties this implementation changes. Every key must exist on the kind. |
| `properties` | no | Properties specific to this implementation. Must not redefine a kind property. |

**Provider means ownership, not hosting.** `postgres` is `default` even when it runs on RDS;
`aurora` is `aws`.

**Property resolution order** — the effective value of a property on a node is the first found:

1. the node's `props`
2. the component's `defaults`
3. the property definition's `default` (on the kind, or on the component for component-specific
   properties)
4. absent

Setting a property that exists on neither the kind nor the component is an error.

### 3.4 Design — `designs/<tier>/<id>/design.yaml`

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

Required by schema: `schemaVersion`, `type`, `id`, `nodes`, `edges`. `nodes` has `minItems: 1`.
Node, edge and group objects are all `additionalProperties: false`.

**`requirements`** — promises the whole design makes; rules compare nodes against them. All
paths optional; an absent requirement never equals anything. 38 paths across 13 groups:

| Group | Paths |
|---|---|
| `availability` | `multiRegion` bool · `sla` string `^[0-9]{2}(\.[0-9]+)?$` · `zones` int · `regions` int · `discoveryRedundant` bool · `degradedModeAllowed` bool |
| `messaging` | `replay` bool · `exactlyOnce` bool · `orderingScope` `partition\|global` |
| `latency` | `p95Ms` int · `p99Us` int · `geoDistributed` bool |
| `durability` | `annualNines` int · `minReplicasAcked` int |
| `consistency` | `model` `ap\|cp` · `readAfterWrite` bool · `quorumScope` `region\|global` |
| `correctness` | `exactlyOnceEffect` · `reproducible` · `tamperEvident` · `billingGrade` (all bool) |
| `money` | `zeroSum` bool · `pci` bool |
| `data` | `reconciliation` · `lossDetection` · `ownershipExclusive` · `immutableAudit` (all bool) |
| `traffic` | `readWriteRatio` int · `skew` `uniform\|heavy-tail` · `peakMultiplier` int |
| `isolation` | `perQueue` bool · `perEventType` bool · `tenancy` `shared\|cell\|dedicated` |
| `freshness` | `maxSeconds` int |
| `security` | `certificateRotationAutomated` bool · `credentialRotationDays` int |
| `observability` | `alertingIndependent` bool |

New requirement paths go through governance. Each path above is backed by at least one intake
card in `docs/intake/`.

**`groups`** — nested boundaries. A node belongs to at most one group; a group may have one
`parent`. Kinds: `region`, `availability-zone`, `vpc`, `trust-zone`, `system`, `cell`,
`point-of-presence`. Fields: `id`, `kind`, optional `label`, optional `parent`. A node's
**ancestry** is its group, that group's parent, and so on — rules ask "how many `region` groups
are in this node's ancestry".

**`nodes`**

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique within the design |
| `component` | yes | Id of a component in `components/` |
| `label` | no | Display name from the source design, kept verbatim by importers. Read by renderers, **never by rules**. |
| `group` | no | Id of a group in this design |
| `props` | no | Property values; see resolution order |
| `nfr` | no | `rps` int, `latencyP95Ms` int, `consistency` `strong\|eventual` |

**`edges`** — directed. Required: `from`, `to`, `protocol` (free string), `mode`
(`sync\|async`). Optional: `delivery` (`at-most-once\|at-least-once\|exactly-once`), `label`,
`timeoutMs`, `retryPolicy` (`none\|fixed\|exponential\|exponential-jitter`), `idempotent` bool,
`circuitBreaker` bool, `fallback` (`none\|static\|cached\|degraded`), `batched` bool.

### 3.5 Rule — `rules/<id>.yaml`

```yaml
schemaVersion: "1"
type: "rule"
id: "queue-missing-dlq"
severity: "error"            # error | warning | info
select: { node: { kind: "queue" } }
when:
  all:
    - { prop: "deadLetterQueue", equals: false }
    - { hasEdge: { direction: "in", mode: "async" } }
message: "Queue '{{node.id}}' receives async traffic but has no dead-letter queue."
```

`select` takes exactly one of `node` (by `kind` and/or `category`), `edge` (by `mode` and/or
`delivery`), or `design: true`.

**The fixed predicate set** (schema-enforced; nothing else parses):

| Predicate | Shape |
|---|---|
| `all` / `any` | array of predicates |
| `not` | one predicate |
| `prop` | property name, combined with `equals`, `in`, or `exists` |
| `requirement` | dotted path, combined with `equals` / `in` / `exists` |
| `hasEdge` | `{direction: in\|out\|any, mode?, peerKind?, peerCategory?, count?}` |
| `inGroup` | `{kind: <group kind>, count?}` |
| `crossesGroup` | `{kind: <group kind>}` — edge selectors |
| `from` / `to` | a predicate applied to an edge's endpoint node |
| `syncChainDepth` | comparison |
| `nfr` | `{rps?\|latencyP95Ms?}` with a comparison |
| `hasNode` | `{kind?, category?}` — design selectors |
| `field` | edge field name, with `equals` / `in` / `exists` |
| `gt` / `lt` / `eq` | integer comparison |

**The 36 rules:** business-updates-without-index-propagation,
cache-as-primary-store-without-persistence, cache-missing-eviction-policy,
credentials-without-rotation, cross-cell-call, datastore-missing-backup,
datastore-single-region, derived-store-without-cdc-or-rebuild,
exactly-once-with-external-side-effects, external-call-inline-without-durable-path,
fanout-inline-in-request-path, materialised-cache-without-rebuild-path,
money-mutation-without-idempotency-key, money-store-without-double-entry-ledger,
multi-leader-store-without-conflict-policy, object-store-single-zone-with-durability-target,
pubsub-replay-required, push-fanout-without-celebrity-path, queue-missing-dlq,
read-heavy-path-without-cache, read-replica-as-sole-scaling, reconnect-stampede-without-guard,
retry-queue-without-dlq, retry-without-adaptive-shedding, retry-without-backoff,
shared-dependency-without-redundancy, shared-host-per-channel-without-isolation,
shared-worker-pool-across-queues, single-writer-primary-at-peak-qps,
stateful-engine-pinned-to-single-zone, stateful-hash-ring-without-ring-manager,
stateful-node-without-zone-redundancy, stateful-websocket-scale-in-without-drain,
sync-chain-too-deep, webhook-without-signature-or-idempotency,
windowed-aggregation-without-watermark.

### 3.6 Locale — `locales/en.yaml`

The only file with human text. Keyed by id, sorted, sections for `categories`, `kinds`,
`components`, `rules`. **Every id in `kinds/`, `components/` and `rules/` must have an entry**,
and every entry must have a file — `validate.mjs` checks both directions.

## 4. Designs

Three tiers. The tier decides who may write the file, and that is the single most important
invariant in the system.

| Tier | Count | Means | Writable from the editor |
|---|---|---|---|
| `reference/` | 7 | Curated by the repository; each has a `design.broken.yaml` twin whose header lists the rule ids it must trip | **No** |
| `imported/` | 12 | Faithful to a source document the user supplied; carries `mapping.yaml` proving the fidelity | **No** |
| `authored/` | 2 | Made in the canvas | **Yes** |

28 design YAML files on disk: 21 whole + 7 broken twins.

**Folder contents by tier:**

```
designs/reference/<id>/
  design.yaml           the clean design
  design.broken.yaml    deliberately broken; header comment lists the rule ids it must trip
  design.layout.json    optional; node positions and edge bows (see 7.9)
  diagram.svg           rendered by design_to_svg.py
  diagram.broken.svg
  diagram.md            Mermaid, by design_to_mermaid.py
  notes.md              decisions, assumptions, gaps, rules fired
  source/               original material where there is any

designs/imported/<id>/
  source/<file(s)>      untouched copy of what the user gave
  design.yaml
  mapping.yaml          source inventory and where every item went; machine-checked
  diagram.md
  diagram.svg
  notes.md

designs/authored/<id>/
  design.yaml
  design.layout.json
```

**Reference designs (7):** doordash-delivery, multi-region-web, object-storage,
order-processing, payment-system, slack-messaging, twitter-timeline.

**Imported designs (12):** chat-system, google-drive, key-value-store, news-feed,
notification-system, notification-system-design, rate-limiter, scale-to-millions,
search-autocomplete, url-shortener, web-crawler, youtube.

**Authored designs (2):** chat-system-fy71a1u1, flowsaga.

**The import contract** (`.claude/skills/arkore-design-import`): the output is the *same*
design the user gave — same boxes, same names, same arrows, same boundaries. Nothing added,
dropped, renamed or "improved". Only the *type* behind each box changes: "Storage Queue" becomes
a node whose component is `azure-queue-storage`, and the node keeps `label: "Storage Queue"`.
`check_fidelity.py` proves it: counts, every item mapped both ways, labels verbatim, nothing
unmapped.

## 5. Icons

1,912 SVG files, all inline-safe (every `d` attribute walked command by command by
`check_icon_paths.mjs`).

| Folder | Content | Provenance |
|---|---|---|
| `icons/kinds/` | 71 stroke glyphs, 24×24, one per kind | Original, MIT |
| `icons/providers/` | Provider and product marks | Simple Icons, CC0 1.0 |
| `icons/components/<provider>/` | Per-component icons | Kind glyph + provider badge, composed by `icons.mjs` |

`aws.svg`, `azure.svg` and `oci.svg` in `icons/providers/` are **original neutral glyphs**, not
vendor marks. `icons/README.md` is the provenance record — keep it accurate when adding icons.

Generation sources: `kindglyphs.mjs` and `kindglyphs-extra.mjs` (the glyph of every kind),
`providers.mjs` (provider key → Simple Icons slug, plus component→badge overrides),
`badges-extra.json` (component id → Simple Icons slug for `default` products with a brand mark).

## 6. The editor: what it is

`editor/` is a drag-and-drop canvas for Arkore designs, in the browser.

```bash
node editor/serve.mjs          # then open http://localhost:8000/editor/
```

**Vanilla ES modules. No framework, no dependencies, no build step, no `node_modules` under
`editor/`.** This is enforced by a test (F11): every `from "…"` in `editor/**` must be relative
or `node:`, and no external origin may appear outside a comment.

**The split that matters:**

- `editor/core/` is **DOM-free and node-importable**. It is the engine: parse, document
  operations, structure checks, rules, layout, geometry. Tests import it directly — no jsdom, no
  headless browser.
- `editor/ui/` is the browser layer. Three of its modules are also DOM-free by design and tested
  under node: `router.js`, `drafts.js`, and most of `export.js`.

Line counts (indicative, not a contract): `core/` ≈ 2,072; DOM-free `ui/` ≈ 219; DOM-bound `ui/`
≈ 1,947.

## 7. The editor: every module

### 7.1 `core/yaml.js` — span-preserving parse and serialise

The reason the editor can write the repository's own files. `parse(text)` returns `{doc, cst}`
where the CST records the source span of every section. `serialize(cst, doc)` copies spans
verbatim and splices only what changed.

**Guarantee: an unmodified file round-trips byte-identically** — comments, blank lines and
quoting included. An edited file differs only on the lines that changed. Proven on all 28
committed designs.

Exports: `parseScalar`, `emitScalar`, `parse`, `serialize`.

Three behaviours that are load-bearing and were each a bug once:

1. `emitSeq(key, list, entries)` returns `["<key>: []"]` for an empty list. A bare `edges:` is
   YAML for **null**, and a design whose edge list is null is one nothing downstream can read.
2. A key whose body is all blank parses to a section `{type: "empty", key, text}` with
   `doc[key] = null`, matching the `yaml` package's behaviour.
3. A `scalar` section whose value became a non-empty array of objects is re-emitted as a **block**
   sequence, so an `edges: []` that grows does not become one giant flow line. The seq branch
   skips keys absent from the doc, so ungrouping the last group removes `groups:` rather than
   leaving `groups: []`.

### 7.2 `core/document.js` — pure document operations

Every mutation the editor can make, as a pure function over the parsed doc. Includes every
cascade an id rename or a delete implies.

| Function | Does |
|---|---|
| `createDoc(id)` / `newDesignText(id)` | A new empty design, and its YAML text |
| `normalize(doc)` | `{doc, repaired[]}` — coerces `nodes`/`edges`/`groups` to lists; repairs a file that arrived with a null list |
| `toId(text)` | `"Azure Function EU"` → `"azure-function-eu"` |
| `uniqueId(taken, base)` | `toId` plus `-2`, `-3`, … |
| `cloneId(id, taken, random)` | `<base>-copy`, `-copy-2`, …, or `<base>-<8 chars>` |
| `randomSuffix(length = 8)` | Mixed letters and digits |
| `displayName(catalogue, node)` | `label` → locale name → component id → node id |
| `isGeneratedId(node)` | True while the id is `toId(component)` or that plus `-N` |
| `setNodeLabel(doc, id, label, catalogue)` | Sets the label; renames the id **only while it is still generated** |
| `propDefs` / `effective` / `requiredGaps` | Property definitions, resolved values, and unset required properties |
| `addNode` / `deleteNodes` / `duplicateNodes` | Node lifecycle; duplicate returns `{doc, map}` of old→new ids |
| `setNodeProp` / `setNodeField` / `setNfr` | Node writes |
| `renameNode` / `renameGroup` | With every reference updated |
| `addEdge` / `deleteEdge` / `reverseEdge` / `setEdgeField` | Edge lifecycle |
| `addGroup(doc, memberIds, kind, label)` | **Nests**: if all members share one existing group, the new group gets `parent` set to it |
| `groupMembers` / `deleteGroup` / `deleteGroupDeep` / `setGroupParent` / `setGroupField` / `setNodeGroup` | Group lifecycle. `deleteGroup` keeps members; `deleteGroupDeep` removes them too |
| `swapComponent(doc, nodeId, newComponent, catalogue)` | Change a node's component, dropping props the new one cannot hold |
| `setRequirement(doc, path, value)` | Dotted path into `requirements` |

### 7.3 `core/structure.js` — the validator's own checks

`check(doc, catalogue, options)` reproduces `validate.mjs`'s structural checks **message for
message**, plus a JSON Schema layer (`checkSchema`). Findings carry a `subject` so the UI can
point at what is wrong, and a `blocking` flag.

**Structural findings block a save.** The file would not be valid, so writing it would break CI.

### 7.4 `core/rules.js` — the 36 rules

Ported from the Python validator bug for bug. `runRules(doc, catalogue)` returns findings with
subjects. Also exports `kindOf`, `effective`, `syncPass`, `syncChainDepth`, `syncChainDepths`.

**Rule findings never block a save.** A real design can legitimately trip a rule; that is the
point of the rule, not a reason to refuse the file.

### 7.5 `core/layout.js` — the repository renderer's layout

`layout(doc, catalogue)` returns `{positions, sizes}` using layered ranks, barycentre ordering
and group members on one rank — ported number for number from `design_to_svg.py`, including
`pyRound` (Python's banker's rounding, which JavaScript's `Math.round` does not do). Tested for
equality with the Python renderer on all 324 node placements.

### 7.6 `core/geometry.js` — edges, bows, labels, frames

**This file contains a literal NUL byte** — `grep` reports it as binary. Edit it with the Edit
tool, or Python with `io.open(..., encoding='utf-8', newline='')`. A naive shell rewrite will
corrupt it.

| Export | Does |
|---|---|
| `OFFSET_STEP` (16), `BEND_REACH` (46) | Constants |
| `edgeKeys(doc)` | Stable key per edge: `from>to`, or `from>to#n` for parallel edges |
| `edgeGeometry(doc, boxes, bows)` | Points, path and `mid` for every edge |
| `midpointOf(points)` | For a 3-point quadratic Bézier the curve midpoint is `0.25·P0 + 0.5·P1 + 0.25·P2`, **not** the control point. Getting this wrong is what threw edge labels far from their edge. |
| `pathOf(points)` | SVG path data |
| `groupFrames(doc, boxes)` | Nested boundary rectangles |
| `innermostFrameAt(frames, x, y)` | Hit test for group membership on drop |
| `bowAt(boxes, from, to, x, y)` | Bow value from a dragged point |

### 7.7 `ui/scene.js` — the SVG scene and every gesture

`class Scene` owns the SVG, the viewport transform, and all pointer handling.

- **Selection is two things**: `this.selection` is the primary subject (drives the inspector),
  `this.multi` is a `Set` of node ids.
- **Hit testing is three-stage**, and the third stage is why it works with a real mouse:

  ```js
  targetOf(ev) {
    const direct = this.subjectOf(ev.target);
    if (direct.type) return direct;
    const painted = this.subjectOf(document.elementFromPoint(ev.clientX, ev.clientY));
    if (painted.type) return painted;
    const [wx, wy] = this.toWorld(ev.clientX, ev.clientY);
    return this.subjectAt(wx, wy);          // from the model: node, then nearest edge, then frame
  }
  ```

  **Pointer capture retargets the subsequent `click`/`dblclick` to the capture element.** That
  is why per-element `dblclick` listeners silently never fire with a real mouse while synthetic
  events dispatched at the element pass. One scene-level handler plus a model-level hit test is
  the fix. Do not reintroduce per-element click listeners on scene content.

- Gestures: marquee on empty left-drag; middle button or space to pan; wheel to zoom; drag a
  node's dot to wire, with the candidate target highlighted; drag an edge to bow it; drag a node
  to move it (a selection moves together, as one history entry); drop inside a frame to change
  group membership; right button opens a menu about whatever is under it; double-click any label
  to edit it in place.
- `frame-hit` gives group frames a 16px invisible stroke so a boundary is grabbable.
- `capture(ev)` swallows `setPointerCapture` errors (a synthetic pointer is not live).
- `repaintFrames()` keeps boundaries following their members during a drag.
- Export side: `cssVar(name)`, `resolveVars(text)`, `bounds(pad = 28)` via `getBBox`, and
  `toSVG({background})`.
- `installArrowhead(svg)` defines the marker.

### 7.8 `ui/app.js` — the wiring

State is one document plus one position map. There is no reactive graph:

```js
const state = {
  catalogue: null, search: null, icons: {}, index: [],
  path: null, layoutPath: null, editable: true,
  doc: null, cst: null, positions: {}, sizes: {}, bows: {},
  undo: [], redo: [], dirty: false, lastDragAt: 0,
};
```

**`commit` is the only way anything changes, and the snapshot is taken first:**

```js
function commit(next, opts = {}) {
  const snapshot = { doc: clone(state.doc), positions: clone(state.positions), bows: clone(state.bows) };
  const coalesce = opts.coalesce && Date.now() - state.lastDragAt < 400;
  if (!coalesce) state.undo.push(snapshot);
  ...
  if (opts.apply) opts.apply();     // AFTER the snapshot
  if (next) state.doc = next;
}
```

`opts.apply` exists because callers that mutate `state.positions` directly (drag, arrange) must
not do so before the snapshot. Undo restoring stale positions is exactly this bug.

Other responsibilities: `render()` wrapped in try/catch so one bad frame cannot freeze the
session; `derive()` computing structural and rule findings defensively; `notify(message)`;
`arrange()`; `movePosition(from, to)`; `renameToLabel(id, value)`; `menuFor(target)`;
`cloneHeader` / `cloneInto` / `cloneDesign`; `showInAddressBar(entry, push)`; and the read-only
derivation:

```js
state.editable = entry.tier === "authored" && entry.editable !== false;
```

Note the direction: **the page derives the policy from the tier and only then consults the
index**, so a stale server cannot hand back write access to a curated design.

### 7.9 Layout sidecar — `design.layout.json`

Positions are not part of the format and never go into the YAML. They live beside it:

```json
{ "version": 2, "nodes": { "<node id>": [x, y] }, "edges": { "<edge key>": bow } }
```

Edge key is `from>to`, or `from>to#n` for parallel edges. Three exist today (the design.yaml
files without one fall back to computed layout).

### 7.10 `ui/router.js` — the address bar, both ways

DOM-free. Pure functions over the design index.

| Address | Means |
|---|---|
| `/editor/` | The editor picks a design |
| `/editor/chat-system` | That id, wherever it lives — used when the id is unambiguous |
| `/editor/imported/chat-system` | That id in that tier, when two tiers share one |
| `/editor/reference/doordash-delivery/broken` | The deliberately broken variant |

`routeOf(entry, mount)`, `shortRouteOf(entry, index, mount)`, `matchRoute(pathname, index,
mount)`. `matchRoute` returns **`null` for "no opinion"** — an unknown id opens the editor, not
an error, because a design can be deleted and a stale link should still land somewhere useful.

### 7.11 `ui/drafts.js` — the crash net

Unsaved work is mirrored into the browser's store so a stray reload does not lose it. Three
rules, each of which was got wrong once:

1. **A draft is only kept for a design that can be saved.** Work on a reference design is not on
   its way to that file, so restoring it would show a curated design as something other than
   what is on disk — indistinguishable, from the user's seat, from having saved over it.
2. **A draft is only restored onto the same file it was taken from.** The base text is hashed at
   open; a file that changed underneath gets its stale draft dropped.
3. **A store that throws is not a reason to stop editing.** A private window, a blocked store or
   a full one all mean "no crash net", never "no editor".

The store is injected, so all of this runs under node with a plain object behind it. Key prefix
`arkore-canvas:`. Exports: `draftKey`, `memoryStore`, `browserStore`, `keepDraft`, `takeDraft`,
`dropDraft`, `sweepDrafts`. `sweepDrafts(store, index)` runs at boot and clears drafts for
designs that can no longer be saved or no longer exist.

### 7.12 `ui/export.js` — the drawing as a file

`FORMATS` (svg/png/jpg), `rasterise(svgText, {mime, scale = 2, background, quality})` via blob
URL → `Image` → canvas → `toBlob`, `save(name, data, mime)`, `withPalette(run)`, and
`exportScene(scene, id, format, {scale})`.

Two facts that are easy to break:

- **CSS custom properties do not resolve outside the declaring document.** An exported SVG full
  of `fill="var(--node)"` renders as nothing. `resolveVars` rewrites the whole string with real
  colours before it leaves the page.
- **The palette is the one the user chose with `Theme`; with no choice made it is light.** A
  diagram going into a document should not come out dark for having been exported in the
  evening. `withPalette` stamps light for the duration when there is no explicit choice.

The SVG is the source in all three formats, so a raster can never show something the vector does
not. SVG carries no background (it sits on whatever page you put it on); PNG and JPEG do.

### 7.13 The rest of `ui/`

| Module | Job |
|---|---|
| `palette.js` | `class Palette`. All 1,623 components, searchable. `provider:aws` and `kind:queue` narrow it. Drag a row onto the canvas to place a node. |
| `inspector.js` | `class Inspector`. Generated from the catalogue, **never hard coded**: kind properties, component properties, the six optional edge fields, group kind and parent, and the whole `requirements` tree generated from the JSON Schema. A control shows the value the design would resolve to in grey, and writes only when you set something. |
| `findings.js` | `class Findings`. Structural blocking findings and rule findings; click one to select and centre its subject. |
| `menu.js` | `showMenu(x, y, items)` / `closeMenu()`. Items are `{label, hint, run, disabled, danger}` or `"-"`. Position clamped to the window. |
| `files.js` | `loadIndex` (live `/api/designs`, falling back to the committed `designs.json`), `loadCatalogue`, `loadIcons`, `loadDesign`, `loadLayout`, `put`. `asset(name)` resolves the bundle from the module URL, so a deep address still finds it. |
| `style.css` | Three-state theming: bare `:root` for light, `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`, and `html[data-theme="dark"]`. |

### 7.14 `editor/index.html`

Absolute `/editor/ui/style.css` and `/editor/ui/app.js`. **Deliberately not a `<base>` tag** — a
base would retarget the `url(#ic-…)` fragment references the icons use and break every symbol.

Toolbar: design picker, `New`, `Save`, `Clone`, `auto` checkbox, save state, `Undo`, `Redo`,
`Fit`, `100%`, `Arrange`, `Theme`, `Export`, lint summary, `?`. Layout: `#palette` aside,
`#canvas-wrap` with the SVG scene (layers: frames, edges, nodes, overlay), `#right` aside with
inspector and findings, plus a hidden `#help` sheet with 18 gesture and key rows.

### 7.15 Behaviour the user can name

Feature by feature, as shipped:

- **Names.** A component is called what the catalogue calls it. Place Azure Functions twice and
  both boxes say Azure Functions, because there is one Azure Functions and these are two of it.
  Double-click to name one. While the id is still the one the editor generated, the id follows
  the name, so the file says `orders-worker` rather than `azure-functions-2`. **An id you typed
  yourself is never rewritten behind you.** The id field kebab-cases what you type and says so
  when the id is already taken.
- **Boundaries.** Select components and press `G`, or right-click → Group. Grouping things that
  already share a boundary **nests inside it** rather than beside it. `Delete` on a boundary
  removes the boundary and keeps its members; the menu also offers deleting both.
- **Edges.** Drag an edge to bow it away from whatever it collides with — that is how you
  separate two edges between the same pair. The label rides the curve, not the control point.
  Right-click an edge to straighten, reverse, or switch it between sync and async.
- **Arrange.** Places every component again in layers from the sources down, using the
  repository renderer's own layout. It replaces the positions of the whole design, which is why
  it is one `Ctrl Z` away — like everything else. (It was once called "Tidy", which named
  nothing.)
- **Save.** Byte-preserving. `auto` writes a moment after each change, **but only while the
  design is structurally valid**, so autosave can never write a file CI would reject.
- **New.** Starts a design in `designs/authored/<id>/`. It stays unsaved until it has at least
  one node, because a design with an empty node list is not valid.
- **Clone.** A reference or imported design can be edited on the canvas and not saved over.
  `Clone` writes what is on screen — unsaved edits and layout included — to
  `designs/authored/<id>/`, offering `<id>-copy`, then `-copy-2`, or an eight-character random
  suffix, or a name you type. The copy records where it came from in its header.
- **Read only.** Save is off, autosave is off and says why, the crash net keeps no draft, and the
  server refuses the write. Four independent layers, because this leaked three times.

### 7.16 Keys

`Ctrl N` new · `Ctrl S` save · `Ctrl Z` undo · `Ctrl Y` / `Ctrl Shift Z` redo · `Ctrl A` select
every component · `Ctrl D` duplicate · `Ctrl 0` fit · `Ctrl 1` actual size · `G` group ·
`Ctrl Shift G` ungroup · arrows nudge (`Shift` for ten) · `Enter` edit the selected label ·
`Delete` remove the selection · `Esc` deselect · `?` the whole list, in the page.

**Every one of them, and every pointer gesture, goes through `commit`.** `Ctrl Z` takes it back
and `Ctrl Y` puts it back. A new interaction that does not go through `commit` is a bug.

## 8. `editor/serve.mjs` — the dev server and the write channel

Static file server rooted at the repository, plus:

| Method / path | Behaviour |
|---|---|
| `GET /api/designs` | The **live** design index, read from the folders. The committed `designs.json` is a snapshot that would hide a design created since it was generated. |
| `PUT <path under designs/>` | Writes the file, subject to `writable(rel)` below |
| `GET /editor/<anything not a file>` | Serves `editor/index.html`, so `/editor/imported/chat-system` is an address, not a 404 |
| `GET *` | Static, `cache-control: no-cache` |
| Anything else | 405 |

`writable(rel)` refuses, in order, with these exact messages:

```
writes are only allowed under designs/
a design lives at designs/<tier>/<id>/<file>
unknown tier <tier>
<tier> designs are read only; clone one to edit it
only design.yaml and its layout sidecar may be written
a design id is kebab-case: lower case, digits, hyphens
```

Files: `/^(design\.yaml|design\.layout\.json)$/`. Index `editable: tier === "authored" && file
=== "design.yaml"`. The `authored/<id>/` folder is created on demand; **no other folder is ever
created**.

**`serve.mjs` is read once at startup.** A policy change requires restarting the process. This
has caused a false "the fix does not work" report before.

## 9. The generated bundle — `editor/data/`

Committed, and regenerated with `node .claude/tools/build_editor_data.mjs`.

| File | Size | Shape |
|---|---|---|
| `catalogue.json` | ~926 KB | `{kinds, components, rules, locale, schema}` — sorted; `schema` is `design.schema.json`, which is what generates the requirements inspector |
| `search.json` | ~307 KB | One row per component: `[id, name, kind, category, provider, "<id> <name> <description>".toLowerCase()]`. Index 5 is the search haystack. |
| `designs.json` | ~6 KB | `[{path, tier, id, editable, layout}]` |
| `icons.json` | ~1.3 MB | id → inner SVG. `kind:<id>` keys for kind glyphs. Loaded **after** the first frame and patched into the scene. |

The bundle must be regenerated and committed whenever `kinds/`, `components/`, `rules/`,
`locales/en.yaml`, `schema/design.schema.json`, `icons/` or the design folders change. A
freshness test (F8) fails otherwise.

## 10. Tooling — `.claude/tools/`

Node 20+ and Python 3 with PyYAML. `cd .claude/tools && npm install` once (for the tools only —
`editor/` still has no dependencies). Run everything from the repository root.

| Command | Purpose |
|---|---|
| `node .claude/tools/validate.mjs` | **The repository gate.** Schemas, kinds, components, locale both ways, icons, rules, reference designs (must trip exactly their header rules), imported designs. Ends `all checks passed` or lists problems and exits 1. |
| `node .claude/tools/validate.mjs --design <file>` | One design: schema, references, then the rules that fire with their messages. Exits 1 only on structural problems. |
| `node .claude/tools/editor_test.mjs` | **The canvas gate.** See section 11. |
| `node .claude/tools/build_editor_data.mjs` | Regenerate `editor/data/` |
| `python .claude/tools/catalogue.py find\|component\|kind\|kinds\|providers\|inventory` | Query the catalogue and the provider inventories |
| `python .claude/tools/install_kinds.py <proposal.yaml>` | Install kind proposals: `kinds/<id>.yaml`, locale entry, glyph, catalogue row |
| `python .claude/tools/arkore_locale.py add\|check\|prune` | Merge, verify or prune locale entries |
| `node .claude/tools/icons.mjs [--force]` | Write missing kind and component icons |
| `node .claude/tools/check_icon_paths.mjs` | Walk every `d` attribute command by command; fail on a path a browser refuses to draw |
| `python .claude/tools/design_to_svg.py <design.yaml>` | Standalone SVG render (the layout `core/layout.js` ports) |
| `python .claude/tools/design_to_mermaid.py <design.yaml>` | Mermaid flowchart: groups as subgraphs, sync solid, async dotted |
| `python .claude/tools/check_fidelity.py designs/imported/<name>` | Prove an imported design matches its `mapping.yaml` |
| `python .claude/tools/dump_layout.py` | Layout dump, used for the Python↔JS parity check |

Data files: `kindglyphs.mjs`, `kindglyphs-extra.mjs`, `providers.mjs`, `badges-extra.json`,
`iac-map.yaml` (Terraform azurerm/aws/google/oci/cloudflare, ARM/Bicep, CloudFormation resource
types → component ids; `null` = not a node, `"todo"` = a node with no component yet).

## 11. Tests — the two gates

Both must pass before any commit.

```bash
node .claude/tools/editor_test.mjs
node .claude/tools/validate.mjs
```

`editor_test.mjs` runs these suites plus its own checks, all under node, no browser:

| Suite | File | Proves |
|---|---|---|
| yaml | `test_yaml.mjs` | Parser conformance against a real YAML library; byte-identical round trips on all committed designs |
| layout | `test_layout.mjs` | Equality with the Python renderer on all 324 node placements |
| rules | `test_rules.mjs` | Rule parity with the validator, **including the message strings** |
| structure | `test_structure.mjs` | Structural parity on deliberately broken documents |
| bundle | `test_build_editor_data.mjs` | `editor/data/` is fresh; counts derived from disk; the `editable` rule |
| icon paths | `check_icon_paths.mjs` | Every icon path is drawable |
| edge geometry | `test_geometry.mjs` | Edge paths, bows, label midpoints |
| write channel | `test_editor_server.mjs` | Every refusal above, against a real server, and that **a refused write changes nothing on disk** |
| authoring | `test_authoring.mjs` | The full cycle: New → add nodes → seven saves |
| editing | `test_editing.mjs` | ~35 checks: labels on bowed edges, grouping and nesting, duplicate, reverse, naming and ids, cloning, the six drafts rules, the router both ways, export |

Plus, in `editor_test.mjs` itself: a sweep building a one-node design for **every one of the
1,623 components**; the full repository gate re-run after rewriting every design with the
editor's own serialiser; an edit round trip; and the performance budgets.

**Performance budgets (F10) — these are the numbers, do not weaken them:**

| Budget | Limit |
|---|---|
| Layout of a 200-node design | < 500 ms |
| `runRules` on chat-system | < 100 ms mean over 50 runs |
| Palette search | < 16 ms mean over 200 queries |

**Dependency budget (F11):** no non-relative, non-`node:` import anywhere in `editor/`; no
external origin outside a comment (localhost and `www.w3.org` excepted); no `editor/node_modules`.

## 12. Invariants — the things that must not regress

An agent changing this repository must preserve all of these. Each has a test; several were
learned by breaking them.

1. **Tier decides writability.** `reference/` and `imported/` are never written from an editing
   session. Four layers enforce it: the server refuses the PUT, the page derives `editable` from
   the tier rather than trusting the index, Save and autosave are disabled, and the crash net
   keeps no draft. Removing any one of them is a regression even while the other three hold.
2. **Byte-preserving save.** An unmodified file round-trips identically; an edited one differs
   only on changed lines.
3. **No empty-key lists.** A list that becomes empty is written `key: []`, never a bare `key:`.
4. **Structural findings block a save; rule findings never do.**
5. **`editor/` has no dependencies and no build step.** Enforced by F11.
6. **`editor/core/` stays DOM-free**, along with `ui/router.js` and `ui/drafts.js`.
7. **Every user action goes through `commit`**, and `commit` snapshots before any `apply`.
8. **Display text lives only in `locales/en.yaml`.**
9. **Imported designs stay faithful to their `mapping.yaml`.**
10. **The generated bundle is committed and fresh.**
11. **One component, one identity.** Two instances of Azure Functions are two of the same
    component, not `azure-functions` and `azure-functions-2`. Generated ids may follow a label;
    a hand-typed id is never rewritten.

## 13. Known gaps

Recorded so they are not rediscovered as bugs:

- The 36 rules and the 7 reference designs were written for the original kind set. **The ~30
  kinds added during the coverage loop have no rules and appear in no reference design.**
- `references/` holds source material that is tracked in git and is not the repository's to
  redistribute. Resolve before anything is published.
- `editor/README.md` says "26 committed designs"; there are 28 design YAML files today. The test
  derives its count from disk, so the prose is what is stale.
- Only 3 designs have a `design.layout.json`; the rest fall back to computed layout, so opening
  and saving one will create a sidecar.
- No CI workflow runs the two gates. They are run by hand.

---

# Part II — Phase 2: the community platform

**Nothing in this part exists.** Everything below is a proposal to be built.

## 14. What Phase 2 is

Arkore becomes a public site where anyone can read architectures and a signed-in user can
create, own, publish and share them.

Product requirements, as stated:

1. **Free and open to read.** Anyone, signed out, can browse the listed architectures and open
   them on the canvas.
2. **Creating requires an account, and the account is GitHub.** No passwords are ever handled.
3. **Every design a user creates belongs to that user**, under their username.
4. **A design is public or private, and the owner chooses.** A public design is world-readable
   and **only the owner may edit it** — to everyone else it behaves exactly like a reference
   design does today.
5. **A user can list, search and filter their own architectures.**
6. **A user has a profile.**
7. **The community sees, per architecture, the number of clones and exports.**

The browse/profile/listing surfaces follow the visual direction prototyped in
`D:\Personal\e3a\design\project\E3A.dc.html` (a Claude Design HTML prototype; `apps/api` and
`apps/web` there are empty, so it is a look to match, not code to reuse).

## 15. The architecture decision

**Keep the engine. Replace the shell. Add a real API.**

| Part | Phase 1 | Phase 2 | Why |
|---|---|---|---|
| `editor/core/` (~2,072 lines) | Vanilla, DOM-free | **Unchanged.** Extracted as a package, imported by both browser and server | A framework adds nothing to a pure function; the server needs the same validation the browser runs |
| `ui/router.js`, `ui/drafts.js`, `ui/export.js` | DOM-free | **Kept**, minor edits | Same reason |
| `ui/scene.js`, `ui/app.js` (~1,460 lines) | Vanilla DOM | **Rewritten** as one React component with an imperative interior | The shell around them becomes React; the canvas cannot be |
| Browse, search, profile, auth, settings | Do not exist | **New**, React | Four new surfaces with routing and forms is where hand-written vanilla stops paying |
| `editor/serve.mjs` | Static + PUT allowlist | **Replaced** by an authenticated API | No identity, no authorization, no concurrency control today |
| Filesystem storage | `designs/<tier>/<id>/` | **Postgres**, with git export retained | Many writers, per-user ownership, search |

Roughly 55% of the current editor survives untouched, 35% is rewritten, and the platform code is
new.

**The single hard rule of the rewrite:**

> **React renders the canvas once, on mount, and never during interaction.** Node positions live
> in refs and are written straight to the SVG. React state changes only at `commit` boundaries —
> drop, add, delete, undo. `setState` in `pointermove` is the defect this rule exists to prevent.

Pin it with a test that asserts the render count is constant across a simulated drag. This is the
same architecture Excalidraw, tldraw and React Flow use, and for the same reason.

## 16. Data model

Postgres. `id` columns are UUIDs unless stated.

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `github_id` | bigint unique not null | The stable numeric id, **not** the login — GitHub logins can be renamed |
| `username` | citext unique not null | Their GitHub login at signup; the URL segment. Renameable, with the old one reserved |
| `display_name` | text | |
| `avatar_url` | text | |
| `bio` | text | |
| `created_at` / `updated_at` | timestamptz | |

Never store a GitHub access token beyond the OAuth exchange unless a feature needs it. Nothing
in this plan does.

### `designs`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `owner_id` | uuid fk users | Null only for repository-curated designs (see `origin`) |
| `slug` | citext not null | Kebab-case, unique per owner: `unique (owner_id, slug)` |
| `title` | text not null | Display title; the YAML `id` stays kebab-case |
| `summary` | text | One line for the browse card |
| `visibility` | enum `public\|private` | Default `private` |
| `origin` | enum `authored\|imported\|reference` | `reference`/`imported` = repository-curated, owner-less, read-only to everyone |
| `source_design_id` | uuid fk designs | Set when this design was cloned from another |
| `current_version_id` | uuid fk design_versions | |
| `created_at` / `updated_at` / `published_at` | timestamptz | |
| `deleted_at` | timestamptz | Soft delete |

Indexes: `(owner_id, updated_at desc)`, `(visibility, updated_at desc)` for the public browse,
and a GIN index over the search vector (title, summary, tags, component ids).

### `design_versions`

Immutable. A save writes a new row and moves `designs.current_version_id`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `design_id` | uuid fk designs | |
| `yaml` | text not null | **The design YAML, verbatim.** Byte-preservation is retained by storing the text, not a parsed tree |
| `layout` | jsonb | The `design.layout.json` sidecar |
| `content_hash` | text not null | Hash of `yaml`; the concurrency token, and the same base-hash idea `drafts.js` already uses |
| `author_id` | uuid fk users | |
| `message` | text | Optional, like a commit message |
| `created_at` | timestamptz | |

Keeping the YAML as text is not incidental — it is what preserves the diff-in-a-pull-request
property that makes Arkore worth using, and what lets the same `core/yaml.js` parse it on both
sides.

### `design_stats`

Denormalised counters, one row per design: `design_id pk`, `clone_count`, `export_count`,
`view_count`, `updated_at`.

### `design_events`

Append-only, for the counters and for abuse investigation: `id`, `design_id`, `actor_id`
(nullable for anonymous), `kind` (enum `view|clone|export`), `format` (for exports),
`created_at`, `ip_hash`.

### `tags` / `design_tags`

Optional; needed for filtering by more than provider and kind.

## 17. API surface

Versioned under `/api/v1`. JSON. Session is an httpOnly, `SameSite=Lax`, Secure cookie.

| Method | Path | Auth | Does |
|---|---|---|---|
| `GET` | `/auth/github` | — | Start OAuth (authorization code + PKCE) |
| `GET` | `/auth/github/callback` | — | Exchange code, upsert user, set session |
| `POST` | `/auth/logout` | session | Clear session |
| `GET` | `/me` | session | Current user |
| `PATCH` | `/me` | session | `display_name`, `bio` |
| `GET` | `/designs` | optional | Browse. Filters: `q`, `provider`, `kind`, `owner`, `tag`, `sort`. Returns public designs, plus the caller's own private ones when `owner=me` |
| `POST` | `/designs` | session | Create. Body: `title`, `slug?`, `visibility?`, `yaml?` |
| `GET` | `/designs/:owner/:slug` | optional | Metadata + `current_version` |
| `GET` | `/designs/:owner/:slug/yaml` | optional | The YAML text |
| `GET` | `/designs/:owner/:slug/layout` | optional | The layout sidecar |
| `PUT` | `/designs/:owner/:slug/version` | **owner only** | New version. Requires `If-Match: <content_hash>`. Body: `yaml`, `layout`, `message?` |
| `PATCH` | `/designs/:owner/:slug` | **owner only** | `title`, `summary`, `visibility`, `tags` |
| `DELETE` | `/designs/:owner/:slug` | **owner only** | Soft delete |
| `POST` | `/designs/:owner/:slug/clone` | session | Clone into the caller's account. Body: `slug?`, `yaml?`, `layout?` — the client sends what is on screen, including unsaved edits, exactly as Clone does today. Increments `clone_count` |
| `POST` | `/designs/:owner/:slug/events` | optional | `{kind: "export", format}` — best-effort counter ping |
| `GET` | `/users/:username` | optional | Profile + public designs |
| `GET` | `/catalogue` | — | The static bundle. Unchanged, cacheable, CDN-able |

**Validation runs on the server too.** `POST`/`PUT` of YAML must parse with `core/yaml.js` and
pass `core/structure.js` before it is stored. The client's check is a convenience, not the gate.

## 18. Authorization

One matrix. Implement it once, in one middleware, and derive the UI from the same answer the API
gives — never the reverse.

| Actor | Public design | Private design | Curated (`origin != authored`) |
|---|---|---|---|
| Anonymous | Read, clone-preview, export | 404 (**not** 403 — do not leak existence) | Read, export |
| Signed in, not owner | Read, **clone**, export | 404 | Read, **clone**, export |
| Owner | Read, **write**, delete, change visibility | Same | n/a |

**A public design is read-only to everyone but its owner.** That is exactly the semantics the
canvas already implements for reference and imported designs, and the code for it exists:

```js
// Phase 1
state.editable = entry.tier === "authored" && entry.editable !== false;

// Phase 2 — same shape, different source
state.editable = design.origin === "authored" && design.owner_id === session.user_id;
```

Everything downstream of `state.editable` — the disabled Save, the disabled autosave with its
reason, the crash net that keeps no draft, the Clone path — works unchanged.

Rate-limit `POST /designs`, `/clone` and `/events` per user and per IP.

## 19. Migrating the repository designs

The 21 committed designs become the seed catalogue.

- `designs/reference/*` and `designs/imported/*` load as `origin = reference|imported`,
  `owner_id = null`, `visibility = public`. They are read-only to everyone, forever — the Phase 1
  invariant survives as a data property instead of a path check.
- `designs/authored/*` are the user's own; assign them to the first account.
- The broken twins stay addressable — `/reference/doordash-delivery/broken` in `router.js` maps
  to a version flagged `broken`, or to a sibling design. Decide before writing the seeder.
- **The git repository stays the source of truth for the catalogue** (kinds, components, rules,
  locale, icons). Only *designs* move to the database. The catalogue bundle stays a build
  artifact, served static and cached — which is what keeps Phase 2 cheap.

## 20. Performance: what changes and what must not

| Area | Phase 1 | Phase 2 | Delta |
|---|---|---|---|
| Drag frame time | Direct SVG writes in `pointermove` | Same code, inside a component that does not re-render | **None, if section 15's rule holds** |
| First paint | No build; native ES modules; no framework | React + router bundle | **Worse, ~100–300 ms** (estimate). Mitigate: code-split the canvas, statically render the browse pages |
| Save round trip | PUT to localhost, single-digit ms | Network + auth + DB | **Worse, ~30–150 ms** (estimate). Mitigate: optimistic UI, keep the autosave debounce, keep the crash net for the failure case |
| Design list | `readdirSync` over folders | Indexed, paginated query | **Better.** The current index does not survive ~1,000 designs |
| Search | Does not exist | Postgres full-text over title, summary, tags, component ids | **New** |
| Catalogue (1,623 components) | Static JSON | Unchanged, CDN-cached | **Better** |
| Export | Client-side canvas | Unchanged, plus a fire-and-forget counter ping | **None** |

Carry the Phase 1 budgets forward unchanged (layout < 500 ms at 200 nodes, rules < 100 ms,
palette search < 16 ms) and add:

| New budget | Limit |
|---|---|
| React render count during a 100-step drag | Constant (no growth) |
| `GET /designs` p95, 10k designs | < 200 ms |
| Time to interactive canvas on a warm cache | < 2 s |

## 21. Milestones

Each ends in something machine-checkable. Do them in order; each is shippable.

| # | Milestone | Done when |
|---|---|---|
| **P2.0** | Extract `editor/core/` as a package, imported by both sides. No behaviour change. | Both gates still pass; the package has no DOM reference |
| **P2.1** | API skeleton + Postgres + migrations + the design/version/user tables. No UI. | Integration tests cover the full authorization matrix in section 18, including anonymous-sees-404 for private |
| **P2.2** | GitHub OAuth, sessions, `/me`, profile record. | A test signs in against a mocked GitHub and gets a session; no token is persisted |
| **P2.3** | Seed the 21 repository designs; YAML read and write endpoints with `If-Match`. | Byte-preservation test passes **through the API**: read a seeded design, write it back unchanged, get an identical `content_hash` |
| **P2.4** | React shell: browse, search, filter, profile, auth. Canvas still the vanilla page, linked from it. | Playwright: sign in, list, filter, open |
| **P2.5** | Canvas as a React component. `core/` untouched; `scene.js` logic ported with the imperative interior intact. | Render-count-constant-during-drag test passes; the entire Phase 1 editing test suite passes against the new UI |
| **P2.6** | Visibility toggle, Clone against the API, counters. | Clone increments exactly once; a public design refuses a non-owner's write at the API, not only in the UI |
| **P2.7** | Git export: a user's design written back as a pull request or a downloadable folder. | Round trip: export → import → identical bytes |

## 22. Risks, ranked

1. **State leaks into the canvas during the React port.** Someone adds `useState` for selection
   and drag stutters at a few hundred nodes. *Guard:* the render-count test in P2.5, written
   before the port.
2. **The reconciler touches SVG mid-drag.** Node elements must be keyed and stable or React
   remounts them and pointer capture is lost. *Guard:* stable keys by node id; the drag test
   covers it.
3. **The authorization matrix drifts between UI and API.** *Guard:* the UI derives `editable`
   from the API's answer; the API is tested independently of the UI. Never the reverse.
4. **Save latency read as data loss.** *Guard:* optimistic UI with an explicit save state, plus
   the existing crash net. Not a spinner.
5. **Byte-preservation lost in the move to a database.** *Guard:* store YAML as text, and make
   P2.3's round-trip test a release blocker.
6. **Private designs leaking through the browse index or search.** *Guard:* visibility is a
   `WHERE` clause in one query builder, not a filter applied afterwards; tested with a
   private-design fixture on every list endpoint.

## 23. Explicitly out of scope for Phase 2

Named so nobody builds them by accident:

- Real-time collaborative editing. It needs a CRDT and would replace the snapshot undo stack.
  Phase 3 at the earliest.
- Organisations, teams and private *catalogue* components. Phase 2 makes **designs** private; the
  catalogue stays global and public, which is what keeps it a static, cacheable artifact.
- Comments, stars, follows.
- Paid tiers, quotas beyond rate limiting.
- The linter engine as a CLI or GitHub Action. Still unbuilt, still wanted, still a separate
  plan.
