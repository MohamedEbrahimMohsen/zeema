# khan-academy-goliath: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/khan-academy-goliath.md` (eleven Khan Academy engineering-blog posts, plus InfoQ and Pragmatic Engineer interviews; re-verified 2026-09-14)
- Size: 22 nodes, 29 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture: Khan Academy's "Goliath" rewrite — a Python 2 App Engine monolith and
~40 Go services behind one Apollo-federated graphql-gateway that routes each GraphQL field to
whichever backend the @migrate directive names, with a memcache-backed content store and a
GKE/BigQuery analytics platform fed off the serving path by Pub/Sub.

Fixes relative to khan-academy-goliath.broken.yaml:
  - exercise attempts are published to exercise-feed-topic (Pub/Sub) and pushed to the
    exercise-feed-service, so analytics never sits on the request path
  - content-memcache is a cache, not the system of record: content-revisions holds the
    durable entities and publish-job rewrites the cache, so it has a rebuild path
  - both memcache tiers declare an eviction policy, so an overloaded cache evicts instead of
    rejecting writes and pushing every read through to Datastore
  - dataflow declares no event-time windowing: the pipelines the source describes load the
    warehouse, they do not aggregate event-time windows without a watermark
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture, broken variant: the same Khan Academy federation, but exercise
analytics is inserted synchronously on the request path, the memcache content store is the
only copy of published content with nothing that can rewrite it, the shared memcache is
configured never to evict, and the Dataflow pipelines window by event time with no watermark.

This file MUST trip:
  - fanout-inline-in-request-path              (python-monolith and go-services call exercise-feed-service synchronously)
  - cache-as-primary-store-without-persistence (content-memcache: usedAsPrimaryStore true, persistence false)
  - materialised-cache-without-rebuild-path    (content-memcache is materialised and only content-service, an app-server, writes it)
  - cache-missing-eviction-policy              (shared-memcache declares evictionPolicy none)
  - windowed-aggregation-without-watermark     (dataflow windows by event-time with no watermarkSeconds)
and MUST NOT trip:
  - credentials-without-rotation               (user-key-store is a key-management node)
  - read-heavy-path-without-cache              (two caches exist; the rule is design-wide)
  - datastore-missing-backup, datastore-single-region, single-writer-primary-at-peak-qps,
    read-replica-as-sole-scaling, business-updates-without-index-propagation (no sql-database node)
  - derived-store-without-cdc-or-rebuild       (no search-index node)
  - queue-missing-dlq, retry-queue-without-dlq, pubsub-replay-required (no queue, and the topic is gone)
  - external-call-inline-without-durable-path  (only the browser calls YouTube, and a browser is not an app-server)
  - object-store-single-zone-with-durability-target (no durability requirement is declared)
  - sync-chain-too-deep                        (no latency.p95Ms requirement is published)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone,
    cross-cell-call, shared-dependency-without-redundancy (no zone, cell or coordination node)

Each of the four mistakes is one the sources themselves warn about: exercise events were
deliberately pushed off the serving path through Pub/Sub; the content store replaced an
in-process snapshot that could always be rebuilt from Datastore revisions; and an overloaded
memcache "can paradoxically increase query traffic" when misses fall through to the datastore
it was protecting.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Browser / learner client (React SPA) | `browser-client` | `web-browser` | client | exact |
| Fastly CDN, "first point of contact for all requests" | `fastly-edge` | `fastly` | cdn | exact |
| React server-side rendering | `react-ssr` | `container-service` | app-server | close (hosting not stated in any source) |
| graphql-gateway (Apollo Federation, query planning, `@migrate` routing) | `graphql-gateway` | `envoy-gateway` | api-gateway | assumed (no Apollo gateway component; see gaps) |
| Python 2 monolith `webapp` on App Engine standard 1st gen | `python-monolith` | `google-app-engine-standard` | app-server | exact |
| ~40 Go services (gqlgen) on App Engine | `go-services` | `google-app-engine-standard` | app-server | exact |
| The content service among those Go services | `content-service` | `google-app-engine-standard` | app-server | close (the sources name a content service but do not enumerate the ~40) |
| `@migrate` directive state and canary percentage, "runtime configurable" | `migration-config` | `unleash` | feature-flag-service | assumed (in-house; see gaps) |
| Google Cloud Datastore (user, progress, content entities) | `datastore` | `nosql-store` | nosql-database | close (generic, labelled; see gaps) |
| `VideoRevision` / `ArticleRevision` entities at the editing head | `content-revisions` | `nosql-store` | nosql-database | close |
| Google Cloud Memcache (queries, preferences, sessions) | `shared-memcache` | `memcached` | cache | exact |
| Content store in memcache, keyed by (content version, content id) | `content-memcache` | `memcached` | cache | exact |
| Publish: frozen models materialised, `last_published_commit` SHA bumped | `publish-job` | `container-worker` | worker | close |
| YouTube | `youtube` | `supplier-api` | third-party-api | close (generic, labelled; see gaps) |
| Amazon S3 video fallback served through Fastly | `video-fallback-store` | `s3` | object-store | exact |
| Cloud Pub/Sub exercise feed | `exercise-feed-topic` | `google-pubsub` | pubsub-topic | exact |
| Exercise-feed microservice on App Engine flexible | `exercise-feed-service` | `container-worker` | worker | close (App Engine flexible exists as an app-server component, but the box is a push-subscription worker) |
| BigQuery | `bigquery` | `bigquery` | data-warehouse | exact |
| Cloud Dataflow | `dataflow` | `google-dataflow` | stream-processor | exact |
| Khanflow (Airflow 2.0) | `khanflow` | `airflow` | workflow-engine | exact |
| Pipeline tasks (`KhanflowPythonOperator`, one service account per pipeline) | `analytics-jobs` | `container-worker` | worker | close |
| Per-user encryption key table | `user-key-store` | `hashicorp-vault` | key-management | assumed (in-house table; see gaps) |
| GKE cluster hosting the analytics stack | group `analytics` (trust-zone) | — | — | close (a hosting boundary, not a runtime call) |

Tally: 9 exact, 10 close, 3 assumed.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Apollo Federation gateway (query planning over subgraph schemas) | api-gateway — the kind exists, a federating GraphQL gateway does not (`aws-appsync` is the only GraphQL api-gateway and it is AWS-managed) | `envoy-gateway` with `gatewayApi: false`, labelled "graphql-gateway (Apollo Federation)" |
| Google Cloud Datastore | nosql-database — the only Datastore component is `google-firestore-datastore-mode`, i.e. Firestore, and the card forbids encoding Firestore without a new source | `nosql-store` (default), labelled "Google Cloud Datastore" |
| YouTube | third-party-api — the kind exists, YouTube does not | `supplier-api` (default), labelled "YouTube" |
| An in-house per-field migration directive with a canary percentage | feature-flag-service — every component of the kind is a named flag product | `unleash` (self-hosted, staged rollout), labelled with the four `@migrate` states |
| A per-user encryption key table | key-management — every component of the kind is a named secrets product or HSM; there is no generic key store | `hashicorp-vault`, labelled "per-user encryption key table" |
| Google App Engine flexible as the host of a worker | worker — `google-app-engine-flexible` exists but is an app-server, and the box is a Pub/Sub push consumer | `container-worker`, labelled with the platform |

No new kind is required. The two real candidates for the catalogue are a **federating GraphQL
gateway** component and a **generic key store** under `key-management`.

## Not encoded

- **Google App Engine as a node.** App Engine is the platform for the monolith, the gateway and
  the Go services; it is carried by the `google-app-engine-standard` component and the
  `app-engine` trust-zone group, not as a box of its own. The 1st gen → 2nd gen migration and the
  512 MB legacy instance size have no property to live on.
- **The GKE cluster** is the `analytics` trust-zone group rather than a
  `container-orchestrator` node: nothing in the sources calls it, it hosts.
- **The content manifest** (content id → data hash) is described as a data structure the content
  service reads, not a separate service; it lives inside `content-memcache`.
- **The Frozen Model Store** is the design `content-memcache` replaced. Encoding both the old
  in-process snapshot and its replacement would draw two content paths the system never ran at
  once; the 34 MB pickled / 313 MB in RAM figures stay in the source card.
- **genqlient** is a client library, not a node: it is the label on the
  `go-services -> content-service` edge, with the 300+ distinct request shapes.
- **The side-by-side comparison** is a mode of one gateway edge, not a second edge. The format has
  no `shadow` or `canaryPercent` edge field, so "call both, compare, return the Python result" and
  the runtime-configurable canary percentage are carried in the labels of the two gateway edges
  and in `migration-config`. This is the single biggest thing the format cannot express here, and
  it is the whole point of the system; the card's Candidates section proposes the fields.
- **The migration itself** — `migration.strategy`, `migration.rollbackPath`, `migration.deadline`
  (Python 2 EOL, 2020-01-01) — has no requirement path. Neither has
  `cost.opsHeadcountConstrained`, the reason serverless was chosen.
- **A direct browser → graphql-gateway edge.** The card lists it, but Fastly is "the first point
  of contact for all requests", so GraphQL reaches the gateway through `fastly-edge`.
- **Cloud Run and Firestore are deliberately absent.** No first-party source places Khan Academy
  on either; the 2019 post says the opposite.

## Values set because a rule reads them, where the source is silent

- `evictionPolicy: "lru"` on both memcache tiers. Memcached's own default is LRU and the component
  default agrees; the sources never state a TTL or eviction policy (the card lists it as unknown).
- `windowing: "none"` on `dataflow`. The component defaults to event-time windowing, which would
  fire `windowed-aggregation-without-watermark`; the sources describe Dataflow only as managed
  pipelines feeding the warehouse, never as event-time aggregation, and no watermark figure is
  published to declare instead.
- `freshness.maxSeconds: 1` comes from "the entire site is atomically updated in about a second".
- `availability.multiRegion: false`: no source describes a multi-region or failover design.
- No `nfr.rps` anywhere, and no SLA, latency target or read/write ratio: none is published. The
  18M/30M monthly learners, the 2.5x surge, the ~1.04M → ~1.15M line counts and the ~100/hr → ~0
  Datastore contention figures stay in the source card and in labels.
