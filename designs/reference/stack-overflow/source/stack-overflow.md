# Intake: Stack Overflow (scale-up architecture — HAProxy, IIS/.NET, SQL Server AlwaysOn, Redis, Elasticsearch)

## Source
- Primary: https://nickcraver.com/blog/2016/02/17/stack-overflow-the-architecture-2016-edition/ (Nick Craver, Architecture Lead at Stack Exchange, official series, 2016 — "Stack Overflow: The Architecture")
- Primary: https://nickcraver.com/blog/2016/03/29/stack-overflow-the-hardware-2016-edition/ (same author, same series, 2016 — "Stack Overflow: The Hardware")
- Primary: https://nickcraver.com/blog/2016/05/03/stack-overflow-how-we-do-deployment-2016-edition/ (same author, 2016 — deployment)
- Primary: https://nickcraver.com/blog/2018/11/29/stack-overflow-how-we-do-monitoring/ (same author, 2018 — monitoring)
- Primary: https://nickcraver.com/blog/2019/08/06/stack-overflow-how-we-do-app-caching/ (same author, 2019 — app caching, the most detailed Redis source)
- Primary: https://stackoverflow.blog/2023/08/30/journey-to-the-cloud-part-i-migrating-stack-overflow-teams-to-azure/ (official Stack Overflow engineering blog, 2023)
- Primary: https://stackoverflow.blog/2023/09/05/journey-to-the-cloud-part-ii-migrating-stack-overflow-for-teams-to-azure/ (official Stack Overflow engineering blog, 2023)
- Primary: https://kevinmontrose.com/2015/01/27/providence-machine-learning-at-stack-exchange/ (Kevin Montrose, Stack Exchange developer, 2015 — Providence)
- Series index: https://nickcraver.com/blog/2016/02/03/stack-overflow-a-technical-deconstruction/
- Verified by: five posts in the official architecture series by Stack Exchange's Architecture Lead + two posts on the official Stack Overflow engineering blog + one post by the Stack Exchange developer who built Providence. Fetch log: `work/research/stack-overflow/verify.md`.
- Confidence: high (2016-2019 on-prem stack); high for the 2023 Teams-on-Azure fork, which is a separate deployment of the same application
- Date of source: 2015, 2016, 2018, 2019, 2023

## System in three lines
Serves the Stack Exchange network — 173 Q&A sites, 66M page loads and 209M HTTP requests a day — from **nine production web servers** in a single owned datacenter, with a warm DR site. Every layer is deliberately scaled *up* rather than out: two SQL Server boxes hold the whole dataset in RAM-sized SSD, two Redis boxes absorb 1.6B commands a day at 2% CPU, three Elasticsearch nodes carry all search, and a bespoke in-process "tag engine" answers tag-intersection queries SQL was too expensive for. Hard because the workload is enormous but the budget for machines is not: the architecture's whole thesis is that a tuned monolith on carefully specced hardware beats a fleet, and it holds only because performance is treated as a product feature and every millisecond is measured per request.

## Scale (only if stated)
- Page loads: 66.3M/day; 64.7M question page views/day in 2019 (architecture-2016; app-caching-2019)
- HTTP requests at the load balancer: 209.4M/day (+61.3M since 2013); 308M HTTP hits/day by 2019 (architecture-2016; app-caching-2019)
- SQL queries from HTTP alone: 504.8M/day, 607M ms (168 hours) of query execution/day (architecture-2016)
- Redis: 5.83B hits/day (2016) consuming 10.4M ms/day; ~160B operations/month at <2% CPU; 1.59B commands/day rising to 3.73B including replicas, 86,982 commands/sec peak, 2.01% average CPU (3.04% peak), 124.4M active keys, <96 GB of 256 GB RAM used (architecture-2016; app-caching-2019)
- Elasticsearch: 17.2M searches/day (architecture-2016)
- Tag engine: 3.66M requests/day, 147M ms (40.8 hours) of execution/day (architecture-2016)
- ASP.NET: 1.61B ms (447 hours) of processing/day, **down** from 757 hours in 2013 despite 61M more requests (architecture-2016)
- Render times: question page 22.71 ms average (19.12 ms in ASP.NET); home page 11.80 ms (8.81 ms in ASP.NET) (architecture-2016)
- Bandwidth: 1.24 TB HTTP sent/day; 3.08 TB total sent, 569 GB total received (architecture-2016)
- Websockets: ~500,000 concurrent connections at peak (architecture-2016)
- Metrics: 50k-100k metrics/sec into Bosun at ~5% CPU on the agent (monitoring-2018)
- Deploys: ~25/day to dev, 5-10/day to production, under 9 minutes end to end (deployment-2016)
- Sites: 173 Q&A sites sharing one "Sites" database (cloud-part-i)

## Requirements stated or clearly implied
- Availability target: no SLA stated. Everything redundant inside NY: dual 10 Gbps LACP per server, dual PSUs from two PDUs, two UPS, two generators, two utility feeds, redundant partner between Rack A and Rack B; a second datacenter in Colorado/Denver as DR with one SQL node per cluster and its own 3-node Elasticsearch. Four ISPs (Level 3, Zayo, Cogent, Lightower) with BGP active/active. The web tier is deliberately over-provisioned: "we have unintentionally tested this successfully a few times" running on far fewer servers than nine (architecture-2016).
- Consistency: strong inside SQL Server (single master per cluster); **asynchronous** AlwaysOn replication to the local read replica and to the DR replica, so replicas are eventually consistent. Cache is explicitly allowed to serve stale: `GetSet<T>()` has a `serveStaleDataSecs` window during which a background refresh runs while stale data is served (app-caching-2019).
- Latency target: not expressed as a percentile SLO; expressed as a per-request budget instrumented on every page — ASP.NET ms, SQL count and ms, Redis hits and ms, tag engine and Elasticsearch query counts are attached to every logged request. Redis roundtrip on the local LAN is budgeted at 0.2-0.5 ms and payloads are sized "in Mb/ms rather than Gb/s" so a large value cannot block a pipelined connection (app-caching-2019).
- Ordering needs: none stated. Cache invalidation ordering *is* a requirement: delete the Redis value first, then publish the key name, otherwise a subscriber re-fetches and re-caches the stale value (app-caching-2019).
- Replay or reprocessing: Elasticsearch indexes are rebuilt from SQL Server by the indexing job, which tracks change with SQL Server `ROWVERSION`; a full reindex is the stated cost blocking an Elasticsearch major upgrade. Redis is explicitly disposable — "all cache data is re-populable from sources" (architecture-2016; app-caching-2019).
- Retention: HTTP request summaries land in a dedicated SQL Server using a clustered columnstore index per day, for historical performance comparison; 6 Logstash boxes hold 288 TB raw for logs (hardware-2016; monitoring-2018).
- Compliance / residency: SOC 2 named as a driver for moving Stack Overflow for Teams to Azure — "Azure makes this a lot easier". Private customer data is isolated in a dedicated network zone, the Teams Firewall Zone (cloud-part-i).

## Boundaries
- Regions / zones: two datacenters — New York (physically New Jersey), primary, and Colorado/Denver, DR. Linked by a 10 Gbps MPLS circuit plus two OSPF failover routes. No cloud regions for the public site; the 2023 Azure build for Teams uses East US primary and West US read-only secondary (architecture-2016; hardware-2016; cloud-part-ii).
- Trust zones: internet (4 ISPs, CloudFlare in front) -> edge routers -> Fortinet 800C firewalls -> **DMZ** carrying public traffic -> internal VLANs for the web, service, cache, search and database tiers -> **Teams Firewall Zone (TFZ)**, a locked-down zone for private customer data. External traffic is isolated in separate VLANs (architecture-2016; cloud-part-i).
- Named subsystems / bounded contexts: Q&A application (multi-tenant across 173 sites), Meta, Careers/Talent, Chat, OpenID, Mobile, API, Stack Server (tag engine), Providence (ML), Socket Server (websockets), Elastic indexing jobs, MoonSpeak (compile-time localisation), Opserver/Bosun (monitoring), Stack Overflow for Teams.
- Physical racking is itself a boundary: each server has a "redundant partner between Rack A and Rack B", and the two HAProxy pairs are split by traffic source — two boxes for CloudFlare-proxied traffic, two for direct traffic.

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Clients / browsers | Web and mobile clients; hold a websocket for live counts | not stated | client | persistentConnection: websocket; concurrentSockets: 500000 |
| 2 | CloudFlare | Public DNS and proxy in front of the datacenter; internal DNS servers kept as backup ("should the apocalypse happen... we'll flip them on") | CloudFlare | dns | primary: cloudflare; backup: self-hosted; multiProvider: true (added after Dyn 2016) |
| 3 | Edge routers | BGP peering with 4 ISPs, active/active pairs | 2x Cisco ASR-1001, 2x Cisco ASR-1001-X (Denver: all ASR-1001-X) | network-fabric | isps: level3, zayo, cogent, lightower; mode: active-active; protocol: bgp |
| 4 | Firewalls | Perimeter firewalling, replaced Cisco 5525-X ASAs | 2x Fortinet 800C | firewall | count: 2 |
| 5 | Network core | 10 Gbps fabric for every server | 2x Cisco Nexus 5596UP + 10x Nexus 2232TM FEX (Denver: Nexus 56128P, 40 Gbps capable) | network-fabric | linkSpeed: 10Gbps; bonding: lacp-active-active |
| 6 | Load balancers | TLS termination, rate limiting, health checks, header capture to syslog, DRAIN mode for deploys | HAProxy 1.5.15 on CentOS 7 | load-balancer | count: 4 (2 for CloudFlare traffic, 2 for direct); ram: 64GB+ (2 boxes 192GB) for SSL session cache; nics: 2x10Gbps external + 2x10Gbps DMZ; healthChecksToReturn: 3 |
| 7 | Web servers (NY-WEB01-09) | The Q&A monolith: multi-tenant ASP.NET MVC serving Stack Overflow, Careers and every Stack Exchange site | IIS 8.5 / ASP.NET MVC 5.2.3 / .NET 4.6.1 on Windows, 11x Dell R630 | app-server | count: 9 production + 2 dev/meta; cores: 2x12; ram: 64GB; stateless: true; multiTenant: true; canRunOnOneServer: true |
| 8 | L1 in-process cache | Per-server in-memory cache in front of Redis; three layers — Global (network-wide), Site (per-site), Local (no remote backup) | in-house (`GetSet<T>()`) | cache | tier: L1; layers: global, site, local; stampedeGuard: ConcurrentDictionary lock; staleServing: true |
| 9 | Socket server | Raw websocket server on the web tier pushing notifications, vote counts, new-nav counts, answers, comments | StackExchange.NetGain (open source) | realtime-gateway | concurrentConnections: 500000; longestSeenSession: 18 months |
| 10 | Stack Server / Tag Engine | http.sys-based service (not IIS) answering tag-intersection queries SQL was too CPU-expensive for; also drives Elastic indexing | in-house | worker | count: 3 service servers; reloadInterval: 2 minutes for post/tag changes; cpuAffinity: pinned to a separate socket to preserve L2/L3 cache locality; buildHashCheck: 1 minute; requestsPerDay: 3660000 |
| 11 | Providence API | Serves ML predictions: home-page question recommendations and job matching | in-house (IIS-hosted) | ml-inference | liftOverControl: 10-30% in job matching |
| 12 | Providence ML servers | Train/compute the cascading classifier from traffic logs and tag views | in-house, 2x Dell R620 | ml-platform | cores: 2x12; ram: 384GB; features: tag-view deviations; model: cascading (major kind -> specific kind) |
| 13 | Providence Redis | Dedicated Redis slaves holding Providence data, separate from the main cache | Redis | cache | count: 2 slaves (3 servers in hardware post); ram: 384GB each, ~125GB in use |
| 14 | Elastic indexing job | Reads changed rows and pushes them to Elasticsearch | in-house, runs on Stack Server | worker | changeTracking: SQL Server ROWVERSION |
| 15 | Redis cache + pub/sub | L2 cache for the whole network and the pub/sub bus for L1 invalidation, websocket updates and light queues (account merges, aggregator, A/B analytics) | Redis, client StackExchange.Redis (open source) | cache | topology: 1 master + 1 slave per DC; ram: 256GB each, <96GB used; keys: 124.4M; commandsPerDay: 1.59B (3.73B with replicas); peakCommandsPerSec: 86982; cpu: 2.01% avg; serialization: protobuf-net; keyspace: one Redis database per site, database 0 for global; noCluster: true; noSentinel: true |
| 16 | Redis purge channel | Pub/sub channel carrying invalidated key names to every web server's L1 | Redis pub/sub | pubsub-topic | ordering: DEL/UNLINK first, then PUBLISH; subscribers: all web servers incl. slave-connected clients |
| 17 | Elasticsearch cluster | `/search`, related questions, ask-a-question suggestions; one index per Q&A site plus extra Careers indexes | Elasticsearch 1.4, client StackExchange.Elastic (not open sourced), 3x Dell R620 | search-index | nodes: 3 per datacenter; ram: 192GB; storage: all-SSD; nics: 2x10Gbps; searchesPerDay: 17200000; indexPerSite: true |
| 18 | SQL cluster 1 | Stack Overflow, Sites, PRIZM, Mobile databases | SQL Server on Dell R720xd | sql-database | nodes: 1 master NY + 1 replica NY + 1 replica Colorado; ram: 384GB; storage: 1x Intel P3608 4TB NVMe (RAID 0) + 24x Intel 710 200GB SSD (RAID 10); cores: 2x12; replication: AlwaysOn Availability Groups, asynchronous |
| 19 | SQL cluster 2 | Talent, OpenID, Chat, exception log, and every other Q&A site (Super User, Server Fault, ...) | SQL Server on Dell R730xd | sql-database | nodes: 1 master NY + 1 replica NY + 1 replica Colorado; ram: 768GB; storage: 3x Intel P3700 2TB NVMe (RAID 0) + 24x 1.2TB 10K SAS (RAID 10); cores: 2x8; replication: AlwaysOn Availability Groups, asynchronous |
| 20 | Data access layer | Dapper micro-ORM over POCOs; legacy LINQ2SQL being retired | Dapper (open source) | (property of app-server, not a node) | storedProcedures: 1 in the entire database, being moved into code |
| 21 | HTTP logging SQL Server | Stores a summary row per HTTP request with ASP.NET/SQL/Redis/tag-engine/Elastic timings | SQL Server on Dell R730xd | data-warehouse | index: clustered columnstore, one per day; ram: 256GB; storage: 2x P3600 2TB NVMe + 16x 6TB SATA RAID 10 |
| 22 | Traffic processing service | Consumes HAProxy syslog, writes request summaries to the logging SQL server and metrics to Bosun | in-house | stream-processor | source: haproxy syslog; sink: sql columnstore + bosun |
| 23 | Bosun + OpenTSDB/HBase | Time-series metric store and alerting engine; rules evaluated against history | Bosun (open source, Go), OpenTSDB on HBase | timeseries-database | ingest: 50k-100k metrics/sec; alerting: threshold + trend |
| 24 | scollector | Metric agent on Windows and Linux hosts, "heavily based on principles from tcollector" | scollector (open source) | monitoring | cpuOverhead: ~5% |
| 25 | Opserver | Single dashboard over SQL Server, Redis, Elasticsearch, HAProxy and application exceptions; built because SQL Server's own availability-group status was unreliable | Opserver (open source) | monitoring | |
| 26 | Grafana | Historical visualisation, reads Bosun through a custom plugin | Grafana | monitoring | dataSource: bosun plugin |
| 27 | Logstash / Elasticsearch / Kibana | Syslog and SNMP logs from HAProxy and network gear | ELK, 6x Dell R720xd | monitoring | rawStorage: 288TB; ram: 192GB per node |
| 28 | Exceptional | Application exception logging into SQL | Exceptional (open source) | monitoring | sink: sql (exception log DB on cluster 2) |
| 29 | PagerDuty + chat | Alert delivery: chat for high-priority errors, PagerDuty for critical | PagerDuty | notification-service | |
| 30 | GitLab (self-hosted) | Source control, on-prem to remove an external dependency from the build path | GitLab, on a VM | ci-pipeline | onPrem: true; publicMirrors: github for OSS |
| 31 | TeamCity | Build orchestration, polls GitLab every 15 seconds; runs on the same VM as GitLab | TeamCity | ci-pipeline | agents: 11 per datacenter, running on the web tier itself; pollInterval: 15s; steps: 9; repos: 8 applications |
| 32 | Rolling deploy script | Drains a web server out of HAProxy, waits for in-flight requests, stops IIS, RoboCopies code, restarts, waits for 3 health checks | PowerShell + RoboCopy | (property of ci-pipeline) | duration: ~2 min for 9 servers; concurrency: 2 of 9 servers out at a time; rollback: none, fix forward |
| 33 | Migrator | Applies idempotent schema migrations to every production database in parallel before code ships | in-house | worker | tracking: filename + hash + timestamp in a Migrations table; abortsOn: hash mismatch; rollback: none |
| 34 | Static asset CDN site | Static assets pre-deployed to a separate site before code rolls, so cache-busting hashes never mismatch mid-roll | not named | cdn | preDeploy: true |
| 35 | VM farm | Hypervisor cluster for internal services (GitLab, TeamCity, utilities) | 2x Dell FX2s chassis, 4x FC630 blades | virtual-machine | ram: 768GB per blade; cores: 2x16; localStorage: none, boots from 2x16GB SD |
| 36 | SAN | Shared storage behind the VM farm | 1x Dell EqualLogic PS6210X + 1x PS6110X | block-storage | disks: 24x 1.2TB SAS and 24x 900GB SAS, RAID 10 |
| 37 | MPLS + OSPF inter-DC link | Replication and failover path between NY and Colorado | not named | network-fabric | primary: 10Gbps MPLS; backup: 2 OSPF routes |
| 38 | Fastly (Teams, 2023) | Public edge for the Azure-hosted Teams product, per-workload service configs, mTLS to the origin | Fastly | cdn | mtlsToOrigin: true |
| 39 | Azure Application Gateway (Teams, 2023) | Layer 7 entry for internal and external traffic in Azure | Azure Application Gateway | load-balancer | subnets: 2 (internal, external) |
| 40 | Azure VMSS (Teams, 2023) | Scale set running six apps per VM: web, API v2, API v3, Scheduler, TeamsDbApi, StackMail, TagServer | Azure VMSS, Standard_D32ds_v5, Packer images | virtual-machine | vms: 4 production; cores: 32; ram: 128GB; deploy: Octopus Deploy rolling, health-checked |
| 41 | AKS-hosted Elasticsearch (Teams, 2023) | Search for Teams after ElasticCloud proved unstable | Elasticsearch on AKS with Elastic Operator | container-orchestrator | replaced: ElasticCloud |
| 42 | Azure Cache for Redis (Teams, 2023) | Managed cache reached over Private Link | Azure Cache for Redis | cache | access: private-link |
| 43 | SQL Server on Azure VMs (Teams, 2023) | Availability group stretched East US primary / West US secondary, and earlier across on-prem and Azure during cutover | SQL Server on Azure VMs; Azure SQL Database for ephemeral test envs | sql-database | replication: availability group, cross-region; primary: East US; secondary: West US read-only |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| client | cloudflare | https | sync | | public DNS + proxy |
| cloudflare | edge-routers | https | sync | | one HAProxy pair is dedicated to CloudFlare-sourced traffic |
| client | edge-routers | https | sync | | direct (non-CloudFlare) traffic; the other HAProxy pair |
| edge-routers | firewalls | ip | sync | | BGP across 4 ISPs, active/active |
| firewalls | haproxy | tcp | sync | | external traffic kept in separate VLANs |
| haproxy | web-servers | http | sync | | TLS terminated at HAProxy; 3 successful health checks before a server re-enters rotation |
| haproxy | traffic-processing-service | syslog | async | best effort | request summaries with timing headers |
| client | socket-server | wss | async | | ~500k concurrent; push-only live counts |
| web-servers | l1-cache | in-process | sync | | checked before Redis |
| web-servers | redis | resp (pipelined) | sync | | L2; no retries — a pipelined command's success is unknowable |
| web-servers | redis-purge-channel | resp publish | async | at-most-once | published *after* the DEL/UNLINK |
| redis-purge-channel | web-servers | resp subscribe | async | at-most-once | fan-out to every web server, including slave-connected clients; flushes matching L1 entries |
| redis-master | redis-slave | redis replication | async | | one master + one slave per datacenter |
| web-servers | sql-cluster-1 | tds | sync | | Dapper over POCOs; 504.8M queries/day |
| web-servers | sql-cluster-2 | tds | sync | | chat, OpenID, Talent, exception log, other Q&A sites |
| sql-master-ny | sql-replica-ny | alwayson | async | | read replica in the same datacenter |
| sql-master-ny | sql-replica-colorado | alwayson over MPLS | async | | DR replica; async, so lag is possible and was once invisible for days |
| web-servers | stack-server (tag engine) | http.sys | sync | | 3.66M requests/day; queries SQL could not afford |
| stack-server | sql-cluster-1 | tds | sync | | loads post/tag changes on a 2-minute interval |
| stack-server (elastic indexer) | sql-cluster-1/2 | tds | sync | | polls ROWVERSION for changed rows |
| stack-server (elastic indexer) | elasticsearch | http | async | | index writes |
| web-servers | elasticsearch | http | sync | | 17.2M searches/day |
| web-servers | providence-api | http | sync | | home-page recommendations, job matching |
| providence-api | providence-redis | resp | sync | | dedicated slaves, separate from the main cache |
| providence-ml-servers | providence-redis | resp | async | | computed predictions written out |
| traffic-log | providence-ml-servers | batch | async | | tag-view features derived from traffic logs |
| traffic-processing-service | http-logging-sql | tds | async | | clustered columnstore, one index per day |
| traffic-processing-service | bosun | http | async | | metrics |
| scollector (every host) | bosun | http | async | best effort | 50k-100k metrics/sec |
| web-servers (BosunReporter) | bosun | http | async | | application metrics |
| bosun | opentsdb/hbase | tsdb | sync | | time-series storage |
| grafana | bosun | http (plugin) | sync | | visualisation and alert backtesting |
| opserver | sql / redis / elasticsearch / haproxy | native | sync | | polls each system directly |
| haproxy + network gear | logstash | syslog / snmp | async | best effort | into ELK |
| bosun | chat | http | async | | high-priority errors |
| bosun | pagerduty | http | async | | critical incidents |
| web-servers | exceptional -> sql | tds | async | | exception log DB |
| gitlab | teamcity | git poll | sync | | polled every 15 seconds |
| teamcity | migrator | msbuild step | sync | | migrations run *before* code deploys, in parallel across all databases |
| teamcity | static-asset-cdn-site | file copy | sync | | pre-deployed before the code roll |
| teamcity (deploy script) | haproxy | admin socket | sync | | DRAIN then mark down, then back up |
| teamcity (deploy script) | web-servers | robocopy / smb | sync | | rolling, ~2 min for 9 servers |
| ny-datacenter | colorado-datacenter | mpls 10Gbps, OSPF backup | async | | replication and failover path |
| client (teams) | fastly | https | sync | | 2023 Azure build |
| fastly | azure-application-gateway | https (mTLS) | sync | | |
| azure-application-gateway | azure-vmss | http | sync | | 4 VMs, six apps each |
| azure-vmss | azure-cache-for-redis | resp over private-link | sync | | |
| azure-vmss | aks-elasticsearch | http | sync | | |
| azure-vmss | sql-server-azure-vms | tds | sync | | |
| sql-east-us | sql-west-us | availability group | async | | cross-region, latency under investigation |
| octopus-deploy | azure-vmss | agent | sync | | rolling; a failed deploy leaves one VM unhealthy while the rest serve |

## Failure modes, incidents, tradeoffs the source discusses
- **Scale up, not out, is the explicit thesis.** Nine web servers are provisioned for a load one can carry: the justification is "rolling builds, headroom, and redundancy", and the post notes "we have unintentionally tested this successfully a few times." The hardware post states the method plainly: "We carefully spec out each server for its intended purpose" rather than bulk-ordering identical machines. (architecture-2016, hardware-2016)
- **Cache invalidation ordering is a correctness requirement, not an optimisation.** The value is deleted from Redis *before* the key name is published to the purge channel; publishing first lets a subscriber re-fetch and re-cache the stale value. (app-caching-2019)
- **Cache stampede is handled in-process, not by locking Redis.** `GetSet<T>()` keeps per-server `ConcurrentDictionary` locks, and beyond `durationSecs` serves stale data up to `serveStaleDataSecs` while a background refresh runs. (app-caching-2019)
- **Output caching was abandoned outright.** Hit rates were too low to pay for themselves — "80% of questions [are] visited only every two weeks" — so Large Object Heap allocation and GC cost more than the cache saved. The stated rule is "only cache if you need to." (app-caching-2019)
- **A one-character TTL refactor silently disabled L1.** A boolean refactor turned the `-1` sentinel into `null`, disabling L1 caching for 95% of keys; all traffic hit Redis for hours before anyone noticed. (app-caching-2019)
- **Redis BGSAVE forked into 6 GB during a migration and crashed Redis**, forcing the site to run with no cache layer while it recovered (Redis 2.x fork bug). (app-caching-2019)
- **A monitoring agent evicted Redis from its CPU cores.** Periodic `vmstat` calls caused random Redis timeouts; fixed by pinning Redis to dedicated cores with processor affinity. The same trick is used deliberately for the tag engine, pinned to a separate CPU socket to preserve L2/L3 cache locality. (app-caching-2019, architecture-2016)
- **A .NET 4.6.2 `DateTime` bug computed a max-age of 2,017 years**, so CDN and browser caches held stale content indefinitely. An earlier `new TimeSpan(60)` (ticks, not seconds) cached pages for microseconds — and "fixing" it actually increased memory and CPU. (app-caching-2019)
- **Async AlwaysOn replica failure hid behind the cache for days.** Cached values carried no timestamp, so a replica that had stopped replicating kept serving plausible data undetected — the reason cache entries now carry provenance. (monitoring-2018)
- **Health checks that accept a 302 are not health checks.** HAProxy counted redirects to an error page as healthy while the backend returned 5xx. (monitoring-2018)
- **Thread-pool starvation on exit from DRAIN.** A server coming back from DRAIN passed health checks in 8-20 seconds when idle but took 2-3 minutes under full load, because cache initialisation starved the thread pool — which is why the rolling deploy waits for three consecutive successful checks. (monitoring-2018, deployment-2016)
- **A health check can pass while the site is broken.** A missing cache reload broke the review-queue indicator in the top bar on every page, and the home-page health endpoint happened to render the master view successfully, so nothing alarmed. (monitoring-2018)
- **DNS is a single point of failure.** The 2016 Dyn attack prompted multiple DNS providers; internal DNS servers are kept cold as a last resort — "Should the apocalypse happen... we'll flip them on." (architecture-2016, monitoring-2018)
- **Redis Cluster and Sentinel were both rejected on purpose.** Cluster does not support Redis databases, which is exactly how keys are organised (one database per site); node-to-node replication topology is incompatible; and with only two physical Redis servers per datacenter the overhead buys nothing. Sentinel's config-file rewrites conflict with Puppet-managed configuration. The stated conclusion is that the current setup is stable enough that migrating is not worth it. (app-caching-2019)
- **Redis commands are never retried.** With pipelining you cannot know whether a command succeeded — the connection is likened to baggage handling, where an item disappears and may or may not arrive. Payloads are therefore kept small enough that one large value cannot cause timeout collateral damage to unrelated commands sharing the connection. (app-caching-2019)
- **Redis is treated as optional.** All cache data is re-populable from source; the only real loss if Redis is down is the light queues it carries (account merges, aggregator, A/B tests). (app-caching-2019)
- **Elasticsearch upgrades are blocked by a full reindex.** The major "types" change requires reindexing everything, and the resources were never allocated — so the cluster stayed on 1.4. (architecture-2016)
- **Elasticsearch was chosen over Solr and over SQL on cost grounds**: SQL CPU is expensive, Elasticsearch is cheaper with more features, and at decision time Solr could not do multi-index network-wide search. (architecture-2016)
- **The Elastic client was deliberately not open sourced**: it "only exposes a very slim subset of the API we use... releasing it would do more harm than good." (architecture-2016)
- **Websockets exhaust ephemeral ports and file handles on the load balancers** at ~500k concurrent connections. (architecture-2016)
- **Stored procedures were designed out.** Exactly one remains in the entire database and it is being moved into code; all new data access is Dapper over POCOs. (architecture-2016)
- **There is no migration rollback tooling, by choice** — the philosophy is to deploy a fix forward. Migrations are idempotent, tracked by filename + hash, and the migrator aborts if a hash no longer matches. (deployment-2016)
- **Static assets are pre-deployed to a separate CDN site before the code rolls**, because a rolling deploy otherwise puts old servers and new cache-busting hashes in the same page. (deployment-2016)
- **On-prem GitLab and on-prem build agents exist to remove an external dependency from the deploy path** — an outside service outage must not block shipping. (deployment-2016)
- **API changes take three deploys** — add the new endpoint, migrate consumers, then clean up — because consumers and producers roll separately. (deployment-2016)
- **Redis cache-object changes must keep protobuf signature compatibility or change key**, otherwise a mid-roll deserialisation mismatch. (deployment-2016)
- **Hardware was the answer to a 2015 CPU problem, not architecture.** New hardware for 2 of 4 SQL servers, all 11 web servers, both Redis servers, 2 of 3 tag engine servers, and a 10 Gbps network upgrade. The framing: "code is only as fast as the hardware it runs on", "performance is still a feature." (architecture-2016, hardware-2016)
- **The cloud move was driven by the SaaS business, not by the public site's scale.** "Running everything on a set number of machines was no longer feasible" once Stack Overflow for Teams took off; the public site stayed put — "we still run stackoverflow.com in an on-premises datacenter." (cloud-part-i, 2023)
- **Splitting the product by customer tier across environments failed.** Business tier in Azure with Free/Basic on-prem fragmented the experience and broke third-party integrations (Slack, Jira, Teams) that could not address two environments; all tiers had to move together. (cloud-part-i)
- **Managed Elasticsearch could not take the tenancy model.** ElasticCloud "would become unresponsive and master nodes randomly failed" because a filtered alias per Team strained the endpoint; the fix was self-hosting on AKS with the Elastic Operator. (cloud-part-ii)
- **Cross-region availability-group latency caused failover timeouts.** The on-prem-to-Azure failover timed out on network latency; they forced Azure primary and re-established an on-prem secondary as backup. East-to-West US AG latency remained under investigation. (cloud-part-ii)
- **A wrong Redis key prefix to the tag engine delayed new questions by five minutes** during Phase II testing. (cloud-part-ii)
- **The cutover was rehearsed, not improvised**: a 27-step migration script practised in dev environments before the 11 March 2023 production run; total programme "almost two years." (cloud-part-ii)

## Unknowns
- Providence's serving internals — how predictions are keyed, refreshed and expired in its Redis, and the batch cadence of the ML jobs. The dedicated architecture post in that series 404s; the surviving post covers the model, not the plumbing.
- Actual failover procedure and RTO/RPO for promoting Colorado. The async replica exists; nothing states how or how fast NY is evacuated, or whether it has ever been done in anger.
- Tag engine internals: the data structure behind tag intersection, its memory footprint, and how the 2-minute reload avoids a visible stall.
- Redis eviction policy and TTL defaults are never stated; only `durationSecs` / `serveStaleDataSecs` semantics are given per call site.
- Websocket server topology: whether the socket servers are the same nine IIS boxes or separate processes, and how 500k connections are distributed across the four HAProxy boxes given the acknowledged port exhaustion.
- No latency percentiles anywhere — only daily averages and total ms. No p95/p99 is published for any path.
- Current (2024-2026) state of the public stackoverflow.com stack. The last first-party architecture description is 2019 for caching and 2016 for topology; the 2023 posts cover only Stack Overflow for Teams.
- Chat, the API and the mobile backend are named as separate applications and databases but never described as boxes with their own flows.

## Candidates
- New kinds: none required. Every box maps to an existing kind; `network-fabric` absorbs the routers, core switches and the MPLS link, and `monitoring` absorbs Opserver/Grafana/ELK/Exceptional.
- New properties on existing kinds:
  - `app-server.multiTenant` (boolean) — one codebase serving 173 sites keyed by a shared Sites database
  - `app-server.cpuAffinity` / `worker.cpuAffinity` (string) — pinning a service to a CPU socket to preserve cache locality, used deliberately for the tag engine and defensively for Redis
  - `cache.tier` (L1 in-process | L2 remote) and `cache.staleServing` (boolean) with `cache.staleWindowSecs`
  - `cache.invalidation` (ttl | delete-then-publish | publish-then-delete) — the ordering is a correctness property
  - `cache.serialization` (protobuf | json | binary)
  - `cache.keyspaceStrategy` (database-per-tenant | prefix-per-tenant | flat) — the reason Redis Cluster was rejected
  - `cache.optional` (boolean) — whether the system is designed to survive total cache loss
  - `sql-database.replication` already exists in spirit; needs `mode: alwayson-async` and `replicaRole: read | dr`
  - `load-balancer.drainMode` (boolean) and `load-balancer.healthChecksToHealthy` (integer)
  - `search-index.rebuildFromSourceOfTruth` (boolean) and `search-index.changeTracking` (rowversion | cdc | poll)
  - `ci-pipeline.rollback` (none-fix-forward | automatic | manual)
  - node-level `scaleStrategy` (up | out) with `instanceCount` — the single most characteristic property of this design
- New requirement paths:
  - `availability.datacenters` (integer) and `availability.drMode` (warm-async | hot-active | none)
  - `cost.scaleStrategy` (scale-up | scale-out) as a stated design constraint
  - `operability.deploysPerDay` (integer) and `operability.deployDurationSec`
- New rules (name + one-line condition):
  - `cache-invalidation-order-unsafe`: a cache with a pub/sub invalidation edge but `invalidation` set to publish-then-delete
  - `async-replica-without-freshness-check`: sql-database with replication async feeding a read path, and no staleness/timestamp property on the cached values downstream
  - `health-check-accepts-redirect`: load-balancer health check whose success criterion includes 3xx
  - `search-index-without-rebuild-path`: search-index with no edge from its source-of-truth database (nothing can reindex it)
  - `cache-required-but-not-replicated`: cache with `optional` false and a single node
  - `single-datacenter-with-async-dr`: availability.datacenters eq 2 and drMode warm-async while availability target implies no data loss
  - `rolling-deploy-without-drain`: ci-pipeline deploying to app-servers behind a load-balancer that has `drainMode` false
  - `static-assets-not-predeployed`: cdn fed by a ci-pipeline that deploys app-servers in a rolling fashion with cache-busting enabled
  - `scale-up-node-without-partner`: node with scaleStrategy up and instanceCount lt 2

## Verification 2026-09-14

The card's own fetch log is dated 2026-09-14, so this pass is a spot check of the two primary
posts that carry every number used in the design. Full log: `work/designs/stack-overflow/verify.md`.

| URL | Reachable | Outcome |
|---|---|---|
| nickcraver.com/blog/2016/02/17/stack-overflow-the-architecture-2016-edition/ | yes | Confirmed: 9 primary web servers (01-09) plus 2 dev/meta; 4 HAProxy load balancers (2 added for CloudFlare); 2 main Redis servers (master/slave) at 256 GB; 3 Elasticsearch nodes per datacenter; 2 SQL Server clusters with AlwaysOn Availability Groups plus Colorado replicas; 209,420,973 HTTP requests/day; 66,294,789 page loads/day; 504,816,843 SQL queries/day; 17,158,874 Elastic searches/day; ~500,000 concurrent websocket connections; CloudFlare in front with self-hosted DNS kept as backup |
| nickcraver.com/blog/2019/08/06/stack-overflow-how-we-do-app-caching/ | yes | Confirmed: per-web-server in-process cache backed by Redis on miss (L1/L2); serve-stale window while a background refresh runs; "Purge the value from Redis ... Broadcast the key to the purge channel. Order is important"; 1,586,553,473 commands/day (3,726,580,897 with replicas, 86,982/sec peak); 2.01% average CPU (3.04% peak); 124,415,398 active keys; under 96 GB used; Redis Cluster and Sentinel both explicitly rejected; commands are never retried; all cache data re-populable from source; protobuf-net |

Not re-fetched in this pass (the card fetched them the same day): hardware-2016,
deployment-2016, monitoring-2018, the two 2023 stackoverflow.blog cloud posts and the
Providence post. Nothing taken from them into the design carries a number.

Facts in the card that this pass could not re-confirm and that are therefore not encoded as
numbers: the tag-engine 3.66M requests/day and the ASP.NET / render-time figures. The tag
engine keeps only `nfr.rps: 42` (3.66M/day divided out), recorded as such in notes.md.
