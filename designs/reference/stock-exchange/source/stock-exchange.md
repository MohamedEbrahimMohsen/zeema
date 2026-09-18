# Intake: Stock exchange (Xu vol 2 ch 12) with LMAX and Jane Street exchange architecture

## Source
- Primary: Alex Xu and Sahn Lam, System Design Interview vol 2, chapter 12 (13 in 2nd edition) "Stock Exchange"; author's page https://blog.bytebytego.com/p/design-a-stock-exchange (404 in this pass); chapter content well known: trading, reporting and market data flows, client gateway, order manager, sequencer, matching engine, market data publisher, reporter, risk manager, wallet, critical path in one process, event sourcing through the sequencer, mmap, hot-warm failover
- Primary: Martin Fowler, "The LMAX Architecture" https://www.martinfowler.com/articles/lmax.html (experience report with LMAX engineers: single-threaded business logic processor, 6M orders/s, disruptors, journaling, replication, snapshots, sub-minute restart)
- Primary: Jane Street, "How to Build an Exchange" tech talk https://www.janestreet.com/tech-talks/building-an-exchange/ (single-threaded matching engine state machine, ports, internal UDP, retransmitters, passive secondary, replay, 3M msg/s, single-digit microseconds) and Signals and Threads "Multicast and the Markets" https://signalsandthreads.com/multicast-and-the-markets/ (multicast fairness, sequence numbers, gap fill, retransmission servers)
- Cross-references: coinbase-exchange (matching engine, MSK, incidents), robinhood-trading (order routing, clearing), digital-wallet (event sourcing, Raft), distributed-message-queue (replicated log), ad-click-aggregation (exactly-once)
- Verified by: canonical textbook chapter + LMAX experience report + Jane Street official talks
- Confidence: high
- Date of source: 2011-2022

## System in three lines
Accepts orders from brokers through gateways, assigns each a global sequence number in a single-threaded sequencer, matches them in an in-memory limit order book by price-time priority, and publishes executions and order-book updates to all participants at the same instant over multicast, with a reporter writing fills and positions to durable stores after the fact. Everything on the critical path runs as deterministic state machines fed by the sequenced input log, so a passive secondary replays the same stream and can take over, and any component rebuilds state by replaying the day from the journal. Hard because latency is measured in microseconds, fairness requires a single total order and simultaneous delivery, and the engine must never lose or reorder an accepted order even when the primary dies.

## Scale (only if stated)
- Users / DAU: book: tens of thousands of participants; symbols in the thousands
- Requests per second: LMAX "6 million orders per second on a single thread" on a 2011 commodity server; Jane Street JX 3M messages/s peak
- Data volume: LMAX input ring buffer 20M slots, output 4M; nightly snapshot plus journal
- Message throughput: multicast fairness gap: unicast to 600 receivers leaves the last "600 microseconds, at a minimum, behind"; multicast near one microsecond
- Latency: book microseconds end to end inside the exchange; Jane Street single-digit microseconds per component; LMAX failover "in microseconds"; JX recovery by replay 30-60 s

## Requirements stated or clearly implied
- Availability target: hot-warm (book) or primary plus passive secondary (JX) plus DR site (LMAX: two processors in primary DC, one at DR)
- Consistency: single total order of events; determinism so replicas converge; no lost accepted orders
- Latency target: microseconds on critical path; no I/O inside business logic
- Ordering needs: global sequence number from sequencer; price-time priority per book
- Replay or reprocessing: journal plus snapshot; replay from start of day (JX) or snapshot (LMAX under one minute)
- Retention: journal for day; reporting store long term
- Compliance / residency: regulatory reporting, audit of every event, fair access; colocation for members
- Fairness: all participants see an execution or book update at the same time (multicast)

## Boundaries
- Regions / zones: single primary data centre with colocated members; DR site with replica
- Trust zones: brokers and members (authenticated, rate limited) -> client gateway -> internal low-latency network (UDP, multicast) -> matching core; reporting and market data flow outward
- Named subsystems: Client gateway (ports), Order manager, Sequencer, Matching engine (order books), Market data publisher, Reporter, Risk manager, Wallet (positions and funds), Retransmission servers, Passive secondary, Journal and snapshots; LMAX: business logic processor, input disruptor (unmarshaller, journaler, replicator), output disruptors

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Broker / member clients | Submit orders via FIX or binary protocol; colocated | FIX, OUCH | sdk-client | colocated: true |
| 2 | Client gateway (ports) | Auth, validation, normalisation, flow control, rate limit; TCP in, UDP to core | in-house | api-gateway (low-latency) + rate-limiter | protocol: fix, ouch; transport: tcp |
| 3 | Order manager | Pre-trade risk and wallet check; maintains order state | in-house | app-server | inProcess: true |
| 4 | Risk manager | Per-account limits, kill switches | in-house | app-server (risk) | |
| 5 | Wallet / positions | Funds and positions checked before acceptance | in-house; ledger downstream | ledger (positions) | |
| 6 | Sequencer | Assigns global sequence numbers; single writer; source of the event log | in-house; LMAX input disruptor | sequencer (candidate) / event-store | singleWriter: true; journaled: true |
| 7 | Matching engine | In-memory limit order books; price-time priority; deterministic | in-house; LMAX BLP; JX | matching-engine | singleThreaded: true; deterministic: true; algorithm: price-time |
| 8 | Journal | Persists sequenced inputs (mmap, append-only) | disk, mmap | event-store | storage: mmap |
| 9 | Snapshot store | Nightly or periodic state snapshots | disk | object-store | snapshotCadence: daily |
| 10 | Replicator | Multicasts sequenced input to standby processors | IP multicast | network-fabric (multicast) | |
| 11 | Passive secondary / warm engine | Replays same stream; takes over on failure | in-house | matching-engine (standby) | role: standby; failover: manual (JX) or automatic |
| 12 | Market data publisher | Builds L1/L2/L3 feeds; multicast with sequence numbers | in-house | realtime-gateway (multicast) | transport: udp-multicast; feeds: a/b |
| 13 | Retransmission servers | Gap fill by sequence number for market data and internal streams | in-house | worker (retransmitter) | |
| 14 | Reporter | Writes executions, order history to durable DB; regulatory reports | in-house | worker + sql-database | offCriticalPath: true |
| 15 | Reporting DB | Trades, orders, positions | relational | sql-database | |
| 16 | Clearing / settlement interface | Post-trade to clearing house | third party | third-party-api | |
| 17 | Low-latency network | Kernel bypass, Layer 1 crosspoint switches, colocation | Solarflare, Arista | network-fabric | kernelBypass: true |
| 18 | Monitoring | Latency histograms, gap detection | in-house | monitoring | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | gateway | fix / ouch over tcp | sync | | ack inline |
| gateway | order manager | udp internal | async | sequenced | |
| order manager | risk manager + wallet | in-process call | sync | | pre-trade |
| order manager | sequencer | in-process or udp | async | | assigns seq |
| sequencer | journal | append (mmap) | sync | durable | before publish |
| sequencer | matching engine | in-process ring buffer | async | ordered | |
| sequencer | replicator -> standby engines | multicast | async | sequenced, gap-fill | |
| matching engine | sequencer (outputs) | in-process | async | | executions sequenced too |
| sequencer | market data publisher | in-process | async | | |
| market data publisher | participants | udp multicast | async | at-most-once + retransmit | a/b feeds |
| participants | retransmission servers | tcp | sync | | gap fill |
| sequencer | reporter | stream | async | at-least-once | off critical path |
| reporter | reporting db | sql | sync | | |
| reporter | clearing | api | async | | post-trade |
| snapshot job | journal + engine state | write | async | | nightly |

## Failure modes, incidents, tradeoffs the source discusses
- Concurrency vs determinism: queues and locks fight CPU cache behaviour; single-threaded processor with lock-free ring buffers wins. Source: LMAX.
- No I/O on the critical path: external calls become output events and later input events; requires asynchronous thinking and strict input validation since there is no rollback. Source: LMAX.
- Failover: standbys consume the same sequenced stream; LMAX microsecond failover with two local plus one DR; JX manual failover to passive secondary. Source: LMAX, JX.
- Recovery cost: snapshot plus journal replay under one minute (LMAX); replay from start of day 30-60 s (JX). Source: both.
- UDP loss: sequence numbers, retransmission servers, A/B feeds keep the fast path fast while slow receivers catch up. Source: Signals and Threads, JX.
- Fairness: unicast fan-out creates hundreds of microseconds of skew; multicast and Layer 1 switching deliver simultaneously. Source: Signals and Threads.
- Limits of the model: only for connected domains where order matters; not for independent parallel workloads. Source: LMAX.
- Book: keep the critical path in one process, use mmap, avoid GC pauses, hot-warm engines, colocation for members (well-known chapter content).

## Unknowns
- Book's exact hot-warm switch mechanism and market data L1/L2/L3 details
- Jane Street JX persistence beyond in-memory replay
- LMAX current architecture (post-2011)

## Candidates
- New kinds: sequencer (single-writer global ordering component; could be a role of event-store; 1st sighting); matching-engine (2nd sighting after coinbase, now qualifies); sightings: event-store (2nd: journal, now qualifies), network-fabric (5th: multicast, kernel bypass), realtime-gateway (14th: market data), api-gateway (15th), rate-limiter (7th), ledger (4th: positions), sql-database (22nd), worker (16th), object-store (14th), third-party-api (10th), monitoring (15th), sdk-client (6th), app-server (24th)
- New properties on existing kinds: matching-engine.singleThreaded, deterministic, algorithm (price-time, pro-rata), role (primary, standby), failover (automatic, manual); event-store.storage mmap (2nd sighting), snapshotCadence; realtime-gateway.transport (websocket, udp-multicast), feeds (a/b), sequenceNumbers (boolean); network-fabric.multicast, kernelBypass (booleans); api-gateway.protocol (fix, ouch, http); app-server.inProcess (boolean), noIoOnCriticalPath (boolean)
- New edge properties: sequenced (boolean); gapFill (boolean); inProcess (boolean)
- New requirement paths: latency.p99Us (microseconds); fairness.simultaneousDelivery (boolean); determinism.replayable (boolean; overlaps correctness.reproducible)
- New rules:
  - critical-path-crosses-process-boundary-under-microsecond-latency: latency.p99Us set and sync edges on the order path leave the process (network hop)
  - matching-engine-without-standby: matching-engine role primary with no standby node consuming the same sequenced stream
  - sequenced-stream-without-journal: sequencer or event-store with journaled false while determinism.replayable true
  - multicast-feed-without-gap-fill: realtime-gateway transport udp-multicast with no retransmission worker or sequenceNumbers false
  - unicast-fanout-under-fairness-requirement: fairness.simultaneousDelivery true and market data edges unicast
  - io-inside-deterministic-engine: matching-engine with sync edges to databases or third-party-api (must be output events)
  - stateful-engine-pinned-to-single-zone (2nd sighting, coinbase)

## Verification 2026-09-14

| URL | Reachable | Outcome |
|---|---|---|
| https://www.martinfowler.com/articles/lmax.html | yes | Confirms the single-threaded in-memory Business Logic Processor, "6 million orders per second on a single thread", the input disruptor stages (unmarshal, journal, replicate), output disruptors, journaling to disk rather than a database, replication to follower nodes over IP multicast, nightly snapshots, "full restart takes less than a minute", no external I/O inside the business logic, input ring buffer of 20 million slots and output ring buffers of 4 million slots. |
| https://www.janestreet.com/tech-talks/building-an-exchange/ | yes | Confirms the single matching engine on one machine, deterministic state-machine replication, client ports, UDP multicast, retransmitters, a passive secondary, "about 3 million messages per second, at peak rates", "latencies in the single-digit microseconds", and rebuilding state "inside of 30 seconds, or a minute". Also notes newer exchanges use eight threads with symbol-level parallelism; not encoded. |
| https://signalsandthreads.com/multicast-and-the-markets/ | yes | Confirms multicast fairness (unicast to 600 receivers leaves the last "600 microseconds, at a minimum, behind"; multicast "close to a microsecond"), per-message sequence numbers, retransmission servers for gap fill, and Layer 1 crosspoint switches at "three to five nanoseconds" versus store-and-forward at "seven to 10 microseconds". A/B feeds are NOT discussed in this episode. |
| https://blog.bytebytego.com/p/design-a-stock-exchange | no (HTTP 404) | Still gone, as the card recorded on 2026-09-07. |
| https://github.com/wuyichen24/system-design-interview/blob/master/problems/finance/Stock_Exchange_System.md | yes (mirror of the chapter notes) | Confirms the chapter box list and flow: client gateway (authentication, validation, rate limiting, normalisation, FIXT), order manager (risk and wallet checks, routes to the sequencer), sequencer (sequence ids inbound on orders and outbound on execution pairs), matching engine (order book per symbol, price-time). Flow: clients -> client gateway -> order manager -> sequencer -> matching engine, executions back sequencer -> order manager -> client gateway -> brokers. States "The round-trip latency should be at the millisecond level". Does not cover the market data publisher, reporter or risk manager as separate boxes, nor event sourcing, mmap or hot-warm failover. |

### Facts in this card that could not be confirmed

- A/B market-data feeds, attributed above to Signals and Threads: that episode does not mention them. Kept only as the `lineArbitration` default of the `multicast-feed` component and marked assumed.
- "Tens of thousands of participants; symbols in the thousands": no reachable source states these. Dropped from the design.
- Market data L1/L2/L3 levels and the book's hot-warm switch mechanism: only source was the 404 page. Not encoded.
