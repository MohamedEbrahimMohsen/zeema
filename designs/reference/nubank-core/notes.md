# nubank-core: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/nubank-core.md` (two QCon talks written up by InfoQ, two official QCon talk pages, and six posts on building.nubank.com, 2017-2025). Two URLs re-verified 2026-09-14.
- Size: 24 nodes, 36 edges, 5 groups. The broken twin is 24 nodes, 35 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture: Nubank's core banking platform, clean variant: a database-free card
authorizer in a physical data centre, a Kafka log as the only bridge to AWS, Clojure services
and an append-only Datomic ledger inside one scalability unit, and an idempotent settlement
service that moves money without a distributed transaction.

Fixes relative to nubank-core.broken.yaml:
  - settlement-service declares the hop into the payments hub idempotent; idempotency, not a
    database transaction, is what makes the transfer safe to retry
  - the global-router -> settlement-service feed claims at-least-once, not exactly-once: the
    SOAP call into the hub is a side effect no delivery guarantee can cover
  - settlement-service publishes failures to the mortician dead-letter topic, so a slow or
    failing hub parks the message instead of losing it
  - the Finagle RPC between services retries behind a circuit breaker, so a downstream failure
    becomes consumer lag rather than a retry storm
  - avalanche-flink declares a watermark for its event-time windows
  - datomic-transactor declares backups and a retention period
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: Nubank's core banking platform, broken variant: the same platform with
the mistakes a team building it commonly makes. Money leaves the bank on a hop with no
idempotency key, the transfer feed claims exactly-once as if that covered the SOAP call to the
payments hub, the settlement service has nowhere to park a failed message, service-to-service
retries have no circuit breaker, the Avalanche event-time windows have no watermark, and the
Datomic store is left unbacked-up because "Datomic never loses anything".

This file MUST trip:
  - money-mutation-without-idempotency-key    (settlement-service -> payments-hub, correctness.exactlyOnceEffect true)
  - exactly-once-with-external-side-effects   (global-router -> settlement-service claims exactly-once; settlement-service calls payments-hub sync)
  - external-call-inline-without-durable-path (settlement-service calls the hub inline with no queue behind it)
  - retry-without-adaptive-shedding           (clojure-microservices -> investment-service retries with no circuit breaker)
  - windowed-aggregation-without-watermark    (avalanche-flink windows by event time with no watermarkSeconds)
  - datastore-missing-backup                  (datomic-transactor: backupEnabled false, no retention)
and MUST NOT trip:
  - queue-missing-dlq, retry-queue-without-dlq, retry-without-backoff (the mortician is role dlq and declares deadLetterQueue)
  - money-store-without-double-entry-ledger   (accounting-ledger is a ledger node)
  - credentials-without-rotation              (the HSM is a key-management node)
  - cross-cell-call                           (isolation.tenancy is not declared; the scalability unit is a boundary, not a promise)
  - datastore-single-region                   (availability.multiRegion is false; no region failover is claimed)
  - single-writer-primary-at-peak-qps, read-replica-as-sole-scaling (no rps is published for any store)
  - cache-missing-eviction-policy, materialised-cache-without-rebuild-path (no cache-kind node; the evergreen cache is a DynamoDB store)
  - derived-store-without-cdc-or-rebuild, business-updates-without-index-propagation (no search index in this design)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone (no availability-zone groups; the sources never state the AZ topology)
  - object-store-single-zone-with-durability-target (no durability target is declared)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Nubank mobile app (card row 1) | `nubank-app` | `mobile-app` | client | exact |
| Card network (Mastercard / Visa), with the MasterCard Interface Device folded into it (rows 2) | `card-network` | `card-network` | third-party-api | exact |
| Authorizer, with the ISO-8583 codec folded in (rows 3, 4) | `authorizer` | `container-service` | app-server | exact |
| HSM (row 5) | `hsm` | `thales-luna-hsm` | key-management | assumed (the sources name no vendor; Thales Luna is the `default` network HSM) |
| Kafka bridge and backbone (row 6) | `kafka-backbone` | `kafka` | stream | exact |
| Snapshot generator (row 7) | `snapshot-generator` | `container-worker` | worker | exact |
| S3 snapshot store (row 8) | `authorizer-snapshots` | `s3` | object-store | exact |
| Double-entry accounting service (row 9) | `accounting-ledger` | `double-entry-ledger` | ledger | exact |
| Datomic transactor (row 10) | `datomic-transactor` | `relational-database` | sql-database | close (no Datomic component exists; see gaps) |
| Datomic storage, non-PII (row 11) | `datomic-storage-nonpii` | `dynamodb` | nosql-database | exact |
| Datomic storage, PII (row 12) | `datomic-storage-pii` | `aws-rds` | sql-database | exact |
| Evergreen balance cache (row 14) | `evergreen-balance-cache` | `dynamodb` | nosql-database | exact |
| Clojure microservices (row 15) | `clojure-microservices` | `container-service` | app-server | exact |
| Investment / savings service (transfer-flow edge rows) | `investment-service` | `container-service` | app-server | exact |
| Global routing service (row 17) | `global-router` | `container-service` | app-server | exact |
| Mortician dead-letter service (row 18) | `mortician` | `message-queue` | queue | close (in-house service; the generic queue carries `role: "dlq"`) |
| Settlement service (row 19) | `settlement-service` | `container-service` | app-server | exact |
| Brazilian payments hub (row 20) | `payments-hub` | `bank-api` | third-party-api | close (the RTGS rail is not itself a catalogued product) |
| Datomic log tailer (row 22) | `datomic-log-tailer` | `container-worker` | worker | close (in-house CDC; every change-data-capture component is a named product Nubank does not run) |
| Data lake (row 22 target) | `data-lake` | `blob-store` | object-store | close (the sources name no storage product for the lake) |
| Scala + Spark ETL cluster (row 24) | `spark-etl` | `spark-cluster` | big-data-cluster | exact |
| Avalanche stream enrichment (row 26) | `avalanche-flink` | `flink` | stream-processor | exact |
| Avalanche real-time serving (row 26) | `avalanche-pinot` | `pinot` | data-warehouse | exact |
| Prometheus + Grafana (row 27) | `prometheus` | `prometheus` | monitoring | exact |

Tally: 18 exact, 5 close, 1 assumed.

## Catalogue gaps

No component was added. The one product the card names that the catalogue does not carry at all:

| product | kind it would need | used instead |
|---|---|---|
| Datomic (transactor, peer and storage-service split; the ledger engine of the bank) | sql-database (an immutable, append-only, single-writer temporal database) | `relational-database` with `appendOnly: true`, `multiWriter: false`, `commitProtocol: "single"`; `label: "Datomic"` carries the name |

Three further boxes fell back to a nearest generic because the product is in-house, not because
the catalogue is missing a vendor: the mortician (`message-queue` with `role: "dlq"`), the
Datomic log tailer (`container-worker`) and the data lake (`blob-store`). The HSM vendor is not
stated by any source, so `thales-luna-hsm` stands for an unnamed network HSM.

## Not encoded

- The Datomic **peer** (card row 13): an in-process library inside every service instance, not a deployable box, so it is folded into `clojure-microservices`; the edges the card draws from the peer are drawn from the service. The 100 GB / GC-pause history and the 90 GB to 55 GB result have no field; they survive only in the evergreen cache's label and in the source.
- The **scalability unit** (row 16) is a boundary, not a node: it is the `scalability-unit` cell group. The same is true of the global, non-sharded layer and the analytics environment.
- **Kubernetes / EKS** (row 21): carried as `orchestrator: "kubernetes"` on the compute nodes rather than as a node of its own.
- **Analytics contract layer** (row 23) and the **ML / decisioning pipeline** (row 25): dropped at the node ceiling; the ETL cluster is the last analytics node encoded. The format would express both.
- **Splunk with correlation IDs** (row 28) and the **AWS Limit Smoke Detector** (row 29): dropped for the same ceiling. A tree-structured correlation ID that spans HTTP and Kafka hops and joins Datomic transaction metadata has no field in the format at all.
- The **MasterCard Interface Device** (row 2): a physical edge appliance that only terminates the scheme's TCP connection. There is no edge-appliance kind, so the ISO-8583 edge runs `card-network -> authorizer` and the MIP is named in that edge's label.
- Scale numbers with no field: 2.6 million customers (2017) growing to tens of millions, 100 to 4,000+ microservices, 50+ deploys a day, 72 billion events a day (2025), around $100 billion transferred per day nationally, the stand-in rate falling from ~1% to below one basis point. `nfr.rps` is set nowhere, because no source states a rate for a specific box.
- **Property-based testing, consumer-driven contract tests and the conservation-of-money monitor**: practices, not runtime elements.
- **The temporal axis of "customer and temporal sharding"**: the QCon abstract names it without defining it, so `shardKey` is `"customer"` only.
- **Region and AZ topology**: never published. The design carries no `region` or `availability-zone` group, no `availability.zones`, and `multiRegion: false`.
- **Kafka retention, partition counts, replication factor and the authorizer snapshot interval**: unstated, so those props are left at kind default.
- **Authorizer decision latency**: the ~1 ms figure could not be confirmed in the fetched transcript (see `source/nubank-core.md`, "Verification 2026-09-14"), so no `latency` requirement and no `latencyP95Ms` is declared.

## Assumed values

Two values in the clean design are stated by no source. Both are set because a rule reads them
and because the sources describe the practice they encode:

- `datomic-transactor.backupEnabled: true` with `backupRetentionDays: 30` — no post states a
  backup policy for Datomic storage. It is set because `datastore-missing-backup` reads it, and
  because a bank whose stated thesis is that "data loss is the worst thing that can happen"
  backs up its system of record. Thirty days is the value the other reference designs use, not a
  number from Nubank. The broken twin removes it as its mistake.
- `avalanche-flink.watermarkSeconds: 5` — the Avalanche post states event-time windowing and
  stateful joins but publishes no watermark. Five seconds is the kind's documented default, set
  so `windowed-aggregation-without-watermark` does not fire on a design whose source says the
  windows are event-time. The broken twin removes it as its mistake.

`datomic-transactor.multiWriter: false` / `commitProtocol: "single"` is also marked assumed in
`work/designs/nubank-core/verify.md`: the transactor's serialising role is described in the
sources, but the phrase "one writer per database" is the card's, not a fetched page's.
