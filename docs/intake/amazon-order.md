# Intake: Amazon.com order pipeline (Dynamo, Herd workflows, cell and shuffle-shard isolation, Prime Day)

## Source
- Primary: Dynamo paper (Amazon, SOSP 2007) via https://www.allthingsdistributed.com/2007/10/amazons_dynamo.html (Werner Vogels, official)
- Primary: https://aws.amazon.com/solutions/case-studies/herd/ (official AWS case study on Amazon's Herd workflow engine, 2018)
- Primary: https://aws.amazon.com/blogs/aws/aws-services-scale-to-new-heights-for-prime-day-2025-key-metrics-and-milestones/ (official, 2025)
- Primary: Prime Video monitoring service post (official, 2023) via mirror PDF https://www.wudsn.com/productions/www/site/news/2023/2023-05-08-microservices-01.pdf
- Primary: Amazon Builders' Library, "Workload isolation using shuffle-sharding" and "Avoiding fallback in distributed systems" (official; Builder Center pages render client-side and were not readable in this pass; content taken from search summaries and https://hidekazu-konishi.com/entry/cell_based_architecture_and_shuffle_sharding_on_aws.html)
- Verified by: peer-reviewed paper + official AWS posts and case study + Builders' Library via summaries
- Confidence: high for Dynamo, Herd, Prime Day numbers; medium for the end-to-end order topology (Amazon does not publish it; assembled from these public pieces)
- Date of source: 2007-2025

## System in three lines
Amazon.com's order path is a service-oriented system where a page render calls over 150 services, the shopping cart must accept writes "even if... data centers are being destroyed by tornados", and every placed order is driven by Herd, a workflow engine running 1,300+ workflows and 4 billion executions on peak days on DynamoDB. Blast radius is contained with cells and shuffle sharding, and fallback code paths are avoided by design. Hard because availability is non-negotiable at the 99.9th percentile, Prime Day multiplies load, and untested fallback paths and cross-cell dependencies are the historical causes of cascades.

## Scale (only if stated)
- Users / DAU: not stated
- Requests per second: Dynamo SLA example 500 rps per service at 99.9th percentile 300 ms; Prime Day 2025 DynamoDB peak 151M rps, SQS 166M messages/sec, ElastiCache 1.4T requests/min
- Data volume: Aurora 500B transactions and 4,071 TB stored during Prime Day 2025; EBS 20.3T IOPS peak, up to an exabyte/day; CloudFront 3T HTTP requests in Prime Day week
- Message throughput: Herd 4B workflows on peak days; Lambda 1.7T invocations/day
- Herd migration: 150+ Oracle databases on 300+ hosts to DynamoDB; avoided "1,000 hosts running Oracle software" for Prime Day; workflow delay 1 s to 100 ms; scaling lead time 60 weeks to under 6
- Page render: "over 150 services" per response
- Prime Video monitoring: hit account limits at 5% of expected load; monolith cut cost 90%

## Requirements stated or clearly implied
- Availability target: cart always writable; SLA at 99.9th percentile ("99.9% of read and write requests execute within 300ms" at 500 rps); order processing must never stop ("If the system goes down, Amazon order processing could stop")
- Consistency: cart eventually consistent with vector-clock reconciliation (N,R,W typically 3,2,2); order workflows durable in DynamoDB across AZs; Aurora for transactional data
- Latency target: p99.9 300 ms per service; Herd 100 ms workflow delay
- Ordering needs: workflow steps ordered by TimerService priority queue
- Replay or reprocessing: Herd retries and timers; anti-entropy via Merkle trees in Dynamo
- Retention: not stated
- Compliance / residency: not stated
- Blast radius: cells and shuffle sharding to keep one tenant's failure from others; no fallback paths

## Boundaries
- Regions / zones: multi-AZ (DynamoDB, Aurora); multi-datacenter cart replication; cells as isolation units
- Trust zones: customers -> CloudFront -> page rendering -> 150+ services -> datastores; fulfilment centers as separate consumers of workflows
- Named subsystems: Rendering and service mesh of amazon.com, Shopping cart (Dynamo), Order processing and fulfilment (Herd on DynamoDB with TimerService and ViewService), Data (DynamoDB, Aurora, ElastiCache, SQS, Lambda), Edge (CloudFront), ML (Rufus on Inferentia/Trainium)
- Group kind: cell (3rd sighting), plus shuffle shard as a virtual grouping

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Customer clients | Web and app | web, mobile | web-client, mobile-client | |
| 2 | CloudFront | CDN for storefront | Amazon CloudFront | cdn | requestsPrimeWeek: 3e12 |
| 3 | Page rendering engine | Composes a page from 150+ service calls with per-service SLAs | in-house | app-server (aggregator) | fanout: 150 |
| 4 | Service fleet | Hundreds of services, each owning data and an SLA | in-house | app-server | |
| 5 | Shopping cart service | Always-writable cart | in-house on Dynamo | app-server | |
| 6 | Dynamo | Highly available KV: consistent hashing, N/R/W quorum, vector clocks, sloppy quorum, hinted handoff, Merkle anti-entropy, gossip | Dynamo (later DynamoDB) | nosql-database | consistency: eventual; quorum: 3-2-2 |
| 7 | Herd workflow engine | Orchestrates order processing and fulfilment workflows; 1,300+ workflows, 300+ teams | Herd (in-house) | workflow-engine | workflowsPeakDay: 4e9 |
| 8 | TimerService | DynamoDB-backed scheduled priority queue for workflow timing, in-memory index | in-house | scheduled-job + queue | |
| 9 | ViewService | Monitoring and drill-down of workflow backlogs | in-house | monitoring | |
| 10 | DynamoDB | Workflow state, order data; multi-AZ | Amazon DynamoDB | nosql-database | peakRps: 151000000 |
| 11 | Oracle (legacy) | 150+ databases on 300+ hosts behind Herd until 2016 | Oracle | sql-database | |
| 12 | Aurora | Transactional relational workloads | Amazon Aurora | sql-database | |
| 13 | ElastiCache | Caching tier | ElastiCache (Redis/Memcached) | cache | |
| 14 | SQS | Queues between services | Amazon SQS | queue | peakMsgPerSec: 166000000 |
| 15 | Lambda | Event-driven functions | AWS Lambda | worker (serverless) | invocationsPerDay: 1.7e12 |
| 16 | Fulfilment center systems | Consume order workflows to pick, pack, ship | in-house | app-server | |
| 17 | Rufus / SageMaker | AI shopping assistant on Inferentia/Trainium | SageMaker | ml-inference | chips: 87000 |
| 18 | Cells and shuffle shards | Isolation: customers mapped to small random subsets of workers so one bad tenant affects few others | pattern (Route 53 uses it) | group kind cell + property on load-balancer | |
| 19 | Prime Video monitoring (legacy) | Step Functions orchestrating Lambda detectors with S3 frame passing | Step Functions, Lambda, S3 | workflow-engine + worker + object-store | |
| 20 | Prime Video monitoring (monolith) | Single ECS task with shared memory, vertical scaling | Amazon ECS | app-server | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | cloudfront | https | sync | | |
| cloudfront | rendering | https | sync | | |
| rendering | services (150+) | rpc | sync | | per-service SLA p99.9 |
| cart-service | dynamo | rpc | sync | W=2 of N=3 | sloppy quorum on failure |
| dynamo node | dynamo node | gossip / hinted handoff / merkle sync | async | | anti-entropy |
| order service | herd | rpc | async | durable | start workflow |
| herd | dynamodb | rpc | sync | | state |
| herd | timerservice | rpc | async | | schedule steps |
| herd | activity services (payment, inventory, fulfilment) | rpc | async | retried | workflow activities |
| services | sqs | sqs | async | at-least-once | |
| sqs | lambda / consumers | poll | async | at-least-once | |
| services | aurora | sql | sync | | |
| services | elasticache | redis | sync | | |
| step functions (legacy pv) | lambda detectors | invoke | async | | per state transition cost |
| lambda detectors | s3 | s3 | sync | | frames |
| ecs monolith | in-process detectors | memory | sync | | replaced s3 hops |

## Failure modes, incidents, tradeoffs the source discusses
- Availability over consistency for the cart: "customers should be able to view and add items to their shopping cart even if disks are failing, network routes are flapping, or data centers are being destroyed by tornados." Source: Dynamo.
- Tail latency governs: SLAs at the 99.9th percentile because a page needs 150+ services. Source: Dynamo.
- Conflicts are the application's problem: vector clocks surface divergent versions; cart merges them. Source: Dynamo.
- Single order-processing dependency: "If the system goes down, Amazon order processing could stop and no customers would get what they bought." Source: Herd.
- Vertical database scaling ceiling: Oracle would have needed 1,000 hosts; DynamoDB cut delay 1 s to 100 ms and scaling lead time 60 weeks to 6. Source: Herd.
- Fallback paths are dangerous: they run "exactly when the system is already stressed, along a code path never exercised in normal operation" and "can convert a one-cell failure into a cascading multi-cell failure". Source: Builders' Library via summary.
- Shuffle sharding: each customer on a random small subset of workers so a poison tenant affects a tiny fraction of others; cells bound blast radius. Source: Builders' Library via summary.
- Over-distribution cost: Prime Video's Step Functions plus Lambda design hit limits "at just 5% of projected load"; state-transition pricing and S3 frame hops dominated; monolith on ECS saved 90%. Source: Prime Video post.
- Peak engineering: Prime Day numbers show every managed service must scale 1-2 orders of magnitude for one week. Source: Prime Day 2025.

## Unknowns
- Actual order service topology and payment/inventory service layout (not public)
- Herd activity execution model details
- Cell sizes and placement for amazon.com retail
- Current cart datastore (DynamoDB presumed)

## Candidates
- New kinds: none strictly new; sightings: workflow-engine (4th: Herd, Step Functions), nosql-database (19th), queue (9th: SQS), scheduled-job (8th: TimerService), monitoring (12th), cdn (8th), cache (15th), sql-database (19th), ml-inference (6th), worker serverless (15th), cell group (3rd)
- New properties on existing kinds: nosql-database.quorum (n,r,w), conflictResolution (vector-clock, lww, app-merge), hintedHandoff, antiEntropy; workflow-engine.workflowsPerDay, stateStore; load-balancer or cell.shuffleSharding (boolean), shardsPerTenant; app-server.fanout (integer); worker.pricingPerTransition (informational)
- New edge properties: fallbackPath (boolean, discouraged); slaP999Ms (integer)
- New requirement paths: availability.percentile (99, 99.9); isolation.shuffleSharding (boolean); availability.noFallbackPaths (boolean); cost.perTransitionSensitive (boolean)
- New rules:
  - fallback-path-declared-under-no-fallback-policy: edge with fallbackPath true while availability.noFallbackPaths true
  - aggregator-fanout-without-per-dependency-sla: app-server fanout above N with sync edges lacking slaP999Ms or timeoutMs
  - multi-tenant-worker-pool-without-shuffle-sharding: shared worker pool serving many tenants with shuffleSharding false while isolation.shuffleSharding true
  - order-workflow-without-durable-engine: order creation edges chained synchronously across services with no workflow-engine or queue (2nd sighting of the DoorDash theme)
  - orchestration-per-step-pricing-at-high-rate: workflow-engine with per-transition pricing driving high-frequency steps (Prime Video pattern, informational)
