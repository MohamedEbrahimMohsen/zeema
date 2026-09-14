# zoom-video: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/zoom-video.md`
- Size: 18 nodes, 28 edges, 8 groups.

## Clean variant (header of design.yaml)

Reference architecture: Zoom video meetings, clean variant. Multi-bitrate streams from every
participant into a selective-forwarding Multimedia Router inside a geographically chosen
Meeting Zone, zone controllers that allocate routers by load, cascading between zones, an
on-premise Meeting Connector and burst capacity reached over a private interconnect.

Fixes relative to zoom-video.broken.yaml:
  - every Zone Controller is replicated: a secondary ZC stands by for the primary in each
    meeting zone and in the on-premise Meeting Connector, which the design requires because
    the whole join path runs through them
  - the cloud-to-on-premise Meeting Connector handoff retries with jittered backoff behind a
    circuit breaker and degrades instead of hammering a single customer-hosted controller
  - the design states a credential rotation period, so the cloud recording store is not left
    with credentials that never expire
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: Zoom video meetings, broken variant. Same system as zoom-video.yaml
but built the way a team usually builds it first: one Zone Controller per meeting zone with
nothing standing by, a single customer-hosted controller that the cloud retries blindly when
the Meeting Connector handoff stalls, and no rotation period on the credentials that reach
the recording store.

This file MUST trip:
  - shared-dependency-without-redundancy  (every zone controller declares replicated false while the design requires redundant discovery)
  - retry-without-adaptive-shedding       (web-tier calls mc-zone-controller with exponential backoff, no breaker, nothing shedding in front of it)
  - credentials-without-rotation          (the design holds recordings and declares no rotation period and no key-management node)
and MUST NOT trip:
  - sync-chain-too-deep                   (no api-gateway node and no latency.p95Ms target)
  - datastore-single-region, datastore-missing-backup, read-replica-as-sole-scaling,
    single-writer-primary-at-peak-qps     (no sql-database node anywhere)
  - object-store-single-zone-with-durability-target (no durability.annualNines requirement)
  - queue-missing-dlq, retry-queue-without-dlq, retry-without-backoff, pubsub-replay-required,
    shared-worker-pool-across-queues      (no queue, topic or worker node)
  - cache-missing-eviction-policy, cache-as-primary-store-without-persistence,
    materialised-cache-without-rebuild-path, read-heavy-path-without-cache (no cache node)
  - reconnect-stampede-without-guard, stateful-websocket-scale-in-without-drain,
    shared-host-per-channel-without-isolation (no realtime-gateway node; media rides UDP, not a socket tier)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone
    (no availability-zone group in the design)
  - cross-cell-call                       (meeting zones are point-of-presence groups, not cells)
  - fanout-inline-in-request-path, stateful-hash-ring-without-ring-manager,
    external-call-inline-without-durable-path (no worker, no consistent-hash app-server, no third-party-api)
  - derived-store-without-cdc-or-rebuild, business-updates-without-index-propagation (no search index)

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Zoom clients (desktop) | `desktop-client` | `desktop-app` | client | exact |
| Zoom clients (mobile) | `mobile-client` | `mobile-app` | client | exact |
| Zoom clients (room systems, SIP endpoints) | `room-system` | `user-device` | client | close |
| zoom.us CDN in front of the web tier | `web-cdn` | `cloudflare-cdn` | cdn | exact |
| Web tier (zoom.us): scheduling, auth, meeting metadata | `web-tier` | `container-service` | app-server | close |
| "AWS and Oracle servers for non-meeting functionality" | `back-office` | `container-service` | app-server | close |
| Zone Controller, Americas meeting zone | `zc-americas` | `apache-helix` | coordination-service | assumed |
| Zone Controller, EMEA meeting zone | `zc-emea` | `apache-helix` | coordination-service | assumed |
| Zone Controller, geofenced China data center | `zc-china` | `apache-helix` | coordination-service | assumed |
| Multimedia Router, Americas meeting zone | `mmr-americas` | `mediasoup` | media-router | close |
| Multimedia Router, EMEA meeting zone | `mmr-emea` | `mediasoup` | media-router | close |
| Multimedia Router, geofenced China data center | `mmr-china` | `mediasoup` | media-router | close |
| Public cloud burst media capacity (AWS 5,000-6,000 servers) | `mmr-cloud-burst` | `mediasoup` | media-router | close |
| Equinix Cloud Exchange Fabric private interconnect | `cloud-exchange-fabric` | `aws-direct-connect` | network-fabric | assumed |
| Meeting Connector primary Zone Controller (on-premise) | `mc-zone-controller` | `apache-helix` | coordination-service | assumed |
| Meeting Connector MMR (on-premise) | `mc-mmr` | `mediasoup` | media-router | close |
| PSTN / SIP gateways (dial-in and room interop) | `pstn-gateway` | `freeswitch` | contact-center | assumed |
| Cloud recording storage (product not named) | `cloud-recording` | `blob-store` | object-store | close |
| Colocation data centers (Equinix, Digital Realty, CoreSite) | groups `mz-americas`, `mz-emea` | - | point-of-presence | exact |
| Geofenced China data center | group `mz-china` | - | point-of-presence | exact |
| Public cloud capacity (AWS, Oracle, Azure) | group `public-cloud` | - | system | close |
| Customer network hosting the Meeting Connector | group `customer-network` | - | trust-zone | exact |

Tally: 4 exact, 9 close, 5 assumed across the 18 nodes; 3 exact and 1 close across the 4
leaf groups.

## Catalogue gaps

The catalogue has no generic in-house component for `media-router` or `coordination-service`
the way it has `container-service` for app-server, so Zoom's two signature boxes had to borrow
a vendor's name. Full table in `work/designs/zoom-video/gaps.md`.

| product | kind it would need | used instead |
|---|---|---|
| Zoom Multimedia Router (MMR) | a generic SFU under `default` | `mediasoup` |
| Zoom Zone Controller (ZC) | a generic placement controller under `default` | `apache-helix` |
| Equinix Cloud Exchange Fabric | vendor-neutral private cloud interconnect | `aws-direct-connect` |
| Zoom PSTN / SIP gateway | telephony-gateway | `freeswitch` |
| Zoom cloud recording store (unnamed) | object-store | `blob-store` |

## Not encoded

- The transport fallback ladder. Edges carry one `protocol`, so `udp` is written and the
  TCP 443 then TLS fallback lives in the edge label. There is no `fallbackTransports` field.
- Multi-bitrate. Each participant sends several qualities and the MMR selects per receiver;
  the format has no property for that, so it is in the media edge labels only.
- Selective forwarding versus mixing is captured as `mode: "sfu"` on the routers, but the
  "up to 15x more people than an MCU" efficiency claim has nowhere to live.
- Application-level QoS instead of network QoS: no property expresses it.
- The reverse control response (web tier returning the assigned MMR address to the client)
  is a reply to the join call, not a separate call, so it is not drawn as an edge.
- Scale numbers. 10M to 300M daily meeting participants, 17 data centers, 5,000-6,000 AWS
  servers and Oracle's seven petabytes a day are all per-fleet figures, not per-node request
  rates, so no node carries `nfr.rps` and no requirement encodes them.
- HTTP tunnels on each meeting zone as a last-resort fallback: a transport detail below the
  granularity of a node.
- The peer-to-peer path for two-participant meetings is drawn as a client-to-client edge, but
  nothing in the format says it only applies below three participants.
- `security.credentialRotationDays: 90` in `design.yaml` is **assumed**, not sourced. No
  source states a rotation period. It is set because the design holds cloud recordings and
  Zoom is SOC 2 and FedRAMP audited, so a rotation policy certainly exists; the number is the
  conventional one used by the other reference designs. The broken twin drops it.
- Zone failover mechanics, client reconnection timing and the recording pipeline are listed as
  unknowns on the intake card and are not invented here: `rerouteOnFailure: true` on the
  routers is the only thing said about failover, and it follows from the source's statement
  that meetings continue across router failure.
