# lyft-envoy: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/lyft-envoy.md`
- Size: 23 nodes, 37 edges, 6 groups.

## Clean variant (header of design.yaml)

Lyft's Envoy service mesh: an edge Envoy at the internet boundary, a sidecar Envoy that is the
sole ingress and egress of every microservice, an xDS control plane that is allowed to fail, a
global rate limit service, and a Kafka change-data-capture bus feeding Flink and Beam pipelines.

Fixes relative to lyft-envoy.broken.yaml:
  - every datastore call leaves the service through its sidecar Envoy, so the mesh produces the
    L7 stats that MongoDB, DynamoDB and Redis do not, and no service talks to a store directly
  - the Envoy-to-Envoy hop retries with exponential jitter and breaks the circuit, the pairing
    the Envoy documentation describes, instead of retrying into a saturated upstream
  - rides-db is tailed by cdc-tailer into cdc-bus; search-index is fed asynchronously by the
    multi-tenant cdc-adapter instead of being dual-written from application code
  - ratelimit-redis and service-cache both declare an eviction policy
  - the streaming pipelines declare no event-time windowing, so no watermark is implied
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Lyft's Envoy service mesh, broken variant: the same mesh with the mistakes a team adopting it
makes. Services reach Aurora and Elasticsearch directly instead of through the sidecar, so the
mesh sees none of it; the Envoy-to-Envoy hop retries without breaking the circuit; the rate
limit counters run on a Redis with no eviction policy; the search index is dual-written from
application code with no change data capture behind it; and the feature pipeline windows by
event time with no watermark.

This file MUST trip:
  - retry-without-adaptive-shedding             (api-service-sidecar -> pricing-service-sidecar retries with no circuitBreaker, and the target has no rate limiter in front of it)
  - cache-missing-eviction-policy               (ratelimit-redis declares no evictionPolicy)
  - business-updates-without-index-propagation  (api-service writes rides-db synchronously, a search index exists, no change-data-capture leaves rides-db)
  - derived-store-without-cdc-or-rebuild        (search-index is only written synchronously by api-service)
  - windowed-aggregation-without-watermark      (feature-pipeline windows by event time with no watermarkSeconds)
and MUST NOT trip:
  - credentials-without-rotation                (security.credentialRotationDays is still declared)
  - datastore-missing-backup                    (rides-db keeps backupEnabled and a retention period)
  - read-heavy-path-without-cache               (no traffic.readWriteRatio requirement, and the design has caches)
  - datastore-single-region, object-store-single-zone-with-durability-target
    (no availability.multiRegion and no durability.annualNines requirement)
  - sync-chain-too-deep                         (no latency.p95Ms requirement)
  - shared-dependency-without-redundancy, stateful-engine-pinned-to-single-zone
    (no availability.discoveryRedundant requirement and no availability-zone group)
  - fanout-inline-in-request-path, external-call-inline-without-durable-path
    (no app-server calls a worker or a third-party API synchronously)
  - queue-missing-dlq, retry-queue-without-dlq, pubsub-replay-required
    (the design has no queue and no pubsub-topic; the event bus is a replayable stream)
  - cache-as-primary-store-without-persistence, materialised-cache-without-rebuild-path
    (neither cache is materialised or used as a primary store)

## Mapping

| source box | node | component | kind | confidence |
|---|---|---|---|---|
| Lyft mobile apps (Envoy Mobile) | `lyft-mobile-app` | `mobile-app` | client | exact |
| Front / edge proxy | `edge-envoy` | `envoy-gateway` | api-gateway | close (the front proxy is plain Envoy, not the Gateway-API distribution; `gatewayApi: false`) |
| Sidecar Envoy, service-to-service egress listener (localhost:9001), ingress listener (servicename:9211), external service egress listeners (localhost:9250) | `api-service-sidecar`, `pricing-service-sidecar` | `envoy-sidecar` | service-mesh | exact (the four listener rows are folded into the sidecar node and carried in edge labels) |
| Python and Go microservices | `api-service`, `pricing-service` | `container-service` | app-server | exact |
| Global rate limit service | `rate-limit-service` | `envoy-ratelimit` | rate-limiter | exact |
| Redis behind the rate limit service | `ratelimit-redis` | `redis` | cache | exact |
| Discovery service (SDS/EDS) + xDS control plane | `xds-control-plane` | `k8s-endpoints` | coordination-service | assumed (one node for both rows; no generic in-house control-plane component exists — see Catalogue gaps) |
| Kubernetes clusters | `kubernetes` | `kubernetes` | container-orchestrator | exact |
| Stats, tracing and dashboard tier | `tracing-stack` | `zipkin` | monitoring | close (the source names Zipkin tracing support, statsd and gRPC stat sinks; one node stands for all of them) |
| Aurora / RDS | `rides-db` | `aurora` | sql-database | exact |
| DynamoDB | `sessions-store` | `dynamodb` | nosql-database | exact |
| MongoDB | `mongo-store` | `mongodb` | nosql-database | exact |
| Redis (Envoy Redis proxy) | `service-cache` | `redis` | cache | exact |
| CDC tailer services (DynamoDBTailer, AuroraTailer) | `cdc-tailer` | `debezium` | change-data-capture | assumed (in-house Go tailers; nearest generic — see Catalogue gaps) |
| Kafka (CDC event bus and feature topics) | `cdc-bus` | `kafka` | stream | exact |
| CDC adapter service | `cdc-adapter` | `container-worker` | worker | exact |
| Elasticsearch sink of the adapter | `search-index` | `elasticsearch` | search-index | exact |
| Firehose | `archive-firehose` | `aws-firehose` | stream-processor | exact |
| S3 archive and Flink state store | `stream-archive` | `s3` | object-store | exact |
| Feature-generation pipeline (Beam on Flink) | `feature-pipeline` | `beam` | stream-processor | exact |
| Model-execution pipeline | `model-pipeline` | `flink` | stream-processor | exact |

Assumed property values, none of them stated by any source, set so the clean design does not
trip a rule that encodes a practice the real system certainly has:

- `ratelimit-redis.evictionPolicy: ttl` and `service-cache.evictionPolicy: lru` — rate limit
  counters are fixed-window keys with a TTL; the proxied caching tier is an ordinary LRU cache.
- `rides-db.backupRetentionDays: 7` (Aurora's `backupEnabled` already defaults to true).
- `requirements.security.credentialRotationDays: 90`.
- `cdc-bus.acks: all` — the source states ordering and at-least-once/exactly-once delivery
  matter, which leader-only acks cannot provide, but never states the broker setting.

## Catalogue gaps

- **Envoy xDS control plane / discovery service** — needs a generic in-house
  `coordination-service` under `default` (role `discovery`, plus a `failOpen` property to express
  "the design assumes that the discovery service can fail at any time"). Used `k8s-endpoints`,
  the only Kubernetes-event-driven coordination-service in the catalogue.
- **Lyft DynamoDBTailer / AuroraTailer** — needs a generic in-house `change-data-capture` under
  `default`. Used `debezium`, the nearest log-based CDC.
- Envoy's separate egress / ingress / external-service listeners have no representation; they
  would be `service-mesh` properties (`ingressPort`, `egressPort`,
  `externalEgressPortPerService`), not components.

## Not encoded

- The 2016 scale figures (2 million rps, thousands of nodes, 100+ services) — the Lyft blog post
  that states them returned HTTP 403 on 2026-09-14 and could not be re-verified. Only the 2018
  InfoQ figure survives, as `edge-envoy.nfr.rps: 5000000` (the low end of "five to ten million
  mesh requests per second").
- The pre-Envoy AWS ELB discovery tier and the PHP/Apache monolith: the source calls both
  historical (ELB replaced, monolith decomposition completed in 2018), so neither is a runtime box.
- The legacy service-assigned EC2 auto-scaling fleet that the mesh spans alongside Kubernetes.
  The format has no way to say "these two substrates carry the same node set".
- Envoy's 2x2 discovery/health-check matrix. The design can say the health-check edge exists
  (`api-service-sidecar -> pricing-service-sidecar`, async, at-most-once) but not that health
  data outranks discovery data, nor that only absent-and-failing purges a host.
- The staging mesh, offloaded deployments (`offloaded-deploy=true` pods filtered out of
  discovery) and per-request routing overrides riding in OpenTracing baggage. Only the filtering
  survives, as an edge label.
- Language independence as a hard requirement: `runtime: python` and `runtime: go` on the two
  services hint at it, but the format has no requirement path for "one mesh, many languages".
- 100% trace coverage and the 20,000-host global health dashboard: `observability` has no
  requirement path for per-hop stats or trace coverage.
- The retired Devbox / Onebox development environments and Lyft's own Flink Kubernetes operator,
  replaced by the Apache operator. Both are history, not runtime topology.
