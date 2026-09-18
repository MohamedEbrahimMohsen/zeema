# Intake: Netflix streaming (control plane on AWS, Open Connect data plane)

## Source
- Primary: https://www.infoq.com/presentations/netflix-chaos-microservices/ (Josh Evans, Director of Operations Engineering, QCon SF 2016, "Mastering Chaos"); detailed notes at https://github.com/keyvanakbary/learning-notes/blob/master/talks/mastering-chaos-a-netflix-guide-to-microservices.md and https://www.kiranjthomas.com/posts/mastering-chaos-a-netflix-guide-to-microservices/
- Primary: https://netflix.github.io/ (official OSS catalogue: Zuul, Eureka, Hystrix, Ribbon, EVCache, Atlas, Spinnaker, Dynomite, Chaos Monkey)
- Secondary: https://newsletter.techworld-with-milan.com/p/how-does-netflix-manage-to-show-you (playback flow, numbers)
- Secondary: https://www.vdocipher.com/blog/netflix-tech-stack-and-architecture/ (Open Connect fill windows)
- Verified by: conference talk by Netflix engineering director + official OSS site + reputable secondary
- Confidence: high for control plane; medium for Open Connect internals (official CDN post returned 403)
- Date of source: 2016 (talk), 2024-2025 (numbers)

## System in three lines
Delivers video to 300M subscribers in 190 countries. Control plane (auth, catalogue, playback authorisation, telemetry) runs as microservices on AWS in three regions; data plane (video bytes) is Netflix's own CDN, Open Connect, embedded inside ISPs. Hard because of scale, global availability, and the split between a latency-tolerant control plane and a bandwidth-dominant data plane.

## Scale (only if stated)
- Users / DAU: 301M subscribers, 190 countries
- Requests per second: EVCache 30M requests/sec, 2 trillion/day
- Data volume: up to 15% of global downstream internet traffic
- Message throughput: Kafka 1.4 trillion messages/day (telemetry)
- Peak live event: 65M concurrent viewers (Tyson vs Paul)

## Requirements stated or clearly implied
- Availability target: multi-region active, "three regions enabling traffic failover if any region fails"
- Consistency: AP. Cassandra "chosen for availability over consistency"; local quorum writes
- Latency target: not quantified; aggressive timeouts everywhere via Hystrix
- Ordering needs: not stated
- Replay or reprocessing: telemetry via Kafka; not stated as requirement
- Retention: not stated
- Compliance / residency: DRM per device; "not publicly documented"
- Degradation is a first-class requirement: fallbacks must return static or degraded responses rather than fail

## Boundaries
- Regions / zones: 3 AWS regions (us-east-1, us-west-2, eu-west-1); EVCache replicated across availability zones
- Trust zones: devices (untrusted) -> ELB + Zuul edge -> internal services; Open Connect appliances inside third-party ISP networks
- Named subsystems: Edge (ELB, Zuul), NCCP (content control plane), API gateway service, Playback (DRM, manifest, telemetry), Subscriber, Open Connect, Encoding pipeline, Data pipeline

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Device clients | TV, mobile, web apps; adaptive bitrate DASH player; fetch segments from OCA | native apps, Falcor data fetching | mobile-client (new), web-client (new) | chunkSeconds: 2-10 |
| 2 | ELB | AWS load balancer in front of edge | AWS ELB | load-balancer (new) | |
| 3 | Zuul | Edge gateway: routing, auth, request filtering, carries FIT fault-injection metadata | Zuul 2 (Netty, async) | api-gateway | auth: token; async: true |
| 4 | NCCP | Netflix content control plane, legacy device protocol endpoint | in-house | api-gateway | |
| 5 | API gateway service | Aggregates backend calls per device; grew monolith-like from client libraries | in-house (Java) | app-server | stateless: true |
| 6 | Playback service | Stream authorisation, DRM licence, manifest generation, telemetry ingest | in-house | app-server | stateless: true |
| 7 | Subscriber service | Customer identity and entitlements; critical dependency for everything | in-house | app-server | stateless: true; criticality: high |
| 8 | Eureka | Service registry, "phonebook" for discovery | Eureka | service-registry (new) | |
| 9 | Ribbon | Client-side load balancing between services | Ribbon | service-mesh (client-side) | clientSide: true |
| 10 | Hystrix | Circuit breaker, timeouts, bulkheads, fallbacks per dependency | Hystrix | resilience-library (new, maybe edge property) | circuitBreaker: true; fallback: true |
| 11 | EVCache | Sharded memcached, replicated across AZs; near every service | EVCache (memcached) | cache | evictionPolicy: lru; replication: multi-az; rps: 30000000 |
| 12 | Cassandra | Profiles, viewing history, preferences | Apache Cassandra | nosql-database (new) | consistency: eventual; writeQuorum: local-quorum |
| 13 | RDS MySQL | Transactional data needing strong consistency (billing) | AWS RDS MySQL | sql-database | |
| 14 | Kafka | Telemetry and event pipeline | Apache Kafka | stream (new) | messagesPerDay: 1.4e12 |
| 15 | S3 | Master video files, encoded assets, analytics storage | AWS S3 | object-store (new) | |
| 16 | Encoding pipeline | Per-title and per-shot transcoding into bitrate ladders | in-house on AWS | etl-job (new) / worker (new) | batch: true |
| 17 | Open Connect control | Selects OCA per play request: proximity, health, availability, load; issues signed URLs | in-house (AWS) | app-server | |
| 18 | Open Connect storage OCA | Appliances at internet exchange points holding near full catalogue | Open Connect Appliance | cdn (new) | tier: origin-edge; fillWindow: off-peak |
| 19 | Open Connect edge OCA | Appliances embedded in ISP networks caching popular regional content | Open Connect Appliance | cdn (new) | tier: edge; embeddedInIsp: true |
| 20 | Atlas | Time-series telemetry, billions of metrics | Atlas | monitoring (new) | |
| 21 | Spinnaker | Continuous delivery with conformity checks, staged deploys | Spinnaker | ops tooling, not an architecture node | |
| 22 | Chaos Monkey / FIT | Instance termination and fault injection; stateful services excluded | Chaos Monkey, FIT | ops tooling, not an architecture node | |
| 23 | Dynomite | Redis made multi-region | Dynomite | cache | replication: multi-region |
| 24 | Auto-scaling groups | Stateless services scale horizontally; node loss is a non-event | AWS ASG | property of app-server | autoscaling: true |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| device | elb | https | sync | | |
| elb | zuul | http | sync | | |
| zuul | api-gateway-service | http | sync | | Hystrix-wrapped |
| api-gateway-service | subscriber-service | http | sync | | fallback: secure token |
| api-gateway-service | playback-service | http | sync | | |
| playback-service | open-connect-control | http | sync | | OCA selection |
| playback-service | evcache | memcached | sync | | |
| any service | eureka | http | sync | | discovery lookup |
| any service | evcache | memcached | sync | | near-universal |
| subscriber-service | cassandra | cql | sync | | local quorum |
| subscriber-service | evcache | memcached | sync | | over-reliance incident |
| device | edge-oca | https/dash | sync | | segments, signed url |
| edge-oca | storage-oca | http | sync | | cache miss fill |
| s3 | storage-oca | http | async | | proactive fill in off-peak windows |
| encoding-pipeline | s3 | s3 | async | | encoded ladders |
| device | kafka (via playback telemetry) | http then kafka | async | at-least-once | 1.4T/day |
| services | atlas | metrics push | async | | |
| oca | open-connect-control | http | async | | health and load reports |

## Failure modes, incidents, tradeoffs the source discusses
- Over-reliance on cache: subscriber service "you may rely too much on EVCache"; cache loss cascaded into a service outage. Fixes: workload partitioning (real-time vs batch caches), request-level caching, secure-token fallback. Source: mastering chaos notes.
- Fallbacks as design requirement: "if I cannot call a service, can I return some static response instead (degraded service)". Source: mastering chaos notes.
- Stateful services: node loss "may take hours to replace"; excluded from Chaos Monkey; must be redundant across zones. Source: kiranjthomas notes.
- Stateless services: node loss a "non-event" through auto-scaling groups. Source: kiranjthomas notes.
- Client libraries in the gateway became "a monolith-like complexity with heap consumption, logical defects, and unexpected transitive dependencies". Source: kiranjthomas notes.
- Cassandra chosen "for availability over consistency"; local quorum writes. Source: notes.
- Live events break the CDN model: "systems optimized for one workload pattern may require significant modifications to handle different patterns"; 65M concurrent live viewers defeated pre-caching. Source: techworld-with-milan.
- Region failover: three regions, traffic evacuated from a failed region. Source: kiranjthomas notes.

## Unknowns
- OCA steering algorithm details (not publicly documented)
- Exact latency budgets per service
- Kafka retention and whether consumers replay
- Current state of Hystrix (in maintenance mode since 2018; successor not named in sources)

## Candidates
- New kinds: load-balancer, cdn, object-store, service-registry, web-client, mobile-client (2nd sighting), nosql-database (2nd), stream (2nd), monitoring (2nd), worker (2nd), etl-job (2nd), service-mesh (2nd, client-side variant)
- New properties on existing kinds: cache.replication (single-az, multi-az, multi-region); cache.workloadPartitioned (boolean); app-server.autoscaling (boolean); app-server.criticality (enum); api-gateway.aggregation (boolean)
- New edge properties: fallback (none, static, cached, degraded); circuitBreaker (boolean); timeoutMs (integer)
- New requirement paths: availability.degradedModeAllowed (boolean); availability.regions (integer)
- New rules:
  - critical-dependency-without-fallback: sync edge into app-server with criticality high and no fallback declared
  - cache-single-zone-in-multi-az-design: cache with replication single-az while availability.regions or multiRegion set
  - stateful-node-without-zone-redundancy: stateless false and inGroup availability-zone count eq 1
  - sync-edge-without-timeout: sync edge with no timeoutMs while latency target exists
  - cdn-fronted-live-workload: cdn with proactive fill and a requirement for live content (needs requirement path)

## Verification 2026-09-13

Every URL the Source section lists was fetched on 2026-09-13. All six were reachable.

| URL | Reachable | Outcome |
|---|---|---|
| https://www.infoq.com/presentations/netflix-chaos-microservices/ | yes | Talk page live: "Mastering Chaos - A Netflix Guide to Microservices", Josh Evans, Director of Operations Engineering, Netflix. Abstract only; component names are in the video/slides, so the two note mirrors below carried the boxes. |
| https://github.com/keyvanakbary/learning-notes/blob/master/talks/mastering-chaos-a-netflix-guide-to-microservices.md | yes | Confirms Hystrix, Zuul, EVCache ("30 million requests/sec, 2 trillion requests per day globally"), Cassandra ("chose availability via Cassandra, systems are eventually consistent"), FIT, Spinnaker, Chaos Monkey, ELB; stateless "loss a node is non-event" vs stateful "could take hours to recover"; EVCache over-reliance fixes "workload partitioning", "request-level caching", "secure token fallback"; multi-region failover. |
| https://www.kiranjthomas.com/posts/mastering-chaos-a-netflix-guide-to-microservices/ | yes | Confirms EVCache as a sharded Memcached wrapper, AWS auto-scaling groups, stateless vs stateful node loss, three-region failover, the client-library "Return of the Monolith" complexity, eventual consistency with local quorum. |
| https://netflix.github.io/ | yes | Confirms Eureka, Ribbon, Hystrix, Zuul, EVCache, Dynomite, Atlas, Spinnaker, Chaos Monkey as Netflix OSS with the roles the card gives them. |
| https://newsletter.techworld-with-milan.com/p/how-does-netflix-manage-to-show-you | yes | Confirms 301M subscribers / 190 countries, 15% of global downstream traffic, 65M concurrent live viewers, Kafka ~1.4 trillion messages/day, Cassandra for profiles, MySQL/RDS for transactional data, S3 for video and analytics, storage OCAs at internet exchange points vs edge OCAs in ISP networks, the playback authorisation -> OCA selection -> signed URL flow, three AWS regions active-active. |
| https://www.vdocipher.com/blog/netflix-tech-stack-and-architecture/ | yes | Confirms "Encoded assets are pushed to OCAs during off-peak 'fill windows'", OCAs embedded at ISPs and interconnect sites, Zuul doing routing/auth/connection management with Zuul 2 on Netty, per-title and shot-based encoding. |

Card facts that could not be confirmed and were therefore dropped or demoted:

- **NCCP** (components row 4): named in no reachable source. Dropped from the design.
- **`chunkSeconds: 2-10`** (row 1): not stated in any reachable source. Omitted.
- **Dynomite** (row 23): confirmed to exist, but no source states what calls it or what it holds. Not encoded.
- **Ribbon, Hystrix** (rows 9, 10): confirmed as libraries, not runtime boxes. Encoded as edge properties.
- **Spinnaker, Chaos Monkey / FIT, auto-scaling groups** (rows 21, 22, 24): ops tooling and a scaling property, as the card itself notes. ASG becomes `autoscaling: true`.
- **`subscriber-service -> billing-db`**: no source draws this arrow; assumed so RDS is reachable. Marked assumed in notes.md.
