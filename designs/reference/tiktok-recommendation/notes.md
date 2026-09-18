# tiktok-recommendation: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/tiktok-recommendation.md` (Monolith, ORSUM at RecSys 2022; ByteGraph, VLDB 2022; the archived `bytedance/monolith` repository). Re-verified 2026-09-13.
- Size: 16 nodes, 18 edges, 6 groups.

## Clean variant (header of design.yaml)

Reference architecture 10, clean variant: the Monolith online-training loop behind the TikTok feed —
actions and features logged to Kafka, joined in Flink against an on-disk store for late labels,
trained into a parameter server that a sync worker pushes to the serving side every minute —
beside ByteGraph, the three-layer graph database that holds the social and interaction graphs.

Fixes relative to tiktok-recommendation.broken.yaml:
  - flink-joiner parks features that outlive the memory window in late-label-store and sidelines
    late data instead of dropping it, so a label arriving hours later still produces a sample
  - param-sync is a real worker: it reads touched sparse keys from training-ps every minute and
    pushes them to serving-ps, so serving-ps is rebuildable and is not the only copy of a parameter
  - training-ps is the system of record for parameters and is snapshotted daily into snapshot-store
  - bytegraph-kv and its remote replica declare last-writer-wins, the conflict policy the ByteGraph
    paper states, instead of letting multi-leader writes reconcile by accident
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture 10, broken variant: the same TikTok recommendation loop built the way a team
builds it the first time — the joiner windows by event time and drops anything late, so the label
that arrives after the window never trains anything; the parameter synchroniser is gone and model
servers write embeddings straight into the serving parameter server, which is then the only copy
of them; and ByteGraph's second-region replica accepts writes with no stated conflict policy.

This file MUST trip:
  - windowed-aggregation-without-watermark      (flink-joiner windows by event time, no watermarkSeconds)
  - cache-as-primary-store-without-persistence  (serving-ps: usedAsPrimaryStore true, persistence false)
  - materialised-cache-without-rebuild-path     (serving-ps is materialised; only model-server writes it)
  - multi-leader-store-without-conflict-policy  (bytegraph-kv and bytegraph-kv-remote are multi-leader with no conflictResolution)
and MUST NOT trip:
  - cache-missing-eviction-policy               (serving-ps still declares ttl)
  - datastore-missing-backup, datastore-single-region, read-replica-as-sole-scaling,
    single-writer-primary-at-peak-qps           (no sql-database node in this design)
  - queue-missing-dlq, retry-queue-without-dlq, pubsub-replay-required (no queue and no pubsub-topic)
  - derived-store-without-cdc-or-rebuild, business-updates-without-index-propagation (no search index)
  - read-heavy-path-without-cache               (no app-server node, and a cache exists)
  - credentials-without-rotation                (the design still states credentialRotationDays)
  - retry-without-backoff, retry-without-adaptive-shedding (the one retrying edge keeps jittered backoff and a breaker)
  - sync-chain-too-deep                         (no api-gateway node to start the chain at)
  - object-store-single-zone-with-durability-target (snapshot-store states no durability target)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone (no availability-zone groups)

The broken twin drops two nodes relative to the clean design (param-sync and late-label-store), which
is inside the +/-3 allowance, and both removals are the mistakes themselves.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Mobile client (TikTok / Douyin app) | `mobile-client` | `mobile-app` | client | exact |
| Model serving workers | `model-server` | `tensorflow-serving` | ml-inference | close (Monolith is a TensorFlow-based serving stack; the paper names no product for the server itself) |
| Serving parameter servers | `serving-ps` | `cache-cluster` | cache | close (an in-memory sharded parameter store; the catalogue has no parameter-server kind) |
| Training parameter servers | `training-ps` | `nosql-store` | nosql-database | close (system of record for parameters, snapshotted; modelled as a key-value store rather than a cache) |
| Training workers | `training-worker` | `container-worker` | worker | exact |
| Kafka, user actions | `kafka-actions` | `kafka` | stream | exact |
| Kafka, features | `kafka-features` | `kafka` | stream | exact |
| Flink streaming joiner | `flink-joiner` | `flink` | stream-processor | exact |
| On-disk key-value store (joiner) | `late-label-store` | `nosql-store` | nosql-database | close (the paper says "on-disk key-value storage" and names no product) |
| Training Kafka | `kafka-training` | `kafka` | stream | exact |
| Parameter sync | `param-sync` | `container-worker` | worker | close (the paper describes the push, not a named service) |
| Snapshot store | `snapshot-store` | `blob-store` | object-store | assumed (the paper says daily snapshots but names no store) |
| ByteGraph BGE | `bytegraph-bge` | `graph-store` | graph-database | close (query tier of a graph database; the catalogue has no ByteGraph component) |
| ByteGraph BGS | `bytegraph-bgs` | `graph-store` | graph-database | close (storage tier, `inMemory: true` for its cache and log layer) |
| KV persistence | `bytegraph-kv` | `nosql-store` | nosql-database | close (RocksDB-class KV, not named as a product) |
| Geo-replication (second region) | `bytegraph-kv-remote` | `nosql-store` | nosql-database | close (the card's row 15 is a property; it is drawn here as the remote replica the edge table calls "kv-store (region B)") |

Tally: 6 exact, 9 close, 1 assumed.

Two deviations from the card's component table, both toward the primary source:

- The card's single row "Kafka (actions, features)" is split into `kafka-actions` and `kafka-features`
  because the Monolith paper states two queues — "one Kafka queue to log actions of users ... and
  another Kafka queue for features" — and the joiner's two inputs are the point of the design.
- The card's row 15 "Geo-replication" is a property, not a box. It is encoded twice: as
  `crossRegionConsistency: "last-writer-wins-hlc"` on the two ByteGraph tiers, and as the
  `bytegraph-kv -> bytegraph-kv-remote` replication edge the card's own edge table lists.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Monolith parameter server (also TensorFlow PS) | `parameter-server` — a sharded in-memory store of sparse embeddings and dense weights with a snapshot cadence and a push-sync cadence | `cache-cluster` for the serving side, `nosql-store` for the training side |
| ByteGraph (BGE query tier, BGS storage tier) | none new; a `bytegraph` component under `default` with `kind: graph-database` would fit | `graph-store` twice, distinguished by `inMemory` and by `label` |
| The joiner's embedded on-disk KV (RocksDB-class) | none new; the catalogue deliberately skips embedded engines | `nosql-store` with `model: "key-value"` |

## Assumptions recorded

- `security.credentialRotationDays: 90` — neither paper mentions credential rotation. Set so that
  `credentials-without-rotation` is answered rather than left to the vendor default; 90 days matches
  the other reference designs.
- `circuitBreaker: true` on `training-worker -> training-ps` — the paper states neither retries nor
  breakers on the gradient-apply hop. The retry with jittered backoff reflects the paper's tolerance
  of PS machine failure at 0.01%/day; the breaker is the practice that makes that retry safe.
- `freshness.maxSeconds: 60` is the minute-level sparse sync the paper states, read as a freshness
  target for derived parameters. `availability.regions: 2` is the smallest number that expresses the
  cross-region multi-leader replication ByteGraph describes; the papers name no region count.
- `snapshot-store` carries `versioning` and `checksumOnWrite` but no `durabilityNines` and no `zones`,
  because the paper states neither.

## Not encoded

- The collisionless Cuckoo hash embedding table, the frequency filter before admission, and the
  inactivity expiry of IDs: `cache.evictionPolicy: "ttl"` on `serving-ps` is the nearest the format
  gets; the hash-table design itself has no field.
- The 400 MB per minute of touched sparse keys, and the 4 KB x 100,000 arithmetic behind it. Edges
  carry no bandwidth field; the number lives in the source card and in the edge label's cadence.
- The 0.01%/day PS machine failure rate and the explicit "reliability traded for real-time learning"
  argument. `backupRetentionDays: 1` on `training-ps` is the encodable residue.
- The 14.443%-18.081% AUC improvement from the 7-day online A/B, and the 15M DAU / 1000-shard PS
  example: results and sizing, not topology.
- ByteGraph's edge-trees, adaptive secondary indexes, super-vertex edge grouping by type, and
  read-committed isolation via 2PC with write-intents. Only the 2PC shows up, as an edge label.
- The distinction between sparse and dense parameters: they travel the same `param-sync -> serving-ps`
  edge, whose label carries the two cadences, because the format has one edge per hop.
- Video storage, the CDN path, candidate retrieval (ANN index) and the multi-stage ranking layout:
  ByteDance publishes none of it, so none of it is here.
