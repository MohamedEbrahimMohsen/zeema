# Intake: Unique ID generator (Xu vol 1 ch 7) with Twitter Snowflake production design

## Source
- Primary: Alex Xu, System Design Interview vol 1, chapter 7 "Design a unique ID generator in distributed systems"; chapter notes via https://noahtigner.com/articles/system-design-interview-volume-1-chapter-7/ and search summaries (trunin.com 503 in this pass)
- Primary: Twitter Snowflake README (2010 branch) https://github.com/twitter-archive/snowflake/tree/snowflake-2010 (official open-source project)
- Cross-references: instagram-feed (per-shard Postgres id function: 41-bit time, 13-bit shard, 10-bit sequence), discord-messages (Snowflake ids as clustering keys), url-shortener (batched counter), chat-system (time-sortable message ids)
- Verified by: canonical textbook chapter + official Twitter project documentation
- Confidence: high
- Date of source: 2010, 2020

## System in three lines
Produces unique 64-bit numeric ids that sort roughly by creation time at tens of thousands per second per node without coordination. The winning design is Snowflake: a millisecond timestamp with a custom epoch, a machine or datacenter-plus-machine id, and a per-millisecond sequence, generated locally by each worker so nothing central is on the hot path. Hard because clocks drift and can roll back, machine ids must be unique, and the alternatives (multi-master auto-increment, UUIDs, ticket servers) each break one requirement: ordering, size or availability.

## Scale (only if stated)
- Users / DAU: not stated
- Requests per second: book requirement 10,000 ids/sec; Snowflake "minimum 10k ids per second per process" with 2 ms response; sequence allows 4,096 ids per ms per machine (~4M/sec per machine ceiling)
- Data volume: 41-bit time gives 69 years from custom epoch
- Message throughput: none
- Fleet: 10-bit machine id supports up to 1,024 generators (book splits 5 datacenter + 5 machine bits)

## Requirements stated or clearly implied
- Availability target: uncoordinated generation, "machines generating ids should not have to coordinate with each other"; no single point of failure
- Consistency: uniqueness guaranteed by (time, machine, sequence); ordering is k-sorted, "we're promising 1s, but shooting for 10's of ms"
- Latency target: 2 ms per id request (Snowflake); in-process for the book design
- Ordering needs: sortable by time without loading objects
- Replay or reprocessing: none
- Retention: none
- Compliance / residency: none
- Clock safety: refuse to generate on clock rollback; NTP for synchronisation

## Boundaries
- Regions / zones: datacenter id bits in the book layout; Snowflake machines across data centers
- Trust zones: internal service only
- Named subsystems: Generator workers (in-process library or Thrift service), Worker-id assignment (configuration or Zookeeper), Clock sync (NTP)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Snowflake generator | Composes timestamp, machine id, sequence; local, no coordination | Twitter Snowflake (Scala, Thrift) | id-generator | layout: 1-41-10-12; strategy: snowflake |
| 2 | Worker-id assignment | Unique machine/datacenter ids at startup | config or Zookeeper (book mentions) | coordination-service | |
| 3 | Clock source | NTP-synchronised system clock; rollback detection | NTP | property of id-generator | clockRollbackGuard: true |
| 4 | Multi-master auto-increment (rejected) | Each DB increments by k; hard to scale and reorder | MySQL | sql-database | reason: not time-sortable across servers |
| 5 | UUID (rejected) | 128-bit, non-numeric, not sortable | UUID v4 | property | |
| 6 | Ticket server (rejected) | Central auto-increment table; single point of failure | Flickr-style ticket server | id-generator (central) | spof: true |
| 7 | Client services | Call generator per created entity | any | app-server | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client service | snowflake generator | in-process or thrift | sync | | 2 ms |
| generator | worker-id assignment | config / zk | sync at startup | | |
| generator | system clock | local | sync | | refuse on rollback |
| clock | ntp | udp | async | | drift bound |
| client service | ticket server (rejected) | sql | sync | | central |
| db master | db master (rejected) | replication | async | | step k |

## Failure modes, incidents, tradeoffs the source discusses
- Clock rollback: generator "will refuse to generate ids until a time that is after the last time we generated an id". Source: Snowflake README.
- Ordering is approximate: k-sorted within about a second. Source: Snowflake README.
- Ticket server is a single point of failure; adding servers reintroduces sync problems. Source: book notes.
- Multi-master auto-increment does not scale across data centers and breaks time ordering. Source: book notes.
- UUIDs are 128-bit, non-numeric and unordered, hurting index locality. Source: book notes.
- Section length tuning: trade timestamp lifetime, machine count and per-ms throughput. Source: book notes.
- Cassandra migration forced the need: no auto-increment in the new store. Source: Snowflake README.
- Instagram avoided a separate service by generating inside each shard (see instagram-feed).

## Unknowns
- Book's high-availability details for worker-id assignment
- Snowflake Zookeeper usage (not in the 2010 README)
- Behaviour when sequence overflows within a millisecond (spin to next ms, implied)

## Candidates
- New kinds: none; sightings: id-generator (5th), coordination-service (15th: worker id assignment)
- New properties on existing kinds: id-generator.layout (string), epoch (date), clockRollbackGuard (boolean), kSortedBoundMs (integer), central (boolean), strategy snowflake (3rd sighting of strategy)
- New edge properties: none new
- New requirement paths: ids.timeSortable (boolean); ids.numeric64 (boolean)
- New rules:
  - central-id-generator-single-point: id-generator central true with one node and no failover
  - snowflake-without-clock-guard: id-generator strategy snowflake and clockRollbackGuard false
  - time-sortable-ids-required-but-uuid: ids.timeSortable true while id-generator strategy uuid
  - machine-id-collision-risk: id-generator strategy snowflake with no worker-id assignment edge (config or coordinator)
