# doordash-delivery

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_consumer_app["consumer-app<br/><i>mobile-app</i>"]
  n_merchant_pos["merchant-pos<br/><i>supplier-api</i>"]
  subgraph n_g_us_west_2["us-west-2 (region)"]
    n_bff["bff<br/><i>kong</i>"]
    n_order_service["order-service<br/><i>container-service</i>"]
    n_delivery_service["delivery-service<br/><i>container-service</i>"]
    n_legacy_monolith["legacy-monolith<br/><i>vm-service</i>"]
    n_aperture["aperture<br/><i>envoy-ratelimit</i>"]
    n_orders_db["orders-db<br/><i>cockroachdb</i>"]
    n_order_events["order-events<br/><i>kafka</i>"]
    n_delivery_workflows["delivery-workflows<br/><i>temporal</i>"]
    n_event_processor["event-processor<br/><i>flink</i>"]
    n_events_buffer["events-buffer<br/><i>s3</i>"]
    n_warehouse["warehouse<br/><i>snowflake</i>"]
    n_feature_store["feature-store<br/><i>redis</i>"]
    n_dispatch_model["dispatch-model<br/><i>tensorflow-serving</i>"]
    subgraph n_g_us_west_2a["us-west-2a (availability-zone)"]
    end
    subgraph n_g_us_west_2b["us-west-2b (availability-zone)"]
    end
  end
  n_consumer_app -->|"https"| n_bff
  n_bff -->|"grpc"| n_order_service
  n_bff -->|"https"| n_legacy_monolith
  n_aperture -->|"adaptive concurrency limits [grpc]"| n_order_service
  n_aperture -->|"adaptive concurrency limits [grpc]"| n_delivery_service
  n_order_service -->|"postgres"| n_orders_db
  n_legacy_monolith -->|"postgres"| n_orders_db
  n_order_service -.->|"order created [kafka, at-least-once]"| n_order_events
  n_order_events -.->|"kafka, at-least-once"| n_delivery_service
  n_delivery_service -->|"postgres"| n_orders_db
  n_delivery_service -->|"transmit order to merchant [https]"| n_merchant_pos
  n_delivery_service -.->|"start fallback workflow on failure [grpc, at-least-once]"| n_delivery_workflows
  n_delivery_workflows -.->|"retried activities [grpc, at-least-once]"| n_delivery_service
  n_delivery_service -->|"grpc"| n_dispatch_model
  n_dispatch_model -->|"redis"| n_feature_store
  n_order_events -.->|"kafka, at-least-once"| n_event_processor
  n_event_processor -.->|"Parquet buffer independent of Kafka retention [s3, at-least-once]"| n_events_buffer
  n_event_processor -.->|"materialised features [redis, at-least-once]"| n_feature_store
  n_events_buffer -.->|"snowpipe, at-least-once"| n_warehouse
```
