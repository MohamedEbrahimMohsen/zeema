# Design YouTube: import notes

A video sharing service like YouTube. Users upload videos to storage; transcoding servers, run
by a DAG scheduler and task workers, encode them into storage served by a CDN, and a completion
queue updates the metadata that API servers keep in a cache and database.

- Source: *System Design Interview - An Insider's Guide* (Alex Xu), Chapter 14 "Design
  YouTube", pages 220-243, Figures 14-3, 14-4, 14-5, 14-6, 14-7 and 14-10. The book is
  copyrighted; `source/youtube.md` holds the citation and a factual transcription of the boxes,
  boundaries and arrows, nothing else.
- Format: `book-figure`. Counts: 17 boxes, 0 boundaries, 21 arrows; the design has 17 nodes,
  0 groups, 21 edges. `check_fidelity.py` passes with one assumed-mapping warning.

## Which figures make the final system

The chapter arrives at one system drawn as three complementary pictures, and the design is
their union with each distinct box counted once:

| Part | Figures | What it contributes |
|---|---|---|
| High-level design | 14-3 | Client, CDN, API servers; both arrows are drawn again in detail below |
| Video uploading flow | 14-4 (with 14-5, 14-6) | 11 boxes and 12 arrows; 14-5 adds the step numbers, 14-6 adds the request leg User -> Load balancer -> API servers |
| Video streaming flow | 14-7 | one arrow, Client -> CDN ("streaming video"); both boxes are already there |
| Video transcoding architecture | 14-10 | 6 boxes and 6 arrows: Preprocessor, DAG scheduler, Resource manager, Task workers, Temporary storage, Encoded video |

Figures excluded, and why: 14-1 and 14-2 are a screenshot and a price table; 14-8, 14-9,
14-12, 14-13 and 14-15 draw the DAG of transcoding tasks (a job graph, not runtime elements);
14-11, 14-14, 14-16, 14-18, 14-20 and 14-21 redraw Figure 14-10 with one box highlighted;
14-17 and 14-19 zoom inside the Resource manager and the Task workers, which are one box each
in Figure 14-10; 14-22 to 14-28 are the optimisation section (GOP chunking, upload centres,
message queues between download/encoding/upload modules, pre-signed URLs, serving unpopular
videos from video servers) - alternatives and refinements the chapter offers after the design,
not boxes it wires into the final system. Every one of them is listed in `mapping.yaml`
under `ignored` with its reason.

## Mapping

| Source text | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| User | user | user-device | client | close |
| Load balancer | load-balancer | load-balancer-tier | load-balancer | close |
| API servers | api-servers | container-service | app-server | close |
| Metadata Cache | metadata-cache | cache-cluster | cache | close |
| Metadata DB | metadata-db | relational-database | sql-database | close |
| Original storage | original-storage | blob-store | object-store | close |
| Transcoding servers | transcoding-servers | container-service | app-server | close |
| Transcoded storage | transcoded-storage | blob-store | object-store | close |
| CDN | cdn | content-delivery-network | cdn | close |
| Completion queue | completion-queue | message-queue | queue | close |
| Completion handler | completion-handler | container-worker | worker | close |
| Preprocessor | preprocessor | container-service | app-server | close |
| DAG scheduler | dag-scheduler | container-service | app-server | close |
| Resource manager | resource-manager | container-service | app-server | close |
| Task workers | task-workers | container-worker | worker | close |
| Temporary storage | temporary-storage | blob-store | object-store | close |
| Encoded video | encoded-video | blob-store | object-store | assumed |

No figure in this chapter labels a box with a product, so every box is the generic
default-provider component of its kind. CloudFront appears only in the cost estimation and S3
only in a sentence about the pre-signed URL name, neither as a box label, so neither is used.
Groups: none. The dashed rounded borders around API servers, Transcoding servers, Completion
handler and CDN hold one box and its own caption each; that is how the book draws a server
cluster, not a boundary.

## Assumptions

- **Encoded video** is the only assumed mapping. The box is the pipeline's output artefact
  (`funny_720p.mp4`), not a running element; `blob-store` is the closest thing the catalogue
  has to "the encoded file that comes out".
- **User / Client**: the same box is labelled "User" in Figures 14-4, 14-5 and 14-6 and
  "Client" in Figures 14-3 and 14-7. It is one box and it keeps the label the uploading
  figures use. It draws a TV, a laptop and a phone; `user-device` stands for all three because
  the client kind carries a single `platform`.
- **Transcoding servers vs Figure 14-10**: Figure 14-10 is the inside of the Transcoding
  servers box. The book draws no arrow between the two pictures, so none was invented; the six
  transcoding boxes stand as their own chain.
- **Metadata DB props**: `sharded: true` and `replication: "async"` come from the sentence
  under Figure 14-4 ("sharded and replicated to meet performance and high availability
  requirements"). Async is the assumed flavour, from the master/slave promotion in the
  error-handling playbook; the chapter does not say.
- **Directions** are as drawn. Original storage -> Transcoding servers is the data flow of the
  fetch the text describes; User -> CDN is the playback request, over which the video streams
  back; API servers -> Load balancer -> User is the response leg (step 4) and
  User -> Load balancer -> API servers the request leg of flow b.
- **Modes**: only the two completion-queue arrows are async (at-least-once, the generic
  queue's default). Everything else is a synchronous call as drawn.
- **Protocols**: `https` for service, blob and CDN calls, `sql` for the metadata database,
  `cache` for the unnamed cache tier, `amqp` for the unnamed queue.
- **requirements**: only `latency.geoDistributed: true`, which is the chapter's stated promise
  (international users, the CDN edge closest to the viewer, upload centres across the globe).
  Everything else the chapter states is a volume or a cost, and there is no requirement path
  for those.

## Observations (not encoded, the figures do not show them)

- The completion queue has no dead-letter queue and no retry path drawn; the error-handling
  playbook says "transcoding error: retry" but draws nothing.
- The pre-signed URL exchange (Figure 14-27) would add two arrows between User and API servers
  and would make the upload arrow go to the storage with a signed URL; the chapter presents it
  as an optimisation after the design.
- Figure 14-26 would replace the Transcoding servers box with download, encoding and upload
  modules separated by message queues; again an optimisation, not the assembled design.
- The chapter's cost-saving option (Figure 14-28) adds a "Video servers" tier beside the CDN.

## Gaps

Recorded in `mapping.yaml` under `gaps` (nine entries); the parent session owns
`docs/schema-gaps.md`, so nothing was written there. The substantive ones: no multi-platform
client component, one box (Temporary storage) that is several storage systems, no artefact
node for the pipeline output, no requirement path for throughput, capacity, cost or
encryption, and no way to say "replicated, flavour unstated".

## Rules fired

| Rule | Severity | Subject |
|---|---|---|
| datastore-missing-backup | error | metadata-db |
| queue-missing-dlq | error | completion-queue |
| cache-missing-eviction-policy | warning | metadata-cache |
| credentials-without-rotation | warning | design |
| fanout-inline-in-request-path | warning | resource-manager |

All five are the product working on a faithful import, not import errors. The two errors are
exactly what the chapter leaves undrawn (no backup policy on the metadata DB, no dead-letter
queue on the completion queue). `fanout-inline-in-request-path` fires on the Resource manager
-> Task workers arrow, which is drawn as a plain arrow ("run task") even though the resource
manager holds a task queue inside it; the queue is inside the box, so the edge stays sync.

Components added: none. Kinds added: none.

## Consolidation pass, 2026-09-08

The parent session re-mapped this design after the import wave, when generic components were
added to the catalogue for boxes that name no product. Mappings that had to guess a vendor
(and any single-box dashed border that had been read as a boundary) were corrected; the
picture itself is unchanged. `mapping.yaml` holds the current component for every box.
