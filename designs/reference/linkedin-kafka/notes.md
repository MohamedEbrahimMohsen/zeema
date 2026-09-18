# linkedin-kafka: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/linkedin-kafka.md`
- Size: 22 nodes, 27 edges, 6 groups.

## Clean variant (header of design.yaml)

Reference architecture 8, clean variant: LinkedIn's log-centric event pipeline, where every
activity event and database change is published once into tiered Kafka clusters, mirrored
across datacenters by Brooklin and consumed by Samza, Espresso, Venice, Pinot and Hadoop.

Fixes relative to linkedin-kafka.broken.yaml:
  - zookeeper is a replicated ensemble, so the metadata store every Kafka cluster and every
    Brooklin coordinator depends on has no single instance
  - samza does no event-time windowing it cannot close; the source describes continuous
    stateful processing over Kafka, not watermarked windows
  - espresso keeps a single-leader replication model instead of accepting writes in every
    datacenter with no conflict policy
  - producer-service produces without an unguarded exponential retry into the broker it is
    already overloading
  - security.credentialRotationDays is declared for the clusters that carry every event
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture 8, broken variant: the same LinkedIn event pipeline, built the way a
team commonly builds it first: one ZooKeeper instance behind every cluster and every Brooklin
coordinator, Samza windowing by event time with nothing to close a window, Espresso taking
writes in both datacenters with no conflict policy, producers retrying exponentially into the
broker they are already saturating, and no stated credential rotation for the clusters that
carry every event in the company.

This file MUST trip:
  - shared-dependency-without-redundancy   (zookeeper replicated false while availability.discoveryRedundant is true)
  - windowed-aggregation-without-watermark (samza windows by event time with no watermarkSeconds)
  - multi-leader-store-without-conflict-policy (espresso multi-region-multi-leader, no conflictResolution)
  - retry-without-adaptive-shedding        (producer-service -> local-kafka retries exponentially, no circuit breaker, no limiter)
  - credentials-without-rotation           (data nodes present, no rotation period, no key-management node)
and MUST NOT trip:
  - datastore-missing-backup, datastore-single-region, single-writer-primary-at-peak-qps,
    read-replica-as-sole-scaling, business-updates-without-index-propagation (no relational node)
  - queue-missing-dlq, retry-queue-without-dlq, retry-without-backoff, pubsub-replay-required
    (the pipeline is streams, not queues or fan-out topics)
  - cache-missing-eviction-policy, cache-as-primary-store-without-persistence,
    materialised-cache-without-rebuild-path, read-heavy-path-without-cache (no cache node)
  - stateful-engine-pinned-to-single-zone, stateful-node-without-zone-redundancy
    (the design draws datacenters, not availability zones)
  - derived-store-without-cdc-or-rebuild (no search index)
  - sync-chain-too-deep (no latency.p95Ms target is stated)
  - fanout-inline-in-request-path, push-fanout-without-celebrity-path,
    shared-worker-pool-across-queues, external-call-inline-without-durable-path (no such edges)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Producer services (LiKafka wrappers) | `producer-service` | `container-service` | app-server | close |
| Producer services, second datacenter | `producer-service-sg` | `container-service` | app-server | close |
| Non-Java clients of the REST proxy | `non-java-client` | `sdk-client` | client | close |
| REST proxy (Kafka REST) | `rest-proxy` | `envoy-gateway` | api-gateway | assumed |
| Schema registry | `schema-registry` | `confluent-schema-registry` | schema-registry | close |
| Local Kafka cluster (per datacenter) | `local-kafka` | `kafka` | stream | exact |
| Local Kafka cluster, Singapore | `local-kafka-sg` | `kafka` | stream | exact |
| Aggregate Kafka cluster | `aggregate-kafka` | `kafka` | stream | exact |
| Per-purpose cluster (CDC) | `cdc-kafka` | `kafka` | stream | exact |
| Brooklin (mirroring and CDC) | `brooklin` | `brooklin` | change-data-capture | exact |
| ZooKeeper | `zookeeper` | `zookeeper` | coordination-service | exact |
| Cruise Control | `cruise-control` | `container-worker` | worker | assumed |
| Kafka Monitor | `kafka-monitor` | `observability-stack` | monitoring | close |
| Burrow | `burrow` | `observability-stack` | monitoring | close |
| Audit trail / Bean Counter | `audit-trail` | `observability-stack` | monitoring | close |
| TopicGC | `topic-gc` | `cron-job` | worker | close |
| Samza | `samza` | `samza` | stream-processor | exact |
| Espresso | `espresso` | `nosql-store` (model document) | nosql-database | close |
| Venice | `venice` | `nosql-store` (model key-value) | nosql-database | close |
| Pinot | `pinot` | `pinot` | data-warehouse | exact |
| Gobblin | `gobblin` | `container-worker` (trigger stream) | worker | close |
| Hadoop | `hadoop` | `hdfs` | file-storage | close |

Confidence tally: 8 exact, 11 close, 3 assumed.

Two source rows are deliberately not nodes. **Kafka controller** (card row 9) is a role inside a
Kafka cluster, not a box beside it, so the `stream` nodes carry it. **Nuage** (card row 15) is
the self-service topic portal and the card itself marks it "not tallied".

Two more are legacy: **MirrorMaker** (row 6) and **Databus** (row 17) are the predecessors the
sources say Brooklin replaced, so the current runtime has one `brooklin` node doing both jobs —
mirroring `local-kafka` and `local-kafka-sg` into `aggregate-kafka`, and capturing Espresso
changes into `cdc-kafka`.

Three values in the clean design are not read off the page:

- `availability.discoveryRedundant: true` is implied, not stated. ZooKeeper is the source of
  truth for every Kafka cluster and every Brooklin coordinator; the sources treat daily broker
  failure as routine, which is only survivable if that metadata store is an ensemble.
- `zookeeper.replicated: true` follows from the same reasoning, and from the Brooklin
  architecture wiki describing several Brooklin servers sharing one ZooKeeper as their source
  of truth.
- `security.credentialRotationDays: 90` is the rule-satisfying value the brief asks for when a
  source is silent: `credentials-without-rotation` reads it, the sources say nothing about
  credential lifetimes, and a company-wide event backbone rotates them.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Kafka REST proxy (LinkedIn) | api-gateway, but `default` has no generic api-gateway component | `envoy-gateway`, labelled "Kafka REST proxy" |
| LinkedIn schema registry (in-house) | schema-registry | `confluent-schema-registry`, labelled "LinkedIn schema registry" |
| Cruise Control | a control-plane coordinator kind that rebalances and self-heals a cluster | `container-worker` (trigger `schedule`) |
| Kafka Monitor | monitoring, synthetic produce and consume probe | `observability-stack` |
| Burrow | monitoring, consumer-lag evaluator | `observability-stack` |
| Kafka audit / Bean Counter | monitoring, count reconciliation | `observability-stack` |
| TopicGC | worker on a schedule | `cron-job` |
| Espresso | nosql-database (document) | `nosql-store` with `model: document` |
| Venice | nosql-database (derived-data serving) | `nosql-store` with `model: key-value` |
| Gobblin | worker / ingestion framework | `container-worker` (trigger `stream`) |
| Hadoop | file-storage | `hdfs` (the YARN compute side is not drawn) |

## Not encoded

- Scale: 7T messages/day, 100+ clusters, 4,000+ brokers, 100,000 topics, 7M partitions. The `stream` kind has no property for any of them, and no source reachable in this pass repeats the card's 4.5M messages/sec, so no `nfr.rps` is set anywhere.
- Cluster tiering. The format has no `tier` on `stream`; local, aggregate and CDC survive only in `label` and in the edge topology.
- The Kafka controller and its memory pressure past 140 brokers: a role inside a cluster, with no property to hold it.
- Maintenance mode, the `-li` fork and its patches, and the upstream-first release tradeoff: operational practice, not runtime structure.
- Rack-aware replica placement and time-based replica lag: `stream` has `replicationFactor` and `minInsyncReplicas`, but no placement constraint and no lag metric.
- Burrow's sliding window of ~10 offset commits and the audit's 10-minute reconciliation window: both live in edge `label` text; `monitoring` has no window property.
- TopicGC's result (20% fewer topics, 30% better performance): an outcome, not a property.
- Nuage, the self-service topic portal, and the Kafka push job as a distinct box: the push job is an edge from `hadoop` into `aggregate-kafka`, not a node.
- Brooklin's connector set beyond Kafka and Espresso (Oracle, Event Hubs, Kinesis): no sources for them are drawn, so encoding the connectors alone would add orphan nodes.
- Samza's state living in log-compacted Kafka topics is encoded as `changelogTopics: true` plus `compaction: true` on `aggregate-kafka`, but the format cannot say that one node's state lives in another.
- Retention per tier, exactly-once usage, cross-datacenter failover of the aggregate clusters and the current Azure topology: the card lists all four as unknown and nothing here asserts them.
