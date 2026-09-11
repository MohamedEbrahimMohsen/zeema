# Source: web crawler, high-level design

## Citation

- Book: *System Design Interview - An Insider's Guide* (Volume 1), by Alex Xu.
- Chapter 9: "Design a Web Crawler", pages 132-150.
- Figures used:
  - **Figure 9-2** (page 136): the proposed high-level design.
  - **Figure 9-4** (page 139): the same design with the workflow sequence numbers 1-11 added.
- Other figures in the chapter, **not** imported: 9-1 (crawl example, page 132), 9-3 (link
  extraction example, page 138), 9-5 (links of one host, page 140), 9-6 (politeness inside the
  frontier, page 141), 9-7 (priority inside the frontier, page 143), 9-8 (URL frontier design,
  page 144), 9-9 (distributed crawl, page 146), 9-10 (extension modules, page 147).

The book is copyrighted. Nothing below is copied from it except box and boundary labels, which
are facts the fidelity check needs. No prose, no pages and no images were copied into this
repository.

## Boxes as drawn (Figure 9-2 = Figure 9-4)

Figure 9-4 is Figure 9-2 with a circled sequence number on every arrow; the boxes and the
arrows are identical in the two figures.

| # | Label as drawn | Shape |
|---|---|---|
| 1 | seed URLs | rounded rectangle |
| 2 | URL Frontier | rounded rectangle |
| 3 | HTML Downloader | rounded rectangle |
| 4 | DNS Resolver | rounded rectangle |
| 5 | Content Parser | rounded rectangle |
| 6 | Content Seen? | rounded rectangle |
| 7 | Content Storage | cylinder (datastore) |
| 8 | Link Extractor | rounded rectangle |
| 9 | URL Filter | rounded rectangle |
| 10 | URL Seen? | rounded rectangle |
| 11 | URL Storage | cylinder (datastore) |

11 boxes. The chapter's prose calls box 8 "URL Extractor" in its component list; the figure
draws it as "Link Extractor" and the workflow text also says "Link extractor". The drawn label
is used.

## Boundaries as drawn

None. Figure 9-2 and Figure 9-4 draw no container, region, swimlane or dashed boundary.
(Figure 9-10, not imported, adds one grey boundary labelled "Extension Module".)

## Arrows as drawn

Sequence numbers are the circled labels of Figure 9-4; Figure 9-2 draws the same arrows without
them. Two arrows are double-headed.

| Seq | From | To | Heads |
|---|---|---|---|
| 1 | seed URLs | URL Frontier | one, into URL Frontier |
| 2 | URL Frontier | HTML Downloader | one, into HTML Downloader |
| 3 | HTML Downloader | DNS Resolver | one, into DNS Resolver |
| 4 | HTML Downloader | Content Parser | one, into Content Parser |
| 5 | Content Parser | Content Seen? | one, into Content Seen? |
| 6 | Content Seen? | Content Storage | **double-headed** |
| 7 | Content Seen? | Link Extractor | one, into Link Extractor |
| 8 | Link Extractor | URL Filter | one, into URL Filter |
| 9 | URL Filter | URL Seen? | one, into URL Seen? |
| 10 | URL Seen? | URL Storage | **double-headed** |
| 11 | URL Seen? | URL Frontier | one, into URL Frontier (long return line at the bottom) |

11 drawn arrows, of which two are double-headed, so 13 directed edges.

## Facts stated about the boxes (chapter text, paraphrased in one line each)

- seed URLs: the starting point of the crawl; the URL space is divided by locality or by topic.
- URL Frontier: stores the URLs still to be downloaded; described as a FIFO queue. The deep
  dive (Figure 9-8, not imported) splits it into front queues for priority and back queues for
  politeness, one host per back queue, one worker thread per back queue.
- HTML Downloader: downloads pages over HTTP from the URLs the frontier provides; crawl jobs
  are distributed over several servers, each running several threads.
- DNS Resolver: translates a URL into an IP address for the downloader.
- Content Parser: parses and validates the downloaded page; a separate component so parsing
  does not slow the crawl servers.
- Content Seen?: detects duplicate content by comparing hashes of pages.
- Content Storage: stores the HTML; most on disk, popular content in memory.
- Link Extractor: extracts links from the page and turns relative paths into absolute URLs.
- URL Filter: excludes content types, file extensions, error links and blacklisted sites.
- URL Seen?: tracks URLs already visited or already in the frontier; bloom filter or hash table.
- URL Storage: stores the URLs already visited.

## Numbers stated (estimation section, pages 134-135)

- 1 billion pages downloaded per month; HTML only; content stored for five years.
- QPS ~400 pages per second; peak QPS = 2 x QPS = 800.
- Average page 500 KB; 500 TB per month; 30 PB for five years.
