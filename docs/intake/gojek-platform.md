# Intake: Gojek super-app platform (allocation, Courier, Kafka event platform, GoPay)

## Source
- Primary: https://blog.gojek.io/data-infrastructure-at-go-jek/ (Ravi Suhag, Data Engineering team, Gojek engineering blog, 2018) — the platform-wide data architecture: producers, fronting servers, Kafka data streams, Firehose, Dagger, cold storage, Odin, Loki
- Primary: https://blog.gojek.io/scaling-our-geo-search-service-for-10x-load/ (Prathik Rajendran M, Gojek engineering blog, 2022) — Available Driver Service, the geo-search tier that feeds allocation
- Primary: https://blog.gojek.io/when-kafka-went-offshore/ (Anmol Vijaywargiya, Engineering Platform team, Gojek engineering blog, 2021) — the multi-week Kafka incident, leader election, consumer configuration
- Primary: https://blog.gojek.io/enhancing-ziggurat-the-backbone-of-gojeks-kafka-ecosystem/ (Prateek Khatri, Ziggurat team, Gojek engineering blog, 2021) — Ziggurat, RabbitMQ retry path, 250+ services
- Primary: https://blog.gojek.io/fronting-an-armoured-car-for-kafka-ingestion/ (Prakhar Mathur, Gojek engineering blog, 2018) — fronting REST, fronting Kafka, Redis failover, fronting worker
- Primary: https://blog.gojek.io/the-quest-for-a-message-broker-for-our-courier/ (Ajat Prabha, Courier team, Gojek engineering blog, 2021) — VerneMQ cluster, GCLB, HAProxy, webhook to Kafka to Firehose
- Primary: https://blog.gojek.io/introducing-courier-the-information-superhighway-between-mobile-server/ (Anubhav Gupta, Courier team, Gojek engineering blog, 2021) — MQTT push replacing polling for merchant order delivery
- Primary: https://blog.gojek.io/acing-1-million-concurrent-mqtt-connections/ (Dhruv Jain, Gojek engineering blog, 2022) — Courier load testing to 1M concurrent connections, HAProxy and VerneMQ limits
- Primary: https://blog.gojek.io/how-gojek-manages-1-million-drivers-with-12-engineers-part-1/ and https://blog.gojek.io/how-gojek-manages-1-million-drivers-with-12-engineers-part-2-2/ (Adithya Venkatesan, Gojek engineering blog, 2018) — the Allocations team, broadcast-algorithm failure, Go to Clojure rewrite
- Primary: https://blog.gojek.io/how-go-jek-handles-microservices-communication-at-scale/ (Soham Kamani, Gojek engineering blog, 2018) — Heimdall retries, circuit breaking, bulkheads
- Primary: https://blog.gojek.io/how-to-build-resilience-in-large-scale-distributed-systems/ (Rajeev Bharshetty, Gojek engineering blog, 2018) — rate limiting, bulkheads, queueing, canaries
- Primary: https://blog.gojek.io/protecting-indonesias-largest-digital-payments-app/ (Ujjawal Dixit, GoPay, Gojek engineering blog, 2021) — Fraud Rules Service on Clojure, gRPC and Redis ZSET
- Primary: https://blog.gojek.io/database-optimisation-on-cassandra/ (Deepshi Garg, Gojek engineering blog, 2019) — booking history from Postgres to Cassandra
- Primary: https://blog.gojek.io/daggers-data-aggregation-in-real-time/ (Gaurav Singhania, Gojek engineering blog, 2018) — Dagger on Flink, Datlantis, sinks
- Primary: https://blog.gojek.io/atlas-go-jeks-real-time-geospatial-visualization-platform/ (Ravi Suhag, Gojek engineering blog, 2018) — Atlas, Enigma, Cosmos, metric streaming
- Primary: https://blog.gojek.io/sakaar-taking-kafka-data-to-cloud-storage-at-go-jek/ (Sumanth Nakshatrithaya, Gojek engineering blog, 2018) — Kafka to parquet archival with at-least-once
- Primary: https://blog.gojek.io/service-networking-in-a-hybrid-infrastructure/ (Praveen Shukla, Gojek engineering blog, 2018) and https://blog.gojek.io/gana-a-solution-to-keep-up-with-scale/ (Jenson CS, 2019) — GKE/GCE hybrid, ingress, namespaces, 500+ microservices
- Primary: https://blog.gojek.io/reducing-latency-with-sidecar/ (Muhammad Abduh, 2019) and https://blog.gojek.io/the-need-for-speed-how-we-reduced-service-latency-by-98/ (Rajendra Rusmana, 2019) — Litmus sidecar, Consul, BadgerDB, gRPC
- Primary: https://blog.gojek.io/how-we-built-barito-to-enhance-logging/ (Tara Baskara, 2018) and https://blog.gojek.io/how-we-monitor-application-performance-at-go-jek/ (Mudit Maheshwari, 2018) — Barito logging pipeline, StatsD/Telegraf/InfluxDB/Grafana
- Primary: https://github.com/gojek/ziggurat/blob/master/README.md (official Gojek open-source repository) — Ziggurat handler contract, RabbitMQ retry queues, dead-letter queue
- Secondary: https://blog.gojek.io/our-learnings-from-istios-networking-apis-while-running-it-in-production/ (2020) and https://blog.gojek.io/detecting-fraudsters-in-near-real-time-with-clickhouse/ (2022), both first-party but used only for single facts
- Fetch note: `www.gojek.io/blog/*` returns 429 behind a Vercel bot checkpoint and `medium.com/gojekengineering` returns 403; every post above was read in full from the Internet Archive raw snapshot of `blog.gojek.io`, Gojek's own engineering blog. Full log in `work/research/gojek-platform/verify.md`.
- Verified by: official Gojek engineering blog (blog.gojek.io), 17 posts by named Gojek engineers, plus the gojek/ziggurat open-source README
- Confidence: high
- Date of source: 2018–2022 (platform posts 2018–2019; Courier, Ziggurat, GoPay FRS and geo-search 2021–2022)

## System in three lines
Gojek is Indonesia's super-app: ride-hailing (GoRide), food delivery (GoFood), logistics (GoSend) and the GoPay wallet, all on one platform of 500+ microservices across GCP, AWS and Gojek's own data centres. Every order runs through the same spine: a persistent MQTT channel to driver and merchant phones (Courier), a geo-search over driver locations (Available Driver Service), an allocation engine that picks the driver, and a Kafka event platform that every other service reads from. It is hard because driver location pings arrive continuously from a million drivers, an order must be matched and accepted in minutes, and a single Kafka or geo-search wobble stalls every product at once.

## Scale (only if stated)
- 1,000,000+ registered drivers on the platform (https://blog.gojek.io/how-gojek-manages-1-million-drivers-with-12-engineers-part-1/)
- 35+ orders each second across services; 100 million+ orders a month with 200+ engineers (https://blog.gojek.io/how-gojek-manages-1-million-drivers-with-12-engineers-part-2-2/)
- 300,000+ orders every day at the time of the 2015 crisis (same post)
- 100 million+ transactions a month processed by the booking-history store (https://blog.gojek.io/database-optimisation-on-cassandra/)
- GoFood alone: over 50 million transactions per month (https://blog.gojek.io/introducing-courier-the-information-superhighway-between-mobile-server/)
- More than 50% of Gojek's transactions happen through GoPay (https://blog.gojek.io/protecting-indonesias-largest-digital-payments-app/)
- 6 billion events daily through the data platform (https://blog.gojek.io/data-infrastructure-at-go-jek/)
- More than 10 data streams, "each handle more than a billions points each day" (same post)
- Dagger: 5+ billion messages per day for uptime tracking across 300+ microservices; 44,000 geo location points processed every minute for dynamic surge pricing (https://blog.gojek.io/daggers-data-aggregation-in-real-time/)
- Available Driver Service at peak: 600,000 writes per minute and 200,000 searches per minute (https://blog.gojek.io/scaling-our-geo-search-service-for-10x-load/)
- Courier target and achieved load test: 1,000,000 concurrent persistent MQTT connections, 4680 messages/sec publish rate, 1000 rps connect/disconnect (https://blog.gojek.io/acing-1-million-concurrent-mqtt-connections/)
- Ziggurat "is used by over 250 services"; the Engineering Platform team "powers 250+ applications" (https://blog.gojek.io/enhancing-ziggurat-the-backbone-of-gojeks-kafka-ecosystem/, https://blog.gojek.io/when-kafka-went-offshore/)
- 500+ microservices; 8000+ instances in the single legacy `gojek-production` Google project (https://blog.gojek.io/gana-a-solution-to-keep-up-with-scale/)
- Logging post states the scale as "120 millions API call per second" (https://blog.gojek.io/how-we-built-barito-to-enhance-logging/) — see Unknowns, this figure is not corroborated elsewhere in the sources
- Billions of GPS points flowing through the pipelines daily; ~700k active drivers and ~100M orders/month cited for early 2018 (https://blog.gojek.io/atlas-go-jeks-real-time-geospatial-visualization-platform/)

## Requirements stated or clearly implied
- Availability target: not expressed as a percentage. Stated structurally: data streams are "highly reliable multi-region, rack aware Kafka clusters" with a failover mirror cluster in progress; "Each team is allocated with highly available fronting clusters to avoid any single point failure"; VerneMQ deployed as a cluster because "Mosquitto has no native support for clustering… it still has a single point of failure".
- Consistency: explicitly eventual on the hot paths. Geo-search "needs to be a PA/EL system… during a network partition it favours availability and in normal situations it will favour latency over consistency"; booking history moved to Cassandra because "high availability was more preferred — we could afford eventual consistency"; the Litmus sidecar accepts "eventually consistent data".
- Latency target: Litmus sidecar target 5 ms, base p99 23.55 ms reduced to 6.91 ms; Heimdall default of "a maximum timeout of 1000ms per request"; geo-search nodes have a "p99.99 SLA to respond with the drivers in the given time limit".
- Ordering needs: per Kafka partition only. The sources discuss partition leadership and rebalancing, never global ordering.
- Replay or reprocessing needs: yes and explicit. A "Mirror stream is the mirror of its corresponding data stream with high data retention, purposed for data aggregation and data replays"; archival loss was previously repaired by "replay the data archival using Kafka's retention".
- Retention: "any data put into Kafka will be available for analysis (powered by Spark) with infinite retention in cloud storage with atleast once guarantee"; parquet files finalised per hour window or file-size limit; InfluxDB "configured… to keep data for a defined length of time"; GoPay ingestion rules carry "a data expiry time window threshold".
- Compliance / residency: not stated beyond "Data must be retained for business or compliance purposes on a long-term basis, if not indefinitely" and "our logs may contain sensitive information that we should really keep in-house". No PCI or GDPR claim in the sources.

## Boundaries
- Clouds and sites: Google Cloud Platform (primary; GKE and GCE), Amazon Web Services, and Gojek's own data centres. GCP regions named only incidentally (`asia-east1`).
- Namespaces: infrastructure is segregated into "namespaces", "a segregation on the basis of network isolation which can be managed independently. It's a Google project in case of GCP, a new organisation in case of AWS or a new VLAN for the datacenter." Named namespaces: GO-PAY, GO-POINTS, Data Engineering, BI, plus the legacy `gojek-production` project.
- Trust zones: mobile clients (untrusted) -> Google Cloud Load Balancer / HAProxy edge -> internal services; driver APIs and customer APIs are "physically separated on different clusters"; "each team can only have permission to access its own components/boxes".
- Kubernetes boundary: VMs and containers sit on different IP ranges, bridged by one internal load balancer plus an Nginx ingress controller doing host-based routing.
- Named subsystems: Allocations (formerly the bid engine), Available Driver Service (ADS), Courier, Ziggurat, Firehose, Dagger, Datlantis, Enigma, Cosmos, Atlas, Sakaar, Secor, Barito, Litmus, Heimdall, GANA, Odin, Olympus, Loki, GoPay Fraud Rules Service, and the legacy monolith "Stan Marsh".

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Customer / driver / merchant apps | Android and iOS clients; hold a persistent MQTT connection and publish location pings | in-house (Android, iOS, Flutter) | client | persistentConnection: mqtt; pings via RTC_WAKEUP alarms; location ping interval "in the gaps of a couple of seconds" |
| 2 | Google Cloud Load Balancer | Edge for mobile MQTT connections; injects ProxyProtocol into the TCP connection | Google Cloud Load Balancer | load-balancer | protocol: tcp; proxyProtocol: true |
| 3 | HAProxy | Load-balances MQTT connections as opaque TCP to the broker cluster; backends connect to it directly | HAProxy | load-balancer | hit port exhaustion at 113,000 connections and a maxconn ceiling at ~710,000 |
| 4 | VerneMQ brokers (Courier) | Clustered MQTT broker holding the long-lived mobile connections | VerneMQ (Erlang) | realtime-gateway | clustered; QoS 0/1/2; 4 listeners after tuning; tested to 1M concurrent connections, 300K clients in production-shaped tests |
| 5 | WebHook server | Receives VerneMQ plugin events (connect, publish, ACK) and puts them on Kafka | in-house | app-server | sync or async relay; stateless |
| 6 | Nginx ingress controller | Host-based routing for all Kubernetes services behind one GCP internal load balancer | Nginx ingress controller (Helm chart) | api-gateway | one internal LB shared by all services; NodePort exposure; internal and external ingress variants |
| 7 | Allocations service (ex "bid engine") | Assigns a driver to every order across all products; surge, incentives, driver health | in-house | app-server | language: Clojure (rewritten from Go, which was rewritten from Java); 1-1 personalised assignment replacing broadcast |
| 8 | Available Driver Service (ADS) | Geo-search: "Given a location and constraints, who are all the drivers near the location that satisfy the constraints?" | in-house | app-server | scatter-gather: one search split into smaller geo queries fired in parallel; best-effort with a response timeout; PA/EL |
| 9 | Redis Cluster (driver location index) | Primary persistence for driver locations and geo queries | Redis Cluster | cache | multi-master multi-replica, one shard per master; durability not required; Lua EVAL/EVAL_RO filtering on replicas; shards mix peak and low-traffic regions to avoid hot shards |
| 10 | Booking history store | Serves completed and cancelled bookings for customers and drivers over a two-month window | Apache Cassandra (migrated from PostgreSQL) | nosql-database | write-optimised, eventual consistency, read latency traded away; keyed by customer_id / driver_id to booking_details |
| 11 | Transactional service databases | Relational store behind services before the Cassandra and Redis moves | PostgreSQL | sql-database | ADS on Postgres "was not scaling due to the high write load… led to re-indexing on every update of the location" |
| 12 | Booking termination flow | Async completion of a booking: debit customer, credit driver, release driver, mark state, record history, award points | in-house, queue-backed | worker | asynchronous; retried after failure; decouples the booking flow |
| 13 | Fronting REST server | RESTful ingestion endpoint that hides Kafka from producing teams; accepts single or batched events | in-house | app-server | acknowledges ingestion; falls back to Redis when fronting Kafka is unreachable |
| 14 | Fronting Kafka | Per-team buffer cluster in front of the central Kafka, so main-Kafka loss becomes consumer lag not data loss | Apache Kafka | stream | brokers and Zookeeper in separate LXC containers on one VM "to avoid syncing issues of brokers due to network latency" |
| 15 | Fronting Redis + Fronting Failover | Holds events the fronting REST could not publish; a Java app drains them once fronting Kafka is back | Redis; in-house Java app | cache | fallback buffer; continuous poll for failed events |
| 16 | Fronting Worker | Consumes fronting Kafka and pushes to the target Kafka cluster; a second worker can mirror to a backup Kafka | in-house | worker | target cluster switchable by configuration without restarting producers |
| 17 | Data streams (central Kafka) | The event backbone; named streams such as Locstream (driver location), Logstream (API logs), Tagstream (segmentation) | Apache Kafka + Zookeeper | stream | "highly reliable multi-region, rack aware Kafka clusters"; 10+ streams, each 1B+ points/day; plus a high-retention mirror stream for replay and a perf stream that is "an exact copy… for chaos engineering and load testing" |
| 18 | Ziggurat consumer apps | Framework every Kafka consumer service is built on; Streams API for stateful work, Consumer API for bulk | Ziggurat (Clojure, open source), Kafka Streams 2.8 | stream-processor | 250+ services; modes (consumer, Jetty HTTP server, RabbitMQ workers); incremental co-operative rebalancing; protobuf deserialisation middleware |
| 19 | RabbitMQ retry and dead-letter queues | Where Ziggurat sends failed messages for async retry, then to a dead-letter queue | RabbitMQ (clustered) | queue | infinite reconnect from the producer side; DLQ after retries exhausted; consumption blocks until the message is handed to RabbitMQ |
| 20 | Firehose | Generic sink service: consumes raw or aggregated data and delivers it to a destination | Firehose (in-house, open source) | worker | "more than 5 sink modes including HTTP, Influx, Postgres, Log"; deployable on VMs or Kubernetes; stateless |
| 21 | Dagger | Real-time streaming aggregation and analytics, SQL over streams | Apache Flink (SQL via Apache Calcite) on Apache YARN | stream-processor | dedicated cluster per team, 10+ clusters; windowed aggregation; sinks to InfluxDB and Kafka |
| 22 | Sakaar / Secor archival | Pulls every Kafka topic into cloud storage as parquet for infinite retention | Sakaar (in-house), Secor; Google Cloud Storage | worker | at-least-once by "commit back to Kafka only after messages have been uploaded to storage"; stateless, purges files from the previous run; hourly partitions by default; 4-stage blocking-queue pipeline |
| 23 | Cold storage + query | Long-term parquet lake queried interactively | Google Cloud Storage; Apache Spark; Apache Zeppelin | object-store (+ big-data-cluster for Spark) | parquet format; infinite retention |
| 24 | Time-series store and metrics pipeline | Stores Dagger metric output and service metrics; the basis of dashboards and alerts | StatsD, Telegraf, InfluxDB, Grafana, Prometheus, TICK stack, Datadog, PagerDuty | timeseries-database (+ monitoring) | retention policy configured to expire old points; counters, timers, gauges, sets |
| 25 | Enigma + Cosmos + Atlas | Metric query engine, layer/metric configuration service, and the geospatial visualisation front end | in-house | app-server (Enigma, Cosmos), client (Atlas) | Enigma-to-Cosmos polling frequency is set by the Dagger aggregation window; Cosmos streams to Atlas over websockets |
| 26 | Barito logging pipeline | Centralised logs: fluentd agent -> Barito Router -> Kafka -> consumer -> Elasticsearch -> Kibana | fluentd, Kafka, Elasticsearch, Kibana, Consul, LXC | search-index (+ stream, app-server) | per application-group cluster provisioned on request; agent embeds an application secret; Consul for in-cluster discovery |
| 27 | GoPay Fraud Rules Service (FRS) | Rule engine scoring payment events: velocity rules, simple clauses, allow-list and deny-list | in-house, Clojure, gRPC | policy-engine | Redis ZSET history store; per-rule data expiry window; reads (query) and writes (ingestion) segregated; JQ dot-notation field extraction |
| 28 | Litmus + Litmus sidecar | Experimentation platform; a Go sidecar co-located with each calling service | in-house (server Clojure, sidecar Go), BadgerDB, caffeine cache | feature-flag-service | sidecar pulls its slice of data periodically and persists to BadgerDB; eventually consistent; gRPC; in-memory cache cut DB calls from ~2000 qps to ~10 qps |
| 29 | Consul | Service discovery and key-value configuration, including for sidecars; health checks with hot reload | HashiCorp Consul | coordination-service | KV hot reload without restarting clients; health checks |
| 30 | Google Maps rate-limiting proxy | All calls to Google Maps go through a proxy that throttles to stay inside the purchased quota | in-house proxy; Google Maps API | rate-limiter (+ third-party-api for Maps) | leaky bucket; 429 returned when over threshold; protects the external quota |
| 31 | SMS providers and FCM | Multi-provider SMS delivery with failover; FCM high-priority push as the Courier reconnect fallback | multiple SMS providers (unnamed); Firebase Cloud Messaging | notification-service (+ third-party-api) | queue-backed; "We retry SMS with a different provider when our primary provider fails to meet a certain SLA"; FCM sent if no MQTT ACK within N seconds |
| 32 | Kubernetes platform | GKE clusters plus GCE VMs running the 500+ microservices | Google Kubernetes Engine, Google Compute Engine, Helm, Istio/Envoy | container-orchestrator (+ service-mesh) | hybrid VM/container estate; Istio VirtualService, DestinationRule and ServiceEntry used in production |
| 33 | Heimdall | Resilient HTTP client embedded in Go services: retries, circuit breaker, timeouts, bulkheads | Heimdall (in-house, open source) | not an architecture node — edge properties | defaults quoted: 1000 ms timeout, 30 max concurrent requests, 20% error rate threshold, 1500 ms sleep window, 500 ms between retries, 4 retries |
| 34 | Odin / Olympus / GANA / Loki | Infrastructure automation (Terraform, Ansible/Chef), self-service provisioning, IP address management, chaos injection | in-house; Terraform; Ansible; Chef | ops tooling, not architecture nodes | Odin "reduce[d] provisioning time by 99%"; Loki "can randomly terminate virtual machine instances and containers"; GANA allocates non-overlapping subnets per namespace |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| mobile app | google-cloud-load-balancer | mqtt over tcp | async (persistent) | QoS 1/2 per MQTT | ProxyProtocol injected at the LB |
| google-cloud-load-balancer | haproxy | tcp | async | — | opaque TCP pass-through |
| haproxy | vernemq | mqtt over tcp | async | — | broker decodes ProxyProtocol before any other logic |
| backend service | haproxy | mqtt | async | — | backends connect directly to HAProxy, not via the GCLB |
| vernemq | webhook-server | http webhook | sync or async | not stated | plugin relays connect/publish/ACK events |
| webhook-server | data-streams (kafka) | kafka | async | not stated | ACK events land on Kafka |
| data-streams (kafka) | firehose | kafka | async | at-least-once | Firehose informs the backend that a message was ACKed |
| backend service | mobile app | mqtt publish via vernemq | async | QoS 1/2 | order pushed instead of polled; merchant has 3 minutes to accept |
| backend service | fcm | https | async | best effort | high-priority push sent when no ACK arrives within N seconds; phone takes a wake lock and reconnects |
| driver app | available-driver-service | not stated | async | — | location pings every couple of seconds |
| allocations-service | available-driver-service | not stated | sync | — | "if the system goes down, we cannot allocate a driver to an order as we don't have a candidate set of drivers" |
| available-driver-service | redis-cluster (masters) | redis | sync | — | writes of driver locations, 600k/min at peak |
| available-driver-service | redis-cluster (replicas) | redis EVAL_RO / EVALSHA_RO | sync | best effort | one search fanned out to several replicas in parallel; partial results returned when a node misses the timeout |
| service | heimdall-wrapped downstream service | http | sync | — | retries, circuit breaker, per-backend max concurrent requests (bulkhead) |
| service | google-maps-proxy | http | sync | — | throttled to the purchased QPS quota |
| google-maps-proxy | google-maps-api | https | sync | — | requests outside the limit are throttled, 429 returned |
| booking service | booking-termination-queue | not stated | async | retried | debit, credit, driver release, state, history, points all done off the request path |
| booking-termination-worker | gopay / driver / booking services | not stated | async | retried | retry once the failure is rectified |
| sms-worker | sms provider | not stated | async | at-least-once with provider failover | message removed from the queue only on successful send |
| producer service | fronting-rest | http (REST, single or batch) | sync | acknowledged | abstracts Kafka away from producing teams |
| fronting-rest | fronting-kafka | kafka | async | at-least-once | primary path |
| fronting-rest | fronting-redis | redis | async | buffered | fallback when fronting Kafka is unreachable |
| fronting-failover | fronting-kafka | kafka | async | at-least-once | drains Redis once the broker is healthy |
| fronting-kafka | fronting-worker | kafka | async | at-least-once | lag grows instead of data being lost when the main Kafka is down |
| fronting-worker | data-streams (kafka) | kafka | async | at-least-once | a second worker can mirror to a backup Kafka cluster |
| instrumented service | data-streams (kafka) | protobuf over the stream producer library | async | at-least-once | schema evolution without breaking consumers |
| machine stats daemon | data-streams (kafka) | udp / tcp | async | best effort | API logs, container logs, counters and timers |
| data-streams | mirror-stream | kafka mirror | async | at-least-once | higher retention, used for aggregation and replay |
| data-streams | perf-stream | kafka copy | async | — | "exact copy of data stream for chaos engineering and load testing" |
| data-streams | ziggurat consumer app | kafka | async | at-least-once | Streams API or Consumer API; bulk consumption batches ElasticSearch calls |
| ziggurat consumer app | rabbitmq retry queue | amqp | async | retried, infinite reconnect | consumption of the next message blocks until this one is handed over |
| rabbitmq retry queue | rabbitmq dead-letter queue | amqp | async | — | after retries are exhausted |
| ziggurat consumer app | elasticsearch | http | sync | — | one call per batch after the bulk-consumption change, previously one per message |
| data-streams | dagger (flink) | kafka | async | at-least-once | windowed SQL aggregation, protobuf schemas |
| dagger | influxdb | influx line protocol | async | — | metric sink |
| dagger | data-streams (kafka) | kafka | async | at-least-once | application sink for downstream services |
| data-streams | sakaar / secor | kafka | async | at-least-once | offsets committed only after the parquet file is uploaded |
| sakaar / secor | google-cloud-storage | gcs | async | at-least-once | parquet, hourly partitions or file-size limit |
| google-cloud-storage | spark / zeppelin | spark | sync (interactive) | — | interactive analytics over cold storage |
| influxdb | enigma | http | sync | — | metric query engine |
| enigma | cosmos | http long polling | async | — | poll frequency set by the Dagger aggregation window |
| cosmos | atlas client | websocket | async | — | clients subscribe to metrics; Cosmos tracks subscribers and channels |
| service | fluentd agent | local | async | — | agent embeds the application secret into the log line |
| fluentd agent | barito-router | http | async | — | router forwards to the right cluster after checking Barito Market |
| barito-router | barito kafka | kafka | async | — | per application-group topic |
| barito consumer | elasticsearch | http | sync | — | index creation plus writes; Kibana reads |
| service | telegraf (statsd) | statsd over udp | async | best effort | flushed periodically to InfluxDB |
| payment event producer | gopay-frs | grpc | sync | — | rule evaluation returns allowed or rejected |
| gopay-frs | redis (zset history) | redis | sync | — | ingestion rules write with an expiry window; query rules read only |
| backend service | litmus-sidecar (localhost) | grpc | sync | — | no network hop; p99 6.91 ms |
| litmus-sidecar | litmus-server | not stated | async (periodic pull) | eventually consistent | only the slice the client needs; persisted in BadgerDB |
| litmus-sidecar | consul | http | sync | — | service registration, health check, KV config with hot reload |
| vm-based service | nginx-ingress (via internal LB) | http | sync | — | host-based routing; bridges the VM IP range to the Kubernetes overlay |
| nginx-ingress | kubernetes service | http | sync | — | endpoints watched from the Ingress resource |

## Failure modes, incidents, tradeoffs the source discusses
- **Kafka brokers killed by cloud live migration (Feb 2021, two weeks).** "During mid-February 2021, numerous product teams reported untimely failures on producers and lag on consumers. This nightmare went on for two weeks." Root cause: "Live migration was observed to have caused network failures on the broker which results in communication failure between the controller and the broker. This leads to the broker getting kicked out of the cluster." Consequence: "If this broker has a very high throughput, the preferred election leads to a delay in recovery and can cause the partition to be leaderless for several minutes." Fixes: raise `default.api.timeout.ms` above the cluster stabilisation time, and change the VM policy "from migrateOnHostMaintenance to terminateOnHostMaintenance" with automatic restart, because "Shutdown and restart would mean a faster preferred-election." Closing lesson: "the default configuration which Kafka provides isn't always good enough to run production systems at scale." (https://blog.gojek.io/when-kafka-went-offshore/)
- **Broadcast allocation was the original scaling failure.** "The algorithm 'broadcasted' the same order across its driver database… each driver would see the order, but not necessarily be able to fulfil it," producing "a three-fold problem to the algorithm: Accountability, High-concurrency and promoting Unhealthy competition," and "Who gets the order became a function of the phone — better GPS, hardware, Internet, software." Replaced by 1-1 personalised allocation. (https://blog.gojek.io/how-gojek-manages-1-million-drivers-with-12-engineers-part-2-2/)
- **Language rewrites traded performance for changeability.** "While Go is superior in performance, the capability to make changes and add features was hard. Language was traded for design." The opposite trade was made for the Litmus sidecar, rewritten from Clojure to Go for latency. (same post; https://blog.gojek.io/the-need-for-speed-how-we-reduced-service-latency-by-98/)
- **Geo-search thundering herd took the platform down for an hour.** "we also faced a thundering herd issue during peak load because the system dependent on ADS does a retry every 15 seconds which took the entire system down for approximately an hour." Prior failures: Postgres "led to re-indexing on every update of the location", then Redis capped at "around ten thousand requests per minute". (https://blog.gojek.io/scaling-our-geo-search-service-for-10x-load/)
- **Deliberate partial results.** "we don't wait for all the nodes to respond back all the time, we have a set timeout for the query to execute and when that time limit is reached we respond back with all the drivers that have been fetched so far and don't wait on any slow nodes." Justified by "if we serve a driver with a slightly older ping it's not a concern because location doesn't drastically change." (same post)
- **Hot shards designed away.** "we ensure that shards are done in such a way that the peak load regions and low traffic regions are mixed together." (same post)
- **Redis replica misuse.** Lua `EVAL` is not a read-only command, so "the EVAL commands were being sent to Redis master"; Gojek proposed `EVAL_RO`/`EVALSHA_RO` upstream and patched go-redis. (same post)
- **Silent message loss from a 500 ms reconnect budget.** "the Ziggurat code tried to connect to RabbitMQ only 5 times till a max of only 500 ms… 500 ms might cover minor network glitches but certainly not VM restarts or process shutdowns which can run into minutes." Fix: retry forever and block consumption, so "in the worst case the Kafka lag rises till the RabbitMQ server is back up. But, most importantly, the user doesn't lose messages." Also: single-node RabbitMQ was "a single point of failure", replaced by a cluster. (https://blog.gojek.io/enhancing-ziggurat-the-backbone-of-gojeks-kafka-ecosystem/)
- **Stop-the-world rebalancing made every deploy noisy.** "As the consumers are stopped and started (for deployment) one by one… Kafka pauses all the activity to do a re-distribution of resources… in Gojek the high Kafka lag causes the alerts to trigger every time during a deployment." Fixed by incremental co-operative rebalancing from Kafka 2.4. (same post)
- **One call per message to Elasticsearch.** "GoFood's Kafka consumer app used to make one call to ElasticSearch for every Kafka message read, i.e. O(n) calls"; fixed by bulk consumption via the Consumer API. (same post)
- **Ingestion buffer as a blast shield.** "let's say in some scenarios, our main Kafka goes down, then there won't be any data loss, only the fronting worker consumer lag will keep increasing till the recovery of the main Kafka." (https://blog.gojek.io/fronting-an-armoured-car-for-kafka-ingestion/)
- **Archival: choosing at-least-once over graceful shutdown.** "can we achieve at least once guarantee without having to engineer a graceful shutdown?… If instead, we relied on a graceful shutdown, a sig-kill would kill our guarantee." Result: "commit back to Kafka only after messages have been uploaded to storage", and duplicates are the caller's problem — "If the messages are transactional in nature its highly recommended to have a dedicated idempotency key in the message." (https://blog.gojek.io/sakaar-taking-kafka-data-to-cloud-storage-at-go-jek/)
- **Bulkheads as a stated principle.** "We have driver and customer API's physically separated on different clusters… prevents failures in customer APIs causing problems on the driver side," plus per-backend connection pools so "at most 10 connections can hang when 'C' has a slowdown/failure." Closing line: "The more coupled your services are, the more they are together in failures." (https://blog.gojek.io/how-to-build-resilience-in-large-scale-distributed-systems/)
- **Cascade shape named explicitly.** "when a downstream service slows down, it also slows down other services that depend on it"; "we see services making too many requests under heavy load. Unless these requests are limited, they can cause the called services to slow down or go down." (https://blog.gojek.io/how-go-jek-handles-microservices-communication-at-scale/)
- **Polling was killing the merchant experience.** "Polling is a data and battery-intensive operation… Frequent polling in the background causes the OS to kill the app to save battery… Push notifications are unreliable as there is no guarantee of delivery. SMS is expensive." Increasing the polling frequency made it worse: "a delayed poll results in merchants losing orders." (https://blog.gojek.io/introducing-courier-the-information-superhighway-between-mobile-server/)
- **Connection ceilings found by load testing, not by incident.** Port exhaustion on the worker VMs (28,232 free outgoing ports), `EMFILE` from open-file limits, then "At 113000 connections, we again faced port exhaustion issue but this time it was on HA proxy", a VerneMQ listener ceiling at ~362,000, and an HAProxy `maxconn` ceiling at ~710,000. (https://blog.gojek.io/acing-1-million-concurrent-mqtt-connections/)
- **Cloud quota as an architecture constraint.** "There is a limit of 50 per GCP project and we have 500+ microservices," which ruled out one internal load balancer per service and forced a shared ingress. Adding routes to a cluster node was rejected because "Let's say the Kubernetes cluster nodes go down. The route which added to a specific host is no more available." (https://blog.gojek.io/service-networking-in-a-hybrid-infrastructure/)
- **One flat cloud project did not survive growth.** "8000+ instances in a single Google project… Managing such a big project became very difficult," then IP-range clashes between VPCs, Kubernetes ranges and VPN tunnels once the estate was split; a Google Sheet of subnets "was not scaling anymore" at 300x the request volume, so GANA was built. (https://blog.gojek.io/gana-a-solution-to-keep-up-with-scale/)
- **Per-team ELK did not scale.** "the conventional ELK stack (without sharding) we used did not scale for the quantity of logs… some of the teams grow too fast and the ELK became inadequate"; also "Most times we can't rely on our ELK cluster during a production issue." (https://blog.gojek.io/how-we-built-barito-to-enhance-logging/)
- **Latency hides in logging and in disk.** The Litmus sidecar's own BadgerDB reads and its synchronous stdout logging were the two dominant costs; the fix was an in-process cache plus non-blocking ring-buffered log writes that may drop messages under pressure. (https://blog.gojek.io/the-need-for-speed-how-we-reduced-service-latency-by-98/)
- **Cache deliberately placed in-process, not in Redis.** "we obviously could not use an external cache like Redis or Memcached. If we used those, we would be adding an additional call." (https://blog.gojek.io/reducing-latency-with-sidecar/)
- **Chaos engineering is built in.** "Loki can randomly terminate virtual machine instances and containers, exposing engineers to failures more frequently and incentivise them to build resilient services," and a whole `perf stream` exists as a production-shaped copy for it. (https://blog.gojek.io/data-infrastructure-at-go-jek/)
- **Legacy is not fully retired.** "10% of Stan Marsh survives. Even till date." (https://blog.gojek.io/how-gojek-manages-1-million-drivers-with-12-engineers-part-2-2/)

## Unknowns
- No availability SLO, error budget, or uptime percentage is published for any component.
- Region and zone topology is never enumerated. "Multi-region, rack aware Kafka clusters" is asserted, but the regions are not named and the failover mirror cluster is described as in progress, not done.
- Partition counts, replication factors and retention windows for the central Kafka clusters are not given (only that the mirror stream has "high data retention").
- The sharding key for the Redis geo cluster is not stated beyond "shards are done in such a way that the peak load regions and low traffic regions are mixed together"; whether it is S2 cell based is not said, though S2 IDs appear elsewhere in the sources.
- The allocation algorithm itself (scoring, surge, driver-health weighting) is described only by name; no formulation is published.
- End-to-end order latency budget is never stated. Only component-level numbers exist (Litmus 5 ms target, Heimdall 1000 ms default timeout, geo-search p99.99 with an unnamed limit).
- GoPay's core payment and ledger architecture is not covered by any fetched source; only the fraud rules engine in front of it is.
- The "120 millions API call per second" figure in the Barito post is not corroborated by any other source and is not defined (internal versus external calls). Treat as unverified.
- Whether Istio/Envoy replaced Consul and Heimdall for service-to-service traffic, or runs alongside them, is not stated — the Istio post is about networking APIs only, and the Consul and Heimdall posts are older.
- Cassandra replication factor, consistency level and compaction strategy are not stated.
- Current state of the platform after the GoTo merger (2021) is outside every fetched source.

## Candidates
- New kinds: none required. Every box maps to an existing kind. Closest gaps: the MQTT broker maps to `realtime-gateway` but the sources stress broker semantics (QoS, retained sessions, webhook plugins) rather than gateway semantics; a `message-broker` or `mqtt-broker` kind would be a cleaner fit if a second sighting appears.
- New properties on existing kinds:
  - `stream.role` (primary, mirror, perf-copy, fronting-buffer) — Gojek runs four distinct copies of the same event stream for four different reasons
  - `stream.rackAware` (boolean) and `stream.leaderElection` (automatic, preferred) — the incident turns on both
  - `cache.evalOnReplica` / `cache.readReplicaRouting` (boolean) — the EVAL_RO problem
  - `cache.shardMixesHotAndCold` (boolean) — the anti-hot-shard placement rule
  - `app-server.fanoutQuery` (boolean) and `app-server.partialResultsAllowed` (boolean) — best-effort scatter-gather
  - `app-server.sidecar` (none, colocated) — the Litmus pattern
  - `queue.retryQueue` / `queue.deadLetterQueue` (boolean) and `queue.reconnectRetries` (integer or infinite)
  - `realtime-gateway.protocol` (websocket, mqtt, grpc-stream), `.qos` (0,1,2), `.maxConnections` (integer)
  - `worker.commitAfterSink` (boolean) — the at-least-once archival pattern
  - `load-balancer.proxyProtocol` (boolean), `.maxConnections` (integer)
  - `container-orchestrator.internalLoadBalancerQuota` (integer) — the 50-per-project constraint
- New edge properties: `bulkheadPool` (string, the named connection pool), `maxConcurrentRequests` (integer), `sleepWindowMs` (integer), `partialResults` (boolean), `fallbackTransport` (e.g. mqtt -> fcm push)
- New requirement paths:
  - `consistency.pacelc` (pa-el, pa-ec, pc-el, pc-ec) — the geo-search post reasons in exactly these terms
  - `messaging.replayStream` (boolean) — the mirror stream requirement
  - `messaging.idempotencyKeyRequired` (boolean) — the at-least-once contract Sakaar pushes onto producers
  - `resilience.chaosTestingTarget` (boolean) — the perf stream and Loki
- New rules (name + one-line condition):
  - `stream-without-replay-mirror`: a `stream` feeding a `stream-processor` or archival `worker` with no high-retention mirror and `messaging.replayStream` set
  - `at-least-once-sink-without-idempotency-key`: an async edge with delivery `at-least-once` into a store where no idempotency key is declared
  - `retry-without-backoff-into-shared-dependency`: two or more services retrying a single `app-server` on a fixed interval (the ADS thundering herd)
  - `fanout-query-without-timeout`: `app-server.fanoutQuery` true and no `timeoutMs` on the outgoing edges
  - `single-node-broker-in-critical-path`: a `queue` or `realtime-gateway` with no clustering on a path carrying a delivery guarantee
  - `shared-connection-pool-across-backends`: a service with two or more sync downstream edges and no `bulkheadPool` distinction
  - `cloud-quota-exceeded`: count of components requiring a per-project cloud resource exceeds a declared quota (the 50 internal load balancers)
  - `driver-and-customer-paths-colocated`: two edges of different trust or criticality classes terminating in the same compute group (the physical-separation bulkhead)
  - `live-migration-sensitive-stateful-service`: a stateful clustered component (Kafka, RabbitMQ, Redis) on VMs whose host-maintenance policy is live migration
