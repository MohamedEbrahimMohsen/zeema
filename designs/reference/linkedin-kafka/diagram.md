# linkedin-kafka

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_non_java_client["Non-Java client<br/><i>sdk-client</i>"]
  subgraph n_g_dc_us["dc-us (region)"]
    subgraph n_g_us_producers["us-producers (trust-zone)"]
      n_producer_service["Producer services (LiKafka)<br/><i>container-service</i>"]
      n_rest_proxy["Kafka REST proxy<br/><i>envoy-gateway</i>"]
      n_schema_registry["LinkedIn schema registry<br/><i>confluent-schema-registry</i>"]
    end
    subgraph n_g_us_pipeline["us-pipeline (trust-zone)"]
      n_local_kafka["Local Kafka cluster (US)<br/><i>kafka</i>"]
      n_aggregate_kafka["Aggregate Kafka cluster<br/><i>kafka</i>"]
      n_cdc_kafka["CDC Kafka cluster<br/><i>kafka</i>"]
      n_brooklin["Brooklin<br/><i>brooklin</i>"]
      n_zookeeper["ZooKeeper<br/><i>zookeeper</i>"]
      n_cruise_control["Cruise Control<br/><i>container-worker</i>"]
      n_kafka_monitor["Kafka Monitor<br/><i>observability-stack</i>"]
      n_burrow["Burrow<br/><i>observability-stack</i>"]
      n_audit_trail["Kafka audit / Bean Counter<br/><i>observability-stack</i>"]
      n_topic_gc["TopicGC<br/><i>cron-job</i>"]
    end
    subgraph n_g_us_consumers["us-consumers (trust-zone)"]
      n_samza["Samza<br/><i>samza</i>"]
      n_espresso["Espresso<br/><i>nosql-store</i>"]
      n_venice["Venice<br/><i>nosql-store</i>"]
      n_pinot["Pinot<br/><i>pinot</i>"]
      n_gobblin["Gobblin<br/><i>container-worker</i>"]
      n_hadoop["Hadoop (HDFS)<br/><i>hdfs</i>"]
    end
  end
  subgraph n_g_dc_sg["dc-sg (region)"]
    subgraph n_g_sg_producers["sg-producers (trust-zone)"]
      n_producer_service_sg["Producer services (Singapore)<br/><i>container-service</i>"]
      n_local_kafka_sg["Local Kafka cluster (Singapore)<br/><i>kafka</i>"]
    end
  end
  n_non_java_client -->|"publish over HTTP [http]"| n_rest_proxy
  n_rest_proxy -.->|"guaranteed delivery client [kafka, at-least-once]"| n_local_kafka
  n_producer_service -->|"register / look up Avro schema [http]"| n_schema_registry
  n_rest_proxy -->|"resolve schema id [http]"| n_schema_registry
  n_producer_service -.->|"LiKafka produce: Avro, schema id, audit header [kafka, at-least-once]"| n_local_kafka
  n_producer_service_sg -.->|"LiKafka produce [kafka, at-least-once]"| n_local_kafka_sg
  n_local_kafka -->|"cluster metadata, controller election [zookeeper]"| n_zookeeper
  n_aggregate_kafka -->|"cluster metadata, controller election [zookeeper]"| n_zookeeper
  n_brooklin -->|"datastream metadata, leader election [zookeeper]"| n_zookeeper
  n_local_kafka -.->|"mirror source [kafka, at-least-once]"| n_brooklin
  n_local_kafka_sg -.->|"mirror source, cross-datacenter [kafka, at-least-once]"| n_brooklin
  n_brooklin -.->|"mirror into the aggregate tier [kafka, at-least-once]"| n_aggregate_kafka
  n_espresso -.->|"change capture [espresso-cdc, at-least-once]"| n_brooklin
  n_brooklin -.->|"CDC datastream [kafka, at-least-once]"| n_cdc_kafka
  n_cdc_kafka -.->|"partition replication over the log [kafka, at-least-once]"| n_espresso
  n_aggregate_kafka -.->|"input topics [kafka, at-least-once]"| n_samza
  n_samza -.->|"output topics and changelog state [kafka, at-least-once]"| n_aggregate_kafka
  n_aggregate_kafka -.->|"near-line ingestion [kafka, at-least-once]"| n_venice
  n_hadoop -.->|"Kafka push job: batch data to Venice [kafka, at-least-once]"| n_aggregate_kafka
  n_aggregate_kafka -.->|"real-time OLAP ingestion [kafka, at-least-once]"| n_pinot
  n_aggregate_kafka -.->|"ingestion pull [kafka, at-least-once]"| n_gobblin
  n_gobblin -.->|"land into HDFS [hdfs, at-least-once]"| n_hadoop
  n_kafka_monitor -->|"synthetic produce and consume [kafka]"| n_local_kafka
  n_burrow -.->|"consumer offsets, sliding window of ~10 commits [kafka]"| n_aggregate_kafka
  n_audit_trail -.->|"producer vs consumer counts per 10-minute window [kafka]"| n_aggregate_kafka
  n_cruise_control -.->|"rebalance partitions, self-heal broker failures [kafka-admin]"| n_local_kafka
  n_topic_gc -.->|"delete unused topics [kafka-admin]"| n_local_kafka
```
