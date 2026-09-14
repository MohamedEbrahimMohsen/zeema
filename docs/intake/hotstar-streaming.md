# Intake: Disney+ Hotstar / JioHotstar live cricket streaming at record concurrency

## Source
- Primary: https://blog.hotstar.com/scaling-infrastructure-for-millions-from-challenges-to-triumphs-part-1-6099141a99ef (Ajay Choudhary, Hotstar cloud infrastructure engineering, official engineering blog, 2024) — CDN as external API gateway, internal API gateway, EKS limits, network limits
- Primary: https://blog.hotstar.com/scaling-infrastructure-for-millions-datacenter-abstraction-part-2-42b04ef5ed6a (Ajay Choudhary, official engineering blog, 2025) — Datacenter Abstraction, Envoy internal gateway, six EKS clusters, 61M concurrent
- Primary: https://blog.hotstar.com/t-for-tsunami-dealing-with-traffic-spikes-c22443bcdd3e (Akash Saxena, then head of Hotstar engineering, official engineering blog, 2017) — tsunami traffic, progressive degradation, positive/negative panics, pre-warming
- Primary: https://d1.awsstatic.com/events/reinvent/2019/Scaling_Hotstar.com_for_25_million_concurrent_viewers_CMY302.pdf and the recording https://www.youtube.com/watch?v=QjvyiyH4rr0 (Gaurav Kamboj, Cloud Architect, Hotstar; AWS re:Invent 2019, session CMY302) — concurrency ladder, Game Day, why not autoscaling, panic mode
- Primary: https://www.slideshare.net/hotstar-engineering/scaling-hotstarcom-for-10mn-concurrency (official `hotstar-engineering` account, 2018) — 10M-era numbers, Project HULK, pre-warm/buffer/spot-fleet scaling strategy
- Primary: https://blog.hotstar.com/orchestrating-jiohotstar-traffic-the-difference-between-a-loading-spinner-and-a-winning-six-8a385b01380e (Karan Kaul, official engineering blog, 2026) — QoS Routing Manager, ARGUS OLAP, multi-CDN steering
- Primary: https://blog.hotstar.com/beyond-manual-checks-how-we-built-a-24-7-watchdog-for-live-sports-streaming-026fdcaebc5e (Abhishek Sinha, official engineering blog, 2026) — video validation orchestrator, CMS, encoders, SSAI stitchers, CDN parity checks
- Primary: https://blog.hotstar.com/hotstar-x-journey-part-1-why-rewrite-d7042de21bcf (Harsh Mittal, official engineering blog, 2022) — the legacy "Rocky" client-orchestrated architecture and the move to server-driven "X"
- Primary: https://blog.hotstar.com/journey-of-an-ad-request-the-hidden-engineering-e7b7f9921e46 (Ayush Kumar, official engineering blog, 2026) — SSAI/CSAI/SGAI ad path, <100 ms decisioning
- Secondary: https://dev.classmethod.jp/articles/reinvent-2019-cmy302/ (Classmethod DevelopersIO session notes on CMY302, 2019) — corroborates the talk's numbers (90 s boot time, insufficient-capacity errors, spot fleet, HULK scenarios)
- Secondary: https://aws.amazon.com/blogs/media/in-the-news-hotstar-sets-new-global-record-for-live-viewership/ (AWS Media blog, 2019) — 18.6M concurrent at IPL 2019 final
- Secondary: https://hasgeek.com/rootconf/2019-pune/sub/scaling-hotstar-com-for-25-million-concurrent-view-MjkchhLMLRkf2E64gJgUGT (Rootconf talk page for the same engineer's talk)
- Verified by: official Hotstar/JioHotstar engineering blog (8 posts fetched in full), AWS re:Invent 2019 conference talk by a Hotstar cloud architect, official Hotstar engineering SlideShare; corroborated by AWS Media blog and conference session notes
- Confidence: high
- Date of source: 2017, 2018, 2019, 2022, 2024, 2025, 2026

## System in three lines
Streams live cricket to India at the highest live concurrency ever recorded — 25.3M in 2019, 59M during the 2023 ODI World Cup, 61M+ at the 2026 Champions Trophy final — alongside an on-demand OTT catalogue. Client apps hit a CDN that doubles as the external API gateway, which routes into an Envoy internal gateway fronting 200–800 microservices on six EKS clusters grouped into a logical "data center", while video leaves stadium encoders through SSAI stitchers to four-plus CDNs steered per user cohort. It is hard because traffic is a *tsunami*, not a ramp: a wicket or a push notification takes an API from 10K to 125K TPS in seconds, faster than any instance can boot, and the last five overs of a match consume the last available megabits of CDN bandwidth in the country.

## Scale (only if stated)
- Users / DAU: "more than 100 million unique users" in one day; 350M+ downloads (re:Invent CMY302 slides, 2019)
- Peak concurrency ladder: 4.02M / 4.2M / 4.69M (Champions Trophy 2017, https://blog.hotstar.com/t-for-tsunami-dealing-with-traffic-spikes-c22443bcdd3e); 10.3M (IPL 2018 final); 13.9M, 16.2M, 18.6M (IPL 2019 final), 25.3M (World Cup 2019 India vs New Zealand) — all on the CMY302 slides; ~25M on two self-managed Kubernetes clusters before 2023 (part 1); 59M concurrent streams for the 2023 ODI World Cup (part 1); "over 61 million concurrent users" (part 2)
- Requests per second: 1M peak RPS at the 10M-concurrency era (https://www.slideshare.net/hotstar-engineering/scaling-hotstarcom-for-10mn-concurrency); login API went from 10K TPS to 125K TPS in seconds on one push notification (tsunami post)
- Bandwidth: 5.7 Tbps peak at 10M concurrency (SlideShare); "upwards of 60–80 Tbps of network bandwidth" for a live event (https://blog.hotstar.com/orchestrating-jiohotstar-traffic-the-difference-between-a-loading-spinner-and-a-winning-six-8a385b01380e)
- Message throughput: 10Bn+ clickstream messages, 100+ hours of live transcoding every day (SlideShare); "millions of tracker events per second" in the ad pipeline (ad-request post)
- Services and clusters: 800+ services on two legacy KOPS clusters; 200+ services migrated onto six production EKS clusters; 400+ worker nodes needed per cluster (parts 1 and 2)
- Live streams: "close to 55 concurrent live streams" at peak, 12 languages, 5 camera angles, 74 matches over 2 months, "100s of encoders for every match" (watchdog post)
- Load-testing fleet: 36,000 CPUs, 72 TB RAM, 80 Gbps network out across 8 geo-distributed regions for Project HULK (SlideShare)

## Requirements stated or clearly implied
- Availability target: "P0 services must be always up" (CMY302 panic-mode slide). DR infrastructure in place with tested failovers (tsunami post). Multi-AZ within a region; a "data center" is a group of clusters *within a region*, and cluster loss is handled by moving apps to another cluster in the same DC without endpoint changes (part 2). Region-loss survival is not claimed.
- Consistency: not stated. Heavy multi-layer caching is stated as mandatory: "none of this really stands up without caching at multiple levels" (tsunami post).
- Latency target: not quantified for the API path. Ad decisioning stated at "under 100 milliseconds" (ad-request post). Player-side SLAs are expressed as QoE metrics: Playback Failure Rate, rebuffering, RTT (QoS routing post).
- Ordering needs: not stated.
- Replay or reprocessing needs: not stated. Device heartbeats are streamed into ARGUS continuously (QoS routing post).
- Retention: not stated.
- Compliance / residency: not stated. CDN selection is constrained by ASN and contract ("some CDNs only have presence on specific networks"), which is a hard routing constraint rather than a residency rule.
- Degradation is a first-class requirement: "The video must play!" — everything else is a lever. Bitrate ladders degrade as concurrency grows; refresh rates for scorecard, watch-more, live feeds and key moments are dialled down to save bandwidth (part 1, tsunami post).
- Elasticity requirement: capacity must be in place *before* the spike, because "traditional autoscaling doesn't work" at a growth rate of ~500K concurrency per minute against a ~90-second application boot.

## Boundaries
- Regions / zones: AWS. Multiple availability zones per region, three private subnets across AZs per EKS cluster (/20 originally, then /19, guideline /18). Load generation for game days ran from us-east-1, us-west-1, eu-west-1 and eu-west-2 (CMY302 slides).
- "Data center" (DC): a Hotstar-specific abstraction — a logical grouping of multiple EKS clusters within one region that behaves as a single compute unit; applications are namespaced by DC, not by cluster. Six EKS clusters in production.
- Trust zones: public internet / client devices → CDN edge acting as external API gateway (security checks, rate controls, routing rules) → ALB fleet → internal Envoy API gateway inside a private VPC → services on private subnets reaching the internet only through NAT gateways.
- Endpoint classes as explicit boundaries: `intra-DC` (`<service>.internal.<internal-domain>`), `inter-DC` (`<service>.internal.<dc>.<internal-domain>`), `external` (`<service>.<public-domain>`).
- Named subsystems: X architecture (server-driven platform, successor to "Rocky"), Datacenter Abstraction, Project HULK (load testing), QoS Routing Manager, ARGUS (OLAP), Video Validation Orchestrator, Video Validator, Play Portal, CMS, Ads stack, Personalisation stack (each P0 stack isolated to its own cluster).

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Client apps | Android, iOS, Web, Connected TV, 20+ apps/platforms; server-driven UI under X | in-house | client | 12 languages, 5 camera angles; client-side caching and jitter tuned to "smoothen the wave" |
| 2 | External API Gateway (CDN) | The CDN *is* the external API gateway: TLS, security checks, rate controls, request unpacking, routing rules | not named for this role (Akamai, CloudFront and Jio named as video CDNs) | cdn | edge + mid-gress node tiers; compute-bound when acting as a proxy, which caps total throughput |
| 3 | Cacheable-path CDN domain | Separate CDN domain with leaner security/rate rules for highly cacheable live features (scorecard, concurrency, key moments) | in-house configuration | cdn | isolation: separate domain; "optimized security and configuration rules for the cacheable paths"; refresh rates tuned down under load |
| 4 | Application Load Balancer fleet | Fronts the internal API gateway; previously one ALB per service (200+), now a shared fleet | AWS ALB (+ AWS Load Balancer Controller) | load-balancer | pre-warming required before events; ALB controller targets Pod IPs directly after the ClusterIP migration |
| 5 | Internal API Gateway | Central proxy layer: routing to backend services, centralised auth, rate limiting, load shedding, service discovery; installed on every cluster as ingress controller | Envoy | api-gateway | deployed on all clusters; topology spread constraints, one pod per node; 2–3 Gbps per node at peak; did not support EndpointSlice discovery |
| 6 | EKS clusters | Managed Kubernetes data plane running the services; six in production, grouped into a logical data center | Amazon EKS | container-orchestrator | 6 clusters; 400+ nodes each; scale-up in steps of 100–300 nodes; API server errors above ~400 simultaneous nodes; legacy predecessors were KOPS clusters on Kubernetes v1.17 |
| 7 | Data Center abstraction layer | Logical grouping of clusters in a region into one compute unit; one namespace per team per DC; platform-level routing hides cluster placement | in-house platform | service-mesh | enables cluster failover with no endpoint change; single base manifest per service with environment overrides |
| 8 | Worker nodes | Compute for pods; high-throughput instance types | AWS EC2 (c6i, c5i, Graviton named as the targets; c4.4xlarge/c4.8xlarge in the 2018 era) | virtual-machine | minimum 10 Gbps NICs; spot fleet with diversified instance types; pre-warmed rather than autoscaled |
| 9 | NAT Gateways | Egress for private subnets | AWS NAT Gateway | nat-gateway | moved from one per AZ to one per subnet; one cluster was at 50% of NAT throughput at 1/10th of peak load |
| 10 | VPC CNI / IP address plane | Assigns IPs to nodes and pods in the EKS clusters | Amazon VPC CNI plugin | network-fabric | MINIMUM_IP_TARGET 35→20, WARM_IP_TARGET 10→5; subnets /20 → /19 (≈48K IPs), guideline /18; 40% IP utilisation held through World Cup 2023 |
| 11 | Backend microservices | 200+ (formerly 800+) domain services: catalogue, payments, ads, recommendations, personalisation, login/subscriptions/watch | in-house | app-server | some services exceeded 1000 pods and had to be scaled vertically instead; ClusterIP services; guaranteed/burst CPU+memory in the base manifest |
| 12 | Login / subscription / watch (Tier 1) service | The critical user-journey path; "P0" | in-house | app-server | 10K→125K TPS spike observed; caching options limited by the nature of login requests |
| 13 | Databases (managed and self-hosted) | Persistence behind the backend services | "a bunch of managed and self-hosted database solutions" — not named | sql-database | not stated; one melted down and swapped during the 2017 tsunami because it was not scaled in proportion to the front-end fleet |
| 14 | Multi-layer cache | "aggressive caching at multiple layers" in front of services; distributed cache holds ad frequency caps across millions of users | not named | cache | frequency-cap state per user; caching described as a precondition for the whole design |
| 15 | Video encoders | Encode the live feed into per-language, per-camera-angle, per-device variants (Dolby Vision, Dolby 5.1, HDR10, 4K) | in-house encoding systems | media-transcoder | "100s of encoders for every match"; 100+ hours of live transcoding per day; individual variants can fail independently |
| 16 | SSAI manifest stitchers | Server-side ad insertion into the live manifests; CUE-IN/CUE-OUT markers | not named | worker | SSAI stitched at cohort level; CSAI and SGAI also used; "Empty VAST" errors watched for |
| 17 | Video CDNs (multi-CDN) | Deliver the video segments; multiple providers in parallel | Akamai, CloudFront, JIO CDN ("etc.") | cdn | 60–80 Tbps aggregate at event peak; each CDN has ASN presence constraints; per-CDN bandwidth utilisation tracked |
| 18 | QoS Routing Manager | Real-time orchestration engine that assigns CDN traffic weights per user cohort | in-house | policy-engine | cohort = ASN-Country-State-City-UserType; score = X·PFR + Y·Rebuffer + Z·RTT via linear piecewise scoring; EWMA α≈0.6 over last ~5 scores; max-deviation cap per minute; minimum weight floor ~5%; two-phase capacity steering (pre-threshold guardrail, then uniform exhaustion) |
| 19 | ARGUS | In-house OLAP engine collecting device heartbeats and serving video-performance telemetry | ARGUS (in-house) | timeseries-database | collects heartbeat data from devices, processes it, serves telemetry to the routing service |
| 20 | Content Metadata System (CMS) | Source of truth for scheduled matches, regional feeds, camera angles, publish/unpublish state | CMS (in-house) | content-repository | polled by the orchestrator; moving toward publish/unpublish events |
| 21 | Video Validation Orchestrator | Discovery-and-dispatch controller that spins validation workers up before match start and down on unpublish | in-house | workflow-engine | polls CMS; dispatches two concurrent validation strategies per stream |
| 22 | Video Validator | Server-side watchdog on manifests: discontinuities, missing segments, media-sequence drift, SSAI cue integrity, CDN edge parity | in-house | worker | scales on Kubernetes HPA; verifies "all CDN edges are serving identical, healthy chunks" |
| 23 | Play Portal | Synthetic playback on real devices (Android, iPhone, TV, web browsers) checking handshake, audio tracks, rebuffering | in-house | worker | real-device fleet; playback-handshake SLA |
| 24 | Grafana dashboards / TV wall | Operations view during the event; dashboards on rotation on a physical wall during matches | Grafana; Revolver Chrome plugin for the 2017 TV wall | monitoring | dashboards tracked per phase of the match (toss, first ball, middle overs, death overs, unpublish) |
| 25 | Project HULK load generator | Geo-distributed load generation for game days: baseline load, tsunami spikes, chaos (AZ loss), ML-based traffic modelling | HULK (in-house) | worker | 36,000 CPUs, 72 TB RAM, 80 Gbps out, 8 regions; generators run from us-east-1, us-west-1, eu-west-1, eu-west-2 |
| 26 | Custom scaling controller | Replaces AWS autoscaling: pre-warms and scales on request count and platform concurrency, not CPU | in-house (Python scripts per CMY302 notes); Karpenter named as the modern goal | policy-engine | step size capped at 100–300 nodes per step to avoid API-server throttling; pre-warm + buffer capacity + secondary ASG + spot fleet |
| 27 | Ad decisioning service | Filters ~10,000 candidate ads to a winner per request; frequency capping, pacing (PID, SHALE), priority waterfall | in-house; third-party SSPs for programmatic | app-server | decision under 100 ms; programmatic-guaranteed fill 80–100%, open exchange 1–2% |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| client apps | external API gateway (CDN) | HTTPS | sync | — | security checks, rate controls, request unpacking, routing rules at the edge |
| client apps | cacheable-path CDN domain | HTTPS | sync | — | scorecard, concurrency, key moments; leaner rule set; client refresh rates tuned down under load |
| external API gateway (CDN) | ALB fleet | HTTPS | sync | — | CDN forwards non-cached API calls to the internal tier |
| ALB fleet | internal API gateway (Envoy) | HTTP | sync | — | ALB controller targets Pod IPs (ClusterIP era); previously NodePort on any worker node |
| internal API gateway (Envoy) | backend microservices | HTTP | sync | — | central auth, rate limiting, load shedding; service discovery via Endpoints API (1000-endpoint truncation limit) |
| backend microservice | backend microservice | HTTP | sync | — | same path as external traffic; intra-DC endpoint `<service>.internal.<internal-domain>` |
| backend microservice (DC A) | backend microservice (DC B) | HTTP | sync | — | inter-DC endpoint `<service>.internal.<dc>.<internal-domain>` |
| backend microservices | databases (managed and self-hosted) | not stated | sync | — | must be scaled in proportion to the front-end fleet; the 2017 incident was a DB not scaled with it |
| backend microservices | multi-layer cache | not stated | sync | — | "aggressive caching at multiple layers" |
| backend microservices | internet (third-party) | via NAT gateway | sync | — | NAT gateway per subnet after ENI flow-log analysis showed heavy external egress |
| stadium feed | video encoders | not stated | sync (live) | — | 100s of encoders per match producing language / angle / device / HDR variants |
| video encoders | SSAI manifest stitchers | not stated | sync (live) | — | CUE-IN/CUE-OUT markers stitched into the live manifest |
| SSAI stitchers | video CDNs (Akamai, CloudFront, Jio) | HTTP | sync | — | ingest; manifest 404s at the edge caught by validation before publish |
| client player | video CDN edge | HTTPS (HLS/DASH) | sync | — | CDN chosen per cohort by the weights the QoS Routing Manager publishes |
| client devices | ARGUS | heartbeat | async | not stated | device heartbeats for PFR, rebuffering, RTT |
| ARGUS | QoS Routing Manager | not stated | async (pull) | — | real-time telemetry feed; smoothed through EWMA before scoring |
| QoS Routing Manager | CDN traffic weights / DNS steering | not stated | async | — | per-cohort weights; max % change per minute; never below ~5% per functional CDN |
| CMS | Video Validation Orchestrator | HTTP poll | sync (polling) | — | source of truth for scheduled matches, feeds, angles, publish state; event-driven planned |
| Video Validation Orchestrator | Video Validator workers | not stated | async (dispatch) | — | spin up before match start, spin down on unpublish |
| Video Validation Orchestrator | Play Portal (real devices) | not stated | async (dispatch) | — | parallel to server-side validation |
| Video Validator | video CDN edges | HTTP | sync | — | fetches manifests/chunks from every edge to verify parity |
| Video Validator / Play Portal | Grafana dashboards | metrics | async | — | alerts raised to on-call teams |
| Project HULK generators | external API gateway (CDN) and downstream | HTTPS | sync (synthetic) | — | game-day load from 4+ AWS regions; tsunami, chaos and ML-modelled profiles |
| custom scaling controller | EKS API server / EC2 | AWS API | sync | — | 100–300 nodes per step to avoid API-server throttling and insufficient-capacity errors |
| client player | ad decisioning service | not stated | sync | — | under 100 ms budget; programmatic path calls third-party SSPs |
| ad tracker events | big-data pipeline | not stated | async | not stated | "millions of tracker events per second" |

## Failure modes, incidents, tradeoffs the source discusses
- **The tsunami pattern itself.** A push notification when Virat Kohli walked in to bat: "Our login API that was cruising at 10K TPS, shot up to 125 K TPS in a matter of seconds." The fleet had been scaled for 7M concurrency but "our calculation had failed to factor in the Tsunami pattern" — the database was not scaled in proportion to the front-end fleet, "the database started to melt down and swapped at one point." (https://blog.hotstar.com/t-for-tsunami-dealing-with-traffic-spikes-c22443bcdd3e)
- **Autoscaling does not work at this slope.** CMY302's slide is literally titled "Why we don't use auto scaling"; the SlideShare lists insufficient-capacity errors, one instance type per ASG, step-size limits, API throttling and exponential backoff. The answer is pre-warming plus buffer capacity plus a secondary ASG plus a diversified spot fleet, driven by request count and platform concurrency rather than CPU. (CMY302 slides; https://www.slideshare.net/hotstar-engineering/scaling-hotstarcom-for-10mn-concurrency)
- **Panic mode.** The CMY302 panic-mode slide reads: "P0 services must be always up / Graceful Degradation / Turn off non-critical services." The 2017 post gives the earlier form: "we've got to think of multiple levers and actually think of progressive degradation… We need to build in 'positive panics' and 'negative panics' to be able to take away traffic from the origin when traffic goes beyond platform ratings." Tier 1 actions (login, subscriptions, watch) "must be able to keep going visibly… but could be deferred in the back-end", Tier 2 (account, logout) "could just temporarily show failure messages."
- **Bitrate is a lever.** "The key levers are the bit-rates at which we offer the content, which must degrade as concurrency grows because we're limited by hard bandwidth in the infrastructure." (tsunami post) The 2024 post adds the API-side lever: "By adjusting the refresh rates for features like scorecards, Watch-more, live feeds, and key moments, we reduced the strain on our peak network bandwidth."
- **The CDN-as-gateway ceiling.** Edge nodes doing security checks and rate controls are compute-bound, which "caps the overall throughput that one can push through the external gateway." Fix: split APIs into cacheable and non-cacheable and give the cacheable set its own CDN domain with leaner rules — "This ensured better isolation and prevented any side effects from misconfigurations." (part 1)
- **NAT gateway saturation.** "one of the Kubernetes clusters was already using 50% of its network throughput capacity at just 1/10th of the peak traffic load." Fix: NAT gateways per subnet instead of per AZ, plus rebalancing services across clusters. (part 1)
- **Node-level bandwidth hot spots.** Nodes running several internal API gateway pods hit 8–9 Gbps. Fix: 10 Gbps+ nodes and topology spread constraints so each node hosts one gateway pod, holding 2–3 Gbps per node. (part 1)
- **IP exhaustion (production incident).** "Ahead of the 2023 World Cup, we faced a critical production incident in one of our Kubernetes clusters due to an IP address shortage… we couldn't scale beyond 350 nodes." Caused by MINIMUM_IP_TARGET 35 + WARM_IP_TARGET 10 wasting 40–50% of IPs. Fix: /19 then /18 subnets and CNI targets of 20/5. (part 1)
- **EKS control-plane throttling.** "When scaling the cluster to over 400 nodes simultaneously, we began experiencing API server errors… the retries introduced a slight delay in scheduling pods and nodes." Fix: 100–300 node scale steps, automated to remove human error. (part 1)
- **The 1000-endpoint truncation.** A service past 1000 pods saw pod traffic swing "from zero to several thousand requests per second" because Kubernetes truncates the Endpoints object (`endpoints.kubernetes.io/over-capacity: truncated`) and the gateway did not support EndpointSlices. Fix: vertical scaling to cap services below 1000 pods. (part 1)
- **NodePort exhaustion and per-service ALBs.** 800+ services on LoadBalancer/NodePort services hit the 30000–32767 port range, and pre-warming 200+ discrete load balancers before each tournament was "a high touch… organization-wide operationally challenging campaign." Fix: ClusterIP + pod-IP ALB targets, and one Envoy gateway fleet instead of per-service load balancers. (part 2)
- **Legacy clusters as a scaling dead end.** Kubernetes v1.17 KOPS clusters could not use c6i/c5i/Graviton instances or Karpenter, and "the traditional cluster autoscaler… is slower in consolidating nodes, resulting in resource wastage." (part 2)
- **P0 stack co-location.** "high-priority services like Ads and Personalisation couldn't coexist in the same cluster since both require significant compute and network resources during peak traffic. We limited each cluster to one P0 stack." (part 2)
- **Blast-radius tradeoff of DC abstraction.** Centralising auth, rate limiting and routing into one gateway fleet removed 200+ load balancers but concentrated the request path; the stated payoff is that "in case of cluster issues, apps can be moved to new clusters; no other changes are required, as the endpoint remains the same."
- **Routing volatility.** "If our routing engine reacted to every micro-spike, we would introduce dangerous volatility, creating a 'jittery' experience where users are constantly bounced between CDNs." Fixes: EWMA smoothing (α≈0.6), a max-deviation cap per iteration, ASN hard binding, and a warm-up floor — "We never let a functional CDN drop to 0% traffic… typically 5%… ensuring that if we need to fail-back to them instantly during a crisis, they are ready." (QoS routing post). The stated result of an A/B on ASN-State cohorts during a T20 match: PFR improved 11%, rebuffering and RTT 2%.
- **Silent streaming failures.** "A manifest might look perfect on a server (200 OK), but the actual player on a Smart TV might be stuck on a buffering wheel due a media sequence mismatch or due to ads related discontinuity tags or a DRM mismatch." Caught in production by the validators: manifest 404s from regional feeds that never reached the CDN edge, invalid SSAI/SGAI cues causing black-screen ad breaks, and media-sequence drift across bitrates causing infinite buffering. (watchdog post)
- **Orphaned automation.** Validation scripts "running for hours after a match ended because there was no central logic to tell them to stop. Automation is wonderful but cloud costs are real too." Fix: lifecycle-driven orchestrator keyed on CMS publish/unpublish.
- **Client-side orchestration was the original sin.** Under "Rocky", domain APIs were "directly exposed over CDN (as an api gateway) that the client would directly invoke", requiring app releases for every feature and multiple round trips before the UI could paint; the X rewrite moved orchestration server-side. (https://blog.hotstar.com/hotstar-x-journey-part-1-why-rewrite-d7042de21bcf)
- **Game day as policy.** Before every premier event: pre-warm cloud load balancers, confirm instance-type availability, test DR failovers, "Tested every 'panic' situation to ensure it did what it advertised", set explicit thresholds with ready-made scripts, and run the event from a single chat room with every decision logged. (tsunami post; CMY302 "Game Day — Face the real game before actual game")

## Unknowns
- Which database products sit behind the services. The posts say only "a bunch of managed and self-hosted database solutions"; no engine, sharding key, replication factor or consistency level is stated anywhere.
- What the cache layer actually is (product, eviction, TTL) beyond "aggressive caching at multiple layers" and "distributed cache" for ad frequency caps.
- Whether there is a message bus / stream between services. Clickstream volume (10Bn+/day) and "millions of tracker events per second" are stated but no broker is named.
- The concurrency counter itself (how live concurrency is computed and fanned out to clients) is listed as a cacheable feature but its implementation is never described.
- How CDN weights are actually enforced — DNS steering, manifest rewriting or a playback-authorisation service — is not stated; only that the QoS Routing Manager "adjusts traffic weights".
- The origin/packager tier between encoders and CDNs is implied by the SSAI stitchers and manifest checks but never drawn as a box.
- Region topology: everything described is within-region (AZs, subnets, clusters, one DC). Whether a second region is active, and how inter-DC traffic is routed in practice, is not stated.
- Authentication/DRM subsystem: DRM mismatch is named as a failure mode, but no licence server or identity component is described.
- "Project Hotspot" does not appear in any first-party source that could be fetched; only "Project HULK" is named by Hotstar. Do not carry the former into the design.
- Numbers from the CMY302 talk that only appear in attendee notes (≈90 s application boot, ~500K concurrency growth per minute, custom Python scaling scripts) are corroborated but not confirmed against a slide whose text could be extracted.

## Candidates
- New kinds: none required — every box maps to an existing kind. Closest gaps: an `origin-packager` for the live video origin tier (currently folded into `media-transcoder`/`worker`), and a `load-generator` for Project HULK (modelled as `worker`).
- New properties on existing kinds:
  - `cdn.role` (content | api-gateway | both) — the whole design turns on the CDN also being the external API gateway
  - `cdn.multiCdn` (boolean) and `cdn.steering` (static | dns | cohort-weighted)
  - `cdn.cacheablePathIsolation` (boolean) — separate domain with a leaner rule set
  - `api-gateway.internal` (boolean) and `api-gateway.perService` vs `shared` fleet
  - `container-orchestrator.clusterCount`, `.managedControlPlane` (boolean), `.nodeScaleStep`
  - `app-server.maxPods` / `.scaleAxis` (horizontal | vertical) — the 1000-endpoint ceiling
  - `app-server.priority` (p0 | p1 | p2) and `container-orchestrator.p0StacksPerCluster`
  - `virtual-machine.minNetworkGbps`, `.purchaseModel` (on-demand | spot-fleet | mixed)
  - `nat-gateway.granularity` (per-az | per-subnet)
  - `network-fabric.subnetCidr`, `.minimumIpTarget`, `.warmIpTarget`
  - scaling policy on any compute kind: `scaling.mode` (autoscale | pre-warm | hybrid), `scaling.signal` (cpu | rps | concurrency), `scaling.bufferPct`
  - `policy-engine.smoothing` (none | ewma) with `alpha`, `.maxDeviationPct`, `.minWeightPct`
- New requirement paths:
  - `traffic.pattern` (steady | diurnal | tsunami) with `traffic.spikeFactor` and `traffic.spikeSeconds`
  - `availability.degradationLevers` (list: bitrate, refreshRate, featureShed)
  - `availability.panicMode` (boolean) with `availability.p0Services` (list)
  - `delivery.bandwidthTbps`, `delivery.cdnCount`
  - `ops.gameDay` (boolean) — pre-event load test at full production scale
- New rules (name + one-line condition):
  - `tsunami-traffic-with-autoscale-only`: `traffic.pattern` is tsunami while every compute node has `scaling.mode: autoscale` and no pre-warm or buffer
  - `frontend-scaled-without-datastore`: an app-server fleet declares a spike factor while the database it calls declares no matching capacity or cache in front (the 2017 incident)
  - `cdn-as-api-gateway-without-path-split`: a `cdn` with `role: api-gateway` and no `cacheablePathIsolation` while `traffic.pattern` is tsunami
  - `single-cdn-for-live-peak`: `delivery.bandwidthTbps` above a threshold with `cdn.multiCdn` false
  - `cdn-steering-without-damping`: cohort-weighted steering with no `smoothing`, `maxDeviationPct` or `minWeightPct` (bounces users between CDNs)
  - `per-service-load-balancers-at-scale`: more than N services each owning a `load-balancer` instead of a shared internal gateway (pre-warming sprawl)
  - `nat-gateway-per-az-with-high-egress`: `nat-gateway.granularity: per-az` on a cluster whose services declare heavy external egress
  - `cluster-without-ip-headroom`: `network-fabric.subnetCidr` too small for `container-orchestrator` node and pod counts at declared concurrency
  - `service-over-endpoint-limit`: an app-server whose pod count at peak exceeds 1000 while its gateway discovers endpoints via the legacy Endpoints API
  - `p0-stacks-colocated`: two `app-server` groups with `priority: p0` scheduled onto the same cluster
  - `no-panic-mode-for-live-event`: a design with `traffic.pattern: tsunami` and no declared degradation levers or P0 list
  - `live-stream-without-edge-validation`: an SSAI/CDN delivery path with no validator probing every CDN edge and every variant
