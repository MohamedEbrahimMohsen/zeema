# instagram-feed: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/instagram-feed.md` (intake card of 2026-09-07, re-verified 2026-09-13)
- Size: 23 nodes, 27 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture 8, clean variant: Instagram's photo feed from the 2011 AWS stack
(ELB, nginx, Django, sharded Postgres, Redis, Gearman, S3/CloudFront) through the 2018
two-continent stack (Cassandra partitioned per continent, TAO with region-local masters).

Fixes relative to instagram-feed.broken.yaml:
  - cassandra-us holds the activity feed, Direct inbox and fraud logs; redis is a plain cache
    again (sessions, photo-id to user-id map) with an lru policy, not the only copy of the feed
  - cassandra-us and cassandra-eu are two single-region rings, not one multi-leader ring
    spanning the Atlantic, so quorums never cross the ocean
  - job-queue declares a dead-letter queue and a persistent backend for the fan-out jobs
  - photo-workers index search-index asynchronously instead of Django dual-writing Solr inline
  - django reaches Postgres through pgbouncer, which is also the shard-routing hop
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture 8, broken variant: the Instagram stack with the four mistakes the
sources themselves warn about: the activity feed and fraud logs kept only in
Redis with no persistence and no eviction policy, one Cassandra ring stretched across the
Atlantic instead of two per-continent rings, a Gearman queue with nowhere to put a poison
fan-out job, and Solr written inline by Django on the request path.

This file MUST trip:
  - cache-as-primary-store-without-persistence  (redis holds the feed and inbox, persistence off)
  - cache-missing-eviction-policy               (redis declares an eviction policy of none)
  - queue-missing-dlq                           (job-queue takes async traffic, no dead letters)
  - derived-store-without-cdc-or-rebuild        (search-index is only written sync by django)
  - multi-leader-store-without-conflict-policy  (cassandra-us and cassandra-eu are one ring
                                                 across the ocean with no conflict resolution)
and MUST NOT trip:
  - materialised-cache-without-rebuild-path     (photo-workers still write redis, so a worker
                                                 in-edge exists)
  - business-updates-without-index-propagation  (postgres is written through pgbouncer, a
                                                 database-proxy, not directly by an app-server)
  - datastore-missing-backup, datastore-single-region (both postgres nodes keep backups with a
                                                 retention and replicate asynchronously)
  - retry-without-adaptive-shedding, retry-without-backoff (no edge declares a retry policy)
  - push-fanout-without-celebrity-path          (photo-workers fan out with a hybrid strategy)
  - credentials-without-rotation                (the design still declares a rotation period)
  - external-call-inline-without-durable-path   (django has a queue attached; apns is reached
                                                 from pyapns, never inline from the app tier)
  - object-store-single-zone-with-durability-target, stateful-node-without-zone-redundancy,
    sync-chain-too-deep, cross-cell-call, read-heavy-path-without-cache (no such node, group
    or requirement in this design)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Mobile clients (iOS/Android) | `mobile-client` | `mobile-app` | client | exact |
| Route53 | `dns` | `route53` | dns | exact |
| ELB (terminates SSL) | `elb` | `aws-classic-load-balancer` | load-balancer | exact |
| nginx (3 instances) | `nginx` | `nginx` | load-balancer | exact |
| CloudFront | `photo-cdn` | `cloudfront` | cdn | exact |
| Django + gunicorn on EC2 High-CPU XL | `django` | `vm-service` | app-server | close |
| pgbouncer | `pgbouncer` | `pgbouncer` | database-proxy | exact |
| Gearman job server | `job-queue` | `gearman` | queue | exact |
| ~200 Python Gearman workers | `photo-workers` | `container-worker` | worker | close |
| Akkio | `akkio` | `container-worker` | worker | assumed |
| pyapns | `pyapns` | `notification-platform` | notification-service | close |
| APNs | `apns` | `apns` | third-party-api | exact |
| Munin / Pingdom / PagerDuty / Sentry | `observability` | `sentry` | monitoring | close |
| PostgreSQL, 12 primaries, sharded | `postgres` | `postgres` | sql-database | exact |
| PostgreSQL, 12 streaming replicas | `postgres-replica` | `postgres` | sql-database | exact |
| Redis (sessions, photo-id to user-id map) | `redis` | `redis` | cache | exact |
| Memcached, 6 instances | `memcached` | `memcached` | cache | exact |
| S3 | `photo-store` | `s3` | object-store | exact |
| Solr geo-search | `search-index` | `solr` | search-index | exact |
| Cassandra_US (feed, inbox, fraud logs) | `cassandra-us` | `cassandra` | nosql-database | exact |
| Cassandra_EU | `cassandra-eu` | `cassandra` | nosql-database | exact |
| TAO (US master) | `tao-us` | `tao` | graph-database | exact |
| TAO (EU region-local master) | `tao-eu` | `tao` | graph-database | exact |

Tally: 17 exact, 5 close, 1 assumed.

## Catalogue gaps

| Product | Kind it would need | Used instead |
|---|---|---|
| Akkio (Meta data-placement service) | `data-placement-service` | `container-worker` with `label: "Akkio"` |
| pyapns (Twisted APNs relay) | a push-relay flavour of `notification-service` | `notification-platform` |
| Munin, Pingdom, PagerDuty | one `monitoring` node per tool | merged into a single `sentry` node |
| Meta Memcache (cross-region tier) | `cache` with `replication: multi-region` | not encoded; the AWS-era `memcached` node stands for the object cache |

## Assumed values (the source is silent, a rule reads the property)

- `job-queue.deadLetterQueue: true` and `job-queue.persistence: true` in the clean design.
  Gearman ships with neither; the source never says Instagram added them. The clean design
  sets them because `queue-missing-dlq` encodes the practice, and the broken twin restores
  the Gearman defaults, which is where that rule is meant to fire.
- `postgres.backupRetentionDays: 30`. The source states EBS snapshots taken under an XFS
  freeze but states no retention.
- `security.credentialRotationDays: 90`. Not stated anywhere; set so the design-wide
  `credentials-without-rotation` rule is satisfied.
- `photo-workers -> search-index` (async, at-least-once). The source names Gearman as the
  background-job path and Solr as the geo index but never draws the arrow between them.
- `photo-workers.fanoutStrategy: "hybrid"`. The source says only that high-follower accounts
  need special routing via the Social Hash partitioner; "hybrid" is the nearest enum value.

## Not encoded

- The PL/PGSQL id generator (41-bit millisecond timestamp, 13-bit logical shard, 10-bit
  sequence, 1024 ids per shard per millisecond). It runs inside each Postgres shard, not as a
  node; it survives as `postgres.idEncodesShard: true`.
- Several thousand logical shards mapped onto a few physical servers: the format has
  `sharded` and `shardKey` but no logical/physical shard counts.
- EBS volumes, XFS and the software RAID under Postgres, and the "EBS does not support enough
  disk seeks per second" finding that drove the working set into memory.
- The 20% headroom kept in every datacenter for absorbing one datacenter's loss; there is no
  `availability.headroomPercent` requirement path.
- Rocksandra: the swap of Cassandra's storage engine to RocksDB, the 3-4x p99 read reduction
  and the GC stall drop from 2.5% to 0.3%. `nosql-database` has no `storageEngine` property.
- The Social Hash partitioner as a routing component for high-follower accounts.
- The abandonment of cross-ocean disaster recovery: a design can say what exists, not what was
  deliberately given up.
- Cost: the roughly 75% saving from moving the feed off 32 Quadruple Extra-Large Redis nodes,
  and Akkio's up-to-40% storage-footprint reduction.
- Meta's cross-region Memcache tier and its invalidation problem, handled by separating static
  keys from dynamic data.
- Instance counts that the kind cannot hold: the 3 nginx proxies, the 6 memcached instances and
  the 12+12 Postgres machines (`load-balancer` and `cache` have no `instances` property, and the
  two Postgres nodes stand for the whole primary and replica tiers).
