# Intake: Coinbase exchange and platform (matching engine, MSK Kafka, Kubernetes, 2021 incidents)

## Source
- Primary: https://docs.cdp.coinbase.com/exchange/concepts/matching-engine (official docs: price-time priority, self-trade prevention, order lifecycle)
- Primary: https://www.cncf.io/blog/2022/06/24/scaling-container-technologies-at-coinbase-with-kubernetes/ (official Coinbase post republished by CNCF)
- Primary: Coinbase blog posts (host returned 403 in this pass; content via search summaries and https://www.junaideffendi.com/p/coinbase-data-tech-stack which cites them): "How we scaled data streaming at Coinbase using AWS MSK" (2021), "Kafka infrastructure renovation at Coinbase" (2022), incident post-mortems for 2021-05-19 (Nginx connection threshold), 2021-10-27 (traffic spike during automated maintenance), 2021-11-23 (expired SSL certificate on internal load balancers), "Coinbase launches a new matching engine" (100k orders/sec, sub-ms)
- Verified by: official docs + official post via CNCF + official posts and post-mortems via cited summaries
- Confidence: medium (blog originals blocked; matching engine internals not public)
- Date of source: 2021-2026

## System in three lines
Crypto exchange and retail app where a price-time-priority matching engine (100k+ orders/sec, sub-millisecond, on dedicated infrastructure) sits behind an API and market data feeds, with custody split across hot, warm and cold wallets. Services run on AWS EKS in security-isolated clusters, talk over managed Kafka (MSK) with sub-10 ms service-to-service latency, and persist to a federated MongoDB and DynamoDB estate with Postgres, feeding Snowflake and a Delta Lake via CDC. Hard because market volatility multiplies traffic in minutes, an expired certificate on internal load balancers once failed 90% of API calls, and correctness of balances is non-negotiable.

## Scale (only if stated)
- Users / DAU: 120M+ verified users; $400B+ assets under custody (secondary citing Coinbase)
- Requests per second: matching engine "more than 100,000 orders per second with sub-millisecond matching latency"; identity service 1.5M reads/sec (post title, content not read)
- Data volume: MSK 30 brokers with ~17 TB per broker; "billions of events everyday"
- Message throughput: service-to-service latency under 10 ms via Kafka vs ~200 ms before
- Incidents: 2021-11-23 outage 4:00 to ~5:36 pm PT, ~90% of API traffic errored; 2021-05-19 ETH -20%, BTC -25% spike hit Nginx connection ceiling; 2021-10-27 intermittent outages during an automated maintenance event
- Kubernetes: deployments quadrupled, hosts per service 10x before migration; "100+ hours" of engineering saved by managed MSK

## Requirements stated or clearly implied
- Availability target: exchange must stay up through volatility; post-mortems published for every major outage
- Consistency: matching engine is a single sequenced order book per market (price-time priority, self-trade prevention); balances transactional; CDC eventual for analytics
- Latency target: sub-millisecond matching; sub-10 ms inter-service; sub-second analytics queries (StarRocks)
- Ordering needs: strict arrival order per market; "orders executed in price-time priority as received by the matching engine"
- Replay or reprocessing: Kafka retention, CDC connectors, Spark structured streaming with merge/upsert
- Retention: not stated
- Compliance / residency: regulated exchange; high-sensitivity workloads require "separate clusters"; custody with HSM/MPC (from public descriptions, not a fetched post)
- Certificates and secrets rotation are availability-critical (2021-11-23)

## Boundaries
- Regions / zones: AWS; matching engine on dedicated infrastructure (single primary zone per market implied by the 2026 thermal-event report)
- Trust zones: internet -> Nginx routers / load balancers -> services on EKS (isolated clusters for sensitive workloads) -> datastores; custody in cold storage offline
- Named subsystems: Exchange (matching engine, order gateway, market data), Retail app services, Identity, Custody (hot/warm/cold), Kafka platform (control plane + MSK data plane), Data (Kafka Connect CDC, SOON on Databricks, Delta Lake, Snowflake, StarRocks, Airflow), Platform (EKS, Odin legacy)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Web and mobile clients | Retail app and exchange UI; clickstream via Ruby/Go SDKs | web, iOS, Android | web-client, mobile-client, sdk-client | |
| 2 | Nginx routers | Public edge; hit max connection threshold 2021-05-19 | Nginx | load-balancer | |
| 3 | Internal load balancers | Inter-service traffic; expired SSL cert 2021-11-23 | not named | load-balancer | tls: true |
| 4 | API gateway / order gateway | REST, WebSocket, FIX entry to exchange | in-house | api-gateway | protocols: rest, websocket, fix |
| 5 | Matching engine | Continuous price-time priority order book per market; STP modes dc/co/cn/cb; states received/open/done | in-house (new engine on dedicated infra) | matching-engine (new) | ordersPerSec: 100000; latencyMs: 1 |
| 6 | Market data feed | WebSocket channels with sequence numbers (docs overview) | in-house | realtime-gateway | |
| 7 | Retail and platform services | Go/Ruby services on EKS | in-house | app-server | |
| 8 | Identity service | 1.5M reads/sec (post title) | in-house | app-server | rps: 1500000 |
| 9 | MongoDB | Primary document store in a federated setup with DynamoDB | MongoDB | nosql-database | |
| 10 | DynamoDB | Federated with MongoDB, "right tool for different jobs" | Amazon DynamoDB | nosql-database | |
| 11 | Postgres | Relational workloads; CDC source | PostgreSQL | sql-database | |
| 12 | Kafka (AWS MSK) | Multi-tenant cluster plus service-dedicated low-latency clusters; home-built control plane | AWS MSK | stream | brokers: 30; storagePerBrokerTb: 17; clusters: multi |
| 13 | Kafka Connect | CDC and sinks: MongoDB, Postgres, Snowflake, S3 connectors | Kafka Connect (open-sourced) | change-data-capture | |
| 14 | SOON (Spark continuous ingestion) | Structured streaming into Delta Lake on Databricks; append and merge | Spark, Delta Lake | stream-processor | |
| 15 | Snowflake / StarRocks | Warehouse and sub-second real-time analytics | Snowflake, StarRocks (CelerData) | data-warehouse | |
| 16 | Airflow | Central orchestrator since 2017 | Apache Airflow | scheduled-job | |
| 17 | S3 | Lakehouse storage | Amazon S3 | object-store | |
| 18 | Kubernetes (EKS) | Replaced homegrown Odin/AMI orchestration; separate clusters for sensitive workloads; IAM to service accounts | AWS EKS | ops platform, not tallied; security isolation as cell | |
| 19 | Custody: hot / warm / cold wallets, HSM, MPC | Key management and withdrawal approval workflows | HSMs, MPC (public descriptions) | key-management (new) | tiers: hot, warm, cold |
| 20 | Blockchains, banks, payment rails | External settlement | third parties | third-party-api | |
| 21 | Certificate management | Internal TLS certificates (expiry caused 2021-11-23) | not named | secrets-manager (certificates) | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | nginx routers | https | sync | | connection ceiling 2021 |
| nginx | services | http | sync | | |
| service | service (via internal lb) | https | sync | | cert expiry broke 90% |
| trader | order gateway | rest / websocket / fix | sync | | |
| order gateway | matching engine | internal | sync | ordered | price-time |
| matching engine | market data feed | internal | async | sequenced | websocket channels |
| matching engine | ledger / balances | internal | sync | | transactional |
| services | mongodb / dynamodb / postgres | native | sync | | federated |
| services | kafka (msk) | kafka | async | at-least-once | sub-10 ms |
| clients (sdk) | kafka | http -> kafka | async | | clickstream |
| databases | kafka connect | cdc | async | at-least-once | |
| kafka | soon (spark) | kafka | async | | |
| soon | delta lake (s3) | write | async | | |
| kafka connect | snowflake / s3 | sink | async | | |
| airflow | pipelines | orchestration | async | | |
| custody hot wallet | blockchain | rpc | async | | withdrawals |
| withdrawal workflow | cold storage (offline) | manual/approval | async | | |

## Failure modes, incidents, tradeoffs the source discusses
- Expired internal certificate: "The expired SSL certificate was used by many internal load balancers which caused a majority of inter-service communications to fail"; ~90% API errors for ~96 minutes. Source: 2021-11-23 post-mortem via summary.
- Volatility spike vs edge limits: rapid requests "hit a max threshold in Nginx router connections" during a 20-25% price drop. Source: 2021-05-19 post-mortem via summary.
- Maintenance during peak: "an automated maintenance event that was already underway slowed the ability to scale the cluster to meet demand". Source: 2021-10-27 post-mortem via summary.
- Zone lock-in: 2026 AWS thermal event report says recovery was delayed by "a matching engine locked to the failed zone and a silent failure in AWS's managed Kafka service". Source: search summary (secondary report).
- Homegrown orchestration ceiling: "clear ceiling" on the AMI/Docker system; Kubernetes decouples host provisioning from deploys. Source: CNCF post.
- Security isolation: "we must run separate clusters and build automated tooling that handles all cluster operations". Source: CNCF post.
- Managed Kafka trade: MSK saved "100+ hours" but silent managed-service failure hurt in 2026. Source: MSK post via summary; 2026 report.
- Latency by dedicated clusters: service-dedicated MSK cluster for extreme latency alongside multi-tenant. Source: renovation post via summary.

## Unknowns
- Matching engine internals (replication, failover, sequencer)
- Ledger and balance datastore
- Identity service design (post not readable)
- Custody workflow specifics

## Candidates
- New kinds: matching-engine (order book matcher; exchanges), key-management (HSM/MPC custody; also secrets-manager from MVP list); sightings: load-balancer (11th), api-gateway (13th), realtime-gateway (9th), nosql-database (20th), stream (16th), change-data-capture (7th), stream-processor (9th), data-warehouse (11th), scheduled-job (9th), object-store (16th), third-party-api (4th), sdk-client (3rd)
- New properties on existing kinds: matching-engine.priority (price-time), selfTradePrevention, zonePinned (boolean); load-balancer.certificateExpiry / certificateAutoRotate (boolean); stream.managed (boolean), dedicatedClusterForLatency (boolean); nosql-database.federatedWith
- New edge properties: tls (boolean); certificateManaged (boolean)
- New requirement paths: security.certificateRotationAutomated (boolean); availability.maintenanceWindowAvoidsPeak (boolean); isolation.sensitiveWorkloadsSeparateClusters (boolean)
- New rules:
  - internal-tls-without-automated-rotation: internal edges tls true while security.certificateRotationAutomated false (2021-11-23)
  - edge-connection-ceiling-without-shedding: load-balancer with fixed connection limit and no rate-limiter or autoscaling under traffic.peakMultiplier high
  - automated-maintenance-overlapping-peak: scheduled-job of type maintenance with no peak-avoidance while availability.maintenanceWindowAvoidsPeak true (informational)
  - stateful-engine-pinned-to-single-zone: matching-engine or single-writer node in exactly one availability-zone with no failover path
  - managed-dependency-without-independent-health-check: managed stream with no monitoring edge independent of the provider (silent failure)

## Verification 2026-09-14

Re-fetched on 2026-09-14 for this reference design. Full log: `work/designs/coinbase-exchange/verify.md`.

| URL | Reachable | Outcome |
|---|---|---|
| docs.cdp.coinbase.com/exchange/concepts/matching-engine | yes | price-time priority, the four STP modes, received/open/done all confirmed; no throughput or latency number on the page |
| cncf.io/blog/2022/06/24/scaling-container-technologies-at-coinbase-with-kubernetes/ | yes | EKS, separate clusters for high-security workloads, IAM roles for service accounts, 10x hosts on the largest service confirmed; the engineering organisation quadrupled, not the deployments |
| junaideffendi.com/p/coinbase-data-tech-stack | yes | 30 brokers at ~17 TB, MSK, sub-10 ms vs ~200 ms, SOON on Databricks, Delta Lake, S3 snapshots of Postgres and DynamoDB, Snowflake, StarRocks, Airflow since 2017 |
| infoq.com/news/2026/06/coinbase-aws-failure-postmortem/ | yes | 2026-05-07: Raft matching engine in a single AWS Cluster Placement Group, 3 of 5 nodes lost, quorum lost, no automated cross-zone failover, Kafka partitions moved by hand |
| coinbase.com/blog/* and medium.com/the-coinbase-blog/* | **403** | every Coinbase-hosted post and its Medium mirror returned 403 in this pass, as in the original intake pass; the matching-engine launch numbers, the 2021-05-19, 2021-10-27 and 2021-11-23 post-mortems, the MSK post, the Kafka renovation post and the 1.5M reads/sec identity post were confirmed through search summaries and trade-press coverage only |

Not carried into the design because it could not be confirmed or cannot be expressed: 120M+ verified users, $400B+ assets under custody, the MongoDB/DynamoDB federation relationship, the hot/warm/cold custody tiers and MPC, and any Postgres backup retention number (30 days is assumed, see notes.md).
