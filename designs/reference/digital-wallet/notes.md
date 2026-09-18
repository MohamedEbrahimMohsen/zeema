# digital-wallet: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/digital-wallet.md` (intake card of 2026-09-07, with the 2026-09-14 verification appended)
- Size: 21 nodes, 25 edges, 5 groups (the broken twin has 21 nodes, 25 edges, 6 groups).

## Clean variant (header of design.yaml)

Reference architecture: digital wallet (Xu vol 2 ch 11/12) with Uber LedgerStore as the
production ledger. Clean variant: every transfer command is appended to a per-shard
Raft-replicated event log, balances are derived by a deterministic state machine, cross-shard
transfers run as a saga with compensations, and money is recorded in an append-only
double-entry ledger whose sealed time ranges are signed and tiered to cold storage.

Fixes relative to digital-wallet.broken.yaml:
  - balances are not kept in a Redis shard set that is the only copy; the event log is the
    system of record and balance-read-store holds derived CQRS views rebuilt by read-view-builder
  - money is recorded in ledger-store, an append-only double-entry ledger (tamperEvident,
    sealed, tiering), not in relational balance shards behind a blocking 2PC coordinator
  - cross-shard transfers use saga-coordinator (pattern saga, compensation, idempotent steps)
    instead of X/Open XA two-phase commit
  - event-log is Raft-replicated over three nodes with mmap segments and periodic snapshots,
    not a single unreplicated journal pinned to one availability zone
  - the migration backfill runs behind backfill-limiter, an adaptive (AIMD) rate limiter in
    front of ledger-store, so retried batches are shed instead of amplified
  - every hop that posts money into the ledger declares an idempotency key
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: digital wallet, broken variant. This is the wallet the chapter walks
through and then rejects: account balances sharded across an in-memory Redis cluster that is
the only copy, relational balance shards committed with X/Open XA two-phase commit instead of
an append-only double-entry ledger, one unreplicated event journal and its state machine
pinned to a single availability zone, and a migration backfill that retries into Docstore
with nothing in front of it.

This file MUST trip:
  - cache-as-primary-store-without-persistence  (balance-cache: usedAsPrimaryStore true, persistence false)
  - money-store-without-double-entry-ledger     (money.zeroSum true, no ledger node: balances live in Redis and relational shards)
  - stateful-engine-pinned-to-single-zone       (event-log: replication none, one availability-zone group)
  - stateful-node-without-zone-redundancy       (state-machine: stateless false, one availability-zone group, no cell)
  - retry-without-adaptive-shedding             (backfill-worker -> docstore retries with no circuit breaker and no rate limiter in front)
and MUST NOT trip:
  - cache-missing-eviction-policy               (balance-cache declares lru)
  - datastore-missing-backup                    (balance-shards declares backupEnabled and backupRetentionDays)
  - single-writer-primary-at-peak-qps, read-replica-as-sole-scaling (balance-shards is sharded, replication sync)
  - queue-missing-dlq                           (command-queue declares deadLetterQueue)
  - money-mutation-without-idempotency-key      (no ledger and no handlesMoney node is left for that rule to select)
  - credentials-without-rotation                (security.credentialRotationDays stays declared)
  - business-updates-without-index-propagation, derived-store-without-cdc-or-rebuild (no search-index kind in this design)
  - sync-chain-too-deep                         (no api-gateway node, and no p95 latency target is stated by the source)
  - shared-dependency-without-redundancy        (shard-map is replicated; availability.discoveryRedundant is not declared)
  - object-store-single-zone-with-durability-target, multi-leader-store-without-conflict-policy,
    pubsub-replay-required, cross-cell-call, external-call-inline-without-durable-path (no such node or requirement)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Client of the wallet service | `wallet-client` | `user-device` | client | close |
| Wallet API service (1) | `wallet-api` | `container-service` | app-server | exact |
| Shard map / coordinator, ZooKeeper (2) | `shard-map` | `zookeeper` | coordination-service | exact |
| Saga coordinator (6) | `saga-coordinator` | `cadence` | workflow-engine | assumed (no generic workflow-engine component; see Catalogue gaps) |
| Command queue / router (7) | `command-queue` | `message-queue` | queue | assumed (the book logs commands; a queue in front of the owning shard is inferred, not drawn) |
| State machine (9) | `state-machine` | `container-service` | app-server | exact |
| Event store, per shard, Raft, mmap (8) | `event-log` | `raft-event-log` | event-store | exact |
| Snapshot store (10) | `snapshot-store` | `blob-store` | object-store | close |
| Read model, CQRS read-only state machines (11) | `read-view-builder` | `container-worker` | worker | exact |
| Read model store (11) | `balance-read-store` | `nosql-store` | nosql-database | close (the book says "separate DB or cache", not which) |
| Reproducibility replayer (12) | `replayer` | `container-worker` | worker | exact |
| LedgerStore, Uber (13) | `ledger-store` | `double-entry-ledger` | ledger | exact |
| Docstore, LedgerStore backing store (13, 15) | `docstore` | `nosql-store` | nosql-database | close (no Docstore component) |
| Eventually consistent indexes, materialised views (15) | `eventual-indexes` | `nosql-store` | nosql-database | close |
| Sealing service, 30-minute windows (16) | `sealing-service` | `cron-job` | worker | exact |
| Cold tier, TerraBlob (16) | `cold-tier` | `blob-store` | object-store | close |
| Backfill RateLimiter (18) | `backfill-limiter` | `in-process-limiter` | rate-limiter | exact |
| DynamoDB, legacy hot store (17, 18) | `legacy-dynamodb` | `dynamodb` | nosql-database | exact |
| Backfill workers, AIMD (18) | `backfill-worker` | `container-worker` | worker | exact |
| Shadow validation (17) | `shadow-validator` | `container-worker` | worker | exact |
| Offline Spark diff (17) | `offline-validator` | `spark-job` | worker | exact |
| Strongly consistent indexes, 2PC intents (14) | (no node) | property `indexConsistency: "strong"` on `ledger-store` | — | exact (the card itself calls it a property of the ledger) |
| In-memory balance shards, Redis (3) | `balance-cache`, broken twin only | `redis` | cache | exact (the chapter rejects this design) |
| Transactional DB shards + 2PC coordinator (4) | `balance-shards`, `twopc-coordinator`, broken twin only | `relational-database`, `cadence` | sql-database, workflow-engine | exact / assumed (the chapter rejects this design) |
| TC/C coordinator (5) | (not encoded) | — | — | — |

Tally: 13 exact, 8 close, 2 assumed among the 21 clean nodes; the two broken-twin-only boxes add 2 exact and 1 assumed.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| In-house saga / TC-C coordinator | a generic `workflow-engine` under `default` (every workflow-engine component is a named product) | `cadence`, labelled "Saga coordinator" |
| Uber Docstore | `nosql-database` document store with materialised views | `nosql-store` with `model: "document"` |
| Uber TerraBlob | `object-store` | `blob-store` with `tier: "cold"` |
| Docstore materialised views used as eventually consistent indexes | a derived-view kind | a second `nosql-store` node |

No components were added to the catalogue.

## Values set to satisfy a rule where the source is silent

- `security.credentialRotationDays: 90` — neither source states a rotation period, and there is no
  key-management node in either source. Without it `credentials-without-rotation` fires on a design
  that holds money; 90 days is the value every other reference design uses.
- `command-queue.deadLetterQueue: true` and `persistence: true` — the book does not describe a DLQ,
  but a command queue in front of a money shard that drops or infinitely retries poison commands is
  not the practice the chapter is describing.
- `snapshot-store.checksumOnWrite: true` and `cold-tier.objectLock: true` — Uber's post states
  "verifiable immutability" and signed manifests over sealed ranges; these are the properties that
  express it, not numbers taken from the source.

## Not encoded

- The TC/C (try-confirm-cancel) alternative: the chapter presents it as a third option alongside 2PC
  and Saga, with a phase status table and out-of-order confirm/cancel handling. The format has one
  `pattern` value per workflow-engine node, and encoding a rejected alternative as a live node would
  claim the system runs all three.
- "~100 nodes at 10,000 TPS per Raft group" — could not be re-confirmed in this pass (see the
  Verification section of `source/digital-wallet.md`), so no per-node `nfr.rps` is set.
- The chapter's ordering of designs (naive -> 2PC -> TC/C -> Saga -> event sourcing) is a narrative,
  not a topology; the clean design encodes the landed design and the broken twin the rejected ones.
- Uber's index lifecycle management (table creation, historical backfill, completeness validation by
  checksummed time-windows, index swapping) is an operation over `ledger-store`, not a runtime node.
- The signature scheme over sealed manifests, the sealing cadence beyond the 30-minute window, and
  Docstore's replication topology are all unknown; `replication: "single-region"` on `docstore` is
  the kind default, not a claim from the source.
- Cost and volume figures (2 trillion indexes, 1.2 PB, $6M/year saved) have no field in the format;
  they live in `source/digital-wallet.md` only.
