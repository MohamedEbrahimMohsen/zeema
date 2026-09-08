# Notification System Design (source transcription)

The user pasted the diagram inline in chat on 2026-09-08 (PNG, not saved to disk by the
client). Drop the original image next to this file as `notification-system-design.png`
when available. This transcription records exactly what the picture shows.

## Boxes (left to right, top to bottom)

| # | Text as drawn | Drawn as |
|---|---|---|
| 1 | Analytics service | rounded box, top centre |
| 2 | Service N | rounded box, far left |
| 3 | Notification servers | three green server icons, inside a dashed box |
| 4 | Authentication | box inside the same dashed box, upper half |
| 5 | Rate limit | box inside the same dashed box, lower half |
| 6 | iOS PN | queue icon (three envelopes in a chevron), centre |
| 7 | Workers | three green server icons, inside a second dashed box |
| 8 | APNs | cloud icon |
| 9 | iOS | phone icon, far right |
| 10 | CACHE | three stacked "CACHE" tiles, below the notification servers |
| 11 | DB | three cylinders, bottom left; a note inside the same box reads "device setting / user info" |
| 12 | Notification template | rounded box, bottom centre |
| 13 | Notification log | three cylinders, bottom right |

## Boundaries

| # | Text as drawn | Contains |
|---|---|---|
| A | (none, dashed rounded box) | Notification servers, Authentication, Rate limit |
| B | (none, dashed rounded box) | Workers |

## Arrows

| # | From | To | Label |
|---|---|---|---|
| 1 | Service N | Notification servers | |
| 2 | Notification servers | Analytics service | send pending |
| 3 | Notification servers | iOS PN | |
| 4 | Notification servers | CACHE | |
| 5 | CACHE | DB | |
| 6 | iOS PN | Workers | |
| 7 | Workers | iOS PN | retry on error |
| 8 | Workers | Analytics service | sent |
| 9 | Workers | APNs | |
| 10 | APNs | iOS | |
| 11 | iOS | Analytics service | click tracking |
| 12 | Workers | Notification template | |
| 13 | Workers | Notification log | |

Counts: 13 boxes, 2 boundaries, 13 arrows. The "device setting / user info" text is an
annotation of the DB contents, not a box.
