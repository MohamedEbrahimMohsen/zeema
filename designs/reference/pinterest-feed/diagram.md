# pinterest-feed

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_web_client["web-client<br/><i>web-browser</i>"]
  n_mobile_client["mobile-client<br/><i>mobile-app</i>"]
  subgraph n_g_aws_us_east["aws-us-east (region)"]
    subgraph n_g_core["core (trust-zone)"]
      n_api_service["Python API (Thrift)<br/><i>container-service</i>"]
      n_smartfeed_service["SmartFeed service<br/><i>container-service</i>"]
      n_content_generator["SmartFeed content generator<br/><i>container-service</i>"]
      n_follower_service["Follower service<br/><i>container-service</i>"]
      n_pinnability["Pinnability<br/><i>tensorflow-serving</i>"]
      n_pixie["Pixie<br/><i>graph-store</i>"]
      n_zen["Zen<br/><i>graph-store</i>"]
      n_zookeeper["ZooKeeper<br/><i>zookeeper</i>"]
      n_pixie_graph_builder["Pixie graph builder<br/><i>container-worker</i>"]
      n_hadoop["Hadoop<br/><i>hadoop-yarn</i>"]
      n_mysql_fleet["sharded MySQL fleet<br/><i>mysql</i>"]
      n_pin_cache["pin_id to pin object<br/><i>memcached</i>"]
      n_board_cache["board_id to pin_ids<br/><i>redis</i>"]
      subgraph n_g_async_platform["async-platform (system)"]
        n_pacer_api["Pacer Thrift API<br/><i>container-service</i>"]
        n_pacer_broker["Pacer dequeue broker<br/><i>container-service</i>"]
        n_feed_jobs_queue["feed generation queue<br/><i>message-queue</i>"]
        n_media_jobs_queue["image transform queue<br/><i>message-queue</i>"]
        n_smartfeed_worker["SmartFeed worker<br/><i>container-worker</i>"]
        n_media_worker["image transform worker<br/><i>container-worker</i>"]
        n_helix["Apache Helix<br/><i>apache-helix</i>"]
      end
    end
    subgraph n_g_az_a["az-a (availability-zone)"]
      n_feed_pools_hbase["HBase pools cluster<br/><i>hbase</i>"]
      n_feed_materialised_hbase["HBase materialised content<br/><i>hbase</i>"]
    end
    subgraph n_g_az_b["az-b (availability-zone)"]
      n_feed_materialised_standby["HBase hot standby<br/><i>hbase</i>"]
    end
  end
  n_web_client -->|"https"| n_api_service
  n_mobile_client -->|"https"| n_api_service
  n_api_service -->|"shard configuration [zookeeper]"| n_zookeeper
  n_api_service -->|"get home feed [thrift]"| n_smartfeed_service
  n_api_service -->|"pin objects by id [memcached]"| n_pin_cache
  n_api_service -->|"board to pin ids [redis]"| n_board_cache
  n_api_service -->|"shard from the 64-bit id, no cross-shard join [mysql]"| n_mysql_fleet
  n_api_service -->|"related pins, p99 under 60 ms [thrift]"| n_pixie
  n_api_service -.->|"enqueue feed generation on a pin action [thrift, at-least-once]"| n_pacer_api
  n_smartfeed_service -->|"new pins since last visit [thrift]"| n_content_generator
  n_smartfeed_service -->|"materialised feed, one range scan [thrift]"| n_zen
  n_content_generator -->|"read pools in score order [thrift]"| n_zen
  n_zen -->|"pools, write-heavy cluster [hbase]"| n_feed_pools_hbase
  n_zen -->|"materialised content, read-heavy cluster [hbase]"| n_feed_materialised_hbase
  n_zen -->|"speculative read past the 99.9th percentile [hbase]"| n_feed_materialised_standby
  n_feed_materialised_hbase -.->|"hot standby, a few hundred ms behind [hbase-replication, at-least-once]"| n_feed_materialised_standby
  n_pacer_api -.->|"enqueue [mysql, at-least-once]"| n_feed_jobs_queue
  n_pacer_api -.->|"enqueue [mysql, at-least-once]"| n_media_jobs_queue
  n_pacer_broker -->|"prefetch the partitions this broker owns [mysql]"| n_feed_jobs_queue
  n_pacer_broker -->|"prefetch the partitions this broker owns [mysql]"| n_media_jobs_queue
  n_pacer_broker -->|"exclusive partition assignment [zookeeper]"| n_helix
  n_helix -->|"cluster state [zookeeper]"| n_zookeeper
  n_feed_jobs_queue -.->|"dedicated pod pool, dequeue under 1 ms [thrift, at-least-once]"| n_smartfeed_worker
  n_media_jobs_queue -.->|"dedicated pod pool [thrift, at-least-once]"| n_media_worker
  n_smartfeed_worker -->|"who this user follows [thrift]"| n_follower_service
  n_follower_service -->|"follow edges [mysql]"| n_mysql_fleet
  n_smartfeed_worker -->|"score each candidate pin [thrift]"| n_pinnability
  n_smartfeed_worker -->|"recommendation candidates [thrift]"| n_pixie
  n_smartfeed_worker -.->|"push scored pins into the user's pool [thrift, at-least-once]"| n_zen
  n_media_worker -->|"record the transformed image [mysql]"| n_mysql_fleet
  n_hadoop -.->|"pin-board edges from MapReduce [hdfs, at-least-once]"| n_pixie_graph_builder
  n_pixie_graph_builder -.->|"daily pruned graph, about 10 minutes to load [binary-load, at-least-once]"| n_pixie
```
