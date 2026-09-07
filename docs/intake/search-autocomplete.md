# Intake: Search autocomplete / typeahead (Xu vol 1 ch 13) with Facebook typeahead production design

## Source
- Primary: Alex Xu, System Design Interview vol 1, chapter 13 "Design a search autocomplete system"; public chapter notes https://torontostudygroup.github.io/study-notes/notes/system-design-interview/ch13/ and https://noahtigner.com/articles/system-design-interview-volume-1-chapter-13/
- Primary: https://engineering.fb.com/2010/05/17/web/the-life-of-a-typeahead-query/ (official Meta, 2010: browser cache, aggregator, leaf services)
- Related: Unicorn paper (Meta, VLDB 2013) https://www.vldb.org/pvldb/vol6/p1150-curtiss.pdf (not fetched; typeahead backend on inverted index)
- Verified by: canonical textbook chapter + official Meta engineering post
- Confidence: high
- Date of source: 2010, 2020

## System in three lines
Returns the top few suggestions for a prefix within about 100 ms on every keystroke. Textbook shape: an offline pipeline aggregates query logs weekly into a frequency table and builds a trie where every node caches its top-k completions, served from a distributed in-memory trie cache sharded by prefix with a persistent trie DB behind it. Facebook's version is a browser-side cache of the user's own connections plus a stateless aggregator fanning out to leaf index services (global and social graph) and merging ranked ids, then hydrating from memcache and MySQL with privacy checks. Hard because reads are enormous and latency-bound, freshness fights update cost, and prefix distribution is skewed.

## Scale (only if stated)
- Users / DAU: 10M DAU (book)
- Requests per second: ~24,000 average, 48,000 peak (book: 24B queries/day derivation); Facebook not stated
- Data volume: 0.4 GB/day of new queries (20% new), trie "a few to tens of gigabytes" RAM-resident
- Message throughput: log sampling 1 in N requests
- Latency: 100 ms budget in both sources; "late answers are wrong answers" (Meta)

## Requirements stated or clearly implied
- Availability target: read path must not stall typing; cache miss replenishes
- Consistency: weekly snapshot freshness acceptable (book); Facebook personal results always from browser cache
- Latency target: under 100 ms end to end
- Ordering needs: top-k by frequency (book) or social relevance (Meta)
- Replay or reprocessing: weekly trie rebuild from logs; snapshots
- Retention: analytics logs append-only; retention not stated
- Compliance / residency: filtering layer removes offensive/unsafe suggestions; privacy checks on hydrated results (Meta)
- Freshness vs cost: "Updating the trie on every query significantly slows down the query service"

## Boundaries
- Regions / zones: not stated
- Trust zones: browser (with local cache) -> load balancer -> API/aggregator -> leaf/cache services -> storage
- Named subsystems: Query service (LB, API servers, trie cache, browser cache), Data gathering (analytics logs, aggregators, workers, trie DB), Sharding (shard map manager), Filtering; Meta: browser cache, AJAX endpoint, aggregator, leaf services (global, graph), memcache/MySQL hydration, privacy

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Browser / app | Sends prefix per keystroke; caches suggestions (book) or first-degree connections on focus (Meta) | web, mobile | web-client, mobile-client | localCache: true |
| 2 | Load balancer | Routes API traffic | generic | load-balancer | |
| 3 | API servers / AJAX endpoint | Query entry; thin wrapper over aggregator (Meta) | PHP endpoint (Meta) | api-gateway | |
| 4 | Aggregator | Stateless; fans out to leaf services in parallel, merges and ranks ids | Thrift service (Meta) | app-server (scatter-gather) | pattern: scatter-gather |
| 5 | Trie cache | Distributed in-memory trie with top-k per node; weekly snapshot | in-house (book) | search-index (in-memory) | inMemory: true; topKPerNode: true |
| 6 | Trie DB | Persistent prefix to top-k mapping (KV or document store) | KV store | nosql-database | |
| 7 | Shard map manager | Maps prefix ranges to shards; rebalances skewed letters | in-house | coordination-service | shardingStrategy: prefix-range |
| 8 | Analytics logs | Append-only raw queries (sampled) | log store | stream / object-store | sampling: 1-in-N |
| 9 | Aggregators (offline) | Weekly frequency tables | batch jobs | etl-job | cadence: weekly |
| 10 | Trie build workers | Build trie from frequency table, write DB, refresh cache | in-house | worker + scheduled-job | cadence: weekly |
| 11 | Filtering layer | Removes unsafe suggestions | in-house | app-server (policy) | |
| 12 | Leaf index services (Meta) | Global index of pages/apps; graph service over user's connections; vertical services | Unicorn-class inverted index | search-index | shards: many |
| 13 | Hydration store (Meta) | Full objects by id with privacy checks | memcache + MySQL | cache + sql-database | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| browser | local cache | in-memory | sync | | hit avoids round trip |
| browser | lb -> api | https | sync | | per keystroke, debounced |
| api | trie cache (book) | rpc | sync | | O(1) top-k |
| trie cache | trie db | read | sync | | miss replenish |
| api | shard map manager | rpc | sync | | which shard |
| analytics logs | offline aggregators | batch | async | | weekly |
| aggregators | trie build workers | batch | async | | |
| workers | trie db / trie cache | write | async | | snapshot swap |
| api | filtering | in-process | sync | | |
| ajax endpoint (meta) | aggregator | thrift | sync | | |
| aggregator | leaf services (parallel) | thrift | sync | | scatter-gather |
| web tier | memcache / mysql | read | sync | | hydrate ids, privacy |
| query logs (meta) | index build | batch | async | | not detailed |

## Failure modes, incidents, tradeoffs the source discusses
- Update cost vs freshness: per-query trie updates slow serving; weekly rebuild chosen. Source: book notes.
- Storage for latency: cache top-k at every node so lookup is O(1) at the cost of memory. Source: book notes.
- Skewed prefixes: "s" alone matches "u-z" combined; shard map manager rebalances ranges. Source: book notes.
- Sampling logs to cut write load (1 in N). Source: book notes.
- Late is wrong: "late answers are wrong answers"; the design navigates "a trilemma among performance, recall, and relevance". Source: Meta.
- Personal data first: first-degree connections cached in the browser on focus so most results never hit the server. Source: Meta.
- Privacy on hydration, not in index: results validated for viewer after ranking. Source: Meta.

## Unknowns
- Trie DB product and snapshot mechanics (book abstract)
- Meta leaf service sharding and replication (Unicorn paper)
- Personalisation model placement in the book design

## Candidates
- New kinds: none; sightings: search-index (9th, in-memory trie variant), coordination-service (13th: shard map manager), etl-job (13th), scheduled-job (11th), worker (19th), cache (21st)
- New properties on existing kinds: search-index.structure (inverted, trie), topKPerNode (boolean), rebuildCadence (weekly), shardingStrategy prefix-range; web-client.localCache (boolean); app-server.pattern scatter-gather (3rd sighting)
- New edge properties: debounced (boolean); sampled (1-in-N)
- New requirement paths: latency.keystrokeMs (integer); freshness.suggestionsDays; safety.suggestionFiltering (boolean)
- New rules:
  - keystroke-path-without-local-or-edge-cache: web-client to search-index with latency.keystrokeMs set and no localCache or cache in path
  - trie-updated-inline-on-query: search-index rebuildCadence realtime with write edge from query path (serving slowdown)
  - prefix-shards-without-rebalancer: search-index shardingStrategy prefix-range with no coordination-service managing ranges (skew)
  - suggestions-without-safety-filter: search-index suggestions served to clients with safety.suggestionFiltering true and no filtering stage
  - scatter-gather-without-timeout (3rd sighting) for aggregator to leaf edges
