# linear-sync: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/linear-sync.md` (intake card plus a 2026-09-14 verification section)
- Size: 20 nodes, 32 edges, 5 groups. Broken twin: 19 nodes, 31 edges, 5 groups.

## Clean variant (header of design.yaml)

Linear's sync engine and backend: a local-first client that reads from an in-memory object
graph, an immutable per-workspace sync action log in Cloud SQL, and a two-stage delta-sync
read path that scans metadata in turbopuffer before enriching payloads from Postgres.

Fixes relative to linear-sync.broken.yaml:
  - primary-postgres uses async replication (logical replication plus a follower replica), so
    the multi-region promise is not made by a single unreplicated instance
  - task-topic (Google Pub/Sub) keeps replay on, which the seek-based one-to-many task
    distribution and the design's replay requirement both need
  - public-sync-ws and private-sync-ws drain connections on scale-in instead of dropping
    every socket and provoking a catch-up storm on the delta-sync read path
  - public-graphql-api schedules background work through task-topic instead of calling
    task-runners synchronously on the mutation path
  - workspace-indexeddb declares an eviction policy, so browser storage pressure is not
    left to the vendor default
  - openai-embeddings declares its API key held in a key-management component (keyStore), as
    the broken variant does not; the store itself is not drawn
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Linear's sync engine and backend, broken variant: the pre-multi-region shape, with a single
unreplicated Cloud SQL instance behind a multi-region promise, a Pub/Sub task topic with
replay turned off, WebSocket fleets that autoscale without draining, background work called
inline from the mutation path, and a browser store left on the vendor eviction default.

This file MUST trip:
  - datastore-single-region                  (primary-postgres: replication none, one region, multiRegion required)
  - pubsub-replay-required                   (task-topic: replay false while messaging.replay is true)
  - stateful-websocket-scale-in-without-drain (public-sync-ws and private-sync-ws autoscale with drainOnScaleIn false)
  - fanout-inline-in-request-path            (public-graphql-api calls task-runners synchronously)
  - cache-missing-eviction-policy            (workspace-indexeddb declares evictionPolicy none)
  - ai-api-key-unmanaged                     (task-runners call openai-embeddings with an API key; no key-management node, keyStore not declared)
and MUST NOT trip:
  - datastore-missing-backup                 (Cloud SQL keeps backups on with seven days retention)
  - cache-as-primary-store-without-persistence (workspace-indexeddb persists and is not the primary store)
  - materialised-cache-without-rebuild-path  (neither cache is marked materialised)
  - credentials-without-rotation             (security.credentialRotationDays is set)
  - webhook-without-signature-or-idempotency (customer-webhooks verifies signatures and deduplicates)
  - derived-store-without-cdc-or-rebuild, business-updates-without-index-propagation (no search-index node; turbopuffer is a vector-database)
  - read-replica-as-sole-scaling, single-writer-primary-at-peak-qps, read-heavy-path-without-cache (no rps or read/write ratio is stated anywhere)
  - sync-chain-too-deep                      (no api-gateway node and no p95 latency target)
  - queue-missing-dlq, retry-queue-without-dlq, retry-without-backoff (no queue node)
  - stateful-engine-pinned-to-single-zone, stateful-node-without-zone-redundancy (the sources state no availability-zone layout, so the design declares none)

## Mapping

| # | Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|---|
| 1 | Linear client (web/desktop) | `linear-client` | `desktop-app` | client | close |
| 2 | IndexedDB workspace database (RE) | `workspace-indexeddb` | `cache-cluster` | cache | assumed |
| 3 | Cloudflare Worker region proxy | `region-proxy` | `cloudflare-workers` | app-server | exact |
| 4 | Global authentication service | `global-auth-service` | `container-service` | app-server | close |
| 5 | Public sync WebSocket servers | `public-sync-ws` | `websocket-gateway` | realtime-gateway | exact |
| 6 | Private sync WebSocket servers | `private-sync-ws` | `websocket-gateway` | realtime-gateway | exact |
| 7 | Public GraphQL API | `public-graphql-api` | `container-service` | app-server | close |
| 8 | Private GraphQL API | `private-graphql-api` | `container-service` | app-server | close |
| 9 | Task runners | `task-runners` | `container-worker` | worker | exact |
| 10 | Kubernetes cluster (GKE) | — (props `orchestrator: kubernetes`) | — | — | not a node |
| 11 | Primary Postgres (Cloud SQL for PostgreSQL) | `primary-postgres` | `google-cloud-sql` | sql-database | exact |
| 12 | Sync action log (table in Postgres) | `sync-action-log` | `raft-event-log` | event-store | assumed |
| 13 | Postgres read replicas | `postgres-read-replica` | `google-cloud-sql` | sql-database | exact |
| 14 | CDC pipeline (in-house) | `sync-cdc-pipeline` | `debezium` | change-data-capture | assumed |
| 15 | turbopuffer inverted index | `turbopuffer-index` | `turbopuffer` | vector-database | close |
| 16 | Sync groups | — (posting lists inside `turbopuffer-index`) | — | — | not a node |
| 17 | Sync subscriptions | — (posting lists inside `turbopuffer-index`) | — | — | not a node |
| 18 | Delta-sync read service (two-stage) | `delta-sync-read-service` | `container-service` | app-server | close |
| 19 | Redis (Memorystore, event bus and cache) | `redis-event-bus` | `google-memorystore` | cache | exact |
| 20 | Google Pub/Sub | `task-topic` | `google-pubsub` | pubsub-topic | exact |
| 21 | pgvector similarity search | `issue-vectors` | `pgvector` | vector-database | exact |
| 22 | Embedding provider (OpenAI ada) | `openai-embeddings` | `openai-api` | ai-service | exact |
| 23 | Webhooks | `customer-webhooks` | `webhook-receiver` | webhook-endpoint | close |
| 24 | Terraform | — | — | — | not a node (the card says so) |
| 25 | Bootstrap endpoints (RE) | — (edge `region-proxy` -> `delta-sync-read-service`) | — | — | assumed |

Confidence tally over the 20 encoded nodes: 10 exact, 7 close, 3 assumed
(`workspace-indexeddb`, `sync-action-log`, `sync-cdc-pipeline`). The bootstrap-endpoint edge is
the fourth `assumed` item and the only other row that rests on the reverse-engineering
secondary.

Rows tagged (RE) in the card were encoded only where the design needs them for a coherent
path: the IndexedDB store (the local-first read path has no meaning without it) and the
bootstrap/batch-hydration edge (the client's first load). The remaining (RE) detail — MobX
decorated model classes, the `_transaction` rebasing algorithm, action-type letters, load
strategies, `subscribedSyncGroups` internals — is client-internal and is not encoded.

Values that no source states, set because a rule reads them (all flagged here rather than
invented into the card):

- `security.credentialRotationDays: 90` — Linear publishes no rotation period; 90 days is the
  value that reflects a managed-Cloud-SQL practice and keeps `credentials-without-rotation`
  from firing on a design that has no key-management box either.
- `workspace-indexeddb.evictionPolicy: "lru"` — browsers evict origin storage least-recently-
  used under pressure; IndexedDB itself has no configurable policy.
- `public-sync-ws.drainOnScaleIn` / `private-sync-ws.drainOnScaleIn: true` — the posts state the
  three Kubernetes workload classes "scale independently" but say nothing about drain. True is
  the value that matches the system's own stated goal of not making reconnect worse.
- `customer-webhooks.idempotent: true` — Linear signs webhook deliveries (`linear.app/developers`);
  consumer-side deduplication is implied by the retry contract, not stated.
- `task-runners.idempotent: true` — implied by Pub/Sub at-least-once one-to-many delivery.
- `primary-postgres` backup values are the documented Cloud SQL defaults (backups on, seven
  days), not a Linear statement.
- `sync-action-log.nodes: 1` — the log is one Postgres-backed stream, not a Raft quorum; the
  generic component's three-node default would have been wrong (see gaps).

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Browser IndexedDB / on-device workspace database | `local-database` (new kind, or a `default` generic of `cache` for on-device stores) | `cache-cluster` |
| Application-level log table inside a relational database | a `default` generic of `event-store` backed by a database rather than Raft | `raft-event-log` (`storage: "database"`, `replication: "primary-replica"`, `nodes: 1`) |
| In-house change-data-capture pipeline | a `default` generic of `change-data-capture` | `debezium` |
| In-house global authentication service | a `default` generic of `identity-provider` (every component of that kind is a named product) | `container-service` |
| In-house GraphQL API surface | a `default` generic of `api-gateway` (every component of that kind is a named product) | `container-service` |
| turbopuffer as an inverted index over metadata | the catalogue's `turbopuffer` is kind `vector-database`; the sync read path uses it purely as a `search-index` | `turbopuffer` as shipped |

## Not encoded

- The second region. Every region is a full replica of the whole deployment, so drawing it
  would duplicate 17 nodes; `availability.regions: 2` carries the fact instead.
- Region pinning: a workspace lives in exactly one region, chosen at creation from the user's
  system timezone. The format has no residency or tenant-pinning path.
- The GKE cluster and its three independently scaled workload classes. Expressed as
  `orchestrator: "kubernetes"` on the services rather than as a node, which would be an orphan.
- Terraform and the feature-flagged rollout: tooling and process, not runtime elements.
- Sync groups and sync subscriptions as first-class objects. They are posting lists inside the
  turbopuffer index and a union-then-intersect step inside the read service; neither is a box.
- The deliberate overlap between the Postgres head range and the turbopuffer historical range,
  and the deduplication of the combined result. Two edges out of `delta-sync-read-service` carry
  it in their labels; the format has no way to state that two reads cover overlapping ranges.
- Ordering scope. The log is totally ordered per workspace; `messaging.orderingScope` only
  offers `partition` or `global`, so `partition` stands in for per-workspace.
- Conflict resolution (last-writer-wins with client-side transaction rebasing). There is no
  `consistency.conflictResolution` path, and `multi-leader-store-without-conflict-policy` only
  reads `conflictResolution` on a `nosql-database`, which this design has none of.
- Scale numbers. The sources state 20 TB of sync actions, close to a million sync actions a day
  in the largest workspaces, and tens of terabytes in Cloud SQL, but no requests per second and
  no read/write ratio — so no node carries an `nfr`, and no rule that needs one can apply here.
- The 300-way partitioning of the issues table for the pgvector index migration: a migration
  step, and `sql-database` has no `partitionCount` property.
- The availability-zone layout, which no source states.
