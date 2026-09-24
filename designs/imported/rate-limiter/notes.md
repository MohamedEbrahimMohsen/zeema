# Rate limiter: import notes

An API rate limiter. Middleware in front of the API servers counts each client's requests in
Redis against rules that workers load from storage into a cache. Allowed requests pass through;
the rest get HTTP 429 or go to a message queue for later.

- Source: *System Design Interview – An Insider's Guide*, Alex Xu, Chapter 4 "Design a Rate
  Limiter", pages 51-70. Imported figure: **Figure 4-13**, the detailed design, page 65.
  The book is copyrighted; `source/rate-limiter.md` holds the citation and a factual
  transcription of the boxes, boundaries and arrows, nothing else.
- Format: `book-figure`. Figure 4-13 draws 9 boxes, 0 boundaries and 10 arrows; one box
  ("Request dropped") and the arrow into it are `ignored`, so the counted source totals are
  8 nodes, 0 groups, 9 edges, which is what the design has. `check_fidelity.py` passes.
- Figure 4-12 (page 62), which the chapter calls the high-level architecture, was checked
  against the image and is a strict subset of Figure 4-13 (Client, Rate limiter middleware,
  API Servers, Redis, with the same double-headed Redis line). Figure 4-16 (page 67) is a
  sub-illustration of the synchronisation problem (two rate limiters, one Redis) and adds no
  box that 4-13 does not have. Figure 4-13 is therefore the whole final architecture and the
  only figure imported.

## Mapping

| Source text | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Client | client | web-browser | client | assumed |
| Rate limiter middleware | rate-limiter-middleware | redis-rate-limiter | rate-limiter | close |
| Cached rules | cached-rules | cache-cluster | cache | close |
| Rules | rules | blob-store | object-store | assumed |
| Workers | workers | container-worker | worker | close |
| API Servers | api-servers | container-service | app-server | close |
| Redis | redis | redis | cache | exact |
| Message queue | message-queue | message-queue | queue | close |

Groups: none. The two cyan dashed rounded boxes are the drawing style of the "Workers" and
"API Servers" boxes themselves; each holds only server icons and its own caption, so neither
is a boundary around other boxes.

## Assumptions

- **Client** is one box holding a laptop icon and a phone icon. A node carries one client
  component and a box may not be split, so `user-device` was chosen as the generic HTTP client
  (the chapter is about HTTP APIs). Marked `assumed` because `mobile-app` is equally drawn.
- **Rate limiter middleware** names no product. `in-process-limiter` would contradict the
  design (the chapter's whole point is a distributed limiter with a shared store) and
  `envoy-ratelimit`/`nginx-limit-req` would name products the figure does not show.
  `redis-rate-limiter` is the limiter whose counters are in Redis, which is exactly what the
  figure draws and what the chapter describes (INCR/EXPIRE, Lua scripts against Redis).
  Marked `close`: the Redis box in the figure is the store, the hexagon is the logic, and the
  two stay separate nodes.
- **Rules** is a store of rate limiting configuration files on disk. The catalogue has no
  generic on-disk configuration or file store (`file-storage` has only named products such as
  NFS or HDFS; the config-server components sit under `feature-flag-service`), so `file-store`,
  the only engine-less storage generic, was used. Marked `assumed`; see gaps.
- **Request dropped** (a droplet) is the outcome of the rate limited path, not a runtime
  element, and no component represents a discarded request. It and the dashed "option 1" arrow
  into it are in `mapping.yaml` under `ignored`, not silently deleted.
- Arrow directions are exactly as drawn, including `Workers -> Rules` (the arrowhead is at
  Rules; the chapter says the workers pull the rule files from disk). The middleware-Redis
  line is double-headed and became two edges.
- Protocols: `http` on the client and API server hops (the chapter is HTTP layer 7, the 429 is
  an HTTP status), `redis` on the counter hops, `cache` on the two hops into the generic
  "Cached rules" box, `file` on the workers' read of the rules from disk, `queue` on the hop
  into the unnamed broker. Only the queue hop is `async`; everything else is a call whose
  caller waits.
- The queue edge carries `delivery: at-least-once`, the `message-queue` component default.
- The red trunk out of the hexagon is labelled "rate limited" and then splits into three
  arrows. That label was folded into the label of the arrow back to the client
  ("rate limited / 429: too many requests"); the queue arrow keeps its own label "option 2".

## Requirements

The figure states none, but Chapter 4 states these promises about this system, so they are in
`requirements`:

| Path | Value | Where the chapter states it |
|---|---|---|
| `availability.degradedModeAllowed` | true | step 1 requirements, page 52: high fault tolerance, a rate limiter or cache failure must not affect the entire system |
| `availability.multiRegion` | true | performance optimisation, page 67: a multi-data-centre setup is crucial, traffic is routed to the closest edge location |
| `latency.geoDistributed` | true | same paragraph: latency is high for users far from the data centre |
| `consistency.model` | `ap` | performance optimisation, page 68: synchronise data with an eventual consistency model |

The other stated requirements (accurate limiting, low latency, low memory, distributed
limiting, clear exceptions to throttled users) carry no number and no matching requirement
path, so they are not encoded. `latency.p95Ms` needs an integer and the chapter gives none.

## Observations (not encoded, the figure does not show them)

- The five algorithms the chapter compares (token bucket, leaking bucket, fixed window,
  sliding window log, sliding window counter) are not fixed by the design, so the limiter node
  carries no `algorithm` prop.
- The chapter's fault-tolerance requirement implies a fail-open limiter, but neither the figure
  nor its explanation states a fail mode, so `failMode` is left at the component default.
- No dead-letter queue is drawn on the message queue, and no monitoring box is drawn even
  though the chapter has a monitoring section.

## Gaps

- An outcome box such as "Request dropped" has no representation: a design is nodes and edges,
  and a terminal state that is not a runtime element can only go to `ignored`.
- No generic on-disk configuration or file store exists in the catalogue; "Rules" had to become
  `file-store`, which implies remote object storage the figure does not show.
- A double-headed arrow becomes two edges, so one drawn line between the middleware and Redis
  is counted twice in the design.
- A label on a shared trunk that fans out into several arrows cannot be expressed; edge labels
  are per edge.

These are also listed in `mapping.yaml` under `gaps`. They are not copied into
`docs/schema-gaps.md` from here; that file is owned by the session that runs the whole-repository
validation.

## Rules fired

`node .claude/tools/validate.mjs --design designs/imported/rate-limiter/design.yaml`

| Rule | Severity | Subject |
|---|---|---|
| queue-missing-dlq | error | message-queue |
| cache-missing-eviction-policy | warning | cached-rules |
| cache-missing-eviction-policy | warning | redis |
| credentials-without-rotation | warning | design |

All four are the product working on a faithful import of the figure: the book draws no
dead-letter queue, states no eviction policy for either cache, and shows no secret store. The
design was not changed to silence them.

Components added: none. Kinds added: none.

## Consolidation pass, 2026-09-08

The parent session re-mapped this design after the import wave, when generic components were
added to the catalogue for boxes that name no product. Mappings that had to guess a vendor
(and any single-box dashed border that had been read as a boundary) were corrected; the
picture itself is unchanged. `mapping.yaml` holds the current component for every box.
