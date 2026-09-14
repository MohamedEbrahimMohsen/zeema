# airbnb-search: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/airbnb-search.md` (intake card of 2026-09-07, re-verified 2026-09-13).
- Size: 24 nodes, 31 edges, 5 groups. Broken twin: 23 nodes, 29 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture: the Airbnb service-oriented platform behind search — a four-layer
service hierarchy over exclusively owned datastores, SpinalTap change data capture into
Kafka, derived data in Mussel and Elasticsearch, and authorization centralised in Himeji.

Fixes relative to airbnb-search.broken.yaml:
  - every mutation leaves its store through SpinalTap: listings-db and dynamo-store both
    feed the CDC service, so the search index is never updated by a dual write
  - search-indexer consumes kafka-cdc and writes search-index asynchronously, so indexing
    is off the request path and the index is rebuildable
  - himeji-cache is a look-aside cache over the durable himeji-store (Aurora), invalidated
    by CDC events rather than being the only copy of the permission tuples
  - user-signals-flink processes one event at a time (windowing none), which is why the
    User Signals Platform left Spark Streaming micro-batches
  - credential rotation is stated for the datastores the services own
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: the Airbnb service-oriented platform behind search, broken variant.
Same system as airbnb-search.yaml, with the mistakes the Airbnb write-ups warn about:
CDC wired only on DynamoDB while MySQL changes are dual-written, a search index written
inline on the request path by a worker the presentation service calls synchronously, a
Himeji cache that is the only copy of the permission tuples, an event-time Flink pipeline
with no watermark, and no stated credential rotation for the stores the services own.

This file MUST trip:
  - business-updates-without-index-propagation  (listings-db is written sync by data-service, a search index exists, no CDC leaves it)
  - derived-store-without-cdc-or-rebuild        (search-index has only sync in-edges, from search-indexer and presentation-service)
  - fanout-inline-in-request-path               (presentation-service calls search-indexer, a worker, synchronously)
  - cache-as-primary-store-without-persistence  (himeji-cache: usedAsPrimaryStore true, persistence false, Aurora removed)
  - windowed-aggregation-without-watermark      (user-signals-flink windows on event time with no watermarkSeconds)
  - credentials-without-rotation                (security.credentialRotationDays dropped, no key-management node)
and MUST NOT trip:
  - cache-missing-eviction-policy               (himeji-cache declares lru)
  - materialised-cache-without-rebuild-path     (himeji-cache is not materialised)
  - datastore-missing-backup, datastore-single-region (listings-db is backed up; multiRegion false)
  - read-heavy-path-without-cache               (traffic.readWriteRatio is not stated)
  - single-writer-primary-at-peak-qps, read-replica-as-sole-scaling (no rps is stated for listings-db)
  - sync-chain-too-deep                         (no latency.p95Ms is stated for this system)
  - queue-missing-dlq, pubsub-replay-required, retry-queue-without-dlq (no queue or pubsub topic in this design)
  - stateful-engine-pinned-to-single-zone, shared-dependency-without-redundancy (zookeeper is replicated and in no availability-zone group)
  - push-fanout-without-celebrity-path, multi-leader-store-without-conflict-policy,
    object-store-single-zone-with-durability-target, cross-cell-call (no such node, store or cell)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Web / mobile clients | `client` | `user-device` | client | exact |
| API gateway | `api-gateway` | `envoy-gateway` | api-gateway | close (the gateway is in-house; no generic api-gateway component exists) |
| Presentation services | `presentation-service` | `container-service` | app-server | exact |
| Middle-tier utility services | `middle-tier-service` | `container-service` | app-server | exact |
| Derived-data services | `derived-data-service` | `container-service` | app-server | exact |
| Data services | `data-service` | `container-service` | app-server | exact |
| Monorail | `monorail` | `container-service` | app-server | close (a Rails monolith modelled as one app-server) |
| Ranking model service | `search-ranking-service` | `container-service` | app-server | assumed (the paper describes a custom Java NN library inside search, not a deployed model server) |
| Search indexing service | `search-indexer` | `container-worker` | worker | exact |
| Riverbed | `riverbed` | `container-worker` | worker | close (in-house stream consumer maintaining materialised views) |
| Airstream / Spark Streaming | `airstream` | `spark-streaming` | stream-processor | exact |
| Flink jobs (User Signals Platform) | `user-signals-flink` | `flink` | stream-processor | exact |
| SpinalTap | `spinaltap` | `debezium` | change-data-capture | close (nearest log-based CDC component; SpinalTap has none) |
| Zookeeper | `zookeeper` | `zookeeper` | coordination-service | exact |
| Kafka (CDC cluster) | `kafka-cdc` | `kafka` | stream | exact |
| Kafka (analytics cluster) | `kafka-analytics` | `kafka` | stream | exact |
| MySQL | `listings-db` | `mysql` | sql-database | exact |
| DynamoDB | `dynamo-store` | `dynamodb` | nosql-database | exact |
| Himeji | `himeji` | `spicedb` | identity-provider | close (Zanzibar-style rebac authorization; Himeji has no component) |
| Himeji cache | `himeji-cache` | `cache-cluster` | cache | exact (the product behind the sharded in-memory cache is not named) |
| Amazon Aurora | `himeji-store` | `aurora` | sql-database | exact |
| Mussel | `mussel` | `hbase` | nosql-database | close (Mussel is built on HBase/HFile; no Mussel component) |
| Elasticsearch | `search-index` | `elasticsearch` | search-index | close (confirmed for review and inbox search; listing-search internals are not public) |
| Hive | `hive` | `hive` | data-warehouse | exact |

Tally: 15 exact, 8 close, 1 assumed.

## Catalogue gaps

| Product | Kind it would need | Used instead |
|---|---|---|
| SpinalTap (Airbnb CDC) | `change-data-capture` (already exists; no generic component) | `debezium` |
| Himeji (Airbnb authorization) | an `authorization-service` kind, or a generic under `identity-provider` | `spicedb` |
| Mussel (Airbnb derived-data KV store) | `nosql-database` (already exists; no generic HBase-derived component) | `hbase` |
| In-house API gateway | `api-gateway` (already exists; no vendor-neutral generic) | `envoy-gateway` |

No component was added to the catalogue for this design.

## Assumed property values

No source states these; they are set to the value that reflects ordinary practice at Airbnb so
that the clean design is rule-clean, and they are the only invented values in the file.

- `listings-db` / `dynamo-store` / `himeji-store`: `backupEnabled: true`, `backupRetentionDays: 30`.
- `requirements.security.credentialRotationDays: 90`.
- `himeji-cache.evictionPolicy: "lru"` (the sources state only that invalidation is event-driven via
  SpinalTap, which is encoded as `invalidation: "event"`).
- `zookeeper.replicated: true` (the SpinalTap README configures a ZooKeeper connection string and
  namespace but does not state the ensemble size).
- `presentation-service -> search-index` (sync read): Elasticsearch is confirmed as the backing
  index for review and inbox search, but no source draws the arrow from a named caller.

## Not encoded

- The inter-service Kafka cluster: confirmed to exist, but no producer or consumer on it is described.
- Scale numbers with no field to hold them: 35B+ events/day and 1,000+ tables/day (analytics Kafka
  and Hive), Riverbed's 2.4B events/day and 50+ materialised views, 250+ services and 1,000+
  endpoints, 10,000 deploys/week. `nfr.rps` carries only the three per-second figures the sources
  state: Himeji 850K/s, Mussel 100K writes/s, User Signals Platform 1M events/s.
- Himeji's p99 of 12 ms and 98% cache hit rate: `nfr` has only `latencyP95Ms`, and the hit rate has
  no field; the hit rate is kept as an edge label.
- Where Riverbed's materialised views are stored: not public, so Riverbed has no out-edge.
- The migration machinery: Diffy response comparison, dual reads gated from 1% to 100%, shadow-database
  dual writes, and the Airflow + Spark backfill tooling used to onboard services onto Himeji. These
  are migration-time practices, not runtime elements.
- Kubernetes as a platform: encoded only as `orchestrator: "kubernetes"` on the services, not as a node.
- Kafka retention and replay policy per cluster, Himeji cross-region behaviour, and the service
  discovery / mesh product: listed as unknowns on the intake card and still unknown.
- The layer a service belongs to (presentation, middle-tier, derived-data, data) has no property in
  v1; it is carried by the node ids and labels and by the edge directions only.
