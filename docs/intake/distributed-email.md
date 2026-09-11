# Intake: Distributed email service (Xu vol 2 ch 8) with Fastmail storage and Gmail spam pipeline

## Source
- Primary: Alex Xu and Sahn Lam, System Design Interview vol 2, chapter 8 "Distributed Email Service"; official course page https://bytebytego.com/courses/system-design-interview/distributed-email-service (shell only in this pass) and chapter notes via search summaries of https://books.dwf.dev/docs/system-design/c24 (fetch failed) and Devin Z book notes (Medium 403)
- Primary: https://www.fastmail.help/hc/en-us/articles/1500000278242 (official Fastmail storage architecture: slots, stores, Cyrus replication, failover) and https://www.fastmail.com/blog/standalone-mail-servers/ (official: standalone servers vs SAN, proxy and central user database)
- Primary: https://workspace.google.com/blog/product-announcements/ridding-gmail-of-100-million-more-spam-messages-with-tensorflow (official Google: 99.9% spam blocked, +100M/day with TensorFlow)
- Secondary (unofficial, marked): https://sysdesign.wiki/systems/gmail/ Gmail-inspired design, explicitly not the production architecture; used only for pipeline stage naming
- Cross-references: notification-system (SMTP as a channel), google-drive (blob store, per-user sharding), search-autocomplete and airbnb-search (search index), whatsapp-messaging (store-and-forward), key-value-store (Cassandra data model)
- Verified by: canonical textbook chapter + official Fastmail architecture docs + official Google post
- Confidence: high
- Date of source: 2014-2024

## System in three lines
Sends, receives, stores and searches email for a billion mailboxes: outbound mail goes from web servers into an outgoing queue, through spam and virus checks and SMTP workers to the recipient's mail exchanger; inbound mail lands on SMTP servers, is queued, checked, written to a per-user metadata store (wide-column, sharded by user id, denormalised per folder and read status) with attachments in object storage, indexed asynchronously for search, and pushed to online clients over a real-time channel. Fastmail's production variant keeps each user's mailbox on one standalone IMAP server slot replicated to two others across sites with sub-30-second failover and a small central database mapping users to stores. Hard because email is store-and-forward with retries, one user's mailbox must not slow another's, spam is adversarial, and search over decades of mail must stay per-user.

## Scale (only if stated)
- Users / DAU: book 1B users; each sends 10 and receives 40 emails per day
- Requests per second: book ~100,000 emails sent per second at peak (10 per user per day, uneven)
- Data volume: book ~50 KB metadata per email, ~730 PB/year of metadata; attachments ~500 KB average, ~1.46 EB/year (book estimates)
- Message throughput: Gmail blocks "more than 99.9 percent of spam, phishing, and malware" plus "around 100 million additional spam messages every day" with TensorFlow
- Latency: Fastmail store failover "under 10 seconds", up to 30 seconds; weekly replication verification

## Requirements stated or clearly implied
- Availability target: no single pool of IO (Fastmail rejected SAN after a cascading failure); spare capacity on every machine to absorb failed slots
- Consistency: per-mailbox strict IMAP semantics (UID, MODSEQ) to prevent split brain on forced failover (Fastmail); book eventual consistency for search index
- Latency target: inbox load from cache; real-time push for new mail
- Ordering needs: per mailbox by timestamp; folder listings denormalised
- Replay or reprocessing: outgoing queue retries with backoff; deferred delivery on remote failure (SMTP standard)
- Retention: user-controlled; Fastmail tiers recent mail on SSD, older on slower disks
- Compliance / residency: ZFS native encryption at rest (Fastmail); TLS in transit, SPF, DKIM, DMARC validation (standard)
- Integrity: CRC32 per record and SHA1 per message file plus ZFS checksums (Fastmail)

## Boundaries
- Regions / zones: Fastmail three slots per store, master plus two replicas across sites; book multiple data centres
- Trust zones: internet SMTP peers (untrusted) -> inbound mail servers -> spam and virus checks -> internal storage; clients via load balancer and web or IMAP proxies
- Named subsystems: Web servers, Real-time servers, Metadata DB, Attachment store, Distributed cache, Search store, Outgoing queue and SMTP workers, Incoming mail servers and queue, Mail processing workers, Spam and virus checkers; Fastmail: proxies, central user-to-store DB, stores of Cyrus slots, Postfix inbound and outbound

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Clients | Web, mobile, IMAP and JMAP clients | apps | web-client, mobile-client | |
| 2 | Load balancer | Spreads client traffic | not named | load-balancer | |
| 3 | Proxy layer (Fastmail) | Routes IMAP, POP, SMTP submission to the user's backend | nginx/perl proxies | database-proxy analogue for mail; api-gateway | routingBy: userToStoreMap |
| 4 | Central user DB (Fastmail) | Maps users to stores; small role | MySQL | sql-database | role: routing-directory |
| 5 | Web servers | Auth, compose, read, folder ops | in-house | app-server | |
| 6 | Real-time servers | Push new-mail events to online clients | WebSocket servers | realtime-gateway | protocol: websocket |
| 7 | Metadata DB | Emails per user, per folder, read status denormalised; sharded by user id | Cassandra (book) | nosql-database | partitionKey: userId; denormalised: true |
| 8 | Mail store (Fastmail) | Per-slot Cyrus IMAP instance on ZFS; store of three replicated slots | Cyrus IMAP | mail-store (candidate) or app-server + block storage | slotsPerStore: 3; replication: master-replica |
| 9 | Attachment store | Large blobs, referenced by metadata | S3 (book) | object-store | |
| 10 | Distributed cache | Recent emails and inbox pages | Redis (book) | cache | |
| 11 | Search store | Full-text index, per user, async indexed | Elasticsearch (book); Xapian on RAM fs (Fastmail) | search-index | shardingStrategy: per-user; indexing: async |
| 12 | Outgoing email queue | Buffers sends before SMTP workers | Kafka or similar | queue | retry: backoff; dlq: true |
| 13 | SMTP outgoing workers | Deliver to remote MX; retry and bounce | Postfix (Fastmail) | worker + mail-transfer-agent (candidate) | |
| 14 | Incoming mail servers | Accept SMTP from internet; validate SPF/DKIM/DMARC | Postfix (Fastmail) | mail-transfer-agent (candidate) | |
| 15 | Incoming email queue | Buffers received mail before processing | Kafka or similar | queue | |
| 16 | Mail processing workers | Write metadata, attachments, fan to search and push | in-house | worker | |
| 17 | Spam and virus check | Rules plus ML classifiers, attachment scanning | in-house; Gmail TensorFlow models | ml-inference + content-scanner (candidate) | blockRate: 0.999 |
| 18 | DNS / MX | Resolves recipient mail exchangers; SPF and DKIM records | DNS | dns | |
| 19 | Backups / replication verification | Weekly verification, replicas across sites | Cyrus sync | scheduled-job | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | load balancer | https / imap | sync | | |
| proxy | central user db | sql | sync | | route lookup |
| proxy | mail store slot | imap | sync | | user's master slot |
| web server | metadata db | cql | sync | | |
| web server | cache | redis | sync | | inbox pages |
| web server | attachment store | https | sync | | upload, signed reads |
| web server | outgoing queue | produce | async | at-least-once | send |
| outgoing queue | spam/virus check | consume | async | | outbound scan |
| smtp worker | remote mx | smtp over tls | sync with retries | at-least-once (retry, bounce) | dns mx lookup |
| remote sender | incoming mail server | smtp | sync | | spf, dkim, dmarc |
| incoming mail server | incoming queue | produce | async | at-least-once | |
| incoming queue | mail processing workers | consume | async | at-least-once | |
| workers | spam/virus check | rpc | sync | | |
| workers | metadata db + attachment store | write | sync | | |
| workers | search store | index | async | eventual | |
| workers | real-time servers | publish | async | | online users |
| real-time server | client | websocket | async | at-most-once | |
| master slot | replica slots | cyrus sync | async | | log of changed mailboxes |

## Failure modes, incidents, tradeoffs the source discusses
- Shared storage cascade: Berkeley SAN drive loss caused load spike and total outage; Fastmail keeps each server independent so failures stay local. Source: Fastmail blog.
- Forced failover split brain: divergent changes on two slots; solved by strict UID and MODSEQ semantics in the rewritten replication protocol (Cyrus 2.4). Source: Fastmail.
- Spare capacity: every machine keeps headroom to absorb slots from a failed server. Source: Fastmail.
- Attachments in the wide-column store: blob limit under 1 MB and row cache pollution; put them in object storage. Source: book.
- Search freshness vs write cost: async reindexing gives eventual consistency; native DB search vs Elasticsearch trade. Source: book.
- Spam is adversarial and personal: thousands of signals per message, personalised decisions, rules kept alongside ML; parallel model experiments. Source: Google.
- Store-and-forward retries: outbound delivery must retry on transient MX failures and bounce on permanent ones (SMTP standard, book send flow).
- Integrity: checksums at every layer catch silent corruption. Source: Fastmail.

## Unknowns
- Book's exact Cassandra table set and queue product
- Fastmail's spam stack, Postfix topology and backup procedure (not in the architecture doc)
- Gmail production storage (Bigtable/Spanner claims are unofficial)

## Candidates
- New kinds: mail-transfer-agent (SMTP inbound and outbound relay; 1st sighting, notification-system used SMTP as a channel), content-scanner (spam and virus scanning as a boundary service; 1st sighting), mail-store (IMAP mailbox server, 1st sighting; may fold into app-server with stateful storage); sightings: queue (14th: outgoing and incoming), object-store (24th), nosql-database (27th), search-index (11th), realtime-gateway (13th), worker (13th), cache (27th), load-balancer (10th), dns (6th), ml-inference (spam), sql-database (18th: routing directory), scheduled-job (15th)
- New properties on existing kinds: nosql-database.denormalised (boolean); search-index.indexing (sync, async), shardingStrategy per-user (2nd sighting); queue.retryBackoff (boolean), bounceHandling (boolean); realtime-gateway.protocol (2nd sighting); app-server.replication (master-replica), slotsPerStore, failoverSeconds; object-store.encryptionAtRest (boolean); dns.records (mx, spf, dkim, dmarc)
- New edge properties: authenticated (spf, dkim, dmarc); retryPolicy (backoff, bounce)
- New requirement paths: integrity.checksums (boolean); isolation.perUserBlastRadius (boolean); email.spamBlockRate
- New rules:
  - blobs-in-wide-column-store: nosql-database nodes with edges carrying attachment or media payloads and no object-store in the design
  - inbound-smtp-without-scanner: mail-transfer-agent inbound edge writes to storage with no content-scanner on the path
  - outbound-queue-without-retry-or-bounce: outgoing queue to third-party mail exchangers with retryBackoff false and no bounce handling
  - search-index-sync-on-write-path: search-index indexing sync on a high write rate mail path (latency)
  - shared-storage-pool-for-isolated-tenants: isolation.perUserBlastRadius true while mail stores share one block-storage node
  - replicated-store-without-split-brain-guard: master-replica app-server with forced failover and no monotonic sequence guarantee (informational)
