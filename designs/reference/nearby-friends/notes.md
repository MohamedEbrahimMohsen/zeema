# nearby-friends: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/nearby-friends.md` (Alex Xu and Sahn Lam, *System Design Interview* vol 2 ch 2 "Nearby Friends", via the liquidslr/system-design-notes mirror; Google Cloud's Zenly customer story)
- Size: 14 nodes, 19 edges, 4 groups.

## Clean variant (header of design.yaml)

Reference architecture, clean variant: a nearby-friends location stream where every active
client pushes its position every 30 seconds over a WebSocket, and one Redis pub/sub channel
per user fans that position out to the connection handlers of its ~400 friends.

Fixes relative to nearby-friends.broken.yaml:
  - websocket-server does not autoscale and drains its connections on scale-in, so removing a
    stateful node does not drop every socket it holds at once
  - websocket-server watches the pub/sub hash ring asynchronously instead of querying
    ZooKeeper synchronously on every connect, so a mass reconnect is not a lookup storm
  - location-cache declares the ttl eviction (600 s) the book specifies, so a user who stopped
    reporting disappears instead of being shown at a stale position forever
  - zookeeper runs as a replicated ensemble, which the whole pub/sub ring depends on
  - user-db declares backups and a retention window for the user and friendship records
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture, broken variant: the same nearby-friends location stream, built by a
team that autoscales the stateful WebSocket tier like a stateless one, looks the pub/sub ring
up in a single ZooKeeper node on every connect, keeps live locations in a cache with no
eviction, and never backs up the user and friendship database.

This file MUST trip:
  - stateful-websocket-scale-in-without-drain  (websocket-server autoscales, drainOnScaleIn false)
  - reconnect-stampede-without-guard           (websocket-server queries zookeeper synchronously, stampedeGuard false)
  - cache-missing-eviction-policy              (location-cache declares no evictionPolicy: Redis defaults to noeviction)
  - shared-dependency-without-redundancy       (zookeeper replicated false while discoveryRedundant is required)
  - datastore-missing-backup                   (user-db backupEnabled false, no retention)
and MUST NOT trip:
  - cache-as-primary-store-without-persistence (location-cache is not the primary copy; location-history is)
  - materialised-cache-without-rebuild-path    (the cache holds raw latest positions, not a materialised view)
  - pubsub-replay-required                     (the design never requires messaging.replay; lost updates are re-sent in 30 s)
  - datastore-single-region, read-heavy-path-without-cache (single region by design; two caches exist)
  - credentials-without-rotation               (the Zenly system group has a key-management node)
  - sync-chain-too-deep                        (no api-gateway node; the edge is a load balancer)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone (no availability-zone groups)
  - queue-missing-dlq, retry-without-backoff, derived-store-without-cdc-or-rebuild (no queue, retry queue or search index)

Each of the three mistakes the book itself warns about is in the broken twin: WebSocket servers
are stateful and scaling in requires draining; resharding the pub/sub ring causes resubscription
storms; and the location cache needs its TTL or stale users keep appearing as nearby friends.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Mobile client | `mobile-client` | `mobile-app` | client | exact |
| Load balancer | `load-balancer` | `load-balancer-tier` | load-balancer | exact |
| RESTful API servers | `rest-api` | `container-service` | app-server | exact |
| WebSocket servers | `websocket-server` | `websocket-gateway` | realtime-gateway | exact |
| Redis pub/sub cluster | `redis-pubsub` | `redis-pubsub` | pubsub-topic | exact |
| Location cache (Redis) | `location-cache` | `redis` | cache | exact |
| User database | `user-db` | `relational-database` | sql-database | exact (the source says "relational", names no engine) |
| Location history DB | `location-history` | `cassandra` | nosql-database | exact |
| ZooKeeper | `zookeeper` | `zookeeper` | coordination-service | exact |
| Zenly GKE + autoscaling | `zenly-location-service` | `container-service` | app-server | close (GKE is the platform; the node is the location-processing service running on it) |
| Zenly Scylla | `zenly-scylla` | `scylladb` | nosql-database | exact |
| Zenly IAP / KMS / Vault | `zenly-kms` | `google-cloud-kms` | key-management | close (the three security layers collapse to the one the format can express) |
| Zenly data lake | `zenly-data-lake` | `gcs` | object-store | exact |
| Zenly BigQuery | `zenly-bigquery` | `bigquery` | data-warehouse | exact |

Twelve exact, two close, none assumed. The card's "ops platform" row (GKE itself) and Dataproc
are not tallied as nodes: GKE is the `orchestrator` property of `zenly-location-service`, and
Dataproc is a consumer of the same lake that the case study mentions only in passing.

Assumed, not stated by either source, and recorded here rather than hidden in the YAML:

- `availability.discoveryRedundant: true` is a requirement the design makes, not a fact the
  source states. It is what makes ZooKeeper's redundancy checkable; the book runs the whole
  ~140-server pub/sub ring off that discovery.
- `zookeeper.replicated: true` in the clean design reflects ZooKeeper's documented practice
  (an ensemble), not a sentence in the source. The component defaults to standalone.
- `user-db.backupEnabled` and `backupRetentionDays: 30` are not in the source either. A system
  of record holding every user and friendship is backed up; 30 days matches the other reference
  designs.
- The `zenly-location-service` to `zenly-kms` edge is inferred from "multiple targeted security
  layers ... Cloud KMS"; the case study does not draw the arrow.

## Catalogue gaps

None. Every box in the card resolved to an existing component.

## Not encoded

- 30 second client update interval: the `client` kind has no `updateIntervalSeconds` property,
  so the interval survives only as the label on `mobile-client` to `websocket-server`.
- One pub/sub channel per user, and consistent hashing of the pub/sub shards: `pubsub-topic`
  carries neither property. Both are edge labels.
- Fan-out factor (~400 friends per update, 334K updates/s becoming ~14M messages/s): edges have
  no fan-out property. The two rates sit on the `nfr.rps` of `websocket-server` and
  `redis-pubsub` instead, which is where the numbers land.
- Subscription memory and the ~140 pub/sub servers: no property, and the two mirrors disagree on
  the memory figure (200 MB vs 200 GB), so neither number is encoded anywhere.
- The search radius and the friends-only privacy control: no requirement path exists for either.
- Zenly's 30 percent daily load swing, the third off costs and the 50 percent latency gain
  expected from going multi-region: outcomes and plans, not runtime elements.
- That a lost pub/sub message is tolerable because the next arrives in 30 seconds: the delivery
  guarantee is encoded (`at-most-once`), the reason it is acceptable is not expressible.
