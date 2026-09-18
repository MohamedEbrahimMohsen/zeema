# Intake: Nubank core banking platform (Clojure microservices, Datomic ledger, Kafka, scalability-unit shards)

## Source
- Primary: https://www.infoq.com/presentations/nubank-architecture/ (write-up of "Architecting a Modern Financial Institution", Edward Wible — co-founder and CTO — and Rafael Ferreira — senior software engineer, QCon San Francisco, 2017)
- Primary: https://qconsf.com/sf2017/sf2017/presentation/architecting-modern-financial-institution.html (official QCon SF 2017 talk page for the above: speakers, roles, abstract listing the six subsystems)
- Primary: https://www.infoq.com/presentations/nubank-architectural-decisions (write-up of "Architecting Software for Leverage", Lucas Cavalcanti — principal engineer, QCon Plus, 2021) — the decision timeline 2013→2021
- Primary: https://qconnewyork.com/ny2017/ny2017/presentation/building-and-scaling-financial-system-record.html (official talk page, "Building and Scaling a Financial System of Record", Vitor Olivier — software engineer and partner, Nubank, QCon New York, 2017)
- Primary: https://building.nubank.com/working-with-clojure-at-nubank/ (Lucas Cavalcanti, principal software engineering, official engineering blog, 2019) — Clojure, Finagle, hexagonal architecture, Datomic, DynamoDB, Kafka, Kubernetes, Prometheus, EDN config, deploy cadence
- Primary: https://building.nubank.com/the-evergreen-cache/ (Gustavo Bicalho, software engineer, official engineering blog, 2020) — Datomic transactor/storage/peer split and the event-counter balance cache
- Primary: https://building.nubank.com/managing-cloud-limits/ (Elton Peixoto and Diogo Dantas, Nubank cloud infrastructure, official engineering blog, 9 April 2025) — 2025 scale, multi-account AWS, per-shard transactors and Kafka clusters, AWS Limit Smoke Detector
- Primary: https://building.nubank.com/avalanche-stack-and-real-time-streaming-applications-at-nu/ (Nubank engineering, official blog, 18 August 2025) — Avalanche: Kafka + Flink + Pinot on Kubernetes
- Primary: https://building.nubank.com/engineering-lessons-from-scaling-million-customers/ (Lucas Cavalcanti, distinguished engineer and senior architect, official blog, 20 August 2025) — 122M+ customers, sharding introduced 2016 and "eventually hit physical limits"
- Primary: https://building.nubank.com/simplicity-to-scale-systems-and-transform-software-engineering/ (Nubank engineering, official blog, 2025) — 118M+ customers, Clojure/ClojureScript/Datomic rationale
- Primary: https://www.datomic.com/nubanks-story.html (Datomic case study; Datomic's vendor Cognitect was acquired by Nubank in 2020, and the piece quotes CTO Edward Wible directly) — a dozen-plus independent Datomic databases, RDS PostgreSQL for PII and DynamoDB for non-PII, Spark-parallelised Datalog, chronological transaction replay
- Primary: https://building.nubank.com/nubank-acquires-cognitect/ (official announcement, 23 July 2020) — Nubank owns Datomic and Clojure stewardship
- Primary: https://www.thestrangeloop.com/2015/immutable-data-science-with-datomic-spark-and-kafka.html (official talk page, Konrad Scorciapino and Mauro Lopes, Nubank data architecture engineers, Strange Loop 2015)
- Secondary: https://www.devbcn.com/2025/talks/949215 (conference abstract; used only to corroborate the 2025 blog figures — 3,000+ Datomic databases, 4,000 microservices, 70B Kafka events/day)
- Verified by: two QCon talks by Nubank engineers as InfoQ write-ups (QCon SF 2017, QCon Plus 2021) plus their official QCon talk pages, a QCon NY 2017 talk page, a Strange Loop 2015 talk page, six official Nubank engineering blog posts fetched in full, and the Datomic case study quoting Nubank's CTO
- Confidence: high
- Date of source: 2015–2025 (architecture 2017–2021; scale numbers 2017, 2021, 2025)

## System in three lines
Nubank runs a licensed Brazilian bank — credit cards, checking accounts, savings, transfers, lending — on several hundred to several thousand small Clojure microservices in AWS, with an immutable Datomic database as the store of record, Kafka as the connective tissue, and a real-time double-entry accounting service that is the canonical answer to "how much money is there". The hard part is that the card network gives the authorizer a millisecond-scale window and no permission to be unavailable, while the ledger behind it must never lose or invent a cent and must be able to explain, retroactively, why any balance was ever what it was. Nubank's answer is immutability end to end: an append-only fact database, a replayable log, snapshots instead of databases in the payment data centre, and whole-stack cloning ("scalability units") instead of sharding each database.

## Scale (only if stated)
- 2.6 million customers, 100+ microservices, 100+ engineers, ~20 deploys/day at the time of the QCon SF talk (https://www.infoq.com/presentations/nubank-architecture/)
- 1 million customers reached in roughly 18 months, against a 5-year plan; growth is what forced the sharding project (https://www.infoq.com/presentations/nubank-architectural-decisions)
- 35 million customers, hundreds of microservices, hundreds of engineers, "billions of Kafka messages daily" by the 2021 talk (https://www.infoq.com/presentations/nubank-architectural-decisions)
- 110+ million customers across Brazil, Colombia and Mexico; 4,000+ microservices on Kubernetes; 72 billion Kafka events per day; millions of requests per second; tens of thousands of pods (https://building.nubank.com/managing-cloud-limits/)
- 122+ million customers by August 2025 (https://building.nubank.com/engineering-lessons-from-scaling-million-customers/); 118 million+ in a companion 2025 post (https://building.nubank.com/simplicity-to-scale-systems-and-transform-software-engineering/)
- Scalability unit sizing: "120+ cloud services, databases, Kafka clusters per unit", each unit a complete clone of the stack serving a partition of the customer base (https://www.infoq.com/presentations/nubank-architecture/)
- Authorizer decision time ~1 ms; stand-in rate improved from roughly 1% to under 1 basis point (https://www.infoq.com/presentations/nubank-architecture/)
- Ledger consolidates financially relevant events from 90+ microservices across three products (https://qconnewyork.com/ny2017/ny2017/presentation/building-and-scaling-financial-system-record.html)
- Datomic: "over a dozen independent Datomic databases" at case-study time (https://www.datomic.com/nubanks-story.html); by 2025 multiple transactors run in Kubernetes, each handling a subset of data (https://building.nubank.com/managing-cloud-limits/)
- Balance-cache memory per service instance fell from ~90 GB to ~55 GB after the evergreen cache; peers had previously grown to ~100 GB before dying in GC pauses (https://building.nubank.com/the-evergreen-cache/)
- Deploys: 50+ changes per day, commit to production in under 30 minutes (https://building.nubank.com/working-with-clojure-at-nubank/)
- Brazil's real-time transfer system moves on the order of $100 billion per day, the rail Nubank's transfer flow plugs into (https://www.infoq.com/presentations/nubank-architecture/)
- Avalanche real-time stack: fraud models score a transaction within milliseconds; real-time in-app interaction features gave a 13% improvement in identifying high-risk loan applicants over the batch system (https://building.nubank.com/avalanche-stack-and-real-time-streaming-applications-at-nu/)

## Requirements stated or clearly implied
- Availability target: the card authorizer must answer inside the network's window with no dependency on a cloud database — it runs in a physical data centre with its state in memory, deliberately holding no database there. Nubank chose to be "a network client, not a network server" toward the card brand so it controls concurrency. No published SLA, no region-failover claim; sharding is framed as blast-radius containment ("localized problem containment"), not geographic DR (https://www.infoq.com/presentations/nubank-architecture/, https://building.nubank.com/managing-cloud-limits/).
- Consistency: correctness over consistency, explicitly. The ledger is an append-only immutable fact store with a "strong audit trail" whose data is "always in a valid state and is never corrupted by unexpected distributed systems issues", even when stale; what the system guarantees is "traceability of when, how, and why we were inconsistent" plus conservation of money (https://qconnewyork.com/ny2017/ny2017/presentation/building-and-scaling-financial-system-record.html). Within one Datomic database writes are serialised by a single transactor (https://building.nubank.com/the-evergreen-cache/). Cross-service money movement is not a database transaction: "there is no database transaction here" — transfers use an idempotent settlement service plus compensating transactions (https://www.infoq.com/presentations/nubank-architecture/).
- Latency target: ~1 ms authorization decision; millisecond fraud scoring on the Avalanche stack. No p50/p95/p99 figures are published.
- Ordering needs: per-account ordering matters and is a stated hazard — late-arriving payments produce a different end state ("you don't have a negative late balance, you have a pre-paid balance"), and the interleaving of events "creates a combinatorial explosion" that unit tests cannot cover, so property-based testing is used instead. Kafka gives partitioned ordering; the log is what provides "logical and temporal decoupling" (https://www.infoq.com/presentations/nubank-architecture/).
- Replay or reprocessing needs: first class and used in anger. Kafka offsets can be reset; Datomic transactions can be replayed chronologically with original timestamps when splitting a service into two, and to reconstruct state after a bug (https://www.datomic.com/nubanks-story.html, https://www.infoq.com/presentations/nubank-architectural-decisions). Failed Kafka messages go to a dead-letter topic and are republished by the "mortician" service once fixed.
- Retention: Kafka is described as a persistent log with TTL and offset reset; no TTL values are published. Datomic retains all history by design ("it is like Git for your data. You never lose anything"). S3 snapshots are periodic; interval not stated.
- Compliance / residency: regulated banking in Brazil, Colombia and Mexico. PII is segregated at the storage layer — Datomic databases holding PII sit on Amazon RDS PostgreSQL with EBS volume encryption, non-PII databases on DynamoDB (https://www.datomic.com/nubanks-story.html). Card cryptogram validation and primary key custody are in an HSM. Analysts see cross-shard logical tables through a contract layer rather than raw shard data. Localisation for each country's regulatory context is called out as a persistent architectural challenge (https://building.nubank.com/engineering-lessons-from-scaling-million-customers/).

## Boundaries
- Physical data centre (Brazil) holding the card-brand interface devices, the authorizer fleet and the HSM — deliberately database-free, connected to the cloud only through the Kafka bridge and S3 snapshots.
- AWS cloud: originally CloudFormation + AMI images on EC2, then Docker, then self-managed Kubernetes, then EKS. Multi-account by 2025 — a move away from "Pangeia" (everything in a few accounts) toward "continental drift", one or more AWS accounts per business domain/team, explicitly to reduce blast radius.
- Scalability units (shards): complete clones of the stack — 120+ services, their databases and their own Kafka clusters — each owning a partition of the customer base. A non-sharded **global** layer sits above them holding external-id → customer-id → shard mappings and routing external events.
- Trust zones: card scheme network (Mastercard/Visa) → interface device → authorizer (physical DC) → Kafka bridge → cloud services; Brazilian payments hub (real-time gross settlement) reached over SOAP; analytics environment isolated from the transactional one.
- Named subsystems / bounded contexts: authorization, Kafka messaging backbone, real-time double-entry accounting on Datomic, customer and temporal sharding, analytics/ETL, security (the six subsystems the QCon SF abstract lists). Later business platforms: banking-as-a-service, asset platforms, payment platforms, and a modularised credit card domain (credit limits, billing cycles, transaction processing, debt management, renegotiation).
- Multi-tenant shared Kubernetes clusters and Kafka pools by default, with single-tenant deployments reserved for business-critical workloads needing performance or security isolation (https://building.nubank.com/managing-cloud-limits/).

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Nubank mobile app | Customer client; after login it receives hypermedia links that anchor every subsequent request to the customer's shard | in-house | client | shardAnchoring: hypermedia links returned at credential validation |
| 2 | MasterCard Interface Device (MIP) | Card-brand edge box in Nubank's physical data centre; terminates the scheme's TCP connection | Mastercard Interface Device (also Visa equivalent) | edge-appliance | protocol: ISO-8583 binary over TCP; located in a physical DC, not the cloud |
| 3 | Authorizer | Decides approve/decline on every purchase, in memory, with no database in the path | in-house, Clojure | app-server | decision time ~1 ms; "we are a network client, not a network server"; state = S3 snapshot + Kafka tail; stand-in rate ~1% → <1 bp |
| 4 | ISO-8583 codec | Clojure library parsing the binary scheme protocol; allows runtime protocol fixes | in-house, Clojure | (folded into the authorizer) | protocol spec obtained from Mastercard then corrected against the live test environment |
| 5 | HSM | Holds the primary encryption keys and validates chip transaction cryptograms | Hardware Security Module (vendor not named) | key-management | in the physical data centre alongside the authorizer |
| 6 | Kafka (bridge and backbone) | Immutable log carrying all state mutations between cloud services and into the isolated authorizer infrastructure; also general inter-service async | Apache Kafka | stream | persistent log with TTL, partitioning, offset reset; "immutable log helps us with logical and temporal decoupling"; billions of messages/day (2021) → 72B events/day (2025); multiple clusters, per shard |
| 7 | Snapshot generator | Kafka consumer that periodically writes the authorizer's materialised state to disk and S3 | in-house | worker | second consumer alongside the authorizers; snapshot + checkpoint offset |
| 8 | S3 snapshot store | Holds authorizer state snapshots so a new instance bootstraps from snapshot then tails the log from the checkpoint | Amazon S3 | object-store | bootstrap path: load snapshot → tail Kafka from checkpoint |
| 9 | Double-entry accounting service | The financial system of record: turns financially relevant events into entries, movements, balances and a customer balance sheet | in-house, Clojure on Datomic | ledger | doubleEntry: true; appendOnly: true; consolidates events from 90+ microservices across three products; "canonical" numbers for customers, ops, analysts and regulators; conservation of money monitored |
| 10 | Datomic transactor | Single writer per database: serialises transactions, validates, persists | Datomic | sql-database | one transactor process per database; multiple transactors run in Kubernetes by 2025, each handling a subset of data; single-write bottleneck acknowledged |
| 11 | Datomic storage (non-PII) | Durable storage service behind the transactor for services without personal data | Amazon DynamoDB | nosql-database | chosen for operational simplicity |
| 12 | Datomic storage (PII) | Durable storage behind the transactor for databases holding personally identifying information | Amazon RDS PostgreSQL | sql-database | EBS volume encryption; PII/non-PII split is the selection rule |
| 13 | Datomic peer | Read/query engine embedded in each microservice instance, with an in-memory cache loaded from storage | Datomic peer library | cache | grew to ~100 GB per instance and died in GC pauses before the cache redesign; "any service instance could handle requests", forcing redundant loading |
| 14 | Evergreen balance cache | Read-through immutable cache of computed balances so peers stop materialising the whole event history | in-house on DynamoDB | cache | key: `account-id/event-counter-value`; `event-counter` attribute incremented per account transaction; never invalidated (new counter = new key); memory 90 GB → 55 GB |
| 15 | Clojure microservices | Several hundred (2021) to 4,000+ (2025) small hexagonal-architecture services, the body of the bank | in-house, Clojure + Finagle, Thrift/HTTP RPC | app-server | hexagonal architecture; EDN declarative deployment config; 50+ deploys/day, commit to prod < 30 min; consumer-driven contract testing replaced hour-long e2e suites |
| 16 | Scalability unit (shard) | A full clone of the stack — services, databases and Kafka clusters — owning a partition of the customer base | in-house pattern | (boundary, not a box) | 120+ services, databases and Kafka clusters per unit; introduced 2016 |
| 17 | Global routing service | Non-sharded service holding external-id → customer-id → shard mappings; routes externally originated events to the owning shard | in-house | app-server | required before any customer can live on a second shard; also consumes transfers from every shard |
| 18 | Mortician (dead-letter service) | Receives the original message plus error metadata from failed consumption, supports offline triage and republish after a fix | in-house ("mortician") | queue | dead-letter topic per failure; "data loss is the worst thing that can happen" |
| 19 | Settlement service | Idempotent service that consumes transfers from all shards via the global service and settles them | in-house | app-server | idempotent by design; no database transaction spans the flow |
| 20 | Brazilian payments hub | External real-time gross settlement rail for transfers to other banks | Brazil's real-time payment system (SOAP interface) | third-party-api | ~$100B/day nationally |
| 21 | Kubernetes / EKS | Container orchestration for essentially everything in the cloud; replaced EC2+AMI then Docker-on-EC2 | Kubernetes, later Amazon EKS | container-orchestrator | year-long migration; tens of thousands of pods; shared multi-tenant clusters with single-tenant exceptions |
| 22 | Datomic log tailer → data lake | Streams Datomic's transaction log (plus selected Kafka topics) into the lake, chunked and format-converted | in-house | change-data-capture | replaces classic ETL extraction; transactional and analytical use cases kept isolated |
| 23 | Analytics contract layer | Restores logical, cross-shard tables so analysts never see shard boundaries | in-house | data-catalog | shard-transparent logical tables |
| 24 | ETL / analytics cluster | Scala + Spark jobs querying across every shard's Datomic, parallelised as Datalog queries fanned over cluster nodes into RDDs | Apache Spark, Scala, Mesos (later Databricks) | big-data-cluster | batch chosen over streaming because Kafka Streams was immature at the time; also used to check distributed-transaction consistency |
| 25 | ML / decisioning pipeline | DAG of models and policy functions (e.g. risk score → credit-limit increase) fed by the lake | in-house | ml-platform | example output: contribution margin per customer per day, from ledger revenue plus ERP cost |
| 26 | Avalanche real-time stack | Streaming enrichment and real-time analytical serving for fraud and risk | Apache Flink on Kubernetes, Apache Kafka, Apache Pinot | stream-processor (+ data-warehouse for Pinot) | event-time windowing, stateful processing, real-time joins; fraud scoring in milliseconds; "Autopilot" recalibrates thresholds |
| 27 | Prometheus + Grafana | Metrics, alerting and canary-deploy signals, wired to Opsgenie, Slack and CI/CD | Prometheus, Grafana, Opsgenie | monitoring | introduced in the 2017–2018 consolidation phase |
| 28 | Splunk with correlation IDs | Log aggregation; a tree-structured correlation ID follows a request across HTTP and Kafka hops, and Datomic transaction metadata pins database writes to the same tree | Splunk | monitoring | correlation-ID tree spanning sync and async hops |
| 29 | AWS Limit Smoke Detector | In-house ETL collecting usage, quota and cost from every AWS account and alerting before a limit is hit | in-house ETL + BigQuery, Trusted Advisor, Service Quotas, CloudWatch | monitoring | aggregates "usage, quota, and cost data from every Nubank AWS account" in BigQuery |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| merchant terminal / acquirer | card network (Mastercard, Visa) | scheme | sync | | outside Nubank |
| card network | mastercard-interface-device | ISO-8583 over TCP | sync | | the scheme's own timeout bounds the whole path |
| mastercard-interface-device | authorizer | ISO-8583 over TCP | sync | | authorizer is the network **client**, so it controls concurrency |
| authorizer | hsm | HSM protocol (not stated) | sync | | chip cryptogram validation, primary key custody |
| authorizer | (decision) → mastercard-interface-device | ISO-8583 | sync | | ~1 ms; no database consulted in this path |
| s3-snapshot-store | authorizer | S3 GET | sync (at boot) | | instance bootstraps from the latest snapshot |
| kafka | authorizer | kafka consume | async | replayable from checkpoint | authorizer tails the log from the snapshot's checkpoint offset to catch up |
| kafka | snapshot-generator | kafka consume | async | | second consumer of the same log |
| snapshot-generator | s3-snapshot-store | S3 PUT | async | | periodic; interval not stated |
| authorizer | kafka | kafka produce | async | | authorization outcomes flow back into the cloud as events |
| clojure-microservices | kafka | kafka produce | async | persistent log, offset reset available | "high throughput jobs and inter-service communication" |
| kafka | clojure-microservices | kafka consume | async | at-least-once with consumer offsets | partitioned ordering; circuit-breaker trip converts downstream failure into consumer lag rather than message loss |
| clojure-microservices | mortician (dead-letter topic) | kafka produce | async | | original message + error metadata; republished after the fix |
| clojure-microservice | clojure-microservice | Thrift / HTTP RPC over Finagle | sync | | hexagonal ports/adapters; consumer-driven contract tests guard the boundary |
| clojure-microservice | datomic-peer (in-process) | library call | sync | | query runs inside the service instance |
| datomic-peer | datomic-storage (DynamoDB / RDS PostgreSQL) | storage protocol | sync | | peers preemptively load segments into memory |
| clojure-microservice | datomic-transactor | Datomic transact | sync | ACID, serialised by the single transactor | one writer per database |
| datomic-transactor | datomic-storage | storage write | sync | durable | DynamoDB for non-PII, RDS PostgreSQL (EBS-encrypted) for PII |
| balance service | evergreen-balance-cache (DynamoDB) | read-through get | sync | | key `account-id/event-counter`; counter read from Datomic first, so Datomic stays the source of truth |
| financially relevant events | double-entry-accounting-service | kafka consume | async | | entries + movements derived from events published by 90+ services |
| double-entry-accounting-service | datomic (ledger database) | Datomic transact | sync | append-only, full audit trail | balances = cumulative sum of debits and credits per book account |
| mobile app | global routing service (login) | https | sync | | credential validation returns hypermedia links bound to the customer's shard |
| external event (purchase, payment) | global routing service | https / kafka | sync/async | | external-id → customer-id → shard lookup, then dispatch into the owning unit |
| global routing service | scalability unit services | https / kafka | sync/async | | every shard-bound request goes through the mapping first |
| transfer flow: app | investment/savings service | https | sync | | liquidate the customer's invested balance, then confirm funds |
| transfer flow: shard services | global routing service | kafka | async | | global service consumes transfers from every shard |
| global routing service | settlement service | kafka | async | idempotent consumer | idempotency is the guarantee, not a distributed transaction |
| settlement service | double-entry-accounting-service | kafka (event observation) | async | | ledger observes settlement events and posts debits/credits |
| settlement service | destination shard **or** brazilian payments hub | kafka / SOAP | async / sync | | internal transfers stay in-platform; external ones go to the RTGS hub |
| settlement service | investment/savings service (compensation) | kafka | async | | compensating transaction re-invests the funds if the transfer fails |
| datomic transaction log | log tailer → data lake | log tail | async | | chunked and format-converted on the way in |
| kafka | data lake | kafka consume | async | | for data that never lands in Datomic |
| data lake | spark/scala etl cluster | batch read | async | | Datalog queries sharded across Spark nodes into RDDs |
| spark/scala etl cluster | analytics contract layer | batch | async | | reassembles logical tables across shards |
| analytics contract layer | bi tools (Databricks, Looker) / ml pipeline | sql / batch | async | | contribution margin per customer per day; risk score → credit-limit policy |
| kafka | flink (avalanche) | kafka consume | async | | event-time windowing, stateful joins, feature enrichment |
| flink (avalanche) | pinot | ingest | async | | real-time OLAP serving for in-app and fraud queries |
| pinot | fraud models / product services | query | sync | | scoring within milliseconds |
| clojure-microservices | prometheus | http scrape | async | | alerts into Opsgenie and Slack, gates canary deploys |
| clojure-microservices + datomic | splunk | log shipping | async | | tree-structured correlation ID spans HTTP and Kafka; Datomic tx metadata joins writes to the tree |
| every aws account | aws limit smoke detector → BigQuery | etl | async | | quota, usage and cost aggregation with pre-threshold alerts |

## Failure modes, incidents, tradeoffs the source discusses
- **No database in the payment data centre, on purpose.** The authorizer keeps its state in memory, hydrated from an S3 snapshot and then the Kafka tail, precisely so the authorization path cannot be taken down by a cloud database. The Kafka bridge exists to "decouple isolated physical authorizer infrastructure from cloud-based ultimate data sources". https://www.infoq.com/presentations/nubank-architecture/
- **Being the network client, not the server, was the concurrency decision.** "We are a network client, not a network server" — it let them process authorizations concurrently without a database dependency during the transaction. Same URL.
- **Event interleaving is the ledger's real enemy, and unit tests cannot cover it.** "Given that the interleaving of events creates a combinatorial explosion, you cannot write unit tests that capture the entire space" — hence property-based testing. A late-arriving payment produces a different end state: "you don't have a negative late balance. You have a pre-paid balance." Same URL.
- **Correctness over consistency, with inconsistency made auditable.** The system of record aims not at never being inconsistent but at "traceability of when, how, and why we were inconsistent", with conservation of money enforced by monitoring on an append-only store that is "always in a valid state and is never corrupted by unexpected distributed systems issues". https://qconnewyork.com/ny2017/ny2017/presentation/building-and-scaling-financial-system-record.html
- **The missing customer id — the CTO's headline regret.** "If every transaction had an identifier that could point to the actual customer that owns that data, things like splitting databases for sharding would have been much, much easier." Sharding a database whose facts do not say whose they are is the expensive version of the problem. https://www.infoq.com/presentations/nubank-architecture/
- **Datomic used as the default for everything it should not have been.** Fire-hose writes, long strings and specialised stores all went into Datomic; S3 or other stores should have been considered earlier. Same URL.
- **Event sourcing arrived too late.** "Event sourcing a little bit earlier" would have preserved upstream request data that was lost before the database write, because Kafka was initially treated as an ephemeral queue rather than a persistent stream. Same URL.
- **Scalability units are harder to roll out incrementally than per-database sharding.** "If you go to the scalability units route versus sharding each database route, it is harder to roll out incrementally" — the entire routing layer must exist before the first customer can be placed on a second shard. Same URL.
- **The first shard became the permanent canary.** Customer growth outran shard sizing: the first shard "got too long with customers that were too old… still does sometimes", so it serves as the canary for performance problems; every shard also carries a minimum infrastructure cost. The sharding project itself ran over a year. https://www.infoq.com/presentations/nubank-architectural-decisions
- **Sharding eventually hit physical limits.** Sharding was introduced in 2016 and, a decade on, "eventually hit physical limits"; AWS capacity constraints became a first-order architectural concern. https://building.nubank.com/engineering-lessons-from-scaling-million-customers/, https://building.nubank.com/managing-cloud-limits/
- **The peer cache nearly ate the service.** Event-sourced balances meant Datomic peers loaded the whole account history; memory reached ~100 GB per instance and instances died in garbage-collection pauses, and because any instance could serve any request the same data was loaded redundantly everywhere. The fix was an immutable read-through cache keyed by `account-id` plus a per-account `event-counter`, so a new fact simply produces a new key and nothing is ever invalidated — 90 GB down to 55 GB, with Datomic still the source of truth. https://building.nubank.com/the-evergreen-cache/
- **Dead-lettering because losing a financial message is unacceptable.** "Data loss is the worst thing that can happen" — failed consumption forwards the original message plus error metadata to a dead-letter topic, and the "mortician" service supports offline triage and republish. https://www.infoq.com/presentations/nubank-architecture/
- **Circuit breakers turn downstream failure into lag, not loss.** When outbound calls fail the breaker trips, the consumer pauses, and the exceptions become accumulated lag on the Kafka topic until the issue is fixed. Same URL.
- **Money movement without distributed transactions.** For transfers, "there is no database transaction here": invested funds are liquidated, the transfer is initiated, an idempotent settlement service consumes from all shards, the ledger observes the events, and a compensating transaction re-invests if it fails. Same URL.
- **The scheme protocol did not match its documentation.** Deploying the authorizer into Mastercard's test environment early revealed that real encodings differed from the spec (mainframe string encoding among them); the Clojure codec was designed so the parser could be fixed at runtime, and card volume was ramped incrementally before migrating customers. Same URL.
- **Vendor dependence cost 18+ months.** The third-party credit-card processor became the growth bottleneck and had to be brought in-house over 18+ months; vendor dependency is named as a persistent risk. https://www.infoq.com/presentations/nubank-architectural-decisions
- **Three infrastructure migrations because managed services arrived late.** CloudFormation/EC2 → Docker → self-managed Kubernetes → EKS: "if we were starting today, we'd use EKS immediately". Running two infrastructures in parallel drove AWS limit and cost overruns. Same URL.
- **Batch ETL was chosen because streaming was not ready.** Spark/Scala batch was picked over Kafka Streams on maturity grounds, and the speaker acknowledges streaming would be the choice today. Same URL; the Avalanche stack (Flink + Pinot) is that later correction. https://building.nubank.com/avalanche-stack-and-real-time-streaming-applications-at-nu/
- **0.1% edge cases stop being edge cases.** At scale a 0.1% failure class hits thousands of customers at once — the trigger for the reliability-and-observability consolidation phase. https://www.infoq.com/presentations/nubank-architectural-decisions
- **Abstractions are expensive to get wrong.** "The cost to rebuild an abstraction is very high" — domain platforms (banking-as-a-service, payments, the modularised credit card) took long design debates precisely because of it. Same URL.
- **Blast radius drove the account split.** Moving from "Pangeia" (a few large AWS accounts) to per-domain accounts was justified by reduced blast radius, independent domain evolution and granular isolation; per-shard Kafka clusters and per-subset Datomic transactors serve the same "localized problem containment" goal. https://building.nubank.com/managing-cloud-limits/
- **Decoupling had to be argued for.** "It is easy to justify those sorts of investments when you have a long-term vision for where you need to get to, cutting the corner does not make sense in that context." https://www.infoq.com/presentations/nubank-architecture/
- **Immutability is the thesis, stated plainly.** "It is like Git for your data. You never lose anything, you made a fact true, and then later not true," and from the CTO: "I didn't find a better option than Datomic with this first class concept of time. For me, that makes all of the difference." https://www.infoq.com/presentations/nubank-architecture/, https://www.datomic.com/nubanks-story.html

## Unknowns
- Region and availability-zone topology. The sources name AWS, physical data centres for the authorizer, and three countries, but never regions, AZ spread, or whether a scalability unit is region-pinned.
- Whether there is any cross-region or cross-cloud failover for the cloud side. Sharding is described as containment, never as DR.
- Kafka retention/TTL values, partition counts, replication factor, and the snapshot interval for the authorizer.
- How many scalability units exist today, how large one is in customers, and the sharding key beyond "customer" and "temporal" (the QCon abstract says "customer and temporal sharding" without defining the temporal axis).
- How a customer is migrated between shards, or whether that is even supported.
- Current Datomic database count: "over a dozen" in the case study versus a secondary claim of 3,000+ in 2025; no official post states the number.
- The RPC transport of record today. Finagle and Thrift are named in 2017–2019 material; the later posts say only "microservices" and do not say whether Thrift, gRPC or HTTP dominates now, nor whether a service mesh exists.
- Authentication and session handling at the edge. Login is said to return shard-anchoring hypermedia links, but no gateway, auth service, token format or rate-limiting component is named anywhere in the fetched sources.
- HSM vendor and model; the exact scheme interface for Visa versus Mastercard.
- Whether the Brazilian payments hub referenced in 2017 is the pre-Pix rail or has since been replaced by Pix in this flow; the 2025 posts mention Pix only as market context.
- Consistency guarantees between the double-entry ledger's Datomic database and the operational databases of the services whose events it consumes — the sources say the ledger may be stale but valid, without quantifying the lag.
- No incident postmortem is published. Every failure mode above is a designed-for hazard or a retrospective regret, not a dated outage.

## Candidates
- New kinds:
  - `immutable-fact-database (new)` — Datomic does not fit `sql-database` or `nosql-database` cleanly: writes are serialised through a single **transactor**, storage is a separate service (DynamoDB or RDS), and queries run in-process in **peers** with their own memory cache. The unbundling is the architectural fact worth modelling, and the same shape appears in any "database as a value" design.
  - Otherwise nothing new is needed: `ledger`, `stream`, `queue`, `object-store`, `cache`, `edge-appliance`, `key-management`, `change-data-capture`, `big-data-cluster`, `stream-processor`, `ml-platform`, `data-catalog`, `container-orchestrator` and `third-party-api` all fit.
- New properties on existing kinds:
  - `ledger.systemOfRecord` (boolean) and `ledger.derivedFromEvents` (boolean) — the ledger is a projection of events from 90+ services, not the primary write path
  - `ledger.conservationMonitored` (boolean) — money conservation checked by monitoring rather than by transactions
  - `stream.offsetResetSupported` (boolean) and `stream.usedAsSourceOfTruth` (boolean) — Kafka-as-ephemeral-queue versus Kafka-as-persistent-stream is the stated regret
  - `queue.deadLetterTriage` (manual | automatic) — the mortician pattern is manual republish after a fix
  - `cache.keyIncludesVersionCounter` (boolean) and `cache.invalidation` (none | ttl | explicit) — the evergreen cache never invalidates because the key carries the event counter
  - `app-server.embeddedQueryPeer` (boolean) and `app-server.peerMemoryGb` (integer) — an in-process database peer makes service memory a database property
  - `sql-database.singleWriter` (boolean) / `.writerProcesses` (integer) — the transactor bottleneck
  - `sql-database.storageBackend` (string) — Datomic's storage is a separate managed service
  - `*.piiTier` (pii | non-pii) on data kinds — Nubank selects the storage backend by whether the database holds PII
  - `app-server.stateBootstrap` (snapshot-plus-log | database | none) and `.snapshotStore` (component ref) — the authorizer's whole availability argument
  - `app-server.networkRole` (client | server) — being the client toward the card scheme is a deliberate concurrency control
- New requirement paths:
  - `sharding.unit` (database | scalability-unit) and `sharding.routingService` (component ref) — cloning the whole stack is a different requirement from sharding a database, and it demands a global routing layer
  - `sharding.globalNonShardedServices` (list) — what must stay outside the shards
  - `consistency.model` = `correct-but-eventually-consistent` with `consistency.auditable` (boolean)
  - `compliance.piiStorageSeparation` (boolean)
  - `availability.databaseFreePath` (list of components) — paths that must survive with no database dependency
- New rules (name + one-line condition):
  - `sharded-stack-without-global-router`: more than one scalability unit declared and no non-sharded routing/mapping service resolving external id → shard
  - `ledger-event-without-entity-owner`: a `ledger` or immutable-fact database fed by events whose schema declares no owning-customer/tenant identifier (the CTO's stated regret — it makes later sharding brutal)
  - `stream-as-queue-but-source-of-truth`: a `stream` whose retention is finite while a downstream component declares `stateBootstrap: snapshot-plus-log` against it
  - `snapshot-bootstrap-without-snapshot-store`: an app-server declaring snapshot-plus-log bootstrap with no object-store edge
  - `financial-consumer-without-deadletter`: an async edge into a `ledger` or accounting service whose queue/stream declares no dead-letter path
  - `distributed-money-move-without-idempotency`: a money-moving edge crossing a shard or service boundary with no idempotent consumer and no compensating-transaction edge declared
  - `embedded-peer-unbounded-cache`: an app-server with `embeddedQueryPeer: true` serving an event-sourced aggregate and no versioned read-through cache between it and the store
  - `pii-and-nonpii-same-store`: data components of mixed `piiTier` sharing one storage backend in a design tagged regulated/financial
  - `payment-path-depends-on-remote-database`: a sync edge from a component inside a latency-bounded scheme path to a database outside its own failure domain
  - `batch-only-analytics-on-realtime-requirement`: a fraud/risk requirement with a millisecond latency target served only by a `big-data-cluster` batch path with no `stream-processor`

## Verification 2026-09-14

Spot check of two primary sources (the card was written 2026-09-07; re-checked 2026-09-14).

| URL | Reachable | Outcome |
|---|---|---|
| https://www.infoq.com/presentations/nubank-architecture/ | yes | Confirmed verbatim: speakers Edward Wible and Rafael Ferreira; "we are at 2.6 million customers"; "100 microservices" and "deploy 20 times per day"; "120-plus services living on a cloud, their databases, Kafka clusters, Zookeeper clusters"; "we are a network client, not a network server"; the dead-letter service called "mortician for obvious reasons"; "there is no database transaction here, because people are different shards"; the HSM for cryptogram validation; the MasterCard Interface Device as the TCP edge box; "around $100 billion is transferred per day"; stand-in "one percent ... to below one basis point". |
| https://building.nubank.com/the-evergreen-cache/ | yes | Confirmed verbatim: "Datomic unbundles the jobs of writing, storing, and querying data"; peers reaching roughly 100GB before GC-pause failures; the cache key of account id plus an `event-counter` that increments per account transaction, so nothing is ever invalidated; "each instance of our service required 90GB of RAM, but now they need only 55GB"; "We decided to use DynamoDB"; Datomic queried first for the counter, so it stays the source of truth. |

Facts the card states that could **not** be confirmed in the fetched pages, and what was done with them:

- **Authorizer decision time ~1 ms.** Not present in the InfoQ transcript. Dropped: the design declares no `latency` requirement and no `latencyP95Ms` on the authorizer.
- **"A single transactor per database serialises writes".** The evergreen-cache post describes the transactor's role but never states one writer per database in those words. Kept only as `multiWriter: false` / `commitProtocol: "single"` on `datomic-transactor`, and marked assumed in notes.md.
- **"S3 snapshot plus Kafka tail" as a phrase.** The snapshot-then-catch-up bootstrap is described in the talk, but not in that wording. The mechanism is encoded; the phrase is quoted nowhere.

The other primary sources were not re-fetched in this pass (the card lists them as fetched in full on 2026-09-07); nothing in the design rests on a source found unreachable.
