# Intake: Digital wallet (Xu vol 2 ch 11) with Uber LedgerStore

## Source
- Primary: Alex Xu and Sahn Lam, System Design Interview vol 2, chapter 11 (chapter 12 in the 2nd edition) "Digital Wallet"; author's page https://blog.bytebytego.com/p/digital-wallet (404 in this pass); chapter content confirmed by search summaries of https://lastminutelecture.com/books/system-design-interview-an-insider-s-guide-volume-2-2nd-edition/chapters/digital-wallet-system-design-overview/ (403 on fetch) and Devin Z book notes (Medium 403): 1M TPS, Redis sharding with ZooKeeper, 2PC, TC/C, Saga, event sourcing, CQRS, Raft replicated log, mmap and snapshots
- Primary: https://www.uber.com/us/en/blog/migrating-from-dynamodb-to-ledgerstore/ (official Uber, 2024: trillion entries, petabytes, shadow and offline validation, backfill with AIMD rate control) and https://www.uber.com/en-GB/blog/how-ledgerstore-supports-trillions-of-indexes/ (official Uber: strongly consistent indexes via 2PC intents, eventually consistent via materialised views, time-range indexes, sealing, 2T indexes, $6M/year saved)
- Cross-references: payment-system (money orders, double-entry, hot-account batching), stripe-payments (Ledger), key-value-store (Raft, snapshots), distributed-message-queue (replicated log), hotel-reservation (TC/C style compensation)
- Verified by: canonical textbook chapter (multiple consistent summaries) + two official Uber posts
- Confidence: high (book design) / high (Uber LedgerStore)
- Date of source: 2022-2024

## System in three lines
Holds account balances and moves money between them at a million transfers per second with provable correctness: the naive design shards balances across in-memory stores with a coordinator holding the shard map, but a transfer touches two shards, so the chapter walks through two-phase commit, try-confirm-cancel and Saga, then lands on event sourcing where every command becomes an immutable event appended to a per-shard Raft-replicated log from which balances are derived and can be reproduced. Uber's LedgerStore is the production version of the log side: an append-only ledger with cryptographically sealed time ranges, strongly consistent indexes written with two-phase intents, eventually consistent indexes as materialised views, and tiering of sealed ranges to cold storage. Hard because balances must never be lost or double-spent under partition, a cross-shard transfer is a distributed transaction, and auditors must be able to replay history to any past state.

## Scale (only if stated)
- Users / DAU: not stated
- Requests per second: book 1,000,000 TPS; each transfer is two balance updates; ~100 nodes at 10,000 TPS per Raft group (book estimate)
- Data volume: Uber LedgerStore over a trillion entries, "several petabytes", 2 trillion indexes, petabyte-scale index footprint; offline validation of 760B records in one Spark job
- Message throughput: not stated
- Latency: Uber strongly consistent indexes trade higher write latency and lower availability for read-your-write; shadow validation targeted 99.99% correctness

## Requirements stated or clearly implied
- Availability target: Raft groups survive minority loss; Uber strong indexes accept lower availability for correctness
- Consistency: transfers atomic across accounts; no double spend; Uber read-your-write on critical indexes, eventual on history
- Latency target: in-session transfer; not numeric
- Ordering needs: total order of events per shard via Raft; command dedup
- Replay or reprocessing: reproducibility is a hard requirement; any historical balance rebuildable from the event log; snapshots accelerate rebuild
- Retention: events immutable forever; sealed ranges tiered to cold storage (Uber)
- Compliance / residency: audit trail, tamper evidence via signing and sealing (Uber)
- Correctness: validation of migrated data at 99.99% with shadow traffic plus full offline diff (Uber)

## Boundaries
- Regions / zones: book per-shard Raft groups across machines; Uber on-premises Docstore plus cold object storage
- Trust zones: clients -> wallet API -> internal command processors and logs; auditors read sealed ledgers
- Named subsystems: Wallet service (API), Shard map (ZooKeeper), In-memory balance stores (Redis, rejected), Transactional DB with 2PC coordinator, TC/C or Saga coordinator, Event store (Raft replicated log per shard), State machine and snapshots, Read replicas (CQRS), Reproducibility replay; Uber: LedgerStore on Docstore, index intents, materialised views, sealing service, cold tier

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Wallet API service | Accepts transfer commands; validates; routes by account shard | in-house | app-server + api-gateway | |
| 2 | Shard map / coordinator | Maps account to partition; membership | ZooKeeper (book) | coordination-service | |
| 3 | In-memory balance shards (rejected step) | Redis per shard; not durable, not atomic across shards | Redis | cache | rejected: not durable |
| 4 | Transactional DB shards + 2PC coordinator | Balances in relational shards; X/Open XA two-phase commit | relational | sql-database + control-plane-coordinator | commit: 2pc |
| 5 | TC/C coordinator | Try, confirm, cancel; application-level compensation | in-house | workflow-engine | pattern: tcc |
| 6 | Saga coordinator | Ordered local transactions with compensations; choreography or orchestration | in-house | workflow-engine | pattern: saga |
| 7 | Command queue / router | Delivers commands to owning shard | Kafka or internal | queue | |
| 8 | Event store (per shard) | Append-only events, Raft-replicated log | in-house; RocksDB, mmap files | event-store (candidate) / stream | replication: raft; appendOnly: true |
| 9 | State machine | Applies events to balances; deterministic | in-house | app-server | deterministic: true |
| 10 | Snapshot store | Periodic state snapshots for fast rebuild | local files or object store | object-store | snapshotIntervalEvents |
| 11 | Read model (CQRS) | Derived balances for queries | separate DB or cache | cache or sql-database | derived: true |
| 12 | Reproducibility replayer | Rebuilds state to any point for audit | in-house | worker | |
| 13 | LedgerStore (Uber) | Immutable ledger DB with signing and sealing | Uber LSG on Docstore | ledger | sealed: true; signed: true |
| 14 | Strongly consistent indexes (Uber) | Written via 2PC intents before record; read-your-write | LSG | property of ledger | indexConsistency: strong |
| 15 | Eventually consistent indexes (Uber) | Materialised views built async | Docstore MV | search-index or derived view | indexConsistency: eventual |
| 16 | Time-range index and cold tier (Uber) | Query by event time; tier sealed ranges | LSG + cold storage | ledger + object-store | tiering: true |
| 17 | Validation jobs (Uber migration) | Shadow compare and offline Spark diff | Spark | etl-job + scheduled-job | |
| 18 | Backfill workers (Uber) | Batched, checkpointed, AIMD rate control | in-house | worker | rateControl: aimd |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | wallet api | https | sync | | idempotent command id |
| wallet api | shard map | lookup | sync | | |
| wallet api | command queue | produce | async | at-least-once | |
| command queue | shard state machine | consume | async | at-least-once | dedup by command id |
| state machine | event store (raft leader) | append | sync | quorum | |
| raft leader | followers | replication | sync (quorum) | | |
| state machine | snapshot store | write | async | | periodic |
| event store | read model | project | async | eventual | CQRS |
| saga / tcc coordinator | shard a, shard b | local tx | sync each | | compensations |
| 2pc coordinator | db shards | prepare/commit | sync | | blocking |
| replayer | event store + snapshots | read | async | | audit |
| ledger writer (uber) | index intents | write | sync | 2pc | before record |
| ledger writer | record | write | sync | | then finalise intents async |
| docstore | materialised views | build | async | eventual | |
| sealing service | ledger ranges | sign and seal | async | | periodic |
| sealed ranges | cold tier | tier | async | | |

## Failure modes, incidents, tradeoffs the source discusses
- In-memory Redis balances: fast but not durable and no cross-shard atomicity; rejected. Source: book.
- 2PC: blocking, coordinator is a single point of failure, locks held across network; rejected for throughput. Source: book.
- TC/C: two phases in application code, needs phase status table, out-of-order confirm and cancel must be handled. Source: book.
- Saga: compensations for every step; choreography vs orchestration; still lacks reproducibility. Source: book.
- Event sourcing: reproducibility and audit; cost is replay time, so snapshots and mmap-based file storage; Raft for durability of the log. Source: book.
- Strong index cost: 2PC intents raise write latency and reduce availability; use eventual indexes where read-your-write is unnecessary. Source: Uber.
- Migration risk: shadow validation cannot reach 7 nines practically (12 days of traffic); offline full diff caught issues in cold data; AIMD backfill rate to protect downstream. Source: Uber.
- Tamper evidence: sealing past ranges and signing detects unauthorised change. Source: Uber.

## Unknowns
- Book's exact command dedup and idempotency table
- LedgerStore sealing cadence and signature scheme
- Docstore replication topology

## Candidates
- New kinds: event-store (append-only, replicated, replayable command log; distinct from stream by being the system of record with snapshots; 1st explicit sighting, figma journal and stripe ledger adjacent); sightings: ledger (3rd: LedgerStore), workflow-engine (8th: TC/C and saga), coordination-service (15th: shard map), control-plane-coordinator (10th: 2PC), sql-database (21st), cache (17th), object-store (13th: snapshots, cold tier), worker (15th), etl-job (13th), scheduled-job (13th), queue (16th), app-server (23rd)
- New properties on existing kinds: event-store.replication (raft, none), snapshotIntervalEvents, storage (mmap, rocksdb); ledger.sealed, signed, indexConsistency (strong, eventual), tiering; workflow-engine.pattern (saga, tcc, 2pc, dag); app-server.deterministic (boolean); worker.rateControl (aimd, fixed, none); sql-database.commitProtocol (single, 2pc)
- New edge properties: replicationAck quorum (2nd sighting); compensating (boolean)
- New requirement paths: correctness.reproducible (boolean); correctness.tamperEvident (boolean); consistency.readYourWrite (boolean); migration.validationTarget
- New rules:
  - balance-store-not-durable: money balances on cache with persistence false (rejected book step)
  - cross-shard-money-move-without-transaction-pattern: transfer edges across two sharded stores with no workflow-engine pattern or 2pc coordinator
  - reproducible-required-without-event-store: correctness.reproducible true and no event-store or ledger kind
  - event-store-without-snapshots: event-store with high event rate and no snapshot store edge
  - replicated-log-single-node: event-store replication none while durability required
  - strong-index-on-non-critical-path: ledger indexConsistency strong for history queries (informational, availability cost)
  - ledger-without-sealing-under-tamper-evidence: correctness.tamperEvident true and ledger sealed false
