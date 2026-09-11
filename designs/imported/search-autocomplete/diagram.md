# search-autocomplete

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart LR
  n_load_balancer["Load balancer<br/><i>load-balancer-tier</i>"]
  n_api_servers["API servers<br/><i>container-service</i>"]
  n_trie_cache["Trie Cache<br/><i>cache-cluster</i>"]
  n_trie_db["Trie DB<br/><i>nosql-store</i>"]
  n_analytics_logs["Analytics Logs<br/><i>observability-stack</i>"]
  n_aggregators["Aggregators<br/><i>container-worker</i>"]
  n_aggregated_data["Aggregated Data<br/><i>relational-database</i>"]
  n_workers["Workers<br/><i>container-worker</i>"]
  subgraph n_g_user["User (trust-zone)"]
    n_web_browser["Web browser<br/><i>web-browser</i>"]
    n_mobile_app["Mobile app<br/><i>mobile-app</i>"]
  end
  n_web_browser -->|"https"| n_load_balancer
  n_mobile_app -->|"https"| n_load_balancer
  n_load_balancer -->|"http"| n_api_servers
  n_api_servers -->|"cache"| n_trie_cache
  n_trie_cache -->|"nosql"| n_trie_db
  n_analytics_logs -.->|"file"| n_aggregators
  n_aggregators -.->|"sql"| n_aggregated_data
  n_aggregated_data -.->|"sql"| n_workers
  n_workers -.->|"Update weekly [nosql]"| n_trie_db
  n_trie_db -.->|"Weekly snapshot of DB [nosql]"| n_trie_cache
```
