# tiktok-recommendation

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_mobile_client["TikTok / Douyin app<br/><i>mobile-app</i>"]
  subgraph n_g_region_a["region-a (region)"]
    subgraph n_g_serving["serving (trust-zone)"]
      n_model_server["Monolith model server<br/><i>tensorflow-serving</i>"]
      n_serving_ps["Serving parameter server<br/><i>cache-cluster</i>"]
    end
    subgraph n_g_training["training (trust-zone)"]
      n_training_worker["Monolith training worker<br/><i>container-worker</i>"]
      n_param_sync["Parameter synchroniser<br/><i>container-worker</i>"]
      n_flink_joiner["Online feature joiner<br/><i>flink</i>"]
      n_kafka_actions["User action log<br/><i>kafka</i>"]
      n_kafka_features["Feature log<br/><i>kafka</i>"]
      n_kafka_training["Joined training examples<br/><i>kafka</i>"]
      n_training_ps["Training parameter server<br/><i>nosql-store</i>"]
      n_late_label_store["On-disk key-value storage<br/><i>nosql-store</i>"]
      n_snapshot_store["Daily parameter snapshots<br/><i>blob-store</i>"]
    end
    subgraph n_g_bytegraph_primary["bytegraph-primary (system)"]
      n_bytegraph_bge["ByteGraph BGE<br/><i>graph-store</i>"]
      n_bytegraph_bgs["ByteGraph BGS<br/><i>graph-store</i>"]
      n_bytegraph_kv["ByteGraph persistent KV<br/><i>nosql-store</i>"]
    end
  end
  subgraph n_g_region_b["region-b (region)"]
    subgraph n_g_bytegraph_remote["bytegraph-remote (system)"]
      n_bytegraph_kv_remote["ByteGraph persistent KV, second region<br/><i>nosql-store</i>"]
    end
  end
  n_mobile_client -->|"feed request [grpc]"| n_model_server
  n_model_server -->|"sparse embedding lookup [grpc]"| n_serving_ps
  n_model_server -->|"social and interaction lookups [grpc]"| n_bytegraph_bge
  n_mobile_client -.->|"watch, like, follow [kafka, at-least-once]"| n_kafka_actions
  n_model_server -.->|"features of the served request [kafka, at-least-once]"| n_kafka_features
  n_kafka_actions -.->|"labels, keyed by request id [kafka, at-least-once]"| n_flink_joiner
  n_kafka_features -.->|"features, keyed by request id [kafka, at-least-once]"| n_flink_joiner
  n_flink_joiner -->|"park features waiting for a late label [rocksdb]"| n_late_label_store
  n_late_label_store -->|"re-read when the label finally arrives [rocksdb]"| n_flink_joiner
  n_flink_joiner -.->|"joined training example [kafka, at-least-once]"| n_kafka_training
  n_kafka_training -.->|"kafka, at-least-once"| n_training_worker
  n_training_worker -->|"apply sparse and dense gradients [grpc]"| n_training_ps
  n_param_sync -->|"read touched sparse keys [grpc]"| n_training_ps
  n_param_sync -.->|"sparse push per minute, dense per day [grpc, at-least-once]"| n_serving_ps
  n_training_ps -.->|"daily snapshot [https, at-least-once]"| n_snapshot_store
  n_bytegraph_bge -->|"two-phase commit, predicate pushdown [grpc]"| n_bytegraph_bgs
  n_bytegraph_bgs -->|"edge-tree pages and write-ahead log [grpc]"| n_bytegraph_kv
  n_bytegraph_kv -.->|"multi-leader, last-write-wins on hybrid logical clocks [replication, at-least-once]"| n_bytegraph_kv_remote
```
