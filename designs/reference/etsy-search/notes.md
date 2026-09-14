# etsy-search: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/etsy-search.md` (14 first-party Code as Craft posts, re-verified 2026-09-14 against the archived bodies in `work/research/etsy-search/fetched/`; etsy.com answers 403 to fetchers).
- Size: 24 nodes, 26 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture: Etsy search — a PHP render path over ~1,000 MySQL shards routed by
Vitess, a two-pass search service (Lucene candidate retrieval then a personalised ranking
pass), Kafka-fed streaming indexers and BitTorrent index distribution to the search replicas.

Fixes relative to etsy-search.broken.yaml:
  - the unsharded index database is gone: vitess routes every sharded query with a hybrid
    vindex and reads the shard mappings from a read-only SQLite copy on each Vitess server,
    so no single unsharded table sits in front of all 1,000 shards
  - the ORM no longer writes the shards directly; mysql-shards is reached only through the
    Vitess proxy, which is what decouples the render path from shard routing
  - memcached is a look-aside cache (materialised false): the personalised second pass is
    ranked per user and query, so ranked results are not kept as the only copy of a view
  - consistent hashing (Ketama) is a property of the cache pool, not a hash ring the render
    path owns, so there is no ring for the application to manage by hand
  - kafka and zookeeper are spread over three zones (broker.rack, RF=3), not pinned to zone a
  - franz produces to kafka without a retry policy that outruns the brokers
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: Etsy search, broken variant. The same system as etsy-search.yaml with
the mistakes the Code as Craft posts themselves describe: the ORM writing the shards directly
after looking every record up in one unsharded index database, the render path owning the
Ketama ring for the cache pool with nothing to manage it, a per-query cache of personalised
ranked results that nothing can rebuild, Kafka and ZooKeeper packed into one zone to save
inter-zone network cost, and Franz retrying into those brokers without a circuit breaker.

This file MUST trip:
  - single-writer-primary-at-peak-qps           (index-database is unsharded and takes 1.7M rps in front of every shard query)
  - business-updates-without-index-propagation  (mysql-shards and index-database are written sync by web-render-path, a search index exists, no CDC leaves them)
  - materialised-cache-without-rebuild-path     (ranking-cache is materialised, written only by an app-server and a model server)
  - stateful-engine-pinned-to-single-zone       (zookeeper sits in zone-a with replicated false)
  - stateful-hash-ring-without-ring-manager     (web-render-path shards by consistent hash with no coordination-service edge)
  - retry-without-adaptive-shedding             (franz retries into kafka with no circuit breaker and no rate limiter in front)
and MUST NOT trip:
  - cache-as-primary-store-without-persistence, cache-missing-eviction-policy, datastore-missing-backup,
    datastore-single-region, read-replica-as-sole-scaling, derived-store-without-cdc-or-rebuild,
    fanout-inline-in-request-path, read-heavy-path-without-cache, credentials-without-rotation,
    stateful-node-without-zone-redundancy, sync-chain-too-deep, queue-missing-dlq, retry-queue-without-dlq,
    pubsub-replay-required, windowed-aggregation-without-watermark, shared-dependency-without-redundancy,
    push-fanout-without-celebrity-path, cross-cell-call, object-store-single-zone-with-durability-target,
    multi-leader-store-without-conflict-policy, external-call-inline-without-durable-path

Each mistake is one the Etsy posts warn about in their own words: the index database that
"could cause a full site outage", the ranking cache that personalization defeats because
"we have to rank listings for every user and query pair", the single-zone Kafka whose outage
was "resulting in stale search results", and Franz's "in-memory buffer and unlimited retries"
as the only hedge when the brokers are gone.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Buyers on web, mobile web and mobile app | `buyer-client` | `user-device` | client | exact |
| Web / API tier, "production render path" (PHP) | `web-render-path` | `container-service` | app-server | exact |
| Internal http API cluster, >300k rps at peak | `internal-api` | `container-service` | app-server | exact |
| Varnish | `varnish` | `varnish` | cache | exact |
| memcached pools, Ketama, >20M rps | `memcached` | `memcached` | cache | exact |
| Vitess | `vitess` | `vitess` | database-proxy | exact |
| SQLite shard-map copied onto each Vitess server | `shard-map-sqlite` | `sqlite` | sql-database | exact |
| Sharded MySQL cluster, ~1,000 shards, 425 TB, ~1.7M rps | `mysql-shards` | `mysql` | sql-database | exact |
| Search application | `search-app` | `container-service` | app-server | exact |
| `spell_correction` | `spell-correction` | `container-service` | app-server | exact |
| `mixer` | `mixer` | `container-service` | app-server | exact |
| Search application first pass, `listings_search` / Solr replicas | `listings-search` | `solr` | search-index | close (Solr is the only engine the fetched posts attach to the listings index, in 2012; the current engine is never stated) |
| Solr primary, nightly optimize | `index-primary` | `solr` | search-index | exact |
| BitTorrent index replication (ttorrent, herd/BitTornado, pigz) | `torrent-replicator` | `container-worker` | worker | close (the card's kind; no BitTorrent component exists) |
| Search ranking, second pass, TF Ranking DNN | `ranking-service` | `tensorflow-serving` | ml-inference | close (TensorFlow/TF Ranking is named; the server product is not) |
| Semantic relevance student, two-tower BERT | `relevance-student` | `tensorflow-serving` | ml-inference | assumed (no serving product named; the catalogue has no generic ml-inference component — see Catalogue gaps) |
| LLM teacher, Qwen 3 VL 4B served with vLLM | `relevance-teacher` | `vllm` | ml-inference | exact |
| Search index build / indexers, "streaming applications" | `search-indexer` | `container-worker` | worker | close (the card proposed stream-processor; no windowing or engine is stated, and the rules read a worker's async edge into the index) |
| Kafka cluster on GKE, RF=3, `broker.rack` | `kafka` | `kafka` | stream | exact |
| Franz, Etsy's primary Kafka producer | `franz` | `container-worker` | worker | exact |
| ZooKeeper, multi-zone | `zookeeper` | `zookeeper` | coordination-service | exact |
| GKE search clusters, `search-flip` / `search-flop` | `gke-search` | `google-gke` | container-orchestrator | exact |
| Deployinator + Jenkins | `deploy-pipeline` | `jenkins` | ci-pipeline | close (Deployinator has no component; the pipeline that does the work is Jenkins) |
| Metrics / StatsD relays | `metrics` | `observability-stack` | monitoring | close (no StatsD component; Graphite exists but is a timeseries-database, not the relay tier) |
| Index database (broken twin only) | `index-database` | `mysql` | sql-database | exact |
| Ranked results cached per query (broken twin only) | `ranking-cache` | `memcached` | cache | close (the post says ranked results are cached per query; the pool is not named separately) |

Values that are **assumed, not stated** by any fetched source, and why:

- `mysql-shards` / `shard-map-sqlite` `backupEnabled: true`, `backupRetentionDays: 30`. No post
  states a backup policy. `datastore-missing-backup` encodes a practice a 425 TB system of
  record must have; the properties are set to that practice rather than left to the vendor default.
- `security.credentialRotationDays: 90`. Not stated anywhere; set for the same reason.
- `shardKey: "shop_id"` — the post says "the majority of models use shop_id or user_id as the
  shardifier id, but there are over 30 different options in use", so one value stands for a set.
- `http` on the render path to search-services edges and on the internal search-service calls:
  the protocol is explicitly never named in any fetched post.
- `vitess` `routing: "lookup"` and `scatterGather: false`: the custom hybrid vindex picks the
  SQLite lookup vindex below an id threshold and the hash vindex above it, and Vitess "requires
  the shardifier id to be present in the WHERE clause", which is what `scatterGather: false`
  records. One enum value has to stand for the hybrid.
- `franz` carries no `retryPolicy` in the clean design. The post states unlimited in-memory
  retries with no circuit breaker; encoding that honestly trips `retry-without-adaptive-shedding`,
  so the hazard is expressed in the broken twin instead and the clean edge states only the buffer.
- `replicas: 11` on `listings-search` and `rebuildCadenceHours: 24` on `index-primary` come from
  the 2012 Solr post, which is the only post that states either.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| In-house embedded relevance model server (two-tower BERT inside the search stack) | a generic `ml-inference` component under `default` (every default ml-inference component is a named product) | `tensorflow-serving` |
| StatsD / StatsD relays | `monitoring` | `observability-stack` |
| Deployinator | `ci-pipeline` | `jenkins` (the pipeline Deployinator triggers) |
| ttorrent / BitTornado peer-to-peer index distribution | `worker` (or a `search-index.replicationTransport` property) | `container-worker` |
| Barista, Etsy's in-house model-serving control plane | a generic `ml-platform` component under `default` | not encoded (see below) |

## Not encoded

- **Barista and its CloudSQL config store.** `ml-platform` has no generic component, and Barista
  is a control plane that creates Kubernetes objects for served models rather than a node on the
  search request path. Left out rather than mapped onto an unrelated named product.
- **Elasticsearch fleet.** The 2014 post names Elasticsearch for Logstash, analytics and "user-facing
  search on some large indexes", but never ties it to listing retrieval, so asserting it beside
  `listings-search` would be a guess. Its host-awareness detail (`cluster.routing.allocation.awareness`)
  has no property in the format either.
- **Cache smearing and Ketama's rehash properties.** `cache.hashing: consistent` records Ketama,
  but the hot-key mitigation (a few bits of entropy appended to a hot key, and the data-inconsistency
  tradeoff it buys) has no property in v1. It is the single most Etsy-specific cache decision here.
- **Varnish key composition** (url + query params + `Vary` headers, with locale in the key) lives
  only in the edge label.
- **`search-flip` / `search-flop` blue-green namespaces and their 180 CPU / 200Gi quotas.** Groups
  carry no properties, and a namespace is not a node.
- **Per-shard transaction atomicity ("atomicity is only guaranteed per connection").** `nfr.consistency:
  strong` on `mysql-shards` is the closest the format gets; the per-connection scope is not expressible.
- **Slush, the seasonal partial change freeze, and the pre-negotiated GCP quota deadline.** Both are
  operating requirements with no requirement path.
- **The two-pass split itself.** `listings-search -> ranking-service` shows the hand-off and the edge
  labels carry the 1,000-candidate number, but `search-index` has no `passes` or `candidateCount`
  property, so "ranking runs over less than one percent of all listings" is prose only.
- **On-prem Kubernetes during the migration** ("services in two places at once"). A second
  orchestrator node with no distinct edges would add nothing the region group does not already say.
- **Gomez external synthetic probes**, and the ~30,000 metrics / ~2,000 paging / ~2 minute
  time-to-detect numbers: the monitoring kind has no counters for them.
