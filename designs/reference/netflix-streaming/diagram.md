# netflix-streaming

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_device["Device clients<br/><i>user-device</i>"]
  subgraph n_g_aws_us_east_1["AWS us-east-1 (one of three active regions) (region)"]
    subgraph n_g_edge["edge (trust-zone)"]
      n_elb["ELB<br/><i>aws-classic-load-balancer</i>"]
      n_zuul["Zuul<br/><i>zuul</i>"]
    end
    subgraph n_g_control_plane["control-plane (trust-zone)"]
      n_api_gateway_service["API gateway service<br/><i>container-service</i>"]
      n_playback_service["Playback service<br/><i>container-service</i>"]
      n_subscriber_service["Subscriber service<br/><i>container-service</i>"]
      n_open_connect_control["Open Connect control<br/><i>container-service</i>"]
      n_encoding_pipeline["Encoding pipeline<br/><i>container-worker</i>"]
      n_eureka["Eureka<br/><i>eureka</i>"]
      n_evcache["EVCache<br/><i>evcache</i>"]
      n_cassandra["Cassandra<br/><i>cassandra</i>"]
      n_billing_db["RDS MySQL<br/><i>aws-rds</i>"]
      n_telemetry_stream["Kafka<br/><i>kafka</i>"]
      n_asset_store["S3<br/><i>s3</i>"]
      n_atlas["Atlas<br/><i>observability-stack</i>"]
    end
  end
  subgraph n_g_ixp["Internet exchange point (point-of-presence)"]
    n_storage_oca["Open Connect storage OCA<br/><i>content-delivery-network</i>"]
  end
  subgraph n_g_isp_network["ISP network (point-of-presence)"]
    n_edge_oca["Open Connect edge OCA<br/><i>content-delivery-network</i>"]
  end
  n_device -->|"control plane request [https]"| n_elb
  n_elb -->|"http"| n_zuul
  n_zuul -->|"Hystrix-wrapped route [http]"| n_api_gateway_service
  n_api_gateway_service -->|"entitlements, secure-token fallback [http]"| n_subscriber_service
  n_api_gateway_service -->|"start playback [http]"| n_playback_service
  n_api_gateway_service -->|"discovery lookup [http]"| n_eureka
  n_api_gateway_service -->|"memcached"| n_evcache
  n_api_gateway_service -.->|"metrics push [http, at-most-once]"| n_atlas
  n_playback_service -->|"select OCA, signed url [http]"| n_open_connect_control
  n_playback_service -->|"memcached"| n_evcache
  n_playback_service -->|"discovery lookup [http]"| n_eureka
  n_playback_service -.->|"playback telemetry [kafka, at-least-once]"| n_telemetry_stream
  n_playback_service -.->|"metrics push [http, at-most-once]"| n_atlas
  n_subscriber_service -->|"profiles and history, local quorum [cql]"| n_cassandra
  n_subscriber_service -->|"read-through, degraded on cache loss [memcached]"| n_evcache
  n_subscriber_service -->|"transactional customer data [mysql]"| n_billing_db
  n_subscriber_service -->|"discovery lookup [http]"| n_eureka
  n_subscriber_service -.->|"metrics push [http, at-most-once]"| n_atlas
  n_device -->|"adaptive bitrate segments [https]"| n_edge_oca
  n_edge_oca -->|"cache miss fill [http]"| n_storage_oca
  n_encoding_pipeline -.->|"encoded bitrate ladders [s3, at-least-once]"| n_asset_store
  n_asset_store -.->|"proactive fill in off-peak windows [http, at-least-once]"| n_storage_oca
  n_edge_oca -.->|"health and load reports [http, at-least-once]"| n_open_connect_control
  n_storage_oca -.->|"health and load reports [http, at-least-once]"| n_open_connect_control
```
