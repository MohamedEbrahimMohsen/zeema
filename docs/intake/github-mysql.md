# Intake: GitHub core serving architecture (Rails monolith, MySQL HA, GLB, Spokes)

## Source
- Primary: https://github.blog/engineering/infrastructure/mysql-high-availability-at-github/ (Shlomi Noach, GitHub database infrastructure engineer, GitHub engineering blog, 2018)
- Primary: https://github.blog/engineering/infrastructure/glb-director-open-source-load-balancer/ (Theo Julienne, GitHub infrastructure engineer, GitHub engineering blog, 2018)
- Primary: https://github.blog/engineering/infrastructure/introducing-glb/ (GitHub infrastructure engineers, GitHub engineering blog, 2016)
- Primary: https://github.blog/engineering/infrastructure/partitioning-githubs-relational-databases-scale/ (GitHub database infrastructure team, GitHub engineering blog, 2022; numbers stated for 2021)
- Primary: https://github.blog/engineering/infrastructure/introducing-dgit/ (GitHub engineering blog, 2016)
- Primary: https://github.blog/engineering/infrastructure/stretching-spokes/ (GitHub engineering blog, 2016)
- Primary: https://github.blog/news-insights/company-news/oct21-post-incident-analysis/ (GitHub infrastructure leadership, official post-incident analysis, 2018)
- Primary: https://github.blog/engineering/architecture-optimization/building-github-with-ruby-and-rails/ (GitHub engineering blog, 2023)
- Primary: https://github.blog/news-insights/introducing-resque/ (Chris Wanstrath, GitHub co-founder, GitHub blog, 2009)
- Primary: https://github.blog/news-insights/company-news/github-availability-report-august-2023/ (GitHub official incident report, 2023)
- Primary: https://github.blog/news-insights/company-news/github-availability-report-october-2020/ (GitHub official incident report, 2020)
- Primary: https://github.com/github/glb-director (GitHub's own open-source project README, 2018)
- Verified by: official GitHub engineering blog (eight posts), official GitHub incident reports (three, including the October 21 2018 post-incident analysis), GitHub open-source project README
- Confidence: high
- Date of source: 2009, 2016, 2018, 2020, 2022, 2023

## System in three lines
GitHub.com serves repositories, issues, pull requests and the API from a single Ruby on Rails monolith backed by partitioned MySQL clusters and by Spokes (formerly DGit), a three-replica application-layer Git storage system. Traffic enters through GLB, a split L4 director / L7 HAProxy load balancer that spreads one IP across commodity machines, and writes reach whichever MySQL primary orchestrator/raft currently elects, published through Consul into the HAProxy writer pools. It is hard because Git is latency-sensitive and write-quorum bound, because MySQL primaries must fail over in seconds without a cooperative dead primary, and because the databases are being split vertically by schema domain and horizontally with Vitess underneath a live monolith.

## Scale (only if stated)
- Requests per second: the original `mysql1` cluster served 950,000 queries/second (50,000 QPS on its primary); after vertical partitioning the same tables served 1,200,000 queries/second combined, 75,000 QPS across primaries, with average host load cut by 50% (https://github.blog/engineering/infrastructure/partitioning-githubs-relational-databases-scale/)
- Connection volume: GLB was built to serve "billions of HTTP, Git, and SSH connections daily"; the director tier handles "tens of thousands of requests every second" (https://github.blog/engineering/infrastructure/introducing-glb/, https://github.blog/engineering/infrastructure/glb-director-open-source-load-balancer/)
- Codebase and change rate: nearly 2 million lines of Ruby, 1,000+ engineers, up to 20 deploys a day (https://github.blog/engineering/architecture-optimization/building-github-with-ruby-and-rails/)
- Repository storage adoption at time of writing: "58% of repositories and 96% of Gists, representing 67% of Git operations, are in DGit" (https://github.blog/engineering/infrastructure/introducing-dgit/)
- Background jobs: "over 10m jobs since our move to Rackspace" on Resque, 2009 (https://github.blog/news-insights/introducing-resque/)
- Failover duration: "Between `10 and 13 seconds` of total outage time in most cases", up to 20s in less frequent scenarios, up to 25s in extreme cases (https://github.blog/engineering/infrastructure/mysql-high-availability-at-github/)
- Incident backlog: "over five million hook events and 80 thousand Pages builds queued" during the 2018 outage (https://github.blog/news-insights/company-news/oct21-post-incident-analysis/)
- Migration cutover: the six write-cutover steps take "only a few tens of milliseconds for our busiest database tables"; 130 of the busiest tables moved at once (https://github.blog/engineering/infrastructure/partitioning-githubs-relational-databases-scale/)
- GLB forwarding table: 65,536 rows, approximately 512KB (https://github.blog/engineering/infrastructure/glb-director-open-source-load-balancer/)
- Users / DAU, data volume, message throughput: not stated in the fetched posts

## Requirements stated or clearly implied
- Availability target (SLA / regions / must survive region loss): multiple data centers and POPs; MySQL primaries are per-cluster and cross-DC promotion was possible until it was explicitly disallowed after 2018 ("Configure Orchestrator to prevent the promotion of database primaries across regional boundaries"). Post-incident remediation also names accelerating an active/active/active deployment for N+1 redundancy.
- Consistency (strong / eventual / per-entity): MySQL semi-synchronous replication with a 500ms timeout, under which GitHub expects "(though do not strictly enforce) a lossless failover"; "Lossless failover on a complete DC failure is costly and we do not expect it". MySQL transactions guarantee consistency only within one database, so cross-schema-domain transactions lose their guarantee once the domains are physically separated. Git writes are quorum: "Writes are synchronously streamed to all three replicas and are only committed if at least two replicas confirm success."
- Latency target (p50 / p95 / p99 and for which path): not quantified. Stated targets: "a few updates per second in a single repository" within "a few hundred milliseconds per update" for cross-DC Git ref updates; Git storage uses "fast, local SSDs" because "Git is very sensitive to latency".
- Ordering needs (global / per-key / none): per-repository ordering for Git ref updates (transactional ref updates under a three-phase commit); per-cluster GTID ordering for MySQL cutovers.
- Replay or reprocessing needs: background jobs must not be lost — "No background jobs were lost during this incident" — via redundant systems and retry behaviour; a standby job queueing service exists and load can be shifted to it.
- Retention (data / messages / logs): not stated.
- Compliance / residency (PCI, GDPR, region pinning): not stated in the fetched posts.
- Operational requirement: draining a proxy or promoting a primary must not break in-flight connections — GLB "avoids breaking TCP connections during normal operation and failover" and "keeps existing connections mapped to their existing proxy server, even after they are removed from rotation for new connections".

## Boundaries
- Regions / zones mentioned: US East Coast primary data center, US East Coast network hub, US West Coast data center, public cloud (used for orchestrator raft nodes); "multiple data centers and POPs" for GLB.
- Trust zones: public internet -> ECMP routers and the GLB director tier (L4) -> GLB proxy tier (HAProxy, L7) -> Rails app tier -> internal data tier (MySQL, Spokes fileservers, Redis, Kafka). Consul, orchestrator and consul-template sit in the internal control plane; Consul is per-DC with no cross-DC replication of its data.
- Named subsystems / bounded contexts: GLB (director, proxy, glb-healthcheck, glb-redirect), orchestrator/raft, Consul + consul-template, MySQL clusters (`mysql1` and the clusters split out of it), Vitess (VTGate, VTablet, VReplication), ProxySQL, Spokes/DGit fileservers, the Rails monolith, the job queueing service (Kafka consumer group + dispatcher + workers), Resque/Redis, webhooks, GitHub Actions, GitHub Pages.
- Schema domains are explicit logical boundaries inside the monolith, declared in `db/schema-domains.yml`, with a linter requiring every table to belong to exactly one domain (example: the `gists` domain holds `gists`, `gist_comments`, `starred_gists`).

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Clients (HTTP, Git, SSH) | Browsers, git CLI and API consumers opening long-lived Git/SSH and short HTTP connections | not stated | client | protocols: https, git, ssh; "billions of HTTP, Git, and SSH connections daily" |
| 2 | ECMP routers | Announce one service IP and spread flows over director servers by consistent hash | not stated (BGP/ECMP on network gear) | network-fabric | hash: source and destination IP plus source and destination port; topology change reshuffles flows without the director tier |
| 3 | GLB director | Stateless L4 tier: looks a flow up in a static forwarding table, encapsulates in GUE and forwards to a proxy pair | GLB Director (github/glb-director), DPDK | load-balancer | stateless: true; table 65,536 rows, ~512KB; hash: rendezvous variant with constant-time lookup; encapsulation: GUE; return path: direct server return; "Director servers can come and go at any time" |
| 4 | GLB forwarding table | Precomputed primary/secondary proxy pair per row, recomputable from the server list alone | in-house | (property of load-balancer) | invariants: relative server order preserved, each server at most once per row, roughly equal distribution across columns; "only 1/n connections are reset" on change |
| 5 | glb-healthcheck | Validates each proxy over the GUE tunnel and over HTTP, swaps primary/secondary on failure | glb-healthcheck (github/glb-director) | monitoring | on failure: swap primary/secondary entries, a "soft drain" of the server |
| 6 | glb-redirect netfilter module | On the proxy, decides whether the inner TCP packet belongs to a local connection; if not, forwards it to the secondary proxy | glb-redirect (custom Netfilter module + iptables target) | (property of load-balancer: second chance) | validates the inner TCP/IP packet inside every GUE packet against the local kernel TCP stack |
| 7 | GLB proxy tier | L7 termination and HTTP/Git/SSH proxying; holds all TCP connection state | HAProxy (nginx named as the same class of service) | load-balancer | tier: l7; stateful: true; invariant: "no more than one proxy server at a time is in any state other than active" |
| 8 | Rails monolith (github.com) | The application tier serving web, API, Git auth and business logic | Ruby on Rails, Ruby 3.2 | app-server | ~2,000,000 lines of code; 1,000+ engineers; up to 20 deploys/day; Rails bumped weekly to main; progressive rollout deploys and release candidates taking production traffic |
| 9 | MySQL cluster primary | Single writable node per cluster whose identity is published to Consul rather than owned via a VIP | MySQL | sql-database | role: primary; semi-sync timeout 500ms; positioning via Pseudo-GTID; exactly one writable backend per cluster in HAProxy |
| 10 | MySQL replicas | Read replicas and promotion candidates in each cluster's replication tree | MySQL | sql-database | semi-synchronous replication (local and typically remote DC) with an async tree below; the replication tree is "fixed asynchronously" after a promotion |
| 11 | `mysql1` cluster | The original main cluster holding repositories, issues, pull requests and 130 other busy tables | MySQL | sql-database | before: 950,000 QPS total / 50,000 QPS on the primary; after the split: 1,200,000 QPS total / 75,000 QPS across primaries; average host load -50% |
| 12 | Schema domains | Logical (virtual) partition of tables into groups used together in queries and transactions | in-house (`db/schema-domains.yml` in the Rails app) | (property of sql-database: partition scheme) | every table belongs to exactly one domain; example domain `gists` = gists, gist_comments, starred_gists |
| 13 | Query linter and transaction linter | Block queries that span schema domains and sample production transactions that do | in-house (Rails/ActiveRecord) | policy-engine | exemption annotation `/* cross-schema-domain-query-exempted */`; the transaction linter runs in production with sampling |
| 14 | Vitess VTGate | MySQL-protocol endpoint the application connects to instead of MySQL directly; performs the vertical sharding | Vitess VTGate | database-proxy | deployed in GitHub's Kubernetes clusters; feature used: vertical sharding |
| 15 | Vitess VTablet | Per-MySQL-instance agent managing the instance behind VTGate | Vitess VTablet | database-proxy | not further specified |
| 16 | VReplication | Moves table sets between clusters without downtime | Vitess VReplication | change-data-capture | no downtime during the copy |
| 17 | ProxySQL | Routing layer the custom write-cutover path repoints at the destination primary | ProxySQL | database-proxy | cutover step 5 updates ProxySQL routing |
| 18 | orchestrator / raft | Detects primary failure holistically and promotes the ideal candidate replica; raft quorum spans DCs | orchestrator (open source, GitHub) | coordination-service | consensus: raft; one leader per raft cluster; nodes in the primary DC, the US West DC and public cloud; the deciding node is outside an isolated DC |
| 19 | Consul (per DC) | Highly available KV store holding each cluster's primary identity (FQDN, port, IPv4, IPv6) | HashiCorp Consul | coordination-service | independent per DC, no cross-DC replication of Consul data; "If Consul happens to be down, GLB continues to operate with the last known values" |
| 20 | consul-template | Runs on every GLB/HAProxy node, watches Consul KV and rewrites plus reloads HAProxy backends | HashiCorp consul-template | (property of load-balancer: config watcher) | reload uses HAProxy `hard-stop-after` to terminate connections to the old primary |
| 21 | HAProxy writer pool | Per-cluster pool containing exactly one backend, the current primary; identical backend lists in every DC | HAProxy | load-balancer | tier: database writer proxy; backends per cluster: 1; anycast name resolves to the local DC's GLB cluster |
| 22 | Spokes / DGit fileservers | Hold three full copies of every repository on local SSD and serve them with Git and libgit2 | Git and libgit2 on local SSD | file-storage | three copies on three different servers; fast local SSDs; reads from any replica; repositories absorb "nearly three times the traffic" |
| 23 | Spokes proxy | Front end for Git traffic that transparently replicates writes to the fileservers and routes reads | in-house ("a proxy, which transparently replicates") | database-proxy | write quorum 2 of 3 synchronous; reads go to "the closest replica that is in sync"; replaced DRBD block-level replication |
| 24 | Spokes repair / rebalance | Finds repositories with fewer than three replicas and recreates them on other fileservers | in-house | worker | "N-by-N" throughput; happens "without any downtime" |
| 25 | Spokes checksum | Incremental repository checksum used to compare replicas | in-house (XOR of ref hashes) | (property of file-storage) | `new_checksum = old_checksum XOR hash(refname, oldvalue) XOR hash(refname, newvalue)` |
| 26 | Job queueing service | Accepts and records background jobs, then dispatches them to workers | Kafka consumer group plus an in-house dispatcher | queue | named parts: Kafka consumer group, dispatcher, workers; a standby service exists and can take the load |
| 27 | Kafka cluster (background jobs) | The log backing the internal background job system | Apache Kafka with ZooKeeper | stream | "the cluster that powers our internal background job system"; ZooKeeper-coordinated controller election |
| 28 | Background job workers | Execute webhook deliveries, Actions triggers, Pages builds and other async work | not stated for the current platform; Resque historically | worker | jobs delayed up to an hour with no data loss in the 2023 incident |
| 29 | Resque + Redis | Original Redis-backed multi-queue background job system with forking parent/child workers | Resque, Redis | queue | multiple named queues ("tags") routed to machines or worker pools; parent/child forking keeps Rails loaded; swappable failure backends; web UI |
| 30 | Webhook delivery | Delivers hook events to third parties; queues when dispatch stalls | in-house | webhook-endpoint | backlog reached "over five million hook events" in 2018 |
| 31 | GitHub Pages builds | Build jobs queued through the same background job platform | in-house | worker | backlog reached "80 thousand Pages builds" in 2018 |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| client | ecmp-routers | tcp (https, git, ssh) | sync | not stated | one IP announced from many director servers |
| ecmp-routers | glb-director | ip | sync | not stated | consistent hash over the 4-tuple |
| glb-director | glb-proxy (primary) | GUE over UDP | sync | not stated | the secondary proxy IP travels in the GUE private data |
| glb-proxy (primary) | glb-proxy (secondary) | GUE over UDP | sync | not stated | "second chance" via glb-redirect when the packet is not a local connection |
| glb-proxy | client | tcp | sync | not stated | direct server return, bypasses the director tier |
| glb-healthcheck | glb-proxy | GUE tunnel plus http | sync | not stated | failure swaps primary/secondary, a soft drain |
| glb-proxy (haproxy) | rails-monolith | http | sync | not stated | the L7 tier fronts the app servers |
| rails-monolith | vtgate | mysql protocol | sync | not stated | "instead of direct connections to MySQL" |
| rails-monolith | haproxy-writer-pool | mysql protocol | sync | not stated | anycast name resolves to the local DC's GLB |
| haproxy-writer-pool | mysql-primary | mysql protocol | sync | not stated | exactly one backend per cluster |
| vtgate | vttablet | not stated | sync | not stated | VTablet manages the MySQL instance |
| vttablet | mysql primary/replica | mysql protocol | sync | not stated | |
| mysql-primary | mysql-replica | mysql replication | sync (semi-sync, 500ms timeout) then async | semi-sync ack from a replica within 500ms, else degrades | Pseudo-GTID for position tracking; lossless failover expected, not enforced |
| source-cluster-primary | destination-cluster-primary | mysql replication with GTID | async during copy, sync at the cutover | GTID checkpoint confirmed before switching | six-step write cutover, tens of milliseconds |
| vreplication | destination cluster | mysql | async | not stated | moves table sets without downtime |
| orchestrator-node | mysql-cluster | mysql protocol | sync | not stated | holistic failure detection |
| orchestrator-leader | mysql-replica (promotion target) | mysql | sync | not stated | "The flow does not need the dead primary's cooperation" |
| orchestrator-node | orchestrator-node | raft | sync | quorum | the deciding leader is outside the isolated DC |
| orchestrator-node | consul (local DC) | http kv | sync | not stated | each node writes the new primary identity into its own DC's Consul |
| consul | consul-template | http kv watch | async | last known value if Consul is down | |
| consul-template | haproxy | config reload | sync | not stated | `hard-stop-after` terminates connections to the demoted primary |
| rails-monolith | spokes-proxy | git / internal (not stated) | sync | not stated | all Git reads and writes |
| spokes-proxy | fileserver replica (x3) | git protocol | sync | committed only if at least 2 of 3 replicas confirm | three-phase commit, "four round-trips to the distant replicas" across DCs |
| spokes-proxy | nearest in-sync fileserver | git protocol | sync | not stated | reads served from the closest in-sync replica |
| spokes-repair | fileserver | git protocol | async | not stated | recreates under-replicated repositories, N-by-N throughput |
| rails-monolith | job-queueing-service | not stated | async | work recorded on enqueue even when dispatch is stalled | "the service continued to accept and record incoming work, it was unable to pass jobs on to workers" |
| job-queueing-service | kafka | kafka | async | no jobs lost across the 2020 and 2023 incidents | |
| kafka | dispatcher (consumer group) | kafka | async | consumer-group semantics with retries | short session timeouts plus CPU throttling caused a rebalance loop |
| dispatcher | workers | not stated | async | retry behaviour named as a mitigation | |
| workers | webhook-endpoint | https | async | retried | 5M event backlog in 2018 |
| workers | pages-build | internal | async | not stated | 80k build backlog in 2018 |
| rails-monolith | resque (redis) | redis | async | not stated | historical background job path, multiple named queues |
| kafka-broker | zookeeper | zookeeper | sync | not stated | controller election; a second ZK cluster produced a rogue controller |

## Failure modes, incidents, tradeoffs the source discusses
- October 21 2018, the defining incident: "routine maintenance work to replace failing 100G optical equipment resulted in the loss of connectivity between our US East Coast network hub and our primary US East Coast data center. Connectivity between these locations was restored in 43 seconds." A 43-second partition produced 24 hours and 11 minutes of degradation. Source: https://github.blog/news-insights/company-news/oct21-post-incident-analysis/
- Cross-region automatic promotion turned a blip into a split brain: the West Coast and public-cloud orchestrator nodes "were able to establish a quorum and start failing over clusters to direct writes to the US West Coast data center", and afterwards "the database clusters in both data centers now contained writes that were not present in the other data center, we were unable to fail the primary back over to the US East Coast data center safely." Remediation: configure orchestrator to prevent the promotion of primaries across regional boundaries. Same source.
- Recovery priority: "our strategy was to prioritize data integrity over site usability and time to recovery", and "we decided that the 30+ minutes of data written to the US West Coast data center prevented us from considering options other than failing-forward in order to keep user data safe." Same source.
- Backlog is a second outage: after the databases were consistent at 16:24 UTC the status stayed red until 23:03 UTC while "over five million hook events and 80 thousand Pages builds queued" drained. Same source.
- Split brain is accepted, not prevented: "On a data center isolation scenario... apps in that DC are still able to write to the primary. This may result in state inconsistency once network is brought back up... The operational cost of avoiding split-brains altogether is very high." Source: https://github.blog/engineering/infrastructure/mysql-high-availability-at-github/
- VIP and DNS rejected for primary discovery: "VIPs are cooperative: they are claimed and owned by the database servers themselves... two hosts claiming to have the same VIP. Different clients may connect to either." Same source.
- Failover must not depend on the dead node: "The flow does not need the dead primary's cooperation. It is largely ignored." Same source.
- The control plane degrades rather than fails: "We do not strictly require Consul to be available at all times... If Consul happens to be down, GLB continues to operate with the last known values." Same source.
- Lossless failover is scoped, not universal: with the 500ms semi-sync timeout "we observe perfect semi-sync behavior" and "we expect (though do not strictly enforce) a lossless failover. Lossless failover on a complete DC failure is costly and we do not expect it." Same source.
- Raft leadership must live outside the failure domain: "A DC network isolation can cause confusion: servers within that DC can talk to each other", so "the `orchestrator` node that calls the shots will be one that is outside the network isolated data center." Same source.
- Naive ECMP breaks connections, which is the whole reason for the director tier: with the rendezvous-hash forwarding table "when changes are made to the forwarding table only 1/n connections are reset". Source: https://github.blog/engineering/infrastructure/glb-director-open-source-load-balancer/
- Draining without dropping Git clones: "As a proxy server transitions to draining, we adjust the entries in the forwarding table by swapping the primary and secondary entries... This has the effect of sending packets to the server that was previously secondary first", and the design "keeps existing connections mapped to their existing proxy server, even after they are removed from rotation for new connections". Sources: the GLB open-source post and https://github.blog/engineering/infrastructure/introducing-glb/
- The drain mechanism carries a hard operational invariant: "no more than one proxy server at a time is in any state other than active, which in practise has worked well at GitHub." Source: the GLB open-source post.
- Block-level replication was the wrong layer for Git: Spokes replaced DRBD with "three loosely-coupled Git repositories kept in sync via Git protocols", that is, "replication at the application layer". Sources: https://github.blog/engineering/infrastructure/introducing-dgit/ and https://github.blog/engineering/infrastructure/stretching-spokes/
- Quorum writes trade round-trips for survivability: "Writes are synchronously streamed to all three replicas and are only committed if at least two replicas confirm success", and across data centers the three-phase commit requires "four round-trips to the distant replicas". Same sources.
- Bookkeeping starves users unless prioritised: Spokes "prioritize[s] user-initiated updates over bookkeeping updates" so cascading reference operations do not block user requests. Source: Stretching Spokes.
- Cross-schema-domain queries and transactions are the real cost of partitioning: MySQL transactions guarantee consistency only within one database, so the transaction linter runs in production with sampling; the fixes were `preload` instead of `includes`, Rails 7's `disable_joins`, and application-layer joins, which sometimes yielded surprising performance improvements. Source: https://github.blog/engineering/infrastructure/partitioning-githubs-relational-databases-scale/
- Vitess was not trusted for every migration: deployment topology and read-your-writes support kept GitHub on its own write-cutover process for some moves, built "as a risk-mitigation strategy", with six steps taking "only a few tens of milliseconds for our busiest database tables". Same source.
- Partitioning paid off measurably: 950k QPS on one cluster became 1.2M QPS across several with 50% lower average host load, which significantly decreased database-related incidents. Same source.
- A Kafka consumer-group rebalance loop stalled all async work (August 29 2023, 49 minutes): "The component of our job queueing service responsible for dispatching jobs to workers failed due to an interaction with unexpected CPU throttling and short session timeouts for a Kafka consumer group. The Kafka consumer ended up stuck in a loop, unable to stabilize fast enough before timing out and restarting the coordination process." Enqueue survived, dispatch did not; recovery was "shifting the load to the standby service as well as redeploying the primary service." Source: https://github.blog/news-insights/company-news/github-availability-report-august-2023/
- A ZooKeeper split produced a rogue Kafka controller (October 2020): new ZK hosts "were introduced too quickly, which resulted in the election of a second leader", then "A single Kafka broker in the cluster that powers our internal background job system connected to the newly-formed second ZooKeeper cluster and elected itself as the Kafka controller", causing "write failures for approximately 10% of the requests to our background job service". Traffic and worker capacity moved "to our secondary job processing system" and "No background jobs were lost during this incident." Source: https://github.blog/news-insights/company-news/github-availability-report-october-2020/
- Continuous small upgrades beat big-bang migrations: weekly automated Rails-main bumps eliminated "big bang" migrations and let GitHub adopt Ruby 3.2.1 on release day. Source: https://github.blog/engineering/architecture-optimization/building-github-with-ruby-and-rails/
- Job systems churn: Resque itself replaced "SQS, Starling, ActiveMessaging, BackgroundJob, DelayedJob, and beanstalkd", each change made out of necessity when hitting the limits of the previous system. Source: https://github.blog/news-insights/introducing-resque/

## Unknowns
- How the Rails monolith reaches the Spokes proxy: the protocol and the name of the Git routing component are not given in the fetched posts.
- The horizontal sharding scheme: the partitioning post says horizontal partitioning will be detailed in future documentation and names no sharding key, shard count, or resharding process.
- Whether GLB still fronts the database writer pools today, and whether orchestrator is still the failover controller after the 2018 remediation.
- The current background job platform's own name, its enqueue protocol from Rails, its retry and dead-letter policy, and whether Resque remains in the path alongside Kafka.
- Caching tier: Redis appears only as Resque's store; no application cache (memcached or Redis) is described in the fetched posts.
- Code search, the Actions runner fleet, and the CDN/POP edge internals are outside the fetched sources.
- Region and DC counts, per-cluster replica counts, fileserver counts, and total repository storage volume are not stated.
- No latency SLOs (p50/p95/p99) are published for the Git or HTTP paths.
- Vitess adoption breadth: the post states that deployment topology and read-your-writes support prevented using Vitess for every migration at that time; the current split between Vitess-managed and directly-managed clusters is not stated.

## Candidates
- New kinds: none required. Every box maps to an existing catalogue kind (client, network-fabric, load-balancer, app-server, sql-database, database-proxy, change-data-capture, coordination-service, policy-engine, file-storage, worker, queue, stream, monitoring, webhook-endpoint).
- New properties on existing kinds:
  - `load-balancer.tier` (l4-director, l7-proxy) and `load-balancer.stateless` (boolean)
  - `load-balancer.encapsulation` (none, gue, ipip, gre) and `load-balancer.returnPath` (through-lb, direct-server-return)
  - `load-balancer.flowHash` (ecmp, rendezvous, maglev, consistent) and `load-balancer.secondChance` (boolean)
  - `load-balancer.drainPreservesConnections` (boolean)
  - `sql-database.failoverController` (none, orchestrator, managed) and `sql-database.failoverSeconds` (integer)
  - `sql-database.primaryDiscovery` (vip, dns, kv-store, proxy) — the source argues explicitly against vip and dns
  - `sql-database.semiSyncTimeoutMs` (integer)
  - `sql-database.partitionScheme` (none, vertical-by-domain, horizontal, both)
  - `coordination-service.scope` (per-dc, global) and `coordination-service.degradesToLastKnown` (boolean)
  - `file-storage.replicas` (integer), `file-storage.writeQuorum` (integer), `file-storage.replicationLayer` (block, application)
  - `queue.standbyService` (boolean)
  - `stream.consumerGroupSessionTimeoutMs` (integer)
  - `app-server.deploysPerDay` (integer)
- New requirement paths:
  - `availability.crossRegionPromotionAllowed` (boolean)
  - `consistency.splitBrainTolerated` (boolean)
  - `consistency.losslessFailoverScope` (none, same-dc, cross-dc)
  - `data.partitionBoundaryEnforced` (boolean) — the schema-domain linter expressed as a requirement
- New rules (name + one-line condition):
  - `cross-region-automatic-promotion`: a failover controller whose quorum members span regions while `availability.crossRegionPromotionAllowed` is false
  - `raft-quorum-inside-single-failure-domain`: coordination-service with all voters inside one data center
  - `primary-discovery-via-vip`: sql-database with `primaryDiscovery` vip or dns and clients in more than one DC
  - `writer-pool-without-hard-stop`: a database writer proxy whose config reload does not terminate connections to the demoted primary
  - `l4-lb-without-connection-preserving-drain`: load-balancer of tier l4-director with `drainPreservesConnections` false in front of long-lived connections (git, ssh, websocket)
  - `cross-partition-transaction`: a transaction spanning two declared partition boundaries with no linter or exemption annotation
  - `async-dispatch-single-point`: a queue whose dispatcher has no standby while the downstream work is user-visible (webhooks, builds)
  - `backlog-recovery-unbounded`: an async consumer with no stated drain rate behind a queue that can accumulate millions of events
  - `quorum-write-across-distant-dcs`: file-storage with writeQuorum greater than 1 and replicas placed across regions with no stated per-update latency budget
