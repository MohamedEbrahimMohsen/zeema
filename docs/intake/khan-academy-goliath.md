# Intake: Khan Academy "Goliath" — Python 2 monolith to Go services behind GraphQL federation

## Source
- Primary: https://blog.khanacademy.org/incremental-rewrites-with-graphql/ (Kevin Dangoor, Principal Software Architect, Khan Academy engineering blog, 2020) — the graphql-gateway, Apollo Federation, and the `@migrate` directive
- Primary: https://blog.khanacademy.org/go-services-one-goliath-project/ (Kevin Dangoor, Principal Software Architect, Khan Academy engineering blog, 2019) — the decision and the target architecture
- Primary: https://blog.khanacademy.org/technical-choices-behind-a-successful-rewrite-project/ (Kevin Dangoor, Khan Academy engineering blog, 2021) — gqlgen, genqlient, Apollo Federation, App Engine 1st→2nd gen, 26 services
- Primary: https://blog.khanacademy.org/beating-the-odds-khan-academys-successful-monolith%E2%86%92services-rewrite/ (Marta Kosarchyn, VP of Engineering / CTO, Khan Academy engineering blog, 2021) — timeline, MVE milestone, 95% of traffic
- Primary: https://blog.khanacademy.org/half-a-million-lines-of-go/ (Kevin Dangoor, Khan Academy engineering blog, 2021) — 500k lines of Go, Datastore contention and latency results
- Primary: https://blog.khanacademy.org/genqlient-a-truly-type-safe-go-graphql-client/ (Ben Kraft, Khan Academy engineer, Khan Academy engineering blog, 2021) — service-to-service GraphQL, 300+ cross-service requests
- Primary: https://blog.khanacademy.org/how-khan-academy-successfully-handled-2-5x-traffic-in-a-week/ (Marta Kosarchyn, VP of Engineering, Khan Academy engineering blog, 2020) — the COVID traffic surge
- Primary: https://blog.khanacademy.org/memcached-backed-content-infrastructure/ (Ben Kraft, Khan Academy engineer, Khan Academy engineering blog, 2017) — memcache-backed content store
- Primary: https://blog.khanacademy.org/evolving-our-content-infrastructure/ (Willow Chargin, Khan Academy engineer, Khan Academy engineering blog, 2016) — Frozen Model Store, publish-by-SHA
- Primary: https://blog.khanacademy.org/why-we-switched-to-airflow-for-pipeline-orchestration/ (Tom Yedwab, Khan Academy engineer, Khan Academy engineering blog, 2021) — Khanflow / Airflow on GKE, BigQuery, Dataflow
- Primary: https://blog.khanacademy.org/app-engine-flex-language-shootout/ (Amos Latteier, Khan Academy engineer, Khan Academy engineering blog, 2017) — Pub/Sub push → BigQuery exercise feed service
- Secondary: https://www.infoq.com/news/2020/05/khan-academy-scaling/ (InfoQ news, 2020, quoting Kosarchyn and Dangoor) — Fastly as first point of contact, S3-via-Fastly video fallback, GKE analytics
- Secondary: https://newsletter.pragmaticengineer.com/p/real-world-eng-8 (Pragmatic Engineer, interview with Khan Academy engineers incl. Brian Genisio) — final line counts, ~40 services, two-phase timeline, team sizing
- Verified by: official engineering blog (eleven posts by six named Khan Academy engineers), plus InfoQ and Pragmatic Engineer interviews with those same engineers
- Confidence: high
- Date of source: 2016–2023 (architecture core 2019–2021; migration completed Jan 2023)

## System in three lines
Khan Academy serves free courseware — video, articles, exercises, progress tracking, teacher assignments — to tens of millions of learners a month on Google Cloud, serverless from day one. Between 2019 and 2023 they replaced a ~1M-line Python 2 App Engine monolith with roughly 40 Go services sitting behind an Apollo-federated GraphQL gateway, without a big-bang cutover: the gateway routed each individual GraphQL *field* to Python or Go, ran both side by side, and compared the answers. Hard because the deadline was externally imposed (Python 2 EOL on 2020-01-01), the port had to be behaviour-identical while the product kept shipping, and the middle of it landed on a 2.5x COVID traffic surge.

## Scale (only if stated)
- Users: "about 18 million users each month" before COVID; "30 million learners" in April 2020 — https://blog.khanacademy.org/how-khan-academy-successfully-handled-2-5x-traffic-in-a-week/ , https://www.infoq.com/news/2020/05/khan-academy-scaling/
- Traffic surge: usage "grew by over 2.5 times almost overnight" within two weeks of March 2020, and stayed there — https://blog.khanacademy.org/how-khan-academy-successfully-handled-2-5x-traffic-in-a-week/
- Codebase: "close to 1M lines of Python code to port" (1,039,733 lines) → 1,151,473 lines of Go — https://blog.khanacademy.org/beating-the-odds-khan-academys-successful-monolith%E2%86%92services-rewrite/ , https://newsletter.pragmaticengineer.com/p/real-world-eng-8
- Services: 26 services at the time of the 2021 technical-choices post; 32 at the MVE milestone; ~40 at completion — https://blog.khanacademy.org/technical-choices-behind-a-successful-rewrite-project/ , https://newsletter.pragmaticengineer.com/p/real-world-eng-8
- Cross-service calls: "over 300 distinct GraphQL requests from one service to another" — https://blog.khanacademy.org/genqlient-a-truly-type-safe-go-graphql-client/
- Migration progress markers: "~40% of our GraphQL fields are now being served by Go services" (Nov 2020); 95% of all traffic on the services backend on 2021-08-30 — https://blog.khanacademy.org/incremental-rewrites-with-graphql/ , https://blog.khanacademy.org/beating-the-odds-khan-academys-successful-monolith%E2%86%92services-rewrite/
- Content data volume: content blob ~34 MB pickled in Datastore, ~313 MB expanded in RAM on 512 MB App Engine instances; ~14 million user scratchpads — https://blog.khanacademy.org/evolving-our-content-infrastructure/
- Datastore contention warnings in bulk operations: ~100 per hour (Python) → near zero (Go) — https://blog.khanacademy.org/half-a-million-lines-of-go/
- Latency outlier: class loading 28 s (Python) → 4 s (Go) — https://blog.khanacademy.org/half-a-million-lines-of-go/
- Requests per second: not stated
- Message throughput: not stated

## Requirements stated or clearly implied
- Availability target: no SLA published. The migration requirement was continuous availability *through* the rewrite — the monolith stayed live and authoritative until each field was proven, and Python code was retained as rollback after cutover.
- Consistency: content publishing is atomic site-wide — "the entire site is atomically updated in about a second" via the Frozen Model Store SHA. User data lives in Google Cloud Datastore; consistency model not stated beyond Datastore's own semantics.
- Latency target: not quantified. Stated concerns are CPU/memory cost per request and page-level slowdowns (the /math page regression, class loading).
- Ordering needs: not stated.
- Replay or reprocessing: analytics pipelines re-run through Airflow (Khanflow) DAGs; no replay requirement stated for the serving path.
- Retention: analytics data is made unrecoverable by deleting the per-user encryption key — https://blog.khanacademy.org/we-count-on-you-balancing-privacy-and-analytics/
- Compliance / residency: student-data privacy is the driver; per-user encryption keys so "analysts can do their work without compromising personal information". No region-pinning stated.
- Hard external deadline: Python 2 end of life, 2020-01-01, and Google App Engine dropping Python 2 support.
- Behaviour parity as an explicit requirement: "We moved the behavior over exactly. If there's a bug in the python code, we port the bug (most times.)" (Brian Genisio) — https://newsletter.pragmaticengineer.com/p/real-world-eng-8
- Operations headcount is a constraint, not just cost: serverless was chosen to "scale as our usage increased, without requiring us to scale an operations team to match" (Kevin Dangoor).

## Boundaries
- Regions / zones: not stated. Google Cloud (App Engine, Datastore, Memcache) plus Fastly's global edge; no multi-region design described.
- Trust zones: public internet → Fastly edge → App Engine front end (graphql-gateway) → internal services; analytics runs in a separate GKE cluster with per-pipeline Google service accounts, and analysts are deliberately fenced off from raw personal data by per-user encryption keys.
- Named subsystems / bounded contexts: the monolith (`webapp`); graphql-gateway; ~40 Go services (named examples in the sources: content, districts/classes, donations, users/progress — the sources do not enumerate the full list); content infrastructure (Frozen Model Store → memcache content store); the Khanflow/Airflow analytics platform; the exercise-feed Pub/Sub→BigQuery service.
- Migration phases as a boundary: "MVE" (minimum viable experience — the part of the site that absolutely had to be ported for learners to keep learning, Jun 2019 – Aug 2021) then "Endgame" (the remaining 5% of traffic and internal tools, Aug 2021 – Jan 2023).

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Browser / learner client | React single-page app and server-rendered pages; issues GraphQL queries | React | client | |
| 2 | Fastly CDN | Edge cache and "first point of contact for all requests"; caches static data so it never reaches servers | Fastly | cdn | staticCaching: true; also fronts S3 video fallback |
| 3 | React server-side rendering | Renders pages with React on the server, replacing the monolith's Jinja templating | React SSR | app-server | replaces: jinja-templating |
| 4 | graphql-gateway | Federated GraphQL entry point: "responsible for creating the query plan and making GraphQL requests to our other services, including our monolith" | Apollo Federation gateway | api-gateway | federation: apollo; queryPlanning: true; routes per field via `@migrate` |
| 5 | Python 2 monolith (`webapp`) | The legacy application; during migration it "acts like any other service in this setup", exposing a federated GraphQL subschema | in-house Python 2 on App Engine | app-server | ~1,039,733 lines; App Engine standard 1st gen; decommissioned Jan 2023 |
| 6 | Go services (~40) | The target backend; each owns part of the federated schema and its own Datastore entities | in-house Go, gqlgen GraphQL servers | app-server | count: 26 (2021) → 32 (MVE) → ~40 (final); stateless; independently deployable |
| 7 | genqlient clients | Type-safe generated Go GraphQL client used for service-to-service calls | genqlient (Khan Academy OSS) | property of app-server (client library) | codegen: compile-time schema validation; 300+ distinct cross-service requests |
| 8 | Google App Engine | Serverless runtime hosting the monolith, the gateway and the Go services; migrated 1st gen → 2nd gen | Google App Engine (standard) | property of app-server (platform: app-engine) | autoscaling: true; instanceMemory: 512 MB (legacy Python instances); "keep using App Engine for our new Go services" |
| 9 | Google Cloud Datastore | Primary operational data store for user, progress and content entities | Google Cloud Datastore | nosql-database | models ported Python → Go; contention warnings ~100/hr → ~0 after Go port |
| 10 | Google Cloud Memcache | Shared cache for "common queries, user preferences, and session data" | Google Cloud Memcache (memcached) | cache | capacity raised by Google on request during COVID; overload increases query traffic |
| 11 | Content store in memcache | Per-item content cache: "a key-value store, mapping (global content version, content ID) pairs to pickled content item objects" | memcached | cache | key: (contentVersion, contentId); batch reads via `get_many_by_key()` |
| 12 | Content manifest | Maps content item id → data hash so instances know what to (re)fetch; versioned by SHA | in-house | property of content service (config blob) | hash-based versioning avoids spurious reloads; "remains a substantial data structure" |
| 13 | Frozen Model Store (legacy) | In-process immutable snapshot of all content; publish updates a `last_published_commit` SHA and "the entire site is atomically updated in about a second" | in-house Python | cache (in-process) | 34 MB pickled in Datastore → 313 MB in RAM; per-locale `last_published_commits` |
| 14 | Content revision entities | `VideoRevision` / `ArticleRevision` rows holding unpublished edits at the "editing head" | in-house on Datastore | nosql-database | immutable revisions; publish materialises frozen models |
| 15 | YouTube | Primary video delivery for lesson videos | YouTube | third-party-api | |
| 16 | Amazon S3 (via Fastly) | Fallback video origin for regions where YouTube is blocked | Amazon S3 | object-store | served through Fastly |
| 17 | Cloud Pub/Sub exercise feed | Carries exercise-attempt events off the serving path to analytics | Google Cloud Pub/Sub | pubsub-topic | push subscription; messages HMAC-validated with secrets from instance metadata |
| 18 | Exercise-feed microservice | Validates and parses Pub/Sub messages, ensures the target table exists, inserts into BigQuery | in-house, App Engine Flex | worker | push-subscription web server; benchmarked in Kotlin/Elixir/Go/Python |
| 19 | BigQuery | Analytics warehouse behind all reporting and metrics | Google BigQuery | data-warehouse | |
| 20 | Cloud Dataflow | Managed data pipelines feeding the warehouse | Google Cloud Dataflow | stream-processor | |
| 21 | Khanflow (Airflow) | Pipeline orchestration, replacing the in-house "Khanalytics" scheduler | Apache Airflow 2.0 | workflow-engine | custom `KhanflowPipeline`, `KhanflowPythonOperator`, `KhanflowBigQueryOperator`; GitHub Actions CI/CD |
| 22 | GKE cluster | Hosts Khanflow and the analytics/data-management stack | Google Kubernetes Engine | container-orchestrator | provisioned with Terraform + Helm; per-pipeline Google service accounts |
| 23 | Per-user encryption keys table | Holds one key per user so analysts read encrypted personal data; deleting the key is the erasure mechanism | in-house | key-management | "once the user's key is removed from the keys table, there is no way to recover the user data" |
| 24 | `@migrate` directive / runtime config | Per-field migration state (manual, side-by-side, canary, migrated) plus the canary percentage, read by the gateway at runtime | in-house GraphQL directive | feature-flag-service | states: manual / side-by-side / canary / migrated; canary percentage "runtime configurable"; canary starts at 1% of users |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| browser-client | fastly-cdn | https | sync | | first point of contact for all requests |
| fastly-cdn | react-ssr | https | sync | | cache miss for dynamic pages |
| fastly-cdn | graphql-gateway | https | sync | | cache miss for GraphQL |
| browser-client | graphql-gateway | https/graphql | sync | | single typed schema for all backend data |
| react-ssr | graphql-gateway | https/graphql | sync | | page data fetch during render |
| graphql-gateway | python-monolith | https/graphql | sync | | "our monolith acts like any other service in this setup" |
| graphql-gateway | go-services | https/graphql | sync | | query plan fan-out; Apollo Federation "handling much of our fan-out" |
| graphql-gateway | python-monolith | https/graphql | sync | | side-by-side mode: call Python *and* Go, compare, return the Python result |
| graphql-gateway | go-services | https/graphql | sync | | side-by-side/canary mode: same field, Go implementation; canary sends a runtime-configurable % of users |
| graphql-gateway | migration-config | config read | sync | | per-field `@migrate` state and canary percentage |
| go-service | go-service | https/graphql (genqlient) | sync | | 300+ distinct cross-service request shapes; replaced in-process Python function calls |
| python-monolith | datastore | datastore rpc | sync | | |
| go-services | datastore | datastore rpc | sync | | ported models; far less contention than Python |
| python-monolith | memcache | memcached | sync | | common queries, user preferences, session data |
| go-services | memcache | memcached | sync | | content caching redesigned with "larger amounts of RAM available" |
| content-service | content-memcache | memcached | sync | | on-demand per-item fetch, batched with `get_many_by_key()` |
| content-service | content-manifest | memcached/http | sync | | fetch current content version, then fetch items by (version, id) |
| publish-job | datastore (revisions) | datastore rpc | sync | | creates frozen models from latest revisions, bumps `last_published_commit` |
| app-instances | frozen-model-store | in-process load | async | | instances pull the latest version within ~1 second of publish |
| browser-client | youtube | https | sync | | video playback |
| browser-client | s3-via-fastly | https | sync | | video fallback where YouTube is blocked |
| app-servers | pubsub-exercise-feed | pubsub publish | async | | exercise attempt events |
| pubsub-exercise-feed | exercise-feed-service | https push subscription | async | at-least-once (Pub/Sub push) | HMAC digest validated against secret in instance metadata |
| exercise-feed-service | bigquery | bigquery insert | async | | creates the destination table if missing |
| dataflow | bigquery | | async | | managed pipelines into the warehouse |
| khanflow-airflow | bigquery | bigquery api | async | | `KhanflowBigQueryOperator` DAG tasks |
| khanflow-airflow | dataflow | gcp api | async | | orchestrated pipeline runs |
| analytics-jobs | key-management (per-user keys) | | sync | | analysts operate on encrypted personal data; key deletion = erasure |

## Failure modes, incidents, tradeoffs the source discusses
- **Deploys, not traffic, were the COVID bottleneck.** "We noticed some slowdowns in the first few days and found that deploys were causing those hits." They paused their normal continuous-deployment cadence, and resumed it within a week once capacity was raised. — https://blog.khanacademy.org/how-khan-academy-successfully-handled-2-5x-traffic-in-a-week/
- **Cache capacity was the thing that had to be bought, not built.** Google increased Khan Academy's Memcache capacity on request during the surge; the serverless-plus-caching strategy is described as "the backbone" of their scalability. — https://blog.khanacademy.org/how-khan-academy-successfully-handled-2-5x-traffic-in-a-week/
- **Memcache overload is self-amplifying.** An overloaded memcache "can paradoxically increase query traffic", because misses fall through to the datastore that the cache was protecting. — https://blog.khanacademy.org/memcached-backed-content-infrastructure/
- **Moving from in-process data to a cache made a hot page 7x slower until reads were batched.** "khanacademy.org/math was over 7 times slower!"; the fix was replacing sequential fetches with `get_many_by_key()` batches. The general tradeoff: the old design was fast but "it took a lot of memory – and even more so as we started to version content separately for separate languages." — https://blog.khanacademy.org/memcached-backed-content-infrastructure/ , https://blog.khanacademy.org/evolving-our-content-infrastructure/
- **In-process content snapshots did not survive localisation.** 313 MB of frozen models on 512 MB instances, multiplied per locale, forced the move to on-demand memcache fetching. — https://blog.khanacademy.org/evolving-our-content-infrastructure/
- **Splitting a monolith turns function calls into network calls, and the code grows.** Porting one system needed "2.7x more lines of code", because "we had to change certain function calls into cross-service GraphQL calls". — https://blog.khanacademy.org/half-a-million-lines-of-go/
- **Field-level, not service-level, migration is what made a big-bang cutover avoidable.** "The graphql-gateway is going to call both the Python code and the new Go code. It will compare the results, log the instances where there's a difference, and return the Python result." Only after the diffs went quiet did a field move to canary, then to migrated — with the Python code kept in place as rollback. — https://blog.khanacademy.org/incremental-rewrites-with-graphql/
- **Canary at 1% first.** Major changes shipped via "canary release (shipping to 1% of users and increasing)"; the earlier content migration did the same at 1% → 5% → 25%, and the 1% stage is what surfaced an internationalisation bug. — https://blog.khanacademy.org/technical-choices-behind-a-successful-rewrite-project/ , https://blog.khanacademy.org/memcached-backed-content-infrastructure/
- **Porting the bugs too was a deliberate choice.** "We moved the behavior over exactly. If there's a bug in the python code, we port the bug (most times.)" — otherwise side-by-side diffing produces noise instead of signal. — https://newsletter.pragmaticengineer.com/p/real-world-eng-8
- **Language choice was a memory/cost decision, not a speed one.** "Go and Kotlin (on the JVM) perform similarly" but Go used substantially less memory, which matters when you pay per instance; a Python 3 upgrade would have bought only "a 10-15% boost in backend server code performance" for comparable refactoring effort. — https://blog.khanacademy.org/go-services-one-goliath-project/
- **Runtime-typed GraphQL clients were a correctness hazard at 300+ cross-service call sites.** "we couldn't be sure until runtime that our queries—and the boilerplate we needed to execute them—were well-formed" — which is why they wrote genqlient. — https://blog.khanacademy.org/genqlient-a-truly-type-safe-go-graphql-client/
- **Datastore contention was a Python artefact.** Contention warnings in bulk operations fell from "~100 per hour to near zero" after the Go port. — https://blog.khanacademy.org/half-a-million-lines-of-go/
- **Building your own orchestrator has a standing cost.** They retired the in-house "Khanalytics" because "developing and maintaining a pipeline orchestration platform in the cloud takes considerable ongoing investment". — https://blog.khanacademy.org/why-we-switched-to-airflow-for-pipeline-orchestration/
- **The estimate held.** The MVE finished "within four months of the initial estimate of completion made 20 months prior", with 95% of traffic on the new backend on 2021-08-30 — the source's own headline claim, against the base rate for rewrites. — https://blog.khanacademy.org/beating-the-odds-khan-academys-successful-monolith%E2%86%92services-rewrite/
- **The last 5% took as long as it was worth.** Phase 2 ("Endgame") ran Aug 2021 – Jan 2023, 18 months for the remaining traffic and internal tools, with the team shrinking from a peak of ~100 to 4. — https://newsletter.pragmaticengineer.com/p/real-world-eng-8

## Unknowns
- The full list of the ~40 services and their ownership boundaries is never enumerated.
- Regions, zones and any multi-region or failover design — not stated anywhere in the sources.
- Requests per second, instance counts, and any latency SLO (p50/p95/p99) — not published.
- Whether Khan Academy ever moved to Cloud Run or to Firestore: no first-party source says so. The 2019 post says the opposite ("keep using App Engine for our new Go services") and the 2021 post describes App Engine 1st gen → 2nd gen. Do not encode Cloud Run or Firestore without a new source.
- Whether the graphql-gateway is Apollo Gateway (Node) hosted on App Engine or something in-house — the posts name Apollo Federation as the spec/tooling but not the gateway's runtime or hosting.
- How the side-by-side comparison traffic was budgeted (every request? sampled?) and where the diff logs went.
- Memcache TTLs, eviction policy, and sizing; Datastore indexing and entity-group design.
- Pub/Sub topic layout, retention, DLQ handling, and whether the exercise feed is the only event stream.
- Authentication and session handling in the new architecture — sessions are mentioned only as a cache workload.
- Whether `@migrate` state lived in a config service, a deploy artefact, or a flag system — "runtime configurable" is all the source says.

## Candidates
- New kinds: none required. Every box maps to an existing kind; App Engine is best modelled as a platform property of `app-server` rather than its own kind.
- New properties on existing kinds:
  - `api-gateway.graphqlFederation` (boolean) and `api-gateway.queryPlanning` (boolean)
  - `api-gateway.routingGranularity` (enum: route, field) — field-level routing is the whole trick here
  - `app-server.platform` (enum: vm, container, paas-serverless) with `app-engine` as a value; `app-server.language`
  - `app-server.schemaContribution` (boolean) — a service that owns part of a federated schema
  - `cache.keyedByVersion` (boolean) and `cache.batchedReads` (boolean)
  - `nosql-database.contentionObserved` (boolean) — the Datastore contention finding
  - `workflow-engine.selfHosted` (boolean) — Airflow on their own GKE
- New edge properties:
  - `shadow` (enum: none, compare, compare-and-log) — the side-by-side call that runs both implementations and returns the old one
  - `canaryPercent` (integer) — runtime-configurable share of users routed to the new implementation
  - `batched` (boolean) — batched cache/datastore reads
- New requirement paths:
  - `migration.strategy` (enum: big-bang, strangler, field-level-federation)
  - `migration.rollbackPath` (enum: none, keep-old-code, dual-write)
  - `migration.deadline` (date) — an externally imposed EOL is a first-class requirement here
  - `cost.opsHeadcountConstrained` (boolean) — serverless chosen to avoid growing an ops team
- New rules (name + one-line condition):
  - `legacy-and-new-behind-one-gateway-without-comparison`: an api-gateway fans out to both a legacy app-server and a replacement app-server for the same field with `shadow: none`
  - `cutover-without-rollback-path`: `migration.strategy` set and `migration.rollbackPath` is `none`
  - `cache-fronting-datastore-without-batching`: a sync edge into a cache that fans out per item, with `batched` false, in front of a nosql-database
  - `in-process-snapshot-exceeds-instance-memory`: a cache modelled in-process whose stated size is a large fraction of `app-server.instanceMemory`
  - `deploy-amplified-load`: an app-server with `autoscaling: true` whose deploys are stated to cause latency hits — argues for pausing continuous deployment under surge
  - `cache-overload-amplifies-backend`: a cache in front of a database with no stated overload/circuit behaviour, where the source records self-amplifying miss traffic
  - `cross-service-call-untyped-client`: many service-to-service GraphQL edges with no schema-checked client
