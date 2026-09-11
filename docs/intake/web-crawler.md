# Intake: Web crawler (Xu vol 1 ch 9) with Mercator and Najork crawler architecture

## Source
- Primary: Alex Xu, System Design Interview vol 1, chapter 9 "Design a web crawler"; chapter notes via search summaries (noahtigner 403, torontostudygroup 404 in this pass); the chapter is itself derived from Mercator
- Primary: Mercator papers (Heydon and Najork, Compaq SRC 1999 and 2001) https://courses.cs.washington.edu/courses/cse454/15wi/papers/mercator.pdf, summarised via https://blog.crawlex.net/blog/url-frontier-design/
- Primary: Marc Najork, "Web Crawler Architecture", Encyclopedia of Database Systems 2009 https://marc.najork.org/papers/eds2009a.pdf (PDF partly parsed)
- Verified by: canonical textbook chapter + two peer-reviewed crawler sources
- Confidence: high
- Date of source: 1999-2009 (Mercator, Najork), 2020 (book)

## System in three lines
Discovers and downloads web pages continuously from seed URLs: a URL frontier orders work by priority and enforces politeness per host, fetchers resolve DNS (cached), download HTML, parse it, drop duplicates by content fingerprint, store pages, extract links, filter and dedupe URLs with a bloom filter or hash table, and feed them back. Distribution hashes hosts to crawler machines so each host is owned by one node. Hard because the crawl must be polite to servers, resistant to spider traps and spam, fresh where pages change, and fault tolerant over a run that lasts days at hundreds of pages per second.

## Scale (only if stated)
- Users / DAU: not applicable
- Requests per second: book 1B pages/month gives ~400 QPS average, ~800 peak
- Data volume: book 500 KB average page, 500 TB/month, 30 PB over five years; Mercator second paper: 891M pages in 17 days on 4 machines; Najork: "several million documents per week" class systems
- Message throughput: frontier throughput bounded by politeness gaps; "roughly three times as many back queues as crawler threads"
- Politeness: adaptive gap "an order of magnitude larger than the time the last fetch from that host took"

## Requirements stated or clearly implied
- Availability target: crawl survives node failure via consistent hashing of hosts to nodes (book); state (frontier, seen sets) persisted to disk
- Consistency: exactly-once fetch of a URL per crawl is best-effort (bloom filter false positives skip a few URLs)
- Latency target: none per page; throughput target
- Ordering needs: priority by PageRank, traffic, change rate; FIFO within host queue
- Replay or reprocessing: recrawl by change frequency; frontier persisted
- Retention: content stored years; most in disk, popular in memory (book)
- Compliance / residency: robots.txt obeyed; politeness per host; avoid spider traps and spam
- Extensibility: pluggable modules (PNG downloader, monitoring) per Mercator

## Boundaries
- Regions / zones: crawl servers placed geographically near target hosts (book)
- Trust zones: crawler -> public internet (untrusted content); internal pipeline
- Named subsystems: Frontier (front priority queues, back politeness queues, host table, host-time heap), Fetch (DNS cache, downloader with robots.txt cache), Process (parser, content seen, URL extractor, URL filter, URL seen), Storage (content store, URL store)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Seed URLs | Starting set | config | property | |
| 2 | URL frontier | Front queues by priority (1..F), back queues one per host, host-to-queue table, host-time heap | Mercator design | queue | tiers: priority, politeness; queuesPerHost: 1 |
| 3 | Prioritizer | Assigns priority from usefulness or change rate | in-house | app-server (policy) | |
| 4 | Queue selector / host-time heap | Picks host whose next-allowed time has passed | in-house | property of queue | politenessGap: adaptive |
| 5 | DNS resolver + cache | Avoids 10s-200 ms DNS latency per fetch | in-house cache | dns + cache | |
| 6 | HTML downloader (fetcher) | Downloads pages; respects robots.txt (cached); timeouts | in-house threads | worker | threads: many; timeout: true |
| 7 | robots.txt cache | Per-host rules refreshed periodically | cache | cache | |
| 8 | Content parser | Validates and parses HTML; drops malformed | in-house | worker | |
| 9 | Content seen? | Fingerprint/checksum comparison to skip duplicate pages | hash set | cache / nosql-database | dedupBy: fingerprint |
| 10 | Content storage | Disk for most, memory for popular | object-store + cache | object-store | |
| 11 | URL extractor | Links from HTML, relative to absolute | in-house | worker | |
| 12 | URL filter | Blocklists, file types, error URLs, spider-trap heuristics (URL length, depth) | in-house | app-server (policy) | |
| 13 | URL seen? | Bloom filter or hash table of visited URLs | bloom filter | cache | structure: bloom-filter |
| 14 | URL storage | Persisted visited URLs | KV/DB | nosql-database | |
| 15 | Distribution | Hash hostname to crawler node; no central URL server | consistent hashing | coordination-service (partitioning) | partitionBy: host |
| 16 | Monitoring | Crawl rate, errors, per-host stats (Mercator pluggable) | in-house | monitoring | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| seeds | frontier | insert | sync | | |
| frontier (front queues) | back queues | selector | sync | | by priority |
| back queue | fetcher | dequeue | sync | | one host per queue |
| fetcher | dns cache -> dns | udp | sync | | cached |
| fetcher | robots cache | read | sync | | |
| fetcher | target host | http | sync | | adaptive gap per host |
| fetcher | parser | in-process | sync | | |
| parser | content seen? | hash lookup | sync | | |
| parser | content storage | write | async | | |
| parser | url extractor | in-process | sync | | |
| url extractor | url filter | in-process | sync | | |
| url filter | url seen? | bloom lookup | sync | | false positives skip |
| url seen? | url storage | write | async | | |
| url storage | frontier | insert | async | | closes loop |
| crawler node | crawler node | hash-routed url transfer | async | | host ownership |
| all | monitoring | metrics | async | | |

## Failure modes, incidents, tradeoffs the source discusses
- Politeness vs throughput: one connection per host at a time; adaptive gap; need ~3x back queues per thread or threads stall. Source: Mercator via crawlex.
- Hostname keying misfires on CDNs and shared hosting; production keys on registered domain or IP. Source: crawlex.
- Spider traps: infinite URL spaces defeated by URL length and depth limits, manual blocklists. Source: book.
- Duplicate content: ~30% of pages duplicates; checksum comparison saves storage and fetch. Source: book.
- Bloom filter false positives drop some URLs; accepted for memory. Source: book.
- DNS latency per fetch (10 ms to 200 ms) requires cache and periodic refresh. Source: book.
- Freshness: recrawl by change history and priority. Source: book, Najork.
- Redirects, JavaScript rendering, and data noise need server-side rendering and anti-spam. Source: book.
- Central URL server is a bottleneck; partition URL space by host. Source: Mercator distributed paper via search summary.

## Unknowns
- Storage products in the book (abstract)
- Exact fingerprint algorithm (shingling vs simhash)
- Fault recovery of in-flight fetches

## Candidates
- New kinds: none; sightings: queue (15th, two-tier frontier), worker (21st), dns (5th), cache (22nd: bloom and robots), object-store (20th), coordination-service (16th: host partitioning), monitoring (17th)
- New properties on existing kinds: queue.tiers (priority, politeness), perHost (boolean), selector (host-time-heap); worker.politenessGap (fixed, adaptive), obeysRobots (boolean); cache.structure (bloom-filter, hash-set); nosql-database.dedupBy (fingerprint)
- New edge properties: perHostSerialised (boolean); depthLimit, lengthLimit
- New requirement paths: crawl.politeness (boolean); crawl.freshnessDays; crawl.dedupContent (boolean)
- New rules:
  - crawler-without-per-host-politeness: worker fetching external hosts with no per-host queue or gap while crawl.politeness true
  - frontier-without-trap-guards: url filter lacking depthLimit or lengthLimit (spider traps)
  - fetch-without-dns-cache: fetcher edges to dns with no cache while rps high
  - content-store-without-dedup: object-store writes from parser with no content-seen stage while crawl.dedupContent true
  - central-url-server: single frontier node feeding many fetchers with no partitioning (bottleneck)
