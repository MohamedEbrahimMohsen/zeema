# scale-to-millions

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart LR
  n_dns["DNS<br/><i>dns-resolver</i>"]
  n_cdn["CDN<br/><i>content-delivery-network</i>"]
  n_load_balancer["Load balancer<br/><i>load-balancer-tier</i>"]
  n_nosql["NoSQL<br/><i>nosql-store</i>"]
  subgraph n_g_user["User (trust-zone)"]
    n_web_browser["Web browser<br/><i>web-browser</i>"]
    n_mobile_app["Mobile app<br/><i>mobile-app</i>"]
  end
  subgraph n_g_dc1["DC1 (region)"]
    n_web_servers["Web servers<br/><i>container-service</i>"]
    n_message_queue["Message Queue<br/><i>message-queue</i>"]
    n_databases["Databases<br/><i>relational-database</i>"]
    n_caches["Caches<br/><i>cache-cluster</i>"]
    n_workers["Workers<br/><i>container-worker</i>"]
  end
  subgraph n_g_tools["Tools (system)"]
    n_logging["Logging<br/><i>observability-stack</i>"]
    n_metrics["Metrics<br/><i>observability-stack</i>"]
    n_monitoring["Monitoring<br/><i>observability-stack</i>"]
    n_automation["Automation<br/><i>automation-pipeline</i>"]
  end
  n_web_browser -->|"dns"| n_dns
  n_web_browser -->|"https"| n_cdn
  n_web_browser -->|"www.mysite.com [https]"| n_load_balancer
  n_mobile_app -->|"api.mysite.com [https]"| n_load_balancer
  n_load_balancer -->|"http"| n_web_servers
  n_web_servers -.->|"amqp, at-least-once"| n_message_queue
  n_web_servers -->|"sql"| n_databases
  n_web_servers -->|"tcp"| n_caches
  n_web_servers -->|"tcp"| n_nosql
  n_message_queue -.->|"amqp, at-least-once"| n_workers
  n_monitoring -->|"https"| n_web_servers
```
