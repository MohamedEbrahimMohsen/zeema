# meta-threads: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/meta-threads.md`
- Size: 24 nodes, 35 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture, clean variant: Threads on Instagram's Django tier, Meta's TAO/MySQL
social graph, ZippyDB for counters, feed state and search, and Async (XFaaS) for the
onboarding follow import and the notification fan-out that carried the 100M-signup launch.

Fixes relative to meta-threads.broken.yaml:
  - the follow import and the notification fan-out are deferred work: django-api hands them to
    xfaas-submitter asynchronously, and the worker is reached through durableq -> xfaas-scheduler
    -> worker-lb rather than by a second queue wired straight into the pool
  - central-rate-limiter sits in front of the Async path: the submitter and the scheduler check
    the global per-function ceiling, and tao feeds back-pressure exceptions into it (AIMD)
  - xfaas-worker declares no push fan-out strategy over the social graph, so a celebrity signup
    does not become an unbounded burst of graph writes
  - there is one DurableQ per function on the call path and no side retry queue with neither
    backoff nor a dead-letter queue
  - the write into tao carries a circuit breaker instead of a bare retry policy, which is the
    cascade the XFaaS paper describes as the TAO domino incident
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture, broken variant: the same Threads stack, but the onboarding follow
import is wired as push fan-out straight from the worker pool onto the social graph, the
Central Rate Limiter is gone, and failed function calls land in a side retry queue that the
same pool also drains.

This file MUST trip:
  - push-fanout-without-celebrity-path   (xfaas-worker pushes with no fanoutThreshold; tao is a graph-database)
  - retry-without-adaptive-shedding      (xfaas-worker -> tao retries with no circuit breaker and nothing limits tao)
  - shared-worker-pool-across-queues     (xfaas-worker drains durableq and retry-queue while isolation.perQueue is true)
  - retry-without-backoff                (retry-queue declares no backoff)
  - retry-queue-without-dlq              (retry-queue has no dead-letter queue)
and MUST NOT trip:
  - queue-missing-dlq                    (neither queue has an async in-edge; both are filled synchronously)
  - datastore-missing-backup, datastore-single-region (mysql is backed up and replicated synchronously by Raft)
  - read-heavy-path-without-cache, sync-chain-too-deep (no readWriteRatio and no p95 latency target are stated)
  - credentials-without-rotation         (the design declares a 90-day rotation period)
  - cache-as-primary-store-without-persistence, materialised-cache-without-rebuild-path (no cache node)
  - derived-store-without-cdc-or-rebuild, business-updates-without-index-propagation (no search-index node)
  - multi-leader-store-without-conflict-policy (zippydb is multi-region single-leader)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone (no availability-zone groups)
  - cross-cell-call, shared-dependency-without-redundancy, pubsub-replay-required (no cells, no discovery requirement, no replay requirement)

The broken variant is the failure the sources themselves describe: the XFaaS paper's TAO domino
incident (§4.6.3), where a high-volume function overloaded the social graph and "these failures
and retries amplified queries to several downstream services", and the launch-day observation
that a celebrity joining queues millions of follows and notifications. Removing the Central Rate
Limiter and giving the worker a bare exponential retry into TAO reproduces exactly that shape.

## Mapping

| source box | node | component | kind | confidence |
|---|---|---|---|---|
| Threads mobile apps (iOS Swift, Android Jetpack Compose) | `threads-app` | `mobile-app` | client | exact |
| Threads/Instagram Django API tier | `django-api` | `container-service` | app-server | close |
| Meta monolith (HHVM/Hack) over GraphQL | `meta-monolith` | `container-service` | app-server | assumed (secondary source only) |
| Instagram login / privacy / security / integrity | `instagram-identity` | `container-service` | app-server | close (no generic identity-provider exists) |
| Feed ranking / state | `feed-ranking` | `container-service` | app-server | close (the source names the box but describes no serving topology) |
| Search (deferred past launch) | `search-service` | `container-service` | app-server | close (the index itself is a ZippyDB keyspace, not a separate engine) |
| ActivityPub federation (2024) | `threads-federation` | `container-service` | app-server | close |
| XFaaS submitter | `xfaas-submitter` | `container-service` | app-server | close |
| XFaaS QueueLB | `queue-lb` | `load-balancer-tier` | load-balancer | close |
| XFaaS DurableQ | `durableq` | `message-queue` | queue | close |
| XFaaS scheduler | `xfaas-scheduler` | `container-service` | app-server | close (stateless; FuncBuffers and RunQ are in-memory) |
| XFaaS WorkerLB | `worker-lb` | `load-balancer-tier` | load-balancer | close |
| XFaaS worker pool | `xfaas-worker` | `container-worker` | worker | close |
| XFaaS Central Rate Limiter | `central-rate-limiter` | `envoy-ratelimit` | rate-limiter | close (nearest standalone distributed limiter) |
| Global Traffic Conductor / Locality Optimizer / Utilization Controller | `xfaas-controllers` | `container-service` | app-server | close |
| Notification system | `notification-service` | `notification-platform` | notification-service | exact |
| TAO | `tao` | `tao` | graph-database | exact |
| MySQL (MySQL Raft / FlexiRaft) | `mysql` | `mysql` | sql-database | exact |
| ZippyDB | `zippydb` | `nosql-store` | nosql-database | close |
| ShardManager | `shardmanager` | `apache-helix` | coordination-service | close |
| Akkio | `akkio` | `container-worker` | worker | close (same substitution as instagram-feed) |
| Configerator | `configerator` | `container-service` | app-server | close |
| ODS and Scuba | `launch-dashboards` | `observability-stack` | monitoring | close (drawn as one box, as the card draws them) |
| External ActivityPub servers | `fediverse-servers` | `supplier-api` | third-party-api | close |

Tally: 3 exact, 20 close, 1 assumed.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| ZippyDB | nosql-database | `nosql-store` |
| ShardManager | coordination-service | `apache-helix` |
| Akkio | data-placement-service (does not exist) | `container-worker` |
| Configerator | feature-flag-service / config distribution | `container-service` |
| XFaaS submitter | api-gateway | `container-service` |
| XFaaS DurableQ | queue | `message-queue` |
| XFaaS scheduler | workflow-engine | `container-service` |
| XFaaS QueueLB / WorkerLB | load-balancer | `load-balancer-tier` |
| XFaaS Central Rate Limiter | rate-limiter | `envoy-ratelimit` |
| XFaaS central controllers | policy-engine | `container-service` |
| Instagram identity tier | identity-provider | `container-service` |
| ODS, Scuba | timeseries-database, bi-service | `observability-stack` |
| External ActivityPub servers | third-party-api | `supplier-api` |

The recurring cause is that `identity-provider`, `feature-flag-service`, `policy-engine`,
`api-gateway`, `workflow-engine`, `rate-limiter`, `timeseries-database`, `bi-service` and
`ml-inference` have no generic `default` component the way `nosql-database`, `queue`,
`load-balancer` and `app-server` do.

## Not encoded

- The MySQL Raft ring topology: three primary-capable regions, each holding one MySQL server plus
  two log-only logtailers, plus three non-primary-capable learners — twelve entities for one
  shard. The format has one `replication` enum per node, so the ring is `replication: "sync"`
  and nothing more. The 2-of-3 in-region data quorum survives only as
  `consistency.quorumScope: "region"`; the separate leader-election quorum is lost entirely.
- TAO's two cache tiers are `followerTiers: 1` on a single node; the source draws follower caches
  and leader caches as separate boxes per region, and the write-forwarding path from a secondary
  region's follower up to the primary region's leader is not drawable without one node per tier
  per region.
- ZippyDB's logical-to-physical micro-shard indirection, the 100x online resharding and the
  50-100 GB physical shard geometry. There is no property for reshardability, no shard-size
  property and no way to say that a shard-map change is a live configuration change.
- ZippyDB's per-request consistency choice. `consistency: "tunable"` says a choice exists but not
  that the three options are eventual-with-bounded-staleness, read-your-writes via client-cached
  sequence numbers, and linearizable reads from the primary.
- Async deadlines and quota classes: reserved (seconds-level SLO) versus opportunistic (24-hour
  SLO), the criticality-then-deadline ordering inside the scheduler, and the future execution
  start time that lets a call sit in a DurableQ for hours. Edges carry `timeoutMs` but nothing
  carries a deadline or a quota class.
- The AIMD congestion control, the per-function concurrency limit and the slow start (at most
  +20% RPS per minute above 100 calls per window). `algorithm: "adaptive"` on the limiter is the
  whole of it; the back-pressure edge from TAO is an ordinary async edge.
- The submitter split into a normal set and a very spiky set per region. There is one submitter
  node; the format has no way to say "two pools of the same thing, separated for blast radius"
  short of two nodes and no property to distinguish them.
- Locality groups: the non-overlapping partition of functions and workers that bounds how many
  functions a worker must keep hot, and the peer-to-peer code push to local SSD with cooperative
  JIT that removes cold start. There is no `coldStartStrategy` property.
- Namespaces as isolation zones with dedicated worker pools, and the Bell-LaPadula multilevel
  information-flow policy the scheduler and workers enforce between them. Encoded only as
  `isolation.perQueue: true` plus `isolation.tenancy: "shared"`.
- Scale figures with nowhere to live: trillions of Async calls per day on more than 100,000
  servers across tens of regions, 66% daily average CPU, 18,377 unique functions a month, a 4.3x
  peak-to-trough ratio, ~300 ms graceful MySQL promotion and sub-2-second failover detection,
  millions of MySQL shards holding petabytes, hundreds of thousands of TAO shards. Only TAO's
  billion reads per second fits, as `nfr.rps`.
- The launch story itself — two days' notice, no load test, 100M signups in five days, ~60
  engineers in five months — is context, not architecture, and the format holds none of it.
- The media path (image and video attachments) is deliberately absent: no fetched source
  describes it for Threads, so there is no CDN and no object store in this design.
