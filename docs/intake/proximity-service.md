# Intake: Proximity service (Xu vol 2 ch 1) with Yelp business search production design

## Source
- Primary: Alex Xu and Sahn Lam, System Design Interview vol 2, chapter 1 "Proximity Service"; public notes via https://sodkiewiczm.medium.com/geek-read-system-design-interview-2-by-alex-xu-bdb09d2ab189 and search summaries (devinz1993 notes 403 in this pass)
- Primary: https://engineeringblog.yelp.com/2017/06/moving-yelps-core-business-search-to-elasticsearch.html (official Yelp, 2017: geosharding, microindexes, Lucene to Elasticsearch)
- Primary: https://engineeringblog.yelp.com/2019/07/maptype-fast-doc-value-lookups-for-map-data-in-elasticsearch.html (official Yelp, 2019: geohash doc values; via search summary)
- Cross-references: uber-dispatch (S2 cells, Ringpop), tinder-geo (S2 geoshards in Elasticsearch), grab-geo (Pharos road-network KNN)
- Verified by: canonical textbook chapter + two official Yelp posts
- Confidence: high
- Date of source: 2017-2022

## System in three lines
Returns businesses within a radius of a user's location: a stateless, read-heavy location-based service (LBS) queries a geospatial index (geohash strings in a DB or Redis, or an in-memory quadtree, or S2 cells) for the user's cell and its neighbours, then hydrates business details from a cache backed by a sharded MySQL with read replicas; a separate business service handles CRUD with slower propagation to the index. Yelp's production version geoshards Elasticsearch by city and microshards by business id with custom ranking plugins. Hard because reads dominate by orders of magnitude, index rebuilds are expensive, and cell-boundary effects require neighbour queries.

## Scale (only if stated)
- Users / DAU: book 100M DAU, 200M businesses
- Requests per second: book ~5,000 searches/sec (100M x 5 searches/day)
- Data volume: geohash index small (business id per cell); quadtree for 200M businesses fits in a few GB memory (book estimate ~1.7 GB)
- Message throughput: business updates propagated nightly or hourly (book)
- Yelp: code pushes "took several hours" on the legacy Lucene cluster; reduced to minutes with hot plugin loading

## Requirements stated or clearly implied
- Availability target: read path highly available; index replicas
- Consistency: business updates may lag in the index (eventual); Yelp legacy had "a delay in the updated index being served by the queries"
- Latency target: low latency for nearby search; not quantified in book
- Ordering needs: results ranked by distance (and relevance in Yelp)
- Replay or reprocessing: quadtree rebuilt from DB (minutes for 200M); Yelp regular reindexing from snapshots via S3
- Retention: business data long-lived
- Compliance / residency: none stated; multi-region deployment by geography suggested

## Boundaries
- Regions / zones: book suggests region-local LBS clusters; Yelp geoshards by geography
- Trust zones: clients -> load balancer -> LBS / business service -> cache, DB, index
- Named subsystems: LBS (stateless), Business service (CRUD), Geospatial index (geohash table, Redis, quadtree servers, or S2), Cache (Redis), Database (MySQL primary and replicas); Yelp: Elasticsearch geoshards, ranking plugins, indexing pipeline, S3 snapshots

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Clients | Send lat/long and radius | mobile, web | mobile-client, web-client | |
| 2 | Load balancer | Routes to LBS or business service by path | generic | load-balancer | |
| 3 | Location-based service (LBS) | Stateless, read-heavy nearby search; computes geohash and 8 neighbours | in-house | app-server | stateless: true; readHeavy: true |
| 4 | Business service | CRUD of businesses; writes DB, updates index | in-house | app-server | |
| 5 | Geohash index | Table geohash to business ids with compound index; precision 4-6 | MySQL or Redis | geospatial-index | scheme: geohash; precision: 4-6 |
| 6 | Quadtree servers (alternative) | In-memory tree adapting cell size to density; rebuilt from DB; replicated for reads | in-house | geospatial-index (in-memory) | inMemory: true; rebuildMinutes: few |
| 7 | S2 (alternative) | Hilbert-curve cells, geofencing friendly | Google S2 | geospatial-index | scheme: s2 |
| 8 | Redis cache | business id lists per geohash and business info by id | Redis | cache | keys: geohash, businessId |
| 9 | MySQL | Business table sharded by id, primary with read replicas | MySQL | sql-database | replication: primary-replica; sharded: true |
| 10 | Yelp Elasticsearch | Geosharded logical indexes by location, microindexes by business_id mod n, replicas | Elasticsearch | search-index | shardingStrategy: geo + hash |
| 11 | Ranking plugin | Document and Scorer interfaces, hot-reloadable jars | in-house plugin | property of search-index | hotReload: true |
| 12 | Indexing pipeline | Regular reindexing; legacy snapshots via S3 | in-house | etl-job + object-store | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | lb | https | sync | | |
| lb | lbs | http | sync | | GET nearby |
| lbs | redis (geohash -> ids) | redis | sync | | cell + 8 neighbours |
| lbs | redis (business info) | redis | sync | | hydrate |
| redis miss | mysql replica | sql | sync | | fill |
| lbs | quadtree servers (alt) | rpc | sync | | replicated reads |
| lb | business service | http | sync | | CRUD |
| business service | mysql primary | sql | sync | | |
| mysql primary | replicas | replication | async | | |
| business service | index / cache update | async | async | | nightly or hourly rebuild |
| yelp query | elasticsearch geoshard | http | sync | | routed by location |
| indexing pipeline | elasticsearch | bulk | async | | reindex |
| snapshot | s3 | write | async | | legacy distribution |

## Failure modes, incidents, tradeoffs the source discusses
- Geohash vs quadtree: geohash easy to update and shard; quadtree adapts to density but needs rebuild and memory; boundary issue solved by querying neighbours. Source: book notes.
- Quadtree rebuild blocks reads unless blue-green server swap; rebuild takes minutes for 200M businesses. Source: book notes.
- Read-heavy scaling: replicate LBS and quadtree servers; cache hot cells. Source: book notes.
- Legacy index staleness at Yelp forced parallel Elasticsearch queries for real-time features. Source: Yelp.
- Deployment cost: full cluster cycling and rewarming made pushes "take several hours"; plugin hot loading fixed. Source: Yelp.
- Scoring as bottleneck found with profiling; shard count set empirically; binary doc values avoid deserialisation GC. Source: Yelp.
- Geosharding keys on city, microsharding on id; hash-based mod is "simplistic" but balances. Source: Yelp.

## Unknowns
- Book's exact cache TTL and index update cadence
- Yelp shard counts and QPS
- Handling of moving objects (covered by uber/grab cards)

## Candidates
- New kinds: none; sightings: geospatial-index (4th), search-index (10th), cache (23rd), sql-database (23rd), load-balancer (15th), etl-job (14th), object-store (21st)
- New properties on existing kinds: geospatial-index.precision (integer), neighbourQuery (boolean), rebuildMinutes; search-index.hotReloadRanking (boolean), microshards (integer); app-server.readHeavy (boolean)
- New edge properties: neighbourFanout (9 cells)
- New requirement paths: locality.radiusMiles (2nd sighting); freshness.indexHours
- New rules:
  - cell-query-without-neighbours: geospatial-index radius search edge with neighbourQuery false (boundary misses)
  - in-memory-index-rebuild-without-swap: geospatial-index inMemory with rebuild and no blue-green or replica swap (read stalls)
  - business-updates-without-index-propagation: business service write edges to DB with no edge to index or cache invalidation while freshness.indexHours set
  - single-index-for-global-geo: search-index serving global locations with shardingStrategy hash only and no geo shard (3rd sighting of geo sharding theme)
