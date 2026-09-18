# spotify-playback: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/spotify-playback.md` (seven official Spotify engineering posts, 2013-2024; all seven re-fetched and confirmed on 2026-09-13, see the "Verification 2026-09-13" section of that file).
- Size: 19 nodes, 28 edges, 4 groups.

## Clean variant (header of design.yaml)

Reference architecture: Spotify playback and event delivery. Clients hold a connection to a
nearest-datacentre access point in front of the squad-owned microservices, audio comes from a
CDN, and every client and service event is published to one Cloud Pub/Sub topic per event type
and windowed into hourly buckets by a per-type Dataflow ETL feeding GCS, BigQuery and 38,000
scheduled pipelines.

Fixes relative to spotify-playback.broken.yaml:
  - event-topics keep retention so raw events can be re-read (Pub/Sub replay beside the GCS copy)
  - event-etl declares a watermark, so an event-time hourly window knows when it is complete and
    late data is shifted into the open bucket instead of being silently undefined
  - access-point drains its connections on scale-in instead of dropping every socket at once
  - service-discovery is served redundantly, so the SRV lookup every service depends on is not
    one failure away from taking the fleet with it
  - user-db is backed up with a stated retention, and the design declares a credential rotation
    period for the stores it holds
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: Spotify playback and event delivery, broken variant. The same system
with the mistakes the Spotify posts describe: topics that keep nothing, so a failed hour cannot
be re-read; an event-time ETL with no watermark, the "watermark unpredictability" of part III;
an access point that autoscales in without draining its sockets; a single-provider SRV lookup
that every client and every service goes through; and a relational store with no backup and no
stated credential rotation. The mobile client is back to the fire-and-forget sender the 2021
post replaced.

This file MUST trip:
  - pubsub-replay-required                     (event-topics keep no history while the design asks for reprocessing)
  - windowed-aggregation-without-watermark     (event-etl windows by event time with nothing to close the hour)
  - stateful-websocket-scale-in-without-drain  (access-point scales in on top of live connections)
  - shared-dependency-without-redundancy       (service-discovery has one provider under a redundant-discovery promise)
  - datastore-missing-backup                   (user-db keeps no copy and states no retention)
  - credentials-without-rotation               (the design holds data, names no rotation period and has no key vault)
and MUST NOT trip:
  - cache-missing-eviction-policy              (object-cache still declares lru)
  - multi-leader-store-without-conflict-policy (metadata-store still declares last-writer-wins)
  - read-heavy-path-without-cache              (no read/write ratio is claimed, and a cache exists)
  - object-store-single-zone-with-durability-target (no durability target is claimed)
  - queue-missing-dlq, retry-queue-without-dlq, retry-without-backoff (no queue in this design)
  - derived-store-without-cdc-or-rebuild, business-updates-without-index-propagation (no search index)
  - sync-chain-too-deep                        (the access point is a realtime gateway, not an api-gateway)
  - shared-host-per-channel-without-isolation, reconnect-stampede-without-guard (no heavy-tail claim,
    and the access point talks to DNS, not to a coordination service)
  - stateful-node-without-zone-redundancy, cross-cell-call (no zone or cell boundaries are drawn)
  - shared-worker-pool-across-queues           (isolation is per event type, not per queue)

## Mapping

| # | Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|---|
| 1 | Clients (desktop, mobile, web; SDK batches and resends) | `spotify-mobile` | `mobile-app` | client | exact |
| 1 | Clients, web player | `spotify-web` | `web-browser` | client | exact |
| 2 | Access point | `access-point` | `websocket-gateway` | realtime-gateway | close (real box, but named only in Spotify's architecture deck, not in the 2013 post; its transport is long-lived TCP carrying Hermes, modelled as `protocol: "websocket"`) |
| 3 | Hermes (ZeroMQ + protobuf) | — | — | service-mesh | close (no generic service-mesh component exists; encoded as the edge protocol `hermes`) |
| 4 | Service discovery (DNS SRV) | `service-discovery` | `dns-resolver` | dns | close (the SRV mechanism is attested outside the primary post) |
| 5 | Microservices (~2,000, squad owned) | `microservices` | `container-service` | app-server | exact |
| 6 | Cassandra | `metadata-store` | `cassandra` | nosql-database | exact (the replication topology is assumed) |
| 7 | PostgreSQL | `user-db` | `postgres` | sql-database | exact (replication, backup and encryption are assumed) |
| 8 | Memcached | `object-cache` | `memcached` | cache | exact |
| 9 | Audio storage | `audio-store` | `blob-store` | object-store | assumed (no post names the vendor) |
| 9 | CDN | `audio-cdn` | `content-delivery-network` | cdn | assumed (no post names the vendor) |
| 12 | Event Delivery Service | `event-delivery-service` | `container-service` | app-server | exact |
| 13 | Cloud Pub/Sub, one topic per event type | `event-topics` | `google-pubsub` | pubsub-topic | exact |
| 14 | ETL per event type (Dataflow, Scio) | `event-etl` | `google-dataflow` | stream-processor | exact |
| 17 | Cloud Storage | `raw-datasets` | `gcs` | object-store | exact |
| 18 | BigQuery | `warehouse` | `bigquery` | data-warehouse | exact |
| 19 | Schema registry / Avro | `schema-registry` | `google-pubsub-schema` | schema-registry | close (Spotify's registry is in-house; no generic schema-registry component exists) |
| 20 | Pipeline orchestration, 38,000 scheduled pipelines | `batch-pipelines` | `container-worker` | worker | close (no generic workflow-engine or scheduled-job component exists) |
| 20 | Flink clusters | `streaming-pipelines` | `flink` | stream-processor | exact |
| 22 | Liveness monitoring | `liveness-monitoring` | `observability-stack` | monitoring | exact |

Counted by confidence: 13 exact, 5 close, 2 assumed (20 rows; one of the close rows, Hermes, maps to no node).

Rows dropped from the card and why: **10** and **11** (syslog + Kafka 0.7 + Groupers, Hadoop HDFS + Crunch ETL) are the pre-2016 system that the Pub/Sub design replaced, not part of the system being drawn; **15** (Cloud SQL for ETL metadata) and **16** (Dataproc dedup) could not be confirmed in part III on re-fetch, so they were dropped rather than guessed; **21** (data endpoints) is a governance layer the card itself marks as not a runtime kind.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| Hermes (message-based RPC/pubsub over ZeroMQ with a protobuf envelope) | a generic in-house `service-mesh`; every service-mesh component is a named product | no node; the edge protocol `hermes` |
| Spotify's in-house Avro schema registry | a generic `schema-registry` | `google-pubsub-schema` |
| Spotify's pipeline scheduler and Kubernetes event operators | a generic `workflow-engine`, or the `scheduled-job` kind, which has no component in any provider | `container-worker` with `trigger: "schedule"` |
| Data endpoints (retention, access control, lineage, quality) | a generic `data-catalog` | not encoded |
| Audio storage with no named vendor | `object-store` | `blob-store` |
| A realtime gateway whose transport is raw TCP | `realtime-gateway` with a `tcp` protocol value | `protocol: "websocket"`, the nearest enum value |

## Values set to keep the clean design clean

The brief's rule holds: when a rule fires on the real system as documented, the documented practice is written in rather than the rule waived. These values are not in any source.

- `user-db` / `metadata-store`: `backupEnabled: true`, `backupRetentionDays: 30`, `encryptionAtRest: true`. No Spotify post discusses backups of the serving stores.
- `security.credentialRotationDays: 90`. Not stated; a store-holding design must declare a rotation period or carry a key-management node.
- `availability.discoveryRedundant: true` with `service-discovery.redundantProviders: true`. The four-datacentre fleet resolved everything through SRV records; nothing states how that DNS was served.
- `metadata-store.replication: "multi-region-multi-leader"` with `conflictResolution: "last-writer-wins"`. The card calls Cassandra "multi-site replicated"; the primary post only names the product. Last-writer-wins is Cassandra's actual behaviour, not a source claim.
- `event-etl.watermarkSeconds: 200`. Derived from part III's measured "watermark lag mostly below 200s", which is an observation, not a configured value.
- `freshness.maxSeconds: 3600`. Stands for the hourly bucket completeness the posts describe; no post states a freshness SLO in seconds.
- `access-point`: `drainOnScaleIn: true`, `stampedeGuard: true`, `channelAssignment: "hash"`. Nothing is documented about how the access point scales; these are the properties a gateway holding persistent connections must have.

## Not encoded

- Hermes itself: the format has no generic service-mesh component, so the message layer survives only as the `hermes` protocol on two edges.
- Service-to-service calls between microservices (the card's "microservice -> microservice, messaging and pubsub modes"): the 2,000 services are one node, so the edge would be a self-loop.
- The legacy pipeline (syslog producer, Kafka 0.7 with no broker persistence, Groupers, HDFS, Crunch, end-of-file checkpoints) and its documented failures. It is a different generation of the same system; a design carries one topology.
- Data endpoints: retention policies, access controls, lineage tracking and quality checks are metadata about datasets, not runtime nodes.
- Deduplication across a multi-week window keyed on event message identifiers. The format has no edge property for a dedup window and no node property for it on `stream-processor`; it appears only in the ETL output edge label.
- The 1:1:1 shape of the isolation (one topic *and* one ETL job *and* one storage location per event type, 1,800 of them). `isolation.perEventType: true` plus `topicPerEventType: true` state the intent; the design draws one representative topic and one representative job.
- Client resend timing (immediately, minutes, days) and the offline buffer. `resendPolicy: "store-and-forward"` and `offlineCapable: true` carry it; the schedule is in an edge label. `retryPolicy` was deliberately left off that edge: the format's retry fields assume a server-side caller that can hold a circuit breaker.
- Volumes other than the peak rate: 1T events/day, 350 TB/day raw, 70 TB/day compressed, 100+ PB on-prem, 2,500 ETL VMs, 1,800 event types. Only `nfr.rps` exists, and it carries the 8M events/sec peak.
- Backstage, the Kubernetes custom operators that provision per-event-type infrastructure, and the anonymisation and encryption steps inside the ETL: control plane and in-job stages, not nodes with edges.
- The cost requirement the 2019 post makes explicit. No requirement path expresses a budget.
