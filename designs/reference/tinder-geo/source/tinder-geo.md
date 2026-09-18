# Intake: Tinder geosharded recommendations and platform

## Source
- Primary: Tinder Engineering, Geosharded Recommendations Part 1 (sharding approach), Part 2 (architecture), Part 3 (consistency), 2019, https://medium.com/tinder-engineering/geosharded-recommendations-part-1-sharding-approach-d5d54e0ec77a, https://medium.com/tinder-engineering/geosharded-recommendations-part-2-architecture-3396a8a7efb, https://medium.com/tinder-engineering/geosharded-recommendations-part-3-consistency-2d2cb2f0594b (all returned 403 in this pass; content taken from https://blog.bytebytego.com/p/how-tinder-recommends-to-75-million which summarises them, plus search summaries)
- Primary: Tinder's move to Kubernetes, 2019, https://medium.com/tinder/tinders-move-to-kubernetes-cda2a6372f44 (403; numbers via KubeCon NA 2019 listing and mirror https://asksendai.com/tinders-move-to-kubernetes/)
- Secondary: https://highscalability.com/designing-tinder/ (used only to separate Tinder-attributed facts from interview speculation)
- Verified by: official Tinder engineering posts via write-ups + KubeCon talk listing
- Confidence: medium (originals not directly readable in this pass)
- Date of source: 2019

## System in three lines
Location-based matching where each recommendation query must search only users near the requester. One global Elasticsearch index became a hot, expensive scan, so Tinder sharded the index by Google S2 geo cells sized by user density, fronted by an abstraction microservice that routes queries and moves users between shards, with Kafka enforcing write order per user. The platform runs ~200 services on a large Kubernetes cluster. Hard because users move across shard boundaries, writes and shard migrations race, and density varies by 1,000x between cities and countryside.

## Scale (only if stated)
- Users / DAU: 75M users (secondary headline)
- Requests per second: not stated
- Data volume: not stated
- Message throughput: not stated
- Performance: geosharding "handling 20 times more computations than the previous system"
- Platform: 200 services, 1,000 nodes, 15,000 pods, 48,000 containers on Kubernetes (2019); migration Jan 2018 to Mar 2019

## Requirements stated or clearly implied
- Availability target: not stated
- Consistency: per-user write ordering via Kafka partition by user id; Elasticsearch Get API forces refresh so reads see pending writes; periodic reindex from source of truth
- Latency target: recommendation queries interactive; scaling containers "within seconds as opposed to minutes"
- Ordering needs: per-user ordered updates (location, profile)
- Replay or reprocessing: periodic reindexing for alignment with source of truth
- Retention: not stated
- Compliance / residency: not stated
- Locality: most users' preferences within 50 miles; S2 level 7 (~45 mi) and level 8 (~22.5 mi)

## Boundaries
- Regions / zones: AWS; single region implied
- Trust zones: mobile clients -> API -> services on Kubernetes -> Elasticsearch, DynamoDB, ElastiCache
- Named subsystems: Recommendation abstraction service, Geosharded Elasticsearch (index per shard, one or many clusters), Mapping datastore (user to shard), Kafka ordering, Reindex jobs, Kubernetes platform (kube-aws, Flannel, Envoy sidecars)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Mobile clients | iOS/Android apps sending location and swipes | native | mobile-client | |
| 2 | API layer | Entry for app requests | not named | api-gateway | |
| 3 | Recommendation abstraction service | Hides geosharding: routes queries to shard(s), handles location updates and shard moves | in-house microservice | app-server | pattern: shard-router |
| 4 | Geosharded Elasticsearch | One index per geo shard; indices in one or several clusters; coordinating and data nodes | Elasticsearch | search-index | shardingStrategy: geo; sharded: true |
| 5 | S2 cell scheme | Hierarchical cells on Hilbert curve; levels 7 and 8; shard sizing by density | Google S2 | geospatial-index (scheme) | cellLevels: 7,8 |
| 6 | Mapping datastore | Document id to geoshard mapping | not named (DynamoDB per secondary) | nosql-database | |
| 7 | Kafka | Consistent hashing of user updates to partitions to guarantee write ordering | Apache Kafka | stream | ordering: per-key |
| 8 | Reindex job | Periodic alignment of shards with source of truth | in-house | scheduled-job | |
| 9 | User profile / match store | Profiles and matches | DynamoDB (secondary attribution) | nosql-database | |
| 10 | Cache | ElastiCache (secondary attribution) | Redis | cache | |
| 11 | Kubernetes cluster | 200 services on kube-aws; Flannel networking; Envoy sidecars for long-lived connection balancing | Kubernetes, Flannel, Envoy | ops platform + service-mesh + network-fabric | nodes: 1000 |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| mobile-client | api | https | sync | | |
| api | recommendation-service | grpc/http | sync | | |
| recommendation-service | mapping-datastore | dynamo | sync | | which shard |
| recommendation-service | elasticsearch shard(s) | http | sync | | neighbouring shards near boundary |
| location update | kafka | kafka | async | at-least-once, ordered per user | |
| kafka | recommendation-service (indexer) | kafka | async | at-least-once | |
| indexer | elasticsearch (old shard delete, new shard write) | http | sync | | user moved |
| indexer | mapping-datastore | dynamo | sync | | update mapping |
| reindex-job | elasticsearch | http | async | | periodic |
| service | service (via envoy sidecar) | grpc | sync | | balanced long-lived connections |

## Failure modes, incidents, tradeoffs the source discusses
- Global index scan: one index caused "unnecessary processing of irrelevant geographic data", high latency and cost. Source: bytebytego summarising part 1.
- Shard sizing by density not area: level 7 for sparse regions, level 8 for dense; balance query efficiency, migration overhead and density. Source: part 1 via summary.
- Boundary queries: users near shard edges require querying several shards. Source: part 2 via summary.
- Moves between shards race with writes: solved with ordered Kafka partitions per user, forced Elasticsearch refresh on Get, and periodic reindex. Source: part 3 via summary.
- Kubernetes migration: ECS scaling waited minutes for EC2; containers now serve "within seconds as opposed to minutes". Source: kubernetes post via mirror.
- Known from the Kubernetes post (not re-verified here): Flannel ARP cache and MTU issues at scale, Envoy sidecars added because Kubernetes services do not balance long-lived gRPC connections, CoreDNS ndots latency. Marked unverified in this pass.

## Unknowns
- Exact shard count and cluster layout
- Mapping datastore product (DynamoDB per secondary)
- Swipe and match pipeline (only speculation available)
- Push notification path

## Candidates
- New kinds: none strictly new; sightings: geospatial-index (2nd: S2 scheme, first was Uber), search-index (5th), stream (10th), nosql-database (14th), scheduled-job (6th), service-mesh (5th: Envoy sidecar), network-fabric (2nd: Flannel overlay), api-gateway (10th)
- New properties on existing kinds: search-index.shardingStrategy (geo, hash, time), indexPerShard (boolean); geospatial-index.scheme (s2, h3, geohash), cellLevels; stream.orderingKey (string)
- New edge properties: orderedByKey (boolean); boundaryFanout (boolean)
- New requirement paths: locality.radiusMiles (integer); consistency.readAfterWrite (boolean)
- New rules:
  - geo-search-without-geo-sharding: search-index serving location queries with sharded false while locality.radiusMiles is small and users large
  - shard-move-without-ordered-writes: entity migration between shards with update edges lacking orderedByKey (race)
  - index-without-reindex-path: derived search-index with no scheduled-job or CDC rebuild edge (3rd sighting of the rebuild theme)
  - long-lived-grpc-without-client-side-balancing: service-to-service persistent grpc edges with no service-mesh sidecar (Kubernetes service balancing gap)

## Verification 2026-09-13

Re-fetched before encoding. Full log: `work/designs/tinder-geo/verify.md`.

| URL | Reachable | Outcome |
|---|---|---|
| medium.com/tinder-engineering/geosharded-recommendations-part-2-architecture-3396a8a7efb | no (403) | Medium still blocks the fetcher. |
| medium.com/tinder/geosharded-recommendations-part-1-sharding-approach-d5d54e0ec77a | no (403) | Article has moved to the `/tinder/` publication but is still unreadable. |
| blog.bytebytego.com/p/how-tinder-recommends-to-75-million | yes | Confirms the abstraction microservice; Elasticsearch master / coordinating / data nodes; S2 level 7 (~45 mi) and level 8 (~22.5 mi); adjacent S2 cells grouped into geoshards by activity; Kafka consistent hashing per user for write ordering; Get API forcing a refresh; periodic reindexing; "20 times more computations"; 75M users. |
| asksendai.com/tinders-move-to-kubernetes/ | yes | Confirms 200 services, 1,000 nodes, 15,000 pods, 48,000 containers, Jan 2018 to Mar 2019, "within seconds as opposed to minutes". Does not mention kube-aws, Flannel, Envoy or CoreDNS. |
| highscalability.com/designing-tinder/ | yes | Confirms which references are Tinder-attributed; names DynamoDB, S3, Elasticsearch, ElastiCache. |
| news.ycombinator.com/item?id=17567122 | yes | Tinder engineer in-thread: Hilbert curve maps location to a 1D shard index, geohash rejected for latitude distortion, shard movement for moving users is unavoidable, dense areas need multi-shard queries. |
| web search over the Kubernetes post | yes | Recovers CoreDNS at 250,000 requests per second with intermittent lookup timeouts, correlated with Flannel's `insert_failed` conntrack counter; fixed by node-local DNS (CoreDNS DaemonSet, local resolver in each pod). ELB keepalive connections stuck to the first ready pods, which is why Envoy was introduced: a sidecar per pod with one route to the local container port, plus a front-proxy Envoy deployment per availability zone per service, chosen for retries, circuit breaking, rate limiting and observability. |

Facts in the card above that no reachable source confirms, and which are therefore **not** encoded
or are marked assumed: kube-aws as the provisioner (not encoded); the mapping datastore product
(DynamoDB, assumed); the ElastiCache engine (Redis, assumed); exact shard count and cluster layout
(not encoded); the swipe/match pipeline and push path (not encoded); any request rate other than the
250,000 DNS requests per second (no other `nfr.rps` in the design).
