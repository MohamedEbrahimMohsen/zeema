# zerodha-kite: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/zerodha-kite.md` (nine official Zerodha Tech blog posts, the Kite Connect v3 API docs, the Z-Connect 2019 postmortem and the CNCF case study; re-verified 2026-09-14).
- Size: 25 nodes, 35 edges, 5 groups. The broken twin has 22 nodes, 30 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture: Zerodha Kite, clean variant. A cache-first retail trading platform —
every Kite read comes out of a hot Redis cache filled off the request path, orders pass through
Veto before they reach the vendor OMS, and NATS fans market ticks out over the ticker sockets.

Fixes relative to zerodha-kite.broken.yaml:
  - cache-populators fill hot-redis-cache and etag-map asynchronously from the Postgres system of
    record, so the cache is rebuildable and is not the only copy of orders and positions
  - hot-redis-cache declares usedAsPrimaryStore false: Kite reads it, but Postgres owns the data
  - veto sits in front of the vendor OMS and rejects orders in place, so no application server
    calls the opaque third party inline, and the public API's synchronous chain stays at 3 hops
  - the primary Postgres is sharded across four postgres_fdw nodes rather than one primary
    absorbing the whole 40-50k QPS peak behind async failover replicas
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: Zerodha Kite, broken variant. The same platform built the way a team
usually builds it first: the Kite backend writes the hot Redis cache itself and treats it as the
only copy of orders and positions, orders go straight into the vendor OMS with nothing that can
reject them in place (the 27 Feb 2019 shape), partner traffic is funnelled through the same edge
so the public API's call chain gets one hop deeper, and the whole 40-50k QPS peak lands on one
unsharded Postgres primary with async failover replicas as the only scaling story.

This file MUST trip:
  - cache-as-primary-store-without-persistence (hot-redis-cache: usedAsPrimaryStore true, persistence false)
  - materialised-cache-without-rebuild-path    (hot-redis-cache is materialised and only kite-backend writes it)
  - external-call-inline-without-durable-path  (kite-backend calls the opaque vendor OMS sync with no queue or workflow engine)
  - sync-chain-too-deep                        (kite-connect -> edge-proxy -> kite-backend -> oms -> exchange is 4 sync hops under a 40 ms target)
  - single-writer-primary-at-peak-qps          (primary-postgres: sharded false, multiWriter false, 50000 rps)
  - read-replica-as-sole-scaling               (primary-postgres: replication async, not sharded, not distributed, 50000 rps)
and MUST NOT trip:
  - cache-missing-eviction-policy              (all three caches declare ttl)
  - datastore-missing-backup                   (primary-postgres still declares snapshots and retention)
  - datastore-single-region                    (availability.multiRegion is false)
  - credentials-without-rotation               (security.credentialRotationDays is set)
  - fanout-inline-in-request-path              (console queues DungBeetle jobs asynchronously)
  - retry-without-adaptive-shedding            (no edge declares a retry policy)
  - queue-missing-dlq, pubsub-replay-required  (Kafka and NATS are stream nodes, not queue or pubsub-topic)
  - business-updates-without-index-propagation, derived-store-without-cdc-or-rebuild (no search-index node)
  - stateful-websocket-scale-in-without-drain, reconnect-stampede-without-guard (ticker does not autoscale and calls no coordination service)
  - stateful-node-without-zone-redundancy      (the design declares no availability-zone groups)

The three broken shapes are the ones the sources themselves warn about: the OMS outage of
27 Feb 2019 ("orders piling up" inside a proprietary system the tech team cannot see into) is what
`external-call-inline-without-durable-path` and `sync-chain-too-deep` mark; "one giant Postgres
shard was the risk, not the size" is what the two Postgres rules mark; and a Redis with persistence
off is safe only because it is a cache of something durable, which is what the two cache rules mark.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Kite web | `kite-web` | `web-browser` | client | exact |
| Kite mobile | `kite-mobile` | `mobile-app` | client | exact |
| Third-party Kite Connect apps | `partner-apps` | `sdk-client` | client | close |
| HAProxy / NGINX | `edge-proxy` | `haproxy` | load-balancer | exact |
| Kite Connect | `kite-connect` | `envoy-gateway` | api-gateway | close (in-house; no generic api-gateway component) |
| Ticker | `ticker` | `websocket-gateway` | realtime-gateway | exact |
| Kite backend | `kite-backend` | `container-service` | app-server | exact |
| Cache populators | `cache-populators` | `container-worker` | worker | exact |
| Veto | `veto` | `opa` | policy-engine | close (in-house Go; no generic policy-engine component) |
| Veto compiler + validation servers | `veto-build` | `container-worker` | worker | exact (two deployments merged into one node) |
| Console | `console` | `container-service` | app-server | exact |
| DungBeetle (sql-jobber) | `dungbeetle` | `container-worker` | worker | close (it is a job server, not a plain worker) |
| EOD contract-note pipeline | `contract-note-workers` | `container-worker` | worker | close (Tasqueue, Typst, jpdfsigner, Haraka merged into one node) |
| Market-data transport (NATS) | `market-data-bus` | `nats-jetstream` | stream | close (NATS core is not catalogued separately) |
| Kafka | `kafka` | `kafka` | stream | exact |
| Hot Redis cache | `hot-redis-cache` | `redis` | cache | exact |
| E-Tag map | `etag-map` | `redis` | cache | exact |
| Primary Postgres shards | `primary-postgres` | `postgres` | sql-database | exact |
| Hot-cache Postgres | `hot-cache-db` | `cache-cluster` | cache | close (it is Postgres used purely as an ephemeral result cache) |
| ClickHouse | `clickhouse` | `clickhouse` | data-warehouse | exact |
| Vector agents + aggregators | `log-pipeline` | `vector` | monitoring | exact (agents and aggregators merged) |
| Prometheus + Alertmanager + Grafana + VictoriaMetrics | `prometheus` | `prometheus` | monitoring | close (only Prometheus is encoded) |
| S3 (contract notes) | `contract-note-store` | `s3` | object-store | exact |
| OMS | `oms` | `supplier-api` | third-party-api | close (a proprietary vendor OMS, opaque by the source's own admission) |
| Exchange leased lines / NSE, BSE, MCX | `exchange` | `supplier-api` | third-party-api | close (the venue and the leased line are one external box here) |

Tally: 15 exact, 10 close, 0 assumed.

Property values that are assumed rather than stated, and why:
- `primary-postgres.backupRetentionDays: 30` — the source states AWS disk snapshots but no retention
  period; `datastore-missing-backup` requires one to be declared.
- `security.credentialRotationDays: 90` — SSO, 2FA and a zero-trust VPN since 2017 are stated; no
  rotation interval is published. `credentials-without-rotation` requires the requirement to exist.
- `evictionPolicy: "ttl"` on `hot-redis-cache`, `etag-map` and `hot-cache-db` — the sources state
  that the trading-day data is discarded daily and that persistence is off, but name no eviction
  policy. `ttl` encodes the stated daily discard.
- `latency.p95Ms: 40` — the source states a 40 ms client-side round-trip *baseline* ("the key here
  is the consistency of latency"), not a p95. This is the nearest requirement path the format has.
- `kafka -> cache-populators` — the sources state that the populators are "an independent
  asynchronous service elsewhere" and, separately, that Kafka is the central bus every system talks
  to. The edge is that reading, not a drawn arrow.
- `cache-populators.trigger: "stream"` — `trigger` is a required property on `worker`; "asynchronous
  service" is all the source says.

## Catalogue gaps

Full table in `work/designs/zerodha-kite/gaps.md`. In short: Veto (a rejecting reverse proxy with
hot-reloadable rule plugins), Kite Connect (an in-house public API gateway) and DungBeetle (a
distributed SQL job server) have no generic component of the right kind, so the nearest generic was
used with a `label`; the hot-cache Postgres has no way to say "ephemeral, dropped nightly" on a
`sql-database`, so it is modelled as a `cache`. Nothing was added to the catalogue.

## Not encoded

- The two physical data centres are one `region` group: no source states which is active, whether
  DC2 is standby, or what fails over between them.
- The P2P leased lines between the racks and the AWS VPCs are the seam between the two `region`
  groups; there is no `network-fabric` node for them and no way to express "this edge is a leased line".
- The exchange feed handlers — whatever ingests the NSE/BSE/MCX multicast feeds and publishes into
  NATS — are never described, so the tick edge runs straight from `exchange` to `market-data-bus`.
- Nomad, Kubernetes/EKS, bare metal and plain EC2 all coexist; which workload sits where is not
  published, so only `orchestrator` props on two workers hint at it.
- The zero-trust access layer (SSO, 2FA, VPN, `torii`) and the Frappe rules dashboard behind it are
  not nodes; the rule-authoring path stops at `veto-build`.
- VictoriaMetrics, Alertmanager, Grafana and the Google Chat alert sink are folded away; only
  Prometheus remains, so `prometheus -> victoriametrics` (56B data points) is absent.
- Veto's hot reload of a `.so` plugin, and the fact that Go plugins can never be unloaded, has no
  property to live on: the edge `veto-build -> veto` carries it only as a label.
- The 09:15 vertical load spike, the stated design force of the whole system, has no requirement
  path (`traffic.peakMultiplier` needs a number the sources never give).
- The OMS being opaque — "our technology team does not have any control over the internals" — is the
  point of the 2019 incident and cannot be stated on a `third-party-api`.
- Kite Connect's postback signature (SHA-256 of order_id + timestamp + api_secret) is a label on an
  edge, not a `webhook-endpoint` node, because the endpoint belongs to the partner, not to Zerodha.
- Scale numbers with no home in the format: ~16M ticks/sec, ~1M concurrent users, 12M trades/day,
  20 TB and hundreds of billions of rows, 30B log lines in 2.5 TB, 1.5M PDFs in 25 minutes.
