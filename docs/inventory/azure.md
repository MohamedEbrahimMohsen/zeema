# Azure inventory

Official product directory: <https://azure.microsoft.com/en-us/products/> and the Azure
documentation service index <https://learn.microsoft.com/en-us/azure/>. Families below use
Microsoft's own directory headings. One row per resource a designer places; composite
services are split into their placeable sub-resources.

Status: `done` = component exists in `components/azure/`. `todo` = to be written.
`skip: <reason>` = cannot be a node in a design.

---

## Compute

| resource | id | kind | status | source |
|---|---|---|---|---|
| Virtual Machines | azure-virtual-machine | virtual-machine | done | https://learn.microsoft.com/en-us/azure/virtual-machines/overview |
| Virtual Machine Scale Sets | azure-vm-scale-set | virtual-machine | done | https://learn.microsoft.com/en-us/azure/virtual-machine-scale-sets/overview |
| Azure Spot Virtual Machines | azure-spot-vm | virtual-machine | done | https://learn.microsoft.com/en-us/azure/virtual-machines/spot-vms |
| Azure Dedicated Host | azure-dedicated-host | virtual-machine | done | https://learn.microsoft.com/en-us/azure/virtual-machines/dedicated-hosts |
| Azure Compute Fleet | azure-compute-fleet | virtual-machine | done | https://learn.microsoft.com/en-us/azure/azure-compute-fleet/overview |
| SQL Server on Azure Virtual Machines | azure-sql-server-vm | sql-database | done | https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/sql-server-on-azure-vm-iaas-what-is-overview |
| Data Science Virtual Machines | azure-dsvm | virtual-machine | done | https://learn.microsoft.com/en-us/azure/machine-learning/data-science-virtual-machine/overview |
| Azure VMware Solution | azure-vmware-solution | virtual-machine | done | https://learn.microsoft.com/en-us/azure/azure-vmware/introduction |
| Nutanix Cloud Clusters on Azure | azure-nutanix-cloud-clusters | virtual-machine | done | https://learn.microsoft.com/en-us/azure/nutanix/about-nc2-on-azure |
| App Service | azure-app-service | app-server | done | https://learn.microsoft.com/en-us/azure/app-service/overview |
| Azure Functions | azure-functions | app-server | done | https://learn.microsoft.com/en-us/azure/azure-functions/functions-overview |
| Azure Spring Apps | azure-spring-apps | app-server | done | https://learn.microsoft.com/en-us/azure/spring-apps/basic-standard/overview |
| Static Web Apps | azure-static-web-apps | cdn | done | https://learn.microsoft.com/en-us/azure/static-web-apps/plans |
| Batch | azure-batch | worker | done | https://learn.microsoft.com/en-us/azure/batch/batch-technical-overview |
| Azure CycleCloud | azure-cyclecloud | big-data-cluster | done | https://learn.microsoft.com/en-us/azure/cyclecloud/overview |
| Azure Virtual Desktop | azure-virtual-desktop | virtual-desktop | done | https://learn.microsoft.com/en-us/azure/virtual-desktop/overview |
| Azure VM Image Builder | azure-vm-image-builder | ci-pipeline | done | https://learn.microsoft.com/en-us/azure/virtual-machines/image-builder-overview |
| Azure Quantum | azure-quantum | third-party-api | done | https://learn.microsoft.com/en-us/azure/quantum/overview-azure-quantum |
| Cloud Services (extended support) | — | — | skip: legacy PaaS, superseded by App Service and VMSS | https://learn.microsoft.com/en-us/azure/cloud-services-extended-support/overview |
| Azure Linux | — | — | skip: operating system distribution, not a resource | https://learn.microsoft.com/en-us/azure/azure-linux/intro-azure-linux |
| Windows Server | — | — | skip: operating system, not an Azure resource | https://learn.microsoft.com/en-us/windows-server/ |

## Containers

| resource | id | kind | status | source |
|---|---|---|---|---|
| Azure Kubernetes Service (AKS) | azure-aks | container-orchestrator | done | https://learn.microsoft.com/en-us/azure/aks/what-is-aks |
| Azure Red Hat OpenShift | azure-red-hat-openshift | container-orchestrator | done | https://learn.microsoft.com/en-us/azure/openshift/intro-openshift |
| Azure Kubernetes Fleet Manager | azure-kubernetes-fleet-manager | container-orchestrator | done | https://learn.microsoft.com/en-us/azure/kubernetes-fleet/overview |
| Azure Service Fabric | azure-service-fabric | container-orchestrator | done | https://learn.microsoft.com/en-us/azure/service-fabric/service-fabric-overview |
| Azure Container Apps | azure-container-apps | app-server | done | https://learn.microsoft.com/en-us/azure/container-apps/overview |
| Azure Container Instances | azure-container-instances | app-server | done | https://learn.microsoft.com/en-us/azure/container-instances/container-instances-overview |
| Azure Container Registry | azure-container-registry | container-registry | done | https://learn.microsoft.com/en-us/azure/container-registry/container-registry-intro |
| Azure Container Storage | azure-container-storage | block-storage | done | https://learn.microsoft.com/en-us/azure/storage/container-storage/container-storage-introduction |
| Web App for Containers | — | — | skip: hosting option of App Service, same resource | https://learn.microsoft.com/en-us/azure/app-service/quickstart-custom-container |
| Advanced Container Networking Services | — | — | skip: AKS add-on feature, not a separate node | https://learn.microsoft.com/en-us/azure/aks/advanced-container-networking-services-overview |

## Storage

| resource | id | kind | status | source |
|---|---|---|---|---|
| Azure Blob Storage | azure-blob-storage | object-store | done | https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blobs-introduction |
| Azure Data Lake Storage Gen2 | azure-data-lake-storage | object-store | done | https://learn.microsoft.com/en-us/azure/storage/blobs/data-lake-storage-introduction |
| Queue Storage | azure-queue-storage | queue | done | https://learn.microsoft.com/en-us/azure/storage/queues/storage-queues-introduction |
| Table Storage | azure-table-storage | nosql-database | done | https://learn.microsoft.com/en-us/azure/storage/tables/table-storage-overview |
| Azure Files | azure-files | file-storage | done | https://learn.microsoft.com/en-us/azure/storage/files/storage-files-introduction |
| Azure NetApp Files | azure-netapp-files | file-storage | done | https://learn.microsoft.com/en-us/azure/azure-netapp-files/azure-netapp-files-introduction |
| Azure Managed Lustre | azure-managed-lustre | file-storage | done | https://learn.microsoft.com/en-us/azure/azure-managed-lustre/amlfs-overview |
| Azure Disk Storage (Managed Disks) | azure-managed-disk | block-storage | done | https://learn.microsoft.com/en-us/azure/virtual-machines/managed-disks-overview |
| Azure Elastic SAN | azure-elastic-san | block-storage | done | https://learn.microsoft.com/en-us/azure/storage/elastic-san/elastic-san-introduction |
| Azure Backup | azure-backup | backup-service | done | https://learn.microsoft.com/en-us/azure/backup/backup-overview |
| Azure Storage Mover | azure-storage-mover | worker | done | https://learn.microsoft.com/en-us/azure/storage-mover/service-overview |
| Azure Data Share | azure-data-share | worker | done | https://learn.microsoft.com/en-us/azure/data-share/overview |
| Storage Accounts | — | — | skip: container resource; its blob, queue, table and file services are the placed nodes | https://learn.microsoft.com/en-us/azure/storage/common/storage-account-overview |
| Archive Storage | — | — | skip: access tier of Blob Storage, not a separate resource | https://learn.microsoft.com/en-us/azure/storage/blobs/access-tiers-overview |
| Azure Data Box | — | — | skip: physical offline transfer appliance | https://learn.microsoft.com/en-us/azure/databox/data-box-overview |
| Azure Storage Actions | — | — | skip: storage management tooling, not a node | https://learn.microsoft.com/en-us/azure/storage-actions/overview |
| Azure Storage Discovery | — | — | skip: reporting tool over existing accounts | https://learn.microsoft.com/en-us/azure/storage-discovery/overview |
| Storage Explorer | — | — | skip: desktop client tool | https://learn.microsoft.com/en-us/azure/vs-azure-tools-storage-manage-with-storage-explorer |

## Databases

| resource | id | kind | status | source |
|---|---|---|---|---|
| Azure SQL Database | azure-sql | sql-database | done | https://learn.microsoft.com/en-us/azure/azure-sql/database/sql-database-paas-overview |
| Azure SQL Managed Instance | azure-sql-managed-instance | sql-database | done | https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/sql-managed-instance-paas-overview |
| Azure Database for PostgreSQL | azure-database-for-postgresql | sql-database | done | https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/service-overview |
| Azure Database for MySQL | azure-database-for-mysql | sql-database | done | https://learn.microsoft.com/en-us/azure/mysql/flexible-server/overview |
| Azure HorizonDB | azure-horizondb | sql-database | done | https://learn.microsoft.com/en-us/azure/horizondb/overview |
| Azure Cosmos DB | azure-cosmos-db | nosql-database | done | https://learn.microsoft.com/en-us/azure/cosmos-db/introduction |
| Azure DocumentDB | azure-documentdb | nosql-database | done | https://learn.microsoft.com/en-us/azure/documentdb/overview |
| Azure Managed Instance for Apache Cassandra | azure-managed-cassandra | nosql-database | done | https://learn.microsoft.com/en-us/azure/managed-instance-apache-cassandra/introduction |
| Azure Cache for Redis | azure-cache-for-redis | cache | done | https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-overview |
| Azure Managed Redis | azure-managed-redis | cache | done | https://learn.microsoft.com/en-us/azure/redis/overview |
| Azure Data Explorer | azure-data-explorer | timeseries-database | done | https://learn.microsoft.com/en-us/azure/data-explorer/data-explorer-overview |
| Azure confidential ledger | azure-confidential-ledger | ledger | done | https://learn.microsoft.com/en-us/azure/confidential-ledger/overview |
| Azure Database Migration Service | azure-database-migration-service | worker | done | https://learn.microsoft.com/en-us/azure/dms/dms-overview |
| Azure SQL (umbrella brand) | — | — | skip: brand covering Database, Managed Instance and SQL Server on VMs | https://learn.microsoft.com/en-us/azure/azure-sql/azure-sql-iaas-vs-paas-what-is-overview |
| Azure Database for MariaDB | — | — | skip: retired September 2025 | https://learn.microsoft.com/en-us/azure/mariadb/whats-happening-to-mariadb |

Cosmos DB is one row: the NoSQL, MongoDB, Cassandra, Gremlin and Table APIs are an account
property, not separate nodes. The Gremlin API is the only one a designer might draw as a
graph store; it is covered by a component property rather than a second component.

## Networking A — foundation and connectivity

| resource | id | kind | status | source |
|---|---|---|---|---|
| Azure Virtual Network | azure-virtual-network | network-fabric | done | https://learn.microsoft.com/en-us/azure/virtual-network/virtual-networks-overview |
| Network Security Group | azure-network-security-group | firewall | done | https://learn.microsoft.com/en-us/azure/virtual-network/network-security-groups-overview |
| Public IP address | azure-public-ip | network-fabric | done | https://learn.microsoft.com/en-us/azure/virtual-network/ip-services/public-ip-addresses |
| Azure Private Link / Private Endpoint | azure-private-link | private-link | done | https://learn.microsoft.com/en-us/azure/private-link/private-link-overview |
| Azure DNS (public zone) | azure-dns | dns | done | https://learn.microsoft.com/en-us/azure/dns/dns-overview |
| Azure Private DNS | azure-private-dns | dns | done | https://learn.microsoft.com/en-us/azure/dns/private-dns-overview |
| Azure DNS Private Resolver | azure-dns-private-resolver | dns | done | https://learn.microsoft.com/en-us/azure/dns/dns-private-resolver-overview |
| Azure Bastion | azure-bastion | bastion-host | done | https://learn.microsoft.com/en-us/azure/bastion/bastion-overview |
| Azure Route Server | azure-route-server | network-fabric | done | https://learn.microsoft.com/en-us/azure/route-server/overview |
| Azure NAT Gateway | azure-nat-gateway | nat-gateway | done | https://learn.microsoft.com/en-us/azure/nat-gateway/nat-overview |
| Azure VPN Gateway | azure-vpn-gateway | vpn-gateway | done | https://learn.microsoft.com/en-us/azure/vpn-gateway/vpn-gateway-about-vpngateways |
| Azure ExpressRoute | azure-expressroute | network-fabric | done | https://learn.microsoft.com/en-us/azure/expressroute/expressroute-introduction |
| Azure Virtual WAN | azure-virtual-wan | network-fabric | done | https://learn.microsoft.com/en-us/azure/virtual-wan/virtual-wan-about |
| Azure Peering Service | azure-peering-service | network-fabric | done | https://learn.microsoft.com/en-us/azure/peering-service/about |
| Azure Enclave | azure-enclave | network-fabric | done | https://learn.microsoft.com/en-us/azure/enclave/what-azure-enclave |
| Azure Multicloud Interconnect | azure-multicloud-interconnect | network-fabric | done | https://learn.microsoft.com/en-us/azure/multicloud-interconnect/faq |
| Azure Virtual Network Manager | — | — | skip: central governance over existing VNets, not a topology node | https://learn.microsoft.com/en-us/azure/virtual-network-manager/overview |
| Azure Network Function Manager | — | — | skip: deployment tooling for partner network functions | https://learn.microsoft.com/en-us/azure/network-function-manager/overview |

## Networking B — delivery, security and monitoring

| resource | id | kind | status | source |
|---|---|---|---|---|
| Azure Load Balancer | azure-load-balancer | load-balancer | done | https://learn.microsoft.com/en-us/azure/load-balancer/load-balancer-overview |
| Azure Application Gateway | azure-application-gateway | load-balancer | done | https://learn.microsoft.com/en-us/azure/application-gateway/overview |
| Azure Front Door | azure-front-door | cdn | done | https://learn.microsoft.com/en-us/azure/frontdoor/front-door-overview |
| Azure Traffic Manager | azure-traffic-manager | dns | done | https://learn.microsoft.com/en-us/azure/traffic-manager/traffic-manager-overview |
| Azure Content Delivery Network | azure-cdn | cdn | done | https://learn.microsoft.com/en-us/azure/cdn/cdn-overview |
| Azure Firewall | azure-firewall | firewall | done | https://learn.microsoft.com/en-us/azure/firewall/overview |
| Azure Web Application Firewall | azure-web-application-firewall | waf | done | https://learn.microsoft.com/en-us/azure/web-application-firewall/overview |
| Azure DDoS Protection | azure-ddos-protection | ddos-protection | done | https://learn.microsoft.com/en-us/azure/ddos-protection/ddos-protection-overview |
| Azure Network Watcher | azure-network-watcher | monitoring | done | https://learn.microsoft.com/en-us/azure/network-watcher/network-watcher-overview |
| Azure Firewall Manager | — | — | skip: policy manager over Azure Firewall instances | https://learn.microsoft.com/en-us/azure/firewall-manager/overview |

## Integration

| resource | id | kind | status | source |
|---|---|---|---|---|
| Azure Service Bus | azure-service-bus | queue | done | https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-messaging-overview |
| Event Grid (topic / system topic) | azure-event-grid | pubsub-topic | done | https://learn.microsoft.com/en-us/azure/event-grid/overview |
| Event Grid MQTT broker (namespace) | azure-event-grid-mqtt | pubsub-topic | done | https://learn.microsoft.com/en-us/azure/event-grid/mqtt-overview |
| Event Hubs | azure-event-hubs | stream | done | https://learn.microsoft.com/en-us/azure/event-hubs/event-hubs-about |
| Event Hubs Schema Registry | azure-schema-registry | schema-registry | done | https://learn.microsoft.com/en-us/azure/event-hubs/schema-registry-overview |
| Logic Apps | azure-logic-apps | workflow-engine | done | https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-overview |
| Durable Functions | azure-durable-functions | workflow-engine | done | https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview |
| API Management | azure-api-management | api-gateway | done | https://learn.microsoft.com/en-us/azure/api-management/api-management-key-concepts |
| Azure Relay | azure-relay | network-fabric | done | https://learn.microsoft.com/en-us/azure/azure-relay/relay-what-is-it |
| Azure Web PubSub | azure-web-pubsub | realtime-gateway | done | https://learn.microsoft.com/en-us/azure/azure-web-pubsub/overview |
| Azure SignalR Service | azure-signalr | realtime-gateway | done | https://learn.microsoft.com/en-us/azure/azure-signalr/signalr-overview |
| Azure Fluid Relay | azure-fluid-relay | realtime-gateway | done | https://learn.microsoft.com/en-us/azure/azure-fluid-relay/overview/overview |
| Notification Hubs | azure-notification-hubs | notification-service | done | https://learn.microsoft.com/en-us/azure/notification-hubs/notification-hubs-push-notification-overview |
| Azure Communication Services | azure-communication-services | notification-service | done | https://learn.microsoft.com/en-us/azure/communication-services/overview |
| Azure Data Factory | azure-data-factory | worker | done | https://learn.microsoft.com/en-us/azure/data-factory/introduction |
| Azure Health Data Services (FHIR / DICOM) | azure-health-data-services | nosql-database | done | https://learn.microsoft.com/en-us/azure/healthcare-apis/healthcare-apis-overview |
| Microsoft Energy Data Services | azure-energy-data-services | third-party-api | done | https://learn.microsoft.com/en-us/azure/energy-data-services/overview-microsoft-energy-data-services |
| Azure Data Manager for Agriculture | azure-data-manager-agriculture | third-party-api | skip: retired 1 Sep 2025 | https://learn.microsoft.com/en-us/azure/data-manager-for-agri/overview-azure-data-manager-for-agriculture |
| Azure API for FHIR | — | — | skip: superseded by Azure Health Data Services | https://learn.microsoft.com/en-us/azure/healthcare-apis/azure-api-for-fhir/overview |

## AI + machine learning

| resource | id | kind | status | source |
|---|---|---|---|---|
| Azure OpenAI in Foundry Models | azure-openai | ai-service | done | https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/default-safety-policies |
| Microsoft Foundry (AI Foundry project) | azure-ai-foundry | ml-platform | done | https://learn.microsoft.com/en-us/azure/ai-foundry/what-is-azure-ai-foundry |
| Foundry Models | azure-foundry-models | ai-service | done | https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/concepts/models-from-partners |
| Foundry Agent Service | azure-foundry-agent-service | ai-service | done | https://learn.microsoft.com/en-us/azure/ai-foundry/agents/overview |
| Foundry IQ (knowledge / retrieval) | azure-foundry-iq | search-index | done | https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/what-is-foundry-iq |
| Azure AI Search | azure-ai-search | search-index | done | https://learn.microsoft.com/en-us/azure/search/search-what-is-azure-search |
| Azure Machine Learning (workspace) | azure-machine-learning | ml-platform | done | https://learn.microsoft.com/en-us/azure/machine-learning/overview-what-is-azure-machine-learning |
| Azure Machine Learning online endpoint | azure-ml-endpoint | ml-inference | done | https://learn.microsoft.com/en-us/azure/machine-learning/concept-endpoints-online |
| Azure Speech | azure-ai-speech | ai-service | done | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-services-quotas-and-limits |
| Azure Vision | azure-ai-vision | ai-service | done | https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-image-analysis |
| Azure AI Custom Vision | azure-ai-custom-vision | ai-service | done | https://learn.microsoft.com/en-us/azure/ai-services/custom-vision-service/limits-and-quotas |
| Azure AI Face | azure-ai-face | ai-service | done | https://learn.microsoft.com/en-us/azure/ai-services/face/overview-identity |
| Azure Language | azure-ai-language | ai-service | done | https://learn.microsoft.com/en-us/azure/ai-services/language-service/concepts/data-limits |
| Azure Translator | azure-ai-translator | ai-service | done | https://learn.microsoft.com/en-us/azure/ai-services/translator/service-limits |
| Azure Document Intelligence | azure-document-intelligence | ai-service | done | https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/service-limits |
| Azure Content Understanding | azure-content-understanding | ai-service | done | https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/overview |
| Content Safety | azure-ai-content-safety | ai-service | done | https://learn.microsoft.com/en-us/azure/ai-services/content-safety/overview |
| AI Anomaly Detector | — | — | skip: retiring 1 October 2026, no new resources since 20 September 2023 | https://learn.microsoft.com/en-us/azure/ai-services/anomaly-detector/overview |
| Azure AI Immersive Reader | azure-immersive-reader | ai-service | done | https://learn.microsoft.com/en-us/azure/ai-services/immersive-reader/overview |
| Azure AI Video Indexer | azure-video-indexer | ai-service | done | https://learn.microsoft.com/en-us/azure/azure-video-indexer/video-indexer-overview |
| Azure AI Bot Service | azure-bot-service | app-server | done | https://learn.microsoft.com/en-us/azure/bot-service/bot-overview?view=azure-bot-service-4.0 |
| Health Bot | azure-health-bot | app-server | done | https://learn.microsoft.com/en-us/azure/health-bot/overview |
| Microsoft Planetary Computer Pro | azure-planetary-computer | object-store | done | https://learn.microsoft.com/en-us/azure/planetary-computer/microsoft-planetary-computer-pro-overview |
| Observability in Foundry Control Plane | — | — | skip: observability view over Foundry projects, use Azure Monitor | https://learn.microsoft.com/en-us/azure/ai-foundry/ |
| Foundry Control Plane | — | — | skip: management plane over Foundry resources | https://learn.microsoft.com/en-us/azure/ai-foundry/ |
| Foundry Tools | — | — | skip: umbrella brand for the AI services listed above | https://learn.microsoft.com/en-us/azure/ai-services/ |
| Azure AI Metrics Advisor | — | — | skip: retiring October 2026 | https://learn.microsoft.com/en-us/azure/ai-services/metrics-advisor/overview |
| Azure AI Personalizer | — | — | skip: retiring October 2026 | https://learn.microsoft.com/en-us/azure/ai-services/personalizer/what-is-personalizer |
| Phi open models | — | — | skip: model family, deployed through Foundry Models | https://learn.microsoft.com/en-us/azure/ai-foundry/ |
| Azure Open Datasets | — | — | skip: public dataset catalog, not a deployable resource | https://learn.microsoft.com/en-us/azure/open-datasets/overview-what-are-open-datasets |
| Microsoft Security Copilot | — | — | skip: assistant product, not a node | https://learn.microsoft.com/en-us/copilot/security/microsoft-security-copilot |
| Azure SRE Agent | — | — | skip: operations assistant, not a node | https://learn.microsoft.com/en-us/azure/sre-agent/overview |

## Analytics

| resource | id | kind | status | source |
|---|---|---|---|---|
| Azure Synapse Analytics | azure-synapse | data-warehouse | done | https://learn.microsoft.com/en-us/azure/synapse-analytics/overview-what-is |
| Microsoft Fabric | azure-fabric | data-warehouse | done | https://learn.microsoft.com/en-us/fabric/fundamentals/microsoft-fabric-overview |
| Azure Databricks | azure-databricks | big-data-cluster | done | https://learn.microsoft.com/en-us/azure/databricks/introduction/ |
| HDInsight | azure-hdinsight | big-data-cluster | done | https://learn.microsoft.com/en-us/azure/hdinsight/hdinsight-overview |
| Azure Stream Analytics | azure-stream-analytics | stream-processor | done | https://learn.microsoft.com/en-us/azure/stream-analytics/stream-analytics-introduction |
| Azure Analysis Services | azure-analysis-services | data-warehouse | done | https://learn.microsoft.com/en-us/azure/analysis-services/analysis-services-overview |
| Power BI Embedded | azure-power-bi-embedded | bi-service | done | https://learn.microsoft.com/en-us/power-bi/developer/embedded/embedded-analytics-power-bi |
| Microsoft Purview | azure-purview | data-catalog | done | https://learn.microsoft.com/en-us/purview/purview |
| Microsoft Graph Data Connect | azure-graph-data-connect | worker | done | https://learn.microsoft.com/en-us/graph/data-connect-concept-overview |
| Data Catalog (classic) | — | — | skip: retired, superseded by Microsoft Purview | https://learn.microsoft.com/en-us/azure/data-catalog/overview |
| Data Lake Analytics | — | — | skip: retired February 2024 | https://learn.microsoft.com/en-us/azure/data-lake-analytics/data-lake-analytics-overview |
| Power BI (SaaS service) | — | — | skip: Microsoft 365 SaaS product, not an Azure resource | https://learn.microsoft.com/en-us/power-bi/fundamentals/power-bi-overview |

## Identity

| resource | id | kind | status | source |
|---|---|---|---|---|
| Microsoft Entra ID | azure-entra-id | identity-provider | done | https://learn.microsoft.com/en-us/entra/fundamentals/whatis |
| Microsoft Entra External ID | azure-entra-external-id | identity-provider | done | https://learn.microsoft.com/en-us/entra/external-id/external-identities-overview |
| Microsoft Entra Domain Services | azure-entra-domain-services | identity-provider | done | https://learn.microsoft.com/en-us/entra/identity/domain-services/administration-concepts |
| Microsoft Entra Verified ID | azure-entra-verified-id | identity-provider | done | https://learn.microsoft.com/en-us/entra/verified-id/decentralized-identifier-overview |
| Managed identities for Azure resources | azure-managed-identity | identity-provider | done | https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview |

Azure AD B2C is folded into the Entra External ID row; it is the legacy name of the same
customer-identity offering and is no longer sold to new tenants.

## Security

| resource | id | kind | status | source |
|---|---|---|---|---|
| Azure Key Vault | azure-key-vault | key-management | done | https://learn.microsoft.com/en-us/azure/key-vault/general/overview |
| Azure Key Vault Managed HSM | azure-managed-hsm | key-management | done | https://learn.microsoft.com/en-us/azure/key-vault/managed-hsm/overview |
| Azure Cloud HSM | azure-cloud-hsm | key-management | done | https://learn.microsoft.com/en-us/azure/cloud-hsm/overview |
| Azure Dedicated HSM | azure-dedicated-hsm | key-management | done | https://learn.microsoft.com/en-us/azure/dedicated-hsm/overview |
| Artifact Signing (Trusted Signing) | azure-artifact-signing | key-management | done | https://learn.microsoft.com/en-us/azure/artifact-signing/overview |
| Microsoft Azure Attestation | azure-attestation | identity-provider | done | https://learn.microsoft.com/en-us/azure/attestation/overview |
| Microsoft Defender for Cloud | azure-defender-for-cloud | monitoring | done | https://learn.microsoft.com/en-us/azure/defender-for-cloud/defender-for-cloud-introduction |
| Microsoft Sentinel | azure-sentinel | monitoring | done | https://learn.microsoft.com/en-us/azure/sentinel/overview |
| Microsoft Defender for IoT | azure-defender-for-iot | monitoring | done | https://learn.microsoft.com/en-us/azure/defender-for-iot/organizations/overview |
| Defender External Attack Surface Management | azure-defender-easm | monitoring | done | https://learn.microsoft.com/en-us/azure/external-attack-surface-management/what-is-discovery |
| Azure Information Protection | — | — | skip: labeling and classification policy, applied to data not drawn as a node | https://learn.microsoft.com/en-us/azure/information-protection/what-is-information-protection |

## Management and governance

| resource | id | kind | status | source |
|---|---|---|---|---|
| Azure Monitor | azure-monitor | monitoring | done | https://learn.microsoft.com/en-us/azure/azure-monitor/overview |
| Log Analytics workspace | azure-log-analytics | monitoring | done | https://learn.microsoft.com/en-us/azure/azure-monitor/logs/log-analytics-workspace-overview |
| Application Insights | azure-application-insights | monitoring | done | https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview |
| Azure Managed Grafana | azure-managed-grafana | monitoring | done | https://learn.microsoft.com/en-us/azure/managed-grafana/overview |
| Azure Advisor | azure-advisor | monitoring | done | https://learn.microsoft.com/en-us/azure/advisor/advisor-overview |
| Automation | azure-automation | worker | done | https://learn.microsoft.com/en-us/azure/automation/overview |
| Azure Update Manager | azure-update-manager | worker | done | https://learn.microsoft.com/en-us/azure/update-manager/overview |
| Azure Chaos Studio | azure-chaos-studio | worker | done | https://learn.microsoft.com/en-us/azure/chaos-studio/chaos-studio-overview |
| Azure Site Recovery | azure-site-recovery | backup-service | done | https://learn.microsoft.com/en-us/azure/site-recovery/site-recovery-overview |
| Azure Policy | azure-policy | policy-engine | done | https://learn.microsoft.com/en-us/azure/governance/policy/overview |
| Azure Arc | azure-arc | coordination-service | done | https://learn.microsoft.com/en-us/azure/azure-arc/overview |
| Azure Blueprints | — | — | skip: deprecated, superseded by template specs and deployment stacks | https://learn.microsoft.com/en-us/azure/governance/blueprints/overview |
| Azure Lighthouse | — | — | skip: cross-tenant delegation model, not a resource | https://learn.microsoft.com/en-us/azure/lighthouse/overview |
| Azure Managed Applications | — | — | skip: packaging construct for publishing offers | https://learn.microsoft.com/en-us/azure/azure-resource-manager/managed-applications/overview |
| Azure Resource Manager / ARM templates | — | — | skip: deployment control plane | https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/overview |
| Azure Automanage | — | — | skip: configuration profile applied to VMs | https://learn.microsoft.com/en-us/azure/automanage/overview-about |
| Azure Service Health | — | — | skip: platform status dashboard | https://learn.microsoft.com/en-us/azure/service-health/overview |
| Microsoft Cost Management | — | — | skip: billing and cost tooling | https://learn.microsoft.com/en-us/azure/cost-management-billing/ |
| Microsoft Azure portal | — | — | skip: portal | https://learn.microsoft.com/en-us/azure/azure-portal/azure-portal-overview |
| Azure Cloud Shell | — | — | skip: CLI environment | https://learn.microsoft.com/en-us/azure/cloud-shell/overview |
| Azure Copilot | — | — | skip: assistant, not a node | https://learn.microsoft.com/en-us/azure/copilot/overview |

## Developer tools and DevOps

| resource | id | kind | status | source |
|---|---|---|---|---|
| App Configuration | azure-app-configuration | feature-flag-service | done | https://learn.microsoft.com/en-us/azure/azure-app-configuration/overview |
| Azure Pipelines | azure-pipelines | ci-pipeline | done | https://learn.microsoft.com/en-us/azure/devops/pipelines/get-started/what-is-azure-pipelines |
| Azure Repos | azure-repos | artifact-repository | done | https://learn.microsoft.com/en-us/azure/devops/repos/get-started/what-is-repos |
| Azure Artifacts | azure-artifacts | artifact-repository | done | https://learn.microsoft.com/en-us/azure/devops/artifacts/start-using-azure-artifacts |
| Azure Deployment Environments | azure-deployment-environments | ci-pipeline | done | https://learn.microsoft.com/en-us/azure/deployment-environments/overview-what-is-azure-deployment-environments |
| Microsoft Dev Box | azure-dev-box | virtual-desktop | done | https://learn.microsoft.com/en-us/azure/dev-box/overview-what-is-microsoft-dev-box |
| Azure DevTest Labs | azure-devtest-labs | virtual-desktop | done | https://learn.microsoft.com/en-us/azure/devtest-labs/devtest-lab-overview |
| Azure Lab Services | azure-lab-services | virtual-desktop | done | https://learn.microsoft.com/en-us/azure/lab-services/lab-services-overview |
| Azure App Testing (Load Testing) | azure-load-testing | client | done | https://learn.microsoft.com/en-us/azure/app-testing/load-testing/overview-what-is-azure-load-testing |
| Microsoft Playwright Testing | azure-playwright-testing | client | done | https://learn.microsoft.com/en-us/azure/app-testing/playwright-workspaces/overview-what-is-microsoft-playwright-workspaces |
| Azure DevOps (umbrella) | — | — | skip: brand covering Pipelines, Repos, Artifacts, Boards, Test Plans | https://learn.microsoft.com/en-us/azure/devops/user-guide/what-is-azure-devops |
| Azure Boards | — | — | skip: work tracking, not part of a runtime architecture | https://learn.microsoft.com/en-us/azure/devops/boards/get-started/what-is-azure-boards |
| Azure Test Plans | — | — | skip: manual test management | https://learn.microsoft.com/en-us/azure/devops/test/overview |
| Visual Studio / VS Code / SDKs | — | — | skip: developer tooling | https://learn.microsoft.com/en-us/visualstudio/ |
| GitHub Enterprise / Copilot / Advanced Security | — | — | skip: GitHub products; belong in the `default` provider | https://docs.github.com/en/enterprise-cloud@latest |

## Internet of Things

| resource | id | kind | status | source |
|---|---|---|---|---|
| Azure IoT Hub | azure-iot-hub | iot-hub | done | https://learn.microsoft.com/en-us/azure/iot-hub/iot-concepts-and-iot-hub |
| Azure IoT Hub Device Provisioning Service | azure-iot-dps | identity-provider | done | https://learn.microsoft.com/en-us/azure/iot-dps/about-iot-dps |
| Azure IoT Central | azure-iot-central | iot-hub | done | https://learn.microsoft.com/en-us/azure/iot-central/core/overview-iot-central |
| Azure IoT Operations | azure-iot-operations | edge-appliance | done | https://learn.microsoft.com/en-us/azure/iot-operations/overview-iot-operations |
| Azure IoT Edge | azure-iot-edge | edge-appliance | done | https://learn.microsoft.com/en-us/azure/iot-edge/about-iot-edge |
| Azure Digital Twins | azure-digital-twins | graph-database | done | https://learn.microsoft.com/en-us/azure/digital-twins/overview |
| Azure Sphere | azure-sphere | client | done | https://learn.microsoft.com/en-us/azure-sphere/product-overview/what-is-azure-sphere |
| Windows for IoT | — | — | skip: device operating system | https://learn.microsoft.com/en-us/windows/iot/ |

## Hybrid, edge and migration

| resource | id | kind | status | source |
|---|---|---|---|---|
| Azure Local | azure-local | edge-appliance | done | https://learn.microsoft.com/en-us/azure/azure-local/overview |
| Azure Stack Hub | azure-stack-hub | edge-appliance | done | https://learn.microsoft.com/en-us/azure-stack/operator/azure-stack-overview |
| Azure Stack Edge | azure-stack-edge | edge-appliance | done | https://learn.microsoft.com/en-us/azure/databox-online/azure-stack-edge-gpu-overview |
| AKS Edge Essentials | azure-aks-edge-essentials | edge-appliance | done | https://learn.microsoft.com/en-us/azure/aks-hybrid-edge/edge-essentials/aks-edge-overview |
| Azure Operator Nexus | azure-operator-nexus | edge-appliance | done | https://learn.microsoft.com/en-us/azure/operator-nexus/overview |
| Azure Operator Service Manager | azure-operator-service-manager | ci-pipeline | done | https://learn.microsoft.com/en-us/azure/operator-service-manager/azure-operator-service-manager-overview |
| Azure Migrate | — | — | skip: assessment and migration tooling | https://learn.microsoft.com/en-us/azure/migrate/migrate-services-overview |
| Azure Resource Mover | — | — | skip: move operation tooling | https://learn.microsoft.com/en-us/azure/resource-mover/overview |

## Media and web

| resource | id | kind | status | source |
|---|---|---|---|---|
| Azure Maps | azure-maps | third-party-api | done | https://learn.microsoft.com/en-us/azure/azure-maps/azure-maps-authentication |
| Azure Media Services | — | — | skip: retired June 2024 | https://learn.microsoft.com/en-us/azure/media-services/latest/azure-media-services-retirement |
| Encoding / Live and On-Demand Streaming / Content Protection | — | — | skip: features of the retired Media Services | https://learn.microsoft.com/en-us/azure/media-services/latest/azure-media-services-retirement |
| Azure Media Player | — | — | skip: client-side player library | https://learn.microsoft.com/en-us/azure/media-services/azure-media-player/azure-media-player-overview |
| Visual Studio App Center | — | — | skip: retired March 2025 | https://learn.microsoft.com/en-us/appcenter/retirement |

---

## Kind proposals

| NEW id | why no existing kind fits |
|---|---|
| virtual-machine | A VM carries size, OS image, availability zone, disk attachment and scaling-set membership; `app-server` describes a runtime process, not a leased machine a rule must check for zone spread or public IP exposure. |
| container-orchestrator | A cluster owns node pools, a control-plane version, a network plugin and RBAC; no existing kind holds cluster-level properties that upgrade or node-pool rules could read. |
| container-registry | An image registry has replication regions, admin-user and public-network flags and a retention policy. `object-store` cannot express image tags or the pull relationship. |
| block-storage | A disk attaches to exactly one machine and carries IOPS, encryption-at-host and redundancy. `object-store` has no attachment semantics and no per-volume IOPS. |
| file-storage | A shared filesystem is mounted by many machines over SMB/NFS with a quota and a protocol. Neither `object-store` nor the proposed `block-storage` describes multi-attach mount points. |
| firewall | A stateful packet filter has rule collections, a default action and a direction. `load-balancer` distributes traffic; nothing existing carries allow/deny rules a policy check could read. |
| waf | A layer-7 rule engine has a managed rule set version and a prevention/detection mode, both of which rules check directly; `firewall` operates on addresses and ports, not request bodies. |
| vpn-gateway | An encrypted tunnel endpoint carries a gateway SKU, tunnel type, BGP setting and on-premises peer. `network-fabric` describes a connectivity plane, not a terminating gateway. |
| nat-gateway | Outbound-only source translation with a static IP set and idle-timeout; `load-balancer` is inbound and `network-fabric` has no address-translation property. |
| private-link | A private endpoint pins a PaaS service into a subnet with a DNS zone and an approval state; this is a relationship node no existing kind models. |
| bastion-host | A jump host has a SKU, session recording, native-client and port-forwarding flags that access rules read; `app-server` has no session or protocol properties. |
| ddos-protection | A protection plan attaches to virtual networks and IPs with a tier and telemetry, not to traffic paths; it is a policy attachment `firewall` cannot express. |
| backup-service | A vault has a retention schedule, redundancy setting, soft-delete window and protected-item set. No existing kind carries a recovery-point objective a rule could check. |
| ci-pipeline | A build/deploy pipeline has triggers, agent pools and environments and connects source to artifacts. `worker` runs application workloads; a pipeline is delivery, not runtime. |
| artifact-repository | A package feed or source repository has upstream sources, retention, visibility and branch protection; `object-store` has no package or version semantics. `artifactType` distinguishes package, source and generic. |
| policy-engine | A policy assignment has an enforcement mode, scope and effect (deny/audit/deployIfNotExists); this is governance, not `monitoring` which only observes. |
| ai-service | A managed model or cognitive endpoint has a model/deployment name, a quota in tokens or transactions, content filtering and a data-residency setting. `ml-inference` describes a self-deployed model endpoint with replicas and instance type, none of which apply to a consumption API. |
| ml-platform | A training workspace owns compute targets, datasets, a model registry and experiment runs; `ml-inference` is only the serving endpoint that a workspace produces. |
| big-data-cluster | A Spark/Hadoop/HPC cluster has worker node counts, autoscale bounds, a runtime version and job submission; `worker` is a single job runner and `data-warehouse` is query-only storage. |
| data-catalog | A catalog scans other resources and holds classifications, lineage and glossary terms. `search-index` searches documents a designer supplies; a catalog indexes the architecture itself. |
| iot-hub | A device gateway carries a device registry, per-device identity, twin state, tier throughput in messages/day and multiple device protocols. `stream` has partitions and retention but no device identity, and `pubsub-topic` has no device twin. |
| edge-appliance | An on-premises or edge cluster runs Azure services outside a region, with an Arc connection, an offline mode and local storage. Every existing kind assumes a cloud region. |
| virtual-desktop | A desktop pool has session hosts, a load-balancing mode, a max-sessions limit and a user assignment model; `virtual-machine` describes one machine, not a brokered pool. |
| bi-service | A BI capacity has a capacity SKU, refresh schedule, row-level security and embedded reports; `data-warehouse` stores the data these reports read but has no report or refresh properties. |

## Counts

total 228, todo 0, done 174, skip 54.
