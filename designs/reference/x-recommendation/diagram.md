# x-recommendation

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  subgraph n_g_client_edge["Client and GraphQL edge (trust-zone)"]
    n_x_client["X app, For You timeline<br/><i>mobile-app</i>"]
    n_graphql_edge["GraphQL edge<br/><i>envoy-gateway</i>"]
  end
  subgraph n_g_request_path["Home Mixer and the request-path services (trust-zone)"]
    n_home_mixer["Home Mixer<br/><i>container-service</i>"]
    n_timelineranker["TimelineRanker<br/><i>container-service</i>"]
    n_cr_mixer["CR-Mixer<br/><i>container-service</i>"]
    n_frs["Follow Recommendations Service<br/><i>container-service</i>"]
    n_earlybird_root["Earlybird superroot<br/><i>load-balancer-tier</i>"]
    n_earlybird_index["Earlybird realtime index<br/><i>elasticsearch</i>"]
    n_uteg["User Tweet Entity Graph, GraphJet<br/><i>graph-store</i>"]
    n_social_graph["Social Graph Service<br/><i>graph-store</i>"]
    n_graph_feature_service["Graph Feature Service<br/><i>graph-store</i>"]
    n_heavy_ranker["Heavy Ranker on Navi<br/><i>tensorflow-serving</i>"]
    n_representation_manager["Representation Manager<br/><i>cache-cluster</i>"]
    n_visibility_filtering["Visibility Filtering<br/><i>container-service</i>"]
    n_tweetypie["Tweetypie<br/><i>container-service</i>"]
    n_twemcache["Twemcache<br/><i>memcached</i>"]
    n_manhattan["Manhattan<br/><i>nosql-store</i>"]
  end
  subgraph n_g_offline["Offline jobs and the stores they maintain (trust-zone)"]
    n_post_events["Post and user-modification topics<br/><i>kafka</i>"]
    n_uua_kafka["Unified User Actions<br/><i>kafka</i>"]
    n_index_ingester["Index Ingester<br/><i>container-worker</i>"]
    n_signal_ingester["Signal Ingester, Heron topology<br/><i>storm</i>"]
    n_recos_injector["Recos-Injector<br/><i>container-worker</i>"]
    n_simclusters_job["SimClusters Known For job<br/><i>container-worker</i>"]
    n_simclusters_embedding_job["SimClusters realtime tweet-embedding job<br/><i>container-worker</i>"]
    n_embedding_cache["SimClusters embedding Memcache<br/><i>memcached</i>"]
  end
  n_x_client -->|"For You request [https]"| n_graphql_edge
  n_graphql_edge -->|"construct the home timeline [graphql]"| n_home_mixer
  n_home_mixer -->|"in-network candidates, truncated to the requested count [thrift]"| n_timelineranker
  n_timelineranker -->|"relevance-scored in-network posts [thrift]"| n_earlybird_root
  n_earlybird_root -->|"fan out to clusters and partitions, merge [thrift]"| n_earlybird_index
  n_timelineranker -->|"posts liked by the accounts you follow [thrift]"| n_uteg
  n_timelineranker -->|"follow graph, blocked and muted state [thrift]"| n_social_graph
  n_home_mixer -->|"out-of-network candidate coordination [thrift]"| n_cr_mixer
  n_cr_mixer -->|"source signals and embeddings [thrift]"| n_representation_manager
  n_home_mixer -->|"FutureGraph posts and Who-to-Follow [thrift]"| n_frs
  n_home_mixer -->|"embedding features [thrift]"| n_representation_manager
  n_home_mixer -->|"user-pair graph features [thrift]"| n_graph_feature_service
  n_home_mixer -->|"score every candidate; falls back to the reverse-chron pipeline [grpc]"| n_heavy_ranker
  n_home_mixer -->|"allow, interstitial or drop, per post and viewer [thrift]"| n_visibility_filtering
  n_home_mixer -->|"hydrate the posts that survived [thrift]"| n_tweetypie
  n_tweetypie -->|"caching repository [memcached]"| n_twemcache
  n_tweetypie -->|"post data of record [thrift]"| n_manhattan
  n_representation_manager -->|"embedding facade read [memcached]"| n_embedding_cache
  n_x_client -.->|"client and server side user actions [kafka, at-least-once]"| n_uua_kafka
  n_uua_kafka -.->|"fav, retweet, follow, client events [kafka, at-least-once]"| n_recos_injector
  n_recos_injector -.->|"per-service GraphJet topic [kafka, at-least-once]"| n_uteg
  n_uua_kafka -.->|"engagement events [kafka, at-least-once]"| n_signal_ingester
  n_signal_ingester -.->|"live fav, retweet and reply counts [thrift, at-least-once]"| n_earlybird_index
  n_post_events -.->|"posts and user modifications [kafka, at-least-once]"| n_index_ingester
  n_index_ingester -.->|"incremental indexing [kafka, at-least-once]"| n_earlybird_index
  n_uua_kafka -.->|"favourite events [kafka, at-least-once]"| n_simclusters_embedding_job
  n_simclusters_embedding_job -->|"post embedding updated on each favourite [memcached]"| n_embedding_cache
  n_embedding_cache -.->|"PersistentTweetJob [thrift, at-least-once]"| n_manhattan
  n_manhattan -.->|"reload persisted embeddings [thrift, at-least-once]"| n_embedding_cache
  n_social_graph -.->|"follow graph snapshot [batch, at-least-once]"| n_simclusters_job
  n_simclusters_job -.->|"Known For, InterestedIn and producer embeddings [memcached, at-least-once]"| n_embedding_cache
```
