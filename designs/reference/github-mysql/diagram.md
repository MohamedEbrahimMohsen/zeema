# github-mysql

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_client["HTTP, Git and SSH clients<br/><i>user-device</i>"]
  subgraph n_g_us_east_dc["US East Coast primary data center (region)"]
    subgraph n_g_edge["GLB tiers (trust-zone)"]
      n_ecmp_routers["ECMP routers<br/><i>spine-leaf-fabric</i>"]
      n_glb_director["GLB director<br/><i>load-balancer-tier</i>"]
      n_glb_healthcheck["glb-healthcheck<br/><i>observability-stack</i>"]
      n_glb_proxy["GLB proxy tier (HAProxy)<br/><i>haproxy</i>"]
    end
    subgraph n_g_app_tier["app-tier (trust-zone)"]
      n_rails_monolith["github.com Rails monolith<br/><i>container-service</i>"]
      n_spokes_proxy["Spokes proxy<br/><i>container-service</i>"]
    end
    subgraph n_g_data_tier["data-tier (trust-zone)"]
      n_vtgate["Vitess VTGate<br/><i>vitess</i>"]
      n_proxysql["ProxySQL<br/><i>proxysql</i>"]
      n_haproxy_writer_pool["HAProxy writer pool<br/><i>haproxy</i>"]
      n_mysql_primary["MySQL cluster primary<br/><i>mysql</i>"]
      n_mysql_partition_target["Destination cluster primary<br/><i>mysql</i>"]
      n_spokes_fileservers["Spokes/DGit fileservers<br/><i>file-store</i>"]
      n_spokes_repair["Spokes repair and rebalance<br/><i>container-worker</i>"]
      n_job_queueing_service["Job queueing service<br/><i>message-queue</i>"]
      n_kafka["Kafka cluster (background jobs)<br/><i>kafka</i>"]
      n_zookeeper["ZooKeeper ensemble<br/><i>zookeeper</i>"]
      n_job_dispatcher["Job dispatcher (Kafka consumer group)<br/><i>container-worker</i>"]
      n_job_workers["Background job workers<br/><i>container-worker</i>"]
      n_webhook_delivery["Webhook delivery workers<br/><i>container-worker</i>"]
      n_pages_builder["GitHub Pages build workers<br/><i>container-worker</i>"]
    end
    subgraph n_g_control_plane["control-plane (trust-zone)"]
      n_orchestrator["orchestrator/raft<br/><i>apache-helix</i>"]
      n_consul["Consul (per DC KV)<br/><i>consul</i>"]
    end
  end
  subgraph n_g_us_west_dc["US West Coast data center (region)"]
    n_mysql_replica["MySQL replicas and promotion candidates<br/><i>mysql</i>"]
  end
  n_client -->|"https, git, ssh to one announced IP [tcp]"| n_ecmp_routers
  n_ecmp_routers -->|"ECMP hash over the 4-tuple [ip]"| n_glb_director
  n_glb_director -->|"forwarding table lookup, secondary proxy in the GUE private data [gue]"| n_glb_proxy
  n_glb_healthcheck -->|"tunnel and http checks, swaps primary and secondary [gue]"| n_glb_proxy
  n_glb_proxy -->|"l7 termination [http]"| n_rails_monolith
  n_rails_monolith -->|"queries, instead of direct connections to MySQL [mysql]"| n_vtgate
  n_rails_monolith -->|"routing during a write cutover [mysql]"| n_proxysql
  n_rails_monolith -->|"writes, anycast to the local DC [mysql]"| n_haproxy_writer_pool
  n_haproxy_writer_pool -->|"exactly one backend per cluster [mysql]"| n_mysql_primary
  n_vtgate -->|"vertical sharding by keyspace [mysql]"| n_mysql_primary
  n_vtgate -->|"moved schema domain [mysql]"| n_mysql_partition_target
  n_proxysql -->|"cutover step 5 repoints routing [mysql]"| n_mysql_partition_target
  n_mysql_primary -->|"semi-sync, 500ms timeout, async tree below [mysql-replication]"| n_mysql_replica
  n_mysql_primary -.->|"table copy, GTID checkpoint confirmed at cutover [mysql-replication, at-least-once]"| n_mysql_partition_target
  n_orchestrator -->|"holistic failure detection [mysql]"| n_mysql_primary
  n_orchestrator -->|"promote the ideal candidate, no cooperation from the dead primary [mysql]"| n_mysql_replica
  n_orchestrator -->|"write the new primary identity into the local DC KV [http]"| n_consul
  n_consul -.->|"consul-template watch, reload with hard-stop-after [http, at-least-once]"| n_haproxy_writer_pool
  n_rails_monolith -->|"all git reads and writes [internal]"| n_spokes_proxy
  n_spokes_proxy -->|"three-phase commit, committed at 2 of 3 replicas [git]"| n_spokes_fileservers
  n_spokes_repair -.->|"recreate repositories with fewer than three replicas [git, at-least-once]"| n_spokes_fileservers
  n_rails_monolith -.->|"enqueue; work is recorded even when dispatch stalls [internal, at-least-once]"| n_job_queueing_service
  n_job_queueing_service -.->|"the log behind the job system [kafka, at-least-once]"| n_kafka
  n_kafka -.->|"consumer group [kafka, at-least-once]"| n_job_dispatcher
  n_kafka -->|"controller election [zookeeper]"| n_zookeeper
  n_job_dispatcher -.->|"dispatch job [internal, at-least-once]"| n_job_workers
  n_job_dispatcher -.->|"dispatch hook event [internal, at-least-once]"| n_webhook_delivery
  n_job_dispatcher -.->|"dispatch Pages build [internal, at-least-once]"| n_pages_builder
```
