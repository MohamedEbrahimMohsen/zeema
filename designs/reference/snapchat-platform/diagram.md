# snapchat-platform

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_snapchat_client["Snapchat client<br/><i>mobile-app</i>"]
  subgraph n_g_aws_us_east_1["AWS us-east-1 (region)"]
    subgraph n_g_aws_edge["internet-exposed (trust-zone)"]
      n_api_gateway["API Gateway<br/><i>envoy-gateway</i>"]
      n_cloudfront["Content system<br/><i>cloudfront</i>"]
    end
    subgraph n_g_aws_compute["compute accounts (trust-zone)"]
      n_envoy_sidecar["Snap Service Mesh data plane<br/><i>envoy-sidecar</i>"]
      n_xds_control_plane["xDS Control Plane<br/><i>container-service</i>"]
      n_switchboard["Switchboard<br/><i>container-service</i>"]
      n_eks_clusters["Shared multi-tenant EKS clusters<br/><i>aws-eks</i>"]
      n_spinnaker["Spinnaker<br/><i>spinnaker</i>"]
      n_messaging_core_service["Messaging Core Service<br/><i>container-service</i>"]
      n_media_service["Media Service<br/><i>container-service</i>"]
      n_friend_service["Friend Service<br/><i>container-service</i>"]
      n_user_service["User Service<br/><i>container-service</i>"]
      n_secondary_service_cache_invalidator["SecondaryServiceCacheInvalidator<br/><i>container-worker</i>"]
      n_temporal_cluster["Multi-tenant Temporal cluster<br/><i>temporal</i>"]
      n_data_fetching_service["Data Fetching Service<br/><i>container-worker</i>"]
      n_report_generation_service["Report Generation Service<br/><i>container-worker</i>"]
      n_notification_service["Notification Service<br/><i>notification-platform</i>"]
    end
    subgraph n_g_aws_data["tenant data accounts (trust-zone)"]
      n_switchboard_config_store["Switchboard config<br/><i>dynamodb</i>"]
      n_user_conversation_store["DynamoDB (user and conversation data)<br/><i>dynamodb</i>"]
      n_s3_media_store["Snap media store<br/><i>s3</i>"]
    end
  end
  subgraph n_g_gcp_us_central1["GCP us-central1 (region)"]
    subgraph n_g_gcp_compute["GKE clusters (trust-zone)"]
      n_gke_clusters["GKE clusters<br/><i>google-gke</i>"]
      n_caching_secondary_user_service["CachingSecondaryUserService<br/><i>container-service</i>"]
      n_keydb_cache["KeyDB<br/><i>keydb</i>"]
    end
  end
  n_snapchat_client -->|"gRPC over QUIC/HTTP3, connection migration [grpc-quic]"| n_api_gateway
  n_api_gateway -->|"send: persist media first [grpc]"| n_media_service
  n_media_service -->|"store Snap media [s3]"| n_s3_media_store
  n_media_service -->|"may the sender send to this recipient [grpc]"| n_friend_service
  n_friend_service -->|"write conversation [grpc]"| n_messaging_core_service
  n_messaging_core_service -->|"conversation stored in DynamoDB (cross-account role) [dynamodb]"| n_user_conversation_store
  n_api_gateway -->|"receive: message metadata and media pointer [grpc]"| n_messaging_core_service
  n_snapchat_client -->|"resolve media pointer [https]"| n_cloudfront
  n_cloudfront -->|"origin fetch on miss [https]"| n_s3_media_store
  n_messaging_core_service -->|"all ingress and egress, TLS and metrics by default [localhost]"| n_envoy_sidecar
  n_caching_secondary_user_service -->|"all ingress and egress [localhost]"| n_envoy_sidecar
  n_envoy_sidecar -.->|"open bidirectional xDS stream [grpc, at-least-once]"| n_xds_control_plane
  n_xds_control_plane -.->|"canaried config push, health measured over minutes [grpc, at-least-once]"| n_envoy_sidecar
  n_switchboard -->|"config changes saved to DynamoDB [dynamodb]"| n_switchboard_config_store
  n_switchboard -.->|"simplified config model, not the full Envoy API [grpc, at-least-once]"| n_xds_control_plane
  n_switchboard -.->|"provision clusters, shift traffic, drain regions [https, at-least-once]"| n_eks_clusters
  n_switchboard -.->|"provision clusters, shift traffic, drain regions [https, at-least-once]"| n_gke_clusters
  n_switchboard -.->|"generate pipelines with canaries and zonal rollouts [https, at-least-once]"| n_spinnaker
  n_api_gateway -->|"GCP-side user read [grpc]"| n_caching_secondary_user_service
  n_caching_secondary_user_service -->|"hit: p99 1.56-2.11 ms [redis]"| n_keydb_cache
  n_caching_secondary_user_service -->|"cross-cloud miss: p99 49-133 ms, then backfill [grpc]"| n_user_service
  n_user_service -->|"authoritative user reads and writes [dynamodb]"| n_user_conversation_store
  n_user_conversation_store -.->|"data written to DynamoDB by other services [dynamodb-streams, at-least-once]"| n_secondary_service_cache_invalidator
  n_secondary_service_cache_invalidator -.->|"event-driven invalidation on top of the 24h TTL [redis, at-least-once]"| n_keydb_cache
  n_api_gateway -.->|"start ads report workflow; the same request will be resent [grpc, at-least-once]"| n_temporal_cluster
  n_temporal_cluster -.->|"worker polls the task queue [grpc, at-least-once]"| n_data_fetching_service
  n_data_fetching_service -.->|"formatted file handed to the analytics job [grpc, at-least-once]"| n_report_generation_service
  n_report_generation_service -.->|"retried until the notification goes out [grpc, at-least-once]"| n_notification_service
```
