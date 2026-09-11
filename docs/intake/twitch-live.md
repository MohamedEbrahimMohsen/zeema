# Intake: Twitch live streaming (ingest routing, transcoding, edge distribution, chat)

## Source
- Primary: https://blog.twitch.tv/en/2022/04/26/ingesting-live-video-streams-at-global-scale/ (official, 2022: Intelligest media proxy and routing service, ~100 PoPs)
- Primary: https://blog.twitch.tv/en/2015/12/18/twitch-engineering-an-introduction-and-overview-a23917b71a25/ (official, 2015: video, chat, web systems)
- Primary: https://blog.twitch.tv/en/2022/03/30/breaking-the-monolith-at-twitch/ (official, 2022: Rails monolith, chat on 8 machines, Go pubsub)
- Primary: https://blog.twitch.tv/en/2017/10/10/live-video-transmuxing-transcoding-f-fmpeg-vs-twitch-transcoder-part-i-489c1c125f28/ (official, 2017: single-process multi-output transcoder)
- Primary: https://blog.twitch.tv/en/2023/09/28/twitch-state-of-engineering-2023/ (official, 2023: scale numbers, named systems, AWS services)
- Verified by: five official Twitch engineering posts
- Confidence: high
- Date of source: 2015-2023

## System in three lines
Live video platform where broadcasters push RTMP/WebRTC to the nearest of ~100 PoPs, an Intelligest media proxy asks a stateful routing service in AWS which origin should transcode the stream, origins produce aligned HLS variants with custom transcoders (later ASICs), and edge PoPs distribute to millions of viewers over a private backbone. Chat is a separate Go system (Edge, Pubsub, Clue, Room) carrying hundreds of billions of messages a day. Hard because ingest routing is a capacity-constrained optimisation, transcoding must keep segments aligned across variants, one hot channel used to take down an eighth of chat, and the whole thing moved from a Rails monolith to Go microservices on AWS.

## Scale (only if stated)
- Users / DAU: 2.5M average concurrent viewers; 7M monthly streamers; 1.3T minutes watched per year (2023); 30,000+ simultaneous broadcasters and 2M concurrent stream peaks (2015)
- Requests per second: web APIs 50K+ rps average (2015); ~1,660 events/sec to SNS event bus; ~3M events/sec into Spade data pipeline; 230M page loads/day
- Data volume: 100+ PB in Tahoe data lake
- Message throughput: chat "over 10 billion messages a day" (2015) to "hundreds of billions" (2023); 10M events/min into Community Insights
- Fleet: nearly 100 PoPs, multiple origin data centers, 2,000+ AWS accounts; Intelligest reaches 100% compute utilisation at peak
- Chat incident era: 8 chat machines, 20,000-viewer stream degraded one eighth of chat, connection times over a minute

## Requirements stated or clearly implied
- Availability target: reroute new streams away from failed origins automatically; viewers served from edge; no stated nines
- Consistency: chat eventual; video best-effort real time; routing decisions stateful in IRS
- Latency target: live latency (seconds); connection establishment must not exceed seconds (monolith-era failure)
- Ordering needs: HLS segment and IDR alignment across variants; chat per-channel ordering implied
- Replay or reprocessing: VOD archive from ingest; Kinesis/Spade pipeline into data lake
- Retention: VOD per policy; not stated
- Compliance / residency: not stated
- Capacity: transcode every stream (was 2-3% of channels before in-house transcoder)

## Boundaries
- Regions / zones: ~100 edge PoPs (bare metal), origin DCs, AWS regions for control plane and services; private backbone between them
- Trust zones: broadcasters -> ingest PoP (media proxy) -> origins; viewers -> edge PoP; clients -> API gateway (Helix) -> Go services on AWS
- Named subsystems: Ingest (Intelligest proxy, IRS, Capacitor, The Well), Transcode (TwitchTranscoder, ASICs), Distribution (edge PoPs, HLS), VOD, Chat (Edge, Pubsub, Clue, Room), Event Bus (SNS) and EventSub, API (Helix), Commerce (40+ services), Data (Spade, Tahoe, Sheik), ML (MLFS, recommendations, search)
- Group kinds: point-of-presence (edge and origin tiers), provider (bare metal vs AWS)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Broadcaster software | Sends RTMP or WebRTC stream | OBS etc. | desktop-client | protocol: rtmp, webrtc |
| 2 | Viewer clients | Web (Twilight React), mobile, TV; HLS playback | in-house player | web-client, mobile-client | |
| 3 | Intelligest media proxy | Per-PoP ingest gateway: terminates streams, extracts properties, forwards to chosen origin | in-house (Go) | media-router (ingest) | perPoP: true |
| 4 | Intelligest Routing Service (IRS) | Stateful controller in AWS: picks origin by latency, capacity, rules; reroutes on origin failure | in-house | control-plane-coordinator | stateful: true; staticOptimisation: true |
| 5 | Capacitor / The Well | Compute and network monitoring feeding IRS | in-house | monitoring | |
| 6 | Origin data centers | Hundreds to thousands of servers transcoding and distributing | own hardware | point-of-presence (origin tier) | |
| 7 | TwitchTranscoder | Single process, shared decoder and scaler, multiple encoders; aligned IDR/segments; frame-rate downsampling; later ASICs | in-house (C/C++, Go) | worker (transcode) | accelerator: asic; multiOutput: true |
| 8 | Edge PoPs / CDN | HLS distribution to viewers, mostly Go | in-house | cdn | pops: 100 |
| 9 | Private backbone | Links PoPs and origins | own network | network-fabric | |
| 10 | VOD archive | Stores streams for on-demand | S3 (implied) | object-store | |
| 11 | Chat Edge | Terminates client connections (proprietary protocol and IRC), distributes messages | in-house (Go) | realtime-gateway | |
| 12 | Chat Pubsub | Routes messages between Edge nodes; first Go service was 100 lines | in-house (Go) | pubsub-topic (internal) | |
| 13 | Clue | User analysis and business logic: bans, subscriptions, abuse | in-house (Go) | app-server | |
| 14 | Room | Viewer lists and membership | in-house (Go) | app-server (stateful) | |
| 15 | Rails monolith (legacy) | API, video, chat, search, commerce until Wexit | Ruby on Rails | app-server | |
| 16 | Go microservices | Post-Wexit services; Twirp RPC | Go | app-server | rpc: twirp |
| 17 | Helix API gateway | Public API | in-house | api-gateway | |
| 18 | Event Bus / EventSub | Internal events on SNS; external webhooks to developers | AWS SNS; EventSub | pubsub-topic + webhook-endpoint | eventsPerSec: 1660 |
| 19 | Spade | Event ingestion pipeline into data lake | in-house on Kinesis | stream + etl-job | eventsPerSec: 3000000 |
| 20 | Tahoe / Sheik | Data lake and reporting | S3, Redshift | data-warehouse | pb: 100 |
| 21 | Search / Recommendations / MLFS | OpenSearch, ML feature store, billions of rec requests/day | OpenSearch, in-house | search-index + ml-inference | |
| 22 | Datastores | DynamoDB, Postgres (vertical and horizontal partitioning) | DynamoDB, PostgreSQL | nosql-database + sql-database | |
| 23 | Jax | Near-real-time index of livestreams by category | in-house (Go) | search-index (specialised) | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| broadcaster | intelligest-proxy (nearest pop) | rtmp / webrtc | async | best-effort | |
| intelligest-proxy | irs | rpc | sync | | routing decision |
| capacitor / the-well | irs | metrics | async | | capacity and network health |
| intelligest-proxy | origin | backbone | async | best-effort | forwarded stream |
| origin transcoder | edge pops | backbone | async | best-effort | HLS variants |
| edge pop | viewer | https (hls) | sync | | |
| origin | vod archive | internal | async | | |
| viewer client | chat edge | websocket / irc | async | at-least-once (acks) | |
| chat edge | pubsub | internal | async | at-most-once | fan-out between edges |
| chat edge | clue | rpc | sync | | ban, subscription checks |
| chat edge | room | rpc | sync | | membership |
| client | helix | https | sync | | |
| helix | go services | twirp | sync | | |
| services | event bus (sns) | sns | async | at-least-once | |
| event bus | eventsub | webhook | async | at-least-once | developers |
| services / clients | spade | http | async | | ~3M events/sec |
| spade | tahoe | kinesis / s3 | async | | |
| services | dynamodb / postgres | native | sync | | |

## Failure modes, incidents, tradeoffs the source discusses
- Hot channel on shared chat host: a 20,000-viewer stream slowed its machine "degrading performance across all channels on that server, affecting one-eighth of Twitch's entire chat infrastructure"; connection times over a minute. Source: breaking-the-monolith.
- Failed extractions: Sidekiq/RabbitMQ bloated the monolith; NodeJS hit language bugs; Python/Tornado interim; Go pubsub doubled per-thread performance. Source: breaking-the-monolith.
- Static routing plan vs live reality: "The computed routing solution is static and is not able to handle unexpected traffic patterns and system fluctuations in real time." Source: ingest.
- Origin failure handling: "IRS can automatically direct new live video streams to an unaffected origin to achieve high availability." Source: ingest.
- Segment misalignment breaks players: Chromecast "playback pauses when it receives HLS streams with misaligned segments"; independent FFmpeg encoders cannot align IDR frames. Source: transcoder.
- Redundant compute: N FFmpeg instances mean N decoders and scalers; "scaling is a very computationally expensive step". Source: transcoder.
- Cost gate: only 2-3% of channels transcoded before in-house hardware transcoder. Source: search summary of Twitch posts.
- Mixed estate: bare-metal PoPs plus growing AWS; 2,000+ AWS accounts by 2023. Source: overview, state-of-engineering.

## Unknowns
- Chat storage and history
- Exact origin count and backbone capacity
- Current transcoder hardware details
- EventSub delivery guarantees and retry policy

## Candidates
- New kinds: none strictly new; sightings: media-router (2nd: ingest proxy), control-plane-coordinator (7th), cdn (7th), network-fabric (4th), realtime-gateway (8th), pubsub-topic (3rd), webhook-endpoint (2nd: EventSub), api-gateway (11th), worker (13th), object-store (13th), monitoring (11th), stream (13th), data-warehouse (9th), search-index (7th), ml-inference (4th), point-of-presence group (3rd), provider group (2nd)
- New properties on existing kinds: media-router.role (ingest, sfu, distribution); worker.multiOutput, accelerator (2nd); control-plane-coordinator.stateful, optimisation (static, dynamic); cdn.protocol (hls, dash); realtime-gateway.protocols (websocket, irc)
- New edge properties: segmentAligned (boolean); rerouteOnFailure (boolean)
- New requirement paths: availability.rerouteNewSessionsOnly (boolean); media.transcodeAllStreams (boolean)
- New rules:
  - shared-host-per-channel-without-isolation: realtime-gateway assigning channels randomly to hosts with no per-channel isolation or hashing while traffic.skew heavy-tail (2nd sighting after Discord/Slack)
  - ingest-without-routing-controller: media-router role ingest sending to origins with no control-plane-coordinator making capacity-aware decisions
  - transcode-variants-without-alignment: worker producing multiple variants with segmentAligned false
  - origin-failure-without-reroute: origin PoPs with no rerouteOnFailure path from ingest
  - static-optimiser-without-realtime-feedback: control-plane-coordinator optimisation static and no monitoring in-edges
