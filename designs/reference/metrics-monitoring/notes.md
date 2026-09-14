# metrics-monitoring: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/metrics-monitoring.md` (Alex Xu and Sahn Lam, *System Design Interview* vol 2 ch 5, via the author's ByteByteGo overview and a public chapter-notes page; plus the official Prometheus architecture overview). Re-verified 2026-09-14.
- Size: 22 nodes, 21 edges, 4 groups. The broken twin keeps the same 22 nodes and adds one edge.

## Clean variant (header of design.yaml)

Reference architecture, clean variant: metrics monitoring and alerting — pull collection with
service discovery, a Kafka buffer between collection and storage, a tiered downsampled TSDB,
and an alert path that is buffered before it reaches the pager.

Fixes relative to metrics-monitoring.broken.yaml:
  - alert-evaluator never calls a pager directly; it hands firing alerts to alert-manager,
    which groups and publishes to alert-kafka, and notification-consumers deliver from there
  - the three outbound notification edges retry with a circuit breaker instead of retrying blind
  - query-cache declares a ttl eviction policy, so the vendor default does not decide
  - aggregation-consumers do not claim event-time windows without a watermark
  - alert-webhook verifies the caller's signature and deduplicates by alert id
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture, broken variant: the same metrics monitoring and alerting system, with
the alert path mailing a third party inline from the rule evaluator, blind retries on every
outbound notification, an undeclared eviction policy on the dashboard cache, event-time
aggregation with no watermark, and an unverified alert webhook.

This file MUST trip:
  - external-call-inline-without-durable-path  (alert-evaluator calls the SMTP relay synchronously; only a stream, no queue or workflow engine)
  - retry-without-adaptive-shedding            (the inline mail edge and the three notification edges retry with no circuit breaker and no rate limiter in front)
  - cache-missing-eviction-policy              (query-cache declares no evictionPolicy)
  - windowed-aggregation-without-watermark     (aggregation-consumers window by event time with no watermarkSeconds)
  - webhook-without-signature-or-idempotency   (alert-webhook verifies no signature and deduplicates nothing)
and MUST NOT trip:
  - credentials-without-rotation, the cache rules, the queue and pub/sub rules, the sql-database
    rules, derived-store-without-cdc-or-rebuild, read-heavy-path-without-cache,
    fanout-inline-in-request-path, sync-chain-too-deep, the zone and discovery rules,
    object-store-single-zone-with-durability-target and exactly-once-with-external-side-effects
    — see the file's own header for the reason against each.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Metrics sources / exporters | `metrics-source` | `container-service` | app-server | close |
| Short-lived job with push agent | `short-lived-job` | `container-worker` | worker | close |
| Service discovery (etcd, ZooKeeper) | `service-discovery` | `etcd` | coordination-service | exact |
| Metrics collector (pull) | `pull-collector` | `prometheus` | monitoring | exact |
| Push gateway (Prometheus Pushgateway, StatsD) | `push-gateway` | `observability-stack` | monitoring | close |
| Kafka | `metrics-kafka` | `kafka` | stream | exact |
| Stream consumers (Flink, Spark, Storm) | `aggregation-consumers` | `flink` | stream-processor | exact |
| Time-series database (InfluxDB, Prometheus TSDB, Goku, M3DB) | `tsdb` | `influxdb` | timeseries-database | close |
| Cold storage | `cold-storage` | `blob-store` | object-store | exact |
| Downsampling jobs | `downsampling-job` | `cron-job` | worker | exact |
| Query service | `query-service` | `container-service` | app-server | exact |
| Query cache | `query-cache` | `cache-cluster` | cache | exact |
| Alert rules config | `alert-rules-config` | `etcd` | coordination-service | close |
| Alert rule evaluation | `alert-evaluator` | `container-service` | app-server | close |
| Alert manager | `alert-manager` | `alertmanager` | notification-service | exact |
| Alert store (Cassandra) | `alert-store` | `cassandra` | nosql-database | exact |
| Alert Kafka | `alert-kafka` | `kafka` | stream | exact |
| Notification consumers | `notification-consumers` | `container-worker` | worker | exact |
| Email destination | `email-relay` | `smtp-relay` | third-party-api | exact |
| PagerDuty destination | `pager` | `pagerduty` | notification-service | exact |
| Webhook destination | `alert-webhook` | `webhook-receiver` | webhook-endpoint | close |
| Visualization (Grafana) | `grafana-dashboards` | `grafana` | monitoring | exact |

Tally: 16 exact, 6 close, 0 assumed.

The card draws the alert manager as one box that both evaluates the rules and routes the
notifications. It is split into `alert-evaluator` and `alert-manager` because both sources
describe two distinct behaviours — rule evaluation against the TSDB (Prometheus server) and
deduplication, grouping and routing (Alertmanager) — and the catalogue has one component per
behaviour. That is the only box the design splits; nothing is merged.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Prometheus Pushgateway | monitoring with `collectorMode: "push"` for short-lived jobs | `observability-stack` with `collectorMode: "push"` |
| StatsD | monitoring (UDP push aggregator) | drawn as part of `push-gateway`, not a separate node |

## Values set because a rule reads them, where the source is silent

- `security.credentialRotationDays: 90`. The sources say nothing about credential rotation; the
  design holds data, so `credentials-without-rotation` reads this path. 90 days matches the other
  reference designs.
- `evictionPolicy: "ttl"` on `query-cache`. The sources state the query service caches dashboard
  queries but not how it evicts. TTL is the only policy consistent with "cached query results".
- `circuitBreaker: true` on the three outbound notification edges. The card states those calls are
  "retried"; a retry with no breaker is exactly what `retry-without-adaptive-shedding` forbids, so
  the breaker is the practice the rule assumes alongside the documented retry.

## Not encoded

- The write rate. The sources state 10M metrics/sec across the fleet, but that is a fleet-wide
  data-point rate, not the request rate of any one node, and `nfr.rps` is per node.
- The retention ladder (raw 7 days, 1-minute 30 days, 1-hour 1 year). Only `retentionRawDays: 7`
  and `downsampling: true` survive; the format has no field for the downsample intervals or for
  the retention of each rollup.
- Hot/warm/cold sizes and the in-memory tier duration. `tiers: "hot-warm-cold"` says the shape,
  not the 24 h in-memory window that the cross-reference cards describe.
- Cardinality. The sources call high label cardinality the cost driver; the format has no
  cardinality field on `timeseries-database`.
- Federation between Prometheus servers, and remote write to a long-term store as a topology.
  `remoteWrite: true` records that the collector writes remotely; the federation fan-in between
  several Prometheus servers is a second collector layer the sources do not draw.
- Alertmanager inhibition and silencing, and Alertmanager clustering for high availability.
  No property expresses them, and the card lists HA as an unknown.
- The aggregation-point choice (collector, ingestion, or query). The sources present it as a
  tradeoff; the design takes the ingestion option by putting `aggregation-consumers` between
  Kafka and the TSDB, but the option itself is not a field.
- The scrape interval. There is no edge property for it.
- Grafana is drawn as the dashboard client, so the operator's browser is not a separate node.
