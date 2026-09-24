# Design A URL Shortener: import notes

A URL shortener like TinyURL. Users call a load balancer in front of web servers that create
short links and redirect short URLs to the original long ones, reading the mapping from a cache
first and a database behind it.

- Source: *System Design Interview - An Insider's Guide* (Volume 1), Alex Xu, Chapter 8
  "Design A URL Shortener", pages 119-131. Figures **8-7** (URL shortening deep dive, page 128)
  and **8-8** (the detailed design of URL redirecting, page 129).
- Format: `book-figure`. The book is copyrighted, so `source/url-shortener.md` holds the
  citation and a factual transcription of the two figures (boxes, boundaries, arrows) that I
  wrote myself. No page, image or prose from the book is in the repository.
- Counts: 5 boxes, 0 boundaries, 5 arrows in the source; the design has 5 nodes, 0 groups,
  5 edges. `validate.mjs --design`, `check_fidelity.py` and `design_to_mermaid.py` all pass.

## What "the union of the two deep dives" turned out to be

The chapter ends with two complementary flows of one system: the write path (shortening,
Figure 8-7) and the read path (redirecting, Figure 8-8).

Figure 8-8 is an architecture picture: User, Load balancer, Web servers, Cache, Database.

Figure 8-7 is **a flow chart, not an architecture picture**. Its six boxes are numbered steps
of one procedure ("1. input: longURL", "2. longURL in DB?", "3. return shortURL",
"4. Generate a new ID", "5. Convert ID to shortURL", "6. Save ID, shortURL, longURL in DB").
Per the import rules, step boxes are not runtime elements and go to `ignored`. The only
runtime element the flow chart names is the store, written "DB" inside steps 2 and 6, which is
the same box Figure 8-8 draws as "Database" - counted once, as instructed.

So the union of runtime elements across the two figures is exactly the five boxes of
Figure 8-8, and the union of arrows is exactly its five arrows: the write path uses the same
client, the same load balancer, the same web tier and the same database, and its two database
interactions (the longURL lookup of step 2 and the row insert of step 6) run along the already
drawn `web-servers -> database` edge in the same direction. Nothing from Figure 8-7 was
dropped; nothing was duplicated. `mapping.yaml` lists both figures under `source.figures`, each
Figure 8-7 box under `ignored` with its reason, and the notes on `web-servers -> database` and
on `user -> load-balancer` record which steps of the write path travel along them.

## Mapping

| Source text | Figure | Node | Component | Kind | Confidence |
|---|---|---|---|---|---|
| User | 8-8 | user | web-browser | client | close |
| Load balancer | 8-8 | load-balancer | load-balancer-tier | load-balancer | close |
| Web servers | 8-8 | web-servers | container-service | app-server | close |
| Cache | 8-8 | cache | cache-cluster | cache | close |
| Database | 8-8 / 8-7 ("DB") | database | relational-database | sql-database | close |

Every box is unbranded, so every mapping is the generic `default` provider component and
`confidence: close`. No `assumed` mapping, no missing component, nothing added to the
catalogue.

## Decisions and assumptions

- **User**: the box is labelled "User" and holds a laptop icon and a phone icon. The chapter
  describes what happens "when you enter a tinyurl onto the browser", so `web-browser`
  (`platform: web` by default). `mobile-app` would have dropped the laptop; splitting the box
  into two clients would have added a box the figure does not draw.
- **The dashed border around the web servers is not a boundary.** It wraps the three server
  icons and their own caption "Web servers" and contains no other box, so it is how the book
  draws a server cluster. The design therefore has no groups. This differs from
  `designs/imported/notification-system-design`, where a dashed border around the Workers box
  became a `system` group; that figure used the same border style around a genuine multi-box
  boundary (Notification servers + Authentication + Rate limit) and the Workers border matched
  it. Here there is nothing for a boundary to contain, and an empty one-member `system` group
  would be a box the figure does not show.
- **Arrow 5** (`Load balancer -> User`) is drawn leaving the load balancer's left side, not the
  web servers'; the design keeps the direction and the endpoints as drawn.
- **Circled numbers** on the Figure 8-8 arrows and the leading "1." .. "6." on the Figure 8-7
  boxes are step markers. They are in `ignored`; only the two arrows that carry real text
  ("GET https://tinyurl.com/zn9edcu", "Return long URL: ...") have an edge `label`.
- **Protocols**: `https` on the client and web tier edges (the API is REST over HTTP), `sql` to
  the relational database, and `cache` to the unnamed cache tier. All five edges are `sync`;
  the figure shows a request/response redirect with no queue.
- **`requirements`**: only `traffic.readWriteRatio: 10`, which the estimation section states
  outright ("Assuming ratio of read operation to write operation is 10:1"). Nothing else in the
  chapter is a promise the format can hold - see Gaps.
- No `props` and no `nfr`: the figures state no eviction policy, no replication, no instance
  count, and the per-node share of the 1160/11,600 operations per second is not stated.

## Observations (not encoded, the figures do not draw them)

- The distributed unique ID generator is discussed in prose next to Figure 8-7 ("A new unique
  ID (primary key) Is generated by the unique ID generator", "The distributed unique ID
  generator is worth mentioning") and is the subject of Chapter 7, but Figure 8-7 draws it only
  as the step "4. Generate a new ID". No node was added for it.
- The wrap-up section suggests a rate limiter, web tier scaling, database replication and
  sharding, and an analytics solution. None is drawn, so none is in the design.
- Figures 8-1, 8-2, 8-3, 8-5 and 8-6 are the high-level redirect illustration, the
  client/server sequence, the hash function sketch and the two hashValue algorithms. They are
  superseded by, or are inputs to, the two deep dives and are not part of the imported system.
- The chapter chooses base 62 conversion over hash + collision resolution, and mentions a bloom
  filter only as an improvement to the rejected approach.
- The 301 vs 302 redirect discussion is a property of the response, not of any box.

## Gaps

Also listed in `mapping.yaml` under `gaps`:

- The estimation gives 1160 writes/s and 11,600 reads/s for the whole design; `requirements`
  has no throughput path, so only the 10:1 ratio survived.
- 365 billion records and 365 TB over 10 years: no capacity or retention requirement path.
- Figure 8-7 is an ordered procedure with a `yes`/`no` branch. The format expresses a graph of
  runtime elements, not a sequence of steps or a conditional path, so the write path survives
  only as the `web-servers -> database` edge plus this note.
- No protocol string for an unnamed cache tier; the catalogue's cache protocols are product
  names (`redis`, `memcached`). The edge uses `"cache"`.
- `mapping.yaml` can name several figures in `source.figures`, but there is no per-item field
  saying which figure a node, edge or ignored box came from; that had to go in each `note`.

## Rules fired

`node .claude/tools/validate.mjs --design designs/imported/url-shortener/design.yaml`

| Rule | Severity | Subject |
|---|---|---|
| datastore-missing-backup | error | database |
| cache-missing-eviction-policy | warning | cache |
| credentials-without-rotation | warning | design |

All three are the product working on a book figure that states none of those facts: the
chapter says nothing about backups, cache eviction or credential rotation. The design was not
changed to silence them.

Components added: none. Kinds added: none.
