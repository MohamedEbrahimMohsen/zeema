# Intake: Twitter home timeline (fan-out, timeline cache, search, push)

## Source
- Primary: https://highscalability.com/the-architecture-twitter-uses-to-deal-with-150m-active-users/ (detailed write-up of Raffi Krikorian, VP Engineering Twitter, QCon SF 2012 "Timelines at Scale")
- Primary talk page: https://www.infoq.com/presentations/Twitter-Timeline-Scalability
- Primary: https://blog.x.com/engineering/en_us/topics/infrastructure/2017/the-infrastructure-behind-twitter-scale (official, 2017; fetch blocked with 403 in this pass, used via search summary: Manhattan, Haplo, cache tiers)
- Secondary: https://dev.to/gabrielanhaia/twitters-fanout-strategy-at-scale-the-trade-off-most-designs-miss-55oa (hybrid fan-out thresholds, cites Krikorian talk)
- Verified by: conference talk by Twitter VP Engineering + official engineering blog + secondary
- Confidence: high for 2012-2017; low for post-2022 changes
- Date of source: 2012, 2017

## System in three lines
Delivers each user's home timeline: the recent tweets of everyone they follow, in under five seconds from posting. Writes are fanned out at post time into per-user Redis lists so reads are a single cache lookup; celebrity accounts are merged at read time instead. Hard because the follower distribution has a brutal tail, reads outnumber writes 50:1, and search, push and timelines each need a different data shape.

## Scale (only if stated)
- Users / DAU: 150M active users (2012)
- Requests per second: 300K QPS timeline reads; 6K QPS tweet writes
- Data volume: 400M tweets/day; timelines capped at 800 entries per user; 3x replication in Redis
- Message throughput: Firehose 22 MB/s public tweets over ~1M open sockets
- Fan-out latency: p50 3.5 s to 1M followers; p99 about 5 minutes; target "under 5 seconds"
- Cache tier budget: ~10K writes/sec typical (secondary)

## Requirements stated or clearly implied
- Availability target: not quantified; multi-datacenter (2017 post)
- Consistency: eventual; timeline may lag seconds to minutes
- Latency target: tweet visible to followers within 5 s; read path single cache hop
- Ordering needs: reverse-chronological per timeline (later ranked)
- Replay or reprocessing: cache miss triggers "reconstruction" from disk; inactive users (>30 days) evicted from cache
- Retention: 800 entries in cache; full history on disk
- Compliance / residency: not stated

## Boundaries
- Regions / zones: multiple datacenters with backbone (2017); Redis cluster in 3 hash rings
- Trust zones: clients -> load balancer -> TFE (Twitter Front End) -> internal services
- Named subsystems: Write path (Write API, Fanout), Read path (Timeline Service, hydration via Tweetypie and Gizmoduck), Search (Ingester, Earlybird, Blender), Push (Firehose, User Streams, Query API, mobile push), Storage (Manhattan, Gizzard/MySQL, Flock, Hadoop), Observability (VIZ, Zipkin)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Clients | Web, mobile, third-party via API | web, iOS, Android | web-client, mobile-client | |
| 2 | Load balancers | Front door | not named | load-balancer | |
| 3 | TFE (Twitter Front End) | Edge proxy, routing, auth | in-house | api-gateway | |
| 4 | Write API | Accepts tweets, persists, triggers fanout | in-house | app-server | rps: 6000 |
| 5 | Fanout daemon | For each follower, insert tweet id into their Redis timeline; pipelined 4K destinations | in-house | worker | fanoutStrategy: push; celebrityThreshold: 10000 followers |
| 6 | Social Graph Service (Flock / FlockDB) | Followers and followees, sharded via Gizzard | FlockDB on MySQL | graph-database (new) | |
| 7 | Redis timeline cache (later Haplo) | Per-user list of ~800 tweet ids, 3x replicated, active users only | Redis, Haplo (customised Redis HybridList) | cache | evictionPolicy: lru (30-day inactivity); replication: 3x; listCap: 800 |
| 8 | Timeline Service | Reads timeline from fastest of 3 hash rings, merges celebrity tweets at read time, hydrates | in-house | app-server | rps: 300000 |
| 9 | Tweetypie | Tweet service with caching in front of tweet store | in-house | app-server | |
| 10 | Gizmoduck | User service with caching | in-house | app-server | |
| 11 | T-bird / Manhattan | Tweet store: MySQL sharded via Gizzard (T-bird), later Manhattan KV sharded by tweet id | Gizzard + MySQL; Manhattan | sql-database (sharded) -> nosql-database | sharded: true |
| 12 | Gizzard | Sharding and replication middleware over MySQL | Gizzard | database-proxy | sharding: true; replication: global |
| 13 | Memcache / Twemcache | General object cache tier | Twemcache, memcached | cache | |
| 14 | Ingester | Tokenises tweets for search | in-house | worker | |
| 15 | Earlybird | In-memory Lucene variant; one shard per machine; O(1) write, O(n) read | Earlybird (Lucene) | search-index (new) | inMemory: true |
| 16 | Blender | Scatter-gather across Earlybird shards, merge and rerank | in-house | app-server | pattern: scatter-gather |
| 17 | Firehose / User Streams / Query API | Real-time push over ~1M long-lived sockets; standing queries matched at write time | in-house | realtime-gateway | connections: 1000000; throughputMBps: 22 |
| 18 | Mobile push | APNs/GCM bridge | in-house | notification-service | |
| 19 | Hadoop batch compute | Offline computation feeding timelines and analytics | Hadoop | data-warehouse / etl-job | |
| 20 | EventBus / Kafka | Internal event streaming (2017) | Kafka-based EventBus | stream | |
| 21 | Blobstore | Media storage (2017) | in-house | object-store | |
| 22 | VIZ | Cluster dashboards | in-house | monitoring | |
| 23 | Zipkin | Distributed tracing (Dapper-style) | Zipkin | tracing | |
| 24 | Mesos / Aurora | Cluster scheduling (2017) | Apache Mesos, Aurora | ops platform, not tallied | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | load-balancer | https | sync | | |
| load-balancer | tfe | http | sync | | |
| tfe | write-api | thrift/http | sync | | post tweet |
| write-api | tweet-store | thrift | sync | | persist first |
| write-api | fanout | queue | async | at-least-once | |
| fanout | social-graph | thrift | sync | | list followers |
| fanout | redis-timeline | redis pipelined | async | at-most-once | 4K destinations per pipeline; 3 replicas |
| tfe | timeline-service | thrift | sync | | read home timeline |
| timeline-service | redis-timeline | redis | sync | | fastest of 3 rings |
| timeline-service | tweet-store | thrift multiget | sync | | hydration; also reconstruction on miss |
| timeline-service | tweetypie / gizmoduck | thrift | sync | | metadata |
| timeline-service | celebrity timelines | thrift | sync | | merge at read for >10K followers |
| write-api | ingester | queue | async | | search indexing |
| ingester | earlybird | internal | async | | one shard |
| tfe | blender | thrift | sync | | search query |
| blender | earlybird (all shards) | thrift | sync | | scatter-gather |
| write-api | firehose | internal | async | at-most-once | 1M sockets |
| firehose | external consumers | streaming http | async | at-most-once | |
| write-api | mobile-push | queue | async | at-most-once | |
| hadoop | redis-timeline / services | batch push | async | | precomputed |
| services | zipkin / viz | async | async | | tracing, metrics |

## Failure modes, incidents, tradeoffs the source discusses
- Fan-out tail: "For people like Taylor Swift don't bother with fanout anymore, instead merge in her timeline at read time." Source: highscalability.
- Push vs pull: "Push is fast to read, brutal at the tail of the follower distribution. Pull is fast to write, brutal on every read." Source: dev.to (attributed to Krikorian).
- Write amplification: 31M followers means 31M cache writes times 3 replicas. Source: highscalability.
- Cache holds only active users (30 days); others pay expensive reconstruction from disk on return. Source: highscalability.
- 800-entry cap: "If you page back long enough you'll hit the limit"; RAM-bound. Source: highscalability.
- Read fastest of 3 hash rings to cut tail latency. Source: highscalability.
- Search is the inverse shape: O(1) write, O(n) scatter-gather read; only recent tweets in RAM. Source: highscalability.
- Fanout latency p99 minutes for large accounts despite 5 s target. Source: highscalability.
- Cold start: new or inactive user gets one-time fanout-on-read bootstrap; new follow backfills. Source: dev.to.

## Unknowns
- Exact celebrity threshold in production (10K is "commonly cited")
- Manhattan consistency model and replication factor
- Post-2022 architecture changes
- Retention of firehose messages (none implied)

## Candidates
- New kinds: graph-database (FlockDB, Neo4j, Neptune), search-index (Earlybird, Elasticsearch, OpenSearch), database-proxy (2nd sighting: Gizzard), realtime-gateway (3rd), notification-service (2nd), stream (3rd), tracing (2nd), monitoring (3rd), data-warehouse (2nd), etl-job (3rd)
- New properties on existing kinds: cache.listCap (integer); cache.replicas (integer); worker.fanoutStrategy (push, pull, hybrid); worker.fanoutThreshold (integer); search-index.inMemory (boolean); app-server.pattern (scatter-gather)
- New edge properties: pipelined (boolean); readFastestReplica (boolean)
- New requirement paths: latency.propagationSeconds (write to visible); traffic.readWriteRatio
- New rules:
  - push-fanout-without-celebrity-path: worker fanoutStrategy push with no read-merge edge and no fanoutThreshold while social graph present
  - timeline-cache-without-rebuild-path: cache holding materialised lists with no edge to a durable store for reconstruction
  - scatter-gather-without-timeout: app-server pattern scatter-gather with sync edges lacking timeoutMs
  - single-replica-materialised-cache: cache with listCap set and replicas 1 (loss = rebuild storm)
  - propagation-target-with-sync-fanout: latency.propagationSeconds set and fanout edge sync
