# pokemon-go: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/pokemon-go.md`
- Size: 18 nodes, 20 edges, 4 groups (broken twin: 17 nodes, 19 edges, 4 groups).

## Clean variant (header of design.yaml)

Reference architecture 46, clean variant: Niantic's Pokemon GO on Google Cloud as the 2021
architecture describes it — global L7 ingress with a deliberate admission limit, an isolated
Google Front End pool, an NGINX tier inside GKE, the front-end game service and the spatial
query backend, Spanner as the transactional world state, and an analytics path that leaves the
request path through Pub/Sub and Bigtable.

Fixes relative to pokemon-go.broken.yaml:
  - the ingress is the global HTTP(S) load balancer, not the regional L4 Network Load Balancer,
    and edge-rate-limit sits in front of it, so the client's jittered exponential backoff retries
    into a tier that can shed load administratively instead of one that only amplifies them
  - game-state-db is Cloud Spanner with backups and a stated retention, not a managed store
    trusted to its own replication with no recovery point
  - event-topic keeps Pub/Sub's seven-day retention and replay, so the analysis pipeline can be
    re-run against past events as the design's replay requirement demands
  - analytics-pipeline declares a watermark for its event-time windows, so a location report
    that arrives late lands in a defined place instead of an undefined one
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture 46, broken variant: the same Pokemon GO stack as it stood into the 2016
launch — a regional L4 Network Load Balancer as the only ingress, a client that retries on a
constant backoff into it with nothing at the edge allowed to shed, a managed game-state database
nobody backed up, and an analytics path that can neither replay nor say what "late" means.

This file MUST trip:
  - retry-without-adaptive-shedding        (player-phone -> network-load-balancer and network-load-balancer -> nginx-proxy retry with no circuit breaker and no rate limiter in front of the callee)
  - datastore-missing-backup               (game-state-db: backupEnabled false, no retention)
  - pubsub-replay-required                 (event-topic: replay false while messaging.replay is true)
  - windowed-aggregation-without-watermark (analytics-pipeline windows by event time with no watermarkSeconds)
and MUST NOT trip:
  - credentials-without-rotation           (security.credentialRotationDays is still declared)
  - read-heavy-path-without-cache          (the design states no traffic.readWriteRatio)
  - datastore-single-region, object-store-single-zone-with-durability-target
                                           (no availability.multiRegion and no durability.annualNines requirement)
  - single-writer-primary-at-peak-qps, read-replica-as-sole-scaling
                                           (game-state-db is still sharded, distributed and multi-writer)
  - cache-missing-eviction-policy, cache-as-primary-store-without-persistence,
    materialised-cache-without-rebuild-path (no cache node; the sources never name the spatial cache product)
  - queue-missing-dlq, retry-queue-without-dlq, retry-without-backoff (no queue in this design)
  - derived-store-without-cdc-or-rebuild, business-updates-without-index-propagation (no search index)
  - sync-chain-too-deep                    (no api-gateway node and no latency.p95Ms target)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone
                                           (the sources never enumerate zones, so the design has no availability-zone group)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| User phone / Pokémon GO app | `player-phone` | `mobile-app` | client | exact |
| Cloud Load Balancing (GCLB, HTTP(S)) | `cloud-load-balancing` | `google-cloud-load-balancing` | load-balancer | exact |
| Network Load Balancer (legacy, pre-migration) | `network-load-balancer` (broken twin only) | `google-cloud-load-balancing` | load-balancer | close — same GCP product family, distinguished by `layer: "l4"`, `global: false` |
| Google Front End (GFE) | `google-front-end` | `load-balancer-tier` | load-balancer | close — no component for Google's edge serving tier |
| Cloud CDN | `cloud-cdn` | `google-cloud-cdn` | cdn | exact |
| Cloud Storage | `static-media` | `gcs` | object-store | exact |
| NGINX reverse proxy | `nginx-proxy` | `nginx` | load-balancer | exact — the catalogue files NGINX as a load-balancer, not the card's candidate `api-gateway` |
| Google Kubernetes Engine cluster | `gke-cluster` | `google-gke` | container-orchestrator | exact |
| Front-end game service | `frontend-game-service` | `container-service` | app-server | exact |
| Spatial query backend | `spatial-query-backend` | `container-service` | app-server | exact |
| Application server backends (2016 naming) | merged into `frontend-game-service` | `container-service` | app-server | close — the 2016 and 2021 sources draw the same tier under two names |
| Geospatial platform (map/world data) | `geospatial-platform` | `container-service` | app-server | close — in-house, split into its own repository; no product named |
| Cloud Spanner | `game-state-db` | `spanner` | sql-database | exact |
| Cloud Datastore (legacy) | not encoded | — | — | — (see "Not encoded") |
| Cloud Bigtable | `action-log` | `bigtable` | nosql-database | exact |
| Pub/Sub | `event-topic` | `google-pubsub` | pubsub-topic | exact |
| Dataflow | `analytics-pipeline` | `google-dataflow` | stream-processor | exact |
| BigQuery | `analytics-warehouse` | `bigquery` | data-warehouse | exact |
| Analysts / cheat detection / marketing (edge target) | `insights-service` | `container-service` | app-server | assumed — the sources name the consumers of BigQuery but draw no box |
| Cloud Monitoring / Logging | `cloud-monitoring` | `google-cloud-monitoring` | monitoring | exact |
| Administrative rate-limit override on the load balancers | `edge-rate-limit` | `envoy-ratelimit` | rate-limiter | close — an operator lever on GCLB, not a product; no GCP rate-limiter component |
| Google private fiber network | not encoded | — | network-fabric | — |
| Quota / capacity control plane | not encoded | — | policy-engine | — |

Tally: 14 exact, 5 close, 1 assumed; 4 source rows not encoded.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Google Front End (GFE) | load-balancer | `load-balancer-tier` (default) |
| Google Cloud administrative rate-limit override at the load balancer | rate-limiter | `envoy-ratelimit` (default); no GCP component exists for this kind |
| Google private fiber backbone | network-fabric | nothing — the GCP network-fabric components are VPC and interconnect resources, none of which is Google's own backbone |
| Google Cloud quotas (the SRE control plane) | policy-engine | nothing — the catalogue inventory marks "Cloud Quotas" as a skip, "quota management tooling" |

## Assumed values, written only to satisfy a rule

The sources are silent on all three. Each is set to the value that reflects the documented
practice, not to a number any source states.

- `security.credentialRotationDays: 90` — the design holds data and has no key-management node, so
  `credentials-without-rotation` would fire. Every datastore here is a managed Google Cloud service
  reached through IAM service identities; 90 days is the repository's house value for that.
- `game-state-db.backupEnabled: true`, `backupRetentionDays: 30` — Spanner backups are opt-in and no
  source says whether Niantic enables them. A game-state system of record with no recovery point is
  what the rule exists to catch, so the clean design asserts the backup and the broken twin removes it.
- `analytics-pipeline.watermarkSeconds: 60` — Dataflow's default is event-time windowing with zero
  allowed lateness. The source states a batch and a streaming path over player action logs but never a
  watermark; 60 seconds stands for "a bounded, declared lateness".

## Not encoded

- Cloud Datastore, the pre-Spanner game-state store, and the live migration off it. Both variants encode
  one game-state tier; the format has no way to show a store being replaced while the system runs, and
  drawing Datastore and Spanner side by side would assert a dual-write topology no source describes.
- Google's private fiber backbone. It carries most of the transit between player and cluster, but it is a
  property of every edge rather than a box, and no `network-fabric` component names it.
- Quota management as the operating model — "the only thing that the Niantic SRE team needs to ensure is
  that they have the right quota for these events". There is no place in a design for an operator lever.
- The launch numbers themselves: 50x the load-test estimate, 20x the previous global RPS peak during the
  retry storm, 200% higher true client demand than previously observed, 3x the US launch volume in Japan,
  many tens of thousands of cores, "more than a thousand additional nodes" added mid-launch. The format
  carries `nfr.rps` per node and `traffic.peakMultiplier` per design; none of these is a steady-state rate
  or a peak-over-average, so encoding any of them would state something the source does not.
- The event-driven load shape: ~400K transactions/sec rising to nearly 1M during GO Fest. Only the steady
  400K is encoded, as `game-state-db.nfr.rps`.
- Determinism — "all servers operate deterministically", so two players in the same physical place see the
  same world. It is a correctness property of the service tier with no requirement path.
- The spatial sharding scheme. The spatial query backend is "sharded by location" and does
  "location-based caching", but no source names S2, geohash or a quadtree, nor the cache product, so
  `shardingStrategy` is left unset and no cache node exists.
- NGINX request buffering as the resource-exhaustion point, and the L4 ingress's two SSL round trips and
  lack of SYN-flood mitigation. The broken twin shows the L4 ingress and labels the buffering proxy, but
  the `load-balancer` kind has no property for TLS termination cost or attack mitigation.
- Region and zone topology. Never stated in any source, so the design has one `region` group standing for
  "Google Cloud, global footprint" and no `availability-zone` groups.
