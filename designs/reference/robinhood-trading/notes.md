# robinhood-trading: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/robinhood-trading.md` (three official Robinhood engineering posts plus a synthesis of the Kafka Summit / Current talks; re-verified 2026-09-14, all four URLs reachable).
- Size: 22 nodes, 33 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture: Robinhood brokerage and crypto, clean variant. Orders enter from the
mobile app through a public load balancer, a routing layer resolves the owning shard, and each
full-stack shard (services, memcache, Postgres) runs isolated behind Kafka hops.

Fixes relative to robinhood-trading.broken.yaml:
  - the internal API proxy calls only the extracted shared settlements component, so no
    synchronous request path reaches into another shard
  - the routing layer's synchronous chain stays at three hops under the one-second SLA
  - the Postgres-backed failed-event store declares a dead-letter queue and exponential
    jitter backoff before anything is replayed to a retry topic
  - service discovery is redundant, which is what the March 2020 thundering herd took out
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: Robinhood brokerage and crypto, broken variant. The same platform
with the shortcuts a team takes on the way to sharding: the internal API proxy reaches
synchronously into another user's shard while the design still promises shard isolation,
that hop pushes the routing layer's synchronous chain past the one-second execution SLA,
the Postgres-backed retry store has nowhere to park a poison event and no backoff, and
internal service discovery runs on a single provider, which is what fell over in March 2020.

This file MUST trip:
  - cross-cell-call                       (internal-api-proxy -> brokerage-service-2 and every other sync edge leaving a shard, while isolation.tenancy is cell)
  - sync-chain-too-deep                   (routing-layer -> brokerage-service-1 -> internal-api-proxy -> brokerage-service-2 -> shard-db-2 is 4 sync hops under latency.p95Ms)
  - retry-queue-without-dlq               (failed-event-store: role retry, deadLetterQueue false)
  - retry-without-backoff                 (failed-event-store declares no backoff)
  - shared-dependency-without-redundancy  (service-dns: redundantProviders false while availability.discoveryRedundant is true)
and MUST NOT trip:
  - queue-missing-dlq                     (failed-event-store is written synchronously; it has no async in-edge)
  - datastore-missing-backup              (both Postgres shards declare backup and 30 day retention)
  - datastore-single-region               (availability.multiRegion is false)
  - single-writer-primary-at-peak-qps, read-replica-as-sole-scaling (both shards declare sharded true)
  - cache-missing-eviction-policy, cache-as-primary-store-without-persistence, materialised-cache-without-rebuild-path (both memcaches declare lru and hold no materialised view)
  - credentials-without-rotation          (security.credentialRotationDays is set)
  - retry-without-adaptive-shedding       (the only retrying edge, internal-api-proxy -> settlements, keeps its circuit breaker)
  - external-call-inline-without-durable-path, exactly-once-with-external-side-effects (no node calls execution-venues synchronously)
  - read-heavy-path-without-cache         (traffic.readWriteRatio is not declared, and caches exist)
  - business-updates-without-index-propagation, derived-store-without-cdc-or-rebuild (no search index in this design)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone (the design declares no availability-zone groups)
  - pubsub-replay-required                (no pubsub-topic node; Kafka is a stream)

## Mapping

| # | Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|---|
| 1 | Mobile app | `mobile-client` | `mobile-app` | client | exact |
| 2 | Public load balancer | `public-lb` | `load-balancer-tier` | load-balancer | exact |
| 3 | Shard mapping service | `shard-mapping` | `apache-helix` | coordination-service | close (in-house; no unnamed default of this kind) |
| 4 | Routing layer | `routing-layer` | `envoy-gateway` | api-gateway | close (in-house; no unnamed default of this kind) |
| 5 | Aggregation layer | `aggregation-layer` | `container-service` | app-server | exact |
| 6 | Internal API proxy | `internal-api-proxy` | `envoy-gateway` | api-gateway | close (in-house) |
| 7 | Brokerage services (per shard) | `brokerage-service-1`, `brokerage-service-2` | `container-service` | app-server | exact |
| 8 | Memcache (per shard) | `shard-cache-1`, `shard-cache-2` | `memcached` | cache | exact |
| 9 | Postgres (per shard) | `shard-db-1`, `shard-db-2` | `postgres` | sql-database | exact |
| 10 | Settlements component | `settlements` | `container-service` | app-server | exact |
| 11 | Kafka clusters | `order-kafka` | `kafka` | stream | exact |
| 12 | Shard-specific topics | — | — | — | not encoded (no property holds it) |
| 13 | Kafkaproxy sidecar | `kafkaproxy` | `envoy-sidecar` | service-mesh | close (in-house product, generic sidecar used) |
| 14 | Postgres-backed DLQ | `failed-event-store` | `message-queue` | queue | close (relational backing not expressible) |
| 15 | Faust / Flink | `stream-processing` | `flink` | stream-processor | close (Faust has no component; one node covers both) |
| 16 | Debezium CDC | `shard-cdc` | `debezium` | change-data-capture | exact |
| 17 | Data lake | `data-lake` | `blob-store` | object-store | assumed (the sources name Hudi, not the store) |
| 18 | Market makers / exchanges / clearing | `execution-venues` | `supplier-api` | third-party-api | close (one node for the counterparties, as the card draws them) |
| 19 | DNS | `service-dns` | `dns-resolver` | dns | exact |
| 20 | WarpStream | `logging` | `warpstream` | stream | exact |
| 21 | pganalyze / Jaeger | — | — | — | not encoded (diagnosis tools, not runtime boxes) |
| 22 | Kubernetes | — | — | — | not encoded (`orchestrator: "kubernetes"` on the services) |

Tally: 11 exact, 7 close, 1 assumed, 3 rows deliberately not encoded.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Generic in-house API gateway / routing tier | `api-gateway` (no unnamed default exists) | `envoy-gateway` |
| Generic in-house shard-mapping service | `coordination-service` (no unnamed default exists) | `apache-helix`, `role: "sharding"` |
| Robinhood Kafkaproxy (connection-pooling and consumer-group sidecar) | `service-mesh`, or a `broker-proxy` kind | `envoy-sidecar` |
| Faust | `stream-processor` | folded into the `flink` node |
| Postgres-backed dead-letter and retry store | `queue` with a relational backing | `message-queue`, `role: "retry"` |

No component was added to the catalogue for this design.

## Not encoded

- Shard count over time (1 early 2020, 3 by end 2020, 10 later): the design draws two shards, which is the smallest number that shows the cell boundary and the cross-shard path. There is no property for a shard count.
- "Shard-specific topics for high-throughput flows, per-message filtering for the rest": the two-strategy split has no property on the `stream` kind; the behaviour appears only as edge labels.
- "5 to 10 Kafka hops per trade": the count of hops between order intake and execution is not an edge field; it is on the `order-kafka -> execution-venues` label.
- The crypto query work (>30 queries per request down to 1, 1000x index speedups, 7x CPU reduction, writes +50%, reads ~4x) is a before/after of the same node, and the format has no before/after.
- The WarpStream tradeoff (45% cost cut for 0.2 s to 0.45 s latency) is a per-node latency budget the `stream` kind does not carry.
- The 100,000+ gunicorn broker connections that the Kafkaproxy sidecar removed: no connection-count property exists.
- Kafkaproxy v1 (Rust) versus v2 (Java over gRPC): one node, no version history.
- `isolation.tenancy: "cell"` is deliberately **absent** from the clean design. `cross-cell-call` treats an edge as crossing when either endpoint is outside a cell, so any design with an entry point in front of its cells would fire it; the promise is made only in the broken twin, where it is the mistake being demonstrated.
- `backupEnabled` / `backupRetentionDays` on the shard databases and `security.credentialRotationDays` are set although the sources are silent: they are read by `datastore-missing-backup` and `credentials-without-rotation`, which encode practices a self-clearing US broker-dealer has. See `work/designs/robinhood-trading/verify.md`.
- `consistency.model: "cp"` and `availability.discoveryRedundant: true` are implied rather than stated: per-shard Postgres transactions with money correctness above availability, and the founders' "additional redundancies in our infrastructure" after the DNS failure.
