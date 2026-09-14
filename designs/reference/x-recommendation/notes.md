# x-recommendation: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/x-recommendation.md` (intake card, sources fetched 2026-09-14, with the verification section appended).
- Size: 25 nodes, 31 edges, 3 groups. Broken twin: 22 nodes, 27 edges, 3 groups.

## Clean variant (header of design.yaml)

Reference architecture: the X (Twitter) For You recommendation serving path — Home Mixer
fanning one request out to the in-network and out-of-network candidate sources, hydrating
embedding and graph features, scoring every candidate on the Heavy Ranker and passing the
survivors through visibility filtering, over indexes that are all fed asynchronously.

Fixes relative to x-recommendation.broken.yaml:
  - index-ingester consumes the post-ingest topics and feeds earlybird-index asynchronously,
    so the index is rebuildable instead of dual-written by tweetypie on the request path
  - the SimClusters realtime tweet-embedding job writes embedding-cache, and the cache is
    persisted into manhattan, so the embeddings are neither the only copy nor unrebuildable
  - signal-ingester declares no event-time windowing, so no window closes without a watermark
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Broken variant of the X (Twitter) For You recommendation serving path: the same request
path, built the way a team builds it before the ingestion and embedding jobs exist —
Tweetypie writes the Earlybird index inline as it writes the post, the SimClusters
embeddings live only in Memcache and are written straight from CR-Mixer, and the realtime
signal topology windows engagement counts by event time with nothing to close a window.

This file MUST trip:
  - derived-store-without-cdc-or-rebuild        (earlybird-index has no async feed from a stream, CDC or worker; tweetypie dual-writes it)
  - cache-as-primary-store-without-persistence  (embedding-cache: usedAsPrimaryStore true, persistence false)
  - materialised-cache-without-rebuild-path     (embedding-cache is materialised and only cr-mixer, an app-server, writes it)
  - windowed-aggregation-without-watermark      (signal-ingester windows by event time with no watermarkSeconds)

Each mistake is one the sources themselves warn about: the 2020 indexing post describes
removing the sorting buffer that made inline indexing viable; `simclusters_v2` documents a
`PersistentTweetJob` whose whole purpose is that Memcache is not the only copy of a post
embedding; the realtime feature path exists precisely because engagement counts arrive late.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Client (For You timeline), X apps | `x-client` | `mobile-app` | client | exact |
| GraphQL edge the client requests through | `graphql-edge` | `envoy-gateway` | api-gateway | close (in-house edge, no product named) |
| Home Mixer | `home-mixer` | `container-service` | app-server | close (in-house Scala service) |
| TimelineRanker (TLR) | `timelineranker` | `container-service` | app-server | close |
| CR-Mixer | `cr-mixer` | `container-service` | app-server | close |
| Follow Recommendations Service (FRS) | `frs` | `container-service` | app-server | close (the card suggests ml-inference; the ML model sits in a separate prediction service that is not encoded) |
| Earlybird roots / superroot | `earlybird-root` | `load-balancer-tier` | load-balancer | close (scatter-gather root) |
| Earlybird search index | `earlybird-index` | `elasticsearch` | search-index | close (Lucene inverted index, not Elasticsearch; no generic search-index component exists) |
| User Tweet Entity Graph (UTEG / GraphJet) | `uteg` | `graph-store` | graph-database | close (`inMemory: true`) |
| Social Graph Service | `social-graph` | `graph-store` | graph-database | close |
| Graph Feature Service (GFS) | `graph-feature-service` | `graph-store` | graph-database | close |
| Heavy Ranker served on Navi | `heavy-ranker` | `tensorflow-serving` | ml-inference | close (Navi's gRPC API is TensorFlow-Serving compatible) |
| Representation Manager (RMS) | `representation-manager` | `cache-cluster` | cache | close (embedding-retrieval facade) |
| Visibility Filtering library / service | `visibility-filtering` | `container-service` | app-server | assumed (the card's kind is policy-engine; no vendor-neutral policy-engine component exists) |
| Tweetypie | `tweetypie` | `container-service` | app-server | close |
| Twemcache | `twemcache` | `memcached` | cache | exact (Twemcache is X's memcached fork) |
| Manhattan | `manhattan` | `nosql-store` | nosql-database | close (in-house key-value store) |
| Post and user-modification Kafka topics | `post-events` | `kafka` | stream | exact |
| Unified User Actions (UUA) | `uua-kafka` | `kafka` | stream | exact |
| Index Ingester | `index-ingester` | `container-worker` | worker | close |
| Signal Ingester / Feature Update Service | `signal-ingester` | `storm` | stream-processor | close (Heron, X's Storm successor) |
| Recos-Injector | `recos-injector` | `container-worker` | worker | close |
| SimClusters Known For job | `simclusters-job` | `container-worker` | worker | close (Scalding / BigQuery batch, every three weeks) |
| SimClusters realtime tweet-embedding job | `simclusters-embedding-job` | `container-worker` | worker | close (Summingbird on Storm) |
| SimClusters embedding Memcache | `embedding-cache` | `memcached` | cache | exact |

Tally: 4 exact, 20 close, 1 assumed.

## Catalogue gaps

Two kinds used here have no vendor-neutral generic component under `components/default/`:

- `search-index` — Earlybird is an in-house Lucene index; the design uses `elasticsearch` with
  the label "Earlybird realtime index".
- `policy-engine` — Visibility Filtering is an in-house rule engine; the design uses
  `container-service` with the label "Visibility Filtering", so the design carries no
  policy-engine node at all.

Nothing was added to the catalogue. Near-matches that were good enough and are not gaps:
`storm` for Heron, `tensorflow-serving` for Navi, `nosql-store` for Manhattan, `graph-store`
for GraphJet / Social Graph Service / GFS, `memcached` for Twemcache.

## Not encoded

- Every number the sources state. The scale figures (500 million posts a day, 1500 candidates,
  the 50/50 in-network / out-of-network mix, GraphJet's ~15% share, the ~48M-parameter Heavy
  Ranker, ~5 billion pipeline executions a day under 1.5 seconds for 220 CPU-seconds, 150
  billion posts served, the 1-second Earlybird indexing latency, ~6000 features per ranking
  request) all come from the two blog.x.com posts, whose origin returns 403 and whose Wayback
  capture could not be re-fetched on 2026-09-14. No `nfr.rps`, no `latency` requirement and no
  `freshness.maxSeconds` is set, because the format would turn an unverifiable average into a
  p95 or a per-node rate.
- The 1.5-second budget in particular: `latency.p95Ms` states a p95 and the source states an
  average, so the requirement is omitted rather than restated as something the source does not
  say. It is why `sync-chain-too-deep` cannot select this design's entry point.
- `security.credentialRotationDays: 90` is an assumption, not a source fact: no source states a
  rotation period, and the requirement is set so that `credentials-without-rotation` reflects a
  practice a system of this size certainly has.
- The whole 2026 generation (xai-org/x-algorithm): Thunder, Phoenix retrieval and ranking,
  phoenix-rankall and phoenix-rankall-strato, VM Ranker, RankingScorer, TopKScoreSelector,
  AgeFilter, the Brazil election filter and the labeling path (grox, clip, media-model-proxy,
  agatha, bdsm, user-cred-v2, scarecrow, botmaker, abuse-enforcement-service,
  safety-label-user-agg, under-the-hood, label storage). The design encodes the 2023 generation
  end to end; encoding both eras would double the node count.
- Product Mixer / the candidate-pipeline framework. It is a library Home Mixer is built on, not
  a separate runtime element, and the format has no place for a framework.
- The pipeline's stage structure — source, hydrator, filter, scorer, selector, side effect — and
  the fact that stages are parameters rather than code. Nodes and edges cannot express that the
  same service runs a configurable stage list, nor that independent stages run in parallel.
- The documented degradation path is encoded only as `fallback: "degraded"` on the candidate and
  ranking edges plus `availability.degradedModeAllowed`. The backup reverse-chron pipeline
  itself (`ForYouConversationServiceCandidatePipelineConfig`) is a second pipeline inside Home
  Mixer, not a second node.
- Heuristics that rewrite the ranked order after scoring (author diversity, content balance,
  feedback-based fatigue, social proof) and the ads blending stage: in-process stages, and the
  ads path is excluded from both open-source releases.
- The Earlybird cluster split (realtime ~7 days, protected, archive up to ~2 days ago), the
  Earlybird light ranker, the segment and document-id scheme, and the single-writer /
  multi-reader model: properties of one box that the `search-index` kind cannot carry.
- Feature services the card lists but that would push the design past 25 nodes: Representation
  Scorer (RSX), User Signal Service (USS), Topic Social Proof (TSPS), Tweet Mixer (the 2025
  CR-Mixer successor), TwHIN, Real Graph, Tweepcred and the `pushservice` notification surface.
- UUA's replication to HDFS, GCP Pub/Sub, GCS and BigQuery, and the offline training corpora
  behind TwHIN and Real Graph: they leave the serving pipeline this design is about.
- Delivery guarantees are declared `at-least-once` on the Kafka hops because that is the
  component default; no source states a guarantee on any hop.
