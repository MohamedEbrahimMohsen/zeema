# slack-messaging: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/slack-messaging.md`
- Size: 16 nodes, 21 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture: Slack real-time messaging (channel servers on a consistent hash
ring, gateway servers holding WebSockets, Vitess/MySQL, Kafka-fronted Redis job queue,
AZ-scoped cells), clean variant.
Cell-b is drawn abbreviated (admin and channel servers only); in production each cell
holds the full stack. Client edges are modelled async: they ride the persistent
WebSocket and the cell rule applies to server-side calls.

Fixes relative to slack-messaging.broken.yaml:
  - gateway servers have a reconnect stampede guard and drain on scale-in
  - channels are assigned to gateway hosts by hash, not at random
  - each Redis job queue has its own worker pool
  - channel servers are attached to a ring manager (Helix) that owns the hash ring
  - no synchronous call leaves its cell
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: Slack real-time messaging, broken variant. Same shape as
slack-messaging.yaml but with the failure modes the Slack posts describe: gateways with
no reconnect guard and no drain on scale-in, random channel placement under heavy-tail
traffic, one worker pool draining two Redis queues, channel servers on a hash ring with
no ring manager, and an admin server calling into the other cell.

This file MUST trip:
  - reconnect-stampede-without-guard          (gateway-server-a calls consul sync on connect, stampedeGuard false)
  - shared-host-per-channel-without-isolation (gateway-server-a channelAssignment random, traffic.skew heavy-tail)
  - stateful-websocket-scale-in-without-drain (gateway-server-a autoscaling true, drainOnScaleIn false)
  - shared-worker-pool-across-queues          (job-workers consumes jobs-redis-high and jobs-redis-low, isolation.perQueue true)
  - stateful-hash-ring-without-ring-manager   (channel-server-a and channel-server-b have no edge to a coordination service)
  - cross-cell-call                           (admin-server-a -> channel-server-b sync, isolation.tenancy cell)
and MUST NOT trip:
  - stateful-node-without-zone-redundancy     (channel servers are inside a cell)
  - queue-missing-dlq                         (both Redis queues declare deadLetterQueue true)
  - single-writer-primary-at-peak-qps, read-replica-as-sole-scaling (messages-db is sharded)
  - datastore-missing-backup                  (messages-db declares backup and retention)
  - cache-missing-eviction-policy             (object-cache declares lru)
  - credentials-without-rotation              (security.credentialRotationDays set)
  - stateful-engine-pinned-to-single-zone     (consul is replicated)
