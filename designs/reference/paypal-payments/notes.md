# paypal-payments: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/paypal-payments.md`
- Size: 24 nodes, 30 edges, 9 groups (broken twin: 22 nodes, 28 edges, 9 groups).

## Clean variant (header of design.yaml)

Reference architecture: the PayPal payment platform, clean variant. A public Orders/Payments
REST edge and a GraphQL gateway in front of the checkout estate, whose shared organs are
JunoDB (proxy, leaderless quorum storage, etcd shard map), HERA in front of the relational
systems of record, Aerospike for real-time risk, and a multi-tenant Kafka bus mirrored into a
second data centre and security zone.

Fixes relative to paypal-payments.broken.yaml:
  - the relational systems of record replicate asynchronously with automatic transaction
    failover to a replica, and are backed up, so one data centre does not hold the only copy
  - junodb-storage replicates leaderlessly under a quorum protocol rather than accepting
    writes in two data centres with no declared conflict policy
  - every application reaches the databases through a proxy tier: junodb-lb -> junodb-proxy
    and hera-mux, never straight into the per-database worker processes
  - the Kafka security library issues and rotates the SSL certificates and per-application
    tokens, instead of long-lived credentials pasted into each application
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: the PayPal payment platform, broken variant. The same system built
the way a team building it usually builds it first: the relational systems of record sit in
one data centre with no replica, JunoDB is run active-active across two data centres with no
declared conflict policy, the microservice estate opens its connections straight onto the
per-database HERA worker processes with no mux in front, and every application carries its own
Kafka certificates and tokens instead of getting them from the shared security library.

This file MUST trip:
  - datastore-single-region                    (systems-of-record: replication none, one region group, multiRegion required)
  - multi-leader-store-without-conflict-policy  (junodb-storage accepts writes in both data centres, no conflictResolution)
  - fanout-inline-in-request-path               (core-backend-services calls hera-worker synchronously, the mux is gone)
  - credentials-without-rotation                (the Kafka security library node is gone and no rotation period is declared)
and MUST NOT trip:
  - datastore-missing-backup                   (systems-of-record still declares backupEnabled and a retention period)
  - read-heavy-path-without-cache              (no traffic.readWriteRatio is stated by the sources)
  - single-writer-primary-at-peak-qps, read-replica-as-sole-scaling (no rps is declared on the relational tier)
  - sync-chain-too-deep                        (no latency.p95Ms requirement; the sources state a p99 network figure, not a p95 target)
  - stateful-engine-pinned-to-single-zone, stateful-node-without-zone-redundancy (this design has no availability-zone group)
  - shared-dependency-without-redundancy       (availability.discoveryRedundant is not declared; every coordination node is replicated anyway)
  - money-mutation-without-idempotency-key, money-store-without-double-entry-ledger
                                               (no node handles money or keeps a ledger; the sources do not describe settlement)
  - queue-missing-dlq, retry-queue-without-dlq, retry-without-backoff, retry-without-adaptive-shedding
                                               (no queue node and no edge declares a retry policy)
  - cache-missing-eviction-policy, cache-as-primary-store-without-persistence, materialised-cache-without-rebuild-path
                                               (no cache node; JunoDB is modelled as the persistent key-value store it became)
  - derived-store-without-cdc-or-rebuild, business-updates-without-index-propagation (no search index)
  - windowed-aggregation-without-watermark     (MirrorMaker declares windowing none)
  - external-call-inline-without-durable-path, exactly-once-with-external-side-effects, webhook-without-signature-or-idempotency
                                               (no third-party-api and no webhook-endpoint node)
  - cross-cell-call                            (tenancy is shared, not cell)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| 1 Buyer browser / PayPal JS SDK | `buyer-browser` | `web-browser` | client | exact |
| 2 Merchant server | `merchant-server` | `sdk-client` | client | close - a third party from PayPal's side, but here it is the caller, so it is an SDK client rather than a `third-party-api` |
| 3 PayPal REST API edge (Orders v2 / Payments v2) | `paypal-rest-api` | `envoy-gateway` | api-gateway | close - in-house gateway, no product named; `envoy-gateway` stands in for a generic api-gateway |
| 4 GraphQL gateway | `graphql-gateway` | `krakend` | api-gateway | close - a second api-gateway component so the two edges stay distinct; the real thing is PayPal's own schema-first GraphQL layer |
| 5 Bulk REST layer | - | - | - | not encoded: the source itself calls it superseded and "rarely used" |
| 6 Checkout / orchestration services | `checkout-services` | `container-service` | app-server | exact |
| 7 Core backend services (login, risk, transaction processing) | `core-backend-services` | `container-service` | app-server | exact |
| 8 JunoDB client library | - | - | - | not encoded: an in-process library; it survives as the label on `core-backend-services -> junodb-lb` |
| 9 JunoDB proxy (junoserv) | `junodb-proxy` | `vitess` | database-proxy | close - no JunoDB component exists; `vitess` is the shard-routing database proxy |
| 10 JunoDB storage server (junostorageserv) | `junodb-storage` | `nosql-store` | nosql-database | close - the generic key-value store; JunoDB is not in the catalogue |
| 11 JunoDB etcd / clustercfg (junoclusterserv) | `junodb-etcd` | `etcd` | coordination-service | exact |
| 12 Load balancer in front of JunoDB proxies | `junodb-lb` | `load-balancer-tier` | load-balancer | exact |
| 13 HERA data access gateway (mux) | `hera-mux` | `proxysql` | database-proxy | close - HERA is not in the catalogue; `proxysql` is the connection-multiplexing proxy with read/write split |
| 14 HERA workers | `hera-worker` | `container-worker` | worker | exact |
| 15 Relational systems of record | `systems-of-record` | `oracle-db` | sql-database | exact - Oracle and MySQL are both named in the HERA README; one node carries both |
| 16 Risk/fraud feature store | `risk-feature-store` | `aerospike` | nosql-database | exact |
| 17 Risk model execution | `risk-models` | `kserve` | ml-inference | close - no product is named; `kserve` is the generic inference server |
| - (implied by the checkpoint list) | `risk-services` | `container-service` | app-server | close - the source describes checkpoints and model execution, not a named service tier |
| 18 Kafka brokers | `kafka-brokers` | `kafka` | stream | exact |
| 18b Kafka brokers, second DC and security zone | `kafka-brokers-dr` | `kafka` | stream | exact - the mirroring destination the post describes |
| 19 ZooKeeper ensemble | `zookeeper-ensemble` | `zookeeper` | coordination-service | exact |
| 20 MirrorMaker | `mirrormaker` | `kafka-streams` | stream-processor | close - MirrorMaker is not a catalogue component; `kafka-streams` is the Kafka-native stream processor |
| 21 Kafka Config Service | `kafka-config-service` | `consul` | coordination-service | close - an in-house stateless config/discovery service; `consul` with `role: "config"` |
| 22 Resilient client library | - | - | - | not encoded: an in-process client library |
| 23 Kafka security library | `kafka-security-library` | `cert-manager` | key-management | close - in-house; `cert-manager` is the certificate issuer and rotator |
| 24 Kafka metrics library + SignalFX | `kafka-monitoring` | `observability-stack` | monitoring | exact |
| 25 Topic onboarding workflow / capacity tool | `topic-onboarding` | `container-service` | app-server | close - the card suggests `policy-engine`, but the box is a request-and-approval workflow, not an authorisation engine |

Tally over the 24 nodes: 12 exact, 12 close, 0 assumed.

Numbers: every `nfr` value comes from a source. `kafka-brokers.rps: 21000000` and
`risk-feature-store.rps: 8000000` are stated verbatim. `junodb-storage.rps: 4000000` is the
stated "350 billion requests a day" converted to a per-second rate (350e9 / 86400 is about
4.05M); it is the only derived figure in the design.

Assumed values, stated by no source:
- `systems-of-record.backupRetentionDays: 30`. No source discusses backups of the Oracle and
  MySQL fleet. The value is set so the clean design does not trip `datastore-missing-backup`,
  which encodes a practice a payment system of record certainly has.
- `kafka-security-library.rotationAutomated: true`. The post says the library manages SSL
  certificates and token retrieval for 800+ applications, which implies issuance and renewal,
  but it never uses the word rotation.
- `junodb-storage.replication: "leaderless"`. The sources say quorum protocol, two-phase commit
  and failover with no leader re-election; `leaderless` is the closest enum value.
- `mirrormaker.instances: 2000` renders the stated "close to 2,000 Mirror Maker nodes".

## Catalogue gaps

Seven; none blocking. No component was added and no kind installed. The table is in
`work/designs/paypal-payments/gaps.md`. In short: JunoDB (proxy and storage server), HERA (mux
and workers), MirrorMaker and the two in-house Kafka platform services (Config Service,
security library) have no component of their own, and there is no generic in-house
`api-gateway` or `database-proxy` under `default` - every component of both kinds is a named
product.

## Not encoded

- The two-phase money movement itself. AUTHORIZE places a 29-day hold and CAPTURE settles it;
  the format has no way to express a state machine over an order, only the edges that carry it.
  The 3-hour order window and the 6-hour idempotency key TTL survive as `keyTtlHours` and as
  edge labels.
- The Bulk REST layer, which the source records as superseded.
- The in-process client libraries (JunoDB client, resilient Kafka client): the format models
  runtime nodes, not libraries linked into a caller. Both survive as edge labels.
- JunoDB's 1,024 logical shards, the zone0..zone5 expansion runbook and the zone-at-a-time
  markdown, redistribute and commit procedure: `nosql-database` has no shard-count or
  logical-zone property, and the format cannot express an operational runbook.
- The cross-data-centre JunoDB hop as the source draws it (proxy site A -> proxy site B): the
  design carries replication on the storage node instead, because the second data centre has no
  JunoDB nodes of its own in this encoding.
- Per-topic ACLs, declared producer and consumer intent, and the SASL/SSL mechanism: expressed
  only as the `kafka-sasl-ssl` protocol and the topic-onboarding edge label.
- The operational lessons the post records - the one-broker-at-a-time patching plugin, the
  under-replicated-partition-only reassignment, the 1:1 production/QA cluster mapping, and the
  KIPs PayPal upstreamed - are process, not topology.
- The compute platform (Kubernetes and Mesos), the settlement and ledger path, Kafka retention
  and DLQ policy, and edge rate limiting and WAF: all in the card's Unknowns, all absent here.
