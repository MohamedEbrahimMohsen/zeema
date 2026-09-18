# twitch-live

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_broadcaster_software["Broadcaster software<br/><i>desktop-app</i>"]
  n_viewer_client["Viewer clients (web, mobile, TV)<br/><i>user-device</i>"]
  n_capacitor["Capacitor<br/><i>observability-stack</i>"]
  n_the_well["The Well<br/><i>observability-stack</i>"]
  n_backbone["Private backbone<br/><i>spine-leaf-fabric</i>"]
  subgraph n_g_ingest_pop["Ingest PoP (one of ~100) (point-of-presence)"]
    n_intelligest_proxy["Intelligest media proxy<br/><i>srs</i>"]
  end
  subgraph n_g_origin_dc["Origin data center (point-of-presence)"]
    n_twitch_transcoder["TwitchTranscoder<br/><i>ffmpeg</i>"]
  end
  subgraph n_g_edge_pop["Edge PoP (point-of-presence)"]
    n_edge_cdn["Edge PoPs (HLS distribution)<br/><i>content-delivery-network</i>"]
  end
  subgraph n_g_aws["AWS (region)"]
    n_irs["Intelligest Routing Service (IRS)<br/><i>apache-helix</i>"]
    n_vod_archive["VOD archive<br/><i>s3</i>"]
    n_helix_api["Helix API<br/><i>envoy-gateway</i>"]
    n_go_services["Go microservices (Twirp)<br/><i>container-service</i>"]
    n_event_bus["Event Bus<br/><i>sns</i>"]
    n_eventsub["EventSub<br/><i>webhook-receiver</i>"]
    n_spade["Spade<br/><i>kinesis</i>"]
    n_tahoe["Tahoe data lake<br/><i>s3</i>"]
    n_sheik["Sheik<br/><i>redshift</i>"]
    n_search_index["Search<br/><i>aws-opensearch</i>"]
    n_user_db["DynamoDB<br/><i>dynamodb</i>"]
    n_relational_db["PostgreSQL<br/><i>postgres</i>"]
    n_db_cdc["Change data capture<br/><i>debezium</i>"]
    subgraph n_g_chat["Chat (system)"]
      n_chat_edge["Chat Edge<br/><i>websocket-gateway</i>"]
      n_chat_pubsub["Chat Pubsub<br/><i>redis-pubsub</i>"]
      n_clue["Clue<br/><i>container-service</i>"]
      n_room["Room<br/><i>container-service</i>"]
    end
  end
  n_broadcaster_software -.->|"push to nearest PoP [rtmp, at-most-once]"| n_intelligest_proxy
  n_intelligest_proxy -->|"which origin takes this stream [rpc]"| n_irs
  n_capacitor -.->|"origin compute utilisation [http, at-least-once]"| n_irs
  n_the_well -.->|"backbone network health [http, at-least-once]"| n_irs
  n_intelligest_proxy -.->|"forward stream to chosen origin [rtmp, at-most-once]"| n_backbone
  n_backbone -.->|"rtmp, at-most-once"| n_twitch_transcoder
  n_twitch_transcoder -.->|"aligned HLS variants [hls, at-most-once]"| n_backbone
  n_backbone -.->|"hls, at-most-once"| n_edge_cdn
  n_twitch_transcoder -.->|"archive for VOD [s3, at-least-once]"| n_vod_archive
  n_viewer_client -->|"HLS playback [https]"| n_edge_cdn
  n_viewer_client -.->|"IRC over WebSocket or TCP [websocket, at-least-once]"| n_chat_edge
  n_chat_edge -.->|"fan-out between Edge nodes [internal, at-most-once]"| n_chat_pubsub
  n_chat_edge -->|"ban and subscription checks [rpc]"| n_clue
  n_chat_edge -->|"viewer list membership [rpc]"| n_room
  n_clue -->|"user state [dynamodb]"| n_user_db
  n_room -->|"membership state [dynamodb]"| n_user_db
  n_viewer_client -->|"https"| n_helix_api
  n_helix_api -->|"twirp"| n_go_services
  n_go_services -->|"dynamodb"| n_user_db
  n_go_services -->|"postgres"| n_relational_db
  n_go_services -->|"search query [https]"| n_search_index
  n_relational_db -.->|"write-ahead log [postgres-wal, at-least-once]"| n_db_cdc
  n_db_cdc -.->|"index [https, at-least-once]"| n_search_index
  n_go_services -.->|"sns, at-least-once"| n_event_bus
  n_event_bus -.->|"developer webhooks [https, at-least-once]"| n_eventsub
  n_go_services -.->|"service events [http, at-least-once]"| n_spade
  n_viewer_client -.->|"client events [http, at-least-once]"| n_spade
  n_spade -.->|"s3, at-least-once"| n_tahoe
  n_tahoe -.->|"load for reporting [redshift-copy, at-least-once]"| n_sheik
```
