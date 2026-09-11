# Intake: Distributed message queue internals (Xu vol 2 ch 4) with Kafka design and exactly-once semantics

## Source
- Primary: Alex Xu and Sahn Lam, System Design Interview vol 2, chapter 4 "Distributed Message Queue"; chapter notes via search summary of https://raymondjones.dev/en/system-design-notes/4-distributed-message-queue/ (page rendered client-side, not readable in this pass)
- Primary: https://www.confluent.io/blog/exactly-once-semantics-are-possible-heres-how-apache-kafka-does-it/ (official Confluent, Neha Narkhede: idempotent producer, transactions, overhead numbers)
- Primary: Kafka design documentation https://kafka.apache.org/documentation/#design (navigation only in this pass) and Kafka 2011 paper (PDF unreadable); content well established and consistent with the linkedin-kafka and slack-messaging cards
- Cross-references: linkedin-kafka (7T messages/day, tiers, mirroring, controller limits), slack-messaging (Kafkagate leader-ack, JQRelay), grab-geo (Kafka on Kubernetes storage), robinhood-trading (Postgres DLQ), reddit-feed (offset-reset replay)
- Verified by: canonical textbook chapter + official Confluent post + production cards
- Confidence: high
- Date of source: 2011-2022

## System in three lines
A log-based queue where producers append messages to partitioned topics stored as segment files on disk, brokers replicate each partition to followers with an in-sync replica set and acknowledge writes at a chosen level (0, 1, all), and consumers pull by offset in consumer groups whose assignment is coordinated by a coordinator with metadata in ZooKeeper or an internal quorum. Delivery is at-least-once by default; exactly-once needs idempotent producers with sequence numbers and transactions that commit output and consumer offsets atomically. Hard because durability, throughput and ordering pull against each other, rebalances stall consumers, and exactly-once stops at the boundary of external side effects.

## Scale (only if stated)
- Users / DAU: not applicable
- Requests per second: production anchors from linkedin-kafka (7T messages/day, 4,000 brokers) and robinhood (2.2M messages/sec)
- Data volume: book retention example two weeks; message size KBs; segments on disk
- Message throughput: Confluent measurements: idempotence "negligible" overhead; transactions at 100 ms intervals cost ~3% throughput vs at-least-once and ~20% vs at-most-once; Kafka Streams exactly-once 15-30% degradation; new message format gave +20% producer and +50% consumer throughput for small messages
- Latency: larger commit intervals cut overhead but raise end-to-end latency for read_committed consumers

## Requirements stated or clearly implied
- Availability target: partition leader failover from ISR; unclean leader election trades availability for durability
- Consistency: ordering within a partition only; acks=all with min.insync.replicas for durability; exactly-once per partition via sequence numbers, across partitions via transactions
- Latency target: batching and linger raise throughput at latency cost
- Ordering needs: per partition; keyed messages to one partition
- Replay or reprocessing: retention-based; consumers rewind offsets (Reddit "time travel")
- Retention: time or size based; compaction keeps last value per key
- Compliance / residency: encryption and ACLs (zero-trust, see grab card)
- Delayed messages and dead-letter queues as extensions (book)

## Boundaries
- Regions / zones: brokers spread across AZs; cross-region via mirroring (linkedin card)
- Trust zones: producers and consumers authenticated to brokers; coordination service internal
- Named subsystems: Producers (buffer, partitioner, retries), Brokers (partitions, segments, WAL, replication), Coordination service (ZooKeeper or KRaft), Metadata storage, State storage (offsets), Consumer groups and coordinator, Transaction coordinator

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Producer client | Buffers, batches, routes by key to partition, retries with acks 0/1/all; idempotent with producer id and sequence numbers | Kafka producer | sdk-client | acks: all; idempotent: true |
| 2 | Broker | Owns partitions; appends to segment files; serves pulls; sequential IO and page cache; zero-copy | Kafka broker | stream | |
| 3 | Topic partition and segments | Append-only log split into segment files; index files | Kafka | property of stream | partitions: n; segmentBytes |
| 4 | Replication (leader, ISR) | Followers fetch from leader; ISR set; min.insync.replicas; unclean leader election flag | Kafka | property of stream | replicationFactor: 3; minIsr: 2 |
| 5 | Coordination service | Leader election, membership, metadata | ZooKeeper or KRaft quorum | coordination-service | |
| 6 | Metadata storage | Topics, partitions, configs | in coordination service | coordination-service | |
| 7 | State storage | Consumer offsets per group | internal topic (__consumer_offsets) | stream (compacted) | compacted: true |
| 8 | Consumer group coordinator | Assigns partitions to consumers; rebalances on membership change | Kafka broker role | control-plane-coordinator | |
| 9 | Consumer client | Pulls by offset; commits offsets; read_committed isolation | Kafka consumer | sdk-client | isolation: read_committed |
| 10 | Transaction coordinator | Manages producer transactions; transaction log as internal topic | Kafka broker role | control-plane-coordinator | |
| 11 | Log compaction | Retain last value per key | Kafka | property of stream | |
| 12 | Quotas | Per-client byte and request rate limits | Kafka | rate-limiter (broker-side) | |
| 13 | Dead-letter and delay queues (extension) | Failed and scheduled messages | topic or external store | queue (dlq role) | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| producer | broker (leader) | kafka protocol | async | at-least-once (acks all) or at-most-once (acks 0) | batched, keyed |
| leader | followers | replication fetch | async | | ISR tracking |
| broker | disk (segment) | sequential write | sync | | page cache |
| consumer | broker | pull | sync | | by offset |
| consumer | offsets topic | commit | async | | state storage |
| consumer group | coordinator | heartbeat | async | | rebalance |
| broker | coordination service | metadata | sync | | leader election |
| producer (txn) | transaction coordinator | begin/commit | sync | | atomic multi-partition |
| consumer (read_committed) | broker | pull | sync | | waits for commit |
| broker | dead-letter topic | produce | async | | on consumer failure (extension) |

## Failure modes, incidents, tradeoffs the source discusses
- Duplicates on retry: broker crashes after write but before ack; producer retries; fix is idempotent producer with sequence numbers persisted in the log. Source: Confluent.
- Loss on acks 0/1: leader ack without replication; slack card shows the deliberate leader-ack trade. Source: Confluent, slack card.
- Exactly-once boundary: side effects such as "remote RPC calls, external database updates" fall outside guarantees. Source: Confluent.
- Throughput cost of transactions: 3% vs at-least-once, 20% vs at-most-once; streams 15-30% at 100 ms commits. Source: Confluent.
- Rebalance stalls consumption; consumer group churn is a common outage cause (book scalability section). Source: book summary.
- Unclean leader election: availability vs durability when ISR empty. Source: Kafka design (well established).
- Controller and metadata limits at thousands of brokers. Source: linkedin card.
- Ephemeral broker storage breaks recovery. Source: grab card.

## Unknowns
- Book's exact WAL and segment sizing recommendations
- KRaft specifics vs ZooKeeper (book predates broad KRaft adoption)
- Delayed message implementation in the book

## Candidates
- New kinds: none; sightings: stream (19th, as the whole system), coordination-service (18th), control-plane-coordinator (10th: group and transaction coordinators), sdk-client (4th), rate-limiter (7th: quotas), queue dlq (16th)
- New properties on existing kinds: stream.acks (0, 1, all), minInsyncReplicas, uncleanLeaderElection (boolean), idempotentProducer (boolean), transactions (boolean), compaction (boolean), retentionHours, partitions; sdk-client.isolation (read_committed, read_uncommitted)
- New edge properties: deliveryGuarantee already (at-most-once, at-least-once, exactly-once) plus acks; keyed (boolean)
- New requirement paths: messaging.exactlyOnce (boolean); messaging.orderingScope (partition, global); durability.minReplicasAcked
- New rules:
  - exactly-once-claimed-without-idempotent-producer: edge deliveryGuarantee exactly-once into stream with idempotentProducer false or transactions false
  - acks-all-without-min-isr: stream acks all with minInsyncReplicas 1 (false durability)
  - unclean-election-under-durability-requirement: uncleanLeaderElection true while durability.minReplicasAcked above 1
  - global-ordering-on-multi-partition-topic: messaging.orderingScope global while stream partitions above 1 and consumer edges unkeyed
  - exactly-once-with-external-side-effects: exactly-once consumer edge to a node with sync edges to third-party-api or external datastore (boundary warning)
  - offsets-in-external-store-under-transactions: consumer commits offsets to non-stream store while transactions true (loses atomicity)
