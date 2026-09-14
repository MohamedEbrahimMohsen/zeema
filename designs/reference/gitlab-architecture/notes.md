# gitlab-architecture: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/gitlab-architecture.md` (GitLab official docs, the Infrastructure handbook controlled documents, the infrastructure runbooks and the 2017 database outage postmortem; re-verified 2026-09-14).
- Size: 25 nodes, 44 edges, 8 groups.

## Clean variant (header of design.yaml)

GitLab.com as documented today: one GCP region (us-east1), four GKE clusters carrying the
stateless GitLab tiers, and the datastore tiers - PostgreSQL, Gitaly, Redis, Elasticsearch -
deliberately kept off Kubernetes on VMs.

Fixes relative to gitlab-architecture.broken.yaml:
  - puma and sidekiq reach postgresql through pgbouncer, so the Rails tier never opens a
    connection straight at the primary
  - postgresql is backed up with a stated 14-day retention (DB-DR-RETENTION) and archives WAL
    continuously to gcs, which is what makes PITR possible
  - elasticsearch is fed asynchronously by sidekiq (the GitLab Elasticsearch Indexer) instead
    of being dual-written inline from the request path
  - sidekiq-queue parks poison jobs in a dead-letter set rather than retrying them forever
  - redis-shared-state keeps persistence on, so sessions and CI trace chunks survive a restart
  - sidekiq consumes one queue substrate; queues are split into resource groups across pods
    instead of one pool draining every queue
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

GitLab.com, broken variant: the Rails tier connects straight at the PostgreSQL primary with no
pooler, the primary has no backup and no WAL archive (the January 2017 shape), the search index
is dual-written inline from Rails, the Sidekiq job substrate has no dead-letter set and keeps no
persistence, and one Sidekiq pool drains every queue.

This file MUST trip:
  - datastore-missing-backup                   (postgresql and postgresql-replica: backupEnabled false, no retention)
  - business-updates-without-index-propagation (puma writes postgresql synchronously, a search index exists, no CDC leaves it)
  - derived-store-without-cdc-or-rebuild       (elasticsearch is only written and read synchronously by puma)
  - queue-missing-dlq                          (sidekiq-queue takes async traffic with deadLetterQueue false)
  - cache-as-primary-store-without-persistence (redis-shared-state: usedAsPrimaryStore true, persistence false)
  - shared-worker-pool-across-queues           (sidekiq consumes sidekiq-queue and mailroom-queue while isolation.perQueue is true)

Every one of those is a mistake the sources themselves warn about. The first two are the January
31 2017 outage in miniature: a single primary whose only recovery copy was a replica, with WAL
archiving off and five backup paths that all failed at once; connection pooling and PITR were both
on the remediation list that became today's architecture. The last one inverts the handbook's
"multiple pods are configured for Sidekiq cluster to divide Sidekiq queues into different resource
groups".

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Browsers and Git clients | `git-client` | `user-device` | client | exact |
| Cloudflare (WAF + DNS) | `cloudflare` | `cloudflare-waf` | waf | exact |
| HAProxy | `haproxy` | `haproxy` | load-balancer | exact |
| NGINX ingress | `nginx` | `nginx` | load-balancer | exact |
| GitLab Shell | `gitlab-shell` | `container-service` | app-server | close |
| GitLab Workhorse | `workhorse` | `container-service` | app-server | close |
| Puma (GitLab Rails) | `puma` | `container-service` | app-server | close |
| Rate limiting (Rack::Attack + gprd-redis-ratelimiting) | `rack-attack` | `redis-rate-limiter` | rate-limiter | exact |
| Sidekiq | `sidekiq` | `container-worker` | worker | close |
| GitLab agent server (Kas) | `kas` | `websocket-gateway` | realtime-gateway | close |
| GitLab Pages | `gitlab-pages` | `container-service` | app-server | close |
| Container Registry | `registry` | `gitlab-registry` | container-registry | exact |
| Gitaly | `gitaly` | `file-store` | file-storage | close |
| PgBouncer | `pgbouncer` | `pgbouncer` | database-proxy | exact |
| PostgreSQL (`main`, `ci`, `sec`) | `postgresql` | `postgres` | sql-database | exact |
| PostgreSQL hot standby | `postgresql-replica` | `postgres` | sql-database | exact |
| Patroni + Consul | `consul` | `consul` | coordination-service | exact |
| `gprd-redis-cache` | `redis-cache` | `redis` | cache | exact |
| `gprd-redis`, `gprd-sessions`, `gprd-redis-tracechunks` | `redis-shared-state` | `redis` | cache | close |
| `gprd-redis-sidekiq` | `sidekiq-queue` | `redis-queue` | queue | exact |
| Search indexes (Elasticsearch, Zoekt) | `elasticsearch` | `elasticsearch` | search-index | close |
| Object storage (GCS) | `gcs` | `gcs` | object-store | exact |
| CI runner fleet | `runner-manager` | `gitlab-ci` | ci-pipeline | close |
| Observability stack | `prometheus` | `prometheus` | monitoring | close |
| Secrets (GKMS) | `gkms` | `google-cloud-kms` | key-management | exact |
| Praefect | — | — | — | not a node: the component list marks Praefect not-supported for GitLab.com |

Tally: 15 exact, 10 close, 0 assumed.

`close` reasons: the four in-house Go and Ruby services (Shell, Workhorse, Pages, Sidekiq) have no
component of their own and take the generic of their kind; Kas terminates long-lived gRPC streams
from in-cluster agents, which `websocket-gateway` models as `protocol: "grpc-stream"`; Gitaly is a
Git server, not a file server, and `file-store` carries only its local-disk storage aspect;
`redis-shared-state` merges three named persistent Redis shards into one box; `elasticsearch`
carries Zoekt and the pod-log sink as well as advanced search; `runner-manager` stands for all
three runner-manager classes and the ephemeral build VMs behind them; `prometheus` stands for the
whole per-cluster Prometheus, Mimir, Grafana, Alertmanager, fluentd and Sentry stack.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Gitaly | a Git repository service (gRPC over local block storage) — `content-repository` in the catalogue is a CMS kind | `file-store` (file-storage) |
| GitLab Workhorse | a generic in-house reverse proxy / `api-gateway`; every `api-gateway` component is a named product | `container-service` (app-server) |
| Redis Sentinel | `coordination-service`, but no Sentinel component exists and no generic fits | not encoded (see below) |
| Praefect | `database-proxy` for Git | not encoded; not used on GitLab.com |
| Zoekt | `search-index` | folded into `elasticsearch` |
| Grafana Mimir, Alertmanager, fluentd, Sentry | timeseries-database, notification-service, worker, monitoring | folded into `prometheus` |

## Not encoded

- Redis Sentinel. The runbooks are explicit that "Sentinel does not proxy requests" — it is off the
  data path — and there is no Sentinel component in the catalogue. The failover mechanism it
  provides has no property to land on either.
- The four GKE clusters as compute substrate. Cluster scope (one regional, three zonal) is carried
  as the `gke-zonal` / `gke-regional` trust zones; `container-orchestrator.clusterScope` and
  `clusterCount` do not exist, so "4 clusters" is only in the group labels.
- The out-of-band control plane: `dev.gitlab.org` (CNG image registry, on Azure), `ops.gitlab.net`
  (deploy pipelines), ArgoCD, bastion hosts and the Docker Hub mirror. The format has no way to say
  "this node deploys the design it is not part of", and the `ops` trust zone is the only trace of
  the independence boundary left. The 2017-era Azure hosting is deliberately absent from the
  production design: it survives only as `dev.gitlab.org` in the card.
- Ephemeral build VMs. `runner-manager` carries the polling and the clone, but the
  destroy-after-every-job behaviour of `shared-runners-manager-X` has no property.
- The published rate-limit table (2,000 authenticated API requests per user per minute, 10,000 Git
  HTTPS, 600 Git SSH, and the rest). `rate-limiter` models the algorithm and scope, not a table of
  limits; the numbers stay in the source card and in the `rack-attack` edge label.
- The database SLOs other than retention: `DB-HA-UPTIME` 99.9%, `DB-HA-PERF` p99 200 ms,
  `DB-DR-TTR` 8 h. `latency.p95Ms` is a p95 on the primary request path, which is not what
  `DB-HA-PERF` measures, so no latency requirement is stated. `requirements.availability.sla` is
  "99.95", the application-level figure the database handbook publishes.
- Gitaly's per-repository concurrency limits (60 concurrent HTTP fetches, 30 SSH) and the 60 s Puma
  request timeout. The Puma timeout is carried as `timeoutMs: 60000` on `workhorse -> puma`; the
  Gitaly limits have no property and stay in the source.
- Gitaly's observed IOPS (500-1000 reads/s, ~500 writes/s, peaks of 3500 and 3000). `nfr.rps` is a
  request rate, not a disk operation rate, so no node carries an `rps`. No absolute request rate,
  repository count or user count is published in any first-party source, so no `nfr.rps` appears
  anywhere in either file.

## Judgement calls the rules forced

- `redis-shared-state.evictionPolicy: "ttl"`. The sources describe `gprd-redis-cache` as the LRU
  shard and the others as persistent, but never name an eviction policy for the persistent shards.
  `cache-missing-eviction-policy` fires on both an absent policy and an explicit `none`, so the
  value reflects the practice (sessions and trace chunks expire) rather than a quoted figure.
- `sidekiq-queue.deadLetterQueue: true`. Not stated in the fetched sources; Sidekiq's dead set is
  the mechanism, and `queue-missing-dlq` reads the property.
- `consul.replicated: true`. The handbook names Consul as providing "Database node discovery,
  failover" without stating a node count; a single-node Consul would not provide failover, so the
  design states the redundancy the role implies.
- `availability.discoveryRedundant: true` and `observability.alertingIndependent: true` come from
  the handbook's Consul role and from "we peer all of our networks together such that we have a
  cluster of alert managers to ensure we get alerts out no matter a potential failure of an
  environment".
- Zones are modelled as trust zones, not as `availability-zone` groups. GitLab.com's zonal split is
  a bandwidth-isolation decision for the stateless tier, not a per-node placement the sources state
  node by node; claiming `availability-zone` membership for any individual node would be inventing
  placement the sources do not give.
