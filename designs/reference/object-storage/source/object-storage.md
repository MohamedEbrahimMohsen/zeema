# Intake: S3-like object storage (Xu vol 2 ch 9) with Facebook f4 and Amazon S3 production evidence

## Source
- Primary: Alex Xu and Sahn Lam, System Design Interview vol 2, chapter 9 "S3-like Object Storage"; author's summary https://blog.bytebytego.com/p/design-a-s3-like-storage-system (terms, components, upload flow readable; deep-dive sections from the book)
- Primary: Muralidhar et al., "f4: Facebook's Warm BLOB Storage System", OSDI 2014 https://www.usenix.org/system/files/conference/osdi14/osdi14-paper-muralidhar.pdf via https://blog.acolyer.org/2014/12/16/f4-facebooks-warm-blob-storage-system/ (peer-reviewed; Haystack hot tier, f4 warm tier, RS(10,4), XOR across datacenters)
- Primary: https://highscalability.com/behind-aws-s3s-massive-scale/ (write-up of AWS talks and posts by S3 engineers: 100M req/s, 280T objects, four service tiers, ShardStore, durability practices) and https://hidekazu-konishi.com/entry/how_amazon_s3_achieves_consistency_and_durability.html (cites official AWS posts on 2020 strong consistency: Witness, per-object ordering, coherent metadata cache)
- Cross-references: google-drive (Magic Pocket: cells, zones, erasure coding, durabilityNines), youtube-upload-playback (blob serving), distributed-email (attachment store), key-value-store (LSM storage node)
- Verified by: canonical textbook chapter + peer-reviewed Facebook paper + AWS engineer talks via write-ups
- Confidence: high
- Date of source: 2014-2024

## System in three lines
Stores immutable object payloads under globally unique bucket names with mutable metadata kept separately: an API service authorises through IAM, writes the payload to a data store that appends small objects into large files with offsets on data nodes chosen by a placement service and replicated primary-to-secondary, then records object metadata in a sharded metadata database keyed by bucket and object. Durability comes from replication for hot data and erasure coding for warm data (f4 uses Reed-Solomon 10,4 plus cross-datacenter XOR for an effective 2.1x; S3 spreads shards over at least three availability zones), with checksums on every hop and background auditors and rebuilders repairing lost redundancy. Hard because durability is a designed target proved by threat models and repair rate rather than measured, listing and versioning need a metadata store that scales with billions of keys, and strong read-after-write over a cache needs a consistency witness.

## Scale (only if stated)
- Users / DAU: S3 serves "100 million per second" requests and "400 terabits per second" (highscalability)
- Requests per second: same; book: design for high throughput, moderate object count (book exercises ~100 PB)
- Data volume: S3 280 trillion objects across 31 regions and 99 availability zones; f4 65 PB logical, 53 PB saved; f4 cell 14 racks x 15 hosts, 6,300 x 4 TB drives
- Message throughput: drives capped near 120 IOPS; workload decorrelation across millions of tenants smooths load (S3)
- Latency: not numeric; range requests and multipart parallelism for throughput

## Requirements stated or clearly implied
- Availability target: S3 99.99% availability design; f4 tolerates disk, host, rack and datacenter failures
- Consistency: S3 strong read-after-write since December 2020; per-object operation ordering, last-writer-wins only for truly concurrent writes; conditional requests via ETag compare-and-swap
- Latency target: reads from metadata cache when the witness confirms freshness
- Ordering needs: per object; no global sequencer
- Replay or reprocessing: rebuilder and backoff nodes reconstruct blocks; self-healing repair fleet scales with failure rate
- Retention: versioning and object lock separate from durability; garbage collection of deleted and superseded versions (book)
- Compliance / residency: IAM authorisation per request; regional buckets
- Durability: 11 nines designed target, "not a measured loss rate"; checksums in HTTP trailers; continuous integrity audits

## Boundaries
- Regions / zones: S3 objects span at least three AZs; f4 cells per datacenter with XOR parity across two datacenters; book replicates to several data nodes in different zones
- Trust zones: public REST endpoint -> API service with IAM -> internal metadata and data services
- Named subsystems: Load balancer, API service, IAM, Metadata service and DB, Data store (data routing service, placement service, data nodes), Garbage collector; S3: front-end fleet, namespace (index) service, storage fleet, storage management fleet (replication, tiering), Witness; f4: router tier, name node, storage nodes, backoff nodes, rebuilder nodes, coordinator nodes

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Load balancer | Spreads REST traffic | not named | load-balancer | |
| 2 | API service | Stateless REST for buckets and objects; orchestrates IAM, metadata, data | S3 front-end fleet | api-gateway + app-server | stateless: true |
| 3 | IAM | Authn and authz per request | AWS IAM | identity-provider (candidate) / authorization-service | |
| 4 | Metadata service | Bucket and object metadata, listing, versioning | S3 namespace service | app-server | |
| 5 | Metadata DB | bucket table; object table sharded by (bucket_name, object_name) hash; version column | relational, sharded (book) | sql-database | sharded: true; shardKey: bucket+objectName |
| 6 | Metadata cache + Witness (S3) | Cached metadata; in-memory witness validates freshness before serving | S3 Witness | cache + coordination-service | readBarrier: true |
| 7 | Data routing service | Chooses nodes via placement, streams payload, returns UUID | book | app-server (router); f4 router tier | |
| 8 | Placement service | Virtual cluster map; decides node set per object; heartbeats; Paxos or Raft replicated | book | control-plane-coordinator | consensus: raft |
| 9 | Data nodes | Store payloads; append small objects into large files with offsets; replicate primary to secondaries | book; S3 ShardStore (Rust LSM); f4 storage nodes | object-store (data tier) / block storage | replication: primary-secondary; appendOnly: true |
| 10 | Erasure coding tier | Warm data with RS(10,4) or 8+4; cross-DC XOR | f4; S3 erasure coding | object-store (warm tier) | erasureCoding: true; scheme: rs-10-4; expansion: 1.4 |
| 11 | Backoff nodes (f4) | Online reconstruction on read of missing block | f4 | worker | |
| 12 | Rebuilder nodes (f4) | Background reconstruction after failures | f4; S3 repair fleet | worker | autoscaleWithFailures: true |
| 13 | Coordinator nodes (f4) | Schedule rebuilds, maintain placement across failure domains | f4 | control-plane-coordinator | |
| 14 | Integrity auditor | Continuous checksum verification, durability threat model | S3 | scheduled-job | |
| 15 | Garbage collector | Reclaims deleted objects and old versions; compaction of large files | book | scheduled-job | |
| 16 | Storage management fleet (S3) | Replication, lifecycle tiering between classes | S3 | worker + workflow-engine | |
| 17 | Multipart upload state | Tracks parts until complete | book | sql-database (metadata) | |
| 18 | Clients / SDK | REST, multipart, range requests, checksums in trailers | AWS SDK | sdk-client | checksumTrailer: true |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | load balancer | https | sync | | |
| load balancer | api service | http | sync | | |
| api service | iam | rpc | sync | | authorise |
| api service | data routing service | rpc | sync | | stream payload |
| data routing | placement service | rpc | sync | | node set |
| data routing | primary data node | rpc | sync | | write |
| primary data node | secondary data nodes | replication | sync (ack after all or quorum) | | book: sync for durability, async trade-off noted |
| api service | metadata service / db | sql | sync | | after data ack |
| client read | metadata cache | lookup | sync | | witness check |
| witness | persistence tier | lookup | sync | | on stale |
| hot tier | erasure-coded warm tier | migration | async | | after 1-3 months (f4) |
| coordinator | rebuilder | schedule | async | | |
| auditor | data nodes | scan | async | | integrity |
| garbage collector | data nodes + metadata | compaction | async | | |
| cell dc a | cell dc b | xor parity | async | | f4 |

## Failure modes, incidents, tradeoffs the source discusses
- Replication vs erasure coding: replication is simpler with faster repair; erasure coding cuts cost (3.6x to 2.1x at Facebook) at the price of reconstruction CPU and read latency for warm data. Source: f4, book.
- Correlated failures: place blocks across disks, hosts, racks and datacenters; hardware heterogeneity to avoid correlated disk batches. Source: f4.
- Durability is designed, not measured: threat models, property-based tests in CI, formal methods on ShardStore, repair fleet scaled to failure rate. Source: S3 write-ups.
- Silent corruption: checksums from client trailer through storage; continuous audits. Source: S3.
- Stale reads from metadata caches: solved by Witness read barrier and per-object ordering with no performance change. Source: S3 via official posts.
- Small objects: store many in one large file with offsets to avoid per-file overhead; needs compaction and GC. Source: book.
- Drive IOPS ceiling: spread load across many drives; multipart and range parallelism. Source: S3.
- Durability does not protect from deletes: versioning and object lock separate. Source: S3 article.

## Unknowns
- Book's exact metadata sharding scheme and listing implementation for large buckets
- S3 internal service topology beyond the four tiers
- f4 current status (superseded internally)

## Candidates
- New kinds: identity-provider or authorization-service (IAM as a boundary service; 1st explicit sighting, airbnb Himeji was authorization); sightings: object-store (12th, as the whole system), control-plane-coordinator (9th: placement, coordinator), worker (14th: rebuilders), scheduled-job (11th: auditor, GC), sql-database (19th: metadata), cache (15th), load-balancer (11th), coordination-service (14th: Witness), api-gateway (13th), sdk-client (5th)
- New properties on existing kinds: object-store.replication (none, primary-secondary, quorum), erasureCoding (2nd sighting), scheme (rs-10-4, 8+4), expansionFactor, tier (hot, warm, cold), appendOnly, smallObjectPacking (boolean), checksumOnWrite (boolean), versioning (boolean), objectLock (boolean), strongReadAfterWrite (boolean), zones (integer); control-plane-coordinator.consensus (raft, paxos); worker.autoscaleWithFailures (boolean); cache.readBarrier (boolean)
- New edge properties: replicationAck (all, quorum, async); checksumTrailer (boolean)
- New requirement paths: durability.annualNines (2nd sighting); durability.designedNotMeasured (boolean); consistency.readAfterWrite (boolean); data.deleteProtection (versioning, lock)
- New rules:
  - object-store-single-zone-with-durability-target (2nd sighting: zones below 3 while durability.annualNines >= 11)
  - object-store-without-integrity-audit: object-store with durability target and no scheduled-job auditor edge
  - erasure-coded-tier-serving-hot-reads: object-store tier warm with erasureCoding true receiving high-rps sync read edges (latency)
  - async-replication-under-durability-target: object-store replicationAck async while durability.annualNines >= 11
  - cache-in-front-of-strong-store-without-barrier: cache over metadata store with consistency.readAfterWrite true and readBarrier false
  - object-store-without-delete-protection: data.deleteProtection required and versioning and objectLock both false
