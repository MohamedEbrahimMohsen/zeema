# meta-threads

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_threads_app["Threads iOS / Android<br/><i>mobile-app</i>"]
  subgraph n_g_meta_region["Meta datacenter region (region)"]
    subgraph n_g_product_tier["Instagram-shared product tier (trust-zone)"]
      n_django_api["Threads / Instagram Django tier<br/><i>container-service</i>"]
      n_meta_monolith["Meta monolith (HHVM / Hack, GraphQL)<br/><i>container-service</i>"]
      n_instagram_identity["Instagram login / privacy / security / integrity<br/><i>container-service</i>"]
      n_feed_ranking["Feed ranking and feed state<br/><i>container-service</i>"]
      n_search_service["Keyword search (deferred past launch)<br/><i>container-service</i>"]
      n_threads_federation["ActivityPub federation (2024)<br/><i>container-service</i>"]
      n_notification_service["Notification system<br/><i>notification-platform</i>"]
    end
    subgraph n_g_data_plane["Meta internal data plane (trust-zone)"]
      n_tao["TAO<br/><i>tao</i>"]
      n_mysql["MySQL (MySQL Raft / FlexiRaft)<br/><i>mysql</i>"]
      n_zippydb["ZippyDB (counters, feed ranking/state, search)<br/><i>nosql-store</i>"]
      n_shardmanager["ShardManager<br/><i>apache-helix</i>"]
      n_akkio["Akkio<br/><i>container-worker</i>"]
      n_configerator["Configerator<br/><i>container-service</i>"]
      n_launch_dashboards["ODS / Scuba<br/><i>observability-stack</i>"]
    end
    subgraph n_g_async_platform["Async / XFaaS (system)"]
      n_xfaas_submitter["Async submitter<br/><i>container-service</i>"]
      n_queue_lb["QueueLB<br/><i>load-balancer-tier</i>"]
      n_durableq["DurableQ<br/><i>message-queue</i>"]
      n_xfaas_scheduler["Async scheduler (FuncBuffers, RunQ)<br/><i>container-service</i>"]
      n_worker_lb["WorkerLB<br/><i>load-balancer-tier</i>"]
      n_xfaas_worker["XFaaS worker pool (per namespace)<br/><i>container-worker</i>"]
      n_central_rate_limiter["Central Rate Limiter<br/><i>envoy-ratelimit</i>"]
      n_xfaas_controllers["Global Traffic Conductor / Locality Optimizer / Utilization Controller<br/><i>container-service</i>"]
    end
  end
  subgraph n_g_fediverse["Fediverse (external ActivityPub servers) (trust-zone)"]
    n_fediverse_servers["External ActivityPub servers<br/><i>supplier-api</i>"]
  end
  n_threads_app -->|"REST, Instagram's API surface reused [https]"| n_django_api
  n_threads_app -->|"GraphQL for parts of the experience [https]"| n_meta_monolith
  n_django_api -->|"sign in with the Instagram account [thrift]"| n_instagram_identity
  n_django_api -->|"posts, replies and the follow graph [thrift]"| n_tao
  n_django_api -->|"counters [thrift]"| n_zippydb
  n_django_api -->|"rank the home feed [thrift]"| n_feed_ranking
  n_django_api -->|"keyword search [thrift]"| n_search_service
  n_django_api -.->|"publish an opted-in public post [thrift, at-least-once]"| n_threads_federation
  n_feed_ranking -->|"feed ranking and feed state keyspace [thrift]"| n_zippydb
  n_search_service -->|"search keyspace [thrift]"| n_zippydb
  n_tao -->|"leader cache to one database per shard [mysql]"| n_mysql
  n_shardmanager -.->|"epoch lease leadership, renewed by heartbeat [internal, at-least-once]"| n_zippydb
  n_akkio -.->|"move micro-shards to the region that reads them [internal, at-least-once]"| n_zippydb
  n_configerator -.->|"logical-to-physical shard map, live config change [config, at-least-once]"| n_zippydb
  n_configerator -.->|"source-region to destination-region policy [config, at-least-once]"| n_queue_lb
  n_configerator -.->|"region-to-region traffic matrix [config, at-least-once]"| n_xfaas_scheduler
  n_configerator -.->|"locality groups [config, at-least-once]"| n_worker_lb
  n_xfaas_controllers -.->|"traffic matrix, locality groups, utilisation multiplier [internal, at-least-once]"| n_configerator
  n_django_api -.->|"follow import and notification jobs, non-blocking [thrift, at-least-once]"| n_xfaas_submitter
  n_xfaas_submitter -->|"global per-function usage check [thrift]"| n_central_rate_limiter
  n_xfaas_submitter -->|"batched writes, oversized arguments spilled to a key-value store [thrift]"| n_queue_lb
  n_queue_lb -->|"sharded by random UUID, may cross regions [thrift]"| n_durableq
  n_durableq -.->|"poll calls whose start time has passed; ACK removes, NACK or timeout redelivers [thrift, at-least-once]"| n_xfaas_scheduler
  n_xfaas_scheduler -->|"reserved and opportunistic quota [thrift]"| n_central_rate_limiter
  n_xfaas_scheduler -->|"RunQ dispatch, criticality then execution deadline [thrift]"| n_worker_lb
  n_worker_lb -->|"power of two random choices inside the locality group [thrift]"| n_xfaas_worker
  n_xfaas_worker -->|"the imported follows land on the social graph [thrift]"| n_tao
  n_xfaas_worker -.->|"notification fan-out, rate limited by Async [thrift, at-least-once]"| n_notification_service
  n_notification_service -.->|"follow and activity notifications [push, at-most-once]"| n_threads_app
  n_tao -.->|"back-pressure exceptions, AIMD on the caller's RPS [internal, at-most-once]"| n_central_rate_limiter
  n_django_api -.->|"time to new content, QPS and success rate [https, at-most-once]"| n_launch_dashboards
  n_xfaas_scheduler -.->|"async job queue lengths [https, at-most-once]"| n_launch_dashboards
  n_zippydb -.->|"launch-day metrics [https, at-most-once]"| n_launch_dashboards
  n_threads_federation -.->|"ActivityPub S2S, opted-in public profiles aged 18+ [https, at-least-once]"| n_fediverse_servers
  n_fediverse_servers -.->|"inbound replies, phased in after the initial release [https, at-least-once]"| n_threads_federation
```
