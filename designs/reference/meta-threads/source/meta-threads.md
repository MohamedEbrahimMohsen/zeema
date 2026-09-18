# Intake: Threads (Meta) — five-month build and the 100M-signup launch

## Source
- Primary: https://engineering.fb.com/2023/12/19/core-infra/how-meta-built-the-infrastructure-for-threads/ (Meta core-infra engineers, Engineering at Meta, 2023)
- Primary: https://engineering.fb.com/2023/09/07/culture/threads-inside-story-metas-newest-social-app/ (Threads team interviews, Engineering at Meta, 2023)
- Primary: https://engineering.fb.com/2023/11/06/android/how-meta-built-threads-in-5-months/ (Meta Tech Podcast ep. 56 with Joy Qiu backend, Cameron Roth iOS, Richard Zadorozny Android, Engineering at Meta, 2023)
- Primary: https://engineering.fb.com/2021/08/06/core-infra/zippydb/ (ZippyDB team, Engineering at Meta, 2021)
- Primary: https://engineering.fb.com/2013/06/25/core-infra/tao-the-power-of-the-graph/ (TAO team, Engineering at Meta, 2013)
- Primary: https://engineering.fb.com/2023/05/16/data-infrastructure/mysql-raft-meta/ (MySQL infra team, Engineering at Meta, 2023)
- Primary: https://tangchq74.github.io/XFaaS-SOSP23-Final.pdf — Sahraei et al., "XFaaS: Hyperscale and Low Cost Serverless Functions at Meta" (Meta engineers + academics, SOSP '23, doi 10.1145/3600006.3613155; ACM DL page https://dl.acm.org/doi/10.1145/3600006.3613155 blocks fetching, the author-hosted PDF of the same paper was read in full)
- Primary: https://engineering.fb.com/2024/03/21/networking-traffic/threads-has-entered-the-fediverse/ (Engineering at Meta, 2024)
- Secondary: https://newsletter.pragmaticengineer.com/p/building-the-threads-app (Pragmatic Engineer, based on interviews with the Threads team, 2023)
- Verified by: official engineering blog (Engineering at Meta, six posts) + peer-reviewed SOSP 2023 paper by Meta engineers + reputable secondary (Pragmatic Engineer)
- Confidence: high
- Date of source: 2013, 2021, 2023, 2024

## System in three lines
Threads is a text-first public social app built on Instagram's account graph: you sign in with your Instagram identity, import the people you already follow, post short text with replies, and read a ranked feed. It was written in about five months by a team that peaked near 60 engineers, and it is deliberately not a new stack — it is Instagram's Django tier, Meta's TAO/MySQL social graph, ZippyDB for counters and feed state and search, and the Async (XFaaS) function platform for everything deferrable. What makes it hard is that none of that was scaled for the launch: the infrastructure teams got two days' notice, load testing was skipped, and the onboarding path ("follow everyone I follow on Instagram", then notify them) turned every one of 100M signups into a fan-out of graph writes and notifications.

## Scale (only if stated)
- Users: 100+ million sign-ups in the first five days; 1M in the first hour and 30M in the first day (https://newsletter.pragmaticengineer.com/p/building-the-threads-app); "the most successful app launch of all time" (https://engineering.fb.com/2023/09/07/culture/threads-inside-story-metas-newest-social-app/)
- Team and time: ~60 engineers, ~66 people including 3 PMs and 3 designers; five months from first line of code in late January 2023 to launch on 5 July 2023 (https://engineering.fb.com/2023/09/07/culture/threads-inside-story-metas-newest-social-app/, https://newsletter.pragmaticengineer.com/p/building-the-threads-app)
- Lead time for infra: "the business finally made the decision and informed the infrastructure teams to prepare for its launch with only two days' advance notice" (https://engineering.fb.com/2023/12/19/core-infra/how-meta-built-the-infrastructure-for-threads/)
- ZippyDB headroom prepared: resharding for a "100x" increase in load, with zero downtime for clients; capable of absorbing thousands of machines within hours (https://engineering.fb.com/2023/12/19/core-infra/how-meta-built-the-infrastructure-for-threads/)
- ZippyDB shard geometry: physical shards typically 50-100 GB, each hosting tens of thousands of micro-shards; in production since 2013 (https://engineering.fb.com/2021/08/06/core-infra/zippydb/)
- Async / XFaaS: "trillions of function calls per day on more than 100,000 servers spread across tens of datacenter regions", ~11.5M function calls/sec at peak, 66% daily average CPU utilisation, 18,377 unique functions executed in a month (https://tangchq74.github.io/XFaaS-SOSP23-Final.pdf)
- Async job volume at launch: "several orders of magnitude higher" than the job volume the Threads team had estimated (https://engineering.fb.com/2023/12/19/core-infra/how-meta-built-the-infrastructure-for-threads/)
- TAO: "over a billion read requests and millions of write requests every second" across "hundreds of thousands of shards" (https://engineering.fb.com/2013/06/25/core-infra/tao-the-power-of-the-graph/)
- MySQL fleet under TAO: "millions of shards holding petabytes of data" across multiple continents; graceful promotion ~300 ms, failover within 2 s (previously 20-40 s) (https://engineering.fb.com/2023/05/16/data-infrastructure/mysql-raft-meta/)

## Requirements stated or clearly implied
- Availability target: launch had to hold "without any major downtime" while onboarding 100M users in five days; ZippyDB resharding had to be "zero downtime for clients"; MySQL Raft rings span three regions with three primary-capable regions so a region can be lost (https://engineering.fb.com/2023/09/07/culture/threads-inside-story-metas-newest-social-app/, https://engineering.fb.com/2023/12/19/core-infra/how-meta-built-the-infrastructure-for-threads/, https://engineering.fb.com/2023/05/16/data-infrastructure/mysql-raft-meta/)
- Consistency: TAO is eventually consistent by default, single primary per shard, write-through cache gives read-after-write in the writing region; ZippyDB is per-request configurable — eventual with bounded staleness, read-your-writes via client-cached sequence numbers, or strong (linearizable) reads routed to the primary; ZippyDB transactions are serializable per shard under optimistic concurrency control; MySQL Raft/FlexiRaft gives a provably safe promotion with a 2-of-3 in-region data quorum
- Latency target: not stated for Threads endpoints. The launch dashboards watched "time to new content" (cold-start feed latency) and QPS/success rate on critical endpoints (https://newsletter.pragmaticengineer.com/p/building-the-threads-app). XFaaS explicitly does not serve sub-second interactive requests: "XFaaS workloads seldom handle user-facing interactive requests that demand sub-second response times"
- Ordering needs: TAO associations are "grouped by origin and ordered by time"; each DurableQ in Async keeps a per-function queue ordered by execution start time; no global ordering claimed
- Replay or reprocessing: Async DurableQ offers at-least-once — a function call is redelivered to another scheduler on NACK or on ACK timeout, so functions must tolerate retries; retry policy is a per-function attribute
- Retention: ZippyDB supports native TTL, cleaned up through RocksDB periodic compaction. Threads-specific retention not stated
- Compliance / residency: Akkio places ZippyDB micro-shards in the region that accesses them; Threads' EU launch and federation are gated separately — fediverse sharing is opt-in and limited to public profiles aged 18+ (https://engineering.fb.com/2024/03/21/networking-traffic/threads-has-entered-the-fediverse/)
- Capacity model: ZippyDB "runs on a common pool of hardware and is plugged into Meta's overall capacity management framework", which is what let it absorb thousands of machines in hours; Async functions carry reserved (seconds-level SLO) or opportunistic (24-hour SLO) quota

## Boundaries
- Regions / zones: Meta datacenter regions, "tens of datacenter regions" for XFaaS; ZippyDB tiers span geographic regions with quorum groups plus asynchronous followers; MySQL Raft rings are three regions, three primary-capable; XFaaS hardware capacity is unevenly distributed across regions, which is why QueueLB and the Global Traffic Conductor move work between them
- Trust zones: public clients -> Instagram-shared login/privacy/security/integrity layer -> Django API tier -> Meta internal data plane (TAO, ZippyDB, Async); XFaaS adds internal isolation zones — namespaces with dedicated worker pools for functions needing strong isolation, and a Bell-LaPadula multilevel information-flow policy enforced by the scheduler and workers between zones; the fediverse is a separate external trust zone reached over ActivityPub server-to-server
- Named subsystems: Threads Django API tier (shared with Instagram), Meta HHVM/Hack monolith over GraphQL, TAO, MySQL (MySQL Raft), ZippyDB (Data Shuttle, ShardManager, Akkio), Async/XFaaS (submitter, QueueLB, DurableQ, scheduler, WorkerLB, worker pools, Central Rate Limiter, Global Traffic Conductor, Locality Optimizer, Utilization Controller), Configerator, ODS, Scuba, the notification system, feed ranking, keyword search, ActivityPub federation

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Threads mobile apps | Native clients: iOS in Swift (some Objective-C), Android in Jetpack Compose; some screens server-rendered | in-house (Swift; Kotlin/Java with Jetpack Compose) | client | platforms: ios, android |
| 2 | Threads/Instagram Django API tier | Stateless REST API tier; "Python (Django), same as Instagram"; reuses Instagram UI frameworks, APIs, data models and business logic | Python, Django | app-server | stateless: true; sharedWith: instagram |
| 3 | Meta monolith (HHVM) via GraphQL | Meta's Hack/PHP backend reached from the app over GraphQL for parts of the experience | HHVM / Hack, GraphQL | app-server | protocol: graphql (secondary source) |
| 4 | Instagram login / privacy / security / integrity | Account identity and policy layer reused wholesale; Threads sign-in is an Instagram account | in-house (Instagram) | identity-provider | reused: true |
| 5 | TAO | Social graph store for Threads posts, replies and the follow graph; two-tier regional cache (followers then leaders) over MySQL | TAO | graph-database | shards: hundreds of thousands; cacheTiers: 2 (follower, leader); primaryPerShard: true; consistency: eventual with read-after-write through write-through cache |
| 6 | MySQL | Persistent store under TAO; one database per shard | MySQL | sql-database | shards: millions; data: petabytes; replication: MySQL Raft (FlexiRaft) |
| 7 | MySQL Raft ring | Replication/consensus group: 3 primary-capable regions each with a MySQL server plus 2 log-only logtailers, plus 3 non-primary-capable learners = 12 entities | MySQL Raft, FlexiRaft | sql-database (replication topology) | dataQuorum: 2 of 3 in-region; separate leader-election quorum; log: MySQL binlog reused as Raft log; gracefulPromotion: ~300 ms; failoverDetection: <2 s |
| 8 | ZippyDB | Key/value store; for Threads it holds "counters, feed ranking/state, and search" | ZippyDB | nosql-database | storageEngine: rocksdb; physicalShard: 50-100 GB; microShardsPerShard: tens of thousands; ttl: native, reclaimed by RocksDB periodic compaction; consistency: per-request eventual / read-your-writes / strong; transactions: serializable per shard, OCC; multiTenant: true; replication: Data Shuttle Multi-Paxos, synchronous to all replicas in the quorum group plus async followers outside it; writes: majority-durable before ACK, or fast-acknowledge enqueued on the primary |
| 9 | ShardManager | Assigns and leases ZippyDB shard leadership, detects failure, rebalances load | ShardManager (Meta) | coordination-service | leadership: epoch lease renewed by heartbeat |
| 10 | Akkio | Places ZippyDB micro-shards in the region that reads them, instead of replicating everywhere | Akkio (Meta) | data-placement-service (new) | placementUnit: micro-shard |
| 11 | Async (XFaaS) | Serverless function platform that runs everything deferrable: Instagram-follow import, notification fan-out, off-peak work | XFaaS (Meta), runtimes HackLang/PHP, Python, Erlang, Haskell, C++ | worker (platform; see rows 14-19 for its parts) | servers: 100,000+; regions: tens; calls: trillions/day (~11.5M/s peak); utilisation: 66% daily average CPU; namespaces: 20+; deadline: seconds to 24 h |
| 12 | Submitter | Accepts function calls from clients, batches them into one DurableQ write, enforces rate limiting; separate submitter sets for normal and very spiky clients per region | XFaaS submitter | api-gateway | stateless: true; batching: true; largeArgs: spilled to a distributed key-value store; spikyClientsIsolated: true |
| 13 | QueueLB | Routes submitter traffic to DurableQs, following a per-(source-region, destination-region) policy from Configerator | XFaaS QueueLB | load-balancer | stateless: true; crossRegion: true |
| 14 | DurableQ | Sharded, stateful durable queue; one queue per function ordered by execution start time; the only stateful component on the call path | XFaaS DurableQ, on a sharded database | queue | shardingKey: random UUID; delivery: at-least-once with ACK/NACK and redelivery on timeout; scheduling: start time may be hours in the future |
| 15 | Scheduler | Pulls due calls from DurableQs into per-function FuncBuffers, orders by criticality then deadline, emits one RunQ; applies backpressure upward when the RunQ builds | XFaaS scheduler | workflow-engine | stateless (in-memory FuncBuffers + RunQ); ordering: criticality then execution deadline; flowControl: RunQ depth throttles DurableQ polling; crossRegionPull: per Global Traffic Conductor matrix |
| 16 | WorkerLB | Dispatches RunQ items to workers; picks two random workers inside the function's locality group and takes the less loaded | XFaaS WorkerLB | load-balancer | algorithm: power of two choices, scoped to locality group |
| 17 | Worker pool | Dedicated servers per namespace, one language runtime always resident, function code pre-pushed to local SSD peer-to-peer, cooperative JIT | XFaaS worker | worker | perNamespace: true; coldStart: eliminated (code pre-staged, runtime always up); codePush: every 3 hours, phased (small set -> 2% -> all); concurrency: many functions per Linux process |
| 18 | Central Rate Limiter | Global per-function RPS ceiling derived from a CPU-cycles-per-second quota; consulted by submitters and schedulers | XFaaS Central Rate Limiter | rate-limiter | scope: global; quotaTypes: reserved (seconds SLO) and opportunistic (24 h SLO); AIMD adjustment on downstream back-pressure; slow start: +20% per minute above 100 calls/window |
| 19 | XFaaS central controllers | Global Traffic Conductor (near-real-time global view of pending calls vs worker capacity, publishes a region-to-region traffic matrix), Locality Optimizer (partitions functions and workers into locality groups), Utilization Controller (tunes the opportunistic-quota multiplier to a target utilisation) | XFaaS GTC / Locality Optimizer / Utilization Controller | policy-engine | traffic matrix a[i][j] distributed via Configerator; locality groups non-overlapping with memory-hungry functions spread apart; utilisation multiplier stored in a database and polled by schedulers |
| 20 | Configerator | Configuration management system that delivers routing policies, traffic matrices and shard maps; ZippyDB logical-to-physical shard mapping changes are live config changes | Configerator (Meta) | feature-flag-service | offCriticalPath: true; cached locally by consumers |
| 21 | Notification system | Sends the launch-time follow and activity notifications; the sends themselves run inside Async so they can be rate-limited | in-house (Meta/Instagram) | notification-service | rateLimited: true, "without manual intervention" |
| 22 | Feed ranking / state | Ranks the Threads feed and stores per-user feed state; the state and ranking keyspaces live in ZippyDB | in-house | ml-inference (+ nosql-database for state) | store: zippydb |
| 23 | Search | Keyword search over Threads; its keyspace is a ZippyDB use case. Full keyword search was deferred past launch | in-house | search-index | store: zippydb; deferredAtLaunch: true |
| 24 | ODS and Scuba | ODS is the time-series metrics store watched on launch day; Scuba is the real-time slice-and-dice analysis system used alongside it | ODS, Scuba (Meta) | timeseries-database (ODS) + bi-service (Scuba) | realtime: true |
| 25 | ActivityPub federation (2024) | Server-to-server publishing of opted-in public Threads posts to other ActivityPub servers, and later inbound replies | ActivityPub (W3C), FEP-e232 and _misskey_quote for quote posts | third-party-api | direction: outbound first, inbound phased; eligibility: public profiles, 18+, opt-in; excluded: posts with restricted replies, posts with polls, replies to non-federated posts |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| threads-ios / threads-android | django-api-tier | https (REST) | sync | | Instagram's API surface reused |
| threads-ios / threads-android | meta-monolith | https (GraphQL) | sync | | secondary source; parts of the experience served from HHVM |
| django-api-tier | instagram-identity | internal rpc | sync | | sign-in with the Instagram account |
| django-api-tier | tao | thrift/rpc | sync | | posts and replies read and written as objects and associations |
| tao-follower-cache | tao-leader-cache | internal | sync | | all writes go through followers to leaders; cache fills go the same way |
| tao-leader-cache | mysql | mysql | sync | | one MySQL database per shard |
| tao-secondary-region | tao-primary-region | internal | sync (write forward) | | single primary per shard; secondaries forward writes |
| mysql-leader | mysql-follower / logtailer | MySQL Raft (binlog as Raft log) | sync to data quorum | committed on 2-of-3 in-region quorum | learners replicate asynchronously as read replicas |
| django-api-tier | zippydb | thrift/rpc | sync | per-request eventual / read-your-writes / strong | counters, feed ranking and state, search |
| zippydb-primary | zippydb-replica | Data Shuttle Multi-Paxos | sync inside quorum group | majority durable before ACK (or fast-acknowledge) | async followers replicate outside the quorum |
| shardmanager | zippydb-shard | internal | async | | leadership assignment via epoch lease + heartbeats |
| akkio | zippydb | internal | async | | micro-shard migration toward the reading region |
| configerator | zippydb / queuelb / scheduler / workerlb | config distribution | async | | shard map and routing policy changes; cached by consumers, off the critical path |
| django-api-tier | xfaas-submitter | rpc | async (fire and forget) | | onboarding follow import and notification jobs; "non-blocking" for the user |
| xfaas-submitter | central-rate-limiter | rpc | sync | | global usage check before accepting |
| xfaas-submitter | queuelb | rpc | sync | | batched writes; oversized arguments spilled to a key-value store |
| queuelb | durableq | rpc | sync | | sharded by random UUID; may cross regions per Configerator policy |
| scheduler | durableq | poll | async | at-least-once | pulls calls whose start time has passed; a call offered to one scheduler is not offered to another unless it fails |
| scheduler | durableq | ACK / NACK | async | | ACK removes the call; NACK or timeout makes it retrievable again |
| scheduler | global-traffic-conductor (via configerator) | config | async | | traffic matrix decides the fraction pulled from each region |
| scheduler | workerlb | rpc | sync | | RunQ dispatch, ordered by criticality then deadline |
| workerlb | worker | rpc | sync | | power of two choices within the function's locality group |
| worker | tao / mysql | rpc | sync | | the follow writes land on the social graph |
| worker | notification-service | rpc | async | | notification fan-out, rate limited by Async |
| notification-service | threads-ios / threads-android | push (APNs / FCM not named) | async | not stated | |
| downstream service (e.g. tao) | central-rate-limiter | back-pressure exception | async | | AIMD: RPS multiplied by b on sustained back-pressure, increased additively when clear |
| django-api-tier / xfaas / zippydb | ods | metrics push | async | | launch-day dashboards |
| django-api-tier / xfaas | scuba | event logging | async | | real-time analysis during the launch |
| threads-federation | external activitypub server | https (ActivityPub S2S) | async | not stated | outbound publishing of opted-in public posts |
| external activitypub server | threads-federation | https (ActivityPub S2S) | async | not stated | inbound replies, phased in after the initial release |

## Failure modes, incidents, tradeoffs the source discusses
- Two days of warning for a 100M-user launch. "the business finally made the decision and informed the infrastructure teams to prepare for its launch with only two days' advance notice." The mitigation was not a Threads-specific build-out but pre-existing elasticity: ZippyDB "runs on a common pool of hardware and is plugged into Meta's overall capacity management framework", so it could absorb thousands of machines within hours. Source: https://engineering.fb.com/2023/12/19/core-infra/how-meta-built-the-infrastructure-for-threads/
- Resharding under live load instead of over-provisioning. ZippyDB's resharding protocol "allows us to quickly and transparently increase the sharding factor … with zero downtime for clients", and the team prepared for a 100x load increase this way. The enabler is the logical-to-physical micro-shard indirection: shard-map changes are live configuration changes, so clients never learn a new topology. Source: https://engineering.fb.com/2023/12/19/core-infra/how-meta-built-the-infrastructure-for-threads/, https://engineering.fb.com/2021/08/06/core-infra/zippydb/
- Multi-tenancy as a launch strategy. Because ZippyDB gives "strong multi-tenancy and its strong isolation features", a brand-new keyspace could share hosts with everything else and still get its own service level — the reason Threads did not need a dedicated fleet.
- The onboarding fan-out was the real load, and it was mis-estimated. Letting every new user "follow people on Threads that they already follow on Instagram" turns one signup into a burst of graph writes, and a celebrity joining queues "millions" of follows and notifications. The observed job volume was "several orders of magnitude higher" than expected; "Async gracefully absorbed the increased load and queued them for controlled execution", rate-limiting notifications "without manual intervention". Source: https://engineering.fb.com/2023/12/19/core-infra/how-meta-built-the-infrastructure-for-threads/
- Deferred work is the shock absorber. XFaaS's reserved-vs-opportunistic quota lets delay-tolerant calls run with a 24-hour SLO at a dynamically scaled rate: "If workers are underutilized, b increases. Conversely, if workers are overloaded, b can decrease all the way down to zero, causing the scheduling of opportunistic functions to stop." Source: XFaaS SOSP '23 §4.6.2
- A function overloaded TAO and cascaded. "the social-graph database called TAO experienced high load during its peak hours … additional load from a high-volume function running on XFaaS unexpectedly exacerbated the situation, overloading TAO and causing excessive failures and retries. These failures and retries amplified queries to several downstream services, resulting in degraded availability of TAO and further overloading an indexing service, subsequently causing a domino effect." Root-cause and manual mitigation "took place over the course of a full day", ending with a large portion of XFaaS executions paused by hand. This is the incident that produced the AIMD congestion control, the per-function concurrency limit, and slow start. Source: XFaaS SOSP '23 §4.6.3
- Back-pressure thresholds are owner-set and stable. "for two of our largest downstream services, the threshold was set at 5,000 exceptions per minute, which has worked robustly without any changes for the past two years." Concurrency limits exist as the weaker safety net "since not every downstream service is well-implemented to throw back-pressure exceptions in overload situations." Source: XFaaS SOSP '23 §4.6.3
- Slow start for downstreams that cannot take a step change. A jump from r/10 to r/2 can break services that need to warm caches or autoscale, so RPS rises by at most 20% per minute once a function exceeds 100 calls per minute. Source: XFaaS SOSP '23 §4.6.3
- Spiky callers are physically separated. "each region has two sets of submitters, one for normal clients and another for very spiky clients … to prevent spiky clients from overly impacting normal clients", and moving a caller there needs human negotiation because it is an explicit SLO change. Source: XFaaS SOSP '23 §4.2
- Cold start is designed out rather than tuned. Rather than keep containers warm, XFaaS pushes every function's code to every worker's local SSD peer-to-peer and keeps the runtime resident, then uses cooperative JIT so profiling is done once by seeder workers and the result distributed — HHVM otherwise needs "up to 25 minutes to finish profiling" for ~500 MB of code. Locality groups bound how many functions a worker must keep hot. Source: XFaaS SOSP '23 §4.5
- Scope was cut, not stretched, to hold the date. "keyword search … and private messaging were put on hold for later updates, as were the decentralized features." Source: https://engineering.fb.com/2023/09/07/culture/threads-inside-story-metas-newest-social-app/
- Load testing was skipped. The team relied on Instagram's proven capacity and on launch-day dashboards (time to new content, QPS and success rate on critical endpoints, async job queue lengths, footprint on the Instagram monolith) instead of a pre-launch load test. Source: https://newsletter.pragmaticengineer.com/p/building-the-threads-app
- Build speed came from reuse, not from new frameworks. "this achievement wouldn't have been possible without Meta's existing systems and infrastructure"; the reused set is the Instagram tech stack, data models, business logic, security features and server infrastructure, plus graph indexing, ranking and notification systems. The product cost of that is that Threads inherits Instagram's data model shape.
- Iteration over design review. "Code wins arguments. If we tested a feature and didn't like it, we rebuilt it" — the activity feed was rewritten three times before launch. Source: https://engineering.fb.com/2023/09/07/culture/threads-inside-story-metas-newest-social-app/
- Failover correctness was moved into the database. Meta replaced semisynchronous MySQL replication plus external Python promotion daemons with Raft inside the server to get "provable correctness (safety property) across promotions and membership changes"; failover detection went from 20-40 s to under 2 s. Source: https://engineering.fb.com/2023/05/16/data-infrastructure/mysql-raft-meta/
- Federation is phased on purpose. Federated users initially "cannot see who liked their posts or any replies from people in the fediverse on Threads", and several post types never federate; "Building a federated social networking app is a complex and delicate process." Source: https://engineering.fb.com/2024/03/21/networking-traffic/threads-has-entered-the-fediverse/

## Unknowns
- No Threads-specific latency SLOs, QPS figures, or fleet sizes are published — every number is either a Meta-wide platform number or a signup count.
- The feed ranking path is named but not described: no model serving topology, no candidate generation, no ranking latency budget, no store layout beyond "feed ranking/state lives in ZippyDB".
- The media path (image and video attachments) is never described for Threads; whether it reuses Instagram's upload/transcode/CDN chain is implied by "server infrastructure" but not stated, so no CDN or object-store component is listed here.
- Which cache tier fronts the Django API for Threads (Memcache/TAO follower cache mix) is not stated, and neither is any Threads use of Cassandra.
- The push transport for notifications (APNs, FCM) is not named in any fetched source.
- The ActivityPub implementation's server-side topology — inbox/outbox stores, delivery workers, key management and signature verification, inbound spam handling, fan-out to followers on remote instances — is not disclosed.
- How ZippyDB's 100x resharding was actually sequenced on launch day (how many shards, over what window, whether it happened before or during the traffic ramp) is not given.
- Whether the Instagram-follow import used reserved or opportunistic Async quota, and what its criticality level was, is not stated.
- Threads' own region topology: which regions served the launch, whether there was any residency constraint before the EU launch.

## Candidates
- New kinds: data-placement-service (Akkio — second sighting, also in the instagram-feed card); everything else maps onto existing kinds.
- New properties on existing kinds:
  - `nosql-database.reshardable` (boolean) and `nosql-database.reshardFactor` (integer) — a store that can raise its sharding factor online without client changes
  - `nosql-database.logicalToPhysicalShardMap` (boolean) — the micro-shard indirection that makes the above possible
  - `nosql-database.multiTenant` (boolean) plus `isolationLevel` — shared hardware pool with per-keyspace service levels
  - `nosql-database.consistencyPerRequest` (list: eventual, read-your-writes, strong)
  - `queue.deliveryGuarantee` already exists in spirit; add `queue.scheduledDelivery` (boolean) for calls with a future execution start time and `queue.maxDeferral` (duration, 24 h here)
  - `worker.quotaClass` (reserved | opportunistic) and `worker.deadline` (duration)
  - `worker.coldStartStrategy` (pre-staged-code | container-warm | none)
  - `rate-limiter.scope` (global | regional) and `rate-limiter.adaptive` (aimd | fixed)
  - `edge.backPressure` (boolean) — the downstream may signal overload back to the caller
  - `edge.slowStart` (boolean) and `edge.concurrencyLimit` (integer)
  - `sql-database.consensus` (raft | semisync | async) with `dataQuorum` and `electionQuorum` as separate values
  - `app-server.sharedWith` (system id) — a tier reused from another product, which is the whole story here
- New requirement paths:
  - `capacity.leadTimeDays` (integer) — how much notice the infrastructure gets before a launch
  - `capacity.headroomFactor` (integer) — the 100x ZippyDB preparation
  - `workload.deferrableFraction` (0-1) — how much of the load can be time-shifted
  - `launch.loadTested` (boolean)
- New rules (name + one-line condition):
  - `async-fanout-without-downstream-backpressure`: a worker or workflow-engine writes to a graph-database or sql-database with no back-pressure or adaptive rate limiter between them (this is literally the TAO domino outage)
  - `unbounded-onboarding-fanout`: a signup or onboarding edge that triggers per-follow writes and notifications with no queue and no rate limiter on the path
  - `notification-fanout-without-rate-limit`: notification-service reached from a fan-out worker with no rate-limiter component on the edge
  - `sharded-store-without-online-resharding`: a nosql-database or sql-database on a launch path whose `reshardable` is false while `capacity.headroomFactor` > 10
  - `single-tenant-store-for-new-product`: a new keyspace given a dedicated fleet when a multi-tenant store with isolation exists (informational, cost rule)
  - `stateful-queue-single-region`: a queue that is the only stateful component on the call path but has no cross-region load balancing
  - `deferrable-work-on-reserved-quota`: a worker whose functions are delay-tolerant but hold reserved quota (cost rule)
  - `external-federation-without-trust-boundary`: an edge to a third-party-api representing untrusted peer servers with no policy-engine or waf between them

## Verification 2026-09-14

Spot check of the sources listed above (the card was written 2026-09-07; all primary URLs were
re-fetched on 2026-09-14).

| URL | Reachable | Outcome |
|---|---|---|
| https://engineering.fb.com/2023/12/19/core-infra/how-meta-built-the-infrastructure-for-threads/ | yes | Confirms the two days' notice, the 100x ZippyDB resharding with zero downtime for clients, "counters, feed ranking/state, and search", the Async job volume "several orders of magnitude higher" than expected and adjusted "without manual intervention", and absorbing thousands of machines in a few hours. |
| https://engineering.fb.com/2021/08/06/core-infra/zippydb/ | yes | Confirms RocksDB, 50-100 GB physical shards holding tens of thousands of micro-shards, Data Shuttle Multi-Paxos, ShardManager epoch leases renewed by heartbeat, Akkio micro-shard placement, per-request eventual / read-your-writes / strong consistency, serializable per-shard transactions under OCC, native TTL cleaned by RocksDB periodic compaction. |
| https://engineering.fb.com/2023/09/07/culture/threads-inside-story-metas-newest-social-app/ | yes | Confirms ~60 engineers, five months, 5 July 2023, 100M in five days, "the most successful app launch of all time", the Django/Python reuse of Instagram data models, business logic, security and server infrastructure, and that keyword search, DMs and the decentralised features were deferred. |
| https://engineering.fb.com/2023/05/16/data-infrastructure/mysql-raft-meta/ | yes | Confirms the three-primary-capable-region ring with one MySQL server plus two log-only logtailers per region and learners elsewhere, FlexiRaft's separate data and leader-election quorums with a 2-of-3 in-region data quorum, ~300 ms graceful promotion, failover detection under 2 s (from 20-40 s), millions of shards and petabytes. |
| https://engineering.fb.com/2013/06/25/core-infra/tao-the-power-of-the-graph/ | yes | Confirms over a billion reads and millions of writes per second, hundreds of thousands of shards, the follower/leader two-tier regional cache over MySQL, single primary per shard with secondaries forwarding writes, eventual consistency with best-effort read-after-write through the write-through cache, associations grouped by origin and ordered by time. |
| https://engineering.fb.com/2024/03/21/networking-traffic/threads-has-entered-the-fediverse/ | yes | Confirms ActivityPub server-to-server federation, opt-in for public profiles aged 18+, outbound first with inbound phased in, the excluded post types, and that federated users cannot yet see fediverse likes or replies. |
| https://tangchq74.github.io/XFaaS-SOSP23-Final.pdf | yes (PDF downloaded; the markdown converter could not parse it, so the PDF text was extracted locally) | Confirms Submitter, QueueLB, DurableQ, Scheduler with FuncBuffers and RunQ, WorkerLB, worker pools per namespace, Locality Optimizer, Utilization Controller, Global Traffic Conductor, the DurableQ random-UUID sharding, at-least-once with ACK/NACK and redelivery on timeout, the power-of-two-random-choices dispatch inside a locality group, the Bell-LaPadula information-flow isolation, deadlines from seconds to 24 hours, slow start at 20% per minute above 100 calls per window, the 5,000-exceptions-per-minute back-pressure threshold, a 4.3x peak-to-trough ratio, trillions of calls per day on more than 100,000 servers, 66% daily average CPU and 18,377 unique functions in a month. |
| https://newsletter.pragmaticengineer.com/p/building-the-threads-app | not re-fetched | Secondary source; nothing in this design rests on it alone except the GraphQL/HHVM path, which is marked `assumed` in notes.md. |

### Facts the card states that could NOT be confirmed

- **"~11.5M function calls/sec at peak"** (XFaaS). The extracted PDF text contains no such figure; it
  appears to come from a figure axis rather than from prose. Dropped: no per-second rate is set on
  any Async node.
- **Threads-specific latency or QPS targets.** Still not published, as the card already says. No
  `latency` requirement and no `nfr.rps` on any Threads-owned node.
- Everything else the card asserts was found in the re-fetched sources.
