# Intake: Multi-channel notification system (Xu vol 1 ch 10) with Uber RAMEN real-time push

## Source
- Primary: Alex Xu, System Design Interview vol 1, chapter 10 "Design a notification system"; public chapter summary https://levendlee.com/2024/01/14/chapter-10-design-a-notification-system/ and search summaries
- Primary: https://www.uber.com/us/en/blog/real-time-push-platform/ (official Uber, 2020: RAMEN, Fireball, Streamgate, StreamgateFE, Redis + Cassandra)
- Primary: https://www.uber.com/blog/ubers-next-gen-push-platform-on-grpc/ (official Uber, 2021: SSE to gRPC bidirectional streaming, Helix + ZooKeeper)
- Verified by: canonical textbook chapter + two official Uber engineering posts
- Confidence: high
- Date of source: 2020-2024

## System in three lines
Accepts notification requests from many internal services and delivers them over push (APNs, FCM), SMS (Twilio class) and email (SendGrid class) through per-channel queues and stateless workers, with templates, user preferences, per-user rate limits, a notification log for retries, and dedup by event id. Uber's RAMEN adds the in-app real-time channel: Fireball decides when to push, Streamgate holds millions of persistent connections (SSE then gRPC streams) sharded by Ringpop then Helix, and undelivered messages wait in Redis and Cassandra until TTL. Hard because third-party providers rate-limit and fail, at-least-once queues duplicate, and real-time channels need per-message priority, TTL and acknowledgements.

## Scale (only if stated)
- Users / DAU: not stated
- Requests per second: book example 10M push, 1M SMS, 5M email per day; RAMEN peak 70,000 QPS with 600,000 concurrent connections, later 1.5M+ connections and 250,000+ messages/sec
- Data volume: not stated
- Message throughput: acknowledgements every 30 s per connection (SSE era); gRPC p95 connect latency improved at least 45%; push success up 1-2%
- Reliability: "99.99% server-side reliability" (RAMEN)
- Payload: messages over 1 MB caused heartbeat timeouts on 3G; gzip cut 20-50 s downloads to 5 s

## Requirements stated or clearly implied
- Availability target: notification path must survive provider outages via retries and log; RAMEN 99.99% server-side
- Consistency: at-least-once from queues, exactly-once effect via dedup by event id / idempotency key; RAMEN "most recent message of type suffices" dedup; sequence-number acknowledgements
- Latency target: transactional notifications near real time; RAMEN messages have TTL from seconds to 30 minutes
- Ordering needs: sequence numbers per connection; priority buckets (high, medium, low)
- Replay or reprocessing: notification log allows re-send; undelivered RAMEN messages persisted until TTL
- Retention: log retained for retries and analytics; RAMEN TTL max 30 min
- Compliance / residency: opt-in/opt-out settings; provider credentials (app keys, secrets) protected
- Provider protection: rate limit per user and per provider to avoid bans and bursts

## Boundaries
- Regions / zones: Cassandra cross-region replication for undelivered messages (RAMEN)
- Trust zones: internal services -> notification API -> queues/workers -> third-party providers (external); mobile devices -> StreamgateFE -> Streamgate
- Named subsystems: Notification servers (API, validation, template, settings), Per-channel queues and workers, Providers (APNs, FCM, SMS, email), Notification log and analytics, Rate limiter; RAMEN: Fireball, API gateway, StreamgateFE, Streamgate, Helix/ZooKeeper, Redis, Cassandra

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Producer services | Trigger notifications (orders, payments, marketing) | in-house | app-server | |
| 2 | Notification servers | REST API, validation, auth (app key/secret), fetch user and template, enqueue per channel | in-house | app-server + api-gateway | stateless: true |
| 3 | Cache | User info, device tokens, templates | Redis/memcached | cache | |
| 4 | Database | Users, devices, settings (opt-in), notification log | relational | sql-database | |
| 5 | Per-channel queues | iOS push, Android push, SMS, email queues; buffer and parallelism | Kafka/RabbitMQ/SQS | queue | topicPerChannel: true |
| 6 | Channel workers | Thin stateless dispatchers per channel; retry and requeue on provider failure | in-house | worker | |
| 7 | APNs / FCM | Push providers; ~1,000 tokens per HTTP/2 request (FCM) | Apple, Google | third-party-api | |
| 8 | SMS provider | Twilio, Nexmo | third-party | third-party-api | |
| 9 | Email provider | SendGrid, Mailchimp | third-party | third-party-api | |
| 10 | Rate limiter | Per-user notification frequency; per-provider throttling | in-house | rate-limiter | scope: user, provider |
| 11 | Dedup store | Event id / idempotency key seen-set | Redis | cache | |
| 12 | Analytics / event tracking | Opens, clicks, delivery outcomes | stream + warehouse | stream + data-warehouse | |
| 13 | Fireball (RAMEN) | Decides when to push from system events, timers, geo events; calls API gateway | in-house (Uber) | app-server (event-driven) | |
| 14 | StreamgateFE | Reverse proxy routing devices to the right Streamgate worker via topology (Helix spectator) | in-house (Uber) | load-balancer (sticky) | stickyRouting: true |
| 15 | Streamgate | Netty service holding persistent connections (SSE then gRPC), sequence numbers, acks; Ringpop then Helix participant | in-house (Uber) | realtime-gateway | connections: 1500000 |
| 16 | Helix + ZooKeeper | Partition assignment and topology for Streamgate | Apache Helix, ZooKeeper | sharding-coordinator + coordination-service | |
| 17 | Redis (RAMEN) | Hot cache of pending messages | Redis | cache | |
| 18 | Cassandra (RAMEN) | Durable, cross-region store of undelivered messages until TTL | Apache Cassandra | nosql-database | replication: multi-region; ttl: 30m max |
| 19 | Mobile clients | Persistent stream, acks every 30 s or on reconnect; gzip payloads | Uber apps | mobile-client | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| producer service | notification api | https | sync | | validated, authenticated |
| notification api | cache / db | native | sync | | user, devices, template, settings |
| notification api | rate limiter | in-process | sync | | per user |
| notification api | channel queue | queue | async | at-least-once | one per channel |
| channel queue | channel worker | queue | async | at-least-once | |
| channel worker | dedup store | redis | sync | | event id check |
| channel worker | provider (apns/fcm/sms/email) | https | sync | | retry on failure, requeue |
| channel worker | notification log | db | sync | | status |
| provider | device / phone / inbox | provider network | async | best-effort | |
| worker / provider callbacks | analytics | events | async | | |
| system events | fireball | kafka/rpc | async | | triggers |
| fireball | api gateway -> streamgate | rpc | sync | | with device context |
| streamgate | redis | redis | sync | | pending |
| streamgate | cassandra | cql | async | at-least-once | undelivered, ttl |
| device | streamgatefe | https / grpc | sync | | sticky route |
| streamgatefe | streamgate | grpc | sync | | topology from helix |
| streamgate | device | sse / grpc stream | async | at-least-once with acks | sequence numbers |
| device | streamgate | ack rpc / stream | async | | every 30 s or reconnect |
| helix | streamgate | zk | async | | partitions |

## Failure modes, incidents, tradeoffs the source discusses
- Duplicates from at-least-once queues and worker timeouts; dedup by event id or idempotency key. Source: book summary.
- Provider failure: persist notification data and retry; requeue failed deliveries. Source: book summary.
- Provider abuse protection: rate limit per user and provider to avoid bursts and bans. Source: book summary.
- SSE limits: unidirectional, acks via separate RPC every 30 s, no RTT measurement, no binary; "The simplicity of the protocol allowed writing clients in many different languages" but drove the gRPC migration. Source: Uber RAMEN.
- Priority and TTL per message type; "most recent message of type suffices" dedup; high priority gets server retries. Source: Uber RAMEN.
- Large payloads: >1 MB messages caused heartbeat timeouts on 3G/Edge; gzip fixed. Source: Uber gRPC.
- Thread safety: StreamObserver not thread-safe, "synchronize the onNext method". Source: Uber gRPC.
- Graceful shutdown must cancel active streams to avoid orphaned timers. Source: Uber gRPC.
- Control plane swap: Ringpop replaced by Helix + ZooKeeper for sticky routing. Source: Uber gRPC.
- Rejected alternatives: raw HTTP/2 "far more difficult" across platforms; Reactive Streams less mature. Source: Uber gRPC.

## Unknowns
- Book: provider-specific rate limits and batch sizes
- RAMEN: Kafka topics and Fireball rules engine details
- Cassandra replication factor and regions
- Analytics pipeline products

## Candidates
- New kinds: none; sightings: notification-service (4th, as the whole system), third-party-api (7th), queue (12th), worker (17th), rate-limiter (6th), realtime-gateway (10th), sharding-coordinator (4th: Helix), coordination-service (11th), nosql-database (22nd), load-balancer sticky (14th)
- New properties on existing kinds: notification-service.channels (push, sms, email, in-app), dedupKey (event-id), templateStore; queue.topicPerChannel (boolean); realtime-gateway.protocol (sse, websocket, grpc-stream), ackIntervalSeconds, sequenceNumbers (boolean); third-party-api.role notification (2nd), batchSize
- New edge properties: ttlSeconds; priority (high, medium, low); ack (boolean); compressed (boolean)
- New requirement paths: delivery.exactlyOnceEffect (boolean); notification.userRateLimit (boolean); providers.isolated (boolean)
- New rules:
  - notification-without-dedup: at-least-once channel queue to provider with no dedup store while delivery.exactlyOnceEffect true
  - provider-without-per-user-rate-limit: third-party-api notification edge with no rate-limiter while notification.userRateLimit true
  - shared-queue-across-channels: single queue feeding all providers while providers.isolated true (SMS outage blocks push)
  - realtime-push-without-ttl-or-priority: realtime-gateway message edges lacking ttlSeconds or priority
  - streaming-payload-without-compression: stream edge to mobile-client with large payloads and compressed false (informational)
  - failed-delivery-not-logged: worker to provider edge with no notification-log write (retry impossible)
