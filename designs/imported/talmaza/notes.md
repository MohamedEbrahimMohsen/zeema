# Talmaza: import notes

Talmaza (talmaza.com, api.talmaza.com) runs behind Cloudflare: TLS, CDN, WAF, DDoS, bots, rate
limits, Access. Traffic enters by a Cloudflare Tunnel dialled from a private AKS cluster (Azure
VNet, no public IP) with Azure SQL, Redis, Cosmos DB, storage, AI, Key Vault, Entra ID.

- Source: `source/Talmaza - 02.drawio.html`, the user's own draw.io diagram exported as HTML.
  The diagram XML sits HTML-entity-encoded in the `data-mxgraph` attribute; it was decoded
  unchanged into `source/Talmaza - 02.drawio`, which is what the inventory was read from
  (90 `mxCell`s: 72 vertices, one of them an edge label, 16 edges, and the two root cells).
- Format: `drawio`. Imported 2026-09-24.
- Counts: 37 boxes, 8 boundaries, 16 arrows drawn (one double-headed, so 17 edges). The design
  has 37 nodes, 8 groups, 17 edges. `validate.mjs --design`, `check_fidelity.py`,
  `design_to_mermaid.py` and `design_to_svg.py` all pass.
- Labels are the drawn text with HTML stripped, line breaks joined by one space and runs of
  spaces collapsed ("Key Vault<br>tunnel token" -> "Key Vault tunnel token"). The source spelling
  "Azure AI Foundary" is kept.

## What the diagram is

Two users (Applicant, Visitor) reach a Cloudflare Edge frame over HTTPS. The edge frame holds
seven boxes side by side with no arrows between them: SSL / TLS termination, CDN, WAF, DDoS
protection, Bot detection, Rate limiting and Access. A Cloudflare Tunnel, dialled outbound from
the cluster, carries requests into a Microsoft Azure frame holding one VNet. In the VNet: an NSG,
a Key Vault for the tunnel token, and an AKS cluster with three namespaces (cloudflared,
frontend, api). Below the cluster, six dashed frames group Azure PaaS services: Secretless Layer
(Entra ID, Managed Identity), AI, Monitoring & Alerts Tools, Storage, DB & Cache, Secret Store.
The arrows below the cluster go from frame to frame, not from box to box. An empty
"External Systems" frame sits at the bottom.

## Mapping

| Source text | Node | Component | Confidence |
|---|---|---|---|
| Applicant | applicant | user-device | close |
| Visitor | visitor | user-device | close |
| SSL / TLS termination (Full strict) | ssl-tls-termination | cloudflare-ssl-tls | exact |
| CDN static cache | cdn | cloudflare-cdn | exact |
| WAF OWASP rules | waf | cloudflare-waf | exact |
| DDoS protection | ddos-protection | cloudflare-ddos-protection | exact |
| Bot detection | bot-detection | cloudflare-bot-management | exact |
| Rate limiting | rate-limiting | cloudflare-rate-limiting | exact |
| Access Zero Trust SSO (admin apps) | access | cloudflare-access | exact |
| NSG: deny ALL inbound no public IP · no public LB | nsg | azure-network-security-group | exact |
| Key Vault tunnel token | key-vault-tunnel-token | azure-key-vault | exact |
| Deployment | deployment | k8s-deployment | exact |
| cloudflared (x2) | cloudflared, cloudflared-2 | cloudflare-tunnel | close |
| Service ClusterIP (x2) | service-clusterip, service-clusterip-2 | k8s-service | exact |
| web pod (x2) | web-pod, web-pod-2 | k8s-pod | exact |
| api pod (x2) | api-pod, api-pod-2 | k8s-pod | exact |
| Entra ID | entra-id | azure-entra-id | exact |
| Managed Identity | managed-identity | azure-managed-identity | exact |
| Azure Monitor | azure-monitor | azure-monitor | exact |
| Log Analytics | log-analytics | azure-log-analytics | exact |
| Azure Alerts | azure-alerts | azure-monitor | close |
| Communication Service | communication-service | azure-communication-services | exact |
| Blob Storage | blob-storage | azure-blob-storage | exact |
| File Storage | file-storage | azure-files | exact |
| Table Storage | table-storage | azure-table-storage | exact |
| Queue Storage | queue-storage | azure-queue-storage | exact |
| Azure SQL | azure-sql | azure-sql | exact |
| Redis | redis | azure-cache-for-redis | close |
| CosmosDB | cosmosdb | azure-cosmos-db | exact |
| Key Vault App Secrets | key-vault-app-secrets | azure-key-vault | exact |
| Azure AI Foundary | azure-ai-foundary | azure-ai-foundry | exact |
| AI Search | ai-search | azure-ai-search | exact |
| Azure OpenAI | azure-openai | azure-openai | exact |

| Boundary | Group | Kind | Parent |
|---|---|---|---|
| Cloudflare Edge | cloudflare-edge | point-of-presence | none |
| Microsoft Azure | microsoft-azure | region | none |
| VNet | vnet | vpc | microsoft-azure |
| AKS cluster (private API server) | aks-cluster | system | vnet |
| ns: cloudflared — Deployment, 2+ replicas | ns-cloudflared | namespace | aks-cluster |
| ns: frontend | ns-frontend | namespace | aks-cluster |
| ns: api | ns-api | namespace | aks-cluster |
| External Systems | external-systems | trust-zone | none |

No `assumed` mapping. Nothing was added to the catalogue.

## Decisions and assumptions

- **Azure Alerts has no component, by design.** The Azure inventory lists "Alerts" as
  `skip: alerting feature of Azure Monitor, not a resource`. Following the skill's rule for a
  skip reason, the box keeps its own node and label and maps to the product it is a feature of,
  `azure-monitor` (`close`). Two nodes share that component; nothing is merged. No
  `azure-monitor-alerts` component was added, because the inventory decision says it is not a
  resource.
- **cloudflared is `cloudflare-tunnel`, not `k8s-pod`.** The two boxes use the Kubernetes Pod
  icon but name the product: cloudflared is the Cloudflare Tunnel connector. The skill says a
  box that names a product takes that product's component. They sit in `ns-cloudflared`, so the
  fact that they run as pods is still visible.
- **The Cloudflare Tunnel is an arrow, not a box.** It is the dashed double-headed orange arrow
  captioned "Cloudflare Tunnel · TLS 1.3 / QUIC". It is two edges labelled "Cloudflare Tunnel"
  with protocol `quic`. No tunnel node was added.
- **DNS and TLS termination.** "SSL / TLS termination (Full strict)" is a drawn box, so it is a
  node (`cloudflare-ssl-tls`, `encryptionMode: full-strict`). DNS appears only as text in the edge
  title ("DNS resolves app. / api. to Cloudflare anycast IPs — never to Azure"); no DNS box is
  drawn, so there is no DNS node. The sentence is a layout note.
- **The NSG is a node.** It is the Azure Network Security Group product icon with a caption,
  drawn like every other Azure icon, so it is a box, not a free note. `defaultAction: deny` comes
  from "deny ALL inbound". "no public IP · no public LB" has no NSG property; it stays in the
  label and here.
- **Replicas are separate nodes.** The diagram draws two cloudflared pods, two web pods, two api
  pods and one Service ClusterIP per namespace. The skill forbids merging two boxes into one
  node, so each drawn box is its own node (as in chat-system's three KV store boxes). The
  Deployment carries `instances: 2` from its namespace caption "Deployment, 2+ replicas" (the
  stated minimum). No `instances` is set on pods: the diagram gives no count for web or api.
- **AKS is a group, not a node.** The AKS frame only contains other boxes, so per the skill it
  is a boundary: `system`, parent `vnet`. `azure-aks` is not used. "private API server" stays in
  the label (gap).
- **Namespaces** use the new `namespace` group kind, nested under `aks-cluster` as drawn.
- **Microsoft Azure -> region.** The source names a cloud, not a region. `region` is the closest
  kind (gap).
- **External Systems** is a titled frame at the bottom enclosing no box. It is kept as an empty
  `trust-zone` group (the closest kind for an external zone) so the boundary is not lost. The
  layout derives frames from members, so it is not drawn.
- **Six visual clusters are not groups.** Secretless Layer, Monitoring & Alerts Tools, Storage,
  DB & Cache, AI and Secret Store are dashed frames that group icons by theme. None is a network,
  failure or ownership boundary, and no group kind means "drawn together". They are listed under
  `ignored` with "visual grouping, no topology meaning"; their members are nodes directly in the
  VNet, where they are drawn. Each cluster name survives as a note in `design.layout.json`,
  anchored to the right-most node of the row it heads.
- **Arrows that end on a frame.** Every drawn arrow ends on a frame at one end or both. Each
  such end is attached to the box nearest the point where the arrow meets the frame, computed
  from the draw.io geometry (the numbers are in `mapping.yaml`). The one exception is the tunnel's
  cluster end, which floats above the Deployment icon; the caption says "dialed OUTBOUND by
  cloudflared", so it is attached to the first cloudflared pod. The result reads oddly in places
  (Service ClusterIP -> Entra ID, Managed Identity -> File Storage, Azure OpenAI -> Azure SQL)
  because the drawing means "this tier reaches that tier". That is recorded as a gap, not
  corrected.
- **Protocols.** HTTPS comes from the arrow label. `quic` comes from the tunnel caption. The
  cloudflared -> pod arrows are labelled with hostnames (talmaza.com, api.talmaza.com), so the
  protocol for that in-cluster hop is assumed `http`. The rest take the callee's native protocol:
  `sql` for Azure SQL, `redis` for Redis, `smb` (the azure-files default) for File Storage,
  `https` for every other Azure API. Every edge is `sync`; none touches a queue.
- **Edge direction.** The Key Vault arrow (edge -84) has its only arrowhead at the Key Vault end,
  so it runs cloudflared-2 -> Key Vault tunnel token. Its label is "Secret Store".

## Layout sidecar (`design.layout.json`)

- Node positions follow the drawing's arrangement: users on top, the edge row, the cloudflared
  namespace, the frontend and api namespaces, the NSG and tunnel Key Vault to the right of the
  cluster, then one row per visual cluster.
- Frames: `cloudflare-edge` has `tint: amber, icon: boundary:cloudflare`; `microsoft-azure` has
  `tint: blue, icon: boundary:azure`; `aks-cluster` has `icon: boundary:kubernetes`. All three
  pass `readSidecar`.
- Anchored notes: the DNS sentence (on `cloudflare-edge`), the tunnel caption (on
  `ns-cloudflared`), the NetworkPolicy text (on `aks-cluster`), and one note per visual cluster
  name.

## Free text from the source

- "DNS resolves app. / api. to Cloudflare anycast IPs — never to Azure" (Cloudflare Edge title).
- "Cloudflare Tunnel · TLS 1.3 / QUIC. dialed OUTBOUND by cloudflared — requests flow back down
  it" (tunnel caption).
- "NSG: deny ALL inbound / no public IP · no public LB" (NSG caption; also the node label).
- "NetworkPolicy: cloudflared → frontend / api only" (inside the AKS frame).
- ". . . . . ." between Applicant and Visitor, read as "and other users".

## Gaps

1. Label-only visual clusters have no group kind (six frames ignored). New entry in
   `docs/schema-gaps.md`.
2. Arrows that end on a frame are attached to the nearest box ("Edges cannot attach to a
   boundary").
3. The tunnel is one bidirectional connection modelled as two edges ("Request and response are
   two unrelated edges").
4. A boundary that is also a product ("AKS cluster (private API server)") cannot carry the
   product's properties. New entry.
5. "Microsoft Azure" is a cloud with no region named; `region` overstates it. New entry.
6. Drawn replicas are separate nodes ("A tier drawn as several instances").
7. Policy stated as free text (no public IP, NetworkPolicy, DNS only to anycast) has no property
   or requirement path.
8. An empty boundary (External Systems) is kept but not drawn.

## Observations (not encoded)

- The seven edge boxes have no arrows between them, so the design does not say in which order a
  request passes through TLS termination, CDN, WAF, DDoS, bot detection, rate limiting and Access.
- Queue Storage, Table Storage, CosmosDB, Log Analytics, Communication Service, CDN, Bot
  detection, SSL / TLS termination, Access, the NSG, the Deployment, both Service ClusterIP boxes
  and the second web and api pods have no arrow in the source, so they have no edge here.
- The two Key Vault icons are separate vaults in the drawing (one for the tunnel token, one for
  app secrets) and stay separate.

## Rules fired

`node .claude/tools/validate.mjs --design designs/imported/talmaza/design.yaml`:

- `derived-store-without-cdc-or-rebuild` on `ai-search`: the search index has no asynchronous
  feed from a stream, change data capture or worker. The source draws no indexer feeding AI
  Search, so the finding is the product working; the design was not changed to silence it.
