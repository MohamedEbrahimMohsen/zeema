# reddit-feed

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_web_client["web-client<br/><i>web-browser</i>"]
  n_mobile_client["mobile-client<br/><i>mobile-app</i>"]
  subgraph n_g_us_east["us-east (region)"]
    subgraph n_g_edge["CDN and proxy tier (trust-zone)"]
      n_cdn["Fastly<br/><i>content-delivery-network</i>"]
      n_http_proxy["http-proxy<br/><i>haproxy</i>"]
    end
    subgraph n_g_core["r2 and the Thing stores (trust-zone)"]
      n_r2["r2<br/><i>container-service</i>"]
      n_thrift_services["listing, API and comments services<br/><i>container-service</i>"]
      n_memcache["memcache (sgm, pagecache, rendercache)<br/><i>memcached</i>"]
      n_listing_cache["precomputed listings<br/><i>cache-cluster</i>"]
      n_thing_db["ThingDB (thing + data tables)<br/><i>postgres</i>"]
      n_cassandra["cassandra<br/><i>cassandra</i>"]
      n_vote_queue["vote-queue<br/><i>rabbitmq</i>"]
      n_comment_queue["comment-queue<br/><i>rabbitmq</i>"]
      n_thumbnail_queue["thumbnail-queue<br/><i>rabbitmq</i>"]
      n_vote_consumer["vote-consumer<br/><i>container-worker</i>"]
      n_comment_consumer["comment-consumer<br/><i>container-worker</i>"]
      n_thumbnail_consumer["thumbnail-consumer<br/><i>container-worker</i>"]
      n_search["search (Solr, then CloudSearch)<br/><i>aws-cloudsearch</i>"]
      n_metadata_pool["metadata-pool<br/><i>pgbouncer</i>"]
      n_media_metadata["media metadata store<br/><i>aurora</i>"]
      n_media_objects["media-objects<br/><i>s3</i>"]
    end
    subgraph n_g_safety["Kafka fleet and REV2 safety engine (system)"]
      n_thing_cdc["change events from the source systems<br/><i>kafka-connect</i>"]
      n_kafka["Kafka fleet (500+ brokers)<br/><i>kafka</i>"]
      n_safety_engine["REV2 (Stateful Functions)<br/><i>flink</i>"]
      n_rule_endpoints["Python rule endpoints (Lua rules)<br/><i>container-service</i>"]
      n_migration_validator["dual-write validation consumer<br/><i>container-worker</i>"]
    end
  end
  n_web_client -->|"page request [https]"| n_cdn
  n_mobile_client -->|"app request [https]"| n_cdn
  n_cdn -->|"miss and logged-in traffic [http]"| n_http_proxy
  n_http_proxy -->|"http"| n_r2
  n_http_proxy -->|"thrift"| n_thrift_services
  n_r2 -->|"batched gets, one page was 1000 calls [memcached]"| n_memcache
  n_r2 -->|"a page is a cache read [memcached]"| n_listing_cache
  n_r2 -->|"thing and data tables, sharded by type [postgres]"| n_thing_db
  n_r2 -->|"durable high-write features [cql]"| n_cassandra
  n_r2 -->|"query [http]"| n_search
  n_r2 -.->|"vote [amqp, at-least-once]"| n_vote_queue
  n_r2 -.->|"comment [amqp, at-least-once]"| n_comment_queue
  n_r2 -.->|"thumbnail job [amqp, at-least-once]"| n_thumbnail_queue
  n_vote_queue -.->|"partitioned by subreddit id [amqp, at-least-once]"| n_vote_consumer
  n_comment_queue -.->|"amqp, at-least-once"| n_comment_consumer
  n_thumbnail_queue -.->|"amqp, at-least-once"| n_thumbnail_consumer
  n_vote_consumer -->|"apply vote [postgres]"| n_thing_db
  n_comment_consumer -->|"rebuild comment tree [cql]"| n_cassandra
  n_vote_consumer -.->|"recompute sorted listing [memcached, at-least-once]"| n_listing_cache
  n_comment_consumer -.->|"recompute comment listing [memcached, at-least-once]"| n_listing_cache
  n_thumbnail_consumer -->|"store thumbnail [https]"| n_media_objects
  n_thrift_services -->|"memcached"| n_memcache
  n_thrift_services -->|"listing service read [memcached]"| n_listing_cache
  n_thrift_services -->|"media metadata, 100k rps [postgres]"| n_metadata_pool
  n_metadata_pool -->|"pooled connections [postgres]"| n_media_metadata
  n_thrift_services -->|"media file [https]"| n_media_objects
  n_thing_db -.->|"change events [postgres-wal, at-least-once]"| n_thing_cdc
  n_thing_cdc -.->|"source-system change topic [kafka, at-least-once]"| n_kafka
  n_kafka -.->|"dual-write comparison [kafka, at-least-once]"| n_migration_validator
  n_migration_validator -->|"dual read, compare [postgres]"| n_metadata_pool
  n_kafka -.->|"index documents [http, at-least-once]"| n_search
  n_r2 -.->|"posts and comments, protobuf [kafka, at-least-once]"| n_kafka
  n_thrift_services -.->|"posts and comments, protobuf [kafka, at-least-once]"| n_kafka
  n_kafka -.->|"ingress topics, replay by offset reset [kafka, at-least-once]"| n_safety_engine
  n_safety_engine -->|"dispatch to remote Lua rule [http]"| n_rule_endpoints
  n_safety_engine -.->|"per-action-type egress topics [kafka, at-least-once]"| n_kafka
  n_rule_endpoints -->|"poll rule bundles pushed from GitHub CI [https]"| n_media_objects
```
