# Intake: Stripe payment processing (API idempotency, DocDB, Ledger)

## Source
- Primary: https://stripe.com/blog/idempotency (official, Brandur Leach 2017: idempotency keys, retries)
- Primary: https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement (official, 2023: Ledger, 5B events/day, clearing, data quality)
- Primary: https://stripe.com/blog/online-migrations (official, 2017: four-phase online migration, Scientist, Scalding)
- Primary: https://www.infoq.com/presentations/docdb-online-database/ (Jimmy Morzaria, Stripe, QCon SF 2025: DocDB, 5M QPS, 2,000+ shards, zero-downtime data movement); official post at https://stripe.dev/blog/how-stripes-document-databases-supported-99.999-uptime-with-zero-downtime-data-migrations (body not extractable in this pass)
- Verified by: four official Stripe engineering posts + conference talk by Stripe engineer
- Confidence: high for API, Ledger, DocDB; the end-to-end payment service topology (PSP calls, webhooks) is inferred from Stripe's public API docs and is marked medium
- Date of source: 2017, 2023, 2025

## System in three lines
Accepts payment requests from merchants over a public API, moves money through card networks and banks, and proves every cent afterwards. The API is idempotent by contract; state lives in DocDB, a sharded document database service built on MongoDB behind a proxy; Ledger is an immutable event log that models all money movement as fund flows between accounts and detects anything that does not clear. Hard because a payment must never be processed twice, the database can never take a maintenance window, and correctness must be provable, not assumed.

## Scale (only if stated)
- Users / DAU: 135+ currencies, 185 countries
- Requests per second: DocDB 5M+ queries/sec; 10,000+ distinct query shapes
- Data volume: petabytes across 5,000+ collections on 2,000+ shards; $1T processed in 2023, $1.4T in 2024; Black Friday/Cyber Monday 300M transactions, $18.6B
- Message throughput: Ledger 5B events/day
- Availability: 99.999% (2023), target "5.5 nines" (2025)
- Timeliness: 99.99% of dollar volume ingested and verified in Ledger within 4 days; 99.9999% of money movement explainable

## Requirements stated or clearly implied
- Availability target: 99.999%+, no maintenance windows, zero-downtime migrations
- Consistency: strong per request (ACID transactions around idempotent operations); "prefer rejecting a payment over double-processing it" (domain norm)
- Latency target: API interactive; traffic switch during shard migration "milliseconds to a maximum of 2 seconds"
- Ordering needs: Ledger tolerates out-of-order events via identifiers
- Replay or reprocessing: Ledger is replayable to any point in time; corrections are revert-and-reprocess, never mutate
- Retention: immutable event log kept for audit; idempotency keys expire (24 h per Stripe API docs)
- Compliance / residency: PCI, audit, regulatory monthly close; multi-tenancy enforced in DocDB
- Durability: financial data, effectively no loss tolerated

## Boundaries
- Regions / zones: not stated beyond multi-shard; DocDB control plane separate from data plane
- Trust zones: merchants (external) -> public API edge -> internal services -> external financial partners (card networks, banks) as another untrusted boundary
- Named subsystems: Public API (idempotency layer), Payment services (state machines), DocDB (proxy, shards, control plane, Data Movement Platform), Ledger (event log, fund flows, DQ metrics), Data platform (Hadoop/Scalding, Presto), Migration tooling (Scientist)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Merchant integration | Client libraries with automatic retry, exponential backoff, jitter, Idempotency-Key header | stripe-ruby etc. | web-client / sdk-client | retry: exponential-backoff-jitter |
| 2 | Public API edge | Accepts POST with Idempotency-Key; replays cached response for repeated keys | in-house | api-gateway | idempotencyKeys: true; keyTtlHours: 24 |
| 3 | Idempotency key store | Stores key, request fingerprint, phase, cached response | in DocDB (implied) | nosql-database (or cache) | |
| 4 | Payment service | Charge/PaymentIntent state machine; atomic phases in ACID transactions | in-house (Ruby) | app-server | stateless: true; pattern: state-machine |
| 5 | Card networks / acquiring banks | External money movement | Visa, Mastercard, banks | third-party-api | latency: 200-800 ms (secondary) |
| 6 | Webhook delivery | Notifies merchants of events with retries | in-house | webhook-endpoint (new, outbound) | retries: true |
| 7 | DocDB proxy | Routes queries to shards; no direct DB access from services; enforces tenancy | in-house | database-proxy | routing: chunk-range; multiTenant: true |
| 8 | DocDB shards | MongoDB community replica sets, 2,000+ shards, chunks by shard-key range | MongoDB | nosql-database (document) | shards: 2000; qps: 5000000 |
| 9 | Routing metadata service | Maps chunks to physical shards | in-house | coordination-service | |
| 10 | DocDB control plane / Coordinator | Provisioning, upgrades, Data Movement Platform orchestration | in-house | control-plane-coordinator | |
| 11 | Data Movement Platform | Snapshot bulk import (sorted insert, 10x), bidirectional replication, verification, version-gated traffic switch | in-house | worker (migration) | switchLatencyMaxSeconds: 2 |
| 12 | Ledger event log | Immutable, append-only record of money-movement events; replayable | in-house | event-log (new) / stream | immutable: true; eventsPerDay: 5e9 |
| 13 | Ledger state machines / fund flows | Model each producer as accounts and balances; double-entry clearing | in-house | app-server (batch + streaming) | doubleEntry: true |
| 14 | Data quality metrics | Clearing, timeliness, completeness; alerts on DQ score | in-house | monitoring | |
| 15 | Presto | Ad-hoc SQL over Ledger data | Presto | data-warehouse | |
| 16 | Hadoop / Scalding | Offline MapReduce for migrations and backfills | Hadoop, Scalding | etl-job | |
| 17 | Scientist | Runtime experiment comparing old vs new read paths | GitHub Scientist | property of app-server (dual-read) | |
| 18 | Reconciliation / Accounting Close | Monthly regulatory close against external reports | in-house | scheduled-job (cron) | cadence: monthly |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| merchant | api-edge | https | sync | at-least-once (client retries) | Idempotency-Key header |
| api-edge | idempotency-store | docdb | sync | | lookup key, replay cached response |
| api-edge | payment-service | internal | sync | | |
| payment-service | docdb-proxy | mongo wire | sync | | ACID transaction per phase |
| docdb-proxy | docdb-shard | mongo wire | sync | | chunk routing |
| docdb-proxy | routing-metadata | internal | sync | | |
| payment-service | card-network / bank | https/iso | sync | | external, 200-800 ms; ambiguous failures |
| payment-service | webhook-delivery | queue | async | at-least-once | merchant callbacks with retry |
| webhook-delivery | merchant endpoint | https | async | at-least-once | |
| producers (payment, payouts, billing...) | ledger-event-log | internal | async | at-least-once | 5B/day; out-of-order tolerated |
| ledger-event-log | fund-flow-state-machines | internal | async | | replay to any point |
| fund-flow | dq-metrics | internal | async | | clearing, timeliness, completeness |
| dq-metrics | alerting | internal | async | | |
| ledger | presto | sql | sync | | investigation |
| coordinator | docdb-shard (source, target) | internal | async | | bulk copy, bidirectional replication, switch |
| hadoop/scalding | docdb | batch | async | | backfill offline, not against prod reads |
| external bank reports | reconciliation | batch | async | | "malformed reports or propagated errors" |

## Failure modes, incidents, tradeoffs the source discusses
- Network ambiguity causes double charge: three failure points (connect, mid-operation, lost response); "the customer being double-charged, which is very bad". Idempotency keys plus ACID phases fix it. Source: idempotency.
- Retry storms: exponential backoff plus jitter against "thundering herd". Source: idempotency.
- Immutability cost: "We can't run simple queries to mutate the state; instead, we have to revert and reprocess prior operations." Source: ledger.
- Correctness by construction: double-entry gives "a mathematical proof of correctness"; uncleared balance means missing, late or wrong event. Source: ledger.
- Missing or mis-keyed events: "If the release event is never published or has the wrong id, Ledger would not clear the balance." Source: ledger.
- External partner failures: "malformed reports or propagated errors from banking or network partners"; "currencies ceasing to exist or large banks collapsing overnight" handled by bounding, not preventing. Source: ledger.
- Scale vs perfection: "at Stripe scale, that's impossible... a system that keeps these imperfections manageable and bounded." Source: ledger.
- Online migration risk: 100M+ objects, no maintenance windows; four phases (dual write, backfill offline, switch reads under Scientist, remove old); "alert us as soon as a single piece of data was inconsistent in production". Source: online-migrations.
- Database as a service in-house: proxy prevents direct DB access, enforces multi-tenancy; data movement is snapshot + bidirectional replication + verify + version-gated switch under 2 s. Build vs buy chosen for security, performance control, tenancy. Source: infoq DocDB.

## Unknowns
- Payment service internal topology (queues, fraud/Radar, payouts) beyond public API docs
- DocDB replication topology across regions
- Idempotency key storage product and exact TTL behaviour internally
- Webhook retry schedule specifics

## Candidates
- New kinds: event-log (immutable append-only log distinct from transient queue; overlaps stream), webhook-endpoint (outbound callbacks to third parties with retry), sdk-client (client library with retry policy; may fold into web-client), scheduled-job (cron: monthly close), third-party-api (2nd sighting), control-plane-coordinator (2nd), coordination-service (2nd), database-proxy (4th), data-warehouse (3rd), etl-job (4th), monitoring (5th)
- New properties on existing kinds: api-gateway.idempotencyKeys (boolean), keyTtlHours (integer); nosql-database.shards (integer), multiTenant (boolean); event-log.immutable (boolean), replayable (boolean); app-server.pattern (state-machine, dual-read)
- New edge properties: idempotent (2nd sighting), retryPolicy (none, fixed, exponential, exponential-jitter), ambiguousFailurePossible (boolean, external money movement)
- New requirement paths: correctness.provable (boolean); data.immutableAudit (boolean); availability.zeroDowntimeMigrations (boolean); compliance.pci (boolean)
- New rules:
  - mutating-public-endpoint-without-idempotency: api-gateway exposing POST edges from external clients with idempotencyKeys false
  - retry-without-backoff-jitter: client edge retryPolicy exponential without jitter while rps high
  - external-money-movement-without-reconciliation: third-party-api edge for payments with no reconciliation or ledger edge
  - money-store-without-immutable-log: design with payments requirement and no event-log or ledger node
  - direct-shard-access: app-server edge to sharded nosql-database bypassing database-proxy when proxy exists
  - migration-without-dual-write: (process rule, informational) data migration declared without dual-write phase
