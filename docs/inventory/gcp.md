# GCP inventory

Official product directory: <https://cloud.google.com/products> and the Google Cloud
documentation index <https://cloud.google.com/docs>. Product lifecycle states are taken from
the per-product deprecation notices in the official documentation. Firebase rows come from
<https://firebase.google.com/products-build>; Google Maps Platform rows from
<https://developers.google.com/maps/documentation>. Families below use Google's own directory
headings. One row per resource a designer places; composite services are split into their
placeable sub-resources.

Status: `done` = component exists in `components/gcp/`. `todo` = to be written.
`skip: <reason>` = cannot be a node in a design. Products that Google has retired or fully
shut down, and non-node tooling (CLIs, IDE plugins, consoles, assessment utilities,
marketplaces, billing), are `skip`. Products in deprecation or maintenance that are still
usable stay `todo` with the date noted; the component header records the date.

Several products were renamed in the 2026 console refresh (Vertex AI surfaces to the Gemini
Enterprise Agent Platform, Dataplex to Dataplex Universal Catalog / Knowledge Catalog, Looker
Studio to Data Studio, Cloud Firewall to Cloud NGFW, Cloud Composer to Managed Service for
Apache Airflow, Dataproc Serverless to Managed Service for Apache Spark). Rows carry the
documentation name with the former name in parentheses so an id stays stable across renames.

---

## Compute

| resource | id | kind | status | source |
|---|---|---|---|---|
| Compute Engine VM instance | google-compute-engine | virtual-machine | done | https://cloud.google.com/compute/docs/instances |
| Compute Engine Spot VM | google-spot-vm | virtual-machine | done | https://cloud.google.com/compute/docs/instances/spot |
| Compute Engine managed instance group | google-managed-instance-group | virtual-machine | done | https://cloud.google.com/compute/docs/instance-groups |
| Compute Engine sole-tenant node group | google-sole-tenant-node | virtual-machine | done | https://cloud.google.com/compute/docs/nodes/sole-tenant-nodes |
| Confidential VM | google-confidential-vm | virtual-machine | done | https://cloud.google.com/confidential-computing/confidential-vm/docs/confidential-vm-overview |
| Cloud TPU node | google-cloud-tpu | virtual-machine | done | https://cloud.google.com/tpu/docs/intro-to-tpu |
| Bare Metal Solution server | google-bare-metal-solution | virtual-machine | done | https://cloud.google.com/bare-metal/docs/bms-planning |
| Google Cloud VMware Engine private cloud | google-vmware-engine | virtual-machine | done | https://cloud.google.com/vmware-engine/docs/concepts-private-cloud |
| Batch job | google-batch | worker | done | https://cloud.google.com/batch/docs/get-started |
| Cluster Director (AI Hypercomputer cluster) | google-cluster-director | big-data-cluster | done | https://cloud.google.com/cluster-director/docs/overview |
| Cloud Workstations workstation | google-cloud-workstations | virtual-desktop | done | https://cloud.google.com/workstations/docs/customize-development-environment |
| Preemptible VM | — | — | skip: superseded by Spot VMs, same resource | https://cloud.google.com/compute/docs/instances/preemptible |
| Shielded VM | — | — | skip: boot security configuration of a Compute Engine VM | https://cloud.google.com/security/products/shielded-vm |
| Cloud GPUs | — | — | skip: accelerator attached to a VM or GKE node | https://cloud.google.com/gpu |
| Container-Optimized OS | — | — | skip: machine image, not a resource | https://cloud.google.com/container-optimized-os/docs |
| Deep Learning VM Images / Deep Learning Containers | — | — | skip: machine images and container images | https://cloud.google.com/deep-learning-vm/docs |
| Instance templates / machine images / custom images | — | — | skip: configuration and image artifacts | https://cloud.google.com/compute/docs/instance-templates |
| Reservations / committed use discounts | — | — | skip: capacity and purchasing constructs | https://cloud.google.com/compute/docs/instances/reservations-overview |
| VM Manager | — | — | skip: patch and configuration management feature over existing VMs | https://cloud.google.com/compute/docs/vm-manager |
| Capacity Planner | — | — | skip: planning and forecasting tool | https://cloud.google.com/compute/docs/capacity-planner |
| Workload Manager | — | — | skip: workload assessment and validation tooling | https://cloud.google.com/workload-manager/docs |
| Cluster Toolkit | — | — | skip: deployment templates, not a resource | https://cloud.google.com/cluster-toolkit/docs |
| SAP on Google Cloud | — | — | skip: solution guidance over Compute Engine resources | https://cloud.google.com/solutions/sap |
| AI Hypercomputer | — | — | skip: umbrella architecture over TPUs, GPUs and Cluster Director | https://cloud.google.com/ai-hypercomputer/docs |

## Containers and application hosting

| resource | id | kind | status | source |
|---|---|---|---|---|
| Google Kubernetes Engine Standard cluster | google-gke | container-orchestrator | done | https://cloud.google.com/kubernetes-engine/docs/concepts/regional-clusters |
| GKE Autopilot cluster | google-gke-autopilot | container-orchestrator | done | https://cloud.google.com/kubernetes-engine/docs/concepts/autopilot-overview |
| GKE Enterprise (Anthos) fleet | google-gke-enterprise | container-orchestrator | done | https://cloud.google.com/kubernetes-engine/fleet-management/docs/fleet-concepts |
| GKE Multi-Cloud (attached, AWS, Azure clusters) | google-gke-multi-cloud | container-orchestrator | done | https://cloud.google.com/kubernetes-engine/multi-cloud/docs |
| Cluster Services for OpenShift | google-openshift-cluster-services | container-orchestrator | done | https://cloud.google.com/openshift-cluster/overview |
| Cloud Run service | google-cloud-run | app-server | done | https://cloud.google.com/run/docs/overview/what-is-cloud-run |
| Cloud Run job | google-cloud-run-job | worker | done | https://cloud.google.com/run/docs/create-jobs |
| Cloud Run functions (Cloud Functions) | google-cloud-functions | app-server | done | https://cloud.google.com/sdk/gcloud/reference/functions/deploy |
| Cloud Run worker pool | google-cloud-run-worker-pool | worker | done | https://cloud.google.com/run/docs/resource-model |
| App Engine standard environment service | google-app-engine-standard | app-server | done | https://cloud.google.com/appengine/docs/standard |
| App Engine flexible environment service | google-app-engine-flexible | app-server | done | https://cloud.google.com/appengine/docs/flexible/reference/app-yaml |
| Artifact Registry repository | google-artifact-registry | container-registry | done | https://cloud.google.com/artifact-registry/docs/cmek |
| Backup for GKE backup plan | google-backup-for-gke | backup-service | done | https://cloud.google.com/kubernetes-engine/docs/add-on/backup-for-gke/concepts/backup-for-gke |
| Container Registry | — | — | skip: fully shut down 18 March 2025, replaced by Artifact Registry | https://cloud.google.com/artifact-registry/docs/transition/transition-from-gcr |
| Artifact Analysis | — | — | skip: vulnerability scanning feature of Artifact Registry | https://cloud.google.com/artifact-analysis/docs/artifact-analysis |
| Knative serving | — | — | skip: open-source API surface implemented by Cloud Run | https://cloud.google.com/kubernetes-engine/enterprise/knative-serving/docs |
| Buildpacks | — | — | skip: build tooling, not a resource | https://cloud.google.com/docs/buildpacks/overview |
| GKE node pools / workloads | — | — | skip: configuration inside a cluster | https://cloud.google.com/kubernetes-engine/docs/concepts/node-pools |
| Google Cloud Game Servers | — | — | skip: fully shut down, no replacement service | https://cloud.google.com/game-servers/docs |

## Storage

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cloud Storage bucket | gcs | object-store | done | https://cloud.google.com/storage/docs/introduction |
| Persistent Disk volume | google-persistent-disk | block-storage | done | https://cloud.google.com/compute/docs/disks/persistent-disks |
| Hyperdisk volume | google-hyperdisk | block-storage | done | https://cloud.google.com/compute/docs/disks/hyperdisks |
| Local SSD | google-local-ssd | block-storage | done | https://cloud.google.com/compute/docs/disks/local-ssd |
| Filestore instance | google-filestore | file-storage | done | https://cloud.google.com/sdk/gcloud/reference/filestore/instances/create |
| Parallelstore instance | google-parallelstore | file-storage | done | https://cloud.google.com/parallelstore/docs/overview |
| Google Cloud Managed Lustre instance | google-managed-lustre | file-storage | done | https://cloud.google.com/managed-lustre/docs/overview |
| NetApp Volumes volume | google-netapp-volumes | file-storage | done | https://cloud.google.com/netapp/volumes/docs/configure-and-use/storage-pools/overview |
| Backup and DR Service backup vault | google-backup-and-dr | backup-service | done | https://cloud.google.com/backup-disaster-recovery/docs/concepts/backup-vault |
| Storage Transfer Service transfer job | google-storage-transfer-service | worker | done | https://cloud.google.com/storage-transfer/docs/create-transfers |
| Cloud FTP server | google-cloud-ftp | app-server | done | https://cloud.google.com/cloud-ftp/overview |
| Cloud Storage storage classes (Standard, Nearline, Coldline, Archive) | — | — | skip: storage class of a bucket or object, not separate nodes | https://cloud.google.com/storage/docs/storage-classes |
| Cloud Storage Anywhere Cache | — | — | skip: read cache feature attached to a bucket | https://cloud.google.com/storage/docs/anywhere-cache |
| Cloud Storage FUSE | — | — | skip: client-side mount adapter | https://cloud.google.com/storage/docs/cloud-storage-fuse/overview |
| Cloud Storage lifecycle rules / Object Versioning / Retention policies | — | — | skip: configuration of a bucket | https://cloud.google.com/storage/docs/lifecycle |
| Persistent Disk snapshots | — | — | skip: backup artifacts of a disk | https://cloud.google.com/compute/docs/disks/snapshots |
| Transfer Appliance | — | — | skip: physical offline transfer appliance | https://cloud.google.com/transfer-appliance/docs/4.0/overview |

## Databases

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cloud SQL instance | google-cloud-sql | sql-database | done | https://cloud.google.com/sql/docs/mysql/create-instance |
| Cloud SQL Auth Proxy | google-cloud-sql-auth-proxy | database-proxy | done | https://cloud.google.com/sql/docs/mysql/sql-proxy |
| AlloyDB for PostgreSQL cluster | google-alloydb | sql-database | done | https://cloud.google.com/alloydb/docs/backup/overview |
| Spanner instance | spanner | sql-database | done | https://cloud.google.com/spanner/docs/overview |
| Spanner Graph | google-spanner-graph | graph-database | done | https://cloud.google.com/spanner/docs/graph/overview |
| Oracle Database@Google Cloud (Exadata, Autonomous Database) | google-oracle-database | sql-database | done | https://cloud.google.com/oracle/database/docs/overview |
| Bigtable instance | bigtable | nosql-database | done | https://cloud.google.com/bigtable/docs/overview |
| Firestore in Native mode database | firestore | nosql-database | done | https://cloud.google.com/firestore/docs |
| Firestore in Datastore mode database | google-firestore-datastore-mode | nosql-database | done | https://cloud.google.com/datastore/docs/concepts/overview |
| Firestore with MongoDB compatibility | google-firestore-mongodb | nosql-database | done | https://cloud.google.com/firestore/mongodb-compatibility/docs/overview |
| Memorystore for Redis instance | google-memorystore | cache | done | https://cloud.google.com/memorystore/docs/redis/supported-redis-configurations |
| Memorystore for Redis Cluster | google-memorystore-redis-cluster | cache | done | https://cloud.google.com/sdk/gcloud/reference/redis/clusters/create |
| Memorystore for Valkey | google-memorystore-valkey | cache | done | https://cloud.google.com/memorystore/docs/valkey/product-overview |
| Memorystore for Memcached | google-memorystore-memcached | cache | done | https://cloud.google.com/memorystore/docs/memcached/memcached-overview |
| Database Migration Service migration job | google-database-migration-service | change-data-capture | done | https://cloud.google.com/database-migration/docs/mysql/faq |
| Cloud SQL for MySQL / PostgreSQL / SQL Server | — | — | skip: the engine is a property of a Cloud SQL instance, not a separate node | https://cloud.google.com/sql/docs/introduction |
| Cloud SQL Enterprise / Enterprise Plus editions | — | — | skip: edition of an instance | https://cloud.google.com/sql/docs/editions-intro |
| AlloyDB Omni | — | — | skip: downloadable self-managed software, belongs to the `default` provider | https://cloud.google.com/alloydb/omni/docs |
| Spanner Omni | — | — | skip: self-managed deployment option of the Spanner software | https://cloud.google.com/spanner/docs |
| Bigtable Data Boost | — | — | skip: serverless compute mode of a Bigtable instance | https://cloud.google.com/bigtable/docs/data-boost-overview |
| Database Center | — | — | skip: fleet management console over existing databases | https://cloud.google.com/database-center/docs/overview |
| Cloud Datastore (legacy) | — | — | skip: superseded by Firestore in Datastore mode, same resource | https://cloud.google.com/datastore/docs/concepts/overview |

## Networking — connectivity

| resource | id | kind | status | source |
|---|---|---|---|---|
| Virtual Private Cloud network | google-vpc | network-fabric | done | https://cloud.google.com/vpc/docs/vpc |
| VPC subnet | google-vpc-subnet | network-fabric | done | https://cloud.google.com/vpc/docs/subnets |
| Cloud NAT gateway | google-cloud-nat | nat-gateway | done | https://cloud.google.com/nat/docs/overview |
| Cloud Router | google-cloud-router | network-fabric | done | https://cloud.google.com/network-connectivity/docs/router/concepts/overview |
| Cloud VPN gateway | google-cloud-vpn | vpn-gateway | done | https://cloud.google.com/network-connectivity/docs/vpn/concepts/overview |
| Cloud Interconnect (Dedicated, Partner) | google-cloud-interconnect | network-fabric | done | https://cloud.google.com/network-connectivity/docs/interconnect/concepts/overview |
| Cross-Cloud Interconnect | google-cross-cloud-interconnect | network-fabric | done | https://cloud.google.com/network-connectivity/docs/interconnect/concepts/cci-overview |
| Network Connectivity Center hub | google-network-connectivity-center | network-fabric | done | https://cloud.google.com/network-connectivity/docs/network-connectivity-center/concepts/overview |
| Private Service Connect endpoint | google-private-service-connect | private-link | done | https://cloud.google.com/vpc/docs/private-service-connect |
| Service Directory namespace | google-service-directory | coordination-service | done | https://cloud.google.com/service-directory/docs/overview |
| Cloud Service Mesh | google-cloud-service-mesh | service-mesh | done | https://cloud.google.com/service-mesh/docs/overview |
| Cloud DNS managed zone | google-cloud-dns | dns | done | https://cloud.google.com/dns/docs/overview |
| Cloud Domains registration | google-cloud-domains | dns | done | https://cloud.google.com/domains/docs/overview |
| VPC Network Peering | — | — | skip: a connection between two VPC networks, drawn as an edge | https://cloud.google.com/vpc/docs/vpc-peering |
| Shared VPC | — | — | skip: cross-project sharing configuration of a VPC network | https://cloud.google.com/vpc/docs/shared-vpc |
| Network Service Tiers (Premium, Standard) | — | — | skip: routing tier setting on an IP address | https://cloud.google.com/network-tiers/docs/overview |
| Cloud Location Finder | — | — | skip: region and zone metadata lookup API | https://cloud.google.com/location-finder/docs/overview |
| Cloud Number Registry | — | — | skip: IP address inventory and registry service, not a placeable node | https://cloud.google.com/number-registry/docs |
| Data Transfer Essentials | — | — | skip: egress billing option | https://cloud.google.com/network-connectivity/docs/data-transfer-essentials |
| Traffic Director | — | — | skip: renamed Cloud Service Mesh, same resource | https://cloud.google.com/service-mesh/docs/overview |
| External IP address | google-external-ip-address | network-fabric | done | https://cloud.google.com/vpc/docs/ip-addresses |

## Networking — delivery and security

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cloud Load Balancing forwarding rule | google-cloud-load-balancing | load-balancer | done | https://cloud.google.com/load-balancing/docs/load-balancing-overview |
| Cloud CDN | google-cloud-cdn | cdn | done | https://cloud.google.com/cdn/docs/overview |
| Media CDN service | google-media-cdn | cdn | done | https://cloud.google.com/media-cdn/docs/overview |
| Service Extensions callout / plugin | google-service-extensions | app-server | done | https://cloud.google.com/service-extensions/docs/overview |
| Google Cloud Armor security policy | google-cloud-armor | waf | done | https://cloud.google.com/armor/docs/cloud-armor-overview |
| Cloud NGFW (Cloud Firewall) policy | google-cloud-ngfw | firewall | done | https://cloud.google.com/firewall/docs/about-firewalls |
| Cloud IDS endpoint | google-cloud-ids | firewall | done | https://cloud.google.com/intrusion-detection-system/docs/overview |
| Secure Web Proxy | google-secure-web-proxy | firewall | done | https://cloud.google.com/secure-web-proxy/docs/overview |
| VPC Service Controls perimeter | google-vpc-service-controls | policy-engine | done | https://cloud.google.com/vpc-service-controls/docs/overview |
| Identity-Aware Proxy | google-identity-aware-proxy | bastion-host | done | https://cloud.google.com/iap/docs/concepts-overview |
| Chrome Enterprise Premium (BeyondCorp Enterprise) | google-chrome-enterprise-premium | bastion-host | done | https://cloud.google.com/beyondcorp-enterprise/docs/overview |
| reCAPTCHA Enterprise | google-recaptcha-enterprise | waf | done | https://cloud.google.com/recaptcha/docs/overview |
| Network Intelligence Center | google-network-intelligence-center | monitoring | done | https://cloud.google.com/network-intelligence-center/docs/overview |
| External / internal Application and Network Load Balancer variants | — | — | skip: the scheme and protocol are properties of a Cloud Load Balancing resource | https://cloud.google.com/load-balancing/docs/choosing-load-balancer |
| Cloud Armor Managed Protection (DDoS defence) | — | — | skip: protection tier of a Google Cloud Armor policy | https://cloud.google.com/armor/docs/managed-protection-overview |
| VPC firewall rules | — | — | skip: rules inside a Cloud NGFW policy | https://cloud.google.com/firewall/docs/firewalls |
| Network Security Integration | — | — | skip: framework for inserting partner appliances into a VPC | https://cloud.google.com/network-security-integration/docs/overview |
| VPC Flow Logs | — | — | skip: logging configuration on a subnet | https://cloud.google.com/vpc/docs/flow-logs |
| Secure Access Connect | — | — | skip: connectivity broker feature of Chrome Enterprise Premium | https://cloud.google.com/beyondcorp-enterprise/docs/overview |
| Web Security Scanner | — | — | skip: on-demand scan feature of Security Command Center | https://cloud.google.com/security-command-center/docs/concepts-web-security-scanner-overview |

## Security and data protection

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cloud Key Management Service key ring | google-cloud-kms | key-management | done | https://cloud.google.com/kms/docs/key-management-service |
| Cloud HSM | google-cloud-hsm | key-management | done | https://cloud.google.com/kms/docs/hsm |
| Cloud External Key Manager (Cloud EKM) | google-cloud-ekm | key-management | done | https://cloud.google.com/kms/docs/ekm |
| Secret Manager secret | google-secret-manager | key-management | done | https://cloud.google.com/secret-manager/docs/overview |
| Certificate Manager | google-certificate-manager | key-management | done | https://cloud.google.com/certificate-manager/docs/overview |
| Certificate Authority Service CA pool | google-certificate-authority-service | key-management | done | https://cloud.google.com/certificate-authority-service/docs/ca-service-overview |
| Sensitive Data Protection (Cloud DLP) | google-sensitive-data-protection | monitoring | done | https://cloud.google.com/sensitive-data-protection/docs/sensitive-data-protection-overview |
| Security Command Center | google-security-command-center | monitoring | done | https://cloud.google.com/security-command-center/docs/security-command-center-overview |
| Google Security Operations (Chronicle) | google-security-operations | monitoring | done | https://cloud.google.com/chronicle/docs/secops/secops-overview |
| Binary Authorization policy | google-binary-authorization | policy-engine | done | https://cloud.google.com/binary-authorization/docs/overview |
| Model Armor | google-model-armor | policy-engine | done | https://cloud.google.com/security-command-center/docs/model-armor-overview |
| Assured Workloads folder | google-assured-workloads | policy-engine | done | https://cloud.google.com/assured-workloads/docs/overview |
| Access Context Manager access level | google-access-context-manager | policy-engine | done | https://cloud.google.com/access-context-manager/docs/overview |
| Organization Policy Service constraint | google-organization-policy | policy-engine | done | https://cloud.google.com/resource-manager/docs/organization-policy/overview |
| Cloud Asset Inventory | google-cloud-asset-inventory | data-catalog | done | https://cloud.google.com/asset-inventory/docs/overview |
| Web Risk API | google-web-risk | third-party-api | done | https://cloud.google.com/web-risk/docs/overview |
| reCAPTCHA Fraud Prevention (Fraud Defense) | google-fraud-defense | third-party-api | done | https://cloud.google.com/recaptcha/docs/fraud-prevention |
| Confidential Computing | — | — | skip: covered by the Confidential VM row under Compute | https://cloud.google.com/confidential-computing/docs |
| Policy Intelligence | — | — | skip: recommendation and analysis tooling over IAM policies | https://cloud.google.com/policy-intelligence/docs/overview |
| Resource Manager (organizations, folders, projects) | — | — | skip: account hierarchy, a container not a resource | https://cloud.google.com/resource-manager/docs/cloud-platform-resource-hierarchy |
| Cloud Audit Logs | — | — | skip: a log stream inside Cloud Logging | https://cloud.google.com/logging/docs/audit |
| Access Transparency / Access Approval | — | — | skip: operator access governance features | https://cloud.google.com/assured-workloads/access-approval/docs/overview |
| Audit Manager | — | — | skip: compliance reporting tooling | https://cloud.google.com/audit-manager/docs/overview |
| Advisory Notifications | — | — | skip: notification feed in the console | https://cloud.google.com/advisory-notifications/docs/overview |
| Assured Open Source Software | — | — | skip: curated package distribution, consumed through Artifact Registry | https://cloud.google.com/assured-open-source-software/docs/overview |
| Sovereign Controls by Partners | — | — | skip: contractual and operational control package | https://cloud.google.com/sovereign-controls-by-partners/docs |
| Cyber Insurance Hub | — | — | skip: partner insurance program | https://cloud.google.com/security/products/cyber-insurance-hub |
| Spectrum Access System | — | — | skip: regulatory radio coordination service, not a design node | https://cloud.google.com/spectrum-access-system/docs |

## Identity and access

| resource | id | kind | status | source |
|---|---|---|---|---|
| Identity and Access Management (IAM) policy | google-cloud-iam | policy-engine | done | https://cloud.google.com/iam/docs/overview |
| Identity Platform tenant | google-identity-platform | identity-provider | done | https://cloud.google.com/identity-platform/docs/concepts |
| Cloud Identity | google-cloud-identity | identity-provider | done | https://cloud.google.com/identity/docs/overview |
| Managed Service for Microsoft Active Directory domain | google-managed-microsoft-ad | identity-provider | done | https://cloud.google.com/managed-microsoft-ad/docs/overview |
| Workload Identity Federation | — | — | skip: trust configuration inside IAM | https://cloud.google.com/iam/docs/workload-identity-federation |
| Service accounts | — | — | skip: IAM principal, not a placeable resource | https://cloud.google.com/iam/docs/service-account-overview |
| Recommender | — | — | skip: recommendation engine over existing resources | https://cloud.google.com/recommender/docs/overview |
| Service Catalog | — | — | skip: internal catalogue of deployment templates | https://cloud.google.com/service-catalog/docs/overview |
| Cloud Marketplace | — | — | skip: marketplace | https://cloud.google.com/marketplace/docs |
| Service Usage / Cloud Quotas | — | — | skip: API enablement and quota administration | https://cloud.google.com/service-usage/docs/overview |
| Cloud Billing / Carbon Footprint / App Optimize API | — | — | skip: billing and cost management | https://cloud.google.com/billing/docs |
| Cloud Hub | — | — | skip: fleet overview console | https://cloud.google.com/cloud-hub/docs/overview |
| Cloud Customer Care | — | — | skip: support plan | https://cloud.google.com/support/docs |

## Data analytics — warehouse and governance

| resource | id | kind | status | source |
|---|---|---|---|---|
| BigQuery dataset | bigquery | data-warehouse | done | https://cloud.google.com/bigquery/docs/introduction |
| BigLake table / metastore | google-biglake | data-catalog | done | https://docs.cloud.google.com/bigquery/docs/biglake-intro |
| BigQuery Data Transfer Service transfer | google-bigquery-data-transfer | worker | done | https://docs.cloud.google.com/bigquery/docs/dts-introduction |
| Analytics Hub data exchange | google-analytics-hub | data-catalog | done | https://docs.cloud.google.com/bigquery/docs/analytics-hub-introduction |
| Dataplex Universal Catalog (Knowledge Catalog) | google-dataplex | data-catalog | done | https://docs.cloud.google.com/dataplex/docs/about-data-lineage |
| Dataproc Metastore service | google-dataproc-metastore | data-catalog | done | https://docs.cloud.google.com/dataproc-metastore/docs/service-tier |
| Looker (Google Cloud core) instance | google-looker | bi-service | done | https://docs.cloud.google.com/looker/docs/looker-core-overview |
| Data Studio (Looker Studio) report | google-looker-studio | bi-service | done | https://docs.cloud.google.com/looker/docs/studio/manage-data-freshness |
| Earth Engine | google-earth-engine | third-party-api | done | https://developers.google.com/earth-engine/guides/usage |
| BigQuery BI Engine | — | — | skip: in-memory acceleration layer of BigQuery | https://cloud.google.com/bigquery/docs/bi-engine-intro |
| BigQuery Omni | — | — | skip: cross-cloud query capability of BigQuery | https://cloud.google.com/bigquery/docs/omni-introduction |
| BigQuery ML | — | — | skip: SQL model training inside BigQuery | https://cloud.google.com/bigquery/docs/bqml-introduction |
| Data Catalog | — | — | skip: consolidated into Dataplex Universal Catalog, same resource | https://cloud.google.com/data-catalog/docs/concepts/overview |
| Lakehouse / Data Agent Kit | — | — | skip: console and SDK surfaces over BigQuery | https://cloud.google.com/bigquery/docs/introduction |
| Cortex Framework | — | — | skip: reference solution templates | https://cloud.google.com/cortex/docs/overview |
| Blockchain Analytics | — | — | skip: curated public BigQuery datasets | https://cloud.google.com/blockchain-analytics/docs/overview |

## Data analytics — processing and streaming

| resource | id | kind | status | source |
|---|---|---|---|---|
| Dataflow job | google-dataflow | stream-processor | done | https://cloud.google.com/dataflow/docs/overview |
| Dataproc cluster | google-dataproc | big-data-cluster | done | https://docs.cloud.google.com/sdk/gcloud/reference/dataproc/clusters/create |
| Dataproc job | dataproc-job | worker | done | https://cloud.google.com/dataproc/docs/concepts/jobs/life-of-a-job |
| Managed Service for Apache Spark (Dataproc Serverless) batch | google-dataproc-serverless | big-data-cluster | done | https://docs.cloud.google.com/dataproc-serverless/docs/concepts/properties |
| Managed Service for Apache Kafka cluster | google-managed-kafka | stream | done | https://docs.cloud.google.com/managed-service-for-apache-kafka/docs/overview |
| Pub/Sub topic | google-pubsub | pubsub-topic | done | https://cloud.google.com/pubsub/docs/overview |
| Cloud Data Fusion instance | google-cloud-data-fusion | worker | done | https://docs.cloud.google.com/data-fusion/docs/concepts/overview |
| Datastream stream | google-datastream | change-data-capture | done | https://docs.cloud.google.com/datastream/docs/behavior-overview |
| Dataform repository | google-dataform | ci-pipeline | done | https://docs.cloud.google.com/dataform/docs/overview |
| Cloud Composer (Managed Service for Apache Airflow) environment | google-cloud-composer | workflow-engine | done | https://docs.cloud.google.com/composer/docs/composer-3/composer-overview |
| Orchestration Pipelines | google-orchestration-pipelines | workflow-engine | done | https://docs.cloud.google.com/orchestration-pipelines/overview |
| Pub/Sub subscription | — | — | skip: the delivery edge from a topic to a consumer | https://cloud.google.com/pubsub/docs/subscriber |
| Pub/Sub Lite | — | — | skip: fully shut down 18 March 2026, use Pub/Sub or Managed Service for Apache Kafka | https://cloud.google.com/pubsub/lite/docs |
| Pub/Sub schemas | google-pubsub-schema | schema-registry | done | https://docs.cloud.google.com/pubsub/docs/schemas |
| Dataflow templates / Dataflow Prime | — | — | skip: job templates and execution mode of Dataflow | https://cloud.google.com/dataflow/docs/concepts/dataflow-templates |
| Cloud Dataprep by Trifacta | — | — | skip: retired partner-operated service | https://cloud.google.com/dataprep/docs |

## AI and ML — platform

| resource | id | kind | status | source |
|---|---|---|---|---|
| Vertex AI platform (Gemini Enterprise Agent Platform) | google-vertex-ai | ml-platform | done | https://cloud.google.com/vertex-ai/docs/start/introduction-unified-platform |
| Vertex AI endpoint | vertex-ai-endpoint | ml-inference | done | https://cloud.google.com/vertex-ai/docs/predictions/overview |
| Vertex AI training job (Managed Training) | google-vertex-ai-training | worker | done | https://cloud.google.com/vertex-ai/docs/training/overview |
| Vertex AI Pipelines | google-vertex-ai-pipelines | ci-pipeline | done | https://cloud.google.com/vertex-ai/docs/pipelines/introduction |
| Vertex AI Feature Store | google-vertex-ai-feature-store | ml-platform | done | https://cloud.google.com/vertex-ai/docs/featurestore/latest/overview |
| Vertex AI Model Registry | google-vertex-ai-model-registry | artifact-repository | done | https://cloud.google.com/vertex-ai/docs/model-registry/introduction |
| Vertex AI Workbench instance | google-vertex-ai-workbench | ml-platform | done | https://cloud.google.com/vertex-ai/docs/workbench/instances/idle-shutdown |
| Colab Enterprise runtime | google-colab-enterprise | ml-platform | done | https://cloud.google.com/colab/docs/create-runtime-template |
| Vertex AI Vector Search index | google-vertex-ai-vector-search | vector-database | done | https://cloud.google.com/vertex-ai/docs/vector-search/overview |
| Vertex AI RAG Engine corpus | google-vertex-ai-rag-engine | ai-service | done | https://cloud.google.com/vertex-ai/generative-ai/docs/rag-overview |
| Vertex AI Search (Agent Search) data store | google-vertex-ai-search | search-index | done | https://cloud.google.com/generative-ai-app-builder/docs/introduction |
| Vertex AI Agent Engine (Agent Runtime) | google-vertex-ai-agent-engine | app-server | done | https://cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/overview |
| Agent Gateway | google-agent-gateway | api-gateway | done | https://cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/overview |
| Agent Registry | google-agent-registry | data-catalog | done | https://cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/overview |
| Gemini API | google-gemini-api | ai-service | done | https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/configure-safety-filters |
| Enterprise Knowledge Graph | google-enterprise-knowledge-graph | graph-database | done | https://cloud.google.com/enterprise-knowledge-graph/docs/overview |
| Neural Architecture Search | google-neural-architecture-search | ml-platform | done | https://cloud.google.com/vertex-ai/docs/training/neural-architecture-search/overview |
| Cloud TPU | — | — | skip: covered by the Cloud TPU row under Compute | https://cloud.google.com/tpu/docs/intro-to-tpu |
| Model Garden | — | — | skip: model catalogue inside Vertex AI | https://cloud.google.com/vertex-ai/generative-ai/docs/model-garden/explore-models |
| AutoML | — | — | skip: training mode inside Vertex AI, not a separate resource | https://cloud.google.com/vertex-ai/docs/beginner/beginners-guide |
| Vertex AI Model Monitoring | — | — | skip: monitoring feature attached to an endpoint | https://cloud.google.com/vertex-ai/docs/model-monitoring/overview |
| Vertex AI Experiments / TensorBoard | — | — | skip: experiment tracking and visualization features | https://cloud.google.com/vertex-ai/docs/experiments/intro-vertex-ai-experiments |
| Ray on Vertex AI | — | — | skip: cluster mode inside Vertex AI training | https://cloud.google.com/vertex-ai/docs/open-source/ray-on-vertex-ai/overview |
| Agent Development Kit (ADK) | — | — | skip: open-source SDK | https://cloud.google.com/vertex-ai/generative-ai/docs/agent-development-kit/quickstart |
| Agent Studio | — | — | skip: console authoring surface | https://cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/overview |
| TensorFlow Enterprise | — | — | skip: software distribution | https://cloud.google.com/tensorflow-enterprise/docs/overview |
| Gemini Cloud Assist / Gemini in BigQuery / Gemini in Looker | — | — | skip: assistant features inside other products | https://cloud.google.com/gemini/docs/cloud-assist/overview |
| AI Platform (legacy) | — | — | skip: superseded by Vertex AI | https://cloud.google.com/vertex-ai/docs/start/migrating-to-vertex-ai |

## AI and ML — applied APIs

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cloud Vision API | google-cloud-vision | ai-service | done | https://docs.cloud.google.com/vision/quotas |
| Vision API Product Search | google-vision-product-search | search-index | done | https://docs.cloud.google.com/vision/product-search/quotas |
| Speech-to-Text | google-speech-to-text | ai-service | done | https://docs.cloud.google.com/speech-to-text/quotas |
| Text-to-Speech | google-text-to-speech | ai-service | done | https://docs.cloud.google.com/text-to-speech/quotas |
| Cloud Natural Language API | google-cloud-natural-language | ai-service | done | https://docs.cloud.google.com/natural-language/quotas |
| Cloud Translation API | google-cloud-translation | ai-service | done | https://docs.cloud.google.com/translate/quotas |
| Document AI processor | google-document-ai | ai-service | done | https://docs.cloud.google.com/document-ai/quotas |
| Video Intelligence API | google-video-intelligence | ai-service | done | https://docs.cloud.google.com/video-intelligence/quotas |
| Conversational Agents (Dialogflow CX) agent | google-dialogflow-cx | ai-service | done | https://docs.cloud.google.com/dialogflow/quotas |
| Dialogflow ES agent | google-dialogflow-es | ai-service | done | https://docs.cloud.google.com/dialogflow/quotas |
| Agent Assist | google-agent-assist | ai-service | done | https://docs.cloud.google.com/agent-assist/docs/features |
| Google Cloud CCaaS (Contact Center as a Service) | google-ccaas | contact-center | done | https://docs.cloud.google.com/contact-center/ccai-platform/docs/setup-agents-channels |
| Conversational Insights (Customer Experience Insights) | google-customer-experience-insights | ai-service | done | https://docs.cloud.google.com/contact-center/insights/docs/ttl |
| AI Commerce Search (Vertex AI Search for commerce) | google-vertex-ai-search-commerce | search-index | done | https://docs.cloud.google.com/retail/docs/quotas |
| Contact Center AI (CCAI Platform) | — | — | skip: renamed Google Cloud CCaaS, same resource | https://cloud.google.com/ccaas/docs/overview |
| Recommendations AI | — | — | skip: merged into Vertex AI Search for commerce | https://cloud.google.com/retail/docs/overview |
| Cloud Inference API | — | — | skip: retired timeseries inference API | https://cloud.google.com/inference/docs |

## Operations and observability

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cloud Monitoring workspace | google-cloud-monitoring | monitoring | done | https://cloud.google.com/monitoring/docs/monitoring-overview |
| Cloud Logging log bucket | google-cloud-logging | monitoring | done | https://cloud.google.com/logging/quotas |
| Cloud Trace | google-cloud-trace | monitoring | done | https://cloud.google.com/trace/docs/quotas |
| Cloud Profiler | google-cloud-profiler | monitoring | done | https://cloud.google.com/profiler/docs/about-profiler |
| Error Reporting | google-error-reporting | monitoring | done | https://cloud.google.com/error-reporting/quotas |
| Google Cloud Managed Service for Prometheus | google-managed-prometheus | timeseries-database | done | https://cloud.google.com/stackdriver/docs/managed-prometheus |
| Personalized Service Health | google-service-health | monitoring | done | https://cloud.google.com/service-health/docs/overview |
| Infrastructure Manager deployment | google-infrastructure-manager | ci-pipeline | done | https://cloud.google.com/infrastructure-manager/docs/overview |
| Config Connector | google-config-connector | ci-pipeline | done | https://cloud.google.com/config-connector/docs/overview |
| Config Sync | google-config-sync | ci-pipeline | done | https://cloud.google.com/kubernetes-engine/enterprise/config-sync/docs/how-to/installing-config-sync |
| Config Controller | google-config-controller | ci-pipeline | done | https://cloud.google.com/kubernetes-engine/enterprise/config-controller/docs/setup |
| Policy Controller | google-policy-controller | policy-engine | done | https://cloud.google.com/kubernetes-engine/enterprise/policy-controller/docs/how-to/installing-policy-controller |
| Google Cloud Observability | — | — | skip: umbrella name for Logging, Monitoring, Trace and Profiler | https://cloud.google.com/stackdriver/docs |
| Cloud Deployment Manager | — | — | skip: end of support 31 December 2025, use Infrastructure Manager or Terraform | https://cloud.google.com/deployment-manager/docs |
| Terraform on Google Cloud / CDKTF / Pulumi / Ansible / Crossplane | — | — | skip: third-party infrastructure-as-code tooling, not Google resources | https://cloud.google.com/docs/terraform |
| App Hub | — | — | skip: application metadata layer over existing resources | https://cloud.google.com/app-hub/docs/overview |
| Application Design Center | — | — | skip: design and authoring console | https://cloud.google.com/application-design-center/docs/overview |
| Unified Maintenance | — | — | skip: maintenance window scheduling across products | https://cloud.google.com/unified-maintenance/docs/overview |
| Uptime checks / alerting policies / dashboards | — | — | skip: configuration inside Cloud Monitoring | https://cloud.google.com/monitoring/uptime-checks |

## Application development and integration

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cloud Build trigger | google-cloud-build | ci-pipeline | done | https://cloud.google.com/build/docs/build-config-file-schema |
| Cloud Deploy delivery pipeline | google-cloud-deploy | ci-pipeline | done | https://cloud.google.com/deploy/docs/overview |
| Secure Source Manager instance | google-secure-source-manager | artifact-repository | done | https://cloud.google.com/secure-source-manager/docs/overview |
| Cloud Source Repositories | google-cloud-source-repositories | artifact-repository | done | https://cloud.google.com/source-repositories/docs |
| Cloud Scheduler job | google-cloud-scheduler | worker | done | https://cloud.google.com/scheduler/docs/reference/rest/v1/projects.locations.jobs |
| Cloud Tasks queue | google-cloud-tasks | queue | done | https://cloud.google.com/tasks/docs/dual-overview |
| Workflows workflow | google-cloud-workflows | workflow-engine | done | https://cloud.google.com/workflows/quotas |
| Eventarc trigger | google-eventarc | pubsub-topic | done | https://cloud.google.com/eventarc/docs/overview |
| Application Integration integration | google-application-integration | workflow-engine | done | https://cloud.google.com/application-integration/docs/overview |
| Integration Connectors connection | google-integration-connectors | third-party-api | done | https://cloud.google.com/integration-connectors/docs/connectors/apachekafka/configure |
| Blockchain Node Engine node | google-blockchain-node-engine | ledger | done | https://cloud.google.com/blockchain-node-engine/docs/create-node-ethereum |
| Blockchain RPC | google-blockchain-rpc | third-party-api | done | https://cloud.google.com/blockchain-rpc/docs/overview |
| Developer Connect | — | — | skip: connection to an external source repository | https://cloud.google.com/developer-connect/docs/overview |
| Cloud Shell | — | — | skip: browser terminal, not a node | https://cloud.google.com/shell/docs |
| Cloud Code (VS Code, IntelliJ, Cloud Shell) | — | — | skip: IDE plugins | https://cloud.google.com/code/docs |
| Firebase Studio | — | — | skip: browser IDE | https://firebase.google.com/docs/studio |
| GitLab on Google Cloud | — | — | skip: partner-managed offering | https://cloud.google.com/gitlab |
| Developer Device Platform | — | — | skip: managed developer workstation hardware program | https://cloud.google.com/developer-device-platform/docs |
| Service Infrastructure | — | — | skip: internal platform used by service producers | https://cloud.google.com/service-infrastructure/docs/overview |
| Google Cloud SDK / gcloud CLI / client libraries | — | — | skip: command line and language tooling | https://cloud.google.com/sdk/docs |

## API management

| resource | id | kind | status | source |
|---|---|---|---|---|
| Apigee API Management organization | apigee | api-gateway | done | https://cloud.google.com/apigee/docs/api-platform/get-started/what-apigee |
| Apigee hybrid runtime | google-apigee-hybrid | api-gateway | done | https://cloud.google.com/apigee/docs/hybrid/latest/what-is-hybrid |
| API Gateway | google-api-gateway | api-gateway | done | https://cloud.google.com/api-gateway/docs/about-api-gateway |
| Cloud Endpoints (ESPv2) | google-cloud-endpoints | api-gateway | done | https://cloud.google.com/endpoints/docs/openapi/about-cloud-endpoints |
| Cloud API Registry (Apigee API hub) | google-cloud-api-registry | data-catalog | done | https://cloud.google.com/apigee/docs/apihub/what-is-api-hub |
| Apigee Advanced API Security / API Analytics | — | — | skip: capabilities of an Apigee organization | https://cloud.google.com/apigee/docs/api-security |
| Apigee Edge (legacy) | — | — | skip: superseded by Apigee X, same resource | https://cloud.google.com/apigee/docs/api-platform/get-started/what-apigee |

## Distributed cloud and hybrid

| resource | id | kind | status | source |
|---|---|---|---|---|
| Google Distributed Cloud connected | google-distributed-cloud-connected | edge-appliance | done | https://docs.cloud.google.com/distributed-cloud/edge/latest/docs/overview |
| Google Distributed Cloud air-gapped | google-distributed-cloud-air-gapped | edge-appliance | done | https://docs.cloud.google.com/distributed-cloud/hosted/docs/latest/gdch/overview |
| Google Distributed Cloud software only for bare metal | google-distributed-cloud-bare-metal | container-orchestrator | done | https://docs.cloud.google.com/kubernetes-engine/distributed-cloud/bare-metal/docs/concepts/about-bare-metal |
| Google Distributed Cloud software only for VMware | google-distributed-cloud-vmware | container-orchestrator | done | https://docs.cloud.google.com/kubernetes-engine/distributed-cloud/vmware/docs/overview |
| Anthos | — | — | skip: renamed GKE Enterprise, same resource | https://cloud.google.com/kubernetes-engine/enterprise/docs/concepts/overview |
| Anthos clusters on AWS / Azure | — | — | skip: covered by the GKE Multi-Cloud row under Containers | https://cloud.google.com/kubernetes-engine/multi-cloud/docs |

## Media

| resource | id | kind | status | source |
|---|---|---|---|---|
| Transcoder API job | google-transcoder-api | media-transcoder | done | https://cloud.google.com/transcoder/docs/concepts/overview |
| Live Stream API channel | google-live-stream-api | media-transcoder | done | https://cloud.google.com/livestream/docs/overview |
| Video Stitcher API | google-video-stitcher-api | media-router | done | https://cloud.google.com/video-stitcher/docs/concepts/overview |
| Media CDN | — | — | skip: covered by the Media CDN row under Networking — delivery and security | https://cloud.google.com/media-cdn/docs/overview |
| Immersive Stream for XR | — | — | skip: retired streaming service | https://cloud.google.com/immersive-stream/xr/docs |

## Migration

| resource | id | kind | status | source |
|---|---|---|---|---|
| Migrate to Virtual Machines migration | google-migrate-to-virtual-machines | worker | done | https://docs.cloud.google.com/migrate/virtual-machines/docs/5.0/discover/lifecycle |
| Migrate to Containers migration | google-migrate-to-containers | worker | done | https://docs.cloud.google.com/migrate/containers/docs/getting-started |
| Dual Run | google-dual-run | worker | done | https://docs.cloud.google.com/mainframe-dual-run/docs/dual-run-overview |
| Migration Center | — | — | skip: assessment and planning tooling | https://cloud.google.com/migration-center/docs/migration-center-overview |
| Mainframe Assessment Tool | — | — | skip: assessment tooling | https://cloud.google.com/mainframe-modernization/docs/mainframe-assessment-tool-overview |
| Mainframe Connector | — | — | skip: on-premises command line utility run on the mainframe | https://cloud.google.com/mainframe-connector/docs/overview |
| Database Migration Service | — | — | skip: covered by the Database Migration Service row under Databases | https://cloud.google.com/database-migration/docs |
| Storage Transfer Service | — | — | skip: covered by the Storage Transfer Service row under Storage | https://cloud.google.com/storage-transfer/docs/overview |
| BigQuery Data Transfer Service | — | — | skip: covered by the row under Data analytics — warehouse and governance | https://cloud.google.com/bigquery/docs/dts-introduction |

## Industry solutions and specialized

| resource | id | kind | status | source |
|---|---|---|---|---|
| Cloud Healthcare API dataset (FHIR, DICOM, HL7v2 stores) | google-cloud-healthcare-api | nosql-database | done | https://docs.cloud.google.com/healthcare-api/docs/cmek |
| Anti Money Laundering AI | google-anti-money-laundering-ai | ai-service | done | https://docs.cloud.google.com/financial-services/anti-money-laundering/docs/concepts/overview |
| Cloud Talent Solution | google-cloud-talent-solution | search-index | done | https://docs.cloud.google.com/talent-solution/quotas |
| Telecom Subscriber Insights | google-telecom-subscriber-insights | ai-service | done | https://docs.cloud.google.com/telecom-subscriber-insights/docs |
| Telecom Network Automation | google-telecom-network-automation | ci-pipeline | done | https://docs.cloud.google.com/telecom-network-automation/docs/overview |
| Manufacturing Data Engine | google-manufacturing-data-engine | stream-processor | done | https://docs.cloud.google.com/manufacturing-data-engine/docs/overview |
| Manufacturing Connect | google-manufacturing-connect | iot-hub | done | https://docs.cloud.google.com/manufacturing-data-engine/docs/overview |
| Cloud IoT Core | — | — | skip: retired 16 August 2023, no replacement service | https://cloud.google.com/iot/docs/release-notes |
| Cloud Life Sciences | — | — | skip: fully shut down 8 July 2025 | https://cloud.google.com/life-sciences/docs/deprecations |
| Genomics API | — | — | skip: retired predecessor of Cloud Life Sciences | https://cloud.google.com/life-sciences/docs/deprecations |

## Firebase

| resource | id | kind | status | source |
|---|---|---|---|---|
| Firebase Authentication | google-firebase-auth | identity-provider | done | https://firebase.google.com/docs/auth |
| Firebase Hosting site | google-firebase-hosting | cdn | done | https://firebase.google.com/docs/hosting/manage-cache |
| Firebase App Hosting backend | google-firebase-app-hosting | app-server | done | https://firebase.google.com/docs/app-hosting/configure |
| Firebase Realtime Database instance | google-firebase-realtime-database | nosql-database | done | https://firebase.google.com/docs/database/backups |
| Firebase Cloud Messaging | fcm | notification-service | done | https://firebase.google.com/docs/cloud-messaging |
| Firebase In-App Messaging | google-firebase-in-app-messaging | notification-service | done | https://firebase.google.com/docs/in-app-messaging/modify-message-behavior |
| Firebase Crashlytics | google-firebase-crashlytics | monitoring | done | https://firebase.google.com/docs/crashlytics/customize-crash-reports |
| Firebase Performance Monitoring | google-firebase-performance-monitoring | monitoring | done | https://firebase.google.com/docs/perf-mon |
| Firebase Remote Config | google-firebase-remote-config | feature-flag-service | done | https://firebase.google.com/docs/remote-config/android/get-started |
| Firebase App Check | google-firebase-app-check | policy-engine | done | https://firebase.google.com/docs/app-check/monitor-metrics |
| Firebase Test Lab | google-firebase-test-lab | ci-pipeline | done | https://firebase.google.com/docs/test-lab/android/command-line |
| Firebase App Distribution | google-firebase-app-distribution | artifact-repository | done | https://firebase.google.com/docs/app-distribution/troubleshooting |
| Firebase Data Connect (SQL Connect) | google-firebase-data-connect | api-gateway | done | https://firebase.google.com/docs/data-connect/authorization-and-security |
| Firebase AI Logic | google-firebase-ai-logic | ai-service | done | https://firebase.google.com/docs/ai-logic |
| Cloud Firestore for Firebase | — | — | skip: the same resource as the Firestore row under Databases | https://firebase.google.com/docs/firestore |
| Cloud Storage for Firebase | — | — | skip: the same resource as a Cloud Storage bucket | https://firebase.google.com/docs/storage |
| Cloud Functions for Firebase | — | — | skip: the same resource as Cloud Run functions | https://firebase.google.com/docs/functions |
| Firebase A/B Testing | — | — | skip: experiment layer over Remote Config | https://firebase.google.com/docs/ab-testing |
| Firebase Extensions | — | — | skip: packaged deployments of Cloud Run functions | https://firebase.google.com/docs/extensions |
| Firebase Phone Number Verification | — | — | skip: sign-in method of Firebase Authentication | https://firebase.google.com/docs/auth/web/phone-auth |
| Google Analytics for Firebase | — | — | skip: Google Analytics property, outside the Google Cloud resource model | https://firebase.google.com/docs/analytics |
| Firebase Dynamic Links | — | — | skip: fully shut down 25 August 2025 | https://firebase.google.com/support/dynamic-links-faq |

## Google Maps Platform

| resource | id | kind | status | source |
|---|---|---|---|---|
| Maps JavaScript API | google-maps-javascript-api | third-party-api | done | https://developers.google.com/maps/documentation/javascript/usage-and-billing |
| Maps Static API | google-maps-static-api | third-party-api | done | https://developers.google.com/maps/documentation/maps-static/usage-and-billing |
| Street View Static API | google-street-view-static-api | third-party-api | done | https://developers.google.com/maps/documentation/streetview/usage-and-billing |
| Map Tiles API (Photorealistic 3D Tiles) | google-map-tiles-api | third-party-api | done | https://developers.google.com/maps/documentation/tile/usage-and-billing |
| Aerial View API | google-aerial-view-api | third-party-api | done | https://developers.google.com/maps/documentation/aerial-view/reference/rest/v1/videos/lookupVideo |
| Places API | google-places-api | third-party-api | done | https://developers.google.com/maps/documentation/places/web-service/usage-and-billing |
| Geocoding API | google-geocoding-api | third-party-api | done | https://developers.google.com/maps/documentation/geocoding/usage-and-billing |
| Address Validation API | google-address-validation-api | third-party-api | done | https://developers.google.com/maps/documentation/address-validation/usage-and-billing |
| Routes API | google-routes-api | third-party-api | done | https://developers.google.com/maps/documentation/routes/usage-and-billing |
| Route Optimization API | google-route-optimization-api | third-party-api | done | https://developers.google.com/maps/documentation/route-optimization/usage-and-billing |
| Roads API | google-roads-api | third-party-api | done | https://developers.google.com/maps/documentation/roads/usage-and-billing |
| Geolocation API | google-geolocation-api | third-party-api | done | https://developers.google.com/maps/documentation/geolocation/requests-geolocation |
| Time Zone API | google-time-zone-api | third-party-api | done | https://developers.google.com/maps/documentation/timezone/usage-and-billing |
| Elevation API | google-elevation-api | third-party-api | done | https://developers.google.com/maps/documentation/elevation/usage-and-billing |
| Air Quality API | google-air-quality-api | third-party-api | done | https://developers.google.com/maps/documentation/air-quality/usage-and-billing |
| Pollen API | google-pollen-api | third-party-api | done | https://developers.google.com/maps/documentation/pollen/usage-and-billing |
| Solar API | google-solar-api | third-party-api | done | https://developers.google.com/maps/documentation/solar/usage-and-billing |
| Weather API | google-weather-api | third-party-api | done | https://developers.google.com/maps/documentation/weather/overview |
| Directions API / Distance Matrix API | — | — | skip: superseded by the Routes API | https://developers.google.com/maps/documentation/routes/migrate-routes |
| Maps SDK for Android / iOS, Navigation SDK | — | — | skip: client SDKs | https://developers.google.com/maps/documentation/android-sdk/overview |
| Maps Datasets API | — | — | skip: data upload endpoint for styling layers | https://developers.google.com/maps/documentation/datasets/overview |

---

## Kind proposals

None. Every GCP resource in this inventory maps onto one of the 68 existing kinds. The three
kinds added during the AWS pass — `vector-database`, `media-transcoder` and `contact-center` —
cover the GCP resources that would otherwise have needed proposals (Vertex AI Vector Search,
Transcoder API and Live Stream API, Google Cloud CCaaS). The remaining judgement calls reuse
kinds the way the AWS inventory did: managed key, secret and certificate stores are
`key-management`; posture and detection services (Security Command Center, Google Security
Operations, Sensitive Data Protection) are `monitoring`; policy evaluators (IAM, Binary
Authorization, VPC Service Controls, Organization Policy, Firebase App Check) are
`policy-engine`; the Cloud Healthcare API is `nosql-database`, matching `aws-healthlake`;
notebook and workbench surfaces are `ml-platform`, matching `aws-sagemaker`.

## Mingrammer nodes not catalogued

| resource | id | kind | status | source |
|---|---|---|---|---|
| Firebase | — | — | skip: Brand/section logo for the Firebase platform, not a placeable runtime node. | https://diagrams.mingrammer.com/docs/nodes/firebase |
| ML Kit | — | — | skip: On-device mobile SDK, standalone and outside Firebase since 3 June 2020; its Firebase-hosted counterpart (Firebase ML) is deprecated and shuts down 15 June 2027. | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase App Indexing | — | — | skip: Retired: the App Indexing API was deprecated in 2019 and replaced by Android App Links; no longer a Firebase product. | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase Invites | — | — | skip: Retired: deprecated 24 January 2018 in favour of Dynamic Links and shut down two years later; Dynamic Links itself shut down 25 August 2025. | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase Predictions | — | — | skip: Retired: withdrawn from the Firebase product line and no longer documented or available to new projects. | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Firebase Crash Reporting | — | — | skip: Retired: deprecated in 2018 and shut down, superseded by Firebase Crashlytics. | https://diagrams.mingrammer.com/docs/nodes/firebase |
| Cloud Datalab | — | — | skip: retired notebook service, superseded by Vertex AI Workbench | https://cloud.google.com/vertex-ai/docs/workbench/introduction |
| VM Manager OS configuration management | — | — | skip: patch and configuration management feature over existing VMs | https://cloud.google.com/compute/docs/vm-manager |
| VM Manager OS inventory management | — | — | skip: patch and configuration management feature over existing VMs | https://cloud.google.com/compute/docs/vm-manager |
| VM Manager OS patch management | — | — | skip: patch and configuration management feature over existing VMs | https://cloud.google.com/compute/docs/vm-manager |
| Cloud Code for IntelliJ | — | — | skip: IDE plugin | https://cloud.google.com/code/docs/intellij |
| Cloud Code | — | — | skip: IDE plugins | https://cloud.google.com/code/docs |
| Gradle App Engine plugin | — | — | skip: build tool plugin, developer tooling | https://cloud.google.com/appengine/docs/standard/java-gen2/using-gradle |
| Cloud Tools IDE plugins | — | — | skip: IDE plugins, developer tooling | https://cloud.google.com/code/docs |
| Maven App Engine plugin | — | — | skip: build tool plugin, developer tooling | https://cloud.google.com/appengine/docs/standard/java-gen2/using-maven |
| Google Cloud SDK | — | — | skip: command line and language tooling | https://cloud.google.com/sdk/docs |
| Cloud Tools for Eclipse | — | — | skip: IDE plugin, developer tooling | https://cloud.google.com/eclipse/docs |
| Cloud Tools for PowerShell | — | — | skip: command line tooling | https://cloud.google.com/powershell/docs |
| Cloud Tools for Visual Studio | — | — | skip: IDE plugin, developer tooling | https://cloud.google.com/visual-studio/docs |
| Cloud Billing | — | — | skip: billing and cost management | https://cloud.google.com/billing/docs |
| Project | — | — | skip: account hierarchy, a container not a resource | https://cloud.google.com/resource-manager/docs/cloud-platform-resource-hierarchy |
| Cloud Quotas | — | — | skip: quota management tooling | https://cloud.google.com/docs/quotas/overview |
| Advanced Solutions Lab | — | — | skip: training and consulting engagement, not a resource | https://cloud.google.com/asl |
| AI Hub | — | — | skip: retired asset catalogue, superseded by Vertex AI Model Garden | https://cloud.google.com/vertex-ai/docs/start/explore-models |
| AI Platform Data Labeling Service | — | — | skip: retired labelling workflow of the legacy AI Platform | https://cloud.google.com/vertex-ai/docs/datasets/data-labeling-job |
| AI Platform | — | — | skip: superseded by Vertex AI | https://cloud.google.com/vertex-ai/docs |
| AutoML Natural Language | — | — | skip: training mode inside Vertex AI, not a separate resource | https://cloud.google.com/vertex-ai/docs/beginner/beginners-guide |
| AutoML Tables | — | — | skip: training mode inside Vertex AI, not a separate resource | https://cloud.google.com/vertex-ai/docs/beginner/beginners-guide |
| AutoML Translation | — | — | skip: training mode inside Vertex AI, not a separate resource | https://cloud.google.com/vertex-ai/docs/beginner/beginners-guide |
| AutoML Video Intelligence | — | — | skip: training mode inside Vertex AI, not a separate resource | https://cloud.google.com/vertex-ai/docs/beginner/beginners-guide |
| AutoML Vision | — | — | skip: training mode inside Vertex AI, not a separate resource | https://cloud.google.com/vertex-ai/docs/beginner/beginners-guide |
| Network security | — | — | skip: product-family icon; Cloud NGFW, Cloud Armor and Cloud IDS are the placed nodes | https://cloud.google.com/security/products/network-security |
| Network Service Tiers | — | — | skip: routing tier setting on an IP address | https://cloud.google.com/network-tiers/docs/overview |
| Network Topology | — | — | skip: visualization module of Network Intelligence Center | https://cloud.google.com/network-intelligence-center/docs/network-topology/concepts/overview |
| Networking | — | — | skip: section icon for the networking family, not a product | https://cloud.google.com/products/networking |
| Premium Network Service Tier | — | — | skip: routing tier setting on an IP address | https://cloud.google.com/network-tiers/docs/overview |
| VPC routes | — | — | skip: routing configuration of a VPC network | https://cloud.google.com/vpc/docs/routes |
| Standard Network Service Tier | — | — | skip: routing tier setting on an IP address | https://cloud.google.com/network-tiers/docs/overview |
| Resource Manager | — | — | skip: account hierarchy, a container not a resource | https://cloud.google.com/resource-manager/docs/cloud-platform-resource-hierarchy |
| Security Health Analytics | — | — | skip: built-in scanning service of Security Command Center, not a separate node | https://cloud.google.com/security-command-center/docs/concepts-vulnerabilities-findings |

## Counts

total 400, todo 0, done 228, skip 172.
