# dropbox-sync: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/dropbox-sync.md` (twelve Dropbox engineering posts, 2014-2022, plus the QCon SF 2022 Magic Pocket talk and its InfoQ write-up), re-verified 2026-09-14.
- Size: 25 nodes, 34 edges, 5 groups.

## Clean variant (header of design.yaml)

Dropbox file sync and storage, clean variant: the Nucleus desktop client commits blocklists
through a PoP edge to a metaserver whose append-only Server File Journal is the system of
record, while 4 MB content-addressed blocks land in Magic Pocket cells whose Block Index,
soft-state Master and cross-zone replicator keep twelve nines of durability over three zones.

Fixes relative to dropbox-sync.broken.yaml:
  - osd declares zones 3 and a cross-zone replicator lands every block in a second zone
    within about a second, which is what twelve nines of durability rests on
  - block-index is backed up with a stated retention, like the other three MySQL nodes
  - metadata-mysql is sharded by entity id, the split Edgestore has always run, instead of
    one unsharded primary scaled by async read replicas at ten million requests a second
  - sync-memcache is a latency optimisation over the journal, not the only copy of
    uncommitted file state
  - mp-master is a replicated soft-state coordinator whose cell is not pinned to one
    availability zone, so losing a zone does not lose the placement authority
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Dropbox file sync and storage, broken variant: blocks are written to the OSDs of one zone
only and the cross-zone replicator was never built, the Block Index runs without backups,
the Edgestore metadata tier is still one unsharded MySQL primary with read replicas at ten
million requests a second, the streaming-sync memcache is the only copy of uncommitted file
state, and the per-cell Master is a single unreplicated instance inside one availability zone.

This file MUST trip:
  - object-store-single-zone-with-durability-target  (osd declares zones 1 while the design targets 12 nines)
  - datastore-missing-backup                         (block-index turns backups off, so the hash -> cell map is unrecoverable)
  - single-writer-primary-at-peak-qps                (metadata-mysql is unsharded and declared at 10,000,000 rps)
  - read-replica-as-sole-scaling                     (metadata-mysql scales that load with async replicas alone)
  - cache-as-primary-store-without-persistence       (sync-memcache holds uncommitted file state as the only copy, persistence off)
  - stateful-engine-pinned-to-single-zone            (mp-master sits in the one availability zone with replicated false)
and MUST NOT trip:
  - cache-missing-eviction-policy                    (both caches declare lru)
  - datastore-single-region                          (availability.multiRegion is false)
  - credentials-without-rotation                     (security.credentialRotationDays is still 90)
  - cross-cell-call                                  (isolation.tenancy is not declared cell)
  - stateful-node-without-zone-redundancy            (every stateful worker sits inside the cell group, which the rule exempts)
  - materialised-cache-without-rebuild-path          (neither cache is marked materialised)
  - sync-chain-too-deep, read-heavy-path-without-cache (no latency.p95Ms and no traffic.readWriteRatio requirement)
  - queue-missing-dlq, pubsub-replay-required, derived-store-without-cdc-or-rebuild (no queue, topic or search index)
  - shared-dependency-without-redundancy             (availability.discoveryRedundant is not declared)
  - stateful-websocket-scale-in-without-drain        (notification-server still drains on scale-in)

Each broken mistake is one the sources themselves warn about: the two-zone rule behind twelve
nines, "databases are highly reliable" as the reason the Block Index stayed on MySQL, the
Edgestore fixed-sharding wall that Panda was built to answer ("an outlier shard could outgrow
the capacity of a single machine"), memcache as a streaming-sync accelerator rather than a
store, and the Master whose soft state is only safe because the Replication Table holds the
commit point and the cell is not a single failure domain.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Desktop client / Nucleus | `desktop-client` | `desktop-app` | client | close |
| Mobile and web clients | `web-client` | `web-browser` | client | close |
| GSLB / GeoDNS | `gslb` | `dns-resolver` | dns | exact |
| IPVS load balancer (PoP) | `pop-ipvs` | `load-balancer-tier` | load-balancer | close |
| nginx edge proxy (PoP) | `pop-nginx` | `nginx` | load-balancer | exact |
| Bandaid | `bandaid` | `load-balancer-tier` | load-balancer | close |
| Metaserver | `metaserver` | `container-service` | app-server | exact |
| Server File Journal (SFJ) | `sfj` | `mysql` | sql-database | exact |
| Notification server | `notification-server` | `websocket-gateway` | realtime-gateway | close |
| Memcache (streaming sync) | `sync-memcache` | `memcached` | cache | exact |
| Edgestore Cores | `edgestore-core` | `container-service` | app-server | exact |
| Edgestore Engines | `edgestore-engine` | `proxysql` | database-proxy | close |
| Edgestore caching layer | `edgestore-cache` | `cache-cluster` | cache | close |
| Edgestore transaction record | `edgestore-txn-record` | `etcd` | coordination-service | assumed |
| MySQL shards | `metadata-mysql` | `mysql` | sql-database | exact |
| Panda frontend nodes | `panda-frontend` | `container-service` | app-server | exact |
| Panda storage nodes | `panda-storage-node` | `nosql-store` | nosql-database | close |
| Blockserver / Magic Pocket frontend | `blockserver` | `container-service` | app-server | exact |
| Block Index | `block-index` | `mysql` | sql-database | exact |
| Replication Table | `replication-table` | `mysql` | sql-database | exact |
| Master (per cell) | `mp-master` | `etcd` | coordination-service | assumed |
| Volume Manager | `volume-manager` | `container-worker` | worker | exact |
| OSD (Object Storage Device) | `osd` | `blob-store` | object-store | close |
| Cross-zone replication daemon | `cross-zone-replicator` | `container-worker` | worker | exact |
| Cold storage tier (Magic Pocket) | `mp-cold-tier` | `blob-store` | object-store | close |

Confidence tally: 13 exact, 10 close, 2 assumed.

Boxes on the card that are deliberately not nodes:
- Rows 19-22 (Panda control plane Registry/Keeper, Alki hot tier, Alki cold tier, Alki
  orchestration) and row 31 (the retired Amazon S3 block store) are dropped to keep the
  design inside 25 nodes. Panda's rebalancing control plane and the Alki cold-metadata tier
  are separate subsystems rather than parts of the sync path; S3 is explicitly retired.
- Row 32 (CanopyCheck / Trinity) is test infrastructure, not a runtime element, as the card
  itself says.

## Catalogue gaps

| Product | Kind it would need | Used instead |
|---|---|---|
| Magic Pocket Master (soft-state, no consensus per cell) | a soft-state control plane, not a quorum service | `etcd` with `consensus: "none"` |
| Edgestore external transaction record | a durable transaction-state record | `etcd` with `role: "metadata"`, `consensus: "none"` |
| OSD (bare drives, no filesystem, daemon manages layout) | an on-disk storage node below the object-store abstraction | `blob-store` |
| Nucleus (stateful three-tree reconciling client) | a reconciling client, not a leaf | `desktop-app` |

No component was added; the card's own Candidates section already records these as near-misses.

## Assumed values

Set because a rule reads them and the sources are silent; none is a number the sources state:
- `backupEnabled` / `backupRetentionDays: 30` on `sfj`, `metadata-mysql`, `block-index` and
  `replication-table`. The posts never discuss backup policy, but the Block Index is called
  out as the piece kept on MySQL precisely because "databases are highly reliable", so backups
  reflect the practice.
- `security.credentialRotationDays: 90` — not discussed in any post.
- `evictionPolicy: "lru"` on `edgestore-cache` — the post states partitioned, replicated and
  invalidated on write, but names no eviction policy; `lru` is memcached's own default and the
  Edgestore cache is described as a cache, not a store.
- `availability.zones: 3` stands in for "three zones in three North American geographic
  regions"; the design draws a single `region` group, as `object-storage` does, with the zone
  count carried on the requirement and on `osd.zones`.

## Not encoded

- Erasure-coding parameters: Reed-Solomon 6+3 and LRC at 1.33x, and the cold tier's
  split-and-XOR at 1.5x. `object-store.replication: "erasure-coded"` is the only expression
  the format has; the scheme and the replication factor have no property.
- The 15-minute offline grace period before the Master triggers a repair. No rule or property
  reads a repair delay; it lives only in the `mp-master -> osd` edge label.
- Open versus closed (immutable) volumes, and the generation-number commit point that makes a
  half-finished repair unambiguous. Both are edge-level protocol detail; only the label carries them.
- Content addressing: the 4 MB SHA-256 block hash is both the key and the idempotency key.
  `idempotent: true` on the block edges is the closest the format gets.
- Nucleus's three trees (Remote, Local, Synced) and the planner/scheduler split. The `client`
  kind treats a client as a leaf; the reconciliation is expressed only as the `list`-from-cursor
  edge back to the metaserver.
- The cross-zone replication target of "within one second". No edge field carries a lag budget.
- Per-OSD hardware (about 100 LFF disks, 14 TB SMR drives, 1.4 PB per chassis, 96 GB RAM).
  Node-level hardware is outside the format.
- Panda's hybrid-logical clocks, MVCC and ~100 GB range transfers, and Edgestore's copy-on-write
  staging tables. `commitProtocol: "two-phase"` and `partitionKey: "key_range"` carry the shape,
  not the mechanism.
- Multiple cells per zone and multiple zones: the design draws one PoP, one region and one cell
  as representatives, the way the other reference designs draw one region.
