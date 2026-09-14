# nearby-friends

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_mobile_client["Mobile client<br/><i>mobile-app</i>"]
  subgraph n_g_book_region["Single region (book design) (region)"]
    subgraph n_g_edge_tier["Public edge (trust-zone)"]
      n_load_balancer["Load balancer<br/><i>load-balancer-tier</i>"]
    end
    subgraph n_g_core_tier["Backend (trust-zone)"]
      n_rest_api["RESTful API servers<br/><i>container-service</i>"]
      n_websocket_server["WebSocket servers<br/><i>websocket-gateway</i>"]
      n_redis_pubsub["Redis pub/sub cluster<br/><i>redis-pubsub</i>"]
      n_location_cache["Location cache<br/><i>redis</i>"]
      n_user_db["User database<br/><i>relational-database</i>"]
      n_location_history["Location history database<br/><i>cassandra</i>"]
      n_zookeeper["ZooKeeper<br/><i>zookeeper</i>"]
    end
  end
  subgraph n_g_zenly_production["Zenly on Google Cloud (system)"]
    n_zenly_location_service["Zenly location processing (GKE)<br/><i>container-service</i>"]
    n_zenly_scylla["Scylla on Compute Engine<br/><i>scylladb</i>"]
    n_zenly_kms["Cloud KMS<br/><i>google-cloud-kms</i>"]
    n_zenly_data_lake["Cloud Storage data lake<br/><i>gcs</i>"]
    n_zenly_bigquery["BigQuery<br/><i>bigquery</i>"]
  end
  n_mobile_client -->|"REST calls and WebSocket handshake [https]"| n_load_balancer
  n_load_balancer -->|"friends, profiles, auth [http]"| n_rest_api
  n_load_balancer -.->|"place the connection, sticky for its lifetime [websocket]"| n_websocket_server
  n_mobile_client -.->|"location every 30 s [websocket, at-most-once]"| n_websocket_server
  n_websocket_server -->|"friend list at connection init [http]"| n_rest_api
  n_websocket_server -->|"latest lat/long with TTL [redis]"| n_location_cache
  n_websocket_server -.->|"append location history [cql, at-least-once]"| n_location_history
  n_websocket_server -.->|"publish to the user's own channel [redis, at-most-once]"| n_redis_pubsub
  n_websocket_server -->|"subscribe to every friend's channel at init [redis]"| n_redis_pubsub
  n_redis_pubsub -.->|"fan-out to the friends' connection handlers [redis, at-most-once]"| n_websocket_server
  n_websocket_server -.->|"push a friend's location if within the radius [websocket, at-most-once]"| n_mobile_client
  n_websocket_server -.->|"watch the pub/sub hash ring [zookeeper, at-most-once]"| n_zookeeper
  n_redis_pubsub -.->|"pub/sub server join and leave [zookeeper, at-most-once]"| n_zookeeper
  n_rest_api -->|"users and friendships [sql]"| n_user_db
  n_mobile_client -.->|"Zenly: update processed in under 300 ms [https, at-least-once]"| n_zenly_location_service
  n_zenly_location_service -->|"primary data store [cql]"| n_zenly_scylla
  n_zenly_location_service -->|"envelope keys [https]"| n_zenly_kms
  n_zenly_location_service -.->|"several TB a day [https, at-least-once]"| n_zenly_data_lake
  n_zenly_data_lake -.->|"daily load for live dashboards [https, at-least-once]"| n_zenly_bigquery
```
