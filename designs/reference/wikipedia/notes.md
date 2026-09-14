# wikipedia: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/wikipedia.md` (Wikimedia Foundation operational documentation on wikitech.wikimedia.org, two Wikimedia Tech Blog posts and two public incident reports; re-verified 2026-09-14, see the "Verification 2026-09-14" section of that file).
- Size: 24 nodes, 29 edges, 5 groups.

## Clean variant (header of design.yaml)

Wikimedia/Wikipedia serving infrastructure, clean variant: a GeoDNS-steered edge of caching
sites (LVS director, HAProxy TLS, in-memory Varnish frontend, on-disk ATS backend) in front of
MediaWiki on Kubernetes in two active-active application datacenters, with sharded MariaDB,
Memcached with its gutter pool, Swift media storage and a Kafka-based invalidation path.

Fixes relative to wikipedia.broken.yaml:
  - the core MariaDB primary replicates asynchronously to the codfw DC master, so the second
    application datacenter is warm rather than a cold standby
  - parsercache is a cache and not the only copy of rendered wikitext: usedAsPrimaryStore false,
    persistence true, materialised false, and MediaWiki re-renders from mariadb-core-replicas
    and external-store on a miss
  - kask-session-store declares its conflict policy (last-writer-wins, Cassandra cell
    resolution) instead of accepting concurrent multi-region writes with no rule
  - changeprop is one worker per event stream rather than two queues sharing a single
    mw-jobrunner pool, which is what "a dedicated consumer per high-traffic job" means
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Wikimedia/Wikipedia serving infrastructure, broken variant: the same edge and MediaWiki tiers,
but the second application datacenter is a cold standby again (nothing replicates out of the
eqiad core primary), the parser cache is treated as the only copy of rendered wikitext, the
multi-region session store takes concurrent writes with no conflict rule, and one mw-jobrunner
pool drains both changeprop queues instead of a dedicated consumer per job class.

This file MUST trip:
  - datastore-single-region                    (mariadb-core-primary: replication none, multiRegion true)
  - cache-as-primary-store-without-persistence (parsercache: usedAsPrimaryStore true, persistence false)
  - materialised-cache-without-rebuild-path    (parsercache is materialised and only mw-web writes it)
  - multi-leader-store-without-conflict-policy (kask-session-store is multi-region multi-leader, conflictResolution none)
  - shared-worker-pool-across-queues           (mw-jobrunner consumes changeprop and changeprop-jobqueue while isolation.perQueue is true)
and MUST NOT trip:
  - queue-missing-dlq, retry-queue-without-dlq, retry-without-backoff (both queues declare a dead-letter queue, role work)
  - cache-missing-eviction-policy              (every cache declares lru or ttl)
  - datastore-missing-backup                   (every MariaDB node is backed up with 30-day retention)
  - credentials-without-rotation               (security.credentialRotationDays is set)
  - read-replica-as-sole-scaling, single-writer-primary-at-peak-qps (the sections are sharded and no nfr.rps is claimed)
  - retry-without-adaptive-shedding            (no edge declares a retryPolicy)
  - derived-store-without-cdc-or-rebuild, business-updates-without-index-propagation (no search index in this design)
  - fanout-inline-in-request-path              (no app-server calls a worker synchronously)
  - read-heavy-path-without-cache, pubsub-replay-required, cross-cell-call,
    object-store-single-zone-with-durability-target, shared-dependency-without-redundancy,
    stateful-node-without-zone-redundancy, sync-chain-too-deep (no such node, group or requirement)

Each of the five is a mistake the documentation itself argues against: a cold second datacenter
is the shape WMF spent seven years leaving behind, ParserCache is explicitly a cache whose loss
"is not a concern" precisely because MediaWiki can re-render, MainStash's documented
primary-primary mode is last-write-wins, and changeprop's whole job-class design exists so one
slow job class cannot starve the others.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Readers and editors (browsers, apps) | `readers-and-editors` | `web-browser` | client | exact |
| Authoritative DNS (GeoDNS + DNS Discovery), gdnsd | `authoritative-dns` | `dns-resolver` | dns | close (no gdnsd component) |
| LVS director + PyBal | `lvs-director` | `load-balancer-tier` | load-balancer | close (no LVS/IPVS component) |
| HAProxy on cache hosts | `haproxy-tls` | `haproxy` | load-balancer | exact |
| Varnish frontend | `varnish-frontend` | `varnish` | cache | exact |
| ATS backend | `ats-backend` | `trafficserver` | cdn | exact |
| cache_text and cache_upload clusters | merged into `varnish-frontend` + `ats-backend` | — | — | exact (the source draws them as the same two-layer pair, deployed twice) |
| purged | `purged` | `container-worker` | worker | close (in-house Go daemon) |
| mw-web | `mw-web` | `container-service` | app-server | exact |
| mw-api-ext / mw-api-int | `mw-api` | `container-service` | app-server | close (the two clusters are merged into one node) |
| mw-jobrunner | `mw-jobrunner` | `container-worker` | worker | exact |
| EventGate | `eventgate` | `container-service` | app-server | close (in-house Node.js intake service) |
| changeprop / changeprop-jobqueue | `changeprop` | `container-worker` | worker | close (one node for both deployments) |
| Thumbor | `thumbor` | `ffmpeg` | media-transcoder | assumed (no image transcoder in the catalogue; see Catalogue gaps) |
| Memcached main pool | `memcached-main` | `memcached` | cache | exact |
| Memcached gutter pool | `memcached-gutter` | `memcached` | cache | exact |
| mcrouter (mw-mcrouter) | — | — | — | not a node; carried in the two memcached edge labels (see Catalogue gaps) |
| ParserCache pc1-pc8 | `parsercache` | `cache-cluster` | cache | close (MariaDB behind MultiWriteBagOStuff, modelled by its role) |
| MariaDB core sections s1-s8 (+ x1, x3, x4) | `mariadb-core-primary`, `mariadb-core-replicas` | `mariadb` | sql-database | exact |
| MariaDB DC master in the standby DC | `mariadb-codfw-master` | `mariadb` | sql-database | exact |
| External Store es1-es7 | `external-store` | `mariadb` | sql-database | exact |
| Session store (Kask) | `kask-session-store` | `cassandra` | nosql-database | close (Kask is the HTTP service; Cassandra is what it stores in) |
| Swift media store (ms-fe / ms-be) | `swift` | `swift` | object-store | exact |
| Kafka main-eqiad | `kafka-main-eqiad` | `kafka` | stream | exact |
| Kafka main-codfw | `kafka-main-codfw` | `kafka` | stream | exact |
| Sites: eqiad, codfw, esams/ulsfo/eqsin/drmrs/magru | groups `eqiad`, `codfw`, `edge` | — | region, region, point-of-presence | exact |
| Trust zones: application network, data tier | groups `eqiad-app`, `eqiad-data` | — | trust-zone | exact |

Confidence tally: 16 exact, 7 close, 1 assumed.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Thumbor | an **image** transcoder; `media-transcoder` exists but all 14 components are video/audio and its properties are videoCodec / renditions / maxBitrateKbps / packaging / drm | `ffmpeg`, labelled "Thumbor (on-demand thumbnailing)", with only `mode` and `packaging` set |
| mcrouter | a **cache proxy**; `database-proxy` holds only SQL and MongoDB poolers | not modelled; its sharding, gutter failover and WAN purge relay are in the memcached edge labels |
| gdnsd | `dns` — the kind exists, the product does not | `dns-resolver` with `geoRouting: true` |
| LVS + PyBal | `load-balancer` — the kind exists (`layer: l4`, `hashing: maglev`, `connectionPreserving`), the product does not | `load-balancer-tier` |

No new kind is required. The full table with reasoning is in `work/designs/wikipedia/gaps.md`.

## Not encoded

- **CirrusSearch / Elasticsearch and the Cirrus Streaming Updater.** The search subsystem is
  documented and real, but `business-updates-without-index-propagation` fires whenever a
  `search-index` node coexists with a SQL database that application servers write synchronously
  and that has no change-data-capture out-edge. Wikimedia has no CDC on MariaDB (T120242 is still
  a proposal): change events are emitted by the MediaWiki EventBus extension into EventGate and
  Kafka, and the Flink updater indexes from there. The format has no way to say "the index is fed
  from an application-emitted event stream rather than from the database", so encoding search
  would have made the clean design fire a rule about a risk the real system does not carry. The
  rule is a candidate for extension (accept a `stream` or `stream-processor` path from the
  app-server as an equivalent to CDC).
- **MainStash ms1-ms3, mw-parsoid, mw-cron, mw-debug, kafka-jumbo and the logging clusters.**
  Dropped to stay inside the 25-node reference cap. MainStash's primary-primary, last-write-wins
  shape is represented instead by `kask-session-store`, which carries the same cross-DC question.
- **The two-layer CDC/cache chain per site.** The five edge PoPs and the cache layer inside eqiad
  and codfw run the identical LVS/HAProxy/Varnish/ATS stack. The format has no "this subgraph is
  instantiated per site", so one `point-of-presence` group holds one instance of the tier and the
  group label names all seven sites. The documented edge-PoP-to-core-DC hop is therefore implicit
  in `ats-backend -> mw-web` rather than drawn as ATS-to-ATS.
- **Numbers that are tier-wide, not per box.** 21 billion monthly read requests, the 83-88% and
  ~97% hit ratios, the ~10,000 req/s per-host capacity target, "several hundred Apache servers"
  and the 18-minute / ~17M-request blast radius of the 2023-02-22 outage are all recorded in the
  intake card and in edge labels. None becomes an `nfr.rps`, because none of them is a
  steady-state request rate for a single node.
- **Retry policy on `changeprop -> mw-jobrunner`.** The source states "automatic retries with
  exponential delays" and a dedicated Kafka error topic, but it states neither a circuit breaker
  nor a rate limiter in front of the jobrunners, and `retry-without-adaptive-shedding` requires
  one of those whenever `retryPolicy` is set. Rather than invent a breaker, the retry behaviour
  stays in the edge label and `retryPolicy` is left unset. changeprop's documented Redis/Nutcracker
  rate limiting is carried as `rateControl: "fixed"` on the node.
- **Ops-plane mechanisms.** DNS Discovery depooling, `dbctl`, PyBal's etcd backend and BGP
  announcements, the `cache::traffic_shutdown` hiera lever, and the twice-yearly datacenter
  switchover cookbooks are control-plane actions, not runtime edges, and the format has no ops
  edge. The 2-3 minute read-only window of a planned switchover is why
  `availability.degradedModeAllowed` is true.
- **ChronologyProtector and the sticky-DC cookie.** Encoded only as
  `consistency.readAfterWrite: true`; the mechanism itself (a per-user cookie plus position
  waiting inside MediaWiki) has no node or edge.

## Values assumed where the source is silent

Two properties are set to the value that reflects documented practice rather than to a quoted
number, because a rule reads them:

- `security.credentialRotationDays: 90` — no rotation period is published; without it
  `credentials-without-rotation` fires on any design that holds data and has no key-management
  node. 90 days is the value the other reference designs use.
- `backupEnabled: true, backupRetentionDays: 30` on every MariaDB node — WMF backs up MariaDB
  (Bacula/dbprov), but no retention figure appears on the fetched pages. Without it
  `datastore-missing-backup` fires.

`varnish-frontend`'s `evictionPolicy: "lru"` and `parsercache`'s `evictionPolicy: "ttl"` are the
products' documented behaviour (Varnish nukes least-recently-used objects; ParserCache entries
expire after 30 days), not assumptions.
