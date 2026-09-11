# rate-limiter

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart LR
  n_client["Client<br/><i>user-device</i>"]
  n_rate_limiter_middleware["Rate limiter middleware<br/><i>redis-rate-limiter</i>"]
  n_cached_rules["Cached rules<br/><i>cache-cluster</i>"]
  n_rules["Rules<br/><i>file-store</i>"]
  n_workers["Workers<br/><i>container-worker</i>"]
  n_api_servers["API Servers<br/><i>container-service</i>"]
  n_redis["Redis<br/><i>redis</i>"]
  n_message_queue["Message queue<br/><i>message-queue</i>"]
  n_client -->|"http"| n_rate_limiter_middleware
  n_rate_limiter_middleware -->|"cache"| n_cached_rules
  n_workers -->|"cache"| n_cached_rules
  n_workers -->|"file"| n_rules
  n_rate_limiter_middleware -->|"success [http]"| n_api_servers
  n_rate_limiter_middleware -->|"redis"| n_redis
  n_redis -->|"redis"| n_rate_limiter_middleware
  n_rate_limiter_middleware -->|"rate limited / 429: too many requests [http]"| n_client
  n_rate_limiter_middleware -.->|"option 2 [queue, at-least-once]"| n_message_queue
```
