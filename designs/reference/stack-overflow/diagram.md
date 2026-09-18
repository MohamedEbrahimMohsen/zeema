# stack-overflow

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_client["Browsers and mobile clients<br/><i>web-browser</i>"]
  n_cloudflare["CloudFlare<br/><i>cloudflare-dns</i>"]
  subgraph n_g_ny["New York datacenter (primary) (region)"]
    subgraph n_g_dmz["DMZ (trust-zone)"]
      n_haproxy_cloudflare["HAProxy (CloudFlare traffic)<br/><i>haproxy</i>"]
      n_haproxy_direct["HAProxy (direct traffic)<br/><i>haproxy</i>"]
    end
    subgraph n_g_internal["Internal VLANs (trust-zone)"]
      n_web_tier["Web tier NY-WEB01-09<br/><i>iis</i>"]
      n_l1_cache["L1 in-process cache<br/><i>cache-cluster</i>"]
      n_socket_server["Socket server (StackExchange.NetGain)<br/><i>websocket-gateway</i>"]
      n_tag_engine["Stack Server / tag engine<br/><i>vm-service</i>"]
      n_elastic_indexer["Elastic indexing job (ROWVERSION)<br/><i>debezium</i>"]
      n_redis_master["Redis master<br/><i>redis</i>"]
      n_redis_slave["Redis slave<br/><i>redis</i>"]
      n_purge_channel["Redis purge channel<br/><i>redis-pubsub</i>"]
      n_elasticsearch["Elasticsearch 1.4 (3 nodes)<br/><i>elasticsearch</i>"]
      n_sql_cluster_1["SQL cluster 1 primary (Stack Overflow, Sites, PRIZM, Mobile)<br/><i>sql-server</i>"]
      n_sql_cluster_1_replica["SQL cluster 1 read replica (NY)<br/><i>sql-server</i>"]
      n_sql_cluster_2["SQL cluster 2 primary (Talent, OpenID, Chat, exceptions, other sites)<br/><i>sql-server</i>"]
      n_sql_cluster_2_replica["SQL cluster 2 read replica (NY)<br/><i>sql-server</i>"]
      n_providence_api["Providence API<br/><i>iis</i>"]
      n_providence_ml["Providence ML servers<br/><i>container-worker</i>"]
      n_providence_redis["Providence Redis slaves<br/><i>redis</i>"]
      n_traffic_processor["Traffic processing service<br/><i>container-worker</i>"]
      n_http_logging_sql["HTTP logging SQL Server (columnstore)<br/><i>sql-server</i>"]
      n_bosun["Bosun + OpenTSDB/HBase<br/><i>observability-stack</i>"]
      n_opserver["Opserver<br/><i>observability-stack</i>"]
    end
  end
  subgraph n_g_colorado["Colorado datacenter (DR) (region)"]
    n_sql_cluster_1_dr["SQL cluster 1 DR replica (Colorado)<br/><i>sql-server</i>"]
  end
  n_client -->|"public DNS and proxy [https]"| n_cloudflare
  n_cloudflare -->|"proxied traffic, dedicated HAProxy pair [https]"| n_haproxy_cloudflare
  n_client -->|"direct traffic, second HAProxy pair [https]"| n_haproxy_direct
  n_haproxy_cloudflare -->|"TLS terminated at HAProxy; 3 good health checks to re-enter rotation [http]"| n_web_tier
  n_haproxy_direct -->|"TLS terminated at HAProxy [http]"| n_web_tier
  n_haproxy_cloudflare -.->|"request summaries with timing headers [syslog, at-most-once]"| n_traffic_processor
  n_haproxy_direct -.->|"request summaries with timing headers [syslog, at-most-once]"| n_traffic_processor
  n_client -.->|"~500k concurrent sockets, push-only live counts [wss, at-most-once]"| n_socket_server
  n_web_tier -->|"L1, checked before Redis; serves stale while refreshing [in-process]"| n_l1_cache
  n_web_tier -->|"L2 on L1 miss; pipelined, never retried [resp]"| n_redis_master
  n_web_tier -.->|"publish key name after the DEL/UNLINK [resp-publish, at-most-once]"| n_purge_channel
  n_purge_channel -.->|"fan-out to every web server; flush matching L1 entries [resp-subscribe, at-most-once]"| n_web_tier
  n_redis_master -.->|"one master + one slave per datacenter [redis-replication, at-least-once]"| n_redis_slave
  n_web_tier -->|"Dapper over POCOs; 504.8M queries/day across both clusters [tds]"| n_sql_cluster_1
  n_web_tier -->|"chat, OpenID, Talent, exception log, other Q&A sites [tds]"| n_sql_cluster_2
  n_sql_cluster_1 -.->|"async AlwaysOn read replica [alwayson, at-least-once]"| n_sql_cluster_1_replica
  n_sql_cluster_1 -.->|"async DR replica over the 10 Gbps MPLS circuit [alwayson-mpls, at-least-once]"| n_sql_cluster_1_dr
  n_sql_cluster_2 -.->|"async AlwaysOn read replica [alwayson, at-least-once]"| n_sql_cluster_2_replica
  n_web_tier -->|"tag intersection queries SQL could not afford [http-sys]"| n_tag_engine
  n_tag_engine -->|"reload post and tag changes every 2 minutes [tds]"| n_sql_cluster_1
  n_sql_cluster_1 -.->|"changed rows tracked by ROWVERSION [tds-rowversion, at-least-once]"| n_elastic_indexer
  n_sql_cluster_2 -.->|"changed rows tracked by ROWVERSION [tds-rowversion, at-least-once]"| n_elastic_indexer
  n_elastic_indexer -.->|"index writes, one index per site; full reindex is the rebuild path [http, at-least-once]"| n_elasticsearch
  n_web_tier -->|"/search, related questions, ask-a-question suggestions [http]"| n_elasticsearch
  n_web_tier -->|"home-page recommendations, job matching [http]"| n_providence_api
  n_providence_api -->|"predictions, dedicated slaves [resp]"| n_providence_redis
  n_providence_ml -.->|"computed predictions written out [resp, at-most-once]"| n_providence_redis
  n_http_logging_sql -.->|"tag-view deviation features from traffic logs [batch, at-least-once]"| n_providence_ml
  n_traffic_processor -.->|"one summary row per request, clustered columnstore per day [tds, at-least-once]"| n_http_logging_sql
  n_traffic_processor -.->|"request metrics [http, at-most-once]"| n_bosun
  n_web_tier -.->|"BosunReporter application metrics [http, at-most-once]"| n_bosun
  n_opserver -->|"availability-group status polled directly [tds]"| n_sql_cluster_1
  n_opserver -->|"Redis dashboard [resp]"| n_redis_master
  n_opserver -->|"cluster health [http]"| n_elasticsearch
  n_opserver -->|"backend state [haproxy-admin]"| n_haproxy_cloudflare
```
