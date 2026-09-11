# Design Google Drive (source transcription)

## Citation

Alex Xu, *System Design Interview - An Insider's Guide* (Volume 1), Chapter 15: Design
Google Drive, pages 244-263. The design imported here is **Figure 15-10** (page 253),
which the chapter introduces as "Figure 15-10 illustrates the proposed high-level design."

The book is copyrighted. Nothing from it is copied into this repository: no pages, no
images, no prose. What follows is a factual transcription of the boxes, boundaries and
arrows the figure draws, which the fidelity check needs.

Corroborating figures, read but **not** imported (they are flows over the same components,
not extra architecture): Figure 15-11 (page 255, how a block server splits, compresses and
encrypts blocks before uploading them to cloud storage), Figure 15-12 (page 255, delta
sync), Figure 15-13 (page 256, metadata schema), Figure 15-14 (page 258, upload sequence),
Figure 15-15 (page 259, download sequence).

## Boxes as drawn (Figure 15-10)

| # | Text as drawn | Drawn as |
|---|---|---|
| 1 | User | rounded box at the top, containing a laptop icon and a phone icon |
| 2 | Block servers | three green server icons inside a dashed rounded outline, upper left |
| 3 | Cloud storage | rounded box with a green bucket icon, left |
| 4 | Cold storage | rounded box with a snowflake icon, bottom left |
| 5 | Load balancer | blue trapezoid icon, centre; the text sits to the right of the icon |
| 6 | API servers | three green server icons inside a dashed rounded outline, centre |
| 7 | Metadata Cache | rounded box with three stacked "CACHE" tiles, bottom centre |
| 8 | Metadata DB | rounded box with three blue cylinders, bottom right |
| 9 | Notification Service | rounded box with a bell icon, right |
| 10 | Offline backup Queue | chevron-shaped box holding three envelope icons, far right |

The dashed outlines around "Block servers" and "API servers" hug the server icons of those
two boxes only; they contain no other labelled box and are the figure's way of drawing a
server cluster, not boundaries.

## Boundaries

None. The figure draws no region, zone, network or trust boundary.

## Arrows as drawn

| # | From | To | Label |
|---|---|---|---|
| 1 | User | Block servers | |
| 2 | User | Load balancer | |
| 3 | User | Notification Service | long polling |
| 4 | Block servers | Cloud storage | |
| 5 | Cloud storage | Load balancer | |
| 6 | Cloud storage | Cold storage | |
| 7 | Load balancer | API servers | |
| 8 | API servers | Metadata Cache | |
| 9 | API servers | Metadata DB | |
| 10 | API servers | Notification Service | |
| 11 | Notification Service | Offline backup Queue | |

Counts: 10 boxes, 0 boundaries, 11 arrows. "long polling" is the only arrow label; "Figure
15-10" is the caption.

## Facts the chapter states about these boxes (used for props and requirements)

- Files in the storage must be encrypted; a block server compresses and encrypts each block
  before sending it to cloud storage (Figure 15-11).
- Cloud storage is Amazon S3; files are replicated in two separate geographical regions and
  S3 buckets are replicated multiple times in different regions.
- Cold storage stores inactive data - data not accessed for months or years; the chapter
  names Amazon S3 Glacier as such a store.
- API servers are a stateless service.
- The metadata database is relational (chosen for native ACID), moved off the single server,
  with data replication and sharding.
- Caches must be invalidated on database write so cache and database hold the same value.
- The notification service is a publisher/subscriber system; it uses long polling, so every
  online client keeps a long poll connection open to it.
- The offline backup queue stores changes for a client that is offline so they are synced
  when it comes back online; queues are replicated multiple times.
- Estimation: 10M DAU, 1:1 read to write ratio, upload QPS ~240, peak QPS = QPS * 2.
- The system requires strong consistency by default for the metadata cache and database
  layers; a file must not be shown differently by different clients at the same time.
