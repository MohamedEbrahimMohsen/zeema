# uber-dispatch: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/uber-dispatch.md` (QCon London 2015 talk by Matt Ranney, Uber chief systems architect, as written up on HighScalability; plus an ex-Uber engineer's 2009-2023 retrospective). Verified 2026-09-13.
- Size: 21 nodes, 30 edges, 6 groups.

## Clean variant (header of design.yaml)

Reference architecture 8, clean variant: Uber's real-time dispatch marketplace, where driver
phones report location every four seconds into a sharded in-memory geospatial index and a
Ringpop hash ring owns the placement of every stateful dispatch process.

Fixes relative to uber-dispatch.broken.yaml:
  - dispatch, supply and demand gossip their ring membership to ringpop, so the consistent
    hash ring has an owner that detects a dead host and moves its shards
  - rtapi declares a stampede guard, so a datacenter failover does not turn millions of
    simultaneous reconnects into a ring-lookup storm
  - trip-store is Schemaless, an append-only store sharded over MySQL, not one unsharded
    PostgreSQL primary carrying the whole marketplace behind an async read replica
  - location-ingester consumes the location stream from event-hub and rebuilds the in-memory
    geospatial index asynchronously, so the index is not only ever written on the request path
  - the rtapi to dispatch retry carries a circuit breaker, so "make everything retryable"
    cannot become a retry storm against a saturated dispatch shard
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture 8, broken variant: the same Uber dispatch marketplace as it stood before
the 2014-2015 rebuild. One unsharded PostgreSQL primary is the system of record behind an async
read replica, the stateful dispatch processes sit on a consistent hash ring that nothing owns,
RTAPI looks the ring up on every reconnect with no stampede guard, every call is retried with no
circuit breaker, and the in-memory geospatial index is only ever written on the request path.

This file MUST trip:
  - single-writer-primary-at-peak-qps        (trip-store: multiWriter false, sharded false, 20000 rps)
  - read-replica-as-sole-scaling             (trip-store: replication async, not sharded, not distributed, 20000 rps)
  - business-updates-without-index-propagation (business-logic writes trip-store sync, geo-index exists, no CDC leaves trip-store)
  - stateful-hash-ring-without-ring-manager  (dispatch, supply and demand are on a consistent hash ring with no edge to ringpop)
  - reconnect-stampede-without-guard         (rtapi calls ringpop sync on connect with stampedeGuard false)
  - retry-without-adaptive-shedding          (rtapi -> dispatch retries exponentially, no circuit breaker, no rate limiter in front of dispatch)
  - derived-store-without-cdc-or-rebuild     (geo-index has no async feed from a stream, CDC or worker)
and MUST NOT trip:
  - datastore-missing-backup                 (trip-store declares backup and retention)
  - datastore-single-region                  (trip-store replication is async, not none)
  - cache-missing-eviction-policy            (redis-cache declares lru)
  - read-heavy-path-without-cache            (traffic.readWriteRatio is not declared; the sources never quantify it)
  - credentials-without-rotation             (security.credentialRotationDays is set)
  - sync-chain-too-deep                      (no api-gateway node and no latency.p95Ms target)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone (no availability-zone groups)
  - shared-host-per-channel-without-isolation (rtapi assigns channels by hash; traffic.skew is not declared)
  - stateful-websocket-scale-in-without-drain (rtapi does not autoscale)
  - shared-dependency-without-redundancy     (availability.discoveryRedundant is not declared)
  - queue-missing-dlq, retry-queue-without-dlq, pubsub-replay-required (no queue or pubsub-topic node)
  - money-mutation-without-idempotency-key, money-store-without-double-entry-ledger (no money node)
  - cache-as-primary-store-without-persistence, materialised-cache-without-rebuild-path (redis-cache is neither primary nor materialised)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Driver app | `driver-app` | `mobile-app` | client | exact |
| Rider app | `rider-app` | `mobile-app` | client | exact |
| RTAPI / Edge Gateway | `rtapi` | `websocket-gateway` | realtime-gateway | close (a real-time bidirectional mobile channel, not a request/response API gateway) |
| Dispatch | `dispatch` | `container-service` | app-server | exact |
| Supply service | `supply` | `container-service` | app-server | exact |
| Demand service | `demand` | `container-service` | app-server | exact |
| DISCO | `disco` | `container-service` | app-server | exact |
| Ringpop | `ringpop` | `apache-helix` | coordination-service | close (nearest coordination-service whose role is partition placement; labelled "Ringpop") |
| Geospatial index | `geo-index` | `geo-cell-index` | search-index | exact (S2, cell level 12, in memory, 1M writes/s goal) |
| (no source box) | `location-ingester` | `container-worker` | worker | assumed (the async rebuild path the rules require; see "Rule-driven additions") |
| Routing / ETA service | `routing-eta` | `container-service` | app-server | exact |
| Business logic services | `business-logic` | `container-service` | app-server | exact |
| Cadence | `trip-workflows` | `cadence` | workflow-engine | exact |
| Post-trip pipeline | `post-trip-pipeline` | `container-worker` | worker | exact |
| Kafka | `event-hub` | `kafka` | stream | exact |
| Riak | `dispatch-state` | `riak` | nosql-database | exact |
| MySQL / Schemaless | `trip-store` | `nosql-store` | nosql-database | close (Schemaless is an append-only sparse hash map built on sharded MySQL; no `appendOnly` on the nosql kind) |
| Cassandra | `marketplace-store` | `cassandra` | nosql-database | exact |
| Redis (some behind Twemproxy) | `redis-cache` | `redis` | cache | exact (`hashing: consistent` stands for Twemproxy) |
| M3 | `metrics` | `m3` | monitoring | exact |
| Jaeger / Merckx | `tracing` | `jaeger` | monitoring | exact for Jaeger, close for Merckx |

Confidence tally: 15 exact, 5 close, 1 assumed.

Boundaries: `uber-dc` (region) is the active datacenter with its failover twin; `edge-zone` (trust-zone)
is where untrusted mobile traffic lands; `dispatch-system`, `platform-services`, `data-layer` and
`ops-plane` are the named subsystems on the card. The clients are deliberately outside every group.

## Rule-driven additions

Three values are set because a rule reads them and the sources are silent, not because a source
states them. Each reflects the practice the sources describe rather than an omission:

- `security.credentialRotationDays: 90` — no source states a rotation period.
- `redis-cache.evictionPolicy: "lru"` — no source states the policy; Redis ships `noeviction`.
- `location-ingester` and its async feed into `geo-index` — the sources describe the geospatial
  index as in memory with the database as cold storage only, and describe Kafka as the event hub,
  but never draw the rebuild path that `derived-store-without-cdc-or-rebuild` demands. The broken
  twin is the version without it.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Ringpop (consistent hash ring + SWIM gossip) | `coordination-service` with a gossip/SWIM consensus value | `apache-helix`, labelled "Ringpop" |
| TChannel / Hyperbahn | `service-mesh` with `backupRequests`, plus an edge-level hedging field | not a node; carried as `protocol: "tchannel"` on the internal edges |
| Schemaless | `nosql-database` with `appendOnly` | `nosql-store`, labelled "Schemaless (on sharded MySQL)" |
| Flipr (in-house feature flags) | `feature-flag-service`, generic in-house | omitted; only real vendors exist under that kind |
| Merckx (pre-Jaeger tracing over Kafka) | `monitoring` with `signal: traces` | `jaeger`, which the source also names |

## Not encoded

- **TChannel backup requests with cross-server cancellation.** The format has no hedging field on an edge; the tail-latency strategy is lost.
- **Hyperbahn as a service mesh.** Encoding it as a node would put a transport on the diagram rather than a box the source draws.
- **The 4-second location cadence as a property.** The `client` kind has no reporting-interval property; it survives only as an edge label.
- **"Make everything killable", crash-only design, no graceful shutdown.** No property expresses a shutdown contract.
- **S2 cell area (3.31 km2 to 6.38 km2) and the fixed-cell-size limitation.** `cellLevel: 12` carries the level; the area and the optimisation ceiling it implies do not.
- **The driver phone as an external store of trip state.** Encoded as two edges (digest out, restore in) plus `offlineCapable`/`localCache`, but the phone is not modelled as a datastore.
- **"Thousands of dispatch nodes", "hundreds of geospatial processes", 250,000+ servers, 4,000+ microservices.** Fleet-wide counts with no per-box mapping; no `instances` value is claimed from them.
- **Later-era boxes the card lists: Spanner (2021 fulfillment rewrite), H3 (the S2 successor), Flipr, Presto/Spark/Hudi.** They belong to a different era or to the analytics plane; mixing them into the 2015 dispatch platform would draw a system that never existed at one moment.
- **Duplication across thousands of microservices** ("five or six systems that do incentives that are 75 percent similar") — an organisational observation with no structural expression.
- **City-based sharding, abandoned for the supply/demand abstraction.** A superseded design, not part of this one.
