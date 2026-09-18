# snapchat-platform: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/snapchat-platform.md` (intake card, with a `## Verification 2026-09-14` section appended).
- Size: 23 nodes, 28 edges, 6 groups.

## Clean variant (header of design.yaml)

Reference architecture: Snapchat's multicloud backend — one Envoy API Gateway per region in
front of 300+ services on Snap Service Mesh, with a cross-cloud read path cached in KeyDB and
ads reporting run as a durable Temporal workflow.

Fixes relative to snapchat-platform.broken.yaml:
  - keydb-cache is a read-through cache, not the copy of record: usedAsPrimaryStore false, and
    caching-secondary-user-service falls through to user-service on a miss and backfills
  - the cross-cloud read edge declares a timeout and a circuit breaker, the knobs Switchboard
    actually exposes (connect timeouts, circuit breaker policies, retry policies)
  - user-conversation-store stays a single-region DynamoDB table read through the cache tier
    instead of a multi-leader global table with no conflict policy
  - s3-media-store keeps its three-zone storage class behind CloudFront
  - ads reporting is orchestrated by temporal-cluster, so each step is a durable, retried,
    idempotent task instead of an inline chain ending in a synchronous e-mail call
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture, broken variant: the same Snapchat multicloud backend, built the way a
team gets it wrong — the GCP-side KeyDB promoted to the copy of record, the cross-cloud read
retried with no circuit breaker, the user table turned into a multi-leader global table, Snap
media parked in a one-zone storage class, and ads reporting chained inline into an e-mail call
with no workflow engine behind it.

This file MUST trip:
  - cache-as-primary-store-without-persistence     (keydb-cache: usedAsPrimaryStore true, persistence false)
  - retry-without-adaptive-shedding                (caching-secondary-user-service -> user-service retries with no circuit breaker and no rate limiter)
  - multi-leader-store-without-conflict-policy     (user-conversation-store: global tables, conflictResolution none)
  - object-store-single-zone-with-durability-target (s3-media-store: one-zone-ia, zones 1, design targets 11 nines)
  - external-call-inline-without-durable-path      (notification-service calls smtp-relay inline; temporal-cluster is gone)
and MUST NOT trip:
  - cache-missing-eviction-policy               (keydb-cache still declares ttl eviction)
  - materialised-cache-without-rebuild-path     (keydb-cache holds user records, not materialised views)
  - credentials-without-rotation                (security.credentialRotationDays is still declared)
  - datastore-missing-backup, datastore-single-region, read-replica-as-sole-scaling,
    single-writer-primary-at-peak-qps           (no sql-database node in this design)
  - read-heavy-path-without-cache               (no traffic.readWriteRatio requirement, and a cache exists)
  - sync-chain-too-deep                         (no latency.p95Ms: the sources publish no latency SLO)
  - queue-missing-dlq, pubsub-replay-required, retry-queue-without-dlq, retry-without-backoff
                                                (no queue or topic node in this design)
  - fanout-inline-in-request-path               (no app-server calls a worker synchronously)
  - exactly-once-with-external-side-effects     (messaging.exactlyOnce is not claimed)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone, cross-cell-call
                                                (no availability-zone or cell groups)

Each of the five is a mistake the sources themselves argue against: the KeyDB post frames the
cache as a read-through layer over an authoritative DynamoDB in another cloud; the service-mesh
post lists connect timeouts, circuit breaker policies and retry policies as exactly the knobs
Switchboard exposes; the Temporal post's worked example is "if a report is generated and the
notification service goes down, then the advertiser will not be able to receive the
notification".

## Mapping

| Source box (card row) | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| 1 Snapchat client (Android / iOS) | `snapchat-client` | `mobile-app` | client | exact |
| 3 Client network layer (gRPC over QUIC) | folded into the `snapchat-client` -> `api-gateway` edge (`protocol: grpc-quic`) | — | — | close |
| 4 API Gateway | `api-gateway` | `envoy-gateway` | api-gateway | exact |
| 5 Envoy sidecar (Mesh data plane) | `envoy-sidecar` | `envoy-sidecar` | service-mesh | exact |
| 6 xDS Control Plane | `xds-control-plane` | `container-service` | app-server | assumed (catalogue gap) |
| 7 Switchboard | `switchboard` | `container-service` | app-server | assumed (catalogue gap) |
| 8 Switchboard config store | `switchboard-config-store` | `dynamodb` | nosql-database | exact |
| 9 Kubernetes clusters (AWS) | `eks-clusters` | `aws-eks` | container-orchestrator | exact |
| 10 Kubernetes clusters (GCP) | `gke-clusters` | `google-gke` | container-orchestrator | exact |
| 13 Media Service | `media-service` | `container-service` | app-server | close |
| 14 Friend Service | `friend-service` | `container-service` | app-server | close |
| 15 Messaging Core Service | `messaging-core-service` | `container-service` | app-server | close |
| 16 User Service | `user-service` | `container-service` | app-server | exact |
| 17 CachingSecondaryUserService | `caching-secondary-user-service` | `container-service` | app-server | exact |
| 18 KeyDB cache | `keydb-cache` | `keydb` | cache | exact |
| 19 SecondaryServiceCacheInvalidator | `secondary-service-cache-invalidator` | `container-worker` | worker | exact |
| 20 Conversation / user store | `user-conversation-store` | `dynamodb` | nosql-database | exact |
| 21 Media object store | `s3-media-store` | `s3` | object-store | exact |
| 22 Content delivery | `cloudfront` | `cloudfront` | cdn | exact |
| 26 Temporal cluster | `temporal-cluster` | `temporal` | workflow-engine | exact |
| 27 Ads reporting workflow services | `data-fetching-service`, `report-generation-service`, `notification-service` | `container-worker`, `container-worker`, `notification-platform` | worker, worker, notification-service | exact |
| 28 Spinnaker | `spinnaker` | `spinnaker` | ci-pipeline | exact |

Tally: 18 exact, 4 close, 2 assumed (counting the three ads services as one row, as the card does).

Only in `design.broken.yaml`: `smtp-relay` (`smtp-relay`, third-party-api) stands in for the
e-mail the Notification Service sends the advertiser. The card names the step but no provider,
so the clean design ends at `notification-service` instead of naming a vendor.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Switchboard | a `control-panel` / `service-catalog` kind, or a generic `coordination-service` component under `default` (every component in that kind is a named product) | `container-service` with `label: "Switchboard"` |
| xDS Control Plane | a `service-mesh` component for the control plane; the kind has no `plane: data \| control` split | `container-service` with `label: "xDS Control Plane"`; `envoy-sidecar` carries `controlPlanes: 7` |
| Google App Engine (legacy monolith) | `app-server` under `gcp` — no component found | not encoded (see below) |

No component was added to the catalogue for this design.

## Not encoded

- Card row 2, the on-device SQLite message store. `sqlite` is the right component, but as a
  `sql-database` node it trips `datastore-missing-backup`, which is the wrong verdict for an
  embedded store on a phone. Dropped rather than falsified.
- Card row 12, the Google App Engine monolith: the system the platform migrated off, not a
  runtime element of the design.
- Card row 11, the internal regional network: expressed as the `aws-compute` / `gcp-compute`
  trust zones instead of a node.
- Card rows 23-25 (ElastiCache tier, Spanner/Firestore/Bigtable, BigQuery): named in Snap's
  datastore inventory with no edges and no stated role, so they would be orphan nodes.
- Card rows 29-30 (GuardDuty + Falco runtime threat detection, admission-controller webhooks):
  a control-plane security posture the format has no vocabulary for; encoding them as monitoring
  and policy-engine nodes would add boxes the request path never touches.
- The multicloud fact itself. There is no `topology.multiCloud` requirement and no
  `cloudProvider` property on `app-server`, so "this sync edge crosses from GCP to AWS" is
  carried only by the two `region` groups and the edge label, and no rule can see it.
- The mesh sidecar is drawn once. The source's picture is one Envoy per service host; the format
  has no "every node also has this" relation, so `envoy-sidecar` takes two representative
  localhost edges (from `messaging-core-service` and `caching-secondary-user-service`).
- Config canarying ("a small subset of Envoys ... measured over a period of minutes") lives in
  an edge label; `service-mesh` has no `configCanary` property.
- Cross-account role assumption (IRSA/OIDC into tenant data accounts) is expressed as the
  `aws-compute` / `aws-data` trust-zone split plus `security.credentialRotationDays`.

## Values set without a verbatim source

- `durability.annualNines: 11` — S3's published design target for the classes the card names
  (S3, S3 Glacier Instant Retrieval), not a number Snap states. It is what makes
  `object-store-single-zone-with-durability-target` meaningful on the broken twin.
- `security.credentialRotationDays: 1` — no source states a rotation period; the AWS EKS post
  describes IRSA/OIDC and cross-account role assumption, i.e. STS session credentials that turn
  over well inside a day. Set so `credentials-without-rotation` does not fire on a design whose
  source explicitly makes short-lived assumed roles the only path to data.
- No `latency.p95Ms`: the sources publish measurements (49-133 ms cross-cloud, 1.56-2.11 ms on a
  hit, 24% faster image Snap sends) but no SLO, so the design states none.
- No `traffic.readWriteRatio`, no `messaging.orderingScope`, no `correctness.exactlyOnceEffect`:
  the card's Unknowns section says plainly that no fetched source states message ordering or
  delivery guarantees for the Snap send path.
