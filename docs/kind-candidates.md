# Kind candidates

Tally of candidate kinds across intake cards. A candidate seen in two or more systems
qualifies for a kind file under governance. Updated after every card.

| Candidate kind | Existing? | Seen in (system ids) | Count | Typical products |
|---|---|---|---|---|
| app-server | yes | order-processing, multi-region-web, uber-dispatch, netflix-streaming, google-drive, whatsapp-messaging, youtube-upload-playback, twitter-timeline, instagram-feed, stripe-payments, shopify-flash-sale, airbnb-search, slack-messaging, discord-messages, linkedin-kafka, spotify-playback, figma-multiplayer, notion-sharding, doordash-delivery, hotel-reservation, distributed-email, payment-system, digital-wallet, stock-exchange | 24 | container-service, lambda, node service, django, rails, java thrift service, hacklang webapp, elixir guild process, rust per-document process |
| sql-database | yes | order-processing, multi-region-web, uber-dispatch, netflix-streaming, google-drive, youtube-upload-playback, twitter-timeline, instagram-feed, shopify-flash-sale, airbnb-search, slack-messaging, spotify-playback, figma-multiplayer, notion-sharding, doordash-delivery, pinterest-feed, hotel-reservation, distributed-email, object-storage, payment-system, digital-wallet, stock-exchange | 22 | postgres, mysql, aurora, spanner, cockroachdb, rds, edgestore, cloudsql |
| stream | no | uber-dispatch, netflix-streaming, twitter-timeline, shopify-flash-sale, airbnb-search, slack-messaging, linkedin-kafka, notion-sharding, doordash-delivery, tinder-geo, pinterest-feed, reddit-feed, tiktok-recommendation, robinhood-trading, coinbase-exchange, booking-search, grab-geo, distributed-message-queue, payment-system | 19 | kafka, kinesis, event-hubs, eventbus |
| cache | yes | multi-region-web, uber-dispatch, netflix-streaming, google-drive, whatsapp-messaging, youtube-upload-playback, twitter-timeline, instagram-feed, shopify-flash-sale, slack-messaging, spotify-playback, figma-multiplayer, hotel-reservation, distributed-email, object-storage, payment-system, digital-wallet | 17 | redis, memcached, evcache, dynomite, haplo, flannel, livegraph cache |
| nosql-database | no | uber-dispatch, netflix-streaming, whatsapp-messaging, youtube-upload-playback, twitter-timeline, instagram-feed, stripe-payments, airbnb-search, discord-messages, linkedin-kafka, spotify-playback, cloudflare-edge, figma-multiplayer, pinterest-feed, distributed-email, payment-system | 16 | cassandra, scylladb, riak, schemaless, dynamodb, mnesia, bigtable, manhattan, mongodb, mussel, espresso, venice, quicksilver |
| queue | yes | order-processing, whatsapp-messaging (offline mailbox), instagram-feed, shopify-flash-sale, slack-messaging, doordash-delivery, pinterest-feed, reddit-feed, amazon-order, robinhood-trading, notification-system, chat-system, web-crawler, distributed-email, payment-system, digital-wallet | 16 | kafka, sqs, rabbitmq, gearman, redis jobs, pinlater, pacer, per-user mailbox |
| worker | no | uber-dispatch, netflix-streaming, google-drive, youtube-upload-playback, twitter-timeline, instagram-feed, shopify-flash-sale, airbnb-search, slack-messaging, discord-messages, pinterest-feed, reddit-feed, distributed-email, object-storage, digital-wallet, stock-exchange | 16 | container-service, lambda, batch, fanout daemon, gearman workers, ghostferry, search indexer, jqrelay, rust migrator |
| api-gateway | yes | order-processing, multi-region-web, uber-dispatch, netflix-streaming, twitter-timeline, stripe-payments, airbnb-search, linkedin-kafka, doordash-delivery, tinder-geo, twitch-live, hotel-reservation, object-storage, payment-system, stock-exchange | 15 | aws-api-gateway, apim, rtapi, zuul, tfe, kafka rest proxy, bff |
| coordination-service | no | youtube-upload-playback, stripe-payments, shopify-flash-sale, airbnb-search, linkedin-kafka, cloudflare-edge, figma-multiplayer, pinterest-feed, robinhood-trading, rate-limiter, notification-system, chat-system, search-autocomplete, object-storage, digital-wallet | 15 | zookeeper, etcd, consul, helix, routing metadata service, sorting hat, dynamodb lock, topology service |
| monitoring | no | uber-dispatch, netflix-streaming, twitter-timeline, instagram-feed, stripe-payments, linkedin-kafka, spotify-playback, cloudflare-edge, twitch-live, booking-search, robinhood-trading, web-crawler, metrics-monitoring, payment-system, stock-exchange | 15 | m3, atlas, viz, munin, sentry, prometheus, datadog, dq metrics, burrow, kafka monitor |
| object-store | no | netflix-streaming, google-drive, whatsapp-messaging, youtube-upload-playback, twitter-timeline, instagram-feed, spotify-playback, figma-multiplayer, notion-sharding, zoom-video, distributed-email, object-storage, digital-wallet, stock-exchange | 14 | s3, gcs, azure-blob, magic-pocket, blobstore |
| realtime-gateway | no | google-drive, whatsapp-messaging, twitter-timeline, slack-messaging, discord-messages, spotify-playback, figma-multiplayer, twitch-live, coinbase-exchange, notification-system, chat-system, nearby-friends, distributed-email, stock-exchange | 14 | long-poll server, websocket gateway, erlang chat server, firehose, slack gateway servers, elixir sessions, spotify access point, livegraph edge |
| data-warehouse | no | uber-dispatch, twitter-timeline, stripe-payments, airbnb-search, linkedin-kafka, spotify-playback, notion-sharding, pinterest-feed, twitch-live, coinbase-exchange, google-maps, nearby-friends, ad-click-aggregation | 13 | presto, hadoop, hive, pinot, bigquery, redshift, snowflake |
| etl-job | no | uber-dispatch, netflix-streaming, twitter-timeline, stripe-payments, shopify-flash-sale, linkedin-kafka, spotify-playback, notion-sharding, pinterest-feed, google-maps, grab-geo, payment-system, digital-wallet | 13 | spark, hudi, glue, hadoop, scalding, gobblin, dataproc, fivetran |
| scheduled-job | no | stripe-payments, airbnb-search, linkedin-kafka, spotify-playback, tinder-geo, pinterest-feed, amazon-order, search-autocomplete, hotel-reservation, distributed-email, object-storage, payment-system, digital-wallet | 13 | cron, monthly close, airflow dag, topicgc, scio pipelines, reindex job |
| ml-inference | no | airbnb-search, doordash-delivery, pinterest-feed, twitch-live, tiktok-recommendation, amazon-order, google-maps, booking-search, grab-geo, hotel-reservation, distributed-email, payment-system | 12 | ranking model service, deepred dispatch, pinnability, tf serving, sagemaker endpoint |
| mobile-client | no | uber-dispatch, netflix-streaming, google-drive, whatsapp-messaging, youtube-upload-playback, twitter-timeline, instagram-feed, airbnb-search, slack-messaging, discord-messages, spotify-playback, payment-system | 12 | ios, android, tv app |
| stream-processor | no | airbnb-search, linkedin-kafka, spotify-playback, notion-sharding, doordash-delivery, reddit-feed, tiktok-recommendation, robinhood-trading, coinbase-exchange, google-maps, metrics-monitoring, ad-click-aggregation | 12 | flink, samza, dataflow, spark streaming, kafka streams, riverbed, hudi deltastreamer |
| load-balancer | no | netflix-streaming, whatsapp-messaging, youtube-upload-playback, twitter-timeline, instagram-feed, shopify-flash-sale, slack-messaging, cloudflare-edge, reddit-feed, distributed-email, object-storage | 11 | elb, alb, nginx, openresty, haproxy, netscaler, envoy, unimog, pingora |
| search-index | no | twitter-timeline, instagram-feed, shopify-flash-sale, airbnb-search, tinder-geo, reddit-feed, booking-search, twitch-live, search-autocomplete, proximity-service, distributed-email | 11 | earlybird, solr, elasticsearch, opensearch, cloudsearch |
| cdn | no | netflix-streaming, youtube-upload-playback, instagram-feed, spotify-playback, cloudflare-edge, reddit-feed, twitch-live, amazon-order, booking-search, url-shortener | 10 | open-connect, cloudfront, cloudflare, fastly, google edge, twitch edge pops |
| control-plane-coordinator | no | google-drive, stripe-payments, slack-messaging, linkedin-kafka, cloudflare-edge, zoom-video, twitch-live, booking-search, object-storage, digital-wallet | 10 | magic pocket master, docdb coordinator, hdfs namenode, rotor xds, cruise control, unimog conductor, zoom zone controller |
| database-proxy | no | youtube-upload-playback, twitter-timeline, instagram-feed, stripe-payments, shopify-flash-sale, slack-messaging, discord-messages, figma-multiplayer, notion-sharding, reddit-feed | 10 | vitess, gizzard, proxysql, pgbouncer, docdb proxy, discord data services, figma dbproxy, pgkeeper |
| third-party-api | no | whatsapp-messaging, stripe-payments, robinhood-trading, coinbase-exchange, google-maps, grab-geo, notification-system, hotel-reservation, payment-system, stock-exchange | 10 | apns, gcm/fcm, card networks, banks, psp, market makers, exchanges, blockchains |
| change-data-capture | no | airbnb-search, linkedin-kafka, figma-multiplayer, notion-sharding, doordash-delivery, robinhood-trading, coinbase-exchange, hotel-reservation | 8 | spinaltap, brooklin, databus, livegraph invalidator, debezium, cockroachdb changefeed, dms, maxwell |
| workflow-engine | no | uber-dispatch, spotify-playback, doordash-delivery, amazon-order, google-maps, hotel-reservation, payment-system, digital-wallet | 8 | cadence, temporal, step-functions, herd, flyte, k8s operators, human review queue |
| rate-limiter | no | shopify-flash-sale, discord-messages, doordash-delivery, url-shortener, rate-limiter, hotel-reservation, stock-exchange | 7 | leaky bucket at edge, token bucket, envoy ratelimit, in-process semaphore, aperture adaptive |
| service-mesh | no | uber-dispatch, netflix-streaming, whatsapp-messaging, spotify-playback, tinder-geo, robinhood-trading, booking-search | 7 | hyperbahn, ribbon, wandist, hermes, envoy sidecar, kafkaproxy sidecar, istio, linkerd |
| service-registry | no | netflix-streaming, slack-messaging, spotify-playback, cloudflare-edge, chat-system, nearby-friends, metrics-monitoring | 7 | eureka, consul, dns srv, zookeeper discovery |
| dns | no | instagram-feed, cloudflare-edge, zoom-video, robinhood-trading, web-crawler, distributed-email | 6 | route53, cloud dns, azure dns, cloudflare anycast dns, geo routing, internal service dns, resolver cache |
| graph-database | no | twitter-timeline, instagram-feed, pinterest-feed, tiktok-recommendation, booking-search, news-feed | 6 | flockdb, tao, zen, pixie (in-memory), bytegraph, janusgraph, neo4j, neptune |
| web-client | no | netflix-streaming, google-drive, youtube-upload-playback, twitter-timeline, figma-multiplayer, payment-system | 6 | browser spa, wasm editor |
| id-generator | no | instagram-feed, discord-messages, url-shortener, chat-system, unique-id-generator | 5 | snowflake, per-shard sequence, ulid service, batched counter, ticket server |
| network-fabric | no | cloudflare-edge, tinder-geo, zoom-video, twitch-live, stock-exchange | 5 | bgp routers, spine-leaf clos, flannel overlay, equinix fabric interconnect, private backbone |
| notification-service | no | whatsapp-messaging, twitter-timeline, instagram-feed, notification-system, news-feed | 5 | push bridge to apns/fcm, pyapns, sns mobile push, multi-channel notification platform |
| sdk-client | no | stripe-payments, spotify-playback, coinbase-exchange, object-storage, stock-exchange | 5 | client library with retry/resend policy |
| tracing | no | uber-dispatch, twitter-timeline, doordash-delivery, robinhood-trading, booking-search | 5 | jaeger, zipkin, opentelemetry |
| geospatial-index | no | uber-dispatch, tinder-geo, grab-geo, proximity-service | 4 | s2, h3, geohash, quadtree, redis-geo, pharos road-network knn |
| ledger | no | stripe-payments, payment-system, digital-wallet, stock-exchange | 4 | stripe ledger, uber ledgerstore, double-entry store |
| pubsub-topic | yes | order-processing, spotify-playback, twitch-live, nearby-friends | 4 | sns, google-pubsub, twitch pubsub, redis pub/sub |
| sharding-coordinator | no | uber-dispatch, slack-messaging, discord-messages, notification-system | 4 | ringpop, charm, guild registry ring, apache helix |
| webhook-endpoint | no | stripe-payments, twitch-live, metrics-monitoring, payment-system | 4 | outbound webhooks with retry, eventsub, alert webhooks |
| desktop-client | no | google-drive, slack-messaging, discord-messages | 3 | electron, native, nucleus |
| key-management | no | coinbase-exchange, booking-search, nearby-friends | 3 | hsm, mpc custody, kms, secrets manager, credential rotation (MVP list: secrets manager) |
| schema-registry | no | linkedin-kafka, spotify-playback, doordash-delivery | 3 | confluent schema registry, glue schema registry, linkedin registry, spotify avro registry, protobuf validation |
| event-store | no | digital-wallet, stock-exchange | 2 | raft-replicated event log, eventstoredb, kafka as system of record |
| feature-flag-service | no | uber-dispatch, rate-limiter | 2 | flipr, launchdarkly, kill switches |
| matching-engine | no | coinbase-exchange, stock-exchange | 2 | exchange order book matcher |
| media-router | no | zoom-video, twitch-live | 2 | zoom mmr, twitch intelligest proxy, janus, mediasoup, twilio video |
| timeseries-database | no | pinterest-feed, metrics-monitoring | 2 | goku, m3db, prometheus tsdb, influxdb, atlas |
| authorization-service | no | airbnb-search | 1 | himeji, zanzibar, spicedb, opa |
| content-scanner | no | distributed-email | 1 | spam filter, antivirus, gmail tensorflow classifiers |
| data-placement-service | no | instagram-feed | 1 | akkio |
| edge-function | no | cloudflare-edge | 1 | workers, lambda@edge, fastly compute |
| event-log | no | stripe-payments | 1 | ledger event log, kafka (compacted), eventstore |
| identity-provider | no | object-storage | 1 | aws iam, himeji-style authz, oauth provider |
| mail-store | no | distributed-email | 1 | cyrus imap, dovecot |
| mail-transfer-agent | no | distributed-email | 1 | postfix, sendmail, ses smtp |
| parameter-server | no | tiktok-recommendation | 1 | monolith ps, tf parameter server (may fold into ml-inference) |
| resilience-library | no | netflix-streaming | 1 | hystrix, resilience4j, polly (probably edge properties, not a kind) |
| secure-enclave | no | whatsapp-messaging | 1 | intel sgx, aws nitro enclaves |
| sequencer | no | stock-exchange | 1 | exchange sequencer, lmax input disruptor, single-writer log head |
| telephony-gateway | no | zoom-video | 1 | pstn/sip gateway (may fold into third-party-api) |
| waf | no | cloudflare-edge | 1 | cloudflare waf, aws waf, l4drop, modsecurity |

Notes:
- kafka is currently a `queue` component. Both uber-dispatch and netflix-streaming use it as
  a log/data hub, which reads as `stream`. Two sightings: qualifies. Decide whether stream
  is separate kind or queue gains a `log` flavour before authoring.
- Ops tooling (Spinnaker, Chaos Monkey, FIT) deliberately not tallied as kinds; they are
  process, not runtime topology.
- Hystrix-style resilience reads better as edge properties (fallback, circuitBreaker,
  timeoutMs) than as a node kind.

# Property candidates

| Kind | Property | Seen in | Count | Why a rule would read it |
|---|---|---|---|---|
| app-server | autoscaling (boolean) | netflix-streaming | 1 | stateless without autoscaling under stated rps |
| app-server | criticality (low, medium, high) | netflix-streaming | 1 | critical dependency without fallback |
| cache | replication (single-az, multi-az, multi-region) | netflix-streaming | 1 | single-zone cache in multi-az design |
| cache | workloadPartitioned (boolean) | netflix-streaming | 1 | shared cache between batch and real-time |
| sql-database | sharded (boolean) | uber-dispatch, google-drive | 2 | single primary at scale |
| sql-database | appendOnly (boolean) | google-drive | 1 | journal semantics, no in-place update rules |
| object-store | durabilityNines (integer) | google-drive | 1 | single-zone store under durability target |
| object-store | erasureCoding (boolean) | google-drive | 1 | cost/durability tiering |
| object-store | crossZoneReplicationSeconds (integer) | google-drive | 1 | replication lag vs durability target |
| edge | hintOnly (boolean) | google-drive | 1 | notification without reconcile path |
| requirements | durability.annualNines (integer) | google-drive | 1 | object-store zone count vs durability |
| requirements | availability.zones (integer) | google-drive | 1 | zone redundancy rules |
| app-server | partitions (integer) | whatsapp-messaging | 1 | failure-domain isolation |
| edge | blocking (boolean; call vs cast) | whatsapp-messaging | 1 | blocking call into partitioned service |
| edge | connection (persistent, request-response) | whatsapp-messaging | 1 | connection-server semantics |
| requirements | messaging.storeAndForward (boolean) | whatsapp-messaging | 1 | offline mailbox required |
| cache | ttlJitter (boolean) | youtube-upload-playback | 1 | thundering herd on synchronized expiry |
| worker | accelerator (none, gpu, asic) | youtube-upload-playback | 1 | informational, cost |
| requirements | consistency.perDomain | youtube-upload-playback | 1 | eventual store behind strong-consistency domain |
| worker | fanoutStrategy (push, pull, hybrid) + fanoutThreshold | twitter-timeline | 1 | push fanout without celebrity path |
| cache | listCap (integer), replicas (integer) | twitter-timeline | 1 | materialised cache without rebuild path or replicas |
| requirements | latency.propagationSeconds | twitter-timeline | 1 | write-to-visible target vs sync fanout |
| cache | usedAsPrimaryStore (boolean) | instagram-feed | 1 | cache as system of record without persistence |
| nosql-database | replicationFactor (integer), storageEngine (string) | instagram-feed | 1 | quorum scope and cost rules |
| graph-database | masterPerShard, regionLocalWrites (boolean) | instagram-feed | 1 | single-master write across regions |
| requirements | consistency.quorumScope (region, global) | instagram-feed | 1 | cross-region quorum |
| requirements | availability.headroomPercent (integer) | instagram-feed | 1 | capacity to absorb one datacenter loss |
| group | region.continent (string) | instagram-feed | 1 | cross-ocean edge detection |
| api-gateway | idempotencyKeys (boolean), keyTtlHours (integer) | stripe-payments | 1 | mutating public endpoint without idempotency |
| edge | retryPolicy (none, fixed, exponential, exponential-jitter) | stripe-payments | 1 | retry without backoff/jitter |
| edge | idempotent (boolean) | uber-dispatch, stripe-payments | 2 | retry without idempotency |
| nosql-database | shards (integer), multiTenant (boolean) | stripe-payments | 1 | direct shard access, tenancy |
| requirements | correctness.provable, data.immutableAudit, compliance.pci | stripe-payments | 1 | money store without immutable log |
| group | cell group kind with scope (tenant, az, region, user-shard) | shopify-flash-sale, slack-messaging, amazon-order, robinhood-trading | 4 | shared datastore across cells, cross-cell calls, blast radius |
| nosql-database | quorum (n,r,w), conflictResolution (vector-clock, lww, app-merge), hintedHandoff, antiEntropy, membership (gossip, coordinator), virtualNodes, admissionControl | amazon-order, key-value-store | 2 | quorum, conflict and membership rules |
| requirements | consistency.tunable; availability.staticStability | key-value-store | 1 | quorum overlap rules |
| edge | fallbackPath (boolean), slaP999Ms | amazon-order | 1 | no-fallback policy, aggregator SLAs |
| requirements | availability.percentile; availability.noFallbackPaths; isolation.shuffleSharding | amazon-order | 1 | tail latency and isolation rules |
| queue | role (work, dlq, offline-mailbox, frontier), queryable, tiers (priority, politeness), perHost | robinhood-trading, whatsapp-messaging, web-crawler | 3 | dlq inspectability, crawl politeness |
| cache | structure (bloom-filter, hash-set) | web-crawler, url-shortener | 2 | dedup and seen-set rules |
| requirements | crawl.politeness; crawl.dedupContent; crawl.freshnessDays | web-crawler | 1 | crawler rules |
| stream | topicPerShard, consumerFiltering, connectionProxy | robinhood-trading | 1 | shard-aware consumption |
| requirements | latency.executionMs; availability.discoveryRedundant; traffic.cyclical | robinhood-trading | 1 | execution SLA and discovery redundancy |
| edge | tls (boolean), certificateManaged (boolean) | coinbase-exchange | 1 | internal tls without automated rotation |
| stream | managed (boolean), dedicatedClusterForLatency | coinbase-exchange | 1 | managed dependency health |
| stream | acks (0, 1, all), minInsyncReplicas, uncleanLeaderElection, idempotentProducer, transactions, compaction, retentionHours | distributed-message-queue, slack-messaging, linkedin-kafka | 3 | durability and exactly-once rules |
| requirements | messaging.exactlyOnce; messaging.orderingScope (partition, global); durability.minReplicasAcked | distributed-message-queue | 1 | delivery semantics rules |
| timeseries-database | tiers (hot, warm, cold), retentionRawDays, downsampleIntervals, compression, labelIndex | metrics-monitoring, pinterest-feed | 2 | retention and downsampling rules |
| monitoring | alertGrouping, inhibition, silencing; collector mode (pull, push) | metrics-monitoring | 1 | alerting rules |
| requirements | observability.retentionDays; observability.alertingIndependent; observability.maxCardinality | metrics-monitoring | 1 | monitoring independence rules |
| requirements | security.certificateRotationAutomated; isolation.sensitiveWorkloadsSeparateClusters | coinbase-exchange | 1 | certificate and isolation rules |
| ml-inference | training (batch, online), inputs (live, historical) | google-maps, tiktok-recommendation | 2 | drift and freshness rules |
| workflow-engine | humanReview (boolean) | google-maps | 1 | crowd edits without review |
| edge | aggregatedAnonymised, reviewedBeforePublish | google-maps | 1 | privacy and data trust rules |
| requirements | privacy.telemetryAggregated; data.sourceVetting; data.freshnessWindowDays | google-maps | 1 | privacy and vetting rules |
| sql-database | replicaFanout, intermediateMasters, replicasInsteadOfCache | booking-search | 1 | wide replication rules |
| service-mesh | controlPlanes (integer), hybrid (boolean) | booking-search | 1 | hybrid mesh |
| requirements | security.credentialRotationDays; operations.automationFirst | booking-search, coinbase-exchange | 2 | rotation and automation rules |
| geospatial-index | metric (euclidean, haversine, road-distance, eta), partitionBy, precision, neighbourQuery, rebuildMinutes | grab-geo, proximity-service | 2 | nearby search accuracy, boundary and rebuild rules |
| stream | storage (ephemeral, persistent), azSpread, fetchFromClosestReplica | grab-geo | 1 | broker recovery and cross-AZ cost |
| edge | circuitBreakerScope (service, host), rackAware, latencyPenaltyMs | grab-geo | 1 | breaker granularity, rack-aware latency |
| requirements | cost.crossAzTrafficMinimised; latency.allocationMs | grab-geo | 1 | cost and allocation latency rules |
| id-generator | strategy (counter, counter-batched, hash, snowflake, uuid), batchSize, guessable, layout, epoch, clockRollbackGuard, kSortedBoundMs, central | url-shortener, instagram-feed, discord-messages, unique-id-generator | 4 | id uniqueness, ordering and clock rules |
| requirements | ids.timeSortable; ids.numeric64 | unique-id-generator | 1 | id strategy rules |
| edge | redirectCode (301, 302) | url-shortener | 1 | redirect vs analytics |
| requirements | analytics.perClick; abuse.rateLimited; traffic.readWriteRatio | url-shortener, twitter-timeline | 2 | read-heavy and abuse rules |
| notification-service | channels, dedupKey, templateStore | notification-system | 1 | dedup and channel isolation |
| realtime-gateway | protocol (sse, websocket, grpc-stream), ackIntervalSeconds, sequenceNumbers | notification-system, slack-messaging, whatsapp-messaging | 3 | delivery guarantees on persistent streams |
| edge | ttlSeconds, priority (high, medium, low), ack, compressed | notification-system | 1 | realtime push rules |
| requirements | delivery.exactlyOnceEffect; providers.isolated | notification-system | 1 | dedup and provider isolation |
| cache | tier (core, edge), affinity (none, team, user) | slack-messaging | 1 | edge cache without invalidation stream |
| stream | ackMode (leader, quorum, all) | slack-messaging | 1 | durability vs latency |
| queue | persistence (boolean) | slack-messaging | 1 | queue without durable front |
| app-server | shardingStrategy | uber-dispatch, slack-messaging | 2 | stateful hash ring without ring manager |
| requirements | availability.drainMinutes; latency.deliveryMs | slack-messaging | 1 | drain and fan-out latency rules |
| nosql-database | partitionKey, bucketing (boolean), tombstoneTtlDays | discord-messages | 1 | unbounded partitions, tombstone scans |
| database-proxy | requestCoalescing (boolean) | discord-messages | 1 | hot read path without coalescing |
| edge | batched (boolean), stampedeGuard (boolean) | discord-messages | 1 | fan-out and reconnect storms |
| requirements | traffic.skew (uniform, heavy-tail) | discord-messages | 1 | hot partition rules |
| stream | tier (local, aggregate), brokers, partitions, schemaEnforced | linkedin-kafka | 1 | cross-dc consumers, large cluster without rebalancer |
| stream-processor | stateBackend | linkedin-kafka | 1 | informational |
| requirements | data.schemaGovernance; data.lossDetection; observability.lagMonitoring | linkedin-kafka | 1 | schema registry, audit, lag rules |
| pubsub-topic | topicPerEventType (boolean), retention, channelsPerUser, sharding | spotify-playback, nearby-friends | 2 | isolation per event type, fan-out capacity |
| realtime-gateway | subscriptionsPerUser, drainOnScaleIn | nearby-friends | 1 | stateful scale-in rules |
| requirements | location.updateIntervalSeconds; privacy.friendsOnly | nearby-friends | 1 | location streaming rules |
| stream-processor | windowing (event-time, processing-time), lateDataPolicy, isolationPerType, watermarkSeconds, checkpointIntervalSeconds, dedupBy, exactlyOnce | spotify-playback, ad-click-aggregation | 2 | window, watermark and exactly-once rules |
| data-warehouse | realtime (boolean), upsert (boolean) | ad-click-aggregation, linkedin-kafka | 2 | real-time OLAP serving |
| requirements | correctness.billingGrade; freshness.aggregatesMinutes; data.reconciliation | ad-click-aggregation, stripe-payments | 2 | billing correctness rules |
| sdk-client | resendPolicy | spotify-playback, stripe-payments | 2 | fire-and-forget mobile events |
| requirements | data.completenessWindow; data.maxLatenessMinutes; isolation.perEventType; cost.budgeted | spotify-playback | 1 | completeness and isolation rules |
| load-balancer | layer (4, 7), inKernel, connectionPreserving, hashing (ecmp, maglev, consistent) | cloudflare-edge | 1 | ecmp without connection preservation |
| waf | layer, rulesEngine, cpuGuard (boolean) | cloudflare-edge | 1 | rules engine without cpu guard |
| group | point-of-presence group kind with tier and trafficShare | cloudflare-edge, zoom-video | 2 | site traffic concentration |
| group | provider group kind (colo, aws, oracle, azure) | zoom-video, twitch-live | 2 | hybrid capacity and burst rules |
| media-router | role (ingest, sfu, distribution) | twitch-live, zoom-video | 2 | ingest without routing controller |
| control-plane-coordinator | stateful, optimisation (static, dynamic) | twitch-live | 1 | static optimiser without feedback |
| edge | segmentAligned, rerouteOnFailure | twitch-live | 1 | transcode alignment, origin failover |
| ml-inference | onlineTraining (boolean), embeddingSyncMinutes | tiktok-recommendation | 1 | freshness vs sync cadence |
| stream-processor | lateDataStore (memory, disk-kv) | tiktok-recommendation | 1 | late label handling |
| graph-database | crossRegionConsistency (lww-hlc, single-leader) | tiktok-recommendation | 1 | multi-leader conflict policy |
| requirements | freshness.modelMinutes; reliability.acceptableLossFraction | tiktok-recommendation | 1 | model freshness and snapshot rules |
| media-router | mode (sfu, mcu, p2p), transport, cascading, multiBitrate | zoom-video | 1 | realtime media rules |
| requirements | latency.realtimeMediaMs; availability.burstCapacity | zoom-video | 1 | media and burst rules |
| queue | partitionOwnership (shared, exclusive), isolationPerQueue, fifoScope | pinterest-feed | 1 | shared worker pool, scan contention |
| graph-database | inMemory (boolean), rebuildCadence | pinterest-feed | 1 | in-memory graph without rebuild job |
| sql-database | idEncodesShard (boolean) | pinterest-feed, instagram-feed | 2 | routing without lookup |
| requirements | isolation.perQueue; freshness.recommendationsHours | pinterest-feed | 1 | isolation and freshness rules |
| sql-database | model (relational, eav-kv, jsonb-kv) | reddit-feed | 1 | informational |
| cache | materialised (boolean), batchedAccess (boolean), hashing (none, consistent) | reddit-feed, twitter-timeline | 2 | chatty cache access, cache without consistent hashing |
| requirements | traffic.anonymousShare; data.historyUnbounded | reddit-feed | 1 | cdn and retention rules |
| edge | deployScope (global-at-once, staged), rollbackAutomatic | cloudflare-edge | 1 | global config push without staging |
| requirements | change.stagedRollout; change.automaticRollback; availability.maxTrafficSharePerSite | cloudflare-edge | 1 | change safety rules |
| app-server | instancePerEntity (file, guild, channel), singleWriter (boolean) | figma-multiplayer, discord-messages, slack-messaging | 3 | per-entity stateful process rules |
| sql-database | partitioning (none, vertical, horizontal), shardKeys (list) | figma-multiplayer | 1 | sharding documentation |
| database-proxy | scatterGather, hedging, loadShedding, pooling | figma-multiplayer | 1 | proxy capability rules |
| nosql-database | role (journal, lock, store) | figma-multiplayer | 1 | journal presence rules |
| requirements | durability.maxLossSeconds; consistency.singleWriterPerEntity; latency.geoDistributed | figma-multiplayer | 1 | durability and single-writer rules |
| database-proxy | poolSharded (boolean), clusters (integer) | notion-sharding | 1 | unsharded pool at scale |
| edge | dualWrite, darkRead, reversible (booleans) | notion-sharding, stripe-payments, airbnb-search | 3 | migration safety rules |
| requirements | change.rollbackPath; data.freshnessAnalyticsMinutes | notion-sharding | 1 | migration and lake freshness rules |
| sql-database | multiWriter (boolean), distributed (boolean) | doordash-delivery | 1 | single-writer primary at peak qps |
| rate-limiter | adaptive, scope (user, ip, api-key, concurrency, fleet, worker, edge, in-process, global), algorithm, failMode (open, closed), approximate, placement | doordash-delivery, shopify-flash-sale, discord-messages, rate-limiter | 4 | retry storms, fail-open, race rules |
| edge | fallbackWorkflow (boolean) | doordash-delivery | 1 | event consumer without failure workflow |
| requirements | availability.cascadeContainment | doordash-delivery | 1 | cascade rules |
| search-index | shardingStrategy (geo, hash, time, prefix-range), indexPerShard, structure (inverted, trie), topKPerNode, rebuildCadence | tinder-geo, search-autocomplete | 2 | geo and prefix sharding, freshness rules |
| web-client | localCache (boolean) | search-autocomplete, figma-multiplayer | 2 | keystroke latency rules |
| requirements | latency.keystrokeMs; freshness.suggestionsDays; safety.suggestionFiltering | search-autocomplete | 1 | typeahead rules |
| geospatial-index | scheme (s2, h3, geohash), cellLevels | tinder-geo, uber-dispatch | 2 | informational |
| edge | orderedByKey (boolean) | tinder-geo, linkedin-kafka | 2 | shard move without ordered writes |
| requirements | locality.radiusMiles; consistency.readAfterWrite | tinder-geo | 1 | locality and read-after-write rules |
| sql-database | shardKey (string) | shopify-flash-sale | 1 | sharding documentation, hot-shard rules |
| rate-limiter | algorithm, windowSeconds, fairness | shopify-flash-sale | 1 | write burst without admission control |
| requirements | tenancy.isolation (shared, cell, dedicated); traffic.peakMultiplier | shopify-flash-sale | 1 | tenant isolation and burst rules |
| edge | circuitBreaker (boolean) | netflix-streaming, shopify-flash-sale | 2 | sync edge without breaker |
| app-server | ownsData (boolean), layer (presentation, middle-tier, derived-data, data) | airbnb-search | 1 | shared database across services |
| cache | invalidation (ttl, event, none) | airbnb-search, netflix-streaming | 2 | ttl-only cache under freshness target |
| requirements | data.ownershipExclusive; freshness.maxSeconds; authorization.centralised | airbnb-search | 1 | data ownership and freshness rules |
| edge | hedged / backupRequests (boolean) | uber-dispatch | 1 | fan-out sync without tail-latency strategy |
| edge | fallback (none, static, cached, degraded) | netflix-streaming | 1 | critical dependency without fallback |
| edge | timeoutMs (integer) | netflix-streaming | 1 | sync edge without timeout under latency target |
| requirements | availability.mustSurviveDatacenterLoss | uber-dispatch | 1 | stateful node without recovery path |
| requirements | availability.regions (integer) | netflix-streaming | 1 | fewer region groups than required |
| requirements | availability.degradedModeAllowed | netflix-streaming | 1 | fallbacks expected |
| requirements | consistency.model (ap, cp) | uber-dispatch, netflix-streaming | 2 | strong-consistency datastore in AP design |

| sql-database | concurrencyControl (pessimistic, optimistic, constraint), checkConstraints (boolean) | hotel-reservation | 1 | reservation write without concurrency control |
| cache | ttlStrategy (fixed, learned, none), dataScope | hotel-reservation, agoda price cache | 1 | stale price without confirmation |
| third-party-api | qpsQuota (integer), quotaScope (global, per-datacenter) | hotel-reservation | 1 | supplier calls without quota limiter |
| workflow-engine | graph (static, dynamic), compensation (boolean) | hotel-reservation | 1 | cross-service write without saga |
| requirements | inventory.overbookingPercent; inventory.noDoubleBooking; pricing.stalenessAllowed | hotel-reservation | 1 | inventory rules |
| nosql-database | denormalised (boolean) | distributed-email | 1 | read-status per folder |
| queue | retryBackoff (boolean), bounceHandling (boolean) | distributed-email | 1 | outbound delivery to external mx |
| search-index | indexing (sync, async) | distributed-email | 1 | sync indexing on hot write path |
| app-server | replication (master-replica), slotsPerStore, failoverSeconds | distributed-email | 1 | stateful mail store failover |
| dns | records (mx, spf, dkim, dmarc) | distributed-email | 1 | sender auth records |
| requirements | integrity.checksums; isolation.perUserBlastRadius; email.spamBlockRate | distributed-email | 1 | isolation and integrity rules |
| object-store | replication (none, primary-secondary, quorum), scheme (rs-10-4, 8+4), expansionFactor, tier (hot, warm, cold), smallObjectPacking, checksumOnWrite, versioning, objectLock, strongReadAfterWrite, zones (integer) | object-storage, google-drive | 2 | durability, tiering and delete-protection rules |
| control-plane-coordinator | consensus (raft, paxos) | object-storage | 1 | placement without consensus |
| cache | readBarrier (boolean) | object-storage | 1 | cache over strong store without barrier |
| requirements | durability.designedNotMeasured; consistency.readAfterWrite; data.deleteProtection (versioning, lock) | object-storage | 1 | durability and consistency rules |
| ledger | doubleEntry, appendOnly, tamperEvident (booleans) | payment-system, stripe-payments | 2 | money store rules |
| queue | backoff (exponential, fixed, none), maxAttempts; role retry | payment-system | 1 | retry queue rules |
| third-party-api | idempotent (boolean), hostedPage (boolean), callbackStyle (webhook, poll) | payment-system | 1 | pci and idempotency rules |
| webhook-endpoint | signatureVerified, idempotent (booleans) | payment-system | 1 | webhook hardening |
| workflow-engine | stepsIdempotent (boolean) | payment-system | 1 | retryable DAG |
| requirements | correctness.exactlyOnceEffect; money.zeroSum | payment-system, notification-system | 2 | exactly-once effect rules |
| event-store | replication (raft, none), snapshotIntervalEvents, storage (mmap, rocksdb) | digital-wallet | 1 | replicated log and snapshot rules |
| ledger | sealed, signed, indexConsistency (strong, eventual), tiering | digital-wallet | 1 | tamper evidence and index cost |
| workflow-engine | pattern (saga, tcc, 2pc, dag) | digital-wallet, payment-system | 2 | cross-shard money move rules |
| worker | rateControl (aimd, fixed, none) | digital-wallet | 1 | backfill protection |
| sql-database | commitProtocol (single, 2pc) | digital-wallet | 1 | blocking coordinator |
| requirements | correctness.reproducible; correctness.tamperEvident; consistency.readYourWrite | digital-wallet | 1 | audit and replay rules |
| matching-engine | singleThreaded, deterministic, algorithm (price-time, pro-rata), role (primary, standby), failover (automatic, manual) | stock-exchange, coinbase-exchange | 2 | standby and determinism rules |
| realtime-gateway | transport (websocket, udp-multicast), feeds (a/b), sequenceNumbers (boolean) | stock-exchange | 1 | multicast gap-fill rules |
| network-fabric | multicast, kernelBypass (booleans) | stock-exchange | 1 | fairness and latency |
| api-gateway | protocol (fix, ouch, http) | stock-exchange | 1 | informational |
| app-server | inProcess, noIoOnCriticalPath (booleans) | stock-exchange | 1 | critical path rules |
| requirements | latency.p99Us; fairness.simultaneousDelivery; determinism.replayable | stock-exchange | 1 | microsecond and fairness rules |

# Rule candidates

| Rule id | Condition (one line) | Seen in | Severity |
|---|---|---|---|
| stateful-service-without-sharding | app-server stateless false and no shardingStrategy | uber-dispatch | warning |
| retry-without-idempotency | at-least-once edge into node that does not declare idempotent | uber-dispatch | error |
| sql-primary-without-replica-at-scale | sql-database replication none and design rps above threshold | uber-dispatch | error |
| fanout-sync-without-hedging | node with more than N sync out-edges and no hedging declared | uber-dispatch | warning |
| no-recovery-path-for-stateful-node | stateful app-server with no edge to a datastore | uber-dispatch | error |
| critical-dependency-without-fallback | sync edge into criticality high app-server with fallback none | netflix-streaming | error |
| cache-single-zone-in-multi-az-design | cache replication single-az while multiRegion or regions > 1 | netflix-streaming | error |
| stateful-node-without-zone-redundancy | stateless false and in exactly one availability-zone | netflix-streaming, uber-dispatch | error |
| sync-edge-without-timeout | sync edge with no timeoutMs while latency.p95Ms exists | netflix-streaming | warning |
| object-store-single-zone-with-durability-target | object-store zones below 3 while durability.annualNines >= 11 | google-drive, object-storage | error |
| notification-without-reconcile-path | push-service to client with no pull edge from client back to source of truth | google-drive | error |
| metadata-and-blob-in-same-store | file bytes and file metadata in one datastore | google-drive | warning |
| blocking-call-into-partitioned-service | sync blocking edge from realtime-gateway into partitioned stateful service | whatsapp-messaging | warning |
| shared-queue-for-reads-and-writes | one queue node receives both read and write traffic from a gateway | whatsapp-messaging | warning |
| connection-server-without-push-fallback | realtime-gateway serving mobile clients with no notification-service edge | whatsapp-messaging | error |
| offline-store-without-eviction | queue used as offline mailbox with no retention or eviction | whatsapp-messaging | warning |
| cache-ttl-without-jitter | cache evictionPolicy ttl, ttlJitter false, high rps | youtube-upload-playback | warning |
| read-replica-as-sole-scaling | sql-database async replicas, not sharded, rps above threshold | youtube-upload-playback, uber-dispatch | warning |
| cdn-absent-for-global-static | object-store serves clients directly, no cdn, global traffic | youtube-upload-playback | warning |
| push-fanout-without-celebrity-path | worker fanoutStrategy push, no fanoutThreshold, graph-database present | twitter-timeline, news-feed | warning |
| fanout-inline-in-request-path | fanout edge sync from post API instead of via queue | news-feed, instagram-feed | warning |
| materialised-cache-without-rebuild-path | cache with listCap and no edge to durable store | twitter-timeline | error |
| scatter-gather-without-timeout | scatter-gather app-server with sync edges lacking timeoutMs | twitter-timeline, netflix-streaming | warning |
| cache-as-primary-store-without-persistence | cache usedAsPrimaryStore true, persistence false | instagram-feed | error |
| cross-region-quorum | quorum-consistency datastore whose replicas span regions on different continents | instagram-feed | warning |
| single-master-write-across-regions | single-master store receiving sync writes from another region | instagram-feed | warning |
| mutating-public-endpoint-without-idempotency | api-gateway with external POST edges and idempotencyKeys false | stripe-payments | error |
| retry-without-backoff-jitter | edge retryPolicy exponential without jitter at high rps | stripe-payments, youtube-upload-playback | warning |
| external-money-movement-without-reconciliation | third-party-api payment edge with no ledger or reconciliation node | stripe-payments | error |
| money-store-without-immutable-log | compliance.pci or correctness.provable set and no event-log node | stripe-payments | error |
| direct-shard-access | app-server edge to sharded store bypassing an existing database-proxy | stripe-payments | warning |
| shared-datastore-across-cells | tenancy.isolation cell and a datastore node outside every cell group | shopify-flash-sale | error |
| single-shared-queue-across-cells | one queue or cache used by all cells (Redismageddon) | shopify-flash-sale | error |
| write-burst-without-admission-control | high peakMultiplier and client write edges with no rate-limiter in path | shopify-flash-sale | warning |
| shared-database-across-services | two app-servers write to one sql-database while data.ownershipExclusive true | airbnb-search | error |
| derived-store-without-cdc-or-rebuild | search-index or derived store with no stream/CDC in-edge and no batch rebuild edge | airbnb-search, twitter-timeline | error |
| ttl-cache-under-freshness-target | cache invalidation ttl with ttlSeconds above freshness.maxSeconds | airbnb-search | warning |
| cross-cell-call | sync edge between nodes in different cell groups while blastRadius is cell | slack-messaging, shopify-flash-sale | error |
| queue-without-durable-front | non-persistent queue receiving producers directly at high rps | slack-messaging | warning |
| stateful-hash-ring-without-ring-manager | consistent-hash app-server with no sharding-coordinator | slack-messaging, uber-dispatch | warning |
| edge-cache-without-invalidation-stream | edge-tier cache with no async in-edge from core | slack-messaging | warning |
| wide-column-store-without-partition-bound | wide-column store, heavy-tail traffic, partitionKey without time bucket | discord-messages | error |
| delete-heavy-store-without-tombstone-policy | nosql-database with delete edges and no tombstoneTtlDays | discord-messages | warning |
| hot-read-path-without-coalescing | heavy-tail reads to nosql-database with no coalescing proxy | discord-messages | warning |
| reconnect-stampede-without-guard | realtime-gateway sync lookup into small coordinator with no stampedeGuard | discord-messages, whatsapp-messaging, chat-system | error |
| large-group-push-fanout | group fan-out with push for groups above pull threshold | chat-system, discord-messages | warning |
| stateful-gateway-without-discovery | realtime-gateway with no service-registry or coordinator edge | chat-system | warning |
| keystroke-path-without-local-or-edge-cache | typeahead read path with keystrokeMs target and no local or edge cache | search-autocomplete | warning |
| prefix-shards-without-rebalancer | prefix-range sharded search-index with no range coordinator | search-autocomplete | warning |
| suggestions-without-safety-filter | suggestion index served to clients with no filtering stage while safety filtering required | search-autocomplete | error |
| quorum-overlap-violation | nosql-database r + w not greater than n while readAfterWrite required | key-value-store | error |
| single-failure-detector | cluster membership through one coordinator with no gossip or replicated coordination | key-value-store | warning |
| central-id-generator-single-point | central id-generator with one node and no failover | unique-id-generator, url-shortener | error |
| snowflake-without-clock-guard | snowflake id-generator with clockRollbackGuard false | unique-id-generator | warning |
| time-sortable-ids-required-but-uuid | ids.timeSortable true while strategy uuid | unique-id-generator | warning |
| crawler-without-per-host-politeness | fetcher to external hosts with no per-host queue or gap while crawl.politeness true | web-crawler | error |
| frontier-without-trap-guards | url filter lacking depth or length limits | web-crawler | warning |
| central-url-server | single frontier node feeding many fetchers with no partitioning | web-crawler | warning |
| cell-query-without-neighbours | radius search on geospatial-index with neighbourQuery false | proximity-service | warning |
| in-memory-index-rebuild-without-swap | in-memory geospatial-index rebuilt with no blue-green or replica swap | proximity-service, pinterest-feed | warning |
| business-updates-without-index-propagation | writes to source of truth with no edge to derived index or cache invalidation | proximity-service, airbnb-search | warning |
| lossy-pubsub-for-guaranteed-delivery | at-most-once pubsub feeding edges that require delivery | nearby-friends | error |
| stateful-websocket-scale-in-without-drain | realtime-gateway autoscaling with no connection draining | nearby-friends, slack-messaging | warning |
| location-cache-without-ttl | live location cache without ttl eviction | nearby-friends | warning |
| exactly-once-claimed-without-idempotent-producer | exactly-once edge into stream lacking idempotentProducer or transactions | distributed-message-queue | error |
| acks-all-without-min-isr | stream acks all with minInsyncReplicas 1 | distributed-message-queue | warning |
| global-ordering-on-multi-partition-topic | orderingScope global with partitions above 1 and unkeyed producers | distributed-message-queue | error |
| exactly-once-with-external-side-effects | exactly-once consumer with sync edges to external systems | distributed-message-queue, stripe-payments | warning |
| monitoring-dependent-on-monitored-system | monitoring nodes depend synchronously on the datastores or queues they observe | metrics-monitoring | error |
| collector-writes-tsdb-directly-without-buffer | high-rate collector to timeseries-database with no stream buffer | metrics-monitoring, pinterest-feed | warning |
| alerts-without-notification-fallback | alert manager with a single notification channel | metrics-monitoring | warning |
| billing-aggregation-without-exactly-once-or-reconciliation | billingGrade pipeline with neither exactlyOnce nor reconciliation job | ad-click-aggregation | error |
| windowed-aggregation-without-watermark | event-time windowed stream-processor with no watermark | ad-click-aggregation, spotify-playback | warning |
| aggregation-job-single-instance | critical stream-processor with one instance and no failover | ad-click-aggregation | error |
| stream-without-schema-registry | many producers into stream, no schema-registry, schemaGovernance true | linkedin-kafka | warning |
| cross-dc-consumers-on-local-tier | consumer in another region reads local-tier stream with no mirroring worker | linkedin-kafka | warning |
| stream-consumers-without-lag-monitoring | stream with consumers and no monitoring node observing offsets | linkedin-kafka | warning |
| at-least-once-pipeline-without-audit | multi-hop at-least-once pipeline, lossDetection true, no reconciliation node | linkedin-kafka, stripe-payments | warning |
| shared-pipeline-across-event-types | one stream-processor consumes many event types while isolation.perEventType true | spotify-playback | warning |
| at-least-once-ingest-without-dedup | at-least-once ingest edge with no dedup stage | spotify-playback | warning |
| fire-and-forget-mobile-events | sdk-client to ingest API with resendPolicy none | spotify-playback | warning |
| batch-warehouse-as-single-persistence | pipeline whose only durable node is the warehouse (Hadoop SPOF) | spotify-playback | error |
| global-config-push-without-staging | config edge deployScope global-at-once while change.stagedRollout true | cloudflare-edge | error |
| rules-engine-without-cpu-guard | waf with regex rules engine and cpuGuard false | cloudflare-edge | warning |
| site-traffic-concentration | PoP or region trafficShare above availability.maxTrafficSharePerSite | cloudflare-edge | warning |
| ecmp-without-connection-preservation | load-balancer hashing ecmp with persistent client connections | cloudflare-edge | warning |
| stateful-per-entity-process-without-journal | instancePerEntity app-server with checkpoint edge only while durability.maxLossSeconds is below checkpoint interval | figma-multiplayer | error |
| single-writer-without-lock | app-server singleWriter true with no coordination-service lock edge | figma-multiplayer | error |
| single-region-core-with-global-users | latency.geoDistributed true and all realtime-gateway nodes in one region | figma-multiplayer, instagram-feed | warning |
| connection-pool-unsharded-at-scale | database-proxy pooling true, poolSharded false, physicalShards above threshold | notion-sharding | warning |
| migration-without-reversible-replication | migration edge reversible false while change.rollbackPath true | notion-sharding | error |
| online-read-from-analytics-lake | app-server reads object-store lake while online freshness target is seconds | notion-sharding | warning |
| retry-without-adaptive-shedding | retrying edges into a service with no rate-limiter or circuit breaker | doordash-delivery, stripe-payments | error |
| single-writer-primary-at-peak-qps | sql-database multiWriter false, sharded false, stated qps above threshold | doordash-delivery, uber-dispatch, youtube-upload-playback | error |
| event-consumer-without-failure-workflow | async consumer creating business entities with no fallbackWorkflow and no dlq | doordash-delivery | warning |
| stream-sink-without-durable-buffer | stream-processor to warehouse with no object-store buffer while lossDetection true | doordash-delivery, spotify-playback | warning |
| geo-search-without-geo-sharding | location-query search-index unsharded while locality.radiusMiles small and users large | tinder-geo | warning |
| shard-move-without-ordered-writes | entity migration between shards with update edges lacking orderedByKey | tinder-geo | error |
| long-lived-grpc-without-client-side-balancing | persistent grpc service edges with no service-mesh sidecar on kubernetes | tinder-geo | warning |
| realtime-media-over-tcp-only | media-router edge transport tcp only while latency.realtimeMediaMs set | zoom-video | warning |
| global-meeting-without-cascade | media-routers in several PoPs with no peer cascade edges | zoom-video | warning |
| single-provider-without-burst | all media capacity in one provider group while availability.burstCapacity true | zoom-video | warning |
| shared-worker-pool-across-queues | several queues feed one worker pool while isolation.perQueue true | pinterest-feed, whatsapp-messaging | warning |
| queue-scan-across-all-shards | queue on sharded store with partitionOwnership shared | pinterest-feed | warning |
| in-memory-graph-without-rebuild-job | graph-database inMemory with no scheduled rebuild edge | pinterest-feed | error |
| anonymous-traffic-without-cdn | traffic.anonymousShare high and no cdn node in path | reddit-feed | warning |
| unbounded-history-without-expiry | datastore with historyUnbounded and no retention or archival edge | reddit-feed | warning |
| counter-writes-without-queue | high-rate counter writes (votes) synchronously into sql-database with no queue | reddit-feed | warning |
| cache-without-consistent-hashing | multi-node cache with hashing none | reddit-feed | warning |
| shared-host-per-channel-without-isolation | realtime-gateway assigns channels randomly to hosts, heavy-tail traffic, no hashing or isolation | twitch-live, discord-messages, slack-messaging | error |
| ingest-without-routing-controller | ingest media-router forwards to origins with no capacity-aware coordinator | twitch-live | warning |
| origin-failure-without-reroute | origin PoPs with no rerouteOnFailure path from ingest | twitch-live | error |
| serving-params-without-snapshot | in-memory model or parameter store with no snapshot edge to object-store | tiktok-recommendation | error |
| multi-leader-store-without-conflict-policy | multi-region multi-leader store with no declared conflict resolution | tiktok-recommendation, instagram-feed, key-value-store | warning |
| freshness-target-below-sync-cadence | freshness.modelMinutes below embeddingSyncMinutes | tiktok-recommendation | warning |
| fallback-path-under-no-fallback-policy | edge fallbackPath true while availability.noFallbackPaths true | amazon-order | error |
| aggregator-fanout-without-per-dependency-sla | app-server with large sync fan-out and edges lacking timeoutMs or slaP999Ms | amazon-order, netflix-streaming | warning |
| multi-tenant-pool-without-shuffle-sharding | shared worker pool for many tenants, shuffleSharding false, isolation.shuffleSharding true | amazon-order | warning |
| order-workflow-without-durable-engine | order creation chained synchronously with no workflow-engine or queue | amazon-order, doordash-delivery | warning |
| shared-dependency-without-redundancy | single dns or coordination node while availability.discoveryRedundant true | robinhood-trading, cloudflare-edge | error |
| execution-sla-vs-hop-count | latency.executionMs set and async hops to execution above threshold | robinhood-trading | warning |
| internal-tls-without-automated-rotation | internal tls edges while security.certificateRotationAutomated false | coinbase-exchange | error |
| stateful-engine-pinned-to-single-zone | matching-engine or single-writer node in one availability-zone with no failover | coinbase-exchange, netflix-streaming, stock-exchange | error |
| managed-dependency-without-independent-health-check | managed stream or datastore with no provider-independent monitoring edge | coinbase-exchange | warning |
| raw-location-telemetry-without-aggregation | client telemetry edge not aggregatedAnonymised while privacy.telemetryAggregated true | google-maps | error |
| crowd-edits-published-without-review | user-contributed edge into system of record without reviewedBeforePublish | google-maps | warning |
| model-on-stale-history-under-drift | ml-inference on historical inputs with no re-weighting window while freshnessWindowDays set | google-maps | warning |
| wide-replication-without-relay | sql-database replicaFanout high with intermediate masters and no relay proxy | booking-search | warning |
| credentials-without-rotation | datastore edges with static credentials and no rotation policy | booking-search, coinbase-exchange | warning |
| large-fleet-without-automated-failover | many sql-database clusters and no failover coordinator | booking-search | warning |
| stateful-broker-on-ephemeral-storage | stream broker on ephemeral storage with no reattachable volume and RF below 3 | grab-geo | error |
| rack-aware-fetch-on-latency-critical-stream | consumer edge rackAware while latency target below added penalty | grab-geo | warning |
| permanent-redirect-with-click-analytics | redirect edge 301 while analytics.perClick true | url-shortener | warning |
| single-counter-without-batching-or-failover | counter id-generator with no batching and no replicated coordinator | url-shortener | warning |
| read-heavy-path-without-cache | high readWriteRatio and read edges to datastore with no cache in path | url-shortener, youtube-upload-playback | warning |
| limiter-fail-closed-on-critical-path | rate-limiter failMode closed in front of critical gateway | rate-limiter | error |
| shared-counter-without-atomic-ops | multi-node rate-limiter counter store with atomicOps none | rate-limiter | warning |
| no-concurrency-limit-on-expensive-endpoints | gateway with CPU-heavy endpoints and only per-rate limiter | rate-limiter | warning |
| notification-without-dedup | at-least-once channel queue to provider with no dedup store while exactlyOnceEffect true | notification-system | error |
| shared-queue-across-channels | one queue feeds all notification providers while providers.isolated true | notification-system | warning |
| realtime-push-without-ttl-or-priority | realtime-gateway message edges lacking ttlSeconds or priority | notification-system | warning |
| failed-delivery-not-logged | worker to provider edge with no notification log write | notification-system | error |
| reservation-write-without-concurrency-control | inventory database with no concurrencyControl while noDoubleBooking true | hotel-reservation | error |
| inventory-cache-without-authoritative-check | booking path reads cache only, no sync edge to inventory db before commit | hotel-reservation | error |
| cross-service-write-without-saga-or-shared-db | reservation and inventory in separate dbs with no compensation workflow | hotel-reservation | warning |
| supplier-calls-without-quota-limiter | sync edges to quota-limited third-party-api with no rate-limiter or scheduler | hotel-reservation | warning |
| cached-price-without-confirmation-step | cached prices sold without supplier confirmation edge | hotel-reservation | warning |
| blobs-in-wide-column-store | nosql-database carries attachment payloads with no object-store present | distributed-email | warning |
| inbound-smtp-without-scanner | inbound mail-transfer-agent writes to storage with no content-scanner on path | distributed-email | error |
| outbound-queue-without-retry-or-bounce | outgoing queue to external mail exchangers without retryBackoff or bounce handling | distributed-email | error |
| search-index-sync-on-write-path | search-index indexing sync on high write rate path | distributed-email | warning |
| shared-storage-pool-for-isolated-tenants | perUserBlastRadius true while stores share one block-storage node | distributed-email | warning |
| object-store-without-integrity-audit | object-store with durability target and no auditor scheduled-job | object-storage | warning |
| erasure-coded-tier-serving-hot-reads | warm erasure-coded tier receiving high-rps sync reads | object-storage | warning |
| async-replication-under-durability-target | object-store replicationAck async while annualNines >= 11 | object-storage | error |
| cache-in-front-of-strong-store-without-barrier | cache over metadata store with readAfterWrite true and readBarrier false | object-storage | error |
| object-store-without-delete-protection | deleteProtection required, versioning and objectLock false | object-storage | warning |
| money-mutation-without-idempotency-key | money edge to third-party-api or ledger with idempotencyKey false while exactlyOnceEffect true | payment-system, stripe-payments, hotel-reservation | error |
| retry-queue-without-dlq | queue role retry with no dlq edge | payment-system | error |
| retry-without-backoff | retry queue with backoff none | payment-system | warning |
| money-store-without-double-entry-ledger | money.zeroSum true and no ledger kind | payment-system, stripe-payments | error |
| card-data-through-platform | pci required and client sends card data to app-server not hostedPage | payment-system | error |
| webhook-without-signature-or-idempotency | webhook-endpoint from PSP lacking signatureVerified or idempotent | payment-system | error |
| settlement-without-reconciliation-job | settlement files arrive with no scheduled-job reconciling to ledger | payment-system | warning |
| balance-store-not-durable | money balances on cache with persistence false | digital-wallet | error |
| cross-shard-money-move-without-transaction-pattern | transfer across two sharded stores with no saga, tcc or 2pc coordinator | digital-wallet | error |
| reproducible-required-without-event-store | correctness.reproducible true and no event-store or ledger | digital-wallet | error |
| event-store-without-snapshots | high-rate event-store with no snapshot store edge | digital-wallet | warning |
| replicated-log-single-node | event-store replication none while durability required | digital-wallet | error |
| ledger-without-sealing-under-tamper-evidence | tamperEvident true and ledger sealed false | digital-wallet | warning |
| critical-path-crosses-process-boundary-under-microsecond-latency | latency.p99Us set and sync order-path edges leave the process | stock-exchange | warning |
| matching-engine-without-standby | primary matching-engine with no standby consuming the same sequenced stream | stock-exchange | error |
| sequenced-stream-without-journal | sequencer or event-store journaled false while replayable true | stock-exchange | error |
| multicast-feed-without-gap-fill | udp-multicast realtime-gateway with no retransmission worker or sequence numbers | stock-exchange | error |
| unicast-fanout-under-fairness-requirement | simultaneousDelivery true and market data edges unicast | stock-exchange | warning |
| io-inside-deterministic-engine | matching-engine with sync edges to databases or third-party-api | stock-exchange | error |
