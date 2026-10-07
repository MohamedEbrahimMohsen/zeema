# Edge authentication (2026-10-07)

Source: imported and authored designs drawn on Azure, AWS and Google Cloud, where people draw a
Managed Identity (or an IAM role, or a service account) as a box between every caller and every
callee. `designs/imported/talmaza` does it with `azure-managed-identity` nodes. The identity is
not a hop: nothing calls it and nothing is called through it. It is how the edge authenticates.

## What the format gains

- Edge field `auth`: `managed-identity`, `iam-role`, `service-account`, `workload-identity`,
  `api-key`, `oauth`, `mtls`, `basic`, `none`. Optional; any other value is a structural error.
- Requirement path `security.edgeAuthDeclared` (boolean): the design promises that every edge
  into data, secrets, queues, streams or an AI service states its `auth`. Opt-in, because every
  reference design draws dozens of such edges and none says how they authenticate; a rule that
  fired without the promise would report each of them.
- Predicates `kind` and `provider` (node subject, used under `to`/`from`): the component's kind
  and its provider. The rules below cannot be written without them.

## Rules

- `edge-auth-unset` (info): `security.edgeAuthDeclared` is true and an edge into a sql-database,
  nosql-database, cache, object-store, queue, stream, key-management, ai-service or search-index
  has no `auth`. Tripped by `designs/reference/llm-gateway/design.broken.yaml`.
- `edge-auth-key-where-identity` (info): `auth: api-key` or `basic` on an edge into an Azure, AWS
  or Google Cloud component, which accepts a managed identity, an IAM role or a service account
  instead. Tripped by `designs/reference/netflix-streaming/design.broken.yaml` (a password into
  RDS).

`ai-api-key-unmanaged` reads the AI service's own `auth` property (how the vendor is reached),
not the edge's. In the llm-gateway broken twin the vendor hops say `auth: "api-key"`, so that rule
reports the vendors and `edge-auth-unset` reports only the database hop: never the same edge.
