# google-drive

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart LR
  n_user["User<br/><i>user-device</i>"]
  n_block_servers["Block servers<br/><i>container-service</i>"]
  n_cloud_storage["Cloud storage<br/><i>s3</i>"]
  n_cold_storage["Cold storage<br/><i>blob-store</i>"]
  n_load_balancer["Load balancer<br/><i>load-balancer-tier</i>"]
  n_api_servers["API servers<br/><i>container-service</i>"]
  n_metadata_cache["Metadata Cache<br/><i>cache-cluster</i>"]
  n_metadata_db["Metadata DB<br/><i>relational-database</i>"]
  n_notification_service["Notification Service<br/><i>websocket-gateway</i>"]
  n_offline_backup_queue["Offline backup Queue<br/><i>message-queue</i>"]
  n_user -->|"https"| n_block_servers
  n_user -->|"https"| n_load_balancer
  n_user -->|"long polling [http]"| n_notification_service
  n_block_servers -->|"s3"| n_cloud_storage
  n_cloud_storage -->|"https"| n_load_balancer
  n_cloud_storage -->|"s3"| n_cold_storage
  n_load_balancer -->|"https"| n_api_servers
  n_api_servers -->|"cache"| n_metadata_cache
  n_api_servers -->|"sql"| n_metadata_db
  n_api_servers -.->|"https"| n_notification_service
  n_notification_service -.->|"queue, at-least-once"| n_offline_backup_queue
```
