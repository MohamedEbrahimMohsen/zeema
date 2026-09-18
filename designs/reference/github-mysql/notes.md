# github-mysql: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/github-mysql.md` (eight GitHub engineering blog posts, three official incident reports, the github/glb-director README; re-verified 2026-09-14).
- Size: 24 nodes, 28 edges, 6 groups (broken twin: 22 nodes, 25 edges, 6 groups).

## Clean variant (header of design.yaml)

GitHub's core serving path: GLB's split L4 director / L7 HAProxy tier in front of the Rails
monolith, MySQL clusters whose primary identity is published through Consul, Spokes three-replica
Git storage, and a Kafka-backed background job platform.

Fixes relative to github-mysql.broken.yaml:
  - mysql1 is split vertically by schema domain: vtgate fronts the clusters, a destination
    cluster primary receives the moved tables, and no single primary carries the whole load
  - mysql-primary replicates semi-synchronously (500ms timeout) instead of leaning on async
    read replicas as its only way to scale
  - consul is replicated, so the identity of every cluster primary survives the loss of a node
  - the job queueing service records work durably and parks poison jobs in a dead-letter queue
  - the Rails monolith enqueues asynchronously; the dispatcher, not the request path, hands
    jobs to workers, and dispatch retries are not modelled as an unguarded retry loop
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

GitHub's core serving path as a team commonly builds it first: one unsplit `mysql1` cluster
carrying every busy table behind async read replicas, a single Consul holding the identity of
every cluster primary, and a background job platform whose dispatcher sits on the request path
and retries into the workers with nothing to stop it.

This file MUST trip:
  - single-writer-primary-at-peak-qps    (mysql-primary: one unsharded writer declared at 50000 qps)
  - read-replica-as-sole-scaling         (mysql-primary: async replicas are its only scaling above 5000 qps)
  - shared-dependency-without-redundancy (consul is not replicated while discovery must be redundant)
  - queue-missing-dlq                    (job-queueing-service takes async enqueues with no dead-letter queue)
  - fanout-inline-in-request-path        (rails-monolith calls job-dispatcher, a worker, synchronously)
  - retry-without-adaptive-shedding      (job-dispatcher -> job-workers retries with no circuit breaker or rate limiter)
and MUST NOT trip:
  - datastore-missing-backup, datastore-single-region (every MySQL node is backed up; multiRegion is false)
  - stateful-engine-pinned-to-single-zone, stateful-node-without-zone-redundancy (no availability-zone group)
  - read-heavy-path-without-cache        (no traffic.readWriteRatio requirement is declared)
  - retry-queue-without-dlq, retry-without-backoff (the queue's role is work, not retry)
  - shared-worker-pool-across-queues     (no isolation.perQueue requirement)
  - credentials-without-rotation         (security.credentialRotationDays is declared)
  - push-fanout-without-celebrity-path   (no worker pushes fan-out, no graph-database)
  - webhook-without-signature-or-idempotency, derived-store-without-cdc-or-rebuild,
    cache-as-primary-store-without-persistence, queue/pubsub/object-store/money rules (no such nodes)

The 50,000 QPS on `mysql-primary` in the broken twin is the source's own figure for the original
`mysql1` primary before the vertical split; the broken twin is the architecture that never made
that split. The clean design carries no `nfr.rps` at all, because every published number
(950k / 1.2M queries per second, 75k QPS across primaries, billions of daily connections) belongs
to a fleet rather than to a single box.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Clients (HTTP, Git, SSH) | `client` | `user-device` | client | exact |
| ECMP routers | `ecmp-routers` | `spine-leaf-fabric` | network-fabric | assumed |
| GLB director (+ forwarding table) | `glb-director` | `load-balancer-tier` | load-balancer | close |
| glb-healthcheck | `glb-healthcheck` | `observability-stack` | monitoring | close |
| GLB proxy tier (+ glb-redirect second chance) | `glb-proxy` | `haproxy` | load-balancer | exact |
| Rails monolith (github.com) | `rails-monolith` | `container-service` | app-server | close |
| Spokes proxy | `spokes-proxy` | `container-service` | app-server | close |
| Vitess VTGate (and VTablet) | `vtgate` | `vitess` | database-proxy | exact |
| ProxySQL | `proxysql` | `proxysql` | database-proxy | exact |
| HAProxy writer pool (+ consul-template) | `haproxy-writer-pool` | `haproxy` | load-balancer | exact |
| MySQL cluster primary / `mysql1` cluster | `mysql-primary` | `mysql` | sql-database | exact |
| Destination cluster of a schema-domain move (VReplication / write cutover) | `mysql-partition-target` | `mysql` | sql-database | close |
| MySQL replicas | `mysql-replica` | `mysql` | sql-database | exact |
| orchestrator / raft | `orchestrator` | `apache-helix` | coordination-service | assumed |
| Consul (per DC) | `consul` | `consul` | coordination-service | exact |
| Spokes / DGit fileservers (+ checksum) | `spokes-fileservers` | `file-store` | file-storage | close |
| Spokes repair / rebalance | `spokes-repair` | `container-worker` | worker | exact |
| Job queueing service | `job-queueing-service` | `message-queue` | queue | close |
| Kafka cluster (background jobs) | `kafka` | `kafka` | stream | exact |
| ZooKeeper (Kafka controller election) | `zookeeper` | `zookeeper` | coordination-service | exact |
| Dispatcher (Kafka consumer group) | `job-dispatcher` | `container-worker` | worker | exact |
| Background job workers | `job-workers` | `container-worker` | worker | exact |
| Webhook delivery | `webhook-delivery` | `container-worker` | worker | close |
| GitHub Pages builds | `pages-builder` | `container-worker` | worker | exact |

Tally: 13 exact, 9 close, 2 assumed.

Source boxes deliberately not given a node of their own:
- **GLB forwarding table** (card row 4) and **glb-redirect** (row 6): the card itself calls both a
  property of the load balancer; they are carried on `glb-director` (`hashing`,
  `connectionPreserving`) and on the edge labels.
- **Spokes checksum** (row 25) and **schema domains** (row 12): the card calls both a property.
- **consul-template** (row 20): a property of the writer pool; it is the `consul` ->
  `haproxy-writer-pool` edge, whose label carries `hard-stop-after`.
- **Vitess VTablet** (row 15) and **VReplication** (row 16): folded into `vtgate` and into the
  `mysql-primary` -> `mysql-partition-target` copy edge, to stay within the 25-node budget.
- **Query and transaction linter** (row 13): a build-time and sampling-time linter over the Rails
  codebase, not a runtime element on any request path.
- **Resque + Redis** (row 29): the 2009 job system. The card's own Unknowns say whether Resque is
  still in the path alongside Kafka is not stated, so the design encodes only the Kafka-backed
  platform the incident reports describe.

## Catalogue gaps

| Product | Kind it would need | Used instead |
|---|---|---|
| BGP/ECMP internet-facing router tier | network-fabric: a generic router or ECMP tier (`default` offers only `cisco-router`, a named vendor, and `spine-leaf-fabric`, a named topology) | `spine-leaf-fabric`, labelled "ECMP routers" |
| GLB Director (github/glb-director; DPDK, GUE, direct server return) | load-balancer with encapsulation and a rendezvous forwarding table | `load-balancer-tier` with `layer: l4`, `hashing: consistent`, `connectionPreserving: true` |
| glb-healthcheck | a health-checker component under monitoring | `observability-stack`, labelled "glb-healthcheck" |
| orchestrator (github/orchestrator) | coordination-service acting as a MySQL failover controller | `apache-helix` with `role: leader-election`, `consensus: raft` |
| Spokes proxy | database-proxy has no generic component; every `default` entry is a named SQL proxy | `container-service`, labelled "Spokes proxy" |
| Job queueing service (in-house, Kafka-backed) | queue | `message-queue`, labelled "Job queueing service" |
| Spokes/DGit fileservers | file-storage with a replica count and a write quorum | `file-store`; the three copies and the 2-of-3 quorum live on the edge label and in `durability.minReplicasAcked: 2` |

No component was added to the catalogue for this design.

## Assumed values

Two properties are set to satisfy a rule where the fetched sources are silent, as the brief allows:

- `backupEnabled: true` / `backupRetentionDays: 30` on every MySQL node and on the fileservers.
  None of the posts describes GitHub's backup schedule; a system of record of this size is backed
  up, and `datastore-missing-backup` encodes that. The 30 days is a placeholder, not a source figure.
- `security.credentialRotationDays: 90`. No fetched post states a rotation period, and there is no
  key-management box to encode instead.
- `deadLetterQueue: true` on `job-queueing-service` in the clean design. The card's Unknowns say
  the platform's dead-letter policy is not stated; what the incident reports do state is that no
  background jobs were lost across the 2020 and 2023 incidents, which is the practice the rule asks for.
- `trigger: "schedule"` on `spokes-repair`. The source says only that it finds repositories with
  fewer than three replicas and recreates them; the trigger itself is not described.

## Not encoded

- The GLB forwarding table's shape: 65,536 rows, ~512KB, rendezvous-hash columns, the invariant
  that each server appears at most once per row. `hashing: consistent` is the nearest enum value.
- GUE encapsulation, direct server return and DPDK kernel bypass on the director: the load-balancer
  kind has no encapsulation, return-path or kernel-bypass property. The direct-server-return hop
  (proxy straight back to the client, bypassing the director) is left out of `edges` as well: as a
  reply edge it carries no new dependency, and it turns the rendered diagram inside out.
- glb-redirect's "second chance": the proxy-to-proxy hop exists in the source but is a netfilter
  decision inside the proxy tier, and the design has one node for that tier.
- The operational invariant that no more than one proxy server at a time is in any state other
  than active.
- Spokes' three copies, the 2-of-3 write quorum, the three-phase commit and its four round trips to
  distant replicas: `file-storage` carries no replica or quorum property, so the quorum appears only
  as `durability.minReplicasAcked: 2` and on the `spokes-proxy` -> `spokes-fileservers` edge label.
- Spokes' prioritisation of user-initiated updates over bookkeeping updates.
- Failover timing: 10-13 seconds of outage in most cases, up to 25 in extreme ones. There is no
  failover-duration property on `sql-database`.
- Pseudo-GTID, the six-step write cutover and its tens-of-milliseconds duration: only the copy edge
  and its GTID checkpoint label survive.
- Schema domains, `db/schema-domains.yml` and the cross-schema-domain query and transaction linters.
- The accepted split brain on DC isolation, and the post-2018 remediation that forbids promoting a
  primary across regional boundaries: `requirements` has no cross-region-promotion path.
- The Kafka consumer-group session timeout that caused the 2023 rebalance loop, and the standby job
  queueing service that the load was shifted to.
- Codebase and deploy rate: ~2M lines of Ruby, 1,000+ engineers, up to 20 deploys a day.
- The third-party endpoints that receive hook deliveries: the design stops at the delivery workers.
