# stripe-payments

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_merchant_sdk["Merchant integration (stripe-ruby)<br/><i>sdk-client</i>"]
  n_merchant_endpoint["Merchant webhook endpoint<br/><i>webhook-receiver</i>"]
  n_card_network["Card networks (Visa, Mastercard)<br/><i>card-network</i>"]
  n_acquiring_bank["Acquiring and settlement banks<br/><i>bank-api</i>"]
  subgraph n_g_edge["Public API edge (trust-zone)"]
    n_api_rate_limiter["api-rate-limiter<br/><i>redis-rate-limiter</i>"]
    n_api_edge["Public API (idempotency layer)<br/><i>envoy-gateway</i>"]
  end
  subgraph n_g_core["Stripe internal (trust-zone)"]
    n_payment_service["Payment services (PaymentIntent state machines)<br/><i>container-service</i>"]
    n_webhook_queue["webhook-queue<br/><i>message-queue</i>"]
    n_webhook_dispatcher["webhook-dispatcher<br/><i>container-worker</i>"]
    subgraph n_g_docdb["DocDB data plane (system)"]
      n_docdb_proxy["DocDB proxy<br/><i>mongos</i>"]
      n_docdb_shards["DocDB shards (2,000+ MongoDB replica sets)<br/><i>mongodb</i>"]
      n_idempotency_store["Idempotency key collection<br/><i>mongodb</i>"]
      n_routing_metadata["Routing metadata service<br/><i>etcd</i>"]
      n_docdb_cdc["DocDB change data capture<br/><i>debezium</i>"]
      n_wal_archive["Write-ahead log archive<br/><i>s3</i>"]
    end
    subgraph n_g_control_plane["DocDB control plane (system)"]
      n_docdb_coordinator["DocDB control plane<br/><i>container-service</i>"]
      n_data_movement_platform["Data Movement Platform<br/><i>container-worker</i>"]
    end
    subgraph n_g_ledger["Ledger (system)"]
      n_ledger_events["Ledger event log<br/><i>raft-event-log</i>"]
      n_fund_flow_processor["Fund flow state machines<br/><i>container-worker</i>"]
      n_ledger_core["Ledger (fund flows and balances)<br/><i>double-entry-ledger</i>"]
      n_dq_platform["Data Quality Platform<br/><i>observability-stack</i>"]
    end
    subgraph n_g_data_platform["Data platform (system)"]
      n_presto["presto<br/><i>presto</i>"]
      n_hadoop_scalding["Hadoop / Scalding<br/><i>hadoop-yarn</i>"]
      n_accounting_close["Reconciliation / accounting close<br/><i>cron-job</i>"]
    end
  end
  n_merchant_sdk -->|"POST with Idempotency-Key, backoff plus jitter [https]"| n_api_edge
  n_api_rate_limiter -->|"token bucket per API key, fails open [redis]"| n_api_edge
  n_api_edge -->|"key lookup, replay stored response [mongo-wire]"| n_docdb_proxy
  n_api_edge -->|"first request for this key [http]"| n_payment_service
  n_payment_service -->|"ACID transaction per phase [mongo-wire]"| n_docdb_proxy
  n_docdb_proxy -->|"chunk routing, version gated [mongo-wire]"| n_docdb_shards
  n_docdb_proxy -->|"key, fingerprint, phase, stored response [mongo-wire]"| n_idempotency_store
  n_docdb_proxy -->|"chunk to shard map [grpc]"| n_routing_metadata
  n_payment_service -->|"authorise, ambiguous failure possible [https]"| n_card_network
  n_payment_service -->|"capture and settle [https]"| n_acquiring_bank
  n_payment_service -.->|"merchant event [amqp, at-least-once]"| n_webhook_queue
  n_webhook_queue -.->|"amqp, at-least-once"| n_webhook_dispatcher
  n_webhook_dispatcher -.->|"signed event callback, retried [https, at-least-once]"| n_merchant_endpoint
  n_payment_service -.->|"money movement events, 5B/day, out of order tolerated [grpc, at-least-once]"| n_ledger_events
  n_ledger_events -.->|"replay to any point in time [grpc, at-least-once]"| n_fund_flow_processor
  n_fund_flow_processor -->|"double-entry postings between accounts [grpc]"| n_ledger_core
  n_fund_flow_processor -.->|"clearing, timeliness, completeness [http, at-least-once]"| n_dq_platform
  n_presto -->|"ad-hoc investigation [sql]"| n_ledger_core
  n_docdb_shards -.->|"write-ahead log [mongo-oplog, at-least-once]"| n_docdb_cdc
  n_docdb_cdc -.->|"WAL archive [s3, at-least-once]"| n_wal_archive
  n_docdb_coordinator -.->|"orchestrate a shard move [grpc, at-least-once]"| n_data_movement_platform
  n_docdb_coordinator -->|"register intent, bump metadata version [grpc]"| n_routing_metadata
  n_data_movement_platform -.->|"snapshot import, bidirectional oplog, verify [mongo-wire, at-least-once]"| n_docdb_shards
  n_data_movement_platform -->|"chunk ownership, version-gated switch under 2 s [grpc]"| n_routing_metadata
  n_hadoop_scalding -.->|"offline Scalding backfill, off the read path [mongo-wire, at-least-once]"| n_docdb_proxy
  n_accounting_close -->|"monthly settlement reports [sftp]"| n_acquiring_bank
  n_accounting_close -->|"monthly regulatory close against external reports [grpc]"| n_ledger_core
```
