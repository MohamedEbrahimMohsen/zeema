# Intake: LinkedIn event pipeline (Kafka ecosystem, Brooklin, Samza, Espresso, Venice)

## Source
- Primary: https://www.linkedin.com/blog/engineering/open-source/apache-kafka-trillion-messages (official, 2019: 7T messages/day, 100+ clusters, 4,000 brokers, customisations)
- Primary: https://www.linkedin.com/blog/engineering/open-source/kafka-ecosystem-at-linkedin (official, 2016: ecosystem, MirrorMaker, schema registry, REST proxy, audit, Burrow, Gobblin, Samza)
- Primary: https://www.linkedin.com/blog/engineering/data-streaming-processing/load-balanced-brooklin-mirror-maker-replicating-large-scale-kaf (official, 2022) and https://www.linkedin.com/blog/engineering/open-source/brooklin-open-source (official, 2019; redirect not followed in this pass)
- Primary: https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying (Jay Kreps, 2013; 404 in this pass, well-known content used only for rationale)
- Secondary: https://factorhouse.io/articles/linkedin-kafka-architecture/ (synthesis with citations to LinkedIn posts and talks)
- Verified by: three official LinkedIn engineering posts + cited secondary
- Confidence: high
- Date of source: 2013-2022

## System in three lines
The original log-centric data platform: every activity event, database change and metric is published once into Kafka and consumed by search, stream processing, derived-data serving, monitoring and Hadoop. Clusters are tiered per datacenter (local, then aggregate) and mirrored across datacenters by Brooklin; Samza processes streams with Kafka as its state store; Espresso and Venice use Kafka as their replication and ingestion path. Hard because the pipeline is the integration backbone for the whole company, so controller failures, consumer lag and cross-datacenter replication become company-wide incidents.

## Scale (only if stated)
- Users / DAU: not stated
- Requests per second: 4.5M messages/sec peak (2015)
- Data volume: 1.4T messages/day across 1,400 brokers and 2 PB/week (2016); 7T messages/day, 100+ clusters, 4,000+ brokers, 100,000 topics, 7M partitions (2019)
- Message throughput: Brooklin mirrors 7T+ messages/day between clusters, "hundreds of simultaneous datastreams"
- Cluster size: controller problems at 140+ brokers per cluster
- TopicGC: 20% fewer topics, 30% performance improvement (2022)

## Requirements stated or clearly implied
- Availability target: daily broker failures handled automatically (Cruise Control); rack-aware replica placement
- Consistency: at-least-once delivery; audit service verifies completeness in 10-minute windows; LiKafka REST client "guaranteed delivery"
- Latency target: near real-time; time-based replica lag rather than bytes
- Ordering needs: per partition
- Replay or reprocessing: log retention allows consumers to replay; Hadoop reloads from Kafka
- Retention: not quantified
- Compliance / residency: not stated
- Schema governance: every message Avro with schema-ID from central registry

## Boundaries
- Regions / zones: multiple datacenters (US, Singapore); racks matter for replica placement
- Trust zones: producers (services, clients via REST proxy) -> local Kafka -> aggregate Kafka -> consumers; Nuage portal for self-service topic management
- Named subsystems: Kafka clusters (local, aggregate, per-purpose), Mirroring (MirrorMaker then Brooklin), Schema registry, REST proxy, LiKafka clients, Audit trail, Monitoring (Kafka Monitor, Burrow, Bean Counter), Cruise Control, Samza, Databus then Brooklin CDC, Espresso, Venice, Gobblin to Hadoop, Pinot

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Producer services | Publish activity, metrics, CDC via LiKafka wrappers (Avro, audit, large messages) | Java services | app-server | |
| 2 | REST proxy | HTTP gateway for non-Java clients and admin ops | Kafka REST (LinkedIn) | api-gateway | guaranteedDelivery: true |
| 3 | Local Kafka cluster (per DC) | First hop, producers write locally | Apache Kafka (-li branch) | stream | tier: local |
| 4 | Aggregate Kafka cluster | Consolidates events from all DCs for consumers | Apache Kafka | stream | tier: aggregate |
| 5 | Per-purpose clusters | Tracking, metrics, queuing, CDC clusters separated | Apache Kafka | stream | clusters: 100+ |
| 6 | MirrorMaker (legacy) | Consume source, produce target within and across DCs | Kafka MirrorMaker | worker (replication) | |
| 7 | Brooklin | Streaming bridge and CDC: datastreams, connectors (Kafka, Espresso, Oracle, EventHubs, Kinesis), coordinator on Zookeeper, load-balanced mirroring | Brooklin (open source) | change-data-capture + worker (mirroring) | datastreams: hundreds |
| 8 | Schema registry | Avro schemas by id embedded in messages | in-house | schema-registry (new) | format: avro |
| 9 | Kafka controller | Cluster metadata leader; memory pressure at 140+ brokers | Kafka | property of stream | |
| 10 | Zookeeper | Kafka and Brooklin coordination | Apache Zookeeper | coordination-service | |
| 11 | Cruise Control | Monitors clusters, rebalances partitions, self-heals broker failures | Cruise Control (open source) | control-plane-coordinator | |
| 12 | Kafka Monitor | Synthetic produce/consume validation | Kafka Monitor (open source) | monitoring | |
| 13 | Burrow | Consumer lag by sliding window of ~10 offset commits | Burrow (open source) | monitoring | |
| 14 | Audit trail / Bean Counter | Producer vs consumer counts per 10-minute window to detect loss | in-house | monitoring | windowMinutes: 10 |
| 15 | Nuage | Self-service topic CRUD portal | in-house | ops tooling, not tallied | |
| 16 | Samza | Stream processing with Kafka as input, output and state store | Apache Samza | stream-processor | stateBackend: kafka |
| 17 | Databus (legacy) | CDC from Oracle and Espresso | Databus | change-data-capture | |
| 18 | Espresso | Document store; replication moved from MySQL replication to Kafka CDC | Espresso (in-house on MySQL) | nosql-database (document) | replicationViaLog: true |
| 19 | Venice | Derived-data serving store fed asynchronously from Kafka and Hadoop | Venice (open source) | nosql-database (derived) | batchAndRealtime: true |
| 20 | Pinot | Real-time OLAP over Kafka | Apache Pinot | data-warehouse (real-time olap) | |
| 21 | Gobblin | Kafka to Hadoop ingestion | Gobblin (open source) | etl-job | |
| 22 | Hadoop | Batch storage and compute | Hadoop | data-warehouse | |
| 23 | TopicGC | Deletes unused topics automatically | in-house | scheduled-job | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| producer-service | local-kafka | kafka (likafka) | async | at-least-once | avro + schema id + audit header |
| non-java client | rest-proxy | http | sync | | |
| rest-proxy | local-kafka | kafka | async | at-least-once | guaranteed delivery client |
| producer-service | schema-registry | http | sync | | register/lookup schema |
| local-kafka | brooklin | kafka | async | at-least-once | mirror source |
| brooklin | aggregate-kafka | kafka | async | at-least-once | cross-DC |
| brooklin | zookeeper | zk | sync | | coordinator |
| espresso / oracle | brooklin | binlog / trail | async | at-least-once | CDC |
| brooklin | cdc-kafka | kafka | async | at-least-once | |
| aggregate-kafka | samza | kafka | async | at-least-once | |
| samza | kafka | kafka | async | | output and changelog state |
| kafka | venice | kafka | async | | derived data ingestion |
| hadoop | venice | batch push via kafka | async | | |
| kafka | pinot | kafka | async | | real-time OLAP |
| kafka | gobblin | kafka | async | | |
| gobblin | hadoop | hdfs | async | | |
| kafka-monitor | kafka | produce/consume | sync | | synthetic |
| burrow | kafka | consumer offsets | async | | lag |
| cruise-control | kafka | admin | async | | rebalance, self-heal |
| audit | kafka | consume | async | | 10-minute windows |

## Failure modes, incidents, tradeoffs the source discusses
- Controller failure at scale: "slow controllers and controller failure caused by memory pressure" in clusters with 140+ brokers; patches to cut controller memory and logging. Source: trillion-messages.
- Slow deploys: patches to "reduce startup and shutdown time" and "improving shutdown time by reducing lock contention". Source: trillion-messages.
- Broker removal risk: maintenance mode stops new replicas so brokers can be removed without data loss. Source: trillion-messages.
- Release strategy tradeoff: upstream-first vs LinkedIn-first hotfixes on a "-li" branch; carrying a fork costs maintenance. Source: trillion-messages.
- Data loss detection by reconciliation: audit trail compares producer and consumer counts; loss is detected, not prevented. Source: ecosystem.
- Lag alerts on rate not threshold: Burrow uses a sliding window of ~10 commits because fixed thresholds misfire. Source: factorhouse citing Burrow post.
- Time-based replica lag instead of bytes; rack-aware placement against switch failures. Source: factorhouse.
- Daily broker failures are expected; Cruise Control automates rebalancing. Source: factorhouse citing Cruise Control post.
- Topic sprawl: TopicGC removed 20% of topics for 30% performance gain. Source: factorhouse citing TopicGC post.
- MirrorMaker replaced by Brooklin for load-balanced mirroring of hundreds of datastreams. Source: brooklin posts.
- Log-centric rationale: point-to-point integrations grow O(N^2); a central log decouples publishers and subscribers. Source: The Log (rationale only).

## Unknowns
- Retention per cluster tier
- Exactly-once semantics usage
- Cross-DC failover of aggregate clusters
- Current cloud (Azure) topology

## Candidates
- New kinds: schema-registry (Confluent SR, Glue registry, LinkedIn registry); sightings: stream (7th), change-data-capture (2nd: Brooklin, Databus), stream-processor (2nd: Samza), control-plane-coordinator (4th: Cruise Control), coordination-service (5th), monitoring (6th), data-warehouse (5th), etl-job (6th), scheduled-job (3rd), nosql-database (10th), api-gateway (8th: REST proxy)
- New properties on existing kinds: stream.tier (local, aggregate); stream.clusters (integer), brokers, partitions, topics; stream.schemaEnforced (boolean); stream.auditWindowMinutes; stream-processor.stateBackend; nosql-database.replicationViaLog (boolean)
- New edge properties: mirrored (boolean); schemaId (boolean)
- New requirement paths: data.schemaGovernance (boolean); observability.lagMonitoring (boolean); data.lossDetection (boolean)
- New rules:
  - stream-without-schema-registry: stream with many producers and no schema-registry node while data.schemaGovernance true
  - cross-dc-consumers-on-local-tier: consumer in DC B reading a local-tier stream in DC A with no mirroring worker
  - large-cluster-without-rebalancer: stream with brokers above threshold and no control-plane-coordinator (Cruise Control class)
  - stream-consumers-without-lag-monitoring: stream with consumer edges and no monitoring node observing offsets
  - at-least-once-pipeline-without-audit: multi-hop at-least-once pipeline and data.lossDetection true with no audit/monitoring reconciliation
