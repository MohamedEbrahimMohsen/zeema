# hotstar-streaming: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/hotstar-streaming.md` (intake card of 2026-09-07 plus the verification appended 2026-09-14).
- Size: 24 nodes, 33 edges, 5 groups. The broken twin is 25 nodes, 35 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture: Disney+ Hotstar / JioHotstar live cricket at record concurrency, clean
variant. A CDN doubles as the external API gateway in front of an ALB fleet and one Envoy
internal gateway on six EKS clusters, while stadium encoders feed SSAI stitchers and several
video CDNs whose per-cohort weights the QoS Routing Manager recomputes from ARGUS telemetry.

Fixes relative to hotstar-streaming.broken.yaml:
  - service-db is sharded and declares no unsharded peak, so the front-end fleet cannot melt it
    down the way the 2017 tsunami did; backups and retention are declared
  - multi-layer-cache sits in front of service-db instead of being the only copy of the ad
    frequency-cap state, so a restart loses nothing
  - ad-decisioning calls no third party inline; the programmatic path is not on the request path
  - ssai-stitcher is fed by the encoders on the live path, never called synchronously by a
    request-path service
  - scaling-controller steps the cluster in 100-300 node increments instead of retrying a
    throttled control plane with no circuit breaker
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: Disney+ Hotstar / JioHotstar live cricket at record concurrency, broken
variant. The front-end fleet is sized for the tsunami but the database behind it is still one
unsharded primary, the distributed cache is the only copy of the ad frequency-cap state, the ad
service calls a programmatic SSP and the SSAI stitcher inline on the request path, and the
scaling controller answers a throttled EKS control plane with bare exponential retries.

This file MUST trip:
  - single-writer-primary-at-peak-qps            (service-db: unsharded single writer at 125000 rps, the 2017 meltdown)
  - cache-as-primary-store-without-persistence   (multi-layer-cache: usedAsPrimaryStore true, persistence false)
  - external-call-inline-without-durable-path    (ad-decisioning calls ssp synchronously with no queue or workflow engine)
  - fanout-inline-in-request-path                (ad-decisioning calls the ssai-stitcher worker synchronously)
  - retry-without-adaptive-shedding              (scaling-controller -> eks-cluster retries with no circuit breaker or rate limiter)
and MUST NOT trip:
  - datastore-missing-backup, cache-missing-eviction-policy, materialised-cache-without-rebuild-path,
    read-replica-as-sole-scaling, datastore-single-region, credentials-without-rotation,
    read-heavy-path-without-cache, sync-chain-too-deep, queue-missing-dlq, pubsub-replay-required,
    reconnect-stampede-without-guard, stateful-websocket-scale-in-without-drain,
    stateful-node-without-zone-redundancy

Each mistake is one the sources themselves describe: the 2017 tsunami post says the database
"started to melt down and swapped at one point" because it was not scaled in proportion to the
front-end fleet; the ad-request post puts frequency-cap state in a distributed cache and the ad
decision under 100 ms, which is exactly where an inline SSP auction and inline stitching go
wrong; part 1 records API-server errors above ~400 simultaneous nodes where "the retries
introduced a slight delay", which is what bare exponential retry without shedding looks like.

## Mapping

| Source box (card row) | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| 1 Client apps | `client-app` | `user-device` | client | exact |
| 2 External API Gateway (CDN) | `external-api-gateway` | `content-delivery-network` | cdn | exact |
| 3 Cacheable-path CDN domain | `cacheable-cdn` | `content-delivery-network` | cdn | exact |
| 4 Application Load Balancer fleet | `alb-fleet` | `alb` | load-balancer | exact |
| 5 Internal API Gateway (Envoy) | `internal-gateway` | `envoy-gateway` | api-gateway | exact |
| 6 EKS clusters | `eks-cluster` | `aws-eks` | container-orchestrator | exact |
| 9 NAT Gateways | `nat-gateway` | `aws-nat-gateway` | nat-gateway | exact |
| 11 Backend microservices | `backend-services` | `container-service` | app-server | exact |
| 12 Login / subscription / watch (Tier 1) | `tier1-service` | `container-service` | app-server | exact |
| 13 Databases (managed and self-hosted) | `service-db` | `relational-database` | sql-database | close (no engine is ever named) |
| 14 Multi-layer cache | `multi-layer-cache` | `cache-cluster` | cache | close (no product is ever named) |
| 15 Video encoders | `video-encoders` | `ffmpeg` | media-transcoder | close (in-house encoders; nearest component of the kind) |
| 16 SSAI manifest stitchers | `ssai-stitcher` | `container-worker` | worker | close |
| 17 Video CDNs (multi-CDN) | `akamai-cdn`, `cloudfront-cdn` | `akamai`, `cloudfront` | cdn | exact (JIO CDN has no component; see gaps) |
| 18 QoS Routing Manager | `qos-routing-manager` | `container-service` | app-server | close (in-house service; see gaps) |
| 19 ARGUS | `argus` | `observability-stack` | monitoring | close (in-house OLAP; see gaps) |
| 20 Content Metadata System (CMS) | `cms` | `container-service` | app-server | close (see gaps) |
| 21 Video Validation Orchestrator | `validation-orchestrator` | `container-service` | app-server | close (see gaps) |
| 22 Video Validator | `video-validator` | `container-worker` | worker | exact |
| 23 Play Portal | `play-portal` | `container-worker` | worker | close |
| 24 Grafana dashboards / TV wall | `grafana` | `grafana` | monitoring | exact |
| 26 Custom scaling controller | `scaling-controller` | `container-service` | app-server | close (in-house; see gaps) |
| 27 Ad decisioning service | `ad-decisioning` | `container-service` | app-server | exact |
| (broken twin only) third-party SSPs | `ssp` | `supplier-api` | third-party-api | close |

Confidence tally: 11 exact, 13 close, 0 assumed.

Boundaries: `cdn-edge` and `video-edge` (point-of-presence), `aws-region` (region, unnamed
because no source names the region), `core-vpc` (vpc) and `data-center` (system) for the
Hotstar "DC" abstraction that groups the six EKS clusters inside one region.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| JIO CDN | `cdn` | not drawn; Akamai and CloudFront carry the multi-CDN path |
| In-house live encoding farm | `media-transcoder` (no vendor-neutral generic exists) | `ffmpeg` |
| In-house OLAP telemetry engine (ARGUS) | `timeseries-database` / `data-warehouse` (no vendor-neutral generic exists) | `observability-stack` |
| Content Metadata System | `content-repository` (only `oci-content-management` exists) | `container-service` |
| Video Validation Orchestrator | `workflow-engine` (no vendor-neutral generic exists) | `container-service` |
| QoS Routing Manager, custom scaling controller | `policy-engine` (only authorisation engines exist: opa, kyverno, cerbos) | `container-service` |
| Project HULK load generator | a `load-generator` kind does not exist | not drawn (see below) |

## Not encoded

- Properties set only to satisfy a rule, with no source behind them: `evictionPolicy: "lru"` on
  `multi-layer-cache`, `backupEnabled` / `backupRetentionDays: 30` on `service-db`, and
  `security.credentialRotationDays: 90`. No source states a cache eviction policy, a backup
  policy or a rotation period; the rules require a declared practice and these are the values
  that reflect a fleet of managed AWS databases and caches.
- Project HULK (36,000 CPUs, 8 regions), the Datacenter Abstraction layer itself, the VPC CNI /
  IP address plane and the EC2 worker-node tier are real boxes in the card but were dropped to
  stay inside the 25-node ceiling; HULK is game-day tooling rather than a runtime element, and
  the other three are platform planes the format would draw as ordinary nodes.
- Endpoint classes (`intra-DC`, `inter-DC`, `external`) are a naming contract, not a boundary
  the format can express; they survive only as an edge label.
- Degradation levers (bitrate ladders, refresh rates for scorecard / watch-more / key moments,
  positive and negative panics, the P0 / Tier 1 / Tier 2 split) have no property or requirement
  path. `availability.degradedModeAllowed: true` is the closest the format gets.
- The tsunami traffic pattern itself (10K to 125K TPS in seconds) has no requirement path;
  `traffic.peakMultiplier` would need a derived number, so it is left out and the spike survives
  only as `tier1-service.nfr.rps: 125000`.
- Multi-CDN steering mechanics (EWMA alpha 0.6, max-deviation cap, 5% weight floor, ASN hard
  binding, two-phase capacity steering) have no properties on `cdn` or on an app-server; they
  survive as edge labels on `qos-routing-manager -> *-cdn`.
- EKS specifics the card records as incidents (subnet sizing /20 to /18, MINIMUM_IP_TARGET and
  WARM_IP_TARGET, the 1000-endpoint truncation, one P0 stack per cluster, NodePort exhaustion,
  10 Gbps nodes and topology spread) have no matching properties in v1.
- The card draws "CMS -> Video Validation Orchestrator" as a data arrow; the design reverses it
  to `validation-orchestrator -> cms` because Arkore edges are calls and the orchestrator polls.
- The card lists a direct "client player -> ad decisioning service" edge; the design routes the
  ad request through `internal-gateway` like every other API call, which is what parts 1 and 2
  describe for the platform as a whole.
- No queue, topic or stream node appears anywhere: the card records that no first-party source
  names a broker, even though clickstream volume (10Bn+/day) and "millions of tracker events per
  second" are quoted.
