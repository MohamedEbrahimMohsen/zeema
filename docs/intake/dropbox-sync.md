# Intake: Dropbox file sync and storage (Nucleus, metadata plane, Magic Pocket)

## Source
- Primary: https://dropbox.tech/infrastructure/inside-the-magic-pocket (Dropbox storage engineers, official engineering blog, 2016) — Magic Pocket internals: frontends, Block Index, Replication Table, Master, OSDs, Volume Managers, PUT/GET/REPAIR
- Primary: https://dropbox.tech/infrastructure/magic-pocket-infrastructure (Dropbox infrastructure team, official blog, 2016) — S3 exit, hybrid strategy, durability/availability targets, migration timeline
- Primary: https://dropbox.tech/infrastructure/extending-magic-pocket-innovation-with-the-first-petabyte-scale-smr-drive-deployment (Dropbox hardware/storage engineers, official blog, 2018) — SMR chassis, OSD layout, per-host numbers
- Primary: https://dropbox.tech/infrastructure/streaming-file-synchronization (Dropbox sync engineers, official blog, 2014) — desktop client protocol: metaserver, blockserver, notification server, SFJ, memcache
- Primary: https://dropbox.tech/infrastructure/rewriting-the-heart-of-our-sync-engine (Dropbox sync team, official blog, 2020) — Nucleus rewrite, Rust Control thread, protocol guarantees, scale
- Primary: https://dropbox.tech/infrastructure/-testing-our-new-sync-engine (Dropbox sync team, official blog, 2020) — the three trees, planner/scheduler, CanopyCheck and Trinity
- Primary: https://dropbox.tech/infrastructure/reintroducing-edgestore (Dropbox metadata team, official blog, 2018) — Edgestore Cores/Engines/cache, entities and associations
- Primary: https://dropbox.tech/infrastructure/cross-shard-transactions-at-10-million-requests-per-second (Dropbox metadata team, official blog, 2020) — Edgestore cross-shard 2PC with an external transaction record
- Primary: https://dropbox.tech/infrastructure/panda-metadata-stack-petabyte-scale-transactional-key-value-store (Dropbox metadata team, official blog, 2022) — Panda ranges, hybrid-logical clocks, MVCC
- Primary: https://dropbox.tech/infrastructure/alki--or-how-we-learned-to-stop-worrying-and-love-cold-metadata (Dropbox metadata team, official blog, 2021) — cold metadata tier on DynamoDB + S3
- Primary: https://dropbox.tech/infrastructure/dropbox-traffic-infrastructure-edge-network (Dropbox traffic team, official blog, 2018) — PoPs, GSLB, IPVS, nginx, backbone
- Primary: https://dropbox.tech/infrastructure/meet-bandaid-the-dropbox-service-proxy (Dropbox traffic team, official blog, 2018) — in-datacenter L7 service proxy
- Primary (talk): https://qconsf.com/presentation/oct2022/magic-pocket-dropboxs-exabyte-scale-blob-storage-system (Facundo Agriel, Dropbox software engineer and tech lead for Magic Pocket, QCon SF 2022), write-up at https://www.infoq.com/articles/dropbox-magic-pocket-exabyte-storage/ (InfoQ, 2023) — erasure-coding parameters, cold tier, per-OSD capacity
- Verified by: official Dropbox engineering blog (12 posts fetched in full) + QCon SF 2022 talk by the Magic Pocket tech lead and its InfoQ write-up
- Confidence: high
- Date of source: 2014 (streaming sync), 2016 (Magic Pocket, S3 exit), 2018 (SMR, edge, Bandaid, Edgestore), 2020 (Nucleus, cross-shard transactions), 2021 (Alki), 2022 (Panda, QCon talk)

Note: the existing `google-drive` card uses Dropbox as the verified instance of the generic
cloud-file-sync class. This card is the Dropbox system end to end — edge, sync engine,
metadata plane and Magic Pocket — cited from the Dropbox posts directly, and goes deeper on
the metadata stack (Edgestore, Panda, Alki) and the edge, which the generic card omits.

## System in three lines
Keeps a user's folder byte-identical across hundreds of millions of devices and the cloud. A desktop client (Nucleus) reconciles three filesystem trees and speaks a commit/list protocol to a metadata plane that records file versions as append-only journal rows, while the file bytes live as immutable 4 MB content-addressed blocks in Magic Pocket, Dropbox's own exabyte-scale blob store on custom SMR storage machines in three North American zones. Hard because metadata must be strongly consistent and transactional at tens of millions of queries per second while the block plane must be twelve-nines durable at exabyte scale on cheap spinning disks, and because clients are intermittently connected and concurrently edit the same tree.

## Scale (only if stated)
- Files and revisions: "Dropbox has hundreds of billions of files, trillions of file revisions, and exabytes of customer data" (https://dropbox.tech/infrastructure/rewriting-the-heart-of-our-sync-engine)
- Devices: "Users access their files across hundreds of millions of devices" (rewriting-the-heart-of-our-sync-engine)
- Block store size: 500 PB of user data in 2016, "over 12x growth" since 2012; multi-exabyte by 2022 (https://dropbox.tech/infrastructure/magic-pocket-infrastructure; https://qconsf.com/presentation/oct2022/magic-pocket-dropboxs-exabyte-scale-blob-storage-system)
- Magic Pocket share: "storing and serving over 90% of our users' data" as of March 2016 (magic-pocket-infrastructure)
- Storage machine: ~100 LFF disks per chassis, 14 TB SMR drives, 1.4 PB per chassis in 2018, "2.29 times more blocks than a chassis in our previous architecture"; over 2 PB per OSD by 2022 (https://dropbox.tech/infrastructure/extending-magic-pocket-innovation-with-the-first-petabyte-scale-smr-drive-deployment; https://www.infoq.com/articles/dropbox-magic-pocket-exabyte-storage/)
- Cell: self-contained cluster of roughly 50 PB raw, limit around 100 PB (https://dropbox.tech/infrastructure/inside-the-magic-pocket; over 100 PB per the QCon write-up)
- Repairs: "hundreds of hardware failures per day" identified and repaired automatically (qconsf.com talk abstract)
- Edgestore: "several trillion entries", "thousands of machines across multiple data centers", "millions of queries per second with 5–9s of availability" (https://dropbox.tech/infrastructure/reintroducing-edgestore); 10M requests/sec, 5–10% of transactions cross shards, 95% of reads absorbed by the cache (https://dropbox.tech/infrastructure/cross-shard-transactions-at-10-million-requests-per-second)
- Panda: "thousands of servers, store petabytes of data on SSDs, and serve tens of millions of queries per second with single-digit millisecond latency"; Edgestore and Filesystem clusters "more than 10,000 cores each" (https://dropbox.tech/infrastructure/panda-metadata-stack-petabyte-scale-transactional-key-value-store)
- Alki: "roughly 350 TB worth of user data (pre-replication and not counting indexes), at about 1/6 the cost of Edgestore per GB per year" (https://dropbox.tech/infrastructure/alki--or-how-we-learned-to-stop-worrying-and-love-cold-metadata)
- Edge: 20 points of presence as of 2018 (https://dropbox.tech/infrastructure/dropbox-traffic-infrastructure-edge-network)
- Sync latency: streaming sync gave "up-to-2x improvement on multi-client sync time", about 25% in real-world tests; 500 MB file 293 s vs 383 s (https://dropbox.tech/infrastructure/streaming-file-synchronization)

## Requirements stated or clearly implied
- Availability target: "availability of over 99.99%" for Magic Pocket (magic-pocket-infrastructure, SMR post); Edgestore "5–9s of availability" (reintroducing-edgestore)
- Consistency: metadata strongly consistent and transactional — Edgestore "provides strong-consistency by default, which requires invalidating caches on writes. If the workload can tolerate stale reads, clients can request eventual consistency"; Panda gives "global ACID transactions" via two-phase commit and hybrid-logical clocks; the client protocol adds "strong consistency checks between the client's and server's view". Blocks are immutable and content-addressed, so the block plane needs no mutation consistency: mutability is "handled by the FileJournal system layer above Magic Pocket"
- Durability target: "annual data durability of over 99.9999999999%" (twelve nines) (magic-pocket-infrastructure, SMR post); "over 12 9s of durability" (QCon write-up)
- Latency target: Panda "single-digit millisecond latency"; Magic Pocket is "a fairly 'cold' storage system but with the requirement of low-latency reads for all blocks"; sync latency not otherwise quantified
- Ordering needs: per-namespace monotonic journal ordering in the Server File Journal, with the client resuming from a stored cursor; Panda uses hybrid-logical clocks for cross-range ordering
- Replay or reprocessing needs: the client's `list` from its stored cursor is the reconciliation path and is always safe to repeat
- Retention: trillions of file revisions retained; audit-log style cold metadata "written and retained for many years" (alki)
- Compliance / residency: blocks are compressed and encrypted before storage; Magic Pocket operates in three North American regions; nothing further stated

## Boundaries
- Regions / zones: three zones in three North American geographic regions (US West, Central, East); every block independently stored in at least two zones and replicated within each zone
- Cells: self-contained clusters inside a zone, roughly 50–100 PB, striped across racks "for physical diversity"; multiple cells give failure isolation and easier deployment
- Trust zones: desktop, mobile and web clients (untrusted, public internet) -> PoP edge (TLS terminated at the PoP) -> Dropbox backbone -> data-center services (metaserver, blockserver, Bandaid) -> metadata plane and Magic Pocket cells (internal only)
- Named subsystems: Edge (GSLB, IPVS, nginx PoPs, Bandaid), Sync (Nucleus client, metaserver, notification server), Metadata plane (Server File Journal / Filesystem, Edgestore, Panda, Alki), Block plane (Magic Pocket: frontends, Block Index, Replication Table, Master, Volume Managers, OSDs, cross-zone replication, cold tier)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Desktop client / Nucleus | Watches the filesystem, maintains Remote, Local and Synced trees, plans and schedules sync work, uploads and downloads blocks | Nucleus (Rust) | client | offlineCapable: true; singleThreadedControlLoop: true; deterministic: true; language: rust |
| 2 | Mobile and web clients | Same namespaces reached through the public API and dropbox.com | not stated | client | |
| 3 | GSLB / GeoDNS | Maps each user to the closest PoP "unless it is over capacity or under maintenance" | in-house GeoDNS | dns | routing: geo; mapping: continent -> country -> per-state for large countries |
| 4 | IPVS load balancer (PoP) | "IPVS acts as our dataplane—a kernel-level loadbalancer with netlink API" spreading packets across nginx boxes | IPVS (Linux) | load-balancer | layer: 4; hashing: consistent; encapsulation: true |
| 5 | nginx edge proxy (PoP) | Terminates TLS, HTTP/2 and gRPC at the PoP and holds keep-alive connections to the data centers over the backbone | nginx, BoringSSL | load-balancer | layer: 7; tlsTermination: true; ciphers: AEAD ChaCha20/Poly1305; keepAliveToOrigin: true; pops: 20 |
| 6 | Bandaid | In-datacenter L7 service proxy: request handler, queues, worker goroutines, per-upstream routing and retries | Bandaid (Go, in-house) | load-balancer | layer: 7; algorithms: round-robin, least-N-random-choices, absolute-least-connections, pinning-peer; retryExcludesTriedHosts: true |
| 7 | Metaserver | Commits blocklists, checks permissions, answers "need blocks", serves `list` of journal rows from the client's cursor | in-house | app-server | stateless: true |
| 8 | Server File Journal (SFJ) / Filesystem | Append-only per-namespace log of file versions; row = namespace id, path, blocklist, journal id | MySQL-backed, later on Panda | sql-database | appendOnly: true; ordering: per-namespace; sharded: true; cursor: journal id |
| 9 | Notification server | Holds idle clients' long-poll connections and pushes a per-namespace change hint | in-house | realtime-gateway | transport: http-longpoll; payload: hint-only |
| 10 | Memcache (streaming sync) | Holds uncommitted file state so a downloader can start before the uploader commits; "Writes to memcache occur on failed calls to commit" and "Reads from memcache occur on list" | memcached | cache | holdsUncommittedState: true |
| 11 | Edgestore | Strongly consistent transactional store for non-file metadata; "Objects in Edgestore can be Entities or Associations, each of which can have user-defined attributes" | Edgestore over sharded MySQL | nosql-database (graph-database also fits the entity/association model) | consistency: strong by default, eventual opt-in; sharded: true; rps: 10000000; entries: several trillion; cacheHitShare: 0.95 |
| 12 | Edgestore Cores | "a stateless layer responsible for routing (or forwarding) the request to the correct 'shard' (or region)" | in-house | app-server | stateless: true |
| 13 | Edgestore Engines | "translate Edgestore APIs to MySQL commands and track resource consumption by traffic-source" | in-house | database-proxy | perTenantAccounting: true |
| 14 | Edgestore caching layer | Cache in front of the shards; "The caches are also partitioned and replicated for high-availability" and invalidated on write | not stated | cache | partitioned: true; replicated: true; invalidateOnWrite: true |
| 15 | Edgestore transaction record | External durable record that is "a source of truth about the state of a transaction" across phases 0, 1, 2a, 2b | Edgestore object | coordination-service | protocol: two-phase-commit; crossShardShare: 0.05–0.10 |
| 16 | MySQL shards | Physical metadata storage on SSD, with copy-on-write staging tables for in-flight transactions | MySQL | sql-database | storage: ssd; stagingTables: copy-on-write; writeAmplificationReduction: up to 95% |
| 17 | Panda frontend nodes | "entry point to the system... responsible for routing requests to the appropriate storage nodes and act as the coordinator for two-phase commits" | Panda (in-house) | app-server | stateless: true; role: 2pc-coordinator |
| 18 | Panda storage nodes | "responsible for interfacing with the storage engine—in our case, MySQL—to actually serve reads and writes" | Panda over MySQL | nosql-database | partitioning: range; rangeSizeGB: ~100; mvcc: true; clocks: hybrid-logical; qps: tens of millions |
| 19 | Panda control plane (Registry, Keeper, storage control) | Registry is "the source of truth for range metadata in the system"; Keeper coordinates "range transfers to rebalance data"; storage control executes transfers | in-house | coordination-service | rebalancing: range transfer, split, merge; unavailabilityDuringTransfer: seconds |
| 20 | Alki hot tier | Recent cold-class metadata (audit events) taking high volumes of random reads and writes | Amazon DynamoDB | nosql-database | tier: hot |
| 21 | Alki cold tier | Batched blobs of aged metadata with "a sparse mapping of 1 key for every blob" | Amazon S3 | object-store | tier: cold; index: sparse; sizeTB: 350; costRatioVsEdgestore: 1/6 |
| 22 | Alki orchestration | Moves records from the hot tier into cold blobs on a schedule | AWS Step Functions + Blackbird (in-house batch) | workflow-engine | batch: true |
| 23 | Blockserver / Magic Pocket frontend | Gateway for block put and get: checks the Block Index, picks the target volume, issues store and fetch commands to OSDs, retries another volume on failure | in-house | app-server | stateless: true; caches: cell capacity and open volumes |
| 24 | Block Index | Sharded MySQL cluster mapping `hash -> cell, bucket, checksum` | MySQL | sql-database | sharded: true; shardingKey: block hash (SHA-256) |
| 25 | Replication Table | Per-cell index mapping `bucket -> volume` and `volume -> OSDs, open, type, generation` | MySQL | sql-database | memoryResident: true; scope: per-cell; commitPoint: true |
| 26 | Master (per cell) | Soft-state coordinator: watches OSD health, triggers repairs after 15 minutes offline, creates buckets, garbage collects, merges buckets | in-house | coordination-service | softState: true; scope: per-cell; consensus: none (deliberately) |
| 27 | Volume Manager | Executes Master-directed work — moving volumes, erasure coding, reconstruction — and runs on OSD hardware to "amortize their heavy network-capacity demands" | in-house | worker | colocatedWithOsd: true |
| 28 | OSD (Object Storage Device) | "Dumb" storage node holding blocks and managing its own caching, disk scheduling and validation; no filesystem, the daemon "directly manages data layout on the drive" | in-house on SMR spinning disks | object-store | capacityPB: 1–2+; disksPerHost: ~100; diskTB: 14 (2018 SMR); ramGB: 96; volumesPerOsd: several thousand; extentGB: 1; blockMB: 4; erasureCoding: Reed-Solomon 6+3, LRC 1.33x |
| 29 | Cross-zone replication daemon | Asynchronously replicates every put to a remote zone "within one second" | in-house | worker | async: true; targetLagSeconds: 1; zones: >=2 |
| 30 | Cold storage tier (Magic Pocket) | Blob splitting with XOR across zones, cutting the replication factor from 2x to 1.5x for "25% savings" | in-house, "inspired by" Facebook f4 | object-store | tier: cold; replicationFactor: 1.5 |
| 31 | Amazon S3 (legacy block store) | Prior home of user blocks; 90% migrated off by 7 October 2015 | AWS S3 | object-store | status: retired for the bulk of user data |
| 32 | CanopyCheck / Trinity | Randomized planner testing and deterministic whole-client simulation | in-house | not an architecture node (test infrastructure) | deterministicReplay: true; "millions of scenarios every day" |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| client | gslb | dns | sync | | nearest PoP unless over capacity or in maintenance |
| client | ipvs (pop) | tcp/tls | sync | | consistent hashing plus packet encapsulation |
| ipvs | nginx (pop) | tcp | sync | | L4 to L7 handoff inside the PoP |
| nginx (pop) | bandaid | http/2 over backbone | sync | | long-lived keep-alive connections over the dark-fibre backbone |
| bandaid | metaserver | http | sync | | URL-pattern routing into per-upstream queues; retries exclude already-tried backends |
| bandaid | blockserver | http | sync | | |
| client | metaserver | https (commit) | sync | | sends the file's blocklist; idempotent by content hash |
| metaserver | client | https ("need blocks") | sync | | response names the hashes the server is missing |
| client | blockserver | https (put) | sync | | 4 MB SHA-256 blocks, batched up to about 8 MB per request |
| client | blockserver | https (retrieve_batch) | sync | | batched block download while reconstructing a file |
| metaserver | sfj | mysql | sync | | appends one version row per namespace with a monotonic journal id |
| metaserver | memcache | memcached | sync | | write on failed commit, read on list — the streaming-sync path |
| metaserver | edgestore | edgestore rpc | sync | strong by default | users, namespaces, sharing metadata |
| metaserver | notification-server | internal rpc | async | best-effort | per-namespace change hint |
| notification-server | client | http long-poll | async | at-most-once, hint only | client then issues `list`; a lost hint costs latency, not correctness |
| client | metaserver | https (list from cursor) | sync | | returns new SFJ rows; the reconciliation path |
| edgestore-core | edgestore-cache | internal | sync | | absorbs 95% of reads; invalidated on write |
| edgestore-core | edgestore-engine | internal rpc | sync | | routes to the owning shard or region |
| edgestore-engine | mysql shard | mysql | sync | | copy-on-write staging tables for in-flight transactions |
| edgestore-core | transaction-record | edgestore write | sync | durable before phase 1 | phase 0 of the modified two-phase commit |
| edgestore-core | participant shards | internal rpc | sync | 2PC | phase 1 stages the commit, phase 2b applies it |
| edgestore-engine | panda-frontend | panda rpc | sync | ACID | Panda "sits between Edgestore and our sharded MySQL" |
| panda-frontend | panda-registry | internal rpc | sync | | range metadata lookup; Registry is the source of truth |
| panda-frontend | panda-storage-node | internal rpc | sync | 2PC with hybrid-logical clocks; MVCC reads take no read-locks | routed by key range of about 100 GB |
| panda-storage-node | mysql | mysql | sync | | MySQL used only as the storage engine |
| panda-keeper | panda-storage-node | internal rpc | async | | range transfers, splits and merges to rebalance |
| edgestore | alki-hot (dynamodb) | aws api | sync | | cold-class metadata is written here first |
| alki-orchestration | alki-cold (s3) | aws api | async | batch | many records per blob, sparse index of one key per blob |
| blockserver | block-index | mysql | sync | | existence check by hash before any store |
| blockserver | replication-table | mysql | sync | | bucket -> volume -> OSD set lookup |
| blockserver | osd | internal | sync | OSDs fsync before responding | store to every OSD in the volume; on failure retry a different volume or cell |
| blockserver | block-index | mysql | sync | commit point for a put | index entry written only after the OSDs acknowledge |
| osd | cross-zone-replicator | internal | async | at-least-once | |
| cross-zone-replicator | osd (remote zone) | internal | async | within about 1 s | every block lands in at least two zones |
| master | osd | internal | async | | health watch via service discovery; repair plans |
| master | volume-manager | internal rpc | async | | move volume, erasure-code, reconstruct |
| volume-manager | osd (hundreds) | internal | async | | reconstruction reads fan out across hundreds of OSDs |
| master | replication-table | mysql | sync | commit point for a repair | generation bump on destination OSDs, then the mapping update |
| blockserver | volume-manager | internal rpc | sync | | on-read reconstruction when an OSD of an erasure-coded volume is unavailable |

## Failure modes, incidents, tradeoffs the source discusses
- Consensus deliberately rejected in the block plane: "The primary design principle here is keep it simple!" The Master is soft state, and "The cell can continue to serve reads if the Master is down" — writes survive temporarily too. Source: https://dropbox.tech/infrastructure/inside-the-magic-pocket
- Retry instead of quorum on writes: "If we adopted a quorum-based protocol... we would avoid some of these retries and potentially achieve lower tail latency but at the expense of greater complexity." Source: inside-the-magic-pocket
- Repair is deliberately delayed: the Master acts only "once an OSD has been offline for 15 minutes, long enough to restart a node without triggering unnecessary repairs". Source: inside-the-magic-pocket
- Repair has an explicit commit point: the generation number is bumped on the destination OSDs and only then is the Replication Table updated, so a Master that dies mid-repair leaves no ambiguity; a background reconcile rolls back failed repairs, and generation numbers prevent confusion if a failed OSD comes back. Source: inside-the-magic-pocket
- Open versus closed volumes isolate background work from live writes: the split means "live traffic doesn't interfere with background operations, and allows us to use far simpler consistency protocols", and a closed volume is immutable so it "may be safely moved". Source: inside-the-magic-pocket
- Reconstruction fan-in: losing one OSD rebuilds from "hundreds of other OSDs" at once, so recovery bandwidth rather than disk count is the constraint. Source: inside-the-magic-pocket
- Boring technology for the index, on purpose: "Key-value stores are fashionable and offer high performance, but databases are highly reliable" — MySQL kept for the Block Index. Source: inside-the-magic-pocket
- Cold-but-low-latency is the shaping constraint: "We have a fairly 'cold' storage system but with the requirement of low-latency reads for all blocks", which is why spinning media rather than SSD or tape, and why erasure-coded volumes are laid out so "each block can be read in entirety from a single given OSD, so most reads only hit a single disk spindle". Source: inside-the-magic-pocket
- Immutability pushes mutation up a layer: blocks never change after write, and mutability is "handled by the FileJournal system layer above Magic Pocket", which "makes our lives a lot easier". Source: inside-the-magic-pocket
- Leaving S3 was about control and unit economics, not a fault: "Bringing storage in-house allows us to customize the entire stack end-to-end and improve performance for our particular use case"; Dropbox still says it "couldn't have grown as fast as we did without a service like AWS" and will "partner with Amazon where it makes sense for our users, particularly globally". The migration ran dark launch (August 2014) -> live launch (February 2015) -> "BASE Jump" (April 2015) and hit the 90% target "almost a month early, on October 7, 2015" with "no major service disruptions or any loss of data". Source: https://dropbox.tech/infrastructure/magic-pocket-infrastructure
- Two-phase sync was the latency defect in the old protocol: before streaming sync the downloader could not start until the uploader had uploaded every block and committed to the SFJ. Streaming sync keeps the downloader roughly one blockserver call behind by parking uncommitted state in memcache, read on `list`, worth "up-to-2x improvement on multi-client sync time" and about 25% in the field. Source: https://dropbox.tech/infrastructure/streaming-file-synchronization
- Notifications are hints, not data: the notification server only tells an idle client that its namespace changed; the client always reconciles with `list` from its stored cursor, so a dropped notification costs latency, never correctness. Source: streaming-file-synchronization
- The old sync engine's data model was the root cause of the rewrite: "Sync Engine Classic was deeply unhealthy"; "The data model was designed for a simpler world without sharing, and files lacked a stable identifier that would be preserved across moves. There were few consistency guarantees, and we'd spend hours debugging issues where something theoretically possible but 'extremely unlikely' would show up in production." Source: https://dropbox.tech/infrastructure/rewriting-the-heart-of-our-sync-engine
- A concrete data-loss shape from that model: "Sync Engine Classic represents moves as pairs of deletes at the old location and adds at the new location", which loses data under particular network failures. Nucleus answers with globally unique ids for files and folders, clients that "never observe them in transiently duplicated or missing states", and "folders and files support atomic moves independent of their subtree size". Source: rewriting-the-heart-of-our-sync-engine
- The rewrite was taken on with eyes open: the post quotes the standard warning that rewriting from scratch is the "single worst strategic mistake that any software company can make", and notes "Successfully pulling off a rewrite often requires slowing feature development, since progress made on the old system needs to be ported over to the new one." Source: rewriting-the-heart-of-our-sync-engine
- Determinism as a reliability strategy: almost all Nucleus code runs on a single "Control thread", with network IO on an event loop, hashing on a thread pool and filesystem IO on a dedicated thread; that thread "is designed to be entirely deterministic when its inputs and scheduling decisions are fixed", so simulated failures are replayable — "We can always reproduce the bug from the original seed" and "We run millions of scenarios every day in our testing infrastructure". Source: rewriting-the-heart-of-our-sync-engine and https://dropbox.tech/infrastructure/-testing-our-new-sync-engine
- Three trees instead of a work queue: Sync Engine Classic "persists the outstanding work required to sync each file or folder to disk. By comparison, Nucleus persists observations" as a Remote Tree, a Local Tree and a Synced Tree, where the Synced Tree is the merge base that answers "did the user edit the file locally or was it edited on dropbox.com?". The stated system goal is "to converge all three trees to the same state". Source: -testing-our-new-sync-engine
- Concurrent moves can build cycles: CanopyCheck found the "Archives/Drafts/January directory cycle bug" where "applying a local move and a remote move together created a cycle" — a correctness class the old queue-of-operations design could not even express. The design principle drawn from it is "Design away invalid system states". Source: -testing-our-new-sync-engine
- Strong consistency has a cache cost: Edgestore "provides strong-consistency by default, which requires invalidating caches on writes. If the workload can tolerate stale reads, clients can request eventual consistency." Source: https://dropbox.tech/infrastructure/reintroducing-edgestore
- Cross-shard commits need an external source of truth: Edgestore's two-phase commit adds "an external transaction record to serve as a source of truth about the state of a transaction", so recovery never has to contact every participant — "any parallel operation can abort a transaction at any time up until the transaction record leaves its pending state". Copy-on-write staging tables "reduced write amplification by up to 95%", and only 5–10% of transactions span shards. Source: https://dropbox.tech/infrastructure/cross-shard-transactions-at-10-million-requests-per-second
- Fixed sharding hit a wall: "By 2019, with another split of Edgestore looming, it was clear this strategy would come with a significant cost. We also faced a looming crisis: that an outlier shard could outgrow the capacity of a single machine." Panda's answer is roughly 100 GB key ranges that split, merge and transfer, with "the critical section of a transfer, where the range is unavailable or read-only, to a minimum" — in practice "ranges with hundreds of gigabytes of data with only seconds of unavailability". Source: https://dropbox.tech/infrastructure/panda-metadata-stack-petabyte-scale-transactional-key-value-store
- The same doubling problem from the cost side: "when one cluster hits 80% disk space and needs to be split, most other clusters will also need to be split", so "capacity expansion most often occurs by splitting the entire fleet, doubling the physical cost of Edgestore each time". Alki's answer is to stop "trying to find a single system good at both" hot and cold access and split the tiers instead. Source: https://dropbox.tech/infrastructure/alki--or-how-we-learned-to-stop-worrying-and-love-cold-metadata
- Verification is a release gate, not an afterthought: new Panda versions "continue to verify the data by validating a random sample of real user traffic, checking the same invariants", and Magic Pocket ships on a four-week cycle with roughly a week of full data verification per zone stage. Source: panda post; QCon SF 2022 talk write-up
- Erasure-coding choices are cost-driven: Reed-Solomon "6 plus 3" volume groups, with local reconstruction codes reaching "1.33x compared to Reed Solomon's 1.5x replication factor", and a cold tier that splits blobs and XORs across zones to fall from 2x to 1.5x for "25% savings". Source: https://www.infoq.com/articles/dropbox-magic-pocket-exabyte-storage/ (QCon SF 2022 talk by the Magic Pocket tech lead)
- Denser hardware moves the bottleneck: the SMR chassis stores "2.29 times more blocks than a chassis in our previous architecture", which forced per-host RAM up to 96 GB for the on-host block index and an IO floor "above 40Gbps for writes and 45Gbps for reads" so repair and verification traffic still fits. Source: https://dropbox.tech/infrastructure/extending-magic-pocket-innovation-with-the-first-petabyte-scale-smr-drive-deployment
- Edge failure handling is capacity-aware routing rather than failover logic: GSLB sends each user to the closest PoP "unless it is over capacity or under maintenance", and Bandaid supports "exclusion of backends that were previously tried during retry attempts". Sources: https://dropbox.tech/infrastructure/dropbox-traffic-infrastructure-edge-network and https://dropbox.tech/infrastructure/meet-bandaid-the-dropbox-service-proxy

## Unknowns
- How the Server File Journal is sharded today, and how much of it has moved onto Panda (the Panda post names "Edgestore and Filesystem" clusters but does not spell out the SFJ mapping)
- Nucleus's conflict-resolution rules in detail — what the planner does for a concurrent edit of the same file, beyond the tree-convergence goal and the move-cycle example
- Whether the notification transport is still HTTP long-poll on modern clients
- Per-request latency budgets for commit, list and block put/get
- Version-history retention period for ordinary files
- Current PoP count and whether nginx is still the edge L7 proxy (figures are from 2018)
- Whether the streaming-sync memcache path survived the Nucleus rewrite
- Block encryption key management — blocks are stated to be encrypted, but the key hierarchy is not described in these posts
- Number of cells per zone and current per-zone capacity

## Candidates
- New kinds: none required — every box maps onto an existing catalogue kind. Two near-misses worth recording: the per-cell Master and the Panda Registry/Keeper are *soft-state control planes* rather than quorum services, which `coordination-service` covers only loosely; and Nucleus is a stateful reconciling `client`, which the `client` kind treats as a leaf node.
- New properties on existing kinds: object-store.durabilityNines (integer); object-store.erasureCoding (none, reed-solomon, lrc); object-store.replicationFactor (number); object-store.crossZoneReplicationSeconds (integer); object-store.contentAddressed (boolean); object-store.tier (hot, warm, cold); sql-database.appendOnly (boolean); sql-database.memoryResident (boolean); nosql-database.partitioning (hash, range); nosql-database.rangeSizeGB (integer); nosql-database.transactions (none, single-shard, cross-shard-2pc); cache.holdsUncommittedState (boolean); cache.invalidateOnWrite (boolean); coordination-service.softState (boolean); client.reconcilesFromCursor (boolean); load-balancer.layer (4, 7)
- New edge properties: hintOnly (boolean — delivery may be lost without correctness loss); contentAddressed (boolean); commitPoint (boolean — the edge whose success defines the transaction's commit); fsyncBeforeAck (boolean); retryOnAlternateTarget (boolean)
- New requirement paths: durability.annualNines (integer); availability.zones (integer); storage.immutableBlobs (boolean); consistency.crossShardTransactions (boolean)
- New rules (name + one-line condition):
  - notification-without-reconcile-path: a realtime-gateway edge to a client marked hintOnly with no pull/list edge from that client back to the source of truth
  - blob-store-single-zone-with-durability-target: object-store present in exactly one zone while durability.annualNines >= 11
  - metadata-and-blob-in-same-store: file bytes and file metadata resolve to the same datastore node — the split these sources make explicitly
  - mutable-blob-store: object-store written more than once per key while a journal or version store exists above it (Magic Pocket's immutability invariant)
  - soft-state-coordinator-without-durable-table: coordination-service holding placement authority with no persistent table (Replication Table, Registry) recording the commit point
  - fixed-shard-count-at-capacity-risk: sql-database or nosql-database with sharded true and no range split/transfer capability while data growth is a stated requirement
  - cross-shard-2pc-without-transaction-record: cross-shard transaction protocol with no external durable record of transaction state
  - repair-without-delay-window: replicated object-store whose repair trigger has no offline grace period (the 15-minute rule)
  - strong-consistency-cache-without-invalidation: cache in front of a strongly consistent store with no invalidate-on-write edge
