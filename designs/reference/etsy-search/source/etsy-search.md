# Intake: Etsy search and serving architecture

## Source
- Primary: https://www.etsy.com/codeascraft/bringing-personalized-search-to-etsy (Lucia Yu, Etsy search engineer, Code as Craft, 2020 — "Etsy Search Architecture": the two-pass retrieval/ranking pipeline)
- Primary: https://www.etsy.com/codeascraft/how-etsy-prepared-for-historic-volumes-of-holiday-traffic-in-2020 (Mike Adler, Etsy engineering, Code as Craft, 2021 — peak throughput of MySQL / Memcache / internal API, scale-day load testing)
- Primary: https://www.etsy.com/codeascraft/deploying-to-google-kubernetes-engine/ (Etsy search deploy team, Code as Craft, 2018 — names the deployed search services and the GKE clusters)
- Primary: https://www.etsy.com/codeascraft/deep-learning-for-search-ranking-at-etsy (Lucia Yu, Congzhe Su, Cung Tran, Robert Forgione, Etsy search ranking, Code as Craft, 2022 — the two ranking layers, GBDT → TF Ranking migration)
- Primary: https://www.etsy.com/codeascraft/how-etsy-uses-llms-to-improve-search-relevance (Etsy Search Relevance team, Code as Craft, 2026 — semantic relevance models inside the real-time search stack)
- Primary: https://www.etsy.com/codeascraft/migrating-etsyas-database-sharding-to-vitess (Ella Yarmo-Gray, Etsy database engineer, Code as Craft, 2026 — 1,000-shard MySQL, index-database SPOF, Vitess vindexes)
- Primary: https://www.etsy.com/codeascraft/how-etsy-caches/ (Kevin Gessner, Etsy, Code as Craft, 2017 — memcached + Varnish tiers, Ketama, cache smearing)
- Primary: https://www.etsy.com/codeascraft/adding-zonal-resiliency-to-etsys-kafka-cluster-part-1 (Andrey Polyakov, Kamya Shethia, Etsy, Code as Craft, 2023 — Kafka on GKE feeding search indexing)
- Primary: https://www.etsy.com/codeascraft/solr-bittorrent-index-replication/ (David Giffin, Etsy, Code as Craft, 2012 — Solr primary/replica index distribution)
- Primary: https://www.etsy.com/codeascraft/juggling-multiple-elasticsearch-instances-on-a-single-host/ (Shikhar Bhushan, Etsy, Code as Craft, 2014 — Elasticsearch fleet layout)
- Primary: https://www.etsy.com/codeascraft/selecting-a-cloud-provider/ (Mike Fisher, Etsy CTO, Code as Craft, 2018 — "production render path" and "the site's search services" as the migration units)
- Primary: https://www.etsy.com/codeascraft/barista-enabling-greater-flexibility-in-machine-learning-model-deployment (Kyle Gallatin, Rahul Dharani, Rob Miles, Etsy ML Model Serving team, Code as Craft, 2023 — model serving control plane for Search)
- Primary: https://www.etsy.com/codeascraft/mctop-a-tool-for-analyzing-memcache-get-traffic/ (Marcus Barczak, Etsy ops, Code as Craft, 2012 — hot-key saturation incident)
- Primary: https://www.etsy.com/codeascraft/frank-talk-about-site-outages (John Allspaw, VP Operations, Etsy, Code as Craft, 2010 — metrics, alerting, time-to-detect, SPOF reduction)
- Secondary: https://www.infoq.com/news/2026/04/etsy-vitess-sharding-migration/ (InfoQ news write-up of the Vitess post, 2026 — corroborates the shard numbers, adds migration duration)
- Verified by: Etsy's own engineering blog, Code as Craft (14 posts by named Etsy engineers, fetched and read in full) + InfoQ secondary
- Confidence: high
- Date of source: 2010–2026 (architecture core: 2017–2026)

Fetch note: `www.etsy.com` answers 403 to automated fetchers; every post above was
retrieved through the Internet Archive raw endpoint and the extracted bodies are stored in
`work/research/etsy-search/fetched/`. See `work/research/etsy-search/verify.md`.

## System in three lines
Etsy is a marketplace of ~85M hand-made and vintage listings from ~5M sellers, where almost
every listing is a one-of-a-kind item, so search — not browse — is the main way buyers find
anything. Search is a two-pass service (candidate retrieval over a Lucene index, then an
expensive personalised ranking pass) deployed as Java/Scala services on GKE, fed by Kafka
streaming indexers, and hanging off a PHP render path backed by ~1,000 MySQL shards,
memcached and Varnish. It is hard because the inventory is unique and un-categorisable, the
ranking pass is per-user (which destroys the ranking cache), and traffic is violently
seasonal — Cyber Monday is the busiest day of the year.

## Scale (only if stated)
- Users: 81 million active buyers, over 85 million items for sale as of 2020 Q4 — https://www.etsy.com/codeascraft/how-etsy-prepared-for-historic-volumes-of-holiday-traffic-in-2020
- Sellers / listings (2020): 3.7 million sellers, more than 80 million listings — https://www.etsy.com/codeascraft/bringing-personalized-search-to-etsy
- Sharded MySQL: peaked around **1.5 million queries per second** on Cyber Monday 2020 — https://www.etsy.com/codeascraft/how-etsy-prepared-for-historic-volumes-of-holiday-traffic-in-2020
- Sharded MySQL (2026): ~1,000 tables across ~1,000 shards, **over 425 TB**, roughly **1.7 million requests per second** — https://www.etsy.com/codeascraft/migrating-etsyas-database-sharding-to-vitess
- Memcache: peaked **over 20M requests per second**; caching clusters store terabytes and handle millions of lookups per second — https://www.etsy.com/codeascraft/how-etsy-prepared-for-historic-volumes-of-holiday-traffic-in-2020 and https://www.etsy.com/codeascraft/how-etsy-caches/
- Internal http API cluster: **over 300k requests per second** at peak — https://www.etsy.com/codeascraft/how-etsy-prepared-for-historic-volumes-of-holiday-traffic-in-2020
- Deploy fleet: a full compile "in production, on more than 1000 hosts" — https://www.etsy.com/codeascraft/how-etsy-prepared-for-historic-volumes-of-holiday-traffic-in-2020
- Candidate retrieval: selects "the top one thousand items for a query" from millions, i.e. ranking runs over "less than one percent of all listings" — https://www.etsy.com/codeascraft/bringing-personalized-search-to-etsy
- Search index size (2012): grew from 2 GB to over 28 GB in two years; 11 search replicas; 4 GB optimized listings index took over an hour to replicate over HTTP — https://www.etsy.com/codeascraft/solr-bittorrent-index-replication/
- Semantic relevance student model adds **<10 ms** latency; teacher labels "millions of query-listing pairs daily" — https://www.etsy.com/codeascraft/how-etsy-uses-llms-to-improve-search-relevance
- Search GKE namespace quota (2018): 180 requests.cpu and 200Gi requests.memory per namespace, two namespaces — https://www.etsy.com/codeascraft/deploying-to-google-kubernetes-engine/
- Elasticsearch hosts (2014): 20 physical / 40 virtual cores, 128 GB RAM, SSDs; 4 ES JVMs per machine at 8 GB heap each — https://www.etsy.com/codeascraft/juggling-multiple-elasticsearch-instances-on-a-single-host/
- Observability (2010): "a little over 30,000 metrics", some sampled every 20 seconds, ~2,000 of which page an on-call engineer — https://www.etsy.com/codeascraft/frank-talk-about-site-outages

## Requirements stated or clearly implied
- Availability target: no SLA number is published. Stated posture is zonal resilience inside one GCP region — Kafka brokers spread across three zones so "in the event of an outage of any one zone, two out of three partition replicas are still available"; a regional GKE cluster; Regional Persistent Disks in the earlier design. Region loss is not discussed. Shard-level blast radius is explicit: "we only lost 1/1000 of traffic to the distributed database if a shard went down."
- Consistency: MySQL transactional per shard; "atomicity is only guaranteed per connection", which forced tables written in one transaction to be migrated to Vitess together. Caches are look-aside and therefore eventually consistent; cache smearing is explicitly acknowledged as able to "lead to data inconsistencies if a single user sees smeared values that are out-of-sync between multiple requests". Search results are eventually consistent with the marketplace — a Kafka outage yields "stale search results".
- Latency target: not quantified as an SLO. The two-pass split exists "to ensure that we are returning low-latency results -- a crucial component of a good search system"; the semantic relevance student model was distilled specifically so it costs "<10ms additional latency"; the ensemble ranker was rejected partly for "added latency"; memcache p90 get latency is treated as an incident signal at 35 ms.
- Ordering needs: per-partition ordering in Kafka implied by `broker.rack`-aware replica placement; not stated as a product requirement.
- Replay or reprocessing needs: Kafka consumers "would have to spend time processing the backlog" after an outage; the Franz producer holds an in-memory buffer with unlimited retries. Offline relevance evaluation replays sampled search requests daily through the teacher model.
- Retention: not stated for Kafka or for search logs. Personalization uses "recent or lifetime look back windows" over interaction history.
- Compliance / residency: not stated. The personalization post states only that "Personalization should take into account users' privacy choices".

## Boundaries
- Regions / zones: single named cloud — Google Cloud Platform, chosen in 2018 after Etsy ran self-managed data centers from 2005. GKE regional cluster; Kafka brokers pinned across zones "a", "b", "c" via Pod Topology Spread Constraints and `broker.rack`. No multi-region story is published.
- Migration boundary: for a period, services lived "in two places at once (on-premises and in the cloud)" — a pair of Kubernetes clusters, one on-prem and one GKE.
- Trust zones: public buyers/sellers → web + API tier ("production render path") → internal http API cluster behind Varnish → data tier (MySQL shards, memcached) and search tier. Deploys cross a separate control boundary: Deployinator → Jenkins holding a secret Kubernetes token → GCP service accounts with a minimal custom IAM role plus Kubernetes RBAC.
- Named subsystems / bounded contexts: "the production render path for the site", "the site's search services", search candidate retrieval (first pass), search ranking (second pass, itself two ranking layers), Search/Ads/Recs ML, the ML platform (Barista), the Kafka streaming platform, the sharded MySQL cluster.
- Named search deployments: Kubernetes namespaces `search-flip` and `search-flop` (blue/green pair) in the production search GKE cluster; deployed services `spell_correction`, `mixer`, `listings_search`.

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Buyers on web, mobile web and mobile app | Issue search queries; personalization features are gathered "across our mobile web, desktop and mobile application platforms" | not stated | client | platforms: web, mobile-web, mobile-app |
| 2 | Web / API tier ("production render path") | PHP application that renders the site and calls search, MySQL and memcached | PHP (cache reads are "from PHP and Java") | app-server | hosts: >1000 at 2020 peak; full compile on deploy |
| 3 | Internal http API cluster | Server-to-server API tier between Etsy applications | not stated | app-server | rps: >300000 at 2020 peak |
| 4 | Varnish | HTTP cache for internal API-to-API requests; key built from URL, query params and `Vary` headers (locale is in the key) | Varnish | cache | keyed by: url + query + Vary headers; hot keys smeared via an extra query parameter |
| 5 | memcached pools | Look-aside cache for "database and search index query results, expensive calculations" | memcached | cache | consistent hashing: Ketama; pools functionally partitioned; terabytes stored; rps: >20e6 at peak; hot-key mitigation: cache smearing with 3–4 bits of entropy |
| 6 | Sharded MySQL cluster | Primary online datastore for the marketplace | MySQL | sql-database | shards: ~1000; tables: ~1000; size: 425 TB; rps: ~1.7e6; shardifier id = shop_id or user_id (30+ options in use); shard loss = 1/1000 of traffic |
| 7 | Index database | Legacy unsharded lookup table mapping record id → shard, consulted by the ORM before every sharded query | MySQL (in-house schema) | sql-database | unsharded; single point of failure; retired by the Vitess migration |
| 8 | Vitess | Sharding/abstraction layer; the ORM now queries Vitess, which queries MySQL and computes the shard | Vitess | database-proxy | custom SQLite lookup vindex + hash vindex behind a custom hybrid vindex with an id threshold; requires the shardifier id in the WHERE clause |
| 9 | SQLite shard-map | Read-only copy of the legacy shard mappings copied onto each Vitess server to avoid a remote lookup | SQLite | sql-database | read-only; co-located on each Vitess server; "low latency reads and a small enough footprint" |
| 10 | Search application (first pass) — `listings_search` | Candidate set retrieval: selects the top ~1,000 listings for a query from millions using tags, titles and other seller-provided attributes | Java/Scala on Lucene-family index (Solr named in 2012; Elasticsearch named for "user-facing search on some large indexes" in 2014) | search-index | candidates: 1000 per query; scans "less than one percent of all listings"; matched fields: tags, titles, seller attributes |
| 11 | `mixer` | Search service deployed alongside retrieval and spell correction in the search Kubernetes namespaces; role not described | in-house | app-server | deployed to `search-flip`/`search-flop` |
| 12 | `spell_correction` | Query spelling correction service in the search deployment | in-house | app-server | deployed to `search-flip`/`search-flop` |
| 13 | Search ranking (second pass) | Expensive re-ranking of the retrieved candidates; "Etsy search is composed of two ranking layers" and the DNN work targets the second-pass layer | GBDT (pairwise) originally; then a unified DNN built on TF Ranking / TensorFlow | ml-inference | ranks 1000 candidates/query; ranked results cached per query; personalization adds 24 contextual user vectors + historical features |
| 14 | Semantic relevance student model | Two-tower BERT relevance classifier embedded in the real-time search stack for filtering, feature enrichment, loss weighting and boosting | BERT two-tower (distilled from a fine-tuned Qwen 3 VL 4B teacher) | ml-inference | added latency: <10 ms; classes: relevant / partially relevant / irrelevant |
| 15 | LLM annotator / teacher (offline) | Generates relevance labels at scale for training and for daily offline evaluation of live search | OpenAI o3 in LangGraph (annotator); Qwen 3 VL 4B (teacher) served with vLLM | ai-service | few-shot chain-of-thought + self-consistency sampling; millions of query-listing pairs labelled daily |
| 16 | Barista | ML model serving control plane: creates the Kubernetes Deployment/Service/Ingress/HPA for every served model, including Search models | in-house Python + Flask on the Kubernetes Python API | ml-platform | hundreds of model configs; audit log of production changes; HPA per model |
| 17 | CloudSQL config store | Backs Barista's model-deployment CRUD API and audit log | Google CloudSQL | sql-database | stores live model config + audit log |
| 18 | Search index build / indexers | Streaming applications that "power critical user-facing features, like search indexing" | not stated (runs on GKE as Kafka clients) | stream-processor | outage consequence: stale search results |
| 19 | Kafka cluster | Event backbone carrying the streams that feed search indexing | Apache Kafka on GKE | stream | replication factor 3 on all topics; `broker.rack` set from the zone; Pod Topology Spread Constraints by `topology.kubernetes.io/zone`; originally single-zone with Regional PDs |
| 20 | Franz | Etsy's primary Kafka producer | Franz (in-house) | worker | in-memory buffer; unlimited retries |
| 21 | ZooKeeper | Kafka coordination; one of "a few critically important components" already run in multiple zones | Apache ZooKeeper | coordination-service | multi-zone even in the single-zone Kafka design |
| 22 | Solr primary + replicas (2012 topology) | Index build on the primary, read-only replicas serve production search traffic | Apache Solr / Lucene | search-index | primary/replica; nightly index optimize creating a full new copy; 11 replicas; indexes 2 GB → 28 GB |
| 23 | BitTorrent index replication | Replaces Solr HTTP replication: primary hashes the index into a torrent, replicas download and then seed it | ttorrent (Etsy fork), herd/BitTornado, pigz | worker | replication of the largest index cut from 60 min to 6 min; replicas seed to each other; ".part" files allow resume |
| 24 | Elasticsearch clusters | Used for Logstash, "powering user-facing search on some large indexes", analytics, and many internal applications | Elasticsearch (on Lucene) | search-index | bare metal; 4 JVMs per host at 8 GB heap; `cluster.routing.allocation.awareness.attributes: host` so replicas never land on the same physical host |
| 25 | GKE search clusters | Run the search services; an on-prem Kubernetes cluster ran the same services during migration | Google Kubernetes Engine (+ on-prem Kubernetes) | container-orchestrator | namespaces `search-flip` / `search-flop`, each quota'd at 180 CPU / 200Gi; regional cluster; provisioned by Terraform, RBAC templated with Helm |
| 26 | Deployinator + Jenkins | Deploy control plane: button-driven Deployinator calls a Jenkins pipeline that runs docker build/tag/push and `kubectl apply` per search service, in parallel | Deployinator, Jenkins | ci-pipeline | secret k8s token held as a Jenkins credential; parallel deploy of spell_correction, mixer, listings_search |
| 27 | Metrics / StatsD relays | Metrics collection and alerting for the whole estate | StatsD (relays named), Gomez for external probing | monitoring | ~30,000 metrics, some every 20 s; ~2,000 alert an on-call engineer; average time-to-detect ~2 minutes |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| buyer client | web/API tier (production render path) | https | sync | | search query from web, mobile web or app |
| web/API tier | internal http API cluster | http via Varnish | sync | | >300k rps at peak; responses cached in Varnish keyed on url + query + Vary |
| internal API server | Varnish | http | sync | | on miss Varnish "forwards the request to a downstream server, then caches and returns the response" |
| web/API tier (PHP) | memcached | memcached | sync | | look-aside; Ketama consistent hashing; hot keys smeared across several keys |
| search services (Java) | memcached | memcached | sync | | "search index query results" are cached; ranked results cached per query |
| web/API tier | ORM → Vitess | mysql protocol | sync | | pre-2018 the ORM went straight to a shard; now every query goes to Vitess |
| ORM | index database | sql | sync | | legacy path: look up record→shard mapping before every sharded query; retired |
| Vitess | SQLite shard-map (local file) | local read | sync | | ids below the threshold; avoids "the latency and dependency added by a call to an external database" |
| Vitess | MySQL shard | mysql protocol | sync | | routed by vindex on the shardifier id present in the WHERE clause |
| web/API tier | search application | not stated | sync | | the search request path |
| search application | `listings_search` (candidate retrieval) | not stated | sync | | returns top ~1,000 listings per query |
| `listings_search` | ranking (second pass) | not stated | sync | | candidate set handed to the ranker |
| search application | `spell_correction` | not stated | sync | | co-deployed search service |
| search application | `mixer` | not stated | sync | | co-deployed search service |
| ranking layer | semantic relevance student model | not stated | sync | | four integration points: filter irrelevant candidates before ranking, feed relevance score as a ranking feature, weight training loss, boost highly relevant results |
| ranking layer | personalization features (user historical + 24 contextual vectors) | not stated | sync | | similarity computed per user × query pair, so results cannot be cached per query alone |
| producers (Franz) | Kafka | kafka | async | in-memory buffer + unlimited retries on the producer | "producers would have nowhere to send their data" if the cluster is down |
| Kafka | search-indexing streaming applications | kafka | async | RF=3 across three zones | consumers must "spend time processing the backlog" after an outage |
| search-indexing streaming applications | search index | not stated | async | | outage ⇒ "stale search results" |
| Solr primary | Solr replicas | http (legacy) | async | | 2–8 MB/s; replication time grows linearly with replica count |
| Solr primary | Solr replicas | BitTorrent | async | hash-verified against the torrent file | primary hashes index, loads torrent into tracker on the primary, notifies replicas; replicas download missing pieces then seed; commit brings the new index online |
| Solr replica | Solr replica | BitTorrent | async | | replicas seed each other, so new/stale replicas fill fast |
| Barista | Kubernetes API (GKE) | k8s API (Python client) | sync | | CRUD on Deployment/Service/Ingress/HPA per model |
| Barista API | CloudSQL | sql | sync | | live config + audit log |
| Deployinator | Jenkins pipeline | http | sync | | one pipeline stage per search service, run in parallel |
| Jenkins | GKE / on-prem Kubernetes | kubectl with secret token / GCP service account | sync | | minimal custom IAM role + Kubernetes RBAC RoleBinding per namespace |
| Terraform | GCP project + GKE cluster | GCP API | sync | | followed by a provisioner that applies the Helm chart of Namespaces/ClusterRoles/RoleBindings |
| all services | StatsD relays / metrics | statsd | async | | a scale-day bottleneck in 2020 |
| Gomez probes | etsy.com | https | sync | | external synthetic probes every minute from thousands of machines |

## Failure modes, incidents, tradeoffs the source discusses
- **The shard index database was a whole-site single point of failure.** "If the index database went down, it could cause a full site outage since the ORM would no longer be able to route queries to any shard." Incidents increased as it grew; removing it was the driver for the Vitess migration. — https://www.etsy.com/codeascraft/migrating-etsyas-database-sharding-to-vitess
- **Sharding bounds the blast radius the other way:** "we only lost 1/1000 of traffic to the distributed database if a shard went down." Cost: horizontal scaling was "manual, complex, and took months". — same source
- **Transaction atomicity broke during the migration.** Vitess presents the shards as one database, changing the connection model, and "atomicity is only guaranteed per connection", so tables written inside a single transaction had to be ramped onto vindexes simultaneously. — same source
- **Memcache hot keys saturate a single NIC.** A single key hit "once for every page view" pushed one memcached host to ~960 Mbps on a 1 Gbps NIC; "as we began to push past 800Mbps outbound, 90th percentile get request latency jumped from 5ms to 35ms. Once the NIC was saturated latency spiked to over 200ms." Adding cache hosts does not help — "at best, it would only move the problem key and saturate a different host." Mitigation is cache smearing: append a few bits of entropy to hot keys so one key becomes several. The stated tradeoff: smearing "can lead to data inconsistencies if a single user sees smeared values that are out-of-sync between multiple requests." — https://www.etsy.com/codeascraft/mctop-a-tool-for-analyzing-memcache-get-traffic/ and https://www.etsy.com/codeascraft/how-etsy-caches/
- **Modulo hashing is not survivable at pool-size change:** going from 4 to 5 cache hosts leaves "only 20% of cache keys… on the same host as before"; Ketama consistent hashing raises that to 50% and is what Etsy runs. — https://www.etsy.com/codeascraft/how-etsy-caches/
- **Personalization destroys the ranking cache.** "Typically we rank items in the second pass in real-time and rely on caching to save ordered rankings per query to reduce latency in online serving. But because personalized results are specific to individual users, we have to rank listings for every user and query pair. Cache utilization decreases… which can impact the user experience." — https://www.etsy.com/codeascraft/bringing-personalized-search-to-etsy
- **Index replication time scaled linearly with replica count.** "The fundamental limitation with HTTP replication is that replication time increases linearly with the number of replicas… If 10 boxes take 4 hours, scaling to 40 boxes would take over half a day!" Solved with BitTorrent (largest index 60 min → 6 min). — https://www.etsy.com/codeascraft/solr-bittorrent-index-replication/
- **A replication experiment took the whole site down.** "Multicast rsync caused an epic failure for our network, killing the entire site for several minutes. The multicast traffic saturated the CPU on our core switches causing all of Etsy to be unreachable." — same source
- **Single-zone Kafka became unacceptable as search depended on it.** "The consequences of a Kafka outage had grown, for example resulting in stale search results." The original single-zone design existed because "inter-zone network costs in Google Cloud can add up surprisingly quickly, even exceeding the costs of VMs and storage"; the failover plan was a runbook asking "a possibly sleepy human" to relocate brokers. Fixed by three-zone brokers with `broker.rack` and RF=3, at which point regional persistent disks became unnecessary. — https://www.etsy.com/codeascraft/adding-zonal-resiliency-to-etsys-kafka-cluster-part-1
- **Replica rebuild was too slow to use as a migration tool:** deleting and recreating each broker disk and letting Kafka re-replicate "would take an unacceptably long time, on the order of weeks" — disk snapshots were used instead. — same source
- **Ensemble ranking was rejected on serving grounds, not modelling grounds.** "The design of Etsy's search application itself was a roadblock. We would have to build support for inferencing multiple models in parallel"; the ensemble also meant "extra inference latency", double the feature work and two end-to-end pipelines, "adding cost and introducing instability to the system." — https://www.etsy.com/codeascraft/deep-learning-for-search-ranking-at-etsy
- **Relevance and engagement can move in opposite directions:** "In online experiments, we often observe engagement metrics decline even as semantic relevance improves." Engagement signals are themselves biased — "popular listings get more clicks, even when they're not the best match for a specific query." — https://www.etsy.com/codeascraft/how-etsy-uses-llms-to-improve-search-relevance
- **Relevance models are sized by a latency budget**, not accuracy alone: the accurate teacher "is too slow to surface relevant search results quickly", so it is distilled into a student costing "<10ms additional latency".
- **Peak-season posture is procedural, not just technical.** Etsy runs "Slush", a partial change freeze: "we discourage, for a few weeks, deploying changes that might be expected to disrupt sellers, support, or infrastructure." Capacity is pre-negotiated — projections are sent to GCP "many weeks ahead of time", with a hard deadline to "request quota increases from GCP for their projects by early September". — https://www.etsy.com/codeascraft/how-etsy-prepared-for-historic-volumes-of-holiday-traffic-in-2020
- **Site-wide synthetic load testing is treated as low-yield.** "When you take a very complex system and make it safe to test at scale, you're often looking at something quite different from normal operation in production. We usually get the most learning per effort by testing discrete components of our site, such as we do with search." The 2020 exception — a 3x scale day using replayed requests on top of production traffic — still "exposed bottlenecks in the configuration of some components, for example some Memcache clusters and our StatsD relays". — same source
- **Architectural bias toward a small toolset:** "Our approach to systems architecture values long-term continuity, with a focus on a small number of well-understood tools." — same source
- **Elasticsearch replica placement must be host-aware** when packing several JVMs per box: "it's entirely possible to automatically allocate all replicas for a shard to the same host, which isn't going to help you!" — https://www.etsy.com/codeascraft/juggling-multiple-elasticsearch-instances-on-a-single-host/
- **Deploy-time privilege is scoped deliberately:** GCP service accounts can only be granted "complete read/write access to all GKE clusters within the same project", so Etsy grants a minimal custom IAM role and layers Kubernetes RBAC on top — "a deployer doesn't need the ability to delete Kubernetes services—only to create or update them." — https://www.etsy.com/codeascraft/deploying-to-google-kubernetes-engine/
- **Operational baseline:** ~30,000 metrics, ~2,000 of them paging, average time-to-detect "on the order of 2 minutes"; blameless post-mortems and an explicit SPOF-reduction programme. — https://www.etsy.com/codeascraft/frank-talk-about-site-outages

## Unknowns
- The protocol between the PHP render path and the search services is never named (Thrift appears only in third-party slide decks, not in any post fetched here).
- What `mixer` actually does. It is deployed next to `listings_search` and `spell_correction` but its role is never described.
- Which engine backs first-pass listing retrieval **today**. Solr/Lucene is named in 2012, Elasticsearch is named in 2014 as "powering user-facing search on some large indexes", and 2018 refers to "a Java and Scala application"; no fetched post states the current retrieval engine.
- Envoy and service-mesh adoption. The only Etsy post that names Envoy could not be retrieved (403 with no usable archive snapshot), so no mesh component is asserted here.
- Index freshness: how long between a listing change and it being searchable, and whether search indexing is near-real-time or batch. Only the failure symptom ("stale search results") is stated.
- Kafka topic count, partition counts, retention, and consumer-group layout.
- Whether search runs in more than one GCP region, and what happens on region loss.
- Vector/embedding retrieval: embeddings are described as ranking features and as listing representations, but no ANN/vector index component is named.
- Availability and latency SLOs, error budgets, and any published p99 for the search path.
- CDN and edge: no post fetched here names a CDN, WAF, DDoS or DNS provider for etsy.com.
- Memcached pool count and per-pool sizing; Varnish fleet size.
- How the second-pass ranker obtains per-user features at request time (feature store, cache, or online computation) is not described.

## Candidates
- New kinds: none required — every box maps to an existing kind id.
- New properties on existing kinds:
  - `cache.hashing` (modulo | consistent-ketama | rendezvous) and `cache.hotKeyMitigation` (none | smearing | replication) — both are first-class design decisions in the Etsy cache posts.
  - `cache.pattern` (look-aside | read-through | http-proxy) to distinguish memcached from Varnish.
  - `cache.keyedBy` for HTTP caches (url + query + vary headers).
  - `search-index.passes` (single | two-pass) and `search-index.candidateCount`.
  - `search-index.replicationTransport` (http-pull | peer-to-peer | segment-copy) and `search-index.optimizeSchedule`.
  - `search-index.allocationAwareness` (the ES `awareness.attributes` idea: replicas must not share a failure domain).
  - `search-index.instancesPerHost` (JVM packing).
  - `sql-database.shardCount`, `sql-database.shardKey`, `sql-database.shardMapStore` (external-index | algorithmic-vindex | co-located).
  - `database-proxy.routingStrategy` (lookup-table | hash | hybrid).
  - `stream.rackAware` (boolean, from `broker.rack`) and `stream.zoneSpread` (integer).
  - `worker.producerBuffer` (none | bounded | unbounded-retry) for Franz-style producers.
  - `ml-inference.addedLatencyMs` and `ml-inference.distilledFrom`.
- New requirement paths:
  - `availability.zones` (integer) and `availability.zoneLossSurvivable` (boolean) — the Kafka post turns entirely on this.
  - `cost.interZoneTrafficSensitive` (boolean) — Etsy's original single-zone Kafka existed purely for this.
  - `change.freezeWindow` (Slush) — a seasonal operating requirement.
  - `capacity.preNegotiatedQuota` (boolean) — GCP quota requests as a hard dependency with a deadline.
  - `search.personalized` (boolean) — because it invalidates per-query result caching.
- New rules (name + one-line condition):
  - `shard-map-single-point-of-failure`: a sharded sql-database whose shard map lives in an unsharded store that every query must read first.
  - `cache-modulo-hashing-on-elastic-pool`: cache with `hashing: modulo` while the pool is autoscaled or resized.
  - `hot-key-without-smearing`: cache fronting a high-fanout read path with no hot-key mitigation declared.
  - `personalized-ranking-behind-query-cache`: a cache keyed by query alone in front of a per-user ranking stage.
  - `index-replication-linear-in-replicas`: search-index with `replicationTransport: http-pull` and replica count above a threshold.
  - `search-replica-colocated-with-its-primary`: search-index replicas with no allocation awareness while several instances share a host.
  - `single-zone-stream-feeding-user-facing-path`: a stream with `zoneSpread: 1` whose consumers feed a user-facing index.
  - `unbounded-producer-buffer-as-outage-hedge`: a worker producing to a stream with unbounded in-memory retry and no downstream durable spill.
  - `sync-inference-without-latency-budget`: an ml-inference node on a sync request path with no `addedLatencyMs` declared.
  - `deployer-identity-over-privileged`: a ci-pipeline identity granted project-wide write on a container-orchestrator rather than a namespace-scoped role.

## Verification 2026-09-14

`www.etsy.com` still answers **HTTP 403** to every automated fetcher, and WebFetch is blocked
from `web.archive.org`, so none of the primary URLs could be re-fetched live today. Step 1 was
carried out against the archived bodies captured on 2026-09-07 and stored in
`work/research/etsy-search/fetched/`; every fact used in `design.yaml` was re-read there.

| url | reachable 2026-09-14 | outcome |
|---|---|---|
| https://www.etsy.com/codeascraft/how-etsy-prepared-for-historic-volumes-of-holiday-traffic-in-2020 | no (403) | re-read in `fetched/holiday2020.txt`; "1.5 million queries per second", "over 20M requests per second", "over 300k requests per second" confirmed verbatim |
| https://www.etsy.com/codeascraft/migrating-etsyas-database-sharding-to-vitess | no (403) | re-read in `fetched/vitess.txt`; "~1,000 tables distributed across ~1,000 shards", "over 425 TB", "roughly 1.7 million requests per second", the index-database SPOF, the SQLite lookup vindex and the hybrid vindex threshold confirmed verbatim |
| https://www.etsy.com/codeascraft/bringing-personalized-search-to-etsy | no (403) | re-read in `fetched/persearch.txt`; "the top one thousand items for a query" and the per-query ranking cache confirmed verbatim |
| https://www.etsy.com/codeascraft/how-etsy-uses-llms-to-improve-search-relevance | no (403) | re-read in `fetched/llm.txt`; "only <10ms additional latency" confirmed verbatim |
| https://www.etsy.com/codeascraft/adding-zonal-resiliency-to-etsys-kafka-cluster-part-1 | no (403) | re-read in `fetched/kafka1.txt`; single-zone origin, `broker.rack`, "two out of three partition replicas are still available", multi-zone ZooKeeper and Franz's "in-memory buffer and unlimited retries" confirmed verbatim |
| https://www.etsy.com/codeascraft/how-etsy-caches/ | no (403) | re-read in `fetched/caches.txt`; Ketama, look-aside memcached for database and search index query results, Varnish for internal API traffic, cache smearing confirmed |
| https://www.etsy.com/codeascraft/mctop-a-tool-for-analyzing-memcache-get-traffic/ | no (403) | re-read in `fetched/mctop.txt`; hot-key NIC saturation and the 5 → 35 → 200 ms latency steps confirmed |
| https://www.etsy.com/codeascraft/solr-bittorrent-index-replication/ | no (403) | re-read in `fetched/solrbt.txt`; Solr primary/replica, nightly optimize, 11 replicas, 60 min → 6 min confirmed |
| https://www.etsy.com/codeascraft/deploying-to-google-kubernetes-engine/ | no (403) | re-read in `fetched/k8s.txt`; `spell_correction`, `mixer`, `listings_search`, `search-flip`/`search-flop`, Deployinator → Jenkins → `kubectl apply` confirmed |
| https://www.etsy.com/codeascraft/deep-learning-for-search-ranking-at-etsy | no (403) | re-read in `fetched/dlrank.txt`; "two ranking layers" and the TF Ranking second pass confirmed |
| https://www.etsy.com/codeascraft/juggling-multiple-elasticsearch-instances-on-a-single-host/ | no (403) | re-read in `fetched/es.txt`; Elasticsearch fleet layout confirmed, but nothing ties it to first-pass listing retrieval, so it is not encoded |
| https://www.etsy.com/codeascraft/barista-enabling-greater-flexibility-in-machine-learning-model-deployment | no (403) | re-read in `fetched/barista.txt`; Barista confirmed, but left out of the design (no generic `ml-platform` component, and it is a control plane, not the serving path) |
| https://www.etsy.com/codeascraft/selecting-a-cloud-provider/ | no (403) | re-read in `fetched/cloudsel.txt`; GCP, "production render path", "the site's search services" confirmed |
| https://www.etsy.com/codeascraft/frank-talk-about-site-outages | no (403) | re-read in `fetched/outages.txt`; ~30,000 metrics, ~2,000 paging, ~2 minute time-to-detect confirmed |
| https://www.infoq.com/news/2026/04/etsy-vitess-sharding-migration/ | not re-fetched | secondary only; nothing in the design depends on it |

**Not confirmed, and therefore not asserted as stated fact:** the protocol between the render
path and the search services (`http` is used as an assumed value), the engine backing
first-pass retrieval today (Solr is used, on the strength of the 2012 post, and no current
engine is claimed), backup and credential-rotation policy for MySQL and SQLite (set to the
practice such a store must have, and marked assumed in `notes.md`), and Kafka `acks`,
`min.insync.replicas`, partition count and retention (omitted).
