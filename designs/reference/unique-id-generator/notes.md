# unique-id-generator: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/unique-id-generator.md` (intake card of 2026-09-07, re-verified 2026-09-14)
- Size: 6 nodes, 6 edges, 3 groups (broken twin: 7 nodes, 6 edges, 4 groups).

## Size, and why it is below the usual range

The reference tier normally asks for 10 to 25 nodes. This intake card describes seven boxes, and
three of them are the alternatives chapter 7 evaluates and then *rejects* (multi-master
auto-increment, UUID, the ticket server), so they are not runtime elements of the chosen system. A
fourth, the clock source, is classified by the card itself as a property of the generator rather
than a box, and no component or kind exists for an NTP service. What the sources actually state as
running is: client services, one Snowflake generator per datacenter, the worker-id assignment
service, and the store whose rows are keyed by the ids. The design encodes exactly that and nothing
more: six nodes rather than an invented ten. The three rejected designs are where they belong, in
the broken twin.

## Clean variant (header of design.yaml)

Reference architecture: the distributed unique-id layer of Xu volume 1 chapter 7, built the way
Twitter Snowflake was: each datacenter runs its own generator that packs a 41-bit millisecond
timestamp, a configured 10-bit machine id and a 12-bit sequence into 64 bits, with no coordination
on the hot path and a refusal to issue ids while the clock runs backwards.

Fixes relative to unique-id-generator.broken.yaml:
  - no central ticket server and no relational auto-increment row on the id path; every datacenter
    generates locally with snowflake-id, so the single point of failure the book warns about is gone
  - both generators are snowflake-id with clockRollbackGuard true and timeSortable true; the
    UUID fallback that produced 128-bit unordered ids in the second datacenter is removed
  - worker-id-registry is a replicated ensemble spanning the internal zone rather than one
    ZooKeeper instance pinned to a single availability zone
  - the id path has no datastore behind it at all, so nothing on it needs backups or read replicas
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture, broken variant: the same id layer built the two ways chapter 7 rejects.
Datacenter A hands out ids from a central Flickr-style ticket server backed by one unsharded
MySQL auto-increment row, datacenter B gives up and falls back to random 128-bit UUIDs, and the
worker-id registry that both datacenters depend on is a single ZooKeeper pinned to one zone.

This file MUST trip:
  - single-writer-primary-at-peak-qps        (ticket-db is one unsharded writer at 10000 rps)
  - read-replica-as-sole-scaling             (ticket-db leans on async replicas and nothing else)
  - datastore-missing-backup                 (ticket-db has no backup and no retention)
  - shared-dependency-without-redundancy     (worker-id-registry is a single unreplicated instance)
  - stateful-engine-pinned-to-single-zone    (worker-id-registry lives in dc-a-az1 alone)
and MUST NOT trip:
  - credentials-without-rotation             (the design still declares a rotation period)
  - datastore-single-region                  (the design makes no multi-region promise)
  - read-heavy-path-without-cache            (no read/write ratio is declared; id issuing is a write path)
  - stateful-node-without-zone-redundancy    (both client tiers are stateless and sit in region groups)
  - stateful-hash-ring-without-ring-manager  (neither client tier shards by consistent hash)
  - sync-chain-too-deep                      (no api-gateway node starts the chain)
  - cache-missing-eviction-policy, queue-missing-dlq, derived-store-without-cdc-or-rebuild,
    fanout-inline-in-request-path, materialised-cache-without-rebuild-path (no cache, queue,
    search index or worker exists in this design)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Client services calling the generator per created entity (card row 7; the book's "web servers") | `app-tier-a` | `container-service` | app-server | close |
| The same, in the second datacenter | `app-tier-b` | `container-service` | app-server | close |
| Snowflake generator, 1-41-10-12 layout, Scala Thrift server (card row 1) | `id-generator-a` | `snowflake-id` | id-generator | exact |
| The same generator running in the second datacenter (5 datacenter bits, "machines across data centers") | `id-generator-b` | `snowflake-id` | id-generator | exact |
| Worker-id assignment: unique machine/datacenter ids at startup, "config or Zookeeper" (card row 2) | `worker-id-registry` | `zookeeper` | coordination-service | assumed |
| Cassandra, the store with no auto-increment that forced Snowflake into existence (Snowflake README) | `entity-store` | `cassandra` | nosql-database | close |
| Ticket server: central AUTO_INCREMENT, single point of failure (card row 6, rejected) | `ticket-server` (broken twin only) | `ticket-server` | id-generator | exact |
| Multi-master auto-increment on MySQL (card row 4, rejected) | `ticket-db` (broken twin only) | `mysql` | sql-database | close |
| UUID v4: 128-bit, non-numeric, unordered (card row 5, rejected) | `uuid-fallback` (broken twin only) | `uuid-generator` | id-generator | exact |
| Clock source, NTP-synchronised, rollback detection (card row 3) | not a node | - | - | encoded as `clockRollbackGuard: true` |

Tally for `design.yaml`: 2 exact, 3 close, 1 assumed. Across both variants: 4 exact, 4 close, 1 assumed.

## Catalogue gaps

| Product | Kind it would need | Used instead |
|---|---|---|
| NTP time service | `third-party-api`, but no generic external-API component exists under `default` (all are named vendors); a `time-source` kind would be the honest home | not encoded as a node; clock synchronisation survives as `id-generator.clockRollbackGuard: true`, which is how the intake card itself classifies it |
| Twitter's Scala/Thrift Snowflake daemon as a deployment form distinct from the in-process library | `id-generator` has no `deployment` property (`in-process` vs `service`) | one `snowflake-id` node per datacenter; the Thrift form is carried by the edge protocol and the node label |

No component was missing for the generators themselves: `snowflake-id`, `ticket-server` and
`uuid-generator` all exist under `default` on the `id-generator` kind.

## Assumed values (the source is silent, a rule reads the property, or the model needs one)

- `worker-id-registry` as a ZooKeeper node at all. The 2010 README says machine ids are
  *configured*; the card's own Unknowns section flags ZooKeeper as unverified. The node stands for
  the card's "configuration or Zookeeper" and is marked assumed above.
- `worker-id-registry.replicated: true` in the clean design. Not stated; set because the card's
  requirement is "no single point of failure" and `shared-dependency-without-redundancy` encodes
  exactly that practice. The broken twin restores the single instance, which is where the rule fires.
- `security.credentialRotationDays: 90`. Not stated anywhere; set so the design-wide
  `credentials-without-rotation` rule is satisfied, as in the other reference designs.
- `entity-store.encryptionAtRest: true` and `ticket-db.encryptionAtRest: true`. Not stated.
- Two datacenters. The sources state 5 datacenter bits and "machines across data centers" but never
  a count; two region groups are drawn to make the boundary visible, and no `availability.regions`
  value is asserted.
- `consistency.model: "ap"` reads the source's "machines generating ids should not have to
  coordinate with each other" as the partition trade the design takes.

## Not encoded

- The bit layout itself. `id-generator` carries `workerIdBits: 10` and `sequenceBits: 12`, so the
  41-bit timestamp, the 1-bit sign, the book's 5+5 split of the machine bits, and the custom epoch
  are implied but never written down; there is no `layout` or `epoch` property.
- The 69-year lifetime of a 41-bit millisecond timestamp, and the 4,096 ids per millisecond per
  machine ceiling (about 4M/sec). `nfr.rps: 10000` records only the stated floor, "minimum 10k ids
  per second per process".
- k-sortedness: "we're promising 1s, but shooting for 10's of ms". There is no requirement path for
  an ordering-skew bound, and `freshness.maxSeconds` means something else.
- The 1,024-generator ceiling implied by 10 machine-id bits. No property holds a fleet ceiling.
- Section-length tuning as a design dial (trading timestamp lifetime against machine count against
  per-millisecond throughput). A design states one chosen layout, not the family of layouts.
- NTP itself, and the generator-to-clock and clock-to-NTP edges the card lists; see catalogue gaps.
- Sequence overflow inside a millisecond (spin until the next millisecond). Implied by the sources,
  never stated, and no property expresses it.
- The reasons the three alternatives were rejected. The broken twin shows the ticket server, the
  MySQL auto-increment row and UUID v4 failing under rules, but "128 bits is larger than the 64-bit
  requirement" and "non-numeric" are properties of an id format that the format does not model.
- The Cassandra migration as the historical trigger: `entity-store` is drawn, but a design says what
  exists, not what it replaced.
- Instagram's alternative of generating ids inside each Postgres shard, which the card
  cross-references to `instagram-feed`; it survives there as `postgres.idEncodesShard: true`.
