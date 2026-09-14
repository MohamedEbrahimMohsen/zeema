# shopify-flash-sale: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/shopify-flash-sale.md`
- Size: 19 nodes, 26 edges, 6 groups (broken variant: 16 nodes, 22 edges, 6 groups).

## Clean variant (header of design.yaml)

Reference architecture: Shopify flash sales and BFCM, clean variant. A scriptable
Nginx/OpenResty edge routes each shop to its own pod through the Sorting Hat routing table
and admits checkout traffic through a per-shop leaky bucket, so a single merchant's sale
cannot exhaust anyone else's MySQL shard, Redis or Memcached.

Fixes relative to shopify-flash-sale.broken.yaml:
  - MySQL is sharded by shop_id into per-pod shards behind Vitess, instead of one shared
    unsharded primary that every shop writes (the Kylie Cosmetics blast radius)
  - Redis and Memcached are per-pod, and each pod has its own job workers, instead of one
    global Redis whose loss takes the whole platform with it (Redismageddon)
  - the per-pod Redis job queues declare a dead-letter queue
  - the Sorting Hat routing table is replicated, so the shared routing dependency is redundant
  - Semian circuit breakers guard the retrying calls out of Shopify Core into the pod
  - Ghostferry (shop-mover) rebalances shards online: locking batch copy, binlog tail,
    Redis writer lock, atomic routing-table switch
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: Shopify flash sales and BFCM, broken variant. The same platform
built the way Shopify itself describes it before the pods: every shop on one shared,
unsharded MySQL primary whose read replicas are the only scaling, one global Redis for
every background job with nowhere to park a poison job, a single unreplicated Sorting Hat
routing table, and the Semian circuit breaker taken off the retrying database client.

This file MUST trip:
  - single-writer-primary-at-peak-qps       (shopify-db: sharded false, multiWriter false, 80000 rps)
  - read-replica-as-sole-scaling            (shopify-db: async replication, unsharded, above 5000 rps)
  - queue-missing-dlq                       (global-redis receives async jobs, deadLetterQueue false)
  - shared-dependency-without-redundancy    (sorting-hat replicated false, availability.discoveryRedundant true)
  - retry-without-adaptive-shedding         (shopify-core -> shopify-db retries exponentially, no circuit breaker, no rate limiter in front of shopify-db)
and MUST NOT trip:
  - cross-cell-call                         (isolation.tenancy is not declared: this variant has no pod isolation to promise)
  - datastore-missing-backup                (every MySQL node declares backup and retention)
  - cache-missing-eviction-policy           (both Memcached nodes declare lru)
  - datastore-single-region                 (both MySQL nodes replicate asynchronously)
  - credentials-without-rotation            (security.credentialRotationDays is set)
  - read-heavy-path-without-cache           (traffic.readWriteRatio is not declared, and caches exist)
  - business-updates-without-index-propagation, derived-store-without-cdc-or-rebuild (no search index in this design)
  - fanout-inline-in-request-path           (no app-server calls a worker synchronously)
  - shared-worker-pool-across-queues        (isolation.perQueue is not declared)
  - retry-without-backoff, retry-queue-without-dlq (no queue has role retry)
  - sync-chain-too-deep                     (no api-gateway node and no latency.p95Ms target)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone (no availability-zone groups)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Buyer browser / bots | `buyer-browser` | `web-browser` | `client` | exact |
| Nginx + OpenResty Lua load balancers | `edge-lb` | `nginx` | `load-balancer` | close (no `scriptable` property; the Lua logic is the separate throttle node) |
| Sorting Hat (shop to pod routing table) | `sorting-hat` | `consul` | `coordination-service` | assumed (in-house; no generic coordination-service component exists, `role: "placement"` carries the meaning) |
| Checkout throttle / queue | `checkout-throttle` | `redis-rate-limiter` | `rate-limiter` | close (Lua + Redis leaky bucket; per-shop scope has no enum value) |
| Shopify Core (Rails modular monolith) | `shopify-core` | `container-service` | `app-server` | close (no Rails component; `runtime: "rails"`) |
| Storefront renderer | `storefront-renderer` | `container-service` | `app-server` | close (`runtime: "liquid"`) |
| MySQL shard (per pod) | `mysql-shard-1`, `mysql-shard-2` | `mysql` | `sql-database` | exact |
| Vitess | `vitess` | `vitess` | `database-proxy` | exact |
| Redis (per pod, queues and jobs) | `pod-1-redis`, `pod-2-redis` | `redis-queue` | `queue` | exact |
| Memcached (per pod) | `pod-1-memcached`, `pod-2-memcached` | `memcached` | `cache` | exact |
| Background job workers | `pod-1-job-workers`, `pod-2-job-workers` | `container-worker` | `worker` | exact |
| Kafka | `kafka-events` | `kafka` | `stream` | exact |
| ETL / analytics pipeline | `etl-pipeline` | `container-worker` | `worker` | close (in-house; no etl-job kind in v1) |
| Ghostferry | `shop-mover` | `container-worker` | `worker` | close (no Ghostferry component; `label: "Ghostferry"`) |
| Filtered replica for global storefront rendering | `storefront-replica` | `mysql` | `sql-database` | exact |
| Semian | — | — | — | modelled as `circuitBreaker: true` on the edges out of `shopify-core` |
| Pods (tenant-isolated slices) | groups `pod-1`, `pod-2` | — | group kind `cell` | exact |
| GCP regions | groups `gcp-us-east`, `gcp-eu-west` | — | group kind `region` | close (regions are confirmed "worldwide"; the two named ids are placeholders) |
| Elasticsearch | — | — | — | **dropped**: no fetched source names it (see `source/` verification) |
| Toxiproxy / Genghis, Kubernetes / GKE, Shipit / merge queue | — | — | — | ops tooling, not tallied by the card either |

Confidence tally: 9 exact, 8 close, 1 assumed.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Ghostferry (online shard mover: locking batch copy plus binlog tail) | `worker`, or arguably `change-data-capture` | `container-worker`, node `shop-mover`, labelled "Ghostferry" |
| Sorting Hat (in-house shop-to-pod routing table) | `coordination-service` — the catalogue has only named products (consul, etcd, zookeeper, eureka, nacos, apache-helix), no generic in-house one | `consul` with `role: "placement"`, labelled "Sorting Hat" |
| OpenResty (Lua application platform on Nginx) | `load-balancer` with a `scriptable` property | `nginx`, labelled "Nginx + OpenResty" |
| Semian (circuit breaker library for MySQL/Redis clients) | not a node: an edge property | `circuitBreaker: true` on the outbound edges of `shopify-core` |
| Shopify Core (Rails modular monolith) | `app-server`; no Rails component exists | `container-service` with `runtime: "rails"` |

## Values set because a rule reads them and the sources are silent

- `security.credentialRotationDays: 90`. No source discusses credential rotation. Set to the
  conventional quarterly period so `credentials-without-rotation` does not fire on a design that
  plainly holds data.
- `backupEnabled: true`, `backupRetentionDays: 30` on every MySQL node. No source discusses backups;
  a system of record for 600K merchants has them.
- `deadLetterQueue: true` on the per-pod Redis job queues. No source discusses dead lettering; the
  Ruby job runners Shopify uses keep a retry and dead set.
- `delivery: "at-least-once"` on the per-pod Redis job queues. Asserted by the intake card, not stated
  verbatim by a source.
- `availability.discoveryRedundant: true`. Inferred from the Redismageddon lesson, "avoid any resources
  that are shared across all of Shopify", rather than quoted.
- `nfr.rps: 80000` on `edge-lb` is the stated 2018 platform peak ("serves 80K requests per second at
  peak"). In the broken variant the same figure is attached to the single shared `shopify-db`, because
  that variant posits every shop writing one primary; it is a modelling statement, not a Shopify number
  about a database.

## Not encoded

- `isolation.tenancy: "cell"` is deliberately not declared even though pods are cells. `cross-cell-call`
  treats any synchronous edge with an endpoint outside a cell as a violation, and Shopify's edge tier
  (load balancers, Sorting Hat, checkout throttle) is deliberately shared across pods and calls into
  them synchronously. The pods are still modelled as `cell` groups.
- The checkout throttle's per-shop scope: `rate-limiter.scope` has no `tenant` or `shop` value.
- The throttle's 5 second window, its FIFO fairness and the signed bypass cookie: no properties for
  window length or fairness exist; they live in an edge `label`.
- The hot checkout row ("every step in the flow modified that same record"): no property expresses
  single-row contention.
- Ghostferry's TLA+ verification and the brief write-halt at cutover: no property for formal
  verification or for a planned write stall.
- Shard imbalance ("the least used shard and most used shard vary by almost four times") and the
  rebalancing trigger: no property for skew between shards.
- The BFCM load-testing programme (Genghis, Toxiproxy, the four bottlenecks it found) and the deploy
  path (Shipit, merge queue, feature flags): ops processes, outside the runtime graph.
- 12 TB/min, 57.3 PB and 10.5 trillion database queries: volumes over a period, with no per-node
  request rate to attach them to.
- Packwerk module boundaries inside the monolith: the format has one node per deployed service, not
  per in-process package.
