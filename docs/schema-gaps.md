# Schema gaps

A running log of things the v1 format could not express while encoding real designs.
Each entry drives the v2 agenda. Nothing is added to the format without an entry here
first.

Format for an entry:

```
## <short title>
- Design: designs/<id>.yaml
- Missing: what could not be said
- Workaround: what the design does instead
- Proposed change: kind / property / predicate / requirement path, and why
- Status: open | accepted | rejected
```

---

## Only six kinds exist
- Design: designs/multi-region-web.yaml, designs/order-processing.yaml
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
- Design: docs/intake/doordash-delivery.md, docs/intake/payment-system.md, docs/intake/netflix-streaming.md
- Missing: retry policy, timeout, idempotency, circuit breaker and fallback on a call.
  Rules such as retry-without-adaptive-shedding and money-mutation-without-idempotency-key
  cannot be written without them.
- Workaround: none possible; the information lives on the edge.
- Proposed change: six optional edge fields (timeoutMs, retryPolicy, idempotent,
  circuitBreaker, fallback, batched) plus the `field`, `from`, `to` predicates.
- Status: accepted in v1

## Rules need the design as a whole
- Design: docs/intake/payment-system.md (money-store-without-double-entry-ledger),
  docs/intake/twitter-timeline.md (read-heavy-path-without-cache)
- Missing: "this design contains no node of kind X".
- Workaround: none.
- Proposed change: `hasNode` predicate usable from any subject.
- Status: accepted in v1

## Cells and points of presence
- Design: docs/intake/slack-messaging.md, docs/intake/amazon-order.md, docs/intake/cloudflare-edge.md
- Missing: a group kind for a failure-isolated cell and for an edge site, so a rule can
  say "sync call crosses a cell".
- Workaround: none.
- Proposed change: group kinds `cell`, `point-of-presence`; predicate `crossesGroup`.
- Status: accepted in v1

## Thresholds in rules
- Design: docs/intake/doordash-delivery.md (single-writer-primary-at-peak-qps)
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
- Design: references/designs/ (every imported design)
- Missing: a place to keep the text of a box or boundary exactly as the source draws it.
  Ids are kebab-case and unique, so "Orders DB (primary)" cannot survive as an id, and an
  import that loses the name is no longer the same design.
- Workaround: none.
- Proposed change: optional `label` string on nodes and groups, mirroring the existing edge
  `label`. Renderers show it; rules never read it.
- Status: accepted in v1
