# proximity-service

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_mobile_client["mobile-client<br/><i>mobile-app</i>"]
  n_web_client["web-client<br/><i>web-browser</i>"]
  subgraph n_g_region["Deployment region (region)"]
    subgraph n_g_edge["edge (trust-zone)"]
      n_lb["Load balancer<br/><i>load-balancer-tier</i>"]
    end
    subgraph n_g_core["core (trust-zone)"]
      n_lbs["Location-based service<br/><i>container-service</i>"]
      n_business_service["Business service<br/><i>container-service</i>"]
      n_index_updater["Index propagation worker<br/><i>container-worker</i>"]
      n_quadtree_rebuild_job["Quadtree rebuild job<br/><i>container-worker</i>"]
    end
    subgraph n_g_data["data (trust-zone)"]
      n_business_cdc["Business change feed<br/><i>debezium</i>"]
      n_geohash_cache["Geohash Redis<br/><i>redis</i>"]
      n_business_cache["Business info Redis<br/><i>redis</i>"]
      n_geohash_index["Geohash index<br/><i>geo-cell-index</i>"]
      n_quadtree_servers["Quadtree servers<br/><i>geo-cell-index</i>"]
      n_business_db["Business database<br/><i>mysql</i>"]
    end
    subgraph n_g_business_search["Yelp business search (system)"]
      n_indexing_pipeline["Indexing pipeline<br/><i>container-worker</i>"]
      n_geoshard_index["Geosharded Elasticsearch<br/><i>elasticsearch</i>"]
      n_snapshot_store["Index snapshots<br/><i>s3</i>"]
    end
  end
  n_mobile_client -->|"nearby(lat, long, radius) [https]"| n_lb
  n_web_client -->|"nearby(lat, long, radius) [https]"| n_lb
  n_lb -->|"GET nearby [http]"| n_lbs
  n_lb -->|"business CRUD [http]"| n_business_service
  n_lbs -->|"cell and its 8 neighbours, queried in parallel [redis]"| n_geohash_cache
  n_lbs -->|"geohash to business ids on cache miss [mysql]"| n_geohash_index
  n_lbs -->|"alternative index, replicated for reads [grpc]"| n_quadtree_servers
  n_lbs -->|"hydrate business details by id [redis]"| n_business_cache
  n_lbs -->|"read replica fills the cache miss [mysql]"| n_business_db
  n_lbs -->|"query routed to the geoshard for the location [http]"| n_geoshard_index
  n_business_service -->|"create and update businesses [mysql]"| n_business_db
  n_business_db -.->|"binlog [mysql-binlog, at-least-once]"| n_business_cdc
  n_business_cdc -.->|"business changes [cdc, at-least-once]"| n_index_updater
  n_index_updater -.->|"daily batch of cell membership changes [mysql, at-least-once]"| n_geohash_index
  n_index_updater -.->|"refresh cell lists [redis, at-least-once]"| n_geohash_cache
  n_index_updater -.->|"invalidate business info [redis, at-least-once]"| n_business_cache
  n_quadtree_rebuild_job -->|"read every business [mysql]"| n_business_db
  n_quadtree_rebuild_job -.->|"rebuild at startup, a few minutes for 200M [grpc, at-least-once]"| n_quadtree_servers
  n_indexing_pipeline -->|"read the source of truth [mysql]"| n_business_db
  n_indexing_pipeline -.->|"bulk reindex of geoshard and microshard [http, at-least-once]"| n_geoshard_index
  n_indexing_pipeline -.->|"write index snapshot [https, at-least-once]"| n_snapshot_store
  n_snapshot_store -.->|"instances load the snapshot at startup [https, at-least-once]"| n_geoshard_index
```
