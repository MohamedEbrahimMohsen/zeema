# News feed system (source transcription)

## Citation

- Book: *System Design Interview – An Insider's Guide* (Volume 1), Alex Xu.
- Chapter 11: "Design a News Feed System", pages 166-177.
- Figures used: **Figure 11-4**, "detailed design for feed publishing" (page 171) and
  **Figure 11-7**, "detailed design for news feed retrieval" (page 174).
- The book is copyrighted: no page, image or prose of it is stored here. What follows is a
  factual transcription of the two figures (box labels, boundaries, arrow directions and
  arrow labels), which the fidelity check needs.

The chapter designs **one** system in two flows. Figure 11-4 is the write path (feed
publishing), Figure 11-7 is the read path (news feed retrieval). The caches, the databases and
the web tier are drawn in both figures; this transcription is the union, each distinct box
listed once, and it says which figure each item comes from.

Other figures in the chapter, not imported: 11-1 (chapter title illustration), 11-2 and 11-3
(the high-level versions of the same two flows, subsets of 11-4 and 11-7), 11-5 (a zoom on the
fanout service, a subset of 11-4), 11-6 (a `post_id` / `user_id` table, not an architecture),
11-8 (the five cache layers, a list, not an architecture).

## Boxes

| # | Text as drawn | Drawn as | Figure |
|---|---|---|---|
| 1 | Web browser | laptop icon with caption, inside the "User" box | 11-4, 11-7 |
| 2 | Mobile app | phone icon with caption, inside the "User" box | 11-4, 11-7 |
| 3 | DNS | grey globe icon, top left | 11-4, 11-7 |
| 4 | CDN | blue cloud icon, top right | 11-7 |
| 5 | Load balancer | blue funnel icon | 11-4, 11-7 |
| 6 | Web servers | three green server icons inside the dashed box, caption below them | 11-4, 11-7 |
| 7 | Authentication | rectangle inside the same dashed box, upper half | 11-4, 11-7 |
| 8 | Rate Limiting | rectangle inside the same dashed box, lower half | 11-4, 11-7 |
| 9 | Post Service | rounded rectangle, left | 11-4 |
| 10 | Post Cache | three stacked "CACHE" tiles | 11-4, 11-7 |
| 11 | Post DB | three cylinders | 11-4, 11-7 |
| 12 | Notification Service | rounded rectangle, right | 11-4 |
| 13 | Fanout Service | rounded rectangle, centre | 11-4 |
| 14 | Graph DB | single cylinder with a graph glyph | 11-4 |
| 15 | Message Queue | three envelopes in a chevron | 11-4 |
| 16 | User Cache | three stacked "CACHE" tiles | 11-4, 11-7 |
| 17 | User DB | three cylinders | 11-4, 11-7 |
| 18 | Fanout Workers | three green server icons inside a dashed box, caption below them | 11-4 |
| 19 | News Feed Cache | three stacked "CACHE" tiles | 11-4, 11-7 |
| 20 | News Feed Service | rounded rectangle | 11-7 |

20 distinct boxes.

## Boundaries

| # | Text as drawn | Contains | Figure |
|---|---|---|---|
| A | User | Web browser, Mobile app | 11-4, 11-7 |
| B | (none, dashed rounded box) | Web servers, Authentication, Rate Limiting | 11-4, 11-7 |
| C | (none, dashed rounded box) | Fanout Workers | 11-4 |

3 distinct boundaries.

## Arrows

Circled step numbers (1..6 in both figures) are reading order, not arrow text; the text that
sits beside a number is the arrow's label and is transcribed below.

### Figure 11-4, feed publishing

| # | From | To | Label |
|---|---|---|---|
| 1 | User (boundary) | DNS | |
| 2 | User (boundary) | Load balancer | v1/me/feed?content=Hello&auth_token={auth_token} |
| 3 | Load balancer | Web servers (boundary) | |
| 4 | Web servers (boundary) | Post Service | |
| 5 | Web servers (boundary) | Fanout Service | |
| 6 | Web servers (boundary) | Notification Service | |
| 7 | Post Service | Post Cache | |
| 8 | Post Cache | Post DB | |
| 9 | Fanout Service | Graph DB | get friend ids |
| 10 | Fanout Service | User Cache | get friends data |
| 11 | Fanout Service | Message Queue | |
| 12 | User Cache | User DB | |
| 13 | Message Queue | Fanout Workers (boundary) | |
| 14 | Fanout Workers (boundary) | News Feed Cache | |

### Figure 11-7, news feed retrieval

| # | From | To | Label |
|---|---|---|---|
| 15 | User (boundary) | DNS | same arrow as #1 |
| 16 | User (boundary) | CDN | |
| 17 | User (boundary) | Load balancer | /v1/me/feed |
| 18 | Load balancer | Web servers (boundary) | same arrow as #3 |
| 19 | Web servers (boundary) | News Feed Service | |
| 20 | Web servers (boundary) | User (boundary) | |
| 21 | News Feed Service | News Feed Cache | |
| 22 | News Feed Service | User Cache | |
| 23 | News Feed Service | Post Cache | |
| 24 | User Cache | User DB | same arrow as #12 |
| 25 | Post Cache | Post DB | same arrow as #8 |

21 distinct arrows: 14 in Figure 11-4, 11 in Figure 11-7 of which 4 (#15, #18, #24, #25) are
the same arrow between the same pair of boxes as in Figure 11-4. Arrows #2 and #17 are both
drawn from the User boundary to the Load balancer but carry different labels (the publish
request and the retrieval request), so they are two arrows.

## Numbers stated in the chapter

- 10 million DAU; a user can have up to 5000 friends; the feed is sorted in reverse
  chronological order; posts can contain images and videos. No SLA, latency target, region
  count or durability figure is stated anywhere in the chapter.
