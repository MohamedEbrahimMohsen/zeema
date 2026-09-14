# discord-messages: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/discord-messages.md` (three official Discord engineering posts, 2017 and 2023; re-fetched and confirmed 2026-09-13)
- Size: 14 nodes, 19 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture: Discord message storage and real-time gateway, clean variant.
Elixir session and guild processes fan out over Manifold, a Python API monolith writes
through Rust data services that coalesce reads and route by channel id into ScyllaDB,
while a migrator copies the legacy Cassandra cluster across.

Fixes relative to discord-messages.broken.yaml:
  - session-gateway admits reconnects through session-limiter (Semaphore) instead of
    hitting the guild registry directly, and declares a stampede guard
  - guilds are assigned to gateway hosts by hash, not at random, and the gateway does not
    autoscale without draining its sockets
  - guild-process watches guild-registry, so the consistent hash ring has an owner
  - the API monolith never touches a message store directly; data-services front both
    ScyllaDB and the legacy Cassandra cluster
  - the migrator's local SQLite checkpoint file is not modelled as a datastore of record
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: Discord message storage and real-time gateway, broken variant.
The gateway assigns guilds to hosts at random, autoscales without draining sockets and
looks the guild node up in the registry on every reconnect with nothing limiting
concurrency, the guild ring has no owner, the API monolith talks to Cassandra directly,
and the migrator checkpoints into an unbacked-up local SQLite file.

This file MUST trip:
  - reconnect-stampede-without-guard          (session-gateway calls guild-registry sync, stampedeGuard false)
  - shared-host-per-channel-without-isolation (session-gateway channelAssignment random, traffic.skew heavy-tail)
  - stateful-websocket-scale-in-without-drain (session-gateway autoscaling true, drainOnScaleIn false)
  - stateful-hash-ring-without-ring-manager   (guild-process is on a consistent hash ring with no edge to guild-registry)
  - datastore-missing-backup                  (migrator-checkpoints: SQLite, backupEnabled false, no retention)
and MUST NOT trip:
  - read-heavy-path-without-cache             (traffic.readWriteRatio is not stated, so the rule never arms)
  - datastore-single-region, multi-leader-store-without-conflict-policy (no multiRegion requirement, no multi-leader store)
  - single-writer-primary-at-peak-qps, read-replica-as-sole-scaling (the SQLite checkpoint file carries no rps)
  - credentials-without-rotation              (security.credentialRotationDays is set)
  - queue-missing-dlq, pubsub-replay-required, retry-queue-without-dlq (no queue or topic in this design)
  - cache-missing-eviction-policy, materialised-cache-without-rebuild-path, cache-as-primary-store-without-persistence (no cache node)
  - sync-chain-too-deep                       (no api-gateway node starts the chain)
  - stateful-node-without-zone-redundancy     (the design declares no availability zones)

The broken twin is the pre-2017 gateway plus the shortcut a team takes when it puts an
application monolith straight onto the wide-column store: it is the reconnect stampede the
Elixir post describes (a presence-service crash sent 5,000,000 sessions at 10 registry
processes), the random guild placement that heavy-tail traffic punishes, and the hot
partition risk the trillions post gives as the reason data services exist.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Clients (desktop) | `desktop-client` | `desktop-app` | client | exact |
| Clients (web) | `web-client` | `web-browser` | client | exact |
| Clients (mobile) | `mobile-client` | `mobile-app` | client | exact |
| Session processes (one Erlang process per WebSocket) | `session-gateway` | `websocket-gateway` | realtime-gateway | close |
| Semaphore (ETS atomic-counter concurrency limiter) | `session-limiter` | `in-process-limiter` | rate-limiter | exact |
| Guild processes (one per guild, on guild nodes) | `guild-process` | `erlang-node` | app-server | exact |
| Guild registry / ring (10 registry processes) | `guild-registry` | `apache-helix` | coordination-service | assumed |
| Presence service | `presence-service` | `erlang-node` | app-server | close |
| API monolith (Python) | `api-monolith` | `container-service` | app-server | close |
| Snowflake id generation | `snowflake-generator` | `snowflake-id` | id-generator | exact |
| Data services (Rust, request coalescing) | `data-services` | `container-service` | app-server | assumed |
| ScyllaDB message store (72 nodes, 9 TB each) | `message-store` | `scylladb` | nosql-database | exact |
| Cassandra message store (177 nodes, legacy) | `legacy-message-store` | `cassandra` | nosql-database | exact |
| Migrator (Rust, up to 3.2M msgs/sec) | `migrator` | `container-worker` | worker | exact |
| SQLite checkpoints | `migrator-checkpoints` (broken twin only) | `sqlite` | sql-database | exact |
| Manifold (fan-out library) | edge `guild-process -> session-gateway` | - | - | exact (as `batched: true`) |
| Gateway / API monolith / Data services / Message store / Migrator subsystems | groups `gateway`, `api`, `data-services`, `storage`, `migration` | - | system | exact |

Confidence tally: 10 exact, 3 close, 2 assumed (nodes only).

Two values in the clean design are not read off a source sentence and are called out here
rather than hidden:

- `security.credentialRotationDays: 90`. None of the three posts mentions credential
  rotation, but a design that holds data and says nothing trips `credentials-without-rotation`.
  Ninety days is the value the other reference designs use, and reflects normal practice at a
  company running managed GCP infrastructure.
- `session-gateway.channelAssignment: "hash"`. The posts describe guilds placed on guild nodes
  through a consistent hash ring, and Manifold "consistently hashing through partitioners", so
  hash is the assignment the system actually performs; the word "hash" is ours.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Discord data services (in-house Rust request-coalescing layer) | `database-proxy` - no generic or in-house component exists under `default`; every `database-proxy` component is a SQL-specific product | `container-service` (app-server). `requestCoalescing: true` and `routing: shard-key` are therefore not expressible on the node and live in the edge labels. |
| Discord guild registry (in-house Elixir, 10 registry processes) | `coordination-service` - no generic component exists under `default` (only apache-helix, consul, etcd, eureka, nacos, zookeeper) | `apache-helix`, the nearest same-kind component whose default role is placement/sharding. The node carries `label: "Guild registry"`; Discord does not run Helix. |

## Not encoded

- MongoDB (2015, 100M messages, index outgrew RAM). History in the same post, not a component of the 2022-2023 system, so it is not a node.
- Cluster sizes: 177 Cassandra nodes at ~4 TB average and 72 ScyllaDB nodes at 9 TB each. `nosql-database` has no node-count or disk property.
- Measured latencies (Cassandra fetch p99 40-125 ms and insert p99 5-70 ms, ScyllaDB 15 ms and 5 ms). `nfr` carries a p95 target, not a measured p99 pair, and these are observations rather than promises.
- Super-disk: local SSD mirrored by RAID onto a GCP persistent disk. A storage-medium property `nosql-database` does not have.
- FastGlobal: ring lookups from 12 us to 0.3 us via the read-only shared heap. An in-process optimisation with no node and no property.
- Manifold's grouping of PIDs by remote node survives only as `batched: true` on the fan-out edge; the partitioner tree does not.
- The roughly ten-day, sub-100 MB bucket size behind `bucketing: true`, and empty-bucket tracking. `bucketing` is a boolean.
- The tombstone outage's shape (a channel with 1 message and millions of tombstones taking 20 seconds to load) and upserts that can drop `author_id` on a concurrent edit and delete.
- Per-process scale: millions of session processes per node, 5,000,000 concurrent users, millions of events per second, 30,000 concurrent users in one guild, `send/2` at 30-70 us, large-guild publish at 900 ms - 2.1 s. The gateway has no stated per-second request figure to put in `nfr.rps`.
- The migration tail: the last token ranges timing out at 99.9999% and needing manual compaction.
- Cloudflare's edge role, attachment and media storage, and cross-region topology: the sources do not describe them.
