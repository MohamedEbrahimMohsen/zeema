# zerodha-kite

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_kite_web["Kite web<br/><i>web-browser</i>"]
  n_kite_mobile["Kite mobile<br/><i>mobile-app</i>"]
  n_partner_apps["Third-party Kite Connect apps<br/><i>sdk-client</i>"]
  subgraph n_g_colo["Zerodha data centres (exchange leased lines) (region)"]
    subgraph n_g_exchange_zone["Exchange-facing (trust-zone)"]
      n_oms["OMS (vendor)<br/><i>supplier-api</i>"]
      n_exchange["NSE / BSE / MCX<br/><i>supplier-api</i>"]
    end
  end
  subgraph n_g_aws["AWS (P2P leased lines to the racks) (region)"]
    n_contract_note_store["Contract-note object store<br/><i>s3</i>"]
    subgraph n_g_public_edge["Public edge (trust-zone)"]
      n_edge_proxy["HAProxy / NGINX<br/><i>haproxy</i>"]
      n_kite_connect["Kite Connect<br/><i>envoy-gateway</i>"]
      n_ticker["Ticker<br/><i>websocket-gateway</i>"]
    end
    subgraph n_g_core_vpc["Core VPC (vpc)"]
      n_kite_backend["Kite backend<br/><i>container-service</i>"]
      n_cache_populators["Cache populators<br/><i>container-worker</i>"]
      n_veto["Veto<br/><i>opa</i>"]
      n_veto_build["Veto compiler and validation servers<br/><i>container-worker</i>"]
      n_console["Console<br/><i>container-service</i>"]
      n_dungbeetle["DungBeetle (sql-jobber)<br/><i>container-worker</i>"]
      n_contract_note_workers["EOD contract-note workers (Tasqueue)<br/><i>container-worker</i>"]
      n_market_data_bus["NATS market-data transport<br/><i>nats-jetstream</i>"]
      n_kafka["Kafka central bus<br/><i>kafka</i>"]
      n_hot_redis_cache["Hot Redis cache<br/><i>redis</i>"]
      n_etag_map["E-Tag map<br/><i>redis</i>"]
      n_primary_postgres["Primary Postgres shards<br/><i>postgres</i>"]
      n_hot_cache_db["Hot-cache Postgres<br/><i>cache-cluster</i>"]
      n_clickhouse["ClickHouse<br/><i>clickhouse</i>"]
      n_log_pipeline["Vector agents and aggregators<br/><i>vector</i>"]
      n_prometheus["Prometheus<br/><i>prometheus</i>"]
    end
  end
  n_kite_web -->|"E-Tag sent, 304 when unchanged [https]"| n_edge_proxy
  n_kite_mobile -->|"E-Tag sent, 304 when unchanged [https]"| n_edge_proxy
  n_partner_apps -->|"OAuth-like token [https]"| n_kite_connect
  n_edge_proxy -->|"pooled connections [http]"| n_kite_backend
  n_kite_backend -->|"byte blob straight to the socket [redis]"| n_hot_redis_cache
  n_kite_backend -->|"E-Tag per user per resource [redis]"| n_etag_map
  n_kite_backend -->|"ACID system of record [postgres]"| n_primary_postgres
  n_kite_backend -->|"every order [http]"| n_veto
  n_kite_connect -->|"POST /orders/:variety [http]"| n_veto
  n_veto -->|"reject in place or proxy upstream [http-xml]"| n_oms
  n_oms -->|"exchange protocol over leased line [leased-line]"| n_exchange
  n_oms -.->|"COMPLETE, REJECTED, CANCELLED, UPDATE [postback, at-least-once]"| n_kite_backend
  n_veto_build -.->|"push .so plugin, hot reload [http, at-most-once]"| n_veto
  n_primary_postgres -.->|"source of the cached state [postgres, at-least-once]"| n_cache_populators
  n_kafka -.->|"consume the bus [kafka, at-least-once]"| n_cache_populators
  n_cache_populators -.->|"populate off the request path [redis, at-least-once]"| n_hot_redis_cache
  n_cache_populators -.->|"delete tag on invalidation [redis, at-least-once]"| n_etag_map
  n_kite_backend -.->|"central bus, systems unaware of each other [kafka, at-least-once]"| n_kafka
  n_exchange -.->|"~16M ticks/sec [nats, at-most-once]"| n_market_data_bus
  n_market_data_bus -.->|"last-value stream [nats, at-most-once]"| n_ticker
  n_kite_web -.->|"binary ticks, 3000 instruments per connection [wss, at-most-once]"| n_ticker
  n_kite_mobile -.->|"binary ticks [wss, at-most-once]"| n_ticker
  n_partner_apps -.->|"wss://ws.kite.trade [wss, at-most-once]"| n_ticker
  n_ticker -.->|"postbacks and alerts on the same socket [wss, at-most-once]"| n_partner_apps
  n_kite_connect -.->|"postback signed with SHA-256 [https, at-most-once]"| n_partner_apps
  n_console -.->|"heavy SQL read jobs queued, not run inline [http, at-least-once]"| n_dungbeetle
  n_dungbeetle -->|"load-capped by the queue [postgres]"| n_primary_postgres
  n_dungbeetle -.->|"one ephemeral table per result set [postgres, at-least-once]"| n_hot_cache_db
  n_console -->|"user filters and sorts [postgres]"| n_hot_cache_db
  n_console -->|"immutable financial data [http]"| n_clickhouse
  n_contract_note_workers -.->|"EOD, 99% of all writes [postgres, at-least-once]"| n_primary_postgres
  n_contract_note_workers -.->|"5.3k req/s, fixed prefix partitioning [https, at-least-once]"| n_contract_note_store
  n_kite_backend -.->|"agents ship, aggregators batch [vector, at-most-once]"| n_log_pipeline
  n_log_pipeline -.->|"batched INSERTs [http, at-least-once]"| n_clickhouse
  n_kite_backend -.->|"scrape, EC2 SD by tag [http, at-most-once]"| n_prometheus
```
