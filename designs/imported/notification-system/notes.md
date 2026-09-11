# Notification system: import notes

- Source: chapter 10, "Design a notification system", pages 151-165, of *System Design Interview
  - An Insider's Guide* by Alex Xu. The book is copyrighted and is not in this repository;
  `source/notification-system.md` is a citation plus my own factual transcription of the box,
  boundary and arrow labels, which is what the fidelity check needs.
- Format: `book-figure`. Figures imported: **10-10** (page 158) and **10-14** (page 163).
- Counts: 27 boxes, 6 boundaries, 27 arrows; the design has 27 nodes, 6 groups, 27 edges.
  `check_fidelity.py` passes with no warnings (no `assumed` mapping in this design).

## Why two figures are one design

The chapter reaches its final architecture as two complementary drawings of the same system:

- **Figure 10-10**, "the improved high-level design", draws all four channels end to end: four
  queues (`iOS PN`, `Android PN`, `SMS queue`, `Email queue`), a worker pool per queue, and the
  `Third Party Services` boundary holding `APNs`, `FCM`, `SMS Service` and `Email Service`, each
  delivering to its device.
- **Figure 10-14**, "the updated notification system design", is the same system after the deep
  dive but drawn for the **iOS lane only**, so that the new parts stay readable: `Authentication`
  and `Rate limit` inside the notification server tier, the `Analytics service` with its three
  event arrows, `Notification template` and `Notification log`. The chapter's own text under the
  figure lists what is new "in comparison with the previous design", which is Figure 10-10.

Neither figure alone is the design the chapter arrives at, so the import is the union, as the
import brief allows for a chapter whose final design is two complementary flows. Eight boxes and
eight arrows appear in both figures and are counted once; `source/notification-system.md` lists
which figure each box, boundary and arrow comes from.

## Relationship to `designs/imported/notification-system-design/`

That folder is a **different import from a different source**: a picture the user pasted in chat
on 2026-09-08 showing only the iOS lane. It happens to be the same drawing as Figure 10-14 of
this chapter, so its 13 boxes and 13 arrows are a subset of this design. Nothing was copied from
it beyond file style, and it was not edited. The two differ in more than scope: that import had
no chapter text to read, so it mapped the unbranded boxes to concrete products (`rabbitmq`,
`redis`, `postgres`, `cassandra`) with `confidence: assumed`; this one uses the `default`
generics, because the book names no product for any of them.

## Mapping

| Source text | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Service 1 | service-1 | container-service | app-server | close |
| Service 2 | service-2 | container-service | app-server | close |
| Service N | service-n | container-service | app-server | close |
| Notification servers | notification-servers | container-service | app-server | close |
| Authentication | authentication | container-service | app-server | close |
| Rate limit | rate-limit | in-process-limiter | rate-limiter | close |
| Analytics service | analytics-service | container-service | app-server | close |
| CACHE | cache | cache-cluster | cache | close |
| DB | db | relational-database | sql-database | close |
| iOS PN | ios-pn | message-queue | queue | close |
| Android PN | android-pn | message-queue | queue | close |
| SMS queue | sms-queue | message-queue | queue | close |
| Email queue | email-queue | message-queue | queue | close |
| Workers (iOS lane) | ios-workers | container-worker | worker | close |
| Workers (Android lane) | android-workers | container-worker | worker | close |
| Workers (SMS lane) | sms-workers | container-worker | worker | close |
| Workers (email lane) | email-workers | container-worker | worker | close |
| APNs | apns | apns | third-party-api | exact |
| FCM | fcm | fcm (gcp) | third-party-api | exact |
| SMS Service | sms-service | supplier-api | third-party-api | close |
| Email Service | email-service | supplier-api | third-party-api | close |
| iOS | ios | mobile-app (os: ios) | client | close |
| Android | android | mobile-app (os: android) | client | close |
| SMS | sms | mobile-app | client | close |
| Email | email | desktop-app | client | close |
| Notification template | notification-template | relational-database | sql-database | close |
| Notification log | notification-log | relational-database | sql-database | close |

Groups: five dashed boundaries carry no text and are `system` groups
(`notification-server-tier` holding Notification servers, Authentication and Rate limit; one
worker tier per channel). The sixth, `Third Party Services`, is a `trust-zone`: services outside
our control.

Four nodes share the label `Workers`, exactly as the figure draws four identical worker boxes.
Ids are per lane (`ios-workers`, `android-workers`, `sms-workers`, `email-workers`); the labels
stay verbatim.

## Assumptions

- The book draws unbranded boxes. Every generic box is a `default` generic component
  (`container-service`, `container-worker`, `message-queue`, `cache-cluster`,
  `relational-database`, `in-process-limiter`, `mobile-app`, `desktop-app`); no vendor is
  inferred anywhere. Only `APNs` and `FCM` are named products, and they are `exact`.
- `SMS Service` and `Email Service` are drawn unbranded, so they map to `supplier-api`, the
  generic external API. The chapter names Twilio, Nexmo, SendGrid and Mailchimp in the running
  text only; putting one of them in the design would be adding a fact the figure does not show.
- `Notification log` and `Notification template` are drawn as cyan store containers like `DB`
  and are read and written by the workers. The chapter calls the log "the notification log
  database" and never names an engine, so both are `relational-database`, not `nosql-store`.
- `Authentication` and `Rate limit` are drawn as boxes inside the notification server tier and
  are kept as nodes; `Rate limit` sits in-process with the servers, hence `in-process-limiter`.
- `SMS` is the phone that receives the text message; `mobile-app` with `os` left at its default,
  because the figure does not say which handset. `Email` is a laptop glyph, so `desktop-app`;
  the chapter's supported devices are "iOS devices, android devices, and laptop/desktop".
- Arrows into the `Analytics service` (send pending, sent, click tracking) are event reports;
  modelled `async` without a delivery guarantee, because the figures state none.
- Queue edges use the generic queue's default delivery (at-least-once). The pushes from APNs,
  FCM, the SMS service and the email service to the devices are `at-most-once`, which is what
  those channels do.
- The deep-dive additions of Figure 10-14 (analytics events, notification template, notification
  log) hang off `ios-workers`, because that is the lane the figure draws. The chapter's prose
  implies they apply to every channel, but the figure does not draw them there, so they are not
  duplicated onto the other three worker pools.
- No `requirements` block. The chapter states no SLA, no latency target, no region count, no
  replay promise. Its only numbers are daily volumes (10 million push notifications, 1 million
  SMS, 5 million emails), which no requirement path can hold; see gaps.

## Observations (not encoded, the figures do not show them)

- No dead-letter queue on any of the four queues; the retry loop goes back into the same queue,
  and the chapter says an alert is sent to developers if the problem persists. The alerting path
  is not drawn.
- The `retry on error` loop is drawn on the iOS lane only in both figures, although the text
  describes retrying as the general mechanism.
- `Monitor queued notifications` (Figure 10-12) is a screenshot of a queue-depth chart, not an
  architecture box, so no monitoring node exists in either figure even though the chapter's
  closing list says "monitoring and tracking systems are added".
- The contact-info gathering flow (Figures 10-7 and 10-8, API servers writing the user and
  device tables) is a separate, earlier drawing and is not part of the final design.

## Gaps

1. The chapter states daily volumes (10M push, 1M SMS, 5M email) but `requirements` has no
   throughput or daily-volume path; the numbers live in this file only.
2. The chapter promises notifications are never lost though they may be delayed or re-ordered.
   `requirements` has no "no message loss" path: `durability.*` is about stored objects and
   `messaging.replay` is a different promise.
3. The chapter is explicit that delivery is *not* exactly-once and that a dedupe check on the
   event ID reduces duplicates. A requirement can say exactly-once is required, not that it is
   deliberately not required, and per-event-id dedupe has no place on a node or an edge.
4. Figure 10-14 draws the deep-dive additions on the iOS lane only; the format cannot say "this
   applies to the other three lanes too", so they are encoded exactly as drawn.
5. `mapping.yaml` has no field recording which figure a box, boundary or arrow came from; that
   is carried in `source/notification-system.md` instead.

Gaps 1-3 and 5 are not written to `docs/schema-gaps.md` from this task: the import brief reserves
that shared file for the parent session.

## Rules fired

`node .claude/tools/validate.mjs --design designs/imported/notification-system/design.yaml`
reports 9 findings and ends with `all checks passed`. Nothing in the design was changed to
silence them; they are what the chapter's picture actually leaves open.

| Rule | Severity | Subject |
|---|---|---|
| queue-missing-dlq | error | ios-pn |
| queue-missing-dlq | error | android-pn |
| queue-missing-dlq | error | sms-queue |
| queue-missing-dlq | error | email-queue |
| datastore-missing-backup | error | db |
| datastore-missing-backup | error | notification-template |
| datastore-missing-backup | error | notification-log |
| cache-missing-eviction-policy | warning | cache |
| credentials-without-rotation | warning | design |

The four `queue-missing-dlq` errors are the sharpest finding: the chapter's own reliability
section requires that notifications are never lost and routes failures back onto the same queue,
which is exactly the retry loop that needs a dead-letter queue and does not have one in the
figure.

Components added: none. Kinds added: none.
