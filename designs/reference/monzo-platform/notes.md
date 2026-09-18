# monzo-platform: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/monzo-platform.md` (Monzo engineering blog, 11 posts; three InfoQ write-ups of QCon London talks by Monzo engineers, 2019/2020/2023). Two URLs re-verified 2026-09-14.
- Size: 25 nodes, 29 edges, 5 groups. The broken twin is 23 nodes, 26 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture: the Monzo banking platform, clean variant. Roughly 2,500 Go
microservices on Kubernetes in AWS behind an in-house edge, Envoy sidecars as the RPC mesh,
one shared Cassandra cluster with a keyspace per service, Kafka carrying queue semantics with
per-consumer-group deadletter and retry topics, default-deny Calico networking, Envoy egress
gateways as the only route out, and Monzo Stand-in on GCP fed by an eventually consistent syncer.

Fixes relative to monzo-platform.broken.yaml:
  - asynchronous work rides Kafka, which deadletters after maxAttempts into a per-consumer-group
    topic and can be replayed through a retry topic, instead of NSQ with no durability and no
    deadletter path
  - no service calls a third party inline: go-microservices reach card-network only through the
    Envoy egress gateway, which CoreDNS and NetworkPolicy gate
  - etcd is a replicated raft cluster, so the lock and discovery dependency every service shares
    is not a single instance
  - the design does not publish a p95 budget it cannot hold across a four-hop synchronous
    authorisation chain; the sources state no numeric latency SLO
  - money movements do not claim an exactly-once effect the at-least-once queue cannot deliver
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: the Monzo banking platform, broken variant. The same bank, built the
way the sources warn against: asynchronous work rides NSQ with no durability and no deadletter
path, the card payment services dial the scheme directly from the request path with nothing
durable to park a failed authorisation in, etcd is a single instance behind the lock service
that every one of the 2,500 services shares, and the design publishes a one-second p95 budget
while an app request walks four synchronous hops to Cassandra.

This file MUST trip:
  - queue-missing-dlq                        (nsq takes async traffic with deadLetterQueue false)
  - shared-dependency-without-redundancy     (etcd replicated false while availability.discoveryRedundant is true)
  - external-call-inline-without-durable-path (payment-service calls card-network sync with no queue attached)
  - sync-chain-too-deep                      (edge -> envoy-sidecar -> payment-service -> ledger-service -> cassandra, with latency.p95Ms set)
  - money-mutation-without-idempotency-key   (payment-service -> ledger-service and -> card-network carry no idempotency key while correctness.exactlyOnceEffect is true)
and MUST NOT trip:
  - retry-queue-without-dlq, retry-without-backoff (nsq's role is work, not retry)
  - shared-worker-pool-across-queues         (queue-consumer has one queue in-edge; isolation.perQueue is unset)
  - fanout-inline-in-request-path            (no app-server calls a worker synchronously)
  - credentials-without-rotation             (security.credentialRotationDays is set)
  - read-heavy-path-without-cache            (no traffic.readWriteRatio is declared; the sources state none)
  - datastore-missing-backup, datastore-single-region, single-writer-primary-at-peak-qps,
    read-replica-as-sole-scaling, business-updates-without-index-propagation (no sql-database node)
  - multi-leader-store-without-conflict-policy (cassandra is leaderless with last-writer-wins)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone (no availability-zone groups)
  - cache-missing-eviction-policy, cache-as-primary-store-without-persistence,
    materialised-cache-without-rebuild-path (no cache node; the sources name no cache tier)
  - derived-store-without-cdc-or-rebuild     (no search-index node)
  - money-store-without-double-entry-ledger  (ledger-service is a ledger)
  - cross-cell-call                          (no cell groups)
  - retry-without-adaptive-shedding          (no edge declares a retryPolicy)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Monzo app | `monzo-app` | `mobile-app` | client | exact |
| staff and customer-operations tooling | `staff-tooling` | `web-browser` | client | close |
| AWS load balancer | `aws-load-balancer` | `alb` | load-balancer | exact |
| edge | `edge` | `envoy-gateway` | api-gateway | close (in-house Go layer; no vendor-neutral api-gateway component exists) |
| internal edge | `internal-edge` | `envoy-gateway` | api-gateway | close |
| Envoy sidecar (was linkerd daemonset) | `envoy-sidecar` | `envoy-sidecar` | service-mesh | exact |
| ~2,500 Go microservices | `go-microservices` | `container-service` | app-server | exact |
| card payment services | `payment-service` | `container-service` | app-server | exact |
| account service | `account-service` | `container-service` | app-server | exact |
| fraud / financial crime services | `fraud-service` | `container-service` | app-server | exact |
| Strong Customer Authentication services | `sca-service` | `container-service` | app-server | close (card suggested policy-engine; every policy-engine component is a named product) |
| ledger service | `ledger-service` | `double-entry-ledger` | ledger | exact |
| Kafka queue library consumers | `queue-consumer` | `container-worker` | worker | close |
| Egress gateways (Envoy L4 + CoreDNS + Egress Operator) | `egress-gateway` | `envoy` | load-balancer | close (card suggested nat-gateway; `default` has no nat-gateway component) |
| Calico NetworkPolicy + rpcmap | `calico-policy` | `k8s-network-policy` | firewall | close |
| Prometheus + Grafana | `prometheus` | `prometheus` | monitoring | exact |
| Cassandra | `cassandra` | `cassandra` | nosql-database | exact |
| etcd (behind the lock service) | `etcd` | `etcd` | coordination-service | exact |
| Kafka | `kafka` | `kafka` | stream | exact |
| deadletter topic per consumer group | `deadletter-topics` | `kafka` | stream | exact |
| retry topic per consumer group | `retry-topics` | `kafka` | stream | exact |
| Monzo Stand-in (GCP) | `stand-in-services` | `container-service` | app-server | exact |
| Stand-in Data Syncer | `stand-in-syncer` | `container-worker` | worker | close (card suggested change-data-capture; all such components are named products) |
| Stand-in datastore | `stand-in-store` | `nosql-store` | nosql-database | assumed (the source names no engine, only "their own database") |
| Card schemes and payment networks | `card-network` | `card-network` | third-party-api | exact |
| NSQ (broken twin only) | `nsq` | `nsq` | queue | exact |

Tally: 17 exact, 8 close, 1 assumed.

## Catalogue gaps

No component was added. Six boxes fell back to a nearest generic:

| product | kind it would need | used instead |
|---|---|---|
| Monzo `edge` / `internal edge` | api-gateway (vendor-neutral) | `envoy-gateway` |
| Calico | policy-engine (network) | `k8s-network-policy` |
| Envoy egress gateway + Egress Operator | nat-gateway | `envoy` with `layer: "l4"` |
| Stand-in Data Syncer | change-data-capture | `container-worker` |
| Strong Customer Authentication services | policy-engine | `container-service` |
| Stand-in datastore (unnamed) | nosql-database | `nosql-store` |

## Not encoded

- Kubernetes itself, and the VPA/HPA autoscalers: carried as `orchestrator: "kubernetes"` and `autoscaling: true` on the compute nodes rather than as a node, to stay inside the 25-node ceiling.
- Shipper (the deploy tool), Jaeger/OpenTelemetry, the Elastic Stack, and the firehose to BigQuery data platform with dbt, Airflow and Looker: real boxes in the sources, dropped for the node ceiling. The format would express all of them.
- Scale numbers the format has no field for: ~2,500 services, 9,300+ allowed inter-service edges (kept as `ruleCount` on `calico-policy`), ~80 services per card payment, 7 million customers, 25M+ metric samples scraped, 21 Cassandra nodes, billions of NSQ messages a day, 4,700+ dbt models. `nfr.rps` is only set where a source states a rate for a specific box, and none of these are that.
- One Cassandra keyspace per microservice, and keyspace isolation as a security control: expressible only as a label and as `data.ownershipExclusive: true`; there is no per-node keyspace field.
- The daemonset-to-sidecar migration, the linkerd era, and the 15,000 rps load test that decided it: a design is one point in time, not a sequence. `envoy-sidecar` carries `sidecar: true`; the history lives in the label.
- `maxAttempts`, the `UnorderedOffsetManager` committable watermark and the max-runaway limit: no edge or worker field holds them; they are in edge labels.
- The 2019 `auto_bootstrap` incident and the "single shared cluster is the regret" lesson: captured only as `isolation.tenancy: "shared"` plus the label on `cassandra`. There is no property for a staged-join procedure.
- Manual CLI activation of Stand-in, and the app's simplified UI: expressed as `fallback: "degraded"` on the app's edge into `stand-in-services` and `availability.degradedModeAllowed: true`; the activation decision has no field.
- The card scheme's own timeout window: no numeric value is published, so no `timeoutMs` is set on the authorisation edges.

## Assumptions

- `security.credentialRotationDays: 90` — no source states a rotation interval. It is set because
  `credentials-without-rotation` reads it design-wide, and a UK-licensed bank that describes
  per-service Cassandra keyspace isolation as a security control rotates datastore credentials.
  Ninety days is the value the other reference designs use, not a number from Monzo.
- `cassandra.backupEnabled: true` — the 2019 post states `auto_bootstrap=false` was set so nodes
  "could be rebuilt fast from backups", which implies backups exist. No retention is stated, so
  `backupRetentionDays` is absent.
- `etcd.replicated: true` in the clean design — etcd is a raft cluster by construction and the
  sources describe it as Kubernetes' consistent store; no node count is published, so `nodes` is absent.
