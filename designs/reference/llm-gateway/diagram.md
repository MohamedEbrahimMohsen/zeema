# llm-gateway

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_browser["Assistant UI<br/><i>web-browser</i>"]
  n_openai_chat["OpenAI chat<br/><i>openai-api</i>"]
  n_anthropic_chat["Anthropic fallback<br/><i>anthropic-api</i>"]
  n_cohere_embed["Cohere embed and rerank<br/><i>cohere-api</i>"]
  subgraph n_g_eu_west["eu-west (region)"]
    subgraph n_g_app_vpc["app-vpc (vpc)"]
      n_assistant_api["Assistant API<br/><i>container-service</i>"]
      n_ingest_worker["Document ingest<br/><i>container-worker</i>"]
      n_llm_router["LLM router<br/><i>litellm</i>"]
      n_secrets["Vendor keys<br/><i>hashicorp-vault</i>"]
      n_docs_db["Documents and chats<br/><i>postgres</i>"]
      n_vectors["Chunk vectors<br/><i>qdrant</i>"]
    end
  end
  n_browser -->|"ask [https]"| n_assistant_api
  n_assistant_api -->|"chat history [postgres]"| n_docs_db
  n_assistant_api -->|"retrieve chunks [grpc]"| n_vectors
  n_assistant_api -->|"chat, embed, rerank [https]"| n_llm_router
  n_ingest_worker -->|"embed chunks [https]"| n_llm_router
  n_ingest_worker -->|"upsert [grpc]"| n_vectors
  n_llm_router -->|"vendor keys [https]"| n_secrets
  n_llm_router -->|"https"| n_openai_chat
  n_llm_router -->|"fallback [https]"| n_anthropic_chat
  n_llm_router -->|"https"| n_cohere_embed
```
