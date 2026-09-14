# netflix-streaming: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/netflix-streaming.md`
- Size: 17 nodes, 24 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture: Netflix streaming, clean variant. An AWS control plane (ELB, Zuul,
aggregating and playback services, Eureka discovery, EVCache, Cassandra, RDS, Kafka, S3) that
authorises a play and steers the device to an Open Connect appliance, which carries the bytes.

Fixes relative to netflix-streaming.broken.yaml:
  - evcache is a cache, not the only copy: usedAsPrimaryStore false, and subscriber-service
    falls back to a degraded (secure-token) response when it is unavailable
  - cassandra declares last-writer-wins conflict resolution for its multi-region multi-leader ring
  - billing-db replicates across regions and keeps backups, so the three-region promise holds
  - eureka is replicated, so the phonebook every service depends on is not a single instance
  - every Hystrix-wrapped retrying hop declares a circuit breaker
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: Netflix streaming, broken variant. Same shape as netflix-streaming.yaml
with the mistakes the sources warn about: EVCache treated as the only copy of subscriber data
(the documented over-reliance incident), a multi-leader Cassandra ring with no conflict policy,
a single-region RDS with backups off while the design promises three-region failover, a single
non-replicated Eureka that every service depends on, and retrying hops with the Hystrix circuit
breakers taken off.

This file MUST trip:
  - cache-as-primary-store-without-persistence (evcache: usedAsPrimaryStore true, persistence false)
  - multi-leader-store-without-conflict-policy (cassandra: multi-region-multi-leader, conflictResolution none)
  - datastore-single-region                    (billing-db: replication none while multiRegion true)
  - datastore-missing-backup                   (billing-db: backupEnabled false)
  - shared-dependency-without-redundancy       (eureka: replicated false, discoveryRedundant required)
  - retry-without-adaptive-shedding            (zuul -> api-gateway-service and api-gateway-service -> subscriber-service retry with no circuit breaker)
and MUST NOT trip:
  - cache-missing-eviction-policy              (evcache declares lru)
  - materialised-cache-without-rebuild-path    (evcache is not materialised)
  - read-heavy-path-without-cache              (no readWriteRatio requirement, and a cache exists)
  - read-replica-as-sole-scaling, single-writer-primary-at-peak-qps (billing-db declares no rps)
  - credentials-without-rotation               (security.credentialRotationDays is set)
  - sync-chain-too-deep                        (the sources state no p95 latency target, so none is declared)
  - fanout-inline-in-request-path              (no app-server calls the encoding worker synchronously)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone (no availability-zone groups)
  - queue-missing-dlq, retry-queue-without-dlq, retry-without-backoff, pubsub-replay-required (no queue or topic)
  - derived-store-without-cdc-or-rebuild, business-updates-without-index-propagation (no search index)
  - object-store-single-zone-with-durability-target (no durability target declared; S3 spans three zones)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Device clients (TV, mobile, web) | `device` | `user-device` | client | exact |
| ELB | `elb` | `aws-classic-load-balancer` | load-balancer | close (sources say "ELB"; the classic variant is the one Netflix's edge is documented with) |
| Zuul | `zuul` | `zuul` | api-gateway | exact |
| API gateway service | `api-gateway-service` | `container-service` | app-server | exact |
| Playback service | `playback-service` | `container-service` | app-server | exact |
| Subscriber service | `subscriber-service` | `container-service` | app-server | exact |
| Open Connect control | `open-connect-control` | `container-service` | app-server | exact |
| Encoding pipeline | `encoding-pipeline` | `container-worker` | worker | close (in-house batch transcoder; no in-house media-transcoder generic exists) |
| Eureka | `eureka` | `eureka` | coordination-service | exact |
| EVCache | `evcache` | `evcache` | cache | exact |
| Cassandra | `cassandra` | `cassandra` | nosql-database | exact |
| RDS MySQL | `billing-db` | `aws-rds` | sql-database | exact |
| Kafka | `telemetry-stream` | `kafka` | stream | exact |
| S3 | `asset-store` | `s3` | object-store | exact |
| Atlas | `atlas` | `observability-stack` | monitoring | assumed (no Netflix Atlas component; the catalogue's `atlas` is Apache Atlas) |
| Open Connect storage OCA | `storage-oca` | `content-delivery-network` | cdn | close (no OCA component) |
| Open Connect edge OCA | `edge-oca` | `content-delivery-network` | cdn | close (no OCA component) |

Tally: 12 exact, 4 close, 1 assumed.

Group mapping: `aws-us-east-1` (region, one of the three active regions the sources name),
`edge` and `control-plane` (trust zones: untrusted devices reach ELB and Zuul, internal
services sit behind them), `ixp` and `isp-network` (points of presence: storage OCAs at
internet exchange points, edge OCAs embedded in ISP networks).

Edges taken from the card's edge table. The only assumed edge is
`subscriber-service -> billing-db`: the sources state that MySQL/RDS holds transactional
customer data but draw no arrow into it.

## Properties set because a rule reads them, where the source is silent

Per the brief, these reflect the sources' stated practice rather than a quoted number:

- `security.credentialRotationDays: 90` — no source states a rotation period; the design holds
  data, so the value is declared rather than leaving the design with no answer.
- `billing-db.backupEnabled: true`, `replication: "async"`, `multiAz: true` — the sources state
  three active-active AWS regions with traffic failover; a system-of-record with no replication
  and no backup would contradict that.
- `eureka.replicated: true` — Eureka is documented as peer-replicating; the sources call it the
  phonebook every service depends on.
- `cassandra.conflictResolution: "last-writer-wins"` — Cassandra's own documented cell
  resolution, and the component's default.
- `evcache` properties (`lru`, `multi-az`, consistent hashing, `persistence: false`) are the
  component's documented EVCache defaults, restated explicitly because the rules read them.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Open Connect Appliance | `cdn` | `content-delivery-network` with `label` per tier |
| Atlas (Netflix telemetry) | `monitoring` / `timeseries-database` | `observability-stack`, `label: "Atlas"` |
| Dynomite | `cache` | not encoded (no source states its callers) |
| Ribbon | `service-mesh` (client-side) | not a node; in-process library |
| Hystrix | resilience library | not a node; edge `retryPolicy` / `circuitBreaker` / `fallback` |

## Not encoded

- NCCP: named only in the intake card; no reachable source confirms it, so it was dropped.
- Three regions are a requirement (`availability.regions: 3`) but only one region group is
  drawn; the format has no way to say "this whole subgraph is replicated N times".
- Chaos Monkey, FIT, Spinnaker and Jenkins are ops tooling, not runtime architecture nodes.
- Auto-scaling groups are a property (`autoscaling: true`), not a node.
- Scale numbers the sources state but the format has no path for: 301M subscribers, 190
  countries, 15% of global downstream internet traffic, 65M concurrent live viewers,
  Kafka's 1.4 trillion messages/day. Only EVCache's 30M requests/sec fits (`nfr.rps`).
- Per-title and per-shot encoding, the VMAF perceptual metric and the bitrate ladder are
  properties of the encode, not expressible on a worker node.
- The live-event workload that defeats proactive CDN fill has no requirement path.
- DRM licence issue and manifest generation happen inside `playback-service`; the format has
  no sub-service decomposition.
- Cassandra's local-quorum writes: `quorumWrites` is an integer, and the sources give no
  replica count, so the intent is carried by `nfr.consistency: "eventual"` and the label only.
- Dynomite's multi-region Redis role and EVCache's cross-region replication are documented
  capabilities but no source states which data uses them here.
