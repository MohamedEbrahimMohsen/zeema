# stock-exchange: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/stock-exchange.md` (Alex Xu and Sahn Lam, *System Design Interview* vol 2 ch 12; Martin Fowler, "The LMAX Architecture"; Jane Street, "How to Build an Exchange" and *Signals and Threads*, "Multicast and the Markets"), re-verified 2026-09-14.
- Size: 20 nodes, 27 edges, 6 groups.

## Clean variant (header of design.yaml)

Reference architecture: an electronic stock exchange - sequenced single-threaded matching
core, journal and snapshots for replay, multicast market data with gap fill, reporting and
clearing kept off the critical path (Xu vol 2 ch 12, LMAX, Jane Street JX), clean variant.

Fixes relative to stock-exchange.broken.yaml:
  - wallet-ledger is an append-only double-entry ledger, not an ordinary positions table
  - the post-trade call into the clearing house carries an idempotency key
  - reporting-db declares backups and a regulatory retention period
  - the reporter consumes the sequenced stream asynchronously instead of being called
    synchronously by the order manager, so no reporting I/O sits on the order path
  - gap-fill requests from participants back off with jitter behind a circuit breaker
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: an electronic stock exchange, broken variant. Same shape as
stock-exchange.yaml but with the mistakes the sources warn about: reporting I/O called
synchronously from the order path (LMAX: no I/O inside the business logic), member
positions kept in an ordinary table instead of a double-entry ledger, a post-trade
clearing call with no idempotency key, a regulatory reporting store with no backup, and
gap-fill requests that retry without a circuit breaker or a limiter in front.

This file MUST trip:
  - fanout-inline-in-request-path          (order-manager calls the reporter synchronously)
  - money-store-without-double-entry-ledger (wallet-db is a plain table; money.zeroSum is true)
  - money-mutation-without-idempotency-key (reporter -> clearing-house declares no idempotent)
  - datastore-missing-backup               (reporting-db: backupEnabled false, no retention)
  - retry-without-adaptive-shedding        (broker-client -> retransmission-server retries with
                                            no circuit breaker and no rate limiter in front)
and MUST NOT trip the rest; the header of `design.broken.yaml` lists them with the reason each
stays clean (no availability-zone group, no cache, no queue, no search-index, `latency.p99Us`
rather than `latency.p95Ms`, and so on).

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Broker / member clients (FIX, OUCH, colocated) | `broker-client` | `sdk-client` | client | exact |
| Client gateway (ports) | `client-gateway` | `envoy-gateway` | api-gateway | close (in-house gateway; see Catalogue gaps) |
| Order manager | `order-manager` | `container-service` | app-server | exact |
| Risk manager | `risk-manager` | `container-service` | app-server | exact |
| Wallet / positions | `wallet-ledger` | `double-entry-ledger` | ledger | close (the sources call it a wallet holding funds and positions; double entry is the ledger kind's contract) |
| Sequencer | `sequencer` | `raft-event-log` (`role: sequencer`) | event-store | exact |
| Journal (mmap, append-only) | `journal` | `raft-event-log` (`role: journal`, `storage: mmap`) | event-store | exact |
| Matching engine | `matching-engine-primary` | `order-book-matcher` | matching-engine | exact |
| Passive secondary / warm engine | `matching-engine-standby` | `order-book-matcher` (`role: standby`) | matching-engine | exact |
| Third processor at the DR site (LMAX) | `matching-engine-dr` | `order-book-matcher` (`role: standby`, `failover: manual`) | matching-engine | exact |
| Replicator (IP multicast to standbys) | `replication-bus` | `multicast-domain` | network-fabric | exact |
| Market data publisher | `market-data-publisher` | `multicast-feed` | realtime-gateway | exact |
| Low-latency network (kernel bypass, Layer 1, colocation) | `market-data-plant` | `multicast-domain` (`kernelBypass: true`) | network-fabric | close (the fabric is modelled as the two multicast domains it carries, not as switches) |
| Retransmission servers | `retransmission-server` | `container-worker` (`trigger: stream`) | worker | close (a request-serving process modelled as a worker) |
| Reporter | `reporter` | `container-worker` (`trigger: stream`) | worker | exact |
| Reporting DB | `reporting-db` | `relational-database` | sql-database | exact |
| Snapshot store | `snapshot-store` | `blob-store` | object-store | exact |
| Snapshot job (nightly) | `snapshot-job` | `cron-job` | worker | exact |
| Clearing / settlement interface | `clearing-house` | `bank-api` | third-party-api | close (generic money-moving third party; no clearing-house component exists) |
| Monitoring (latency histograms, gap detection) | `exchange-monitoring` | `observability-stack` | monitoring | exact |

Confidence tally: 14 exact, 6 close, 0 assumed.

Boundaries: `primary-dc` and `dr-site` (regions), `member-zone`, `edge-zone`, `trading-core` and
`post-trade` (trust zones inside the primary data centre) - the card's "single primary data centre
with colocated members; DR site with replica" and its members -> gateway -> low-latency
network -> matching core trust chain.

### Values set to satisfy a rule where the source is silent

- `security.credentialRotationDays: 90` - no source states a rotation period; without it
  `credentials-without-rotation` fires on any design holding data. 90 days is the value the other
  reference designs use, and a regulated exchange rotates datastore credentials. Assumed.
- `reporting-db.backupRetentionDays: 2555` - the card states only "reporting store long term".
  Seven years is the usual regulatory retention for trade records. Assumed; the exact number is
  not in any source.
- `latency.p99Us: 10` - Jane Street states "single-digit microseconds" per component; 10 is the
  rounded upper bound of that statement. No source states a p99 figure. Assumed. It also keeps
  `sync-chain-too-deep`, which reads `latency.p95Ms`, out of both variants - correctly, because
  the order path here is measured in microseconds, not milliseconds.
- `multicast-feed.lineArbitration: true` (A/B feed lines) - the card attributes A/B feeds to
  *Signals and Threads*, but that episode does not discuss them. Kept as the component default
  and marked assumed.

Every number that *is* from a source: `nfr.rps: 6000000` on `matching-engine-primary` (LMAX, six
million orders per second on a single thread) and `nodes: 3` on the sequencer and the journal
(LMAX, two processors in the primary data centre plus one at DR). Nothing else.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| In-house low-latency client gateway (FIX / OUCH ports) | `api-gateway` - the kind already carries `protocol: fix, ouch`, but no vendor-neutral api-gateway component exists under `default`; every one is a named product | `envoy-gateway`, the component the other reference designs use for an in-house front end |
| Layer 1 crosspoint switch / kernel-bypass NIC plant (Arista, Solarflare) | `network-fabric` - the kind has `kernelBypass`, no component models a crosspoint switch | `multicast-domain` with `kernelBypass: true` |
| Retransmission server (request-response gap-fill service) | arguably its own kind; it serves requests rather than running as a background job | `container-worker` with `trigger: "stream"` |
| Clearing house / CCP | `third-party-api` | `bank-api` (`handlesMoney: true`, `batchSettlement: true`) |

## Not encoded

- The disruptor itself: input ring buffer of 20 million slots and output ring buffers of 4 million
  slots (LMAX). The format has no node or property for an in-process lock-free queue; the
  sequencer -> engine and engine -> sequencer hops carry `protocol: "ring-buffer"` as a label only.
- The unmarshal / journal / replicate stages of the input disruptor are three consumers of one
  buffer inside a single process; they appear here as the sequencer's three out-edges (journal,
  matching engine, replication bus) rather than as nodes.
- "No I/O on the critical path" is a property of the whole engine, not of any single node or edge;
  it shows up only as the absence of sync edges from the matching engine to any store.
- Recovery times (LMAX full restart under one minute; JX rebuild in 30-60 s) have no requirement
  path. The mechanism is encoded - `replayFromJournal`, the snapshot store's restore edge, the
  journal's replay edge - but not the target.
- Fairness as a requirement ("every participant sees the update at the same instant"). There is no
  `fairness.simultaneousDelivery` path; the design expresses it structurally, as a single multicast
  plant between the publisher and every member.
- Colocation of members inside the exchange data centre: modelled as the `member-zone` trust zone
  inside `primary-dc`, with no property saying the racks are in the building.
- Price-time priority per symbol and the per-symbol order books: `algorithm: "price-time"` is on the
  engine, but the format has no way to say "one book per symbol".
- Layer 1 switching latency (3-5 ns) versus store-and-forward (7-10 microseconds), and the
  600-receiver / 600-microsecond unicast skew: numbers about the network, with nowhere to put them.
- Newer exchanges (NASDAQ) sharding the matching engine across eight threads by symbol, mentioned in
  the Jane Street talk as an evolution beyond the single-threaded design encoded here.
