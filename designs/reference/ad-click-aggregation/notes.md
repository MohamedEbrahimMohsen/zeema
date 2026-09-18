# ad-click-aggregation: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/ad-click-aggregation.md` (Alex Xu and Sahn Lam, *System Design Interview* vol 2 ch 6, plus Uber's "Real-Time Exactly-Once Ad Event Processing with Apache Flink, Kafka, and Pinot", 2021)
- Size: 20 nodes, 24 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture: billing-grade ad click event aggregation — clicks flow through Kafka
into event-time windowed stream jobs that deduplicate, attribute and emit minute aggregates
transactionally into a real-time OLAP store, with raw events kept for replay and reconciliation.

Fixes relative to ad-click-aggregation.broken.yaml:
  - aggregate-job declares a watermark for its event-time tumbling windows, so late clicks
    have a defined fate instead of closing a billed window early
  - dedup-state declares a ttl eviction policy, so the duplicate-suppression keyspace is bounded
  - order-store stays single-region (the source states no cross-region replication) instead of
    taking writes in both regions with no conflict policy
  - log-ingest does not retry into the broker it is already saturating; the client carries the
    resend policy and the ingest hop is a plain at-least-once produce
  - security.credentialRotationDays is declared for the stores that hold billable event data
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture, broken variant: the same billing-grade ad click pipeline built the way a
team commonly builds it first — event-time windows with nothing to close them, an unbounded
dedup keyspace, an attribution store taking writes in both regions with no conflict policy, an
ingest hop that retries exponentially into the broker it is already saturating, and no stated
rotation for the credentials that reach every store holding billable event data.

This file MUST trip:
  - windowed-aggregation-without-watermark     (aggregate-job windows by event time, no watermarkSeconds)
  - cache-missing-eviction-policy              (dedup-state declares no evictionPolicy; the event-id keyspace grows forever)
  - multi-leader-store-without-conflict-policy (order-store is multi-region-multi-leader with no conflictResolution)
  - retry-without-adaptive-shedding            (log-ingest -> raw-click-events retries exponentially, no circuit breaker, no rate-limiter)
  - credentials-without-rotation               (data nodes present, no security.credentialRotationDays, no key-management node)
and MUST NOT trip:
  - datastore-missing-backup, datastore-single-region, single-writer-primary-at-peak-qps,
    read-replica-as-sole-scaling, business-updates-without-index-propagation (no relational node)
  - queue-missing-dlq, retry-queue-without-dlq, retry-without-backoff, pubsub-replay-required
    (the pipeline is streams, not queues or fan-out topics)
  - cache-as-primary-store-without-persistence, materialised-cache-without-rebuild-path
    (dedup-state is neither the primary copy nor a materialised view)
  - read-heavy-path-without-cache              (a cache node exists and no readWriteRatio is stated)
  - exactly-once-with-external-side-effects, external-call-inline-without-durable-path,
    money-mutation-without-idempotency-key     (no third-party-api and no money-handling node)
  - derived-store-without-cdc-or-rebuild       (no search index)
  - sync-chain-too-deep                        (no api-gateway and no latency.p95Ms target)
  - stateful-engine-pinned-to-single-zone, stateful-node-without-zone-redundancy
    (the design draws regions and trust zones, not availability zones)
  - fanout-inline-in-request-path, push-fanout-without-celebrity-path,
    shared-worker-pool-across-queues, shared-dependency-without-redundancy (no such nodes or edges)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Mobile / web clients emitting impression and click events | `ad-client` | `mobile-app` | client | close |
| Log watcher / ingest | `log-ingest` | `container-worker` | worker | close |
| Kafka (raw ad events), 3-day retention | `raw-click-events` | `kafka` | stream | exact |
| Order data stream feeding the attribution job | `order-events` | `kafka` | stream | close |
| Map nodes (filter, normalise, repartition by ad id) | `map-job` | `flink` | stream-processor | close |
| Aggregation job / Aggregate nodes (1-minute event-time tumbling windows, top-N heap) | `aggregate-job` | `flink` | stream-processor | exact |
| Reduce nodes (merge per-node partials into the final window result) | `reduce-job` | `flink` | stream-processor | close |
| Dedup state (keyed state / record ids) | `dedup-state` | `cache-cluster` | cache | assumed |
| Attribution job (Uber) | `attribution-job` | `flink` | stream-processor | exact |
| Docstore (ad events for order attribution) | `order-store` | `nosql-store` | nosql-database | close |
| Kafka (aggregates), transactional, `read_committed` | `aggregate-events` | `kafka` | stream | exact |
| Region B aggregate output unioned before serving | `aggregate-events-b` | `kafka` | stream | close |
| Union and load job | `union-load-job` | `flink` | stream-processor | exact |
| Flink checkpoint storage (every 2 minutes) | `checkpoint-store` | `blob-store` | object-store | assumed |
| Aggregated DB / OLAP (Pinot, upsert by record UUID) | `olap-store` | `pinot` | data-warehouse | exact |
| Hive (Uber's warehouse copy, deduplicated by record UUID) | `warehouse` | `hive` | data-warehouse | exact |
| Raw data DB (book: append-only raw events for replay) | `raw-event-store` | `cassandra` | nosql-database | close |
| Query service (counts per ad per minute, top ads) | `query-service` | `container-service` | app-server | close |
| Reconciliation batch (nightly recompute and compare) | `reconciliation-job` | `spark-job` | worker | close |
| Alerting (job downtime, overspend risk) | `alerting` | `observability-stack` | monitoring | assumed |

Tally: 7 exact, 10 close, 3 assumed.

## Catalogue gaps

| Product | Kind it would need | Used instead |
|---|---|---|
| Uber Docstore (Schemaless-backed document store) | `nosql-database` | `nosql-store` with `model: "document"` |

No new kind is needed; only a named component is missing.

## Not encoded

- **Partitioning by `ad_id`.** Both sources make this the defining property of the raw topic ("input events are partitioned by ad_id"), but the `stream` kind carries no `partitionKey` property, so it survives only as edge labels ("repartition by ad id").
- **The top-N heap.** The per-Aggregate-node heap and the Reduce node's merge of per-node tops are algorithmic, not structural; the format has no property for a processor's internal data structure.
- **Window length.** The 1-minute tumbling window is stated by both sources, but `stream-processor` has `windowing` as an enum (`event-time`) and no window-length property.
- **`read_committed` and Kafka transactions as a consumer setting.** `transactions: true` on `aggregate-events` and `delivery: "exactly-once"` on the edges carry as much of this as the format can; the two-phase commit tied to the Flink checkpoint is only a label.
- **Record UUID as the idempotency key.** Expressed as `idempotent: true` on the Pinot upsert and Hive load edges; the format has no field for the key's identity or for "deterministic UUID".
- **Region B's full pipeline.** Uber runs the whole aggregation and attribution stack in both regions and unions the outputs. Encoding a second copy would double every node for no new rule surface, so `region-b` holds only `aggregate-events-b`, the output the union-and-load job actually reads.
- **Scale numbers.** "Hundreds of millions of ad events per week" is not a rate the format can hold as `nfr.rps` without converting it, and the book's QPS estimates could not be re-confirmed in this pass, so no `nfr` block is set anywhere.
- **The aggregation job as a single point of failure.** Uber names it explicitly; there is no `criticality` property on `stream-processor` and no rule that reads one, so it lives in the source card and in the `alerting` node's presence.

## Assumptions deliberately encoded

Three values are set because a rule demands a declared value where the sources are silent; each reflects the practice the sources describe, and each is flagged in `source/ad-click-aggregation.md`:

- `aggregate-job.watermarkSeconds: 60` — both sources handle late events rather than ignoring them; the production value is listed as unknown in the intake card.
- `dedup-state.evictionPolicy: "ttl"` — deduplication by event id over a bounded recent window is what both sources describe; the TTL length is not stated, so `ttlSeconds` is omitted.
- `security.credentialRotationDays: 90` — neither source discusses credential rotation, and the design holds billable event data in five stores.
