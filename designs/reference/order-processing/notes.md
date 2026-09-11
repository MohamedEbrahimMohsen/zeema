# order-processing: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/README.md`
- Size: 9 nodes, 10 edges, 2 groups.

## Clean variant (header of design.yaml)

Reference architecture 1, clean variant: event-driven order processing.

Fixes relative to order-processing.broken.yaml:
  - orders-queue declares a dead-letter queue
  - order-events moved from SNS to Kafka, which can replay
  - inventory reservation became async through reservation-queue, so the longest
    synchronous chain from the gateway is api -> order-service -> payment-service (2 hops)
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture 1, broken variant: event-driven order processing.

This file MUST trip:
  - queue-missing-dlq          (orders-queue receives async traffic, no DLQ)
  - pubsub-replay-required     (order-events is SNS, design requires replay)
  - sync-chain-too-deep        (api -> order-service -> payment-service -> inventory-service -> orders-db)
and MUST NOT trip:
  - datastore-missing-backup   (orders-db declares backup and retention)
  - datastore-single-region    (design does not require multi-region)
  - cache-missing-eviction-policy (no cache in this design)
