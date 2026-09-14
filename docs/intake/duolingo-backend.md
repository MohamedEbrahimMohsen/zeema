# Intake: Duolingo backend platform (session generation, Birdbrain, microservices on ECS/EKS, high-scale push)

## Source
- Primary: https://blog.duolingo.com/rewriting-duolingos-engine-in-scala/ (Duolingo engineering blog, Session Generator rewrite, 2020)
- Primary: https://www.infoq.com/presentations/duolingo-high-scale-notification/ (Vitor Pellegrino, Site Reliability Engineering Lead, Duolingo, and Zhen Zhou, Software Engineer, Duolingo — QCon London 2024, "How We Created a High-Scale Notification System at Duolingo")
- Primary: https://www.infoq.com/presentations/duolingo-eks-kubernetes/ (Franka Passing, Senior Platform Engineer, Duolingo — InfoQ Dev Summit Munich 2026, "Duolingo's Kubernetes Leap")
- Primary: https://blog.duolingo.com/improving-the-duolingo-experience-with-request-tracing/ (Duolingo engineering blog, request tracing across microservices)
- Primary: https://blog.duolingo.com/learning-how-to-help-you-learn-introducing-birdbrain/ (Duolingo blog, Birdbrain launch, 2020)
- Primary: https://blog.duolingo.com/unique-engineering-problems/ (Duolingo engineering blog, "Inside Engineering at Duolingo")
- Primary: https://blog.duolingo.com/finops/ (Duolingo engineering blog, FinOps across 100+ microservices)
- Primary: https://blog.duolingo.com/reduce-cpu-usage-97-percent/ (Duolingo engineering blog, China SMS service incident postmortem)
- Primary: https://blog.duolingo.com/frontend-prediction/ (Duolingo engineering blog, frontend prediction / offline behaviour)
- Talk page: https://www.youtube.com/watch?v=gahR0_ZrYHs (AWS re:Invent 2018, CON360, "From Monolith to Microservices (And All the Bumps along the Way)", Max Blaze, Staff Operations Engineer, Duolingo) — video not fetchable
- Secondary (write-up of the above talk): https://dev.classmethod.jp/articles/reinvent2018-report-from-monolith-to-microservices/ (DevelopersIO session report)
- Verified by: official Duolingo engineering blog (8 posts fetched in full) + two conference talks by named Duolingo engineers (QCon London 2024, InfoQ Dev Summit Munich 2026) + a session write-up of a Duolingo re:Invent 2018 talk
- Confidence: high
- Date of source: 2018 (re:Invent), 2019–2020 (tracing, Birdbrain, Scala rewrite), 2024 (QCon notification talk), 2025–2026 (FinOps, SMS postmortem, EKS migration)

## System in three lines
Duolingo serves language lessons to 128M+ monthly active users from a backend that started as a Python monolith and is now 500+ services on AWS (ECS, migrating to EKS). The hot path is: mobile/web client → API servers → Session Generator, which assembles a lesson from offline-built course data in S3 plus per-learner difficulty estimates from the Birdbrain ML model stored in DynamoDB. It is hard because lesson generation must be single-digit-millisecond and never block on a chain of live dependencies, because engagement runs on streaks and push notifications that must fire in bursts of millions, and because a large fraction of learners are on low-end devices and unreliable networks.

## Scale (only if stated)
- Users: "150 million users", 88 language courses at the time of the Session Generator rewrite (https://blog.duolingo.com/rewriting-duolingos-engine-in-scala/)
- Users: 128+ million monthly active users; 400+ engineers; 30+ product engineering teams (https://www.infoq.com/presentations/duolingo-eks-kubernetes/)
- Services: 500+ backend services on ECS at the start of the EKS migration (https://www.infoq.com/presentations/duolingo-eks-kubernetes/)
- Services: "100 or more microservices", multi-language, at re:Invent 2018 (https://dev.classmethod.jp/articles/reinvent2018-report-from-monolith-to-microservices/); "100+ microservices" still the figure used for cost anomaly detection (https://blog.duolingo.com/finops/)
- Session Generator latency: 750 ms average → 14 ms average, a 98% reduction (https://blog.duolingo.com/rewriting-duolingos-engine-in-scala/)
- Push burst: 4 million notifications to users in ~5 seconds, target ~800,000 messages/second; p99 delivered in 5.7 s, p95 in 3.9 s (https://www.infoq.com/presentations/duolingo-high-scale-notification/)
- SQS in-flight ceiling worked around: 120,000 messages/second (https://www.infoq.com/presentations/duolingo-high-scale-notification/)
- Availability: monolith 0.99 → microservices 99.99% quarterly; compute cost reduced 60% (https://dev.classmethod.jp/articles/reinvent2018-report-from-monolith-to-microservices/)
- Session Generator degraded time: 0.1% of the time, "around 2 hours per quarter" → zero downtime in the first months after the rewrite (https://blog.duolingo.com/rewriting-duolingos-engine-in-scala/)
- Birdbrain rollout: 0% of lessons personalised in March 2020 → over 20% by October 2020 (https://blog.duolingo.com/learning-how-to-help-you-learn-introducing-birdbrain/)
- Request tracing programme: ~10% reduction in Duolingo's latency in initial testing (https://blog.duolingo.com/improving-the-duolingo-experience-with-request-tracing/)
- SMS service incident: peak CPU per pod down to 3.5%, pods 32 → 8 steady state, ~97% peak CPU reduction (https://blog.duolingo.com/reduce-cpu-usage-97-percent/)

## Requirements stated or clearly implied
- Availability target: 99.99% quarterly achieved post-microservices (re:Invent 2018 write-up). A full AWS regional outage during the Super Bowl event was explicitly assessed and "accepted as unmitigable" — contingency was a documented AWS Infrastructure Event Management plan, not a failover (QCon 2024).
- Consistency: not stated for the core stores. Course content is immutable, built offline and served read-only from S3; learner proficiency in DynamoDB is written through an in-memory buffer with an LRU policy, so writes are deliberately lagged (unique-engineering-problems, Scala rewrite).
- Latency target: 14 ms average for lesson generation, not stated as a formal SLO; push delivery target of ~800K/s with the whole 4M burst inside the ad slot (Scala rewrite, QCon 2024).
- Ordering needs: per-user deduplication rather than ordering — SQS FIFO is used for its 5-minute deduplication window, so a campaign button pressed twice sends once (QCon 2024).
- Replay or reprocessing: not stated for an event bus. Request traces are reconstructed on demand from application logs in S3 via Athena rather than continuously (request tracing).
- Retention: not stated.
- Compliance / residency: China traffic is served by a separate SMS service running on Alibaba Cloud ACK with encrypted phone numbers (reduce-cpu-usage-97-percent).
- Degradation is a first-class requirement: "Zombie Mode" lets clients stop calling the backend for a period, and "Freeze Gun" preserves the streak of any user who saw a degraded mode (QCon 2024).
- Offline/poor-network operation is a requirement: lessons are prefetched and stored locally, sessions sync when connectivity returns (frontend-prediction, unique-engineering-problems).

## Boundaries
- Cloud / regions: AWS is the primary cloud; a dual-stack VPC with IPv6-only pods for EKS. Region count not stated; a regional outage is treated as unmitigable, which implies a single active region for the push path. China is a separate boundary on Alibaba Cloud ACK.
- Trust zones: untrusted clients (iOS, Android, web) → ALB/ELB edge → internal services; third-party push providers (APNs, FCM) and the Chinese SMS provider are external dependencies; OpenAI is an external model provider (FinOps).
- Cells: the EKS platform uses a "cellular architecture" of isolated tenants, each containing dev/stage/prod environments, so the platform team can iterate without touching production users.
- Named subsystems: Session Generator; Birdbrain; "Superb Owl" notification system; Zombie Mode; Freeze Gun; Jeeves (incident monitoring); Duolingo English Test proctoring; the China SMS service; the FinOps/CloudZero cost plane.

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Mobile and web clients | Learner clients; predict backend responses, store sessions locally, prefetch lessons for offline use, honour the Zombie Mode flag | in-house native apps and web app | client | offline: true; optimisticUi: true; prefetch: lessons; degradedModeFlag: Zombie Mode; android startup −40% |
| 2 | Elastic Load Balancer / Application Load Balancer | Edge entry and routing; stamps `X-Amzn-Trace-Id` used for tracing | AWS ELB / ALB | load-balancer | traceHeader: X-Amzn-Trace-Id |
| 3 | API servers | Front-door application tier; fetches the learner's data and injects it into the Session Generator request | in-house (Python) | app-server | stateless: true; injectsUserState: true |
| 4 | Session Generator | Builds the ordered sequence of exercises for a lesson; rewritten Python to Scala | in-house (Scala) | app-server | latencyMsAvg: 14 (was 750); inMemoryCache: true; noHardDependencies: true |
| 5 | Session Generator in-memory cache | Local cache of course data; the dominant remaining latency when it expires | in-house | cache | local: true; eviction: TTL expiry (interval not stated) |
| 6 | Course data files in S3 | Immutable course content serialised offline, read by the Session Generator on cache miss | AWS S3 | object-store | immutable: true; builtOffline: true |
| 7 | Offline course-build job | Processes course data off-line and serialises it into the S3 files | in-house | worker | batch: true; schedule: not stated |
| 8 | Birdbrain | ML model estimating learner proficiency per grammar/vocab concept and predicting per-exercise correctness | in-house model | ml-inference | ingests: every completed exercise; output: exercises at the right difficulty for this learner |
| 9 | DynamoDB (Birdbrain proficiency store) | Stores per-learner proficiency scores | AWS DynamoDB | nosql-database | writeBuffering: in-memory; eviction: LRU; read/write count "massively reduced"; A/B cost −50% |
| 10 | Birdbrain model variants under A/B | Grammar and vocabulary models served and tested concurrently | in-house | ml-platform | abTesting: concurrent models |
| 11 | Amazon ECS | Container orchestration for the backend service fleet (100+ in 2018, 500+ in 2025) | AWS ECS | container-orchestrator | services: 500+; multiLanguage: true; retained during migration for rollback |
| 12 | Amazon EKS | Kubernetes platform services are migrating to; all new services from Q3 2025 | AWS EKS | container-orchestrator | podNetworking: IPv6-only in dual-stack VPC (AWS VPC CNI); podIdentity: EKS Pod Identity; nodeScaling: Karpenter on Spot; workerScaling: KEDA on queue depth; cells: isolated dev/stage/prod tenants |
| 13 | Argo CD | GitOps delivery from GitHub repos into EKS; enables blue-green | Argo CD | ci-pipeline | gitops: true; strategy: blue-green |
| 14 | Weighted DNS canary | Splits traffic between the ECS and EKS copies of a service during migration | not named (DNS weighting) | dns | windows: 10 min, 1 hr, 1 day; cutover at 99%; both copies deployed in parallel |
| 15 | "Superb Owl" campaign API | Engineer-facing API that creates a push campaign from a user-ID list days ahead, and holds the "go button" | in-house | app-server | asyncFetch: DynamoDB to S3 |
| 16 | Campaign user-list store | Holds the campaign's target user IDs | AWS DynamoDB | nosql-database | |
| 17 | Campaign S3 staging | Pre-staged campaign payloads; workers load them into memory during the scale-up phase | AWS S3 | object-store | preloadedIntoWorkerMemory: true |
| 18 | SQS FIFO queue, first tier | First hop from the go button; deduplicates repeated presses | AWS SQS FIFO | queue | fifo: true; dedupWindowMinutes: 5; inFlightLimitPerSec: 120000 |
| 19 | Interim notification workers | Fan one coarse message out into per-batch messages on the next queue | in-house (Python) | worker | threadsPerWorker: 1 (was 10); processes packed into the same ECS task |
| 20 | SQS FIFO queue, second tier | Carries batched user groups to the publishing workers | AWS SQS FIFO | queue | batchSize: 500 iOS / 250 Android |
| 21 | Push publishing workers | Call the APNs and FCM batch APIs | in-house (Python) | worker | |
| 22 | Dedicated ECS cluster + ASG for Superb Owl | Isolated burst compute so the campaign does not contend with the main backend | AWS ECS + Auto Scaling Groups | container-orchestrator | dedicated: true; preScaled hours ahead |
| 23 | APNs / FCM | Apple and Google push delivery | APNs, FCM | third-party-api | batchApi: true; vendors confirmed no burst rate limits |
| 24 | China SMS service and SMS provider | Sends streak reminders by SMS to learners in China via an external gateway | in-house (Python 3.12, uWSGI) on Alibaba Cloud ACK; provider not named | app-server | threadsPerWorker: 10; phoneNumbers encrypted; connectionReuse: thread-local persistent session; pods 32 to 8 |
| 25 | Observability plane | Distributed tracing plus on-demand trace reconstruction and metrics | Jaeger (Python + JVM), AWS Athena over application logs in S3, CloudWatch, Prometheus / AMP, Honeycomb, Sentry, PagerDuty; X-Ray considered; OpenTelemetry and Grafana Tempo planned | monitoring | customHeader: Caller (derives call stacks); athena: on-demand not always-on; expensive CloudWatch metrics moved to Prometheus; traces tagged with cluster name to tell ECS from EKS |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| mobile/web client | load-balancer (ELB/ALB) | https | sync | | ALB stamps `X-Amzn-Trace-Id` |
| load-balancer | api-servers | http | sync | | |
| api-servers | session-generator | http | sync | | user data fetched by the API server and **injected into the request** so the generator has no hard dependency |
| session-generator | in-memory course cache | in-process | sync | | miss falls through to S3 |
| session-generator | s3 (course data) | https | sync | | only on cache expiry; "most of the time was spent downloading course data from S3 whenever the in-memory cache expires" |
| offline course-build job | s3 (course data) | s3 | async | | course data "processed off-line and serialized into files in AWS S3" |
| session-generator | birdbrain | not stated | sync | | Birdbrain supplies "which of all the possible exercises are at just the right difficulty level for this specific learner" |
| birdbrain | dynamodb (proficiency) | dynamodb api | sync, buffered | | writes buffered in memory with an LRU policy to cut read/write count |
| client | api-servers (exercise outcomes) | https | sync | | every completed exercise is ingested by Birdbrain |
| services | jaeger | tracing protocol | async | | Python and JVM services |
| services | application logs → s3 → athena | log write then SQL | async | | traces reconstructed on demand, not continuously |
| services | cloudwatch / prometheus | metrics push | async | | expensive metrics migrated CloudWatch → Prometheus |
| eks services | honeycomb / sentry / pagerduty | https | async | | traces tagged with cluster name to disambiguate ECS vs EKS |
| argo cd | eks | kubernetes api | async | | GitOps from GitHub; blue-green |
| karpenter | eks nodes | aws api | async | | Spot provisioning |
| keda | worker deployments | kubernetes api | async | | scales on queue depth |
| dns (weighted) | ecs service copy | dns | sync | | migration canary, decreasing weight |
| dns (weighted) | eks service copy | dns | sync | | increasing weight to 99%; ECS copy kept for rollback |
| campaign api | dynamodb (campaign lists) | dynamodb api | async | | campaign created days ahead |
| campaign api | s3 (campaign staging) | s3 | async | | asynchronous fetch DynamoDB → S3 |
| s3 (campaign staging) | notification workers | s3 | sync | | workers preload into memory during the pre-event scale-up |
| campaign api ("go button") | sqs fifo tier 1 | sqs | async | exactly-once within the 5-minute dedup window | "50+ messages" dispatched on the press; repeated presses deduplicated |
| sqs fifo tier 1 | interim workers | sqs | async | at-least-once | |
| interim workers | sqs fifo tier 2 | sqs | async | | fan-out into batches of 500 iOS / 250 Android to get past the 120K/s in-flight limit |
| sqs fifo tier 2 | publishing workers | sqs | async | at-least-once | |
| publishing workers | apns | https batch api | async | | |
| publishing workers | fcm | https batch api | async | | |
| workers | cloudwatch | metrics/logs push | async | | per-message process times logged for post-hoc analysis |
| china sms service | sms provider | https | sync | | thread-local persistent `Session` reuses TCP/TLS connections |
| nightly batch | china sms service | http | sync | | ~23:00 Beijing streak reminders — the load that triggered the incident |
| client | backend (suppressed by Zombie Mode) | https | sync | | when the flag is on the device "stops making requests to the backend for a certain amount of time until it checks the flag again" |
| ai features | openai | https | sync | | cost-monitored; 10x spike detected within hours |
| video call / roleplay | tts provider | https | sync | | responses cached; cut TTS cost 40% |

## Failure modes, incidents, tradeoffs the source discusses
- **Hard dependencies made the old generator fragile.** "Session Generator would fail if any of these (or their respective network connections) failed." The fix was architectural, not defensive: move shared read-heavy course data offline into S3 and have the API server inject user state into the request, leaving the generator with no live dependencies. Degraded time went from 0.1% (≈2 hours per quarter) to zero. https://blog.duolingo.com/rewriting-duolingos-engine-in-scala/
- **Python's threading model blocked the obvious fix.** Thread-safety problems prevented an effective in-memory cache in the Python generator, and dynamic typing produced runtime bugs; Scala's static typing and safe in-memory caching were the reason for the rewrite, at the cost of a "steep learning curve". https://blog.duolingo.com/rewriting-duolingos-engine-in-scala/
- **The remaining latency is cache expiry, not compute.** "Most of the time was spent downloading course data from S3 whenever the in-memory cache expires." https://blog.duolingo.com/rewriting-duolingos-engine-in-scala/
- **Write amplification on DynamoDB priced out A/B testing.** "By buffering changes for a specific user in-memory we were able to massively reduce the number of times we read or write Dynamo records" — after which running grammar and vocabulary model tests together was 50% cheaper than the original grammar model alone. https://blog.duolingo.com/unique-engineering-problems/
- **Microservices bought availability but cost observability.** Moving off the monolith took availability from 0.99 to 99.99% quarterly and cut compute cost 60%, but "parsing and stitching together various application log entries" across services was needed just to see a request; the first tracing pass found a DynamoDB query that "was querying more data, and was called more and more often", and caching it gave ~10% latency reduction across Duolingo. https://dev.classmethod.jp/articles/reinvent2018-report-from-monolith-to-microservices/, https://blog.duolingo.com/improving-the-duolingo-experience-with-request-tracing/
- **Idempotency at the human layer.** Multiple marketing managers could press the campaign button; SQS FIFO's 5-minute deduplication window makes repeated presses send once. "Idempotency basically means to do things multiple times, but having the same effect of doing it once." https://www.infoq.com/presentations/duolingo-high-scale-notification/
- **A hard AWS quota shaped the topology.** SQS's 120,000 in-flight messages/second ceiling is why the design is multi-tier queues carrying batches of 500 iOS / 250 Android users rather than one message per user. https://www.infoq.com/presentations/duolingo-high-scale-notification/
- **Burst compute must be isolated.** Scaling Superb Owl and the core backend at the same time caused resource contention; the answer was a dedicated ECS cluster for the campaign. Python worker thread count also had to drop from 10 to 1, and processes were packed into the same ECS task to get past task-count limits. https://www.infoq.com/presentations/duolingo-high-scale-notification/
- **A regional AWS outage during the ad was accepted as unmitigable**, covered by an AWS Infrastructure Event Management document rather than by failover; Zombie Mode plus Freeze Gun (streak preservation for anyone who saw a degraded mode) was the user-facing backstop. https://www.infoq.com/presentations/duolingo-high-scale-notification/
- **Connection churn saturated a service and killed its health checks.** Creating a fresh `requests.Session()` per SMS forced new TCP+TLS handshakes; under the ~23:00 Beijing streak-reminder batch, pods hit "0/10 nodes are available: 10 Insufficient cpu" and restarted within six minutes — "if all threads are blocked, there is nothing left to serve even a health check." Thread-local session reuse cut peak CPU per pod to 3.5% and pods from 32 to 8. https://blog.duolingo.com/reduce-cpu-usage-97-percent/
- **A runtime upgrade behaved as a load test.** "Infrastructure migrations are often framed as maintenance work… they can also act like a form of load testing." https://blog.duolingo.com/reduce-cpu-usage-97-percent/
- **ECS → EKS was justified by capability gaps, not fashion.** ECS could not give blue-green deployments (canary was capped at 1% traffic) or ephemeral environments; "Kubernetes gives you multi-cloud support, so it makes it easier if there ever is interest in moving to a different cloud." The caution: "Only start a project like this if you have a strong need from your users or your customers." https://www.infoq.com/presentations/duolingo-eks-kubernetes/
- **IPv6-only pods cost code changes in every service** (Flask/Java binding config), and AWS service support lagged — DynamoDB added IPv6 only recently. https://www.infoq.com/presentations/duolingo-eks-kubernetes/
- **Undiscovered AWS rate limits surfaced only under rollout** (EKS Pod Identity agent, AWS Managed Prometheus); the mitigation was a deliberately slow rollout with easily revertible traffic switches, with each service deployed to ECS and EKS in parallel: "We do deploy to both services in parallel so we still have the option to revert back." https://www.infoq.com/presentations/duolingo-eks-kubernetes/
- **Dual-platform observability created ambiguity** — "Is this page from ECS or EKS?" — fixed by tagging traces with the Kubernetes cluster name. Recency bias also made the new platform the default suspect for pre-existing bugs. https://www.infoq.com/presentations/duolingo-eks-kubernetes/
- **Frontend prediction trades correctness for perceived latency.** Predicting XP lets the app show the session-end card "often several seconds before the backend finishes", at the price of duplicated business logic and rollback paths; the guardrail is explicit: "If the user cares deeply or if the value affects monetization or fairness, wait for backend confirmation." https://blog.duolingo.com/frontend-prediction/
- **Cost is treated as an operational signal.** Hourly cost tracking with anomaly detection over 100+ microservices caught "a sudden 10x spike in OpenAI costs tied to a specific category of Max users" within hours; TTS caching cut TTS cost 40%; the most expensive CloudWatch metrics were moved to Prometheus. https://blog.duolingo.com/finops/

## Unknowns
- Region topology: how many AWS regions are active, and whether anything other than the push path is single-region. Only "a regional outage is unmitigable for this event" is stated.
- The primary transactional store for user accounts, progress and streaks. DynamoDB is confirmed for Birdbrain proficiency and campaign lists; RDS/MySQL/Postgres and ElastiCache appear in search snippets but no fetched first-party source names them, so they are deliberately absent from the component table.
- Whether there is an event bus / stream (Kafka, Kinesis) behind analytics or the exercise-outcome pipeline. Tracing is reconstructed from logs via Athena; no streaming component is named in any fetched source.
- How Birdbrain models are trained, deployed and versioned (batch cadence, serving runtime, framework). Only that multiple variants are A/B tested concurrently.
- The transport and protocol between Session Generator and Birdbrain, and whether Birdbrain inference is in-process, a sidecar, or a separate service.
- The TTL / refresh interval of the Session Generator's in-memory course cache.
- The SMS provider name, and how much of the China stack beyond SMS runs on Alibaba Cloud.
- Streak computation itself: where streak state lives and how the nightly reminder audience is computed.
- Current state of the EKS migration for the remaining critical services, and whether ECS is fully retired.

## Candidates
- New kinds: none required — every box maps to an existing kind. `container-orchestrator` add-ons (Karpenter, KEDA, Argo CD) are properties/sidecars of the orchestrator rather than separate kinds; if the encoder wants them as nodes, `node-autoscaler (new)` and `gitops-controller (new)` would be the ids.
- New properties on existing kinds:
  - `app-server.dependencyInjection` (boolean) — caller fetches state and injects it, so the callee has no live dependency (the Session Generator pattern)
  - `cache.scope` (local-in-process | shared) and `cache.refreshSource` (object-store | database)
  - `nosql-database.writeBuffering` (none | in-memory-lru) and `nosql-database.writeAmplificationControlled` (boolean)
  - `queue.dedupWindowSeconds` (integer), `queue.inFlightLimitPerSec` (integer), `queue.batchSize` (integer)
  - `container-orchestrator.dedicated` (boolean) — isolated cluster for burst workloads
  - `container-orchestrator.podNetworking` (ipv4 | ipv6-only | dual-stack)
  - `worker.threadsPerProcess` (integer) and `worker.connectionReuse` (none | persistent-session)
  - `client.offlineCapable` (boolean), `client.optimisticUi` (boolean), `client.degradedModeFlag` (boolean) — Zombie Mode
  - `third-party-api.burstApproved` (boolean) — vendor confirmed no burst rate limit
- New requirement paths:
  - `availability.degradedModeAllowed` (boolean) and `availability.degradedModeCompensation` (string) — Freeze Gun
  - `cost.anomalyDetection` (boolean) and `cost.trackingGranularity` (hourly | daily)
  - `migration.parallelRuntimes` (boolean) — same service live on two orchestrators behind weighted DNS
- New rules (name + one-line condition):
  - `sync-chain-without-injected-state`: an app-server on a latency-critical path has two or more sync outbound edges to stores it does not own, and no `dependencyInjection` — the pre-rewrite Session Generator
  - `read-heavy-shared-data-not-precomputed`: many app-servers read the same slowly-changing dataset synchronously from a database rather than an object-store snapshot
  - `hot-path-cache-miss-unbounded`: a cache whose miss path is an object-store download and no fallback or stale-while-revalidate is declared
  - `high-write-nosql-without-buffering`: a nosql-database written on every user interaction with `writeBuffering: none`
  - `burst-workload-shares-cluster`: a worker fleet with a stated burst target running on the same container-orchestrator as the core request path
  - `fanout-queue-without-dedup`: a queue fed by a human-triggered or retryable producer with no `dedupWindowSeconds`
  - `fanout-exceeds-queue-limit`: declared messages/second above `queue.inFlightLimitPerSec` with `batchSize` unset
  - `outbound-http-without-connection-reuse`: a worker or app-server calling a third-party-api with `connectionReuse: none` under batch load
  - `no-degraded-mode-for-engagement-state`: a client-facing system with streak/engagement state and no `availability.degradedModeAllowed`
  - `dual-runtime-without-origin-tag`: `migration.parallelRuntimes` true and monitoring has no cluster/runtime tag on traces
