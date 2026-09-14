# coinbase-exchange

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_web_client["web-client<br/><i>web-browser</i>"]
  n_mobile_app["mobile-app<br/><i>mobile-app</i>"]
  n_clickstream_sdk["Ruby and Golang clickstream SDK<br/><i>sdk-client</i>"]
  n_blockchain_rpc["Blockchain networks and settlement rails<br/><i>supplier-api</i>"]
  subgraph n_g_us_east_1["us-east-1 (region)"]
    subgraph n_g_edge["edge (trust-zone)"]
      n_nginx_router["Nginx routers<br/><i>nginx</i>"]
    end
    subgraph n_g_exchange["exchange (system)"]
      n_order_gateway["Exchange order gateway (REST, WebSocket, FIX)<br/><i>envoy-gateway</i>"]
      n_market_data_feed["Market data feed<br/><i>websocket-gateway</i>"]
      n_ledger["Balances ledger<br/><i>double-entry-ledger</i>"]
      n_msk_dedicated["Service-dedicated MSK cluster for extreme latency<br/><i>aws-msk</i>"]
      subgraph n_g_use1_az4["use1-az4 (availability-zone)"]
        n_matching_engine["Matching engine<br/><i>order-book-matcher</i>"]
      end
    end
    subgraph n_g_platform["platform (trust-zone)"]
      n_internal_lb["Internal load balancers<br/><i>load-balancer-tier</i>"]
      n_retail_services["Retail and platform services on EKS<br/><i>container-service</i>"]
      n_identity_service["Users (identity) service<br/><i>container-service</i>"]
      n_mongodb["mongodb<br/><i>mongodb</i>"]
      n_dynamodb["dynamodb<br/><i>dynamodb</i>"]
      n_postgres_core["postgres-core<br/><i>postgres</i>"]
      n_msk_multi_tenant["Multi-tenant MSK cluster<br/><i>aws-msk</i>"]
      n_acm_certificates["AWS Certificate Manager<br/><i>aws-acm</i>"]
    end
    subgraph n_g_custody["custody (trust-zone)"]
      n_withdrawal_service["Withdrawal approval service<br/><i>container-service</i>"]
      n_custody_hsm["Custody signing HSM<br/><i>cloudhsm</i>"]
    end
    subgraph n_g_data_platform["data-platform (system)"]
      n_kafka_connect["Kafka Connect CDC and sink cluster<br/><i>kafka-connect</i>"]
      n_soon_ingestion["SOON, Spark continuous ingestion on Databricks<br/><i>spark-streaming</i>"]
      n_delta_lake["Delta Lake on S3<br/><i>s3</i>"]
      n_snowflake["snowflake<br/><i>snowflake</i>"]
      n_airflow["Airflow, central orchestrator since 2017<br/><i>airflow</i>"]
    end
  end
  n_web_client -->|"https"| n_nginx_router
  n_mobile_app -->|"https"| n_nginx_router
  n_web_client -->|"subscribe to sequenced market data channels [websocket]"| n_market_data_feed
  n_nginx_router -->|"retail API [http]"| n_retail_services
  n_nginx_router -->|"exchange REST, WebSocket and FIX [https]"| n_order_gateway
  n_order_gateway -->|"submit order, price-time priority [internal]"| n_matching_engine
  n_matching_engine -->|"post fills to balances [internal]"| n_ledger
  n_ledger -->|"append postings [postgres]"| n_postgres_core
  n_matching_engine -.->|"sequenced order and trade updates [internal, at-least-once]"| n_market_data_feed
  n_matching_engine -.->|"trade events, sub-10 ms [kafka, at-least-once]"| n_msk_dedicated
  n_msk_dedicated -.->|"fills into retail balances [kafka, at-least-once]"| n_retail_services
  n_retail_services -->|"inter-service call over TLS [https]"| n_internal_lb
  n_internal_lb -->|"user and permission reads [https]"| n_identity_service
  n_internal_lb -->|"withdrawal request [https]"| n_withdrawal_service
  n_acm_certificates -.->|"issue and auto-renew internal TLS certificates [acm]"| n_internal_lb
  n_identity_service -->|"federated identity reads [mongodb]"| n_mongodb
  n_identity_service -->|"federated identity reads [dynamodb]"| n_dynamodb
  n_retail_services -->|"relational workloads [postgres]"| n_postgres_core
  n_withdrawal_service -->|"debit balance [internal]"| n_ledger
  n_withdrawal_service -->|"request withdrawal signature [pkcs11]"| n_custody_hsm
  n_withdrawal_service -.->|"broadcast signed withdrawal [rpc, at-least-once]"| n_blockchain_rpc
  n_retail_services -.->|"service events through the Streaming SDK [kafka, at-least-once]"| n_msk_multi_tenant
  n_clickstream_sdk -.->|"clickstream [http, at-least-once]"| n_msk_multi_tenant
  n_postgres_core -.->|"change data capture [postgres-cdc, at-least-once]"| n_kafka_connect
  n_mongodb -.->|"change data capture [mongodb-cdc, at-least-once]"| n_kafka_connect
  n_dynamodb -.->|"full table snapshots [s3, at-least-once]"| n_delta_lake
  n_kafka_connect -.->|"CDC topics [kafka, at-least-once]"| n_msk_multi_tenant
  n_kafka_connect -.->|"Snowflake sink connector [sink, at-least-once]"| n_snowflake
  n_kafka_connect -.->|"S3 sink connector [sink, at-least-once]"| n_delta_lake
  n_msk_multi_tenant -.->|"Spark structured streaming [kafka, at-least-once]"| n_soon_ingestion
  n_soon_ingestion -.->|"append and merge into Delta Lake [delta, at-least-once]"| n_delta_lake
  n_airflow -.->|"orchestrate ETL DAGs [orchestration, at-least-once]"| n_snowflake
```
