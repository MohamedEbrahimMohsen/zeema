# Design Google Drive: import notes

- Source: Alex Xu, *System Design Interview - An Insider's Guide* (Volume 1), chapter 15
  "Design Google Drive", pages 244-263. The imported figure is **Figure 15-10** (page 253),
  which the chapter introduces as the proposed high-level design.
- Format: `book-figure`. The book is copyrighted, so `source/google-drive.md` is a citation
  plus a factual transcription written here (boxes, boundaries, arrows); no page, image or
  prose of the book is in this repository.
- Counts: 10 boxes, 0 boundaries, 11 arrows; the design has 10 nodes, 0 groups, 11 edges.
  `check_fidelity.py` passes with one assumed-mapping warning (Cold storage).

## Mapping

| Source text | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| User | user | user-device | client | close |
| Block servers | block-servers | container-service | app-server | close |
| Cloud storage | cloud-storage | s3 | object-store | exact |
| Cold storage | cold-storage | blob-store | object-store | assumed |
| Load balancer | load-balancer | load-balancer-tier | load-balancer | close |
| API servers | api-servers | container-service | app-server | close |
| Metadata Cache | metadata-cache | cache-cluster | cache | close |
| Metadata DB | metadata-db | relational-database | sql-database | close |
| Notification Service | notification-service | websocket-gateway | realtime-gateway | close |
| Offline backup Queue | offline-backup-queue | message-queue | queue | close |

No groups: the figure draws no region, network or trust boundary. The dashed outlines around
the Block servers and the API servers hug the server icons of those two boxes only and
contain no other labelled box, so they are cluster styling, not boundaries.

## Assumptions

- **User.** One box, drawn with a laptop and a phone, and the chapter answers "both" to web
  app or mobile app. A box may not be split and a client node carries a single `platform`,
  so the node is `user-device`. Recorded as a gap.
- **Cloud storage.** The box is generic but the chapter names the product: blocks are stored
  in S3 and "Amazon S3 is used for file storage", so the node is `s3` (`confidence: exact`).
- **Cold storage.** The box is generic and the chapter names Glacier only by example ("cold
  storage like Amazon S3 glacier"). Because the file storage beside it is committed to S3,
  the AWS archive tier is used, marked `assumed`. A vendor-free reading would be `blob-store`
  with `tier: "cold"`.
- **Notification Service.** Mapped to the generic in-house realtime gateway with
  `protocol: "long-poll"`, not to `notification-platform`: the chapter's notification service
  is a publisher/subscriber tier that every online client holds a long poll connection to,
  while `notification-platform` is a push/email/SMS platform. The figure's only arrow label,
  "long polling", is on the edge into this node.
- **Metadata DB.** The chapter states replication and sharding for the metadata database but
  never the replication mode; `async` is assumed (a master with promotable slaves).
- **Edge modes.** Only the publish into the pub/sub notification service and the write into
  the offline backup queue are `async`. The long poll is drawn client -> service and the
  client waits, so it is `sync`; the upload completion callback from cloud storage is an
  HTTP request, so it is `sync` too. Both are recorded as gaps.

## Props, and where each fact comes from

Every prop below is a fact the figure's own explanation (pages 253-254) or the chapter's
explicit decision about that box states. The later flow figures were read for corroboration
and merged into nothing.

| Node | Prop | Stated by |
|---|---|---|
| user | `persistentConnection: true` | "each client establishes a long poll connection to the notification service"; the figure labels that arrow "long polling" |
| cloud-storage | `crossRegionReplication: true` | files are replicated in two separate geographical regions; failure handling says S3 buckets are replicated multiple times in different regions |
| api-servers | `stateless: true` | failure handling: "It is a stateless service" (also the component default) |
| metadata-cache | `invalidation: "event"` | "Invalidate caches on database write to ensure cache and database hold the same value" |
| metadata-db | `replication: "async"`, `sharded: true` | the chapter sets up data replication and sharding for the metadata database (mode assumed) |
| notification-service | `protocol: "long-poll"`, `stateful: true` | the chapter opts for long polling; every online user keeps a long poll connection with the notification server |
| offline-backup-queue | `role: "offline-mailbox"` | the offline backup queue stores changes for a client that is offline so they sync when it is online |

Encryption at rest is not written as a prop because `s3` already defaults `encryptionAtRest`
to true, which is what "files in the storage must be encrypted" and Figure 15-11's encrypt
step require.

`requirements` come from the chapter's own numbers and promises:
`traffic.readWriteRatio: 1` and `traffic.peakMultiplier: 2` from the estimation section
("1:1 read to write ratio", "Peak QPS = QPS * 2"); `consistency.model: "cp"` and
`consistency.readAfterWrite: true` from "Our system requires strong consistency by default"
and the statement that a file must not be shown differently by different clients at the
same time.

## What the later figures state about components encoded here (not merged)

- **Figure 15-11** (block server, page 255): a block server splits a file, compresses each
  block, encrypts it, then uploads it to cloud storage. Confirms `block-servers ->
  cloud-storage` and the encryption of what lands in `cloud-storage`.
- **Figure 15-12** (delta sync, page 255): only modified blocks are uploaded. A property of
  the block-server algorithm; the `app-server` kind has no field for it, so it is not encoded.
- **Figure 15-13** (page 256): the metadata schema (user, device, namespace, file,
  file_version, block). Tables are not nodes; it confirms `metadata-db` is relational.
- **Figure 15-14** (upload sequence, page 258): client 1 -> API servers (add metadata) ->
  metadata DB (status pending) -> notification service -> client 2; client 1 -> block
  servers -> cloud storage -> API servers (callback) -> metadata DB (status uploaded) ->
  notification service -> client 2. Same components; in 15-10 the callback is drawn into the
  load balancer rather than straight into the API servers, and 15-10 is what is encoded.
- **Figure 15-15** (download sequence, page 259): notification service -> client 2, client 2
  -> API servers -> metadata DB, client 2 -> block servers -> cloud storage. The reverse
  directions of arrows 1, 2 and 4 of Figure 15-10 - Figure 15-10 draws each of those as a
  single arrow, so no extra edges were invented.

## Observations (not encoded, the figure does not show them)

- The figure shows no path from the notification service back to the client other than the
  long poll the client itself opens, and no consumer of the offline backup queue.
- No dead-letter queue and no backup on the metadata database are drawn, which is what two of
  the rules below find.
- The chapter's wrap-up proposes a separate presence service and direct client-to-storage
  uploads as alternatives; neither is in Figure 15-10, so neither is a node.
- The chapter quotes over 1 million open long poll connections per machine, but attributes
  the number to a Dropbox talk rather than stating it as this design's target, so
  `maxConnectionsPerNode` is left unset.

## Gaps

Recorded in `mapping.yaml` under `gaps` (not copied into `docs/schema-gaps.md`: that file is
shared and owned by the parent session).

- One client box stands for two platforms; `client.platform` takes one value.
- Replication stated without a mode forces a choice from the `replication` enum.
- A long poll is a held request carrying a server-initiated event; `mode` has only `sync` and
  `async`.
- The object-store upload completion callback is an event delivered as a synchronous HTTP
  request; the same `mode` limitation applies.

## Rules fired

| Rule | Severity | Subject |
|---|---|---|
| datastore-missing-backup | error | metadata-db |
| queue-missing-dlq | error | offline-backup-queue |
| cache-missing-eviction-policy | warning | metadata-cache |
| credentials-without-rotation | warning | design |

All four are findings about the book's design, not import errors; the design was not changed
to silence them.

Components added: none. Kinds added: none.

## Consolidation pass, 2026-09-08

The parent session re-mapped this design after the import wave, when generic components were
added to the catalogue for boxes that name no product. Mappings that had to guess a vendor
(and any single-box dashed border that had been read as a boundary) were corrected; the
picture itself is unchanged. `mapping.yaml` holds the current component for every box.
