# Intake: Spotify backend and event delivery (access points, Pub/Sub, Dataflow, data platform)

## Source
- Primary: https://engineering.atspotify.com/2013/03/backend-infrastructure-at-spotify (official, 2013: access points, Hermes/ZeroMQ, Cassandra, PostgreSQL, Memcached, datacenters)
- Primary: https://engineering.atspotify.com/2016/02/spotifys-event-delivery-the-road-to-the-cloud-part-i and https://engineering.atspotify.com/2016/03/spotifys-event-delivery-the-road-to-the-cloud-part-iii (official, 2016: old Kafka 0.7 + Hadoop pipeline and its failures; new Pub/Sub + Dataflow design)
- Primary: https://engineering.atspotify.com/2019/11/spotifys-event-delivery-life-in-the-cloud (official, 2019: 8M events/sec, isolation per event type)
- Primary: https://engineering.atspotify.com/2021/10/changing-the-wheels-on-a-moving-bus-spotify-event-delivery-migration (official, 2021: EDI redesign, client resends, dedup windows)
- Primary: https://engineering.atspotify.com/2024/05/data-platform-explained-part-ii (official, 2024: 1T events/day, 38K pipelines, K8s operators, Scio)
- Primary: https://engineering.atspotify.com/2019/12/views-from-the-cloud-a-history-of-spotifys-journey-to-the-cloud-part-1-2 (official, 2019: four DCs to GCP)
- Verified by: seven official Spotify engineering posts
- Confidence: high for event delivery and platform; medium for audio delivery path (only noted as CDN and, per press, AWS storage)
- Date of source: 2013-2024

## System in three lines
Music streaming client talks to a nearest-datacenter access point that fronts hundreds of microservices; audio bytes come from a CDN while metadata, playlists, search and recommendations come from services on GCP. Every client and service event flows through an Event Delivery Service into one Cloud Pub/Sub topic per event type, then Dataflow ETL into hourly buckets on Cloud Storage and BigQuery, feeding 38,000 scheduled pipelines. Hard because completeness of hourly data must be predictable across unreliable mobile clients, event volume grows faster than users, and one noisy event type must never stall the rest.

## Scale (only if stated)
- Users / DAU: not stated in these posts
- Requests per second: 700K events/sec (2016 old system); 1.5M to 8M events/sec peak (2016 to 2019)
- Data volume: 60B events/day (2016), 500B/day and 350+ TB raw/day (2019), 1T events/day (2024); 70 TB/day compressed (2021); 100+ PB on-prem before migration
- Message throughput: 500+ event types (2019), 600+ (2021), 1,800+ (2024); ~1,000 ETL jobs (2016)
- Pipelines: 20,000 daily runs (pre-2015), 38,000+ scheduled (2024); ~2,500 GCE VMs for ETL (2019)
- Fleet: four datacenters, ~2,000 services, 100 teams before GCP (2017-2018 migration)
- Latency: old ETL 2-3 h end-to-end; new watermark lag mostly under 200 s

## Requirements stated or clearly implied
- Availability target: "a noisy, broken, or blocked Event Type will not halt the rest of the system"; liveness over lateness
- Consistency: at-least-once delivery with deduplication (windows widened to multiple weeks); hourly buckets by event timestamp; late events shifted to current hour, never backfilled
- Latency target: "deliver complete data with a predictable latency"; minutes not hours
- Ordering needs: none across events; hourly bucket semantics
- Replay or reprocessing: Pub/Sub retention and GCS raw data allow reprocessing; Avro backward compatibility to "read up to 10 years of historical data with the same code"
- Retention: per data endpoint retention policies (2024)
- Compliance / residency: anonymisation pipelines; encryption of sensitive data in Dataflow
- Cost: explicit requirement after overconsumption; "unconstrained innovation and cost consciousness"

## Boundaries
- Regions / zones: four on-prem DCs (to 2018) then GCP regions; regional managed instance groups per event type; audio storage reported on AWS
- Trust zones: clients -> access points / Event Delivery API -> internal services (Hermes) -> data platform
- Named subsystems: Access points, Microservices (feature squads), Storage (Cassandra, PostgreSQL, Memcached), Event delivery (SDK, EDS, Pub/Sub, ETL, GCS, BigQuery), Data platform (Scio/Dataflow/Flink pipelines, K8s operators, Backstage), Audio delivery (CDN)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Clients | Desktop, mobile, web; SDK batches and resends events (immediately, minutes, days) | native, web | desktop-client, mobile-client, web-client, sdk-client | resend: true; offlineBuffer: true |
| 2 | Access point | Terminates client connections at nearest DC; routes to services | in-house | realtime-gateway | |
| 3 | Hermes | Internal RPC/messaging: ZeroMQ with protobuf envelope; request-reply, messaging, pubsub | Hermes (in-house) | service-mesh | transport: zeromq |
| 4 | Service discovery | DNS SRV based | DNS | service-registry | mechanism: dns-srv |
| 5 | Microservices | ~2,000 services owned by squads | in-house (Java, Python) | app-server | count: 2000 |
| 6 | Cassandra | Multi-site replicated storage | Apache Cassandra | nosql-database | replication: multi-site |
| 7 | PostgreSQL | Relational storage with multi-site clustering | PostgreSQL | sql-database | |
| 8 | Memcached | Cache | Memcached | cache | |
| 9 | Audio storage + CDN | Audio file storage and edge delivery | not named (press: AWS storage, CDN) | object-store + cdn | |
| 10 | Syslog + Kafka 0.7 + Groupers (legacy) | Log tailing, batching, transport with no broker persistence | Kafka 0.7 | stream (legacy) | brokerPersistence: false |
| 11 | Hadoop HDFS + Crunch ETL (legacy) | Sole persistence; hourly MapReduce to Avro | Hadoop | data-warehouse + etl-job (legacy) | |
| 12 | Event Delivery Service (EDS) | Highly available API for SDKs; parses event types; publishes to Pub/Sub | in-house | app-server | stateless: true; autoscaling: true |
| 13 | Cloud Pub/Sub | One topic per event type, isolation between types | Google Cloud Pub/Sub | pubsub-topic | topicsPerEventType: true; replay: true (retention) |
| 14 | ETL per event type | Dataflow (earlier GCE clusters) grouping into hourly buckets, dedup, encryption | Dataflow, Scio; earlier GCE MIGs + Dataproc + CloudSQL | stream-processor | isolationPerEventType: true |
| 15 | CloudSQL | ETL metadata (2016-2019 design) | Cloud SQL | sql-database | |
| 16 | Dataproc | Deduplication jobs | Dataproc | etl-job | |
| 17 | Cloud Storage | Raw, intermediate and final hourly datasets | GCS | object-store | |
| 18 | BigQuery | Warehouse, replaced Hive | BigQuery | data-warehouse | |
| 19 | Schema registry / Avro | Schema validation and backward-compatible evolution; propagation once took hours | in-house registry | schema-registry | format: avro |
| 20 | Pipeline orchestration | 38K scheduled pipelines on BigQuery, Flink, Dataflow; K8s operators; Backstage | Scio, Flink, K8s operators, Backstage | scheduled-job + workflow-engine | pipelines: 38000 |
| 21 | Data endpoints | Retention, access control, lineage, quality checks | in-house | data catalog, governance layer (not a runtime kind) | |
| 22 | Liveness monitoring | Detects stalled event types, watermark lag | in-house | monitoring | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | access-point | tcp/hermes | sync | | nearest DC |
| access-point | microservices | hermes/zeromq | sync | | request-reply |
| microservice | microservice | hermes | sync/async | | messaging and pubsub modes |
| microservice | cassandra / postgres / memcached | native | sync | | |
| client | cdn | https | sync | | audio chunks |
| cdn | audio-storage | https | sync | | origin |
| client sdk | eds | https | sync (with client retries) | at-least-once | resend immediately, minutes, days |
| microservice | eds (or file tailer) | https / local | async | at-least-once | |
| eds | pubsub (per event type) | pubsub | async | at-least-once | |
| pubsub | etl (per event type) | pubsub pull | async | at-least-once | hourly windows by event time |
| etl | gcs | gcs | async | | hourly buckets |
| etl | bigquery | bigquery | async | | |
| eds / etl | schema-registry | http | sync | | validation |
| gcs / bigquery | pipelines (38k) | batch | async | | scheduled |
| pipelines | data endpoints | batch | async | | retention, lineage |
| legacy: services | kafka 0.7 | kafka | async | at-most-once (no broker persistence) | kept on host until HDFS ack |
| legacy: kafka | hdfs | scp/hadoop | async | | hourly EOF checkpoints |

## Failure modes, incidents, tradeoffs the source discusses
- Single point of failure: "If Hadoop is down the whole event delivery system stalls"; catch-up limited by inter-DC bandwidth. Source: part I.
- Completeness tracking: "a machine dies it can't send an end-of-file message"; manual intervention. Source: part I.
- No broker persistence in Kafka 0.7; producers had to retain data until HDFS confirmation. Source: part I.
- Tight coupling: increasing volume caused cascading outages. Source: part I.
- Late data policy: events after bucket close are timestamp-shifted forward, not backfilled. Source: part III.
- Watermark unpredictability on failure; data loss risk if a streaming job update fails; ~1,000 per-type jobs to manage; manual scaling. Source: part III.
- Isolation per event type so "a noisy, broken, or blocked Event Type will not halt the rest of the system". Source: life-in-the-cloud.
- Cost: after two years abstracting cost, overconsumption recognised; "data grows faster than traffic". Source: life-in-the-cloud.
- Custom client libraries rot: "building and maintaining custom solutions can be hard, and software gets outdated very quickly." Source: life-in-the-cloud.
- Mobile fire-and-forget lost events; dedup window too narrow (widened to weeks); schema propagation took hours and blocked instrumentation for a week. Source: moving-bus.
- Long tail of old app versions forces dual systems for months. Source: moving-bus.
- Lift-and-shift first to protect streaming, rewrite data later. Source: views-from-the-cloud.

## Unknowns
- Audio delivery specifics (CDN vendor, chunking, DRM)
- Search and recommendation serving stack
- Pub/Sub retention settings
- Current access point implementation after GCP

## Candidates
- New kinds: none strictly new; sightings: pubsub-topic (2nd as kind, first with replay true), sdk-client (2nd, from Stripe), schema-registry (2nd), stream-processor (3rd), workflow-engine (2nd: K8s operators/Flyte class), scheduled-job (4th), object-store (8th), data-warehouse (6th), cdn (4th), service-mesh (4th), service-registry (3rd), realtime-gateway (6th), monitoring (7th)
- New properties on existing kinds: pubsub-topic.topicPerEventType (boolean), retention; stream-processor.windowing (event-time, processing-time), lateDataPolicy (drop, shift, backfill), isolationPerType (boolean); sdk-client.resendPolicy; schema-registry.compatibility (backward, forward, full)
- New edge properties: batchedByClient (boolean); dedupWindowDays (integer)
- New requirement paths: data.completenessWindow (hourly, daily); data.maxLatenessMinutes; cost.budgeted (boolean); isolation.perEventType (boolean)
- New rules:
  - shared-pipeline-across-event-types: single stream-processor consuming many event types while isolation.perEventType true
  - at-least-once-ingest-without-dedup: at-least-once client edge into pipeline with no dedup stage and dedupWindowDays absent
  - fire-and-forget-mobile-events: sdk-client edge to ingest API with resendPolicy none
  - batch-warehouse-as-single-persistence: pipeline where the only durable node is the warehouse (Hadoop SPOF pattern)
  - producer-side-schema-without-registry: many event producers and no schema-registry (2nd sighting after LinkedIn)
