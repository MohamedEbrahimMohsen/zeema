# distributed-email: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/distributed-email.md` (intake card plus the 2026-09-14 verification section).
- Size: 22 nodes, 29 edges, 5 groups (the broken twin has 22 nodes, 30 edges, 5 groups).

## Clean variant (header of design.yaml)

Reference architecture: a distributed email service - the textbook send/receive pipeline (web and
IMAP clients, outgoing and incoming queues, SMTP workers, per-user metadata, attachments, search)
wired to Fastmail's production mailbox storage (nginx proxies, a central user-to-store database,
a master Cyrus slot replicated to slots at a second site) and a spam and virus classifier.

Fixes relative to distributed-email.broken.yaml:
  - web-server hands the send to outgoing-queue asynchronously; the queue is a work queue with a
    dead-letter queue, exponential backoff with jitter and a bounded attempt count, not a bare
    retry loop that nothing ever drains
  - the hop from outgoing-queue to smtp-outbound-worker is at-least-once, because delivery to a
    remote mail exchanger is a retried external side effect that exactly-once cannot cover;
    smtp-outbound-worker retries with exponential backoff behind a circuit breaker and bounces
    on a permanent failure
  - each queue has its own consumer: incoming-queue feeds mail-processing-worker, outgoing-queue
    feeds smtp-outbound-worker, so one poisoned pipeline cannot starve the other
  - realtime-server does not autoscale and drains its sockets on scale-in, so a scale-down is not
    a reconnect storm across every online mailbox
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: the same distributed email service, built the way a team builds it the
first time - the web server enqueues the send synchronously into a bare retry queue with no
dead-letter queue and no backoff, the delivery hop to the SMTP workers is labelled exactly-once
even though the next hop is a remote mail exchanger, one worker pool drains both the inbound and
the outbound queue, and the real-time tier autoscales without draining its sockets.

This file MUST trip:
  - retry-queue-without-dlq                    (outgoing-queue: role retry, deadLetterQueue false)
  - retry-without-backoff                      (outgoing-queue declares no backoff)
  - exactly-once-with-external-side-effects    (outgoing-queue -> smtp-outbound-worker claims
                                                exactly-once; smtp-outbound-worker then calls
                                                remote-mx, a third-party-api, synchronously)
  - shared-worker-pool-across-queues           (mail-processing-worker consumes both incoming-queue
                                                and outgoing-queue while isolation.perQueue is true)
  - stateful-websocket-scale-in-without-drain  (realtime-server autoscales, drainOnScaleIn false)
and MUST NOT trip: queue-missing-dlq, retry-without-adaptive-shedding,
derived-store-without-cdc-or-rebuild, business-updates-without-index-propagation,
datastore-missing-backup, datastore-single-region, the three cache rules,
external-call-inline-without-durable-path, fanout-inline-in-request-path,
credentials-without-rotation, read-heavy-path-without-cache,
shared-dependency-without-redundancy, the two single-zone rules, and every rule whose kind is
absent from this design. The reasons are spelled out in the file's own header.

Each mistake is one the sources describe. SMTP is store-and-forward: a transient MX failure must
be deferred with backoff and a permanent one bounced, and a message that can never be delivered
has to be parked somewhere - a retry queue with neither backoff nor a dead-letter queue is the
classic first version. Delivery to a remote mail exchanger is the textbook external side effect
that no exactly-once claim can cover. Fastmail's whole architecture exists so that one user's
mailbox cannot slow another's ("there was one single pool of IO, this meant every single user was
offline"); one worker pool draining both pipelines re-creates exactly that coupling at the queue
layer. And a real-time push tier that sheds instances without draining turns every scale-down
into a reconnect storm across every online mailbox.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Clients (web) | `web-client` | `web-browser` | client | exact |
| Clients (mobile, IMAP, JMAP) | `mail-client` | `mobile-app` | client | close |
| Load balancer | `load-balancer` | `load-balancer-tier` | load-balancer | close |
| Proxy layer (Fastmail nginx IMAP/POP/SMTP frontend) | `imap-proxy` | `nginx` | load-balancer | exact |
| Central user DB (Fastmail) | `user-store-db` | `mysql` | sql-database | assumed |
| Web servers | `web-server` | `container-service` | app-server | close |
| Real-time servers | `realtime-server` | `websocket-gateway` | realtime-gateway | close |
| Metadata DB | `metadata-db` | `cassandra` | nosql-database | close |
| Mail store, master slot (Fastmail Cyrus) | `mail-store-master` | `vm-service` | app-server | close |
| Mail store, replica slots (Fastmail Cyrus) | `mail-store-replica` | `vm-service` | app-server | close |
| Attachment store | `attachment-store` | `blob-store` | object-store | close |
| Distributed cache | `inbox-cache` | `redis` | cache | close |
| Search store | `search-index` | `elasticsearch` | search-index | close |
| Outgoing email queue | `outgoing-queue` | `message-queue` | queue | close |
| SMTP outgoing workers | `smtp-outbound-worker` | `container-worker` | worker | close |
| Incoming mail servers | `inbound-smtp-server` | `container-service` | app-server | close |
| Incoming email queue | `incoming-queue` | `message-queue` | queue | close |
| Mail processing workers | `mail-processing-worker` | `container-worker` | worker | close |
| Spam and virus check | `spam-virus-check` | `tensorflow-serving` | ml-inference | close |
| DNS / MX | `mx-dns` | `dns-resolver` | dns | close |
| Recipient mail exchanger (remote MX) | `remote-mx` | `smtp-relay` | third-party-api | exact |
| Backups / replication verification | `replication-verifier` | `cron-job` | worker | close |

Boundaries: `site-a` / `site-b` (region) are Fastmail's master site and the site holding the
replica slots; `internet` (trust-zone) holds the untrusted SMTP peers and public DNS; `edge` and
`core` (trust-zone, both under `site-a`) separate the internet-facing tier from the storage tier.

Tally: 3 exact, 18 close, 1 assumed.

Two card rows were merged into one edge pair rather than one node each. The card's
`outgoing queue -> spam/virus check` arrow is drawn here as `outgoing-queue ->
smtp-outbound-worker -> spam-virus-check`, because a queue does not call a classifier; the worker
that drains it does. The card's single "Clients" row is split into a browser and a mail client,
because the two enter the system through different front doors (web servers vs the IMAP proxy).

### Property values set for rule-cleanliness rather than from a source

The brief's rule applies: where the source is silent but the rule encodes a practice the real
system certainly has, the property is set and flagged here.

- `user-store-db.backupEnabled: true` and `backupRetentionDays: 30`. Neither Fastmail page states
  a backup policy for the central database. 30 days is a placeholder; the fact being encoded is
  that the routing directory is backed up.
- `user-store-db.replication: "async"`. The fetched pages say only "our database". Fastmail's
  entire architecture is built on replication, and the design declares `availability.multiRegion`.
- `security.credentialRotationDays: 90`. No source states a rotation period.
- `inbox-cache.evictionPolicy: "lru"`. The book's distributed cache is described by role, not by
  eviction policy.
- `outgoing-queue` / `incoming-queue` `deadLetterQueue: true`, `backoff: "exponential-jitter"`,
  `maxAttempts: 10`. SMTP's deferred-delivery and bounce behaviour is the documented practice; the
  specific numbers are not from a source.
- `smtp-outbound-worker -> remote-mx` `retryPolicy: "exponential"` and `circuitBreaker: true`.
  Retry-and-bounce is standard SMTP and is in the card; the circuit breaker is not stated anywhere
  and is set so the retry does not read as an unshed retry storm.

Every other property value comes from a fetched source: three slots per store, master plus
replicas, the weekly folder comparison, ZFS encryption at rest (as `encryptionAtRest`),
per-message checksums (as `checksumOnWrite` on the attachment store), the sub-30-second failover
(carried in an edge label), per-user sharding of the metadata store, and the 100k emails per
second send rate (as `nfr.rps` on `outgoing-queue` and `smtp-outbound-worker`).

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Postfix as an in-house inbound / outbound mail transfer agent | `mail-transfer-agent` (SMTP relay with `spfCheck`, `dkimCheck`, `dmarcPolicy`, `deferralQueue`, `bounceHandling`) | `container-service` for `inbound-smtp-server` and `container-worker` for `smtp-outbound-worker`. The `postfix` component exists but is kind `third-party-api`, which models calling someone else's relay, not running one. |
| Cyrus IMAP slot / store (a stateful mailbox server with N replicated slots and a forced-failover protocol) | `mail-store` (or `app-server` with `slotsPerStore`, `failoverSeconds`, `replication: master-replica`) | two `vm-service` nodes, master and replica, joined by a `cyrus-sync` async edge. `slotsPerStore: 3` and the sub-30-second failover survive only as a label. |
| Spam and virus scanning as a boundary service | `content-scanner` (rules plus ML, `attachmentDetonation`, `blockRate`) | `tensorflow-serving` under kind `ml-inference`, which carries the Gmail TensorFlow fact but not the rules half or the 99.9% block rate. `email-security-gateway` exists as a kind but has a component only under `cloudflare`, and it models a managed inline-MX product, not an internal checker. |
| ZFS dataset / RAM filesystem under a Cyrus slot | `block-storage` attached to an `app-server` | not encoded; `encryptionAtRest` is carried on the stores that have the property. |

Nothing was added to `components/`.

## Not encoded

- Storage volumes. The book's 50 KB of metadata per email, ~730 PB/year of metadata, ~500 KB
  average attachment and ~1.46 EB/year have no field in the format; `nfr` carries rate, not size.
- The 99.9% spam block rate and "around 100 million additional spam messages every day". There is
  no `blockRate` property on `ml-inference` and no requirement path for it.
- Integrity. CRC32 per Cyrus index record and SHA1 per message file collapse into one
  `checksumOnWrite` boolean on the attachment store; there is no `integrity.checksums` requirement.
- Per-user blast radius. Fastmail's central claim - one user's mailbox on one store, nothing
  shared - has no requirement path. `isolation.tenancy: "dedicated"` is the nearest expression;
  the stores are not modelled as `cell` groups because a cell group would make every proxy hop a
  `cross-cell-call`.
- Split-brain protection. The UID / MODSEQ monotonicity that makes a forced failover safe, and the
  re-UID repair that follows one, have no property; the design says only that the master
  replicates to the replicas.
- Spare capacity. "A few free slots on every machine" is a placement rule, not a node property.
- Three slots per store. `instances: 2` on `mail-store-replica` plus the master is the count; there
  is no `slotsPerStore`.
- SPF, DKIM and DMARC validation, and TLS in transit. Carried in edge labels only; edges have no
  `authenticated` field in v1.
- Retention tiering (recent mail on SSD, older on slower disk). Stated by the card, not by the
  fetched storage article, and the format has no tiering field beyond the object store's
  hot/warm/cold.
