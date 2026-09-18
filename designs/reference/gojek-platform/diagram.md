# gojek-platform

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_gojek_app["Customer, driver and merchant apps<br/><i>mobile-app</i>"]
  subgraph n_g_edge["GCLB and HAProxy edge (trust-zone)"]
    n_gclb["Google Cloud Load Balancer<br/><i>google-cloud-load-balancing</i>"]
    n_haproxy["HAProxy<br/><i>haproxy</i>"]
    n_vernemq["Courier (VerneMQ cluster)<br/><i>vernemq</i>"]
    n_courier_webhook["WebHook server<br/><i>webhook-receiver</i>"]
    n_nginx_ingress["Nginx ingress controller<br/><i>nginx</i>"]
  end
  subgraph n_g_product["product namespace (vpc)"]
    n_booking_service["booking-service<br/><i>container-service</i>"]
    n_allocations_service["Allocations<br/><i>container-service</i>"]
    n_available_driver_service["Available Driver Service<br/><i>container-service</i>"]
    n_booking_termination_worker["booking-termination-worker<br/><i>container-worker</i>"]
    n_booking_termination_queue["booking-termination-queue<br/><i>message-queue</i>"]
    n_driver_location_index["Redis Cluster (driver locations)<br/><i>redis</i>"]
    n_booking_history["booking-history<br/><i>cassandra</i>"]
  end
  subgraph n_g_data_engineering["Data Engineering namespace (vpc)"]
    n_fronting_rest["Fronting REST<br/><i>container-service</i>"]
    n_fronting_kafka["Fronting Kafka<br/><i>kafka</i>"]
    n_fronting_worker["Fronting Worker<br/><i>container-worker</i>"]
    n_data_streams["Data streams (Locstream, Logstream, Tagstream)<br/><i>kafka</i>"]
    n_mirror_stream["Mirror stream<br/><i>kafka</i>"]
    n_ziggurat_consumer["Ziggurat consumer apps<br/><i>kafka-streams</i>"]
    n_rabbitmq_retry["Ziggurat RabbitMQ retry queues<br/><i>rabbitmq</i>"]
    n_dagger["Dagger<br/><i>flink</i>"]
    n_firehose["Firehose<br/><i>container-worker</i>"]
    n_sakaar["Sakaar / Secor<br/><i>container-worker</i>"]
    n_cold_storage["Google Cloud Storage (parquet)<br/><i>gcs</i>"]
  end
  n_gojek_app -.->|"persistent MQTT connection [mqtt, at-least-once]"| n_gclb
  n_gclb -.->|"opaque TCP with ProxyProtocol [tcp]"| n_haproxy
  n_haproxy -.->|"broker decodes ProxyProtocol first [mqtt]"| n_vernemq
  n_vernemq -.->|"connect, publish and ACK plugin events [http]"| n_courier_webhook
  n_courier_webhook -.->|"ACK events [kafka, at-least-once]"| n_data_streams
  n_data_streams -.->|"kafka, at-least-once"| n_firehose
  n_firehose -.->|"message was ACKed by the phone [http, at-least-once]"| n_booking_service
  n_booking_service -.->|"push order, 3-minute accept window [mqtt, at-least-once]"| n_haproxy
  n_gojek_app -.->|"driver location pings every couple of seconds [http]"| n_available_driver_service
  n_booking_service -->|"VM range to Kubernetes overlay (Heimdall) [http]"| n_nginx_ingress
  n_nginx_ingress -->|"host-based routing [http]"| n_allocations_service
  n_allocations_service -->|"candidate drivers near the pickup point [http]"| n_available_driver_service
  n_available_driver_service -->|"600k writes/min; EVAL_RO scatter-gather reads, partial results on timeout [redis]"| n_driver_location_index
  n_booking_service -.->|"terminate booking off the request path [amqp, at-least-once]"| n_booking_termination_queue
  n_booking_termination_queue -.->|"amqp, at-least-once"| n_booking_termination_worker
  n_booking_termination_worker -.->|"debit, credit, release driver, award points [http]"| n_booking_service
  n_booking_termination_worker -->|"record completed booking [cassandra]"| n_booking_history
  n_booking_service -->|"two-month booking history [cassandra]"| n_booking_history
  n_booking_service -->|"publish events, single or batched [http]"| n_fronting_rest
  n_fronting_rest -.->|"kafka, at-least-once"| n_fronting_kafka
  n_fronting_kafka -.->|"lag grows instead of data being lost [kafka, at-least-once]"| n_fronting_worker
  n_fronting_worker -.->|"kafka, at-least-once"| n_data_streams
  n_data_streams -.->|"mirror for replay and aggregation [kafka, at-least-once]"| n_mirror_stream
  n_data_streams -.->|"250+ consumer services [kafka, at-least-once]"| n_ziggurat_consumer
  n_ziggurat_consumer -.->|"failed message, infinite reconnect [amqp, at-least-once]"| n_rabbitmq_retry
  n_rabbitmq_retry -.->|"instant queue replays after the delay TTL [amqp, at-least-once]"| n_ziggurat_consumer
  n_data_streams -.->|"windowed SQL aggregation [kafka, at-least-once]"| n_dagger
  n_dagger -.->|"aggregated application sink [kafka, at-least-once]"| n_data_streams
  n_data_streams -.->|"offsets committed only after upload [kafka, at-least-once]"| n_sakaar
  n_sakaar -.->|"parquet, hourly partitions [gcs, at-least-once]"| n_cold_storage
```
