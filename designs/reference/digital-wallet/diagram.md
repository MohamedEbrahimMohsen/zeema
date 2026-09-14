# digital-wallet

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_wallet_client["Wallet clients<br/><i>user-device</i>"]
  subgraph n_g_edge["Client edge (trust-zone)"]
    n_wallet_api["Wallet service (transfer API)<br/><i>container-service</i>"]
  end
  subgraph n_g_internal["Wallet internal (trust-zone)"]
    subgraph n_g_wallet_core["Wallet core (event sourcing, CQRS) (system)"]
      n_shard_map["ZooKeeper shard map<br/><i>zookeeper</i>"]
      n_saga_coordinator["Saga coordinator<br/><i>cadence</i>"]
      n_command_queue["Transfer command queue<br/><i>message-queue</i>"]
      n_state_machine["Wallet state machine (per shard)<br/><i>container-service</i>"]
      n_event_log["Per-shard event log (Raft, mmap)<br/><i>raft-event-log</i>"]
      n_snapshot_store["Snapshot store<br/><i>blob-store</i>"]
      n_read_view_builder["CQRS read-view state machines<br/><i>container-worker</i>"]
      n_balance_read_store["Read-only balance views<br/><i>nosql-store</i>"]
      n_replayer["Reproducibility replayer<br/><i>container-worker</i>"]
    end
    subgraph n_g_ledgerstore["LedgerStore (system)"]
      n_ledger_store["LedgerStore (LSG)<br/><i>double-entry-ledger</i>"]
      n_docstore["Docstore (LedgerStore backing store)<br/><i>nosql-store</i>"]
      n_eventual_indexes["Eventually consistent indexes (Docstore materialised views)<br/><i>nosql-store</i>"]
      n_sealing_service["Sealing service (30-minute windows, signed manifests)<br/><i>cron-job</i>"]
      n_cold_tier["Cold tier (TerraBlob)<br/><i>blob-store</i>"]
      n_backfill_limiter["Backfill RateLimiter (AIMD)<br/><i>in-process-limiter</i>"]
    end
    subgraph n_g_migration["DynamoDB to LedgerStore migration (system)"]
      n_legacy_dynamodb["DynamoDB (legacy ledger store, 12 weeks hot)<br/><i>dynamodb</i>"]
      n_backfill_worker["Migration backfill workers<br/><i>container-worker</i>"]
      n_shadow_validator["Shadow validation (target 99.99% complete and correct)<br/><i>container-worker</i>"]
      n_offline_validator["Offline validation (760B records, 70 TB)<br/><i>spark-job</i>"]
    end
  end
  n_wallet_client -->|"transfer command with client-supplied command id [https]"| n_wallet_api
  n_wallet_api -->|"account to partition lookup [zookeeper]"| n_shard_map
  n_wallet_api -.->|"enqueue command to the owning shard [queue, at-least-once]"| n_command_queue
  n_wallet_api -.->|"start cross-shard transfer saga [grpc, at-least-once]"| n_saga_coordinator
  n_wallet_api -->|"read balance from the CQRS view [grpc]"| n_balance_read_store
  n_command_queue -.->|"dedup by command id [queue, at-least-once]"| n_state_machine
  n_saga_coordinator -->|"one local transaction per shard, compensate on failure [grpc]"| n_state_machine
  n_state_machine -->|"append command and event, quorum ack [raft]"| n_event_log
  n_state_machine -.->|"periodic state snapshot [file, at-least-once]"| n_snapshot_store
  n_state_machine -->|"double-entry posting for the transfer [grpc]"| n_ledger_store
  n_event_log -.->|"project events into read-only views [grpc, at-least-once]"| n_read_view_builder
  n_read_view_builder -.->|"derived balances [grpc, at-least-once]"| n_balance_read_store
  n_replayer -.->|"load the nearest snapshot [file, at-least-once]"| n_snapshot_store
  n_replayer -.->|"replay the tail to any past state [grpc, at-least-once]"| n_event_log
  n_ledger_store -->|"index intent, then record, then commit intents [grpc]"| n_docstore
  n_docstore -.->|"materialised views built off the write path [grpc, at-least-once]"| n_eventual_indexes
  n_sealing_service -.->|"close a 30-minute range, sign the manifest [grpc, at-least-once]"| n_ledger_store
  n_ledger_store -.->|"tier sealed ranges to cold storage [blob, at-least-once]"| n_cold_tier
  n_backfill_limiter -->|"AIMD rate control in front of the backfill [grpc]"| n_ledger_store
  n_legacy_dynamodb -.->|"read three years of historical entries [dynamodb, at-least-once]"| n_backfill_worker
  n_backfill_worker -.->|"checkpointed batches, retried on RPC timeout [grpc, at-least-once]"| n_ledger_store
  n_shadow_validator -->|"compare live reads [grpc]"| n_ledger_store
  n_shadow_validator -->|"compare live reads [dynamodb]"| n_legacy_dynamodb
  n_offline_validator -.->|"full offline diff of 760B records [grpc, at-least-once]"| n_ledger_store
  n_offline_validator -.->|"read 70 TB of compressed sealed data [blob, at-least-once]"| n_cold_tier
```
