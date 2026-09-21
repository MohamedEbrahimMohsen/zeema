# Schema gaps

A running log of things the v1 format could not express while encoding real designs.
Each entry drives the v2 agenda. Nothing is added to the format without an entry here
first.

Format for an entry:

```
## <short title>
- Design: designs/<tier>/<id>/design.yaml
- Missing: what could not be said
- Workaround: what the design does instead
- Proposed change: kind / property / predicate / requirement path, and why
- Status: open | accepted | rejected
```

---

## Only six kinds exist
- Design: designs/reference/multi-region-web, designs/reference/order-processing
- Missing: load balancer, CDN, web client, mobile client, worker, NoSQL database,
  object store. Both reference designs stop at the API gateway and treat workers as
  `app-server`.
- Workaround: omit clients and CDN; model workers as `container-service`.
- Proposed change: the remaining kinds from the MVP document, in the order real designs
  need them.
- Status: accepted. 41 kinds after the 50-card intake pass; see docs/catalogue-v1.md.

## Protocol is a free string
- Design: all
- Missing: a fixed vocabulary for `edge.protocol`, so a rule could say "sync edge over a
  message protocol is suspicious".
- Workaround: none needed yet; no rule reads protocol.
- Proposed change: promote to enum once the user's designs show the real set.
- Status: open

## Edges needed properties
- Design: designs/reference/doordash-delivery/source/doordash-delivery.md, designs/reference/payment-system/source/payment-system.md, docs/intake/netflix-streaming.md
- Missing: retry policy, timeout, idempotency, circuit breaker and fallback on a call.
  Rules such as retry-without-adaptive-shedding and money-mutation-without-idempotency-key
  cannot be written without them.
- Workaround: none possible; the information lives on the edge.
- Proposed change: six optional edge fields (timeoutMs, retryPolicy, idempotent,
  circuitBreaker, fallback, batched) plus the `field`, `from`, `to` predicates.
- Status: accepted in v1

## Rules need the design as a whole
- Design: designs/reference/payment-system/source/payment-system.md (money-store-without-double-entry-ledger),
  designs/reference/twitter-timeline/source/twitter-timeline.md (read-heavy-path-without-cache)
- Missing: "this design contains no node of kind X".
- Workaround: none.
- Proposed change: `hasNode` predicate usable from any subject.
- Status: accepted in v1

## Cells and points of presence
- Design: designs/reference/slack-messaging/source/slack-messaging.md, docs/intake/amazon-order.md, docs/intake/cloudflare-edge.md
- Missing: a group kind for a failure-isolated cell and for an edge site, so a rule can
  say "sync call crosses a cell".
- Workaround: none.
- Proposed change: group kinds `cell`, `point-of-presence`; predicate `crossesGroup`.
- Status: accepted in v1

## Thresholds in rules
- Design: designs/reference/doordash-delivery/source/doordash-delivery.md (single-writer-primary-at-peak-qps)
- Missing: comparing a node's stated rps, or a requirement, to a number.
- Workaround: none.
- Proposed change: `nfr` predicate; `gt`/`lt` on `prop` and `requirement`.
- Status: accepted in v1

## Component-level defaults for hosting variants
- Design: components/ (postgres on RDS vs Cloud SQL vs self-hosted)
- Missing: the managed variant of a product often changes defaults (backups on, multi-AZ).
- Workaround: `managed` boolean on the kind; the design sets the managed defaults itself.
- Proposed change: none for v1; revisit if designs keep repeating the same overrides.
- Status: open

## Lists of values
- Design: docs/intake/notification-system.md (channels), docs/intake/figma-multiplayer.md (shardKeys)
- Missing: list-typed properties.
- Workaround: one boolean per channel; single shardKey string.
- Proposed change: list type in v2 if more than three kinds need it.
- Status: open

## Source names on nodes and groups
- Design: designs/imported/ (every imported design)
- Missing: a place to keep the text of a box or boundary exactly as the source draws it.
  Ids are kebab-case and unique, so "Orders DB (primary)" cannot survive as an id, and an
  import that loses the name is no longer the same design.
- Workaround: none.
- Proposed change: optional `label` string on nodes and groups, mirroring the existing edge
  `label`. Renderers show it; rules never read it.
- Status: accepted in v1

## Generic components for unnamed stores
- Design: designs/imported/notification-system-design/, every design imported from a textbook
  figure (designs/imported/*, book chapters)
- Missing: a box drawn as "Cache", "Queue" or "DB" with no product named had no honest
  component; the catalogue held only concrete products, so an import had to pick Redis,
  RabbitMQ, PostgreSQL or Cassandra with confidence "assumed".
- Workaround: pick the most common product and record the assumption in mapping.yaml.
- Proposed change: one engine-less component per kind that designs draw generically, in the
  `default` provider, like `container-service` for app-server, carrying no defaults beyond
  what the role itself implies.
- Status: accepted in v1. Added 2026-09-08: `message-queue`, `cache-cluster`,
  `relational-database`, `nosql-store`, `blob-store`, `content-delivery-network`,
  `load-balancer-tier`, `dns-resolver`, `observability-stack`. They assert nothing the
  drawing does not: no eviction policy, no backups, no replication. Rules therefore fire on
  them, which is correct: the design really does not say.

## Edge mode cannot be unknown
- Design: designs/imported/notification-system-design/
- Missing: a picture often does not say whether a call waits for the callee (analytics
  event reports); `mode` is required and has no "unknown" value.
- Workaround: choose the likely mode and note it.
- Proposed change: none for v1; importers state the assumption.
- Status: open

<!-- Entries below come from the twelve designs imported from a system design textbook,
     2026-09-08. Each names the designs that hit it. -->

## Edges cannot attach to a boundary
- Design: designs/imported/scale-to-millions, chat-system, news-feed
- Missing: figures routinely draw an arrow to the edge of a boundary rather than to a box
  ("User -> DNS" where User is a box holding a browser and a phone, four arrows landing on a
  dashed service boundary). `from` and `to` are node ids only.
- Workaround: attach the arrow to a representative node inside the boundary, or repeat it once
  per member, and record the substitution in mapping.yaml. Both change the edge count.
- Proposed change: allow a group id as an edge endpoint, with rules resolving it to every
  member.
- Status: open

## No throughput, capacity or retention requirements
- Design: designs/imported/url-shortener, web-crawler, youtube, chat-system, notification-system
- Missing: the numbers these chapters state cannot be written down: 1,160 writes per second,
  365 TB over ten years, 30 PB over five years, 150 TB of new video a day, 1 million concurrent
  connections, "chat history is stored forever".
- Workaround: only the read/write ratio and peak multiplier have paths; everything else is lost.
- Proposed change: `traffic.writesPerSecond`, `traffic.readsPerSecond`,
  `traffic.concurrentConnections`, `storage.volumeTb`, `storage.retentionDays`.
- Status: open

## No node-internal structure
- Design: designs/imported/key-value-store, web-crawler, youtube, news-feed
- Missing: four chapters zoom inside one box (a storage node's commit log and SSTables, the URL
  frontier's front and back queues, the transcoding pipeline inside the transcoding servers, the
  five cache layers behind one cache tier). A node cannot contain nodes, and a group is a
  deployment boundary, not the inside of a component.
- Workaround: keep the outer box as one node and describe the inside in notes.md, or place the
  inner pieces beside the outer one, which draws a picture the source does not draw.
- Proposed change: let a node reference another design as its expansion
  (`detail: "<design-id>"`), so the zoom is a document of its own.
- Status: open

## A tier drawn as several instances
- Design: designs/imported/scale-to-millions, key-value-store
- Missing: "Databases" holding three shard cylinders, "Caches" as three tiles, eight ring nodes
  that are one clustered store. Nothing says a node is N instances of one thing, so cluster
  properties are repeated on every peer or collapsed into one node.
- Workaround: `sharded: true`, or one node per drawn instance with duplicated properties.
- Proposed change: `instances` on a node, and a group kind for a cluster of peers.
- Status: open

## Request and response are two unrelated edges
- Design: designs/imported/key-value-store, chat-system, rate-limiter, google-drive
- Missing: a double-headed arrow, a request with its reply, and one bidirectional WebSocket all
  become two directed edges with nothing linking them, which doubles the edge count against the
  source. A long poll (a held request carrying a server-initiated event) is neither sync nor
  async.
- Workaround: two edges plus a note.
- Proposed change: `replyTo` on an edge, or an edge `mode` value for a persistent bidirectional
  connection.
- Status: open

## A group kind for the client side
- Design: designs/imported/scale-to-millions, search-autocomplete, news-feed
- Missing: figures group client devices in a box labelled "User". That is not a region, a VPC or
  a trust boundary; `trust-zone` is the closest of the seven kinds and overstates the claim.
- Workaround: `trust-zone`.
- Proposed change: a `client-zone` group kind.
- Status: open

## Outcome boxes and artefact boxes are not runtime elements
- Design: designs/imported/rate-limiter, youtube
- Missing: "Request dropped" is a terminal outcome; "Encoded video (funny_720p.mp4)" is a file
  produced by a pipeline. Neither is a component, but both are boxes the figure draws.
- Workaround: ignore the outcome box; map the artefact to the nearest store, which is the last
  remaining `assumed` mapping in the corpus.
- Proposed change: none for v1. Revisit if more designs draw artefacts.
- Status: open

## An enum forces a choice the source does not make
- Design: designs/imported/google-drive, youtube, search-autocomplete
- Missing: "the database is replicated" without saying how, "either a document store or a
  key-value store". Every enum requires exactly one value, so the import guesses and notes it.
- Workaround: choose the most likely value and record the guess in mapping.yaml.
- Proposed change: allow `unspecified` on the enums that designs leave open (`replication`,
  `model`), so a design can say the source was silent.
- Status: open

## Mechanisms a chapter explains have no property
- Design: designs/imported/web-crawler, chat-system, key-value-store, notification-system
- Missing: crawler politeness (one page at a time per host with a delay), the presence heartbeat
  interval, gossip failure detection, hinted handoff, sloppy quorum, deduplication on an event
  id, and the promise "never lost but may be delayed or re-ordered".
- Workaround: prose in notes.md.
- Proposed change: these are candidate properties on `queue`, `worker`, `nosql-database` and a
  `messaging.noLoss` requirement path. Add them when a rule needs them, not before.
- Status: open

## Absolute latency and encryption requirements
- Design: designs/imported/search-autocomplete, youtube
- Missing: "the response must come back within 100 ms" is a budget, not a percentile, and
  `latency.p95Ms` is the only path; "encryption is required" has no requirement path at all.
- Workaround: record the budget as p95 and the encryption promise in notes.md.
- Proposed change: `latency.budgetMs` and `security.encryptionRequired`.
- Status: open

## A flow chart is not an architecture
- Design: designs/imported/url-shortener
- Missing: a figure that is an ordered procedure with a branch ("1. input longURL, 2. is it in
  the DB? yes/no") has no expression: a design has no sequence and no condition.
- Workaround: treat the steps as ignored, keep only the runtime elements the chart names, and
  put the procedure in notes.md.
- Proposed change: none. Designs describe structure; sequence belongs to a different document
  type, if ever.
- Status: rejected for v1


## No group kind for an ownership boundary
- Design: docs/inventory/oci.md (coverage pass 2026-09-21); no committed design yet, because the
  gap is why none of the OCI reference material could be encoded as drawn.
- Missing: the box every cloud vendor draws first. Oracle's own architecture diagrams nest
  resources by **compartment**, the tenancy subtree that owns them, sets quotas on them and is
  the subject of every IAM policy statement. The v1 group kinds are `region`,
  `availability-zone`, `vpc`, `trust-zone`, `system`, `cell` and `point-of-presence`: every one
  of them is a place or a blast radius, and none of them says who owns what is inside. The same
  box exists under a different name in every other provider - an AWS account or organizational
  unit, an Azure subscription or resource group, a GCP project or folder, an IBM Cloud resource
  group, an Alibaba Cloud resource group. A compartment is not a region (compartments span
  regions), not a VPC (a VCN lives in one), and not a trust zone (two compartments in one
  tenancy are usually inside the same trust boundary; the split is billing, quota and
  administration).
- Workaround: `trust-zone`, which is wrong whenever the compartments are equally trusted, or
  `system`, which loses the fact that the boundary is enforced by the provider and not by the
  design. Most often the boundary is simply dropped and recorded in notes.md.
- Proposed change: a group kind `ownership-boundary`, with the provider's own word carried as the
  group's label (compartment, account, subscription, resource group, project, folder). It earns
  its place the way `cell` did: rules want to read it. A rule that says a database and its
  replica must not share a blast radius already reads `availability-zone`; the same rule about
  administrative blast radius - one deleted compartment, one revoked account - needs this one.
  A second rule candidate: a node in one ownership boundary reached synchronously from another
  crosses an IAM boundary the design should show. No schema change is made until one of those
  rules is written.
- Status: open
