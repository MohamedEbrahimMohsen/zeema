# Intake: Notion Postgres sharding, resharding and data lake

## Source
- Primary: https://www.notion.com/blog/sharding-postgres-at-notion (official, 2021: block model, 480 logical shards on 32 instances, migration phases)
- Primary: https://www.notion.com/blog/the-great-re-shard (official, 2023: 32 to 96 instances, PgBouncer sharding, logical replication, dark reads)
- Primary: https://www.notion.com/blog/building-and-scaling-notions-data-lake (official, 2024: Debezium, Kafka, Hudi, S3, Spark)
- Verified by: three official Notion engineering posts
- Confidence: high
- Date of source: 2021-2024

## System in three lines
A block-based workspace product whose entire content lives in one Postgres `block` table tree, sharded by workspace id into 480 logical schemas spread first over 32, then 96 physical instances, with application-level routing through sharded PgBouncer pools. Change data from every shard flows through Debezium into Kafka and Hudi on S3 for Spark jobs that denormalise permissions and feed search and AI. Hard because the monolith hit VACUUM and transaction-id wraparound limits, resharding must happen under live traffic, and permission computation needs tree traversal over hundreds of billions of rows.

## Scale (only if stated)
- Users / DAU: not stated
- Requests per second: not stated; old cluster over 90% CPU and IOPS saturated at peak, new cluster ~20%
- Data volume: 200+ billion blocks, hundreds of TB compressed, doubling every 6-12 months; "tens of MB/sec of Postgres row changes"
- Shards: 480 logical, 32 physical (15 each) then 96 physical (5 each); 4 PgBouncer clusters of 24 databases
- Migration: backfill 3 days on 96 CPUs (2021); logical replication copy 3 days to 12 hours by skipping indexes (2023); switchover 5-minute window (2021), ~1 second spinner (2023)
- Data lake: freshness minutes for most tables, up to 2 hours for block; bootstrap under 24 hours; savings "over a million dollars" in 2022

## Requirements stated or clearly implied
- Availability target: near-zero downtime reshard (achieved ~1 s); rollback via reversed replication streams
- Consistency: strong within a workspace shard; every block belongs to exactly one workspace; dark reads with 1 s pause to tolerate replication lag
- Latency target: user-facing improvement after sharding; lake tolerates minutes to hours, "unsuitable for sub-second online use cases"
- Ordering needs: per-shard CDC order
- Replay or reprocessing: Hudi upserts from Kafka; bootstrap from RDS snapshot export
- Retention: not stated
- Compliance / residency: not stated
- Operational safety: migration and verification written by different engineers

## Boundaries
- Regions / zones: AWS, single region implied (RDS, EKS)
- Trust zones: application tier -> PgBouncer clusters -> Postgres shards; data platform reads CDC only
- Named subsystems: Application routing, PgBouncer pools, Postgres shard fleet, Migration tooling (audit log double-write, catch-up, logical replication), Data lake (Debezium on EKS, Kafka, Hudi Deltastreamer, S3, Spark), Legacy analytics (Fivetran, Snowflake)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Notion application | Routes each query by workspace id to logical shard; passes space_id through the app | Node/TypeScript (not named here) | app-server | shardRoutingInApp: true |
| 2 | PgBouncer clusters | Connection pooling; sharded into 4 clusters x 24 databases to avoid connection exhaustion | PgBouncer | database-proxy | pooling: true; clusters: 4 |
| 3 | Postgres monolith (legacy) | Single instance, five years, VACUUM stall, TXID wraparound risk | RDS Postgres | sql-database | |
| 4 | Postgres shard instances | 32 then 96 RDS instances; schema001..schema480 tables; all tables reachable from block via FK sharded | RDS Postgres | sql-database | sharded: true; logicalShards: 480; physicalShards: 96; shardKey: space_id |
| 5 | Audit log + catch-up script (2021) | Double-write capture and replay to shards; final catch-up at switchover | in-house | worker (migration) | |
| 6 | Logical replication (2023) | Publications/subscriptions to copy schemas to new instances; indexes rebuilt after copy; reversed for rollback | Postgres logical replication | property of sql-database | |
| 7 | Dark reads | Parallel reads against new shards, compare up to 5 rows, sampled traffic | in-house | property of app-server (dual-read) | |
| 8 | Debezium connectors | One per Postgres host on EKS; CDC to Kafka | Debezium | change-data-capture | connectorsPerHost: 1 |
| 9 | Kafka | One topic per table consolidating all 480 shards | Apache Kafka | stream | topicPerTable: true |
| 10 | Hudi Deltastreamer | Upserts CDC into Hudi tables on S3, partitioned by shard | Apache Hudi | stream-processor | mode: copy-on-write upsert |
| 11 | S3 data lake | Primary repository | Amazon S3 | object-store | |
| 12 | Spark jobs | Denormalisation, permission tree traversal, ETL to Snowflake and product systems | Apache Spark (PySpark, Scala) | etl-job | |
| 13 | Snowflake | Warehouse for insert-heavy and BI workloads | Snowflake | data-warehouse | |
| 14 | Fivetran | Managed ELT for small and third-party datasets | Fivetran | etl-job (managed) | |
| 15 | RDS snapshot export | Bootstrap to S3 | AWS RDS | property of sql-database | |
| 16 | Search and AI consumers | Downstream of the lake | in-house | search-index, ml-inference | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| app | pgbouncer cluster | postgres | sync | | routed by space_id |
| pgbouncer | postgres shard | postgres | sync | | 24 dbs per cluster |
| app (2021) | monolith + shards | postgres | sync | | double write via audit log |
| audit-log | catch-up script | batch | async | at-least-once | version compare |
| catch-up | shards | postgres | sync | | |
| old shard | new shard (2023) | logical replication | async | ordered | copy without indexes then rebuild |
| new shard | old shard | logical replication (reversed) | async | | rollback path |
| app | new shards (dark read) | postgres | sync | | compare, 1 s pause |
| postgres shard | debezium | logical decoding | async | at-least-once | |
| debezium | kafka | kafka | async | at-least-once | topic per table |
| kafka | hudi deltastreamer | kafka | async | at-least-once | |
| hudi | s3 | s3 | async | | partitioned by shard |
| s3 | spark | s3 | async | | |
| spark | snowflake / product systems | batch | async | | denormalised permissions |
| rds | s3 (snapshot export) | batch | async | | bootstrap |
| third-party sources | fivetran | api | async | | |
| fivetran | snowflake | batch | async | | |

## Failure modes, incidents, tradeoffs the source discusses
- Monolith limit: VACUUM stall risked wraparound where "Postgres would stop processing all writes to avoid clobbering existing data". Source: sharding.
- Late sharding narrowed options: "Double-write throughput was the primary bottleneck in our final switch-over"; backfilling space_id on the overloaded monolith made logical replication infeasible. Source: sharding.
- Downtime regret: "Had we spent another week optimizing the script to spend <30 seconds catching up... it may have been possible to hot-swap at the load balancer level without downtime." Source: sharding.
- Key design regret: separate id and space_id; a composite key would have avoided "the need to pass space_ids throughout the application". Source: sharding.
- Divisible shard count (480) chosen to allow many physical layouts. Source: sharding.
- Connection explosion when tripling instances; PgBouncer itself had to be sharded. Source: re-shard.
- Index build dominated copy time: 3 days to 12 hours by deferring indexes. Source: re-shard.
- Replication lag vs validation: dark reads needed "1 second pause". Source: re-shard.
- Warehouse tree traversal: permission computation "would simply time out in Snowflake"; Spark over Hudi instead. Source: data-lake.
- Lake latency: minutes to hours; block table up to 2 h; not for online use. Source: data-lake.
- Hybrid retained: Snowflake for insert-heavy, Fivetran for third-party; lake does not replace them. Source: data-lake.

## Unknowns
- Application runtime and caching layer
- Read replica topology per shard
- Search index product
- Multi-region posture

## Candidates
- New kinds: none strictly new; sightings: database-proxy (9th, pooling sharded), change-data-capture (4th: Debezium), stream (8th), stream-processor (4th: Hudi Deltastreamer), etl-job (8th), data-warehouse (7th), object-store (10th), sql-database (14th)
- New properties on existing kinds: sql-database.logicalShards, physicalShards (3rd sighting), shardKey (2nd), logicalReplication (boolean), vacuumRisk (informational); database-proxy.clusters (integer), poolSharded (boolean); stream.topicPerTable (boolean); stream-processor.mode (copy-on-write, merge-on-read)
- New edge properties: dualWrite (boolean); darkRead (boolean); reversible (boolean, rollback path)
- New requirement paths: data.freshnessOnlineSeconds vs data.freshnessAnalyticsMinutes (two tiers); change.rollbackPath (boolean)
- New rules:
  - shard-count-not-divisible: sql-database logicalShards with few divisors relative to physicalShards growth path (informational)
  - connection-pool-unsharded-at-scale: database-proxy pooling true, poolSharded false, physicalShards above threshold
  - migration-without-reversible-replication: data migration edges with reversible false while change.rollbackPath true
  - tree-traversal-in-warehouse: etl edge computing hierarchical permissions inside data-warehouse rather than a distributed compute node (informational)
  - online-read-from-analytics-lake: app-server read edge from object-store lake while data.freshnessOnlineSeconds is small
