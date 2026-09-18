# twitch-live: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/twitch-live.md` (five official Twitch engineering posts, 2015-2023, plus the 2018 Twirp announcement; all six re-fetched 2026-09-13).
- Size: 25 nodes, 29 edges, 5 groups. The broken twin is 24 nodes, 27 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture: Twitch live streaming, clean variant. Broadcasters push RTMP/WebRTC into
the nearest of ~100 PoPs, an Intelligest media proxy asks the stateful Intelligest Routing Service
which origin should take the stream, the origin transcoder emits segment-aligned HLS variants over
the private backbone to the edge PoPs, and chat runs as its own Go system beside the Helix API.

Fixes relative to twitch-live.broken.yaml:
  - chat-edge assigns channels by hash instead of randomly, so one 20,000-viewer channel cannot
    drag down every other channel sharing its host (the incident breaking-the-monolith describes)
  - chat-edge does not autoscale connections away without draining them first
  - room keeps viewer lists without a hand-edited consistent-hash ring
  - search-index is fed asynchronously by db-cdc reading the Postgres write-ahead log instead of
    being dual-written inline by the Go services
  - eventsub verifies the caller signature and is idempotent
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: Twitch live streaming, broken variant. Same system as twitch-live.yaml
with the mistakes the Twitch posts themselves describe: chat channels dropped on chat hosts at
random and taken away again without draining, viewer lists placed on a consistent-hash ring that
nothing owns, the search index dual-written inline by the Go services, and a public EventSub
endpoint that neither verifies signatures nor deduplicates the retries it invites.

This file MUST trip:
  - shared-host-per-channel-without-isolation (chat-edge channelAssignment random, traffic.skew heavy-tail)
  - stateful-websocket-scale-in-without-drain (chat-edge autoscaling true, drainOnScaleIn false)
  - stateful-hash-ring-without-ring-manager   (room shardingStrategy consistent-hash, no coordination-service edge)
  - derived-store-without-cdc-or-rebuild      (search-index has only the sync dual write from go-services)
  - business-updates-without-index-propagation (relational-db written sync by go-services, search-index exists, no CDC out)
  - webhook-without-signature-or-idempotency  (eventsub signatureVerified false, idempotent false)
and MUST NOT trip:
  - reconnect-stampede-without-guard          (chat-edge makes no sync call to a coordination service; irs serves ingest only)
  - stateful-node-without-zone-redundancy     (room is stateful but no availability-zone group is drawn)
  - shared-dependency-without-redundancy      (availability.discoveryRedundant is not required, and irs is replicated)
  - datastore-missing-backup, datastore-single-region (relational-db keeps backup, retention and async replication)
  - read-heavy-path-without-cache             (no traffic.readWriteRatio is stated, so the rule cannot fire)
  - pubsub-replay-required                    (messaging.replay is not required)
  - object-store-single-zone-with-durability-target (no durability.annualNines is stated)
  - queue-missing-dlq, retry-queue-without-dlq, cache-missing-eviction-policy (no queue and no cache in this design)

The first three are the failure the breaking-the-monolith post is written about: channels spread
at random over a handful of chat hosts, so one large stream took an eighth of chat with it, and
connections that are dropped rather than drained come straight back as a reconnect storm. The
last three are the ordinary drift a team adds while extracting services from a monolith.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Broadcaster software (OBS etc.) | `broadcaster-software` | `desktop-app` | client | exact |
| Viewer clients (web Twilight, mobile, TV) | `viewer-client` | `user-device` | client | exact |
| Intelligest media proxy | `intelligest-proxy` | `srs` | media-router | close |
| Intelligest Routing Service (IRS) | `irs` | `apache-helix` | coordination-service | close |
| Capacitor (origin compute monitoring) | `capacitor` | `observability-stack` | monitoring | close |
| The Well (backbone network monitoring) | `the-well` | `observability-stack` | monitoring | close |
| Private backbone | `backbone` | `spine-leaf-fabric` | network-fabric | close |
| TwitchTranscoder | `twitch-transcoder` | `ffmpeg` | media-transcoder | close |
| Origin data centers | group `origin-dc` | - | point-of-presence | exact |
| Edge PoPs / CDN | `edge-cdn` | `content-delivery-network` | cdn | exact |
| VOD archive | `vod-archive` | `s3` | object-store | close |
| Chat Edge | `chat-edge` | `websocket-gateway` | realtime-gateway | exact |
| Chat Pubsub | `chat-pubsub` | `redis-pubsub` | pubsub-topic | close |
| Clue | `clue` | `container-service` | app-server | exact |
| Room | `room` | `container-service` | app-server | exact |
| Helix API gateway | `helix-api` | `envoy-gateway` | api-gateway | close |
| Go microservices (Twirp RPC) | `go-services` | `container-service` | app-server | exact |
| Event Bus (SNS) | `event-bus` | `sns` | pubsub-topic | exact |
| EventSub | `eventsub` | `webhook-receiver` | webhook-endpoint | exact |
| Spade | `spade` | `kinesis` | stream | exact |
| Tahoe data lake | `tahoe` | `s3` | object-store | exact |
| Sheik | `sheik` | `redshift` | data-warehouse | exact |
| Search (OpenSearch) | `search-index` | `aws-opensearch` | search-index | exact |
| Datastores: DynamoDB | `user-db` | `dynamodb` | nosql-database | exact |
| Datastores: Postgres | `relational-db` | `postgres` | sql-database | exact |
| (no source box) | `db-cdc` | `debezium` | change-data-capture | assumed |
| ~100 ingest PoPs | group `ingest-pop` | - | point-of-presence | exact |
| Edge PoP tier | group `edge-pop` | - | point-of-presence | exact |
| AWS regions (control plane and services) | group `aws` | - | region | exact |
| Chat subsystem | group `chat` | - | system | exact |

Confidence tally: 15 exact, 11 close, 1 assumed (counting groups as their own rows: 19 exact).

Notes on the `close` and `assumed` rows:

- `srs` is the nearest catalogued `media-router` to an in-house RTMP/WebRTC ingest proxy; it is
  the only default-provider media router that terminates RTMP and WebRTC and forwards rather than
  transcodes. `label: "Intelligest media proxy"` carries the real name.
- `apache-helix` is the nearest catalogued `coordination-service` whose role is `placement`, which
  is exactly what IRS does (pick the origin that will host this stream, from capacity and network
  state). The catalogue has no generic control-plane coordinator; see gaps below.
- `ffmpeg` is the nearest catalogued `media-transcoder`. The source post is literally
  "FFmpeg vs Twitch Transcoder", so the component is the thing Twitch replaced; the label carries
  the real name and the shared-decoder design is recorded under "Not encoded".
- `redis-pubsub` is a default-provider `pubsub-topic` with at-most-once fan-out and no replay,
  which is what the 2015 post describes Pubsub doing between Edge nodes.
- `spine-leaf-fabric` is the only private-interconnect `network-fabric` under `default`.
- `db-cdc` is not a box in any source. It is added because
  `business-updates-without-index-propagation` and `derived-store-without-cdc-or-rebuild` both
  encode the practice a system with a search index and a relational system of record must have:
  the index is fed from the log, not by dual writes from application code. The clean design shows
  that mechanism; the broken twin removes it, which is the point of the pair.

Property values the source does not state, set to the value that reflects the practice the rules
encode (each is called out here rather than hidden):

- `relational-db.backupEnabled` / `backupRetentionDays` / `replication: "async"` - no Twitch post
  discusses Postgres backups or replicas; `sharded: true` does come from the card's "vertical and
  horizontal partitioning".
- `eventsub.signatureVerified` / `idempotent` - the card lists EventSub delivery guarantees as
  unknown. A public webhook endpoint that anyone can post to must verify and deduplicate, so the
  clean design says so and the broken twin takes it away.
- `security.credentialRotationDays: 90` - not stated anywhere; set so the design-wide
  `credentials-without-rotation` rule is answered rather than silently tripped.
- `chat-edge.drainOnScaleIn` / `stampedeGuard` - the 2022 post describes the failure, not the fix.
- `irs.replicated: true` - the ingest post says IRS achieves high availability for broadcasters.

## Catalogue gaps

| Product | Kind it would need | Used instead |
|---|---|---|
| Intelligest media proxy (in-house ingest media proxy) | a generic `media-router` under `default`, e.g. `media-gateway` | `srs` |
| Intelligest Routing Service (in-house stateful placement controller) | a generic `coordination-service` under `default`, or a `control-plane-coordinator` kind | `apache-helix` |
| TwitchTranscoder (in-house live multi-output transcoder) | a generic `media-transcoder` under `default`, e.g. `live-transcoder` | `ffmpeg` |
| Twitch chat Pubsub (in-house internal fan-out bus) | a generic `pubsub-topic` under `default` | `redis-pubsub` |
| Private inter-PoP backbone | a `network-fabric` for a WAN backbone rather than a DC fabric | `spine-leaf-fabric` |
| Helix (in-house public API gateway) | a generic `api-gateway` under `default` | `envoy-gateway` |

Every one of these is the same gap: the `default` provider carries named open-source products but
no plain in-house box for these six kinds, the way `container-service`, `blob-store` and
`websocket-gateway` exist for theirs.

## Not encoded

- The shared-decoder/shared-scaler structure inside TwitchTranscoder (one decoder feeding N
  encoders, IDR and segment alignment across variants, frame-rate downsampling). The format has
  no property for intra-node pipeline structure; `media-transcoder` carries codec, packaging and
  rendition count only. `renditions` is left unset because no post states a number.
- The number of PoPs (~100), origins and backbone capacity. Groups carry no properties in v1, so
  "one of ~100" lives in the group label.
- The Rails monolith. It is the predecessor of `go-services`, not a component of the system as it
  runs now; a design has no time axis, so encoding both would draw a system that never existed.
  The extraction failures the post lists (Sidekiq/RabbitMQ bloat, the NodeJS language bug, the
  Python/Tornado interim step) are history about how the Go services arrived, not runtime edges.
- The static-vs-realtime tension in IRS: "the computed routing solution is static and is not able
  to handle unexpected traffic patterns". `coordination-service` has no optimisation property, so
  the design shows the feedback edges from Capacitor and The Well but not that the plan they feed
  is recomputed offline.
- Scale numbers with nowhere to go: 2.5M average concurrent viewers, 7M monthly streamers, 1.3T
  minutes watched, hundreds of billions of chat messages a day, 100+ PB in Tahoe, 230M page loads
  a day, 2,000+ AWS accounts. `nfr` carries `rps`, `latencyP95Ms` and `consistency` only, so only
  the three per-second figures (50K rps on Helix, 1,660 events/sec on the Event Bus, ~3M
  events/sec into Spade) are encoded.
- Chat message storage and history: no source describes it, so no store hangs off the chat system.
- Search, recommendations and MLFS as separate serving systems, and Jax. Recommendations
  ("billions of requests a day") and MLFS are named in the 2023 post but with no edges stated;
  Jax could not be confirmed at all. Only the OpenSearch-backed search index is encoded.
- ASIC transcoding hardware: `worker.accelerator`/`ml-inference.accelerator` could express it,
  but Part I of the transcoder post does not state it, so it is left out.
