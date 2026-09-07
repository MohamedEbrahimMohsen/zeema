# Intake: Shopify flash sales and BFCM (pods, scriptable edge, checkout throttle)

## Source
- Primary: https://shopify.engineering/surviving-flashes-of-high-write-traffic-using-scriptable-load-balancers-part-i (official, 2018: Nginx+Lua checkout throttle, Kylie Cosmetics incident)
- Primary: https://shopify.engineering/e-commerce-at-scale-inside-shopifys-tech-stack (official, 2018: stack, pods, Redismageddon)
- Primary: https://shopify.engineering/mysql-database-shard-balancing-terabyte-scale (official, 2021: Ghostferry shard balancing, TLA+)
- Primary: https://shopify.engineering/bfcm-readiness-2025 (official, 2025: peak numbers, load testing, bottlenecks)
- Secondary: https://kovyrin.net/2024/06/16/interview-inside-shopify-monolith/ (interview with Shopify principal engineer; modular monolith, pods, Vitess, GCP)
- Verified by: four official Shopify engineering posts + interview with Shopify engineer
- Confidence: high
- Date of source: 2018, 2021, 2024, 2025

## System in three lines
Multi-tenant commerce platform where one merchant's flash sale can produce write bursts that would sink a shared database. A Rails modular monolith is deployed as isolated pods, each with its own MySQL shard, Redis and Memcached, with a scriptable Nginx+Lua edge that routes shops to pods and admits checkout traffic through a per-shop leaky-bucket queue. Hard because tenants share infrastructure, checkouts are write-heavy on one row, and Black Friday traffic is orders of magnitude above steady state.

## Scale (only if stated)
- Users / DAU: 600,000 merchants (2018)
- Requests per second: 80,000 RPS peak (2018); 284M requests/min at edge, 80M/min at app servers, 200M RPM at p99 (BFCM 2025 prep)
- Data volume: 12 TB/min on Black Friday; 10.5 trillion DB queries in 2024
- Message throughput: 80,000+ checkouts/min in scale tests
- Fleet: 100+ pods across multiple regions; ~100 Rails applications; ~100K unit tests, 15-20 min build

## Requirements stated or clearly implied
- Availability target: no platform-wide outage; blast radius limited to a pod; regional failover tested
- Consistency: strong per shop (single MySQL shard per shop); shard moves accept brief stale source data
- Latency target: not quantified; checkout queue must be fair (FIFO), not a lottery
- Ordering needs: queue admission order for checkouts
- Replay or reprocessing: binlog replay during shard moves
- Retention: not stated
- Compliance / residency: filtered database replication for data residency in global storefront rendering
- Tenant isolation: prominent merchants get dedicated pods

## Boundaries
- Regions / zones: multiple GCP regions; a pod "can be spawned in any region"
- Trust zones: buyers and bots -> edge (Nginx/OpenResty, DDoS mitigation) -> pods
- Named subsystems: Edge (load balancers, Sorting Hat, checkout throttle), Pods (Core monolith, MySQL shard, Redis, Memcached), Storefront renderer (separate app, Liquid), Background jobs, Kafka/ETL, Shard balancing (Ghostferry), Deploy (Shipit, merge queue)
- Group kind not in v1: **pod / cell** (tenant-isolated slice of the whole stack)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Buyer browser / bots | Storefront and checkout traffic, including adversarial | web | web-client | |
| 2 | Nginx + OpenResty Lua load balancers | Scriptable edge: routing, fan-out across shards, DDoS mitigation | Nginx, OpenResty | load-balancer | scriptable: true |
| 3 | Sorting Hat | Routing table service mapping shop to pod; enforces pod boundaries | in-house (Lua on LB) | coordination-service (tenant router) | routingKey: shop_id |
| 4 | Checkout throttle / queue | Per-shop leaky bucket in 5 s windows; overflow to cached queue page; signed cookie bypass after admission | in-house (Lua + Redis) | rate-limiter (new) | algorithm: leaky-bucket; windowSeconds: 5; fairness: fifo (after fix) |
| 5 | Shopify Core | Rails modular monolith; Packwerk boundaries; stateless, autoscaled on Kubernetes | Ruby on Rails, GKE | app-server | stateless: true; autoscaling: true |
| 6 | Storefront renderer | Separate app: load data, render Liquid, return HTML; global with filtered replication | in-house | app-server | |
| 7 | MySQL shard (per pod) | System of record for a subset of shops; shop_id sharding key; 100+ shards | MySQL | sql-database | sharded: true; shardKey: shop_id |
| 8 | Vitess | Horizontal scaling layer over MySQL | Vitess | database-proxy | |
| 9 | Redis (per pod) | Queues and background jobs; formerly one global instance (Redismageddon) | Redis | queue + cache | perPod: true |
| 10 | Memcached (per pod) | Key/value cache | Memcached | cache | |
| 11 | Background job workers | Async jobs off Redis queues | Rails jobs | worker | |
| 12 | Kafka | Event streaming to ETL; partitions increased for BFCM freshness | Apache Kafka | stream | |
| 13 | ETL / analytics pipeline | Data freshness during spikes | in-house | etl-job | |
| 14 | Elasticsearch | Search | Elasticsearch | search-index | |
| 15 | Ghostferry | Online shop migration between shards: batch copy with SELECT FOR UPDATE, binlog tailing, Redis multi-reader-single-writer lock, atomic routing update; TLA+ verified | Ghostferry (open source) | worker (migration) | formallyVerified: true |
| 16 | Semian | Circuit breaker for Redis/MySQL clients | Semian | edge property (circuitBreaker) | |
| 17 | Toxiproxy / Genghis | Network fault injection, load generation | Toxiproxy, Genghis | ops tooling, not tallied | |
| 18 | Kubernetes / GKE | Orchestration for stateless components | GKE | ops platform, not tallied | |
| 19 | Shipit / merge queue | Deploy orchestration, 5-10 commits per deploy | Shipit | ops tooling, not tallied | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| buyer | edge-lb | https | sync | | |
| edge-lb | sorting-hat | in-process lua | sync | | shop -> pod |
| edge-lb | checkout-throttle | in-process lua + redis | sync | | leaky bucket per shop |
| checkout-throttle | buyer | http (queue page) | sync | | cached in nginx; JS polls /checkout |
| edge-lb | shopify-core (pod) | http | sync | | routed by pod |
| edge-lb | storefront-renderer | http | sync | | |
| shopify-core | mysql-shard | mysql (via vitess) | sync | | one record per checkout, mutated every step |
| shopify-core | memcached | memcached | sync | | |
| shopify-core | redis | redis | async | at-least-once | enqueue jobs |
| redis | job-workers | redis | async | at-least-once | |
| shopify-core | kafka | kafka | async | at-least-once | |
| kafka | etl | kafka | async | | partitions sized for BFCM |
| shopify-core | elasticsearch | http | sync | | |
| storefront-renderer | mysql replica (filtered) | mysql replication | async | | data residency |
| ghostferry | mysql-source | mysql select for update + binlog | sync/async | | copy + tail |
| ghostferry | mysql-target | mysql | async | | replay |
| ghostferry | redis-lock | redis | sync | | cutover lock |
| ghostferry | sorting-hat routing table | internal | sync | | atomic switch |
| shopify-core | semian | in-process | sync | | breaker around redis/mysql |

## Failure modes, incidents, tradeoffs the source discusses
- Noisy neighbour on shared shard: Kylie Cosmetics 2016 sale "took down not just her store, but all others on the database shard where her store was allocated". Source: scriptable-lb.
- Hot row: "every checkout session created a new record in MySQL and, exacerbating that, every step in the flow modified that same record". Source: scriptable-lb.
- Unfair queue: random polling was "a lottery"; users waited "up to 40 minutes" during a 40-minute sale; fix was FIFO fairness. Source: scriptable-lb.
- Redismageddon: "All those shards were still using a single Redis... the outage of that Redis took down all of Shopify"; drove the pod architecture. Source: tech-stack.
- Pods bound blast radius: "Since moving to this architecture we haven't had any major outages that affected all of Shopify". Source: tech-stack.
- Only databases are podded, "they are the hardest component to scale"; stateless parts autoscale. Source: kovyrin.
- Shard imbalance: hottest vs coldest shard differed "almost four times"; online rebalancing with Ghostferry; brief write-halt at cutover only. Source: shard-balancing.
- Cutover correctness: Redis-backed multi-reader-single-writer lock, final binlog coordinate, "no data loss"; algorithm modelled in TLA+. Source: shard-balancing.
- BFCM bottlenecks found only under load: Kafka partition capacity, API memory, connection timeouts vs pool exhaustion, regional failover routing delay; "Each test cycle identified issues we would never see in steady-state load". Source: bfcm-2025.
- Deploy risk managed by feature flags and fast rollback rather than staging; merge queue limits deploy rate at peak. Source: tech-stack.
- Data residency forced filtered replication for global storefront rendering. Source: kovyrin.

## Unknowns
- CDN and static asset path (not covered by these sources)
- Payment processing path (Shopify Payments) not covered
- Current checkout architecture after the 2018 band-aid
- Cross-region failover mechanics for pods

## Candidates
- New kinds: rate-limiter (leaky bucket at edge; also in MVP doc list), plus sightings: load-balancer (6th), coordination-service (3rd, tenant router), database-proxy (5th), queue (4th), stream (4th), search-index (3rd), worker (7th), etl-job (5th), sql-database (9th), cache (9th)
- New group kind: cell / pod (tenant-isolated slice containing db, cache, queue); needed for blast-radius rules
- New properties on existing kinds: sql-database.shardKey (string); load-balancer.scriptable (boolean); rate-limiter.algorithm (token-bucket, leaky-bucket, sliding-window), windowSeconds, fairness (none, fifo); cache/queue.perCell (boolean); app-server.autoscaling (2nd sighting)
- New edge properties: circuitBreaker (2nd sighting: Semian); hotRow (informational)
- New requirement paths: tenancy.isolation (shared, cell, dedicated); traffic.peakMultiplier (integer); availability.blastRadius (platform, region, cell)
- New rules:
  - shared-datastore-across-tenants-with-cell-requirement: tenancy.isolation cell but a datastore node is outside any cell group
  - single-shared-queue-across-cells: queue or cache shared by all cells when cells exist (Redismageddon)
  - write-burst-without-admission-control: design with traffic.peakMultiplier high and checkout/write edges from clients with no rate-limiter in path
  - queue-page-without-fairness: rate-limiter with fairness none and human clients (informational, from the lottery incident)
  - shard-without-rebalancing-path: sharded sql-database with no migration worker or documented rebalancing (informational)
