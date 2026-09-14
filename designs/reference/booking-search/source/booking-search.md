# Intake: Booking.com search, MySQL fleet, service mesh, observability

## Source
- Primary: https://blog.booking.com/ (official blog index; titles and abstracts for ranking platform, MySQL on three platforms, MySQL slave scaling with 50+ slaves, 250 MySQL clusters backup migration to AWS, Events observability pillar, Nanotube metrics router, Envoy service mesh across 2,500+ services, multi-control-plane mesh for hybrid cloud, HAProxy edge, CloudFront, DR testing, SLOs, incident post; individual Medium posts returned 403 in this pass)
- Primary: https://kudzia.eu/b/2023/12/podcast-about-evolution-of-mysql-at-booking-com/ (summary of podcast with Booking.com DBA leadership: thousands of small DB servers, replicas instead of caches, polyglot MySQL/Cassandra/Elasticsearch, 6-8x cheaper than cloud)
- Primary: https://www.confluent.io/customers/booking-com/ (vendor case study quoting Booking.com senior engineering manager: event-driven booking, payments, personalisation)
- Secondary: search summaries citing Booking.com posts on JanusGraph-on-Cassandra fraud graph and the Events pipeline (host event-proxy into Kafka)
- Verified by: official blog index and abstracts + podcast with Booking.com engineers + vendor quote
- Confidence: medium (post bodies not readable; component roles from titles, abstracts and podcast)
- Date of source: 2015-2024

## System in three lines
Online travel agency serving hotel search, ranking and reservations ("nearly 1 million rooms per night") from a large self-hosted estate: thousands of small MySQL servers in wide replication topologies with binlog servers and 250+ clusters, replicas used instead of caches, plus Cassandra and Elasticsearch for polyglot workloads. A Perl-era monolith has been broken into 2,500+ services behind an Envoy service mesh with multiple control planes spanning bare metal and cloud, HAProxy and CloudFront at the edge, and a Kafka-based Events pipeline feeding tracing, metrics and logs. Hard because availability and pricing change constantly, the DB fleet is run by fewer than 20 people through automation, and hybrid cloud makes discovery and mesh control non-trivial.

## Scale (only if stated)
- Users / DAU: "nearly 1 million rooms per night" booked
- Requests per second: not stated; Nanotube routes "tens of millions metric data points per second"
- Data volume: not stated
- Message throughput: not stated
- Fleet: thousands of DB servers; 250+ MySQL clusters; replication topologies with 50+ slaves; 2,500+ services on the mesh; DBA/DevOps team under 20; 400x growth over a decade
- Cost: self-managed hardware 6-8x cheaper than public cloud raw compute/storage (podcast claim)

## Requirements stated or clearly implied
- Availability target: disaster recovery tested at scale; SLOs for data-intensive services; automated failovers
- Consistency: MySQL primaries with async replication; "database replicas instead of caches" so reads tolerate replica lag; Cassandra eventual for fraud graph
- Latency target: search and ranking interactive; not quantified
- Ordering needs: binlog stream order per cluster
- Replay or reprocessing: binlog servers replay replication streams; Kafka events replayable
- Retention: backup catalogue for 250 clusters moved to AWS
- Compliance / residency: automated credential rotation every 30 days
- Operations: manual SSH is "ticket-worthy"; every ~10x growth triggers subsystem redesign

## Boundaries
- Regions / zones: multiple data centers plus AWS; MySQL "on three different platforms" (bare metal, Kubernetes, cloud); hybrid mesh with multiple control planes
- Trust zones: internet -> CloudFront -> HAProxy edge -> mesh (Envoy sidecars) -> services -> databases
- Named subsystems: Search and ranking platform, Reservation and payments (event-driven), MySQL fleet (topologies, binlog servers, backups), Cassandra and Elasticsearch, Fraud graph (JanusGraph on Cassandra), Events observability (event-proxy, Kafka, consumers), Nanotube metrics router, Service mesh (Envoy, multi control plane), Kubernetes

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Web and mobile clients | Search, book | web, apps | web-client, mobile-client | |
| 2 | CloudFront | Edge caching and edge compute | Amazon CloudFront | cdn | |
| 3 | HAProxy edge | Load balancing at scale | HAProxy | load-balancer | |
| 4 | Envoy service mesh | Sidecars for 2,500+ services; multiple control planes across hybrid clouds | Envoy | service-mesh | services: 2500; controlPlanes: multi |
| 5 | Mesh control planes | Per-platform control planes unified for hybrid cloud | in-house / xDS | control-plane-coordinator | |
| 6 | Services (ex-monolith) | Perl monolith decomposed; federated GraphQL front | Perl, Java, Go (mixed) | app-server | |
| 7 | Federated GraphQL gateway | Schema federation across domains | GraphQL federation | api-gateway | |
| 8 | Ranking platform | Search ranking system (retrieval, ML scoring) | in-house | ml-inference + app-server | |
| 9 | MySQL fleet | Thousands of small servers; wide topologies with 50+ slaves; intermediate masters; 250+ clusters | MySQL | sql-database | clusters: 250; replicasPerTopology: 50 |
| 10 | Binlog servers | Relay replication streams to fan out replicas without intermediate-master risk | in-house (Percona talks) | database-proxy (replication relay) | |
| 11 | Backup catalogue | Backups for 250 clusters, migrated to AWS | S3 (implied) | object-store | |
| 12 | Cassandra | Polyglot store; fraud graph backend | Apache Cassandra | nosql-database | |
| 13 | JanusGraph | Linked identifiers for real-time fraud detection | JanusGraph | graph-database | |
| 14 | Elasticsearch | Search workloads | Elasticsearch | search-index | |
| 15 | Kafka (Confluent Platform) | Event-driven booking, payments, personalisation, analytics; events pipeline | Apache Kafka / Confluent | stream | |
| 16 | Event-proxy (host-level) | Routes key-value events from hosts into Kafka | in-house | worker (agent) | |
| 17 | Observability consumers | Tracing, APM metrics, event logging from Kafka | in-house | monitoring + tracing | |
| 18 | Nanotube | High-performance metrics router | Nanotube (open source) | monitoring | pointsPerSec: tens of millions |
| 19 | Kubernetes | Hardened, fully automated cluster setup | Kubernetes | ops platform, not tallied | |
| 20 | Credential rotation | Automated 30-day DB credential rotation | in-house | key-management | rotationDays: 30 |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | cloudfront | https | sync | | |
| cloudfront | haproxy | https | sync | | |
| haproxy | services (via envoy) | http | sync | | |
| service | service (via envoy sidecars) | http/grpc | sync | | mesh, multi control plane |
| control plane | envoy sidecars | xds | async | | |
| graphql gateway | domain services | http | sync | | federation |
| service | mysql replica | mysql | sync | | replicas instead of caches |
| service | mysql primary | mysql | sync | | writes |
| mysql primary | binlog server | replication | async | ordered | |
| binlog server | replicas (50+) | replication | async | ordered | fan-out |
| mysql | backup catalogue (aws) | backup | async | | 250 clusters |
| fraud service | janusgraph -> cassandra | gremlin / cql | sync | | |
| service | elasticsearch | http | sync | | |
| booking / payment services | kafka | kafka | async | at-least-once | event-driven |
| hosts | event-proxy | local | async | | |
| event-proxy | kafka | kafka | async | at-least-once | |
| kafka | observability consumers | kafka | async | | tracing, apm, logs |
| services | nanotube | metrics | async | | |
| rotation job | mysql credentials | admin | async | | every 30 days |

## Failure modes, incidents, tradeoffs the source discusses
- Replicas over caches: chose "database replicas instead of caches to simplify developer infrastructure"; cost is replica lag exposure. Source: podcast.
- Automation as survival: thousands of servers with under 20 people; failover automation "came relatively late"; manual SSH is a "ticket-worthy incident". Source: podcast.
- Redesign cadence: "Every ~10x data growth triggers subsystem redesign". Source: podcast.
- Cloud tradeoff: 6-8x cheaper self-hosted; RDS "lacks more advanced features including observability & functionalities needed at large scale"; random maintenance windows caused outages. Source: podcast.
- Wide replication topologies: intermediate masters are a failure point; binlog servers decouple fan-out (talk titles and abstracts). Source: blog index, Percona.
- Hybrid mesh complexity: multi-control-plane mesh needed to unify bare metal and cloud. Source: blog index abstract.
- Operational burden of self-managed Kafka: "Scaling clusters, applying updates, and monitoring pipelines consumed engineering capacity". Source: Confluent case study.
- Monolith decomposition via federated GraphQL rather than big-bang. Source: blog index abstract.

## Unknowns
- Availability and pricing search internals (inventory cache, freshness)
- Reservation transaction flow and idempotency
- Kafka cluster numbers
- Incident specifics (post unreadable)

## Candidates
- New kinds: none strictly new; sightings: service-mesh (7th), control-plane-coordinator (8th), cdn (9th), load-balancer (12th), api-gateway (14th: GraphQL federation), sql-database (22nd), database-proxy (11th: binlog relay), graph-database (5th), search-index (8th), stream (17th), monitoring (15th), tracing (5th), key-management (2nd: credential rotation), object-store (18th), nosql-database (21st), ml-inference (8th)
- New properties on existing kinds: sql-database.replicaFanout (integer), intermediateMasters (boolean), replicasInsteadOfCache (boolean), backupCatalogue; service-mesh.controlPlanes (integer), hybrid (boolean); api-gateway.federation (graphql); key-management.rotationDays
- New edge properties: replicaLagTolerated (boolean); relayed (boolean)
- New requirement paths: operations.automationFirst (boolean); security.credentialRotationDays; cost.selfHostedPreferred (boolean)
- New rules:
  - wide-replication-without-relay: sql-database replicaFanout above threshold with intermediateMasters true and no binlog relay proxy
  - reads-on-replicas-without-lag-tolerance: app-server read edges to replicas with replicaLagTolerated false
  - credentials-without-rotation: datastore edges with credentials and security.credentialRotationDays unset (2nd sighting of rotation theme after Coinbase certificates)
  - hybrid-mesh-single-control-plane: service-mesh spanning provider groups with controlPlanes 1 (informational)
  - large-fleet-without-automated-failover: sql-database clusters above threshold and no control-plane-coordinator for failover

## Verification 2026-09-14

Re-fetched on 2026-09-14 before encoding; full log in `work/designs/booking-search/verify.md`.

| URL | Reachable | Outcome |
|---|---|---|
| https://blog.booking.com/ | yes | Index renders; every post title and abstract the card cites is present, including "more than fifty (and sometimes more than a hundred) slaves replicating from the same" master, "250+ MySQL clusters", "tens of millions of metric data points per second", "multi-region, scalable and reliable way across 3 different platforms". |
| https://kudzia.eu/b/2023/12/podcast-about-evolution-of-mysql-at-booking-com/ | yes | Confirms verbatim: "thousands of relatively small database servers", "< 20 dba devops", "x400" growth, "database replicas instead of caches", "MySQL, Cassandra, Elastic", "6-8x cost saving", "automated rotation of all db-related credentials every 30 days", "manual interventions done via SSH are ticket-worthy incidents", "~10x data grow" redesign cadence. |
| https://www.confluent.io/customers/booking-com/ | yes | Confirms Kafka behind booking, payments, personalised marketing and analytics, and the operational-burden quote. States no numbers. |
| https://blog.booking.com/unifying-hybrid-clouds-a-journey-through-multi-control-plane-service-mesh.html | no (404) | Body lives on Medium and 403s. Title and abstract only. |
| https://www.slideshare.net/IvanKruglov/ivan-kruglov-introducing-envoybased-service-mesh-at-bookingcom-version-7 | yes | Mirror of the 2018 mesh talk: Envoy as a **sidecar**, in-house control plane started August 2017 with bare-metal support first, discovery through **ZooKeeper** (service discovery and configuration) and **Kubernetes**; "~ 30 projects", "~ 10K servers", "hundreds of thousands RPS" after six months; retries on "gateway-error - HTTP 502, 503, 504". |
| Medium post bodies (events pillar, ranking platform, fraud graph, GraphQL) | no (403) | Unchanged from the original pass. Search summaries of the Events post confirm the pipeline: Events library -> **event-proxy daemon on the host** -> **Kafka** -> **event consumers** for metrics, logs, traces and analytics. |

### Card facts that could NOT be confirmed, and were dropped

- **"2,500+ services on the mesh"** - no reachable source states it; the only confirmed sizing is the 2018 talk's "~ 30 projects / ~ 10K servers". No service count is encoded.
- **"nearly 1 million rooms per night"** - not found on any reachable page. No user or booking figure is encoded.
- **A number of mesh control planes** - only the phrase "Multi-Control Plane" is confirmed. Encoded as two control-plane nodes (one per platform), which is an inference from the title.
- **Kafka cluster counts, partition counts, per-box RPS** - stated nowhere; no `nfr.rps` is set on any node in either variant.
- **Reservation and payment transaction internals** - still unknown; the services only publish to Kafka.

### Facts confirmed in this pass that the card did not carry

- Envoy runs as a **sidecar**, and the control plane's discovery and configuration backend is **ZooKeeper** (alongside Kubernetes). ZooKeeper is encoded as a `coordination-service` node.
