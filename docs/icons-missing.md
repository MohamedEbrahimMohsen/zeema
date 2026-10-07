# Components with no vendor icon

The 156 components listed here carry the generated badge — the kind glyph with the provider mark
in the corner — instead of the vendor's product icon. The rule they follow is the one in
`icons/README.md`: a stand-in taken from a different product is worse than a badge, because it
looks official and is not, so a component waits until the vendor publishes artwork of its own.
Three things put a component on this list: the vendor's icon pack does not contain the product,
the only artwork the vendor publishes is a raster (the icon contract allows no raster and no
`data:` URI), or the vendor's drawing will not fit the 4 KB budget even after precision
reduction and sub-pixel decimation. To install one later, add a line to a map file and run
`node .claude/tools/vendor-icons/fit.mjs <map.json>`, where the map is
`{"<provider>": {"<component-id>": "<path to the source .svg>"}}`, then delete the row here.
The Cloudflare map is committed as `.claude/tools/vendor-icons/cloudflare.json`; fetch its sources
with `node .claude/tools/vendor-icons/cloudflare-fetch.mjs <dir>` and pass `--src <dir>` to `fit.mjs`.
Pack versions and counts are as of 2026-09-22, and 2026-10-02 for Cloudflare.

## aws

2 components. Look next at <https://aws.amazon.com/architecture/icons/>.

| Component id | Name | Reason |
|---|---|---|
| `aws-lookout-for-metrics` | Amazon Lookout for Metrics | retired October 2025; not in vendor set (AWS Architecture Icons, `Icon-package_07312026`) |
| `aws-swf` | Amazon Simple Workflow Service | not in vendor set (AWS Architecture Icons, `Icon-package_07312026`) |

## azure

12 components. Look next at <https://learn.microsoft.com/azure/architecture/icons/>.

| Component id | Name | Reason |
|---|---|---|
| `azure-artifact-signing` | Artifact Signing | not in vendor set (Azure Public Service Icons V24) |
| `azure-bing-web-search` | Bing Web Search API | retired August 2025; Bing Search never had an Azure service icon of its own, kept on the badge |
| `azure-copilot-studio` | Microsoft Copilot Studio | the Power Platform icon pack (`Power-Platform-icons-scalable.zip`, `CopilotStudio_scalable.svg`) is over 4 KB however it is minified (5.7 KB) |
| `azure-cyclecloud` | Azure CycleCloud | not in vendor set (Azure Public Service Icons V24) |
| `azure-energy-data-services` | Azure Data Manager for Energy | not in vendor set (Azure Public Service Icons V24) |
| `azure-fluid-relay` | Azure Fluid Relay | not in vendor set (Azure Public Service Icons V24) |
| `azure-graph-data-connect` | Microsoft Graph Data Connect | not in vendor set (Azure Public Service Icons V24) |
| `azure-horizondb` | Azure HorizonDB | not in vendor set (Azure Public Service Icons V24) |
| `azure-managed-lustre` | Azure Managed Lustre | not in vendor set (Azure Public Service Icons V24) |
| `azure-quantum` | Azure Quantum | not in vendor set (Azure Public Service Icons V24) |
| `azure-stack-edge` | Azure Stack Edge | not in vendor set (Azure Public Service Icons V24) |
| `azure-stack-hub` | Azure Stack Hub | not in vendor set (Azure Public Service Icons V24) |

## cloudflare

4 components. Look next at <https://github.com/cloudflare/cloudflare-docs/tree/production/src/icons>
(a new file there is the product's icon; `src/content/directory/<product>.yaml` says which docs
entry it belongs to) and at `es/reactsvgs/` in the npm package `@cloudflare/component-icon`.

| Component id | Name | Reason |
|---|---|---|
| `cloudflare-mcp-portal` | MCP Server Portal | not in vendor set (Cloudflare docs `src/icons/` at `1805e7cc`, `@cloudflare/component-icon` 13.15.3); a Cloudflare One Access feature with no icon of its own, and the npm `McpServerOutline` is a generic MCP glyph, not the product's |
| `cloudflare-one-identity-provider` | Cloudflare One identity provider | not in vendor set (Cloudflare docs `src/icons/` at `1805e7cc`, `@cloudflare/component-icon` 13.15.3); a Cloudflare One feature with no icon of its own |
| `cloudflare-rdp` | Cloudflare One RDP | not in vendor set (Cloudflare docs `src/icons/` at `1805e7cc`, `@cloudflare/component-icon` 13.15.3); the docs entry for it (Access for Infrastructure) has no icon |
| `cloudflare-wallets` | Cloudflare Wallets | not in vendor set (Cloudflare docs `src/icons/` at `1805e7cc`, `@cloudflare/component-icon` 13.15.3); the docs directory entry `wallets` has no icon |

## gcp

34 components. Look next at <https://cloud.google.com/icons>.

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
| `google-custom-search-api` | Custom Search JSON API | closed to new customers; Google publishes no Programmable Search icon in the Cloud set (checked 2026-10-07) |
| `google-dataform` | Dataform | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-dual-run` | Dual Run | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-enterprise-knowledge-graph` | Enterprise Knowledge Graph | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-fraud-defense` | reCAPTCHA Fraud Prevention | raster only |
| `google-gemini-api` | Gemini API | raster only |
| `google-gemini-code-assist` | Gemini Code Assist | not in vendor set (`core-products-icons.zip` and the legacy pack carry no Gemini icon; cloud.google.com/icons shows the Gemini logo only as a PNG; checked 2026-10-07) |
| `google-gemini-enterprise` | Gemini Enterprise | not in vendor set (`core-products-icons.zip` and the legacy pack carry no Gemini icon; cloud.google.com/icons shows the Gemini logo only as a PNG; checked 2026-10-07) |
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


## default

65 components. These are `default` products, drawn as the bare kind glyph. A badge needs the
vendor's mark as one filled path in one colour: either its Simple Icons mark, named in
`.claude/tools/badges-extra.json` by slug, or the vendor's own artwork taken from its site or
repository and fitted to the same contract as a file under `icons/providers/` (see
`icons/README.md`). Neither was usable for these. When one appears, add `"<id>": "<key>"` to
`badges-extra.json`, delete the icon and run `node .claude/tools/icons.mjs`, then delete the row here.

| Component id | Name | Reason |
|---|---|---|
| `abacus-ai` | Abacus.AI | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `argilla` | Argilla | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `banana-dev` | Banana | retired brand; no mark will be published |
| `bland-ai` | Bland AI | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `calypsoai` | CalypsoAI | retired brand; no mark will be published |
| `cerebras-api` | Cerebras Inference | the vendor mark is drawn with strokes, and a badge needs one filled path (checked 2026-10-07) |
| `chunkr` | Chunkr | the vendor mark is drawn with strokes, and a badge needs one filled path (checked 2026-10-07) |
| `comet-ml` | Comet | the vendor logo SVG draws its symbol as an embedded raster (checked 2026-10-07) |
| `crusoe` | Crusoe Cloud VM | the vendor mark is over the 4 KB budget as one path (checked 2026-10-07) |
| `cvat` | CVAT | the vendor icon is layered, stroked shapes that do not reduce to one path (checked 2026-10-07) |
| `epsilla` | Epsilla | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `evidently-ai` | Evidently | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `flowise` | Flowise | retired brand; no mark will be published |
| `galileo` | Galileo | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `graphiti` | Graphiti | only the parent's mark (Zep) was found; Graphiti has none of its own (checked 2026-10-07) |
| `helicone` | Helicone | the vendor icon is layered, stroked shapes that do not reduce to one path (checked 2026-10-07) |
| `helicone-gateway` | Helicone AI Gateway | the vendor icon is layered, stroked shapes that do not reduce to one path (checked 2026-10-07) |
| `infinity-embeddings` | Infinity | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `jan` | Jan | the vendor mark is an illustration embedded as a raster (checked 2026-10-07) |
| `kili` | Kili | the vendor publishes only a wordmark (checked 2026-10-07) |
| `lakera-guard` | Lakera Guard | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `lepton-ai` | Lepton AI | retired brand; no mark will be published |
| `lindy` | Lindy | the vendor mark is drawn with strokes, and a badge needs one filled path (checked 2026-10-07) |
| `llm-guard` | LLM Guard | retired brand; no mark will be published |
| `lmdeploy` | LMDeploy | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `lunary` | Lunary | the vendor mark is drawn with strokes, and a badge needs one filled path (checked 2026-10-07) |
| `mixedbread-ai` | Mixedbread | the vendor mark is over the 4 KB budget as one path (checked 2026-10-07) |
| `mlc-llm` | MLC LLM | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `myscale` | MyScale | retired brand; no mark will be published |
| `mystic-ai` | Mystic AI | retired brand; no mark will be published |
| `nomic-api` | Nomic API | the vendor mark relies on its stroke, and a badge needs one filled path (checked 2026-10-07) |
| `octoai` | OctoAI | retired brand; no mark will be published |
| `open-webui` | Open WebUI | the vendor favicon SVG wraps a raster (checked 2026-10-07) |
| `pachyderm` | Pachyderm | retired brand; no mark will be published |
| `playht` | PlayHT | retired brand; no mark will be published |
| `portkey` | Portkey AI Gateway | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `prodigy` | Prodigy | the vendor publishes only a wordmark (checked 2026-10-07) |
| `prompt-security` | Prompt Security | no mark in Simple Icons 16.30.0 |
| `promptfoo` | promptfoo | the vendor mark is a multi-colour illustration that does not reduce to one colour (checked 2026-10-07) |
| `promptlayer` | PromptLayer | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `protect-ai` | Protect AI | retired brand; no mark will be published |
| `rapidminer` | RapidMiner AI Hub | only the parent's mark (Altair) was found (checked 2026-10-07) |
| `rebuff` | Rebuff | retired brand; no mark will be published |
| `reka-api` | Reka API | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `requesty` | Requesty | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `rime` | Rime | the vendor publishes only a wordmark; Simple Icons `rime` is the Rime input method (checked 2026-10-07) |
| `robust-intelligence` | Robust Intelligence | retired brand; no mark will be published |
| `runway-api` | Runway API | the vendor publishes only a wordmark (checked 2026-10-07) |
| `salesforce-agentforce` | Agentforce | the only Agentforce artwork found is a multi-colour illustration; Salesforce has no Simple Icons mark (checked 2026-10-07) |
| `sambanova-api` | SambaNova Cloud | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `snorkel` | Snorkel Flow | the vendor mark is a multi-colour illustration that does not reduce to one colour (checked 2026-10-07) |
| `stability-ai-api` | Stability AI API | the vendor publishes only a wordmark (checked 2026-10-07) |
| `steel-dev` | Steel | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `superannotate` | SuperAnnotate | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `surge-ai` | Surge AI | the vendor publishes only a wordmark (checked 2026-10-07) |
| `toloka` | Toloka | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `traceloop` | Traceloop | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `truera` | TruEra | retired brand; no mark will be published |
| `unify-ai` | Unify | retired brand; no mark will be published |
| `unstructured-io` | Unstructured API | the vendor mark is a 12-letter wordmark block, unreadable at badge size (checked 2026-10-07) |
| `v7` | V7 Darwin | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `voiceflow` | Voiceflow | no usable SVG mark on the vendor site or repository (checked 2026-10-07) |
| `whylabs` | WhyLabs | retired brand; no mark will be published |
| `writer-api` | Writer API | the vendor publishes only a wordmark; its site icons are per product (checked 2026-10-07) |
| `xai-api` | xAI API | no SVG reachable on x.ai or its docs; Simple Icons `x` is the X (Twitter) mark (checked 2026-10-07) |

## Substitutes used

These components did get a vendor icon, but not one drawn for them: it is the parent product's
icon, or one the vendor shares across a family. They are not on the list above and they render
correctly. If a vendor draws a dedicated icon later, change the source in the map and refit.

| Component id | Name | Icon used | Why |
|---|---|---|---|
| `aws-bedrock-data-automation` | Amazon Bedrock Data Automation | `Arch_Amazon-Bedrock_48.svg` | no Bedrock Data Automation icon in the pack; a Bedrock capability, parent service icon |
| `aws-q-developer` | Amazon Q Developer | `Arch_Amazon-Q_48.svg` | the pack draws one Amazon Q icon for the family |
| `aws-sagemaker-unified-studio` | Amazon SageMaker Unified Studio | `Arch_Amazon-SageMaker_48.svg` | the studio of the next-generation Amazon SageMaker; that service's icon |
| `aws-cloudfront-keyvaluestore` | Amazon CloudFront KeyValueStore | `Arch_Amazon-CloudFront_48.svg` | no KeyValueStore resource icon in the pack; parent service icon |
| `aws-cloudwatch-application-insights` | Amazon CloudWatch Application Insights | `Arch_Amazon-CloudWatch_48.svg` | no Application Insights icon in the pack; parent service icon |
| `aws-cloudwatch-network-flow-monitor` | Amazon CloudWatch Network Flow Monitor | `Arch_Amazon-CloudWatch_48.svg` | no Network Flow Monitor icon in the pack; parent service icon |
| `aws-iot-managed-integrations` | Managed integrations for AWS IoT Device Management | `Arch_AWS-IoT-Device-Management_48.svg` | managed integrations is a feature of IoT Device Management |
| `aws-ivs-chat` | Amazon IVS Chat | `Arch_Amazon-Interactive-Video-Service_48.svg` | no IVS Chat resource icon in the pack; parent service icon |
| `aws-sagemaker-hyperpod` | Amazon SageMaker HyperPod | `Arch_Amazon-SageMaker-AI_48.svg` | HyperPod is a SageMaker AI capability; parent service icon |
| `aws-sagemaker-mlflow` | Managed MLflow on Amazon SageMaker AI | `Arch_Amazon-SageMaker-AI_48.svg` | managed MLflow is a SageMaker AI capability; parent service icon |
| `aws-ses-mail-manager` | Mail Manager for Amazon SES | `Arch_Amazon-Simple-Email-Service_48.svg` | Mail Manager is an SES feature; parent service icon |
| `azure-aks-edge-essentials` | AKS Edge Essentials | `10023-icon-service-Kubernetes-Services.svg` | no AKS Edge Essentials icon; the Kubernetes Services (AKS) icon |
| `azure-artifacts` | Azure Artifacts | `10261-icon-service-Azure-DevOps.svg` | no per-service Azure DevOps icon in the set; the Azure DevOps icon |
| `azure-cloud-hsm` | Azure Cloud HSM | `02322-icon-service-Dedicated-HSM.svg` | no Cloud HSM icon; the Dedicated HSM icon of the HSM it succeeds |
| `azure-content-understanding` | Azure Content Understanding | `035746832-icon-service-AI-Foundry.svg` | no Content Understanding icon; the AI Foundry icon |
| `azure-device-registry` | Azure Device Registry | `03485-icon-service-Azure-IoT-Operations.svg` | Device Registry ships as part of Azure IoT Operations; that product's icon |
| `azure-dsvm` | Azure Data Science Virtual Machine | `10021-icon-service-Virtual-Machine.svg` | a Data Science VM is a preconfigured Azure VM image; the Virtual Machine icon |
| `azure-durable-functions` | Azure Durable Functions | `10029-icon-service-Function-Apps.svg` | Durable Functions is an extension of Azure Functions; the Function Apps icon |
| `azure-event-grid-mqtt` | Azure Event Grid MQTT Broker | `10206-icon-service-Event-Grid-Topics.svg` | no MQTT broker icon; the Event Grid Topics icon |
| `azure-file-sync` | Azure File Sync | `10093-icon-service-Storage-Sync-Services.svg` | Azure File Sync is deployed as a Storage Sync Service |
| `azure-health-bot` | Healthcare agent service | `10165-icon-service-Bot-Services.svg` | no Healthcare agent service icon; the Bot Services icon |
| `azure-managed-hsm` | Azure Key Vault Managed HSM | `10245-icon-service-Key-Vaults.svg` | Managed HSM is part of Azure Key Vault; the Key Vaults icon |
| `azure-ml-endpoint` | Azure ML endpoint | `038470510-icon-service-Azure-Machine-Learning.svg` | an online endpoint is an Azure Machine Learning workspace resource; the Azure Machine Learning icon |
| `azure-monitor-data-collection-endpoint` | Data collection endpoint | `00001-icon-service-Monitor.svg` | the pack ships Data Collection Rules but no Data Collection Endpoint icon; the Azure Monitor icon |
| `azure-monitor-workspace` | Azure Monitor workspace | `00001-icon-service-Monitor.svg` | no Azure Monitor workspace icon; the Azure Monitor icon |
| `azure-multicloud-interconnect` | Azure Multicloud Interconnect | `10079-icon-service-ExpressRoute-Circuits.svg` | no Multicloud Interconnect icon; the ExpressRoute Circuits icon |
| `azure-pipelines` | Azure Pipelines | `10261-icon-service-Azure-DevOps.svg` | no per-service Azure DevOps icon in the set; the Azure DevOps icon |
| `azure-playwright-testing` | Playwright Workspaces | `033805167-icon-service-Azure-App-Testing.svg` | Playwright Workspaces ships as part of Azure App Testing; that product's icon |
| `azure-power-apps` | Microsoft Power Apps | `03335-icon-service-Power-Platform.svg` | no per-app Power Platform icon in the set; the Power Platform icon |
| `azure-repos` | Azure Repos | `10261-icon-service-Azure-DevOps.svg` | no per-service Azure DevOps icon in the set; the Azure DevOps icon |
| `azure-schema-registry` | Azure Schema Registry | `00039-icon-service-Event-Hubs.svg` | Schema Registry is a feature of an Event Hubs namespace; the Event Hubs icon |
| `cloudflare-advanced-certificate-manager` | Advanced Certificate Manager | `ssl.svg` | an SSL/TLS edge-certificate feature (`/ssl/edge-certificates/`); the SSL/TLS icon |
| `cloudflare-analytics-engine` | Workers Analytics Engine | `analytics.svg` | documented under Analytics (`/analytics/analytics-engine/`); the Analytics icon |
| `cloudflare-cache-reserve` | Cache Reserve | `cache.svg` | a Cache feature (`/cache/advanced-configuration/cache-reserve/`); the Cache / CDN icon |
| `cloudflare-dns-firewall` | Cloudflare DNS Firewall | `dns.svg` | documented under DNS (`/dns/dns-firewall/`); the DNS icon |
| `cloudflare-email-routing` | Email Routing | `email-service.svg` | Email Routing is part of Email Service, whose icon replaced the old Email Routing one |
| `cloudflare-email-workers` | Email Workers | `email-service.svg` | Email Workers run inside Email Routing; the Email Service icon |
| `cloudflare-firewall-for-ai` | Firewall for AI | `waf.svg` | a WAF detection (`/waf/detections/ai-security-for-apps/`); the WAF icon |
| `cloudflare-for-saas` | Cloudflare for SaaS | `cloudflare-for-platforms.svg` | documented under Cloudflare for Platforms; that product's icon |
| `cloudflare-geo-key-manager` | Cloudflare Geo Key Manager | `ssl.svg` | an SSL/TLS feature (`/ssl/edge-certificates/geokey-manager/`); the SSL/TLS icon |
| `cloudflare-image-transformations` | Image Transformations | `images.svg` | a Cloudflare Images feature; the Images icon |
| `cloudflare-internal-dns` | Cloudflare Internal DNS | `dns.svg` | documented under DNS (`/dns/internal-dns/`); the DNS icon |
| `cloudflare-keyless-ssl` | Cloudflare Keyless SSL | `ssl.svg` | documented under SSL/TLS (`/ssl/keyless-ssl/`); the SSL/TLS icon |
| `cloudflare-logpush` | Cloudflare Logpush | `logs.svg` | documented under Logs (`/logs/logpush/`); the Logs icon |
| `cloudflare-mtls` | Cloudflare mTLS client certificates | `ssl.svg` | client certificates are an SSL/TLS feature; the SSL/TLS icon |
| `cloudflare-one-appliance` | Cloudflare One Appliance | `cloudflare-wan.svg` | documented under Cloudflare WAN (`/cloudflare-wan/configuration/appliance/`); the WAN icon |
| `cloudflare-origin-ca` | Cloudflare Origin CA | `ssl.svg` | an SSL/TLS origin-configuration feature; the SSL/TLS icon |
| `cloudflare-rate-limiting` | Cloudflare Rate Limiting | `waf.svg` | rate limiting rules are part of WAF (`/waf/rate-limiting-rules/`); the WAF icon |
| `cloudflare-secondary-dns` | Cloudflare Secondary DNS | `dns.svg` | zone transfers are a DNS feature; the DNS icon |
| `cloudflare-snippets` | Cloudflare Snippets | `rules.svg` | documented under Rules (`/rules/snippets/`); the Rules icon |
| `cloudflare-stream-live` | Stream Live | `stream.svg` | live inputs are part of Stream; the Stream icon |
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
