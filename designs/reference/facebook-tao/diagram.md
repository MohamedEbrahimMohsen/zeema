# facebook-tao

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_end_user["end-user<br/><i>web-browser</i>"]
  n_wormhole["Wormhole pub-sub<br/><i>mqtt-broker</i>"]
  n_global_config["Global configuration<br/><i>etcd</i>"]
  subgraph n_g_master_region["Region holding the database masters (region)"]
    n_master_leader["Leader tier in the shard's master region<br/><i>cache-cluster</i>"]
    n_inverse_repair_job["Inverse-association repair job<br/><i>container-worker</i>"]
    subgraph n_g_master_storage["Storage cluster (trust-zone)"]
      n_binlog_stream["Replication stream with embedded invalidations and refills<br/><i>debezium</i>"]
      n_master_db["Master MySQL shards<br/><i>mysql</i>"]
    end
  end
  subgraph n_g_slave_region["A slave region (region)"]
    n_flighttracker["FlightTracker (Tickets)<br/><i>cache-cluster</i>"]
    n_follower_backup["Follower tier (L1), backup<br/><i>cache-cluster</i>"]
    n_leader["Leader tier (L2), one per region<br/><i>cache-cluster</i>"]
    n_refill_library["RefillLibrary<br/><i>cache-cluster</i>"]
    n_regional_pool["Regional pool<br/><i>memcached</i>"]
    n_index_pipeline["Asynchronous index update pipeline<br/><i>container-worker</i>"]
    n_secondary_index["Global secondary indexes and materialised views<br/><i>elasticsearch</i>"]
    subgraph n_g_frontend_cluster["Frontend cluster (trust-zone)"]
      n_frontend_lb["Load balancer<br/><i>load-balancer-tier</i>"]
      n_web_server["PHP web tier<br/><i>container-service</i>"]
      n_client_hot_cache["TAO client-side hot-item cache<br/><i>cache-cluster</i>"]
      n_follower_primary["Follower tier (L1), primary<br/><i>cache-cluster</i>"]
      n_mcrouter["mcrouter<br/><i>proxysql</i>"]
      n_memcache_tier["memcache lookaside tier<br/><i>memcached</i>"]
      n_gutter_pool["Gutter pool<br/><i>memcached</i>"]
    end
    subgraph n_g_storage_cluster["Storage cluster (trust-zone)"]
      n_mcsqueal["mcsqueal<br/><i>debezium</i>"]
      n_slave_db["Slave MySQL shards<br/><i>mysql</i>"]
    end
  end
  n_end_user -->|"https"| n_frontend_lb
  n_frontend_lb -->|"sticky to one frontend cluster [http]"| n_web_server
  n_web_server -->|"fetch the Ticket once per request [rpc]"| n_flighttracker
  n_web_server -->|"hot objects and associations, checked by version [in-process]"| n_client_hot_cache
  n_web_server -->|"Ticket-inclusive graph read, shard by consistent hash [tao-rpc]"| n_follower_primary
  n_web_server -->|"failover tier when the shard's server is marked down [tao-rpc]"| n_follower_backup
  n_web_server -->|"Ticket-inclusive index read [rpc]"| n_secondary_index
  n_web_server -->|"lookaside get/set/delete outside the graph model [memcache]"| n_mcrouter
  n_follower_primary -.->|"access-rate feedback fills and versions the client cache [tao-rpc, at-most-once]"| n_client_hot_cache
  n_follower_primary -->|"recent writes consulted on a miss [in-process]"| n_refill_library
  n_follower_primary -->|"every read miss and every write [tao-rpc]"| n_leader
  n_follower_backup -->|"every read miss and every write [tao-rpc]"| n_leader
  n_follower_primary -->|"0.15% of misses, when the leader is unavailable [mysql]"| n_slave_db
  n_leader -->|"always the local region's database [mysql]"| n_slave_db
  n_leader -->|"forward the write to the shard's master region [tao-rpc]"| n_master_leader
  n_master_leader -->|"synchronous write: the consistent source of truth [mysql]"| n_master_db
  n_master_leader -.->|"appendWrite(SessionId, Ticket) [rpc, at-least-once]"| n_flighttracker
  n_inverse_repair_job -.->|"repair hanging associations [tao-rpc, at-least-once]"| n_master_leader
  n_leader -.->|"invalidate objects, refill association lists [tao-invalidation, at-least-once]"| n_follower_primary
  n_leader -.->|"invalidate objects, refill association lists [tao-invalidation, at-least-once]"| n_follower_backup
  n_master_db -.->|"data plus embedded cache-maintenance messages [mysql-binlog, at-least-once]"| n_binlog_stream
  n_binlog_stream -.->|"replicate to each region's slave shards [mysql-replication, at-least-once]"| n_slave_db
  n_binlog_stream -.->|"released only after the transaction is replicated locally [pubsub, at-least-once]"| n_wormhole
  n_wormhole -.->|"version-tagged invalidate / refill [pubsub, at-least-once]"| n_leader
  n_wormhole -.->|"the same at-least-once stream, ~3 minutes retained [pubsub, at-least-once]"| n_refill_library
  n_wormhole -.->|"graph writes to reshard, transform and filter [pubsub, at-least-once]"| n_index_pipeline
  n_index_pipeline -.->|"index asynchronously, off the write path [http, at-least-once]"| n_secondary_index
  n_slave_db -.->|"tail the commit log and extract deletes [mysql-binlog, at-least-once]"| n_mcsqueal
  n_mcsqueal -.->|"batched deletes to every frontend cluster [memcache, at-least-once]"| n_mcrouter
  n_mcrouter -->|"unpack the batch, route by key [memcache]"| n_memcache_tier
  n_mcrouter -->|"keys whose cache server has failed [memcache]"| n_gutter_pool
  n_mcrouter -->|"low-access-rate items and remote markers [memcache]"| n_regional_pool
  n_global_config -->|"per-shard mastership and automatic promotion [config]"| n_master_db
  n_global_config -->|"mark down replicas that fall too far behind [config]"| n_slave_db
```
