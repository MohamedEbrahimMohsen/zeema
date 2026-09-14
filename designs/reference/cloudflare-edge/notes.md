# cloudflare-edge: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/cloudflare-edge.md` (five official Cloudflare posts including two postmortems, plus the full 2019-07-02 postmortem; verification appended to the card).
- Size: 20 nodes, 26 edges, 5 groups (broken variant: 18 nodes, 23 edges, 5 groups).

## Clean variant (header of design.yaml)

Reference architecture: the Cloudflare edge network, clean variant. An anycast point of
presence where every server runs every service, an in-kernel XDP L4 load balancer spreads
connections, and a tiered Quicksilver key-value store pushes configuration to every server.

Fixes relative to cloudflare-edge.broken.yaml:
  - quicksilver-root and quicksilver-intermediate keep the full dataset; the leaf proxy is a
    cache of values in front of them, not the only copy (usedAsPrimaryStore false)
  - quicksilver-proxy declares an eviction policy and persists its keys to disk, and is fed by
    quicksilver-intermediate, so a cold proxy can be refilled instead of losing configuration
  - consul is a replicated Raft cluster, so the per-PoP health and forwarding-table channel is
    not the single instance that the 2022 BGP change turned into a lockout
  - edge-proxy does not retry blindly into a struggling customer origin
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: the Cloudflare edge network, broken variant. The same anycast PoP, but
the Quicksilver tier has been collapsed into an unbounded in-memory cache on every server that
the configuration API writes to directly, the per-PoP Consul is a single unreplicated instance,
and the edge proxy retries into a struggling customer origin with nothing to shed the load.

This file MUST trip:
  - cache-missing-eviction-policy              (quicksilver-proxy declares evictionPolicy none)
  - cache-as-primary-store-without-persistence (quicksilver-proxy is the only copy of the config, persistence false)
  - materialised-cache-without-rebuild-path    (quicksilver-proxy holds materialised config with no durable or worker feed)
  - shared-dependency-without-redundancy       (consul replicated false while discovery must be redundant)
  - retry-without-adaptive-shedding            (edge-proxy -> customer-origin retries with no circuit breaker or limiter)
and MUST NOT trip:
  - read-heavy-path-without-cache              (traffic.readWriteRatio is not stated by the source, so it is not set)
  - datastore-missing-backup, datastore-single-region, single-writer-primary-at-peak-qps,
    read-replica-as-sole-scaling, business-updates-without-index-propagation (no sql-database node)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone
                                               (the boundaries here are points of presence, not availability zones)
  - external-call-inline-without-durable-path, fanout-inline-in-request-path
                                               (no app-server calls a third party or a worker synchronously)
  - credentials-without-rotation               (security.credentialRotationDays is set)
  - sync-chain-too-deep                        (no api-gateway node, and no p95 latency target is stated)
  - queue-missing-dlq, pubsub-replay-required, derived-store-without-cdc-or-rebuild,
    multi-leader-store-without-conflict-policy (no queue, topic, search index or multi-leader store)

The broken variant is the shape teams actually build when they hear "push config to the edge in
seconds": one unbounded in-memory map per server written straight from the control plane, with no
durable tier behind it and no staging. It is also the shape both Cloudflare postmortems warn
about — a change that reaches every machine at once, and a per-site control channel that becomes
the thing you cannot reach once the change lands.

## Mapping

| source box | node | component | kind | confidence |
|---|---|---|---|---|
| End users | `end-user` | `web-browser` | client | exact |
| Customer origin servers | `customer-origin` | `supplier-api` | third-party-api | close (a generic external API stands in for the customer's origin) |
| Anycast BGP edge | `anycast-edge-router` | `cisco-router` | network-fabric | assumed (no vendor is named; the only vendor-neutral router shape available) |
| Spine routers (MCP, Clos) | `spine-fabric` | `spine-leaf-fabric` | network-fabric | exact |
| l4drop | `l4drop` | `cloudflare-ddos-protection` | ddos-protection | close (the managed product stands in for the in-kernel XDP program) |
| Unimog xdpd | `unimog-xdpd` | `load-balancer-tier` | load-balancer | close (`layer: l4`, `hashing: maglev`, `connectionPreserving: true`) |
| Multimog | `multimog` | `load-balancer-tier` | load-balancer | close |
| Conductor | `conductor` | `container-service` | app-server | assumed (no control-plane-coordinator kind; `singleWriter` carries "one active, standbys behind it") |
| Consul | `consul` | `consul` | coordination-service | exact |
| Prometheus | `prometheus` | `prometheus` | monitoring | exact |
| Edge proxy (FL, later Pingora) | `edge-proxy` | `nginx` | load-balancer | close (FL was NGINX-based; Pingora's numbers are not encoded) |
| WAF managed rulesets | `waf` | `cloudflare-waf` | waf | exact |
| CDN cache | `cdn-cache` | `cloudflare-cdn` | cdn | exact |
| DNS | `authoritative-dns` | `cloudflare-dns` | dns | exact |
| Workers runtime | `workers-runtime` | `cloudflare-workers` | app-server | exact (component), close (kind: the catalogue has no edge-function kind) |
| Spectrum | `spectrum` | `cloudflare-spectrum` | load-balancer | exact |
| Quicksilver v2 leaf proxy | `quicksilver-proxy` | `cache-cluster` | cache | close (a proxy is a persistent key store plus a value cache; only the cache half is expressible) |
| Quicksilver intermediate replica | `quicksilver-intermediate` | `nosql-store` | nosql-database | close (`consistency: strong` stands in for sequential) |
| Quicksilver root replica | `quicksilver-root` | `nosql-store` | nosql-database | close |
| Dashboard / configuration API (the operator's write path in both postmortems) | `config-api` | `container-service` | app-server | assumed (the sources describe the write path without drawing the box) |

Tally: 8 exact, 9 close, 3 assumed.

Boundaries: `internet` (trust-zone), `customer-network` (trust-zone — the customer's own origin),
`edge-pop` (point-of-presence — one of the 200+ anycast cities; the MCP sites are the ones with a
spine layer), `edge-server` (trust-zone inside the PoP, because every server runs every service),
`control-plane` (system — the core side that originates configuration).

## Catalogue gaps

Recorded in full in `work/designs/cloudflare-edge/gaps.md`. The substantive ones:

- No **edge-function** kind. Workers lands on `app-server` through `cloudflare-workers`, so the
  isolate model (~3 MB, ~5 ms start, thousands per process, JS and Wasm only) has nowhere to go.
- No **control-plane-coordinator** kind for Conductor.
- No **in-kernel / XDP** flavour of `load-balancer`, so Unimog's defining property — that it runs
  in the kernel on every server rather than on dedicated boxes — is only in the label.
- No component for a **tiered configuration store** that is a persistent key store at the leaf and
  a value cache at the same time; Quicksilver's leaf is split conceptually and encoded as a cache.
- No vendor-neutral **router** component under `default`.

## Not encoded

- **Every server runs every service.** The format has no way to say that a set of nodes is the same
  process set on the same machine; the `edge-server` trust-zone is the closest approximation.
- **Anycast itself.** That the same IP is announced from every PoP, and that BGP withdrawal is the
  failover mechanism, is a property of the announcement, not of any node or edge. Only
  `cloudflare-dns.anycast` and the label on the first edge carry it.
- **The 100x bucket count, the two-hop limit and Beamer daisy chaining.** `connectionPreserving`
  says that connections survive a table change, but not how.
- **Under 1% CPU for Unimog, ~3 MB and ~5 ms for an isolate, p99 2.29 s for a config push.**
  There is no cost, footprint or propagation-latency field on a node or an edge.
- **Sequential consistency and MVCC history.** The `consistency` enum has only `eventual`,
  `tunable` and `strong`; the two-hour MVCC window that lets a lagging proxy catch up has no field.
- **Key-value separation.** "Keys are always present, values are cached" is one box behaving as two
  tiers; the design keeps it as one cache node.
- **Staged rollout and automatic rollback.** Both postmortems turn on their absence, and both list
  them as remediation. There is no `deployScope` or `rollbackAutomatic` on an edge, so the
  globally-at-once config push is only a label on `config-api -> quicksilver-root` (and, in the
  broken variant, `config-api -> quicksilver-proxy`).
- **Traffic concentration.** 4% of sites carrying 50% of requests is the 2022 blast radius.
  `traffic.skew: heavy-tail` states that skew exists; a per-site traffic share has no field.
- **The regex CPU guard.** `waf` has `mode` and `managedRuleSet` but nothing that says a rule
  engine has a run-time bound, which is the single property whose absence caused 2019-07-02.
- **Graceful draining of servers**, the reason Unimog exists, has no expression on a load balancer.
- **Ten Quicksilver instances per server**, and the 20% / 1% keyspace-usage figures behind the move
  from full replication to proxies.
