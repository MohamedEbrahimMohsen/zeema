# object-storage

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_sdk_client["sdk-client<br/><i>sdk-client</i>"]
  n_edge_dns["edge-dns<br/><i>route53</i>"]
  n_iam["iam<br/><i>aws-iam</i>"]
  subgraph n_g_us_east_1["us-east-1 (region)"]
    n_api_gateway["api-gateway<br/><i>kong</i>"]
    n_api_service["api-service<br/><i>container-service</i>"]
    n_metadata_cache["metadata-cache<br/><i>redis</i>"]
    n_metadata_db["metadata-db<br/><i>cassandra</i>"]
    n_placement["placement<br/><i>etcd</i>"]
    n_data_router["data-router<br/><i>container-service</i>"]
    n_data_nodes_hot["data-nodes-hot<br/><i>minio</i>"]
    n_warm_tier["warm-tier<br/><i>ceph-rgw</i>"]
    subgraph n_g_us_east_1a["us-east-1a (availability-zone)"]
    end
    subgraph n_g_us_east_1b["us-east-1b (availability-zone)"]
      n_auditor["auditor<br/><i>cron-job</i>"]
    end
    subgraph n_g_us_east_1c["us-east-1c (availability-zone)"]
      n_repair_worker["repair-worker<br/><i>container-worker</i>"]
    end
  end
  n_sdk_client -->|"resolve bucket endpoint [dns]"| n_edge_dns
  n_sdk_client -->|"REST, multipart, range, checksum trailers [https]"| n_api_gateway
  n_api_gateway -->|"http"| n_api_service
  n_api_service -->|"authorise [https]"| n_iam
  n_api_service -->|"metadata read, witness-checked [redis]"| n_metadata_cache
  n_api_service -->|"metadata write, cache miss [cql]"| n_metadata_db
  n_api_service -->|"stream payload [grpc]"| n_data_router
  n_data_router -->|"node set for object [grpc]"| n_placement
  n_data_router -->|"write, ack after quorum [grpc]"| n_data_nodes_hot
  n_data_nodes_hot -.->|"tier after 90 days [s3, at-least-once]"| n_warm_tier
  n_auditor -.->|"checksum scan [grpc, at-least-once]"| n_data_nodes_hot
  n_auditor -.->|"checksum scan [grpc, at-least-once]"| n_warm_tier
  n_auditor -.->|"corrupt block found [grpc, at-least-once]"| n_repair_worker
  n_placement -.->|"heartbeat lost, rebuild [grpc, at-least-once]"| n_repair_worker
  n_repair_worker -->|"re-replicate [grpc]"| n_data_nodes_hot
  n_repair_worker -->|"reconstruct stripe [grpc]"| n_warm_tier
```
