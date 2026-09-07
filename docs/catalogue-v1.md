# Catalogue v1

How the 64 kind candidates from the intake pass (`docs/kind-candidates.md`,
`docs/intake/SUMMARY.md`) became the 41 kinds in `kinds/`. This page records the
decisions; `kinds/` is the truth.

## Merges

| Candidates | Became | Why |
|---|---|---|
| scheduled-job, etl-job, worker | `worker` with `trigger` (queue, stream, schedule, batch, manual) | Same runtime shape; rules only care what starts it |
| control-plane-coordinator, sharding-coordinator, service-registry, coordination-service | `coordination-service` with `role` | All are small strongly consistent metadata services; rules test replication, not the name |
| geospatial-index, search-index | `search-index` with `structure: geo-cell` and `geoScheme` | Same sharding and rebuild rules |
| web-client, mobile-client, desktop-client, sdk-client | `client` with `platform` | Rules read resend policy and connection type, not the platform |
| tracing, monitoring | `monitoring` with `signal` | One ops dependency with the same independence rule |
| sequencer, event-log, event-store | `event-store` with `role: sequencer` | Append-only ordered log that is the system of record |
| authorization-service, identity-provider | `identity-provider` with `authorizationModel` | Same trust-boundary role |
| queue roles (dlq, retry, offline-mailbox, frontier) | `queue` with `role` | One kind, one enum |
| mail-store, matching-engine, stateful app-server | `app-server` with `stateless: false`, plus `matching-engine` kept | Matching engine has its own determinism and standby rules; mail-store does not |
| point-of-presence, cell, provider group candidates | group kinds `cell`, `point-of-presence` | Groups, not nodes; `provider` dropped until a rule needs it |

## Dropped (fewer than two sightings, or no rule reads them)

`content-scanner`, `mail-transfer-agent`, `mail-store`, `data-placement-service`,
`edge-function` (a `cdn` with `edgeCompute: true`), `parameter-server`,
`resilience-library` (became edge fields), `secure-enclave`, `telephony-gateway` (a
`third-party-api`), `waf`, `media-router` was kept (four sightings across Zoom and Twitch).

## Property policy applied

- Properties a rule wants to catch as *missing* are optional with no default
  (`cache.evictionPolicy`, `queue.backoff`, `stream-processor.watermarkSeconds`,
  `object-store.zones`, `third-party-api.idempotent`, `nosql-database.conflictResolution`).
- Properties a rule wants to catch as *false* default to false
  (`sql-database.multiWriter`, `realtime-gateway.stampedeGuard`, `ledger.sealed`).
- `managed` is a kind property where hosting matters to a rule; it is never a component.
- No object or list types. `channels` on notification-service became three booleans.

## Kinds

| kind | category | properties |
|---|---|---|
| queue | messaging | delivery, ordering, deadLetterQueue, replay, retentionDays, role, persistence, backoff, maxAttempts |
| pubsub-topic | messaging | delivery, replay, ordering, topicPerEventType |
| stream | messaging | delivery, ordering, partitions, replicationFactor, minInsyncReplicas, acks, retentionHours, compaction, idempotentProducer, transactions, storage, managed, schemaEnforced |
| stream-processor | messaging | windowing, watermarkSeconds, checkpointIntervalSeconds, exactlyOnce, stateBackend, lateDataPolicy, instances |
| change-data-capture | messaging | mode, ordered, schemaEvolution |
| event-store | messaging | replication, journaled, snapshotIntervalEvents, storage, role |
| notification-service | messaging | channelPush, channelEmail, channelSms, dedupKey, templateStore, queuePerChannel |
| webhook-endpoint | messaging | signatureVerified, idempotent, retriedByCaller |
| app-server | compute | stateless, instances, runtime, autoscaling, criticality, shardingStrategy, instancePerEntity, singleWriter, ownsData |
| worker | compute | trigger, instances, idempotent, concurrency, schedule, accelerator, rateControl, fanoutStrategy, fanoutThreshold |
| workflow-engine | compute | durable, pattern, stepsIdempotent, compensation, humanReview, managed |
| ml-inference | compute | training, inputs, embeddingSyncMinutes, snapshotToObjectStore, accelerator, instances |
| matching-engine | compute | singleThreaded, deterministic, algorithm, role, failover |
| sql-database | data | backupEnabled, backupRetentionDays, replication, replicaOf, encryptionAtRest, sharded, shardKey, multiWriter, distributed, replicaFanout, idEncodesShard, concurrencyControl, commitProtocol, appendOnly |
| nosql-database | data | model, consistency, replication, replicationFactor, conflictResolution, quorumReads, quorumWrites, partitionKey, bucketing, tombstoneTtlDays, backupEnabled, backupRetentionDays, encryptionAtRest, managed |
| cache | data | evictionPolicy, ttlSeconds, ttlJitter, persistence, replication, invalidation, hashing, usedAsPrimaryStore, materialised, structure, readBarrier, tier |
| object-store | data | zones, replication, tier, versioning, objectLock, strongReadAfterWrite, checksumOnWrite, encryptionAtRest, durabilityNines, managed |
| search-index | data | structure, shardingStrategy, indexing, rebuildCadenceHours, replicas, geoScheme, managed |
| data-warehouse | data | realtime, upsert, format, managed |
| graph-database | data | inMemory, masterPerShard, rebuildCadenceHours, crossRegionConsistency, managed |
| timeseries-database | data | retentionRawDays, downsampling, tiers, labelIndex, compression, managed |
| ledger | data | doubleEntry, appendOnly, tamperEvident, sealed, indexConsistency, tiering |
| database-proxy | data | pooling, poolSharded, routing, scatterGather, hedging, loadShedding, requestCoalescing |
| id-generator | data | strategy, central, replicated, timeSortable, clockRollbackGuard, batchSize |
| schema-registry | data | compatibility, enforced, managed |
| api-gateway | edge | auth, rateLimiting, tls, idempotencyKeys, keyTtlHours, protocol, concurrencyLimit |
| load-balancer | edge | layer, hashing, connectionPreserving, healthChecks, global, managed |
| cdn | edge | caching, edgeCompute, originShield, tls, managed |
| dns | edge | anycast, geoRouting, healthChecked, ttlSeconds, redundantProviders, managed |
| realtime-gateway | edge | protocol, stateful, autoscaling, channelAssignment, drainOnScaleIn, stampedeGuard, sequenceNumbers, ackIntervalSeconds, subscriptionsPerUser, pushFallback |
| rate-limiter | edge | algorithm, scope, failMode, placement, distributed, atomicOps |
| media-router | edge | mode, transport, cascading, rerouteOnFailure |
| third-party-api | external | idempotent, qpsQuota, callbackStyle, hostedPage, slaPercent, handlesMoney |
| client | client | platform, localCache, resendPolicy, offlineCapable, persistentConnection |
| monitoring | ops | signal, independentOfMonitored, collectorMode, alertGrouping, retentionDays, managed |
| coordination-service | ops | role, consensus, replicated, nodes, managed |
| service-mesh | ops | sidecar, mtls, retries, circuitBreaking, controlPlanes |
| feature-flag-service | ops | stagedRollout, killSwitches, managed |
| network-fabric | ops | multicast, kernelBypass, overlay, interconnect |
| key-management | security | hsm, rotationAutomated, rotationDays, envelopeEncryption, managed |
| identity-provider | security | protocol, authorizationModel, centralised, mfa, managed |

## What changed in the format to fit the catalogue

Recorded in `docs/format.md` and `docs/schema-gaps.md`:

- Category `external`; group kinds `cell` and `point-of-presence`.
- Six optional edge fields: `timeoutMs`, `retryPolicy`, `idempotent`, `circuitBreaker`, `fallback`, `batched`.
- Thirty-one new requirement paths.
- Predicates `field`, `nfr`, `hasNode`, `from`, `to`, `crossesGroup`; `gt`/`lt` on `prop` and `requirement`; `peerKind`, `peerCategory`, `delivery`, `count` on `hasEdge`.
