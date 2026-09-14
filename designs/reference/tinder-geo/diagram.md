# tinder-geo

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_mobile_client["mobile-client<br/><i>mobile-app</i>"]
  subgraph n_g_aws_region["AWS region (region)"]
    subgraph n_g_edge["edge (trust-zone)"]
      n_elb["elb<br/><i>aws-classic-load-balancer</i>"]
      n_api_front_proxy["Envoy front proxy<br/><i>envoy-gateway</i>"]
    end
    subgraph n_g_platform["Kubernetes cluster (trust-zone)"]
      n_recommendation_service["Recommendation abstraction service<br/><i>container-service</i>"]
      n_envoy_sidecar["envoy-sidecar<br/><i>envoy-sidecar</i>"]
      n_cluster_dns["CoreDNS DaemonSet<br/><i>coredns</i>"]
      n_kubernetes_cluster["kubernetes-cluster<br/><i>kubernetes</i>"]
      n_indexer["indexer<br/><i>container-worker</i>"]
      n_reindex_job["reindex-job<br/><i>container-worker</i>"]
      n_user_updates["user update topic<br/><i>kafka</i>"]
    end
    subgraph n_g_data["data (trust-zone)"]
      n_geoshard_index["Geosharded Elasticsearch<br/><i>elasticsearch</i>"]
      n_shard_mapping["user to geoshard mapping<br/><i>dynamodb</i>"]
      n_profile_store["profiles and matches<br/><i>dynamodb</i>"]
      n_profile_cache["profile-cache<br/><i>aws-elasticache</i>"]
    end
  end
  n_mobile_client -->|"https"| n_elb
  n_elb -->|"one front proxy deployment per zone [http]"| n_api_front_proxy
  n_api_front_proxy -->|"balanced per pod, not per connection [grpc]"| n_envoy_sidecar
  n_envoy_sidecar -->|"local container port [grpc]"| n_recommendation_service
  n_recommendation_service -->|"resolve service name [dns]"| n_cluster_dns
  n_recommendation_service -->|"which geoshard holds this user [https]"| n_shard_mapping
  n_recommendation_service -->|"query the shard, and its neighbours near a boundary [http]"| n_geoshard_index
  n_recommendation_service -->|"hydrate candidates [redis]"| n_profile_cache
  n_recommendation_service -->|"profiles and matches on miss [https]"| n_profile_store
  n_recommendation_service -.->|"location and profile update, hashed on user id [kafka, at-least-once]"| n_user_updates
  n_user_updates -.->|"one partition per user, ordered [kafka, at-least-once]"| n_indexer
  n_indexer -.->|"delete from the old shard, write to the new one [http, at-least-once]"| n_geoshard_index
  n_indexer -->|"move the user to the new geoshard [https]"| n_shard_mapping
  n_indexer -->|"resolve service name [dns]"| n_cluster_dns
  n_reindex_job -->|"read the source of truth [https]"| n_profile_store
  n_reindex_job -.->|"periodic reindex [http, at-least-once]"| n_geoshard_index
  n_kubernetes_cluster -->|"pod and service records [http]"| n_cluster_dns
  n_kubernetes_cluster -->|"inject and configure sidecars [xds]"| n_envoy_sidecar
```
