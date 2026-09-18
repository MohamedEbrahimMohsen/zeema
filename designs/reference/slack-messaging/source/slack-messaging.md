# Intake: Slack real-time messaging (channel servers, Flannel edge cache, job queue, cells)

## Source
- Primary: https://slack.engineering/real-time-messaging/ (official, 2023: CS, GS, AS, PS, CHARM, Consul, Envoy)
- Primary: https://slack.engineering/flannel-an-application-level-edge-cache-to-make-slack-scale/ (official, 2017)
- Primary: https://slack.engineering/scaling-slacks-job-queue/ (official, 2017: Redis queue failure, Kafkagate, JQRelay)
- Primary: https://slack.engineering/slacks-migration-to-a-cellular-architecture/ (official, 2023: AZ cells, Envoy/xDS drain)
- Primary: https://slack.engineering/unified-grid-how-we-re-architected-slack-for-our-largest-customers/ (official, 2024: Vitess sharding by channel, org vs workspace)
- Verified by: five official Slack engineering posts
- Confidence: high
- Date of source: 2017-2024

## System in three lines
Team messaging where every message must reach every subscribed client worldwide within about half a second over persistent WebSockets. A Hacklang web application owns business logic and persistence in Vitess; a separate Java real-time stack (stateful Channel Servers on a consistent hash ring, Gateway Servers holding WebSockets, Presence Servers) fans messages out; Flannel edge caches slim client bootstrap; a Kafka-fronted Redis job queue runs deferred work. Hard because state is in memory on purpose, tenants are sharded per workspace and later per channel, and a single availability zone's gray failure once degraded everything.

## Scale (only if stated)
- Users / DAU: not stated (public figures elsewhere: millions of concurrent users)
- Requests per second: Flannel 600K client queries/sec; job queue 33,000 jobs/sec peak
- Data volume: 1.4B jobs/day; Kafka 16 brokers, 32 partitions per topic, RF 3, 2-day retention; 1,600 partitions with heartbeat canaries
- Message throughput: tens of millions of concurrent WebSocket sessions; ~16M channels served per Channel Server host at peak; Flannel 4M simultaneous connections
- Latency: global message delivery within 500 ms; Channel Server replacement ready in under 20 s; AZ drain propagation in seconds, SLA 5 minutes
- Bootstrap payload: 7x smaller for a 1.5K-user team, 44x for a 32K-user team with Flannel

## Requirements stated or clearly implied
- Availability target: drain a bad AZ within 5 minutes; contain failures to one AZ
- Consistency: Vitess strongly consistent with single primary per shard; Kafkagate favours availability, acks leader only; JQRelay advances offset only after Redis write (no job loss)
- Latency target: 500 ms global delivery
- Ordering needs: per channel (channel server holds history in memory)
- Replay or reprocessing: Kafka 2-day retention allows replay into Redis; Channel Server state rebuilt on replacement
- Retention: message history in Vitess (indefinite per plan); job queue 2 days in Kafka
- Compliance / residency: not stated in these posts
- Multi-tenancy: workspace, org (Enterprise Grid), and shared channels across orgs

## Boundaries
- Regions / zones: multiple AWS regions; cells = availability zones with siloed full stacks; Gateway Servers and Flannel at edge points of presence
- Trust zones: clients -> Envoy (TLS termination) -> edge (Flannel, Gateway Servers) -> core (webapp, Admin Servers, Channel Servers) -> datastores
- Named subsystems: Webapp (Hacklang), RTM stack (CS, GS, AS, PS, CHARM), Flannel, Job queue (Kafkagate, Kafka, JQRelay, Redis, workers), Data (Vitess/MySQL, Memcached), Service discovery (Consul), Traffic (Envoy, Rotor xDS)
- Group kind needed: **cell** (AZ-scoped siloed deployment), 2nd sighting after Shopify pods

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Desktop / mobile / web clients | Persistent WebSocket; lazy-load metadata via Flannel | Electron, iOS, Android, web | desktop-client, mobile-client, web-client | connection: persistent-websocket |
| 2 | Envoy edge load balancers | TLS termination, load balancing, AZ weighted routing via xDS | Envoy | load-balancer | tlsTermination: true; weightedClusters: true |
| 3 | Rotor | In-house xDS control plane; RTDS weights, 1% granularity drain | in-house | control-plane-coordinator | |
| 4 | Flannel | Application-level edge cache of user/channel/bot metadata at PoPs; team-affine consistent hashing; consumes event stream over WebSocket | in-house (Go) | cache (edge) | connections: 4000000; qps: 600000; affinity: team |
| 5 | Gateway Servers (GS) | Hold WebSocket subscriptions and user info; multi-region | in-house (Java) | realtime-gateway | stateful: true; multiRegion: true |
| 6 | Channel Servers (CS) | Stateful in-memory channel history and fan-out; consistent hash ring | in-house (Java) | app-server (stateful) | stateless: false; shardingStrategy: consistent-hash; channelsPerHost: 16000000 |
| 7 | CHARM | Consistent hash ring managers; replace unhealthy CS in under 20 s | in-house | sharding-coordinator | recoverySeconds: 20 |
| 8 | Admin Servers (AS) | Stateless bridge from webapp to CS | in-house (Java) | app-server | stateless: true |
| 9 | Presence Servers (PS) | In-memory online status; users hashed across PS; pub/sub | in-house (Java) | app-server (stateful) | stateless: false |
| 10 | Consul | Service discovery and locks (JQRelay), watch API for rate limits | HashiCorp Consul | service-registry + coordination-service | |
| 11 | Webapp | Hacklang monolith: business logic, auth, persistence | HHVM/Hack | app-server | |
| 12 | Vitess / MySQL | Message and workspace data; sharded by workspace, later by channel id | Vitess, MySQL | sql-database + database-proxy | sharded: true; shardKey: channel_id |
| 13 | Memcached | Object cache in front of MySQL | Memcached | cache | |
| 14 | Kafkagate | Go HTTP service enqueueing jobs to Kafka; waits for leader ack only | in-house (Go) | app-server | stateless: true; ackMode: leader |
| 15 | Kafka (job queue) | Durable job storage; 16 brokers, 32 partitions/topic, RF3, 2-day retention | Apache Kafka | stream / event-log | retentionDays: 2; replicationFactor: 3 |
| 16 | JQRelay | Go relay Kafka -> Redis; Consul lock per partition; rate limit; retries; offset advance after Redis write | in-house (Go) | worker (relay) | exactlyOneConsumerPerPartition: true |
| 17 | Redis (job queue) | Short-term job store with metadata; formerly the whole queue | Redis | queue | persistence: false |
| 18 | Job workers | Execute deferred tasks (indexing, notifications, ...) | in-house | worker | |
| 19 | Search index | Async indexing via job queue | not named in these posts | search-index | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | envoy | wss/https | sync | | tls termination |
| envoy | flannel | ws | sync | | team-affine hash |
| flannel | webapp | https | sync | | bootstrap fill on start |
| webapp / event bus | flannel | ws | async | at-most-once | real-time metadata updates |
| flannel | client | ws | async | | proactive push of mentioned users |
| client | gateway-server | wss | async | at-least-once (acks) | subscriptions |
| client | webapp | https | sync | | send message |
| webapp | vitess | mysql | sync | | persist |
| webapp | memcached | memcached | sync | | |
| webapp | admin-server | rpc | sync | | |
| admin-server | channel-server | rpc | sync | | consistent hash lookup |
| channel-server | gateway-servers (all subscribed) | rpc | async | at-most-once | fan-out, 500 ms global |
| gateway-server | client | ws | async | | |
| charm | consul | http | sync | | ring config |
| admin/channel servers | consul | http | sync | | discovery |
| client | presence-server (via gs) | ws | async | | transient, not persisted |
| webapp | kafkagate | http post | sync | | topic, partition, content |
| kafkagate | kafka | kafka | async | leader-ack | availability over consistency |
| kafka | jqrelay | kafka | async | at-least-once | offset after redis write |
| jqrelay | consul | consul lock | sync | | one relay per partition |
| jqrelay | redis | redis | sync | | rate limited |
| redis | job-workers | redis | async | at-least-once | |
| rotor | envoy | xds/rtds | async | | weights in seconds |
| any service | same-AZ services only | rpc | sync | | cell rule |

## Failure modes, incidents, tradeoffs the source discusses
- Redis queue lock-up: DB contention slowed workers, Redis hit max memory, "even when the underlying database contention was resolved, the job queue remained locked up". Source: job-queue.
- Negative feedback: more workers meant more Redis polling; dequeue cost proportional to queue length; "little operational headroom". Source: job-queue.
- Undefined QoS: engineers avoided the queue because guarantees were unclear. Source: job-queue.
- Durability vs latency: Kafkagate acks on leader only, "a bias towards availability over consistency"; loss prevented downstream by offset discipline. Source: job-queue.
- Gray failure 2021-06-30: one AZ network link; "different components have different views of the availability of the system"; needed "a button that told all our systems 'This AZ is bad; avoid it.'" Source: cellular.
- Cells: "each service only communicates with services within its AZ"; strongly consistent datastores (Vitess single primary) are the hard exception. Source: cellular.
- DNS cannot express partial drain; solved in Envoy xDS, Consul and custom interfaces. Source: cellular.
- Channel server replacement causes "elevated latency in message delivery" for affected teams during the under-20 s transition. Source: real-time-messaging.
- Bootstrap payload growth with team size; Flannel lazy loading cut it 7x-44x; cost is small autocomplete latency mitigated by prefetch. Source: flannel.
- Workspace-keyed sharding blocked org-wide features; Vitess resharding by channel id removed the need to know the workspace; long tail of users in hundreds of workspaces capped at 50. Source: unified-grid.

## Unknowns
- Search index product
- Exact WebSocket session count today
- Cross-region replication for Vitess
- Notification push path to mobile

## Candidates
- New kinds: none strictly new; sightings: realtime-gateway (4th), sharding-coordinator (2nd: CHARM), service-registry (2nd: Consul), control-plane-coordinator (3rd: Rotor), event-log/stream (6th), queue (5th), worker (9th), database-proxy (6th), load-balancer (7th), desktop-client (2nd)
- New group kind: cell (2nd sighting; AZ-scoped here, tenant-scoped at Shopify). Needs `scope` property: az | tenant | region
- New properties on existing kinds: cache.tier (core, edge); cache.affinity (none, team, user); app-server.shardingStrategy (2nd sighting); stream.ackMode (leader, quorum, all); queue.persistence (boolean); worker.exclusiveConsumer (boolean); load-balancer.weightedRouting (boolean)
- New edge properties: sameCellOnly (boolean); ackMode
- New requirement paths: availability.drainMinutes (integer); latency.deliveryMs (end-to-end fan-out); availability.blastRadius (2nd sighting)
- New rules:
  - cross-cell-call: sync edge between nodes in different cell groups while availability.blastRadius is cell
  - queue-without-durable-front: queue with persistence false receiving producer edges directly (no stream/event-log in front) at high rps (Redis lock-up)
  - producer-leader-ack-without-downstream-offset-guard: stream ackMode leader and consumer worker lacking exclusiveConsumer/offset discipline (informational)
  - stateful-hash-ring-without-ring-manager: app-server shardingStrategy consistent-hash with no sharding-coordinator node
  - drain-target-without-weighted-routing: availability.drainMinutes set and load-balancer weightedRouting false
  - edge-cache-without-invalidation-stream: cache tier edge with no async in-edge from core (stale metadata)
