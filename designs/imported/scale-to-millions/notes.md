# Scale from zero to millions of users: import notes

A web application scaled to millions of users (Alex Xu, chapter 1). Clients use DNS and a CDN,
and a load balancer spreads traffic over stateless web servers backed by caches, sharded
databases, NoSQL and a queue with workers, watched by logging and monitoring tools.

- Source: Figure 1-23 of chapter 1 ("Scale from zero to millions of users", pages 5–33) of
  *System Design Interview – An Insider's Guide* by Alex Xu. The book is copyrighted; nothing of
  it is in this repository. `source/scale-to-millions.md` is a citation plus a factual
  transcription of the boxes, boundaries and arrows, written for this import.
- Format: `book-figure`. Counts: 15 boxes, 3 boundaries, 11 arrows; the design has 15 nodes,
  3 groups, 11 edges. `check_fidelity.py` passes with one warning (the assumed mapping below).

## Which figure is the final design

The chapter builds one architecture in steps: single server (1-1), separate data tier (1-3),
load balancer (1-4), replication (1-5, 1-6), cache (1-7), CDN (1-11), stateless web tier (1-14),
two data centres (1-15, 1-16), message queue and tooling (1-19), sharding and NoSQL (1-23).

**Figure 1-23 is the chapter's final architecture** and the one imported. It is Figure 1-19 —
the same DNS / CDN / clients / load balancer / web servers / caches / message queue / workers /
Tools picture — with the `Databases` box sharded and the `NoSQL` store added on the right. It is
strictly more complete than 1-19, so 1-19 was not imported as a second design; no box of 1-19 is
missing from 1-23. Figures 1-15 and 1-16 (the two-data-centre setup) draw a second data centre
that Figure 1-23 leaves out on purpose: the chapter says only one data centre is shown "due to
the space constraint". That statement is carried into the design as
`requirements.availability.multiRegion`, not as an invented second `region` group.

## Mapping

| Source text | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| DNS | dns | dns-resolver | dns | close |
| Web browser | web-browser | web-browser | client | close |
| Mobile app | mobile-app | mobile-app | client | close |
| CDN | cdn | content-delivery-network | cdn | close |
| Load balancer | load-balancer | load-balancer-tier | load-balancer | close |
| Web servers | web-servers | container-service | app-server | close |
| Message Queue | message-queue | message-queue | queue | close |
| Databases | databases | relational-database (sharded: true) | sql-database | close |
| Caches | caches | cache-cluster | cache | close |
| Workers | workers | container-worker | worker | close |
| NoSQL | nosql | nosql-store | nosql-database | close |
| Logging | logging | observability-stack (signal: logs) | monitoring | close |
| Metrics | metrics | observability-stack (signal: metrics) | monitoring | close |
| Monitoring | monitoring | observability-stack | monitoring | close |
| Automation | automation | automation-pipeline | monitoring | **assumed** |

Groups: `User` -> `trust-zone` (Web browser, Mobile app); `DC1` -> `region` (Web servers,
Message Queue, Databases, Caches, Workers); `Tools` -> `system` (Logging, Metrics, Monitoring,
Automation). `NoSQL` is drawn outside `DC1` and is therefore in no group.

## Assumptions

- **Everything is a generic.** The book draws unbranded boxes and names no product anywhere in
  Figure 1-23, so every node is a `default`-provider generic. No vendor was inferred, including
  for the queue, the cache and the two stores.
- **`Databases` is one node, not three.** The box holds three cylinders labelled `Shard 1`,
  `Shard 2`, `Shard ...`. It is the same box that Figure 1-19 draws with three *unlabelled*
  cylinders as a single data-tier box, and it is drawn in the same style as `Caches` (three
  stacked `CACHE` tiles) and `Web servers` / `Workers` (a stack of server glyphs): a tier box
  whose contents show multiplicity. `Shard ...` is an ellipsis and could not be a node in any
  case. The sharding fact is kept as `props: { sharded: true }`, which is what the figure and
  its explanation state. The shard key (`user_id`) is stated by Figures 1-21 and 1-22, not by
  1-23, so it is not set.
- **Four arrows touch a boundary, not a box** (`User -> DNS`, `User -> CDN`,
  `Load balancer -> DC1`, `Tools -> DC1`). Edges join nodes, so each was re-pointed at the
  representative node named in `mapping.yaml`: the two `User` arrows leave `Web browser`, the
  load balancer arrow enters `Web servers`, and the tooling arrow runs `Monitoring -> Web
  servers`. Directions are exactly as drawn.
- **`Automation`** has no generic in the catalogue: every `ci-pipeline` component in the
  `default` provider is a named vendor (Jenkins, Argo CD, GitHub Actions...), and naming one
  would invent a product the figure does not show. It is mapped with the rest of the `Tools`
  box to `observability-stack`, `confidence: assumed`.
- **Protocols.** The figure labels only two arrows (`www.mysite.com`, `api.mysite.com`), which
  are kept as edge labels. Protocols otherwise come from the callee: `dns`, `https` to the CDN
  and the load balancer, `http` from the load balancer to the private web tier (the chapter says
  private IPs), `sql` to the relational tier, `amqp` in and out of the queue, and `tcp` to the
  cache and the NoSQL store because naming `redis`, `memcached` or a NoSQL wire protocol would
  imply a product the figure does not name.
- **Modes.** The two queue arrows are `async` with the `message-queue` default delivery
  (`at-least-once`); everything else is `sync`.
- **`requirements`.** Only `availability.multiRegion: true`, from the chapter's own statement
  that one data centre is drawn for space and that supporting multiple data centres is part of
  the design (pages 22–24 and the closing summary on page 32). The chapter states no SLA, no
  latency target and no traffic figures, so nothing else is set.

## Observations (not encoded, the figure does not show them)

- The queue has no dead-letter queue and no retry path drawn; the workers only consume.
- Nothing is drawn between `Caches` and `Databases`: the figure shows the web tier reading both,
  not a cache-aside path through the cache to the database.
- The CDN has no arrow to an origin; the chapter describes the CDN pulling from an origin
  (Figure 1-10) but Figure 1-23 does not draw it.
- The chapter's master/slave replication (Figures 1-5, 1-6) is not visible in Figure 1-23; the
  data tier is drawn as shards only.

## Gaps

Also listed in `mapping.yaml`; not written to `docs/schema-gaps.md`, which the parent session
owns.

- No group-level edges: four arrows in this one figure attach to a boundary rather than a box.
- No way to say "this tier is drawn as N instances" (three shards, three cache tiles, the server
  stacks); one node per tier is all the format offers.
- No generic automation / CI component in the `default` provider.
- No group kind for a client-side boundary such as `User`; `trust-zone` is the closest of the
  seven.

## Rules fired

`node .claude/tools/validate.mjs --design designs/imported/scale-to-millions/design.yaml`

| Rule | Severity | Subject |
|---|---|---|
| datastore-missing-backup | error | databases |
| datastore-single-region | error | databases |
| queue-missing-dlq | error | message-queue |
| cache-missing-eviction-policy | warning | caches |
| credentials-without-rotation | warning | design |

All five are the product working on the book's picture, not import errors: the figure declares
no backups, no dead-letter queue, no eviction policy and no credential rotation, and it draws
one data centre while the chapter promises multiple. Nothing was changed to silence them.

Components added: none. Kinds added: none.

## Consolidation pass, 2026-09-08

The parent session re-mapped this design after the import wave, when generic components were
added to the catalogue for boxes that name no product. Mappings that had to guess a vendor
(and any single-box dashed border that had been read as a boundary) were corrected; the
picture itself is unchanged. `mapping.yaml` holds the current component for every box.
