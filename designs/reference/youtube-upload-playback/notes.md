# youtube-upload-playback: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/youtube-upload-playback.md` (Cuong Do's 2007 Google Tech Talk write-up, Mike Solomon's 2012 "7 years of YouTube scalability" write-up, the official Vitess history, and 2021 press coverage of Google's Argos VCU paper). Verified 2026-09-13.
- Size: 19 nodes, 24 edges, 5 groups. Broken twin: 17 nodes, 23 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture 8, clean variant: YouTube's upload, transcoding and playback path —
a sharded MySQL serving tier behind Vitess, a jittered multi-level page cache, thumbnails in
BigTable, and an asynchronous transcoding pipeline that feeds a CDN and the colo video racks.

Fixes relative to youtube-upload-playback.broken.yaml:
  - vitess sits between python-app and mysql-shards: the shard routing, connection pooling and
    query rewriting live in the proxy, not in application code, and mysql-shards is sharded by
    user so writes are no longer aimed at one primary that read replicas cannot help
  - zookeeper holds the Vitess topology and is a replicated ensemble, not a single instance
  - page-cache declares a ttl eviction policy with jitter (expiry randomised between 18 and
    30 hours), which is the documented fix for the synchronised-expiry thundering herd
  - upload-service hands transcoding to transcode-queue asynchronously instead of calling the
    transcoding farm inline on the upload request
  - transcode-queue and extract-queue both declare a dead-letter queue, so a video that cannot
    be transcoded is parked instead of retried forever
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture 8, broken variant: the same YouTube upload and playback path as it
looked before Vitess and before the cache work — shard routing in application code against a
single MySQL primary with read replicas bolted on, a page cache with no declared eviction
policy, transcoding invoked inline from the upload handler, and an extraction queue with
nowhere to park a video that will never extract.

This file MUST trip:
  - read-replica-as-sole-scaling       (mysql-primary: async replicas, not sharded, 11574 rps)
  - single-writer-primary-at-peak-qps  (mysql-primary: single unsharded writer at 11574 rps)
  - cache-missing-eviction-policy      (page-cache declares evictionPolicy none)
  - queue-missing-dlq                  (extract-queue takes async traffic, deadLetterQueue false)
  - fanout-inline-in-request-path      (upload-service calls transcoding-farm synchronously)

Each of the five is a mistake the sources themselves describe. The first two are the exact
sequence vitess.io records: read replicas added, "read-only traffic was still high enough to
overload the replica database", then "write traffic became too high for the primary database to
handle". The third is the thundering herd the 2012 talk warns about ("if everything expires at
one time then every machine will calculate the expiration at the same time"). The last two are
the shape an upload pipeline takes before someone makes transcoding a job.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Browser / device clients (web, mobile, TV) | `device-client` | `web-browser` | client | close (one node with `platform: multi` for the source's single client box) |
| NetScaler | `netscaler` | `load-balancer-tier` | load-balancer | close (Citrix NetScaler has no component; generic load-balancer tier, label kept) |
| Apache + mod_fastcgi | `apache-frontend` | `apache-httpd` | load-balancer | exact |
| Python app servers (Spitfire, psyco) | `python-app` | `container-service` | app-server | close (in-house service, generic app-server) |
| Page / row / object caches | `page-cache` | `memcached` | cache | close (source says memcached-class multi-level caching; one node) |
| Precalculated data pushed to app servers | `precompute-jobs` | `cron-job` | worker | assumed (source states the push, not the scheduler) |
| lighttpd video servers | `lighttpd-video` | `container-service` | app-server | close (lighttpd has no component; generic app-server, label kept) |
| CDN | `video-cdn` | `content-delivery-network` | cdn | exact (source names no vendor, the generic CDN is the right component) |
| YouTube colos (long-tail video racks) | `colo-video-store` | `blob-store` | object-store | close |
| Video storage (master files and variants) | `video-storage` | `blob-store` | object-store | close (source names no product) |
| Thumbnail store | `thumbnail-store` | `bigtable` | nosql-database | exact |
| MySQL | `mysql-shards` (clean) / `mysql-primary` + `mysql-replica` (broken) | `mysql` | sql-database | exact |
| Vitess | `vitess` | `vitess` | database-proxy | exact |
| Zookeeper | `zookeeper` | `zookeeper` | coordination-service | exact |
| Upload service | `upload-service` | `container-service` | app-server | close |
| Transcoding farm (Argos VCU on Borg) | `transcoding-farm` | `container-worker` | worker | close (`accelerator: asic` carries the VCU) |
| Thumbnail / caption / metadata extractors | `extractors` | `container-worker` | worker | close |
| (transcode job queue, implied by the async fan-out edge) | `transcode-queue` | `message-queue` | queue | assumed (source states a fan-out to transcoding, no product) |
| (extraction job queue, implied by the async job edge) | `extract-queue` | `message-queue` | queue | assumed |

Confidence tally: 6 exact, 9 close, 3 assumed (the clean design's 19 nodes; `mysql` counts once).

## Assumed values

No source states these; each is set to the value that reflects the real system's documented
practice, as the brief's step 3 requires when the source is silent but a rule reads the property.

- `security.credentialRotationDays: 90` — keeps `credentials-without-rotation` quiet. YouTube
  published nothing about credential rotation.
- `transcode-queue.deadLetterQueue: true`, `extract-queue.deadLetterQueue: true` — the source
  names no queue product and no retry semantics; a pipeline that transcodes 60 hours of video a
  minute parks the ones that cannot be transcoded.
- `mysql-shards.backupEnabled: true`, `backupRetentionDays: 30` — no published backup policy.
- `transcoding-farm.idempotent: true`, `extractors.idempotent: true`, `precompute-jobs.idempotent: true`
  — re-running a transcode or a thumbnail extraction over the same source file is naturally
  idempotent, but the source does not say so.
- `zookeeper.replicated: true` — ZooKeeper as a Vitess topology store is an ensemble by
  construction; the talks say only that Zookeeper is used.
- `page-cache.ttlSeconds: 64800` — 18 hours, the lower bound of the source's stated 18-30 hour
  jittered expiry window. `ttlJitter: true` carries the jitter itself.
- `thumbnail-store` replication `multi-region-multi-leader` with `conflictResolution: last-writer-wins`
  — the source says thumbnails are replicated across colos; last-writer-wins is BigTable's own
  documented default, not an invention.
- `requirements.freshness.maxSeconds: 1` — rounded up from the stated 300-400 ms comment delay,
  which is the only freshness figure the sources give.

## Catalogue gaps

| Product | Kind it would need | Used instead |
|---|---|---|
| Citrix NetScaler | `load-balancer` | `load-balancer-tier` (label `NetScaler`) |
| lighttpd (worker-thread patched) | `load-balancer` or a static-file `app-server` | `container-service` with `runtime: lighttpd` (label kept) |
| Google Borg | no kind (cluster scheduler) | not encoded; the transcoding farm is a `container-worker` |
| Google Argos VCU | no kind (accelerator hardware) | `container-worker` with `accelerator: asic` |
| Spitfire, Wiseguy, psyco | no kind (libraries inside a process) | not encoded; `python-app` carries `runtime: python` |

## Not encoded

- The 20-33x compute-efficiency figure for the Argos VCU: the format has no place for a
  hardware efficiency multiplier. `accelerator: asic` is the only thing carried over.
- "Dozens of resolution and codec variants per video": there is no fan-out multiplier on an
  edge. It lives in the `transcoding-farm -> video-storage` edge label.
- Upload resumability: `app-server` has no `resumableUploads` property, so "chunked resumable
  upload" is on the `device-client -> upload-service` edge label, with `idempotent: true` and
  `retryPolicy: exponential-jitter` on that edge as the closest expressible equivalent.
- Multi-level caching (row cache, fully-formed Python objects, precalculated data in application
  memory) is one `page-cache` node; the format has no cache-tier list.
- The per-shard primary/replica pairs inside `mysql-shards`: the clean design draws the sharded
  store as one node, so the binlog replication edge only appears in the broken twin, where the
  pre-Vitess primary and its read replicas are separate boxes.
- Read-your-writes for comments (writer sees the comment instantly, readers after 300-400 ms):
  there is no `readYourWrites` edge field in v1. Carried as `consistency.model: ap` plus
  `freshness.maxSeconds: 1`.
- "Simplicity allows you to rearchitect more quickly" and "the state of the system is that which
  it is reported to be": design philosophy, not topology.
- The 2007 team composition (2 sysadmins, 2 architects, 2 developers, 2 network engineers, 1 DBA).
