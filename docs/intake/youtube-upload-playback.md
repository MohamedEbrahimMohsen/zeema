# Intake: YouTube upload, transcoding and playback

## Source
- Primary: https://highscalability.com/youtube-architecture/ (write-up of Cuong Do, YouTube, Google Tech Talk 2007 on scalability)
- Primary: https://highscalability.com/7-years-of-youtube-scalability-lessons-in-30-minutes/ (write-up of Mike Solomon, YouTube, 2012 talk)
- Primary: https://vitess.io/docs/overview/history/ (official Vitess project history, why YouTube built it)
- Secondary: https://www.datacenterdynamics.com/en/news/google-develops-custom-argos-video-transcoding-chips-for-youtube-processing/ and Ars Technica coverage of Google's VCU paper (2021)
- Verified by: two talks by YouTube engineers + official project docs + press coverage of a Google research paper
- Confidence: high for 2007-2012 serving architecture; medium for current pipeline (Google publishes little)
- Date of source: 2007, 2012, 2021

## System in three lines
Accepts video uploads, transcodes each into dozens of resolution and codec variants, and serves playback to billions of devices with thumbnails, metadata and comments around it. Serving tier is a classic sharded-MySQL web app behind caches; video bytes come from a CDN for popular content and YouTube colos for the long tail. Hard because of the split between a small number of very hot objects and an enormous cold tail, and because transcoding is the dominant compute cost.

## Scale (only if stated)
- Users / DAU: 350M+ devices (2012); 2.5B users (later, secondary)
- Requests per second: 11,574 views/sec at the 1B-views/day milestone; 100M+ views/day in 2006; 4B views/day in 2012
- Data volume: 60 hours uploaded per minute (2012)
- Message throughput: not stated
- Page latency: under 100 ms page service time
- Team (2007): 2 sysadmins, 2 architects, 2 developers, 2 network engineers, 1 DBA

## Requirements stated or clearly implied
- Availability target: not quantified; "the state of the system is that which it is reported to be"
- Consistency: eventual for comments and views (300-400 ms visible delay accepted); strong for money (rentals)
- Latency target: page under 100 ms; video start time not stated
- Ordering needs: not stated
- Replay or reprocessing: uploads must be resumable (chunked)
- Retention: videos kept indefinitely (implied)
- Compliance / residency: not stated

## Boundaries
- Regions / zones: multiple colos; thumbnails replicated across colos via BigTable; CDN edge for popular videos
- Trust zones: clients -> NetScaler load balancer -> web/app tier -> data tier; video serving path separate from page path
- Named subsystems: Web/app tier, Video serving, Thumbnail serving, Database (MySQL + Vitess), Upload and transcoding, Caching

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Browser / device clients | Watch page, player, uploads | web, mobile, TV | web-client, mobile-client | |
| 2 | NetScaler | Load balancing, caching static content | Citrix NetScaler | load-balancer | |
| 3 | Apache + mod_fastcgi | Web front | Apache | app-server (web tier) | |
| 4 | Python app servers | Page logic, ~1M lines Python, psyco JIT, C extensions | Python, Spitfire templates | app-server | stateless: true |
| 5 | Page / row / object caches | Multi-level caching; precalculated data pushed to app servers; jittered expiry 18-30 h | memcached-class | cache | evictionPolicy: ttl; ttlJitter: true |
| 6 | lighttpd video servers | Serve video files; mini-clusters per video with redundancy | lighttpd (modified, worker threads) | app-server (static file serving) | |
| 7 | CDN | Serves most popular videos | not named (later Google edge) | cdn | |
| 8 | YouTube colos | Serve long-tail videos from own racks; RAID and memory tuned for misses | own datacenters | object-store (serving tier) | |
| 9 | Thumbnail store | Small-object store; moved from filesystem to BigTable | Google BigTable | nosql-database | replication: cross-colo |
| 10 | MySQL | Users, videos, subscriptions; primary + read replicas, later sharded by user | MySQL | sql-database | replication: async; sharded: true |
| 11 | Vitess | Proxy in front of MySQL: connection pooling, query rewriting, shard routing, failover | Vitess (Go) | database-proxy (new) | sharding: true; queryRewrite: true |
| 12 | Zookeeper | Coordination for Vitess topology | Apache Zookeeper | coordination-service (new) | |
| 13 | Upload service | Chunked, resumable upload reception | in-house | app-server | resumable: true |
| 14 | Transcoding farm | Converts each upload into dozens of variants; VCU ASIC gives 20-33x compute efficiency | Argos VCU on Borg | worker | accelerator: vcu; variantsPerVideo: dozens |
| 15 | Thumbnail / caption / metadata extractors | Parallel post-upload jobs | in-house | worker | |
| 16 | Video storage (master files) | Durable storage of originals and variants | not named (Google storage) | object-store | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | netscaler | https | sync | | |
| netscaler | apache/python | http | sync | | |
| python-app | cache | memcached | sync | | multi-level |
| python-app | vitess | grpc/mysql | sync | | every DB request |
| vitess | mysql-shard | mysql | sync | | |
| vitess | zookeeper | zk | sync | | topology |
| mysql-primary | mysql-replica | binlog | async | | replica lag caused cache misses |
| python-app | bigtable | bigtable rpc | sync | | thumbnails |
| client | cdn | https | sync | | popular videos |
| client | lighttpd-colo | https | sync | | long tail |
| client | upload-service | https chunked | sync | | resumable |
| upload-service | video-storage | internal | sync | | original |
| upload-service | transcoding-farm | job queue | async | at-least-once | fan-out to dozens of variants |
| transcoding-farm | video-storage | internal | async | | variants |
| transcoding-farm | cdn / colos | internal | async | | distribution |
| upload-service | extractors | job queue | async | | thumbnails, captions, metadata |
| precompute jobs | python-app | push | async | | "precalculated data pushed to app servers" |

## Failure modes, incidents, tradeoffs the source discusses
- Thundering herd from synchronized cache expiry: "If your system doesn't jitter then you get thundering herds... randomly expire between 18-30 hours." Source: 7-years.
- Replica lag: "Updates cause cache misses... slow replication"; fixed by sharding, not more replicas. Source: youtube-architecture.
- Read replicas insufficient: "Read-only traffic was still high enough to overload the replica database"; then "write traffic became too high for the primary". Source: vitess.io.
- Sharding logic in app code became the problem Vitess removed. Source: vitess.io.
- Small-object serving: thumbnails on disk caused "lots of disk seeks and problems with inode caches"; moved to BigTable. Source: youtube-architecture.
- Caching is not enough for the long tail: "Caching won't always be your performance savior"; CDN for hits, tuned RAID and memory for misses. Source: youtube-architecture.
- Approximation accepted: "If a user can't tell... it's not"; comments delayed 300-400 ms for readers, instant for writer. Source: 7-years.
- Consistency per domain: eventual for comments, strong for rentals. Source: 7-years.
- lighttpd main loop bottleneck for small files; patched with worker threads. Source: youtube-architecture.
- Simplicity as scaling strategy: "Simplicity allows you to rearchitect more quickly". Source: youtube-architecture.
- Transcoding cost dominates; custom VCU ASIC for 20-33x efficiency. Source: DCD.

## Unknowns
- Current serving stack (Google internal, largely unpublished)
- Video start-time targets
- Transcoding job queue product and retry semantics
- Storage tiering between hot, warm and cold video

## Candidates
- New kinds: database-proxy (Vitess, ProxySQL, PgBouncer), coordination-service (Zookeeper, etcd, Consul), cdn (2nd sighting), worker (4th), object-store (4th), nosql-database (4th), load-balancer (3rd), web-client (3rd)
- New properties on existing kinds: cache.ttlJitter (boolean); sql-database.replicaLagTolerated (boolean); worker.accelerator (enum: none, gpu, asic); app-server.resumableUploads (boolean)
- New edge properties: readYourWrites (boolean) for the comment case
- New requirement paths: consistency.perDomain (map of domain to strong/eventual); traffic.hotTailSplit (boolean)
- New rules:
  - cache-ttl-without-jitter: cache with evictionPolicy ttl and ttlJitter false while rps above threshold (thundering herd)
  - read-replica-as-sole-scaling: sql-database replication async, sharded false, and stated rps above threshold
  - small-objects-on-filesystem: object-store or app-server serving small objects with no nosql/blob backing (weak, informational)
  - cdn-absent-for-static-heavy-design: design with object-store serving clients directly and no cdn while traffic stated global
  - eventual-store-behind-strong-requirement: nosql-database eventual under consistency.model cp for the same domain
