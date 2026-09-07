# Intake: Payment system (Xu vol 2 ch 10) with Uber payments platform and Airbnb idempotency

## Source
- Primary: Alex Xu and Sahn Lam, System Design Interview vol 2, chapter 10 "Payment System"; author's summary https://blog.bytebytego.com/p/payment-system and full chapter walkthrough in Gergely Orosz's newsletter https://newsletter.pragmaticengineer.com/p/designing-a-payment-system (pay-in, pay-out, hosted page, reconciliation, retry and DLQ, exactly-once, Kafka, security, 1M tx/day)
- Primary: https://www.uber.com/us/en/blog/ubers-payments-platform/ (official Uber, 2025: money orders, double-entry, DynamoDB then LedgerStore, Kafka bus, Cadence for in-session flows, 1.2B entities, $217B annualised gross bookings, hot-entity batching 10x) and https://www.uber.com/kw/en/blog/payments-platform/ (official Uber, 2018: active-active, exactly-once via idempotency and strong consistency, idempotent PSP calls)
- Primary: https://www.infoq.com/news/2026/06/uber-payment-batching-system/ (InfoQ write-up of Uber ledger batching: 250 ms windows, Redis coordination, optimistic atomic updates, 30+ updates/s per account)
- Secondary: Airbnb "Avoiding double payments in a distributed payments system" and "Rebuilding payment orchestration at Airbnb" (Medium 403, airbnb.tech 404; content via search summaries: Orpheus idempotency library, DAG of retryable idempotent steps, pre-RPC, RPC, post-RPC phases)
- Cross-references: stripe-payments (Ledger, DocDB, idempotency keys), digital-wallet (queued next), robinhood-trading and coinbase-exchange (financial correctness), hotel-reservation (idempotent reservation id), ad-click-aggregation (reconciliation with batch truth)
- Verified by: canonical textbook chapter (two independent summaries) + official Uber posts + InfoQ write-up
- Confidence: high
- Date of source: 2018-2026

## System in three lines
Moves money from buyers to the platform (pay-in) and from the platform to sellers (pay-out) without charging or paying anyone twice: a payment service records an immutable payment event, a payment executor calls an external payment service provider through a hosted page and webhook so card data never touches the platform, and every successful order is written to a wallet balance and an append-only double-entry ledger, then reconciled nightly against settlement files. Uber's platform generalises this to immutable money orders streamed over Kafka, strongly consistent per-entity ledger balances, deterministic batching for hot accounts, and active-active regions. Hard because retries are mandatory and duplicates are unacceptable, so every hop needs an idempotency key, every failure needs a retry queue or dead-letter path, and the books must balance to zero across services that cannot share one transaction.

## Scale (only if stated)
- Users / DAU: Uber 1.2B ledger entities (~1 KB each); 50+ payment methods
- Requests per second: book 1M transactions/day, ~10 TPS; "not emphasizing throughput but correctness"
- Data volume: Uber money movement ~2x gross bookings, gross bookings $50B to $217B annualised over a decade
- Message throughput: Uber hot accounts 30+ updates/s per account with 250 ms batching; batch writes gave 10x throughput
- Latency: book moderate; Uber in-session flows synchronous via Cadence, back-office async

## Requirements stated or clearly implied
- Availability target: Uber active-active across regions, no single point of failure
- Consistency: exactly-once effect = at-least-once retry + idempotency; strongly consistent ledger balances (DynamoDB, then LedgerStore); double-entry zero-sum
- Latency target: user-facing charge completes in session; settlement and reconciliation daily
- Ordering needs: per payment order; deterministic batching per account
- Replay or reprocessing: immutable events and orders allow replay; retry queue with exponential backoff; DLQ for manual investigation
- Retention: ledger append-only, tamper-evident (LedgerStore) for regulators
- Compliance / residency: PCI DSS avoided by PSP hosted page and tokenisation; AML/CFT checks, 3D Secure, fraud detection, DDoS protection, encryption
- Auditability: reconciliation classes mismatches as auto-fixable, finance-manual, or investigation

## Boundaries
- Regions / zones: Uber active-active; book single region implied
- Trust zones: client browser -> PSP hosted page (card data stays with PSP) ; platform services internal; PSP, card schemes, banks, payout providers (Tipalti) external; webhooks inbound from PSP
- Named subsystems: Payment service, Payment executor, PSP integration and webhook receiver, Wallet service, Ledger service, Reconciliation system, Retry queue, Dead-letter queue, Kafka event bus, Pay-out service; Uber: money orders, entity ledgers, LedgerStore, Cadence workflows, batching layer with Redis, risk

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Client (web, mobile) | Checkout; renders PSP hosted page | apps | web-client, mobile-client | |
| 2 | API gateway | Public entry; idempotency key header | not named | api-gateway | idempotencyKeys: true |
| 3 | Payment service | Creates payment event with orders; risk check; coordinates | in-house | app-server | |
| 4 | Payment event / order DB | payment_event, payment_order tables; order status; idempotency key unique | relational | sql-database | uniqueIdempotencyKey: true |
| 5 | Payment executor | Executes one payment order against PSP; stores nonce and token | in-house | app-server + workflow-engine (Airbnb DAG of idempotent steps) | phases: pre-rpc, rpc, post-rpc |
| 6 | PSP | Charges cards; hosted page; webhook callbacks | Stripe, Adyen, Braintree | third-party-api | idempotent: true; hostedPage: true |
| 7 | Webhook receiver | Accepts PSP status callbacks; verifies signature; idempotent | in-house | webhook-endpoint | |
| 8 | Card schemes and banks | Behind PSP | Visa, banks | third-party-api (indirect) | |
| 9 | Wallet service + DB | Seller balances; strongly consistent | in-house; Uber DynamoDB | app-server + nosql-database or sql-database | consistency: strong |
| 10 | Ledger service + store | Append-only double-entry entries | in-house; Uber LedgerStore | app-server + ledger (candidate kind) | appendOnly: true; doubleEntry: true; tamperEvident: true |
| 11 | Kafka event bus | Immutable payment events to billing, analytics, notifications | Apache Kafka | stream | |
| 12 | Retry queue | Transient failures with exponential backoff | queue | queue | role: retry; backoff: exponential |
| 13 | Dead-letter queue | Repeated failures for manual work | queue | queue | role: dlq |
| 14 | Reconciliation system | Parses nightly settlement files; compares to ledger | in-house | scheduled-job + etl-job | cadence: daily |
| 15 | Settlement file ingest | Files from PSP and banks | SFTP or API | third-party-api | |
| 16 | Pay-out service | Disbursements to sellers via provider | Tipalti; Uber disbursements | app-server + third-party-api | |
| 17 | Workflow engine (Uber) | Synchronous in-session flows | Cadence | workflow-engine | |
| 18 | Batching coordinator (Uber) | Groups updates per hot account in 250 ms windows | Redis | cache (coordination) | windowMs: 250 |
| 19 | Risk and fraud | AML/CFT, fraud scoring, 3DS trigger | in-house or vendor | ml-inference + third-party-api | |
| 20 | Monitoring and alerting | Payment failures, PSP health | not named | monitoring | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | api gateway | https | sync | | idempotency-key header |
| gateway | payment service | rpc | sync | | |
| payment service | payment db | sql | sync | | unique key |
| payment service | payment executor | rpc or queue | sync (book) / async (Uber) | at-least-once | |
| executor | psp | https | sync | idempotent | nonce, token |
| client | psp hosted page | https | sync | | card data bypasses platform |
| psp | webhook receiver | https | async | at-least-once | signed, retried by PSP |
| executor | wallet | rpc | sync | | after success |
| executor | ledger | rpc | sync | | double entry |
| executor | kafka | produce | async | at-least-once | fan-out |
| executor | retry queue | produce | async | | on transient error |
| retry queue | executor | consume | async | at-least-once | backoff |
| retry queue | dlq | move | async | | after n attempts |
| psp / bank | reconciliation | file | async | daily | settlement |
| reconciliation | ledger | read | sync | | compare |
| pay-out service | payout provider | https | sync | idempotent | |
| kafka | ledger, billing, analytics (Uber) | consume | async | at-least-once | immutable orders |
| batching layer | redis | coordinate | sync | | 250 ms windows |
| batching layer | ledger store | atomic write | sync | optimistic | |

## Failure modes, incidents, tradeoffs the source discusses
- Double charge: network retry after a lost response; idempotency key in header, unique constraint in DB, PSP-side idempotency; Airbnb's Orpheus makes every step of a DAG retryable and idempotent. Source: book, Airbnb (via summaries), Uber.
- Retry storms and poison messages: exponential backoff in retry queue; DLQ after repeated failure. Source: book.
- Cross-service consistency: no distributed transaction across wallet, ledger, PSP; rely on idempotent retries and reconciliation to converge. Source: book (commenters flag the gap), Uber immutable orders.
- Hot entities: many updates on one account exceed per-request transaction limits; batch per account in 250 ms windows with Redis coordination and optimistic atomic updates. Source: Uber via InfoQ.
- Auditability and regulators: DynamoDB replaced by LedgerStore for tamper-evident, immutable records. Source: Uber.
- PCI scope: hosted page and tokenisation keep card data off platform. Source: book.
- Reconciliation classes: auto-fixable, finance-manual, unexplained. Source: book.
- Ordering of pay-in vs pay-out: pay-out after delivery; separate regulated provider. Source: book.

## Unknowns
- Book's queue product for retry and DLQ
- Uber LedgerStore internals (separate post exists; not fetched)
- Airbnb orchestration data stores (posts unreachable)

## Candidates
- New kinds: ledger (append-only double-entry money store; distinct enough from sql-database to justify a kind; 2nd sighting after stripe-payments Ledger); sightings: third-party-api (9th: PSP, banks, payout, settlement), webhook-endpoint (4th), queue (15th: retry and DLQ), stream (22nd), scheduled-job (12th), etl-job (12th), workflow-engine (7th: Cadence, Airbnb DAG), api-gateway (14th), sql-database (20th), nosql-database (28th: DynamoDB balances), ml-inference (risk), monitoring (19th), cache (16th: Redis coordination)
- New properties on existing kinds: ledger.doubleEntry, appendOnly, tamperEvident (booleans); queue.role retry (add to enum), backoff (exponential, fixed), maxAttempts; third-party-api.idempotent (boolean), hostedPage (boolean), callbackStyle (webhook, poll); webhook-endpoint.signatureVerified, idempotent (booleans); api-gateway.idempotencyKeys (2nd sighting); workflow-engine.stepsIdempotent (boolean); nosql-database consistency strong (2nd sighting)
- New edge properties: idempotencyKey (3rd sighting); retryPolicy (2nd sighting); external (boolean)
- New requirement paths: correctness.exactlyOnceEffect (boolean; 2nd sighting after notification-system); compliance.pci (2nd sighting); data.immutableAudit (2nd sighting); data.reconciliation (2nd sighting); money.zeroSum (boolean)
- New rules:
  - money-mutation-without-idempotency-key: edge to third-party-api or ledger with money semantics and idempotencyKey false while correctness.exactlyOnceEffect true (3rd sighting; promote)
  - retry-queue-without-dlq: queue role retry with no dlq edge (variant of queue-missing-dlq)
  - retry-without-backoff: queue role retry with backoff none
  - money-store-without-double-entry-ledger: money.zeroSum true and no ledger kind in design (2nd sighting after stripe)
  - card-data-through-platform: compliance.pci required and client sends card data to app-server instead of third-party-api hostedPage
  - webhook-without-signature-or-idempotency: webhook-endpoint from PSP with signatureVerified false or idempotent false
  - settlement-without-reconciliation-job: third-party-api sends settlement files and no scheduled-job reconciles to ledger
