# Intake: Linear real-time sync engine and backend

## Source
- Primary: https://linear.app/now/rebuilding-delta-sync-read-path (Peter Travers, Linear engineer, Linear engineering blog, Aug 18 2026) — the delta-sync read path rebuild: sync actions as an application-level log, permission-aware set intersection, why the Postgres read path hit tail-latency limits, the turbopuffer inverted index, CDC replication, two-stage metadata-scan + late-enrichment pipeline
- Primary: https://linear.app/now/how-we-built-multi-region-support-for-linear (Linear engineering blog, May 23 2024) — Cloudflare Workers proxy, global authentication service, full per-region replication of the production deployment instead of sharding, Google Pub/Sub, GraphQL service-to-service, Terraform, feature-flagged rollout
- Primary: https://linear.app/now/scaling-the-linear-sync-engine (Tuomas Artman, co-founder/CTO, Linear, Jun 29 2023) — talk landing page; abstract only fetched, video body not extractable
- Primary (vendor blog carrying named first-party quotes): https://cloud.google.com/blog/products/databases/product-workflow-tool-linear-uses-google-cloud-databases (Tom Moor, Head of US Engineering at Linear, quoted; Google Cloud blog) — the named product list: Cloud SQL for PostgreSQL, Memorystore for Redis, Kubernetes workloads, pgvector, Node.js/TypeScript
- Primary (official docs): https://linear.app/developers — public GraphQL API, OAuth 2.0 and personal API keys, webhooks, TypeScript SDK
- Primary (interview with Linear's CTO): https://www.localfirst.fm/15 and https://www.localfirst.fm/15/transcript — conceptual sync-engine motivation only; no Linear-specific internals
- Primary (talks, not fetchable): https://www.youtube.com/watch?v=VLgmjzERT08 (Tuomas Artman, "Unexpected benefits of going local-first", Local-First Conf 2024); https://www.youtube.com/watch?v=bnOpm3a1fRE (Artman, sync engine talk)
- Secondary: https://github.com/wzhudev/reverse-linear-sync-engine (reverse-engineering series; Linear's CTO called it "documentation that is correct and more complete than what Linear publishes internally") — used **only** for client-side internals, every such row marked "(RE)"
- Secondary: https://www.fujimon.com/blog/linear-sync-engine (corroborates object graph + MobX + IndexedDB + WebSocket, last-writer-wins)
- Verified by: two Linear engineering blog posts fetched in full, plus a Google Cloud case study quoting Linear's Head of US Engineering by name, plus official developer docs; reverse-engineering write-ups as clearly-marked secondary
- Confidence: high for the server-side read path, the multi-region topology and the named products; medium for the client sync-engine internals (documented only through the CTO-endorsed reverse-engineering series and the unfetchable talks)
- Date of source: 2023 (talk), 2024 (multi-region, Local-First Conf), 2024 (Google Cloud case study), 2026 (delta sync read path)
- Verification log: `work/research/linear-sync/verify.md`

## System in three lines
Linear is an issue tracker whose entire UI reads from a local object graph in the browser, never from a request-response API — the client holds a permission-scoped subset of the workspace database in memory and IndexedDB, and the server streams an ordered delta of "sync actions" over a WebSocket to keep it current. Writes go out as optimistic transactions over GraphQL and are confirmed when the matching delta packet returns. It is hard because catch-up after an offline period must intersect a monotonically growing per-workspace action log with the reader's permissions and subscriptions, and must not get slower as a workspace grows past a million sync actions a day.

## Scale (only if stated)
- Data volume: "more than 20 TB of sync actions" across all workspaces (https://linear.app/now/rebuilding-delta-sync-read-path)
- Message throughput: "close to 1 million sync actions per day" in the largest workspaces (same)
- Catch-up burst: a client offline for hours can be "hundreds of thousands of sync actions behind" (same)
- Database size: scaled "into tens of terabytes of data" on Cloud SQL for PostgreSQL (Tom Moor, https://cloud.google.com/blog/products/databases/product-workflow-tool-linear-uses-google-cloud-databases)
- Partitioning for a migration: the issues table was partitioned into **300 segments** so each partition could be vector-indexed (same)
- Replication latency to the read-path index: ~1 s at p50, a few seconds at p95 (delta-sync post)
- Team: no dedicated operations team; managed services chosen to avoid one (GCP case study)
- Users / DAU: not stated
- Requests per second: not stated

## Requirements stated or clearly implied
- Availability target: multiple GCP regions (us-east1 original, plus a European region); each region is a **full replica of the production deployment**, fully segregated, so a region loss does not propagate
- Consistency: single source of truth is the server database; the client is "a subset of the server database". Ordering is the consistency mechanism — sync actions form an immutable, ordered, workspace-specific log and each carries a monotonically increasing sync id. Conflict resolution is last-writer-wins with client-side transaction rebasing (RE), not CRDT
- Latency target: no numbers, but the explicit goal is **flat tail latency for reconnect**: "A workspace generating close to one million sync actions per day should not make reconnecting progressively slower as it grows." p95/p99 stayed "largely flat" across workspace sizes after the turbopuffer migration
- Ordering needs: total order per workspace over the sync action log; the client resumes from a checkpoint sync id
- Replay or reprocessing needs: yes, and it is the core read path — every reconnect replays the log from the client's checkpoint forward
- Retention: the sync action log is retained historically (20 TB); no TTL stated
- Compliance / residency: GDPR named as one of the two reasons for multi-region; region is chosen at workspace creation, defaulted from the user's system timezone

## Boundaries
- Regions / zones: Google Cloud; us-east1 as the original/primary region, a European region added; every region runs the whole deployment (Postgres, Redis, WebSocket servers, GraphQL APIs, task runners). Not stated: AZ layout
- Trust zones: untrusted clients -> Cloudflare Workers edge proxy -> global authentication service (JWT issuance) -> regional backend (pre-signed header) -> regional data stores. Public GraphQL API and public sync WebSocket servers are separate deployments from the private/internal ones
- Named subsystems: sync engine (client object graph, bootstrap, delta packets, transactions), sync action log, sync groups and sync subscriptions, CDC pipeline, delta-sync read path (metadata scan + late enrichment), global authentication service, region proxy, task runners, Linear Agent / Triage Intelligence (AI features on pgvector)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Linear client (web/desktop) | Renders entirely from an in-memory normalized object graph; never request-response per screen | in-house, Node.js/TypeScript stack; MobX observability (RE) | client | localFirst: true; objectGraph: normalized; 80+ decorated model classes (RE) |
| 2 | IndexedDB workspace database | Per-workspace local persistence of models plus `_meta` and `_transaction` tables so unsent writes survive a crash | browser IndexedDB (RE) | cache (local store) / `local-database` (new) | databases: `linear_databases`, `linear_<hash>`; stores lastSyncId, firstSyncId, subscribedSyncGroups (RE) |
| 3 | Cloudflare Worker region proxy | Extracts auth info from the request, calls the auth service for a signed JWT plus the target region, forwards to that region with a pre-signed header | Cloudflare Workers | api-gateway | caches signatures at the edge; passes through unmodified `fetch` for the efficient code path (WebSocket-critical) |
| 4 | Global authentication service | Single global store of users, workspaces and the region each workspace lives in; issues signed JWTs | in-house | identity-provider | global (not per-region); "only responds to HTTP requests – it has no background task runner of its own" |
| 5 | Public sync WebSocket servers | Deliver delta packets to external/customer-facing connections | in-house, on Kubernetes | realtime-gateway | scales independently of the other workloads |
| 6 | Private sync WebSocket servers | Deliver delta packets to Linear's own first-party clients | in-house, on Kubernetes | realtime-gateway | scales independently |
| 7 | Public GraphQL API | Customer-facing API: mutations, queries, OAuth 2.0 and personal API keys, rate limiting, pagination, filtering | in-house GraphQL (Node.js/TypeScript) | api-gateway | documented at linear.app/developers |
| 8 | Private GraphQL API | Internal/first-party API surface, including service-to-service calls | in-house GraphQL; Zeus for type-safe clients | app-server | "It isn't ideal for service to service communication, but we already had strong tooling for GraphQL in our codebase" |
| 9 | Task runners | Background jobs; the authentication service deliberately has none | in-house, on Kubernetes | worker | third independently-scaled Kubernetes workload |
| 10 | Kubernetes cluster | Runs the three workload classes (sync WebSocket servers, GraphQL APIs, task runners) | Google Kubernetes Engine | container-orchestrator | three workload classes scale independently |
| 11 | Primary Postgres | Workspace transactional data; also the authoritative head of the sync action log; also holds vectors | Cloud SQL for PostgreSQL, with pgvector | sql-database | tens of TB; issues table partitioned into 300 segments for the vector-index migration; logical replication enabled |
| 12 | Sync action log (table in Postgres) | Immutable, ordered, workspace-scoped application-level log of every change; the unit the client catches up on | in-house table above the Postgres WAL | event-store | immutable; ordered; per-workspace; >20 TB total; payloads are JSON |
| 13 | Postgres read replicas | Were used to spread read load on the old catch-up path | Cloud SQL replicas | sql-database | "read replicas could not reduce the intersection work per request"; replica lag delayed catch-up |
| 14 | CDC pipeline | Reads committed sync actions off Postgres logical replication and writes their metadata to the index | in-house | change-data-capture | source: Postgres logical replication; lag ~1 s p50, few seconds p95 |
| 15 | turbopuffer inverted index | Serves the metadata scan: posting lists per sync group and per sync subscription, intersected with the client's id range | turbopuffer | search-index | posting lists; set intersection; serves the historical range behind the log head |
| 16 | Sync groups | Encode access control; each sync group maps to a posting list of the sync actions routable to it | in-house | policy-engine (concept, not a deployed box) | client stores `subscribedSyncGroups` / `userSyncGroups`; `/sync/user_sync_groups` endpoint (RE) |
| 17 | Sync subscriptions | Per-user model/view filters; each has its own posting list | in-house | policy-engine (concept) | unioned with sync groups, then intersected with the id range |
| 18 | Delta-sync read service (two-stage) | Stage 1 metadata scan over turbopuffer, dedup and filter; stage 2 late enrichment fetches full payloads from Postgres only for approved actions; streams ordered delta to the client | in-house | app-server | ranges of Postgres (head) and turbopuffer (tail) intentionally overlap and results are deduplicated; falls back to Postgres if turbopuffer is unavailable |
| 19 | Redis | Event bus between backend instances and cache | Memorystore for Redis | pubsub-topic (event bus) + cache | named as both "event bus and cache" |
| 20 | Google Pub/Sub | One-to-many background task distribution across the multi-region deployment | Google Cloud Pub/Sub | pubsub-topic | pattern: one-to-many |
| 21 | pgvector similarity search | Embeds issues and finds duplicates/similar issues at creation time and from support tools | pgvector inside Cloud SQL; OpenAI ada embeddings | vector-database | migration done via a follower replica; 300-way partitioning to index |
| 22 | Embedding provider | Encodes the semantic meaning of issues | OpenAI ada embeddings | ai-service / third-party-api | external dependency |
| 23 | Webhooks | Push workspace events to customer endpoints | in-house | webhook-endpoint | documented at linear.app/developers |
| 24 | Terraform | Infrastructure as code; the "terraforming" phase was step one of multi-region | Terraform | ops tooling, not an architecture node | used to stand up a second identical region |
| 25 | Bootstrap endpoints | `/sync/bootstrap?type=full&onlyModels=…` streams the initial model set; `/sync/batch` hydrates lazy models by indexed key; `/sync/user_sync_groups` pre-fetches access scope | in-house HTTP over the GraphQL service (RE) | app-server | bootstrap types: full, partial, local; load strategies instant/lazy/partial/explicitlyRequested (RE) |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| client | cloudflare-worker-proxy | https / wss | sync | | every request and the sync socket go through the edge worker |
| cloudflare-worker-proxy | global-auth-service | https | sync | | returns signed JWT + target region; signatures cached at the edge |
| cloudflare-worker-proxy | regional public graphql api | https | sync | | forwarded with a pre-signed header |
| cloudflare-worker-proxy | regional public sync websocket server | wss | async (long-lived) | | unmodified `fetch` pass-through for the efficient Workers code path |
| client | bootstrap endpoint | https (streamed JSON) | sync | | `/sync/bootstrap` full or partial; response carries lastSyncId, subscribedSyncGroups, databaseVersion (RE) |
| client | /sync/batch | https | sync | | batched lazy hydration by indexed key (RE) |
| client | public graphql api | https (GraphQL mutation) | sync | at-least-once via client retry from `_transaction` | transactions are persisted locally before send and batched by `batchIndex` (RE) |
| public graphql api | primary postgres | sql | sync | | mutation plus the sync actions it generates commit in one transaction |
| primary postgres | cdc-pipeline | postgres logical replication | async | ordered, at-least-once | ~1 s p50, few seconds p95 |
| cdc-pipeline | turbopuffer | https | async | | writes sync action **metadata** only, not payloads |
| public graphql api | redis | redis pubsub | async | | Redis is the event bus between backend instances |
| redis | sync websocket servers | redis pubsub | async | | fan-out of new sync actions to every connected client, including clients other than the mutator |
| sync websocket server | client | wss (delta packet) | async | ordered by sync id | packet carries action type I/U/A/D/C/G/S/V plus the full model data (RE) |
| client | delta-sync read service | wss / https, checkpoint sync id | sync | | reconnect / catch-up path |
| delta-sync read service | turbopuffer | https | sync | | stage 1: posting-list union (sync groups ∪ subscriptions) intersected with the id range |
| delta-sync read service | primary postgres | sql | sync | | stage 2: late enrichment — fetch payloads only for actions about to be sent; also serves the authoritative head of the log |
| delta-sync read service | primary postgres | sql | sync | | fallback path when turbopuffer is unavailable |
| task runners | google pub/sub | pubsub | async | one-to-many | background task distribution across regions |
| regional backend | global-auth-service | https (GraphQL, Zeus client) | async | | shared-record updates scheduled through the existing sync engine; originally Postgres triggers, later explicit API calls |
| global-auth-service | regional postgres | record id hand-off | sync | | shared records are created in the auth service first, its returned id is used regionally |
| public graphql api | customer webhook endpoint | https | async | | workspace event delivery |
| app | openai ada embeddings | https | async | | issue embeddings for similarity search |
| client | indexeddb | local | sync | durable | models, `_meta`, `_transaction`; unsent transactions survive a crash (RE) |

## Failure modes, incidents, tradeoffs the source discusses
- **The Postgres-only catch-up path stopped scaling with workspace size.** "Tail latency became increasingly volatile, even when median latency remained healthy." The cause: "each request combined widening ID range with array-overlap predicates for access and subscriptions, and Postgres spent a growing amount of CPU testing and discarding irrelevant rows." (https://linear.app/now/rebuilding-delta-sync-read-path)
- **Read replicas did not help.** They spread load but "could not reduce the intersection work per request", and database maintenance plus replica lag actively delayed client catch-up. Adding more filter dimensions made the query more expensive, not less. (same)
- **Correctness gate before any cutover.** "A faster query is only useful if it returns exactly the sync actions the client is supposed to receive" — the new path ran in shadow mode against the old one before taking production traffic. (same)
- **Late enrichment as the core optimisation.** Decoding large JSON payloads for rows that later get filtered out was the waste; the pipeline now carries compact metadata and enriches "only the sync actions that are about to leave for the client". (same)
- **The index is assumed to be behind.** "Postgres serves a small, authoritative slice at the head of the sync action log, while turbopuffer serves the larger historical range behind it. The two ranges intentionally overlap, and the server deduplicates the combined result." Replication lag is designed around, not designed out. (same)
- **Full replication chosen over sharding.** "Instead of sharding the database, we chose to replicate the entire Linear production deployment. This simplifies development as we can continue executing operations against a single database instance within one deployment." Cost: a workspace lives in exactly one region, chosen at creation. (https://linear.app/now/how-we-built-multi-region-support-for-linear)
- **GraphQL for service-to-service was a deliberate compromise.** "It isn't ideal for service to service communication, but we already had strong tooling for GraphQL in our codebase." (same)
- **Late hard cut-overs and fallbacks kept a risky migration invisible.** "while there were of course bugs along the way, most of those were invisible to our users because we left the hard cut-overs as late as possible, making sure we had a fallback in place." Rollout was feature-flagged to Linear engineers first. (same)
- **Edge-proxy code path matters for WebSockets.** "Cloudflare Workers that return a `fetch` request without modifying the response hand off to a more efficient code path" — modifying the response would have degraded realtime sync. (same)
- **Auth service kept deliberately dumb.** It "has no background task runner of its own", which made deploying a globally-shared service tractable. (same)
- **Shared-table split needed three separate strategies** (create in auth service first and reuse the id; deletes via Postgres triggers with fallback audit logging for FK cascades; updates scheduled asynchronously through the sync engine). Triggers were a transitional mechanism, later replaced by explicit API calls. (same)
- **Vector migration hit indexing limits.** The "sheer size and volume of vectors" meant the issues table had to be partitioned into 300 segments before each partition could be indexed; the migration ran against a follower replica. Competing vector databases were rejected for "speed of indexing issues, unacceptable downtime during scaling, high costs". (https://cloud.google.com/blog/products/databases/product-workflow-tool-linear-uses-google-cloud-databases)
- **Managed services as a staffing decision.** Linear runs with no dedicated ops team; Cloud SQL "allows us to scale our database smoothly into tens of terabytes of data without requiring extensive engineering efforts" (Tom Moor). (same)
- **Conflict resolution is last-writer-wins, not CRDT** (RE + fujimon). Update transactions are rebased when a conflicting delta packet arrives: the transaction's `original` value is updated to the server state and the in-memory model reverted to the local new value, so a local change survives if the server processed it later.

## Unknowns
- Sharding/partitioning key of the sync action table beyond "workspace-specific"; whether the log is a single table or partitioned per workspace
- Whether `lastSyncId` is global across all workspaces or per workspace — the reverse-engineering write-up describes a central counter, the delta-sync post describes a workspace-specific log
- Redis topology: cluster size, whether Memorystore is HA/replicated, eviction policy, and whether it also backs presence
- WebSocket server fan-out mechanics: connections per instance, how a workspace's subscribers are located, reconnect/backpressure behaviour
- Retention or compaction of the 20 TB sync action log; whether anything is ever deleted
- turbopuffer deployment shape (namespaces per workspace?), consistency model, and its own replication
- Regional failover: whether a workspace can be moved between regions, and what happens to a region that goes down (each region is segregated, but no failover story is stated)
- Any published availability SLA, p99 numbers, RPS, or DAU
- Whether the public GraphQL API and the sync read path share the same app-server fleet
- Bootstrap/model-registry details are only documented through a CTO-endorsed third-party reverse-engineering series, not by Linear itself

## Candidates
- New kinds: `local-database` (browser IndexedDB / on-device store as a first-class node — currently forced into `cache`); `sync-engine` (a server that streams an ordered per-tenant change log to stateful clients; distinct from `realtime-gateway`, which only fans out)
- New properties on existing kinds:
  - `event-store.scopeKey` (the tenant/workspace the log is ordered within)
  - `event-store.immutable` (boolean) and `event-store.sizeBytes`
  - `search-index.role` (primary | metadata-only | fallback-backed) to express "index serves metadata, primary store serves payloads"
  - `change-data-capture.lagP50Ms` / `lagP95Ms`
  - `sql-database.partitionCount` (300 segments) and `sql-database.servesLogHead` (boolean)
  - `client.localFirst` (boolean), `client.checkpointResume` (boolean)
  - `api-gateway.edgeAuthDelegation` (boolean) for the Workers -> auth-service -> region pattern
  - `identity-provider.scope` (global | regional)
  - deployment property `replicationStrategy` (shard | full-deployment-replica) on the region/boundary
- New requirement paths:
  - `consistency.conflictResolution` (lww | crdt | ot | server-authoritative)
  - `consistency.orderingScope` (global | per-tenant | per-key | none)
  - `latency.tailFlatnessAcrossTenantSize` (boolean) — the stated goal of the read-path rebuild
  - `residency.tenantPinnedRegion` (boolean)
- New rules (name + one-line condition):
  - `index-without-primary-fallback`: a search-index on a read path with no fallback edge to the authoritative store
  - `cdc-derived-index-serving-head-of-log`: an index fed by change-data-capture serves the newest range with no overlapping authoritative read
  - `enrichment-before-filter`: a read path that fetches payloads before applying permission/subscription filters
  - `tenant-log-without-scope-key`: an event-store on a catch-up path with no scopeKey while the design is multi-tenant
  - `single-region-tenant-without-failover`: full-deployment-replica regions where a tenant is pinned and no cross-region failover edge exists
  - `read-replica-for-cpu-bound-query`: read replicas added to a path whose cost is per-request CPU rather than concurrency
  - `edge-proxy-mutating-websocket-response`: an api-gateway at the edge that rewrites responses on a realtime path
