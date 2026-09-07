# Research loop prompt

Run one iteration per invocation. Each iteration ingests exactly one reference system
from the queue below into an intake card. Do not write design YAML, kinds, components or
rules in this loop. Cards only. Clustering into kinds happens after the queue is done.

## Iteration

1. Open `docs/sources.md`. Pick the first system in the queue below whose id is not
   listed there with status `carded`. If none remain, run the **Closing pass** and stop.
2. Web search for verified material on that system. Priority order:
   1. The company's own engineering blog or conference talk (QCon, InfoQ, re:Invent, KubeCon).
   2. Official cloud reference architecture (AWS, Azure, GCP architecture centers).
   3. Alex Xu, System Design Interview vol 1 and 2, chapter summaries that are public.
   4. Reputable write-ups (ByteByteGo, High Scalability, InfoQ articles) only to fill gaps,
      marked as secondary.
   Use at least two sources. Reject content farms, unattributed Medium posts, and any
   page that names no products and no numbers.
3. Read `docs/intake-template.md`. Write `docs/intake/<system-id>.md` following it
   exactly. Every section present. "not stated" where the sources are silent. Never
   invent a product, a number, or an edge.
4. For `Candidate kind`, check `kinds/` first and reuse existing ids. Propose new ids in
   kebab-case marked `(new)`.
5. Append one row to `docs/sources.md` with status `carded`.
6. Update `docs/kind-candidates.md`: increment counts for every candidate kind in the
   card, add new rows for new candidates, add property and rule candidates from the
   Failure modes section.
7. Stop the iteration. One system per iteration, no exceptions. Report in one line:
   system id, source count, confidence, number of components, number of new kind candidates.

## Quality bar

- A card with fewer than 6 components or no failure modes is marked `confidence: low`
  and a better source is queued for a retry at the end.
- Quote the shortest decisive sentence for each failure mode with its source URL.
- Product names verbatim from source (Cassandra, not "a NoSQL DB") when the source names them.
- Do not summarize the whole article. Extract only what the template asks for.

## Queue (in order)

Verified company systems:
1. uber-dispatch — Uber ride matching and dispatch (DISCO, geospatial index, Ringpop)
2. netflix-streaming — Netflix playback, Open Connect CDN, microservices edge (Zuul)
3. google-drive — Google Drive / Dropbox style file sync (chunking, metadata DB, notifications)
4. whatsapp-messaging — WhatsApp / Signal style 1:1 and group messaging (Erlang, message queues, presence)
5. youtube-upload-playback — YouTube video upload, transcoding pipeline, playback
6. twitter-timeline — Twitter home timeline (fan-out on write vs read, timeline cache)
7. instagram-feed — Instagram feed and media storage
8. stripe-payments — Stripe style payment processing (idempotency, ledger, PSP integration)
9. shopify-flash-sale — Shopify flash sale / checkout under load (queueing, pod architecture)
10. airbnb-search — Airbnb search and ranking (search index, pricing, availability)
11. slack-messaging — Slack real-time messaging (channels, WebSocket edge, message persistence)
12. discord-messages — Discord message storage (Cassandra to ScyllaDB migration, data services)
13. linkedin-kafka — LinkedIn event pipeline, origin of Kafka, stream processing
14. spotify-playback — Spotify streaming, event delivery, recommendations pipeline
15. cloudflare-edge — Cloudflare edge network, DNS, WAF, Workers
16. figma-multiplayer — Figma multiplayer editing (CRDT-ish, WebSocket, LiveGraph)
17. notion-sharding — Notion Postgres sharding
18. doordash-delivery — DoorDash order and dispatch
19. tinder-geo — Tinder / geo matching (geosharding, recommendations)
20. zoom-video — Zoom video conferencing (SFU, media routing, multimedia routers)
21. pinterest-feed — Pinterest home feed and Pixie graph
22. reddit-feed — Reddit feed and comment tree
23. twitch-live — Twitch live streaming ingest and distribution
24. tiktok-recommendation — TikTok / short video feed and recommendation pipeline
25. amazon-order — Amazon order pipeline and inventory (public talks)
26. robinhood-trading — Robinhood / brokerage order routing
27. coinbase-exchange — Coinbase / exchange matching engine and wallet
28. google-maps — Google Maps routing, tiles, location updates
29. booking-search — Booking.com search and availability (MySQL, Cassandra, Kafka)
30. grab-geo — Grab geo services and dispatch (Southeast Asia super app)

Canonical textbook designs (Alex Xu vol 1 and 2, public chapter material):
31. url-shortener — URL shortener
32. rate-limiter — Distributed rate limiter
33. notification-system — Multi-channel notification system (push, SMS, email, SMTP gateway)
34. news-feed — Generic news feed
35. chat-system — Generic chat system
36. search-autocomplete — Search autocomplete / typeahead
37. key-value-store — Distributed key-value store (Dynamo style)
38. unique-id-generator — Unique ID generator (Snowflake)
39. web-crawler — Web crawler
40. proximity-service — Proximity / nearby search (Yelp style)
41. nearby-friends — Nearby friends (location streaming)
42. distributed-message-queue — Distributed message queue internals
43. metrics-monitoring — Metrics monitoring and alerting
44. ad-click-aggregation — Ad click event aggregation
45. hotel-reservation — Hotel reservation (inventory, overbooking, idempotency)
46. distributed-email — Distributed email service (SMTP, IMAP, spam, search)
47. object-storage — S3 style object storage
48. payment-system — Payment system (PSP, ledger, reconciliation)
49. digital-wallet — Digital wallet (balance transfer, exactly-once, event sourcing)
50. stock-exchange — Stock exchange (matching engine, market data, order gateway)

## Closing pass (after the queue is exhausted or on final iteration)

1. Sort `docs/kind-candidates.md` by count, descending.
2. Write `docs/intake/SUMMARY.md`: systems carded, cards marked low confidence, top 40
   kind candidates with counts, top 20 property candidates, top 20 rule candidates, and
   any candidate kinds that look like duplicates of each other (same role, different name).
3. Stop.
