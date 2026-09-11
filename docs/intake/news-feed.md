# Intake: Generic news feed (Xu vol 1 ch 11), cross-referenced with Twitter, Instagram, Pinterest and Reddit cards

## Source
- Primary: Alex Xu, System Design Interview vol 1, chapter 11 "Design a news feed system"; public chapter summaries https://levendlee.com/2024/01/14/chapter-11-design-a-news-feed-system/ and https://noahtigner.com/articles/system-design-interview-volume-1-chapter-11/
- Cross-references (already carded, verified): twitter-timeline (hybrid fan-out, 800-entry Redis lists, celebrity read-merge), instagram-feed (Gearman fan-out workers, Redis then Cassandra feed store), pinterest-feed (SmartFeed workers into HBase via Zen), reddit-feed (precomputed listings, vote queues)
- Verified by: canonical textbook chapter; production evidence lives in the four linked cards
- Confidence: high as a canonical design
- Date of source: 2020 (book)

## System in three lines
Users publish posts and read a feed of posts from people they follow. The publishing path persists the post, then a fan-out service reads the social graph and pushes the post id into each follower's feed cache through a message queue and workers; the retrieval path reads post ids from the feed cache and hydrates them from post and user caches, with media on a CDN. Hard because of the push/pull decision: fan-out on write is fast to read but explodes for celebrities and wastes work on inactive users, fan-out on read is cheap to write but slow to read, so real systems go hybrid.

## Scale (only if stated)
- Users / DAU: 10M DAU (book assumption)
- Requests per second: not stated
- Data volume: up to 5,000 friends per user
- Message throughput: fan-out writes = followers per post
- Production anchors: Twitter 300K QPS reads, 6K writes, 800-entry timelines; Instagram 200 fan-out workers; see linked cards

## Requirements stated or clearly implied
- Availability target: feed read path must stay up; fan-out lag acceptable
- Consistency: eventual; posts appear seconds later; celebrities merged at read
- Latency target: feed load from cache; publish returns before fan-out completes
- Ordering needs: reverse chronological or ranked
- Replay or reprocessing: feed rebuild from post store on cache miss
- Retention: bounded feed cache (Twitter 800 ids); full history on disk
- Compliance / residency: not stated

## Boundaries
- Regions / zones: not stated in book; see instagram-feed for multi-region variant
- Trust zones: clients -> load balancer -> API servers -> services -> caches, DBs, queue
- Named subsystems: Publishing (post service, fanout service, notification), Retrieval (news feed service, caches, CDN), Social graph (graph DB), Async (message queue, fanout workers), Caching tiers

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Clients | Publish and read feed | web, mobile | web-client, mobile-client | |
| 2 | Load balancer | Front door | generic | load-balancer | |
| 3 | Web / API servers | Auth, rate limit, route to services | generic | api-gateway + app-server | |
| 4 | Post service | Persist post to DB and post cache | in-house | app-server | |
| 5 | Post DB | Posts | relational or KV | sql-database / nosql-database | |
| 6 | Post cache | Hot and normal content | Redis/memcached | cache | tiers: hot, normal |
| 7 | Fanout service | Read followers, filter (muted, blocked), enqueue feed inserts | in-house | app-server | fanoutStrategy: hybrid |
| 8 | Graph DB | Follower relationships | graph DB | graph-database | |
| 9 | User cache / user DB | Profiles for hydration and filtering | cache + DB | cache + sql-database | |
| 10 | Message queue | Buffers fan-out tasks | generic | queue | |
| 11 | Fanout workers | Insert post ids into followers' feed caches | in-house | worker | |
| 12 | News feed cache | Per-user list of post ids, bounded | Redis | cache (materialised) | listCap: bounded |
| 13 | News feed service | Fetch ids, hydrate, merge celebrity posts at read | in-house | app-server | |
| 14 | Notification service | Tell followers new content exists | in-house | notification-service | |
| 15 | CDN | Images and video | generic | cdn | |
| 16 | Action and counter caches | Likes, replies, counters | Redis | cache | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | lb -> api | https | sync | | POST /v1/me/feed |
| api | post service | rpc | sync | | |
| post service | post db / post cache | native | sync | | |
| api | fanout service | rpc | async | | |
| fanout service | graph db | query | sync | | followers |
| fanout service | user cache | read | sync | | filters |
| fanout service | message queue | enqueue | async | at-least-once | |
| message queue | fanout workers | dequeue | async | at-least-once | |
| fanout workers | news feed cache | redis | async | | id + timestamp per follower |
| fanout service | notification service | rpc | async | | |
| client | news feed service | https | sync | | GET /v1/me/feed |
| news feed service | news feed cache | redis | sync | | ids |
| news feed service | post cache / user cache | redis | sync | | hydrate |
| news feed service | celebrity posts | read | sync | | pull for high-follower accounts |
| client | cdn | https | sync | | media |

## Failure modes, incidents, tradeoffs the source discusses
- Push hot keys: fan-out on write "suffers from hotkey problems with high-follower users and wastes resources on inactive subscribers". Source: chapter summary.
- Pull slowness: fan-out on read "eliminates waste for inactive users" but "feed fetching becomes slower". Source: chapter summary.
- Hybrid: push for most, pull for celebrities; consistent hashing for worker distribution. Source: chapter summary; confirmed in twitter-timeline.
- Cache-heavy design needs invalidation strategy across five cache tiers. Source: chapter summary.
- Production incidents from linked cards: Twitter p99 fan-out minutes for large accounts; Instagram Redis memory cost forced Cassandra; Pinterest chose HBase for materialised feeds; Reddit precomputes listings and queues votes.

## Unknowns
- Ranking model placement (book leaves as extension)
- Feed cache eviction for inactive users (Twitter uses 30-day inactivity)
- Multi-region replication of feed caches

## Candidates
- New kinds: none; sightings: graph-database (6th), cache materialised (20th), queue (13th), worker (18th), notification-service (5th), cdn (11th)
- New properties on existing kinds: app-server.fanoutStrategy (push, pull, hybrid) (2nd sighting after twitter); cache.tier (hot, normal) already proposed; cache.listCap (2nd)
- New requirement paths: traffic.readWriteRatio (3rd sighting); social.maxFollowersPush (integer, celebrity threshold)
- New rules (reinforcing twitter-timeline candidates):
  - push-fanout-without-celebrity-path (2nd sighting)
  - materialised-cache-without-rebuild-path (2nd sighting)
  - fanout-inline-in-request-path: fanout edge sync from post API instead of via queue (publish latency tied to follower count)
  - feed-hydration-without-post-cache: news feed service reads post bodies from DB per id (N+1)
