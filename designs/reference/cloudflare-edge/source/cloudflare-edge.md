# Intake: Cloudflare edge network (anycast PoPs, Unimog, Quicksilver, Workers, WAF)

## Source
- Primary: https://blog.cloudflare.com/unimog-cloudflares-edge-load-balancer/ (official, 2020: anycast, every server runs every service, XDP L4 load balancer, Conductor)
- Primary: https://blog.cloudflare.com/quicksilver-v2-evolution-of-a-globally-distributed-key-value-store-part-1/ (official, 2025: global config KV store, v1 full replication to v2 tiered)
- Primary: https://blog.cloudflare.com/cloud-computing-without-containers/ (official, 2018: Workers on V8 isolates)
- Primary: https://blog.cloudflare.com/cloudflare-outage/ (official postmortem, 2019-07-02: WAF regex CPU exhaustion)
- Primary: https://blog.cloudflare.com/cloudflare-outage-on-june-21-2022/ (official postmortem, 2022-06-21: BGP policy reorder in MCP data centers)
- Secondary: press on Pingora replacing NGINX (official post exists at blog.cloudflare.com; not fetched)
- Verified by: five official Cloudflare posts including two postmortems
- Confidence: high
- Date of source: 2018-2025

## System in three lines
A global anycast edge where every server in every point of presence runs the full stack (DNS, CDN cache, WAF, DDoS mitigation, Workers, proxies) and BGP steers users to the nearest PoP. Inside a PoP, an in-kernel L4 load balancer spreads connections across heterogeneous servers, and a globally replicated key-value store pushes configuration to every server in seconds. Hard because a single bad rule or BGP policy deploys everywhere at once, so blast radius is the whole internet's front door.

## Scale (only if stated)
- Users / DAU: not stated
- Requests per second: Quicksilver "over 3 billion keys per second globally"; 60M+ HTTP RPS (secondary)
- Data volume: hundreds of thousands of Quicksilver databases; terabytes at root nodes; hundreds of thousands of IPv4 addresses managed by Unimog
- PoPs: 200+ cities (2020); 19 largest converted to Multi-Colo PoP (MCP) carried 50% of HTTP traffic in 2022
- Servers: hundreds per PoP, largest 100x smallest, 10 hardware generations in one PoP
- Overhead: Unimog under 1% CPU; Workers isolate ~3 MB and ~5 ms start vs 35 MB and 500 ms+ for a Lambda-class container
- Config propagation: Quicksilver change globally in ~5 s
- Outages: 2019 regex, 27 min, 82% traffic drop; 2022 BGP, 75 min, 50% of global HTTP requests

## Requirements stated or clearly implied
- Availability target: withstand loss of any PoP via anycast; graceful draining of servers; zero-downtime maintenance (MCP goal)
- Consistency: Quicksilver sequential consistency ("if key A was written before B, it's not possible to read B and not A"); eventual across the globe within seconds
- Latency target: nearest PoP; L4 forwarding without payload processing; isolate start ~5 ms
- Ordering needs: replication index ordering in Quicksilver
- Replay or reprocessing: MVCC history in replicas serves lagging proxies
- Retention: not stated
- Compliance / residency: not stated in these posts
- Change safety: staged rollout and automatic rollback required (both postmortems)

## Boundaries
- Regions / zones: PoPs (200+), each an anycast site; MCP sites with spine routers (Clos); root, intermediate and leaf tiers for Quicksilver
- Trust zones: internet -> BGP edge routers -> servers (XDP: l4drop then Unimog) -> services; customer code isolated in V8 isolates within one process
- Named subsystems: Network (BGP, anycast, spine routers), Unimog (xdpd + Conductor), Services (DNS, cache, WAF, DDoS, Spectrum, WARP, Workers), Quicksilver (config KV), Consul + Prometheus (health, metrics)
- Group kind needed: point-of-presence (site) with `tier` property; distinct from cloud region

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | End users / origin servers | Clients and customer origins | any | web-client, third-party origin | |
| 2 | Anycast BGP edge | Same IPs announced from every PoP; BGP reroutes on PoP loss | BGP | dns / network (anycast) | anycast: true |
| 3 | Spine routers (MCP) | Clos mesh inside large PoPs for maintenance without downtime | Juniper-class routers | network-fabric (new) | |
| 4 | l4drop | XDP program dropping attack packets before load balancing | in-house eBPF | waf (layer 4 DDoS mitigation) | layer: 4 |
| 5 | Unimog xdpd | In-kernel XDP L4 load balancer on every server; Maglev-style forwarding table with 100x buckets; two-hop daisy chaining for connection preservation | Unimog (in-house) | load-balancer | layer: 4; inKernel: true; connectionPreserving: true |
| 6 | Conductor | Per-PoP control plane: reads inventory, Consul health, Prometheus CPU; rebalances buckets; active with standbys | in-house | control-plane-coordinator | |
| 7 | Consul | Health signals and KV for forwarding-table distribution | HashiCorp Consul | service-registry + coordination-service | |
| 8 | Prometheus | CPU and load metrics feeding Conductor | Prometheus | monitoring | |
| 9 | Edge proxy | L7 reverse proxy for customer traffic (NGINX-based FL, later Pingora in Rust: 70% less CPU, 67% less memory) | NGINX, Pingora | load-balancer (layer 7) / api-gateway | layer: 7 |
| 10 | CDN cache | Caching on every server | in-house | cdn | |
| 11 | WAF managed rulesets | Regex rules in Lua/PCRE, deployed globally via config store | in-house | waf | layer: 7 |
| 12 | DNS | Authoritative and resolver on every server | in-house | dns | anycast: true |
| 13 | Workers runtime | V8 isolates, thousands per process, ~3 MB, ~5 ms start; JS/Wasm only | Cloudflare Workers | edge-function (new) | isolation: v8-isolate |
| 14 | Quicksilver v1 | Full LMDB replica on every server, async replication ~5 s | Quicksilver (in-house, LMDB) | nosql-database (config distribution) | replication: full-async; consistency: sequential |
| 15 | Quicksilver v2 / v1.5 | Replicas (full) at root/intermediate, proxies (persistent cache, keys always, values cached) at leaves; MVCC; sliding window of recent writes | Quicksilver v2 | nosql-database + cache tier | tiered: true; keyValueSeparated: true |
| 16 | Spectrum / WARP | TCP/UDP proxy and consumer VPN | in-house | app-server (edge services) | |
| 17 | Multimog | Internal load balancer that also broke in 2022 outage | in-house | load-balancer | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| user | anycast-edge | ip/bgp | sync | | nearest PoP |
| anycast-edge | spine-routers | ecmp | sync | | MCP sites |
| router | server xdp (l4drop) | packets | sync | | drop attacks first |
| l4drop | unimog xdpd | xdp pass | sync | | |
| unimog xdpd | target server | xdp tx | sync | | forwarding table by 4-tuple; second hop under 1% |
| conductor | consul kv | http blocking query | async | | forwarding tables to all xdpd |
| conductor | prometheus | http | sync | | CPU per server |
| conductor | consul health | http | sync | | node/service health |
| server | edge-proxy (l7) | tcp | sync | | |
| edge-proxy | waf | in-process | sync | | rules from quicksilver |
| edge-proxy | cdn-cache | in-process | sync | | |
| edge-proxy | workers-runtime | in-process | sync | | isolates |
| edge-proxy | customer-origin | https | sync | | cache miss |
| control plane (core) | quicksilver-root | replication | async | ordered | ~5 s globally |
| quicksilver-root | quicksilver-intermediate | replication | async | ordered | MVCC |
| quicksilver-intermediate | quicksilver-proxy (leaf) | fetch on miss + sliding window | sync/async | | keys always present, values cached |
| services (dns, cdn, waf) | quicksilver (local) | local read | sync | | 10 instances per server |
| operator | bgp policy on spine | config push | async | | 2022 outage path |
| operator | waf rules via quicksilver | config push | async | | 2019 outage path, global at once |

## Failure modes, incidents, tradeoffs the source discusses
- Global deploy of a bad WAF rule: "one of these rules contained a regular expression that caused CPU to spike to 100% on our machines worldwide"; "these WAF rules were deployed globally in one go"; CPU-usage guard had been removed in a refactor. Source: 2019 postmortem.
- BGP policy term reorder: "The 4-ADV-SITE-LOCALS and 6-ADV-SITE-LOCALS terms moved from the top to the bottom" behind a reject; 4% of sites carried 50% of traffic; engineers lost direct access and "walked over each other's changes". Source: 2022 postmortem.
- ECMP rehash storms: "rehashing events break connections to all servers in an ECMP group"; Unimog uses consistent forwarding tables and daisy chaining. Source: unimog.
- Feedback-loop oscillation: servers flapping between healthy and degraded during PoP-wide overload; Conductor now distinguishes isolated degradation from site-wide. Source: unimog.
- Two-hop limit vs Beamer multi-hop; mitigated by careful table update strategy allowing day-long connections. Source: unimog.
- Full replication waste: "storing the full dataset on every server is inefficient"; only 20% of keyspace used in large PoPs, 1% in small. Source: quicksilver.
- Negative lookups 10x positive: proxies keep all keys, cache values only. Source: quicksilver.
- Isolate model cannot run arbitrary compiled code; relies on V8 security testing. Source: workers.
- Traffic concentration: converting the busiest sites first created a correlated blast radius. Source: 2022 postmortem.

## Unknowns
- Pingora deployment details (official post not fetched)
- Cross-PoP state for Workers KV, Durable Objects, R2
- Quicksilver write path and conflict handling
- Exact PoP count today

## Candidates
- New kinds: waf (also in MVP list; layer 4 and 7 variants), edge-function (Workers, Lambda@Edge, Fastly Compute), network-fabric (spine/leaf, BGP routers); sightings: dns (2nd), load-balancer (8th; layer property needed), cdn (5th), control-plane-coordinator (5th), coordination-service (6th), service-registry (4th), monitoring (8th), nosql-database (12th, config-distribution flavour)
- New group kind: point-of-presence with tier (root, intermediate, leaf) and trafficShare
- New properties on existing kinds: load-balancer.layer (4, 7), inKernel, connectionPreserving, hashing (ecmp, maglev, consistent); waf.layer, rulesEngine, cpuGuard (boolean); nosql-database.replication (full-async, tiered), consistency (sequential); edge-function.isolation (isolate, container, vm)
- New edge properties: deployScope (global-at-once, staged); rollbackAutomatic (boolean)
- New requirement paths: change.stagedRollout (boolean); change.automaticRollback (boolean); availability.maxTrafficSharePerSite (percent)
- New rules:
  - global-config-push-without-staging: config edge with deployScope global-at-once while change.stagedRollout true
  - rules-engine-without-cpu-guard: waf with rulesEngine regex and cpuGuard false
  - site-traffic-concentration: point-of-presence group with trafficShare above availability.maxTrafficSharePerSite
  - ecmp-without-connection-preservation: load-balancer hashing ecmp with long-lived connections (edge connection persistent)
  - out-of-band-access-missing: network-fabric change path with no independent management edge (lockout in 2022)

## Verification 2026-09-13

Every primary source in the intake card was fetched on 2026-09-13. All six URLs were reachable.

| URL | Reachable | Outcome |
|---|---|---|
| https://blog.cloudflare.com/unimog-cloudflares-edge-load-balancer/ | yes | confirms anycast in 200+ cities, every server serving every service, XDP forwarding, l4drop before Unimog, Conductor (active plus standbys) reading inventory APIs, Consul health and Prometheus load, forwarding tables propagated through a KV store with blocking queries, buckets "more than 100 times the number of servers", Beamer-style daisy chaining, under 1% CPU, hundreds of thousands of IPv4 addresses, ECMP rehashing breaking connections, graceful draining, the service list "caching, DNS, WAF, DDoS mitigation, Spectrum, WARP, etc" |
| https://blog.cloudflare.com/quicksilver-v2-evolution-of-a-globally-distributed-key-value-store-part-1/ | yes | confirms "over 3 billion keys per second globally", terabytes at root nodes, 10 Quicksilver instances per server, ~20% of the keyspace used in large data centres and ~1% in small ones, v1 full replication, v1.5/v2 replica and proxy roles, sequential consistency, MVCC with a roughly two-hour history, the sliding window, key-value separation (keys always stored, values cached), ~10x more negative than positive lookups |
| https://blog.cloudflare.com/cloud-computing-without-containers/ | yes | confirms V8 isolates, "hundreds or thousands of Isolates" per process, ~3 MB per isolate against 35 MB for a Node Lambda, 5 ms isolate start against 500 ms+ for a container, JavaScript and WebAssembly only, reliance on V8 security testing |
| https://blog.cloudflare.com/cloudflare-outage/ | yes | short placeholder post: confirms 2019-07-02, a single misconfigured WAF rule, "a regular expression that caused CPU to spike to 100% on our machines worldwide", 82% traffic drop, 13:42-14:09 UTC (27 minutes), "these WAF rules were deployed globally in one go". Does **not** state PCRE/Lua, the removed CPU guard, or Quicksilver distribution — those come from the full postmortem below |
| https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/ | yes (extra, not on the card) | confirms PCRE evaluated from Lua, distribution through Quicksilver at "p99 of 2.29s for a change to be distributed to every machine worldwide", catastrophic backtracking, "a protection that would have helped prevent excessive CPU use by a regular expression was removed by mistake during a refactoring", no staged rollout for rules, remediation commitments to staged rollout and run-time-guaranteed regex |
| https://blog.cloudflare.com/cloudflare-outage-on-june-21-2022/ | yes | confirms the 4-ADV-SITE-LOCALS / 6-ADV-SITE-LOCALS terms moving from the top to the bottom behind a reject term, 19 MCP data centres with a Clos spine layer, 4% of the network carrying 50% of requests, 06:27-07:42 UTC (75 minutes), engineers who "walked over each other's changes", Multimog no longer able to forward requests between servers |
| Pingora post (press / official post not fetched) | not attempted | the card already marks it secondary and unfetched |

## Facts the card states that could not be confirmed, and what was done

- **"~5 s" Quicksilver global propagation.** Neither Quicksilver post gives that number; the v1 post says only "within seconds". The 2019 postmortem gives p99 2.29 s to every machine worldwide. No `freshness.maxSeconds` requirement was encoded, and no propagation number appears in the design.
- **"hundreds of thousands of Quicksilver databases".** Not stated in the v2 part 1 post. Dropped; not encoded.
- **LMDB.** Confirmed for Quicksilver v1 only; the v2 post names RocksDB. The design names neither engine (the generic `nosql-store` and `cache-cluster` components are used), so nothing is asserted.
- **"hundreds of servers per PoP".** Not stated. The post does state the biggest data centres have a hundred times more servers than the smallest, and "10th generation" hardware. No server count is encoded.
- **60M+ HTTP requests per second.** Secondary, unfetched. Not encoded; the only `nfr.rps` in the design is Quicksilver's stated 3 billion keys per second.
- **WARP as a node.** The Unimog post names WARP only in a list of services. It is not encoded as a node, to avoid asserting client properties no fetched source states. Spectrum, which the same list names and which has a documented proxy role, is encoded.

## Assumed values (recorded because a rule reads them)

- `security.credentialRotationDays: 90` — no source states a rotation period. Set so the design states a period rather than leaving `credentials-without-rotation` firing on a design whose real operator plainly rotates credentials.
- `quicksilver-proxy.evictionPolicy: "lru"` — the sources say values are cached behind a sliding window but never name the policy. `lru` reflects a value cache in front of a replica tier.
- `authoritative-dns.redundantProviders: true` — the property means "not a single provider or instance". Cloudflare's authoritative DNS runs on every server in 200+ anycast cities, which is the practice the rule is asking for.
- `consul.replicated: true` (clean variant) — Consul is a Raft cluster by construction; the Unimog post does not restate it.
- `quicksilver-*.consistency: "strong"` — the source says *sequential* consistency, which the kind's enum (`eventual`, `tunable`, `strong`) cannot express. `strong` is the closest value; recorded as a close mapping.
