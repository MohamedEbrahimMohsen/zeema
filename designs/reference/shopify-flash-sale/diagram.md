# shopify-flash-sale

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_buyer_browser["Buyer browser and bots<br/><i>web-browser</i>"]
  subgraph n_g_internet_edge["Scriptable edge tier (trust-zone)"]
    n_edge_lb["Nginx + OpenResty<br/><i>nginx</i>"]
    n_sorting_hat["Sorting Hat<br/><i>consul</i>"]
    n_checkout_throttle["Checkout throttle<br/><i>redis-rate-limiter</i>"]
  end
  subgraph n_g_gcp_us_east["gcp-us-east (region)"]
    subgraph n_g_core["Stateless tier (trust-zone)"]
      n_shopify_core["Shopify Core<br/><i>container-service</i>"]
      n_vitess["vitess<br/><i>vitess</i>"]
      n_shop_mover["Ghostferry<br/><i>container-worker</i>"]
      n_kafka_events["kafka-events<br/><i>kafka</i>"]
      n_etl_pipeline["ETL / analytics pipeline<br/><i>container-worker</i>"]
    end
    subgraph n_g_pod_1["Pod 1 (cell)"]
      n_mysql_shard_1["mysql-shard-1<br/><i>mysql</i>"]
      n_pod_1_redis["pod-1-redis<br/><i>redis-queue</i>"]
      n_pod_1_memcached["pod-1-memcached<br/><i>memcached</i>"]
      n_pod_1_job_workers["pod-1-job-workers<br/><i>container-worker</i>"]
    end
  end
  subgraph n_g_gcp_eu_west["gcp-eu-west (region)"]
    n_storefront_renderer["Storefront renderer<br/><i>container-service</i>"]
    n_storefront_replica["Filtered storefront replica<br/><i>mysql</i>"]
    subgraph n_g_pod_2["Pod 2 (cell)"]
      n_mysql_shard_2["mysql-shard-2<br/><i>mysql</i>"]
      n_pod_2_redis["pod-2-redis<br/><i>redis-queue</i>"]
      n_pod_2_memcached["pod-2-memcached<br/><i>memcached</i>"]
      n_pod_2_job_workers["pod-2-job-workers<br/><i>container-worker</i>"]
    end
  end
  n_buyer_browser -->|"storefront and checkout traffic [https]"| n_edge_lb
  n_edge_lb -->|"shop_id to pod routing table [http]"| n_sorting_hat
  n_edge_lb -->|"per-shop leaky bucket, 5 s window [redis]"| n_checkout_throttle
  n_edge_lb -->|"queue page cached in Nginx; signed cookie skips the throttle once admitted [http]"| n_buyer_browser
  n_edge_lb -->|"routed to the shop's pod [http]"| n_shopify_core
  n_edge_lb -->|"render storefront [http]"| n_storefront_renderer
  n_shopify_core -->|"Semian-wrapped MySQL client [mysql]"| n_vitess
  n_vitess -->|"routed by shop_id [mysql]"| n_mysql_shard_1
  n_vitess -->|"routed by shop_id [mysql]"| n_mysql_shard_2
  n_shopify_core -->|"memcached"| n_pod_1_memcached
  n_shopify_core -->|"memcached"| n_pod_2_memcached
  n_shopify_core -.->|"enqueue background job [redis, at-least-once]"| n_pod_1_redis
  n_shopify_core -.->|"enqueue background job [redis, at-least-once]"| n_pod_2_redis
  n_pod_1_redis -.->|"redis, at-least-once"| n_pod_1_job_workers
  n_pod_2_redis -.->|"redis, at-least-once"| n_pod_2_job_workers
  n_pod_1_job_workers -->|"mysql"| n_mysql_shard_1
  n_pod_2_job_workers -->|"mysql"| n_mysql_shard_2
  n_shopify_core -.->|"domain events [kafka, at-least-once]"| n_kafka_events
  n_kafka_events -.->|"partitions sized for BFCM freshness [kafka, at-least-once]"| n_etl_pipeline
  n_mysql_shard_1 -.->|"filtered replication for data residency [mysql-replication]"| n_storefront_replica
  n_storefront_renderer -->|"load data, render Liquid [mysql]"| n_storefront_replica
  n_shop_mover -->|"SELECT ... FOR UPDATE batch copy [mysql]"| n_mysql_shard_1
  n_mysql_shard_1 -.->|"tail the source pod binlog [mysql-binlog, at-least-once]"| n_shop_mover
  n_shop_mover -.->|"replay onto the target pod [mysql, at-least-once]"| n_mysql_shard_2
  n_shop_mover -->|"multi-reader-single-writer writer lock [redis]"| n_pod_1_redis
  n_shop_mover -->|"atomic routing table switch [http]"| n_sorting_hat
```
