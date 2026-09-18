# facebook-messenger: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/facebook-messenger.md` (seven Engineering at Meta posts spanning 2011-2025, two official Meta protocol whitepapers from 2023, and the HighScalability write-up of the @Scale 2014 Iris talk; verification appended to the card).
- Size: 23 nodes, 34 edges, 5 groups (broken variant: 23 nodes, 33 edges, 5 groups).

## Clean variant (header of design.yaml)

Reference architecture: Facebook Messenger, clean variant - Iris, a per-user totally ordered
update queue with independent pointers for the phone and for the storage tier, an MQTT push
channel, the 2011 cell backend, the HBase to MyRocks message-store migration, and the 2023
Labyrinth encrypted server-side mailbox with its key directory and recovery vault.

Fixes relative to facebook-messenger.broken.yaml:
  - iris declares the dead-letter parking lot an offline mailbox needs, so an update that can
    never be applied stops blocking the pointer behind it
  - the mqtt gateway keeps a reconnect stampede guard, so a gateway restart does not turn every
    device's discovery lookup into a storm against ZooKeeper
  - the mqtt gateway does not autoscale and drains the connections it holds, and sessions are
    pinned sticky rather than placed at random, so a business account taking thousands of
    messages per second lands predictably
  - application-server is attached to the ZooKeeper ensemble that owns its consistent hash ring
  - message-store declares backups and a retention period
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: Facebook Messenger, broken variant - the same Iris/MQTT/MyRocks system
built the way a team reaches for it first: an ordered per-user mailbox with nowhere to park an
update that can never be applied, a push gateway that autoscales, places sessions at random and
asks the shard map for every reconnect, application servers on a consistent hash ring that
nobody owns, and a brand new message store that nobody backed up because "Iris still has a
week of it".

This file MUST trip:
  - queue-missing-dlq                          (iris takes async writes from the chat pipeline and declares no parking lot)
  - reconnect-stampede-without-guard           (mqtt-gateway asks zookeeper who owns the user on every connect, unguarded)
  - stateful-websocket-scale-in-without-drain  (mqtt-gateway autoscales and cuts the MQTT sessions it holds)
  - shared-host-per-channel-without-isolation  (mqtt-gateway places sessions at random while accounts take thousands of messages per second)
  - stateful-hash-ring-without-ring-manager    (application-server hashes onto a ring with no link to the ZooKeeper ensemble)
  - datastore-missing-backup                   (message-store, the post-migration system of record, declares no backup)
and MUST NOT trip:
  - cache-missing-eviction-policy              (unread-count-cache declares lru)
  - cache-as-primary-store-without-persistence, materialised-cache-without-rebuild-path (the memcache tier holds neither the only copy nor a materialised view)
  - credentials-without-rotation               (the design still declares a rotation period)
  - cross-cell-call                            (the design declares no cell tenancy requirement; only one cell is drawn)
  - retry-queue-without-dlq, retry-without-backoff (iris is an offline mailbox, not a retry queue)
  - datastore-single-region, read-heavy-path-without-cache, single-writer-primary-at-peak-qps,
    read-replica-as-sole-scaling              (no multi-region promise, no read/write ratio and no rps is stated for any store)
  - fanout-inline-in-request-path, push-fanout-without-celebrity-path, shared-worker-pool-across-queues (no worker node exists)
  - derived-store-without-cdc-or-rebuild, business-updates-without-index-propagation (no search index)
  - stateful-engine-pinned-to-single-zone, stateful-node-without-zone-redundancy (no availability-zone group is drawn)
  - sync-chain-too-deep                        (no api-gateway node and no p95 target)

The defects are the ones the sources themselves point at. Iris exists precisely so that a
pointer that cannot advance does not stop the others - "when your phone is offline, or there is
a disk outage, the pointer stays in place while new messages can still be enqueued and other
pointers advanced" - and the broken twin removes the only place a permanently undeliverable
update could be parked. The push channel is the 2011 post's whole subject, and a gateway that
autoscales, drops sessions on scale-in, spreads them at random and re-reads the shard map on
every connect is the reconnect storm that model is built to avoid, against accounts the 2018
post says receive "up to thousands of messages per second". The unowned hash ring inverts the
2011 statement that each application server cluster is controlled by a set of ZooKeeper
machines. The unbacked message store is the 2018 migration's own risk: a brand new system of
record trusted because the queue in front of it holds a week.

## Mapping

| source box | node | component | kind | confidence |
|---|---|---|---|---|
| Messenger app (iOS / Android / web) | `messenger-app` | `mobile-app` | client | close (one node for three platforms; the 2020 post notes the web platform's different constraints, which no property expresses) |
| Recipient devices (the other devices client-fanout addresses) | `recipient-device` | `user-device` | client | close (the whitepapers draw them as "each device of the recipient", not as one box) |
| MQTT connection | `mqtt-gateway` | `websocket-gateway` | realtime-gateway | close (the generic realtime gateway; the mqtt protocol is carried on the edges, not the node) |
| Chat pipeline / chat servers | `chat-pipeline` | `container-service` | app-server | exact |
| Server Broker | `server-broker` | `container-service` | app-server | exact |
| Application servers (cell) | `application-server` | `vm-service` | app-server | close (`shardingStrategy: consistent-hash` is the stated ring of virtual positions; the API / distributed-logic / business-logic / data-access layering inside the box is one node) |
| ZooKeeper cluster + discovery service | `zookeeper` | `zookeeper` | coordination-service | close (two source boxes merged: the 2011 post describes discovery as the user-to-cell lookup backed by the same ZooKeeper shard map) |
| Per-cell metadata store | `metadata-store` | `hbase` | nosql-database | exact ("We use HBase as our metadata store") |
| Memcache dirty service | `unread-count-cache` | `memcached` | cache | close (the source draws the invalidation service; the design draws the cache it invalidates, with `invalidation: event`) |
| User index service | `user-index-service` | `container-service` | app-server | exact |
| Iris | `iris` | `message-queue` | queue | close (`role: offline-mailbox`, `ordering: global`, `retentionDays: 7`; no kind expresses per-user total order with independently advancing consumer pointers - see "Not encoded") |
| Iris backing store (MySQL on flash) | `iris-backing-store` | `mysql` | sql-database | exact (`replication: sync` is the stated semi-sync durability across servers) |
| Traditional storage tier (HBase, 2010-2018) | `hbase-store` | `hbase` | nosql-database | exact (`replicationFactor: 6` pre-migration) |
| New message store (MyRocks, 2018+) | `message-store` | `mysql` | sql-database | close (MyRocks is a MySQL storage engine; no `storageEngine` property exists, so the engine and the Zstandard compression survive only in the label) |
| Prekey / device key server | `prekey-server` | `container-service` | app-server | assumed (kind `key-management` has no vendor-neutral component; the box is an in-house Meta service, so the app-server generic carries it with `ownsData: true`) |
| Labyrinth mailbox metastore | `labyrinth-metastore` | `relational-database` | sql-database | close (the whitepaper calls it operational protocol data; a schema is given only for the mailbox) |
| Labyrinth mailbox | `labyrinth-mailbox` | `relational-database` | sql-database | exact ("message ciphertexts in a structured database", `encrypted_messages` schema given) |
| Blob store (E2EE attachments) | `attachment-blob-store` | `blob-store` | object-store | exact (the whitepaper names no product: "stored in a separate data store from messages") |
| Backup Key Vault | `backup-key-vault` | `container-service` | app-server | assumed (an HSM-style vault; every `key-management` component is a named third-party product, none of which Meta uses here) |
| Auditable Key Directory (AKD) | `akd` | `nosql-store` | nosql-database | assumed (the append-only auditable directory; `ledger` holds only blockchain and double-entry products, none of them a key directory) |
| Cloudflare key transparency auditor | `cloudflare-auditor` | `supplier-api` | third-party-api | exact |
| iCloud Drive / Google Drive escrow | `cloud-drive-escrow` | `supplier-api` | third-party-api | close (two platform SDKs drawn as one third-party box, as the whitepaper does) |
| Franking service | `franking-service` | `container-service` | app-server | exact |
| Client SQLite database | - | - | - | not encoded (embedded in the device; a `sqlite` component exists but the format has no way to nest a store inside a client node) |
| MSYS | - | - | - | not encoded (a cross-platform C library linked into the app, not a deployable node) |
| Haystack | - | - | - | not encoded (the 2011 email-attachment path; no `haystack` component exists and the path is outside the messaging design) |
| MTA proxy | - | - | - | not encoded (the inbound-email ingress of the 2011 Messages product, not part of Messenger's chat path) |
| SFU (group calls) | - | - | - | not encoded (calling is a separate media plane; encoding it would add a `media-router` and two device edges that share nothing with the messaging path) |

Tally: 10 exact, 10 close, 3 assumed; 5 source boxes deliberately not encoded.

Boundaries: `user-devices`, `meta-transport`, `meta-backend` and `third-parties` are the four
trust zones the 2023 sources name - devices hold all plaintext and keys, transport is TLS/QUIC
plus "Noise Pipes with Curve25519, AES-GCM, and SHA-256", the backend is explicitly untrusted
for message content under E2EE, and Cloudflare and the cloud drives sit outside Meta.
`messenger-cell` (`cell`, nested in `meta-backend`) is the 2011 topology: "The entire system is
divided into cells, and each cell contains only a subset of users". No `region` or
`availability-zone` group: no source names regions, zones or a failover topology for Messenger.

Requirements encoded: `availability.degradedModeAllowed` (the pointer stays in place through a
disk outage while delivery continues), `messaging.replay` (an offline client resumes from its
pointer; Iris also replayed the migration), `messaging.orderingScope: partition` (per-user total
order, the nearest scope the format offers), `traffic.skew: heavy-tail` (accounts receiving "up
to thousands of messages per second").

Assumed rather than sourced, flagged here because the brief requires it:

- **Backup and retention on every durable store** (`backupEnabled: true`,
  `backupRetentionDays: 30`). No source states a backup policy. The Labyrinth whitepaper does
  say Meta's backend storage "includes backup systems that can be used for a limited time
  period after data deletion", which is the only support for backups existing at all; the
  30-day number is the design's assumption, and `datastore-missing-backup` reads both
  properties.
- **`security.credentialRotationDays: 90`**: never discussed in any source. Set because
  `credentials-without-rotation` is design-wide.
- **`unread-count-cache` `evictionPolicy: lru`**: memcached's documented default, not a stated
  Messenger setting.
- **`metadata-store` `replicationFactor: 3`**: the per-cell metadata store's factor is never
  given; 3 is the family default. The 6 on `hbase-store` is stated.

## Catalogue gaps

Recorded in full in `work/designs/facebook-messenger/gaps.md`. The substantive ones:

- **No component for an append-only auditable key directory.** AKD is open source
  (`facebook/akd`) and has no entry; `ledger` under `default` holds only `double-entry-ledger`,
  `formance`, `hyperledger-fabric` and `tigerbeetle`, none of them a key directory, so AKD lands
  on `nosql-store` with `partitionKey: device_id`.
- **No vendor-neutral `key-management` component.** Every one is a named product (HashiCorp
  Vault, Thales Luna, Azure Key Vault, ...), so the prekey server and the Backup Key Vault -
  both in-house Meta services - fall back to `container-service`.
- **No `haystack` component** for Meta's object store, and no `myrocks` component or
  `sql-database.storageEngine` property for the store the whole 2018 post is about.
- **The `queue` kind cannot express Iris.** There is no component for Iris and no property for
  a per-entity total order with independently advancing consumer pointers; see "Not encoded".

## Not encoded

- **Iris's pointer semantics**, the single idea the 2014 architecture rests on: one enqueue, two
  independently advancing pointers, one for the phone and one for the disk tier, so a storage
  outage stalls durability without stalling delivery. The design draws the two consumers as two
  async out-edges; nothing says the pointers are independent, or that the app pointer advances
  only on a successful send. `ordering: global` is the closest the `queue` kind gets to "totally
  ordered per user", and `messaging.orderingScope: partition` carries the per-user part at the
  design level.
- **Snapshot + delta sync.** The client detects that it is out of sync by sequence number and
  falls back to a full snapshot. Both directions are one edge each; there is no way to say that
  one request degrades into the other, nor that the payload moved from JSON to Thrift.
- **The client's own architecture**: SQLite as the single source of truth, stored procedures
  carrying feature logic, and MSYS's retriable task queue. All of Project LightSpeed lives
  inside one `mobile-app` node.
- **The migration state machine.** not-migrated to double-writing to done, the response
  comparison, the revert plan, the accounting job and the separate buffered flow for hot
  accounts are one batched async edge from `hbase-store` to `message-store` plus a label. The
  format has no notion of an edge that exists only during a migration, so both stores are drawn
  as live at once - which was true at no single point in time.
- **Client fan-out arithmetic.** "The Messenger client transmits a single message N number of
  times to N number of different devices" is one edge; there is no `fanout: client` property, so
  nothing distinguishes it from the server-side Sender Key fan-out used for groups, which is
  therefore not drawn as a separate edge either.
- **Retry receipts and the encrypt journal.** The 30-day window, the refusal to honour a retry
  after a delivery receipt or after an identity-key change, and the journal entry that expires
  at 30 days are all behaviour of one push edge.
- **Epochs, key rotation and revocation.** The epoch root key, epoch membership MACs, the ORF
  indirection that makes attachments unlinkable, and the "revoked devices are threat actors"
  premise that drives all of Labyrinth's complexity have no properties; `encryptionAtRest` and
  an edge label are all that survive. The whitepaper's stated shipped gaps (epoch rotation not
  implemented on device removal, client ORF keys accessible to the server, epoch truncation by a
  malicious server) have no representation at all.
- **Calls.** 1:1 WebRTC peer-to-peer with the PreKey Bundle in the SDP offer, and group calls
  through an SFU with SFrame over SRTP, are a second plane sharing no node with messaging.
- **Numbers that belong to no node**: the ~40% data-usage and ~20% send-error reductions, the
  90% storage reduction, the 50x read-latency improvement, 1.7M to 360k lines of client code,
  the ~2-minute AKD epoch and its billions of key entries. None is an `nfr` on a box, and no
  node carries `nfr.rps`: no source states a per-box rate.
