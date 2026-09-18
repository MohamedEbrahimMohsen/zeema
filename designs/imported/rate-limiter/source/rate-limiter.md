# Rate limiter (source transcription)

## Citation

- Book: *System Design Interview – An Insider's Guide*, Alex Xu.
- Chapter 4: "Design a Rate Limiter", pages 51-70.
- Figure imported: **Figure 4-13**, "detailed design of the system", page 65.
- Related figure, not imported: Figure 4-12 (page 62), the high-level architecture. It shows a
  strict subset of Figure 4-13 (Client, Rate limiter middleware, API Servers, Redis) and is
  superseded by it.

The book is copyrighted. Neither its pages, its images nor its prose are stored here. What
follows is a factual transcription of what Figure 4-13 draws: the boxes, the boundaries and
the arrows, with their labels as lettered on the figure.

## Boxes as drawn (Figure 4-13)

| # | Text as drawn | Drawn as |
|---|---|---|
| 1 | Client | rounded box, far left, containing a laptop icon and a phone icon |
| 2 | Rate limiter middleware | hexagon, centre |
| 3 | Cached rules | blue rounded square with the word CACHE inside; caption "Cached rules" below it |
| 4 | Rules | rounded box, top right |
| 5 | Workers | three green server icons inside a cyan dashed rounded box; caption "Workers" inside the same dashed box |
| 6 | API Servers | three green server icons inside a cyan dashed rounded box; caption "API Servers" inside the same dashed box |
| 7 | Redis | red stacked-slab Redis logo; caption "Redis" below it |
| 8 | Message queue | blue chevron holding three envelope icons; caption "Message queue" below it |
| 9 | Request dropped | small black droplet outline; caption "Request dropped" below it |

## Boundaries

None. The two cyan dashed rounded boxes are the drawing style of the "Workers" and
"API Servers" boxes themselves (each holds only server icons and its own caption), not
containers around other boxes.

## Arrows as drawn

| # | From | To | Label | Style |
|---|---|---|---|---|
| 1 | Client | Rate limiter middleware | | solid blue |
| 2 | Rate limiter middleware | Cached rules | | solid blue |
| 3 | Workers | Cached rules | | solid blue |
| 4 | Workers | Rules | | solid blue |
| 5 | Rate limiter middleware | API Servers | success | solid blue, label in green |
| 6 | Rate limiter middleware | Redis | | solid blue, double-headed line |
| 7 | Redis | Rate limiter middleware | | the other head of the same line |
| 8 | Rate limiter middleware | Client | rate limited / 429: too many requests | solid red |
| 9 | Rate limiter middleware | Request dropped | option 1 | dashed red |
| 10 | Rate limiter middleware | Message queue | option 2 | dashed red |

The red trunk leaves the bottom of the hexagon carrying the label "rate limited", reaches a
junction, and from that junction the three red arrows 8, 9 and 10 continue. Arrow 8 carries
the second label "429: too many requests" along its horizontal run.

Counts as drawn: 9 boxes, 0 boundaries, 10 arrows.

## Figure captions the chapter gives these figures

- Figure 4-12 (page 62): high-level architecture for rate limiting.
- Figure 4-13 (page 65): detailed design.

## Facts the chapter states about Figure 4-13 (paraphrased, not quoted)

- Rules are stored on disk; workers pull them from disk at a frequent interval and put them in
  the cache.
- The rate limiter middleware loads rules from the cache and fetches counters and the last
  request timestamp from the Redis cache.
- A request that is not rate limited is forwarded to the API servers; a rate limited one gets a
  429 response and is either dropped or forwarded to the queue.
- Counters are kept in an in-memory store rather than a database because of disk latency; Redis
  is named, with its INCR and EXPIRE commands.
- Race conditions on the Redis counter are solved with Lua scripts or Redis sorted sets.
- Requirements the chapter states for the system (step 1, page 52): accurate limiting, low
  latency, low memory use, distributed rate limiting shared across servers or processes, clear
  exceptions to throttled users, and high fault tolerance so a rate limiter or cache failure
  does not affect the entire system.
- Performance section (pages 67-68): a multi-data-centre setup with traffic routed to the
  closest edge location, and data synchronised with an eventual consistency model.
