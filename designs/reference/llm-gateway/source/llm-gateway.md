# Source

None. This design is written for the repository, not imported from a published architecture.
It exists as the reference pair for the AI rules `ai-api-key-unmanaged` and `ai-no-gateway`:
the smallest retrieval-augmented assistant that calls more than one AI vendor, which is the
shape most teams reach once a fallback model and a separate embedding vendor are added.

The clean twin follows the pattern the AI gateways document for themselves: LiteLLM's proxy
("LiteLLM Proxy Server", <https://docs.litellm.ai/docs/simple_proxy>) holds the vendor keys and
issues virtual keys to callers, routes and falls back between deployments
(<https://docs.litellm.ai/docs/routing>), and tracks spend per key.
