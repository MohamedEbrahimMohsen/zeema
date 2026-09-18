# Intake: GitLab.com production architecture

## Source
- Primary: https://docs.gitlab.com/development/architecture/ — "GitLab architecture overview" (GitLab Engineering, official product documentation, maintained continuously; raw source fetched from https://gitlab.com/gitlab-org/gitlab/-/raw/master/doc/development/architecture.md, 2026). Component list with a per-distribution column including a GitLab.com column, two Mermaid component diagrams with ports, and Mermaid sequence diagrams for `git fetch` over HTTP and over SSH.
- Primary: https://handbook.gitlab.com/handbook/engineering/infrastructure-platforms/production/architecture/ — "Production Architecture", a GitLab *controlled document* owned by the Infrastructure team (raw source fetched from https://gitlab.com/gitlab-com/content-sites/handbook/-/raw/main/content/handbook/engineering/infrastructure-platforms/production/architecture/_index.md, 2026). GCP `us-east1`, the four-cluster GKE layout, Cloudflare in front of HAProxy, Redis shards, monitoring and logging pipeline, DNS/WAF, bastions, secrets.
- Primary: https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/ (GitLab, official company blog, 2017-02-10) — the January 31 2017 database outage postmortem, including the five backup paths and the 5-Whys.
- Primary: https://handbook.gitlab.com/handbook/engineering/infrastructure-platforms/production/architecture/ci-architecture/ (GitLab Infrastructure handbook, controlled document) — runner manager classes, Docker Machine autoscaling, CI data flow.
- Primary: https://handbook.gitlab.com/handbook/engineering/infrastructure-platforms/database/ (GitLab Database Reliability Engineering handbook, controlled document) — the five database SLOs and the backup strategy.
- Primary: https://docs.gitlab.com/user/gitlab_com/ ("GitLab.com settings", official docs) — "GitLab.com at scale" component list, Gitaly RPC concurrency limits, Puma timeout, the full rate-limit table, IP ranges.
- Primary: https://docs.gitlab.com/administration/gitaly/ (official docs) — sharded Gitaly storages vs Praefect virtual storage, the GitLab.com Gitaly fleet machine type and observed IOPS.
- Primary: https://docs.gitlab.com/development/database/multiple_databases/ (official docs) — "On GitLab.com we are using separate `main`, `ci`, and `sec` databases".
- Primary: https://docs.gitlab.com/development/redis/ (official docs) and https://gitlab.com/gitlab-com/runbooks/-/blob/master/docs/redis/redis.md (GitLab infrastructure runbooks) — the named production Redis shards and the Sentinel-not-Cluster decision.
- Primary: https://handbook.gitlab.com/handbook/engineering/monitoring/ (GitLab handbook) — the monthly GitLab.com availability table.
- Verified by: official company docs + engineering handbook (controlled documents) + official engineering blog postmortem + infrastructure runbooks — 13 first-party documents fetched and read in full. Full fetch log in `work/research/gitlab-architecture/verify.md`.
- Confidence: high
- Date of source: 2026 (docs, handbook, runbooks, availability table through 2026-08); 2017 (postmortem)

## System in three lines
GitLab.com is the SaaS instance of the GitLab DevSecOps application: Git hosting, issues, merge requests, CI/CD, container registry, package registry and Pages for millions of public and private projects. It is the same open-source Rails monolith that self-managed customers install, deployed on Google Cloud in a single region (`us-east1`) across four GKE clusters with the stateful tiers — PostgreSQL, Gitaly, Redis, Elasticsearch — deliberately kept off Kubernetes. It is hard because one Rails application must serve three very different traffic shapes (web/API, Git over HTTP and SSH, and CI job polling) against one relational database and a fleet of file-system-bound Git servers, all in one region with no cross-region failover.

## Scale (only if stated)
- Availability, measured internally per month: 2026 January 100.00%, February 99.95%, March 99.93%, April 99.31%, May 99.47%, June 99.91%, July 99.98%, August 99.74% — https://handbook.gitlab.com/handbook/engineering/monitoring/
- Kubernetes: "GitLab.com uses 4 Kubernetes clusters for production" — one regional in `us-east1` plus three zonal in `us-east1-b/-c/-d` — https://handbook.gitlab.com/handbook/engineering/infrastructure-platforms/production/architecture/
- Gitaly fleet disk: "500 to 1000 read operations per second... peaks up to 3500" and "approximately 500 write operations per second... peaks above 3000", P99 disk IOPS at one-minute granularity over a representative week; raw data shows writes peaking at 8000 IOPS — https://docs.gitlab.com/administration/gitaly/
- Gitaly fleet machines: "mostly `t2d-standard-32` ... with `pd-ssd` disks", advertised max 60,000 read/write IOPS — https://docs.gitlab.com/administration/gitaly/
- Gitaly per-repository concurrency limits on GitLab.com: 60 concurrent HTTP fetches/clones, 30 concurrent SSH fetches/clones — https://docs.gitlab.com/user/gitlab_com/
- Puma request timeout on GitLab.com: 60 seconds — https://docs.gitlab.com/user/gitlab_com/
- Rate limits (selected, per minute unless noted): authenticated API per user 2,000; authenticated non-API HTTP per user 1,000; authenticated Git HTTPS per user 10,000; unauthenticated Git HTTPS per IP 15,000; Git SSH per user/project/command 600; all traffic per IP 2,000; unauthenticated per IP 500; Pages per IP 1,000 per 50 s; Pages per domain 5,000 per 10 s; pipeline creation 25; runner job requests `/api/v4/jobs/request` 2,000 — https://docs.gitlab.com/user/gitlab_com/
- Database SLOs: `DB-HA-UPTIME` 99.9%, `DB-HA-PERF` p99 < 200 ms, `DB-HA-LOSS` 60 s max accepted data loss, `DB-DR-TTR` 8 h, `DB-DR-RETENTION` 14 days — https://handbook.gitlab.com/handbook/engineering/infrastructure-platforms/database/
- Egress IP ranges for the Web/API fleet: `34.74.90.64/28` and `34.74.226.0/24` — https://docs.gitlab.com/user/gitlab_com/
- 2017 outage: ~300 GB removed from the primary data directory; ~18 hours of downtime; 18 hours to copy the data directory over a ~60 Mbps throttled network disk; lost "at least 5000 projects, 5000 comments, and roughly 700 users" — https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/

## Requirements stated or clearly implied
- Availability target: application availability measured monthly and published; "For GitLab.com we maintain availability above 99.95%" (database handbook). Single GCP region `us-east1`; the design survives zone loss (three zonal clusters plus a regional cluster) but region loss is not covered by the documented production architecture.
- Consistency: strong within PostgreSQL. Decomposed into three physically separate databases — `main`, `ci`, `sec` — and cross-database joins are forbidden, so consistency across those boundaries is application-level only. Git repository data is single-homed per Gitaly node (no quorum replication on GitLab.com).
- Latency target: `DB-HA-PERF` p99 < 200 ms for database query runtime. Puma kills any web request at 60 s. No other per-path budget stated.
- Ordering needs: not stated globally. Sidekiq is a Redis-backed job queue, so per-queue FIFO with no cross-queue ordering guarantee.
- Replay or reprocessing needs: PITR from continuously archived WAL "to any point in time within the last `DB-DR-RETENTION` days".
- Retention: database backups 14 days in multi-regional GCS; hourly incremental block snapshots; weekly full plus daily incremental file-level backups on separate multi-region GCS buckets; continuous WAL archiving. Redis cache instance uses LRU eviction. CI trace chunks live in their own Redis shard before being flushed to object storage.
- Compliance / residency: the production architecture page is a *controlled document* under the security policy (`security_policy_caplscsi`), reviewed by Infrastructure code owners, with exceptions tracked in a compliance issue tracker. Production access only through bastion hosts. Secrets via GKMS (GCP) and Chef encrypted data bags (everything else).

## Boundaries
- Regions / zones: GCP `us-east1` is the core region. Four production Kubernetes clusters: one regional (`us-east1`) and three zonal (`us-east1-b`, `us-east1-c`, `us-east1-d`). CI runner managers and autoscaled machines live in `us-east1-c` and `us-east1-d` (plus a DigitalOcean `nyc1` Prometheus host named in the CI runbook). Staging mirrors the layout.
- Cluster split rationale, verbatim: "Ensure that high-bandwidth services do not send network traffic across zones. Isolation of workloads. Isolation of maintenance changes and upgrades to the clusters." Low-bandwidth services (Sidekiq, Kas) go on the single regional cluster.
- Trust zones: public internet → Cloudflare (WAF + DNS for `gitlab.com`, `gitlab.net`; Route 53 for `gitlab.io`) → HAProxy origin → GKE `gitlab` namespace → datastore VMs off Kubernetes. Operator access to production only through bastion hosts. The `ops` network is peered for monitoring; "No application or customer data flows through these network peers."
- TLD split: "all services providing GitLab as a service shall be in the `gitlab.com` domain, ancillary services in the support of GitLab (i.e. Chef, ChatOps, VPN, Logging, Monitoring) shall be in the `gitlab.net` domain."
- Named subsystems / bounded contexts: Ingress (Cloudflare, HAProxy, NGINX ingress, GitLab Shell); GitLab Services (Workhorse, Puma/Rails, Sidekiq, Pages, Registry, Kas, Mailroom); Metadata (PostgreSQL, Patroni, PgBouncer, Consul); State (Redis shards, Sentinel); Git Repositories (Gitaly); Storage (GCS object storage); Monitoring (Prometheus per cluster, Mimir, Grafana, Fluentd→Elasticsearch, Sentry); CI service (runner managers, autoscaled machines); supporting instances `dev.gitlab.org` (Azure) and `ops.gitlab.net` (GCP).
- Deliberate self-independence boundary: "GitLab.com does not depend on itself when pulling images utilized in our Kubernetes clusters" — CNG images come from the `dev.gitlab.org` registry, third-party images from Docker Hub mirrored through Google's Container Registry cache, "to ensure that during an incident, we will still maintain the ability to pull images."

## Components

The sources name more boxes than the card's 25-row budget; monitoring, security and
out-of-band operational boxes are consolidated into the last two rows, with every named
product kept in the properties column.

| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Cloudflare (WAF + DNS) | First hop for every inbound web, Git HTTP and Git SSH request; WAF, and authoritative DNS for `gitlab.com` and `gitlab.net` | Cloudflare; Amazon Route 53 for `gitlab.io` and others | waf | "All inbound web, git http, and git ssh requests are received at Cloudflare which has HAProxy as an origin"; clients must allow Cloudflare's IPv4 and IPv6 CIDR blocks; DNS authority split by TLD |
| 2 | HAProxy | Cloudflare's origin; "High Performance TCP/HTTP Load Balancer"; splits web/API, Git HTTP and Git SSH traffic | HAProxy (managed by the `gitlab-haproxy` Chef cookbook) | load-balancer | runs on VMs, not in Kubernetes |
| 3 | NGINX | Ingress port for all HTTP requests inside the cluster; routes to Workhorse, Pages, Kas and Registry; terminates TLS | NGINX / `ingress-nginx` | load-balancer | ports 80/443 in; 8090 to Pages, 8150 to Kas |
| 4 | GitLab Shell | Terminates `git` over SSH on port 22; resolves the SSH key through the Rails internal API, then proxies to Gitaly | GitLab Shell (in-house, Go) | app-server | "No GitLab components speak SSH directly"; all SSH connections authenticate as the `git` user; fast SSH key lookup via `AuthorizedKeysCommand`; also enqueues Sidekiq jobs through Redis |
| 5 | GitLab Workhorse | "Smart reverse proxy, handles large HTTP requests"; serves static assets and uploads directly, relays Git smart-HTTP to Gitaly, offloads long requests from Puma | GitLab Workhorse (in-house, Go) | api-gateway | talks to Puma over a Unix domain socket by default, TCP supported; accesses `gitlab/public` directly, bypassing Puma |
| 6 | Puma (GitLab Rails) | The Rails monolith: web UI, REST/GraphQL API, internal API, and the authorization decision for every Git request | Puma | app-server | request timeout 60 s on GitLab.com; reference layout is `puma master` (1 process) plus `puma cluster worker` (2 processes) per node |
| 7 | Sidekiq | Background job processor; pulls jobs from the Redis queue | Sidekiq (Ruby) | worker | runs as an external process on GitLab.com; "multiple pods are configured for Sidekiq cluster to divide Sidekiq queues into different resource groups"; placed on the regional cluster because it is not high-bandwidth |
| 8 | Gitaly | gRPC service that owns every Git read and write; executes `git upload-pack` / `receive-pack` against local disk | Gitaly (in-house, Go) | content-repository | GitLab.com runs sharded storages, one repository per node, no Praefect; fleet "mostly `t2d-standard-32`" with `pd-ssd`; local storage only, NFS unsupported; per-repository RPC concurrency limits (60 HTTP, 30 SSH) with queueing; can back repositories up to object storage |
| 9 | Praefect | "A transparent proxy between any Git client and Gitaly storage nodes", coordinating replication to secondaries | Praefect (in-house, Go) | database-proxy | **Marked as not-supported for GitLab.com** in the component list - it is the Gitaly Cluster option for self-managed installs, not what GitLab.com runs. Kept as a row because the sources name the box and its absence is architecturally decisive |
| 10 | PostgreSQL | System of record for users, permissions, issues, merge requests, pipelines, security findings | PostgreSQL | sql-database | decomposed on GitLab.com into three separate databases, `main`, `ci`, `sec`; cross-database joins raise an error; p99 query runtime SLO 200 ms |
| 11 | Patroni + Consul | Leader election, failover and replication management for the PostgreSQL clusters; Consul provides "Database node discovery, failover" | Patroni; HashiCorp Consul | coordination-service | both enabled on GitLab.com; `DB-HA-LOSS` bounds replication lag at 60 s; PostgreSQL, PgBouncer, Puma and Sidekiq all register with or query Consul |
| 12 | PgBouncer | "Lightweight connection pooler for PostgreSQL"; connection pooling and failover between Rails/Sidekiq and PostgreSQL | PgBouncer | database-proxy | enabled on GitLab.com; sits on the path Puma to PgBouncer to PostgreSQL, and Sidekiq to PgBouncer to PostgreSQL; metrics on 9127 |
| 13 | Redis shards | Six named production Redis clusters, one physical shard per purpose - including the Sidekiq job queue substrate | Redis | cache | `gprd-redis` (shared/persistent state), `gprd-redis-cache` (primary transient cache, LRU eviction), `gprd-redis-sidekiq` (Sidekiq queues, persistent), `gprd-redis-tracechunks` (CI build trace chunks), `gprd-redis-ratelimiting` (RackAttack / application rate limiting), `gprd-sessions` (web sessions). Also backs ActionCable pub/sub and Sidekiq deferred-job concurrency limits |
| 14 | Redis Sentinel | Points clients at the current Redis primary and promotes replicas | Redis Sentinel | coordination-service | "Redis Cluster is not used anywhere in the gitlab.com infrastructure, we only utilize Redis Sentinel"; quorum 2, `num-other-sentinels` 3; "Sentinel does not proxy requests" - it is off the data path; `redis-cache` has its own Sentinel set |
| 15 | Rate limiting | Per-user, per-IP, per-path request limits across web, API, Git HTTPS, Git SSH and Pages; returns HTTP 429 | Rack::Attack backed by `gprd-redis-ratelimiting` | rate-limiter | full published limit table (see Scale); informational headers on most responses; Projects/Groups/Users API responses omit them |
| 16 | Object storage | S3-compatible store for CI artifacts, LFS objects, uploads, registry image blobs, Pages content, Gitaly repository backups, and the WAL/backup archive | Google Cloud Storage (`*.storage.googleapis.com`); backups in multi-regional Standard class | object-store | written by Puma, Sidekiq, Workhorse, Registry, Pages and Gitaly over TCP 443; backup buckets multi-region; `DB-DR-RETENTION` 14 days; hourly incremental block snapshots plus weekly full and daily incremental file backups |
| 17 | Container Registry | Stores user Docker images; NGINX load-balances it and the GitLab Rails app is its auth manager | GitLab Container Registry | container-registry | token auth: registry returns 401 with a token hint, the client fetches a token from GitLab, then retries; blobs in GCS, fronted by `*.cdn.registry.gitlab-static.net` |
| 18 | GitLab Pages | Serves static websites published from repositories, on `*.gitlab.io` | GitLab Pages (in-house, Go) | app-server | NGINX to Pages on TCP 8090; reads content from object storage; own rate limits per IP (1,000 per 50 s) and per domain (5,000 per 10 s), plus separate TLS-connection limits |
| 19 | GitLab agent server (Kas) | Terminates connections from in-cluster GitLab agents for Kubernetes | Kas (in-house, Go) | realtime-gateway | NGINX to Kas on TCP 8150; reads Redis and Sentinel and calls Gitaly; the handbook names Kas as a regional-cluster service while the docs component list marks the GitLab agent as not-supported for GitLab.com - see Unknowns |
| 20 | Mailroom / SMTP gateway | Inbound email that creates and updates issues; outbound notification email | not stated (SMTP gateway) | notification-service | Mailroom reads from Redis and Sentinel; Puma, Sidekiq and Mailroom all send over TCP 25 |
| 21 | Search indexes | Advanced full-text search over code, issues and merge requests (Elasticsearch) and exact-match code search (Zoekt) | Elasticsearch; Zoekt | search-index | Elasticsearch enabled on GitLab.com and kept off Kubernetes, queried by Puma and indexed by Sidekiq over TCP 9200; the GitLab Elasticsearch Indexer and the GitLab Zoekt Indexer are both Gitaly clients; Elasticsearch is also the sink for pod logs, one index per pod |
| 22 | GKE clusters | The compute substrate for the stateless tiers, deployed with the official GitLab Helm chart | Google Kubernetes Engine | container-orchestrator | 4 production clusters - 1 regional (`us-east1`) plus 3 zonal (`us-east1-b`, `us-east1-c`, `us-east1-d`); single `gitlab` namespace for the application; app workloads from `k8s-workloads/gitlab-com` via an MR review workflow, everything else via ArgoCD; Terraform in `config-mgmt` |
| 23 | CI runner fleet | Runner-manager VMs poll the GitLab API for jobs and use Docker Machine to create ephemeral build VMs, one job per machine | GitLab Runner + Docker Machine on GCE | ci-pipeline | three manager classes - `shared-runners-manager-X` (srm, public, unprivileged, machine destroyed after each job), `gitlab-shared-runners-manager-X` (gsrm, tagged `gitlab-org`, machines re-used), `private-runners-manager-X` (prm, privileged, GitLab's own projects); zones `us-east1-c` and `us-east1-d`; configured by Chef, not Terraform; build VMs clone over git+HTTPS with a `gitlab-ci-token` |
| 24 | Observability stack | Metrics, logs, alerts and error tracking for the whole platform | Prometheus (kube-prometheus-stack), Grafana Mimir, Grafana, Alertmanager, fluentd-elasticsearch, Sentry, Jaeger, and the node / Redis / PostgreSQL / PgBouncer / GitLab exporters | timeseries-database | "every cluster has its own Prometheus which gives us some sharding for metrics"; metrics aggregated into Mimir on the ops cluster and queried through Grafana with PromQL; alert rules generated from `mimir-rules`; alertmanagers peered across all networks "to ensure we get alerts out no matter a potential failure of an environment"; logging in the `logging` namespace, one Elasticsearch index per pod |
| 25 | Out-of-band control plane | Everything deliberately kept outside the production failure domain: the image source, the deploy pipeline, operator access and secrets | `dev.gitlab.org` (GitLab on Azure, builds and serves the CNG images); `ops.gitlab.net` (GitLab on GCP with CloudSQL and Memorystore, runs the deploy pipelines); bastion hosts; Google Cloud KMS (GKMS) and Chef encrypted data bags | bastion-host | "GitLab.com does not depend on itself when pulling images"; third-party images mirrored through Google's Container Registry cache; "the pipeline that applies the change is run on a separate operations environment"; production access only through bastions; GKMS for GCP services, Chef encrypted data bags for all other host secrets |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| browser / Git client | cloudflare | HTTPS (80/443), SSH (22) | sync | — | every inbound web, Git HTTP and Git SSH request; WAF inspection |
| cloudflare | haproxy | HTTPS | sync | — | Cloudflare's origin |
| haproxy | nginx | HTTP/HTTPS | sync | — | into the GKE clusters |
| haproxy | gitlab-shell | SSH 22 | sync | — | Git SSH path; SSH server terminates the connection |
| nginx | workhorse | HTTP | sync | — | the default web path |
| nginx | gitlab-pages | TCP 8090 | sync | — | `*.gitlab.io` |
| nginx | kas | TCP 8150 | sync | — | agent connections |
| nginx | registry | HTTP | sync | — | registry front door |
| workhorse | puma | Unix socket (TCP supported) | sync | — | Workhorse decides what actually needs Rails |
| workhorse | gitaly | gRPC | sync | — | `SmartHTTPService.InfoRefsUploadPack`, `PostUploadPack` — the pack data never passes through Rails |
| workhorse | redis | RESP | sync | — | also to Sentinel for primary discovery |
| workhorse | object-storage | TCP 443 | sync | — | direct upload/download, bypassing Rails |
| gitlab-shell | puma (internal API) | HTTP | sync | — | `GET /internal/api/authorized_keys?key=…` then `GET /internal/api/allowed?action=upload_pack&key_id=…`; auth decision before any Git work |
| gitlab-shell | gitaly | gRPC | sync | — | `SSHService.SSHUploadPack`; bidirectional streaming between the client's Git and the server's Git |
| gitlab-shell | redis | RESP | async | at-least-once (Sidekiq) | submits jobs to Sidekiq |
| puma | pgbouncer | PostgreSQL wire | sync | — | pooled; PgBouncer then to PostgreSQL |
| pgbouncer | postgresql | PostgreSQL wire | sync | strong | `main`, `ci`, `sec` are separate databases; no cross-database joins |
| puma | consul | HTTP | sync | — | node discovery / failover awareness |
| pgbouncer | consul | HTTP | sync | — | learns the current primary |
| postgresql | consul | HTTP | sync | — | registers |
| postgresql (primary) | postgresql (replicas) | streaming replication | async | ≤ 60 s lag (`DB-HA-LOSS`) | orchestrated by Patroni |
| postgresql | object-storage (GCS) | WAL archiving | async | continuous | enables PITR to any point within 14 days |
| puma | redis (cache, shared state, sessions, ratelimiting) | RESP | sync | — | separate physical shards per purpose |
| puma | redis (sidekiq shard) | RESP | async | at-least-once | enqueues background jobs |
| sidekiq | redis (sidekiq shard) | RESP | async | at-least-once | dequeues; queues split into resource groups across pods |
| sidekiq | pgbouncer | PostgreSQL wire | sync | — | |
| sidekiq | gitaly | gRPC | sync | — | background Git work |
| sidekiq | object-storage | TCP 443 | sync | — | artifacts, uploads, exports |
| sidekiq | elasticsearch | HTTP 9200 | async | — | indexing via the GitLab Elasticsearch Indexer |
| puma | elasticsearch | HTTP 9200 | sync | — | search queries |
| elasticsearch-indexer / zoekt-indexer | gitaly | gRPC | sync | — | both are Gitaly clients |
| puma | gitaly | gRPC | sync | — | metadata: branches, tags, diffs, blobs |
| gitaly | local disk (`pd-ssd`) | filesystem | sync | — | local storage only; NFS explicitly unsupported |
| gitaly | object-storage | HTTPS | async | — | repository backups |
| gitaly | workhorse | HTTP | sync | — | streams pack data back out |
| registry | puma | HTTP | sync | — | token auth: 401 → client fetches a token from GitLab → retries against the registry |
| registry | object-storage | TCP 443 | sync | — | image blobs |
| gitlab-pages | object-storage | TCP 443 | sync | — | site content |
| runner-manager | puma (API v4) | HTTPS | sync (polling) | — | constant `POST /api/v4/jobs/request` polling; rate-limited to 2,000/min |
| runner-manager | GCE API | HTTPS | sync | — | Docker Machine creates and destroys build VMs |
| runner-manager | autoscaled-machine | Docker Engine API | sync | — | schedules containers, starts scripts, collects output |
| autoscaled-machine | cloudflare → workhorse → gitaly | git over HTTPS | sync | — | clone/fetch with a `gitlab-ci-token`; submodules over the same protocol |
| autoscaled-machine | puma (API v4) | HTTPS | async | — | uploads job traces and artifacts through `gitlab-runner-helper`; trace patches rate-limited to 200/min |
| puma | redis (tracechunks shard) | RESP | sync | — | CI build trace chunks buffered before flushing |
| prometheus (per cluster) | all workloads | HTTP scrape | async | best-effort | one Prometheus per cluster = metric sharding |
| prometheus | mimir (ops cluster) | remote write | async | — | aggregation point behind Grafana |
| fluentd | elasticsearch | HTTP | async | best-effort | one index per pod |
| puma / sidekiq | sentry | HTTPS | async | best-effort | error reports |
| puma / sidekiq / mailroom | smtp gateway | TCP 25 | async | — | outbound notification email |
| dev.gitlab.org registry | gke nodes | HTTPS | sync | — | CNG image pulls, deliberately not from GitLab.com |
| ops.gitlab.net | gke clusters | HTTPS | sync | — | deployment pipelines run outside production |
| argocd | gke clusters | Kubernetes API | sync | — | GitOps for everything except the core `gitlab` namespace |
| operator | bastion-host | SSH | sync | — | the only production access path |

## Failure modes, incidents, tradeoffs the source discusses

**The January 31 2017 database outage** (https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/) — the canonical GitLab failure story, and still the reason most of today's database architecture exists.

- Single point of failure by design: "GitLab.com currently uses a single primary and a single secondary in hot-standby mode. The standby is only used for failover purposes. In this setup a single database has to handle all the load, which is not ideal."
- The trigger was load, not the delete: "A spike in database load caused the database replication process to stop. This was due to the primary removing WAL segments before the secondary could replicate them." WAL archiving was not enabled, so the only repair was to wipe the secondary and re-run `pg_basebackup`.
- The delete: "Trying to restore the replication process, an engineer proceeds to wipe the PostgreSQL database directory, errantly thinking they were doing so on the secondary. Unfortunately this process was executed on the primary instead." ~300 GB gone in a second or two.
- A silent tool made it worse: `pg_basebackup` "will wait for the primary to start sending over replication data and it will sit and wait silently until that time. Unfortunately this was not clearly documented in our engineering runbooks nor in the official `pg_basebackup` document."
- Five backup paths, all useless at once: "the process of both finding and using backups failed completely." `pg_dump` was silently broken because it ran on an application server where Omnibus defaulted to `pg_dump` 9.2 against a 9.6 database; its failure emails "were rejected by the receiving mail server due to the Emails not being signed using DMARC"; Azure disk snapshots "were not enabled for any of the database servers as we assumed that our other backup procedures were sufficient enough"; LVM snapshots existed but "are not really meant to be used for disaster recovery"; and replication had already been destroyed.
- Recovery was bounded by a cheap disk: "Copying the data from the staging to the production host took around 18 hours. These disks are network disks and are throttled to a really low number (around 60Mbps)... There was no network or processor bottleneck, the bottleneck was in the drives."
- Untested backups: "Why was the backup procedure not tested on a regular basis? - Because there was no ownership, as a result nobody was responsible for testing this procedure."
- Data was lost permanently: "we estimate we have lost at least 5000 projects, 5000 comments, and roughly 700 users." Git repositories and wikis survived because "they are stored separately" on the NFS cluster — the split between metadata and repository storage limited the blast radius.
- Explicit tradeoff about where to spend the fix: "Our main focus is to improve disaster recovery, and making it more obvious as to what host you're using; instead of preventing production engineers from running certain commands... one could alias `rm` to something safer but in doing so would only protect themselves against accidentally running `rm -rf /important-data`, not against disk corruption or any of the many other ways you can lose data."
- The remediation list became the architecture: Prometheus monitoring for backups, PITR and continuous WAL archiving, hourly LVM snapshots, automated restore testing, connection pooling/load balancing, and "Assign an owner for data durability". The current database SLOs (`DB-DR-TTR` 8 h, `DB-DR-RETENTION` 14 days, `DB-HA-LOSS` 60 s) and the multi-path backup strategy are the direct descendants.
- The status page failed with the site: "the current setup for this website was not able to handle the load produced by users using this service during the outage."

**Current-architecture tradeoffs.**

- Stateful tiers are kept off Kubernetes on purpose: "Most of GitLab.com is deployed on Kubernetes... There are a few exceptions for this which are mainly the datastore services like `PostgresSQL`, `Gitaly`, `Redis`, `Elasticsearch`." (https://handbook.gitlab.com/handbook/engineering/infrastructure-platforms/production/architecture/)
- Zonal clusters exist to keep bandwidth out of the cross-zone path: "Ensure that high-bandwidth services do not send network traffic across zones", at the cost of running four clusters instead of one. Low-bandwidth services (Sidekiq, Kas) stay on a single regional cluster.
- The deployment path must not depend on the thing it deploys: "the pipeline that applies the change is run on a separate operations environment to ensure that configuration updates do not depend on the availability of the production environment"; and "GitLab.com does not depend on itself when pulling images utilized in our Kubernetes clusters... to ensure that during an incident, we will still maintain the ability to pull images and run our applications as necessary." Third-party images are pulled through Google's Container Registry mirror "providing further redundancy in the event that the Docker Hub is unavailable."
- Alerting is deliberately cross-peered: "we peer all of our networks together such that we have a cluster of alert managers to ensure we get alerts out no matter a potential failure of an environment."
- Redis Cluster was evaluated and declined: "At the moment of writing, Redis Cluster is not used anywhere in the gitlab.com infrastructure, we only utilize Redis Sentinel." (https://gitlab.com/gitlab-com/runbooks/-/blob/master/docs/redis/redis.md) The chosen scaling axis is one physical shard per purpose, not key-space sharding. Sentinel does not proxy — clients ask it for the primary and then connect directly, so a Sentinel outage does not sit on the data path.
- Praefect (Gitaly Cluster) is *not* used on GitLab.com — the component list marks it ❌ for GitLab.com. GitLab.com runs sharded Gitaly storages where a repository lives on one node, so a Gitaly node failure takes its repositories offline rather than being masked by quorum replication. That is the opposite of the brief's assumption and is the single most important correction in this card.
- Gitaly is explicitly the fix for NFS: "Gitaly is a service designed by GitLab to remove our need for NFS for Git storage in distributed deployments of GitLab." Local storage only; NFS is unsupported.
- Gitaly protects itself with per-repository concurrency limits rather than by scaling: exceeding them returns `fatal: remote error: GitLab is currently unable to handle this request due to load`. GitLab.com applies "stricter concurrency limits on expensive Git operations that aren't enabled by default on GitLab Self-Managed instances."
- Workhorse exists purely as a load-shedding layer in front of Rails: it was "designed at GitLab to help alleviate pressure from Puma", serving static files, uploads and Git pack data without ever entering the Ruby process.
- Database decomposition trades join capability for headroom: "To allow GitLab to scale further we decomposed the GitLab application database into multiple databases... On GitLab.com we are using separate `main`, `ci`, and `sec` databases", and cross-database joins now raise an error at development time.
- The database error budget is explicit: "A `DB-HA-UPTIME` of 99.9% allows for roughly 45 minutes of downtime per month... If the budget is used up (planned or unplanned), we stop introducing change and focus on availability."
- CI runner managers are an intentional configuration island: "These machines are manually created and added to chef and do NOT use terraform at this time." Runner upgrades need graceful shutdown (SIGQUIT, drain in-flight jobs) because a plain `chef-client` restart "will break the job."
- Shared public runners destroy their VM after every job ("machines created by `shared-runners-manager-X` are removed immediately after the job is finished") while internal ones re-use them — availability and speed traded against tenant isolation.
- Rate limiting is a first-class architectural component, not an afterthought: a published per-user, per-IP, per-path table backed by its own Redis shard, with 429 responses and informational headers.

## Unknowns
- Absolute traffic volume: no requests/second, repository count, user count or stored-bytes figure appears in any fetched first-party source. The rate-limit table and the Gitaly IOPS charts are the only quantitative load signals published.
- Node and pod counts for Puma, Workhorse, Sidekiq and Gitaly. The sources point at the live Kubernetes values file (`gprd.yaml.gotmpl`) rather than stating numbers.
- Gitaly shard count, the repository-to-shard placement rule, and the rebalancing procedure (the shard-rebalancing runbook returned 404).
- Whether the three databases (`main`, `ci`, `sec`) each have their own Patroni cluster, PgBouncer pool and replica count, and how many replicas serve reads.
- Redis shard sizing, per-shard replica counts, and which shards share Sentinel groups (the runbook notes `redis-cache` "has its own set of sentinel servers, and all the rest run sentinel on the main redis nodes; and this may change in future").
- Elasticsearch cluster topology, shard counts, and how search indexing failures are retried.
- Whether Kas actually runs on GitLab.com: the handbook names it as a regional-cluster service while the docs component list marks the GitLab agent for Kubernetes ❌ for GitLab.com. The two first-party sources disagree.
- Cross-region disaster recovery for the application as a whole. Backups are multi-regional in GCS and PITR is specified, but no warm second region or failover procedure is described. GitLab Geo is marked ✅ for GitLab.com in the component list without any explanation of how it is used.
- Where CI artifacts and job logs are lifecycled — object storage is named, but no retention policy or tiering is stated in the fetched sources.
- The actual production diagrams are Google Drawings marked "GitLab internal use only"; only the surrounding prose is public.

## Candidates
- New kinds: none required. All 35 boxes map to existing catalogue kinds. Two mappings are approximate and worth a second look: Gitaly → `content-repository` (a Git-native repository server with local block storage and gRPC, not a document store), and Praefect → `database-proxy` (a routing/replication proxy in front of storage nodes, but for Git, not SQL).
- New properties on existing kinds:
  - `content-repository.shardingMode` (sharded | replicated) — the Gitaly vs Gitaly-Cluster distinction, and the reason a node loss is customer-visible on GitLab.com
  - `content-repository.perRepoConcurrencyLimit` (integer, per protocol) — Gitaly's 60 HTTP / 30 SSH limits
  - `sql-database.decomposedInto` (list) — `main`, `ci`, `sec`
  - `sql-database.crossDatabaseJoinsAllowed` (boolean)
  - `sql-database.pitrWindowDays` (integer) and `sql-database.walArchiveTarget` (object-store ref)
  - `cache.shardPurpose` (cache | sessions | queues | rate-limiting | trace-chunks | shared-state) — GitLab's scaling axis is one instance per purpose
  - `cache.failoverMechanism` (sentinel | cluster | managed) and whether the mechanism is on the data path
  - `container-orchestrator.clusterScope` (regional | zonal) and `container-orchestrator.clusterCount`
  - `api-gateway.offloadsFromOrigin` (boolean) — the Workhorse pattern
  - `ci-pipeline.ephemeralRunners` (boolean) — destroy-after-job vs re-use
- New requirement paths:
  - `dr.rto` / `dr.rpo` / `dr.backupRetentionDays` — GitLab publishes all three as SLOs
  - `dr.backupPathCount` and `dr.backupRestoreTested` (boolean) — the 2017 postmortem's central lesson
  - `availability.errorBudgetMinutesPerMonth`
  - `boundaries.controlPlaneIndependence` (boolean) — the deploy pipeline and image registry must not live inside the system they operate
- New rules (name + one-line condition):
  - `backup-without-tested-restore`: a design declares a backup path but no restore-test cadence or owner — the 2017 root cause
  - `backup-failure-notified-only-by-email`: backup or job failure alerting whose only channel is email, with no metric or alert rule
  - `single-primary-no-wal-archive`: sql-database with one primary and replication as the only recovery path, and no continuous archive target
  - `replica-rebuild-destroys-only-recovery-copy`: a documented recovery procedure whose first step wipes the sole surviving replica
  - `stateful-node-single-homed`: content-repository or sql-database with `shardingMode: sharded` and no replica, while the design claims a zone-failure requirement
  - `deploy-pipeline-inside-target-system`: a ci-pipeline node that deploys the same design it is part of, with no separate operations environment
  - `image-registry-self-dependency`: a container-orchestrator pulling images from a container-registry inside the same design
  - `status-page-shares-failure-domain`: monitoring or status surfaces deployed in the same cluster/region as the system they report on
  - `cross-zone-high-bandwidth-path`: an edge marked high-bandwidth between nodes pinned to different availability zones
  - `unbounded-origin-behind-cdn`: an edge from a waf/cdn to an origin load-balancer with no rate-limiter node on the path
