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
| Azure Compute Gallery | azure-compute-gallery | artifact-repository | done | https://learn.microsoft.com/en-us/azure/virtual-machines/azure-compute-gallery |
| Azure BareMetal Infrastructure | azure-baremetal-infrastructure | virtual-machine | done | https://learn.microsoft.com/en-us/azure/azure-large-instances/work-with-azure-large-instances-in-azure-portal |

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
| Azure File Sync | azure-file-sync | file-storage | done | https://learn.microsoft.com/en-us/azure/storage/file-sync/file-sync-introduction |

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
| Oracle AI Database@Azure | azure-oracle-database | sql-database | done | https://learn.microsoft.com/en-us/azure/oracle/oracle-db/database-overview |

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
| Network interface | azure-network-interface | network-fabric | done | https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-network-interface |
| Subnet | azure-subnet | network-fabric | done | https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-manage-subnet |

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
| Application Gateway for Containers | azure-application-gateway-for-containers | load-balancer | done | https://learn.microsoft.com/en-us/azure/application-gateway/for-containers/overview |
| Microsoft Connected Cache | azure-connected-cache | cdn | done | https://learn.microsoft.com/en-us/windows/deployment/do/waas-microsoft-connected-cache |
| Azure Communications Gateway | — | — | skip: retired 30 October 2025, documentation archived | https://learn.microsoft.com/en-us/previous-versions/azure/communications-gateway/overview |

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
| Azure API Center | azure-api-center | data-catalog | done | https://learn.microsoft.com/en-us/azure/api-center/overview |
| Azure Programmable Connectivity | — | — | skip: documentation retired, learn.microsoft.com redirects the doc set to a marketing page | https://learn.microsoft.com/en-us/azure/programmable-connectivity/azure-programmable-connectivity-overview |

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
| Microsoft Discovery | azure-discovery | ai-service | done | https://learn.microsoft.com/en-us/azure/microsoft-discovery/overview-what-is-microsoft-discovery |

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
| Azure Operator Insights | — | — | skip: documentation retired, learn.microsoft.com redirects the doc set to a marketing page | https://learn.microsoft.com/en-us/azure/operator-insights/overview |

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
| Conditional Access | azure-conditional-access | policy-engine | done | https://learn.microsoft.com/en-us/entra/identity/conditional-access/overview |
| Microsoft Entra Connect Sync | azure-entra-connect-sync | worker | done | https://learn.microsoft.com/en-us/entra/identity/hybrid/connect/whatis-azure-ad-connect |
| Microsoft Entra Internet Access | azure-entra-internet-access | firewall | done | https://learn.microsoft.com/en-us/entra/global-secure-access/concept-internet-access |
| Microsoft Entra Private Access | azure-entra-private-access | bastion-host | done | https://learn.microsoft.com/en-us/entra/global-secure-access/concept-private-access |

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
| Network security perimeter | azure-network-security-perimeter | firewall | done | https://learn.microsoft.com/en-us/azure/private-link/network-security-perimeter-concepts |

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
| Azure Monitor for SAP solutions | azure-monitor-for-sap | monitoring | done | https://learn.microsoft.com/en-us/azure/sap/monitor/about-azure-monitor-sap-solutions |
| Azure Monitor managed service for Prometheus | azure-managed-prometheus | monitoring | done | https://learn.microsoft.com/en-us/azure/azure-monitor/metrics/prometheus-metrics-overview |
| Azure Monitor workspace | azure-monitor-workspace | timeseries-database | done | https://learn.microsoft.com/en-us/azure/azure-monitor/metrics/azure-monitor-workspace-overview |
| Data collection endpoint [^dcr] | azure-monitor-data-collection-endpoint | monitoring | done | https://learn.microsoft.com/en-us/azure/azure-monitor/data-collection/data-collection-endpoint-overview |
| Data collection rule [^dcr] | azure-monitor-data-collection-rule | monitoring | done | https://learn.microsoft.com/en-us/azure/azure-monitor/data-collection/data-collection-rule-overview |

[^dcr]: Data collection rules were `skip: Configuration object of Azure Monitor, not a node.` in the
mingrammer pass. The skip was reversed on request: Azure Monitor architecture diagrams draw the
agent to DCR to destination path, so users expect to place both the rule and the endpoint. The
mingrammer row now points here.

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
| Managed DevOps Pools | azure-managed-devops-pools | ci-pipeline | done | https://learn.microsoft.com/en-us/azure/devops/managed-devops-pools/overview |

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
| Device Update for IoT Hub | azure-device-update | iot-hub | done | https://learn.microsoft.com/en-us/azure/iot-hub-device-update/understand-device-update |
| Azure Device Registry | azure-device-registry | coordination-service | done | https://learn.microsoft.com/en-us/azure/iot-operations/discover-manage-assets/overview-manage-assets |

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
| Azure Data Box Gateway | azure-data-box-gateway | edge-appliance | done | https://learn.microsoft.com/en-us/azure/databox-gateway/data-box-gateway-overview |
| On-premises data gateway | azure-on-premises-data-gateway | edge-appliance | done | https://learn.microsoft.com/en-us/data-integration/gateway/service-gateway-onprem |
| Azure Operator 5G Core | — | — | skip: documentation retired, learn.microsoft.com redirects the doc set to a marketing page | https://learn.microsoft.com/en-us/azure/operator-5g-core/overview-product |

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

## Mingrammer nodes not catalogued

| resource | id | kind | status | source |
|---|---|---|---|---|
| Azure Applied AI Services | — | — | skip: umbrella brand over the applied AI services, not a single resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Experimentation Studio | — | — | skip: not a shipping Azure product; experimentation is a feature of App Configuration | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Object Understanding | — | — | skip: object understanding of Azure Object Anchors, retired 2024 | https://diagrams.mingrammer.com/docs/nodes/azure |
| Batch AI | — | — | skip: retired March 2019, superseded by Azure Machine Learning compute | https://diagrams.mingrammer.com/docs/nodes/azure |
| Project Bonsai | — | — | skip: retired, machine-teaching preview with no replacement service | https://diagrams.mingrammer.com/docs/nodes/azure |
| Cognitive Services Decisions | — | — | skip: category icon for the Decision family of Azure AI services | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure AI services (Cognitive Services) | — | — | skip: umbrella multi-service account over the individual Azure AI services | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure AI Content Moderator | — | — | skip: deprecated February 2024, superseded by Azure AI Content Safety | https://diagrams.mingrammer.com/docs/nodes/azure |
| Microsoft Genomics account | — | — | skip: account object of the archived Microsoft Genomics service | https://diagrams.mingrammer.com/docs/nodes/azure |
| Microsoft Genomics | — | — | skip: archived service, no longer in the Azure product directory | https://diagrams.mingrammer.com/docs/nodes/azure |
| Language Understanding (LUIS) | — | — | skip: retired 1 October 2025, superseded by conversational language understanding in Azure Language | https://diagrams.mingrammer.com/docs/nodes/azure |
| Machine Learning Studio (classic) web services | — | — | skip: Machine Learning Studio (classic) retired 31 August 2024 | https://diagrams.mingrammer.com/docs/nodes/azure |
| Machine Learning Studio (classic) web service plans | — | — | skip: billing plan of the retired Machine Learning Studio (classic) | https://diagrams.mingrammer.com/docs/nodes/azure |
| Machine Learning Studio (classic) workspaces | — | — | skip: Machine Learning Studio (classic) retired 31 August 2024 | https://diagrams.mingrammer.com/docs/nodes/azure |
| QnA Maker | — | — | skip: retired 31 March 2025, superseded by custom question answering in Azure Language | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Workbooks | — | — | skip: visualization artifact inside Azure Monitor, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Data Lake Storage Gen1 | — | — | skip: retired 29 February 2024, superseded by Data Lake Storage Gen2 | https://diagrams.mingrammer.com/docs/nodes/azure |
| Endpoint analytics | — | — | skip: Microsoft Intune reporting feature, not an Azure resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Event Hubs dedicated cluster | — | — | skip: dedicated capacity tier of Event Hubs, same resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Microsoft Power Platform | — | — | skip: suite brand over Power Apps, Power Automate and Power BI; the app builder is catalogued as azure-power-apps | https://diagrams.mingrammer.com/docs/nodes/azure |
| App Service Certificates | — | — | skip: TLS certificate asset bound to App Service, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| App Service Domains | — | — | skip: domain name registration, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| App Service Environment | — | — | skip: network-isolated deployment mode of App Service; a boundary, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| App Service plan | — | — | skip: compute capacity container for App Service apps, not a separate node | https://diagrams.mingrammer.com/docs/nodes/azure |
| AppLens | — | — | skip: Microsoft-internal diagnostics tool, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Hybrid Center | — | — | skip: portal experience for hybrid services, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Collaborative Service | — | — | skip: generic ecosystem icon, not a product | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Stack Hub capacity | — | — | skip: operator administration view, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Stack Hub Infrastructure Backup | — | — | skip: operator backup of the Azure Stack Hub infrastructure itself | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Stack Hub multi-tenancy | — | — | skip: tenancy concept, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Stack Hub offers | — | — | skip: billing offer construct, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Stack Hub plans | — | — | skip: billing plan construct, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Stack Hub updates | — | — | skip: update management view, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Stack Hub user subscriptions | — | — | skip: subscription and account construct, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Blockchain Service member | — | — | skip: Azure Blockchain Service retired 10 September 2021 | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Blockchain Service | — | — | skip: retired 10 September 2021 | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Blockchain Tokens | — | — | skip: preview of the retired Azure Blockchain Service | https://diagrams.mingrammer.com/docs/nodes/azure |
| Blockchain Applications | — | — | skip: category icon, retired with Azure Blockchain Service | https://diagrams.mingrammer.com/docs/nodes/azure |
| Blockchain consortium | — | — | skip: consortium concept of the retired Azure Blockchain Service | https://diagrams.mingrammer.com/docs/nodes/azure |
| Outbound connection | — | — | skip: connection concept icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| AKS Automatic | — | — | skip: managed operating mode of Azure Kubernetes Service, same resource as azure-aks | https://diagrams.mingrammer.com/docs/nodes/azure |
| Application group | — | — | skip: grouping inside an Azure Virtual Desktop host pool | https://diagrams.mingrammer.com/docs/nodes/azure |
| Availability set | — | — | skip: placement construct for VM fault and update domains | https://diagrams.mingrammer.com/docs/nodes/azure |
| Cloud Services (classic) | — | — | skip: legacy PaaS, superseded by App Service and VMSS | https://diagrams.mingrammer.com/docs/nodes/azure |
| CloudSimple virtual machines | — | — | skip: CloudSimple retired, superseded by Azure VMware Solution | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Container Service | — | — | skip: retired 31 January 2020, superseded by AKS | https://diagrams.mingrammer.com/docs/nodes/azure |
| Disk encryption set | — | — | skip: encryption configuration object for managed disks | https://diagrams.mingrammer.com/docs/nodes/azure |
| Disk snapshot | — | — | skip: backup artifact of a disk | https://diagrams.mingrammer.com/docs/nodes/azure |
| Disks (classic) | — | — | skip: classic unmanaged disk, superseded by managed disks | https://diagrams.mingrammer.com/docs/nodes/azure |
| Disk snapshots | — | — | skip: duplicate of disk snapshot, a backup artifact | https://diagrams.mingrammer.com/docs/nodes/azure |
| Dedicated host group | — | — | skip: placement group for dedicated hosts | https://diagrams.mingrammer.com/docs/nodes/azure |
| Image definition | — | — | skip: definition object inside an Azure Compute Gallery | https://diagrams.mingrammer.com/docs/nodes/azure |
| Image template | — | — | skip: build template of Azure VM Image Builder | https://diagrams.mingrammer.com/docs/nodes/azure |
| Image version | — | — | skip: image artifact inside an Azure Compute Gallery | https://diagrams.mingrammer.com/docs/nodes/azure |
| Managed image | — | — | skip: VM image artifact, not a placeable node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Maintenance configuration | — | — | skip: maintenance schedule configuration object | https://diagrams.mingrammer.com/docs/nodes/azure |
| Service Fabric Mesh | — | — | skip: retired 28 April 2021 | https://diagrams.mingrammer.com/docs/nodes/azure |
| OS images (classic) | — | — | skip: classic deployment model OS image artifact | https://diagrams.mingrammer.com/docs/nodes/azure |
| OS images | — | — | skip: VM OS image artifact, not a placeable node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Restore point collection | — | — | skip: container for VM restore points, a backup artifact | https://diagrams.mingrammer.com/docs/nodes/azure |
| Restore point | — | — | skip: backup artifact of a VM | https://diagrams.mingrammer.com/docs/nodes/azure |
| SAP HANA on Azure Large Instances | — | — | skip: decommissioned, service ends 31 December 2025; migrate to Azure VMs | https://diagrams.mingrammer.com/docs/nodes/azure |
| Shared Image Gallery | — | — | skip: former name of Azure Compute Gallery, an image artifact repository | https://diagrams.mingrammer.com/docs/nodes/azure |
| Virtual machines (classic) | — | — | skip: classic deployment model VMs retired 1 September 2023 | https://diagrams.mingrammer.com/docs/nodes/azure |
| Virtual machine (classic) | — | — | skip: classic deployment model VM retired 1 September 2023 | https://diagrams.mingrammer.com/docs/nodes/azure |
| VM images (classic) | — | — | skip: classic VM image artifact, not a placeable node | https://diagrams.mingrammer.com/docs/nodes/azure |
| VM images | — | — | skip: VM image artifact, not a placeable node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Virtual Desktop workspace | — | — | skip: duplicate icon of the Azure Virtual Desktop workspace | https://diagrams.mingrammer.com/docs/nodes/azure |
| SQL elastic pool | — | — | skip: capacity pool shared by Azure SQL databases, not a separate resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Elastic Job agent | — | — | skip: job scheduling feature of Azure SQL Database | https://diagrams.mingrammer.com/docs/nodes/azure |
| SQL instance pool | — | — | skip: capacity pool for Azure SQL Managed Instances | https://diagrams.mingrammer.com/docs/nodes/azure |
| Managed database | — | — | skip: a database inside an Azure SQL Managed Instance | https://diagrams.mingrammer.com/docs/nodes/azure |
| SQL Data Warehouse | — | — | skip: renamed Azure Synapse Analytics dedicated SQL pool | https://diagrams.mingrammer.com/docs/nodes/azure |
| SQL Server Stretch Database | — | — | skip: deprecated SQL Server feature, not a placeable Azure resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| SSIS integration runtime | — | — | skip: integration runtime of Azure Data Factory | https://diagrams.mingrammer.com/docs/nodes/azure |
| Virtual cluster | — | — | skip: internal networking construct of SQL Managed Instance | https://diagrams.mingrammer.com/docs/nodes/azure |
| Virtual datacenter | — | — | skip: architectural pattern, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Cosmos DB for PostgreSQL cluster | — | — | skip: distributed (Citus) deployment covered by azure-cosmos-db and azure-database-for-postgresql | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure SQL Edge | — | — | skip: retired 30 September 2025 | https://diagrams.mingrammer.com/docs/nodes/azure |
| SQL Server registry | — | — | skip: registration record for Arc-connected SQL Server instances | https://diagrams.mingrammer.com/docs/nodes/azure |
| API Connections | — | — | skip: connection configuration for Logic Apps connectors, not a runtime node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure DevOps | — | — | skip: brand covering Pipelines, Repos, Artifacts, Boards, Test Plans | https://diagrams.mingrammer.com/docs/nodes/azure |
| Change Analysis | — | — | skip: feature of Azure Monitor that reports resource changes, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| CloudTest | — | — | skip: test execution tooling | https://diagrams.mingrammer.com/docs/nodes/azure |
| Code Optimization | — | — | skip: profiling feature of Application Insights, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| DevOps Starter | — | — | skip: retired project scaffolding tool | https://diagrams.mingrammer.com/docs/nodes/azure |
| Lab Services lab account | — | — | skip: legacy lab account of Azure Lab Services, same resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Monitor pipeline | — | — | skip: edge data-collection feature of Azure Monitor, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Microsoft Entra ID licenses | — | — | skip: licensing view in the directory, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Access reviews | — | — | skip: governance feature of Microsoft Entra ID Governance, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Microsoft Entra Connect Health | — | — | skip: monitoring feature of Microsoft Entra Connect, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Microsoft Entra ID Protection | — | — | skip: risk-detection feature of Microsoft Entra ID, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Privileged Identity Management | azure-privileged-identity-management | policy-engine | done | https://learn.microsoft.com/en-us/entra/id-governance/privileged-identity-management/pim-configure |
| Administrative units | — | — | skip: directory container, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| API proxy | — | — | skip: directory feature icon, no standalone resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| App registrations | — | — | skip: directory object, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Roles and administrators | — | — | skip: RBAC role assignments, configuration object not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Custom roles | — | — | skip: RBAC role definitions, configuration object not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Enterprise applications | — | — | skip: directory object representing a registered application, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Microsoft Entra Connect | — | — | skip: duplicate of identity/EntraConnectSync, same product | https://diagrams.mingrammer.com/docs/nodes/azure |
| Microsoft Entra Global Secure Access | — | — | skip: umbrella brand covering Entra Internet Access and Entra Private Access | https://diagrams.mingrammer.com/docs/nodes/azure |
| Groups | — | — | skip: directory object, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Microsoft Entra ID Governance | — | — | skip: governance feature set over Entra ID, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Multifactor authentication | — | — | skip: authentication method of Microsoft Entra ID, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Security | — | — | skip: section icon, not a product | https://diagrams.mingrammer.com/docs/nodes/azure |
| Tenant properties | — | — | skip: tenant settings page, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| User settings | — | — | skip: settings page, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Users | — | — | skip: directory object / people icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Verifiable credentials | — | — | skip: feature name of Microsoft Entra Verified ID, same product | https://diagrams.mingrammer.com/docs/nodes/azure |
| Verification as a service | — | — | skip: feature of Microsoft Entra Verified ID, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Data Catalog | — | — | skip: retired, superseded by Microsoft Purview | https://diagrams.mingrammer.com/docs/nodes/azure |
| Business process tracking | — | — | skip: tracking feature of Azure Logic Apps, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Integration account | — | — | skip: B2B artifact container for Logic Apps (schemas, maps, partners), configuration not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Integration environments | — | — | skip: organizational container for integration resources, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Integration Service Environment | — | — | skip: retired 31 August 2024 | https://diagrams.mingrammer.com/docs/nodes/azure |
| Logic Apps custom connector | — | — | skip: connector definition for Logic Apps, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Event Grid partner namespace | — | — | skip: partner-events resource of Azure Event Grid, covered by azure-event-grid | https://diagrams.mingrammer.com/docs/nodes/azure |
| Event Grid partner registration | — | — | skip: partner-events registration metadata, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Event Grid partner topic | — | — | skip: partner-events topic of Azure Event Grid, covered by azure-event-grid | https://diagrams.mingrammer.com/docs/nodes/azure |
| Managed application definition | — | — | skip: packaging construct for publishing offers | https://diagrams.mingrammer.com/docs/nodes/azure |
| Software as a service | — | — | skip: category icon, not a product | https://diagrams.mingrammer.com/docs/nodes/azure |
| StorSimple Device Manager | — | — | skip: retired, StorSimple 8000 and 1200 series ended support December 2022 | https://diagrams.mingrammer.com/docs/nodes/azure |
| Client apps | — | — | skip: Intune app deployment view, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Device compliance | — | — | skip: Intune policy, configuration object not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Device configuration | — | — | skip: Intune policy, configuration object not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Device enrollment | — | — | skip: Intune enrolment workflow, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Device security (Apple) | — | — | skip: Intune policy view, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Device security (Google) | — | — | skip: Intune policy view, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Device security (Windows) | — | — | skip: Intune policy view, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Devices | — | — | skip: managed device list view, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| eBooks | — | — | skip: Intune content distribution view, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Exchange access | — | — | skip: Intune conditional access for Exchange, policy not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Intune app protection | — | — | skip: Intune app protection policy, configuration object not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Intune for Education | — | — | skip: Intune licensing edition, not a separate resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Microsoft Intune | — | — | skip: Microsoft 365 endpoint management SaaS, not an Azure resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Bridge to Kubernetes (Mindaro) | — | — | skip: developer tooling, retired | https://diagrams.mingrammer.com/docs/nodes/azure |
| Security baselines | — | — | skip: Intune policy template, configuration object not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Software updates | — | — | skip: Intune update policy, configuration object not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Tenant status | — | — | skip: status dashboard, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Stack HCI sizer | — | — | skip: capacity sizing tool | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Stack | — | — | skip: umbrella brand covering Azure Local, Azure Stack Hub and Azure Stack Edge | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Industrial IoT | — | — | skip: open-source solution accelerator, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| ML Studio (classic) web services | — | — | skip: retired 31 August 2024 | https://diagrams.mingrammer.com/docs/nodes/azure |
| ML Studio (classic) web service plans | — | — | skip: retired 31 August 2024 | https://diagrams.mingrammer.com/docs/nodes/azure |
| ML Studio (classic) workspaces | — | — | skip: retired 31 August 2024 | https://diagrams.mingrammer.com/docs/nodes/azure |
| Time Series Insights data sets | — | — | skip: retired 7 July 2024 | https://diagrams.mingrammer.com/docs/nodes/azure |
| Time Series Insights access policies | — | — | skip: retired 7 July 2024 | https://diagrams.mingrammer.com/docs/nodes/azure |
| Time Series Insights environments | — | — | skip: retired 7 July 2024 | https://diagrams.mingrammer.com/docs/nodes/azure |
| Time Series Insights event sources | — | — | skip: retired 7 July 2024 | https://diagrams.mingrammer.com/docs/nodes/azure |
| Windows 10 IoT Core Services | — | — | skip: device operating system, not an Azure resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Activity log | — | — | skip: log category of Azure Monitor, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Alerts | — | — | skip: alerting feature of Azure Monitor, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Compliance | — | — | skip: compliance reporting view, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Customer Lockbox for Microsoft Azure | — | — | skip: tenant-wide approval setting for Microsoft support access; it creates no resource you name or place, unlike OCI's operator and delegate access controls, which are OCID-bearing objects attached to a named resource | https://learn.microsoft.com/en-us/azure/security/fundamentals/customer-lockbox-overview |
| Diagnostic settings | — | — | skip: configuration object routing platform logs, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure for Education | — | — | skip: training and subscription program, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Intune trends | — | — | skip: reporting view, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Microsoft Managed Desktop | — | — | skip: device management service, not an Azure resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Metrics | — | — | skip: metrics view of Azure Monitor, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| My customers | — | — | skip: partner portal view, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Operation log (classic) | — | — | skip: retired classic activity log view | https://diagrams.mingrammer.com/docs/nodes/azure |
| Recovery Services vault | — | — | skip: container resource for Azure Backup and Azure Site Recovery, those are the placed nodes | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Resource Graph Explorer | — | — | skip: query tool over the control plane | https://diagrams.mingrammer.com/docs/nodes/azure |
| Resource providers | — | — | skip: ARM control plane registration, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Scheduler job collections | — | — | skip: retired 31 December 2019, superseded by Logic Apps | https://diagrams.mingrammer.com/docs/nodes/azure |
| Service providers | — | — | skip: Azure Lighthouse delegation view, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Solutions | — | — | skip: marketplace and monitoring solution packaging, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Universal Print | — | — | skip: Microsoft 365 cloud print service, not an Azure resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| User privacy | — | — | skip: GDPR data subject request portal, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Keys | — | — | skip: menu icon, not a product | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Migrate project | — | — | skip: assessment and migration tooling | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Remote Rendering | — | — | skip: retired 30 September 2025 | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Spatial Anchors | — | — | skip: retired 20 November 2024 | https://diagrams.mingrammer.com/docs/nodes/azure |
| Cognitive Services | — | — | skip: umbrella brand for the Azure AI services | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Mobile Engagement | — | — | skip: retired March 2018 | https://diagrams.mingrammer.com/docs/nodes/azure |
| Autoscale | — | — | skip: scaling configuration on compute resources, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Logs | — | — | skip: log query experience of Azure Monitor, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Application security group | — | — | skip: logical grouping of network interfaces referenced by NSG rules, a configuration object, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Virtual network gateway connection | — | — | skip: connection object between two gateways, drawn as an edge, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Local network gateway | — | — | skip: configuration object describing the on-premises VPN device, not a deployed node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Network security group (classic) | — | — | skip: classic deployment model variant of Network Security Group (azure-network-security-group) | https://diagrams.mingrammer.com/docs/nodes/azure |
| Reserved IP address (classic) | — | — | skip: classic deployment model variant of Public IP address (azure-public-ip) | https://diagrams.mingrammer.com/docs/nodes/azure |
| Route filter | — | — | skip: BGP community filter applied to an ExpressRoute circuit, a configuration object, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Route table | — | — | skip: user-defined route configuration attached to a subnet, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Service endpoint policy | — | — | skip: policy object restricting service endpoint traffic, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Virtual network (classic) | — | — | skip: classic deployment model variant of Azure Virtual Network (azure-virtual-network) | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Firewall policy | — | — | skip: rule-collection configuration attached to Azure Firewall, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure DNS | — | — | skip: multistack icon variant of DNS Zones, same product | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure DNS security policy | — | — | skip: DNS filtering rule set attached to virtual networks, a policy object, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure IP Address Manager | — | — | skip: address-space planning feature of Azure Virtual Network Manager, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| IP group | — | — | skip: address grouping object referenced by firewall rules, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Proximity placement group | — | — | skip: placement constraint applied to compute resources, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Public IP address (classic) | — | — | skip: classic deployment model variant of Public IP address (azure-public-ip) | https://diagrams.mingrammer.com/docs/nodes/azure |
| Public IP prefix | — | — | skip: reserved contiguous range of Public IP addresses, a property of the address, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Resource management private link | — | — | skip: private access configuration for the Azure Resource Manager control plane, covered by azure-private-link | https://diagrams.mingrammer.com/docs/nodes/azure |
| Spot Virtual Machine Scale Set | — | — | skip: spot priority option of Virtual Machine Scale Sets (azure-vm-scale-set) | https://diagrams.mingrammer.com/docs/nodes/azure |
| AI at the edge | — | — | skip: concept icon for an architecture pattern, not a product | https://diagrams.mingrammer.com/docs/nodes/azure |
| AKS network policy | — | — | skip: configuration object, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Microsoft Azure Consumption Commitment | — | — | skip: billing and licensing commitment, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure sustainability | — | — | skip: emissions reporting dashboard, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Breeze | — | — | skip: unidentified icon in the Azure icon set with no public product behind it | https://diagrams.mingrammer.com/docs/nodes/azure |
| Microsoft Connected Vehicle Platform | — | — | skip: industry solution accelerator built on other Azure services, not a deployable resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Data virtualization | — | — | skip: query feature over external data, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Edge Actions | — | — | skip: unidentified icon in the Azure icon set with no public product page | https://diagrams.mingrammer.com/docs/nodes/azure |
| Edge Storage Accelerator | — | — | skip: preview name of the Arc-enabled edge volumes of Azure Container Storage (azure-container-storage) | https://diagrams.mingrammer.com/docs/nodes/azure |
| Engage Center Connect | — | — | skip: Dynamics 365 contact centre product, not an Azure resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| FRD QA | — | — | skip: unidentified icon in the Azure icon set with no public product behind it | https://diagrams.mingrammer.com/docs/nodes/azure |
| Hybrid connectivity hub | — | — | skip: portal hub view, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| IcM troubleshooting | — | — | skip: incident management and support tooling, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Kubernetes hub | — | — | skip: portal fleet overview over Kubernetes resources, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Landing zone | — | — | skip: architecture concept for a subscription baseline, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Monitor issues | — | — | skip: AIOps issue view inside Azure Monitor (azure-monitor) | https://diagrams.mingrammer.com/docs/nodes/azure |
| Network foundation hub | — | — | skip: portal hub view, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Network security hub | — | — | skip: portal hub view, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Operation center | — | — | skip: portal hub view, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| OSConfig | — | — | skip: device configuration agent and feature, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Scheduled actions | — | — | skip: start/stop schedule applied to compute resources, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Service group relationships | — | — | skip: management grouping construct, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Service groups | — | — | skip: management grouping construct, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure SQL Database fleet manager | — | — | skip: management layer over existing Azure SQL databases, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Stage maps | — | — | skip: unidentified icon in the Azure icon set with no public product behind it | https://diagrams.mingrammer.com/docs/nodes/azure |
| Storage hubs | — | — | skip: portal hub view, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Toolchain orchestrator | — | — | skip: deployment orchestration tooling, not a runtime node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Network virtual appliance | — | — | skip: generic icon for partner appliances deployed as virtual machines, not a product | https://diagrams.mingrammer.com/docs/nodes/azure |
| VPN client for Windows | — | — | skip: client software, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Workload orchestration | — | — | skip: Arc deployment and configuration tooling for edge workloads, not a runtime node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Microsoft Entra authentication methods | — | — | skip: authentication policy of Microsoft Entra ID, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Microsoft Entra Privileged Identity Management | azure-privileged-identity-management | policy-engine | done | mapping: the full product name of the Privileged Identity Management row above |
| Risky sign-ins | — | — | skip: report view in Microsoft Entra ID Protection, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Risky users | — | — | skip: report view in Microsoft Entra ID Protection, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Detonation | — | — | skip: generic concept icon for a malware sandbox, not a product | https://diagrams.mingrammer.com/docs/nodes/azure |
| Extended Security Updates | — | — | skip: support and licensing programme, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Identity Secure Score | — | — | skip: posture score report in Microsoft Entra ID, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Microsoft Entra multifactor authentication | — | — | skip: authentication method of Microsoft Entra ID, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure HPC Cache | — | — | skip: retired 30 September 2025, superseded by Azure Managed Lustre | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure FXT Edge Filer | — | — | skip: physical on-premises hardware appliance, sold with the retired HPC Cache | https://diagrams.mingrammer.com/docs/nodes/azure |
| Data Box Edge / Data Box Gateway | — | — | skip: combined icon for Azure Stack Edge (azure-stack-edge) and Data Box Gateway (azure-data-box-gateway) | https://diagrams.mingrammer.com/docs/nodes/azure |
| Data share invitation | — | — | skip: invitation sub-object of Azure Data Share (azure-data-share), not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| General storage | — | — | skip: generic category icon, not a product | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Import/Export | — | — | skip: offline disk shipping job, superseded by Azure Data Box | https://diagrams.mingrammer.com/docs/nodes/azure |
| Storage account (classic) | — | — | skip: container resource; its blob, queue, table and file services are the placed nodes | https://diagrams.mingrammer.com/docs/nodes/azure |
| Storage account | — | — | skip: container resource; its blob, queue, table and file services are the placed nodes | https://diagrams.mingrammer.com/docs/nodes/azure |
| StorSimple Data Manager | — | — | skip: StorSimple retired, service ended 31 December 2022 | https://diagrams.mingrammer.com/docs/nodes/azure |
| API connection | — | — | skip: connector configuration object used by Logic Apps, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| App Service certificate | — | — | skip: TLS certificate asset, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| App Service domain | — | — | skip: domain name registration, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| App Space component | — | — | skip: element of the App Space portal experience over App Service and Container Apps | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure App Space | — | — | skip: simplified portal experience over App Service and Container Apps, not a resource | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure AI services | — | — | skip: multi-service account grouping the individual Azure AI services, each already a component | https://diagrams.mingrammer.com/docs/nodes/azure |
| All resources | — | — | skip: portal navigation icon for the resource list, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure home | — | — | skip: Azure portal home page icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Backlog | — | — | skip: Azure Boards work-item view icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| BizTalk Services | — | — | skip: Azure BizTalk Services retired 31 May 2018, superseded by Azure Logic Apps | https://diagrams.mingrammer.com/docs/nodes/azure |
| Block blob | — | — | skip: blob type inside Azure Blob Storage, a property not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Page blob | — | — | skip: blob type inside Azure Blob Storage, a property not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Branch | — | — | skip: source-control branch icon (Azure Repos), not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Bug | — | — | skip: Azure Boards work-item icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Cache | — | — | skip: generic cache icon; Azure Cache for Redis is azure-cache-for-redis | https://diagrams.mingrammer.com/docs/nodes/azure |
| Code | — | — | skip: generic source-code icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Commit | — | — | skip: source-control commit icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Controls | — | — | skip: generic UI control icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Cost alerts | — | — | skip: billing and cost tooling | https://diagrams.mingrammer.com/docs/nodes/azure |
| Cost analysis | — | — | skip: billing and cost tooling | https://diagrams.mingrammer.com/docs/nodes/azure |
| Budgets | — | — | skip: billing and cost tooling | https://diagrams.mingrammer.com/docs/nodes/azure |
| Microsoft Cost Management + Billing | — | — | skip: billing and cost tooling | https://diagrams.mingrammer.com/docs/nodes/azure |
| Counter | — | — | skip: generic counter icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Cubes | — | — | skip: generic decorative icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Dashboard | — | — | skip: Azure portal dashboard, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Developer console | — | — | skip: console environment, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Developer tools | — | — | skip: portal category icon for developer tooling, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Download | — | — | skip: generic action icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Error | — | — | skip: generic status icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Extensions | — | — | skip: portal and VM extensions are configuration added to an existing resource, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Feature previews | — | — | skip: portal preview-features page, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| File | — | — | skip: generic document icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Folder | — | — | skip: generic folder icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Website folder | — | — | skip: generic folder icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Free services | — | — | skip: pricing and offers page, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| FTP | — | — | skip: generic protocol icon, not an Azure product | https://diagrams.mingrammer.com/docs/nodes/azure |
| Gear | — | — | skip: generic settings icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Globe error | — | — | skip: generic status icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Globe success | — | — | skip: generic status icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Globe warning | — | — | skip: generic status icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Guide | — | — | skip: documentation icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Heart | — | — | skip: decorative icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Help and support | — | — | skip: support plans | https://diagrams.mingrammer.com/docs/nodes/azure |
| Image | — | — | skip: generic image icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Information | — | — | skip: generic info icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Input/output | — | — | skip: generic I/O icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Journey hub | — | — | skip: portal onboarding page, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Launch portal | — | — | skip: Azure portal icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Microsoft Learn | — | — | skip: training and documentation | https://diagrams.mingrammer.com/docs/nodes/azure |
| Location | — | — | skip: generic location pin icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Log streaming | — | — | skip: App Service log streaming view; the node is azure-monitor | https://diagrams.mingrammer.com/docs/nodes/azure |
| Management groups | — | — | skip: account hierarchy boundary, a container not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Management portal | — | — | skip: Azure portal, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Marketplace management | — | — | skip: software marketplace | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Marketplace | — | — | skip: software marketplace | https://diagrams.mingrammer.com/docs/nodes/azure |
| Media file | — | — | skip: generic file icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Module | — | — | skip: generic module icon (PowerShell module), not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Power up | — | — | skip: generic decorative icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Power | — | — | skip: generic power icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure PowerShell | — | — | skip: shell and CLI tooling | https://diagrams.mingrammer.com/docs/nodes/azure |
| Preview features | — | — | skip: portal preview-features page, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Process explorer | — | — | skip: App Service diagnostic console tool, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Production-ready database | — | — | skip: generic database illustration; the Azure databases are their own components | https://diagrams.mingrammer.com/docs/nodes/azure |
| Quickstart Center | — | — | skip: portal onboarding page, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Recent | — | — | skip: portal navigation icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Region management | — | — | skip: portal region selection, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Reservations | — | — | skip: billing commitment purchase, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Resource Explorer | — | — | skip: inventory and query tooling, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Resource group list | — | — | skip: portal list view, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Resource groups | — | — | skip: resource grouping boundary, a container not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Linked resource | — | — | skip: generic icon for a resource link, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Scheduler | — | — | skip: retired 31 January 2022, superseded by Azure Logic Apps | https://diagrams.mingrammer.com/docs/nodes/azure |
| Search | — | — | skip: portal search icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Shared dashboard | — | — | skip: Azure portal dashboard, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| SSD | — | — | skip: disk media type; Azure managed disks are azure-managed-disk | https://diagrams.mingrammer.com/docs/nodes/azure |
| Subscriptions | — | — | skip: billing and account boundary, a container not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Support | — | — | skip: support plans | https://diagrams.mingrammer.com/docs/nodes/azure |
| Support requests | — | — | skip: support plans | https://diagrams.mingrammer.com/docs/nodes/azure |
| Tag | — | — | skip: resource tagging metadata applied to existing resources | https://diagrams.mingrammer.com/docs/nodes/azure |
| Tags | — | — | skip: resource tagging metadata applied to existing resources | https://diagrams.mingrammer.com/docs/nodes/azure |
| ARM templates | — | — | skip: deployment control plane, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Toolbox | — | — | skip: generic tooling icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Troubleshoot | — | — | skip: portal diagnostics icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| User health | — | — | skip: people icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| User | — | — | skip: people icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| User resource | — | — | skip: people icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Versions | — | — | skip: generic versioning icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Deployment slots | — | — | skip: deployment slot of App Service, a property of azure-app-service | https://diagrams.mingrammer.com/docs/nodes/azure |
| Availability test | — | — | skip: availability test configuration inside Application Insights, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Website power | — | — | skip: generic icon, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Staging slot | — | — | skip: staging deployment slot of App Service, a property of azure-app-service | https://diagrams.mingrammer.com/docs/nodes/azure |
| What is new | — | — | skip: portal news page, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Monitor workbooks | — | — | skip: reporting and dashboard surface over Azure Monitor, not a node | https://diagrams.mingrammer.com/docs/nodes/azure |
| Workflow | — | — | skip: generic workflow icon; Azure Logic Apps is azure-logic-apps | https://diagrams.mingrammer.com/docs/nodes/azure |
| App Compliance Automation Tool for Microsoft 365 | — | — | skip: Compliance reporting and evidence-collection tool, not a runtime node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Aquila | — | — | skip: Internal Microsoft codename icon, no public product. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure | — | — | skip: Generic Azure logo icon, not a product. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Center for SAP solutions | — | — | skip: Deployment and management layer over SAP systems running on VMs, not a runtime node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure dev tunnels | — | — | skip: Developer tooling that exposes a local port during development, not a deployed resource. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Edge Hardware Center | — | — | skip: Hardware ordering and shipment-tracking portal. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure HPC workbenches | — | — | skip: Preview HPC/simulation workbench; its documentation no longer exists as a live service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Monitor dashboards | — | — | skip: Dashboard view over Azure Monitor data, not a node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Network Function Manager network functions | — | — | skip: skip: deployment tooling for partner network functions | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Orbital Ground Station | — | — | skip: Retired December 2024; the docs redirect to the retirement notice. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Quotas | — | — | skip: skip: quota management tooling | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure support center | — | — | skip: Support portal icon. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azurite | — | — | skip: Local Azure Storage emulator for development, not a deployed resource. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Capacity reservation groups | — | — | skip: Capacity purchasing construct over VMs, not a node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Central service instance for SAP | — | — | skip: Sub-resource of an Azure Virtual Instance for SAP, a management representation of VMs. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Ceres | — | — | skip: Internal Microsoft codename icon, no public product. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Community images | — | — | skip: VM image catalogue entry, not a node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Compliance center | — | — | skip: Compliance portal view, not a runtime node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Cost export | — | — | skip: Cost management and billing export, not a runtime node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Custom IP prefix | — | — | skip: Bring-your-own IP address range, a configuration of Public IP addresses. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Dashboard hub | — | — | skip: Portal dashboard icon. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Data collection rules (see Management and governance) | azure-monitor-data-collection-rule | monitoring | done | mapping: the same resource as the Data collection rule row under Management and governance |
| Database instance for SAP | — | — | skip: Sub-resource of an Azure Virtual Instance for SAP, a management representation of VMs. | https://diagrams.mingrammer.com/docs/nodes/azure |
| CM local manager | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| DCS controller | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Distributed control system | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Engineering station | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| External management | — | — | skip: OT asset icon from the Defender for IoT device inventory, not Defender EASM. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Freezer monitor | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Historian | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| HMI | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Industrial packaging system | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Industrial printer | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Industrial robot | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Industrial scale system | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Marquee | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Meter | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| PLC | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Pneumatic device | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Programmable board | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Relay | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Robot controller | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| RTU | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Sensor | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Slot | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Web guiding system | — | — | skip: OT asset icon from the Defender for IoT device inventory, not an Azure service. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure disk pool | — | — | skip: Retired preview aggregate over managed disks, superseded by Azure Elastic SAN. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Edge management | — | — | skip: Generic category icon, not a product. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Microsoft Entra identity licenses | — | — | skip: Licensing icon, not a placeable runtime node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Exchange on-premises access | — | — | skip: Entra hybrid access setting icon, not a node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| ExpressRoute Traffic Collector | — | — | skip: Flow-log collection feature of an ExpressRoute circuit. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Fiji | — | — | skip: Internal Microsoft codename icon, no public product. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Instance pools | — | — | skip: Capacity grouping for SQL Managed Instance deployments, not a node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Internet Analyzer | — | — | skip: Client measurement/testing tool, not a runtime node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Local network gateways | — | — | skip: Configuration object describing the on-premises peer of a VPN gateway. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Log Analytics query pack | — | — | skip: Container of saved queries, a configuration object. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Mission Landing Zone | — | — | skip: Reference architecture and deployment template, not a resource. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Private 5G Core | — | — | skip: Retired 30 September 2025; migrate to partner private-wireless solutions. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Modular Datacenter | — | — | skip: Physical datacenter hardware offering, not a deployable resource. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Monitor health models | — | — | skip: Configuration feature of Azure Monitor, not a node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Open supply chain platform | — | — | skip: Industry solution/initiative icon, not a deployable Azure resource. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Peerings | — | — | skip: Connection configuration between virtual networks or circuits, not a node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Reserved capacity | — | — | skip: Billing reservation, not a runtime node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Resource guard | — | — | skip: Multi-user authorization setting protecting a Backup vault, a configuration object. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure RTOS (Eclipse ThreadX) | — | — | skip: Embedded real-time operating system library, handed to the Eclipse Foundation in 2024. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Savings plans | — | — | skip: Billing commitment, not a runtime node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| SCVMM management servers | — | — | skip: On-premises System Center VMM server projected into Azure Arc; covered by azure-arc. | https://diagrams.mingrammer.com/docs/nodes/azure |
| SONiC DASH | — | — | skip: Open-source network OS API specification, not an Azure service (the existing `sonic` component is the search engine). | https://diagrams.mingrammer.com/docs/nodes/azure |
| SSH keys | — | — | skip: Credential resource, not a placeable node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Storage functions | — | — | skip: Composite Storage + Functions icon, not a distinct product. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Targets management | — | — | skip: Configuration object listing onboarded targets, not a node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Template specs | — | — | skip: Stored ARM deployment template, a packaging artifact. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Test Base for Microsoft 365 | — | — | skip: Application compatibility testing service, end of life 31 May 2024. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Azure Video Analyzer | — | — | skip: Retired 30 November 2022. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Virtual Instance for SAP solutions | — | — | skip: Management representation of an SAP system running on VMs, not a runtime node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Virtual visits builder | — | — | skip: Teams/healthcare app template builder, not a deployable resource. | https://diagrams.mingrammer.com/docs/nodes/azure |
| VM application definitions | — | — | skip: Application artifact stored in a compute gallery, not a node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| VM application versions | — | — | skip: Version of a gallery application artifact, not a node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| VM image version | — | — | skip: Image artifact inside a compute gallery, not a node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Windows Admin Center installer | — | — | skip: Installer for a management console. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Windows Admin Center | — | — | skip: Management console, not a runtime node. | https://diagrams.mingrammer.com/docs/nodes/azure |
| Web App + Database | — | — | skip: Multi-resource deployment template icon, not a single product. | https://diagrams.mingrammer.com/docs/nodes/azure |
| WebJobs | — | — | skip: Background task feature hosted inside an App Service plan, not a separate resource. | https://diagrams.mingrammer.com/docs/nodes/azure |

## Coverage pass 2026-09-21

Diff of this file against the Azure products directory
(<https://azure.microsoft.com/en-us/products/>), the Azure documentation index
(<https://learn.microsoft.com/en-us/azure/?product=all>) and the resource provider list
(<https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-services-resource-providers>),
cross-checked against the architecture icon set (<https://learn.microsoft.com/en-us/azure/architecture/icons/>).
Everything else in those sources was already `done` or `skip` above. Two rows became components
(Azure Monitor workspace, Azure Device Registry); the rest are not nodes.

| resource | id | kind | status | source |
|---|---|---|---|---|
| AI Gateway | — | — | skip: GenAI gateway capability set of API Management, not a separate resource | https://learn.microsoft.com/en-us/azure/api-management/genai-gateway-capabilities |
| Azure Custom Providers | — | — | skip: Resource Manager extensibility mechanism, not a runtime node | https://learn.microsoft.com/en-us/azure/azure-resource-manager/custom-providers/overview |
| Azure Serial Console | — | — | skip: VM troubleshooting console in the portal, not a node | https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/serial-console-windows |
| Bing Maps for Enterprise | — | — | skip: Microsoft product outside Azure; the Azure service is azure-maps | https://learn.microsoft.com/en-us/bingmaps/ |
| Azure Notebooks | — | — | skip: retired 2021, superseded by Azure Machine Learning notebooks | https://learn.microsoft.com/en-us/previous-versions/azure/notebooks/ |
| Azure Dev Spaces | — | — | skip: retired 31 October 2023, superseded by Bridge to Kubernetes | https://learn.microsoft.com/en-us/previous-versions/azure/dev-spaces/ |
| Enterprise Knowledge Graph | — | — | skip: resource provider namespace of a discontinued preview with no live documentation | https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-services-resource-providers |
| Object Store (Microsoft.ObjectStore) | — | — | skip: internal resource provider namespace, no public product | https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-services-resource-providers |
| Token (Microsoft.Token) | — | — | skip: internal resource provider namespace, no public product | https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-services-resource-providers |
| Gateway Load Balancer | — | — | skip: SKU of Azure Load Balancer, same resource as azure-load-balancer | https://learn.microsoft.com/en-us/azure/load-balancer/gateway-overview |
| Service Connector | — | — | skip: connection configuration between a compute service and a backing service, not a node | https://learn.microsoft.com/en-us/azure/service-connector/overview |
| Resiliency in Azure / Infrastructure Resiliency Manager | — | — | skip: posture-management experience over existing backup, replication and zone configuration, reached from the portal search box; not a deployable resource | https://learn.microsoft.com/en-us/azure/resiliency/resiliency-overview |
| Azure Monitor action groups | — | — | skip: notification target list of an alert rule, a configuration object (Alerts is already skipped above) | https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/action-groups |
| Akri services and connectors (OPC UA, ONVIF, media, HTTP/REST, SSE, MQTT) | — | — | skip: in-cluster components of Azure IoT Operations, not separate resources | https://learn.microsoft.com/en-us/azure/iot-operations/discover-manage-assets/overview-manage-assets |
| Microsoft Lifecycle Services | — | — | skip: Dynamics 365 delivery tooling, not an Azure resource | https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-services-resource-providers |

### Cross-provider twins (consolidation, same date)

Products the other providers' passes found and this file did not. Each is the Azure half of a pair
already catalogued elsewhere.

| resource | id | kind | status | source |
|---|---|---|---|---|
| Azure confidential VM | azure-confidential-vm | virtual-machine | done | https://learn.microsoft.com/en-us/azure/confidential-computing/confidential-vm-overview |
| Microsoft Power Apps | azure-power-apps | app-server | done | https://learn.microsoft.com/en-us/power-apps/powerapps-overview |

Microsoft Entra Privileged Identity Management was `skip` on two mingrammer rows and is now
`azure-privileged-identity-management`, the twin of `google-privileged-access-manager` and
`oci-managed-access`: an eligible assignment is a stored object with its own lifetime, not a report.

`azure-confidential-vm` overlaps the `securityType: "confidential"` value on `azure-virtual-machine`,
the same overlap `google-confidential-vm` has with `google-compute-engine`. It is a separate component
for the same reason: its own size families, its own attestation and vTPM behaviour, its own optional
confidential OS disk encryption, and its own set of unsupported features.

Microsoft Power Apps sits in `azure/` because the provider folder is the owning vendor, not the
hosting cloud — the same call that put AppSheet in `gcp/`. The Power Platform brand row stays `skip`.

Operator access: Customer Lockbox stays `skip` and OCI's operator, delegate and API access controls
stay `done`. The line is whether the vendor's access governance creates something you name: an OCI
operator control is an OCID-bearing object you attach to a named Exadata or Autonomous AI Database
resource, while Customer Lockbox is a tenant-wide toggle plus a stream of approval requests, with no
resource of its own. The same test keeps GCP's Access Transparency and Access Approval at `skip`.

### Already covered under another name

| source name | covered by |
|---|---|
| Azure Data Manager for Energy | azure-energy-data-services (Microsoft Energy Data Services is the same product) |
| Autonomous Systems (Microsoft.AutonomousSystems) | the Project Bonsai skip row above |
| Azure Arc-enabled servers / Kubernetes / data services / site manager, SQL Server enabled by Azure Arc | azure-arc, through its `resourceType` enum (servers, kubernetes, data-services, sql-server, vmware-vsphere, scvmm) |
| Azure Business Continuity Center | renamed Resiliency in Azure, skipped in the table above |
| Microsoft.AzureStackHCI | azure-local |
| Microsoft.StorageCache (Azure HPC Cache) | skipped above as retired 30 September 2025, superseded by azure-managed-lustre |
| Azure Load Testing | azure-load-testing, listed above as "Azure App Testing (Load Testing)" |
| Managed MLflow tracking | azure-machine-learning, through the MLflow integration the workspace ships; there is no separate tracking-server resource to place, unlike aws-sagemaker-mlflow |
| Azure Kubernetes Service Edge Essentials | azure-aks-edge-essentials |

### Existing skips a user might reasonably expect to place

Listed for review only; none of these was reversed in this pass. Each is currently `skip` with a
"feature / configuration object / not a resource" reason, yet each has its own Azure resource or is
drawn as a box in Microsoft's own architecture diagrams.

| row | current reason | why it may deserve a component |
|---|---|---|
| Azure Monitor pipeline | edge data-collection feature of Azure Monitor, not a resource | It is a containerised OpenTelemetry-based service deployed to an Arc-enabled Kubernetes cluster with its own ARM resources, its own ingestion ports (Syslog 514, OTLP 4317) and optional persistent storage. Microsoft's own pipeline architecture diagram draws it as a box between clients and the Log Analytics workspace. |
| Azure Virtual Network Manager | central governance over existing VNets, not a topology node | It owns network groups, connectivity configurations (hub and spoke, mesh) and security admin rules, and is the resource that creates the peerings a topology diagram shows. |
| Azure Firewall Manager | policy manager over Azure Firewall instances | Firewall policies are their own resource and are what a secured-hub diagram points at. |
| Local network gateways | configuration object describing the on-premises peer of a VPN gateway | Every site-to-site VPN diagram draws the on-premises peer as a box. |
| Azure Monitor workbooks / dashboards | reporting and dashboard surface over Azure Monitor | They are ARM resources and are the consumer end of a monitoring path. |
| Deployment slots / staging slot | deployment slot of App Service, a property of azure-app-service | A slot is a separately addressable App Service site with its own hostname, and blue-green diagrams draw both. |
| Log Analytics query pack | container of saved queries, a configuration object | An ARM resource, though it has no runtime behaviour a rule could read; weakest of the list. |

## Counts

total 692, todo 0, done 202, skip 490. Plus 2 mapping rows, which point at rows already counted
above. (Recounted from the status column on 2026-09-21; the previous line counted a duplicate
`azure-monitor-data-collection-rule` row as a second `done`.)
