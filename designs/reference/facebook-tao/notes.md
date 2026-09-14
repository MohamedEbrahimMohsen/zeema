# facebook-tao: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/facebook-tao.md` (four peer-reviewed papers by Facebook/Meta engineers — USENIX ATC '13, USENIX NSDI '13, USENIX OSDI '20, PVLDB 2021 — plus two official Meta engineering posts; verification appended to the card).
- Size: 23 nodes, 34 edges, 5 groups (broken variant: 20 nodes, 30 edges, 5 groups).

## Clean variant (header of design.yaml)

Reference architecture: Facebook/Meta TAO, clean variant. The read-optimised social graph
store — a per-region follower (L1) cache tier in front of one leader (L2) tier per region,
over statically sharded MySQL, with invalidations and refills riding the replication stream.

Fixes relative to facebook-tao.broken.yaml:
  - the graph is stored in hundreds of thousands of shards (master-db and slave-db sharded,
    the shard id embedded in every object id), not one unsharded primary with read replicas
  - web-server never writes a store directly: every write goes follower -> leader ->
    master-leader -> master-db, so one cache coordinator per shard owns the database
  - binlog-stream tails the master's commit log, so cache maintenance and index updates are
    derived from the log instead of dual-written by application code
  - index-pipeline consumes wormhole and feeds secondary-index asynchronously
  - wormhole is replayable, so invalidations lost to a leader failure can be re-delivered
  - flighttracker supplies read-your-writes per session, and refill-library keeps ~3 minutes
    of recent writes so a cache miss can still see them
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: Facebook/Meta TAO, broken variant. The lookaside architecture TAO was
built to replace, rebuilt at TAO's scale: one unsharded MySQL graph database with async read
replicas as the only scaling, a PHP web tier that writes the database and the secondary index
itself, no binlog tailer feeding the index, and a Wormhole topic that cannot replay the
invalidations a leader failure loses.

This file MUST trip:
  - single-writer-primary-at-peak-qps          (graph-db: multiWriter false, sharded false, 1000000 rps)
  - read-replica-as-sole-scaling               (graph-db: replication async, sharded false, distributed false)
  - business-updates-without-index-propagation (web-server writes graph-db sync; no change-data-capture leaves it)
  - derived-store-without-cdc-or-rebuild       (secondary-index has only sync in-edges from web-server)
  - pubsub-replay-required                     (wormhole replay false while messaging.replay is true)
and MUST NOT trip:
  - datastore-missing-backup                 (both MySQL nodes declare backup and retention)
  - datastore-single-region                  (both MySQL nodes declare async replication)
  - multi-leader-store-without-conflict-policy (multiWriter stays false: one primary per graph)
  - cache-missing-eviction-policy            (every cache and memcache node declares lru or ttl)
  - cache-as-primary-store-without-persistence, materialised-cache-without-rebuild-path
                                             (no cache is a primary store or a materialised view)
  - read-heavy-path-without-cache            (the design is nothing but caches)
  - credentials-without-rotation             (security.credentialRotationDays is set)
  - fanout-inline-in-request-path            (web-server calls no worker synchronously)
  - retry-without-adaptive-shedding          (no edge declares a retry policy)
  - sync-chain-too-deep                      (no api-gateway node and no latency.p95Ms target)
  - queue-missing-dlq, retry-queue-without-dlq (no queue node)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone
                                             (no availability-zone group)
  - shared-dependency-without-redundancy     (availability.discoveryRedundant is not declared)
  - stateful-hash-ring-without-ring-manager  (web-server declares no shardingStrategy)

The four defects are the ones TAO's own authors name as the reasons the lookaside architecture
had to go: a key-value cache is a poor fit for edge lists, control logic distributed across
clients that cannot avoid thundering herds, read-after-write consistency paid for by the
remote-marker scheme, and a graph that cannot be partitioned by user — answered here by *not*
partitioning at all. The fifth, a non-replayable invalidation bus, is the failure the 2013 paper
calls out directly: "a follower may be left with stale data if these messages are lost due to
permanent leader failure."

## Mapping

| source box | node | component | kind | confidence |
|---|---|---|---|---|
| Users of the web tier | `end-user` | `web-browser` | client | assumed (implied by "as measured from the web server"; no source draws the box) |
| Load balancer that made users sticky to one L1 cache cluster | `frontend-lb` | `load-balancer-tier` | load-balancer | close (no vendor named; `hashing: consistent` carries the stickiness) |
| Web server (PHP web tier) | `web-server` | `container-service` | app-server | exact |
| TAO client stack | — | — | — | not encoded (a library linked into the web tier, not a deployable node) |
| Client-side hot-item cache | `client-hot-cache` | `cache-cluster` | cache | close (version validation and the access-rate threshold have no property) |
| FlightTracker service | `flighttracker` | `cache-cluster` | cache | close (`readBarrier: true` carries "the Ticket rides every downstream query") |
| Follower tier (L1), primary | `follower-primary` | `cache-cluster` | cache | close (no `tier` value distinguishes L1 from L2; the split lives in ids, labels and edges) |
| Follower tier (L1), backup | `follower-backup` | `cache-cluster` | cache | close |
| Leader tier (L2), one per region | `leader` | `cache-cluster` | cache | close |
| Leader tier in the shard's master region | `master-leader` | `cache-cluster` | cache | close |
| RefillLibrary | `refill-library` | `cache-cluster` | cache | close (`ttlSeconds: 180` is the stated "approximately 3 minutes of writes from all regions") |
| mcrouter | `mcrouter` | `proxysql` | database-proxy | assumed (no memcached-protocol proxy in the catalogue; `requestCoalescing` is the one exact property) |
| memcache lookaside tier | `memcache-tier` | `memcached` | cache | exact |
| Gutter pool | `gutter-pool` | `memcached` | cache | close (`evictionPolicy: ttl` for the stated "short TTL"; no number is given) |
| Regional pool | `regional-pool` | `memcached` | cache | exact |
| mcsqueal | `mcsqueal` | `debezium` | change-data-capture | close (a generic log-based tailer stands in for the named daemon) |
| Database replication stream carrying invalidation and refill messages | `binlog-stream` | `debezium` | change-data-capture | close |
| Supplementary binlog tailer (active only while a region's slave DB is down) | — | — | — | not encoded (a temporary duplicate of `binlog-stream`; no property expresses "active during an outage") |
| Wormhole pub-sub | `wormhole` | `mqtt-broker` | pubsub-topic | assumed (no vendor-neutral pubsub-topic component exists; `delivery: at-least-once` is stated) |
| Asynchronous index update pipeline | `index-pipeline` | `container-worker` | worker | exact |
| Inverse-association repair job | `inverse-repair-job` | `container-worker` | worker | exact |
| Global secondary indexes and materialised views | `secondary-index` | `elasticsearch` | search-index | assumed (never named individually; a generic index store) |
| FT-ReverseIndex | — | — | — | not encoded |
| Global configuration | `global-config` | `etcd` | coordination-service | assumed (no product is named; `role: placement` carries per-shard mastership and promotion) |
| Master (primary) database, logical MySQL shards | `master-db` | `mysql` | sql-database | exact |
| Slave (replica) database | `slave-db` | `mysql` | sql-database | exact |
| Ent | — | — | — | not encoded (a query framework above TAO, linked into the application) |

Tally: 7 exact, 10 close, 6 assumed; 5 source boxes deliberately not encoded.

Boundaries: `master-region` and `slave-region` (both `region` — "we prefer to locate all of the
master databases in a single region", with mastership granted per shard, so the same physical
region is a master for some shards and a slave for others); `master-storage` and
`storage-cluster` (`trust-zone` — the storage cluster holding the databases, nsdi13 §4);
`frontend-cluster` (`trust-zone` — the cluster of web servers plus their cache servers, which is
where a follower tier and the memcache tier live). No `availability-zone` group: no source
discusses zones inside a region.

## Catalogue gaps

Recorded in full in `work/designs/facebook-tao/gaps.md`. The substantive ones:

- **No vendor-neutral `pubsub-topic` component.** Every one under `default` is an MQTT broker or
  Redis Pub/Sub, so Wormhole lands on `mqtt-broker`.
- **No generic `coordination-service` and no generic `search-index` component.** The unnamed
  "global configuration" and the unnamed secondary-index stores must borrow `etcd` and
  `elasticsearch`.
- **No memcached-protocol proxy.** `database-proxy` holds only SQL and Mongo proxies, so
  mcrouter borrows `proxysql`.
- **The `tao` component itself is not used.** It exists (kind `graph-database`) and models the
  whole system as one box — "write-through cache tiers per shard in front of a sharded
  relational store". This design decomposes that box, so its parts are `cache` and
  `sql-database` nodes instead. `tao` remains the right component when another design needs the
  social graph as a single dependency, which is how `twitter-timeline` uses it.
- **No `cache` property distinguishes a follower from a leader**, states that a shard has exactly
  one cache coordinator, or says whether maintenance is by invalidate or by refill. These are the
  three properties TAO's design actually rests on and none of them survives the encoding.

## Not encoded

- The **TAO client stack** and **Ent**: libraries linked into the web tier, not deployable nodes.
  Their routing (consistent hashing, out-of-order responses to avoid head-of-line blocking) and
  Ent's multi-hop query planning have no representation.
- **The changeset returned on a write reply** — the mechanism that gave read-after-write
  consistency inside one follower tier before 2016. A reply is not an edge; the format has no way
  to say that a response carries a cache update back along the caller's own path.
- **The inverse-association write**: the forward edge lands on `id1`'s shard and the inverse on
  `id2`'s, with no atomicity between them. Both shards are the same node here, so the cross-shard
  hop is invisible; only `inverse-repair-job` records that it exists.
- **Failure paths as distinct edges.** `follower-primary -> slave-db` (used on 0.15% of misses)
  and the write failover to a random leader in the tier (0.045% of writes) are one `fallback`
  edge and one omission respectively; the format has no "this edge is only taken on failure".
- **Ordering of consistency messages against replication**: "delivered in a region immediately
  after a transaction has been replicated to a slave database. Delivering such messages earlier
  would create cache inconsistencies." That constraint is the whole point of embedding
  invalidations in the binlog, and it survives only as an edge label.
- **Shard cloning for hot shards**, the **per-atype cache cap of about 6,000 associations** above
  which reads always reach the database, the **association-count sub-cache** (14 bytes per entry),
  and the **per-type memory arenas**: no `cache` property expresses any of them.
- **The leader's on-disk spool** for undeliverable invalidations, and the **bulk shard-id
  invalidation** that recovers from permanent leader loss. Modelling the spool as a `queue` node
  would have been an invention; the source describes it as behaviour of the leader.
- **Critical reads** proxied to the master region: a per-request flag, not a separate edge.
- **The supplementary binlog tailer** started on the master only while a region's slave database
  is down.
- **Scale numbers that belong to no single node**: 96.4% overall read hit rate, 4.9e-6 query
  failure rate over 90 days, replication lag under 1 s 85% of the time (encoded instead as
  `freshness.maxSeconds: 10`, the 99.8th percentile), 1 in 1,500 batched reads showing a
  fractured read, 2.22% Ent changeset failure rate, and per-operation latency distributions.
