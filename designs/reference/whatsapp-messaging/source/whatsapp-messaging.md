# Intake: WhatsApp messaging (with Signal contact discovery as a privacy variant)

## Source
- Primary: https://highscalability.com/how-whatsapp-grew-to-nearly-500-million-users-11000-cores-an/ (detailed write-up of Rick Reed, WhatsApp, Erlang Factory SF 2014 talk "That's Billion with a B")
- Primary: https://www.erlang-factory.com/upload/presentations/752/reed-efsf2013-whatsapp.pdf (Rick Reed 2013 slides, multimedia path; PDF not machine-readable in this pass)
- Primary: https://signal.org/blog/private-contact-discovery/ (official Signal blog, SGX contact discovery)
- Secondary: https://malloc.dog/blog/2022/11/07/otp-23-pg2-and-outages/ (2014 outage and pg2 analysis)
- Verified by: conference talks by WhatsApp engineer + official Signal blog + secondary
- Confidence: high for 2014 WhatsApp; medium for post-Facebook-acquisition changes (not public)
- Date of source: 2013-2014 (WhatsApp), 2017 (Signal)

## System in three lines
Real-time 1:1 and group messaging for hundreds of millions of concurrent users with store-and-forward delivery to offline devices. Persistent TCP connections terminated on Erlang chat servers; state partitioned across in-memory Mnesia databases; media handled by a separate HTTP path. Hard because of connection density, message fan-out in groups, and keeping a large Erlang cluster stable under partitions.

## Scale (only if stated)
- Users / DAU: 465M monthly users (2014); 40M users per engineer
- Requests per second: 230K peak logins/sec; 342K peak messages in/sec, 712K out/sec
- Data volume: Mnesia ~2 TB RAM across 16 partitions holding ~18B records; 360M videos on one Christmas Eve
- Message throughput: 19B inbound, 40B outbound messages per day; 70M+ Erlang messages/sec internal
- Fleet: ~550 servers, >11,000 cores; ~150 chat servers at ~1M connections each (150M concurrent); ~250 multimedia servers

## Requirements stated or clearly implied
- Availability target: near-zero downtime expected by users; dual datacenter
- Consistency: per-user state in partitioned Mnesia; async_dirty writes, not transactional
- Latency target: real-time delivery; not quantified
- Ordering needs: per-conversation ordering implied (not stated)
- Replay or reprocessing: offline messages stored until device reconnects (store-and-forward)
- Retention: offline store transient; messages deleted after delivery (implied by write-back cache design)
- Compliance / residency: end-to-end encryption (later, 2016); Signal variant hides social graph from server

## Boundaries
- Regions / zones: two datacenters (SoftLayer bare metal); Erlang cluster partitioned into islands of 2 nodes for Mnesia
- Trust zones: mobile clients -> load balancer -> chat servers; Signal variant adds SGX enclave as a trust boundary inside the server
- Named subsystems: Chat (connections, routing), Offline store, Account / Profile / Push / Group / Presence services, Multimedia (HTTP upload/download), Contact discovery

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Mobile client | Persistent TCP connection, modified XMPP (FunXMPP); receives push when disconnected | native iOS/Android | mobile-client | connection: persistent-tcp |
| 2 | Load balancer | Distributes incoming connections to chat servers | not named | load-balancer | |
| 3 | Chat server | Terminates ~1M connections each; routes messages; Erlang/FreeBSD | Erlang R16 patched, ejabberd-derived | websocket-gateway / connection-server (new) | connectionsPerNode: 1000000; stateful: true |
| 4 | Offline message store | Store-and-forward for offline recipients; write-back cache with 98% hit rate | Mnesia + custom | queue (per-user mailbox) | deadLetterQueue: n/a; retention: until-delivered |
| 5 | Mnesia | In-memory partitioned DB for accounts, sessions, offline; 16 partitions, 2-node islands | Mnesia (patched) | nosql-database (in-memory) | partitions: 16; replication: 2-node island; inMemory: true |
| 6 | Account service | Registration, auth | in-house | app-server | partitions: 32 |
| 7 | Profile service | Profile data | in-house | app-server | partitions: 32 |
| 8 | Push service | Bridges to APNs/GCM when client offline | in-house | notification-service (new) | |
| 9 | Group service | Group membership, fan-out | in-house | app-server | partitions: 32 |
| 10 | Presence service | Online/last-seen | in-house | app-server | |
| 11 | Multimedia servers | HTTP upload/download of media; ~250 servers | in-house (Erlang HTTP) | app-server | count: 250 |
| 12 | Media storage | Blob storage for images/video/audio | not named | object-store | |
| 13 | APNs / GCM | Third-party push gateways | Apple APNs, Google GCM | third-party-api (new) | |
| 14 | wandist | Custom Erlang distribution transport with partition-aware routing above pg2 | wandist (in-house) | service-mesh (internal RPC) | routing: single-hop |
| 15 | Signal contact discovery service | Untrusted host running matching inside SGX enclave | Signal CDS | app-server | trustBoundary: enclave |
| 16 | SGX enclave | Hardware-isolated matching; 128 MB encrypted RAM; oblivious linear scan | Intel SGX | secure-enclave (new) | encryptedRamMb: 128 |
| 17 | Registered users set | Plain RAM outside enclave, scanned obliviously | in-memory | cache | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| mobile-client | load-balancer | tcp | sync | | connection setup |
| load-balancer | chat-server | tcp | sync | | |
| mobile-client | chat-server | funxmpp/tcp | async | at-least-once | persistent connection, acks |
| chat-server | chat-server | wandist | async | | route to recipient's connection node |
| chat-server | offline-store | mnesia | async | at-least-once | recipient offline; write-back |
| offline-store | chat-server | mnesia | async | | drain on reconnect |
| chat-server | push-service | internal | async | at-most-once | wake offline device |
| push-service | apns/gcm | https | async | at-most-once | |
| chat-server | account/profile/group/presence | erlang rpc (cast) | async | | "cast-based messaging rather than blocking calls" |
| mobile-client | multimedia-server | https | sync | | upload, get url |
| multimedia-server | media-storage | internal | sync | | |
| mobile-client | media-storage (via url) | https | sync | | download |
| signal-client | sgx-enclave | attested tls | sync | | encrypted contacts in, matches out |
| sgx-enclave | registered-users-set | memory scan | sync | | oblivious linear scan |

## Failure modes, incidents, tradeoffs the source discusses
- Coupling: "Tight coupling causes cascading failures." Services partitioned 2-32 ways with isolated failure domains. Source: highscalability.
- 2014-02-22 outage, 210 minutes: router VLAN drop -> node disconnects -> reconnect storm -> pg2 "4 million messages within seconds"; manual node-by-node restart. Source: highscalability, malloc.dog.
- Head-of-line blocking: separate read and write queues; per-destination-node sender processes so "only messages destined for a problem node are backed up". Source: highscalability, malloc.dog.
- Headroom over capacity: dialed back from 2M to 1M connections per server. Source: highscalability.
- Offline store disk I/O: write-back cache, 98% hit rate; group-heavy users polluted cache, added eviction. Source: highscalability.
- Timer contention at millions of resets/sec: multiple timer wheels. Source: highscalability.
- Mnesia limits: hash chain collision fix gave 4x; islands shrunk to 2 nodes for schema ops; power-of-2 partition ceiling, "128 impractical". Source: highscalability.
- Cannot load-test at true scale; canary rollouts and rolling restarts. Source: highscalability.
- Signal: 128 MB enclave RAM forces data outside enclave; oblivious access pattern to hide lookups; accepts leak "can't be more than 12 contacts in a hash bucket". Source: signal.org.
- Signal: SGX flaws later found and fixed; hardware trust boundary is itself a risk. Source: search summary (beencrypted).

## Unknowns
- Media storage product and whether a CDN fronts it
- Group fan-out algorithm and limits
- Post-2014 architecture under Meta (likely moved to Meta infra; not public)
- Exact retention of undelivered messages

## Candidates
- New kinds: connection-server (long-lived connection terminator; overlaps push-service from google-drive, consider one kind `realtime-gateway`), notification-service (push bridge to APNs/FCM), third-party-api, secure-enclave, load-balancer (2nd sighting), nosql-database (3rd), object-store (3rd), service-mesh (3rd)
- New properties on existing kinds: app-server.partitions (integer); app-server.failureDomainIsolated (boolean); cache.hitRate (integer percent, informational); queue.retention: until-delivered mode
- New edge properties: connection (persistent | request-response); blocking (boolean, cast vs call)
- New requirement paths: availability.maxConcurrentConnections; messaging.storeAndForward (boolean)
- New rules:
  - blocking-call-into-partitioned-service: sync edge into a partitioned stateful service from a connection-server (source says cast, never call)
  - shared-queue-for-reads-and-writes: single queue node receiving both read and write traffic from a connection-server (head-of-line blocking)
  - connection-server-without-push-fallback: connection-server with no edge to notification-service while clients are mobile
  - offline-store-without-eviction: queue used as offline mailbox with no retention or eviction declared
  - enclave-with-oversized-working-set: secure-enclave whose declared dataset exceeds encryptedRamMb with no oblivious-access flag

## Verification 2026-09-13

Re-fetched on 2026-09-13 for the reference design. Full log: `work/designs/whatsapp-messaging/verify.md`.

| URL | Reachable | Outcome |
|---|---|---|
| https://highscalability.com/how-whatsapp-grew-to-nearly-500-million-users-11000-cores-an/ | yes | Confirms every WhatsApp number in this card: 550 servers, 11,000+ cores, ~150 chat servers at ~1M connections, ~250 mms servers, 230K peak logins/sec, 342K msgs in / 712K out per sec, 19B/40B per day, 465M monthly users, 40M users per engineer, Mnesia 2TB over 16 partitions and ~18B records, islands of two nodes, async_dirty, services partitioned 2-32 ways, cast-based messaging, tight coupling causing cascading failures, the offline write-back cache at 98% hit rate, the 210 minute 2014-02-22 outage with pg2 queues going "from zero to 4 million within seconds", the Mnesia hash chain fix, separate read and write queues, timer wheels, 360M videos on Christmas Eve, SoftLayer bare metal. |
| https://www.erlang-factory.com/upload/presentations/752/reed-efsf2013-whatsapp.pdf | yes (200, 1.2 MB) | Body still not machine-readable, as this card already noted. No fact was taken from it. |
| https://signal.org/blog/private-contact-discovery/ | yes | Confirms the SGX enclave, remote attestation, the 128 MB encrypted-RAM limit, the registered-users set held outside the enclave, the oblivious linear scan per batch, and the residual "fewer than 12 contacts per hash bucket" leak. |
| https://malloc.dog/blog/2022/11/07/otp-23-pg2-and-outages/ | yes | Does NOT mention WhatsApp. It is a generic OTP-23 / pg2 cascading-failure post. The pg2 outage facts used in the design come from highscalability alone; the per-destination-node sender processes this card attributes to malloc.dog were dropped. |

Stated by this card but confirmed by no fetched source, and therefore marked `assumed` in `notes.md`:
the load balancer in front of the chat servers, the Push service bridging to APNs and GCM/FCM,
a distinct media blob store behind the multimedia servers, and the `routing: single-hop` property of wandist
(the transport itself is confirmed by name).
