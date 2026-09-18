# hotel-reservation: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/hotel-reservation.md` (Alex Xu and Sahn Lam, *System Design Interview vol 2*, ch 7, official ByteByteGo course page; Agoda, "PriceAggregator", arXiv 2008.02087; Agoda multi-product booking engine post via search summary). Re-verified 2026-09-14.
- Size: 23 nodes, 31 edges, 4 groups.

## Clean variant (header of design.yaml)

Reference architecture, clean variant: hotel reservation with a sharded relational inventory
table as the source of truth, a CDC-fed Redis availability cache, a durable saga that drives
fraud, payment and supplier confirmation, and supplier price fetching behind a quota limiter.

Fixes relative to hotel-reservation.broken.yaml:
  - booking-orchestrator (durable saga, compensation on) owns fraud -> payment -> supplier
    confirmation, so payment-service never calls the PSP inline with nowhere to park the request
  - payment-service -> psp declares idempotent, so a retried charge cannot become a double charge
  - reservation-db -> inventory-cdc -> cache-updater rebuilds inventory-cache, so the
    materialised availability counts have a rebuild path instead of app-level writes only
  - price-cache declares an lru eviction policy instead of leaving the vendor default
  - reservation-service -> reservation-db uses the database's own concurrency control and a
    circuit breaker on its retry, so optimistic-lock retries cannot storm the shard
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture, broken variant: the same hotel reservation system with the booking
workflow removed. The reservation service calls fraud, payment and the supplier inline, the
charge carries no idempotency key, the availability cache is written only by the application,
and the optimistic-lock retry on the inventory shard has nothing to stop it storming.

This file MUST trip:
  - external-call-inline-without-durable-path  (payment-service -> psp and reservation-service -> supplier-api are sync with no workflow engine or queue anywhere)
  - money-mutation-without-idempotency-key     (payment-service -> psp does not declare idempotent while correctness.exactlyOnceEffect is true)
  - materialised-cache-without-rebuild-path    (inventory-cache is materialised and only reservation-service, an app-server, writes it)
  - cache-missing-eviction-policy              (price-cache declares evictionPolicy none)
  - retry-without-adaptive-shedding            (reservation-service -> reservation-db retries with no circuit breaker and no rate limiter in front of the shard)
and MUST NOT trip:
  - cache-as-primary-store-without-persistence (both caches keep usedAsPrimaryStore false; reservation-db is still the source of truth)
  - read-heavy-path-without-cache              (inventory-cache and price-cache still exist; that rule is design-wide)
  - datastore-missing-backup, datastore-single-region (both databases declare backups and retention; multiRegion is false)
  - credentials-without-rotation               (security.credentialRotationDays is still declared)
  - single-writer-primary-at-peak-qps, read-replica-as-sole-scaling (reservation-db is sharded; neither store is declared above 5000 rps)
  - derived-store-without-cdc-or-rebuild, business-updates-without-index-propagation (no search-index node)
  - queue-missing-dlq, retry-queue-without-dlq, pubsub-replay-required (no queue or topic in this design)
  - sync-chain-too-deep                        (no latency.p95Ms requirement is stated by the sources)
  - stateful-node-without-zone-redundancy, shared-dependency-without-redundancy,
    object-store-single-zone-with-durability-target, multi-leader-store-without-conflict-policy (no such nodes)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Web clients | `web-client` | `web-browser` | client | exact |
| Mobile clients | `mobile-client` | `mobile-app` | client | exact |
| CDN | `static-cdn` | `content-delivery-network` | cdn | exact |
| Public API gateway | `api-gateway` | `envoy-gateway` | api-gateway | assumed (source names no product; no vendor-neutral generic exists) |
| Hotel service | `hotel-service` | `container-service` | app-server | exact |
| Rate service | `rate-service` | `container-service` | app-server | exact |
| Reservation service | `reservation-service` | `container-service` | app-server | exact |
| Payment service | `payment-service` | `container-service` | app-server | exact |
| Fraud check agent (Agoda) | `fraud-service` | `container-service` | app-server | exact |
| Hotel management service | `hotel-management-service` | `container-service` | app-server | exact |
| Search / price funnel front end (Agoda PriceAggregator) | `price-search-service` | `container-service` | app-server | close (the paper draws the search path, not a named service box) |
| Booking engine agent graph + orchestrator (Agoda); saga coordinator (book, discussed) | `booking-orchestrator` | `temporal` | workflow-engine | close (in-house on Kubernetes; Temporal is the nearest durable-saga generic) |
| SmartTTL service (Agoda) | `smart-ttl` | `tensorflow-serving` | ml-inference | close (XGBoost model served in-house; no vendor-neutral model server exists) |
| SmartScheduler (Agoda) | `smart-scheduler` | `cron-job` | worker | close (`rateControl: fixed` encodes the constant-QPS prefetch) |
| Cache refresh consumer (book, CDC option) | `cache-updater` | `container-worker` | worker | assumed (the book shows CDC feeding the cache without drawing the consumer) |
| Outbound supplier QPS quota (Agoda) | `supplier-quota-limiter` | `in-process-limiter` | rate-limiter | close (`perReplicaQuotaDivision` encodes the quota split across data centres) |
| CDC | `inventory-cdc` | `debezium` | change-data-capture | close (the chapter names change data capture, not a product) |
| Inventory cache | `inventory-cache` | `redis` | cache | exact |
| Price DB / cache (Agoda) | `price-cache` | `cache-cluster` | cache | exact (in-house store; generic cache is the right choice) |
| Reservation + `room_type_inventory` DB | `reservation-db` | `relational-database` | sql-database | exact |
| Hotel + `room_type_rate` DB | `hotel-rate-db` | `relational-database` | sql-database | exact |
| Supplier APIs (wholesalers, retailers) | `supplier-api` | `supplier-api` | third-party-api | exact |
| PSP | `psp` | `payment-service-provider` | third-party-api | exact |

Confidence tally: 15 exact, 6 close, 2 assumed.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Unnamed public API gateway | `api-gateway` has no vendor-neutral generic under `default` | `envoy-gateway` |
| Agoda in-house booking engine / orchestrator | `workflow-engine` has no vendor-neutral generic under `default` | `temporal` |
| Agoda SmartTTL (XGBoost model served in-house) | `ml-inference` has no vendor-neutral generic model server under `default` | `tensorflow-serving` |

Nothing was added to the catalogue.

## Assumed values

- `security.credentialRotationDays: 90` — neither source states a rotation period, and there is no
  key-management box to draw. Set to the value that reflects normal practice for a card-adjacent
  system so the clean design does not trip `credentials-without-rotation`. Carried into the broken
  twin unchanged, so that rule is not part of what the twin proves.
- `traffic.readWriteRatio: 100` — derived from the two stated numbers (300 QPS hotel detail pages
  against ~3 QPS reservations), not a number the sources print.
- `concurrencyControl: "optimistic"` on `reservation-db` — the chapter presents three options
  (pessimistic lock, optimistic version, database constraint) and does not pick one for the final
  design. Optimistic is encoded because it is the option the chapter recommends for this write
  rate; the CHECK constraint (`total_reserved <= 110% * total_inventory`) is carried in the edge
  label rather than a property.
- `backupEnabled` / `backupRetentionDays: 30` and `encryptionAtRest` on both databases — not stated
  by the sources; set so the clean design satisfies `datastore-missing-backup`, which encodes a
  practice any production reservation store has.

## Not encoded

- The 30 QPS booking-page figure and the ~73M inventory-row estimate: no node property carries a row
  count, and the booking-page QPS could not be re-confirmed on 2026-09-14.
- The reservation status machine (pending -> paid / rejected / cancelled; paid -> refunded): the
  format has no state-machine construct. It survives only as the compensation edge label.
- The three-way concurrency-control tradeoff (pessimistic deadlocks vs optimistic retry storms vs
  constraint UX): `sql-database.concurrencyControl` holds one value, not the discussion.
- The 110% overbooking rule: no `requirements` path expresses an inventory overbooking percentage,
  so it lives in the `reservation-service -> reservation-db` edge label.
- Agoda's multiple data centres sharing one supplier quota: only one `region` group is modelled
  because neither source describes what else is replicated per data centre. The quota split itself
  is encoded as `perReplicaQuotaDivision: true` on `supplier-quota-limiter`.
- "Confirm the product with the strictest terms first": ordering inside the agent graph is not
  expressible; it is in the `booking-orchestrator -> supplier-api` edge label.
- SmartTTL's learned per-itinerary TTL values: `cache.ttlSeconds` holds a single integer, so the
  clean design omits it rather than inventing one, and the learned behaviour is carried by the
  `smart-ttl -> price-cache` edge.
- The book's saga-vs-2PC discussion for cross-service consistency: the chapter deliberately keeps
  reservation and inventory in one database for ACID, so the saga appears only as the Agoda booking
  engine, merged into `booking-orchestrator`.
