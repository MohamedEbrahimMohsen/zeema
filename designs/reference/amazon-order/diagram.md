# amazon-order

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  subgraph n_g_us_east_1["us-east-1 (region)"]
    subgraph n_g_cell_a["cell-a (cell)"]
      n_customer_web["customer-web<br/><i>web-browser</i>"]
      n_customer_app["customer-app<br/><i>mobile-app</i>"]
      subgraph n_g_storefront["storefront (trust-zone)"]
        n_cloudfront["Amazon CloudFront<br/><i>cloudfront</i>"]
        n_rendering_engine["Page rendering engine<br/><i>container-service</i>"]
        n_service_fleet["150+ owning services<br/><i>container-service</i>"]
        n_cart_service["Shopping cart service<br/><i>container-service</i>"]
        n_cart_store["Dynamo<br/><i>nosql-store</i>"]
        n_product_cache["Amazon ElastiCache<br/><i>aws-elasticache</i>"]
        n_rufus_inference["Rufus on Inferentia and Trainium<br/><i>sagemaker-endpoint</i>"]
      end
      subgraph n_g_order_path["order-path (trust-zone)"]
        n_order_service["order-service<br/><i>container-service</i>"]
        n_herd["Herd<br/><i>cadence</i>"]
        n_timer_service["TimerService<br/><i>message-queue</i>"]
        n_view_service["ViewService<br/><i>observability-stack</i>"]
        n_workflow_store["Amazon DynamoDB<br/><i>dynamodb</i>"]
        n_order_events["Amazon SQS<br/><i>sqs</i>"]
        n_event_consumers["AWS Lambda<br/><i>lambda</i>"]
        n_payment_service["payment-service<br/><i>container-service</i>"]
        n_inventory_service["inventory-service<br/><i>container-service</i>"]
        n_fulfilment_service["Fulfilment center systems<br/><i>container-service</i>"]
        n_transactions_db["Amazon Aurora<br/><i>aurora</i>"]
      end
    end
    subgraph n_g_cell_b["cell-b (cell)"]
      n_herd_b["Herd, cell-b<br/><i>cadence</i>"]
      n_workflow_store_b["Amazon DynamoDB, cell-b<br/><i>dynamodb</i>"]
    end
  end
  n_customer_web -->|"https"| n_cloudfront
  n_customer_app -->|"https"| n_cloudfront
  n_cloudfront -->|"storefront page request [https]"| n_rendering_engine
  n_rendering_engine -->|"over 150 service calls per page, 300 ms at the 99.9th percentile each [rpc]"| n_service_fleet
  n_rendering_engine -->|"cart widget [rpc]"| n_cart_service
  n_rendering_engine -->|"Rufus shopping assistant [rpc]"| n_rufus_inference
  n_cart_service -->|"W=2 of N=3, sloppy quorum and hinted handoff on failure [rpc]"| n_cart_store
  n_service_fleet -->|"cached catalogue reads [redis]"| n_product_cache
  n_service_fleet -->|"transactional reads and writes [sql]"| n_transactions_db
  n_service_fleet -->|"place order [rpc]"| n_order_service
  n_order_service -.->|"start order workflow [rpc, at-least-once]"| n_herd
  n_herd -->|"workflow state [rpc]"| n_workflow_store
  n_herd -.->|"schedule next step [rpc, at-least-once]"| n_timer_service
  n_timer_service -.->|"due timers in priority order [poll, at-least-once]"| n_herd
  n_herd -.->|"activity: authorise payment [rpc, at-least-once]"| n_payment_service
  n_herd -.->|"activity: reserve inventory [rpc, at-least-once]"| n_inventory_service
  n_herd -.->|"activity: pick, pack and ship [rpc, at-least-once]"| n_fulfilment_service
  n_herd -.->|"workflow backlog [http, at-most-once]"| n_view_service
  n_herd_b -.->|"workflow backlog, cell-b [http, at-most-once]"| n_view_service
  n_herd_b -->|"workflow state, cell-b [rpc]"| n_workflow_store_b
  n_service_fleet -.->|"domain events [sqs, at-least-once]"| n_order_events
  n_order_events -.->|"event-driven functions [poll, at-least-once]"| n_event_consumers
  n_event_consumers -->|"order projections [rpc]"| n_workflow_store
  n_payment_service -->|"payment records [sql]"| n_transactions_db
  n_inventory_service -->|"inventory records [sql]"| n_transactions_db
  n_fulfilment_service -.->|"shipment events [sqs, at-least-once]"| n_order_events
```
