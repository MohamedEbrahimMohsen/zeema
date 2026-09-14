# nubank-core

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_nubank_app["Nubank mobile app<br/><i>mobile-app</i>"]
  n_card_network["Mastercard / Visa card scheme<br/><i>card-network</i>"]
  n_payments_hub["Brazilian payments hub (SOAP)<br/><i>bank-api</i>"]
  subgraph n_g_payment_dc["Physical payment data centre (Brazil) (trust-zone)"]
    n_authorizer["Authorizer (Clojure, in-memory state)<br/><i>container-service</i>"]
    n_hsm["HSM (vendor not stated)<br/><i>thales-luna-hsm</i>"]
  end
  subgraph n_g_aws_cloud["AWS cloud (trust-zone)"]
    n_kafka_backbone["Kafka bridge and backbone<br/><i>kafka</i>"]
    n_snapshot_generator["Snapshot generator<br/><i>container-worker</i>"]
    n_authorizer_snapshots["S3 authorizer snapshot store<br/><i>s3</i>"]
    n_mortician["Mortician (dead-letter topic and triage)<br/><i>message-queue</i>"]
    n_prometheus["Prometheus + Grafana<br/><i>prometheus</i>"]
    subgraph n_g_global_layer["Global, non-sharded layer (system)"]
      n_global_router["Global routing service<br/><i>container-service</i>"]
      n_settlement_service["Settlement service (idempotent)<br/><i>container-service</i>"]
    end
    subgraph n_g_scalability_unit["Scalability unit (120+ services, databases, Kafka clusters) (cell)"]
      n_clojure_microservices["Clojure microservices (hexagonal, Finagle)<br/><i>container-service</i>"]
      n_investment_service["Investment / savings service<br/><i>container-service</i>"]
      n_accounting_ledger["Real-time double-entry accounting<br/><i>double-entry-ledger</i>"]
      n_datomic_transactor["Datomic<br/><i>relational-database</i>"]
      n_datomic_storage_nonpii["Datomic storage, non-PII<br/><i>dynamodb</i>"]
      n_datomic_storage_pii["Datomic storage, PII (RDS PostgreSQL)<br/><i>aws-rds</i>"]
      n_evergreen_balance_cache["Evergreen balance cache<br/><i>dynamodb</i>"]
    end
    subgraph n_g_analytics["Analytics environment (trust-zone)"]
      n_datomic_log_tailer["Datomic log tailer<br/><i>container-worker</i>"]
      n_data_lake["Data lake<br/><i>blob-store</i>"]
      n_spark_etl["Scala + Spark ETL cluster<br/><i>spark-cluster</i>"]
      n_avalanche_flink["Avalanche stream enrichment<br/><i>flink</i>"]
      n_avalanche_pinot["Avalanche real-time serving<br/><i>pinot</i>"]
    end
  end
  n_nubank_app -->|"login; credential validation returns shard-anchoring hypermedia links [https]"| n_global_router
  n_nubank_app -->|"shard-anchored product requests [https]"| n_clojure_microservices
  n_card_network -->|"authorization over TCP via the Mastercard Interface Device [iso-8583]"| n_authorizer
  n_authorizer -->|"chip cryptogram validation [hsm]"| n_hsm
  n_authorizer_snapshots -->|"bootstrap: load the latest snapshot [s3]"| n_authorizer
  n_kafka_backbone -.->|"tail the log from the snapshot checkpoint [kafka, at-least-once]"| n_authorizer
  n_authorizer -.->|"authorization outcomes back into the cloud [kafka, at-least-once]"| n_kafka_backbone
  n_kafka_backbone -.->|"second consumer of the same log [kafka, at-least-once]"| n_snapshot_generator
  n_snapshot_generator -.->|"periodic snapshot plus checkpoint offset [s3]"| n_authorizer_snapshots
  n_clojure_microservices -.->|"state mutations as events [kafka, at-least-once]"| n_kafka_backbone
  n_kafka_backbone -.->|"consume with offsets [kafka, at-least-once]"| n_clojure_microservices
  n_clojure_microservices -->|"Finagle RPC; liquidate the invested balance before a transfer [thrift]"| n_investment_service
  n_clojure_microservices -->|"transact; one writer per database [datomic]"| n_datomic_transactor
  n_clojure_microservices -->|"in-process peer reads segments [dynamodb]"| n_datomic_storage_nonpii
  n_clojure_microservices -->|"read-through by account-id/event-counter [dynamodb]"| n_evergreen_balance_cache
  n_datomic_transactor -->|"durable write, non-PII [dynamodb]"| n_datomic_storage_nonpii
  n_datomic_transactor -->|"durable write, PII on EBS-encrypted volumes [postgres]"| n_datomic_storage_pii
  n_kafka_backbone -.->|"financially relevant events from 90+ services [kafka, at-least-once]"| n_accounting_ledger
  n_accounting_ledger -->|"entries and movements, append-only [datomic]"| n_datomic_transactor
  n_clojure_microservices -.->|"failed consumption: original message plus error metadata [kafka]"| n_mortician
  n_mortician -.->|"republish after the fix [kafka, at-least-once]"| n_clojure_microservices
  n_clojure_microservices -.->|"transfers published out of every shard [kafka, at-least-once]"| n_global_router
  n_global_router -.->|"dispatch external events into the owning unit [kafka, at-least-once]"| n_clojure_microservices
  n_global_router -.->|"transfers from every shard, consumed idempotently [kafka, at-least-once]"| n_settlement_service
  n_settlement_service -->|"external transfer onto the real-time settlement rail [soap]"| n_payments_hub
  n_settlement_service -.->|"ledger observes settlement events [kafka, at-least-once]"| n_accounting_ledger
  n_settlement_service -.->|"compensating transaction re-invests the funds [kafka, at-least-once]"| n_investment_service
  n_settlement_service -.->|"failed settlement parked for triage [kafka]"| n_mortician
  n_datomic_transactor -.->|"transaction log tail [datomic-log, at-least-once]"| n_datomic_log_tailer
  n_datomic_log_tailer -.->|"chunked and format-converted [https]"| n_data_lake
  n_kafka_backbone -.->|"data that never lands in Datomic [kafka, at-least-once]"| n_data_lake
  n_data_lake -.->|"Datalog queries fanned across Spark nodes [s3]"| n_spark_etl
  n_kafka_backbone -.->|"event-time windows, stateful joins [kafka, at-least-once]"| n_avalanche_flink
  n_avalanche_flink -.->|"real-time OLAP ingestion [pinot]"| n_avalanche_pinot
  n_avalanche_pinot -->|"fraud and risk scoring within milliseconds [sql]"| n_clojure_microservices
  n_clojure_microservices -.->|"metrics scrape, canary gating and alerts [http]"| n_prometheus
```
