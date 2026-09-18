# metrics-monitoring

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  subgraph n_g_datacenter["Datacenter (region)"]
    subgraph n_g_monitored["Monitored estate (trust-zone)"]
      n_metrics_source["Metrics sources / exporters<br/><i>container-service</i>"]
      n_short_lived_job["Short-lived job with push agent<br/><i>container-worker</i>"]
    end
    subgraph n_g_platform["Monitoring platform (trust-zone)"]
      n_grafana_dashboards["Grafana<br/><i>grafana</i>"]
      n_service_discovery["Service discovery<br/><i>etcd</i>"]
      n_pull_collector["Metrics collector (pull)<br/><i>prometheus</i>"]
      n_push_gateway["Push gateway<br/><i>observability-stack</i>"]
      n_query_service["Query service (PromQL)<br/><i>container-service</i>"]
      n_alert_evaluator["Alert rule evaluator<br/><i>container-service</i>"]
      n_alert_manager["Alertmanager<br/><i>alertmanager</i>"]
      n_aggregation_consumers["Stream consumers (aggregate)<br/><i>flink</i>"]
      n_downsampling_job["Downsampling jobs<br/><i>cron-job</i>"]
      n_notification_consumers["Notification consumers<br/><i>container-worker</i>"]
      n_metrics_kafka["Kafka (metrics)<br/><i>kafka</i>"]
      n_alert_kafka["Kafka (alerts)<br/><i>kafka</i>"]
      n_tsdb["Time-series database<br/><i>influxdb</i>"]
      n_query_cache["Query cache<br/><i>cache-cluster</i>"]
      n_alert_rules_config["Alert rules config<br/><i>etcd</i>"]
      n_alert_store["Alert store<br/><i>cassandra</i>"]
      n_cold_storage["Cold storage<br/><i>blob-store</i>"]
    end
  end
  subgraph n_g_external["Alert destinations (trust-zone)"]
    n_email_relay["Email<br/><i>smtp-relay</i>"]
    n_pager["PagerDuty<br/><i>pagerduty</i>"]
    n_alert_webhook["Webhook destination<br/><i>webhook-receiver</i>"]
  end
  n_pull_collector -->|"discover scrape targets [http]"| n_service_discovery
  n_pull_collector -->|"scrape /metrics on interval [http]"| n_metrics_source
  n_short_lived_job -.->|"push job metrics [http, at-most-once]"| n_push_gateway
  n_pull_collector -->|"scrape the gateway [http]"| n_push_gateway
  n_pull_collector -.->|"buffer raw points [kafka, at-least-once]"| n_metrics_kafka
  n_metrics_kafka -.->|"aggregate and downsample [kafka, at-least-once]"| n_aggregation_consumers
  n_aggregation_consumers -->|"write series [http]"| n_tsdb
  n_downsampling_job -.->|"raw to 1-minute to 1-hour rollups [http, at-least-once]"| n_tsdb
  n_tsdb -.->|"archive expired blocks [https, at-least-once]"| n_cold_storage
  n_grafana_dashboards -->|"dashboard query [http]"| n_query_service
  n_query_service -->|"cached query results [redis]"| n_query_cache
  n_query_service -->|"range query on miss [http]"| n_tsdb
  n_alert_evaluator -->|"load alert rules [grpc]"| n_alert_rules_config
  n_alert_evaluator -->|"evaluate rule expression [http]"| n_query_service
  n_alert_evaluator -->|"alert state [cql]"| n_alert_store
  n_alert_evaluator -.->|"firing alerts [http, at-least-once]"| n_alert_manager
  n_alert_manager -.->|"grouped, deduplicated notifications [kafka, at-least-once]"| n_alert_kafka
  n_alert_kafka -.->|"fan out to channels [kafka, at-least-once]"| n_notification_consumers
  n_notification_consumers -.->|"email [smtp, at-least-once]"| n_email_relay
  n_notification_consumers -.->|"page on-call [https, at-least-once]"| n_pager
  n_notification_consumers -.->|"webhook [https, at-least-once]"| n_alert_webhook
```
