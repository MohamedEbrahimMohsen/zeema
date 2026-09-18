# datadog-husky: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/datadog-husky.md` (nine posts on Datadog's engineering and incident-response blogs; two re-verified 2026-09-14).
- Size: 23 nodes, 29 edges, 6 groups. Broken twin: 22 nodes, 28 edges, 6 groups.

## Clean variant (header of design.yaml)

Datadog Husky, clean variant: the observability intake pipeline and the third-generation
event store behind it — Kafka Streams, a deterministic Shard Router, stateless Writers and
Compactors over S3 fragments, FoundationDB as the strongly consistent metadata source of
truth, and a Planner/Orchestrator/Reader query plane fronted by three cache tiers.

Fixes relative to datadog-husky.broken.yaml:
  - intake-service publishes to intake-stream (Kafka) instead of calling shard-router
    synchronously, so routing and sharding stay off the intake request path
  - query-orchestrator does not declare a consistent-hash ring that nothing owns; shard
    placement is owned by sharding-allocator and assigner, which are coordination services
  - metadata-store is a single-region FoundationDB cluster, the strongly consistent source
    of truth the sources describe, not a multi-leader cluster spanning regions
  - result-cache is a cache, not a store: usedAsPrimaryStore false, every fragment lives in
    blob-store and every visible fragment is recorded in metadata-store
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Datadog Husky, broken variant: the same intake pipeline and event store, built the way a
team reaches for first — shard routing called inline from intake instead of across Kafka,
a query fan-out ring nobody owns, one FoundationDB cluster stretched multi-leader across
regions, and a query result cache promoted to the store of record.

This file MUST trip:
  - fanout-inline-in-request-path              (intake-service calls shard-router, a worker, synchronously)
  - stateful-hash-ring-without-ring-manager    (query-orchestrator is consistent-hash sharded with no edge to a coordination service)
  - multi-leader-store-without-conflict-policy (metadata-store is multi-region-multi-leader with no conflictResolution)
  - cache-as-primary-store-without-persistence (result-cache: usedAsPrimaryStore true, persistence false)
and MUST NOT trip:
  - cache-missing-eviction-policy              (all three caches declare lru)
  - materialised-cache-without-rebuild-path    (no cache declares materialised)
  - read-heavy-path-without-cache              (the design has caches; traffic.readWriteRatio is unset)
  - credentials-without-rotation               (security.credentialRotationDays is set)
  - datastore-missing-backup, datastore-single-region, single-writer-primary-at-peak-qps,
    read-replica-as-sole-scaling               (no sql-database node)
  - queue-missing-dlq, retry-queue-without-dlq, pubsub-replay-required (no queue or pubsub-topic node)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone
                                               (no availability-zone group; every compute node is stateless)
  - shared-dependency-without-redundancy       (availability.discoveryRedundant is unset and both helix nodes are replicated)
  - sync-chain-too-deep                        (no api-gateway node and no latency.p95Ms requirement)

Each of the four is a mistake the sources themselves argue against: Datadog put Kafka
between intake and routing precisely so a slow shard cannot back up the intake request;
shard placement is owned by the Sharding Allocator so that every router agrees on the ring;
FoundationDB was chosen as one strictly serializable cluster, not a multi-leader stretch;
and the caches exist only because every fragment is durable and immutable in blob storage.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Datadog Agent / customer sources | `datadog-agent` | `sdk-client` | client | close |
| Datadog app and public API clients (query side) | `query-client` | `web-browser` | client | close |
| Load balancer | `intake-lb` | `load-balancer-tier` | load-balancer | exact |
| Intake service | `intake-service` | `container-service` | app-server | exact |
| Kafka / Streams, stream lanes | `intake-stream` | `kafka` | stream | exact |
| DLQ lane | `dlq-lane` | `kafka` | stream | close |
| Assigner | `assigner` | `apache-helix` | coordination-service | close |
| Shard Router | `shard-router` | `container-worker` | worker | close |
| Sharding Allocator | `sharding-allocator` | `apache-helix` | coordination-service | close |
| Autosharder | `autosharder` | `container-worker` | worker | exact |
| Kafka shard topics | `shard-stream` | `kafka` | stream | exact |
| Husky Writers | `husky-writers` | `container-worker` | worker | exact |
| Husky Compactors | `husky-compactors` | `container-worker` | worker | exact |
| Metadata Service | `metadata-service` | `container-service` | app-server | exact |
| Metadata store | `metadata-store` | `foundationdb` | nosql-database | exact |
| Blob storage | `blob-store` | `s3` | object-store | exact |
| Query Planner | `query-planner` | `container-service` | app-server | exact |
| Query Orchestrator | `query-orchestrator` | `container-service` | app-server | exact |
| Husky Readers (Reader Service / leaf nodes) | `husky-readers` | `container-service` | app-server | close |
| Result Cache | `result-cache` | `cache-cluster` | cache | exact |
| Blob Range Cache | `blob-range-cache` | `cache-cluster` | cache | exact |
| Predicate Cache | `predicate-cache` | `cache-cluster` | cache | exact |
| Kubernetes node fleet with Cilium CNI | `k8s-fleet` | `kubernetes` | container-orchestrator | exact |

Tally: 17 exact, 6 close, 0 assumed.

Two mapping choices are worth naming. The Readers are modelled as `app-server`, not `worker`:
they answer synchronous fragment queries and hold no trigger, and the `worker` kind requires
a `trigger` (queue, stream, schedule, batch, manual) that a request-serving leaf node does not
have. The DLQ lane is modelled as a `stream`, not a `queue`, because the source describes it
as a lane inside a Kafka Stream that a failed event is copied into, not a separate broker.

## Assumed values

Three values are not in any source and are set so the design states a practice rather than
leaving it blank. They are the only non-sourced values in the file:

- `security.credentialRotationDays: 90` — no post discusses credential rotation for the
  Husky data plane. Set so the design declares a rotation period at all
  (`credentials-without-rotation` reads it).
- `traffic.skew: "heavy-tail"` — the phrase is not used, but the Autosharder exists because
  per-tenant throughput varies by orders of magnitude and shuffle sharding exists because a
  few tenants would otherwise dominate a reader pool.
- `evictionPolicy: "lru"` on the three query caches — no post names an eviction policy.

## Catalogue gaps

Five, none of them blocking; full table in `work/designs/datadog-husky/gaps.md`. In short:
no generic in-house `stream-processor` or `search-index` component exists under `default`
(every one is a named product), no generic `coordination-service` exists either (the repo's
convention is `apache-helix` plus a `label`, followed here), there is no `columnar-store` /
`lakehouse-table` kind for a fragment store on object storage, and `client` has no agent
flavour for a host daemon like the Datadog Agent.

## Not encoded

- The separate metrics platform (metrics intake, Timeseries Index Service, Timeseries Database
  Service) — the sources never say whether it shares anything with Husky beyond Kafka and the
  UI, and it needs a generic in-house search-index component the catalogue does not have.
- libstreaming — a Rust client library linked into every producer and consumer, deliberately
  not a deployable node (the source explains it replaced a central gRPC proxy for that reason).
- The completeness-accounting pipeline (per-segment create/ack events, ratio per time bucket)
  — it is expressed only as the design-level requirement `data.lossDetection: true`.
- Kafka's "relaxed ordering guarantees": the `stream` kind's `ordering` enum offers per-key or
  global only, so relaxed-then-reordered-downstream cannot be said. `per-key` is used.
- Exactly-once as a property of one hop. The design states it at design level
  (`messaging.exactlyOnce: true`); the mechanism — dedupe by event ID committed in the same
  FoundationDB transaction as the data — lives in the label on `husky-writers -> metadata-service`
  plus `idempotent: true`, because no edge or node property expresses writer-side dedupe.
- Shard placements as a data unit: immutable, non-overlapping, valid for a few minutes,
  derived from `H(tenant_id, totalShards)` with a per-tenant salt. Only the edge
  `shard-router -> sharding-allocator` carries it, as a label.
- Fragment internals — row groups, zone maps, posting lists, the 3-4 column sort schema, the
  size-tiered ladder from ~1,000 to ~1,000,000 rows, regex/FSA pruning metadata. The format
  has no place for a file layout.
- The measured numbers: 100 trillion events a day, billions of queries a day, p50 2.01 ms /
  p99 257.36 ms, the cache hit ratios, the pruning funnel. No box has a source-stated rps, so
  no `nfr.rps` is set anywhere; only `husky-readers` carries an `nfr.latencyP95Ms` (20, from
  the stated p95 of 19.93 ms for a fragment query).
- The 2023-03-08 outage mechanism — a shared automatic package-update channel across five
  regions on three cloud providers, which defeated region isolation without any shared
  infrastructure. `k8s-fleet` records the Cilium CNI, but a cross-region update channel is a
  dependency the format cannot draw.
- Region multiplicity: `availability.regions: 5` and `availability.multiRegion: true` are
  stated, but only US1 is drawn. The sources never say where the region boundary sits inside
  Husky (whether FoundationDB clusters, buckets and reader fleets are per-region), so drawing
  a second region would have invented a topology.
- Resource-pool isolation for queries (single pool, per product, or per tenant; automated
  versus human queries). `isolation.tenancy: "shared"` is the closest the enum gets.
