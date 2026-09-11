# twitter-timeline: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/twitter-timeline.md`
- Size: 15 nodes, 18 edges, 3 groups.

## Clean variant (header of design.yaml)

Reference architecture 3, clean variant: home timeline with hybrid fan-out driven by
change data capture, a rebuildable Redis timeline cache and an asynchronously fed search index.

Fixes relative to twitter-timeline.broken.yaml:
  - write-api only persists the tweet; tweet-cdc reads the MySQL binlog into tweet-events (Kafka)
  - fanout-daemon consumes tweet-events, uses a hybrid strategy with a 10000-follower threshold,
    and is the worker that writes home-timeline-cache (a rebuild path)
  - timeline-service reads social-graph to merge celebrity tweets at read time and reconstructs
    cold timelines from tweet-store, so the cache is not the primary store
  - ingester consumes tweet-events and indexes search-index asynchronously
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture 3, broken variant: home timeline with push fan-out done inline on
the write path, a Redis timeline cache that is the only copy of every timeline, and a
search index written by dual writes from the write API.

This file MUST trip:
  - fanout-inline-in-request-path            (write-api calls fanout-daemon synchronously)
  - push-fanout-without-celebrity-path       (fanout-daemon pushes with no fanoutThreshold; social-graph is a graph-database)
  - derived-store-without-cdc-or-rebuild     (search-index only has sync in-edges from write-api and search-service)
  - business-updates-without-index-propagation (tweet-store is written sync by write-api, a search-index exists, no CDC leaves it)
  - cache-as-primary-store-without-persistence (home-timeline-cache: usedAsPrimaryStore true, persistence false)
  - materialised-cache-without-rebuild-path  (home-timeline-cache is materialised; only app-servers write into it)
and MUST NOT trip:
  - read-heavy-path-without-cache            (design contains caches; that rule is design-wide)
  - cache-missing-eviction-policy            (both caches declare lru)
  - datastore-missing-backup, datastore-single-region (tweet-store is backed up; multiRegion false)
  - queue-missing-dlq, pubsub-replay-required (no queue or topic in this design)
  - sync-chain-too-deep                      (longest sync chain from tfe is 3 hops: write-api -> fanout-daemon -> social-graph)
  - object-store-single-zone-with-durability-target, multi-leader-store-without-conflict-policy,
    stateful-engine-pinned-to-single-zone, shared-dependency-without-redundancy (no such nodes)
