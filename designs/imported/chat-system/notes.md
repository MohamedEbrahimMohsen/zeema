# Chat system: import notes

A chat service (Alex Xu, chapter 12). Clients keep a WebSocket to stateful chat servers and
reach stateless API servers through a load balancer; presence servers track who is online,
notification servers push alerts, and state lives in key-value stores.

- Source: *System Design Interview - An Insider's Guide* (Alex Xu), Chapter 12 "Design A Chat
  System", pages 178-199. Figure imported: **Figure 12-8**, the adjusted high-level design
  (page 186), which the chapter introduces as everything put together.
- Format: `book-figure`. The book is copyrighted, so `source/chat-system.md` holds the citation
  and a factual transcription of the figure (boxes, boundaries, arrows) and nothing else.
- Counts: 9 boxes, 2 boundaries, 10 drawn lines of which 3 are double-headed = 13 directed
  edges. The design has 9 nodes, 2 groups, 13 edges. `check_fidelity.py` passes.

## Mapping

| Source text | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| User | user | web-browser | client | close |
| Load balancer | load-balancer | load-balancer-tier | load-balancer | close |
| Chat servers | chat-servers | container-service | app-server | close |
| Presence servers | presence-servers | container-service | app-server | close |
| Notification servers | notification-servers | container-service | app-server | close |
| API servers | api-servers | container-service | app-server | close |
| KV store (left) | kv-store | nosql-store | nosql-database | close |
| KV store (centre) | kv-store-2 | nosql-store | nosql-database | close |
| KV store (right) | kv-store-3 | nosql-store | nosql-database | close |

Groups: `real-time-service` (`system`, label "Real time service") holds Chat servers and
Presence servers; `kv-tier` (`system`, no label, the boundary carries no text) holds the three
KV store boxes.

No assumed mappings: every box is generic and every generic has a default-provider component.
No components or kinds were added.

## Assumptions

- **Arrows that end on a boundary.** Five arrow ends land on the "Real time service" dashed
  box and four on the unlabelled KV box, not on any single box inside them. Edges take node
  ids, so each end was attached to the box it is drawn under (measured on the image):
  - the elbow from API servers and the line down to the KV tier that both meet the boundary
    directly under **Chat servers** go to `chat-servers`;
  - the elbow and the line that meet it directly under **Presence servers** go to
    `presence-servers`; Figures 12-16 and 12-17 draw exactly those two calls as
    API servers to Presence servers to KV store, which corroborates the reading;
  - the **ws** line lands on the top edge in the gap between the two boxes; it went to
    `chat-servers` because the paragraph explaining Figure 12-8 says the client maintains a
    persistent WebSocket connection to a chat server for real-time messaging.
- **Which KV store.** The four arrowheads on the KV boundary are spread across its top edge
  and none is above a KV store box, so each was attached to the nearest box: Notification
  servers to the left one, API servers to the centre one, Chat servers and Presence servers to
  the right one. The figure does not say which store each tier writes to, only that each tier
  writes to that layer.
- **WebSocket direction and mode.** The double-headed ws arrow became two edges:
  `user -> chat-servers` sync (the client sends) and `chat-servers -> user` async (the server
  pushes, which is the reason the chapter picks WebSocket over polling).
- **Protocols.** `http` and `ws` come from the two arrow labels. The unlabelled server-to-server
  arrows use `http`; the chapter says everything except real-time messaging is
  request/response over HTTP. `kv` is the protocol used for an unnamed key-value store in the
  other imports of this book.
- **props.** Only two, both stated next to the figure: `chat-servers.stateless: false` (the
  chapter states the chat service is the only stateful service, because each client maintains
  a persistent network connection to a chat server) and `user.persistentConnection: true`
  (the sentence explaining Figure 12-8). Presence servers were left stateless because the
  chapter names the chat service as the *only* stateful service, even though Figure 12-16
  shows a ws connection to them as well.
- **requirements.** Only `traffic.readWriteRatio: 1`, from the storage section, which states
  the read to write ratio is about 1:1 for 1 on 1 chat apps. The chapter states no SLA, no
  latency target, no region count and no replay promise.
- **KV store model.** The chapter recommends key-value stores, which is `nosql-store`'s default
  `model`, so no `props` were written.

## What the later figures say about boxes drawn in Figure 12-8

The deep-dive figures are step-numbered sequences over the same system and were **not** merged
into this design. What they add about a box that Figure 12-8 draws:

- **Figure 12-11 (service discovery).** Login goes User A to Load balancer to API servers to
  Service discovery (Zookeeper), which returns a chat server; the client then opens the
  WebSocket to that chat server. Chat servers appear as "Chat server 1..N" instances of the
  one Chat servers box. Service discovery is a box Figure 12-8 does not draw.
- **Figure 12-12 (1 on 1 flow).** Chat server 1 obtains a message id from an ID generator,
  writes to a Message sync queue, and the message is stored in the KV store; PN servers handle
  the offline case. Confirms the Chat servers to KV store write of Figure 12-8. ID generator,
  Message sync queue and PN servers are boxes Figure 12-8 does not draw (the notification
  servers box is its counterpart for push).
- **Figure 12-13 (multi-device sync).** Two devices of one user each hold a WebSocket to the
  same chat server and each keeps `cur_max_message_id`, reading new messages from the KV store.
  Supports `user.persistentConnection: true` and `chat-servers.stateless: false`.
- **Figures 12-14, 12-15 (group chat).** One message is copied into a message sync queue per
  recipient; the group is capped at 100 members in the requirements and at 500 in the WeChat
  example. Nothing about a Figure 12-8 box beyond the chat servers' fan-out.
- **Figures 12-16, 12-17 (login, logout).** User A and Presence servers exchange over a ws
  connection, and Presence servers write `{status, last_active_at}` to the KV store. This is
  why the second API elbow and the second KV line were attached to `presence-servers`.
- **Figure 12-18 (heartbeat).** The client sends a heartbeat every 5 seconds and is marked
  offline after 30 seconds without one. No property expresses this; recorded as a gap.
- **Figure 12-19 (status fanout).** Presence servers hold one pub/sub channel per friend pair.
  This makes the Presence servers box internally a message broker, but no such box is drawn in
  Figure 12-8 and none was added.

## Observations (not encoded, Figure 12-8 does not draw them)

- No service discovery / Zookeeper box, no ID generator, no message sync queue and no
  third-party push provider (APNs / FCM) in Figure 12-8, although the chapter discusses all
  four. Figure 12-7 additionally draws Service discovery, Authentication service, Group
  management and User profile as separate stateless services; Figure 12-8 collapses them into
  the API servers box, and this design follows Figure 12-8.
- The chapter says generic data (user profile, settings, friends list) belongs in a relational
  database, but no relational database is drawn; all three storage boxes are KV stores.
- Nothing in the figure shows backup, encryption at rest or credential rotation for the KV
  tier, which is what the one rule finding below is about.

## Gaps

Recorded in `mapping.yaml` under `gaps` (not copied into `docs/schema-gaps.md`; the parent
session owns that file):

1. Arrows that terminate on a boundary rather than on a box cannot be expressed; edges take
   node ids only.
2. No requirement path for daily active users, concurrent connections, group fan-out size or
   message payload size, so 50M DAU, 1M connections, the 100-member cap and the 100,000
   character limit are not encoded.
3. No retention or capacity path for chat history stored forever.
4. The User box is drawn with a laptop and a phone, but `client.platform` is a single required
   enum, so one had to be chosen.
5. No property or requirement path for a liveness/heartbeat interval (5 seconds, 30 second
   timeout).
6. One bidirectional WebSocket becomes two directed edges with different modes; the format
   cannot say that the two share one connection.

## Rules fired

`node .claude/tools/validate.mjs --design designs/imported/chat-system/design.yaml`

| Rule | Severity | Subject |
|---|---|---|
| credentials-without-rotation | warning | design |

Components added: none. Kinds added: none.

## Consolidation pass, 2026-09-08

The parent session re-mapped this design after the import wave, when generic components were
added to the catalogue for boxes that name no product. Mappings that had to guess a vendor
(and any single-box dashed border that had been read as a boundary) were corrected; the
picture itself is unchanged. `mapping.yaml` holds the current component for every box.
