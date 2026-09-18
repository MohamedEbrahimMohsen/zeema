# dropbox-sync

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_desktop_client["Nucleus desktop client<br/><i>desktop-app</i>"]
  n_web_client["dropbox.com and mobile apps<br/><i>web-browser</i>"]
  n_gslb["GSLB / GeoDNS<br/><i>dns-resolver</i>"]
  subgraph n_g_pop["PoP (20 sites, 2018) (point-of-presence)"]
    n_pop_ipvs["IPVS<br/><i>load-balancer-tier</i>"]
    n_pop_nginx["nginx edge proxy<br/><i>nginx</i>"]
  end
  subgraph n_g_us_west["US West zone (region)"]
    n_block_index["Block Index<br/><i>mysql</i>"]
    n_mp_cold_tier["Magic Pocket cold tier<br/><i>blob-store</i>"]
    subgraph n_g_dc_core["Data-center services (trust-zone)"]
      n_bandaid["Bandaid<br/><i>load-balancer-tier</i>"]
      n_metaserver["Metaserver<br/><i>container-service</i>"]
      n_blockserver["Blockserver / Magic Pocket frontend<br/><i>container-service</i>"]
      n_notification_server["Notification server<br/><i>websocket-gateway</i>"]
      n_edgestore_core["Edgestore Cores<br/><i>container-service</i>"]
      n_edgestore_engine["Edgestore Engines<br/><i>proxysql</i>"]
      n_panda_frontend["Panda frontend<br/><i>container-service</i>"]
    end
    subgraph n_g_metadata_plane["Metadata plane (trust-zone)"]
      n_sfj["Server File Journal<br/><i>mysql</i>"]
      n_sync_memcache["Streaming-sync memcache<br/><i>memcached</i>"]
      n_edgestore_cache["Edgestore cache<br/><i>cache-cluster</i>"]
      n_edgestore_txn_record["Edgestore transaction record<br/><i>etcd</i>"]
      n_metadata_mysql["MySQL metadata shards<br/><i>mysql</i>"]
      n_panda_storage_node["Panda storage node<br/><i>nosql-store</i>"]
    end
    subgraph n_g_mp_cell["Magic Pocket cell (~50 PB) (cell)"]
      n_replication_table["Replication Table<br/><i>mysql</i>"]
      n_mp_master["Magic Pocket Master<br/><i>etcd</i>"]
      n_volume_manager["Volume Manager<br/><i>container-worker</i>"]
      n_osd["OSD fleet (SMR)<br/><i>blob-store</i>"]
      n_cross_zone_replicator["Cross-zone replication daemon<br/><i>container-worker</i>"]
    end
  end
  n_desktop_client -->|"nearest PoP unless over capacity [dns]"| n_gslb
  n_web_client -->|"dns"| n_gslb
  n_desktop_client -->|"consistent hash, packet encapsulation [tcp-tls]"| n_pop_ipvs
  n_web_client -->|"tcp-tls"| n_pop_ipvs
  n_pop_ipvs -->|"L4 to L7 inside the PoP [tcp]"| n_pop_nginx
  n_pop_nginx -->|"keep-alive over the backbone [http2]"| n_bandaid
  n_bandaid -->|"URL routing; retries exclude tried hosts [http]"| n_metaserver
  n_bandaid -->|"http"| n_blockserver
  n_desktop_client -->|"commit blocklist; list from cursor [https]"| n_metaserver
  n_metaserver -->|"need blocks [https]"| n_desktop_client
  n_desktop_client -->|"put / retrieve_batch 4 MB blocks [https]"| n_blockserver
  n_metaserver -->|"append one version row per namespace [mysql]"| n_sfj
  n_metaserver -->|"write on failed commit, read on list [memcached]"| n_sync_memcache
  n_metaserver -->|"users, namespaces, sharing [edgestore-rpc]"| n_edgestore_core
  n_metaserver -.->|"per-namespace change hint [grpc, at-most-once]"| n_notification_server
  n_notification_server -.->|"hint only; a lost hint costs latency [http-long-poll, at-most-once]"| n_desktop_client
  n_edgestore_core -->|"95% of reads; invalidated on write [internal]"| n_edgestore_cache
  n_edgestore_core -->|"route to the owning shard or region [grpc]"| n_edgestore_engine
  n_edgestore_core -->|"phase 0: durable transaction record [edgestore-rpc]"| n_edgestore_txn_record
  n_edgestore_engine -->|"copy-on-write staging tables, 2PC [mysql]"| n_metadata_mysql
  n_edgestore_engine -->|"Panda sits between Edgestore and MySQL [panda-rpc]"| n_panda_frontend
  n_panda_frontend -->|"~100 GB key range; 2PC, hybrid-logical clocks [grpc]"| n_panda_storage_node
  n_panda_storage_node -->|"MySQL used only as the storage engine [mysql]"| n_metadata_mysql
  n_blockserver -->|"existence check by hash; commit point for a put [mysql]"| n_block_index
  n_blockserver -->|"bucket -&gt; volume -&gt; OSD set [mysql]"| n_replication_table
  n_blockserver -->|"store to every OSD, fsync before ack; retry another volume [internal]"| n_osd
  n_osd -.->|"internal, at-least-once"| n_cross_zone_replicator
  n_cross_zone_replicator -.->|"remote zone within ~1 s; &gt;= 2 zones per block [internal, at-least-once]"| n_osd
  n_osd -.->|"split + XOR across zones, 2x -&gt; 1.5x [internal, at-least-once]"| n_mp_cold_tier
  n_mp_master -.->|"health watch; repair after 15 min offline [internal, at-least-once]"| n_osd
  n_mp_master -.->|"move volume, erasure-code, reconstruct [grpc, at-least-once]"| n_volume_manager
  n_mp_master -->|"generation bump, then mapping update (commit point) [mysql]"| n_replication_table
  n_volume_manager -.->|"reconstruction reads fan out over hundreds of OSDs [internal, at-least-once]"| n_osd
  n_volume_manager -.->|"reconstruct a cold blob from its XOR zone [internal, at-least-once]"| n_mp_cold_tier
```
