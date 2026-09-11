# multi-region-web

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  subgraph n_g_us_east_1["us-east-1 (region)"]
    n_api_us["api-us<br/><i>aws-api-gateway</i>"]
    n_web_app_us["web-app-us<br/><i>container-service</i>"]
    n_session_cache_us["session-cache-us<br/><i>redis</i>"]
    n_catalog_db["catalog-db<br/><i>postgres</i>"]
  end
  subgraph n_g_eu_west_1["eu-west-1 (region)"]
    n_api_eu["api-eu<br/><i>aws-api-gateway</i>"]
    n_web_app_eu["web-app-eu<br/><i>container-service</i>"]
    n_session_cache_eu["session-cache-eu<br/><i>redis</i>"]
    n_catalog_db_replica["catalog-db-replica<br/><i>postgres</i>"]
  end
  n_api_us -->|"http"| n_web_app_us
  n_web_app_us -->|"redis"| n_session_cache_us
  n_web_app_us -->|"postgres"| n_catalog_db
  n_api_eu -->|"http"| n_web_app_eu
  n_web_app_eu -->|"redis"| n_session_cache_eu
  n_web_app_eu -->|"reads [postgres]"| n_catalog_db_replica
  n_web_app_eu -->|"writes, cross-region [postgres]"| n_catalog_db
  n_catalog_db -.->|"replication [postgres-streaming, at-least-once]"| n_catalog_db_replica
```
