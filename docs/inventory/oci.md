# OCI inventory

Official product directory: the Oracle Cloud Infrastructure documentation service catalogue
<https://docs.oracle.com/en-us/iaas/Content/home.htm> (the "all services by category" index that
<https://docs.oracle.com/en-us/iaas/Content/services.htm> redirects into) and the Oracle Cloud
product pages <https://www.oracle.com/cloud/>. Families below use Oracle's own category
headings from that index. One row per resource a designer places; composite services are split
into their placeable sub-resources (Networking into VCN, subnet and each gateway type;
Autonomous AI Database into its workload types; DevOps into code repository, build pipeline and
deployment pipeline).

Status: `done` = component exists in `components/oci/`. `todo` = to be written.
`skip: <reason>` = cannot be a node in a design. Products Oracle has retired or shut down, and
non-node tooling (CLIs, SDKs, downloadable utilities, consoles, dashboards, marketplaces,
billing and support), are `skip`. Products that are deprecated or closed to new customers but
still usable stay `todo` with the date noted; the component header records the date.

Oracle renamed the database and AI lines in the 2025-2026 refresh (Autonomous Database to
Autonomous AI Database, Oracle Database@Azure/AWS/Google Cloud to Oracle AI Database@..., OCI
Search Service with OpenSearch to OCI Search with OpenSearch). Rows carry the current official
name; ids keep the shorter historical form where a component already exists.

---

## Compute

| resource | id | kind | status | source |
|---|---|---|---|---|
| Compute virtual machine instance | oci-compute | virtual-machine | done | https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm |
| Compute bare metal instance | oci-compute-bare-metal | virtual-machine | done | https://docs.oracle.com/en-us/iaas/Content/Compute/References/computeshapes.htm |
| Dedicated virtual machine host | oci-dedicated-vm-host | virtual-machine | done | https://docs.oracle.com/en-us/iaas/Content/Compute/Concepts/dedicatedvmhosts.htm |
| Instance pool | oci-instance-pool | virtual-machine | done | https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/creatinginstancepool.htm |
| Instance pool autoscaling configuration | oci-compute-autoscaling | virtual-machine | done | https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/autoscalinginstancepools.htm |
| Compute cluster network (RDMA) | oci-cluster-network | virtual-machine | done | https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/managingclusternetworks.htm |
| GPU compute instance | oci-gpu-instance | virtual-machine | done | https://docs.oracle.com/en-us/iaas/Content/Compute/References/computeshapes.htm |
| OCI VMware Solution SDDC | oci-vmware-solution | virtual-machine | done | https://docs.oracle.com/en-us/iaas/Content/VMware/Concepts/ocvsoverview.htm |
| Secure Desktops desktop pool | oci-secure-desktops | virtual-desktop | done | https://docs.oracle.com/en-us/iaas/secure-desktops/create-pool.htm |
| OCI Batch job | oci-batch | worker | done | https://docs.oracle.com/en-us/iaas/Content/oci-batch/batch-objects.htm |
| Custom image / instance configuration | — | — | skip: machine image and launch configuration artifacts | https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/managingcustomimages.htm |
| Compute capacity reservation | — | — | skip: capacity purchasing construct | https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/reserve-capacity.htm |
| Oracle Linux | — | — | skip: operating system distribution, not a placeable resource | https://docs.oracle.com/en/operating-systems/oracle-linux/ |
| Autonomous Linux | — | — | skip: operating system image with automated patching, delivered through OS Management Hub | https://docs.oracle.com/en-us/iaas/os-management-hub/doc/autonomous-linux.html |
| Compute shapes and flexible shapes | — | — | skip: sizing options of an instance | https://docs.oracle.com/en-us/iaas/Content/Compute/References/computeshapes.htm |

## Containers and functions

| resource | id | kind | status | source |
|---|---|---|---|---|
| Container Instances container instance | oci-container-instances | app-server | done | https://docs.oracle.com/en-us/iaas/Content/container-instances/container-instance-shapes.htm |
| Kubernetes Engine (OKE) cluster | oci-kubernetes-engine | container-orchestrator | done | https://docs.oracle.com/en-us/iaas/Content/ContEng/Tasks/contengcomparingenhancedwithbasicclusters_topic.htm |
| OKE virtual node pool | oci-oke-virtual-node-pool | container-orchestrator | done | https://docs.oracle.com/en-us/iaas/Content/ContEng/Tasks/contengcomparingvirtualwithmanagednodes_topic.htm |
| Container Registry repository | oci-container-registry | container-registry | done | https://docs.oracle.com/en-us/iaas/Content/Registry/Concepts/registryoverview.htm |
| Artifact Registry repository | oci-artifact-registry | artifact-repository | done | https://docs.oracle.com/en-us/iaas/Content/artifacts/overview.htm |
| Functions function | oci-functions | app-server | done | https://docs.oracle.com/en-us/iaas/Content/Functions/Concepts/functionsoverview.htm |
| Functions application | — | — | skip: grouping and shared configuration for functions | https://docs.oracle.com/en-us/iaas/Content/Functions/Tasks/functionscreatingapps.htm |
| Verrazzano | — | — | skip: retired open-source Kubernetes platform, no longer offered | https://docs.oracle.com/en-us/iaas/Content/home.htm |
| Application Dependency Management | — | — | skip: dependency vulnerability scanner that runs inside a build, not a node | https://docs.oracle.com/en-us/iaas/Content/application-dependency-management/home.htm |

## Storage

| resource | id | kind | status | source |
|---|---|---|---|---|
| Object Storage bucket | oci-object-storage | object-store | done | https://docs.oracle.com/en-us/iaas/Content/Object/Concepts/objectstorageoverview.htm |
| Archive Storage bucket | oci-archive-storage | object-store | done | https://docs.oracle.com/en-us/iaas/Content/Archive/Concepts/archivestorageoverview.htm |
| Block Volume | oci-block-volume | block-storage | done | https://docs.oracle.com/en-us/iaas/Content/Block/Tasks/creatingavolume.htm |
| Boot volume | oci-boot-volume | block-storage | done | https://docs.oracle.com/en-us/iaas/Content/Block/Concepts/bootvolumes.htm |
| Local NVMe storage | oci-local-nvme | block-storage | done | https://docs.oracle.com/en-us/iaas/Content/Compute/References/nvmedeviceinformation.htm |
| File Storage file system | oci-file-storage | file-storage | done | https://docs.oracle.com/en-us/iaas/Content/File/Concepts/filestorageoverview.htm |
| File Storage with Lustre file system | oci-file-storage-lustre | file-storage | done | https://docs.oracle.com/en-us/iaas/Content/lustre/file-system-create.htm |
| Storage Gateway appliance | — | — | skip: retired, Oracle states the service is no longer available | https://docs.oracle.com/en-us/iaas/Content/StorageGateway/Concepts/storagegatewayoverview.htm |
| Block Volume backup policy | oci-block-volume-backup | backup-service | done | https://docs.oracle.com/en-us/iaas/Content/Block/Tasks/schedulingvolumebackups.htm |
| Object Storage replication policy | — | — | skip: cross-region replication setting of a bucket | https://docs.oracle.com/en-us/iaas/Content/Object/Tasks/usingreplication.htm |
| Object Storage lifecycle policy | — | — | skip: retention rule of a bucket | https://docs.oracle.com/en-us/iaas/Content/Object/Tasks/usinglifecyclepolicies.htm |
| Volume group / volume clone | — | — | skip: grouping and copy operations of block volumes | https://docs.oracle.com/en-us/iaas/Content/Block/Concepts/volumegroups.htm |
| Data Transfer Disk / Data Transfer Appliance | — | — | skip: physical offline transfer service, shipped media not a node | https://docs.oracle.com/en-us/iaas/Content/DataTransfer/Concepts/datatransferoverview.htm |
| Storage Software Appliance | — | — | skip: retired, superseded by Storage Gateway | https://docs.oracle.com/en-us/iaas/Content/home.htm |

## Databases — Oracle Autonomous and Exadata

| resource | id | kind | status | source |
|---|---|---|---|---|
| Autonomous AI Database for Transaction Processing (ATP) | oci-autonomous-database | sql-database | done | https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/autonomous-workload-types.html |
| Autonomous AI Database for Lakehouse / Data Warehouse (ADW) | oci-autonomous-data-warehouse | data-warehouse | done | https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/autonomous-provision.html |
| Autonomous AI JSON Database (AJD) | oci-autonomous-json-database | nosql-database | done | https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/about-autonomous-database-workloads.html |
| APEX Service (Autonomous Database APEX workload) | oci-apex-service | app-server | done | https://docs.oracle.com/en-us/iaas/apex/index.html |
| Autonomous AI Database on Dedicated Exadata Infrastructure | oci-autonomous-database-dedicated | sql-database | done | https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/backup-and-restore-autonomous-ai-database-on-dedicated.html |
| Autonomous AI Database on Exadata Cloud@Customer | oci-autonomous-database-cloud-at-customer | sql-database | done | https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/backup-and-restore-autonomous-ai-database-on-dedicated.html |
| Globally Distributed Autonomous AI Database | oci-globally-distributed-autonomous-database | sql-database | done | https://docs.oracle.com/en/cloud/paas/globally-distributed-autonomous-database/user/overview-distributed-adb1.html |
| Globally Distributed Exadata Database on Exascale Infrastructure | oci-globally-distributed-exadata-exascale | sql-database | done | https://docs.oracle.com/en/cloud/paas/globally-distributed-exascale-database/user/overview-distributed-exadb-xs.html |
| Base Database Service database system | oci-base-database | sql-database | done | https://docs.oracle.com/en-us/iaas/base-database/doc/create-db-system-using-console.html |
| Base Database Cloud@Customer | oci-base-database-cloud-at-customer | sql-database | done | https://docs.oracle.com/en/cloud/cloud-at-customer/base-database/admin/architecture.html |
| Exadata Database Service on Dedicated Infrastructure | oci-exadata-database-dedicated | sql-database | done | https://docs.oracle.com/en-us/iaas/exadatacloud/doc/exa-service-desc.html |
| Exadata Database Service on Exascale Infrastructure | oci-exadata-database-exascale | sql-database | done | https://docs.oracle.com/en-us/iaas/exadb-xs/doc/overview-exadb-xs-service.html |
| Exadata Database Service on Cloud@Customer | oci-exadata-database-cloud-at-customer | sql-database | done | https://docs.oracle.com/en-us/iaas/exadata/doc/ecc-exadata-cloud-at-customer-overview.html |
| Autonomous Recovery Service protected database | oci-autonomous-recovery-service | backup-service | done | https://docs.oracle.com/en-us/iaas/recovery-service/doc/overview-protection-policy.html |
| Autonomous Data Guard / Data Guard association | — | — | skip: replication configuration of a database, drawn as an edge | https://docs.oracle.com/en-us/iaas/Content/Database/Tasks/usingdataguard.htm |
| Oracle APEX (application builder) | — | — | skip: low-code development environment inside a database, not a separate node | https://docs.oracle.com/en-us/iaas/apex/index.html |
| External Database (registered on-premises database) | — | — | skip: registration record for management of a database outside OCI | https://docs.oracle.com/en-us/iaas/Content/ExternalDatabase/Concepts/externaloverview.htm |
| Database Tools connection / SQL Worksheet | — | — | skip: console query tooling | https://docs.oracle.com/en-us/iaas/database-tools/index.html |

## Databases — open source, NoSQL, cache and search

| resource | id | kind | status | source |
|---|---|---|---|---|
| MySQL HeatWave DB system | oci-mysql-heatwave | sql-database | done | https://docs.oracle.com/en-us/iaas/mysql-database/doc/features-mysql-heatwave-service.html |
| MySQL HeatWave analytics cluster | oci-mysql-heatwave-cluster | data-warehouse | done | https://docs.oracle.com/en-us/iaas/mysql-database/doc/features-mysql-heatwave-service.html |
| OCI Database with PostgreSQL | oci-postgresql | sql-database | done | https://docs.oracle.com/en-us/iaas/Content/postgresql/overview.htm |
| NoSQL Database table | oci-nosql-database | nosql-database | done | https://docs.oracle.com/en/cloud/paas/nosql-cloud/csnsd/cloud-concepts.html |
| OCI Cache with Redis | oci-cache-redis | cache | done | https://docs.oracle.com/en-us/iaas/Content/ocicache/overview.htm |
| OCI Cache with Valkey | oci-cache-valkey | cache | done | https://docs.oracle.com/en-us/iaas/Content/ocicache/overview.htm |
| OCI Search with OpenSearch cluster | oci-opensearch | search-index | done | https://docs.oracle.com/en-us/iaas/Content/search-opensearch/Concepts/ociopensearch.htm |
| OpenSearch Dashboards | oci-opensearch-dashboards | bi-service | done | https://docs.oracle.com/en-us/iaas/Content/search-opensearch/Concepts/ociopensearch.htm |
| TimesTen Database for OKE | oci-timesten | sql-database | done | https://docs.oracle.com/en/cloud/paas/timesten-oke/ |
| Oracle Coherence | — | — | skip: in-process data grid library, deployed inside an application server | https://docs.oracle.com/en/middleware/fusion-middleware/coherence/ |
| Database Backup (classic cloud backup module) | — | — | skip: legacy backup module superseded by Autonomous Recovery Service | https://docs.oracle.com/en-us/iaas/Content/recovery-service/doc/overview.html |

## Databases — migration, replication and management

| resource | id | kind | status | source |
|---|---|---|---|---|
| Database Migration migration job | oci-database-migration | worker | done | https://docs.oracle.com/en-us/iaas/database-migration/doc/overview-oracle-cloud-infrastructure-database-migration.html |
| GoldenGate deployment | oci-goldengate | change-data-capture | done | https://docs.oracle.com/en-us/iaas/goldengate/doc/create-deployment.html |
| GoldenGate Stream Analytics | oci-goldengate-stream-analytics | stream-processor | done | https://docs.oracle.com/en-us/iaas/goldengate/doc/stream-analytics.html |
| Database Management fleet | oci-database-management | monitoring | done | https://docs.oracle.com/en-us/iaas/database-management/doc/oracle-cloud-database-metrics.html |
| Data Safe target | oci-data-safe | policy-engine | done | https://docs.oracle.com/en-us/iaas/data-safe/doc/oracle-data-safe-overview.html |
| Zero Downtime Migration | — | — | skip: downloadable migration utility run from a host, not a node | https://docs.oracle.com/en/database/oracle/zero-downtime-migration/ |
| Oracle Cloud Migrations (migration plan) | oci-cloud-migrations | worker | done | https://docs.oracle.com/en-us/iaas/Content/cloud-migration/home.htm |
| Database Migration assessment reports | — | — | skip: migration assessment output | https://docs.oracle.com/en-us/iaas/database-migration/index.html |

## Networking — core

| resource | id | kind | status | source |
|---|---|---|---|---|
| Virtual Cloud Network (VCN) | oci-vcn | network-fabric | done | https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/overview.htm |
| Subnet | oci-subnet | network-fabric | done | https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/create_subnet.htm |
| Internet gateway | oci-internet-gateway | network-fabric | done | https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/managingIGs.htm |
| NAT gateway | oci-nat-gateway | nat-gateway | done | https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/NATgateway.htm |
| Service gateway | oci-service-gateway | private-link | done | https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/servicegateway.htm |
| Private endpoint (Private Access Gateway) | oci-private-endpoint | private-link | done | https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/privateaccess.htm |
| Local peering gateway | oci-local-peering-gateway | network-fabric | done | https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/localVCNpeering.htm |
| Dynamic Routing Gateway (DRG) | oci-dynamic-routing-gateway | network-fabric | done | https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/managingDRGs.htm |
| Site-to-Site VPN IPSec connection | oci-site-to-site-vpn | vpn-gateway | done | https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/overviewIPsec.htm |
| OCI VPN (client VPN gateway) | oci-client-vpn | vpn-gateway | skip: no first-party OCI client VPN service; remote access is via marketplace images on compute | unverified: the cited page 404s and no native OCI client/remote-access VPN service is documented; remote access is via marketplace images (see https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/overviewIPsec.htm) |
| FastConnect virtual circuit | oci-fastconnect | network-fabric | done | https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/fastconnectoverview.htm |
| Network security group | oci-network-security-group | firewall | done | https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/networksecuritygroups.htm |
| Security list | oci-security-list | firewall | done | https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securitylists.htm |
| VNIC / secondary VNIC | — | — | skip: network interface attached to an instance | https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/managingVNICs.htm |
| Route table / DHCP options | — | — | skip: routing and DHCP configuration of a subnet | https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/managingroutetables.htm |
| Reserved public IP / private IP / public IP pool (IP Management) | — | — | skip: address allocations attached to VNICs and gateways | https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/managingpublicIPs.htm |
| Cluster placement group | — | — | skip: placement construct for low-latency resource groups | https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/cluster-placement-groups.htm |
| IPv6 addressing | — | — | skip: addressing option of a VCN | https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/ipv6.htm |

## Networking — delivery, DNS and observability

| resource | id | kind | status | source |
|---|---|---|---|---|
| Load Balancer | oci-load-balancer | load-balancer | done | https://docs.oracle.com/en-us/iaas/Content/Balance/Concepts/balanceoverview.htm |
| Network Load Balancer | oci-network-load-balancer | load-balancer | done | https://docs.oracle.com/en-us/iaas/Content/NetworkLoadBalancer/introduction.htm |
| DNS public zone | oci-dns-zone | dns | done | https://docs.oracle.com/en-us/iaas/Content/DNS/Concepts/dnszonemanagement.htm |
| DNS private zone and resolver | oci-dns-private-zone | dns | done | https://docs.oracle.com/en-us/iaas/Content/DNS/Tasks/privatedns.htm |
| Traffic Management steering policy | oci-traffic-management | dns | done | https://docs.oracle.com/en-us/iaas/Content/TrafficManagement/Concepts/overview.htm |
| Web Application Acceleration policy | oci-web-application-acceleration | cdn | done | https://docs.oracle.com/en-us/iaas/Content/web-app-acceleration/overview.htm |
| Web Application Firewall policy | oci-waf | waf | done | https://docs.oracle.com/en-us/iaas/Content/WAF/Concepts/overview.htm |
| Network Firewall | oci-network-firewall | firewall | done | https://docs.oracle.com/en-us/iaas/Content/network-firewall/overview.htm |
| Bastion (managed bastion service) | oci-bastion | bastion-host | done | https://docs.oracle.com/en-us/iaas/Content/Bastion/Concepts/bastionoverview.htm |
| Health Checks monitor | oci-health-checks | monitoring | done | https://docs.oracle.com/en-us/iaas/Content/HealthChecks/Concepts/healthchecks.htm |
| VCN flow logs | oci-vcn-flow-logs | monitoring | done | https://docs.oracle.com/en-us/iaas/Content/Logging/Reference/details_for_vcn_flow_logs.htm |
| Virtual Test Access Point (VTAP) | oci-vtap | monitoring | done | https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/vtap.htm |
| Network Path Analyzer | oci-network-path-analyzer | monitoring | done | https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/path_analyzer.htm |
| Email Delivery | oci-email-delivery | notification-service | done | https://docs.oracle.com/en-us/iaas/Content/Email/Concepts/overview.htm |
| DDoS protection | — | — | skip: always-on platform protection, no configurable resource | https://docs.oracle.com/en-us/iaas/Content/Security/Reference/networking_security.htm |
| Network Visualizer | — | — | skip: console topology view over existing networking resources | https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/network_visualizer.htm |
| Inter-Region Latency dashboard | — | — | skip: latency reporting dashboard | https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/inter_region_latency.htm |
| Network Command Center | — | — | skip: umbrella console for the network tools listed above | https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/landing.htm |

## Security, identity and compliance

| resource | id | kind | status | source |
|---|---|---|---|---|
| IAM with Identity Domains (identity domain) | oci-identity-domain | identity-provider | done | https://docs.oracle.com/en-us/iaas/Content/Identity/domains/overview.htm |
| IAM policy | oci-iam-policy | policy-engine | done | https://docs.oracle.com/en-us/iaas/Content/Identity/policieshow/Policy_Basics.htm |
| Dynamic group / instance principal | oci-dynamic-group | identity-provider | done | https://docs.oracle.com/en-us/iaas/Content/Identity/dynamicgroups/managingdynamicgroups.htm |
| Vault (key and secret vault) | oci-vault | key-management | done | https://docs.oracle.com/en-us/iaas/Content/KeyManagement/Concepts/keyoverview.htm |
| Virtual private vault (dedicated HSM partition) | oci-virtual-private-vault | key-management | done | https://docs.oracle.com/en-us/iaas/Content/KeyManagement/Concepts/keyoverview.htm |
| External Key Management (third-party HSM) | oci-external-key-management | key-management | done | https://docs.oracle.com/en-us/iaas/Content/KeyManagement/Tasks/external_key_management.htm |
| Secret Management Service secret | oci-secret-management | key-management | done | https://docs.oracle.com/en-us/iaas/Content/secret-management/overview.htm |
| Certificates certificate authority | oci-certificates | key-management | done | https://docs.oracle.com/en-us/iaas/Content/certificates/overview.htm |
| Cloud Guard target | oci-cloud-guard | monitoring | done | https://docs.oracle.com/en-us/iaas/cloud-guard/using/index.htm |
| Security Zones security zone | oci-security-zone | policy-engine | done | https://docs.oracle.com/en-us/iaas/security-zone/using/security-zones.htm |
| Vulnerability Scanning Service scan recipe | oci-vulnerability-scanning | monitoring | done | https://docs.oracle.com/en-us/iaas/scanning/using/create-host-recipe.htm |
| Threat Intelligence | oci-threat-intelligence | third-party-api | done | https://docs.oracle.com/en-us/iaas/Content/threat-intel/home.htm |
| Access Governance | oci-access-governance | policy-engine | done | https://docs.oracle.com/en-us/iaas/Content/access-governance/home.htm |
| Zero Trust Packet Routing security policy | oci-zero-trust-packet-routing | policy-engine | done | https://docs.oracle.com/en-us/iaas/Content/zero-trust-packet-routing/overview.htm |
| Audit (tenancy audit log) | oci-audit | monitoring | done | https://docs.oracle.com/en-us/iaas/Content/Audit/Tasks/settingretentionperiod.htm |
| Managed Access | oci-managed-access | policy-engine | done | https://docs.oracle.com/en-us/iaas/Content/managed-access/home.htm |
| IAM without identity domains | — | — | skip: legacy IAM model, superseded by identity domains in the same tenancy | https://docs.oracle.com/en-us/iaas/Content/Identity/getstarted/identity-domains.htm |
| Compartment | — | — | skip: tenancy organization construct, not a topology node | https://docs.oracle.com/en-us/iaas/Content/Identity/compartments/managingcompartments.htm |
| Security Advisor | — | — | skip: console wizard that creates other security resources | https://docs.oracle.com/en-us/iaas/Content/security-advisor/home.htm |
| Compliance Documents | — | — | skip: compliance report portal | https://docs.oracle.com/en-us/iaas/Content/ComplianceDocuments/home.htm |

## Analytics and data platform

| resource | id | kind | status | source |
|---|---|---|---|---|
| Data Flow Spark application | oci-data-flow | big-data-cluster | done | https://docs.oracle.com/en-us/iaas/data-flow/using/home.htm |
| Big Data Service cluster | oci-big-data-service | big-data-cluster | done | https://docs.oracle.com/en-us/iaas/Content/bigdata/manage-cluster-create.htm |
| AI Data Platform (lakehouse) | oci-ai-data-platform | big-data-cluster | done | https://docs.oracle.com/en/cloud/paas/ai-data-platform/aidug/get-started-oracle-ai-data-platform.html |
| Data Integration workspace | oci-data-integration | worker | done | https://docs.oracle.com/en-us/iaas/data-integration/home.htm |
| Data Transforms | oci-data-transforms | worker | done | https://docs.oracle.com/en/database/data-integration/data-transforms/using/introduction-oracle-data-transforms.html |
| Data Catalog | oci-data-catalog | data-catalog | done | https://docs.oracle.com/en-us/iaas/data-catalog/home.htm |
| Analytics Cloud instance | oci-analytics-cloud | bi-service | done | https://docs.oracle.com/en-us/iaas/analytics-cloud/doc/create-service-using-console.html |
| Fusion Data Intelligence | oci-fusion-data-intelligence | bi-service | done | https://docs.oracle.com/en-us/iaas/analytics-for-applications/doc/you-begin-oracle-fusion-data-intelligence.html |
| Data Labeling dataset | oci-data-labeling | ml-platform | done | https://docs.oracle.com/en-us/iaas/data-labeling/home.htm |
| Resource Analytics | oci-resource-analytics | bi-service | done | https://docs.oracle.com/en-us/iaas/Content/resource-analytics/home.htm |
| Data Integrator (Oracle Data Integrator on OCI) | oci-data-integrator | worker | done | https://docs.oracle.com/en/middleware/fusion-middleware/data-integrator/12.2.1.4/dimgs/getting-started-oracle-cloud-marketplace.html |
| Big Data Discovery / Big Data Preparation | — | — | skip: retired classic services | https://docs.oracle.com/en-us/iaas/Content/home.htm |
| Data Hub | — | — | skip: retired classic service | https://docs.oracle.com/en-us/iaas/Content/home.htm |

## AI and machine learning

| resource | id | kind | status | source |
|---|---|---|---|---|
| Generative AI (on-demand and dedicated AI clusters) | oci-generative-ai | ai-service | done | https://docs.oracle.com/en-us/iaas/Content/generative-ai/overview.htm |
| Generative AI Agents agent | oci-generative-ai-agents | ai-service | done | https://docs.oracle.com/en-us/iaas/Content/generative-ai-agents/limits.htm |
| Generative AI dedicated AI cluster | oci-generative-ai-cluster | ml-inference | done | https://docs.oracle.com/en-us/iaas/Content/generative-ai/create-ai-cluster-hosting.htm |
| AI Language | oci-ai-language | ai-service | done | https://docs.oracle.com/en-us/iaas/language/using/model-limitations.htm |
| AI Vision | oci-ai-vision | ai-service | done | https://docs.oracle.com/en-us/iaas/vision/vision/using/limits.htm |
| AI Speech | oci-ai-speech | ai-service | done | https://docs.oracle.com/en-us/iaas/Content/speech/using/speech.htm |
| Document Understanding | oci-document-understanding | ai-service | done | https://docs.oracle.com/en-us/iaas/Content/document-understanding/using/limits.htm |
| Digital Assistant | oci-digital-assistant | ai-service | done | https://docs.oracle.com/en-us/iaas/digital-assistant/doc/order-service-and-provision-instance.html |
| Data Science project and notebook session | oci-data-science | ml-platform | done | https://docs.oracle.com/en-us/iaas/data-science/using/data-science.htm |
| Data Science model deployment | oci-data-science-model-deployment | ml-inference | done | https://docs.oracle.com/en-us/iaas/data-science/using/model_dep_create.htm |
| Data Science model catalog | oci-data-science-model-catalog | artifact-repository | done | https://docs.oracle.com/en-us/iaas/data-science/using/models-about.htm |
| Data Science job | oci-data-science-job | worker | done | https://docs.oracle.com/en-us/iaas/data-science/using/jobs-about.htm |
| AI Anomaly Detection | — | — | skip: retired, no longer listed in the OCI service catalogue | https://docs.oracle.com/en-us/iaas/Content/home.htm |
| AI Forecasting | — | — | skip: retired, no longer listed in the OCI service catalogue | https://docs.oracle.com/en-us/iaas/Content/home.htm |
| AI Blueprints | — | — | skip: prebuilt deployment recipes that create OKE and Compute resources already covered here | https://docs.oracle.com/en-us/iaas/Content/home.htm |

## Integration and messaging

| resource | id | kind | status | source |
|---|---|---|---|---|
| Streaming stream | oci-streaming | stream | done | https://docs.oracle.com/en-us/iaas/Content/Streaming/Concepts/streamingoverview.htm |
| Streaming with Apache Kafka cluster | oci-streaming-kafka | stream | done | https://docs.oracle.com/en-us/iaas/Content/kafka/overview.htm |
| Queue | oci-queue | queue | done | https://docs.oracle.com/en-us/iaas/Content/queue/overview.htm |
| Notifications topic | oci-notifications | notification-service | done | https://docs.oracle.com/en-us/iaas/Content/Notification/Concepts/notificationoverview.htm |
| Events rule | oci-events | pubsub-topic | done | https://docs.oracle.com/en-us/iaas/Content/Events/Concepts/eventsoverview.htm |
| Connector Hub service connector | oci-connector-hub | stream-processor | done | https://docs.oracle.com/en-us/iaas/Content/connector-hub/home.htm |
| Integration 3 (Oracle Integration) instance | oci-integration | workflow-engine | done | https://docs.oracle.com/en/cloud/paas/application-integration/integrations-user/integrations.html |
| Process Automation instance | oci-process-automation | workflow-engine | done | https://docs.oracle.com/en/cloud/paas/process-automation/user-process-automation/decisions-glance.html |
| SOA Suite on OCI | oci-soa-suite | workflow-engine | done | https://docs.oracle.com/en/cloud/paas/soa/soa-marketplace/soamp-components-oracle-soa-suite-marketplace.html |
| Managed File Transfer | oci-managed-file-transfer | worker | done | https://docs.oracle.com/en/cloud/paas/soa/soa-marketplace/soamp-components-oracle-soa-suite-marketplace.html |
| API Gateway | oci-api-gateway | api-gateway | done | https://docs.oracle.com/en-us/iaas/Content/APIGateway/Concepts/apigatewayoverview.htm |
| Messaging (classic) | — | — | skip: retired classic messaging service, superseded by Queue and Streaming | https://docs.oracle.com/en-us/iaas/Content/queue/overview.htm |
| Apiary | — | — | skip: retired API design tooling | https://docs.oracle.com/en-us/iaas/Content/home.htm |
| API Platform (classic) | — | — | skip: retired, superseded by API Gateway | https://docs.oracle.com/en-us/iaas/Content/APIGateway/Concepts/apigatewayoverview.htm |
| Integration Services (classic) | — | — | skip: retired, superseded by Integration 3 | https://docs.oracle.com/en-us/iaas/application-integration/index.html |

## Application development

| resource | id | kind | status | source |
|---|---|---|---|---|
| DevOps code repository | oci-devops-code-repository | artifact-repository | done | https://docs.oracle.com/en-us/iaas/Content/devops/using/devops_overview.htm |
| DevOps build pipeline | oci-devops-build-pipeline | ci-pipeline | done | https://docs.oracle.com/en-us/iaas/Content/devops/using/create_buildpipeline.htm |
| DevOps deployment pipeline | oci-devops-deployment-pipeline | ci-pipeline | done | https://docs.oracle.com/en-us/iaas/Content/devops/using/devops_overview.htm |
| Resource Manager stack | oci-resource-manager | ci-pipeline | done | https://docs.oracle.com/en-us/iaas/Content/ResourceManager/Concepts/resourcemanager.htm |
| Visual Builder instance | oci-visual-builder | app-server | done | https://docs.oracle.com/en/cloud/paas/app-builder-cloud/visual-builder-oci-admin/oracle-visual-builder.html |
| Visual Builder Studio | oci-visual-builder-studio | ci-pipeline | done | https://docs.oracle.com/en-us/iaas/visual-builder-studio/doc/vm-build-executors.html |
| Content Management instance | oci-content-management | content-repository | done | https://docs.oracle.com/en/cloud/paas/content-cloud/administer/configure-assets-settings.html |
| WebLogic Server for OCI | oci-weblogic-server | app-server | done | https://docs.oracle.com/en/cloud/paas/weblogic-cloud/user/components-oracle-weblogic-cloud.html |
| WebLogic Server for OKE | oci-weblogic-server-oke | app-server | done | https://docs.oracle.com/en/cloud/paas/weblogic-container/user/create-stack2.html |
| WebCenter Portal on OCI | oci-webcenter | app-server | done | https://docs.oracle.com/en/cloud/paas/webcenter-portal/wc-portal-marketplace/index.html |
| Blockchain Platform | oci-blockchain-platform | ledger | done | https://docs.oracle.com/en/cloud/paas/blockchain-cloud/usingoci/what-are-advantages-oracle-blockchain-platform.html |
| Internet of Things platform | oci-iot | iot-hub | done | https://docs.oracle.com/en-us/iaas/Content/internet-of-things/overview.htm |
| Service Catalog private application | oci-service-catalog | artifact-repository | done | https://docs.oracle.com/en-us/iaas/Content/Marketplace/overview_of_service_catalog.htm |
| Mobile Hub | — | — | skip: retired mobile backend service | https://docs.oracle.com/en-us/iaas/Content/home.htm |
| Application Container (classic) | — | — | skip: retired, superseded by Container Instances and OKE | https://docs.oracle.com/en-us/iaas/Content/container-instances/home.htm |
| Managed Cloud Self Service Platform | — | — | skip: console for Oracle-managed service requests | https://docs.oracle.com/en-us/iaas/Content/home.htm |
| Automated CEMLI Execution | — | — | skip: managed-service change-execution tooling for Oracle applications | https://docs.oracle.com/en-us/iaas/Content/home.htm |
| Ravello | — | — | skip: retired nested-virtualization service | https://docs.oracle.com/en-us/iaas/Content/home.htm |

## Observability and management

| resource | id | kind | status | source |
|---|---|---|---|---|
| Monitoring metric and alarm | oci-monitoring | monitoring | done | https://docs.oracle.com/en-us/iaas/Content/Monitoring/Concepts/monitoringoverview.htm |
| Logging log group and log | oci-logging | monitoring | done | https://docs.oracle.com/en-us/iaas/Content/Logging/Task/enabling_logging.htm |
| Logging Analytics log group | oci-logging-analytics | monitoring | done | https://docs.oracle.com/en-us/iaas/log-analytics/doc/manage-storage.html |
| Application Performance Monitoring domain | oci-apm | monitoring | done | https://docs.oracle.com/en-us/iaas/application-performance-monitoring/doc/create-apm-domain.html |
| Stack Monitoring resource | oci-stack-monitoring | monitoring | done | https://docs.oracle.com/en-us/iaas/stack-monitoring/doc/introduction.html |
| Ops Insights (Operations Insights) | oci-ops-insights | monitoring | done | https://docs.oracle.com/en-us/iaas/operations-insights/doc/operations-insights.html |
| Java Management Service fleet | oci-java-management | monitoring | done | https://docs.oracle.com/en-us/iaas/jms/doc/fleet-management.html |
| WebLogic Management Service | oci-weblogic-management | monitoring | done | https://docs.oracle.com/en-us/iaas/wlms/doc/overview.htm |
| OS Management Hub | oci-os-management-hub | worker | done | https://docs.oracle.com/en-us/iaas/osmh/doc/overview.htm |
| Fleet Application Management | oci-fleet-application-management | worker | done | https://docs.oracle.com/en-us/iaas/Content/fleet-management/home.htm |
| Resource Scheduler schedule | oci-resource-scheduler | worker | done | https://docs.oracle.com/en-us/iaas/Content/resource-scheduler/tasks/create-manage.htm |
| Cloud Advisor | oci-cloud-advisor | monitoring | done | https://docs.oracle.com/en-us/iaas/Content/CloudAdvisor/Concepts/cloudadvisoroverview.htm |
| Management Agent | — | — | skip: agent installed on a host, drawn as part of the host | https://docs.oracle.com/en-us/iaas/management-agents/index.html |
| Console Dashboards / Management Dashboards | — | — | skip: console dashboards over existing metrics | https://docs.oracle.com/en-us/iaas/Content/Dashboards/home.htm |
| Search (resource search) | — | — | skip: console query over tenancy resources | https://docs.oracle.com/en-us/iaas/Content/Search/Concepts/queryoverview.htm |
| Announcements | — | — | skip: service notice feed | https://docs.oracle.com/en-us/iaas/Content/Announcements/Concepts/announcementoverview.htm |

## Governance and administration

| resource | id | kind | status | source |
|---|---|---|---|---|
| Tagging (defined and free-form tags) | — | — | skip: metadata applied to resources | https://docs.oracle.com/en-us/iaas/Content/Tagging/Concepts/taggingoverview.htm |
| Compartment Quotas | — | — | skip: quota policy over a compartment | https://docs.oracle.com/en-us/iaas/Content/Quotas/Concepts/resourcequotas.htm |
| Organization Management | — | — | skip: tenancy hierarchy administration | https://docs.oracle.com/en-us/iaas/Content/General/Concepts/organization_management_overview.htm |
| License Manager | — | — | skip: license tracking tooling | https://docs.oracle.com/en-us/iaas/Content/LicenseManager/home.htm |
| Control Center | — | — | skip: administration console | https://docs.oracle.com/en-us/iaas/Content/home.htm |
| Pulse | — | — | skip: tenancy status and health console | https://docs.oracle.com/en-us/iaas/Content/home.htm |
| Support Requests | — | — | skip: support ticketing | https://docs.oracle.com/en-us/iaas/Content/GSG/Tasks/contactingsupport.htm |
| Billing, Cost Management, FinOps Hub, Budgets | — | — | skip: billing and cost management | https://docs.oracle.com/en-us/iaas/Content/Billing/Concepts/billingoverview.htm |
| Oracle Support Rewards | — | — | skip: billing program | https://docs.oracle.com/en-us/iaas/Content/Billing/Concepts/billingoverview.htm |
| Marketplace | — | — | skip: software marketplace | https://docs.oracle.com/en-us/iaas/Content/Marketplace/Concepts/marketoverview.htm |

## Media

| resource | id | kind | status | source |
|---|---|---|---|---|
| Media Flow (media processing workflow) | oci-media-flow | media-transcoder | done | https://docs.oracle.com/en-us/iaas/Content/media-services/mediaflow/media-flow-overview.htm |
| Media Streams distribution channel | oci-media-streams | cdn | done | https://docs.oracle.com/en-us/iaas/Content/media-services/mediastreams/media-streams-overview.htm |

## Hybrid, edge and dedicated cloud

| resource | id | kind | status | source |
|---|---|---|---|---|
| Compute Cloud@Customer | oci-compute-cloud-at-customer | edge-appliance | done | https://docs.oracle.com/en-us/iaas/compute-cloud-at-customer/ccc/overview-of-compute-cloud-at-customer.htm |
| Compute Cloud@Customer Isolated | oci-compute-cloud-at-customer-isolated | edge-appliance | done | https://docs.oracle.com/en-us/iaas/compute-cloud-at-customer-isolated/c3i/overview-compute-cloud-customer-isolated.htm |
| Private Cloud Appliance | oci-private-cloud-appliance | edge-appliance | done | https://docs.oracle.com/en-us/iaas/private-cloud-appliance/pca/apphw-baserack.htm |
| Roving Edge Infrastructure device | oci-roving-edge | edge-appliance | done | https://docs.oracle.com/en-us/iaas/roving-edge-infrastructure/rvr/device_specifications.htm |
| Roving Edge Classic device | oci-roving-edge-classic | edge-appliance | done | https://docs.oracle.com/en-us/iaas/Content/Rover/device_specifications.htm |
| Dedicated Region | — | — | skip: whole-region deployment model, resources are placed in it not drawn as it | https://docs.oracle.com/en-us/iaas/Content/dedicated-region/home.htm |
| Oracle Alloy | — | — | skip: white-label cloud distribution program, not a resource | https://docs.oracle.com/en-us/iaas/Content/alloy/home.htm |
| Managed Services for Mac | — | — | skip: Oracle-operated managed service offering, not a placeable resource | https://docs.oracle.com/en-us/iaas/Content/home.htm |
| Cloud at Customer Gen 1 | — | — | skip: retired, superseded by Compute Cloud@Customer and Dedicated Region | https://docs.oracle.com/en-us/iaas/Content/home.htm |

## Multicloud

| resource | id | kind | status | source |
|---|---|---|---|---|
| Oracle AI Database@Azure | oci-database-at-azure | sql-database | done | https://docs.oracle.com/en-us/iaas/Content/database-at-azure/overview.htm |
| Oracle AI Database@AWS | oci-database-at-aws | sql-database | done | https://docs.oracle.com/en-us/iaas/Content/database-at-aws/oaaws-overview.htm |
| Oracle AI Database@Google Cloud | oci-database-at-google-cloud | sql-database | done | https://docs.oracle.com/en-us/iaas/Content/database-at-gcp/overview.htm |
| Oracle Interconnect for Azure | oci-interconnect-azure | network-fabric | done | https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/azure.htm |
| Oracle Interconnect for AWS | oci-interconnect-aws | network-fabric | done | https://docs.oracle.com/en-us/iaas/Content/multicloud/interconnect-aws.htm |
| Oracle Interconnect for Google Cloud | oci-interconnect-google-cloud | network-fabric | done | https://docs.oracle.com/en-us/iaas/Content/multicloud/interconnect-gcp.htm |
| Oracle Database Service for Azure (ODSA) | — | — | skip: superseded by Oracle AI Database@Azure | https://docs.oracle.com/en-us/iaas/Content/multicloud/oracledbazure.htm |
| Oracle Multicloud Hub | — | — | skip: console view over multicloud deployments | https://docs.oracle.com/en-us/iaas/Content/multicloud/home.htm |

## Migration and disaster recovery

| resource | id | kind | status | source |
|---|---|---|---|---|
| Full Stack Disaster Recovery protection group | oci-full-stack-disaster-recovery | backup-service | done | https://docs.oracle.com/en-us/iaas/disaster-recovery/doc/overview-protection-groups.html |
| Cloud Migrations discovery and replication | — | — | skip: covered by the Oracle Cloud Migrations row in the database migration family | https://docs.oracle.com/en-us/iaas/Content/cloud-migration/home.htm |
| Migration assessment and inventory reports | — | — | skip: assessment output, not a node | https://docs.oracle.com/en-us/iaas/Content/cloud-migration/home.htm |

---

## Kind proposals

| NEW id | why no existing kind fits |
|---|---|
| content-repository | A headless content management instance holds content types with a schema, asset and document repositories with a storage quota, publishing channels each bound to a delivery target, a preview-versus-published state, and a delivery cache TTL. `artifact-repository` models build and package artifacts with formats and retention, and has nothing to say about publishing channels or a preview/published split; `object-store` holds opaque blobs with no content model; `app-server` has a runtime and scaling but no repository. A rule that checks a publishing channel is fronted by a CDN, or that a content repository's assets are encrypted with a customer-managed key, needs properties only this kind carries. Used by Oracle Content Management. |

## Counts

total 240, todo 0, done 168, skip 72.
