# paypal-payments

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_buyer_browser["Buyer browser / PayPal JS SDK<br/><i>web-browser</i>"]
  n_merchant_server["Merchant server (Orders v2 integration)<br/><i>sdk-client</i>"]
  subgraph n_g_dc_primary["Primary data centre (region)"]
    subgraph n_g_edge["PayPal public edge (trust-zone)"]
      n_paypal_rest_api["PayPal REST API (Orders v2 / Payments v2)<br/><i>envoy-gateway</i>"]
      n_graphql_gateway["Checkout GraphQL gateway<br/><i>krakend</i>"]
    end
    subgraph n_g_core["PayPal internal (trust-zone)"]
      n_checkout_services["Checkout orchestration services<br/><i>container-service</i>"]
      n_core_backend_services["Core backend services (login, risk, transaction processing)<br/><i>container-service</i>"]
      subgraph n_g_juno["JunoDB (system)"]
        n_junodb_lb["JunoDB load balancer<br/><i>load-balancer-tier</i>"]
        n_junodb_proxy["JunoDB proxy (junoserv)<br/><i>vitess</i>"]
        n_junodb_storage["JunoDB storage server (junostorageserv)<br/><i>nosql-store</i>"]
        n_junodb_etcd["JunoDB cluster config (junoclusterserv)<br/><i>etcd</i>"]
      end
      subgraph n_g_data_access["HERA and systems of record (system)"]
        n_hera_mux["HERA data access gateway (mux)<br/><i>proxysql</i>"]
        n_hera_worker["HERA workers (mysqlworker, oracleworker, postgresworker)<br/><i>container-worker</i>"]
        n_systems_of_record["Relational systems of record (Oracle, MySQL)<br/><i>oracle-db</i>"]
      end
      subgraph n_g_risk["Real-time risk (system)"]
        n_risk_services["Risk and fraud decisioning services<br/><i>container-service</i>"]
        n_risk_feature_store["Risk feature store (Aerospike hybrid memory)<br/><i>aerospike</i>"]
        n_risk_models["Risk model execution<br/><i>kserve</i>"]
      end
    end
    subgraph n_g_kafka_zone_a["Kafka security zone A (trust-zone)"]
      n_kafka_brokers["Kafka brokers (85+ clusters, 1,500+ brokers, 20,000+ topics)<br/><i>kafka</i>"]
      n_zookeeper_ensemble["ZooKeeper ensemble<br/><i>zookeeper</i>"]
      n_kafka_config_service["Kafka Config Service<br/><i>consul</i>"]
      n_kafka_security_library["Kafka security library (SSL certificates, per-application tokens)<br/><i>cert-manager</i>"]
      n_kafka_monitoring["Metrics library and SignalFX<br/><i>observability-stack</i>"]
      n_topic_onboarding["Topic onboarding and capacity workflow<br/><i>container-service</i>"]
      n_mirrormaker["MirrorMaker (close to 2,000 nodes)<br/><i>kafka-streams</i>"]
    end
  end
  subgraph n_g_dc_secondary["Secondary data centre (region)"]
    subgraph n_g_kafka_zone_b["Kafka security zone B (trust-zone)"]
      n_kafka_brokers_dr["Kafka brokers, second data centre and security zone<br/><i>kafka</i>"]
    end
  end
  n_merchant_server -->|"create order, PayPal-Request-Id deduped for 6 h [https]"| n_paypal_rest_api
  n_paypal_rest_api -->|"payer-action link, order in PAYER_ACTION_REQUIRED [https]"| n_buyer_browser
  n_buyer_browser -->|"buyer approves on PayPal [https]"| n_paypal_rest_api
  n_merchant_server -->|"authorize or capture inside the 3 h order window [https]"| n_graphql_gateway
  n_buyer_browser -->|"one typed query, exactly the requested fields [https]"| n_graphql_gateway
  n_paypal_rest_api -->|"orders and payments [http]"| n_checkout_services
  n_graphql_gateway -->|"one round trip replaces many REST calls [http]"| n_checkout_services
  n_checkout_services -->|"per-domain services behind checkout [http]"| n_core_backend_services
  n_core_backend_services -->|"risk checkpoint: login, purchase, transfer, withdrawal [http]"| n_risk_services
  n_risk_services -->|"feature reads, ~75% of decisions under 50 ms [aerospike]"| n_risk_feature_store
  n_risk_services -->|"one or more models per checkpoint, sequential or parallel [grpc]"| n_risk_models
  n_core_backend_services -->|"store, retrieve and update through the JunoDB client library [tcp-tls]"| n_junodb_lb
  n_junodb_lb -->|"drives proxy instances, accepts cross-site replication [tcp-tls]"| n_junodb_proxy
  n_junodb_proxy -->|"shard map and cluster topology [grpc]"| n_junodb_etcd
  n_junodb_proxy -->|"quorum protocol and two-phase commit to the replication group [juno]"| n_junodb_storage
  n_junodb_storage -.->|"one replica per logical zone [juno-replication, at-least-once]"| n_junodb_storage
  n_core_backend_services -->|"connection multiplexing onto a small pool [hera]"| n_hera_mux
  n_hera_mux -->|"read/write split, bad-query eviction [ipc]"| n_hera_worker
  n_hera_worker -->|"transactional, automatic failover to a replica [sql]"| n_systems_of_record
  n_core_backend_services -->|"bootstrap servers and standard config at startup [http]"| n_kafka_config_service
  n_core_backend_services -->|"SSL certificate and token retrieval [https]"| n_kafka_security_library
  n_core_backend_services -.->|"produce, declared producer intent per topic [kafka-sasl-ssl, at-least-once]"| n_kafka_brokers
  n_kafka_brokers -.->|"consume, declared consumer intent per topic [kafka-sasl-ssl, at-least-once]"| n_core_backend_services
  n_kafka_brokers -->|"cluster metadata [zookeeper]"| n_zookeeper_ensemble
  n_topic_onboarding -->|"capacity review, cluster assignment, token, ACL [kafka-admin]"| n_kafka_brokers
  n_kafka_brokers -.->|"source cluster [kafka, at-least-once]"| n_mirrormaker
  n_mirrormaker -.->|"disaster recovery and cross-security-zone hop [kafka, at-least-once]"| n_kafka_brokers_dr
  n_kafka_brokers -.->|"Micrometer metrics, one SOP per alert [http, at-least-once]"| n_kafka_monitoring
  n_zookeeper_ensemble -.->|"http, at-least-once"| n_kafka_monitoring
  n_mirrormaker -.->|"http, at-least-once"| n_kafka_monitoring
```
