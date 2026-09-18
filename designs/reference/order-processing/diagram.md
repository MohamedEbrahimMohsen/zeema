# order-processing

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  subgraph n_g_eu_west_1["eu-west-1 (region)"]
    subgraph n_g_core_vpc["core-vpc (vpc)"]
      n_api["api<br/><i>aws-api-gateway</i>"]
      n_order_service["order-service<br/><i>container-service</i>"]
      n_payment_service["payment-service<br/><i>container-service</i>"]
      n_reservation_queue["reservation-queue<br/><i>sqs</i>"]
      n_inventory_service["inventory-service<br/><i>container-service</i>"]
      n_orders_queue["orders-queue<br/><i>sqs</i>"]
      n_fulfilment_worker["fulfilment-worker<br/><i>container-service</i>"]
      n_orders_db["orders-db<br/><i>postgres</i>"]
      n_order_events["order-events<br/><i>kafka</i>"]
    end
  end
  n_api -->|"http"| n_order_service
  n_order_service -->|"grpc"| n_payment_service
  n_order_service -->|"postgres"| n_orders_db
  n_payment_service -.->|"sqs, at-least-once"| n_reservation_queue
  n_reservation_queue -.->|"sqs, at-least-once"| n_inventory_service
  n_inventory_service -->|"postgres"| n_orders_db
  n_order_service -.->|"sqs, at-least-once"| n_orders_queue
  n_orders_queue -.->|"sqs, at-least-once"| n_fulfilment_worker
  n_fulfilment_worker -->|"postgres"| n_orders_db
  n_fulfilment_worker -.->|"kafka, at-least-once"| n_order_events
```
