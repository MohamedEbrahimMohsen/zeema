# amazon-order: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/amazon-order.md` (Dynamo paper 2007, AWS Herd case study, Prime Day 2025 metrics post, Prime Video monitoring post, Builders' Library on cells and shuffle sharding), re-verified 2026-09-14.
- Size: 22 nodes, 26 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture: the amazon.com order path, clean variant. A page render fans out to
over 150 owning services, the shopping cart sits on leaderless Dynamo with vector clocks, and
every placed order is driven by the Herd workflow engine on DynamoDB inside one cell.

Fixes relative to amazon-order.broken.yaml:
  - Herd keeps its workflow state in DynamoDB, not in the single-writer Oracle fleet the
    case study migrated away from
  - order-service starts the workflow asynchronously and never reaches into cell-b; a cell
    failure stays inside that cell instead of becoming a cross-cell fallback path
  - domain events go to SQS with a dead-letter queue, consumed by Lambda asynchronously
  - nothing on the request path calls a background worker synchronously
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: the amazon.com order path, broken variant. Same system with the five
mistakes the sources themselves warn about: Herd's workflow state left on the single-writer
Oracle fleet, a synchronous fallback from cell-a into cell-b, an SQS queue with no dead-letter
queue, and the storefront calling a background worker inline.

This file MUST trip:
  - single-writer-primary-at-peak-qps  (orders-oracle is unsharded, single writer, declared at 20000 rps)
  - read-replica-as-sole-scaling       (orders-oracle scales on async replicas only, not sharded, not distributed)
  - cross-cell-call                    (order-service -> herd-b is sync while isolation.tenancy is cell)
  - queue-missing-dlq                  (order-events receives async traffic with deadLetterQueue false)
  - fanout-inline-in-request-path      (service-fleet calls order-workers synchronously)
and MUST NOT trip:
  - datastore-missing-backup                   (orders-oracle and transactions-db declare backup and retention)
  - datastore-single-region                    (availability.multiRegion is false)
  - retry-without-adaptive-shedding            (every retrying activity edge declares circuitBreaker true)
  - credentials-without-rotation               (security.credentialRotationDays is set)
  - cache-missing-eviction-policy, cache-as-primary-store-without-persistence,
    materialised-cache-without-rebuild-path    (product-cache declares lru, is not primary and is not materialised)
  - shared-worker-pool-across-queues           (isolation.perQueue is not required and order-workers drains one queue)
  - push-fanout-without-celebrity-path         (order-workers declares no push fan-out and there is no graph database)
  - business-updates-without-index-propagation, derived-store-without-cdc-or-rebuild (no search index)
  - read-heavy-path-without-cache              (traffic.readWriteRatio is not stated by any source)
  - sync-chain-too-deep                        (no api-gateway node; CloudFront is a cdn)
  - stateful-node-without-zone-redundancy      (no availability-zone group, and the fleet sits in a cell)

Each of the five is a mistake the sources argue against in their own words. The Oracle fleet is the
one the Herd case study migrated off because Prime Day would have needed "1,000 hosts running Oracle
software". The cross-cell call is the fallback path the Builders' Library warns "can convert a
one-cell failure into a cascading multi-cell failure", which is also why `availability.degradedModeAllowed`
is false in both files.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Customer clients (web) | `customer-web` | `web-browser` | client | exact |
| Customer clients (app) | `customer-app` | `mobile-app` | client | exact |
| CloudFront | `cloudfront` | `cloudfront` | cdn | exact |
| Page rendering engine | `rendering-engine` | `container-service` | app-server | close |
| Service fleet (150+ services) | `service-fleet` | `container-service` | app-server | close |
| Shopping cart service | `cart-service` | `container-service` | app-server | close |
| Dynamo | `cart-store` | `nosql-store`, labelled "Dynamo" | nosql-database | close |
| ElastiCache | `product-cache` | `aws-elasticache` | cache | exact |
| Rufus / SageMaker on Inferentia and Trainium | `rufus-inference` | `sagemaker-endpoint` | ml-inference | close |
| Order service | `order-service` | `container-service` | app-server | assumed |
| Herd workflow engine | `herd`, `herd-b` | `cadence`, labelled "Herd" | workflow-engine | close |
| TimerService | `timer-service` | `message-queue`, labelled "TimerService" | queue | close |
| ViewService | `view-service` | `observability-stack`, labelled "ViewService" | monitoring | close |
| DynamoDB | `workflow-store`, `workflow-store-b` | `dynamodb` | nosql-database | exact |
| SQS | `order-events` | `sqs` | queue | exact |
| Lambda | `event-consumers` | `lambda` | app-server | exact |
| Payment activity service | `payment-service` | `container-service` | app-server | assumed |
| Inventory activity service | `inventory-service` | `container-service` | app-server | assumed |
| Fulfilment center systems | `fulfilment-service` | `container-service` | app-server | close |
| Aurora | `transactions-db` | `aurora` | sql-database | exact |
| Oracle (legacy, broken twin only) | `orders-oracle` | `oracle-db` | sql-database | exact |
| Cells and shuffle shards | `cell-a`, `cell-b` groups | group kind `cell` | - | assumed |

Tally: 8 exact, 9 close, 5 assumed.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Herd (Amazon's in-house durable workflow engine) | a generic in-house `workflow-engine`; every `default` component under that kind is a named product | `cadence`, labelled "Herd" |
| TimerService (DynamoDB-backed scheduled priority queue with an in-memory index) | `queue` with a priority or scheduled delivery mode | `message-queue`, labelled "TimerService" |
| ViewService (workflow-backlog drill-down console) | `monitoring` with a drill-down signal | `observability-stack`, labelled "ViewService" |
| Dynamo, the 2007 system | the kind already carries leaderless replication, quorum and vector clocks; only the product name is missing | `nosql-store`, labelled "Dynamo" |
| Rufus on Inferentia and Trainium | `ml-inference` has `accelerator: asic` but no chip-count property | `sagemaker-endpoint` with `accelerator: "asic"` |

No component was added to the catalogue for this design.

## Not encoded

- **Cells are the reason clients and CloudFront sit inside `cell-a`.** `cross-cell-call` treats a
  synchronous edge as cross-cell when either end has no cell in its ancestry, so a cell design has to
  place both ends of every synchronous hop in a cell. Customers are routed to a cell by the partition
  key, so drawing them there is faithful; CloudFront is genuinely global and its placement in `cell-a`
  is a modelling compromise. `cell-b` is drawn abbreviated (Herd and its store); in production it
  holds the full stack.
- **Shuffle sharding.** The format has no property for "each tenant is mapped to a random small subset
  of workers". Only the coarser `isolation.tenancy: "cell"` is expressible; the shard-per-tenant layer
  inside a cell is lost.
- **Dynamo's intra-ring mechanics.** Gossip membership, hinted handoff and Merkle-tree anti-entropy run
  between replicas of one ring. The design draws Dynamo as a single node, and the format has no edge
  from a node to itself, so those three arrows from the card are carried as `replication: "leaderless"`,
  `replicationFactor: 3`, `quorumWrites: 2`, `quorumReads: 2` and `conflictResolution: "vector-clock"`
  instead.
- **The 99.9th percentile SLA.** `requirements.latency` has `p95Ms` and `p99Us` but no p99.9 field. The
  Dynamo target of 300 ms at the 99.9th percentile is recorded as `latency.p95Ms: 300`, which is the
  conservative reading, and as `nfr.latencyP95Ms: 300` on `service-fleet`.
- **The Prime Day 2025 numbers.** DynamoDB's 151M rps, SQS's 166M messages/sec, ElastiCache's 1.4T
  requests/min, Aurora's 500B transactions and 4,071 TB, CloudFront's 3T requests and Lambda's 1.7T
  invocations/day are AWS-wide peaks, not figures for a box in amazon.com's order path. None is carried
  as an `nfr`. The only per-box rate the sources state is Dynamo's 500 rps per service, on `service-fleet`.
- **Herd's volume.** 1,300+ workflows and 4 billion executions on peak days are counts, not rates, and
  the `workflow-engine` kind has no `workflowsPerDay` property.
- **The Prime Video monitoring service.** Step Functions plus Lambda detectors passing frames through
  S3, hitting limits at 5% of projected load, replaced by an ECS monolith at 90% less cost. It is a
  separate Amazon system, not part of the order path, and encoding it here would make one design out of
  two. Its lesson (per-state-transition pricing at high step rates) has no rule yet.
- **The legacy Oracle fleet in the clean design.** 150+ databases on 300+ hosts were decommissioned by
  the migration the case study describes, so the clean design does not draw them. They appear in the
  broken twin as `orders-oracle`, which is precisely the state the case study warns about.
- **Assumed properties.** `security.credentialRotationDays: 90` and `deadLetterQueue: true` on both
  queues are not stated by any source. They are set because the rules read them and because both are
  documented AWS practice; nothing else in the design depends on their exact value.
