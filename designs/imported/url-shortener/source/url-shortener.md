# Design A URL Shortener (source transcription)

## Citation

- Book: *System Design Interview - An Insider's Guide* (Volume 1), Alex Xu.
- Chapter 8: "Design A URL Shortener", pages 119-131.
- Figures used: **Figure 8-7** ("URL shortening deep dive" flow, page 128) and
  **Figure 8-8** ("the detailed design of the URL redirecting", page 129).
- The book is copyrighted. Neither the PDF, its pages, its images nor its prose are stored in
  this repository. What follows is a factual transcription of the two figures: the box labels
  as drawn, the boundaries and the arrows. Box labels are facts and the fidelity check needs
  them.

The chapter's final system is the union of the two deep dives: the write path (shortening,
Figure 8-7) and the read path (redirecting, Figure 8-8). Figure 8-7 is a flow chart of the
shortening procedure, not an architecture picture; the only runtime element it draws is the
DB, which is the same box as Figure 8-8's Database. Each distinct box is therefore counted
once, and the union of runtime elements is the five boxes of Figure 8-8.

## Figure 8-7 - URL shortening deep dive (flow chart, page 128)

Boxes, in the order drawn:

| # | Text as drawn | Drawn as |
|---|---|---|
| 1 | 1. input: longURL | rounded box, top left |
| 2 | 2. longURL in DB? | diamond, top centre |
| 3 | 3. return shortURL | rounded box, top right |
| 4 | 4. Generate a new ID | rounded box |
| 5 | 5. Convert ID to shortURL | rounded box |
| 6 | 6. Save ID, shortURL, longURL in DB | rounded box, bottom |

Boundaries: none.

Arrows:

| # | From | To | Label |
|---|---|---|---|
| 1 | 1. input: longURL | 2. longURL in DB? | |
| 2 | 2. longURL in DB? | 3. return shortURL | yes |
| 3 | 2. longURL in DB? | 4. Generate a new ID | no |
| 4 | 4. Generate a new ID | 5. Convert ID to shortURL | |
| 5 | 5. Convert ID to shortURL | 6. Save ID, shortURL, longURL in DB | |

Every box is a numbered step of one procedure, not a runtime element. The store the procedure
reads and writes is written "DB" inside steps 2 and 6; it is the same store Figure 8-8 draws
as "Database". No box named "unique ID generator" is drawn; the chapter's prose next to the
figure says the new ID of step 4 comes from a distributed unique ID generator.

## Figure 8-8 - detailed design of URL redirecting (page 129)

Boxes, left to right:

| # | Text as drawn | Drawn as |
|---|---|---|
| 1 | User | rounded box, far left, holding a laptop icon and a phone icon |
| 2 | Load balancer | blue trapezoid icon with a four-way arrow, caption below the icon |
| 3 | Web servers | three green server icons with the caption inside a dashed rounded border |
| 4 | Cache | three stacked blue "CACHE" tiles in a rounded box, caption below |
| 5 | Database | three blue cylinders in a rounded box, caption below |

Boundaries: none. The dashed border around the web servers holds the server icons and their
own caption "Web servers" and no other box; it is the way the book draws a server cluster,
not a boundary around other boxes.

Arrows (the circled numbers are step markers, not arrow labels):

| # | Step marker | From | To | Label |
|---|---|---|---|---|
| 1 | (1) | User | Load balancer | GET https://tinyurl.com/zn9edcu |
| 2 | (2) | Load balancer | Web servers | |
| 3 | (3) | Web servers | Cache | |
| 4 | (4) | Web servers | Database | |
| 5 | (5) | Load balancer | User | Return long URL: https://en.wikipedia.org/wiki/Systems_design |

Counts for the union of both figures, each distinct box counted once: 5 boxes, 0 boundaries,
5 arrows.

## Numbers the chapter states (back of the envelope estimation, page 120)

- 100 million URLs generated per day; 1160 writes per second.
- Ratio of read operations to write operations is 10:1; 11,600 reads per second.
- 365 billion records over 10 years; average URL length 100 bytes; 365 TB over 10 years.
- The hashValue is 7 characters from [0-9, a-z, A-Z].
