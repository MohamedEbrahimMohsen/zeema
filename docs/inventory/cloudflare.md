# Cloudflare inventory

Official product directory: <https://developers.cloudflare.com/products/> and the marketing
product index <https://www.cloudflare.com/products/>. Families below follow Cloudflare's own
groupings (Compute, Storage, AI, Media, Security, Network, SASE / Zero Trust), split where a
family would otherwise run past 25 rows. One row per resource a designer places; composite
products are split into their placeable sub-resources.

Status: `done` = component exists in `components/cloudflare/`. `todo` = to be written.
`skip: <reason>` = cannot be a node in a design. Products that are deprecated but still usable
stay `todo` with the deprecation date recorded; only fully shut-down products and non-node
tooling are skipped.

Renames carried through this pass: Browser Rendering is now Browser Run, AutoRAG is now AI
Search, Cloudflare Calls is now Realtime (SFU / TURN / RealtimeKit), Magic Firewall is now
Cloudflare Network Firewall, Magic WAN is now Cloudflare WAN, Magic Network Monitoring is now
Network Flow, and Area 1 is now Email Security.

---

## Developer platform — compute

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cloudflare Workers | cloudflare-workers | app-server | done | https://developers.cloudflare.com/workers/platform/limits/ |
| Dynamic Workers | cloudflare-dynamic-workers | app-server | done | https://developers.cloudflare.com/dynamic-workers/ |
| Workers for Platforms (dispatch namespace) | cloudflare-workers-for-platforms | app-server | done | https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/how-workers-for-platforms-works/ |
| Cloudflare Pages | cloudflare-pages | app-server | done | https://developers.cloudflare.com/pages/platform/limits/ |
| Containers | cloudflare-containers | container-orchestrator | done | https://developers.cloudflare.com/containers/platform-details/limits/ |
| Durable Objects | cloudflare-durable-objects | coordination-service | done | https://developers.cloudflare.com/durable-objects/platform/limits/ |
| Workflows | cloudflare-workflows | workflow-engine | done | https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/ |
| Cloudflare Queues | cloudflare-queues | queue | done | https://developers.cloudflare.com/queues/platform/limits/ |
| Browser Run (formerly Browser Rendering) | cloudflare-browser-run | worker | done | https://developers.cloudflare.com/browser-run/limits/ |
| Sandbox SDK (code sandbox) | cloudflare-sandbox | app-server | done | https://developers.cloudflare.com/sandbox/ |
| Workers VPC (private network binding) | cloudflare-workers-vpc | private-link | done | https://developers.cloudflare.com/workers-vpc/ |
| Snippets | cloudflare-snippets | worker | done | https://developers.cloudflare.com/rules/snippets/ |
| Cloudflare Artifacts (Git-compatible repo) | cloudflare-artifacts | artifact-repository | done | https://developers.cloudflare.com/artifacts/platform/limits/ |
| Agents SDK | — | — | skip: framework layered on Workers and Durable Objects, deploys as a Worker | https://developers.cloudflare.com/agents/ |
| Cron Triggers | — | — | skip: schedule configuration of a Worker | https://developers.cloudflare.com/workers/configuration/cron-triggers/ |
| Workers Observability | — | — | skip: built-in logs and metrics view of a Worker | https://developers.cloudflare.com/workers/observability/ |
| Cloudflare for Platforms (umbrella) | — | — | skip: brand covering Workers for Platforms and Cloudflare for SaaS | https://developers.cloudflare.com/cloudflare-for-platforms/ |
| Cloudflare Pub/Sub (MQTT broker) | — | — | skip: discontinued, docs withdrawn; use Queues or Durable Objects | https://developers.cloudflare.com/products/ |

## Developer platform — storage and databases

| resource | id | kind | status | source |
|---|---|---|---|---|
| Workers KV namespace | cloudflare-workers-kv | nosql-database | done | https://developers.cloudflare.com/kv/concepts/how-kv-works/ |
| D1 database | cloudflare-d1 | sql-database | done | https://developers.cloudflare.com/d1/platform/limits/ |
| R2 bucket | cloudflare-r2 | object-store | done | https://developers.cloudflare.com/r2/reference/data-security/ |
| R2 Data Catalog | cloudflare-r2-data-catalog | data-catalog | done | https://developers.cloudflare.com/r2/data-catalog/ |
| R2 SQL | cloudflare-r2-sql | data-warehouse | done | https://developers.cloudflare.com/r2-sql/ |
| Cloudflare Pipelines | cloudflare-pipelines | stream-processor | done | https://developers.cloudflare.com/pipelines/ |
| Hyperdrive | cloudflare-hyperdrive | database-proxy | done | https://developers.cloudflare.com/hyperdrive/configuration/query-caching/ |
| Vectorize index | cloudflare-vectorize | vector-database | done | https://developers.cloudflare.com/vectorize/platform/limits/ |
| Secrets Store | cloudflare-secrets-store | key-management | done | https://developers.cloudflare.com/secrets-store/ |
| Cache Reserve | cloudflare-cache-reserve | object-store | done | https://developers.cloudflare.com/cache/advanced-configuration/cache-reserve/ |
| Durable Objects SQLite / KV storage | — | — | skip: storage backend of a Durable Object, not a separate node | https://developers.cloudflare.com/durable-objects/api/storage-api/ |
| R2 event notifications / lifecycle rules | — | — | skip: configuration of an R2 bucket | https://developers.cloudflare.com/r2/buckets/event-notifications/ |

## AI

| resource | id | kind | status | source |
|---|---|---|---|---|
| Workers AI | cloudflare-workers-ai | ml-inference | done | https://developers.cloudflare.com/workers-ai/platform/pricing/ |
| AI Gateway | cloudflare-ai-gateway | api-gateway | done | https://developers.cloudflare.com/ai-gateway/configuration/caching/ |
| AI Search (formerly AutoRAG) | cloudflare-ai-search | search-index | done | https://developers.cloudflare.com/ai-search/configuration/indexing/ |
| Agent Memory | cloudflare-agent-memory | vector-database | done (private beta) | https://developers.cloudflare.com/agent-memory/concepts/how-agent-memory-works/ |
| AI Crawl Control | cloudflare-ai-crawl-control | bot-management | done | https://developers.cloudflare.com/ai-crawl-control/features/manage-ai-crawlers/ |
| Firewall for AI (AI security for apps) | cloudflare-firewall-for-ai | waf | done | https://developers.cloudflare.com/waf/detections/firewall-for-ai/ |
| Constellation (edge ML inference) | — | — | skip: discontinued, replaced by Workers AI | https://developers.cloudflare.com/workers-ai/ |
| Agent Lee | — | — | skip: Cloudflare's own hosted assistant, not a customer resource | https://developers.cloudflare.com/agent-lee/ |
| AI (docs landing) | — | — | skip: documentation index over the AI products | https://developers.cloudflare.com/ai/ |

## Media

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cloudflare Stream (video on demand) | cloudflare-stream | media-transcoder | done | https://developers.cloudflare.com/stream/viewing-videos/using-own-player/ |
| Stream Live input | cloudflare-stream-live | media-transcoder | done | https://developers.cloudflare.com/stream/stream-live/start-stream-live/ |
| Cloudflare Images (storage and delivery) | cloudflare-images | object-store | done | https://developers.cloudflare.com/images/get-started/limits/ |
| Image Transformations (image resizing) | cloudflare-image-transformations | media-transcoder | done | https://developers.cloudflare.com/images/transform-images/ |
| Realtime SFU | cloudflare-realtime-sfu | media-router | done | https://developers.cloudflare.com/realtime/sfu/ |
| Realtime TURN Service | cloudflare-turn | media-router | done | https://developers.cloudflare.com/realtime/turn/ |
| RealtimeKit | cloudflare-realtimekit | media-router | done | https://developers.cloudflare.com/realtime/realtimekit/ |
| MoQ (Media over QUIC) | cloudflare-moq | media-router | done (beta) | https://developers.cloudflare.com/moq/ |
| Cloudflare Calls | — | — | skip: renamed Realtime, same resources (SFU, TURN, RealtimeKit) | https://developers.cloudflare.com/realtime/ |

## Application performance — CDN, cache and optimization

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cloudflare CDN / Cache | cloudflare-cdn | cdn | done | https://developers.cloudflare.com/cache/ |
| Zaraz (third-party tag loader) | cloudflare-zaraz | worker | done | https://developers.cloudflare.com/zaraz/reference/settings/ |
| Argo Smart Routing | — | — | skip: routing option enabled on an existing zone | https://developers.cloudflare.com/argo-smart-routing/ |
| Tiered Cache / Regional Tiered Cache | — | — | skip: cache topology setting of the CDN | https://developers.cloudflare.com/cache/how-to/tiered-cache/ |
| Smart Shield | — | — | skip: bundle of Tiered Cache, Argo, Cache Reserve and Health Checks | https://developers.cloudflare.com/smart-shield/ |
| Rules (Transform, Redirect, Origin, Configuration, Cache Rules) | — | — | skip: request-modification rules configured on a zone | https://developers.cloudflare.com/rules/ |
| Ruleset Engine | — | — | skip: rule configuration framework shared by WAF, Rules and Bots | https://developers.cloudflare.com/ruleset-engine/ |
| Rocket Loader | — | — | skip: JavaScript deferral setting of a zone | https://developers.cloudflare.com/speed/optimization/content/rocket-loader/ |
| Polish / Mirage | — | — | skip: image optimization settings of a zone | https://developers.cloudflare.com/images/polish/ |
| Automatic Platform Optimization | — | — | skip: caching mode for WordPress zones | https://developers.cloudflare.com/automatic-platform-optimization/ |
| Cloudflare Fonts | — | — | skip: font self-hosting setting of a zone | https://developers.cloudflare.com/speed/optimization/content/fonts/ |
| Speed / Observatory | — | — | skip: performance testing and recommendation dashboard | https://developers.cloudflare.com/speed/ |
| Google tag gateway for advertisers | — | — | skip: first-party tag proxy setting on an existing zone | https://developers.cloudflare.com/google-tag-gateway/ |
| Railgun | — | — | skip: full shutdown 1 September 2023 | https://developers.cloudflare.com/fundamentals/ |

## DNS and domains

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cloudflare DNS (authoritative zone) | cloudflare-dns | dns | done | https://developers.cloudflare.com/dns/ |
| Secondary DNS zone | cloudflare-secondary-dns | dns | done | https://developers.cloudflare.com/dns/zone-setups/zone-transfers/ |
| Internal DNS (Cloudflare One views) | cloudflare-internal-dns | dns | done | https://developers.cloudflare.com/dns/internal-dns/ |
| DNS Firewall (resolver proxy) | cloudflare-dns-firewall | firewall | done | https://developers.cloudflare.com/dns/dns-firewall/ |
| Cloudflare Registrar | cloudflare-registrar | dns | done | https://developers.cloudflare.com/registrar/ |
| 1.1.1.1 public resolver | — | — | skip: public resolver service, not a customer resource | https://developers.cloudflare.com/1.1.1.1/ |
| Custom Domain Protection | — | — | skip: registry lock applied to an existing domain | https://www.cloudflare.com/products/registrar/ |
| Public to private DNS (private origins) | — | — | skip: resolution mode for tunneled origins | https://developers.cloudflare.com/dns/private-origins/ |

## Traffic management and availability

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cloudflare Load Balancing | cloudflare-load-balancing | load-balancer | done | https://developers.cloudflare.com/load-balancing/understand-basics/session-affinity/ |
| Health Checks (standalone) | cloudflare-health-checks | monitoring | done | https://developers.cloudflare.com/health-checks/ |
| Waiting Room | cloudflare-waiting-room | rate-limiter | done | https://developers.cloudflare.com/waiting-room/reference/configuration-settings/ |
| Cloudflare Spectrum (TCP/UDP proxy) | cloudflare-spectrum | load-balancer | done | https://developers.cloudflare.com/spectrum/reference/configuration-options/ |
| Spectrum for Minecraft | — | — | skip: protocol preset of a Spectrum application | https://developers.cloudflare.com/spectrum/ |
| Load Balancing monitors and pools | — | — | skip: configuration of a load balancer | https://developers.cloudflare.com/load-balancing/pools/ |

## SSL/TLS and certificates

| resource | id | kind | status | source |
|---|---|---|---|---|
| SSL/TLS edge certificate (Universal SSL) | cloudflare-ssl-tls | key-management | done | https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/ |
| Advanced Certificate Manager | cloudflare-advanced-certificate-manager | key-management | done | https://developers.cloudflare.com/ssl/edge-certificates/advanced-certificate-manager/ |
| Keyless SSL | cloudflare-keyless-ssl | key-management | done | https://developers.cloudflare.com/ssl/keyless-ssl/ |
| Geo Key Manager | cloudflare-geo-key-manager | key-management | done | https://developers.cloudflare.com/ssl/edge-certificates/geokey-manager/ |
| Cloudflare for SaaS (custom hostnames) | cloudflare-for-saas | cdn | done | https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/security/certificate-management/issue-and-validate/issue-certificates/ |
| Origin CA certificates | cloudflare-origin-ca | key-management | done | https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/ |
| mTLS client certificates | cloudflare-mtls | key-management | done | https://developers.cloudflare.com/ssl/client-certificates/ |

## Application security

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cloudflare WAF (managed and custom rules) | cloudflare-waf | waf | done | https://developers.cloudflare.com/waf/managed-rules/ |
| DDoS Protection (L7 and L3/4 managed rulesets) | cloudflare-ddos-protection | ddos-protection | done | https://developers.cloudflare.com/ddos-protection/managed-rulesets/http/ |
| Rate limiting rules | cloudflare-rate-limiting | rate-limiter | done | https://developers.cloudflare.com/waf/rate-limiting-rules/ |
| Bot Management / Bots | cloudflare-bot-management | bot-management | done | https://developers.cloudflare.com/bots/concepts/bot-score/ |
| Turnstile | cloudflare-turnstile | bot-management | done | https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ |
| API Shield | cloudflare-api-shield | api-gateway | done | https://developers.cloudflare.com/api-shield/ |
| Page Shield (client-side security) | cloudflare-page-shield | monitoring | done | https://developers.cloudflare.com/page-shield/ |
| Security Center | cloudflare-security-center | monitoring | done | https://developers.cloudflare.com/security-center/ |
| Cloudflare Challenges | — | — | skip: challenge platform invoked by WAF, Bots and Turnstile | https://developers.cloudflare.com/cloudflare-challenges/ |
| Leaked credentials detection | — | — | skip: detection feature of the WAF | https://developers.cloudflare.com/waf/detections/leaked-credentials/ |
| Fraud Detection (sequence rules) | — | — | skip: detection feature of Bot Management | https://developers.cloudflare.com/bots/additional-configurations/sequence-rules/ |
| Firewall Rules (legacy) | — | — | skip: retired, migrated to WAF custom rules; docs withdrawn | https://developers.cloudflare.com/waf/ |
| Data Localization Suite | — | — | skip: regional processing configuration across existing products | https://developers.cloudflare.com/data-localization/ |
| Privacy Pass | — | — | skip: attestation protocol supported by Challenges | https://developers.cloudflare.com/privacy-pass/ |

## Network services

| resource | id | kind | status | source |
|---|---|---|---|---|
| Magic Transit | cloudflare-magic-transit | ddos-protection | done | https://developers.cloudflare.com/magic-transit/ |
| Cloudflare WAN (formerly Magic WAN) | cloudflare-wan | network-fabric | done | https://developers.cloudflare.com/cloudflare-wan/ |
| Cloudflare Network Firewall (formerly Magic Firewall) | cloudflare-network-firewall | firewall | done | https://developers.cloudflare.com/cloudflare-network-firewall/about/ruleset-logic/ |
| Network Flow (formerly Magic Network Monitoring) | cloudflare-network-flow | monitoring | done | https://developers.cloudflare.com/network-flow/ |
| Cloudflare Network Interconnect (CNI) | cloudflare-network-interconnect | network-fabric | done | https://developers.cloudflare.com/network-interconnect/ |
| Bring Your Own IP (BYOIP) | cloudflare-byoip | network-fabric | done | https://developers.cloudflare.com/byoip/ |
| Cloudflare One Appliance (Magic WAN Connector) | cloudflare-one-appliance | edge-appliance | done | https://developers.cloudflare.com/cloudflare-wan/configuration/appliance/ |
| Cloudflare Mesh | cloudflare-mesh | network-fabric | done | https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-mesh/ |
| Privacy Gateway (Oblivious HTTP relay) | cloudflare-privacy-gateway | api-gateway | done | https://developers.cloudflare.com/privacy-gateway/ |
| Privacy Proxy | cloudflare-privacy-proxy | third-party-api | done | https://developers.cloudflare.com/privacy-proxy/ |
| China Network | — | — | skip: regional deployment option of the CDN, not a resource | https://developers.cloudflare.com/china-network/ |
| Multi-Cloud Networking | — | — | skip: umbrella brand over Cloudflare WAN, CNI and Workers VPC | https://developers.cloudflare.com/multi-cloud-networking/ |
| Anycast network | — | — | skip: the platform itself, not a placeable resource | https://developers.cloudflare.com/network/ |

## Cloudflare One — SASE and Zero Trust

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cloudflare Access | cloudflare-access | bastion-host | done | https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/ |
| Cloudflare Gateway (secure web gateway) | cloudflare-gateway | firewall | done | https://developers.cloudflare.com/cloudflare-one/traffic-policies/order-of-enforcement/ |
| Cloudflare Tunnel (cloudflared connector) | cloudflare-tunnel | private-link | done | https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/ |
| WARP / Cloudflare One Client | cloudflare-warp | client | done | https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/ |
| Browser Isolation (RBI) | cloudflare-browser-isolation | virtual-desktop | done | https://developers.cloudflare.com/cloudflare-one/remote-browser-isolation/isolation-policies/ |
| CASB (cloud and SaaS integrations) | cloudflare-casb | monitoring | done | https://developers.cloudflare.com/cloudflare-one/cloud-and-saas-findings/troubleshoot-casb/ |
| Data Loss Prevention | cloudflare-dlp | policy-engine | done | https://developers.cloudflare.com/cloudflare-one/data-loss-prevention/ |
| Digital Experience Monitoring (DEX) | cloudflare-dex | monitoring | done | https://developers.cloudflare.com/cloudflare-one/insights/dex/tests/ |
| Cloudflare One RDP | cloudflare-rdp | bastion-host | done | https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/use-cases/rdp/ |
| Cloudflare One identity providers | cloudflare-one-identity-provider | identity-provider | done | https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/ |
| Cloudflare One (umbrella) | — | — | skip: brand covering Access, Gateway, Tunnel, WARP, CASB, DLP and Email Security | https://developers.cloudflare.com/cloudflare-one/ |
| Device posture checks / WARP settings | — | — | skip: policy configuration attached to enrolled devices | https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/warp/ |
| Cloudflare One service tokens | — | — | skip: credential issued by Access | https://developers.cloudflare.com/cloudflare-one/access-controls/service-auth/service-tokens/ |

## Email

| resource | id | kind | status | source |
|---|---|---|---|---|
| Email Routing | cloudflare-email-routing | notification-service | done | https://developers.cloudflare.com/email-service/platform/limits/ |
| Email Sending (transactional) | cloudflare-email-sending | notification-service | done (beta) | https://developers.cloudflare.com/email-service/platform/limits/ |
| Email Workers | cloudflare-email-workers | app-server | done | https://developers.cloudflare.com/email-service/api/route-emails/email-handler/ |
| Email Security (formerly Area 1) | cloudflare-email-security | email-security-gateway | done | https://developers.cloudflare.com/cloudflare-one/email-security/settings/detection-settings/configure-link-actions/ |
| DMARC Management | cloudflare-dmarc-management | monitoring | done | https://developers.cloudflare.com/dmarc-management/enable/ |
| Email Service (umbrella) | — | — | skip: brand covering Email Routing and Email Sending | https://developers.cloudflare.com/email-service/ |

## Analytics, logs and observability

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cloudflare Web Analytics | cloudflare-web-analytics | monitoring | done | https://developers.cloudflare.com/web-analytics/get-started/ |
| Workers Analytics Engine | cloudflare-analytics-engine | timeseries-database | done | https://developers.cloudflare.com/analytics/analytics-engine/limits/ |
| Logpush job | cloudflare-logpush | stream-processor | done | https://developers.cloudflare.com/logs/logpush/logpush-job/api-configuration/ |
| Log Explorer | cloudflare-log-explorer | monitoring | done | https://developers.cloudflare.com/log-explorer/ |
| Network Error Logging | cloudflare-network-error-logging | monitoring | done | https://developers.cloudflare.com/network-error-logging/ |
| Notifications | cloudflare-notifications | notification-service | done | https://developers.cloudflare.com/notifications/ |
| Logpull | — | — | skip: legacy pull API superseded by Logpush | https://developers.cloudflare.com/logs/logpull/ |
| Instant Logs | — | — | skip: live tail view over an existing zone's logs | https://developers.cloudflare.com/logs/instant-logs/ |
| GraphQL Analytics API | — | — | skip: query API over metrics of existing products | https://developers.cloudflare.com/analytics/graphql-api/ |
| Analytics (docs landing) | — | — | skip: documentation index over the analytics products | https://developers.cloudflare.com/analytics/ |
| Cloudflare Radar | — | — | skip: public internet data portal, not a customer resource | https://developers.cloudflare.com/radar/ |

## Platform, cryptography and management

| resource | id | kind | status | source |
|---|---|---|---|---|
| Web3 gateway (Ethereum / IPFS) | cloudflare-web3 | third-party-api | done | https://developers.cloudflare.com/web3/ |
| Cloudflare Wallets | cloudflare-wallets | third-party-api | done (beta) | https://developers.cloudflare.com/wallets/ |
| Randomness Beacon (drand) | cloudflare-randomness-beacon | third-party-api | done | https://developers.cloudflare.com/randomness-beacon/ |
| Time Services (NTS / Roughtime) | cloudflare-time-services | third-party-api | done | https://developers.cloudflare.com/time-services/ntp/usage/ |
| Key Transparency Auditor | — | — | skip: public verification service Cloudflare operates for WhatsApp | https://developers.cloudflare.com/key-transparency/ |
| Cloudflare dashboard and REST API | — | — | skip: control plane | https://developers.cloudflare.com/api/ |
| Wrangler CLI | — | — | skip: command line tool | https://developers.cloudflare.com/workers/wrangler/ |
| Terraform provider / Pulumi provider | — | — | skip: infrastructure-as-code tooling | https://developers.cloudflare.com/terraform/ |
| Cloudflare Fundamentals / Account / Tenant | — | — | skip: account and organization constructs | https://developers.cloudflare.com/fundamentals/ |
| Billing | — | — | skip: billing and plan management | https://developers.cloudflare.com/billing/ |
| Support | — | — | skip: support plans | https://developers.cloudflare.com/support/ |
| Resource Tagging | — | — | skip: account metadata applied to existing resources | https://developers.cloudflare.com/resource-tagging/ |
| Version Management | — | — | skip: change-rollout control over zone configuration | https://developers.cloudflare.com/version-management/ |
| Reference Architecture / Learning Paths / Flagship | — | — | skip: documentation sections, not resources | https://developers.cloudflare.com/reference-architecture/ |

---

## Kind proposals

| NEW id | why no existing kind fits |
|---|---|
| bot-management | A bot detection layer scores every request with a machine-learning model and acts on that score: it carries a bot-score threshold, the detection engines enabled (heuristics, ML, JavaScript detections, anomaly detection), a verified-bot allowlist, a challenge action, and a session-token lifetime. `waf` holds rulesets, managed rule groups and a paranoia level; `rate-limiter` holds a window and a request budget; `ddos-protection` holds attack-traffic thresholds. None of them can answer the rule a bot policy actually needs — "is JavaScript detection enabled on every route that also enforces a bot-score block", or "does a login route sitting behind bot management also emit a challenge" — because the score and the detection engines have nowhere to live. Used by Cloudflare Bot Management, Turnstile and AI Crawl Control. |
| email-security-gateway | An inbound email security gateway sits in the MX path and holds properties nothing else in the catalogue has: a delivery mode (inline MX, journaling, or API-connected to the mailbox provider), per-disposition actions (malicious, suspicious, spoof, spam, bulk), link-rewrite and attachment-detonation switches, allow/block sender policies, and a quarantine retention. `firewall` describes network rules over addresses, ports and protocols and cannot express a message disposition; `notification-service` is an outbound sender with no inspection or quarantine; `waf` inspects HTTP requests. A rule such as "an internet-facing mail flow must have an email security gateway ahead of the mailbox and link rewriting on" has no property to read on any existing kind. Used by Cloudflare Email Security (formerly Area 1). |

---

## Coverage pass 2026-09-21

Re-diffed against <https://developers.cloudflare.com/products/> and the created-resource list of
the Cloudflare Terraform provider (`docs/resources/` in cloudflare/terraform-provider-cloudflare).
The directory entries "AI controls", "Client-side security" and "Network visibility" are group
headings, not products, and get no row.

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cloudflare Flagship (feature flags) | cloudflare-flagship | feature-flag-service | done | https://developers.cloudflare.com/flagship/ |
| MCP server portal (Cloudflare One AI controls) | cloudflare-mcp-portal | api-gateway | done | https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/mcp-portals/ |
| Cloudforce One | — | — | skip: threat-intelligence platform and analyst service inside Security Center; its API objects are requests for information, not a resource in a traffic path | https://developers.cloudflare.com/security-center/cloudforce-one/ |
| Open Port Scanning | — | — | skip: Cloudforce One scan of Magic Transit and BYOIP ranges, not a resource | https://developers.cloudflare.com/security-center/cloudforce-one/open-port-scanning/ |
| Cloud Connector | — | — | skip: rule on a zone that routes matching requests to a cloud bucket | https://developers.cloudflare.com/rules/cloud-connector/ |
| WAF content scanning | — | — | skip: upload-inspection detection feature of the WAF | https://developers.cloudflare.com/waf/detections/content-scanning/ |
| Workers VPC service (connectivity directory entry) | — | — | skip: service entry a Worker binds to, part of Workers VPC | https://developers.cloudflare.com/workers-vpc/configuration/vpc-services/ |
| Secure MCP servers | — | — | skip: Access policy placed in front of a customer's own MCP server | https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/secure-mcp-servers/ |
| Resource sharing | — | — | skip: account construct for sharing resources between accounts | https://developers.cloudflare.com/fundamentals/manage-members/share-resources/ |

## Counts

total 163, todo 0, done 100, skip 63.
