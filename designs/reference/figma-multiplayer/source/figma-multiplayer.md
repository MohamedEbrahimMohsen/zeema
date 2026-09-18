# Intake: Figma multiplayer editing (per-file servers, journal, LiveGraph, sharded Postgres)

## Source
- Primary: https://www.figma.com/blog/how-figmas-multiplayer-technology-works/ (official, 2019: sync model, LWW per property, fractional indexing, offline)
- Primary: https://www.figma.com/blog/rust-in-production-at-figma/ (official, 2018: Node to Rust per-document process)
- Primary: https://www.figma.com/blog/making-multiplayer-more-reliable/ (official, 2024: write-ahead journal in DynamoDB, checkpoints in S3, file lock)
- Primary: https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/ (official, 2024: vertical partitioning, horizontal sharding, DBProxy)
- Primary: https://www.figma.com/blog/livegraph-real-time-data-at-scale/ (official, 2024: LiveGraph 100x edge/cache/invalidator)
- Primary: https://www.figma.com/blog/under-the-hood-of-figmas-infrastructure/ (official, 2018: single Postgres, Oregon latency)
- Verified by: six official Figma engineering posts
- Confidence: high
- Date of source: 2018-2024

## System in three lines
Browser-based design tool where every open file has one authoritative server process holding the document in memory and fanning property-level changes to all connected editors over WebSockets. Durability comes from S3 checkpoints every 30-60 s plus a DynamoDB write-ahead journal; metadata (comments, teams, files) lives in Postgres, vertically partitioned then horizontally sharded behind DBProxy, and streamed to clients through LiveGraph subscriptions fed by the replication log. Hard because a per-file stateful process is a single point of authority, and everything around it must recover state, order writes and invalidate caches without losing user work.

## Scale (only if stated)
- Users / DAU: 80%+ of weekly active users outside the US (2018)
- Requests per second: not stated
- Data volume: 2.2B received changes per day into multiplayer; Postgres tables of terabytes and billions of rows; 100x database growth since 2020
- Message throughput: journal batches every ~500 ms; 95% of edits persisted within 600 ms
- LiveGraph: sessions tripled since 2021; view requests 5x in one year; ~700 query types, ~11 "hard" range queries
- Sharding cutover: "only ten seconds of partial availability on database primaries"

## Requirements stated or clearly implied
- Availability target: no full-file loss on server crash; under 1 s of potential data loss (was 60 s)
- Consistency: server-ordered last-writer-wins per property; single writer per file enforced by conditional writes (no split brain); Postgres strong within shard, cross-shard transactions not yet supported
- Latency target: real-time collaboration; Oregon round trip is the stated pain for international users; remote proxies planned
- Ordering needs: sequence numbers in journal; server defines property update order; fractional indexing for child order
- Replay or reprocessing: crash recovery = latest checkpoint + journal entries with higher sequence numbers; verified byte-for-byte
- Retention: version history from checkpoints; journal must checkpoint within 30 minutes
- Compliance / residency: not stated
- Cost: DynamoDB global tables rejected at ~6x cost; rely on S3 cross-region replication of checkpoints

## Boundaries
- Regions / zones: single AWS region (Oregon) for core; S3 cross-region replication for checkpoints; edge proxies planned
- Trust zones: browsers (untrusted, WebAssembly client) -> WebSocket edge -> multiplayer processes -> storage; web app -> DBProxy -> Postgres shards
- Named subsystems: Client (C++/Wasm editor), Multiplayer cluster (Node network layer + Rust per-document process), Durability (S3 checkpoints, DynamoDB journal and lock), Metadata (Postgres partitions and shards, DBProxy, topology), LiveGraph (edge, cache, invalidator), Rendering/export

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Web client | C++ editor compiled to WebAssembly; applies changes optimistically; undo buffer keeps deleted objects; client-generated ids (clientId+localId) | Figma client | web-client | offlineCapable: true; optimisticUpdates: true |
| 2 | Multiplayer network layer | WebSocket termination, routes sessions to per-document process | Node.js | realtime-gateway | |
| 3 | Multiplayer document process | One process per open file; authoritative in-memory tree; LWW per property; rejects cycles; fractional index ordering | Rust (was TypeScript) | app-server (stateful, per-entity) | stateless: false; instancePerEntity: file; pattern: single-writer |
| 4 | Checkpoint store | Full file encoded, compressed, uploaded every 30-60 s; version history | Amazon S3 | object-store | checkpointIntervalSeconds: 30-60; crossRegionReplication: true |
| 5 | Write-ahead journal | Incremental edits with start/end sequence numbers, batched ~500 ms | Amazon DynamoDB | nosql-database (journal / event-log) | batchMs: 500; replication: single-region |
| 6 | File lock | Conditional write in DynamoDB so only one multiplayer instance journals a file | DynamoDB | coordination-service (lock) | |
| 7 | Web application | Metadata: files, teams, comments | Ruby/TypeScript (not named here) | app-server | |
| 8 | Postgres (single, 2018) | Everything on "one of the beefiest machine in AWS" | AWS RDS Postgres | sql-database | |
| 9 | Vertical partitions (2020-2022) | Dozen databases by table group (files, orgs) | RDS Postgres | sql-database | partitioning: vertical |
| 10 | Horizontal shards (2023) | Hash-routed shards by UserID, FileID, OrgID; colocated tables; logical shards via views before physical | RDS Postgres | sql-database | sharded: true; shardKeys: userId,fileId,orgId; logicalShards: true |
| 11 | Read replicas + caching | Read scaling before sharding | RDS replicas, cache (not named) | sql-database replicas + cache | |
| 12 | DBProxy | Parses SQL, extracts logical shard id, routes, scatter-gather, load shedding, request hedging; ~90% of queries supported | in-house (Go) | database-proxy | scatterGather: true; hedging: true; loadShedding: true |
| 13 | Topology service | Logical to physical shard mapping | in-house | coordination-service | |
| 14 | PGKeeper | Connection pooler / bouncer for Postgres | in-house | database-proxy (pooling) | pooling: true |
| 15 | LiveGraph edge | Client subscriptions (GraphQL-like), expands queries, assembles results; React hook re-renders | in-house (Node) | realtime-gateway (subscriptions) | |
| 16 | LiveGraph cache | Sharded by query hash; invalidation-based; stateless | in-house | cache | invalidation: event; sharding: query-hash |
| 17 | LiveGraph invalidator | Sharded like databases; tails Postgres replication stream; emits targeted invalidations | in-house | change-data-capture | |
| 18 | Remote proxies (planned) | Terminate connections near international users | in-house | realtime-gateway (edge) | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | multiplayer-network | wss | async | at-least-once (client resends unacked) | optimistic local apply |
| multiplayer-network | document-process | stdin/stdout messages | sync | | one process per file |
| document-process | clients (all in file) | ws via network layer | async | at-most-once (state resync on reconnect) | property-level fan-out |
| document-process | s3-checkpoints | https | async | | every 30-60 s |
| document-process | dynamodb-journal | dynamodb | async (batched 500 ms) | at-least-once | sequence numbers |
| document-process | dynamodb-lock | conditional write | sync | | single writer per file |
| document-process (recovery) | s3 + dynamodb | reads | sync | | checkpoint + journal replay |
| s3 | s3 (other region) | replication | async | | within 30 min of last journal entry |
| web-app | dbproxy | sql | sync | | |
| dbproxy | topology-service | rpc | sync | | shard map |
| dbproxy | postgres-shards | sql | sync | | scatter-gather for cross-shard |
| postgres-primary | replicas | streaming replication | async | | |
| postgres shards | livegraph-invalidator | replication stream | async | ordered | CDC |
| livegraph-invalidator | livegraph-cache | invalidation | async | | targeted |
| client | livegraph-edge | wss | async | | subscriptions |
| livegraph-edge | livegraph-cache | rpc | sync | | miss -> db |
| livegraph-cache | dbproxy | sql | sync | | |

## Failure modes, incidents, tradeoffs the source discusses
- Single-threaded server: a slow encode "would freeze the entire worker, blocking all connected users"; separate heavy worker pools were a stopgap; moved hot path to Rust per-document processes. Source: rust.
- GC-driven latency: "some of the performance issues with the old server were caused by the garbage collector". Source: rust.
- Checkpoint-only durability: "we could lose up to 60 seconds of work on the server-side if multiplayer crashes"; journal cut it below 1 s. Source: reliable.
- Split brain: file-level lock with conditional writes so only one instance journals a file. Source: reliable.
- Cross-region cost: global tables ~6x cost rejected; rely on S3 replication and 30-minute checkpoint bound. Source: reliable.
- Conflict model: no simultaneous text editing; "changes are atomic at the property value boundary"; cycles rejected by server, "simple solution to a very rare temporary problem". Source: multiplayer.
- Single Postgres limits: tables of terabytes; vacuum reliability; RDS IOPS ceiling; "Vertical partitioning couldn't save us here because the smallest unit of partitioning is a single table." Source: databases.
- Sharding constraints: joins only within a colo on the shard key; ~90% of queries supported; cross-shard transactions and global unique indexes still open. Source: databases.
- LiveGraph fan-out and fan-in: every mutation to every server, every server reading every shard; one scaling lever; "transient database shard outages blocked all optimistic updates". Source: livegraph-100x.
- Over-invalidation accepted for the ~11 hard range queries. Source: livegraph-100x.
- Geographic latency: 80%+ users outside US hitting Oregon. Source: under-the-hood.

## Unknowns
- WebSocket edge product and load balancing across multiplayer hosts
- Rendering/export pipeline
- Cache product in front of Postgres
- Current region topology

## Candidates
- New kinds: none strictly new; sightings: realtime-gateway (7th), database-proxy (8th; also pooling variant), change-data-capture (3rd: LiveGraph invalidator), coordination-service (7th: lock, topology), object-store (9th), nosql-database (13th, journal), web-client (5th)
- New properties on existing kinds: app-server.instancePerEntity (string: file, guild, channel) and singleWriter (boolean); object-store.checkpointIntervalSeconds; nosql-database.role (journal, lock, store); sql-database.partitioning (none, vertical, horizontal), logicalShards (2nd sighting), shardKeys (list); database-proxy.scatterGather, hedging, loadShedding, pooling; cache.sharding (query-hash)
- New edge properties: optimistic (boolean); resyncOnReconnect (boolean)
- New requirement paths: durability.maxLossSeconds (integer); consistency.singleWriterPerEntity (boolean); latency.geoDistributed (boolean)
- New rules:
  - stateful-per-entity-process-without-journal: app-server instancePerEntity set, checkpoint edge present, no journal/event-log edge while durability.maxLossSeconds is below checkpoint interval
  - single-writer-without-lock: app-server singleWriter true with no coordination-service lock edge
  - subscription-fanout-without-sharded-invalidation: realtime subscription gateway fed by CDC where invalidator is not sharded and shards > 1 (fan-in)
  - cross-shard-join-declared: edge from app-server to sharded sql-database with query pattern join across shard keys (informational)
  - single-region-core-with-global-users: latency.geoDistributed true and all realtime-gateway nodes in one region

## Verification 2026-09-13

Every primary source listed above was re-fetched on 2026-09-13. All six are reachable and
still state the facts the card records.

| URL | Reachable | Outcome |
|---|---|---|
| https://www.figma.com/blog/how-figmas-multiplayer-technology-works/ | yes | One process per document, last-writer-wins per property, "changes are atomic at the property value boundary", no simultaneous text editing, fractional indexing, client-generated ids because object creation must work offline, deleted data in the client undo buffer, server rejects parent updates that would cause a cycle. |
| https://www.figma.com/blog/rust-in-production-at-figma/ | yes | Single-threaded TypeScript server where "a single slow operation would lock up the entire worker", the hand-moved heavy worker pool stopgap, Node network layer plus "a separate child process per document ... using a message-based protocol over stdin and stdout", serialization "over 10x faster". |
| https://www.figma.com/blog/making-multiplayer-more-reliable/ | yes | S3 checkpoints every 30-60 s, DynamoDB write-ahead journal with start/end sequence numbers, batched writes, conditional-write file lock, 60 s of possible loss before the journal and under 1 s after, global tables rejected at ~6x cost, everything checkpointed within 30 minutes, 2.2B received changes per day, 95% of edits persisted within ~600 ms. |
| https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/ | yes | Single Postgres on AWS's largest instance, ~100x growth, a dozen vertical partitions with caching and read replicas, first horizontally sharded table September 2023, shard keys UserID/FileID/OrgID, colos, logical shards as views before physical, DBProxy with query parsing, logical and physical planning, scatter-gather, load shedding and request hedging, "90% of queries", "only ten seconds of partial availability on database primaries", tables of several terabytes and billions of rows. |
| https://www.figma.com/blog/livegraph-real-time-data-at-scale/ | yes | Edge, Cache and Invalidator; cache "sharded by query hash" and read-through; invalidator "sharded the same way as the physical databases and tails a single replication stream"; ~700 query types with 11 hard range queries; sessions tripled since 2021; view requests 5x in a year; excessive fan-out and fan-in. |
| https://www.figma.com/blog/under-the-hood-of-figmas-infrastructure/ | yes | "a single database instance running on one of the beefiest machine in AWS" in Oregon, "More than 80% of our weekly active users are outside the US", round-trip time to Oregon as the pain, planned "remote proxies across the globe". |

### Facts in this card that could not be confirmed

- **PGKeeper** (components row 14). The databases post names **PGBouncer**: "Initially, our
  application services talked directly to our connection pooling layer, PGBouncer." No PGKeeper
  appears in any source. The design encodes PgBouncer.
- **Topology service as a standalone in-house service** (components row 13). The post describes a
  database *topology* built on S3 and etcd that delivers updates in under a second and that DBProxy
  consumes. The design encodes it as an etcd coordination-service with role "sharding"; the S3 half
  of the topology is not encoded.
- **Garbage-collector quote** in the failure-modes section. The Rust post confirms the
  single-threaded lock-up and the memory-per-process advantage; the specific GC sentence was not
  recovered from the fetched rendering. It is narrative only and is not encoded.
- **Remote proxies** (components row 18) are explicitly planned, not running, and are not encoded
  as a node.
- No source states a requests-per-second figure for any box, so neither design carries `nfr.rps`.
