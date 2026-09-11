# Intake: Cloud file sync (Google Drive / Dropbox class), verified against Dropbox

## Source
- Primary: https://dropbox.tech/infrastructure/inside-the-magic-pocket (official, block storage internals)
- Primary: https://dropbox.tech/infrastructure/streaming-file-synchronization (official, sync protocol: metaserver, blockserver, notification, SFJ)
- Primary: https://dropbox.tech/infrastructure/magic-pocket-infrastructure (official, S3 exit, hybrid, durability targets)
- Primary: https://dropbox.tech/infrastructure/reintroducing-edgestore and https://dropbox.tech/infrastructure/rewriting-the-heart-of-our-sync-engine (official, metadata store and Nucleus client engine)
- Verified by: official Dropbox engineering blog (four posts). Google Drive internals are not publicly documented; this card uses Dropbox as the verified instance of the class.
- Confidence: high
- Date of source: 2014 (streaming sync), 2016 (Magic Pocket), 2020 (Nucleus, Edgestore)

## System in three lines
Keeps a folder identical across a user's devices and the cloud. Files are chunked into content-addressed blocks stored in a durable block store; a separate strongly consistent metadata service records which blocks make up which file version. Hard because of exabyte scale, near-infinite durability targets, and conflict-free sync across intermittently connected clients.

## Scale (only if stated)
- Users / DAU: not stated
- Requests per second: Edgestore cross-shard transactions at 10M requests/sec
- Data volume: 500+ PB (2016), growing to exabytes; 12x growth 2012-2016
- Message throughput: cross-zone replication "within one second" of upload
- Storage unit: OSD holds over 1 PB, 8 PB per rack, cell ~50 PB, cell limit ~100 PB

## Requirements stated or clearly implied
- Availability target: 99.99% availability
- Durability target: 99.9999999999% (twelve nines) annual; "loss due to an apocalyptic asteroid impact is more likely than random disk failures"
- Consistency: metadata strongly consistent and transactional (Edgestore, SFJ append-only with monotonic journal id); block store immutable content-addressed
- Latency target: not quantified; sync time improved 25% by streaming
- Ordering needs: per-namespace monotonic journal id
- Replay or reprocessing: clients resume from cursor (JID) in Server File Journal
- Retention: file version history via SFJ rows (period not stated)
- Compliance / residency: blocks compressed and encrypted; not further stated

## Boundaries
- Regions / zones: three US zones (west, central, east); every block in at least two zones
- Trust zones: desktop and mobile clients (untrusted) -> web/API frontends -> metadata plane; block plane separate
- Named subsystems: Sync clients (Nucleus), Metadata plane (metaserver, SFJ, Edgestore), Notification, Block plane (blockserver frontends, Magic Pocket: Block Index, Replication Table, Master, OSDs, cross-zone replication)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Desktop client (Nucleus) | Watches filesystem, keeps local tree, remote tree, synced tree; resolves conflicts; holds cursor | Nucleus (Rust) | desktop-client (new) | offlineCapable: true |
| 2 | Mobile / web client | Same via API | native, web | mobile-client, web-client | |
| 3 | Metaserver | Commits blocklists, serves list calls, requests missing blocks | in-house | app-server | stateless: true |
| 4 | Server File Journal (SFJ) | Append-only file version log per namespace; row = ns id, path, blocklist, journal id | MySQL-backed | sql-database (append-only journal) | appendOnly: true; ordering: per-key |
| 5 | Edgestore | Abstraction over thousands of MySQL nodes; strongly consistent, transactional, cross-shard | Edgestore on MySQL | sql-database (sharded) | sharded: true; consistency: strong; rps: 10000000 |
| 6 | Memcache | Uncommitted file state for streaming sync prefetch | memcached | cache | |
| 7 | Notification server | Holds idle clients' long-poll connections; broadcasts change hints | in-house | push-service (new) | transport: long-poll |
| 8 | Blockserver frontend | Put/get blocks by SHA-256; checks Block Index; retries other volume on failure | in-house | app-server | stateless: true |
| 9 | Block Index | Sharded MySQL: hash -> cell, bucket, checksum | MySQL | sql-database (sharded) | sharded: true |
| 10 | Replication Table | Small memory-resident MySQL: bucket -> volume, OSDs, open flag, generation | MySQL | sql-database | |
| 11 | Master (per cell) | Soft-state janitor: monitors OSDs, triggers repair after 15 min offline, bucket lifecycle | in-house | control-plane-coordinator (new) | softState: true |
| 12 | OSD storage nodes | Dumb block storage, >1 PB each, replicated or erasure-coded volumes | in-house on spinning disks | object-store (new, internal tier) | replication: volume; erasureCoding: true |
| 13 | Cross-zone replication daemon | Async copy of every block to a second zone within 1 s | in-house | worker | |
| 14 | Volume manager | Reconstructs erasure-coded reads when primary OSD down | in-house | app-server | |
| 15 | Amazon S3 (legacy) | Prior block store, 90% migrated off by Oct 2015 | AWS S3 | object-store | |
| 16 | Web servers / API | User-facing HTTP, hosted in own DCs | in-house | app-server | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | metaserver | https | sync | | commit blocklist; list changes from cursor |
| metaserver | client | https | sync | | "need blocks" response |
| client | blockserver | https | sync | | upload/download 4 MB blocks by hash |
| metaserver | sfj | mysql | sync | | append version row |
| metaserver | edgestore | edgestore rpc | sync | | users, namespaces |
| metaserver | memcache | memcached | sync | | uncommitted state for streaming sync |
| metaserver | notification-server | internal | async | | change hint per namespace |
| notification-server | client | http long-poll | async | at-most-once | hint only; client then lists |
| blockserver | block-index | mysql | sync | | existence check |
| blockserver | replication-table | mysql | sync | | volume lookup |
| blockserver | osd | internal | sync | | store to all OSDs in volume; retry other volume on failure |
| osd | cross-zone-replicator | internal | async | at-least-once | within 1 s |
| cross-zone-replicator | osd (other zone) | internal | async | | |
| master | osd | internal | async | | health, repair plans |
| master | replication-table | mysql | sync | | commit point = generation bump |

## Failure modes, incidents, tradeoffs the source discusses
- Central coordinator by design, not consensus: "spending all day reimplementing Paxos is usually a bad idea"; Master is soft-state, cell keeps serving reads if Master dies. Source: inside-the-magic-pocket.
- Repair trigger delay: repair "once an OSD has been offline for 15 minutes, long enough to restart a node without triggering unnecessary repairs". Source: inside-the-magic-pocket.
- Commit point discipline: generation number bump then Replication Table update "ensures consistency even if Master fails mid-repair"; reconcile rolls back partial repairs. Source: inside-the-magic-pocket.
- Open vs closed volumes: "closed volume is immutable and may be safely moved", isolating background ops from live writes. Source: inside-the-magic-pocket.
- Temporal locality drives tiering: recent data replicated and cached, older data erasure-coded; spinning disks for cost. Source: inside-the-magic-pocket.
- Reconstruction fan-in: lose one OSD, rebuild "from hundreds of other OSDs simultaneously". Source: inside-the-magic-pocket.
- Two-phase sync latency: original protocol required full upload and SFJ commit before download; streaming sync keeps downloader "one blockserver network call behind". Source: streaming-file-synchronization.
- Notification is hint-only; client always reconciles via list from cursor, so lost hints are safe. Source: streaming-file-synchronization.
- Old C++ engine accumulated "concurrency bugs, deadlocks, and data corruption edge cases"; rewrite designed "away invalid states". Source: Nucleus post.
- S3 exit: control the stack end-to-end and unit economics at exabyte scale; metadata and web stayed in own DCs, "partner with Amazon where it makes sense". Source: magic-pocket-infrastructure.

## Unknowns
- Google Drive specifics (chunking, metadata store, notification transport) are not public
- Version history retention period
- Client conflict resolution rules in detail
- Current hosting split after 2020

## Candidates
- New kinds: desktop-client, push-service (long-poll / websocket / sse fan-out to clients), control-plane-coordinator (soft-state master), object-store (2nd sighting)
- New properties on existing kinds: sql-database.appendOnly (boolean); sql-database.sharded (2nd sighting); object-store.durabilityNines (integer); object-store.erasureCoding (boolean); object-store.crossZoneReplicationSeconds (integer); cache.holdsUncommittedState (boolean)
- New edge properties: contentAddressed (boolean); hintOnly (boolean, delivery may be lost safely)
- New requirement paths: durability.annualNines (integer); availability.zones (integer)
- New rules:
  - object-store-single-zone-with-durability-target: object-store in exactly one zone while durability.annualNines >= 11
  - notification-without-reconcile-path: push-service edge to client with no sync list/pull edge back to source of truth
  - stateful-coordinator-without-soft-state: control-plane-coordinator holding authoritative state with no persistent table behind it
  - metadata-and-blob-in-same-store: design where file bytes and file metadata share one datastore (anti-pattern the source separates explicitly)
