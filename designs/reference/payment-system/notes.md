# payment-system: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/payment-system.md`
- Size: 15 nodes, 18 edges, 3 groups.

## Clean variant (header of design.yaml)

Reference architecture: payment system (Xu vol 2 ch 10, Uber payments platform, Airbnb
idempotency), clean variant. Pay-in through a PSP hosted page, immutable payment events,
a workflow of idempotent steps, a double-entry ledger, a retry queue with backoff and
DLQ, nightly reconciliation against bank settlement files.

Fixes relative to payment-system.broken.yaml:
  - every edge into the PSP, the bank and the ledger declares idempotent (idempotency key)
  - money lives in a double-entry ledger node, not a plain table
  - the retry queue has a DLQ and exponential-jitter backoff
  - the PSP webhook verifies signatures and deduplicates by event id
  - executor dispatch is at-least-once plus idempotent, not a claimed exactly-once
  - a KMS node exists and credential rotation is declared
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: payment system (Xu vol 2 ch 10, Uber payments platform, Airbnb
idempotency), broken variant. Same shape as payment-system.yaml but with the mistakes
the sources warn about: no idempotency key on the PSP call, balances in a plain table
instead of a double-entry ledger, a retry queue with no DLQ and no backoff, an unsigned
webhook, a claimed exactly-once hand-off in front of an external side effect, and no
credential rotation.

This file MUST trip:
  - money-mutation-without-idempotency-key   (payment-executor -> psp has no idempotent field, exactlyOnceEffect true)
  - money-store-without-double-entry-ledger  (money.zeroSum true, no ledger kind; ledger-db is a postgres table)
  - retry-queue-without-dlq                  (retry-queue role retry, deadLetterQueue false)
  - retry-without-backoff                    (retry-queue role retry, backoff none)
  - webhook-without-signature-or-idempotency (psp-webhook signatureVerified false)
  - exactly-once-with-external-side-effects  (payment-service -> payment-executor exactly-once; executor calls psp sync)
  - credentials-without-rotation             (data nodes, no security.credentialRotationDays, no key-management)
  - queue-missing-dlq                        (pre-existing rule; retry-queue has async in-edge and no DLQ, same defect as retry-queue-without-dlq)
and MUST NOT trip:
  - external-call-inline-without-durable-path (payment-executor is attached to retry-queue)
  - retry-without-adaptive-shedding           (no edge declares retryPolicy)
  - datastore-missing-backup                  (both postgres nodes declare backup and retention)
  - datastore-single-region                   (multiRegion false)
  - sync-chain-too-deep                       (api -> payment-service -> payments-db is 2 hops)
  - cache-missing-eviction-policy, pubsub-replay-required (no cache, no pubsub topic)
