# Components with no vendor icon

The 81 components listed here carry the generated badge — the kind glyph with the provider mark
in the corner — instead of the vendor's product icon. The rule they follow is the one in
`icons/README.md`: a stand-in taken from a different product is worse than a badge, because it
looks official and is not, so a component waits until the vendor publishes artwork of its own.
Three things put a component on this list: the vendor's icon pack does not contain the product,
the only artwork the vendor publishes is a raster (the icon contract allows no raster and no
`data:` URI), or the vendor's drawing will not fit the 4 KB budget even after precision
reduction and sub-pixel decimation. To install one later, add a line to a map file and run
`node .claude/tools/vendor-icons/fit.mjs <map.json>`, where the map is
`{"<provider>": {"<component-id>": "<path to the source .svg>"}}`, then delete the row here.
Pack versions and counts are as of 2026-09-22.

## aws

1 components. Look next at <https://aws.amazon.com/architecture/icons/>.

| Component id | Name | Reason |
|---|---|---|
| `aws-swf` | Amazon Simple Workflow Service | not in vendor set (AWS Architecture Icons, `Icon-package_07312026`) |

## azure

10 components. Look next at <https://learn.microsoft.com/azure/architecture/icons/>.

| Component id | Name | Reason |
|---|---|---|
| `azure-artifact-signing` | Artifact Signing | not in vendor set (Azure Public Service Icons V24) |
| `azure-cyclecloud` | Azure CycleCloud | not in vendor set (Azure Public Service Icons V24) |
| `azure-energy-data-services` | Azure Data Manager for Energy | not in vendor set (Azure Public Service Icons V24) |
| `azure-fluid-relay` | Azure Fluid Relay | not in vendor set (Azure Public Service Icons V24) |
| `azure-graph-data-connect` | Microsoft Graph Data Connect | not in vendor set (Azure Public Service Icons V24) |
| `azure-horizondb` | Azure HorizonDB | not in vendor set (Azure Public Service Icons V24) |
| `azure-managed-lustre` | Azure Managed Lustre | not in vendor set (Azure Public Service Icons V24) |
| `azure-quantum` | Azure Quantum | not in vendor set (Azure Public Service Icons V24) |
| `azure-stack-edge` | Azure Stack Edge | not in vendor set (Azure Public Service Icons V24) |
| `azure-stack-hub` | Azure Stack Hub | not in vendor set (Azure Public Service Icons V24) |

## gcp

31 components. Look next at <https://cloud.google.com/icons>.

| Component id | Name | Reason |
|---|---|---|
| `google-agent-gateway` | Agent Gateway | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-agent-registry` | Agent Registry | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-anti-money-laundering-ai` | Anti Money Laundering AI | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-application-integration` | Application Integration | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-appsheet` | AppSheet | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-backup-and-dr` | Backup and DR Service backup vault | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-blockchain-node-engine` | Blockchain Node Engine | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-blockchain-rpc` | Blockchain RPC | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-cloud-ftp` | Cloud FTP | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-cloud-identity` | Cloud Identity | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-cloud-source-repositories` | Cloud Source Repositories | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-cloud-workstations` | Cloud Workstations | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-dataform` | Dataform | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-dual-run` | Dual Run | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-enterprise-knowledge-graph` | Enterprise Knowledge Graph | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-fraud-defense` | reCAPTCHA Fraud Prevention | raster only |
| `google-gemini-api` | Gemini API | raster only |
| `google-managed-lustre` | Google Cloud Managed Lustre | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-manufacturing-connect` | Manufacturing Connect | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-manufacturing-data-engine` | Manufacturing Data Engine | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-model-armor` | Model Armor | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-oracle-database` | Oracle Database@Google Cloud | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-organization-policy` | Organization Policy Service | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-parallelstore` | Parallelstore | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-recaptcha-enterprise` | reCAPTCHA Enterprise | raster only |
| `google-secure-source-manager` | Secure Source Manager | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-service-extensions` | Service Extensions | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-service-health` | Personalized Service Health | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-telecom-network-automation` | Telecom Network Automation | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-telecom-subscriber-insights` | Telecom Subscriber Insights | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-vpc-service-controls` | VPC Service Controls | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |

## k8s

2 components. Look next at <https://github.com/kubernetes/community/tree/master/icons>.

| Component id | Name | Reason |
|---|---|---|
| `k8s-gateway` | Kubernetes Gateway | not in vendor set (kubernetes/community icons) |
| `k8s-validating-admission-policy` | ValidatingAdmissionPolicy | not in vendor set (kubernetes/community icons) |

## oci

37 components. Look next at <https://docs.oracle.com/en-us/iaas/Content/General/Reference/graphicsfordiagrams.htm>.

| Component id | Name | Reason |
|---|---|---|
| `oci-access-governance` | Oracle Access Governance | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-ai-data-platform` | OCI AI Data Platform | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-api-access-control` | Oracle API Access Control | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-artifact-registry` | OCI Artifact Registry | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-autonomous-database-cloud-at-customer` | Autonomous AI Database on Exadata Cloud@Customer | exceeds 4 KB (6365 bytes after minify) |
| `oci-batch` | OCI Batch | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-cache-valkey` | OCI Cache with Valkey | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-cluster-network` | OCI Cluster Network | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-compute-cloud-at-customer` | Oracle Compute Cloud@Customer | exceeds 4 KB (4202 bytes after minify) |
| `oci-compute-cloud-at-customer-isolated` | Oracle Compute Cloud@Customer Isolated | exceeds 4 KB (4202 bytes after minify) |
| `oci-connector-hub` | OCI Connector Hub | exceeds 4 KB (4387 bytes after minify) |
| `oci-data-labeling` | OCI Data Labeling | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-data-transforms` | Oracle Data Transforms | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-delegate-access-control` | Oracle Delegate Access Control | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-device-data-fhir` | OCI Device Data FHIR Service | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-fastconnect` | FastConnect | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-fleet-application-management` | OCI Fleet Application Management | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-goldengate` | OCI GoldenGate | exceeds 4 KB (4780 bytes after minify) |
| `oci-goldengate-stream-analytics` | OCI GoldenGate Stream Analytics | exceeds 4 KB (5480 bytes after minify) |
| `oci-guarded-data-pipelines` | OCI Guarded Data Pipelines | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-java-management` | OCI Java Management Service | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-managed-access` | OCI Managed Access | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-managed-file-transfer` | Oracle Managed File Transfer | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-network-path-analyzer` | Network Path Analyzer | exceeds 4 KB (5186 bytes after minify) |
| `oci-operator-access-control` | Oracle Operator Access Control | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-os-management-hub` | OCI OS Management Hub | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-resource-analytics` | OCI Resource Analytics | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-resource-scheduler` | OCI Resource Scheduler | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-secure-desktops` | OCI Secure Desktops | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-service-catalog` | OCI Service Catalog | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-timesten` | TimesTen Database for OKE | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-web-application-acceleration` | Web Application Acceleration | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-webcenter` | Oracle WebCenter Portal on Marketplace | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-weblogic-management` | OCI WebLogic Management | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-weblogic-server` | Oracle WebLogic Server for OCI | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-weblogic-server-oke` | Oracle WebLogic Server for OKE | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |
| `oci-zero-trust-packet-routing` | OCI Zero Trust Packet Routing | not in vendor set (Oracle graphics for diagrams, SVG set v24.2) |

## Substitutes used

These components did get a vendor icon, but not one drawn for them: it is the parent product's
icon, or one the vendor shares across a family. They are not on the list above and they render
correctly. If a vendor draws a dedicated icon later, change the source in the map and refit.

| Component id | Name | Icon used | Why |
|---|---|---|---|
| `aws-cloudfront-keyvaluestore` | Amazon CloudFront KeyValueStore | `Arch_Amazon-CloudFront_48.svg` | no KeyValueStore resource icon in the pack; parent service icon |
| `aws-cloudwatch-application-insights` | Amazon CloudWatch Application Insights | `Arch_Amazon-CloudWatch_48.svg` | no Application Insights icon in the pack; parent service icon |
| `aws-cloudwatch-network-flow-monitor` | Amazon CloudWatch Network Flow Monitor | `Arch_Amazon-CloudWatch_48.svg` | no Network Flow Monitor icon in the pack; parent service icon |
| `aws-iot-managed-integrations` | Managed integrations for AWS IoT Device Management | `Arch_AWS-IoT-Device-Management_48.svg` | managed integrations is a feature of IoT Device Management |
| `aws-ivs-chat` | Amazon IVS Chat | `Arch_Amazon-Interactive-Video-Service_48.svg` | no IVS Chat resource icon in the pack; parent service icon |
| `aws-sagemaker-hyperpod` | Amazon SageMaker HyperPod | `Arch_Amazon-SageMaker-AI_48.svg` | HyperPod is a SageMaker AI capability; parent service icon |
| `aws-sagemaker-mlflow` | Managed MLflow on Amazon SageMaker AI | `Arch_Amazon-SageMaker-AI_48.svg` | managed MLflow is a SageMaker AI capability; parent service icon |
| `aws-ses-mail-manager` | Mail Manager for Amazon SES | `Arch_Amazon-Simple-Email-Service_48.svg` | Mail Manager is an SES feature; parent service icon |
| `azure-confidential-vm` | Azure confidential VM | `10021-icon-service-Virtual-Machine.svg` | no confidential VM icon; the Virtual Machine service icon |
| `azure-device-registry` | Azure Device Registry | `03485-icon-service-Azure-IoT-Operations.svg` | Device Registry ships as part of Azure IoT Operations; that product's icon |
| `azure-file-sync` | Azure File Sync | `10093-icon-service-Storage-Sync-Services.svg` | Azure File Sync is deployed as a Storage Sync Service |
| `azure-monitor-data-collection-endpoint` | Data collection endpoint | `00001-icon-service-Monitor.svg` | the pack ships Data Collection Rules but no Data Collection Endpoint icon; the Azure Monitor icon |
| `azure-monitor-workspace` | Azure Monitor workspace | `00001-icon-service-Monitor.svg` | no Azure Monitor workspace icon; the Azure Monitor icon |
| `azure-power-apps` | Microsoft Power Apps | `03335-icon-service-Power-Platform.svg` | no per-app Power Platform icon in the set; the Power Platform icon |
| `google-confidential-space` | Confidential Space | `compute_engine.svg` | Confidential Space runs on Confidential VMs; Google ships no icon of its own for it |
| `google-maps-embed-api` | Maps Embed API | `google_maps_platform.svg` | Google publishes one Maps Platform icon, not one per API |
| `google-parameter-manager` | Parameter Manager | `secret_manager.svg` | Parameter Manager ships with Secret Manager |
| `google-places-aggregate-api` | Places Aggregate API | `google_maps_platform.svg` | Google publishes one Maps Platform icon, not one per API |
| `google-privileged-access-manager` | Privileged Access Manager | `identity_and_access_management.svg` | PAM is an IAM feature; Google ships no icon of its own for it |
| `google-serverless-vpc-access-connector` | Serverless VPC Access connector | `virtual_private_cloud.svg` | a VPC connector; Google ships no icon of its own for it |
| `oci-dedicated-vm-host` | OCI Dedicated Virtual Machine Host | `virtual-machine.svg` | no dedicated host icon; Oracle's Virtual Machine icon |
| `oci-devops-build-pipeline` | OCI DevOps Build Pipeline | `devops.svg` | build pipelines are part of OCI DevOps |
| `oci-devops-code-repository` | OCI DevOps Code Repository | `devops.svg` | code repositories are part of OCI DevOps |
| `oci-devops-deployment-pipeline` | OCI DevOps Deployment Pipeline | `devops.svg` | deployment pipelines are part of OCI DevOps |
| `oci-dynamic-group` | OCI Dynamic Group | `user-group.svg` | Oracle's identity user-group icon |
| `oci-fusion-data-intelligence` | Oracle Fusion Data Intelligence | `fusion.svg` | Fusion Data Intelligence ships with Fusion Applications |
| `oci-interconnect-aws` | Oracle Interconnect for AWS | `oci-multicloud.svg` | Oracle's multicloud icon; the set has no per-partner interconnect icon |
| `oci-interconnect-azure` | Oracle Interconnect for Microsoft Azure | `oci-multicloud.svg` | Oracle's multicloud icon; the set has no per-partner interconnect icon |
| `oci-interconnect-google-cloud` | Oracle Interconnect for Google Cloud | `oci-multicloud.svg` | Oracle's multicloud icon; the set has no per-partner interconnect icon |
| `oci-mysql-heatwave-cluster` | MySQL HeatWave cluster | `mysql-heatwave.svg` | the HeatWave cluster attached to a MySQL DB system |
| `oci-network-load-balancer` | Network Load Balancer | `load-balancer.svg` | Oracle's Load Balancer icon; the set has no separate network load balancer |
| `oci-opensearch-dashboards` | OpenSearch Dashboards | `opensearch.svg` | dashboards are part of OCI Search with OpenSearch |
| `oci-stack-monitoring` | OCI Stack Monitoring | `monitoring.svg` | Oracle's Monitoring icon; the set has no Stack Monitoring |
| `oci-visual-builder-studio` | Oracle Visual Builder Studio | `visual-builder.svg` | Visual Builder Studio shares the Visual Builder icon |
