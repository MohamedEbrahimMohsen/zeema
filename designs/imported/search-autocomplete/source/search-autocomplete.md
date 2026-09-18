# Search autocomplete system (source transcription)

## Citation

- Book: *System Design Interview – An Insider's Guide*, Alex Xu.
- Chapter 13: "Design a search autocomplete system", pages 200-219.
- Figures used: **Figure 13-9** (the redesigned data gathering service, page 211) and
  **Figure 13-11** (the improved query service, page 214). Page numbers are the numbers
  printed in the book; the figure captions are embedded in the images themselves.

The book is copyrighted. Nothing of it is copied into this repository: no pages, no images,
no prose. What follows is a factual transcription of the two figures — the boxes as they are
labelled, the boundaries, and the arrows with their labels — which is what the fidelity check
needs.

## Boxes as drawn

### Figure 13-9, data gathering service (left to right)

| # | Text as drawn | Drawn as |
|---|---|---|
| 1 | Analytics Logs | rounded box with a "LOG" document icon |
| 2 | Aggregators | dashed rounded outline around three green server icons |
| 3 | Aggregated Data | rounded box with three blue cylinders |
| 4 | Workers | dashed rounded outline around three green server icons |
| 5 | Trie DB | rounded box with three blue cylinders, right |
| 6 | Trie Cache | rounded box with three stacked "CACHE" tiles, top right |

### Figure 13-11, query service (top to bottom)

| # | Text as drawn | Drawn as |
|---|---|---|
| 7 | Web browser | laptop icon, inside the "User" box |
| 8 | Mobile app | phone icon, inside the "User" box |
| 9 | Load balancer | blue trapezoid with a fan-out arrow icon |
| 10 | API servers | dashed rounded outline around three green server icons |
| 5 | Trie DB | rounded box with three blue cylinders, bottom right (same box as figure 13-9) |
| 6 | Trie Cache | rounded box with three stacked "CACHE" tiles (same box as figure 13-9) |

Trie DB and Trie Cache are the same two boxes in both figures and are counted once.
Union: 10 distinct boxes.

## Boundaries

| # | Text as drawn | Figure | Contains |
|---|---|---|---|
| A | User | 13-11 | Web browser, Mobile app |

The dashed rounded outlines around Aggregators, Workers and API servers are the book's
server-farm icon (the label belongs to the outline itself), not boundaries around other
boxes; they are transcribed as boxes 2, 4 and 10 above.

## Arrows

| # | Figure | From | To | Label as drawn |
|---|---|---|---|---|
| 1 | 13-9 | Analytics Logs | Aggregators | |
| 2 | 13-9 | Aggregators | Aggregated Data | |
| 3 | 13-9 | Aggregated Data | Workers | |
| 4 | 13-9 | Workers | Trie DB | Update weekly |
| 5 | 13-9 | Trie DB | Trie Cache | Weekly snapshot of DB |
| 6 | 13-11 | Web browser | Load balancer | (1) |
| 7 | 13-11 | Mobile app | Load balancer | (1) |
| 8 | 13-11 | Load balancer | API servers | (2) |
| 9 | 13-11 | API servers | Trie Cache | (3) |
| 10 | 13-11 | Trie Cache | Trie DB | (4) |

The circled digits 1-4 in figure 13-11 are step numbers keyed to the numbered list that
follows the figure, not arrow labels; they are not carried into the design.

Counts for the union: 10 boxes, 1 boundary, 10 arrows.

## Numbers the chapter states (used for `requirements`)

- Autocomplete results must be returned within 100 milliseconds.
- ~24,000 QPS average; peak QPS = QPS x 2 = ~48,000.
- The trie is rebuilt weekly; the Trie Cache takes a weekly snapshot of the DB.
- 10 million DAU, 10 searches per user per day, 20 bytes per query, 0.4 GB of new data per day.
