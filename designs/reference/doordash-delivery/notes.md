# doordash-delivery: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/doordash-delivery.md`
- Size: 15 nodes, 19 edges, 3 groups.

## Clean variant (header of design.yaml)

Reference architecture: DoorDash order and delivery platform (Kotlin gRPC services,
CockroachDB, Kafka/Iguazu, Flink, Cadence fallback, Aperture load shedding), clean
variant. Stateless services span both zones (group is the region); the legacy monolith
runs in an autoscaling group across both zones.

Fixes relative to doordash-delivery.broken.yaml:
  - orders-db is CockroachDB: multi-writer, sharded, distributed
  - the legacy monolith spans both availability zones instead of being pinned to one
  - the BFF retry carries a circuit breaker and Aperture limits the services it retries into
  - delivery-service hands failed merchant calls to Temporal instead of calling inline only
  - Flink declares a 60 s watermark for its event-time windows
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: DoorDash order and delivery platform, broken variant. Same shape
as doordash-delivery.yaml but as it stood before the migrations: one single-writer Aurora
primary at 1.6M QPS with async replicas as the only scaling, a stateful monolith pinned to
one zone, BFF retries into services with no circuit breaker or load shedding, merchant
calls inline with no workflow fallback, and Flink event-time windows with no watermark.

This file MUST trip:
  - single-writer-primary-at-peak-qps           (orders-db multiWriter false, sharded false, rps 1600000)
  - read-replica-as-sole-scaling                (orders-db replication async, sharded false, distributed false, rps 1600000)
  - stateful-node-without-zone-redundancy       (legacy-monolith stateless false, only in us-west-2a, not in a cell)
  - retry-without-adaptive-shedding             (bff -> order-service retryPolicy exponential, no circuitBreaker, no rate limiter in front)
  - external-call-inline-without-durable-path   (delivery-service calls merchant-pos sync, no queue or workflow engine attached)
  - windowed-aggregation-without-watermark      (event-processor windowing event-time, no watermarkSeconds)
and MUST NOT trip:
  - datastore-missing-backup                    (orders-db declares backup and retention)
  - datastore-single-region                     (multiRegion false)
  - sync-chain-too-deep                         (bff -> order-service -> orders-db is 2 hops)
  - cache-missing-eviction-policy               (feature-store declares lru)
  - read-heavy-path-without-cache               (feature-store is a cache node)
  - credentials-without-rotation                (security.credentialRotationDays set)
  - money-mutation-without-idempotency-key      (correctness.exactlyOnceEffect not set)
  - object-store-single-zone-with-durability-target (events-buffer spans 3 zones)
