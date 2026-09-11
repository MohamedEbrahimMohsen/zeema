# notification-system

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart LR
  n_service_1["Service 1<br/><i>container-service</i>"]
  n_service_2["Service 2<br/><i>container-service</i>"]
  n_service_n["Service N<br/><i>container-service</i>"]
  n_analytics_service["Analytics service<br/><i>container-service</i>"]
  n_cache["CACHE<br/><i>cache-cluster</i>"]
  n_db["DB<br/><i>relational-database</i>"]
  n_ios_pn["iOS PN<br/><i>message-queue</i>"]
  n_android_pn["Android PN<br/><i>message-queue</i>"]
  n_sms_queue["SMS queue<br/><i>message-queue</i>"]
  n_email_queue["Email queue<br/><i>message-queue</i>"]
  n_ios_workers["Workers<br/><i>container-worker</i>"]
  n_android_workers["Workers<br/><i>container-worker</i>"]
  n_sms_workers["Workers<br/><i>container-worker</i>"]
  n_email_workers["Workers<br/><i>container-worker</i>"]
  n_ios["iOS<br/><i>mobile-app</i>"]
  n_android["Android<br/><i>mobile-app</i>"]
  n_sms["SMS<br/><i>mobile-app</i>"]
  n_email["Email<br/><i>desktop-app</i>"]
  n_notification_template["Notification template<br/><i>relational-database</i>"]
  n_notification_log["Notification log<br/><i>relational-database</i>"]
  subgraph n_g_notification_server_tier["notification-server-tier (system)"]
    n_notification_servers["Notification servers<br/><i>container-service</i>"]
    n_authentication["Authentication<br/><i>container-service</i>"]
    n_rate_limit["Rate limit<br/><i>in-process-limiter</i>"]
  end
  subgraph n_g_third_party_services["Third Party Services (trust-zone)"]
    n_apns["APNs<br/><i>apns</i>"]
    n_fcm["FCM<br/><i>fcm</i>"]
    n_sms_service["SMS Service<br/><i>supplier-api</i>"]
    n_email_service["Email Service<br/><i>supplier-api</i>"]
  end
  n_service_1 -->|"https"| n_notification_servers
  n_service_2 -->|"https"| n_notification_servers
  n_service_n -->|"https"| n_notification_servers
  n_notification_servers -.->|"send pending [https]"| n_analytics_service
  n_notification_servers -->|"tcp"| n_cache
  n_cache -->|"sql"| n_db
  n_notification_servers -.->|"amqp, at-least-once"| n_ios_pn
  n_notification_servers -.->|"amqp, at-least-once"| n_android_pn
  n_notification_servers -.->|"amqp, at-least-once"| n_sms_queue
  n_notification_servers -.->|"amqp, at-least-once"| n_email_queue
  n_ios_pn -.->|"amqp, at-least-once"| n_ios_workers
  n_android_pn -.->|"amqp, at-least-once"| n_android_workers
  n_sms_queue -.->|"amqp, at-least-once"| n_sms_workers
  n_email_queue -.->|"amqp, at-least-once"| n_email_workers
  n_ios_workers -.->|"retry on error [amqp, at-least-once]"| n_ios_pn
  n_ios_workers -->|"https"| n_apns
  n_android_workers -->|"https"| n_fcm
  n_sms_workers -->|"https"| n_sms_service
  n_email_workers -->|"https"| n_email_service
  n_ios_workers -.->|"sent [https]"| n_analytics_service
  n_ios_workers -->|"sql"| n_notification_template
  n_ios_workers -->|"sql"| n_notification_log
  n_apns -.->|"apns, at-most-once"| n_ios
  n_fcm -.->|"fcm, at-most-once"| n_android
  n_sms_service -.->|"sms, at-most-once"| n_sms
  n_email_service -.->|"smtp, at-most-once"| n_email
  n_ios -.->|"click tracking [https]"| n_analytics_service
```
