# Intake: X (Twitter) For You recommendation algorithm

## Source
- Primary: https://blog.x.com/engineering/en_us/topics/open-source/2023/twitter-recommendation-algorithm ("Twitter's Recommendation Algorithm", written by the Twitter Team, X engineering blog, 31 March 2023). Origin returns 403; read in full from the Wayback capture https://web.archive.org/web/20230401000000/https://blog.twitter.com/engineering/en_us/topics/open-source/2023/twitter-recommendation-algorithm
- Primary: https://github.com/twitter/the-algorithm (X engineering, open-source release, 2023-2025) — top-level README plus 22 component READMEs fetched raw: home-mixer, search (Earlybird), earlybird light ranker, user_tweet_entity_graph, cr-mixer (2023 commit `bb09560`), timelineranker, simclusters_v2, interaction_graph (Real Graph), tweepcred, visibilitylib, navi, product-mixer, graph-feature-service, representation-manager, representation-scorer, unified_user_actions, user-signal-service, recos-injector, topic-social-proof, tweetypie, follow-recommendations-service
- Primary: https://github.com/twitter/the-algorithm-ml (X engineering, 2023) — repo README, `projects/home/recap/README.md` (Heavy Ranker), `projects/twhin/README.md`
- Primary: https://github.com/xai-org/x-algorithm (X / xAI engineering, released January 2026, README last updated 14 August 2026) — top-level README and `phoenix/README.md`. This is the current production architecture and supersedes most of the 2023 boxes.
- Primary: https://blog.x.com/engineering/en_us/topics/infrastructure/2020/reducing-search-indexing-latency-to-one-second (X engineering, 5 June 2020; read via Wayback) — Earlybird indexing internals
- Verified by: official X engineering blog (two posts) + three official X/xAI open-source repositories (27 READMEs fetched in full). No secondary source contributed a fact.
- Confidence: high
- Date of source: 2020, 2023 (the classic architecture), 2025-09 and 2026-08 (the current architecture)

## System in three lines
Picks the handful of posts each viewer sees in the For You home timeline out of roughly 500 million posted daily, running the same three stages on every request: candidate sourcing from in-network and out-of-network sources, machine-learned ranking of every candidate, then heuristics and safety filters before the posts are blended with ads and non-post modules. The orchestrator is Home Mixer, a pipeline service whose stages (source, hydrator, filter, scorer, selector, side effect) are configuration rather than code. Hard because the pipeline runs about 5 billion times a day and must finish in under 1.5 seconds while hydrating thousands of features per candidate and consulting a separate safety rule engine per post and viewer.

Note on eras: the sources describe two generations. The 2023 release (twitter/the-algorithm) is the famous one — Earlybird, CR-Mixer, UTEG, SimClusters, TwHIN, Real Graph, Tweepcred, the 48M-parameter Heavy Ranker. The January 2026 release (xai-org/x-algorithm) replaced candidate sourcing and ranking with Thunder and Phoenix and rebuilt Home Mixer in Rust. The component and edge tables below mark each row `2023`, `2026` or `both`.

## Scale (only if stated)
- Posts to choose from: "roughly 500 million Tweets posted daily" (blog.x.com 2023)
- Candidates per request: "we attempt to extract the best 1500 Tweets from a pool of hundreds of millions" (blog.x.com 2023)
- Source mix: "the For You timeline consists of 50% In-Network Tweets and 50% Out-of-Network Tweets on average, though this may vary from user to user" (blog.x.com 2023)
- Earlybird share of For You candidates: "~50% of posts come from this candidate source" (twitter/the-algorithm README)
- GraphJet social-graph traversal share: "these currently serve about 15% of Home Timeline Tweets" (blog.x.com 2023)
- Features hydrated per ranking request: "Fetch the ~6000 features needed for ranking" (home-mixer README); the blog says the ranker "takes into account thousands of features"
- Heavy Ranker size: "a ~48M parameter neural network", ten output labels (blog.x.com 2023)
- SimClusters: "the Known For dataset covers the top 20M producers and k ~= 145000", communities "updated every three weeks" (simclusters_v2 README, blog.x.com 2023)
- UTEG working set: "maintains in-memory user engagements over the past 24-48 hours" (UTEG README)
- Earlybird index horizon: realtime cluster "about the last 7 days", archive cluster "all tweets ever posted, up to about two days ago" (search README)
- Earlybird indexing latency: 15 seconds before mid-2019, "Tweets are now available for searching within one second of creation"; search systems "process hundreds of thousands of queries per second"; segments "usually writable for about 12 hours" (blog.x.com 2020)
- Pipeline rate and latency: "runs approximately 5 billion times per day and completes in under 1.5 seconds on average. A single pipeline execution requires 220 seconds of CPU time, nearly 150x the latency you perceive on the app" (blog.x.com 2023)
- Whole-platform delivery: "we serve over 150 billion Tweets to people's devices" per day (blog.x.com 2023)
- 2026 candidate age bound: `AgeFilter` removes "posts older than 48 hours" (xai-org README)
- Phoenix retrieval funnel: "Millions → 1000s" then ranking "1000s → Ranked" (phoenix README)
- Phoenix semantic IDs: "residual-quantized codes (6 levels × 256 codes)" per post (phoenix README)
- Experiment visibility threshold: experiments "at a notable share of traffic — e.g. 10% or more" are meant to be visible in the repo (xai-org README)

## Requirements stated or clearly implied
- Availability target: not stated as an SLA. Home Mixer ships an explicit degradation path: `ForYouConversationServiceCandidatePipelineConfig` is the "backup reverse chron pipeline in case Scored Tweets fails" (home-mixer README). The 2026 pipeline framework promises "parallel execution of independent stages and graceful error handling" (xai-org README).
- Consistency: not stated. Everything on the request path is best-effort read of asynchronously maintained indexes; safety labels are written offline and "read back on the request path" (xai-org README).
- Latency target: under 1.5 seconds end to end on average for the whole For You pipeline; search indexing latency budget of 1 second for Earlybird (blog.x.com 2020, 2023). Per-stage budgets are not stated.
- Ordering needs: none globally. Within the response, ordering is the product of `RankingScorer` plus `VMRanker` diversity reranking; conversations are threaded so a reply appears with its parent (blog.x.com 2023, xai-org README).
- Replay or reprocessing: heavy. SimClusters Known For is a scheduled Scalding/BigQuery rebuild every three weeks; Real Graph runs "multiple dataflow jobs" daily plus "a rollup job that aggregates yesterday's aggregation with today's interactions"; Tweepcred is an iterative Hadoop PageRank; agatha is "offline batch jobs"; under-the-hood runs "daily jobs".
- Retention: UTEG keeps 24-48 hours in memory and "older events are dropped and GC'ed"; Earlybird realtime holds ~7 days and archive holds everything up to ~2 days ago; 2026 candidates must be under 48 hours old.
- Compliance / residency: visibility filtering exists "to support legal compliance" (visibilitylib README). The 2026 rules read "the viewer's settings and country", and `Brazil2026ElectionFilter` "removes posts from accounts reported to Brazil's Electoral Court for the 2026 election, unless the viewer explicitly follows the account", in accordance with Brazilian electoral law (xai-org README).
- Transparency as a requirement: the 2026 repo runs "cron scripts that set the defaults in this repository's code to be the primary production values", and ships the Under the Hood tool so a user can see the visibility-affecting labels on their own account.

## Boundaries
- Regions / zones: not stated in any source.
- Trust zones: client / GraphQL edge -> Home Mixer and the request-path services -> offline jobs and stores. Ranking and safety are deliberately separated trust-wise: "Ranking decides the order. Visibility filtering decides whether a post can be shown at all. Different services, different inputs, different rules" (xai-org README).
- Named subsystems (2023): Home Mixer, Product Mixer, Earlybird search index (realtime / protected / archive clusters), CR-Mixer, Tweet Mixer, UTEG / GraphJet, FRS, TimelineRanker, Heavy Ranker on Navi, Visibility Filtering, SimClusters, TwHIN, Real Graph, Tweepcred, Representation Manager, Representation Scorer, Graph Feature Service, Topic Social Proof, User Signal Service, Unified User Actions, Recos-Injector, Tweetypie, Manhattan, Twemcache.
- Named subsystems (2026): Home Mixer (Post Pipeline, Blending Pipeline) on the candidate-pipeline framework, Thunder, Phoenix retrieval, Phoenix ranking, phoenix-rankall / phoenix-rankall-strato index, SimClusters, VM Ranker, visibility-filtering, and the Labeling Path (grox, clip, media-model-proxy, agatha, bdsm, user-cred-v2, adult-content, pnsfwmedia, scarecrow, botmaker, botmaker-rules, abuse-enforcement-service, safety-label-user-agg, under-the-hood).
- Product surfaces sharing the same substrate: For You, Following, Lists, Search, Explore, Recommended Notifications.

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Client (For You timeline) | Requests the timeline through GraphQL; receives client instructions, edited-post replacements, pagination cursors | X apps | client | era: both; receives "client instructions and content marshalling" |
| 2 | Home Mixer | "Main service used to construct and serve the Home Timeline"; orchestrates sources, hydration, scoring, filters, mixing | in-house (Scala on Product Mixer 2023; Rust in 2026) | app-server | era: both; powers For You, Following, Lists; stages toggleable by param |
| 3 | Product Mixer / candidate-pipeline | Pipeline framework: Product -> Mixer/Recommendation -> Candidate -> Scoring pipelines; 2026 stage types are source, hydrator, filter, scorer, selector, side effect | in-house (Scala / Rust crate) | workflow-engine | era: both; "parallel execution of independent stages and graceful error handling" |
| 4 | Earlybird search index | Real-time Lucene inverted index; in-network candidate source and search backend; "~50% of posts come from this candidate source" | Apache Lucene (Earlybird) | search-index | era: 2023; clusters: realtime (~7 days) / protected / archive (up to ~2 days ago); sharded into partitions, replicated; single writer, multiple readers; doc ids assigned high-to-low by creation time, 27-bit ms timestamps; segments writable ~12 h; indexing latency 1 s |
| 5 | Earlybird roots / superroot | Fan out a query to clusters and partitions, merge responses for the caller | in-house | load-balancer | era: 2023; scatter-gather |
| 6 | Index Ingester | Reads posts and user modifications from Kafka topics, extracts fields and static features, writes intermediate Kafka topics for Earlybird | in-house, Kafka-fed | stream-processor | era: 2023; produces Tweet Data + Static Features |
| 7 | Signal Ingester / Feature Update Service | Heron topology computing realtime per-post features (fav, retweet, reply counts, spam signals) and pushing them into Earlybird | Apache Heron | stream-processor | era: 2023; feeds live engagement counts into the index |
| 8 | User Table Updater | Processes the user-service stream into sparse realtime per-user features, propagated to posts by author | in-house | stream-processor | era: 2023 |
| 9 | Earlybird light ranker | Logistic regression predicting engagement, cheap enough to run over many posts; two models, `recap_earlybird` in-network and `rectweet_earlybird` out-of-network | in-house on twml/TensorFlow v1 | ml-inference | era: 2023; "a simplified version of the heavy ranker"; uses static + realtime features including tweepcred, pToxicity, pBlock; "last trained several years ago" |
| 10 | TimelineRanker (TLR) | Legacy service fetching from Earlybird and UTEG, light-ranking on Earlybird scores and truncating to the count Home Mixer asked for | in-house | app-server | era: 2023; "it no longer performs heavy ranking or model-based ranking itself" |
| 11 | CR-Mixer | Coordinating layer for out-of-network candidate generation: source-signal extraction, candidate generation, filtering, light ranking; caches results | in-house | app-server | era: 2023 (replaced by Tweet Mixer by 2025); 4-step pipeline; "fetches source signals externally from stores like UserProfileService and RealGraph" |
| 12 | Tweet Mixer | "Coordination layer for fetching Out-of-Network tweet candidates from underlying compute services" | in-house | app-server | era: 2025 (successor to CR-Mixer); ships without its own README |
| 13 | User Tweet Entity Graph (UTEG) | In-memory user-to-post bipartite graph traversed for collaborative-filtering candidates; produces the "XXX Liked" out-of-network posts | GraphJet, Finagle Thrift | graph-database | era: 2023; stateful; Kafka-ingested; 24-48 h in-memory window, older events "dropped and GC'ed"; input is a weighted follow graph |
| 14 | Recos-Injector | Streaming event processor that filters and combines Fav/RT/Follow/client-event streams into per-service Kafka topics for the GraphJet services | in-house | stream-processor | era: 2023; "does not have a Thrift endpoint. Instead, it reads Event Bus and Kafka queues and writes to the Recos-Injector Kafka" |
| 15 | Follow Recommendations Service (FRS) | Recommends accounts to follow and their posts (FutureGraph posts); candidate generation, filtering, ML ranking, transform, truncation | in-house | ml-inference | era: both (2026: "Who to Follow"); ranker score is "a weighted sum of p(follow\|recommendation) and p(positive engagement\|follow)"; ML model hosted in a separate prediction service |
| 16 | Heavy Ranker | Neural network scoring all ~1500 candidates regardless of source; ten engagement probabilities combined by a weighted sum | in-house, parallel MaskNet on torchrec/PyTorch | ml-inference | era: 2023; ~48M parameters; continuously trained on post interactions; weights as of 5 Apr 2023 include reply 13.5, reply_engaged_by_author 75.0, negative_feedback_v2 -74.0, report -369.0 |
| 17 | Navi | Rust model-serving server used to run the ranking models; gRPC API compatible with TensorFlow Serving | in-house (Rust) | ml-inference | era: 2023; pluggable runtimes TF / ONNX / PyTorch; "Navi for Onnx ... used in Twitter's home recommendation with a proprietary BatchPredictRequest format" |
| 18 | SimClusters | Community detection producing sparse interpretable embeddings for users, posts and topics; out-of-network candidate source via SimClusters ANN | in-house (Scalding, BigQuery, Summingbird/Storm) | ml-platform | era: both; k ~= 145000 communities over the top 20M producers, refreshed every 3 weeks; Metropolis-Hastings community detection on a producer-producer cosine-similarity graph; post embeddings updated on every favourite |
| 19 | SimClusters realtime tweet-embedding job | Storm/Summingbird job maintaining post embeddings in Memcache, persisted to Manhattan | Summingbird on Storm; Memcache; Manhattan | stream-processor | era: 2023; "Persistent the tweet embeddings from MemCache into Manhattan" |
| 20 | TwHIN | Dense knowledge-graph embeddings for users and posts learned from heterogeneous graphs ("User follows User", "User favorites Tweet", "User clicks Advertisement") | in-house on torchrec | ml-platform | era: 2023; "used for candidate retrieval and as model features in a variety of recommender system models" |
| 21 | Real Graph | Predicts the likelihood of one user engaging with another; the top in-network ranking signal | BigQuery boosted-tree classifier + Scio/Dataflow aggregation | ml-platform | era: 2023; daily aggregation of public and private engagements plus a rollup job producing "the rollup aggregation of interactions as a decayed sum between a pair of users" and the predicted interaction score |
| 22 | Tweepcred | PageRank over the user interaction graph producing a per-user reputation score consumed as an Earlybird feature | Hadoop MapReduce / Scalding PageRank | worker | era: 2023; prepare + iterate stages, converges over `maxiterations`; user "mass" from account age, followers, followings, device usage, restricted/suspended/verified status; post-adjusted by follower-to-following ratio |
| 23 | Representation Manager (RMS) | Centralized embedding retrieval facade over SimClusters, TwHIN and other embedding stores | in-house | cache | era: 2023; "facade of the underlying storage or services" |
| 24 | Representation Scorer (RSX) | Computes pairwise and listwise embedding-similarity features from USS signals and RMS embeddings | in-house | ml-inference | era: 2023; features used "at various stages, including candidate retrieval and ranking" |
| 25 | Graph Feature Service (GFS) | Answers directed user-pair graph questions ("how many of A's followings have favorited C") as ranking features | in-house, distributed | graph-database | era: 2023 |
| 26 | User Signal Service (USS) | Online platform supplying explicit signals (fav, retweet, reply) and implicit ones (post clicks, video views, profile visits) in uniform formats | in-house | app-server | era: 2023; feeds candidate retrieval and ranking features |
| 27 | Unified User Actions (UUA) | Real-time Kafka stream of all user actions, built from client-side and server-side event streams | Apache Kafka | stream | era: 2023; "replicated to HDFS, GCP Pubsub, GCP GCS, GCP BigQuery" |
| 28 | Topic Social Proof (TSPS) | Resolves which topics a post belongs to and how relevant each is to the viewer, using SimClusters embeddings and semantic annotations | in-house | ml-inference | era: 2023 |
| 29 | Tweetypie | Core post read/write service; hydrates posts for every caller | in-house; Manhattan + Twemcache | app-server | era: 2023; read path is Manhattan repository wrapped in a Twemcache caching repository wrapped in a hydration pipeline |
| 30 | Manhattan | Real-time multi-tenant distributed database holding post data and some features | Manhattan | nosql-database | era: 2023; also the persistence target for SimClusters post embeddings |
| 31 | Twemcache | Cache in front of Manhattan on the Tweetypie read path | Twemcache | cache | era: 2023 |
| 32 | Social Graph Service | Serves the follow graph and user states (blocked, muted, retweets muted) | in-house | graph-database | era: 2023; called by TimelineRanker |
| 33 | Visibility Filtering library / service | Centralized rule engine deciding, per viewer and content, whether to allow, label, interstitial, downrank or drop | in-house | policy-engine | era: both; concepts SafetyLevel, Features, Action, Condition, Policy, RuleEngine, SafetyLabel; "one policy per SafetyLevel"; 2026 answers are ALLOW / INTERSTITIAL / DROP and "the first rule that answers drop ends the evaluation" |
| 34 | Trust & Safety models | Models detecting NSFW or abusive content, feeding the labels visibility filtering reads | in-house | ml-inference | era: 2023 (2026 successors listed below); pToxicity and pBlock scores consumed by the Earlybird light ranker |
| 35 | Thunder | In-network candidate source: "holds recent posts in memory as they are published, and returns those from the accounts a viewer follows" | in-house | cache | era: 2026; in-memory; is passed the already-seen list and leaves those out at the source |
| 36 | Phoenix retrieval | Two-tower transformer retrieval: "embeds the viewer and each post as vectors, and returns the posts nearest the viewer" | in-house (JAX training, Rust gRPC serving) | vector-database | era: 2026; user tower has no learned per-user ID embedding; candidates carry semantic IDs (6 levels x 256 codes) plus hashed author IDs; index built by the candidate tower at checkpoint save and loaded from the checkpoint, "nothing embeds a corpus at boot time" |
| 37 | phoenix-rankall | "Maintains the index of posts Phoenix retrieval queries, updating it as events arrive" | in-house | search-index | era: 2026; event-driven index maintenance |
| 38 | phoenix-rankall-strato | Event layer deciding which index a post belongs in, "consulting visibility filtering first" | in-house | stream-processor | era: 2026; safety consulted at index time as well as request time |
| 39 | Phoenix ranking (PhoenixScorer) | Transformer predicting a probability for each action the viewer might take on each post, plus dwell regression heads | in-house (JAX + Rust serving engine) | ml-inference | era: 2026; candidate isolation — "candidates cannot attend to each other", making scores batch-invariant and cacheable; hash-based embeddings so "a new post is representable immediately" |
| 40 | RankingScorer | Weighted sum of the predicted action probabilities, then author-diversity decay, out-of-network discount, new-author boost | in-house | worker | era: 2026; `Final Score = Σ (weight_i × P(action_i))`; weights live in `home-mixer/params/param.rs` and are cron-synced to production values |
| 41 | VM Ranker | Reranking service that "reorders them with a determinantal point process over their embeddings, giving up a little score for less similarity between neighbours" | in-house | ml-inference | era: 2026; separate service called by `VMRanker` after scoring |
| 42 | TopKScoreSelector | Sorts by final score and keeps the top K | in-house | worker | era: 2026 |
| 43 | Grox | Classifiers run "as posts are published" for spam, adult content, violent media, plus numeric representations of text and images | in-house (LLM-based; prompts withheld) | ml-inference | era: 2026; off the request path |
| 44 | CLIP / media-model-proxy | Image-and-text embedding model plus the image and video classifiers (adult, violence, hateful symbols, subject matter, known-media matching) that consume its embeddings | CLIP | ml-inference | era: 2026 |
| 45 | agatha | "Offline batch jobs that label an account from how others respond to its posts: blocks, reports and spam reports relative to favorites" | in-house | worker | era: 2026; batch |
| 46 | bdsm | "Reads the sequence of actions an account takes over time to identify signs of inauthentic or abusive behavior" | in-house | ml-inference | era: 2026 |
| 47 | user-cred-v2 | "Runs PageRank over the follow graph and engagement edges, and turns the resulting mass into a per-account score" | in-house | worker | era: 2026; the Tweepcred successor |
| 48 | scarecrow + botmaker | Rule engine applying labels to events as they happen; botmaker is the rule language, compiler and runtime, rules loaded from botmaker-rules | in-house | policy-engine | era: 2026; "on this event, if these conditions hold, apply this label"; some rules deliberately unpublished |
| 49 | abuse-enforcement-service | Acts on model scores about an account: labels it or its posts, challenges it, or suspends it | in-house | policy-engine | era: 2026 |
| 50 | safety-label-user-agg | "Labels an account for what its posts collected" | in-house | worker | era: 2026; aggregation job |
| 51 | Label storage | Labels are written by the labeling path and "read back on the request path" | not named | nosql-database | era: 2026 |
| 52 | under-the-hood | Daily jobs collecting the labels applied to an account and its posts, plus the serving layer that aggregates them for the user-facing transparency report | in-house | bi-service | era: 2026 |
| 53 | Ads blender | Reorders posts for ad adjacency and interleaves ads into the ranked list | in-house | third-party-api | era: both; "the default ads blender reorders posts for ad adjacency" |
| 54 | Side effects stage | After the response is sent: record which posts were served, refresh the post cache, log ad and client events | in-house | worker | era: 2026; async, post-response |
| 55 | pushservice | The Recommended Notifications surface, with its own light ranker and a multi-task heavy ranker predicting open and engagement probabilities | in-house | notification-service | era: 2023; shares the same models and features as For You |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | home-mixer | graphql/https | sync | | one For You request; ~5B/day, <1.5 s average |
| home-mixer | query-hydrators | in-process | sync | | 2026: user action sequence, following list, blocks and mutes, muted keywords, seen/served posts, followed topics |
| home-mixer | earlybird-root | thrift | sync | | 2023 in-network source, via TimelineRanker; ~50% of candidates |
| home-mixer | timelineranker | thrift | sync | | TLR truncates to the count Home Mixer asked for |
| timelineranker | earlybird-root | thrift | sync | | ranked in-network posts |
| timelineranker | uteg | thrift (Finagle) | sync | | "tweets liked by the users you follow" |
| timelineranker | social-graph-service | thrift | sync | | follow graph, blocked/muted state |
| timelineranker | tweetypie | thrift | sync | | hydrate posts for post-filtering |
| timelineranker | manhattan | rpc | sync | | hydrate features such as user languages |
| earlybird-root | earlybird-partition | thrift | sync | | fan-out to clusters and partitions, then merge |
| home-mixer | cr-mixer / tweet-mixer | thrift | sync | | 2023 / 2025 out-of-network coordination layer |
| cr-mixer | user-profile-service, real-graph store | rpc | sync | | source-signal extraction |
| cr-mixer | candidate generation services | rpc | sync | | results cached by CR-Mixer |
| home-mixer | uteg | thrift (Finagle) | sync | | GraphJet traversal candidates |
| home-mixer | frs | thrift | sync | | FutureGraph posts and Who-to-Follow modules |
| frs | ml prediction service | rpc | sync | | DataRecord per user-candidate pair, returns p(follow) blended with p(engagement\|follow) |
| home-mixer | navi (heavy ranker) | grpc | sync | | 2023; BatchPredictRequest over ONNX; ~1500 candidates scored |
| home-mixer | feature stores (RMS, RSX, GFS, USS, TSPS) | rpc | sync | | ~6000 features hydrated per ranking request, fetched in parallel |
| home-mixer | visibility-filtering | rpc | sync | | per post and viewer; answers allow / interstitial / drop |
| home-mixer | ads service | rpc | sync | | blending stage |
| home-mixer | client | graphql/https | sync | | ranked posts plus ads, Who-to-Follow, prompts, client instructions |
| home-mixer | thunder | rpc | sync | | 2026 in-network source; queried in parallel with the out-of-network sources |
| home-mixer | phoenix-retrieval | grpc | sync | | 2026; millions of posts narrowed to thousands |
| home-mixer | simclusters | rpc | sync | | 2026 second out-of-network source |
| home-mixer | phoenix-ranking | grpc | sync | | PhoenixScorer; one probability per action per candidate |
| home-mixer | vm-ranker | rpc | sync | | DPP diversity rerank after RankingScorer |
| home-mixer | label storage | rpc | sync | | via VFCandidateHydrator, feeding VFFilter |
| home-mixer | side-effect sinks | async | async | | after the response is sent: served-posts record, post-cache refresh, ad and client event logs |
| client + services | unified-user-actions kafka | kafka | async | not stated | real-time stream of all user actions |
| unified-user-actions | hdfs, gcp pubsub, gcs, bigquery | replication | async | not stated | "The Kafka stream is replicated to HDFS, GCP Pubsub, GCP GCS, GCP BigQuery" |
| event streams (fav, rt, follow, client_events) | recos-injector | kafka / event bus | async | not stated | filtered and combined |
| recos-injector | uteg (graphjet) kafka topic | kafka | async | not stated | each GraphJet service subscribes to a dedicated topic |
| post ingest kafka | index-ingester | kafka | async | not stated | |
| index-ingester | earlybird ingest kafka | kafka | async | not stated | intermediate topics Earlybird consumes |
| earlybird ingest kafka | earlybird-partition | kafka | async | not stated | incremental indexing; 1 s indexing latency |
| signal-ingester (heron) | earlybird-partition | feature update | async | not stated | live like/retweet/reply counts and spam signals |
| user-table-updater | earlybird-partition | feature update | async | not stated | sparse realtime per-user features |
| interaction data (bigquery, flock, dataflow) | real-graph job | batch | async | | daily aggregation plus a rollup job over yesterday's aggregate |
| real-graph job | real-graph store | batch write | async | | decayed-sum aggregates and the predicted interaction score |
| flock edges + real-graph weights | tweepcred job | hadoop | async | | iterative PageRank until convergence |
| tweepcred job | earlybird features | batch write | async | | tweepcred as a static ranking feature |
| follow graph | simclusters knownfor job | scalding / bigquery | async | | rebuild every three weeks over the top 20M producers |
| simclusters knownfor | interestedin / producer / topic embeddings | batch | async | | matrix multiply plus noise removal |
| favourite events | simclusters tweet-embedding job (storm) | streaming | async | not stated | post embedding updated on each favourite |
| simclusters tweet-embedding job | memcache | write | sync | | online embedding store |
| memcache | manhattan | persist | async | | PersistentTweetJob |
| graph data (follows, favourites, ad clicks) | twhin training | batch | async | | parquet lhs/rel/rhs triples |
| twhin / simclusters | representation-manager | rpc | sync | | embedding retrieval facade |
| user-signal-service + representation-manager | representation-scorer | rpc | sync | | pairwise and listwise similarity features |
| tweetypie | twemcache | memcached | sync | | caching repository wrapping Manhattan |
| tweetypie | manhattan | rpc | sync | | post data of record |
| post publish events | grox, media-model-proxy | rpc | async | not stated | 2026 content understanding, off the request path |
| clip | media-model-proxy | embeddings | async | | media embeddings the classifiers consume |
| account activity | agatha, bdsm, user-cred-v2 | batch | async | | offline account scoring |
| agatha / bdsm / user-cred-v2 | abuse-enforcement-service | rpc | async | | label, challenge or suspend on model score |
| events | scarecrow (botmaker) | event stream | async | not stated | rule matches apply a label |
| scarecrow / abuse-enforcement-service / safety-label-user-agg | label storage | write | async | | labels read back on the request path |
| label storage | visibility-filtering | read | sync | | rules read labels plus viewer relationship, settings and country |
| phoenix-rankall-strato | visibility-filtering | rpc | sync | | consulted before deciding which index a post belongs in |
| phoenix-rankall-strato | phoenix-rankall index | write | async | | event-driven index update |
| label jobs | under-the-hood | batch | async | | daily; aggregated for the user-facing report |
| home-mixer | conversation-service fallback pipeline | rpc | sync | | "backup reverse chron pipeline in case Scored Tweets fails" |

## Failure modes, incidents, tradeoffs the source discusses
- Ranking must degrade to chronology, not to nothing. Home Mixer configures `ForYouConversationServiceCandidatePipelineConfig` as the "backup reverse chron pipeline in case Scored Tweets fails" (home-mixer README). The whole personalised path is treated as optional.
- Compute is bought with parallelism, not cheapness. "A single pipeline execution requires 220 seconds of CPU time, nearly 150x the latency you perceive on the app" for a 1.5-second response (blog.x.com 2023). The 2026 framework calls out "parallel execution of independent stages" as a design decision.
- The cheap ranker rots. "the light ranker is an old part of the stack which we are currently in the process of replacing. The current model was last trained several years ago, and uses some very strange features" (earlybird light ranker README). A two-stage funnel leaves the cheap stage easy to neglect while the expensive stage is retrained continuously.
- Legacy fan-out removed, not patched. "We recently stopped using Fanout Service, a 12-year old service that was previously used to provide In-Network Tweets from a cache of Tweets for each user" (blog.x.com 2023) — precomputed per-user timelines replaced by query-time ranked retrieval from the search index.
- TimelineRanker kept its name after losing its job: "Despite its name, it no longer performs heavy ranking or model-based ranking itself" (timelineranker README). A stale indirection layer surviving between Home Mixer and the real sources.
- Heuristics sit *after* the model and can override it. Author diversity, content balance, feedback-based fatigue and social proof all rewrite the ranked order, and "Social Proof: Exclude Out-of-Network Tweets without a second degree connection to the Tweet as a quality safeguard" removes candidates the model liked (blog.x.com 2023).
- Batch-dependent scores are a bug the 2026 design engineers away: "During transformer inference, candidates cannot attend to each other—only to the viewer context. This ensures the score for a post doesn't depend on which other posts are in the batch, making scores consistent and cacheable" (xai-org README).
- Cold start for content: "Both retrieval and ranking use multiple hash functions for embedding lookup, so there is no vocabulary to maintain and a new post is representable immediately" (xai-org README). No dictionary service to keep in sync.
- Boot-time index building removed: "at every checkpoint save, the trainer runs the candidate tower over the configured corpus and stores the resulting index ... inside the checkpoint. Serving loads it from there — nothing embeds a corpus at boot time" (phoenix README).
- Safety must not be entangled with relevance: "Ranking decides the order. Visibility filtering decides whether a post can be shown at all. Different services, different inputs, different rules" (xai-org README). Filtering runs both before scoring (cheap predicates) and after selection (the expensive per-post rule evaluation), so the rule engine is only consulted for posts that survived.
- Filtering cascades through threads: `AncillaryVFFilter` removes "any post whose ancestor in the thread, quoted post or reposted post was itself dropped" (xai-org README). Dropping one post invalidates others.
- Rule evaluation short-circuits: "The first rule that answers drop ends the evaluation", and a further rule set "applies only when the post is a recommendation from an account the viewer does not follow, and those rules can only drop — spam caught at high recall ... The same post is allowed to a follower" (xai-org README). Precision is traded for recall differently depending on whether the viewer opted in.
- Deduplication is doubled deliberately: "`ThunderSource` is passed the list and leaves them out, the other sources are not, so their repeats are caught by the filters above" (xai-org README). One source filters at the source, the rest at the pipeline.
- Publishing the algorithm invites gaming, and the answer was partial: "there are a limited set of files not currently published in the repository, e.g.: Grox prompts ... Some botmaker rules" (xai-org README); the 2023 Visibility Filtering release said "part of the code has been removed and is not ready to be shared yet. ... code comments have been sanitized" (visibilitylib README).
- Published config drifts from production unless forced: "we run cron scripts that set the defaults in this repository's code to be the primary production values" (xai-org README).
- Published weights get misread: "The weights scale the predicted probabilities ... they do *not* scale the raw engagement counts, so e.g. it'd be incorrect to see that a report has 468 times higher weight than a like and conclude that e.g. '1 report cancels out 468 likes'" (xai-org README, 14 Aug 2026). The fix was comments in the code aimed at LLMs and people reading it.
- Legal rules become pipeline stages: `Brazil2026ElectionFilter` "removes posts from accounts reported to Brazil's Electoral Court for the 2026 election, unless the viewer explicitly follows the account" (xai-org README).
- Search indexing traded a sorting buffer for a new ID scheme: the old pipeline "added a buffer in our ingestion pipeline that stored all incoming Tweets for a few seconds, and sorted them"; removing it required assigning document IDs from creation timestamps in a 31-bit space, cutting indexing latency from ~15 s to 1 s (blog.x.com 2020).
- Bounded memory as a design choice: UTEG "maintains in-memory user engagements over the past 24-48 hours. Older events are dropped and GC'ed"; the 2026 `AgeFilter` bounds candidates at 48 hours.
- The ranking objective is explicitly steerable and has been steered: the Heavy Ranker's weights "can be adjusted at any time", were originally set "so that, on average, each weighted engagement probability contributes a near-equal amount to the score", and "Since then, we have periodically adjusted the weights to optimize for platform metrics" (recap README).

## Unknowns
- No source states regions, availability zones, replica counts, instance counts or a deployment topology for any component.
- No availability SLA, error budget or failure-rate number anywhere.
- Per-stage latency budgets: only the 1.5 s end-to-end figure and the 1 s indexing figure are given.
- Delivery guarantees on every Kafka hop are unstated; no source says at-least-once or exactly-once.
- 2026 candidate counts: the 1500-candidate figure is from 2023; the current README gives only "millions → 1000s" for retrieval and does not state K for `TopKScoreSelector`.
- Phoenix model size, training cadence and freshness are not stated (the 2023 Heavy Ranker was "continuously trained"; no equivalent claim for Phoenix).
- Where 2026 labels are stored — "storage" is drawn as an unnamed box.
- Whether Earlybird, Manhattan, Twemcache, TwHIN, Real Graph, Tweepcred, CR-Mixer/Tweet Mixer, UTEG, Navi and the Heavy Ranker still run at all after the Thunder/Phoenix migration. The 2026 README does not mention them; only SimClusters is named in both eras.
- Ads selection, the Who-to-Follow ranking path and the onboarding-prompt logic are explicitly excluded from both open-source releases.
- The `vm-ranker` DPP parameters, `home-mixer` param defaults other than the ranking weights, and the botmaker rules withheld for anti-gaming reasons.

## Candidates
- New kinds: none needed. Every box maps onto an existing kind. Candidates for a future `parameter-server`-style kind are absent here; the closest gap is a dedicated `recommender-pipeline` orchestrator kind, but `workflow-engine` + `app-server` covers Product Mixer / candidate-pipeline adequately for now.
- Kind sightings worth noting: `search-index` in a recommendation (not search) role as the primary in-network candidate source; `vector-database` realised as a checkpoint-embedded ANN index rather than a standalone store; `policy-engine` appearing three times in one design (visibility-filtering, scarecrow/botmaker, abuse-enforcement-service); `graph-database` as an in-memory, TTL-bounded engine (UTEG/GraphJet).
- New properties on existing kinds:
  - `search-index.indexingLatencyMs`, `search-index.retentionDays`, `search-index.tiers` (realtime / protected / archive), `search-index.writerModel` (single-writer-multi-reader)
  - `ml-inference.candidateIsolation` (boolean), `ml-inference.outputs` (multi-label action probabilities), `ml-inference.parameterCount`, `ml-inference.retraining` (continuous / periodic / stale)
  - `vector-database.indexBuild` (checkpoint-baked / online / batch), `vector-database.idScheme` (hashed / semantic-id / vocabulary)
  - `graph-database.inMemoryWindowHours`, `graph-database.evictionPolicy` (drop-oldest)
  - `policy-engine.evaluation` (first-match-wins), `policy-engine.actions` (allow / interstitial / drop / downrank)
  - `cache.role` (candidate-source) for Thunder, which is a cache doing a retrieval job
  - `app-server.fallbackPipeline` (the reverse-chron backup)
- New edge properties: `fanoutMerge` (boolean, for scatter-gather roots); `parallelGroup` (a name shared by edges the orchestrator issues concurrently, e.g. the candidate sources); `postResponse` (boolean, for side-effect edges that run after the response is sent); `consultedAtIndexTime` (boolean, for phoenix-rankall-strato -> visibility-filtering).
- New requirement paths: `latency.endToEndMs` with a companion `latency.cpuSecondsPerRequest`; `recommendation.candidateBudget`; `recommendation.sourceMix` (in-network vs out-of-network fraction); `governance.configPublished` (boolean); `compliance.jurisdictionRules` (list).
- New rules (name + one-line condition):
  - `ranking-pipeline-without-fallback`: an `ml-inference`-scored candidate pipeline feeding a user-facing surface with no alternative candidate pipeline declared
  - `safety-filter-before-ranking-only`: a `policy-engine` consulted only pre-scoring while the design also declares user-generated content and an out-of-network source (the expensive per-viewer rules must also run post-selection)
  - `ranking-entangled-with-visibility`: a single component declared both as the ranker and as the visibility authority
  - `candidate-source-without-dedup`: two or more candidate sources feeding one scorer with no dedup filter between them
  - `unbounded-candidate-age`: a candidate source with no max-age filter while the design declares a freshness requirement
  - `in-memory-graph-without-ttl`: `graph-database` with `inMemoryWindowHours` unset while it is fed by an unbounded event stream
  - `feature-hydration-not-parallel`: more than N feature-store edges from one orchestrator without a shared `parallelGroup` while `latency.endToEndMs` is set
  - `batch-dependent-scoring`: `ml-inference` scoring a batch of candidates with `candidateIsolation` false while results are cached
  - `stale-first-stage-ranker`: a two-stage funnel where the cheap ranker's `retraining` is stale and the expensive one's is continuous
