# tinder-geo: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/tinder-geo.md`
- Size: 14 nodes, 18 edges, 4 groups (broken twin: 13 nodes, 15 edges, 4 groups).

## Clean variant (header of design.yaml)

Reference architecture 8, clean variant: location-based recommendations served from an
Elasticsearch index sharded by Google S2 geo cells, fronted by an abstraction service that
looks the shard up, with Kafka ordering every user's updates and a periodic reindex.

Fixes relative to tinder-geo.broken.yaml:
  - recommendation-service routes by looking the user up in shard-mapping (shardingStrategy
    lookup) instead of consistent-hashing users onto shards with nothing owning the ring
  - indexer writes geoshard-index asynchronously off the Kafka stream, and reindex-job
    periodically rebuilds it from profile-store, so the index has a rebuild path
  - the indexer no longer retries into Elasticsearch bare: the retrying hop is the Envoy
    one, which carries a circuit breaker
  - cluster-dns is the node-local CoreDNS DaemonSet, redundant on every node
  - profile-cache declares an eviction policy
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture 8, broken variant: the same recommendation system before geosharding
was done properly. Users are consistent-hashed onto shards with nothing owning the ring, the
indexer writes Elasticsearch inline and retries into it bare, there is no reindex path, the
profile cache declares no eviction policy, and CoreDNS is one central deployment.

This file MUST trip:
  - stateful-hash-ring-without-ring-manager   (recommendation-service shardingStrategy consistent-hash, no coordination-service anywhere)
  - derived-store-without-cdc-or-rebuild      (geoshard-index has only sync in-edges; the reindex job is gone)
  - retry-without-adaptive-shedding           (indexer -> geoshard-index retries exponential, no circuit breaker, no rate limiter in front of Elasticsearch)
  - cache-missing-eviction-policy             (profile-cache declares no evictionPolicy)
  - shared-dependency-without-redundancy      (cluster-dns redundantProviders false while availability.discoveryRedundant is true)
and MUST NOT trip:
  - cache-as-primary-store-without-persistence (profile-cache usedAsPrimaryStore false)
  - materialised-cache-without-rebuild-path    (profile-cache is not materialised)
  - fanout-inline-in-request-path              (no app-server calls a worker synchronously)
  - read-heavy-path-without-cache              (a cache exists, and no readWriteRatio is stated)
  - sync-chain-too-deep                        (no latency.p95Ms is stated, so the rule cannot apply)
  - datastore-missing-backup, datastore-single-region, single-writer-primary-at-peak-qps,
    read-replica-as-sole-scaling, business-updates-without-index-propagation (no sql-database node)
  - queue-missing-dlq, retry-queue-without-dlq, retry-without-backoff, pubsub-replay-required (no queue or topic)
  - multi-leader-store-without-conflict-policy (both DynamoDB tables are single-region)
  - credentials-without-rotation               (security.credentialRotationDays is set)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone (no availability-zone groups)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Mobile clients (iOS/Android) | `mobile-client` | `mobile-app` | client | exact |
| ELB in front of the cluster | `elb` | `aws-classic-load-balancer` | load-balancer | close (the Kubernetes post names an ELB whose keepalive connections stuck to the first ready pods; the ELB flavour is not stated) |
| Front-proxy Envoy, one deployment per zone per service | `api-front-proxy` | `envoy-gateway` | api-gateway | exact |
| Recommendation abstraction service | `recommendation-service` | `container-service` | app-server | exact (in-house microservice, so the generic component) |
| Envoy sidecar per pod | `envoy-sidecar` | `envoy-sidecar` | service-mesh | exact |
| CoreDNS (node-local DaemonSet, 250k rps) | `cluster-dns` | `coredns` | dns | exact |
| Kubernetes cluster (1,000 nodes, Flannel CNI) | `kubernetes-cluster` | `kubernetes` | container-orchestrator | close (self-hosted upstream Kubernetes; kube-aws as provisioner is unconfirmed and not encoded) |
| Kafka consumer that indexes and moves users | `indexer` | `container-worker` | worker | exact |
| Reindex job | `reindex-job` | `container-worker` | worker | exact (`trigger: schedule`) |
| Kafka | `user-updates` | `kafka` | stream | exact |
| Geosharded Elasticsearch | `geoshard-index` | `elasticsearch` | search-index | exact |
| S2 cell scheme (levels 7 and 8) | — | — | — | encoded as `geoScheme: "s2"` on `geoshard-index`, not a node |
| Mapping datastore (document id to geoshard) | `shard-mapping` | `dynamodb` | nosql-database | assumed (product named only by the secondary source; `consistency: "strong"` follows the part-3 summary) |
| User profile / match store | `profile-store` | `dynamodb` | nosql-database | close (DynamoDB is Tinder-attributed for profiles and matches via highscalability) |
| Cache | `profile-cache` | `aws-elasticache` | cache | close (ElastiCache is Tinder-attributed; `engine: "redis-oss"` is assumed) |

Confidence tally: 8 exact, 5 close, 1 assumed (plus one source box encoded as a property).

Properties the source does not state, set because a rule reads them:

- `profile-cache.evictionPolicy: "lru"` — no source states an eviction policy. `lru` is set because
  the cache fronts DynamoDB profiles and nothing in the source suggests `noeviction`; the broken twin
  omits it deliberately.
- `security.credentialRotationDays: 90` — not stated anywhere. Set so the design-wide rule reads a
  value rather than a silence; treat the number as assumed, not as a Tinder fact.
- `availability.discoveryRedundant: true` — the source's own fix for the DNS timeouts was to make
  resolution node-local on every node, which is what this requirement encodes.
- `traffic.skew: "heavy-tail"` — the sharding post's premise: user density varies by about 1,000x
  between cities and countryside, which is why cells are sized by density rather than by area.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Flannel (CNI overlay) | network-fabric | encoded as `cniPlugin: "flannel"` on `kubernetes-cluster`; no `flannel` component exists |
| kube-aws (cluster provisioner) | — | not encoded; provisioning tooling, and unconfirmed in this pass |

No runtime box was left without a component. `geo-cell-index` (default provider) exists and would be
the component for an in-house S2 index, but the source's index is Elasticsearch, and the
`elasticsearch` component already carries `shardingStrategy: "geo"` and `geoScheme: "s2"`.

## Not encoded

- The Elasticsearch cluster's internal roles: master nodes tracking shard locations, coordinating
  nodes routing queries, data nodes holding primary and replica shards. The format has one node per
  box and the source draws the cluster as one box.
- S2 cell levels 7 (~45 mi) and 8 (~22.5 mi). `search-index` has no per-shard cell level, and the
  two levels apply to different shards, not to the index as a whole.
- Index-per-geoshard, and whether the indices live in one cluster or several. No field expresses
  "one index per shard", and the source does not state the layout.
- Boundary fan-out: a query near a shard edge hits several shards. The edge carries it as a label
  only; there is no `boundaryFanout` edge field in v1.
- Per-user write ordering as an edge property. It is encoded once, design-wide, as
  `messaging.orderingScope: "partition"` plus `ordering: "per-key"` on the Kafka node; the
  candidate `orderedByKey` edge field does not exist.
- Shard migration itself (delete from the old shard, write to the new) is one edge with a label.
  The format has no notion of an entity moving between shards.
- The 1,000x density spread, the "20 times more computations", 200 services, 15,000 pods and
  48,000 containers. `container-orchestrator` carries `nodeCount` only, and none of the others is a
  per-node request rate.
- Flannel's conntrack `insert_failed` failure mode and the `ndots` DNS latency: failure modes, not
  structure.
- S3 left-swipe analytics, the swipe and match pipeline and the push path: secondary or speculative
  in the sources, so out of the design entirely.
