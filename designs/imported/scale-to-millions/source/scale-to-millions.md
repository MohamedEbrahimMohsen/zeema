# Source: "Scale from zero to millions of users", Figure 1-23

## Citation

- Book: *System Design Interview – An Insider's Guide*, by Alex Xu.
- Chapter 1: "Scale from zero to millions of users", pages 5–33.
- Figure imported: **Figure 1-23** (page 31), the chapter's final architecture: the design of
  Figure 1-19 (message queue plus logging / metrics / monitoring / automation tooling) with the
  data tier sharded and a NoSQL store added.
- The book is copyrighted. Nothing of it is reproduced here beyond the box, boundary and arrow
  labels, which are the facts the fidelity check needs.

## Boxes as drawn (Figure 1-23)

| # | Label as drawn | Drawn as | Inside |
|---|---|---|---|
| 1 | `DNS` | globe glyph | — |
| 2 | `Web browser` | laptop glyph | `User` |
| 3 | `Mobile app` | phone glyph | `User` |
| 4 | `CDN` | cloud glyph | — |
| 5 | `Load balancer` | trapezoid glyph | — |
| 6 | `Web servers` | dashed box holding a stack of three server glyphs | `DC1` |
| 7 | `Message Queue` | queue glyph with three envelopes | `DC1` |
| 8 | `Databases` | rounded box holding three cylinders labelled `Shard 1`, `Shard 2`, `Shard ...`; the label reads `① Databases` | `DC1` |
| 9 | `Caches` | rounded box holding three stacked tiles each reading `CACHE` | `DC1` |
| 10 | `Workers` | dashed box holding a stack of three server glyphs | `DC1` |
| 11 | `NoSQL` | cylinder with a `{}` glyph; the label reads `② NoSQL`; drawn **outside** the `DC1` boundary | — |
| 12 | `Logging` | rounded box | `Tools` |
| 13 | `Metrics` | rounded box | `Tools` |
| 14 | `Monitoring` | rounded box | `Tools` |
| 15 | `Automation` | rounded box | `Tools` |

## Boundaries as drawn

| Label as drawn | Style | Contains |
|---|---|---|
| `User` | solid rounded rectangle, cyan | `Web browser`, `Mobile app` |
| `DC1` | dashed rounded rectangle, grey fill | `Web servers`, `Message Queue`, `Databases`, `Caches`, `Workers` |
| `Tools` | solid rounded rectangle, purple; the label reads `② Tools` in Figure 1-19 and `Tools` in Figure 1-23 | `Logging`, `Metrics`, `Monitoring`, `Automation` |

## Arrows as drawn

| # | From (as drawn) | To (as drawn) | Arrow label |
|---|---|---|---|
| 1 | `User` boundary, left edge | `DNS` | — |
| 2 | `User` boundary, right edge | `CDN` | — |
| 3 | `Web browser` | `Load balancer` | `www.mysite.com` |
| 4 | `Mobile app` | `Load balancer` | `api.mysite.com` |
| 5 | `Load balancer` | `DC1` boundary, top edge | — |
| 6 | `Web servers` | `Message Queue` | — |
| 7 | `Web servers` | `Databases` | — |
| 8 | `Web servers` | `Caches` | — |
| 9 | `Web servers` | `NoSQL` | — |
| 10 | `Message Queue` | `Workers` | — |
| 11 | `Tools` boundary, top edge | `DC1` boundary, bottom edge | — |

All eleven arrows are single-headed. The circled numbers `①` and `②` next to `Databases`,
`NoSQL`, `Message Queue` and `Tools` are footnote markers keyed to the numbered notes in the
running text, not part of the labels.

## Facts the chapter states about this figure

- Figure 1-23 shards the databases; the previous figure (1-19) drew one `Databases` box with
  unlabelled cylinders. Some non-relational functionality is moved to the NoSQL data store to
  reduce the database load.
- Figure 1-19, whose contents Figure 1-23 keeps, adds the message queue and the logging,
  monitoring, metrics and automation tools. Only one data centre is drawn "due to the space
  constraint"; the chapter's design supports multiple data centres (Figures 1-15 and 1-16 show
  `DC1` in US-East and `DC2` in US-West, geoDNS-routed), and "Support multiple data centers" is
  one of the chapter's closing points.
- No SLA, latency target, throughput number or capacity estimate appears anywhere in the
  chapter.
