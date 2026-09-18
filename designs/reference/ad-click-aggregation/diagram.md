# ad-click-aggregation

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_ad_client["Mobile and web clients<br/><i>mobile-app</i>"]
  subgraph n_g_region_a["Region A (region)"]
    subgraph n_g_ingestion["Ingestion (trust-zone)"]
      n_log_ingest["Log watcher<br/><i>container-worker</i>"]
      n_raw_click_events["Kafka (raw ad events)<br/><i>kafka</i>"]
      n_order_events["Kafka (order data)<br/><i>kafka</i>"]
    end
    subgraph n_g_streaming["Streaming (trust-zone)"]
      n_map_job["Map nodes<br/><i>flink</i>"]
      n_aggregate_job["Aggregation job<br/><i>flink</i>"]
      n_reduce_job["Reduce nodes<br/><i>flink</i>"]
      n_dedup_state["Dedup state (keyed by event id)<br/><i>cache-cluster</i>"]
      n_attribution_job["Attribution job<br/><i>flink</i>"]
      n_order_store["Docstore<br/><i>nosql-store</i>"]
      n_aggregate_events["Kafka (aggregates, transactional)<br/><i>kafka</i>"]
      n_checkpoint_store["Checkpoint store<br/><i>blob-store</i>"]
      n_union_load_job["Union and load job<br/><i>flink</i>"]
    end
    subgraph n_g_serving["Serving and batch (trust-zone)"]
      n_olap_store["Pinot (minute aggregates)<br/><i>pinot</i>"]
      n_warehouse["Hive<br/><i>hive</i>"]
      n_raw_event_store["Raw event store<br/><i>cassandra</i>"]
      n_query_service["Query service<br/><i>container-service</i>"]
      n_reconciliation_job["Reconciliation batch job<br/><i>spark-job</i>"]
      n_alerting["Pacing and downtime alerting<br/><i>observability-stack</i>"]
    end
  end
  subgraph n_g_region_b["Region B (region)"]
    n_aggregate_events_b["Kafka (Region B aggregates)<br/><i>kafka</i>"]
  end
  n_ad_client -.->|"click and impression beacons (duplicates possible) [https, at-least-once]"| n_log_ingest
  n_log_ingest -.->|"publish raw ad events [kafka, at-least-once]"| n_raw_click_events
  n_raw_click_events -.->|"kafka, at-least-once"| n_map_job
  n_map_job -.->|"repartition by ad id [shuffle]"| n_aggregate_job
  n_aggregate_job -->|"drop duplicate event ids [keyed-state]"| n_dedup_state
  n_aggregate_job -->|"store ad events for attribution [docstore]"| n_order_store
  n_aggregate_job -.->|"partial minute counts and top-N heaps [shuffle]"| n_reduce_job
  n_reduce_job -.->|"transactional write, 2PC on checkpoint [kafka, exactly-once]"| n_aggregate_events
  n_order_events -.->|"order data [kafka, at-least-once]"| n_attribution_job
  n_attribution_job -->|"match ad events for order [docstore]"| n_order_store
  n_attribution_job -.->|"attributed conversions, deterministic record UUID [kafka, exactly-once]"| n_aggregate_events
  n_aggregate_events -.->|"read_committed [kafka, exactly-once]"| n_union_load_job
  n_aggregate_events_b -.->|"Region B output [kafka, exactly-once]"| n_union_load_job
  n_union_load_job -->|"upsert by record UUID [pinot]"| n_olap_store
  n_union_load_job -.->|"load, deduplicated by record UUID [hive, at-least-once]"| n_warehouse
  n_map_job -.->|"append raw events for replay [cql, at-least-once]"| n_raw_event_store
  n_aggregate_job -.->|"checkpoint every 2 minutes [blob, at-least-once]"| n_checkpoint_store
  n_attribution_job -.->|"checkpoint every 2 minutes [blob, at-least-once]"| n_checkpoint_store
  n_union_load_job -.->|"checkpoint every 2 minutes [blob, at-least-once]"| n_checkpoint_store
  n_query_service -->|"counts per ad per minute, top ads [sql]"| n_olap_store
  n_reconciliation_job -.->|"nightly recompute from raw events [cql]"| n_raw_event_store
  n_reconciliation_job -.->|"batch truth [hive]"| n_warehouse
  n_reconciliation_job -.->|"compare streaming aggregates to batch results [sql]"| n_olap_store
  n_aggregate_job -.->|"job liveness and pacing metrics [http, at-least-once]"| n_alerting
```
