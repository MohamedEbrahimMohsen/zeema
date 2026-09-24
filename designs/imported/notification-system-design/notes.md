# Notification System Design: import notes

The iOS lane of a notification system. Services call notification servers with auth and rate
limiting, which read user and device data from a cache and database and queue pushes; workers
send them through APNs with templates, retries and a log, and analytics tracks events.

- Source: diagram pasted inline in chat on 2026-09-08, transcribed to
  `source/notification-system-design.md`. The original PNG was not saved by the client; add it
  as `source/notification-system-design.png` when available.
- Format: image. Counts: 13 boxes, 2 boundaries, 13 arrows; the design has 13 nodes, 2 groups,
  13 edges. `check_fidelity.py` passes.

## Mapping

| Source text | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Service N | service-n | container-service | app-server | close |
| Notification servers | notification-servers | container-service | app-server | close |
| Authentication | authentication | container-service | app-server | close |
| Rate limit | rate-limit | in-process-limiter | rate-limiter | close |
| Analytics service | analytics-service | container-service | app-server | close |
| iOS PN | ios-pn | message-queue | queue | assumed |
| Workers | workers | container-worker | worker | close |
| APNs | apns | apns | third-party-api | exact |
| iOS | ios | mobile-app (os: ios) | client | close |
| CACHE | cache | cache-cluster | cache | assumed |
| DB | db | relational-database | sql-database | assumed |
| Notification template | notification-template | relational-database | sql-database | assumed |
| Notification log | notification-log | relational-database | nosql-database | assumed |

Groups: the two dashed boundaries have no text; both are `system` groups
(`notification-server-tier` holding Notification servers, Authentication and Rate limit;
`worker-tier` holding Workers).

## Assumptions

- No product is named for the queue, cache or the three stores. The catalogue has no
  engine-less component for those kinds, so common products were chosen and marked
  `assumed`. Swap them in the YAML if the real products are known.
- Authentication and Rate limit are drawn as boxes inside the notification server tier and
  are kept as nodes; no product is named, so a generic service and an in-process limiter.
- Arrows into the Analytics service (send pending, sent, click tracking) are event reports;
  modelled `async` without a delivery guarantee because the picture states none.
- Queue edges use RabbitMQ's default delivery (at-least-once). The APNs push to the device is
  at-most-once, which is what APNs does.
- Arrow directions are as drawn; CACHE -> DB is the cache-aside read path.
- No `requirements` block: the picture states no SLA, latency or region.

## Observations (not encoded, the source does not show them)

- No dead-letter queue on iOS PN; the retry loop goes back into the same queue.
- No Android path (FCM) in this variant of the diagram.

## Gaps

- No engine-less generic component for cache, queue or database (recorded in
  `docs/schema-gaps.md`).
- Sync/async of analytics event arrows is not expressible as "unknown"; a mode is required.

## Rules fired

| Rule | Severity | Subject |
|---|---|---|
| queue-missing-dlq | error | ios-pn |
| datastore-missing-backup | error | db, notification-template |
| cache-missing-eviction-policy | warning | cache |
| credentials-without-rotation | warning | design |

Components added: none. Kinds added: none.

## Relationship to designs/imported/notification-system

The picture imported here is the iOS lane only. Chapter 10 of "System Design Interview: An
Insider's Guide" by Alex Xu presents the same architecture with all four channels (iOS push,
Android push, SMS, email) and is imported separately as `designs/imported/notification-system`.
The two are kept apart because they are different sources and different pictures; this one is
what the user drew, that one is what the book draws.

## Consolidation pass, 2026-09-08

The parent session re-mapped this design after the import wave, when generic components were
added to the catalogue for boxes that name no product. Mappings that had to guess a vendor
(and any single-box dashed border that had been read as a boundary) were corrected; the
picture itself is unchanged. `mapping.yaml` holds the current component for every box.
