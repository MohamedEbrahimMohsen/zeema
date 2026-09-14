# gitlab-architecture

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_git_client["Browsers and Git clients<br/><i>user-device</i>"]
  subgraph n_g_cloudflare_edge["Cloudflare global edge (WAF + DNS) (point-of-presence)"]
    n_cloudflare["Cloudflare (WAF + authoritative DNS)<br/><i>cloudflare-waf</i>"]
  end
  subgraph n_g_us_east1["GCP us-east1 (region)"]
    n_gcs["Google Cloud Storage (artifacts, LFS, uploads, registry blobs, backups)<br/><i>gcs</i>"]
    subgraph n_g_lb_tier["HAProxy origin fleet (VMs, not Kubernetes) (trust-zone)"]
      n_haproxy["HAProxy (Cloudflare origin)<br/><i>haproxy</i>"]
    end
    subgraph n_g_gke_zonal["Zonal GKE clusters us-east1-b/-c/-d, gitlab namespace (trust-zone)"]
      n_nginx["NGINX ingress<br/><i>nginx</i>"]
      n_gitlab_shell["GitLab Shell (Git over SSH, port 22)<br/><i>container-service</i>"]
      n_workhorse["GitLab Workhorse (smart reverse proxy)<br/><i>container-service</i>"]
      n_puma["Puma (GitLab Rails monolith)<br/><i>container-service</i>"]
      n_rack_attack["Rack::Attack (gprd-redis-ratelimiting)<br/><i>redis-rate-limiter</i>"]
      n_gitlab_pages["GitLab Pages (*.gitlab.io)<br/><i>container-service</i>"]
      n_registry["GitLab Container Registry<br/><i>gitlab-registry</i>"]
    end
    subgraph n_g_gke_regional["Regional GKE cluster, low-bandwidth services (trust-zone)"]
      n_sidekiq["Sidekiq (background jobs)<br/><i>container-worker</i>"]
      n_kas["Kas (GitLab agent server)<br/><i>websocket-gateway</i>"]
    end
    subgraph n_g_datastores["Datastore VMs, deliberately off Kubernetes (trust-zone)"]
      n_gitaly["Gitaly fleet (t2d-standard-32, pd-ssd, sharded storages)<br/><i>file-store</i>"]
      n_pgbouncer["PgBouncer<br/><i>pgbouncer</i>"]
      n_postgresql["PostgreSQL primary (main, ci, sec)<br/><i>postgres</i>"]
      n_postgresql_replica["PostgreSQL hot standbys<br/><i>postgres</i>"]
      n_consul["Patroni + Consul<br/><i>consul</i>"]
      n_redis_cache["gprd-redis-cache (transient cache)<br/><i>redis</i>"]
      n_redis_shared_state["gprd-redis, gprd-sessions, gprd-redis-tracechunks (persistent shards)<br/><i>redis</i>"]
      n_sidekiq_queue["gprd-redis-sidekiq (job queues)<br/><i>redis-queue</i>"]
      n_elasticsearch["Elasticsearch (advanced search, and the pod log sink)<br/><i>elasticsearch</i>"]
    end
    subgraph n_g_ci_zones["CI runner managers, us-east1-c and us-east1-d (trust-zone)"]
      n_runner_manager["Runner managers (GitLab Runner + Docker Machine on GCE)<br/><i>gitlab-ci</i>"]
    end
  end
  subgraph n_g_ops["ops.gitlab.net and dev.gitlab.org, outside the production failure domain (trust-zone)"]
    n_prometheus["Prometheus per cluster, remote-written to Mimir<br/><i>prometheus</i>"]
    n_gkms["GKMS (Google Cloud KMS)<br/><i>google-cloud-kms</i>"]
  end
  n_git_client -->|"all web, Git HTTP and Git SSH traffic [https]"| n_cloudflare
  n_cloudflare -->|"Cloudflare origin [https]"| n_haproxy
  n_haproxy -->|"web and API into the GKE clusters [http]"| n_nginx
  n_haproxy -->|"Git over SSH, port 22, as the git user [ssh]"| n_gitlab_shell
  n_nginx -->|"the default HTTP path [http]"| n_workhorse
  n_nginx -->|"TCP 8090 [http]"| n_gitlab_pages
  n_nginx -->|"TCP 8150 [http]"| n_kas
  n_nginx -->|"registry front door [http]"| n_registry
  n_workhorse -->|"Unix socket; only what really needs Rails, Puma kills at 60 s [http]"| n_puma
  n_workhorse -->|"SmartHTTPService pack data, never through Ruby [grpc]"| n_gitaly
  n_workhorse -->|"direct upload and download, bypassing Rails [https]"| n_gcs
  n_workhorse -->|"shared state read [redis]"| n_redis_cache
  n_gitlab_shell -->|"internal API: authorized_keys, then allowed? [http]"| n_puma
  n_gitlab_shell -->|"SSHService.SSHUploadPack, bidirectional stream [grpc]"| n_gitaly
  n_gitlab_shell -.->|"enqueue Sidekiq job [redis, at-least-once]"| n_sidekiq_queue
  n_puma -->|"per-user, per-IP, per-path limits; 429 with headers [redis]"| n_rack_attack
  n_puma -->|"pooled, never straight at the primary [postgres]"| n_pgbouncer
  n_pgbouncer -->|"main, ci and sec; cross-database joins raise an error [postgres]"| n_postgresql
  n_pgbouncer -->|"learns the current primary [http]"| n_consul
  n_postgresql -->|"registers; Patroni drives failover [http]"| n_consul
  n_puma -->|"database node discovery [http]"| n_consul
  n_postgresql -.->|"streaming replication, DB-HA-LOSS bounds lag at 60 s [postgres-replication, at-least-once]"| n_postgresql_replica
  n_postgresql -.->|"continuous WAL archiving, PITR within 14 days [https, at-least-once]"| n_gcs
  n_puma -->|"transient cache, LRU eviction [redis]"| n_redis_cache
  n_puma -->|"sessions, shared state, CI trace chunks [redis]"| n_redis_shared_state
  n_puma -.->|"enqueue background job [redis, at-least-once]"| n_sidekiq_queue
  n_sidekiq_queue -.->|"dequeue; queues split into resource groups across pods [redis, at-least-once]"| n_sidekiq
  n_sidekiq -->|"pooled [postgres]"| n_pgbouncer
  n_sidekiq -->|"background Git work [grpc]"| n_gitaly
  n_sidekiq -->|"artifacts, uploads, exports [https]"| n_gcs
  n_sidekiq -.->|"GitLab Elasticsearch Indexer, TCP 9200 [http, at-least-once]"| n_elasticsearch
  n_puma -->|"advanced search queries [http]"| n_elasticsearch
  n_puma -->|"branches, tags, diffs, blobs [grpc]"| n_gitaly
  n_puma -->|"service secrets; Chef encrypted data bags elsewhere [https]"| n_gkms
  n_gitaly -.->|"repository backups [https, at-least-once]"| n_gcs
  n_registry -->|"token auth: 401, client fetches a token, retries [http]"| n_puma
  n_registry -->|"image blobs [https]"| n_gcs
  n_gitlab_pages -->|"site content [https]"| n_gcs
  n_kas -->|"agent configuration from the repository [grpc]"| n_gitaly
  n_kas -->|"agent connection state [redis]"| n_redis_shared_state
  n_runner_manager -->|"POST /api/v4/jobs/request polling, 2000 per minute [https]"| n_puma
  n_runner_manager -->|"ephemeral build VMs clone with a gitlab-ci-token [https]"| n_cloudflare
  n_prometheus -.->|"one Prometheus per cluster scrapes every workload [http, at-most-once]"| n_puma
  n_prometheus -.->|"node, PostgreSQL and PgBouncer exporters [http, at-most-once]"| n_postgresql
```
