# Intake: Uber real-time dispatch and marketplace

## Source
- Primary: https://highscalability.com/how-uber-scales-their-real-time-market-platform/ (detailed write-up of Matt Ranney, Chief Systems Architect, QCon London 2015 talk)
- Primary talk page: https://www.infoq.com/presentations/uber-market-platform/
- Secondary: https://joshclemm.com/writing/a-brief-history-of-scaling-uber/ (ex-Uber engineer, architecture evolution 2009-2023)
- Secondary: https://www.uber.com/us/en/blog/h3/ (official, H3 geospatial index)
- Verified by: conference talk by Uber chief architect + official engineering blog + ex-employee retrospective
- Confidence: high
- Date of source: 2015 (core dispatch), 2023 (evolution)

## System in three lines
Matches dynamic supply (drivers) with dynamic demand (riders) in real time across cities. Both sides move continuously; driver phones report location every 4 seconds. Hard because matching is a distributed travelling-salesman problem under a strict availability requirement with low switching cost for users.

## Scale (only if stated)
- Users / DAU: not stated
- Requests per second: geospatial index design goal 1,000,000 writes/sec, reads "many multiples" of that
- Data volume: trip data is majority of storage and fastest growing
- Message throughput: location update every 4 s per online driver; thousands of dispatch nodes, hundreds of geospatial processes
- Fleet (2023): 250,000+ on-prem servers, 4,000+ stateless microservices

## Requirements stated or clearly implied
- Availability target: "Availability matters a lot. Uber has competitors and switching costs are very low." Must survive full datacenter loss.
- Consistency: AP over CP. "Better to be up and occasionally make an error."
- Latency target: low, not quantified; minimise rider wait and driver idle time. TChannel chosen because "20 times faster than HTTP".
- Ordering needs: not stated
- Replay or reprocessing: trip state recoverable from driver phone after datacenter failure
- Retention: not stated
- Compliance / residency: not stated
- Idempotency: "Make everything retryable... dispatch can't dispatch twice or charge twice."

## Boundaries
- Regions / zones: multiple datacenters, active plus backup, failover via network switches
- Trust zones: mobile clients (untrusted edge) -> RTAPI gateway -> internal services
- Named subsystems: Dispatch (supply, demand, DISCO, geospatial), Routing/ETA, Business logic (Python), Post-trip pipeline, Marketplace data layer

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Driver app | Sends location every 4 s; holds encrypted trip state digest as backup store | iOS/Android native | mobile-client (new) | updateIntervalSeconds: 4; storesStateDigest: true |
| 2 | Rider app | Requests rides | iOS/Android native | mobile-client (new) | |
| 3 | RTAPI / Edge Gateway | Real-time API gateway for mobile; later replaced by Edge Gateway with edge/presentation/product/domain layers | Node.js RTAPI (2014), Edge Gateway (2020) | api-gateway | |
| 4 | Dispatch | Core matching engine, stateful, sharded across nodes | Node.js | app-server | stateless: false; instances: thousands |
| 5 | Supply service | Vehicle capabilities and state machines | Node.js | app-server | stateless: false |
| 6 | Demand service | Rider requirements and orders | Node.js | app-server | stateless: false |
| 7 | DISCO | Dispatch optimisation, route revision, future planning | in-house | app-server | |
| 8 | Geospatial index | In-memory location index of all online drivers, sharded by Ringpop; DB only cold storage | Google S2 level 12 cells, later H3 | geospatial-index (new) | inMemory: true; cellLevel: 12; writesPerSec: 1000000 |
| 9 | Ringpop | Consistent hash ring + SWIM gossip for application-layer sharding of stateful Node services | Ringpop (open source) | sharding-coordinator (new) | protocol: swim-gossip; hashing: consistent |
| 10 | TChannel / Hyperbahn | Bidirectional RPC protocol with backup-request cancellation; Hyperbahn is the service mesh | TChannel, Hyperbahn, Thrift IDL | service-mesh (new) | backupRequests: true; transport: tchannel |
| 11 | Routing / ETA service | Computes ETAs, ranks candidates | Python, C++, Java | app-server | |
| 12 | Business logic services | Trip workflows, pricing, payments | Python, later Java/Go | app-server | count: ~100 (2014), thousands later |
| 13 | Post-trip pipeline | Ratings, emails, payment scheduling | Python | worker (new) | |
| 14 | Redis | Caching; some behind Twemproxy | Redis, Twemproxy | cache | |
| 15 | PostgreSQL | Legacy system of record; single instance became bottleneck | PostgreSQL | sql-database | replication: none (2014 incident) |
| 16 | MySQL / Schemaless | Append-only sharded hash map on MySQL for trip data | Schemaless (in-house on MySQL) | nosql-database (new) | sharded: true; appendOnly: true |
| 17 | Riak | Dispatch state persistence; chosen for failure resilience | Riak | nosql-database (new) | consistency: eventual |
| 18 | Cassandra | Marketplace and dispatch database replacing other stores | Apache Cassandra | nosql-database (new) | consistency: eventual |
| 19 | Kafka | Data hub, event streaming, trace transport | Apache Kafka | stream (new) | |
| 20 | Cadence | Fault-tolerant workflow orchestration | Cadence (open source) | workflow-engine (new) | |
| 21 | Flipr | Feature flags | Flipr (in-house) | feature-flag-service (new) | |
| 22 | M3 | Metrics | M3 (open source) | monitoring (new) | |
| 23 | Jaeger / Merckx | Distributed tracing over Kafka | Jaeger | tracing (new) | |
| 24 | Presto / Spark / Hudi | Analytics and data pipelines | Presto, Spark, Apache Hudi | data-warehouse (new), etl-job (new) | |
| 25 | Spanner | Fulfillment platform system of record (2021 rewrite) | Google Cloud Spanner | sql-database | replication: sync; multiRegion: true |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| driver-app | rtapi | https/mobile | async | at-least-once | location every 4 s |
| rider-app | rtapi | https | sync | | ride request |
| rtapi | dispatch | tchannel/thrift | sync | | |
| dispatch | geospatial-index | tchannel/thrift | sync | | location writes, 1M/s goal |
| disco | geospatial-index | tchannel/thrift | sync | | coarse candidate filter |
| geospatial-index | routing-eta | tchannel/thrift | sync | | candidate ranking, high fan-out |
| routing-eta | supply | tchannel/thrift | sync | | driver offers |
| dispatch | driver-app | encrypted state digest | async | | periodic trip state backup |
| driver-app | dispatch | state digest | sync | | restore after datacenter failover |
| dispatch | riak | riak client | sync | | state persistence |
| ringpop-node | ringpop-node | tchannel gossip | async | | membership, health |
| business-logic | postgres | sql | sync | | legacy |
| business-logic | schemaless | mysql | sync | | trip data |
| services | kafka | kafka | async | at-least-once | events, traces |
| kafka | post-trip-pipeline | kafka | async | at-least-once | |
| kafka | data-warehouse | kafka/batch | async | | analytics |

## Failure modes, incidents, tradeoffs the source discusses
- Double dispatch under concurrency (2009 LAMP era): "we'd dispatch two cars to one person or one driver would be matched to two different riders". Source: joshclemm.
- Single PostgreSQL bottleneck: "6 months away from Halloween night, one of the biggest nights of the year". Led to Schemaless. Source: joshclemm.
- Datacenter loss handled without replication: "Rather than replicate data they use driver phones as a source of trip data". Source: highscalability.
- Fan-out amplifies small failures: "Tiny blips and glitches have a surprisingly large impact" in fan-out systems. Source: highscalability.
- Tail latency: backup requests with cross-server cancellation built into TChannel. Source: highscalability.
- Crash-only design, no graceful shutdown; load balancers and databases killed in testing to prove client-side routing and recovery. Source: highscalability.
- City-based sharding abandoned because of imbalance; replaced by supply/demand abstraction. Source: highscalability.
- Fixed S2 cell size limits geospatial query optimisation. Source: highscalability.
- Original dispatch assumed one driver one rider; could not model food or packages; rewrite. Source: joshclemm.
- Thousands of microservices produced duplication: "Five or six systems that do incentives that are 75 percent similar". Source: joshclemm.
- Custom data framework replaced by managed Spanner for reliability and operational cost. Source: joshclemm.

## Unknowns
- Exact latency targets for matching
- Retention of location and trip data
- Whether Kafka is used as replayable log or transient bus
- Current (2023+) dispatch datastore after Spanner migration

## Candidates
- New kinds: mobile-client, geospatial-index, sharding-coordinator, service-mesh, worker, nosql-database, stream, workflow-engine, feature-flag-service, monitoring, tracing, data-warehouse, etl-job
- New properties on existing kinds: app-server.stateless already exists (used false here); app-server.shardingStrategy (enum: none, consistent-hash, key-range, geo); sql-database.sharded; edge.idempotent (boolean); edge.hedged / backupRequests
- New requirement paths: availability.mustSurviveDatacenterLoss; consistency.model (ap / cp); latency.tailStrategy
- New rules:
  - stateful-service-without-sharding: app-server with stateless false and no sharding strategy declared
  - retry-without-idempotency: async or retried edge where target does not declare idempotent handling
  - sql-primary-without-replica-at-scale: sql-database replication none while design states rps above threshold
  - fanout-sync-without-hedging: node with more than N sync outgoing edges and no backup-request or timeout declared
  - no-recovery-path-for-stateful-node: stateful app-server with no persistence edge to a datastore

## Verification 2026-09-13

| URL | Reachable | Outcome |
|---|---|---|
| https://highscalability.com/how-uber-scales-their-real-time-market-platform/ | yes | All boxes and every quoted number confirmed: location updates "every 4 seconds"; geospatial index goal "a million writes per second"; the service "runs on hundreds of processes"; "level 12 cell, which are 3.31 km(2) to 6.38 km(2)"; TChannel "already 20 times faster than HTTP"; "Make everything retryable", "Make everything killable", "Crash only"; "The Dispatch system periodically sends an encrypted State Digest down to driver phones"; "backup requests with cross server cancellation". |
| https://joshclemm.com/writing/a-brief-history-of-scaling-uber/ | yes | Confirmed: the 2009 LAMP double-dispatch incident; "By early 2014, Uber was 6 months away from Halloween night"; Schemaless as an append-only hash map on sharded MySQL; Cassandra for "marketplace matching and dispatching"; Cadence, Flipr, M3, Jaeger, Kafka, Presto/Spark/Hudi; Cloud Spanner for the fulfillment platform; the Edge Gateway replacing RTAPI; "over 250,000 servers" and "over 4000 of our stateless microservices"; S2 "(We have since updated to and open-sourced H3)"; Ringpop as "a gossip-protocol based approach". |
| https://www.infoq.com/presentations/uber-market-platform/ | not fetched | The HighScalability write-up transcribes this same QCon London 2015 talk and was reachable. |
| https://www.uber.com/us/en/blog/h3/ | not fetched | The H3 fact is confirmed by the joshclemm retrospective; the design encodes the quantified 2015 S2 level-12 scheme. |
| https://www.uber.com/en-US/blog/schemaless-part-one-mysql/ | no, HTTP 404 | Schemaless replication topology could not be confirmed, so no replication claim is made on the trip store. |

Facts the card states that could not be confirmed, and are therefore absent from the design: Schemaless replication topology; any change data capture out of Schemaless; whether Kafka is replayable (the card already lists this as an unknown); any quantified latency target. Fleet-wide counts (thousands of dispatch nodes, 250,000+ servers) are not mapped onto any single box.
