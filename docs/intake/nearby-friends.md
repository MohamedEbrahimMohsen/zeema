# Intake: Nearby friends location streaming (Xu vol 2 ch 2) with Zenly production notes

## Source
- Primary: Alex Xu and Sahn Lam, System Design Interview vol 2, chapter 2 "Nearby Friends"; public notes via search summaries and https://books.dwf.dev/docs/system-design/c18 (fetch failed in this pass)
- Primary: https://cloud.google.com/customers/zenly (Google Cloud case study with Zenly engineer quotes: GKE, Scylla, sub-300 ms location updates)
- Cross-references: uber-dispatch (driver location every 4 s), whatsapp-messaging (presence fan-out), chat-system (presence servers)
- Verified by: canonical textbook chapter + vendor case study with company quotes
- Confidence: high for the design; medium for Zenly internals (case study only)
- Date of source: 2017 (Zenly), 2022 (book)

## System in three lines
Shows a user which friends are within a few miles right now: each active client sends its location every 30 seconds over a WebSocket, the server writes it to a location cache with a TTL and to a history store, then publishes it on the user's Redis pub/sub channel; every friend's WebSocket handler subscribed to that channel receives it, computes distance, and pushes it down if within the radius. Hard because fan-out equals average friend count, hundreds of thousands of updates per second become tens of millions of channel messages, and WebSocket servers are stateful so scaling means draining connections.

## Scale (only if stated)
- Users / DAU: book 100M DAU, 10% concurrent (10M), 400 friends average
- Requests per second: 10M users / 30 s = ~334K location updates/sec; fan-out 334K x 400 = ~14M pub/sub messages/sec (book)
- Data volume: subscription memory ~200 MB for 100M users x 400 friends at 20 bytes per subscription (book); location history in Cassandra sharded by user id
- Message throughput: Zenly "each location update is processed in under 300 milliseconds"; load varies "30 percent" between peak and off-peak
- Fleet: book estimates ~140 Redis pub/sub servers at 100K subscribers per server

## Requirements stated or clearly implied
- Availability target: WebSocket servers stateful; scale by adding servers and draining old ones gracefully; Redis pub/sub loss acceptable (next update in 30 s)
- Consistency: eventual; location cache overwritten with latest; TTL removes stale (default 10 minutes in book)
- Latency target: a few seconds end to end; Zenly under 300 ms per update
- Ordering needs: latest wins per user
- Replay or reprocessing: none for live path; history store for analytics
- Retention: cache TTL minutes; history in Cassandra
- Compliance / residency: privacy controls on who can see location (friends only); Zenly uses IAP, KMS, Vault
- Elasticity: autoscaling (Zenly GKE) for 30% daily swing

## Boundaries
- Regions / zones: book single region; Zenly planned multi-region for 50% latency gain
- Trust zones: mobile clients -> load balancer -> WebSocket servers / REST servers -> Redis, DBs
- Named subsystems: REST API servers (friends, profiles), WebSocket servers (connection handlers), Redis pub/sub cluster, Location cache (Redis), User DB, Location history DB (Cassandra), Service discovery (ZooKeeper)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Mobile client | Sends location every 30 s; receives friends' updates | native | mobile-client | updateIntervalSeconds: 30 |
| 2 | Load balancer | Routes REST and WebSocket traffic | generic | load-balancer | |
| 3 | RESTful API servers | Friends, profiles, auth | in-house | app-server | stateless: true |
| 4 | WebSocket servers | One connection handler per user; subscribe to friends' channels at init; compute distance and push | in-house | realtime-gateway | stateless: false; subscriptionsPerUser: 400 |
| 5 | Redis pub/sub cluster | One channel per user; sharded by consistent hashing on channel/user id | Redis | pubsub-topic | channelsPerUser: 1; sharded: consistent-hash |
| 6 | Location cache | user id to (lat, long, timestamp) with TTL; sharded by user id | Redis | cache | evictionPolicy: ttl; ttlSeconds: 600 |
| 7 | User database | Users and friendships | relational | sql-database | |
| 8 | Location history DB | Append-only history sharded by user id | Apache Cassandra | nosql-database | shardKey: userId |
| 9 | ZooKeeper | Service discovery and hash ring for pub/sub servers | Apache ZooKeeper | coordination-service + service-registry | |
| 10 | Zenly Scylla | Primary data store on Compute Engine VMs | ScyllaDB | nosql-database | |
| 11 | Zenly GKE + autoscaling | Stateless services and location processing | GKE | ops platform, not tallied | autoscaling: true |
| 12 | Zenly IAP / KMS / Vault | Access control and secrets | Google Cloud | key-management | |
| 13 | Zenly data lake and BigQuery | Several TB/day into Cloud Storage; dashboards | GCS, BigQuery, Dataproc | object-store + data-warehouse | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | lb | wss / https | sync | | |
| lb | websocket server | ws | async | | sticky per connection |
| client | websocket server | ws location update | async | at-most-once | every 30 s |
| websocket server | location cache | redis set with ttl | sync | | |
| websocket server | location history | cql | async | at-least-once | |
| websocket server | redis pubsub (own channel) | publish | async | at-most-once | fan-out to subscribers |
| redis pubsub | friends' websocket handlers | subscribe | async | at-most-once | 400 subscriptions per user |
| websocket handler | client | ws push | async | | if within radius |
| websocket server (init) | user db / rest | read | sync | | friend list |
| websocket server | redis pubsub | subscribe friends' channels | sync at init | | |
| websocket server | zookeeper | watch | async | | pub/sub server ring |
| pubsub server join/leave | zookeeper | update | async | | resubscribe on ring change |
| rest api | user db | sql | sync | | friendships |

## Failure modes, incidents, tradeoffs the source discusses
- Fan-out multiplication: 334K updates/sec become ~14M messages/sec because every update goes to ~400 friends; pub/sub chosen for lightness and stateless servers over persistent queues. Source: book.
- Subscribing all friends at init, even inactive ones, is cheap in memory (~200 MB) and avoids churn, so book keeps it. Source: book.
- Redis pub/sub is fire-and-forget; lost updates tolerated because the next arrives in 30 s. Source: book.
- Resharding pub/sub servers with consistent hashing causes resubscription storms; do it off-peak. Source: book.
- WebSocket servers are stateful; scaling in requires draining connections gracefully; autoscaling must be conservative. Source: book.
- Location cache keyed by user with TTL keeps stale users from appearing; history split from cache because write patterns differ. Source: book.
- Zenly: daily 30% load swing handled by GKE autoscaling; migration cut costs by a third and latency 30%; multi-region expected another 50%. Source: Zenly case study.

## Unknowns
- Book's radius filtering location (server vs client)
- Zenly's real-time fan-out mechanism (not in case study)
- Handling of very large friend lists (celebrity accounts)

## Candidates
- New kinds: none; sightings: realtime-gateway (12th), pubsub-topic (4th: Redis pub/sub), cache (24th), nosql-database (25th), coordination-service (17th), service-registry (6th), key-management (3rd: Zenly), data-warehouse (13th)
- New properties on existing kinds: pubsub-topic.channelsPerUser, delivery at-most-once, sharding consistent-hash; realtime-gateway.subscriptionsPerUser, drainOnScaleIn (boolean); cache.ttlSeconds (2nd sighting); mobile-client.updateIntervalSeconds (2nd sighting after Uber)
- New edge properties: fanoutFactor (integer); lossTolerated (boolean)
- New requirement paths: location.updateIntervalSeconds; location.radiusMiles; privacy.friendsOnly (boolean)
- New rules:
  - lossy-pubsub-for-guaranteed-delivery: pubsub-topic delivery at-most-once feeding edges with lossTolerated false
  - stateful-websocket-scale-in-without-drain: realtime-gateway autoscaling true and drainOnScaleIn false
  - location-cache-without-ttl: cache holding live locations with evictionPolicy not ttl (stale friends shown)
  - fanout-factor-exceeds-pubsub-capacity: fanoutFactor x update rate above pubsub-topic throughput with no sharding (informational)
  - resharding-without-resubscribe-plan: consistent-hash pub/sub with no coordinator notifying subscribers (informational)
