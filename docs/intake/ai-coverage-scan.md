# AI tools and AI API coverage scan (2026-10-06)

Scope: every component whose main job is AI: model APIs you hold a key for, model serving, agent
runtimes, RAG building blocks, AI observability, guardrails, media generation, voice agents,
GPU clouds, data labelling. Cloud-provider AI is already dense (AWS 30+, Azure 25+, GCP 30+,
OCI 12, IBM 12, Alibaba 6, Cloudflare 7). The gap is the third-party and open-source world a
developer reaches with an API key or a `pip install`.

## What exists today (by kind)

| kind | count | examples |
|---|---|---|
| ai-service | 84 | openai-api, anthropic-api, google-gemini-api, mistral-api, cohere-api, groq, together-ai, fireworks-ai, openrouter, replicate, elevenlabs, deepgram, assemblyai, aws-bedrock, azure-openai, oci-generative-ai |
| ml-inference | 22 | vllm, sglang, ollama, localai, text-generation-inference, triton, kserve, bentoml, ray-serve, huggingface-inference, cloudflare-workers-ai, sagemaker-endpoint |
| ml-platform | 28 | aws-sagemaker, azure-machine-learning, google-vertex-ai, azure-ai-foundry, mlflow, weights-and-biases, clearml, kubeflow, metaflow, feast |
| vector-database | 18 | pinecone, qdrant, weaviate, milvus, chroma, lancedb, pgvector, turbopuffer, zilliz-cloud, cloudflare-vectorize, aws-s3-vectors |
| other kinds | | langsmith (monitoring); litellm, cloudflare-ai-gateway, google-agent-gateway (api-gateway); google-model-armor (policy-engine); cloudflare-firewall-for-ai (waf); aws-bedrock-knowledge-base, azure-ai-search, cloudflare-ai-search (search-index); azure-bot-service, google-vertex-ai-agent-engine (app-server) |

Precedents fix the kind for every new entry below. No new kind is needed.

## Gaps, grouped (proposed id, kind in heading)

### A. Model APIs you hold a key for (ai-service)

xai-api (Grok), deepseek-api, perplexity-api (Sonar), ai21-api (Jamba), stability-ai-api,
black-forest-labs-api (FLUX), fal-ai, runway-api, luma-api, ideogram-api, suno-api,
voyage-ai (embeddings + rerank), jina-ai (embeddings + reader + reranker), nomic-api,
cerebras-api, sambanova-api, nvidia-nim-api (build.nvidia.com), aleph-alpha-api, reka-api,
writer-api, moonshot-kimi-api, zhipu-glm-api, baidu-ernie-api, minimax-api, deepinfra,
novita-ai, lepton-ai.

Folds and aliases: midjourney has no public API (record as gap, no box); qwen-api is an alias
on alibaba-model-studio (DashScope); google-ai-studio is an alias on google-gemini-api;
hugging-face-inference-providers is an alias on huggingface-inference; openai-realtime and
whisper become `realtime` and `audio` on openai-api, not components.

### B. Speech, voice and voice-agent platforms

ai-service: cartesia, playht, rime, speechmatics, gladia, rev-ai, hume-ai, vapi, retell-ai,
bland-ai, synthflow.
app-server (open-source agent runtimes you host): pipecat, livekit-agents.
Property: twilio-conversationrelay is a flag on twilio-video or twilio-flex, not a box.

### C. Self-hosted serving and GPU clouds

ml-inference: lmdeploy, tensorrt-llm, nvidia-nim, mlc-llm, llama-cpp-server, lm-studio, jan,
xinference, infinity-embeddings, text-embeddings-inference, modal, baseten, anyscale-endpoints,
mystic-ai, beam-cloud, octoai (retired 2024, keep), banana-dev (retired, keep).
app-server: open-webui.
virtual-machine or big-data-cluster: runpod, lambda-labs, coreweave, nebius, crusoe, vast-ai,
nvidia-dgx-cloud.
Folds: nvidia-triton is an alias on triton; paperspace exists as digitalocean-paperspace;
aws-trainium and aws-inferentia become `accelerator` values on aws-ec2 (same pattern as
spot and confidential).

### D. Agent and LLM-app frameworks and runtimes (app-server)

langgraph-platform, llamaindex-cloud, crewai-enterprise, autogen-studio, dify, flowise,
langflow, botpress, rasa, voiceflow, microsoft-copilot-studio, salesforce-agentforce,
zapier-agents, relevance-ai, lindy, mcp-server (generic, `transport` enum stdio / sse /
streamable-http).
Recorded gaps (libraries, not boxes): langchain, openai-agents-sdk, semantic-kernel,
google-genkit, vercel-ai-sdk.

### E. AI gateways and routers (api-gateway)

portkey, helicone-gateway, kong-ai-gateway, vercel-ai-gateway, unify-ai, martian, not-diamond,
requesty.
Properties: azure-apim-genai-gateway is a flag on azure-api-management; aws-bedrock
cross-region already exists.

### F. LLM observability, evals, prompt management (monitoring unless noted)

langfuse, helicone, braintrust, arize-phoenix, arize-ax, opik, promptlayer, humanloop, galileo,
traceloop, lunary, honeyhive, evidently-ai, whylabs, fiddler-ai, arthur-ai, giskard,
confident-ai, truera (retired, keep).
ci-pipeline: promptfoo, deepeval.
Alias: weave on weights-and-biases. Gap: ragas (library).

### G. Guardrails and AI security (policy-engine; waf where it sits inline)

nemo-guardrails, guardrails-ai, lakera-guard, protect-ai, prompt-security, robust-intelligence
(acquired by Cisco, keep), hiddenlayer, calypsoai, llm-guard, rebuff (retired, keep).
Properties: openai-moderation on openai-api; prompt-shields on azure-ai-content-safety.
Gap: llama-guard (a model, not a box).

### H. RAG building blocks

Ingestion and parsing (worker): unstructured-io, llamaparse, reducto, chunkr.
Crawl and browse (third-party-api): firecrawl, jina-reader (in jina-ai), apify, scrapingbee,
browserbase, steel-dev, hyperbrowser.
Search APIs (third-party-api): tavily, exa-ai, serper, serpapi, brave-search-api, you-com-api,
google-custom-search-api, bing-web-search (retired Aug 2025, keep).
Rerankers: mixedbread-ai (ai-service); cohere-rerank, jina-reranker, voyage-rerank are
properties on their vendor.
Vector databases missing: pgvectorscale, deeplake, vespa-cloud, myscale, epsilla, kdb-ai.
Vector as a property (`vectorSearch: boolean`) on existing stores: elasticsearch, opensearch,
vespa, redis, mongodb-atlas, supabase, neon, typesense, azure-cosmos-db, singlestore, cassandra,
datastax, couchbase, clickhouse, oracle-db, sql-server.
Memory layers (cache): mem0, zep, letta, cognee, graphiti.
Sandboxes (worker): e2b, daytona, vercel-sandbox, runloop, northflank-sandbox; modal-sandbox
and cloudflare-sandbox are properties.
Gaps (libraries): docling, faiss, annoy, hnswlib, usearch.

### I. Data labelling and training data (ml-platform)

label-studio, labelbox, scale-ai, snorkel, roboflow, encord, v7, superannotate, argilla, cvat,
prodigy, kili, datasaur, toloka, surge-ai.
artifact-repository: hugging-face-hub, civitai.

### J. Enterprise AutoML, data-science platforms, missing cloud AI (ml-platform unless noted)

Third party: datarobot, dataiku, c3-ai, domino-data-lab, alteryx, knime, rapidminer (retired,
keep), abacus-ai, valohai, union-ai, deepchecks, dvc, lakefs, pachyderm, zenml, flyte,
neptune-ai (monitoring), comet-ml (monitoring).
Properties: h2o-ai-cloud alias on h2o; databricks-mosaic-ai on databricks; snowflake-cortex on
snowflake; bigquery-ml on google-bigquery.
AWS: aws-sagemaker-canvas, aws-sagemaker-unified-studio, aws-bedrock-data-automation,
aws-q-developer, aws-codewhisperer (retired, keep), aws-lookout-for-vision (retired, keep),
aws-lookout-for-metrics (retired, keep); amazon-nova is a model, folds on aws-bedrock.
GCP: google-gemini-enterprise (was Agentspace), google-gemini-code-assist; vertex-ai-agent-builder
alias on google-vertex-ai-agent-engine; imagen and veo fold as `modality` on google-vertex-ai;
contact-center-ai alias on google-agent-assist.
Azure: azure-copilot-studio.
Default: github-copilot, github-models (third-party-api).
Gap: kedro (library).

### K. AI coding assistants and dev tools (third-party-api, drawn as the client)

cursor, claude-code, windsurf, tabnine, sourcegraph-cody, jetbrains-ai, replit-agent, lovable,
bolt-new, v0. Teams draw "assistant → MCP server → our API"; the assistant is the client box.

### L. Hardware accelerators (fold, not components)

Keep `accelerator` (none / gpu / tpu / asic) and add an advanced `acceleratorModel` enum:
nvidia-h100, nvidia-h200, nvidia-b200, nvidia-l4, nvidia-a100, amd-mi300x, aws-trainium,
aws-inferentia, google-tpu, intel-gaudi, groq-lpu, cerebras-wse.

## Kind property additions (ai-service)

- `auth`: enum api-key / oauth / iam / none. The "API key" question itself. A rule can flag an
  api-key vendor reached from an app that has no key-management box.
- `keyStore`: boolean, key held in a key-management component.
- `rateLimitRpm`, `rateLimitTpm`: integer, advanced. Vendor tier limits.
- `viaGateway`: boolean, routed through an AI gateway with fallback.
- `dataResidency`: enum us / eu / asia / global, advanced.
- `modality` gains image, video, audio, embedding, rerank (today: text, vision, speech,
  multimodal, structured).

## Rules to add

1. `ai-api-key-unmanaged`: ai-service with `auth: api-key` fed by an app-server, and no
   key-management component in the design. Warn.
2. `ai-no-gateway`: three or more ai-service vendors in one design and no api-gateway between the
   app and them. Info: add a router (litellm, portkey, openrouter, cloudflare-ai-gateway).

## Counts

| group | new components | folds, aliases, properties | recorded gaps (libraries) |
|---|---|---|---|
| A model APIs | 27 | 5 | 1 |
| B speech and voice | 13 | 1 | 0 |
| C serving and GPU | 25 | 4 | 0 |
| D agent runtimes | 16 | 0 | 5 |
| E gateways | 8 | 2 | 0 |
| F observability | 21 | 1 | 1 |
| G guardrails | 10 | 2 | 1 |
| H RAG blocks | 40 | 21 | 5 |
| I labelling | 17 | 0 | 0 |
| J platforms and cloud | 30 | 8 | 1 |
| K coding assistants | 10 | 0 | 0 |
| total | ~217 | ~44 | ~14 |

Icons: each new component needs an SVG under `icons/components/<provider>/`, from the vendor
press kit; fallback is the kind glyph (`docs/icons-missing.md`).

## Order of work (if approved)

1. Kind property additions and the two rules. Small, and every later box benefits.
2. A, E, F, G: the "API key" world, ~66 components. Highest hit rate in real designs.
3. H, D: RAG and agents, ~56.
4. C, B: serving, GPU, voice, ~38.
5. I, J, K: platforms, labelling, assistants, ~57.

Each step: locale entries, inventory rows, icons, `pnpm validate`, `pnpm bundle`. Render is
unchanged, so no thumbnail revision bump.
