# booking-search: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/booking-search.md` (intake card of 2026-09-07, re-verified 2026-09-14; verification log appended to the card).
- Size: 25 nodes, 36 edges, 6 groups. Broken twin: 24 nodes, 33 edges, 6 groups.

## Clean variant (header of design.yaml)

Reference architecture 28, clean variant: the Booking.com accommodation search and reservation
path - CloudFront and HAProxy at the edge, a federated GraphQL gateway into an Envoy sidecar
mesh driven by two xDS control planes, and a self-hosted polyglot estate where MySQL replicas
are read instead of caches, a binlog server relays the replication fan-out, and one Kafka
events backbone carries change data capture and host observability events.

Fixes relative to booking-search.broken.yaml:
  - binlog-cdc reads the MySQL binlog into events-kafka and indexes search-index
    asynchronously, so Elasticsearch is not maintained by dual writes from services
  - service-discovery is a replicated ZooKeeper ensemble, so the mesh control planes do not
    hang off one coordination node
  - the sidecar-routed calls that retry declare circuitBreaker, matching the mesh's own
    circuit breaking, so retries cannot turn a slow dependency into a retry storm
  - security.credentialRotationDays states the 30-day database credential rotation the
    source describes
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture 28, broken variant: the same Booking.com search and reservation path,
but Elasticsearch is kept up to date by dual writes from the services instead of by change
data capture off the binlog, the two mesh control planes hang off a single unreplicated
ZooKeeper while the design promises redundant discovery, the sidecars retry with neither a
circuit breaker nor a limiter in front of the callee, and nothing states how the database
credentials rotate.

This file MUST trip:
  - shared-dependency-without-redundancy     (service-discovery: replicated false, discoveryRedundant required)
  - business-updates-without-index-propagation (mysql-primary and mysql-replicas are written or read by app-servers, a search index exists, no CDC leaves them)
  - derived-store-without-cdc-or-rebuild     (search-index has only sync in-edges from services)
  - retry-without-adaptive-shedding          (the three sidecar-routed edges retry with no circuitBreaker and no rate-limiter in front)
  - credentials-without-rotation             (data nodes, no security.credentialRotationDays, no key-management node)
and MUST NOT trip:
  - datastore-missing-backup                 (both MySQL nodes keep backups with a retention)
  - datastore-single-region                  (multiRegion is required but replication is async, not none)
  - read-heavy-path-without-cache            (no traffic.readWriteRatio is stated, so the rule cannot fire although there is no cache)
  - read-replica-as-sole-scaling, single-writer-primary-at-peak-qps (no nfr.rps is stated on any node)
  - sync-chain-too-deep                      (no latency.p95Ms requirement)
  - fanout-inline-in-request-path            (event-proxy, the only worker, is fed asynchronously)
  - cache-missing-eviction-policy, cache-as-primary-store-without-persistence,
    materialised-cache-without-rebuild-path  (this estate has no cache at all, by choice)
  - queue-missing-dlq, retry-queue-without-dlq, retry-without-backoff, pubsub-replay-required (no queue or pubsub-topic)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone (no availability-zone groups)
  - multi-leader-store-without-conflict-policy (cassandra is single-region with last-writer-wins)
  - object-store-single-zone-with-durability-target (no durability.annualNines requirement; the catalogue spans 3 zones)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Web clients | `web-client` | `web-browser` | client | exact |
| Mobile apps | `mobile-client` | `mobile-app` | client | exact |
| CloudFront | `cdn` | `cloudfront` (aws) | cdn | exact |
| HAProxy edge ("Scaling the Edge") | `edge-lb` | `haproxy` | load-balancer | exact |
| Federated GraphQL gateway | `graphql-gateway` | `envoy-gateway` | api-gateway | close (no GraphQL-federation component exists; stand-in of the right kind) |
| Envoy service mesh (sidecars) | `service-mesh` | `envoy-sidecar` | service-mesh | exact |
| Mesh control plane, bare metal | `mesh-control-plane-metal` | `container-service` | app-server | close (in-house xDS control plane; no control-plane kind) |
| Mesh control plane, Kubernetes/cloud | `mesh-control-plane-cloud` | `container-service` | app-server | close (the second plane is inferred from the "Multi-Control Plane" title) |
| ZooKeeper (service discovery and configuration) | `service-discovery` | `zookeeper` | coordination-service | exact (2018 mesh talk) |
| Services decomposed from the Perl monolith | `accommodation-service` | `container-service` | app-server | exact |
| Ranking platform | `ranking-platform` | `container-service` | app-server | close (no generic ml-inference component; the source calls it a platform, not a model server) |
| Booking and payment services (event-driven) | `booking-service` | `container-service` | app-server | close (the card drew booking and payments separately; the Confluent study names both in one sentence, so they are one box here) |
| Fraud detection service | `fraud-service` | `container-service` | app-server | exact |
| Event-proxy host daemon | `event-proxy` | `container-worker` | worker | exact |
| Binlog change data capture into Kafka | `binlog-cdc` | `kafka-connect` | change-data-capture | assumed (see "Assumptions" below) |
| Kafka / Confluent Platform | `events-kafka` | `kafka` | stream | exact |
| MySQL primaries, 250+ clusters | `mysql-primary` | `mysql` | sql-database | exact |
| Binlog servers | `binlog-server` | `maxscale` (`router: binlogrouter`) | database-proxy | close (the source names "binlog servers", not MaxScale; MaxScale is the one catalogue component with a binlog router) |
| MySQL replicas, 50+ per topology | `mysql-replicas` | `mysql` | sql-database | exact |
| Backup catalogue migrated to AWS | `backup-catalogue` | `s3` (aws) | object-store | close (the post says "to AWS"; S3 is the implied target) |
| Cassandra | `cassandra` | `cassandra` | nosql-database | exact |
| JanusGraph fraud graph | `fraud-graph` | `janusgraph` | graph-database | exact |
| Elasticsearch | `search-index` | `elasticsearch` | search-index | exact |
| Nanotube metrics router | `nanotube` | `observability-stack` | monitoring | close (no component for Nanotube; kept as a label) |
| Event consumers: tracing, APM metrics, logging | `observability-platform` | `observability-stack` | monitoring | close (the source draws several consumers; they are one box here) |

Tally: 15 exact, 9 close, 1 assumed.

## Catalogue gaps

The full table is in `work/designs/booking-search/gaps.md`. In short, the `default` provider
has no generic component for `api-gateway`, `change-data-capture`, `ml-inference`,
`database-proxy`, `key-management`, or for a metrics *router* under `monitoring`. Nothing was
added to the catalogue; each gap was filled with the nearest component of the right kind and
a `label` carrying the real name.

## Assumptions

Three values are not stated by any reachable source and were set because a rule reads them.

- `backupRetentionDays: 30` on both MySQL nodes. The source confirms a backup catalogue for
  250+ clusters but names no retention; `datastore-missing-backup` requires one. 30 days is the
  value the other reference designs use.
- `binlog-cdc` and its two in-edges. The source confirms the binlog stream and confirms Kafka,
  but nowhere describes change data capture from MySQL into Kafka. Without it,
  `business-updates-without-index-propagation` and `derived-store-without-cdc-or-rebuild` fire
  on a design whose search index would then be maintained by dual writes - which is the failure
  the broken twin is built to show. The clean variant states the mechanism instead of the
  failure. Both `mysql-primary` and `mysql-replicas` feed it, because the rule reads the
  out-edges of each `sql-database` node and both are read or written by application servers.
- `circuitBreaker: true` (edges) and `circuitBreaking: true` (the mesh node). The mesh talk
  confirms Envoy retries on `gateway-error`; it does not name circuit breaking. Envoy carries
  circuit-breaker thresholds by default, and `retry-without-adaptive-shedding` requires the
  pairing, so the clean variant declares it.

Requirements were kept deliberately thin. `latency.p95Ms`, `traffic.readWriteRatio`,
`availability.sla`, `availability.regions` and `durability.annualNines` are all absent because
no source states a number for them - and `traffic.readWriteRatio` in particular must stay
absent, since this estate genuinely has no cache and any stated read/write ratio would make
`read-heavy-path-without-cache` fire on a deliberate architectural choice.

## Not encoded

- **"Replicas instead of caches" as a property.** The design shows it - there is no `cache`
  node anywhere, and two app-servers read `mysql-replicas` synchronously - but the format has
  no way to say "this read tolerates replica lag". The card's proposed `replicaLagTolerated`
  edge property does not exist.
- **The three platforms MySQL runs on** (bare metal, Kubernetes, cloud). Groups can express
  region, zone, vpc, trust-zone, system, cell and point-of-presence, but not "platform". The
  split shows only in the two control-plane nodes and their `orchestrator` values.
- **Fleet sizes.** "Thousands of small database servers", "250+ clusters", "under 20 DBAs",
  "x400 growth over a decade" have no home: a node is one box, not a fleet count. They survive
  only in labels (`MySQL primaries (250+ clusters)`, `50+ per topology`).
- **The cost argument** - self-hosted hardware 6-8x cheaper than raw public-cloud compute and
  storage - is the reason the estate looks the way it does, and there is no requirement path
  for cost.
- **Operational practice**: failover automation, "manual SSH is a ticket-worthy incident", the
  "~10x data growth triggers a redesign" cadence, and disaster-recovery testing. These are
  process, not topology.
- **Ordering per cluster.** `messaging.orderingScope: "partition"` is the closest the format
  gets to "binlog stream order per cluster".
- **Kubernetes itself.** The card listed it as "ops platform, not tallied"; it appears only as
  `orchestrator: "kubernetes"` on the nodes that run there.
- **Nanotube's throughput** ("tens of millions of metric data points per second") is stated by
  the source but sits on a `monitoring` node, and `nfr.rps` on an observability box would
  imply a request path it does not have.
