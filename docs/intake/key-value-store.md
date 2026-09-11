# Intake: Distributed key-value store (Xu vol 1 ch 6, Dynamo lineage) with Amazon DynamoDB production design

## Source
- Primary: Alex Xu, System Design Interview vol 1, chapter 6 "Design a key-value store" (Dynamo/Cassandra derived); chapter notes via search summaries (trunin.com returned 503 in this pass)
- Primary: Dynamo paper (Amazon, SOSP 2007) as summarised in the amazon-order card (consistent hashing, N/R/W, vector clocks, sloppy quorum, hinted handoff, Merkle trees, gossip)
- Primary: Amazon DynamoDB paper (USENIX ATC 2022) https://www.amazon.science/publications/amazon-dynamodb-a-scalable-predictably-performant-and-fully-managed-nosql-database-service (abstract page; PDF 403 in this pass)
- Cross-references: discord-messages (Cassandra/ScyllaDB partitions and tombstones), instagram-feed (Cassandra quorum across oceans), figma-multiplayer (DynamoDB journal and lock), amazon-order (Dynamo cart)
- Verified by: canonical textbook chapter + two Amazon papers
- Confidence: high
- Date of source: 2007, 2020, 2022

## System in three lines
A partitioned, replicated key-value store that stays available under node and network failures: keys map to nodes on a consistent-hash ring with virtual nodes, each key is replicated to N nodes, writes need W acknowledgements and reads R with W+R greater than N for overlap, conflicts are detected with vector clocks and resolved by the client, temporary failures use sloppy quorum with hinted handoff, permanent ones are repaired by Merkle-tree anti-entropy, and membership spreads by gossip. Each node writes a commit log, a memtable and flushes SSTables with bloom filters. DynamoDB keeps the partition idea but adds Paxos replication groups, request routers, a metadata service, adaptive capacity and global admission control to deliver predictable single-digit-millisecond latency as a managed service.

## Scale (only if stated)
- Users / DAU: not stated
- Requests per second: DynamoDB peaked at "89.2 million requests per second" during Prime Day 2021 (paper); 151M rps on Prime Day 2025 (amazon-order card)
- Data volume: not stated
- Message throughput: none
- Book assumptions: small key-value pairs (under 10 KB), high availability, scalable, tunable consistency, low latency

## Requirements stated or clearly implied
- Availability target: AP by default (Dynamo, book); DynamoDB 99.999% with "single-digit millisecond performance" and static stability under dependency failure
- Consistency: tunable via N, W, R; W=1 fast writes, R=1 fast reads, W+R>N strong reads; eventual otherwise; DynamoDB offers eventually consistent and strongly consistent reads via Paxos leader
- Latency target: low, single-digit ms for DynamoDB
- Ordering needs: per-key versioning with vector clocks or last-writer-wins
- Replay or reprocessing: commit log replay on restart; hinted handoff replay; anti-entropy sync
- Retention: keys until deleted; tombstones for deletes (see discord card)
- Compliance / residency: DynamoDB multi-AZ, global tables optional
- Predictability: DynamoDB explicitly targets predictable performance over raw speed

## Boundaries
- Regions / zones: replicas spread across data centers (book); DynamoDB replication groups across three AZs; global tables cross-region
- Trust zones: clients -> coordinator/request router -> storage nodes; metadata service internal
- Named subsystems: Coordinator, Ring and membership (gossip), Replication and quorum, Conflict resolution, Failure handling (sloppy quorum, hinted handoff, Merkle anti-entropy), Node storage engine (commit log, memtable, SSTable, bloom filter); DynamoDB: request routers, storage nodes, partitions, Paxos groups, metadata service and MemDS, auto admin, admission control

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Clients | get(key), put(key, value) | any | sdk-client | |
| 2 | Coordinator / request router | Proxy that finds owning nodes and runs quorum reads/writes | in-house | database-proxy | |
| 3 | Consistent hash ring | Virtual nodes for even distribution and incremental scaling | in-house | property of nosql-database | virtualNodes: true |
| 4 | Storage nodes | Own key ranges; replicate to N successors | in-house | nosql-database (node) | replicationFactor: N |
| 5 | Commit log | Durable append before memtable | local disk | property (WAL) | |
| 6 | Memtable | In-memory sorted structure | in-house | property | |
| 7 | SSTables + bloom filters | Immutable on-disk files, compaction; bloom filter avoids misses | in-house | property | |
| 8 | Gossip membership | Heartbeat counters propagated to random peers; failure detection by agreement | in-house | coordination-service (decentralised) | protocol: gossip |
| 9 | Hinted handoff | Temporary replica holds writes for down node | in-house | property | |
| 10 | Merkle anti-entropy | Compare hash trees to sync divergent replicas | in-house | worker (repair) | |
| 11 | Vector clocks | Version vectors to detect concurrent writes | in-house | property | conflictResolution: vector-clock |
| 12 | DynamoDB request routers | Authenticate, authorise, route to partition leader | AWS | database-proxy | |
| 13 | DynamoDB partitions + Paxos groups | Leader-based replication, WAL, log replicas | AWS | nosql-database | replication: paxos |
| 14 | Metadata service + MemDS | Partition map cached with in-memory replicas after 2015 lesson | AWS | coordination-service + cache | |
| 15 | Auto admin + admission control | Splits partitions, adaptive capacity, global admission control | AWS | control-plane-coordinator | |
| 16 | Backups / point-in-time | Durability beyond replicas | AWS | object-store | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | coordinator | rpc | sync | | |
| coordinator | N replica nodes | rpc | sync | W acks | write quorum |
| coordinator | N replica nodes | rpc | sync | R responses | read quorum, version reconcile |
| node | commit log | local | sync | | |
| commit log | memtable | local | sync | | |
| memtable | sstable | flush | async | | threshold |
| node | node | gossip | async | | membership |
| coordinator | temporary node | rpc | sync | | sloppy quorum with hint |
| temporary node | recovered node | handoff | async | | |
| node | node | merkle compare | async | | repair |
| client | dynamodb request router | https | sync | | |
| request router | partition leader | rpc | sync | | |
| leader | paxos replicas | replication | sync | quorum | WAL |
| router | metadata (memds) | read | sync | | cached map |
| auto admin | partitions | control | async | | split, rebalance |
| partitions | backups | async | async | | |

## Failure modes, incidents, tradeoffs the source discusses
- CAP: partitions happen, so choose availability (AP) or consistency (CP); Dynamo/book pick AP for the cart-style workload. Source: book, Dynamo.
- Quorum tuning: W=1 or R=1 for speed, W+R>N for strong reads. Source: book.
- Concurrent writes leave siblings; vector clocks grow and need truncation; client resolves. Source: book, Dynamo.
- Sloppy quorum trades durability certainty for availability; hinted handoff replays later. Source: book.
- Merkle trees bound repair traffic to divergent ranges. Source: book.
- Gossip avoids all-to-all heartbeats and a single failure detector. Source: book.
- LSM engine: writes are sequential (commit log, memtable, SSTable); reads may touch several SSTables, bloom filters mitigate. Source: book.
- Predictability as the product: DynamoDB's admission control and adaptive capacity exist because "even the slightest disruption can significantly impact customers" (2015 metadata outage). Source: DynamoDB paper abstract.
- Production incidents in linked cards: Discord tombstone scans and hot partitions; Instagram cross-ocean quorum; Figma DynamoDB conditional write for single writer.

## Unknowns
- Book's data center outage handling details
- DynamoDB partition split heuristics and MemDS internals (PDF not readable)
- Compaction strategies and their latency effects

## Candidates
- New kinds: none; sightings: nosql-database (24th), database-proxy (13th: coordinator/request router), coordination-service (14th: gossip, metadata), control-plane-coordinator (9th: auto admin), object-store (19th: backups), worker (20th: repair)
- New properties on existing kinds: nosql-database.quorum (n,r,w) (2nd sighting), conflictResolution (2nd), hintedHandoff (2nd), antiEntropy (2nd), membership (gossip, coordinator), storageEngine lsm, virtualNodes (boolean), admissionControl (boolean), predictableLatency (boolean)
- New edge properties: quorum (string like 2-of-3); replicatedSync (boolean)
- New requirement paths: consistency.readAfterWrite (2nd sighting); consistency.tunable (boolean); availability.staticStability (boolean)
- New rules:
  - quorum-overlap-violation: nosql-database with r + w not greater than n while consistency.readAfterWrite true
  - no-conflict-resolution-on-multi-writer-kv: nosql-database with multiWriter or sloppy quorum and conflictResolution unset (2nd sighting of multi-leader theme)
  - single-failure-detector: cluster membership via one coordinator node with no gossip or replicated coordination
  - lsm-store-without-compaction-or-bloom: nosql-database storageEngine lsm with no bloom filter or compaction declared (informational)
  - managed-kv-without-admission-control-under-bursts: nosql-database admissionControl false while traffic.peakMultiplier high (informational)
