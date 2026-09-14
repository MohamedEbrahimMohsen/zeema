# Intake: Ad click event aggregation (Xu vol 2 ch 6) with Uber Eats exactly-once ad pipeline

## Source
- Primary: Alex Xu and Sahn Lam, System Design Interview vol 2, chapter 6 "Ad Click Event Aggregation"; chapter design known from the book and consistent with public notes (Medium summary 403, raymondjones page client-rendered in this pass)
- Primary: https://www.uber.com/blog/real-time-exactly-once-ad-event-processing/ (official Uber, 2021: Flink, Kafka transactions, Pinot, Hive, Docstore attribution)
- Cross-references: distributed-message-queue (exactly-once mechanics), linkedin-kafka (Pinot, Samza), spotify-playback (event-time windows, late data policy), stripe-payments (Ledger reconciliation)
- Verified by: canonical textbook chapter + official Uber post
- Confidence: high
- Date of source: 2021-2022

## System in three lines
Counts ad clicks per ad per minute and the top ads per window, correctly enough to bill on: click logs flow through Kafka into a stream aggregation layer (MapReduce-style map, aggregate, reduce nodes in the book; Flink jobs at Uber) that windows by event time with watermarks for late arrivals, deduplicates by event id, and writes minute aggregates to an OLAP store while raw events land in a wide-column store for replay and nightly reconciliation. Uber's pipeline adds attribution against orders and achieves exactly-once with Kafka transactions and two-phase commit on Flink checkpoints. Hard because money depends on counts, events arrive late or twice, one hot ad can skew a partition, and streaming results must reconcile with batch truth.

## Scale (only if stated)
- Users / DAU: book 1B clicks/day, 2M ads; peak ~10,000 QPS (book estimate ~10K average, 50K peak)
- Requests per second: Uber "hundreds of millions of ad events per week" across two regions
- Data volume: book 0.1 KB per click, ~100 GB/day raw; aggregated far smaller
- Message throughput: Uber Flink checkpoints every 2 minutes; results visible in 2-4 minutes
- Latency: book "a few minutes" end-to-end acceptable for aggregation; Uber "not exactly 'real-time' but good enough" for pacing

## Requirements stated or clearly implied
- Availability target: aggregation job is "a critical single point of failure" at Uber; downtime delays pacing and "could result in overspend"
- Consistency: exactly-once effect for billing via Kafka transactions, read_committed and idempotent record ids; book: at-least-once plus dedup, reconciliation with batch
- Latency target: minutes, not seconds; book RPO/RTO for aggregates via snapshots
- Ordering needs: event-time windows; keyed by ad id and minute bucket
- Replay or reprocessing: raw events kept in Cassandra (book) or Hive (Uber) to recompute; Flink checkpoints restore state
- Retention: raw events for reconciliation window; aggregates long-term
- Compliance / residency: two regions unioned (Uber)
- Correctness: nightly reconciliation batch job compares streaming aggregates to batch results (book)

## Boundaries
- Regions / zones: Uber processes in Region A and B, unions before serving
- Trust zones: mobile clients (untrusted, duplicates and delays) -> ingestion -> internal streaming -> OLAP and warehouse
- Named subsystems: Log watcher/ingest, Kafka, Aggregation (map, aggregate, reduce or Flink jobs), Attribution (Uber), Raw store, Aggregated store / OLAP, Query service, Reconciliation batch, Alerting

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Mobile / web clients | Emit impression and click events (duplicates, retries, lateness) | apps | mobile-client, web-client | |
| 2 | Log watcher / ingest | Reads click logs, publishes to Kafka | in-house | worker | |
| 3 | Kafka (raw events) | Buffers clicks; partitioned by ad id | Apache Kafka | stream | partitionKey: adId |
| 4 | Map nodes | Filter, normalise, re-partition by ad id | MapReduce-style / Flink | stream-processor | |
| 5 | Aggregate nodes | Count per ad per minute in memory; heap for top-N | Flink keyed windows | stream-processor | windowing: event-time tumbling 1m; watermark: seconds |
| 6 | Reduce nodes | Merge partial results into final per window | Flink | stream-processor | |
| 7 | Dedup state | Keyed state or record ids to drop duplicates | Flink keyed state, Redis | cache | dedupBy: eventId |
| 8 | Attribution job (Uber) | Joins ad events with orders from Docstore | Flink + Docstore | stream-processor + nosql-database | |
| 9 | Kafka (aggregates) | Decouples aggregation from DB writers; transactional writes | Apache Kafka | stream | transactions: true |
| 10 | Raw data DB | Append-only raw events for replay and reconciliation | Cassandra (book), Hive (Uber) | nosql-database / data-warehouse | |
| 11 | Aggregated DB / OLAP | Minute aggregates, top-N, filters | Cassandra (book), Pinot (Uber) | data-warehouse (real-time olap) | upsert: true |
| 12 | Query service | Serves aggregated counts and top ads | in-house | api-gateway + app-server | |
| 13 | Reconciliation batch | Nightly batch recompute and compare | Spark/MapReduce | scheduled-job + etl-job | |
| 14 | Checkpoint store | Flink snapshots for recovery | HDFS/S3 | object-store | checkpointIntervalSeconds: 120 |
| 15 | Alerting | Detects job downtime and overspend risk | monitoring | monitoring | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | ingest | https | async | at-least-once | duplicates possible |
| ingest | kafka raw | kafka | async | at-least-once | |
| kafka raw | map nodes | kafka | async | at-least-once | |
| map | aggregate | shuffle by ad id | async | | hot ads skew |
| aggregate | reduce | internal | async | | |
| aggregate | dedup state | local | sync | | |
| reduce | kafka aggregates | kafka (transactional) | async | exactly-once | 2PC on checkpoint |
| kafka aggregates | db writer | kafka read_committed | async | | |
| db writer | aggregated db / pinot | upsert | sync | | record id idempotent |
| ingest / map | raw db / hive | write | async | | replay source |
| query service | aggregated db | query | sync | | |
| reconciliation | raw db + aggregated db | batch | async | | nightly compare |
| flink jobs | checkpoint store | snapshot | async | | every 2 min |
| attribution | docstore | lookup | sync | | orders |
| region A + B | union job | kafka | async | | |

## Failure modes, incidents, tradeoffs the source discusses
- Late events: watermarks delay window close; too long adds latency, too short loses events; book shifts or drops beyond watermark, Uber keys by minute bucket so late events still aggregate. Source: book, Uber.
- Duplicates: client retries and at-least-once Kafka; dedup by record id; Uber generates UUIDs used as idempotency keys in Hive and Pinot. Source: Uber.
- Exactly-once cost: Kafka transactions plus read_committed and 2-minute checkpoints; "the messages are converted to the 'committed' state using the two-phase commit protocol." Source: Uber.
- Single point of failure: the aggregation job; downtime "could result in overspend". Source: Uber.
- Hotspot ads: a viral ad overloads one partition; add nodes or split keys (book).
- Streaming vs batch: lambda (both) vs kappa (stream only with replay); book uses stream for real-time and batch for reconciliation. Source: book.
- Good enough latency: 2-4 minutes accepted over true real time. Source: Uber.

## Unknowns
- Book's aggregated DB choice details (Cassandra vs OLAP)
- Uber Pinot schema and retention
- Watermark values in production

## Candidates
- New kinds: none; sightings: stream-processor (12th), stream (21st), data-warehouse (14th: Pinot, Hive), nosql-database (26th), scheduled-job (13th: reconciliation), object-store (23rd: checkpoints), cache (25th: dedup state)
- New properties on existing kinds: stream-processor.windowing (2nd sighting), watermarkSeconds, checkpointIntervalSeconds, dedupBy, exactlyOnce (boolean); data-warehouse.realtime (boolean), upsert (boolean); stream.partitionKey (2nd sighting)
- New edge properties: transactional (boolean); idempotencyKey (boolean)
- New requirement paths: correctness.billingGrade (boolean); freshness.aggregatesMinutes; data.reconciliation (boolean)
- New rules:
  - billing-aggregation-without-exactly-once-or-reconciliation: correctness.billingGrade true and pipeline has neither exactlyOnce nor a reconciliation scheduled-job
  - windowed-aggregation-without-watermark: stream-processor event-time windowing with watermarkSeconds unset
  - aggregation-job-single-instance: stream-processor on critical money path with instances 1 and no failover (Uber SPOF)
  - dedup-missing-on-at-least-once-clicks: at-least-once client edges into aggregation with no dedup state and no idempotency key
  - hot-key-partitioning-without-mitigation: stream partitionKey equals a heavy-tail entity id with no key splitting (informational)

## Verification 2026-09-14

| URL | Reachable | Outcome |
|---|---|---|
| https://www.uber.com/blog/real-time-exactly-once-ad-event-processing/ | yes | Confirms Flink, Kafka, Pinot, Hive, Docstore (on Schemaless); the three jobs (aggregation job: cleanse, deduplicate via keyed state, store events to Docstore, aggregate by minute windows, generate record UUIDs; attribution job: filter order data, query Docstore for matching ad events, enrich, generate deterministic UUIDs; union and load job: combine Region A and Region B output, write to Pinot and Hive); `read_committed`; two-phase commit with messages uncommitted until a checkpoint every 2 minutes; record UUID as idempotency key for Hive dedup and Pinot upsert; two regions with Pinot active-active and no cross-region replication; "hundreds of millions of ad events per week"; 1-minute tumbling windows; 3-day Kafka retention for disaster recovery; the aggregation job as a single point of failure whose downtime delays pacing and risks overspend. |
| Alex Xu and Sahn Lam, System Design Interview vol 2, ch 6 (book, not online) | n/a | The book itself is not fetchable. Chapter content re-checked against two public transcriptions below. |
| https://github.com/wuyichen24/system-design-interview/blob/master/problems/Ad_Click_Event_Aggregation_System.md | yes | Confirms the log watcher reading logs and publishing into the first message queue, two message queues (raw events, aggregated results), the aggregation service built as Map / Aggregate / Reduce nodes, separate raw-data and aggregated-data databases, event time rather than processing time, tumbling windows for counts and sliding windows for top-N, delayed and duplicate events as explicit non-functional requirements, and the end-of-day reconciliation job that sorts click events by event time per partition and compares against the real-time result; recalculation from raw data with snapshots when a bug is found. Does **not** state the scale numbers. |
| Web search for the chapter architecture (algomaster.io, hellointerview, techinterview summaries) | yes | Independently confirm the Map / Aggregate / Reduce topology, partitioning by `ad_id`, the in-memory per-minute counts and per-node top-N heap, and the Reduce node merging the per-node tops into the final top-N per minute. |
| https://medium.com/@bugfreeai/... (card notes 403) | not used | The card already recorded this mirror as unreachable; nothing in the design rests on it. |

### Facts the card states that this pass could not confirm

- **1B clicks/day, 2M ads, ~10K average and 50K peak QPS, 0.1 KB per click, ~100 GB/day.** None of the reachable transcriptions carry these figures, and the book is not online. **Not encoded**: no `nfr.rps` is set on any node in the design.
- **Watermark length.** Neither source states a production watermark value (the card lists it under Unknowns). `watermarkSeconds: 60` on `aggregate-job` is set because the rule `windowed-aggregation-without-watermark` demands a declared value and both sources state that late events are handled rather than ignored; the number itself is an assumption, recorded in `notes.md`.
- **The dedup store's product.** Uber states "deduplicates via keyed state"; the card offers "Flink keyed state, Redis". The design uses the generic `cache-cluster`, not `redis`, and gives it a `ttl` eviction policy (the policy is required by a rule; the TTL length is not stated, so `ttlSeconds` is omitted).
- **The checkpoint backend.** Uber states a 2-minute checkpoint interval but never names the storage behind it; the card's "HDFS/S3" is general knowledge. Encoded as the generic `blob-store` with no properties.
- **Where the raw events live.** The book says a raw-data DB (the card suggests Cassandra); Uber says Hive. Both are encoded, each with the in-edges its own source describes (`map-job` appends raw events to the Cassandra store; the union-and-load job loads Hive).
- **Kafka partition counts, replication factor and acks** are stated by neither source and are omitted rather than guessed.
