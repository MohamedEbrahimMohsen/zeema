# Intake: Zerodha Kite (India's largest retail broker — Go, Postgres, Redis, hybrid DC)

## Source
- Primary: https://zerodha.tech/blog/scaling-with-common-sense/ (Kailash Nadh, CTO, official Zerodha Tech Blog, 2020-06-14) — the cache-first architecture: everything on Kite served from a hot Redis cache, E-Tag/304, connection pooling, ticker concurrency
- Primary: https://zerodha.tech/blog/being-future-ready-with-common-sense/ (Kailash Nadh, CTO, official Zerodha Tech Blog, 2021-07-28) — Kite/Console/ticker/Kite Connect rewrite history, ticker streaming-transport evolution, Kafka as the central bus, the 40 ms latency baseline, self-hosting economics
- Primary: https://zerodha.tech/blog/working-with-postgresql/ (Zerodha engineering, official Zerodha Tech Blog, 2021-04-22) — Postgres sizing, four-node `postgres_fdw` sharding, ~20 TB, 40–50k QPS, monthly partitioning, the ephemeral hot-cache database, sql-jobber
- Primary: https://zerodha.tech/blog/infra-monitoring-at-zerodha/ (Karan Sharma, SRE, official Zerodha Tech Blog, 2020-04-27) — two physical data centres where exchange leased lines terminate, P2P leased lines to AWS VPCs, Prometheus 3 replicas, Alertmanager, VictoriaMetrics 56B data points
- Primary: https://zerodha.tech/blog/a-lesson-in-niche-business-dsls-at-scale/ (Zerodha engineering, official Zerodha Tech Blog, 2020-11-24) — Veto, the pre-validation reverse proxy in front of the OMS: govaluate DSL, Go plugins, compiler and validation servers, Frappe rules dashboard, evaluation benchmarks
- Primary: https://zerodha.tech/blog/logging-at-zerodha/ (Zerodha engineering, official Zerodha Tech Blog, 2023-03-23) — ELK to Vector + ClickHouse + Metabase, 30B log lines in 2.5 TB, per-level TTL, cluster cost per hour, Nomad clusters as log sources
- Primary: https://zerodha.tech/blog/1-5-million-pdfs-in-25-minutes/ (Zerodha engineering, official Zerodha Tech Blog, 2024-02-14) — the nightly contract-note pipeline: Tasqueue + Redis, Typst, OpenPDF signer, S3, Haraka SMTP, Nomad, ~40 c6a instances
- Primary: https://zerodha.tech/blog/hello-world/ (Zerodha engineering, official Zerodha Tech Blog, 2020-04-06) — full stack inventory, "hybrid infra", ~16M market ticks/sec, ~1M DAU, 7M+ trades/day, team size
- Primary: https://zerodha.tech/projects/ (official Zerodha OSS catalogue) — DungBeetle (ex sql-jobber), kaf-relay, listmonk, logchef, hedwig, torii, otpgateway, blobasaur, koanf, tasqueue
- Primary: https://kite.trade/docs/connect/v3/websocket/ and https://kite.trade/docs/connect/v3/orders/ and https://kite.trade/docs/connect/v3/postbacks/ (official Kite Connect v3 API documentation) — `wss://ws.kite.trade`, binary tick protocol and packet sizes, subscription limits, order placement varieties and the full order-status lifecycle, postback checksums
- Primary: https://zerodha.com/z-connect/general/todays-technical-issues-postmortem (Nithin Kamath, founder/CEO, official Z-Connect blog, 2019-02-27) — the 27 Feb 2019 OMS outage postmortem
- Secondary: https://www.cncf.io/case-studies/zerodha/ (CNCF case study quoting CTO Kailash Nadh directly) — 8M trades/day, 1M concurrent users, Kubernetes migration, NATS for market data, ECR/GitLab/Terraform, ≥50% compute cost reduction
- Verified by: official Zerodha Tech Blog (nine posts fetched in full, several authored by CTO Kailash Nadh) + official Kite Connect API documentation (three pages) + official Z-Connect incident postmortem by the founder + CNCF case study quoting the CTO
- Confidence: high
- Date of source: 2019–2024 (architecture 2020–2024; scale numbers 2020, 2021, 2024)

## System in three lines
Kite is the retail trading front end of Zerodha, India's largest stock broker: roughly 15–20% of all retail trading volume on Indian exchanges, ~1M concurrent users, and ~16 million market ticks a second fanned out over WebSocket. It is built and run almost entirely in-house by a ~30-person tech team — Go services reading from a hot Redis cache, self-managed Postgres, Kafka as the central bus, NATS for market data, on physical racks in two data centres (where exchange leased lines terminate) joined to AWS by point-to-point leased lines. It is hard because the load is a near-vertical spike at 09:15 every trading morning, the exchange-facing OMS is a third-party black box, and there is no acceptable degraded mode for an order that a customer believes is live.

## Scale (only if stated)
- Users / DAU: "~1 million daily active users" (https://zerodha.tech/blog/hello-world/); "way more than a million at any given moment" concurrent on Kite, 6M+ registered users (https://zerodha.tech/blog/being-future-ready-with-common-sense/); 1 million concurrent users (https://www.cncf.io/case-studies/zerodha/)
- Requests per second: "hundreds of thousands of requests per second during peak market hours" (https://zerodha.tech/blog/hello-world/)
- Market data: "~16 million market ticks per second to hundreds of thousands of concurrent users" (https://zerodha.tech/blog/hello-world/); "tens of millions of real time market data packets every second" (https://zerodha.tech/blog/being-future-ready-with-common-sense/)
- Trades: 7M+ trades/day in March 2020 and "more than 1 billion trades" in the financial year (https://zerodha.tech/blog/hello-world/); 12M+ daily trades by 2021 (https://zerodha.tech/blog/being-future-ready-with-common-sense/); 8M trades/day (https://www.cncf.io/case-studies/zerodha/)
- Market share: "15-20% of all daily retail trade and investment volumes across all Indian stock exchanges" (https://zerodha.tech/blog/hello-world/); "around 15% of daily retail trading volume" (https://zerodha.tech/blog/infra-monitoring-at-zerodha/)
- Postgres: ~20 TB across four sharded nodes, "hundreds of billions of rows", 40,000–50,000 QPS during peak trading hours; original pair was 32-core / 64 GB EC2 instances (https://zerodha.tech/blog/working-with-postgresql/)
- Hot-cache Postgres: "tens of millions of tables at the end of every day", dropped and recreated nightly (https://zerodha.tech/blog/working-with-postgresql/)
- Redis: trading-day data for millions of users, "hundreds of GBs", disk persistence disabled (https://zerodha.tech/blog/scaling-with-common-sense/)
- Metrics: 56 billion time-series data points in VictoriaMetrics, "tens of thousands of time series metrics" ingested every second (https://zerodha.tech/blog/infra-monitoring-at-zerodha/)
- Logs: 30 billion log lines in 2.5 TB of ClickHouse, down from 28 billion lines in ~13 TB of Elasticsearch (https://zerodha.tech/blog/logging-at-zerodha/)
- Contract notes: "1.5+ million PDFs" in "about 25 minutes" on ~40 c6a instances; S3 peaked at "approximately 1.61 million requests within a 5-minute span, averaging around 5.3k requests per second"; ~7 million ephemeral S3 objects per run (https://zerodha.tech/blog/1-5-million-pdfs-in-25-minutes/)
- Ticker client limits: 3,000 instruments per WebSocket connection, 3 concurrent connections per API key (https://kite.trade/docs/connect/v3/websocket/)
- Team: "30 member tech team" (https://zerodha.tech/blog/hello-world/), 31 the following year (https://zerodha.tech/blog/being-future-ready-with-common-sense/)

## Requirements stated or clearly implied
- Availability target: no SLA published. The stated posture is the opposite of a nines target — "There is no such thing as 100% uptime and one would be deluded to think that it is practically achievable" (being-future-ready). Two physical data centres plus AWS; no region-loss claim is made. Regulatory connectivity to the exchanges is single-country by definition.
- Consistency: strong and relational for the system of record. "97.42% of all business problems can be reduced to CRUD, represented as relational data that need ACID guarantees" (scaling-with-common-sense). The read path is deliberately stale-tolerant: everything Kite renders comes from a Redis cache populated asynchronously by separate services.
- Latency target: "For Kite, we maintain 40ms roundtrip latency on the client side over a good internet connection as the baseline, and any time this starts fluctuating, we look at avenues to refactor" (being-future-ready). The stated property is variance, not the mean: "The key here is the consistency of latency" (scaling-with-common-sense).
- Ordering needs: not stated for Kafka. Market ticks are a last-value stream — the tick protocol carries current price/depth per instrument, not a log, so late or dropped packets are superseded rather than replayed.
- Replay or reprocessing: Kafka is the central bus and kaf-relay replicates topics between clusters with failover; the sources do not describe consumer replay as a design requirement. The nightly EOD process is the reprocessing mechanism for financial data — "99% of writes occur during nightly EOD processes".
- Retention: logs by level — debug 15 days, warn 30 days, application default 90 days (logging-at-zerodha). Postgres: monthly partitions, current financial year on the primary shard and older years on smaller nodes. Hot-cache Postgres and Redis are both discarded daily.
- Compliance / residency: Indian capital-markets regulation. SEBI's 2020 cybersecurity framework — Zerodha reports being "fully compliant with many critical clauses on day one" because SSO + 2FA + zero-trust VPN were instituted in 2017. Physical racks exist specifically because exchange leased lines must terminate in a regulated colocation. Contract notes are digitally signed PDFs, a statutory artefact.

## Boundaries
- Regions / zones: two physical data centres in India holding rack space "where exchange leased lines terminate", connected to AWS VPCs "via P2P leased lines"; AWS for everything else. No multi-region or AZ topology is published.
- Trust zones: public internet (Kite web, Kite mobile, third-party Kite Connect apps) → HAProxy/Nginx edge → internal Go services → Veto → the vendor OMS → exchange leased lines → NSE/BSE/MCX. Internal staff tooling (Frappe/ERPNext rules dashboard, Metabase, Grafana, GitLab) sits behind SSO + 2FA and a zero-trust VPN, with `torii` as an identity-aware reverse proxy.
- Named subsystems / bounded contexts: **Kite** (trading front end and its Go backend), **ticker** (market-data WebSocket fan-out), **Kite Connect** (the public HTTP/WebSocket API, "Brokerage as a Platform"), **Console** (reporting and P&L over hundreds of billions of rows), **Veto** (order pre-validation), **OMS** (third-party, exchange-facing), the **EOD/contract-note** batch pipeline, and the observability and logging stacks.
- Orchestration units: Nomad clusters (batch and many services), a Kubernetes/EKS estate for stateless workloads, plus bare metal and standalone EC2. All three coexist.

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Kite web | Trading web app; sends E-Tags and honours 304s | in-house, VueJS (was Angular) | client | clientRoundTripBaselineMs: 40; httpCaching: etag |
| 2 | Kite mobile | iOS/Android trading app | in-house, Flutter (was native, then React Native) | client | migrated native → React Native → Flutter for performance |
| 3 | Third-party Kite Connect apps | smallcase and the Rainmatter ecosystem building on the public API | external | client | OAuth-like auth flow |
| 4 | HAProxy / Nginx | Load balancing and proxying in front of the Go services | HAProxy, Nginx | load-balancer | |
| 5 | Kite backend | Go HTTP API for orders, positions, portfolio; reads bytes out of Redis and writes them to the connection with no serialisation in the hot path | in-house, Go (rewritten from Python in 2017, rewritten again ~2021 at ~50% the lines) | app-server | stateless: true; cacheFirst: true; connectionPooled: true; "hundreds of thousands of requests per second using a few hundred connections in a pool" |
| 6 | Hot Redis cache | The only thing Kite reads from: "Every bit of data that is shown on Kite, our trading platform, comes from a 'hot' Redis cache. Orders, positions, portfolio, absolutely everything." | Redis, self-managed | cache | persistence: disabled; multiple independent instances; hundreds of GBs; O(1) byte-blob lookups; "dumb cache" |
| 7 | E-Tag map | Redis map of E-Tag per user per resource; deleting the tag forces a full 200 on the next request | Redis | cache | invalidation: delete-tag; "saves us terabytes of bandwidth every month" |
| 8 | Cache populators | Independent asynchronous services that fill Redis; never on the request path | in-house, Go | worker | async: true |
| 9 | Ticker | Market-data WebSocket fan-out: "hundreds of thousands of concurrent WebSocket connections broadcasting millions of market quotes every second"; refactored or rewritten at least five times in six years | in-house, Go | realtime-gateway | endpoint: wss://ws.kite.trade; binary protocol; modes ltp 8 B / quote 44 B / full 184 B; ≤3000 instruments per connection; ≤3 connections per API key; 1-byte heartbeat on idle; design guidance "one request per second per connection" |
| 10 | Market-data transport | Carries ticks from exchange feed handlers to ticker instances; transport changed custom TCP → ZeroMQ → Nanomsg/Mangos → NATS | NATS (current) | pubsub-topic | "transmits high-volume, real-time market data across infrastructure" (CNCF) |
| 11 | Kite Connect | Public HTTP/JSON + WebSocket API for third parties; `POST /orders/:variety` | in-house | api-gateway | varieties: regular, amo, co, iceberg, auction; postbacks signed with SHA-256(order_id + timestamp + api_secret) |
| 12 | Veto | Reverse proxy in front of the OMS that pre-validates every order against risk rules and rejects in place: "accept incoming orders as HTTP requests, either rejecting them in place or proxying them to the upstream OMS" | in-house, Go | policy-engine | hot-reloadable; rule eval 503 ns/op with native Go plugins (vs govaluate 907, yaegi 11,091, rego 13,796); "Rejected orders never go through to the OMS thereby reducing significant load on the OMS" |
| 13 | Veto compiler + validation servers | Compile `.go` rule files into one `.so` plugin, validate against the rule's own test cases, push it to production Veto and trigger a hot reload | in-house, Go, on an internal K8s cluster | worker | two small deployments; AST rewriting adds a rule-name prefix and a timestamp constant so identical rules can be reloaded |
| 14 | Rules dashboard | Where the Risk Management team edits, validates and saves rules | Frappe | app-server | built-in editor; save gated on the rule's test cases passing |
| 15 | OMS | Exchange-facing order management; proprietary vendor system Zerodha cannot see inside | Thomson Reuters Omnesys (SOAP-like HTTP/XML, wrapped by in-house middleware) | third-party-api | "our technology team does not have any control over the internals"; statuses include VALIDATION PENDING, OPEN PENDING, OPEN, COMPLETE, REJECTED, CANCELLED |
| 16 | Exchange leased lines | Physical connectivity to NSE/BSE/MCX terminating in two colocated data centres | leased lines (carrier not named) | network-fabric | P2P leased lines join the racks to AWS VPCs |
| 17 | Primary Postgres shards | System of record: trades, P&L, ledger entries, mostly denormalised | PostgreSQL, self-managed on EC2 | sql-database | 4 nodes joined by `postgres_fdw`; ~20 TB; 40–50k QPS peak; monthly range partitions on timestamp; current financial year on the primary, older years on smaller nodes; failover replicas; disk-snapshot backups; auto-vacuum off, manual VACUUM ANALYZE by cron; work_mem ~600 MB; no auto-increment IDs stored |
| 18 | Hot-cache Postgres | Ephemeral instance holding per-request materialised query results so users can filter and sort without touching the primaries | PostgreSQL | sql-database | "tens of millions of tables at the end of every day"; dropped and recreated nightly; fsync and replication disabled; high max_connections, low work_mem |
| 19 | DungBeetle (sql-jobber) | Distributed job server that queues heavy SQL read jobs against the primaries and writes results into the hot-cache instance, capping the load that reaches them | DungBeetle, in-house OSS | workflow-engine | Postgres, MySQL and ClickHouse backends |
| 20 | Console | Reporting and analytics over "hundreds of billions of rows of financial data" | in-house, Go (rewritten from Python) | app-server | ClickHouse being adopted for immutable financial data |
| 21 | Kafka | Central message bus; sidecar utilities connect systems that have no direct API to each other. "Systems thus stopped being aware of each other." | Apache Kafka, self-managed; kaf-relay for inter-cluster replication | stream | kaf-relay does topic remapping, health checks and HA failover |
| 22 | ClickHouse | Column store for logs and, increasingly, immutable financial data | ClickHouse, self-managed | data-warehouse | 4x r5a.2xlarge at $1.14/hour; 30B rows in 2.5 TB (17.38 bytes/row, ~20x better than ELK's 340); TTL 15 d debug / 30 d warn / 90 d default |
| 23 | Vector agents + aggregators | Log shipping and batching, replacing Filebeat and Logstash; aggregators exist because direct agent inserts overwhelmed ClickHouse | Vector | stream-processor | sources: standalone EC2 instances and Nomad clusters |
| 24 | Prometheus + Alertmanager + Grafana + VictoriaMetrics | Metrics scrape, long-term store, alerting, dashboards across bare metal, EC2 and Kubernetes | Prometheus, Alertmanager, Grafana, VictoriaMetrics | monitoring, timeseries-database | 3 Prometheus replicas per cluster; EC2 service discovery on the `monitoring:enabled` tag; static file SD for the DC racks; one central Alertmanager cluster all Prometheus instances connect to; alerts pushed to Google Chat |
| 25 | EOD contract-note pipeline | Nightly batch: Tasqueue distributes jobs through Redis, Typst renders PDFs, a JVM OpenPDF wrapper signs them, S3 stores them, Haraka mails them; Terraform builds and tears the cluster down around the run | Tasqueue, Redis, Typst, OpenPDF (`jpdfsigner`), S3, Haraka + smtppool, Nomad, Rundeck, Terraform | worker | ~40 mixed c6a instances; Redis is both broker and job-status store; S3 prefixes fixed as `{0-9}-{pdfs, signed_pdfs, contract_notes}` to multiply rate limits tenfold; ASG counts reset to zero on teardown |
| 26 | Nomad + Kubernetes (EKS) | Two orchestrators side by side: Nomad for batch and many services, Kubernetes for stateless workloads migrated from VMs since 2020 | HashiCorp Nomad, Kubernetes/EKS, with ECR, GitLab CI, Terraform, Packer, eksctl | container-orchestrator | ≥50% reduction in compute instance cost; environments provisioned "in minutes instead of hours" |
| 27 | Zero-trust access layer | SSO + 2FA + VPN in front of all internal tooling; `torii` as an identity-aware reverse proxy | in-house + torii (OSS) | identity-provider | instituted 2017; credited for day-one SEBI compliance in 2020 |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| kite-web / kite-mobile | haproxy-nginx | https | sync | | E-Tag sent; 304 when unchanged |
| haproxy-nginx | kite-backend | http | sync | | |
| kite-backend | hot-redis-cache | redis | sync | | O(1) lookup, byte blob written straight to the connection, no JSON serialisation |
| kite-backend | etag-map | redis | sync | | per user per resource |
| cache-populators | hot-redis-cache | redis | async | | independent services, off the request path |
| primary-postgres-shards | cache-populators | sql | async | | source of the cached state |
| kite-web / kite-mobile | ticker | wss | async | best-effort, last-value | binary packets, ≤3000 instruments per connection, 1-byte heartbeat |
| exchange-feed | market-data-transport (nats) | nats | async | best-effort | ~16M ticks/sec |
| market-data-transport (nats) | ticker | nats | async | best-effort | fan-out to hundreds of thousands of sockets |
| third-party-apps | kite-connect | https | sync | | OAuth-like token |
| third-party-apps | ticker | wss | async | | same binary protocol, `wss://ws.kite.trade` |
| kite-backend | veto | http | sync | | every order |
| kite-connect | veto | http | sync | | `POST /orders/:variety` |
| veto | oms | http/xml (SOAP-like, via in-house middleware) | sync | | rejects in place or proxies upstream; rejected orders never reach the OMS |
| veto-compiler-server | veto | http | async | | pushes the built `.so` and issues a hot reload |
| rules-dashboard (frappe) | veto-validation-server | http | sync | | rule source posted; save gated on test cases |
| oms | exchange (nse/bse/mcx) | exchange protocol over leased line | sync | | terminates in the two colocated DCs |
| oms | kite-backend | postback | async | | order status updates: COMPLETE, REJECTED, CANCELLED, UPDATE |
| kite-connect | third-party-apps | https postback | async | at-most-once (no retry documented) | SHA-256 checksum of order_id + timestamp + api_secret |
| ticker | third-party-apps | wss text frame | async | | order postbacks, errors and broker alerts delivered as JSON on the same socket |
| kite-backend | primary-postgres-shards | sql | sync | | ACID system of record |
| primary-postgres-shards (node 1) | primary-postgres-shards (nodes 2-4) | postgres_fdw | sync | | cross-node scan; no cross-node parallelisation, aggregations pay network transfer |
| console | dungbeetle | http | async | | heavy SQL read jobs queued, not run inline |
| dungbeetle | primary-postgres-shards | sql | sync | | load-capped by the queue |
| dungbeetle | hot-cache-postgres | sql | async | | writes one ephemeral table per result set |
| console | hot-cache-postgres | sql | sync | | user filters and sorts hit the cache, not the primaries |
| all systems | kafka | kafka | async | | central bus; sidecar utilities bridge systems with no direct API |
| kafka (cluster a) | kafka (cluster b) | kafka | async | | kaf-relay, with topic remapping and HA failover |
| console | clickhouse | http | sync | | immutable financial data |
| vector-agents | vector-aggregators | vector | async | | batching layer added after direct inserts broke ClickHouse |
| vector-aggregators | clickhouse | http | async | | batched INSERTs |
| ec2 + nomad + k8s + bare metal | prometheus | http scrape | async | | EC2 SD by tag; static file SD for DC racks |
| prometheus | victoriametrics | remote write | async | | 56B data points |
| prometheus (all instances) | alertmanager | http | async | | one central cluster |
| alertmanager | google chat | https | async | | in-house utility |
| eod-process | primary-postgres-shards | sql | async | batch | 99% of all writes |
| tasqueue | redis (jobs) | redis | async | | broker and job-status store |
| pdf-workers | s3 | https | async | | ~5.3k req/s, ~7M ephemeral objects, fixed prefix partitioning |
| pdf-workers | jpdfsigner | http | sync | | single boot JVM handling signing requests concurrently |
| pdf-workers | haraka-smtp | smtp | async | | pooled connections via smtppool |
| racks (dc1, dc2) | aws vpc | p2p leased line | sync | | the hybrid seam |

## Failure modes, incidents, tradeoffs the source discusses
- **27 Feb 2019, the OMS outage.** "The OMS developed connectivity issues, which resulted in orders piling up." Several lakh orders sat in VALIDATION PENDING at market open. The failure then amplified itself through customer behaviour: "customers placing more orders to make up for the hanging orders, increasing the pile up exponentially." Zerodha could not fix it — "Since the OMS is their proprietary system that is licensed out to stock brokers, our technology team does not have any control over the internals" — and had to wait for the vendor. The stated lesson is the argument for building in-house: "over 90% of the activity load … is handled by our systems efficiently, but the rest of the 10% … sometimes acts as the weakest link." (https://zerodha.com/z-connect/general/todays-technical-issues-postmortem)
- **Connection pools amplify upstream latency instead of absorbing it.** "The slightest increase in the latencies immediately render these pools useless … Ironically, the latency increase upstream indicates its inability to process more requests in the first place, which means, the growing pool only makes matters worse, overloading upstream." (https://zerodha.tech/blog/scaling-with-common-sense/)
- **And the failure is undebuggable once it is distributed.** "Imagine this happening in a microservice mesh of dozens of services. One wouldn't even know where to start crying, let alone start debugging." (same)
- **Latency variance, not latency, is the alarm.** "The key here is the consistency of latency" (same); the 40 ms client round trip is a tripwire — "any time this starts fluctuating, we look at avenues to refactor" (https://zerodha.tech/blog/being-future-ready-with-common-sense/).
- **Veto exists so that the black box is shielded.** "Rejected orders never go through to the OMS thereby reducing significant load on the OMS." (https://zerodha.tech/blog/a-lesson-in-niche-business-dsls-at-scale/)
- **The DSL failed before the plugins worked.** Veto v1's expression language became unusable at real rule complexity: operators "would end up spending hours trying to write complex rules", expressions became "unreadable…beyond a certain complexity", there were no variables to reuse, a single spread rule had to be fragmented into `spread_ce_buy`/`spread_ce_sell`, and "custom error messages and any non-boolean behaviour were not possible". The replacement carries its own tax — Go plugin builds must match the host's Go version, dependencies and GOPATH exactly, and "Plugins cannot be un-loaded after they have been loaded", which is why the compiler rewrites the AST to add a timestamp constant. (same)
- **One giant Postgres shard was the risk, not the size.** The team names unbearably slow nightly bulk imports and vacuuming, difficulty recovering from a crash on a massive dataset, and paying hot-storage prices for inactive history. `postgres_fdw` sharding took "less than two hours with zero schema changes", at the cost of network transfer on aggregations and no cross-node parallelisation. (https://zerodha.tech/blog/working-with-postgresql/)
- **Daily partitioning was tried and reverted** because it degraded queries spanning date ranges; monthly won because "most of the user-generated queries tend to be within a month's range". (same)
- **Tuning beats replacing.** "It is impossible to meaningfully tune a Postgres DB and your queries if you do not understand VACUUM ANALYZE well" (same), and more bluntly: "If one picks a slow technology, builds a service in it expecting performance and scale, and then painstakingly tries to scale the underlying technology that is slow by design, that is a classic case of the not using the right tool for the right job." (https://zerodha.tech/blog/scaling-with-common-sense/)
- **ELK's cost model was the defect.** "Storage costs skyrocketed as each incoming field is indexed for searching, inflating the storage requirements for each log event by a minimum of 3-4x", Logstash "would experience frequent slowdowns during peak traffic loads", and "Elasticsearch is slow for aggregate queries over a long period". The replacement's own failure mode: direct agent-to-ClickHouse inserts caused partition read-only failures, fixed by inserting Vector aggregators to batch. (https://zerodha.tech/blog/logging-at-zerodha/)
- **The batch pipeline was re-plumbed around storage limits, not compute.** EFS was "wholly unsuitable" next to EBS's ~400 ms for the same task; S3 rate limits were dodged by fixed prefix partitioning that multiplied them "tenfold"; `pdflatex` "lacks support for dynamic memory allocation" so Typst replaced it; Postal was replaced by Haraka because "Postal's resource usage was intense and it was not horizontally scalable". (https://zerodha.tech/blog/1-5-million-pdfs-in-25-minutes/)
- **Rewrites are scheduled by symptom, not by calendar.** The ticker has been "refactored/rewritten at least 5 times in 6 years", its transport walking custom TCP → ZeroMQ → Nanomsg/Mangos → NATS; Kite's backend went Python → Go and then Go → Go at half the line count. (https://zerodha.tech/blog/being-future-ready-with-common-sense/)
- **Decoupling was the point of Kafka.** A maze of direct API connections was replaced by a central bus, after which "Systems thus stopped being aware of each other", letting systems be evolved or deleted "with minimal disruptions to the organisation". (same)
- **No uptime illusions.** "There is no such thing as 100% uptime and one would be deluded to think that it is practically achievable", and the cited example of an unmodellable input is 2020's negative crude price, which crashed systems worldwide "not equipped to handle negative numbers". (same)
- **The stated non-technical bottleneck.** "Sometimes (often), a managerial bottleneck is a bigger impediment to common sense scaling than network IO." (https://zerodha.tech/blog/scaling-with-common-sense/)

## Unknowns
- The exchange feed handlers themselves — what ingests the NSE/BSE/MCX multicast feeds and publishes into NATS — are never described. The gap between "exchange leased line" and "NATS" is unpublished.
- Ticker internals: how instrument subscriptions are sharded across ticker nodes, how many nodes there are, how a client reconnect re-subscribes, and whether there is any backpressure or coalescing when a client cannot keep up.
- Redis topology: "multiple independent instances" is stated, but not the sharding key, the instance count, memory sizes, or what happens to the read path when one instance is lost. With persistence disabled, the rebuild path after loss is not described.
- Kafka specifics: cluster count, topic list, partitioning, replication factor, retention, and whether any consumer replays.
- Veto's own throughput and latency. The post benchmarks rule-evaluation engines (ns/op) but publishes no RPS or end-to-end latency for Veto, and does not say whether it is HA, how many instances run, or what happens to in-flight orders during a hot reload.
- Which workloads sit on Nomad versus Kubernetes versus bare metal versus plain EC2. All four are named; the split is not.
- No failover story is published for the two data centres, for the P2P leased lines, or for the exchange connectivity. Whether DC2 is active or standby is not stated.
- The OMS is a black box by the sources' own admission — its capacity, queueing, and internal topology are unknown to Zerodha itself.
- No p99 figures anywhere. The only latency number published is a 40 ms client-side round-trip baseline.
- Whether the 2021-era architecture still holds in 2024–2026: the blog goes quiet on core architecture after 2021, with later posts covering logging and batch only.

## Candidates
- New kinds: none. Every box maps to an existing kind. The closest to a gap is Veto — a *rejecting reverse proxy carrying hot-reloadable business rules* sits between `policy-engine` and `api-gateway`; modelling it as `policy-engine` with an `inline: proxy` property is probably enough, but it is worth a second sighting before deciding.
- New properties on existing kinds:
  - `cache.persistence` (enabled | disabled) — Zerodha runs Redis with persistence off deliberately
  - `cache.role` (lookaside | read-through | dumb-passthrough) — the "dumb cache" pattern where bytes go straight from cache to socket with no serialisation
  - `cache.rebuildSource` (which component repopulates it after loss) — the missing half of a no-persistence cache
  - `sql-database.lifecycle` (durable | ephemeral-daily) — the hot-cache Postgres is dropped and recreated nightly
  - `sql-database.shardingMechanism` (fdw | citus | app-level | none) and `sql-database.partitionInterval` (daily | monthly | yearly)
  - `realtime-gateway.subscriptionsPerConnection` and `realtime-gateway.connectionsPerCredential` (integers) — 3000 and 3 here
  - `realtime-gateway.payloadEncoding` (json | binary | protobuf) and `heartbeatBytes`
  - `policy-engine.inline` (proxy | sidecar | library | advisory) — whether the engine can reject in the request path
  - `policy-engine.reloadMode` (restart | hot) and `ruleAuthoring` (dsl | code-plugin | config)
  - `third-party-api.opaque` (boolean) — a dependency whose internals the operator cannot see or fix, which is the whole shape of the 2019 incident
  - `container-orchestrator.coexistsWith` — Nomad and Kubernetes side by side is a real, common topology the model should be able to express
- New requirement paths:
  - `latency.varianceIsTheTarget` (boolean) — "the key here is the consistency of latency"
  - `latency.clientRoundTripMs` — an end-to-end client budget, distinct from a server p99
  - `availability.degradedModeAllowed` set false for order-entry paths
  - `compliance.physicalConnectivityRequired` (boolean) — leased lines terminating in a regulated colocation, which forces the hybrid topology
  - `load.profile` (steady | diurnal | market-open-spike | event-driven) — the 09:15 vertical spike is the dominant design force here
- New rules (name + one-line condition):
  - `opaque-third-party-on-critical-path` — a sync edge from an internal service to a `third-party-api` marked opaque, on a path with no degraded mode and no in-place rejection guard
  - `no-admission-control-before-bounded-upstream` — a bounded-capacity upstream (OMS, exchange gateway) reached without a rate-limiter or policy-engine that can reject in place
  - `retry-amplification-unbounded` — a client-facing write path where the client can resubmit and no idempotency key or dedupe is declared (the "customers placing more orders" cascade)
  - `unbounded-connection-pool-to-latent-upstream` — a sync edge into a component with a latency target where the caller's pool has no max size or no circuit breaker
  - `cache-without-persistence-or-rebuild-path` — a `cache` with `persistence: disabled` and no declared repopulating component
  - `everything-reads-from-one-cache` — every read edge from a client-facing app-server terminates in a single cache with no fallback to the system of record
  - `fdw-shard-fanout-on-aggregate` — a `sql-database` with `shardingMechanism: fdw` serving aggregate queries, which pay network transfer and cannot parallelise across nodes
  - `direct-writes-to-columnstore` — many agents inserting straight into a column store with no batching aggregator
  - `single-dc-exchange-connectivity` — a `network-fabric` edge to an external venue with no stated second path, in a design whose availability requirement forbids degraded mode
  - `hot-reload-without-inflight-drain` — a `policy-engine` with `reloadMode: hot` on a sync request path with no stated in-flight handling


## Verification 2026-09-14

Spot check of two primary URLs (the card's sources were fetched 2026-09-14).

| URL | Reachable | Outcome |
|---|---|---|
| https://zerodha.tech/blog/scaling-with-common-sense/ | yes | Confirmed verbatim: "Every bit of data that is shown on Kite, our trading platform, comes from a 'hot' Redis cache. Orders, positions, portfolio, absolutely everything."; "Disk persistence is turned off on these cache instances"; "there is a Redis map that maintains the E-Tags per user per resource. This tag is deleted when the cache becomes invalid, forcing a full HTTP 200 response the next time."; "Getting the data into Redis in the first place is the responsibility of an independent asynchronous service elsewhere."; "hundreds of thousands of requests per second using a few hundred connections in a pool." |
| https://zerodha.tech/blog/working-with-postgresql/ | yes | Confirmed verbatim: "close to 20 TB, across four sharded nodes"; "40-50,000 queries per second during peak traffic"; per-month partitioning; "tens of millions of tables at the end of every day" and "We simply drop the cache DB and recreate it every night"; "for backups, AWS disk snapshots"; auto-vacuum turned off; sql-jobber as "an open-source distributed job queue that can queue heavy SQL read jobs". |

Not re-fetched this pass: the other seven Zerodha Tech blog posts, the three Kite Connect v3 pages,
the Z-Connect postmortem and the CNCF case study. Nothing in the design depends on a number those
pages alone carry beyond what the card quotes.

Facts the design assumes rather than cites: Postgres backup retention days, the credential rotation
period, the eviction policy on the caches, the Kafka edge into the cache populators, and reading the
40 ms client round-trip baseline as `latency.p95Ms`. Each is listed in `../notes.md`.
