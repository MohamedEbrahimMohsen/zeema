# spotify-playback

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_spotify_mobile["Mobile client<br/><i>mobile-app</i>"]
  n_spotify_web["Web player<br/><i>web-browser</i>"]
  subgraph n_g_edge["Edge (trust-zone)"]
    n_access_point["Access Point<br/><i>websocket-gateway</i>"]
    n_service_discovery["DNS SRV service discovery<br/><i>dns-resolver</i>"]
    n_audio_cdn["Audio CDN<br/><i>content-delivery-network</i>"]
  end
  subgraph n_g_serving_platform["Serving platform (system)"]
    n_microservices["Squad-owned microservices<br/><i>container-service</i>"]
    n_metadata_store["metadata-store<br/><i>cassandra</i>"]
    n_user_db["user-db<br/><i>postgres</i>"]
    n_object_cache["object-cache<br/><i>memcached</i>"]
    n_audio_store["Audio storage<br/><i>blob-store</i>"]
  end
  subgraph n_g_event_delivery["Event delivery (system)"]
    n_event_delivery_service["Event Delivery Service<br/><i>container-service</i>"]
    n_schema_registry["Avro schema registry<br/><i>google-pubsub-schema</i>"]
    n_event_topics["One topic per event type<br/><i>google-pubsub</i>"]
    n_event_etl["Per event type ETL (Scio on Dataflow)<br/><i>google-dataflow</i>"]
  end
  subgraph n_g_data_platform["Data platform (system)"]
    n_raw_datasets["Hourly datasets on Cloud Storage<br/><i>gcs</i>"]
    n_warehouse["warehouse<br/><i>bigquery</i>"]
    n_batch_pipelines["38,000 scheduled pipelines<br/><i>container-worker</i>"]
    n_streaming_pipelines["Flink streaming pipelines<br/><i>flink</i>"]
    n_liveness_monitoring["Liveness and watermark lag monitoring<br/><i>observability-stack</i>"]
  end
  n_spotify_mobile -->|"SRV lookup for the access point [dns]"| n_service_discovery
  n_spotify_web -->|"SRV lookup for the access point [dns]"| n_service_discovery
  n_spotify_mobile -->|"persistent connection to the nearest datacentre [hermes]"| n_access_point
  n_spotify_web -->|"persistent connection to the nearest datacentre [https]"| n_access_point
  n_access_point -->|"SRV lookup for the target service [dns]"| n_service_discovery
  n_access_point -->|"request-reply routing [hermes]"| n_microservices
  n_microservices -->|"service to service lookup [dns]"| n_service_discovery
  n_microservices -->|"metadata, playlists [cql]"| n_metadata_store
  n_microservices -->|"postgres"| n_user_db
  n_microservices -->|"memcached"| n_object_cache
  n_spotify_mobile -->|"audio [https]"| n_audio_cdn
  n_spotify_web -->|"audio [https]"| n_audio_cdn
  n_audio_cdn -->|"origin fetch [https]"| n_audio_store
  n_spotify_mobile -->|"batched events, resent immediately, minutes or days later [https]"| n_event_delivery_service
  n_spotify_web -->|"batched events [https]"| n_event_delivery_service
  n_microservices -.->|"service side events [https, at-least-once]"| n_event_delivery_service
  n_event_delivery_service -->|"validate the event type [http]"| n_schema_registry
  n_event_delivery_service -.->|"publish to the topic of this event type [pubsub, at-least-once]"| n_event_topics
  n_event_topics -.->|"pull, one job per event type [pubsub, at-least-once]"| n_event_etl
  n_event_etl -->|"Avro schema for this event type [http]"| n_schema_registry
  n_event_etl -.->|"hourly buckets by event time, deduplicated [gcs]"| n_raw_datasets
  n_event_etl -.->|"load the closed hour [bigquery]"| n_warehouse
  n_event_etl -.->|"watermark lag per event type [http, at-most-once]"| n_liveness_monitoring
  n_event_topics -.->|"streaming jobs [pubsub, at-least-once]"| n_streaming_pipelines
  n_raw_datasets -.->|"scheduled read of the raw hour [gcs]"| n_batch_pipelines
  n_warehouse -.->|"scheduled SQL [bigquery]"| n_batch_pipelines
  n_batch_pipelines -.->|"derived datasets [bigquery]"| n_warehouse
  n_streaming_pipelines -.->|"streaming output [bigquery]"| n_warehouse
```
