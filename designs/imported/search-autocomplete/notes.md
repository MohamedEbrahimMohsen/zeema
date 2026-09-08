# Search autocomplete system: import notes

- Source: *System Design Interview – An Insider's Guide*, Alex Xu, chapter 13 "Design a search
  autocomplete system", pages 200-219. The book is copyrighted; `source/search-autocomplete.md`
  holds the citation and a factual transcription of the two figures (boxes, boundary, arrows),
  nothing else.
- Figures: **13-9** (the redesigned data gathering service, page 211) and **13-11** (the
  improved query service, page 214). The chapter's final architecture is these two halves of
  one system, so they are imported as one design.
- Format: `book-figure`. Counts: 10 boxes, 1 boundary, 10 arrows in the union; the design has
  10 nodes, 1 group, 10 edges. `check_fidelity.py` passes with 0 warnings.

## The union

Trie DB and Trie Cache are drawn in both figures. They are one node each: the workers write
the trie into Trie DB and the cache takes a weekly snapshot of it (13-9), and the query path
reads Trie Cache and falls back to Trie DB on a miss (13-11). Every other box appears in only
one of the two figures. Union: 6 boxes from 13-9 + 6 from 13-11 - 2 shared = 10.

## Mapping

| Source text | Figure | Node | Component | Kind | Confidence |
|---|---|---|---|---|---|
| Web browser | 13-11 | web-browser | web-browser | client | close |
| Mobile app | 13-11 | mobile-app | mobile-app | client | close |
| Load balancer | 13-11 | load-balancer | load-balancer-tier | load-balancer | close |
| API servers | 13-11 | api-servers | container-service | app-server | close |
| Trie Cache | 13-9, 13-11 | trie-cache | cache-cluster | cache | close |
| Trie DB | 13-9, 13-11 | trie-db | nosql-store | nosql-database | close |
| Analytics Logs | 13-9 | analytics-logs | observability-stack | monitoring | close |
| Aggregators | 13-9 | aggregators | container-worker | worker | close |
| Aggregated Data | 13-9 | aggregated-data | relational-database | sql-database | close |
| Workers | 13-9 | workers | container-worker | worker | close |

Group: `user` (`trust-zone`, label "User"), the solid box in 13-11 around Web browser and
Mobile app.

## Decisions and assumptions

- **Everything is generic.** The book draws unbranded boxes, so every node uses a `default`
  provider generic and is marked `close`. No node is `assumed`: each box says plainly what it
  is, and the chapter's prose confirms the role.
- **Trie DB stays generic.** The chapter's deep dive offers two products for the trie store, a
  document store (MongoDB is named in the prose and in reference [4]) or a key-value store. The
  figure labels the box "Trie DB" and draws plain cylinders, so the design uses `nosql-store`
  and leaves `model` at the `key-value` default rather than importing a product the picture
  does not show.
- **Analytics Logs -> observability-stack.** The chapter: raw search-query logs, append-only,
  not indexed. `signal: "logs"` is the only prop taken from that sentence.
- **Aggregators and Workers are both workers.** Aggregators roll the logs up at an interval
  (`trigger: "batch"`); Workers "perform asynchronous jobs at regular intervals" and build the
  trie (`trigger: "schedule"`, `schedule: "weekly"`, which is the arrow label "Update weekly").
- **Dashed outlines are icons, not boundaries.** The dashed rounded outlines around
  Aggregators, Workers and API servers wrap three server glyphs and carry the box's own label;
  they are this book's server-farm icon. Only "User", a solid box around two separately
  labelled client boxes, is a group.
- **The offline pipeline is async.** The five arrows of figure 13-9 are weekly batch flows, so
  `mode: async`; no `delivery` is set because no queue or broker is drawn. The five arrows of
  figure 13-11 are the live request path and are `sync`.
- **Protocols** come from the callee: `https`/`http` on the web path, `cache` into the Trie
  Cache, `nosql` into the Trie DB, `sql` into and out of the Aggregated Data table, `file` for
  reading the log files. The figure labels no protocol.
- **Requirements** are the numbers the chapter states:
  `latency.p95Ms: 100` (the chapter's 100 ms budget from the Facebook typeahead article),
  `traffic.peakMultiplier: 2` ("Peak QPS = QPS * 2"),
  `freshness.maxSeconds: 604800` (the trie is rebuilt weekly and the cache snapshots the DB
  weekly). `nfr` on the load balancer records the estimated ~24,000 QPS entry rate.
- **Step numbers dropped.** The circled 1-4 in figure 13-11 index the numbered walkthrough
  after the figure; they are not arrow labels, so they are in `ignored`, not in `label`.

## Observations (not encoded, the figures do not show them)

- The chapter later adds a filter layer in front of the Trie Cache (figure 13-14) and a shard
  map manager over sharded trie databases (figure 13-15). Neither is part of the data gathering
  or query service figures, so neither is in this design.
- The chapter mentions browser caching of suggestions and data sampling of logged queries; both
  are optimisations in prose, drawn nowhere.
- Nothing in either figure is replicated or multi-region, and there is no dead-letter or retry
  path in the weekly pipeline.

## Gaps

Recorded in `mapping.yaml` under `gaps`:

- A node that appears in two source figures cannot be recorded as such in `mapping.yaml`.
- "User" is a grouping of client devices, not a network boundary; `trust-zone` is the closest
  v1 group kind.
- "Either a document store or a key-value store" is not expressible; `nosql-store` takes one
  `model`.
- The figure marks no arrow as sync or async, but `mode` is required.
- The 100 ms promise is an absolute budget, not a percentile; v1 has only `latency.p95Ms`.

## Rules fired

| Rule | Severity | Subject |
|---|---|---|
| datastore-missing-backup | error | aggregated-data |
| cache-missing-eviction-policy | warning | trie-cache |
| credentials-without-rotation | warning | design |

All three are the product working on the book's design as drawn, and none was silenced.
The chapter never mentions backups of the aggregated table, an eviction policy for the Trie
Cache (it is replaced wholesale every week), or credential rotation.

Components added: none. Kinds added: none.
