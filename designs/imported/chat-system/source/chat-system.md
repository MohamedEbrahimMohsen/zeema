# Design A Chat System (source transcription)

## Citation

- Book: *System Design Interview - An Insider's Guide* (Volume 1), Alex Xu.
- Chapter 12: "Design A Chat System", pages 178-199.
- Figure used: **Figure 12-8**, the adjusted high-level design (page 186). The chapter
  introduces it with "Putting everything we mentioned together, Figure 12-8 shows the adjusted
  high-level design", and the paragraph after it names the role of every box.
- The book is copyrighted. Neither the PDF, its pages, its images nor its prose are stored in
  this repository. What follows is a factual transcription of the figure: the box labels as
  drawn, the boundaries and the arrows. Box labels are facts and the fidelity check needs them.

The chapter's later figures (12-11 service discovery, 12-12 one-on-one message flow, 12-13
multi-device sync, 12-14 and 12-15 group chat flow, 12-16 to 12-18 presence, 12-19 status
fanout) are step-numbered sequences drawn over the same system, each showing only the few
boxes that participate in that step plus boxes the high-level design does not draw at all
(ID generator, Message sync queue, Service discovery (Zookeeper), PN servers, per-user Chat
server 1 / 2 instances). They are not merged into this design; what they say about a box that
is drawn in Figure 12-8 is recorded in `notes.md`.

## Figure 12-8 - adjusted high-level design (page 186)

Boxes, top to bottom, left to right:

| # | Text as drawn | Drawn as |
|---|---|---|
| 1 | User | rounded box, top centre, holding a laptop icon and a phone icon |
| 2 | Load balancer | blue trapezoid icon with a four-way arrow, caption to the left of the icon |
| 3 | Chat servers | three purple server icons in a rounded box, caption inside, upper right |
| 4 | Presence servers | three purple server icons in a rounded box, caption inside, upper right |
| 5 | Notification servers | three green server icons in a rounded box, caption inside, left |
| 6 | API servers | three green server icons in a rounded box, caption inside, centre |
| 7 | KV store | three blue cylinders in a rounded box, caption inside, bottom left |
| 8 | KV store | three blue cylinders in a rounded box, caption inside, bottom centre |
| 9 | KV store | three blue cylinders in a rounded box, caption inside, bottom right |

Boxes 7, 8 and 9 are three separate rounded boxes carrying the same caption.

## Boundaries

| # | Text as drawn | Contains |
|---|---|---|
| A | Real time service | Chat servers, Presence servers |
| B | (none, dashed rounded box) | the three KV store boxes |

## Arrows

Ten lines are drawn. Three of them carry an arrowhead at each end.

| # | From | To | Label | Heads |
|---|---|---|---|---|
| 1 | User | Load balancer | http | one, at Load balancer |
| 2 | User | Real time service (boundary, top edge between Chat servers and Presence servers) | ws | two, one at the boundary and one at User |
| 3 | Load balancer | API servers | | one, at API servers |
| 4 | API servers | Notification servers | | one, at Notification servers |
| 5 | API servers | Real time service (boundary, bottom edge under Chat servers) | | two, one at the boundary and one at API servers |
| 6 | API servers | Real time service (boundary, bottom edge under Presence servers) | | two, one at the boundary and one at API servers |
| 7 | Real time service (boundary, bottom edge under Chat servers) | boundary B | | one, at boundary B |
| 8 | Real time service (boundary, bottom edge under Presence servers) | boundary B | | one, at boundary B |
| 9 | Notification servers | boundary B | | one, at boundary B |
| 10 | API servers | boundary B | | one, at boundary B |

Where a line ends on a boundary rather than on a box, this is where it ends, measured on the
image: arrows 5 and 7 leave the Real time service boundary directly under the Chat servers box
(x within the Chat servers box), arrows 6 and 8 directly under the Presence servers box, and
arrow 2 lands on the top edge of the boundary in the gap between the two boxes. The four
arrowheads on boundary B (arrows 7, 8, 9, 10) land on its top edge spread evenly across it and
not above any particular KV store box.

Counts, each drawn box counted once and each arrowhead counted as one directed edge:
9 boxes, 2 boundaries, 13 directed edges over 10 drawn lines.

## Numbers and promises the chapter states

- 50 million daily active users; a group is capped at 100 members; text messages only, under
  100,000 characters; chat history is stored forever.
- Scalability paragraph: at 1M concurrent connections and roughly 10K of memory per
  connection, about 10GB of memory would hold all connections on one box; the single point of
  failure makes a one-server design unacceptable.
- Storage section: "The read to write ratio is about 1:1 for 1 on 1 chat apps."
- Storage section: 60 billion messages a day are processed by Facebook messenger and WhatsApp
  (a cited third-party figure, not a target for this design).
- Deep dive: the client sends a heartbeat every 5 seconds and is considered offline after
  x = 30 seconds without one (the chapter says 30 is arbitrarily chosen).
