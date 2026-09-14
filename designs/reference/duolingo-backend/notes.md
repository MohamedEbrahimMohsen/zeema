# duolingo-backend: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/duolingo-backend.md`
- Size: 23 nodes, 24 edges, 4 groups.

## Clean variant (header of design.yaml)

Duolingo's backend, clean variant: a Session Generator with no hard dependencies (course data
built offline into S3, learner state injected by the API server) plus the "Superb Owl"
two-tier SQS FIFO push pipeline on its own dedicated cluster.

Fixes relative to duolingo-backend.broken.yaml:
  - the go button publishes to dispatch-queue (SQS FIFO, 5-minute dedup window) instead of
    calling the interim workers synchronously, so fan-out is off the request path
  - each queue tier has its own worker pool: dispatch-queue feeds interim-workers,
    batch-queue feeds push-workers, which is what isolation.perQueue asks for
  - both FIFO queues declare a dead-letter queue
  - the last hop is at-least-once and the APNs/FCM calls are asynchronous and idempotent,
    so no exactly-once claim is stretched over an external side effect
  - course-cache is not the primary copy: session-generator falls through to the S3 course
    files whenever the in-memory cache expires
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Duolingo's backend, broken variant: the campaign "go button" calls the fan-out workers
synchronously, one publishing pool drains both FIFO queues, neither queue has a dead-letter
queue, the last hop claims exactly-once while calling APNs and FCM inline, and the Session
Generator's in-memory cache is the only copy of the course data.

This file MUST trip:
  - fanout-inline-in-request-path              (campaign-api calls interim-workers synchronously)
  - shared-worker-pool-across-queues           (push-workers consumes dispatch-queue and batch-queue while isolation.perQueue is true)
  - queue-missing-dlq                          (dispatch-queue and batch-queue: deadLetterQueue false with async in-edges)
  - exactly-once-with-external-side-effects    (batch-queue -> push-workers is exactly-once, push-workers calls apns and fcm sync)
  - cache-as-primary-store-without-persistence (course-cache: usedAsPrimaryStore true, persistence false, no S3 fall-through)
and MUST NOT trip: cache-missing-eviction-policy, materialised-cache-without-rebuild-path,
external-call-inline-without-durable-path, credentials-without-rotation,
read-heavy-path-without-cache, retry-without-adaptive-shedding, sync-chain-too-deep,
datastore-missing-backup, datastore-single-region,
business-updates-without-index-propagation, stateful-node-without-zone-redundancy.

Each of the five is a mistake the sources themselves describe or warn about: the go button
that a marketing manager may press twice, the resource contention that forced Superb Owl onto
its own cluster, the "idempotency means doing it twice has the effect of once" framing that
stops at the queue and not at APNs, and the pre-rewrite generator whose course data had no
durable copy behind the in-memory cache.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Mobile and web clients | `learner-client` | `mobile-app` | client | exact |
| Elastic / Application Load Balancer | `alb` | `alb` | load-balancer | exact |
| Weighted DNS canary | `migration-dns` | `route53` | dns | close (the source says "DNS weighting", not Route 53 by name) |
| API servers | `api-servers` | `container-service` | app-server | exact |
| Session Generator | `session-generator` | `container-service` | app-server | exact |
| Birdbrain | `birdbrain` | `tensorflow-serving` | ml-inference | assumed (no framework named; nearest generic model server, see gaps) |
| "Superb Owl" campaign API | `campaign-api` | `container-service` | app-server | exact |
| Offline course-build job | `course-build-job` | `container-worker` | worker | exact |
| Interim notification workers | `interim-workers` | `container-worker` | worker | exact |
| Push publishing workers | `push-workers` | `container-worker` | worker | exact |
| SQS FIFO queue, first tier | `dispatch-queue` | `sqs` | queue | exact |
| SQS FIFO queue, second tier | `batch-queue` | `sqs` | queue | exact |
| Amazon ECS | `ecs` | `aws-ecs` | container-orchestrator | exact |
| Amazon EKS | `eks` | `aws-eks` | container-orchestrator | exact |
| Argo CD | `argo-cd` | `argo-cd` | ci-pipeline | exact |
| Observability plane | `observability` | `observability-stack` | monitoring | close (one node for Jaeger + CloudWatch + Prometheus + Athena, as the card draws one box) |
| Session Generator in-memory cache | `course-cache` | `cache-cluster` | cache | close (in-process, not a cluster; the format has no local-cache scope) |
| Course data files in S3 | `course-data` | `s3` | object-store | exact |
| Campaign S3 staging | `campaign-staging` | `s3` | object-store | exact |
| DynamoDB (Birdbrain proficiency store) | `proficiency-store` | `dynamodb` | nosql-database | exact |
| Campaign user-list store | `campaign-lists` | `dynamodb` | nosql-database | exact |
| APNs | `apns` | `apns` | third-party-api | exact |
| FCM | `fcm` | `fcm` | third-party-api | exact |

Tally: 18 exact, 4 close, 1 assumed.

One edge is **assumed**: `session-generator -> birdbrain` is given `protocol: "http"`. The card
records the transport as "not stated". The edge itself is stated ("Birdbrain supplies which of
all the possible exercises are at just the right difficulty level for this specific learner").
`api-servers -> birdbrain` is **close**: the source states that every completed exercise is
ingested by Birdbrain and that clients post outcomes through the API servers, but draws no
arrow between the two boxes.

Two properties are set where the sources are silent, because the rule they satisfy encodes a
practice this platform demonstrably has (brief step 3):

- `security.credentialRotationDays: 90` — no source states a rotation period.
- `deadLetterQueue: true` on both FIFO queues — the QCon talk describes retries and post-hoc
  per-message analysis in CloudWatch but never names a DLQ.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Birdbrain (in-house proficiency model) | a generic `ml-inference` under `default` | `tensorflow-serving`, `label: "Birdbrain"` |
| Superb Owl dedicated ECS cluster + ASG | `container-orchestrator.dedicated` | the `superb-owl` `system` group, not a node |
| Karpenter, KEDA | `node-autoscaler` | not nodes; `autoscaling: true` on `eks` |
| AWS Athena over logs in S3 | `query-engine` | folded into `observability-stack` |
| China SMS provider | generic SMS `third-party-api` | not encoded (branch out of scope) |

## Not encoded

- **Zombie Mode and Freeze Gun.** Carried only as `availability.degradedModeAllowed: true`; the
  format has no client-side feature flag, and no way to say "the streak of anyone who saw a
  degraded mode is preserved".
- **The China SMS service on Alibaba Cloud ACK**, its external SMS gateway, and the nightly
  23:00 Beijing streak-reminder batch. A separate side-system on another cloud; leaving it out
  keeps the design inside the 25-node budget and inside one cloud boundary.
- **The connection-reuse incident** (a fresh `requests.Session()` per SMS, TCP/TLS handshake
  churn, pods 32 -> 8). No edge or node property expresses connection reuse.
- **The EKS cellular architecture** (isolated tenants each holding dev/stage/prod). The cells
  isolate environments, not production traffic, so no `cell` group is declared and
  `isolation.tenancy` is left unset.
- **IPv6-only pods in a dual-stack VPC** is carried as `ipFamily: "ipv6"` on `eks`; the VPC's
  dual-stack half and the per-service Flask/Java binding changes are not expressible.
- **Birdbrain model A/B variants** (grammar and vocabulary models served concurrently) and the
  50% cost reduction that in-memory write buffering bought. The buffering shows only as
  `batched: true` on the `birdbrain -> proficiency-store` edge.
- **The FinOps plane** (hourly cost tracking, CloudZero, anomaly detection over 100+ services)
  and the OpenAI / TTS provider calls behind the AI features. Cost observability has no
  representation in the format, and the AI features are off the lesson path.
- **The 4M-in-5s burst, 800K messages/second and the 120,000/s SQS in-flight ceiling.** `nfr.rps`
  is per node and these are campaign-wide burst figures, not a steady rate for any one box; the
  batch sizes that work around the ceiling are carried in the edge label instead.
- **Request tracing specifics**: the `Caller` custom header that derives call stacks, Athena
  reconstructing traces on demand rather than continuously, and traces tagged with the cluster
  name to tell ECS from EKS apart. Only the last survives, as an edge label.
- **The 500+ services on ECS.** One `api-servers` node and one `session-generator` node stand in
  for the fleet; the count lives in the `ecs` node's label.
