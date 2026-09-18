# stack-overflow: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/stack-overflow.md` (intake card of 2026-09-14, with a verification section appended the same day)
- Size: 25 nodes, 35 edges, 4 groups. Broken twin: 24 nodes, 33 edges, 4 groups.

## Clean variant (header of design.yaml)

Stack Overflow, clean variant: the scale-up runtime path of the Stack Exchange network — four
HAProxy boxes in front of nine IIS web servers, an L1/L2 cache pair (in-process + Redis with a
pub/sub purge channel), two SQL Server clusters with async AlwaysOn replicas, Elasticsearch fed
by the indexing job, the in-house tag engine, Providence and the Bosun/Opserver monitoring path.

Fixes relative to stack-overflow.broken.yaml:
  - the elastic indexing job reads changed rows (ROWVERSION) out of both SQL clusters and writes
    Elasticsearch asynchronously, so the index has a rebuild path and the web tier never dual-writes
  - redis-master is a cache, not a store: usedAsPrimaryStore false, all data re-populable from source
  - no nfr.rps is claimed for a single unsharded SQL primary; the stated 504.8M queries/day is a
    whole-tier number and is recorded in the edge label instead of as a per-box ceiling
  - cloudflare declares redundantProviders true (multiple DNS providers after the 2016 Dyn attack)
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Stack Overflow, broken variant: the same scale-up topology, with the mistakes a team copying it
usually makes — the indexing job deleted so the web tier dual-writes Elasticsearch inline, Redis
promoted to the only home of the light queues with persistence off, the whole SQL load declared
against one unsharded primary whose async replicas are treated as the scaling plan, and a single
DNS provider in front of everything.

This file MUST trip:
  - derived-store-without-cdc-or-rebuild        (elasticsearch has no async feed; web-tier indexes inline)
  - business-updates-without-index-propagation  (both SQL primaries are written sync by web-tier, a search index exists, nothing captures their changes)
  - cache-as-primary-store-without-persistence  (redis-master holds the account-merge and A/B queues as the only copy, persistence off)
  - single-writer-primary-at-peak-qps           (sql-cluster-1: unsharded single writer declared at 5842 rps)
  - read-replica-as-sole-scaling                (sql-cluster-1: async replicas are the only answer above 5000 rps)
  - shared-dependency-without-redundancy        (cloudflare is the only DNS provider while the design requires redundant discovery)
and MUST NOT trip:
  - cache-missing-eviction-policy, materialised-cache-without-rebuild-path, datastore-missing-backup,
    datastore-single-region, fanout-inline-in-request-path, read-heavy-path-without-cache,
    credentials-without-rotation, queue-missing-dlq, pubsub-replay-required, sync-chain-too-deep,
    stateful-websocket-scale-in-without-drain, reconnect-stampede-without-guard
    (the file header gives the reason for each)

Each of the six is a failure the sources themselves describe or argue against: the 2016 Dyn
attack that pushed Stack Exchange to multiple DNS providers; Redis being deliberately kept
optional ("all cache data is re-populable from whatever the source is") except for the light
queues it carries; the indexing job that exists precisely so the search index is not dual-written;
and the "scale up, not out" thesis, which the broken twin misreads as "scale reads on the async
replica".

## Mapping

| # | Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|---|
| 1 | Clients / browsers | `client` | `web-browser` | client | exact |
| 2 | CloudFlare | `cloudflare` | `cloudflare-dns` | dns | exact |
| 6 | Load balancers (CloudFlare pair) | `haproxy-cloudflare` | `haproxy` | load-balancer | exact |
| 6 | Load balancers (direct pair) | `haproxy-direct` | `haproxy` | load-balancer | exact |
| 7 | Web servers NY-WEB01-09 | `web-tier` | `iis` | app-server | exact |
| 8 | L1 in-process cache | `l1-cache` | `cache-cluster` | cache | close (no in-process-cache component; generic tier) |
| 9 | Socket server (StackExchange.NetGain) | `socket-server` | `websocket-gateway` | realtime-gateway | close (NetGain is not in the catalogue) |
| 10 | Stack Server / tag engine | `tag-engine` | `vm-service` | app-server | close (http.sys service on bare metal, not IIS) |
| 11 | Providence API | `providence-api` | `iis` | app-server | exact |
| 12 | Providence ML servers | `providence-ml` | `container-worker` | worker | close (batch trainer on bare metal, not containers) |
| 13 | Providence Redis | `providence-redis` | `redis` | cache | exact |
| 14 | Elastic indexing job | `elastic-indexer` | `debezium` | change-data-capture | close (ROWVERSION polling, not log-based CDC; `mode: "polling"`) |
| 15 | Redis cache + pub/sub (master) | `redis-master` | `redis` | cache | exact |
| 15 | Redis cache + pub/sub (slave) | `redis-slave` | `redis` | cache | exact |
| 16 | Redis purge channel | `purge-channel` | `redis-pubsub` | pubsub-topic | exact |
| 17 | Elasticsearch cluster | `elasticsearch` | `elasticsearch` | search-index | exact |
| 18 | SQL cluster 1 (primary) | `sql-cluster-1` | `sql-server` | sql-database | exact |
| 18 | SQL cluster 1 (NY read replica) | `sql-cluster-1-replica` | `sql-server` | sql-database | exact |
| 18 | SQL cluster 1 (Colorado DR replica) | `sql-cluster-1-dr` | `sql-server` | sql-database | exact |
| 19 | SQL cluster 2 (primary) | `sql-cluster-2` | `sql-server` | sql-database | exact |
| 19 | SQL cluster 2 (NY read replica) | `sql-cluster-2-replica` | `sql-server` | sql-database | exact |
| 21 | HTTP logging SQL Server | `http-logging-sql` | `sql-server` | sql-database | close (the card's candidate kind is data-warehouse; the product is SQL Server with a clustered columnstore, so the sql-database component carries `appendOnly`) |
| 22 | Traffic processing service | `traffic-processor` | `container-worker` | worker | close (in-house Windows service; generic worker) |
| 23 | Bosun + OpenTSDB/HBase | `bosun` | `observability-stack` | monitoring | close (see Catalogue gaps) |
| 25 | Opserver | `opserver` | `observability-stack` | monitoring | close (see Catalogue gaps) |
| 20 | Data access layer (Dapper) | — | — | — | not a runtime box; the card itself calls it a property of the app-server |

Confidence tally: 15 exact, 10 close, 0 assumed.

Values set because a rule reads them and no source states them, as the brief allows:

- `sql-*.backupEnabled` / `backupRetentionDays: 30` — `datastore-missing-backup` requires a
  declared retention. No post states a backup policy; a production SQL Server estate of this age
  plainly has one. The number is assumed.
- `security.credentialRotationDays: 90` — `credentials-without-rotation` reads it. No post
  states a rotation period.
- `evictionPolicy: "ttl"` on every cache — `cache-missing-eviction-policy` reads it. The posts
  describe per-call-site `durationSecs` / `serveStaleDataSecs` TTLs but never name a Redis
  eviction policy (the card lists this under Unknowns); `ttl` is the behaviour the call sites
  describe.
- `nfr.rps` is derived by division from stated daily totals only: `web-tier` 2423 (209.4M
  requests/day), `redis-master` 18363 (1.586B commands/day), `elasticsearch` 199 (17.2M
  searches/day), `tag-engine` 42 (3.66M requests/day). No number is invented, and the 504.8M
  SQL queries/day is deliberately *not* turned into an rps on a single box, because the source
  states it for the whole tier.
- `requirements.freshness.maxSeconds: 120` — the tag engine's stated 2-minute reload interval,
  the only freshness bound any source gives.

## Catalogue gaps

| Product | Kind it would need | Used instead |
|---|---|---|
| Bosun (time-series alerting engine over OpenTSDB/HBase) | `monitoring`, or a `timeseries-database` component for OpenTSDB (the inventory marks OpenTSDB skipped as unmaintained) | `observability-stack` |
| Opserver (Stack Exchange's own cross-system dashboard) | `monitoring` | `observability-stack` |
| StackExchange.NetGain (raw websocket server) | `realtime-gateway` | `websocket-gateway` |
| An in-process / embedded application cache (Caffeine, `MemoryCache`, `GetSet<T>()`) | `cache`; every `cache` component in the catalogue is a remote tier | `cache-cluster` |
| A polling change-tracker (SQL Server `ROWVERSION`, high-water-mark polling) | `change-data-capture`; every component of that kind is log- or stream-based | `debezium` with `mode: "polling"` |
| scollector (host metric agent) | `monitoring` agent | not encoded |

## Not encoded

The card lists 43 component rows; 20 of them became the 25 nodes above. The rest are left out,
each for a stated reason.

- Rows 3, 5, 37 — edge routers, Nexus network core, the MPLS/OSPF inter-datacenter link. The
  `network-fabric` kind describes cabling and routing, not a runtime element on a request path;
  the two datacenters survive as the `ny` and `colorado` region groups and the DR edge label.
- Row 4 — Fortinet 800C firewalls. The trust boundary they enforce is the `dmz` / `internal`
  trust-zone groups; a firewall node would add a hop that the groups already express.
- Row 20 — Dapper. A data-access library, not a box; the card says so itself.
- Row 24 — scollector. A per-host agent; there is no component for it, and an edge from "every
  host" is not expressible.
- Rows 26, 27, 28 — Grafana, the 6-box Logstash/Elasticsearch/Kibana estate, Exceptional. All
  three are `monitoring`; the design already carries two monitoring nodes, and adding three more
  would spend a fifth of the node budget on the observability side path.
- Row 29 — PagerDuty and chat alert delivery. `notification-service`; cut to stay inside 25
  nodes, and no runtime path depends on it.
- Rows 30-34 — GitLab, TeamCity, the rolling PowerShell deploy script, the Migrator, the
  pre-deployed static-asset CDN site. The whole build-and-deploy path is a control plane, not a
  runtime element, and encoding it would draw a second system beside the first. The one runtime
  trace it leaves is the HAProxy DRAIN behaviour, which survives as the "3 good health checks to
  re-enter rotation" edge label.
- Rows 35, 36 — the FX2s VM farm and the EqualLogic SANs. Infrastructure under the internal
  services that are themselves not encoded.
- Rows 38-43 — the entire 2023 Stack Overflow for Teams build on Azure (Fastly, Application
  Gateway, VMSS, AKS-hosted Elasticsearch, Azure Cache for Redis, SQL Server on Azure VMs). It
  is a separate deployment of the same application in a different environment, and the sources
  are explicit that stackoverflow.com itself stayed on-premises. The on-prem network is the one
  the architecture series documents in depth, so it is the one encoded.

Things the format cannot express, which the sources state and the design therefore loses:

- The scale-up thesis itself. There is no `scaleStrategy: up` / `instanceCount` pair, so
  "nine web servers, deliberately" reads the same as "nine web servers, autoscaled". Only
  `instances: 9` and `autoscaling: false` hint at it.
- The three cache layers inside L1 (Global, Site, Local), the `GetSet<T>()` stampede guard and
  the serve-stale window: `cache` has no layering, stampede or stale-window property.
- The DEL-then-PUBLISH invalidation ordering, which the source calls a correctness requirement.
  The edge label says it; no property encodes it, and no rule can check it.
- One Redis database per site as the keyspace layout — the reason Redis Cluster was rejected.
  There is no keyspace-strategy property, only `cluster: false`.
- protobuf-net serialization, and the rule that a cache object change must keep signature
  compatibility or change key.
- CPU affinity: the tag engine pinned to its own socket for L2/L3 locality, Redis pinned after a
  monitoring agent evicted it from its cores.
- Every hardware fact — RAM, NVMe layout, core counts, LACP bonding, dual PSUs, the Rack A /
  Rack B redundant partner, 288 TB of raw log storage. The format models software topology.
- The per-request instrumentation budget (ASP.NET ms, SQL count and ms, Redis hits and ms,
  tag-engine and Elastic query counts attached to every logged request). It is why
  `http-logging-sql` exists, but the budget itself has no home.
- All of the incidents: the one-character TTL refactor that disabled L1, the BGSAVE fork crash,
  the `DateTime` max-age bug, the async replica whose lag hid behind the cache for days, the
  302-accepting health check, thread-pool starvation on DRAIN exit. A design states structure,
  not history; they survive only as the shape of the broken twin.
