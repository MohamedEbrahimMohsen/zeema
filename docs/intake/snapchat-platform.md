# Intake: Snapchat backend platform (Snap Service Mesh, multicloud microservices)

## Source
- Primary: https://eng.snap.com/monolith-to-multicloud-microservices-snap-service-mesh ("From Monolith to Multicloud Micro-Services: Inside Snap's Service Mesh", Snap infrastructure engineers, Snap Engineering blog, 2020)
- Primary: https://eng.snap.com/en-US/build_a_reliable_system_in_a_microservices_world_at_snap ("Build a Reliable System in a Microservices World at Snap", Snap engineers on the Temporal platform, Snap Engineering blog)
- Primary: https://eng.snap.com/quic-at-snap ("QUIC at Snap", Snap client-networking engineers, Snap Engineering blog, 2020; ads rollout dated October 2019)
- Primary: https://eng.snap.com/cross_platform_messaging_experience ("Building a cross-platform messaging experience", Snap messaging-client engineers, Snap Engineering blog)
- Primary: https://www.sec.gov/Archives/edgar/data/1564408/000119312517029199/d270216ds1.htm (Snap Inc. Form S-1 registration statement, SEC filing, 2017 — infrastructure risk factors and metrics)
- Secondary: https://aws.amazon.com/blogs/containers/how-snap-inc-secures-its-services-with-amazon-eks/ (AWS containers blog describing Snap's EKS architecture with Snap's cooperation, 2024 — the only fetched source that names the send/receive Snap service chain)
- Secondary: https://cloud.google.com/blog/products/application-modernization/snap-deploys-keydb-on-google-cloud-to-reduce-cross-cloud-latency (Google Cloud blog quoting Vinay Kola, Software Engineering Manager at Snap — KeyDB cross-cloud cache)
- Secondary: https://aws.amazon.com/solutions/case-studies/innovators/snap/ (AWS case study quoting Jerry Hunter, SVP of Engineering at Snap — scale numbers)
- Secondary: https://www.infoq.com/news/2020/04/snap-architecture-service-mesh/ (InfoQ write-up of the Snap service-mesh post — independent corroboration)
- Verified by: official engineering blog (Snap Engineering, 5 posts fetched in full) + SEC filing by the company + three vendor posts that quote named Snap engineering leaders + InfoQ
- Confidence: high for the service mesh, the multicloud control plane, the client network stack and the cross-cloud cache; medium for the send/receive Snap service chain (named only in the AWS post, not in a Snap post); low for Stories fan-out internals, which no fetched source describes
- Date of source: 2017 (S-1), 2019–2020 (service mesh, QUIC), 2024 (EKS security, KeyDB), 2025 (Temporal)

## System in three lines
Snapchat's backend serves ephemeral photo/video messages ("Snaps"), Stories and Discover to hundreds of millions of daily users from a fleet of 300+ microservices running on Kubernetes across both AWS and Google Cloud. Every service talks through an Envoy sidecar on Snap Service Mesh, driven by a regionalized xDS control plane and a single internal control panel called Switchboard; clients reach it through one Envoy-based API Gateway per region over QUIC. It is hard because the same request path must span two cloud providers with tens of milliseconds of inter-cloud latency, keep media ephemeral yet durable at trillion-object scale, and let any team stand up a production service without learning either cloud.

## Scale (only if stated)
- Users / DAU: 158 million average DAU in the quarter ended December 31, 2016 (S-1, https://www.sec.gov/Archives/edgar/data/1564408/000119312517029199/d270216ds1.htm)
- Requests per second: 10 million qps of service-to-service requests on the Mesh (https://eng.snap.com/monolith-to-multicloud-microservices-snap-service-mesh); 10 million transactions per second (https://aws.amazon.com/solutions/case-studies/innovators/snap/)
- Services / footprint: 300+ production services live on the Mesh, in 7 regions across AWS and Google Cloud (https://eng.snap.com/monolith-to-multicloud-microservices-snap-service-mesh)
- Message throughput: "over 2.5 billion Snaps are created every day" in 2016 (S-1); 5 billion Snaps per day (https://aws.amazon.com/solutions/case-studies/innovators/snap/)
- Data volume: 1.5 trillion photos and videos stored, on Amazon S3 Glacier Instant Retrieval (https://aws.amazon.com/solutions/case-studies/innovators/snap/)
- Cost: 65% reduction in compute costs after the migration off the App Engine monolith (https://eng.snap.com/monolith-to-multicloud-microservices-snap-service-mesh)
- Spend commitment: "We have committed to spend $2 billion with Google Cloud over the next five years" (S-1, 2017)

## Requirements stated or clearly implied
- Availability target: 99.99% availability stated in the AWS case study; 7 regions across two cloud providers; Switchboard lets owners "shift traffic between clusters, and drain regions", so region drain is a first-class operation (https://eng.snap.com/monolith-to-multicloud-microservices-snap-service-mesh)
- Consistency: not stated as a global model. The cross-cloud user read path is explicitly eventually consistent — 24-hour KeyDB TTL plus event-driven invalidation on DynamoDB writes (https://cloud.google.com/blog/products/application-modernization/snap-deploys-keydb-on-google-cloud-to-reduce-cross-cloud-latency)
- Latency target: not published as an SLO. Measured: cross-cloud p99 49–133 ms cut to 1.56–2.11 ms on cache hit; 24% reduction in median latency for sending image Snaps; QUIC improved p90/p99 network latency 6–20%
- Ordering needs: not stated. Messaging client keeps its own SQLite store and syncs client/server state, which implies per-conversation ordering, but no source states a guarantee
- Replay or reprocessing needs: yes for orchestrated workflows — Temporal "persists workflow execution states through internal distributed task queues", so a workflow resumes after worker or service outage (https://eng.snap.com/en-US/build_a_reliable_system_in_a_microservices_world_at_snap)
- Retention: Snaps are ephemeral by product design; cold media sits on S3 Glacier Instant Retrieval. KeyDB cache TTL 24 hours. No retention figures for messages stated
- Compliance / residency: not stated in the fetched sources. Security posture is stated instead: "Authentication, authorization, and network security should be defaults, not optional, within the platform."

## Boundaries
- Regions / zones: 7 regions across AWS and Google Cloud; named examples AWS us-east-1 (User Service, DynamoDB) and GCP us-central1 (CachingSecondaryUserService, KeyDB on GKE). Spinnaker pipelines do "zonal rollouts"
- Trust zones: (1) public internet / Snapchat mobile clients; (2) the API Gateway, "the only externally-exposed system in each region"; (3) the internal regional network, where "no external traffic source could communicate directly with the internal network" and services "can communicate without going over the public Internet"; (4) separate AWS accounts — microservices run in centralized compute accounts, data stores (DynamoDB, ElastiCache) in tenant-controlled data accounts reached by cross-account role assumption; (5) Kubernetes namespace isolation within shared multi-tenant EKS/GKE clusters
- Named subsystems: Snap Service Mesh (Envoy data plane + xDS control plane), Switchboard, API Gateway, Messaging Core Service, Media Service, Friend Service, User Service / CachingSecondaryUserService, the multi-tenant Temporal cluster, the async ads reporting workflow (Data Fetching / Report Generation / Notification services)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Snapchat client (Android / iOS) | Mobile app; shared C++ messaging core library drives presentation, network and storage layers | in-house C++ core, Djinni-generated Java/Obj-C/C++ interfaces | client | crossPlatform: true; businessLogic: C++; interfaceGen: Djinni IDL |
| 2 | Client message store | On-device message history and client/server sync state | SQLite | client (embedded store) | "identical schema and data on both mobile platforms"; single schema definition |
| 3 | Client network layer | gRPC over QUIC/HTTP3 on UDP, replacing TCP+TLS+HTTP2 | Cronet + gRPC C++ client, QUIC | client (network stack) | protocol: HTTP/3 over UDP; congestionControl: BBR; connectionMigration via 64-bit connection id |
| 4 | API Gateway | "front door for all requests from the Snapchat client"; the only externally exposed system per region | Envoy (same image as internal services) | api-gateway | customFilters: authentication, rate limiting, load shedding; connects to the same xDS control plane; one per region |
| 5 | Envoy sidecar (Mesh data plane) | Sidecar container on every service host; all service ingress and egress flows through it | Envoy | service-mesh | sidecar: true; tlsByDefault: true; metricsByDefault: true; clientSideLoadBalancing: true; circuitBreaking: true; hotRestart on config change; protocols gRPC and HTTP/2 |
| 6 | xDS Control Plane | Regionalized control plane that pushes Envoy configuration | in-house on Envoy xDS APIs | service-mesh (control plane) | transport: bidirectional gRPC stream; regionalized; canary: pushes to "a small subset of Envoys and measures their health over a period of minutes before committing" |
| 7 | Switchboard | Internal web app; "single control panel for Snap's services across cloud providers, regions, and environments" | in-house | coordination-service (config/control panel; could warrant `control-panel` (new)) | manages dependencies and consumers, shifts traffic between clusters, drains regions, provisions K8s clusters, generates Spinnaker pipelines; exposes a simplified config model, not the full Envoy API |
| 8 | Switchboard config store | Durable store for mesh/service configuration | Amazon DynamoDB | nosql-database | "Configuration changes in Switchboard are saved to DynamoDB" |
| 9 | Kubernetes clusters (AWS) | Runs microservices; moved from one cluster per service to shared multi-tenant clusters | Amazon EKS | container-orchestrator | multiTenant: true; isolation: namespaces + VPC CNI NetworkPolicies; identity: IRSA/OIDC; IPv6 dual-stack migration planned |
| 10 | Kubernetes clusters (GCP) | Same service model on the Google Cloud side | Google Kubernetes Engine (GKE) | container-orchestrator | multiTenant: true; hosts KeyDB and CachingSecondaryUserService in us-central1 |
| 11 | Internal regional network | Shared private network; services in a region talk without touching the public internet | not stated | network-fabric | externalIngress: none; "first level of defense in the event of vulnerabilities" |
| 12 | App Engine monolith (legacy) | The pre-migration backend the whole platform moved off | Google App Engine | app-server | shared datastores; replaced by 300+ services |
| 13 | Media Service | Persists Snap media on send; loads it from the content system on receive | in-house | app-server | writes to S3; reads via CloudFront/S3 |
| 14 | Friend Service | Validates that the sender is allowed to send to the recipient | in-house | app-server | consulted before conversation write |
| 15 | Messaging Core Service (MCS) | Stores conversation state; on receive returns message metadata and the media file pointer | in-house | app-server | conversation stored in DynamoDB; returns media pointer, not bytes |
| 16 | User Service | Authoritative user data service in AWS us-east-1 | in-house | app-server | region: aws us-east-1; backed by DynamoDB |
| 17 | CachingSecondaryUserService | Read-through cache service so GCP-side clients avoid cross-cloud user reads | in-house | app-server | region: gcp us-central1 on GKE; cache-miss falls through to User Service and backfills |
| 18 | KeyDB cache | In-memory cache for user data on the GCP side | KeyDB (multithreaded Redis fork, owned by Snap) | cache | ttl: 24h; deployed on GKE us-central1; hit p99 1.56–2.11 ms vs 49–133 ms cross-cloud |
| 19 | SecondaryServiceCacheInvalidator | Invalidates cached user entries when DynamoDB is written by other services | in-house | worker | eventDriven: true; complements TTL expiry |
| 20 | Conversation / user store | Operational NoSQL store for conversations, user records and mesh config | Amazon DynamoDB | nosql-database | lives in tenant-controlled data accounts, reached by cross-account role assumption |
| 21 | Media object store | Durable store for Snap photos and videos | Amazon S3; Amazon S3 Glacier Instant Retrieval for cold media | object-store | 1.5 trillion photos and videos on Glacier Instant Retrieval; 99.99% availability stated |
| 22 | Content delivery | Serves media to receiving clients | Amazon CloudFront | cdn | receive path loads media "from content system (CloudFront/S3)" |
| 23 | In-region cache tier | Managed cache alongside services on the AWS side | Amazon ElastiCache | cache | deployed in tenant data accounts, not compute accounts |
| 24 | Additional operational databases | Other operational stores named in Snap's datastore inventory | Google Cloud Spanner, Firestore, Bigtable | sql-database (Spanner), nosql-database (Firestore, Bigtable) | roles named only as operational/latency-sensitive; no schema or sizing stated |
| 25 | Analytics warehouse | Analytical database for Snap | Google BigQuery | data-warehouse | named as "analytical database (Google Cloud)"; no volumes stated |
| 26 | Temporal cluster | Multi-tenant workflow orchestration, itself hosted on Snap Service Mesh | Temporal | workflow-engine | multiTenant: true; inherits auth, authz and load balancing from the Mesh; persists workflow state in internal distributed task queues; vended client libraries wire the Mesh connection into the Temporal SDK |
| 27 | Ads reporting workflow services | Data Fetching Service (raw query to formatted file), Report Generation Service (analytics job to downloadable report), Notification Service (email to advertiser) | in-house | worker (first two), notification-service (third) | long-running: minutes; orchestrated as a Temporal workflow; retries, timeouts and idempotency required |
| 28 | Spinnaker | Deployment pipelines generated by Switchboard | Spinnaker | ci-pipeline | canaries, health checking, zonal rollouts |
| 29 | Runtime threat detection | Kubernetes audit-log analysis plus container syscall monitoring | Amazon GuardDuty (EKS Protection) + Falco | monitoring | Falco "monitor[s] and analyz[es] container syscalls (container drift detection rule)" to contextualize GuardDuty findings |
| 30 | Admission controllers | Custom webhooks enforcing approved registries and pod security context | in-house webhooks on Kubernetes | policy-engine | block unapproved images, elevated container permissions |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| snapchat-client | api-gateway | gRPC over QUIC/HTTP3 (UDP) | sync | not stated | Cronet stack; connection migration survives IP change (+20% Android success on wifi loss) |
| api-gateway | messaging-core-service | gRPC/HTTP2 via mesh | sync | not stated | after the auth / rate-limit / load-shed filter chain |
| api-gateway | media-service | gRPC/HTTP2 via mesh | sync | not stated | send path, step 2 |
| media-service | s3-media-store | S3 API | sync | not stated | media persisted before conversation write |
| media-service | friend-service | gRPC/HTTP2 via mesh | sync | not stated | permission check on send |
| friend-service | messaging-core-service | gRPC/HTTP2 via mesh | sync | not stated | friend status validated, then conversation written |
| messaging-core-service | dynamodb-conversation-store | DynamoDB API (cross-account role) | sync | not stated | "Conversation stored in DynamoDB" |
| snapchat-client | messaging-core-service | gRPC over QUIC | sync | not stated | receive path: fetch message metadata |
| messaging-core-service | snapchat-client | gRPC over QUIC | sync | not stated | returns a media file pointer, not the bytes |
| snapchat-client | media-service | gRPC over QUIC | sync | not stated | receive path: resolve the pointer |
| media-service | cloudfront | https | sync | not stated | media loaded from the content system (CloudFront/S3) |
| cloudfront | s3-media-store | https | sync | not stated | CDN origin fetch on miss |
| snapchat-client | client-sqlite-store | SQLite | sync | local durability | C++ core persists message history and sync state on device |
| service-container | envoy-sidecar | localhost | sync | not stated | all ingress and egress; TLS and metrics applied by default |
| envoy-sidecar | envoy-sidecar (peer service) | gRPC / HTTP2 over mTLS | sync | not stated | client-side load balancing, circuit breaking, retries, timeouts per Switchboard config |
| envoy-sidecar | xds-control-plane | bidirectional gRPC stream | async (streamed push) | not stated | every Envoy on the Mesh holds an open stream to its regional control plane |
| xds-control-plane | envoy-sidecar | xDS over gRPC stream | async | not stated | canary: small subset first, health measured over minutes before full commit; consistent rollout and rollback semantics |
| switchboard | dynamodb-config-store | DynamoDB API | sync | not stated | "Configuration changes in Switchboard are saved to DynamoDB" |
| switchboard | xds-control-plane | not stated | async | not stated | Switchboard generates the config that the control plane distributes |
| switchboard | eks-clusters / gke-clusters | cloud provider APIs | async | not stated | provisions and manages Kubernetes clusters on both providers |
| switchboard | spinnaker | not stated | async | not stated | generates deployment pipelines with canaries, health checks, zonal rollouts |
| gcp-client-services | caching-secondary-user-service | gRPC via mesh | sync | not stated | GCP-side read path for user data |
| caching-secondary-user-service | keydb-cache | Redis protocol | sync | not stated | hit: p99 1.56–2.11 ms |
| caching-secondary-user-service | user-service (aws us-east-1) | gRPC via mesh, cross-cloud | sync | not stated | miss: p99 49–133 ms, then backfills the cache |
| user-service | dynamodb-conversation-store | DynamoDB API | sync | not stated | authoritative user reads/writes |
| writing-services | secondary-service-cache-invalidator | not stated | async | not stated | fires when data is written to DynamoDB elsewhere |
| secondary-service-cache-invalidator | keydb-cache | Redis protocol | async | not stated | event-driven invalidation on top of the 24h TTL |
| advertiser-client | ads-reporting-workflow (via api) | not stated | async | at-least-once (duplicates expected; idempotency required) | "the same request will be resent" when the advertiser's network drops during the response |
| temporal-cluster | data-fetching-service | Temporal task queue (worker poll) | async | at-least-once, state persisted | workers pull execution tasks from the Temporal Server |
| data-fetching-service | report-generation-service | Temporal workflow step | async | at-least-once | file handoff; analytics job runs for minutes |
| report-generation-service | notification-service | Temporal workflow step | async | at-least-once | retried until the notification actually goes out |
| notification-service | advertiser (email) | email | async | not stated | terminal step of the workflow |
| service-pods | iam (IRSA / cross-account roles) | OIDC / STS | sync | not stated | pods in compute accounts assume roles into tenant data accounts |
| envoy-sidecar | metrics backend | metrics push | async | not stated | latency, connections, requests, retries, circuit-breaker events on all inbound and outbound traffic |
| eks-audit-logs | guardduty | log ingest | async | not stated | EKS Protection analyzes audit logs for unauthorized patterns |
| falco-agent | guardduty findings | not stated | async | not stated | container syscall monitoring contextualizes findings |

## Failure modes, incidents, tradeoffs the source discusses
- **Blast radius was the reason to leave the monolith.** "They wanted clear, explicit relationships between components to limit the blast radius during outages." Shared datastores were removed so teams could "iterate quickly and independently on their data models". (https://eng.snap.com/monolith-to-multicloud-microservices-snap-service-mesh)
- **Config pushes are the most dangerous change, so they are canaried.** The control plane "sends the updated config to a small subset of Envoys and measures their health over a period of minutes before committing the changes". Centralized config generation is what buys "consistent rollout and rollback semantics". (same)
- **Deliberately withholding configurability.** "If we surfaced the entire Envoy API for Snap engineering teams, we could find ourselves supporting a combinatorial explosion of configurations." Snap exposes only service-specific and operational knobs: "connect timeouts, healthcheck endpoints, circuit breaker policies, and retry policies". Tradeoff: operability over expressiveness. (same)
- **Open source alone was not enough.** "We would need to own the implementation to meet Snap's custom requirements" — Snap runs its own Envoy build and its own control plane rather than a packaged mesh. (same)
- **One cluster per microservice did not scale operationally.** "Managing thousands of clusters added an operational burden as microservices grew" — Snap consolidated onto shared multi-tenant EKS/GKE clusters with namespace isolation, trading isolation for operability. (https://aws.amazon.com/blogs/containers/how-snap-inc-secures-its-services-with-amazon-eks/)
- **IPv4 address exhaustion inside the cluster fleet.** Snap identified IPv4 exhaustion as a limitation and "wanted to migrate gracefully to IPv6" using EKS IPv6 and dual-stack support. (same)
- **Cross-cloud reads are a latency cliff.** GCP-side services reading user data from DynamoDB in AWS us-east-1 saw p99 of 49–133 ms; the KeyDB cache brought hits to 1.56–2.11 ms. The tradeoff is a 24-hour-stale read window, mitigated by event-driven invalidation. (https://cloud.google.com/blog/products/application-modernization/snap-deploys-keydb-on-google-cloud-to-reduce-cross-cloud-latency)
- **Partial-failure in a multi-step async job.** "if a report is generated and the notification service goes down, then the advertiser will not be able to receive the notification" — the argument for durable workflow state rather than in-process orchestration. (https://eng.snap.com/en-US/build_a_reliable_system_in_a_microservices_world_at_snap)
- **Client retries create duplicates, so handlers must be idempotent.** "if advertisers send out the request... when a response is being sent back, their network goes down... the same request will be resent"; duplicates hurt "if the system is not idempotent or jobs are extremely costly". (same)
- **TCP head-of-line blocking and connection loss on mobile networks.** QUIC's connection id lets clients "continue in-flight requests, uninterrupted across a change in IP address"; Android request success on wifi loss rose 20%, network errors fell 3–8%. (https://eng.snap.com/quic-at-snap)
- **Duplicated client logic causes behavioural divergence.** "Messaging logic is always expressed in C++ code and the presentation layer lives in Android and iOS code" — one C++ core and one SQLite schema so the two platforms cannot drift. (https://eng.snap.com/cross_platform_messaging_experience)
- **Single-cloud dependency named as a material risk.** "Any transition of the cloud services currently provided by Google Cloud to another cloud provider would be difficult to implement and will cause us to incur significant time and expense", against "we currently run the vast majority of our computing on Google Cloud". The mesh tenet "Abstract the differences between cloud providers where we can... so it's feasible to shift services between AWS, GCP, and other cloud providers" is the engineering answer to that risk. (S-1, 2017; service-mesh post, 2020)
- **Security posture pushed into the platform, not the service.** Tenet 1: "Authentication, authorization, and network security should be defaults, not optional, within the platform." Envoy enforces TLS on all inbound and outbound traffic without service involvement; data stores sit in separate AWS accounts reached only by assumed roles.

## Unknowns
- Stories fan-out and ranking: no fetched source describes how Stories are assembled, fanned out or ranked. The AWS post covers only the one-to-one Snap send/receive chain.
- Which datastore backs which product surface. Spanner, Firestore and Bigtable are named in Snap's datastore inventory, but no fetched source says what runs on each.
- Whether the receive path is push or poll. The messaging-client post says the C++ library publishes changes to the presentation layer, but neither it nor any other fetched source names a push channel, a long-lived stream, or a notification fan-out service.
- Ordering and delivery guarantees for messages. No fetched source states per-conversation ordering, exactly-once, or at-least-once for the Snap send path.
- Ephemerality mechanics: how and when Snap media is actually deleted, and how that interacts with S3 / Glacier Instant Retrieval retention.
- The relative split of traffic between AWS and GCP today, and which regions are in which cloud.
- Whether Switchboard/xDS is itself multi-region-redundant, and what the failure mode is when a regional control plane is unavailable (Envoys presumably run on last-known config, but this is not stated).
- The current state of the API Gateway's rate limiting and load shedding algorithms — named as custom filters, never described.
- Post-2020 evolution of the mesh: the service count, qps and region count are 2020 figures.

## Candidates
- New kinds: none strictly required. Two gaps worth noting — a `control-panel` / `service-catalog` kind for Switchboard (currently forced into `coordination-service`, which undersells that it provisions clusters and generates pipelines), and an explicit split between `service-mesh` data plane (sidecar) and control plane, since Snap's card needs both as separate boxes with different properties.
- New properties on existing kinds:
  - `service-mesh.plane` (data | control); `service-mesh.deployment` (sidecar | per-node | client-library)
  - `service-mesh.configCanary` (boolean) and `service-mesh.configCanaryWindow` (duration) — the "small subset of Envoys, measured over minutes" pattern
  - `service-mesh.tlsByDefault` (boolean)
  - `cache.crossCloudFronting` (boolean) — a cache whose backing store is in a different cloud
  - `cache.invalidation` (ttl | event | both)
  - `api-gateway.filters` (list: auth, rate-limit, load-shed)
  - `container-orchestrator.tenancy` (single-service | multi-tenant) and `.isolation` (namespace | cluster | account)
  - `client.transport` (http2 | http3-quic | websocket) and `client.connectionMigration` (boolean)
  - `app-server.cloudProvider` / `.region` so a cross-cloud edge is detectable at all
- New requirement paths:
  - `topology.multiCloud` (boolean) and `topology.providers` (list) — the whole card hinges on it
  - `availability.regionDrainSupported` (boolean)
  - `consistency.staleReadWindow` (duration) — 24h here
- New rules (name + one-line condition):
  - `cross-cloud-sync-read-without-cache`: a sync edge whose endpoints have different `cloudProvider` and no cache on the reading side
  - `cross-cloud-edge-without-latency-budget`: a sync edge crossing providers with no `timeoutMs` declared
  - `cache-with-ttl-only-invalidation-on-mutable-data`: cache with `invalidation: ttl` fronting a store that other services write
  - `mesh-config-push-without-canary`: `service-mesh` control plane with `configCanary` false
  - `service-without-sidecar-on-meshed-design`: an `app-server` in a design declaring a `service-mesh` data plane but reached by a direct edge that bypasses it
  - `externally-exposed-service-behind-no-gateway`: any node reachable from a `client` that is not an `api-gateway` when the design declares a single-front-door boundary
  - `multi-step-async-workflow-without-durable-state`: async worker chain of 3+ hops with no `workflow-engine` or event store holding progress
  - `retryable-client-edge-without-idempotency`: async or retried edge into a `worker` with no idempotency key declared
  - `single-provider-dependency-with-multi-cloud-requirement`: `topology.multiCloud` true but every stateful node on one provider
