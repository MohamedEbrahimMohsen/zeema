# Intake: Grab geo services and platform (Pharos driver search, GrabMaps, Coban Kafka, Catwalk)

## Source
- Primary: https://engineering.grab.com/pharos-searching-nearby-drivers-on-road-network-at-scale (official, 2020: in-memory road-network KNN driver search)
- Primary: https://engineering.grab.com/building-hyperlocal-grabmaps (official, 2023: OSM + KartaView + probe data, geohash processing on Spark)
- Primary: https://engineering.grab.com/kafka-on-kubernetes (official, 2023: Coban, Strimzi, EBS, AZ spread)
- Primary: https://engineering.grab.com/zero-traffic-cost (official, 2023: rack-aware consumers, cross-AZ cost)
- Primary: https://engineering.grab.com/designing-resilient-systems-part-1 (official: Hystrix-Go circuit breakers)
- Primary: https://engineering.grab.com/catwalk-evolution (official, 2024: model serving, 1,400 models)
- Verified by: six official Grab engineering posts
- Confidence: high
- Date of source: 2020-2024

## System in three lines
Southeast Asian super app whose dispatch finds the K nearest drivers by driving distance, not straight line, using Pharos: an in-memory service holding drivers snapped onto OpenStreetMap road graphs partitioned per city and vehicle type, answering updates in 10 ms and nearby queries in 50 ms at p99. Maps come from GrabMaps, built hyperlocally from OSM, KartaView imagery and ride probe data in geohash units on Spark; streaming runs on Coban (Kafka on Kubernetes across three AZs); models serve via Catwalk. Hard because drivers move constantly, road detours make Euclidean search wrong, cross-AZ traffic costs money, and 1,400 models must be served self-serve.

## Scale (only if stated)
- Users / DAU: not stated; GrabMaps covers 428 cities in eight countries
- Requests per second: not stated
- Data volume: not stated
- Message throughput: not stated
- Latency: Pharos p99 10 ms driver update, 50 ms nearby query
- Kafka: one cluster per EKS cluster, one broker per node, three AZs, min RF 3; broker resync "minutes" not "hours" after node rotation with EBS; cross-AZ traffic 67% of consumer fetches before rack awareness, 25% drop after
- Catwalk: 8 models to 300 (1 year) to 1,400 models via 200 orchestrators

## Requirements stated or clearly implied
- Availability target: survive node and AZ loss for Kafka; graceful broker shutdown on termination events
- Consistency: Pharos "favors high throughput over strong consistency of KNN query results"; snapshot-based reads; writes serialised per model
- Latency target: driver allocation in tens of ms; rack-aware fetching adds "up to 500ms" so not for latency-critical streams
- Ordering needs: per-partition Kafka ordering
- Replay or reprocessing: Kafka RF 3; GrabMaps rebuilt from OSM and probe data
- Retention: not stated
- Compliance / residency: zero-trust Kafka (post title)
- Isolation: city-level model isolation prevents cross-city allocation

## Boundaries
- Regions / zones: AWS three AZs; Kafka ASG per AZ; Pharos models partitioned by city and vehicle type
- Trust zones: passenger and driver apps -> API -> dispatch services -> Pharos; internal streaming with zero-trust auth
- Named subsystems: Dispatch (allocation, Pharos, predecessor Sextant), GrabMaps (KartaView, OSM, Spark pipeline, routing), Coban (Kafka on Kubernetes with Strimzi), Catwalk (model serving, Amphawa feature store, orchestrators), Resilience (Hystrix-Go)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Driver and passenger apps | Location pings, bookings | native | mobile-client | |
| 2 | Dispatch / allocation service | Requests K nearest drivers, assigns | in-house (Go) | app-server | |
| 3 | Pharos proxy layer | Routes requests to node holding the city/vehicle model | in-house | database-proxy (routing) | routingKey: mapId |
| 4 | Pharos node layer | Maps request ids to model instances | in-house | app-server (stateful) | |
| 5 | Pharos model | In-memory OSM graph per city and vehicle type; driver ART and edge-based-node ART; phantom nodes; two priority queues for expansion | in-house | geospatial-index (road-network) | inMemory: true; p99UpdateMs: 10; p99QueryMs: 50 |
| 6 | Sextant (legacy) | Haversine KNN with grid partitioning | in-house | geospatial-index (grid) | |
| 7 | OSM road graphs | Base road network per city | OpenStreetMap | third-party-api (data feed) | |
| 8 | KartaView / KartaCam | Grab's imagery collection | in-house | edge capture (not a runtime kind) | |
| 9 | GrabMaps pipeline | Parquetizer, geohash units, Spark, per-geohash bidirectional graphs, local rules | Apache Spark | etl-job | processingUnit: geohash |
| 10 | Probe data | GPS pings from rides and deliveries | in-house | stream | |
| 11 | Routing engine | Turn-by-turn routing on GrabMaps | in-house | app-server | |
| 12 | Coban Kafka | Strimzi on EKS, broker per node, EBS gp3, ASG per AZ, node termination handler, NLB target group binding | Apache Kafka, Strimzi | stream | replicationFactor: 3; azs: 3; storage: ebs-gp3 |
| 13 | Rack-aware consumers | client.rack set from AZ metadata; replica.selector.class on brokers | Kafka 3.1 | property of stream edge | fetchFromClosestReplica: true |
| 14 | Hystrix-Go | Circuit breakers per service or per host; timeout, max concurrent, volume threshold, sleep window, error percent | hystrix-go | edge property (circuitBreaker) | |
| 15 | Catwalk | Model serving on EKS: TF Serving, ONNX, PyTorch, Triton; CRDs; orchestrators for multi-model logic | in-house | ml-inference | models: 1400; orchestrators: 200 |
| 16 | Amphawa | Feature fetching component | in-house | cache (feature-store) | |
| 17 | Kubernetes (EKS) | Hosts Kafka, Catwalk, services | AWS EKS | ops platform, not tallied | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| driver app | location ingestion | https | async | at-least-once | frequent pings |
| location ingestion | pharos proxy | rpc | sync | | update, p99 10 ms |
| pharos proxy | pharos node | rpc | sync | | by map id |
| pharos node | model | in-process | sync | | serialised writes, snapshot reads |
| dispatch | pharos proxy | rpc | sync | | nearby K by ETA, p99 50 ms |
| pharos model | osm graph | load | async | | per city and vehicle type |
| osm pbf | parquetizer -> spark | batch | async | | |
| probe data (rides) | grabmaps pipeline | stream/batch | async | | |
| grabmaps pipeline | routing engine / pharos graphs | publish | async | | |
| services | coban kafka | kafka | async | at-least-once | |
| kafka | consumers (same az replica) | kafka | async | at-least-once | +up to 500 ms |
| node termination handler | kafka broker pod | signal | async | | graceful leadership move |
| aws lb controller | nlb target groups | api | async | | |
| service | upstream (via hystrix) | rpc | sync | | breaker per service or host |
| catwalk orchestrator | model servers | rpc | sync | | multi-model |
| model server | amphawa | rpc | sync | | features |

## Failure modes, incidents, tradeoffs the source discusses
- Straight-line search misallocates: detours make haversine wrong; Pharos searches by routing distance. Source: pharos.
- Throughput over consistency: "Pharos favors high throughput over strong consistency of KNN query results as the update frequency is high and slight inconsistency does not affect allocation". Source: pharos.
- Serialised writes and no multi-level Dijkstra limit long-distance queries; city isolation blocks cross-city allocation. Source: pharos.
- Ephemeral NVMe broke recovery: "The PVC associating the Kafka broker 3 pod with its instance store PV is unable to automatically switch to the new NVMe instance store volume"; moved to EBS for reattachment, accepting lower IOPS. Source: kafka-on-kubernetes.
- Cross-AZ cost: consumers hit leaders in another AZ 67% of the time; rack-aware fetch cut cross-AZ traffic 25% but added "up to 500ms"; broker demotion no longer isolates brokers from consumers. Source: zero-traffic-cost.
- Circuit breaker granularity: per-service breakers can open on one bad endpoint; per-host needs client-side balancing; "1 bad host / 6 total hosts = 16.66% error rate". Source: resilient-systems.
- Model platform ops: no-code managed serving created admin bottlenecks; self-serve introduced deployment errors; orchestrators added control. Source: catwalk.

## Unknowns
- Pharos replication and failover between nodes
- Driver ping rate and total fleet size
- Kafka cluster count and throughput
- Dispatch matching algorithm beyond KNN

## Candidates
- New kinds: none strictly new; sightings: geospatial-index (3rd, road-network variant), stream (18th), ml-inference (9th), etl-job (12th), database-proxy (12th), third-party-api (6th: OSM), cache feature-store (17th)
- New properties on existing kinds: geospatial-index.metric (euclidean, haversine, road-distance, eta), partitionBy (city, vehicle-type), inMemory; stream.storage (ephemeral, persistent), azSpread (integer), fetchFromClosestReplica (boolean); ml-inference.models (integer), orchestrated (boolean)
- New edge properties: circuitBreakerScope (service, host); rackAware (boolean); latencyPenaltyMs
- New requirement paths: cost.crossAzTrafficMinimised (boolean); latency.allocationMs
- New rules:
  - stateful-broker-on-ephemeral-storage: stream broker with storage ephemeral and replicationFactor below 3 (or no reattachable volume)
  - rack-aware-fetch-on-latency-critical-stream: consumer edge rackAware true while latency target below the added penalty
  - nearby-search-by-straight-line-under-road-constraints: geospatial-index metric euclidean/haversine while latency.allocationMs and road-network requirement present (informational)
  - per-service-breaker-with-mixed-endpoints: circuitBreakerScope service on edges to a service with many heterogeneous endpoints (informational)
  - in-memory-index-without-serialised-write-note: geospatial-index inMemory with concurrent writers and no snapshot or lock strategy declared (informational)

## Verification 2026-09-14

All six primary sources were fetched on 2026-09-14 and all six were reachable (HTTP 200).

| URL | Reachable | Outcome |
|---|---|---|
| https://engineering.grab.com/pharos-searching-nearby-drivers-on-road-network-at-scale | yes | Confirms the proxy / node / model three-layer split, the driver ART and EBN ART, the two priority queues, OSM road graphs partitioned by city and vehicle type, p99 10 ms driver update and 50 ms driver nearby query, and the quoted consistency statement ("data storage in Pharos does not guarantee strong consistency"). |
| https://engineering.grab.com/building-hyperlocal-grabmaps | yes | Confirms the Asia .pbf from geofabrik.de, the Parquetizer, geohash as the unit of processing with a bi-directional graph per geohash, Spark, KartaView imagery, rides and deliveries GPS pings, and 428 cities in eight countries. |
| https://engineering.grab.com/kafka-on-kubernetes | yes | Confirms Strimzi on EKS, one Kafka cluster per EKS cluster, one broker per worker node, the instance-store PVC failure quote, the move to EBS gp3, AWS Node Termination Handler in Queue Processor mode, AWS Load Balancer Controller with TargetGroupBinding, one ASG per AZ, and the three-replica minimum. |
| https://engineering.grab.com/zero-traffic-cost | yes | Confirms Kafka 3.1, RackAwareReplicaSelector via replica.selector.class, broker.rack and client.rack from EC2/host metadata, the 67% cross-AZ leader probability, the 25% cross-AZ traffic reduction, the "up to 500ms" end-to-end latency increase, and the broker-demotion caveat. |
| https://engineering.grab.com/designing-resilient-systems-part-1 | yes | Confirms Hystrix-Go, per-service versus per-host circuits, the five parameters (timeout, max concurrent requests, request volume threshold, sleep window, error percent threshold), the "1 bad host / 6 total hosts = 16.66% error rate" example, and fallbacks (estimated value, stale cached data). |
| https://engineering.grab.com/catwalk-evolution | yes | Confirms EKS, the move from Helm charts to Kubernetes CRDs, Catwalk Proxy / Catwalk Transformer / Amphawa / Catwalk Orchestrator, support beyond TensorFlow (ONNX, PyTorch), and 8 -> 300 -> 200 orchestrators serving approximately 1,400 models. |

Facts in the card that could not be confirmed from the fetched pages, and how they were handled:

- **Sextant, the Haversine/grid predecessor.** The Pharos page discusses straight-line search being wrong on a road network, but the fetched text does not name Sextant as a separate running box. It is not encoded as a node; see notes.md, "Not encoded".
- **NVIDIA Triton in Catwalk.** The fetched Catwalk text names TensorFlow, ONNX and PyTorch but not Triton. The single model-serving node carries `tensorflow-serving`; the label names only the runtimes the fetched page confirms (TF Serving, ONNX, PyTorch).
- **Zero-trust Kafka / credential rotation.** No rotation period is stated anywhere. `security.credentialRotationDays: 90` is set so the design states a rotation practice at all; it is an assumption, not a sourced number.
- **Amphawa as a feature store.** The source calls Amphawa a "feature fetching component that augments model inputs from the feature store"; it does not describe the store itself. Amphawa is encoded as a service, and the store behind it is not encoded.
