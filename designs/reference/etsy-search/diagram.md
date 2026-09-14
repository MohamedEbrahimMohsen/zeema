# etsy-search

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_buyer_client["Buyers on web, mobile web and app<br/><i>user-device</i>"]
  n_deploy_pipeline["Deployinator to Jenkins<br/><i>jenkins</i>"]
  n_metrics["StatsD relays and metrics<br/><i>observability-stack</i>"]
  subgraph n_g_gcp_prod["Google Cloud, single region (region)"]
    subgraph n_g_render_path["Production render path (trust-zone)"]
      n_web_render_path["Production render path (PHP)<br/><i>container-service</i>"]
      n_internal_api["Internal http API cluster<br/><i>container-service</i>"]
      n_varnish["Varnish<br/><i>varnish</i>"]
    end
    subgraph n_g_search_tier["Search services on GKE (trust-zone)"]
      n_search_app["Search application<br/><i>container-service</i>"]
      n_spell_correction["spell_correction<br/><i>container-service</i>"]
      n_mixer["mixer<br/><i>container-service</i>"]
      n_listings_search["listings_search replicas, candidate retrieval<br/><i>solr</i>"]
      n_index_primary["Index build primary<br/><i>solr</i>"]
      n_torrent_replicator["BitTorrent index replication<br/><i>container-worker</i>"]
      n_ranking_service["Second-pass ranking, TF Ranking<br/><i>tensorflow-serving</i>"]
      n_relevance_student["Semantic relevance student, two-tower BERT<br/><i>tensorflow-serving</i>"]
      n_search_indexer["Search indexing streaming applications<br/><i>container-worker</i>"]
      n_gke_search["Search GKE cluster, search-flip and search-flop<br/><i>google-gke</i>"]
    end
    subgraph n_g_data_tier["Data tier (trust-zone)"]
      n_memcached["memcached pools<br/><i>memcached</i>"]
      n_vitess["Vitess<br/><i>vitess</i>"]
      n_shard_map_sqlite["SQLite shard map on each Vitess server<br/><i>sqlite</i>"]
      n_mysql_shards["Sharded MySQL, ~1,000 shards<br/><i>mysql</i>"]
      n_kafka["Kafka on GKE<br/><i>kafka</i>"]
      n_franz["Franz, the primary Kafka producer<br/><i>container-worker</i>"]
      n_zookeeper["ZooKeeper<br/><i>zookeeper</i>"]
    end
    subgraph n_g_relevance_offline["Offline relevance pipeline (system)"]
      n_relevance_teacher["Qwen 3 VL teacher, offline labelling<br/><i>vllm</i>"]
    end
  end
  n_buyer_client -->|"search query from web, mobile web or app [https]"| n_web_render_path
  n_web_render_path -->|"internal API call keyed on url, query and Vary [http]"| n_varnish
  n_varnish -->|"miss forwards to the downstream server [http]"| n_internal_api
  n_web_render_path -->|"look-aside: database and search index query results [memcached]"| n_memcached
  n_web_render_path -->|"every sharded query goes through Vitess [mysql]"| n_vitess
  n_vitess -->|"ids below the threshold use the local lookup vindex [sqlite]"| n_shard_map_sqlite
  n_vitess -->|"routed by vindex on the shardifier id [mysql]"| n_mysql_shards
  n_web_render_path -->|"search request [http]"| n_search_app
  n_search_app -->|"correct the query [http]"| n_spell_correction
  n_search_app -->|"http"| n_mixer
  n_search_app -->|"first pass: top 1,000 of millions of listings [http]"| n_listings_search
  n_search_app -->|"search index query results [memcached]"| n_memcached
  n_listings_search -->|"second pass: rank the candidate set per user and query [grpc]"| n_ranking_service
  n_ranking_service -->|"filter, feature, loss weight and boost, under 10 ms added [grpc]"| n_relevance_student
  n_web_render_path -.->|"marketplace change events [http, at-least-once]"| n_franz
  n_franz -.->|"in-memory buffer in front of the brokers [kafka, at-least-once]"| n_kafka
  n_kafka -.->|"RF=3 over three zones, backlog replayed after an outage [kafka, at-least-once]"| n_search_indexer
  n_search_indexer -.->|"index listing changes [http, at-least-once]"| n_index_primary
  n_index_primary -.->|"hash the optimized index into a torrent [http]"| n_torrent_replicator
  n_torrent_replicator -.->|"replicas download then seed, 60 min to 6 min [bittorrent]"| n_listings_search
  n_kafka -->|"cluster metadata, run across zones [zookeeper]"| n_zookeeper
  n_search_app -.->|"sampled search requests replayed daily [https]"| n_relevance_teacher
  n_relevance_teacher -.->|"millions of query-listing labels distilled into the student [https]"| n_relevance_student
  n_deploy_pipeline -->|"build, push and kubectl apply per search service, in parallel [kubectl]"| n_gke_search
  n_web_render_path -.->|"statsd, at-most-once"| n_metrics
  n_search_app -.->|"statsd, at-most-once"| n_metrics
```
