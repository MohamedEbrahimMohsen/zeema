# object-storage: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/object-storage.md`
- Size: 13 nodes, 16 edges, 4 groups.

## Clean variant (header of design.yaml)

Reference architecture 4, clean variant: S3-like object storage with the hot tier spread
over three zones, a Raft-replicated placement service, two DNS providers, last-writer-wins
metadata and a witness-checked metadata cache.

Fixes relative to object-storage.broken.yaml:
  - data-nodes-hot spans 3 zones (placed at region level rather than inside one AZ)
  - placement is a 5-node Raft etcd cluster at region level, not pinned to us-east-1a
  - edge-dns declares redundantProviders true (secondary provider behind the same zone)
  - metadata-db declares conflictResolution last-writer-wins
  - metadata-cache (readBarrier true) fronts metadata-db for the read-heavy path
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture 4, broken variant: S3-like object storage promising eleven nines and
redundant discovery, but with the hot data tier and the placement service pinned to one zone,
a single DNS provider, multi-leader metadata with no conflict policy and no metadata cache.

This file MUST trip:
  - read-heavy-path-without-cache                    (metadata-db is read sync by api-service, readWriteRatio 20, no cache in the design)
  - object-store-single-zone-with-durability-target  (data-nodes-hot: zones 1 while durability.annualNines 11)
  - multi-leader-store-without-conflict-policy       (metadata-db: multi-region-multi-leader, no conflictResolution)
  - stateful-engine-pinned-to-single-zone            (placement: sits in us-east-1a only, replicated false)
  - shared-dependency-without-redundancy             (edge-dns: redundantProviders false; placement: replicated false; discoveryRedundant true)
and MUST NOT trip:
  - cache-missing-eviction-policy                    (no cache in this design)
  - datastore-missing-backup, datastore-single-region (no sql-database in this design)
  - queue-missing-dlq, pubsub-replay-required        (no queue or topic in this design)
  - sync-chain-too-deep                              (longest sync chain from api-gateway is 3 hops)
  - fanout-inline-in-request-path, push-fanout-without-celebrity-path, derived-store-without-cdc-or-rebuild,
    business-updates-without-index-propagation, cache-as-primary-store-without-persistence,
    materialised-cache-without-rebuild-path          (no such nodes or edges)
