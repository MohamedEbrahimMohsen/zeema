# Intake: Hotel reservation system (Xu vol 2 ch 7) with Agoda PriceAggregator and booking engine

## Source
- Primary: Alex Xu and Sahn Lam, System Design Interview vol 2, chapter 7 "Hotel Reservation System"; official course page https://bytebytego.com/courses/system-design-interview/hotel-reservation-system (readable in this pass)
- Primary: Agoda, "PriceAggregator: An Intelligent System for Hotel Price Fetching", arXiv 2008.02087 https://ar5iv.labs.arxiv.org/html/2008.02087 (peer-reviewed paper by Agoda engineers)
- Secondary: Agoda engineering posts on the multi-product booking engine and platform (Medium, 403; content via search summaries): graph of asynchronous agents, static workflow graphs, supplier confirmation ordering, on-premise infrastructure, Kubernetes pods
- Cross-references: booking-search (MySQL fleet, room-type inventory), airbnb-search (SOA, derived data), stripe-payments (idempotency keys), shopify-flash-sale (inventory contention), doordash-delivery (Cadence workflows)
- Verified by: canonical textbook chapter (official page) + peer-reviewed Agoda paper + official Agoda posts via summaries
- Confidence: high
- Date of source: 2020-2026

## System in three lines
Lets travellers search, price and reserve hotel room types for date ranges without double booking: a relational inventory table keyed by hotel, room type and date is the source of truth, reservations are inserted with client-generated idempotency keys under either pessimistic locks, optimistic version checks or a database constraint, and a Redis inventory cache absorbs the read-heavy funnel. Online travel agencies such as Agoda add a supplier layer: prices are fetched from rate-limited supplier APIs into a price cache with learned per-itinerary TTLs, and a booking engine coordinates fraud, payment and supplier confirmation as a workflow with compensation. Hard because the write rate is tiny but contention on hot hotel-dates is real, prices in cache go stale, suppliers cap QPS, and a multi-service booking must not lose money when a step fails.

## Scale (only if stated)
- Users / DAU: book 5,000 hotels, 1M rooms, 70% occupancy, 3-day stays; ~240,000 reservations/day, ~3 reservations/sec
- Requests per second: book funnel 300 QPS hotel detail pages, 30 QPS booking pages, 3 QPS reservations
- Data volume: inventory pre-populated for 2 years ahead: 5,000 hotels x ~20 room types x 730 days ~ 73M rows (book order of magnitude)
- Message throughput: Agoda supplier QPS quotas "never enough to cover all user searches"; quota split across data centres with different peaks
- Latency: moderate acceptable (book); Agoda 10-30% gains in cache hit and conversion from SmartTTL and SmartScheduler

## Requirements stated or clearly implied
- Availability target: not numeric; independent scaling per service
- Consistency: no double booking; ACID on inventory plus reservation; overbooking allowed at 110% capacity
- Latency target: moderate; reads served from cache
- Ordering needs: none beyond per hotel-date row contention
- Replay or reprocessing: reservation status machine (pending -> paid, rejected, cancelled; paid -> refunded) supports retries and compensation
- Retention: past inventory rows meaningless; only current and future dates cached
- Compliance / residency: payments delegated to payment service (PCI in stripe card)
- Idempotency: client fetches a reservation id first, submits with it; primary key uniqueness blocks duplicates

## Boundaries
- Regions / zones: Agoda multiple data centres sharing supplier quota; book single region implied
- Trust zones: public web and mobile -> API gateway -> internal services (gRPC) -> databases; external suppliers and payment providers outside
- Named subsystems: Hotel service, Rate service, Reservation service, Payment service, Hotel management service, Inventory cache, Reservation DB; Agoda: PriceAggregator (Price DB cache, SmartTTL, SmartScheduler, supplier clients), Booking engine (agents: availability confirmation, fraud check, payment, supplier confirmation)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Web / mobile clients | Search, view, reserve | apps | web-client, mobile-client | |
| 2 | CDN | Static assets | not named | cdn | |
| 3 | Public API gateway | Routes to services; rate limits | not named | api-gateway | |
| 4 | Hotel service | Hotel and room type details | in-house | app-server | |
| 5 | Rate service | Prices per room type per date | in-house | app-server | |
| 6 | Reservation service | Creates reservations; inventory check and decrement | in-house | app-server | locking: pessimistic, optimistic, constraint |
| 7 | Payment service | Charges and refunds | in-house + PSP | app-server + third-party-api | |
| 8 | Hotel management service | Admin CRUD on hotels and inventory | in-house | app-server | |
| 9 | Reservation + inventory DB | room_type_inventory (hotel_id, room_type_id, date, total_inventory, total_reserved), reservation, hotel, room_type_rate | relational, sharded by hotel_id | sql-database | sharded: true; shardKey: hotelId; constraint: total_reserved <= 1.1 x total_inventory |
| 10 | Inventory cache | Available count per hotel, type, date; current and future only | Redis | cache | invalidation: event via app or CDC |
| 11 | CDC | Propagates DB inventory changes to cache | Debezium | change-data-capture | |
| 12 | Inter-service RPC | Service-to-service calls | gRPC | protocol (edge property) | |
| 13 | Saga coordinator (discussed) | Compensating transactions across service DBs | not named | workflow-engine | |
| 14 | Price DB / cache (Agoda) | Supplier prices with per-itinerary TTL | in-house | cache | ttlStrategy: learned |
| 15 | SmartTTL service (Agoda) | Assigns TTL per search cluster (XGBoost features) | in-house | ml-inference | |
| 16 | SmartScheduler (Agoda) | Prefetches high-value itineraries at constant QPS | in-house | scheduled-job + rate-limiter | |
| 17 | Supplier API clients (Agoda) | Calls wholesalers and retailers under QPS quotas | suppliers | third-party-api | qpsQuota: per supplier |
| 18 | Booking engine (Agoda) | Static graph of async agents: availability, fraud, payment, supplier confirm | in-house on Kubernetes | workflow-engine + app-server | graph: static; scaling: pods |
| 19 | Fraud check agent (Agoda) | Risk decision before payment | in-house | app-server | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | api gateway | https | sync | | |
| gateway | hotel / rate / reservation services | grpc | sync | | |
| reservation service | inventory cache | redis | sync | | availability check |
| reservation service | reservation db | sql | sync | | insert with idempotency key, lock or version or constraint |
| reservation db | cdc | log | async | | |
| cdc | inventory cache | write | async | at-least-once | |
| reservation service | payment service | grpc | sync | | after pending |
| payment service | psp | https | sync | | idempotent |
| hotel management | reservation db | sql | sync | | inventory updates |
| saga coordinator | services | rpc | async | | compensation on failure |
| search | price db (agoda) | read | sync | | cache hit or miss |
| price miss | supplier api | https | sync | | quota limited |
| smart scheduler | supplier api | https | async | | constant qps prefetch |
| ttl service | price db | write | sync | | ttl per itinerary |
| booking engine | supplier api | https | sync | | confirm price and hold |
| booking engine agents | each other | async messages | async | | graph transitions |

## Failure modes, incidents, tradeoffs the source discusses
- Double booking from double clicks: solved by idempotent reservation id and primary key. Source: book.
- Concurrent reservations for the last room: pessimistic lock (deadlocks, poor scalability), optimistic version (retry storms under contention), database constraint (simple, poor UX on failure). Source: book.
- Overbooking as a feature: 110% rule in the check. Source: book.
- Cache and DB drift: cache may show stale availability; final check happens in the database. Source: book.
- Microservice data consistency: separate DBs need saga or 2PC; book keeps reservation and inventory in one DB for ACID. Source: book.
- Stale supplier prices: price fetched into cache may no longer be sellable; confirmation with hotel after booking; SmartTTL trades accuracy for coverage. Source: Agoda paper.
- Supplier QPS quotas shared across data centres with different peak hours. Source: Agoda paper.
- Multi-product confirmation ordering: confirm the product with the strictest terms first to minimise exposure if a later step fails. Source: Agoda post via summary.

## Unknowns
- Agoda's booking database technology and sharding
- Retry and compensation semantics in Agoda's agent graph
- Book's exact cache invalidation choice (app-level vs CDC) in the final design

## Candidates
- New kinds: none; sightings: sql-database (17th), cache (26th), change-data-capture (8th), workflow-engine (6th: saga coordinator, agent graph), third-party-api (8th: suppliers, PSP), ml-inference (SmartTTL), scheduled-job (14th: SmartScheduler), rate-limiter (outbound quota to suppliers)
- New properties on existing kinds: sql-database.concurrencyControl (pessimistic, optimistic, constraint); sql-database.checkConstraints (boolean); cache.ttlStrategy (fixed, learned, none); cache.dataScope (current-and-future); third-party-api.qpsQuota (integer), quotaScope (global, per-datacenter); workflow-engine.graph (static, dynamic), compensation (boolean); app-server.idempotencyKeySource (client, server)
- New edge properties: idempotencyKey (2nd sighting); quotaLimited (boolean)
- New requirement paths: inventory.overbookingPercent (integer); inventory.noDoubleBooking (boolean); pricing.stalenessAllowed (boolean)
- New rules:
  - reservation-write-without-concurrency-control: inventory sql-database with concurrencyControl unset while inventory.noDoubleBooking true
  - inventory-cache-without-authoritative-check: reservation path reads cache only, no sync edge to the inventory database before commit
  - cross-service-write-without-saga-or-shared-db: reservation and inventory in different databases with no workflow-engine compensation
  - supplier-calls-without-quota-limiter: sync edges to third-party-api with qpsQuota set and no rate-limiter or scheduler in front
  - cached-price-without-confirmation-step: cache.ttlStrategy on prices and booking path lacks a supplier confirmation edge
  - mutating-endpoint-without-idempotency-key: reservation create edge with idempotencyKey false (2nd sighting after stripe)
