---
name: arkore-catalogue-add
description: Add a product that is missing from the Arkore catalogue. Researches the product from official docs, picks an existing kind or installs a new one, writes the component in every provider where the product or an equivalent exists (azure, aws, gcp, oci, cloudflare, default), adds locale, icon and inventory row, and validates. Use when a design import meets an unknown box, or the user says add component, add resource, add kind, missing product, or names a cloud resource that is not in components/.
---

# Add a component (and its kind if needed) to the catalogue

Repository rules that bind this skill: `docs/governance.md` sections 2 to 4 (kind vs
component, provider is the owning vendor, defaults are real out-of-the-box behaviour, never
recommendations), `docs/format.md` sections 3 and 4 (shapes), `docs/coverage-loop.md`
(managed offerings are their own components; maintenance-mode products stay until end of
support; retired products and non-node tooling are `skip`).

Tooling: `.claude/tools/` (run from the repository root; `cd .claude/tools && npm install`
once if `node_modules/` is missing). Commands are listed in `.claude/tools/README.md`.
Do the work yourself, one product at a time. Do not spawn sub-agents for a single product.

## Steps

### 1. Confirm it is really missing

```bash
python .claude/tools/catalogue.py find <product words>
```
```bash
python .claude/tools/catalogue.py inventory <product words>
```

- A component hit: stop, return its id.
- An inventory row with `skip: <reason>`: read the reason. "Container resource, sub-resources
  are the nodes" means map to the sub-resource. "Retired" means it must not be added; report
  the retirement. "Tooling / portal / billing / library" means it is not a node; report that.
  Only override a skip when the product is demonstrably a placeable runtime resource and say so.
- A `todo` row or nothing: continue.

### 2. Research the product (official sources only)

Web-fetch, do not rely on memory for numbers:
- product overview page (what it is, which vendor owns it),
- "quotas and limits" / "service limits",
- default tier or SKU and default settings (replication, retention, backups, encryption,
  zones, TLS, delivery guarantee, ordering).
Two sources when a default is not obvious. Record page titles; they go into the component
header comment.

Owning vendor decides the provider folder: the vendor that sells the product, never where it
is hosted. Microsoft -> `azure`, Amazon -> `aws`, Google -> `gcp`, Oracle -> `oci`,
Cloudflare -> `cloudflare`, everyone else (open source, SaaS vendors, generic building blocks)
-> `default`.

### 3. Choose the kind

```bash
python .claude/tools/catalogue.py kinds
```
```bash
python .claude/tools/catalogue.py kind <candidate>
```

Test from governance: if a rule would need the same properties as an existing kind, it is that
kind. A product that is a managed offering of a self-hosted product uses the self-hosted
product's kind (`aws-rds` is `sql-database`). Only when no kind carries the properties a
rule would test do you propose one. Proposal file (scratchpad), shape:

```yaml
<kind-id>:
  category: compute|data|messaging|edge|external|client|ops|security
  name: "Display name"
  description: "One line."
  comment: "Two lines max for the kind file header."
  glyph: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="..."/>'
  properties:
    <camelCase>: { type: enum, values: [a, b], default: a }
    <camelCase>: { type: boolean, default: false }
```

Glyph: 24x24 grid, stroke only, 2 to 5 primitives, no fill/stroke attributes, distinct from
`icons/kinds/*.svg`, corner x>13,y>13 kept light for the badge. Properties: 3 to 8, each one
something a lint rule could test (redundancy, encryption, scaling mode, exposure). `managed`
is added automatically. Install:

```bash
python .claude/tools/install_kinds.py <proposal.yaml>
```

This writes `kinds/<id>.yaml`, the locale entry, the glyph and the row in
`docs/catalogue-v1.md`. If an existing kind fits but lacks one enum value the product needs,
widen the enum in `kinds/<kind>.yaml` (additive change, governance section 6) and say so in
the report.

### 4. Cover every provider where the product exists

```bash
python .claude/tools/catalogue.py providers <kind>
```

For each of azure, aws, gcp, oci, cloudflare, default: does this vendor sell an equivalent of
the product (same kind, same role)? Search the vendor's product directory. Three outcomes per
provider:
- equivalent exists and is already a component: nothing to do, list it;
- equivalent exists and is missing: add it too (steps 2 and 5 for that product);
- no equivalent: write "no equivalent" in the report. Never invent a product to fill a cell.

Some products exist in one provider only (Azure Front Door has no OCI twin; a Cloudflare
feature may exist only there). That is a correct outcome.

### 5. Write each component

`components/<provider>/<id>.yaml`:

- line 1: `# yaml-language-server: $schema=../../schema/component.schema.json`
- 1 to 3 `#` lines: what it is and which facts drive the defaults, citing the page titles.
- `schemaVersion: "1"`, `type: "component"`, `id`, `kind`, `provider`.
- `defaults:` keys that exist on the kind, values = out-of-the-box behaviour
  (`managed: true` for cloud services). If the docs do not state it, omit it.
- `properties:` 1 to 6 component-specific properties a rule or renderer could read: tier/SKU
  enum with real values and the real default, redundancy options, toggles that change
  durability, availability or security. Do not redefine kind properties. Types: boolean,
  integer, string, enum (with `values` and `default`).
- Quote every string. camelCase property names, kebab-case ids and enum values.
- Id: follow the neighbours in the provider folder (`azure-<product>`, `aws-<product>` or the
  bare product name where the folder already uses it, `google-<product>`, `oci-<product>`,
  `cloudflare-<product>`; `default` uses the product name). One file per product; a managed
  offering that hosts several engines gets one component with an `engine` enum.

### 6. Locale, icon, inventory

1. Locale snippet (scratchpad), one line per id, then merge:
   `<id>: { name: "<official product name>", description: "<one line>" }`
   ```bash
   python .claude/tools/arkore_locale.py add <snippet.yaml>
   ```
2. Icon. Cloud providers get their provider badge automatically. A `default` product with a
   brand mark: add `"<id>": "<simple-icons slug>"` to `.claude/tools/badges-extra.json` if
   `.claude/tools/node_modules/simple-icons/icons/<slug>.svg` exists; otherwise it stays a bare
   kind glyph. Then:
   ```bash
   node .claude/tools/icons.mjs
   ```
3. Inventory: append a row `| <resource> | <id> | <kind> | done | <doc URL> |` under the right
   family in `docs/inventory/<provider>.md` (add the family heading if none fits) and update the
   `## Counts` line (`total N, todo N, done N, skip N.`). A provider with no equivalent gets
   no row.

### 7. Validate and report

```bash
node .claude/tools/validate.mjs
```

Must end with `all checks passed`. Report as a table: provider, id, kind, new or existing or
no equivalent, source URL; plus kinds installed and enums widened. Nothing else.

## Never

- Never guess a default. Absent in the docs means absent in the file.
- Never write a recommendation as a default.
- Never add two components for the same product under one provider.
- Never add a retired product; a product in maintenance mode gets a header comment with its
  end-of-support date.
- Never edit `schema/` from this skill; a new provider folder is a schema change for the user
  to decide.
