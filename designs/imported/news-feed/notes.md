# News feed system: import notes

A social news feed. Clients reach web servers through DNS, a CDN and a load balancer with auth
and rate limiting. A post service stores posts, a fanout service pushes them through a queue and
workers into feed caches, and a news feed service reads those caches back.

- Source: chapter 11, "Design a News Feed System", pages 166-177 of *System Design Interview -
  An Insider's Guide* (Alex Xu). The book is copyrighted, so `source/news-feed.md` holds the
  citation and a factual transcription of the figures (boxes, boundaries, arrows), not the
  pages themselves.
- Figures: **11-4** (detailed design for feed publishing, page 171) and **11-7** (detailed
  design for news feed retrieval, page 174). The chapter designs one system in two flows and
  calls these two the detailed design of each flow, so the import is their union with every
  distinct box counted once.
- Format: `book-figure`. Counts: 20 boxes, 3 boundaries, 21 distinct arrows in the source;
  the design has 20 nodes, 3 groups and 26 edges (see "Assumptions" for the five boundary
  arrows that became two edges each). `validate.mjs --design` and `check_fidelity.py` pass.

## Mapping

| Source text | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Web browser | web-browser | web-browser | client | close |
| Mobile app | mobile-app | mobile-app | client | close |
| DNS | dns | dns-resolver | dns | close |
| CDN | cdn | content-delivery-network | cdn | close |
| Load balancer | load-balancer | load-balancer-tier | load-balancer | close |
| Web servers | web-servers | container-service | app-server | close |
| Authentication | authentication | container-service | app-server | close |
| Rate Limiting | rate-limiting | in-process-limiter | rate-limiter | close |
| Post Service | post-service | container-service | app-server | close |
| Post Cache | post-cache | cache-cluster | cache | close |
| Post DB | post-db | relational-database | sql-database | close |
| Notification Service | notification-service | container-service | app-server | close |
| Fanout Service | fanout-service | container-service | app-server | close |
| Graph DB | graph-db | graph-store | graph-database | assumed |
| Message Queue | message-queue | message-queue | queue | close |
| User Cache | user-cache | cache-cluster | cache | close |
| User DB | user-db | relational-database | sql-database | close |
| Fanout Workers | fanout-workers | container-worker | worker | close |
| News Feed Cache | news-feed-cache | cache-cluster | cache | close |
| News Feed Service | news-feed-service | container-service | app-server | close |

Groups: `user` (`trust-zone`, label "User") holds Web browser and Mobile app; `web-tier`
(`system`, the unlabelled dashed box) holds Web servers, Authentication and Rate Limiting;
`fanout-worker-tier` (`system`, the unlabelled dashed box) holds Fanout Workers.

## Assumptions

- Every box in both figures is unbranded, so the generic `default` components are used and
  marked `close`. No product is substituted for a box the book does not name.
- **Graph DB** is the one `assumed` mapping: the catalogue has no engine-less graph store, so
  `graph-store` was chosen. The chapter's own reference [2] is a Neo4j article, which is why Neo4j
  rather than another graph engine.
- **Rate Limiting** is drawn as a box inside the web tier, so limiting happens in the web
  server process: `in-process-limiter`, the same reading as the notification-system import.
- **The five arrows drawn at the "User" boundary** (to DNS, to CDN, the publish request and
  the retrieval request to the Load balancer, and the response from the Web servers) have no
  single node to attach to. Each is modelled once per client inside the group, so the two
  clients keep the same relationships the picture gives them; 21 drawn arrows become 26 edges.
  `mapping.yaml` marks every expanded edge and `source.counts.edges` is 26 for that reason.
- Arrows entering or leaving the dashed web tier are attributed to the **Web servers** node
  (a group cannot be an edge endpoint), the same treatment the notification-system import gave
  its server tier.
- **User -> Load balancer is two edges**, not one: Figure 11-4 draws the publish request
  (`v1/me/feed?content=Hello&auth_token={auth_token}`) and Figure 11-7 the retrieval request
  (`/v1/me/feed`) between the same pair, with different labels. Arrows that both figures draw
  identically and unlabelled (User -> DNS, Load balancer -> Web servers, User Cache -> User DB,
  Post Cache -> Post DB) are one edge each.
- Only the queue arrows are `async` (`at-least-once`, the `message-queue` default). Everything
  else is a request the caller waits for, including the Notification Service call, which the
  figure draws as a plain arrow.
- Protocols are the callee's native protocol where the source names none: `dns`, `cache`,
  `sql`, `queue`, `bolt` for Neo4j, `http`/`https` for the request path.
- No `props`: neither figure states a partition count, TTL, replica count or SKU.
- No `requirements` block. The chapter states 10 million DAU, up to 5000 friends per user and
  reverse-chronological ordering, but no SLA, latency target, region count, durability figure
  or replay promise, and there is no back-of-the-envelope estimation section in this chapter.

## Observations (not encoded, the figures do not show them)

- The hybrid fanout (push for most users, pull for celebrities) and the consistent-hashing
  mitigation of the hotkey problem are prose in the deep dive; no box or arrow carries them.
- Figure 11-8 divides the cache tier into five layers (News Feed, Content, Social Graph,
  Action, Counters). The architecture figures draw only three cache boxes, so the layering is
  not encoded.
- The message queue has no dead-letter queue and the databases no backup in the figures; the
  rules below say so, and the design is left as drawn.
- Nothing in either figure connects Authentication and Rate Limiting to anything: they are
  boxes inside the web tier with no arrows, and they stay that way here.

## Gaps

Recorded in `mapping.yaml` under `gaps` (not added to `docs/schema-gaps.md`, which the parent
session owns):

- A boundary cannot be an edge endpoint, so arrows drawn at the "User" box and at the dashed
  web tier had to be re-attached to nodes.
- No engine-less generic graph store exists, so an unbranded Graph DB box forces a named
  product.
- The union of two flows is one flat design; nothing marks a node or an edge as belonging to
  the write path or the read path except the edge labels.
- Figure 11-8's five cache layers cannot be attached to the cache nodes.

## Rules fired

| Rule | Severity | Subject |
|---|---|---|
| datastore-missing-backup | error | post-db, user-db |
| queue-missing-dlq | error | message-queue |
| cache-missing-eviction-policy | warning | post-cache, user-cache, news-feed-cache |
| credentials-without-rotation | warning | design |

All seven findings are the product working on a textbook figure that states none of those
things; the design was not changed to silence them.

Components added: none. Kinds added: none.

## Consolidation pass, 2026-09-08

The parent session re-mapped this design after the import wave, when generic components were
added to the catalogue for boxes that name no product. Mappings that had to guess a vendor
(and any single-box dashed border that had been read as a boundary) were corrected; the
picture itself is unchanged. `mapping.yaml` holds the current component for every box.
