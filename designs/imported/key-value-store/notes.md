# Design A Key-Value Store: import notes

- Source: *System Design Interview - An Insider's Guide* (Volume 1), Alex Xu, chapter 6
  "Design A Key-Value Store", pages 87-109. Figure used: **Figure 6-17**, the chapter's
  "system architecture diagram" (page 104).
- The book is copyrighted. Nothing from it is stored here except the factual transcription in
  `source/key-value-store.md`: the box labels, the boundary and the arrows as drawn, plus the
  numbers the chapter states.
- Format: `book-figure`. Counts: 9 boxes, 1 boundary, 8 arrows; the design has 9 nodes,
  1 group, 8 edges. `check_fidelity.py` passes with 0 warnings.

## Mapping

| Source text | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Client | client | sdk-client | client | close |
| n6 | n6 | nosql-store | nosql-database | close |
| n0 | n0 | nosql-store | nosql-database | close |
| n1 | n1 | nosql-store | nosql-database | close |
| n2 | n2 | nosql-store | nosql-database | close |
| n3 | n3 | nosql-store | nosql-database | close |
| n4 | n4 | nosql-store | nosql-database | close |
| n5 | n5 | nosql-store | nosql-database | close |
| n7 | n7 | nosql-store | nosql-database | close |

Group: the thick grey circle carrying n0-n7 is the consistent-hash ring. It has no text, so
`hash-ring` is a `system` group with no label. The Client is drawn outside it.

Nothing is `assumed`: every box is a generic box mapped to the generic component of its kind.

## Decisions

- **n6 is a store node, not a proxy tier.** The circle is drawn exactly like n0-n7 and the
  word "coordinator" is printed under it, not inside it. The chapter's own bullet list says
  the system is completely decentralised and "every node has the same set of
  responsibilities", so the coordinator is whichever ring node the client happened to reach.
  Mapping it to `container-service` or a proxy component would have invented a tier the
  figure does not draw. "coordinator" is listed in `ignored` as an annotation of n6.
- **No product.** The chapter says the design is based on Dynamo, Cassandra and BigTable, but
  the figure draws unbranded circles and the chapter never says "our store is Cassandra".
  All ring nodes are therefore `nosql-store` (`confidence: close`), not `cassandra` or
  `dynamodb`.
- **The eight edges are the eight arrows.** Four solid request arrows and four dashed reply
  arrows. Both directions are kept because both are drawn; see gaps.
- **`protocol: "kv"`** for every edge: the chapter names the API (`get(key)`,
  `put(key, value)`) but no wire protocol. `mode: "sync"` everywhere: the coordinator waits
  for W (or R) acknowledgements before answering the client.
- **Props on the ring nodes** come from the "System components" section (pages 93-103), which
  Figure 6-17 is the closing summary of - "system architecture diagram" is the sixth bullet of
  that section's own list. Each prop is a number or a choice the chapter states:
  `model: key-value` (the subject of the chapter), `consistency: tunable` (design scope,
  page 88), `replicationFactor: 3` and `quorumWrites: 2` / `quorumReads: 2` (the typical
  configuration N = 3, W = R = 2, page 96), `conflictResolution: vector-clock` (pages 97-99),
  `replication: leaderless` (replicas in distinct data centres, page 94).
  They are repeated on all nine nodes because the nine nodes are one cluster; see gaps.
- **Requirements** are the promises the chapter makes, all with a stated number or a stated
  commitment: `availability.multiRegion` ("replicate data across multiple data centers",
  page 103), `availability.degradedModeAllowed` (sloppy quorum and hinted handoff, page 101),
  `availability.discoveryRedundant` ("completely decentralized", "no single point of failure",
  page 104), `consistency.model: ap` (eventual consistency is the recommended model, page 96),
  `durability.minReplicasAcked: 2` (W = 2, page 96). No latency requirement: the chapter says
  "low latency" but states no figure.

## Figures deliberately not merged

The chapter continues past Figure 6-17 with four more pictures. None of them is a peer of
Figure 6-17 and none was merged in:

- **Figure 6-18** (page 105) draws one circle captioned "node" holding "Client API",
  "Conflict resolution", "Replication", "Failure detection", "Failure repair mechanism" and
  "Storage engine". These are the responsibilities *inside* one ring node.
- **Figure 6-19** (page 105, write path) and **Figures 6-20 / 6-21** (pages 106-107, read
  path) draw a "Server" boundary split into "MEMORY" and "DISK" bands holding "Commit log",
  "Memory cache", "SSTables", "Bloom filter" and "Result data". The chapter introduces them
  as what happens "after a write request is directed to a specific node" and "after a read
  request is directed to a specific node".

Commit log, memory cache, SSTable and bloom filter are therefore the **storage engine of one
of the nodes n0-n7**, not separate placeable nodes of the architecture. Adding them as nodes
would have produced a picture the book never draws: a ring whose members are peers of their
own internal parts, with the memory cache and the SSTables sitting beside n3 and n4. The
union rule in the import brief covers a chapter that reaches its final design as two
complementary flows of *one* architecture (a write path and a read path across the same
boxes); here the write and read paths are a zoom into a single box of the architecture, one
level down, so the union does not apply.

The format has no way to express node-internal structure, so this is recorded as a gap rather
than encoded: there is no "parts" list on a node, no `storageEngine` sub-structure, and a
group cannot hold the inside of a node because a node is not a container. The one thing the
catalogue can say about it - `nosql-store` is an LSM-style store with a commit log and
SSTables - is a property of the product, not of the design.

## Gaps

Recorded in `mapping.yaml` under `gaps` (six entries):

1. No group kind for a consistent-hash ring, or for a cluster of peer nodes generally;
   mapped to `system`.
2. No way to say n0-n7 are members of one clustered store rather than nine independent
   stores; cluster-level props had to be repeated on every node.
3. No way to mark an edge as the response to another edge; the design shows eight edges
   where the picture shows four request/response pairs.
4. **No way to express node-internal structure** (Figures 6-18 to 6-21: client API, conflict
   resolution, replication, failure detection, storage engine; commit log, memory cache,
   SSTable, bloom filter). This is the main thing the chapter says that the design cannot
   carry.
5. The `nosql-database` `replication` enum has no leaderless value; Dynamo-style quorum
   replication was recorded as `leaderless`.
6. No property records the failure-detection or anti-entropy mechanism (gossip, hinted
   handoff, sloppy quorum, Merkle trees).

These are listed here and in `mapping.yaml` only. `docs/schema-gaps.md` is shared and owned by
the parent session; the entries above still need to be added there.

## Rules fired

| Rule | Severity | Subject |
|---|---|---|
| credentials-without-rotation | warning | design |

`validate.mjs --design` reports `all checks passed` with that one warning. The design was not
changed to silence it: the figure shows no key-management node and the chapter states no
credential rotation period.

## Observations (not encoded, the figure does not show them)

- The ring in Figure 6-17 has eight positions and no virtual nodes, although the chapter's
  data-partition section (page 94) says virtual node counts are proportional to server
  capacity.
- The figure shows one coordinator and three replicas because N = 3; there is no arrow
  between the ring nodes themselves, so the gossip membership traffic the chapter describes
  is not drawn.
- No data-centre boundaries are drawn even though the chapter requires replicas in distinct
  data centres; that promise lives in `requirements.availability.multiRegion` only.

Components added: none. Kinds added: none.

## Consolidation pass, 2026-09-08

The parent session re-mapped this design after the import wave, when generic components were
added to the catalogue for boxes that name no product. Mappings that had to guess a vendor
(and any single-box dashed border that had been read as a boundary) were corrected; the
picture itself is unchanged. `mapping.yaml` holds the current component for every box.
