# Intake: Niantic Pokémon GO backend on Google Cloud

## Source
- Primary: https://cloud.google.com/blog/products/containers-kubernetes/bringing-pokemon-go-to-life-on-google-cloud (Luke Stone, Director of Customer Reliability Engineering at Google, Google Cloud blog, 2016 — the launch account, written with Niantic)
- Primary: https://cloud.google.com/blog/topics/developers-practitioners/how-pok%C3%A9mon-go-scales-millions-requests (Google Cloud blog with James Prompanya, Senior Engineering Manager leading Niantic's Pokémon GO server infrastructure team, 2021 — the current architecture diagram and request path)
- Primary: https://sre.google/workbook/managing-load/ (The Site Reliability Workbook, chapter 11, "Managing Load", case study "Pokémon GO on GCLB" by Google SRE with Niantic, 2018 — the launch and load-balancer incident)
- Primary: https://www.gcppodcast.com/post/episode-57-pokemon-go-with-edward-wu/ (Edward Wu, Director of Software Engineering at Niantic, Google Cloud Platform Podcast episode 57, 2016 — Niantic's own account of App Engine -> Kubernetes, Datastore, Bigtable)
- Primary: https://cloud.google.com/blog/products/databases/using-spanner-for-non-relational-workloads (Google Cloud blog quoting James Prompanya, Senior Staff Software Engineer at Niantic — why Datastore gave way to Spanner)
- Primary (existence only, transcript not retrievable): https://www.youtube.com/watch?v=TaO-GbvBonc ("Lessons Learned at Niantic: How to Move Live Systems to a New Database Platform", Mingliang Wei and Niniane Wang, Niantic, Google Cloud Next '18)
- Secondary: https://highscalability.com/case-study-pokemon-go-on-google-cloud-load-balancing/ (HighScalability write-up of the SRE Workbook case study, 2018)
- Secondary: https://newsletter.goodtechthings.com/p/digging-into-that-pokemon-go-architecture (enumerates the boxes in the official Google Cloud diagram)
- Verified by: official Google Cloud engineering blog (two posts), Google SRE Workbook case study co-written with Niantic, Google Cloud Platform Podcast interview with Niantic's Director of Software Engineering, Google Cloud Next '18 talk by Niantic engineers; supported by HighScalability
- Confidence: high (four first-party sources fetched in full and mutually consistent; note that most of the public record is Google's, written with Niantic, not Niantic's own engineering blog — Niantic has no comparable public engineering blog)
- Date of source: 2016 (launch account, podcast), 2018 (SRE Workbook case study, Next '18 talk), 2021 (current architecture and scale numbers)

## System in three lines
A location-based AR mobile game where every player shares one persistent world map: the phone reports its position, the backend answers with the Pokémon, gyms, PokéStops and other players near that location, and every catch, spin and battle is a transactional write against global game state. Tens of millions of players, hundreds of thousands to a million game transactions per second, all served from one Google Cloud footprint rather than sharded regional realms. Hard because the read path is a spatial query over a shared world, the write path needs strong consistency and consistent indexes, and traffic is spiky by design — events like GO Fest and new-country launches step demand in minutes, and the 2016 launch itself arrived at 50x the planned capacity.

## Scale (only if stated)
- Traffic vs. plan at launch: teams targeted 1X player traffic with a worst case of ~5X; actual peak was 50X the target, ten times the worst case (https://cloud.google.com/blog/products/containers-kubernetes/bringing-pokemon-go-to-life-on-google-cloud)
- Load testing vs. reality: "load-tested their software stack to process up to 5x their most optimistic traffic estimates"; "the actual launch requests per second (RPS) rate was nearly 50x that estimate" (https://sre.google/workbook/managing-load/)
- Japan launch: 3X the volume of the US launch (https://cloud.google.com/blog/products/containers-kubernetes/bringing-pokemon-go-to-life-on-google-cloud)
- Compute at launch: "many tens of thousands of cores" provisioned for the Container Engine cluster; "the largest Kubernetes deployment on Google Container Engine ever" (https://cloud.google.com/blog/products/containers-kubernetes/bringing-pokemon-go-to-life-on-google-cloud)
- Mid-launch scale-up: upgraded to a newer GKE version to add "more than a thousand additional nodes" to the cluster (same URL)
- Datastore: Niantic "ended up eventually needing something on order of 50 times the initial capacity estimates that we gave to Cloud Datastore" — Edward Wu, Niantic (https://www.gcppodcast.com/post/episode-57-pokemon-go-with-edward-wu/)
- Steady vs. event load: transactions scale from ~400K/sec to nearly 1M/sec during events such as Pokémon GO Fest (https://cloud.google.com/blog/topics/developers-practitioners/how-pok%C3%A9mon-go-scales-millions-requests)
- Database: ~5,000 Cloud Spanner nodes at any given time (same URL)
- Compute today: thousands of GKE nodes running the microservices (same URL)
- Analytics: 5-10 TB of data generated per day into BigQuery (same URL)
- Incident peak: synchronized client retries "ramped up enormously to 20× the previous global RPS peak" (https://sre.google/workbook/managing-load/)
- Player-side totals by Dec 2016: 8.7 billion km walked, 88 billion Pokémon caught (https://www.gcppodcast.com/post/episode-57-pokemon-go-with-edward-wu/)

## Requirements stated or clearly implied
- Availability target: not stated as an SLA. Global single-realm service on Google Cloud, fronted by global Cloud Load Balancing; no region-loss drill described. During the launch incident Google SREs isolated Pokémon GO's Google Front Ends from the shared pools, so blast-radius isolation from other Google Cloud tenants is an explicit operational requirement.
- Consistency: strong. Spanner chosen for "global ACID transactions" and, decisively, transactionally consistent secondary indexes — "we also like the consistent indexing that Cloud Spanner provides" (Niantic, https://cloud.google.com/blog/products/databases/using-spanner-for-non-relational-workloads). Eventually consistent indexes on the previous Datastore tier were a stated latency problem.
- Determinism as a requirement: "all servers operate deterministically" so that players standing in the same physical place see identical game state; server-side synchronization of settings and event timings is called critical (https://cloud.google.com/blog/topics/developers-practitioners/how-pok%C3%A9mon-go-scales-millions-requests)
- Latency target: not quantified. Stated qualitatively — Google's private fiber network carries game traffic for most of its transit to "reduce the overall latency for Pokémon Trainers"; the HTTP(S) load balancer was adopted for "faster connections to users".
- Ordering needs: not stated beyond per-entity transactional ordering implied by Spanner ACID transactions.
- Replay or reprocessing needs: yes on the analytics side — Bigtable holds protobuf representations of user actions and Dataflow batch-processes those logs into BigQuery; Pub/Sub carries the same events to a streaming path.
- Retention: Bigtable action logs held under "strict retention policies" (not quantified).
- Compliance / residency: not stated.

## Boundaries
- Regions / zones: not enumerated. Traffic enters through global Cloud Load Balancing at Google Front Ends worldwide and rides Google's private fiber for most of its transit; the pre-2016-migration ingress was a *regional* Network Load Balancer, which the migration to GCLB replaced.
- Trust zones: player phones (untrusted, public internet) -> Cloud Load Balancing / Cloud CDN edge -> NGINX reverse proxy tier inside the GKE cluster -> game services and spatial backend (internal) -> managed data services (Spanner, Bigtable, Pub/Sub, BigQuery, restricted). Cheat detection is run over the analytics pipeline, so the client is explicitly treated as adversarial.
- Named subsystems / bounded contexts: front-end game service; spatial query backend (sharded by location); the geospatial platform, which Niantic split into its own repository separate from the game code so future location-based titles reuse it (Edward Wu, podcast ep. 57); the analytics/data pipeline (Bigtable -> Dataflow -> BigQuery, plus Pub/Sub streaming); the "real world platform" the geospatial layer later became.
- GFE isolation: during the incident Google SRE "isolated Pokémon GO GFEs from the main pools" — a deliberate tenancy boundary inside Google's edge.

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | User phone / Pokémon GO app | Unity AR mobile client; sends location and gameplay actions, retries on error | not stated (Niantic mobile client) | client | retry: single immediate retry then constant backoff (pre-incident); after: jitter + truncated exponential backoff |
| 2 | Cloud Load Balancing (GCLB) | Global L7 ingress: distributes incoming traffic worldwide, terminates SSL at the edge | Google Cloud HTTP(S) Load Balancing | load-balancer | global: true; layer: 7; replaced a regional Network Load Balancer; supports admin rate-limit overrides |
| 3 | Google Front End (GFE) | The edge serving tier behind GCLB; Pokémon GO's GFEs were isolated from Google's shared pools during the incident | Google Front End | load-balancer | isolatedPool: true (post-incident); low-level network attack mitigation (SYN flood) |
| 4 | Network Load Balancer (legacy, pre-migration) | Regional L4 ingress used at launch, later retired | Google Cloud Network Load Balancer | load-balancer | regional; SSL termination cost the client two round trips; no L7 attack mitigation |
| 5 | Cloud CDN | Caches static game media at the edge so asset fetches never reach the cluster | Google Cloud CDN | cdn | enabled on the load balancer; origin: Cloud Storage |
| 6 | Cloud Storage | Holds static media assets served through the CDN | Google Cloud Storage | object-store | static media |
| 7 | NGINX reverse proxy | L7 reverse proxy pods inside the cluster: terminated SSL, buffered HTTP requests, routed and load-balanced across backend pods; still the routing hop to front-end services today | NGINX | api-gateway | deployed as pods; buffering caused resource exhaustion under load |
| 8 | Google Kubernetes Engine cluster (Container Engine at launch) | Orchestrates every Pokémon GO microservice container at planetary scale | GKE / Kubernetes | container-orchestrator | thousands of nodes; many tens of thousands of cores at launch; largest GKE deployment at the time; live version upgrade added 1,000+ nodes |
| 9 | Front-end game service | Handles player interaction requests (catch, spin, battle), fans out to backends | in-house, Java | app-server | horizontally scalable; stateless implied; runs on GKE |
| 10 | Spatial query backend | Answers "what is near me": caches map and world data keyed by location | in-house | app-server | sharded by location; location-based caching |
| 11 | Application server backends (2016 naming) | The backend pods behind the Nginx tier at launch | in-house | app-server | pods behind Nginx; timeouts became the capacity bottleneck once GFEs were enlarged |
| 12 | Cloud Spanner | Primary game-state database: players, inventory, world objects, catch events | Google Cloud Spanner | sql-database | ~5,000 nodes; global ACID transactions; relational schema with primary and secondary keys; transactionally consistent secondary indexes |
| 13 | Cloud Datastore (legacy) | The original game-world database, "a direct proxy for the game's overall popularity"; replaced by Spanner as the game matured | Google Cloud Datastore | nosql-database | scaled ~50x the initial capacity estimate; eventually consistent secondary indexes (the stated reason to leave) |
| 14 | Cloud Bigtable | Stores protobuf representations of user actions for logging and tracking | Google Cloud Bigtable | nosql-database | protobuf values; strict retention policies |
| 15 | Pub/Sub | Publishes game events off the request path to the analysis pipeline | Google Cloud Pub/Sub | pubsub-topic | async; feeds analytics |
| 16 | Dataflow | Batch-processes player logs out of Bigtable into the warehouse | Google Cloud Dataflow | stream-processor | batch over Bigtable logs; also streaming ingestion into BigQuery |
| 17 | BigQuery | Analytics warehouse: player behaviour, Pokémon distribution verification, cheat detection, marketing reports | Google BigQuery | data-warehouse | 5-10 TB/day ingested; streaming inserts |
| 18 | Cloud Monitoring / Logging | Dashboards, logging and alerting; Google engineers on hand during events | Google Cloud Monitoring, Cloud Logging | monitoring | built-in dashboards; alerting |
| 19 | Google private fiber network | Carries game traffic over Google's own backbone for most of its transit | Google global network | network-fabric | private fiber; reduces player latency |
| 20 | Geospatial platform (map/world data) | Niantic's shared real-world map and world-state layer, split into its own repository from the game code | in-house (Niantic real world platform) | app-server | separate repo from game logic; reused by later titles |
| 21 | Quota / capacity control plane | What the SRE team actually operates: quotas on the managed services, raised ahead of events | Google Cloud quotas | policy-engine | "manage quotas for managed services rather than operational overhead" |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| user phone | cloud load balancing (GCLB) | https | sync | | global anycast ingress; SSL terminated at the edge |
| cloud load balancing | google front end (GFE) | internal | sync | | Pokémon GO GFEs isolated from shared pools after the incident |
| cloud load balancing | cloud cdn | https | sync | | static media served from cache, never reaches the cluster |
| cloud cdn | cloud storage | https | sync | | origin fetch on cache miss |
| google front end | nginx reverse proxy | http | sync | | GCLB retried GET requests during the incident, amplifying load |
| user phone | network load balancer (legacy) | tcp/tls | sync | | pre-migration path; SSL termination cost two client round trips |
| network load balancer (legacy) | nginx reverse proxy | http | sync | | ingress into the Kubernetes cluster at launch |
| nginx reverse proxy | front-end game service | http | sync | | routing and load balancing across backend pods; buffers requests |
| front-end game service | spatial query backend | not stated | sync | | "what is near me"; backend sharded by location |
| spatial query backend | cloud spanner | spanner api | sync | strongly consistent, ACID | writes the catch event; reads use consistent secondary indexes |
| spatial query backend | cloud bigtable | bigtable api | sync | | logs the user action as a protobuf |
| spatial query backend | pub/sub | pub/sub | async | at-least-once (Pub/Sub default, not stated in source) | publishes the event for the analysis pipeline |
| front-end game service | cloud datastore (legacy) | datastore api | sync | eventually consistent secondary indexes | pre-Spanner game-state path; cascaded during the 2016 incident |
| pub/sub | dataflow | pub/sub | async | | streaming path into the warehouse |
| cloud bigtable | dataflow | bigtable api | async | | batch processing of player logs |
| dataflow | bigquery | streaming insert | async | | 5-10 TB/day |
| bigquery | analysts / cheat detection / marketing | sql | sync | | behaviour analysis, Pokémon distribution verification, anti-cheat |
| gke services | cloud monitoring | metrics/logs push | async | | dashboards and alerting |
| google front end | google private fiber network | internal | sync | | most of the transit between player and cluster |

## Failure modes, incidents, tradeoffs the source discusses
- **Launch demand at 50x plan.** "They load-tested their software stack to process up to 5x their most optimistic traffic estimates"; "the actual launch requests per second (RPS) rate was nearly 50x that estimate." (https://sre.google/workbook/managing-load/) The 2016 Google Cloud post frames the same fact as 1X target, 5X worst case, 50X actual — ten times the worst case. Every later decision traces back to this.
- **The measurement was wrong, not just the estimate.** During the GCLB migration "both Google and Niantic discovered that the true client demand for Pokémon GO traffic was 200% higher than previously observed" — load had been measured too far from the client, behind layers that were already shedding it. (https://sre.google/workbook/managing-load/)
- **Retry storms / thundering herd.** The client's "retry strategy was a single immediate retry, followed by constant backoff." When errors synchronized across the fleet, "these synchronized request spikes ramped up enormously to 20× the previous global RPS peak." Fix: jitter and truncated exponential backoff in the client. (https://sre.google/workbook/managing-load/)
- **Load balancer retries amplified the failure.** "Load balancers retried GET requests, adding to the system load" while backends were already slow — the retry budget at the edge compounded the retry budget at the client. (https://highscalability.com/case-study-pokemon-go-on-google-cloud-load-balancing/, summarizing the same case study)
- **Cascading failure crossed every layer.** The cascade hit "Cloud Datastore, Pokémon GO backends and API servers, and the load balancing system itself" — a shared-fate failure across a managed database, the application tier and the ingress at once. (https://sre.google/workbook/managing-load/)
- **Nginx buffering as the resource-exhaustion point.** The Nginx proxy pods buffered HTTP requests; under the surge, buffering exhausted their resources, which is part of why the L7 proxy tier could not absorb the excess. (SRE Workbook / HighScalability)
- **The L4 ingress had to go.** The regional Network Load Balancer made SSL termination cost the client two round trips and offered no mitigation for low-level network attacks; "a significant SYN flood attack" made the upgrade urgent. Moving to the HTTP(S) load balancer gave "far more control, faster connections to users and higher throughput". (SRE Workbook; https://cloud.google.com/blog/products/containers-kubernetes/bringing-pokemon-go-to-life-on-google-cloud)
- **Mitigations were capacity, isolation and deliberate throttling.** Google Traffic SREs isolated Pokémon GO's GFEs from the main pools, "enlarged capacity until backend timeouts became the bottleneck", and applied "administrative overrides to limit the rate of traffic the load balancers would accept" — shedding load at the edge on purpose rather than letting it reach a failing backend. (https://sre.google/workbook/managing-load/)
- **Engine swap in flight.** Niantic upgraded GKE and replaced the load balancer while millions of players were live — "akin to swapping out the plane's engine in-flight" — and the GKE upgrade itself was needed to add more than a thousand nodes to the cluster. (https://cloud.google.com/blog/products/containers-kubernetes/bringing-pokemon-go-to-life-on-google-cloud)
- **Datastore -> Spanner: consistency of indexes, not raw scale.** "As the game matured, we decided we needed more control over the size and scale of the database. We also like the consistent indexing that Cloud Spanner provides." — James Prompanya, Niantic. Eventually consistent secondary indexes "can lead to latency issues for applications"; Spanner's transactionally consistent ones removed that class of problem and let them use richer schemas with primary and secondary keys. (https://cloud.google.com/blog/products/databases/using-spanner-for-non-relational-workloads)
- **The Spanner migration was a live re-platform, and internally contested.** The Cloud Next '18 talk by Niantic's Mingliang Wei and Niniane Wang is framed around skeptics asking "Why introduce risk?" and a hypothesis-driven, risk-minimizing method for moving a live system to a new database platform. (https://www.youtube.com/watch?v=TaO-GbvBonc — talk page fetched, transcript not retrievable)
- **App Engine -> Kubernetes was a control tradeoff.** "Kubernetes gives you something that's much closer to a raw machine ... You can literally run Java Main and start up your own server." Niantic gave up the managed runtime to get the deployment control the launch demanded. (Edward Wu, Niantic, https://www.gcppodcast.com/post/episode-57-pokemon-go-with-edward-wu/)
- **Managed services as the operating model.** With Spanner, Pub/Sub, Dataflow and BigQuery all managed, the SRE job during a traffic spike reduces to managing quotas rather than provisioning infrastructure — the stated reason a small team can absorb a 2.5x event spike. (https://cloud.google.com/blog/topics/developers-practitioners/how-pok%C3%A9mon-go-scales-millions-requests)
- **Events are the modern failure mode.** GO Fest takes transactions from ~400K/sec to nearly 1M/sec; Google engineers are on hand during events and server-side event timings must be synchronized across the fleet or players in the same place see different worlds. (same URL)

## Unknowns
- Region and zone topology: how many regions the GKE clusters and Spanner instances span, and whether the service survives the loss of one. Never stated.
- Spanner schema and sharding: the primary keys, interleaving, and how player/world entities are laid out. Not stated in any fetched source.
- The spatial index itself: the sources say the spatial query backend is "sharded by location" and does "location-based caching" but never name the spatial scheme (S2 cells, geohash, quadtree) or the cache product.
- Inter-service protocol inside GKE: gRPC vs HTTP, service mesh, service discovery — the official diagram draws the cluster as a black box.
- Latency SLOs, per-call timeouts and circuit-breaking policy: not quantified anywhere.
- Anti-cheat mechanics beyond "cheat detection uses the BigQuery pipeline".
- Whether Cloud Datastore is fully retired or still serves some workload alongside Spanner.
- Bigtable retention values ("strict retention policies", no numbers) and Pub/Sub retention/replay configuration.
- The Cloud Next '18 migration mechanics (dual writes, shadow reads, verification, rollback) — the talk exists but no transcript or write-up could be fetched.
- The Lightship VPS / real-world-platform posts on nianticlabs.com now 301 to explore.scopely.com and 404 there, so Niantic's own account of the geospatial platform is currently unavailable.

## Candidates
- New kinds: none. Every box maps to an existing kind (client, load-balancer, cdn, object-store, api-gateway, container-orchestrator, app-server, sql-database, nosql-database, pubsub-topic, stream-processor, data-warehouse, monitoring, network-fabric, policy-engine).
- New properties on existing kinds:
  - `client.retryPolicy` (none, immediate, constant-backoff, exponential-backoff, jittered-exponential-backoff) — the decisive property in this incident
  - `load-balancer.scope` (regional, global) and `load-balancer.layer` (4, 7)
  - `load-balancer.retriesIdempotentRequests` (boolean) — GCLB retrying GETs amplified the cascade
  - `load-balancer.tenantIsolated` (boolean) — the GFE pool isolation
  - `load-balancer.adminRateLimit` (boolean) — deliberate edge throttling as a mitigation lever
  - `api-gateway.buffersRequests` (boolean) — the Nginx resource-exhaustion mode
  - `sql-database.secondaryIndexConsistency` (strong, eventual) and the same on `nosql-database` — the whole Datastore->Spanner rationale
  - `sql-database.nodes` (integer) — Spanner at ~5,000 nodes
  - `container-orchestrator.nodeCount` (integer) and `container-orchestrator.liveUpgradeRequiredForScale` (boolean)
  - `app-server.shardKey` (string) — the spatial backend is sharded by location
  - `component.managedService` (boolean) — the stated operating model: quota management instead of capacity management
- New requirement paths:
  - `scale.peakToBaselineRatio` (number) — 50x at launch, 2.5x at events; the number the design must be sized against
  - `scale.eventDriven` (boolean) — scheduled events as a first-class load source
  - `consistency.indexConsistency` (strong, eventual)
  - `consistency.deterministicWorldState` (boolean) — all servers must answer identically for the same place
  - `capacity.loadMeasuredAtClient` (boolean)
- New rules (name + one-line condition):
  - `client-retry-without-jitter`: a client edge declares a retry policy that is not jittered-exponential-backoff while the design has a stated peak-to-baseline ratio above some threshold
  - `retrying-load-balancer-over-slow-backend`: load-balancer with retriesIdempotentRequests true in front of an app-server with no declared timeout
  - `l4-ingress-terminating-tls`: load-balancer with layer 4 terminating TLS while clients are mobile over the public internet (two round trips, no L7 attack mitigation)
  - `buffering-proxy-without-concurrency-limit`: api-gateway with buffersRequests true and no declared concurrency or rate limit
  - `eventual-index-on-latency-critical-read`: a database with secondaryIndexConsistency eventual on the synchronous read path of a latency-sensitive requirement
  - `no-load-shedding-at-edge`: design with scale.peakToBaselineRatio above threshold and no rate-limiter or adminRateLimit at the ingress
  - `shared-edge-pool-for-spiky-tenant`: load-balancer with tenantIsolated false while scale.eventDriven is true
  - `capacity-plan-below-observed-peak`: stated load test multiple lower than scale.peakToBaselineRatio
