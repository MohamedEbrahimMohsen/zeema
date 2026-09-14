# Intake: Canva media platform (50M uploads/day, MySQL to DynamoDB, S3 tiering)

## Source
- Primary: https://www.canva.dev/blog/engineering/from-zero-to-50-million-uploads-per-day-scaling-media-at-canva/ (Robert Sharp and Jacky Chen, Canva engineers, Canva Engineering Blog, 2022: media service, RDS MySQL limits, SQS live replication, DynamoDB cutover)
- Primary: https://www.canva.dev/blog/engineering/optimising-s3-savings/ (Josh Smith, Engineering Lead Core Data, Canva Engineering Blog, 2023: 230 PB / 300B objects, storage classes, lifecycle, Glacier Instant Retrieval migration)
- Primary: https://aws.amazon.com/blogs/storage/how-canva-saves-over-3-million-annually-in-amazon-s3-costs/ (co-authored by Josh Smith, Engineering Lead Core Data at Canva, AWS Storage Blog, 2023: the same S3 numbers, Storage Class Analysis)
- Primary: https://www.canva.dev/blog/engineering/canvas-compute-backend/ (Samuel Killin, Canva engineer, Canva Engineering Blog: Compute Service, signed URLs for private media)
- Primary: https://www.canva.dev/blog/engineering/simple-fast-and-scalable-reverse-image-search-using-perceptual-hashes-and-dynamodb/ (Christopher Bong, Canva engineer, Canva Engineering Blog, 2022: pHash content matching on DynamoDB)
- Primary: https://www.canva.dev/blog/engineering/enabling-real-time-collaboration-with-rsocket/ (Canva Engineering Blog: WebSocket Gateway, RSocket, service registry, draining)
- Primary: https://www.canva.dev/blog/engineering/product-analytics-event-collection/ (Long Nguyen, Canva engineer, Canva Engineering Blog, 2024: 25B events/day, Kinesis, Snowpipe)
- Primary: https://www.canva.dev/blog/engineering/scaling-to-count-billions/ (Sangzhuoyang Yu, Canva engineer, Canva Engineering Blog, 2024: content usage counting pipeline)
- Primary: https://www.canva.dev/docs/apps/uploading-assets/ (official Canva Apps SDK documentation: the documented upload contract and limits)
- Secondary (support only): https://www.cloudflare.com/case-studies/canva/ (vendor case study quoting Michael Yates, Senior Engineering Manager at Canva: CDN, Workers, WAF, Bot Management)
- Verified by: nine first-party documents fetched in full — seven Canva Engineering Blog posts by named Canva engineers, one official Canva Apps SDK doc page, one AWS Storage Blog post co-authored by Canva's Core Data engineering lead; one vendor case study as support
- Confidence: high
- Date of source: 2016-2024 (Compute Service oldest; media migration 2022; S3 and analytics 2023-2024)

## System in three lines
The media platform behind Canva's Uploads tab: it ingests user-uploaded images, video and audio, stores the bytes in S3 and the metadata in a media service, and serves them back into every design the user opens. The metadata store started as a single AWS RDS MySQL instance, was bridged with a JSON metadata column and then a two-way application-level shard split, and was finally migrated live to DynamoDB by lazily replicating through SQS while dual-reading and comparing against MySQL. It is hard because writes grow exponentially and never stop (50 million new media a day, 25 billion stored), reads are dominated by recently created media, the bytes reach hundreds of petabytes across hundreds of billions of small objects, and the migration had to happen with no downtime under live traffic.

## Scale (only if stated)
- Users: "over 100 million monthly active users" and a library of "over 100 million stock photos and graphics" (from-zero-to-50-million-uploads)
- Uploads: "50 million new media daily"; "over 25 billion user-uploaded media" stored (from-zero-to-50-million-uploads)
- Growth: approaching 1 billion cumulative media by mid-2017, exponential from January 2015 (from-zero-to-50-million-uploads)
- Object storage: "more than 230 Petabytes of data in Amazon S3", "over 300 billion objects", largest single bucket 45 PB, ~130 PB ending in Glacier Instant Retrieval (optimising-s3-savings; aws.amazon.com/blogs/storage)
- Curated library: "over 75 million stock photos and graphics" in S3 Standard (aws.amazon.com/blogs/storage)
- Content matching: "Hashes for over 10 billion images in DynamoDB", "Peak workload is in excess of 2000 queries per second", ~10k DynamoDB RCU, 40 ms average / 60 ms p95 (reverse-image-search)
- Analytics: "25 billion events per day (800 billion events per month), with 99.999% uptime", collection p99 < 20 ms (product-analytics-event-collection)
- Usage counting: "billions of content usages each month" (scaling-to-count-billions)
- Compute Service: runs "between two and four c4.large instances" (canvas-compute-backend)
- Edge: 260 million monthly users served with "less than 50ms latency" (Cloudflare case study — secondary)

## Requirements stated or clearly implied
- Availability target: the media metadata migration had to be done with "no downtime or errors"; the old MySQL path could not do "instance restarts and version upgrades ... without accepting some downtime". Event collection targets 99.999%. Compute Service must degrade rather than fail: "In the event of the Compute Service becoming unavailable, we wanted the rest of our systems to remain as functional as possible, albeit degraded."
- Consistency: during migration the DynamoDB copy was eventually consistent with MySQL — replication was lazy and message-driven, and correctness was established by a dual-read comparison rather than by a transaction. Event collection is explicitly at-least-once: "When an event is accepted by the server (a 200 OK response), it's guaranteed to be delivered to all subscribed consumers at least once", with dedup pushed to consumers.
- Latency target: not stated as an SLO for media reads; median and p95 media service latency are reported as falling across the migration. Content matching: 40 ms average, 60 ms p95. Event collection: p99 < 20 ms.
- Ordering needs: not stated. Replication messages carry no payload ("without containing the content of the update"), so the worker always reads current state and ordering of messages does not matter.
- Replay or reprocessing: the backfill "scanned through all media, beginning with the most recently created"; the usage-counting pipeline is deliberately rerunnable — "we can fix most of them by rerunning the pipeline end-to-end, without humans logging into the database".
- Retention: media is kept indefinitely; status values include "active, trashed, pending deletion". S3 lifecycle moves objects Standard -> Standard-IA at 30 days and later to Glacier Instant Retrieval.
- Compliance / residency: Snowflake is the warehouse "for most of the regions", implying per-region warehouses; asset `ref` on derived uploads exists because "Canva licenses assets from a number of creators and it's only by providing the ref of existing assets that Canva can ensure these licensing requirements are met". No explicit PCI/GDPR statement.
- Cost: an explicit first-class requirement — DynamoDB ended up "costing us less than the AWS RDS clusters it replaced"; the S3 tiering programme spent $1.6M once to save $300K/month.

## Boundaries
- Regions / zones: AWS; multiple regions implied by "most of the regions" for Snowflake. Specific region names and AZ topology are not stated.
- Trust zones: public internet clients and third-party app URLs (untrusted) -> Cloudflare edge (CDN, WAF, Bot Management, Workers) -> ELB/ALB -> JVM backend microservices -> data stores. Private user media is never served openly: it is reached only through time-limited signed URLs produced by the Compute Service.
- Named subsystems / bounded contexts: media service; Compute Service; content matching (reverse image search); WebSocket Gateway / real-time collaboration; product analytics event collection; content usage counting; Core Data (the team owning S3 persistence). Canva describes its backend as "microservices ... most services being resource-oriented, managing operations on different resources ... for example, users, documents, folders, and media."

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Canva client (web, mobile, WebView) | Uploads media, opens designs, reads media back; analytics client library shared across front ends | in-house TypeScript core library in a WebView | client | shared core analytics library across all front ends |
| 2 | Cloudflare edge (CDN + Workers) | Global content delivery and Layer-7 logic offloaded from the backend | Cloudflare CDN, Cloudflare Workers | cdn | "offload Layer 7 logic like redirects, security headers, and other filters to the global network"; <50 ms latency claim (secondary source) |
| 3 | Cloudflare WAF / Bot Management / Page Shield | Blocks scrapers harvesting user and stock assets | Cloudflare WAF, Bot Management, Page Shield, DDoS protection | waf | deployed against asset scrapers; "bandwidth consumption dropped overnight" (secondary source) |
| 4 | Load Balancer | Fronts the backend service fleet; ALB terminates client WebSocket connections | Amazon Elastic Load Balancer / Application Load Balancer | load-balancer | ALB used only for the client-facing hop; gateway-to-backend hops bypass it |
| 5 | Media service | Resource-oriented microservice owning media metadata: id, owning user, library membership, external source, status, title/artist/keywords/colour, file reference and storage location | in-house (JVM) | app-server | read-dominated: "serves many more reads than writes, and most media are rarely modified after they're created. Most media reads are of media that were created recently" |
| 6 | MySQL RDS primary (`media.primary`) | Original metadata store, then shard 0 after the split | AWS RDS MySQL 5.6 | sql-database | 16 TB EBS volume ceiling; 2 TB per table file; replication-rate ceiling on writes; online DDL unusable under traffic |
| 7 | MySQL RDS second shard (`media.primary-1`) | Shard 1 holding media IDs at or above a cut point | AWS RDS MySQL | sql-database | application-level sharding; shard key = media ID range; scatter-gather needed for list-by-owner |
| 8 | MySQL read replicas | Read scaling and ad-hoc SQL for analysts | AWS RDS MySQL replicas | sql-database | lost in the move to DynamoDB; replaced by CDC to the warehouse |
| 9 | JSON content-metadata column | Schema-managed-by-the-service blob holding the most frequently changed metadata, to avoid MySQL DDL | MySQL JSON column | sql-database | "with its own schema managed by the media service itself"; accompanied by denormalisation, removal of repeated S3 bucket names and removal of foreign keys |
| 10 | DynamoDB media table | Target metadata store, keyed for lookup by media ID | Amazon DynamoDB | nosql-database | autoscaled; costs less than the RDS clusters replaced |
| 11 | DynamoDB composite GSIs | Secondary access paths (for example list by owner) built by concatenating attributes | Amazon DynamoDB GSI | nosql-database | "composite global secondary indexes ... still need to be created manually by concatenating attributes together" |
| 12 | High-priority SQS queue | Carries create and update notifications for live replication | AWS SQS | queue | payload-free notifications: "without containing the content of the update" |
| 13 | Low-priority SQS queue | Carries read notifications and the backfill scan output | AWS SQS | queue | lazily migrates data on first read; backfill drains behind live traffic |
| 14 | Replication worker instances | Consume SQS, read current state from the MySQL primary, write DynamoDB if it differs | in-house | worker | idempotent by construction (always re-reads current state) |
| 15 | Backfill scanner | Walks all media newest-first and enqueues them on the low-priority queue | in-house | worker | "scanned through all media, beginning with the most recently created" |
| 16 | Dual-read comparator | Reads both stores on live traffic and compares results to prove the replication | in-house (inside the media service) | app-server | "compared results from MySQL with the new DynamoDB media service implementation" |
| 17 | Feature flag system | Switches reads between MySQL and DynamoDB during cutover | in-house flag system | feature-flag-service | "allow us to switch reads back to MySQL within seconds if required" |
| 18 | S3 media buckets | The media bytes themselves: user uploads, designs, stock library | Amazon S3 | object-store | 230+ PB, 300B+ objects, largest bucket 45 PB; storage location referenced from media metadata |
| 19 | S3 Standard tier | Hot tier for the curated library and freshly uploaded media | Amazon S3 Standard | object-store | 75M+ stock photos and graphics; retrieval "falls drastically after the first 15 days" |
| 20 | S3 Standard-IA / Glacier Instant Retrieval tiers | Cold tiers for aged user-generated media, reached by lifecycle rules | S3 Standard-IA, S3 Glacier Instant Retrieval, S3 Glacier Flexible Retrieval (logs/backups) | object-store | 30-day lifecycle to Standard-IA; 128 KB minimum billable object size; migration applied only to buckets with 400 KB+ average object size |
| 21 | Compute Service | Isolated CPU-bound service: SHA1-signs temporary URLs referencing private media, and BCrypt-hashes passwords | in-house on EC2 c4.large | app-server | own autoscaling group "separate from the five other autoscaling groups"; 2-4 instances; behind its own ELB; synchronous (not queueable) |
| 22 | Content matching index | Multi-index perceptual-hash index over uploaded and library images | Amazon DynamoDB | nosql-database | partition key = `part_<n>_<hash segment>`, sort key = image ID; 10B+ hashes; ~10k RCU; one query per hash segment then Hamming-distance filter |
| 23 | pHash computation | Computes the perceptual hash of an image so it can be indexed or queried | pHash algorithm | worker | Hamming distance as the similarity measure |
| 24 | WebSocket Gateway | Terminates client connections and multiplexes RSocket channels to backend services so media/design changes stream live | in-house, RSocket over WebSocket | realtime-gateway | per-channel reactive-streams backpressure; service registry + least-loaded routing to backends; graceful draining on EventBridge deregistration; autoscale on open connection count then CPU |
| 25 | Event collection endpoint + stream | Validates Protobuf-schema'd product events and ships them to consumers | AWS Kinesis Data Streams (with SQS fallback), Snowpipe Streaming | stream | at-least-once; zstd batches at 10x; SQS fallback "whenever we were throttled by a KDS shard" |
| 26 | Data warehouse | Analytical copy of media metadata, events and usage; source for content usage counts | Snowflake | data-warehouse | fed by CDC from DynamoDB and by Snowpipe Streaming; DBT transforms materialised as SQL views |
| 27 | CDC replication to warehouse | Replaces the ad-hoc SQL that MySQL read replicas used to allow | not named | change-data-capture | "we now use CDC to our data warehouse" |
| 28 | Usage-count export worker | Periodically queries Snowflake and unloads aggregates through S3 + SQS into a low-latency serving database | in-house scheduled worker | worker | "choses S3 as an intermediary storage, integrated with SQS for its durability"; end-to-end latency day -> under 1 hour |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| client | cloudflare-edge | https | sync | | CDN, Workers L7 logic, WAF and bot filtering on the way in |
| cloudflare-edge | load-balancer | https | sync | | origin |
| load-balancer | media-service | http/rpc | sync | | resource-oriented microservice |
| media-service | s3-media-buckets | https (S3 API) | sync | | metadata row holds the "file references and storage location" |
| canva-backend | third-party asset URL | https | sync | | Apps SDK upload: "the asset is downloaded via Canva's backend" from the app-supplied public URL |
| media-service | mysql-primary | sql | sync | | pre-migration path; also the read source for replication workers |
| mysql-primary | mysql-replicas | mysql replication | async | | replication rate was the write ceiling |
| media-service | mysql-primary-1 | sql | sync | | second shard, media ID >= cut point; scatter-gather for owner listings |
| media-service | sqs-high-priority | sqs | async | at-least-once | one payload-free message per create/update |
| media-service | sqs-low-priority | sqs | async | at-least-once | one payload-free message per read (lazy migration) |
| backfill-scanner | sqs-low-priority | sqs | async | at-least-once | newest-first full scan, backpressured behind live traffic |
| sqs-high-priority | replication-worker | sqs | async | at-least-once | |
| sqs-low-priority | replication-worker | sqs | async | at-least-once | |
| replication-worker | mysql-primary | sql | sync | | reads current state, not the message payload — makes retries idempotent |
| replication-worker | dynamodb-media | dynamodb | sync | | writes "if necessary" (no-op when already current) |
| media-service | dynamodb-media | dynamodb | sync | | post-cutover primary read/write path |
| media-service | dynamodb-gsi | dynamodb query | sync | | composite keys assembled by concatenating attributes |
| media-service (dual read) | mysql + dynamodb | sql + dynamodb | sync | | comparison in production traffic during migration |
| media-service | feature-flag-service | rpc | sync | | selects the read store; revert in seconds |
| media-service | compute-service-elb | http/rpc | sync | | cannot be made async: signing and hashing are on the request path |
| compute-service | media signed URL consumer (client) | https | sync | | SHA1-signed temporary URLs for private media |
| client | s3/cdn via signed URL | https | sync | | private media fetched only with a valid signature |
| s3-standard | s3-standard-ia | lifecycle transition | async | | at 30 days |
| s3-standard-ia | s3-glacier-instant-retrieval | lifecycle transition | async | | one-off 80B objects in ~2 days; only buckets averaging 400 KB+ |
| media upload path | phash-worker | internal | async | | hash computed for indexing |
| phash-worker | content-matching-index | dynamodb | sync | | one write per hash segment |
| media-service / search caller | content-matching-index | dynamodb query | sync | | one query per hash segment, fan-out then Hamming filter |
| client | websocket-gateway | WebSocket / RSocket | async | | multiple channels multiplexed in one connection |
| websocket-gateway | backend JVM services | RSocket over TCP/HTTP2 | async | | direct connections via service registry, least-loaded, bypassing the ALB |
| backend services | websocket-gateway | RSocket channel | async | | per-channel backpressure: "The server has to continue requesting messages for the clients to continue producing them." |
| client | event-collection-endpoint | https (Protobuf) | sync | at-least-once on 200 OK | schema validated before acceptance |
| event-collection-endpoint | kinesis-data-streams | KDS | async | at-least-once | zstd batches, 10x |
| event-collection-endpoint | sqs-fallback | sqs | async | at-least-once | used on KDS shard throttling or slow responses |
| kinesis-data-streams | ingest-worker | KDS | async | at-least-once | consumer-side dedup |
| ingest-worker | snowflake | Snowpipe Streaming | async | at-least-once | |
| dynamodb-media | snowflake | CDC replication pipeline | async | | replaces ad-hoc SQL on MySQL replicas |
| snowflake | usage-count-export-worker | sql | sync | | scheduled query |
| usage-count-export-worker | s3 + sqs | https + sqs | async | at-least-once | S3 as intermediary, SQS for durability |
| s3 + sqs | serving database | internal | async | | OLAP results unloaded to a low-latency serving store |

## Failure modes, incidents, tradeoffs the source discusses
- Relational ceiling reached from several directions at once: "Hard limits on MySQL 5.6 replication rate imposed a ceiling on the rate of writes", they were "approaching the limits of RDS MySQL's EBS volume size at the time (16TB)", and "MySQL table files were limited to 2TB". (from-zero-to-50-million-uploads)
- Schema change became the release bottleneck: "schema change operations on our largest media tables began to take days" and "schema migrations eventually took up to six weeks, blocking feature releases"; gh-ost was in use but "MySQL's online DDL operations caused performance degradation so severe that we couldn't perform them while also serving user traffic". The JSON metadata column was the workaround: put the volatile part of the schema under the service's own control so DDL is no longer needed. (from-zero-to-50-million-uploads)
- Scaling the disk made tail latency worse, not better: "each increase in our EBS volume size resulted in a small increase in I/O latency, which greatly impacted our tail latencies". (from-zero-to-50-million-uploads)
- Application-level sharding bought time but broke the non-ID access patterns: the ID-range split was "optimized for lookups by ID" but forced "inefficient scatter gather queries for less common requests, like listing all media owned by a user". (from-zero-to-50-million-uploads)
- Migration strategy as a risk control: replicate lazily and message-driven rather than with a bulk copy, carry no payload in the message so the worker always re-reads the primary (retries and out-of-order delivery become harmless), separate create/update from read traffic onto two priority queues, backfill newest-first because "Most media reads are of media that were created recently", verify with dual reads against production data, and keep a flag that "allow[s] us to switch reads back to MySQL within seconds if required". Stated lessons: "Be lazy", "Do it live", "Test in production". Result: "seamless, with no downtime or errors". (from-zero-to-50-million-uploads)
- What was given up by leaving SQL: "schema changes and backfills now require writing and rigorously testing parallel scan migration code", ad-hoc SQL on read replicas was replaced by CDC to the warehouse, and composite GSIs have to be hand-built by concatenating attributes. Accepted because "the structure of core media metadata is relatively stable and new access patterns are rare". (from-zero-to-50-million-uploads)
- Retrospective on the choice itself: "If we were facing the same problem today, we'd once again strongly consider mature hosted 'NewSQL' products such as Spanner or CockroachDB." (from-zero-to-50-million-uploads)
- Content-matching production incident: low-complexity images produced "uniform hashes for non-complex images like single-colored shape vectors", so "Many vectors in our database had the same partition keys" and queries returned "100000s of vector hashes" that downstream had to filter. Fixed by cutting the partition-segment count 4x and excluding images whose hash is a single repeated character (`AAAAAAAA`), taking results "from 100000s to 10s" while "ensuring that no relevant image matches were lost". This is a hot-partition failure caused by a key derived from content. (reverse-image-search)
- CPU-bound work colocated with request serving: before the Compute Service, "we had no ability to deploy and scale infrastructure focussed on this very particular type of high CPU load". Splitting it out halved folder-request latency ("reduces latency on folder requests by approximately half"), and the explicit design requirement was graceful degradation, not availability: "we wanted the rest of our systems to remain as functional as possible, albeit degraded". Instance choice was a latency/utilisation tradeoff — t2.micro cores are "around four times slower" per single hashing operation, so bigger instances won even at coarser scaling granularity.
- Storage cost as a failure of defaults: keeping everything in S3 Standard-IA ignored that user content is opened in a short window — "rates of retrieval" "falls drastically after the first 15 days". The counter-tradeoff is that small objects lose: Standard-IA and Glacier IR objects are "always billed as though they are 128 KB", so objects under roughly 20 KB are cheaper left in Standard, and the transition itself costs "$0.02 per 1,000 objects" — over $6 million to move the whole 300-billion-object inventory. Canva moved only the buckets averaging 400 KB+, spending "$1.6 million to transition roughly 80 billion objects" in "approximately two days" to save "$300,000 per month". (optimising-s3-savings; AWS Storage Blog)
- Storage Class Analysis contradicted the volume split: "roughly 10% of the total data was stored in S3 Standard, while 90% was stored in S3 Standard-IA", yet "60-70% of all accessed data came from S3 Standard" — the small hot tier carries most of the traffic. (AWS Storage Blog)
- Streaming transport under load: long-lived connections defeat both round-robin load balancing and normal deploys. Canva routes gateway-to-backend connections through a service registry with a least-loaded policy rather than an ALB, and drains on EventBridge deregistration events because "The application itself needs to gradually close the connections when it is being deregistered", otherwise redeploys spike latency. Per-channel backpressure is what stops an unavailable backend cascading. (rsocket)
- Ingest pipeline degradation path: the event collector falls back to SQS "whenever we were throttled by a KDS shard or whenever we spend too much time waiting for a KDS response", trading ordering for acceptance; dedup is pushed to consumers because the guarantee is at-least-once. Moving from SQS/SNS to Kinesis "reduced the costs by 85%" and zstd batching saved "$600K/year". (product-analytics-event-collection)
- Counting correctness incidents: over-counting (a new event type wrongly included), under-counting (a new event type not aggregated) and misclassification. The mitigation is architectural rather than procedural — make the pipeline rerunnable end to end so "we can fix most of them by rerunning the pipeline end-to-end, without humans logging into the database". The cost of that design is a second deployment surface: the DBT transform is "a standalone service separate from our main services" with a "separate release schedule" and "separate CI/CD pipeline", and "extra effort to obtain observability of these parts because of the different toolings used". (scaling-to-count-billions)

## Unknowns
- The image/video processing pipeline itself (thumbnail and preview generation, transcoding, format conversion) is not described in any first-party post found. The Apps SDK docs show that the *caller* supplies a thumbnail URL and that "the asset is downloaded via Canva's backend", but Canva's own derivative-generation service is not documented.
- The CDN in front of media is not named in any Canva-authored source. The Cloudflare relationship is documented only by the vendor, and whether user media specifically (as opposed to app traffic and stock content) is served through Cloudflare, CloudFront, or both, is not stated first-party.
- DynamoDB media table key schema: the posts describe the migration and say GSIs are composite, but never print the partition key, sort key or the exact GSI definitions.
- The MySQL shard cut point, number of shards at cutover, and how the two-shard split was resolved during the DynamoDB migration.
- Region topology: no region names, no statement of whether media metadata or media bytes are multi-region, and no cross-region replication story for S3 media.
- Where the pHash content-matching index sits in the upload path — whether hashing is synchronous on upload or a downstream job — is not stated.
- Media deletion and the "pending deletion" lifecycle: how trashed media is reaped from S3, and whether Glacier IR tiering interacts with deletion.
- **Brief items that could not be verified and are deliberately absent**: there is no Canva post about scaling Postgres (their relational story is RDS MySQL, not Postgres); there is no Canva post about Java microservices on Kubernetes with gRPC (their posts describe JVM services on EC2 autoscaling groups behind ELB/ALB, using RSocket rather than gRPC for streaming); no AWS re:Invent session by Canva engineers could be fetched as a first-party artefact, so nothing in this card rests on one.

## Candidates
- New kinds: none. Sightings: object-store (S3 as a tiered store, not just a bucket), nosql-database (DynamoDB in three distinct roles — primary entity store, composite-GSI index, content-derived hash index), queue (SQS used as a *priority-split* replication bus), worker (replication, backfill, export), feature-flag-service (as a migration cutover control), change-data-capture (DynamoDB to warehouse), realtime-gateway (RSocket multiplexing), data-warehouse, stream, cdn, waf, app-server (Compute Service as a CPU-isolation sidecar service)
- New properties on existing kinds:
  - `object-store.storageClasses` (list) and `object-store.lifecycleTransitions` (list of `{fromClass, toClass, afterDays}`) — Canva's whole cost story is a lifecycle policy
  - `object-store.minimumBillableObjectBytes` and `object-store.averageObjectBytes` — the 128 KB floor and the 400 KB threshold are what make tiering pay or not
  - `queue.priority` (high | low) — two queues of the same kind differentiated only by priority is a reusable migration pattern
  - `queue.payloadless` (boolean) — notification-only messages whose consumer re-reads the source; this is what makes the replication idempotent
  - `nosql-database.secondaryIndexes` with `composite: true` and `keyConcatenation` (list of attributes)
  - `nosql-database.partitionKeySource` (attribute | content-hash) — content-derived partition keys are the hot-partition risk this card documents
  - `sql-database.schemaEscapeHatch` (none | json-column) and `sql-database.maxTableBytes` / `maxVolumeBytes`
  - `sql-database.shardingStrategy` (range | hash) with `shardKey` — Canva's is an ID range split
  - `app-server.cpuIsolated` (boolean) and `app-server.degradedModeAvailable` (boolean)
  - `realtime-gateway.routing` (load-balancer | service-registry-least-loaded), `backpressure` (per-channel | none), `drainOnDeregistration` (boolean)
  - `stream.fallbackTarget` (component id) — the KDS-to-SQS degradation path
  - migration-flavoured properties on any data store: `migrationSource`, `dualRead` (boolean), `cutoverControl` (feature-flag | deploy)
- New requirement paths:
  - `migration.zeroDowntime` (boolean) and `migration.revertSeconds` (integer)
  - `cost.storageTiering` (boolean); `cost.objectSizeFloorBytes`
  - `durability.rerunnablePipeline` (boolean) — the counting system's stated recovery mechanism
- New rules (name + one-line condition):
  - `store-migration-without-dual-read`: a component declares `migrationSource` and there is no dual-read/comparison path between old and new store before cutover
  - `store-migration-without-revert-flag`: `migration.zeroDowntime` true but no feature-flag-service edge controlling the read path
  - `payload-carrying-replication-queue`: a replication queue between two stores carries the update body instead of a notification, so retries and reordering are not idempotent
  - `single-queue-for-live-and-backfill`: backfill traffic and live change traffic share one queue, so a backfill starves live replication (Canva split them high/low priority)
  - `content-derived-partition-key-without-skew-guard`: nosql-database with `partitionKeySource: content-hash` and no exclusion or segment-count guard against degenerate inputs
  - `sharded-sql-without-non-key-access-path`: sql-database with `shardingStrategy` set where an edge describes a query on a non-shard-key attribute (scatter-gather)
  - `cold-tier-transition-below-billing-floor`: `object-store.lifecycleTransitions` set where `averageObjectBytes` is below `minimumBillableObjectBytes` (tiering costs more than it saves)
  - `hot-content-in-cold-tier`: object-store with no lifecycle transition where retention is long and access is documented as recency-skewed
  - `cpu-bound-work-on-request-serving-fleet`: synchronous CPU-heavy operation (hashing, signing) on an app-server that also serves general traffic and is not `cpuIsolated`
  - `long-lived-connections-behind-round-robin-lb`: realtime-gateway with `routing: load-balancer` and no least-loaded/registry routing for the backend hop
  - `realtime-gateway-without-drain`: realtime-gateway with `drainOnDeregistration` false or unset
  - `at-least-once-stream-without-consumer-dedup`: stream declares at-least-once and no consumer declares deduplication
  - `stream-fallback-loses-ordering`: `stream.fallbackTarget` set to a queue while the pipeline declares an ordering requirement

## Verification 2026-09-14

Spot check of the two primary sources the design leans on most. Both reachable, both confirm
every fact this design encodes.

| URL | Reachable | Outcome |
|---|---|---|
| https://www.canva.dev/blog/engineering/from-zero-to-50-million-uploads-per-day-scaling-media-at-canva/ | yes | Confirmed verbatim: "Canva users upload 50 million new media every day"; "more than 25 billion user-uploaded media"; "approaching the limits of RDS MySQL's EBS volume size at the time (16TB)"; "MySQL table files were limited to 2TB"; the JSON content-metadata column; "Media IDs less than x goes to the media.primary database, while media IDs greater than or equal to x goes to media.primary-1"; payload-free SQS notifications "without containing the content"; "a worker instance would process these messages to read the current state from the MySQL primary"; "scanned through all media, beginning with the most recently created"; "we implemented a dual read and comparison process"; "use our flag system to allow us to switch reads back to MySQL within seconds if required"; composite GSIs and CDC to the data warehouse. |
| https://www.canva.dev/blog/engineering/optimising-s3-savings/ | yes | Confirmed verbatim: "more than 230 Petabytes of data in Amazon S3"; "our single largest S3 bucket coming in at a whopping 45 Petabytes"; "over 300 billion objects"; lifecycle "from S3 Standard into S3 Standard-IA after 30 days"; "the rate of retrieval also falls drastically after the first 15 days"; "nearly 80 billion objects in approximately two days" at "over $1.6 million"; "roughly $300,000 per month"; the 128 KB minimum billable size; "buckets with an average object size of 400 KB or more first". |

Facts stated in the card that this design could not confirm and therefore does not encode: none.
The remaining seven sources were not re-fetched in this pass; every fact drawn from them
(Compute Service instance count and ELB, pHash index key shape and 2000 qps peak, the Cloudflare
edge relationship) is carried into `notes.md` with its confidence marked.
