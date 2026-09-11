# Intake: Distributed rate limiter (Xu vol 1 ch 4, with Stripe and Cloudflare production designs)

## Source
- Primary: Alex Xu, System Design Interview vol 1, chapter 4 "Design a rate limiter"; author's own public primer https://blog.bytebytego.com/p/rate-limiting-fundamentals plus chapter summaries via search
- Primary: https://stripe.com/blog/rate-limiters (official Stripe, 2017: four limiter types, token bucket in Redis, fail open, dark launch)
- Primary: https://blog.cloudflare.com/counting-things-a-lot-of-different-things/ (official Cloudflare, 2017: sliding-window approximation on memcached per PoP; via search summary)
- Verified by: canonical textbook chapter + two official production posts
- Confidence: high
- Date of source: 2017-2024

## System in three lines
A middleware or gateway component that decides, per identifier (user, API key, IP), whether a request is within its allowed rate, using a counting algorithm (token bucket, leaky bucket, fixed window, sliding log, sliding counter) over shared state in Redis or memcached, returning 429 with rate headers when exceeded. Production versions layer several limiters: per-user request rate, per-user concurrency, fleet-level load shedding by endpoint priority, and worker-utilisation shedding. Hard because counters are shared across many servers (races and sync), limits must fail open when the store is down, and the limiter itself must be cheaper than the work it protects.

## Scale (only if stated)
- Users / DAU: not stated
- Requests per second: Cloudflare limiter handles "several billion requests per day" and mitigated attacks of "400,000 requests per second to a single domain"; Stripe "rejected millions of requests this month alone"
- Data volume: Cloudflare test: 400M requests from 270,000 sources; 0.003% wrongly allowed or limited
- Message throughput: none
- Book example numbers: limits like 5 requests/min per user; memory per user small (sliding log heavier)

## Requirements stated or clearly implied
- Availability target: limiter must never take the API down; "fail open" when Redis or code fails (Stripe)
- Consistency: approximate counts acceptable ("an approximation of the actual rate", Cloudflare); race conditions on read-modify-write mitigated with Lua scripts or sorted sets (book)
- Latency target: minimal added latency; memcached/Redis in-memory counters
- Ordering needs: none
- Replay or reprocessing: none; dropped requests optionally queued for later (book)
- Retention: counters expire with window
- Compliance / residency: none
- Operability: dark launch, feature flags and kill switches before enforcement (Stripe)

## Boundaries
- Regions / zones: per-PoP counting at Cloudflare (no global sync); Stripe central Redis
- Trust zones: clients -> gateway/middleware limiter -> API servers; rules store internal
- Named subsystems: Limiter middleware, Rules configuration and workers, Counter store (Redis/memcached), Response path (429, headers, retry-after), Load shedders (fleet and worker), Monitoring

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Clients | API consumers; expected to back off on 429 or use bounded worker pools | any | web-client, sdk-client | retryOn429: true |
| 2 | API gateway / middleware limiter | Checks counters, applies rules, returns 429 with X-RateLimit headers | in-house, nginx, envoy ratelimit | rate-limiter | algorithm: token-bucket or sliding-window-counter; placement: gateway |
| 3 | Rules store and workers | Limit rules per endpoint/user tier stored on disk, pulled into cache by workers | config files, cache | coordination-service + worker | |
| 4 | Counter store | Shared in-memory counters/buckets with expiry; Lua or sorted sets for atomicity | Redis (Stripe, book), memcached (Cloudflare) | cache | atomicOps: lua |
| 5 | Request rate limiter | N requests/sec per user with burst allowance | Stripe | rate-limiter | scope: per-user |
| 6 | Concurrent requests limiter | Max in-flight requests per user (e.g. 20) | Stripe | rate-limiter | scope: per-user-concurrency |
| 7 | Fleet usage load shedder | Reserves fleet share for critical methods; 503 for non-critical over allocation | Stripe | rate-limiter (load shedder) | scope: fleet |
| 8 | Worker utilisation load shedder | Sheds lowest priority first (test, GET, POST, critical) when workers back up | Stripe | rate-limiter (load shedder) | scope: worker |
| 9 | Per-PoP approximate counter | Sliding-window approximation on memcached with minimal contention | Cloudflare | rate-limiter | approximation: true; perPoP: true |
| 10 | Dropped-request queue (optional) | Book option to enqueue rejected requests for later processing | queue | queue | |
| 11 | Monitoring | Effectiveness of rules and algorithm; dark-launch counters | in-house | monitoring | |
| 12 | Feature flags / kill switch | Disable limiters if they misfire | in-house | feature-flag-service | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | gateway limiter | https | sync | | |
| gateway limiter | counter store | redis/memcached | sync | | atomic incr / lua |
| gateway limiter | rules cache | local | sync | | |
| rules workers | rules store -> cache | pull | async | | periodic |
| gateway limiter | api servers | http | sync | | allowed |
| gateway limiter | client | http 429 + headers | sync | | rejected |
| gateway limiter | dropped queue | enqueue | async | | optional |
| api servers | fleet/worker shedders | in-process | sync | | priority classes |
| limiter | monitoring | metrics | async | | dark launch |
| feature flags | limiter | config | async | | kill switch |
| counter store (down) | limiter | error | sync | | fail open |

## Failure modes, incidents, tradeoffs the source discusses
- Window edge bursts: fixed window "vulnerable to burst traffic at window boundaries"; sliding counter smooths. Source: book/primer.
- Memory vs accuracy: sliding log is exact but "has high memory consumption". Source: book summary.
- Race condition on read-modify-write across servers; use Lua scripts or sorted sets; strict locking slows the system. Source: book summary.
- Approximation accepted: assumes "a constant rate of requests during the previous sampling period"; 0.003% error at 400M requests. Source: Cloudflare.
- Fail open: "if Redis were to go down, requests wouldn't be affected"; catch exceptions at all levels. Source: Stripe.
- Retry storms fixed by concurrency limits: concurrent limiter "totally solved" retry hammering of overloaded resources. Source: Stripe.
- Fleet reservation: "a certain percentage of your fleet will always be available for your most important API requests". Source: Stripe.
- Rollout: "Dark launch each rate limiter to watch the traffic they would block"; keep kill switches. Source: Stripe.
- Client programming model change: bounded worker pools vs hammer-and-back-off. Source: Stripe.

## Unknowns
- Global vs per-region limits synchronisation in the book (mentions eventual consistency, sticky sessions rejected)
- Exact header conventions across sources
- Cloudflare per-PoP details beyond the summary

## Candidates
- New kinds: none; rate-limiter now has four scopes (per-user rate, per-user concurrency, fleet shedder, worker shedder); sightings: rate-limiter (5th), feature-flag-service (2nd), cache (19th), coordination-service (10th), queue (11th), monitoring (16th)
- New properties on existing kinds: rate-limiter.algorithm (token-bucket, leaky-bucket, fixed-window, sliding-log, sliding-counter), scope (user, ip, api-key, concurrency, fleet, worker), failMode (open, closed), approximate (boolean), placement (client, middleware, gateway, edge); cache.atomicOps (lua, cas)
- New edge properties: rejectCode (429, 503); retryAfterHeader (boolean)
- New requirement paths: availability.limiterFailOpen (boolean); abuse.rateLimited (2nd sighting); traffic.burstAllowed (boolean)
- New rules:
  - limiter-fail-closed-on-critical-path: rate-limiter failMode closed in front of critical api-gateway (availability risk)
  - fixed-window-with-burst-sensitivity: rate-limiter algorithm fixed-window while traffic.burstAllowed false and downstream fragile (informational)
  - shared-counter-without-atomic-ops: rate-limiter with multi-node counter store and atomicOps none (race)
  - no-concurrency-limit-on-expensive-endpoints: api-gateway exposing CPU-heavy endpoints with only rate scope limiter (Stripe lesson)
  - limiter-without-kill-switch: rate-limiter with no feature-flag edge (informational, rollout safety)
