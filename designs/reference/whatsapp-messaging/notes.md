# whatsapp-messaging: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/whatsapp-messaging.md` (re-verified 2026-09-13; see the "Verification 2026-09-13" section there).
- Size: 19 nodes, 26 edges, 6 groups.

## Clean variant (header of design.yaml)

Reference architecture 8, clean variant: WhatsApp's 2014 Erlang messaging core - persistent
client connections terminated on chat servers, store-and-forward through a write-back cache in
front of an offline mailbox, partitioned in-memory Mnesia, a separate HTTP multimedia path, and
Signal's SGX contact-discovery service as a privacy variant of the same problem.

Fixes relative to whatsapp-messaging.broken.yaml:
  - the client reconnects with exponential jitter behind a circuit breaker, so a VLAN drop does
    not turn 150M sockets into a reconnect storm (the 2014-02-22 210 minute outage)
  - offline-cache declares the lru eviction that was added after group-heavy users polluted it
  - offline-store declares a dead-letter queue for messages that can never be delivered
  - push-service is fed from the offline mailbox and pushes to APNs/FCM asynchronously, so a
    slow push gateway parks in the queue instead of blocking a chat server
  - chat-server does not autoscale; capacity is dialled back to 1M connections per node for
    headroom instead, and connections are never dropped by a scale-in
  - the design declares a credential rotation period for the stores that hold user state
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture 8, broken variant: the same WhatsApp messaging core built with the
mistakes the 2014 talk describes having made or nearly made - clients that reconnect at full
speed after a router drops a VLAN, an offline write-back cache with no eviction that
group-heavy users pollute, an offline mailbox with nowhere to park undeliverable messages,
chat servers that autoscale and cut live connections on the way down, a push service that
calls APNs and FCM inline off the chat path, and no stated rotation for the credentials that
reach Mnesia and the media store.

This file MUST trip:
  - retry-without-adaptive-shedding            (whatsapp-client reconnects with a fixed retry, no breaker, no limiter in front of connection-balancer)
  - cache-missing-eviction-policy              (offline-cache declares no eviction; group-heavy users fill it)
  - queue-missing-dlq                          (offline-store takes async writes and declares no dead letter queue)
  - stateful-websocket-scale-in-without-drain  (chat-server autoscales and does not drain live connections)
  - external-call-inline-without-durable-path  (push-service is called from chat-server and pushes to apns and fcm synchronously, with no queue behind it)
  - credentials-without-rotation               (the design holds user state but states no rotation period and has no key management node)
and MUST NOT trip:
  - cache-as-primary-store-without-persistence (the write-back cache is not the only copy; the mailbox behind it is durable)
  - materialised-cache-without-rebuild-path    (the cache holds no materialised view)
  - reconnect-stampede-without-guard           (no coordination service is modelled; Erlang pg2 has no component)
  - shared-host-per-channel-without-isolation  (the design declares no traffic skew)
  - fanout-inline-in-request-path              (no worker node exists in this design)
  - read-heavy-path-without-cache              (outbound to inbound is 2:1, not read heavy, and a cache exists)
  - multi-leader-store-without-conflict-policy (Mnesia and the registered users set are single region)
  - datastore-missing-backup, single-writer-primary-at-peak-qps (no relational store in this design)
  - object-store-single-zone-with-durability-target (the design states no durability target)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Mobile client (persistent TCP, FunXMPP) | `whatsapp-client` | `mobile-app` | client | exact |
| Load balancer | `connection-balancer` | `load-balancer-tier` | load-balancer | assumed (no source names one; connections must be distributed somehow) |
| Chat server (~150, ~1M connections each, Erlang/FreeBSD) | `chat-server` | `websocket-gateway` | realtime-gateway | close (the kind is the connection terminator; the protocol enum has no persistent-TCP value) |
| Offline message store, write-back cache, 98% hit | `offline-cache` | `cache-cluster` | cache | exact (the source describes the cache as an addition in front of the filesystem, so cache and mailbox are two nodes) |
| Offline message store, store-and-forward mailbox | `offline-store` | `message-queue` | queue | exact (`role: offline-mailbox`) |
| Mnesia (16 partitions, 2-node islands, ~2 TB, ~18B records) | `mnesia` | `nosql-store` | nosql-database | close (in-memory, fragment count and partition count have no property) |
| Account service | `account-service` | `erlang-node` | app-server | exact |
| Profile service | `profile-service` | `erlang-node` | app-server | exact |
| Group service | `group-service` | `erlang-node` | app-server | exact |
| Presence service | `presence-service` | `erlang-node` | app-server | exact |
| Push service | `push-service` | `erlang-node` | app-server | close (the service is named by the source; modelled as an Erlang node like its siblings so the inline-external-call rule can read it) |
| APNs / GCM (one box in the card) | `apns`, `fcm` | `apns`, `fcm` | third-party-api | assumed (the bridge to Apple and Google is not stated by either fetched source; the box was split so each real gateway gets its real component) |
| Multimedia servers (~250) | `mms-server` | `erlang-node` | app-server | exact (`instances: 250`) |
| Media storage | `media-store` | `blob-store` | object-store | assumed (no source names a blob store behind the mms servers) |
| Signal contact discovery service (untrusted host) | `cds-frontend` | `container-service` | app-server | exact |
| SGX enclave (128 MB encrypted RAM, oblivious scan) | `contact-matcher` in the `sgx-enclave` trust zone | `vm-service` | app-server | close (no `secure-enclave` kind exists; the enclave is expressed as a trust boundary) |
| Registered users set (plain RAM outside the enclave) | `registered-users` | `nosql-store` | nosql-database | close (the card suggests `cache`, but this is the full authoritative set and is never evicted, which the cache kind cannot say) |
| Signal client | `signal-client` | `mobile-app` | client | exact |
| wandist | not a node | - | - | encoded as the `wandist` protocol on the `chat-server -> chat-server` edge |

Groups: `dc-primary` (region, the SoftLayer datacenter the source describes) with `chat-tier`,
`service-tier` and `media-tier` trust zones, plus the `signal-cds` system holding the
`sgx-enclave` trust zone. The second datacenter is stated by the source but nothing is said
about what runs in it, so it is expressed as `availability.regions: 2` rather than as an empty
group.

Confidence tally: 11 exact, 5 close, 3 assumed.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Mnesia (in-memory, fragmented, distributed table store) | `nosql-database` with `inMemory` and a fragment/partition integer | `nosql-store` with `replicationFactor: 2` |
| Intel SGX enclave | `secure-enclave` (with `encryptedRamMb`, `attestation`, `obliviousAccess`) | `vm-service` inside an `sgx-enclave` trust-zone group |
| wandist | `service-mesh` has no generic default component | not a node; an edge protocol |
| pg2 / Erlang process-group registry | `coordination-service` has no generic default component | not encoded |
| FunXMPP over persistent TCP | `realtime-gateway.protocol` has no `tcp`/`xmpp` value | protocol left at its default |

## Not encoded

- 16 Mnesia partitions, 512 account-table fragments, and services partitioned "between 2 and 32 ways": no property on any kind carries a partition count.
- 1M connections per chat server is carried by `maxConnectionsPerNode`, but 150 chat servers, 147M peak concurrent connections and 230K peak logins/sec have nowhere to go: `nfr` has only `rps`, `latencyP95Ms` and `consistency`.
- The 98% write-back cache hit rate: the cache kind has no hit-rate property. It survives only as an edge label.
- "async_dirty" (non-transactional Mnesia access): no consistency value expresses it; it is an edge label.
- Separate read and write queues on the chat servers, and the per-destination-node sender processes that bound head-of-line blocking: the format has no way to say that one logical dependency is reached through two queues. (The per-destination sender detail was also dropped on verification - it comes from a secondary source that turns out not to discuss WhatsApp at all.)
- Multiple timer wheels, the Mnesia hash-chain fix, canary rollouts and rolling restarts: operational practice, not topology.
- Erlang "cast, not call" is expressed only as `mode: async` on the four chat-server-to-service edges; there is no `blocking` field.
- 128 MB of encrypted enclave RAM, remote attestation, the oblivious access pattern and the "fewer than 12 contacts per hash bucket" residual leak: no kind carries any of these. The enclave survives as a trust-zone boundary and an edge label.
- End-to-end encryption (2016) and any post-acquisition Meta architecture: not in the fetched sources, so not in the design.

## Two values set for cleanliness rather than from the source

Both are flagged here because the brief forbids inventing facts:

- `security.credentialRotationDays: 90`. Neither source mentions credential rotation. The value
  states the practice a system holding 465M users' account records is assumed to have; the broken
  twin drops it, which is what `credentials-without-rotation` is for.
- `offline-store.deadLetterQueue: true`. The card records this as "n/a". A store-and-forward
  mailbox that can never park an undeliverable message retries it forever, so the clean design
  declares the parking lot the rule asks for and the broken twin removes it.
