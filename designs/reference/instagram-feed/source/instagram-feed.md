# Intake: Instagram feed and media (2011 AWS stack through 2018 multi-continent)

## Source
- Primary: https://instagram-engineering.com/what-powers-instagram-hundreds-of-instances-dozens-of-technologies-adf2e22da2ad (official, 2011-2013; origin host refused connection in this pass, read via mirror https://tech.isatya.in/post/67835084659/what-powers-instagram-hundreds-of-instances)
- Primary: https://instagram-engineering.com/sharding-ids-at-instagram-1cf5a71e5a5c (official; read via summary at https://read.engineerscodex.com/p/how-instagram-scaled-to-14-million)
- Primary: https://opensource.com/article/18/10/instagram-scaled-infrastructure and https://www.infoq.com/news/2018/11/instagram-across-continents/ (write-ups of Sherry Xiao, Instagram, 2018 talk on cross-Atlantic scaling)
- Secondary: https://sujeet.pro/articles/instagram-cassandra-migration (Redis to Cassandra, Rocksandra; cites Cassandra Summit 2013 and Instagram blog)
- Verified by: official engineering blog posts + conference talk by Instagram engineer + secondary with citations
- Confidence: high
- Date of source: 2011-2013, 2018

## System in three lines
Photo and video sharing with a follower feed, activity feed, direct messages and push notifications. Started as a stateless Django tier on AWS over PostgreSQL, Redis and S3/CloudFront; grew into Meta's stack with Cassandra, TAO and Memcache across five US datacenters plus Europe. Hard because feed fan-out is write-heavy and memory-hungry, and because moving stateful data across an ocean breaks quorum and single-master assumptions.

## Scale (only if stated)
- Users / DAU: 14M users with 3 engineers (2011); 1B+ later
- Requests per second: 25+ photos/sec, 90+ likes/sec (2012); 1,024 ids per shard per millisecond capacity
- Data volume: several TB of photos on S3 (2012); 300M photo-id to user-id mappings in under 5 GB Redis; Cassandra 12 nodes / 1.2 TB (2013) to 1,000+ nodes / hundreds of TB (2016)
- Message throughput: over 1B push notifications via pyapns; ~200 Gearman workers
- Fleet (2012): 25+ Django instances, 3 nginx, 12 Postgres + 12 replicas, 32 Redis nodes, 6 memcached
- Latency: Cassandra p99 reads 25-60 ms on JVM, ~20 ms after Rocksandra; GC stall 2.5% to 0.3%

## Requirements stated or clearly implied
- Availability target: multi-datacenter (1 -> 3 in 2015 -> 5 US -> plus EU); 20% headroom per region to absorb one datacenter loss
- Consistency: Cassandra quorum within a region (W=TWO, R=ONE initially); TAO single master per shard, region-local masters in EU; feed eventual
- Latency target: cross-Atlantic round trips explicitly unacceptable ("the speed of light")
- Ordering needs: ids sortable by time (41-bit ms timestamp prefix)
- Replay or reprocessing: not stated
- Retention: not stated
- Compliance / residency: user data placed near the user (Akkio microshards), also reduces storage 40%
- Durability: fraud logs needed durability Redis could not give as first-class

## Boundaries
- Regions / zones: AWS availability zones (RF=3 across AZs); later Meta datacenters US x5 + EU; cross-ocean disaster recovery abandoned
- Trust zones: clients -> Route53 -> ELB (SSL termination) -> nginx -> Django -> data tier
- Named subsystems: Web tier, Postgres (sharded), Redis (feed, sessions, id map), Memcache, Media (S3 + CloudFront), Async (Gearman/Celery), Push (pyapns), Search (Solr), Observability; later Cassandra, TAO, Akkio

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Mobile clients | iOS/Android apps | native | mobile-client | |
| 2 | Route53 | DNS | Amazon Route53 | dns (new) | |
| 3 | ELB | Load balancer, terminates SSL | AWS ELB | load-balancer | tlsTermination: true |
| 4 | nginx | Reverse proxy, 3 instances | nginx | load-balancer / reverse-proxy | instances: 3 |
| 5 | Django + Gunicorn | Stateless app tier, 25+ High-CPU XL | Django, Gunicorn | app-server | stateless: true; instances: 25 |
| 6 | PostgreSQL | Users, photo metadata, likes; 12 primaries + 12 streaming replicas; thousands of logical shards on few physical | PostgreSQL 9 | sql-database | replication: async (streaming); sharded: true; logicalShards: thousands |
| 7 | pgbouncer | Connection pooling in front of Postgres | pgbouncer | database-proxy | pooling: true |
| 8 | ID generator | PL/PGSQL in each shard: 41 bits ms, 13 bits shard, 10 bits sequence | in-house in Postgres | id-generator (new) | sortableByTime: true |
| 9 | Redis | Main feed, activity feed, sessions, photo-id to user-id map (hash bucketing), 32 nodes | Redis | cache (used as primary store) | persistence: partial; evictionPolicy: none |
| 10 | Memcached | Object cache, 6 instances | memcached | cache | |
| 11 | Gearman | Task queue for fan-out, social sharing, notifications; ~200 Python workers | Gearman, later Celery | queue + worker | workers: 200 |
| 12 | pyapns | Push notification service to APNs | pyapns (Twisted) | notification-service | |
| 13 | S3 | Photo storage | Amazon S3 | object-store | |
| 14 | CloudFront | CDN for photos | Amazon CloudFront | cdn | |
| 15 | Solr | Geo-search API | Apache Solr | search-index | |
| 16 | EBS + XFS + mdadm RAID | Disks for Postgres; snapshots via XFS freeze | AWS EBS | property of sql-database | |
| 17 | Munin / Pingdom / PagerDuty / Sentry | Metrics, external checks, paging, error tracking | Munin, Pingdom, PagerDuty, Sentry | monitoring (Sentry = error tracking) | |
| 18 | Cassandra | Feed, inbox, fraud logs; replaced Redis for write-heavy data; RocksDB storage engine (Rocksandra) | Apache Cassandra | nosql-database | replicationFactor: 3; consistency: quorum-in-region; storageEngine: rocksdb |
| 19 | TAO | Meta social graph store, single master per shard, region-local masters in EU | TAO | graph-database | masterPerShard: true; regionLocalWrites: true |
| 20 | Akkio | Data placement: migrates user microshards to nearest region by access pattern | Akkio (Meta) | data-placement-service (new) | |
| 21 | Memcache (Meta) | Cross-region cache with invalidation problems | Memcache | cache | replication: multi-region |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| mobile-client | route53 | dns | sync | | |
| mobile-client | elb | https | sync | | ssl terminated at elb |
| elb | nginx | http | sync | | |
| nginx | django | http | sync | | |
| django | pgbouncer | postgres | sync | | |
| pgbouncer | postgres-shard | postgres | sync | | logical shard routing in app |
| postgres-primary | postgres-replica | streaming replication | async | | failover |
| django | redis | redis | sync | | feed read, session |
| django | memcached | memcached | sync | | |
| django | gearman | gearman | async | at-least-once | fan-out, sharing, notify |
| gearman | workers | gearman | async | | 200 workers |
| workers | redis | redis | sync | | insert into follower feeds |
| workers | pyapns | internal | async | at-most-once | |
| pyapns | apns | apns | async | at-most-once | |
| django | s3 | https | sync | | upload |
| mobile-client | cloudfront | https | sync | | photo download |
| cloudfront | s3 | https | sync | | origin |
| django | solr | http | sync | | geo search |
| django (later) | cassandra | cql | sync | | quorum within region |
| django (later) | tao | thrift | sync | | region-local master |
| tao-eu | tao-us | async queue | async | at-least-once | cross-region propagation |
| akkio | cassandra | internal | async | | microshard migration |
| services | munin / sentry | push | async | | |

## Failure modes, incidents, tradeoffs the source discusses
- Cloud disk seeks: "Amazon's network disk system (EBS) doesn't support enough disk seeks per second"; keep working set in memory. Source: what-powers.
- Redis cost model: "paying for sub-millisecond capability on every byte" for write-heavy, rarely-read data; vertical-only scaling; durability secondary. Moved feed and fraud logs to Cassandra, ~75% cost cut. Source: Cassandra Summit 2013 via sujeet.pro.
- JVM GC at 1,000+ Cassandra nodes: p99 25-60 ms, 2.5% stall; storage engine swapped to RocksDB. Source: Instagram blog via sujeet.pro.
- Cross-ocean quorum: Cassandra replicas across continents means quorum waits on the Atlantic; partitioned into Cassandra_EU and Cassandra_US. Source: opensource.com.
- Single-master writes across ocean: TAO writes all went to US masters; enabled EU region-local masters with async propagation because "the data belongs to the user itself". Source: infoq.
- Cross-region memcache invalidation and staleness: handled by separating static keys from dynamic data. Source: infoq.
- Disaster recovery given up across the ocean; 20% headroom per region instead. Source: infoq.
- ID generation: rejected ticket servers and Snowflake (extra moving parts, Zookeeper); generated inside Postgres per shard. Source: sharding-ids.
- Logical shards mapped to few physical servers so growth means moving shards, never re-bucketing. Source: sharding-ids.
- "Don't rush into a new project... make sure you understand why you need to deploy your service in a new region." Source: opensource.com.
- High-follower accounts need special routing (social hash partitioning). Source: infoq.

## Unknowns
- Feed ranking service (later ML) not covered
- Video pipeline and Reels not covered
- Current cache and storage after full Meta integration
- Push notification retries and delivery guarantees

## Candidates
- New kinds: dns (Route53, Cloud DNS), id-generator (Snowflake, per-shard sequences), data-placement-service (Akkio), graph-database (2nd sighting: TAO), search-index (2nd: Solr), database-proxy (3rd: pgbouncer), queue (3rd: Gearman), cdn (3rd), notification-service (3rd)
- New properties on existing kinds: sql-database.logicalShards (integer) and physicalShards (integer); cache.usedAsPrimaryStore (boolean); nosql-database.replicationFactor (integer); nosql-database.storageEngine (string); graph-database.masterPerShard, regionLocalWrites (boolean); load-balancer.tlsTermination (boolean)
- New edge properties: crossRegion (derived, but could be declared); quorumScope (region, global)
- New requirement paths: availability.headroomPercent (integer); data.residency (map region to user set); consistency.quorumScope (region, global)
- New rules:
  - cache-as-primary-store-without-persistence: cache with usedAsPrimaryStore true and persistence false
  - cross-region-quorum: nosql-database with quorum consistency spanning region groups on both sides of an ocean (needs group metadata, e.g. region.continent)
  - single-master-write-across-regions: graph-database or sql-database with one master and sync write edges from another region
  - id-generation-single-point: id-generator that is one node with no partition per shard
  - inmemory-store-for-write-heavy-rarely-read: cache receiving async write edges from workers with no read edges (weak, informational)

## Verification 2026-09-13

| URL | Reachable | Outcome |
|---|---|---|
| instagram-engineering.com/what-powers-instagram-... | no | origin refused the connection; read through the mirror below |
| tech.isatya.in/post/67835084659/what-powers-instagram-hundreds-of-instances | yes | confirms Ubuntu 11.04 on EC2, 25+ Django on High-CPU Extra-Large, 3 nginx behind Amazon ELB, 12 Quadruple Extra-Large Postgres primaries and 12 replicas in a different zone, pgbouncer, Redis on Quadruple Extra-Large Memory instances, 6 memcached, Gearman with about 200 Python workers, pyapns with over a billion push notifications, Solr geo-search, S3 with several terabytes, CloudFront, Munin, Pingdom, PagerDuty, Sentry |
| instagram-engineering.com/sharding-ids-at-instagram-... | no | ECONNREFUSED; read through the summary below |
| read.engineerscodex.com/p/how-instagram-scaled-to-14-million | yes | confirms 41-bit millisecond timestamp, 13-bit logical shard, 10-bit sequence, 1024 ids per shard per millisecond, several thousand logical shards on a few physical shards, Snowflake and ticket servers rejected, 14M users with 3 engineers |
| opensource.com/article/18/10/instagram-scaled-infrastructure | yes | confirms 1 to 3 datacenters in 2015 to 5, cross-Atlantic quorum needing five of eight replicas, the Cassandra_EU / Cassandra_US split with replication factor 5 in the US and 3 in Europe, "the speed of light", Django as the stateless web tier, TAO |
| infoq.com/news/2018/11/instagram-across-continents/ | yes | confirms Akkio access-pattern-driven microshard migration, TAO region-local write masters in the EU, the Social Hash partitioner for high-follower routing, "20% headroom in each datacenter", cross-ocean disaster recovery abandoned |
| sujeet.pro/articles/instagram-cassandra-migration | yes | confirms activity feed, Direct inbox and fraud logs moved off Redis, 32 Quadruple Extra-Large Redis nodes for the feed, about 75% cost reduction, Cassandra 12 nodes and about 1.2 TB at replication factor 3 across availability zones with W=TWO and R=ONE, later 1,000+ nodes and hundreds of terabytes, p99 reads of 25-60 ms, Rocksandra giving a 3-4x p99 reduction, GC stall 2.5% to 0.3%, Akkio cutting the storage footprint by up to 40% |

Facts in this card that could not be confirmed and were therefore dropped from the design:
25+ photos/sec and 90+ likes/sec (no per-second figure appears in the mirror, so the design
carries no `nfr.rps` at all); "1B+ users later"; the absolute "~20 ms after Rocksandra" figure
(the secondary states a 3-4x reduction, not an absolute number).
