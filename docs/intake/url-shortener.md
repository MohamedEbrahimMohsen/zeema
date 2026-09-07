# Intake: URL shortener (canonical design, Alex Xu vol 1 ch 8 with Bitly-style breakdown)

## Source
- Primary: Alex Xu, System Design Interview vol 1, chapter 8 "Design a URL shortener" (book; public chapter summaries via https://trunin.com/en/2023/02/system-design-interview-08-design-a-url-shortener/ (503 in this pass) and search summaries)
- Primary: https://www.hellointerview.com/learn/system-design/problem-breakdowns/bitly (detailed public breakdown with numbers, tradeoffs)
- Verified by: canonical textbook chapter + widely used public breakdown. This is a reference design, not a company system; numbers are design assumptions, not measurements.
- Confidence: high as a canonical design; no production claims
- Date of source: 2020 (book), 2024 (breakdown)

## System in three lines
Turns long URLs into 7-character base62 codes and redirects readers back at very high read volume. Writes are rare and go through a unique-id generator (counter with batching, or a hash with collision checks); reads hit a cache, then a keyed datastore, and are answered with a 301 or 302 redirect. Hard only in proportion: reads outnumber writes by 100-1000x, so the design is about cache, redirect semantics, id uniqueness and abuse control rather than compute.

## Scale (only if stated)
- Users / DAU: 100M DAU (breakdown assumption)
- Requests per second: ~1 write/sec (100M new URLs/day in the book yields ~1,160 writes/sec; breakdown uses 100k/day); reads 10-1000x writes; peak ~600k redirects/sec (breakdown)
- Data volume: 1B URLs at ~500 bytes = 500 GB (breakdown); book: 365B records over 10 years at 100 bytes = 36.5 TB
- Message throughput: none
- Key space: 62^7 = 3.5 trillion codes

## Requirements stated or clearly implied
- Availability target: redirect path must be highly available; writes can degrade
- Consistency: short code must be globally unique; mapping immutable once created; cache may be slightly stale for updates/deletes
- Latency target: redirect at cache speed (microseconds in memory vs milliseconds on disk)
- Ordering needs: none
- Replay or reprocessing: none; counter gaps acceptable
- Retention: optional expiry per link; long retention (10 years in the book)
- Compliance / residency: abuse and phishing controls (rate limiting, blocklists)
- Redirect semantics: 301 lets browsers cache and cuts server load but loses analytics; 302 keeps every hit on the server for analytics

## Boundaries
- Regions / zones: multi-region via counter range allocation per region (breakdown)
- Trust zones: public clients -> load balancer / CDN -> API servers -> cache, DB; id generator internal
- Named subsystems: Write service (shorten), Read service (redirect), ID generation, Cache, Storage, Rate limiter, Analytics

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Clients | Browsers, apps calling POST /urls and GET /{code} | web, mobile | web-client, mobile-client | |
| 2 | CDN / edge cache | Caches hot redirects geographically | generic CDN | cdn | |
| 3 | Load balancer | Spreads traffic across web servers | generic | load-balancer | |
| 4 | Rate limiter | Throttles abusive creators and readers | generic | rate-limiter | |
| 5 | Write service | Validates URL, obtains id, encodes base62, stores mapping | in-house | app-server | stateless: true |
| 6 | Read service | Looks up code in cache then DB, returns 301/302 | in-house | app-server | stateless: true |
| 7 | Unique id generator | Counter (Redis INCR with batching, ticket server) or Snowflake-class; base62 encode | Redis, ticket server | id-generator | strategy: counter-batched; batchSize: 1000 |
| 8 | Cache | LRU cache of code to long URL | Redis, memcached | cache | evictionPolicy: lru |
| 9 | Datastore | code (PK) to long URL, created, expiry; read-heavy, keyed lookups | relational or KV (book leaves open) | sql-database or nosql-database | indexOn: shortCode |
| 10 | Analytics pipeline | Click events for 302 flows | queue + warehouse | stream + data-warehouse | |
| 11 | Hash fallback | Hash(long URL) prefix with collision check and lengthening | CRC32/MD5 style | property of id-generator | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | cdn / lb | https | sync | | |
| lb | rate limiter | in-path | sync | | |
| lb | write service | http | sync | | POST /urls |
| write service | id generator | rpc | sync | | batched ranges |
| write service | datastore | sql/kv | sync | | insert mapping |
| write service | cache | redis | async | | warm optional |
| lb | read service | http | sync | | GET /{code} |
| read service | cache | redis | sync | | hit path |
| read service | datastore | sql/kv | sync | | miss path, then fill cache |
| read service | client | http 301/302 | sync | | redirect |
| read service | analytics | async event | async | at-most-once | only with 302 |
| id generator region A | id generator region B | none (disjoint ranges) | n/a | | range partition |

## Failure modes, incidents, tradeoffs the source discusses
- 301 vs 302: 301 "reduces server load" through browser caching but breaks click analytics; 302 keeps analytics at the cost of an extra hop per read. Source: book via summary, breakdown.
- Hash prefix collisions: shortening a hash and lengthening on collision "could lead to multiple database calls"; counter plus base62 avoids collision checks. Source: book via summary.
- Counter as coordination point: Redis counter is a "single point of coordination"; batching cuts calls but leaves "gap on instance failure", acceptable because uniqueness is enforced at the DB. Source: breakdown.
- Memory vs disk: "Memory access is about 1,000 times faster than SSD", so cache is the design. Source: breakdown.
- Predictable ids leak volume and invite enumeration; the book notes sequential counters are guessable (mitigation not fully specified). Source: book via summary.
- Abuse: shortened links used for phishing; rate limiting and blocklists needed. Source: breakdown.
- Read/write split lets each side scale independently. Source: breakdown.

## Unknowns
- Storage product choice (book leaves relational vs NoSQL open)
- Cache invalidation on link expiry
- Multi-region write coordination beyond range allocation

## Candidates
- New kinds: none; sightings: id-generator (3rd), rate-limiter (4th), cache (18th), cdn (10th), load-balancer (13th)
- New properties on existing kinds: id-generator.strategy (counter, counter-batched, hash, snowflake), batchSize, guessable (boolean); app-server.role (read, write) for read/write split; cache.hitRatioTarget
- New edge properties: redirectCode (301, 302); cacheable (2nd sighting)
- New requirement paths: analytics.perClick (boolean); traffic.readWriteRatio (2nd sighting); abuse.rateLimited (boolean)
- New rules:
  - permanent-redirect-with-click-analytics: edge redirectCode 301 while analytics.perClick true
  - single-counter-without-batching-or-failover: id-generator strategy counter with no batching and no replicated coordinator
  - hash-id-without-collision-check: id-generator strategy hash with no collision-check edge to datastore
  - read-heavy-path-without-cache: traffic.readWriteRatio above threshold and read service edge to datastore with no cache in path
  - guessable-ids-on-public-endpoint: id-generator guessable true on public read endpoint with no rate-limiter (informational)
