# coinbase-exchange: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/coinbase-exchange.md` (intake card of 2026-09-07, with a verification section appended 2026-09-14)
- Size: 25 nodes, 32 edges, 7 groups. Broken twin: 23 nodes, 31 edges, 7 groups.

## Clean variant (header of design.yaml)

Coinbase exchange and platform, clean variant: a price-time-priority matching engine with
automated cross-zone failover, EKS services talking over managed MSK, and a CDC pipeline that
feeds Delta Lake and Snowflake without anyone dual-writing.

Fixes relative to coinbase-exchange.broken.yaml:
  - matching-engine declares failover "automatic", the cross-zone recovery Coinbase committed
    to after the 2026-05-07 zone loss, so the Cluster Placement Group is no longer a single
    point of failure
  - acm-certificates issues and renews the TLS certificates that internal-lb serves, so an
    internal hostname cannot silently expire the way it did on 2021-11-23
  - custody-hsm holds the withdrawal signing keys instead of the withdrawal service itself
  - every hop that moves money (matching-engine -> ledger, withdrawal-service -> ledger,
    withdrawal-service -> blockchain-rpc) declares an idempotency key
  - withdrawal-service broadcasts to the chain asynchronously instead of blocking the caller
  - order-gateway talks to the matching engine directly rather than through the internal
    load-balancer tier, keeping the exchange path three synchronous hops deep
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Coinbase exchange and platform, broken variant: the exchange as its own post-mortems describe it
failing. The matching engine sits in one Cluster Placement Group with no cross-zone failover, the
internal TLS certificates are hand-managed with no certificate authority in the design, withdrawal
keys live in the withdrawal service, money hops carry no idempotency key, and every exchange call
is funnelled through the internal load-balancer tier.

This file MUST trip:
  - stateful-engine-pinned-to-single-zone        (matching-engine is alone in use1-az4 with failover "none")
  - credentials-without-rotation                 (data nodes, no key-management node, no security.credentialRotationDays)
  - money-mutation-without-idempotency-key       (matching-engine -> ledger, withdrawal-service -> ledger,
                                                  withdrawal-service -> blockchain-rpc declare no idempotent)
  - external-call-inline-without-durable-path    (withdrawal-service calls blockchain-rpc synchronously with
                                                  no queue or workflow engine attached)
  - sync-chain-too-deep                          (order-gateway -> internal-lb -> withdrawal-service -> ledger
                                                  -> postgres-core is four synchronous hops under p95Ms 10)
and MUST NOT trip:
  - datastore-missing-backup, datastore-single-region (postgres-core keeps backup and retention; multiRegion false)
  - single-writer-primary-at-peak-qps, read-replica-as-sole-scaling (no nfr.rps is declared on postgres-core)
  - money-store-without-double-entry-ledger      (the ledger node is still there; only the idempotency keys are gone)
  - read-heavy-path-without-cache                (no traffic.readWriteRatio requirement is declared)
  - retry-without-adaptive-shedding              (the one retrying edge keeps its circuit breaker)
  - stateful-node-without-zone-redundancy        (matching-engine has no stateless property; every app-server is stateless)
  - reconnect-stampede-without-guard, shared-host-per-channel-without-isolation,
    stateful-websocket-scale-in-without-drain    (market-data-feed calls no coordination service, does not
                                                  autoscale, and the design declares no heavy-tail skew)
  - windowed-aggregation-without-watermark       (soon-ingestion windows by processing time)
  - queue-missing-dlq, retry-queue-without-dlq, cache-missing-eviction-policy,
    derived-store-without-cdc-or-rebuild, business-updates-without-index-propagation
                                                 (no queue, cache or search index in this design)
  - exactly-once-with-external-side-effects      (no edge claims exactly-once delivery)

## Mapping

| # | Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|---|
| 1 | Web and mobile clients | `web-client` | `web-browser` | client | exact |
| 1 | Web and mobile clients | `mobile-app` | `mobile-app` | client | exact |
| 1 | Clickstream via Ruby/Go SDKs | `clickstream-sdk` | `sdk-client` | client | exact |
| 2 | Nginx routers | `nginx-router` | `nginx` | load-balancer | exact |
| 3 | Internal load balancers | `internal-lb` | `load-balancer-tier` | load-balancer | close (product not named; generic tier) |
| 4 | API gateway / order gateway (REST, WebSocket, FIX) | `order-gateway` | `envoy-gateway` | api-gateway | close (in-house gateway; no vendor-neutral api-gateway component exists) |
| 5 | Matching engine | `matching-engine` | `order-book-matcher` | matching-engine | exact |
| 6 | Market data feed | `market-data-feed` | `websocket-gateway` | realtime-gateway | exact |
| 7 | Retail and platform services on EKS | `retail-services` | `container-service` | app-server | exact |
| 8 | Identity service (1.5M reads/sec) | `identity-service` | `container-service` | app-server | exact |
| — | Ledger / balances (implied by "matching engine -> ledger, transactional") | `ledger` | `double-entry-ledger` | ledger | assumed (no engineering source describes the ledger) |
| 19 | Custody withdrawal workflow | `withdrawal-service` | `container-service` | app-server | assumed |
| 9 | MongoDB | `mongodb` | `mongodb` | nosql-database | exact |
| 10 | DynamoDB | `dynamodb` | `dynamodb` | nosql-database | exact |
| 11 | Postgres | `postgres-core` | `postgres` | sql-database | exact |
| 12 | Kafka (AWS MSK), multi-tenant cluster | `msk-multi-tenant` | `aws-msk` | stream | exact |
| 12 | Kafka (AWS MSK), service-dedicated low-latency cluster | `msk-dedicated` | `aws-msk` | stream | exact |
| 13 | Kafka Connect | `kafka-connect` | `kafka-connect` | change-data-capture | exact |
| 14 | SOON (Spark continuous ingestion) | `soon-ingestion` | `spark-streaming` | stream-processor | exact |
| 14/17 | Delta Lake on S3 | `delta-lake` | `s3` | object-store | close (Delta Lake is a table format, stored in S3) |
| 15 | Snowflake | `snowflake` | `snowflake` | data-warehouse | exact |
| 16 | Airflow | `airflow` | `airflow` | workflow-engine | exact |
| 21 | Certificate management | `acm-certificates` | `aws-acm` | key-management | close (the 2021-11-23 post-mortem names the incomplete IAM-to-ACM migration) |
| 19 | Custody: HSM / MPC signing | `custody-hsm` | `cloudhsm` | key-management | assumed (see Catalogue gaps) |
| 20 | Blockchains, banks, payment rails | `blockchain-rpc` | `supplier-api` | third-party-api | close (generic external partner API) |
| 18 | Kubernetes (EKS) | — | — | — | not a node; encoded as `orchestrator: "kubernetes"` on every app-server, and as the `platform` / `custody` trust zones for the "separate clusters" isolation |

Confidence tally: 17 exact, 6 close, 3 assumed.

Two values are set because a rule reads them and the source is silent, as the brief allows:

- `postgres-core.backupRetentionDays: 30`. `datastore-missing-backup` requires a declared
  retention. No Coinbase source states one; the MSK post does state that S3 holds full
  PostgreSQL snapshots, so backups exist. The number is assumed.
- `matching-engine.failover: "automatic"`. During the 2026-05-07 outage it was effectively
  `none`, which is what the broken twin encodes. Automated cross-zone recovery is the
  remediation Coinbase published, so the clean design encodes the remediated system.

## Catalogue gaps

| Product | Kind it would need | Used instead |
|---|---|---|
| Coinbase custody HSM / MPC signing service (air-gapped cold storage, threshold signing) | `key-management` with a vendor-neutral hardware-signer component; every `key-management` component under `default` is a named product (Vault, cert-manager, Luna, nShield, …) | `cloudhsm` |
| In-house API / order gateway with no named product | `api-gateway`; there is no `api-gateway-tier` equivalent of `load-balancer-tier` | `envoy-gateway` |
| Blockchain RPC node / settlement rail | `third-party-api` with a vendor-neutral external component (the only blockchain RPC component is `google-blockchain-rpc`, a GCP product) | `supplier-api` |
| Databricks-hosted Spark structured streaming | `stream-processor`; `databricks` exists but as a `big-data-cluster` | `spark-streaming` |

## Not encoded

- The MongoDB / DynamoDB federation ("right tool for different jobs"): the format has no
  relationship property between two datastores.
- The three custody tiers (hot, warm, cold) and MPC threshold signing: `key-management` has
  `hsm` but no tiering or signing-scheme property, and no engineering source describes them.
- The Kafka control plane that refreshes topic metadata and propagates read/write ACLs, and the
  Streaming SDK that fronts Kafka, Kinesis, SQS and SNS. Both are documented; they were cut to
  stay inside the 25-node ceiling. The SDK's circuit breaker survives as `circuitBreaker: true`
  on `retail-services -> msk-multi-tenant`.
- StarRocks / CelerData for sub-second real-time analytics: a second `data-warehouse` node next
  to Snowflake, cut for the same reason.
- Cluster counts and sizes: 30 MSK brokers at ~17 TB each, headroom to 90 brokers, "billions of
  events" daily. `stream` has no broker-count or storage-size property.
- The scale numbers that describe the company rather than a box: 120M+ verified users, $400B+
  assets under custody, the 10x host growth and quadrupled engineering organisation.
- The incident timelines themselves (2021-05-19 Nginx connection ceiling, 2021-10-27 automated
  maintenance during peak, 2021-11-23 96 minutes at ~90% API errors, 2026-05-07 eight hours):
  a design states structure, not history. They survive only as the shape of the broken twin.
- The Nginx connection ceiling specifically: `load-balancer` has no maximum-connections
  property, so the 2021-05-19 failure mode cannot be expressed as a rule input.
- Self-trade prevention modes (`dc`, `co`, `cn`, `cb`) and the received/open/done order
  lifecycle: `matching-engine` carries `algorithm`, not order-level semantics.
- EKS itself. It is an operations platform, not a runtime element on the request path; it is
  encoded as `orchestrator: "kubernetes"` and as the separate trust zones that stand in for the
  "separate clusters" the CNCF post requires for high-security workloads.
