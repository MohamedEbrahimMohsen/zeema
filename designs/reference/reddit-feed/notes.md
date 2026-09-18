# reddit-feed: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/reddit-feed.md` (intake card of 2026-09-07, with the 2026-09-13 verification appended).
- Size: 25 nodes, 37 edges, 4 groups (broken twin: 23 nodes, 35 edges, 4 groups).

## Clean variant (header of design.yaml)

Reference architecture 10, clean variant: Reddit's link aggregator - a Python monolith and its
Thrift successors reading precomputed listings out of cache, a schemaless Thing model on sharded
Postgres, one RabbitMQ queue and one worker pool per job type, a partitioned Aurora media
metadata store behind PgBouncer, and a Kafka fleet feeding the Flink safety engine.

Fixes relative to reddit-feed.broken.yaml:
  - vote-queue, comment-queue and thumbnail-queue each declare a dead-letter queue, so a poison
    vote or a self-healing comment tree cannot fill the broker
  - each queue gets its own worker pool (vote-consumer, comment-consumer, thumbnail-consumer),
    which is the fix Reddit shipped after the 2012 vote-queue lock contention
  - listing-cache is written by those workers, not inline by r2, so it has a rebuild path, and it
    declares a ttl policy with a bounded ttlSeconds instead of keeping history forever
  - media-metadata is range-partitioned by post id (pg_partman/pg_cron), so the 100k rps it
    serves does not land on one unsharded writer scaled only by async replicas
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture 10, broken variant: the same Reddit stack built the way it was built
before the incidents - one job-consumer pool draining the vote, comment and thumbnail queues,
none of which dead-letter; a precomputed-listing cache written inline by r2 with no expiry and
no rebuild path; and a media metadata store that is one unsharded Aurora writer at 100k rps.

This file MUST trip:
  - queue-missing-dlq                    (vote-queue, comment-queue and thumbnail-queue all take async traffic with deadLetterQueue false)
  - shared-worker-pool-across-queues     (job-consumers drains all three queues while the design requires per-queue isolation)
  - cache-missing-eviction-policy        (listing-cache declares evictionPolicy none, so history is kept forever)
  - materialised-cache-without-rebuild-path (listing-cache holds materialised listings, written only by r2 and thrift-services)
  - single-writer-primary-at-peak-qps    (media-metadata is unsharded and declared at 100000 rps)
  - read-replica-as-sole-scaling         (media-metadata scales that read load with async replicas alone)
and MUST NOT trip:
  - datastore-missing-backup             (thing-db and media-metadata both declare backups and retention)
  - datastore-single-region              (the design does not promise multi-region availability)
  - derived-store-without-cdc-or-rebuild (search is still fed asynchronously from the Kafka fleet)
  - business-updates-without-index-propagation (thing-cdc still streams the Thing tables into Kafka)
  - cache-as-primary-store-without-persistence (the listing cache is not declared the only copy)
  - fanout-inline-in-request-path        (r2 still hands work to the queues, never to a worker synchronously)
  - sync-chain-too-deep                  (the design states no p95 latency target and has no api-gateway node)

Every one of those mistakes is one the sources describe: the 2016 comment-tree self-heal that
filled the RabbitMQ broker until it had to be restarted, the 2012 vote-queue lock contention that
was fixed by giving each partition its own processor, the unbounded history that let users vote
"all the way back to the beginning of time" before expirations were added, the 2011 cached
listings that pointed at rows no longer in Postgres, and the choice to partition the media
metadata store by post id rather than scale one writer.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Web clients | `web-client` | `web-browser` | client | exact |
| Mobile apps | `mobile-client` | `mobile-app` | client | exact |
| CDN (Fastly) | `cdn` | `content-delivery-network` | cdn | close (vendor named in the talk, generic component used) |
| HAProxy / HTTP proxy | `http-proxy` | `haproxy` | load-balancer | close (the talk says "HTTP proxy"; the card and public knowledge say HAProxy) |
| r2 | `r2` | `container-service` | app-server | close (in-house Pylons monolith, generic app-server used) |
| Thrift services (listing, API, comments) | `thrift-services` | `container-service` | app-server | close (merged as the talk draws them as one tier) |
| Memcache + mcrouter | `memcache` | `memcached` | cache | close (mcrouter folded in as `hashing: consistent`) |
| Precomputed listings | `listing-cache` | `cache-cluster` | cache | close (in-house query cache, generic cache used) |
| Postgres ThingDB | `thing-db` | `postgres` | sql-database | exact |
| Cassandra | `cassandra` | `cassandra` | nosql-database | exact |
| RabbitMQ vote queue | `vote-queue` | `rabbitmq` | queue | exact |
| RabbitMQ comment queue | `comment-queue` | `rabbitmq` | queue | exact |
| RabbitMQ thumbnail queue | `thumbnail-queue` | `rabbitmq` | queue | exact |
| Job consumers (votes) | `vote-consumer` | `container-worker` | worker | close |
| Job consumers (comments) | `comment-consumer` | `container-worker` | worker | close |
| Job consumers (media) | `thumbnail-consumer` | `container-worker` | worker | close |
| Search (Solr, then CloudSearch) | `search` | `aws-cloudsearch` | search-index | assumed (no source fetched on 2026-09-13 names either product) |
| PgBouncer | `metadata-pool` | `pgbouncer` | database-proxy | close (named only by secondary write-ups of the official post) |
| Media metadata store | `media-metadata` | `aurora` | sql-database | exact |
| S3 | `media-objects` | `s3` | object-store | exact |
| Kafka CDC of the legacy sources | `thing-cdc` | `kafka-connect` | change-data-capture | assumed (the source describes the mechanism, names no product) |
| Kafka fleet | `kafka` | `kafka` | stream | exact |
| Flink safety engine (REV2) | `safety-engine` | `flink` | stream-processor | exact |
| Python rule endpoints | `rule-endpoints` | `container-service` | app-server | close |
| Validation consumers | `migration-validator` | `container-worker` | worker | close |

Tally: 11 exact, 12 close, 2 assumed.

Property values that the sources do not state and that were set so the design states a practice
rather than staying silent (each is called out in `work/designs/reddit-feed/verify.md`):

- `security.credentialRotationDays: 90` - no source states a rotation period.
- `thing-db.backupEnabled` / `backupRetentionDays: 30` - no source states a backup policy for the
  2 TB system of record.
- `deadLetterQueue: true` on the three RabbitMQ queues - not stated; the 2016 broker-memory
  incident is the documented consequence of not having one.
- `media-metadata.sharded: true`, `shardKey: "post_id"`, `idEncodesShard: true` - the format has
  no separate word for range partitioning inside one instance; this is how pg_partman range
  partitioning on the monotonic post id is expressed.

## Catalogue gaps

| Product | Kind it would need | Used instead |
|---|---|---|
| mcrouter | database-proxy (cache router) | folded into `memcache`; its job shows as `hashing: "consistent"` |
| Reddit's unnamed change-event pipeline | change-data-capture | `kafka-connect`, the nearest generic log-based CDC |
| Ganglia | monitoring | not encoded; the card marks it legacy and no fetched source gives it edges |

## Not encoded

- The four Postgres masters by object type (links, accounts, subreddits, comments/votes) are one
  `thing-db` node with `sharded: true, shardKey: "thing_type"`; the format has no per-shard node.
- The comment database's "one master and 12 slaves" survives only as `replicaFanout: 12`; replica
  topology is not modelled.
- The 1000 memcache calls per page load and the batching fix appear only as `batched: true` on the
  two cache edges; call counts are not a design field.
- Kubernetes as an orchestrator is a node property (`orchestrator: "kubernetes"`), not a node.
- The Lua rule files versioned in GitHub and pushed to S3 are one edge from `rule-endpoints` to
  `media-objects`; the format has no artefact or CI concept.
- Latency numbers for the metadata store (p50 2.6 ms, p90 4.7 ms, p99 17 ms) are not encoded:
  `nfr` carries only `latencyP95Ms`, and no source states a p95.
- Retention and growth facts (2 TB in 2012, 50 TB of metadata by 2030, over a petabyte of live
  Kafka data) have no home in the format beyond `retentionHours` on the stream.
- The historical anonymous-traffic share (80%, later ~50%) has no requirement path.
