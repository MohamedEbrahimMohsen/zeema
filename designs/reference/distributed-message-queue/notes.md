# distributed-message-queue: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/distributed-message-queue.md`
- Size: 15 nodes, 20 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture 30, clean variant: the internals of a log-based distributed message
queue - partitioned segment logs replicated to an in-sync replica set, offsets and transaction
state kept in compacted internal topics, and exactly-once held to the edge of the log.

Fixes relative to distributed-message-queue.broken.yaml:
  - coordination-service is a replicated ensemble (ZooKeeper quorum or KRaft), so the metadata
    and leader-election dependency every broker shares has no single instance
  - quota-enforcer applies the broker's per (user, client-id) byte-rate and request-rate quotas
    in front of the log, so a producer retrying with backoff cannot saturate the broker it is
    already overloading
  - streams-app writes its remote side effect asynchronously and idempotently, because the
    transaction covers output topics and offsets only, never a remote store
  - security.credentialRotationDays is declared for the volumes that hold every segment file
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture 30, broken variant: the same log-based message queue, built the way a
team commonly builds it first: a single coordination instance behind every broker, no broker
quotas in front of a producer that retries into the log it is already saturating, a stream
processor that makes its remote side effect a blocking call inside the exactly-once loop, and
no stated rotation for the credentials that reach the volumes holding every segment file.

This file MUST trip:
  - shared-dependency-without-redundancy    (coordination-service replicated false while availability.discoveryRedundant is true)
  - retry-without-adaptive-shedding         (producer-client -> broker-cluster retries exponentially, no circuit breaker, no quota limiter in front of the broker)
  - exactly-once-with-external-side-effects (streams-app consumes exactly-once and calls remote-store synchronously)
  - credentials-without-rotation            (segment volumes present, no rotation period, no key-management node)
and MUST NOT trip:
  - stateful-engine-pinned-to-single-zone   (the design draws trust zones, not availability zones)
  - stateful-node-without-zone-redundancy   (same: no availability-zone group anywhere)
  - queue-missing-dlq, retry-queue-without-dlq, retry-without-backoff, pubsub-replay-required
    (every topic here is a stream; there is no queue and no pubsub-topic node)
  - cache-missing-eviction-policy, cache-as-primary-store-without-persistence,
    materialised-cache-without-rebuild-path, read-heavy-path-without-cache (no cache node)
  - datastore-missing-backup, datastore-single-region, single-writer-primary-at-peak-qps,
    read-replica-as-sole-scaling, business-updates-without-index-propagation (no relational node)
  - derived-store-without-cdc-or-rebuild (no search index)
  - windowed-aggregation-without-watermark (streams-app windows nothing; the source states no windowing)
  - external-call-inline-without-durable-path (the node calling the remote store is a stream
    processor, not an app-server, and the log it reads is its durable path)
  - fanout-inline-in-request-path, push-fanout-without-celebrity-path (no worker is called synchronously)
  - sync-chain-too-deep (no api-gateway node and no latency.p95Ms target)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Application that produces messages | `producer-app` | `container-service` | app-server | close |
| Producer client (buffer, partitioner, retries, acks 0/1/all, idempotent with producer id and sequence numbers) | `producer-client` | `sdk-client` | client | exact |
| Quotas: per-client byte and request rate limits | `quota-enforcer` | `in-process-limiter` | rate-limiter | close |
| Broker: owns partitions, appends to segment files, serves pulls; topic partitions and segments; replication with leader, ISR, min.insync.replicas; log compaction | `broker-cluster` | `kafka` | stream | exact |
| WAL and segment files on disk | `segment-storage` | `block-volume` | block-storage | close |
| State storage: consumer offsets per group (`__consumer_offsets`, compacted) | `offsets-topic` | `kafka` | stream | exact |
| Transaction log as an internal topic | `txn-log-topic` | `kafka` | stream | exact |
| Dead-letter queue (extension) | `dead-letter-topic` | `kafka` | stream | close |
| Consumer group coordinator (assigns partitions, rebalances) | `group-coordinator` | `container-service` | app-server | assumed |
| Transaction coordinator | `transaction-coordinator` | `container-service` | app-server | assumed |
| Coordination service + metadata storage (ZooKeeper or KRaft quorum) | `coordination-service` | `zookeeper` | coordination-service | exact |
| Consumer client (pulls by offset, commits offsets, `read_committed`) | `consumer-client` | `sdk-client` | client | exact |
| Application that consumes messages | `consumer-app` | `container-worker` | worker | close |
| Stream processing application with exactly-once (Kafka Streams) | `streams-app` | `kafka-streams` | stream-processor | exact |
| The "remote store" an exactly-once side effect updates | `remote-store` | `supplier-api` | third-party-api | assumed |

Tally: 7 exact, 5 close, 3 assumed.

Boxes 5 and 6 of the card (coordination service, metadata storage) are one node: the card itself
records metadata storage as living "in coordination service", and both mirrors describe ZooKeeper
(or the KRaft quorum) as the single place that holds topic and partition metadata. Boxes 3, 4 and
11 (partitions and segments, replication and ISR, log compaction) are properties of the `stream`
kind, exactly as the card's candidate column says, not nodes.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Consumer group coordinator (broker role: partition assignment, rebalance) | `control-plane-coordinator` (the card's candidate kind; it does not exist) | `container-service`, `stateless: false`, role in the label |
| Transaction coordinator (broker role: transaction log, commit markers) | `control-plane-coordinator` | `container-service`, `stateless: false`, role in the label |
| Broker-side quota enforcement | a broker-resident `rate-limiter` | `in-process-limiter` (`placement: in-process`) — Kafka enforces quotas inside the broker process, so the placement fits, the component is a library limiter |
| Generic remote service or external datastore behind a side effect | a neutral `third-party-api` | `supplier-api`, the only generic third-party API in the catalogue |

No component was added to the catalogue.

## Assumed, not stated

- `retentionHours: 336` — the book's two-week retention example. No reachable page repeats it.
- `encryptionAtRest: true` on `segment-storage` and `security.credentialRotationDays: 90` — the
  card sources encryption and ACLs to the grab-geo card, not to this system's own sources. The
  rotation period is set because `credentials-without-rotation` reads it and every broker's disks
  hold the whole log; ninety days is the value the other reference designs use, not a source fact.
- `availability.discoveryRedundant: true` — the sources say leader election runs on a ZooKeeper
  ensemble or a Raft quorum, which is redundant by construction; the requirement states that
  explicitly rather than quoting a number.
- `replicationFactor: 3` / `minInsyncReplicas: 2` / `acks: "all"` — stated as the durability
  configuration by the Kafka replication docs ("a topic with a replication factor of 3, set
  min.insync.replicas to 2, and produce with acks of all"), and by the card.
- `checkpointIntervalSeconds: 1` on `streams-app` — the Confluent measurements are quoted at a
  100 ms commit interval; the integer-seconds property cannot express 0.1, so the nearest legal
  value is used and the number itself is not relied on anywhere.

## Not encoded

- Leader-to-follower replication fetch and ISR membership: the broker cluster is one `stream`
  node, so the replication arrow inside it has nowhere to go; `replicationFactor`, `minInsyncReplicas`
  and `acks` carry it instead.
- Unclean leader election (the availability-versus-durability switch): no property or requirement
  path expresses it.
- `isolation.level = read_committed` on the consumer: `client` has no such property; it is in the
  node label and on the fetch edge's label.
- Partition count, segment size and the WAL's own sizing: the sources state no numbers.
- The throughput costs of exactly-once (3% / 20% / 15-30%) and the message-format gains (+20% /
  +50%): measurements about a configuration, not about a box or an arrow.
- Rebalance stalls, consumer-group churn and controller/metadata limits at thousands of brokers:
  failure modes the sources discuss, with no field to hold them.
- Delayed messages: the card lists them as a book extension; no fetched source describes an
  implementation, so no node was invented for them.
- Zero-copy transfer to consumers: could not be confirmed on any reachable page, and the format
  has no property for it.
