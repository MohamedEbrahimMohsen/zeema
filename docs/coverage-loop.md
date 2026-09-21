# The provider coverage pass

A coverage pass takes one provider, diffs its official service list against
`docs/inventory/<provider>.md`, and leaves every service in that list with a status: a
component, a `skip` with a reason, a mapping onto a component that already exists, or a `todo`
that says the work is recorded but not done. The inventory is the artefact. The components are
what falls out of it.

This page records the loop as it is actually run. `docs/governance.md` decides what may be
added; this page decides what to look at and in what order.

## 1. Find a machine-readable list

The pass is only as good as its index. A marketing product directory is the obvious source and
usually the wrong one: it is client-rendered, it lags launches, and it drops services that have
no landing page. Fetch it, and when it returns a footer and nothing else, fall back.

| provider | primary source | if it fails |
|---|---|---|
| aws | Service Authorization Reference TOC, `docs.aws.amazon.com/service-authorization/latest/reference/toc-contents.json` — 475 IAM namespaces, the most current list | the products directory API behind `aws.amazon.com/products/`, the regional services table `api.regional-table.region-services.aws.a2z.com/index.json`, and the year's launch round-ups for services younger than both |
| azure | the resource provider list under `azure-resource-manager/management/azure-services-resource-providers` | the products directory and the documentation index `learn.microsoft.com/azure/?product=all`; the architecture icon set as a cross-check |
| gcp | `cloud.google.com/docs/product-list` plus the seventeen documentation area pages | the Google API discovery service, and the official architecture icon archives (`core-products-icons.zip`) for names the docs index hides |
| oci | the OCI CLI command-group index, `docs.oracle.com/en-us/iaas/tools/oci-cli/latest/oci_cli_docs/index.html` — the only public list that names services carrying an API but no documentation entry | the documentation service index `Content/home.htm` and the service limits page |
| cloudflare | `developers.cloudflare.com/products/` | `docs/resources/` in `cloudflare/terraform-provider-cloudflare`, read through the GitHub git tree API |
| alibabacloud | the help centre `alibabacloud.com/help/en/` | the product directory is client-rendered and returns only its footer, so the Alicloud Terraform provider's `docs/resources/` listing stands in as the index |
| ibm | the docs catalogue `cloud.ibm.com/docs?tab=all-docs` | the IBM Cloud Terraform provider's created resources |
| digitalocean | `docs.digitalocean.com/products/` | the DigitalOcean Terraform provider's resource pages |
| outscale | the OUTSCALE user guide | the OUTSCALE Terraform provider's resource pages |
| openstack | the official project teams list at `governance.openstack.org/tc/reference/projects/index.html` | each team's docs under `docs.openstack.org/` |
| k8s | the Kubernetes API reference and the concepts documentation | — |
| default | the CNCF `landscape.yml` graduated, incubating and sandbox lists; the DB-Engines ranking; each product's own documentation | — |

Terraform provider repositories are the reliable substitute across the board: a provider's
`docs/resources/` directory is a list of things the vendor lets you create, which is close to
the list of things a designer places. Read it through the GitHub git tree API rather than
scraping the registry.

An icon set is a cross-check, never an index. Oracle publishes the archive but no icon names,
so it could not be used at all.

## 2. Decide what each row is

Four outcomes. Every row gets exactly one, and a `skip` always carries its reason in the status
cell so the next pass does not re-litigate it.

**Component.** A resource a designer would draw as a box: it has its own lifecycle, its own
identity in the provider's API, and behaviour a lint rule could read. A managed offering is its
own component, never a property of the self-hosted one — `aws-rds` is the resource someone
places, and it carries its own backup retention and encryption defaults.

**Skip.** Not a node. The recurring families:

- a capacity or configuration mode of a resource that already has a component (ElastiCache
  Serverless, EKS Auto Mode, a Gateway Load Balancer SKU);
- a container whose sub-resources are the nodes (an Azure storage account; the blob, queue,
  table and file services are placed);
- an attachment or policy on an existing resource (PodDisruptionBudget, a route table, a
  security posture, an IAM principal);
- tooling: CLIs, SDKs, IDE plug-ins, consoles, dashboards, marketplaces, billing, assessment
  and migration utilities, agents installed into a workload;
- retired and fully shut-down products;
- an announcement with no service documentation to take defaults from.

**Mapping.** The same resource under another name: a rename, an API version, a full product
name, an engine of a multi-engine offering. It gets a row pointing at the existing id with
`mapping:` in the source cell, and it is not counted again.

**Todo.** A real node, not reached in this pass. Recorded, not skipped. Maintenance mode is a
`todo` or a `done`, never a skip: a service stays in the catalogue until its end-of-support
date has passed, and the component header records the date.

Three rules that decide the close calls:

- **Never invent a default.** If the documentation does not state it, the key is absent from
  the component. A property a rule wants to catch as *missing* stays unset so the rule can
  catch it (`docs/governance.md` §4).
- **Ids are global.** `components/<provider>/` is a folder, not a namespace. `dragonfly` is
  taken by the cache, so the CNCF image-distribution project needs another id.
- **Generics carry no defaults.** A component that is the kind itself — `queue`, `cache` — is a
  kind-id component with no `defaults` block. There is nothing true of every queue to write
  down.

## 3. Work in batches

Ten to twenty components, then `pnpm validate`. Not two hundred, then validate: a schema
mistake made in the first file is made in all two hundred, and the failure list is unreadable.
Each batch is research, components, locale, icons, inventory rows, validate.

```bash
python .claude/tools/catalogue.py find <product words>     # is it already there?
python .claude/tools/catalogue.py providers <kind>         # who else sells this?
python .claude/tools/zeema_locale.py add <snippet.yaml>    # merge locale entries
node .claude/tools/icons.mjs                               # write missing icons
node .claude/tools/validate.mjs                            # must end "all checks passed"
```

Tool behaviour worth knowing before you trust the output:

- `zeema_locale.py add` refuses an id that already has an entry unless `--replace` is passed.
  It rewrites the whole file sorted, so a snippet that silently overwrote a hand-written
  description used to be invisible in the diff.
- `icons.mjs --force` regenerates only icons the generator itself wrote, detected by the
  `<!-- generated by icons.mjs -->` marker on the first line, and prints what it skipped. A
  hand-imported vendor mark is never overwritten. `--adopt-generated` is the one-off migration
  that stamps the marker onto files already byte-identical to the generator's output.
- `icons.mjs` exits non-zero on a kind with no glyph. Add the glyph to `kindglyphs-extra.mjs`
  rather than leaving the warning in the log.
- `pnpm gate` takes no arguments; `TURBO_FORCE=true pnpm test` is the forced form.

## 4. Inventory format

One file per provider under `docs/inventory/`. The header names the official source and the
status vocabulary. Families use the provider's own directory headings, so the next pass can
diff heading by heading.

```
| resource | id | kind | status | source |
|---|---|---|---|---|
| Amazon EC2 instance | aws-ec2 | virtual-machine | done | https://docs.aws.amazon.com/... |
| Amazon EKS Auto Mode | — | — | skip: compute mode of an EKS cluster, a property not a node | https://... |
```

`resource` is the vendor's own current product name. `id`, `kind` and `source` are `—` on a
skip. `status` is `done`, `todo`, or `skip: <reason>` — a reason someone can act on, not the
word "skip" twice.

Each pass appends a `## Coverage pass <ISO date>` section at the end of the file rather than
editing rows in place. It opens with a paragraph naming the sources read, which ones failed and
what stood in for them, and then tables: added rows, rows that are not nodes, and rows already
covered under another name. The sections accumulate; the history of what was looked at and when
is the point.

## 5. Recount before you finish

The `## Counts` line is recomputed from the status column, never incremented by hand. Count the
rows in the file, count `done`, count `todo`, count the rest as `skip`, and state mapping rows
separately because they point at rows already counted:

```
total 643, todo 0, done 298, skip 345. Plus 9 mapping rows under
"Already covered under another name", which point at rows already counted above.
```

`done` in the inventory and the file count in `components/<provider>/` must agree. When they do
not, one of them is wrong and the pass is not finished. Say in the line when a count was
recomputed and the previous one did not add up.

## 6. Kinds

A coverage pass may install a kind, and it is the one exception to the reference-design
requirement in `docs/governance.md` §2: the kind ships with its components, locale entries and
glyph, and the design requirement is settled when the first design uses it. Everything else in
§2 still holds — two real components, a rule that reads a property, no existing kind that
covers it.
