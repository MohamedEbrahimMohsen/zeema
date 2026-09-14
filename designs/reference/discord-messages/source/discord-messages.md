# Intake: Discord message storage and real-time gateway

## Source
- Primary: https://discord.com/blog/how-discord-stores-trillions-of-messages (official, 2023: Cassandra to ScyllaDB, Rust data services, request coalescing)
- Primary: https://discord.com/blog/how-discord-stores-billions-of-messages (official, 2017: MongoDB to Cassandra, bucketing, tombstones)
- Primary: https://discord.com/blog/how-discord-scaled-elixir-to-5-000-000-concurrent-users (official, 2017: session and guild processes, Manifold, FastGlobal, Semaphore)
- Verified by: three official Discord engineering posts
- Confidence: high
- Date of source: 2017, 2023

## System in three lines
Chat platform where users hold a WebSocket to an Elixir gateway and every message in a guild fans out to every connected member, then is stored by channel in a wide-column store. Storage moved from MongoDB to Cassandra to ScyllaDB, with Rust data services in front that coalesce identical concurrent reads and route by channel id. Hard because message traffic per channel is wildly skewed (small servers vs mega-servers), reads outnumber writes, and JVM garbage collection and tombstones turned hot partitions into cluster-wide latency.

## Scale (only if stated)
- Users / DAU: nearly 5M concurrent users (2017); 30,000 concurrent users in a single guild (/r/Overwatch)
- Requests per second: millions of events/sec through the gateway (2017); migrator up to 3.2M messages/sec
- Data volume: 100M messages by Nov 2015; billions in 2017; trillions by 2022; Cassandra 177 nodes at ~4 TB each, ScyllaDB 72 nodes at 9 TB each
- Message throughput: not stated per second for writes
- Latency: Cassandra fetch p99 40-125 ms, insert p99 5-70 ms; ScyllaDB fetch p99 15 ms, insert p99 5 ms; original requirement p95 under 80 ms; MongoDB era unpredictable

## Requirements stated or clearly implied
- Availability target: automatic failover, low maintenance, no weekend firefights
- Consistency: eventual (Cassandra/ScyllaDB); all writes are upserts, concurrent edit and delete can drop columns
- Latency target: p95 under 80 ms for message reads; predictable
- Ordering needs: chronological within channel via Snowflake ids
- Replay or reprocessing: historical scans (ascending order) required for migration and pagination
- Retention: messages kept indefinitely; tombstone lifetime cut from 10 to 2 days
- Compliance / residency: not stated

## Boundaries
- Regions / zones: not stated
- Trust zones: clients -> gateway (Elixir) -> API monolith (Python) -> data services (Rust) -> ScyllaDB
- Named subsystems: Gateway (session processes, guild processes, presence), API monolith, Data services, Message store, Migrator

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Clients | Desktop, web, mobile over WebSocket | Electron, web, iOS, Android | desktop-client, web-client, mobile-client | connection: persistent-websocket |
| 2 | Session processes | One Erlang process per WebSocket connection; subscribes to guilds | Elixir/BEAM | realtime-gateway | processesPerNode: millions |
| 3 | Guild processes | One process per guild on guild nodes; pub/sub fan-out to sessions | Elixir/BEAM | app-server (stateful, actor) | stateless: false; pattern: actor |
| 4 | Manifold | Fan-out library: group PIDs by node, consistent-hash partition, batch sends | Manifold (open source) | property of fan-out edge | batching: true |
| 5 | FastGlobal | Constant data in read-only shared heap for ring lookups (12 us to 0.3 us) | FastGlobal (open source) | property of app-server | |
| 6 | Guild registry / ring | Maps guild id to node; 10 registry processes | in-house | sharding-coordinator | |
| 7 | Semaphore | ETS atomic counters limiting concurrent requests during stampedes | Semaphore (open source) | rate-limiter (in-process) | |
| 8 | Presence service | Online status; its crash triggered 5M-session stampede | in-house | app-server (stateful) | |
| 9 | API monolith | Business logic, HTTP API | Python | app-server | |
| 10 | Data services | Rust layer between monolith and DB; request coalescing; consistent hash routing by channel_id | in-house (Rust) | database-proxy (application-level) | requestCoalescing: true; routingKey: channel_id |
| 11 | ScyllaDB | Message store, 72 nodes, shard-per-core, no GC | ScyllaDB | nosql-database (wide-column) | nodes: 72; storageEngine: cpp |
| 12 | Cassandra (legacy) | Message store 2017-2023, 177 nodes | Apache Cassandra | nosql-database | nodes: 177 |
| 13 | MongoDB (original) | Message store 2015; index outgrew RAM | MongoDB | nosql-database (document) | |
| 14 | Super-disk | Local SSD mirrored via RAID onto persistent disk | GCP | property of nosql-database storage | |
| 15 | Migrator | Rust, 3.2M msgs/sec, SQLite checkpoints of token ranges | in-house | worker (migration) | |
| 16 | Snowflake id generation | Chronologically sortable ids | Twitter Snowflake scheme | id-generator | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | session-process | wss | async | | one process per connection |
| session-process | guild-process | erlang message | async | | subscribe, publish |
| guild-process | session-processes (all in guild) | erlang message via manifold | async | at-most-once | fan-out; 900 ms-2.1 s before Manifold for large guilds |
| session-process | guild-registry | erlang call | sync | | lookup on reconnect; 5M sessions stampede |
| client | api-monolith | https | sync | | send message |
| api-monolith | data-service | grpc/http | sync | | |
| data-service | scylladb | cql | sync | | coalesced, routed by channel_id |
| api-monolith | cassandra (legacy) | cql | sync | | direct, hot partition risk |
| api-monolith | scylladb + cassandra | cql | sync | | dual write during migration |
| migrator | cassandra | cql | sync | | read token ranges |
| migrator | scylladb | cql | sync | | write, 3.2M/s |
| migrator | sqlite | local | sync | | checkpoints |

## Failure modes, incidents, tradeoffs the source discusses
- Working set outgrew RAM: MongoDB index for channel_id+created_at; "latencies started to become unpredictable" at 100M messages. Source: billions.
- Partition sizing: (channel_id, message_id) partitions too large caused GC pressure; bucketed by ~10 days to stay under 100 MB. Source: billions.
- Tombstone waste: "we were writing 12 tombstones into Cassandra most of the time for no reason"; fix write only non-null. Source: billions.
- Tombstone scan outage: a channel with 1 message and millions of deleted-message tombstones made Cassandra "scan millions of message tombstones (generating garbage faster than the JVM could collect it)"; tombstone TTL 10 to 2 days; track buckets to skip empty partitions. Source: billions.
- Upsert semantics: concurrent edit and delete can lose author_id. Source: billions.
- Hot partitions: skewed traffic between small and mega servers; "Reads are more expensive than writes... resulting in broader end-user impact." Source: trillions.
- JVM GC pauses: latency spikes, manual node reboots; ScyllaDB (C++) removed the class. Source: trillions.
- Compaction backlog cascades latency during maintenance. Source: trillions.
- Request coalescing plus consistent-hash routing absorb spikes before the DB. Source: trillions.
- Migration tail: 99.9999% done then timeouts on last token ranges from giant tombstone ranges; manual compaction. Source: trillions.
- Fan-out cost: send/2 30-70 us; large guild publish 900 ms-2.1 s; Manifold batching fixed. Source: elixir.
- Reconnect stampede: presence crash led 5M sessions to hit 10 registry processes; Semaphore limits concurrency. Source: elixir.

## Unknowns
- Edge (Cloudflare) role details (case study PDF not readable)
- Media/attachment storage and CDN
- Cross-region topology
- Current gateway numbers (11M+ concurrent per later post)

## Candidates
- New kinds: none strictly new; sightings: realtime-gateway (5th), database-proxy (7th, application-level data service), nosql-database (9th), sharding-coordinator (3rd), rate-limiter (2nd, in-process), id-generator (2nd), worker (10th), desktop-client (3rd)
- New properties on existing kinds: nosql-database.partitionKey (string), bucketing (boolean), tombstoneTtlDays (integer), storageEngine (2nd sighting); database-proxy.requestCoalescing (boolean); app-server.pattern actor; rate-limiter.scope (edge, in-process)
- New edge properties: batched (boolean); stampedeGuard (boolean)
- New requirement paths: latency.p95Ms (already), traffic.skew (uniform, heavy-tail)
- New rules:
  - wide-column-store-without-partition-bound: nosql-database wide-column with partitionKey lacking a time bucket while traffic.skew heavy-tail
  - delete-heavy-store-without-tombstone-policy: nosql-database with delete edges and no tombstoneTtlDays
  - hot-read-path-without-coalescing: heavy-tail read traffic to nosql-database with no database-proxy requestCoalescing in path
  - fanout-without-batching: guild/channel fan-out edge to thousands of subscribers with batched false
  - reconnect-stampede-without-guard: realtime-gateway sync lookup edge into a small coordinator with no stampedeGuard

## Verification 2026-09-13

| URL | Reachable | Outcome |
|---|---|---|
| https://discord.com/blog/how-discord-stores-trillions-of-messages | yes | Confirms 177 Cassandra nodes (early 2022) and 72 ScyllaDB nodes at 9 TB of disk each (Cassandra averaged ~4 TB); fetch p99 40-125 ms on Cassandra to 15 ms on ScyllaDB; insert p99 5-70 ms to a steady 5 ms; Rust data services with request coalescing ("multiple users requesting the same row" produce one database query and later requests subscribe to it); consistent hash-based routing to data services so all requests for the same channel go to the same instance; Rust migrator at up to 3.2 million messages per second, ~9 days, SQLite for local checkpoints; local SSDs plus RAID mirroring to persistent disk ("super-disk"). Also confirms the 2017 starting point of 12 Cassandra nodes. |
| https://discord.com/blog/how-discord-stores-billions-of-messages | yes | Confirms 100 million messages by November 2015 and that "the data and the index could no longer fit in RAM and latencies started to become unpredictable"; the p95-above-80 ms alert; partitions over 100 MB causing GC pressure and the ~10-day bucket; the primary key ((channel_id, bucket), message_id); "writing 12 tombstones into Cassandra most of the time for no reason"; the tombstone outage where a channel with 1 remaining message took 20 seconds to load; tombstone TTL lowered from 10 days to 2 days; empty-bucket tracking. |
| https://discord.com/blog/how-discord-scaled-elixir-to-5-000-000-concurrent-users | yes | Confirms session processes, guild processes, 10 guild registry processes (one per guild node); send/2 at 30-70 us; large-guild publish 900 ms to 2.1 s; Manifold grouping PIDs by remote node and consistently hashing through partitioners; FastGlobal taking ring lookups from 12 us to 0.3 us and reconnect lookup from 17.5 s to 750 ms; Semaphore as an ETS atomic-counter concurrency limiter; 5,000,000 concurrent users; millions of events per second; /r/Overwatch with 30,000 concurrent users. |

Facts the card states that the fetched pages did not confirm, and which are therefore **not**
encoded as values in the design:

- Cassandra nodes at "~4 TB each" is confirmed only as an average, and neither node count is
  expressible on `nosql-database` (it has no `nodes` property). Node counts stay in notes.
- The 2015 MongoDB store is confirmed as history, not as a component of the 2022-2023 system;
  it is not a node in the design.
- The exact wording of the presence-service crash that produced the 5,000,000-session
  reconnect stampede was not reproduced in the fetched summary; the stampede and Semaphore's
  role as its guard were. The presence node is kept, the incident is described in notes only.
- Cloudflare's edge role, media/attachment storage, cross-region topology and any replication
  factor remain unstated in all three posts and are absent from the design.
