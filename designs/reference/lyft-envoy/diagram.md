# lyft-envoy

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_lyft_mobile_app["Lyft rider and driver apps (Envoy Mobile)<br/><i>mobile-app</i>"]
  subgraph n_g_lyft_vpc["AWS VPC (vpc)"]
    subgraph n_g_public_edge["public edge (trust-zone)"]
      n_edge_envoy["front Envoy<br/><i>envoy-gateway</i>"]
    end
    subgraph n_g_mesh["service-to-service mesh (trust-zone)"]
      n_api_service_sidecar["sidecar Envoy (ingress 9211, egress 9001)<br/><i>envoy-sidecar</i>"]
      n_api_service["Python microservice<br/><i>container-service</i>"]
      n_pricing_service_sidecar["sidecar Envoy (ingress 9211, egress 9001)<br/><i>envoy-sidecar</i>"]
      n_pricing_service["Go microservice<br/><i>container-service</i>"]
      n_rate_limit_service["global rate limit service<br/><i>envoy-ratelimit</i>"]
    end
    subgraph n_g_control_plane["discovery and control plane (system)"]
      n_xds_control_plane["discovery / xDS control plane (LDS, CDS, RDS, EDS)<br/><i>k8s-endpoints</i>"]
      n_kubernetes["Kubernetes clusters (cni-ipvlan-vpc-k8s)<br/><i>kubernetes</i>"]
      n_tracing_stack["stats, logs and tracing sinks<br/><i>zipkin</i>"]
    end
    subgraph n_g_data["datastores (trust-zone)"]
      n_ratelimit_redis["rate limit counters<br/><i>redis</i>"]
      n_rides_db["Aurora / RDS OLTP<br/><i>aurora</i>"]
      n_sessions_store["DynamoDB<br/><i>dynamodb</i>"]
      n_mongo_store["MongoDB (L7 sniffed by Envoy)<br/><i>mongodb</i>"]
      n_service_cache["Redis behind the Envoy Redis proxy<br/><i>redis</i>"]
    end
    subgraph n_g_streaming["event bus and streaming compute (system)"]
      n_cdc_tailer["CDC tailers (DynamoDBTailer, AuroraTailer)<br/><i>debezium</i>"]
      n_cdc_bus["Kafka event bus, one topic per source table<br/><i>kafka</i>"]
      n_cdc_adapter["multi-tenant CDC adapter<br/><i>container-worker</i>"]
      n_search_index["Elasticsearch sink<br/><i>elasticsearch</i>"]
      n_archive_firehose["Kinesis Data Firehose<br/><i>aws-firehose</i>"]
      n_stream_archive["S3 (topic backup, Flink checkpoints and savepoints)<br/><i>s3</i>"]
      n_feature_pipeline["feature generation (Beam on Flink)<br/><i>beam</i>"]
      n_model_pipeline["model execution<br/><i>flink</i>"]
    end
  end
  n_lyft_mobile_app -->|"rider and driver traffic, TLS terminated at the edge [https]"| n_edge_envoy
  n_edge_envoy -->|"into the mesh on ingress port 9211 [http2]"| n_api_service_sidecar
  n_edge_envoy -.->|"xDS subscription [grpc, at-least-once]"| n_xds_control_plane
  n_edge_envoy -.->|"per-hop stats and traces [statsd, at-most-once]"| n_tracing_stack
  n_api_service_sidecar -->|"ingress listener to the local app port [http]"| n_api_service
  n_api_service -->|"egress via localhost:9001 [http]"| n_api_service_sidecar
  n_api_service_sidecar -->|"Envoy to Envoy over long-lived HTTP/2 [http2]"| n_pricing_service_sidecar
  n_pricing_service_sidecar -->|"ingress listener to the local app port [http]"| n_pricing_service
  n_pricing_service -->|"egress via localhost:9001 [http]"| n_pricing_service_sidecar
  n_api_service_sidecar -->|"domain plus descriptors, allow or deny [grpc]"| n_rate_limit_service
  n_pricing_service_sidecar -->|"domain plus descriptors, allow or deny [grpc]"| n_rate_limit_service
  n_rate_limit_service -->|"composed cache key per descriptor [redis]"| n_ratelimit_redis
  n_api_service_sidecar -.->|"eventually consistent, lossy by design [grpc, at-least-once]"| n_xds_control_plane
  n_pricing_service_sidecar -.->|"eventually consistent, lossy by design [grpc, at-least-once]"| n_xds_control_plane
  n_api_service_sidecar -.->|"active health checks outrank discovery data [http, at-most-once]"| n_pricing_service_sidecar
  n_xds_control_plane -.->|"pod and endpoint events; offloaded-deploy pods filtered out [kubernetes-watch, at-least-once]"| n_kubernetes
  n_xds_control_plane -->|"discovery backing store [dynamodb]"| n_sessions_store
  n_api_service_sidecar -->|"L7 sniffed, Envoy produces the stats [mongodb]"| n_mongo_store
  n_api_service_sidecar -->|"Envoy Redis proxy [redis]"| n_service_cache
  n_api_service_sidecar -->|"OLTP through the sidecar [postgres]"| n_rides_db
  n_api_service_sidecar -.->|"identical stats at every hop [statsd, at-most-once]"| n_tracing_stack
  n_pricing_service_sidecar -->|"dedicated external egress port, for example localhost:9250 [https]"| n_sessions_store
  n_pricing_service_sidecar -.->|"identical stats at every hop [statsd, at-most-once]"| n_tracing_stack
  n_api_service_sidecar -.->|"analytic event stream [kafka, at-least-once]"| n_cdc_bus
  n_rides_db -.->|"AuroraTailer, without interfering with OLTP [postgres-wal, at-least-once]"| n_cdc_tailer
  n_sessions_store -.->|"DynamoDBTailer [dynamodb-streams, at-least-once]"| n_cdc_tailer
  n_cdc_tailer -.->|"events as-is, one topic per source table [kafka, at-least-once]"| n_cdc_bus
  n_cdc_bus -.->|"one consumer group across every adapter pod [kafka, at-least-once]"| n_cdc_adapter
  n_cdc_adapter -.->|"modular sink [http, at-least-once]"| n_search_index
  n_cdc_adapter -.->|"archive sink [https, at-least-once]"| n_archive_firehose
  n_archive_firehose -.->|"topic backup, replay between two timestamps [https, at-least-once]"| n_stream_archive
  n_cdc_bus -.->|"tens of millions of events per second [kafka, at-least-once]"| n_feature_pipeline
  n_feature_pipeline -.->|"feature topics [kafka, at-least-once]"| n_cdc_bus
  n_cdc_bus -.->|"tens of thousands of events per minute, isolated cluster [kafka, at-least-once]"| n_model_pipeline
  n_model_pipeline -.->|"sync decision variables to their services [http2, at-least-once]"| n_pricing_service_sidecar
  n_feature_pipeline -.->|"checkpoints and savepoints [s3, at-least-once]"| n_stream_archive
  n_model_pipeline -.->|"checkpoints and savepoints [s3, at-least-once]"| n_stream_archive
```
