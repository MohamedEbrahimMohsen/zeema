# Intake: Wikimedia / Wikipedia serving infrastructure

## Source
- Primary: https://wikitech.wikimedia.org/wiki/Wikimedia_CDN (WMF SRE Traffic team, official operational documentation, current)
- Primary: https://wikitech.wikimedia.org/wiki/Global_traffic_routing (WMF SRE Traffic team, official docs, current)
- Primary: https://wikitech.wikimedia.org/wiki/MediaWiki_at_WMF (WMF Service Operations, official docs, current)
- Primary: https://wikitech.wikimedia.org/wiki/LVS (WMF SRE Traffic team, official docs, current)
- Primary: https://wikitech.wikimedia.org/wiki/MariaDB (WMF SRE Data Persistence team, official docs, current)
- Primary: https://wikitech.wikimedia.org/wiki/Application_servers (WMF Service Operations, official docs, current)
- Primary: https://wikitech.wikimedia.org/wiki/Memcached (WMF SRE, official docs, current)
- Primary: https://wikitech.wikimedia.org/wiki/Parser_cache (WMF Performance/Data Persistence, official docs, 2024)
- Primary: https://wikitech.wikimedia.org/wiki/Media_storage and https://wikitech.wikimedia.org/wiki/Thumbor (WMF SRE, official docs, current)
- Primary: https://wikitech.wikimedia.org/wiki/Search/Elasticsearch_Administration and https://wikitech.wikimedia.org/wiki/Search/CirrusStreamingUpdater (WMF Search Platform, official docs, current)
- Primary: https://wikitech.wikimedia.org/wiki/Event_Platform/EventGate, https://wikitech.wikimedia.org/wiki/Kafka, https://wikitech.wikimedia.org/wiki/Changeprop, https://wikitech.wikimedia.org/wiki/Purged (WMF Data Engineering / Service Ops, official docs, current)
- Primary: https://wikitech.wikimedia.org/wiki/Performance/Multi-DC_MediaWiki and https://wikitech.wikimedia.org/wiki/Switch_Datacenter (WMF Performance team + SRE, official docs, current)
- Primary: https://diff.wikimedia.org/2023/05/08/around-the-world-how-wikipedia-became-a-multi-datacenter-deployment/ (WMF engineers, Wikimedia Tech Blog, 2023; techblog.wikimedia.org redirects here)
- Primary: https://diff.wikimedia.org/2020/11/25/wikimedias-cdn-the-road-to-ats/ (WMF SRE Traffic team, Wikimedia Tech Blog, 2020)
- Primary (incidents): https://wikitech.wikimedia.org/wiki/Incidents/2023-02-22_wiki_outage and https://wikitech.wikimedia.org/wiki/Incidents/2022-03-10_MediaWiki_availability (WMF incident reports, 2022-2023)
- Verified by: official Wikimedia Foundation operational documentation (wikitech.wikimedia.org, 21 pages fetched), Wikimedia Tech Blog posts by WMF engineers (2 fetched), WMF public incident reports (2 fetched)
- Confidence: high
- Date of source: 2020-2026 (docs current as of 2026-09; blog posts 2020 and 2023)

## System in three lines
Serves Wikipedia and the other Wikimedia projects: read-mostly wiki pages, media files and search, to a global anonymous audience, plus a much smaller stream of authenticated edits. Traffic enters through a GeoDNS-steered edge of five caching-only PoPs plus two full application datacenters (eqiad, codfw), passes an LVS layer-4 director and a three-part CDN (HAProxy TLS, in-memory Varnish frontend, on-disk ATS backend), and only on a miss reaches MediaWiki on Kubernetes backed by sharded MariaDB, Memcached, Swift and Elasticsearch. Hard because over 90% of reads must be absorbed by cache, every page view can fan out into dozens of database and cache lookups, and the whole edit path is single-primary while reads are served active-active from two datacenters.

## Scale (only if stated)
- Read requests: "Wikimedia serves approximately 21 billion monthly read requests, with over 90% typically handled by their CDN" — https://diff.wikimedia.org/2020/11/25/wikimedias-cdn-the-road-to-ats/
- Cache hit ratio: cache_upload ~97%; cache_text 83-88% depending on time of day — https://diff.wikimedia.org/2020/11/25/wikimedias-cdn-the-road-to-ats/
- Per-host CDN capacity target: "capacity to sustain approximately 10,000 requests per second per host" — https://diff.wikimedia.org/2020/11/25/wikimedias-cdn-the-road-to-ats/
- App tier: "several hundred Apache servers that run MediaWiki (PHP application)" — https://wikitech.wikimedia.org/wiki/Application_servers; "Hundreds of bare metal Apache servers" — https://diff.wikimedia.org/2023/05/08/around-the-world-how-wikipedia-became-a-multi-datacenter-deployment/
- Databases: 8 core MediaWiki sections s1-s8 plus x1/x3/x4 extension clusters and es1-es7 external store — https://wikitech.wikimedia.org/wiki/MariaDB
- Memcached: "18 shards per DC" main pool, "3 shards per DC" gutter pool — https://wikitech.wikimedia.org/wiki/Memcached
- Sites: 7 (2 core application + 5 edge caching) — https://wikitech.wikimedia.org/wiki/Global_traffic_routing
- Latency effect of multi-DC reads: read requests ~15ms faster; Singapore upstream latency ~510ms -> ~490ms after HTTP verb routing on 2022-09-06 — https://diff.wikimedia.org/2023/05/08/around-the-world-how-wikipedia-became-a-multi-datacenter-deployment/
- Incident blast radius: "~17 million HTTP requests (according to varnish) / 5 million user requests" errored in an 18-minute CDN outage — https://wikitech.wikimedia.org/wiki/Incidents/2023-02-22_wiki_outage
- Message throughput: not stated (Kafka broker counts and rates not given on the fetched pages)

## Requirements stated or clearly implied
- Availability target: must survive the loss of an application datacenter; "Operating multiple application data centers reduces organizational risk from catastrophic damage or connectivity loss to a single data center" and "each application data center must contain all hardware, databases, and services required to handle the full worldwide volume of backend traffic" (Multi-DC MediaWiki). Planned switchover costs "2-3 minutes of read-only for MediaWiki" (Switch Datacenter). No numeric SLA stated.
- Consistency: reads eventual across DCs; writes single-primary. "MediaWiki being active-active means that writes still only go to the primary datacenter." Per-user read-your-writes is provided explicitly by ChronologyProtector plus a sticky-DC cookie. ParserCache is best-effort: "values may (consistently) differ between data centers if both are valid and fresh." MainStash uses primary-primary replication with last-write-wins.
- Latency target: no p50/p95/p99 numbers stated. Stated goals are cache-first serving and lower upstream latency for far-from-eqiad users; a 60-second query killer bounds read queries on MariaDB.
- Ordering needs: per-user causal ordering on the edit path (ChronologyProtector); Kafka topics are datacenter-prefixed, so ordering is per-topic-partition per source DC. No global ordering claimed.
- Replay or reprocessing: yes. Kafka gives changeprop "at least once delivery semantics: once an event is in Kafka, we can be sure that it will be processed"; failures land in "a dedicated error topic in Kafka". The Cirrus Streaming Updater reprocesses page-change events into search indexes.
- Retention: CDN frontend TTL capped to 1 day with a 7-day keep for HTTP-304 via IMS/INM; ATS backend TTL capped to 24 hours; MediaWiki page-view max-age 14 days; ParserCache 30 days (as of Dec 2023); Kafka webrequest topics ~90 days.
- Compliance / residency: not stated on the fetched pages beyond privacy-preserving handling of the public caching dataset. Cross-DC memcached and MariaDB write traffic is TLS-encrypted.

## Boundaries
- Regions / zones: 7 sites. Core application datacenters eqiad (Ashburn) and codfw (Carrollton); edge caching PoPs esams (Amsterdam), ulsfo (San Francisco), eqsin (Singapore), drmrs (Marseille), magru. "All locations can receive direct user traffic, however `eqiad` and `codfw` also host _Core application services_, whereas `ulsfo`, `esams`, `drmrs`, `eqsin`, and `magru` are limited to _Edge caching_."
- Trust zones: public internet -> GeoDNS/LVS/HAProxy TLS edge -> CDN cache layer -> (TLS, Envoy-terminated) internal application network -> restricted data tier (MariaDB, Memcached, Swift, Kafka main). eventgate-analytics-external and eventgate-logging-external are the only publicly exposed event intake endpoints.
- Named subsystems: Wikimedia CDN (cache_text, cache_upload), Global traffic routing / DNS Discovery, LVS+PyBal, MediaWiki on Kubernetes (wikikube: mw-web, mw-api-ext, mw-api-int, mw-jobrunner, mw-parsoid, mw-cron, mw-debug), MariaDB core/extension/external-store/parsercache/mainstash, Memcached main + gutter pools behind mcrouter, Media storage (Swift + Thumbor), Search Platform (CirrusSearch + Elasticsearch + Cirrus Streaming Updater), Event Platform (EventGate + Kafka main/jumbo/logging), Change Propagation (changeprop, changeprop-jobqueue), purged.

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Readers and editors (browsers, apps) | Originate all HTTP traffic; mostly anonymous reads | not stated | client | 21e9 read requests/month |
| 2 | Authoritative DNS (GeoDNS + DNS Discovery) | Resolves users to the nearest site and steers services between DCs | gdnsd (named as "our authoritative DNS servers") | dns | "Our DNS TTLs are commonly 5 minutes long"; GeoIP resolution; DNS Discovery used to depool an application DC |
| 3 | LVS director + PyBal | Layer-4 load balancer in front of every pooled service | Linux Virtual Server, PyBal | load-balancer | LVS-DR: "only forward (incoming) traffic is balanced ... return traffic does not even go through the load balancer"; Maglev hashing scheduler since 2020; PyBal health checks pool/depool, Etcd backend, BGP announces service IPs; tiers: high-traffic (text, upload) and low-traffic (internal) |
| 4 | HAProxy (on cache hosts) | TLS and HTTP/2 termination plus rate limiting at the edge | HAProxy | load-balancer | "TLS termination, HTTP/2 termination, and rate limiting" |
| 5 | Varnish frontend | In-memory first cache layer, one per cache host | Varnish | cdn | in-memory; frontend layer distributes traffic equally across servers; TTL "capped to 1 day with a 7-day keep for benefit of HTTP-304 via IMS/INM"; also does rate limiting |
| 6 | ATS backend | On-disk second cache layer, the CDN origin-facing tier | Apache Traffic Server | cdn | on-disk/SSD; "Backend selection is done by applying consistent hashing on the request URL"; TTL "capped to 24 hours"; native TLS to origin |
| 7 | cache_text and cache_upload clusters | The two CDN clusters the Varnish+ATS pair is deployed as | Varnish + ATS | cdn | cache_text = "all wiki domains traffic (MediaWiki), and misc web services", hit ratio 83-88%; cache_upload = "upload.wikimedia.org and maps.wikimedia.org exclusively (images, thumbnails, map tiles)", hit ratio ~97% |
| 8 | purged | Daemon on every cache host turning Kafka purge events into HTTP purges | purged (Go, in-house) | worker | consumes `eqiad.resource-purge` and `codfw.resource-purge`; 48 backend + 4 frontend workers; replaced vhtcpd/UDP multicast (2020) |
| 9 | mw-web | Kubernetes MediaWiki cluster, "Default catch-all for HTTP requests to wiki domains" | MediaWiki (PHP) on Apache + php-fpm, Envoy TLS, Kubernetes | app-server | TLS terminated locally by Envoy; Apache mod_worker spawning php-fpm; hundreds of bare-metal-equivalent servers; Apache access logs disabled |
| 10 | mw-api-ext / mw-api-int | MediaWiki clusters serving `/w/api.php` and `/w/rest.php` for external and internal callers | MediaWiki | app-server | split by caller trust (public vs internal) |
| 11 | mw-parsoid | Serves Parsoid HTML rendering requests routed from RESTBase | Parsoid | app-server | "Routes RESTBase requests to Parsoid" |
| 12 | mw-jobrunner | Executes MediaWiki jobs handed to it over HTTP by changeprop-jobqueue | MediaWiki jobrunner | worker | "Processes jobs from ChangeProp-JobQueue" |
| 13 | MariaDB core sections s1-s8 (+ x1, x3, x4) | Sharded wiki metadata; one section per wiki group | MariaDB (InnoDB only) | sql-database | s1=enwiki, s4=Commons, s5=dewiki, s8=Wikidata, s3=~900 small wikis; per-section topology primary -> DC master (standby DC) -> replicas; "the only instance that receives writes"; standardized replica weights primary 500 / API 300 / vslow+dump 100; query killer stops reads over 60s; x1 = cross-wiki extension data (Echo, CheckUser, ContentTranslation) |
| 14 | External Store es1-es7 | Stores the compressed full text of every page revision | MariaDB | sql-database | "the full text of all page revisions in a compressed format"; es1-es5 read-only, es6-es7 read-write |
| 15 | ParserCache pc1-pc8 | Persistent tier of the parsed-wikitext cache | MariaDB behind MediaWiki MultiWriteBagOStuff | cache | keyed per page, "validates the value at runtime against the expected revision and touched timestamp"; consistent hashing across shards; TTL 30 days (Dec 2023); multi-primary, no replicas, "writable by the application at all times" since "data loss is not a concern"; cross-DC "best-effort MySQL replication"; circular replication between DCs |
| 16 | MainStash ms1-ms3 | Replicated persistent cache for user state and ResourceLoader dependencies | MariaDB | cache | "replicated and persistent cache"; "primary-primary" across datacenters, both writable; last-write-wins |
| 17 | Memcached main pool (+ gutter pool) | Hot object cache for MediaWiki (WANObjectCache, ParserCache hot keys, MicroStash) | memcached | cache | "18 shards per DC, running on the `mc10XX` hosts (in Eqiad) and `mc20XX` hosts (in Codfw)"; gutter pool "3 shards per DC ... a fallback pool for the Main pool" |
| 18 | mcrouter (mw-mcrouter) | Proxy in front of memcached doing sharding, gutter failover and cross-DC purge relay | mcrouter | database-proxy | deployed as a Kubernetes daemonset; "Cross-DC traffic between the MediaWiki and Main pools (e.g. WANCache purges relayed by mcrouter's WAN route) is encrypted using TLS"; replaced twemproxy/nutcracker |
| 19 | Session store (Kask) | Multi-DC login session storage | Kask service over Apache Cassandra | nosql-database | "native support for multi-region clustering" |
| 20 | Swift media store (ms-fe / ms-be) | Object storage for originals, thumbnails, transcodes and rendered media | OpenStack Swift | object-store | containers keyed by "a project (_wikipedia_), a language (_en_), a repo, a zone and, optionally, a shard"; one cluster per application DC; cross-DC consistency via a journal for originals and the `swiftrepl` tool; fronted by MediaWiki FileBackend |
| 21 | Thumbor | On-demand image scaling and thumbnail rendering | Thumbor (on Kubernetes since Apr 2023) | media-transcoder | "As the thumb sizes are arbitrary, it is not possible to pregenerate them ... generate them on demand and cache them"; invoked by a Swift proxy plugin on miss; result stored back into Swift and cached in Varnish |
| 22 | Elasticsearch / OpenSearch (CirrusSearch) | Full-text and structured search index for all wikis | Elasticsearch | search-index | clusters in eqiad, codfw and cloudelastic; "Each cirrus elastic* host runs two instances of Elasticsearch" (ports 9243/9443/9643); "our production clusters are set for 1 primary and 2 replicas"; "we don't want shards to exceed 50GB, and ideally they wouldn't be smaller than 10GB"; "Elasticsearch does not have support for replicating search indices across clusters" |
| 23 | Cirrus Streaming Updater | Stream job that turns edits into search-index writes | Apache Flink on wikikube | stream-processor | "One producer runs per datacenter reading the events from various topics"; "The producer only reads events from it's local datacenter. The consumer reads events from all producers in all datacenters"; consumes `mediawiki.page-change`, `mediawiki.cirrussearch.page_rerender`, weighted-tag streams; consumer "fetches the content of the update from the mediawiki api, batches together many updates, and performs a bulk write request" |
| 24 | EventGate | HTTP event intake that schema-validates and produces to Kafka | EventGate (Node.js, in-house) | app-server (alt: webhook-endpoint) | "takes JSON messages over HTTP POST requests, optionally validates them against a JSONSchema, and then produces them to a backend"; schema resolved and cached from the event's `$schema` URI; instances eventgate-main, eventgate-analytics, eventgate-analytics-external (`intake-analytics.wikimedia.org`), eventgate-logging-external (`intake-logging.wikimedia.org`); MediaWiki produces via the EventBus extension |
| 25 | Kafka main-eqiad / main-codfw (+ jumbo-eqiad, logging) | Event backbone: change events, JobQueue, purges, analytics, logs | Apache Kafka + MirrorMaker | stream | main clusters serve "low volume critical production services"; jumbo-eqiad for "high volume analytics" (eqiad only); logging clusters buffer for Logstash; active-active mirroring where producers "prefix topic names with the datacenter they are in" and codfw pulls all `eqiad.*` topics; webrequest retention ~90 days |
| 26 | changeprop / changeprop-jobqueue (cpjobqueue) | Consumes Kafka change events and drives HTTP work, including the MediaWiki JobQueue | change-propagation (in-house, Node.js) | queue | "at least once delivery semantics"; job classes: dedicated consumer per high-traffic job (categoryMembershipChange, cdnPurge), partitioned by MySQL section (refreshLinks, htmlCacheUpdate), latency-sensitive fast track (AssembleUploadChunks, PublishStashedFile), glob fallback for the rest; "automatic retries with exponential delays, large job deduplication, and persistent error tracking via a dedicated error topic in Kafka"; Redis via Nutcracker for rate limiting and exclusion lists |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| client | authoritative-dns | dns | sync | | GeoIP resolution, 5-minute TTLs |
| client | lvs-director | tcp | sync | | nearest PoP IP handed out by GeoDNS |
| lvs-director | haproxy | tcp (LVS-DR) | sync | | director rewrites destination MAC only; responses bypass the director |
| haproxy | varnish-frontend | http | sync | | TLS/HTTP-2 terminated, rate limiting applied |
| varnish-frontend | ats-backend | http/tls | sync | | on miss only; backend chosen by consistent hash of the request URL |
| ats-backend | mw-web | https (Envoy-terminated) | sync | | on miss; GET routed to the local application DC |
| ats-backend | mw-api-ext | https | sync | | `/w/api.php`, `/w/rest.php` |
| ats-backend (edge PoP) | ats-backend (core DC) | https | sync | | edge PoPs hold no application services; inter-PoP cache chaining was removed with the ATS migration |
| varnish-frontend (cache_upload) | swift (ms-fe) | http | sync | | thumbnail/original fetch on miss |
| swift-proxy | thumbor | http | sync | | Swift proxy plugin asks Thumbor to render a missing thumbnail |
| thumbor | swift | http | async | | "Thumbor saves a copy in Swift" after serving |
| mw-web | mcrouter | memcached ascii | sync | | every page render; WANObjectCache |
| mcrouter | memcached-main-pool | memcached | sync | | 18 shards per DC; falls back to the gutter pool when a main shard is down |
| mcrouter (eqiad) | memcached-main-pool (codfw) | memcached over TLS | async | | WANCache purges relayed by mcrouter's WAN route |
| mw-web | parsercache (pc1-pc8) | mysql | sync | | consistent hashing on the cache key; 30-day TTL |
| parsercache (eqiad) | parsercache (codfw) | mysql replication | async | best-effort | circular replication; "values may (consistently) differ between data centers" |
| mw-web | mariadb-section-replica | mysql | sync | | read path; replica chosen by MediaWiki load balancer using weights and replication lag |
| mw-api-int | mariadb-section-primary | mysql | sync | | writes only, and only in the primary DC |
| mariadb-section-primary | mariadb-dc-master (standby DC) | mysql replication | async | | DC master then feeds that DC's replicas |
| mw-web | external-store (es) | mysql | sync | | fetch compressed revision text |
| mw-web | mainstash (ms1-ms3) | mysql | sync | | user state, ResourceLoader dependencies; primary-primary, last-write-wins |
| mw-web | kask-session-store | http | sync | | login sessions; Cassandra multi-region underneath |
| mw-web | swift | http (FileBackend) | sync | | uploads and originals |
| mw-web | elasticsearch | http | sync | | CirrusSearch queries, local cluster |
| mw-web | eventgate-main | http post | sync (to EventGate) | validated then produced | EventBus extension; schema-validated before acceptance |
| eventgate-main | kafka-main | kafka | async | at-least-once | topic prefixed with the producing datacenter |
| eventgate-analytics-external | kafka-jumbo | kafka | async | | public `intake-analytics.wikimedia.org` |
| kafka-main (eqiad) | kafka-main (codfw) | kafka MirrorMaker | async | | codfw pulls all `eqiad.*` topics; mirrored both ways |
| kafka-main | changeprop-jobqueue | kafka consume | async | at-least-once | dedicated consumers for high-traffic jobs; partitioned consumers per MySQL section |
| changeprop-jobqueue | mw-jobrunner | http | sync per job, async overall | at-least-once | exponential-delay retries, dedup, failures to a dedicated Kafka error topic |
| changeprop | page-content-service | http | async | | cache warming and content regeneration |
| changeprop | redis (via nutcracker) | redis | sync | | rate limiting and exclusion lists |
| mw-web | kafka (resource-purge topic) | kafka | async | at-least-once | edit proactively purges the canonical URL |
| kafka | purged | kafka consume | async | at-least-once | `eqiad.resource-purge`, `codfw.resource-purge` |
| purged | varnish-frontend | http purge | sync | | 4 frontend workers |
| purged | ats-backend | http purge | sync | | 48 backend workers |
| kafka (mediawiki.page-change) | cirrus-streaming-updater (producer) | kafka consume | async | | producer reads only its local DC's events |
| cirrus-streaming-updater (consumer) | mw-api-int | http | sync | | fetches the page content for the update |
| cirrus-streaming-updater (consumer) | elasticsearch | http bulk | async | | batched bulk writes; every DC's consumer reads every DC's producer, so indexes are written independently per cluster |
| rsyslog / clients | kafka-logging | kafka | async | | buffering layer "to smoothen load on the logstash collectors" |

## Failure modes, incidents, tradeoffs the source discusses
- **Losing the in-memory frontend cache stampedes the backends.** The reason for moving the backend tier off Varnish: during Varnish frontend restarts "the entire dataset would be lost, forcing backend caches to absorb massive traffic surges directly from origin servers"; they needed "reliable disk-backed persistent storage" and a host able to sustain ~10,000 req/s. https://diff.wikimedia.org/2020/11/25/wikimedias-cdn-the-road-to-ats/
- **A two-layer cache exists because one server cannot serve a hot page.** "As a single server cannot handle all end-user traffic for a single peak-popularity page, the frontend layer serves an important role ahead of the backend" — frontend balanced equally, backend balanced by URL hash. https://wikitech.wikimedia.org/wiki/Wikimedia_CDN
- **Depooling the cache backends takes out a continent.** 2023-02-22: an HAProxy maintenance run used `depool` then `pool cdn`, leaving every text-cluster ATS backend depooled in esams and eqiad. Root cause as filed: "a mismatch on the maintenance run between depooling the hosts individually and pooling back the cdn". 18 minutes, ~17% of non-multimedia traffic erroring, ~17M failed HTTP requests, editing rate cut to under half. https://wikitech.wikimedia.org/wiki/Incidents/2023-02-22_wiki_outage
- **One slow database replica can exhaust the whole app tier.** 2022-03-10: "For 12 minutes, all wikis were unreachable for logged-in users and for anonymous users trying to edit or access uncached content." A repooled s8 replica was also running a file transfer: "the host became slow to respond to queries." It was slow, not down, so nothing auto-depooled it; because nearly all page renders query s8, the backlog spread across the section and then across all wikis "as application servers exhausted their worker pools". https://wikitech.wikimedia.org/wiki/Incidents/2022-03-10_MediaWiki_availability
- **Gutter pool for memcached shard loss.** A dedicated fallback pool of "3 shards per DC" exists purely so a dead main-pool shard does not turn into origin load. https://wikitech.wikimedia.org/wiki/Memcached
- **ParserCache trades durability for write availability.** pc clusters are multi-primary with no replicas and are "writable by the application at all times" because "data loss is not a concern"; cross-DC replication is best effort and "values may (consistently) differ between data centers if both are valid and fresh." https://wikitech.wikimedia.org/wiki/MariaDB, https://wikitech.wikimedia.org/wiki/Parser_cache
- **Active-active reads, single-primary writes.** "MediaWiki being active-active means that writes still only go to the primary datacenter, however a fallback is required for edge cases where a write is attempted in a secondary datacenter." The mechanism is HTTP verb routing (GET local, POST to primary) plus a sticky-DC cookie and ChronologyProtector so an editor never reads a stale replica after their own write. https://wikitech.wikimedia.org/wiki/Performance/Multi-DC_MediaWiki, https://diff.wikimedia.org/2023/05/08/around-the-world-how-wikipedia-became-a-multi-datacenter-deployment/
- **Multi-DC took seven years and one abstraction at a time.** 2012 NFS to Swift, 2013 UDP-multicast invalidation, 2014 a cold-standby second DC, 2017 JobQueue to Kafka, 2020 Kafka-based invalidation, 2022 active-active. Each cross-DC-hostile component (direct file access, single-DC memcached assumptions, DB-backed job queue) had to be replaced by an abstraction first (FileBackend, WANObjectCache, Kafka JobQueue). https://diff.wikimedia.org/2023/05/08/around-the-world-how-wikipedia-became-a-multi-datacenter-deployment/
- **Search cannot be replicated, so it is rebuilt per cluster.** "Elasticsearch does not have support for replicating search indices across clusters" — instead a Flink producer per DC and consumers that read every DC's producer write each cluster independently. https://wikitech.wikimedia.org/wiki/Search/Elasticsearch_Administration
- **Planned switchover is cheap but not free.** "Impact of a switchover is expected to be **2-3 minutes of read-only for MediaWiki** including extensions", with core masters (s1-s8, x1, es4-es5) set read-only while the destination DC catches up; traffic ~20 min, services ~15-40 min, MediaWiki cookbook ~35 min. Run twice yearly at the equinoxes. https://wikitech.wikimedia.org/wiki/Switch_Datacenter
- **Cache-key fragmentation is a real cost.** The ATS migration required URI path normalization so that `Steve_Fuller_(sociologist)` and `Steve_Fuller_%28sociologist%29` resolve to one cached object. https://diff.wikimedia.org/2020/11/25/wikimedias-cdn-the-road-to-ats/
- **Thumbnails are generated on demand by necessity.** "As the thumb sizes are arbitrary, it is not possible to pregenerate them either, therefore the only way to handle this is to generate them on demand and cache them." https://wikitech.wikimedia.org/wiki/Media_storage
- **Topic-prefix design regret.** On Kafka mirroring: "the data center name was an incorrect choice" for prefixing, since "a better topic prefix is the name of the source Kafka cluster." https://wikitech.wikimedia.org/wiki/Kafka
- **Runaway reads are killed, not queued.** MariaDB runs a Query Killer that stops read queries exceeding 60 seconds. https://wikitech.wikimedia.org/wiki/MariaDB
- **Emergency lever at the edge.** A whole cache cluster can be locked out of a site with `cache::traffic_shutdown: true` in that site's hiera role. https://wikitech.wikimedia.org/wiki/Global_traffic_routing

## Unknowns
- Kafka broker counts, partition counts per topic, and message rates for the main/jumbo clusters (not stated on the fetched pages).
- Absolute request-per-second figures at the edge and at the app tier (only ~21e9 reads/month and a ~10k req/s per-host target are stated).
- Elasticsearch node counts per cluster and the chi/psi/omega cluster split semantics (the administration page names the ports, not the sizing rationale).
- Latency budgets: no p50/p95/p99 targets are published on any page fetched.
- Current status of RESTBase and the Page Content Service in the request path (referenced by changeprop and mw-parsoid, but their own pages were not fetched).
- Swift object counts and total media volume; the per-DC Swift cluster sizing.
- Whether MariaDB uses semi-synchronous replication in production (the MariaDB page describes the topology but the fetched extract did not state the replication mode).
- How mw-api-int callers are authenticated/authorised versus mw-api-ext.
- Exact current memcached TTL policy per key class (WANObjectCache TTLs not stated).

## Candidates
- New kinds: none required. Every box maps to an existing kind. Two near-misses worth noting: EventGate (an HTTP schema-validating event intake in front of Kafka) is filed as `app-server` but would fit a `event-intake-gateway (new)` kind if a second sighting appears; the MediaWiki JSONSchema repository behind EventGate would be a `schema-registry` if modelled as a box.
- New properties on existing kinds:
  - `cdn.layer` (frontend-memory | backend-disk) — the two-tier Varnish/ATS split is load-bearing here.
  - `cdn.backendSelection` (round-robin | url-hash) and `cdn.ttlCapSeconds`.
  - `cache.fallbackPool` (boolean / named) — the memcached gutter pool.
  - `cache.crossDcMode` (none | purge-broadcast | circular-replication | primary-primary-lww) — covers WANObjectCache, ParserCache and MainStash respectively.
  - `sql-database.sectionKey` (the wiki-group sharding key for s1-s8) and `sql-database.readOnlyShards` (es1-es5).
  - `load-balancer.returnPath` (through-lb | direct-server-return).
  - `search-index.crossClusterReplication` (none | native) with `rebuiltPerCluster` boolean.
  - `queue.retryPolicy` (exponential) and `queue.errorTopic` (name) for changeprop.
- New requirement paths:
  - `consistency.readYourWrites` (none | per-user-sticky | global) — ChronologyProtector plus the sticky-DC cookie.
  - `availability.writePrimaryDc` (single | multi) alongside `availability.readDcs`.
  - `availability.plannedSwitchoverReadOnlySeconds`.
- New rules (name + one-line condition):
  - `single-layer-cdn-without-persistent-backend`: a cdn node with an in-memory layer and no disk-backed layer behind it, while the origin is an app-server — the 2020 ATS lesson.
  - `cache-shard-without-fallback-pool`: a `cache` sized in shards with no fallbackPool declared and an origin database behind it.
  - `sync-read-to-replica-without-lag-or-timeout-guard`: sync edge into a sql-database replica with no query timeout / lag-aware selection — the 2022-03-10 incident.
  - `write-primary-dc-without-sticky-routing`: design declares multiple read DCs and a single write DC but no per-user sticky routing or chronology mechanism.
  - `cross-dc-invalidation-without-durable-transport`: cache purge edge marked async with no stream/queue between producer and cache (the pre-2020 UDP multicast shape).
  - `search-index-multi-dc-without-per-dc-updater`: search-index present in two or more regions with a single updater — cross-cluster index replication does not exist.
  - `bulk-depool-without-canary`: an ops action edge that can depool an entire load-balanced tier in one step (the 2023-02-22 incident).

## Verification 2026-09-14

The card's 24 sources were fetched 2026-09-14, the same day this reference design was encoded,
so this is a spot check of two primary URLs rather than a full re-fetch.

| URL | Reachable | Outcome |
|---|---|---|
| https://wikitech.wikimedia.org/wiki/Wikimedia_CDN | yes | Confirmed verbatim: "HAProxy: TLS termination, HTTP/2 termination, and rate limiting.", "Varnish: Front-end (in memory) caching and rate limiting.", "Apache Traffic Server: Back-end (on disk) caching.", the 1-day frontend cap with a 7-day keep for HTTP-304 via IMS/INM, the 24-hour ATS backend cap, and the cache_text / cache_upload split |
| https://wikitech.wikimedia.org/wiki/Memcached | yes | Confirmed verbatim: "**Main**: 18 shards per DC", "**Gutter**: 3 shards per DC", and "Cross-DC traffic between the MediaWiki and Main pools (e.g. WANCache purges relayed by mcrouter's WAN route) is encrypted using TLS." |
| the remaining 22 URLs | not re-fetched | fetched 2026-09-14 by the card author |

Could not confirm exactly as stated: the card's "Backend selection is done by applying consistent
hashing on the request URL" now reads "The backend layer is distributed by request hash (e.g. the
URL and other metadata)". The design uses the current, weaker wording in the edge label and does
not claim `hashing: "consistent"` for the ATS node.

Additional check (not a card source): a search of wikitech and phabricator for binlog-level change
data capture out of MariaDB returns only T120242, a *proposal* for a transactional-outbox table
read by Debezium. Production emits change events from the MediaWiki EventBus extension into
EventGate, so the design contains no change-data-capture node.
