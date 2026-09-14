# stripe-payments: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/stripe-payments.md`
- Size: 24 nodes, 27 edges, 6 groups (broken variant: 22 nodes, 25 edges, 6 groups).

## Clean variant (header of design.yaml)

Reference architecture: Stripe payment processing, clean variant. An idempotent public API
behind Redis token-bucket limiters, payment state machines whose state lives only in DocDB
(a MongoDB-backed sharded document service reached through a proxy), and Ledger, the
immutable append-only log that models every money movement as double-entry fund flows.

Fixes relative to stripe-payments.broken.yaml:
  - every hop that moves money declares idempotent: the card-network call, the bank call,
    the fund-flow postings into Ledger and the monthly close
  - the merchant SDK retries with exponential backoff and jitter into an API edge that sits
    behind a Redis token-bucket rate limiter, so retries are shed instead of amplified
  - merchant callbacks leave the payment service through a durable webhook queue with a DLQ,
    so an unreachable merchant or a slow card network has somewhere to park
  - the merchant webhook endpoint verifies the Stripe signature and deduplicates by event id
  - the routing metadata service that every DocDB proxy depends on is replicated
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: Stripe payment processing, broken variant. Same system as
stripe-payments.yaml, built the way a team building it usually builds it first: the SDK
retries hard into an API edge with nothing shedding load in front of it, the card-network
and bank calls carry no idempotency key, merchant callbacks are pushed straight out of the
payment service with no durable queue behind them, the merchant webhook endpoint trusts
whatever posts to it, and the routing metadata service every DocDB proxy depends on runs
unreplicated.

This file MUST trip:
  - money-mutation-without-idempotency-key    (payment-service -> card-network and -> acquiring-bank declare no idempotent, correctness.exactlyOnceEffect true)
  - retry-without-adaptive-shedding           (merchant-sdk -> api-edge retryPolicy exponential, no circuitBreaker, no rate-limiter in front of api-edge)
  - external-call-inline-without-durable-path (payment-service calls card-network and acquiring-bank sync with no queue or workflow engine attached)
  - webhook-without-signature-or-idempotency  (merchant-endpoint signatureVerified false, idempotent false)
  - shared-dependency-without-redundancy      (routing-metadata replicated false while availability.discoveryRedundant true)
and MUST NOT trip:
  - money-store-without-double-entry-ledger   (ledger-core is a ledger kind; money.zeroSum satisfied)
  - queue-missing-dlq, retry-queue-without-dlq, retry-without-backoff (no queue node is left in this variant)
  - fanout-inline-in-request-path             (payment-service hands the merchant event to webhook-dispatcher asynchronously)
  - credentials-without-rotation              (security.credentialRotationDays is set)
  - datastore-missing-backup, datastore-single-region, single-writer-primary-at-peak-qps,
    read-replica-as-sole-scaling              (no sql-database node; DocDB is nosql)
  - read-heavy-path-without-cache             (traffic.readWriteRatio is not declared)
  - stateful-engine-pinned-to-single-zone     (no availability-zone group in this design)
  - sync-chain-too-deep                       (no latency.p95Ms requirement is stated by the sources)
  - cache-missing-eviction-policy, cache-as-primary-store-without-persistence,
    materialised-cache-without-rebuild-path   (no cache node)

## Mapping

| # | Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|---|
| 1 | Merchant integration (stripe-ruby, retries with backoff and jitter) | `merchant-sdk` | `sdk-client` | client | exact |
| — | Request rate / concurrency limiters in front of the API (blog: rate-limiters) | `api-rate-limiter` | `redis-rate-limiter` | rate-limiter | exact |
| 2 | Public API edge (idempotency layer) | `api-edge` | `envoy-gateway` | api-gateway | close (in-house; no generic api-gateway component exists) |
| 3 | Idempotency key store | `idempotency-store` | `mongodb` | nosql-database | assumed (the card says "in DocDB (implied)"; modelled as a DocDB collection behind the proxy) |
| 4 | Payment service (PaymentIntent state machine, ACID phases) | `payment-service` | `container-service` | app-server | exact |
| 5 | Card networks | `card-network` | `card-network` | third-party-api | exact |
| 5 | Acquiring / settlement banks | `acquiring-bank` | `bank-api` | third-party-api | exact |
| 6 | Webhook delivery (outbound, retried) | `webhook-queue` + `webhook-dispatcher` | `message-queue` + `container-worker` | queue + worker | close (the card asks for an outbound `webhook-endpoint` kind that does not exist) |
| 6 | Merchant's receiving endpoint | `merchant-endpoint` | `webhook-receiver` | webhook-endpoint | exact |
| 7 | DocDB proxy | `docdb-proxy` | `mongos` | database-proxy | close (Stripe's proxy is in-house, not mongos) |
| 8 | DocDB shards (2,000+ MongoDB replica sets) | `docdb-shards` | `mongodb` | nosql-database | exact |
| 9 | Routing metadata service | `routing-metadata` | `etcd` | coordination-service | close (in-house; no generic coordination-service component) |
| 10 | DocDB control plane / Coordinator | `docdb-coordinator` | `container-service` | app-server | close (the card's `control-plane-coordinator` kind does not exist) |
| 11 | Data Movement Platform | `data-movement-platform` | `container-worker` | worker | close |
| — | DocDB CDC: write-ahead log to Kafka/S3 (InfoQ) | `docdb-cdc` | `debezium` | change-data-capture | close (in-house; Debezium is the nearest) |
| — | WAL archive on S3 (InfoQ) | `wal-archive` | `s3` | object-store | exact |
| 12 | Ledger event log (immutable, append-only, replayable) | `ledger-events` | `raft-event-log` | event-store | close (the card's `event-log` kind does not exist) |
| 13 | Ledger state machines / fund flows | `fund-flow-processor` | `container-worker` | worker | exact |
| 13 | Ledger accounts and balances (double entry) | `ledger-core` | `double-entry-ledger` | ledger | exact |
| 14 | Data quality metrics (clearing, timeliness, completeness) | `dq-platform` | `observability-stack` | monitoring | close |
| 15 | Presto | `presto` | `presto` | data-warehouse | exact |
| 16 | Hadoop / Scalding | `hadoop-scalding` | `hadoop-yarn` | big-data-cluster | close (Scalding itself has no component) |
| 17 | Scientist | — | — | — | not encoded (a library on the read path, not a runtime box) |
| 18 | Reconciliation / accounting close | `accounting-close` | `cron-job` | worker | exact |

Tally: 12 exact, 11 close, 1 assumed; 1 source box deliberately not encoded.

## Catalogue gaps

Full table in `work/designs/stripe-payments/gaps.md`. The recurring gap is that six kinds
(`api-gateway`, `database-proxy`, `coordination-service`, `change-data-capture`, plus the
card's proposed `event-log` and `control-plane-coordinator`) have no generic `default`
component, so every in-house box in this system had to borrow a product name. Nothing was
added to the catalogue.

## Properties set because a rule reads them while the source is silent

- `security.credentialRotationDays: 90`. No Stripe source states a rotation period.
  Stripe is PCI-DSS in scope, and PCI-DSS requires periodic credential and key rotation, so
  90 days reflects the practice rather than inventing a fact. Without it,
  `credentials-without-rotation` fires on a design that plainly rotates credentials.
- `availability.discoveryRedundant: true`. Not stated in those words. The InfoQ talk says
  every proxy resolves chunks through the routing metadata service, and the system targets
  99.999% / 5.5 nines; that combination is exactly what the requirement encodes.
- `docdb-shards.backupEnabled: true` and `idempotency-store.backupEnabled: true`. Not
  stated. No rule reads them on a `nosql-database`; they are set because a payment system
  that tolerates effectively no data loss cannot be modelled as unbacked.

## Not encoded

- Scientist. It is a library that runs the old and new read paths side by side inside the
  payment service and diffs the results. The format has no way to say "this node runs two
  implementations of its read path and compares them"; `app-server` has no `pattern` property.
- The four-phase online migration (dual write, offline backfill, switch reads under Scientist,
  remove the old path). It is a process over time; a design is a single snapshot. Only the
  offline backfill has a runtime box (`hadoop-scalding`).
- The five phases of a DocDB shard move (registration, bulk import, bidirectional replication,
  verification, version-gated switch). Compressed into one edge label on
  `data-movement-platform -> docdb-shards`; the format has no phase or sequence concept.
- Version gating itself: proxies annotate requests with a metadata version and the source shard
  rejects stale ones. There is no edge or node property for protocol-level version fencing.
- The 2-second upper bound on the traffic switch. It is a migration-time bound, not a request
  p95, so `latency.p95Ms` would misstate it; it lives in an edge label instead.
- The four distinct Stripe limiters (request rate, concurrency, fleet usage load shedder,
  worker utilization load shedder). Drawn as one `rate-limiter` node; `scope` holds only one
  value, so the concurrency limiter survives only as `api-edge.concurrencyLimit: true`.
- Ledger's timeliness SLO (99.99% of dollar volume ingested and verified within 4 days) and the
  >99.9999% explainability figure. `freshness.maxSeconds` is a seconds-scale requirement about
  derived data, and neither figure is an availability SLA, so both stay in the source card.
- 5 billion Ledger events per day. `nfr.rps` is per-node request rate on a request path; the
  figure lives in the edge label on `payment-service -> ledger-events` instead.
- "Revert and reprocess, never mutate" as the correction procedure. `appendOnly: true` and
  `correctness.reproducible: true` say the log is immutable and replayable, but the format
  cannot express how a wrong posting is undone.
- Multi-tenancy enforcement inside the DocDB proxy. `isolation.tenancy: "shared"` records the
  blast-radius model; `database-proxy` has no `multiTenant` property to say the proxy is what
  enforces it.
