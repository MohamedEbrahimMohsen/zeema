# Intake: PayPal payment platform

## Source
- Primary: https://developer.paypal.com/community/blog/scaling-kafka-to-support-paypals-data-growth/ (Monish Koppa, PayPal engineer; PayPal Technology Blog / PayPal developer community blog, 2023) — the Kafka data bus
- Primary: https://github.com/paypal/junodb — official PayPal open-source repo; docs fetched raw: `docs/junodb_arch_overview.md`, `docs/proxy_config.md`, `docs/host_expansion.md`, `docs/faq.md`, `README.md` (2023-2024) — JunoDB internals
- Primary: https://github.com/paypal/hera (official PayPal open-source README) — HERA data access gateway in front of Oracle/MySQL
- Primary: https://developer.paypal.com/community/blog/graphql-a-success-story-for-paypal-checkout/ (PayPal Checkout engineers, PayPal developer community blog) — the checkout API layer, REST -> Bulk REST -> GraphQL
- Primary: https://developer.paypal.com/api/rest/integration/orders-api/api-use-cases/standard and https://developer.paypal.com/docs/checkout/standard/customize/ (official PayPal API documentation) — the payment flow itself
- Primary (talk): https://www.confluent.io/resources/kafka-summit-2020/marching-toward-a-trillion-kafka-messages-per-day-running-kafka-at-scale-at-paypal/ (Maulin Vasavada, PayPal, Kafka Summit 2020)
- Secondary: https://www.infoq.com/news/2023/06/paypal-junodb-kv-store/ (InfoQ write-up of PayPal's JunoDB open-source announcement; the Medium original returned 403)
- Secondary: https://aerospike.com/resources/customer-stories/paypal-aerospike-customer-story/ (vendor case study quoting Sai Devabhaktuni, Senior Director of Engineering, PayPal) — the risk/fraud data tier
- Verified by: official PayPal engineering blog (2 posts), official PayPal open-source repos and docs (junodb, hera), official PayPal API documentation, Kafka Summit talk by a PayPal engineer; supported by InfoQ and a vendor case study with a named PayPal engineer quote
- Confidence: high for the Kafka bus, JunoDB and the merchant-facing payment flow; medium for the Oracle/HERA and Aerospike tiers (README plus vendor case study rather than an architecture post); low for the Kubernetes/Mesos compute platform (the PayPal post returned 403 — left in Unknowns)
- Date of source: 2020 (talk), 2022-2023 (Kafka, JunoDB, GraphQL), 2024-2025 (API docs, Aerospike case study)

## System in three lines
Processes card, wallet and bank payments for merchants and consumers worldwide: a merchant creates an order, the buyer approves it on PayPal, the merchant captures the funds, and PayPal runs risk, funding and settlement behind that call. The platform is a large microservice estate whose shared organs are a multi-tenant Kafka bus (1.3 trillion messages a day at peak), JunoDB (a key-value store serving 350 billion requests a day for caching, idempotency and latency bridging), HERA in front of the Oracle and MySQL systems of record, and Aerospike as the hot feature store for real-time risk. It is hard because every request is money — idempotency, per-account ordering and six-nines availability are non-negotiable, while the fraud decision has to come back inside a few tens of milliseconds.

## Scale (only if stated)
- API / KV requests: JunoDB "serves daily 350 billion requests at PayPal"; a large JunoDB cluster is ~200 storage servers handling ~100 billion requests/day (https://www.infoq.com/news/2023/06/paypal-junodb-kv-store/)
- Message throughput: peak 1.3 trillion Kafka messages/day at 21 million messages/sec on 2022 Retail Friday; 1.23 trillion/day at 19 million/sec on Cyber Monday 2022; each major use case over 100 billion messages/day (https://developer.paypal.com/community/blog/scaling-kafka-to-support-paypals-data-growth/)
- Kafka fleet: 85+ clusters, 1,500+ brokers, 20,000+ topics, close to 2,000 MirrorMaker nodes, 99.99% cluster availability; the security library "supports more than 800 applications" (same URL)
- Risk tier: 8M+ database transactions/sec, ~60 billion queries/day, ~25 billion computations/day, 100+ PB of risk data, ~75% of real-time risk decisions under 50 ms (https://aerospike.com/resources/customer-stories/paypal-aerospike-customer-story/)
- Availability: JunoDB delivers six nines of system availability (https://www.infoq.com/news/2023/06/paypal-junodb-kv-store/)
- Checkout latency: "every round trip costs at least 700ms in network time (at the 99th percentile)" for a client-to-API round trip (https://developer.paypal.com/community/blog/graphql-a-success-story-for-paypal-checkout/)
- Corporate volumes (accounts, TPV, transaction counts): no fetched source returned them; deliberately omitted

## Requirements stated or clearly implied
- Availability target: six nines for the KV tier; 99.99% for Kafka clusters; JunoDB reaches "zero downtime" through within-data-center and cross-data-center replication with "automatic and instantaneous failover"; Kafka spans multiple geographically distributed data centers with MirrorMaker for disaster recovery
- Consistency: JunoDB uses "a quorum-based protocol and two-phase commit"; the Oracle/MySQL systems of record behind HERA are transactional; Kafka topics carry a replica set of 3 with min-in-sync-replica alerting
- Latency target: JunoDB "low, single digit millisecond, latency at any scale"; ~75% of risk decisions under 50 ms; checkout round trip p99 at least 700 ms of pure network time, which is why the client collapses many calls into one GraphQL query
- Ordering needs: per-key within a Kafka partition (stated only as the standard Kafka guarantee); global ordering not claimed
- Replay or reprocessing: Kafka is the "data streaming pipelines, integration, and ingestion" backbone; MirrorMaker mirrors between clusters and security zones; explicit replay policy not stated
- Retention: JunoDB `MaxTimeToLive = 259200` seconds (3 days) by default, having evolved "from an in-memory short TTL data store to a persistent data store that supports long TTLs"; Kafka retention not stated
- Compliance / residency: "FinTech-grade security compliance" (Kafka Summit abstract); brokers deployed across "multiple geographically distributed data centers and security zones"; SASL/SSL authentication, per-topic ACLs and per-application tokens; JunoDB does on-disk encryption and TLS in transit by default; the order idempotency key is retained 6 hours by default, up to 72 hours on request

## Boundaries
- Regions / zones: multiple geographically distributed data centers; Kafka brokers are rack-aware across data-center zones; JunoDB replicates each record across a group of storage nodes "with each node situated in a distinct logical zone", and the expansion runbook loops zone0 through zone5; JunoDB also replicates cross-data-center
- Trust zones: buyer browser and merchant server (public, untrusted) -> PayPal public REST/GraphQL edge -> internal services; Kafka is explicitly partitioned into "security zones" with MirrorMaker as the only path between them; the QA platform lives in Google Cloud while production Kafka brokers run on bare metal
- Named subsystems: Checkout / Orders API, GraphQL gateway, Kafka platform (brokers, ZooKeeper, MirrorMaker, Kafka Config Service, client libraries), JunoDB (junoserv proxy, junostorageserv, junoclusterserv/etcd, clustercfg), HERA data access gateway, risk/fraud decisioning on Aerospike, SignalFX monitoring

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Buyer browser / PayPal JS SDK | Renders the PayPal button, takes the buyer to the approval page, returns the approval | PayPal JS SDK, Mobile SDK | client | roundTripP99Ms: 700 (network only) |
| 2 | Merchant server | Calls Orders v2 to create the order and then authorize or capture | not stated (merchant-owned) | third-party-api | idempotencyHeader: PayPal-Request-Id |
| 3 | PayPal REST API edge (Orders v2 / Payments v2) | Public payment API: create order, approve, authorize, capture, track, get | in-house | api-gateway | statuses: CREATED, PAYER_ACTION_REQUIRED, COMPLETED; orderWindowHours: 3; authorizationHoldDays: 29; idempotencyKeyTtlHours: 6 (up to 72) |
| 4 | GraphQL gateway | One typed graph over the checkout services; the client asks for exactly the fields it needs in a single round trip | GraphQL (schema-first) | api-gateway | singleRoundTrip: true; adoption: 30+ teams in one year |
| 5 | Bulk REST layer (superseded) | Map-based request that let a client shape the response; "was rarely used" | in-house | api-gateway | deprecated: true |
| 6 | Checkout / orchestration services | Aggregate the per-domain REST services behind the checkout experience | in-house | app-server | overfetching problem stated |
| 7 | Core backend services (login, risk, transaction processing) | "Virtually every core back-end service at PayPal relies on JunoDB, from login to risk to final transaction processing" | in-house | app-server | |
| 8 | JunoDB client library | Thin client inside applications; API for store/retrieve/update through the proxy | JunoDB (junoclient) | cache | languages: Java, Golang, C++ |
| 9 | JunoDB proxy (junoserv) | Load-balanced proxy; connects to all storage servers and routes each request to a replication group by the shard map | JunoDB proxy, Go | database-proxy | numChildren: 8; tlsPort: 5080; tcpPort: 8080; monPort: 8088; maxKeyBytes: 256; maxPayloadBytes: 204800; maxTtlSeconds: 259200 |
| 10 | JunoDB storage server (junostorageserv) | Holds a set of shards in memory or RocksDB, serves proxy operations | JunoDB storageserv over RocksDB | nosql-database | shards: 1024 logical; zones: zone0..zone5 in the runbook; monPort: 8089; replication: one replica per logical zone plus cross-data-center; encryption: on-disk |
| 11 | JunoDB etcd / clustercfg (junoclusterserv) | Holds the shard map and cluster topology; drives zone-at-a-time redistribution | etcd | coordination-service | clientPort: 2379; peerPort: 2378; consistentHashing: true |
| 12 | Load balancer in front of JunoDB proxies | Drives proxy instances and accepts replication traffic from other sites | not stated | load-balancer | acceptsCrossSiteReplication: true |
| 13 | HERA data access gateway (mux) | Multiplexes application connections onto a small pool of database connections, evicts bad queries, splits read/write traffic | HERA (PayPal OSS) | database-proxy | connectionMultiplexing: true; queryEviction: true; readWriteSplit: true; transactionFailover: true; sharding: domain-agnostic |
| 14 | HERA workers | Per-database worker processes holding the real connections | HERA mysqlworker / oracleworker / postgresworker | worker | databases: MySQL, Oracle, PostgreSQL |
| 15 | Relational systems of record | Transactional stores behind HERA; JunoDB acts as a "latency bridge" in front of them | Oracle, MySQL (named in the HERA README) | sql-database | |
| 16 | Risk/fraud feature store | Real-time feature access and model execution at login, account update, wallet change, purchase, transfer, withdrawal | Aerospike (hybrid memory architecture) | nosql-database | tps: 8000000+; queriesPerDay: 60e9; dataVolume: 100+ PB |
| 17 | Risk model execution | Runs one or more models per checkpoint, in sequence or in parallel | not stated | ml-inference | decisionsUnder50ms: ~75%; computationsPerDay: 25e9 |
| 18 | Kafka brokers | The multi-tenant streaming backbone for pipelines, integration and ingestion | Apache Kafka | stream | clusters: 85+; brokers: 1500+; topics: 20000+; replicaSet: 3; rackAware: true; deployment: bare metal; availability: 99.99% |
| 19 | ZooKeeper ensemble | Kafka cluster coordination | Apache ZooKeeper | coordination-service | deployment: virtual machines |
| 20 | MirrorMaker | Mirrors topics between clusters for disaster recovery and across security zones | Kafka MirrorMaker | stream-processor | nodes: ~2000; crossSecurityZone: true; deployment: virtual machines |
| 21 | Kafka Config Service | "highly available stateless service" that hands clients bootstrap servers and standard config at startup, removing hardcoded broker IPs | in-house | coordination-service | stateless: true |
| 22 | Resilient client library | Integrates with the discovery service, fetches broker information and configuration without developer involvement | in-house | app-server (library) | clients: Java, Python, Spark, Node, Golang, internal frameworks |
| 23 | Kafka security library | Manages SSL certificates and token retrieval for producers and consumers | in-house | key-management | applications: 800+; auth: SASL/SSL, per-topic ACLs |
| 24 | Kafka metrics library + SignalFX | Micrometer-registered metrics from brokers, ZooKeepers, MirrorMakers and clients into the monitoring backend, with an SOP per alert | Micrometer, SignalFX | monitoring | agentOn: brokers, zookeepers, mirrormakers, clients |
| 25 | Topic onboarding workflow / capacity tool | Request -> capacity review -> cluster assignment -> token -> ACL -> connection enabled | in-house | policy-engine | declaredIntent: producer or consumer per topic |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| merchant-server | paypal-rest-api | https | sync | idempotent via request key | POST /v2/checkout/orders; PayPal-Request-Id dedupes for 6h |
| paypal-rest-api | buyer-browser | https redirect (payer-action link) | sync | | order enters PAYER_ACTION_REQUIRED |
| buyer-browser | paypal-rest-api | https | sync | | buyer approves on PayPal |
| merchant-server | paypal-rest-api | https | sync | idempotent | POST /orders/{id}/capture or /authorize, inside the 3-hour order window |
| buyer-browser | graphql-gateway | https/graphql | sync | | single round trip, exactly the requested fields |
| graphql-gateway | checkout-services | http | sync | | replaces many REST round trips |
| checkout-services | core-backend-services | http | sync | | |
| core-backend-services | junodb-client | in-process | sync | | thin client |
| junodb-client | junodb-loadbalancer | tcp/tls | sync | | 8080 plain, 5080 TLS |
| junodb-loadbalancer | junodb-proxy | tcp/tls | sync | | |
| junodb-proxy | junodb-etcd | grpc | sync | | reads the shard map |
| junodb-proxy | junodb-storage | juno wire protocol | sync | quorum protocol + two-phase commit | proxy connects to all storage instances, forwards to the replication group for the shard |
| junodb-storage | junodb-storage | juno replication | async | | one replica per logical zone, within data center |
| junodb-proxy (site A) | junodb-proxy (site B) | juno replication over tls | async | | cross-data-center replication arrives as proxy traffic |
| core-backend-services | hera-mux | hera protocol (JDBC / Go SQL driver) | sync | | connection multiplexing |
| hera-mux | hera-worker | ipc | sync | | read/write split, bad-query eviction |
| hera-worker | oracle / mysql | sql | sync | transactional | automatic transaction failover to a replica |
| risk-services | aerospike | aerospike client | sync | | feature reads for model execution |
| risk-services | risk-models | in-process / rpc | sync | | multiple models per checkpoint, sequential or parallel |
| producer applications | kafka-config-service | http | sync | | fetch bootstrap servers and standard config at startup |
| producer applications | kafka-brokers | kafka protocol over SASL/SSL | async | replica set of 3, min-ISR monitored | per-topic ACL, declared producer intent |
| kafka-brokers | consumer applications | kafka protocol over SASL/SSL | async | at-least-once (not otherwise stated) | declared consumer intent per topic |
| kafka-brokers | zookeeper | zookeeper protocol | sync | | cluster metadata |
| kafka-brokers (cluster A) | mirrormaker | kafka protocol | async | | source cluster |
| mirrormaker | kafka-brokers (cluster B) | kafka protocol | async | | destination cluster; DR and cross-security-zone hop |
| brokers, zookeepers, mirrormakers, clients | signalfx | metrics push (Micrometer) | async | | one SOP per triggered alert |
| topic-onboarding-workflow | kafka-brokers | admin api | sync | | creates ACLs and tokens after capacity review |

## Failure modes, incidents, tradeoffs the source discusses
- Patching brokers back to back lost data. The fix is a plugin that "queries under replicated partition status before host restart" and patches a single broker at a time. Source: https://developer.paypal.com/community/blog/scaling-kafka-to-support-paypals-data-growth/
- Partition reassignment used to take days. Stock Kafka reassigns everything; PayPal modified it to reassign "only under replicated partitions hosted on the affected brokers" rather than let recovery run "unpredictably longer times" stretching "to a couple of days". Same URL.
- Hardcoded broker IPs in client applications were a "maintenance nightmare"; the Kafka Config Service exists to remove them. Same URL.
- Losing track of which application used which topic caused maintenance impact; per-topic ACLs with declared producer/consumer intent restored the mapping. Same URL.
- QA that did not match production caused configuration mismatches during rollout; the rebuilt QA platform enforces "one-to-one mapping between production and QA clusters" with identical security standards, and cut cloud cost 75% while improving performance 40%. Same URL.
- Cluster metadata is the recovery path: the internal configuration management system is the "single source of truth", frequently backed up, letting a cluster be rebuilt "in a couple of hours". Same URL.
- PayPal fed the operational gaps back upstream as KIP-351 and KIP-427 (visibility and monitoring of at-min-in-sync-replicas), KIP-517 (consumer polling observability) and KIP-519 (pluggable SSL context/engine for certificate management). Same URL.
- JunoDB removes leader election from the failure path: "In the event of a node malfunction, an automatic and instantaneous failover eliminates the need for leader re-election or data redistribution." Source: https://www.infoq.com/news/2023/06/paypal-junodb-kv-store/
- Scaling a JunoDB cluster is a controlled, zone-at-a-time removal of one replica: "Markdown one zone at a time to stop incoming real time traffic to this zone", update the topology in etcd, redistribute at a tuned rate limit, commit, then repeat for the next zone. Redistribution failures are retried, and failing that the source storage server is restarted. Source: paypal/junodb `docs/host_expansion.md`
- The proxy exists because the clients could not scale: "JunoDB employs a proxy-based architecture to enable horizontal connection scaling while simplifying client libraries, keeping complex logic and configurations separate from applications." A microservice estate opening persistent connections straight to data stores was the problem being solved. Source: paypal/junodb `docs/junodb_arch_overview.md`
- Single-threaded C++ did not survive multi-core growth; JunoDB was "rewritten in Golang to be highly concurrent and multi-core friendly" and moved from an in-memory short-TTL store to a persistent long-TTL store with on-disk encryption. Source: InfoQ write-up.
- Atomic REST design degraded checkout: clients had to choose between minting new endpoints and overloading existing ones, and "every round trip costs at least 700ms in network time (at the 99th percentile)". Bulk REST was built to fix it and "was rarely used" because the request syntax demanded intimate knowledge of the underlying APIs. GraphQL won because "You only get the data you asked for. No more, no less. Single round trip." Source: https://developer.paypal.com/community/blog/graphql-a-success-story-for-paypal-checkout/
- UI teams were spending their time on data plumbing: developers previously spent "less than 1/3 of their time actually building UI". Same URL.
- Idempotency is a product surface here, not an internal detail: the merchant supplies PayPal-Request-Id, PayPal stores the key for 6 hours (72 on request) and replays the original 200 OK for a repeat. Source: https://developer.paypal.com/api/orders/v2/orders-capture
- Two-phase money movement exists because capture can fail late: AUTHORIZE places a hold valid for 29 days so the merchant can verify inventory before settling. Source: https://developer.paypal.com/docs/checkout/standard/customize/authorization/
- Memory-only feature stores could not hold 100+ PB of risk data at single-digit-millisecond latency: "We needed to seamlessly leverage both the memory and disk in such a way that it can guarantee consistent performance." — Sai Devabhaktuni, Senior Director of Engineering, PayPal. Source: https://aerospike.com/resources/customer-stories/paypal-aerospike-customer-story/

## Unknowns
- The compute platform. The PayPal post on scaling Kubernetes to 4k nodes and 200k pods, and the Mesos estate it was migrating from, returned 403; no component rows were written for it.
- Where the money actually settles: the ledger, the double-entry model, the clearing and settlement path to card networks and banks, and reconciliation are not described in any source that was fetched.
- Kafka retention windows, consumer group topology, DLQ policy, and whether any pipeline replays from the start of a topic.
- JunoDB quorum sizes (N, R, W) and how two-phase commit interacts with cross-data-center replication; the production zone count (config default is 1, the runbook shows zone0 through zone5).
- How risk decisions are wired into the payment flow — synchronous inline call versus asynchronous scoring — and what the fallback is when the model tier is unavailable.
- Whether HERA still fronts the production Oracle fleet, and the current split between Oracle and MySQL.
- Rate limiting, WAF and DDoS protection at the public API edge: present by necessity, described nowhere in the fetched sources.
- The 2022 figures are the most recent the Kafka post states; current fleet size is unknown.

## Candidates
- New kinds: none. Every box maps to an existing kind; `database-proxy` covers both the JunoDB proxy and HERA, which is a strong second and third sighting for that kind.
- New properties on existing kinds:
  - `database-proxy.connectionMultiplexing` (boolean), `database-proxy.queryEviction` (boolean), `database-proxy.readWriteSplit` (boolean), `database-proxy.shardMapSource` (string, e.g. etcd)
  - `nosql-database.logicalShards` (integer), `nosql-database.zones` (integer), `nosql-database.replicaPerZone` (boolean), `nosql-database.crossDatacenterReplication` (boolean), `nosql-database.encryptionAtRest` (boolean)
  - `api-gateway.idempotencyKeyHeader` (string), `api-gateway.idempotencyKeyTtlHours` (integer), `api-gateway.queryShape` (rest | bulk-rest | graphql)
  - `stream.replicaSet` (integer), `stream.rackAware` (boolean), `stream.minInSyncReplicas` (integer), `stream.bootstrapDiscovery` (hardcoded | config-service)
  - `stream-processor.role` (mirror | transform), for MirrorMaker-style cross-cluster mirroring
- New requirement paths:
  - `security.zones` (integer) and `security.crossZoneTransport` (none | mirror | gateway) — the Kafka security-zone split is a first-class boundary here
  - `consistency.twoPhaseCommit` (boolean); `availability.nines` (number, to express six nines)
  - `payments.idempotencyRequired` (boolean); `payments.authorizationHoldDays` (integer)
- New rules (name + one-line condition):
  - `money-edge-without-idempotency`: a sync edge into an api-gateway or app-server that moves money with no idempotency key declared
  - `kv-replication-group-single-zone`: nosql-database with replicaPerZone true but zones eq 1
  - `broker-patch-without-isr-check`: stream with replicaSet ge 2 and no minInSyncReplicas declared
  - `hardcoded-bootstrap-servers`: stream with bootstrapDiscovery eq hardcoded
  - `cross-security-zone-direct-edge`: an edge crossing two security-zone boundaries with no mirror or gateway node between them
  - `chatty-client-over-high-latency-edge`: more than N sync edges from one client to the same api-gateway when a p99 network round trip is declared
  - `direct-db-connection-from-microservice-fleet`: many app-servers with sync edges straight to a sql-database and no database-proxy between them

## Verification 2026-09-14

Re-fetch of the five sources that carry the boxes, the numbers and the boundaries encoded in
`design.yaml`. The card was written 2026-09-07; this is a re-check, not a re-write.

| URL | Reachable | Outcome |
|---|---|---|
| https://developer.paypal.com/community/blog/scaling-kafka-to-support-paypals-data-growth/ | yes | Every Kafka fact confirmed verbatim: "During the 2022 Retail Friday, Kafka traffic volume peaked at about 1.3 trillion messages per day!" and "Retail Friday 2022: 21 million/sec"; "85+ Kafka clusters"; "over 1,500 brokers that host over 20,000 topics and close to 2,000 Mirror Maker nodes"; "offering 99.99% availability for our Kafka clusters"; "supports more than 800 applications"; "The Kafka config service is one of the most critical, highly available stateless services"; "Each Kafka cluster consists of brokers and zookeepers."; "MirrorMaker is used to mirror the data across the data centers"; "metrics are registered in Micrometer registry and are sent to SignalFX backend via SignalFX agent"; "Application teams are required to submit a request to onboard a new topic via the Onboarding Dashboard."; "The Kafka topics are configured with a replica set of three."; "We use BareMetal (BM) for deploying the Kafka Brokers". |
| https://github.com/paypal/junodb (`README.md`, `docs/junodb_arch_overview.md`, raw) | yes | Confirmed: "a secure, consistent and highly available key-value store providing low, single digit millisecond, latency at any scale"; junoserv / junostorageserv / junoclusterserv (etcd); on-disk encryption and TLS in transit; written in Go; "JunoDB employs a proxy-based architecture to enable horizontal connection scaling"; "JunoDB proxy instances are driven by a load balancer"; "each node situated in a distinct logical zone"; shard mapping "maintained in ETCD". |
| https://www.infoq.com/news/2023/06/paypal-junodb-kv-store/ | yes | Confirmed: "serves daily 350 billion requests at PayPal"; "a quorum-based protocol and two-phase commit"; "In the event of a node malfunction, an automatic and instantaneous failover eliminates the need for leader re-election or data redistribution."; "Virtually every core back-end service at PayPal relies on JunoDB, from login to risk to final transaction processing."; rewritten in Golang; evolved "from an in-memory short TTL (Time To Live) data store to a persistent data store that supports long TTLs". Not found on re-fetch: the "six nines" availability figure and the "~200 storage servers / ~100 billion requests a day" cluster size. Neither is encoded in the design. |
| https://developer.paypal.com/community/blog/graphql-a-success-story-for-paypal-checkout/ | yes | Confirmed: "every round trip costs at least 700ms in network time (at the 99th percentile)"; Bulk REST "was rarely used"; "You only get the data you asked for. No more, no less."; "UI developers were spending less than 1/3 of their time actually building UI"; "over 30 apps/teams either building APIs or consuming APIs". |
| https://aerospike.com/resources/customer-stories/paypal-aerospike-customer-story/ | yes | Confirmed: 8M+ database transactions/sec, ~60 billion queries/day, ~25 billion computations/day, 100+ PB of risk data, ~75% of real-time risk decisions under 50 ms, hybrid memory architecture, the checkpoint list (login, account update, wallet change, purchase, transfer, withdrawal), and the Sai Devabhaktuni quote "We needed to seamlessly leverage both the memory and disk in such a way that it can guarantee consistent performance." |

The PayPal API documentation pages (Orders v2 use cases, Checkout customize/authorization) were
not re-fetched; the facts drawn from them — the 3-hour order window, the 29-day authorization
hold, `PayPal-Request-Id` retained 6 hours (72 on request), and the `PAYER_ACTION_REQUIRED`
status — are used as the card states them. The Kafka Summit 2020 talk page and the 403 Kubernetes
post were not re-fetched either; nothing is encoded from them.

Nothing the card states was contradicted. Full log: `work/designs/paypal-payments/verify.md`.
