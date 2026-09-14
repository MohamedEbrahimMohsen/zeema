# canva-uploads: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/canva-uploads.md`
- Size: 23 nodes, 31 edges, 4 groups.

## Clean variant (header of design.yaml)

Canva's media platform, clean variant: 50 million uploads a day land in tiered S3 while the
metadata moves live from sharded RDS MySQL to DynamoDB through two priority SQS queues.

Fixes relative to canva-uploads.broken.yaml:
  - media-service hands perceptual hashing to phash-worker asynchronously instead of
    computing it synchronously on the upload request path
  - live change traffic and the backfill scan keep separate queues and the design does not
    claim per-queue worker isolation the single replication-worker cannot deliver
  - both SQS queues declare a dead-letter queue, so a poison replication notification parks
    instead of being redriven forever
  - the cold tier stays on S3 Standard-IA across three zones rather than a one-zone class
  - mysql-primary keeps RDS automated backups with a stated retention
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Canva's media platform, broken variant: perceptual hashing runs inline on the upload request,
one replication worker drains both priority queues with neither queue parked on a dead-letter
queue, the cold media tier is a single-zone class, and the first MySQL shard has no backup.

This file MUST trip:
  - fanout-inline-in-request-path                    (media-service calls phash-worker synchronously on upload)
  - shared-worker-pool-across-queues                 (replication-worker drains both SQS queues while isolation.perQueue is required)
  - queue-missing-dlq                                (sqs-high-priority and sqs-low-priority take async traffic with deadLetterQueue false)
  - object-store-single-zone-with-durability-target  (s3-standard-ia moved to one-zone-ia, zones 1, while durability.annualNines is 11)
  - datastore-missing-backup                         (mysql-primary has backupEnabled false)
and MUST NOT trip:
  - datastore-single-region                          (availability.multiRegion is not declared)
  - single-writer-primary-at-peak-qps, read-replica-as-sole-scaling (both MySQL shards declare sharded true and no node states rps above 5000)
  - read-heavy-path-without-cache                    (traffic.readWriteRatio is not declared; the sources state no ratio)
  - credentials-without-rotation                     (security.credentialRotationDays is declared)
  - multi-leader-store-without-conflict-policy       (the DynamoDB tables stay single-region)
  - business-updates-without-index-propagation, derived-store-without-cdc-or-rebuild (no search-index node)
  - cache-as-primary-store-without-persistence, cache-missing-eviction-policy, materialised-cache-without-rebuild-path (no cache node)
  - reconnect-stampede-without-guard, stateful-websocket-scale-in-without-drain, shared-host-per-channel-without-isolation (no realtime-gateway)
  - retry-without-adaptive-shedding, retry-without-backoff, retry-queue-without-dlq (no retry policy and no retry queue)
  - sync-chain-too-deep                              (no api-gateway node and no latency.p95Ms target)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone (no availability-zone group)

Each broken mistake is one the sources themselves warn about: the Compute Service post exists
precisely because CPU-bound hashing and signing used to sit on the request-serving fleet;
Canva split the replication bus into high- and low-priority queues so a full backfill could not
starve live change replication; the S3 cost post's whole argument is that a storage-class choice
made on price alone is a durability and retrieval decision; and the MySQL post's premise is that
media metadata is a system of record.

## Mapping

| Source box (card row) | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| 1 Canva client (web, mobile, WebView) | `canva-client` | `web-browser` | client | close (one node for web, mobile and WebView; `platform: multi`) |
| 2 Cloudflare edge (CDN + Workers) | `cloudflare-cdn` | `cloudflare-cdn` | cdn | exact (`edgeCompute: true` for Workers L7 logic) |
| 3 Cloudflare WAF / Bot Management / Page Shield | `cloudflare-waf` | `cloudflare-waf` | waf | close (Bot Management and Page Shield folded in as `botProtection: true`) |
| 4 Load Balancer (ELB / ALB) | `client-alb` | `alb` | load-balancer | exact |
| 5 Media service | `media-service` | `vm-service` | app-server | exact (JVM service on EC2 autoscaling groups, not containers) |
| 6 MySQL RDS primary (`media.primary`) | `mysql-primary` | `aws-rds` | sql-database | exact |
| 7 MySQL RDS second shard (`media.primary-1`) | `mysql-primary-1` | `aws-rds` | sql-database | exact |
| 8 MySQL read replicas | `mysql-replicas` | `aws-rds` | sql-database | exact |
| 9 JSON content-metadata column | — | — | — | not a runtime element; see "Not encoded" |
| 10 DynamoDB media table | `dynamodb-media` | `dynamodb` | nosql-database | exact |
| 11 DynamoDB composite GSIs | `dynamodb-gsi` | `dynamodb` | nosql-database | close (a GSI is part of the table; drawn separately because the card lists it as its own access path) |
| 12 High-priority SQS queue | `sqs-high-priority` | `sqs` | queue | exact |
| 13 Low-priority SQS queue | `sqs-low-priority` | `sqs` | queue | exact |
| 14 Replication worker instances | `replication-worker` | `container-worker` | worker | close (the generic worker; Canva runs these on EC2) |
| 15 Backfill scanner | `backfill-scanner` | `container-worker` | worker | close (`trigger: batch` is an interpretation of "scanned through all media") |
| 16 Dual-read comparator | `dual-read-comparator` | `vm-service` | app-server | close (the card says it lives inside the media service; drawn separately so the two store reads are visible) |
| 17 Feature flag system | `feature-flags` | `flipt` | feature-flag-service | assumed (in-house system; see "Catalogue gaps") |
| 18 S3 media buckets | — | — | object-store | merged into rows 19 and 20 |
| 19 S3 Standard tier | `s3-standard` | `s3` | object-store | exact |
| 20 S3 Standard-IA / Glacier Instant Retrieval | `s3-standard-ia`, `s3-glacier-ir` | `s3`, `aws-s3-glacier` | object-store | exact (two nodes: the card's own lifecycle chain has two hops) |
| 21 Compute Service (+ its own ELB) | `compute-service`, `compute-service-elb` | `vm-service`, `aws-classic-load-balancer` | app-server, load-balancer | exact (`instances: 4` is the stated upper bound of "between two and four c4.large instances") |
| 22 Content matching index | `content-matching-index` | `dynamodb` | nosql-database | exact (`partitionKey` shape, 2000 qps peak and 60 ms p95 are all stated) |
| 23 pHash computation | `phash-worker` | `container-worker` | worker | close (the card does not say where in the upload path it runs; the clean design makes it async) |
| 24-28 WebSocket Gateway, event collection, Snowflake, CDC, usage-count export | — | — | — | trimmed: downstream subsystems, outside the 25-node budget |

Confidence tally: 13 exact, 9 close, 1 assumed.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Canva's in-house feature flag system | `feature-flag-service` has no generic or in-house component under `default`; every entry is a named vendor product | `flipt` (self-hosted, `managed: false`, the closest shape to a system a team runs itself) |

No component is missing outright; nothing needs adding to `components/`.

## Not encoded

- The JSON content-metadata column, and the denormalisation, removed foreign keys and removed repeated bucket names that came with it: schema technique inside one node, with no `sql-database` property for it.
- The MySQL shard cut point, and how the two-shard split was resolved during the DynamoDB migration: never stated by the source.
- The scale numbers themselves (50M uploads/day, 25B media, 230 PB, 300B objects, 45 PB largest bucket, 10B hashes): `nfr` carries only `rps`, `latencyP95Ms` and `consistency`, so only the content-matching index's stated 2000 qps and 60 ms p95 survive.
- The S3 economics — the 128 KB minimum billable object size, the 400 KB average-object-size selection threshold, the $0.02 per 1,000 transition requests, the $1.6M once for $300K/month — appear only as edge labels; `object-store` has no cost or object-size properties.
- The storage-class analysis finding that 10% of the bytes in S3 Standard serve 60-70% of accesses: encoded only as `traffic.skew: heavy-tail`.
- Zero-downtime migration as a promise, and "revert reads within seconds": no `migration.*` requirement path exists in v1, so it is carried only by the `feature-flags` node and its edge label.
- The payload-free nature of the SQS notifications, which is what makes replication idempotent: expressed as `idempotent: true` on the edges plus the edge label, not as a queue property.
- Cost as a first-class requirement (DynamoDB cheaper than the RDS clusters it replaced): no requirement path for cost.
- Graceful degradation of the Compute Service is `availability.degradedModeAllowed` plus `fallback: degraded` on one edge; the source's stronger statement ("the rest of our systems remain as functional as possible, albeit degraded") has no finer expression.
- Region and availability-zone topology: no region names, no AZ statement, no cross-region replication story for media bytes anywhere in the sources, so the design declares no `region` or `availability-zone` group and no `availability.multiRegion`.

## Assumed values

`sqs.deadLetterQueue: true` on both queues, `aws-rds.backupRetentionDays: 7` / `multiAz: true` /
`publiclyAccessible: false` on all three MySQL nodes, and
`requirements.security.credentialRotationDays: 90` are not stated by any source. They are set to
the value that reflects standard practice for the managed services Canva names, because the
clean tier must not fire `queue-missing-dlq`, `datastore-missing-backup` or
`credentials-without-rotation`. The edge `backfill-scanner -> mysql-primary` is implied by
"scanned through all media, beginning with the most recently created" rather than drawn in the
card's edge table.
