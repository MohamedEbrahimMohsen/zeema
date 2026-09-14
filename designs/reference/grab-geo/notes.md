# grab-geo: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/grab-geo.md` (six official Grab engineering posts, 2020-2024, re-verified 2026-09-14).
- Size: 19 nodes, 22 edges, 5 groups.

## Clean variant (header of design.yaml)

Grab's geo stack, clean variant: Pharos answers "K nearest drivers" by routing distance on
in-memory OpenStreetMap road graphs that a GrabMaps Spark pipeline rebuilds per city, while
Coban (Kafka on EKS across three AZs) carries the events and Catwalk serves the models.

Fixes relative to grab-geo.broken.yaml:
  - pharos-proxy and pharos-node route by map id through a lookup table, not a consistent
    hash ring that nobody owns
  - map-pipeline loads the city and vehicle-type road graphs into pharos-model
    asynchronously, so the in-memory index has a rebuild path and is not only ever written
    on the driver-update request path
  - dispatch-service calls pharos-proxy behind a Hystrix-Go circuit breaker with a degraded
    fallback, so retries cannot saturate a shard that is already failing
  - the OpenStreetMap extract is pulled asynchronously by parquetizer into the batch
    pipeline; routing-engine never calls the external feed on the request path
  - no edge claims exactly-once into a consumer that then makes an external call
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Grab's geo stack, broken variant: Pharos is sharded on a consistent hash ring with no ring
manager, its in-memory road-graph index is only ever written on the driver-update request
path, dispatch retries into a failing Pharos shard with no breaker, and the routing engine
reads the external OpenStreetMap feed inline on a stream it calls exactly-once.

This file MUST trip:
  - stateful-hash-ring-without-ring-manager   (pharos-proxy and pharos-node use consistent-hash with no coordination-service)
  - derived-store-without-cdc-or-rebuild      (pharos-model has no async in-edge from a worker or stream)
  - retry-without-adaptive-shedding           (dispatch-service -> pharos-proxy retries with no circuit breaker)
  - external-call-inline-without-durable-path (routing-engine calls osm-feed sync with no queue or workflow engine)
  - exactly-once-with-external-side-effects   (coban-kafka -> routing-engine claims exactly-once while routing-engine calls osm-feed)
and MUST NOT trip:
  - credentials-without-rotation              (security.credentialRotationDays is still set)
  - fanout-inline-in-request-path             (no app-server calls parquetizer or map-pipeline synchronously)
  - cache-missing-eviction-policy, cache-as-primary-store-without-persistence,
    materialised-cache-without-rebuild-path   (the design has no cache node)
  - datastore-missing-backup, datastore-single-region, read-heavy-path-without-cache,
    single-writer-primary-at-peak-qps, read-replica-as-sole-scaling,
    business-updates-without-index-propagation (no sql-database node)
  - queue-missing-dlq, retry-queue-without-dlq, retry-without-backoff (Kafka is a stream, not a queue)
  - pubsub-replay-required                    (no pubsub-topic node)
  - cross-cell-call                           (isolation.tenancy is not "cell")
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone
                                              (no availability-zone groups and no engine kinds)
  - reconnect-stampede-without-guard, shared-host-per-channel-without-isolation,
    stateful-websocket-scale-in-without-drain (no realtime-gateway node)
  - sync-chain-too-deep                       (no api-gateway node and no latency.p95Ms requirement)

Each of the five is a mistake the sources themselves warn about: the Hystrix-Go post on
retries into a service with no breaker, the Pharos post on an index that only exists in
memory, and the maps post on the .pbf being a batch input rather than a request-path call.

## Mapping

Card box numbers are the rows of the "Components" table in `source/grab-geo.md`.

| # | source box | node | component | kind | confidence |
|---|---|---|---|---|---|
| 1 | Driver app | `driver-app` | `mobile-app` | client | exact |
| 1 | Passenger app | `passenger-app` | `mobile-app` | client | exact |
| — | Location ingestion (from the card's edge table) | `location-ingestion` | `container-service` | app-server | close |
| 2 | Dispatch / allocation service | `dispatch-service` | `container-service` | app-server | exact |
| 3 | Pharos proxy layer | `pharos-proxy` | `container-service` | app-server | close |
| 4 | Pharos node layer | `pharos-node` | `container-service` | app-server | close |
| 5 | Pharos model | `pharos-model` | `geo-cell-index` | search-index | close |
| 6 | Sextant (legacy) | — | — | — | not encoded |
| 7 | OSM road graphs | `osm-feed` | `maps-api` | third-party-api | close |
| 8 | KartaView / KartaCam | `kartaview` | `blob-store` | object-store | assumed |
| 9 | GrabMaps pipeline (Parquetizer) | `parquetizer` | `container-worker` | worker | exact |
| 9 | GrabMaps pipeline (geohash units on Spark) | `map-pipeline` | `spark-job` | worker | exact |
| 10 | Probe data | merged into `coban-kafka` and the edge `coban-kafka -> map-pipeline` | `kafka` | stream | close |
| 11 | Routing engine | `routing-engine` | `container-service` | app-server | exact |
| 12 | Coban Kafka | `coban-kafka` | `kafka` | stream | exact |
| 12 | AWS Node Termination Handler | `node-termination-handler` | `container-service` | app-server | exact |
| 12 | AWS Load Balancer Controller | `lb-controller` | `container-service` | app-server | exact |
| 13 | Rack-aware consumers | edge label on `coban-kafka -> map-pipeline` | — | — | not encoded as a property |
| 14 | Hystrix-Go | `circuitBreaker: true` and `fallback: "degraded"` on the three sync edges out of `dispatch-service` | — | — | close |
| 15 | Catwalk Proxy | `catwalk-proxy` | `container-service` | app-server | exact |
| 15 | Catwalk Orchestrator | `catwalk-orchestrator` | `container-service` | app-server | exact |
| 15 | Catwalk model servers | `model-servers` | `tensorflow-serving` | ml-inference | close |
| 16 | Amphawa | `amphawa` | `container-service` | app-server | close |
| 17 | Kubernetes (EKS) | `orchestrator: "kubernetes"` on every service node | — | — | not tallied, as the card directs |

Tally: 11 exact, 9 close, 1 assumed, plus 4 rows carried as properties or labels and 1 not encoded.

Boundaries: `grab-region` (region, "AWS region (three availability zones)"), `dispatch`,
`grabmaps`, `coban` and `catwalk` (system). Availability-zone groups were deliberately not
created: a node belongs to at most one group, so putting the Kafka cluster in one AZ group
would misstate the three-AZ spread that `availability.zones: 3` records instead.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Pharos road-network KNN index | a `search-index` for routing-distance nearest neighbour, or a `metric` property on `search-index` | `geo-cell-index` with `geoScheme: "none"` |
| Pharos proxy / node layer (in-house router) | an in-house generic under `database-proxy` | `container-service` with `shardingStrategy: "lookup"` |
| OpenStreetMap / Geofabrik open data extract | a `third-party-api` for an open data feed | `maps-api` with `billingPerRequest: false` |
| KartaView / KartaCam imagery collection | an edge-capture kind (not a runtime kind in v1) | `blob-store` |
| Amphawa in front of a feature store | a `feature-store` component under `default` | `container-service`; the store is not encoded |
| Strimzi | already an explicit inventory skip; the drawn node is Kafka | `kafka`, Strimzi in the label |

## Not encoded

- Sextant, the Haversine + grid predecessor: the fetched Pharos page does not draw it as a running box.
- Pharos internals: the driver ART, the EBN ART, the phantom nodes and the two priority queues (EBNPQ, driverPQ) are inside one node; the format has no sub-structure.
- Pharos latency numbers: p99 10 ms for a driver update and 50 ms for a nearby query are edge labels. `nfr` has only `rps` and `latencyP95Ms`, and the source states p99, not p95, so no `nfr.latencyP95Ms` is set.
- City and vehicle-type model partitioning, and the city isolation that blocks cross-city allocation: there is one `pharos-model` node, not 428. Encoding cities as `cell` groups would make `isolation.tenancy: "cell"` true and turn every proxy-to-node call into a cross-cell call, which is not what the source describes.
- Rack-aware consumer fetching: `client.rack`, `replica.selector.class`, the 67% cross-AZ leader probability, the 25% traffic reduction and the "up to 500ms" penalty are an edge label. v1 has no `rackAware` or `latencyPenaltyMs` edge field.
- Hystrix-Go breaker granularity (per-service versus per-host) and its five parameters: `circuitBreaker` is a boolean, with no scope and no timeout/volume/sleep-window/error-percent settings. The timeout parameter exists but no value is stated, so no `timeoutMs` is set.
- Kafka storage history: the instance-store NVMe PVC failure and the move to EBS gp3 are only `storage: "persistent"` plus the node label. There is no volume-type property.
- One Kafka cluster per EKS cluster, one broker per worker node, one ASG per AZ: the format has no node-placement or cluster-topology fields.
- Catwalk scale: 8 -> 300 -> 1,400 models. `instances: 200` records the orchestrator count, which is a real process count; 1,400 is a count of models, not of servers, and has no property.
- Catwalk Transformer and the move from Helm charts to CRDs: deployment mechanics, not runtime boxes.
- GrabMaps coverage (428 cities in eight countries) and the geohash processing unit: label text only.
- `security.credentialRotationDays: 90` is an assumption, not a source fact. The Coban post is about zero-trust Kafka but states no rotation period; the value is set so the design declares a rotation practice rather than leaving the question open. See `work/designs/grab-geo/verify.md`.
