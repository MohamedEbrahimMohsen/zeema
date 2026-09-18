# linear-sync

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_linear_client["Linear client (web and desktop)<br/><i>desktop-app</i>"]
  n_workspace_indexeddb["IndexedDB workspace database<br/><i>cache-cluster</i>"]
  n_openai_embeddings["OpenAI embeddings<br/><i>openai-api</i>"]
  n_customer_webhooks["Customer webhook endpoints<br/><i>webhook-receiver</i>"]
  subgraph n_g_edge["Cloudflare edge (point-of-presence)"]
    n_region_proxy["Region proxy Worker<br/><i>cloudflare-workers</i>"]
  end
  subgraph n_g_global["Global services (trust-zone)"]
    n_global_auth_service["Global authentication service<br/><i>container-service</i>"]
  end
  subgraph n_g_us_east1["Google Cloud us-east1 (region)"]
    subgraph n_g_backend["Regional backend (trust-zone)"]
      n_public_graphql_api["Public GraphQL API<br/><i>container-service</i>"]
      n_private_graphql_api["Private GraphQL API<br/><i>container-service</i>"]
      n_delta_sync_read_service["Delta-sync read path<br/><i>container-service</i>"]
      n_public_sync_ws["Public sync WebSocket servers<br/><i>websocket-gateway</i>"]
      n_private_sync_ws["Private sync WebSocket servers<br/><i>websocket-gateway</i>"]
      n_task_runners["Task runners<br/><i>container-worker</i>"]
      n_sync_cdc_pipeline["Sync action CDC pipeline<br/><i>debezium</i>"]
    end
    subgraph n_g_data["Regional data stores (trust-zone)"]
      n_task_topic["Google Pub/Sub background tasks<br/><i>google-pubsub</i>"]
      n_redis_event_bus["Memorystore for Redis (event bus and cache)<br/><i>google-memorystore</i>"]
      n_sync_action_log["Sync action log<br/><i>raft-event-log</i>"]
      n_primary_postgres["Cloud SQL for PostgreSQL (primary)<br/><i>google-cloud-sql</i>"]
      n_postgres_read_replica["Cloud SQL read replica<br/><i>google-cloud-sql</i>"]
      n_turbopuffer_index["turbopuffer sync action index<br/><i>turbopuffer</i>"]
      n_issue_vectors["pgvector issue embeddings<br/><i>pgvector</i>"]
    end
  end
  n_linear_client -->|"models, _meta and _transaction [indexeddb]"| n_workspace_indexeddb
  n_linear_client -->|"GraphQL mutations and sync HTTP [https]"| n_region_proxy
  n_region_proxy -->|"signed JWT and target region [https]"| n_global_auth_service
  n_region_proxy -->|"forward with pre-signed header [https]"| n_public_graphql_api
  n_region_proxy -.->|"unmodified fetch pass-through [wss]"| n_private_sync_ws
  n_region_proxy -.->|"unmodified fetch pass-through [wss]"| n_public_sync_ws
  n_region_proxy -->|"sync bootstrap and batch hydration [https]"| n_delta_sync_read_service
  n_private_sync_ws -.->|"delta packets ordered by sync id [wss, at-least-once]"| n_linear_client
  n_private_sync_ws -->|"catch up from checkpoint sync id [https]"| n_delta_sync_read_service
  n_public_sync_ws -->|"catch up from checkpoint sync id [https]"| n_delta_sync_read_service
  n_public_graphql_api -->|"mutation [postgres]"| n_primary_postgres
  n_public_graphql_api -->|"append sync actions in the same transaction [postgres]"| n_sync_action_log
  n_public_graphql_api -.->|"publish new sync actions [redis, at-least-once]"| n_redis_event_bus
  n_redis_event_bus -.->|"fan-out to connected clients [redis, at-least-once]"| n_private_sync_ws
  n_redis_event_bus -.->|"fan-out to connected clients [redis, at-least-once]"| n_public_sync_ws
  n_sync_action_log -.->|"1 s p50, a few seconds p95 [postgres-logical-replication, at-least-once]"| n_sync_cdc_pipeline
  n_sync_cdc_pipeline -.->|"sync action metadata only [https, at-least-once]"| n_turbopuffer_index
  n_delta_sync_read_service -->|"stage 1: metadata scan over posting lists [https]"| n_turbopuffer_index
  n_delta_sync_read_service -->|"stage 2: late enrichment, head of log, turbopuffer fallback [postgres]"| n_sync_action_log
  n_primary_postgres -.->|"follower replica [postgres]"| n_postgres_read_replica
  n_task_runners -.->|"schedule one-to-many background task [pubsub, at-least-once]"| n_task_topic
  n_task_topic -.->|"run the task in every region [pubsub, at-least-once]"| n_task_runners
  n_task_runners -->|"background jobs [postgres]"| n_primary_postgres
  n_task_runners -->|"vector index migration ran on a follower [postgres]"| n_postgres_read_replica
  n_task_runners -.->|"issue embeddings [https]"| n_openai_embeddings
  n_task_runners -->|"store embeddings [postgres]"| n_issue_vectors
  n_task_runners -->|"service to service GraphQL (Zeus client) [https]"| n_private_graphql_api
  n_public_graphql_api -->|"similar issue search at creation [postgres]"| n_issue_vectors
  n_private_graphql_api -->|"create shared record, reuse returned id [https]"| n_global_auth_service
  n_private_graphql_api -.->|"shared record updates through the sync engine [https, at-least-once]"| n_global_auth_service
  n_private_graphql_api -->|"workspace data [postgres]"| n_primary_postgres
  n_public_graphql_api -.->|"workspace events [https, at-least-once]"| n_customer_webhooks
```
