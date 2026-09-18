# slack-messaging

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_slack_client["slack-client<br/><i>mobile-app</i>"]
  subgraph n_g_us_east_1["us-east-1 (region)"]
    subgraph n_g_us_east_1a["us-east-1a (availability-zone)"]
      subgraph n_g_cell_a["cell-a (cell)"]
        n_edge_envoy["edge-envoy<br/><i>envoy</i>"]
        n_gateway_server_a["gateway-server-a<br/><i>websocket-gateway</i>"]
        n_channel_server_a["channel-server-a<br/><i>vm-service</i>"]
        n_admin_server_a["admin-server-a<br/><i>container-service</i>"]
        n_webapp["webapp<br/><i>container-service</i>"]
        n_consul["consul<br/><i>consul</i>"]
        n_ring_manager["ring-manager<br/><i>apache-helix</i>"]
        n_messages_db["messages-db<br/><i>mysql</i>"]
        n_object_cache["object-cache<br/><i>memcached</i>"]
        n_job_log["job-log<br/><i>kafka</i>"]
        n_jq_relay["jq-relay<br/><i>container-worker</i>"]
        n_jobs_redis["jobs-redis<br/><i>redis-queue</i>"]
        n_job_workers["job-workers<br/><i>container-worker</i>"]
      end
    end
    subgraph n_g_us_east_1b["us-east-1b (availability-zone)"]
      subgraph n_g_cell_b["cell-b (cell)"]
        n_channel_server_b["channel-server-b<br/><i>vm-service</i>"]
        n_admin_server_b["admin-server-b<br/><i>container-service</i>"]
      end
    end
  end
  n_slack_client -.->|"persistent WebSocket, TLS terminated at Envoy [wss, at-least-once]"| n_edge_envoy
  n_edge_envoy -.->|"subscriptions [wss, at-least-once]"| n_gateway_server_a
  n_edge_envoy -->|"send message [https]"| n_webapp
  n_gateway_server_a -->|"channel server discovery on connect [http]"| n_consul
  n_gateway_server_a -.->|"push events [ws, at-most-once]"| n_slack_client
  n_webapp -->|"persist message via Vitess [mysql]"| n_messages_db
  n_webapp -->|"memcached"| n_object_cache
  n_webapp -->|"grpc"| n_admin_server_a
  n_admin_server_a -->|"hash ring lookup, same cell [grpc]"| n_channel_server_a
  n_admin_server_b -->|"hash ring lookup, same cell [grpc]"| n_channel_server_b
  n_admin_server_a -->|"discovery [http]"| n_consul
  n_channel_server_a -.->|"fan-out to subscribed gateways [grpc, at-most-once]"| n_gateway_server_a
  n_channel_server_a -.->|"ring membership watch [zookeeper, at-least-once]"| n_ring_manager
  n_channel_server_b -.->|"ring membership watch [zookeeper, at-least-once]"| n_ring_manager
  n_ring_manager -->|"publish ring config [http]"| n_consul
  n_webapp -.->|"enqueue job via Kafkagate [kafka, at-least-once]"| n_job_log
  n_job_log -.->|"offset advanced after Redis write [kafka, at-least-once]"| n_jq_relay
  n_jq_relay -->|"one relay per partition lock [http]"| n_consul
  n_jq_relay -->|"rate limited push [redis]"| n_jobs_redis
  n_jobs_redis -.->|"redis, at-least-once"| n_job_workers
  n_job_workers -->|"mysql"| n_messages_db
```
