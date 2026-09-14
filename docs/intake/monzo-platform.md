# Intake: Monzo banking platform (thousands of Go microservices on Kubernetes)

## Source
- Primary: https://monzo.com/blog/2016/09/19/building-a-modern-bank-backend (Monzo platform engineering, official engineering blog, 2016) — the founding architecture: Kubernetes, Docker, linkerd, Kafka, etcd
- Primary: https://www.infoq.com/presentations/monzo-microservices/ (write-up of "Modern Banking in 1500 Microservices", Matt Heath — platform & payments engineer — and Suhail Patel — core platform engineer, QCon London 2020)
- Primary: https://www.infoq.com/presentations/banking-thousands-microservices-2023/ (write-up of "Banking on Thousands of Microservices", Suhail Patel, Staff Engineer Platform Group, QCon London 2023)
- Primary: https://www.infoq.com/presentations/monzo-microservices-arch/ (write-up of "Scaling for the Known Unknown", Suhail Patel, Monzo backend engineer, QCon London 2019)
- Primary: https://monzo.com/blog/2019/09/08/why-monzo-wasnt-working-on-july-29th (Monzo engineering, official incident debrief of the 29 July 2019 Cassandra outage, 2019)
- Primary: https://monzo.com/blog/we-built-network-isolation-for-1-500-services (Monzo security engineering, 2019) — Calico network policies, rpcmap
- Primary: https://monzo.com/blog/2019/04/03/deploying-envoy-proxy (Monzo platform engineering, 2019) — linkerd to Envoy migration
- Primary: https://monzo.com/blog/how-we-built-a-queue-on-top-of-kafka (Monzo engineering, 2024) — NSQ to Kafka queue semantics, deadlettering
- Primary: https://monzo.com/blog/tolerating-full-cloud-outages-with-monzo-stand-in (Monzo engineering, 2024/2025) — Monzo Stand-in on GCP
- Primary: https://monzo.com/blog/controlling-outbound-traffic-from-kubernetes (Monzo security/platform engineering) — Envoy egress gateways, Egress Operator
- Primary: https://monzo.com/blog/2020/10/19/autoscaling-monzo (Monzo platform engineering, 2020) — VPA/HPA, what runs outside Kubernetes
- Primary: https://monzo.com/blog/2019/01/14/crowdfunding-technology-backend-architecture (Monzo engineering, 2019) — singleton services, NSQ, etcd watermarks
- Primary: https://monzo.com/blog/2018/04/05/how-monzo-to-monzo-payments-work (Monzo engineering, 2018) — p2p-payments service and ledger
- Primary: https://monzo.com/blog/2021/10/14/an-introduction-to-monzos-data-stack (Monzo data platform, 2021) — firehose to BigQuery
- Secondary: https://www.theregister.com/2020/03/09/monzo_microservices/ (press write-up of the QCon 2020 talk, 1,600 services)
- Verified by: official Monzo engineering blog (11 posts fetched in full) + three InfoQ write-ups of QCon London talks given by Monzo engineers (2019, 2020, 2023)
- Confidence: high
- Date of source: 2016–2025 (architecture 2016–2024; scale numbers 2019, 2020, 2023; Stand-in 2024–2025)

## System in three lines
A licensed UK retail bank whose entire backend is roughly 2,500 small Go microservices on Kubernetes in AWS, storing state in a shared Apache Cassandra cluster and moving asynchronous work over NSQ and Kafka, with Envoy sidecars as the RPC mesh. A single card payment fans out across ~80 services and must authorise inside the card scheme's timeout while the ledger stays correct. Hard because it is a regulated bank built on eventually-consistent infrastructure, run by 300+ engineers shipping hundreds of deploys a day, where the blast radius of one shared cluster is the whole bank.

## Scale (only if stated)
- Customers: 7 million, ~2,500 microservices, 300+ engineers (https://www.infoq.com/presentations/banking-thousands-microservices-2023/)
- Earlier points on the curve: ~100 services at beta and ~150 shortly after, with 3 backend developers (https://monzo.com/blog/2016/09/19/building-a-modern-bank-backend); 1.5M customers and 900+ services in 2019 (https://www.infoq.com/presentations/monzo-microservices-arch/); 4M customers and 1,500–1,600 services in 2020 (https://www.infoq.com/presentations/monzo-microservices/)
- Service graph: 1,500 services with 9,300+ unique inter-service connections (https://monzo.com/blog/we-built-network-isolation-for-1-500-services)
- Per-request fan-out: one card payment touches ~80 microservices directly or indirectly (https://www.infoq.com/presentations/monzo-microservices-arch/); an app request through the edge hits "sometimes more than 20" services (https://monzo.com/blog/2019/04/03/deploying-envoy-proxy)
- Cassandra: 21 servers, replication factor 3, quorum reads and writes in 2019 (https://monzo.com/blog/2019/09/08/why-monzo-wasnt-working-on-july-29th); RF still 3 in 2023 (https://www.infoq.com/presentations/banking-thousands-microservices-2023/)
- Messaging: NSQ "billions of messages daily" (https://www.infoq.com/presentations/monzo-microservices-arch/); 400+ services consuming 2,500+ Kafka topics through the queue library (https://monzo.com/blog/how-we-built-a-queue-on-top-of-kafka)
- Mesh: load test at 15,000 requests/second comparing linkerd and Envoy; "thousands of copies of Envoy across our infrastructure" (https://monzo.com/blog/2019/04/03/deploying-envoy-proxy)
- Observability: Prometheus 800,000 samples/second in 2019 (https://www.infoq.com/presentations/monzo-microservices-arch/), 25M+ metric samples scraped in 2023 (https://www.infoq.com/presentations/banking-thousands-microservices-2023/)
- Deploys: 70–80 production deploys per day in 2019, hundreds daily by 2023 (same two talks)
- Baseline app traffic: 10–20 app launches per second, load tested to 1,000/second (https://www.infoq.com/presentations/monzo-microservices-arch/)
- Data platform: dbt with 4,700+ models and ~600k lines of SQL (https://monzo.com/blog/2021/10/14/an-introduction-to-monzos-data-stack)
- Monzo Stand-in: 18 microservices against the Primary Platform's ~3,000, at ~1% of Primary opex (https://monzo.com/blog/tolerating-full-cloud-outages-with-monzo-stand-in)

## Requirements stated or clearly implied
- Availability target: 24x7 banking; "systems that must be available 24x7, scalable to hundreds of millions of customers" (2016 post). Cross-cloud last-resort continuity via Monzo Stand-in on a different cloud provider; no multi-region claim for the Primary Platform is made in the sources.
- Consistency: eventual, by choice. Cassandra with tunable consistency and quorum reads/writes replaces strict ACID; canonical-table plus index-table patterns are used instead of transactions. Patel: "financial networks already deal with this" — offline card transactions settle days later. Stand-in replication is explicitly "eventually consistent" because synchronous writes would reduce availability.
- Latency target: card authorisation must complete inside the scheme's window; "end-to-end payment processing takes less than a second" (2016 post). p99 latency at the edge was the explicit metric that drove the linkerd-to-Envoy migration; no numeric SLO is published.
- Ordering needs: deliberately abandoned for the general queue. "Monzo has very few use cases where ordering actually matters" — dropping ordering is what made deadlettering and concurrent per-partition consumption possible. Kafka is described as the ordered option and NSQ as the unordered/event-publishing option in the data-stack material.
- Replay or reprocessing: yes, first class. Kafka chosen in 2016 as a "replicated commit log" so consumers can replay; the queue library has deadletter topics per consumer group with a CLI to replay via a retry topic or discard; the 2019 outage was repaired by replaying externally-stored events.
- Retention: not stated for Kafka or Cassandra. Data-warehouse models refresh nightly, some tables every 15 minutes.
- Compliance / residency: UK banking licence; Strong Customer Authentication services added for EU legislation in September 2019; card PANs are tokenised and exchanged encrypted between Primary and Stand-in; PII is sanitised by the analytics loaders before data reaches BigQuery. Cassandra keyspace isolation per service is described as a security control, not just a naming convention.

## Boundaries
- Clouds: Primary Platform on AWS; Monzo Stand-in on Google Cloud Platform, with independent Kubernetes clusters, databases, queueing and locking. "Services in the Stand-in Platform don't ever run in the Primary Platform, or vice-versa, even for behaviours that are common across both like processing a card payment."
- Regions / zones: not stated. Sources say AWS "with minimal on-premise data centers"; no region or AZ topology is published.
- Trust zones: public internet (mobile apps) -> AWS load balancer -> public edge; a separate **internal edge** for staff and customer-operations tooling; the Kubernetes pod network, where every service-to-service call is denied by default and allowed only by a Calico NetworkPolicy; egress gateways as the only route out to third parties; card scheme and payment-scheme networks outside all of it.
- Named subsystems / bounded contexts: edge, internal edge, account service, ledger service, p2p-payments, fraud and financial crime, Strong Customer Authentication, notification/feed services, the crowdfunding singletons, the data "firehose" and warehouse, Monzo Stand-in.
- Isolation units: one Cassandra **keyspace per microservice** inside one shared cluster (the shared cluster is the stated regret); one Kubernetes namespace-level NetworkPolicy per service; one deadletter topic per consumer group.

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Monzo app | iOS/Android client; polls both platforms and switches to a simplified UI when Stand-in is active | in-house native apps | client | pollsBothPlatforms: true; degradedUi: true |
| 2 | AWS load balancer | Public entry point in front of the edge | AWS Application Load Balancer | load-balancer | held connections 6–7s during traffic spikes, forcing gradual ramp-up |
| 3 | edge | Public API layer; terminates app requests and fans out to "sometimes more than 20" microservices | in-house | api-gateway | fanOut: 20+; p99 latency is the tracked metric |
| 4 | internal edge | Separate API layer routing staff and customer-operations tooling | in-house | api-gateway | returned HTTP 404s during the 2019 outage |
| 5 | Envoy sidecar (was linkerd daemonset) | RPC mesh: service discovery, load balancing, failure detection, per-service metrics; one Envoy per service pod | Envoy (previously linkerd 1.0 on Finagle, daemonset, P2C + Peak EWMA) | service-mesh | deployment: sidecar (was daemonset); at 15k rps lower p99 at "less than half the CPU" vs linkerd; thousands of instances |
| 6 | Kubernetes | Cluster manager for essentially everything stateless; replaced Mesos + Marathon in 2016 | Kubernetes (on CoreOS originally, on AWS) | container-orchestrator | since v1.2; "infrastructure costs about a quarter of what it did before" after the Mesos migration |
| 7 | Vertical / Horizontal Pod Autoscaler | Right-sizes requests and replica counts per service | Kubernetes VPA and HPA | container-orchestrator (property) | default new service: Vertical mode, 3 replicas; HPA target 70% CPU; history from Prometheus |
| 8 | etcd | Distributed locking and Kubernetes' own consistent store; fronted by a lock service | etcd | coordination-service | also used for periodic watermark flushes by singleton services |
| 9 | Go microservices | ~2,500 tightly-scoped services; ~500–1000 lines of actual business logic each, generated from Protocol Buffers | in-house, Go | app-server | count: ~2500; stateless: true; standardised dao/handler/consumer layout; one team owner per service |
| 10 | ledger service | "Singular entity responsible for tracking all money movements" across currencies and environments | in-house | ledger | single logical ledger; debit sender / credit recipient in one operation for Monzo-to-Monzo |
| 11 | account service | Abstraction over every account type on the platform; looked up to decide payment route | in-house | app-server | |
| 12 | p2p-payments service | Monzo-to-Monzo transfers; `POST /p2p-payments/create_transfer` with from, to, amount in pence, description | in-house | app-server | sync ledger move for current-account pairs; async batch payout for prepaid accounts |
| 13 | Strong Customer Authentication services | Granular SCA checks added for EU legislation, behind "a strict API boundary for validation" | in-house | policy-engine | added September 2019; not invoked on every transaction |
| 14 | fraud / financial crime services | Real-time transaction screening in the authorisation path | in-house | app-server | conditional: "not every service gets involved in every invocation on every transaction" |
| 15 | Cassandra | The shared primary datastore; masterless, horizontally scalable, tunable consistency; one keyspace per microservice | Apache Cassandra (runs outside Kubernetes) | nosql-database | nodes: 21 (2019); replicationFactor: 3; consistency: quorum (2 of 3); partition key decides the three owning servers; keyspace isolation as a security control; chunk size tuned 64KB -> 4KB |
| 16 | NSQ | Unordered async messaging and event publishing; the original queue | NSQ | queue | billions of messages daily; no message durability |
| 17 | Kafka | Durable replicated commit log; ordered queuing, event streaming, replay | Apache Kafka | stream | "replicated commit log"; at-least-once with consumer cursors rather than per-consumer queues |
| 18 | Kafka queue library | Gives NSQ-style queue semantics on Kafka: deadlettering, retries, concurrent consumption inside a partition | in-house Go library | queue | maxAttempts then per-consumer-group deadletter topic; retry topic; CLI replay or discard; UnorderedOffsetManager committable watermark; max runaway limit; 400+ services, 2,500+ topics consumed; ordering explicitly dropped |
| 19 | Prometheus + Grafana | Metrics and dashboards; every service gets HTTP, Cassandra and lock metrics for free | Prometheus, Grafana | monitoring | 800k samples/s (2019) -> 25M+ samples scraped (2023) |
| 20 | Jaeger / OpenTelemetry | Distributed tracing; trace ID and context propagated by the shared RPC layer across service boundaries | Jaeger, OpenTracing/OpenTelemetry | monitoring | hundreds of thousands of spans |
| 21 | Elastic Stack | Log aggregation across the fleet | Elasticsearch (ELK) | search-index | |
| 22 | Shipper | Bespoke deploy tool: rolling Kubernetes deployments, Cassandra schema migrations, rollback | in-house ("Shipper") | ci-pipeline | "build and roll out changes in minutes using a single command"; also the name of an analytics event loader |
| 23 | Calico NetworkPolicy + rpcmap | Default-deny service-to-service network isolation; rpcmap statically analyses Go code on every push and generates per-callee rule files | Calico, Kubernetes NetworkPolicy, rpcmap, kube-iptables-tailer, calico-accountant | policy-engine | 1,500 services, 9,300+ allowed edges; average service reaches ~6 others instead of 1,500; labels `monzo.com/egress-s-<service>`, `monzo.com/routing-name`, `service-type`; one month in log-only mode before dropping packets |
| 24 | Egress gateways | The only way out of the cluster: dedicated Envoy L4 proxy pods per external domain, with a CoreDNS plugin hijacking external lookups and an Egress Operator managing the resources | Envoy, CoreDNS, custom Egress Operator | nat-gateway | NetworkPolicy decides which service may use which gateway; HPA scales gateways on CPU; Istio and enterprise proxies rejected over SSH/SFTP and service-level policy gaps |
| 25 | Card schemes and payment networks | Mastercard sends authorisation requests and receives the accept/decline; Faster Payments for external transfers | Mastercard, FPS (Faster Payment System) | third-party-api | Monzo "makes an authorisation decision", updates the ledger, returns a response through Mastercard |
| 26 | Monzo Stand-in (GCP) | Independent backup bank on a different cloud: 18 services with their own Kubernetes, database, queue and locking | in-house, on Google Cloud Platform | container-orchestrator | 18 services vs ~3,000; ~1% of Primary opex; manual CLI activation; supports card payments, cash withdrawals, transfers, balance, history, card freeze |
| 27 | Stand-in Data Syncer | Consumes Primary Platform events and writes them into Stand-in; generates Correlation IDs so transactions are not double-counted on the way back | in-house | change-data-capture | eventually consistent by design; card PANs exchanged tokenised and encrypted |
| 28 | firehose -> BigQuery data platform | Backend events stream to the warehouse; loaders enrich and strip PII; dbt models, Airflow schedules, Looker serves | Kafka + NSQ firehose, Analytics Event Processor, Shipper, Fivetran, BigQuery, dbt, Airflow, Looker | data-warehouse | append-only projects; 4,700+ dbt models, ~600k lines SQL; nightly refresh, some tables every 15 minutes |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| monzo-app | aws-load-balancer | https | sync | | held connections 6–7s under spike |
| aws-load-balancer | edge | http | sync | | |
| edge | envoy-sidecar | http | sync | | every hop goes through the local Envoy |
| envoy-sidecar | go-microservice | http/json | sync | | P2C + Peak EWMA in the linkerd era; "an RPC will never actually traverse the network if replicas of both communicating services exist on a host" |
| edge | go-microservices | http rpc | sync | | fan-out of 20+ services per app request |
| staff tooling | internal-edge | https | sync | | separate edge for customer-operations tools |
| mastercard | edge / payment services | scheme protocol | sync | | authorisation request in, accept/decline out, inside the scheme timeout |
| payment services | account-service | http rpc | sync | | account type lookup decides the route |
| payment services | fraud-and-financial-crime | http rpc | sync | | conditional, not on every transaction |
| payment services | sca-services | http rpc | sync | | strict API boundary, only when legislation requires it |
| payment services | ledger-service | http rpc | sync | | debit sender, credit recipient |
| ledger-service | cassandra | cql | sync | quorum (2 of 3) | partition key selects the three owning replicas |
| go-microservice | cassandra | cql | sync | quorum | one keyspace per service; index table + canonical table instead of transactions |
| go-microservice | etcd (via lock service) | http | sync | | distributed locks, quotas, rate limits |
| go-microservice | nsq | nsq | async | no durability guarantee | unordered events; billions of messages daily |
| go-microservice | kafka | kafka | async | at-least-once | replicated commit log, consumer cursors, replayable |
| kafka-queue-library | deadletter-topic | kafka | async | at-least-once | after maxAttempts; one deadletter topic per consumer group |
| deadletter-topic | retry-topic | kafka | async | | operator-driven replay from a CLI, or discard |
| go-microservice | notification / feed services | http rpc + queue | async | | enrichment and notifications happen after the payment completes |
| go-microservice | egress-gateway | tcp (via hijacked DNS) | sync | | CoreDNS returns the gateway IP; NetworkPolicy gates access |
| egress-gateway | third-party-api | tcp/tls | sync | | gateway resolves the real destination and forwards |
| go-microservice | prometheus (scrape) | http | async | | pull; free HTTP, Cassandra and lock metrics |
| go-microservice | jaeger | otlp | async | | trace context propagated by the shared RPC layer |
| go-microservice | elasticsearch | log shipping | async | | |
| shipper (deploy tool) | kubernetes + cassandra | api | sync | | rolling deploy plus schema migration in one command |
| rpcmap (CI) | calico network policies | generated rule files | async | | per-callee rule files reviewed by the destination service owner |
| primary-platform events | stand-in-data-syncer | event stream | async | eventually consistent | deliberately not synchronous, to protect availability |
| stand-in-data-syncer | stand-in datastore (GCP) | write | async | eventually consistent | Correlation IDs prevent double counting on the way back |
| monzo-app | stand-in platform | https | sync | | app polls both platforms and switches UI when Stand-in is live |
| stand-in platform | card schemes | scheme protocol | sync | | normally proxied through Primary; connects directly if Primary is fully unavailable |
| backend services | firehose (kafka + nsq) | kafka/nsq | async | | |
| firehose | bigquery (via loaders) | batch load | async | | PII sanitised and payloads enriched before landing |
| bigquery | looker (via dbt + airflow) | sql | async | | nightly for most models, 15 minutes for some |

## Failure modes, incidents, tradeoffs the source discusses
- **29 July 2019, the Cassandra outage — the flagship incident.** Six servers were added to the 21-node cluster; `auto_bootstrap=false` had been set so nodes could be rebuilt fast from backups, but that flag also controls whether a joining node goes active. "The new servers had joined the cluster, assumed responsibility for some parts of the data (certain partition keys to balance the load), but hadn't yet streamed it over." Reads and writes for affected partition keys returned nothing. Card payments failed, customers were logged out, the internal edge 404'd, and the customer-support chat tool went down at the same moment — so the bank lost both the service and the ability to talk to customers about it. Recovery was decommissioning each new node at 8–10 minutes apiece (13:10 start, 15:08 restored, 23:00 fully reconciled via event replay). https://monzo.com/blog/2019/09/08/why-monzo-wasnt-working-on-july-29th
- **Testing at one-node scale hid the bug.** "With only one new server, it wouldn't matter if it joined the cluster fully and didn't hold any data" — with RF=3 and quorum, "we'd have agreement from the other two servers in the cluster." Six nodes at once broke quorum. Fix: scale-up operations are now rehearsed at production scale, with runbooks. Same URL.
- **One shared Cassandra cluster is the stated regret.** "The single cluster approach has been advantageous for engineers building services... But a downside of this design is that a single change can have a far-reaching impact." Remediation is splitting into multiple smaller clusters to bound the failure domain. Same URL.
- **2017 platform-wide outage from Kubernetes + etcd + linkerd interaction.** Patel: a "combination of bugs between Kubernetes, how it interacted with etcd backing, consistent storage layer, and Linkerd" caused a "complete platform outage." A cluster reconfiguration a week earlier had silently stopped linkerd receiving endpoint updates; restarting every linkerd instance exposed a version incompatibility and turned a service-specific failure into a full one. Service discovery lost every healthy endpoint. https://www.infoq.com/presentations/monzo-microservices/ and https://www.infoq.com/presentations/banking-thousands-microservices-2023/
- **The service mesh became the latency.** linkerd 1.0 was "the main factor contributing to 99th percentile latency" even at normal load, and during crowdfunding prep it "wasn't able to handle the load without giving it disproportionate amounts of processing power." At ~800 app launches/second linkerd hit CPU throttling because Kubernetes resource specs did not match actual pod allocation, producing a connection backlog that escalated CPU demand further. Envoy replaced it: lower p99 at 15k rps on "less than half the CPU". https://monzo.com/blog/2019/04/03/deploying-envoy-proxy
- **Daemonset to sidecar was a security decision, not only a performance one.** A shared per-host Envoy cannot be governed by per-service Calico policy; one Envoy per pod can. Same URL.
- **Default-deny networking collapsed the blast radius.** 1,500 services with 9,300+ real connections meant an average service could previously call all 1,500; after isolation it can call about 6. Rules are generated by static analysis so engineers cannot forget them, and packets were logged-but-not-dropped for a month to catch rarely-exercised paths. https://monzo.com/blog/we-built-network-isolation-for-1-500-services
- **Network policy makes rollbacks dangerous.** "Rolling back a service becomes really risky. If you go back to an earlier version... you might also roll back to before a calling service was whitelisted." Same URL.
- **Durability beat convenience in messaging.** NSQ's "lack of message durability... is the only fact standing between us and full at-least-once delivery", so queue semantics were rebuilt on Kafka — paying for it by giving up ordering, because "Monzo has very few use cases where ordering actually matters". Concurrency inside a partition bounds duplicate work with a max runaway limit. https://monzo.com/blog/how-we-built-a-queue-on-top-of-kafka
- **Protecting the bank from a marketing event.** For the £20M crowdfund they removed Cassandra reads from the pre-investment critical path, used an in-memory singleton counter flushed to etcd watermarks rather than Cassandra counters, pushed the actual money movement onto NSQ at ~60/s, and accepted rare race conditions rather than risk the core banking infrastructure. https://monzo.com/blog/2019/01/14/crowdfunding-technology-backend-architecture
- **Bottlenecks were found by profiling, not by guessing.** The Prometheus JMX agent inside Cassandra cost 10% CPU and was moved to a separate constrained process; 64KB chunk sizes caused excessive decompression and were cut to 4KB, halving latency; non-deterministic query generation churned the prepared-statement cache with thousands of duplicate permutations. AWS also throttled Route 53 on repeated resolution, and the ALB held connections for 6–7 seconds on a spike. "Scaling has its limits. Even in a distributed system... you do need to actually test and make sure you're not being bottlenecked elsewhere." https://www.infoq.com/presentations/monzo-microservices-arch/
- **Shadow traffic instead of synthetic guessing.** A proxy repeats read-only production requests a randomised number of times to load the system without touching customers. https://www.infoq.com/presentations/monzo-microservices/
- **Independence is the point of Stand-in.** Different cloud, different Kubernetes, different database, and 18 services that never run on the Primary Platform — "even for behaviours that are common across both like processing a card payment" — because shared code is a shared failure mode. Its replication is deliberately eventually consistent since synchronous writes would reduce availability. First full-scale activation was an August 2024 incident lasting about an hour, at ~1% of Primary opex. https://monzo.com/blog/tolerating-full-cloud-outages-with-monzo-stand-in
- **Egress control was built because the alternatives did not fit.** Istio and enterprise proxies were rejected for weak protocol coverage (SSH/SFTP) and inability to enforce service-level policy inside Kubernetes' virtual network. https://monzo.com/blog/controlling-outbound-traffic-from-kubernetes
- **Autoscaling has cost them too.** "It hasn't all been smooth sailing" — uncontrolled pod evictions and failures retrieving metrics from Prometheus. https://monzo.com/blog/2020/10/19/autoscaling-monzo
- **Paved road over mandate.** Heath: standard defaults are "just the easiest option", and 99% of the system uses them despite the policy being non-binding; abstractions are added only "once we've actually done that thing a few times". Shared code lives as services or in one shared library, so "when we make an improvement or fix a bug in the shared library layer, every service can benefit... without needing a single line of code change". https://www.infoq.com/presentations/monzo-microservices/
- **The counterexample they cite.** Patel points at the 2018 TSB migration — £30M fine plus £33M customer compensation after a three-year platform migration — as the organisational failure mode, not a technical one. https://www.infoq.com/presentations/banking-thousands-microservices-2023/

## Unknowns
- Region and availability-zone topology of the Primary Platform: sources say AWS but never name regions, AZ counts, or whether the Cassandra cluster spans AZs.
- Current Cassandra node count and whether the single cluster was actually split into multiple clusters as planned after 2019.
- Kafka and NSQ retention windows; Cassandra TTLs; how far back a deadletter replay can reach.
- Whether NSQ has been fully retired in favour of Kafka, or the two still coexist across the fleet.
- Quantified latency SLOs for the card authorisation path; only "less than a second" end to end (2016) is published.
- How the edge authenticates and authorises app sessions — the sources name the edge but never describe its auth mechanism.
- Whether Envoy sidecars carry mTLS identity, or isolation rests entirely on Calico NetworkPolicy at L3/L4.
- The Stand-in failover decision criteria beyond "engineers manually enable components via CLI".
- Whether Cassandra is the only store: no cache tier, search store for online traffic, or relational database is named anywhere in the fetched sources.

## Candidates
- New kinds: none required. Every box maps to an existing kind; `service-mesh`, `ledger`, `nosql-database`, `queue`, `stream`, `policy-engine`, `change-data-capture`, `nat-gateway`, `coordination-service` and `data-warehouse` all fit.
- New properties on existing kinds:
  - `service-mesh.deployment` (sidecar | daemonset | node-proxy) — Monzo moved daemonset -> sidecar and the choice changes what policy can be enforced
  - `service-mesh.implementation` (envoy | linkerd | istio | in-house)
  - `nosql-database.keyspacePerService` (boolean) and `nosql-database.sharedCluster` (boolean) — the 2019 blast-radius lesson
  - `nosql-database.replicationFactor` (integer) and `.readConsistency` / `.writeConsistency` (one | quorum | all)
  - `queue.deadletter` (boolean), `queue.maxAttempts` (integer), `queue.orderingGuarantee` (none | per-partition | global), `queue.replayable` (boolean)
  - `container-orchestrator.autoscaling` (manual | vertical | horizontal) and `.defaultReplicas` (integer)
  - `policy-engine.defaultDeny` (boolean) and `.policySource` (manual | generated-from-code)
  - `app-server.serviceCount` (integer) for "one box representing N services"
  - `nat-gateway.egressProxy` (boolean) — the Envoy egress gateway pattern
- New edge properties: `fanOut` (integer, services touched per request); `conditional` (boolean, edge only exercised for some requests); `allowedByPolicy` (boolean, for default-deny meshes)
- New requirement paths: `availability.standInPlatform` (boolean) and `availability.standInCloud` (string) — a second-cloud reduced-function fallback is a distinct requirement from multi-region; `consistency.model` (strong | eventual | tunable); `compliance.scheme` (PCI | SCA | PSD2)
- New rules (name + one-line condition):
  - `shared-datastore-without-blast-radius-bound`: a single nosql-database with sharedCluster true serving more than N app-servers and no second cluster declared
  - `quorum-store-scaled-without-staged-join`: nosql-database with writeConsistency quorum and no declared staged/bootstrap scaling procedure
  - `support-tooling-shares-failure-domain`: an internal/admin api-gateway whose datastore is the same node as the customer path's datastore (the COps chat went down with the bank)
  - `mesh-without-resource-headroom`: service-mesh on the sync path with no CPU request/limit declared while a latency target exists
  - `default-allow-service-network`: policy-engine absent, or defaultDeny false, in a design tagged as regulated/financial
  - `async-queue-without-deadletter`: queue on an async edge with deadletter false and a retry count declared
  - `durability-gap-on-at-least-once-claim`: an edge claiming at-least-once delivery whose queue component has durability false
  - `egress-without-gateway`: a sync edge from an internal app-server straight to a third-party-api with no nat-gateway or egress proxy between them
  - `standin-shares-code-with-primary`: a declared stand-in platform whose components are the same nodes as the primary platform's
