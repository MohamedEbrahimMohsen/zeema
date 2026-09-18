# notion-sharding

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_web_client["web-client<br/><i>web-browser</i>"]
  subgraph n_g_aws_us["aws-us (region)"]
    subgraph n_g_app_tier["app-tier (trust-zone)"]
      n_notion_app["Notion application<br/><i>container-service</i>"]
    end
    subgraph n_g_db_tier["db-tier (trust-zone)"]
      n_pgbouncer_cluster["PgBouncer, 4 clusters x 24 databases<br/><i>pgbouncer</i>"]
      n_postgres_monolith["Postgres monolith (pre-2021)<br/><i>aws-rds</i>"]
      n_postgres_shards_32["32 instances x 15 logical schemas<br/><i>aws-rds</i>"]
      n_postgres_shards_96["96 instances x 5 logical schemas<br/><i>aws-rds</i>"]
    end
    subgraph n_g_data_platform["data-platform (trust-zone)"]
      n_cdc_connectors["Debezium, one connector per Postgres host on EKS<br/><i>debezium</i>"]
      n_cdc_topics["One topic per table, 480 shards consolidated<br/><i>kafka</i>"]
      n_hudi_deltastreamer["Hudi Deltastreamer, COPY_ON_WRITE upsert<br/><i>spark-streaming</i>"]
      n_data_lake["S3 data lake, partitioned by shard<br/><i>s3</i>"]
      n_spark_job["Spark denormalisation and permission tree traversal<br/><i>spark-job</i>"]
      n_snowflake["Snowflake (insert-heavy and BI workloads)<br/><i>snowflake</i>"]
      n_fivetran["Fivetran (third-party and small datasets)<br/><i>fivetran</i>"]
      n_search_index["Search index<br/><i>elasticsearch</i>"]
    end
    subgraph n_g_migration["migration (system)"]
      n_audit_log["Audit log (double-write capture)<br/><i>aws-rds</i>"]
      n_catchup_worker["Backfill and catch-up script<br/><i>container-worker</i>"]
    end
  end
  n_web_client -->|"https"| n_notion_app
  n_notion_app -->|"query routed by space_id [postgres]"| n_pgbouncer_cluster
  n_pgbouncer_cluster -->|"24 databases per cluster [postgres]"| n_postgres_shards_96
  n_pgbouncer_cluster -->|"pre-reshard fleet [postgres]"| n_postgres_shards_32
  n_pgbouncer_cluster -->|"pre-2021 monolith [postgres]"| n_postgres_monolith
  n_pgbouncer_cluster -->|"double-write audit record [postgres]"| n_audit_log
  n_postgres_monolith -.->|"backfill 480 schemas, ~3 days on 96 CPUs [postgres]"| n_catchup_worker
  n_audit_log -.->|"replay double-write backlog, compare versions [postgres, at-least-once]"| n_catchup_worker
  n_catchup_worker -->|"catch-up apply before switchover [postgres]"| n_postgres_shards_32
  n_postgres_shards_32 -.->|"3 publications x 5 schemas, indexes rebuilt after copy [postgres-logical-replication, at-least-once]"| n_postgres_shards_96
  n_postgres_shards_96 -.->|"reversed stream, rollback path [postgres-logical-replication, at-least-once]"| n_postgres_shards_32
  n_notion_app -->|"dark read, compare up to 5 rows after a 1 s pause [postgres]"| n_postgres_shards_96
  n_postgres_shards_96 -.->|"tens of MB/sec of row changes [postgres-logical-decoding, at-least-once]"| n_cdc_connectors
  n_cdc_connectors -.->|"one topic per table [kafka, at-least-once]"| n_cdc_topics
  n_cdc_topics -.->|"kafka, at-least-once"| n_hudi_deltastreamer
  n_hudi_deltastreamer -.->|"COPY_ON_WRITE upsert, partitioned by shard [s3]"| n_data_lake
  n_postgres_shards_96 -.->|"RDS snapshot export, bootstrap within 24 hours [s3]"| n_data_lake
  n_data_lake -.->|"read Hudi tables [s3]"| n_spark_job
  n_spark_job -.->|"denormalised permission trees [snowflake]"| n_snowflake
  n_spark_job -.->|"index blocks [http, at-least-once]"| n_search_index
  n_fivetran -.->|"third-party and small datasets [snowflake]"| n_snowflake
```
