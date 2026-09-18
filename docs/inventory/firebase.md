# Firebase inventory

Firebase is a Google brand; its products were catalogued under `gcp` as `google-firebase-*`
(plus `firestore` and `fcm`) before this folder existed, and those ids are kept. This file
lists the mingrammer `firebase` nodes and where each one lives. Ids for products added here
are `firebase-<product>`.

Status: `done` = component exists in `components/firebase/`. `todo` = to be written.
`skip: <reason>` = cannot be a node in a design.

---

## Mingrammer firebase nodes

| resource | id | kind | status | source |
|---|---|---|---|---|
| Firebase | — | — | skip: Brand/section logo for the Firebase platform, not a placeable runtime node. | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase Authentication | google-firebase-auth | — | skip: catalogued under gcp as `google-firebase-auth` | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Cloud Firestore | firestore | — | skip: catalogued under gcp as `firestore` | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Cloud Functions for Firebase | — | — | skip: skip: the same resource as Cloud Run functions | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase Hosting | google-firebase-hosting | — | skip: catalogued under gcp as `google-firebase-hosting` | https://diagrams.mingrammer.com/docs/nodes/firebase |
| ML Kit | — | — | skip: On-device mobile SDK, standalone and outside Firebase since 3 June 2020; its Firebase-hosted counterpart (Firebase ML) is deprecated and shuts down 15 June 2027. | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase Realtime Database | google-firebase-realtime-database | — | skip: catalogued under gcp as `google-firebase-realtime-database` | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Cloud Storage for Firebase | — | — | skip: skip: the same resource as a Cloud Storage bucket | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase Extensions | — | — | skip: skip: packaged deployments of Cloud Run functions | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase A/B Testing | — | — | skip: skip: experiment layer over Remote Config | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase App Indexing | — | — | skip: Retired: the App Indexing API was deprecated in 2019 and replaced by Android App Links; no longer a Firebase product. | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase Dynamic Links | — | — | skip: skip: fully shut down 25 August 2025 | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase In-App Messaging | google-firebase-in-app-messaging | — | skip: catalogued under gcp as `google-firebase-in-app-messaging` | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase Invites | — | — | skip: Retired: deprecated 24 January 2018 in favour of Dynamic Links and shut down two years later; Dynamic Links itself shut down 25 August 2025. | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase Cloud Messaging | fcm | — | skip: catalogued under gcp as `fcm` | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase Predictions | — | — | skip: Retired: withdrawn from the Firebase product line and no longer documented or available to new projects. | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase Remote Config | google-firebase-remote-config | — | skip: catalogued under gcp as `google-firebase-remote-config` | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase App Distribution | google-firebase-app-distribution | — | skip: catalogued under gcp as `google-firebase-app-distribution` | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase Crash Reporting | — | — | skip: Retired: deprecated in 2018 and shut down, superseded by Firebase Crashlytics. | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase Crashlytics | google-firebase-crashlytics | — | skip: catalogued under gcp as `google-firebase-crashlytics` | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase Performance Monitoring | google-firebase-performance-monitoring | — | skip: catalogued under gcp as `google-firebase-performance-monitoring` | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase Test Lab | google-firebase-test-lab | — | skip: catalogued under gcp as `google-firebase-test-lab` | https://diagrams.mingrammer.com/docs/nodes/firebase |

## Counts

total 22, todo 0, done 0, skip 22.
