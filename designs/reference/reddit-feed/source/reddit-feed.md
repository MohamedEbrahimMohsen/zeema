# Intake: Reddit feed, comment trees, ThingDB, media metadata store, Kafka safety pipeline

## Source
- Primary: https://github.com/reddit-archive/reddit/wiki/Architecture-Overview (official open-source wiki: r2 monolith, ThingDB, Cassandra, memcache, RabbitMQ)
- Primary: https://qconsf.com/sf2017/system/files/presentation-slides/qconsf-20171113-reddits-architecture.pdf (Neil Williams, Reddit, QCon SF 2017 "Reddit's Architecture and how it's broken over the years"; PDF partly parsed)
- Primary: https://highscalability.com/reddit-lessons-learned-from-mistakes-made-scaling-to-1-billi/ (write-up of Jeremy Edberg, Reddit, 2012 talk)
- Primary: https://www.infoq.com/news/2024/03/reddit-metadata-s3-postgres/ (write-up of official r/RedditEng post on media metadata store)
- Secondary: https://factorhouse.io/articles/reddit-kafka-architecture (synthesis citing Kafka Summit and Flink Forward talks by Reddit engineers, and 2026 r/RedditEng post)
- Verified by: official wiki + two Reddit conference talks + official post via write-up + cited secondary
- Confidence: high for classic architecture and metadata store; medium for current Kafka and service topology
- Date of source: 2012-2026

## System in three lines
Link aggregator whose core objects (links, comments, accounts, subreddits, votes) live in a schemaless two-table "Thing" model on sharded Postgres behind heavy memcache, with Cassandra for durable high-write features, RabbitMQ queues for votes and comments, and precomputed listings so a page is a cache read. Later work added Thrift services on Kubernetes, an Aurora Postgres media-metadata store at 100k rps, and a 500-broker Kafka fleet driving Flink safety rules. Hard because votes and comment trees are write-heavy and order-sensitive, most traffic is anonymous and cacheable, and the monolith's failure history is long.

## Scale (only if stated)
- Users / DAU: 67.3M monthly uniques, 4.7B pageviews/month, 240 servers, 28 employees, 2 TB Postgres (2012); traffic doubling every 15 months
- Requests per second: media metadata store 100k+ rps at p50 2.6 ms, p90 4.7 ms, p99 17 ms
- Data volume: metadata expected 50 TB by 2030; Kafka "over a petabyte of live data"
- Message throughput: Kafka "more than 500 brokers... tens of millions of messages per second"
- Cache: original design made "1000 calls to memcache for one page load"

## Requirements stated or clearly implied
- Availability target: crash-only, horizontally scalable from day one; logged-out traffic (80% early) served from CDN
- Consistency: eventual for listings and vote counts (queued); Cassandra durable writes; Postgres masters per object type
- Latency target: page from precomputed listing cache; metadata p90 under 5 ms
- Ordering needs: vote processing order in queues; comment tree structure integrity
- Replay or reprocessing: Kafka consumer offset reset "time-travel" to rerun safety rules; metadata migration via dual write and Kafka CDC validation
- Retention: unbounded history caused growth; later expirations added
- Compliance / residency: not stated

## Boundaries
- Regions / zones: AWS EC2 since early days; multi-AZ implied
- Trust zones: CDN -> HAProxy -> r2 / Thrift services -> caches and stores
- Named subsystems: r2 monolith and Thrift services (listing service), ThingDB Postgres shards, Cassandra, memcache with mcrouter, RabbitMQ job queues and consumers, precomputed listing cache, Search (Solr then CloudSearch), Media metadata store (Aurora), Kafka fleet and Flink safety engine, Kubernetes

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Web and mobile clients | Browsers and apps; server-driven UI for feeds (2023) | web, iOS, Android | web-client, mobile-client | |
| 2 | CDN | Caches logged-out pages | not named (Fastly per public knowledge) | cdn | |
| 3 | HAProxy | Load balancing to app servers | HAProxy | load-balancer | |
| 4 | r2 | Python monolith handling requests end to end | in-house (Pylons) | app-server | |
| 5 | Thrift services (listing service etc.) | Extracted services on Kubernetes | in-house | app-server | rpc: thrift |
| 6 | Postgres ThingDB | Two tables per type (thing + data), sharded across four masters (links, accounts, subreddits, comments/votes), replicas | PostgreSQL | sql-database | model: eav-kv; sharded: true; masters: 4 |
| 7 | Cassandra | Durable, fast writes for newer features; bloom filters | Apache Cassandra | nosql-database | |
| 8 | Memcache + mcrouter | Heavy caching (sgm, pagecache, rendercache, memoize); mcrouter routing | memcached, mcrouter | cache + database-proxy (cache router) | |
| 9 | Precomputed listings | Query cache of sorted listings updated asynchronously | in-house | cache (materialised) | |
| 10 | RabbitMQ | Queues for votes, comments, thumbnails | RabbitMQ | queue | |
| 11 | Job consumers | Process queued votes, comments, media | in-house | worker | |
| 12 | Search | Solr then Amazon CloudSearch | Solr, CloudSearch | search-index | |
| 13 | Media metadata store | Aurora Postgres, single JSONB table, range partitions by post id (pg_partman, pg_cron), PgBouncer | Aurora Postgres | sql-database + database-proxy | rps: 100000; partitioning: range-by-id |
| 14 | S3 | Media files, previously scattered metadata | Amazon S3 | object-store | |
| 15 | Kafka fleet | 500+ brokers, per-action-type egress topics, protobuf | Apache Kafka | stream | brokers: 500 |
| 16 | Flink safety engine (REV2) | Stateful Functions dispatch to Python rule endpoints; Lua rules versioned in GitHub, distributed via S3 | Apache Flink | stream-processor | |
| 17 | Kubernetes | Service orchestration; autoscaler incidents | Kubernetes | ops platform, not tallied | |
| 18 | Ganglia (legacy monitoring) | Metrics, hard to use on EC2 | Ganglia | monitoring | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | cdn | https | sync | | logged-out |
| cdn | haproxy | http | sync | | |
| haproxy | r2 / services | http/thrift | sync | | |
| r2 | memcache (via mcrouter) | memcached | sync | | batched calls |
| r2 | postgres thing shards | postgres | sync | | by type |
| r2 | cassandra | cql | sync | | |
| r2 | rabbitmq | amqp | async | at-least-once | votes, comments |
| rabbitmq | job consumers | amqp | async | | |
| job consumers | postgres / cassandra | native | sync | | apply votes, rebuild trees |
| job consumers | precomputed listings | memcache/cassandra | async | | update sorted listings |
| r2 | precomputed listings | read | sync | | page = cache read |
| r2 | search | http | sync | | |
| services | metadata store (via pgbouncer) | postgres | sync | | 100k rps |
| legacy sources | kafka (cdc events) | kafka | async | at-least-once | migration validation |
| kafka | validation consumers | kafka | async | | dual-write checks |
| producers | kafka egress topics | kafka | async | at-least-once | protobuf |
| kafka | flink safety | kafka | async | | offset reset replay |
| flink | python rule endpoints | http | sync | | Lua rules |

## Failure modes, incidents, tradeoffs the source discusses
- Cache chattiness on cloud: "Memcache access times increased 10x to a millisecond"; "1000 calls to memcache for one page load" forced batching. Source: highscalability.
- No consistent hashing initially so cache could not rebalance. Source: highscalability.
- Unbounded history: users could vote on comments "all the way back to the beginning of time"; expirations added. Source: highscalability.
- Early Cassandra instability: "Cassandra was use when it was still early in its development cycle". Source: highscalability.
- JavaScript worm injected via user content; community patch. Source: highscalability.
- SSDs as cheap RAM cut DB servers from 12 to 1. Source: highscalability.
- QCon 2017 incidents: vote queue backlog, comment tree corruption, cache lock contention, Postgres replica problems, autoscaler failure. Source: qcon slides (titles parsed; details in PDF).
- Postgres over Cassandra for metadata: "better ad-hoc debugging and more flexible query patterns"; single JSONB table "avoids joins". Source: infoq.
- Safe migration: dual writes with backfill, dual reads comparing, Kafka consumers validating discrepancies. Source: infoq.
- Rules replay: "time-travel" via consumer group offset resets. Source: factorhouse citing Reddit Safety.
- Start monolithic: "It's not necessary to build a scalable architecture from the start"; avoid SOA early. Source: highscalability.

## Unknowns
- Current feed ranking and serving stack beyond server-driven UI
- Comment tree storage format today
- Kafka cluster topology and retention
- CDN vendor (not named in sources used)

## Candidates
- New kinds: none strictly new; sightings: cdn (6th), load-balancer (9th), queue (8th), worker (12th), search-index (6th), stream (12th), stream-processor (6th), database-proxy (10th: PgBouncer, mcrouter), object-store (12th), monitoring (10th), sql-database (17th), nosql-database (16th), cache (14th)
- New properties on existing kinds: sql-database.model (relational, eav-kv, jsonb-kv), partitioning range-by-id (2nd sighting after Figma/Notion), extensions; cache.materialised (boolean), batchedAccess (boolean); stream.replayViaOffsetReset (boolean); queue.purpose (votes, comments, media)
- New edge properties: batched (2nd sighting); cacheable (boolean, for CDN of anonymous traffic)
- New requirement paths: traffic.anonymousShare (percent); data.historyUnbounded (boolean)
- New rules:
  - chatty-cache-access: app-server with many sync cache edges lacking batched true under cloud latency (informational)
  - anonymous-traffic-without-cdn: traffic.anonymousShare high and no cdn node in path
  - unbounded-history-without-expiry: datastore with data.historyUnbounded true and no retention or archival edge
  - vote-writes-without-queue: high-rate counter writes (votes) hitting sql-database synchronously with no queue in path
  - cache-without-consistent-hashing: cache cluster with hashing none while nodes > 1 (rebalance impossible)


## Verification 2026-09-13

Every URL the card lists was fetched on 2026-09-13.

| URL | Reachable | Outcome |
|---|---|---|
| github.com/reddit-archive/reddit/wiki/Architecture-Overview | yes | Confirms r2 as a monolith, the two-table thing/data model as "a mostly-schemaless key/value store", PostgreSQL, Cassandra, heavy Memcached, and RabbitMQ queueing work out to backend jobs. Does not mention HAProxy, a CDN, Solr/CloudSearch, precomputed listings or a shard count. |
| highscalability.com/reddit-lessons-learned-from-mistakes-made-scaling-to-1-billi/ | yes | Confirms 67,328,706 uniques and 4,692,494,641 pageviews, 28 employees, 240 servers, 2 TB Postgres, traffic doubling every 15 months, "1000 calls to memcache for one page load", memcache latency rising 10x on EC2, four sharded Postgres masters, the comment database with one master and 12 slaves, SSDs cutting 12 servers to 1. Corrects the card on one point: logged-out traffic was "about 80% ... now it's closer to 50%". |
| qconsf.com/.../qconsf-20171113-reddits-architecture.pdf | yes, unparsable | Returned as 4 MB of compressed binary; no text could be extracted, so no fact rests on the slides alone. |
| infoq.com/presentations/reddit-architecture-evolution/ | yes | Substituted for the PDF; same talk. Confirms Fastly as the CDN, an HTTP proxy in front of app-server pools, r2, Thrift back-end services (listing, API, comments), memcache holding serialized objects and denormalized listings, Postgres for the Thing model, Cassandra for time-series features, RabbitMQ for deferred work. Confirms the 2012 vote-queue lock contention fixed by partitioning queues by subreddit id across 10 processors, the 2011 cached listings pointing at rows missing from Postgres, the 2016 comment-tree self-heal exhausting broker memory, and the 2016 autoscaler terminating a third of production. |
| infoq.com/news/2024/03/reddit-metadata-s3-postgres/ | yes | Confirms Aurora Postgres over Cassandra, a single JSONB table, range partitioning on post id with pg_partman and pg_cron, 100k+ rps at p50 2.6 ms / p90 4.7 ms / p99 17 ms, 50 TB by 2030, and the dual-write, backfill, dual-read, Kafka-comparison migration. Does not name PgBouncer. |
| factorhouse.io/articles/reddit-kafka-architecture | yes | Confirms 500+ brokers, over a petabyte of live data, tens of millions of messages per second, Flink Stateful Functions dispatching to remote Python rule endpoints running Lua, per-action-type Protobuf egress topics, rules in S3 pushed from GitHub CI, and replay by consumer-group offset reset. |

Facts the card states that the fetched primaries did not confirm:

- **PgBouncer** in front of the media metadata store: confirmed instead from secondary write-ups of the same r/RedditEng post; kept and marked `close`.
- **Solr, then Amazon CloudSearch**: no source fetched today mentions it; encoded and marked `assumed`.
- **mcrouter, Ganglia, Kubernetes as a design box**: unconfirmed; not encoded as nodes.
- **80% anonymous traffic**: superseded by the primary itself ("closer to 50%"); not encoded.
