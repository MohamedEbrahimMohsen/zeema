# zoom-video

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_desktop_client["Zoom desktop client<br/><i>desktop-app</i>"]
  n_mobile_client["Zoom mobile client<br/><i>mobile-app</i>"]
  n_room_system["Zoom Room and SIP room system<br/><i>user-device</i>"]
  subgraph n_g_americas["americas (region)"]
    subgraph n_g_mz_americas["Meeting Zone, Equinix Silicon Valley (point-of-presence)"]
      n_zc_americas["Zone Controller<br/><i>apache-helix</i>"]
      n_mmr_americas["Multimedia Router (MMR)<br/><i>mediasoup</i>"]
    end
  end
  subgraph n_g_emea["emea (region)"]
    subgraph n_g_mz_emea["Meeting Zone, Equinix Amsterdam (point-of-presence)"]
      n_zc_emea["Zone Controller<br/><i>apache-helix</i>"]
      n_mmr_emea["Multimedia Router (MMR)<br/><i>mediasoup</i>"]
    end
  end
  subgraph n_g_china["china (region)"]
    subgraph n_g_mz_china["Geofenced data center (point-of-presence)"]
      n_zc_china["Zone Controller<br/><i>apache-helix</i>"]
      n_mmr_china["Multimedia Router (MMR)<br/><i>mediasoup</i>"]
    end
  end
  subgraph n_g_public_cloud["AWS, Oracle Cloud and Azure (system)"]
    n_web_cdn["zoom.us CDN<br/><i>cloudflare-cdn</i>"]
    n_web_tier["zoom.us web tier<br/><i>container-service</i>"]
    n_back_office["Non-meeting back office<br/><i>container-service</i>"]
    n_mmr_cloud_burst["Burst MMR capacity<br/><i>mediasoup</i>"]
    n_cloud_exchange_fabric["Equinix Cloud Exchange Fabric<br/><i>aws-direct-connect</i>"]
    n_pstn_gateway["PSTN and SIP gateway<br/><i>freeswitch</i>"]
    n_cloud_recording["Cloud recording store<br/><i>blob-store</i>"]
  end
  subgraph n_g_customer_network["Customer network (trust-zone)"]
    n_mc_zone_controller["Meeting Connector Zone Controller<br/><i>apache-helix</i>"]
    n_mc_mmr["Meeting Connector MMR<br/><i>mediasoup</i>"]
  end
  n_desktop_client -->|"sign in, schedule, join [https]"| n_web_cdn
  n_mobile_client -->|"sign in, schedule, join [https]"| n_web_cdn
  n_room_system -->|"join [https]"| n_web_cdn
  n_web_cdn -->|"zoom.us origin on public cloud [https]"| n_web_tier
  n_web_cdn -->|"account, billing, reporting [https]"| n_back_office
  n_web_tier -->|"pick the meeting zone nearest the participant [https]"| n_zc_americas
  n_web_tier -->|"pick the meeting zone nearest the participant [https]"| n_zc_emea
  n_web_tier -->|"China accounts pinned to the geofenced zone [https]"| n_zc_china
  n_web_tier -->|"Meeting Connector handoff: designate the primary ZC [https]"| n_mc_zone_controller
  n_zc_americas -->|"allocate a router by server load [https]"| n_mmr_americas
  n_zc_emea -->|"allocate a router by server load [https]"| n_mmr_emea
  n_zc_china -->|"allocate a router by server load [https]"| n_mmr_china
  n_mc_zone_controller -->|"designate the on-premise router [https]"| n_mc_mmr
  n_desktop_client -.->|"one multi-bitrate stream up, UDP 8801, falls back to TCP 443 then TLS [udp, at-most-once]"| n_mmr_americas
  n_mmr_americas -.->|"selectively forwarded streams at the bitrate each receiver can take [udp, at-most-once]"| n_desktop_client
  n_mobile_client -.->|"one multi-bitrate stream up [udp, at-most-once]"| n_mmr_emea
  n_mmr_emea -.->|"selectively forwarded streams [udp, at-most-once]"| n_mobile_client
  n_mobile_client -.->|"participants in China stay inside the geofenced zone [udp, at-most-once]"| n_mmr_china
  n_mmr_china -.->|"selectively forwarded streams [udp, at-most-once]"| n_mobile_client
  n_desktop_client -.->|"two-party meeting runs peer to peer, no MMR [udp, at-most-once]"| n_mobile_client
  n_desktop_client -.->|"media stays inside the customer network [udp, at-most-once]"| n_mc_mmr
  n_mc_mmr -.->|"cascade to the Zoom cloud for external participants [udp, at-most-once]"| n_mmr_americas
  n_mmr_americas -.->|"cascade so each participant stays in a local zone [udp, at-most-once]"| n_mmr_emea
  n_mmr_americas -.->|"private interconnect instead of the public internet [udp, at-most-once]"| n_cloud_exchange_fabric
  n_cloud_exchange_fabric -.->|"burst meeting capacity in public cloud [udp, at-most-once]"| n_mmr_cloud_burst
  n_mmr_americas -.->|"cloud recording [https, at-least-once]"| n_cloud_recording
  n_room_system -.->|"dial-in and SIP room system interop [sip, at-most-once]"| n_pstn_gateway
  n_pstn_gateway -.->|"dial-in audio into the meeting [rtp, at-most-once]"| n_mmr_americas
```
