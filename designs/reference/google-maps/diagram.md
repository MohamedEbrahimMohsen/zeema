# google-maps

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_maps_client["Google Maps app and web<br/><i>mobile-app</i>"]
  n_street_view_fleet["Street View cars and trekkers<br/><i>iot-device</i>"]
  subgraph n_g_google["Google infrastructure (global) (region)"]
    subgraph n_g_serving["Serving (trust-zone)"]
      n_maps_platform_api["Google Maps Platform API<br/><i>envoy-gateway</i>"]
      n_tile_cdn["Tile serving edge<br/><i>content-delivery-network</i>"]
      n_tile_cache["Rendered tile cache<br/><i>cache-cluster</i>"]
      n_routing_engine["Routing engine<br/><i>container-service</i>"]
    end
    subgraph n_g_mapmaking["Map building (trust-zone)"]
      n_imagery_store["Imagery store<br/><i>blob-store</i>"]
      n_photogrammetry["Photogrammetry alignment and stitching<br/><i>container-worker</i>"]
      n_ml_extraction["ML feature extraction<br/><i>container-worker</i>"]
      n_authoritative_ingest["Authoritative data ingestion<br/><i>container-worker</i>"]
      n_edit_queue["Pending map edits<br/><i>message-queue</i>"]
      n_edit_review["Data-ops review and publish<br/><i>container-worker</i>"]
      n_map_base_data["Map base data<br/><i>nosql-store</i>"]
      n_tile_builder["Tile generation<br/><i>container-worker</i>"]
    end
    subgraph n_g_traffic["Traffic and routing (trust-zone)"]
      n_traffic_aggregator["Traffic aggregation, anonymised<br/><i>beam</i>"]
      n_live_traffic_state["Live traffic state<br/><i>nosql-store</i>"]
      n_historical_traffic["Historical traffic patterns<br/><i>nosql-store</i>"]
      n_route_analyser["Route analyser, Supersegment builder<br/><i>container-worker</i>"]
      n_eta_model["GNN ETA model<br/><i>tensorflow-serving</i>"]
      n_incident_queue["Incident reports<br/><i>message-queue</i>"]
    end
  end
  subgraph n_g_external["Third-party data providers (trust-zone)"]
    n_satellite_imagery_providers["Satellite and aerial imagery providers<br/><i>supplier-api</i>"]
    n_authoritative_sources["1,000+ authoritative data sources<br/><i>supplier-api</i>"]
  end
  n_maps_client -->|"routes, ETAs, places [https]"| n_maps_platform_api
  n_maps_client -->|"map tiles [https]"| n_tile_cdn
  n_tile_cdn -->|"tile origin lookup [http]"| n_tile_cache
  n_tile_builder -.->|"publish rendered tiles [https, at-least-once]"| n_tile_cache
  n_maps_platform_api -->|"route request [http]"| n_routing_engine
  n_routing_engine -->|"road graph: quality, size, speed limits, restrictions [grpc]"| n_map_base_data
  n_routing_engine -->|"rank candidate routes [grpc]"| n_eta_model
  n_eta_model -->|"current conditions per supersegment [grpc]"| n_live_traffic_state
  n_eta_model -->|"time-of-day patterns, last two to four weeks weighted [grpc]"| n_historical_traffic
  n_maps_client -.->|"report closure, construction, hazard [https, at-least-once]"| n_incident_queue
  n_incident_queue -.->|"live incidents [amqp, at-least-once]"| n_routing_engine
  n_maps_client -.->|"aggregated anonymised location data [https, at-most-once]"| n_traffic_aggregator
  n_traffic_aggregator -.->|"live road conditions [grpc, at-least-once]"| n_live_traffic_state
  n_traffic_aggregator -.->|"append to historical patterns [grpc, at-least-once]"| n_historical_traffic
  n_historical_traffic -.->|"terabytes of travel data [batch, at-least-once]"| n_route_analyser
  n_route_analyser -.->|"supersegment graphs for training [batch, at-least-once]"| n_eta_model
  n_street_view_fleet -.->|"nine-camera imagery and lidar [https, at-least-once]"| n_imagery_store
  n_satellite_imagery_providers -.->|"satellite and aerial imagery [https, at-least-once]"| n_imagery_store
  n_imagery_store -.->|"align and stitch billions of images [batch, at-least-once]"| n_photogrammetry
  n_imagery_store -.->|"building outlines, addresses, signs [batch, at-least-once]"| n_ml_extraction
  n_photogrammetry -.->|"roads, lanes, buildings [grpc, at-least-once]"| n_map_base_data
  n_ml_extraction -.->|"candidate features for review [amqp, at-least-once]"| n_edit_queue
  n_authoritative_sources -.->|"vetted pull [https, at-least-once]"| n_authoritative_ingest
  n_authoritative_ingest -.->|"vetted authoritative data [grpc, at-least-once]"| n_map_base_data
  n_maps_platform_api -.->|"Send Feedback and Local Guides edits [amqp, at-least-once]"| n_edit_queue
  n_edit_queue -.->|"review queue [amqp, at-least-once]"| n_edit_review
  n_edit_review -->|"publish only on a high degree of confidence [grpc]"| n_map_base_data
  n_map_base_data -.->|"rebuild tiles from the base map [batch, at-least-once]"| n_tile_builder
```
