# gojek-platform: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/gojek-platform.md` (17 posts on Gojek's own engineering blog, blog.gojek.io, 2018-2022, plus the gojek/ziggurat open-source repository).
- Size: 24 nodes, 30 edges, 3 groups.

## Clean variant (header of design.yaml)

Gojek super-app platform, clean variant: a persistent MQTT channel (Courier) to driver and
merchant phones, a Redis-Cluster geo-search that feeds allocation, and a fronting-buffered
Kafka event platform with a high-retention mirror stream behind it.

Fixes relative to gojek-platform.broken.yaml:
  - driver locations live in a Redis Cluster with a declared eviction policy, not in the
    PostgreSQL table that re-indexed on every location update and did not scale
  - allocations-service calls available-driver-service with a circuit breaker and a degraded
    fallback instead of a bare fixed retry (the 15-second retry that caused the hour-long
    thundering herd)
  - courier-webhook verifies the plugin signature and deduplicates by event id
  - rabbitmq-retry keeps Ziggurat's dead-set queue and its linear (fixed) backoff, and the
    booking termination queue declares a dead-letter queue
  - dagger declares a watermark for its event-time windows
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Gojek super-app platform, broken variant: driver locations back on the single PostgreSQL
table that re-indexed on every update, allocation retrying geo-search on a bare fixed
interval, an unsigned Courier webhook, Ziggurat retries with no dead-set queue, and Dagger
windowing by event time with no watermark.

This file MUST trip:
  - single-writer-primary-at-peak-qps          (driver-location-db: one unsharded Postgres writer at 10000 rps)
  - retry-without-adaptive-shedding            (allocations-service -> available-driver-service retries fixed, no circuit breaker, no rate limiter)
  - webhook-without-signature-or-idempotency   (courier-webhook verifies nothing and deduplicates nothing)
  - retry-queue-without-dlq                    (rabbitmq-retry is a retry queue with no dead-set queue)
  - queue-missing-dlq                          (same queue, async in-edge from ziggurat-consumer)
  - windowed-aggregation-without-watermark     (dagger windows by event time with no watermark)
and MUST NOT trip:
  - retry-without-backoff                      (rabbitmq-retry still declares Ziggurat's linear/fixed backoff)
  - datastore-missing-backup, read-replica-as-sole-scaling, datastore-single-region
  - cache-missing-eviction-policy, cache-as-primary-store-without-persistence, materialised-cache-without-rebuild-path
  - read-heavy-path-without-cache, credentials-without-rotation, sync-chain-too-deep
  - fanout-inline-in-request-path, derived-store-without-cdc-or-rebuild, business-updates-without-index-propagation
  - reconnect-stampede-without-guard, stateful-websocket-scale-in-without-drain, shared-host-per-channel-without-isolation

Every mistake in the twin is one the sources themselves describe: the Postgres geo-search that
"was not scaling due to the high write load... led to re-indexing on every update of the
location", the dependent system that "does a retry every 15 seconds which took the entire
system down for approximately an hour", and the Ziggurat retry path before the dead-set queue
and the infinite-reconnect fix.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Customer / driver / merchant apps | `gojek-app` | `mobile-app` | client | exact |
| Google Cloud Load Balancer | `gclb` | `google-cloud-load-balancing` | load-balancer | exact |
| HAProxy | `haproxy` | `haproxy` | load-balancer | exact |
| VerneMQ brokers (Courier) | `vernemq` | `vernemq` | iot-hub | close (the sources stress broker semantics; `iot-hub` is the nearest kind) |
| WebHook server | `courier-webhook` | `webhook-receiver` | webhook-endpoint | exact |
| Nginx ingress controller | `nginx-ingress` | `nginx` | load-balancer | close (the ingress controller itself has no component; NGINX is the engine) |
| Booking service (named in the source's edge list) | `booking-service` | `container-service` | app-server | exact |
| Allocations service (ex bid engine) | `allocations-service` | `container-service` | app-server | exact |
| Available Driver Service (ADS) | `available-driver-service` | `container-service` | app-server | exact |
| Booking termination flow | `booking-termination-worker` | `container-worker` | worker | exact |
| Booking termination queue | `booking-termination-queue` | `message-queue` | queue | close (queue-backed, product not named) |
| Redis Cluster (driver location index) | `driver-location-index` | `redis` | cache | exact |
| Booking history store | `booking-history` | `cassandra` | nosql-database | exact |
| Fronting REST server | `fronting-rest` | `container-service` | app-server | exact |
| Fronting Kafka | `fronting-kafka` | `kafka` | stream | exact |
| Fronting Worker | `fronting-worker` | `container-worker` | worker | exact |
| Data streams (central Kafka) | `data-streams` | `kafka` | stream | exact |
| Mirror stream | `mirror-stream` | `kafka` | stream | exact |
| Ziggurat consumer apps | `ziggurat-consumer` | `kafka-streams` | stream-processor | close (Ziggurat is a Clojure framework over Kafka Streams 2.8) |
| RabbitMQ retry and dead-letter queues | `rabbitmq-retry` | `rabbitmq` | queue | exact |
| Dagger | `dagger` | `flink` | stream-processor | exact |
| Firehose | `firehose` | `container-worker` | worker | exact |
| Sakaar / Secor archival | `sakaar` | `container-worker` | worker | exact |
| Cold storage (parquet) | `cold-storage` | `gcs` | object-store | exact |
| PostgreSQL geo index (broken twin only) | `driver-location-db` | `postgres` | sql-database | exact |

Tally: 20 exact, 4 close, 0 assumed. Boundaries: `edge` (trust-zone, "mobile clients ->
GCLB/HAProxy edge -> internal services"), `product` and `data-engineering` (vpc, the source's
"namespaces", "a segregation on the basis of network isolation").

### Values set because a rule reads them and the source is silent

The brief requires the clean design to trip nothing; where a source is silent on a property a
rule reads, the value below reflects the practice the source describes, and is stated here.

- `security.credentialRotationDays: 90` — no rotation period is published anywhere.
- `driver-location-index.evictionPolicy: "ttl"` — the source says durability is not required
  and locations are re-pinged every couple of seconds; no eviction policy is named.
- `booking-termination-queue.deadLetterQueue: true` — the source says the work is "retried
  once the failure is rectified" but never names a dead-letter queue.
- `courier-webhook.signatureVerified: true` / `idempotent: true` — the plugin webhook is
  described but its authentication is not.
- `dagger.watermarkSeconds: 60` — Dagger does event-time windowed aggregation on Flink; no
  watermark value is published.
- The protocol on `gojek-app -> available-driver-service` and on the booking-termination edges
  is recorded by the card as "not stated"; `http` and `amqp` are placeholders for a required
  field, not source facts.
- `available-driver-service.nfr.rps: 13333` is arithmetic on stated numbers only: 600,000
  writes per minute plus 200,000 searches per minute.

## Catalogue gaps

none. Every box mapped to an existing component. Nearest strain: `vernemq` sits under the
`iot-hub` kind while the sources use it as a clustered MQTT message broker (QoS, retained
sessions, webhook plugins); a `message-broker` or `mqtt-broker` kind would fit better if a
second sighting appears. The Nginx ingress controller is modelled as plain NGINX.

## Not encoded

- Heimdall's concrete defaults (30 max concurrent requests, 20% error threshold, 1500 ms sleep
  window, 4 retries) — v1 edges carry `timeoutMs`, `retryPolicy` and `circuitBreaker` but no
  bulkhead size, error threshold or sleep window.
- The fronting Redis buffer and the fronting failover drainer: a cache used purely as a
  store-and-forward buffer cannot declare an eviction policy without misstating the source, and
  the format has no "buffer" role for a cache.
- The perf stream ("an exact copy of the data stream for chaos engineering") and Loki, the
  chaos tool that terminates instances: no chaos-target requirement path exists.
- The Litmus experimentation sidecar, Consul, the Google Maps rate-limiting proxy, FCM push
  fallback, SMS provider failover, GoPay's Fraud Rules Service, Barito logging and the
  InfluxDB/Enigma/Cosmos/Atlas metric path: all documented, all cut to keep the design inside
  the 25-node reference budget. The spine kept is order -> allocation -> geo-search plus the
  event platform every other service reads from.
- "Driver and customer APIs physically separated on different clusters": the format has no way
  to say two groups are deliberately disjoint compute estates.
- The GCP live-migration incident (`migrateOnHostMaintenance` -> `terminateOnHostMaintenance`)
  and the HAProxy/VerneMQ connection ceilings: host-maintenance policy and connection limits
  are not properties of any kind.
- The 50-internal-load-balancer-per-project quota that forced the shared ingress.
