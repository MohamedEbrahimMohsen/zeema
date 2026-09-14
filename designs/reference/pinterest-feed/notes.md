# pinterest-feed: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/pinterest-feed.md`
- Size: 25 nodes, 32 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture 10, clean variant: Pinterest's materialised home feed, built by
queue-driven SmartFeed workers into HBase through Zen, with Pixie's in-memory graph
rebuilt daily from Hadoop and a Pacer async platform that isolates every queue.

Fixes relative to pinterest-feed.broken.yaml:
  - api-service hands feed generation to pacer-api as an async job; nothing calls a worker
    synchronously, so fan-out never sits on the request path
  - feed-jobs-queue and media-jobs-queue each have their own worker pool (smartfeed-worker,
    media-worker), which is what Pacer's per-queue Kubernetes pods buy
  - both queues declare a dead-letter queue, so a poison job is parked instead of retried forever
  - pacer-broker stays in the core trust zone rather than being pinned to one availability zone
  - mysql-fleet declares backups and a retention window
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture 10, broken variant: the same Pinterest home feed with the async
platform taken away - the feed is generated inline on the read path, one worker pool
drains every queue, no queue has a dead-letter queue, every dequeue broker sits in one
availability zone and the sharded MySQL fleet declares no backup.

This file MUST trip:
  - fanout-inline-in-request-path          (smartfeed-service calls smartfeed-worker synchronously)
  - shared-worker-pool-across-queues       (smartfeed-worker drains both queues while isolation.perQueue is true)
  - queue-missing-dlq                      (feed-jobs-queue and media-jobs-queue: deadLetterQueue false, async in-edge)
  - stateful-node-without-zone-redundancy  (pacer-broker is stateful and lives only in az-a)
  - datastore-missing-backup               (mysql-fleet: backupEnabled false)
and MUST NOT trip:
  - credentials-without-rotation           (security.credentialRotationDays is still 90)
  - cache-missing-eviction-policy          (pin-cache and board-cache both declare lru)
  - cache-as-primary-store-without-persistence, materialised-cache-without-rebuild-path
                                           (neither cache is materialised or a primary store)
  - push-fanout-without-celebrity-path     (no worker declares a push fan-out strategy)
  - stateful-hash-ring-without-ring-manager (pacer-broker is assigned partitions by lookup, not a hash ring,
                                           and still talks to Helix)
  - stateful-engine-pinned-to-single-zone  (Helix and ZooKeeper stay outside the zone groups and are replicated)
  - datastore-single-region                (multiRegion is false)
  - read-heavy-path-without-cache          (no readWriteRatio is stated and the design has caches)
  - sync-chain-too-deep                    (no api-gateway node and no p95 target)
  - derived-store-without-cdc-or-rebuild, business-updates-without-index-propagation (no search index)
  - retry-without-adaptive-shedding        (the one retrying edge keeps its circuit breaker)

The three PinLater failure modes the sources describe are exactly what the broken twin re-creates:
noisy neighbours (one pool for the image-transform queue and the feed queue), no parking place for a
poison job, and a stateful dequeue tier with no second zone. The inline-generation break is the
mistake PinLater existed to prevent: the home feed post is explicit that the SmartFeed worker is
"called by PinLater", never by the read path.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Web clients | `web-client` | `web-browser` | client | exact |
| iOS / Android apps | `mobile-client` | `mobile-app` | client | exact |
| Python API services with Thrift RPC | `api-service` | `container-service` | app-server | close (in-house service, generic component) |
| SmartFeed service | `smartfeed-service` | `container-service` | app-server | close |
| SmartFeed content generator | `content-generator` | `container-service` | app-server | close |
| Follower service | `follower-service` | `container-service` | app-server | close |
| Pinnability | `pinnability` | `tensorflow-serving` | ml-inference | assumed (no generic ml-inference component exists; the engine is not named by the source) |
| Pixie | `pixie` | `graph-store` | graph-database | close (`inMemory: true`, `rebuildCadenceHours: 24` carry the paper's facts) |
| Zen | `zen` | `graph-store` | graph-database | close (in-house graph service; its HBase backend is modelled as the two edges out of it) |
| HBase pools cluster | `feed-pools-hbase` | `hbase` | nosql-database | exact |
| HBase materialised content | `feed-materialised-hbase` | `hbase` | nosql-database | exact |
| HBase hot standby (second AZ) | `feed-materialised-standby` | `hbase` | nosql-database | exact |
| Pacer Thrift API service | `pacer-api` | `container-service` | app-server | close |
| Pacer dequeue broker | `pacer-broker` | `container-service` | app-server | close (`stateless: false`, `shardingStrategy: "lookup"` for Helix-assigned exclusive partitions) |
| Pacer job queue (feed generation) | `feed-jobs-queue` | `message-queue` | queue | close (MySQL-backed queue; `persistence: true`) |
| Pacer job queue (image transforms) | `media-jobs-queue` | `message-queue` | queue | close |
| SmartFeed worker pool | `smartfeed-worker` | `container-worker` | worker | exact |
| Image-transform worker pool | `media-worker` | `container-worker` | worker | exact |
| Apache Helix | `helix` | `apache-helix` | coordination-service | exact |
| ZooKeeper | `zookeeper` | `zookeeper` | coordination-service | exact |
| Graph build machine | `pixie-graph-builder` | `container-worker` | worker | close (scheduled worker; the single TB-RAM host is not expressible) |
| Hadoop | `hadoop` | `hadoop-yarn` | big-data-cluster | exact |
| Sharded MySQL fleet | `mysql-fleet` | `mysql` | sql-database | exact (`sharded`, `idEncodesShard`) |
| Memcache | `pin-cache` | `memcached` | cache | exact |
| Redis | `board-cache` | `redis` | cache | exact |

Confidence tally: 11 exact, 12 close, 2 assumed (`pinnability`'s serving engine, and the
assumed property values listed below).

Properties set because a rule reads them and no source states them, per the brief:
`deadLetterQueue: true` and `backoff: "exponential-jitter"` on both Pacer queues (Pacer retries
failed jobs; no source names a parking queue), `backupEnabled` / `backupRetentionDays` /
`encryptionAtRest` on the MySQL fleet and the HBase clusters, and
`security.credentialRotationDays: 90`.

## Catalogue gaps

| Product | Kind it would need | Used instead |
|---|---|---|
| Pixie (in-house C++ in-memory random-walk graph server) | graph-database with a random-walk / recommendation flavour | `graph-store` with `inMemory: true` |
| Zen (in-house graph storage service over HBase) | graph-database with a pluggable storage backend | `graph-store` |
| PinLater / Pacer (in-house MySQL-backed job platform) | queue backed by a relational store, with exclusive partition ownership | `message-queue` |
| Pinnability (in-house home-feed ranker) | ml-inference generic (`default` has only named engines: bentoml, kserve, triton, tensorflow-serving...) | `tensorflow-serving` |
| Terrapin | nosql-database served from batch output | not used - the fact could not be verified, so the node was dropped |
| Goku (in-house Gorilla-compressed TSDB) | timeseries-database generic (`default` has only named engines) | not used - the subsystem could not be verified in this pass |

No component was added to the catalogue for this design.

## Not encoded

- Pixie's random walk itself: biased walks with early stopping, the "does not cross machines" property, and LDA-based pruning are algorithm facts with no place in a topology format.
- The Pixie numbers that describe one machine rather than the box as a whole: 1,200 requests/sec per server, 244 GB RAM, 120 GB resident graph, 3B nodes / 17B edges. `nfr.rps` carries the cluster figure (100,000/sec); the rest live only in `source/`.
- The 99-percentile latency target of 60 ms is carried as `latency.p99Us: 60000`; the format has no `p99Ms`.
- The 64-bit id layout (16-bit shard, 10-bit type, 36-bit local) collapses to `idEncodesShard: true` plus `shardKey`. "No cross-shard joins" survives only as an edge label.
- Speculative execution is an edge with `fallback: "degraded"`; the format cannot say "issue both requests in parallel and take the first answer", nor "fire the second past the 99.9th percentile".
- Per-queue Kubernetes pod pools appear as `orchestrator: "kubernetes"` on the workers plus one queue per worker; Kubernetes itself is not a node, as the intake card directs.
- "One third of Pinterest traffic goes through the home feed", "hundreds of millions of calls per day" and "millions of operations per second" are system-wide figures with no single box to attach to.
- Pinterest's observability path (Goku, its Kafka ingestion, the move from push to shard-aware pull) is left out: no primary source was reachable on 2026-09-13.
