# Intake: TikTok / ByteDance recommendation pipeline (Monolith online training, ByteGraph)

## Source
- Primary: Monolith paper (ByteDance, ORSUM at RecSys 2022) https://ar5iv.labs.arxiv.org/html/2209.07663 and repo https://github.com/bytedance/monolith (archived Oct 2025)
- Primary: ByteGraph paper (ByteDance, VLDB 2022) https://vldb.org/pvldb/vol15/p3306-li.pdf, read via summary https://www.mydistributed.systems/2023/01/bytegraph-graph-database-for-tiktok.html
- Excluded: arXiv 2307.15893 "Online Matching" is a Google/YouTube paper, not ByteDance; fetched by mistake and not used
- Verified by: two peer-reviewed ByteDance papers + official open-source repo
- Confidence: high for Monolith and ByteGraph internals; low for the end-to-end TikTok serving topology, which ByteDance does not publish (retrieval, ranking service layout inferred only as generic stages)
- Date of source: 2022

## System in three lines
Short-video feed where the ranking model learns from user actions within minutes: actions flow through Kafka into a Flink joiner that matches features with late-arriving labels, then into training workers that update sparse embeddings in training parameter servers and push touched keys to serving parameter servers every minute. Social and interaction graphs live in ByteGraph, a three-layer graph database over a KV store with geo-replication. Hard because embedding tables for billions of IDs must be collision-free yet fit memory, labels arrive late, and freshness is traded explicitly against consistency and reliability.

## Scale (only if stated)
- Users / DAU: paper example uses 15M DAU for a product line; ByteGraph "tens of billions of vertices and trillions of edges"
- Requests per second: not stated for serving
- Data volume: sparse sync ~400 MB per minute for 100K touched IDs
- Message throughput: not stated
- Latency: sparse parameters synced minute-level; dense parameters day-level; ByteGraph latency 5-7x lower than AWS Neptune in their benchmark
- Result: online training gave 15-18% AUC improvement over batch in 7-day A/B on ads

## Requirements stated or clearly implied
- Availability target: PS machine failure rate 0.01%/day accepted; daily snapshots only
- Consistency: explicitly relaxed; "Consistency of version across different parts of parameters could be traded-off for reducing network bandwidth consumption"; ByteGraph eventual within region, last-write-wins with hybrid logical clocks across regions
- Latency target: model freshness in minutes; serving latency not stated
- Ordering needs: feature-label join keyed by request id; late labels tolerated via on-disk KV
- Replay or reprocessing: Kafka retention for training data; daily snapshots for recovery
- Retention: embeddings expire after inactivity; frequency filtering before admission
- Compliance / residency: not stated (geo-replication in ByteGraph)

## Boundaries
- Regions / zones: multi-region for ByteGraph (multi-leader across regions); training and serving clusters separate
- Trust zones: clients -> serving; internal training pipeline
- Named subsystems: Action logging (Kafka), Streaming joiner (Flink + cache + KV), Training (workers, training PS), Serving (serving PS, model servers), Parameter sync, Snapshots, ByteGraph (BGE query, BGS storage, KV persistence)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Mobile client | Watches, likes, follows; feature and action events | TikTok/Douyin app | mobile-client | |
| 2 | Model serving (workers + serving PS) | Ranking inference reading embeddings from serving parameter servers | Monolith (TensorFlow) | ml-inference | embeddingTable: collisionless-cuckoo |
| 3 | Serving parameter servers | Hold sparse and dense parameters for inference; receive minute-level sparse updates | Monolith PS | parameter-server (new) / nosql-database (in-memory) | syncSparseMinutes: 1; syncDenseDays: 1 |
| 4 | Training parameter servers | Parameters updated by training workers | Monolith PS | parameter-server (new) | |
| 5 | Training workers | Compute gradients from joined samples | Monolith on TensorFlow | worker (training) | |
| 6 | Kafka (actions, features) | User action log and feature log | Apache Kafka | stream | |
| 7 | Flink streaming joiner | Joins features with late labels; in-memory cache plus on-disk KV for pending features | Apache Flink | stream-processor | lateLabelStore: disk-kv |
| 8 | On-disk KV store (joiner) | Holds features awaiting labels beyond memory window | not named | nosql-database (embedded) | |
| 9 | Training Kafka | Joined training examples | Apache Kafka | stream | |
| 10 | Parameter sync | Pushes touched sparse keys minutely, dense daily, filtered | Monolith | worker (sync) | bandwidthMbPerMin: 400 |
| 11 | Snapshot store | Daily PS snapshots for recovery | not named (HDFS/object store) | object-store | cadence: daily |
| 12 | ByteGraph BGE | Query layer: parsing, planning, execution, 2PC for distributed transactions | ByteGraph | graph-database (query tier) | |
| 13 | ByteGraph BGS | Stateless storage layer: in-memory cache and log management; edge-trees, adaptive secondary indexes | ByteGraph | graph-database (storage tier) | |
| 14 | KV persistence | Durable store under ByteGraph | RocksDB-class KV | nosql-database | |
| 15 | Geo-replication | Single-leader in region, multi-leader across regions with HLC last-write-wins | ByteGraph | property of graph-database | crossRegion: multi-leader-lww |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | serving | rpc | sync | | feed request |
| serving workers | serving-ps | rpc | sync | | embedding lookup |
| client / serving | kafka-actions | log | async | at-least-once | actions and features |
| kafka-actions | flink-joiner | kafka | async | at-least-once | |
| flink-joiner | on-disk-kv | local | sync | | pending features |
| flink-joiner | kafka-training | kafka | async | at-least-once | joined samples |
| kafka-training | training-workers | kafka | async | at-least-once | |
| training-workers | training-ps | rpc | sync | | gradient apply |
| training-ps | serving-ps | sync push | async | | sparse minutely, dense daily |
| training-ps | snapshot-store | write | async | | daily |
| serving | bytegraph-bge | rpc | sync | | social/interaction lookups |
| bge | bgs | rpc | sync | | |
| bgs | kv-store | local/rpc | sync | | |
| kv-store (region A) | kv-store (region B) | replication | async | lww-hlc | multi-leader |

## Failure modes, incidents, tradeoffs the source discusses
- Hash collisions degrade quality; solved with "a collisionless hash table... based on Cuckoo Hashmap". Source: Monolith.
- Memory blow-up: frequency filtering and expirable embeddings ("IDs are timed and set to expire after being inactive"). Source: Monolith.
- Late labels: joiner uses "an on-disk key-value storage" so actions arriving hours later still match. Source: Monolith.
- Bandwidth vs consistency: sparse minute-level sync of touched keys only (~400 MB/min); dense daily; explicit consistency trade. Source: Monolith.
- Reliability vs freshness: daily snapshots accepted because losing one day of a PS shard affects "0.01% DAU"; "System reliability could be traded-off for real-time learning." Source: Monolith.
- Batch frameworks separate training and serving, so "the model [cannot] interact with customer feedback in real-time". Source: Monolith.
- ByteGraph edges stored in adjacency lists rather than as first-class entities: "more disk I/O, higher memory usage, lower cache hit ratio" but simpler horizontal scaling over KV. Source: ByteGraph summary.
- Cross-region conflicts resolved by last-write-wins with HLC tombstones; eventual consistency within region. Source: ByteGraph summary.
- Super-vertices: edges grouped by type to cut read amplification. Source: ByteGraph summary.

## Unknowns
- Candidate retrieval stage (ANN index) and multi-stage ranking layout
- Serving QPS and latency budgets
- Video storage and CDN path (not covered)
- Kafka and Flink cluster scale

## Candidates
- New kinds: parameter-server (Monolith PS, TF PS; may fold into ml-inference + nosql-database in-memory); sightings: ml-inference (5th), stream-processor (7th), stream (14th), graph-database (4th), object-store (14th), worker (14th), nosql-database (18th)
- New properties on existing kinds: ml-inference.onlineTraining (boolean), embeddingSyncMinutes; stream-processor.lateDataStore (memory, disk-kv); graph-database.crossRegionConsistency (lww-hlc, single-leader); nosql-database.role snapshot
- New edge properties: syncCadence (minutes, daily); touchedKeysOnly (boolean)
- New requirement paths: freshness.modelMinutes; reliability.acceptableLossFraction; consistency.model (3rd sighting)
- New rules:
  - online-training-without-late-label-store: stream-processor joining features and labels with lateDataStore memory only while label lag exceeds window
  - serving-params-without-snapshot: parameter-server or in-memory model store with no snapshot edge to object-store
  - embedding-table-without-expiry: ml-inference embedding tables with no expiry or frequency filter while id space unbounded (informational)
  - multi-leader-graph-without-conflict-policy: graph-database crossRegionConsistency unset while replicas span regions
  - freshness-target-below-sync-cadence: freshness.modelMinutes below embeddingSyncMinutes
