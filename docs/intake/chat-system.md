# Intake: Generic chat system (Xu vol 1 ch 12), cross-referenced with WhatsApp, Slack and Discord cards

## Source
- Primary: Alex Xu, System Design Interview vol 1, chapter 12 "Design a chat system"; public chapter summary https://levendlee.com/2024/01/14/chapter-12-design-a-chat-system/ and author's public write-up https://blog.bytebytego.com/p/ep-42-designing-a-chat-application
- Cross-references (already carded, verified): whatsapp-messaging (Erlang chat servers, offline mailbox, 1M connections per host), slack-messaging (channel servers on hash ring, gateway servers, presence), discord-messages (session and guild processes, message store)
- Verified by: canonical textbook chapter; production evidence in three linked cards
- Confidence: high as a canonical design
- Date of source: 2020 (book)

## System in three lines
One-to-one and group messaging where each client keeps a WebSocket to a stateful chat server chosen through service discovery, messages get time-sortable ids and are written to a per-recipient sync queue and a key-value store, then forwarded to the recipient's chat server if online or handed to push notifications if not. Presence servers track heartbeats and fan out online status; multiple devices sync from the store using a per-device high-water mark. Hard because chat servers are stateful, group fan-out multiplies writes, and ordering plus multi-device consistency must hold across reconnects.

## Scale (only if stated)
- Users / DAU: 50M DAU (book assumption)
- Requests per second: not stated
- Data volume: not stated
- Message throughput: not stated
- Production anchors: WhatsApp 1M connections per server and 40B messages/day; Slack tens of millions of concurrent WebSockets with 500 ms global delivery; Discord 5M concurrent users (2017)

## Requirements stated or clearly implied
- Availability target: chat servers replaceable; clients reconnect via discovery
- Consistency: per-conversation ordering via sortable message ids; multi-device consistency via cur_max_message_id; store-and-forward for offline
- Latency target: real-time delivery over persistent connections
- Ordering needs: time-sortable ids from an id generator or local sequence
- Replay or reprocessing: clients pull from KV store above their high-water mark
- Retention: chat history in KV store; not quantified
- Compliance / residency: not stated (end-to-end encryption out of scope)
- Presence: heartbeat every N seconds; offline after X missed beats

## Boundaries
- Regions / zones: not stated; discovery picks by geography and capacity
- Trust zones: clients -> load balancer -> stateless API (auth, profile) and stateful chat servers; push providers external
- Named subsystems: Stateless API servers, Service discovery (Zookeeper), Chat servers, Presence servers, Notification servers, Message sync queues, KV store, ID generator

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Clients (multi-device) | Persistent WebSocket; track cur_max_message_id per device | mobile, web, desktop | mobile-client, web-client, desktop-client | connection: persistent-websocket |
| 2 | Load balancer | Front door for HTTP and WebSocket | generic | load-balancer | |
| 3 | API servers | Login, signup, profile, group management (stateless) | in-house | app-server | stateless: true |
| 4 | Service discovery | Recommends best chat server by geography and capacity | Apache Zookeeper | service-registry + coordination-service | |
| 5 | Chat servers | Stateful WebSocket termination; receive, persist, forward messages | in-house | realtime-gateway | stateless: false |
| 6 | Presence servers | Heartbeats, online/offline, fan-out to friends (pub/sub) | in-house | app-server (stateful) | heartbeatSeconds: n |
| 7 | Notification servers | Push to offline users via APNs/FCM | in-house | notification-service | |
| 8 | ID generator | Unique, time-sortable message ids | Snowflake-class | id-generator | sortableByTime: true |
| 9 | Message sync queue (per recipient) | Inbox buffer per user; small groups fan out into each member's queue | queue | queue | role: offline-mailbox; perUser: true |
| 10 | KV store | Chat history (HBase, Cassandra); horizontal sharding, low latency | HBase, Cassandra | nosql-database | model: wide-column |
| 11 | Push providers | APNs, FCM | third parties | third-party-api | |
| 12 | Group service | Membership; large groups switch to pull model | in-house | app-server | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | api servers (via lb) | https | sync | | auth, profile |
| client | service discovery (via api) | https | sync | | choose chat server |
| client | chat server | websocket | async | at-least-once with acks | persistent |
| chat server | id generator | rpc | sync | | message id |
| chat server | sync queue (recipient) | enqueue | async | at-least-once | |
| chat server | kv store | write | sync | | persist |
| chat server | chat server (recipient's) | rpc | async | | forward if online |
| chat server | notification servers | rpc | async | at-most-once | recipient offline |
| notification servers | apns / fcm | https | async | best-effort | |
| client | presence server | websocket heartbeat | async | | |
| presence server | friends' chat servers | pub/sub | async | at-most-once | status fan-out |
| client (on login) | kv store (via chat server) | read | sync | | messages above cur_max_message_id |
| group service | chat servers | rpc | async | | small group fan-out |
| client (large group) | kv store | pull | sync | | pull model |

## Failure modes, incidents, tradeoffs the source discusses
- Stateful vs stateless split so only chat and presence servers hold connections; discovery routes around failed servers. Source: chapter summary.
- KV over relational: "K-V allows easy horizontal sharding" and "provides low latency to access". Source: chapter summary.
- Group fan-out cost: small groups fan out to each sync queue; large groups pull to avoid "duplicate message for each member". Source: chapter summary.
- Presence fan-out storm: heartbeat and status changes multiplied by friend count; book limits to online friends and groups. Source: chapter summary.
- Multi-device sync relies on per-device high-water mark against the store. Source: chapter summary.
- Production incidents from linked cards: WhatsApp 2014 reconnect storm through pg2; Slack channel-server replacement latency; Discord presence crash stampede on guild registry.

## Unknowns
- Exact heartbeat interval and offline threshold
- Sync queue product (book abstract)
- Encryption and retention policies

## Candidates
- New kinds: none; sightings: realtime-gateway (11th), service-registry (5th), coordination-service (12th), nosql-database (23rd), id-generator (4th), queue offline-mailbox (14th), notification-service (6th), third-party-api (8th)
- New properties on existing kinds: realtime-gateway.stateless false (already), discovery (registry, dns); queue.perUser (boolean); app-server.role presence; id-generator.sortableByTime (2nd sighting)
- New edge properties: heartbeatSeconds; pullModelThreshold (group size)
- New requirement paths: messaging.multiDeviceSync (boolean); presence.fanoutLimited (boolean)
- New rules (reinforcing whatsapp, slack, discord candidates):
  - connection-server-without-push-fallback (2nd sighting)
  - reconnect-stampede-without-guard (3rd sighting)
  - large-group-push-fanout: group fan-out edges with push for groups above pullModelThreshold
  - multi-device-without-highwater-mark: clients with multi-device requirement and no store-backed sync read edge
  - stateful-gateway-without-discovery: realtime-gateway with no service-registry or coordinator edge (clients cannot re-route)
