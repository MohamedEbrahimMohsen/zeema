# Intake: Robinhood brokerage and crypto (application-level sharding, Kafka, 2020 outage)

## Source
- Primary: https://robinhood.com/us/en/newsroom/how-we-scaled-robinhoods-brokerage-system-for-greater-reliability/ (official, 2021: 100k to 750k rps, application-level sharding, routing and aggregation layers, Kafka filtering)
- Primary: https://robinhood.com/us/en/newsroom/scaling-robinhood-crypto-systems/ (official: Django/Postgres crypto backend, query fixes, full-stack sharding)
- Primary: https://robinhood.com/us/en/newsroom/an-update-from-robinhoods-founders/ (official, March 2020: thundering herd and DNS failure)
- Secondary: https://factorhouse.io/articles/robinhood-kafka-architecture (synthesis citing Kafka Summit 2021 and Confluent Current 2022-2025 talks by Robinhood engineers, WarpStream case study)
- Verified by: three official Robinhood posts + cited conference talks via secondary
- Confidence: high
- Date of source: 2020-2025

## System in three lines
Retail brokerage where equities and crypto orders flow from a mobile app through Django services on AWS into sharded Postgres, out to market makers and exchanges over Kafka hops with sub-second SLAs, and back through an in-house clearing system. When traffic grew 7.5x in six months the single database became the bottleneck, so Robinhood sharded the whole stack (app, cache, database) by user with a routing layer, an aggregation layer for cross-shard reads, and shard-aware Kafka consumers. Hard because volatility spikes load unpredictably, a thundering herd took out DNS in March 2020, and correctness of money movement cannot be traded for availability.

## Scale (only if stated)
- Users / DAU: 14M+ monthly active users
- Requests per second: brokerage 100k rps (Dec 2019) to 750k rps (June 2020); each shard "hundreds of thousands of requests/second"; 1 shard early 2020, 3 by end 2020, 10 later
- Data volume: Kafka 10+ TB/day
- Message throughput: Kafka 6 clusters, 160 brokers, 2.2M messages/sec, 90,000 partitions; 5-10 Kafka hops per equities trade under 1 s SLA
- Crypto DB fixes: 7x CPU reduction; queries per request from over 30 to 1; some queries 1000x faster with indexes; writes +50%, reads ~4x
- Logging: WarpStream migration 45% cost cut, latency 0.2 s to 0.45 s
- Kafka connections: gunicorn workers created 100,000+ broker connections before the sidecar proxy

## Requirements stated or clearly implied
- Availability target: "a stable service that's available when you need it the most"; blast radius reduced by service isolation per shard
- Consistency: Postgres transactional per shard; globally unique identifiers across shards; settlements extracted as a shared component; failed consumer events kept in a queryable Postgres DLQ, never dropped
- Latency target: equities execution under 1 s across 5-10 Kafka hops; card authorisation within a 2 s window
- Ordering needs: per-user events processed by the owning shard
- Replay or reprocessing: DLQ inspection and safe replay to retry topics; CDC 5-15 minute freshness into the lake
- Retention: not stated
- Compliance / residency: brokerage regulation, self-clearing (Robinhood Securities)
- Elasticity: load is cyclical with market hours; fixed-capacity clusters wasteful

## Boundaries
- Regions / zones: AWS; multi-AZ (inter-AZ network cost cited)
- Trust zones: mobile clients -> public load balancer -> routing layer -> shard (app, cache, DB) -> internal API proxy for inter-shard calls -> external market makers, exchanges, clearing
- Named subsystems: Routing layer and shard mapping service, Aggregation layer, Shards (Django, memcache, Postgres), Kafka clusters with Kafkaproxy sidecars, Stream processing (Faust, Flink), CDC (Debezium) to data lake, Settlements, Clearing, Logging (WarpStream)
- Group kind: cell (full-stack user shard) 4th sighting

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Mobile app | Trading client | iOS/Android | mobile-client | |
| 2 | Public load balancer | Entry and shard routing | AWS load balancer | load-balancer | |
| 3 | Shard mapping service | User to shard lookup, synchronous | in-house | coordination-service | |
| 4 | Routing layer | Sends request to the user's shard | in-house | api-gateway | shardKey: user |
| 5 | Aggregation layer | Stateless fan-out across shards, merges with custom pagination cursors | in-house | app-server (scatter-gather) | pattern: scatter-gather |
| 6 | Internal API proxy | Inter-shard traffic | in-house | api-gateway (internal) | |
| 7 | Brokerage services (per shard) | Django application servers | Django, Python (moving to Go) | app-server | perCell: true |
| 8 | Memcache (per shard) | Read caching for staleness-tolerant endpoints | memcached | cache | perCell: true |
| 9 | Postgres (per shard) | System of record per shard; read replicas | PostgreSQL on RDS | sql-database | sharded: true (application level); shards: 10 |
| 10 | Settlements component | Extracted and shared across shards | in-house | app-server | shared: true |
| 11 | Kafka clusters | Order routing, crypto, clearing, card auth backup path, notifications | Apache Kafka (on Kubernetes 2024) | stream | clusters: 6; brokers: 160 |
| 12 | Shard-specific topics | High-throughput flows get per-shard topics; others filter per message | Kafka | property of stream | |
| 13 | Kafkaproxy sidecar | Aggregates broker connections, owns consumer group lifecycle (Rust then Java/gRPC) | in-house | service-mesh (sidecar) | |
| 14 | Postgres-backed DLQ | Failed consumer messages stored, queried by failure reason, replayed | PostgreSQL | queue (dlq role) | queryable: true |
| 15 | Faust / Flink | Python and Java stream processing: risk, fraud, market data, order quality; 100+ Flink deployments | Faust (open source), Apache Flink | stream-processor | |
| 16 | Debezium CDC | RDS to data lake, 24 h to 5-15 min freshness | Debezium | change-data-capture | |
| 17 | Data lake | Analytics | S3-based (implied) | data-warehouse | |
| 18 | Market makers / exchanges / clearing | External execution and settlement counterparties; in-house clearing | third parties, Robinhood Securities | third-party-api | slaMs: 1000 |
| 19 | DNS | Internal service discovery that failed under thundering herd (2020) | not named | dns | |
| 20 | WarpStream | Diskless S3-backed Kafka-compatible logging clusters | WarpStream | stream (object-store backed) + object-store | |
| 21 | pganalyze / Jaeger | Query analysis and tracing | pganalyze, Jaeger | monitoring + tracing | |
| 22 | Kubernetes | Hosts services and Kafka via custom operator | Kubernetes | ops platform, not tallied | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| mobile-app | public-lb | https | sync | | |
| public-lb | routing-layer | http | sync | | |
| routing-layer | shard-mapping | rpc | sync | | |
| routing-layer | shard services | http | sync | | user's shard |
| aggregation-layer | all shards | http | sync | | fan-out, merge cursors |
| shard service | shard postgres | sql | sync | | |
| shard service | shard memcache | memcached | sync | | |
| shard service | internal-api-proxy | http | sync | | cross-shard |
| shard service | kafka (order topics) | kafka via kafkaproxy | async | at-least-once | 5-10 hops per trade |
| kafka | shard consumers | kafka | async | at-least-once | filter or shard topics |
| consumer | postgres-dlq | sql | sync | | on failure |
| postgres-dlq | retry topic | kafka | async | | replay |
| kafka | market makers / exchanges | fix / api | async | | execution |
| kafka | clearing | kafka | async | | in-house |
| kafka | faust / flink | kafka | async | | risk, fraud |
| postgres rds | debezium | logical decoding | async | at-least-once | |
| debezium | kafka | kafka | async | | |
| kafka | data lake | batch | async | | 5-15 min |
| services | dns | udp | sync | | 2020 failure point |
| services | warpstream | kafka protocol | async | | logs |

## Failure modes, incidents, tradeoffs the source discusses
- March 2020: "stress on our infrastructure, which struggled with unprecedented load. That in turn led to a 'thundering herd' effect, triggering a failure of our DNS system"; remediation: resilience, fewer interdependencies, redundancies. Source: founders update.
- Single database ceiling: vertical scaling had diminishing returns; 7.5x traffic in six months. Source: brokerage post.
- Isolation over efficiency: application-level sharding chosen "to increase reliability through service isolation, decreasing the blast radius"; all shards consume all topics and filter, "not the most efficient method, but it saved us from building yet another proxy layer". Source: brokerage post.
- Rejected distributed SQL: Spanner, DynamoDB, Citus, CockroachDB "would require invasive rewrites of core business logic and data access layers". Source: brokerage post.
- Crypto DB contention: "the primary database and its read replica became the performance bottlenecks"; 30+ queries per request cut to 1; precompute on write; memcache for stale-tolerant reads. Source: crypto post.
- Full-stack sharding (app + cache + DB) for crypto to reduce blast radius; settlements extracted. Source: crypto post.
- Connection explosion: gunicorn workers opened 100,000+ broker connections; sidecar proxy fixed it. Source: factorhouse citing talks.
- Failed events must be inspectable: Postgres-backed DLQ rather than a second topic. Source: factorhouse citing Current 2022.
- Cyclical load makes fixed Kafka capacity wasteful; diskless logging cut cost 45% at 2x latency. Source: factorhouse citing WarpStream.

## Unknowns
- Exact order management and matching path to market makers
- Clearing system internals
- Shard rebalancing and user migration process
- Current Go service share

## Candidates
- New kinds: none strictly new; sightings: cell group (4th), coordination-service (9th: shard mapping), api-gateway (12th), sql-database (20th), cache (16th), stream (15th), stream-processor (8th), change-data-capture (6th), queue (10th: DLQ role), service-mesh (6th: Kafkaproxy sidecar), third-party-api (3rd), dns (4th), data-warehouse (10th), monitoring (13th), tracing (4th)
- New properties on existing kinds: queue.role (work, dlq, offline-mailbox), queryable (boolean); stream.topicPerShard (boolean), consumerFiltering (boolean), connectionProxy (boolean); app-server.sharedAcrossCells (boolean); cache.perCell (2nd sighting); sql-database.shardingLevel (application, database)
- New edge properties: hopsToExecution (integer); filterPerMessage (boolean)
- New requirement paths: latency.executionMs; availability.discoveryRedundant (boolean); traffic.cyclical (boolean)
- New rules:
  - shared-dependency-without-redundancy: dns or coordination-service single node while availability.discoveryRedundant true (2020 DNS)
  - many-workers-direct-to-brokers: app-server with per-process broker connections above threshold and no connection proxy (informational)
  - dlq-not-inspectable-for-money-flows: consumer of payment/order topics with dlq role queue lacking queryable true (informational)
  - execution-sla-vs-hop-count: latency.executionMs set and async hops between order intake and third-party execution above threshold
  - single-db-per-stack-under-cyclical-peaks: sql-database unsharded with traffic.cyclical true and peakMultiplier high
