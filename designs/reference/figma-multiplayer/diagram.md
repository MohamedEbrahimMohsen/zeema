# figma-multiplayer

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_figma_client["Figma editor (C++ compiled to WebAssembly)<br/><i>web-browser</i>"]
  subgraph n_g_us_west_2["Oregon (us-west-2) (region)"]
    subgraph n_g_realtime["Multiplayer cluster (trust-zone)"]
      n_multiplayer_network["Multiplayer network layer (Node.js)<br/><i>websocket-gateway</i>"]
      n_document_process["Multiplayer document process (Rust)<br/><i>container-service</i>"]
    end
    subgraph n_g_durability["Durability (trust-zone)"]
      n_file_lock["File lock (conditional write)<br/><i>dynamodb</i>"]
      n_journal["Write-ahead journal<br/><i>dynamodb</i>"]
      n_checkpoint_store["File checkpoints<br/><i>s3</i>"]
    end
    subgraph n_g_metadata["Metadata (trust-zone)"]
      n_web_app["Figma web application<br/><i>container-service</i>"]
      n_dbproxy["DBProxy<br/><i>pgcat</i>"]
      n_pgbouncer["PgBouncer connection pooling layer<br/><i>pgbouncer</i>"]
      n_topology_store["Database topology<br/><i>etcd</i>"]
      n_metadata_shards["Horizontally sharded Postgres (colos)<br/><i>aws-rds</i>"]
      n_metadata_replicas["Read replicas<br/><i>aws-rds</i>"]
    end
    subgraph n_g_livegraph["LiveGraph (trust-zone)"]
      n_livegraph_edge["LiveGraph Edge<br/><i>websocket-gateway</i>"]
      n_livegraph_invalidator["LiveGraph Invalidator<br/><i>debezium</i>"]
      n_livegraph_cache["LiveGraph Cache<br/><i>cache-cluster</i>"]
    end
  end
  subgraph n_g_replica_region["S3 replication target region (region)"]
    n_checkpoint_replica["Replicated checkpoints<br/><i>s3</i>"]
  end
  n_figma_client -.->|"edits applied optimistically, unacked changes resent [wss, at-least-once]"| n_multiplayer_network
  n_multiplayer_network -->|"message protocol over stdin/stdout, one process per file [stdio]"| n_document_process
  n_document_process -.->|"property-level fan-out [stdio, at-most-once]"| n_multiplayer_network
  n_multiplayer_network -.->|"fan-out to every editor, full resync on reconnect [wss, at-most-once]"| n_figma_client
  n_document_process -->|"conditional write, one writer per file [dynamodb]"| n_file_lock
  n_document_process -.->|"journal batch every ~500 ms, recovery replays higher sequence numbers [dynamodb, at-least-once]"| n_journal
  n_document_process -.->|"encode, compress and upload every 30-60 s, recovery loads the latest checkpoint [https, at-least-once]"| n_checkpoint_store
  n_checkpoint_store -.->|"cross-region replication, every change checkpointed within 30 min [s3-replication, at-least-once]"| n_checkpoint_replica
  n_figma_client -->|"files, teams, comments [https]"| n_web_app
  n_web_app -->|"SQL [postgres]"| n_dbproxy
  n_dbproxy -->|"logical to physical shard map [grpc]"| n_topology_store
  n_dbproxy -->|"pooled connections [postgres]"| n_pgbouncer
  n_pgbouncer -->|"routed query, scatter-gather when no shard key [postgres]"| n_metadata_shards
  n_pgbouncer -->|"read queries [postgres]"| n_metadata_replicas
  n_metadata_shards -.->|"replication [streaming-replication]"| n_metadata_replicas
  n_metadata_shards -.->|"single replication stream per shard [postgres-replication, at-least-once]"| n_livegraph_invalidator
  n_livegraph_invalidator -.->|"targeted invalidations to the owning cache shard [grpc, at-least-once]"| n_livegraph_cache
  n_figma_client -.->|"view subscriptions [wss]"| n_livegraph_edge
  n_livegraph_edge -->|"expand view into queries, subscribe [grpc]"| n_livegraph_cache
  n_livegraph_cache -->|"read-through on miss or invalidation [postgres]"| n_dbproxy
  n_livegraph_edge -.->|"re-fetched view results [wss, at-most-once]"| n_figma_client
```
