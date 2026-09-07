# Intake: Airbnb search and SOA platform (data services, CDC, derived data, authorization)

## Source
- Primary: https://infoq.com/presentations/airbnb-soa-migration (Jessica Tai, Airbnb, QCon 2018/2019: Monorail to SOA, layers, SpinalTap, dual reads)
- Primary: https://www.infoq.com/news/2019/03/building-services-airbnb (write-up of Airbnb service-building practices)
- Primary: https://www.infoq.com/news/2021/05/airbnb-himeji (write-up of official Himeji post; official at https://medium.com/airbnb-engineering/himeji-a-scalable-centralized-system-for-authorization-at-airbnb-341664924574, 403 in this pass)
- Primary: Airbnb Mussel post https://medium.com/airbnb-engineering/mussel-airbnbs-key-value-store-for-derived-data-406b9fa1b296 and SpinalTap post https://medium.com/airbnb-engineering/capturing-data-evolution-in-a-service-oriented-architecture-72f7c643ee6f (both 403 in this pass; used via https://factorhouse.io/articles/airbnb-kafka-architecture/ which cites them and Kafka Summit talks)
- Primary: https://ar5iv.labs.arxiv.org/html/1810.09591 (Airbnb paper: Applying Deep Learning to Airbnb Search; ranking only)
- Verified by: two conference talks by Airbnb engineers + official posts (via write-ups) + peer-reviewed paper
- Confidence: high for SOA platform, CDC, Himeji; medium for the listing search serving path (Elasticsearch use confirmed for review and inbox search; listing index internals not public)
- Date of source: 2018-2022

## System in three lines
Marketplace search over millions of listings with availability, pricing and ML ranking, served by a service-oriented platform that replaced a Rails monolith. Every database mutation is captured by SpinalTap into Kafka and fans out to search indexes, derived-data stores (Mussel), materialised views and the warehouse; authorization is centralised in Himeji at the data-service layer. Hard because search freshness depends on CDC latency, derived data must merge batch and real-time writes, and hundreds of services must not each reimplement auth.

## Scale (only if stated)
- Users / DAU: not stated
- Requests per second: Himeji 850K entity checks/sec; Mussel 100K+ streaming writes/sec; User Signals Platform 1M+ events/sec via 100+ Flink jobs
- Data volume: 35B+ Kafka messages/day and 1,000+ tables/day into Hive; Riverbed 2.4B events/day
- Services: 250+ services, 1,000+ endpoints (2019); deploys 3,000/week to 10,000/week
- Latency: Himeji p99 12 ms, 98% cache hit; search page 3x faster and home description 10x faster after Java services
- Monolith pain: ~200 commits/day, ~15 h/day deploy blocked by reverts (2015)

## Requirements stated or clearly implied
- Availability target: Himeji 99.999%
- Consistency: data services own their data exclusively; derived data eventually consistent via CDC; Mussel timestamp-based conflict resolution between batch and real-time writes; cache invalidation by CDC events
- Latency target: authorization p99 12 ms; search interactive
- Ordering needs: CDC preserves per-source mutation order (binlog)
- Replay or reprocessing: Kafka as write-ahead log for Mussel; batch bulk loads from Hive rebuild derived data
- Retention: not stated
- Compliance / residency: not stated

## Boundaries
- Regions / zones: AWS; VPC migration gave 4x Kafka throughput
- Trust zones: clients -> API gateway -> presentation services -> data services; authorization enforced at data-service layer
- Named subsystems: Monorail (legacy), API gateway, Presentation / Middle-tier / Derived-data / Data services, SpinalTap CDC, Kafka clusters (analytics, CDC, inter-service), Search indexing (Elasticsearch), Mussel, Himeji, Riverbed, Airstream/Flink, Hive warehouse, ranking models

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Web / mobile clients | Publish logging events directly to Kafka too | web, iOS, Android | web-client, mobile-client | |
| 2 | API gateway | Routes client requests into the service network | in-house | api-gateway | |
| 3 | Presentation services | Compose lower layers for a UI surface (search results page, listing page) | Java, Thrift IDL | app-server | asyncRpc: true |
| 4 | Middle-tier utility services | Shared validation and business rules | Java | app-server | |
| 5 | Derived-data services | Read many data services plus offline stores; e.g. demand prediction | Java | app-server | |
| 6 | Data services | Exclusive owner of one database; other services go through its API | Java | app-server | ownsData: true |
| 7 | Monorail | Legacy Rails monolith, drained per endpoint and per attribute | Ruby on Rails | app-server | |
| 8 | MySQL | Primary datastores behind data services | MySQL | sql-database | |
| 9 | Amazon Aurora | Himeji durable store | Aurora | sql-database | |
| 10 | DynamoDB | Some data services; CDC via streams | DynamoDB | nosql-database | |
| 11 | SpinalTap | CDC: parses MySQL binlog and DynamoDB streams, emits Thrift mutation events to Kafka | SpinalTap (open source) | change-data-capture (new) | sources: mysql-binlog, dynamodb-streams; format: thrift |
| 12 | Kafka (CDC cluster) | Mutation event bus | Apache Kafka | stream | |
| 13 | Kafka (analytics cluster) | Logging events from clients and services | Apache Kafka | stream | messagesPerDay: 35e9 |
| 14 | Kafka (inter-service cluster) | Async messaging between services | Apache Kafka | stream | |
| 15 | Search indexing service | Consumes CDC, updates Elasticsearch asynchronously | in-house | worker | |
| 16 | Elasticsearch | Review search, inbox search; listing search backend not confirmed | Elasticsearch | search-index | |
| 17 | Ranking model service | GBDT then deep neural network ranking of listings | in-house (TensorFlow) | ml-inference (new) | |
| 18 | Mussel | KV store for derived data: HBase/HFile bulk loads from Hive plus Kafka real-time writes, timestamp conflict resolution | Mussel (HBase based) | nosql-database | writesPerSec: 100000; batchAndRealtime: true |
| 19 | Himeji | Centralised authorization: orchestration layer, sharded replicated in-memory cache, Aurora; Zanzibar-style tuples; cache invalidated by SpinalTap events | Himeji | authorization-service (new) | rps: 850000; p99Ms: 12; cacheHitRate: 98; availability: 99.999 |
| 20 | Riverbed | Materialised views from CDC events | in-house | worker (stream-processor) | eventsPerDay: 2.4e9 |
| 21 | Airstream / Spark Streaming | Kafka to Hive hourly with HBase dedup | Spark Streaming, HBase | stream-processor (new) | |
| 22 | Flink jobs (User Signals Platform) | 100+ jobs, 1M+ events/sec | Apache Flink | stream-processor (new) | |
| 23 | Hive | Data warehouse | Hive | data-warehouse | |
| 24 | Airflow + Spark | Data migration tooling for Himeji onboarding | Airflow, Spark | scheduled-job + etl-job | |
| 25 | Zookeeper | SpinalTap checkpointing and leader election (per SpinalTap README) | Zookeeper | coordination-service | |
| 26 | Diffy | Compare staging vs production responses (migration) | Diffy (Twitter) | ops tooling, not tallied | |
| 27 | Kubernetes | Scaling beyond EC2 clusters | Kubernetes | ops platform, not tallied | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | api-gateway | https | sync | | |
| api-gateway | presentation-service | thrift | sync | | |
| presentation-service | derived-data / middle-tier / data services | thrift | sync (async RPC fan-out) | | multithreaded java, parallel calls |
| data-service | mysql / dynamodb | sql / dynamo | sync | | exclusive owner |
| data-service | himeji | thrift | sync | | authorization check per access |
| himeji-orchestration | himeji-cache | internal | sync | | 98% hit |
| himeji-cache | aurora | sql | sync | | miss path |
| mysql binlog | spinaltap | binlog stream | async | at-least-once | ordered per source |
| dynamodb streams | spinaltap | streams | async | at-least-once | |
| spinaltap | kafka-cdc | kafka | async | at-least-once | thrift events |
| spinaltap | zookeeper | zk | sync | | checkpoints, leader |
| kafka-cdc | search-indexer | kafka | async | at-least-once | |
| search-indexer | elasticsearch | http | sync | | |
| kafka-cdc | himeji-cache | kafka | async | at-least-once | invalidation |
| kafka-cdc | mussel | kafka | async | at-least-once | write-ahead log |
| hive | mussel | hfile bulk load | async | | batch, merged by timestamp |
| kafka-cdc | riverbed | kafka | async | | materialised views |
| kafka-analytics | airstream / flink | kafka | async | | |
| airstream | hive | hourly partitions | async | | dedup in hbase |
| presentation-service | ranking-model | thrift | sync | | |
| monorail | data services (via activerecord adapter) | thrift | sync | | migration shim |
| client | kafka-analytics | https | async | at-most-once | logging events |

## Failure modes, incidents, tradeoffs the source discusses
- Monolith entanglement: "Modules began to assume too many responsibilities and became highly dependent on one another"; ~15 h/day deploy blocked. Source: soa-migration.
- Migration safety: dual reads compared behind gates from 1% to 100%; writes to shadow databases; "Compare slowly, carefully, and piecemeal." Source: soa-migration.
- SOA costs: more network hops raise latency and failure modes; distributed consistency across many databases; tracing overhead; Kubernetes needed. Source: soa-migration.
- Duplicated auth: presentation services had duplicate checks that "became out of sync"; moved to data services and centralised in Himeji. Source: himeji.
- Cache consistency by CDC: Himeji cache invalidated by SpinalTap events, not TTL. Source: himeji.
- Micro-batch latency: Spark Streaming "event delays" incompatible with real-time needs; moved to Flink. Source: factorhouse citing Kafka Summit.
- One-record-at-a-time throughput bottleneck in Evergreen; concurrent-write races in Riverbed when mutations trigger simultaneous updates. Source: factorhouse.
- Batch vs real-time merge: Mussel resolves conflicts by timestamp between bulk loads and streaming writes. Source: factorhouse citing Mussel post.
- Search ranking plateau with GBDT; neural networks to break out. Source: arxiv.

## Unknowns
- Listing search serving stack (index product, availability calendar store, pricing service) not public in detail
- Kafka retention and replay policies per cluster
- Himeji cross-region behaviour
- Service mesh or discovery product

## Candidates
- New kinds: change-data-capture (SpinalTap, Debezium, DMS), authorization-service (Himeji, Zanzibar, SpiceDB, OPA), stream-processor (Flink, Spark Streaming, Kafka Streams), ml-inference (ranking model serving); sightings: stream (5th), search-index (4th), coordination-service (4th), data-warehouse (4th), scheduled-job (2nd: Airflow), nosql-database (8th), api-gateway (7th)
- New properties on existing kinds: app-server.ownsData (boolean, data-service layer); app-server.layer (presentation, middle-tier, derived-data, data); nosql-database.batchAndRealtime (boolean); cache.invalidation (ttl, event, none); stream.cluster (analytics, cdc, inter-service)
- New edge properties: cdcDerived (boolean); asyncRpc / parallelFanout (boolean)
- New requirement paths: authorization.centralised (boolean); data.ownershipExclusive (boolean); freshness.maxSeconds (for derived data and indexes)
- New rules:
  - shared-database-across-services: two app-server nodes with write edges to the same sql-database while data.ownershipExclusive true
  - derived-store-without-cdc-or-rebuild: search-index or derived nosql-database with no incoming CDC/stream edge and no batch rebuild edge
  - cache-with-ttl-only-under-freshness-target: cache invalidation ttl while freshness.maxSeconds is below ttlSeconds
  - authorization-in-presentation-layer: authorization-service edges only from presentation-layer services, none from data layer (duplication risk)
  - micro-batch-processor-under-realtime-target: stream-processor mode micro-batch while freshness.maxSeconds is small
