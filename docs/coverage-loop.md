# Provider coverage loop

Goal: every resource a designer can place in an architecture, for every provider, is a
component in `components/<provider>/` with verified defaults, an icon and a locale entry.
Providers are finished one at a time, in this order:

1. azure
2. aws
3. default (open source, self-hosted, SaaS)
4. gcp
5. cloudflare
6. oci

A provider is **finished** when its inventory has no row left in status `todo`.

## Inventory first

Each provider starts with `docs/inventory/<provider>.md`: the official product list,
one row per resource, grouped by family. Columns:

| resource | id | kind | status | source |

- `resource` is the official product name. Sub-resources that designers place
  separately get their own row (Storage Account Blob, Queue, Table, File are four rows).
- `id` is the component id, `<provider>-<product>` in kebab-case (`azure-queue-storage`,
  `aws-ecs`). Existing ids are kept.
- `kind` is an existing kind id, or `NEW:<id>` when no existing kind fits.
- `status` is `todo`, `done`, or `skip: <reason>`. Skip is only for things that cannot
  be a node in a design: billing, cost management, support plans, training, marketplace,
  migration assessment tools, portals and CLIs. Every skip carries its reason so the
  coverage claim is auditable.
- `source` is the official documentation URL the defaults were read from.

## Family iterations

One iteration finishes one family (Azure Storage, AWS Networking, ...):

1. Take every `todo` row of the family.
2. For each row read the official docs (overview, quotas and limits, pricing tiers page
   for default tier facts) and write `components/<provider>/<id>.yaml`. Defaults are
   what the product does when created with no options set (governance 3). Never a
   recommendation, never a guess; a fact the docs do not state is left absent.
3. Write the locale entry (name, one-line description).
4. If a row needs `NEW:<kind>`, write a kind proposal: category, comment, properties
   with types, defaults and required flags, and a 24x24 line glyph. Proposals are
   installed by the curator before the family is marked done. A new kind must be
   justified by at least one property a rule could read; otherwise the resource goes
   under an existing kind with component-level properties.
5. Icon: kind glyph plus the provider badge, generated from the same glyph set.
6. Validate the whole repository. Mark rows `done`.

## Policy changes for this pass

- **Managed hosting offerings are components.** `aws-rds`, `azure-database-for-postgresql`
  and `google-cloud-sql` exist beside `postgres` because they are the resource a designer
  picks and they carry their own defaults (backup retention, zone redundancy). The
  self-hosted product stays in `default`. The engine is a component property when the
  offering hosts several.
- **Kinds are no longer frozen at 41.** New kinds arrive through this loop, one proposal
  per family, recorded in `docs/catalogue-v1.md`.

## State

| provider | inventory | families done | families todo |
|---|---|---|---|
| azure | done (228 rows: 174 done, 54 skip) | all 16 families | none — provider finished |
| aws | done (393 rows: 285 done, 108 skip) | all 22 families | none — provider finished |
| default | done (747 rows: 658 done, 89 skip) | all 46 families | none — provider finished |
| gcp | done (359 rows: 227 done, 132 skip) | all 21 families | none — provider finished |
| cloudflare | done (154 rows: 98 done, 56 skip) | all 14 families | none — provider finished |
| oci | done (240 rows: 168 done, 72 skip) | all 21 families | none — provider finished |

## Result (2026-09-08)

| provider | rows | components | skipped |
|---|---|---|---|
| azure | 228 | 174 | 54 |
| aws | 393 | 285 | 108 |
| default | 747 | 658 | 89 |
| gcp | 359 | 227 | 132 |
| cloudflare | 154 | 98 | 56 |
| oci | 240 | 168 | 72 |

1610 components, 71 kinds (30 added by this pass), every component with a locale entry
and an icon, validator green. Every skipped row carries its reason in the inventory file,
so the coverage claim is auditable row by row.

Facts the official documentation does not state were left absent rather than guessed;
component header comments name the pages the defaults were read from. Products in
maintenance mode or with an announced end of support remain components until that date
passes, with the date in the header comment.
