# figma-multiplayer: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/figma-multiplayer.md` (six official Figma engineering posts, 2018-2024, all re-fetched and confirmed 2026-09-13).
- Size: 16 nodes, 21 edges, 6 groups (the broken variant adds one availability-zone group).

## Clean variant (header of design.yaml)

Reference architecture: Figma multiplayer editing, clean variant. One authoritative in-memory
process per open file fanning property-level changes over WebSockets, durability from S3
checkpoints plus a DynamoDB write-ahead journal behind a conditional-write file lock, and
file metadata served from sharded Postgres through DBProxy and LiveGraph subscriptions.

Fixes relative to figma-multiplayer.broken.yaml:
  - the per-file document process is not pinned to one availability zone; the design declares
    no zone boundary at all, so a lost zone does not take the only copy of a file's authority
  - the shard topology store (etcd) is replicated and spans no single zone
  - multiplayer-network does not autoscale, and drains connections on scale-in
  - the client resends unacknowledged changes as at-least-once idempotent traffic instead of
    retrying on a blind exponential policy with no circuit breaker
  - livegraph-cache declares an eviction policy
  - metadata-shards declares backups and a retention window
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: Figma multiplayer editing, broken variant. Same system as
figma-multiplayer.yaml but built the way a team usually builds it first: the per-file
authority and the shard topology squeezed into one availability zone, a WebSocket tier that
autoscales without draining, a client that hammers reconnects on a blind exponential retry,
an unbounded LiveGraph cache and a sharded Postgres fleet nobody backed up.

This file MUST trip:
  - stateful-node-without-zone-redundancy     (document-process holds the only in-memory copy of a file and sits in az-a alone)
  - stateful-engine-pinned-to-single-zone     (topology-store is in az-a with replicated false)
  - stateful-websocket-scale-in-without-drain (multiplayer-network autoscaling true, drainOnScaleIn false)
  - retry-without-adaptive-shedding           (figma-client -> multiplayer-network retries exponentially, no circuitBreaker, no rate-limiter in front)
  - cache-missing-eviction-policy             (livegraph-cache declares no evictionPolicy)
  - datastore-missing-backup                  (metadata-shards backupEnabled false)
and MUST NOT trip:
  - reconnect-stampede-without-guard          (both gateways declare stampedeGuard, and neither calls a coordination service)
  - datastore-single-region                   (availability.multiRegion is false)
  - read-replica-as-sole-scaling, single-writer-primary-at-peak-qps (metadata-shards is sharded and no node declares nfr.rps)
  - cache-as-primary-store-without-persistence, materialised-cache-without-rebuild-path (the LiveGraph cache is read-through, not a store)
  - credentials-without-rotation              (security.credentialRotationDays is set)
  - multi-leader-store-without-conflict-policy (both DynamoDB tables are single-region)
  - object-store-single-zone-with-durability-target (no durability.annualNines requirement)
  - stateful-hash-ring-without-ring-manager, fanout-inline-in-request-path (no consistent-hash app-server, no worker node)
  - sync-chain-too-deep                       (no api-gateway node and no latency.p95Ms target)
  - queue-missing-dlq, pubsub-replay-required, derived-store-without-cdc-or-rebuild (no queue, topic or search index)

## Mapping

| source box | node | component | kind | confidence |
|---|---|---|---|---|
| Web client (C++ editor compiled to WebAssembly) | `figma-client` | `web-browser` | client | exact |
| Multiplayer network layer (Node.js, WebSocket termination) | `multiplayer-network` | `websocket-gateway` | realtime-gateway | exact |
| Multiplayer document process (one Rust process per open file) | `document-process` | `container-service` | app-server | close |
| Checkpoint store (Amazon S3, every 30-60 s) | `checkpoint-store` | `s3` | object-store | exact |
| Cross-region checkpoint replica (S3 replication) | `checkpoint-replica` | `s3` | object-store | exact |
| Write-ahead journal (Amazon DynamoDB) | `journal` | `dynamodb` | nosql-database | exact |
| File lock (DynamoDB conditional write) | `file-lock` | `dynamodb` | nosql-database | exact |
| Web application (files, teams, comments) | `web-app` | `container-service` | app-server | close |
| DBProxy (in-house Go SQL proxy) | `dbproxy` | `pgcat` | database-proxy | close |
| PGBouncer connection pooling layer | `pgbouncer` | `pgbouncer` | database-proxy | exact |
| Database topology (logical to physical shard map) | `topology-store` | `etcd` | coordination-service | close |
| Horizontal shards / colos (RDS Postgres, UserID, FileID, OrgID) | `metadata-shards` | `aws-rds` | sql-database | exact |
| Read replicas | `metadata-replicas` | `aws-rds` | sql-database | exact |
| LiveGraph Edge (view subscriptions) | `livegraph-edge` | `websocket-gateway` | realtime-gateway | close |
| LiveGraph Cache (read-through, sharded by query hash) | `livegraph-cache` | `cache-cluster` | cache | exact |
| LiveGraph Invalidator (tails the replication stream) | `livegraph-invalidator` | `debezium` | change-data-capture | close |

Tally: 9 exact, 7 close, 0 assumed.

Two values are **assumed** rather than taken from a source, both because a rule reads them and
the sources are silent:

- `security.credentialRotationDays: 90` satisfies `credentials-without-rotation`. Figma's posts
  never discuss credential rotation; 90 days reflects standard practice for a managed RDS fleet.
- `metadata-shards` / `metadata-replicas` `backupEnabled: true, backupRetentionDays: 7` satisfy
  `datastore-missing-backup`. No post mentions backups; automated backups are on by default for
  RDS and a company running billions of rows of customer file metadata certainly keeps them.

`livegraph-cache` uses `hashing: "consistent"` to stand for "sharded by query hash", and
`multiplayer-network` / `livegraph-edge` use `channelAssignment: "hash"` because sessions are
routed to the process that owns the file key. Neither phrasing is verbatim in the source.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| DBProxy (in-house Go SQL proxy: parses SQL, extracts the logical shard id, scatter-gathers, hedges, sheds load) | a generic `database-proxy` under `default`; every component in that kind today is a named product | `pgcat`, the closest generic-shaped Postgres pooler and router, labelled "DBProxy" |
| LiveGraph Invalidator (in-house, tails one Postgres replication stream per shard) | a generic `change-data-capture` under `default`; the kind has only named products | `debezium`, log-based Postgres CDC, labelled "LiveGraph Invalidator" |

## Not encoded

- Crash recovery is the same two arrows read backwards (latest checkpoint from S3, then journal entries with a higher sequence number). The format has no read/write direction on a store edge, so the recovery read lives in the labels of the checkpoint and journal edges instead of in extra edges.
- Last-writer-wins per property, fractional indexing for child order and server-side cycle rejection are conflict semantics inside one node; the format has no place for them.
- The client-side undo buffer that holds deleted objects so the server never stores them.
- Client-generated object ids (`clientId` + `localId`) that make offline creation possible; `offlineCapable: true` on `figma-client` is as close as the format gets.
- The 2018 single Postgres and the 2020-2022 dozen vertical partitions: the design encodes the current horizontally sharded end state only, not the migration through it. Logical shards implemented as Postgres views before the physical failover have no representation either.
- Numbers the sources state but the format has no path for: 2.2B received changes per day, 95% of edits persisted within ~600 ms, the ~500 ms journal batch interval, the 30-60 s checkpoint interval, the 30-minute checkpoint bound, the under-1-second data-loss target, ~700 LiveGraph query types with 11 hard range queries, the ten seconds of partial availability at physical shard cutover, and "more than 80% of weekly active users are outside the US" (only `latency.geoDistributed: true` survives).
- DynamoDB global tables rejected at roughly 6x cost: a decision not taken, so there is no node for it.
- Remote proxies near international users are described as planned, not running, and are not encoded.
- The rendering and export pipeline, and the product behind the pre-LiveGraph cache in front of Postgres, are listed as unknowns in the card and appear nowhere.
