# Intake: Lyft service platform and the Envoy service mesh

## Source
- Primary: https://eng.lyft.com/announcing-envoy-c-l7-proxy-and-communication-bus-92520b6c8191 (Matt Klein, Lyft software engineer and Envoy creator, Lyft Engineering blog, 2016)
- Primary: https://eng.lyft.com/envoy-7-months-later-41986c2fd443 (Matt Klein, Lyft, Lyft Engineering blog, 2017)
- Primary: https://eng.lyft.com/scaling-productivity-on-microservices-at-lyft-part-3-extending-our-envoy-mesh-with-staging-fdaafafca82f (Matthew Grossman, Lyft Developer Infrastructure, Lyft Engineering blog, 2022)
- Primary: https://eng.lyft.com/scaling-productivity-on-microservices-at-lyft-part-1-a2f5d9a77813 (Lyft Developer Infrastructure, Lyft Engineering blog, 2022)
- Primary: https://eng.lyft.com/announcing-cni-ipvlan-vpc-k8s-ipvlan-overlay-free-kubernetes-networking-in-aws-95191201476e (Paul Fisher, Lyft, Lyft Engineering blog, 2018)
- Primary: https://eng.lyft.com/building-an-adaptive-multi-tenant-stream-bus-with-kafka-and-golang-5f1410bf2b40 (Xinyu Liu, Lyft, Lyft Engineering blog)
- Primary: https://eng.lyft.com/evolution-of-streaming-pipelines-in-lyfts-marketplace-74295eaf1eba (Rakesh Kumar, Lyft Marketplace, Lyft Engineering blog)
- Primary: https://eng.lyft.com/rerouting-the-stream-how-lyft-moved-to-the-apache-flink-operator-36f20246d250 (Maheep Myneni, Arda Kuyumcu and Prem Santosh Udaya Shankar, Lyft Streaming Compute, Lyft Engineering blog, 2026)
- Primary: https://eng.lyft.com/productionizing-envoy-mobile-at-lyft-88d49c9c8d14 (JP Simard, Lyft, Lyft Engineering blog, 2022)
- Primary (official docs of the project Lyft built): https://github.com/envoyproxy/envoy/blob/main/docs/root/intro/deployment_types/service_to_service.rst, https://github.com/envoyproxy/envoy/blob/main/docs/root/intro/deployment_types/front_proxy.rst, https://github.com/envoyproxy/envoy/blob/main/docs/root/intro/arch_overview/upstream/service_discovery.rst, https://github.com/envoyproxy/ratelimit/blob/main/README.md (Envoy project documentation and reference implementations, originated at Lyft)
- Primary (talk plus write-up): https://qconnewyork.com/ny2018/ny2018/presentation/lyfts-envoy-monolith-microservice.html and https://www.infoq.com/news/2018/07/qcon-klein-service-mesh/ (Matt Klein, "Lyft's Envoy: Embracing a Service Mesh", QCon New York 2018)
- Secondary: https://www.infoq.com/news/2017/01/lyft-envoy (InfoQ interview with Matt Klein, Lyft, 2017)
- Attempted and failed: https://www.usenix.org/conference/srecon17americas/program/presentation/klein (SREcon17 Americas, "Lyft's Envoy: Experiences Operating a Large Service Mesh") returned 403
- Verified by: official Lyft engineering blog (nine posts read in full), official Envoy project documentation and reference implementations, QCon New York 2018 talk by Lyft's engineer plus the InfoQ write-up of it
- Confidence: high
- Date of source: 2016-2018 for the mesh design, 2018-2022 for the Kubernetes and staging evolution, 2026 for the streaming compute platform

## System in three lines
Lyft runs its rideshare marketplace as hundreds of Python and Go microservices on AWS, decomposed from an original PHP/Apache monolith. Every service instance runs an Envoy sidecar that is the sole ingress and egress for that instance, with edge Envoys terminating TLS at the internet boundary and a discovery/xDS control plane feeding the mesh; a Kafka and Kinesis plus Flink and Beam streaming tier carries change data capture and real-time pricing features. It is hard because the network substrate spans several languages and a legacy EC2 fleet and Kubernetes at the same time, and because Lyft needs identical observability at every hop to debug anything at all.

## Scale (only if stated)
- Services and hosts (2016): "we run Envoy on thousands of nodes and over one hundred services, which in aggregate process over 2 million requests per second" (https://eng.lyft.com/announcing-envoy-c-l7-proxy-and-communication-bus-92520b6c8191)
- Services and hosts (2018): hundreds of microservices, 10,000+ hosts, 5-10 million mesh requests per second, global health dashboard covering 20,000 hosts (https://www.infoq.com/news/2018/07/qcon-klein-service-mesh/)
- Pre-Envoy: "we had about 30 services" with AWS ELBs for discovery and load balancing plus some HAProxy (https://eng.lyft.com/announcing-envoy-c-l7-proxy-and-communication-bus-92520b6c8191)
- Engineers and services: grew "from 100 engineers and a handful of services to 1000+ engineers and hundreds of services", "deploying hundreds of times each day" (https://eng.lyft.com/scaling-productivity-on-microservices-at-lyft-part-1-a2f5d9a77813)
- Mobile: Envoy Mobile handles "nearly all network requests from Lyft's mobile apps ... serving billions of requests each day" (https://eng.lyft.com/productionizing-envoy-mobile-at-lyft-88d49c9c8d14)
- Streaming: the feature-generation pipeline "ingests tens of millions of events per second", the model-execution pipeline consumes "tens of thousands of events per minute", end-to-end latency "< 1 minute" (https://eng.lyft.com/evolution-of-streaming-pipelines-in-lyfts-marketplace-74295eaf1eba)
- Change data capture: the event bus houses "hundreds of CDC pipelines", "some route hundreds of thousands of messages per second" (https://eng.lyft.com/building-an-adaptive-multi-tenant-stream-bus-with-kafka-and-golang-5f1410bf2b40)
- Flink fleet: "hundreds of critical streaming jobs" (https://eng.lyft.com/rerouting-the-stream-how-lyft-moved-to-the-apache-flink-operator-36f20246d250)
- Onebox development environments: r3.4xlarge, 16 vCPUs, 122GiB, running 100+ services per environment (https://eng.lyft.com/scaling-productivity-on-microservices-at-lyft-part-1-a2f5d9a77813)

## Requirements stated or clearly implied
- Availability target (SLA / regions / must survive region loss): no SLA number stated. The stated design requirement is that the control plane may fail without the data plane failing: "the design assumes that the discovery service can fail at any time" (Envoy service_discovery.rst). Staging is held to SLOs that page on-call engineers.
- Consistency (strong / eventual / per-entity): service discovery is deliberately eventually consistent and lossy, "Envoy treats service discovery as eventually consistent and lossy" (Envoy 7 months later). CDC streams require per-partition ordering with at-least-once or exactly-once delivery.
- Latency target (p50 / p95 / p99 and for which path): not quantified per RPC. Native C++ was chosen for tail-latency reasons. The streaming pricing path targets sub-minute end-to-end latency.
- Ordering needs (global / per-key / none): per-partition (per-table) ordering on CDC streams, "losing events or malforming the ordering often yields unpredictable consequences". No global ordering stated.
- Replay or reprocessing needs: yes for streams. Kafka topics are backed up to S3 via Firehose with "command line tools ... to ease replay of any pipeline between 2 arbitrary timestamps".
- Retention (data / messages / logs): not stated for Kafka, S3 or logs.
- Compliance / residency (PCI, GDPR, region pinning): not stated.
- Language independence is a stated hard requirement: one mesh must serve PHP, Python, Go, C++, Node and Typescript.
- Observability is a stated first-class requirement: every hop must emit the same stats, logs and traces; Lyft reports 100% trace coverage with no service gaps.

## Boundaries
- Regions / zones mentioned: AWS, with VPCs, subnets and Elastic Network Interfaces per node. Specific regions and AZ counts are not stated. Discovery-service host attributes carry zone, used for load balancing and statistics (Envoy EDS doc).
- Trust zones (public edge, internal, restricted): public internet to edge/front Envoy (TLS termination, client certificate support with pinning, "A" on the SSL Labs report); internal mesh of sidecar Envoys reached only over localhost from the application; dedicated external-service egress listeners for AWS and third-party endpoints.
- Environment boundaries: production; staging ("the same tech stack as production but with scaled-in resources, fake user data, and a synthetic web traffic generator"); local development (Devbox and Onebox, both retired).
- Substrate boundary: legacy service-assigned EC2 instances in auto-scaling groups and Kubernetes clusters coexist, and "Envoy is used to unify a mesh that spans both the legacy infrastructure as well as Lyft services running on Kubernetes".
- Named subsystems: edge proxy, service-to-service mesh, discovery service / xDS control plane, global rate limit service, CDC event bus (tailer plus adapter), streaming feature pipelines, model execution pipelines, staging overrides / offloaded deployments.

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Lyft mobile apps (Rider, Driver, bike and scooter partner apps) | End-user clients whose network stack is itself Envoy | Envoy Mobile, replacing URLSession and OkHttp | client | requestsPerDay: billions; stats emitted directly to a gRPC or statsd endpoint |
| 2 | Front / edge proxy | Internet ingress: TLS termination, HTTP/1.1, HTTP/2 and HTTP/3, full L7 routing, then into the mesh | Envoy | api-gateway | tls: terminate; l7Routing: true; usesDiscoveryService: true; "front Envoy hosts work identically to any other Envoy host" |
| 3 | AWS ELB (legacy) | Pre-Envoy service discovery and load balancing, gradually replaced by direct mesh connections | Amazon ELB | load-balancer | replaced: true; observability limited to "extremely primitive CloudWatch ELB statistics and logging" |
| 4 | Sidecar Envoy | Out-of-process proxy colocated with every service instance, the sole ingress and egress for that instance | Envoy | service-mesh | outOfProcess: true; perInstance: true; languageAgnostic: true; upgradeable independently of the application |
| 5 | Service-to-service egress listener | Local port the application calls to reach any other service, for example http://localhost:9001 | Envoy listener | service-mesh | port: 9001; routing by HTTP/1.1 host or HTTP/2 :authority header; handles discovery, load balancing and rate limiting |
| 6 | Service-to-service ingress listener | Port remote Envoys connect to, for example http://servicename:9211, forwarding to the local application port | Envoy listener | service-mesh | port: 9211; envoyToEnvoy: HTTP/2 by default; performs buffering and circuit breaking |
| 7 | External service egress listeners | One dedicated local port per external service, for example localhost:9250 for DynamoDB | Envoy listener | service-mesh | portPerExternalService: true; recommended over host-header routing for external SDKs |
| 8 | Discovery service (SDS/EDS) | REST service Envoy polls for cluster members, treated as eventually consistent and allowed to fail | in-house, open sourced; Python, DynamoDB as backing store | coordination-service | consistency: eventual; backingStore: DynamoDB; per-host attributes: load balancing weight, canary status, zone |
| 9 | xDS control plane (current) | Serves LDS, CDS, RDS and EDS configuration to every Envoy, driven by Kubernetes events | in-house control plane | coordination-service | apis: LDS, CDS, RDS, SDS/EDS, HDS; source: Kubernetes events; filters pods labelled offloaded-deploy=true out of discovery |
| 10 | Global rate limit service | Go/gRPC service Envoy calls for a rate limit decision on a domain plus a set of descriptors | in-house (lyft/ratelimit, now envoyproxy/ratelimit), Redis | rate-limiter | protocol: gRPC; store: Redis; configuration loaded from disk via goruntime or from an xDS management server |
| 11 | PHP/Apache monolith (legacy) | The original Lyft application; decomposition completed late 2018 | PHP on Apache | app-server | retired: 2018; "Lyft engineering completed decomposing our original PHP monolith into a collection of Python and Go microservices" |
| 12 | Python and Go microservices | The current application tier, hundreds of services, each behind its own sidecar | in-house; Python, Go (historically also C++ and PHP; Typescript for tooling) | app-server | count: hundreds; deploys: hundreds per day; standard request libraries propagate trace context |
| 13 | MongoDB | Backend database of the monolith era, sharded, sniffed at L7 by Envoy for stats | MongoDB | nosql-database | sharded: true; "MongoDB lacks decent hooks for observability" so Envoy produces the statistics |
| 14 | DynamoDB | AWS key/value store used as an application datastore, as the discovery service backing store, and as a CDC source | Amazon DynamoDB | nosql-database | envoyL7Sniffing: true; dedicated egress port; DynamoDB Streams consumed by the CDC tailer |
| 15 | Redis | Caching tier proxied by Envoy, and the store behind the rate limit service | Redis | cache | envoyRedisProxy: true; sharded Redis with cluster discovery, consistent hashing, health checking and self healing on the roadmap |
| 16 | Aurora / RDS | Relational OLTP stores that the CDC pipeline tails | Amazon Aurora, Amazon RDS | sql-database | role: OLTP; "running analytic queries against OLTP ... datastores ... does not suit our needs well" |
| 17 | EC2 instances in auto-scaling groups (legacy substrate) | "home-grown, somewhat bespoke stack to deploy our microservice architecture onto service-assigned EC2 instances with auto-scaling groups that dynamically scale instances based on load" | AWS EC2, AWS Auto Scaling groups | virtual-machine | autoscaling: true; containers: none in production as of 2018 |
| 18 | Kubernetes clusters | Current orchestration substrate for production, staging and development, on VPC-native IPvlan networking | Kubernetes, cni-ipvlan-vpc-k8s | container-orchestrator | networking: IPvlan, overlay-free, VPC-native, host ENIs tied directly to pods; migration phased Flink and TensorFlow first, then Lyft microservices |
| 19 | Kafka (CDC event bus and feature topics) | Durable buffer and routing substrate between tailers, adapters and feature pipelines, one topic per source table | Apache Kafka | stream | ordering: per partition; delivery: at-least-once and exactly-once supported; "Kafka acts as a buffer. It absorbs back pressure"; consumer groups with RoundRobinAssignor or StickyAssignor |
| 20 | Kinesis | Alternative stream transport for analytic events, and a CDC sink | Amazon Kinesis, with the Kinesis Client Library | stream | used by the DynamoDB tailer and as an adapter sink |
| 21 | CDC tailer services | Per-source-type services that subscribe to database change events and deliver them as-is to Kafka topics | in-house Golang (DynamoDBTailer, AuroraTailer) | change-data-capture | topicPerTable: true; sources: DynamoDB Streams, Aurora, RDS; captures "without interfering OLTP" |
| 22 | CDC adapter service | Multi-tenant consumer doing event filtering, transformation, stream routing and error handling, one deployment serving many pipelines | in-house Golang on Kubernetes | worker | multiTenant: true; autoscaling: true; isolation goal "a broken or blocked pipeline should have zero impact on its neighbors"; modular sinks |
| 23 | Firehose to S3 archive | Disaster-recovery backup of Kafka topics, with replay between two arbitrary timestamps; also the Flink state store | Amazon Kinesis Firehose, Amazon S3 | object-store | replay: by timestamp range; holds Flink checkpoints and savepoints (s3://lyft-flink/checkpoints, /savepoints) |
| 24 | Flink and Beam streaming pipelines | Real-time feature generation and model execution for marketplace pricing, running on Kubernetes | Apache Flink, Apache Beam, Apache Flink Kubernetes Operator (previously Lyft's own operator) | stream-processor | split into a high-throughput feature-generation pipeline and an isolated smaller model-execution pipeline; YAML/DSL pipeline definitions; job-vertex autoscaling and in-place rescaling on Flink 1.19 |
| 25 | Stats, tracing and dashboard tier | Consumes the identical stats, logs and traces that every Envoy hop emits | statsd and gRPC stat sinks, OpenTracing header x-ot-span-context, Zipkin tracing support | monitoring | traceCoverage: 100%; global dashboard covering 20,000 hosts; per-service dashboards auto-generated; unique request id correlates logs |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| Lyft mobile app (Envoy Mobile) | edge Envoy | HTTPS (HTTP/1.1, HTTP/2) | sync | not stated | TLS terminated at the edge, client certificate support with pinning |
| edge Envoy | sidecar Envoy of the target service | HTTP/2 | sync | not stated | uses the standard ingress port and the discovery service for host lookup |
| service process | its own sidecar Envoy (egress listener) | HTTP/1.1 or HTTP/2 to localhost:9001 | sync | not stated | the application never learns the network topology or the environment |
| sidecar Envoy (egress) | remote sidecar Envoy (ingress listener) | HTTP/2 | sync | automatic retries configured in Envoy | long-lived multiplexed connections, "HTTP/2 provides better performance than HTTP/1.1 via long lived connections and explicit reset notifications" |
| sidecar Envoy (ingress) | local application port | HTTP/1.1 or HTTP/2 | sync | not stated | local Envoy performs buffering and circuit breaking; multiple application ports possible |
| every Envoy | discovery service / xDS control plane | REST, later gRPC (SDS/EDS, CDS, RDS, LDS, HDS) | async poll or stream | eventually consistent and lossy by design | control plane failure does not stop routing to already-known healthy hosts |
| xDS control plane | Kubernetes API | Kubernetes watch and events | async | not stated | pods labelled offloaded-deploy=true are filtered out of service discovery |
| discovery service | DynamoDB | DynamoDB API | sync | not stated | DynamoDB is the backing store of the open-sourced reference discovery service |
| every Envoy | upstream cluster hosts | active health checks | async | n/a | union of discovery data and health-check data decides routability, per the documented 2x2 matrix |
| sidecar Envoy | global rate limit service | gRPC | sync | not stated | domain plus descriptors in, allow or deny out |
| global rate limit service | Redis | Redis protocol | sync | not stated | composed cache key per descriptor |
| sidecar Envoy | MongoDB | MongoDB wire protocol, L7 sniffed | sync | not stated | Envoy produces the statistics and logging MongoDB does not |
| sidecar Envoy | DynamoDB | HTTPS on a dedicated egress port (for example localhost:9250), L7 sniffed | sync | not stated | one local port per external service by convention |
| sidecar Envoy | Redis | Redis protocol | sync | not stated | Envoy Redis proxying |
| every Envoy | stats and tracing sinks | statsd or gRPC stat sink; OpenTracing then Zipkin | async | not stated | the same stats at every hop; unique request id for log correlation |
| service | next service in the call graph | HTTP header x-ot-span-context carrying a base64-encoded trace protobuf | sync | best effort | staging override metadata rides in OpenTracing baggage and must be propagated by every hop, including across gRPC and SQS |
| Aurora / RDS / DynamoDB | CDC tailer service | DynamoDB Streams, Kinesis Client Library, database change feeds | async | at-least-once | non-intrusive to OLTP |
| CDC tailer service | Kafka topic | Kafka protocol | async | ordered per partition, at-least-once or exactly-once | events delivered as-is, one topic per source table |
| Kafka topic | CDC adapter service | Kafka consumer group | async | at-least-once | all adapter pods share one consumer group, Kafka rebalances partitions on scale events |
| CDC adapter service | sinks (Firehose, Elasticsearch, Kafka, Kinesis, gRPC) | per-sink protocol | async | not stated | modular sink adapters, fan-out per pipeline |
| Firehose | S3 | Firehose delivery | async | not stated | disaster-recovery backup and timestamp-range replay |
| application services | Kafka or Kinesis analytic event streams | Kafka, Kinesis | async | not stated | feeds the streaming feature pipelines |
| feature-generation pipeline (Beam on Flink) | Kafka feature topics | Kafka | async | not stated | tens of millions of events per second ingested |
| Kafka feature topics | model-execution pipeline | Kafka | async | not stated | tens of thousands of events per minute, isolated smaller cluster |
| model-execution pipeline | decision-variable services (for example pricing) | not stated | async | not stated | "sync decision variables to their respective services" |
| Flink jobs | S3 | S3 | async | not stated | checkpoints and savepoints under s3://lyft-flink/ |

## Failure modes, incidents, tradeoffs the source discusses
- The pre-Envoy network was untrustworthy and undebuggable: "we faced continuous issues with sporadic networking and service call failures to the extent that most developers were afraid to have high volume service calls in critical paths. It was incredibly difficult to understand where the problems were occurring. In the service code? In EC2 networking? In the ELB? Who knew?" (https://eng.lyft.com/announcing-envoy-c-l7-proxy-and-communication-bus-92520b6c8191)
- Per-language RPC libraries are the wrong place for reliability features: "An architecture composed of a variety of languages, each containing a half-baked RPC library, including partial (or zero) implementations of rate limiting, circuit breaking, timeouts, retries, etc." adds up to "an operational and reliability headache" (https://eng.lyft.com/envoy-7-months-later-41986c2fd443)
- Library upgrades do not roll out, proxies do: "As anyone that has worked with a large service oriented architecture knows, deploying library upgrades can be painful. Envoy can be deployed and upgraded quickly across an entire infrastructure transparently." (announcement post)
- Strongly consistent discovery was rejected on operational grounds: "Many existing RPC systems treat service discovery as a fully consistent process ... Our experience has been that operating these backing stores at scale is painful." (Envoy service_discovery.rst)
- The control plane is allowed to fail, and the data plane must survive it: "Host absent / health check OK: Envoy will route to the target host. This is very important since the design assumes that the discovery service can fail at any time." Only the absent-and-failing state purges a host. (Envoy service_discovery.rst)
- Health-check data outranks discovery data: "Health check data is assumed to be more accurate than discovery data." (Envoy service_discovery.rst)
- Native code was chosen so the proxy does not add to an already opaque tail-latency problem: "Modern application developers already deal with tail latencies that are difficult to understand due to deployments in shared cloud environments and the use of very productive but not particularly well performing languages." (announcement post)
- Shared pre-production environments have blast radius: in staging "if someone deployed a malfunctioning instance to the staging mesh, it would affect others who (perhaps transitively) depend on that service" — answered with offloaded deployments that never register with service discovery, plus per-request routing overrides. (part 3)
- Context propagation is the weak link in header-based routing: "we found context propagation was not as ubiquitous as we would've hoped. Our initial users frequently came to us saying their overrides weren't getting applied to their requests, and dropped traces were often the culprit" — across Python gevent and greenlets, HTTP and gRPC, and SQS async jobs. (part 3)
- "Lyft-in-a-box" development environments collapsed under microservice growth: "When something went wrong, it was difficult to pinpoint the exact cause (which of the 70 services running might be misbehaving?)", and integration suites grew to an hour with "80% or more of tests ... either unnecessary ... or could be rewritten to run without external dependencies in a fraction of the time". (part 1)
- Postmortems drove a testing anti-pattern: "Postmortems often ended with an action item to add new integration tests. With such a flexible and powerful testing capability available, unit tests gradually took a back seat." (part 1)
- Demand surges are a recurring outage cause: "Events resulting in a surge in rideshare traffic, such as New Years Eve and Halloween, would expose bottlenecks in our system which often led to outages" — answered with a production ride-simulation framework driving tens of thousands of simulated users. (part 1)
- One streaming pipeline doing both feature generation and model execution did not scale: "The problem was architectural: The pipeline was doing too many things." Splitting it restored throughput and gave stable sub-minute latency through peak events. (marketplace post)
- Data skewness and memory pressure broke the first Beam rollout: "We ran into data skewness and higher memory utilization issues", forcing a staged rollout starting in smaller markets. (marketplace post)
- CDC ordering violations are a correctness bug, not a nuisance: "A classic example of this would be a table row update prior to the insertion." (stream bus post)
- Kafka rebalancing is expensive enough to design around: "Kafka client rebalancing is an expensive operation that leads to message delays and duplication" — so the CDC bus applies configuration changes without restarting consumers. (stream bus post)
- A home-grown control plane becomes debt: Lyft's own Flink Kubernetes operator "had become a relic of Lyft's early Kubernetes days, kept alive by a growing pile of custom code. Every Flink version upgrade meant carefully picking through layers of accumulated technical debt and hoping nothing broke on the way through." It was retired for the Apache operator. (Flink operator post)
- Overlay networks on AWS were rejected: "Why would you run an SDN on top of an SDN?"; and the naive per-node /24 approach caps out because "you're effectively limited to 50 Kubernetes nodes per VPC using this method" under the default VPC route-table limit. (CNI post)
- Mobile network quality varies more than expected: success rate "can vary by up to 10% across carriers with the same OS/library configuration" and by a similar margin across client libraries on the same carrier. Moving to Envoy Mobile cut OOM crashes by 69.3% and app hangs by 47.9% on the iOS Driver app, and ANRs by 30% on Android partner apps. (Envoy Mobile post)

## Unknowns
- Region and availability-zone counts, and whether Lyft runs active-active across regions. Never stated in the fetched sources.
- Latency SLOs per request path, and the concrete timeout, retry and circuit-breaker budgets configured in the mesh.
- Kafka retention, partition counts and replication factor; DynamoDB table keys and capacity mode; Redis cluster topology and eviction policy.
- Current node, pod and RPS figures. The last first-party numbers are from 2018 (10,000+ hosts, 5-10M mesh RPS). The 300,000-container multicluster figure that circulates in secondary write-ups was not confirmed from a Lyft-authored source.
- Whether the Python discovery service backed by DynamoDB still exists, or whether the Kubernetes-event-driven xDS control plane fully replaced it.
- How the marketplace dispatch, matching and pricing services are themselves decomposed. The sources describe the substrate, not the ride lifecycle.
- Authentication and authorization inside the mesh (mTLS, SPIFFE). Envoy supports client TLS authentication, but the sources do not say what Lyft deploys internally.
- Whether the edge tier still sits behind an AWS load balancer, or whether edge Envoys are addressed directly.

## Candidates
- New kinds: none strictly required. `service-mesh` covers the sidecar, `api-gateway` the edge Envoy, `coordination-service` the discovery and xDS control plane — though a dedicated `control-plane` (or `service-discovery`) kind would model "the control plane may fail while the data plane keeps serving" better than `coordination-service` does today.
- New properties on existing kinds: service-mesh.sidecarPerInstance (boolean); service-mesh.ingressPort / service-mesh.egressPort (integer); service-mesh.envoyToEnvoyProtocol (enum http1, http2); service-mesh.externalEgressPortPerService (boolean); coordination-service.consistency (enum strong, eventual); coordination-service.failOpen (boolean); rate-limiter.store (enum redis, memcached, in-memory); nosql-database.role (enum application, control-plane-store, cdc-source); stream-processor.autoscaling (enum none, job-vertex, in-place); container-orchestrator.cni (enum overlay, vpc-native).
- New edge properties: healthChecked (boolean); discoverySource (enum static, dns, eds, kubernetes); headerPropagationRequired (boolean, for trace baggage); sinkFanout (integer, for CDC adapter fan-out).
- New requirement paths: observability.perHopStats (boolean); observability.traceCoverage (percentage); discovery.consistency (strong, eventual); environments.stagingIsolation (none, per-environment, per-request).
- New rules:
  - control-plane-single-point-of-failure: a service-mesh or api-gateway whose only endpoint source is a coordination-service with failOpen unset
  - discovery-without-health-checking: service-mesh or load-balancer with discoverySource eds and no active health check edge declared
  - sidecar-without-stats-sink: service-mesh node with no edge into a monitoring node
  - trace-context-gap: a sync chain of three or more app-servers where any hop lacks headerPropagationRequired while request-level routing or sampling is required
  - cdc-sink-without-replay-store: change-data-capture into a stream with no archive edge into an object-store
  - ordered-stream-consumed-without-partition-key: stream with per-key ordering consumed by a worker with no partition key declared
  - polyglot-services-without-shared-proxy: three or more app-servers with different runtimes calling each other directly with no service-mesh node between them
  - external-datastore-without-l7-observability: app-server calling a nosql-database or cache directly, bypassing the service-mesh node that provides its stats

## Verification 2026-09-14

- https://raw.githubusercontent.com/envoyproxy/envoy/main/docs/root/intro/arch_overview/upstream/service_discovery.rst — reachable. Confirms eventual, lossy discovery, "the design assumes that the discovery service can fail at any time", "Health check data is assumed to be more accurate than discovery data", and the 2x2 discovery/health-check matrix.
- https://raw.githubusercontent.com/envoyproxy/envoy/main/docs/root/intro/deployment_types/service_to_service.rst — reachable. Confirms the egress listener on localhost:9001, the ingress listener on servicename:9211, HTTP/2 as the default for all Envoy-to-Envoy traffic, one explicit egress port per external service, and the external discovery service for all cluster lookups.
- https://www.infoq.com/news/2018/07/qcon-klein-service-mesh/ — reachable. Confirms "100's of microservices, 10k of hosts, and five to ten million mesh requests per second (RPS)" and the 20K-host global health dashboard.
- https://eng.lyft.com/announcing-envoy-c-l7-proxy-and-communication-bus-92520b6c8191 — HTTP 403 (Medium blocks the fetcher). The 2016 figures and the pre-Envoy ELB/monolith description could not be re-confirmed; none of them are encoded in design.yaml.
