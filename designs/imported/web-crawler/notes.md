# Web crawler: import notes

- Source: *System Design Interview - An Insider's Guide* (Alex Xu), chapter 9 "Design a Web
  Crawler", pages 132-150. The book is copyrighted and is not in the repository; `source/`
  holds the citation and my own factual transcription of the figures
  (`source/web-crawler.md`).
- Format: `book-figure`. Figures imported: **9-2** (page 136, the proposed high-level design)
  and **9-4** (page 139, the same design with the workflow sequence numbers 1-11 on the
  arrows). The two figures draw the same 11 boxes and the same 11 arrows, so they are one
  design; the sequence number of Figure 9-4 is kept as the edge `label`.
- Counts: source 11 boxes, 11 drawn arrows (two of them double-headed) and 0 boundaries;
  design 11 nodes, 13 edges, 0 groups. `check_fidelity.py` passes.

## Mapping

| Source text | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| seed URLs | seed-urls | blob-store | object-store | assumed |
| URL Frontier | url-frontier | message-queue | queue | close |
| HTML Downloader | html-downloader | container-worker | worker | close |
| DNS Resolver | dns-resolver | dns-resolver | dns | close |
| Content Parser | content-parser | container-service | app-server | close |
| Content Seen? | content-seen | container-service | app-server | close |
| Content Storage | content-storage | blob-store | object-store | close |
| Link Extractor | link-extractor | container-service | app-server | close |
| URL Filter | url-filter | container-service | app-server | close |
| URL Seen? | url-seen | container-service | app-server | close |
| URL Storage | url-storage | nosql-store | nosql-database | close |

Groups: none. Figures 9-2 and 9-4 draw no boundary at all.

## Decisions and assumptions

- **The URL frontier stays one node.** The chapter's deep dive opens the frontier in separate
  figures: 9-6 (politeness: queue router, mapping table, back queues b1..bn, queue selector,
  worker threads), 9-7 (priority: prioritizer, front queues f1..fn, queue selector) and 9-8
  (both halves together, front queues for prioritisation, back queues for politeness, plus a
  Mapping Table store). Those are the inside of the box that Figure 9-2 draws as "URL
  Frontier", not extra system-level boxes, so none of them is a node here. The frontier node
  carries `role: "frontier"` and `ordering: "per-key"`, which is what Figure 9-8's per-host
  back queues mean.
- **seed URLs** is the only assumed mapping. It is drawn as a plain rounded box, not a
  cylinder, and the chapter never says where seeds come from or how they are held; it is the
  crawl's input data set, so `blob-store`. Swap it for whatever really supplies the seeds.
- **HTML Downloader** is a `container-worker`, not a `container-service`: it consumes URLs from
  the frontier queue and the chapter describes downloader servers running worker threads
  (Figures 9-8 and 9-9). Every other processing box (Content Parser, Content Seen?, Link
  Extractor, URL Filter, URL Seen?) is a plain service box, so `container-service`.
- **Link Extractor** keeps the label the figure draws. The chapter's component list calls the
  same box "URL Extractor" in its heading; labels are verbatim from the figure.
- **The two double-headed arrows** (6 to Content Storage, 10 to URL Storage) became two
  directed edges each, which is why the design has 13 edges for 11 drawn arrows. Both are
  check-then-store round trips: "Content Seen?" asks the storage whether the page is there and
  the content is stored when it is not; "URL Seen?" asks whether the URL was visited.
- **Edge modes**: the three arrows that enter or leave the URL Frontier (1, 2, 11) are `async`
  with the generic queue's `at-least-once` delivery; every other arrow is `sync`. Protocols are
  not drawn: `dns` for the resolver call, `queue` for the frontier hops, `https` for the two
  stores, `http` for the pipeline hops.
- **Requirements**: only `traffic.peakMultiplier: 2`, from the estimation section ("Peak QPS =
  2 * QPS"). The other estimation numbers (1 billion pages a month, 500 KB a page, 30 PB over
  five years) have no requirement path. `nfr: { rps: 400 }` on the HTML Downloader is the same
  section's ~400 pages per second.
- No `props` were invented. Politeness delays, the DNS cache, consistent hashing, short
  timeouts and the robots.txt cache are all deep-dive techniques that Figure 9-2 does not draw,
  so they are not encoded.

## Observations (not encoded, the figure does not show them)

- Figure 9-10 (page 147, extensibility) redraws this same architecture with a grey "Extension
  Module" boundary holding "PNG Downloader", "Link Extractor" and "Web Monitor". It is an
  illustration of how the crawler could be extended, not the design the chapter proposes, so
  its two extra boxes and its boundary are not imported. If someone wants that variant it is a
  separate design.
- Figure 9-9 (page 146) draws one URL Frontier fanning out to several HTML Downloaders with
  "distribute URLs"; the high-level figure draws a single downloader box, and that is what is
  imported.
- The web itself, robots.txt and the crawler's DNS cache are never boxes in any figure.
- The frontier has no dead-letter queue and the two stores no backup in the figure; the rules
  below say so, and that is the product working, not an import error.

## Gaps

- Politeness (one page at a time per host, with a delay) has no expression at design level.
- Content Storage's disk-plus-memory split is not expressible (`tier` is hot/warm/cold).
- The frontier's internals cannot be expressed inside one node.
- Stored volume (30 PB) and retention (five years) have no `requirements` path.
- Freshness is stated without a number, and `freshness.maxSeconds` needs one.

## Rules fired

| Rule | Severity | Subject |
|---|---|---|
| queue-missing-dlq | error | url-frontier |
| credentials-without-rotation | warning | design |

Components added: none. Kinds added: none.
