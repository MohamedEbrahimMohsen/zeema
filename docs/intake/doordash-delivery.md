# Intake: DoorDash order and delivery platform (microservices, CockroachDB, Iguazu, Cadence)

## Source
- Primary: https://careersatdoordash.com/blog/how-doordash-transitioned-from-a-monolith-to-microservices/ (official, 2020; host returned 403 in this pass, content used via https://blog.neetcode.io/p/doordash-robust-microservices which cites it and the 2022 reliability post)
- Primary: https://www.cockroachlabs.com/blog/aurora-postgres-to-cockroachdb/ (vendor post quoting DoorDash storage engineer Sean Chittenden and Mike Salvatori, 2022-2023)
- Primary: https://qconsf.com/presentation/oct2022/zero-hundred-billion-building-scalable-real-time-event-processing-doordash (Allen Wang, DoorDash, QCon SF 2022: Iguazu)
- Primary: https://www.infoq.com/presentations/fabricator-ml/ (Kunal Shah, DoorDash, QCon SF 2022: Fabricator)
- Primary (blocked 403, cited via search summaries): https://careersatdoordash.com/blog/building-reliable-workflows-cadence-as-a-fallback-for-event-driven-processing/ and https://careersatdoordash.com/blog/leveraging-cockroachdbs-change-feed-for-real-time-inventory-data-processing/
- Secondary: https://factorhouse.io/articles/doordash-kafka-architecture (synthesis citing DoorDash posts and talks)
- Verified by: two DoorDash conference talks + vendor post with DoorDash engineer quotes + official posts via write-ups
- Confidence: medium-high (several official posts unreadable in this pass; numbers taken from talks and cited secondary)
- Date of source: 2020-2024

## System in three lines
Three-sided marketplace (consumers, merchants, Dashers) rebuilt from a Python 2 monolith on one Aurora Postgres cluster into Kotlin gRPC microservices in five layers, with CockroachDB as the multi-writer system of record and Kafka (Iguazu) as the event backbone feeding Flink, Snowflake and ML features. Order fulfilment is event-driven with Cadence workflows as the fallback for failed deliveries. Hard because peak demand grew past a single-writer database, retries and cascades took the site down, and dispatch is an ML optimisation problem over live supply.

## Scale (only if stated)
- Users / DAU: not stated
- Requests per second: main database cluster "more than 1.6 million queries per second" at April 2020 peak (crashed for hours)
- Data volume: not stated
- Message throughput: Kafka 5 clusters, 2,500+ topics, ~6B messages/day, peaks 12B (factorhouse); Iguazu "hundreds of billions of events per day" at 99.99% delivery, minutes to Snowflake
- ML features: 2,000+ features, ~1 trillion values/day, 500 jobs (Fabricator); "100+ billion feature values per day" served via Redis (factorhouse)
- Outage: May 2022 cascading failure lasting 3 hours

## Requirements stated or clearly implied
- Availability target: no order-checkout outages; 99.99% event delivery
- Consistency: CockroachDB serialisable multi-writer; Cadence guarantees workflow completion with retries; Kafka at-least-once
- Latency target: warehouse latency minutes; feature serving low latency via Redis; dispatch real time
- Ordering needs: per-key Kafka partitions; changefeeds ordered per row
- Replay or reprocessing: Kafka retention plus S3 Parquet buffer "independent of Kafka retention"; Cadence retries
- Retention: not stated
- Compliance / residency: not stated
- Test isolation: test traffic flows through production topics with tenant headers (OpenTelemetry context)

## Boundaries
- Regions / zones: AWS; multi-AZ implied; no region detail
- Trust zones: clients -> BFF layer -> web application services -> platform services -> infrastructure
- Named subsystems: Five-layer service stack, Storage (Aurora legacy, CockroachDB), Iguazu (REST proxy, Kafka, Flink, S3, Snowpipe, Snowflake), Fabricator (Dagster, Spark/Databricks, Flink SQL, Redis feature store), Cadence workflows, DeepRed dispatch, Reliability (Aperture, autoscaling)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Consumer, Dasher, Merchant apps | Mobile and web clients; also event producers | native, web | mobile-client, web-client | |
| 2 | Frontend / BFF layer | Backend-for-frontend per surface | Kotlin, gRPC | api-gateway (BFF) | |
| 3 | Web application services | Business logic per domain | Kotlin, gRPC | app-server | stateless: true; rpc: grpc |
| 4 | Platform services | Shared capabilities (identity, payments, etc.) | Kotlin | app-server | |
| 5 | Python 2 monolith (legacy) | Everything, retired via strangler fig | Django | app-server | |
| 6 | Aurora Postgres (legacy) | Single cluster, single writer; extracted per-domain clusters then replaced | AWS Aurora | sql-database | replication: single-writer |
| 7 | CockroachDB | Multi-writer distributed SQL; automated lossless table migration | CockroachDB | sql-database (distributed) | multiWriter: true; consistency: serializable |
| 8 | CockroachDB changefeed | Row change stream to Kafka for inventory pipeline | CockroachDB CDC | change-data-capture | |
| 9 | Kafka REST proxy | Event ingestion endpoint for clients and services (extended Confluent proxy) | Confluent REST proxy | api-gateway | |
| 10 | Kafka clusters | 5 clusters, 2,500+ topics; multi-tenant headers; sticky partitioner | Apache Kafka | stream | clusters: 5; topics: 2500 |
| 11 | Schema validation | Protobuf end-to-end schema enforcement, Avro conversion | in-house | schema-registry | format: protobuf |
| 12 | Flink processing | DataStream and Flink SQL/YAML (Riviera) consumers | Apache Flink | stream-processor | |
| 13 | S3 Parquet buffer | Durable buffer before Snowpipe | Amazon S3 | object-store | |
| 14 | Snowflake | Warehouse via Snowpipe | Snowflake | data-warehouse | |
| 15 | Drive delivery service | Consumes order events, creates deliveries; on failure starts Cadence workflow | Kotlin | app-server | |
| 16 | Cadence | Durable workflows as fallback with retries; UI for successes/failures; Minions orchestration | Cadence | workflow-engine | |
| 17 | Fabricator | YAML feature registry, Dagster orchestration, Spark on Databricks, Flink SQL, Delta Lake | in-house | scheduled-job + etl-job | features: 2000 |
| 18 | Redis feature store | Online feature serving | Redis | cache (feature-store role) | |
| 19 | ML inference / DeepRed | Dispatch engine matching Dashers and orders via ML and optimisation | in-house | ml-inference | |
| 20 | Aperture | Global load shedding, adaptive concurrency limits, circuit breaking decisions from system-wide state | Aperture (open source) | rate-limiter (adaptive) | scope: global |
| 21 | Predictive autoscaling | Scale ahead of anticipated traffic | in-house | property of app-server | autoscaling: predictive |
| 22 | Chronosphere / OpenTelemetry | Metrics and context propagation | Chronosphere, OTel | monitoring + tracing | |
| 23 | RabbitMQ (legacy) | Task queue that "repeatedly went down under heavy order volume" | RabbitMQ | queue | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | bff | https | sync | | |
| bff | web-app services | grpc | sync | | aperture limits |
| web-app services | platform services | grpc | sync | | circuit breakers |
| services | cockroachdb | postgres wire | sync | | multi-writer |
| services (legacy) | aurora | postgres via pgbouncer | sync | | single writer bottleneck |
| order service | kafka (order topic) | kafka | async | at-least-once | |
| kafka | drive service | kafka | async | at-least-once | |
| drive service | cadence | grpc | async | durable | on failure |
| cadence | drive service (activities) | grpc | async | retried | |
| cockroachdb | changefeed -> kafka | cdc | async | at-least-once | inventory |
| client / services | kafka rest proxy | https | sync | | events |
| rest proxy | kafka | kafka | async | at-least-once | schema validated |
| kafka | flink | kafka | async | at-least-once | |
| flink | s3 | parquet | async | | buffer |
| s3 | snowflake | snowpipe | async | | minutes |
| dagster | spark / flink jobs | orchestration | async | | features |
| spark / flink | redis feature store | redis | async | | materialise |
| ml-inference | redis feature store | redis | sync | | online features |
| dispatch (deepred) | ml-inference | grpc | sync | | |
| services | aperture | in-process / agent | sync | | shed, break |
| legacy services | rabbitmq | amqp | async | | replaced by kafka |

## Failure modes, incidents, tradeoffs the source discusses
- Single writer: "only a single node can serve writes"; April 2020 peak 1.6M QPS crashed the cluster for hours, a "success disaster". Source: cockroachlabs.
- Whack-a-mole: extracting tables into separate Aurora clusters "still playing 'whack-a-mole' with database issues". Source: cockroachlabs.
- Cascading failure May 2022, 3 hours: database latency propagated through dependents. Source: neetcode citing DoorDash.
- Retry storms, death spiral, metastable failures ("Thundering Herd" where rate-limited retries re-trigger shedding). Source: neetcode citing DoorDash.
- Mitigations: load shedding with adaptive concurrency, circuit breaking, predictive autoscaling, global view via Aperture. Source: neetcode citing DoorDash.
- RabbitMQ "repeatedly went down under heavy order volume... causing customer-facing outages"; replaced by Kafka 2019. Source: factorhouse.
- Durable buffer: Flink writes S3 Parquet as "a durable buffer independent of Kafka retention". Source: factorhouse.
- Producer tuning: sticky partitioner with linger 50-100 ms cut broker CPU 30-40%. Source: factorhouse.
- Event-driven with workflow fallback: failed delivery creation hands off to Cadence for retries and visibility. Source: cadence post via search.
- Open source over proprietary for Iguazu to customise and integrate. Source: qcon.

## Unknowns
- Exact CockroachDB cluster count and node sizes
- Cell or region topology
- Dispatch service internals beyond ML framing
- Cadence deployment scale

## Candidates
- New kinds: none strictly new; sightings: workflow-engine (3rd: Cadence), rate-limiter (3rd: Aperture adaptive), change-data-capture (5th), schema-registry (3rd), stream-processor (5th), ml-inference (2nd), tracing (3rd), queue (6th), sql-database distributed flavour (CockroachDB, Spanner) as component family
- New properties on existing kinds: sql-database.multiWriter (boolean), distributed (boolean); rate-limiter.adaptive (boolean), scope global; app-server.autoscaling predictive; stream.multiTenant (boolean); cache.role feature-store
- New edge properties: retryPolicy (3rd sighting); fallbackWorkflow (boolean)
- New requirement paths: availability.cascadeContainment (boolean); traffic.peakMultiplier (2nd sighting)
- New rules:
  - retry-without-adaptive-shedding: retrying edges into a service with no rate-limiter or circuit breaker (retry storm)
  - single-writer-primary-at-peak-qps: sql-database multiWriter false with stated qps above threshold
  - event-consumer-without-failure-workflow: async consumer creating business entities with no fallbackWorkflow or dlq (2nd sighting after queue-missing-dlq)
  - stream-sink-without-durable-buffer: stream-processor writing to warehouse with no object-store buffer while lossDetection true
  - shared-fate-task-queue: queue product with known crash-under-load history used for checkout path (informational)
