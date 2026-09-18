# proximity-service: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/proximity-service.md`
- Size: 16 nodes, 22 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture 29, clean variant: a read-heavy proximity service that answers "what is
near me" from a geohash cell index and its eight neighbours, hydrates business details from a
cache over a sharded MySQL, and keeps every derived index fed by its own worker.

Fixes relative to proximity-service.broken.yaml:
  - business-service only writes business-db; business-cdc reads the binlog and index-updater
    is the worker that propagates changes to geohash-index and invalidates both caches
  - geohash-cache is a materialised cell-list cache fed by that worker, not the only copy of
    the cell index, so usedAsPrimaryStore is false and a cold cache refills from geohash-index
  - quadtree-rebuild-job rebuilds the in-memory quadtree from business-db, so the alternative
    index has a rebuild path instead of being written inline by the business service
  - indexing-pipeline reindexes the Yelp geoshards asynchronously and writes the S3 snapshots
    the cluster loads at startup
  - the lbs to geohash-cache hop no longer retries bare: no retry policy is stated by the
    source, so none is declared, and the index hops carry a circuit breaker
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture 29, broken variant: the same proximity service, but the business
service dual-writes the geohash index and the cell lists, the Redis cell index is the only
copy of which businesses sit in which cell, and the location service retries into it bare.

This file MUST trip:
  - business-updates-without-index-propagation  (business-db is written sync by business-service, search indexes exist, no change-data-capture leaves it)
  - derived-store-without-cdc-or-rebuild        (geohash-index is only written inline by business-service; no worker or stream feeds it)
  - cache-as-primary-store-without-persistence  (geohash-cache: usedAsPrimaryStore true, persistence false)
  - materialised-cache-without-rebuild-path     (geohash-cache is materialised and only app-servers write into it)
  - retry-without-adaptive-shedding             (lbs -> geohash-cache retries exponentially with no circuit breaker and no rate limiter in front)
and MUST NOT trip:
  - cache-missing-eviction-policy               (both Redis nodes declare lru)
  - read-heavy-path-without-cache               (the design has caches, and no readWriteRatio requirement is stated)
  - datastore-missing-backup, datastore-single-region, read-replica-as-sole-scaling,
    single-writer-primary-at-peak-qps           (business-db is sharded, backed up with retention; multiRegion is false; no rps is declared on it)
  - credentials-without-rotation                (security.credentialRotationDays is set)
  - queue-missing-dlq, pubsub-replay-required, windowed-aggregation-without-watermark,
    shared-worker-pool-across-queues            (no queue, topic or stream processor in this design)
  - sync-chain-too-deep                         (no api-gateway node and no p95 latency target)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone,
    object-store-single-zone-with-durability-target, shared-dependency-without-redundancy,
    multi-leader-store-without-conflict-policy  (no such node, zone group or requirement)

The broken twin keeps 14 nodes and 20 edges: `business-cdc` and `index-updater` are removed and
their work is done inline by `business-service`.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Clients (mobile) | `mobile-client` | `mobile-app` | client | exact |
| Clients (web) | `web-client` | `web-browser` | client | exact |
| Load balancer | `lb` | `load-balancer-tier` | load-balancer | exact |
| Location-based service (LBS) | `lbs` | `container-service` | app-server | exact |
| Business service | `business-service` | `container-service` | app-server | exact |
| Geohash index (geohash -> business ids table) | `geohash-index` | `geo-cell-index` | search-index | close |
| Quadtree servers (alternative) | `quadtree-servers` | `geo-cell-index` | search-index | close |
| Geohash Redis (business id lists per cell) | `geohash-cache` | `redis` | cache | exact |
| Business info Redis (business by id) | `business-cache` | `redis` | cache | exact |
| MySQL business table, primary with read replicas | `business-db` | `mysql` | sql-database | exact |
| Yelp geosharded Elasticsearch | `geoshard-index` | `elasticsearch` | search-index | exact |
| Yelp indexing pipeline / reindex | `indexing-pipeline` | `container-worker` | worker | exact |
| Yelp legacy S3 index snapshots | `snapshot-store` | `s3` | object-store | exact |
| Quadtree rebuild from the database | `quadtree-rebuild-job` | `container-worker` | worker | close |
| Business update propagation to index and cache | `index-updater` | `container-worker` | worker | close |
| (no source box) binlog reader feeding that propagation | `business-cdc` | `debezium` | change-data-capture | assumed |
| S2 cells (alternative) | not encoded | — | — | — |
| Ranking plugin (Document/Scorer, hot-reloadable JARs) | not encoded | — | — | — |

Tally: 13 exact, 4 close, 1 assumed.

`business-cdc` is the one node with no box in the source. The book propagates business changes
to the index with a batch job, not with change data capture; `business-updates-without-index-propagation`
fires on any relational system of record that application servers write while a search index
exists and nothing streams its changes out. Adding the binlog reader is the mechanism that rule
asks for, and it is what the Yelp pipeline effectively does when it reindexes from the source of
truth. It is marked `assumed`, and `work/designs/proximity-service/verify.md` records it.

Two further values are set rather than read from the source:
- `security.credentialRotationDays: 90` — no source states a rotation period. Without it the
  clean design trips `credentials-without-rotation`, which every design holding data must
  answer. 90 days is the value the other reference designs use.
- `freshness.maxSeconds: 86400` — the only cadence confirmed in this pass is a daily batch. The
  card's "nightly or hourly" is not encoded.

## Catalogue gaps

No component was missing outright; two boxes had no exact product and one property has no home.

| product | kind it would need | used instead |
|---|---|---|
| Quadtree index server (in-memory tree, rebuilt from the database) | geospatial index as an in-memory tree | `geo-cell-index` with `geoScheme: "quadtree"`, `inMemory: true` |
| Geohash lookup table living in a relational store | geospatial index backed by a table | `geo-cell-index` with `geoScheme: "geohash"`, `inMemory: false` |
| Yelp ranking plugin (Document/Scorer JARs, hot loaded) | plugin or extension of a search index | no node and no property; not encoded |

## Not encoded

- The S2 alternative for the geospatial index. The source offers geohash, quadtree and S2 as
  three ways to build the same box; two are drawn as nodes, a third would be a third copy of the
  same box rather than a runtime element.
- The ranking plugin's hot reloading. `search-index` has no property for a reloadable scoring
  plugin, and the plugin is not a separate runtime node — it runs inside `geoshard-index`.
- Microsharding by `business_id % n` inside each geoshard. `shardingStrategy` takes one value;
  `geo` is the outer scheme and the hash microshard beneath it has no second field.
- The scale numbers that are not per-node rates: 100M DAU, 200M businesses, 5 searches per user
  per day. Only the derived ~5,000 QPS is encoded, as `lbs.nfr.rps`.
- Quadtree rebuild cost ("a few minutes for 200M businesses") and the incremental rollout that
  keeps reads served while a server rebuilds. Both live in the edge label only; there is no
  blue-green or rebuild-duration property.
- Binary doc values, the zero-copy maptype lookup and the profiling that found scoring to be the
  bottleneck: implementation detail inside `geoshard-index`.
- The "several hours" deploy time of the legacy Lucene cluster and its reduction to minutes.
  That is a property of a deployment process, which the format does not model.
- The radius-to-geohash-length reference table. Only the single confirmed row (500m -> 6) is
  encoded, as `cellLevel: 6`.
