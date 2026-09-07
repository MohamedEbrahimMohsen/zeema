# Intake: Zoom video conferencing (meeting zones, multimedia routers, hybrid colo and cloud)

## Source
- Primary: Zoom Global Infrastructure whitepaper (official, Sept 2019) https://zoomgov.com/docs/doc/Zoom_Global_Infrastructure.pdf (403 in this pass) and Zoom Client Connection Process whitepaper (official, April 2020) https://explore.zoom.us/docs/doc/Zoom%20Client%20Connection%20Process%20Whitepaper_FR.pdf (binary PDF not readable in this pass); content taken from write-ups citing them
- Primary: https://www.datacenterfrontier.com/cloud/article/11428986/inside-zoom8217s-infrastructure-scaling-up-massively-with-colo-and-cloud (interview with Zoom CTO and CPO, May 2020: 17 DCs, Equinix, AWS, Oracle, Azure, 10M to 300M daily participants)
- Secondary: https://www.cometchat.com/blog/zoom-video-technology-architecture (cites Zoom docs: zones, ZC, MMR, protocols, multi-bitrate)
- Secondary: https://colla.blog/2021/10/zoom-meeting-connector-introduction/ (on-premise Meeting Connector: MMR + ZC, cloud-to-on-prem handoff)
- Verified by: official whitepapers (via citing write-ups) + executive interview
- Confidence: medium (whitepapers not directly readable in this pass; component roles and protocols consistent across three sources)
- Date of source: 2019-2021

## System in three lines
Video meetings where each participant sends one multi-bitrate stream to a Multimedia Router (MMR) that selectively forwards streams to the others (SFU model, no server-side mixing), inside a Meeting Zone governed by a Zone Controller that assigns routers and watches load. Meeting metadata, scheduling and auth live in a web tier on public cloud; media runs in Zoom's own colocation data centers and bursts to cloud. Hard because media is latency-bound UDP with TCP fallbacks, zones must cascade for global meetings, and demand grew 30x in five months.

## Scale (only if stated)
- Users / DAU: daily meeting participants 10M (Dec 2019) to 300M (May 2020)
- Requests per second: not stated
- Data volume: Oracle capacity "equivalent to processing seven petabytes daily"
- Message throughput: not stated
- Fleet: 17 data centers (2020; 19 per secondary), Equinix at nine sites plus Digital Realty and CoreSite, one geofenced DC in China; AWS scaled to 5,000-6,000 servers at peak; also Azure
- Efficiency claim: MMR model serves "up to 15x more people" than MCU mixing

## Requirements stated or clearly implied
- Availability target: meetings continue across DC or router failure; zones redundant; clients reconnect
- Consistency: meeting state in web tier; media is best-effort real time
- Latency target: lowest possible; UDP first, TCP then SSL fallback; nearest zone by geography
- Ordering needs: none (real-time media)
- Replay or reprocessing: none for live media; cloud recording persisted separately
- Retention: recordings per account policy; not stated
- Compliance / residency: geofenced China data center; data routing controls by region (later feature)
- Elasticity: burst to public cloud for meeting capacity

## Boundaries
- Regions / zones: meeting zones per DC; colocation DCs (Americas, EMEA, APAC) plus AWS, Oracle, Azure regions; private interconnect via Equinix Cloud Exchange Fabric
- Trust zones: clients (untrusted) -> web tier (HTTPS) -> zone controller -> MMR (UDP 8801 / TCP 443); on-premise Meeting Connector inside customer network with cloud metadata handoff
- Named subsystems: Web/control plane (zoom.us), Meeting zones (ZC + MMRs), Cascading between zones, Meeting Connector (on-prem), Cloud recording, Telephony/PSTN gateways
- Group kinds: point-of-presence (2nd sighting) and provider (colo vs AWS vs Oracle vs Azure)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Zoom clients | Desktop, mobile, web, room systems; send one multi-bitrate stream, receive selected streams; P2P for 2 participants | Zoom client | desktop-client, mobile-client, web-client | multiBitrate: true; p2pWhenTwo: true |
| 2 | Web tier (zoom.us) | Scheduling, auth, meeting metadata, participant management; entry point over HTTPS | in-house on AWS/Oracle | api-gateway + app-server | cloud: aws, oracle |
| 3 | Zone Controller (ZC) | Per meeting zone: manages new connections, allocates MMRs, monitors server load | in-house | control-plane-coordinator | |
| 4 | Multimedia Router (MMR) | Selective forwarding of audio/video to participants; application-layer QoS; no mixing | in-house | media-router (new) | mode: sfu; transport: udp-first |
| 5 | Cascading MMRs | Routers in different zones linked so global meetings stay local per participant | in-house | media-router (peer edges) | |
| 6 | Meeting Connector (on-prem) | Customer-hosted MMR + ZC; cloud designates primary ZC which assigns MMR | Zoom Meeting Connector | media-router + control-plane-coordinator (on-prem) | |
| 7 | Colocation data centers | Media hosting, 17 sites | Equinix, Digital Realty, CoreSite | point-of-presence group | |
| 8 | Public cloud capacity | Burst media and back-office | AWS, Oracle Cloud, Azure | provider group + app-server | |
| 9 | Private interconnect | Software-defined private links between colo and clouds | Equinix Cloud Exchange Fabric | network-fabric | |
| 10 | Geo routing | Client directed to nearest zone | DNS/geo (implied) | dns | |
| 11 | Cloud recording | Recordings stored in cloud storage | not named | object-store | |
| 12 | PSTN / SIP gateways | Dial-in and room system interop | not named | third-party-api (telephony gateway) | |
| 13 | Geofenced China DC | Regulatory isolation | own DC | point-of-presence (residency) | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| client | web-tier | https | sync | | auth, join, metadata |
| web-tier | zone-controller | internal | sync | | choose zone by geography |
| zone-controller | mmr | internal | sync | | allocate router by load |
| web-tier | client | https | sync | | mmr address |
| client | mmr | udp 8801 (fallback tcp 443, ssl) | async | best-effort | media |
| mmr | client | udp | async | best-effort | selected streams per bitrate |
| mmr (zone A) | mmr (zone B) | internal | async | best-effort | cascade for global meetings |
| client | client | p2p udp | async | best-effort | two-party meetings |
| web-tier (cloud) | on-prem primary zc | https | sync | | meeting connector handoff |
| mmr | cloud-recording | internal | async | | |
| pstn-gateway | mmr | sip/rtp | async | | dial-in |
| colo | cloud | private interconnect | async/sync | | burst capacity |

## Failure modes, incidents, tradeoffs the source discusses
- SFU vs MCU: forwarding instead of mixing gives "up to 15x more people" per server; cost moves to client-side decoding. Source: cometchat citing Zoom.
- Transport fallback: UDP for latency, TCP then SSL when blocked; latency degrades on fallback. Source: cometchat citing Zoom.
- Hybrid capacity: own DCs for media, "AWS and Oracle servers for non-meeting functionality", burst to cloud at peak; 30x growth absorbed by adding thousands of cloud servers. Source: datacenterfrontier.
- Private interconnect to avoid public internet between colo and clouds. Source: datacenterfrontier (CPO quote).
- Regulatory isolation via geofenced China DC (and the 2020 routing controversy that led to data-routing controls, not covered by these sources). Source: datacenterfrontier.
- On-prem Meeting Connector still depends on cloud for metadata and ZC designation; cloud outage affects join even when media is local. Source: colla.blog.
- Application-layer QoS rather than relying on network QoS. Source: cometchat citing Zoom.

## Unknowns
- Web tier internals (datastores, queues)
- Zone failover mechanics and client reconnection timing
- Recording pipeline and storage product
- Current DC count and cloud split after 2021

## Candidates
- New kinds: media-router (SFU/MCU: Zoom MMR, Janus, mediasoup, Twilio), telephony-gateway (PSTN/SIP; may fold into third-party-api); sightings: control-plane-coordinator (6th), network-fabric (3rd), dns (3rd), object-store (11th), point-of-presence group (2nd)
- New group kind: provider (colo, aws, oracle, azure) to express hybrid capacity and burst
- New properties on existing kinds: media-router.mode (sfu, mcu, p2p), transport (udp, tcp, tls), cascading (boolean), multiBitrate (boolean); app-server.burstToCloud (boolean)
- New edge properties: realtime (boolean, best-effort media); fallbackTransports (list)
- New requirement paths: latency.realtimeMediaMs; availability.burstCapacity (boolean); compliance.dataRoutingControls (boolean)
- New rules:
  - realtime-media-over-tcp-only: media-router edge with transport tcp and no udp while latency.realtimeMediaMs set
  - global-meeting-without-cascade: media-router nodes in multiple point-of-presence groups with no peer cascade edges while participants global
  - onprem-media-with-cloud-control-dependency: on-prem media-router whose join path depends on a cloud control plane with no local fallback (informational)
  - mixing-server-at-scale: media-router mode mcu with large participant counts (cost/scale warning)
  - single-provider-without-burst: all media capacity in one provider group while availability.burstCapacity true
