# Design YouTube (source transcription)

## Citation

- Book: *System Design Interview - An Insider's Guide* (Volume 1), Alex Xu.
- Chapter 14: "Design YouTube", pages 220-243.
- Figures used: **Figure 14-3** (high-level design, page 223), **Figure 14-4** (video uploading
  flow, page 224), **Figure 14-5** (flow a: upload the actual video, page 226),
  **Figure 14-6** (flow b: update the metadata, page 227), **Figure 14-7** (video streaming
  flow, page 228) and **Figure 14-10** (video transcoding architecture, page 231).
- The book is copyrighted. Neither the PDF, its pages, its images nor its prose are stored in
  this repository. What follows is a factual transcription of those figures: the box labels as
  drawn, the boundaries and the arrows. Box labels are facts and the fidelity check needs them.

The chapter's final system is one system drawn as three complementary pictures: the video
uploading flow (Figures 14-4, 14-5 and 14-6), the video streaming flow (Figures 14-3 and 14-7)
and the video transcoding architecture (Figure 14-10), which is the inside of the "Transcoding
servers" box. Each distinct box is counted once across all six figures.

## Figure 14-3 - high-level design (page 223)

| # | Text as drawn | Drawn as |
|---|---|---|
| 1 | Client | rounded box, top, holding a laptop, a phone and a TV icon |
| 2 | CDN | blue cloud icon inside a dashed rounded border, caption below |
| 3 | API servers | three green server icons inside a dashed rounded border, caption below |

Boundaries: none (the dashed borders hold one box and its own caption each).

| # | From | To | Label |
|---|---|---|---|
| 1 | Client | CDN | streaming video |
| 2 | Client | API servers | everything else |

The "Client" box is the same box the uploading figures label "User". Arrow 2 ("everything
else") is the request path Figures 14-4 and 14-6 draw in detail through the Load balancer.

## Figure 14-4 - video uploading flow (page 224)

Boxes, top-left to bottom-right:

| # | Text as drawn | Drawn as |
|---|---|---|
| 1 | Original storage | green bucket icon in a rounded box, top left |
| 2 | User | rounded box, top centre, holding a TV, a laptop and a phone icon |
| 3 | Load balancer | blue trapezoid icon with a four-way arrow, caption to its right |
| 4 | API servers | three green server icons with the caption inside a dashed rounded border |
| 5 | Metadata Cache | three stacked blue "CACHE" tiles in a rounded box, caption below |
| 6 | Metadata DB | three blue cylinders in a rounded box, caption below |
| 7 | Transcoding servers | three green server icons with the caption inside a dashed rounded border |
| 8 | Completion queue | blue envelope-chevron queue icon, caption below |
| 9 | Completion handler | three green server icons with the caption inside a dashed rounded border |
| 10 | Transcoded storage | green bucket icon in a rounded box, bottom left |
| 11 | CDN | blue cloud icon inside a dashed rounded border, caption below |

Boundaries: none. The dashed rounded borders around API servers, Transcoding servers,
Completion handler and CDN each hold one box and its own caption; that is how the book draws a
cluster, not a boundary around other boxes.

Arrows:

| # | From | To | Label |
|---|---|---|---|
| 1 | User | Original storage | |
| 2 | Original storage | Transcoding servers | |
| 3 | Transcoding servers | Transcoded storage | |
| 4 | Transcoding servers | Completion queue | transcoding complete |
| 5 | Transcoded storage | CDN | |
| 6 | Completion queue | Completion handler | |
| 7 | Completion handler | Metadata DB | |
| 8 | Completion handler | Metadata Cache | |
| 9 | API servers | Metadata Cache | |
| 10 | API servers | Metadata DB | |
| 11 | API servers | Load balancer | |
| 12 | Load balancer | User | |

## Figure 14-5 - flow a: upload the actual video (page 226)

The same eleven boxes and the same twelve arrows as Figure 14-4, with step markers written on
the arrows: 1 (User -> Original storage), 2 (Original storage -> Transcoding servers), 3a
(Transcoding servers -> Transcoded storage), 3b (Transcoding servers -> Completion queue,
beside the "transcoding complete" label), 3a.1 (Transcoded storage -> CDN), 3b.1 (Completion
queue -> Completion handler), 3b.1.a (Completion handler -> Metadata DB), 3b.1.b (Completion
handler -> Metadata Cache), 4 (API servers -> Load balancer -> User). The markers are step
numbers, not arrow labels. No new box, boundary or arrow.

## Figure 14-6 - flow b: update the metadata (page 227)

| # | Text as drawn | Drawn as |
|---|---|---|
| 1 | User | rounded box, top, holding a TV, a laptop and a phone icon |
| 2 | Load balancer | blue trapezoid icon with a four-way arrow, caption to its right |
| 3 | API servers | three green server icons with the caption inside a dashed rounded border |
| 4 | Metadata Cache | three stacked blue "CACHE" tiles in a rounded box, caption below |
| 5 | Metadata DB | three blue cylinders in a rounded box, caption below |

Boundaries: none.

| # | From | To | Label |
|---|---|---|---|
| 1 | User | Load balancer | Update metadata |
| 2 | Load balancer | API servers | |
| 3 | API servers | Metadata Cache | |
| 4 | API servers | Metadata DB | |

Arrows 3 and 4 are the same two arrows Figure 14-4 draws; arrows 1 and 2 are the request leg of
the same load balancer path whose response leg Figure 14-4 draws (API servers -> Load balancer
-> User).

## Figure 14-7 - video streaming flow (page 228)

| # | Text as drawn | Drawn as |
|---|---|---|
| 1 | Client | rounded box, top, holding a laptop, a phone and a TV icon |
| 2 | CDN | blue cloud icon inside a dashed rounded border, caption below |

Boundaries: none.

| # | From | To | Label |
|---|---|---|---|
| 1 | Client | CDN | streaming video |

Both boxes are boxes of Figure 14-4 ("Client" there is "User"), so the streaming flow adds one
arrow and no box.

## Figure 14-10 - video transcoding architecture (page 231)

| # | Text as drawn | Drawn as |
|---|---|---|
| 1 | Preprocessor | rounded box, bottom left |
| 2 | DAG scheduler | rounded box |
| 3 | Resource manager | rounded box |
| 4 | Task workers | rounded box |
| 5 | Encoded video | rounded box, bottom right |
| 6 | Temporary storage | rounded box, top right |

Boundaries: none.

| # | From | To | Label |
|---|---|---|---|
| 1 | Preprocessor | DAG scheduler | |
| 2 | Preprocessor | Temporary storage | |
| 3 | DAG scheduler | Resource manager | |
| 4 | Resource manager | Task workers | |
| 5 | Task workers | Temporary storage | |
| 6 | Task workers | Encoded video | |

Figures 14-11, 14-14, 14-16, 14-18, 14-20 and 14-21 redraw this same picture with one box
highlighted in blue in turn (Figure 14-20 highlights "Temporary storage"); they add no box and
no arrow.

## Counts

Union of the six figures, each distinct box counted once: **17 boxes, 0 boundaries, 21
arrows** (12 from Figure 14-4, 2 new from Figure 14-6, 1 from Figures 14-3/14-7, 6 from
Figure 14-10).

## Facts the chapter states next to those boxes

- Metadata DB: "sharded and replicated to meet performance and high availability requirements".
- Metadata cache: video metadata and user objects are cached "for better performance".
- Original storage and Transcoded storage: blob storage, for source and for transcoded files.
- Completion queue: a message queue of video transcoding completion events.
- Completion handler: workers that pull event data from the queue and update cache and database.
- Temporary storage: several storage systems - metadata cached in memory, video and audio in
  blob storage; freed once the video is processed.
- Encoded video: the final output of the encoding pipeline, e.g. `funny_720p.mp4`.
- Error handling, page 241: metadata DB master/slave, promote a slave when the master is down.

## Numbers the chapter states (back of the envelope estimation, pages 221-222)

- 5 million daily active users; 5 videos watched per user per day.
- 10% of users upload 1 video per day; average video size 300 MB.
- Total daily storage: 150 TB. CDN cost about $150,000 per day at $0.02 per GB.
- Maximum allowed video size 1 GB; encryption required; clients are mobile apps, web browsers
  and smart TV; a large percentage of users are international.
