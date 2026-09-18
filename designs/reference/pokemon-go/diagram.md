# pokemon-go

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_player_phone["Pokemon GO app<br/><i>mobile-app</i>"]
  subgraph n_g_google_cloud["Google Cloud (global footprint) (region)"]
    subgraph n_g_edge["Cloud Load Balancing and CDN edge (trust-zone)"]
      n_edge_rate_limit["Administrative rate-limit override<br/><i>envoy-ratelimit</i>"]
      n_cloud_load_balancing["Cloud Load Balancing<br/><i>google-cloud-load-balancing</i>"]
      n_google_front_end["Google Front End, isolated pool<br/><i>load-balancer-tier</i>"]
      n_cloud_cdn["Cloud CDN<br/><i>google-cloud-cdn</i>"]
    end
    subgraph n_g_cluster["GKE cluster (trust-zone)"]
      n_nginx_proxy["NGINX reverse proxy<br/><i>nginx</i>"]
      n_gke_cluster["Google Kubernetes Engine<br/><i>google-gke</i>"]
      n_frontend_game_service["Front-end game service<br/><i>container-service</i>"]
      n_spatial_query_backend["Spatial query backend<br/><i>container-service</i>"]
      n_geospatial_platform["Geospatial platform, map and world data<br/><i>container-service</i>"]
      n_insights_service["Analytics, cheat detection and marketing reporting<br/><i>container-service</i>"]
    end
    subgraph n_g_managed_data["Managed data services (trust-zone)"]
      n_event_topic["Pub/Sub, game events<br/><i>google-pubsub</i>"]
      n_analytics_pipeline["Dataflow<br/><i>google-dataflow</i>"]
      n_game_state_db["Cloud Spanner, game state<br/><i>spanner</i>"]
      n_action_log["Cloud Bigtable, protobuf action log<br/><i>bigtable</i>"]
      n_static_media["Cloud Storage, static game media<br/><i>gcs</i>"]
      n_analytics_warehouse["BigQuery<br/><i>bigquery</i>"]
      n_cloud_monitoring["Cloud Monitoring and Logging<br/><i>google-cloud-monitoring</i>"]
    end
  end
  n_player_phone -->|"position and gameplay actions [https]"| n_cloud_load_balancing
  n_edge_rate_limit -->|"administrative override on accepted rate [internal]"| n_cloud_load_balancing
  n_cloud_load_balancing -->|"isolated GFE pool [internal]"| n_google_front_end
  n_cloud_load_balancing -->|"static media, never reaches the cluster [https]"| n_cloud_cdn
  n_cloud_cdn -->|"origin fetch on cache miss [https]"| n_static_media
  n_google_front_end -->|"into the cluster [http]"| n_nginx_proxy
  n_gke_cluster -->|"schedule proxy pods [kubernetes]"| n_nginx_proxy
  n_gke_cluster -->|"schedule and scale service pods [kubernetes]"| n_frontend_game_service
  n_nginx_proxy -->|"route and load balance across pods [http]"| n_frontend_game_service
  n_frontend_game_service -->|"what is near me [internal]"| n_spatial_query_backend
  n_spatial_query_backend -->|"map and world data [internal]"| n_geospatial_platform
  n_spatial_query_backend -->|"catch, spin, battle as one ACID transaction [spanner]"| n_game_state_db
  n_spatial_query_backend -->|"protobuf representation of the user action [bigtable]"| n_action_log
  n_spatial_query_backend -.->|"publish event off the request path [pubsub, at-least-once]"| n_event_topic
  n_event_topic -.->|"streaming path [pubsub, at-least-once]"| n_analytics_pipeline
  n_action_log -.->|"batch player logs [bigtable, at-least-once]"| n_analytics_pipeline
  n_analytics_pipeline -.->|"5-10 TB per day [streaming-insert, at-least-once]"| n_analytics_warehouse
  n_analytics_warehouse -->|"behaviour, distribution verification, cheat detection [sql]"| n_insights_service
  n_gke_cluster -.->|"cluster metrics and logs [metrics, at-least-once]"| n_cloud_monitoring
  n_frontend_game_service -.->|"dashboards and alerting [metrics, at-least-once]"| n_cloud_monitoring
```
