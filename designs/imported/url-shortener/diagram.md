# url-shortener

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart LR
  n_user["User<br/><i>web-browser</i>"]
  n_load_balancer["Load balancer<br/><i>load-balancer-tier</i>"]
  n_web_servers["Web servers<br/><i>container-service</i>"]
  n_cache["Cache<br/><i>cache-cluster</i>"]
  n_database["Database<br/><i>relational-database</i>"]
  n_user -->|"GET https://tinyurl.com/zn9edcu [https]"| n_load_balancer
  n_load_balancer -->|"https"| n_web_servers
  n_web_servers -->|"cache"| n_cache
  n_web_servers -->|"sql"| n_database
  n_load_balancer -->|"Return long URL: https://en.wikipedia.org/wiki/Systems_design [https]"| n_user
```
