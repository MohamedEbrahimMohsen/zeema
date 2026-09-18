# uber-dispatch

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_driver_app["Driver app<br/><i>mobile-app</i>"]
  n_rider_app["Rider app<br/><i>mobile-app</i>"]
  subgraph n_g_uber_dc["Uber datacenter (active, failover twin) (region)"]
    subgraph n_g_edge_zone["Mobile edge (trust-zone)"]
      n_rtapi["RTAPI / Edge Gateway<br/><i>websocket-gateway</i>"]
    end
    subgraph n_g_dispatch_system["Dispatch (system)"]
      n_dispatch["Dispatch<br/><i>container-service</i>"]
      n_supply["Supply<br/><i>container-service</i>"]
      n_demand["Demand<br/><i>container-service</i>"]
      n_disco["DISCO<br/><i>container-service</i>"]
      n_ringpop["Ringpop<br/><i>apache-helix</i>"]
      n_geo_index["Geospatial index<br/><i>geo-cell-index</i>"]
      n_location_ingester["Location ingester<br/><i>container-worker</i>"]
    end
    subgraph n_g_platform_services["Business logic and routing (system)"]
      n_routing_eta["Routing / ETA<br/><i>container-service</i>"]
      n_business_logic["Business logic services<br/><i>container-service</i>"]
      n_trip_workflows["Cadence<br/><i>cadence</i>"]
      n_post_trip_pipeline["Post-trip pipeline<br/><i>container-worker</i>"]
    end
    subgraph n_g_data_layer["Marketplace data layer (system)"]
      n_event_hub["Kafka (data hub)<br/><i>kafka</i>"]
      n_dispatch_state["Riak<br/><i>riak</i>"]
      n_trip_store["Schemaless (on sharded MySQL)<br/><i>nosql-store</i>"]
      n_marketplace_store["Cassandra<br/><i>cassandra</i>"]
      n_redis_cache["Redis (behind Twemproxy)<br/><i>redis</i>"]
    end
    subgraph n_g_ops_plane["Observability (system)"]
      n_metrics["M3<br/><i>m3</i>"]
      n_tracing["Jaeger<br/><i>jaeger</i>"]
    end
  end
  n_driver_app -.->|"location every 4 s [https, at-least-once]"| n_rtapi
  n_rider_app -->|"ride request [https]"| n_rtapi
  n_rtapi -->|"ring lookup: which shard owns this driver [tchannel]"| n_ringpop
  n_rtapi -->|"dispatch request [tchannel]"| n_dispatch
  n_rtapi -->|"trip workflow calls [tchannel]"| n_business_logic
  n_rtapi -.->|"location events [kafka, at-least-once]"| n_event_hub
  n_dispatch -->|"vehicle capabilities and state [tchannel]"| n_supply
  n_dispatch -->|"rider requirements and orders [tchannel]"| n_demand
  n_dispatch -->|"optimise the match [tchannel]"| n_disco
  n_dispatch -->|"location writes, 1M/s design goal [tchannel]"| n_geo_index
  n_disco -->|"coarse candidate filter [tchannel]"| n_geo_index
  n_geo_index -->|"candidate ranking, high fan-out [tchannel]"| n_routing_eta
  n_routing_eta -->|"driver offers [tchannel]"| n_supply
  n_dispatch -.->|"membership and shard ownership [tchannel-gossip, at-least-once]"| n_ringpop
  n_supply -.->|"membership and shard ownership [tchannel-gossip, at-least-once]"| n_ringpop
  n_demand -.->|"membership and shard ownership [tchannel-gossip, at-least-once]"| n_ringpop
  n_dispatch -->|"persist dispatch state [riak]"| n_dispatch_state
  n_dispatch -.->|"encrypted trip state digest [https, at-least-once]"| n_driver_app
  n_driver_app -->|"restore trip state after datacenter failover [https]"| n_dispatch
  n_event_hub -.->|"kafka, at-least-once"| n_location_ingester
  n_location_ingester -.->|"rebuild the in-memory index from the location stream [tchannel, at-least-once]"| n_geo_index
  n_business_logic -->|"append trip data [mysql]"| n_trip_store
  n_business_logic -->|"marketplace and dispatch state [cql]"| n_marketplace_store
  n_business_logic -->|"hot reads through Twemproxy [redis]"| n_redis_cache
  n_business_logic -->|"start trip workflow [tchannel]"| n_trip_workflows
  n_trip_workflows -->|"activity execution [tchannel]"| n_business_logic
  n_business_logic -.->|"trip events [kafka, at-least-once]"| n_event_hub
  n_event_hub -.->|"ratings, receipts, payment scheduling [kafka, at-least-once]"| n_post_trip_pipeline
  n_event_hub -.->|"trace spans [kafka, at-least-once]"| n_tracing
  n_dispatch -.->|"metrics [statsd, at-most-once]"| n_metrics
```
