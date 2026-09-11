# news-feed

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart LR
  n_dns["DNS<br/><i>dns-resolver</i>"]
  n_cdn["CDN<br/><i>content-delivery-network</i>"]
  n_load_balancer["Load balancer<br/><i>load-balancer-tier</i>"]
  n_post_service["Post Service<br/><i>container-service</i>"]
  n_post_cache["Post Cache<br/><i>cache-cluster</i>"]
  n_post_db["Post DB<br/><i>relational-database</i>"]
  n_notification_service["Notification Service<br/><i>container-service</i>"]
  n_fanout_service["Fanout Service<br/><i>container-service</i>"]
  n_graph_db["Graph DB<br/><i>graph-store</i>"]
  n_message_queue["Message Queue<br/><i>message-queue</i>"]
  n_user_cache["User Cache<br/><i>cache-cluster</i>"]
  n_user_db["User DB<br/><i>relational-database</i>"]
  n_fanout_workers["Fanout Workers<br/><i>container-worker</i>"]
  n_news_feed_cache["News Feed Cache<br/><i>cache-cluster</i>"]
  n_news_feed_service["News Feed Service<br/><i>container-service</i>"]
  subgraph n_g_user["User (trust-zone)"]
    n_web_browser["Web browser<br/><i>web-browser</i>"]
    n_mobile_app["Mobile app<br/><i>mobile-app</i>"]
  end
  subgraph n_g_web_tier["web-tier (system)"]
    n_web_servers["Web servers<br/><i>container-service</i>"]
    n_authentication["Authentication<br/><i>container-service</i>"]
    n_rate_limiting["Rate Limiting<br/><i>in-process-limiter</i>"]
  end
  n_web_browser -->|"dns"| n_dns
  n_mobile_app -->|"dns"| n_dns
  n_web_browser -->|"v1/me/feed?content=Hello&auth_token={auth_token} [https]"| n_load_balancer
  n_mobile_app -->|"v1/me/feed?content=Hello&auth_token={auth_token} [https]"| n_load_balancer
  n_load_balancer -->|"http"| n_web_servers
  n_web_servers -->|"http"| n_post_service
  n_web_servers -->|"http"| n_fanout_service
  n_web_servers -->|"http"| n_notification_service
  n_post_service -->|"cache"| n_post_cache
  n_post_cache -->|"sql"| n_post_db
  n_fanout_service -->|"get friend ids [graph]"| n_graph_db
  n_fanout_service -->|"get friends data [cache]"| n_user_cache
  n_fanout_service -.->|"queue, at-least-once"| n_message_queue
  n_user_cache -->|"sql"| n_user_db
  n_message_queue -.->|"queue, at-least-once"| n_fanout_workers
  n_fanout_workers -->|"cache"| n_news_feed_cache
  n_web_browser -->|"https"| n_cdn
  n_mobile_app -->|"https"| n_cdn
  n_web_browser -->|"/v1/me/feed [https]"| n_load_balancer
  n_mobile_app -->|"/v1/me/feed [https]"| n_load_balancer
  n_web_servers -->|"http"| n_news_feed_service
  n_news_feed_service -->|"cache"| n_news_feed_cache
  n_news_feed_service -->|"cache"| n_user_cache
  n_news_feed_service -->|"cache"| n_post_cache
  n_web_servers -->|"https"| n_web_browser
  n_web_servers -->|"https"| n_mobile_app
```
