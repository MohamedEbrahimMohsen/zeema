# hotstar-streaming

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_client_app["Client apps (Android, iOS, web, connected TV)<br/><i>user-device</i>"]
  n_play_portal["Play Portal (synthetic playback on real devices)<br/><i>container-worker</i>"]
  subgraph n_g_cdn_edge["CDN edge (external API gateway) (point-of-presence)"]
    n_external_api_gateway["External API gateway (CDN)<br/><i>content-delivery-network</i>"]
    n_cacheable_cdn["Cacheable-path CDN domain<br/><i>content-delivery-network</i>"]
  end
  subgraph n_g_video_edge["Video CDN edges (point-of-presence)"]
    n_akamai_cdn["Akamai (video CDN)<br/><i>akamai</i>"]
    n_cloudfront_cdn["Amazon CloudFront (video CDN)<br/><i>cloudfront</i>"]
  end
  subgraph n_g_aws_region["AWS region (region)"]
    n_video_encoders["Live encoders (12 languages, 5 camera angles)<br/><i>ffmpeg</i>"]
    n_ssai_stitcher["SSAI manifest stitchers<br/><i>container-worker</i>"]
    subgraph n_g_core_vpc["Private VPC (vpc)"]
      n_alb_fleet["Shared ALB fleet<br/><i>alb</i>"]
      n_nat_gateway["NAT gateways (one per subnet)<br/><i>aws-nat-gateway</i>"]
      n_service_db["Managed and self-hosted databases<br/><i>relational-database</i>"]
      n_multi_layer_cache["Multi-layer distributed cache<br/><i>cache-cluster</i>"]
      subgraph n_g_data_center["Data Center (six EKS clusters) (system)"]
        n_internal_gateway["Internal API gateway (Envoy)<br/><i>envoy-gateway</i>"]
        n_eks_cluster["EKS clusters (six in production)<br/><i>aws-eks</i>"]
        n_scaling_controller["Custom scaling controller (pre-warm on request count and concurrency)<br/><i>container-service</i>"]
        n_backend_services["Backend microservices (200+)<br/><i>container-service</i>"]
        n_tier1_service["Login / subscription / watch (P0)<br/><i>container-service</i>"]
        n_ad_decisioning["Ad decisioning service<br/><i>container-service</i>"]
        n_qos_routing_manager["QoS Routing Manager<br/><i>container-service</i>"]
        n_cms["Content Metadata System (CMS)<br/><i>container-service</i>"]
        n_validation_orchestrator["Video Validation Orchestrator<br/><i>container-service</i>"]
        n_video_validator["Video Validator (manifest, SSAI cue and CDN parity checks)<br/><i>container-worker</i>"]
        n_argus["ARGUS (in-house OLAP telemetry)<br/><i>observability-stack</i>"]
        n_grafana["Grafana dashboards / match TV wall<br/><i>grafana</i>"]
      end
    end
  end
  n_client_app -->|"API calls, security and rate rules at the edge [https]"| n_external_api_gateway
  n_client_app -->|"scorecard, concurrency, key moments [https]"| n_cacheable_cdn
  n_external_api_gateway -->|"forward non-cached API calls [https]"| n_alb_fleet
  n_cacheable_cdn -->|"origin fetch for cacheable paths [https]"| n_alb_fleet
  n_alb_fleet -->|"pod-IP targets [http]"| n_internal_gateway
  n_internal_gateway -->|"auth, rate limiting, load shedding [http]"| n_backend_services
  n_internal_gateway -->|"login, subscription, watch [http]"| n_tier1_service
  n_internal_gateway -->|"ad request [http]"| n_ad_decisioning
  n_internal_gateway -->|"playback CDN weights [http]"| n_qos_routing_manager
  n_backend_services -->|"intra-DC endpoint [http]"| n_tier1_service
  n_backend_services -->|"sql"| n_service_db
  n_tier1_service -->|"sql"| n_service_db
  n_backend_services -->|"aggressive caching at multiple layers [cache]"| n_multi_layer_cache
  n_tier1_service -->|"cache"| n_multi_layer_cache
  n_ad_decisioning -->|"frequency caps [cache]"| n_multi_layer_cache
  n_backend_services -->|"egress from private subnets [https]"| n_nat_gateway
  n_scaling_controller -->|"pre-warm in 100-300 node steps [aws-api]"| n_eks_cluster
  n_video_encoders -->|"live variants per language, angle and device [hls]"| n_ssai_stitcher
  n_ssai_stitcher -->|"stitched manifest ingest [http]"| n_akamai_cdn
  n_ssai_stitcher -->|"stitched manifest ingest [http]"| n_cloudfront_cdn
  n_client_app -->|"HLS/DASH playback [https]"| n_akamai_cdn
  n_client_app -->|"HLS/DASH playback [https]"| n_cloudfront_cdn
  n_client_app -.->|"device heartbeats: PFR, rebuffering, RTT [heartbeat, at-most-once]"| n_argus
  n_argus -.->|"telemetry, smoothed by EWMA [http, at-least-once]"| n_qos_routing_manager
  n_qos_routing_manager -.->|"per-cohort traffic weights [http, at-least-once]"| n_akamai_cdn
  n_qos_routing_manager -.->|"per-cohort traffic weights [http, at-least-once]"| n_cloudfront_cdn
  n_validation_orchestrator -->|"poll schedule and publish state [http]"| n_cms
  n_validation_orchestrator -.->|"dispatch before match start [http, at-least-once]"| n_video_validator
  n_validation_orchestrator -.->|"dispatch real-device checks [http, at-least-once]"| n_play_portal
  n_video_validator -->|"manifest and chunk parity per edge [http]"| n_akamai_cdn
  n_video_validator -->|"manifest and chunk parity per edge [http]"| n_cloudfront_cdn
  n_video_validator -.->|"metrics, at-most-once"| n_grafana
  n_play_portal -.->|"metrics, at-most-once"| n_grafana
```
