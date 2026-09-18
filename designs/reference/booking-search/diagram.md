# booking-search

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_web_client["web-client<br/><i>web-browser</i>"]
  n_mobile_client["mobile-client<br/><i>mobile-app</i>"]
  subgraph n_g_booking_dc["Booking.com data centres (region)"]
    subgraph n_g_edge["Edge (trust-zone)"]
      n_edge_lb["HAProxy edge<br/><i>haproxy</i>"]
      n_graphql_gateway["Federated GraphQL gateway<br/><i>envoy-gateway</i>"]
    end
    subgraph n_g_mesh["Service mesh (trust-zone)"]
      n_service_mesh["Envoy service mesh<br/><i>envoy-sidecar</i>"]
      n_mesh_control_plane_metal["xDS control plane (bare metal)<br/><i>container-service</i>"]
      n_mesh_control_plane_cloud["xDS control plane (Kubernetes and cloud)<br/><i>container-service</i>"]
      n_service_discovery["ZooKeeper (discovery and configuration)<br/><i>zookeeper</i>"]
      n_accommodation_service["Accommodation services (ex-monolith)<br/><i>container-service</i>"]
      n_ranking_platform["Ranking platform<br/><i>container-service</i>"]
      n_booking_service["Booking and payment services<br/><i>container-service</i>"]
      n_fraud_service["Fraud detection service<br/><i>container-service</i>"]
    end
    subgraph n_g_data_platform["Data platform (system)"]
      n_binlog_cdc["Binlog change data capture<br/><i>kafka-connect</i>"]
      n_events_kafka["Events Kafka (Confluent Platform)<br/><i>kafka</i>"]
      n_mysql_primary["MySQL primaries (250+ clusters)<br/><i>mysql</i>"]
      n_binlog_server["Binlog server<br/><i>maxscale</i>"]
      n_mysql_replicas["MySQL replicas (read path, 50+ per topology)<br/><i>mysql</i>"]
      n_cassandra["Cassandra<br/><i>cassandra</i>"]
      n_fraud_graph["JanusGraph fraud graph<br/><i>janusgraph</i>"]
      n_search_index["Elasticsearch<br/><i>elasticsearch</i>"]
    end
    subgraph n_g_observability["Observability platform (system)"]
      n_event_proxy["Event-proxy (host daemon)<br/><i>container-worker</i>"]
      n_nanotube["Nanotube metrics router<br/><i>observability-stack</i>"]
      n_observability_platform["Event consumers (tracing, APM metrics, logging)<br/><i>observability-stack</i>"]
    end
  end
  subgraph n_g_aws["AWS (region)"]
    n_cdn["Amazon CloudFront<br/><i>cloudfront</i>"]
    n_backup_catalogue["Backup catalogue<br/><i>s3</i>"]
  end
  n_web_client -->|"search and book [https]"| n_cdn
  n_mobile_client -->|"search and book [https]"| n_cdn
  n_cdn -->|"origin fetch [https]"| n_edge_lb
  n_edge_lb -->|"load balanced to origin [http]"| n_graphql_gateway
  n_graphql_gateway -->|"federated query enters the mesh [http]"| n_service_mesh
  n_service_mesh -->|"sidecar-routed call [http]"| n_accommodation_service
  n_service_mesh -->|"sidecar-routed call [http]"| n_booking_service
  n_service_mesh -->|"sidecar-routed call [grpc]"| n_fraud_service
  n_mesh_control_plane_metal -.->|"config for the bare-metal platform [xds, at-least-once]"| n_service_mesh
  n_mesh_control_plane_cloud -.->|"config for the cloud platform [xds, at-least-once]"| n_service_mesh
  n_mesh_control_plane_metal -->|"service discovery and configuration [zookeeper]"| n_service_discovery
  n_mesh_control_plane_cloud -->|"service discovery and configuration [zookeeper]"| n_service_discovery
  n_accommodation_service -->|"rank the result set [grpc]"| n_ranking_platform
  n_accommodation_service -->|"reads on replicas instead of caches [mysql]"| n_mysql_replicas
  n_ranking_platform -->|"retrieval [http]"| n_search_index
  n_accommodation_service -->|"property search [http]"| n_search_index
  n_accommodation_service -->|"polyglot store [cql]"| n_cassandra
  n_booking_service -->|"reservation and payment writes [mysql]"| n_mysql_primary
  n_booking_service -->|"reads on replicas instead of caches [mysql]"| n_mysql_replicas
  n_fraud_service -->|"linked identifier lookup [gremlin]"| n_fraud_graph
  n_fraud_graph -->|"graph storage backend [cql]"| n_cassandra
  n_mysql_primary -.->|"binlog stream [mysql-replication, at-least-once]"| n_binlog_server
  n_binlog_server -.->|"relayed fan-out, no intermediate master [mysql-replication, at-least-once]"| n_mysql_replicas
  n_mysql_primary -.->|"binlog [mysql-binlog, at-least-once]"| n_binlog_cdc
  n_mysql_replicas -.->|"binlog tailed off a replica [mysql-binlog, at-least-once]"| n_binlog_cdc
  n_binlog_cdc -.->|"change events [kafka, at-least-once]"| n_events_kafka
  n_binlog_cdc -.->|"index updates [http, at-least-once]"| n_search_index
  n_mysql_primary -.->|"backup catalogue for 250+ clusters [backup]"| n_backup_catalogue
  n_booking_service -.->|"booking and payment events [kafka, at-least-once]"| n_events_kafka
  n_accommodation_service -.->|"events from the host [local, at-least-once]"| n_event_proxy
  n_booking_service -.->|"events from the host [local, at-least-once]"| n_event_proxy
  n_event_proxy -.->|"split into small messages [kafka, at-least-once]"| n_events_kafka
  n_events_kafka -.->|"tracing, APM metrics, event logging [kafka, at-least-once]"| n_observability_platform
  n_accommodation_service -.->|"metric data points [metrics, at-most-once]"| n_nanotube
  n_booking_service -.->|"metric data points [metrics, at-most-once]"| n_nanotube
  n_nanotube -.->|"routed metric points [metrics, at-most-once]"| n_observability_platform
```
