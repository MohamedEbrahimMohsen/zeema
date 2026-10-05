# Azure catalogue audit against the Azure pricing calculator and the Azure architecture icons

Audit only. Nothing under `components/`, `icons/`, `locales/` or `docs/inventory/` was changed.
Raw data, scripts and the icon contact sheet are in the session scratch directory
(`scratchpad/azure-audit/`), not in the repository.

## 1. Method

| item | value |
|---|---|
| Date | 2026-10-05 (UTC) |
| Calculator page | <https://azure.microsoft.com/en-in/pricing/calculator/>, opened in headless Chromium (Playwright 1.63), JSON responses captured |
| Product catalogue endpoint | `GET https://azure.microsoft.com/api/v2/pricing/categories/calculator/?culture=en-in&discount=mca&v=20260930-0214-20260930-2100-183594243` |
| Endpoint shape | one array of 21 category objects `{slug, displayName, products[]}`; each product has `slug, displayName, description, keywords, links{url, pricingUrl, documentationUrl}`. Not paged: the whole catalogue is one response |
| Other endpoints seen | `/api/v2/calculator/resources/` (UI strings and estimate templates), `/api/v2/calculator/config/`, `/api/v2/pricing/calculator/regions/`, `/api/v2/pricing/support/calculator/` (support plans: Developer, Standard, Professional Direct, Premier), `/api/v2/currencies/` |
| Second locale | same endpoint with `culture=en-us`: same 156 slugs, 13 display names differ (en-in carries stale names, see section 2) |
| Calculator categories | 21 (Featured + 20). Category memberships: 226 |
| Calculator products (unique slugs) | 156 |
| Zeema Azure components | 202 (`components/azure/*.yaml`); 202 locale names; 202 icons |
| Inventory rows (`docs/inventory/azure.md`) | 694 table rows with a status: 204 `done`, 490 `skip`. The file's own count line says 692 / 202 done; the difference is two duplicate `done` rows (`azure-monitor-data-collection-rule`, `azure-privileged-identity-management`) |
| Official icon set | Azure Public Service Icons V24 (the zip currently linked from <https://learn.microsoft.com/en-us/azure/architecture/icons/>), 714 SVG files including cross-folder duplicates. The owner's copy at `Downloads/Azure_Public_Service_Icons_V24.zip` was used; nothing was downloaded |
| Icon terms (from the page) | Icons may be used in architectural diagrams, training materials or documentation; copy, distribute and display only for that use unless Microsoft grants permission; do not crop, flip, rotate, distort or change shape; do not use Microsoft product icons to represent your own product. The page gates the download behind "I agree to the above terms" |
| Icon comparison | every SVG rendered in Chromium, cropped to its alpha bounding box, fitted to 48 x 48 on white; mean absolute RGB difference (0 = identical, 1 = inverse). Each Zeema icon was compared against all 714 official files (nearest match) and against its name-matched file |

Calculator to Zeema mapping of the 156 products:

| outcome | count |
|---|---|
| maps to a Zeema component | 118 |
| maps to an inventory `skip` row | 34 |
| covered only by inventory prose (no row) | 1 |
| no component, no row | 3 |

## 2. Name mismatches

41 of the 118 mapped products differ from the Zeema locale name in at least one calculator locale.

Virtual machines: the calculator lists **"Virtual Machines"** (slug `virtual-machines`, Compute) and
**no separate confidential VM product** in either locale. The only "confidential" product is
"Microsoft Azure Confidential Ledger" (en-in) / "Azure confidential ledger" (en-us). Confidential VMs
are priced inside "Virtual Machines" (DCasv5/ECasv5 series). So `azure-confidential-vm`
("Azure confidential VM") has no calculator counterpart; it is in section 4.

### 2a. Real differences

| Zeema id | Zeema name | calculator en-in | calculator en-us | suggested action |
|---|---|---|---|---|
| `azure-health-bot` | Health Bot | Healthcare agent service | Healthcare agent service | **rename** to "Healthcare agent service" (Microsoft Learn page title is now "Overview - Healthcare agent service") |
| `azure-document-intelligence` | Azure Document Intelligence | Azure Form Recogniser | Azure Document Intelligence in Foundry Tools | optional rename to "Azure Document Intelligence in Foundry Tools" (Learn title: "What Is Azure Document Intelligence in Foundry Tools?"); en-in name is stale |
| `azure-content-understanding` | Azure Content Understanding | Azure Content Understanding in Foundry Tools | Azure Content Understanding in Foundry Tools | optional rename to "Azure Content Understanding in Foundry Tools" |
| `azure-ai-search` | Azure AI Search | Azure AI Search | Foundry IQ | keep; en-us now labels the AI Search pricing tile "Foundry IQ". Review overlap with `azure-foundry-iq` (Zeema has both) |
| `azure-load-testing` | Azure Load Testing | Azure App Testing | Azure App Testing | keep; "Azure App Testing" is the umbrella that also contains Playwright Workspaces (`azure-playwright-testing`); inventory row already reads "Azure App Testing (Load Testing)" |
| `azure-aks-edge-essentials` | AKS Edge Essentials | Azure Kubernetes Service Edge Essentials | Azure Kubernetes Service Edge Essentials | optional rename to the long form; Learn uses "AKS Edge Essentials" |
| `azure-aks` | Azure Kubernetes Service | Azure Kubernetes Service (AKS) | Azure Kubernetes Service (AKS) | optional: add " (AKS)" |
| `azure-managed-disk` | Azure Disk Storage | Managed Disks | Managed Disks | keep (Learn product name is Azure Disk Storage / Azure managed disks) |
| `azure-public-ip` | Public IP address | IP Addresses | IP Addresses | keep (calculator tile is a billing line for all IP types) |
| `azure-load-balancer` | Azure Load Balancer | Load Balancing | Load Balancer | keep; en-in label is the load-balancing hub page |
| `azure-openai` | Azure OpenAI in Foundry Models | Azure OpenAI | Azure OpenAI | keep (Learn name) |
| `azure-database-migration-service` | Azure Database Migration Service | Azure Database Migration Service (classic) | Azure Database Migration Service (classic) | keep; calculator only prices the classic SKU |
| `azure-entra-id` | Microsoft Entra ID | Microsoft Entra ID (formerly Azure AD) | same | keep (suffix is a marketing aside) |
| `azure-defender-easm` | Microsoft Defender External Attack Surface Management | Defender External Attack Surface Management | same | keep |
| `azure-spring-apps` | Azure Spring Apps | Azure Spring Cloud | Azure Spring Apps | keep; en-in name is stale |
| `azure-health-data-services` | Azure Health Data Services | Azure Healthcare APIs | Azure Health Data Services | keep; en-in name is stale |
| `azure-purview` | Microsoft Purview | Azure Purview | Microsoft Purview | keep; en-in name is stale |
| `azure-confidential-ledger` | Azure confidential ledger | Microsoft Azure Confidential Ledger | Azure confidential ledger | keep; matches en-us exactly |

### 2b. Prefix-only differences (calculator drops "Azure")

All keep: the Zeema name is the full product name Microsoft Learn uses.

| Zeema id | Zeema name | calculator name (both locales unless noted) |
|---|---|---|
| `azure-virtual-machine` | Azure Virtual Machines | Virtual Machines |
| `azure-app-service` | Azure App Service | App Service |
| `azure-vm-scale-set` | Azure Virtual Machine Scale Sets | Virtual Machine Scale Sets |
| `azure-batch` | Azure Batch | Batch |
| `azure-virtual-network` | Azure Virtual Network | Virtual Network |
| `azure-application-gateway` | Azure Application Gateway | Application Gateway |
| `azure-vpn-gateway` | Azure VPN Gateway | VPN Gateway |
| `azure-cdn` | Azure Content Delivery Network | Content Delivery Network |
| `azure-traffic-manager` | Azure Traffic Manager | Traffic Manager |
| `azure-network-watcher` | Azure Network Watcher | Network Watcher |
| `azure-virtual-wan` | Azure Virtual WAN | Virtual WAN |
| `azure-api-management` | Azure API Management | API Management |
| `azure-notification-hubs` | Azure Notification Hubs | Notification Hubs |
| `azure-static-web-apps` | Azure Static Web Apps | Static Web Apps |
| `azure-hdinsight` | Azure HDInsight | HDInsight |
| `azure-event-hubs` | Azure Event Hubs | Event Hubs |
| `azure-data-factory` | Azure Data Factory | Data Factory (en-in) / Azure Data Factory (en-us) |
| `azure-event-grid` | Azure Event Grid | Event Grid |
| `azure-logic-apps` | Azure Logic Apps | Logic Apps |
| `azure-service-bus` | Azure Service Bus | Service Bus |
| `azure-key-vault` | Azure Key Vault | Key Vault |
| `azure-app-configuration` | Azure App Configuration | App Configuration |
| `azure-automation` | Azure Automation | Automation |

## 3. Missing in Zeema (no component and no inventory row)

| calculator name (en-in / en-us) | category | slug | suggested kind | verdict |
|---|---|---|---|---|
| Bandwidth | Networking | `bandwidth` | — | inventory `skip: data-transfer billing line, not a resource` |
| Microsoft Defender ISOC | Security | `microsoft-defender-isoc` | — | inventory `skip: security-operations solution offering, not a deployable resource` |
| Azure Kubernetes Service on Azure Stack HCI / on Azure Local | Hybrid + multicloud | `aks-hci` | `container-orchestrator` | no component: AKS running on `azure-local`. Add a "covered under another name" row pointing at `azure-aks` + `azure-local` |
| Azure Active Directory B2C | Identity | `active-directory-b2c` | `identity-provider` | no component: inventory prose already folds it into `azure-entra-external-id`; add it as a row in "Already covered under another name" so the table is complete |

New components warranted: **0**.

## 4. In Zeema, not in the calculator

84 components have no calculator product of their own. None was found retired. All are
sub-resources, features or variants priced inside a calculator product, or products the calculator
does not price. Evidence = the component's own `docs` URL.

| Zeema id | Zeema name | priced under (calculator product) | evidence |
|---|---|---|---|
| `azure-confidential-vm` | Azure confidential VM | Virtual Machines | https://learn.microsoft.com/en-us/azure/confidential-computing/confidential-vm-overview |
| `azure-spot-vm` | Azure Spot Virtual Machines | Virtual Machines | https://learn.microsoft.com/en-us/azure/virtual-machines/spot-vms |
| `azure-dsvm` | Azure Data Science Virtual Machine | Virtual Machines | https://learn.microsoft.com/en-us/azure/machine-learning/data-science-virtual-machine/overview |
| `azure-sql-server-vm` | SQL Server on Azure Virtual Machines | Virtual Machines | https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/sql-server-on-azure-vm-iaas-what-is-overview |
| `azure-compute-fleet` | Azure Compute Fleet | Virtual Machines | https://learn.microsoft.com/en-us/azure/azure-compute-fleet/overview |
| `azure-compute-gallery` | Azure Compute Gallery | Virtual Machines / Storage | https://learn.microsoft.com/en-us/azure/virtual-machines/azure-compute-gallery |
| `azure-vm-image-builder` | Azure VM Image Builder | Virtual Machines (free service) | https://learn.microsoft.com/en-us/azure/virtual-machines/image-builder-overview |
| `azure-baremetal-infrastructure` | Azure BareMetal Infrastructure | not priced in calculator | https://learn.microsoft.com/en-us/azure/azure-large-instances/work-with-azure-large-instances-in-azure-portal |
| `azure-cyclecloud` | Azure CycleCloud | not priced (free orchestrator) | https://learn.microsoft.com/en-us/azure/cyclecloud/overview |
| `azure-quantum` | Azure Quantum | not priced in calculator | https://learn.microsoft.com/en-us/azure/quantum/overview-azure-quantum |
| `azure-blob-storage` | Azure Blob Storage | Storage Accounts | https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blobs-introduction |
| `azure-data-lake-storage` | Azure Data Lake Storage | Storage Accounts | https://learn.microsoft.com/en-us/azure/storage/blobs/data-lake-storage-introduction |
| `azure-queue-storage` | Azure Queue Storage | Storage Accounts | https://learn.microsoft.com/en-us/azure/storage/queues/storage-queues-introduction |
| `azure-table-storage` | Azure Table Storage | Storage Accounts | https://learn.microsoft.com/en-us/azure/storage/tables/table-storage-overview |
| `azure-file-sync` | Azure File Sync | Azure Files | https://learn.microsoft.com/en-us/azure/storage/file-sync/file-sync-introduction |
| `azure-storage-mover` | Azure Storage Mover | not priced (free) | https://learn.microsoft.com/en-us/azure/storage-mover/service-overview |
| `azure-data-box-gateway` | Azure Data Box Gateway | Data Box | https://learn.microsoft.com/en-us/azure/databox-gateway/data-box-gateway-overview |
| `azure-subnet` | Azure subnet | Virtual Network | https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-manage-subnet |
| `azure-network-interface` | Azure network interface | Virtual Network | https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-network-interface |
| `azure-network-security-group` | Network Security Group | Virtual Network (free) | https://learn.microsoft.com/en-us/azure/virtual-network/network-security-groups-overview |
| `azure-network-security-perimeter` | Network security perimeter | Azure Private Link | https://learn.microsoft.com/en-us/azure/private-link/network-security-perimeter-concepts |
| `azure-private-dns` | Azure Private DNS | Azure DNS | https://learn.microsoft.com/en-us/azure/dns/private-dns-overview |
| `azure-dns-private-resolver` | Azure DNS Private Resolver | Azure DNS | https://learn.microsoft.com/en-us/azure/dns/dns-private-resolver-overview |
| `azure-web-application-firewall` | Azure Web Application Firewall | Application Gateway / Azure Front Door | https://learn.microsoft.com/en-us/azure/web-application-firewall/overview |
| `azure-application-gateway-for-containers` | Application Gateway for Containers | Application Gateway | https://learn.microsoft.com/en-us/azure/application-gateway/for-containers/overview |
| `azure-peering-service` | Azure Peering Service | not priced in calculator | https://learn.microsoft.com/en-us/azure/peering-service/about |
| `azure-multicloud-interconnect` | Azure Multicloud Interconnect | not priced in calculator | https://learn.microsoft.com/en-us/azure/multicloud-interconnect/faq |
| `azure-relay` | Azure Relay | Service Bus pricing page | https://learn.microsoft.com/en-us/azure/azure-relay/relay-what-is-it |
| `azure-connected-cache` | Microsoft Connected Cache | not priced (free) | https://learn.microsoft.com/en-us/windows/deployment/do/waas-microsoft-connected-cache |
| `azure-application-insights` | Application Insights | Azure Monitor | https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview |
| `azure-log-analytics` | Log Analytics workspace | Azure Monitor | https://learn.microsoft.com/en-us/azure/azure-monitor/logs/log-analytics-workspace-overview |
| `azure-managed-prometheus` | Azure Monitor managed service for Prometheus | Azure Monitor | https://learn.microsoft.com/en-us/azure/azure-monitor/metrics/prometheus-metrics-overview |
| `azure-monitor-workspace` | Azure Monitor workspace | Azure Monitor | https://learn.microsoft.com/en-us/azure/azure-monitor/metrics/azure-monitor-workspace-overview |
| `azure-monitor-data-collection-endpoint` | Data collection endpoint | Azure Monitor | https://learn.microsoft.com/en-us/azure/azure-monitor/data-collection/data-collection-endpoint-overview |
| `azure-monitor-data-collection-rule` | Data collection rule | Azure Monitor | https://learn.microsoft.com/en-us/azure/azure-monitor/data-collection/data-collection-rule-overview |
| `azure-monitor-for-sap` | Azure Monitor for SAP solutions | Azure Monitor | https://learn.microsoft.com/en-us/azure/sap/monitor/about-azure-monitor-sap-solutions |
| `azure-ai-content-safety` | Content Safety | Azure AI services / Foundry Tools | https://learn.microsoft.com/en-us/azure/ai-services/content-safety/overview |
| `azure-ai-custom-vision` | Azure AI Custom Vision | Azure AI services / Foundry Tools | https://learn.microsoft.com/en-us/azure/ai-services/custom-vision-service/limits-and-quotas |
| `azure-ai-face` | Azure AI Face | Azure AI services / Foundry Tools | https://learn.microsoft.com/en-us/azure/ai-services/face/overview-identity |
| `azure-ai-language` | Azure Language | Azure AI services / Foundry Tools | https://learn.microsoft.com/en-us/azure/ai-services/language-service/concepts/data-limits |
| `azure-ai-speech` | Azure Speech | Azure AI services / Foundry Tools | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-services-quotas-and-limits |
| `azure-ai-translator` | Azure Translator | Azure AI services / Foundry Tools | https://learn.microsoft.com/en-us/azure/ai-services/translator/service-limits |
| `azure-ai-vision` | Azure Vision | Azure AI services / Foundry Tools | https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-image-analysis |
| `azure-immersive-reader` | Azure AI Immersive Reader | Azure AI services / Foundry Tools | https://learn.microsoft.com/en-us/azure/ai-services/immersive-reader/overview |
| `azure-ai-foundry` | Microsoft Foundry | Azure OpenAI / Azure Machine Learning (no own tile) | https://learn.microsoft.com/en-us/azure/ai-foundry/what-is-azure-ai-foundry |
| `azure-foundry-agent-service` | Foundry Agent Service | not priced as its own tile | https://learn.microsoft.com/en-us/azure/ai-foundry/agents/overview |
| `azure-foundry-models` | Foundry Models | Azure OpenAI | https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/concepts/models-from-partners |
| `azure-foundry-iq` | Foundry IQ | Azure AI Search (en-us tile is titled "Foundry IQ") | https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/what-is-foundry-iq |
| `azure-ml-endpoint` | Azure ML endpoint | Azure Machine Learning | https://learn.microsoft.com/en-us/azure/machine-learning/concept-endpoints-online |
| `azure-discovery` | Microsoft Discovery | not priced in calculator | https://learn.microsoft.com/en-us/azure/microsoft-discovery/overview-what-is-microsoft-discovery |
| `azure-durable-functions` | Azure Durable Functions | Azure Functions | https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview |
| `azure-event-grid-mqtt` | Azure Event Grid MQTT Broker | Event Grid | https://learn.microsoft.com/en-us/azure/event-grid/mqtt-overview |
| `azure-schema-registry` | Azure Schema Registry | Event Hubs | https://learn.microsoft.com/en-us/azure/event-hubs/schema-registry-overview |
| `azure-api-center` | Azure API Center | not priced in calculator | https://learn.microsoft.com/en-us/azure/api-center/overview |
| `azure-managed-hsm` | Azure Key Vault Managed HSM | Key Vault | https://learn.microsoft.com/en-us/azure/key-vault/managed-hsm/overview |
| `azure-attestation` | Microsoft Azure Attestation | not priced (free) | https://learn.microsoft.com/en-us/azure/attestation/overview |
| `azure-conditional-access` | Microsoft Entra Conditional Access | Microsoft Entra ID (P1) | https://learn.microsoft.com/en-us/entra/identity/conditional-access/overview |
| `azure-privileged-identity-management` | Microsoft Entra Privileged Identity Management | Microsoft Entra ID (P2) | https://learn.microsoft.com/en-us/entra/id-governance/privileged-identity-management/pim-configure |
| `azure-managed-identity` | Managed identities for Azure resources | Microsoft Entra ID (free) | https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview |
| `azure-entra-connect-sync` | Microsoft Entra Connect Sync | Microsoft Entra ID | https://learn.microsoft.com/en-us/entra/identity/hybrid/connect/whatis-azure-ad-connect |
| `azure-entra-verified-id` | Microsoft Entra Verified ID | not priced in calculator | https://learn.microsoft.com/en-us/entra/verified-id/decentralized-identifier-overview |
| `azure-entra-internet-access` | Microsoft Entra Internet Access | not priced in calculator (Entra Suite licence) | https://learn.microsoft.com/en-us/entra/global-secure-access/concept-internet-access |
| `azure-entra-private-access` | Microsoft Entra Private Access | not priced in calculator (Entra Suite licence) | https://learn.microsoft.com/en-us/entra/global-secure-access/concept-private-access |
| `azure-defender-for-iot` | Microsoft Defender for IoT | not priced in calculator | https://learn.microsoft.com/en-us/azure/defender-for-iot/organizations/overview |
| `azure-iot-dps` | Azure IoT Hub Device Provisioning Service | Azure IoT Hub | https://learn.microsoft.com/en-us/azure/iot-dps/about-iot-dps |
| `azure-device-update` | Device Update for IoT Hub | Azure IoT Hub | https://learn.microsoft.com/en-us/azure/iot-hub-device-update/understand-device-update |
| `azure-device-registry` | Azure Device Registry | Azure IoT Operations | https://learn.microsoft.com/en-us/azure/iot-operations/discover-manage-assets/overview-manage-assets |
| `azure-sphere` | Azure Sphere | not priced in calculator | https://learn.microsoft.com/en-us/azure-sphere/product-overview/what-is-azure-sphere |
| `azure-artifacts` | Azure Artifacts | Azure DevOps | https://learn.microsoft.com/en-us/azure/devops/artifacts/start-using-azure-artifacts |
| `azure-pipelines` | Azure Pipelines | Azure DevOps | https://learn.microsoft.com/en-us/azure/devops/pipelines/get-started/what-is-azure-pipelines |
| `azure-repos` | Azure Repos | Azure DevOps | https://learn.microsoft.com/en-us/azure/devops/repos/get-started/what-is-repos |
| `azure-managed-devops-pools` | Managed DevOps Pools | not priced as its own tile | https://learn.microsoft.com/en-us/azure/devops/managed-devops-pools/overview |
| `azure-deployment-environments` | Azure Deployment Environments | not priced (free; resources billed) | https://learn.microsoft.com/en-us/azure/deployment-environments/overview-what-is-azure-deployment-environments |
| `azure-dev-box` | Microsoft Dev Box | not priced in calculator | https://learn.microsoft.com/en-us/azure/dev-box/overview-what-is-microsoft-dev-box |
| `azure-playwright-testing` | Playwright Workspaces | Azure App Testing | https://learn.microsoft.com/en-us/azure/app-testing/playwright-workspaces/overview-what-is-microsoft-playwright-workspaces |
| `azure-kubernetes-fleet-manager` | Azure Kubernetes Fleet Manager | Azure Kubernetes Service (AKS) | https://learn.microsoft.com/en-us/azure/kubernetes-fleet/overview |
| `azure-local` | Azure Local | Azure Kubernetes Service on Azure Local (closest tile) | https://learn.microsoft.com/en-us/azure/azure-local/overview |
| `azure-stack-hub` | Azure Stack Hub | not priced in calculator | https://learn.microsoft.com/en-us/azure-stack/operator/azure-stack-overview |
| `azure-operator-nexus` | Azure Operator Nexus | not priced in calculator | https://learn.microsoft.com/en-us/azure/operator-nexus/overview |
| `azure-operator-service-manager` | Azure Operator Service Manager | not priced in calculator | https://learn.microsoft.com/en-us/azure/operator-service-manager/azure-operator-service-manager-overview |
| `azure-on-premises-data-gateway` | On-premises data gateway | not priced (free) | https://learn.microsoft.com/en-us/data-integration/gateway/service-gateway-onprem |
| `azure-oracle-database` | Oracle AI Database@Azure | Azure Marketplace, not the calculator | https://learn.microsoft.com/en-us/azure/oracle/oracle-db/database-overview |
| `azure-sql-managed-instance` | Azure SQL Managed Instance | Azure SQL Database tile (deployment option) | https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/sql-managed-instance-paas-overview |
| `azure-power-apps` | Microsoft Power Apps | Power Platform licensing, not the calculator | https://learn.microsoft.com/en-us/power-apps/powerapps-overview |

## 5. Inventory `skip` rows the calculator lists as a first-class product

34 calculator products map to a `skip` row.

| calculator name (en-in / en-us) | category | inventory row | current status | verdict |
|---|---|---|---|---|
| Azure Virtual Network Manager | Networking | Azure Virtual Network Manager | skip: central governance over existing VNets, not a topology node | **reconsider** (already in the inventory's own review list) |
| Azure Firewall Manager | Networking | Azure Firewall Manager | skip: policy manager over Azure Firewall instances | **reconsider** (already in the inventory's own review list) |
| Data Box / Azure Data Box | Storage, Migration | Azure Data Box | skip: physical offline transfer appliance | **reconsider**: drawn in migration diagrams; `azure-data-box-gateway` already exists as `edge-appliance` |
| Storage Accounts | Storage | Storage Accounts | skip: container resource; blob, queue, table, file services are the placed nodes | keep |
| Azure AI services / Foundry Tools | AI + Machine Learning | Azure AI services | skip: multi-service account | keep |
| Azure Cost Management and Billing / Microsoft Cost Management | Management and Governance, Migration | Microsoft Cost Management + Billing | skip: billing and cost tooling | keep |
| Cloud Services | Compute | Cloud Services (extended support) | skip: legacy PaaS | keep |
| Advanced Container Networking Services | Networking, Containers | same | skip: AKS add-on feature | keep |
| Azure Storage Actions | Networking, Storage | same | skip: storage management tooling | keep |
| Azure Storage Discovery | Storage | same | skip: reporting tool | keep |
| Azure SQL | Databases | Azure SQL (umbrella brand) | skip: brand | keep |
| Azure Open Datasets | AI + Machine Learning | same | skip: public dataset catalogue | keep |
| Azure SRE Agent | AI + ML, DevOps, Management | same | skip: operations assistant | keep |
| Windows 10 IoT Core Services | Internet of Things | same | skip: device OS | keep |
| Microsoft Security Copilot | Security | same | skip: assistant product | keep |
| Extended Security Updates (ESU) | Security | Extended Security Updates | skip: support and licensing programme | keep |
| Azure DevOps | Developer Tools, DevOps, Hybrid | Azure DevOps | skip: brand (Pipelines, Repos, Artifacts are components) | keep |
| GitHub Enterprise | Developer Tools, DevOps | GitHub Enterprise / Copilot / Advanced Security | skip: belongs in `default` | keep |
| Cloud Shell | Management and Governance | Azure Cloud Shell | skip: CLI environment | keep |
| Azure Managed Applications | Management and Governance | same | skip: packaging construct | keep |
| Azure Migrate | Management and Governance, Migration | same | skip: migration tooling | keep |
| Azure Lighthouse | Management and Governance | same | skip: delegation model | keep |
| Azure Resource Mover | Management and Governance | same | skip: move tooling | keep |
| Azure Communications Gateway | Networking | same | skip: retired 30 October 2025 | keep; calculator is stale (Learn overview: "will retire on October 30, 2025") |
| StorSimple | Storage | StorSimple Device Manager | skip: retired December 2022 | keep; calculator is stale |
| Azure Remote Rendering / Remote Rendering | Mobile, Mixed Reality | same | skip: retired 30 September 2025 | keep; calculator is stale |
| Azure Database for MariaDB | Databases | same | skip: retired September 2025 | keep; calculator is stale |
| Data Catalog | Analytics | Azure Data Catalog | skip: retired, superseded by Purview | keep; calculator is stale |
| Microsoft Genomics | AI + Machine Learning | same | skip: archived service | keep; calculator is stale |
| Machine Learning Studio (classic) | AI + ML, IoT | ML Studio (classic) workspaces | skip: retired 31 August 2024 | keep; calculator is stale |
| Azure Time Series Insights | Internet of Things | TSI environments | skip: retired 7 July 2024 | keep; calculator is stale |
| Azure SQL Edge | Internet of Things | same | skip: retired 30 September 2025 | keep; calculator is stale |
| Scheduler | Management and Governance | Azure Scheduler | skip: retired 31 January 2022 | keep; calculator is stale |
| Media Services | Media | Azure Media Services | skip: retired June 2024 | keep; calculator is stale |

Reconsider: 3. Keep: 31 (11 of them retired products the calculator still lists).

## 6. Icons

Contact sheet of the 20 worst Zeema-vs-official pairs at 48 px:
`scratchpad/azure-audit/icon-contact-sheet-worst20.png` (session scratch, not committed).

| result | count |
|---|---|
| identical to an official V24 file (diff < 0.015, fitting/precision noise only) | 185 |
| official V24 file exists but Zeema's drawing differs | 2 |
| deliberate redraw, documented (`icons/README.md`) | 1 |
| no V24 icon; Zeema uses non-pack artwork | 4 |
| no V24 icon; Zeema uses the generated kind glyph | 10 |
| **total** | **202** |

### 6a. Official icon differs

| Zeema id | official file (V24) | diff | note |
|---|---|---|---|
| `azure-entra-external-id` | `identity/03425-icon-service-external-id.svg` | 0.101 | different drawing (not a mirror: flipped diff 0.285). Also not `034251-…-external-id-modified.svg` (0.202) or `03338-…-External-Identities.svg` (0.263). Refresh |
| `azure-foundry-models` | `ai + machine learning/038470614-icon-service-Foundry-Models.svg` | 0.097 | different drawing (not a mirror: flipped diff 0.266). Refresh |

### 6b. Deliberate redraw

| Zeema id | nearest official | diff | note |
|---|---|---|---|
| `azure-monitor-data-collection-endpoint` | `other/02579-icon-service-Private-Endpoints.svg` | 0.027 | redrawn from the Azure portal glyph; documented in `icons/README.md` |

### 6c. No V24 icon, non-pack artwork

| Zeema id | nearest V24 file | diff | provenance recorded? |
|---|---|---|---|
| `azure-fabric` | none relevant | 0.185 | yes: Fluent product icon (`icons/README.md`) |
| `azure-entra-id` | `identity/10222-icon-service-Entra-Domain-Services.svg` | 0.077 | **no**: V24 has no Entra ID icon; Zeema's diamond matches the Entra Domain Services drawing without its badge. Record the source |
| `azure-purview` | `management + governance/10303-icon-service-User-Privacy.svg` | 0.150 | **no**: V24 has no Purview icon. Record the source |
| `azure-nutanix-cloud-clusters` | none relevant | 0.174 | **no**: uses a Nutanix mark (`#024DA1`). Record the source |

### 6d. Kind glyph in use; official icon search

The V24 file list was searched by product keyword for each. None has a dedicated icon (agrees with
`docs/icons-missing.md`).

| Zeema id | V24 dedicated icon | closest V24 candidate (not dedicated) |
|---|---|---|
| `azure-artifact-signing` | none | — |
| `azure-cyclecloud` | none | `other/02518-icon-service-Azure-HPC-Workbenches.svg` (weak) |
| `azure-energy-data-services` | none | — |
| `azure-fluid-relay` | none | — |
| `azure-graph-data-connect` | none | — |
| `azure-horizondb` | none | — |
| `azure-managed-lustre` | none | `storage/00776-icon-service-Azure-HCP-Cache.svg` (HPC Cache, the retired predecessor; weak) |
| `azure-quantum` | none | — |
| `azure-stack-edge` | none | `storage/00691-icon-service-Azure-Databox-Gateway.svg` (the Data Box Edge / Gateway family icon, already used by `azure-data-box-gateway`) |
| `azure-stack-hub` | none | — |

### 6e. Substitutes not recorded in `docs/icons-missing.md`

These are identical to an official file, but the file is a parent or family icon, not one drawn for
the product. `docs/icons-missing.md` "Substitutes used" lists only `azure-confidential-vm`,
`azure-device-registry`, `azure-file-sync`, `azure-monitor-data-collection-endpoint`,
`azure-monitor-workspace` and `azure-power-apps`.

| Zeema id | V24 file used |
|---|---|
| `azure-dsvm` | `10021-icon-service-Virtual-Machine.svg` |
| `azure-aks-edge-essentials` | `10023-icon-service-Kubernetes-Services.svg` |
| `azure-artifacts` | `10261-icon-service-Azure-DevOps.svg` |
| `azure-pipelines` | `10261-icon-service-Azure-DevOps.svg` |
| `azure-repos` | `10261-icon-service-Azure-DevOps.svg` |
| `azure-schema-registry` | `00039-icon-service-Event-Hubs.svg` |
| `azure-event-grid-mqtt` | `10206-icon-service-Event-Grid-Topics.svg` |
| `azure-durable-functions` | `10029-icon-service-Function-Apps.svg` |
| `azure-managed-hsm` | `10245-icon-service-Key-Vaults.svg` |
| `azure-cloud-hsm` | `02322-icon-service-Dedicated-HSM.svg` |
| `azure-health-bot` | `10165-icon-service-Bot-Services.svg` |
| `azure-content-understanding` | `035746832-icon-service-AI-Foundry.svg` |
| `azure-ml-endpoint` | `038470510-icon-service-Azure-Machine-Learning.svg` |
| `azure-multicloud-interconnect` | `10079-icon-service-ExpressRoute-Circuits.svg` |
| `azure-playwright-testing` | `033805167-icon-service-Azure-App-Testing.svg` |

`azure-conditional-access` renders identically to `security/10233-icon-service-Conditional-Access.svg`,
but its nearest file is the same drawing published as `intune/10339-icon-service-Exchange-Access.svg`.
If the fitting map points at the Exchange Access file, re-point it at the Conditional Access file (no
visual change).

### 6f. Identical icons (185)

| Zeema id | V24 file | diff |
|---|---|---|
| `azure-advisor` | `00003-icon-service-Advisor.svg` | 0.0001 |
| `azure-ai-content-safety` | `03390-icon-service-Content-Safety.svg` | 0.0007 |
| `azure-ai-custom-vision` | `00793-icon-service-Custom-Vision.svg` | 0.0011 |
| `azure-ai-face` | `00794-icon-service-Face-APIs.svg` | 0.0008 |
| `azure-ai-foundry` | `035746832-icon-service-AI-Foundry.svg` | 0.0002 |
| `azure-ai-language` | `02876-icon-service-Language.svg` | 0.0008 |
| `azure-ai-search` | `10044-icon-service-Cognitive-Search.svg` | 0.0001 |
| `azure-ai-speech` | `00797-icon-service-Speech-Services.svg` | 0.0004 |
| `azure-ai-translator` | `00800-icon-service-Translator-Text.svg` | 0.0007 |
| `azure-ai-vision` | `00792-icon-service-Computer-Vision.svg` | 0.0009 |
| `azure-aks` | `10023-icon-service-Kubernetes-Services.svg` | 0.0001 |
| `azure-aks-edge-essentials` | `10023-icon-service-Kubernetes-Services.svg` | 0.0001 |
| `azure-analysis-services` | `10148-icon-service-Analysis-Services.svg` | 0.0000 |
| `azure-api-center` | `03291-icon-service-API-Center.svg` | 0.0002 |
| `azure-api-management` | `10042-icon-service-API-Management-Services.svg` | 0.0001 |
| `azure-app-configuration` | `10219-icon-service-App-Configuration.svg` | 0.0000 |
| `azure-app-service` | `10035-icon-service-App-Services.svg` | 0.0001 |
| `azure-application-gateway` | `10076-icon-service-Application-Gateways.svg` | 0.0001 |
| `azure-application-gateway-for-containers` | `03328-icon-service-Application-Gateway-Containers.svg` | 0.0001 |
| `azure-application-insights` | `00012-icon-service-Application-Insights.svg` | 0.0000 |
| `azure-arc` | `00756-icon-service-Azure-Arc.svg` | 0.0007 |
| `azure-artifacts` | `10261-icon-service-Azure-DevOps.svg` | 0.0001 |
| `azure-attestation` | `10422-icon-service-AzureAttestation.svg` | 0.0018 |
| `azure-automation` | `00022-icon-service-Automation-Accounts.svg` | 0.0003 |
| `azure-backup` | `02360-icon-service-Azure-Backup-Center.svg` | 0.0010 |
| `azure-baremetal-infrastructure` | `02561-icon-service-Bare-Metal-Infrastructure.svg` | 0.0000 |
| `azure-bastion` | `02422-icon-service-Bastions.svg` | 0.0003 |
| `azure-batch` | `10031-icon-service-Batch-Accounts.svg` | 0.0000 |
| `azure-blob-storage` | `10086-icon-service-Storage-Accounts.svg` | 0.0000 |
| `azure-bot-service` | `10165-icon-service-Bot-Services.svg` | 0.0001 |
| `azure-cache-for-redis` | `10137-icon-service-Cache-Redis.svg` | 0.0000 |
| `azure-cdn` | `00056-icon-service-CDN-Profiles.svg` | 0.0000 |
| `azure-chaos-studio` | `02223-icon-service-Azure-Chaos-Studio.svg` | 0.0003 |
| `azure-cloud-hsm` | `02322-icon-service-Dedicated-HSM.svg` | 0.0004 |
| `azure-communication-services` | `00968-icon-service-Azure-Communication-Services.svg` | 0.0015 |
| `azure-compute-fleet` | `03487-icon-service-Compute-Fleet.svg` | 0.0027 |
| `azure-compute-gallery` | `02864-icon-service-Azure-Compute-Galleries.svg` | 0.0001 |
| `azure-conditional-access` | `10233-icon-service-Conditional-Access.svg` | 0.0000 |
| `azure-confidential-ledger` | `02668-icon-service-Confidential-Ledgers.svg` | 0.0006 |
| `azure-confidential-vm` | `10021-icon-service-Virtual-Machine.svg` | 0.0000 |
| `azure-connected-cache` | `02509-icon-service-Connected-Cache.svg` | 0.0000 |
| `azure-container-apps` | `02989-icon-service-Container-Apps-Environments.svg` | 0.0005 |
| `azure-container-instances` | `10104-icon-service-Container-Instances.svg` | 0.0000 |
| `azure-container-registry` | `10105-icon-service-Container-Registries.svg` | 0.0001 |
| `azure-container-storage` | `03401-icon-service-Azure-Container-Storage.svg` | 0.0012 |
| `azure-content-understanding` | `035746832-icon-service-AI-Foundry.svg` | 0.0002 |
| `azure-cosmos-db` | `10121-icon-service-Azure-Cosmos-DB.svg` | 0.0011 |
| `azure-data-box-gateway` | `00691-icon-service-Azure-Databox-Gateway.svg` | 0.0000 |
| `azure-data-explorer` | `10145-icon-service-Azure-Data-Explorer-Clusters.svg` | 0.0000 |
| `azure-data-factory` | `10126-icon-service-Data-Factories.svg` | 0.0000 |
| `azure-data-lake-storage` | `10150-icon-service-Data-Lake-Store-Gen1.svg` | 0.0000 |
| `azure-data-share` | `10098-icon-service-Data-Shares.svg` | 0.0000 |
| `azure-database-for-mysql` | `10122-icon-service-Azure-Database-MySQL-Server.svg` | 0.0000 |
| `azure-database-for-postgresql` | `10131-icon-service-Azure-Database-PostgreSQL-Server.svg` | 0.0001 |
| `azure-database-migration-service` | `10133-icon-service-Azure-Database-Migration-Services.svg` | 0.0001 |
| `azure-databricks` | `10787-icon-service-Azure-Databricks.svg` | 0.0015 |
| `azure-ddos-protection` | `10072-icon-service-DDoS-Protection-Plans.svg` | 0.0001 |
| `azure-dedicated-host` | `10347-icon-service-Hosts.svg` | 0.0001 |
| `azure-dedicated-hsm` | `02322-icon-service-Dedicated-HSM.svg` | 0.0004 |
| `azure-defender-easm` | `03336-icon-service-Microsoft-Defender-EASM.svg` | 0.0007 |
| `azure-defender-for-cloud` | `10241-icon-service-Microsoft-Defender-for-Cloud.svg` | 0.0004 |
| `azure-defender-for-iot` | `02247-icon-service-Microsoft-Defender-for-IoT.svg` | 0.0003 |
| `azure-deployment-environments` | `03251-icon-service-Azure-Deployment-Environments.svg` | 0.0006 |
| `azure-dev-box` | `03250-icon-service-Microsoft-Dev-Box.svg` | 0.0007 |
| `azure-device-registry` | `03485-icon-service-Azure-IoT-Operations.svg` | 0.0002 |
| `azure-device-update` | `02475-icon-service-Device-Update-IoT-Hub.svg` | 0.0002 |
| `azure-devtest-labs` | `10264-icon-service-DevTest-Labs.svg` | 0.0000 |
| `azure-digital-twins` | `01030-icon-service-Digital-Twins.svg` | 0.0006 |
| `azure-discovery` | `032869111-icon-service-Microsoft-Discovery.svg` | 0.0004 |
| `azure-dns` | `10064-icon-service-DNS-Zones.svg` | 0.0001 |
| `azure-dns-private-resolver` | `02882-icon-service-DNS-Private-Resolver.svg` | 0.0009 |
| `azure-document-intelligence` | `00819-icon-service-Form-Recognizers.svg` | 0.0004 |
| `azure-documentdb` | `035656437-icon-service-Azure-DocumentDB.svg` | 0.0001 |
| `azure-dsvm` | `10021-icon-service-Virtual-Machine.svg` | 0.0000 |
| `azure-durable-functions` | `10029-icon-service-Function-Apps.svg` | 0.0004 |
| `azure-elastic-san` | `03190-icon-service-Elastic-SAN.svg` | 0.0007 |
| `azure-enclave` | `03394-icon-service-Azure-Enclaves.svg` | 0.0020 |
| `azure-entra-connect-sync` | `03533-icon-service-Entra-Connect-Sync.svg` | 0.0001 |
| `azure-entra-domain-services` | `10222-icon-service-Entra-Domain-Services.svg` | 0.0004 |
| `azure-entra-internet-access` | `03383-icon-service-Entra-Internet-Access.svg` | 0.0002 |
| `azure-entra-private-access` | `03382-icon-service-Entra-Private-Access.svg` | 0.0001 |
| `azure-entra-verified-id` | `03143-icon-service-Entra-Verified-ID.svg` | 0.0006 |
| `azure-event-grid` | `10206-icon-service-Event-Grid-Topics.svg` | 0.0000 |
| `azure-event-grid-mqtt` | `10206-icon-service-Event-Grid-Topics.svg` | 0.0000 |
| `azure-event-hubs` | `00039-icon-service-Event-Hubs.svg` | 0.0000 |
| `azure-expressroute` | `10079-icon-service-ExpressRoute-Circuits.svg` | 0.0001 |
| `azure-file-sync` | `10093-icon-service-Storage-Sync-Services.svg` | 0.0001 |
| `azure-files` | `10801-icon-service-Files.svg` | 0.0005 |
| `azure-firewall` | `10084-icon-service-Firewalls.svg` | 0.0000 |
| `azure-foundry-agent-service` | `038470523-icon-service-Foundry-Agent-Service.svg` | 0.0001 |
| `azure-foundry-iq` | `038470497-icon-service-Azure-AI-Foundry-IQ.svg` | 0.0001 |
| `azure-front-door` | `10073-icon-service-Front-Door-and-CDN-Profiles.svg` | 0.0001 |
| `azure-functions` | `10029-icon-service-Function-Apps.svg` | 0.0004 |
| `azure-hdinsight` | `10142-icon-service-HD-Insight-Clusters.svg` | 0.0000 |
| `azure-health-bot` | `10165-icon-service-Bot-Services.svg` | 0.0001 |
| `azure-health-data-services` | `02658-icon-service-FHIR-Service.svg` | 0.0007 |
| `azure-immersive-reader` | `00812-icon-service-Immersive-Readers.svg` | 0.0004 |
| `azure-iot-central` | `10184-icon-service-IoT-Central-Applications.svg` | 0.0001 |
| `azure-iot-dps` | `10369-icon-service-Device-Provisioning-Services.svg` | 0.0001 |
| `azure-iot-edge` | `10186-icon-service-IoT-Edge.svg` | 0.0036 |
| `azure-iot-hub` | `10182-icon-service-IoT-Hub.svg` | 0.0001 |
| `azure-iot-operations` | `03485-icon-service-Azure-IoT-Operations.svg` | 0.0012 |
| `azure-key-vault` | `10245-icon-service-Key-Vaults.svg` | 0.0001 |
| `azure-kubernetes-fleet-manager` | `03134-icon-service-Kubernetes-Fleet-Manager.svg` | 0.0024 |
| `azure-lab-services` | `10265-icon-service-Lab-Services.svg` | 0.0000 |
| `azure-load-balancer` | `10062-icon-service-Load-Balancers.svg` | 0.0000 |
| `azure-load-testing` | `02423-icon-service-Load-Testing.svg` | 0.0015 |
| `azure-local` | `033745116-icon-service-Azure-Local.svg` | 0.0004 |
| `azure-log-analytics` | `00009-icon-service-Log-Analytics-Workspaces.svg` | 0.0001 |
| `azure-logic-apps` | `02631-icon-service-Logic-Apps.svg` | 0.0001 |
| `azure-machine-learning` | `038470510-icon-service-Azure-Machine-Learning.svg` | 0.0001 |
| `azure-managed-cassandra` | `02663-icon-service-Managed-Instance-Apache-Cassandra.svg` | 0.0011 |
| `azure-managed-devops-pools` | `03393-icon-service-Managed-DevOps-Pools.svg` | 0.0019 |
| `azure-managed-disk` | `10032-icon-service-Disks.svg` | 0.0006 |
| `azure-managed-grafana` | `02905-icon-service-Azure-Managed-Grafana.svg` | 0.0004 |
| `azure-managed-hsm` | `10245-icon-service-Key-Vaults.svg` | 0.0001 |
| `azure-managed-identity` | `10227-icon-service-Managed-Identities.svg` | 0.0000 |
| `azure-managed-prometheus` | `033112809-icon-service-promethus.svg` | 0.0002 |
| `azure-managed-redis` | `03675-icon-service-Azure-Managed-Redis.svg` | 0.0018 |
| `azure-maps` | `10185-icon-service-Azure-Maps-Accounts.svg` | 0.0004 |
| `azure-ml-endpoint` | `038470510-icon-service-Azure-Machine-Learning.svg` | 0.0001 |
| `azure-monitor` | `00001-icon-service-Monitor.svg` | 0.0001 |
| `azure-monitor-data-collection-rule` | `01857-icon-service-Data-Collection-Rules.svg` | 0.0001 |
| `azure-monitor-for-sap` | `00438-icon-service-Azure-Monitors-for-SAP-Solutions.svg` | 0.0000 |
| `azure-monitor-workspace` | `00001-icon-service-Monitor.svg` | 0.0001 |
| `azure-multicloud-interconnect` | `10079-icon-service-ExpressRoute-Circuits.svg` | 0.0001 |
| `azure-nat-gateway` | `10310-icon-service-NAT.svg` | 0.0071 |
| `azure-netapp-files` | `10096-icon-service-Azure-NetApp-Files.svg` | 0.0000 |
| `azure-network-interface` | `10080-icon-service-Network-Interfaces.svg` | 0.0000 |
| `azure-network-security-group` | `10067-icon-service-Network-Security-Groups.svg` | 0.0001 |
| `azure-network-security-perimeter` | `02939-icon-service-Network-Security-Perimeters.svg` | 0.0008 |
| `azure-network-watcher` | `10066-icon-service-Network-Watcher.svg` | 0.0001 |
| `azure-notification-hubs` | `10045-icon-service-Notification-Hubs.svg` | 0.0000 |
| `azure-on-premises-data-gateway` | `10070-icon-service-On-Premises-Data-Gateways.svg` | 0.0001 |
| `azure-openai` | `03438-icon-service-Azure-OpenAI.svg` | 0.0006 |
| `azure-operator-nexus` | `03324-icon-service-Azure-Operator-Nexus.svg` | 0.0013 |
| `azure-operator-service-manager` | `03334-icon-service-Azure-Operator-Service-Manager.svg` | 0.0021 |
| `azure-oracle-database` | `03490-icon-service-Oracle-Database.svg` | 0.0003 |
| `azure-peering-service` | `00970-icon-service-Peering-Service.svg` | 0.0007 |
| `azure-pipelines` | `10261-icon-service-Azure-DevOps.svg` | 0.0001 |
| `azure-planetary-computer` | `03755-icon-service-Planetary-Computer-Pro.svg` | 0.0020 |
| `azure-playwright-testing` | `033805167-icon-service-Azure-App-Testing.svg` | 0.0015 |
| `azure-policy` | `10316-icon-service-Policy.svg` | 0.0001 |
| `azure-power-apps` | `03335-icon-service-Power-Platform.svg` | 0.0006 |
| `azure-power-bi-embedded` | `03332-icon-service-Power-BI-Embedded.svg` | 0.0002 |
| `azure-private-dns` | `10064-icon-service-DNS-Zones.svg` | 0.0001 |
| `azure-private-link` | `00427-icon-service-Private-Link.svg` | 0.0027 |
| `azure-privileged-identity-management` | `02251-icon-service-Entra-Privleged-Identity-Management.svg` | 0.0001 |
| `azure-public-ip` | `10069-icon-service-Public-IP-Addresses.svg` | 0.0000 |
| `azure-queue-storage` | `10840-icon-service-Storage-Queue.svg` | 0.0003 |
| `azure-red-hat-openshift` | `03331-icon-service-Azure-Red-Hat-OpenShift.svg` | 0.0007 |
| `azure-relay` | `10209-icon-service-Relays.svg` | 0.0001 |
| `azure-repos` | `10261-icon-service-Azure-DevOps.svg` | 0.0001 |
| `azure-route-server` | `02496-icon-service-Virtual-Router.svg` | 0.0007 |
| `azure-schema-registry` | `00039-icon-service-Event-Hubs.svg` | 0.0000 |
| `azure-sentinel` | `10248-icon-service-Azure-Sentinel.svg` | 0.0000 |
| `azure-service-bus` | `10836-icon-service-Azure-Service-Bus.svg` | 0.0006 |
| `azure-service-fabric` | `10036-icon-service-Service-Fabric-Clusters.svg` | 0.0004 |
| `azure-signalr` | `10052-icon-service-SignalR.svg` | 0.0001 |
| `azure-site-recovery` | `00017-icon-service-Recovery-Services-Vaults.svg` | 0.0001 |
| `azure-sphere` | `10190-icon-service-Azure-Sphere.svg` | 0.0007 |
| `azure-spot-vm` | `02695-icon-service-Spot-VM.svg` | 0.0104 |
| `azure-spring-apps` | `10370-icon-service-Azure-Spring-Apps.svg` | 0.0019 |
| `azure-sql` | `10130-icon-service-SQL-Database.svg` | 0.0001 |
| `azure-sql-managed-instance` | `10136-icon-service-SQL-Managed-Instance.svg` | 0.0001 |
| `azure-sql-server-vm` | `10124-icon-service-Azure-SQL-VM.svg` | 0.0001 |
| `azure-static-web-apps` | `01007-icon-service-Static-Apps.svg` | 0.0008 |
| `azure-storage-mover` | `03091-icon-service-Azure-Storage-Mover.svg` | 0.0005 |
| `azure-stream-analytics` | `00042-icon-service-Stream-Analytics-Jobs.svg` | 0.0001 |
| `azure-subnet` | `02742-icon-service-Subnet.svg` | 0.0000 |
| `azure-synapse` | `00606-icon-service-Azure-Synapse-Analytics.svg` | 0.0002 |
| `azure-table-storage` | `10841-icon-service-Table.svg` | 0.0005 |
| `azure-traffic-manager` | `10065-icon-service-Traffic-Manager-Profiles.svg` | 0.0005 |
| `azure-update-manager` | `02846-icon-service-Update-Management-Center.svg` | 0.0011 |
| `azure-video-indexer` | `01800-icon-service-Azure-Video-Indexer.svg` | 0.0006 |
| `azure-virtual-desktop` | `00327-icon-service-Azure-Virtual-Desktop.svg` | 0.0005 |
| `azure-virtual-machine` | `10021-icon-service-Virtual-Machine.svg` | 0.0000 |
| `azure-virtual-network` | `10061-icon-service-Virtual-Networks.svg` | 0.0000 |
| `azure-virtual-wan` | `10353-icon-service-Virtual-WANs.svg` | 0.0011 |
| `azure-vm-image-builder` | `02634-icon-service-Image-Templates.svg` | 0.0008 |
| `azure-vm-scale-set` | `10034-icon-service-VM-Scale-Sets.svg` | 0.0002 |
| `azure-vmware-solution` | `01219-icon-service-Azure-VMware-Solution.svg` | 0.0006 |
| `azure-vpn-gateway` | `10063-icon-service-Virtual-Network-Gateways.svg` | 0.0000 |
| `azure-web-application-firewall` | `10362-icon-service-Web-Application-Firewall-Policies(WAF).svg` | 0.0140 |
| `azure-web-pubsub` | `02987-icon-service-pubsub.svg` | 0.0000 |

## 7. Recommended change list

### 7a. Renames (locale only): 1 recommended, 3 optional

| Zeema id | from | to | strength |
|---|---|---|---|
| `azure-health-bot` | Health Bot | Healthcare agent service | recommended |
| `azure-document-intelligence` | Azure Document Intelligence | Azure Document Intelligence in Foundry Tools | optional |
| `azure-content-understanding` | Azure Content Understanding | Azure Content Understanding in Foundry Tools | optional |
| `azure-aks` | Azure Kubernetes Service | Azure Kubernetes Service (AKS) | optional |

### 7b. Icon refreshes: 2, plus 4 provenance fixes

| Zeema id | action |
|---|---|
| `azure-entra-external-id` | refit from `identity/03425-icon-service-external-id.svg` |
| `azure-foundry-models` | refit from `ai + machine learning/038470614-icon-service-Foundry-Models.svg` |
| `azure-entra-id`, `azure-purview`, `azure-nutanix-cloud-clusters` | record the artwork source in `icons/README.md` (only `azure-fabric` is recorded today) |
| `azure-conditional-access` | point the source at `security/10233-icon-service-Conditional-Access.svg` (identical drawing) |

Also: add the 15 rows of section 6e to "Substitutes used" in `docs/icons-missing.md`.

### 7c. New components: 0

### 7d. Inventory updates: 6 edits, 3 reconsiderations, 1 review

| change | detail |
|---|---|
| add row | Bandwidth: `skip: data-transfer billing line, not a resource` |
| add row | Microsoft Defender ISOC: `skip: security-operations solution offering, not a deployable resource` |
| add "covered under another name" row | Azure Kubernetes Service on Azure Local (calculator `aks-hci`): `azure-aks` on `azure-local` |
| add "covered under another name" row | Azure Active Directory B2C: `azure-entra-external-id` (now prose only) |
| remove duplicate row | second `azure-monitor-data-collection-rule` `done` row |
| remove duplicate row | second `azure-privileged-identity-management` `done` row (then the 692/202 count line matches the table) |
| reconsider skip | Azure Virtual Network Manager, Azure Firewall Manager, Azure Data Box (calculator lists all three as first-class) |
| review | `azure-ai-search` vs `azure-foundry-iq`: the en-us calculator now titles the AI Search tile "Foundry IQ" |

## Not verified

- The calculator does not say which products are retired; "calculator is stale" in section 5 relies on the inventory's retirement notes. Only Azure Communications Gateway was re-checked on Microsoft Learn for this audit.
- Section 4's "priced under" column is from product documentation and pricing-page knowledge, not from the calculator's internal offer data (`/api/v2/pricing/.../calculator/` per-product offers were not fetched).
- Icon comparison is raster (48 px, bounding-box fitted). It does not detect colour-only changes below about 1 % mean difference.
- The V24 zip was the owner's existing download; the learn page still links V24, so it is current as of the audit date.
