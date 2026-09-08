---
name: arkore-design-import
description: Convert an architecture design (image, draw.io, Mermaid, PlantUML, Excalidraw, Markdown, Terraform, Bicep, ARM, CloudFormation, Pulumi) into an identical Arkore design YAML stored under references/designs/<name>/ with the source, a mapping table, a diagram and notes; adds missing components to the catalogue through the arkore-catalogue-add skill. Use when the user drops a design or diagram into docs/ (or anywhere) and asks to convert, import, encode, map or "arkore-ify" it, or says "new design".
---

# Import a design into Arkore

## The contract

The output is the **same design** the user gave, expressed in Arkore components. Same boxes,
same names, same arrows, same boundaries. Nothing added, nothing dropped, nothing renamed,
nothing "improved". A user who gets back a different design than the one they entered
leaves. Fidelity is checked mechanically by `check_fidelity.py` and visually by you.

What changes is only the *type* behind each box: "Storage Queue" becomes a node whose
component is `azure-queue-storage`; the node keeps `label: "Storage Queue"`.

## Where things go

```
references/designs/<name>/
  source/<original file(s)>     untouched copy of what the user gave
  <name>.yaml                   the Arkore design (id == <name> == folder name)
  mapping.yaml                  source inventory and where every item went (machine checked)
  diagram.md                    Mermaid rendering of <name>.yaml, for side-by-side review
  notes.md                      decisions, assumptions, gaps, rules fired
```

`<name>` is the kebab-case of the source file name (`Order Flow v3.drawio` -> `order-flow-v3`)
unless the user names the design. One folder per design; several designs in one request
are imported one after another, each finished before the next starts.

Tooling lives in `.claude/tools/` (run from the repository root; `cd .claude/tools && npm install`
once if `node_modules/` is missing). Read `.claude/tools/README.md` for the command list.

## Steps

### 1. Intake

1. Locate the source. Create the folder, copy the original into `source/` (never edit it).
2. Read the source completely:
   - **Image / PDF**: Read it with the Read tool (vision). Zoom into dense regions by cropping
     if labels are small. Read it twice: once for boxes, once for arrows.
   - **draw.io**: nodes are `<mxCell vertex="1" value="...">`, edges `<mxCell edge="1" source=.. target=..>`,
     containers are vertices whose children have them as `parent`. Strip HTML from `value`.
   - **Mermaid / PlantUML / Structurizr DSL**: nodes, edges and subgraphs/packages are explicit.
   - **Excalidraw**: `elements[]` with `type: text` bound to shapes, `type: arrow` with `startBinding`/`endBinding`.
   - **Markdown / prose**: every named component in the text is a box; every "calls", "publishes
     to", "reads from" is an arrow.
   - **Terraform / Bicep / ARM / CloudFormation / Pulumi**: every resource block is a candidate
     box. Map the resource type with `.claude/tools/iac-map.yaml` (`null` = not a node, list it
     under `ignored`; `"todo"` = node with no component yet, go to step 3). Pulumi tokens
     normalise to the Terraform name (`aws:s3/bucket:Bucket` -> `aws_s3_bucket`). Edges come from
     references between resources (connection strings, ARNs, `depends_on`); note in `notes.md`
     that arrows were derived from references, not drawn.

### 2. Inventory the source before mapping anything

Write `mapping.yaml` with the source inventory **first**, while looking only at the source:

```yaml
source:
  file: "source/<original>"
  format: "image"          # image | pdf | drawio | mermaid | plantuml | excalidraw | markdown | terraform | bicep | arm | cloudformation | pulumi | other
  counts: { nodes: 0, edges: 0, groups: 0 }   # what the source shows; count twice
nodes:   [ { source: "text exactly as drawn" } ]      # one per box that is a system element
groups:  [ { source: "boundary text as drawn" } ]     # one per container / boundary / swimlane
edges:   [ { source: "A -> B (label if any)" } ]      # one per arrow; a double-headed arrow is two
ignored: [ { source: "Legend", reason: "not a system element" } ]   # titles, legends, notes, actors' captions
unmapped: []
gaps: []
```

Rules for counting:
- A box is a node when it is a runtime element: a service, store, queue, gateway, client,
  device, external system, a person or actor (clients are kinds too: `web-client`,
  `mobile-app`, `browser`...). Titles, legends, step numbers and free notes go to `ignored`.
- A boundary (region, VNet, subscription, cluster, trust zone, swimlane) is a group. A box
  that only contains other boxes is a group, not a node.
- Every arrow is one edge in the direction drawn. Undirected lines: direction of the call
  (caller -> callee); say so in `note`. Double-headed: two edges.
- `counts` are what you counted in the source, not what you produced. Do not adjust them later
  to make the check pass; fix the design instead.

### 3. Resolve every box to a component

For each node, in this order, and record `node`, `component`, `confidence`, `note`:

1. `python .claude/tools/catalogue.py find <words from the box>`; then
   `python .claude/tools/catalogue.py component <id>` to confirm kind and properties.
2. Decide:
   - The box names a product (`SQS`, `Storage Queue`, `Front Door`, `Kafka`, `Redis`): use that
     component. A cloud product is always the provider's component, never the self-hosted one
     (`azure-database-for-postgresql`, not `postgres`). `confidence: exact`.
   - The box is generic (`Web app`, `Worker`, `DB`, `Cache`, `Queue`): pick the generic component
     of the right kind from the `default` provider (`container-service`, `container-worker`,
     `vm-service`, the engine-less database, `memcached`/`redis` only if named). If the source
     shows a provider context (an Azure region, AWS icons) prefer that provider's product for
     that role and say why in `note`. `confidence: close`.
   - Ambiguous (`Database` in a design with no other hints): choose the most common product for
     that role, `confidence: assumed`, and explain in `note`. Assumed nodes are listed in the
     final report; never hide one.
   - The inventory shows the product as `skip: <reason>`: read the reason. A box the user drew
     is evidence it is placeable; if the skip reason is "not a node", it usually means the
     sub-resource is the node (Storage Account -> its blob/queue/table/file service). Map to the
     sub-resource and note it. If the reason is "retired", keep the box: map to the closest
     living component, `confidence: assumed`, note the retirement.
   - Nothing found at all: invoke the `arkore-catalogue-add` skill for that product (it
     researches it, adds the kind if needed, and adds the component in every provider where an
     equivalent exists). Then map to the new id. Continue with the other boxes while it runs
     only if it was launched as a background agent; otherwise finish it first.
3. Node ids are kebab-case of the label, unique within the design (`orders-db`, `orders-db-2`).
   Group ids likewise.

Boundaries to group kinds: region -> `region`; AZ / zone -> `availability-zone`; VNet / VPC /
VCN / subnet -> `vpc`; DMZ / public / private / on-prem / partner -> `trust-zone`; subscription /
account / project / resource group / cluster / namespace / bounded context -> `system`; cell /
shard / tenant slice -> `cell`; edge / PoP / CDN edge -> `point-of-presence`. Anything else:
closest kind plus an entry in `gaps`.

### 4. Write `<name>.yaml`

- First line `# yaml-language-server: $schema=../../../schema/design.schema.json`, then a
  header comment: source file, import date, one line per assumption.
- `id: "<name>"`. Every node and group carries `label` with the source text verbatim.
- `props` only for facts the source states (partitions, SKU, replicas, TTL, region count).
  Never invent a property value; the component defaults already say what the product does.
- `edges`: `protocol` from the arrow label or the callee's native protocol (`https`, `grpc`,
  `amqp`, `kafka`, `sql`, `redis`...). `mode: async` when the arrow enters or leaves a queue,
  topic, stream, event bus or is labelled event/publish/subscribe; otherwise `sync`. `delivery`
  on async edges from the messaging component's default. Arrow text goes to `label`.
- `requirements` only when the source states them (an SLA figure, "multi-region", a latency
  target). A design with no stated requirements has no `requirements` block.
- Quoted strings, kebab-case ids, camelCase props. See `docs/format.md` section 5.

### 5. Verify, then look

Run from the repository root, all three must pass:

```bash
node .claude/tools/validate.mjs --design references/designs/<name>/<name>.yaml
```
```bash
python .claude/tools/check_fidelity.py references/designs/<name>
```
```bash
python .claude/tools/design_to_mermaid.py references/designs/<name>/<name>.yaml -o references/designs/<name>/diagram.md
```

Then do the visual pass: open the source again and walk it box by box against
`diagram.md` (and against `mapping.yaml`). Every box has a node with the same text; every
arrow has an edge with the same direction; every boundary has a group with the same members.
Fix the design, not the counts. When the user is present, show `diagram.md` (SendUserFile) or
an Artifact rendering the Mermaid next to the source image so they can confirm.

`validate.mjs --design` also prints the rules that fire. Findings are the product working,
not import errors; keep them for the report and do not change the design to silence them.

### 6. Record

- `notes.md`: source and format, the mapping table (source text -> node -> component ->
  confidence), assumptions, components or kinds added by `arkore-catalogue-add`, gaps, and the
  rules fired.
- Each `gaps` entry also goes to `docs/schema-gaps.md` in its entry format (Design, Missing,
  Workaround, Proposed change, Status open).
- Add the design to the index table in `references/designs/README.md`.
- Run `node .claude/tools/validate.mjs` (whole repository) once at the end; it also lists
  imported designs and must end with `all checks passed`.

### 7. Report

Counts (source / design), the mapping table, assumed mappings with their reason, components and
kinds added, gaps, and the rules that fired. If the user wants the design to become a rule
fixture in `designs/` (clean plus `.broken.yaml`), that is a separate task; say so, do not do it
unasked.

## Never

- Never drop a box because no component fits: add the component.
- Never merge two boxes into one node or split one box into two nodes.
- Never rename a label; ids are derived, labels are verbatim.
- Never add a node the source does not show, even an obviously missing one. Put it in
  `notes.md` under "observations" if worth saying.
- Never edit `kinds/`, `schema/` or other providers' components from this skill; catalogue
  changes go through `arkore-catalogue-add`.
