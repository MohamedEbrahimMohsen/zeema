# youtube-upload-playback

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_device_client["Browser, mobile and TV clients<br/><i>web-browser</i>"]
  subgraph n_g_colo["YouTube colo (region)"]
    subgraph n_g_serving_tier["Web and video serving tier (trust-zone)"]
      n_netscaler["NetScaler<br/><i>load-balancer-tier</i>"]
      n_apache_frontend["Apache + mod_fastcgi<br/><i>apache-httpd</i>"]
      n_python_app["Python app servers (Spitfire, psyco)<br/><i>container-service</i>"]
      n_page_cache["Row, object and page caches<br/><i>memcached</i>"]
      n_precompute_jobs["Precalculation jobs<br/><i>cron-job</i>"]
      n_lighttpd_video["lighttpd video mini-clusters<br/><i>container-service</i>"]
    end
    subgraph n_g_data_tier["Data tier (trust-zone)"]
      n_vitess["Vitess (VTGate and VTTablet)<br/><i>vitess</i>"]
      n_mysql_shards["MySQL shards (users, videos, subscriptions)<br/><i>mysql</i>"]
      n_zookeeper["ZooKeeper (Vitess topology)<br/><i>zookeeper</i>"]
      n_thumbnail_store["Thumbnail store (BigTable)<br/><i>bigtable</i>"]
      n_video_storage["Video master and variant storage<br/><i>blob-store</i>"]
      n_colo_video_store["Colo video racks (long tail)<br/><i>blob-store</i>"]
    end
    subgraph n_g_upload_pipeline["Upload and transcoding (system)"]
      n_upload_service["Chunked resumable upload service<br/><i>container-service</i>"]
      n_transcode_queue["Transcode job queue<br/><i>message-queue</i>"]
      n_transcoding_farm["Transcoding farm (Argos VCU)<br/><i>container-worker</i>"]
      n_extract_queue["Extraction job queue<br/><i>message-queue</i>"]
      n_extractors["Thumbnail, caption and metadata extractors<br/><i>container-worker</i>"]
    end
  end
  subgraph n_g_edge_pop["CDN edge (point-of-presence)"]
    n_video_cdn["CDN (most popular videos)<br/><i>content-delivery-network</i>"]
  end
  n_device_client -->|"watch page [https]"| n_netscaler
  n_netscaler -->|"http"| n_apache_frontend
  n_apache_frontend -->|"mod_fastcgi [fastcgi]"| n_python_app
  n_python_app -->|"row, object and page cache [memcached]"| n_page_cache
  n_python_app -->|"every database request [mysql]"| n_vitess
  n_vitess -->|"routed by shard key, pooled [mysql]"| n_mysql_shards
  n_vitess -->|"topology and locks [zookeeper]"| n_zookeeper
  n_python_app -->|"60 thumbnails per page [bigtable-rpc]"| n_thumbnail_store
  n_precompute_jobs -->|"read source rows [mysql]"| n_vitess
  n_precompute_jobs -.->|"push precalculated data [memcached, at-least-once]"| n_page_cache
  n_device_client -->|"popular videos [https]"| n_video_cdn
  n_device_client -->|"long tail, 1-20 views per day [https]"| n_lighttpd_video
  n_lighttpd_video -->|"read from local racks [file]"| n_colo_video_store
  n_device_client -->|"chunked resumable upload [https]"| n_upload_service
  n_upload_service -->|"store original [internal]"| n_video_storage
  n_upload_service -.->|"transcode job [amqp, at-least-once]"| n_transcode_queue
  n_transcode_queue -.->|"amqp, at-least-once"| n_transcoding_farm
  n_transcoding_farm -.->|"dozens of resolution and codec variants [internal, at-least-once]"| n_video_storage
  n_transcoding_farm -.->|"distribute popular variants [internal, at-least-once]"| n_video_cdn
  n_transcoding_farm -.->|"distribute long tail [internal, at-least-once]"| n_colo_video_store
  n_upload_service -.->|"thumbnail, caption and metadata jobs [amqp, at-least-once]"| n_extract_queue
  n_extract_queue -.->|"amqp, at-least-once"| n_extractors
  n_extractors -->|"4 thumbnails per video [bigtable-rpc]"| n_thumbnail_store
  n_extractors -->|"write video metadata [mysql]"| n_vitess
```
