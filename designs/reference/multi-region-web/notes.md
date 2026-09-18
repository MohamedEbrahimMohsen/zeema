# multi-region-web: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/README.md`
- Size: 8 nodes, 8 edges, 2 groups.

## Clean variant (header of design.yaml)

Reference architecture 2, clean variant: read-heavy web application with a real
multi-region posture.

Fixes relative to multi-region-web.broken.yaml:
  - session-cache declares lru eviction with a 30 minute TTL, and a second cache exists in eu
  - catalog-db is backed up with 35 days retention and replicates asynchronously
  - catalog-db-replica in eu-west-1 serves European reads
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture 2, broken variant: read-heavy web application promising a
multi-region SLA, but with every stateful component in one region.

This file MUST trip:
  - cache-missing-eviction-policy  (session-cache declares no evictionPolicy)
  - datastore-single-region        (catalog-db is in one region, replication none, multiRegion required)
  - datastore-missing-backup       (catalog-db has backupEnabled false)
and MUST NOT trip:
  - queue-missing-dlq, pubsub-replay-required (no messaging in this design)
  - sync-chain-too-deep            (longest sync chain from either gateway is 2 hops)
