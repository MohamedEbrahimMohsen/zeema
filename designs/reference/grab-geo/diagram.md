# grab-geo

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_driver_app["Driver app<br/><i>mobile-app</i>"]
  n_passenger_app["Passenger app<br/><i>mobile-app</i>"]
  n_osm_feed["OpenStreetMap extracts (Geofabrik .pbf)<br/><i>maps-api</i>"]
  subgraph n_g_grab_region["AWS region (three availability zones) (region)"]
    subgraph n_g_dispatch["Dispatch and Pharos (system)"]
      n_location_ingestion["Location ingestion<br/><i>container-service</i>"]
      n_dispatch_service["Dispatch / allocation<br/><i>container-service</i>"]
      n_pharos_proxy["Pharos proxy layer<br/><i>container-service</i>"]
      n_pharos_node["Pharos node layer<br/><i>container-service</i>"]
      n_pharos_model["Pharos model (road graph per city and vehicle type)<br/><i>geo-cell-index</i>"]
    end
    subgraph n_g_grabmaps["GrabMaps (system)"]
      n_routing_engine["Routing and ETA engine<br/><i>container-service</i>"]
      n_kartaview["KartaView imagery<br/><i>blob-store</i>"]
      n_parquetizer["Parquetizer<br/><i>container-worker</i>"]
      n_map_pipeline["GrabMaps pipeline (geohash processing units)<br/><i>spark-job</i>"]
    end
    subgraph n_g_coban["Coban (Kafka on Kubernetes) (system)"]
      n_coban_kafka["Coban Kafka (Strimzi on EKS, EBS gp3)<br/><i>kafka</i>"]
      n_node_termination_handler["AWS Node Termination Handler<br/><i>container-service</i>"]
      n_lb_controller["AWS Load Balancer Controller<br/><i>container-service</i>"]
    end
    subgraph n_g_catwalk["Catwalk model serving (system)"]
      n_catwalk_proxy["Catwalk Proxy<br/><i>container-service</i>"]
      n_catwalk_orchestrator["Catwalk Orchestrator<br/><i>container-service</i>"]
      n_model_servers["Catwalk model servers (TF Serving, ONNX, PyTorch)<br/><i>tensorflow-serving</i>"]
      n_amphawa["Amphawa feature fetching<br/><i>container-service</i>"]
    end
  end
  n_driver_app -.->|"location pings [https, at-least-once]"| n_location_ingestion
  n_driver_app -->|"accept allocation [https]"| n_dispatch_service
  n_passenger_app -->|"book a ride [https]"| n_dispatch_service
  n_location_ingestion -->|"driver update, p99 10 ms [grpc]"| n_pharos_proxy
  n_location_ingestion -.->|"location events [kafka, at-least-once]"| n_coban_kafka
  n_dispatch_service -->|"K nearest drivers by routing distance, p99 50 ms [grpc]"| n_pharos_proxy
  n_pharos_proxy -->|"route by map id [grpc]"| n_pharos_node
  n_pharos_node -->|"serialised writes, snapshot reads [in-process]"| n_pharos_model
  n_dispatch_service -->|"ETA on the road network (Hystrix-Go breaker) [grpc]"| n_routing_engine
  n_osm_feed -.->|"Asia .pbf extract [https, at-least-once]"| n_parquetizer
  n_parquetizer -.->|"OSM converted to table format [parquet, at-least-once]"| n_map_pipeline
  n_kartaview -.->|"street-level imagery [s3, at-least-once]"| n_map_pipeline
  n_coban_kafka -.->|"ride and delivery GPS probes, rack-aware fetch from the closest replica [kafka, at-least-once]"| n_map_pipeline
  n_map_pipeline -.->|"city and vehicle-type road graphs [load, at-least-once]"| n_pharos_model
  n_map_pipeline -.->|"hyperlocal map release [load, at-least-once]"| n_routing_engine
  n_dispatch_service -.->|"allocation events [kafka, at-least-once]"| n_coban_kafka
  n_node_termination_handler -.->|"SIGTERM on scale-in, graceful leadership move [signal, at-most-once]"| n_coban_kafka
  n_lb_controller -.->|"TargetGroupBinding keeps the NLB pointed at broker pod IPs [https, at-least-once]"| n_coban_kafka
  n_dispatch_service -->|"allocation model scoring [grpc]"| n_catwalk_proxy
  n_catwalk_proxy -->|"route to the orchestrator [grpc]"| n_catwalk_orchestrator
  n_catwalk_orchestrator -->|"multi-model inference [grpc]"| n_model_servers
  n_model_servers -->|"feature fetch [grpc]"| n_amphawa
```
