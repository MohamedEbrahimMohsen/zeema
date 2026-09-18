# Source: "Design a notification system", Figures 10-10 and 10-14

## Citation

- Book: *System Design Interview – An Insider's Guide*, by Alex Xu.
- Chapter 10: "Design a notification system", pages 151–165.
- Figures imported: **Figure 10-10** (page 158), "the improved high-level design", and
  **Figure 10-14** (page 163), "the updated notification system design".
- The book is copyrighted. Nothing of it is reproduced here beyond the box, boundary and arrow
  labels, which are the facts the fidelity check needs.

## Why two figures

The chapter arrives at its final architecture in two complementary drawings of one system.
Figure 10-10 draws all four channels end to end (iOS push, Android push, SMS, email), each with
its own queue, its own worker pool and its own third-party service. Figure 10-14 is the same
system after the deep dive, but drawn for the iOS lane only, so that the components added in the
deep dive stay readable: authentication and rate limiting inside the notification server tier,
the analytics service, the notification template store and the notification log. The chapter
introduces Figure 10-14 as "the updated notification system design" and then lists what is new
"in comparison with the previous design", which is Figure 10-10. The union of the two figures is
therefore one picture; every box below is counted once.

Boxes that appear in both figures: `Service N`, `Notification servers`, `CACHE`, `DB`, `iOS PN`,
`Workers` (the iOS lane), `APNs`, `iOS`. Arrows that appear in both: `Service N -> Notification
servers`, `Notification servers -> CACHE`, `CACHE -> DB`, `Notification servers -> iOS PN`,
`iOS PN -> Workers`, `Workers -> iOS PN` (`retry on error`), `Workers -> APNs`, `APNs -> iOS`.

## Boxes as drawn

| # | Label as drawn | Drawn as | Inside | Figure |
|---|---|---|---|---|
| 1 | `Service 1` | rounded box, black border | — | 10-10 |
| 2 | `Service 2` | rounded box, black border | — | 10-10 |
| 3 | `Service N` | rounded box, black border | — | 10-10, 10-14 |
| 4 | `Notification servers` | stack of three green server glyphs | the unlabelled dashed box | 10-10, 10-14 |
| 5 | `Authentication` | plain rectangle, upper half of the dashed box | the unlabelled dashed box | 10-14 |
| 6 | `Rate limit` | plain rectangle, lower half of the dashed box | the unlabelled dashed box | 10-14 |
| 7 | `Analytics service` | rounded box, black border, top centre | — | 10-14 |
| 8 | `CACHE` | cyan container holding three stacked tiles each reading `CACHE` | — | 10-10, 10-14 |
| 9 | `DB` | cyan container holding three cylinders; in 10-14 a note inside the same container reads `device setting user info` | — | 10-10, 10-14 |
| 10 | `iOS PN` | queue glyph, three envelopes in a chevron | — | 10-10, 10-14 |
| 11 | `Android PN` | queue glyph, three envelopes in a chevron | — | 10-10 |
| 12 | `SMS queue` | queue glyph, three envelopes in a chevron | — | 10-10 |
| 13 | `Email queue` | queue glyph, three envelopes in a chevron | — | 10-10 |
| 14 | `Workers` | stack of three green server glyphs in its own dashed box, iOS lane | its own unlabelled dashed box | 10-10, 10-14 |
| 15 | `Workers` | stack of three green server glyphs in its own dashed box, Android lane | its own unlabelled dashed box | 10-10 |
| 16 | `Workers` | stack of three green server glyphs in its own dashed box, SMS lane | its own unlabelled dashed box | 10-10 |
| 17 | `Workers` | stack of three green server glyphs in its own dashed box, email lane | its own unlabelled dashed box | 10-10 |
| 18 | `APNs` | cloud glyph | `Third Party Services` in 10-10; outside any boundary in 10-14 | 10-10, 10-14 |
| 19 | `FCM` | Firebase flame glyph | `Third Party Services` | 10-10 |
| 20 | `SMS Service` | speech-bubble glyph | `Third Party Services` | 10-10 |
| 21 | `Email Service` | mail-server glyph | `Third Party Services` | 10-10 |
| 22 | `iOS` | phone glyph | — | 10-10, 10-14 |
| 23 | `Android` | phone glyph | — | 10-10 |
| 24 | `SMS` | phone glyph | — | 10-10 |
| 25 | `Email` | laptop glyph | — | 10-10 |
| 26 | `Notification template` | cyan container, no inner glyph | — | 10-14 |
| 27 | `Notification log` | cyan container holding three cylinders | — | 10-14 |

## Boundaries as drawn

| # | Label as drawn | Style | Contains | Figure |
|---|---|---|---|---|
| A | (none) | dashed cyan rounded rectangle | `Notification servers` in 10-10; `Notification servers`, `Authentication`, `Rate limit` in 10-14 | 10-10, 10-14 |
| B | (none) | dashed cyan rounded rectangle | `Workers`, iOS lane | 10-10, 10-14 |
| C | (none) | dashed cyan rounded rectangle | `Workers`, Android lane | 10-10 |
| D | (none) | dashed cyan rounded rectangle | `Workers`, SMS lane | 10-10 |
| E | (none) | dashed cyan rounded rectangle | `Workers`, email lane | 10-10 |
| F | `Third Party Services` | dotted black rounded rectangle | `APNs`, `FCM`, `SMS Service`, `Email Service` | 10-10 |

## Arrows as drawn

| # | From (as drawn) | To (as drawn) | Arrow label | Figure |
|---|---|---|---|---|
| 1 | `Service 1` | `Notification servers` | — | 10-10 |
| 2 | `Service 2` | `Notification servers` | — | 10-10 |
| 3 | `Service N` | `Notification servers` | — | 10-10, 10-14 |
| 4 | `Notification servers` | `Analytics service` | `send pending` | 10-14 |
| 5 | `Notification servers` | `CACHE` | — | 10-10, 10-14 |
| 6 | `CACHE` | `DB` | — | 10-10, 10-14 |
| 7 | `Notification servers` | `iOS PN` | — | 10-10, 10-14 |
| 8 | `Notification servers` | `Android PN` | — | 10-10 |
| 9 | `Notification servers` | `SMS queue` | — | 10-10 |
| 10 | `Notification servers` | `Email queue` | — | 10-10 |
| 11 | `iOS PN` | `Workers` (iOS lane) | — | 10-10, 10-14 |
| 12 | `Android PN` | `Workers` (Android lane) | — | 10-10 |
| 13 | `SMS queue` | `Workers` (SMS lane) | — | 10-10 |
| 14 | `Email queue` | `Workers` (email lane) | — | 10-10 |
| 15 | `Workers` (iOS lane) | `iOS PN` | `retry on error` | 10-10, 10-14 |
| 16 | `Workers` (iOS lane) | `APNs` | — | 10-10, 10-14 |
| 17 | `Workers` (Android lane) | `FCM` | — | 10-10 |
| 18 | `Workers` (SMS lane) | `SMS Service` | — | 10-10 |
| 19 | `Workers` (email lane) | `Email Service` | — | 10-10 |
| 20 | `Workers` (iOS lane) | `Analytics service` | `sent` | 10-14 |
| 21 | `Workers` (iOS lane) | `Notification template` | — | 10-14 |
| 22 | `Workers` (iOS lane) | `Notification log` | — | 10-14 |
| 23 | `APNs` | `iOS` | — | 10-10, 10-14 |
| 24 | `FCM` | `Android` | — | 10-10 |
| 25 | `SMS Service` | `SMS` | — | 10-10 |
| 26 | `Email Service` | `Email` | — | 10-10 |
| 27 | `iOS` | `Analytics service` | `click tracking` | 10-14 |

All twenty-seven arrows are single-headed, and every arrow that appears in both figures is drawn
in the same direction in both.

Not boxes: the vertical ellipsis between `Service 2` and `Service N` in Figure 10-10; the
circled step numbers `1`–`6` in Figure 10-10, which key the numbered walk-through in the running
text; the note `device setting user info` drawn inside the `DB` container in Figure 10-14; the
figure captions.

## Facts the chapter states about these figures

- Figure 10-10 is reached by moving the database and the cache out of the notification server,
  adding more notification servers with automatic horizontal scaling, and introducing message
  queues to decouple the components.
- "Each notification type is assigned with a distinct message queue so an outage in one
  third-party service will not affect other notification types."
- Workers pull notification events from the queues and send them to the third-party services.
- The notification log database is added for data persistence, so that notifications may be
  delayed or re-ordered but never lost. Figure 10-11 draws that addition on the iOS lane alone
  (`iOS PN -> Workers -> APNs`, plus `Workers -> Notification log`); Figure 10-14 keeps it.
- Delivery is not exactly-once; a dedupe check on the event ID reduces duplicates.
- On retry: a notification that a third-party service fails to send is put back on the message
  queue, and an alert goes to developers if the problem persists.
- Figure 10-14 adds, in the chapter's words, authentication and rate-limiting on the
  notification servers, the retry mechanism, notification templates, and monitoring and tracking.
- Volumes, from the requirements section: 10 million mobile push notifications, 1 million SMS
  messages and 5 million emails per day. The system is "soft real-time": a slight delay under
  high load is acceptable.
- No SLA figure, no latency target, no region count and no replay requirement appears anywhere
  in the chapter.
- The third-party services are named only in the running text (Twilio and Nexmo for SMS,
  SendGrid and Mailchimp for email); the boxes in Figure 10-10 read `SMS Service` and
  `Email Service`, with no vendor.
