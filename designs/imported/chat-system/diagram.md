# chat-system

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart LR
  n_user["User<br/><i>user-device</i>"]
  n_load_balancer["Load balancer<br/><i>load-balancer-tier</i>"]
  n_notification_servers["Notification servers<br/><i>container-service</i>"]
  n_api_servers["API servers<br/><i>container-service</i>"]
  subgraph n_g_real_time_service["Real time service (system)"]
    n_chat_servers["Chat servers<br/><i>container-service</i>"]
    n_presence_servers["Presence servers<br/><i>container-service</i>"]
  end
  subgraph n_g_kv_tier["kv-tier (system)"]
    n_kv_store["KV store<br/><i>nosql-store</i>"]
    n_kv_store_2["KV store<br/><i>nosql-store</i>"]
    n_kv_store_3["KV store<br/><i>nosql-store</i>"]
  end
  n_user -->|"http"| n_load_balancer
  n_user -->|"ws"| n_chat_servers
  n_chat_servers -.->|"ws"| n_user
  n_load_balancer -->|"http"| n_api_servers
  n_api_servers -->|"http"| n_notification_servers
  n_api_servers -->|"http"| n_chat_servers
  n_chat_servers -->|"http"| n_api_servers
  n_api_servers -->|"http"| n_presence_servers
  n_presence_servers -->|"http"| n_api_servers
  n_notification_servers -->|"kv"| n_kv_store
  n_api_servers -->|"kv"| n_kv_store_2
  n_chat_servers -->|"kv"| n_kv_store_3
  n_presence_servers -->|"kv"| n_kv_store_3
```
