# cloudflare-edge

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  subgraph n_g_internet["Internet (trust-zone)"]
    n_end_user["end-user<br/><i>web-browser</i>"]
  end
  subgraph n_g_customer_network["Customer network (trust-zone)"]
    n_customer_origin["Customer origin server<br/><i>supplier-api</i>"]
  end
  subgraph n_g_edge_pop["Anycast PoP (one of 200+ cities; MCP sites add a spine layer) (point-of-presence)"]
    n_anycast_edge_router["Anycast BGP edge router<br/><i>cisco-router</i>"]
    n_spine_fabric["MCP spine layer (Clos)<br/><i>spine-leaf-fabric</i>"]
    n_multimog["Multimog (inter-server forwarding)<br/><i>load-balancer-tier</i>"]
    n_conductor["Conductor (per-PoP control plane)<br/><i>container-service</i>"]
    n_consul["consul<br/><i>consul</i>"]
    n_prometheus["prometheus<br/><i>prometheus</i>"]
    n_quicksilver_intermediate["Quicksilver intermediate replica<br/><i>nosql-store</i>"]
    subgraph n_g_edge_server["Every server runs every service (trust-zone)"]
      n_l4drop["l4drop (XDP attack mitigation)<br/><i>cloudflare-ddos-protection</i>"]
      n_unimog_xdpd["Unimog xdpd (in-kernel L4)<br/><i>load-balancer-tier</i>"]
      n_edge_proxy["FL / Pingora edge proxy<br/><i>nginx</i>"]
      n_waf["WAF managed rulesets<br/><i>cloudflare-waf</i>"]
      n_cdn_cache["cdn-cache<br/><i>cloudflare-cdn</i>"]
      n_authoritative_dns["authoritative-dns<br/><i>cloudflare-dns</i>"]
      n_workers_runtime["Workers (V8 isolates)<br/><i>cloudflare-workers</i>"]
      n_spectrum["spectrum<br/><i>cloudflare-spectrum</i>"]
      n_quicksilver_proxy["Quicksilver leaf proxy<br/><i>cache-cluster</i>"]
    end
  end
  subgraph n_g_control_plane["Cloudflare control plane (system)"]
    n_quicksilver_root["Quicksilver root replica<br/><i>nosql-store</i>"]
    n_config_api["Dashboard and configuration API<br/><i>container-service</i>"]
  end
  n_end_user -->|"anycast: BGP steers to the nearest PoP [ip]"| n_anycast_edge_router
  n_anycast_edge_router -->|"Clos mesh inside an MCP site [ecmp]"| n_spine_fabric
  n_spine_fabric -->|"packets reach a server NIC [ip]"| n_l4drop
  n_l4drop -->|"attack packets dropped first, the rest passed [xdp]"| n_unimog_xdpd
  n_unimog_xdpd -->|"forwarding table by 4-tuple, at most one extra hop [xdp]"| n_multimog
  n_multimog -->|"deliver to the chosen server [tcp]"| n_edge_proxy
  n_multimog -->|"authoritative and resolver queries [dns]"| n_authoritative_dns
  n_multimog -->|"Spectrum TCP and UDP applications [tcp]"| n_spectrum
  n_conductor -->|"per-server CPU and load [http]"| n_prometheus
  n_conductor -->|"server and service health; writes forwarding tables to KV [http]"| n_consul
  n_consul -.->|"blocking query delivers the new forwarding table [http, at-least-once]"| n_unimog_xdpd
  n_consul -.->|"blocking query delivers the new forwarding table [http, at-least-once]"| n_multimog
  n_edge_proxy -->|"evaluate managed rulesets [in-process]"| n_waf
  n_edge_proxy -->|"cache lookup [in-process]"| n_cdn_cache
  n_edge_proxy -->|"run the customer isolate [in-process]"| n_workers_runtime
  n_edge_proxy -->|"origin fetch on cache miss [https]"| n_customer_origin
  n_spectrum -->|"proxy to the customer application [tcp]"| n_customer_origin
  n_waf -->|"ruleset for this zone [local-read]"| n_quicksilver_proxy
  n_cdn_cache -->|"zone cache settings [local-read]"| n_quicksilver_proxy
  n_authoritative_dns -->|"zone records [local-read]"| n_quicksilver_proxy
  n_workers_runtime -->|"script and route lookup [local-read]"| n_quicksilver_proxy
  n_config_api -.->|"customer or operator configuration change [http, at-least-once]"| n_quicksilver_root
  n_config_api -.->|"BGP policy change, the 2022 outage path [netconf, at-least-once]"| n_spine_fabric
  n_quicksilver_root -.->|"ordered replication with MVCC history [replication, at-least-once]"| n_quicksilver_intermediate
  n_quicksilver_intermediate -.->|"keys always, values in the sliding window [replication, at-least-once]"| n_quicksilver_proxy
  n_quicksilver_proxy -->|"fetch value on miss [rpc]"| n_quicksilver_intermediate
```
