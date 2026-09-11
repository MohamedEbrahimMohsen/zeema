# Intake card template

One card per reference system. Copy this file to `docs/intake/<system-id>.md` and fill
every section. Write "not stated" rather than guessing. The card is the raw material for
`designs/reference/<system-id>/design.yaml`, for new kinds, and for new rules. Capture everything the
source says; decide nothing here.

```markdown
# Intake: <System name>

## Source
- Primary: <URL or book + chapter>
- Secondary: <URL(s)>
- Verified by: official engineering blog | conference talk | book | company docs | reputable secondary (name it)
- Confidence: high | medium | low
- Date of source: <year>

## System in three lines
<What it does, who uses it, what makes it hard.>

## Scale (only if stated)
- Users / DAU:
- Requests per second:
- Data volume:
- Message throughput:

## Requirements stated or clearly implied
- Availability target (SLA / regions / must survive region loss):
- Consistency (strong / eventual / per-entity):
- Latency target (p50 / p95 / p99 and for which path):
- Ordering needs (global / per-key / none):
- Replay or reprocessing needs:
- Retention (data / messages / logs):
- Compliance / residency (PCI, GDPR, region pinning):

## Boundaries
- Regions / zones mentioned:
- Trust zones (public edge, internal, restricted):
- Named subsystems / bounded contexts:

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated (partitions, TTL, replication, DLQ, sharding key, eviction...) |
|---|---|---|---|---|---|
| 1 | | | | | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes (fan-out, batch, retry, idempotency) |
|---|---|---|---|---|---|
| | | | | | |

## Failure modes, incidents, tradeoffs the source discusses
- <Each one becomes a candidate rule. Quote the shortest decisive sentence.>

## Unknowns
- <Things the source leaves unclear. Do not fill with guesses.>

## Candidates
- New kinds:
- New properties on existing kinds:
- New requirement paths:
- New rules (name + one-line condition):
```

Rules for filling:

- One row per box in the source diagram or text, even if the same product appears
  twice in different roles.
- `Candidate kind`: use an existing id from `kinds/` when one fits. Otherwise propose a
  kebab-case id and mark it `(new)`.
- `Real product`: only if the source names it. Never infer "probably Kafka".
- Every edge needs a direction. Bidirectional = two rows.
- Failure modes are the most valuable section. A source with none is a weak source.
