# llm-gateway: notes

- Tier: reference design curated by Zeema; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/llm-gateway.md` (written for the repository, no published architecture)
- Size: 10 nodes, 10 edges, 2 groups. Broken twin: 8 nodes, 8 edges, 2 groups.

A retrieval-augmented assistant that calls three AI vendors: OpenAI for chat, Anthropic as the
fallback chat model, and Cohere for embeddings and reranking. It is the evidence for the two AI
rules: an API key nobody manages, and several vendors with nothing in front of them.

## Clean variant (header of design.yaml)

Reference architecture: a retrieval-augmented assistant that calls three AI vendors (chat,
fallback chat, embeddings and rerank), clean variant.

Fixes relative to llm-gateway.broken.yaml:
  - every model call passes llm-router (a LiteLLM proxy), which holds the vendor keys, retries,
    falls back from openai-chat to anthropic-chat, and meters spend in one place
  - the vendor keys live in secrets (HashiCorp Vault); the router reads them at start and each
    AI service declares keyStore and viaGateway
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture: a retrieval-augmented assistant that calls three AI vendors (chat,
fallback chat, embeddings and rerank), broken variant: the API and the ingest worker call each
vendor directly with a key from their own environment.

This file MUST trip:
  - ai-api-key-unmanaged     (openai-chat, anthropic-chat and cohere-embed are api-key vendors called from assistant-api and ingest-worker; no key-management node)
  - ai-no-gateway            (three AI services and no api-gateway node)
and MUST NOT trip:
  - credentials-without-rotation (security.credentialRotationDays is set)
  - datastore-missing-backup     (docs-db keeps backups with a retention period)
  - datastore-single-region      (the design does not require multi-region)

## Property choices

- `keyStore: true` and `viaGateway: true` on each AI service in the clean twin: the router is the
  only caller and it reads the keys from Vault.
- `llm-router.fallbacks: true`: LiteLLM retries and fallbacks are configured explicitly, they are
  off by default ("Router").
