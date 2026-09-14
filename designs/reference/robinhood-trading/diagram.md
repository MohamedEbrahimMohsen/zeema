# robinhood-trading

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_mobile_client["Robinhood app<br/><i>mobile-app</i>"]
  n_execution_venues["Market makers, exchanges, clearing<br/><i>supplier-api</i>"]
  subgraph n_g_aws_us_east["AWS (region)"]
    subgraph n_g_edge["Public edge (trust-zone)"]
      n_public_lb["Public load balancer<br/><i>load-balancer-tier</i>"]
      n_routing_layer["Routing layer<br/><i>envoy-gateway</i>"]
    end
    subgraph n_g_platform["Shared platform (trust-zone)"]
      n_shard_mapping["Shard mapping service<br/><i>apache-helix</i>"]
      n_aggregation_layer["Aggregation layer<br/><i>container-service</i>"]
      n_internal_api_proxy["Internal API proxy<br/><i>envoy-gateway</i>"]
      n_settlements["Settlements<br/><i>container-service</i>"]
      n_kafkaproxy["Kafkaproxy sidecar<br/><i>envoy-sidecar</i>"]
      n_order_kafka["Kafka clusters<br/><i>kafka</i>"]
      n_failed_event_store["Postgres-backed failed-event store<br/><i>message-queue</i>"]
      n_stream_processing["Faust and Flink<br/><i>flink</i>"]
      n_shard_cdc["Debezium CDC<br/><i>debezium</i>"]
      n_data_lake["Data lake<br/><i>blob-store</i>"]
      n_logging["WarpStream logging<br/><i>warpstream</i>"]
      n_service_dns["Internal service discovery<br/><i>dns-resolver</i>"]
    end
    subgraph n_g_shard_1["Shard 1 (cell)"]
      n_brokerage_service_1["Brokerage services, shard 1<br/><i>container-service</i>"]
      n_shard_cache_1["Memcache, shard 1<br/><i>memcached</i>"]
      n_shard_db_1["Postgres, shard 1<br/><i>postgres</i>"]
    end
    subgraph n_g_shard_2["Shard 2 (cell)"]
      n_brokerage_service_2["Brokerage services, shard 2<br/><i>container-service</i>"]
      n_shard_cache_2["Memcache, shard 2<br/><i>memcached</i>"]
      n_shard_db_2["Postgres, shard 2<br/><i>postgres</i>"]
    end
  end
  n_mobile_client -->|"https"| n_public_lb
  n_public_lb -->|"per-user request [http]"| n_routing_layer
  n_public_lb -->|"cross-shard read [http]"| n_aggregation_layer
  n_routing_layer -->|"user to shard lookup [grpc]"| n_shard_mapping
  n_routing_layer -->|"service discovery [udp]"| n_service_dns
  n_routing_layer -->|"route to owning shard [http]"| n_brokerage_service_1
  n_routing_layer -->|"route to owning shard [http]"| n_brokerage_service_2
  n_aggregation_layer -->|"fan-out, merge on cursor [http]"| n_brokerage_service_1
  n_aggregation_layer -->|"fan-out, merge on cursor [http]"| n_brokerage_service_2
  n_brokerage_service_1 -->|"one query per request [postgres]"| n_shard_db_1
  n_brokerage_service_1 -->|"staleness-tolerant reads [memcached]"| n_shard_cache_1
  n_brokerage_service_2 -->|"one query per request [postgres]"| n_shard_db_2
  n_brokerage_service_2 -->|"staleness-tolerant reads [memcached]"| n_shard_cache_2
  n_brokerage_service_1 -->|"service discovery [udp]"| n_service_dns
  n_brokerage_service_1 -->|"shared component call [http]"| n_internal_api_proxy
  n_brokerage_service_2 -->|"shared component call [http]"| n_internal_api_proxy
  n_internal_api_proxy -->|"settlements, extracted and shared [http]"| n_settlements
  n_brokerage_service_1 -.->|"produce through the sidecar [grpc]"| n_kafkaproxy
  n_brokerage_service_2 -.->|"produce through the sidecar [grpc]"| n_kafkaproxy
  n_kafkaproxy -.->|"pooled broker connections [kafka, at-least-once]"| n_order_kafka
  n_order_kafka -.->|"consumer group lifecycle [kafka, at-least-once]"| n_kafkaproxy
  n_kafkaproxy -.->|"all shards consume, filter per message [grpc, at-least-once]"| n_brokerage_service_1
  n_kafkaproxy -.->|"all shards consume, filter per message [grpc, at-least-once]"| n_brokerage_service_2
  n_brokerage_service_1 -->|"park failed event, queryable by reason [postgres]"| n_failed_event_store
  n_brokerage_service_2 -->|"park failed event, queryable by reason [postgres]"| n_failed_event_store
  n_failed_event_store -.->|"inspect, then replay to a retry topic [kafka, at-least-once]"| n_order_kafka
  n_settlements -.->|"settlement events [kafka, at-least-once]"| n_order_kafka
  n_order_kafka -.->|"5 to 10 hops, under one second [fix]"| n_execution_venues
  n_order_kafka -.->|"risk, fraud, order quality [kafka, at-least-once]"| n_stream_processing
  n_shard_db_1 -.->|"logical decoding [postgres-logical, at-least-once]"| n_shard_cdc
  n_shard_db_2 -.->|"logical decoding [postgres-logical, at-least-once]"| n_shard_cdc
  n_shard_cdc -.->|"Hudi, 5 to 15 minute freshness [http, exactly-once]"| n_data_lake
  n_brokerage_service_1 -.->|"logs, diskless and S3 backed [kafka, at-least-once]"| n_logging
```
