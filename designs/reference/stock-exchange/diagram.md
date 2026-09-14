# stock-exchange

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_clearing_house["Clearing / settlement<br/><i>bank-api</i>"]
  subgraph n_g_primary_dc["primary-dc (region)"]
    subgraph n_g_member_zone["member-zone (trust-zone)"]
      n_broker_client["Broker / member<br/><i>sdk-client</i>"]
    end
    subgraph n_g_edge_zone["edge-zone (trust-zone)"]
      n_client_gateway["Client gateway (ports)<br/><i>envoy-gateway</i>"]
      n_market_data_publisher["Market data publisher<br/><i>multicast-feed</i>"]
      n_market_data_plant["Market data multicast plant<br/><i>multicast-domain</i>"]
      n_retransmission_server["Retransmission servers<br/><i>container-worker</i>"]
      n_exchange_monitoring["Latency and gap monitoring<br/><i>observability-stack</i>"]
    end
    subgraph n_g_trading_core["trading-core (trust-zone)"]
      n_order_manager["Order manager<br/><i>container-service</i>"]
      n_risk_manager["Risk manager<br/><i>container-service</i>"]
      n_sequencer["Sequencer<br/><i>raft-event-log</i>"]
      n_matching_engine_primary["Matching engine (primary)<br/><i>order-book-matcher</i>"]
      n_matching_engine_standby["Matching engine (warm standby)<br/><i>order-book-matcher</i>"]
      n_replication_bus["Replicator (IP multicast)<br/><i>multicast-domain</i>"]
      n_snapshot_job["Nightly snapshot job<br/><i>cron-job</i>"]
      n_journal["Journal (mmap, append-only)<br/><i>raft-event-log</i>"]
      n_wallet_ledger["Wallet / positions<br/><i>double-entry-ledger</i>"]
      n_snapshot_store["Snapshot store<br/><i>blob-store</i>"]
    end
    subgraph n_g_post_trade["post-trade (trust-zone)"]
      n_reporter["Reporter<br/><i>container-worker</i>"]
      n_reporting_db["Reporting DB<br/><i>relational-database</i>"]
    end
  end
  subgraph n_g_dr_site["dr-site (region)"]
    n_matching_engine_dr["Matching engine (DR)<br/><i>order-book-matcher</i>"]
  end
  n_broker_client -->|"submit order, ack inline [fix]"| n_client_gateway
  n_client_gateway -.->|"validated order [udp, at-least-once]"| n_order_manager
  n_order_manager -->|"pre-trade limits and kill switch [in-process]"| n_risk_manager
  n_order_manager -->|"funds and position check [in-process]"| n_wallet_ledger
  n_order_manager -.->|"accepted order [in-process, at-least-once]"| n_sequencer
  n_sequencer -->|"journal before publish [mmap-append]"| n_journal
  n_sequencer -.->|"sequenced input [ring-buffer, at-least-once]"| n_matching_engine_primary
  n_matching_engine_primary -.->|"executions, sequenced too [ring-buffer, at-least-once]"| n_sequencer
  n_sequencer -.->|"execution reports [ring-buffer, at-least-once]"| n_order_manager
  n_order_manager -.->|"fills back to the broker [udp, at-least-once]"| n_client_gateway
  n_sequencer -.->|"replicate sequenced input [udp-multicast, at-least-once]"| n_replication_bus
  n_replication_bus -.->|"same stream, same state [udp-multicast, at-least-once]"| n_matching_engine_standby
  n_replication_bus -.->|"DR replica [udp-multicast, at-least-once]"| n_matching_engine_dr
  n_sequencer -.->|"executions and book updates [ring-buffer, at-least-once]"| n_market_data_publisher
  n_market_data_publisher -.->|"sequenced feed [udp-multicast, at-most-once]"| n_market_data_plant
  n_market_data_plant -.->|"simultaneous delivery to every member [udp-multicast, at-most-once]"| n_broker_client
  n_sequencer -.->|"stream kept for gap fill [ring-buffer, at-least-once]"| n_retransmission_server
  n_broker_client -->|"gap fill by sequence number [tcp]"| n_retransmission_server
  n_sequencer -.->|"off the critical path [stream, at-least-once]"| n_reporter
  n_reporter -->|"fills, orders, positions [sql]"| n_reporting_db
  n_reporter -.->|"post-trade clearing [https, at-least-once]"| n_clearing_house
  n_snapshot_job -->|"read the journal for the day [mmap-read]"| n_journal
  n_snapshot_job -->|"nightly snapshot [s3]"| n_snapshot_store
  n_snapshot_store -.->|"restore snapshot on restart [file, at-least-once]"| n_matching_engine_primary
  n_journal -.->|"replay from start of day [mmap-read, at-least-once]"| n_matching_engine_primary
  n_matching_engine_primary -.->|"latency histograms [otlp, at-most-once]"| n_exchange_monitoring
  n_market_data_publisher -.->|"gap detection [otlp, at-most-once]"| n_exchange_monitoring
```
