# notion-sharding: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/notion-sharding.md` (three official Notion engineering posts, 2021-2024, all re-fetched and confirmed on 2026-09-13).
- Size: 16 nodes, 21 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture: Notion's block store sharded by workspace id into 480 logical schemas,
resharded from 32 to 96 RDS instances behind four sharded PgBouncer clusters, with Debezium
change data capture feeding a Hudi-on-S3 data lake that Spark reads.

Fixes relative to notion-sharding.broken.yaml:
  - every application query reaches Postgres through the sharded PgBouncer clusters, routed by
    shard key, instead of the application opening connections straight at the shard fleet
  - debezium is attached to the live 96-instance fleet, so shard updates propagate by log-based
    CDC instead of by dual writes from application code
  - search-index is fed asynchronously by spark-job off the lake, never written on the request path
  - the 96-instance fleet keeps RDS backups, so the shard fleet is recoverable
  - the 2021 double-write is captured in an audit log and replayed by catchup-worker off the
    request path, not called synchronously by the application
  - security.credentialRotationDays is declared for the fleet
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: Notion's sharded block store, broken variant. The reshard is done in a
hurry: the application opens connections straight at the new 96-instance fleet instead of going
through the sharded PgBouncer clusters, Debezium is never re-pointed at the new fleet so the
search index is kept current by dual writes from application code, the new RDS instances are
created with backups off, and the migration double-write is called inline on the request path.

This file MUST trip:
  - business-updates-without-index-propagation (postgres-shards-96 is written sync by notion-app, a search index exists, no CDC leaves it)
  - derived-store-without-cdc-or-rebuild       (search-index only has a sync in-edge from notion-app)
  - datastore-missing-backup                   (postgres-shards-96 declares backupEnabled false)
  - fanout-inline-in-request-path              (notion-app calls catchup-worker synchronously to double-write)
  - credentials-without-rotation               (security.credentialRotationDays dropped, no key-management node)
and MUST NOT trip:
  - read-heavy-path-without-cache              (no traffic.readWriteRatio is stated, so the rule is inert)
  - single-writer-primary-at-peak-qps, read-replica-as-sole-scaling (no source states an rps, so no sql-database carries nfr.rps)
  - datastore-single-region                    (availability.multiRegion is false)
  - sync-chain-too-deep                        (no api-gateway node and no latency.p95Ms target)
  - object-store-single-zone-with-durability-target (no durability.annualNines requirement; s3 spans 3 zones)
  - windowed-aggregation-without-watermark     (hudi-deltastreamer does not window by event time)
  - pubsub-replay-required, queue-missing-dlq, retry-queue-without-dlq (no pubsub-topic and no queue in this design)
  - cache-as-primary-store-without-persistence, cache-missing-eviction-policy, materialised-cache-without-rebuild-path (no cache node)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone (no availability-zone groups)
  - stateful-hash-ring-without-ring-manager    (notion-app routes by lookup, not consistent-hash)
  - retry-without-adaptive-shedding, retry-without-backoff (no edge declares a retryPolicy)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| User in a browser (implied client of the application) | `web-client` | `web-browser` | client | assumed |
| Notion application, routes each query by workspace id | `notion-app` | `container-service` | app-server | close (runtime not named in the posts) |
| PgBouncer clusters, 4 clusters x 24 databases | `pgbouncer-cluster` | `pgbouncer` | database-proxy | exact |
| Postgres monolith (five years, VACUUM stall, TXID wraparound risk) | `postgres-monolith` | `aws-rds` | sql-database | exact |
| 32 Postgres instances x 15 logical schemas | `postgres-shards-32` | `aws-rds` | sql-database | exact |
| 96 Postgres instances x 5 logical schemas | `postgres-shards-96` | `aws-rds` | sql-database | exact |
| Audit log (2021 double-write capture) | `audit-log` | `aws-rds` | sql-database | close (a table inside Postgres, modelled as its own append-only store) |
| Catch-up script and backfill (2021) | `catchup-worker` | `container-worker` | worker | close |
| Debezium connectors, one per Postgres host on EKS | `cdc-connectors` | `debezium` | change-data-capture | exact |
| Kafka, one topic per table across all 480 shards | `cdc-topics` | `kafka` | stream | exact |
| Hudi Deltastreamer, COPY_ON_WRITE upsert | `hudi-deltastreamer` | `spark-streaming` | stream-processor | close (Hudi has no component; the Streamer is a Spark utility) |
| S3 data lake | `data-lake` | `s3` | object-store | exact |
| Spark jobs (denormalisation, permission tree traversal, ETL) | `spark-job` | `spark-job` | worker | exact |
| Snowflake | `snowflake` | `snowflake` | data-warehouse | exact |
| Fivetran | `fivetran` | `fivetran` | worker | exact |
| Search (and AI) consumers downstream of the lake | `search-index` | `elasticsearch` | search-index | assumed (the posts never name the search product) |

Boxes from the card that became edge or property facts rather than nodes:

- Logical replication (2023) -> the `postgres-shards-32` -> `postgres-shards-96` edge and its
  reversed twin, both `postgres-logical-replication`, async, at-least-once.
- Dark reads -> the `notion-app` -> `postgres-shards-96` sync edge, `fallback: "degraded"`,
  labelled with the 1 second pause and the five-row comparison.
- RDS snapshot export -> the `postgres-shards-96` -> `data-lake` batched async edge.
- Third-party sources -> not modelled; no generic `third-party-api` component fits an unnamed set
  of third-party SaaS datasets, so `fivetran` is a source node feeding `snowflake`.

Mapping confidence: 10 exact, 4 close, 2 assumed.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Apache Hudi (Deltastreamer / Hudi Streamer) | `stream-processor` | `spark-streaming`; the catalogue deliberately skips open table formats as nodes ("stored in an object store, not nodes"). COPY_ON_WRITE upsert is carried in the node label. |

No other product in the card is missing from the catalogue.

## Assumptions

- `security.credentialRotationDays: 90` - no Notion post discusses rotating database credentials.
  The value is set because `credentials-without-rotation` reads it and the real fleet is managed
  RDS, where rotation is standard practice. Flagged here as assumed, per the brief.
- One `region` group (`aws-us`). The posts name RDS and EKS but never state a region count;
  `availability.multiRegion: false` is the card's inference, not a quoted fact.
- `web-client` is not drawn in any of the three posts; it is the implied caller of the application
  tier and exists so the application node is not the design's only entry point.
- The audit log is written through the pooler like every other Postgres object, so the clean design
  has no direct app-server-to-database write except the dark read.

## Not encoded

- 480 logical schemas over 96 physical instances: `sql-database` has no `logicalShards` /
  `physicalShards` property, so the counts live in node labels only.
- Divisibility of 480 as the reason for choosing that shard count.
- The five-minute maintenance window (2021) versus the ~1 second spinner (2023): the format has no
  place for a migration's cutover duration.
- The index-deferral optimisation that cut the logical-replication copy from 3 days to 12 hours; it
  is a property of the copy procedure, not of an edge.
- VACUUM stall and transaction-id wraparound risk on the monolith: no property expresses
  "this engine is approaching an internal maintenance ceiling".
- Freshness is a two-tier fact (minutes for most tables, up to two hours for `block`);
  `freshness.maxSeconds` holds one number, so the worst case (7200) is encoded.
- Cost: "over a million dollars" saved in 2022 has no representation in the format.
- Data volume (200+ billion blocks, hundreds of TB compressed, doubling every 6-12 months) and the
  "tens of MB/sec of row changes" rate: the format carries `nfr.rps` only, and no source states a
  request rate, so no node carries an `nfr`.
- The "separate id and space_id instead of a composite primary key" regret: a schema decision, not
  a topology fact.
