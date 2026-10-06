# Components with no vendor icon

The 249 components listed here carry the generated badge — the kind glyph with the provider mark
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

8 components. Look next at <https://aws.amazon.com/architecture/icons/>.

| Component id | Name | Reason |
|---|---|---|
| `aws-bedrock-data-automation` | Amazon Bedrock Data Automation | added after the 2026-09-22 icon pass; vendor pack not checked in this pass |
| `aws-codewhisperer` | Amazon CodeWhisperer | retired April 2024 (renamed Amazon Q Developer); kept on the badge |
| `aws-lookout-for-metrics` | Amazon Lookout for Metrics | retired October 2025; kept on the badge |
| `aws-lookout-for-vision` | Amazon Lookout for Vision | retired October 2025; kept on the badge |
| `aws-q-developer` | Amazon Q Developer | vendor pack not checked in this pass; IDE plugins reach end of support on 30 April 2027 |
| `aws-sagemaker-canvas` | Amazon SageMaker Canvas | added after the 2026-09-22 icon pass; vendor pack not checked in this pass |
| `aws-sagemaker-unified-studio` | Amazon SageMaker Unified Studio | added after the 2026-09-22 icon pass; vendor pack not checked in this pass |
| `aws-swf` | Amazon Simple Workflow Service | not in vendor set (AWS Architecture Icons, `Icon-package_07312026`) |

## azure

12 components. Look next at <https://learn.microsoft.com/azure/architecture/icons/>.

| Component id | Name | Reason |
|---|---|---|
| `azure-artifact-signing` | Artifact Signing | not in vendor set (Azure Public Service Icons V24) |
| `azure-bing-web-search` | Bing Web Search API | retired August 2025; Bing Search never had an Azure service icon of its own, kept on the badge |
| `azure-copilot-studio` | Microsoft Copilot Studio | a Power Platform product outside the Azure service icon set; vendor pack not checked in this pass |
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
| `google-custom-search-api` | Custom Search JSON API | closed to new customers; Google publishes no Programmable Search icon in the Cloud set, vendor pack not checked in this pass |
| `google-dataform` | Dataform | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-dual-run` | Dual Run | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-enterprise-knowledge-graph` | Enterprise Knowledge Graph | not in vendor set (Google Cloud icons, `google-cloud-legacy-icons.zip` + `core-products-icons.zip`) |
| `google-fraud-defense` | reCAPTCHA Fraud Prevention | raster only |
| `google-gemini-api` | Gemini API | raster only |
| `google-gemini-code-assist` | Gemini Code Assist | added after the 2026-09-22 icon pass; vendor pack not checked in this pass |
| `google-gemini-enterprise` | Gemini Enterprise | added after the 2026-09-22 icon pass; vendor pack not checked in this pass |
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

152 components. These are `default` products, drawn as the bare kind glyph: the badge is the
vendor's Simple Icons mark (`.claude/tools/badges-extra.json`), and none exists in the installed
`simple-icons` 16.30.0 for these vendors. When Simple Icons adds one, add `"<id>": "<slug>"` to
`badges-extra.json`, delete the icon and run `node .claude/tools/icons.mjs`, then delete the row here.

| Component id | Name | Reason |
|---|---|---|
| `abacus-ai` | Abacus.AI | no mark in Simple Icons 16.30.0 |
| `ai21-api` | AI21 API | no mark in Simple Icons 16.30.0 |
| `aleph-alpha-api` | Aleph Alpha API | retired brand; no mark will be published |
| `alteryx` | Alteryx | no mark in Simple Icons 16.30.0 |
| `anyscale-endpoints` | Anyscale Endpoints | no mark in Simple Icons 16.30.0 |
| `apify` | Apify | no mark in Simple Icons 16.30.0 |
| `argilla` | Argilla | no mark in Simple Icons 16.30.0 |
| `arize-ax` | Arize AX | no mark in Simple Icons 16.30.0 |
| `arize-phoenix` | Arize Phoenix | no mark in Simple Icons 16.30.0 |
| `arthur-ai` | Arthur | no mark in Simple Icons 16.30.0 |
| `autogen-studio` | AutoGen Studio | Microsoft has no Simple Icons mark |
| `banana-dev` | Banana | retired brand; no mark will be published |
| `baseten` | Baseten | no mark in Simple Icons 16.30.0 |
| `beam-cloud` | Beam | no mark in Simple Icons 16.30.0 |
| `black-forest-labs-api` | Black Forest Labs API | no mark in Simple Icons 16.30.0 |
| `bland-ai` | Bland AI | no mark in Simple Icons 16.30.0 |
| `botpress` | Botpress | no mark in Simple Icons 16.30.0 |
| `browserbase` | Browserbase | no mark in Simple Icons 16.30.0 |
| `c3-ai` | C3 AI Platform | no mark in Simple Icons 16.30.0 |
| `calypsoai` | CalypsoAI | retired brand; no mark will be published |
| `cartesia` | Cartesia | no mark in Simple Icons 16.30.0 |
| `cerebras-api` | Cerebras Inference | no mark in Simple Icons 16.30.0 |
| `chunkr` | Chunkr | no mark in Simple Icons 16.30.0 |
| `civitai` | Civitai | no mark in Simple Icons 16.30.0 |
| `cognee` | cognee | no mark in Simple Icons 16.30.0 |
| `comet-ml` | Comet | no mark in Simple Icons 16.30.0 |
| `confident-ai` | Confident AI | no mark in Simple Icons 16.30.0 |
| `coreweave` | CoreWeave | no mark in Simple Icons 16.30.0 |
| `crusoe` | Crusoe Cloud VM | no mark in Simple Icons 16.30.0 |
| `cvat` | CVAT | no mark in Simple Icons 16.30.0 |
| `datarobot` | DataRobot | no mark in Simple Icons 16.30.0 |
| `datasaur` | Datasaur | no mark in Simple Icons 16.30.0 |
| `daytona` | Daytona | no mark in Simple Icons 16.30.0 |
| `deepchecks` | Deepchecks | no mark in Simple Icons 16.30.0 |
| `deepeval` | DeepEval | no mark in Simple Icons 16.30.0 |
| `deepinfra` | DeepInfra | no mark in Simple Icons 16.30.0 |
| `domino-data-lab` | Domino Data Lab | no mark in Simple Icons 16.30.0 |
| `e2b` | E2B | no mark in Simple Icons 16.30.0 |
| `encord` | Encord | no mark in Simple Icons 16.30.0 |
| `epsilla` | Epsilla | no mark in Simple Icons 16.30.0 |
| `evidently-ai` | Evidently | no mark in Simple Icons 16.30.0 |
| `exa-ai` | Exa | no mark in Simple Icons 16.30.0 |
| `fal-ai` | fal | no mark in Simple Icons 16.30.0 |
| `fiddler-ai` | Fiddler AI | no mark in Simple Icons 16.30.0 |
| `firecrawl` | Firecrawl | no mark in Simple Icons 16.30.0 |
| `flowise` | Flowise | retired brand; no mark will be published |
| `flyte` | Flyte | no mark in Simple Icons 16.30.0 |
| `galileo` | Galileo | no mark in Simple Icons 16.30.0 |
| `giskard` | Giskard | no mark in Simple Icons 16.30.0 |
| `gladia` | Gladia | no mark in Simple Icons 16.30.0 |
| `graphiti` | Graphiti | no mark in Simple Icons 16.30.0 |
| `guardrails-ai` | Guardrails AI | no mark in Simple Icons 16.30.0 |
| `helicone` | Helicone | no mark in Simple Icons 16.30.0 |
| `helicone-gateway` | Helicone AI Gateway | no mark in Simple Icons 16.30.0 |
| `hiddenlayer` | HiddenLayer AI Security Platform | no mark in Simple Icons 16.30.0 |
| `honeyhive` | HoneyHive | no mark in Simple Icons 16.30.0 |
| `humanloop` | Humanloop | retired brand; no mark will be published |
| `hume-ai` | Hume AI | no mark in Simple Icons 16.30.0 |
| `hyperbrowser` | Hyperbrowser | no mark in Simple Icons 16.30.0 |
| `ideogram-api` | Ideogram API | no mark in Simple Icons 16.30.0 |
| `infinity-embeddings` | Infinity | no mark in Simple Icons 16.30.0 |
| `jan` | Jan | no mark in Simple Icons 16.30.0 |
| `jina-ai` | Jina AI | only the parent's mark (`elastic`) is in Simple Icons |
| `kili` | Kili | no mark in Simple Icons 16.30.0 |
| `label-studio` | Label Studio | no mark in Simple Icons 16.30.0 |
| `labelbox` | Labelbox | no mark in Simple Icons 16.30.0 |
| `lakefs` | lakeFS | no mark in Simple Icons 16.30.0 |
| `lakera-guard` | Lakera Guard | no mark in Simple Icons 16.30.0 |
| `lambda-labs` | Lambda Cloud instance | no mark in Simple Icons 16.30.0 |
| `langfuse` | Langfuse | no mark in Simple Icons 16.30.0 |
| `lepton-ai` | Lepton AI | retired brand; no mark will be published |
| `letta` | Letta | no mark in Simple Icons 16.30.0 |
| `lindy` | Lindy | no mark in Simple Icons 16.30.0 |
| `llama-cpp-server` | llama.cpp server | no mark for llama.cpp or ggml in Simple Icons 16.30.0 |
| `llamaindex-cloud` | LlamaCloud | no mark in Simple Icons 16.30.0 |
| `llamaparse` | LlamaParse | no mark in Simple Icons 16.30.0 |
| `llm-guard` | LLM Guard | retired brand; no mark will be published |
| `lmdeploy` | LMDeploy | no mark in Simple Icons 16.30.0 |
| `lovable` | Lovable | no mark in Simple Icons 16.30.0 |
| `luma-api` | Luma Dream Machine API | no mark in Simple Icons 16.30.0 |
| `lunary` | Lunary | no mark in Simple Icons 16.30.0 |
| `martian` | Martian Gateway | no mark in Simple Icons 16.30.0 |
| `mem0` | Mem0 | no mark in Simple Icons 16.30.0 |
| `mixedbread-ai` | Mixedbread | no mark in Simple Icons 16.30.0 |
| `mlc-llm` | MLC LLM | no mark in Simple Icons 16.30.0 |
| `myscale` | MyScale | retired brand; no mark will be published |
| `mystic-ai` | Mystic AI | retired brand; no mark will be published |
| `nebius` | Nebius AI Cloud VM | no mark in Simple Icons 16.30.0 |
| `nomic-api` | Nomic API | no mark in Simple Icons 16.30.0 |
| `northflank-sandbox` | Northflank Sandboxes | no mark in Simple Icons 16.30.0 |
| `not-diamond` | Not Diamond | no mark in Simple Icons 16.30.0 |
| `novita-ai` | Novita AI | no mark in Simple Icons 16.30.0 |
| `octoai` | OctoAI | retired brand; no mark will be published |
| `open-webui` | Open WebUI | no mark in Simple Icons 16.30.0 |
| `opik` | Opik | Comet has no Simple Icons mark |
| `pachyderm` | Pachyderm | retired brand; no mark will be published |
| `playht` | PlayHT | retired brand; no mark will be published |
| `portkey` | Portkey AI Gateway | no mark in Simple Icons 16.30.0 |
| `prodigy` | Prodigy | no mark in Simple Icons 16.30.0 |
| `prompt-security` | Prompt Security | no mark in Simple Icons 16.30.0 |
| `promptfoo` | promptfoo | no mark in Simple Icons 16.30.0 |
| `promptlayer` | PromptLayer | no mark in Simple Icons 16.30.0 |
| `protect-ai` | Protect AI | retired brand; no mark will be published |
| `rapidminer` | RapidMiner AI Hub | no mark in Simple Icons 16.30.0 |
| `rebuff` | Rebuff | retired brand; no mark will be published |
| `reducto` | Reducto | no mark in Simple Icons 16.30.0 |
| `reka-api` | Reka API | no mark in Simple Icons 16.30.0 |
| `relevance-ai` | Relevance AI | no mark in Simple Icons 16.30.0 |
| `requesty` | Requesty | no mark in Simple Icons 16.30.0 |
| `retell-ai` | Retell AI | no mark in Simple Icons 16.30.0 |
| `rev-ai` | Rev AI | no mark in Simple Icons 16.30.0 |
| `rime` | Rime | Simple Icons `rime` is the Rime input method, not Rime Labs |
| `robust-intelligence` | Robust Intelligence | retired brand; no mark will be published |
| `runloop` | Runloop | no mark in Simple Icons 16.30.0 |
| `runpod` | Runpod Pod | no mark in Simple Icons 16.30.0 |
| `runway-api` | Runway API | no mark in Simple Icons 16.30.0 |
| `salesforce-agentforce` | Agentforce | Salesforce has no Simple Icons mark |
| `sambanova-api` | SambaNova Cloud | no mark in Simple Icons 16.30.0 |
| `scale-ai` | Scale AI | no mark in Simple Icons 16.30.0 |
| `scrapingbee` | ScrapingBee | no mark in Simple Icons 16.30.0 |
| `serpapi` | SerpApi | no mark in Simple Icons 16.30.0 |
| `serper` | Serper | no mark in Simple Icons 16.30.0 |
| `snorkel` | Snorkel Flow | no mark in Simple Icons 16.30.0 |
| `sourcegraph-cody` | Sourcegraph Cody | no mark in Simple Icons 16.30.0 |
| `speechmatics` | Speechmatics | no mark in Simple Icons 16.30.0 |
| `stability-ai-api` | Stability AI API | no mark in Simple Icons 16.30.0 |
| `steel-dev` | Steel | no mark in Simple Icons 16.30.0 |
| `superannotate` | SuperAnnotate | no mark in Simple Icons 16.30.0 |
| `surge-ai` | Surge AI | no mark in Simple Icons 16.30.0 |
| `synthflow` | Synthflow | no mark in Simple Icons 16.30.0 |
| `tabnine` | Tabnine | no mark in Simple Icons 16.30.0 |
| `tavily` | Tavily | no mark in Simple Icons 16.30.0 |
| `toloka` | Toloka | no mark in Simple Icons 16.30.0 |
| `traceloop` | Traceloop | no mark in Simple Icons 16.30.0 |
| `truera` | TruEra | retired brand; no mark will be published |
| `unify-ai` | Unify | retired brand; no mark will be published |
| `union-ai` | Union.ai | no mark in Simple Icons 16.30.0 |
| `unstructured-io` | Unstructured API | no mark in Simple Icons 16.30.0 |
| `v7` | V7 Darwin | no mark in Simple Icons 16.30.0 |
| `valohai` | Valohai | no mark in Simple Icons 16.30.0 |
| `vapi` | Vapi | no mark in Simple Icons 16.30.0 |
| `vast-ai` | Vast.ai instance | no mark in Simple Icons 16.30.0 |
| `voiceflow` | Voiceflow | no mark in Simple Icons 16.30.0 |
| `voyage-ai` | Voyage AI | only the parent's mark (`mongodb`) is in Simple Icons |
| `whylabs` | WhyLabs | retired brand; no mark will be published |
| `writer-api` | Writer API | no mark in Simple Icons 16.30.0 |
| `xai-api` | xAI API | Simple Icons `x` is the X (Twitter) mark, not xAI's |
| `xinference` | Xinference | no mark in Simple Icons 16.30.0 |
| `you-com-api` | You.com APIs | no mark in Simple Icons 16.30.0 |
| `zenml` | ZenML | no mark in Simple Icons 16.30.0 |
| `zep` | Zep | no mark in Simple Icons 16.30.0 |
| `zhipu-glm-api` | Z.ai Open Platform | no mark in Simple Icons 16.30.0 |

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
