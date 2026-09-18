# airbnb-search

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_client["Web and mobile clients<br/><i>user-device</i>"]
  subgraph n_g_aws_prod["aws-prod (region)"]
    subgraph n_g_prod_vpc["prod-vpc (vpc)"]
      subgraph n_g_edge["edge (trust-zone)"]
        n_api_gateway["api-gateway<br/><i>envoy-gateway</i>"]
      end
      subgraph n_g_service_network["service-network (trust-zone)"]
        n_presentation_service["Presentation services<br/><i>container-service</i>"]
        n_middle_tier_service["Middle-tier utility services<br/><i>container-service</i>"]
        n_derived_data_service["Derived data services<br/><i>container-service</i>"]
        n_data_service["Data services<br/><i>container-service</i>"]
        n_monorail["Monorail<br/><i>container-service</i>"]
        n_search_ranking_service["Search ranking<br/><i>container-service</i>"]
        n_search_indexer["Search indexing service<br/><i>container-worker</i>"]
        n_riverbed["Riverbed<br/><i>container-worker</i>"]
        n_airstream["Airstream<br/><i>spark-streaming</i>"]
        n_user_signals_flink["User Signals Platform<br/><i>flink</i>"]
      end
      subgraph n_g_data_tier["data-tier (trust-zone)"]
        n_spinaltap["SpinalTap<br/><i>debezium</i>"]
        n_zookeeper["zookeeper<br/><i>zookeeper</i>"]
        n_kafka_cdc["Kafka (CDC cluster)<br/><i>kafka</i>"]
        n_kafka_analytics["Kafka (analytics cluster)<br/><i>kafka</i>"]
        n_listings_db["listings-db<br/><i>mysql</i>"]
        n_dynamo_store["dynamo-store<br/><i>dynamodb</i>"]
        n_himeji["Himeji<br/><i>spicedb</i>"]
        n_himeji_cache["Himeji cache<br/><i>cache-cluster</i>"]
        n_himeji_store["Himeji Aurora<br/><i>aurora</i>"]
        n_mussel["Mussel<br/><i>hbase</i>"]
        n_search_index["search-index<br/><i>elasticsearch</i>"]
        n_hive["hive<br/><i>hive</i>"]
      end
    end
  end
  n_client -->|"https"| n_api_gateway
  n_client -.->|"logging events [https, at-most-once]"| n_kafka_analytics
  n_api_gateway -->|"thrift"| n_presentation_service
  n_api_gateway -->|"endpoints not yet drained [http]"| n_monorail
  n_presentation_service -->|"shared validation [thrift]"| n_middle_tier_service
  n_presentation_service -->|"parallel async RPC [thrift]"| n_derived_data_service
  n_presentation_service -->|"parallel async RPC [thrift]"| n_data_service
  n_presentation_service -->|"rank listings [thrift]"| n_search_ranking_service
  n_presentation_service -->|"search query [http]"| n_search_index
  n_middle_tier_service -->|"thrift"| n_data_service
  n_derived_data_service -->|"thrift"| n_data_service
  n_derived_data_service -->|"read derived data [hbase]"| n_mussel
  n_monorail -->|"ActiveRecord adapter shim [thrift]"| n_data_service
  n_data_service -->|"authorization check per access [grpc]"| n_himeji
  n_data_service -->|"exclusive owner [mysql]"| n_listings_db
  n_data_service -->|"exclusive owner [dynamodb]"| n_dynamo_store
  n_himeji -->|"98% hit [internal]"| n_himeji_cache
  n_himeji_cache -->|"cache miss [mysql]"| n_himeji_store
  n_listings_db -.->|"binlog [mysql-binlog, at-least-once]"| n_spinaltap
  n_dynamo_store -.->|"streams [dynamodb-streams, at-least-once]"| n_spinaltap
  n_spinaltap -->|"checkpoints, leader election [zookeeper]"| n_zookeeper
  n_spinaltap -.->|"thrift mutation events [kafka, at-least-once]"| n_kafka_cdc
  n_kafka_cdc -.->|"kafka, at-least-once"| n_search_indexer
  n_search_indexer -.->|"index [http, at-least-once]"| n_search_index
  n_kafka_cdc -.->|"invalidation [kafka, at-least-once]"| n_himeji_cache
  n_kafka_cdc -.->|"write-ahead log [kafka, at-least-once]"| n_mussel
  n_kafka_cdc -.->|"materialised views [kafka, at-least-once]"| n_riverbed
  n_hive -.->|"bulk load, merged by timestamp [hfile]"| n_mussel
  n_kafka_analytics -.->|"kafka, at-least-once"| n_airstream
  n_kafka_analytics -.->|"kafka, at-least-once"| n_user_signals_flink
  n_airstream -.->|"hourly partitions, HBase dedup [hdfs]"| n_hive
```
