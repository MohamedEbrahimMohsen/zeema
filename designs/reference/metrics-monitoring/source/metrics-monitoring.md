# Intake: Metrics monitoring and alerting (Xu vol 2 ch 5) with Prometheus and production TSDBs

## Source
- Primary: Alex Xu and Sahn Lam, System Design Interview vol 2, chapter 5 "Metrics Monitoring and Alerting System"; author's overview https://blog.bytebytego.com/p/metric-monitoring and chapter notes via search summary of https://raymondjones.dev/en/system-design-notes/5-metrics-monitoring-and-alerting-system/
- Primary: https://prometheus.io/docs/introduction/overview/ (official Prometheus architecture and limitations)
- Cross-references: pinterest-feed (Goku TSDB, Gorilla in-memory 24 h, Kafka pull ingestion), linkedin-kafka (Kafka Monitor, Burrow, audit), booking-search (Nanotube metrics router, Events pipeline), netflix-streaming (Atlas), uber-dispatch (M3)
- Verified by: canonical textbook chapter + official Prometheus docs + production cards
- Confidence: high
- Date of source: 2022 (book), Prometheus docs current

## System in three lines
Collects operational metrics from thousands of hosts and services, stores them as labelled time series with aggressive downsampling and tiered retention, serves queries for dashboards, and evaluates alert rules that route notifications to email, pagers and webhooks. Collection is pull (Prometheus style, with service discovery) or push (agents into a gateway), decoupled from storage through Kafka so bursts and consumer outages do not lose data; the time-series database keeps recent data hot in memory and older data on disk or cold storage. Hard because write volume is millions of points per second, cardinality explodes with labels, and alerting must be reliable exactly when everything else is failing.

## Scale (only if stated)
- Users / DAU: book 100M DAU
- Requests per second: book 1,000 pools x 100 machines x 100 metrics = 10M metrics/sec write; reads low
- Data volume: book retention: raw 7 days, 1-minute resolution 30 days, 1-hour resolution 1 year; Goku keeps 24 h in memory with 12x compression
- Message throughput: Nanotube routes "tens of millions metric data points per second" (booking card)
- Prometheus: standalone servers, local storage, federation and remote write for long term

## Requirements stated or clearly implied
- Availability target: monitoring must work when other systems fail; Prometheus "standalone servers" with no dependency on distributed storage
- Consistency: eventual; approximate counts acceptable; Prometheus "if you need 100% accuracy, such as for per-request billing, Prometheus is not a good choice"
- Latency target: dashboard queries interactive; alert evaluation within seconds to a minute
- Ordering needs: timestamps per series; out-of-order handling in TSDB
- Replay or reprocessing: Kafka buffer allows consumers to catch up; downsampling jobs recompute
- Retention: tiered, 1 year total in book; cold storage for archives
- Compliance / residency: not stated
- Cardinality: label indexes for fast lookup; high cardinality is the known cost driver

## Boundaries
- Regions / zones: per datacenter collectors; federation across Prometheus servers
- Trust zones: metrics sources (internal) -> collectors -> Kafka -> TSDB; alert destinations external (PagerDuty, email)
- Named subsystems: Metrics sources and exporters, Collectors (pull with service discovery or push gateway), Kafka, Consumers (aggregation via Flink/Spark/Storm), Time-series DB (hot and cold tiers), Query service and cache, Alerting (rules, alert manager, alert store, notification consumers), Visualization (Grafana)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Metrics sources / exporters | Servers, DBs, queues expose metrics endpoints; agents for push | Prometheus exporters, StatsD | property of app-server (metrics endpoint) | |
| 2 | Service discovery | Tells pull collectors which targets exist | etcd, ZooKeeper, DNS, Kubernetes API | service-registry | |
| 3 | Metrics collector (pull) | Scrapes targets on interval; scales by consistent hashing over targets | Prometheus server, in-house | worker (collector) | mode: pull |
| 4 | Push gateway / collector (push) | Receives agent pushes, short-lived jobs | Prometheus pushgateway, StatsD | worker (collector) | mode: push |
| 5 | Kafka | Decouples collection from processing; buffers bursts | Apache Kafka | stream | |
| 6 | Stream consumers | Aggregate, downsample, write to TSDB | Flink, Spark, Storm | stream-processor | |
| 7 | Time-series database | Labelled series, label index, compression, hot memory tier and disk | InfluxDB, Prometheus TSDB, Goku, M3DB | timeseries-database | tiers: hot, warm, cold |
| 8 | Cold storage | Archived old data | object storage | object-store | |
| 9 | Downsampling jobs | Raw to 1-minute to 1-hour rollups | scheduled | scheduled-job + etl-job | |
| 10 | Query service + cache | Thin wrapper over TSDB, caches dashboard queries | in-house, PromQL | api-gateway + cache | |
| 11 | Alert rules config | YAML rules evaluated on interval | files/config store | coordination-service (config) | |
| 12 | Alert manager | Evaluates rules, dedups, groups, silences, routes | Prometheus Alertmanager | app-server (alerting) | grouping: true; inhibition: true |
| 13 | Alert store | Alert state persistence | Cassandra or KV | nosql-database | |
| 14 | Alert Kafka + consumers | Fan out alerts to channels | Kafka, workers | stream + notification-service | |
| 15 | Notification destinations | Email, PagerDuty, webhooks | third parties | third-party-api + webhook-endpoint | |
| 16 | Visualization | Dashboards | Grafana | web-client (ops UI) | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| collector (pull) | service discovery | api | sync | | targets |
| collector (pull) | metrics source | http /metrics | sync | | interval scrape |
| agent (push) | push gateway | udp/http | async | at-most-once | |
| collector | kafka | kafka | async | at-least-once | buffer |
| kafka | stream consumers | kafka | async | at-least-once | aggregate |
| consumers | tsdb | write | sync | | |
| tsdb hot | tsdb disk | flush | async | | periodic |
| downsampling jobs | tsdb | read/write | async | | rollups |
| tsdb | cold storage | archive | async | | |
| dashboard | query service | http/promql | sync | | cached |
| query service | tsdb | query | sync | | |
| alert manager | tsdb (via query) | query | sync | | rule evaluation |
| alert manager | alert store | write | sync | | state |
| alert manager | alert kafka | publish | async | at-least-once | |
| alert kafka | notification consumers | kafka | async | at-least-once | |
| notification consumers | email / pagerduty / webhook | https | async | retried | |

## Failure modes, incidents, tradeoffs the source discusses
- Pull vs push: pull needs service discovery and cannot easily reach short-lived jobs; push needs a gateway and coordination (ZooKeeper/etcd) to avoid overloading collectors. Source: book summary.
- Decouple with Kafka so a slow TSDB or consumer outage does not drop metrics; Goku moved to shard-aware pull for the same reason. Source: book, pinterest card.
- Where to aggregate: at the collector (lossy but cheap), at ingestion (streaming), or at query (accurate but slow). Source: book summary.
- Accuracy is not the goal: Prometheus warns against billing use. Source: Prometheus.
- Retention cost: downsample and expire; hot in memory for 24 h (Goku), then disk, then cold. Source: book, pinterest card.
- Alert fatigue: grouping, inhibition and silencing in Alertmanager. Source: Prometheus.
- Consumer lag needs rate-based alerts, not thresholds (Burrow). Source: linkedin card.
- Standalone monitoring: Prometheus servers avoid distributed dependencies so they survive infrastructure failures. Source: Prometheus.

## Unknowns
- Book's exact choice between pull and push for the final design (leans pull)
- Cardinality limits and label governance
- Alert manager high availability (Alertmanager clustering exists; not in sources)

## Candidates
- New kinds: none; sightings: timeseries-database (2nd, now qualifies), monitoring (18th, as the whole system), service-registry (7th), stream (20th), stream-processor (11th), scheduled-job (12th), notification-service (7th), webhook-endpoint (3rd), object-store cold tier (22nd)
- New properties on existing kinds: timeseries-database.tiers (hot, warm, cold), retentionRawDays, downsampleIntervals, compression (gorilla), labelIndex (boolean); worker.mode (pull, push) for collectors; monitoring.alertGrouping, inhibition, silencing (booleans); notification-service.channels (2nd sighting)
- New edge properties: scrapeIntervalSeconds; aggregationPoint (collector, ingestion, query)
- New requirement paths: observability.retentionDays; observability.alertingIndependent (boolean); observability.maxCardinality
- New rules:
  - monitoring-dependent-on-monitored-system: monitoring nodes with sync edges into the datastores or queues they monitor while observability.alertingIndependent true
  - collector-writes-tsdb-directly-without-buffer: collector edge to timeseries-database with no stream buffer at high rps (loss on TSDB outage)
  - tsdb-without-downsampling-under-retention: timeseries-database retentionRawDays equals total retention with no downsample jobs while retentionDays large
  - alerts-without-notification-fallback: alert manager with a single notification channel edge (no pager or secondary)
  - push-collectors-without-coordination: push-mode collectors with many agents and no coordination or load balancing (overload)

## Verification 2026-09-14

| URL | Reachable | Outcome |
|---|---|---|
| https://prometheus.io/docs/introduction/overview/ | yes | Confirms the Prometheus server, client libraries, push gateway for short-lived jobs, service discovery, exporters, Alertmanager and Grafana/PromQL. Confirms "no reliance on distributed storage; single server nodes are autonomous", "time series collection happens via a pull model over HTTP" with "pushing time series via an intermediary gateway", and "If you need 100% accuracy, such as for per-request billing, Prometheus is not a good choice". |
| https://blog.bytebytego.com/p/metric-monitoring | yes | Confirms metrics source, metrics collector, time-series database with label-based indexing, Kafka as the decoupling layer between collection and processing, "Consumers or streaming processing services such as Apache Storm, Flink and Spark", the query service, the visualization system and the alerting system. The public excerpt carries none of the numbers and none of the alert-manager / alert-store / alert-Kafka detail. |
| https://raymondjones.dev/en/system-design-notes/5-metrics-monitoring-and-alerting-system/ | yes | Confirms 1,000 server pools x 100 machines x 100 metrics = 10M metrics/sec; retention raw 7 days, 1-minute 30 days, 1-hour 1 year; etcd or ZooKeeper service discovery; push gateway; Kafka; Flink/Storm/Spark; cold storage; downsampling; query service with cache; Grafana; alert manager; Cassandra alert store; alert Kafka; notification consumers to email, PagerDuty and webhooks. |

Not confirmed, therefore not encoded:

- The DAU figure. The card says 100M; the notes page says approximately 1 billion. The two disagree and the format has no field for it.
- Goku's 24 h in-memory tier with 12x compression, and Nanotube's "tens of millions metric data points per second". Both come from the pinterest-feed and booking-search cross-reference cards, which were not re-fetched; neither number is encoded.
- Alertmanager inhibition and silencing. The fetched overview names Alertmanager but does not state them; the design encodes only what the `alertmanager` component documents (dedup key, group wait, repeat interval).
