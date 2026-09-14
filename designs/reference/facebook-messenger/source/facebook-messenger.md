# Intake: Facebook Messenger (Iris ordered log, MQTT push, MyRocks message store, Labyrinth E2EE storage)

## Source
- Primary: https://engineering.fb.com/2014/10/09/production-engineering/building-mobile-first-infrastructure-for-messenger/ (Messenger infrastructure engineers, Engineering at Meta, 2014 — the Iris ordered queue and the push-based sync protocol, presented at @Scale 2014)
- Primary: https://engineering.fb.com/2018/06/26/core-infra/migrating-messenger-storage-to-optimize-performance/ (Messenger core infra engineers, Engineering at Meta, 2018 — HBase to MyRocks migration)
- Primary: https://engineering.fb.com/2020/03/02/data-infrastructure/messenger/ (Messenger client infra team, Engineering at Meta, 2020 — "Project LightSpeed")
- Primary: https://engineering.fb.com/2023/12/06/security/building-end-to-end-security-for-messenger/ (Jon Millican, Messenger security engineering, Engineering at Meta, 2023)
- Primary: https://engineering.fb.com/wp-content/uploads/2023/12/TheLabyrinthEncryptedMessageStorageProtocol_12-6-2023.pdf (Meta whitepaper, "The Labyrinth Encrypted Message Storage Protocol", v1, 2023, 41 pp)
- Primary: https://engineering.fb.com/wp-content/uploads/2023/12/MessengerEnd-to-EndEncryptionOverview_12-6-2023.pdf (Meta whitepaper, "Messenger End-to-End Encryption Overview", v1, 2023, 25 pp)
- Primary: https://engineering.fb.com/2011/08/12/android/building-facebook-messenger/ (Lucy Zhang, Messenger engineering, Engineering at Meta, 2011 — MQTT)
- Primary: https://engineering.fb.com/2011/04/12/core-infra/scaling-the-messages-application-back-end/ (Kannan Muthukkaruppan, Engineering at Meta, 2011 — cells, application servers, HBase, Haystack)
- Primary: https://engineering.fb.com/2025/11/20/security/key-transparency-comes-to-messenger/ (Meta security engineering, Engineering at Meta, 2025 — AKD key transparency)
- Secondary: https://highscalability.com/facebook-mobile-drops-pull-for-push-based-snapshot-delta-mod/ (HighScalability write-up of the @Scale 2014 Iris talk, 2014 — snapshot+delta, JSON to Thrift)
- Verified by: Engineering at Meta official blog (7 posts) + 2 official Meta protocol whitepapers + HighScalability write-up of the @Scale 2014 talk
- Confidence: high
- Date of source: 2011, 2014, 2018, 2020, 2023, 2025

## System in three lines
Messenger is Meta's consumer chat product: 1:1 and group text, media, voice and video, across iOS, Android and web, with message history that must be available on any device the user logs into. The backend is built around Iris — "a totally ordered queue of messaging updates" per user — which decouples real-time push to online devices from persistence into the durable message store, plus an MQTT push channel to the phone and a client that treats SQLite as the single source of truth for the UI. It is hard because Meta chose a *server-side* history model (thin clients, thick server) and then had to keep that model while making everything end-to-end encrypted, which required inventing Labyrinth, an encrypted server-side mailbox with key rotation against revoked devices.

## Scale (only if stated)
- Sync protocol change "decreased the non-media data usage by 40%" and gave "about a 20 percent decrease in the number of people who experience errors when trying to send a message" (https://engineering.fb.com/2014/10/09/production-engineering/building-mobile-first-infrastructure-for-messenger/)
- Iris backing store holds roughly "a week's worth of messages"; buffered migration relied on Iris being able to "queue messages for weeks" (2014 and 2018 posts)
- Buffered-migration accounts were those receiving "up to thousands of messages per second" (https://engineering.fb.com/2018/06/26/core-infra/migrating-messenger-storage-to-optimize-performance/)
- Storage: "reduce the replication factor from six to three"; "reduced storage consumption by 90 percent without data loss"; "Read latency is now 50 times lower than in the previous system" (2018 post)
- Migration: "We migrated 99.9 percent of accounts via the normal migration flow in two weeks, and finished the remaining via the buffered migration flow two weeks after" (2018 post)
- Client: core Messenger code cut "from more than 1.7M lines to 360,000" (84%), app "one-fourth the size", "twice as fast to start" (https://engineering.fb.com/2020/03/02/data-infrastructure/messenger/)
- Delivery latency: MQTT gave "phone-to-phone delivery in the hundreds of milliseconds, rather than multiple seconds" (2011 post)
- Key transparency: "an epoch frequency of approximately 2 minutes per publish, with hundreds of thousands of new keys added in each epoch"; directory "has already grown to billions of key entries" (2025 post)
- Users / DAU: not stated in first-party sources
- Requests per second: not stated

## Requirements stated or clearly implied
- Availability target: Iris pointers are explicitly designed so that "when your phone is offline, or there is a disk outage, the pointer stays in place while new messages can still be enqueued and other pointers advanced" — a disk-tier outage must not stop message delivery. Semi-sync MySQL replication "can give you durability across multiple servers" with hardware failure handled "in under 30 seconds". Regions not named.
- Consistency: per-user total order. Iris is "a totally ordered queue of messaging updates"; the client reconciles with the server by sequence number (snapshot + delta). Cross-user global ordering is not claimed.
- Latency target: message delivery "in the hundreds of milliseconds" phone-to-phone (2011). No p50/p95/p99 published.
- Ordering needs: per-user (per-mailbox) total ordering of *updates*, not just messages — new messages, read-state changes and other state transitions share one ordered log.
- Replay or reprocessing: yes, by design — an offline client resumes from its pointer; a client that has fallen too far behind takes a full snapshot from the durable tier. Iris also served as the replay buffer during the HBase to MyRocks migration.
- Retention: Iris backing store about one week; full history in the durable message store (HBase, then MyRocks/MySQL; Labyrinth mailbox under E2EE). Encrypt journal entries expire after 30 days ("The entry will remain in the encrypt journal until a delivery receipt is received or until 30 days").
- Compliance / residency: not stated. E2EE properties are stated instead: Baseline Message Secrecy and Post-Revocation Message Secrecy, plus Attachment Unlinkability.

## Boundaries
- Regions / zones: not named in the sources. The 2011 backend is divided into cells: "The entire system is divided into cells, and each cell contains only a subset of users", for incremental scaling, failure isolation and disaster recovery.
- Trust zones: user devices (hold all plaintext and E2EE keys) -> Meta transport/chat servers (TLS, QUIC, and "Noise Pipes with Curve25519, AES-GCM, and SHA-256" for long-running interactive connections) -> Meta backend, which under E2EE is explicitly treated as untrusted for message content and, in Labyrinth, revoked devices are "treated as threat actors". Third-party trust zones: Cloudflare (key-transparency auditor), iCloud Drive / Google Drive (recovery-code escrow, "inaccessible to Meta").
- Named subsystems / bounded contexts: Iris; MSYS (client); Server Broker; chat pipeline; Labyrinth mailbox metastore; Labyrinth mailbox; Backup Key Vault; AKD (auditable key directory); Haystack; the cell (application servers + metadata store + ZooKeeper); SFU for group calls.

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | Messenger app (iOS / Android / web) | Thin client; holds "a small stored local cache, relying on a server-side database for their message history"; under E2EE it also holds all keys and does client-fanout | in-house | client | platforms: ios, android, web; "Web platform carries significantly different constraints from native apps" |
| 2 | Client SQLite database | The client's universal store — "a universal system to support all the features"; the UI renders directly from it, including "instructions for how to display different building blocks" | SQLite | sql-database | embedded: true; storedProcedures: true ("allowing Messenger feature developers to write portable, database-oriented business logic") |
| 3 | MSYS | "cross-platform library built in C" that orchestrates all database access, "queued changes, deferred or retriable tasks, and data sync support" | in-house (MSYS) | client (sub-component) | testCoverage: "100 percent line code coverage"; retriable task queue; owns sync |
| 4 | MQTT connection | Persistent low-power push channel from device to Meta; "By maintaining an MQTT connection and routing messages through our chat pipeline" | MQTT | realtime-gateway | protocol: mqtt; persistent: true; battery/bandwidth-optimised |
| 5 | Chat pipeline / chat servers | Routes messages between the push channel and the messaging backend; transport to them may be wrapped in Noise Pipes | in-house | app-server | transport: tls, quic, noise-pipes |
| 6 | Server Broker | "a universal gateway between Messenger and all server features", replacing per-feature client-to-server protocols | in-house | api-gateway | uniform protocol across features |
| 7 | Iris | "a totally ordered queue of messaging updates (new messages, state change for messages read, etc.) with separate pointers into the queue indicating the last update sent to your Messenger app and the traditional storage tier" | in-house (Iris) | stream | totallyOrdered: true (per user); consumerPointers: app + storage-tier; retention: ~1 week ("can queue messages for weeks"); enqueue-once then parallel push |
| 8 | Iris backing store | Durable backing for the queue when a consumer is offline | MySQL on flash ("built on top of MySQL and flash") | sql-database | replication: semi-sync ("durability across multiple servers"); failoverSeconds: 30; storage: flash |
| 9 | Traditional storage tier (2010-2018) | Long-term message store and full-inbox snapshots | Apache HBase | nosql-database | replicationFactor: 6 (pre-migration); spinning disks |
| 10 | New message store (2018+) | Replacement long-term message store; serves conversation history and inbox snapshots | MyRocks (MySQL storage engine) on the "Lightning Server SKU" | sql-database | replicationFactor: 3; compression: Zstandard; storageReduction: 90%; readLatency: 50x lower; schema redesigned + "new source-of-truth index" |
| 11 | Application servers (cell) | "the only user-facing interface to the messages service"; API layer, distributed logic via consistent hashing, business logic with write-through cache, data access layer with time-sequenced logs | in-house | app-server | sharding: consistent hashing over a ring of virtual positions; cache: write-through |
| 12 | ZooKeeper cluster | Controls each application-server cluster; shard assignment and coordination | Apache ZooKeeper | coordination-service | "each application server cluster is controlled by a set of ZooKeeper machines" |
| 13 | Discovery service | Maps a user to their cell and application server | in-house | coordination-service | backed by the ZooKeeper shard map |
| 14 | Metadata store (per cell) | Per-cell metadata and message index | Apache HBase | nosql-database | "Each cell also has a dedicated metadata store. We use HBase as our metadata store." |
| 15 | Haystack | Stores attachments and large email bodies written by the MTA proxy | Haystack | object-store | attachments and email attachments |
| 16 | MTA proxy | Parses inbound email RFCs and attachments, stores them, hands the rest to the app servers | in-house | app-server | email ingress path |
| 17 | Memcache dirty service | Invalidates cached unread-message counts | Memcache | cache | invalidation-only role |
| 18 | User index service | Supplies social-graph information to the messages backend | in-house | app-server | |
| 19 | Prekey / device key server | Stores per-device public Identity Key, Signed Pre Key and One-Time Pre Keys; hands them out for asynchronous session setup | in-house | key-management | "A One-Time Pre Key is only used once, so it is removed from server storage after being requested"; keyed by "the user's device specific identifier" |
| 20 | Labyrinth mailbox metastore | "one containing operational protocol data (the mailbox metastore)" — per-device public keys, epochs, epochIDs, epoch membership MACs, ORF server state | in-house (Labyrinth) | key-management | stores deviceKeyPub, epochStorageKeyPub + signatures; assigns labyrinthID and epochID; holds ORF server state |
| 21 | Labyrinth mailbox | "one containing message ciphertexts in a structured database (the mailbox)" — the E2EE server-side history | in-house (Labyrinth) | sql-database | schema `encrypted_messages(inbox_id, thread_id, message_id, timestamp, encrypted_message_data, epoch_id, version)`; hash keys on inbox/thread/message; btree index (inbox_id, thread_id, timestamp); query by mailbox, by thread+timestamp range, or by message id |
| 22 | Blob store (attachments) | Holds encrypted attachments, uploaded over HTTPS, separate from messages; each attachment has a per-mailbox "reference object" indexed via ORF with a MAC binding it to its thread and message | not named | object-store | "stored in a separate data store from messages"; unlinkability goal: "unconnected either to a user account or to a particular message, except at the point that they are accessed" |
| 23 | Backup Key Vault | HSM-style vault that stores Labyrinth recovery codes and releases them on a user PIN | Backup Key Vault | key-management | "Backup Key Vault limits each user to 10 incorrect guesses"; PINs never derive keys directly |
| 24 | Auditable Key Directory (AKD) | Append-only, publicly auditable directory of per-device public keys for key transparency | AKD (open source, facebook/akd) | ledger | epoch publish interval ~2 minutes; "hundreds of thousands of new keys added in each epoch"; "billions of key entries"; indexes keys per device |
| 25 | Cloudflare key transparency auditor | Third-party auditor that "maintains a live log of the latest entries on the Key Transparency Dashboard" | Cloudflare | third-party-api | external trust anchor |
| 26 | SFU (selective forwarding unit) | Routes audio/video streams for group calls; sees SRTP but not SFrame-encrypted frame payloads | not named | media-router | "SRTP encryption is not sufficient to provide end-to-end encryption for group calls"; SFrame with AES128_GCM over frames |
| 27 | Franking service | Server side of abuse reporting: computes the Reporting tag over the sender's Franking tag with a Meta key | in-house | app-server | `R_F = HMAC-SHA256(K_F, T_F \|\| context)`; holds K_F |
| 28 | iCloud Drive / Google Drive | Optional off-Meta escrow for Labyrinth recovery codes | Apple iCloud Drive, Google Drive | third-party-api | app-specific hidden folders; "inaccessible to Meta" |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| messenger-app | mqtt-connection | MQTT over TCP | async (long-lived) | not stated | persistent connection; "phone-to-phone delivery in the hundreds of milliseconds" |
| mqtt-connection | chat-pipeline | not stated | async | not stated | "routing messages through our chat pipeline" |
| messenger-app | server-broker | not stated (Thrift payloads per the @Scale write-up) | sync | not stated | "a universal gateway between Messenger and all server features"; replaced per-feature protocols |
| chat-pipeline | iris | not stated | sync (enqueue) | totally ordered per user | "enqueuing messages once to MySQL and then pushing to apps and disk in parallel" |
| iris | messenger-app | via MQTT push | async | at-least-once, resumable from pointer | push-based delta; pointer advances only on successful send |
| iris | message-store (MyRocks) | not stated | async | durable persistence | independent pointer; "when there is a disk outage, the pointer stays in place" |
| messenger-app | iris | sync-protocol delta request with sequence number | sync | | snapshot + delta; client detects out-of-sync by sequence number and re-snapshots |
| messenger-app | message-store (MyRocks) | not stated | sync | | "Older conversation history and full inbox snapshot fetches are served from the traditional disk storage tier" |
| hbase-store | myrocks-store | migration job | async (batch) | verified by comparison | account state machine not-migrated -> double-writing -> done; shadow reads to both systems |
| iris | myrocks-store | replay from queue | async | buffered accounts | "write traffic to the new (MyRocks) system is queueing up in Iris" during buffered migration |
| messenger-app | msys (local) | in-process C API | sync | retriable task queue | "queued changes, deferred or retriable tasks, and data sync support" |
| msys | client-sqlite | SQLite API + stored procedures | sync | transactional | UI reads straight from the DB |
| client (registration) | prekey-server | HTTPS | sync | | uploads Identity Key, Signed Pre Key, batch of One-Time Pre Keys |
| sender-client | prekey-server | HTTPS | sync | one-time prekey consumed on read | fetches key bundle "for each device of the recipient and each additional device of the initiating user" |
| sender-client | chat-pipeline | encrypted payload per device | async | client-fanout | "the Messenger client transmits a single message `N` number of times to `N` number of different devices" |
| chat-pipeline | recipient-devices | MQTT push | async | at-least-once + retry receipts | recipient that fails to decrypt "will send a 'retry receipt' back to the original sender"; honoured up to 30 days and only if the identity key has not changed |
| chat-pipeline | sender-client | device-list hash mismatch notification | async | | Sender Side Backfill: server "compares the hash of all the destination devices listed by the sender to the hash of server-side device records"; on mismatch tells the sender to refresh and resend |
| sender-client | chat-pipeline (group) | single ciphertext under Sender Key | async | server-side fan-out | "The sender transmits the single ciphertext message to the server, which does server-side fan-out to all group participants" |
| sender-client | blob-store | HTTPS upload | async | | AES-CBC with media_encryption_key + HMAC-SHA-256; message carries media_key, SHA-256 of blob, pointer to blob |
| recipient-client | blob-store | HTTPS download | sync | verified by hash + HMAC | receiving devices verify SHA-256 and HMAC before decrypting |
| client | labyrinth-mailbox | upload ciphertext | async | | "ciphertexts uploaded to our servers and loaded on-demand by clients"; row carries epoch_id and version |
| client | labyrinth-mailbox | query by inbox / thread+timestamp range / message id | sync | | history restore on a new device |
| client | labyrinth-metastore | protocol calls | sync | | register device keys, open epoch, add/revoke device, ORF mapping |
| client | backup-key-vault | PIN authentication | sync | 10 guesses max | retrieves the recovery code; PIN is not used to derive keys |
| client | icloud-drive / google-drive | platform SDK | async | | recovery code stored in an app-specific hidden folder |
| client | akd | key lookup + audit proof verification | sync | | automatic verification of a contact's device keys for 1:1 chats |
| akd | cloudflare-auditor | append-only log publication | async | ~2 minute epochs | auditor "maintains a live log of the latest entries" |
| sender-client | franking-service | franking tag T_F with each encrypted message | async | | server returns R_F to sender in an ack and to the recipient with the message |
| reporter-client | franking-service | abuse report | sync | | submits plaintext, T_F, R_F, N_F, context; server recomputes T_F and validates R_F with K_F |
| caller-device | callee-device | WebRTC / SRTP | sync | | 1:1 calls peer-to-peer; PreKey Bundle carried in the SDP offer, not fetched from the server |
| participant-device | sfu | WebRTC / SRTP + SFrame | sync | | group calls; SFU sees frame headers only |
| application-server | hbase-metadata-store | not stated | sync | | per-cell metadata store |
| application-server | zookeeper | ZooKeeper protocol | sync | | shard ownership on the consistent-hash ring |
| mta-proxy | haystack | not stated | sync | | attachments and large email bodies |
| application-server | memcache-dirty-service | not stated | async | | unread-count cache invalidation |
| application-server | user-index-service | not stated | sync | | social graph lookups |

## Failure modes, incidents, tradeoffs the source discusses
- Pointer isolation is the core availability trick: "When your phone is offline, or there is a disk outage, the pointer stays in place while new messages can still be enqueued and other pointers advanced." A storage outage degrades durability lag, not delivery. (2014 post)
- Tiered reads by recency: "A week's worth of messages are served by the queue's backing store in the case of disk outage or the Messenger app being offline for a while. Older conversation history and full inbox snapshot fetches are served from the traditional disk storage tier." (2014 post)
- The old protocol was the bug: the pull model made apps send "a complicated HTTPS query and receive a very large JSON response". Replacing it with push-based snapshot + delta cut non-media data usage 40% and send errors ~20%. The HighScalability write-up adds that moving JSON to Thrift roughly halved the payload. (2014 post; HighScalability)
- Storage-engine mismatch: HBase was chosen when Messages "was primarily intended to be a direct messaging product similar to email" and did not fit "a mobile-first, real-time communications system"; "The replication topology for MySQL is more compatible with the way Facebook data centers operate in production". (2018 post)
- Migration safety net: accounts moved through a state machine with double-writing and shadow reads — "we issue read requests to both systems, old and new, and compare responses" — plus "a complete revert plan that can roll back an account to the not-migrated state" and an "accounting job" to prove "no account has been left behind". Accounts whose data moved mid-migration were failed and retried. (2018 post)
- Hot accounts needed a different flow: high-volume accounts receiving "up to thousands of messages per second" could never be quiesced, so they were snapshotted at a cutoff time while Iris buffered writes — the queue doubled as a migration write-ahead log. (2018 post)
- Client complexity as the failure mode: Project LightSpeed attacked 1.7M lines of client code by making SQLite the single coordination point and pushing logic to the server; "feature budgets" were added to stop regrowth. (2020 post)
- E2EE broke the product's architectural premise: "Messenger has always allowed clients to operate off of a small stored local cache, relying on a server-side database for their message history", which is exactly what E2EE removes — hence Labyrinth. "Enabling E2EE on Messenger meant fundamentally rebuilding many aspects of the application protocols." (2023 post)
- E2EE expands the threat model: "it reduces the provider's ability to protect the user from attacks, and expands the threat model to include the service provider itself"; and for a "sufficiently complex messaging application, it turns out there's a surprisingly large grey area" about what counts as end-to-end encrypted. (2023 post)
- Labyrinth's complexity is driven by one requirement: "This distinction, and most of the protocol complexity, arises from the goal of treating revoked devices as threat actors. This necessitates a protocol which supports key rotation, while supporting devices remaining offline for long periods of time." (Labyrinth whitepaper)
- Known limitation — epoch truncation: "A malicious server may choose to truncate the epochs that it serves in this situation... If the server is colluding with a revoked device, it could ensure that the new device has received an epoch that was known to this revoked device", so new messages get written under keys a revoked device holds. Meta calls this "an attack against post-revocation message secrecy" and has not yet shipped a fix. (Labyrinth whitepaper)
- Known limitation — membership enumeration: "The server is in a position to only share a subset of devices to each other device." (Labyrinth whitepaper)
- Shipped gaps, stated openly: "Epoch rotation has not yet been implemented on device removal... we currently only provide the revocation guarantees that rely on an honest server during revocation"; "Client ORF keys are currently accessible to the server"; and deletion is bounded by backups — "Meta's backend storage includes backup systems that can be used for a limited time period after data deletion, to protect users from bugs resulting in accidental data loss". (Labyrinth whitepaper)
- Client-fanout cost: with N devices the sender encrypts and sends N copies; a stale device list silently drops recipients, which is why Sender Side Backfill exists (server compares device-list hashes and asks the sender to resend). Group messaging avoids the N-copy send by using Sender Keys with server-side fan-out, at the cost of a full Sender Key reset "whenever a group member leaves, or a device associated with a group member is removed".
- Retry safety: retries are refused if the recipient's identity key changed since send, or after 30 days, or after a delivery receipt — otherwise a retry receipt would be an oracle for pulling messages onto a new key. (E2EE overview whitepaper)
- Calls deliberately do not reuse chat sessions: ephemeral Signal sessions are used "instead of integrating with those used for chat... as it avoids the possibility of attempting a call on an older corrupted session that will result in a failed connection". (E2EE overview whitepaper)
- Key transparency's hard part is Messenger's own model: "Messenger indexes keys for each and every device someone has logged in on, which means that a single user often has multiple, frequently-changing keys associated with their account", and the directory "has already grown to billions of key entries". (2025 post)

## Unknowns
- How Iris is sharded and replicated today, and whether the 2014 MySQL+flash backing store still stands after the 2018 MyRocks work.
- Whether the 2011 "cell" topology still describes the current backend, and how cells map to regions or data centres — no first-party source updates it.
- Region/zone layout, failover strategy, and any residency rules: never stated.
- Messages per second/day and DAU: no current first-party number found.
- The identity of the blob store used for E2EE attachments (Haystack is named only for the 2011 email path, and the E2EE whitepaper says only "a blob store").
- Whether Iris still carries E2EE traffic, and how the Iris ordered log relates to the Labyrinth mailbox (the whitepapers describe Labyrinth as a queryable database, not a log).
- What replaced the HBase per-cell metadata store after the MyRocks migration.
- Server-side latency budgets (p50/p95/p99) and error-rate SLOs.
- MLS is mentioned as something Meta is "working with the IETF" on; no deployment detail.

## Candidates
- New kinds: none required — every box maps to an existing kind. Closest gaps: an *ordered per-entity log with multiple independent consumer pointers* is not quite `stream` (Iris is per-user and totally ordered with pointer semantics rather than partitioned offsets), and a *selective forwarding unit* is being folded into `media-router`.
- New properties on existing kinds:
  - `stream.totalOrderScope` (global, per-partition, per-entity) — Iris is per-user total order
  - `stream.consumerPointers` (list) — independently advancing pointers per consumer, the whole point of Iris
  - `stream.backingStore` (ref) — the durable tier behind the queue
  - `sql-database.storageEngine` (innodb, myrocks, ...) and `sql-database.compression` (zstandard, ...)
  - `sql-database.replicationMode` (async, semi-sync, sync) with `failoverSeconds`
  - `client.localStore` (ref) and `client.thickness` (thin-cache, full-history) — Messenger is explicitly thin-cache + server history
  - `object-store.unlinkable` (boolean) — attachments indexed by indirection objects, not by account
  - `key-management.rotationTrigger` (time, device-revocation) and `key-management.guessLimit` (integer, Backup Key Vault's 10)
  - `ledger.appendOnly` / `ledger.auditedBy` (external party) for AKD + Cloudflare
- New edge properties: `fanout` (client, server) — client-fanout vs Sender Key server-side fan-out is the decisive Messenger/WhatsApp distinction; `retryWindowDays`; `deliveryReceipt` (boolean).
- New requirement paths: `privacy.e2ee` (none, opt-in, default); `privacy.serverSideHistory` (boolean); `ordering.scope` (per-user, per-thread, global); `sync.model` (pull, push-delta, snapshot-delta).
- New rules (name + one-line condition):
  - `ordered-log-without-durable-backing`: a stream with totalOrderScope per-entity and no backingStore ref while an offline-client requirement exists
  - `single-pointer-couples-delivery-to-storage`: a stream whose only consumer pointer is the durable store while a realtime-gateway also consumes it
  - `thin-client-with-e2ee`: client.thickness thin-cache together with privacy.e2ee default and no encrypted server-side mailbox component
  - `client-fanout-without-device-list-reconciliation`: an edge with fanout client and no server-side device-list check edge
  - `e2ee-attachments-in-account-indexed-blob-store`: object-store holding E2EE attachments with unlinkable false
  - `key-directory-without-external-auditor`: a ledger holding public keys with no third-party-api auditor edge
  - `storage-migration-without-shadow-reads`: a migration edge between two stores with no comparison/verification edge

## Verification 2026-09-14

The card was written on 2026-09-07 against the ten sources above; the full fetch log is
`work/research/facebook-messenger/verify.md`, copied to `work/designs/facebook-messenger/verify.md`.
On 2026-09-14 the two load-bearing primaries were re-fetched and spot-checked; the rest were
re-read from that log.

| url | reachable 2026-09-14 | outcome |
|---|---|---|
| https://engineering.fb.com/2014/10/09/production-engineering/building-mobile-first-infrastructure-for-messenger/ | yes | re-fetched. Confirmed verbatim: "Iris is a totally ordered queue of messaging updates (new messages, state change for messages read, etc.) with separate pointers into the queue indicating the last update sent to your Messenger app and the traditional storage tier"; "We opted to build the queue storage on top of MySQL and flash"; "we decided to use semi-sync replication, which can give you durability across multiple servers ... we can handle database hardware failures in under 30 seconds"; the ~40% non-media data reduction and ~20% send-error reduction |
| https://engineering.fb.com/2018/06/26/core-infra/migrating-messenger-storage-to-optimize-performance/ | yes | re-fetched. Confirmed verbatim: the HBase to MyRocks move; "reduce the replication factor from six to three"; "reduced storage consumption by 90 percent"; "Read latency is now 50 times lower"; the double-writing state; "write traffic to the new (MyRocks) system is queueing up in Iris" |
| the other eight sources (2011 x2, 2020, 2023 post, two 2023 whitepapers, 2025 post, HighScalability) | not re-fetched | all were fetched in full on 2026-09-14 in the research pass and are recorded in `work/designs/facebook-messenger/verify.md`; no fact used by the design rests on a source that pass could not reach |

Corrections and cautions from this pass:

- "Shadow reads" is the card's paraphrase, not the post's wording. The post says read requests
  are issued to both systems and the responses compared ("API validation"). The design's
  migration edge is labelled "responses compared" rather than "shadow reads".
- The 2018 post states the replication factor drop from six to three without attributing the
  six to HBase in that sentence; the design carries `replicationFactor: 6` on `hbase-store` and
  `3` on the post-migration store, which is how the post reads in context.
- Nothing in any source states regions, zones, DAU, messages per second, p50/p95/p99 server
  latency, or a backup policy for any store. None of those appears as a number in the design,
  except the backup and retention properties noted as assumed in `notes.md`.
