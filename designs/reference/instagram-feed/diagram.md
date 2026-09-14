# instagram-feed

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_mobile_client["mobile-client<br/><i>mobile-app</i>"]
  n_apns["APNs<br/><i>apns</i>"]
  subgraph n_g_us["US datacenters (region)"]
    subgraph n_g_us_edge["us-edge (trust-zone)"]
      n_dns["Route 53<br/><i>route53</i>"]
      n_elb["Elastic Load Balancer<br/><i>aws-classic-load-balancer</i>"]
      n_nginx["nginx<br/><i>nginx</i>"]
      n_photo_cdn["CloudFront<br/><i>cloudfront</i>"]
    end
    subgraph n_g_us_core["us-core (trust-zone)"]
      n_django["Django / gunicorn<br/><i>vm-service</i>"]
      n_pgbouncer["pgbouncer<br/><i>pgbouncer</i>"]
      n_job_queue["Gearman<br/><i>gearman</i>"]
      n_photo_workers["Gearman Python workers<br/><i>container-worker</i>"]
      n_akkio["Akkio<br/><i>container-worker</i>"]
      n_pyapns["pyapns<br/><i>notification-platform</i>"]
      n_observability["Sentry / Munin / PagerDuty<br/><i>sentry</i>"]
      n_search_index["Solr geo-search<br/><i>solr</i>"]
    end
    subgraph n_g_us_data["us-data (trust-zone)"]
      n_postgres["PostgreSQL shards<br/><i>postgres</i>"]
      n_postgres_replica["PostgreSQL streaming replicas<br/><i>postgres</i>"]
      n_redis["Redis<br/><i>redis</i>"]
      n_memcached["memcached<br/><i>memcached</i>"]
      n_photo_store["S3<br/><i>s3</i>"]
      n_cassandra_us["Cassandra_US (feed, inbox, fraud logs)<br/><i>cassandra</i>"]
      n_tao_us["TAO (US master)<br/><i>tao</i>"]
    end
  end
  subgraph n_g_eu["EU datacenter (region)"]
    n_cassandra_eu["Cassandra_EU<br/><i>cassandra</i>"]
    n_tao_eu["TAO (EU region-local master)<br/><i>tao</i>"]
  end
  n_mobile_client -->|"resolve [dns]"| n_dns
  n_mobile_client -->|"api call, tls terminated at the elb [https]"| n_elb
  n_mobile_client -->|"photo download [https]"| n_photo_cdn
  n_photo_cdn -->|"origin fetch [https]"| n_photo_store
  n_elb -->|"three nginx proxies [http]"| n_nginx
  n_nginx -->|"upstream [http]"| n_django
  n_django -->|"pooled connection [postgres]"| n_pgbouncer
  n_pgbouncer -->|"logical shard routing, the id carries the shard [postgres]"| n_postgres
  n_pgbouncer -->|"reads [postgres]"| n_postgres_replica
  n_postgres -.->|"streaming replication into another zone [postgres-streaming, at-least-once]"| n_postgres_replica
  n_django -->|"object cache [memcached]"| n_memcached
  n_django -->|"session, photo-id to user-id map [redis]"| n_redis
  n_django -->|"upload photo [https]"| n_photo_store
  n_django -.->|"fan-out, sharing, notify [gearman, at-least-once]"| n_job_queue
  n_job_queue -.->|"200 python workers [gearman, at-least-once]"| n_photo_workers
  n_photo_workers -->|"insert into follower feeds [cql]"| n_cassandra_us
  n_photo_workers -->|"refresh photo-id to user-id map [redis]"| n_redis
  n_photo_workers -.->|"index geo-tagged photo [http, at-least-once]"| n_search_index
  n_photo_workers -.->|"enqueue push [http, at-least-once]"| n_pyapns
  n_pyapns -.->|"over a billion push notifications [apns, at-most-once]"| n_apns
  n_django -->|"geo search query [http]"| n_search_index
  n_django -->|"read feed, quorum inside the region [cql]"| n_cassandra_us
  n_django -->|"social graph, master per shard [thrift]"| n_tao_us
  n_tao_eu -.->|"cross-region propagation of region-local writes [async-queue, at-least-once]"| n_tao_us
  n_akkio -.->|"microshard placement by access pattern [internal, at-least-once]"| n_cassandra_us
  n_akkio -.->|"migrate microshard to the user's continent [internal, at-least-once]"| n_cassandra_eu
  n_django -.->|"errors and metrics [http, at-most-once]"| n_observability
```
