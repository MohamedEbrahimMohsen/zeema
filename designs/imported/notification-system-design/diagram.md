# notification-system-design

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart LR
  n_service_n["Service N<br/><i>container-service</i>"]
  n_analytics_service["Analytics service<br/><i>container-service</i>"]
  n_ios_pn["iOS PN<br/><i>message-queue</i>"]
  n_workers["Workers<br/><i>container-worker</i>"]
  n_apns["APNs<br/><i>apns</i>"]
  n_ios["iOS<br/><i>mobile-app</i>"]
  n_cache["CACHE<br/><i>cache-cluster</i>"]
  n_db["DB<br/><i>relational-database</i>"]
  n_notification_template["Notification template<br/><i>relational-database</i>"]
  n_notification_log["Notification log<br/><i>relational-database</i>"]
  subgraph n_g_notification_server_tier["notification-server-tier (system)"]
    n_notification_servers["Notification servers<br/><i>container-service</i>"]
    n_authentication["Authentication<br/><i>container-service</i>"]
    n_rate_limit["Rate limit<br/><i>in-process-limiter</i>"]
  end
  n_service_n -->|"https"| n_notification_servers
  n_notification_servers -.->|"send pending [https]"| n_analytics_service
  n_notification_servers -.->|"queue, at-least-once"| n_ios_pn
  n_notification_servers -->|"cache"| n_cache
  n_cache -->|"device setting, user info [sql]"| n_db
  n_ios_pn -.->|"queue, at-least-once"| n_workers
  n_workers -.->|"retry on error [queue, at-least-once]"| n_ios_pn
  n_workers -.->|"sent [https]"| n_analytics_service
  n_workers -->|"https"| n_apns
  n_apns -.->|"apns, at-most-once"| n_ios
  n_ios -.->|"click tracking [https]"| n_analytics_service
  n_workers -->|"sql"| n_notification_template
  n_workers -->|"sql"| n_notification_log
```
