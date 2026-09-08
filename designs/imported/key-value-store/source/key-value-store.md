# Design A Key-Value Store (source transcription)

## Citation

- Book: *System Design Interview - An Insider's Guide* (Volume 1), Alex Xu.
- Chapter 6: "Design A Key-Value Store", pages 87-109.
- Figure used: **Figure 6-17**, the chapter's "system architecture diagram" (page 104).
- The book is copyrighted. Neither the PDF, its pages, its images nor its prose are stored in
  this repository. What follows is a factual transcription of the figure: the box labels as
  drawn, the boundary and the arrows. Box labels are facts and the fidelity check needs them.

Figure 6-17 is the only architecture picture of the chapter. Figures 6-18 (the task list
inside one node), 6-19 (write path) and 6-20 / 6-21 (read path) draw the inside of a single
storage node, not additional placeable elements; they are not merged into this design. See
`notes.md`.

## Figure 6-17 - system architecture diagram (page 104)

Boxes, as drawn:

| # | Text as drawn | Drawn as |
|---|---|---|
| 1 | Client | white rounded rectangle, far left, outside the ring |
| 2 | n6 | white circle on the ring, left side; the word "coordinator" is printed under it |
| 3 | n0 | filled blue circle on the ring, top |
| 4 | n1 | filled blue circle on the ring, upper right |
| 5 | n2 | filled blue circle on the ring, right |
| 6 | n3 | white circle on the ring, lower right |
| 7 | n4 | white circle on the ring, bottom |
| 8 | n5 | white circle on the ring, lower left |
| 9 | n7 | white circle on the ring, upper left |

The three filled blue circles (n0, n1, n2) are the replicas the coordinator is talking to in
this illustration; they are drawn as the same kind of circle as n3, n4, n5, n7, only shaded.

Boundaries:

| # | Text as drawn | Drawn as |
|---|---|---|
| 1 | (no text) | thick grey circle; the eight circles n0-n7 sit on it, the Client is outside it |

Arrows:

| # | From | To | Line | Label |
|---|---|---|---|---|
| 1 | Client | n6 | solid, arrowhead at n6 | read/write |
| 2 | n6 | Client | dashed, arrowhead at Client | response |
| 3 | n6 | n0 | solid, arrowhead at n0 | |
| 4 | n0 | n6 | dashed, arrowhead at n6 | |
| 5 | n6 | n1 | solid, arrowhead at n1 | |
| 6 | n1 | n6 | dashed, arrowhead at n6 | |
| 7 | n6 | n2 | solid, arrowhead at n2 | |
| 8 | n2 | n6 | dashed, arrowhead at n6 | |

Counts: 9 boxes, 1 boundary, 8 arrows.

Text in the figure that is not a box: "coordinator" (printed under the n6 circle, naming the
role n6 plays in this request) and the caption "Figure 6-17".

## What the chapter states about this architecture (page 104, the bullet list under the figure)

- Clients communicate with the key-value store through simple APIs: `get(key)` and
  `put(key, value)`.
- A coordinator is a node that acts as a proxy between the client and the key-value store.
- Nodes are distributed on a ring using consistent hashing.
- The system is completely decentralized so adding and moving nodes can be automatic.
- Data is replicated at multiple nodes.
- There is no single point of failure as every node has the same set of responsibilities.

## Numbers and promises the chapter states (pages 88, 94-96, 101, 103)

- Design scope (page 88): key-value pair smaller than 10 KB; store big data; high
  availability, "the system responds quickly, even during failures"; high scalability;
  automatic scaling; tunable consistency; low latency.
- Replication (page 94): data is replicated over N servers, N configurable; replicas are
  placed in distinct data centers connected through high-speed networks.
- Quorum (pages 95-96): N = number of replicas, W = write quorum, R = read quorum; the
  coordinator waits for W acknowledgements; typical configuration N = 3, W = R = 2 gives
  strong consistency because W + R > N.
- Consistency model (page 96): Dynamo and Cassandra adopt eventual consistency, "which is our
  recommended consistency model for our key-value store"; the store is an AP system.
- Inconsistency resolution (pages 97-99): versioning with vector clocks, a [server, version]
  pair per data item.
- Failure handling (pages 99-103): gossip protocol for failure detection; sloppy quorum
  (first W / R healthy servers on the ring, offline servers ignored) and hinted handoff for
  temporary failures; Merkle trees (anti-entropy) for permanent failures; replication across
  multiple data centers for a data center outage.

## Figures deliberately not imported

- **Figure 6-18** (page 105): one circle captioned "node" containing the boxes "Client API",
  "Conflict resolution", "Replication", "Failure detection", "Failure repair mechanism",
  "Storage engine" and two "..." boxes. These are the responsibilities inside one node.
- **Figure 6-19** (page 105, write path): a boundary "Server" split into bands "MEMORY" and
  "DISK", containing "Memory cache", "Commit log" and "SSTables", with a "Client" outside.
- **Figure 6-20** (page 106, read path, cache hit) and **Figure 6-21** (page 107, read path,
  cache miss): the same "Server" boundary with the bands "MEMORY" and "DISK", containing
  "Memory cache", "Result data", "SSTables" and "Bloom filter", with a "Client" outside.

Figures 6-19 to 6-21 are the storage engine of one of the ring nodes drawn open, on the
chapter's own words "what happens after a write request is directed to a specific node". They
are not peers of the ring nodes and merging them would add boxes Figure 6-17 does not show.
