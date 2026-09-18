# wikipedia

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_readers_and_editors["Readers and editors (browsers and apps)<br/><i>web-browser</i>"]
  n_authoritative_dns["Authoritative DNS (GeoDNS + DNS Discovery)<br/><i>dns-resolver</i>"]
  subgraph n_g_edge["Caching sites: esams, ulsfo, eqsin, drmrs, magru, and the cache layer of each core datacenter (point-of-presence)"]
    n_lvs_director["LVS director + PyBal<br/><i>load-balancer-tier</i>"]
    n_haproxy_tls["HAProxy on the cache hosts<br/><i>haproxy</i>"]
    n_varnish_frontend["Varnish frontend (in memory)<br/><i>varnish</i>"]
    n_ats_backend["Apache Traffic Server backend (on disk)<br/><i>trafficserver</i>"]
    n_purged["purged<br/><i>container-worker</i>"]
  end
  subgraph n_g_eqiad["eqiad (Ashburn), primary application datacenter (region)"]
    subgraph n_g_eqiad_app["Internal application network, Envoy-terminated TLS (trust-zone)"]
      n_mw_web["mw-web (MediaWiki on Kubernetes)<br/><i>container-service</i>"]
      n_mw_api["mw-api-ext / mw-api-int<br/><i>container-service</i>"]
      n_mw_jobrunner["mw-jobrunner<br/><i>container-worker</i>"]
      n_eventgate["EventGate<br/><i>container-service</i>"]
      n_changeprop["changeprop / changeprop-jobqueue<br/><i>container-worker</i>"]
      n_thumbor["Thumbor (on-demand thumbnailing)<br/><i>ffmpeg</i>"]
    end
    subgraph n_g_eqiad_data["Restricted data tier (trust-zone)"]
      n_memcached_main["Memcached main pool (18 shards per DC)<br/><i>memcached</i>"]
      n_memcached_gutter["Memcached gutter pool (3 shards per DC)<br/><i>memcached</i>"]
      n_parsercache["ParserCache pc1-pc8 (MariaDB)<br/><i>cache-cluster</i>"]
      n_mariadb_core_primary["MariaDB core sections s1-s8, x1-x4 (primary)<br/><i>mariadb</i>"]
      n_mariadb_core_replicas["MariaDB core section replicas (weighted, lag aware)<br/><i>mariadb</i>"]
      n_external_store["External Store es1-es7<br/><i>mariadb</i>"]
      n_kask_session_store["Session store (Kask over Cassandra)<br/><i>cassandra</i>"]
      n_swift["Swift media store (ms-fe / ms-be)<br/><i>swift</i>"]
      n_kafka_main_eqiad["Kafka main-eqiad<br/><i>kafka</i>"]
    end
  end
  subgraph n_g_codfw["codfw (Carrollton), secondary application datacenter (region)"]
    n_mariadb_codfw_master["MariaDB DC master in codfw<br/><i>mariadb</i>"]
    n_kafka_main_codfw["Kafka main-codfw<br/><i>kafka</i>"]
  end
  n_readers_and_editors -->|"GeoIP resolution, 5-minute TTLs [dns]"| n_authoritative_dns
  n_readers_and_editors -->|"nearest site's service IP, announced by PyBal over BGP [tcp]"| n_lvs_director
  n_lvs_director -->|"LVS-DR: only forward traffic is balanced, responses bypass the director [tcp]"| n_haproxy_tls
  n_haproxy_tls -->|"TLS and HTTP/2 terminated, rate limiting applied [http]"| n_varnish_frontend
  n_varnish_frontend -->|"on frontend miss; backend chosen by request hash [https]"| n_ats_backend
  n_ats_backend -->|"on backend miss; GET routed to the local application datacenter [https]"| n_mw_web
  n_ats_backend -->|"/w/api.php and /w/rest.php [https]"| n_mw_api
  n_varnish_frontend -->|"cache_upload: original or thumbnail fetch on miss [http]"| n_swift
  n_swift -->|"proxy plugin renders a missing thumbnail on demand [http]"| n_thumbor
  n_thumbor -.->|"Thumbor saves a copy in Swift [http, at-least-once]"| n_swift
  n_mw_web -->|"WANObjectCache on every render, sharded and relayed by mcrouter [memcached]"| n_memcached_main
  n_mw_web -->|"gutter pool: used when a main-pool shard is down [memcached]"| n_memcached_gutter
  n_mw_web -->|"parsed wikitext, consistent hashing on the cache key, 30-day TTL [mysql]"| n_parsercache
  n_mw_web -->|"read path; replica chosen by weight and replication lag, 60s query killer [mysql]"| n_mariadb_core_replicas
  n_mw_web -->|"compressed full text of the page revision [mysql]"| n_external_store
  n_mw_web -->|"login sessions, multi-region Cassandra underneath [http]"| n_kask_session_store
  n_mw_web -->|"FileBackend: uploads and originals [http]"| n_swift
  n_mw_api -->|"edits: POST routed to the primary datacenter only [mysql]"| n_mariadb_core_primary
  n_mw_web -->|"EventBus extension, JSONSchema-validated before acceptance [http]"| n_eventgate
  n_mariadb_core_primary -.->|"per-section primary to local replicas [mysql-replication, at-least-once]"| n_mariadb_core_replicas
  n_mariadb_core_primary -.->|"cross-DC, TLS encrypted; the DC master then feeds codfw's replicas [mysql-replication, at-least-once]"| n_mariadb_codfw_master
  n_eventgate -.->|"topic prefixed with the producing datacenter [kafka, at-least-once]"| n_kafka_main_eqiad
  n_kafka_main_eqiad -.->|"codfw pulls all eqiad.* topics; mirrored both ways [kafka-mirrormaker, at-least-once]"| n_kafka_main_codfw
  n_kafka_main_eqiad -.->|"eqiad.resource-purge and codfw.resource-purge [kafka, at-least-once]"| n_purged
  n_purged -->|"4 frontend workers [http-purge]"| n_varnish_frontend
  n_purged -->|"48 backend workers [http-purge]"| n_ats_backend
  n_kafka_main_eqiad -.->|"once an event is in Kafka it will be processed [kafka, at-least-once]"| n_changeprop
  n_changeprop -->|"one HTTP call per job; dedicated consumers for high-traffic jobs, deduplicated [http]"| n_mw_jobrunner
  n_changeprop -.->|"persistent error tracking in a dedicated error topic [kafka, at-least-once]"| n_kafka_main_eqiad
```
